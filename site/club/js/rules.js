// Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
// Cars Rent in Tbilisi — club rules engine. Pure functions, no DOM and no storage,
// so the same file runs in the browser, in tests and later on a server.
//
// Everything that is a business decision lives in DEFAULT_RULES and can be
// changed by the operator in the admin panel without touching code.

export const DAY = 86400000;

export const CLASSES = ['comfort', 'comfort_plus', 'business', 'premium', 'sport', 'exclusive'];
const BASE = ['comfort', 'comfort_plus', 'business'];

export const DEFAULT_RULES = {
  version: 1,
  currency: 'USD',

  // Main ladder. A client holds the highest tier whose condition is met.
  // combine: 'and' = spend AND rentals are both needed; 'or' = either is enough.
  // Rentals counted here are completed rentals without a gross violation or at-fault accident.
  tiers: [
    { id: 'first',   minSpend: 0,    minRentals: 0, combine: 'and', discount: 0, classes: BASE, club: false, premiere: false },
    { id: 'solid',   minSpend: 500,  minRentals: 0, combine: 'and', discount: 1, classes: BASE, club: false, premiere: false },
    { id: 'club',    minSpend: 1500, minRentals: 3, combine: 'and', discount: 5, classes: [...BASE, 'premium', 'sport'], club: true, premiere: false },
    { id: 'premium', minSpend: 3500, minRentals: 6, combine: 'and', discount: 7, classes: CLASSES, club: true, premiere: true },
  ],

  // Extra statuses on top of the ladder. Discounts never add up: the largest one applies.
  education: { discount: 2, passScore: 4, questions: 5 },
  investor:  { discount: 10, classes: CLASSES, club: true, premiere: true },

  // Retention: counted over a rolling window. Reaching either limit suspends the status.
  penalty: {
    windowDays: 183,        // ~6 months
    maxGross: 3,            // gross violations in the window
    maxAtFault: 3,          // at-fault accidents in the window
    keepEducation: true,    // the 2% for the course stays while suspended
  },

  // Fine types. gross:true counts toward the limit; the rest are recorded but do not count.
  violationTypes: {
    speed_20_40:  { gross: false },
    marking:      { gross: false },   // road marking, but not a double solid line
    parking:      { gross: false },
    other_minor:  { gross: false },
    speed_40_plus:{ gross: true },
    double_solid: { gross: true },    // U-turn or crossing a double solid line
    red_light:    { gross: true },
    oncoming:     { gross: true },    // driving into oncoming traffic
    drunk:        { gross: true },
    other_gross:  { gross: true },
  },
  fineFeePct: 8,           // processing fee added when a fine is passed on to the client

  // Deposit = class base + power surcharge, unless a car has its own amount.
  deposit: {
    byClass: { comfort: 70, comfort_plus: 100, business: 150, premium: 250, sport: 300, exclusive: 500 },
    powerBands: [ { upTo: 160, add: 0 }, { upTo: 250, add: 50 }, { upTo: 350, add: 100 }, { upTo: null, add: 200 } ],
  },

  plans: [
    { id: '4h', hours: 4 }, { id: '8h', hours: 8 }, { id: '1d', hours: 24 }, { id: '3d', hours: 72 },
    { id: '7d', hours: 168 }, { id: '14d', hours: 336 }, { id: '30d', hours: 720 },
  ],
  cascoMultiplier: 1.2,     // used only when a car has no CASCO prices of its own
  delivery: { center: 0, airport: 10, suburb: 10 },
};

export const round2 = n => Math.round(n * 100) / 100;
const time = d => (d instanceof Date ? d.getTime() : typeof d === 'number' ? d : Date.parse(d));

/* ---------- Driving record ---------- */

export function isGross(incident, rules = DEFAULT_RULES) {
  if (incident.kind === 'accident') return false;
  if (typeof incident.gross === 'boolean') return incident.gross;
  return !!rules.violationTypes[incident.type]?.gross;
}

// Incidents that count: confirmed, belonging to the client, inside the window.
export function record(clientId, incidents, now, rules = DEFAULT_RULES) {
  const from = time(now) - rules.penalty.windowDays * DAY;
  const mine = incidents.filter(i => i.clientId === clientId && i.status === 'confirmed');
  const inWindow = mine.filter(i => time(i.date) > from && time(i.date) <= time(now));
  const gross = inWindow.filter(i => i.kind === 'fine' && isGross(i, rules));
  const minor = inWindow.filter(i => i.kind === 'fine' && !isGross(i, rules));
  const atFault = inWindow.filter(i => i.kind === 'accident' && i.atFault);
  return { gross, minor, atFault, all: mine };
}

// Date when the count drops back under the limit (the oldest counted event leaves the window).
function liftDate(events, max, rules) {
  if (events.length < max) return null;
  const sorted = events.map(e => time(e.date)).sort((a, b) => b - a); // newest first
  // To get under the limit, every event from position max-1 onward must leave the window.
  return sorted[max - 1] + rules.penalty.windowDays * DAY;
}

/* ---------- Progress ---------- */

// Completed rentals and paid rental amount (deposits, fines and delivery are not counted).
export function progress(clientId, bookings, incidents, rules = DEFAULT_RULES) {
  const dirty = new Set(incidents
    .filter(i => i.clientId === clientId && i.status === 'confirmed' && i.bookingId &&
      ((i.kind === 'fine' && isGross(i, rules)) || (i.kind === 'accident' && i.atFault)))
    .map(i => i.bookingId));
  const done = bookings.filter(b => b.clientId === clientId && b.status === 'completed');
  const spend = round2(done.reduce((s, b) => s + (b.rentalPaid ?? 0), 0));
  const rentals = done.filter(b => !dirty.has(b.id)).length;
  return { spend, rentals, completed: done.length };
}

export function meets(tier, p) {
  const s = p.spend >= tier.minSpend;
  const r = p.rentals >= tier.minRentals;
  if (tier.combine === 'or') {
    const parts = [];
    if (tier.minSpend > 0) parts.push(s);
    if (tier.minRentals > 0) parts.push(r);
    return parts.length ? parts.some(Boolean) : true;
  }
  return s && r;
}

export function tierById(id, rules = DEFAULT_RULES) {
  return rules.tiers.find(t => t.id === id);
}

/* ---------- Status ---------- */

// The whole picture for one client: earned tier, suspension, what it gives now, what is next.
export function status(client, bookings, incidents, now = Date.now(), rules = DEFAULT_RULES) {
  const p = progress(client.id, bookings, incidents, rules);
  let idx = 0;
  rules.tiers.forEach((t, i) => { if (meets(t, p)) idx = i; });
  // The operator can raise a client manually (e.g. a regular from before the site existed).
  if (client.tierOverride) {
    const o = rules.tiers.findIndex(t => t.id === client.tierOverride);
    if (o > idx) idx = o;
  }
  const tier = rules.tiers[idx];
  const next = rules.tiers[idx + 1] || null;

  const rec = record(client.id, incidents, now, rules);
  const grossHit = rec.gross.length >= rules.penalty.maxGross;
  const accHit = rec.atFault.length >= rules.penalty.maxAtFault;
  const suspended = grossHit || accHit;
  const lifts = [grossHit && liftDate(rec.gross, rules.penalty.maxGross, rules),
                 accHit && liftDate(rec.atFault, rules.penalty.maxAtFault, rules)].filter(Boolean);
  const suspendedUntil = lifts.length ? Math.max(...lifts) : null;

  const education = !!client.educationPassed;
  const investor = !!client.investor;

  // Candidate discounts; the largest one wins.
  const options = [{ source: 'tier:' + tier.id, pct: tier.discount }];
  if (education && (!suspended || rules.penalty.keepEducation)) options.push({ source: 'education', pct: rules.education.discount });
  if (investor) options.push({ source: 'investor', pct: rules.investor.discount });
  const usable = suspended ? options.filter(o => o.source === 'education') : options;
  const best = usable.reduce((a, b) => (b.pct > a.pct ? b : a), { source: 'none', pct: 0 });

  let classes = new Set(BASE);
  let club = false, premiere = false;
  if (!suspended) {
    tier.classes.forEach(c => classes.add(c));
    club = tier.club; premiere = tier.premiere;
    if (investor) { rules.investor.classes.forEach(c => classes.add(c)); club = true; premiere = premiere || rules.investor.premiere; }
  }

  return {
    tier: tier.id,
    nextTier: next?.id ?? null,
    progress: p,
    toNext: next ? {
      spend: Math.max(0, round2(next.minSpend - p.spend)),
      rentals: Math.max(0, next.minRentals - p.rentals),
      combine: next.combine,
      spendPct: next.minSpend ? Math.min(100, Math.round((p.spend / next.minSpend) * 100)) : 100,
      rentalsPct: next.minRentals ? Math.min(100, Math.round((p.rentals / next.minRentals) * 100)) : 100,
    } : null,
    education, investor,
    suspended, suspendedUntil,
    reasons: { gross: rec.gross.length, atFault: rec.atFault.length, minor: rec.minor.length },
    discount: best.pct,
    discountSource: best.source,
    classes: CLASSES.filter(c => classes.has(c)),
    club, premiere,
  };
}

export function canRent(car, st) {
  return st.classes.includes(car.class);
}

// The lowest tier that opens a class, for the lock label on a car card.
export function unlockTier(cls, rules = DEFAULT_RULES) {
  return rules.tiers.find(t => t.classes.includes(cls))?.id ?? 'investor';
}

/* ---------- Money ---------- */

export function deposit(car, rules = DEFAULT_RULES) {
  if (car.depositOverride) return car.depositOverride;
  const base = rules.deposit.byClass[car.class] ?? 0;
  const hp = car.hp || 0;
  const band = rules.deposit.powerBands.find(b => b.upTo == null || hp <= b.upTo);
  return base + (band ? band.add : 0);
}

export function planPrice(car, planId, insurance = 'tpl', rules = DEFAULT_RULES) {
  const tpl = car.prices?.tpl?.[planId];
  if (tpl == null) return null;
  if (insurance === 'casco') return car.prices.casco?.[planId] ?? Math.round(tpl * rules.cascoMultiplier);
  return tpl;
}

export function planHours(planId, rules = DEFAULT_RULES) {
  return rules.plans.find(p => p.id === planId)?.hours ?? 0;
}

// Price for one booking. The club discount applies to the rental only.
// extras: ids of the car's paid add-ons (child seat, second driver…), charged per started day.
export function quote({ car, planId, qty = 1, insurance = 'tpl', delivery = 'center', extras = [], st, rules = DEFAULT_RULES }) {
  const unit = planPrice(car, planId, insurance, rules);
  if (unit == null) return null;
  const rental = unit * qty;
  const pct = st ? st.discount : 0;
  const discount = round2(rental * pct / 100);
  const deliveryFee = rules.delivery[delivery] ?? 0;
  const rentalPaid = round2(rental - discount);
  const days = Math.max(1, Math.ceil(planHours(planId, rules) * qty / 24));
  const extrasFee = round2((car.extras || []).filter(e => extras.includes(e.id)).reduce((s, e) => s + e.perDay * days, 0));
  return {
    unit, qty, rental, pct, discount, rentalPaid, deliveryFee, extrasFee, days,
    total: round2(rentalPaid + deliveryFee + extrasFee),
    deposit: deposit(car, rules),
    hours: planHours(planId, rules) * qty,
  };
}

export function fineCharge(amount, rules = DEFAULT_RULES) {
  const fee = round2(amount * rules.fineFeePct / 100);
  return { amount, fee, total: round2(amount + fee) };
}

/* ---------- Bookings and fines ---------- */

export function bookingEnd(b) {
  return time(b.endedAt || b.end);
}

export function overlaps(bookings, carId, start, end, ignoreId) {
  return bookings.some(b => b.carId === carId && b.id !== ignoreId &&
    !['cancelled'].includes(b.status) &&
    time(b.start) < time(end) && time(start) < bookingEnd(b));
}

// A camera fine comes to the car's plate. Find who had the car at that moment.
export function matchFine(fine, bookings, cars) {
  // By the car itself when the operator picked it, otherwise by the plate on the notice.
  const plate = norm(fine.plate);
  const carIds = fine.carId ? cars.filter(c => c.id === fine.carId).map(c => c.id)
    : cars.filter(c => norm(c.plate) === plate && plate).map(c => c.id);
  const t = time(fine.date);
  const candidates = bookings.filter(b => carIds.includes(b.carId) && b.status !== 'cancelled' &&
    time(b.start) <= t && t <= bookingEnd(b));
  return { carFound: carIds.length > 0, candidates, match: candidates.length === 1 ? candidates[0] : null };
}

// Automatic pass over the fines inbox: link the ones with exactly one rental, flag the rest.
export function autoLink(incidents, bookings, cars) {
  const out = [];
  for (const i of incidents) {
    if (i.kind !== 'fine' || i.clientId || i.status === 'cancelled') { out.push(i); continue; }
    const m = matchFine(i, bookings, cars);
    if (m.match) out.push({ ...i, clientId: m.match.clientId, bookingId: m.match.id, carId: m.match.carId, status: 'confirmed', linkedBy: 'auto' });
    else out.push({ ...i, status: 'review', reviewReason: !m.carFound ? 'no_car' : m.candidates.length ? 'several' : 'no_rental' });
  }
  return out;
}

export const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
