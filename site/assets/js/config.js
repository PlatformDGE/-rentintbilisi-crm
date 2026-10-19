// Single place for business configuration: services, contacts, channels.
// Copy lives in i18n.js; this file only describes structure and behaviour.

export const CONTACT = {
  telegram: 'David_Tibelashvili',
  phone: '+995 599 20 67 16',
  email: 'hello@homesingeorgia.ge',
};

// Public Telegram channel of every direction.
export const CHANNELS = {
  rent: 'rent_tbilisi_ge',
  sale: 'homesingeorgia',
  commercial: 'commercialingeorgia',
  daily: 'dayrentingeorgia',
  new: 'DevelopmentIngeorgia',
  'car-rent': 'CarsRentInGeorgia',
  'car-sale': 'CarsSaleInGeorgia',
};

export const phoneHref = phone => 'tel:' + String(phone || CONTACT.phone).replace(/[^\d+]/g, '');
export const whatsappHref = (phone, text = '') =>
  'https://wa.me/' + String(phone || CONTACT.phone).replace(/\D/g, '') + (text ? '?text=' + encodeURIComponent(text) : '');
export const telegramHref = user => 'https://t.me/' + String(user || CONTACT.telegram).replace(/^@/, '');

// A service turns into a live catalogue as soon as its channel has offers in
// site/data/listings.json (see markLive); until then it shows a "coming soon" page.
// `filters` lists the filter panel sections of the catalogue.
const REALTY = ['price', 'beds', 'kind', 'area', 'district', 'metro'];
export const SERVICES = {
  rent: { group: 'realty', icon: 'key', filters: [...REALTY, 'building', 'amenities', 'pets', 'term', 'flags'] },
  daily: { group: 'realty', icon: 'moon', filters: ['price', 'beds', 'district', 'metro', 'amenities', 'flags'] },
  sale: { group: 'realty', icon: 'tag', filters: [...REALTY, 'building', 'condition', 'flags'] },
  new: { group: 'realty', icon: 'crane', filters: ['price', 'beds', 'area', 'district', 'metro', 'condition', 'flags'] },
  commercial: { group: 'realty', icon: 'building', filters: ['price', 'deal', 'area', 'district', 'metro', 'condition', 'flags'] },
  'car-rent': { group: 'auto', icon: 'car', filters: ['price', 'gearbox', 'fuel', 'year', 'flags'] },
  'car-sale': { group: 'auto', icon: 'gauge', filters: ['price', 'year', 'mileage', 'gearbox', 'fuel', 'flags'] },
};

export const GROUPS = {
  realty: { icon: 'home', services: ['rent', 'daily', 'sale', 'new', 'commercial'] },
  auto: { icon: 'car', services: ['car-rent', 'car-sale'] },
};

export function markLive(counts = {}) {
  Object.entries(SERVICES).forEach(([id, s]) => { s.live = (counts[id] || 0) > 0; });
}

// Pseudo-service used by the global search: every live real-estate offer.
export const ALL = { group: 'realty', icon: 'search', live: true, filters: [...REALTY, 'flags'] };

export const serviceOf = id => (id === 'all' ? ALL : SERVICES[id]);

export const AMENITY_ORDER = ['conditioner', 'wifi', 'dishwasher', 'washer', 'oven', 'microwave', 'stove', 'tv', 'balcony',
  'terrace', 'courtyard', 'elevator', 'parking', 'pool', 'gym', 'fireplace', 'view', 'vacuum', 'storage', 'security', 'generator', 'playground'];

export const FILTER_AMENITIES = ['conditioner', 'dishwasher', 'washer', 'balcony', 'terrace', 'elevator', 'parking', 'oven', 'wifi', 'courtyard'];

export const MAP_CENTER = [41.7151, 44.8271];

// MapTiler key is public by design (it ships to the browser); it is restricted
// to the site's domain in the MapTiler dashboard (Account → API keys).
export const MAPTILER_KEY = '8rgCgBliYpwKCmMzEVV8';
