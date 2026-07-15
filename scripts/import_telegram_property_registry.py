#!/usr/bin/env python3
"""Import the Telegram channel into an independent property registry."""

import asyncio
from dataclasses import dataclass
from datetime import datetime
import json
import os
from pathlib import Path
import re
from zoneinfo import ZoneInfo

from telethon import TelegramClient
from telethon.sessions import StringSession

from update_telegram_top10 import (
    CHANNEL,
    TBILISI_TZ,
    build_post_url,
    extract_coordinates_from_map_url,
    extract_coordinates_from_text,
    extract_native_geo,
    extract_urls_from_message,
    iso,
    load_json,
    parse_property,
    required_environment,
    save_json,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "telegram-property-registry.json"
RANKING_PATH = ROOT / "telegram-top10.json"
MEDIA_PATH = ROOT / "telegram-media"
MESSAGE_LIMIT = int(os.environ.get("TELEGRAM_REGISTRY_MESSAGE_LIMIT", "2000"))
MEDIA_CONCURRENCY = int(os.environ.get("TELEGRAM_REGISTRY_MEDIA_CONCURRENCY", "6"))
MEDIA_TIMEOUT_SECONDS = int(os.environ.get("TELEGRAM_REGISTRY_MEDIA_TIMEOUT_SECONDS", "60"))
HASHTAG_PATTERN = re.compile(r"#([A-Za-z][A-Za-z0-9_]*)")


@dataclass
class StoredMedia:
    relative_url: str
    status: str


class MediaStorage:
    async def store(self, client, message, filename):
        raise NotImplementedError


class StaticMediaStorage(MediaStorage):
    def __init__(self, root=MEDIA_PATH):
        self.root = Path(root)

    async def store(self, client, message, filename):
        self.root.mkdir(parents=True, exist_ok=True)
        target = self.root / filename
        try:
            downloaded = await asyncio.wait_for(
                client.download_media(message, file=str(target)),
                timeout=MEDIA_TIMEOUT_SECONDS,
            )
        except Exception:
            return StoredMedia("", "download_failed")
        if not downloaded or not target.exists() or target.stat().st_size == 0:
            return StoredMedia("", "storage_failed")
        return StoredMedia(f"telegram-media/{target.name}", "media_ready")


def normalize_agent_hashtag(text):
    contact = text.split("📲", 1)[-1] if "📲" in text else text
    candidates = HASHTAG_PATTERN.findall(contact)
    return candidates[-1] if candidates else ""


def agent_id(hashtag):
    return f"agent:{hashtag.lower()}"


def property_id(source_url):
    message_id = source_url.rstrip("/").rsplit("/", 1)[-1]
    return f"telegram:{message_id}"


def channel_age_minutes(published_at, now):
    return max(int((now - published_at).total_seconds() // 60), 0)


def media_diagnostic(media, had_media, failures=None):
    if media:
        return "media_ready"
    if not had_media:
        return "no_media_in_post"
    failures = failures or []
    if "storage_failed" in failures:
        return "storage_failed"
    if "invalid_mapping" in failures:
        return "invalid_mapping"
    return "download_failed"


def extract_registry_location(message):
    latitude, longitude, source = extract_native_geo(message)
    if latitude is not None:
        return {"latitude": latitude, "longitude": longitude, "location_source": source, "location_url": None}
    text = getattr(message, "message", "") or ""
    latitude, longitude, source = extract_coordinates_from_text(text)
    if latitude is not None:
        return {"latitude": latitude, "longitude": longitude, "location_source": source, "location_url": None}
    urls = extract_urls_from_message(message)
    for url in urls:
        latitude, longitude, source = extract_coordinates_from_map_url(url)
        if latitude is not None:
            return {"latitude": latitude, "longitude": longitude, "location_source": source, "location_url": url}
    map_url = next((url for url in urls if "maps" in url.lower() or "goo.gl" in url.lower()), None)
    return {"latitude": None, "longitude": None, "location_source": None, "location_url": map_url}


def merge_property(previous, incoming, now):
    if not previous:
        return {
            **incoming,
            "firstSeenAt": incoming["publishedAt"],
            "lastSeenAt": iso(now),
            "changeHistory": [{"at": iso(now), "type": "created"}],
        }, True
    tracked = ("rawText", "address", "price", "assignedAgentId", "lifecycleStatus", "mediaImportStatus")
    changes = [field for field in tracked if previous.get(field) != incoming.get(field)]
    history = list(previous.get("changeHistory") or [])
    if changes:
        history.append({"at": iso(now), "type": "updated", "fields": changes})
    return {
        **previous,
        **incoming,
        "firstSeenAt": previous.get("firstSeenAt") or incoming["publishedAt"],
        "lastSeenAt": iso(now),
        "changeHistory": history,
    }, False


def registry_payload(properties, agents, now, report):
    return {
        "schemaVersion": 1,
        "channel": CHANNEL,
        "updatedAt": iso(now),
        "agents": sorted(agents.values(), key=lambda item: item["agentHashtag"].lower()),
        "properties": sorted(properties, key=lambda item: item["publishedAt"], reverse=True),
        "report": report,
    }


def link_ranking_to_registry(ranking, properties):
    if not isinstance(ranking, dict):
        return ranking
    by_url = {item["sourceTelegramUrl"]: item for item in properties}
    for item in ranking.get("items") or []:
        prop = by_url.get(item.get("sourceTelegramUrl") or item.get("post_url"))
        item["propertyId"] = prop.get("id") if prop else None
        coordinates = prop.get("coordinates") if prop else None
        if coordinates:
            item["latitude"] = coordinates["latitude"]
            item["longitude"] = coordinates["longitude"]
    return ranking


async def import_group_media(client, storage, primary_id, group, semaphore):
    async def store(order, message):
        extension = "mp4" if message.video else "jpg"
        async with semaphore:
            result = await storage.store(client, message, f"{primary_id}-{order + 1}.{extension}")
        return order, message, result

    messages = [item for item in group if item.photo or item.video]
    return await asyncio.gather(*(store(order, message) for order, message in enumerate(messages)))


async def import_registry(client, storage=None, now=None):
    storage = storage or StaticMediaStorage()
    now = now or datetime.now(TBILISI_TZ)
    previous_payload = load_json(OUTPUT_PATH) or {}
    previous = {item["sourceTelegramUrl"]: item for item in previous_payload.get("properties") or []}
    messages = [message async for message in client.iter_messages(CHANNEL, limit=MESSAGE_LIMIT)]
    groups = {}
    for message in messages:
        groups.setdefault(str(message.grouped_id or message.id), []).append(message)

    properties_by_url = dict(previous)
    agents = {item["id"]: item for item in previous_payload.get("agents") or []}
    created = updated = with_media = without_media = media_errors = 0
    prepared_groups = []
    semaphore = asyncio.Semaphore(MEDIA_CONCURRENCY)
    for group in groups.values():
        group.sort(key=lambda item: item.id)
        primary = next((item for item in group if item.message), group[0])
        prepared_groups.append((group, primary))
    media_batches = await asyncio.gather(*(
        import_group_media(client, storage, primary.id, group, semaphore)
        for group, primary in prepared_groups
    ))

    for (group, primary), stored_batch in zip(prepared_groups, media_batches):
        raw_text = primary.message or ""
        parsed = parse_property(primary.id, raw_text)
        if parsed is None:
            continue
        source_url = build_post_url(CHANNEL, primary.id)
        hashtag = normalize_agent_hashtag(raw_text)
        assigned_agent = agent_id(hashtag) if hashtag else None
        if hashtag:
            agents[assigned_agent] = {
                "id": assigned_agent,
                "telegramUserId": None,
                "telegramUsername": None,
                "fullName": hashtag,
                "agentHashtag": hashtag,
                "role": "agent",
                "active": True,
            }
        media = []
        media_failures = []
        had_media = any(item.photo or item.video for item in group)
        for order, message, stored in stored_batch:
            if stored.status != "media_ready":
                media_failures.append(stored.status)
                continue
            media_object = getattr(message, "photo", None) or getattr(message, "document", None)
            media.append({
                "id": f"{primary.id}:{order + 1}",
                "type": "video" if message.video else "image",
                "sourceMessageId": str(message.id),
                "sourceFileId": str(getattr(media_object, "id", "")),
                "originalUrl": stored.relative_url,
                "thumbnailUrl": stored.relative_url,
                "width": getattr(media_object, "w", None),
                "height": getattr(media_object, "h", None),
                "order": order,
                "isPrimary": order == 0,
            })
        location = extract_registry_location(primary)
        published_at = primary.date.astimezone(TBILISI_TZ)
        status = media_diagnostic(media, had_media, media_failures)
        incoming = {
            "id": property_id(source_url),
            "sourceTelegramUrl": source_url,
            "sourceTelegramMessageId": str(primary.id),
            "publishedAt": iso(published_at),
            "editedAt": iso(primary.edit_date.astimezone(TBILISI_TZ)) if primary.edit_date else None,
            "rawText": raw_text,
            "caption": raw_text,
            "address": parsed["address"],
            "district": parsed["district"],
            "metro": parsed["metro"],
            "price": parsed["price"],
            "currency": "USD" if "$" in raw_text or "USD" in raw_text.upper() else "GEL",
            "area": parsed["area"],
            "floor": int(parsed["floor"].split("/")[0]) if parsed["floor"] else None,
            "totalFloors": int(parsed["floor"].split("/")[1]) if parsed["floor"] else None,
            "bedrooms": parsed["rooms"],
            "propertyType": "Apartment",
            "agentHashtag": hashtag or None,
            "assignedAgentId": assigned_agent,
            "googleMapsUrl": location.get("location_url"),
            "coordinates": {"latitude": location["latitude"], "longitude": location["longitude"]} if location["latitude"] is not None else None,
            "media": media,
            "mediaImportStatus": status,
            "telegramAvailable": True,
            "lifecycleStatus": "active",
            "repostCount": 0,
            "highestRank": None,
            "maxRepostCount": 0,
            "channelAgeMinutes": channel_age_minutes(published_at, now),
        }
        merged, is_created = merge_property(previous.get(source_url), incoming, now)
        created += int(is_created)
        updated += int(not is_created)
        with_media += int(bool(media))
        without_media += int(not had_media)
        media_errors += int(had_media and not media)
        properties_by_url[source_url] = merged

    properties = list(properties_by_url.values())

    ranking = load_json(RANKING_PATH) or {}
    ranks = {item.get("post_url"): item for item in ranking.get("items") or []}
    for item in properties:
        ranked = ranks.get(item["sourceTelegramUrl"])
        if ranked:
            item["repostCount"] = int(ranked.get("repostCount", 0))
            item["highestRank"] = ranked.get("highestRank")
            item["maxRepostCount"] = int(ranked.get("maxRepostCount", item["repostCount"]))
    report = {
        "processedPublications": created + updated,
        "created": created,
        "updated": updated,
        "withRealMedia": with_media,
        "withoutMedia": without_media,
        "mediaErrors": media_errors,
        "unassignedAgents": sum(1 for item in properties if not item["assignedAgentId"]),
    }
    payload = registry_payload(properties, agents, now, report)
    save_json(OUTPUT_PATH, payload)
    save_json(RANKING_PATH, link_ranking_to_registry(ranking, properties))
    return payload


async def update():
    credentials = required_environment()
    async with TelegramClient(StringSession(credentials["session"]), credentials["api_id"], credentials["api_hash"]) as client:
        payload = await import_registry(client)
    print(json.dumps(payload["report"], ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(update())
