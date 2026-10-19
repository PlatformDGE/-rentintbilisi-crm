import { MAP_CENTER } from './config.js';
import { compactMoney, priceLabel } from './store.js';
import { esc, listingTitle, facts } from './components.js';

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/';
const CLUSTER = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/';

let loading;
function loadLeaflet() {
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
    <div><b>${esc(p.main)} <small>${p.period}</small></b><span>${esc(listingTitle(x))}</span><em>${esc(facts(x).join(' · '))}</em></div>
  </a>`;
}

/** Leaflet map with price-pill markers, clustering and list ⇄ map highlighting. */
export async function createMap(el, { interactive = true, zoom = 12 } = {}) {
  const L = await loadLeaflet();
  const map = L.map(el, { zoomControl: false, scrollWheelZoom: interactive, dragging: interactive || !L.Browser.mobile, attributionControl: true })
    .setView(MAP_CENTER, zoom);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);
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
        }).bindPopup(popup(x), { closeButton: false, className: 'pop', offset: [0, -6], maxWidth: 280 });
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
