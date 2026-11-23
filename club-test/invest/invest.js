// Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
// Investment yield calculator for sale and new-build flats — test site only.
//
// A small add-on to the built test page: it does not touch the site bundle.
// When a sale listing opens (#/listing/sale-…), it adds a "Rental yield" block
// under "Key facts": long-term rent (median for the same district and bedrooms
// from the rent channel, see scripts/build_rent_medians.py) and daily rent
// (price per night × occupancy, minus 30% running costs). Every number is editable.
(() => {
  const SERVICES = new Set(['sale', 'new']);
  const KINDS = new Set(['apartment', 'house']);
  const DAILY_COSTS = 0.3;           // cleaning, utilities, booking platform fees
  const NIGHT_USD = 60, OCCUPANCY = 60;
  const MIN_POSTS = 5;               // a median needs at least this many posts behind it

  // Same as PLACE_ALIASES in site/assets/js/places.js.
  const ALIASES = {
    'Digomi': 'Dighomi', 'Didi Digomi': 'Didi Dighomi', 'Digomi Massive': 'Dighomi Massive', 'Digomi 1-9': 'Dighomi 1-9',
    'Temka': 'Temqa', 'Temuka': 'Temqa', 'Out Of Town': 'Out of town', 'Voroncov': 'Vorontsov', 'Tskhneti': 'Tskneti',
    'Mukhyani': 'Mukhiani', 'Vazha Pshavela': 'Vazha-Pshavela',
  };
  const place = name => ALIASES[name] || name || '';
  // Resorts and other towns: the Tbilisi medians say nothing about them.
  const OUTSIDE = new Set(['Batumi', 'Kobuleti', 'Shekvetili', 'Gudauri', 'Bakuriani', 'Borjomi', 'Mtskheta', 'Rustavi', 'Saguramo', 'Out of town']);

  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    return b === 1 ? one : many;
  };
  const T = {
    ru: {
      title: 'Доходность от сдачи',
      price: 'Цена покупки, $', rent: 'Аренда в месяц, $', night: 'Цена за ночь, $', occ: 'Загрузка, %',
      long: 'Долгосрочная аренда', daily: 'Посуточная аренда',
      yield: 'годовых', year: v => `${v} в год`,
      payback: v => `окупаемость ${v} ${plural(Math.round(v), 'год', 'года', 'лет')}`,
      rooms: n => n === 0 ? 'студия' : `${n} ${plural(n, 'спальня', 'спальни', 'спален')}`,
      exact: (n, where) => `Аренда в месяц — медиана ${n} ${plural(n, 'объявления', 'объявлений', 'объявлений')} из нашего канала аренды за год: ${where}.`,
      scaled: (n, where) => `Аренда в месяц — оценка по ${n} ${plural(n, 'объявлению', 'объявлениям', 'объявлениям')} за год: ${where}, с поправкой на район.`,
      city: (n, where) => `Аренда в месяц — медиана ${n} ${plural(n, 'объявления', 'объявлений', 'объявлений')} по Тбилиси за год: ${where}.`,
      none: 'Медианы по этому району пока нет, впишите ожидаемую аренду.',
      note: 'Посуточно: минус 30% на уборку, коммунальные платежи и комиссии площадок. Расчёт ориентировочный: без налогов, ремонта и мебели.',
      reset: 'Сбросить',
    },
    en: {
      title: 'Rental yield',
      price: 'Purchase price, $', rent: 'Monthly rent, $', night: 'Price per night, $', occ: 'Occupancy, %',
      long: 'Long-term rent', daily: 'Daily rent',
      yield: 'a year', year: v => `${v} a year`,
      payback: v => `pays back in ${v} years`,
      rooms: n => n === 0 ? 'studio' : `${n} bedroom${n === 1 ? '' : 's'}`,
      exact: (n, where) => `Monthly rent is the median of ${n} listings in our rent channel over the last year: ${where}.`,
      scaled: (n, where) => `Monthly rent is estimated from ${n} listings over the last year: ${where}, adjusted for the district.`,
      city: (n, where) => `Monthly rent is the Tbilisi median of ${n} listings over the last year: ${where}.`,
      none: 'No median for this district yet, enter the rent you expect.',
      note: 'Daily rent: minus 30% for cleaning, utilities and booking platform fees. A rough estimate: before tax, renovation and furniture.',
      reset: 'Reset',
    },
    ka: {
      title: 'შემოსავლიანობა გაქირავებიდან',
      price: 'შეძენის ფასი, $', rent: 'ქირა თვეში, $', night: 'ღამის ფასი, $', occ: 'დატვირთვა, %',
      long: 'გრძელვადიანი ქირა', daily: 'დღიური ქირა',
      yield: 'წელიწადში', year: v => `${v} წელიწადში`,
      payback: v => `ანაზღაურება ${v} წელში`,
      rooms: n => n === 0 ? 'სტუდიო' : `${n} საძინებელი`,
      exact: (n, where) => `ქირა თვეში — ჩვენი არხის ${n} განცხადების მედიანა ბოლო წლის განმავლობაში: ${where}.`,
      scaled: (n, where) => `ქირა თვეში — შეფასება ბოლო წლის ${n} განცხადებით: ${where}, უბნის გათვალისწინებით.`,
      city: (n, where) => `ქირა თვეში — თბილისის მედიანა ${n} განცხადებით ბოლო წლის განმავლობაში: ${where}.`,
      none: 'ამ უბნისთვის მედიანა ჯერ არ გვაქვს, ჩაწერეთ მოსალოდნელი ქირა.',
      note: 'დღიური ქირა: მინუს 30% დასუფთავებაზე, კომუნალურებზე და პლატფორმების საკომისიოზე. მიახლოებითი გათვლა: გადასახადების, რემონტისა და ავეჯის გარეშე.',
      reset: 'განულება',
    },
  };
  // Names of places in RU / KA, for the "where" line (the rest show in English).
  const PLACES = {
    'Saburtalo': ['Сабуртало', 'საბურთალო'], 'Vake': ['Ваке', 'ვაკე'], 'Sololaki': ['Сололаки', 'სოლოლაკი'],
    'Vera': ['Вера', 'ვერა'], 'Chugureti': ['Чугурети', 'ჩუღურეთი'], 'Didi Dighomi': ['Диди Дигоми', 'დიდი დიღომი'],
    'Dighomi': ['Дигоми', 'დიღომი'], 'Dighomi Massive': ['Дигомский массив', 'დიღმის მასივი'], 'Ortachala': ['Ортачала', 'ორთაჭალა'],
    'Mtatsminda': ['Мтацминда', 'მთაწმინდა'], 'Lisi': ['Лиси', 'ლისი'], 'Gldani': ['Глдани', 'გლდანი'], 'Didube': ['Дидубе', 'დიდუბე'],
    'Tskneti': ['Цхнети', 'წყნეთი'], 'Isani': ['Исани', 'ისანი'], 'Krtsanisi': ['Крцаниси', 'კრწანისი'],
    'Old Tbilisi': ['Старый Тбилиси', 'ძველი თბილისი'], 'Avlabari': ['Авлабари', 'ავლაბარი'], 'Nadzaladevi': ['Надзаладеви', 'ნაძალადევი'],
    'Bagebi': ['Багеби', 'ბაგები'], 'Samgori': ['Самгори', 'სამგორი'], 'Varketili': ['Варкетили', 'ვარკეთილი'],
    'Nutsubidze': ['Нуцубидзе', 'ნუცუბიძე'], 'Vashlijvari': ['Вашлиджвари', 'ვაშლიჯვარი'], 'Batumi': ['Батуми', 'ბათუმი'],
    'Kobuleti': ['Кобулети', 'ქობულეთი'], 'Shekvetili': ['Шекветили', 'შეკვეთილი'], 'Mtskheta': ['Мцхета', 'მცხეთა'],
    'Rustavi': ['Рустави', 'რუსთავი'], 'Gudauri': ['Гудаури', 'გუდაური'], 'Bakuriani': ['Бакуриани', 'ბაკურიანი'],
    'Borjomi': ['Боржоми', 'ბორჯომი'], 'Saguramo': ['Сагурамо', 'საგურამო'], 'Temqa': ['Темка', 'თემქა'],
  };
  const lang = () => (T[document.documentElement.lang] ? document.documentElement.lang : 'en');
  const placeName = name => { const row = PLACES[name]; const l = lang(); return !row || l === 'en' ? name : row[l === 'ru' ? 0 : 1]; };
  const locale = () => ({ en: 'en-GB', ka: 'ka-GE', ru: 'ru-RU' })[lang()];
  const num = n => Math.round(n).toLocaleString(locale()).replace(/[  ]/g, ' ');
  const usd = n => '$' + num(n);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ---------- data ----------
  let feed, medians;
  // Same URL as the site's own loader, so the browser serves it from cache.
  const loadFeed = () => (feed ??= fetch('data/listings.json?v=' + Math.floor(Date.now() / 6e5), { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then(d => new Map(d.items.map(x => [x.id, x])))
    .catch(e => { feed = undefined; throw e; }));
  const loadMedians = () => (medians ??= fetch('invest/rent-medians.json?v=' + Math.floor(Date.now() / 36e5))
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then(d => {
      const m = new Map();
      d.rows.forEach(([district, rooms, value, n]) => m.set(district + '|' + (rooms ?? ''), { value, n }));
      return m;
    })
    .catch(e => { medians = undefined; throw e; }));

  /** Best monthly rent guess for a flat: { value, n, how, rooms, district } or null. */
  function rentFor(m, x) {
    const district = place(x.district);
    const rooms = Number.isInteger(x.rooms) ? Math.min(x.rooms, 5) : null;
    const get = (d, r) => { const row = m.get(d + '|' + (r ?? '')); return row && row.n >= MIN_POSTS ? row : null; };
    const exact = district && rooms != null && get(district, rooms);
    if (exact) return { ...exact, how: 'exact', rooms, district };
    const inDistrict = district && get(district, null), byRooms = rooms != null && get('', rooms), city = get('', null);
    // District level × the city-wide difference between this flat size and an average flat.
    if (inDistrict && byRooms && city) return { value: Math.round(inDistrict.value * byRooms.value / city.value / 10) * 10, n: inDistrict.n, how: 'scaled', rooms, district };
    if (inDistrict) return { ...inDistrict, how: 'exact', rooms: null, district };
    if (OUTSIDE.has(district)) return null;
    if (byRooms) return { ...byRooms, how: 'city', rooms, district: '' };
    return null;
  }

  // ---------- view ----------
  const field = (key, label, value, attrs = '') =>
    `<label class="inv-f"><span>${esc(label)}</span><input type="number" inputmode="decimal" min="0" data-inv="${key}" value="${value}" ${attrs}></label>`;

  function render(box, x, rent) {
    const s = T[lang()];
    const where = rent ? [rent.district ? placeName(rent.district) : '', rent.rooms != null ? s.rooms(rent.rooms) : ''].filter(Boolean).join(', ') : '';
    const basis = rent ? s[rent.how](rent.n, where || 'Tbilisi') : s.none;
    const defaults = { price: Math.round(x.price_usd), rent: rent ? rent.value : '', night: NIGHT_USD, occ: OCCUPANCY };
    const sub = [x.rooms != null ? s.rooms(x.rooms) : '', x.area ? `${num(x.area)} m²` : '', x.district ? placeName(place(x.district)) : ''].filter(Boolean).join(', ');
    box.innerHTML = `
      <h2>${esc(s.title)}</h2>
      ${sub ? `<p class="inv-sub">${esc(sub.charAt(0).toUpperCase() + sub.slice(1))}</p>` : ''}
      <div class="inv-fields">
        ${field('price', s.price, defaults.price, 'step="1000"')}
        ${field('rent', s.rent, defaults.rent, 'step="50"')}
        ${field('night', s.night, defaults.night, 'step="5"')}
        ${field('occ', s.occ, defaults.occ, 'step="5" max="100"')}
      </div>
      <p class="inv-basis">${esc(basis)}</p>
      <div class="inv-out">
        <div class="inv-card"><span>${esc(s.long)}</span><p class="inv-y"><b data-out="long-y"></b> <em>${esc(s.yield)}</em></p><small data-out="long-i"></small></div>
        <div class="inv-card inv-daily"><span>${esc(s.daily)}</span><p class="inv-y"><b data-out="daily-y"></b> <em>${esc(s.yield)}</em></p><small data-out="daily-i"></small></div>
      </div>
      <p class="inv-note">${esc(s.note)} <button type="button" class="inv-reset" data-inv-reset>${esc(s.reset)}</button></p>`;
    const inputs = Object.fromEntries([...box.querySelectorAll('[data-inv]')].map(i => [i.dataset.inv, i]));
    const out = Object.fromEntries([...box.querySelectorAll('[data-out]')].map(o => [o.dataset.out, o]));
    const val = k => Math.max(0, parseFloat(String(inputs[k].value).replace(',', '.')) || 0);
    const show = (key, income, price) => {
      const ok = income > 0 && price > 0;
      out[key + '-y'].textContent = ok ? (income / price * 100).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '—';
      out[key + '-y'].nextElementSibling.hidden = !ok;
      out[key + '-i'].textContent = ok ? `${s.year(usd(income))} · ${s.payback((price / income).toLocaleString(locale(), { maximumFractionDigits: 1 }))}` : '';
    };
    const calc = () => {
      const price = val('price');
      show('long', val('rent') * 12, price);
      show('daily', val('night') * 365 * Math.min(val('occ'), 100) / 100 * (1 - DAILY_COSTS), price);
    };
    box.addEventListener('input', calc);
    box.addEventListener('click', e => {
      if (!e.target.closest('[data-inv-reset]')) return;
      Object.entries(defaults).forEach(([k, v]) => { inputs[k].value = v; });
      calc();
    });
    calc();
  }

  let pending = 0;
  async function mount() {
    const m = location.hash.match(/^#\/listing\/([^?]+)/);
    if (!m) return;
    const id = decodeURIComponent(m[1]);
    const main = document.querySelector('.listing .l-main');
    if (!main || main.querySelector('.inv')) return;
    const ticket = ++pending;
    let x, rents;
    try { [x, rents] = await Promise.all([loadFeed().then(f => f.get(id)), loadMedians().catch(() => new Map())]); } catch { return; }
    if (ticket !== pending || !x || !SERVICES.has(x.service) || !KINDS.has(x.kind) || !(x.price_usd > 0)) return;
    const host = document.querySelector('.listing .l-main');
    if (!host || host.querySelector('.inv')) return;
    const box = document.createElement('section');
    box.className = 'l-sec inv';
    render(box, x, rentFor(rents, x));
    const facts = host.querySelector('.l-sec');
    facts ? facts.after(box) : host.prepend(box);
  }

  const start = () => {
    const main = document.getElementById('main');
    if (!main) return;
    // The site re-renders #main on every route, language and currency change.
    let queued = false;
    new MutationObserver(() => {
      if (queued || !location.hash.startsWith('#/listing/')) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; mount(); });
    }).observe(main, { childList: true, subtree: true });
    window.addEventListener('hashchange', () => setTimeout(mount, 0));
    mount();
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
