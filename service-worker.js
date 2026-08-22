const CACHE_NAME = "little-realm-v77-8-builder-help-visual-size-cache";

// Keep install lightweight. Large art is cached only after the game actually
// requests it, so adding future zones/NPCs/mobs does not bloat first install.
const CORE_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.webmanifest",
  "./js/pwa.js",
  "./js/runtime-loader.js",
  "./js/game.js",
  "./config/game-balance.js",
  "./config/keybinds.js",
  "./content/little-realm.project.json",
  "./content/shared/content-library.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isLiveData = url.pathname.includes("/config/") || url.pathname.includes("/content/");

  if(isLiveData){
    event.respondWith((async () => {
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

  // Network-first + runtime cache. Assets are stored only when they are used.
  event.respondWith(fetch(event.request).then(response => {
    if(response && response.ok){
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request,copy));
    }
    return response;
  }).catch(() => caches.match(event.request)));
});
