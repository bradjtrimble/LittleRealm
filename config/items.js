/*
  Little Realm — item catalog
  ---------------------------
  Define every inventory item here. Loot tables reference items by their key,
  so add an item here first and then place that key in config/loot-tables.js.

  Supported fields:
    name         Display name.
    description  Backpack inspection text.
    symbol       1–2 character fallback icon used by the current UI.
    category     Material, Weapon, Armor, Consumable, Quest, etc.
    rarity       Common, Uncommon, Rare, Epic, Legendary, or your own label.
    stackLimit   Maximum quantity per backpack slot.
    sellValue    Base vendor value reserved for the future shop/economy system.
    tags         Free-form labels reserved for crafting, equipment, quests, etc.

  Example:
    slimeGel: {
      name: "Slime Gel",
      description: "A springy glob left behind by a slime.",
      symbol: "G",
      category: "Material",
      rarity: "Common",
      stackLimit: 50,
      sellValue: 1,
      tags: ["slime", "crafting"]
    }
*/
window.LR_ITEMS = {
  // Add item definitions here.
};
