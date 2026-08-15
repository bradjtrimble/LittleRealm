# Little Realm project structure

This is the modular source baseline created from the user-confirmed v11 stable build.

- `config/game-balance.js` — live balance values; editable without rebuilding the game
- `src/core.js` — shared canvas/assets/state/utilities
- `src/world.js` — map generation, terrain, scenery, collision, camera/world rendering
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

## Protected systems
The seamless terrain renderer, house footprint collision, tree trunk collision, and camera zoom 1.85 remain locked unless a requested feature specifically requires changing them.
