import tempfile
from datetime import datetime
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
import sys
import unittest
from unittest.mock import patch
from zoneinfo import ZoneInfo

from PIL import Image
from pillow_heif import from_pillow

sys.path.insert(0, str(Path(__file__).resolve().parent))

from import_telegram_property_registry import (
    StoredMedia,
    StaticMediaStorage,
    channel_age_minutes,
    file_hash,
    import_registry,
    link_ranking_to_registry,
    media_diagnostic,
    merge_property,
    normalize_agent_hashtag,
    property_id,
)


TZ = ZoneInfo("Asia/Tbilisi")


class FakeStorage:
    def __init__(self, statuses=None):
        self.statuses = list(statuses or ["ready"])
        self.calls = 0

    async def store(self, _client, _message, filename):
        status = self.statuses[min(self.calls, len(self.statuses) - 1)]
        self.calls += 1
        if status != "ready":
            return StoredMedia("", "", "", "", None, None, status)
        key = filename.replace(":", "/")
        return StoredMedia(key, key, f"{key}-thumb.jpg", "image/jpeg", 1200, 800, "ready")


class FakeClient:
    def __init__(self, messages):
        self.messages = messages

    async def iter_messages(self, _channel, limit):
        for message in self.messages[:limit]:
            yield message

    async def download_media(self, *_args, **_kwargs):
        raise AssertionError("FakeStorage must handle media")


class DownloadClient:
    def __init__(self, payload):
        self.payload = payload

    async def download_media(self, _message, file):
        Path(file).write_bytes(self.payload)
        return file


def telegram_message(message_id=100, hashtag="Omar", forwards=0, photo=True, grouped_id=None, text=True):
    text = (
        "#Vake 📍 10 Test Street\n"
        "#1Bed #Apartment for #Rent\n"
        "60 Sq.m | 3/8 Floor\n"
        "$500\n"
        f"📲 +995599000000 #{hashtag}"
    )
    return SimpleNamespace(
        id=message_id,
        grouped_id=grouped_id,
        message=text if text else "",
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
        self.assertEqual(item["media"][0]["downloadStatus"], "ready")

    async def test_album_order_and_first_valid_image_is_primary(self):
        messages = [
            telegram_message(100, grouped_id=42),
            telegram_message(101, grouped_id=42, text=False),
            telegram_message(102, grouped_id=42, text=False),
        ]
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "registry.json"
            ranking = Path(directory) / "top.json"
            ranking.write_text('{"items": []}', encoding="utf-8")
            storage = FakeStorage(["decode_failed", "ready", "ready"])
            with patch("import_telegram_property_registry.OUTPUT_PATH", output), patch("import_telegram_property_registry.RANKING_PATH", ranking):
                payload = await import_registry(FakeClient(messages), storage, datetime(2026, 7, 16, 12, tzinfo=TZ))
        media = payload["properties"][0]["media"]
        self.assertEqual([item["order"] for item in media], [0, 1, 2])
        self.assertFalse(media[0]["isPrimary"])
        self.assertTrue(media[1]["isPrimary"])
        self.assertEqual(media[0]["downloadStatus"], "decode_failed")

    async def test_single_photo_is_decoded_hashed_and_not_duplicated(self):
        source = BytesIO()
        Image.new("RGB", (120, 80), "red").save(source, "JPEG")
        with tempfile.TemporaryDirectory() as directory:
            storage = StaticMediaStorage(directory)
            client = DownloadClient(source.getvalue())
            first = await storage.store(client, telegram_message(), "rent_tbilisi_ge:100:1:image")
            second = await storage.store(client, telegram_message(), "rent_tbilisi_ge:100:1:image")
            files = list(Path(directory).rglob("*.*"))
        self.assertEqual(first.status, "ready")
        self.assertEqual(first.public_url, second.public_url)
        self.assertEqual(len(files), 2)
        self.assertRegex(first.public_url, r"100-01-[0-9a-f]{12}\.jpg$")

    async def test_png_webp_and_heic_are_converted_to_browser_jpeg(self):
        payloads = []
        for image_format in ("PNG", "WEBP"):
            source = BytesIO()
            Image.new("RGBA" if image_format == "PNG" else "RGB", (90, 60), "blue").save(source, image_format)
            payloads.append(source.getvalue())
        with tempfile.TemporaryDirectory() as source_directory:
            heic_path = Path(source_directory) / "source.heic"
            from_pillow(Image.new("RGB", (90, 60), "green")).save(heic_path)
            payloads.append(heic_path.read_bytes())
        with tempfile.TemporaryDirectory() as directory:
            storage = StaticMediaStorage(directory)
            results = [await storage.store(DownloadClient(payload), telegram_message(), f"rent_tbilisi_ge:100:{index}:image") for index, payload in enumerate(payloads, 1)]
            for result in results:
                with Image.open(Path(directory) / result.original_path.removeprefix("telegram-media/")) as decoded:
                    self.assertEqual(decoded.format, "JPEG")
        self.assertTrue(all(result.status == "ready" for result in results))

    async def test_corrupt_image_records_decode_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            result = await StaticMediaStorage(directory).store(DownloadClient(b"not an image"), telegram_message(), "rent_tbilisi_ge:100:1:image")
        self.assertEqual(result.status, "decode_failed")

    def test_content_hash_changes_filename_input(self):
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first"
            second = Path(directory) / "second"
            first.write_bytes(b"one")
            second.write_bytes(b"two")
            self.assertNotEqual(file_hash(first), file_hash(second))

    def test_download_failure_has_diagnostic_without_fake_media(self):
        self.assertEqual(media_diagnostic([], True), "download_failed")
        self.assertEqual(media_diagnostic([], True, ["storage_failed"]), "storage_failed")
        self.assertEqual(media_diagnostic([], True, ["decode_failed"]), "decode_failed")
        self.assertEqual(media_diagnostic([], True, ["invalid_mapping"]), "invalid_mapping")
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

    def test_ranking_uses_property_coordinates(self):
        ranking = {"items": [{"post_url": "https://t.me/rent_tbilisi_ge/100", "latitude": 0, "longitude": 0}]}
        properties = [{
            "id": "telegram:100",
            "sourceTelegramUrl": "https://t.me/rent_tbilisi_ge/100",
            "coordinates": {"latitude": 41.72, "longitude": 44.78},
        }]
        linked = link_ranking_to_registry(ranking, properties)["items"][0]
        self.assertEqual((linked["latitude"], linked["longitude"]), (41.72, 44.78))


if __name__ == "__main__":
    unittest.main()
