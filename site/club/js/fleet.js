// Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
// Starting fleet, taken from the Cars Rent in Tbilisi site on Tilda (November 2026).
// The Chevrolet Cruze prices and deposit are copied from its car page. The other cars
// only had an hourly "from" price on the catalogue, so their plans are scaled from the
// Cruze by that price; power (hp) is an estimate for the engine most likely fitted.
// The operator corrects all of this in the admin panel.

const scale = (k, table) => Object.fromEntries(Object.entries(table).map(([p, v]) => [p, Math.round(v * k)]));

const CRUZE_TPL = { '4h': 15, '8h': 28, '1d': 50, '3d': 142, '7d': 325, '14d': 630, '30d': 1320 };
const CRUZE_CASCO = { '4h': 18, '8h': 34, '1d': 60, '3d': 171, '7d': 390, '14d': 756, '30d': 1584 };

export const FLEET = [
  {
    id: 'cruze', name: 'Chevrolet Cruze', color: { en: 'Blue', ru: 'Синий', ka: 'ლურჯი' },
    plate: 'RI-460-AA', class: 'comfort', hp: 153, hpEstimated: true,
    fuel: 'Premium 95', consumption: 7.5, drive: 'FWD', gearbox: 'AT', seats: 5,
    prices: { tpl: CRUZE_TPL, casco: CRUZE_CASCO }, depositOverride: 70,
    address: '2 Roman Miminoshvili Street, Tbilisi', parking: 'A1010', lat: null, lon: null,
    photos: Array.from({ length: 11 }, (_, i) => `media/cruze-${i + 1}.jpg`),
    status: 'available',
  },
  {
    id: 'compass', name: 'Jeep Compass', color: { en: 'Black', ru: 'Чёрный', ka: 'შავი' },
    plate: '', class: 'comfort_plus', hp: 180, hpEstimated: true,
    fuel: 'Premium 95', consumption: null, drive: '4WD', gearbox: 'AT', seats: 5,
    prices: { tpl: scale(1, CRUZE_TPL), casco: scale(1, CRUZE_CASCO) },
    address: '', lat: null, lon: null,
    photos: ['media/compass-1.jpg'], status: 'available',
  },
  {
    id: 'c300', name: 'Mercedes-Benz C300', color: { en: 'Blue', ru: 'Синий', ka: 'ლურჯი' },
    plate: '', class: 'business', hp: 241, hpEstimated: true,
    fuel: 'Premium 95', consumption: null, drive: 'RWD', gearbox: 'AT', seats: 5,
    prices: { tpl: scale(1.2, CRUZE_TPL), casco: scale(1.2, CRUZE_CASCO) },
    address: '', lat: null, lon: null,
    photos: ['media/c300-1.jpg'], status: 'available',
  },
  {
    id: 'mustang', name: 'Ford Mustang', color: { en: 'Grey', ru: 'Серый', ka: 'ნაცრისფერი' },
    plate: 'SH-181-LI', class: 'sport', hp: 310, hpEstimated: true,
    fuel: 'Premium 95', consumption: null, drive: 'RWD', gearbox: 'AT', seats: 4,
    prices: { tpl: scale(4 / 3, CRUZE_TPL), casco: scale(4 / 3, CRUZE_CASCO) },
    address: '', lat: null, lon: null,
    photos: ['media/mustang-1.jpg'], status: 'available',
  },
];
