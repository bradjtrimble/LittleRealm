# Backpack / Inventory

Little Realm v20 adds a slot-based backpack foundation for future mob drops.

- Slot count: `config/game-balance.js` → `inventory.slots`
- Default stack size: `config/game-balance.js` → `inventory.defaultStackLimit`
- Item names/descriptions/stack overrides: `config/items.js`
- Runtime module: `src/inventory.js`
- Player inventory is saved in `state.inventory`. Existing saves are upgraded to an empty backpack automatically.

Future drop code should call `addItem(itemId, quantity)` and check the returned `remaining` value rather than mutating inventory slots directly.

The global diagnostic API `window.LR_INVENTORY` exposes add/remove/count/capacity helpers for testing.
