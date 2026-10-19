#!/usr/bin/env python3
"""Build the clean public listings feed for the Homes in Georgia website.

Reads the raw channel exports written by update_public_catalog.py
(site/data/rent.json, site/data/sale.json) and writes site/data/listings.json:
only live offers, with price, rooms, area, amenities and terms parsed from the
post text and every object assigned to a website service (rent / sale).

Pure standard library, so it runs in any workflow step without extra installs.
"""

from datetime import datetime, timedelta
import json
from pathlib import Path
import re
import sys
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "site" / "data"

# Official National Bank of Georgia rates (GEL per unit of currency).
# Used for the shared price filter, sorting and the visitor's display currency;
# the listing page always shows the original price from the post as well.
NBG_URL = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?currencies=USD&currencies=EUR"
FALLBACK_RATES = {"USD": 1.0, "GEL": round(1 / 2.7, 6), "EUR": 1.08}

# Long-term rentals are rented out quickly and the channel rarely links the
# "rented" post back to the offer, so old offers are treated as expired.
MAX_AGE_DAYS = {"rent": 75, "sale": 540}

CLOSED_RE = re.compile(
    r"#(?:Flat)?Rented\b|#Sold\b|#DepositPaid\b|found a tenant|has received a deposit|"
    r"\bwas sold\b|\bsold out\b|\bсдан[аоы]?\b|\bпродан[аоы]?\b",
    re.I,
)

AMENITIES = {
    "conditioner": r"conditioner|air ?condition",
    "wifi": r"wi-?fi|internet",
    "tv": r"smart ?tv|\btv\b",
    "stove": r"stove",
    "oven": r"oven",
    "microwave": r"microwave",
    "dishwasher": r"dishwasher",
    "washer": r"washing ?machine|washer",
    "vacuum": r"vacuum",
    "balcony": r"balcon",
    "terrace": r"terrace",
    "courtyard": r"courtyard|private area",
    "elevator": r"elevator|lift",
    "parking": r"parking",
    "pool": r"pool",
    "gym": r"\bgym\b",
    "fireplace": r"fireplace",
    "view": r"\bview\b",
    "storage": r"storage",
    "generator": r"generator",
    "playground": r"playground",
    "security": r"security|concierge",
}

HEATING = {"central": r"#?centralheating", "gas": r"#?gasheating", "electric": r"#?electricalheating|#?electricheating"}

CONDITIONS = [
    ("under_construction", r"#?underconstruction|scheduled completion|under construction"),
    ("black_frame", r"#?blackframe|black frame"),
    ("white_frame", r"#?whiteframe|white frame"),
    ("green_frame", r"#?greenframe|green frame"),
    ("renovated", r"#?fullyrenovated|#new\b|newly renovated|#newrenovation"),
    ("mixed", r"#mixed\b"),
    ("old", r"#old\b"),
]

BUILDINGS = [("historical", r"#?historicalbuilding"), ("new", r"#?newbuilding|new building"), ("old", r"#?oldbuilding|old building")]


def number(raw):
    """Parse '129.000', '1,500', '1 200' and '2.5' style numbers."""
    raw = (raw or "").strip().replace(" ", " ").replace(" ", "")
    if not raw:
        return None
    if re.fullmatch(r"\d{1,3}([.,]\d{3})+", raw):
        return float(re.sub(r"[.,]", "", raw))
    try:
        return float(raw.replace(",", "."))
    except ValueError:
        return None


CURRENCY = r"(\$|usd|gel|lari|₾|ლარი|€|eur|euro)"
AMOUNT = r"(\d[\d ., ]*\d|\d)"


def currency_code(token):
    token = token.lower()
    if token in ("$", "usd"):
        return "USD"
    if token in ("€", "eur", "euro"):
        return "EUR"
    return "GEL"


def parse_money(segment):
    """Return (amount, currency) from text such as '💰 1500$', '$1,500', '1100 Gel'."""
    for pattern, order in ((AMOUNT + r"\s*" + CURRENCY, (0, 1)), (CURRENCY + r"\s*" + AMOUNT, (1, 0))):
        match = re.search(pattern, segment, re.I)
        if match:
            value = number(match.group(order[0] + 1))
            if value:
                return value, currency_code(match.group(order[1] + 1))
    return None, None


PER_SQM_RE = re.compile(r"per\s*(?:1\s*)?sq|/\s*m\b|/\s*m²|за\s*м", re.I)


def parse_price_per_sqm(text, rates):
    for line in text.splitlines():
        if PER_SQM_RE.search(line):
            amount, currency = parse_money(line)
            if amount:
                return round(amount * rates.get(currency, 1))
    return None


def parse_price(text, service):
    lines = [line for line in text.splitlines() if "💰" in line or re.search(r"\bprice\b", line, re.I)]
    for line in lines:
        if PER_SQM_RE.search(line):
            continue
        main = re.split(r"\+|deposit|депозит", line, maxsplit=1, flags=re.I)[0]
        amount, currency = parse_money(main)
        if amount is None:
            match = re.search(r"💰\s*(?:up from\s*)?" + AMOUNT, main, re.I)
            amount, currency = (number(match.group(1)), "USD") if match else (None, None)
        if amount:
            deposit = None
            dep = re.search(r"deposit\s*" + AMOUNT + r"\s*" + CURRENCY + r"?|" + AMOUNT + r"\s*" + CURRENCY + r"?\s*deposit", line, re.I)
            if dep:
                deposit = number(dep.group(1) or dep.group(3))
            # Sale posts sometimes abbreviate thousands: '💰129$' means 129 000.
            if service == "sale" and amount < 5000:
                amount *= 1000
            return amount, currency or "USD", deposit
    return None, None, None


def first_int(pattern, text):
    match = re.search(pattern, text, re.I)
    return int(match.group(1)) if match else None


def parse_rooms(text):
    if re.search(r"#studio\b|\bstudio\b", text, re.I):
        return 0
    rooms = first_int(r"#?(\d{1,2})\s*-?\s*bed(?:room)?s?\b", text)
    return rooms if rooms is not None and rooms <= 12 else None


def parse_area(text):
    match = re.search(r"(\d[\d.,]*)\s*(?:sq\.?\s*m|sqm|m²|м²|m2\b|кв\.?\s*м)", text, re.I)
    value = number(match.group(1)) if match else None
    return value if value and 8 <= value <= 20000 else None


def parse_floor(text):
    match = re.search(r"(\d{1,2})\s*/\s*(\d{1,2})\s*floor", text, re.I) or re.search(r"floor\s*(\d{1,2})\s*/\s*(\d{1,2})", text, re.I)
    if match:
        return int(match.group(1)), int(match.group(2))
    match = re.search(r"\|\s*(\d{1,2})\s*floor", text, re.I)
    return (int(match.group(1)), None) if match else (None, None)


def detect(options, text):
    for key, pattern in options:
        if re.search(pattern, text, re.I):
            return key
    return ""


def listed_features(text):
    """Only ✅/☑ lines count: '✖️ Oven' means the apartment does NOT have it."""
    positive = " ".join(
        part
        for line in text.splitlines()
        for part in re.split(r"✖️|✖|❌", line)[:1]
        if re.search(r"[✅☑✔]", line) or "#" in part
    )
    return [key for key, pattern in AMENITIES.items() if re.search(pattern, positive, re.I)]


def property_kind(text, raw_kind):
    if re.search(r"#commercial|commercial space|\boffice\b|\bhotel\b", text, re.I):
        return "commercial"
    if re.search(r"#house|#home\b|\bcottage\b|\bvilla\b|own house", text, re.I):
        return "house"
    if re.search(r"#land\b|\bland plot\b", text, re.I):
        return "land"
    return raw_kind if raw_kind in ("apartment", "house", "commercial") else "apartment"


EMOJI_RE = re.compile("[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u200D]")


def short_sentence(text, limit=90):
    text = re.sub(r"\s+", " ", text).strip()
    text = re.split(r"(?<=[.!?])\s", text, maxsplit=1)[0].rstrip(".")
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(",;:-–") + "…"


def headline(text):
    """The marketing line such as '⭐️ Duplex 3bed apartment near Vake Park ⭐️'."""
    for line in text.splitlines():
        if re.search(r"^[\s⭐️✨🌟🔥]*[⭐🌟]", line) or re.search(r"^\s*✨[^#|]+✨\s*$", line):
            clean = EMOJI_RE.sub("", line).strip(" -|")
            if len(clean) > 6 and "#" not in clean:
                return short_sentence(clean)
    return ""


NOISE_RE = re.compile(
    r"APARTMENTS ON MAP|commission|(?:RENT|SALE) IN TBILISI|check all listings|instagram|youtube|\bFB\b|"
    r"sq\.?\s*m|\bfloor\b|^[✅☑✖️❌📍🏠🏢✨⭐️🌟🕐🐕👬📲📱\s|]+$",
    re.I,
)


def description(text, skip=""):
    """Free-form lines of the post without hashtags, contacts and service lines."""
    keep = []
    for line in text.splitlines():
        clean = line.strip()
        if not clean or "#" in clean or "@" in clean or "+995" in clean or "💰" in clean:
            continue
        if NOISE_RE.search(clean):
            continue
        if clean.startswith(("📍", "🚇")):
            continue
        clean = re.sub(r"^[✅☑✔•\-\s]+", "", clean)
        clean = re.sub(r"[⭐️✨🌟🔥]", "", clean).strip()
        clean = re.sub(r"[\U0001F1E6-\U0001F1FF]", "", clean).strip()
        if len(clean) > 3 and clean != skip:
            keep.append(clean)
    return "\n".join(keep)[:900]


def terms(text):
    months = sorted({int(m) for m in re.findall(r"#(\d{1,2})\s*Month", text, re.I)})
    pets = ""
    match = re.search(r"pets?\s*:?\s*#?(\w+)", text, re.I)
    if match:
        word = match.group(1).lower()
        pets = "allowed" if word.startswith("allow") or word == "yes" else "agreement" if "agree" in word else "no" if word.startswith(("not", "no")) else ""
    tenants = first_int(r"tenants?\s*:?\s*\d+\s*-\s*(\d+)", text) or first_int(r"tenants?\s*:?\s*(\d+)", text)
    return months, pets, tenants


def agent(text):
    tg = re.search(r"@([A-Za-z][A-Za-z0-9_]{4,31})", text)
    phone = re.search(r"\+995[\s\d]{9,14}", text)
    return {
        "telegram": tg.group(1) if tg else "",
        "phone": re.sub(r"\s+", " ", phone.group(0)).strip() if phone else "",
    }


def completion(text):
    match = re.search(r"(?:completion|deadline|сдача)[^\n]*?((?:19|20)\d{2})", text, re.I | re.S)
    years = re.findall(r"\b(20[2-4]\d)\b", text) if re.search(r"completion", text, re.I) else []
    if years:
        return max(years)
    return match.group(1) if match else ""


def parse_nbg(payload):
    """NBG answer -> value of one unit in USD: {"USD": 1, "GEL": 0.37, "EUR": 1.08}."""
    day = payload[0] if isinstance(payload, list) else payload
    currencies = day.get("currencies") if isinstance(day, dict) and "currencies" in day else payload
    gel_per = {c["code"]: float(c["rate"]) / float(c.get("quantity") or 1) for c in currencies}
    usd = gel_per["USD"]
    date = day.get("date") if isinstance(day, dict) and "currencies" in day else currencies[0].get("date", "")
    return {"USD": 1.0, "GEL": round(1 / usd, 6), "EUR": round(gel_per["EUR"] / usd, 6)}, str(date or "")[:10]


def fetch_nbg_rates(previous=None):
    try:
        request = Request(NBG_URL, headers={"User-Agent": "HomesInGeorgiaSite/1.0", "Accept": "application/json"})
        with urlopen(request, timeout=15) as response:
            rates, date = parse_nbg(json.load(response))
        return {"rates": rates, "date": date, "source": "NBG"}
    except Exception as error:  # network or format problem: keep the last known rates
        print(f"NBG rates unavailable ({error}); using previous rates", file=sys.stderr)
        return previous or {"rates": FALLBACK_RATES, "date": "", "source": "fallback"}


def parse_dt(value):
    try:
        return datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def normalize(raw, source, now, rates=FALLBACK_RATES):
    text = (raw.get("source_text") or "").replace("\r", "")
    if not text.strip() or CLOSED_RE.search(text):
        return None
    published = parse_dt(raw.get("published_at"))
    if published and now - published > timedelta(days=MAX_AGE_DAYS[source]):
        return None
    # Service must be an actual offer, not a digest or announcement.
    if source == "rent" and not re.search(r"for\s*#?rent|#rent\b", text, re.I):
        return None
    if source == "sale" and not re.search(r"for\s*#?sale|#sale\b|apartments? for", text, re.I):
        return None
    if len(re.findall(r"💰", text)) > 3:  # multi-object digest posts
        return None

    price, currency, deposit = parse_price(text, source)
    photos = [p for p in (raw.get("photos") or ([raw["image"]] if raw.get("image") else [])) if p]
    if not price and not photos:
        return None

    condition = detect(CONDITIONS, text)
    # New developments will become a separate service with its own source;
    # until then every sale post is shown as resale.
    service = source

    rooms = parse_rooms(text)
    area = parse_area(text)
    floor, floors = parse_floor(text)
    months, pets, tenants = terms(text)
    price_usd = round(price * rates.get(currency, 1)) if price else None
    lat, lon = raw.get("lat"), raw.get("lon")
    item = {
        "id": f"{source}-{raw['id']}",
        "service": service,
        "kind": property_kind(text, raw.get("property_type")),
        "title": (raw.get("title") or "").strip() or "Tbilisi",
        "headline": headline(text),
        "district": raw.get("district") or "",
        "metro": raw.get("metro") or "",
        "lat": round(float(lat), 6) if lat is not None else None,
        "lon": round(float(lon), 6) if lon is not None else None,
        "price": price,
        "currency": currency,
        "price_usd": price_usd,
        "deposit": deposit,
        "ppsqm_usd": (round(price_usd / area) if price_usd and area else parse_price_per_sqm(text, rates)) if service != "rent" else None,
        "rooms": rooms,
        "area": area,
        "floor": floor,
        "floors": floors,
        "building": detect(BUILDINGS, text),
        "condition": condition,
        "heating": detect(list(HEATING.items()), text),
        "amenities": listed_features(text),
        "pets": pets,
        "months": months,
        "tenants": tenants,
        "exclusive": bool(re.search(r"#exclusive", text, re.I)),
        "no_commission": bool(re.search(r"0\s*%\s*commission", text, re.I)),
        "completion": completion(text) if condition in ("under_construction", "white_frame", "black_frame", "green_frame") else "",
        "description": description(text, headline(text)),
        "agent": agent(text),
        "photos": photos[:12],
        "post_url": raw.get("post_url") or "",
        "published_at": raw.get("published_at") or "",
    }
    return {key: value for key, value in item.items() if value not in (None, "", [], False)}


def dedupe(items):
    """Channels repost updates of the same object; keep the newest per address+price."""
    seen, result = set(), []
    for item in sorted(items, key=lambda x: x.get("published_at", ""), reverse=True):
        key = (item["service"], item["title"].lower(), item.get("price"), item.get("area"))
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def build(sources, now=None, fx=None):
    now = now or datetime.now().astimezone()
    fx = fx or {"rates": FALLBACK_RATES, "date": "", "source": "fallback"}
    items = []
    for source, payload in sources.items():
        for raw in payload.get("items", []):
            item = normalize(raw, source, now, fx["rates"])
            if item:
                items.append(item)
    items = dedupe(items)
    counts = {}
    for item in items:
        counts[item["service"]] = counts.get(item["service"], 0) + 1
    return {
        "updated_at": max((p.get("updated_at") or "" for p in sources.values()), default=""),
        "rates_usd": fx["rates"],
        "rates_date": fx["date"],
        "rates_source": fx["source"],
        "counts": counts,
        "items": items,
    }


def main():
    sources = {}
    for source in ("rent", "sale"):
        path = DATA / f"{source}.json"
        if path.exists():
            sources[source] = json.loads(path.read_text(encoding="utf-8"))
    if not sources:
        print("No raw catalog files found", file=sys.stderr)
        return 1
    out = DATA / "listings.json"
    previous = None
    if out.exists():
        try:
            old = json.loads(out.read_text(encoding="utf-8"))
            if old.get("rates_source") == "NBG":
                previous = {"rates": old["rates_usd"], "date": old.get("rates_date", ""), "source": "NBG"}
        except (ValueError, KeyError):
            pass
    fx = fetch_nbg_rates(previous)
    payload = build(sources, fx=fx)
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("listings:", payload["counts"], "| rates:", fx["source"], fx["date"], fx["rates"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
