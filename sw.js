const VERSION = 'v1';
const STATIC_ASSETS = [
  '/', '/index.html', '/style.css', '/app.js', '/manifest.webmanifest', '/assets/icon.svg'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(STATIC_ASSETS)));
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k))))
  );
});

self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);

  // Cache-first para assets estáticos
  if(STATIC_ASSETS.includes(url.pathname)){
    e.respondWith(caches.match(e.request).then(res=>res || fetch(e.request)));
    return;
  }

  // Runtime cache para GET same-origin
  if(e.request.method === 'GET' && url.origin === location.origin){
    e.respondWith(
      caches.match(e.request).then(cacheRes=>{
        const fetchPromise = fetch(e.request).then(networkRes=>{
          const copy = networkRes.clone();
          caches.open(VERSION).then(c=>c.put(e.request, copy));
          return networkRes;
        }).catch(()=>cacheRes);
        return cacheRes || fetchPromise;
      })
    );
  }
});