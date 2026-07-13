const CACHE='rit-crm-v2';
const files=['./','index.html','styles.css','dashboard.css','app.js','telegram-top10.js','manifest.json','logo.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(files))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
