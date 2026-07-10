# Rent in Tbilisi Platform — Blueprint v0.1

## 1. Цель

Единая операционная платформа для Rent in Tbilisi, где CRM является источником данных, а Telegram — основным рабочим и публикационным каналом.

Система не строится вокруг MyHome или SS.ge. Они являются только одним из источников объектов в процессе **Make Photo From Platform**.

## 2. Уже существующие компоненты

### Telegram
- Основной публичный канал: `@rent_tbilisi_ge`
- Рабочая группа с топиками:
  - General
  - Owner Information
  - Make Photo From Platform
  - Ready For Publication
  - Update
  - Discount
  - Delete Ad
  - Rented/Sold By Agent
  - Archives
  - Links For Owner
  - Quick Response
  - Advertising
  - Standards of Platform

### Mini App
- Dashboard
- Reports
  - Deal
  - Post Generator
  - General Report
  - Daily Report
  - Make Photo From Platform
  - Property Check
- Contract
  - Apartment Rental
  - Commercial Rental
  - Sale
  - RU / GE / EN
  - Details
  - Review
- Agent
  - Deal Calculator
  - Commission
  - TO evaluation
- Profile
  - Agent list
  - Agent card
  - Calendar
  - Showings
  - Expiring contracts
  - Deal history
- Admin

### Web modules
- Post Generator: `https://platformd.ge/post-generator.html`
- Current CRM prototype
- Google Sheets as current operational data source

## 3. Главная сущность

Центральная сущность системы — **Property (Объект)**.

Объект может появиться из любого источника:
- собственник написал напрямую;
- агент нашёл на MyHome;
- агент нашёл на SS.ge;
- рекомендация;
- старый архив;
- входящий клиент;
- импорт из Google Sheets;
- ручное создание.

## 4. Жизненный цикл объекта

```text
NEW
→ DUPLICATE_CHECK
→ ASSIGNED
→ OWNER_INFO
→ PHOTO_PLANNED
→ PHOTO_DONE
→ READY_FOR_PUBLICATION
→ PUBLISHED
→ UPDATED
→ SHOWING
→ NEGOTIATION
→ CONTRACT
→ RENTED / SOLD
→ ARCHIVED
```

Переходы должны фиксироваться в журнале действий.

## 5. Основные модули платформы

### 5.1 Objects
- единая карточка объекта;
- источник;
- собственник;
- ответственный агент;
- статус;
- кадастр;
- адрес;
- цена;
- характеристики;
- фото и видео;
- Telegram-публикации;
- история изменений;
- дубли;
- сделки и договоры.

### 5.2 Owners
- имя;
- телефон;
- Telegram;
- связанные объекты;
- история общения;
- статус эксклюзива;
- документы;
- дубли собственников.

### 5.3 Clients
- запрос;
- бюджет;
- районы;
- животные;
- срок;
- связанные показы;
- подборки;
- сделка.

### 5.4 Make Photo From Platform
Отдельный процесс, а не основа системы.

Сценарий:
1. Агент отправляет ссылку MyHome/SS.ge.
2. Система извлекает source ID и URL.
3. Проверяет ссылку, телефон, адрес, кадастр и архив.
4. Если найден дубликат — показывает карточку и ответственного.
5. Если объект новый — закрепляет за агентом.
6. Создаёт задачу на фото.
7. Отправляет уведомление в Telegram-топик.

### 5.5 Publishing Engine
- Post Generator;
- автозаполнение из карточки объекта;
- 9 фото + 1 видео;
- порядок медиа;
- водяной знак;
- предпросмотр;
- публикация в `@rent_tbilisi_ge`;
- сохранение `chat_id`, `message_id`, `media_group_id`;
- обновление цены;
- отправка в Update;
- снятие публикации;
- архив публикаций.

### 5.6 Reports
- Deal;
- General Report;
- Daily Report;
- Photo;
- Showing;
- Stickers;
- Calling;
- Make Photo From Platform;
- Property Check.

### 5.7 Contracts
- Apartment Rental;
- Commercial Rental;
- Sale;
- языки RU / GE / EN;
- автозаполнение из объекта, собственника и клиента;
- PDF/DOC;
- Google Drive;
- привязка к объекту;
- напоминания об окончании.

### 5.8 Agents
- профиль;
- роль;
- уровень 50% / 70% / 90%;
- сделки;
- объекты;
- показы;
- календарь;
- комиссия;
- рекруты;
- TO/H2O оценки.

### 5.9 Dashboard
- сделки;
- комиссия платформы;
- общая комиссия агентства;
- средняя комиссия;
- оборот;
- активные объекты;
- средняя цена;
- эксклюзивы;
- районы;
- агенты;
- задачи и просрочки.

## 6. Источник истины

Целевая архитектура:

```text
CRM Web + Telegram Mini App + Telegram Bot
                ↓
              API
                ↓
           PostgreSQL
                ↓
 Storage / Telegram / Google Drive / Analytics
```

Google Sheets остаётся временным источником импорта и резервной выгрузки, но не основной базой после миграции.

## 7. Проверка дублей

### Точные правила
- одинаковый source + external_id;
- одинаковая ссылка после нормализации;
- одинаковый кадастровый код;
- одинаковый телефон + адрес.

### Вероятные правила
- похожий адрес;
- площадь ±5%;
- комнаты;
- этаж;
- цена ±10%;
- совпадение фотографий;
- похожий текст.

Результат:
- `duplicate_score` 0–100;
- причина совпадения;
- подтверждение менеджера для спорных случаев.

## 8. Минимальная модель данных

### property
- id
- source_type
- source_url
- source_external_id
- status
- address
- district
- latitude
- longitude
- cadastral_code
- price
- currency
- area
- rooms
- bedrooms
- floor
- total_floors
- description
- owner_id
- assigned_agent_id
- created_at
- updated_at
- archived_at

### owner
- id
- name
- phone
- telegram
- notes
- created_at

### property_media
- id
- property_id
- type
- original_url
- processed_url
- sort_order
- has_watermark

### telegram_publication
- id
- property_id
- chat_id
- thread_id
- message_id
- media_group_id
- publication_type
- status
- published_at
- updated_at

### duplicate_match
- id
- property_id
- matched_property_id
- score
- reasons
- decision

### agent
- id
- name
- telegram_user_id
- telegram_username
- role
- level
- commission_percent
- active

### task
- id
- property_id
- agent_id
- type
- status
- due_at

### deal
- id
- property_id
- agent_id
- client_id
- owner_id
- price
- commission
- platform_commission
- start_date
- end_date
- status

### contract
- id
- property_id
- deal_id
- language
- type
- file_url
- start_date
- end_date
- status

### action_log
- id
- actor_id
- entity_type
- entity_id
- action
- before_json
- after_json
- created_at

## 9. Первый рабочий этап

### Модуль: Object Registry + Duplicate Check

Цель: создать единый архив объектов и прекратить повторное закрепление одного объекта.

Функции MVP:
1. Создать объект вручную или из Make Photo From Platform.
2. Ввести ссылку, телефон, имя собственника, адрес и кадастр.
3. Проверить точные дубли.
4. Показать существующий объект и ответственного агента.
5. Закрепить новый объект за агентом.
6. Записать действие в журнал.
7. Отправить уведомление в Telegram-топик Make Photo From Platform.
8. Показать объект в CRM и в профиле агента.

### Не входит в первый этап
- парсер MyHome/SS;
- AI-сравнение фото;
- водяной знак;
- полная публикация;
- договоры;
- аналитика.

## 10. Критерий готовности первого этапа

- один объект нельзя закрепить дважды по ссылке, кадастру или телефону+адресу;
- объект сохраняется навсегда, включая архив;
- видно, кто и когда его добавил;
- агент видит свои закреплённые объекты;
- Telegram получает уведомление;
- все действия фиксируются.
