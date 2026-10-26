"""One-off: weekly additions by agent from the CRM sheet "Listings" (feeds "Объекты за неделю").

Prints only counts per agent and day, never other cell data.
"""
from collections import Counter
from datetime import datetime, date
import io
import json
from urllib.request import Request, urlopen

import openpyxl

SHEET = "1M7kg2FgI8eke8_Iy4NofsKzC3NrKetLl3dniKJRxYrU"
url = f"https://docs.google.com/spreadsheets/d/{SHEET}/export?format=xlsx"
book = openpyxl.load_workbook(io.BytesIO(urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=120).read()), read_only=True, data_only=True)
for name in ("Listings", "Active_Listings"):
    rows = list(book[name].iter_rows(values_only=True))
    head = list(rows[0]); i_date, i_agent = head.index("date"), head.index("agent")
    weeks, days, samples = {"12-18": Counter(), "19-25": Counter(), "26+": Counter()}, Counter(), []
    for row in rows[1:]:
        value = row[i_date]
        if isinstance(value, str):
            samples.append(value) if len(samples) < 3 else None
            for fmt in ("%d.%m.%Y %H:%M:%S", "%d.%m.%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d.%m.%y"):
                try:
                    value = datetime.strptime(value.strip(), fmt); break
                except ValueError:
                    pass
        if not isinstance(value, (datetime, date)) or value.year != 2026 or value.month != 10 or value.day < 12:
            continue
        key = "12-18" if value.day <= 18 else ("19-25" if value.day <= 25 else "26+")
        weeks[key][str(row[i_agent] or "—").strip()] += 1
        days[value.strftime("%d.%m")] += 1
    print("RESULT", name, json.dumps({"weeks": {k: dict(v.most_common()) for k, v in weeks.items()}, "days": dict(sorted(days.items())), "string_dates": samples}, ensure_ascii=False))
