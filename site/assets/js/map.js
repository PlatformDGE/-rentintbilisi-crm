// Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
import { MAP_CENTER, MAPTILER_KEY } from './config.js';
import { logo } from './icons.js';
import { compactMoney, priceLabel, sqmPrice } from './store.js';
import { esc, listingTitle, facts, toast } from './components.js';
import { t } from './i18n.js';

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/';
const CLUSTER = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/';

// "Where am I" button: a blue dot with an accuracy ring that follows the visitor.
// The position stays in the browser; nothing about it is sent anywhere.
const LOCATE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 4 3.5 10.6l7 2.4 2.4 7Z"/></svg>';
export function addLocate(L, map) {
  let watch = null, dot = null, ring = null, first = true;
  const Locate = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd() {
      const box = L.DomUtil.create('div', 'leaflet-bar leaflet-control map-locate');
      const btn = L.DomUtil.create('a', '', box);
      btn.href = '#';
      btn.setAttribute('role', 'button');
      btn.title = t('map.locate');
      btn.setAttribute('aria-label', t('map.locate'));
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML = LOCATE_ICON;
      L.DomEvent.disableClickPropagation(box);
      L.DomEvent.on(btn, 'click', e => { L.DomEvent.preventDefault(e); watch === null ? start(btn) : stop(btn); });
      this._stop = () => stop(btn);
      return box;
    },
    onRemove() { this._stop?.(); },
  });
  function stop(btn) {
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    watch = null; first = true;
    dot?.remove(); ring?.remove(); dot = ring = null;
    btn.classList.remove('on', 'busy');
    btn.setAttribute('aria-pressed', 'false');
  }
  function start(btn) {
    if (!('geolocation' in navigator)) return toast(t('map.locate.fail'));
    btn.classList.add('busy');
    btn.setAttribute('aria-pressed', 'true');
    watch = navigator.geolocation.watchPosition(pos => {
      const at = [pos.coords.latitude, pos.coords.longitude];
      const r = Math.min(pos.coords.accuracy || 0, 3000);
      if (!dot) {
        ring = L.circle(at, { radius: r, interactive: false, className: 'me-ring', weight: 1 }).addTo(map);
        dot = L.marker(at, { interactive: false, keyboard: false, zIndexOffset: 200000,
          icon: L.divIcon({ className: 'me-dot', html: '<i></i>', iconSize: [22, 22] }) }).addTo(map);
      } else { dot.setLatLng(at); ring.setLatLng(at).setRadius(r); }
      btn.classList.remove('busy'); btn.classList.add('on');
      if (first) { first = false; map.flyTo(at, Math.max(map.getZoom(), 15), { duration: .8 }); }
    }, err => {
      // Once the dot is shown, a phone that stands still or briefly loses signal
      // reports timeouts; keep the last position instead of switching off.
      if (dot && err.code !== 1) return;
      stop(btn);
      toast(t(err.code === 1 ? 'map.locate.denied' : 'map.locate.fail'));
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  }
  return new Locate().addTo(map);
}

let loading;
export function loadLeaflet() {
  const css = href => new Promise(res => { const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href, onload: res, onerror: res }); document.head.append(l); });
  const js = src => new Promise((res, rej) => { const s = Object.assign(document.createElement('script'), { src, onload: res, onerror: rej }); document.head.append(s); });
  loading ??= Promise.all([css(LEAFLET + 'leaflet.css'), css(CLUSTER + 'MarkerCluster.css')])
    .then(() => js(LEAFLET + 'leaflet.js'))
    .then(() => js(CLUSTER + 'leaflet.markercluster.js'))
    .then(() => window.L);
  return loading;
}

const hasPoint = x => Number.isFinite(x.lat) && Number.isFinite(x.lon);

function popup(x) {
  const p = priceLabel(x);
  return `<a class="map-card" href="#/listing/${esc(x.id)}">
    ${x.photos?.[0] ? `<img src="${esc(x.photos[0])}" alt="">` : ''}
    <div><b>${esc(p.main)} <small>${[p.period, sqmPrice(x)].filter(Boolean).map(esc).join(' · ')}</small></b><span>${esc(listingTitle(x))}</span><em>${esc(facts(x).join(' · '))}</em></div>
  </a>`;
}

const MT_ATTRIBUTION = '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">&copy; OpenStreetMap</a>';
// Our logo sits beside the required map credit, in the same corner of every map.
export const brandMap = map => map.attributionControl.setPrefix(logo('map-logo'));
export const mapTiler = (L, style, ext = 'png') => L.tileLayer(`https://api.maptiler.com/maps/${style}/256/{z}/{x}/{y}{r}.${ext}?key=${MAPTILER_KEY}`, {
  maxZoom: 20, attribution: MT_ATTRIBUTION, crossOrigin: true,
});

/**
 * Leaflet map on MapTiler tiles with price-pill markers, clustering and
 * list ⇄ map highlighting. `onSelect(item)` replaces the popup (used on phones
 * to show a listing card at the bottom of the map).
 */
export async function createMap(el, { interactive = true, zoom = 12, onSelect = null } = {}) {
  const L = await loadLeaflet();
  const map = L.map(el, { zoomControl: false, scrollWheelZoom: interactive, dragging: interactive || !L.Browser.mobile, attributionControl: true })
    .setView(MAP_CENTER, zoom);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  brandMap(map);
  const streets = mapTiler(L, 'streets-v2').addTo(map);
  if (interactive) {
    L.control.layers({ [t('map.streets')]: streets, [t('map.satellite')]: mapTiler(L, 'hybrid', 'jpg') }, null, { position: 'topright' }).addTo(map);
  }
  if (onSelect) map.on('click', () => onSelect(null));
  const layer = L.markerClusterGroup({
    showCoverageOnHover: false, maxClusterRadius: 48, spiderfyOnMaxZoom: true,
    iconCreateFunction: c => L.divIcon({ html: `<span>${c.getChildCount()}</span>`, className: 'cluster', iconSize: [40, 40] }),
  }).addTo(map);
  const markers = new Map();

  return {
    map,
    update(items, { fit = true } = {}) {
      layer.clearLayers();
      markers.clear();
      const pts = items.filter(hasPoint);
      pts.forEach(x => {
        const label = x.price_usd ? compactMoney(x.price_usd) : '•';
        const m = L.marker([x.lat, x.lon], {
          icon: L.divIcon({ className: 'pin', html: `<span>${esc(label)}</span>`, iconSize: null }),
          keyboard: true, title: listingTitle(x),
        });
        if (onSelect) m.on('click', () => onSelect(x));
        else m.bindPopup(popup(x), { closeButton: false, className: 'pop', offset: [0, -6], maxWidth: 280 });
        markers.set(x.id, m);
        layer.addLayer(m);
      });
      if (fit && pts.length) map.fitBounds(L.latLngBounds(pts.map(x => [x.lat, x.lon])), { padding: [40, 40], maxZoom: 15 });
      return pts.length;
    },
    highlight(id, on) {
      const m = markers.get(id);
      const node = m?.getElement();
      if (node) { node.classList.toggle('hot', on); m.setZIndexOffset(on ? 1000 : 0); }
    },
    invalidate() { map.invalidateSize(); },
    destroy() { map.remove(); },
  };
}
