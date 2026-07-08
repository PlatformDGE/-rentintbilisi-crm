const seed = {
  properties: [
    {id:crypto.randomUUID(),address:'ул. Атонели, Старый Тбилиси',type:'1 спальня / посуточно и долгосрочно',district:'Центр',price:850,status:'Свободно',agent:'Irakli',owner:'База собственников',phone:'995XXXXXXXXX',notes:'Итальянский двор, рядом рынок Орбелиани, резиденция президента, Дом юстиции, проспект Руставели.'},
    {id:crypto.randomUUID(),address:'Кипшидзе 6, Ваке',type:'Коммерция 175 м²',district:'Ваке',price:3675,status:'В работе',agent:'Dima',owner:'База собственников',phone:'995XXXXXXXXX',notes:'Фасад 17 м, $21/м², рядом Nikora / GPS / PSP / универсам / зоомагазин, Vake Residence 100 м.'},
    {id:crypto.randomUUID(),address:'ул. Аракишвили, Ваке',type:'2 спальни',district:'Ваке',price:1100,status:'Свободно',agent:'Misha',owner:'База собственников',phone:'995XXXXXXXXX',notes:'Арка со шлагбаумом, 2-й подъезд, 3-й этаж, коричневая дверь. Vake Nest / Falcon Nest.'},
    {id:crypto.randomUUID(),address:'Outlook Ваке / The Max',type:'2 спальни, премиум',district:'Ваке',price:1400,status:'Свободно',agent:'David',owner:'База собственников',phone:'995XXXXXXXXX',notes:'Престижный дом рядом с McDonald’s, кафе и торговым центром.'},
    {id:crypto.randomUUID(),address:'ул. Асатиани',type:'1 спальня',district:'Сололаки',price:780,status:'Сдано',agent:'Sergi',owner:'База собственников',phone:'995XXXXXXXXX',notes:'Внутренний двор, 2-й этаж.'},
    {id:crypto.randomUUID(),address:'Батуми, Legenda',type:'Инвестиция / черный каркас',district:'Батуми',price:14000,status:'В работе',agent:'David',owner:'Застройщик',phone:'995XXXXXXXXX',notes:'20 этажей, 11 построено, вид на море/порт, паркинг $14 000.'}
  ],
  owners: [
    {id:crypto.randomUUID(),name:'Собственник — Атонели',phone:'995XXXXXXXXX',object:'ул. Атонели',status:'Эксклюзив',last:'Перед публикацией обязателен Owner Information. Проверить дубликаты на SS.ge / MyHome.'},
    {id:crypto.randomUUID(),name:'Собственник — Кипшидзе 6',phone:'995XXXXXXXXX',object:'Кипшидзе 6',status:'В работе',last:'Коммерческий объект: подтвердить реестр, фасад и финальную цену.'},
    {id:crypto.randomUUID(),name:'Собственник — Аракишвили',phone:'995XXXXXXXXX',object:'ул. Аракишвили',status:'В работе',last:'Нужны реестр, кадастровый код и проверка порядка фото.'},
    {id:crypto.randomUUID(),name:'Собственник — Outlook Ваке',phone:'995XXXXXXXXX',object:'Outlook Ваке',status:'Эксклюзив',last:'Премиум-объект. Использовать качественные фото и короткие рекламные тексты.'}
  ],
  clients: [
    {id:crypto.randomUUID(),name:'Запрос дипломатов',phone:'—',request:'Сабуртало / Лиси, 2 спальни до 1500€, 3 спальни или дом до 2000€, 2 санузла, терраса/двор, 6–8 недель',budget:2000,status:'Горячий',agent:'Irakli'},
    {id:crypto.randomUUID(),name:'Коммерческий клиент',phone:'—',request:'Коммерческое помещение: Freedom Square / Ваке',budget:4000,status:'Новый',agent:'Dima'},
    {id:crypto.randomUUID(),name:'Гость посуточной аренды',phone:'—',request:'Контроль заселения, локера, оплаты, Wi‑Fi и расходников',budget:900,status:'Показ',agent:'Nastya'}
  ],
  reports: [
    {id:crypto.randomUUID(),type:'Общий отчет',agent:'Dima',target:'Фото / Показ / Стикеры / Звонки / Сделка',status:'Готово',date:new Date().toISOString().slice(0,10)},
    {id:crypto.randomUUID(),type:'Ежедневный отчет',agent:'Mari',target:'Ежедневный контроль оператора',status:'Запланировано',date:new Date().toISOString().slice(0,10)},
    {id:crypto.randomUUID(),type:'Фото с платформы',agent:'Sergi',target:'Уведомить топик + добавить адрес в базу собственников',status:'В работе',date:new Date().toISOString().slice(0,10)},
    {id:crypto.randomUUID(),type:'Проверка объекта',agent:'Zurab',target:'Поиск собственника по телефону/адресу',status:'Запланировано',date:new Date().toISOString().slice(0,10)}
  ],
  agents: [
    {id:crypto.randomUUID(),name:'Irakli',role:'Владелец / менеджер',deals:92,объекты:184,level:'90%'},
    {id:crypto.randomUUID(),name:'David Tibelashvili',role:'CEO',deals:120,объекты:210,level:'90%'},
    {id:crypto.randomUUID(),name:'Mari',role:'Оператор',deals:0,объекты:0,level:'50%'},
    {id:crypto.randomUUID(),name:'Zurab',role:'Оператор',deals:0,объекты:0,level:'50%'},
    {id:crypto.randomUUID(),name:'Nastya',role:'Админ Airbnb / Booking',deals:0,объекты:0,level:'50%'},
    {id:crypto.randomUUID(),name:'Dima',role:'Агент',deals:44,объекты:62,level:'70%'},
    {id:crypto.randomUUID(),name:'Misha',role:'Агент',deals:12,объекты:38,level:'70%'},
    {id:crypto.randomUUID(),name:'Sergi',role:'Агент',deals:8,объекты:24,level:'50%'},
    {id:crypto.randomUUID(),name:'Рекрут',role:'Рекрут',deals:0,объекты:3,level:'50%'}
  ],
  tasks: [
    {id:crypto.randomUUID(),time:'12:00',title:'Еженедельная встреча в Stamba',status:'Запланировано',agent:'Команда'},
    {id:crypto.randomUUID(),time:'13:30',title:'Проверка Owner Information перед публикацией',status:'Горячий',agent:'Оператор'},
    {id:crypto.randomUUID(),time:'15:00',title:'Порядок публикации: 9 фото + 1 видео + геолинк',status:'В работе',agent:'Агент'},
    {id:crypto.randomUUID(),time:'17:00',title:'Предпросмотр договора: RU / GE / EN',status:'Запланировано',agent:'Irakli'}
  ]
};

const navItems = [
  ['dashboard','🏠','Главная'],['properties','🏢','Объекты'],['owners','👑','Собственники'],['clients','🧑‍💼','Клиенты'],['reports','📋','Отчеты'],['contracts','📄','Договоры'],['agents','👥','Агенты'],['map','🗺️','Карта'],['analytics','📈','Аналитика'],['settings','⚙️','Настройки']
];
const storeKey = 'rit_crm_airbnb_ru_v5';
let db = JSON.parse(localStorage.getItem(storeKey) || 'null') || structuredClone(seed);
let page = 'dashboard';
let filter = 'all';
let mapFilter = 'all';
let activeSearch = '';
const $ = s => document.querySelector(s);
const escapeHtml = v => String(v ?? '').replace(/[&<>\"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));

function save(){ localStorage.setItem(storeKey, JSON.stringify(db)); updateSideStats(); buildNav(); }
function money(n){ return '$' + Number(n || 0).toLocaleString('en-US'); }
function chip(v){
  let s=String(v||'');
  let cls=/Свободно|Эксклюзив|Горячий|Готово|90/.test(s)?'good':/Сдано|Не эксклюзив|Потерян|Проблема|Bad/.test(s)?'bad':'warn';
  return `<span class="chip ${cls}">${escapeHtml(s)}</span>`;
}
function toast(t){ $('#toast').textContent=t; $('#toast').classList.add('show'); setTimeout(()=>$('#toast').classList.remove('show'),1700); }
function updateSideStats(){ $('#todayStats').textContent = `${db.tasks.length} задач`; }
function count(p){ let k={properties:'properties',owners:'owners',clients:'clients',reports:'reports',agents:'agents'}[p]; return k?`<b>${db[k].length}</b>`:''; }
function buildNav(){ $('#nav').innerHTML = navItems.map(n=>`<button class="nav-item ${page===n[0]?'active':''}" onclick="go('${n[0]}')"><span>${n[1]}</span><span>${n[2]}</span>${count(n[0])}</button>`).join(''); }
function subtitle(p){ return {dashboard:'Главный экран компании',properties:'Объекты, статусы, цены и ответственные агенты',owners:'База собственников и история общения',clients:'Клиенты, заявки, показы',reports:'Отчеты агентов и контроль работы',contracts:'Генерация договора и предпросмотр',agents:'Уровни, комиссии, рекруты',map:'Визуальная карта объектов',analytics:'KPI, конверсия, доходы',settings:'Настройки, экспорт, интеграции'}[p] || ''; }
function go(p){
  page=p;
  filter='all';
  activeSearch='';
  $('#search').value='';
  let n=navItems.find(x=>x[0]===p);
  if(!n){ page='dashboard'; render(); return; }
  $('#title').textContent=n[2];
  $('#subtitle').textContent=subtitle(p);
  $('#side').classList.remove('open');
  buildNav();
  render();
}
function cardMetric(label,value,sub,cls=''){ return `<div class="card metric"><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b><span class="chip ${cls}">${escapeHtml(sub)}</span></div>`; }
function table(headers,rows,empty='Нет данных'){ return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}" class="empty">${escapeHtml(empty)}</td></tr>`}</tbody></table></div>`; }

function dashboard(){
  const available=db.properties.filter(x=>x.status==='Свободно').length;
  const revenue=db.properties.reduce((a,x)=>a+Number(x.price||0),0);
  const hotClients=db.clients.filter(x=>x.status==='Горячий').length;
  const latestReports=db.reports.slice(0,3);
  const latestProperties=db.properties.slice(0,3);
  return `<div class="dashboard-shell">
    <section class="hero-card">
      <div>
        <p class="eyebrow">Рабочая CRM • демо-режим</p>
        <h2>Rent in Tbilisi CRM</h2>
        <p>Минималистичный контроль объектов, клиентов и задач — в одном аккуратном интерфейсе с быстрыми действиями и локальным сохранением.</p>
        <div class="actions-row">
          <button class="btn primary" onclick="openForm('property')">+ Добавить объект</button>
          <button class="btn secondary" onclick="openForm('client')">+ Клиент</button>
          <button class="btn secondary" onclick="openForm('report')">+ Отчет</button>
        </div>
      </div>
      <div class="hero-side">
        <div class="pill">Сейчас в работе</div>
        <div class="hero-stat"><strong>${available}</strong><span>свободных объектов</span></div>
        <div class="hero-stat"><strong>${hotClients}</strong><span>горячих клиентов</span></div>
      </div>
    </section>

    <section class="metric-grid">
      ${cardMetric('Объекты',db.properties.length,'в базе','good')}
      ${cardMetric('Свободно',available,'сейчас доступно','good')}
      ${cardMetric('Команда',db.agents.length,'агенты и операторы','warn')}
      ${cardMetric('Потенциал',money(revenue),'общая стоимость','good')}
    </section>

    <section class="content-grid">
      <div class="panel panel-lg">
        <div class="panel-head">
          <div>
            <p class="eyebrow">План на сегодня</p>
            <h3>Приоритеты команды</h3>
          </div>
          <button class="btn secondary" onclick="openForm('task')">+ Задача</button>
        </div>
        <div class="task-list">
          ${db.tasks.map(task=>`<article class="task-item">
            <div>
              <div class="task-title">${escapeHtml(task.title)}</div>
              <div class="task-meta">${escapeHtml(task.time)} • ${escapeHtml(task.agent)}</div>
            </div>
            <div class="task-actions">
              ${chip(task.status)}
              <button class="mini-btn" onclick="openForm('task','${task.id}')">Изменить</button>
            </div>
          </article>`).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Быстрые действия</p>
            <h3>Модули</h3>
          </div>
        </div>
        <div class="module-grid">
          ${navItems.slice(1,9).map(n=>`<button class="module-card" onclick="go('${n[0]}')"><div class="module-icon">${n[1]}</div><div><strong>${n[2]}</strong><p>${subtitle(n[0])}</p></div></button>`).join('')}
        </div>
      </div>
    </section>

    <section class="content-grid">
      <div class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Последние обновления</p>
            <h3>Недавние отчеты</h3>
          </div>
          <button class="btn secondary" onclick="go('reports')">Открыть</button>
        </div>
        <div class="stack-list">
          ${latestReports.map(item=>`<div class="list-row"><div><strong>${escapeHtml(item.type)}</strong><p>${escapeHtml(item.target)}</p></div><span>${chip(item.status)}</span></div>`).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Актуальные объекты</p>
            <h3>Быстрый просмотр</h3>
          </div>
          <button class="btn secondary" onclick="go('properties')">Все объекты</button>
        </div>
        <div class="stack-list">
          ${latestProperties.map(item=>`<div class="list-row"><div><strong>${escapeHtml(item.address)}</strong><p>${escapeHtml(item.district)} • ${money(item.price)}</p></div><span>${chip(item.status)}</span></div>`).join('')}
        </div>
      </div>
    </section>
  </div>`;
}

function developmentPage(title, description){
  return `<div class="development-card">
    <div class="development-icon">🛠️</div>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(description)}</p>
    <div class="actions-row">
      <button class="btn primary" onclick="go('dashboard')">Вернуться на главную</button>
      <button class="btn secondary" onclick="toast('Раздел будет доработан в следующем шаге')">Напомнить позже</button>
    </div>
  </div>`;
}

function listPage(kind,title,headers,rowFn,formType){
  let items=db[kind];
  let statuses=['all',...new Set(items.map(x=>x.status||x.role||x.level).filter(Boolean))];
  if(filter!=='all') items=items.filter(x=>(x.status||x.role||x.level)===filter);
  return `<div class="page-shell"><div class="panel"><div class="panel-head"><div><p class="eyebrow">${escapeHtml(title)}</p><h3>Управление записями</h3></div><button class="btn primary" onclick="openForm('${formType}')">+ Добавить</button></div><div class="tabs">${statuses.map(s=>`<button class="tab ${filter===s?'active':''}" onclick="setFilter('${escapeHtml(s)}')">${escapeHtml(s)}</button>`).join('')}</div>${table(headers,items.map(rowFn))}</div></div>`;
}
function setFilter(v){ filter=v; render(); }
function properties(){ return listPage('properties','Объекты',['Адрес','Тип','Район','Цена','Статус','Агент',''],p=>`<tr><td class="row-title">${escapeHtml(p.address)}<br><small class="muted">${escapeHtml(p.notes||'')}</small></td><td>${escapeHtml(p.type)}</td><td>${escapeHtml(p.district)}</td><td>${money(p.price)}</td><td>${chip(p.status)}</td><td>${escapeHtml(p.agent)}</td><td class="table-actions"><button onclick="viewItem('properties','${p.id}')">Открыть</button><button onclick="openForm('property','${p.id}')">Редактировать</button><button onclick="duplicateItem('properties','${p.id}')">Копировать</button><button onclick="removeItem('properties','${p.id}')">Удалить</button></td></tr>`,'property'); }
function owners(){ return listPage('owners','База собственников',['Собственник','Телефон','Объект','Статус','Последнее действие',''],o=>`<tr><td class="row-title">${escapeHtml(o.name)}</td><td>${escapeHtml(o.phone)}</td><td>${escapeHtml(o.object)}</td><td>${chip(o.status)}</td><td>${escapeHtml(o.last)}</td><td class="table-actions"><button onclick="viewItem('owners','${o.id}')">Открыть</button><button onclick="openForm('owner','${o.id}')">Редактировать</button><button onclick="createReportFrom('Звонок собственнику','${escapeHtml(o.name)}')">Отчет</button><button onclick="removeItem('owners','${o.id}')">Удалить</button></td></tr>`,'owner'); }
function clients(){ return listPage('clients','Клиенты',['Клиент','Телефон','Запрос','Бюджет','Статус','Агент',''],c=>`<tr><td class="row-title">${escapeHtml(c.name)}</td><td>${escapeHtml(c.phone)}</td><td>${escapeHtml(c.request)}</td><td>${money(c.budget)}</td><td>${chip(c.status)}</td><td>${escapeHtml(c.agent)}</td><td class="table-actions"><button onclick="viewItem('clients','${c.id}')">Открыть</button><button onclick="openForm('client','${c.id}')">Редактировать</button><button onclick="createReportFrom('Показ','${escapeHtml(c.name)}')">Показ</button><button onclick="removeItem('clients','${c.id}')">Удалить</button></td></tr>`,'client'); }
function reports(){
  const types=['Общий отчет','Ежедневный отчет','Фото','Показ','Звонки','Сделка','Фото с платформы','Проверка объекта'];
  return `<div class="page-shell"><div class="content-grid"><div class="panel"><div class="panel-head"><div><p class="eyebrow">Новый отчет</p><h3>Быстрый ввод</h3></div></div><div class="module-grid">${types.map(t=>`<button class="module-card" onclick="openForm('report',null,'${t}')"><div class="module-icon">📋</div><div><strong>${escapeHtml(t)}</strong><p>Открыть форму</p></div></button>`).join('')}</div></div><div class="panel panel-lg"><div class="panel-head"><div><p class="eyebrow">История</p><h3>Отчеты команды</h3></div><button class="btn secondary" onclick="openForm('report')">+ Отчет</button></div>${table(['Дата','Тип','Агент','Цель','Статус',''],db.reports.map(r=>`<tr><td>${escapeHtml(r.date)}</td><td class="row-title">${escapeHtml(r.type)}</td><td>${escapeHtml(r.agent)}</td><td>${escapeHtml(r.target)}</td><td>${chip(r.status)}</td><td class="table-actions"><button onclick="viewItem('reports','${r.id}')">Открыть</button><button onclick="openForm('report','${r.id}')">Редактировать</button><button onclick="markDone('reports','${r.id}')">Готово</button><button onclick="removeItem('reports','${r.id}')">Удалить</button></td></tr>`))}</div></div></div>`;
}
function contracts(){ return developmentPage('Договоры', 'Блок договоров скоро будет переведен в полностью рабочий режим с шаблонами, предпросмотром и сохранением в архив.'); }
function agents(){ return listPage('agents','Агенты и уровни',['Агент','Роль','Сделки','Объекты','Комиссия',''],a=>`<tr><td class="row-title">${escapeHtml(a.name)}</td><td>${escapeHtml(a.role)}</td><td>${escapeHtml(a.deals)}</td><td>${escapeHtml(a.objects)}</td><td>${chip(a.level)}</td><td class="table-actions"><button onclick="viewItem('agents','${a.id}')">Открыть</button><button onclick="openForm('agent','${a.id}')">Редактировать</button><button onclick="addDeal('${a.id}')">+ Сделка</button><button onclick="removeItem('agents','${a.id}')">Удалить</button></td></tr>`,'agent'); }
function map(){ return developmentPage('Карта объектов', 'Карта будет обновлена с удобной географической навигацией и карточками объектов.'); }
function analytics(){ return developmentPage('Аналитика', 'Сводки по сделкам, конверсии и доходам появятся в следующем обновлении интерфейса.'); }
function settings(){ return `<div class="page-shell"><div class="content-grid"><div class="panel"><div class="panel-head"><div><p class="eyebrow">Система</p><h3>Настройки и резерв</h3></div></div><div class="module-grid"><button class="module-card" onclick="toast('Supabase будет следующим этапом')"><div class="module-icon">☁️</div><div><strong>Интеграция</strong><p>Готово к Supabase</p></div></button><button class="module-card" onclick="installHint()"><div class="module-icon">📱</div><div><strong>На телефон</strong><p>Добавить на главный экран</p></div></button><button class="module-card" onclick="copyBackup()"><div class="module-icon">🗂️</div><div><strong>Резерв</strong><p>Скопировать данные</p></div></button></div></div><div class="panel panel-lg"><div class="panel-head"><div><p class="eyebrow">Данные</p><h3>Экспорт и импорт</h3></div></div><div class="actions-row"><button class="btn primary" onclick="exportData()">Экспорт JSON</button><button class="btn secondary" onclick="importClick()">Импорт JSON</button><button class="btn secondary" onclick="resetData()">Сбросить демо</button></div><p class="muted">Все данные сохраняются в локальном хранилище браузера. Это безопасно для демонстрации и быстрого тестирования.</p><input type="file" id="importFile" hidden accept="application/json" onchange="importData(event)"></div></div></div>`; }
function render(){ buildNav(); let views={dashboard,properties,owners,clients,reports,contracts,agents,map,analytics,settings}; $('#content').innerHTML=views[page]?views[page]():developmentPage('Раздел', 'Содержимое временно недоступно'); updateSideStats(); }

const config={
  property:{key:'properties',title:'Объект',fields:[['address','Адрес'],['type','Тип'],['district','Район'],['price','Цена','number'],['status','Статус','select','Свободно,В работе,Сдано'],['agent','Агент'],['owner','Собственник'],['phone','Телефон собственника'],['notes','Заметки','textarea']]},
  owner:{key:'owners',title:'Собственник',fields:[['name','Имя собственника'],['phone','Телефон'],['object','Объект'],['status','Статус','select','Эксклюзив,В работе,Не эксклюзив'],['last','Последнее действие','textarea']]},
  client:{key:'clients',title:'Клиент',fields:[['name','Имя клиента'],['phone','Телефон'],['request','Запрос'],['budget','Бюджет','number'],['status','Статус','select','Новый,Показ,Горячий,Потерян'],['agent','Агент']]},
  report:{key:'reports',title:'Отчет',fields:[['date','Дата','date'],['type','Тип','select','Общий отчет,Ежедневный отчет,Фото,Показ,Звонки,Сделка,Фото с платформы,Проверка объекта,Звонок собственнику'],['agent','Агент'],['target','Цель'],['status','Статус','select','Запланировано,Готово,Проблема']]},
  agent:{key:'agents',title:'Агент',fields:[['name','Имя агента'],['role','Роль','select','Агент,Рекрут,Владелец / менеджер,Оператор'],['deals','Сделки','number'],['objects','Объекты','number'],['level','Комиссия','select','50%,70%,90%']]},
  task:{key:'tasks',title:'Задача',fields:[['time','Время'],['title','Действие'],['status','Статус','select','Запланировано,В работе,Горячий,Готово'],['agent','Агент']]}
};
function fieldHtml(f,v=''){ let [name,label,type,opts]=f; v=escapeHtml(v||''); if(type==='textarea') return `<label>${label}<textarea name="${name}" rows="4">${v}</textarea></label>`; if(type==='select') return `<label>${label}<select name="${name}">${opts.split(',').map(o=>`<option ${o==v?'selected':''}>${o}</option>`).join('')}</select></label>`; return `<label>${label}<input name="${name}" type="${type||'text'}" value="${v}"></label>`; }
function openForm(type,id=null,preset=null){ let c=config[type]; let item=id?db[c.key].find(x=>x.id===id):{}; if(preset&&type==='report') item={type:preset,date:new Date().toISOString().slice(0,10),status:'Запланировано'}; $('#drawer').innerHTML=`<div class="drawer-head"><div><h2>${id?'Редактировать':'Добавить'} ${c.title}</h2><p class="muted">Сохранение работает сразу.</p></div><button class="x" onclick="closeDrawer()">✕</button></div><form class="form two" id="editForm">${c.fields.map(f=>fieldHtml(f,item?.[f[0]])).join('')}<button class="btn primary" style="grid-column:1/-1">Сохранить</button></form>`; $('#overlay').classList.add('open'); $('#drawer').classList.add('open'); $('#editForm').onsubmit=e=>{ e.preventDefault(); let fd=new FormData(e.target); let obj={id:id||crypto.randomUUID()}; c.fields.forEach(f=>obj[f[0]]=fd.get(f[0])); if(id){ let ix=db[c.key].findIndex(x=>x.id===id); db[c.key][ix]=obj; } else db[c.key].unshift(obj); save(); closeDrawer(); render(); toast('Сохранено'); }; }
function closeDrawer(){ $('#drawer').classList.remove('open'); $('#overlay').classList.remove('open'); }
function viewItem(key,id){ let item=db[key].find(x=>x.id===id); if(!item) return toast('Не найдено'); $('#drawer').innerHTML=`<div class="drawer-head"><div><h2>${escapeHtml(item.address||item.name||item.type||'Детали')}</h2><p class="muted">Карточка записи</p></div><button class="x" onclick="closeDrawer()">✕</button></div><div class="card" style="box-shadow:none">${Object.entries(item).filter(([k])=>k!=='id').map(([k,v])=>`<p><b>${escapeHtml(k)}:</b> ${escapeHtml(v)}</p>`).join('')}<div class="actions-row"><button class="btn primary" onclick="openForm('${typeByKey(key)}','${id}')">Редактировать</button><button class="btn secondary" onclick="copyText('${escapeHtml(Object.values(item).join(' | '))}')">Копировать</button><button class="btn danger" onclick="removeItem('${key}','${id}')">Удалить</button></div></div>`; $('#overlay').classList.add('open'); $('#drawer').classList.add('open'); }
function typeByKey(k){ return ({properties:'property',owners:'owner',clients:'client',reports:'report',agents:'agent',tasks:'task'})[k]; }
function removeItem(key,id){ if(!confirm('Удалить?')) return; db[key]=db[key].filter(x=>x.id!==id); save(); closeDrawer(); render(); toast('Удалено'); }
function duplicateItem(key,id){ let old=db[key].find(x=>x.id===id); if(!old) return; db[key].unshift({...old,id:crypto.randomUUID(),address:old.address?old.address+' копия':old.address,name:old.name?old.name+' копия':old.name}); save(); render(); toast('Скопировано'); }
function markDone(key,id){ let item=db[key].find(x=>x.id===id); if(item){ item.status='Готово'; save(); render(); toast('Отмечено готовым'); } }
function addDeal(id){ let a=db.agents.find(x=>x.id===id); if(!a) return; a.deals=Number(a.deals||0)+1; if(a.deals>100) a.level='90%'; else if(a.deals>10) a.level='70%'; else a.level='50%'; save(); render(); toast('+1 сделка'); }
function createReportFrom(type,target){ db.reports.unshift({id:crypto.randomUUID(),date:new Date().toISOString().slice(0,10),type,agent:'',target,status:'Запланировано'}); save(); toast('Отчет создан'); go('reports'); }
function copyText(t){ navigator.clipboard?.writeText(t).then(()=>toast('Скопировано')).catch(()=>toast('Копирование недоступно')); }
function exportData(){ let blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}); let a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='rent_in_tbilisi_crm_data.json'; a.click(); toast('Экспорт готов'); }
function importClick(){ let input=$('#importFile'); if(input) input.click(); else toast('Откройте настройки'); }
function importData(e){ let f=e.target.files[0]; if(!f) return; let r=new FileReader(); r.onload=()=>{ try{ let next=JSON.parse(r.result); ['properties','owners','clients','reports','agents','tasks'].forEach(k=>{ if(!Array.isArray(next[k])) next[k]=[]; }); db=next; save(); render(); toast('Импортировано'); } catch { toast('Неверный JSON'); } }; r.readAsText(f); }
function copyBackup(){ navigator.clipboard?.writeText(JSON.stringify(db,null,2)).then(()=>toast('Резервная копия скопирована')).catch(()=>toast('Копирование недоступно')); }
function resetData(){ if(confirm('Вернуть демо-данные?')){ db=structuredClone(seed); save(); render(); toast('Демо-данные восстановлены'); } }
function installHint(){ alert('На телефоне открой сайт в браузере → Поделиться → На экран домой / Add to Home Screen.'); }

$('#menuBtn').onclick=()=>$('#side').classList.toggle('open');
$('#overlay').onclick=closeDrawer;
$('#newObjectBtn').onclick=()=>openForm('property');
$('#themeBtn').onclick=()=>{ document.body.classList.toggle('dark'); localStorage.setItem('rit_theme', document.body.classList.contains('dark')?'dark':'light'); };
if(localStorage.getItem('rit_theme')==='dark') document.body.classList.add('dark');
$('#search').oninput=e=>{ activeSearch=e.target.value.toLowerCase().trim(); if(!activeSearch){ render(); return; } let res=[]; ['properties','owners','clients','agents','reports','tasks'].forEach(k=>db[k].forEach(x=>{ let txt=Object.values(x).join(' ').toLowerCase(); if(txt.includes(activeSearch)) res.push([k,x]); })); $('#content').innerHTML=`<div class="page-shell"><div class="panel"><div class="panel-head"><div><p class="eyebrow">Результаты поиска</p><h3>${res.length} найдено</h3></div></div>${table(['Модуль','Название','Детали','Статус',''],res.map(([k,x])=>`<tr><td>${escapeHtml(k)}</td><td class="row-title">${escapeHtml(x.address||x.name||x.title||x.type)}</td><td>${escapeHtml(x.phone||x.request||x.target||x.agent||'')}</td><td>${chip(x.status||x.level||x.role||'результат')}</td><td class="table-actions"><button onclick="viewItem('${k}','${x.id}')">Открыть</button><button onclick="openForm('${typeByKey(k)}','${x.id}')">Редактировать</button></td></tr>`),'Ничего не найдено')}</div></div>`; };
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
render();
