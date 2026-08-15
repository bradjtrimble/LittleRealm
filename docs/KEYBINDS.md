# Little Realm PC keybinds

Keyboard bindings are configured in `config/keybinds.js` and load directly in the browser. You can edit and push only that file; rebuilding `js/game.js` is not required.

Default controls:

- Move: W/A/S/D or arrow keys
- Cycle nearby target: Tab (Shift+Tab cycles backward)
- Attack selected target: Space or F
- Quick potion: Q
- Clear target / leave combat: Escape
- Toggle menu: M

Bindings use `KeyboardEvent.code` values such as `KeyW`, `Space`, `Tab`, and `ArrowUp`.

`combat.keyboardTargetRange` in `config/game-balance.js` controls how far away the Tab target selector can find mobs.
