#!/usr/bin/env python3
"""Median long-term rent by district and bedrooms, for the investment calculator.

Reads the whole raw rent channel export (site/data/rent.json, ~4000 posts,
including the ones already marked as rented, not only the live offers in
listings.json), parses each post with the same rules as
the public feed and writes a small table:

  {"updated_at": ..., "window_days": 365, "rows": [[district, rooms, median_usd, count], ...]}

rooms is null for the district-wide median, district is "" for the city-wide
median by rooms. The calculator on the test site picks the most specific row
with enough posts behind it. Pure standard library.

Usage: build_rent_medians.py [rent.json] [out.json]
"""

from datetime import datetime
import json
import re
from pathlib import Path
from statistics import median
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_site_listings as feed  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
WINDOW_DAYS = 365
MIN_USD, MAX_USD = 150, 15000  # monthly rent sanity range; outside it is a typo or a whole building

# Same as PLACE_ALIASES in site/assets/js/places.js (and club-test/invest/invest.js),
# so a sale listing in "Didi Digomi" finds the rent posts in "Didi Dighomi".
ALIASES = {"Digomi": "Dighomi", "Didi Digomi": "Didi Dighomi", "Digomi Massive": "Dighomi Massive",
           "Digomi 1-9": "Dighomi 1-9", "Temka": "Temqa", "Temuka": "Temqa", "Out Of Town": "Out of town",
           "Voroncov": "Vorontsov", "Tskhneti": "Tskneti", "Mukhyani": "Mukhiani", "Vazha Pshavela": "Vazha-Pshavela"}


def rows_from(payload, now=None):
    now = now or datetime.now().astimezone()
    feed.SOURCES = {**feed.SOURCES, "rent": ("rent", WINDOW_DAYS)}
    # Posts marked as rented are the best evidence of what a flat really goes for,
    # so they count here even though the public feed hides them.
    feed.CLOSED_RE = re.compile(r"(?!x)x")
    items = [feed.normalize(raw, "rent", now) for raw in payload.get("items", [])]
    items = feed.dedupe([x for x in items if x])
    groups = {}
    for x in items:
        usd = x.get("price_usd")
        if x.get("service") != "rent" or x.get("period") != "month" or x.get("kind") != "apartment":
            continue
        if not usd or not MIN_USD <= usd <= MAX_USD:
            continue
        district = ALIASES.get(x.get("district") or "", x.get("district") or "")
        rooms = x.get("rooms")
        rooms = min(rooms, 5) if isinstance(rooms, int) and rooms < 20 else None
        keys = [("", None)]
        if district:
            keys.append((district, None))
        if rooms is not None:
            keys.append(("", rooms))
            if district:
                keys.append((district, rooms))
        for key in keys:
            groups.setdefault(key, []).append(usd)
    return sorted([[d, r, round(median(v)), len(v)] for (d, r), v in groups.items()],
                  key=lambda row: (row[0], -1 if row[1] is None else row[1]))


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "site" / "data" / "rent.json"
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "club-test" / "invest" / "rent-medians.json"
    payload = json.loads(src.read_text(encoding="utf-8"))
    rows = rows_from(payload)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"updated_at": payload.get("updated_at", ""), "window_days": WINDOW_DAYS, "rows": rows},
                              ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    total = next((row[3] for row in rows if row[0] == "" and row[1] is None), 0)
    print(f"rent medians: {len(rows)} rows from {total} apartment posts -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
