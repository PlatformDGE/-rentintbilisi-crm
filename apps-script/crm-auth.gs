/**
 * CRM Auth — вход агентов в веб-CRM через Telegram (отдельный Apps Script).
 *
 * Это ОТДЕЛЬНЫЙ проект Apps Script: основной скрипт CRM и @real_estating_bot
 * он не трогает. Белый список = листы «Агенты» и «Рекруты» основной таблицы,
 * куда админ добавляет людей через админ-панель CRM.
 *
 * Настройка (один раз):
 *  1. script.google.com → Новый проект → вставить этот файл.
 *  2. Настройки проекта → Свойства скрипта:
 *       LOGIN_BOT_TOKEN  — токен технического бота для входа (из @BotFather)
 *       SESSION_SECRET   — любая длинная случайная строка (40+ символов)
 *  3. Развернуть → Новое развертывание → Веб-приложение:
 *       Выполнять от имени: меня; Доступ: все.
 *  4. URL развертывания вписать в CRM_AUTH_URL в index.html.
 *
 * Действия (JSONP, параметр callback):
 *  ?action=tgLogin&id=..&username=..&auth_date=..&hash=..  — вход по данным Telegram Login Widget
 *  ?action=session&token=..                                 — проверка сохранённой сессии
 *  ?action=register&token=..&phone=..&birth=YYYY-MM-DD      — регистрация / обновление профиля
 */

var SPREADSHEET_ID = '1M7kg2FgI8eke8_Iy4NofsKzC3NrKetLl3dniKJRxYrU';
var AGENTS_GID = 623976749;
var RECRUITS_GID = 1404574561;
var ACCOUNTS_SHEET = 'Agent_Accounts';
var ACCOUNTS_HEADER = ['tg_id', 'telegram', 'name', 'role', 'phone', 'birth_date', 'registered_at', 'last_login_at'];
var SESSION_DAYS = 30;
var AUTH_MAX_AGE_SEC = 24 * 60 * 60;

function doGet(e) {
  var p = (e && e.parameter) || {};
  var result;
  try {
    if (p.action === 'tgLogin') result = tgLogin_(p);
    else if (p.action === 'session') result = checkSession_(p.token);
    else if (p.action === 'register') result = register_(p);
    else result = { ok: false, error: 'unknown_action' };
  } catch (err) {
    console.error(err);
    result = { ok: false, error: 'server_error' };
  }
  return respond_(result, p.callback);
}

function respond_(obj, callback) {
  var json = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][\w$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ── Telegram Login Widget ───────────────────────────
// https://core.telegram.org/widgets/login#checking-authorization
function tgLogin_(p) {
  var botToken = prop_('LOGIN_BOT_TOKEN');
  var fields = ['auth_date', 'first_name', 'id', 'last_name', 'photo_url', 'username'];
  var check = fields.filter(function (k) { return p[k] !== undefined && p[k] !== ''; })
    .map(function (k) { return k + '=' + p[k]; }).join('\n');
  var secret = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, botToken, Utilities.Charset.UTF_8);
  var sig = Utilities.computeHmacSha256Signature(Utilities.newBlob(check).getBytes(), secret);
  if (!safeEqual_(hex_(sig), String(p.hash || '').toLowerCase())) return { ok: false, error: 'bad_signature' };
  if (Math.floor(Date.now() / 1000) - Number(p.auth_date) > AUTH_MAX_AGE_SEC) return { ok: false, error: 'expired' };

  var member = findMember_(p.username);
  if (!member) return { ok: false, error: 'not_whitelisted' };
  if (member.active === false) return { ok: false, error: 'inactive' };

  var account = upsertAccount_(String(p.id), member, { last_login_at: new Date() });
  var token = signToken_({ id: String(p.id), u: normalize_(p.username), exp: Date.now() + SESSION_DAYS * 864e5 });
  return profile_(member, account, token, p.photo_url);
}

function checkSession_(token) {
  var s = verifyToken_(token);
  if (!s) return { ok: false, error: 'bad_session' };
  var member = findMember_(s.u);
  if (!member || member.active === false) return { ok: false, error: 'not_whitelisted' };
  return profile_(member, findAccount_(s.id), token);
}

function register_(p) {
  var s = verifyToken_(p.token);
  if (!s) return { ok: false, error: 'bad_session' };
  var member = findMember_(s.u);
  if (!member || member.active === false) return { ok: false, error: 'not_whitelisted' };
  var phone = String(p.phone || '').replace(/[^\d+]/g, '');
  var birth = String(p.birth || '');
  if (phone.replace(/\D/g, '').length < 9) return { ok: false, error: 'bad_phone' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return { ok: false, error: 'bad_birth' };
  var existing = findAccount_(s.id);
  var account = upsertAccount_(s.id, member, {
    phone: phone,
    birth_date: birth,
    registered_at: existing && existing.registered_at ? existing.registered_at : new Date()
  });
  return profile_(member, account, p.token);
}

function profile_(member, account, token, photo) {
  account = account || {};
  return {
    ok: true,
    token: token,
    registered: !!(account.phone && account.birth_date),
    user: {
      name: member.name,
      telegram: '@' + member.username,
      role: member.role,
      level: member.level || '',
      phone: account.phone || '',
      birth_date: account.birth_date || '',
      photo_url: photo || ''
    }
  };
}

// ── Белый список (листы Агенты / Рекруты) ───────────
function findMember_(username) {
  var u = normalize_(username);
  if (!u) return null;
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var lists = [['agent', AGENTS_GID], ['recruit', RECRUITS_GID]];
  for (var i = 0; i < lists.length; i++) {
    var sheet = sheetByGid_(ss, lists[i][1]);
    if (!sheet) continue;
    var rows = sheet.getDataRange().getDisplayValues();
    if (rows.length < 2) continue;
    var col = columns_(rows[0]);
    if (col.telegram < 0) continue;
    for (var r = 1; r < rows.length; r++) {
      if (normalize_(rows[r][col.telegram]) !== u) continue;
      var activeRaw = col.active >= 0 ? String(rows[r][col.active]).trim().toLowerCase() : '';
      return {
        role: lists[i][0],
        username: u,
        name: col.name >= 0 ? String(rows[r][col.name]).trim() : u,
        level: col.level >= 0 ? String(rows[r][col.level]).trim() : '',
        active: ['false', 'нет', '0', 'no'].indexOf(activeRaw) === -1
      };
    }
  }
  return null;
}

function columns_(header) {
  function find(re) {
    for (var i = 0; i < header.length; i++) if (re.test(String(header[i]))) return i;
    return -1;
  }
  return {
    telegram: find(/telegram|^tg|телеграм/i),
    name: find(/^name$|^имя|^(agent|recruit)_?name$/i),
    active: find(/active|актив/i),
    level: find(/level|уров/i)
  };
}

function sheetByGid_(ss, gid) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) if (sheets[i].getSheetId() === gid) return sheets[i];
  return null;
}

// ── Лист Agent_Accounts (регистрация по tg_id) ──────
function accountsSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(ACCOUNTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ACCOUNTS_SHEET);
    sheet.appendRow(ACCOUNTS_HEADER);
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('@');
    sheet.getRange('E:F').setNumberFormat('@');
  }
  return sheet;
}

function findAccount_(tgId) {
  var rows = accountsSheet_().getDataRange().getDisplayValues();
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][0]) === String(tgId)) {
      var obj = { row: r + 1 };
      ACCOUNTS_HEADER.forEach(function (h, i) { obj[h] = rows[r][i]; });
      return obj;
    }
  }
  return null;
}

function upsertAccount_(tgId, member, patch) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = accountsSheet_();
    var acc = findAccount_(tgId) || {};
    var merged = {};
    ACCOUNTS_HEADER.forEach(function (h) { merged[h] = acc[h] || ''; });
    merged.tg_id = String(tgId);
    merged.telegram = '@' + member.username;
    merged.name = member.name;
    merged.role = member.role;
    Object.keys(patch).forEach(function (k) { merged[k] = patch[k]; });
    var values = [ACCOUNTS_HEADER.map(function (h) { return merged[h]; })];
    if (acc.row) sheet.getRange(acc.row, 1, 1, ACCOUNTS_HEADER.length).setValues(values);
    else sheet.appendRow(values[0]);
    return merged;
  } finally {
    lock.releaseLock();
  }
}

// ── Подписанная сессия ──────────────────────────────
function signToken_(payload) {
  var body = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  return body + '.' + hex_(Utilities.computeHmacSha256Signature(body, prop_('SESSION_SECRET')));
}

function verifyToken_(token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  var expected = hex_(Utilities.computeHmacSha256Signature(parts[0], prop_('SESSION_SECRET')));
  if (!safeEqual_(expected, parts[1])) return null;
  try {
    var payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
    return payload.exp > Date.now() ? payload : null;
  } catch (e) {
    return null;
  }
}

// ── Утилиты ─────────────────────────────────────────
function prop_(key) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Script property ' + key + ' is not set');
  return v;
}

function normalize_(v) {
  return String(v || '').replace(/^@/, '').trim().toLowerCase();
}

function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
