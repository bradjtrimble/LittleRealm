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

  async function bootLittleRealm() {
    // Balance, item, and keybind files are deliberately cache-busted. They are
    // designed for quick GitHub edits without rebuilding the game.
    try {
      await loadScript("./config/game-balance.js", true);
    } catch (err) {
      console.warn("Fresh balance config unavailable; trying offline cache.", err);
      await loadScript("./config/game-balance.js");
    }

    try {
      await loadScript("./config/visual-settings.js", true);
    } catch (err) {
      console.warn("Fresh visual config unavailable; trying offline cache.", err);
      await loadScript("./config/visual-settings.js");
    }

    try {
      await loadScript("./config/items.js", true);
    } catch (err) {
      console.warn("Fresh item config unavailable; trying offline cache.", err);
      await loadScript("./config/items.js");
    }

    try {
      await loadScript("./config/loot-tables.js", true);
    } catch (err) {
      console.warn("Fresh loot-table config unavailable; trying offline cache.", err);
      await loadScript("./config/loot-tables.js");
    }

    try {
      await loadScript("./config/keybinds.js", true);
    } catch (err) {
      console.warn("Fresh keybind config unavailable; trying offline cache.", err);
      await loadScript("./config/keybinds.js");
    }

    try {
      await loadScript("./config/world-objects.js", true);
    } catch (err) {
      console.warn("Fresh world-object config unavailable; trying offline cache.", err);
      await loadScript("./config/world-objects.js");
    }

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
