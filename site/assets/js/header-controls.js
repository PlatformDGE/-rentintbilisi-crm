// Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
// Currency and language buttons of the top bar, on the site and on the standalone map.
// Each shows the current value; a tap moves to the next one.
import { t, getLang, languages } from './i18n.js';
import { icon } from './icons.js';
import { getCurrency } from './store.js';

const SIGN = { USD: '$', GEL: '₾' };

export function curChip() {
  const cur = getCurrency();
  return `<button type="button" class="hc hc-cur" data-cur-toggle aria-label="${t('nav.currency')}: ${cur}" title="${t('nav.currency')}"><b>${SIGN[cur]}</b><small>${cur}</small></button>`;
}

export function langChip() {
  const now = getLang();
  const next = languages[(languages.indexOf(now) + 1) % languages.length];
  return `<button type="button" class="hc hc-lang" data-lang="${next}" aria-label="Language: ${now.toUpperCase()}" title="Language">${icon('globe')}<span lang="${now}">${now.toUpperCase()}</span></button>`;
}
