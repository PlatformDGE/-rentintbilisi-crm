const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random());
const today = () => new Date().toISOString().slice(0,10);

const seed = {
  properties:[
    {id:uid(),address:'ул. Атонели, Старый Тбилиси',district:'Центр',type:'1 спальня',price:850,status:'Свободно',agent:'Irakli',owner:'Демо собственник',phone:'995XXXXXXXXX',notes:'Итальянский двор, рядом рынок Орбелиани, резиденция президента, Дом юстиции, проспект Руставели.'},
    {id:uid(),address:'Кипшидзе 6, Ваке',district:'Ваке',type:'Коммерция 175 м²',price:3675,status:'В работе',agent:'Dima',owner:'Демо собственник',phone:'995XXXXXXXXX',notes:'Фасад 17 м, $21/м², рядом Nikora / GPS / PSP / универсам / зоомагазин, Vake Residence 100 м.'},
    {id:uid(),address:'ул. Аракишвили, Ваке',district:'Ваке',type:'2 спальни',price:1100,status:'Свободно',agent:'Misha',owner:'Демо собственник',phone:'995XXXXXXXXX',notes:'Арка со шлагбаумом, 2-й подъезд, 3-й этаж, коричневая дверь.'},
    {id:uid(),address:'Outlook Ваке / The Max',district:'Ваке',type:'2 спальни, премиум',price:1400,status:'Свободно',agent:'David',owner:'Демо собственник',phone:'995XXXXXXXXX',notes:'Престижный дом рядом с McDonald’s, кафе и торговым центром.'},
    {id:uid(),address:'ул. Асатиани',district:'Сололаки',type:'1 спальня',price:780,status:'Сдано',agent:'Sergi',owner:'Демо собственник',phone:'995XXXXXXXXX',notes:'Внутренний двор, 2-й этаж.'}
  ],
  owners:[
    {id:uid(),name:'Демо собственник — Атонели',phone:'995XXXXXXXXX',object:'ул. Атонели',status:'Эксклюзив',last:'Перед публикацией обязателен Owner Information.'},
    {id:uid(),name:'Демо собственник — Кипшидзе 6',phone:'995XXXXXXXXX',object:'Кипшидзе 6',status:'В работе',last:'Подтвердить реестр, фасад и финальную цену.'}
  ],
  clients:[
    {id:uid(),name:'Запрос дипломатов',phone:'—',request:'Сабуртало / Лиси, 2 спальни до 1500€, 3 спальни или дом до 2000€, 2 санузла, терраса/двор, 6–8 недель',budget:2000,status:'Горячий',agent:'Irakli'},
    {id:uid(),name:'Коммерческий клиент',phone:'—',request:'Коммерческое помещение: Freedom Square / Ваке',budget:4000,status:'Новый',agent:'Dima'}
  ],
  reports:[
    {id:uid(),type:'Общий отчет',agent:'Dima',target:'Фото / Показ / Стикеры / Звонки / Сделка',status:'Готово',date:today()},
    {id:uid(),type:'Ежедневный отчет',agent:'Mari',target:'Контроль оператора',status:'Запланировано',date:today()}
  ],
  agents:[
    {id:uid(),name:'Irakli',role:'Владелец / менеджер',deals:92,objects:184,level:'90%'},
    {id:uid(),name:'David Tibelashvili',role:'CEO',deals:120,objects:210,level:'90%'},
    {id:uid(),name:'Mari',role:'Оператор',deals:0,objects:0,level:'50%'},
    {id:uid(),name:'Zurab',role:'Оператор',deals:0,objects:0,level:'50%'},
    {id:uid(),name:'Nastya',role:'Админ Airbnb / Booking',deals:0,objects:0,level:'50%'},
    {id:uid(),name:'Dima',role:'Агент',deals:44,objects:62,level:'70%'},
    {id:uid(),name:'Misha',role:'Агент',deals:12,objects:38,level:'70%'}
  ],
  tasks:[
    {id:uid(),time:'12:00',title:'Еженедельная встреча в Stamba',status:'Запланировано',agent:'Команда'},
    {id:uid(),time:'13:30',title:'Проверка Owner Information перед публикацией',status:'Горячий',agent:'Оператор'},
    {id:uid(),time:'15:00',title:'Публикация: 9 фото + 1 видео + геолинк',status:'В работе',agent:'Агент'}
  ]
};

const storeKey='rit_crm_plain_v1';
let db=JSON.parse(localStorage.getItem(storeKey)||'null')||seed;
let page='dashboard';
let query='';
let filter='all';
const $=s=>document.querySelector(s);
const nav=[['dashboard','🏠','Главная'],['properties','🏢','Объекты'],['owners','👑','Собственники'],['clients','🧑‍💼','Клиенты'],['reports','📋','Отчеты'],['contracts','📄','Договоры'],['agents','👥','Агенты'],['map','🗺️','Карта'],['analytics','📈','Аналитика'],['settings','⚙️','Настройки']];
const subs={dashboard:'Главный экран компании',properties:'Объекты, статусы, цены и агенты',owners:'База собственников и история общения',clients:'Заявки, клиенты и показы',reports:'Контроль работы команды',contracts:'Предпросмотр договора',agents:'Уровни, комиссии, рекруты',map:'Визуальная карта объектов',analytics:'KPI и статистика',settings:'Экспорт, импорт и настройки'};

function save(){localStorage.setItem(storeKey,JSON.stringify(db));refreshNav();}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function money(v){return '$'+Number(v||0).toLocaleString('en-US');}
function chip(v){const s=String(v||'');let c=/Свободно|Эксклюзив|Горячий|Готово|90/.test(s)?'good':/Сдано|Потерян|Проблема/.test(s)?'bad':'warn';return `<span class="chip ${c}">${esc(s)}</span>`;}
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),1600)}
function totalCount(){return db.properties.length+db.owners.length+db.clients.length+db.reports.length+db.agents.length+db.tasks.length}
function countFor(p){const m={properties:'properties',owners:'owners',clients:'clients',reports:'reports',agents:'agents'};return m[p]?db[m[p]].length:''}
function refreshNav(){ $('#nav').innerHTML=nav.map(n=>`<button class="nav ${page===n[0]?'active':''}" onclick="go('${n[0]}')"><span>${n[1]}</span><span>${n[2]}</span>${countFor(n[0])!==''?`<small>${countFor(n[0])}</small>`:''}</button>`).join(''); $('#sideCount').textContent=totalCount();}
function go(p){page=p;filter='all';query='';$('#search').value='';const n=nav.find(x=>x[0]===p);$('#pageTitle').textContent=n[2];$('#pageSub').textContent=subs[p];$('#sidebar').classList.remove('open');refreshNav();render();}
function match(item){return !query || JSON.stringify(item).toLowerCase().includes(query.toLowerCase())}
function metric(label,value,sub){return `<div class="card metric span3"><small>${label}</small><b>${value}</b><span class="chip good">${sub}</span></div>`}
function table(head,rows){return `<div class="table-wrap"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td class="empty" colspan="${head.length}">Нет данных</td></tr>`}</tbody></table></div>`}
function tabs(items){return `<div class="tabs">${items.map(x=>`<button class="tab ${filter===x?'active':''}" onclick="filter='${x}';render()">${x==='all'?'Все':x}</button>`).join('')}</div>`}

function dashboard(){const free=db.properties.filter(x=>x.status==='Свободно').length;const rev=db.properties.reduce((a,x)=>a+Number(x.price||0),0);return `<div class="grid"><div class="card hero span12"><h2>Rent in Tbilisi CRM</h2><p>Чистая быстрая версия без Node: русский интерфейс, минимализм Airbnb, фирменный цвет #1d3560, рабочие формы и сохранение в браузере.</p><div class="actions"><button class="secondary" onclick="openForm('property')">+ Объект</button><button class="secondary" onclick="openForm('client')">+ Клиент</button><button class="secondary" onclick="openForm('report')">+ Отчет</button><button class="secondary" onclick="exportData()">Экспорт JSON</button></div></div>${metric('Объекты',db.properties.length,'демо')}${metric('Свободно',free,'активно')}${metric('Команда',db.agents.length,'пользователи')}${metric('Потенциал',money(rev),'цены')}<div class="card span7"><div class="section"><h2>План на сегодня</h2><button class="secondary" onclick="openForm('task')">+ Задача</button></div>${table(['Время','Действие','Статус','Ответственный',''],db.tasks.map(t=>`<tr><td>${esc(t.time)}</td><td class="row-title">${esc(t.title)}</td><td>${chip(t.status)}</td><td>${esc(t.agent)}</td><td class="table-actions"><button onclick="openForm('task','${t.id}')">Изменить</button><button onclick="done('tasks','${t.id}')">Готово</button><button onclick="removeItem('tasks','${t.id}')">Удалить</button></td></tr>`))}</div><div class="card span5"><div class="section"><h2>Модули</h2></div><div class="cards">${nav.slice(1,9).map(n=>`<button class="module" onclick="go('${n[0]}')"><div class="ico">${n[1]}</div><h3>${n[2]}</h3><p class="muted">${subs[n[0]]}</p></button>`).join('')}</div></div></div>`}
function properties(){let arr=db.properties.filter(match).filter(x=>filter==='all'||x.status===filter);return `<div class="grid"><div class="card span12"><div class="section"><h2>Объекты</h2><div class="actions"><button class="primary" onclick="openForm('property')">+ Добавить</button></div></div>${tabs(['all','Свободно','В работе','Сдано'])}${table(['Адрес','Район','Тип','Цена','Статус','Агент',''],arr.map(x=>`<tr><td class="row-title">${esc(x.address)}</td><td>${esc(x.district)}</td><td>${esc(x.type)}</td><td>${money(x.price)}</td><td>${chip(x.status)}</td><td>${esc(x.agent)}</td><td class="table-actions"><button onclick="openForm('property','${x.id}')">Изменить</button><button onclick="duplicateProperty('${x.id}')">Копия</button><button onclick="removeItem('properties','${x.id}')">Удалить</button></td></tr>`))}</div></div>`}
function owners(){let arr=db.owners.filter(match).filter(x=>filter==='all'||x.status===filter);return `<div class="grid"><div class="card span12"><div class="section"><h2>Собственники</h2><button class="primary" onclick="openForm('owner')">+ Добавить</button></div>${tabs(['all','Эксклюзив','В работе'])}${table(['Имя','Телефон','Объект','Статус','Последний контакт',''],arr.map(x=>`<tr><td class="row-title">${esc(x.name)}</td><td>${esc(x.phone)}</td><td>${esc(x.object)}</td><td>${chip(x.status)}</td><td>${esc(x.last)}</td><td class="table-actions"><button onclick="openForm('owner','${x.id}')">Изменить</button><button onclick="removeItem('owners','${x.id}')">Удалить</button></td></tr>`))}</div></div>`}
function clients(){let arr=db.clients.filter(match).filter(x=>filter==='all'||x.status===filter);return `<div class="grid"><div class="card span12"><div class="section"><h2>Клиенты</h2><button class="primary" onclick="openForm('client')">+ Добавить</button></div>${tabs(['all','Новый','Горячий','Показ','Потерян'])}${table(['Клиент','Телефон','Запрос','Бюджет','Статус','Агент',''],arr.map(x=>`<tr><td class="row-title">${esc(x.name)}</td><td>${esc(x.phone)}</td><td>${esc(x.request)}</td><td>${money(x.budget)}</td><td>${chip(x.status)}</td><td>${esc(x.agent)}</td><td class="table-actions"><button onclick="openForm('client','${x.id}')">Изменить</button><button onclick="removeItem('clients','${x.id}')">Удалить</button></td></tr>`))}</div></div>`}
function reports(){let arr=db.reports.filter(match);return `<div class="grid"><div class="card span12"><div class="section"><h2>Отчеты</h2><button class="primary" onclick="openForm('report')">+ Отчет</button></div>${table(['Дата','Тип','Агент','Цель','Статус',''],arr.map(x=>`<tr><td>${esc(x.date)}</td><td class="row-title">${esc(x.type)}</td><td>${esc(x.agent)}</td><td>${esc(x.target)}</td><td>${chip(x.status)}</td><td class="table-actions"><button onclick="openForm('report','${x.id}')">Изменить</button><button onclick="removeItem('reports','${x.id}')">Удалить</button></td></tr>`))}</div></div>`}
function contracts(){const p=db.properties[0]||{};return `<div class="grid"><div class="card span5"><h2>Договор</h2><p class="muted">Пока это предпросмотр. Следующий этап — генерация PDF/DOC.</p><div class="form"><label>Язык<select id="contractLang"><option>RU</option><option>GE</option><option>EN</option></select></label><label>Кадастровый код<input id="cad" placeholder="01.xx.xx.xx"></label><label>Собственник<input id="own" value="${esc(p.owner||'')}"></label><label>Клиент<input id="tenant" placeholder="ФИО клиента"></label><label>Цена USD<input id="price" value="${esc(p.price||'')}"></label><button class="primary" onclick="toast('Предпросмотр обновлен')">Обновить</button><button class="secondary" onclick="window.print()">Печать</button></div></div><div class="card span7"><div class="contract"><h3>ДОГОВОР АРЕНДЫ</h3><p>Собственник передает клиенту квартиру во временное пользование. Цена аренды: <b>${money(p.price||0)}</b>. Депозит равен одному месяцу аренды, если не указано другое.</p><p>Объект: <b>${esc(p.address||'')}</b></p><p>Возврат депозита происходит после возврата квартиры и подтверждения отсутствия повреждений сверх нормального износа.</p></div></div></div>`}
function agents(){return `<div class="grid"><div class="card span12"><div class="section"><h2>Агенты и уровни</h2><button class="primary" onclick="openForm('agent')">+ Агент</button></div>${table(['Имя','Роль','Сделки','Объекты','Уровень',''],db.agents.filter(match).map(x=>`<tr><td class="row-title">${esc(x.name)}</td><td>${esc(x.role)}</td><td>${x.deals}</td><td>${x.objects}</td><td>${chip(x.level)}</td><td class="table-actions"><button onclick="openForm('agent','${x.id}')">Изменить</button><button onclick="removeItem('agents','${x.id}')">Удалить</button></td></tr>`))}</div><div class="card span12"><h2>Правила комиссии</h2><p>0–10 сделок — 50%. 11–100 сделок — 70%. Больше 100 сделок — 90% постоянно. Commercial — 100% месячной комиссии. Sale — 3%.</p></div></div>`}
function mapPage(){return `<div class="grid"><div class="card span12"><div class="section"><h2>Карта объектов</h2><button class="secondary" onclick="go('properties')">Открыть список</button></div><div class="map"><div class="road"></div>${db.properties.map((p,i)=>`<button class="pin" onclick="openForm('property','${p.id}')" style="left:${12+(i*17)%76}%;top:${18+(i*23)%62}%"><span>${esc(p.address)}</span></button>`).join('')}</div></div></div>`}
function analytics(){const free=db.properties.filter(x=>x.status==='Свободно').length;const avg=Math.round(db.properties.reduce((a,x)=>a+Number(x.price||0),0)/(db.properties.length||1));return `<div class="grid">${metric('Всего объектов',db.properties.length,'база')}${metric('Свободно',free,'можно сдавать')}${metric('Средняя цена',money(avg),'по базе')}${metric('Отчеты',db.reports.length,'контроль')}<div class="card span12"><h2>Следующие метрики</h2><p class="muted">Конверсия: показы → сделки, доход компании, рейтинг агентов, активность операторов, источники клиентов.</p></div></div>`}
function settings(){return `<div class="grid"><div class="card span6"><h2>Данные</h2><p class="muted">Сейчас данные сохраняются только в браузере. Для настоящей базы подключим Supabase.</p><div class="actions"><button class="primary" onclick="exportData()">Экспорт JSON</button><label class="secondary" style="cursor:pointer">Импорт JSON<input type="file" accept="application/json" hidden onchange="importData(event)"></label><button class="secondary danger" onclick="resetData()">Сбросить демо</button></div></div><div class="card span6"><h2>Следующий этап</h2><p>1) Разделить файлы по модулям. 2) Подключить Supabase. 3) Добавить авторизацию. 4) Загрузить реальные объекты и собственников.</p></div></div>`}

function render(){const pages={dashboard,properties,owners,clients,reports,contracts,agents,map:mapPage,analytics,settings};$('#content').innerHTML=(pages[page]||dashboard)();refreshNav();}
function find(coll,id){return db[coll].find(x=>x.id===id)||{};}
function openDrawer(title,html){$('#drawer').innerHTML=`<div class="drawer-head"><div><h2>${title}</h2><p class="muted">Изменения сохраняются в браузере</p></div><button class="x" onclick="closeDrawer()">×</button></div>${html}`;$('#overlay').classList.add('open');$('#drawer').classList.add('open');}
function closeDrawer(){$('#overlay').classList.remove('open');$('#drawer').classList.remove('open');}
function field(label,name,value='',type='text',opts=''){return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${opts}></label>`}
function selectField(label,name,value,options){return `<label>${label}<select name="${name}">${options.map(o=>`<option ${o===value?'selected':''}>${o}</option>`).join('')}</select></label>`}
function openForm(kind,id){const config={property:['properties','Объект'],owner:['owners','Собственник'],client:['clients','Клиент'],report:['reports','Отчет'],agent:['agents','Агент'],task:['tasks','Задача']};const [coll,title]=config[kind];const x=id?find(coll,id):{};let inner='';
 if(kind==='property') inner=`${field('Адрес','address',x.address)}${field('Район','district',x.district)}${field('Тип','type',x.type)}${field('Цена','price',x.price,'number')}${selectField('Статус','status',x.status||'Свободно',['Свободно','В работе','Сдано'])}${field('Агент','agent',x.agent)}${field('Собственник','owner',x.owner)}${field('Телефон','phone',x.phone)}<label>Заметки<textarea name="notes">${esc(x.notes)}</textarea></label>`;
 if(kind==='owner') inner=`${field('Имя','name',x.name)}${field('Телефон','phone',x.phone)}${field('Объект','object',x.object)}${selectField('Статус','status',x.status||'В работе',['В работе','Эксклюзив','Не эксклюзив'])}<label>История<textarea name="last">${esc(x.last)}</textarea></label>`;
 if(kind==='client') inner=`${field('Имя','name',x.name)}${field('Телефон','phone',x.phone)}<label>Запрос<textarea name="request">${esc(x.request)}</textarea></label>${field('Бюджет','budget',x.budget,'number')}${selectField('Статус','status',x.status||'Новый',['Новый','Горячий','Показ','Потерян'])}${field('Агент','agent',x.agent)}`;
 if(kind==='report') inner=`${field('Дата','date',x.date||today(),'date')}${selectField('Тип','type',x.type||'Общий отчет',['Общий отчет','Ежедневный отчет','Фото с платформы','Проверка объекта','Показ','Звонки','Сделка'])}${field('Агент','agent',x.agent)}<label>Цель<textarea name="target">${esc(x.target)}</textarea></label>${selectField('Статус','status',x.status||'Запланировано',['Запланировано','В работе','Готово'])}`;
 if(kind==='agent') inner=`${field('Имя','name',x.name)}${field('Роль','role',x.role)}${field('Сделки','deals',x.deals||0,'number')}${field('Объекты','objects',x.objects||0,'number')}${selectField('Уровень','level',x.level||'50%',['50%','70%','90%'])}`;
 if(kind==='task') inner=`${field('Время','time',x.time||'12:00','time')}${field('Действие','title',x.title)}${selectField('Статус','status',x.status||'Запланировано',['Запланировано','В работе','Горячий','Готово'])}${field('Ответственный','agent',x.agent)}`;
 openDrawer(id?`Изменить: ${title}`:`Добавить: ${title}`,`<form class="form" onsubmit="submitForm(event,'${coll}','${id||''}')">${inner}<button class="primary" type="submit">Сохранить</button></form>`);
}
function submitForm(e,coll,id){e.preventDefault();const data=Object.fromEntries(new FormData(e.target).entries());['price','budget','deals','objects'].forEach(k=>{if(k in data)data[k]=Number(data[k]||0)});if(id){Object.assign(find(coll,id),data)}else{db[coll].unshift({id:uid(),...data})}save();closeDrawer();render();toast('Сохранено')}
function removeItem(coll,id){if(!confirm('Удалить запись?'))return;db[coll]=db[coll].filter(x=>x.id!==id);save();render();toast('Удалено')}
function done(coll,id){find(coll,id).status='Готово';save();render();toast('Готово')}
function duplicateProperty(id){const x=find('properties',id);db.properties.unshift({...x,id:uid(),address:x.address+' — копия'});save();render();toast('Скопировано')}
function exportData(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}));a.download='rent-in-tbilisi-crm-data.json';a.click();URL.revokeObjectURL(a.href)}
function importData(e){const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{db=JSON.parse(r.result);save();render();toast('Импортировано')}catch{toast('Ошибка JSON')}};r.readAsText(file)}
function resetData(){if(confirm('Сбросить все данные к демо?')){db=structuredClone(seed);save();render();toast('Сброшено')}}

$('#search').addEventListener('input',e=>{query=e.target.value;render()});
$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');
$('#overlay').onclick=closeDrawer;
$('#themeBtn').onclick=()=>document.body.classList.toggle('dark');
document.addEventListener('click',e=>{const a=e.target.closest('[data-action]');if(a?.dataset.action==='new-property')openForm('property')});
refreshNav();render();
