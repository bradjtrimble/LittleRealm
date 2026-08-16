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

- `locked` — prerequisite has not been completed.
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

## Current integrated quest content

The v56 World Pack contains four quests:

1. **Welcome Traveler** — Mayor Buck asks the player to speak with Lilly, Jorge, Farmer, Rhea, and Torren.
2. **Lilly's Slime Samples** — after Welcome Traveler, collect 20 Slime Gel and return to Lilly.
3. **Jorge's Slime Problem** — after Welcome Traveler, defeat 5 slimes and return to Jorge.
4. **Wolf Hunt** — the Farmer asks the player to defeat 15 wolves.

## Save data

Quest progress is stored under `state.quests` in the normal player save. Quest definitions are not copied into the save, so content can continue to be edited independently in `config/quests.js` / World Builder.
