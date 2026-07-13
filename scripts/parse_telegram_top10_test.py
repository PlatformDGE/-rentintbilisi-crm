import unittest

from parse_telegram_top10 import parse_post, parse_views


def post(text, message_id="12345", views="1.2K"):
    return f'''<div class="tgme_widget_message_wrap extra">
      <div class="tgme_widget_message" data-post="rent_tbilisi_ge/{message_id}">
        <a style="background-image:url('https://cdn.example/photo.jpg')"></a>
        <div class="tgme_widget_message_text js-message_text">{text}</div>
        <span class="tgme_widget_message_views">{views}</span>
        <time datetime="2026-07-13T12:00:00+00:00"></time>
      </div>
    </div>'''


class TelegramParserTest(unittest.TestCase):
    def test_views_suffixes(self):
        self.assertEqual([parse_views(value) for value in ("950", "1.2K", "15K", "1.1M")], [950, 1200, 15000, 1100000])

    def test_extracts_supported_property_fields(self):
        item = parse_post(post("""#Saburtalo #MedicalUniversity<br>📍 60 Test St<br>#2Bed Apartment for Rent<br>75 sq.m | 5 / 12 Floor<br>1 200 USD"""))
        self.assertEqual(item["title"], "60 Test St")
        self.assertEqual(item["price"], 1200)
        self.assertEqual(item["area"], 75)
        self.assertEqual(item["rooms"], 2)
        self.assertEqual(item["floor"], "5/12")
        self.assertEqual(item["district"], "Saburtalo")
        self.assertEqual(item["metro"], "Medical University")
        self.assertEqual(item["views"], 1200)

    def test_dollar_before_price_and_square_meters(self):
        item = parse_post(post("Apartment for sale<br>Test Avenue<br>$1200<br>80 square meters<br>Floor 3/9", "2"))
        self.assertEqual((item["price"], item["area"], item["floor"]), (1200, 80, "3/9"))

    def test_skips_closed_and_non_property_posts(self):
        self.assertIsNone(parse_post(post("Nice apartment in Vake found a tenant")))
        self.assertIsNone(parse_post(post("Поздравляем команду с праздником!")))


if __name__ == "__main__":
    unittest.main()
