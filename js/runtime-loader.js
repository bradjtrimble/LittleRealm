(() => {
  const bootStamp = Date.now().toString(36);

  function loadScript(src, fresh = false) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = false;
      script.src = fresh ? `${src}${src.includes("?") ? "&" : "?"}lr=${bootStamp}` : src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.body.appendChild(script);
    });
  }

  async function loadConfig(src) {
    try {
      await loadScript(src, true);
    } catch (err) {
      console.warn(`Fresh ${src} unavailable; trying offline cache.`, err);
      await loadScript(src);
    }
  }

  function applySharedContent(content) {
    if (!content || typeof content !== "object") return false;
    if (content.items && typeof content.items === "object") window.LR_ITEMS = content.items;
    if (content.lootTables && typeof content.lootTables === "object") window.LR_LOOT_TABLES = content.lootTables;
    if (content.assets && typeof content.assets === "object") window.LR_ASSETS = content.assets;
    if (content.objectDefinitions && typeof content.objectDefinitions === "object") window.LR_OBJECT_DEFINITIONS = content.objectDefinitions;
    if (content.terrains && typeof content.terrains === "object") window.LR_TERRAINS = content.terrains;
    if (content.terrainDefaults && typeof content.terrainDefaults === "object") window.LR_TERRAIN_DEFAULTS = content.terrainDefaults;
    if (content.artReferences && typeof content.artReferences === "object") window.LR_ART_REFERENCES = content.artReferences;
    if (content.characterDefaults && typeof content.characterDefaults === "object") window.LR_CHARACTER_DEFAULTS = content.characterDefaults;
    if (content.audioClips && typeof content.audioClips === "object") window.LR_AUDIO_CLIPS = content.audioClips;
    if (content.audioSets && typeof content.audioSets === "object") window.LR_AUDIO_SETS = content.audioSets;
    if (content.audioEvents && typeof content.audioEvents === "object") window.LR_AUDIO_EVENTS = content.audioEvents;
    if (content.mobs && typeof content.mobs === "object") {
      window.LR_BALANCE = window.LR_BALANCE || {};
      window.LR_BALANCE.mobs = content.mobs;
    }
    window.LR_SHARED_CONTENT = content;
    return true;
  }

  function applyWorldPack(pack) {
    if (!pack || typeof pack !== "object") return false;
    if (pack.zoneSettings && typeof pack.zoneSettings === "object") window.LR_ZONE_SETTINGS = pack.zoneSettings;
    if (Array.isArray(pack.terrain)) window.LR_WORLD_TERRAIN = pack.terrain;
    if (Array.isArray(pack.worldObjects)) window.LR_WORLD_OBJECTS = pack.worldObjects;
    if (Array.isArray(pack.npcs)) window.LR_NPCS = pack.npcs;
    if (Array.isArray(pack.quests)) window.LR_QUESTS = pack.quests;
    if (Array.isArray(pack.mobSpawns)) window.LR_MOB_SPAWNS = pack.mobSpawns;
    if (pack.visualSettings && typeof pack.visualSettings === "object") window.LR_VISUAL = pack.visualSettings;
    if (pack.balance && typeof pack.balance === "object") {
      const sharedMobs=window.LR_BALANCE?.mobs;
      window.LR_BALANCE = pack.balance;
      if (sharedMobs) window.LR_BALANCE.mobs=sharedMobs;
    }
    return true;
  }

  async function loadProjectContent() {
    try {
      const manifestResponse = await fetch(`./content/little-realm.project.json?lr=${bootStamp}`, {cache:"no-store"});
      if (!manifestResponse.ok) throw new Error(`Project manifest HTTP ${manifestResponse.status}`);
      const manifest = await manifestResponse.json();
      if (manifest.sharedContent) {
        const sharedResponse = await fetch(`./${manifest.sharedContent}?lr=${bootStamp}`, {cache:"no-store"});
        if (!sharedResponse.ok) throw new Error(`Shared content HTTP ${sharedResponse.status}`);
        const sharedContent = await sharedResponse.json();
        if (!applySharedContent(sharedContent)) throw new Error("Shared content is invalid");
      }
      const zones = Array.isArray(manifest.zones) ? manifest.zones : [];
      const zone = zones.find(entry => entry.id === manifest.defaultZone) || zones[0];
      if (!zone?.pack) throw new Error("Project manifest has no default zone pack");
      const packs = {};
      await Promise.all(zones.map(async entry => {
        if (!entry?.id || !entry?.pack) return;
        const response = await fetch(`./${entry.pack}?lr=${bootStamp}`, {cache:"no-store"});
        if (!response.ok) throw new Error(`${entry.pack} HTTP ${response.status}`);
        packs[entry.id] = await response.json();
      }));
      const pack = packs[zone.id];
      if (!pack || !applyWorldPack(pack)) throw new Error("World Pack is invalid");
      const allQuests=[];const questIds=new Set();
      for(const entry of zones){for(const quest of packs[entry.id]?.quests||[]){if(!quest?.id||questIds.has(quest.id))continue;questIds.add(quest.id);allQuests.push(quest);}}
      window.LR_QUESTS = allQuests.length ? allQuests : (pack.quests||[]);
      window.LR_PROJECT_ZONE_PACKS = packs;
      window.LR_ACTIVE_PROJECT = {manifest, zone};
      console.info(`Little Realm loaded ${zone.name || zone.id} from project content (${zones.length} zone${zones.length===1?"":"s"} ready)`);
    } catch (err) {
      throw new Error(`Little Realm project content failed to load: ${err?.message || err}`);
    }
  }

  async function bootLittleRealm() {
    for (const config of [
      "./config/game-balance.js",
      "./config/keybinds.js"
    ]) await loadConfig(config);

    await loadProjectContent();
    await loadScript("./js/game.js", true);
  }

  bootLittleRealm().catch(err => {
    console.error("Little Realm boot failed:", err);
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = "Game failed to start. Refresh and try again.";
      toast.classList.add("show");
    }
  });
})();
