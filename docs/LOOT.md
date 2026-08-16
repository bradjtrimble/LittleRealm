# Loot system

Little Realm keeps loot content separate from combat logic. Mob deaths roll item drops, then the player decides whether to collect them from the loot window.

## Where to add content

1. Add the item definition to `config/items.js`.
2. Add that item ID to one or more tables in `config/loot-tables.js`.
3. Refresh the game. Both config files are loaded fresh at startup, so routine item and drop-table edits do not require rebuilding `js/game.js`.

## Item example

```js
slimeGel: {
  name: "Slime Gel",
  description: "A springy glob left behind by a slime.",
  symbol: "G",
  icon: "./assets/items/slime-gel.png",
  category: "Material",
  rarity: "Common",
  stackLimit: 50,
  sellValue: 1,
  tags: ["slime", "crafting"]
}
```

## Drop example

```js
slime: [
  { itemId: "slimeGel", chancePercent: 70, minQty: 1, maxQty: 2 }
]
```

Each entry rolls independently. Optional entry conditions are `requiresElite`, `requiresBoss`, `minLevel`, and `maxLevel`.

## Player loot flow

- XP, gold, and legacy potion rewards are awarded immediately when the mob is defeated.
- Item drops are rolled but are **not** placed directly in the backpack.
- If at least one item rolls, the loot window opens.
- Clicking a loot item takes it using normal auto-stacking.
- Dragging a loot item onto a backpack slot places as much as possible into that exact slot. The target must be empty or already contain the same item.
- **Take All** collects everything that fits.
- **Leave Remaining Loot** closes the window and abandons anything still there.
- The world mob AI pauses while the loot window or disposal confirmation is open.

## Mob-to-table mapping

By default each mob uses its balance config key as its loot-table key: `slime`, `goblin`, `wolf`, `cow`, `pig`, `chicken`, and `snickers`.

If a mob needs a different table, add a string such as `lootTable: "forestGoblin"` to that mob's block in `config/game-balance.js`, then create a matching table in `config/loot-tables.js`.

## Runtime API

`window.LR_LOOT` exposes helpers for future systems:

- `getTable(tableId)`
- `rollTable(tableId, context)`
- `rollMobLoot(mob)` — roll only; does not touch inventory
- `grantDrops(drops)` — direct scripted grant
- `grantMobLoot(mob)` — compatibility helper for scripted direct grants
- `openWindow(drops, sourceLabel)`
- `closeWindow()`
- `takeAt(index, targetSlot?)`
- `takeAll()`
- `getPending()`
- `formatDrops(drops)`
- `validate()`

## Current live loot

Slimes have the first live loot entry: **Slime Gel** at a 70% independent drop chance for **1–2** gel. Other default mob tables remain empty.

## v51 floating loot UI

Mob item drops open a small, non-modal loot panel that contains only the dropped items and a close button. Clicking a loot item transfers it into the backpack. The loot panel can be moved by dragging its title bar and can remain open during normal gameplay. If more loot drops before the window is closed, new drops merge into the pending list so unclaimed loot is not overwritten. If the backpack is also open, loot can still be dragged directly into a chosen inventory slot. Closing the loot window abandons all remaining pending loot.
