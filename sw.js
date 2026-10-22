/* Shorebreak service worker: lets the app open with no signal and be installed to the home screen.
   Pages and files from this site: network first (so a new index.html shows up straight away), saved copy if the network is slow or down.
   Leaflet from cdnjs: saved copy first (it never changes at that version).
   Everything else (weather, maps, tiles, search) goes straight to the network and is never kept here. */
const CACHE = 'shorebreak-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const LIB = ['https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled([...SHELL, ...LIB].map(u => c.add(u)));   // one failure must not stop the install
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function networkFirst(r){
  const c = await caches.open(CACHE), nav = r.mode === 'navigate';
  try {
    const res = await Promise.race([fetch(r, {cache:'no-cache'}), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 5000))]);
    if (res.ok) c.put(nav ? './index.html' : r, res.clone());
    return res;
  } catch(err){
    return (await c.match(nav ? './index.html' : r, {ignoreSearch:true})) || Response.error();
  }
}
async function cacheFirst(r){
  const c = await caches.open(CACHE), hit = await c.match(r);
  if (hit) return hit;
  const res = await fetch(r);
  if (res.ok) c.put(r, res.clone());
  return res;
}
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === self.location.origin) e.respondWith(networkFirst(r));
  else if (u.hostname === 'cdnjs.cloudflare.com') e.respondWith(cacheFirst(r));
});
