import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { SERVICES, GROUPS, telegramHref, CONTACT } from '../config.js';
import { esc, rail, serviceIcon } from '../components.js';
import { countBy, compactMoney, num, priceLabel, itemsFor, recentIds } from '../store.js';

/** Budget steps from the real price distribution of a service (rounded quantiles). */
function budgets(pool) {
  const prices = pool.map(x => x.price_usd).filter(Boolean).sort((a, b) => a - b);
  if (prices.length < 4) return [];
  const nice = v => { const p = 10 ** Math.max(1, Math.floor(Math.log10(v)) - 1); return Math.round(v / p) * p; };
  return [...new Set([0.25, 0.5, 0.7, 0.85, 0.95].map(q => nice(prices[Math.floor(q * (prices.length - 1))])))];
}

const allServices = () => Object.values(GROUPS).flatMap(g => g.services);

/** One-line search: direction, district, budget. Fields adapt to the chosen direction. */
function searchForm(data, service) {
  const svc = SERVICES[service];
  const pool = svc.live ? itemsFor(data, service) : [];
  const districts = countBy(pool, 'district').slice(0, 14);
  const steps = budgets(pool);
  const period = pool.find(x => x.period)?.period;
  return `
    <label class="hs-field hs-what"><span>${t('home.directions')}</span>
      <select name="service">${allServices().map(s => `<option value="${s}"${s === service ? ' selected' : ''}>${t('svc.' + s)}${SERVICES[s].live ? '' : ' · ' + t('svc.soon')}</option>`).join('')}</select></label>
    ${districts.length ? `<label class="hs-field"><span>${t('home.where')}</span>
      <select name="district"><option value="">${t('home.where.any')}</option>${districts.map(([d, n]) => `<option value="${esc(d)}">${esc(d)} · ${n}</option>`).join('')}</select></label>` : ''}
    ${steps.length ? `<label class="hs-field"><span>${t('home.budget')}</span>
      <select name="max"><option value="">${t('home.budget.any')}</option>${steps.map(v => `<option value="${v}">${compactMoney(v)}${period ? ' ' + t('period.' + period) : ''}</option>`).join('')}</select></label>` : ''}
    <button class="btn btn-primary btn-lg" type="submit">${icon(svc.live ? 'search' : 'bell')}<span>${t(svc.live ? 'home.find' : 'home.show.soon')}</span></button>`;
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
    <p class="eyebrow"><span class="cross"></span>${t('home.eyebrow')}</p>
    <h1 class="gate-title">${t('home.gate.title')}</h1>
    <div class="gate-grid" role="list">
      ${GATES.map((g, i) => gateTile(g, i, data)).join('')}
    </div>
  </div>
</section>

<section class="section quick-section">
  <div class="container">
    <form class="hero-search hs-form" id="hero-search">${searchForm(data, firstLive)}</form>
    <p class="hero-facts"><b>${num(live)}</b> ${t('home.stat.live')}<i></i><b>${districts.length}</b> ${t('home.stat.districts')}<i></i><b>${nocom}%</b> ${t('home.stat.commission')}</p>
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

  const form = root.querySelector('#hero-search');
  form.addEventListener('change', e => {
    if (e.target.name === 'service') form.innerHTML = searchForm(data, e.target.value);
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const svc = form.service.value;
    const q = new URLSearchParams();
    if (form.district?.value) q.set('district', form.district.value);
    if (form.max?.value) q.set('price', '-' + form.max.value);
    location.hash = `#/${svc}${q.toString() ? '?' + q : ''}`;
  });
}
