# Codex Task 01 — Object Registry + Duplicate Check

Работай в существующем проекте `crm-molecula-rent-in-tbilisi`.

## Ограничения
- Не переделывай дизайн всего проекта.
- Не удаляй существующие модули.
- Не делай MyHome/SS центральной частью системы.
- Make Photo From Platform — один из способов создания объекта.
- Сначала изучи текущие типы, repository, backend blueprint и Prisma schema.
- До изменений создай короткий `IMPLEMENTATION_PLAN.md`.

## Цель
Создать первый реальный модуль единой платформы: реестр объектов с проверкой дублей и закреплением за агентом.

## Функции

### 1. Реестр объектов
Добавь экран `Objects`:
- поиск;
- фильтры по статусу, агенту, району и источнику;
- карточка объекта;
- архивные объекты также участвуют в проверке дублей.

### 2. Создание объекта
Форма:
- source_type: direct, myhome, ss, referral, import, other;
- source_url;
- owner_name;
- owner_phone;
- address;
- district;
- cadastral_code;
- price;
- rooms;
- area;
- assigned_agent_id;
- notes.

### 3. Проверка дублей
Перед сохранением проверяй:
- нормализованный source_url;
- source_external_id, если можно извлечь;
- cadastral_code;
- normalized phone + normalized address.

Если найден дубликат:
- не создавай объект автоматически;
- покажи существующую карточку;
- покажи агента, статус и дату добавления;
- добавь действие `duplicate_detected` в action log.

### 4. Закрепление
Если дублей нет:
- создать объект;
- статус `ASSIGNED`;
- закрепить за агентом;
- создать задачу `MAKE_PHOTO`;
- добавить action log.

### 5. Make Photo From Platform
Существующий модуль должен использовать общий сервис создания объекта, а не отдельную локальную логику.

### 6. Repository
Сделай интерфейс repository, чтобы текущий demo/local implementation можно было позже заменить API без переписывания UI.

Методы:
- listProperties
- getProperty
- createProperty
- updateProperty
- archiveProperty
- findDuplicates
- assignProperty
- listAgentProperties
- createTask
- appendActionLog

### 7. Тесты
Добавь unit tests для:
- normalizePhone;
- normalizeUrl;
- normalizeAddress;
- extractExternalId;
- exact duplicate by URL;
- exact duplicate by cadastral;
- duplicate by phone + address;
- архивный объект считается дубликатом.

## Результат
После работы покажи:
1. изменённые файлы;
2. что реализовано;
3. что осталось заглушкой;
4. как проверить вручную;
5. команды тестов и сборки.

Не подключай Telegram Bot API в этой задаче. Создай интерфейс `TelegramNotifier` и mock-реализацию, чтобы реальная интеграция была следующим этапом.
