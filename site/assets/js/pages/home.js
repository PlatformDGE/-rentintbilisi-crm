import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { SERVICES, GROUPS, telegramHref, CONTACT } from '../config.js';
import { esc, rail, serviceIcon } from '../components.js';
import { countBy, compactMoney, num, itemsFor, recentIds, parseFilters, applyFilters } from '../store.js';

/** Budget steps from the real price distribution of a service (rounded quantiles). */
function budgets(pool) {
  const prices = pool.map(x => x.price_usd).filter(Boolean).sort((a, b) => a - b);
  if (prices.length < 4) return [];
  const nice = v => { const p = 10 ** Math.max(1, Math.floor(Math.log10(v)) - 1); return Math.round(v / p) * p; };
  return [...new Set([0.25, 0.5, 0.7, 0.85, 0.95].map(q => nice(prices[Math.floor(q * (prices.length - 1))])))];
}

const allServices = () => Object.values(GROUPS).flatMap(g => g.services);

// Finder tabs: live directions only; cars open car rental (sale is one tab away there).
const FINDER = ['rent', 'sale', 'daily', 'commercial', 'car-rent'];
const BEDS = ['0', '1', '2', '3', '4'];

/** The home search: direction tabs, free text, district, budget, bedrooms, and a live result count. */
function finderBody(data, service) {
  const pool = itemsFor(data, service);
  const isCar = SERVICES[service].group === 'auto';
  const districts = countBy(pool, 'district').slice(0, 16);
  const steps = budgets(pool);
  const period = pool.find(x => x.period)?.period;
  const rooms = !isCar && service !== 'commercial' && pool.some(x => x.rooms != null);
  const nocom = !isCar && pool.some(x => x.no_commission);
  const pets = service === 'rent' && pool.some(x => x.pets);
  return `
    <label class="fd-search">${icon('search')}<input name="q" type="search" autocomplete="off" placeholder="${esc(t(isCar ? 'cat.search.car' : 'cat.search'))}" aria-label="${esc(t(isCar ? 'cat.search.car' : 'cat.search'))}"></label>
    <div class="fd-row">
      ${districts.length ? `<label class="fd-field"><span>${t('home.where')}</span><span class="fd-sel"><select name="district"><option value="">${t('home.where.any')}</option>${districts.map(([d, n]) => `<option value="${esc(d)}">${esc(d)} · ${n}</option>`).join('')}</select>${icon('down')}</span></label>` : ''}
      ${steps.length ? `<label class="fd-field"><span>${t('home.budget')}</span><span class="fd-sel"><select name="max"><option value="">${t('home.budget.any')}</option>${steps.map(v => `<option value="${v}">${compactMoney(v)}${period ? ' ' + t('period.' + period) : ''}</option>`).join('')}</select>${icon('down')}</span></label>` : ''}
      ${rooms ? `<div class="fd-field fd-beds" role="group" aria-label="${esc(t('f.beds'))}"><span>${t('f.beds')}</span><div class="fd-seg">${BEDS.map(b => `<button type="button" data-bed="${b}" aria-pressed="false">${b === '0' ? t('f.studio') : b === '4' ? '4+' : b}</button>`).join('')}</div></div>` : ''}
    </div>
    ${nocom || pets ? `<div class="fd-chips">
      ${nocom ? `<button type="button" class="fd-chip" data-flag="nocom" aria-pressed="false">${icon('percent')}${t('f.commission')}</button>` : ''}
      ${pets ? `<button type="button" class="fd-chip" data-flag="pets" aria-pressed="false">${icon('heart')}${t('f.pets')}</button>` : ''}
    </div>` : ''}
    <button class="btn fd-go" type="submit">${icon('search')}<span class="fd-go-label"></span>${icon('arrow')}</button>`;
}

// Home page entrances: one big tile per space. Cars join both car services.
const GATES = [
  { id: 'rent', services: ['rent'] },
  { id: 'sale', services: ['sale'] },
  { id: 'new', services: ['new'] },
  { id: 'commercial', services: ['commercial'] },
  { id: 'daily', services: ['daily'] },
  { id: 'cars', services: ['car-rent', 'car-sale'], icon: 'car' },
];

function gateTile(g, i, data) {
  const live = g.services.filter(s => SERVICES[s].live);
  const target = live[0] || g.services[0];
  const count = g.services.reduce((n, s) => n + (data.counts?.[s] || 0), 0);
  const photo = live.flatMap(s => itemsFor(data, s)).filter(x => x.photos?.length).sort((a, b) => b._ts - a._ts)[0]?.photos[0];
  const name = g.id === 'cars' ? t('nav.auto') : t('svc.' + g.id + '.short');
  const desc = g.id === 'cars' ? t('group.auto.desc') : t('svc.' + g.id + '.desc');
  return `<a role="listitem" class="gate-tile${photo ? '' : ' no-photo'}${live.length ? '' : ' soon'}" href="#/${target}" style="--d:${i * 60}ms">
    ${photo ? `<img src="${esc(photo)}" alt="" ${i < 2 ? 'fetchpriority="high"' : 'loading="lazy"'}>` : ''}
    <span class="gate-ico">${icon(g.icon || serviceIcon(g.id))}</span>
    <span class="gate-text"><b>${esc(name)}</b><small>${esc(desc)}</small></span>
    <span class="gate-meta"><em>${live.length ? t('cat.count', count) : t('svc.soon')}</em>${icon('arrow')}</span>
  </a>`;
}

export function renderHome(root, data) {
  const live = data.items.length;
  const districts = countBy(data.items, 'district');
  const nocom = Math.round((data.items.filter(x => x.no_commission).length / Math.max(1, live)) * 100);
  const fresh = s => itemsFor(data, s).slice().sort((a, b) => b._ts - a._ts).filter(x => x.photos?.length).slice(0, 12);
  const recent = recentIds().map(id => data.byId.get(id)).filter(Boolean);
  const districtPhoto = d => data.items.find(x => x.district === d && x.photos?.length)?.photos[0];
  const firstLive = allServices().find(s => SERVICES[s].live) || 'rent';

  root.innerHTML = `
<section class="gate">
  <div class="container">
    <h1 class="gate-title">${t('home.gate.title')}</h1>
    <div class="gate-grid" role="list">
      ${GATES.map((g, i) => gateTile(g, i, data)).join('')}
    </div>
  </div>
</section>

<section class="section finder-section">
  <div class="container">
    <form class="finder" id="finder" novalidate>
      <div class="fd-head">
        <h2>${t('home.finder.title')}</h2>
        <p class="fd-facts"><span class="live-dot"></span><b>${num(live)}</b> ${t('home.stat.live')}<span class="fd-hourly"><i></i>${t('home.finder.hourly')}</span><i></i><b>${nocom}%</b> ${t('home.stat.commission')}</p>
      </div>
      <div class="fd-tabs" role="tablist">${FINDER.filter(s => SERVICES[s].live).map((s, i) => `<button type="button" role="tab" data-svc="${s}" aria-selected="${i === 0}">${icon(serviceIcon(s))}<span>${s === 'car-rent' ? t('nav.auto') : t('svc.' + s + '.short')}</span></button>`).join('')}</div>
      <div class="fd-body"></div>
    </form>
  </div>
</section>

${rail('rail-recent', t('home.recent'), recent, '')}
${allServices().filter(s => SERVICES[s].live).map(s => rail('rail-' + s, t('home.fresh.' + s), fresh(s), '#/' + s)).join('')}

<section class="section">
  <div class="container">
    <div class="section-head"><div><h2>${t('home.districts.title')}</h2><p>${t('home.districts.lead')}</p></div></div>
    <div class="districts">
      ${districts.slice(0, 8).map(([d, n], i) => `
        <a class="district${i === 0 ? ' big' : ''}" href="#/all?district=${encodeURIComponent(d)}">
          ${districtPhoto(d) ? `<img src="${esc(districtPhoto(d))}" alt="" loading="lazy">` : ''}
          <span><b>${esc(d)}</b><em>${t('cat.count', n)}</em></span>
        </a>`).join('')}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="why">
      ${[['shield', 1], ['percent', 2], ['send', 3], ['star', 4]].map(([ic, n]) => `
        <div class="why-item"><span>${icon(ic)}</span><div><h3>${t(`home.why.${n}.t`)}</h3><p>${t(`home.why.${n}.d`)}</p></div></div>`).join('')}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="owners">
      <div><h2>${t('home.owners.title')}</h2><p>${t('home.owners.lead')}</p></div>
      <a class="btn btn-light btn-lg" href="${telegramHref(CONTACT.telegram)}" target="_blank" rel="noopener">${icon('send')}<span>${t('home.owners.cta')}</span></a>
    </div>
  </div>
</section>`;

  const form = root.querySelector('#finder');
  const body = form.querySelector('.fd-body');
  let service = FINDER.find(x => SERVICES[x].live) || firstLive;
  let state;

  // Current choices as catalogue URL params; the same params drive the live count.
  function params() {
    const q = new URLSearchParams();
    if (state.q.trim()) q.set('q', state.q.trim());
    if (state.district) q.set('district', state.district);
    if (state.max) q.set('price', '-' + state.max);
    if (state.beds.length) q.set('beds', state.beds.join(','));
    state.flags.forEach(k => q.set(k, '1'));
    return q;
  }
  function recount() {
    const n = applyFilters(itemsFor(data, service), parseFilters(params())).length;
    const go = form.querySelector('.fd-go');
    go.classList.toggle('empty', !n);
    form.querySelector('.fd-go-label').textContent = n ? t('home.finder.show', t('cat.count', n)) : t('home.finder.none');
  }
  function mount() {
    state = { q: '', district: '', max: '', beds: [], flags: [] };
    body.innerHTML = finderBody(data, service);
    form.querySelectorAll('[data-svc]').forEach(b => b.setAttribute('aria-selected', b.dataset.svc === service));
    recount();
  }
  form.addEventListener('click', e => {
    const tab = e.target.closest('[data-svc]');
    if (tab) { service = tab.dataset.svc; mount(); return; }
    const bed = e.target.closest('[data-bed]');
    const flag = e.target.closest('[data-flag]');
    const btn = bed || flag;
    if (!btn) return;
    const list = bed ? state.beds : state.flags;
    const v = bed ? bed.dataset.bed : flag.dataset.flag;
    const on = !list.includes(v);
    if (on) list.push(v); else list.splice(list.indexOf(v), 1);
    btn.setAttribute('aria-pressed', on);
    recount();
  });
  form.addEventListener('input', e => {
    if (e.target.name in state) { state[e.target.name] = e.target.value; recount(); }
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = params();
    location.hash = `#/${service}${q.toString() ? '?' + q : ''}`;
  });
  mount();
}
