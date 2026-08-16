/*
  Little Realm — loot tables
  --------------------------
  Mob loot is configured here, separately from combat balance and item data.
  Each mob automatically looks for the table matching its config key unless a
  different `lootTable` key is set on that mob in config/game-balance.js.

  Add the item to config/items.js FIRST, then add an entry here.

  Entry fields:
    itemId          Key from window.LR_ITEMS. Required.
    chancePercent   Independent chance for this entry to drop (0–100).
    minQty           Minimum quantity when the roll succeeds. Default 1.
    maxQty           Maximum quantity when the roll succeeds. Default minQty.
    requiresElite    Optional. Only elites can roll this entry.
    requiresBoss     Optional. Only bosses can roll this entry.
    minLevel         Optional minimum mob level.
    maxLevel         Optional maximum mob level.

  Example:
    slime: [
      { itemId: "slimeGel", chancePercent: 70, minQty: 1, maxQty: 2 }
    ]

  Slime Gel is the first live loot item. Other default mob tables remain empty
  until more item content is added.
*/
window.LR_LOOT_TABLES = {
  slime: [
    { itemId: "slimeGel", chancePercent: 70, minQty: 1, maxQty: 2 }
  ],
  goblin: [],
  wolf: [],
  cow: [],
  pig: [],
  chicken: [],
  snickers: []
};
