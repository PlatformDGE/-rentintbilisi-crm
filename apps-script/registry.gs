/**
 * Реестр объектов Homes in Georgia — Google Таблица с единым ID объекта (HIG-0001…).
 *
 * Это ОТДЕЛЬНАЯ закрытая таблица (не основная таблица CRM: та открыта по ссылке
 * для чтения CSV, а здесь будут телефоны собственников). Основной Apps Script CRM,
 * @real_estating_bot и постгенератор этот скрипт не трогает.
 *
 * Откуда данные: GitHub Actions каждый час собирает объекты из каналов
 * (scripts/build_object_registry.py) и публикует site/data/registry.json.
 * Этот скрипт раз в час забирает файл и обновляет лист «Объекты».
 *
 * Настройка (один раз):
 *  1. Создать новую Google Таблицу «Реестр объектов HiG».
 *  2. Расширения → Apps Script → вставить этот файл вместо пустого кода → Сохранить.
 *  3. Выбрать функцию setupRegistry → Выполнить → разрешить доступ.
 *     Скрипт создаст лист «Объекты», зальёт объекты и включит обновление раз в час.
 *  4. Дальше: меню «Реестр» в таблице → «Обновить из каналов» для ручного обновления.
 *
 * Что заполняет скрипт, а что вы:
 *  - колонки из постов (район, цена, агент, ссылка…) обновляются автоматически;
 *  - «Собственник», «Телефон собственника», «Заметки» скрипт никогда не меняет;
 *  - «Статус» скрипт ставит сам (Свободен / Архив), но если вы поставили
 *    Занят, Сдан, Продан или Снят, ваш статус сохраняется;
 *  - объект не из канала: новая строка без ID, при обновлении получит ID вида HIG-M001.
 */

var REGISTRY_URL = 'https://platformdge.github.io/-rentintbilisi-crm/site/data/registry.json';
var SITE_URL = 'https://platformdge.github.io/-rentintbilisi-crm/site/';
var SHEET_NAME = 'Объекты';
var MANUAL_ID_PREFIX = 'HIG-M';
var AUTO_STATUSES = ['Свободен', 'Архив'];
var MANUAL_STATUSES = ['Занят', 'Сдан', 'Продан', 'Снят'];
var SERVICES = ['Аренда', 'Продажа', 'Новостройка', 'Коммерция', 'Посуточно', 'Авто аренда', 'Авто продажа'];

// [заголовок, поле в registry.json или null для колонок, которые ведут люди, ширина]
var COLUMNS = [
  ['ID', 'id', 90],
  ['Сервис', 'service_ru', 100],
  ['Тип', 'kind_ru', 90],
  ['Район', 'district', 110],
  ['Метро', 'metro', 120],
  ['Адрес', 'address', 220],
  ['Комнаты', 'rooms', 70],
  ['Площадь, м²', 'area', 80],
  ['Этаж', 'floor', 60],
  ['Цена', 'price', 80],
  ['Валюта', 'currency', 60],
  ['Цена, $', 'price_usd', 80],
  ['Статус', 'status', 95],
  ['Агент', 'agent', 100],
  ['Контакт в посте', 'agent_contact', 200],
  ['Собственник', null, 140],
  ['Телефон собственника', null, 140],
  ['Эксклюзив', 'exclusive', 75],
  ['Пост в Telegram', 'post_url', 220],
  ['Фото', 'photo', 200],
  ['Постов', 'posts', 60],
  ['Добавлен', 'first_published', 110],
  ['Обновлён', 'last_published', 110],
  ['Заметки', null, 240]
];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Реестр')
    .addItem('Обновить из каналов', 'syncRegistry')
    .addItem('Настроить заново', 'setupRegistry')
    .addToUi();
}

function setupRegistry() {
  var sheet = registrySheet_();
  var headers = COLUMNS.map(function (c) { return c[0]; });
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#1f3a68').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  COLUMNS.forEach(function (c, i) { sheet.setColumnWidth(i + 1, c[2]); });

  var rows = sheet.getMaxRows() - 1;
  setDropdown_(sheet, colIndex_('Статус'), AUTO_STATUSES.concat(MANUAL_STATUSES), rows);
  setDropdown_(sheet, colIndex_('Сервис'), SERVICES, rows);
  sheet.getRange(2, colIndex_('Добавлен'), rows, 2).setNumberFormat('dd.MM.yyyy HH:mm');

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncRegistry') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncRegistry').timeBased().everyHours(1).create();

  syncRegistry();
}

function syncRegistry() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var response = UrlFetchApp.fetch(REGISTRY_URL + '?t=' + Date.now(), { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) throw new Error('registry.json: HTTP ' + response.getResponseCode());
    var objects = JSON.parse(response.getContentText()).objects || [];

    var sheet = registrySheet_();
    var width = COLUMNS.length;
    var last = sheet.getLastRow();
    var rows = last > 1 ? sheet.getRange(2, 1, last - 1, width).getValues() : [];
    var byId = {};
    rows.forEach(function (row, i) { if (row[0]) byId[String(row[0])] = i; });

    var statusCol = colIndex_('Статус') - 1;
    var added = 0, updated = 0;
    objects.forEach(function (obj) {
      var fresh = toRow_(obj);
      if (byId.hasOwnProperty(obj.id)) {
        var row = rows[byId[obj.id]];
        var keepStatus = MANUAL_STATUSES.indexOf(String(row[statusCol])) !== -1;
        COLUMNS.forEach(function (c, i) {
          if (!c[1]) return;                       // колонки, которые ведут люди
          if (i === statusCol && keepStatus) return; // ручной статус важнее
          row[i] = fresh[i];
        });
        updated++;
      } else {
        rows.push(fresh);
        byId[obj.id] = rows.length - 1;
        added++;
      }
    });

    assignManualIds_(rows);
    rows.sort(function (a, b) {
      return dateValue_(b[colIndex_('Обновлён') - 1]) - dateValue_(a[colIndex_('Обновлён') - 1]);
    });
    if (rows.length) {
      if (sheet.getMaxRows() < rows.length + 1) sheet.insertRowsAfter(sheet.getMaxRows(), rows.length + 1 - sheet.getMaxRows());
      sheet.getRange(2, 1, rows.length, width).setValues(rows);
      setDropdown_(sheet, colIndex_('Статус'), AUTO_STATUSES.concat(MANUAL_STATUSES), rows.length);
      setDropdown_(sheet, colIndex_('Сервис'), SERVICES, rows.length);
    }
    if (!sheet.getFilter()) sheet.getRange(1, 1, Math.max(rows.length, 1) + 1, width).createFilter();
    SpreadsheetApp.getActive().toast('Новых: ' + added + ', обновлено: ' + updated, 'Реестр объектов', 5);
  } finally {
    lock.releaseLock();
  }
}

function toRow_(obj) {
  return COLUMNS.map(function (c) {
    var key = c[1];
    if (!key) return '';
    var value = obj[key];
    if (value === undefined || value === null) return '';
    if (key === 'first_published' || key === 'last_published') return new Date(value);
    if (key === 'photo') return SITE_URL + value;
    if (key === 'exclusive') return value ? 'Да' : '';
    return value;
  });
}

// Объекты, добавленные вручную без ID, получают HIG-M001, HIG-M002…
// Отдельная серия, чтобы не пересечься с ID из каналов.
function assignManualIds_(rows) {
  var max = 0;
  rows.forEach(function (row) {
    var m = String(row[0]).match(/^HIG-M(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  rows.forEach(function (row) {
    var filled = row.slice(1).some(function (v) { return v !== '' && v !== null; });
    if (!row[0] && filled) {
      max++;
      row[0] = MANUAL_ID_PREFIX + ('00' + max).slice(-3);
      if (!row[colIndex_('Статус') - 1]) row[colIndex_('Статус') - 1] = 'Свободен';
      if (!row[colIndex_('Добавлен') - 1]) row[colIndex_('Добавлен') - 1] = new Date();
      if (!row[colIndex_('Обновлён') - 1]) row[colIndex_('Обновлён') - 1] = new Date();
    }
  });
}

function registrySheet_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets().length === 1 && ss.getSheets()[0].getLastRow() === 0
      ? ss.getSheets()[0].setName(SHEET_NAME)
      : ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getMaxColumns() < COLUMNS.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), COLUMNS.length - sheet.getMaxColumns());
  return sheet;
}

function setDropdown_(sheet, col, values, rows) {
  if (rows < 1) return;
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
  sheet.getRange(2, col, rows, 1).setDataValidation(rule);
}

function colIndex_(header) {
  for (var i = 0; i < COLUMNS.length; i++) if (COLUMNS[i][0] === header) return i + 1;
  throw new Error('Нет колонки ' + header);
}

function dateValue_(value) {
  return value instanceof Date ? value.getTime() : 0;
}
