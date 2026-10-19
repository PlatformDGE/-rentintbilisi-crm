import unittest
from datetime import datetime, timezone

from build_site_listings import build, normalize, parse_price

NOW = datetime(2026, 10, 19, tzinfo=timezone.utc)
RECENT = "2026-10-18T12:00:00+04:00"

RENT_POST = """#Vake 🚇 #Rustaveli
📍83 Irakli Abashidze Street

⭐️ Duplex 3bed apartment near Vake Park ⭐️

🏢 #3Bed #Apartment for #Rent
✨ #OldBuilding | #Mixed
🏠200 Sq.m | 4/5 Floor | #CentralHeating | #2Bathroom

✅ #Balcony  ✅ #WiFi
✅ #Dishwasher ✅ #Elevator

✖️ Oven

🐕Pets: #ByAgreement
🕐 #6Month #12Month

💰 1500$ + Deposit 1500$
0% Commission

📲 @David_Tibelashvili |
+995 599 20 67 16 #Bulat
"""


def raw(text, source="rent", **extra):
    return {"id": "1", "title": "83 Irakli Abashidze Street", "source_text": text, "published_at": RECENT,
            "photos": ["media/rent/1-1.jpg"], "property_type": "apartment", **extra}


class BuildSiteListingsTest(unittest.TestCase):
    def test_parses_structured_rent_post(self):
        item = normalize(raw(RENT_POST), "rent", NOW)
        self.assertEqual(item["service"], "rent")
        self.assertEqual(item["price"], 1500)
        self.assertEqual(item["deposit"], 1500)
        self.assertEqual(item["rooms"], 3)
        self.assertEqual(item["area"], 200)
        self.assertEqual((item["floor"], item["floors"]), (4, 5))
        self.assertEqual(item["months"], [6, 12])
        self.assertEqual(item["pets"], "agreement")
        self.assertEqual(item["headline"], "Duplex 3bed apartment near Vake Park")
        self.assertIn("dishwasher", item["amenities"])
        self.assertNotIn("oven", item["amenities"])
        self.assertTrue(item["no_commission"])
        self.assertEqual(item["agent"]["telegram"], "David_Tibelashvili")

    def test_skips_closed_and_digest_posts(self):
        self.assertIsNone(normalize(raw("❗️#FlatRented\nNice apartment in 📍Vake found a tenant"), "rent", NOW))
        self.assertIsNone(normalize(raw(RENT_POST + "\n#Sold"), "rent", NOW))

    def test_skips_expired_rent(self):
        self.assertIsNone(normalize(raw(RENT_POST, published_at="2026-01-01T10:00:00+04:00"), "rent", NOW))

    def test_currencies_and_thousand_separators(self):
        self.assertEqual(parse_price("💰 1100 Gel + Deposit 1100 Gel", "rent")[:2], (1100, "GEL"))
        self.assertEqual(parse_price("💰2000€ + 2000€ Deposit", "rent")[:2], (2000, "EUR"))
        self.assertEqual(parse_price("💰129.000$ |", "sale")[:2], (129000, "USD"))
        self.assertEqual(parse_price("💰129$", "sale")[:2], (129000, "USD"))

    def test_frame_sale_stays_resale_until_developments_launch(self):
        text = "🏢 #2Bed #Apartment for #Sale\n✨ #NewBuilding | #WhiteFrame\n🏠 80 Sq.m | 3/11 Floor\n💰 96.000$"
        item = normalize(raw(text), "sale", NOW)
        self.assertEqual(item["service"], "sale")
        self.assertEqual(item["condition"], "white_frame")
        self.assertEqual(item["ppsqm_usd"], 1200)

    def test_build_counts_and_dedupes_reposts(self):
        payload = build({"rent": {"updated_at": RECENT, "items": [raw(RENT_POST), {**raw(RENT_POST), "id": "2"}]}}, NOW)
        self.assertEqual(payload["counts"], {"rent": 1})


if __name__ == "__main__":
    unittest.main()
