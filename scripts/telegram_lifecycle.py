"""Persistent lifecycle tracking and confirmed-deal matching for Telegram properties."""

from datetime import datetime
import re
from urllib.parse import urlparse


SCHEMA_VERSION = 2
TELEGRAM_URL = re.compile(r"^https?://(?:www\.)?t\.me/([A-Za-z0-9_]+)/([0-9]+)(?:[/?#].*)?$", re.I)
CLOSED_STATUSES = {"rented", "sold"}


def iso(value):
    return value.replace(microsecond=0).isoformat()


def parse_datetime(value):
    return datetime.fromisoformat(value)


def normalize_text(value):
    return re.sub(r"[^a-zа-я0-9]+", " ", str(value or "").lower(), flags=re.I).strip()


def normalize_telegram_url(value):
    match = TELEGRAM_URL.match(str(value or "").strip())
    if not match:
        return None
    return f"https://t.me/{match.group(1).lower()}/{int(match.group(2))}"


def telegram_message_id(value):
    normalized = normalize_telegram_url(value)
    return normalized.rsplit("/", 1)[1] if normalized else None


def property_key(item):
    source_url = normalize_telegram_url(item.get("sourceTelegramUrl") or item.get("post_url"))
    if source_url:
        return f"telegram:{source_url}"
    message_id = item.get("sourceTelegramMessageId") or item.get("id")
    return f"telegram-message:{message_id}"


def elapsed_minutes(start, end):
    return max(int((end - start).total_seconds() // 60), 0)


def format_elapsed_minutes(minutes):
    minutes = max(int(minutes), 0)
    if minutes == 0:
        return "Сегодня"
    if minutes < 60:
        return f"{minutes} мин"
    if minutes < 24 * 60:
        return f"{minutes // 60} ч {minutes % 60} мин"
    if minutes < 7 * 24 * 60:
        return f"{minutes // (24 * 60)} д {(minutes % (24 * 60)) // 60} ч"
    return f"{minutes // (24 * 60)} дней"


def days_inclusive(start, end):
    return max((end.date() - start.date()).days + 1, 1)


def empty_history():
    return {"schemaVersion": SCHEMA_VERSION, "properties": {}}


def normalize_history(history):
    if not isinstance(history, dict):
        return empty_history()
    source = history.get("properties")
    properties = source if isinstance(source, dict) else {}
    migrated = {}
    for old_key, entry in properties.items():
        if not isinstance(entry, dict):
            continue
        snapshot = entry.get("snapshot") if isinstance(entry.get("snapshot"), dict) else {}
        source_url = normalize_telegram_url(
            entry.get("sourceTelegramUrl") or snapshot.get("sourceTelegramUrl") or snapshot.get("post_url")
        )
        message_id = str(entry.get("sourceTelegramMessageId") or entry.get("messageId") or snapshot.get("id") or "")
        key = f"telegram:{source_url}" if source_url else f"telegram-message:{message_id or old_key}"
        entry["propertyKey"] = key
        entry["sourceTelegramUrl"] = source_url
        entry["sourceTelegramMessageId"] = message_id or telegram_message_id(source_url)
        entry.setdefault("confirmationTelegramUrl", None)
        migrated[key] = entry
    return {"schemaVersion": SCHEMA_VERSION, "properties": migrated}


def find_entry(properties, key, source_url, message_id):
    if key in properties:
        return key, properties[key]
    for existing_key, entry in properties.items():
        if source_url and entry.get("sourceTelegramUrl") == source_url:
            return existing_key, entry
        if message_id and str(entry.get("sourceTelegramMessageId")) == str(message_id):
            return existing_key, entry
    return key, None


def lifecycle_fields(entry, now):
    first_seen = parse_datetime(entry["firstSeenAt"])
    closed_at_value = entry.get("closedAt") or entry.get("rentedAt") or entry.get("soldAt")
    closed_at = parse_datetime(closed_at_value) if closed_at_value else None
    timer_end = closed_at or now
    status = entry.get("lifecycleStatus", "active")
    elapsed = elapsed_minutes(first_seen, timer_end)
    return {
        "propertyKey": entry["propertyKey"],
        "sourceTelegramUrl": entry.get("sourceTelegramUrl"),
        "sourceTelegramMessageId": entry.get("sourceTelegramMessageId"),
        "confirmationTelegramUrl": entry.get("confirmationTelegramUrl"),
        "firstSeenAt": entry["firstSeenAt"],
        "lastSeenAt": entry["lastSeenAt"],
        "elapsedMinutesOnChannel": elapsed,
        "timerLabel": format_elapsed_minutes(elapsed),
        "daysOnChannel": days_inclusive(first_seen, timer_end),
        "lifecycleStatus": status,
        "closedAt": closed_at_value,
        "rentedAt": closed_at_value if status == "rented" else None,
        "soldAt": closed_at_value if status == "sold" else None,
        "daysUntilRented": days_inclusive(first_seen, closed_at) if closed_at and status == "rented" else None,
        "daysUntilSold": days_inclusive(first_seen, closed_at) if closed_at and status == "sold" else None,
        "daysUntilClosed": days_inclusive(first_seen, closed_at) if closed_at else None,
    }


def normalize_deal_events(events):
    if not events:
        return []
    if isinstance(events, dict):
        return [
            {"sourceTelegramMessageId": key, "status": "rented", "confirmedAt": iso(value)}
            for key, value in events.items()
        ]
    return [event for event in events if isinstance(event, dict)]


def match_deal_event(properties, event):
    source_url = normalize_telegram_url(event.get("sourceTelegramUrl"))
    if source_url:
        return next((entry for entry in properties.values() if entry.get("sourceTelegramUrl") == source_url), None)

    message_id = str(event.get("sourceTelegramMessageId") or "")
    if message_id:
        exact = [entry for entry in properties.values() if str(entry.get("sourceTelegramMessageId")) == message_id]
        if exact:
            return exact[0]

    address = normalize_text(event.get("address"))
    if not address:
        return None
    candidates = [
        entry for entry in properties.values()
        if normalize_text((entry.get("snapshot") or {}).get("address") or (entry.get("snapshot") or {}).get("title")) == address
    ]
    if len(candidates) <= 1:
        return candidates[0] if candidates else None

    for field in ("price", "area", "rooms"):
        value = event.get(field)
        if value is not None:
            narrowed = [entry for entry in candidates if (entry.get("snapshot") or {}).get(field) == value]
            if narrowed:
                candidates = narrowed
    agent = normalize_text(event.get("agent"))
    if agent:
        narrowed = [entry for entry in candidates if normalize_text((entry.get("snapshot") or {}).get("agent")) == agent]
        if narrowed:
            candidates = narrowed
    return candidates[0] if len(candidates) == 1 else None


def update_lifecycle(items, history, now, confirmed_deals=None):
    history = normalize_history(history)
    properties = history["properties"]

    for rank, item in enumerate(items, 1):
        source_url = normalize_telegram_url(item.get("sourceTelegramUrl") or item.get("post_url"))
        message_id = str(item.get("sourceTelegramMessageId") or item.get("id") or telegram_message_id(source_url) or "")
        key = property_key({**item, "sourceTelegramUrl": source_url, "sourceTelegramMessageId": message_id})
        stored_key, entry = find_entry(properties, key, source_url, message_id)
        if entry is None:
            entry = {
                "propertyKey": key,
                "sourceTelegramUrl": source_url,
                "sourceTelegramMessageId": message_id,
                "firstSeenAt": item.get("published_at") or iso(now),
                "lastSeenAt": iso(now),
                "closedAt": None,
                "rentedAt": None,
                "soldAt": None,
                "confirmationTelegramUrl": None,
                "lifecycleStatus": "active",
                "highestRank": rank,
                "maxRepostCount": int(item.get("repostCount", 0)),
                "snapshot": {},
            }
            properties[key] = entry
        elif stored_key != key and source_url:
            properties.pop(stored_key, None)
            properties[key] = entry
        entry["propertyKey"] = key
        entry["sourceTelegramUrl"] = source_url
        entry["sourceTelegramMessageId"] = message_id
        if entry.get("lifecycleStatus") == "active":
            entry["lastSeenAt"] = iso(now)
        entry["highestRank"] = min(int(entry.get("highestRank", rank)), rank)
        entry["maxRepostCount"] = max(int(entry.get("maxRepostCount", 0)), int(item.get("repostCount", 0)))
        entry["snapshot"] = {
            **{field: value for field, value in item.items() if not field.startswith("_")},
            "sourceTelegramUrl": source_url,
            "sourceTelegramMessageId": message_id,
        }

    for event in normalize_deal_events(confirmed_deals):
        status = event.get("status")
        if status not in CLOSED_STATUSES:
            continue
        entry = match_deal_event(properties, event)
        if entry is None or entry.get("lifecycleStatus") in CLOSED_STATUSES:
            continue
        confirmed_at = event.get("confirmedAt")
        if not confirmed_at:
            continue
        closed_at = parse_datetime(confirmed_at) if isinstance(confirmed_at, str) else confirmed_at
        entry["lifecycleStatus"] = status
        entry["closedAt"] = iso(closed_at)
        entry["rentedAt"] = iso(closed_at) if status == "rented" else None
        entry["soldAt"] = iso(closed_at) if status == "sold" else None
        entry["confirmationTelegramUrl"] = normalize_telegram_url(event.get("confirmationTelegramUrl"))

    active = []
    recently_closed = []
    current_keys = {property_key(item) for item in items}
    for entry in properties.values():
        snapshot = entry.get("snapshot") or {}
        enriched = {**snapshot, **lifecycle_fields(entry, now)}
        if entry.get("lifecycleStatus") == "active" and entry["propertyKey"] in current_keys:
            active.append(enriched)
        elif entry.get("lifecycleStatus") in CLOSED_STATUSES and entry.get("closedAt"):
            recently_closed.append(enriched)
    rank_by_id = {str(item.get("id")): rank for rank, item in enumerate(items)}
    active.sort(key=lambda item: rank_by_id.get(str(item.get("id")), 10_000))
    recently_closed.sort(key=lambda item: item["closedAt"], reverse=True)
    return active[:10], recently_closed[:5], history
