# Loot System

Little Realm uses data-driven item definitions (`config/items.js`) and per-mob loot tables (`config/loot-tables.js`).

## v60 world-remnant flow

Mob deaths no longer open the loot panel automatically and item/gold drops do not go directly into the backpack.

1. A defeated mob always leaves a separate dust remnant at its death position.
2. XP is awarded immediately.
3. Gold, potion drops, and rolled item drops are stored inside that specific remnant.
4. A remnant with anything to collect uses the animated 4×4 sprite sheet at `assets/loot/lootable-dust.png`; an empty or fully looted remnant uses `assets/loot/dust.png`.
5. Remnants last exactly 60 seconds from creation. They fade during the final 10 seconds and then despawn.
6. Clicking/tapping a nearby sparkling remnant opens the compact floating loot list. Rewards are collected by clicking their row. Item rows can still be dragged into a chosen backpack slot.
7. Separate mob deaths always create separate remnants. Loot is never merged between piles.
8. When the final reward is taken, the loot list closes and the remnant becomes plain dust for the rest of its lifetime.

The interaction range is intentionally short so looting remains a world interaction instead of remote collection.

## Item definitions

Each item is defined under `window.LR_ITEMS`. Common fields include `name`, `description`, `icon`, `category`, `rarity`, `stackLimit`, `sellValue`, and `tags`.

## Loot table entries

Each table entry can define `itemId`, `chancePercent`, `minQty`, `maxQty`, and optional level/elite/boss conditions. `rollMobLoot()` only rolls item-table entries; gold and potion drops continue to use the mob balance configuration before being placed into the death remnant.

## Stable API

`window.LR_LOOT` exposes table rolling/grant helpers plus remnant helpers such as `spawnPile`, `spawnMobPile`, `getPiles`, `pileHasLoot`, `openPile`, `updatePiles`, and `clearPiles` for developer tools and future systems.


## World Builder remnant preview

The Selection Library exposes temporary **Dust** and **Lootable Dust** previews. Drag a preview around the world while tuning the shared remnant scale and depth/Y-sort anchor. Preview positions are editor-only; only the visual settings are exported and applied to runtime mob-death piles.
