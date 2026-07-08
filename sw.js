const CACHE='rit-crm-v1';
const files=['./','index.html','styles.css','dashboard.css','app.js','manifest.json','logo.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(files))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
