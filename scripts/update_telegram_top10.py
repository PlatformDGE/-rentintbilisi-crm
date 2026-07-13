#!/usr/bin/env python3
"""Update the daily Telegram repost ranking through MTProto and Telethon."""

import asyncio
from datetime import datetime, timedelta
import json
import os
from pathlib import Path
import re
import sys
from zoneinfo import ZoneInfo

from telethon import TelegramClient
from telethon.sessions import StringSession

CHANNEL = "rent_tbilisi_ge"
MESSAGE_LIMIT = 300
TBILISI_TZ = ZoneInfo("Asia/Tbilisi")
TEST_MODE = os.environ.get("TELEGRAM_TEST_MODE", "false").lower() == "true"
ROOT = Path(__file__).resolve().parents[1]
STATE_PATH = ROOT / "telegram-reposts-state.json"
OUTPUT_PATH = ROOT / "telegram-top10.json"
IMAGES_PATH = ROOT / "telegram-images"

DISTRICTS = [
    "Old Tbilisi", "Didi Dighomi", "Nadzaladevi", "Mtatsminda", "Chugureti",
    "Saburtalo", "Ortachala", "Krtsanisi", "Avlabari", "Samgori", "Gldani",
    "Sololaki", "Digomi", "Vake", "Vera", "Lisi", "Isani",
]
METROS = [
    "Medical University", "Technical University", "Vazha-Pshavela",
    "State University", "Liberty Square", "Station Square",
    "Akhmeteli Theatre", "Marjanishvili", "300 Aragveli", "Nadzaladevi",
    "Ghrmaghele", "Gotsiridze", "Rustaveli", "Avlabari", "Samgori",
    "Didube", "Varketili", "Delisi", "Isani",
]


def iso(value):
    return value.replace(microsecond=0).isoformat()


def load_json(path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def window_for(now):
    start = now.replace(hour=10, minute=0, second=0, microsecond=0)
    end = now.replace(hour=22, minute=0, second=0, microsecond=0)
    return start, end


def period_status(now, start, end):
    if now < start:
        return "before_window"
    if now < end:
        return "active"
    return "finished"


def normalize_space(value):
    return re.sub(r"[ \t\r\f\v]+", " ", value or "").strip()


def parse_number(value):
    cleaned = re.sub(r"[^\d.,]", "", value or "").replace(",", ".")
    try:
        return int(float(cleaned))
    except ValueError:
        return None


def first_number(text, patterns):
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            return parse_number(match.group(1))
    return None


def find_named(text, values):
    compact = re.sub(r"[^a-zа-я0-9]", "", text.lower())
    for value in values:
        readable = value.lower()
        joined = re.sub(r"[^a-zа-я0-9]", "", readable)
        if re.search(rf"(?<![a-z]){re.escape(readable)}(?![a-z])", text, re.I) or joined in compact:
            return value
    return ""


def extract_title(text, district, rooms, message_id):
    noise = re.compile(r"^(?:[#\s\W]+|[\d\s,.]+(?:\$|usd|us\$|sq\.?m|sqm|m²|м²).*)$", re.I)
    for line in text.splitlines():
        candidate = normalize_space(line).strip("📍🏢🏠✨✅✖️💰🕐🐕👬📲 |")
        without_tags = re.sub(r"#[\w-]+", "", candidate)
        without_tags = re.sub(r"[^\wа-я]+", "", without_tags, flags=re.I)
        if len(candidate) >= 4 and without_tags and not noise.match(candidate):
            return candidate
    if district and rooms is not None:
        return f"{district} · {rooms} спален"
    return f"Telegram-объект №{message_id}"


def parse_property(message_id, text):
    text = text or ""
    if not text.strip() or re.search(
        r"\b(?:found\s+(?:a\s+)?tenant|already\s+(?:rented|sold)|сдан[аоы]?|продан[аоы]?)\b",
        text,
        re.I,
    ):
        return None

    price = first_number(text, [
        r"\$[ \t]*(\d[\d \t,.]*)",
        r"(\d[\d \t,.]*)[ \t]*(?:\$|USD|US\$)",
    ])
    area = first_number(text, [
        r"(\d[\d.,]*)\s*(?:sq\.?\s*m|sqm|m²|м²|square\s+meters?)",
    ])
    room_match = re.search(r"#?(\d+)\s*(?:Bed(?:room)?s?|rooms?|комнат(?:а|ы)?)\b", text, re.I)
    rooms = int(room_match.group(1)) if room_match else None
    floor_match = None
    for pattern in [
        r"(\d+)\s*/\s*(\d+)\s*Floor",
        r"Floor\s*(\d+)\s*/\s*(\d+)",
        r"(\d+)\s*этаж\s*из\s*(\d+)",
        r"(?<!\d)(\d+)\s*/\s*(\d+)(?!\d)",
    ]:
        floor_match = re.search(pattern, text, re.I)
        if floor_match:
            break
    floor = f"{floor_match.group(1)}/{floor_match.group(2)}" if floor_match else ""
    district = find_named(text, DISTRICTS)
    metro = find_named(text, METROS)
    title = extract_title(text, district, rooms, message_id)
    word_signal = bool(re.search(
        r"\b(apartment|flat|house|rent|sale|квартир\w*|аренд\w*|продаж\w*)\b",
        text,
        re.I,
    ))
    address_signal = bool(re.search(r"\b(?:st(?:reet)?|ave(?:nue)?|road|ул\.?|проспект)\b", title, re.I))
    signals = [price is not None, area is not None, rooms is not None, bool(floor), bool(district), address_signal, word_signal]
    if sum(signals) < 2:
        return None
    return {
        "id": str(message_id),
        "title": title,
        "price": price,
        "area": area,
        "district": district,
        "metro": metro,
        "rooms": rooms,
        "floor": floor,
    }


def create_state(now, start, end, messages):
    late = now > start + timedelta(minutes=15)
    state_messages = {}
    for message in messages:
        published_at = message["published_at"]
        state_messages[message["id"]] = {
            "baseline_forwards": 0 if published_at >= start else message["current_forwards"],
            "published_at": iso(published_at),
        }
    return {
        "timezone": "Asia/Tbilisi",
        "date": now.date().isoformat(),
        "window_start": iso(start),
        "window_end": iso(end),
        "baseline_created_at": iso(now),
        "baseline_created_late": late,
        "messages": state_messages,
    }


def calculate_ranking(messages, state, start):
    state_messages = state.setdefault("messages", {})
    items = []
    for message in messages:
        message_id = message["id"]
        baseline = state_messages.get(message_id)
        if baseline is None:
            baseline_forwards = 0 if message["published_at"] >= start else message["current_forwards"]
            baseline = {
                "baseline_forwards": baseline_forwards,
                "published_at": iso(message["published_at"]),
            }
            state_messages[message_id] = baseline
        baseline_forwards = max(int(baseline.get("baseline_forwards", 0)), 0)
        current_forwards = max(int(message["current_forwards"]), 0)
        items.append({
            **message["property"],
            "daily_reposts": max(current_forwards - baseline_forwards, 0),
            "current_forwards": current_forwards,
            "baseline_forwards": baseline_forwards,
            "published_at": iso(message["published_at"]),
            "post_url": f"https://t.me/{CHANNEL}/{message_id}",
            "image": f"telegram-images/{message_id}.jpg" if message["has_photo"] else "",
            "_message": message["message"],
        })
    items.sort(key=lambda item: (
        item["daily_reposts"],
        item["current_forwards"],
        item["published_at"],
    ), reverse=True)
    positive = [item for item in items if item["daily_reposts"] > 0]
    selected = positive[:10] if len(positive) >= 10 else items[:10]
    return selected


def calculate_test_ranking(messages):
    items = []
    for message in messages:
        current_forwards = max(int(message["current_forwards"]), 0)
        message_id = message["id"]
        items.append({
            **message["property"],
            "daily_reposts": current_forwards,
            "current_forwards": current_forwards,
            "baseline_forwards": 0,
            "published_at": iso(message["published_at"]),
            "post_url": f"https://t.me/{CHANNEL}/{message_id}",
            "image": f"telegram-images/{message_id}.jpg" if message["has_photo"] else "",
            "_message": message["message"],
        })
    items.sort(key=lambda item: (
        item["daily_reposts"],
        item["current_forwards"],
        item["published_at"],
    ), reverse=True)
    return items[:10]


def public_item(item):
    return {key: value for key, value in item.items() if key != "_message"}


async def collect_messages(client):
    messages = []
    async for message in client.iter_messages(CHANNEL, limit=MESSAGE_LIMIT):
        property_data = parse_property(message.id, message.message or "")
        if property_data is None:
            continue
        published_at = message.date.astimezone(TBILISI_TZ)
        messages.append({
            "id": str(message.id),
            "property": property_data,
            "published_at": published_at,
            "current_forwards": max(int(message.forwards or 0), 0),
            "has_photo": bool(message.photo),
            "message": message,
        })
    return messages


async def sync_images(client, ranking):
    IMAGES_PATH.mkdir(exist_ok=True)
    wanted = {f"{item['id']}.jpg" for item in ranking if item["image"]}
    for old_image in IMAGES_PATH.glob("*.jpg"):
        if old_image.name not in wanted:
            old_image.unlink()
    for item in ranking:
        if not item["image"]:
            continue
        target = IMAGES_PATH / f"{item['id']}.jpg"
        try:
            await client.download_media(item["_message"].photo, file=str(target))
            if not target.exists():
                item["image"] = ""
        except Exception as error:
            item["image"] = ""
            print(f"Не удалось скачать фото публикации {item['id']}: {error}", file=sys.stderr)


def build_payload(now, start, end, status, state, ranking):
    return {
        "channel": CHANNEL,
        "timezone": "Asia/Tbilisi",
        "ranking": "daily_reposts",
        "date": now.date().isoformat(),
        "period_start": iso(start),
        "period_end": iso(end),
        "status": status,
        "baseline_created_late": bool(state.get("baseline_created_late")),
        "updated_at": iso(now),
        "items": [public_item(item) for item in ranking],
    }


def build_test_payload(now, ranking):
    return {
        "channel": CHANNEL,
        "timezone": "Asia/Tbilisi",
        "ranking": "daily_reposts",
        "status": "test",
        "test_mode": True,
        "date": now.date().isoformat(),
        "period_start": None,
        "period_end": None,
        "baseline_created_late": False,
        "updated_at": iso(now),
        "test_generated_at": iso(now),
        "items": [public_item(item) for item in ranking],
    }


def required_environment():
    values = {
        "api_id": os.environ.get("TELEGRAM_API_ID", "").strip(),
        "api_hash": os.environ.get("TELEGRAM_API_HASH", "").strip(),
        "session": os.environ.get("TELEGRAM_SESSION", "").strip(),
    }
    missing = [name.upper() for name, value in values.items() if not value]
    if missing:
        raise RuntimeError("Не настроены переменные: " + ", ".join(f"TELEGRAM_{name}" for name in missing))
    try:
        values["api_id"] = int(values["api_id"])
    except ValueError as error:
        raise RuntimeError("TELEGRAM_API_ID должен быть целым числом") from error
    return values


async def update():
    now = datetime.now(TBILISI_TZ)
    start, end = window_for(now)
    status = period_status(now, start, end)
    previous_output = load_json(OUTPUT_PATH)

    if not TEST_MODE and status == "before_window":
        if previous_output and previous_output.get("status") == "finished":
            print("До 10:00 сохраняется итог предыдущего дня")
            return 0
        save_json(OUTPUT_PATH, {
            "channel": CHANNEL,
            "timezone": "Asia/Tbilisi",
            "ranking": "daily_reposts",
            "date": now.date().isoformat(),
            "period_start": iso(start),
            "period_end": iso(end),
            "status": "before_window",
            "baseline_created_late": False,
            "updated_at": iso(now),
            "items": [],
        })
        return 0

    if not TEST_MODE and status == "finished" and previous_output and previous_output.get("date") == now.date().isoformat() and previous_output.get("status") == "finished":
        print("Итог текущего дня уже зафиксирован")
        return 0

    credentials = required_environment()
    async with TelegramClient(StringSession(credentials["session"]), credentials["api_id"], credentials["api_hash"]) as client:
        messages = await collect_messages(client)
        if not messages:
            raise RuntimeError("Среди последних публикаций не найдено объектов недвижимости")
        if TEST_MODE:
            ranking = calculate_test_ranking(messages)
            await sync_images(client, ranking)
            save_json(OUTPUT_PATH, build_test_payload(now, ranking))
            print(f"Сохранено {len(ranking)} объектов в тестовом режиме; рабочий baseline не изменён")
            return 0
        state = load_json(STATE_PATH)
        if not state or state.get("date") != now.date().isoformat():
            state = create_state(now, start, end, messages)
        ranking = calculate_ranking(messages, state, start)
        await sync_images(client, ranking)
        save_json(STATE_PATH, state)
        save_json(OUTPUT_PATH, build_payload(now, start, end, status, state, ranking))
    print(f"Сохранено {len(ranking)} объектов; status={status}; baseline_created_late={state['baseline_created_late']}")
    return 0


def main():
    try:
        return asyncio.run(update())
    except Exception as error:
        print(f"Ошибка обновления Telegram-рейтинга: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
