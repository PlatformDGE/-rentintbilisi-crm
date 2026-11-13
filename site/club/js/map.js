// Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
// The same map as on hge.ge listings: Leaflet on MapTiler streets, our logo by the
// map credit, a pill marker. Kept small so the club doesn't pull in the site bundle.
import { MAPTILER_KEY } from '../../assets/js/config.js';

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/';
const ATTR = '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">&copy; OpenStreetMap</a>';
let loading;

function loadLeaflet() {
  const css = href => new Promise(res => document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href, onload: res, onerror: res })));
  const js = src => new Promise((res, rej) => document.head.append(Object.assign(document.createElement('script'), { src, onload: res, onerror: rej })));
  loading ??= css(LEAFLET + 'leaflet.css').then(() => js(LEAFLET + 'leaflet.js')).then(() => window.L);
  return loading;
}

// Draws the car's point into `el` once it scrolls near the screen.
export function carMap(el, { lat, lon, label }) {
  const draw = async () => {
    const L = await loadLeaflet().catch(() => null);
    if (!L || !el.isConnected) return;
    const map = L.map(el, { zoomControl: false, scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false }).setView([lat, lon], 15);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.attributionControl.setPrefix('<img class="map-logo" alt="Homes in Georgia" width="52" height="16">');
    L.tileLayer(`https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`, { maxZoom: 20, attribution: ATTR, crossOrigin: true }).addTo(map);
    L.marker([lat, lon], { icon: L.divIcon({ className: 'pin', html: `<span>${label}</span>`, iconSize: null }), keyboard: false }).addTo(map);
  };
  if (!('IntersectionObserver' in window)) { draw(); return; }
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); draw(); } }, { rootMargin: '300px' });
  io.observe(el);
}
