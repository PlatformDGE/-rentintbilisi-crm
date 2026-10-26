"""One-off probe: find the sheet behind the CRM "Объекты за неделю" block.

Prints only sheet names, headers, row counts and per-week row counts, never cell data.
"""
from datetime import datetime
import io
import json
from urllib.request import Request, urlopen

import openpyxl

SHEET = "1M7kg2FgI8eke8_Iy4NofsKzC3NrKetLl3dniKJRxYrU"
API_URL = "https://script.google.com/macros/s/AKfycbwrLMoJWg-hiCcV63_aCTpp3QvIEXDXiuoH3mJ0TlBuzMkKsrC9ntEvOz79QXEonvLlKQ/exec"


def get(url):
    return urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=120).read()


try:
    book = openpyxl.load_workbook(io.BytesIO(get(f"https://docs.google.com/spreadsheets/d/{SHEET}/export?format=xlsx")), read_only=True, data_only=True)
    for ws in book.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        header = [str(c)[:30] for c in (rows[0] if rows else []) if c is not None]
        weeks = {}
        for row in rows[1:]:
            for cell in row[:6]:
                if isinstance(cell, datetime) and cell.year == 2026 and cell.month == 10 and cell.day >= 12:
                    weeks["12-18" if cell.day <= 18 else ("19-25" if cell.day <= 25 else "26+")] = weeks.get("12-18" if cell.day <= 18 else ("19-25" if cell.day <= 25 else "26+"), 0) + 1
                    break
        print(f"SHEET {ws.title!r} rows={len(rows)} weeks={weeks} header={header}")
except Exception as error:
    print("xlsx export failed:", error)

for extra in ["", "&week=last", "&weekOffset=2", "&offset=2", "&weekStart=12.10", "&date=2026-10-12", "&from=2026-10-12&to=2026-10-18"]:
    try:
        raw = get(f"{API_URL}?action=getAnalytics{extra}&callback=cb").decode("utf-8")
        data = json.loads(raw[raw.index("(") + 1:raw.rindex(")")])
        wl = data.get("weeklyListings", {})
        print("PARAM", extra or "(none)", json.dumps({k: {"weekStart": v.get("weekStart"), "total": v.get("total")} for k, v in wl.items() if isinstance(v, dict)}, ensure_ascii=False))
    except Exception as error:
        print("PARAM", extra, "error", error)
