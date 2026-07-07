const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const todayISO = () => new Date().toISOString().slice(0, 10);
const ruDate = () => new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
const hour = new Date().getHours();
const hello = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

const seed = {
  properties: [
    { id: uid(), address: 'Атонели, Старый Тбилиси', district: 'Центр', type: '1 спальня', price: 850, status: 'Свободно', agent: 'Иракли', owner: 'Демо собственник', phone: '995XXXXXXXXX', notes: 'Итальянский дом, рядом рынок Орбелиани, резиденция президента, Дом юстиции, Руставели.' },
    { id: uid(), address: 'Кипшидзе 6, Ваке', district: 'Ваке', type: 'Коммерция 175 м²', price: 3675, status: 'В работе', agent: 'Дима', owner: 'Демо собственник', phone: '995XXXXXXXXX', notes: 'Фасад 17 м, $21/м². Рядом Nikora, GPS, PSP, универсам, зоомагазин.' },
    { id: uid(), address: 'Аракишвили, Ваке', district: 'Ваке', type: '2 спальни', price: 1100, status: 'Свободно', agent: 'Миша', owner: 'Демо собственник', phone: '995XXXXXXXXX', notes: 'Арка со шлагбаумом, 2-й подъезд, 3-й этаж, коричневая дверь.' },
    { id: uid(), address: 'Outlook Ваке / The Max', district: 'Ваке', type: '2 спальни, премиум', price: 1400, status: 'Свободно', agent: 'Давид', owner: 'Демо собственник', phone: '995XXXXXXXXX', notes: 'Престижный дом рядом с McDonald’s, кафе и торговым центром.' },
    { id: uid(), address: 'Асатиани, Сололаки', district: 'Сололаки', type: '1 спальня', price: 780, status: 'Сдано', agent: 'Серги', owner: 'Демо собственник', phone: '995XXXXXXXXX', notes: 'Внутренний двор, 2-й этаж.' }
  ],
  owners: [
    { id: uid(), name: 'Демо собственник — Атонели', phone: '995XXXXXXXXX', object: 'Атонели', status: 'Эксклюзив', last: 'Перед публикацией обязателен Owner Information.' },
    { id: uid(), name: 'Демо собственник — Кипшидзе 6', phone: '995XXXXXXXXX', object: 'Кипшидзе 6', status: 'В работе', last: 'Проверить реестр, фасад и финальную цену.' }
  ],
  clients: [
    { id: uid(), name: 'Запрос дипломатов', phone: '—', request: 'Сабуртало / Лиси, 2 спальни до 1500€, 3 спальни или дом до 2000€, 2 санузла, терраса/двор, 6–8 недель', budget: 2000, status: 'Горячий', agent: 'Иракли' },
    { id: uid(), name: 'Коммерческий клиент', phone: '—', request: 'Коммерческое помещение: Freedom Square / Ваке', budget: 4000, status: 'Новый', agent: 'Дима' }
  ],
  reports: [
    { id: uid(), type: 'Общий отчет', agent: 'Дима', target: 'Фото / Показ / Стикеры / Звонки / Сделка', status: 'Готово', date: todayISO() },
    { id: uid(), type: 'Ежедневный отчет', agent: 'Мари', target: 'Контроль оператора', status: 'Запланировано', date: todayISO() }
  ],
  agents: [
    { id: uid(), name: 'Иракли', role: 'Владелец / менеджер', deals: 92, objects: 184, level: '90%' },
    { id: uid(), name: 'David Tibelashvili', role: 'CEO', deals: 120, objects: 210, level: '90%' },
    { id: uid(), name: 'Мари', role: 'Оператор', deals: 0, objects: 0, level: '50%' },
    { id: uid(), name: 'Зураб', role: 'Оператор', deals: 0, objects: 0, level: '50%' },
    { id: uid(), name: 'Настя', role: 'Админ Airbnb / Booking', deals: 0, objects: 0, level: '50%' },
    { id: uid(), name: 'Дима', role: 'Агент', deals: 44, objects: 62, level: '70%' },
    { id: uid(), name: 'Миша', role: 'Агент', deals: 12, objects: 38, level: '70%' }
  ],
  tasks: [
    { id: uid(), time: '12:00', title: 'Еженедельная встреча в Stamba', status: 'Запланировано', agent: 'Команда' },
    { id: uid(), time: '13:30', title: 'Проверить Owner Information перед публикацией', status: 'Горячий', agent: 'Оператор' },
    { id: uid(), time: '15:00', title: 'Публикация: 9 фото + 1 видео + геолинк', status: 'В работе', agent: 'Агент' }
  ]
};

const storeKey = 'rit_crm_air_dashboard_v1';
let db = JSON.parse(localStorage.getItem(storeKey) || 'null') || seed;
let page = 'dashboard';
let query = '';
let filter = 'all';
const $ = s => document.querySelector(s);
const nav = [
  ['dashboard', '🏠', 'Главная'], ['properties', '🏢', 'Объекты'], ['owners', '👑', 'Собственники'], ['clients', '🧑‍💼', 'Клиенты'],
  ['reports', '📋', 'Отчеты'], ['contracts', '📄', 'Договоры'], ['agents', '👥', 'Агенты'], ['map', '🗺️', 'Карта'], ['analytics', '📈', 'Аналитика'], ['settings', '⚙️', 'Настройки']
];
const subs = { dashboard: 'Рабочая панель Rent in Tbilisi', properties: 'Объекты, цены, районы и статусы', owners: 'База собственников и история общения', clients: 'Заявки, клиенты и показы', reports: 'Контроль работы команды', contracts: 'Создание и предпросмотр договора', agents: 'Уровни, комиссии и команда', map: 'Карта объектов по районам', analytics: 'KPI и статистика', settings: 'Экспорт, импорт и настройки' };
const collByPage = { properties: 'properties', owners: 'owners', clients: 'clients', reports: 'reports', agents: 'agents' };

function esc(v) { return String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function money(v) { return '$' + Number(v || 0).toLocaleString('en-US'); }
function save() { localStorage.setItem(storeKey, JSON.stringify(db)); renderNav(); }
function countAll() { return db.properties.length + db.owners.length + db.clients.length + db.reports.length + db.agents.length + db.tasks.length; }
function chip(v) { const s = String(v || ''); const c = /Свободно|Эксклюзив|Горячий|Готово|90/.test(s) ? 'good' : /Сдано|Потерян|Ошибка/.test(s) ? 'bad' : 'warn'; return `<span class="chip ${c}">${esc(s)}</span>`; }
function toast(t) { $('#toast').textContent = t; $('#toast').classList.add('show'); setTimeout(() => $('#toast').classList.remove('show'), 1500); }
function match(x) { return !query || JSON.stringify(x).toLowerCase().includes(query.toLowerCase()); }
function find(coll, id) { return db[coll].find(x => x.id === id); }

function renderNav() {
  $('#recordsCount').textContent = countAll();
  $('#nav').innerHTML = nav.map(n => {
    const count = collByPage[n[0]] ? db[collByPage[n[0]]].length : '';
    return `<button class="nav ${page === n[0] ? 'active' : ''}" onclick="go('${n[0]}')"><span>${n[1]}</span><span>${n[2]}</span>${count !== '' ? `<small>${count}</small>` : ''}</button>`;
  }).join('');
}
function go(p) { page = p; query = ''; filter = 'all'; $('#search').value = ''; const n = nav.find(x => x[0] === p); $('#title').textContent = n[2]; $('#subtitle').textContent = subs[p]; $('#side').classList.remove('open'); renderNav(); render(); }
function metric(label, value, sub) { return `<div class="card metric span3"><small>${label}</small><b>${value}</b><p>${sub}</p></div>`; }
function tabs(items) { return `<div class="tabs">${items.map(x => `<button class="tab ${filter === x ? 'active' : ''}" onclick="filter='${x}';render()">${x === 'all' ? 'Все' : x}</button>`).join('')}</div>`; }
function table(head, rows) { return `<div class="table-wrap"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td class="empty" colspan="${head.length}">Нет данных</td></tr>`}</tbody></table></div>`; }

function dashboard() {
  const free = db.properties.filter(x => x.status === 'Свободно').length;
  const rev = db.properties.reduce((a, x) => a + Number(x.price || 0), 0);
  const hot = db.clients.filter(x => x.status === 'Горячий').length;
  const latest = db.properties.slice(0, 4);
  return `<div class="grid">
    <div class="card hero span12">
      <div class="hero-top"><div><h2>${hello}, Иракли 👋</h2><p>Сегодня ${ruDate()}. Это новый Dashboard: быстрый, чистый, минималистичный, в стиле Airbnb, но с цветом Rent in Tbilisi.</p></div><div class="date-pill">CRM v1 / браузерная база</div></div>
      <div class="hero-actions">
        <button onclick="openForm('property')">＋ Новый объект</button><button onclick="openForm('owner')">＋ Собственник</button><button onclick="openForm('client')">＋ Клиент</button><button onclick="openForm('report')">＋ Отчет</button>
      </div>
    </div>
    ${metric('Объекты', db.properties.length, `${free} свободно`)}${metric('Показы', '18', 'демо-показатель')}${metric('Сделки', '5', 'демо-показатель')}${metric('Потенциал', money(rev), `${hot} горячий клиент`)}
    <div class="card span7"><div class="section"><h2>Сегодня</h2><button class="secondary" onclick="openForm('task')">+ Задача</button></div><div class="list">${db.tasks.map(t => `<div class="item"><div class="avatar">${esc(t.time)}</div><div><b>${esc(t.title)}</b><p>${esc(t.agent)}</p></div><div>${chip(t.status)} <button class="ghost" onclick="done('tasks','${t.id}')">Готово</button></div></div>`).join('')}</div></div>
    <div class="card span5"><div class="section"><h2>Быстрые действия</h2></div><div class="quick"><button onclick="openForm('property')"><span class="emoji">🏢</span><b>Добавить объект</b><span>Адрес, цена, агент, статус</span></button><button onclick="openForm('owner')"><span class="emoji">👑</span><b>Собственник</b><span>Телефон, объект, история</span></button><button onclick="go('contracts')"><span class="emoji">📄</span><b>Договор</b><span>Предпросмотр и данные</span></button><button onclick="exportData()"><span class="emoji">⬇️</span><b>Экспорт</b><span>Скачать JSON-базу</span></button></div></div>
    <div class="card span12"><div class="section"><h2>Последние объекты</h2><button class="secondary" onclick="go('properties')">Все объекты</button></div><div class="cards">${latest.map(propertyCard).join('')}</div></div>
  </div>`;
}
function propertyCard(x) { return `<article class="card property"><div class="photo"><span class="price">${money(x.price)}</span></div><div class="property-body"><h3>${esc(x.address)}</h3><p class="muted">${esc(x.district)} · ${esc(x.type)}</p><div class="meta"><span>${esc(x.agent)}</span><span>${esc(x.owner)}</span>${chip(x.status)}</div><div class="property-actions"><button class="ghost" onclick="openForm('property','${x.id}')">Изменить</button><button class="ghost danger" onclick="removeItem('properties','${x.id}')">Удалить</button></div></div></article>`; }
function properties() { const arr = db.properties.filter(match).filter(x => filter === 'all' || x.status === filter); return `<div class="grid"><div class="card span12"><div class="section"><h2>Объекты</h2><button class="primary" onclick="openForm('property')">+ Добавить</button></div>${tabs(['all','Свободно','В работе','Сдано'])}<div class="cards">${arr.map(propertyCard).join('')}</div></div></div>`; }
function owners() { const arr = db.owners.filter(match).filter(x => filter === 'all' || x.status === filter); return `<div class="grid"><div class="card span12"><div class="section"><h2>Собственники</h2><button class="primary" onclick="openForm('owner')">+ Добавить</button></div>${tabs(['all','Эксклюзив','В работе'])}${table(['Имя','Телефон','Объект','Статус','Последний контакт',''], arr.map(x => `<tr><td class="row-title">${esc(x.name)}</td><td>${esc(x.phone)}</td><td>${esc(x.object)}</td><td>${chip(x.status)}</td><td>${esc(x.last)}</td><td class="td-actions"><button class="ghost" onclick="openForm('owner','${x.id}')">Изменить</button> <button class="ghost danger" onclick="removeItem('owners','${x.id}')">Удалить</button></td></tr>`))}</div></div>`; }
function clients() { const arr = db.clients.filter(match).filter(x => filter === 'all' || x.status === filter); return `<div class="grid"><div class="card span12"><div class="section"><h2>Клиенты</h2><button class="primary" onclick="openForm('client')">+ Добавить</button></div>${tabs(['all','Новый','Горячий','Показ','Потерян'])}${table(['Клиент','Телефон','Запрос','Бюджет','Статус','Агент',''], arr.map(x => `<tr><td class="row-title">${esc(x.name)}</td><td>${esc(x.phone)}</td><td>${esc(x.request)}</td><td>${money(x.budget)}</td><td>${chip(x.status)}</td><td>${esc(x.agent)}</td><td class="td-actions"><button class="ghost" onclick="openForm('client','${x.id}')">Изменить</button> <button class="ghost danger" onclick="removeItem('clients','${x.id}')">Удалить</button></td></tr>`))}</div></div>`; }
function reports() { const arr = db.reports.filter(match); return `<div class="grid"><div class="card span12"><div class="section"><h2>Отчеты</h2><button class="primary" onclick="openForm('report')">+ Отчет</button></div>${table(['Тип','Агент','Цель','Дата','Статус',''], arr.map(x => `<tr><td class="row-title">${esc(x.type)}</td><td>${esc(x.agent)}</td><td>${esc(x.target)}</td><td>${esc(x.date)}</td><td>${chip(x.status)}</td><td class="td-actions"><button class="ghost" onclick="openForm('report','${x.id}')">Изменить</button> <button class="ghost danger" onclick="removeItem('reports','${x.id}')">Удалить</button></td></tr>`))}</div></div>`; }
function contracts() { const p = db.properties[0] || {}; return `<div class="grid"><div class="card span5"><div class="section"><h2>Договор</h2></div><p class="muted">Пока это быстрый предпросмотр. Следующий этап — полноценная форма RU / GE / EN.</p><button class="primary" onclick="toast('На следующем этапе подключим генератор PDF')">Создать PDF</button></div><div class="card span7"><div class="contract"><h3>Договор аренды</h3><p>Собственник: ${esc(p.owner || '—')}</p><p>Объект: ${esc(p.address || '—')}</p><p>Цена: ${money(p.price || 0)}</p><p>Статус: ${esc(p.status || '—')}</p><p>Депозит возвращается в течение 3 банковских дней после возврата квартиры и подтверждения отсутствия повреждений, кроме нормального износа.</p></div></div></div>`; }
function agents() { return `<div class="grid"><div class="card span12"><div class="section"><h2>Команда</h2><button class="primary" onclick="openForm('agent')">+ Агент</button></div>${table(['Имя','Роль','Сделки','Объекты','Уровень',''], db.agents.filter(match).map(x => `<tr><td class="row-title">${esc(x.name)}</td><td>${esc(x.role)}</td><td>${esc(x.deals)}</td><td>${esc(x.objects)}</td><td>${chip(x.level)}</td><td class="td-actions"><button class="ghost" onclick="openForm('agent','${x.id}')">Изменить</button> <button class="ghost danger" onclick="removeItem('agents','${x.id}')">Удалить</button></td></tr>`))}</div></div>`; }
function mapView() { return `<div class="grid"><div class="card span12"><div class="section"><h2>Карта объектов</h2><button class="secondary" onclick="go('properties')">К списку</button></div><div class="map"><div class="road"></div>${db.properties.map((p,i)=>`<div class="pin" style="left:${18+(i*15)%70}%;top:${24+(i*17)%55}%"><span>${esc(p.district)} · ${money(p.price)}</span></div>`).join('')}</div></div></div>`; }
function analytics() { const rev = db.properties.reduce((a,x)=>a+Number(x.price||0),0); return `<div class="grid">${metric('Доход / потенциал', money(rev), 'по объектам')}${metric('Агенты', db.agents.length, 'команда')}${metric('Собственники', db.owners.length, 'база')}${metric('Клиенты', db.clients.length, 'заявки')}<div class="card span12"><h2>Следующий этап аналитики</h2><p class="muted">Добавим графики: показы → сделки, источники клиентов, рейтинг агентов, комиссия 50/70/90.</p></div></div>`; }
function settings() { return `<div class="grid"><div class="card span6"><h2>Данные</h2><p class="muted">Данные сохраняются в браузере. Для настоящей работы потом подключим Supabase.</p><div class="hero-actions"><button class="secondary" onclick="exportData()">Экспорт JSON</button><label class="secondary">Импорт JSON<input type="file" accept="application/json" onchange="importData(event)" hidden></label><button class="secondary danger" onclick="resetData()">Сброс</button></div></div><div class="card span6"><h2>Статус</h2><p>Версия: plain JS / без Node</p><p>Дизайн: Airbnb minimal + цвет #1d3560</p><p>Язык: русский</p></div></div>`; }
function render() { const views = { dashboard, properties, owners, clients, reports, contracts, agents, map: mapView, analytics, settings }; $('#view').innerHTML = views[page](); }

const formConfig = {
  property: ['properties', 'Объект', [['address','Адрес'],['district','Район'],['type','Тип'],['price','Цена'],['status','Статус','select','Свободно|В работе|Сдано'],['agent','Агент'],['owner','Собственник'],['phone','Телефон'],['notes','Заметки','textarea']]],
  owner: ['owners', 'Собственник', [['name','Имя'],['phone','Телефон'],['object','Объект'],['status','Статус','select','Эксклюзив|В работе'],['last','Последний контакт','textarea']]],
  client: ['clients', 'Клиент', [['name','Имя'],['phone','Телефон'],['request','Запрос','textarea'],['budget','Бюджет'],['status','Статус','select','Новый|Горячий|Показ|Потерян'],['agent','Агент']]],
  report: ['reports', 'Отчет', [['type','Тип'],['agent','Агент'],['target','Что сделано','textarea'],['date','Дата','date'],['status','Статус','select','Запланировано|В работе|Готово']]],
  agent: ['agents', 'Агент', [['name','Имя'],['role','Роль'],['deals','Сделки'],['objects','Объекты'],['level','Уровень','select','50%|70%|90%']]],
  task: ['tasks', 'Задача', [['time','Время'],['title','Задача'],['status','Статус','select','Запланировано|В работе|Горячий|Готово'],['agent','Ответственный']]]
};
function openCreate() { openForm(page === 'owners' ? 'owner' : page === 'clients' ? 'client' : page === 'reports' ? 'report' : page === 'agents' ? 'agent' : 'property'); }
function openForm(type, id) {
  const [coll, title, fields] = formConfig[type]; const item = id ? find(coll, id) : {};
  $('#drawer').innerHTML = `<div class="drawer-head"><div><h2>${id?'Изменить':'Добавить'} ${title.toLowerCase()}</h2><p class="muted">Все сохраняется в браузере</p></div><button class="x" onclick="closeDrawer()">×</button></div><form class="form two" onsubmit="submitForm(event,'${type}','${id||''}')">${fields.map(f => field(f, item[f[0]])).join('')}<button class="primary" type="submit">Сохранить</button><button class="secondary" type="button" onclick="closeDrawer()">Отмена</button></form>`;
  $('#drawer').classList.add('open'); $('#shade').classList.add('open');
}
function field(f, val='') { const [name,label,kind,opts] = f; const full = kind === 'textarea' ? 'style="grid-column:1/-1"' : ''; if (kind === 'textarea') return `<label ${full}>${label}<textarea name="${name}" rows="4">${esc(val)}</textarea></label>`; if (kind === 'select') return `<label>${label}<select name="${name}">${opts.split('|').map(o=>`<option ${o===val?'selected':''}>${o}</option>`).join('')}</select></label>`; return `<label>${label}<input name="${name}" type="${kind || 'text'}" value="${esc(val)}"></label>`; }
function submitForm(e, type, id) { e.preventDefault(); const [coll] = formConfig[type]; const data = Object.fromEntries(new FormData(e.target).entries()); ['price','budget','deals','objects'].forEach(k => { if (k in data) data[k] = Number(data[k] || 0); }); if ('date' in data && !data.date) data.date = todayISO(); if (id) Object.assign(find(coll, id), data); else db[coll].unshift({ id: uid(), ...data }); save(); closeDrawer(); render(); toast('Сохранено'); }
function closeDrawer() { $('#drawer').classList.remove('open'); $('#shade').classList.remove('open'); }
function removeItem(coll,id) { if (!confirm('Удалить запись?')) return; db[coll] = db[coll].filter(x => x.id !== id); save(); render(); toast('Удалено'); }
function done(coll,id) { const x = find(coll,id); if (x) x.status = 'Готово'; save(); render(); toast('Готово'); }
function exportData() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(db,null,2)], {type:'application/json'})); a.download = 'rent-in-tbilisi-crm-data.json'; a.click(); URL.revokeObjectURL(a.href); }
function importData(e) { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = () => { try { db = JSON.parse(r.result); save(); render(); toast('Импортировано'); } catch { toast('Ошибка JSON'); } }; r.readAsText(file); }
function resetData() { if (confirm('Сбросить данные?')) { db = structuredClone(seed); save(); render(); toast('Сброшено'); } }
function toggleMenu() { $('#side').classList.toggle('open'); }
function toggleTheme() { document.body.classList.toggle('dark'); }
$('#search').addEventListener('input', e => { query = e.target.value; render(); });
renderNav(); render();
