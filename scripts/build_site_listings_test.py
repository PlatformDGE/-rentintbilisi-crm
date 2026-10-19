import unittest
from datetime import datetime, timezone

from build_site_listings import build, normalize, parse_nbg, parse_price

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

    def test_nbg_rates_convert_to_usd(self):
        payload = [{"date": "2026-10-19T00:00:00.000Z", "currencies": [
            {"code": "USD", "quantity": 1, "rate": 2.7},
            {"code": "EUR", "quantity": 1, "rate": 2.916},
        ]}]
        rates, date = parse_nbg(payload)
        self.assertEqual(date, "2026-10-19")
        self.assertAlmostEqual(rates["GEL"], 1 / 2.7, places=5)
        self.assertAlmostEqual(rates["EUR"], 1.08, places=5)
        fx = {"rates": rates, "date": date, "source": "NBG"}
        item = normalize(raw(RENT_POST.replace("1500$ + Deposit 1500$", "2700 Gel")), "rent", NOW, rates)
        self.assertEqual(item["price_usd"], 1000)
        self.assertEqual(build({"rent": {"items": []}}, NOW, fx)["rates_source"], "NBG")

    def test_commercial_channel_detects_rent_or_sale(self):
        rent = normalize(raw("🏢 #Commercial for #Rent\n🏠 200 sq.m\n💰 950$ + Deposit 950$"), "commercial", NOW)
        sale = normalize(raw("🏢 Office for #Sale\n🏠 120 sq.m\n💰 240.000$"), "commercial", NOW)
        self.assertEqual((rent["service"], rent["deal"], rent["period"]), ("commercial", "rent", "month"))
        self.assertEqual((sale["deal"], sale.get("period"), sale["price"]), ("sale", None, 240000))
        self.assertEqual(sale["ppsqm_usd"], 2000)

    def test_daily_rent_is_priced_per_night(self):
        item = normalize(raw("📍 Old Tbilisi\n🏢 #1Bed apartment\n💰 60$ per night"), "daily", NOW)
        self.assertEqual((item["service"], item["period"], item["price"]), ("daily", "night", 60))

    def test_car_posts_get_car_fields_and_no_map(self):
        text = "🚗 Toyota Camry 2019\nHybrid | Automatic\n85 000 km\n💰 45$ / day"
        item = normalize(raw(text, lat=41.7, lon=44.8), "car-rent", NOW)
        self.assertEqual(item["title"], "Toyota Camry 2019")
        self.assertEqual((item["kind"], item["period"], item["price"]), ("car", "day", 45))
        self.assertEqual((item["year"], item["mileage"], item["gearbox"], item["fuel"]), (2019, 85000, "auto", "hybrid"))
        self.assertNotIn("district", item)
        self.assertNotIn("lat", item)
        hourly = normalize(raw("Kia Rio\n💰 10$ / hour"), "car-rent", NOW)
        self.assertEqual(hourly["period"], "hour")

    def test_build_counts_and_dedupes_reposts(self):
        payload = build({"rent": {"updated_at": RECENT, "items": [raw(RENT_POST), {**raw(RENT_POST), "id": "2"}]}}, NOW)
        self.assertEqual(payload["counts"], {"rent": 1})


if __name__ == "__main__":
    unittest.main()
