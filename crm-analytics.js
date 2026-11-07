// Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
// CRM → Управление → Аналитика сайта. Reads the report of our own site analytics
// (apps-script/site-analytics.gs) with the admin's Telegram session. Admins only.
(function () {
  'use strict';

  // The same web app address as ANALYTICS_URL in site/assets/js/config.js.
  var ANALYTICS_URL = '';
  var SITE = 'https://hge.ge/';
  var SESSION_KEY = 'rent_crm_tg_session';

  var state = { days: 7, report: null, loading: false, error: '' };

  var SVC = { rent: 'Аренда', daily: 'Посуточно', sale: 'Продажа', 'new': 'Новостройки', commercial: 'Коммерция', 'car-rent': 'Аренда авто', 'car-sale': 'Продажа авто', all: 'Все' };
  var KEYS = { q: 'Поиск', district: 'Район', beds: 'Спальни', price: 'Цена', area: 'Площадь', kind: 'Тип', deal: 'Сделка', building: 'Дом', condition: 'Ремонт', amen: 'Удобства', metro: 'Метро', term: 'Срок', tenants: 'Жильцов', pets: 'С животными', excl: 'Эксклюзив', floor: 'Этаж', floors: 'Этажей', ppsqm: 'Цена за м²', deposit: 'Депозит', heating: 'Отопление', year: 'Год', mileage: 'Пробег', gearbox: 'Коробка', fuel: 'Топливо', body: 'Кузов', seats: 'Мест', pickup: 'Выдача', notfirst: 'Не первый этаж', notlast: 'Не последний этаж' };
  var CH = { phone: 'Звонок', whatsapp: 'WhatsApp', telegram: 'Telegram', office: 'Офис на карте', viber: 'Viber', facebook: 'Facebook', instagram: 'Instagram', copy: 'Скопировали ссылку', 'native': 'Меню телефона', link: 'Ссылка' };
  var SRC = { direct: 'Напрямую', share: 'Поделились ссылкой', google: 'Google', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', threads: 'Threads', telegram: 'Telegram', whatsapp: 'WhatsApp', viber: 'Viber', myhome: 'Myhome.ge', 'ss.ge': 'SS.ge', yandex: 'Яндекс', bing: 'Bing' };
  var DEV = { mobile: 'Телефон', tablet: 'Планшет', desktop: 'Компьютер' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  var num = function (n) { return Number(n || 0).toLocaleString('ru-RU'); };
  var label = function (map, k) { return map[k] || k; };
  var root = function () { return document.getElementById('tab-analytics'); };

  function session() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
  }

  function jsonp(params, done) {
    var cb = '__higA' + Date.now() + Math.floor(Math.random() * 1e4);
    var sc = document.createElement('script');
    var timer = setTimeout(function () { finish({ ok: false, error: 'timeout' }); }, 25000);
    function finish(res) {
      clearTimeout(timer);
      try { delete window[cb]; } catch (e) { window[cb] = undefined; }
      sc.remove();
      done(res);
    }
    window[cb] = finish;
    sc.onerror = function () { finish({ ok: false, error: 'network' }); };
    sc.src = ANALYTICS_URL + '?' + Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&') + '&callback=' + cb;
    document.head.appendChild(sc);
  }

  function load() {
    var s = session();
    state.loading = true; state.error = ''; render();
    if (!ANALYTICS_URL) { state.loading = false; state.error = 'setup'; return render(); }
    if (!s || !s.token) { state.loading = false; state.error = 'bad_session'; return render(); }
    jsonp({ action: 'report', token: s.token, days: state.days }, function (res) {
      state.loading = false;
      if (res && res.ok) state.report = res.report;
      else state.error = (res && res.error) || 'network';
      render();
    });
  }

  // ── pieces ─────────────────────────────────────────
  function change(a, b, invert) {
    if (!b) return '';
    var d = Math.round((a - b) / b * 100);
    if (!d) return '<small class="ha-ch">±0%</small>';
    var good = invert ? d < 0 : d > 0;
    return '<small class="ha-ch ' + (good ? 'up' : 'down') + '">' + (d > 0 ? '+' : '') + d + '%</small>';
  }
  function kpi(title, value, prev, suffix) {
    return '<div class="ha-kpi"><span>' + esc(title) + '</span><b>' + esc(value) + (suffix || '') + '</b>' + change(Number(value) || 0, Number(prev) || 0) + '</div>';
  }
  function card(title, body, note, wide) {
    return '<section class="ha-card' + (wide ? ' wide' : '') + '"><header><h3>' + esc(title) + '</h3>' + (note ? '<p>' + esc(note) + '</p>' : '') + '</header>' + body + '</section>';
  }
  function bars(obj, map) {
    var list = Object.keys(obj || {}).map(function (k) { return { k: k, n: obj[k] }; }).sort(function (a, b) { return b.n - a.n; });
    if (!list.length) return empty();
    var max = list[0].n || 1;
    return '<div class="ha-bars">' + list.map(function (x) {
      return '<div class="ha-bar"><span>' + esc(map ? label(map, x.k) : x.k) + '</span><i><em style="width:' + Math.max(2, x.n / max * 100) + '%"></em></i><b>' + num(x.n) + '</b></div>';
    }).join('') + '</div>';
  }
  function table(cols, rows) {
    if (!rows.length) return empty();
    return '<div class="ha-tw"><table class="ha-t"><thead><tr>' + cols.map(function (c) { return '<th' + (c.n ? ' class="n"' : '') + '>' + esc(c.t) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr>' + cols.map(function (c) { return '<td' + (c.n ? ' class="n"' : '') + '>' + c.v(r) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function empty() { return '<p class="ha-empty">Пока нет данных за этот период</p>'; }
  var listingLink = function (id) {
    return '<a href="' + SITE + '#/listing/' + encodeURIComponent(id) + '" target="_blank" rel="noopener">' + esc(id) + '</a>';
  };
  var pct = function (v) { return esc(v) + '%'; };

  function searchLabel(key) {
    var parts = String(key).split(' · ');
    var svc = label(SVC, parts.shift());
    return [svc].concat(parts.map(function (p) {
      var i = p.indexOf('='); if (i < 0) return p;
      var k = p.slice(0, i), v = p.slice(i + 1);
      if (v === '1' && /^(pets|excl|notfirst|notlast)$/.test(k)) return label(KEYS, k);
      if (k === 'district') v = v.split(',').join(', ');
      var rg = v.match(/^(\d*)-(\d*)$/);
      if (rg) v = rg[1] && rg[2] ? rg[1] + '–' + rg[2] : rg[1] ? 'от ' + rg[1] : 'до ' + rg[2];
      return label(KEYS, k) + ': ' + v;
    })).join(' · ');
  }

  function chart(daily) {
    if (!daily || !daily.length) return empty();
    var w = 640, h = 180, pad = 22, n = daily.length;
    var max = Math.max.apply(null, daily.map(function (d) { return d.visitors; }).concat([1]));
    var cmax = Math.max.apply(null, daily.map(function (d) { return d.contacts; }).concat([1]));
    var bw = (w - pad * 2) / n;
    var barsSvg = daily.map(function (d, i) {
      var bh = d.visitors / max * (h - pad * 2);
      return '<rect x="' + (pad + i * bw + bw * .15) + '" y="' + (h - pad - bh) + '" width="' + (bw * .7) + '" height="' + Math.max(0, bh) + '" rx="3" class="v"><title>' + esc(d.d) + ': ' + d.visitors + ' посетителей, ' + d.contacts + ' обращений</title></rect>';
    }).join('');
    var line = daily.map(function (d, i) { return (pad + i * bw + bw / 2) + ',' + (h - pad - d.contacts / cmax * (h - pad * 2)); }).join(' ');
    var step = Math.ceil(n / 8);
    var labels = daily.map(function (d, i) {
      return i % step ? '' : '<text x="' + (pad + i * bw + bw / 2) + '" y="' + (h - 6) + '" text-anchor="middle">' + esc(d.d.slice(8) + '.' + d.d.slice(5, 7)) + '</text>';
    }).join('');
    return '<svg class="ha-chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Посетители и обращения по дням">' + barsSvg +
      '<polyline points="' + line + '" class="c"/>' + labels + '</svg><div class="ha-legend"><span><i class="v"></i>Посетители</span><span><i class="c"></i>Обращения</span></div>';
  }

  function linkBuilder() {
    return card('Ссылка с меткой для поста или Reels',
      '<div class="ha-lb"><label>Куда ведёт<input id="ha-lb-target" placeholder="Номер объекта, например rent-548893, или пусто — главная"></label>' +
      '<label>Где публикуете<select id="ha-lb-src">' + ['instagram', 'facebook', 'tiktok', 'youtube', 'threads', 'telegram', 'whatsapp'].map(function (s) { return '<option value="' + s + '">' + esc(label(SRC, s)) + '</option>'; }).join('') + '</select></label>' +
      '<label>Название публикации<input id="ha-lb-cmp" placeholder="Например reels-vake-2br"></label>' +
      '<div class="ha-lb-out"><input id="ha-lb-url" readonly><button type="button" class="ha-btn" data-ha="copy">Копировать</button></div></div>',
      'Вставьте эту ссылку в публикацию — в отчёте будет видно, сколько клиентов она привела', true);
  }
  function buildLink() {
    var el = function (id) { return document.getElementById(id); };
    if (!el('ha-lb-url')) return;
    var target = (el('ha-lb-target').value || '').trim();
    var cmp = (el('ha-lb-cmp').value || '').trim().toLowerCase().replace(/[^a-z0-9а-яё_-]+/gi, '-').replace(/^-+|-+$/g, '');
    var q = 'utm_source=' + el('ha-lb-src').value + (cmp ? '&utm_campaign=' + encodeURIComponent(cmp) : '');
    el('ha-lb-url').value = SITE + '?' + q + (target ? '#/listing/' + encodeURIComponent(target.replace(/^#?\/?listing\//, '')) : '');
  }

  // ── page ───────────────────────────────────────────
  function render() {
    var el = root(); if (!el) return;
    var r = state.report;
    var head = '<div class="ha-head"><div><h2>Аналитика сайта</h2><p>hge.ge · свой счётчик, без Google</p></div>' +
      '<div class="ha-seg" role="group" aria-label="Период">' + [[1, 'Сегодня'], [7, '7 дней'], [30, '30 дней'], [90, '90 дней']].map(function (p) {
        return '<button type="button" data-days="' + p[0] + '" class="' + (state.days === p[0] ? 'on' : '') + '">' + p[1] + '</button>';
      }).join('') + '</div></div>';
    var msg = {
      setup: 'Счётчик ещё не подключён: нужно установить скрипт аналитики в Google и вписать его адрес. Инструкция — apps-script/ANALYTICS.md.',
      bad_session: 'Сессия входа устарела. Выйдите и войдите в CRM через Telegram заново.',
      not_admin: 'Аналитика доступна только админам.',
      timeout: 'Сервер аналитики не ответил. Попробуйте ещё раз.',
      network: 'Не удалось связаться с сервером аналитики. Попробуйте ещё раз.',
    };
    if (state.loading) { el.innerHTML = '<div class="ha">' + head + '<div class="ha-state"><div class="spin"></div>Считаем…</div></div>'; return; }
    if (state.error || !r) {
      el.innerHTML = '<div class="ha">' + head + '<div class="ha-state">' + esc(msg[state.error] || ('Ошибка: ' + state.error)) +
        (state.error && state.error !== 'setup' && state.error !== 'not_admin' ? '<button type="button" class="ha-btn" data-ha="reload">Повторить</button>' : '') + '</div>' +
        (state.error === 'setup' ? '' : '') + '</div>';
      return;
    }
    var t = r.totals, p = r.prev;
    var perf = r.perf || {};
    var sec = function (ms) { return ms ? (ms / 1000).toFixed(1) + ' с' : '—'; };
    el.innerHTML = '<div class="ha">' + head +
      '<div class="ha-kpis">' +
        kpi('Посетители', t.visitors, p.visitors) + kpi('Новые', t.newVisitors, p.newVisitors) +
        kpi('Просмотры объектов', t.listingViews, p.listingViews) + kpi('Обращения', t.contacts, p.contacts) +
        kpi('Конверсия', t.conversion, p.conversion, '%') + kpi('Поделились', t.shares, p.shares) + kpi('В избранное', t.favs, p.favs) +
      '</div>' +
      '<div class="ha-grid">' +
        card('По дням', chart(r.daily), 'Столбцы — посетители, линия — обращения', true) +
        card('Как связываются', bars(r.contactsBy, CH), 'Нажатия «Позвонить», WhatsApp, Telegram и офис') +
        card('Откуда приходят', table([
          { t: 'Источник', v: function (x) { return esc(label(SRC, x.name)); } },
          { t: 'Визиты', n: 1, v: function (x) { return num(x.sessions); } },
          { t: 'Обращения', n: 1, v: function (x) { return num(x.contacts); } },
          { t: 'Конв.', n: 1, v: function (x) { return pct(x.conversion); } }], r.sources)) +
        card('Какие публикации сработали', table([
          { t: 'Публикация', v: function (x) { return esc(label(CH, x.name)); } },
          { t: 'Где', v: function (x) { return esc(label(SRC, x.source)); } },
          { t: 'Визиты', n: 1, v: function (x) { return num(x.sessions); } },
          { t: 'Обращения', n: 1, v: function (x) { return num(x.contacts); } }], r.campaigns), 'Ссылки с меткой и ссылки из «Поделиться»') +
        card('Объекты с обращениями', table([
          { t: 'Объект', v: function (x) { return listingLink(x.id); } },
          { t: 'Смотрели', n: 1, v: function (x) { return num(x.viewers); } },
          { t: 'Обращения', n: 1, v: function (x) { return num(x.contacts); } },
          { t: 'Конв.', n: 1, v: function (x) { return pct(x.conversion); } }], r.bestListings)) +
        card('Смотрят, но не пишут', table([
          { t: 'Объект', v: function (x) { return listingLink(x.id); } },
          { t: 'Раздел', v: function (x) { return esc(label(SVC, x.service)); } },
          { t: 'Смотрели', n: 1, v: function (x) { return num(x.viewers); } },
          { t: 'В избр.', n: 1, v: function (x) { return num(x.favs); } }], r.noResponse), 'Пять и больше человек открыли, никто не связался — проверьте цену и фото') +
        card('Агенты', table([
          { t: 'Агент', v: function (x) { return esc(x.name === '—' ? 'Без агента' : '@' + x.name); } },
          { t: 'Объектов', n: 1, v: function (x) { return num(x.listings); } },
          { t: 'Просмотры', n: 1, v: function (x) { return num(x.views); } },
          { t: 'Обращения', n: 1, v: function (x) { return num(x.contacts); } },
          { t: 'Конв.', n: 1, v: function (x) { return pct(x.conversion); } }], r.agents), 'По объектам, которые смотрели за период') +
        card('Искали и не нашли', table([
          { t: 'Запрос', v: function (x) { return esc(searchLabel(x.name)); } },
          { t: 'Раз', n: 1, v: function (x) { return num(x.n); } }], r.zeroSearches), 'Подсказка, какие объекты искать у собственников') +
        card('Что ищут чаще всего', table([
          { t: 'Запрос', v: function (x) { return esc(searchLabel(x.name)); } },
          { t: 'Раз', n: 1, v: function (x) { return num(x.n); } }], r.searches)) +
        card('Самые просматриваемые', table([
          { t: 'Объект', v: function (x) { return listingLink(x.id); } },
          { t: 'Раздел', v: function (x) { return esc(label(SVC, x.service)); } },
          { t: 'Смотрели', n: 1, v: function (x) { return num(x.viewers); } },
          { t: 'Обращения', n: 1, v: function (x) { return num(x.contacts); } }], r.listings.slice(0, 15))) +
        card('Чем делятся', bars(r.sharesBy, CH)) +
        card('Переходы в соцсети и каналы', bars(r.socialBy)) +
        card('Устройства', bars(r.devices, DEV)) +
        card('Язык сайта', bars(r.langs, { ru: 'Русский', en: 'English', ka: 'ქართული' })) +
        card('Скорость сайта', '<div class="ha-perf"><div><span>Загрузка (обычно)</span><b>' + sec(perf.loadMedian) + '</b></div><div><span>Загрузка (у медленных)</span><b>' + sec(perf.loadP75) + '</b></div>' +
          '<div><span>Главная картинка</span><b>' + sec(perf.lcpMedian) + '</b></div>' +
          Object.keys(perf.byDevice || {}).map(function (k) { return '<div><span>' + esc(label(DEV, k)) + '</span><b>' + sec(perf.byDevice[k].median) + '</b></div>'; }).join('') + '</div>',
          'Обычно — половина посетителей быстрее этого; у медленных — четверть посетителей медленнее') +
        card('Ошибки у посетителей', table([
          { t: 'Ошибка', v: function (x) { return '<code>' + esc(x.name) + '</code>'; } },
          { t: 'Где', v: function (x) { return esc(x.page); } },
          { t: 'Раз', n: 1, v: function (x) { return num(x.n); } },
          { t: 'Людей', n: 1, v: function (x) { return num(x.sessions); } }], r.errors), 'Если здесь что-то появилось — покажите это Claude', true) +
        linkBuilder() +
      '</div></div>';
    buildLink();
  }

  document.addEventListener('click', function (e) {
    var el = root(); if (!el || !el.contains(e.target)) return;
    var b = e.target.closest('[data-days]');
    if (b) { state.days = Number(b.getAttribute('data-days')); return load(); }
    var a = e.target.closest('[data-ha]');
    if (!a) return;
    if (a.getAttribute('data-ha') === 'reload') load();
    if (a.getAttribute('data-ha') === 'copy') {
      var out = document.getElementById('ha-lb-url');
      out.select();
      try { navigator.clipboard.writeText(out.value); } catch (x) { document.execCommand('copy'); }
      a.textContent = 'Скопировано';
      setTimeout(function () { a.textContent = 'Копировать'; }, 1500);
    }
  });
  document.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('.ha-lb')) buildLink(); });
  document.addEventListener('change', function (e) { if (e.target.closest && e.target.closest('.ha-lb')) buildLink(); });

  var css = '' +
    '#tab-analytics{flex-direction:column}.ha{width:100%;box-sizing:border-box;max-width:1180px;margin:0 auto;padding:20px 16px 112px}' +
    '.ha-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:16px}' +
    '.ha-head h2{font-size:22px;font-weight:800;letter-spacing:-.02em;color:var(--ink);margin:0}.ha-head p{font-size:12px;color:var(--muted);margin:4px 0 0}' +
    '.ha-seg{display:flex;gap:4px;padding:4px;border-radius:14px;background:var(--surface);border:1px solid var(--line)}' +
    '.ha-seg button{border:0;background:none;font:inherit;font-size:13px;font-weight:700;color:var(--muted);padding:8px 12px;border-radius:10px;cursor:pointer;min-height:36px}' +
    '.ha-seg button.on{background:var(--brand);color:#fff}' +
    '.ha-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:12px}' +
    '.ha-kpi{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:var(--shadow-sm);display:flex;flex-direction:column;gap:4px}' +
    '.ha-kpi span{font-size:12px;color:var(--muted)}.ha-kpi b{font-size:24px;font-weight:800;color:var(--ink);letter-spacing:-.02em}' +
    '.ha-ch{font-size:12px;font-weight:700;color:var(--muted)}.ha-ch.up{color:var(--ok,#0F7B55)}.ha-ch.down{color:var(--red,#C8102E)}' +
    '.ha-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}' +
    '@media(min-width:900px){.ha{padding:28px 28px 40px}.ha-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ha-card.wide{grid-column:1/-1}}' +
    '.ha-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow-sm);padding:16px;min-width:0}' +
    '.ha-card header{margin-bottom:12px}.ha-card h3{font-size:15px;font-weight:800;color:var(--ink);margin:0}.ha-card header p{font-size:12px;color:var(--muted);margin:4px 0 0}' +
    '.ha-bars{display:grid;gap:8px}.ha-bar{display:grid;grid-template-columns:minmax(90px,38%) 1fr auto;align-items:center;gap:10px;font-size:13px}' +
    '.ha-bar span{color:var(--ink-2,var(--text));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ha-bar i{display:block;height:10px;border-radius:6px;background:var(--line)}' +
    '.ha-bar em{display:block;height:100%;border-radius:6px;background:var(--brand)}.ha-bar b{font-weight:700;color:var(--ink);min-width:28px;text-align:right}' +
    '.ha-tw{overflow-x:auto;margin:0 -4px}.ha-t{width:100%;border-collapse:collapse;font-size:13px}' +
    '.ha-t th{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);text-align:left;padding:6px 4px;border-bottom:1px solid var(--line)}' +
    '.ha-t td{padding:8px 4px;border-bottom:1px solid var(--line);color:var(--ink-2,var(--text));vertical-align:top}.ha-t tr:last-child td{border-bottom:0}' +
    '.ha-t .n{text-align:right;white-space:nowrap}.ha-t a{color:var(--brand);font-weight:600}.ha-t code{font-size:12px;word-break:break-word}' +
    '.ha-empty{font-size:13px;color:var(--muted);margin:4px 0}' +
    '.ha-chart{width:100%;height:auto;display:block}.ha-chart .v{fill:var(--brand);opacity:.28}.ha-chart .c{fill:none;stroke:var(--red,#C8102E);stroke-width:2.5;stroke-linejoin:round}' +
    '.ha-chart text{font-size:10px;fill:var(--muted)}.ha-legend{display:flex;gap:16px;font-size:12px;color:var(--muted);margin-top:6px}' +
    '.ha-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}.ha-legend i.v{background:var(--brand);opacity:.4}.ha-legend i.c{background:var(--red,#C8102E)}' +
    '.ha-perf{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}.ha-perf div{display:flex;flex-direction:column;gap:2px;padding:10px;border-radius:12px;background:var(--bg,var(--canvas))}' +
    '.ha-perf span{font-size:12px;color:var(--muted)}.ha-perf b{font-size:18px;font-weight:800;color:var(--ink)}' +
    '.ha-state{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;padding:48px 16px;font-size:14px;color:var(--muted);background:var(--surface);border:1px solid var(--line);border-radius:18px}' +
    '.ha-btn{border:0;font:inherit;font-size:13px;font-weight:700;color:#fff;background:var(--brand);border-radius:12px;padding:10px 16px;cursor:pointer;min-height:40px}' +
    '.ha-lb{display:grid;gap:10px}@media(min-width:900px){.ha-lb{grid-template-columns:1.4fr 1fr 1fr}.ha-lb-out{grid-column:1/-1}}' +
    '.ha-lb label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:var(--muted)}' +
    '.ha-lb input,.ha-lb select{font:inherit;font-size:14px;color:var(--ink);background:var(--bg,var(--canvas));border:1px solid var(--line);border-radius:10px;padding:10px;min-height:42px;min-width:0}' +
    '.ha-lb-out{display:flex;gap:8px}.ha-lb-out input{flex:1;font-size:13px}';
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  window.HigAnalytics = { open: function () { if (!state.report && !state.loading) load(); else render(); } };
})();
