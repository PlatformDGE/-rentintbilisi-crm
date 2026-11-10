// Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
// Data layer of the club module.
//
// Today everything is kept in the visitor's browser (localStorage), so the module
// works as a full demo on a static host. Every read and write goes through this
// file only: to go live, this file is swapped for one that talks to the server
// (see docs/car-club/README.md) and the rest of the module stays as it is.

import { DEFAULT_RULES, DAY } from './rules.js';
import { FLEET } from './fleet.js';

const KEY = 'crt-club:v1';
let db = null;
const listeners = new Set();

const clone = o => JSON.parse(JSON.stringify(o));
export const uid = p => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

function seed() {
  const now = Date.now();
  const at = (days, hour = 10) => { const d = new Date(now - days * DAY); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
  const span = (days, hours) => ({ start: at(days), end: new Date(Date.parse(at(days)) + hours * 3600000).toISOString() });
  const done = (id, clientId, carId, days, planId, qty, hours, paid) => ({
    id, clientId, carId, planId, qty, insurance: 'tpl', delivery: 'center', ...span(days, hours),
    status: 'completed', rentalPaid: paid, total: paid, deposit: 70, depositState: 'released', paidAt: at(days + 1), demo: true,
  });
  const clients = [
    { id: 'demo_nino', name: 'Nino K. (demo)', phone: '+995 555 00 00 01', email: 'nino@example.com', createdAt: at(200), demo: true, educationPassed: true },
    { id: 'demo_giorgi', name: 'Giorgi M. (demo)', phone: '+995 555 00 00 02', email: 'giorgi@example.com', createdAt: at(320), demo: true },
    { id: 'demo_michael', name: 'Michael R. (demo)', phone: '+995 555 00 00 03', email: 'michael@example.com', createdAt: at(90), demo: true, investor: true, investorCar: 'Toyota Camry 2021' },
  ];
  const bookings = [
    done('bk_n1', 'demo_nino', 'cruze', 170, '7d', 1, 168, 325),
    done('bk_n2', 'demo_nino', 'compass', 120, '14d', 1, 336, 630),
    done('bk_n3', 'demo_nino', 'cruze', 60, '7d', 1, 168, 325),
    done('bk_n4', 'demo_nino', 'c300', 20, '7d', 1, 168, 450),
    done('bk_g1', 'demo_giorgi', 'c300', 300, '30d', 1, 720, 1584),
    done('bk_g2', 'demo_giorgi', 'cruze', 200, '30d', 1, 720, 1320),
    done('bk_g3', 'demo_giorgi', 'mustang', 150, '3d', 1, 72, 228),
    done('bk_g4', 'demo_giorgi', 'compass', 110, '7d', 1, 168, 325),
    done('bk_g5', 'demo_giorgi', 'mustang', 80, '3d', 1, 72, 228),
    done('bk_g6', 'demo_giorgi', 'c300', 40, '1d', 2, 48, 120),
    done('bk_g7', 'demo_giorgi', 'cruze', 25, '3d', 1, 72, 142),
    done('bk_m1', 'demo_michael', 'compass', 30, '3d', 1, 72, 142),
    { ...done('bk_n5', 'demo_nino', 'mustang', 6, '3d', 1, 72, 216), status: 'completed' },
  ];
  const fine = (id, extra) => ({ id, kind: 'fine', currency: 'GEL', createdAt: at(1), ...extra });
  const incidents = [
    fine('in_g1', { clientId: 'demo_giorgi', bookingId: 'bk_g3', carId: 'mustang', plate: 'SH-181-LI', type: 'speed_40_plus', amount: 300, date: at(149, 14), status: 'confirmed', linkedBy: 'operator' }),
    fine('in_g2', { clientId: 'demo_giorgi', bookingId: 'bk_g5', carId: 'mustang', plate: 'SH-181-LI', type: 'red_light', amount: 200, date: at(79, 18), status: 'confirmed', linkedBy: 'operator' }),
    fine('in_g3', { clientId: 'demo_giorgi', bookingId: 'bk_g7', carId: 'cruze', plate: 'RI-460-AA', type: 'double_solid', amount: 150, date: at(24, 21), status: 'confirmed', linkedBy: 'auto' }),
    fine('in_g4', { clientId: 'demo_giorgi', bookingId: 'bk_g6', carId: 'c300', plate: '', type: 'parking', amount: 20, date: at(39, 12), status: 'confirmed', linkedBy: 'operator' }),
    fine('in_n1', { clientId: 'demo_nino', bookingId: 'bk_n3', carId: 'cruze', plate: 'RI-460-AA', type: 'speed_20_40', amount: 50, date: at(58, 11), status: 'confirmed', linkedBy: 'auto' }),
    // Not linked yet: one falls inside Nino's Mustang rental, one inside no rental at all.
    fine('in_new1', { clientId: null, plate: 'SH181LI', type: 'speed_40_plus', amount: 300, date: at(5, 16), status: 'new', ref: 'GE-CAM-118204' }),
    fine('in_new2', { clientId: null, plate: 'RI-460-AA', type: 'speed_20_40', amount: 50, date: at(10, 9), status: 'new', ref: 'GE-CAM-118377' }),
  ];
  return {
    rules: clone(DEFAULT_RULES),
    cars: clone(FLEET),
    clients, bookings, incidents,
    session: null,
    seededAt: new Date(now).toISOString(),
  };
}

export function load() {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { db = null; }
  if (!db || !db.rules) db = seed();
  // New rule keys added in later versions fall back to the defaults.
  db.rules = { ...clone(DEFAULT_RULES), ...db.rules };
  return db;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* private mode: keep in memory */ }
  listeners.forEach(fn => fn(db));
}

export function reset() {
  db = seed();
  save();
}

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export const get = () => load();

export function upsert(collection, item) {
  const list = load()[collection];
  const i = list.findIndex(x => x.id === item.id);
  if (i >= 0) list[i] = { ...list[i], ...item }; else list.push(item);
  save();
  return item;
}

export function remove(collection, id) {
  const d = load();
  d[collection] = d[collection].filter(x => x.id !== id);
  save();
}

export function setRules(rules) { load().rules = rules; save(); }

export function currentClient() {
  const d = load();
  return d.clients.find(c => c.id === d.session) || null;
}

export function signIn(id) { load().session = id; save(); }
export function signOut() { load().session = null; save(); }
