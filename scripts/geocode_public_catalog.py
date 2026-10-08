#!/usr/bin/env python3
"""Fill missing public-catalog coordinates from object addresses."""

import json
import time
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


def geocode(query):
    url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ge&q=" + quote(query)
    request = Request(url, headers={"User-Agent": "HomesInGeorgiaCatalog/1.0"})
    with urlopen(request, timeout=20) as response:
        items = json.loads(response.read().decode("utf-8"))
    if not items:
        return None
    return float(items[0]["lat"]), float(items[0]["lon"]), items[0].get("display_name", "")


def geocode_arcgis(query):
    """Fallback for Georgian street names that Nominatim does not index."""
    url = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&maxLocations=1&SingleLine=" + quote(query)
    request = Request(url, headers={"User-Agent": "HomesInGeorgiaCatalog/1.0"})
    with urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    candidates = payload.get("candidates", [])
    if not candidates or float(candidates[0].get("score", 0)) < 70:
        return None
    item = candidates[0]
    return float(item["location"]["y"]), float(item["location"]["x"]), item.get("address", query)


def main():
    changed = 0
    for kind in ("rent", "sale"):
        path = ROOT / "site" / "data" / f"{kind}.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        for item in payload.get("items", []):
            if item.get("lat") is not None and item.get("lon") is not None:
                continue
            query = ", ".join(filter(None, [item.get("title"), item.get("district"), "Tbilisi, Georgia"]))
            if not query:
                continue
            try:
                result = geocode(query)
            except Exception as error:
                print(f"{kind}/{item.get('id')}: {error}")
                result = None
            if not result:
                try:
                    result = geocode_arcgis(query)
                except Exception as error:
                    print(f"{kind}/{item.get('id')} ArcGIS: {error}")
            if result:
                item["lat"], item["lon"], item["location"] = result
                changed += 1
                print(f"{kind}/{item.get('id')}: {item['lat']},{item['lon']}")
            time.sleep(1.1)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"geocoded={changed}")


if __name__ == "__main__":
    main()
