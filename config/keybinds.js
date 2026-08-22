/*
  Little Realm — PC keybinds
  --------------------------
  Edit this file to change keyboard controls. No build step is required.

  Bindings use KeyboardEvent.code names so they stay tied to physical keys.
  Common examples: KeyW, KeyA, KeyS, KeyD, Space, Tab, Escape, ArrowUp.
  You can put more than one key on the same action.
*/
window.LR_KEYBINDS = {
  moveUp: ["KeyW", "ArrowUp"],
  moveDown: ["KeyS", "ArrowDown"],
  moveLeft: ["KeyA", "ArrowLeft"],
  moveRight: ["KeyD", "ArrowRight"],

  targetNext: ["Tab"],
  attackTarget: ["Space", "KeyF"],
  interact: ["KeyE"],
  potion: ["KeyQ"],
  backpack: ["KeyI", "KeyB"],
  clearTarget: ["Escape"],
  menu: ["KeyM"]
};
