import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

from update_telegram_top10 import (
    calculate_ranking,
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


if __name__ == "__main__":
    unittest.main()
