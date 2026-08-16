# Little Realm quests and NPCs

Quest content is data-driven and is intended to be authored through **World Builder (F2) → Quests** rather than by editing gameplay code.

## Project files

- `config/npcs.js` — NPC placement, sprite, facing, greeting, role, collision, and interaction radius.
- `config/quests.js` — quest definitions, objectives, NPC links, dialogue, rewards, prerequisites, and chains.
- `src/quests.js` — generic quest runtime, progress tracking, NPC dialogue, quest markers, quest log, and objective event hooks.
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

NPCs show `!` when they have an available quest and `?` when they can receive a completed quest.

## Starter quests

The v54 content seeds two quests for testing the system:

1. **Lilly's Slime Samples** — collect 3 Slime Gel and return to Lilly.
2. **Jorge's Slime Problem** — after Lilly's quest, defeat 5 slimes and return to Jorge.

These intentionally exercise inventory objectives, kill objectives, prerequisites, rewards, NPC markers, dialogue, and turn-ins.

## Save data

Quest progress is stored under `state.quests` in the normal player save. Quest definitions are not copied into the save, so content can continue to be edited independently in `config/quests.js` / World Builder.
