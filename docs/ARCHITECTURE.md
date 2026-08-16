# Little Realm project structure

This is the current modular source layout. `src/` is authoritative game code and `js/game.js` is the generated production bundle.

- `config/game-balance.js` — live balance values; editable without rebuilding the game
- `config/items.js` — item catalog and backpack-facing item metadata
- `config/loot-tables.js` — mob/item drop rules; editable without rebuilding the game
- `config/world-objects.js` — placed prop data exported from World Builder
- `config/npcs.js` — placed NPC data exported from World Builder
- `config/quests.js` — quest definitions exported from World Builder
- `src/core.js` — shared canvas/assets/state/utilities
- `src/inventory.js` — slot/stack inventory and item-definition access
- `src/loot.js` — loot-table rolling, conditions, validation, and inventory grants
- `src/world.js` — map generation, terrain, scenery, config-driven NPC placement/collision, camera/world rendering
- `src/quests.js` — quest definitions/runtime progress, NPC dialogue, quest markers, quest log, and objective tracking
- `src/player.js` — player state, rendering, movement and directional input helpers
- `src/mobs.js` — enemy templates, spawning, sprites and world AI
- `src/combat.js` — open-world combat, targeting, cooldowns, damage, death/respawn, legacy battle helpers
- `src/ui.js` — HUD/menu state
- `src/save.js` — local save/load
- `src/loop.js` — animation/update loop
- `src/bootstrap.js` — one-time event binding/startup only
- `tools/build.py` — concatenates source modules into production `js/game.js` under the original shared IIFE scope

## Safe update rule
For code changes: edit the owning `src/` module, run `python3 tools/build.py`, run syntax/regression checks, then package the complete project. Do not directly edit generated `js/game.js` unless rebuilding immediately afterward.

For balance-only changes: edit `config/game-balance.js` and push that single file. No build step is required.

For world/content changes, the preferred workflow is **World Builder → Project → Export World Pack**. The resulting `little-realm-world-pack.json` contains current props, NPCs, quests, visual settings, and combat balance so a batch of editor changes can be applied together.

For release documentation, add a new entry to the top of `CHANGELOG.md`. Keep `README.md` focused on the current project and `docs/` focused on current systems. Do not create per-update `.txt` files in the project root; `tools/project-hygiene-test.py` enforces this during validation.

## Protected systems
The seamless terrain renderer, house footprint collision, tree trunk collision, and camera zoom 1.85 remain locked unless a requested feature specifically requires changing them.
