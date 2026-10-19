// RU is the primary language, EN the second one. Georgian is planned (see docs/website/TZ.md).

const dict = {
  ru: {
    'brand.tagline': 'Жильё, авто и инвестиции в Грузии',
    'nav.realty': 'Недвижимость', 'nav.auto': 'Авто', 'nav.favorites': 'Избранное', 'nav.contact': 'Связаться',
    'nav.home': 'Главная', 'nav.search': 'Поиск', 'nav.menu': 'Меню', 'nav.close': 'Закрыть',

    'group.realty': 'Недвижимость', 'group.auto': 'Авто',
    'group.realty.desc': 'Аренда, посуточно, вторичка и новостройки в Тбилиси',
    'group.auto.desc': 'Аренда на день или час и продажа автомобилей',

    'svc.rent': 'Долгосрочная аренда', 'svc.rent.short': 'Аренда',
    'svc.rent.desc': 'Квартиры и дома от 6 месяцев',
    'svc.daily': 'Посуточная аренда', 'svc.daily.short': 'Посуточно',
    'svc.daily.desc': 'Апартаменты на ночь, выходные или отпуск',
    'svc.sale': 'Продажа: вторичка', 'svc.sale.short': 'Вторичка',
    'svc.sale.desc': 'Квартиры, дома и коммерция на продажу',
    'svc.new': 'Новостройки и development', 'svc.new.short': 'Новостройки',
    'svc.new.desc': 'Квартиры от застройщиков в строящихся ЖК',
    'svc.car-rent': 'Аренда авто', 'svc.car-rent.short': 'Аренда авто',
    'svc.car-rent.desc': 'Автомобили на день, неделю или месяц',
    'svc.car-hourly': 'Почасовая аренда авто', 'svc.car-hourly.short': 'Почасово',
    'svc.car-hourly.desc': 'Машина на пару часов — по городу и в аэропорт',
    'svc.car-sale': 'Продажа авто', 'svc.car-sale.short': 'Продажа авто',
    'svc.car-sale.desc': 'Проверенные автомобили с историей',
    'svc.all': 'Все объекты',
    'svc.soon': 'Скоро',

    'period.month': '/ мес', 'period.night': '/ ночь', 'period.day': '/ сутки', 'period.hour': '/ час',
    'price.request': 'Цена по запросу', 'price.from': 'от',

    'home.eyebrow': 'Homes in Georgia · Тбилиси',
    'home.title': 'Жильё, авто и инвестиции в Грузии — в одном месте',
    'home.lead': 'Аренда и продажа квартир, новостройки, посуточное жильё и автомобили. Актуальные объекты из наших каналов и агенты на связи.',
    'home.where': 'Где', 'home.where.any': 'Любой район', 'home.type': 'Тип', 'home.budget': 'Бюджет до',
    'home.budget.any': 'Любой', 'home.find': 'Найти', 'home.show.soon': 'Узнать о запуске',
    'home.stat.live': 'актуальных объектов', 'home.stat.districts': 'районов Тбилиси',
    'home.stat.hourly': 'обновление каталога', 'home.stat.hourly.value': 'каждый час',
    'home.stat.commission': 'объектов без комиссии',
    'home.services.title': 'Все сервисы Homes in Georgia',
    'home.services.lead': 'Выберите направление — у каждого свой каталог, фильтры и формат цены.',
    'home.fresh.rent': 'Свежие предложения аренды', 'home.fresh.new': 'Новостройки и development',
    'home.fresh.sale': 'Квартиры на продажу', 'home.see.all': 'Смотреть все',
    'home.districts.title': 'Районы Тбилиси', 'home.districts.lead': 'Где сейчас больше всего предложений',
    'home.why.title': 'Почему с нами просто',
    'home.why.1.t': 'Только актуальное', 'home.why.1.d': 'Сданные и проданные объекты автоматически скрываются с сайта.',
    'home.why.2.t': '0% комиссии', 'home.why.2.d': 'В большинстве объявлений арендатор и покупатель не платят комиссию.',
    'home.why.3.t': 'Агент в Telegram', 'home.why.3.d': 'Пишите напрямую агенту объекта — без форм и колл-центров.',
    'home.why.4.t': 'С 2022 года', 'home.why.4.d': 'Тысячи сделок в каналах Rent in Tbilisi и Sale in Tbilisi.',
    'home.owners.title': 'Сдаёте или продаёте?',
    'home.owners.lead': 'Разместим ваш объект в каналах и на сайте, сделаем фото и найдём арендатора или покупателя.',
    'home.owners.cta': 'Разместить объект',

    'cat.count': n => `${n} ${plural(n, 'объект', 'объекта', 'объектов')}`,
    'cat.search': 'Адрес, район, метро…', 'cat.filters': 'Фильтры', 'cat.sort': 'Сортировка',
    'cat.sort.new': 'Сначала новые', 'cat.sort.cheap': 'Сначала дешёвые', 'cat.sort.expensive': 'Сначала дорогие',
    'cat.sort.area': 'По площади', 'cat.sort.ppsqm': 'Цена за м²',
    'cat.view.list': 'Список', 'cat.view.map': 'Карта', 'cat.reset': 'Сбросить всё',
    'cat.empty.t': 'Ничего не нашли', 'cat.empty.d': 'Попробуйте ослабить фильтры или выбрать другой район.',
    'cat.more': 'Показать ещё', 'cat.updated': 'Обновлено',
    'cat.map.hint': 'Объекты на карте', 'cat.no.coords': 'без точки на карте',

    'f.title': 'Фильтры', 'f.show': n => `Показать ${n} ${plural(n, 'объект', 'объекта', 'объектов')}`,
    'f.price': 'Цена', 'f.price.month': 'Цена в месяц', 'f.area': 'Площадь, м²', 'f.from': 'от', 'f.to': 'до',
    'f.beds': 'Спальни', 'f.studio': 'Студия', 'f.kind': 'Тип объекта', 'f.district': 'Район', 'f.metro': 'Метро',
    'f.metro.any': 'Любая станция', 'f.building': 'Дом', 'f.condition': 'Состояние', 'f.amenities': 'Удобства',
    'f.pets': 'Можно с животными', 'f.term': 'Срок аренды', 'f.flags': 'Дополнительно',
    'f.exclusive': 'Только эксклюзив', 'f.commission': 'Без комиссии', 'f.more': 'Ещё', 'f.less': 'Свернуть',
    'term.short': 'до 6 мес', 'term.year': '12 мес', 'term.long': 'от 24 мес',

    'kind.apartment': 'Квартира', 'kind.house': 'Дом', 'kind.commercial': 'Коммерция', 'kind.land': 'Земля',
    'building.new': 'Новостройка', 'building.old': 'Старый фонд', 'building.historical': 'Исторический',
    'cond.renovated': 'Новый ремонт', 'cond.mixed': 'Жилое состояние', 'cond.old': 'Старый ремонт',
    'cond.white_frame': 'Белый каркас', 'cond.black_frame': 'Чёрный каркас', 'cond.green_frame': 'Зелёный каркас',
    'cond.under_construction': 'Строится',
    'heat.central': 'Центральное', 'heat.gas': 'Газовое', 'heat.electric': 'Электрическое',
    'pets.allowed': 'Можно', 'pets.agreement': 'По договорённости', 'pets.no': 'Нельзя',

    'am.conditioner': 'Кондиционер', 'am.wifi': 'Wi-Fi', 'am.tv': 'Телевизор', 'am.stove': 'Плита', 'am.oven': 'Духовка',
    'am.microwave': 'Микроволновка', 'am.dishwasher': 'Посудомойка', 'am.washer': 'Стиральная машина',
    'am.vacuum': 'Пылесос', 'am.balcony': 'Балкон', 'am.terrace': 'Терраса', 'am.courtyard': 'Двор',
    'am.elevator': 'Лифт', 'am.parking': 'Парковка', 'am.pool': 'Бассейн', 'am.gym': 'Спортзал',
    'am.fireplace': 'Камин', 'am.view': 'Красивый вид', 'am.storage': 'Кладовая', 'am.generator': 'Генератор',
    'am.playground': 'Детская площадка', 'am.security': 'Охрана',

    'card.beds': n => (n === 0 ? 'Студия' : `${n} ${plural(n, 'спальня', 'спальни', 'спален')}`),
    'card.floor': (f, t) => (t ? `${f}/${t} этаж` : `${f} этаж`),
    'card.new': 'Новое', 'card.exclusive': 'Эксклюзив', 'card.nocommission': '0%',
    'card.fav.add': 'В избранное', 'card.fav.remove': 'Убрать из избранного', 'card.prev': 'Предыдущее фото', 'card.next': 'Следующее фото',
    'card.completion': y => `Сдача ${y}`,

    'ago.now': 'только что', 'ago.h': n => `${n} ч назад`, 'ago.d': n => `${n} ${plural(n, 'день', 'дня', 'дней')} назад`,
    'ago.date': d => d,

    'l.photos': n => `Все фото (${n})`, 'l.facts': 'Об объекте', 'l.about': 'Описание', 'l.amenities': 'Удобства',
    'l.terms': 'Условия', 'l.location': 'Расположение', 'l.similar': 'Похожие объекты',
    'l.deposit': 'Депозит', 'l.commission': 'Комиссия', 'l.commission.none': '0% — без комиссии',
    'l.ppsqm': 'Цена за м²', 'l.write': 'Написать в Telegram', 'l.call': 'Позвонить', 'l.whatsapp': 'WhatsApp',
    'l.share': 'Поделиться', 'l.copied': 'Ссылка скопирована', 'l.save': 'В избранное', 'l.saved': 'В избранном',
    'l.source': 'Открыть пост в Telegram', 'l.id': 'ID объекта', 'l.published': 'Опубликовано',
    'l.rooms': 'Спальни', 'l.area': 'Площадь', 'l.floor': 'Этаж', 'l.building': 'Дом', 'l.condition': 'Состояние',
    'l.heating': 'Отопление', 'l.term': 'Срок', 'l.term.value': m => m.map(x => x + ' мес').join(' · '),
    'l.pets': 'Животные', 'l.tenants': 'Жильцов', 'l.tenants.value': n => `до ${n}`, 'l.kind': 'Тип',
    'l.completion': 'Сдача', 'l.notfound': 'Объект не найден или уже сдан', 'l.back': 'Вернуться в каталог',
    'l.msg': (title, url) => `Здравствуйте! Интересует объект «${title}» ${url}`,
    'l.approx': 'цена в объявлении',

    'soon.badge': 'Скоро запуск', 'soon.lead': 'Мы готовим этот сервис. Оставьте заявку — подберём вариант вручную уже сейчас и сообщим о запуске.',
    'soon.cta': 'Оставить заявку', 'soon.channel': 'Подписаться на канал', 'soon.how': 'Как это будет работать',
    'soon.step.1': 'Выбираете в каталоге с удобными фильтрами', 'soon.step.2': 'Пишете агенту в Telegram или WhatsApp',
    'soon.step.3': 'Получаете ключи — без лишних встреч и бумаг', 'soon.meanwhile': 'Пока можно посмотреть',
    'soon.preview': 'Фильтры, которые появятся',
    'soon.f.new': ['Жилой комплекс и застройщик', 'Срок сдачи', 'Цена за м²', 'Планировки', 'Рассрочка'],
    'soon.f.daily': ['Даты заезда и выезда', 'Количество гостей', 'Цена за ночь', 'Район и метро', 'Мгновенное бронирование'],
    'soon.f.car-rent': ['Класс авто', 'Коробка передач', 'Цена за сутки', 'Доставка в аэропорт', 'Без депозита'],
    'soon.f.car-hourly': ['Время начала и окончания', 'Класс авто', 'Цена за час', 'С водителем', 'Детское кресло'],
    'soon.f.car-sale': ['Марка и модель', 'Год выпуска', 'Пробег', 'Цена', 'Тип кузова и топлива'],

    'fav.title': 'Избранное', 'fav.empty.t': 'Здесь пока пусто',
    'fav.empty.d': 'Нажимайте ♡ на карточках, чтобы сохранять понравившиеся объекты.',
    'fav.browse': 'Перейти в каталог',

    'nf.title': 'Страница не найдена', 'nf.home': 'На главную',
    'footer.about': 'Единая площадка сервисов Homes in Georgia: недвижимость и авто в Тбилиси.',
    'footer.services': 'Сервисы', 'footer.channels': 'Telegram-каналы', 'footer.contact': 'Контакты',
    'footer.rights': 'Все права защищены.', 'footer.data': 'Данные обновляются из Telegram-каналов каждый час.',
    'loading': 'Загружаем объекты…', 'error': 'Не удалось загрузить каталог. Обновите страницу.',
  },

  en: {
    'brand.tagline': 'Homes, cars and investments in Georgia',
    'nav.realty': 'Real estate', 'nav.auto': 'Cars', 'nav.favorites': 'Saved', 'nav.contact': 'Contact us',
    'nav.home': 'Home', 'nav.search': 'Search', 'nav.menu': 'Menu', 'nav.close': 'Close',

    'group.realty': 'Real estate', 'group.auto': 'Cars',
    'group.realty.desc': 'Long-term, daily, resale and new builds in Tbilisi',
    'group.auto.desc': 'Daily and hourly car rental, cars for sale',

    'svc.rent': 'Long-term rent', 'svc.rent.short': 'Rent', 'svc.rent.desc': 'Apartments and houses from 6 months',
    'svc.daily': 'Daily rent', 'svc.daily.short': 'Daily', 'svc.daily.desc': 'Apartments for a night, weekend or holiday',
    'svc.sale': 'Resale homes', 'svc.sale.short': 'Buy', 'svc.sale.desc': 'Apartments, houses and commercial for sale',
    'svc.new': 'New builds & development', 'svc.new.short': 'New builds', 'svc.new.desc': 'Developer apartments in projects under construction',
    'svc.car-rent': 'Car rental', 'svc.car-rent.short': 'Car rental', 'svc.car-rent.desc': 'Cars for a day, week or month',
    'svc.car-hourly': 'Hourly car rental', 'svc.car-hourly.short': 'Hourly', 'svc.car-hourly.desc': 'A car for a couple of hours — city or airport',
    'svc.car-sale': 'Cars for sale', 'svc.car-sale.short': 'Buy a car', 'svc.car-sale.desc': 'Checked cars with history',
    'svc.all': 'All listings', 'svc.soon': 'Soon',

    'period.month': '/ mo', 'period.night': '/ night', 'period.day': '/ day', 'period.hour': '/ hour',
    'price.request': 'Price on request', 'price.from': 'from',

    'home.eyebrow': 'Homes in Georgia · Tbilisi',
    'home.title': 'Homes, cars and investments in Georgia — in one place',
    'home.lead': 'Rentals and sales, new developments, daily stays and cars. Live listings from our channels and agents ready to help.',
    'home.where': 'Where', 'home.where.any': 'Any district', 'home.type': 'Type', 'home.budget': 'Budget up to',
    'home.budget.any': 'Any', 'home.find': 'Search', 'home.show.soon': 'Get notified',
    'home.stat.live': 'live listings', 'home.stat.districts': 'Tbilisi districts',
    'home.stat.hourly': 'catalogue refresh', 'home.stat.hourly.value': 'hourly',
    'home.stat.commission': 'listings with no commission',
    'home.services.title': 'All Homes in Georgia services',
    'home.services.lead': 'Pick a direction — each has its own catalogue, filters and price format.',
    'home.fresh.rent': 'Fresh rentals', 'home.fresh.new': 'New builds & development', 'home.fresh.sale': 'Homes for sale',
    'home.see.all': 'See all',
    'home.districts.title': 'Tbilisi districts', 'home.districts.lead': 'Where most offers are right now',
    'home.why.title': 'Why it is easy with us',
    'home.why.1.t': 'Only live offers', 'home.why.1.d': 'Rented and sold properties disappear from the site automatically.',
    'home.why.2.t': '0% commission', 'home.why.2.d': 'Most listings charge no commission to tenants and buyers.',
    'home.why.3.t': 'Agent on Telegram', 'home.why.3.d': 'Message the listing agent directly — no forms, no call centres.',
    'home.why.4.t': 'Since 2022', 'home.why.4.d': 'Thousands of deals across Rent in Tbilisi and Sale in Tbilisi.',
    'home.owners.title': 'Renting out or selling?',
    'home.owners.lead': 'We list your property in our channels and on the site, shoot photos and find a tenant or buyer.',
    'home.owners.cta': 'List a property',

    'cat.count': n => `${n} ${n === 1 ? 'listing' : 'listings'}`,
    'cat.search': 'Address, district, metro…', 'cat.filters': 'Filters', 'cat.sort': 'Sort',
    'cat.sort.new': 'Newest first', 'cat.sort.cheap': 'Price: low to high', 'cat.sort.expensive': 'Price: high to low',
    'cat.sort.area': 'Largest first', 'cat.sort.ppsqm': 'Price per m²',
    'cat.view.list': 'List', 'cat.view.map': 'Map', 'cat.reset': 'Clear all',
    'cat.empty.t': 'Nothing found', 'cat.empty.d': 'Try relaxing the filters or picking another district.',
    'cat.more': 'Show more', 'cat.updated': 'Updated',
    'cat.map.hint': 'Listings on the map', 'cat.no.coords': 'without a map pin',

    'f.title': 'Filters', 'f.show': n => `Show ${n} ${n === 1 ? 'listing' : 'listings'}`,
    'f.price': 'Price', 'f.price.month': 'Monthly price', 'f.area': 'Area, m²', 'f.from': 'from', 'f.to': 'to',
    'f.beds': 'Bedrooms', 'f.studio': 'Studio', 'f.kind': 'Property type', 'f.district': 'District', 'f.metro': 'Metro',
    'f.metro.any': 'Any station', 'f.building': 'Building', 'f.condition': 'Condition', 'f.amenities': 'Amenities',
    'f.pets': 'Pet friendly', 'f.term': 'Lease term', 'f.flags': 'More',
    'f.exclusive': 'Exclusive only', 'f.commission': 'No commission', 'f.more': 'More', 'f.less': 'Less',
    'term.short': 'up to 6 mo', 'term.year': '12 mo', 'term.long': '24+ mo',

    'kind.apartment': 'Apartment', 'kind.house': 'House', 'kind.commercial': 'Commercial', 'kind.land': 'Land',
    'building.new': 'New building', 'building.old': 'Old building', 'building.historical': 'Historical',
    'cond.renovated': 'Newly renovated', 'cond.mixed': 'Good condition', 'cond.old': 'Old renovation',
    'cond.white_frame': 'White frame', 'cond.black_frame': 'Black frame', 'cond.green_frame': 'Green frame',
    'cond.under_construction': 'Under construction',
    'heat.central': 'Central', 'heat.gas': 'Gas', 'heat.electric': 'Electric',
    'pets.allowed': 'Allowed', 'pets.agreement': 'By agreement', 'pets.no': 'Not allowed',

    'am.conditioner': 'Air conditioning', 'am.wifi': 'Wi-Fi', 'am.tv': 'TV', 'am.stove': 'Stove', 'am.oven': 'Oven',
    'am.microwave': 'Microwave', 'am.dishwasher': 'Dishwasher', 'am.washer': 'Washing machine', 'am.vacuum': 'Vacuum cleaner',
    'am.balcony': 'Balcony', 'am.terrace': 'Terrace', 'am.courtyard': 'Courtyard', 'am.elevator': 'Elevator',
    'am.parking': 'Parking', 'am.pool': 'Pool', 'am.gym': 'Gym', 'am.fireplace': 'Fireplace', 'am.view': 'Great view',
    'am.storage': 'Storage', 'am.generator': 'Generator', 'am.playground': 'Playground', 'am.security': 'Security',

    'card.beds': n => (n === 0 ? 'Studio' : `${n} bed${n === 1 ? '' : 's'}`),
    'card.floor': (f, t) => (t ? `Floor ${f}/${t}` : `Floor ${f}`),
    'card.new': 'New', 'card.exclusive': 'Exclusive', 'card.nocommission': '0%',
    'card.fav.add': 'Save', 'card.fav.remove': 'Remove from saved', 'card.prev': 'Previous photo', 'card.next': 'Next photo',
    'card.completion': y => `Ready ${y}`,

    'ago.now': 'just now', 'ago.h': n => `${n}h ago`, 'ago.d': n => `${n}d ago`, 'ago.date': d => d,

    'l.photos': n => `All photos (${n})`, 'l.facts': 'Key facts', 'l.about': 'Description', 'l.amenities': 'Amenities',
    'l.terms': 'Terms', 'l.location': 'Location', 'l.similar': 'Similar listings',
    'l.deposit': 'Deposit', 'l.commission': 'Commission', 'l.commission.none': '0% — no commission',
    'l.ppsqm': 'Price per m²', 'l.write': 'Message on Telegram', 'l.call': 'Call', 'l.whatsapp': 'WhatsApp',
    'l.share': 'Share', 'l.copied': 'Link copied', 'l.save': 'Save', 'l.saved': 'Saved',
    'l.source': 'Open the Telegram post', 'l.id': 'Listing ID', 'l.published': 'Published',
    'l.rooms': 'Bedrooms', 'l.area': 'Area', 'l.floor': 'Floor', 'l.building': 'Building', 'l.condition': 'Condition',
    'l.heating': 'Heating', 'l.term': 'Lease', 'l.term.value': m => m.map(x => x + ' mo').join(' · '),
    'l.pets': 'Pets', 'l.tenants': 'Tenants', 'l.tenants.value': n => `up to ${n}`, 'l.kind': 'Type',
    'l.completion': 'Completion', 'l.notfound': 'This listing was not found or is already taken', 'l.back': 'Back to catalogue',
    'l.msg': (title, url) => `Hello! I am interested in “${title}” ${url}`,
    'l.approx': 'listed price',

    'soon.badge': 'Launching soon', 'soon.lead': 'We are preparing this service. Leave a request — we will find an option for you manually today and let you know at launch.',
    'soon.cta': 'Leave a request', 'soon.channel': 'Follow the channel', 'soon.how': 'How it will work',
    'soon.step.1': 'Browse a catalogue with smart filters', 'soon.step.2': 'Message an agent on Telegram or WhatsApp',
    'soon.step.3': 'Get the keys — no extra meetings or paperwork', 'soon.meanwhile': 'Meanwhile, explore',
    'soon.preview': 'Filters coming with the launch',
    'soon.f.new': ['Residential complex and developer', 'Completion date', 'Price per m²', 'Floor plans', 'Instalments'],
    'soon.f.daily': ['Check-in and check-out dates', 'Number of guests', 'Price per night', 'District and metro', 'Instant booking'],
    'soon.f.car-rent': ['Car class', 'Transmission', 'Price per day', 'Airport delivery', 'No deposit'],
    'soon.f.car-hourly': ['Start and end time', 'Car class', 'Price per hour', 'With a driver', 'Child seat'],
    'soon.f.car-sale': ['Make and model', 'Year', 'Mileage', 'Price', 'Body and fuel type'],

    'fav.title': 'Saved', 'fav.empty.t': 'Nothing saved yet', 'fav.empty.d': 'Tap ♡ on any card to keep listings you like.',
    'fav.browse': 'Browse listings',

    'nf.title': 'Page not found', 'nf.home': 'Go home',
    'footer.about': 'All Homes in Georgia services in one place: real estate and cars in Tbilisi.',
    'footer.services': 'Services', 'footer.channels': 'Telegram channels', 'footer.contact': 'Contact',
    'footer.rights': 'All rights reserved.', 'footer.data': 'Listings sync from our Telegram channels every hour.',
    'loading': 'Loading listings…', 'error': 'Could not load the catalogue. Please refresh.',
  },
};

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

const LANGS = ['ru', 'en'];
let lang = (() => {
  try {
    const saved = localStorage.getItem('hig:lang');
    if (LANGS.includes(saved)) return saved;
  } catch {}
  return (navigator.language || 'ru').toLowerCase().startsWith('ru') ? 'ru' : 'en';
})();

export const getLang = () => lang;
export const languages = LANGS;

export function setLang(next) {
  if (!LANGS.includes(next)) return;
  lang = next;
  try { localStorage.setItem('hig:lang', next); } catch {}
  document.documentElement.lang = next;
}

export function t(key, ...args) {
  const value = dict[lang][key] ?? dict.ru[key];
  if (typeof value === 'function') return value(...args);
  return value ?? key;
}

document.documentElement.lang = lang;
