## v77.8 — Builder Help & Visual Sizing

- Added clickable info-circle help beside supported World Builder settings, including the full Mob Type movement/respawn tuning group, with concise explanations and examples.
- Added a blue drag-handle Visual Size editor for placed Objects and NPCs. Objects support side/corner width-height resizing; NPCs preserve sprite proportions while resizing.
- Added Visual Size editing for selected Mob Types from the scale panel; resizing a live mob updates the shared species display height so every mob of that type stays uniform.
- Kept sprite size independent from yellow hitboxes and green interaction areas so visual art, collision, and usable areas can be tuned separately.
- Updated validation expectations to the current normalized mob sprite IDs and current unified Object Library supplied by the latest project source.
- Added regression coverage for setting-help and visual-size editing.

## v77.6 — Premade Character Select

- Replaced modular character creation with a premade Character Select screen.
- Playable characters now use complete 4×4 sprite sheets with their visual design baked in.
- Retired body, hair, and equipment-layer rendering from the player runtime.
- Kept Chest, Legs, Feet, Head, Hands, Back, Main Hand, and Off Hand as gameplay/inventory equipment slots without visual overlay requirements.
- Removed Player Body/Hair/Equipment layer choices from the active Asset Workshop and Art Prompt Builder workflow.
- Renamed Player Appearance authoring to **Playable Character** in the World Builder.
- New characters still receive configured starter equipment, but the selected premade sprite remains visually unchanged.
- Old modular character saves fall back safely to the configured default premade character.

## v77.5 — Independent Equipment Layers

- Retired the Player Outfit layer from the active modular character format. New modular characters are the canonical Player Body plus Hair and individually equipped gear layers.
- Added equipment slots for Head, Chest, Hands, Back, Legs, Feet, Main Hand, and Off Hand. Equipment items point to a matching `playerEquipment` sprite layer rather than baking a full outfit into the character.
- New characters now start on the modular base-body path and receive configurable starter Chest, Legs, and Feet items. The shipped starter item records are ready to be linked to generated equipment artwork in the Content Library.
- Added a compact equipped-gear panel to Backpack. Drag or double-click equipment from the bag to equip it; click an equipped slot to return the item to the backpack.
- Updated the Art Prompt Builder and asset importer to create Player Equipment layers by slot. The existing fullscreen/global/per-direction alignment tools work on every equipment layer.
- Item authoring now includes Equipment Slot, Character Layer, and “equip on newly created characters” controls, so starter gear and future loot can use the same data-driven equipment system.

## v77.4 — Direction Row Alignment
- Added per-direction X/Y fine-tuning for modular Hair and Outfit layers: Down, Right, Left, and Up can now be nudged independently after the global sheet alignment is correct.
- Fullscreen alignment now includes an All Rows / Down / Right / Left / Up drag target. The selected direction is highlighted directly in the 4×4 preview.
- Direction offsets are applied in the actual player renderer, not just the Builder preview, and older projects without row offsets remain compatible.
- Kept scale global on purpose so fixing one direction cannot accidentally make that row a different size from the others.

## v77.2 — Rig Alignment Workspace Visibility

- Reworked Modular Layer Alignment into a split workspace so the live 4×4 preview stays visible beside the scale and offset controls on normal Builder widths.
- On narrow screens the preview becomes a compact sticky panel, so it remains visible while scrolling through alignment controls.
- Scale and X/Y numeric controls now redraw the preview continuously while values are edited instead of waiting for the field to lose focus.
- Added clearer preview labeling, body/layer opacity legend, and a positioning tip without changing the saved rig transform format.

## v77.1 — Modular Character Rig Alignment

- Player Body / Hair / Outfit imports now preserve the entire 4×4 sheet as one exact 512×512 rig instead of independently fitting each frame.
- Added a Body/Hair/Outfit alignment workshop in Assets with live stacked preview, drag-to-nudge, scale/offset controls, and compatible-body assignment.
- The first imported Player Body becomes the default modular body automatically; future layers link to that rig by default.
- Character Creator now filters Hair/Outfit layers by compatible body rig and the runtime applies saved layer alignment transforms consistently in all 16 frames.
- Project Health validates modular-rig compatibility and alignment metadata.

## v77 — Startup & Character Creation

- Added a production startup/title screen with Continue and Create Character.
- New characters choose a saved character name and a project-defined player appearance.
- Added a live animated character preview using the real player renderer.
- Player character identity/appearance is persisted in save schema v2.
- Registered the existing player artwork as an ordinary Player Appearance asset instead of a fixed renderer dependency.
- Added standardized Player Appearance, Player Body, Player Hair, and Player Outfit asset import types for the future layered equipment rig.
- Added a configurable default player appearance in shared project content.
- Builder mode bypasses startup/character creation and continues launching directly into editing.
- Character names now appear in the game menu and battle status.
## v76.2 — Floating NPC & Quest Windows
- NPC conversations now use draggable, non-modal floating windows like Backpack/Loot.
- Object quest-board/offered-quest windows are draggable and non-modal too.
- Dialogue and quest windows no longer darken the world and their positions persist locally.
- Player/world input continues while these panels are open; E still closes an active NPC conversation.

## v76.1 — Persistent Containers & Object Quests

- Added persistent storage-container inventories with two-way item transfer.
- Added loot-table world containers that use the mob-style loot window and preserve partially looted contents.
- Added one-time, repeatable, hidden-after-loot, and timed loot respawn behavior.
- Added object-attached quests with Offer Quests and Start Automatically behavior.
- Added Project Health validation for object loot tables, storage capacity, and attached quest references.
- Project/content/world schema is now v11.

## v76 — Audio System & Terrain Footsteps

- Added a data-driven Audio Library to World Builder with multi-file MP3/OGG/WAV import and in-editor preview.
- Added separate Master, Music, Ambience, SFX, and UI mixer buses plus player-local volume/mute controls.
- Added reusable Sound Sets for randomized variations such as footsteps, impacts, and creature sounds.
- Added per-Terrain Footstep Sound Set and volume controls; player movement now triggers randomized terrain-specific footsteps.
- Added per-zone music and ambience with independent volume and smooth runtime transitions.
- Added configurable mob Aggro, Attack, Hit/Hurt, and Death audio plus audible range.
- Added interaction sounds for world objects and positional looping Sound Emitters for fireplaces, waterfalls, portals, machinery, and similar ambience sources.
- Added configurable global gameplay sound events for player attack/hit, potion use, loot pickup, quest acceptance/completion, and level-up.
- Added positional attenuation and stereo panning for world SFX while music/ambience remain non-positional mix layers.
- Audio files load/cache on demand and are not added to the PWA install precache.
- Project Health now validates missing clips/sets/files and audio references without treating optional unassigned audio as an error.
- Project/shared/zone schemas advance to v10.

## v75.3.1 — Sprite Direction Live-Sync Hotfix

- Fixed Sprite Direction Mapping edits so they update the live runtime asset registry immediately; F2 playtesting now reflects row changes without reloading shared content.
- Corrected Jorge and Npc Placeholder to the row order used by their actual sprite sheets (Down 1, Right 2, Left 3, Up 4).
- Clarified mapping status text: changes apply live in Builder, while Save Project persists them to project files.
- Added regression coverage for live asset-registry synchronization and the shipped Jorge/Placeholder mappings.

## v75.3 — Sprite Direction Calibration

- Added editable direction-row mapping for NPC and mob sprite assets in the Asset Inspector.
- Added one-click Swap Left / Right for AI sheets that reverse side-facing rows.
- Corrected Mayor Buck's registered row mapping so conversation facing points toward the player.
- Conversation facing remains temporary and does not overwrite an NPC's saved idle direction.

## v75.2 — NPC Conversation Facing

- NPCs now temporarily face the player for the entire time their dialogue is open.
- Closing dialogue restores the NPC's authored idle-facing direction automatically.
- The player also turns toward the NPC when conversation begins.
- Conversation facing is renderer-driven, so talking cannot accidentally overwrite saved NPC facing data.

## v75.1 — Builder Camera Hotfix
- Added Player Camera, Free Camera, and World View modes to the local World Builder.
- Free Camera pans independently with WASD/arrow keys or middle-mouse drag and zooms with the mouse wheel.
- World View fits the full active zone into the visible Builder workspace for large-scale terrain editing.
- Added Center on Player, Center on Selection, and Move Player Here so builders can teleport the character to the current camera POV before pressing F2 to test.
- Added 9×9, 15×15, and 25×25 terrain brushes for overhead editing.
- Builder camera position/zoom/mode are remembered per zone and never affect production camera behavior.

## v74.6 — Builder Workflow Optimization
- Added multi-file batch asset import. Terrain batches become paintable terrains automatically; object/building batches become Object Library entries automatically.
- Reorganized Assets, Terrain, and Objects into compact master/detail layouts so libraries and inspectors stay visible together.
- Added persistent collapsible sections, with art/reference/advanced sections collapsed by default where appropriate.
- Added search across Assets, Terrain, Objects, NPC sprites, Mob Spawns, Content, and Quests.
- Added a resizable World Builder panel with remembered desktop width.
- Removed Candidate / Approved / Rejected art QA bookkeeping and the associated save-validation warnings. Master Art References remain independent and optional.
- Project Health now classifies unused/large assets as informational advisories instead of normal save warnings.
- Added purpose-driven import actions and compact post-import shortcuts such as Open Terrain / Open Objects / Open NPCs.
- Retains one-shot placement, tool-state visibility, tab scroll memory, sprite normalization, terrain scale control, and unified content architecture.

## v74.5 — Unified Content Library
- Removed the Built-in Prop Palette / Custom Objects split. All placeable props now come from one shared Object Library.
- Converted the original object-atlas cells into ordinary object definitions that reference the atlas asset plus crop metadata.
- Converted Cave Entrance into an ordinary asset-backed object definition; the runtime no longer has cave/gate/crop-specific render branches.
- Zone object placements now use one generic `type: object` + `objectId` reference model.
- Imported World Images create the same Object Library record type as original props.
- Removed the obsolete slime-specific quest balance knob (`SLIMES_REQUIRED` / `slimesRequired`).
- Renamed terrain fallback UI to make clear that fallback renderers are engine safety behavior, not privileged terrain content.
- Added validation guarding against reintroducing content-specific object render paths.

## v74.4 — Builder UX Polish

- Added one-shot placement by default for objects, NPCs, and mob spawns to prevent accidental duplicate placement.
- Added optional Repeat Placement mode for deliberate mass placement.
- Added a persistent current-tool strip showing Select, Paint, Place, or visual-edit state.
- Added Finish / Select control and made Escape reliably return to Select mode.
- Added per-tab scroll memory and section jump chips to reduce repeated scrolling.
- Renamed Selection to Inspector and widened/responsively reorganized the Builder panel.
- Switching away from a placement tab now safely disarms that placement tool.

## v74.3 — Art Reference & QA Pipeline

- Added a project-owned Canonical Art Reference Library with Character, Mob, NPC, Object, Building, Terrain, Item, and Effect master roles.
- Art Prompt Builder now shows the recommended master images to attach and writes their project paths plus visual-matching instructions into generated prompts.
- Added Candidate / Approved / Rejected art QA states. New imports start as Candidate; setting an asset as a master automatically approves it.
- Asset Inspector now shows side-by-side comparison against compatible master references.
- Project Health validates master-reference links, warns when imported Candidate art is already in use, and errors when Rejected art remains referenced.
- Canonical reference assignments are saved inside the shared project content, not hard-coded into the Builder.
- Retains v74.2 sprite normalization, NPC asset-first placement, and terrain texture scale controls.

## v74.2.2 — Terrain Scale Control

- Added per-terrain **Texture Detail Scale %** controls (10%–400%).
- Texture scale previews live in the world; lower values shrink visual details and increase repeat density.
- World Beyond Zone uses the same terrain scale automatically because it renders the same Terrain record.
- New terrain records default to 100% texture scale.
- Added Project Health validation for invalid terrain scale values.
- Added a root-level **START WORLD BUILDER.bat** launcher so the local Builder can be started without opening the `tools` folder.

## v74.2.1 — NPC Asset Normalization

- Removed the active NPC Template workflow from World Builder.
- NPCs now choose any registered NPC Sprite asset directly.
- The NPC tab now shows every imported NPC Sprite in a visual placement palette.
- Selecting an NPC Sprite and clicking the world creates an independent zone NPC immediately.
- Existing NPCs can swap sprite assets directly from NPC Details or Selection.
- Asset Inspector can assign an NPC Sprite to any placed NPC or enter placement mode with that sprite.
- Lilly, Jorge, the placeholder, and future imported NPCs now use the same asset-driven workflow.
- Project Health now validates NPC sprite assets from zone NPC records instead of shared templates.

## v74.2 — Sprite Normalizer

- Mob and NPC sprite imports now normalize arbitrary square 4×4 AI sheets to a 512×512 game sheet with exact 128×128 cells.
- Asset Workshop records AI source dimensions separately from normalized game dimensions and validates the normalized sheet.
- New sprite imports use the canonical direction layout: down, right, left, up.
- NPC rendering now reads direction-row metadata from the assigned NPC sprite asset, so older project NPC art and new canonical sheets can coexist without hard-coded row assumptions.
- NPC templates now remember their assigned sprite asset ID in addition to the image path.
- Art Prompt Builder now treats 512×512 as the target rather than depending on the generator to obey exact source resolution; strict 4×4 composition and proportional padding are the important source requirements.

## v74.1 — Art Prompt Builder

- Added a built-in **Little Realm Art Standard** section to the World Builder Assets tab.
- Added **Create Art Prompt**, a prompt builder for Mob Sprites, NPC Sprites, World Objects, Buildings, Terrain Textures, Item Icons, and Effect Sprites.
- Locked technical prompt rules by asset class so new generated art follows consistent sprite-sheet layout, transparency, safe-area, object presentation, and terrain tileability requirements.
- Added a quick visual guide for Little Realm rendering rules, camera/perspective rules, and scale guidance.
- Expanded the art-pipeline documentation to cover the new prompt-driven workflow.

## v74.0.1 — Art Pipeline Render Hotfix

- Fixed a v74 runtime regression where entering the render range of a mob could throw `ReferenceError: mobVisualScale is not defined`, stopping the frame after terrain was drawn and making the player/world entities appear to disappear.
- Restored `mobVisualScale()` as a world-relative helper derived only from normalized `displayHeight`; source sprite resolution remains completely separate from game scale.
- Kept selection rings, HP labels, click radii, and Builder overlays proportional to the normalized mob world size without restoring legacy `spriteScale`.
- Strengthened the runtime smoke test by forcing a live mob into the active camera and drawing another frame, so this exact render-range failure is now covered.
- Bumped build labels and the service-worker cache key so browsers do not keep serving the broken v74 runtime bundle.

## v74 — Art Pipeline Foundation

- Replaced resolution-dependent mob `spriteScale` with normalized visible `displayHeight` plus Tiny/Small/Medium/Large/Huge/Boss/Custom size classes.
- Mob rendering now measures the visible down/idle reference frame, so 384px and 1254px sprite sheets can share the same in-game world size.
- Migrated every existing mob to the new size model while preserving its current apparent size.
- Upgraded Assets into an **Asset Workshop** that analyzes imported images for dimensions, transparency, alpha coverage, 4×4 frame population, visible bounds, and edge clipping.
- Added a Little Realm Asset Check card to the Asset Inspector and records `little-realm-v1` art-profile metadata on project assets.
- Added Project Health checks for normalized mob heights and analyzed mob-sprite metadata, and advanced the clean project/shared/world baseline to schema v8.
- Added `docs/ART-PIPELINE.md` and updated visual-scale/architecture documentation.

## v73.3.1 — Content Normalization Hotfix

- Restored the generic prop-atlas draw helper accidentally removed during v73.3 normalization.
- Fixes the render loop stopping after terrain, which hid props, NPCs, mobs, and the player.
- Updated local Builder and production build labels/cache-busting tags so the running version is obvious.
- Strengthened the smoke test to execute an actual world render frame, preventing this class of missing-render-helper regression.

## v73.3 — Content Normalization / Clean Baseline

- Removed the Biome layer completely. The Terrain tab now owns both the direct Terrain Library and Terrain Painter.
- Converted Grass, Water, Forest, Road, Safe Grass, Blocked Forest, Dirt, Sand, and Rock into ordinary Terrain records with unique storage codes and behavior properties.
- Imported terrain art can be turned directly into a new paintable Terrain record; World Beyond Zone can select any Terrain record and uses the same renderer/data path.
- Terrain mechanics are property-driven: walkability, healing, sanctuary protection, movement multiplier, edge style, fallback renderer, texture asset, and generated decorations are no longer inferred from privileged terrain IDs.
- Removed built-in mob/render-preset handling. Slime, Goblin, Wolf, farm animals, Snickers, and newly created mobs now use the same Mob Type catalog, sprite Asset records, layout metadata, spawn path, movement/combat logic, and generic renderer.
- Removed duplicate content config files (`items`, `loot-tables`, `npcs`, `quests`, `world-objects`, `visual-settings`). Shared content and zone packs are now the only content sources; `config/` contains only engine balance and keybinds.
- Removed the hard-coded Starter Realm terrain/scenery reconstruction fallback. Missing/invalid current project data now reports an error instead of silently rebuilding an old map.
- Reset the pre-release player-save contract to a clean schema-v1 format and made project/shared/zone schema v7 the only accepted project format. There is no backward-migration layer because no released saves/projects need compatibility yet.
- Updated Project Health, regression guards, documentation, and tests around the normalized content model. Project snapshots remain for recovery from editing mistakes.

## v73.2 — Mob Authoring Polish

- Safe Grass now acts as a sanctuary boundary instead of forcibly freezing mobs: outside mobs cannot enter/aggro players inside, while mobs intentionally spawned on Safe Grass can move normally.
- Replaced the Mob editor's confusing Render Preset / raw sprite path workflow with a registered **Mob Sprite Asset** selector and live preview; legacy built-in render presets remain internal compatibility data only.
- Added direct **Drops & Rewards** editing to each Mob Type. Item drops automatically create/update that mob's loot table, while gold/potion drops remain editable in the same section.
- Added an explicit standard mob power baseline to the balance config and **Auto-fill HP / ATK / DEF from Level** for new mobs. Existing tuned mobs remain manual by default.
- Added a clear Boss / special encounter explanation: bosses do not wander, do not respawn, cannot roll Elite, and use the configured boss stat/XP multipliers.
- Added focused regression coverage for mob authoring, absolute level baselines, direct loot editing, asset selection, and Safe Grass sanctuary behavior.

## v73.1 — Interaction Area Editor Polish

- Fixed visual interaction-area mode immediately disabling itself after activation.
- Interaction areas can now be moved by dragging inside the green box and resized from side/corner handles, matching the hitbox workflow.
- Area X/Y/W/H fields update the green box immediately while typing and update live while dragging.
- Entering/leaving visual interaction, hitbox, or depth editing preserves current unsaved object-inspector values instead of reverting them on panel refresh.

## v73 — Unified World Interactions & Enterable Interiors

- Added one configurable World Interaction system for buildings/doors, gathering nodes, quest props, chests, portals, switches, and future usable scenery.
- World objects now support interaction type/prompt/range, click/tap + E-key input, quest/item requirements, item rewards, loot tables, key consumption, zone travel, one-time/timed use, and hide-after-use state.
- Added a separate green visual Interaction Area editor so usable door/chest/crop regions can be positioned independently from collision hitboxes and Y-sort depth lines.
- Added **Create & Link Interior Zone**: creates a new interior zone, links the selected exterior object to it, and seeds a return Exit object back to the source zone.
- Production now preloads project zone packs for in-game transitions, persists the active zone and per-object use state in saves, and restores the saved zone before restoring player position.
- Added **Interact With Object** quest objectives keyed by reusable interaction tags; collect quests can also progress naturally from interaction-granted items.
- Project Health now checks interaction references to quests, items, loot tables, zones, and object interaction targets.
- Legacy `interactable` flags remain inert until an actual interaction configuration is authored, preventing old props from unexpectedly becoming active.

## v72 — Project Health, Versioning & Migration

- Added explicit schema versions for the project manifest, shared content library, and zone packs.
- Added automatic schema migration with a JSON recovery snapshot before any on-disk upgrade.
- Added Project Health validation for broken quest/NPC/mob/item/loot/biome/object references, malformed terrain grids, missing assets, duplicate asset paths, unused imported assets, and oversized files.
- Added a persistent unsaved-changes indicator and a Project control center with Validate, Snapshot, and Save actions.
- Project saves create lightweight pre-save JSON recovery snapshots under `builder-backups/` (ignored by Git and excluded from production deployment).

## v71 — Biome / Terrain Theme Manager

- Added a shared **Biome** theme library to `content/shared/content-library.json`; zones now select a biome independently from their World Beyond Zone surroundings type.
- Added a dedicated World Builder **Biomes** tab for creating/duplicating themes and assigning art to Grass, Safe Grass, Forest, Blocked Forest, Road, Dirt, Water, Sand, and Rock / Mountain.
- Added per-biome World Beyond Zone texture overrides plus an optional custom forest-tree sprite/scale.
- Fixed Dense Forest surroundings so the outer forest uses the same deterministic tree renderer, density, offsets, and active biome tree art as Blocked Forest at the playable map edge instead of the old circular placeholder canopy.
- Added **Terrain / Backdrop Texture** and **Biome Tree Sprite** import types. Imported environment art is copied to `assets/environment/biomes/`; previously imported non-built-in World Images can also be reused in biome slots.
- The Terrain Painter palette now previews assigned biome textures, and the active biome is shown in its summary/backdrop help.
- Strengthened Safe Grass editing visibility with a mint striped Builder-only overlay and larger `+` marker while leaving production visuals unchanged.
- Added runtime repeating-texture support for custom biome art while preserving the protected legacy terrain renderer as the fallback for empty slots.
- Added Biome Theme Manager regression coverage and migrated Starter Realm to the `temperate-forest` theme.

## v70 — Themed Zone Edges + Custom World Objects

- Added Builder-only Safe Grass visualization: safe tiles receive a clear translucent `+` overlay while the Terrain tab is open, without changing production appearance.
- Added per-zone **World Beyond Zone** surroundings: Grassland, Dense Forest, Open Water / Island, Desert / Dunes, and Rocky Mountains. The runtime now renders the selected theme beyond the playable grid instead of a generic green void.
- Added **Sand** (walkable) and **Rock / Mountain** (blocked) to the paintable terrain palette.
- Added **Match Outer 2-Tile Edge To Surroundings** and made Reset Blank respect the selected zone theme.
- Added a surroundings choice to New Zone creation; copied zones retain their source surroundings.
- Added reusable custom world-object templates to the shared Content Library.
- World Image assets can now be converted directly into placeable buildings/props from the Assets tab, then placed from the Objects tab with no hard-coded prop definition.
- Custom image objects use the existing move, collision/hitbox, depth/Y-sort, duplicate, delete, interactable, and container tools; display width/height are editable per placed instance.
- Added runtime rendering for custom image objects and regression coverage for themed backdrops, Safe Grass visualization, and the imported-object workflow.

## v69 — Terrain Editor + Starter Placeholder Cleanup

- Added a dedicated World Builder **Terrain** tab with click-and-drag painting, 1×1/3×3/5×5/7×7 brushes, live brush preview, and terrain tile counts.
- Added Grass, Water, Forest, Road, Safe Grass, Blocked Forest, and Dirt terrain choices; Forest types regenerate terrain-driven trees after painting.
- Added guarded **Fill Interior**, **Fill Entire Zone**, and **Reset to Blank Terrain** actions.
- Terrain edits persist directly in each zone pack's `terrain` grid through the existing Project Folder save workflow.
- Removed the hard-coded Starter Town / Farm / Slime Spawns / Goblin Camp / Snickers Cave map-name tags from every zone.
- Disabled the Starter Realm's engine-injected legacy houses, fence runs, and physical legacy signs; legacy scenery is now opt-in compatibility behavior only.
- Removed the remaining placeholder slime signpost from Starter Realm zone/config data so the old placeholder scenery can be rebuilt cleanly as editable objects.
- Added a reusable generated-terrain-scenery rebuild path so painting Forest/Blocked Forest updates their trees and tree collision without rebuilding placed props/NPCs.
- Added Terrain Editor regression coverage and kept all protected terrain/collision/combat/quest/loot/progression checks green.

## v68 — Project / Zone Manager

- Added a dedicated World Builder **Zones** tab for listing, creating, opening, renaming, setting-default, and deleting project zones.
- New zones can be blank maps or copies of the active zone, with configurable width, height, and player start tile.
- Made zone dimensions and player start data-driven instead of fixed 44×32 / tile 7,7 constants.
- Added a per-zone terrain grid to World Packs. The existing Starter Realm terrain was migrated exactly into its pack; blank zones begin as grass with a blocked forest border.
- Builder zone switching rebuilds terrain/scenery/spawns live without restarting the local server and saves the outgoing zone before switching.
- Project-folder save now persists the active zone, shared Content Library, and `content/little-realm.project.json` manifest together.
- The Starter Realm keeps its stable legacy houses/fences/signs, while newly created blank zones do not inherit that hard-coded scenery.
- Added Zone Manager regression coverage while preserving all protected rendering, collision, combat, quest, loot, and progression checks.

## v67 — Spawn Editor + Asset Importer

- Migrated starter mob locations into zone-owned `mobSpawns` data; production spawning now reads the active zone instead of relying on hard-coded positions.
- Added a World Builder **Spawns** tab for placing any shared Mob Type, selecting/moving spawn-home points, duplicating/deleting spawns, changing mob type/facing, and optional fixed spawn levels.
- Spawn markers are visible while editing and live mobs are rebuilt from the zone data so leash/home behavior can be tested immediately.
- Removed the starter-mob rename/delete restriction: mob IDs can now migrate safely once quest and spawn references are updated/cleared.
- Added a World Builder **Assets** tab and direct project-folder image importer. Mob/NPC/item art is copied into the correct `assets/` folder with collision-safe filenames.
- Added a shared asset registry and seeded the existing project art, with visual previews, filtering, path copying, and assignment to mob types, NPC templates, and items.
- Split Builder overlay rendering into its own module so the interaction module stays comfortably below the architecture size budget.
- Added Spawn/Asset regression coverage and updated zone validation for data-driven spawn locations.

## v66 — Shared Content Library

- Added `content/shared/content-library.json` as the reusable, Builder-owned content source.
- Added a new World Builder **Content** tab for NPC Templates, Mob Types, Items, and Loot Tables.
- NPC placement now uses reusable templates instead of three hard-coded palette buttons.
- Items and loot tables can be created, duplicated, renamed, edited, and deleted in the Builder with reference updates.
- Mob definitions can be created/edited in the Builder; custom 4×4 sprite paths are supported, and new definitions become available to quest objectives immediately.
- Project-folder save now writes both the active zone pack and shared Content Library. Browser drafts and portable backups include shared content too.
- Production and Builder loaders now read shared content from the project manifest while retaining `config/` compatibility fallbacks.
- Zone packs no longer own mob definitions; mob content is shared across zones.
- Added Content Library regression coverage and expanded the Builder modularity guard to 13 focused modules.

## v65 — Modular World Builder Source

- Split the authoritative World Builder source into 12 focused modules under `src/builder/`.
- Kept the local Builder dependency-free: `tools/build.py` still emits one `builder/game.js` bundle for the browser.
- Reduced `src/devmode.js` to a migration marker so editor growth no longer accumulates in one file.
- Added an automated Builder architecture budget (550 lines / 30 KB per module).
- Updated Builder/combat tests to validate the generated local Builder bundle after modularization.
- No gameplay or project-content behavior changes in this refactor.

## v64.1 - Local Builder launcher fix

- Removed the Python requirement from `start-world-builder.bat`.
- Added a dependency-free Windows PowerShell local static server for the Builder.

# Changelog

## v64 — Local World Builder Foundation

- Separated the full World Builder from the production game bundle; production now uses a tiny compatibility shim.
- Added a dedicated local Builder page and launcher that opens the editor automatically.
- Added `content/little-realm.project.json` plus a starter-zone World Pack under `content/zones/`.
- Added direct Chrome/Edge project-folder open/save support in the Builder, while keeping World Pack import/export as backup.
- Production now loads project content directly with `config/` files as compatibility fallbacks.
- GitHub Pages now deploys a generated production-only `dist/` artifact instead of the whole repository.
- Reduced the production game bundle from roughly 324 KB to about 191 KB.
- Changed service-worker caching so large game art is cached on demand instead of pre-cached during installation.
- Added automated size reporting and Builder-foundation validation.

## v61 — Mob Leashing + Health Reset

- Added a true combat leash/evade state. When a mob loses aggro, it no longer remains where combat ended; it runs back to its original spawn point.
- Mobs now immediately restore to full health when they lose aggro and begin returning home.
- Added a hard spawn-distance leash (`combat.mobLeashDistance`, default 260) in addition to the existing player-to-mob disengage range, preventing mobs from being dragged indefinitely around their spawn area.
- Returning mobs cannot be selected, attacked, or automatically re-aggro until they reach home, preventing reset/aggro ping-pong.
- Return movement uses at least the mob's chase speed so the reset reads as a run rather than slow wandering.
- Added a collision fail-safe so a returning mob that becomes wedged against scenery cannot remain stuck in the evade state forever.
- Added dedicated mob leash/health-reset regression coverage and bumped build/cache metadata to `v61-mob-leashing`.

## v60 — World Remnant Loot

- Replaced automatic mob loot popups with 60-second world dust remnants.
- Every defeated mob leaves a separate dust pile; piles with gold/items/potions use the sparkling remnant art.
- Gold and potion drops now remain in the pile instead of being awarded immediately; XP still awards on defeat.
- Clicking a nearby sparkling pile opens the existing compact loot list. Clicking each row collects that reward.
- Fully looted piles remain as plain dust until their original 60-second lifetime ends, with a subtle fade during the final 10 seconds.
- Integrated the latest uploaded World Builder pack across props, NPCs, quests, visual settings, and balance.
- Added optimized `assets/loot/dust.png` and `assets/loot/lootable-dust.png` artwork and offline caching.
- Bumped build/cache metadata to `v60-remnant-loot`.

# Little Realm Changelog

## v59 — Level Pace + Quest XP

- Replaced the old geometric player XP growth with the approved old-school 1–100 progression table: 400 XP for level 1→2, 209,800 XP for 59→60, and 616,400 XP for 99→100. Reaching level 100 now requires 20,118,900 total XP.
- Added a hard level cap of 100. The HUD shows `MAX LEVEL` at the cap, and older saves automatically recalculate their current `xpNext` from the new table.
- Standard hostile mob XP now follows the same-level pace from the reference curve: 50 XP at level 1 and +5 XP per mob level. Slimes, wolves, and goblins use the full rate; passive farm animals use reduced species multipliers; elite/boss and level-gap modifiers still apply.
- Added configurable mob XP multipliers and live same-level XP controls to World Builder combat tuning.
- Added quest levels, automatic minimum-level requirements, and a recommended quest range. By default a quest becomes available three levels below its intended quest level and remains permanently available afterward; e.g. a level-37 quest requires level 34 and is recommended through level 40.
- Added automatic quest XP profiles using same-level mob equivalents plus early-level percentage caps: Minor, Gather/Delivery, Standard, Multi-Objective, Elite, Dungeon, Boss, Story, Epic Finale, and Repeatable.
- Quest Maker now supports Automatic or Custom XP, shows the calculated XP/profile/cap, and recalculates rewards from the quest level instead of the player's turn-in level. Repeatable quests automatically use the repeatable XP profile.
- Updated the starter quests to the new automatic XP system and added a dedicated progression regression test.
- Bumped build/cache metadata to `v59-leveling-quest-xp`.

## v58.2 — Repository Structure Cleanup

- Removed 66 obsolete root-level duplicates left from the pre-folder project layout. Runtime code, source modules, configs, tests, documentation, and assets now have one authoritative location.
- Removed unused legacy root artifacts (`house-atlas.png`, `house_A.png`, `house_B.png`, and the old root `static.yml`).
- Expanded project hygiene validation to catch duplicate root files that shadow organized files under `assets/`, `config/`, `docs/`, `js/`, `src/`, or `tools/`.
- Replaced the release-note-only migration helper with `tools/cleanup-legacy.py`, which safely removes both known old update notes and known pre-v58.2 root duplicates after an in-place upgrade.
- Corrected the README/workflow policy: GitHub Actions validates the repository but does not silently mutate source files; cleanup is an explicit migration step.
- Bumped build/cache metadata to `v58.2-repository-cleanup`. No gameplay, balance, world content, quest behavior, combat behavior, or save mechanics were intentionally changed.

Release history is kept here so the project root stays clean. New entries should be added at the top; do not create a separate update-note `.txt` file for each release.

## v58.1 — Project Cleanup Migration Fix

- Fixed an in-place-upgrade edge case: copying/extracting v58 over an older project does not remove files that no longer exist in the archive, so legacy root release-note `.txt` files could remain and make the new hygiene validation fail.
- Added a safe allow-listed migration helper for removing known pre-v58 release-note files after in-place upgrades.
- Kept the hygiene test strict so root-level `.txt` clutter is caught during validation.
- No gameplay, balance, content, rendering, save-format, or World Builder behavior changed.

## v58 — Project Cleanup

- Consolidated the accumulated release/update `.txt` files into this single changelog.
- Added a root `README.md` with the current project structure, run instructions, development workflow, World Pack workflow, and documentation policy.
- Kept current system documentation under `docs/` rather than mixing temporary patch notes with runtime files.
- Added `tools/project-hygiene-test.py` and wired it into `tools/validate.py` so future root-level `.txt` update-note buildup is caught automatically.
- Bumped build/cache metadata to `v58-project-cleanup`; no gameplay mechanics, balance, world layout, or content behavior were intentionally changed.

## v57 — Cleanup + Polish

### Reliability
- Hardened save/load against malformed numeric/object data and unavailable `localStorage`.
- Invalid or blocked saved coordinates fall back to the normal starter spawn rather than entering live world state.
- Loading refreshes `lastSafePos` and resets the combat HUD render cache.
- Preserved multi-prerequisite quest arrays during quest normalization.
- Quest Log is re-constrained when opened and whenever the viewport changes, preventing a dragged panel from becoming stranded off-screen.

### Performance
- Inventory normalization runs only when a new inventory array enters state instead of rebuilding slots during every count/capacity query.
- Combat floating-text FX are compacted in place instead of allocating a filtered array every frame.
- Combat HUD DOM work is skipped when visible HUD state has not changed.
- World depth-sort wrapper records are pooled/reused instead of allocating new wrapper objects for every visible entity every frame.

### UI polish and validation
- Long quest titles wrap safely without colliding with READY/Track controls.
- Track controls received a slightly larger touch target.
- Narrow-screen quest headers align cleanly when titles wrap.
- Added `tools/maintenance-test.js` for maintenance edge cases/performance guards.
- Expanded floating UI regression coverage to include the Quest Log.

## v56 — Quest Tracking UI

- Active quests are tracked on the side by default.
- Each quest in the Quest Log has a Track checkbox that can hide/show it from the HUD tracker.
- Multiple tracked quests render simultaneously.
- Multi-objective quests show every objective in the HUD tracker.
- Completed objectives use a check mark and muted success styling.
- Active Talk objectives place a grey `?` above NPCs that still need to be spoken to.
- Gold `!` remains the available-quest marker; gold `?` remains the ready-to-turn-in marker.
- Integrated the uploaded v55 World Pack containing Mayor Buck and Welcome Traveler.

## v55 — NPC Selection + Placeholder Model

- Replaced the programmatic blank NPC with `assets/npcs/npc-placeholder.png`.
- Empty/legacy NPC sprite paths normalize to the placeholder sprite automatically.
- Sprite Height updates NPCs live, including the placeholder.
- Selection tab lists both props and NPCs.
- NPC selection includes model, facing, size, visual hitbox editing, and visual depth-line editing.
- NPCs support `depthMode`/`depthY` in runtime rendering to repair house/prop overlap.
- Integrated the uploaded World Pack into project configs.
- World Pack export identifies the build used to create it.

## v54 — Quest Builder + World Pack

### Quests and NPCs
- Added Lilly and Jorge NPC sprite sheets to the town.
- Added config-driven NPC placement in `config/npcs.js`.
- Added data-driven quests in `config/quests.js` and `src/quests.js`.
- Added NPC conversations, quest markers, quest acceptance/turn-in, rewards, saved progress, and a compact quest log.
- Added Kill, Collect, Talk, Deliver, and Visit objectives.
- Added the first two starter quests: Lilly's Slime Samples and Jorge's Slime Problem.
- Added **E** as the keyboard Talk / Interact key; NPCs can also be clicked/tapped.

### World Builder
- Added an NPC tab for placing Lilly/Jorge/blank NPCs, moving them visually, and editing properties.
- Added a Quest Maker with NPC dropdowns, objective editors, rewards, prerequisites, quest chains, repeatable toggle, and test-progress reset.
- Added a Project tab with a single World Pack export/import workflow.
- World Builder local drafts save props + NPCs + quests + visual settings + combat tuning together.
- Existing v1 prop-only local drafts remain loadable.
- Individual config exports remain available.

## v53 — Depth Sort Editor

- World Builder added per-object Depth Mode: Y-Sort, Always Behind Player, Always In Front of Player, and Ground / Floor.
- Y-Sort uses a draggable purple depth line based on the player's feet.
- Depth lines can move outside the blue sprite bounds; collision hitboxes remain constrained to the sprite.
- Default Y-Sort depth derives from the bottom of each object hitbox for natural top-down overlap.
- Updated `config/world-objects.js` with the current exported object positions/hitboxes for that build.
- Existing visual hitbox editor remained intact.

## v52 — Visual Hitbox Editor

- Select any world object and use **Edit Hitbox Visually**.
- Drag inside the yellow hitbox to reposition it.
- Drag corners or side handles to resize it.
- Changes update collision live and autosave to the World Builder draft on release.
- Editing is pixel-precise; object-placement Snap does not affect hitbox adjustments.
- Numeric X/Y/W/H hitbox fields remain available for exact/manual edits.
- Hitbox resizing stays inside the selected sprite's bounds.

## v51 — Compact Floating Backpack + Loot UI

- Backpack became a compact 5×4 item-only panel with a small close button.
- Loot became a compact item list; click an item to take it.
- Backpack and loot panels can be dragged anywhere on screen by their title bars.
- Panel positions persist locally on the device/browser.
- Backpack and loot are non-modal: movement, targeting, combat, mob AI, and respawns continue while open.
- Backpack and loot can be open at the same time.
- Loot dragging to an open backpack slot remains supported.
- Inventory slot rearranging and drag-out disposal confirmation remain supported.
- New mob drops merge with existing unclaimed loot when the loot window is already open.
- Closing the loot window abandons unclaimed drops.
- Disposal confirmation remains modal for safety.

## v50 — Loot Window + Backpack Drag/Drop

- Mob item drops open a loot window instead of entering the backpack automatically.
- XP, gold, and legacy potion rewards remain automatic.
- Loot can be clicked to auto-stack or dragged into a specific backpack slot.
- Take All collects everything that fits.
- Closing the loot window leaves/discards uncollected drops.
- Backpack stacks can be moved, swapped, and combined by dragging between slots.
- Dragging a backpack stack outside the active bag panel opens a disposal confirmation.
- Confirmed disposal removes the entire dragged stack.
- Mob AI paused while loot/disposal UI was open at this stage; later floating-UI work changed the loot window to non-modal.

## v49 — Slime Gel

- Added Slime Gel item definition.
- Added a 70% Slime Gel drop chance to the slime loot table.
- Successful drops grant 1–2 Slime Gel.
- Slime Gel stacks to 50.
- Added item artwork support to backpack slots and item details.
- Artwork: `assets/items/slime-gel.png`.
- Added validation that configured artwork files exist.

## v48 — Loot Foundation

- Added data-driven item metadata fields for rarity, value, and tags.
- Added `config/loot-tables.js` with tables for current mobs.
- Added `src/loot.js` and stable `window.LR_LOOT` APIs.
- Mob victories roll their configured loot table and grant through the backpack system.
- Full-backpack overflow is reported instead of silently counted as collected.
- Added loot documentation and automated regression coverage.
- Existing XP, gold, potion rewards, terrain, collision, camera, and combat balance remained unchanged.

## v47 — Polish Pass

- Refined HUD, menus, buttons, bars, quest state, and low-HP feedback.
- Added target threat/rank and live DEF / player hit chance to the target HUD.
- Improved damage-number colors for incoming damage, miss, heal, and crit states.
- Improved selected-mob name/level presentation and scale-aware ground shadows.
- Updated stale build/cache/version markers.
- Preserved world layout, visual settings, mob art, mob levels, elites, boss rules, combat tuning lab, and rebalanced `game-balance.js`.

## v46 — Combat Rebalance

- Integrated the user-tuned `game-balance.js` as the new project baseline.
- Hostile mobs became substantially tougher at equal level.
- Goblins remained stronger than wolves.
- Snickers kept the stronger boss multipliers from the tuned balance file.
- Combat Test / World Builder tuning remained available for further iteration.

## v45 — Combat Tuning Startup Fix

- Combat Test panel tolerates the pre-reset startup phase.
- Opening Developer Mode refreshes live Combat Test values after player state exists.
- Prevented Developer Mode UI from stopping `reset()` / `requestAnimationFrame` startup.

## v44 — Combat Tuning Lab

- Added a fourth World Builder tab: Combat Test.
- Player Test Level supports Lv 1–200 instantly, with quick buttons through Lv 100.
- Added per-species live tuning for level range, base HP/damage/armor/XP, elite chance, attack speed, aggro, and chase speed.
- Added global live tuning for level growth, high-level danger boosts, elite/boss multipliers, aggro scaling, hit/miss, and XP rules.
- Added reroll controls for one species or all mob levels/elites without reloading.
- Live preview displays HP, damage, armor, XP reward, hit chances, aggro range, and rank.
- Added `game-balance.js` export from Developer Mode and reset-to-project-balance behavior.

## v43 — Mob Level Combat Expansion

- Goblins became stronger/higher-level than wolves.
- Trivial mobs always award XP; at 5+ player levels above a mob, reward is exactly the mob level.
- Added level-based aggro radius.
- Added level-based hit/miss chances for player and mobs.
- Added rare Elite normal mobs with boosted HP, attack, armor, XP, gold, and aggro range.
- Elites are labeled in the world and target HUD.
- Tuning lives in `config/game-balance.js`.

## v42 — Mob Levels

- Individual mobs gained levels.
- Spawn points use stable levels within a species range.
- Level scales HP, attack, armor/defense, and base XP.
- Bosses use independent HP/attack/armor/XP multipliers.
- Mobs 4+ levels above the player get stacking danger bonuses.
- XP rewards fall off for lower-level mobs and become zero at 5+ levels below the player at this stage; v43 later changed trivial-mob XP behavior.
- Target HUD and selected world mobs display level with danger coloring.
- Tuning lives in `config/game-balance.js` under `mobLevels` and each mob's level settings.

## v41 — Visual Settings Update

- Applied the uploaded visual settings as the new default visual-scale baseline.
- Cow 0.85×, Pig 0.65×, Chicken 0.50×, Slime 0.50×, Snickers 1.85×.

## v40 — Slime Direction Fix

- Fixed slime left/right sprite-row mapping.
- Slimes face the same direction they are moving.
- Added a regression check for slime side-direction mapping.

## v39 — Mob Grounding Fix

- Mob sprite frames calculate actual alpha/visible bounds at runtime.
- Visible feet are anchored to the ground instead of transparent cell padding.
- Applies to slime, wolf, goblin, Snickers, cow, pig, and chicken.
- Preserved the v37 smooth-facing/pathing fixes and v38 farm-animal models.

## v38 — Farm Animal Refresh

- Implemented new pig, chicken, and cow sprite sheets.
- Passive farm mobs use animated 4×4 sprite sheets in world and battle.
- Updated visual settings from the supplied project config.
- Improved sprite-sheet frame slicing to handle non-divisible sheet sizes cleanly.

## v37 — Mob Motion Stabilization

- Normal walking cycles use frames 1–3; action frame 4 is attack-only.
- Idle mobs stay on the idle frame.
- Mob facing uses hysteresis and a short hold before changing direction.
- Wanderers no longer bounce direction every frame when caught on scenery.
- Added a regression test for mob-motion stability.

## v36 — Bear + Slime Art Update

- Replaced the Snickers bear sprite sheet.
- Replaced the slime sprite sheet.
- Bumped the service-worker cache name so new mob art refreshes correctly.

## v34 — World Builder Tab Fix

- Fixed World Builder tabs appearing empty.
- Cause was a hidden-view CSS selector with higher specificity than the active-view selector.
- The active tab displays correctly, with `tools/devmode-test.js` guarding against regression.
- Retained the v33 wolf/goblin sprite fixes and current custom world/visual settings.

## v33 — Wolf + Goblin Sprite Fix

- Replaced wolf sprite sheet with the fixed 96×96 sheet.
- Replaced goblin sprite sheet with the fixed 96×96 sheet.
- Bumped the service-worker cache name so browsers pull the new art.

## v26 — Clean Prop Sheet

- Mapped the new prop sheet using tight per-sprite source rectangles instead of a uniform grid crop.
- Existing object IDs, display sizes, positions, and hitboxes remained compatible.
- Existing customized `config/world-objects.js` layouts did not need replacement for the art update.

## Historical maintenance — GitHub Actions cleanup

This note was not given a release version in the original update files.

- `.github/workflows/static.yml` is the canonical Pages workflow.
- Old Little Realm Pages workflow files should be removed rather than kept beside the canonical workflow.
- `python3 tools/workflow_audit.py` checks for obsolete action references and reports the offending workflow file.
