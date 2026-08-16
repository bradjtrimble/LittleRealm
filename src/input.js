// Desktop / keyboard input. Bindings live in config/keybinds.js so changing
// keys does not require rebuilding js/game.js.
const KEYBINDS = window.LR_KEYBINDS || {};
const KEYBOARD_TARGET_RANGE = numberOr(BALANCE.combat?.keyboardTargetRange,220);

function bindingList(name,fallback){
  const value=KEYBINDS[name];
  if(Array.isArray(value) && value.length) return value.filter(v=>typeof v==="string"&&v.length);
  if(typeof value==="string" && value.length) return [value];
  return fallback;
}

const INPUT_BINDINGS = {
  moveUp:bindingList("moveUp",["KeyW","ArrowUp"]),
  moveDown:bindingList("moveDown",["KeyS","ArrowDown"]),
  moveLeft:bindingList("moveLeft",["KeyA","ArrowLeft"]),
  moveRight:bindingList("moveRight",["KeyD","ArrowRight"]),
  targetNext:bindingList("targetNext",["Tab"]),
  attackTarget:bindingList("attackTarget",["Space","KeyF"]),
  potion:bindingList("potion",["KeyQ"]),
  clearTarget:bindingList("clearTarget",["Escape"]),
  menu:bindingList("menu",["KeyM"]),
  backpack:bindingList("backpack",["KeyI","KeyB"])
};

// Exposed only as read-only diagnostics so a desktop tester can confirm the
// deployed build from DevTools without digging through bundled source.
window.LR_BUILD_VERSION="v50-loot-window";
window.LR_INPUT_BINDINGS=Object.freeze({...INPUT_BINDINGS});
window.LR_INPUT_STATE=()=>({...input});

function keyMatches(action,event){
  const keys=INPUT_BINDINGS[action]||[];
  return keys.includes(event.code) || keys.includes(event.key);
}

function isEditableKeyTarget(target){
  if(!target) return false;
  const tag=(target.tagName||"").toLowerCase();
  return target.isContentEditable || tag==="input" || tag==="textarea" || tag==="select";
}

function resetHeldKeyboardMovement(){
  input.up=false; input.down=false; input.left=false; input.right=false;
}

function cycleKeyboardTarget(reverse=false){
  const candidates=mobs
    .filter(mob=>mob.alive && dist(state.x,state.y,mob.x,mob.y)<=KEYBOARD_TARGET_RANGE)
    .sort((a,b)=>{
      const da=dist(state.x,state.y,a.x,a.y);
      const db=dist(state.x,state.y,b.x,b.y);
      return da-db || a.id-b.id;
    });

  if(!candidates.length){
    clearSelectedTarget();
    toast("No mobs are close enough to target.");
    return;
  }

  let index=candidates.indexOf(selectedTarget);
  if(index<0) index=reverse?0:-1;
  index=(index+(reverse?-1:1)+candidates.length)%candidates.length;
  selectMob(candidates[index]);
}

function attackTargetFromKeyboard(){
  if(isGameplayModalOpen()) return;
  if(combatTarget && combatTarget.alive){
    // Combat is automatic once engaged. Repeated key presses never create
    // additional attacks and therefore cannot bypass the global cooldown.
    return;
  }
  if(attackButtonCooldown>0){
    toast(`Attack ready in ${attackButtonCooldown.toFixed(1)}s.`);
    return;
  }
  const target=(selectedTarget&&selectedTarget.alive)?selectedTarget:findNearestMob(MAX_ENGAGE_RANGE);
  if(target) engageMob(target);
  else toast("Target a nearby mob first (Tab or click). ");
}

function clearTargetFromKeyboard(){
  if(combatTarget){
    disengageCombat();
    return;
  }
  if(selectedTarget){
    clearSelectedTarget();
    toast("Target cleared.");
  }
}

function toggleMenuFromKeyboard(){
  const menu=document.getElementById("menu");
  resetHeldKeyboardMovement();
  isHeroMoving=false;
  closeBackpack();
  menu.classList.toggle("show");
}

function prettyKey(code){
  const names={Space:"Space",Tab:"Tab",Escape:"Esc",ArrowUp:"↑",ArrowDown:"↓",ArrowLeft:"←",ArrowRight:"→"};
  if(names[code]) return names[code];
  if(code.startsWith("Key")) return code.slice(3);
  if(code.startsWith("Digit")) return code.slice(5);
  return code;
}

function bindingLabel(action){
  return (INPUT_BINDINGS[action]||[]).map(prettyKey).join("/");
}

function updateKeyboardHelp(){
  const compact=document.getElementById("pcControls");
  if(compact){
    compact.textContent=`PC CONTROLS  •  MOVE ${bindingLabel("moveUp")}/${bindingLabel("moveLeft")}/${bindingLabel("moveDown")}/${bindingLabel("moveRight")}  •  TARGET ${bindingLabel("targetNext")}  •  ATTACK ${bindingLabel("attackTarget")}  •  POTION ${bindingLabel("potion")}  •  PACK ${bindingLabel("backpack")}  •  CLEAR ${bindingLabel("clearTarget")}  •  MENU ${bindingLabel("menu")}`;
  }
  const list=document.getElementById("keybindList");
  if(list){
    list.innerHTML=`<b>PC Controls</b><br>Move: ${bindingLabel("moveUp")} / ${bindingLabel("moveLeft")} / ${bindingLabel("moveDown")} / ${bindingLabel("moveRight")}<br>Target next mob: ${bindingLabel("targetNext")}<br>Attack target: ${bindingLabel("attackTarget")}<br>Quick potion: ${bindingLabel("potion")}<br>Backpack: ${bindingLabel("backpack")}<br>Clear target / leave combat: ${bindingLabel("clearTarget")}<br>Menu: ${bindingLabel("menu")}`;
  }
}

function bindKeyboardControls(){
  window.addEventListener("keydown",event=>{
    if(isEditableKeyTarget(event.target)) return;

    const overlayOpen=isGameplayModalOpen();
    if(!overlayOpen){
      if(keyMatches("moveUp",event)){event.preventDefault();input.up=true;}
      if(keyMatches("moveDown",event)){event.preventDefault();input.down=true;}
      if(keyMatches("moveLeft",event)){event.preventDefault();input.left=true;}
      if(keyMatches("moveRight",event)){event.preventDefault();input.right=true;}
    }

    // Discrete actions should only fire once per physical press.
    if(event.repeat) return;

    if(keyMatches("backpack",event)){
      event.preventDefault();
      toggleBackpack();
    }else if(keyMatches("targetNext",event)){
      event.preventDefault();
      cycleKeyboardTarget(event.shiftKey);
    }else if(keyMatches("attackTarget",event)){
      event.preventDefault();
      attackTargetFromKeyboard();
    }else if(keyMatches("potion",event)){
      event.preventDefault();
      useQuickPotion();
    }else if(keyMatches("clearTarget",event)){
      event.preventDefault();
      const menu=document.getElementById("menu");
      const backpack=document.getElementById("backpack");
      const lootWindow=document.getElementById("lootWindow");
      const disposePrompt=document.getElementById("disposePrompt");
      if(disposePrompt.classList.contains("show")) cancelDisposePrompt();
      else if(lootWindow.classList.contains("show")) closeLootWindow();
      else if(backpack.classList.contains("show")) closeBackpack();
      else if(menu.classList.contains("show")) menu.classList.remove("show");
      else clearTargetFromKeyboard();
    }else if(keyMatches("menu",event)){
      event.preventDefault();
      toggleMenuFromKeyboard();
    }
  });

  window.addEventListener("keyup",event=>{
    if(keyMatches("moveUp",event)) input.up=false;
    if(keyMatches("moveDown",event)) input.down=false;
    if(keyMatches("moveLeft",event)) input.left=false;
    if(keyMatches("moveRight",event)) input.right=false;
  });

  window.addEventListener("blur",resetHeldKeyboardMovement);
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden) resetHeldKeyboardMovement();
  });
  updateKeyboardHelp();
}
