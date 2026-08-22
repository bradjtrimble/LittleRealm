# Backpack / Inventory

Little Realm uses a slot-based backpack with stacking, exact-slot placement, rearranging, and disposal.

- Slot count: `config/game-balance.js` → `inventory.slots`
- Default stack size: `config/game-balance.js` → `inventory.defaultStackLimit`
- Item definitions and stack overrides: `content/shared/content-library.json` → `items` (normally edited in World Builder → Content)
- Runtime module: `src/inventory.js`
- Player inventory is saved in `state.inventory`.

## Drag behavior

- Drag a stack to an empty slot to move it.
- Drag onto the same item to combine stacks up to the item's limit.
- Drag onto a different item to swap slots.
- The same backpack behavior works while the loot window is open.
- Drag outside the active backpack/loot panel to request disposal; confirmation is required.

## Runtime API

`window.LR_INVENTORY` exposes add/remove/count/capacity/slot placement/movement/disposal helpers for gameplay systems.
