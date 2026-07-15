"""Persistent lifecycle tracking for Telegram property publications."""

from datetime import datetime
import hashlib
import re


SCHEMA_VERSION = 1


def iso(value):
    return value.replace(microsecond=0).isoformat()


def parse_datetime(value):
    return datetime.fromisoformat(value)


def normalize_text(value):
    return re.sub(r"[^a-zа-я0-9]+", " ", str(value or "").lower(), flags=re.I).strip()


def property_key(item):
    cadastral = normalize_text(item.get("cadastralNumber"))
    if cadastral:
        return f"cadastral:{cadastral.replace(' ', '')}"
    address = normalize_text(item.get("address") or item.get("title"))
    owner_phone = re.sub(r"\D", "", str(item.get("ownerPhone") or ""))
    if address and owner_phone:
        digest = hashlib.sha256(f"{address}|{owner_phone}".encode()).hexdigest()[:24]
        return f"address-owner:{digest}"
    stable_key = normalize_text(item.get("stablePropertyKey"))
    if stable_key:
        return f"stable:{stable_key.replace(' ', '-')}"
    return f"telegram:{item['post_url']}"


def days_inclusive(start, end):
    return max((end.date() - start.date()).days + 1, 1)


def empty_history():
    return {"schemaVersion": SCHEMA_VERSION, "properties": {}}


def normalize_history(history):
    if not isinstance(history, dict):
        return empty_history()
    properties = history.get("properties")
    if not isinstance(properties, dict):
        properties = {}
    return {"schemaVersion": SCHEMA_VERSION, "properties": properties}


def find_entry(properties, key, message_id):
    if key in properties:
        return key, properties[key]
    for existing_key, entry in properties.items():
        if str(entry.get("messageId")) == str(message_id):
            return existing_key, entry
    return key, None


def lifecycle_fields(entry, now):
    first_seen = parse_datetime(entry["firstSeenAt"])
    rented_at = parse_datetime(entry["rentedAt"]) if entry.get("rentedAt") else None
    return {
        "propertyKey": entry["propertyKey"],
        "firstSeenAt": entry["firstSeenAt"],
        "lastSeenAt": entry["lastSeenAt"],
        "daysOnChannel": days_inclusive(first_seen, now),
        "lifecycleStatus": entry["lifecycleStatus"],
        "rentedAt": entry.get("rentedAt"),
        "daysUntilRented": days_inclusive(first_seen, rented_at) if rented_at else None,
    }


def update_lifecycle(items, history, now, confirmed_rentals=None):
    history = normalize_history(history)
    properties = history["properties"]
    confirmed_rentals = confirmed_rentals or {}
    active = []

    for rank, item in enumerate(items, 1):
        key = property_key(item)
        stored_key, entry = find_entry(properties, key, item["id"])
        if entry is None:
            first_seen = item.get("published_at") or iso(now)
            entry = {
                "propertyKey": key,
                "messageId": str(item["id"]),
                "firstSeenAt": first_seen,
                "lastSeenAt": iso(now),
                "rentedAt": None,
                "lifecycleStatus": "active",
                "highestRank": rank,
                "maxRepostCount": int(item.get("repostCount", 0)),
                "snapshot": {},
            }
            properties[key] = entry
            stored_key = key
        entry["messageId"] = str(item["id"])
        entry["lastSeenAt"] = iso(now)
        entry["highestRank"] = min(int(entry.get("highestRank", rank)), rank)
        entry["maxRepostCount"] = max(int(entry.get("maxRepostCount", 0)), int(item.get("repostCount", 0)))
        entry["snapshot"] = {key: value for key, value in item.items() if key != "_message"}

        confirmed_at = confirmed_rentals.get(stored_key) or confirmed_rentals.get(str(item["id"]))
        if confirmed_at and entry.get("lifecycleStatus") != "rented":
            entry["lifecycleStatus"] = "rented"
            entry["rentedAt"] = iso(confirmed_at)

        enriched = {**item, **lifecycle_fields(entry, now)}
        if entry["lifecycleStatus"] == "active":
            active.append(enriched)

    for identifier, confirmed_at in confirmed_rentals.items():
        for entry in properties.values():
            if identifier not in {entry.get("propertyKey"), str(entry.get("messageId"))}:
                continue
            if entry.get("lifecycleStatus") != "rented":
                entry["lifecycleStatus"] = "rented"
                entry["rentedAt"] = iso(confirmed_at)
            active = [item for item in active if item["propertyKey"] != entry["propertyKey"]]
            break

    recently_rented = []
    for entry in properties.values():
        if entry.get("lifecycleStatus") != "rented" or not entry.get("rentedAt"):
            continue
        snapshot = entry.get("snapshot") or {}
        recently_rented.append({**snapshot, **lifecycle_fields(entry, now)})
    recently_rented.sort(key=lambda item: item["rentedAt"], reverse=True)
    return active[:10], recently_rented[:5], history
