const CACHE='museum-detectives-adventure-v13';
const FILES=['./','./brand.css','./live.js','./staff.js','./firebase.js','./firebase-config.js','./manifest.webmanifest','./icon.svg','./assets/language-in-action-logo.png','./assets/gabarito-bold.ttf'];
const SDK='https://www.gstatic.com/firebasejs/12.19.0/';
const SDK_FILES=['firebase-app.js','firebase-auth.js','firebase-firestore.js'].map(f=>SDK+f);
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(async c=>{await c.addAll(FILES);await c.addAll(SDK_FILES).catch(()=>{})}));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('museum-detectives-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET')return;
 // Firebase SDK files never change for a pinned version: serve from cache first.
 if(url.href.startsWith(SDK)){e.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(e.request.url);if(cached)return cached;const response=await fetch(e.request);if(response.ok)await cache.put(e.request.url,response.clone());return response}));return}
 // Site files: network first, cached copy when offline.
 if(url.origin===self.location.origin)e.respondWith(caches.open(CACHE).then(async cache=>{try{const response=await fetch(e.request);if(response.ok&&!response.redirected)await cache.put(e.request,response.clone());return response}catch(error){const cached=await cache.match(e.request,{ignoreSearch:true});if(cached)return cached;throw error}}))});
