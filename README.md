# Little Realm

Little Realm is a browser-based top-down RPG with a modular game runtime and a separate local World Builder.

**Current build:** `v77.8-builder-help-visual-size`

v77.8 keeps the premade **Character Select** flow and the user-updated uniform NPC/mob art, while improving everyday World Builder editing. Supported settings now show clickable **info circles** with plain-language explanations and examples. Placed Objects, NPCs, and Mob Types can also be resized directly in the world with blue drag handles instead of relying on coordinate/size fields. Hitboxes and interaction areas remain independent.

## Recommended workflow

World/content editing happens in the local Builder. GitHub Pages deploys only the production game.

1. On Windows, double-click `START WORLD BUILDER.bat` in the repository root.
2. Open **Project → Open Little Realm Project Folder** and select the repository's `LittleRealm-main` folder in Chrome/Edge.
3. Build content through the Builder: terrains, objects/interactions, NPCs, quests, mob types/spawns, items/loot, audio, imported assets, zones, visual scale, and combat tuning.
4. Use **Project Health** to validate references and create snapshots before large changes.
5. Choose **Save Project Folder** to write shared content, the active zone, and the project manifest directly to disk.
6. Commit/push those files to GitHub. The production game reads the same project content.

World Pack import/export remains available as a portable backup. `builder-backups/` contains local JSON recovery snapshots and is never deployed.

## Content model

Little Realm now has one content model. Original content and newly created content use the same data paths.

- `content/shared/content-library.json` — Terrain Library, Mob Types, items, loot tables, sprite/image asset records, Audio Clips/Sound Sets/events, ordinary shared Object Library definitions, and canonical art-reference assignments.
- `content/zones/<zone-id>/world-pack.json` — terrain grid, player start, world objects/interactions, placed NPCs, mob spawns, quests, and zone settings.
- `content/little-realm.project.json` — project manifest and default zone.
- `config/game-balance.js` — engine/global balance only.
- `config/keybinds.js` — control mappings only.

There is no Biome layer and no content-config fallback layer. Terrain such as Grass, Snow, Flower Meadow, Water, or Rock is an ordinary Terrain Library record. Slime, Goblin, Wolf, or a newly imported creature are ordinary Mob Type records.

The Assets workflow stores canonical Character/Mob/NPC/Object/Building/Terrain/Item/Effect master references without requiring an approval gate for ordinary project art. Mob source resolution is also no longer a world-size control. Mob Types store a normalized visible `displayHeight` plus a human-friendly `sizeClass`; imported sprite assets are analyzed in the Asset Workshop for transparency, 4×4 framing, visible bounds, and edge clipping. See `docs/ART-PIPELINE.md`. Audio is equally data-driven: imported clips, reusable Sound Sets, terrain footsteps, zone music/ambience, mob cues, interaction sounds, and world emitters are documented in `docs/AUDIO.md`.

## Project layout

- `src/` — authoritative production game source modules.
- `src/builder/` — authoritative local World Builder modules.
- `src/devmode-shim.js` — tiny production hooks for editor calls referenced by shared runtime code; no Builder UI is shipped to players.
- `js/game.js` — generated production game bundle.
- `builder/` — local Builder page, loader, and generated Builder bundle.
- `content/` — current project content and zone packs.
- `config/` — engine/global balance and keybind settings only.
- `assets/` — game art and icons.
- `tools/` — local launcher, build, validation, size reporting, and deployment preparation.
- `docs/` — system documentation.
- `dist/` — generated production-only Pages artifact; never edit directly.

## Engine workflow

For engine/editor source changes:

```bash
python3 tools/build.py
python3 tools/validate.py
```

`tools/build.py` creates the lightweight production `js/game.js` and full local `builder/game.js`. GitHub Actions rebuilds and validates both, prints a size report, creates `dist/`, and deploys only `dist/`.

## Current-format policy

The game is still pre-release and has no player saves/projects that require compatibility. v77 is a clean current baseline: the Builder requires schema-v12 project/content and the player save uses schema-v2 with character identity, selected premade appearance, and equipped gear. Project snapshots protect editing mistakes, but there is no backward-migration layer yet. Compatibility should only be added once a real released project/save requires it.

## Quick local launch

Double-click **`START WORLD BUILDER.bat`** in the repository root. It forwards to the maintained launcher under `tools/`, starts the local server, and opens World Builder.
