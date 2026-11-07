/**
 * Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
 *
 * Внутренняя аналитика сайта hge.ge. Без Google Analytics и чужих сервисов:
 * события пишутся в эту Google Таблицу, отчёт видят только админы CRM.
 *
 *  POST (с сайта)                       — пачка анонимных событий
 *  GET ?action=report&token=..&days=7   — отчёт для CRM (только админы, вход через Telegram)
 *  GET ?action=ping                     — проверка, что скрипт работает
 *
 * Свойства скрипта (Настройки проекта → Свойства скрипта):
 *  SESSION_SECRET   — тот же, что в проекте «CRM Auth» (проверка входа в CRM)
 *  ADMINS           — Telegram ID или username админов через запятую
 *  BOT_TOKEN        — ключ бота для еженедельной сводки (необязательно)
 *  REPORT_CHAT_IDS  — кому слать сводку: chat id через запятую (необязательно)
 *  RETENTION_DAYS   — сколько дней хранить события (по умолчанию 400)
 *
 * Установка: запустить setup() один раз — создаст лист и расписание сводки.
 */

var SHEET = 'Events';
var HEADER = ['time', 'visitor', 'session', 'type', 'path', 'listing', 'service', 'agent',
  'source', 'medium', 'campaign', 'lang', 'theme', 'device', 'new', 'data'];
var TYPES = ['pageview', 'listing', 'contact', 'share', 'fav', 'search', 'error', 'perf', 'social'];
var TZ = 'Asia/Tbilisi';

// ── Приём событий с сайта ────────────────────────────
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var rows = cleanEvents_(body.events || [], new Date());
    if (rows.length) {
      var lock = LockService.getScriptLock();
      lock.waitLock(15000);
      try {
        var sheet = sheet_();
        sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADER.length).setValues(rows);
      } finally {
        lock.releaseLock();
      }
    }
    return json_({ ok: true, n: rows.length });
  } catch (err) {
    return json_({ ok: false });
  }
}

// Only known event types and short values get in: the endpoint is public.
function cleanEvents_(events, now) {
  var s = function (v, n) { return String(v == null ? '' : v).slice(0, n || 120); };
  return (Array.isArray(events) ? events : []).slice(0, 50).filter(function (x) {
    return x && TYPES.indexOf(x.t) !== -1;
  }).map(function (x) {
    var data = '';
    try { data = x.x ? JSON.stringify(x.x).slice(0, 600) : ''; } catch (e) { data = ''; }
    return [now, s(x.v, 40), s(x.s, 40), x.t, s(x.p, 200), s(x.l, 40), s(x.sv, 30), s(x.ag, 60),
      s(x.src, 40), s(x.med, 40), s(x.cmp, 80), s(x.lang, 5), s(x.th, 6), s(x.dev, 8), x.nw ? 1 : 0, data];
  });
}

// ── Отчёт для CRM ────────────────────────────────────
function doGet(e) {
  var p = (e && e.parameter) || {};
  var result;
  try {
    if (p.action === 'ping') result = { ok: true };
    else if (p.action === 'report') {
      var who = verifyToken_(p.token);
      if (!who) result = { ok: false, error: 'bad_session' };
      else if (!isAdmin_(who)) result = { ok: false, error: 'not_admin' };
      else result = { ok: true, report: report_(Number(p.days) || 7) };
    } else result = { ok: false, error: 'unknown_action' };
  } catch (err) {
    result = { ok: false, error: String(err && err.message || err) };
  }
  var cb = String(p.callback || '').replace(/[^\w$.]/g, '');
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + JSON.stringify(result) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(result);
}

function report_(days) {
  days = Math.max(1, Math.min(365, days));
  var now = Date.now();
  var from = now - days * 864e5;
  var prevFrom = from - days * 864e5;
  var values = sheet_().getDataRange().getValues();
  return aggregate_(values.slice(1), { from: from, to: now, prevFrom: prevFrom, days: days, tz: TZ });
}

/**
 * The whole report from raw rows. Pure: no Google services, so it can be tested anywhere.
 * opts: { from, to, prevFrom, days, tz }
 */
function aggregate_(rows, opts) {
  var C = {}; HEADER.forEach(function (h, i) { C[h] = i; });
  var cur = [], prev = [];
  rows.forEach(function (r) {
    var t = r[C.time] instanceof Date ? r[C.time].getTime() : Date.parse(r[C.time]);
    if (!t) return;
    if (t >= opts.from && t <= opts.to) cur.push({ r: r, t: t });
    else if (t >= opts.prevFrom && t < opts.from) prev.push({ r: r, t: t });
  });
  var get = function (e, k) { return e.r[C[k]]; };
  var data = function (e) { try { return JSON.parse(get(e, 'data') || '{}') || {}; } catch (x) { return {}; } };
  var inc = function (o, k, n) { if (k === '' || k == null) k = '—'; o[k] = (o[k] || 0) + (n || 1); };
  var top = function (o, n) {
    return Object.keys(o).map(function (k) { return { name: k, n: o[k] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, n || 20);
  };
  var pct = function (a, b) { return b ? Math.round(a / b * 1000) / 10 : 0; };

  function totals(list) {
    var v = {}, nv = {}, s = {}, cs = {}, pv = 0, lv = 0, c = 0, sh = 0, fv = 0;
    list.forEach(function (e) {
      var type = get(e, 'type');
      v[get(e, 'visitor')] = 1; s[get(e, 'session')] = 1;
      if (get(e, 'new')) nv[get(e, 'visitor')] = 1;
      if (type === 'pageview') pv++;
      if (type === 'listing') lv++;
      if (type === 'contact') { c++; cs[get(e, 'session')] = 1; }
      if (type === 'share') sh++;
      if (type === 'fav' && data(e).on) fv++;
    });
    var sessions = Object.keys(s).length;
    return {
      visitors: Object.keys(v).length, newVisitors: Object.keys(nv).length, sessions: sessions,
      pageviews: pv, listingViews: lv, contacts: c, contactSessions: Object.keys(cs).length,
      conversion: pct(Object.keys(cs).length, sessions), shares: sh, favs: fv,
    };
  }

  // Days in the visitor's time zone.
  var dayKey = function (t) {
    return Utilities_formatDate_(new Date(t), opts.tz || 'Asia/Tbilisi');
  };
  var daily = {};
  for (var d = opts.from; d <= opts.to + 1; d += 864e5) daily[dayKey(d)] = { d: dayKey(d), visitors: {}, sessions: {}, contacts: 0, views: 0 };
  cur.forEach(function (e) {
    var k = dayKey(e.t); var x = daily[k];
    if (!x) x = daily[k] = { d: k, visitors: {}, sessions: {}, contacts: 0, views: 0 };
    x.visitors[get(e, 'visitor')] = 1; x.sessions[get(e, 'session')] = 1;
    if (get(e, 'type') === 'contact') x.contacts++;
    if (get(e, 'type') === 'listing') x.views++;
  });
  var dailyList = Object.keys(daily).sort().map(function (k) {
    var x = daily[k];
    return { d: k, visitors: Object.keys(x.visitors).length, sessions: Object.keys(x.sessions).length, contacts: x.contacts, views: x.views };
  });

  // Sessions by source and campaign; a session counts once, with its first source.
  var sess = {};
  cur.forEach(function (e) {
    var id = get(e, 'session');
    var x = sess[id] || (sess[id] = { src: get(e, 'source') || 'direct', med: get(e, 'medium'), cmp: get(e, 'campaign'), contact: false, dev: get(e, 'device') });
    if (get(e, 'type') === 'contact') x.contact = true;
  });
  var src = {}, cmp = {};
  Object.keys(sess).forEach(function (id) {
    var x = sess[id];
    var a = src[x.src] || (src[x.src] = { name: x.src, sessions: 0, contacts: 0 });
    a.sessions++; if (x.contact) a.contacts++;
    if (x.cmp || x.med) {
      var key = x.src + ' · ' + (x.cmp || x.med);
      var b = cmp[key] || (cmp[key] = { name: x.cmp || x.med, source: x.src, sessions: 0, contacts: 0 });
      b.sessions++; if (x.contact) b.contacts++;
    }
  });
  var withConv = function (o) {
    return Object.keys(o).map(function (k) { var x = o[k]; x.conversion = pct(x.contacts, x.sessions); return x; })
      .sort(function (a, b) { return b.sessions - a.sessions; });
  };

  // Listings: views, distinct viewers, contacts.
  var L = {};
  var listing = function (e) {
    var id = get(e, 'listing'); if (!id) return null;
    return L[id] || (L[id] = { id: id, service: get(e, 'service'), agent: get(e, 'agent'), views: 0, viewers: {}, contacts: 0, shares: 0, favs: 0 });
  };
  var contactsBy = {}, sharesBy = {}, socialBy = {}, devices = {}, langs = {}, themes = {}, agents = {};
  var searches = {}, zero = {}, errors = {}, loads = [], lcps = [], loadsBy = {};
  var devSeen = {};
  cur.forEach(function (e) {
    var type = get(e, 'type'), x = data(e), l;
    if (!devSeen[get(e, 'session')]) {
      devSeen[get(e, 'session')] = 1;
      inc(devices, get(e, 'device')); inc(langs, get(e, 'lang')); inc(themes, get(e, 'theme'));
    }
    if (type === 'listing' && (l = listing(e))) { l.views++; l.viewers[get(e, 'visitor')] = 1; }
    if (type === 'contact') { inc(contactsBy, x.ch); if ((l = listing(e))) l.contacts++; }
    if (type === 'social') inc(socialBy, x.ch);
    if (type === 'share') { inc(sharesBy, x.ch); if ((l = listing(e))) l.shares++; }
    if (type === 'fav' && x.on && (l = listing(e))) l.favs++;
    if (type === 'search') {
      var key = searchKey_(get(e, 'service'), x.q);
      inc(searches, key);
      if (Number(x.n) === 0) inc(zero, key);
    }
    if (type === 'error') {
      var m = String(x.msg || '').slice(0, 140);
      var er = errors[m] || (errors[m] = { name: m, n: 0, sessions: {}, page: get(e, 'path'), device: get(e, 'device'), last: 0 });
      er.n++; er.sessions[get(e, 'session')] = 1; er.last = Math.max(er.last, e.t);
    }
    if (type === 'perf') {
      if (x.load > 0 && x.load < 120000) { loads.push(x.load); (loadsBy[get(e, 'device')] = loadsBy[get(e, 'device')] || []).push(x.load); }
      if (x.lcp > 0 && x.lcp < 120000) lcps.push(x.lcp);
    }
  });
  var listings = Object.keys(L).map(function (k) {
    var x = L[k]; x.viewers = Object.keys(x.viewers).length; x.conversion = pct(x.contacts, x.viewers); return x;
  });
  listings.forEach(function (x) {
    var a = agents[x.agent || '—'] || (agents[x.agent || '—'] = { name: x.agent || '—', listings: 0, views: 0, contacts: 0 });
    a.listings++; a.views += x.views; a.contacts += x.contacts;
  });
  var agentList = Object.keys(agents).map(function (k) { var a = agents[k]; a.conversion = pct(a.contacts, a.views); return a; })
    .sort(function (a, b) { return b.contacts - a.contacts || b.views - a.views; });

  var q = function (arr, p) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]);
  };
  var perfBy = {};
  Object.keys(loadsBy).forEach(function (k) { perfBy[k] = { median: q(loadsBy[k], .5), p75: q(loadsBy[k], .75), n: loadsBy[k].length }; });

  return {
    period: { from: opts.from, to: opts.to, days: opts.days },
    totals: totals(cur),
    prev: totals(prev),
    daily: dailyList,
    contactsBy: contactsBy,
    sources: withConv(src),
    campaigns: withConv(cmp).slice(0, 30),
    listings: listings.slice().sort(function (a, b) { return b.views - a.views || b.contacts - a.contacts; }).slice(0, 40),
    bestListings: listings.filter(function (x) { return x.contacts > 0; })
      .sort(function (a, b) { return b.contacts - a.contacts || b.conversion - a.conversion; }).slice(0, 15),
    noResponse: listings.filter(function (x) { return x.contacts === 0 && x.viewers >= 5; })
      .sort(function (a, b) { return b.viewers - a.viewers; }).slice(0, 30),
    agents: agentList,
    searches: top(searches, 25),
    zeroSearches: top(zero, 25),
    sharesBy: sharesBy,
    socialBy: socialBy,
    devices: devices, langs: langs, themes: themes,
    errors: Object.keys(errors).map(function (k) { var x = errors[k]; x.sessions = Object.keys(x.sessions).length; return x; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 20),
    perf: { loadMedian: q(loads, .5), loadP75: q(loads, .75), lcpMedian: q(lcps, .5), lcpP75: q(lcps, .75), n: loads.length, byDevice: perfBy },
  };
}

// "rent · district=Vake · beds=2" — the same search reads the same in the report.
function searchKey_(service, q) {
  var parts = String(q || '').split('&').filter(function (x) { return x && x.indexOf('sort=') !== 0; }).sort();
  return [service || '—'].concat(parts.map(function (x) {
    try { return decodeURIComponent(x.replace(/\+/g, ' ')); } catch (e) { return x; }
  })).join(' · ');
}

// Kept separate so tests can replace it.
function Utilities_formatDate_(date, tz) {
  return Utilities.formatDate(date, tz, 'yyyy-MM-dd');
}

// ── Еженедельная сводка в Telegram ───────────────────
function weeklySummary() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BOT_TOKEN');
  var chats = String(props.getProperty('REPORT_CHAT_IDS') || '').split(',').map(function (x) { return x.trim(); }).filter(String);
  if (!token || !chats.length) return;
  var text = summaryText_(report_(7));
  chats.forEach(function (chat) {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ chat_id: chat, text: text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  });
}

function summaryText_(r) {
  var t = r.totals, p = r.prev;
  var diff = function (a, b) { if (!b) return ''; var d = Math.round((a - b) / b * 100); return ' (' + (d >= 0 ? '+' : '') + d + '%)'; };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var lines = [
    '<b>hge.ge за неделю</b>',
    'Посетители: <b>' + t.visitors + '</b>' + diff(t.visitors, p.visitors) + ', новых ' + t.newVisitors,
    'Обращения: <b>' + t.contacts + '</b>' + diff(t.contacts, p.contacts) + ', конверсия ' + t.conversion + '%',
    'Просмотры объявлений: ' + t.listingViews + diff(t.listingViews, p.listingViews),
  ];
  if (r.sources.length) lines.push('', '<b>Откуда</b>: ' + r.sources.slice(0, 4).map(function (s) { return esc(s.name) + ' ' + s.sessions; }).join(', '));
  if (r.bestListings.length) lines.push('', '<b>Больше всего обращений</b>', r.bestListings.slice(0, 3).map(function (x) {
    return '• ' + esc(x.id) + ' — ' + x.contacts + ' обр., ' + x.viewers + ' смотрели';
  }).join('\n'));
  if (r.noResponse.length) lines.push('', '<b>Смотрят, но не пишут</b>', r.noResponse.slice(0, 3).map(function (x) {
    return '• ' + esc(x.id) + ' — ' + x.viewers + ' смотрели, 0 обращений';
  }).join('\n'));
  if (r.zeroSearches.length) lines.push('', '<b>Искали и не нашли</b>', r.zeroSearches.slice(0, 3).map(function (x) {
    return '• ' + esc(x.name) + ' — ' + x.n;
  }).join('\n'));
  if (r.errors.length) lines.push('', 'Ошибок на сайте: ' + r.errors.reduce(function (a, x) { return a + x.n; }, 0));
  lines.push('', 'Подробно — в CRM → Управление → Аналитика сайта');
  return lines.join('\n');
}

// ── Установка и уборка ───────────────────────────────
function setup() {
  sheet_();
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('weeklySummary').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(10).inTimezone(TZ).create();
  ScriptApp.newTrigger('cleanup').timeBased().everyDays(1).atHour(4).inTimezone(TZ).create();
}

// Old events are removed so the table stays fast.
function cleanup() {
  var keep = Number(PropertiesService.getScriptProperties().getProperty('RETENTION_DAYS')) || 400;
  var limit = Date.now() - keep * 864e5;
  var sheet = sheet_();
  var times = sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 1).getValues();
  var old = 0;
  while (old < times.length && times[old][0] instanceof Date && times[old][0].getTime() < limit) old++;
  if (old > 0) sheet.deleteRows(2, old);
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET);
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ── Вход: та же подписанная сессия, что у CRM Auth ───
function isAdmin_(who) {
  var list = String(PropertiesService.getScriptProperties().getProperty('ADMINS') || '')
    .split(',').map(function (x) { return x.replace(/^@/, '').trim().toLowerCase(); }).filter(String);
  return list.indexOf(String(who.id)) !== -1 || list.indexOf(String(who.u || '').toLowerCase()) !== -1;
}

function verifyToken_(token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  var secret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET');
  if (!secret) throw new Error('SESSION_SECRET is not set');
  var expected = hex_(Utilities.computeHmacSha256Signature(parts[0], secret));
  if (!safeEqual_(expected, parts[1])) return null;
  try {
    var payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
    return payload.exp > Date.now() ? payload : null;
  } catch (e) {
    return null;
  }
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

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
