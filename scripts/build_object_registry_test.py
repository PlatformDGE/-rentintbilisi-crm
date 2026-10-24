import unittest
from datetime import datetime, timezone

from build_object_registry import agent_tag, build
from build_site_listings_test import RENT_POST

NOW = datetime(2026, 10, 24, tzinfo=timezone.utc)


def post(post_id, published, text=RENT_POST, title="83 Irakli Abashidze Street"):
    return {"id": post_id, "title": title, "source_text": text, "published_at": published,
            "photos": [f"media/rent/{post_id}-1.jpg"], "property_type": "apartment",
            "post_url": f"https://t.me/rent_tbilisi_ge/{post_id}"}


def sources(*posts):
    return {"rent": {"updated_at": "2026-10-24T10:00:00+04:00", "items": list(posts)}}


class BuildObjectRegistryTest(unittest.TestCase):
    def test_reposts_with_new_price_are_one_object(self):
        cheaper = RENT_POST.replace("1500$ + Deposit 1500$", "1300$ + Deposit 1300$")
        ids = {"next": 1, "keys": {}}
        payload = build(sources(post("10", "2026-10-01T12:00:00+04:00"), post("20", "2026-10-20T12:00:00+04:00", cheaper)), ids, NOW)
        self.assertEqual(len(payload["objects"]), 1)
        obj = payload["objects"][0]
        self.assertEqual(obj["id"], "HIG-0001")
        self.assertEqual(obj["price"], 1300)  # newest post wins
        self.assertEqual(obj["posts"], 2)
        self.assertEqual(obj["status"], "Свободен")
        self.assertEqual(obj["agent"], "Bulat")
        self.assertEqual(payload["posts"], {"rent-10": "HIG-0001", "rent-20": "HIG-0001"})
        self.assertEqual(payload["urls"]["https://t.me/rent_tbilisi_ge/10"], "HIG-0001")

    def test_ids_are_stable_and_never_reused(self):
        ids = {"next": 1, "keys": {}}
        build(sources(post("10", "2026-10-01T12:00:00+04:00")), ids, NOW)
        other = RENT_POST.replace("200 Sq.m", "90 Sq.m")
        payload = build(sources(post("10", "2026-10-01T12:00:00+04:00"), post("30", "2026-10-21T12:00:00+04:00", other, "5 Chavchavadze Ave")), ids, NOW)
        by_post = payload["posts"]
        self.assertEqual(by_post["rent-10"], "HIG-0001")
        self.assertEqual(by_post["rent-30"], "HIG-0002")
        # The object left the channel export: its ID stays reserved.
        build(sources(post("30", "2026-10-21T12:00:00+04:00", other, "5 Chavchavadze Ave")), ids, NOW)
        self.assertEqual(ids["next"], 3)

    def test_old_offer_is_archived_and_closed_posts_skipped(self):
        rented = "❗️#FlatRented\nNice apartment in 📍Vake found a tenant 🤝👏🎉"
        payload = build(sources(post("10", "2025-01-01T12:00:00+04:00"), post("11", "2026-10-20T12:00:00+04:00", rented, "")), {"next": 1, "keys": {}}, NOW)
        self.assertEqual([o["status"] for o in payload["objects"]], ["Архив"])

    def test_agent_tag_reads_signature_after_contact(self):
        self.assertEqual(agent_tag("#Vake 🚇 #Rustaveli\n📲 @David | +995 599 20 67 16 #Shorena"), "Shorena")
        self.assertEqual(agent_tag("#Vake no contact"), "")


if __name__ == "__main__":
    unittest.main()
