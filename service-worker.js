const CACHE_NAME = "little-realm-v51-floating-loot-ui";
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.webmanifest",
  "./js/pwa.js",
  "./js/runtime-loader.js",
  "./config/game-balance.js",
  "./config/visual-settings.js",
  "./config/items.js",
  "./config/loot-tables.js",
  "./config/keybinds.js",
  "./config/world-objects.js",
  "./js/game.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/items/slime-gel.png",
  "./assets/environment/terrain-seamless.png",
  "./assets/environment/water-seamless.png",
  "./assets/environment/environment-atlas.png",
  "./assets/props/object-atlas.png",
  "./assets/buildings/house-a.png",
  "./assets/buildings/house-b.png",
  "./assets/characters/player.png",
  "./assets/mobs/slime.png",
  "./assets/mobs/wolf.png",
  "./assets/mobs/goblin.png",
  "./assets/mobs/bear.png",
  "./assets/mobs/cow.png",
  "./assets/mobs/pig.png",
  "./assets/mobs/chicken.png",
  "./assets/environment/cave-entrance.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isLiveConfig = url.pathname.includes("/config/");

  if(isLiveConfig){
    event.respondWith((async () => {
      // Always ask the network for editable game config and bypass
      // the browser HTTP cache. Save a canonical copy only for offline use.
      const canonicalUrl = new URL(event.request.url);
      canonicalUrl.search = "";
      const canonicalRequest = new Request(canonicalUrl.toString(), {method:"GET"});
      try{
        const freshRequest = new Request(event.request, {cache:"no-store"});
        const response = await fetch(freshRequest);
        if(response && response.ok){
          const cache = await caches.open(CACHE_NAME);
          cache.put(canonicalRequest, response.clone());
        }
        return response;
      }catch(err){
        const cached = await caches.match(canonicalRequest);
        if(cached) return cached;
        throw err;
      }
    })());
    return;
  }

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
