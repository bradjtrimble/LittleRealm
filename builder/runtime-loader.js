(() => {
  const bootStamp = Date.now().toString(36);
  window.LR_BUILDER_MODE = true;

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
      console.warn(`Fresh ${src} unavailable; trying normal cache.`, err);
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

  async function loadProjectPack() {
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
      const zone = (manifest.zones || []).find(entry => entry.id === manifest.defaultZone) || manifest.zones?.[0];
      if (!zone?.pack) throw new Error("Project manifest has no default zone pack");
      const packResponse = await fetch(`./${zone.pack}?lr=${bootStamp}`, {cache:"no-store"});
      if (!packResponse.ok) throw new Error(`World Pack HTTP ${packResponse.status}`);
      const pack = await packResponse.json();
      window.LR_BUILDER_PROJECT = {manifest, zone, pack};
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
      console.info(`Little Realm Builder loaded ${zone.name || zone.id} from ${zone.pack}`);
    } catch (err) {
      throw new Error(`World Builder project content failed to load: ${err?.message || err}`);
    }
  }

  async function bootWorldBuilder() {
    for (const config of [
      "./config/game-balance.js",
      "./config/keybinds.js"
    ]) await loadConfig(config);

    await loadProjectPack();
    await loadScript("./builder/game.js", true);
  }

  bootWorldBuilder().catch(err => {
    console.error("Little Realm World Builder boot failed:", err);
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = "World Builder failed to start. Check the local server and refresh.";
      toast.classList.add("show");
    }
  });
})();
