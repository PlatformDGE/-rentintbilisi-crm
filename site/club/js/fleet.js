// Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
// The fleet is the live daily car rental catalogue of hge.ge: the same cars and the
// same ids as the site's car listings (data/listings.json, service "car-rent"),
// which are built from the CarsRentInGeorgia Telegram channel. Details that only
// the post text has (fuel use, trunk, insurance, extras) come from data/car-rent.json.
//
// Prices: the listed price per day is the base. A plan with TPL adds the post's
// "Basic insurance", CASCO adds "Full insurance"; the other plans follow the
// Cars Rent in Tbilisi ladder (4 hours to 30 days). The operator can change any
// of it in the admin panel.

export const DATA_BASE = (typeof window !== 'undefined' && window.CLUB_DATA_BASE != null) ? window.CLUB_DATA_BASE : '../';

// Plan price as a share of the 1-day price, from the Tilda car page (4 h $15 … 30 days $1320 at $50/day).
const LADDER = { '4h': 0.3, '8h': 0.56, '1d': 1, '3d': 2.84, '7d': 6.5, '14d': 12.6, '30d': 26.4 };
const ladder = day => Object.fromEntries(Object.entries(LADDER).map(([k, m]) => [k, Math.round(day * m)]));

const num = (re, s) => { const m = s.match(re); return m ? +m[1].replace(',', '.') : null; };

// Pull the extra details out of a CarsRentInGeorgia post.
export function parsePost(text = '') {
  const extras = [];
  const add = (id, re) => { const p = num(re, text); if (p != null) extras.push({ id, perDay: p }); };
  add('childSeat', /#ChildSeat\w*:\s*(\d+(?:[.,]\d+)?)\s*\$/i);
  add('booster', /#BoosterSeat:\s*(\d+(?:[.,]\d+)?)\s*\$/i);
  add('snowChains', /#SnowChains:\s*(\d+(?:[.,]\d+)?)\s*\$/i);
  add('winterTires', /#WinterTires:\s*(\d+(?:[.,]\d+)?)\s*\$/i);
  add('secondDriver', /#SecondDriver:\s*(\d+(?:[.,]\d+)?)\s*\$/i);
  return {
    consumption: num(/Fuel Use:\s*(\d+(?:[.,]\d+)?)\s*L/i, text),
    trunk: num(/Trunk:\s*(\d+)\s*L/i, text),
    insBasic: num(/Basic Insurance:\s*(\d+(?:[.,]\d+)?)\s*\$/i, text),
    insFull: num(/Full Insurance:\s*(\d+(?:[.,]\d+)?)\s*\$/i, text),
    drive: /#4WD|#AWD/i.test(text) ? '4WD' : null,
    pets: /Pets:\s*#Allowed/i.test(text),
    unlimited: /Unlimited\s*Mileage/i.test(text),
    extras,
  };
}

function classOf(x) {
  if (x.body === 'business' || (x.price_usd || x.price) >= 100) return 'business';
  if (x.body === 'suv' || x.body === 'minivan') return 'comfort_plus';
  return 'comfort';
}

export function toCar(x, post = {}) {
  const day = x.price_usd || x.price;
  const basic = post.insBasic ?? 0;
  const full = post.insFull ?? basic;
  return {
    id: x.id,
    name: x.title,
    year: x.year || null,
    body: x.body || null,
    class: classOf(x),
    hp: null,
    plate: '',
    fuel: x.fuel || null,
    gearbox: x.gearbox || null,
    seats: x.seats || null,
    consumption: post.consumption ?? null,
    trunk: post.trunk ?? null,
    drive: post.drive ?? null,
    pets: post.pets ?? false,
    extras: post.extras || [],
    listedPerDay: day,
    insurance: { basic, full },
    prices: { tpl: ladder(day + basic), casco: ladder(day + full) },
    address: x.pickup ? x.pickup + ', Tbilisi' : '',
    lat: x.lat ?? null, lon: x.lon ?? null,
    photos: (x.photos || []).map(p => DATA_BASE + p),
    postUrl: x.post_url || '',
    status: 'available',
  };
}

export async function loadFleet() {
  const get = url => fetch(DATA_BASE + url, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : Promise.reject(new Error(url + ' ' + r.status))));
  const [listings, posts] = await Promise.all([get('data/listings.json'), get('data/car-rent.json').catch(() => ({ items: [] }))]);
  const byPost = new Map(posts.items.map(p => [String(p.id), p.source_text || '']));
  return listings.items
    .filter(x => x.service === 'car-rent' && (x.price_usd || x.price) && x.photos?.length)
    .map(x => toCar(x, parsePost(byPost.get(x.id.replace(/^\D+-/, '')) || '')));
}
