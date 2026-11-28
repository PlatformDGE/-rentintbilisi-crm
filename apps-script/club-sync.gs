/**
 * Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
 *
 * Общий приёмник клуба Cars Rent in Tbilisi (hge.ge/club/).
 * Регистрации водителей и брони со всех устройств пишутся в эту Google Таблицу,
 * оператор получает уведомление в Telegram, а админка модуля загружает отсюда
 * всех водителей и брони по ключу.
 *
 *  POST (с сайта)                 — {collection: 'clients'|'bookings', record: {...}}
 *  GET ?action=club&key=..        — все водители и брони для админки (JSONP: &callback=)
 *  GET ?action=ping               — проверка, что скрипт работает
 *
 * Свойства скрипта (Настройки проекта → Свойства скрипта):
 *  ADMIN_KEY        — ключ для админки модуля, 16+ символов (обязательно)
 *  BOT_TOKEN        — ключ Telegram-бота для уведомлений (необязательно)
 *  CLUB_CHAT_IDS    — кому слать уведомления: chat id через запятую (необязательно)
 *
 * Установка:
 *  1. script.google.com → Новый проект → вставить этот файл.
 *  2. Запустить setup() один раз — создаст таблицу «Cars Rent Club» с листами
 *     Drivers и Bookings. Ссылка на таблицу будет в журнале.
 *  3. Задать свойства скрипта (см. выше).
 *  4. Развернуть → Новое развёртывание → Веб-приложение, «Выполнять от моего имени»,
 *     доступ «Все». Ссылку /exec вписать в site/club/js/sync.js (SYNC_URL).
 */

var SHEETS = {
  clients: { name: 'Drivers', header: ['id', 'createdAt', 'name', 'phone', 'email', 'birth', 'licenceSince', 'investor', 'educationPassed', 'updatedAt', 'data'] },
  bookings: { name: 'Bookings', header: ['id', 'createdAt', 'clientId', 'carId', 'planId', 'qty', 'insurance', 'delivery', 'start', 'end', 'status', 'total', 'deposit', 'paidAt', 'updatedAt', 'data'] },
};
var TZ = 'Asia/Tbilisi';

function setup() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var id = props.getProperty('SPREADSHEET_ID');
    ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('Cars Rent Club');
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }
  Object.keys(SHEETS).forEach(function (k) { sheet_(ss, k); });
  Logger.log('Таблица: ' + ss.getUrl());
}

function book_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
}

function sheet_(ss, kind) {
  var def = SHEETS[kind];
  var sh = ss.getSheetByName(def.name) || ss.insertSheet(def.name);
  if (sh.getLastRow() === 0) { sh.appendRow(def.header); sh.setFrozenRows(1); }
  return sh;
}

// ── Приём с сайта ────────────────────────────────────
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var kind = body.collection;
    var rec = body.record || {};
    if (!SHEETS[kind] || !rec.id || String(rec.id).length > 64) return json_({ ok: false });
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    var res;
    try { res = upsert_(kind, clean_(rec)); } finally { lock.releaseLock(); }
    notify_(kind, res.record, res.before);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// Keeps only plain short values so a visitor can't fill the sheet with junk.
function clean_(rec) {
  var out = {};
  Object.keys(rec).slice(0, 40).forEach(function (k) {
    var v = rec[k];
    if (v === null || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 300);
    else if (Array.isArray(v)) out[k] = v.slice(0, 10).map(function (x) { return String(x).slice(0, 40); });
    else if (typeof v === 'object' && JSON.stringify(v).length <= 500) out[k] = v;
  });
  return out;
}

function upsert_(kind, rec) {
  var def = SHEETS[kind];
  var sh = sheet_(book_(), kind);
  var ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var i = ids.indexOf(String(rec.id));
  var before = null;
  if (i >= 0) {
    before = JSON.parse(sh.getRange(i + 2, def.header.length).getValue() || '{}');
    rec = merge_(before, rec);
  }
  rec.updatedAt = new Date().toISOString();
  var row = def.header.map(function (h) { return h === 'data' ? JSON.stringify(rec) : (rec[h] == null ? '' : rec[h]); });
  if (i >= 0) sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
  return { record: rec, before: before };
}

function merge_(a, b) { var o = {}; Object.keys(a).forEach(function (k) { o[k] = a[k]; }); Object.keys(b).forEach(function (k) { o[k] = b[k]; }); return o; }

// ── Для админки ──────────────────────────────────────
function doGet(e) {
  var p = e.parameter || {};
  var result;
  if (p.action === 'ping') result = { ok: true };
  else if (p.action === 'club') {
    var key = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
    if (!key || key.length < 16 || p.key !== key) result = { ok: false, error: 'key' };
    else result = { ok: true, clients: all_('clients'), bookings: all_('bookings') };
  } else result = { ok: false, error: 'action' };
  var cb = String(p.callback || '').replace(/[^\w$.]/g, '');
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + JSON.stringify(result) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(result);
}

function all_(kind) {
  var sh = sheet_(book_(), kind);
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  var col = SHEETS[kind].header.length;
  return sh.getRange(2, col, n, 1).getValues().map(function (r) {
    try { return JSON.parse(r[0]); } catch (err) { return null; }
  }).filter(Boolean);
}

// ── Уведомления в Telegram ───────────────────────────
function notify_(kind, rec, before) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BOT_TOKEN');
  var chats = String(props.getProperty('CLUB_CHAT_IDS') || '').split(',').map(function (x) { return x.trim(); }).filter(String);
  if (!token || !chats.length) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var when = function (s) { return s ? Utilities.formatDate(new Date(s), TZ, 'dd.MM HH:mm') : ''; };
  var text = '';
  if (kind === 'clients' && !before) {
    text = '<b>Новый водитель в клубе</b>\n' + esc(rec.name) + '\n' + esc(rec.phone) + (rec.email ? '\n' + esc(rec.email) : '') +
      (rec.licenceSince ? '\nПрава с ' + esc(rec.licenceSince) : '');
  } else if (kind === 'bookings' && (!before || before.status !== rec.status)) {
    var label = { unpaid: 'Новая бронь (не оплачена)', paid: 'Бронь оплачена', cancelled: 'Бронь отменена' }[rec.status];
    if (!label) return;
    var client = all_('clients').filter(function (c) { return c.id === rec.clientId; })[0] || {};
    text = '<b>' + label + '</b>\n' + esc(rec.carTitle || rec.carId) + '\n' + when(rec.start) + ' → ' + when(rec.end) +
      '\nКлиент: ' + esc(client.name || rec.clientId) + (client.phone ? ', ' + esc(client.phone) : '') +
      '\nСумма: $' + esc(rec.total) + ', депозит $' + esc(rec.deposit);
  }
  if (!text) return;
  chats.forEach(function (chat) {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ chat_id: chat, text: text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
