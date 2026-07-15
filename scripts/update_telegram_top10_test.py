import copy
import json
from pathlib import Path
import sys
import unittest
from datetime import datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))

from update_telegram_top10 import (
    calculate_ranking,
    calculate_test_ranking,
    build_post_url,
    build_test_payload,
    create_state,
    extract_coordinates_from_map_url,
    extract_coordinates_from_text,
    extract_location,
    extract_native_geo,
    extract_urls_from_message,
    parse_property,
    period_status,
    window_for,
)
from telegram_lifecycle import (
    days_inclusive,
    empty_history,
    format_elapsed_minutes,
    normalize_telegram_url,
    performance_status,
    telegram_message_id,
    update_lifecycle,
)

TZ = ZoneInfo("Asia/Tbilisi")


def native_media(type_name, latitude, longitude):
    media = type(type_name, (), {})()
    media.geo = SimpleNamespace(lat=latitude, long=longitude, access_hash=123456)
    return media


def telegram_message(text="", media=None, entities=None):
    return SimpleNamespace(
        message=text,
        raw_text=text,
        caption="",
        entities=entities or [],
        caption_entities=[],
        media=media,
        geo=None,
    )


class FakeResponse:
    def __init__(self, url):
        self.url = url

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def geturl(self):
        return self.url


class FakeOpener:
    def __init__(self, final_url):
        self.final_url = final_url
        self.calls = 0

    def open(self, _request, timeout):
        self.calls += 1
        if timeout > 10:
            raise AssertionError("Timeout exceeds ten seconds")
        return FakeResponse(self.final_url)


def message(message_id, published_at, forwards, title="Test apartment for rent 75 sq.m 2 Bed Vake"):
    return {
        "id": str(message_id),
        "property": parse_property(message_id, title),
        "published_at": published_at,
        "current_forwards": forwards,
        "has_photo": False,
        "message": object(),
    }


class DailyRankingTest(unittest.TestCase):
    def test_native_message_media_geo(self):
        result = extract_native_geo(telegram_message(media=native_media("MessageMediaGeo", 41.7151, 44.8271)))
        self.assertEqual(result, (41.7151, 44.8271, "telegram_geo"))

    def test_native_message_media_geo_live(self):
        result = extract_native_geo(telegram_message(media=native_media("MessageMediaGeoLive", 41.7151, 44.8271)))
        self.assertEqual(result, (41.7151, 44.8271, "telegram_geo_live"))

    def test_native_message_media_venue(self):
        result = extract_native_geo(telegram_message(media=native_media("MessageMediaVenue", 41.7151, 44.8271)))
        self.assertEqual(result, (41.7151, 44.8271, "telegram_venue"))

    def test_text_coordinates_with_comma(self):
        self.assertEqual(
            extract_coordinates_from_text("Location: 41.7151, 44.8271"),
            (41.7151, 44.8271, "text_coordinates"),
        )

    def test_text_coordinates_with_space(self):
        self.assertEqual(
            extract_coordinates_from_text("coordinates 41.7151 44.8271"),
            (41.7151, 44.8271, "text_coordinates"),
        )

    def test_google_maps_query_parameters(self):
        urls = [
            "https://www.google.com/maps?q=41.7151,44.8271",
            "https://www.google.com/maps?query=41.7151,44.8271",
            "https://maps.google.com/maps?ll=41.7151,44.8271",
            "https://www.google.com/maps/dir/?api=1&destination=41.7151,44.8271",
        ]
        for url in urls:
            with self.subTest(url=url):
                self.assertEqual(
                    extract_coordinates_from_map_url(url),
                    (41.7151, 44.8271, "google_maps_url"),
                )

    def test_google_maps_at_coordinates(self):
        urls = [
            "https://www.google.com/maps/@41.7151,44.8271,15z",
            "https://www.google.com/maps/place/Tbilisi/@41.7151,44.8271,17z",
        ]
        for url in urls:
            with self.subTest(url=url):
                self.assertEqual(
                    extract_coordinates_from_map_url(url),
                    (41.7151, 44.8271, "google_maps_url"),
                )

    def test_google_maps_place_coordinates(self):
        self.assertEqual(
            extract_coordinates_from_map_url("https://www.google.com/maps/place/41.7151,44.8271"),
            (41.7151, 44.8271, "google_maps_url"),
        )

    def test_short_google_maps_redirect_is_mocked_and_cached(self):
        opener = FakeOpener("https://www.google.com/maps/@41.7151,44.8271,17z")
        message_with_short_url = telegram_message("Location https://maps.app.goo.gl/example-test-location")
        first = extract_location(message_with_short_url, opener)
        second = extract_location(message_with_short_url, opener)
        self.assertEqual((first["latitude"], first["longitude"]), (41.7151, 44.8271))
        self.assertEqual(first["location_source"], "expanded_short_url")
        self.assertEqual(first["location_url"], "https://maps.app.goo.gl/example-test-location")
        self.assertEqual(first["location_expanded_url"], "https://www.google.com/maps/@41.7151,44.8271,17z")
        self.assertEqual(second, first)
        self.assertEqual(opener.calls, 1)

    def test_goo_gl_maps_redirect_is_supported(self):
        opener = FakeOpener("https://maps.google.com/?q=41.7151,44.8271")
        result = extract_location(telegram_message("Location https://goo.gl/maps/example"), opener)
        self.assertEqual((result["latitude"], result["longitude"]), (41.7151, 44.8271))
        self.assertEqual(result["location_source"], "expanded_short_url")

    def test_hidden_entity_url_is_extracted(self):
        entity = SimpleNamespace(url="https://maps.google.com/?q=41.7151,44.8271")
        result = extract_location(telegram_message("Location", entities=[entity]))
        self.assertEqual(result["location_source"], "google_maps_url")

    def test_visible_entity_url_uses_telegram_utf16_offsets(self):
        text = "📍 https://maps.google.com/?q=41.7151,44.8271"
        url = text.split(" ", 1)[1]
        entity_type = type("MessageEntityUrl", (), {})
        entity = entity_type()
        entity.offset = 3
        entity.length = len(url)
        self.assertIn(url, extract_urls_from_message(telegram_message(text, entities=[entity])))

    def test_invalid_latitude_is_rejected(self):
        self.assertEqual(extract_coordinates_from_text("Location 91.1234, 44.8271"), (None, None, None))

    def test_invalid_longitude_is_rejected(self):
        self.assertEqual(extract_coordinates_from_map_url("https://maps.google.com/?q=41.7151,181.1234"), (None, None, None))

    def test_null_island_placeholder_is_rejected(self):
        self.assertEqual(extract_coordinates_from_map_url("https://maps.google.com/?q=0.0,0.0"), (None, None, None))

    def test_random_price_and_area_are_not_coordinates(self):
        self.assertEqual(extract_coordinates_from_text("$500, 75 sq.m, floor 3 8"), (None, None, None))

    def test_no_location_returns_null_values(self):
        result = extract_location(telegram_message("Apartment for rent $500, 75 sq.m"))
        self.assertIsNone(result["latitude"])
        self.assertIsNone(result["longitude"])
        self.assertIn("не найдена", result["location_diagnostic"])

    def test_post_url_is_direct_and_normalizes_channel(self):
        self.assertEqual(build_post_url(" @rent_tbilisi_ge ", "492214"), "https://t.me/rent_tbilisi_ge/492214")

    def test_post_url_contains_matching_numeric_message_id(self):
        url = build_post_url("rent_tbilisi_ge", 492315)
        self.assertRegex(url, r"^https://t\.me/rent_tbilisi_ge/\d+$")
        self.assertEqual(url.rsplit("/", 1)[1], "492315")

    def test_period_statuses(self):
        for hour, expected in ((9, "before_window"), (10, "active"), (21, "active"), (22, "finished")):
            now = datetime(2026, 7, 14, hour, tzinfo=TZ)
            start, end = window_for(now)
            self.assertEqual(period_status(now, start, end), expected)

    def test_late_baseline_sets_existing_posts_to_zero(self):
        now = datetime(2026, 7, 14, 13, tzinfo=TZ)
        start, end = window_for(now)
        messages = [message(1, datetime(2026, 7, 13, 12, tzinfo=TZ), 25)]
        state = create_state(now, start, end, messages)
        ranking = calculate_ranking(messages, state, start)
        self.assertTrue(state["baseline_created_late"])
        self.assertEqual(ranking, [])

    def test_existing_post_uses_daily_difference(self):
        now = datetime(2026, 7, 14, 10, tzinfo=TZ)
        start, end = window_for(now)
        messages = [message(1, datetime(2026, 7, 13, 12, tzinfo=TZ), 25)]
        state = create_state(now, start, end, messages)
        messages[0]["current_forwards"] = 32
        ranking = calculate_ranking(messages, state, start)
        self.assertEqual(ranking[0]["daily_reposts"], 7)

    def test_new_post_after_ten_has_zero_baseline(self):
        now = datetime(2026, 7, 14, 13, tzinfo=TZ)
        start, end = window_for(now)
        messages = [message(2, datetime(2026, 7, 14, 12, 30, tzinfo=TZ), 8)]
        state = create_state(now, start, end, messages)
        ranking = calculate_ranking(messages, state, start)
        self.assertEqual(ranking[0]["baseline_forwards"], 0)
        self.assertEqual(ranking[0]["daily_reposts"], 8)

    def test_missing_old_post_gets_current_baseline(self):
        now = datetime(2026, 7, 14, 15, tzinfo=TZ)
        start, _ = window_for(now)
        messages = [message(3, datetime(2026, 7, 12, 12, tzinfo=TZ), 11)]
        state = {"messages": {}, "baseline_created_late": False}
        ranking = calculate_ranking(messages, state, start)
        self.assertEqual(ranking, [])
        self.assertEqual(state["messages"]["3"]["baseline_forwards"], 11)

    def test_zero_reposts_are_excluded_when_positive_count_is_below_ten(self):
        now = datetime(2026, 7, 14, 10, tzinfo=TZ)
        start, end = window_for(now)
        messages = [
            message(1, datetime(2026, 7, 13, 12, tzinfo=TZ), 5),
            message(2, datetime(2026, 7, 13, 12, tzinfo=TZ), 0),
        ]
        state = create_state(now, start, end, messages)
        messages[0]["current_forwards"] = 7
        ranking = calculate_ranking(messages, state, start)
        self.assertEqual([item["id"] for item in ranking], ["1"])
        self.assertEqual(ranking[0]["repostCount"], 2)

    def test_sorting_and_limit(self):
        now = datetime(2026, 7, 14, 10, tzinfo=TZ)
        start, end = window_for(now)
        messages = [message(index, datetime(2026, 7, 13, 12, tzinfo=TZ), index) for index in range(1, 13)]
        state = create_state(now, start, end, messages)
        for item in messages:
            item["current_forwards"] += item["current_forwards"]
        ranking = calculate_ranking(messages, state, start)
        self.assertEqual(len(ranking), 10)
        self.assertEqual([item["daily_reposts"] for item in ranking], list(range(12, 2, -1)))

    def test_test_mode_uses_current_total_and_test_status(self):
        now = datetime(2026, 7, 14, 23, tzinfo=TZ)
        messages = [message(9, datetime(2026, 7, 12, 12, tzinfo=TZ), 42)]
        ranking = calculate_test_ranking(messages)
        payload = build_test_payload(now, ranking)
        self.assertEqual(payload["status"], "test")
        self.assertTrue(payload["test_mode"])
        self.assertEqual(payload["period_start"], None)
        self.assertEqual(ranking[0]["daily_reposts"], 42)
        self.assertEqual(ranking[0]["baseline_forwards"], 0)

    def test_test_mode_does_not_mutate_regular_state(self):
        state = {
            "date": "2026-07-14",
            "messages": {"9": {"baseline_forwards": 25, "published_at": "2026-07-12T12:00:00+04:00"}},
        }
        before = copy.deepcopy(state)
        calculate_test_ranking([message(9, datetime(2026, 7, 12, 12, tzinfo=TZ), 42)])
        self.assertEqual(state, before)

    def test_public_test_payload_has_no_view_metric(self):
        now = datetime(2026, 7, 14, 23, tzinfo=TZ)
        payload = build_test_payload(now, calculate_test_ranking([
            message(9, datetime(2026, 7, 12, 12, tzinfo=TZ), 42)
        ]))
        self.assertNotIn("views", json.dumps(payload).lower())

    def test_interface_has_isolated_test_copy_and_no_view_metric(self):
        source = (Path(__file__).resolve().parents[1] / "telegram-top10.js").read_text(encoding="utf-8")
        self.assertNotIn("views", source.lower())
        self.assertNotIn("просмотров", source.lower())
        self.assertIn("payload.status === 'test' || payload.test_mode === true", source)
        self.assertIn("Тестовый топ-10 объектов по репостам", source)
        self.assertIn("period.classList.toggle('telegram-test-note', copy.isTest)", source)
        self.assertIn("badge.hidden = !copy.isTest", source)


class LifecycleTest(unittest.TestCase):
    def item(self, message_id="100", published_at="2026-07-14T12:00:00+04:00", reposts=5):
        return {
            "id": message_id,
            "title": "10 Test Street",
            "price": 500,
            "district": "Vake",
            "post_url": f"https://t.me/rent_tbilisi_ge/{message_id}",
            "published_at": published_at,
            "repostCount": reposts,
            "image": "",
        }

    def test_first_seen_is_saved_and_not_rewritten(self):
        first_run = datetime(2026, 7, 14, 15, tzinfo=TZ)
        active, _, history = update_lifecycle([self.item()], empty_history(), first_run)
        self.assertEqual(active[0]["firstSeenAt"], "2026-07-14T12:00:00+04:00")
        second_run = datetime(2026, 7, 16, 15, tzinfo=TZ)
        active, _, history = update_lifecycle([self.item(published_at="2026-07-16T12:00:00+04:00")], history, second_run)
        self.assertEqual(active[0]["firstSeenAt"], "2026-07-14T12:00:00+04:00")
        self.assertEqual(active[0]["daysOnChannel"], 3)

    def test_calendar_days_are_inclusive_and_today_is_one(self):
        self.assertEqual(days_inclusive(
            datetime(2026, 7, 14, 1, tzinfo=TZ),
            datetime(2026, 7, 14, 23, tzinfo=TZ),
        ), 1)
        self.assertEqual(days_inclusive(
            datetime(2026, 7, 14, 23, tzinfo=TZ),
            datetime(2026, 7, 15, 1, tzinfo=TZ),
        ), 2)

    def test_timer_formats_minutes_hours_days_and_week(self):
        self.assertEqual(format_elapsed_minutes(0), "Сегодня")
        self.assertEqual(format_elapsed_minutes(37), "37 мин")
        self.assertEqual(format_elapsed_minutes(125), "2 ч 5 мин")
        self.assertEqual(format_elapsed_minutes(3 * 1440 + 4 * 60), "3 д 4 ч")
        self.assertEqual(format_elapsed_minutes(8 * 1440 + 50), "8 дней")

    def test_performance_status_thresholds(self):
        self.assertEqual(performance_status(0), "fast")
        self.assertEqual(performance_status(7 * 1440 + 1439), "fast")
        self.assertEqual(performance_status(8 * 1440), "normal")
        self.assertEqual(performance_status(20 * 1440 + 1439), "normal")
        self.assertEqual(performance_status(21 * 1440), "slow")

    def test_disappearing_from_ranking_does_not_mean_rented(self):
        now = datetime(2026, 7, 14, 15, tzinfo=TZ)
        _, _, history = update_lifecycle([self.item()], empty_history(), now)
        active, rented, history = update_lifecycle([], history, datetime(2026, 7, 15, 15, tzinfo=TZ))
        entry = next(iter(history["properties"].values()))
        self.assertEqual(active, [])
        self.assertEqual(rented, [])
        self.assertEqual(entry["lifecycleStatus"], "active")

    def test_confirmed_rental_is_stable_and_excluded_from_active(self):
        now = datetime(2026, 7, 14, 15, tzinfo=TZ)
        _, _, history = update_lifecycle([self.item()], empty_history(), now)
        rented_at = datetime(2026, 7, 18, 10, tzinfo=TZ)
        active, rented, history = update_lifecycle([self.item()], history, rented_at, {"100": rented_at})
        self.assertEqual(active, [])
        self.assertEqual(len(rented), 1)
        self.assertEqual(rented[0]["daysUntilRented"], 5)
        original_rented_at = rented[0]["rentedAt"]
        later = datetime(2026, 7, 20, 10, tzinfo=TZ)
        _, rented, history = update_lifecycle([self.item()], history, later, {"100": later})
        self.assertEqual(rented[0]["rentedAt"], original_rented_at)

    def test_history_rank_and_repost_max_survive_repeated_run(self):
        now = datetime(2026, 7, 14, 15, tzinfo=TZ)
        _, _, history = update_lifecycle([self.item(reposts=8), self.item("101", reposts=7)], empty_history(), now)
        _, _, history = update_lifecycle([self.item("101", reposts=12), self.item(reposts=3)], history, now)
        entries = {entry["sourceTelegramMessageId"]: entry for entry in history["properties"].values()}
        self.assertEqual(entries["100"]["highestRank"], 1)
        self.assertEqual(entries["100"]["maxRepostCount"], 8)
        self.assertEqual(entries["101"]["highestRank"], 1)
        self.assertEqual(entries["101"]["maxRepostCount"], 12)

    def test_active_timer_continues_and_closed_performance_uses_frozen_duration(self):
        now = datetime(2026, 7, 1, 12, tzinfo=TZ)
        item = self.item(published_at="2026-07-01T12:00:00+04:00")
        active, _, history = update_lifecycle([item], empty_history(), now)
        first_elapsed = active[0]["elapsedMinutesOnChannel"]
        active, _, history = update_lifecycle([item], history, datetime(2026, 7, 10, 12, tzinfo=TZ))
        self.assertGreater(active[0]["elapsedMinutesOnChannel"], first_elapsed)
        self.assertEqual(active[0]["performanceStatus"], "normal")
        event = {
            "sourceTelegramUrl": item["post_url"],
            "status": "sold",
            "confirmedAt": "2026-07-23T12:00:00+04:00",
        }
        _, closed, history = update_lifecycle([item], history, datetime(2026, 7, 23, 12, tzinfo=TZ), [event])
        self.assertEqual(closed[0]["performanceStatus"], "slow")
        frozen = closed[0]["elapsedMinutesOnChannel"]
        _, closed, _ = update_lifecycle([item], history, datetime(2026, 8, 1, 12, tzinfo=TZ))
        self.assertEqual(closed[0]["elapsedMinutesOnChannel"], frozen)
        self.assertEqual(closed[0]["performanceStatus"], "slow")

    def test_source_url_is_normalized_and_message_id_extracted(self):
        self.assertEqual(
            normalize_telegram_url("https://T.ME/Rent_Tbilisi_GE/00100?single"),
            "https://t.me/rent_tbilisi_ge/100",
        )
        self.assertEqual(telegram_message_id("https://t.me/rent_tbilisi_ge/100"), "100")

    def test_exact_url_match_closes_property_and_keeps_confirmation(self):
        now = datetime(2026, 7, 14, 15, tzinfo=TZ)
        _, _, history = update_lifecycle([self.item()], empty_history(), now)
        event = {
            "sourceTelegramUrl": "https://t.me/rent_tbilisi_ge/100",
            "confirmationTelegramUrl": "https://t.me/rented_by_owner/900",
            "status": "rented",
            "confirmedAt": "2026-07-15T15:00:00+04:00",
        }
        active, closed, _ = update_lifecycle([self.item()], history, datetime(2026, 7, 16, 15, tzinfo=TZ), [event])
        self.assertEqual(active, [])
        self.assertEqual(closed[0]["lifecycleStatus"], "rented")
        self.assertEqual(closed[0]["confirmationTelegramUrl"], "https://t.me/rented_by_owner/900")

    def test_url_presence_prevents_address_fallback(self):
        now = datetime(2026, 7, 14, 15, tzinfo=TZ)
        _, _, history = update_lifecycle([self.item()], empty_history(), now)
        event = {
            "sourceTelegramUrl": "https://t.me/rent_tbilisi_ge/999",
            "address": "10 Test Street",
            "status": "rented",
            "confirmedAt": "2026-07-15T15:00:00+04:00",
        }
        active, closed, _ = update_lifecycle([self.item()], history, now, [event])
        self.assertEqual(len(active), 1)
        self.assertEqual(closed, [])

    def test_address_fallback_only_without_url_and_sold_timer_stops(self):
        now = datetime(2026, 7, 14, 15, tzinfo=TZ)
        _, _, history = update_lifecycle([self.item()], empty_history(), now)
        event = {
            "address": "10 test street",
            "price": 500,
            "status": "sold",
            "confirmedAt": "2026-07-16T12:00:00+04:00",
        }
        active, closed, history = update_lifecycle([self.item()], history, datetime(2026, 7, 17, 15, tzinfo=TZ), [event])
        self.assertEqual(active, [])
        self.assertEqual(closed[0]["lifecycleStatus"], "sold")
        elapsed = closed[0]["elapsedMinutesOnChannel"]
        _, closed_again, _ = update_lifecycle([self.item()], history, datetime(2026, 7, 20, 15, tzinfo=TZ))
        self.assertEqual(closed_again[0]["elapsedMinutesOnChannel"], elapsed)


if __name__ == "__main__":
    unittest.main()
