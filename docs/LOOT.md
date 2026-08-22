# Loot System

Items and loot tables are ordinary shared project content in `content/shared/content-library.json` and are intended to be edited through **World Builder → Content** or the Mob editor's **Drops & Rewards** section.

## World-remnant flow

1. A defeated mob leaves a separate dust remnant at its death position.
2. XP is awarded immediately.
3. Gold, potion drops, and rolled item drops are stored in that remnant.
4. A remnant with loot uses the animated lootable-dust sprite; an empty/looted remnant uses plain dust.
5. Remnants last 60 seconds and fade during their final 10 seconds.
6. Clicking/tapping a nearby sparkling remnant opens the compact loot list.
7. Separate deaths create separate remnants; loot piles are not merged.
8. When the final reward is taken, the remnant becomes plain dust for the remainder of its lifetime.

## Mob authoring

A Mob Type directly exposes gold chance/range, potion chance/quantity, and item-drop rows. The Builder stores item-drop rows in a Loot Table and links that table to the mob automatically, so normal mob authoring does not require manually managing table IDs.

Each item-drop row can define `itemId`, `chancePercent`, `minQty`, `maxQty`, and optional elite/boss-only rules.

## Runtime API

`window.LR_LOOT` exposes loot-table rolling/grant helpers and world-remnant helpers used by gameplay and Builder tools.
