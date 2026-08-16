# Backpack / Inventory

Little Realm uses a slot-based backpack that supports stacking, exact-slot placement, rearranging, and disposal.

- Slot count: `config/game-balance.js` → `inventory.slots`
- Default stack size: `config/game-balance.js` → `inventory.defaultStackLimit`
- Item names/descriptions/stack overrides: `config/items.js`
- Runtime module: `src/inventory.js`
- Player inventory is saved in `state.inventory`. Existing saves are upgraded to an empty backpack automatically.

## Drag behavior

- Drag a backpack stack onto an empty slot to move it.
- Drag it onto the same item to combine stacks up to that item's stack limit.
- Drag it onto a different item to swap the two slots.
- While the loot window is open, the same backpack drag behavior works in the embedded bag grid.
- Drag a backpack stack outside the active backpack/loot panel to request disposal.
- Disposal always asks for confirmation and removes the entire dragged stack only after the player confirms.

## Loot placement

Loot can target an exact backpack slot through `placeItemInInventorySlot`. An external loot stack can enter an empty slot or merge with the same item. It will not displace a different backpack item; the player must move that item first.

## Runtime API

`window.LR_INVENTORY` exposes:

- `addItem(itemId, quantity)`
- `removeItem(itemId, quantity)`
- `getItemCount(itemId)`
- `canAddItem(itemId, quantity)`
- `getUsedSlots()`
- `getSlotCount()`
- `getSlots()`
- `placeInSlot(itemId, quantity, slotIndex)`
- `moveSlot(fromIndex, toIndex)`
- `disposeSlot(slotIndex)`
- `requestDispose(slotIndex)`

## v51 floating backpack UI

The backpack is a compact, non-modal 5x4 panel. It can stay open while the player moves, targets mobs, and fights. Drag the title bar to reposition it; the browser stores that position locally. Drag item stacks between slots to organize them. Dragging a stack outside the backpack still opens the disposal confirmation.
