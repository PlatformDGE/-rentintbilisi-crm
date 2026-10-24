#!/usr/bin/env python3
"""Build the Homes in Georgia object registry from the Telegram channel exports.

Reads the raw channel exports (site/data/<source>.json), groups every offer
post into objects (one apartment reposted with a new price stays one object)
and gives each object a permanent ID: HIG-0001, HIG-0002, ...

Writes:
  site/data/registry-ids.json  object key -> ID; never loses an entry, so an ID
                               is never reused or changed once assigned
  site/data/registry.json      the registry itself, read by the CRM "Objects"
                               screen and by the Google Sheets sync script
                               (apps-script/registry.gs)

The same ID is attached to the website listings by build_site_listings.py, so
CRM, Google Sheets and the site all talk about the same object.
Pure standard library, like build_site_listings.py.
"""

from datetime import datetime
import json
from pathlib import Path
import re
import sys

from build_site_listings import CLOSED_RE, DATA, FALLBACK_RATES, SOURCES, normalize, parse_dt

IDS_PATH = DATA / "registry-ids.json"
OUT_PATH = DATA / "registry.json"
ID_PREFIX = "HIG-"

SERVICE_RU = {
    "rent": "Аренда", "sale": "Продажа", "new": "Новостройка", "commercial": "Коммерция",
    "daily": "Посуточно", "car-rent": "Авто аренда", "car-sale": "Авто продажа",
}
KIND_RU = {
    "apartment": "Квартира", "house": "Дом", "studio": "Студия", "commercial": "Коммерция",
    "land": "Участок", "car": "Авто", "room": "Комната",
}
STATUS_ACTIVE, STATUS_ARCHIVE = "Свободен", "Архив"
AGENT_TAG_RE = re.compile(r"#([A-Za-zЀ-ӿ][\wЀ-ӿ]*)")


def agent_tag(text):
    """The CRM agent who owns the post signs it with a hashtag after 📲: '+995 … #Shorena'."""
    contact = text.split("📲", 1)[1] if "📲" in text else ""
    tags = AGENT_TAG_RE.findall(contact)
    return tags[-1] if tags else ""


def object_key(item, post_id):
    """Same service + address + rooms + area = same object, whatever the price."""
    address = re.sub(r"[^0-9a-zЀ-ӿႠ-ჿ]+", "", (item.get("title") or "").lower())
    if len(address) < 4:  # no usable address: the post is its own object
        return f"{item['source']}:post:{post_id}"
    if item.get("kind") == "car":
        return f"{item['service']}:{address}:{item.get('year', '')}"
    return f"{item['service']}:{address}:{item.get('rooms', '')}:{item.get('area', '')}"


def load_ids(path=IDS_PATH):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return {"next": int(data.get("next", 1)), "keys": dict(data.get("keys", {}))}
    except (OSError, ValueError):
        return {"next": 1, "keys": {}}


def offers(sources, rates):
    """Every offer post ever published, parsed like the website does but without the age limit."""
    for source, payload in sources.items():
        for raw in payload.get("items", []):
            text = raw.get("source_text") or ""
            published = parse_dt(raw.get("published_at"))
            if not published or CLOSED_RE.search(text):
                continue
            # Parsing "as of" the publication day keeps old offers instead of dropping them as expired.
            item = normalize(raw, source, published, rates)
            if item:
                item["agent_tag"] = agent_tag(text)
                yield str(raw["id"]), published, item


def build(sources, ids, now=None, rates=FALLBACK_RATES):
    now = now or datetime.now().astimezone()
    groups = {}
    for post_id, published, item in offers(sources, rates):
        groups.setdefault(object_key(item, post_id), []).append((published, post_id, item))

    # New IDs go out in order of first publication, so HIG-0001 is the oldest object.
    for key in sorted(groups, key=lambda k: min(p for p, _, _ in groups[k])):
        if key not in ids["keys"]:
            ids["keys"][key] = f"{ID_PREFIX}{ids['next']:04d}"
            ids["next"] += 1

    objects, posts, urls = [], {}, {}
    for key, entries in groups.items():
        entries.sort(key=lambda e: e[0])
        first, last = entries[0][0], entries[-1][0]
        item = entries[-1][2]  # the newest post describes the object as it is now
        oid = ids["keys"][key]
        max_age = SOURCES[item["source"]][1]
        active = (now - last).days <= max_age
        for _, post_id, entry in entries:
            posts[entry["id"]] = oid
            if entry.get("post_url"):
                urls[entry["post_url"]] = oid
        agent = item.get("agent") or {}
        objects.append({
            "id": oid,
            "service": item["service"],
            "service_ru": SERVICE_RU.get(item["service"], item["service"]),
            "kind": item.get("kind", ""),
            "kind_ru": KIND_RU.get(item.get("kind", ""), item.get("kind", "")),
            "district": item.get("district", ""),
            "metro": item.get("metro", ""),
            "address": item.get("title", ""),
            "rooms": item.get("rooms"),
            "area": item.get("area"),
            "floor": "/".join(str(item[k]) for k in ("floor", "floors") if item.get(k)),
            "price": item.get("price"),
            "currency": item.get("currency", ""),
            "price_usd": item.get("price_usd"),
            "status": STATUS_ACTIVE if active else STATUS_ARCHIVE,
            "agent": item.get("agent_tag", ""),
            "agent_contact": " ".join(filter(None, ["@" + agent["telegram"] if agent.get("telegram") else "", agent.get("phone", "")])),
            "exclusive": bool(item.get("exclusive")),
            "post_url": item.get("post_url", ""),
            "photo": (item.get("photos") or [""])[0],
            "posts": len(entries),
            "first_published": first.isoformat(),
            "last_published": last.isoformat(),
            "lat": item.get("lat"),
            "lon": item.get("lon"),
        })
    objects.sort(key=lambda o: o["last_published"], reverse=True)
    counts = {}
    for obj in objects:
        bucket = counts.setdefault(obj["service"], {"total": 0, "active": 0})
        bucket["total"] += 1
        bucket["active"] += obj["status"] == STATUS_ACTIVE
    return {
        "updated_at": max((p.get("updated_at") or "" for p in sources.values()), default=""),
        "counts": counts,
        "objects": [{k: v for k, v in o.items() if v not in (None, "")} for o in objects],
        "posts": posts,
        "urls": urls,  # any post of the object -> ID; the CRM deal form finds the object by its link
    }


def load_sources():
    sources = {}
    for source in SOURCES:
        path = DATA / f"{source}.json"
        if path.exists():
            sources[source] = json.loads(path.read_text(encoding="utf-8"))
    return sources


def main():
    sources = load_sources()
    if not sources:
        print("No raw catalog files found", file=sys.stderr)
        return 1
    rates = FALLBACK_RATES
    try:  # reuse the NBG rates the website feed already fetched
        rates = json.loads((DATA / "listings.json").read_text(encoding="utf-8"))["rates_usd"]
    except (OSError, ValueError, KeyError):
        pass
    ids = load_ids()
    payload = build(sources, ids, rates=rates)
    IDS_PATH.write_text(json.dumps(ids, ensure_ascii=False, indent=0, sort_keys=True) + "\n", encoding="utf-8")
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    total = sum(c["total"] for c in payload["counts"].values())
    active = sum(c["active"] for c in payload["counts"].values())
    print(f"registry: {total} objects, {active} active | {payload['counts']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
