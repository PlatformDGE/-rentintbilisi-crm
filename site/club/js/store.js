// Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
// Data layer of the club module.
//
// Today everything is kept in the visitor's browser (localStorage), so the module
// works as a full demo on a static host. Every read and write goes through this
// file only: to go live, this file is swapped for one that talks to the server
// (see docs/car-club/README.md) and the rest of the module stays as it is.
//
// Cars are not stored here: they come live from the site's catalogue (fleet.js).
// Only the operator's changes to a car (class, power, plate, prices…) are kept,
// as overrides by car id.

import { DEFAULT_RULES, DAY } from './rules.js';

const KEY = 'crt-club:v2';
let db = null;
let live = [];

const clone = o => JSON.parse(JSON.stringify(o));
export const uid = p => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

// Demo clients and history, spread over whatever cars are live right now.
function seed(cars) {
  const now = Date.now();
  const at = (days, hour = 10) => { const d = new Date(now - days * DAY); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
  const car = i => cars[i % Math.max(cars.length, 1)]?.id || 'none';
  const done = (id, clientId, carIdx, days, planId, hours, paid) => ({
    id, clientId, carId: car(carIdx), planId, qty: 1, insurance: 'tpl', delivery: 'center',
    start: at(days), end: new Date(Date.parse(at(days)) + hours * 3600000).toISOString(),
    status: 'completed', rentalPaid: paid, total: paid, deposit: 100, depositState: 'released', paidAt: at(days + 1), demo: true,
  });
  const clients = [
    { id: 'demo_nino', name: 'Nino K. (demo)', phone: '+995 555 00 00 01', email: 'nino@example.com', createdAt: at(200), demo: true, educationPassed: true },
    { id: 'demo_giorgi', name: 'Giorgi M. (demo)', phone: '+995 555 00 00 02', email: 'giorgi@example.com', createdAt: at(320), demo: true },
    { id: 'demo_michael', name: 'Michael R. (demo)', phone: '+995 555 00 00 03', email: 'michael@example.com', createdAt: at(90), demo: true, investor: true, investorCar: 'Toyota Camry 2021' },
  ];
  const bookings = [
    done('bk_n1', 'demo_nino', 0, 170, '7d', 168, 390),
    done('bk_n2', 'demo_nino', 1, 120, '14d', 336, 756),
    done('bk_n3', 'demo_nino', 2, 60, '7d', 168, 390),
    done('bk_n4', 'demo_nino', 4, 20, '3d', 72, 369),
    done('bk_n5', 'demo_nino', 3, 6, '3d', 72, 170),
    done('bk_g1', 'demo_giorgi', 4, 300, '30d', 720, 3432),
    done('bk_g2', 'demo_giorgi', 5, 150, '3d', 72, 199),
    done('bk_g3', 'demo_giorgi', 6, 110, '7d', 168, 390),
    done('bk_g4', 'demo_giorgi', 7, 80, '3d', 72, 170),
    done('bk_g5', 'demo_giorgi', 8, 40, '1d', 24, 60),
    done('bk_g6', 'demo_giorgi', 9, 25, '3d', 72, 199),
    done('bk_m1', 'demo_michael', 1, 30, '3d', 72, 170),
  ];
  const fine = (id, b, extra) => ({ id, kind: 'fine', currency: 'GEL', createdAt: at(1), plate: '', clientId: b?.clientId ?? null, bookingId: b?.id ?? null, carId: b?.carId ?? extra.carId, ...extra });
  const bk = id => bookings.find(b => b.id === id);
  const incidents = [
    fine('in_g1', bk('bk_g2'), { type: 'speed_40_plus', amount: 300, date: at(149, 14), status: 'confirmed', linkedBy: 'operator' }),
    fine('in_g2', bk('bk_g4'), { type: 'red_light', amount: 200, date: at(79, 18), status: 'confirmed', linkedBy: 'operator' }),
    fine('in_g3', bk('bk_g6'), { type: 'double_solid', amount: 150, date: at(24, 21), status: 'confirmed', linkedBy: 'auto' }),
    fine('in_g4', bk('bk_g5'), { type: 'parking', amount: 20, date: at(39, 12), status: 'confirmed', linkedBy: 'operator' }),
    fine('in_n1', bk('bk_n3'), { type: 'speed_20_40', amount: 50, date: at(58, 11), status: 'confirmed', linkedBy: 'auto' }),
    // Not linked yet: one falls inside Nino's last rental, one inside no rental at all.
    fine('in_new1', null, { carId: car(3), type: 'speed_40_plus', amount: 300, date: at(5, 16), status: 'new', ref: 'GE-CAM-118204' }),
    fine('in_new2', null, { carId: car(0), type: 'speed_20_40', amount: 50, date: at(10, 9), status: 'new', ref: 'GE-CAM-118377' }),
  ];
  return { rules: clone(DEFAULT_RULES), carOverrides: {}, clients, bookings, incidents, session: null, seededAt: new Date(now).toISOString() };
}

function mergeCars() {
  db.cars = live.map(c => ({ ...c, ...(db.carOverrides[c.id] || {}) }));
}

// Called once at start with the live fleet.
export function init(cars) {
  live = cars;
  try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { db = null; }
  if (!db || !db.rules) db = seed(cars);
  db.rules = { ...clone(DEFAULT_RULES), ...db.rules };
  db.carOverrides ||= {};
  mergeCars();
  return db;
}

export function load() { return db; }

export function save() {
  const { cars, ...rest } = db;
  try { localStorage.setItem(KEY, JSON.stringify(rest)); } catch { /* private mode: keep in memory */ }
}

export function reset() { db = seed(live); mergeCars(); save(); }

export const get = () => db;

export function upsert(collection, item) {
  const list = db[collection];
  const i = list.findIndex(x => x.id === item.id);
  if (i >= 0) list[i] = { ...list[i], ...item }; else list.push(item);
  save();
  return item;
}

// The operator's edits to a live car.
export function saveCar(id, patch) {
  db.carOverrides[id] = { ...(db.carOverrides[id] || {}), ...patch };
  mergeCars(); save();
}

export function setRules(rules) { db.rules = rules; save(); }

export function currentClient() { return db.clients.find(c => c.id === db.session) || null; }
export function signIn(id) { db.session = id; save(); }
export function signOut() { db.session = null; save(); }
