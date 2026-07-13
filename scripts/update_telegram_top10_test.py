import copy
import json
from pathlib import Path
import sys
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))

from update_telegram_top10 import (
    calculate_ranking,
    calculate_test_ranking,
    build_test_payload,
    create_state,
    parse_property,
    period_status,
    window_for,
)

TZ = ZoneInfo("Asia/Tbilisi")


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
        self.assertEqual(ranking[0]["daily_reposts"], 0)

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
        self.assertEqual((ranking[0]["baseline_forwards"], ranking[0]["daily_reposts"]), (11, 0))

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


if __name__ == "__main__":
    unittest.main()
