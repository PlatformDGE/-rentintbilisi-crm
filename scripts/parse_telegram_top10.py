#!/usr/bin/env python3
"""Build telegram-top10.json from Telegram's public channel preview."""

from urllib.request import Request, urlopen
import html
import re
import json
from datetime import datetime, timezone
from pathlib import Path
import sys

CHANNEL = "rent_tbilisi_ge"
CHANNEL_URL = f"https://t.me/s/{CHANNEL}"
OUTPUT = Path(__file__).resolve().parents[1] / "telegram-top10.json"

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


def normalize_space(value):
    return re.sub(r"[ \t\r\f\v]+", " ", value).strip()


def strip_markup(value):
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    value = html.unescape(value).replace("\xa0", " ")
    return "\n".join(normalize_space(line) for line in value.splitlines() if normalize_space(line))


def class_pattern(class_name):
    return rf"class\s*=\s*(['\"])[^'\"]*\b{re.escape(class_name)}\b[^'\"]*\1"


def extract_class_content(post, class_name):
    match = re.search(rf"<[^>]+{class_pattern(class_name)}[^>]*>(.*?)</(?:div|span)>", post, re.I | re.S)
    return strip_markup(match.group(2)) if match else ""


def parse_views(value):
    match = re.search(r"([\d.,]+)\s*([KM]?)", value.strip(), re.I)
    if not match:
        return 0
    number = match.group(1).replace(",", ".")
    try:
        amount = float(number)
    except ValueError:
        return 0
    return int(amount * {"K": 1_000, "M": 1_000_000}.get(match.group(2).upper(), 1))


def parse_number(value):
    cleaned = re.sub(r"[^\d.,]", "", value).replace(",", ".")
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
        candidate = normalize_space(line).strip("📍🏢🏠✨✅✖️💰👁🕐🐕👬📲 |")
        without_tags = re.sub(r"#[\w-]+", "", candidate)
        without_tags = re.sub(r"[^\wа-я]+", "", without_tags, flags=re.I)
        if len(candidate) >= 4 and without_tags and not noise.match(candidate):
            return candidate
    if district and rooms is not None:
        return f"{district} · {rooms} спален"
    return f"Telegram-объект №{message_id}"


def parse_post(post):
    data_post = re.search(r"data-post\s*=\s*(['\"])([^'\"]+)\1", post, re.I)
    if not data_post:
        return None
    post_ref = data_post.group(2)
    message_id = post_ref.rsplit("/", 1)[-1]
    text = extract_class_content(post, "tgme_widget_message_text")
    if re.search(r"\b(?:found\s+(?:a\s+)?tenant|already\s+(?:rented|sold)|сдан[аоы]?|продан[аоы]?)\b", text, re.I):
        return None
    views = parse_views(extract_class_content(post, "tgme_widget_message_views"))
    time_match = re.search(r"<time\b[^>]*datetime\s*=\s*(['\"])([^'\"]+)\1", post, re.I)
    image_matches = re.findall(r"background-image\s*:\s*url\(\s*(['\"]?)(.*?)\1\s*\)", post, re.I | re.S)
    image = next((url.strip() for _, url in image_matches if "telegram.org/img/emoji" not in url), "")
    if image.startswith("//"):
        image = "https:" + image

    price = first_number(text, [
        r"\$[ \t]*(\d[\d \t,.]*)", r"(\d[\d \t,.]*)[ \t]*(?:\$|USD|US\$)",
    ])
    area = first_number(text, [
        r"(\d[\d.,]*)\s*(?:sq\.?\s*m|sqm|m²|м²|square\s+meters?)",
    ])
    room_match = re.search(r"#?(\d+)\s*(?:Bed(?:room)?s?|rooms?|комнат(?:а|ы)?)\b", text, re.I)
    rooms = int(room_match.group(1)) if room_match else None
    floor_match = None
    for pattern in [
        r"(\d+)\s*/\s*(\d+)\s*Floor", r"Floor\s*(\d+)\s*/\s*(\d+)",
        r"(\d+)\s*этаж\s*из\s*(\d+)", r"(?<!\d)(\d+)\s*/\s*(\d+)(?!\d)",
    ]:
        floor_match = re.search(pattern, text, re.I)
        if floor_match:
            break
    floor = f"{floor_match.group(1)}/{floor_match.group(2)}" if floor_match else ""
    district = find_named(text, DISTRICTS)
    metro = find_named(text, METROS)
    title = extract_title(text, district, rooms, message_id)

    word_signal = bool(re.search(r"\b(apartment|flat|house|rent|sale|квартир\w*|аренд\w*|продаж\w*)\b", text, re.I))
    address_signal = bool(re.search(r"\b(?:st(?:reet)?|ave(?:nue)?|road|ул\.?|проспект)\b", title, re.I))
    signals = [price is not None, area is not None, rooms is not None, bool(floor), bool(district), address_signal, word_signal]
    if sum(signals) < 2:
        return None

    return {
        "id": message_id,
        "title": title,
        "price": price,
        "area": area,
        "district": district,
        "metro": metro,
        "rooms": rooms,
        "floor": floor,
        "views": views,
        "published_at": time_match.group(2) if time_match else "",
        "post_url": f"https://t.me/{CHANNEL}/{message_id}",
        "image": html.unescape(image),
    }


def split_posts(page):
    starts = [m.start() for m in re.finditer(rf"<div\b[^>]*{class_pattern('tgme_widget_message_wrap')}[^>]*>", page, re.I)]
    return [page[start:starts[index + 1] if index + 1 < len(starts) else len(page)] for index, start in enumerate(starts)]


def load_page(before=""):
    url = f"{CHANNEL_URL}?before={before}" if before else CHANNEL_URL
    request = Request(url, headers={
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def existing_payload():
    try:
        return json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def main():
    try:
        posts = []
        before = ""
        for _ in range(8):
            page = load_page(before)
            page_posts = split_posts(page)
            if not page_posts:
                break
            posts.extend(page_posts)
            ids = []
            for post in page_posts:
                match = re.search(r"data-post\s*=\s*(['\"])[^'\"]+/(\d+)\1", post, re.I)
                if match:
                    ids.append(int(match.group(2)))
            if not ids:
                break
            next_before = str(min(ids))
            if next_before == before:
                break
            before = next_before
    except Exception as error:
        print(f"Не удалось загрузить Telegram-канал: {error}", file=sys.stderr)
        return 1
    if not posts:
        print("Telegram вернул пустую или заблокированную страницу без публикаций", file=sys.stderr)
        return 1

    by_id = {}
    for post in posts:
        try:
            item = parse_post(post)
            if item:
                by_id[item["id"]] = item
        except Exception as error:
            print(f"Пропущена повреждённая публикация: {error}", file=sys.stderr)
    items = sorted(by_id.values(), key=lambda item: item["views"], reverse=True)[:10]
    if not items:
        print("На странице не найдено объявлений недвижимости; рабочий JSON сохранён", file=sys.stderr)
        return 1

    old = existing_payload()
    if old and old.get("items") == items:
        print(f"Данные не изменились: {len(items)} публикаций")
        return 0
    payload = {
        "channel": CHANNEL,
        "updated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "items": items,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Сохранено {len(items)} реальных публикаций в {OUTPUT.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
