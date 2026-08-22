# Little Realm quests and NPCs

Quest content is authored through **World Builder → Quests**. Placed NPCs and quests belong to their zone pack; NPC artwork is selected directly from shared NPC Sprite assets.

## Project data

- `content/zones/<zone-id>/world-pack.json` — placed NPCs and quest definitions for that zone.
- `content/shared/content-library.json` — Mob Types and Items referenced by quests.
- `src/quests.js` — generic quest runtime/progress/dialogue/markers/objective hooks.
- `assets/npcs/` — NPC artwork.

## Supported objective types

- **Kill** — defeat a selected Mob Type.
- **Collect** — possess a selected Item; optionally consume it on turn-in.
- **Talk** — speak with a selected NPC.
- **Deliver** — bring an Item to the turn-in NPC.
- **Visit** — enter a circular world position trigger.
- **Interact With Object** — use an object carrying a matching interaction tag.

## Quest states and tracking

The runtime derives locked, available, active, ready, and completed states from the definition and `state.quests`. Active quests are tracked by default, can be independently hidden from the HUD, and multi-objective quests display each objective separately.

NPC markers include Gold `!` for available quests, Gold `?` for ready turn-ins, and Grey `?` for incomplete Talk objectives.

## Levels and automatic XP

Every quest has an intended level. Automatic minimum level defaults to **quest level − 3** (never below 1), with no maximum acceptance level. Automatic XP is based on the quest's intended level and reward profile rather than the player's turn-in level. Custom minimum-level and XP modes remain available for exceptional content.

Quest progress is saved; quest definitions remain in project content and are not copied into the player save.
