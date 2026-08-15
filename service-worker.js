const CACHE_NAME = "little-realm-v15-pc-controls-verified";
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.webmanifest",
  "./js/pwa.js",
  "./config/game-balance.js",
  "./config/keybinds.js",
  "./js/game.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/environment/terrain-seamless.png",
  "./assets/environment/environment-atlas.png",
  "./assets/buildings/house-a.png",
  "./assets/buildings/house-b.png",
  "./assets/characters/player.png",
  "./assets/mobs/slime.png",
  "./assets/mobs/wolf.png",
  "./assets/mobs/goblin.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;
  if(event.request.mode === "navigate"){
    event.respondWith(fetch(event.request).then(response => {
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put("./index.html",copy));
      return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(fetch(event.request).then(response => {
    const copy=response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request,copy));
    return response;
  }).catch(() => caches.match(event.request)));
});
