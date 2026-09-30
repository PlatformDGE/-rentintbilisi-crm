#!/usr/bin/env python3
"""Build public Homes in Georgia catalogs from active Telegram channel posts."""

import asyncio
from datetime import datetime, timedelta
import json
import os
from pathlib import Path
import re
import shutil
from zoneinfo import ZoneInfo

from telethon import TelegramClient
from telethon.sessions import StringSession

from update_telegram_top10 import parse_property, required_environment

ROOT = Path(__file__).resolve().parents[1]
TZ = ZoneInfo("Asia/Tbilisi")
MESSAGE_LIMIT = int(os.environ.get("CATALOG_MESSAGE_LIMIT", "300"))
MAX_OBJECTS = int(os.environ.get("CATALOG_MAX_OBJECTS", "80"))
CHANNELS = {"rent": "rent_tbilisi_ge", "sale": "sale_in_tbilisi"}


def iso(value):
    return value.astimezone(TZ).replace(microsecond=0).isoformat()


def map_url(text):
    match = re.search(r"https?://(?:www\.)?(?:google\.[^\s]+/maps[^\s]*|maps\.app\.goo\.gl/[^\s]+)", text or "", re.I)
    return match.group(0).rstrip(".,)") if match else ""


def load_text(message):
    return (message.message or "").strip()


async def collect_channel(client, channel, kind):
    groups = {}
    async for message in client.iter_messages(channel, limit=MESSAGE_LIMIT):
        key = str(message.grouped_id or message.id)
        groups.setdefault(key, []).append(message)

    rows = []
    for group in groups.values():
        group.sort(key=lambda item: (item.date, item.id))
        text_message = next((item for item in group if load_text(item)), group[0])
        text = load_text(text_message)
        property_data = parse_property(text_message.id, text)
        if property_data is None:
            continue
        photos = [item for item in group if item.photo][:9]
        rows.append({
            **property_data,
            "type": kind,
            "channel": channel,
            "post_url": f"https://t.me/{channel}/{text_message.id}",
            "published_at": iso(group[0].date),
            "map_url": map_url(text),
            "_messages": photos,
        })

    rows.sort(key=lambda item: item["published_at"], reverse=True)
    return rows[:MAX_OBJECTS]


async def download_photos(client, rows, kind):
    target_dir = ROOT / "site" / "media" / kind
    target_dir.mkdir(parents=True, exist_ok=True)
    wanted = set()
    for row in rows:
        photos = []
        for index, message in enumerate(row.pop("_messages", []), start=1):
            filename = f"{row['id']}-{index}.jpg"
            target = target_dir / filename
            wanted.add(filename)
            try:
                await client.download_media(message, file=str(target))
                if target.exists():
                    photos.append(f"media/{kind}/{filename}")
            except Exception as error:
                print(f"photo {row['id']}#{index}: {error}")
        row["photos"] = photos
        row["image"] = photos[0] if photos else ""
    for old in target_dir.iterdir():
        if old.is_file() and old.name not in wanted:
            old.unlink()


def save_catalog(kind, channel, rows, updated_at):
    path = ROOT / "site" / "data" / f"{kind}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"kind": kind, "channel": channel, "source": "active_channel", "updated_at": updated_at, "items": rows}
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def main():
    credentials = required_environment()
    client = TelegramClient(StringSession(credentials["session"]), credentials["api_id"], credentials["api_hash"])
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        raise RuntimeError("TELEGRAM_SESSION не авторизована")
    try:
        now = datetime.now(TZ)
        for kind, channel in CHANNELS.items():
            rows = await collect_channel(client, channel, kind)
            await download_photos(client, rows, kind)
            save_catalog(kind, channel, rows, iso(now))
            print(f"{kind}: {len(rows)} active objects")
    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
