import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { SERVICES, GROUPS, telegramHref, CONTACT } from '../config.js';
import { esc, rail, serviceIcon } from '../components.js';
import { countBy, compactMoney, num, priceLabel, itemsFor } from '../store.js';

const BUDGETS = {
  rent: [500, 800, 1000, 1500, 2000, 3000],
  sale: [80000, 120000, 160000, 250000, 400000],
  new: [70000, 100000, 150000, 250000],
};

function heroSearch(data, group, service) {
  const svc = SERVICES[service];
  const pool = svc.live ? itemsFor(data, service) : [];
  const districts = countBy(pool, 'district').slice(0, 14);
  const kinds = [...new Set(pool.map(x => x.kind))];
  const fields = svc.live ? `
      <label class="hs-field"><span>${t('home.where')}</span>
        <select name="district"><option value="">${t('home.where.any')}</option>${districts.map(([d, n]) => `<option value="${esc(d)}">${esc(d)} · ${n}</option>`).join('')}</select></label>
      <label class="hs-field"><span>${t('home.type')}</span>
        <select name="kind"><option value="">—</option>${kinds.map(k => `<option value="${k}">${t('kind.' + k)}</option>`).join('')}</select></label>
      <label class="hs-field"><span>${t('home.budget')}</span>
        <select name="max"><option value="">${t('home.budget.any')}</option>${(BUDGETS[service] || []).map(v => `<option value="${v}">${compactMoney(v)}${svc.period === 'month' ? ' ' + t('period.month') : ''}</option>`).join('')}</select></label>`
    : `<div class="hs-soon">${icon('bell')}<span>${esc(t('svc.' + service + '.desc'))}</span></div>`;
  return `
    <div class="hs-tabs" role="tablist">
      ${Object.keys(GROUPS).map(g => `<button type="button" role="tab" class="seg${g === group ? ' on' : ''}" data-group="${g}" aria-selected="${g === group}">${icon(GROUPS[g].icon)}${t('group.' + g)}</button>`).join('')}
    </div>
    <div class="hs-services">
      ${GROUPS[group].services.map(s => `<button type="button" class="hs-svc${s === service ? ' on' : ''}" data-svc="${s}">${t('svc.' + s + '.short')}${SERVICES[s].live ? '' : `<sup>${t('svc.soon')}</sup>`}</button>`).join('')}
    </div>
    <form class="hs-form" data-service="${service}">
      ${fields}
      <button class="btn btn-primary btn-lg" type="submit">${icon(svc.live ? 'search' : 'bell')}<span>${t(svc.live ? 'home.find' : 'home.show.soon')}</span></button>
    </form>`;
}

function mosaic(items) {
  const pick = items.filter(x => (x.photos || []).length >= 3 && x.price_usd).slice(0, 3);
  if (pick.length < 3) return '';
  return `<div class="mosaic" aria-hidden="true">${pick.map((x, i) => {
    const p = priceLabel(x);
    return `<a class="m${i}" href="#/listing/${esc(x.id)}" tabindex="-1"><img src="${esc(x.photos[0])}" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>
      <span class="m-chip"><b>${esc(p.main)}</b> ${p.period}<em>${esc(x.district || '')}</em></span></a>`;
  }).join('')}</div>`;
}

export function renderHome(root, data) {
  const counts = data.counts || {};
  const live = data.items.length;
  const districts = countBy(data.items, 'district');
  const nocom = Math.round((data.items.filter(x => x.no_commission).length / Math.max(1, live)) * 100);
  const fresh = s => itemsFor(data, s).slice().sort((a, b) => b._ts - a._ts).filter(x => x.photos?.length).slice(0, 12);
  const heroPool = fresh('rent').concat(fresh('sale'));
  const districtPhoto = d => data.items.find(x => x.district === d && x.photos?.length)?.photos[0];
  let group = 'realty', service = 'rent';

  root.innerHTML = `
<section class="hero">
  <div class="container hero-grid">
    <div class="hero-copy">
      <p class="eyebrow"><span class="cross"></span>${t('home.eyebrow')}</p>
      <h1>${t('home.title')}</h1>
      <p class="lead">${t('home.lead')}</p>
      <div class="hero-search" id="hero-search">${heroSearch(data, group, service)}</div>
    </div>
    ${mosaic(heroPool)}
  </div>
  <div class="container">
    <dl class="stats">
      <div><dt>${num(live)}</dt><dd>${t('home.stat.live')}</dd></div>
      <div><dt>${districts.length}</dt><dd>${t('home.stat.districts')}</dd></div>
      <div><dt>${t('home.stat.hourly.value')}</dt><dd>${t('home.stat.hourly')}</dd></div>
      <div><dt>${nocom}%</dt><dd>${t('home.stat.commission')}</dd></div>
    </dl>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-head"><div><h2>${t('home.services.title')}</h2><p>${t('home.services.lead')}</p></div></div>
    ${Object.entries(GROUPS).map(([g, def]) => `
      <div class="svc-group">
        <div class="svc-group-head">${icon(def.icon)}<div><h3>${t('group.' + g)}</h3><p>${t('group.' + g + '.desc')}</p></div></div>
        <div class="svc-grid">
          ${def.services.map(s => `
            <a class="svc-tile${SERVICES[s].live ? '' : ' soon'}" href="#/${s}">
              <span class="svc-ico">${icon(serviceIcon(s))}</span>
              <span class="svc-name">${t('svc.' + s)}</span>
              <span class="svc-desc">${t('svc.' + s + '.desc')}</span>
              <span class="svc-meta">${SERVICES[s].live ? `<b>${t('cat.count', counts[s] || 0)}</b>` : `<em>${t('svc.soon')}</em>`}${icon('arrow')}</span>
            </a>`).join('')}
        </div>
      </div>`).join('')}
  </div>
</section>

${rail('rail-rent', t('home.fresh.rent'), fresh('rent'), '#/rent')}
${rail('rail-new', t('home.fresh.new'), fresh('new'), '#/new')}
${rail('rail-sale', t('home.fresh.sale'), fresh('sale'), '#/sale')}

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
    <div class="section-head"><h2>${t('home.why.title')}</h2></div>
    <div class="why">
      ${[['shield', 1], ['percent', 2], ['send', 3], ['star', 4]].map(([ic, n]) => `
        <div class="why-item"><span>${icon(ic)}</span><h3>${t(`home.why.${n}.t`)}</h3><p>${t(`home.why.${n}.d`)}</p></div>`).join('')}
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

  const box = root.querySelector('#hero-search');
  box.addEventListener('click', e => {
    const g = e.target.closest('[data-group]');
    const s = e.target.closest('[data-svc]');
    if (!g && !s) return;
    if (g) { group = g.dataset.group; service = GROUPS[group].services[0]; }
    if (s) service = s.dataset.svc;
    box.innerHTML = heroSearch(data, group, service);
  });
  box.addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target;
    const svc = form.dataset.service;
    const q = new URLSearchParams();
    if (form.district?.value) q.set('district', form.district.value);
    if (form.kind?.value) q.set('kind', form.kind.value);
    if (form.max?.value) q.set('price', '-' + form.max.value);
    location.hash = `#/${svc}${q.toString() ? '?' + q : ''}`;
  });
}
