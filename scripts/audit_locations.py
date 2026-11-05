#!/usr/bin/env python3
# Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
"""Read-only check of the map links in active posts. Changes no catalog data."""

import asyncio
from collections import Counter
import json
from math import cos, hypot, radians
import re
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.types import MessageEntityTextUrl, MessageEntityUrl

from update_public_catalog import CHANNELS, ROOT, valid_tbilisi_point
from update_telegram_top10 import required_environment

REPORT = ROOT / "audit" / "locations.json"
MAP_LINK = re.compile(r"google\.[^/]+/maps|maps\.google\.|goo\.gl/maps|maps\.app\.goo\.gl|g\.co/kgs", re.I)


def message_links(message):
    links = []
    for entity, text in message.get_entities_text():
        if isinstance(entity, MessageEntityTextUrl):
            links.append((text, entity.url))
        elif isinstance(entity, MessageEntityUrl):
            links.append((text, text))
    for row in getattr(message.reply_markup, "rows", None) or []:
        for button in row.buttons:
            if getattr(button, "url", None):
                links.append(("button:" + button.text, button.url))
    return links


def coordinates(url):
    raw = unquote(url)
    for pattern in (r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)", r"[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)", r"@(-?\d+\.\d+),\s*(-?\d+\.\d+)"):
        found = re.search(pattern, raw)
        if found and valid_tbilisi_point(found.group(1), found.group(2)):
            return float(found.group(1)), float(found.group(2))
    return None


def resolve(url):
    point = coordinates(url)
    final = url
    if not point:
        try:
            request = Request(url, headers={"User-Agent": "Mozilla/5.0 HomesInGeorgiaCatalog/1.0"})
            with urlopen(request, timeout=8) as response:
                final = response.geturl()
                point = coordinates(final) or coordinates(response.read(300000).decode("utf-8", "ignore"))
        except Exception as error:
            final = f"error: {error}"
    return point, final


def km(a, b):
    return hypot((a[0] - b[0]) * 111, (a[1] - b[1]) * 111 * cos(radians(a[0])))


async def main():
    creds = required_environment()
    client = TelegramClient(StringSession(creds["session"]), creds["api_id"], creds["api_hash"], receive_updates=False, catch_up=False)
    await client.connect()
    report = {"channels": {}, "rows": [], "other_links": Counter(), "hidden_texts": Counter()}
    try:
        for kind, channel in CHANNELS.items():
            path = ROOT / "site" / "data" / f"{kind}.json"
            saved = {str(x.get("id")): x for x in json.loads(path.read_text(encoding="utf-8")).get("items", [])} if path.exists() else {}
            stats = Counter(saved=len(saved))
            groups = {}
            async for message in client.iter_messages(channel):
                groups.setdefault(str(message.grouped_id or message.id), []).append(message)
            for group in groups.values():
                text_message = next((m for m in group if (m.message or "").strip() and str(m.id) in saved), None)
                if not text_message:
                    continue
                stats["found"] += 1
                links = message_links(text_message)
                maps = [(t, u) for t, u in links if MAP_LINK.search(u)]
                for t, u in links:
                    if not MAP_LINK.search(u):
                        report["other_links"][urlparse(u).netloc] += 1
                for t, _ in maps:
                    report["hidden_texts"][t.strip()[:40]] += 1
                if not maps:
                    stats["no_map_link"] += 1
                if len(maps) > 1:
                    stats["several_map_links"] += 1
                row = saved[str(text_message.id)]
                entry = {"kind": kind, "id": row.get("id"), "title": row.get("title"), "published_at": row.get("published_at"), "old": (row.get("lat"), row.get("lon")), "maps": maps[:3], "links": len(links)}
                report["rows"].append(entry)
            report["channels"][kind] = dict(stats)
            print(kind, dict(stats))
    finally:
        await client.disconnect()
    # Listings on the site were the point of the check: resolve links newest first, within a time budget.
    done = 0
    for entry in sorted(report["rows"], key=lambda e: e.get("published_at") or "", reverse=True):
        if not entry["maps"] or done >= 700:
            continue
        done += 1
        point, final = resolve(entry["maps"][0][1])
        entry["new"], entry["final"] = point, final[:220]
        if point and entry["old"][0] is not None:
            entry["km"] = round(km(point, (float(entry["old"][0]), float(entry["old"][1]))), 3)
    report["other_links"] = dict(report["other_links"].most_common(30))
    report["hidden_texts"] = dict(report["hidden_texts"].most_common(30))
    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
