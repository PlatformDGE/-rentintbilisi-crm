#!/usr/bin/env python3
# Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
"""Build the clean public listings feed for the Homes in Georgia website.

Reads the raw channel exports written by update_public_catalog.py
(site/data/rent.json, site/data/sale.json) and writes site/data/listings.json:
only live offers, with price, rooms, area, amenities and terms parsed from the
post text and every object assigned to a website service. Each Telegram channel
is one source (see SOURCES); a service with no live offers stays "coming soon".

Pure standard library, so it runs in any workflow step without extra installs.
"""

from datetime import datetime, timedelta
import html
import json
from pathlib import Path
import re
import sys
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "site" / "data"
SHARE = ROOT / "site" / "share"
# Public address of the website; share pages need absolute URLs for link previews.
SITE_URL = "https://platformdge.github.io/-rentintbilisi-crm/site/"

# Official National Bank of Georgia rates (GEL per unit of currency).
# Used for the shared price filter, sorting and the visitor's display currency;
# the listing page always shows the original price from the post as well.
NBG_URL = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?currencies=USD&currencies=EUR"
FALLBACK_RATES = {"USD": 1.0, "GEL": round(1 / 2.7, 6), "EUR": 1.08}

# Long-term rentals are rented out quickly and the channel rarely links the
# "rented" post back to the offer, so old offers are treated as expired.
# source file (site/data/<source>.json) -> website service and how long an offer
# stays live. Long-term rentals go fast and the channel rarely links the
# "rented" post back to the offer, so old offers are treated as expired.
SOURCES = {
    "rent": ("rent", 75),
    "sale": ("sale", 540),
    "homes": ("sale", 540),
    "commercial": ("commercial", 365),
    "daily": ("daily", 365),
    "new": ("new", 720),
    "car-rent": ("car-rent", 365),
    "car-sale": ("car-sale", 180),
}
CAR_SERVICES = {"car-rent", "car-sale"}
# Sale posts sometimes abbreviate thousands: '💰129$' means 129 000.
THOUSANDS_SERVICES = {"sale", "new"}

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
            if service in THOUSANDS_SERVICES and amount < 5000:
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


KIND_TAGS = [("apartment", r"#apartments?\b|#studio\b|#flat\b"), ("house", r"#house\b|#home\b"),
             ("commercial", r"#commercial\b|#office\b"), ("land", r"#land\b")]


def property_kind(text, raw_kind):
    """The post's own hashtag decides (#Apartment / #House / #Commercial / #Land).
    The first one wins, so "#2Bed #Apartment for #Rent" stays an apartment even if
    the complex is called "Villa Residence". Words are only a fallback for posts
    without any of these hashtags."""
    found = [(m.start(), kind) for kind, pattern in KIND_TAGS for m in [re.search(pattern, text, re.I)] if m]
    if found:
        return min(found)[1]
    if re.search(r"commercial space|\boffice\b|\bhotel\b", text, re.I):
        return "commercial"
    if re.search(r"\bcottage\b|own house|private house", text, re.I):
        return "house"
    if re.search(r"\bland plot\b", text, re.I):
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
    r"\btenants?\s*:|\bpets?\s*:|calendar checking|airbnb link|booking link|reviews\s*\||map listings|"
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


def deal_of(text, service):
    if service in ("sale", "new", "car-sale"):
        return "sale"
    if service == "commercial":
        return "sale" if re.search(r"for\s*#?sale|#sale\b|продаж", text, re.I) else "rent"
    return "rent"


def period_of(text, service, deal):
    if deal == "sale":
        return ""
    if service == "daily":
        return "night"
    if service == "car-rent":
        return "hour" if re.search(r"/\s*h(?:ou)?r\b|per\s*hour|hourly|в\s*час|/\s*час", text, re.I) else "day"
    return "month"


CAR_BODIES = {
    "suv": r"suv|crossover|кроссовер|внедорожник", "sedan": r"sedan|седан", "hatchback": r"hatchback|хэтчбек",
    "minivan": r"minivan|минивэн", "wagon": r"wagon|универсал", "coupe": r"coupe|купе",
    "pickup": r"pick-?up truck|pickup\b|пикап", "business": r"business\s*class|businessclass|bussunesclass",
}


def car_details(text, service):
    year = re.search(r"\b(19[89]\d|20[0-3]\d)\b", text)
    # "8 L / 100 km" is fuel use, not mileage; rental cars carry no mileage.
    mileage = re.search(r"(?<![/\d])(\d[\d ,.]*)\s*(?:km|км)\b(?!\s*/)", re.sub(r"/\s*100\s*km", "", text), re.I) if service == "car-sale" else None
    head = text.split("\n", 1)[0].split("📍", 1)[0]
    body = next((name for name, pattern in CAR_BODIES.items() if re.search(pattern, head, re.I)), "")
    seats = re.search(r"(\d{1,2})\s*(?:seats|мест)", text, re.I)
    gearbox = "auto" if re.search(r"automatic|#auto\b|автомат|tiptronic|robot", text, re.I) else "manual" if re.search(r"manual|механ", text, re.I) else ""
    fuel = next((name for name, pattern in (("hybrid", r"hybrid|гибрид"), ("electric", r"electric|электро|\bEV\b"), ("diesel", r"diesel|дизель"),
                                              ("gas", r"\bgas\b|\blpg\b|газ"), ("petrol", r"petrol|gasoline|бензин")) if re.search(pattern, text, re.I)), "")
    return {
        "year": int(year.group(1)) if year else None,
        "mileage": number(mileage.group(1)) if mileage else None,
        "gearbox": gearbox,
        "fuel": fuel,
        "body": body,
        "seats": int(seats.group(1)) if seats else None,
    }


def car_title(text, fallback):
    """'#Jeep Compass 🚙 #SUV📍 7 Solomon St' -> 'Jeep Compass' (body type and pick-up address dropped)."""
    for line in text.splitlines():
        head = line.split("📍", 1)[0]
        for pattern in CAR_BODIES.values():
            head = re.sub(r"#?\b(?:" + pattern + r")\b", "", head, flags=re.I)
        clean = re.sub(r"\s+", " ", EMOJI_RE.sub("", head).replace("#", "")).strip(" -|:")
        if len(clean) > 2 and not re.match(r"^(?:\+?\d|@|https?://)", clean):
            return short_sentence(clean, 60)
    return fallback


def clean_title(title, text):
    """Channel titles can be the raw first line ('#OldTbilisi 🚇 #LibertySquare 📍18 Atoneli Street')."""
    title = (title or "").strip()
    if "📍" in title or "#" in title:
        source = title if "📍" in title else next((line for line in text.splitlines() if "📍" in line), title)
        title = source.split("📍", 1)[-1]
        title = re.sub(r"\s+", " ", EMOJI_RE.sub("", title).replace("#", "")).strip(" -|:,")
    return title or "Tbilisi"


def pickup_address(text):
    first = text.split("\n", 1)[0]
    return EMOJI_RE.sub("", first.split("📍", 1)[1]).strip() if "📍" in first else ""


# The first line of a post is "#District 🚇 #Metro"; tags spell places in CamelCase.
PLACE_ALIASES = {
    "DidiDigomi": "Didi Dighomi", "DighomiMassive": "Dighomi Massive", "DigomiMassive": "Dighomi Massive",
    "Digomi1to9": "Dighomi 1-9", "Tskhneti": "Tskneti", "TCUniversity": "Technical University",
    "MCUniversity": "Medical University", "STUniversity": "State University", "VazhaPshavela": "Vazha-Pshavela",
    "AhmeteliTheatre": "Akhmeteli Theatre", "TheatreAkhmeteli": "Akhmeteli Theatre",
    "IsaniMetro": "Isani", "SamgoriMetro": "Samgori", "AvlabariMetro": "Avlabari",
    "OldTbilisi": "Old Tbilisi", "LibertySquare": "Liberty Square", "StationSquare": "Station Square",
    "DidiDighomi": "Didi Dighomi", "Voroncov": "Vorontsov",
}
PLACE_ALIASES = {k.lower(): v for k, v in PLACE_ALIASES.items()}
NOT_PLACES = {"newupdate", "update", "rented", "sold", "studio", "apartment", "house", "commercial"}


def place_name(tag):
    tag = tag.replace("\u0421", "C").replace("\u0441", "c")  # Cyrillic С typed inside Latin tags
    if tag.lower() in PLACE_ALIASES:
        return PLACE_ALIASES[tag.lower()]
    return re.sub(r"(?<=[a-z])(?=[A-Z0-9])|(?<=[0-9])(?=[A-Za-z])", " ", tag)


def location_tags(text):
    """District and metro from the post header, e.g. "#Didube🚇 #Tsereteli" -> ("Didube", "Tsereteli")."""
    for line in text.strip().split("\n")[:3]:
        if not line.lstrip().startswith("#") and "🚇" not in line:
            continue
        before, _, after = line.partition("🚇")
        tags = lambda part: [t for t in re.findall(r"#(\w+)", part) if t.lower() not in NOT_PLACES]
        district, metro = tags(before), tags(after)
        if district or metro:
            return (place_name(district[0]) if district else "", place_name(metro[0]) if metro else "")
    return "", ""


def parse_dt(value):
    try:
        return datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def normalize(raw, source, now, rates=FALLBACK_RATES):
    text = (raw.get("source_text") or "").replace("\r", "")
    if not text.strip() or CLOSED_RE.search(text):
        return None
    service, max_age = SOURCES[source]
    published = parse_dt(raw.get("published_at"))
    if published and now - published > timedelta(days=max_age):
        return None
    # Service must be an actual offer, not a digest or announcement.
    if source == "rent" and not re.search(r"for\s*#?rent|#rent\b", text, re.I):
        return None
    if source == "sale" and not re.search(r"for\s*#?sale|#sale\b|apartments? for", text, re.I):
        return None
    if len(re.findall(r"💰", text)) > 3:  # multi-object digest posts
        return None

    price, currency, deposit = parse_price(text, service)
    photos = [p for p in (raw.get("photos") or ([raw["image"]] if raw.get("image") else [])) if p]
    if not price and not photos:
        return None
    # Service posts ("APARTMENTS ON MAP", "CARS ON MAP", announcements) carry no price.
    if not price and (service in CAR_SERVICES or re.search(r"\bON MAP\b", text, re.I)):
        return None
    # Commercial posts in the rent / sale channels belong to the commercial catalogue.
    if service in ("rent", "sale") and property_kind(text, raw.get("property_type")) == "commercial":
        service = "commercial"

    condition = detect(CONDITIONS, text)
    deal = deal_of(text, service)
    is_car = service in CAR_SERVICES

    rooms = parse_rooms(text)
    area = parse_area(text)
    floor, floors = parse_floor(text)
    months, pets, tenants = terms(text)
    price_usd = round(price * rates.get(currency, 1)) if price else None
    lat, lon = raw.get("lat"), raw.get("lon")
    # The post's own header beats the generic CRM matcher ("Lisi" inside "Tbilisi").
    district, metro = location_tags(text)
    if not district and not metro:
        district, metro = raw.get("district") or "", raw.get("metro") or ""
    item = {
        "id": f"{source}-{raw['id']}",
        "service": service,
        "source": source,
        "deal": deal,
        "period": period_of(text, service, deal),
        "kind": "car" if is_car else "commercial" if service == "commercial" else property_kind(text, raw.get("property_type")),
        "title": car_title(text, raw.get("title") or "Car") if is_car else clean_title(raw.get("title"), text),
        "headline": "" if is_car else headline(text),
        "district": "" if is_car else district,
        "metro": "" if is_car else metro,
        "lat": round(float(lat), 6) if lat is not None else None,
        "lon": round(float(lon), 6) if lon is not None else None,
        "price": price,
        "currency": currency,
        "price_usd": price_usd,
        "deposit": deposit,
        "ppsqm_usd": (round(price_usd / area) if price_usd and area else parse_price_per_sqm(text, rates)) if deal == "sale" and not is_car else None,
        "rooms": None if is_car else rooms,
        "area": None if is_car else area,
        "floor": None if is_car else floor,
        "floors": None if is_car else floors,
        "building": "" if is_car else detect(BUILDINGS, text),
        "condition": "" if is_car else condition,
        "heating": "" if is_car else detect(list(HEATING.items()), text),
        "amenities": [] if is_car else listed_features(text),
        **(car_details(text, service) if is_car else {}),
        "pickup": pickup_address(text) if is_car else "",
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
        key = (item["service"], item["title"].lower(), item.get("price"), item.get("area"), item.get("year"), item.get("pickup"))
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


PERIOD_EN = {"month": "/mo", "night": "/night", "day": "/day", "hour": "/hour"}
SYMBOL = {"USD": "$", "GEL": "₾", "EUR": "€"}


def share_meta(item):
    """English preview text for messengers: '10 Givi Kartozia St — $2,000/mo', '3 bd · 160 m² · Saburtalo'."""
    price = f"{SYMBOL.get(item.get('currency'), '$')}{item['price']:,.0f}{PERIOD_EN.get(item.get('period'), '')}" if item.get("price") else "Price on request"
    if item.get("kind") == "car":
        facts = [str(item.get("year") or ""), (item.get("body") or "").upper() if item.get("body") == "suv" else (item.get("body") or "").title(),
                 {"auto": "Automatic", "manual": "Manual"}.get(item.get("gearbox"), ""), (item.get("fuel") or "").title()]
    else:
        rooms = item.get("rooms")
        facts = ["Studio" if rooms == 0 else f"{rooms} bd" if rooms else "", f"{item['area']:.0f} m²" if item.get("area") else "",
                 item.get("district") or "", item.get("metro") or ""]
    title = f"{item.get('headline') or item['title']} — {price}"
    return title, " · ".join(f for f in facts if f) or "Homes in Georgia"


def share_page(item):
    title, description = share_meta(item)
    image = SITE_URL + item["photos"][0] if item.get("photos") else SITE_URL + "homes-in-georgia-splash.jpg"
    page = SITE_URL + f"share/{item['id']}.html"
    target = f"../#/listing/{item['id']}"
    e = lambda v: html.escape(v, quote=True)
    return f"""<!doctype html>
<!-- Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia -->
<html lang="en"><head><meta charset="utf-8">
<meta name="author" content="Irakli Kvirkvelia — Homes in Georgia">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)} · Homes in Georgia</title>
<meta name="description" content="{e(description)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Homes in Georgia">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(description)}">
<meta property="og:image" content="{e(image)}"><meta property="og:url" content="{e(page)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="{e(SITE_URL + '#/listing/' + item['id'])}">
<meta http-equiv="refresh" content="0; url={e(target)}">
<script>location.replace({json.dumps(target)})</script>
</head><body><p><a href="{e(target)}">{e(title)}</a></p></body></html>
"""


def write_share_pages(items):
    """One tiny page per listing with Open Graph tags, so a shared link shows photo, title and price."""
    SHARE.mkdir(parents=True, exist_ok=True)
    wanted = set()
    for item in items:
        name = f"{item['id']}.html"
        wanted.add(name)
        content = share_page(item)
        path = SHARE / name
        if not path.exists() or path.read_text(encoding="utf-8") != content:
            path.write_text(content, encoding="utf-8")
    for old in SHARE.glob("*.html"):
        if old.name not in wanted:
            old.unlink()
    return len(wanted)


def main():
    sources = {}
    for source in SOURCES:
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
    write_share_pages(payload["items"])
    print("listings:", payload["counts"], "| rates:", fx["source"], fx["date"], fx["rates"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
