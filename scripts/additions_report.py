"""One-off report: posts added to the Homes in Georgia channels over the last two weeks.

Reads live posts and (if the session is a channel admin) deleted posts from the
admin log, takes the agent hashtag from the contact line and writes
reports/additions.json. Also saves the CRM's own weekly counters from getAnalytics.
"""
import asyncio
from datetime import datetime, timedelta
import json
import os
from pathlib import Path
import re
from urllib.request import Request, urlopen

from telethon import TelegramClient
from telethon.sessions import StringSession

from update_public_catalog import CHANNELS, TZ
from update_telegram_top10 import parse_property, required_environment

ROOT = Path(__file__).resolve().parents[1]
SINCE = datetime.fromisoformat(os.environ.get("REPORT_SINCE", "2026-10-12T00:00:00+04:00"))
API_URL = "https://script.google.com/macros/s/AKfycbwrLMoJWg-hiCcV63_aCTpp3QvIEXDXiuoH3mJ0TlBuzMkKsrC9ntEvOz79QXEonvLlKQ/exec"
SKIP_TAGS = {"price", "exclusive", "discount", "rent", "sale", "apartment", "house"}


def agent_tag(text):
    for line in text.split("\n"):
        if "+995" in line or "📲" in line:
            tags = re.findall(r"#(\w+)", line)
            if tags:
                return tags[-1]
    return ""


def row(kind, channel, message, text, deleted):
    return {
        "kind": kind, "channel": channel, "id": message.id,
        "date": message.date.astimezone(TZ).isoformat(timespec="seconds"),
        "agent": agent_tag(text), "listing": parse_property(message.id, text) is not None,
        "first_line": text.split("\n", 1)[0][:120], "deleted": deleted,
        "url": f"https://t.me/{channel}/{message.id}",
    }


async def collect(client, kind, channel):
    groups = {}
    async for message in client.iter_messages(channel):
        if message.date < SINCE:
            break
        groups.setdefault(str(message.grouped_id or message.id), []).append(message)
    rows = []
    for group in groups.values():
        group.sort(key=lambda item: item.id)
        text_message = next((item for item in group if (item.message or "").strip()), None)
        if text_message:
            rows.append(row(kind, channel, text_message, text_message.message.strip(), False))
    deleted = []
    try:
        async for event in client.iter_admin_log(channel, delete=True):
            message = event.old
            if message is not None and message.date >= SINCE and (message.message or "").strip():
                deleted.append(row(kind, channel, message, message.message.strip(), True))
        print(f"{channel}: admin log read, {len(deleted)} deleted posts")
    except Exception as error:
        print(f"{channel}: admin log unavailable: {error}")
    return rows + deleted


def crm_weekly():
    out = {}
    for action in ("getAnalytics", "getLists"):
        try:
            raw = urlopen(Request(f"{API_URL}?action={action}&callback=cb", headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read().decode("utf-8")
            data = json.loads(raw[raw.index("(") + 1:raw.rindex(")")])
            out[action] = {key: value for key, value in data.items() if "week" in key.lower()}
            out[action + "_keys"] = sorted(data.keys())
        except Exception as error:
            out[action] = f"error: {error}"
    return out


async def main():
    credentials = required_environment()
    client = TelegramClient(StringSession(credentials["session"]), credentials["api_id"], credentials["api_hash"], receive_updates=False, catch_up=False)
    await client.connect()
    rows = []
    try:
        for kind, channel in CHANNELS.items():
            try:
                found = await collect(client, kind, channel)
                rows += found
                print(f"{channel}: {len(found)} posts since {SINCE.date()}")
            except Exception as error:
                print(f"{channel}: error {error}")
    finally:
        await client.disconnect()
    rows.sort(key=lambda item: item["date"])
    report = {"generated_at": datetime.now(TZ).isoformat(timespec="seconds"), "since": SINCE.isoformat(), "crm": crm_weekly(), "posts": rows}
    (ROOT / "reports").mkdir(exist_ok=True)
    (ROOT / "reports" / "additions.json").write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
