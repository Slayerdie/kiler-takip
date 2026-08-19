const CACHE='kiler-takip-v1.1.2';
const ASSETS=['./','./index.html','./app.css','./location-builder.css','./db.js','./app.js','./location-builder.js','./ui-fixes.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  if(url.origin!==location.origin) return;

  // Uygulama dosyalarında önce ağ: güncellemeler hemen gelsin.
  if(e.request.mode==='navigate' || /\.(html|js|css|webmanifest)$/.test(url.pathname)){
    e.respondWith(
      fetch(e.request,{cache:'no-store'})
        .then(r=>{
          const copy=r.clone();
          caches.open(CACHE).then(c=>c.put(e.request,copy));
          return r;
        })
        .catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))
    );
    return;
  }

  // Görsellerde önbellek öncelikli.
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{
    const copy=r.clone();
    caches.open(CACHE).then(c=>c.put(e.request,copy));
    return r;
  })));
});
