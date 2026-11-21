// Tests for the Cars Rent in Tbilisi club rules (site/club/js/rules.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RULES as R, DAY, status, deposit, quote, matchFine, autoLink, fineCharge, overlaps, meets } from '../site/club/js/rules.js';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const ago = d => new Date(NOW - d * DAY).toISOString();
const done = (id, clientId, paid, carId = 'cruze') => ({ id, clientId, carId, status: 'completed', rentalPaid: paid, start: ago(300), end: ago(299) });
const fine = (id, type, days, extra = {}) => ({ id, kind: 'fine', clientId: 'c1', type, date: ago(days), status: 'confirmed', ...extra });

test('new client is First Impressions with base classes only', () => {
  const st = status({ id: 'c1' }, [], [], NOW);
  assert.equal(st.tier, 'first');
  assert.equal(st.discount, 0);
  assert.deepEqual(st.classes, ['comfort', 'comfort_plus', 'business']);
  assert.equal(st.club, false);
});

test('Club needs both $1500 and 3 rentals', () => {
  const one = [done('b1', 'c1', 1600)];
  assert.equal(status({ id: 'c1' }, one, [], NOW).tier, 'solid');
  const three = [done('b1', 'c1', 600), done('b2', 'c1', 500), done('b3', 'c1', 450)];
  const st = status({ id: 'c1' }, three, [], NOW);
  assert.equal(st.tier, 'club');
  assert.equal(st.discount, 5);
  assert.ok(st.classes.includes('sport'));
  assert.ok(!st.classes.includes('exclusive'));
});

test('combine "or" lets either condition through', () => {
  assert.equal(meets({ minSpend: 1500, minRentals: 3, combine: 'or' }, { spend: 1600, rentals: 1 }), true);
  assert.equal(meets({ minSpend: 1500, minRentals: 3, combine: 'or' }, { spend: 100, rentals: 3 }), true);
  assert.equal(meets({ minSpend: 1500, minRentals: 3, combine: 'or' }, { spend: 100, rentals: 1 }), false);
});

test('largest discount wins, they do not add up', () => {
  const b = [done('b1', 'c1', 600)];
  const st = status({ id: 'c1', educationPassed: true }, b, [], NOW); // solid 1% vs course 2%
  assert.equal(st.discount, 2);
  assert.equal(st.discountSource, 'education');
  const inv = status({ id: 'c1', educationPassed: true, investor: true }, b, [], NOW);
  assert.equal(inv.discount, 10);
});

test('investor has every class from day one', () => {
  const st = status({ id: 'c1', investor: true }, [], [], NOW);
  assert.ok(st.classes.includes('exclusive'));
  assert.equal(st.club, true);
});

test('minor fines do not count, 3 gross in 6 months suspend', () => {
  const b = [done('b1', 'c1', 2000), done('b2', 'c1', 1000), done('b3', 'c1', 900), done('b4', 'c1', 100)];
  const minor = [fine('f1', 'speed_20_40', 10), fine('f2', 'marking', 20), fine('f3', 'parking', 30), fine('f4', 'speed_20_40', 40)];
  assert.equal(status({ id: 'c1' }, b, minor, NOW).suspended, false);
  const gross = [fine('g1', 'speed_40_plus', 10), fine('g2', 'red_light', 50), fine('g3', 'double_solid', 100)];
  const st = status({ id: 'c1' }, b, gross, NOW);
  assert.equal(st.suspended, true);
  assert.equal(st.discount, 0);
  assert.deepEqual(st.classes, ['comfort', 'comfort_plus', 'business']);
  assert.equal(st.club, false);
  // Lifted when the oldest of the three leaves the window.
  assert.equal(st.suspendedUntil, Date.parse(ago(100)) + R.penalty.windowDays * DAY);
});

test('gross fines older than the window are forgotten', () => {
  const gross = [fine('g1', 'speed_40_plus', 10), fine('g2', 'red_light', 50), fine('g3', 'double_solid', 200)];
  assert.equal(status({ id: 'c1' }, [], gross, NOW).suspended, false);
});

test('disputed or cancelled fines do not count', () => {
  const gross = [fine('g1', 'speed_40_plus', 10), fine('g2', 'red_light', 50), fine('g3', 'double_solid', 60, { status: 'disputed' })];
  assert.equal(status({ id: 'c1' }, [], gross, NOW).suspended, false);
});

test('3 at-fault accidents suspend, not-at-fault do not', () => {
  const acc = (id, d, atFault) => ({ id, kind: 'accident', clientId: 'c1', atFault, date: ago(d), status: 'confirmed' });
  assert.equal(status({ id: 'c1' }, [], [acc('a1', 5, true), acc('a2', 9, true), acc('a3', 20, false)], NOW).suspended, false);
  assert.equal(status({ id: 'c1' }, [], [acc('a1', 5, true), acc('a2', 9, true), acc('a3', 20, true)], NOW).suspended, true);
});

test('investor loses access under the same rules but keeps course discount', () => {
  const gross = [fine('g1', 'speed_40_plus', 10), fine('g2', 'red_light', 50), fine('g3', 'oncoming', 60)];
  const st = status({ id: 'c1', investor: true, educationPassed: true }, [], gross, NOW);
  assert.equal(st.suspended, true);
  assert.equal(st.discount, 2);
  assert.ok(!st.classes.includes('sport'));
});

test('rental with a gross fine does not count toward rentals', () => {
  const b = [done('b1', 'c1', 600), done('b2', 'c1', 500), done('b3', 'c1', 450)];
  const st = status({ id: 'c1' }, b, [fine('g1', 'red_light', 400, { bookingId: 'b3' })], NOW);
  assert.equal(st.progress.rentals, 2);
  assert.equal(st.tier, 'solid');
});

test('deposit by class and power, with a per-car override', () => {
  assert.equal(deposit({ class: 'comfort', hp: 153 }), 70);
  assert.equal(deposit({ class: 'business', hp: 241 }), 200);
  assert.equal(deposit({ class: 'sport', hp: 450 }), 500);
  assert.equal(deposit({ class: 'sport', hp: 450, depositOverride: 350 }), 350);
});

test('quote applies discount to rental only', () => {
  const car = { class: 'comfort', hp: 150, prices: { tpl: { '1d': 50 }, casco: { '1d': 60 } } };
  const st = { discount: 5 };
  const q = quote({ car, planId: '1d', qty: 3, insurance: 'casco', delivery: 'airport', st });
  assert.equal(q.rental, 180);
  assert.equal(q.discount, 9);
  assert.equal(q.total, 181);
  assert.equal(q.deposit, 70);
  assert.equal(q.hours, 72);
});

test('fine is matched to whoever had the car', () => {
  const cars = [{ id: 'cruze', plate: 'RI-460-AA' }];
  const bookings = [
    { id: 'b1', clientId: 'c1', carId: 'cruze', status: 'completed', start: '2026-10-01T10:00:00Z', end: '2026-10-03T10:00:00Z' },
    { id: 'b2', clientId: 'c2', carId: 'cruze', status: 'completed', start: '2026-10-05T10:00:00Z', end: '2026-10-06T10:00:00Z' },
  ];
  const f = { id: 'f1', kind: 'fine', plate: 'ri 460 aa', date: '2026-10-02T15:00:00Z', type: 'red_light', status: 'new' };
  assert.equal(matchFine(f, bookings, cars).match.clientId, 'c1');
  const [linked, orphan] = autoLink([f, { ...f, id: 'f2', date: '2026-10-04T15:00:00Z' }], bookings, cars);
  assert.equal(linked.clientId, 'c1');
  assert.equal(linked.status, 'confirmed');
  assert.equal(orphan.status, 'review');
  assert.equal(orphan.reviewReason, 'no_rental');
});

test('fine fee and overlap check', () => {
  assert.deepEqual(fineCharge(100), { amount: 100, fee: 8, total: 108 });
  const b = [{ id: 'b1', carId: 'cruze', status: 'paid', start: '2026-11-11T10:00:00Z', end: '2026-11-12T10:00:00Z' }];
  assert.equal(overlaps(b, 'cruze', '2026-11-12T09:00:00Z', '2026-11-13T09:00:00Z'), true);
  assert.equal(overlaps(b, 'cruze', '2026-11-12T10:00:00Z', '2026-11-13T09:00:00Z'), false);
  assert.equal(overlaps(b, 'c300', '2026-11-12T09:00:00Z', '2026-11-13T09:00:00Z'), false);
});

test('extras are charged per started day, without discount', () => {
  const car = { class: 'comfort', prices: { tpl: { '8h': 28, '3d': 142 } }, extras: [{ id: 'childSeat', perDay: 3 }, { id: 'secondDriver', perDay: 3 }] };
  const q = quote({ car, planId: '3d', extras: ['childSeat'], st: { discount: 10 } });
  assert.equal(q.extrasFee, 9);
  assert.equal(q.total, round(142 * 0.9 + 9));
  assert.equal(quote({ car, planId: '8h', extras: ['childSeat', 'secondDriver'] }).extrasFee, 6);
});

test('fine entered for a car, without a plate, still finds the driver', () => {
  const cars = [{ id: 'car-rent-2089', plate: '' }];
  const b = [{ id: 'b1', clientId: 'c1', carId: 'car-rent-2089', status: 'paid', start: '2026-11-01T10:00:00Z', end: '2026-11-02T10:00:00Z' }];
  assert.equal(matchFine({ carId: 'car-rent-2089', date: '2026-11-01T18:00:00Z' }, b, cars).match.id, 'b1');
});
function round(n) { return Math.round(n * 100) / 100; }
