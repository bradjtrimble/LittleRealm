/*
  Little Realm — item catalog
  ---------------------------
  Define every inventory item here. Loot tables reference items by their key,
  so add an item here first and then place that key in config/loot-tables.js.

  Supported fields:
    name         Display name.
    description  Backpack inspection text.
    symbol       1–2 character fallback icon used when no artwork is set.
    icon         Optional image path shown in the backpack UI.
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
      icon: "./assets/items/slime-gel.png",
      category: "Material",
      rarity: "Common",
      stackLimit: 50,
      sellValue: 1,
      tags: ["slime", "crafting"]
    }
*/
window.LR_ITEMS = {
  slimeGel: {
    name: "Slime Gel",
    description: "A small glossy blob of bright lime-green translucent slime gel, slightly irregular in shape, with a few tiny bubbles inside and bright white highlights.",
    symbol: "G",
    icon: "./assets/items/slime-gel.png",
    category: "Material",
    rarity: "Common",
    stackLimit: 50,
    sellValue: 1,
    tags: ["slime", "crafting"]
  }
};
