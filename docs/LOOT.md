# Loot foundation

Little Realm now keeps loot content separate from combat logic.

## Where to add content

1. Add the item definition to `config/items.js`.
2. Add that item ID to one or more tables in `config/loot-tables.js`.
3. Refresh the game. Both config files are loaded fresh at startup, so item and drop-table edits do not require rebuilding `js/game.js`.

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

Each entry rolls independently. A successful roll is added through the backpack API, so normal stacking and slot limits apply automatically.

Optional entry conditions are `requiresElite`, `requiresBoss`, `minLevel`, and `maxLevel`.

## Mob-to-table mapping

By default each mob uses its balance config key as its loot-table key: `slime`, `goblin`, `wolf`, `cow`, `pig`, `chicken`, and `snickers`.

If a mob ever needs a different table, add a string such as `lootTable: "forestGoblin"` to that mob's block in `config/game-balance.js`, then create a matching table in `config/loot-tables.js`.

## Runtime API

`window.LR_LOOT` exposes stable helpers for future systems:

- `getTable(tableId)`
- `rollTable(tableId, context)`
- `grantDrops(drops)`
- `grantMobLoot(mob)`
- `formatDrops(drops)`
- `validate()`

This lets future chests, gathering, quests, fishing, bosses, or scripted rewards use the same loot pipeline instead of modifying inventory directly.

## Current behavior

Slimes now have the first live loot entry: **Slime Gel** at a 70% independent drop chance for **1–2** gel. The other default mob tables remain empty. Existing XP, gold, and potion rewards are unchanged. Successful item drops are placed in the backpack automatically. If the backpack cannot hold the full quantity, the victory message reports the uncollected overflow instead of silently claiming it was received.

Item definitions can also set an optional `icon` path. When present, the backpack shows that artwork in the slot and item-details panel; `symbol` remains the fallback for items without artwork.
