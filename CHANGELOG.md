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
