import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { MAP_CENTER, MAP_CATEGORIES, FRESHNESS, categoryOf, freshnessOf } from '../config.js';
import { esc, listingTitle, facts, card } from '../components.js';
import { loadLeaflet, mapTiler } from '../map.js';
import { compactMoney, priceLabel, ago } from '../store.js';

const desktop = () => matchMedia('(min-width: 900px)').matches;
const hasPoint = x => Number.isFinite(x.lat) && Number.isFinite(x.lon);

/**
 * Total map of every listing. Icon = category, colour = freshness of the post
 * (green < 5 days, amber 5–20, red-orange > 20). Both can be switched off;
 * the choice lives in the URL (#/map?hide=rent,sale&age=fresh,recent).
 */
export function renderMap(root, data, params) {
  const all = data.items.filter(hasPoint).map(x => ({ x, cat: categoryOf(x), fresh: freshnessOf(x) }));
  const catCount = {}, ageCount = {};
  all.forEach(p => { catCount[p.cat] = (catCount[p.cat] || 0) + 1; ageCount[p.fresh.id] = (ageCount[p.fresh.id] || 0) + 1; });
  const hidden = new Set((params.get('hide') || '').split(',').filter(Boolean));
  const ages = new Set((params.get('age') || FRESHNESS.map(f => f.id).join(',')).split(',').filter(Boolean));
  const visible = () => all.filter(p => !hidden.has(p.cat) && ages.has(p.fresh.id));
  const catIcon = id => MAP_CATEGORIES.find(c => c.id === id)?.icon || 'pin';

  document.body.classList.add('map-page');
  root.innerHTML = `
<section class="mapapp">
  <h1 class="sr-only">${t('map.title')}</h1>
  <div class="tmap" id="tmap"></div>
  <aside class="mlayers" aria-label="${esc(t('map.title'))}"></aside>
  <div class="mchips" role="group" aria-label="${esc(t('map.categories'))}"></div>
  <div class="mages" role="group" aria-label="${esc(t('map.freshness'))}"></div>
  <div class="mpeek" hidden></div>
</section>`;
  const $ = s => root.querySelector(s);

  function controls() {
    const n = visible().length;
    const catRows = MAP_CATEGORIES.map(({ id, icon: ic }) => {
      const count = catCount[id] || 0;
      const on = !hidden.has(id);
      return `<button type="button" class="lrow${on && count ? ' on' : ''}${count ? '' : ' empty'}" data-cat="${id}" ${count ? '' : 'disabled'} aria-pressed="${on}">
        <i>${icon(ic)}</i><b>${t('map.cat.' + id)}</b><small>${count || t('svc.soon')}</small><span class="sw"></span></button>`;
    }).join('');
    const ageRows = FRESHNESS.map(f => `<button type="button" class="age${ages.has(f.id) ? ' on' : ''}" data-age="${f.id}" style="--c:${f.color}" aria-pressed="${ages.has(f.id)}">
        <i></i><span>${t('map.age.' + f.id)}</span><small>${ageCount[f.id] || 0}</small></button>`).join('');
    $('.mlayers').innerHTML = `
      <h2>${t('map.title')}</h2><p>${t('map.count', n)}</p>
      <div class="lgroup">${catRows}</div>
      <h3>${t('map.freshness')}</h3>
      <div class="ages">${ageRows}</div>
      <div class="lfoot"><button type="button" class="btn btn-outline" data-all="1">${t('map.show.all')}</button><button type="button" class="btn btn-outline" data-all="0">${t('map.hide.all')}</button></div>`;
    $('.mchips').innerHTML = `<button type="button" class="mchip all" data-all="${hidden.size ? 1 : 0}">${t('map.all')} · ${n}</button>`
      + MAP_CATEGORIES.filter(c => catCount[c.id]).map(({ id, icon: ic }) => `<button type="button" class="mchip${hidden.has(id) ? ' off' : ''}" data-cat="${id}" aria-pressed="${!hidden.has(id)}"><i>${icon(ic)}</i>${t('map.cat.' + id)}</button>`).join('');
    $('.mages').innerHTML = ageRows;
  }

  let L, map, layer;
  function draw() {
    if (!layer) return;
    layer.clearLayers();
    visible().forEach(({ x, cat, fresh }) => {
      const m = L.marker([x.lat, x.lon], {
        fresh: fresh.id, keyboard: true, title: listingTitle(x),
        icon: L.divIcon({ className: 'cm', iconSize: null, html: `<div style="--c:${fresh.color}"><i>${icon(catIcon(cat))}</i>${x.price_usd ? esc(compactMoney(x.price_usd)) : ''}</div>` }),
      });
      m.on('click', () => select(x, cat, fresh));
      layer.addLayer(m);
    });
  }

  function select(x, cat, fresh) {
    const p = priceLabel(x);
    const body = `
      ${x.photos?.[0] ? `<img src="${esc(x.photos[0])}" alt="">` : ''}
      <div><em style="--c:${fresh.color}"><i></i>${t('map.cat.' + cat)} · ${esc(ago(x.published_at))}</em>
        <b>${esc(p.main)} <small>${p.period}</small></b><span>${esc(listingTitle(x))}</span><small>${esc(facts(x).join(' · '))}</small></div>`;
    if (desktop()) {
      L.popup({ className: 'pop', closeButton: false, offset: [0, -12], maxWidth: 280 })
        .setLatLng([x.lat, x.lon]).setContent(`<a class="map-card tm-card" href="#/listing/${esc(x.id)}">${body}</a>`).openOn(map);
    } else {
      const peek = $('.mpeek');
      peek.innerHTML = `<a class="tm-peek" href="#/listing/${esc(x.id)}">${body}</a>`;
      peek.hidden = false;
      $('.mapapp').classList.add('peeking');
    }
  }

  function commit() {
    const q = new URLSearchParams();
    if (hidden.size) q.set('hide', [...hidden].join(','));
    if (ages.size !== FRESHNESS.length) q.set('age', [...ages].join(','));
    history.replaceState(null, '', '#/map' + (q.toString() ? '?' + q : ''));
    controls();
    draw();
  }

  root.addEventListener('click', e => {
    const c = e.target.closest('[data-cat]');
    const a = e.target.closest('[data-age]');
    const all = e.target.closest('[data-all]');
    if (c) { hidden.has(c.dataset.cat) ? hidden.delete(c.dataset.cat) : hidden.add(c.dataset.cat); commit(); }
    if (a) { ages.has(a.dataset.age) ? ages.delete(a.dataset.age) : ages.add(a.dataset.age); commit(); }
    if (all) {
      if (all.dataset.all === '1') { hidden.clear(); FRESHNESS.forEach(f => ages.add(f.id)); }
      else MAP_CATEGORIES.forEach(cat => hidden.add(cat.id));
      commit();
    }
  });

  controls();
  loadLeaflet().then(lib => {
    if (!root.isConnected) return;
    L = lib;
    map = L.map($('#tmap'), { zoomControl: false }).setView(MAP_CENTER, desktop() ? 13 : 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.attributionControl.setPrefix(false);
    const streets = mapTiler(L, 'streets-v2').addTo(map);
    L.control.layers({ [t('map.streets')]: streets, [t('map.satellite')]: mapTiler(L, 'hybrid', 'jpg') }, null, { position: desktop() ? 'topright' : 'bottomright' }).addTo(map);
    map.on('click', () => { $('.mpeek').hidden = true; $('.mapapp').classList.remove('peeking'); });
    // Cluster ring shows the freshness mix of the listings inside it.
    layer = L.markerClusterGroup({
      maxClusterRadius: 52, showCoverageOnHover: false,
      iconCreateFunction(cl) {
        const by = {};
        cl.getAllChildMarkers().forEach(m => { by[m.options.fresh] = (by[m.options.fresh] || 0) + 1; });
        const n = cl.getChildCount();
        let acc = 0;
        const stops = FRESHNESS.filter(f => by[f.id]).map(f => { const a = acc; acc += (by[f.id] / n) * 360; return `${f.color} ${a}deg ${acc}deg`; });
        return L.divIcon({ className: 'dc', html: `<div style="--g:conic-gradient(${stops.join(',')})"><span>${n}</span></div>`, iconSize: [46, 46] });
      },
    }).addTo(map);
    draw();
  }).catch(() => {});

  return { destroy() { document.body.classList.remove('map-page'); map?.remove(); } };
}
