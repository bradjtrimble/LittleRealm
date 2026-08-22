# Little Realm World Builder

The World Builder is a **local development application**. Run `START WORLD BUILDER.bat`, connect the repository folder in **Project**, edit content, validate, then **Save Project Folder**.

## One content model

The Builder now treats original and new content the same way.

### Shared Content Library

`content/shared/content-library.json` contains reusable Terrain records, Mob Types, Items, Loot Tables, Asset records, and ordinary shared Object Library definitions.

### Zone packs

`content/zones/<zone-id>/world-pack.json` contains that zone's dimensions/start point, terrain grid, World Beyond terrain, placed objects/interactions, placed NPCs, mob spawns, quests, and zone settings.

There is no Biome layer and no duplicate content-config fallback. The current project schema is the only supported format while Little Realm remains pre-release.

## Terrain

The **Terrain** tab contains the Terrain Painter and Terrain Library together. Every terrain is an ordinary record, including the original Grass/Water/etc. and anything you import later.

Import a seamless image under **Assets → Terrain Texture**, choose **Create Paintable Terrain**, then configure properties such as:

- walkable
- healing
- sanctuary
- movement speed
- texture/fallback renderer
- edge style
- optional generated decoration/tree sprite, scale, density, and trunk collision

The new terrain immediately becomes a painter option. **World Beyond Zone** simply selects any Terrain record, so an island can use Ocean, a snow zone can use Snow, and a mountain zone can use Rock without a separate theme system.

Each textured terrain also has **Texture Detail Scale %**. `100%` preserves the imported texture's current world scale. Lower values shrink visual details and repeat the seamless texture more densely (`50%` ≈ 2× repeat density, `25%` ≈ 4×). Higher values enlarge details. Changes preview live in the world before saving.

## Mobs and spawns

Every creature is an ordinary Mob Type. The Mob editor selects a registered Mob Sprite Asset, shows a preview, supports level-based baseline stats with optional manual overrides, explains Boss behavior, and edits Drops & Rewards directly.

The **Spawns** tab places any Mob Type into a zone. Spawn position is the mob's home/leash center. Sanctuary terrain prevents outside hostile mobs from entering/aggroing into it, but mobs intentionally spawned on sanctuary terrain can still move normally.

## Objects and interactions

Imported World Images can become reusable placeable objects. Placed objects support visual hitbox/depth editing plus the unified World Interaction system for enter/exit, gather, open/loot, examine, activate, and custom interactions.

The green Interaction Area can be dragged/resized visually and is independent from collision and depth. Interaction settings support requirements, item/loot rewards, one-time/timed use, quest interaction tags, and zone travel. **Create & Link Interior Zone** builds an interior and return exit automatically.

## Zones

The **Zones** tab creates blank or copied maps, switches active zones, edits dimensions/start metadata, chooses the production default, and deletes zones with snapshot protection. Each zone is independent project data.


## Audio

The **Audio** tab is the project-wide sound workspace. It supports batch MP3/OGG/WAV import, clip preview, reusable Sound Sets, zone music/ambience, and global gameplay event assignments. Terrain footsteps are assigned from each Terrain record, mob cues from Mob Types, and object interaction/ambient emitter audio from the object inspector. See `docs/AUDIO.md`.

## Assets

The **Assets** tab imports artwork directly into the connected project folder and registers it for use by Mob Types, independent NPCs, Items, Terrain, tree decoration, or placeable world objects.

## Project Health

The **Project** tab shows saved/unsaved status, validates cross-references and assets, and can create lightweight JSON snapshots in `builder-backups/`. Saving validates and snapshots changed project data before writing it to disk.

## Source structure

Authoritative Builder source lives in focused modules under `src/builder/`. `tools/build.py` generates one local `builder/game.js` for the browser while keeping production `js/game.js` free of the editor UI. The module-size validation budget prevents the Builder from growing back into a monolith.

## Builder camera modes (v75)

The local Builder has three camera modes that never change production camera behavior:

- **Player Camera** follows the character exactly like normal gameplay.
- **Free Camera** leaves the character in place while WASD/arrow keys pan the view. The mouse wheel zooms and middle-mouse drag pans.
- **World View** fits the whole active zone into the visible workspace for overhead terrain and layout editing.

Camera utilities include **Center Player**, **Center Selection**, and **Move Player Here**. Move Player Here teleports the character to the camera center (or the nearest walkable point), making the fast test loop: Free Camera → edit → Move Player Here → F2. Camera position and zoom are remembered per zone and are Builder-only.

World View also exposes larger 9×9, 15×15, and 25×25 terrain brushes for broad painting passes.
