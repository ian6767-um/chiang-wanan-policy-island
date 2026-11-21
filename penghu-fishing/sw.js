// PWA 離線快取：先用快取，背景更新。改版時把 VERSION 加一。
const VERSION = 'penghu-v1';
const CORE = [
  './', 'index.html', 'style.css', 'manifest.webmanifest', 'assets/fonts/Cubic_11.woff2', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
  'data/config.json', 'data/fish.json', 'data/spots.json', 'data/rods.json', 'data/baits.json', 'data/boats.json', 'data/backpacks.json', 'data/dialog.json',
  'src/game/main.js', 'src/game/world.js', 'src/game/screen.js', 'src/game/audio.js',
  'src/core/data.js', 'src/core/game.js', 'src/core/backpack.js', 'src/core/fishing.js', 'src/core/clock.js', 'src/core/market.js', 'src/core/offline.js', 'src/core/save.js', 'src/core/rng.js',
  'src/render/pixel.js', 'src/render/tones.js', 'src/render/scene.js', 'src/render/actors.js', 'src/render/fishart.js', 'src/render/icons.js', 'src/render/portraits.js', 'src/render/mapart.js',
  'src/ui/ui.js', 'src/ui/dom.js', 'src/ui/backpack.js', 'src/ui/market.js', 'src/ui/shop.js', 'src/ui/map.js', 'src/ui/codex.js', 'src/ui/settings.js', 'src/ui/debug.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => {
    const net = fetch(e.request).then((res) => {
      if (res.ok) caches.open(VERSION).then((c) => c.put(e.request, res.clone()));
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
