// Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
// Cars Rent in Tbilisi — club module: catalogue, booking and payment, client
// account with loyalty status, and the operator's admin panel. Hash routing,
// no build step, works on the static host as a standalone page.

import * as R from './rules.js';
import * as S from './store.js';
import { t, lang, setLang, LANGS, COURSE } from './i18n.js';
import { pay } from './payments.js';
import { loadFleet } from './fleet.js';

const $ = (s, el = document) => el.querySelector(s);
const main = $('#main');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
const locale = () => ({ ru: 'ru-RU', en: 'en-GB', ka: 'ka-GE' }[lang()]);
const dt = d => new Date(d).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dday = d => new Date(d).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
const toLocalInput = ms => { const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

const db = () => S.get();
const me = () => S.currentClient();
const statusOf = c => R.status(c, db().bookings, db().incidents, Date.now(), db().rules);
const carById = id => db().cars.find(c => c.id === id);
const clientById = id => db().clients.find(c => c.id === id);
const tierName = id => t('tier.' + id);
const sub = car => [car.year, car.body ? t('body.' + car.body) : ''].filter(Boolean).join(' · ');

/* ---------- Shell ---------- */

const NAV = [
  ['home', '#/', 'home'], ['cars', '#/cars', 'car'], ['club', '#/club', 'crown'],
  ['support', '#/support', 'help'], ['account', '#/account', 'user'],
];
const ICONS = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  car: '<path d="M5 16l1.5-5.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.9 1.5L19 16"/><rect x="3" y="16" width="18" height="4" rx="1.5"/><circle cx="7.5" cy="18" r=".6"/><circle cx="16.5" cy="18" r=".6"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><circle cx="12" cy="17.2" r=".6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5"/><circle cx="12" cy="18" r=".6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
};
const icon = (n, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

function shell() {
  const route = (location.hash.split('?')[0] || '#/').split('/')[1] || '';
  const active = id => (id === 'home' ? route === '' : route === id || (id === 'cars' && ['car', 'book'].includes(route)));
  $('#sitebar').innerHTML = `<a href="../">${icon('back')}<img class="lg-l" src="../assets/img/brand/logo.svg" alt="Homes in Georgia" width="92" height="28"><img class="lg-d" src="../assets/img/brand/logo-white.svg" alt="" width="92" height="28"></a><span>${t('nav.siteSection')}</span><a class="sitebar-cars" href="../#/car-rent">${t('nav.backSite')}</a>`;
  $('#header').innerHTML = `
    <a class="brand" href="#/"><span class="brand-mark">CR</span><span><b>Cars Rent in Tbilisi</b><small>${t('brand.sub')}</small></span></a>
    <nav class="topnav">${NAV.map(([id, href]) => `<a href="${href}" class="${active(id) ? 'on' : ''}">${t('nav.' + id)}</a>`).join('')}</nav>
    <div class="langs" role="group" aria-label="Language">${LANGS.map(l => `<button data-lang="${l}" class="${l === lang() ? 'on' : ''}">${l.toUpperCase()}</button>`).join('')}</div>`;
  $('#tabbar').innerHTML = NAV.map(([id, href, ic]) => `<a href="${href}" class="${active(id) ? 'on' : ''}">${icon(ic)}<span>${t('nav.' + id)}</span></a>`).join('');
  $('#footer').innerHTML = `
    <div class="demo-note">${icon('alert')}<span>${t('demo.banner')}</span></div>
    <p><a href="../#/car-rent">← ${t('nav.backSite')}</a> · © Cars Rent in Tbilisi · <a href="#/admin">${t('nav.admin')}</a> · <a href="#/club">${t('nav.club')}</a> · <a href="#/support">${t('nav.support')}</a></p>`;
  document.documentElement.lang = lang();
  document.title = t('doc.title');
}

/* ---------- Pieces ---------- */

function badge(st, big = false) {
  const id = st.investor && !st.suspended ? 'investor' : st.tier;
  return `<span class="badge t-${id} ${st.suspended ? 'off' : ''} ${big ? 'big' : ''}">${icon(id === 'investor' ? 'shield' : 'crown')}${esc(id === 'investor' ? t('status.investor') : tierName(id))}${st.suspended ? ' · ' + t('status.paused') : ''}</span>`;
}

function carCard(car, st) {
  const ok = !st || R.canRent(car, st);
  const pct = st?.discount || 0;
  const four = R.planPrice(car, '4h', 'tpl', db().rules);
  const day = R.planPrice(car, '1d', 'tpl', db().rules);
  const hour = four / 4 * (1 - pct / 100);
  return `<a class="car-card ${ok ? '' : 'locked'}" href="#/car/${car.id}">
    <div class="ph"><img src="${esc(car.photos[0])}" alt="${esc(car.name)}" loading="lazy"><span class="cls">${t('class.' + car.class)}</span>
      ${ok ? '' : `<span class="lock">${icon('lock')}${t('car.lockedFrom', tierName(R.unlockTier(car.class, db().rules)))}</span>`}</div>
    <div class="body">
      <h3>${esc(car.name)} <span>${esc(sub(car))}</span></h3>
      <p class="price">${t('car.fromHour', money(hour))}${pct ? ` <s>${money(four / 4)}</s>` : ''}</p>
      <p class="meta">${t('car.day')}: ${money(day * (1 - pct / 100))} · ${t('car.deposit')}: ${money(R.deposit(car, db().rules))}</p>
    </div></a>`;
}

function progressBlock(st) {
  if (!st.toNext) return `<p class="muted">${t('acc.topTier')}</p>`;
  const nx = R.tierById(st.nextTier, db().rules);
  const bar = (pct, label) => `<div class="bar"><div style="width:${pct}%"></div></div><p class="bar-l">${label}</p>`;
  return `<div class="progress">
    <p class="next">${t('acc.next', tierName(st.nextTier))}</p>
    ${nx.minSpend ? bar(st.toNext.spendPct, t('acc.spendLeft', money(st.progress.spend), money(nx.minSpend), money(st.toNext.spend))) : ''}
    ${nx.minRentals ? bar(st.toNext.rentalsPct, t('acc.rentalsLeft', st.progress.rentals, nx.minRentals)) : ''}
    ${nx.minSpend && nx.minRentals ? `<p class="hint">${t(nx.combine === 'or' ? 'acc.either' : 'acc.both')}</p>` : ''}
  </div>`;
}

function suspendedNote(st) {
  if (!st.suspended) return '';
  return `<div class="alert">${icon('alert')}<div><b>${t('acc.suspended')}</b>
    <p>${t('acc.suspendedWhy', st.reasons.gross, db().rules.penalty.maxGross, st.reasons.atFault, db().rules.penalty.maxAtFault)}</p>
    <p>${t('acc.suspendedUntil', dday(st.suspendedUntil))}</p></div></div>`;
}

let toastTimer;
function toast(msg) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.append(el); }
  el.textContent = msg; el.className = 'show';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.className = ''), 2600);
}

/* ---------- Pages ---------- */

function pageHome() {
  const c = me(); const st = c && statusOf(c);
  const classes = R.CLASSES.filter(k => db().cars.some(car => car.class === k));
  return `
  <section class="hero">
    <img src="${esc(db().cars[0]?.photos[0] || '')}" alt="">
    <div class="hero-in">
      <p class="eyebrow">Cars Rent in Tbilisi</p>
      <h1>${t('home.title')}</h1>
      <p>${t('home.sub')}</p>
      <div class="row"><a class="btn" href="#/cars">${t('home.cta')}</a><a class="btn ghost light" href="#/club">${t('home.club')}</a></div>
    </div>
  </section>
  ${st ? `<section class="wrap"><a class="me-strip" href="#/account">${badge(st)}<span>${t('home.yourDiscount', st.discount)}</span><span class="go">→</span></a></section>` : ''}
  <section class="wrap">
    <h2>${t('home.style')}</h2>
    <div class="chips">${classes.map(k => `<a class="chip" href="#/cars?class=${k}">${t('class.' + k)}</a>`).join('')}</div>
    <div class="grid cars">${db().cars.map(car => carCard(car, st)).join('')}</div>
  </section>
  <section class="wrap two">
    <div class="panel"><h2>${t('home.simple')}</h2><ul class="ticks">${[1, 2, 3, 4].map(i => `<li>${icon('check')}${t('home.f' + i)}</li>`).join('')}</ul></div>
    <div class="panel"><h2>${t('home.cond')}</h2><ul class="ticks">${[1, 2, 3, 4].map(i => `<li>${icon('check')}${t('home.c' + i)}</li>`).join('')}</ul></div>
  </section>
  <section class="wrap">
    <div class="club-teaser">
      <div><h2>${t('home.clubTitle')}</h2><p>${t('home.clubText')}</p><a class="btn" href="#/club">${t('home.clubMore')}</a></div>
      <ol class="ladder">${db().rules.tiers.map(x => `<li class="t-${x.id}"><b>${tierName(x.id)}</b><span>${x.discount}%</span></li>`).join('')}</ol>
    </div>
  </section>
  <section class="wrap"><div class="panel invest"><h2>${t('home.investTitle')}</h2><p>${t('home.investText', db().rules.investor.discount)}</p></div></section>`;
}

function pageCars(q) {
  const c = me(); const st = c && statusOf(c);
  const cls = q.get('class') || 'all';
  const list = db().cars.filter(car => car.status !== 'hidden' && (cls === 'all' || car.class === cls));
  return `<section class="wrap">
    <h1>${t('cars.title')}</h1>
    ${st ? `<p class="muted">${t('cars.yourPrices', st.discount)}</p>` : `<p class="muted">${t('cars.guest')}</p>`}
    <div class="chips">${['all', ...R.CLASSES].map(k => `<a class="chip ${k === cls ? 'on' : ''}" href="#/cars${k === 'all' ? '' : '?class=' + k}">${t(k === 'all' ? 'cars.all' : 'class.' + k)}</a>`).join('')}</div>
    ${list.length ? `<div class="grid cars">${list.map(car => carCard(car, st)).join('')}</div>` : `<div class="empty">${t('cars.empty')}</div>`}
  </section>`;
}

function pageCar(id, q) {
  const car = carById(id); if (!car) return notFound();
  const c = me(); const st = c && statusOf(c);
  const ins = q.get('ins') === 'casco' ? 'casco' : 'tpl';
  const ok = !st || R.canRent(car, st);
  const pct = st?.discount || 0;
  const rules = db().rules;
  const busy = db().bookings.filter(b => b.carId === car.id && ['paid', 'active'].includes(b.status) && R.bookingEnd(b) > Date.now());
  const spec = (k, v) => v ? `<div class="spec"><small>${t('spec.' + k)}</small><b>${esc(v)}</b></div>` : '';
  const route = car.lat ? `https://www.google.com/maps/dir/?api=1&destination=${car.lat},${car.lon}` : car.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(car.address)}` : '';
  return `<section class="wrap car-page">
    <a class="back" href="#/cars">← ${t('car.back')}</a>
    <div class="gallery">${car.photos.map(p => `<img src="${esc(p)}" alt="${esc(car.name)}" loading="lazy">`).join('')}</div>
    <div class="car-head">
      <div><span class="cls-tag">${t('class.' + car.class)}</span><h1>${esc(car.name)} <span>${esc(sub(car))}</span></h1>
      ${car.address ? `<p class="addr">${icon('pin')}${esc(car.address)} ${route ? `<a href="${route}" target="_blank" rel="noopener">${t('car.route')}</a>` : ''}</p>` : ''}
      ${car.postUrl ? `<p class="hint"><a href="${esc(car.postUrl)}" target="_blank" rel="noopener">${t('car.post')}</a></p>` : ''}</div>
    </div>
    <div class="specs">
      ${spec('year', car.year)}${spec('consumption', car.consumption ? car.consumption + ' ' + t('spec.l100') : '')}${spec('fuel', car.fuel ? t('fuel.' + car.fuel) : '')}
      ${spec('gearbox', car.gearbox ? t('gear.' + car.gearbox) : '')}${spec('drive', car.drive)}${spec('power', car.hp ? car.hp + ' ' + t('spec.hp') : '')}
      ${spec('seats', car.seats)}${spec('trunk', car.trunk ? car.trunk + ' ' + t('spec.l') : '')}${spec('pets', car.pets ? t('spec.yes') : '')}
    </div>
    <div class="deposit-box"><b>${money(R.deposit(car, rules))}</b><span>${t('car.depositText')}</span></div>
    ${car.extras?.length ? `<div class="chips">${car.extras.map(e => `<span class="chip">${t('extra.' + e.id)} · ${money(e.perDay)}/${t('extra.day')}</span>`).join('')}</div>` : ''}
    ${ok ? '' : `<div class="alert">${icon('lock')}<div><b>${t('car.lockedTitle')}</b><p>${st?.suspended ? t('car.lockedSuspended') : t('car.lockedText', tierName(R.unlockTier(car.class, rules)))}</p><a href="#/club">${t('home.clubMore')}</a></div></div>`}
    <h2>${t('car.plans')}</h2>
    <p class="muted">${t('car.plansText')}</p>
    <div class="seg">${['tpl', 'casco'].map(k => `<a class="${k === ins ? 'on' : ''}" href="#/car/${car.id}?ins=${k}">${t('ins.' + k)}</a>`).join('')}</div>
    <p class="hint">${t('ins.' + ins + '.text')}</p>
    <div class="plans">${rules.plans.map(p => {
      const price = R.planPrice(car, p.id, ins, rules); if (price == null) return '';
      const after = price * (1 - pct / 100);
      const per = p.hours < 72 ? t('plan.perHour', money(after / p.hours)) : t('plan.perDay', money(after / (p.hours / 24)));
      return `<div class="plan"><h4>${t('plan.' + p.id)}</h4><p class="p">${money(after)}${pct ? ` <s>${money(price)}</s>` : ''}</p><p class="per">${per}</p>
        <ul><li>${t('plan.unlimited')}</li><li>${t(ins === 'casco' ? 'plan.casco' : 'plan.tpl')}</li></ul>
        ${ok ? `<a class="btn sm" href="#/book/${car.id}?plan=${p.id}&ins=${ins}">${t('car.book')}</a>` : ''}</div>`;
    }).join('')}</div>
    <div class="two">
      <div class="panel"><h3>${t('car.where')}</h3>${car.lat ? `<iframe class="map" title="map" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${car.lon - 0.006},${car.lat - 0.004},${car.lon + 0.006},${car.lat + 0.004}&layer=mapnik&marker=${car.lat},${car.lon}"></iframe>` : `<p class="muted">${t('car.noPoint')}</p>`}</div>
      <div class="panel"><h3>${t('car.busy')}</h3>${busy.length ? `<ul class="plain">${busy.map(b => `<li>${dt(b.start)} — ${dt(b.end)}</li>`).join('')}</ul>` : `<p class="muted">${t('car.free')}</p>`}</div>
    </div>
  </section>`;
}

function pageBook(id, q) {
  const car = carById(id); if (!car) return notFound();
  const c = me();
  if (!c) return `<section class="wrap narrow"><h1>${t('book.title')}</h1><div class="panel"><p>${t('book.needLogin')}</p><a class="btn" href="#/account?next=${encodeURIComponent(location.hash)}">${t('acc.signin')}</a></div></section>`;
  const st = statusOf(c);
  if (!R.canRent(car, st)) return pageCar(id, q);
  const rules = db().rules;
  const plan = q.get('plan') || '1d', ins = q.get('ins') || 'tpl';
  const start = toLocalInput(Date.now() + 2 * 3600000);
  return `<section class="wrap narrow">
    <a class="back" href="#/car/${car.id}">← ${esc(car.name)}</a>
    <h1>${t('book.title')}</h1>
    <form id="book-form" class="panel form" data-car="${car.id}">
      <div class="car-mini"><img src="${esc(car.photos[0])}" alt=""><div><b>${esc(car.name)}</b><span>${t('class.' + car.class)} · ${badge(st)}</span></div></div>
      <label>${t('book.plan')}<select name="plan">${rules.plans.filter(p => R.planPrice(car, p.id, 'tpl', rules) != null).map(p => `<option value="${p.id}" ${p.id === plan ? 'selected' : ''}>${t('plan.' + p.id)}</option>`).join('')}</select></label>
      <label>${t('book.qty')}<input name="qty" type="number" min="1" max="12" value="1"></label>
      <label>${t('book.start')}<input name="start" type="datetime-local" value="${start}" min="${toLocalInput(Date.now() + 90 * 60000)}" required></label>
      <label>${t('book.ins')}<select name="ins">${['tpl', 'casco'].map(k => `<option value="${k}" ${k === ins ? 'selected' : ''}>${t('ins.' + k)}</option>`).join('')}</select></label>
      <label>${t('book.delivery')}<select name="delivery">${Object.entries(rules.delivery).map(([k, v]) => `<option value="${k}">${t('del.' + k)}${v ? ' (+' + money(v) + ')' : ''}</option>`).join('')}</select></label>
      ${car.extras?.length ? `<fieldset><legend>${t('book.extras')}</legend>${car.extras.map(e => `<label class="check"><input type="checkbox" name="extra" value="${e.id}"> <span>${t('extra.' + e.id)} · ${money(e.perDay)}/${t('extra.day')}</span></label>`).join('')}</fieldset>` : ''}
      <div id="quote"></div>
      <label class="check"><input type="checkbox" name="agree" required> <span>${t('book.agree')}</span></label>
      <button class="btn wide" type="submit">${t('book.pay')}</button>
      <p class="hint">${t('book.payNote')}</p>
    </form>
  </section>`;
}

function renderQuote(form) {
  const car = carById(form.dataset.car); const st = statusOf(me());
  const f = new FormData(form);
  const q = R.quote({ car, planId: f.get('plan'), qty: Math.max(1, +f.get('qty') || 1), insurance: f.get('ins'), delivery: f.get('delivery'), extras: f.getAll('extra'), st, rules: db().rules });
  const start = Date.parse(f.get('start'));
  const end = start + q.hours * 3600000;
  const clash = R.overlaps(db().bookings, car.id, new Date(start).toISOString(), new Date(end).toISOString());
  const discLabel = st.discountSource.startsWith('tier:') ? tierName(st.discountSource.slice(5)) : t('status.' + st.discountSource);
  $('#quote', form).innerHTML = `<div class="quote">
    <div><span>${t('book.rental')} (${t('plan.' + f.get('plan'))} × ${q.qty})</span><b>${money(q.rental)}</b></div>
    ${q.pct ? `<div class="disc"><span>${t('book.discount', q.pct, discLabel)}</span><b>−${money(q.discount)}</b></div>` : ''}
    ${q.deliveryFee ? `<div><span>${t('book.deliveryFee')}</span><b>${money(q.deliveryFee)}</b></div>` : ''}
    ${q.extrasFee ? `<div><span>${t('book.extras')} (${q.days} ${t('extra.days')})</span><b>${money(q.extrasFee)}</b></div>` : ''}
    <div class="total"><span>${t('book.total')}</span><b>${money(q.total)}</b></div>
    <div class="dep"><span>${t('book.depositHold')}</span><b>${money(q.deposit)}</b></div>
    <p class="hint">${t('book.until', dt(end))}</p>
    ${clash ? `<p class="err">${t('book.clash')}</p>` : ''}
  </div>`;
  form.querySelector('button[type=submit]').disabled = clash || !start;
  return { q, start, end, clash };
}

function pageClub() {
  const rules = db().rules; const p = rules.penalty;
  const cond = x => {
    const parts = [];
    if (x.minSpend) parts.push(t('club.fromSpend', money(x.minSpend)));
    if (x.minRentals) parts.push(t('club.fromRentals', x.minRentals));
    return parts.length ? parts.join(x.combine === 'or' ? t('club.or') : t('club.and')) : t('club.onSignup');
  };
  const access = x => x.classes.map(k => t('class.' + k)).join(', ');
  const types = Object.entries(rules.violationTypes);
  return `<section class="wrap">
    <h1>${t('club.title')}</h1>
    <p class="lead">${t('club.lead')}</p>
    <div class="tiers">${rules.tiers.map(x => `<div class="tier t-${x.id}">
      <div class="tier-h"><span class="badge t-${x.id}">${icon('crown')}${tierName(x.id)}</span><b class="pct">${x.discount}%</b></div>
      <p><small>${t('club.condition')}</small>${cond(x)}</p>
      <p><small>${t('club.access')}</small>${access(x)}</p>
      ${x.club ? `<p class="perk">${t('club.perks')}</p>` : ''}${x.premiere ? `<p class="perk">${t('club.premiere')}</p>` : ''}
    </div>`).join('')}</div>
    <h2>${t('club.extra')}</h2>
    <div class="two">
      <div class="panel"><span class="badge t-education">${icon('check')}${t('status.education')}</span><p>${t('club.eduText', rules.education.passScore, rules.education.questions, rules.education.discount)}</p></div>
      <div class="panel"><span class="badge t-investor">${icon('shield')}${t('status.investor')}</span><p>${t('club.invText', rules.investor.discount)}</p></div>
    </div>
    <div class="panel note"><b>${t('club.maxTitle')}</b><p>${t('club.maxText')}</p></div>
    <h2>${t('club.keepTitle')}</h2>
    <div class="panel rules-list">
      <p>${t('club.keep1', Math.round(p.windowDays / 30.5))}</p>
      <ul>
        <li>${t('club.keepGross', p.maxGross)}</li>
        <li>${t('club.keepAcc', p.maxAtFault)}</li>
      </ul>
      <p>${t('club.keepEffect')}</p>
      <p>${t('club.keepBack')}</p>
      <p>${t('club.keepInvestor')}</p>
      <div class="two tight">
        <div><h4>${t('club.grossList')}</h4><ul class="tags">${types.filter(([, v]) => v.gross).map(([k]) => `<li class="bad">${t('vt.' + k)}</li>`).join('')}</ul></div>
        <div><h4>${t('club.minorList')}</h4><ul class="tags">${types.filter(([, v]) => !v.gross).map(([k]) => `<li>${t('vt.' + k)}</li>`).join('')}</ul></div>
      </div>
    </div>
    <h2>${t('club.privTitle')}</h2>
    <div class="grid three">${['collab', 'events', 'premarket'].map(k => `<div class="panel"><h3>${t('club.' + k)}</h3><p>${t('club.' + k + 'Text')}</p></div>`).join('')}</div>
  </section>`;
}

function pageSupport() {
  const qs = ['deposit', 'payment', 'fines', 'accident', 'conditions', 'status'];
  return `<section class="wrap narrow">
    <h1>${t('sup.title')}</h1>
    <div class="faq">${qs.map(k => `<details><summary>${t('faq.' + k)}</summary><div>${t('faq.' + k + '.a', db().rules.fineFeePct)}</div></details>`).join('')}</div>
    <div class="panel"><h3>${t('sup.sos')}</h3><p>${t('sup.sosText')}</p></div>
  </section>`;
}

/* ---------- Account ---------- */

function pageAccount(q) {
  const c = me();
  if (!c) return pageSignIn(q);
  const st = statusOf(c);
  const tab = q.get('tab') || 'overview';
  const tabs = ['overview', 'bookings', 'record', 'course', 'benefits', 'profile'];
  let body = '';
  if (tab === 'overview') body = accOverview(c, st);
  if (tab === 'bookings') body = accBookings(c);
  if (tab === 'record') body = accRecord(c);
  if (tab === 'course') body = accCourse(c, q);
  if (tab === 'benefits') body = accBenefits(st);
  if (tab === 'profile') body = accProfile(c);
  return `<section class="wrap">
    <div class="acc-head"><div><p class="muted">${t('acc.hello')}</p><h1>${esc(c.name)}</h1></div>${badge(st, true)}</div>
    <nav class="tabs">${tabs.map(k => `<a class="${k === tab ? 'on' : ''}" href="#/account?tab=${k}">${t('acc.tab.' + k)}</a>`).join('')}</nav>
    ${body}
  </section>`;
}

function accOverview(c, st) {
  const disc = st.discountSource.startsWith('tier:') ? tierName(st.discountSource.slice(5)) : st.discountSource === 'none' ? '—' : t('status.' + st.discountSource);
  const unpaid = db().bookings.filter(b => b.clientId === c.id && b.status === 'unpaid');
  return `${suspendedNote(st)}
    ${unpaid.length ? `<div class="alert info">${icon('alert')}<div><b>${t('acc.unpaid', unpaid.length)}</b><p><a href="#/account?tab=bookings">${t('acc.tab.bookings')}</a></p></div></div>` : ''}
    <div class="stats">
      <div class="stat"><small>${t('acc.discount')}</small><b>${st.discount}%</b><span>${esc(disc)}</span></div>
      <div class="stat"><small>${t('acc.spent')}</small><b>${money(st.progress.spend)}</b><span>${t('acc.completedN', st.progress.completed)}</span></div>
      <div class="stat"><small>${t('acc.clean')}</small><b>${st.progress.rentals}</b><span>${t('acc.cleanHint')}</span></div>
      <div class="stat ${st.reasons.gross ? 'warn' : ''}"><small>${t('acc.grossWin')}</small><b>${st.reasons.gross} / ${db().rules.penalty.maxGross}</b><span>${t('acc.accWin', st.reasons.atFault, db().rules.penalty.maxAtFault)}</span></div>
    </div>
    <div class="panel">${progressBlock(st)}</div>
    <div class="panel"><h3>${t('acc.access')}</h3><div class="chips">${R.CLASSES.map(k => `<span class="chip ${st.classes.includes(k) ? 'on' : 'off'}">${st.classes.includes(k) ? '' : icon('lock')}${t('class.' + k)}</span>`).join('')}</div>
    ${!st.education ? `<p class="hint">${t('acc.courseHint', db().rules.education.discount)} <a href="#/account?tab=course">${t('acc.tab.course')}</a></p>` : ''}</div>`;
}

const bookingStatus = b => t('bs.' + b.status);
function accBookings(c) {
  const list = db().bookings.filter(b => b.clientId === c.id).sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  if (!list.length) return `<div class="empty">${t('acc.noBookings')} <a href="#/cars">${t('home.cta')}</a></div>`;
  return `<div class="list">${list.map(b => {
    const car = carById(b.carId);
    return `<div class="row-item">
      <img src="${esc(car?.photos[0] || '')}" alt="">
      <div class="grow"><b>${esc(car?.name || b.carId)}</b><span>${dt(b.start)} — ${dt(b.end)} · ${t('plan.' + b.planId)}${b.qty > 1 ? ' × ' + b.qty : ''}</span>
      <span>${t('book.total')}: ${money(b.total)} · ${t('car.deposit')}: ${money(b.deposit)} (${t('dep.' + (b.depositState || 'none'))})</span></div>
      <div class="end"><span class="pill s-${b.status}">${bookingStatus(b)}</span>
      ${b.status === 'unpaid' ? `<button class="btn sm" data-act="pay" data-id="${b.id}">${t('acc.payNow')}</button><button class="link" data-act="cancel" data-id="${b.id}">${t('acc.cancel')}</button>` : ''}
      ${b.status === 'paid' && Date.parse(b.start) > Date.now() ? `<button class="link" data-act="cancel" data-id="${b.id}">${t('acc.cancel')}</button>` : ''}</div>
    </div>`;
  }).join('')}</div>`;
}

function accRecord(c) {
  const rules = db().rules;
  const from = Date.now() - rules.penalty.windowDays * R.DAY;
  const list = db().incidents.filter(i => i.clientId === c.id && i.status !== 'cancelled').sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return `<p class="muted">${t('rec.intro', Math.round(rules.penalty.windowDays / 30.5))}</p>
  ${list.length ? `<div class="list">${list.map(i => {
    const counts = i.status === 'confirmed' && Date.parse(i.date) > from && (i.kind === 'accident' ? i.atFault : R.isGross(i, rules));
    const what = i.kind === 'accident' ? t(i.atFault ? 'rec.accFault' : 'rec.accNoFault') : t('vt.' + i.type);
    const charge = i.kind === 'fine' && i.amount ? R.fineCharge(i.amount, rules) : null;
    return `<div class="row-item">
      <div class="grow"><b>${esc(what)}</b><span>${dt(i.date)} · ${esc(carById(i.carId)?.name || i.plate || '')}</span>
      ${charge ? `<span>${t('rec.charge', charge.amount + ' ' + (i.currency || 'GEL'), charge.fee, rules.fineFeePct)}</span>` : ''}</div>
      <div class="end">${counts ? `<span class="pill bad">${t('rec.counts')}</span>` : `<span class="pill">${t(i.status === 'disputed' ? 'rec.disputed' : 'rec.notCounts')}</span>`}
      ${i.status === 'confirmed' && i.kind === 'fine' ? `<button class="link" data-act="dispute" data-id="${i.id}">${t('rec.dispute')}</button>` : ''}</div>
    </div>`;
  }).join('')}</div>` : `<div class="empty">${t('rec.clean')}</div>`}`;
}

function accCourse(c, q) {
  const rules = db().rules;
  if (c.educationPassed) return `<div class="panel"><span class="badge t-education">${icon('check')}${t('status.education')}</span><p>${t('course.passed', c.educationScore ?? rules.education.passScore, COURSE.length, rules.education.discount)}</p></div>`;
  if (q.get('start') !== '1') return `<div class="panel"><h3>${t('course.title')}</h3><p>${t('course.intro', rules.education.passScore, COURSE.length, rules.education.discount)}</p>
    <div class="course-theory">${t('course.theory')}</div><a class="btn" href="#/account?tab=course&start=1">${t('course.start')}</a></div>`;
  return `<form id="course-form" class="panel form"><h3>${t('course.title')}</h3>
    ${COURSE.map((qq, i) => `<fieldset><legend>${i + 1}. ${esc(qq.q[lang()] || qq.q.en)}</legend>
      ${qq.a.map((a, j) => `<label class="check"><input type="radio" name="q${i}" value="${j}" required> <span>${esc(a[lang()] || a.en)}</span></label>`).join('')}</fieldset>`).join('')}
    <button class="btn" type="submit">${t('course.submit')}</button></form>`;
}

function accBenefits(st) {
  return `<div class="panel">${st.club ? `<p>${t('ben.open')}</p>` : `<div class="alert">${icon('lock')}<div><b>${t('ben.locked')}</b><p>${t(st.suspended ? 'car.lockedSuspended' : 'ben.lockedText')}</p></div></div>`}
    <div class="grid three">${['collab', 'events', 'premarket'].map(k => `<div class="panel ${st.club && (k !== 'premarket' || st.premiere) ? '' : 'dim'}"><h3>${t('club.' + k)}</h3><p>${t('ben.soon')}</p></div>`).join('')}</div></div>`;
}

function accProfile(c) {
  return `<form id="profile-form" class="panel form narrow-form">
    <label>${t('reg.name')}<input name="name" value="${esc(c.name)}" required></label>
    <label>${t('reg.phone')}<input name="phone" value="${esc(c.phone)}" required></label>
    <label>${t('reg.email')}<input name="email" type="email" value="${esc(c.email)}"></label>
    <div class="row"><button class="btn" type="submit">${t('prof.save')}</button><button class="btn ghost" type="button" data-act="signout">${t('prof.signout')}</button></div>
  </form>`;
}

function pageSignIn(q) {
  const mode = q.get('mode') === 'register' ? 'register' : 'login';
  const demos = db().clients.filter(c => c.demo);
  return `<section class="wrap narrow">
    <h1>${t('acc.title')}</h1>
    <nav class="tabs"><a class="${mode === 'login' ? 'on' : ''}" href="#/account?mode=login${q.get('next') ? '&next=' + encodeURIComponent(q.get('next')) : ''}">${t('acc.signin')}</a><a class="${mode === 'register' ? 'on' : ''}" href="#/account?mode=register${q.get('next') ? '&next=' + encodeURIComponent(q.get('next')) : ''}">${t('acc.register')}</a></nav>
    ${mode === 'login' ? `<form id="login-form" class="panel form">
      <label>${t('reg.phoneOrEmail')}<input name="who" required autocomplete="username"></label>
      <label>${t('reg.code')}<input name="code" inputmode="numeric" placeholder="0000" required></label>
      <p class="hint">${t('reg.codeDemo')}</p>
      <button class="btn wide" type="submit">${t('acc.signin')}</button>
    </form>
    <div class="panel"><h3>${t('acc.demoTitle')}</h3><p class="muted">${t('acc.demoText')}</p>
      <div class="list">${demos.map(d => { const st = statusOf(d); return `<button class="row-item btnlike" data-act="demo" data-id="${d.id}"><div class="grow"><b>${esc(d.name)}</b><span>${t('demo.' + d.id)}</span></div>${badge(st)}</button>`; }).join('')}</div></div>`
    : `<form id="register-form" class="panel form">
      <label>${t('reg.name')}<input name="name" required autocomplete="name"></label>
      <label>${t('reg.phone')}<input name="phone" type="tel" required autocomplete="tel" placeholder="+995"></label>
      <label>${t('reg.email')}<input name="email" type="email" autocomplete="email"></label>
      <label>${t('reg.birth')}<input name="birth" type="date" required></label>
      <label>${t('reg.licence')}<input name="licence" type="number" min="1960" max="${new Date().getFullYear()}" required placeholder="2018"></label>
      <label class="check"><input type="checkbox" name="agree" required> <span>${t('reg.agree')}</span></label>
      <button class="btn wide" type="submit">${t('acc.register')}</button>
    </form>`}
  </section>`;
}

/* ---------- Admin ---------- */

function pageAdmin(q) {
  const tab = q.get('tab') || 'fines';
  const tabs = ['fines', 'clients', 'bookings', 'fleet', 'rules'];
  const pending = db().incidents.filter(i => i.kind === 'fine' && !i.clientId && i.status !== 'cancelled').length;
  const body = { fines: admFines, clients: admClients, bookings: admBookings, fleet: admFleet, rules: admRules }[tab](q);
  return `<section class="wrap admin">
    <div class="acc-head"><div><p class="muted">${t('adm.sub')}</p><h1>${t('adm.title')}</h1></div><button class="btn ghost sm" data-act="reset">${t('adm.reset')}</button></div>
    <div class="alert info">${icon('gear')}<div><p>${t('adm.note')}</p></div></div>
    <nav class="tabs">${tabs.map(k => `<a class="${k === tab ? 'on' : ''}" href="#/admin?tab=${k}">${t('adm.tab.' + k)}${k === 'fines' && pending ? ` <span class="count">${pending}</span>` : ''}</a>`).join('')}</nav>
    ${body}
  </section>`;
}

const clientOptions = sel => `<option value="">—</option>` + db().clients.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
const typeOptions = sel => Object.keys(db().rules.violationTypes).map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${t('vt.' + k)}${db().rules.violationTypes[k].gross ? ' ●' : ''}</option>`).join('');

function admFines() {
  const { incidents, bookings, cars } = db();
  const inbox = incidents.filter(i => i.kind === 'fine' && !i.clientId && i.status !== 'cancelled');
  const linked = incidents.filter(i => i.kind === 'fine' && i.clientId).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 30);
  return `<div class="panel"><h3>${t('adm.howTitle')}</h3><ol class="steps">${[1, 2, 3, 4].map(i => `<li>${t('adm.how' + i)}</li>`).join('')}</ol></div>
  <div class="row"><h2>${t('adm.inbox')} (${inbox.length})</h2><button class="btn sm" data-act="autolink" ${inbox.length ? '' : 'disabled'}>${t('adm.autolink')}</button></div>
  ${inbox.length ? `<div class="list">${inbox.map(i => {
    const m = R.matchFine(i, bookings, cars);
    const why = !m.carFound ? t('adm.noCar') : m.match ? t('adm.suggest', esc(clientById(m.match.clientId)?.name), dt(m.match.start), dt(m.match.end)) : m.candidates.length ? t('adm.several') : t('adm.noRental');
    return `<div class="row-item fine ${m.match ? 'ok' : 'warn'}">
      <div class="grow"><b>${t('vt.' + i.type)} · ${esc(i.amount)} ${esc(i.currency || 'GEL')}</b>
      <span>${esc(carById(i.carId)?.name || i.plate)}${i.plate && i.carId ? ' · ' + esc(i.plate) : ''} · ${dt(i.date)}${i.ref ? ' · ' + esc(i.ref) : ''}</span><span class="why">${why}</span></div>
      <div class="end">${m.match ? `<button class="btn sm" data-act="link" data-id="${i.id}" data-client="${m.match.clientId}" data-booking="${m.match.id}">${t('adm.confirmLink')}</button>` : ''}
        <select data-act="link-manual" data-id="${i.id}" aria-label="client">${clientOptions('')}</select>
        <button class="link" data-act="fine-cancel" data-id="${i.id}">${t('adm.cancelFine')}</button></div>
    </div>`;
  }).join('')}</div>` : `<div class="empty">${t('adm.inboxEmpty')}</div>`}
  <h2>${t('adm.addFine')}</h2>
  <form id="fine-form" class="panel form grid-form">
    <label>${t('adm.car')}<select name="car"><option value="">${t('adm.byPlate')}</option>${cars.map(c => `<option value="${c.id}">${esc(c.name)} · ${esc(c.year || '')}${c.plate ? ' · ' + esc(c.plate) : ''}</option>`).join('')}</select></label>
    <label>${t('adm.plate')}<input name="plate" placeholder="AA-000-AA" list="plates"></label>
    <datalist id="plates">${cars.filter(c => c.plate).map(c => `<option value="${esc(c.plate)}">${esc(c.name)}</option>`).join('')}</datalist>
    <label>${t('adm.when')}<input name="date" type="datetime-local" required></label>
    <label>${t('adm.type')}<select name="type">${typeOptions('speed_40_plus')}</select></label>
    <label>${t('adm.amount')}<input name="amount" type="number" min="0" step="1" required></label>
    <label>${t('adm.ref')}<input name="ref"></label>
    <button class="btn" type="submit">${t('adm.addAndMatch')}</button>
  </form>
  <details class="panel"><summary><b>${t('adm.csv')}</b></summary>
    <p class="hint">${t('adm.csvHint')}</p>
    <form id="csv-form" class="form"><textarea name="csv" rows="5" placeholder="RI-460-AA,2026-11-02 14:30,speed_40_plus,300,GE-CAM-1"></textarea><button class="btn sm" type="submit">${t('adm.csvImport')}</button></form>
  </details>
  <h2>${t('adm.linked')}</h2>
  <div class="table-wrap"><table><thead><tr><th>${t('adm.when')}</th><th>${t('adm.client')}</th><th>${t('adm.type')}</th><th>${t('adm.amount')}</th><th>${t('adm.by')}</th><th>${t('adm.status')}</th></tr></thead><tbody>
  ${linked.map(i => `<tr><td>${dt(i.date)}</td><td>${esc(clientById(i.clientId)?.name || '')}</td><td>${t('vt.' + i.type)}${R.isGross(i, db().rules) ? ' <span class="pill bad">' + t('adm.gross') + '</span>' : ''}</td><td>${esc(i.amount)} ${esc(i.currency || 'GEL')}</td><td>${t('adm.by.' + (i.linkedBy || 'operator'))}</td>
    <td><select data-act="fine-status" data-id="${i.id}">${['confirmed', 'disputed', 'cancelled'].map(s => `<option value="${s}" ${s === i.status ? 'selected' : ''}>${t('fs.' + s)}</option>`).join('')}</select></td></tr>`).join('')}
  </tbody></table></div>`;
}

function admClients() {
  const rules = db().rules;
  return `<div class="table-wrap"><table class="clients"><thead><tr><th>${t('adm.client')}</th><th>${t('adm.tier')}</th><th>${t('acc.discount')}</th><th>${t('acc.spent')}</th><th>${t('acc.clean')}</th><th>${t('adm.window')}</th><th>${t('adm.flags')}</th></tr></thead><tbody>
  ${db().clients.map(c => {
    const st = statusOf(c);
    return `<tr><td><b>${esc(c.name)}</b><br><small>${esc(c.phone)}</small></td><td>${badge(st)}</td><td>${st.discount}%</td><td>${money(st.progress.spend)}</td><td>${st.progress.rentals}</td>
      <td class="${st.suspended ? 'bad' : ''}">${st.reasons.gross}/${rules.penalty.maxGross} · ${st.reasons.atFault}/${rules.penalty.maxAtFault}${st.suspendedUntil ? '<br><small>' + t('adm.until', dday(st.suspendedUntil)) + '</small>' : ''}</td>
      <td class="flags">
        <label class="check"><input type="checkbox" data-act="toggle" data-field="investor" data-id="${c.id}" ${c.investor ? 'checked' : ''}> ${t('status.investor')}</label>
        <label class="check"><input type="checkbox" data-act="toggle" data-field="educationPassed" data-id="${c.id}" ${c.educationPassed ? 'checked' : ''}> ${t('status.education')}</label>
        <label>${t('adm.override')} <select data-act="override" data-id="${c.id}"><option value="">—</option>${rules.tiers.map(x => `<option value="${x.id}" ${c.tierOverride === x.id ? 'selected' : ''}>${tierName(x.id)}</option>`).join('')}</select></label>
      </td></tr>`;
  }).join('')}</tbody></table></div>
  <h2>${t('adm.addAccident')}</h2>
  <form id="accident-form" class="panel form grid-form">
    <label>${t('adm.client')}<select name="client" required>${clientOptions('')}</select></label>
    <label>${t('adm.when')}<input name="date" type="datetime-local" required></label>
    <label class="check"><input type="checkbox" name="atFault" checked> ${t('adm.atFault')}</label>
    <label>${t('adm.note2')}<input name="note"></label>
    <button class="btn" type="submit">${t('adm.save')}</button>
  </form>`;
}

function admBookings() {
  const list = [...db().bookings].sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  const next = { unpaid: [], paid: ['active', 'cancelled'], active: ['completed'], completed: [], cancelled: [] };
  return `<div class="table-wrap"><table><thead><tr><th>${t('adm.client')}</th><th>${t('adm.car')}</th><th>${t('adm.period')}</th><th>${t('book.total')}</th><th>${t('car.deposit')}</th><th>${t('adm.status')}</th></tr></thead><tbody>
  ${list.map(b => `<tr><td>${esc(clientById(b.clientId)?.name || '')}</td><td>${esc(carById(b.carId)?.name || '')}</td><td>${dt(b.start)}<br>${dt(b.end)}</td><td>${money(b.total)}</td><td>${money(b.deposit)}<br><small>${t('dep.' + (b.depositState || 'none'))}</small></td>
    <td><span class="pill s-${b.status}">${bookingStatus(b)}</span> ${next[b.status].map(s => `<button class="link" data-act="bstatus" data-id="${b.id}" data-to="${s}">${t('adm.to.' + s)}</button>`).join(' ')}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function admFleet() {
  const rules = db().rules;
  return `<p class="muted">${t('adm.fleetNote')}</p>${db().cars.map(car => `<form class="panel form grid-form car-form" data-id="${car.id}">
    <h3 class="full">${esc(car.name)} ${esc(car.year || '')} · ${t('adm.listed', money(car.listedPerDay))} · ${t('car.deposit')} ${money(R.deposit(car, rules))}</h3>
    <label>${t('adm.plate')}<input name="plate" value="${esc(car.plate)}"></label>
    <label>${t('adm.class')}<select name="class">${R.CLASSES.map(k => `<option value="${k}" ${k === car.class ? 'selected' : ''}>${t('class.' + k)}</option>`).join('')}</select></label>
    <label>${t('spec.power')} (${t('spec.hp')})<input name="hp" type="number" value="${esc(car.hp ?? '')}"></label>
    <label>${t('adm.depOverride')}<input name="depositOverride" type="number" value="${esc(car.depositOverride ?? '')}" placeholder="${t('adm.byRule')}"></label>
    <label>${t('adm.address')}<input name="address" value="${esc(car.address)}"></label>
    <label>${t('adm.lat')}<input name="lat" type="number" step="any" value="${esc(car.lat ?? '')}"></label>
    <label>${t('adm.lon')}<input name="lon" type="number" step="any" value="${esc(car.lon ?? '')}"></label>
    <label>${t('adm.status')}<select name="status">${['available', 'service', 'hidden'].map(s => `<option value="${s}" ${s === car.status ? 'selected' : ''}>${t('cs.' + s)}</option>`).join('')}</select></label>
    <div class="full price-grid"><b>TPL</b>${rules.plans.map(p => `<label>${t('plan.' + p.id)}<input name="tpl_${p.id}" type="number" value="${esc(car.prices.tpl[p.id] ?? '')}"></label>`).join('')}
      <b>CASCO</b>${rules.plans.map(p => `<label>${t('plan.' + p.id)}<input name="casco_${p.id}" type="number" value="${esc(car.prices.casco?.[p.id] ?? '')}"></label>`).join('')}</div>
    <button class="btn sm" type="submit">${t('adm.save')}</button>
  </form>`).join('')}`;
}

function admRules() {
  const r = db().rules;
  return `<form id="rules-form" class="form">
    <div class="panel"><h3>${t('adm.tiers')}</h3><div class="table-wrap"><table><thead><tr><th></th><th>${t('adm.minSpend')}</th><th>${t('adm.minRentals')}</th><th>${t('adm.combine')}</th><th>${t('acc.discount')}, %</th></tr></thead><tbody>
    ${r.tiers.map((x, i) => `<tr><td>${tierName(x.id)}</td><td><input name="t${i}_minSpend" type="number" value="${x.minSpend}"></td><td><input name="t${i}_minRentals" type="number" value="${x.minRentals}"></td>
      <td><select name="t${i}_combine"><option value="and" ${x.combine === 'and' ? 'selected' : ''}>${t('adm.and')}</option><option value="or" ${x.combine === 'or' ? 'selected' : ''}>${t('adm.or')}</option></select></td>
      <td><input name="t${i}_discount" type="number" step="0.5" value="${x.discount}"></td></tr>`).join('')}
    <tr><td>${t('status.education')}</td><td colspan="3">${t('adm.passScore')} <input name="edu_pass" type="number" value="${r.education.passScore}" style="width:5em"> / ${COURSE.length}</td><td><input name="edu_discount" type="number" step="0.5" value="${r.education.discount}"></td></tr>
    <tr><td>${t('status.investor')}</td><td colspan="3">${t('adm.manual')}</td><td><input name="inv_discount" type="number" step="0.5" value="${r.investor.discount}"></td></tr>
    </tbody></table></div><p class="hint">${t('adm.tiersHint')}</p></div>
    <div class="panel grid-form"><h3 class="full">${t('adm.penalty')}</h3>
      <label>${t('adm.windowDays')}<input name="windowDays" type="number" value="${r.penalty.windowDays}"></label>
      <label>${t('adm.maxGross')}<input name="maxGross" type="number" value="${r.penalty.maxGross}"></label>
      <label>${t('adm.maxAtFault')}<input name="maxAtFault" type="number" value="${r.penalty.maxAtFault}"></label>
      <label>${t('adm.fee')}<input name="fineFeePct" type="number" step="0.5" value="${r.fineFeePct}"></label>
      <label class="check full"><input type="checkbox" name="keepEducation" ${r.penalty.keepEducation ? 'checked' : ''}> ${t('adm.keepEdu')}</label>
      <div class="full"><h4>${t('adm.grossTypes')}</h4><div class="chips">${Object.entries(r.violationTypes).map(([k, v]) => `<label class="chip check"><input type="checkbox" name="vt_${k}" ${v.gross ? 'checked' : ''}> ${t('vt.' + k)}</label>`).join('')}</div></div>
    </div>
    <div class="panel grid-form"><h3 class="full">${t('adm.deposits')}</h3>
      ${R.CLASSES.map(k => `<label>${t('class.' + k)}<input name="dep_${k}" type="number" value="${r.deposit.byClass[k]}"></label>`).join('')}
      <p class="full hint">${t('adm.powerBands')}: ${r.deposit.powerBands.map(b => (b.upTo ? '≤' + b.upTo : '>' + r.deposit.powerBands[r.deposit.powerBands.length - 2].upTo) + ' ' + t('spec.hp') + ' +' + money(b.add)).join(' · ')}</p>
      ${r.deposit.powerBands.map((b, i) => `<label>${t('adm.band', i + 1)}<input name="pb_add_${i}" type="number" value="${b.add}"></label>`).join('')}
    </div>
    <button class="btn" type="submit">${t('adm.saveRules')}</button>
  </form>`;
}

function notFound() { return `<section class="wrap"><h1>404</h1><a href="#/">${t('nav.home')}</a></section>`; }

/* ---------- Router ---------- */

function render() {
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const q = new URLSearchParams(qs || '');
  const [, page, id] = path.split('/');
  const views = { '': pageHome, cars: () => pageCars(q), car: () => pageCar(id, q), book: () => pageBook(id, q), club: pageClub, support: pageSupport, account: () => pageAccount(q), admin: () => pageAdmin(q) };
  shell();
  main.innerHTML = (views[page || ''] || notFound)();
  const bf = $('#book-form'); if (bf) renderQuote(bf);
  if (!render.keepScroll) window.scrollTo(0, 0);
  render.keepScroll = false;
}
const rerender = () => { render.keepScroll = true; render(); };
const go = hash => { if (location.hash === hash) render(); else location.hash = hash; };

/* ---------- Actions ---------- */

async function payBooking(b) {
  const car = carById(b.carId);
  const res = await pay({ amount: b.total, deposit: b.deposit, title: `${car.name} · ${t('plan.' + b.planId)}`, t, money });
  if (!res.ok) { toast(t('pay.cancelled')); return false; }
  S.upsert('bookings', { id: b.id, status: 'paid', paidAt: new Date().toISOString(), depositState: 'held', payment: { ref: res.ref, card: res.last4, provider: res.provider } });
  toast(t('pay.ok'));
  return true;
}

// Two-step confirmation inside the page (browser confirm() is blocked in some embeds).
function armed(btn) {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = '1'; btn.textContent = t('ui.sure');
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; rerender(); } }, 4000);
  return false;
}

document.addEventListener('click', async e => {
  const l = e.target.closest('[data-lang]');
  if (l) { setLang(l.dataset.lang); rerender(); return; }
  const a = e.target.closest('[data-act]');
  if (!a || a.tagName === 'SELECT' || a.type === 'checkbox') return;
  const { act, id } = a.dataset;
  const d = db();
  if (act === 'demo') { S.signIn(id); go('#/account'); }
  if (act === 'signout') { S.signOut(); go('#/'); }
  if (act === 'pay') { const b = d.bookings.find(x => x.id === id); if (await payBooking(b)) rerender(); }
  if (act === 'cancel') { if (armed(a)) { const b = d.bookings.find(x => x.id === id); S.upsert('bookings', { id, status: 'cancelled', depositState: b.depositState === 'held' ? 'released' : 'none' }); rerender(); } }
  if (act === 'dispute') { S.upsert('incidents', { id, status: 'disputed' }); toast(t('rec.disputeSent')); rerender(); }
  if (act === 'reset') { if (armed(a)) { S.reset(); rerender(); } }
  if (act === 'autolink') {
    const before = d.incidents.filter(i => i.kind === 'fine' && !i.clientId).length;
    d.incidents = R.autoLink(d.incidents, d.bookings, d.cars); S.save();
    const after = d.incidents.filter(i => i.kind === 'fine' && !i.clientId).length;
    toast(t('adm.autolinked', before - after, after)); rerender();
  }
  if (act === 'link') { S.upsert('incidents', { id, clientId: a.dataset.client, bookingId: a.dataset.booking, carId: d.bookings.find(b => b.id === a.dataset.booking)?.carId, status: 'confirmed', linkedBy: 'operator' }); toast(t('adm.linkedOk')); rerender(); }
  if (act === 'fine-cancel') { S.upsert('incidents', { id, status: 'cancelled' }); rerender(); }
  if (act === 'bstatus') {
    const b = d.bookings.find(x => x.id === id); const to = a.dataset.to;
    const patch = { id, status: to };
    if (to === 'completed') { patch.endedAt = new Date(Math.min(Date.now(), Date.parse(b.end))).toISOString(); patch.depositState = 'released'; patch.rentalPaid = b.rentalPaid; }
    if (to === 'cancelled') patch.depositState = 'released';
    S.upsert('bookings', patch); rerender();
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.closest('#book-form')) { renderQuote(el.closest('#book-form')); return; }
  const act = el.dataset.act; if (!act) return;
  const id = el.dataset.id;
  if (act === 'toggle') { S.upsert('clients', { id, [el.dataset.field]: el.checked }); rerender(); }
  if (act === 'override') { S.upsert('clients', { id, tierOverride: el.value || null }); rerender(); }
  if (act === 'fine-status') { S.upsert('incidents', { id, status: el.value }); rerender(); }
  if (act === 'link-manual' && el.value) {
    const fine = db().incidents.find(i => i.id === id);
    const b = db().bookings.find(x => x.clientId === el.value && R.matchFine(fine, [x], db().cars).match);
    S.upsert('incidents', { id, clientId: el.value, bookingId: b?.id || null, carId: b?.carId || fine.carId || db().cars.find(c => fine.plate && R.norm(c.plate) === R.norm(fine.plate))?.id || null, status: 'confirmed', linkedBy: 'operator' });
    toast(t('adm.linkedOk')); rerender();
  }
});

document.addEventListener('input', e => { const f = e.target.closest('#book-form'); if (f) renderQuote(f); });

document.addEventListener('submit', async e => {
  const f = e.target; const fd = new FormData(f); const d = db();
  e.preventDefault();
  if (f.id === 'login-form') {
    const who = String(fd.get('who')).trim().toLowerCase(); const digits = who.replace(/\D/g, '');
    const c = d.clients.find(x => (x.email && x.email.toLowerCase() === who) || (digits.length >= 6 && x.phone.replace(/\D/g, '').endsWith(digits.slice(-9))));
    if (!c) { toast(t('reg.notFound')); return; }
    if (fd.get('code') !== '0000') { toast(t('reg.badCode')); return; }
    S.signIn(c.id); goNext();
  }
  if (f.id === 'register-form') {
    const birth = Date.parse(fd.get('birth')); const age = (Date.now() - birth) / (365.25 * R.DAY);
    const exp = new Date().getFullYear() - +fd.get('licence');
    if (age < 21) { toast(t('reg.tooYoung')); return; }
    if (exp < 2) { toast(t('reg.noExp')); return; }
    const phone = String(fd.get('phone')).trim();
    if (d.clients.some(x => x.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''))) { toast(t('reg.exists')); return; }
    const c = { id: S.uid('cl'), name: String(fd.get('name')).trim(), phone, email: String(fd.get('email') || '').trim(), birth: fd.get('birth'), licenceSince: +fd.get('licence'), createdAt: new Date().toISOString(), offerAcceptedAt: new Date().toISOString() };
    S.upsert('clients', c); S.signIn(c.id); toast(t('reg.welcome')); goNext();
  }
  if (f.id === 'profile-form') { S.upsert('clients', { id: me().id, name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email') }); toast(t('prof.saved')); rerender(); }
  if (f.id === 'book-form') {
    const { q, start, end, clash } = renderQuote(f);
    if (clash) return;
    const b = { id: S.uid('bk'), clientId: me().id, carId: f.dataset.car, planId: fd.get('plan'), qty: q.qty, insurance: fd.get('ins'), delivery: fd.get('delivery'),
      start: new Date(start).toISOString(), end: new Date(end).toISOString(), status: 'unpaid', rental: q.rental, discountPct: q.pct, rentalPaid: q.rentalPaid,
      deliveryFee: q.deliveryFee, extras: fd.getAll('extra'), extrasFee: q.extrasFee, total: q.total, deposit: q.deposit, depositState: 'none', createdAt: new Date().toISOString() };
    S.upsert('bookings', b);
    await payBooking(b);
    go('#/account?tab=bookings');
  }
  if (f.id === 'course-form') {
    const score = COURSE.reduce((s, qq, i) => s + (+fd.get('q' + i) === qq.right ? 1 : 0), 0);
    const pass = score >= d.rules.education.passScore;
    if (pass) S.upsert('clients', { id: me().id, educationPassed: true, educationScore: score, educationAt: new Date().toISOString() });
    toast(t(pass ? 'course.ok' : 'course.fail', score, COURSE.length));
    go('#/account?tab=course');
  }
  if (f.id === 'fine-form') {
    if (!fd.get('car') && !String(fd.get('plate')).trim()) { toast(t('adm.needCar')); return; }
    const inc = { id: S.uid('in'), kind: 'fine', carId: fd.get('car') || null, plate: String(fd.get('plate')).trim(), date: new Date(fd.get('date')).toISOString(), type: fd.get('type'), amount: +fd.get('amount'), currency: 'GEL', ref: fd.get('ref'), status: 'new', clientId: null, createdAt: new Date().toISOString() };
    S.upsert('incidents', inc); toast(t('adm.fineAdded')); rerender();
  }
  if (f.id === 'csv-form') {
    const rows = String(fd.get('csv')).split(/\r?\n/).map(r => r.split(/[;,\t]/).map(s => s.trim())).filter(r => r.length >= 4 && r[0]);
    let n = 0;
    for (const [plate, when, type, amount, ref] of rows) {
      const ts = Date.parse(when.replace(' ', 'T')); if (isNaN(ts)) continue;
      d.incidents.push({ id: S.uid('in'), kind: 'fine', plate, date: new Date(ts).toISOString(), type: d.rules.violationTypes[type] ? type : 'other_gross', amount: +amount || 0, currency: 'GEL', ref: ref || '', status: 'new', clientId: null, createdAt: new Date().toISOString() });
      n++;
    }
    d.incidents = R.autoLink(d.incidents, d.bookings, d.cars); S.save();
    toast(t('adm.csvDone', n)); rerender();
  }
  if (f.id === 'accident-form') {
    S.upsert('incidents', { id: S.uid('in'), kind: 'accident', clientId: fd.get('client'), date: new Date(fd.get('date')).toISOString(), atFault: !!fd.get('atFault'), note: fd.get('note'), status: 'confirmed', linkedBy: 'operator' });
    toast(t('adm.saved')); rerender();
  }
  if (f.classList.contains('car-form')) {
    const car = carById(f.dataset.id); const num = k => (fd.get(k) === '' ? null : +fd.get(k));
    const prices = { tpl: {}, casco: {} };
    d.rules.plans.forEach(p => { const a = num('tpl_' + p.id), b = num('casco_' + p.id); if (a != null) prices.tpl[p.id] = a; if (b != null) prices.casco[p.id] = b; });
    S.saveCar(car.id, { plate: fd.get('plate'), class: fd.get('class'), hp: num('hp'), depositOverride: num('depositOverride'), address: fd.get('address'), lat: num('lat'), lon: num('lon'), status: fd.get('status'), prices });
    toast(t('adm.saved')); rerender();
  }
  if (f.id === 'rules-form') {
    const r = JSON.parse(JSON.stringify(d.rules)); const n = k => +fd.get(k);
    r.tiers.forEach((x, i) => { x.minSpend = n(`t${i}_minSpend`); x.minRentals = n(`t${i}_minRentals`); x.combine = fd.get(`t${i}_combine`); x.discount = n(`t${i}_discount`); });
    r.education.passScore = n('edu_pass'); r.education.discount = n('edu_discount'); r.investor.discount = n('inv_discount');
    r.penalty.windowDays = n('windowDays'); r.penalty.maxGross = n('maxGross'); r.penalty.maxAtFault = n('maxAtFault'); r.penalty.keepEducation = !!fd.get('keepEducation');
    r.fineFeePct = n('fineFeePct');
    Object.keys(r.violationTypes).forEach(k => { r.violationTypes[k].gross = !!fd.get('vt_' + k); });
    R.CLASSES.forEach(k => { r.deposit.byClass[k] = n('dep_' + k); });
    r.deposit.powerBands.forEach((b, i) => { b.add = n('pb_add_' + i); });
    S.setRules(r); toast(t('adm.saved')); rerender();
  }
});

function goNext() {
  const next = new URLSearchParams(location.hash.split('?')[1] || '').get('next');
  go(next && next.startsWith('#/') ? next : '#/account');
}

window.addEventListener('hashchange', render);

// Start: load the live fleet from the site's catalogue, then draw.
main.innerHTML = '<section class="wrap"><p class="muted">…</p></section>';
loadFleet()
  .then(cars => { S.init(cars); render(); })
  .catch(err => { main.innerHTML = `<section class="wrap"><div class="alert">${esc(t('err.fleet'))}<br><small>${esc(err.message)}</small></div></section>`; });
