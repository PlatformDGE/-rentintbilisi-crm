import tempfile
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
import sys
import unittest
from unittest.mock import patch
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))

from import_telegram_property_registry import (
    StoredMedia,
    channel_age_minutes,
    import_registry,
    link_ranking_to_registry,
    media_diagnostic,
    merge_property,
    normalize_agent_hashtag,
    property_id,
)


TZ = ZoneInfo("Asia/Tbilisi")


class FakeStorage:
    def __init__(self, status="media_ready"):
        self.status = status

    async def store(self, _client, _message, filename):
        return StoredMedia(f"telegram-media/{filename}" if self.status == "media_ready" else "", self.status)


class FakeClient:
    def __init__(self, messages):
        self.messages = messages

    async def iter_messages(self, _channel, limit):
        for message in self.messages[:limit]:
            yield message

    async def download_media(self, *_args, **_kwargs):
        raise AssertionError("FakeStorage must handle media")


def telegram_message(message_id=100, hashtag="Omar", forwards=0, photo=True):
    text = (
        "#Vake 📍 10 Test Street\n"
        "#1Bed #Apartment for #Rent\n"
        "60 Sq.m | 3/8 Floor\n"
        "$500\n"
        f"📲 +995599000000 #{hashtag}"
    )
    return SimpleNamespace(
        id=message_id,
        grouped_id=None,
        message=text,
        date=datetime(2026, 7, 15, 10, tzinfo=TZ),
        edit_date=None,
        photo=SimpleNamespace(id=999, w=1200, h=800) if photo else None,
        video=None,
        document=None,
        media=None,
        entities=[],
        caption="",
        caption_entities=[],
        raw_text=text,
        geo=None,
        forwards=forwards,
    )


class RegistryImportTest(unittest.IsolatedAsyncioTestCase):
    def test_source_url_is_property_key(self):
        self.assertEqual(property_id("https://t.me/rent_tbilisi_ge/100"), "telegram:100")

    def test_repeat_import_updates_same_property_and_preserves_first_seen(self):
        now = datetime(2026, 7, 16, 12, tzinfo=TZ)
        incoming = {"sourceTelegramUrl": "https://t.me/rent_tbilisi_ge/100", "publishedAt": "2026-07-15T10:00:00+04:00", "price": 500}
        created, is_created = merge_property(None, incoming, now)
        updated, is_created_again = merge_property(created, {**incoming, "price": 550}, datetime(2026, 7, 17, 12, tzinfo=TZ))
        self.assertTrue(is_created)
        self.assertFalse(is_created_again)
        self.assertEqual(updated["firstSeenAt"], "2026-07-15T10:00:00+04:00")
        self.assertEqual(updated["price"], 550)
        self.assertEqual(len(updated["changeHistory"]), 2)

    def test_agent_hashtag_and_unknown_agent(self):
        self.assertEqual(normalize_agent_hashtag("📲 +995 #Omar"), "Omar")
        self.assertEqual(normalize_agent_hashtag("Apartment without contact hashtag"), "")

    async def test_primary_photo_is_first_real_image(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "registry.json"
            ranking = Path(directory) / "top.json"
            ranking.write_text('{"items": []}', encoding="utf-8")
            with patch("import_telegram_property_registry.OUTPUT_PATH", output), patch("import_telegram_property_registry.RANKING_PATH", ranking):
                payload = await import_registry(FakeClient([telegram_message()]), FakeStorage(), datetime(2026, 7, 16, 12, tzinfo=TZ))
        item = payload["properties"][0]
        self.assertEqual(len(item["media"]), 1)
        self.assertTrue(item["media"][0]["isPrimary"])
        self.assertEqual(item["mediaImportStatus"], "media_ready")

    def test_download_failure_has_diagnostic_without_fake_media(self):
        self.assertEqual(media_diagnostic([], True), "download_failed")
        self.assertEqual(media_diagnostic([], False), "no_media_in_post")

    def test_channel_age_uses_published_at(self):
        self.assertEqual(channel_age_minutes(
            datetime(2026, 7, 15, 10, tzinfo=TZ),
            datetime(2026, 7, 15, 12, 30, tzinfo=TZ),
        ), 150)

    def test_zero_reposts_remain_in_registry_but_ranking_links_only_existing_item(self):
        properties = [{"id": "telegram:100", "sourceTelegramUrl": "https://t.me/rent_tbilisi_ge/100", "repostCount": 0}]
        ranking = {"items": []}
        self.assertEqual(len(properties), 1)
        self.assertEqual(link_ranking_to_registry(ranking, properties)["items"], [])
        ranking = {"items": [{"post_url": "https://t.me/rent_tbilisi_ge/100", "repostCount": 2}]}
        self.assertEqual(link_ranking_to_registry(ranking, properties)["items"][0]["propertyId"], "telegram:100")


if __name__ == "__main__":
    unittest.main()
