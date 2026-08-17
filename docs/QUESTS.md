# Little Realm quests and NPCs

Quest content is data-driven and is intended to be authored through **World Builder (F2) → Quests** rather than by editing gameplay code.

## Project files

- `config/npcs.js` — NPC placement, sprite, facing, greeting, role, collision, and interaction radius.
- `config/quests.js` — quest definitions, objectives, NPC links, dialogue, rewards, prerequisites, and chains.
- `src/quests.js` — generic quest runtime, progress tracking, NPC dialogue, quest markers, quest log, HUD tracking, and objective event hooks.
- `assets/npcs/` — NPC sprite sheets.

## Supported objective types

- **Kill** — defeat a number of a selected mob type.
- **Collect** — possess a number of a selected item. Items can be consumed when the quest is turned in.
- **Talk** — speak with a selected NPC.
- **Deliver** — bring a number of a selected item to the turn-in NPC; items are consumed by default.
- **Visit** — enter a circular world position trigger. World Builder can capture the player's current coordinates for this objective.

## Runtime quest states

The runtime derives these states from the definition and player save data:

- `locked` — prerequisite has not been completed **or** the player has not reached the quest minimum level.
- `available` — can be accepted from the quest giver.
- `active` — accepted and still in progress.
- `ready` — all objectives are satisfied and the quest can be turned in.
- `completed` — finished for non-repeatable quests.

NPC markers use three states:

- Gold `!` — an available quest can be accepted.
- Gold `?` — an active quest is ready to turn in here.
- Grey `?` — an incomplete Talk objective currently asks the player to speak with this NPC.

## Quest tracking

Accepted quests are tracked on the side of the screen by default. Every active quest in the Quest Log has a **Track** checkbox. Unchecking it hides that quest from the HUD tracker without abandoning or changing its progress. Multiple quests can be tracked at the same time, and every objective in a multi-objective quest is shown independently.

Tracking preference is stored with runtime quest progress in `state.quests`. Older saves that do not yet have a `tracked` flag treat active quests as tracked by default.


## Quest levels and automatic XP (v59)

Every quest has an intended `level`. World Builder uses an automatic minimum-level rule by default: **quest level − 3**, never below level 1. A level-37 quest therefore becomes available at level 34. The recommended range extends three levels above the intended level (34–40 in that example), but there is **no maximum acceptance level**; players can always return to older content. The minimum can be switched to Custom per quest.

Automatic quest XP is calculated from the **quest level**, not the player's current level at turn-in. This prevents saving low-level quests for high-level rewards. The XP profiles are:

- Minor / Talk / Discovery — 3 same-level mobs, capped at 5% of the level.
- Gather / Delivery — 5 mobs, capped at 8%.
- Standard — 8 mobs, capped at 12%.
- Multi-Objective — 12 mobs, capped at 15%.
- Elite / Mini-Boss — 18 mobs, capped at 20%.
- Dungeon — 25 mobs, capped at 25%.
- Major Boss — 35 mobs, capped at 30%.
- Main Story — 30 mobs, capped at 25%.
- Epic Finale — 50 mobs, capped at 40%.
- Repeatable — 5 mobs, capped at 8%; automatic repeatable quests always use this profile.

World Builder exposes **Automatic** and **Custom** XP modes. Automatic is recommended for normal content; Custom remains available for exceptional rewards.

## Current integrated quest content

The v59 World Pack contains four starter quests:

1. **Welcome Traveler** — Mayor Buck asks the player to speak with Lilly, Jorge, Farmer, Rhea, and Torren.
2. **Lilly's Slime Samples** — after Welcome Traveler, collect 20 Slime Gel and return to Lilly.
3. **Jorge's Slime Problem** — after Welcome Traveler, defeat 5 slimes and return to Jorge.
4. **Wolf Hunt** — the Farmer asks the player to defeat 15 wolves.

## Save data

Quest progress is stored under `state.quests` in the normal player save. Quest definitions are not copied into the save, so content can continue to be edited independently in `config/quests.js` / World Builder.
