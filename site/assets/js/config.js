// Single place for business configuration: services, contacts, channels.
// Copy lives in i18n.js; this file only describes structure and behaviour.

export const CONTACT = {
  telegram: 'David_Tibelashvili',
  phone: '+995 599 20 67 16',
  email: 'hello@homesingeorgia.ge',
  channels: { rent: 'rent_tbilisi_ge', sale: 'sale_in_tbilisi', cars: 'carsintbilisi' },
};

export const phoneHref = phone => 'tel:' + String(phone || CONTACT.phone).replace(/[^\d+]/g, '');
export const whatsappHref = (phone, text = '') =>
  'https://wa.me/' + String(phone || CONTACT.phone).replace(/\D/g, '') + (text ? '?text=' + encodeURIComponent(text) : '');
export const telegramHref = user => 'https://t.me/' + String(user || CONTACT.telegram).replace(/^@/, '');

// Each live service reads the normalized feed (site/data/listings.json).
// `period` drives the price suffix, `filters` the filter panel sections.
export const SERVICES = {
  rent: { group: 'realty', icon: 'key', live: true, period: 'month', channel: 'rent',
    filters: ['price', 'beds', 'kind', 'area', 'district', 'metro', 'building', 'amenities', 'pets', 'term', 'flags'] },
  daily: { group: 'realty', icon: 'moon', live: false, period: 'night', channel: 'rent' },
  sale: { group: 'realty', icon: 'tag', live: true, period: '', channel: 'sale',
    filters: ['price', 'beds', 'kind', 'area', 'district', 'metro', 'building', 'condition', 'flags'] },
  // Separate direction with its own source and contacts; launches later.
  new: { group: 'realty', icon: 'crane', live: false, period: '', channel: '' },
  'car-rent': { group: 'auto', icon: 'car', live: false, period: 'day', channel: 'cars' },
  'car-hourly': { group: 'auto', icon: 'clock', live: false, period: 'hour', channel: 'cars' },
  'car-sale': { group: 'auto', icon: 'gauge', live: false, period: '', channel: 'cars' },
};

export const GROUPS = {
  realty: { icon: 'home', services: ['rent', 'daily', 'sale', 'new'] },
  auto: { icon: 'car', services: ['car-rent', 'car-hourly', 'car-sale'] },
};

// Pseudo-service used by the global search: every live real-estate offer.
export const ALL = { group: 'realty', icon: 'search', live: true, period: '',
  filters: ['price', 'beds', 'kind', 'area', 'district', 'metro', 'flags'] };

export const serviceOf = id => (id === 'all' ? ALL : SERVICES[id]);

export const AMENITY_ORDER = ['conditioner', 'wifi', 'dishwasher', 'washer', 'oven', 'microwave', 'stove', 'tv', 'balcony',
  'terrace', 'courtyard', 'elevator', 'parking', 'pool', 'gym', 'fireplace', 'view', 'vacuum', 'storage', 'security', 'generator', 'playground'];

export const FILTER_AMENITIES = ['conditioner', 'dishwasher', 'washer', 'balcony', 'terrace', 'elevator', 'parking', 'oven', 'wifi', 'courtyard'];

export const MAP_CENTER = [41.7151, 44.8271];
