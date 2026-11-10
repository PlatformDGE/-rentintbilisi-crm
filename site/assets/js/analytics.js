// Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
// Our own site analytics: no Google, no cookies, no names or phone numbers.
// Short anonymous events go to our Google Sheet (apps-script/site-analytics.gs)
// and are read only by admins inside the CRM. If the endpoint is down, the site does not notice.
import { ANALYTICS_URL, CHANNELS } from './config.js';
import { loadFeed } from './store.js';

const MAX_ERRORS = 5;
let queue = [];
let timer = 0;
let errors = 0;
let ctx = null;
let lastPath = '';
let searchTimer = 0;

const store = (area, key, make) => {
  try {
    let v = window[area].getItem(key);
    if (!v) { v = make(); window[area].setItem(key, v); return [v, true]; }
    return [v, false];
  } catch { return [make(), true]; }
};
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// Where a visit came from: link tags first, then the page that sent the visitor.
const SOURCES = [
  [/instagram\./, 'instagram'], [/(^|\.)facebook\.|^fb\.|^l\.facebook|^m\.facebook/, 'facebook'],
  [/tiktok\./, 'tiktok'], [/youtube\.|youtu\.be/, 'youtube'], [/threads\.(net|com)/, 'threads'],
  [/^t\.me$|telegram\./, 'telegram'], [/whatsapp\.|wa\.me/, 'whatsapp'], [/viber\./, 'viber'],
  [/google\./, 'google'], [/yandex\./, 'yandex'], [/bing\./, 'bing'],
  [/myhome\.ge/, 'myhome'], [/ss\.ge/, 'ss.ge'],
];
export function sourceOf(href, referrer) {
  const own = new URL(href);
  const p = own.searchParams;
  if (p.get('utm_source')) return { src: p.get('utm_source').toLowerCase(), med: p.get('utm_medium') || '', cmp: p.get('utm_campaign') || '' };
  if (!referrer) return { src: 'direct', med: '', cmp: '' };
  let ref;
  try { ref = new URL(referrer); } catch { return { src: 'direct', med: '', cmp: '' }; }
  if (ref.host === own.host) {
    // A shared link opens our preview page first, which forwards here.
    if (/\/share\//.test(ref.pathname)) {
      const rp = ref.searchParams;
      return { src: rp.get('utm_source') || 'share', med: rp.get('utm_medium') || '', cmp: rp.get('utm_campaign') || '' };
    }
    return { src: 'direct', med: '', cmp: '' };
  }
  const host = ref.host.replace(/^www\./, '');
  const hit = SOURCES.find(([re]) => re.test(host));
  return { src: hit ? hit[1] : host, med: '', cmp: '' };
}

function context() {
  if (ctx) return ctx;
  const [visitor, isNew] = store('localStorage', 'hig:vid', rid);
  const [session, fresh] = store('sessionStorage', 'hig:sid', rid);
  let origin;
  if (fresh) {
    origin = sourceOf(location.href, document.referrer);
    try { sessionStorage.setItem('hig:src', JSON.stringify(origin)); } catch { /* fine */ }
  } else {
    try { origin = JSON.parse(sessionStorage.getItem('hig:src')); } catch { origin = null; }
    origin ||= { src: 'direct', med: '', cmp: '' };
  }
  ctx = { visitor, session, isNew, ...origin };
  return ctx;
}

// The standalone map lives at /map/; everything else is the one-page site.
const pagePath = () => (/\/map\/?$/.test(location.pathname) ? '/map/' : '') + (location.hash || (/\/map\/?$/.test(location.pathname) ? '' : '#/'));
const device = () => (matchMedia('(max-width: 759px)').matches ? 'mobile' : matchMedia('(max-width: 1023px)').matches ? 'tablet' : 'desktop');

function track(type, extra = {}) {
  if (!ANALYTICS_URL) return;
  const c = context();
  queue.push({
    t: type, v: c.visitor, s: c.session, nw: c.isNew, src: c.src, med: c.med, cmp: c.cmp,
    p: pagePath(), lang: document.documentElement.lang || '',
    th: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', dev: device(),
    ...extra,
  });
  c.isNew = false;
  if (queue.length >= 10) flush();
  else if (!timer) timer = setTimeout(flush, 4000);
}

function flush(leaving = false) {
  clearTimeout(timer); timer = 0;
  if (!queue.length || !ANALYTICS_URL) return;
  const body = JSON.stringify({ events: queue.splice(0, 50) });
  try {
    // text/plain needs no preflight; Apps Script reads the raw body.
    if (leaving && navigator.sendBeacon && navigator.sendBeacon(ANALYTICS_URL, body)) return;
    fetch(ANALYTICS_URL, { method: 'POST', body, mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  } catch { /* analytics must never break the site */ }
}

// Listing facts the report groups by: direction and agent.
async function listingInfo(id) {
  try {
    const x = (await loadFeed()).byId.get(id);
    return x ? { l: id, sv: x.service || '', ag: x.agent?.telegram || x.agent?.name || '' } : { l: id };
  } catch { return { l: id }; }
}
const listingOnScreen = el => {
  const scope = el.closest('[data-listing]');
  if (scope) return scope.dataset.listing;
  const link = el.closest('.card, .tm-wrap, .map-card')?.querySelector('a[href^="#/listing/"]');
  if (link) return decodeURIComponent(link.getAttribute('href').slice(10));
  const m = location.hash.match(/^#\/listing\/([^?/]+)/);
  return m ? decodeURIComponent(m[1]) : '';
};

function onRoute() {
  const path = pagePath();
  if (path === lastPath) return;
  lastPath = path;
  track('pageview');
  const m = path.match(/^#\/listing\/([^?/]+)/);
  if (m) listingInfo(decodeURIComponent(m[1])).then(info => track('listing', info));
}

// What a click means: a way of reaching us, a share, a favourite.
const CHANNEL_NAMES = new Set(Object.values(CHANNELS).map(c => c.toLowerCase()));
function channelOf(a) {
  const href = a.getAttribute('href') || '';
  if (a.dataset.lead) return a.dataset.lead;
  if (href.startsWith('tel:')) return 'phone';
  if (/wa\.me|whatsapp/.test(href)) return 'whatsapp';
  const tg = href.match(/^https:\/\/t\.me\/([^/?#]+)/);
  if (tg && tg[1] !== 'share') return CHANNEL_NAMES.has(tg[1].toLowerCase()) ? '' : 'telegram';
  if (/google\.com\/maps/.test(href)) return 'office';
  return '';
}

async function onClick(e) {
  const el = e.target.closest?.('a, button');
  if (!el) return;
  const id = listingOnScreen(el);
  const share = el.closest('.share-target[data-target]');
  if (share) return track('share', { ...(id ? await listingInfo(id) : {}), x: { ch: share.dataset.target } });
  if (el.matches('[data-copy]') && el.closest('.share-wrap')) return track('share', { ...(id ? await listingInfo(id) : {}), x: { ch: 'copy' } });
  if (el.matches('[data-fav]')) {
    // The button flips before this runs in the same click, so read it a moment later.
    setTimeout(async () => track('fav', { ...(await listingInfo(el.dataset.fav)), x: { on: el.getAttribute('aria-pressed') === 'true' } }), 0);
    return;
  }
  if (el.tagName !== 'A') return;
  const ch = channelOf(el);
  if (ch) return track('contact', { ...(id ? await listingInfo(id) : {}), x: { ch } });
  // Our social accounts, portals and Telegram channels: interest, not a direct request.
  const tg = (el.getAttribute('href') || '').match(/^https:\/\/t\.me\/([^/?#]+)/);
  if (tg && CHANNEL_NAMES.has(tg[1].toLowerCase())) return track('social', { x: { ch: 'telegram:' + tg[1] } });
  if (el.dataset.social) return track('social', { x: { ch: el.dataset.social } });
  if (el.matches('.foot-chip')) {
    const name = (el.querySelector('b')?.textContent || '').trim().toLowerCase();
    const handle = (el.querySelector('small')?.textContent || '').trim();
    track('social', { x: { ch: handle.startsWith('@') || /\./.test(handle) && name !== 'myhome.ge' && name !== 'ss.ge' ? `${name} ${handle}` : name } });
  }
}

// The catalog reports each finished search; the last one in a burst of typing is kept.
function onResults(e) {
  const { service, params, count } = e.detail || {};
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (!params) return; // an unfiltered list is browsing, not a search
    track('search', { sv: service, x: { q: params, n: count } });
  }, 1500);
}

function onError(message, where) {
  if (errors >= MAX_ERRORS) return;
  errors++;
  track('error', { x: { msg: String(message || 'error').slice(0, 200), at: String(where || '').slice(0, 120) } });
}

function measure() {
  let lcp = 0;
  try {
    new PerformanceObserver(list => { const e = list.getEntries().pop(); if (e) lcp = Math.round(e.startTime); })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* not every browser has it */ }
  addEventListener('load', () => setTimeout(() => {
    const nav = performance.getEntriesByType?.('navigation')?.[0];
    const load = nav ? Math.round(nav.loadEventEnd || nav.domComplete) : 0;
    if (load > 0) track('perf', { x: { load, lcp } });
  }, 3000), { once: true });
}

export function initAnalytics() {
  // Our own automated tests and robots are not visitors.
  let testing = false;
  try { testing = localStorage.getItem('hig:analytics-test') === '1'; } catch { /* fine */ }
  if (!ANALYTICS_URL || (navigator.webdriver && !testing)) return;
  try {
    addEventListener('hashchange', onRoute);
    document.addEventListener('click', onClick, true);
    document.addEventListener('hig:results', onResults);
    addEventListener('error', e => onError(e.message, `${(e.filename || '').split('/').pop()}:${e.lineno}`));
    addEventListener('unhandledrejection', e => onError(e.reason?.message || e.reason, 'promise'));
    addEventListener('pagehide', () => flush(true));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
    measure();
    onRoute();
  } catch { /* never break the site */ }
}
