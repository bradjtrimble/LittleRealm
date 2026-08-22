# Little Realm architecture

Little Realm has three layers: **engine runtime**, **local World Builder**, and **project content**.

## Engine runtime

`src/` owns game mechanics. `tools/build.py` builds the production `js/game.js` plus the small `src/devmode-shim.js`; the production bundle does not contain the World Builder UI.

The engine is allowed to know mechanics such as walkability, sanctuary/healing, movement speed, aggression, boss/elite rules, loot, interactions, and rendering layouts. It should not contain privileged IDs for individual content such as Slime, Goblin, Grass, or Starter Realm.

## Local World Builder

`src/builder/` contains focused editor modules. The same build script creates local-only `builder/game.js`, which runs against the real game runtime for accurate previews.

With the project folder connected, the Builder writes project JSON and imported assets directly to the repository. Project Health validates relationships before deployment, while snapshots provide recovery without creating an old-format compatibility layer.

## Project content

`content/little-realm.project.json` declares the shared library, zone list, and production default zone.

`content/shared/content-library.json` owns reusable records:

- Terrain Library
- Mob Types
- Items
- Loot tables
- Asset metadata
- Shared Object Library definitions (atlas crops and standalone images use the same record format)

`content/zones/<zone-id>/world-pack.json` owns zone-specific data:

- dimensions and player start
- terrain grid and World Beyond terrain
- placed objects and interactions
- NPC placements
- mob spawns
- quests
- zone visual/settings data

The production loader reads this project content directly. `config/game-balance.js` and `config/keybinds.js` are engine/global settings only; there are no duplicate item/NPC/quest/mob/terrain config sources.

## Terrain rule

Every paintable terrain is an ordinary Terrain Library record with a unique compact storage code. Properties determine behavior: texture/fallback renderer, walkability, healing, sanctuary, movement multiplier, edge style, and optional generated decorations. World Beyond Zone selects any Terrain record and uses the same renderer/data path.

## Mob rule

Every creature is an ordinary Mob Type record. A Mob Type links to a normal Asset record containing its sprite path and sprite-layout metadata. World size belongs to the Mob Type as a normalized visible `displayHeight`/`sizeClass`, not to the source image resolution. Original creatures and imported creatures use the same Mob Type catalog, spawn system, movement/combat code, and generic sprite renderer.

## Deployment

GitHub stores the full development repository. `tools/prepare-pages.py` creates `dist/` with only production files; Builder source/tools/local snapshots are excluded. Large art is runtime-cached instead of all being pre-cached during service-worker installation.

## Update rule

For engine/editor source changes, run `python3 tools/build.py` and `python3 tools/validate.py`. For normal content work, use the Builder and **Save Project Folder**.
