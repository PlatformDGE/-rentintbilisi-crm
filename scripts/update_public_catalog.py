#!/usr/bin/env python3
"""Build public Homes in Georgia catalogs from active Telegram channel posts."""

import asyncio
from datetime import datetime, timedelta
import json
import os
from pathlib import Path
import re
import shutil
import time
from urllib.parse import parse_qs, quote, unquote, urlparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.types import MessageEntityTextUrl, MessageEntityUrl

from update_telegram_top10 import parse_property, required_environment

ROOT = Path(__file__).resolve().parents[1]
TZ = ZoneInfo("Asia/Tbilisi")
MESSAGE_LIMIT = int(os.environ.get("CATALOG_MESSAGE_LIMIT", "0"))
# Every Homes in Georgia channel feeds one website catalogue (site/data/<kind>.json).
# sale_in_tbilisi stays as an extra resale source next to homesingeorgia.
CHANNELS = {
    "rent": "rent_tbilisi_ge",
    "sale": "sale_in_tbilisi",
    "homes": "homesingeorgia",
    "commercial": "commercialingeorgia",
    "daily": "dayrentingeorgia",
    "new": "DevelopmentIngeorgia",
    "car-rent": "CarsRentInGeorgia",
    "car-sale": "CarsSaleInGeorgia",
}
# Car posts carry a pick-up address ("#Jeep Compass 🚙 #SUV📍 7 Solomon St")
# instead of a listing title, so they are geocoded by that address.
CAR_KINDS = {"car-rent", "car-sale"}


def pickup_address(text):
    first = (text or "").split("\n", 1)[0]
    return re.sub(r"[^\w\s.,/-]", "", first.split("📍", 1)[1]).strip() if "📍" in first else ""


def valid_georgia_point(lat, lon):
    """Objects can be anywhere in Georgia: this only rejects broken coordinates such as @0,0."""
    try:
        lat, lon = float(lat), float(lon)
    except (TypeError, ValueError):
        return False
    return 41.0 <= lat <= 43.7 and 39.9 <= lon <= 46.8


def valid_tbilisi_point(lat, lon):
    """Accept only coordinates within 60 km of central Tbilisi."""
    try:
        lat, lon = float(lat), float(lon)
    except (TypeError, ValueError):
        return False
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return False
    from math import atan2, cos, pi, sin, sqrt
    d_lat = (lat - 41.7151) * pi / 180
    d_lon = (lon - 44.8271) * pi / 180
    a = sin(d_lat / 2) ** 2 + cos(41.7151 * pi / 180) * cos(lat * pi / 180) * sin(d_lon / 2) ** 2
    return 6371 * 2 * atan2(sqrt(a), sqrt(1 - a)) <= 60


def iso(value):
    return value.astimezone(TZ).replace(microsecond=0).isoformat()


MAP_LINK = re.compile(r"google\.[^/\s]+/maps|maps\.google\.|goo\.gl/maps|maps\.app\.goo\.gl", re.I)


def post_map_url(message):
    """The Google Maps link of a post. Most are hidden behind the address text, so plain text is not enough."""
    links = []
    for entity, text in message.get_entities_text():
        if isinstance(entity, MessageEntityTextUrl):
            links.append(entity.url)
        elif isinstance(entity, MessageEntityUrl):
            links.append(text)
    for row in getattr(message.reply_markup, "rows", None) or []:
        links += [button.url for button in row.buttons if getattr(button, "url", None)]
    return next((link.strip() for link in links if MAP_LINK.search(link)), "")


def link_point(text):
    """Coordinates from a maps URL or page. The marker (!3d!4d) beats the view centre (@)."""
    raw = unquote(text or "")
    for pattern in (r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)", r"[?&](?:q|query|ll|destination|daddr)=(-?\d+\.\d+),\s*(-?\d+\.\d+)", r"@(-?\d+\.\d+),\s*(-?\d+\.\d+)", r"center=(-?\d+\.\d+),\s*(-?\d+\.\d+)"):
        found = re.search(pattern, raw)
        if found and valid_georgia_point(found.group(1), found.group(2)):
            return float(found.group(1)), float(found.group(2))
    return None


def link_address(url):
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    for key in ("query", "q", "destination", "daddr"):
        value = unquote((query.get(key) or [""])[0]).replace("+", " ").strip()
        if value and not re.fullmatch(r"-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?", value):
            return value
    place = re.search(r"/maps/place/([^/]+)", parsed.path)
    return unquote(place.group(1)).replace("+", " ").strip() if place else ""


def map_details(url):
    if not url:
        return {"lat": None, "lon": None, "location": ""}
    final, page = url, ""
    point = link_point(url)
    if not point:
        # Short links open a page that names the place; some of them only give the address.
        try:
            request = Request(url, headers={"User-Agent": "Mozilla/5.0 HomesInGeorgiaCatalog/1.0", "Cookie": "CONSENT=YES+"})
            with urlopen(request, timeout=8) as response:
                final = response.geturl()
                page = response.read(400000).decode("utf-8", "ignore")
        except Exception as error:
            print(f"map link {url}: {error}")
        point = link_point(final) or link_point(page)
    location = link_address(final) or link_address(url)
    if point:
        return {"lat": point[0], "lon": point[1], "location": location}
    return {"lat": None, "lon": None, "location": location}


def geocode_address(address, district="", anywhere=False):
    """An address lookup. "approx" marks anything less precise than the building itself.

    Post text is assumed to mean Tbilisi. An address taken from a map link stands on its own (anywhere=True).
    """
    query = ", ".join(value for value in (address, district, "Georgia" if anywhere else "Tbilisi, Georgia") if value)
    allowed = valid_georgia_point if anywhere else valid_tbilisi_point
    if not query:
        return {"lat": None, "lon": None, "location": "", "approx": True}
    rough = None
    try:
        request = Request("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ge&q=" + quote(query), headers={"User-Agent": "HomesInGeorgiaCatalog/1.0"})
        with urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if payload:
            item = payload[0]
            lat, lon = float(item["lat"]), float(item["lon"])
            if allowed(lat, lon):
                found = {"lat": lat, "lon": lon, "location": item.get("display_name", "")}
                if int(item.get("place_rank") or 0) >= 30:
                    return {**found, "approx": False}
                rough = {**found, "approx": True}
    except Exception as error:
        print(f"geocode {query}: {error}")
    try:
        fallback = Request("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&maxLocations=1&outFields=Addr_type&SingleLine=" + quote(query), headers={"User-Agent": "HomesInGeorgiaCatalog/1.0"})
        with urlopen(fallback, timeout=12) as response:
            candidates = json.loads(response.read().decode("utf-8")).get("candidates", [])
        if candidates and float(candidates[0].get("score", 0)) >= 70:
            item = candidates[0]
            lat, lon = float(item["location"]["y"]), float(item["location"]["x"])
            if allowed(lat, lon):
                exact = (item.get("attributes") or {}).get("Addr_type") in ("PointAddress", "Subaddress")
                if exact or rough is None:
                    return {"lat": lat, "lon": lon, "location": item.get("address", query), "approx": not exact}
    except Exception as error:
        print(f"geocode ArcGIS {query}: {error}")
    return rough or {"lat": None, "lon": None, "location": "", "approx": True}


def load_text(message):
    return (message.message or "").strip()


async def collect_channel(client, channel, kind):
    previous = {}
    previous_path = ROOT / "site" / "data" / f"{kind}.json"
    try:
        payload = json.loads(previous_path.read_text(encoding="utf-8"))
        previous = {str(item.get("id")): item for item in payload.get("items", [])}
    except (OSError, json.JSONDecodeError, AttributeError):
        pass
    groups = {}
    async for message in client.iter_messages(channel, limit=(MESSAGE_LIMIT or None)):
        groups.setdefault(str(message.grouped_id or message.id), []).append(message)
    rows = []
    for group in groups.values():
        group.sort(key=lambda item: (item.date, item.id))
        text_message = next((item for item in group if load_text(item)), group[0])
        text = load_text(text_message)
        property_data = parse_property(text_message.id, text)
        if property_data is None:
            continue
        photos = [item for item in group if item.photo][:9]
        source_map_url = post_map_url(text_message)
        cached = previous.get(str(text_message.id), {})
        cached_point = valid_georgia_point(cached.get("lat"), cached.get("lon"))
        cached_location = {"lat": cached.get("lat"), "lon": cached.get("lon"), "location": cached.get("location", ""), "approx": bool(cached.get("approx"))}
        direct_point = link_point(source_map_url)
        if direct_point:
            # The link itself holds the coordinates: always trust it, no network needed.
            location = {"lat": direct_point[0], "lon": direct_point[1], "location": link_address(source_map_url), "approx": False}
        elif source_map_url and cached_point and cached.get("map_url") == source_map_url and not cached.get("approx"):
            # This short link was already read; only an unchanged link may reuse its point.
            location = cached_location
        elif source_map_url:
            location = map_details(source_map_url)
            if location["lat"] is None:
                link_place = location["location"]
                found = geocode_address(link_place or property_data.get("title", ""), "" if link_place else property_data.get("district", ""), anywhere=bool(link_place))
                time.sleep(1.05)
                location = found if found["lat"] is not None else {**cached_location, "approx": True}
            else:
                location["approx"] = False
        elif cached_point:
            location = cached_location
        else:
            if kind in CAR_KINDS:
                address = pickup_address(text)
                location = geocode_address(address) if address else {"lat": None, "lon": None, "location": "", "approx": True}
            else:
                location = geocode_address(property_data.get("title", ""), property_data.get("district", ""))
            time.sleep(1.05)
        rows.append({**property_data, "type": kind, "channel": channel, "post_url": f"https://t.me/{channel}/{text_message.id}", "published_at": iso(group[0].date), "map_url": source_map_url, "location": location["location"], "lat": location["lat"], "lon": location["lon"], "approx": bool(location.get("approx")), "_messages": photos})
    rows.sort(key=lambda item: item["published_at"], reverse=True)
    return rows


async def download_photos(client, rows, kind):
    target_dir = ROOT / "site" / "media" / kind
    target_dir.mkdir(parents=True, exist_ok=True)
    wanted = set()
    semaphore = asyncio.Semaphore(8)
    async def download_one(row, index, message):
        filename = f"{row['id']}-{index}.jpg"
        target = target_dir / filename
        if target.exists() and target.stat().st_size > 0:
            return filename
        async with semaphore:
            try:
                await client.download_media(message, file=str(target))
                return filename if target.exists() else ""
            except Exception as error:
                print(f"photo {row['id']}#{index}: {error}")
                return ""
    for row in rows:
        filenames = await asyncio.gather(*(download_one(row, index, message) for index, message in enumerate(row.pop("_messages", []), start=1)))
        photos = []
        for filename in filenames:
            if filename:
                wanted.add(filename); photos.append(f"media/{kind}/{filename}")
        row["photos"] = photos; row["image"] = photos[0] if photos else ""
    for old in target_dir.iterdir():
        if old.is_file() and old.name not in wanted:
            old.unlink()


def save_catalog(kind, channel, rows, updated_at):
    path = ROOT / "site" / "data" / f"{kind}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"kind": kind, "channel": channel, "source": "active_channel", "updated_at": updated_at, "items": rows}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def main():
    credentials = required_environment()
    client = TelegramClient(StringSession(credentials["session"]), credentials["api_id"], credentials["api_hash"], receive_updates=False, catch_up=False)
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect(); raise RuntimeError("TELEGRAM_SESSION не авторизована")
    try:
        now = datetime.now(TZ); completed = 0
        for kind, channel in CHANNELS.items():
            try:
                rows = await collect_channel(client, channel, kind)
                await download_photos(client, rows, kind)
                save_catalog(kind, channel, rows, iso(now)); completed += 1
                print(f"{kind}: {len(rows)} active objects")
            except Exception as error:
                print(f"{kind}: skipped after channel error: {error}")
        if not completed:
            raise RuntimeError("Не удалось обновить ни один Telegram-канал")
    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
