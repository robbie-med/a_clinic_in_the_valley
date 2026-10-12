// Service worker (pattern from dont get lost / nongbu_game): cache the game so it opens offline once
// visited. Stale-while-revalidate. Registers only on https (main.js).
const CACHE = 'clinic-v1';
const SHELL = [
  './', './index.html', './css/style.css', './manifest.webmanifest', './icon.svg',
  './assets/tiles.png', './assets/tiles.json', './assets/icons.json', './assets/fonts/pixelify-sans-latin-400-normal.woff2', './assets/fonts/pixelify-sans-latin-600-normal.woff2',
  './vendor/phaser.min.js', './vendor/simplex-noise.js', './vendor/alea.js', './vendor/zzfx.js', './vendor/nipplejs.mjs',
  './js/main.js', './js/store.js', './js/ui/ui.js', './js/ui/body.js', './js/ui/icon-names.js', './js/game/scene.js', './js/game/icons.js', './js/game/sfx.js',
  './js/core/rng.js', './js/core/noise.js', './js/core/inventory.js', './js/core/lore.js', './js/core/time.js', './js/core/region.js', './js/core/world.js',
  './js/core/pk.js', './js/core/disease.js', './js/core/patient.js', './js/core/signs.js', './js/core/encounter.js', './js/core/clinic.js', './js/core/economy.js',
  './js/core/crafting.js', './js/core/actions.js',
  './js/core/content/index.js', './js/core/content/actives.js', './js/core/content/herbs.js', './js/core/content/conditions.js', './js/core/content/findings.js',
  './js/core/content/preparations.js', './js/core/content/goods.js', './js/core/content/build.js', './js/core/content/vendors.js',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/') || e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => {
    const net = fetch(e.request).then((res) => { if (res.ok && !res.redirected) caches.open(CACHE).then((c) => c.put(e.request, res.clone())); return res; }).catch(() => hit);
    return hit || net;
  }));
});
