import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { MAP_CENTER, MAP_CHANNELS, KIND_ICONS, CHANNELS, FRESHNESS, channelOf, freshnessOf } from '../config.js';
import { esc, listingTitle, facts } from '../components.js';
import { loadLeaflet, mapTiler } from '../map.js';
import { compactMoney, priceLabel, ago } from '../store.js';

const desktop = () => matchMedia('(min-width: 900px)').matches;
const hasPoint = x => Number.isFinite(x.lat) && Number.isFinite(x.lon);
const csv = v => new Set((v || '').split(',').filter(Boolean));

/**
 * Total map of every listing.
 * One switch per Telegram channel; icon = the post's hashtag (#Apartment, #House,
 * #Commercial, #Land, car); colour = how fresh the post is (green < 5 days,
 * amber 5–20, red-orange > 20). State lives in the URL: #/map?ch=…&age=…
 * list what is switched OFF.
 */
export function renderMap(root, data, params) {
  const all = data.items.filter(hasPoint).map(x => ({ x, ch: channelOf(x), kind: KIND_ICONS[x.kind] ? x.kind : 'apartment', fresh: freshnessOf(x) }));
  const count = { ch: {}, age: {} };
  all.forEach(p => {
    count.ch[p.ch] = (count.ch[p.ch] || 0) + 1;
    count.age[p.fresh.id] = (count.age[p.fresh.id] || 0) + 1;
  });
  const off = { ch: csv(params.get('ch')), age: csv(params.get('age')) };
  const visible = () => all.filter(p => !off.ch.has(p.ch) && !off.age.has(p.fresh.id));

  document.body.classList.add('map-page');
  root.innerHTML = `
<section class="mapapp">
  <h1 class="sr-only">${t('map.title')}</h1>
  <div class="tmap" id="tmap"></div>
  <aside class="mlayers" aria-label="${esc(t('map.title'))}"></aside>
  <div class="mchips" role="group" aria-label="${esc(t('map.channels'))}"></div>
  <div class="mages" role="group" aria-label="${esc(t('map.freshness'))}"></div>
  <div class="mpeek" hidden></div>
</section>`;
  const $ = s => root.querySelector(s);

  const row = (group, id, ic) => {
    const n = count[group][id] || 0;
    const on = !off[group].has(id);
    return `<button type="button" class="lrow${on && n ? ' on' : ''}${n ? '' : ' empty'}" data-group="${group}" data-id="${id}" ${n ? '' : 'disabled'} aria-pressed="${on}" title="@${esc(CHANNELS[id] || '')}">
      <i>${icon(ic)}</i><b>${t(`map.${group}.${id}`)}</b><small>${n || t('svc.soon')}</small><span class="sw"></span></button>`;
  };
  const ageButton = f => `<button type="button" class="age${off.age.has(f.id) ? '' : ' on'}" data-group="age" data-id="${f.id}" style="--c:${f.color}" aria-pressed="${!off.age.has(f.id)}">
      <i></i><span>${t('map.age.' + f.id)}</span><small>${count.age[f.id] || 0}</small></button>`;
  const chip = (group, id, ic) => `<button type="button" class="mchip${off[group].has(id) ? ' off' : ''}" data-group="${group}" data-id="${id}" aria-pressed="${!off[group].has(id)}"><i>${icon(ic)}</i>${t(`map.${group}.${id}`)}</button>`;

  function controls() {
    const n = visible().length;
    $('.mlayers').innerHTML = `
      <h2>${t('map.title')}</h2><p>${t('map.count', n)}</p>
      <h3>${t('map.channels')}</h3><div class="lgroup">${MAP_CHANNELS.map(c => row('ch', c.id, c.icon)).join('')}</div>
      <div class="kinds-legend">${['apartment', 'house', 'commercial', 'land'].map(k => `<span><i>${icon(KIND_ICONS[k])}</i>${t('map.kind.' + k)}</span>`).join('')}</div>
      <h3>${t('map.freshness')}</h3><div class="ages">${FRESHNESS.map(ageButton).join('')}</div>
      <div class="lfoot"><button type="button" class="btn btn-outline" data-all="1">${t('map.show.all')}</button><button type="button" class="btn btn-outline" data-all="0">${t('map.hide.all')}</button></div>`;
    // Phones: channels on the first row, freshness on the second.
    $('.mchips').innerHTML = `<button type="button" class="mchip all" data-all="1">${t('map.all')} · ${n}</button>`
      + MAP_CHANNELS.filter(c => count.ch[c.id]).map(c => chip('ch', c.id, c.icon)).join('');
    $('.mages').innerHTML = FRESHNESS.map(ageButton).join('');
  }

  let L, map, layer;
  function draw() {
    if (!layer) return;
    layer.clearLayers();
    visible().forEach(p => {
      const { x, fresh } = p;
      const period = x.period ? t('period.' + x.period).replace(/\s+/g, '') : '';
      const m = L.marker([x.lat, x.lon], {
        fresh: fresh.id, keyboard: true, title: listingTitle(x),
        icon: L.divIcon({ className: 'cm', iconSize: null,
          html: `<div style="--c:${fresh.color}"><i>${icon(KIND_ICONS[p.kind])}</i>${x.price_usd ? esc(compactMoney(x.price_usd)) + (period ? `<small>${esc(period)}</small>` : '') : ''}</div>` }),
      });
      m.on('click', () => select(p));
      layer.addLayer(m);
    });
  }

  function select({ x, ch, kind, fresh }) {
    const pr = priceLabel(x);
    const body = `
      ${x.photos?.[0] ? `<img src="${esc(x.photos[0])}" alt="">` : ''}
      <div><em style="--c:${fresh.color}"><i></i>${t('map.ch.' + ch)} · ${t(kind === 'car' ? 'kind.car' : 'map.kind.' + kind)} · ${esc(ago(x.published_at))}</em>
        <b>${esc(pr.main)} <small>${pr.period}</small></b><span>${esc(listingTitle(x))}</span><small>${esc(facts(x).join(' · '))}</small></div>`;
    if (desktop()) {
      L.popup({ className: 'pop', closeButton: false, offset: [0, -12], maxWidth: 280, autoPanPaddingTopLeft: [340, 24], autoPanPaddingBottomRight: [24, 24] })
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
    Object.entries(off).forEach(([k, set]) => { if (set.size) q.set(k, [...set].join(',')); });
    history.replaceState(null, '', '#/map' + (q.toString() ? '?' + q : ''));
    controls();
    draw();
  }

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-group]');
    const all = e.target.closest('[data-all]');
    if (b) {
      const set = off[b.dataset.group];
      set.has(b.dataset.id) ? set.delete(b.dataset.id) : set.add(b.dataset.id);
      commit();
    }
    if (all) {
      Object.values(off).forEach(set => set.clear());
      if (all.dataset.all === '0') MAP_CHANNELS.forEach(c => off.ch.add(c.id));
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
