// Data-driven loot foundation. Item definitions live in config/items.js and
// drop rules live in config/loot-tables.js. Mob deaths roll here, then the
// player chooses what to move into the backpack from the loot window.
const LOOT_TABLES = window.LR_LOOT_TABLES || {};
const warnedLootProblems = new Set();
let pendingLoot = [];
let pendingLootSource = "Defeated enemy";
let lootPointerDrag = null;
let suppressLootClick = false;
let lootInteractionsBound = false;

function lootWarnOnce(key,message){
  if(warnedLootProblems.has(key)) return;
  warnedLootProblems.add(key);
  console.warn(`[Little Realm loot] ${message}`);
}

function getLootTable(tableId){
  const raw=LOOT_TABLES[tableId];
  if(Array.isArray(raw)) return raw;
  if(raw&&Array.isArray(raw.entries)) return raw.entries;
  return [];
}

function lootEntryAllowed(entry,context){
  if(!entry||typeof entry.itemId!=="string"||!entry.itemId.trim()) return false;
  if(entry.requiresElite&&!context.elite) return false;
  if(entry.requiresBoss&&!context.boss) return false;
  const level=Math.max(1,Math.floor(numberOr(context.level,1)));
  if(Number.isFinite(Number(entry.minLevel))&&level<Number(entry.minLevel)) return false;
  if(Number.isFinite(Number(entry.maxLevel))&&level>Number(entry.maxLevel)) return false;
  return true;
}

function rollLootTable(tableId,context={},rng=Math.random){
  const table=getLootTable(tableId);
  const totals=new Map();

  for(const entry of table){
    if(!lootEntryAllowed(entry,context)) continue;
    const itemId=entry.itemId.trim();
    if(!Object.prototype.hasOwnProperty.call(ITEM_DEFS,itemId)){
      lootWarnOnce(`missing-item:${tableId}:${itemId}`,`Table "${tableId}" references unknown item "${itemId}". Add it to config/items.js first.`);
      continue;
    }

    const chance=clamp(numberOr(entry.chancePercent,100),0,100);
    if(chance<=0||rng()*100>=chance) continue;

    const minQty=Math.max(1,Math.floor(numberOr(entry.minQty,1)));
    const maxQty=Math.max(minQty,Math.floor(numberOr(entry.maxQty,minQty)));
    const qty=minQty+Math.floor(rng()*(maxQty-minQty+1));
    totals.set(itemId,(totals.get(itemId)||0)+qty);
  }

  return [...totals].map(([itemId,qty])=>({itemId,qty}));
}

function grantLootDrops(drops){
  const added=[];
  const overflow=[];
  for(const drop of Array.isArray(drops)?drops:[]){
    if(!drop||typeof drop.itemId!=="string") continue;
    const qty=Math.max(0,Math.floor(numberOr(drop.qty,0)));
    if(qty<=0) continue;
    const result=addItem(drop.itemId,qty);
    if(result.added>0) added.push({itemId:drop.itemId,qty:result.added});
    if(result.remaining>0) overflow.push({itemId:drop.itemId,qty:result.remaining});
  }
  return {added,overflow};
}

function lootTableIdForMob(mob){
  if(!mob) return "";
  const template=mob.template||mob;
  return typeof template.lootTable==="string"&&template.lootTable.trim()
    ? template.lootTable.trim()
    : (template.configKey||mob.kind||template.kind||"");
}

function rollMobLoot(mob,rng=Math.random){
  const tableId=lootTableIdForMob(mob);
  if(!tableId) return {tableId:"",rolled:[]};
  const template=mob?.template||mob||{};
  const rolled=rollLootTable(tableId,{
    level:mob?.level??template.level??template.baseLevel??1,
    elite:!!(mob?.elite??template.elite),
    boss:!!(mob?.boss||template.boss)
  },rng);
  return {tableId,rolled};
}

// Kept for developer tools and future scripted rewards that intentionally
// bypass the loot window. Normal mob deaths use rollMobLoot + openLootWindow.
function grantMobLoot(mob,rng=Math.random){
  const result=rollMobLoot(mob,rng);
  const granted=grantLootDrops(result.rolled);
  return {...result,...granted};
}

function formatLootDrops(drops){
  return (Array.isArray(drops)?drops:[]).map(drop=>{
    const def=getItemDefinition(drop.itemId);
    return `${drop.qty}× ${def.name}`;
  }).join(", ");
}

function normalizePendingLoot(drops){
  const totals=new Map();
  for(const drop of Array.isArray(drops)?drops:[]){
    if(!drop||typeof drop.itemId!=="string"||!ITEM_DEFS[drop.itemId]) continue;
    const qty=Math.max(0,Math.floor(numberOr(drop.qty,0)));
    if(qty>0) totals.set(drop.itemId,(totals.get(drop.itemId)||0)+qty);
  }
  return [...totals].map(([itemId,qty])=>({itemId,qty}));
}

function isLootWindowOpen(){
  return !!document.getElementById("lootWindow")?.classList.contains("show");
}

function renderLootInventory(){
  if(!isLootWindowOpen()) return;
  renderInventoryGrid(document.getElementById("lootInventoryGrid"));
  updateBackpackHud();
}

function renderLootWindow(){
  const source=document.getElementById("lootSourceName");
  if(source) source.textContent=pendingLootSource;
  const grid=document.getElementById("lootGrid");
  if(grid){
    if(!pendingLoot.length){
      grid.innerHTML='<div class="lootEmpty">Nothing left to collect.</div>';
    }else{
      grid.innerHTML=pendingLoot.map((drop,index)=>{
        const def=getItemDefinition(drop.itemId);
        return `<button class="lootSlot" data-loot-index="${index}" aria-label="Take ${drop.qty} ${inventoryEscape(def.name)}">${itemVisualMarkup(def,"lootItemIcon","lootItemSymbol")}<span class="lootItemName">${inventoryEscape(def.name)}</span><span class="lootItemQty">×${drop.qty}</span></button>`;
      }).join("");
    }
  }
  renderLootInventory();
}

function openLootWindow(drops,sourceLabel="Defeated enemy"){
  const normalized=normalizePendingLoot(drops);
  if(!normalized.length) return false;
  pendingLoot=normalized;
  pendingLootSource=String(sourceLabel||"Defeated enemy");
  resetHeldKeyboardMovement?.();
  input={up:false,down:false,left:false,right:false};
  isHeroMoving=false;
  closeBackpack?.();
  document.getElementById("menu")?.classList.remove("show");
  document.getElementById("lootWindow")?.classList.add("show");
  renderLootWindow();
  return true;
}

function closeLootWindow(){
  pendingLoot=[];
  pendingLootSource="Defeated enemy";
  document.getElementById("lootWindow")?.classList.remove("show");
}

function takeLootAtIndex(index,targetSlot=null){
  const i=Math.floor(numberOr(index,-1));
  const drop=pendingLoot[i];
  if(!drop) return {added:0,remaining:0};
  const result=targetSlot==null
    ?addItem(drop.itemId,drop.qty)
    :placeItemInInventorySlot(drop.itemId,drop.qty,targetSlot);

  if(result.added<=0){
    if(targetSlot!=null) toast?.("That backpack slot cannot accept this item.");
    else toast?.("Your backpack is full.");
    return result;
  }

  drop.qty=result.remaining;
  if(drop.qty<=0) pendingLoot.splice(i,1);
  if(!pendingLoot.length){
    closeLootWindow();
  }else{
    renderLootWindow();
  }
  return result;
}

function takeAllLoot(){
  if(!pendingLoot.length) return;
  for(let i=pendingLoot.length-1;i>=0;i--){
    const drop=pendingLoot[i];
    const result=addItem(drop.itemId,drop.qty);
    drop.qty=result.remaining;
    if(drop.qty<=0) pendingLoot.splice(i,1);
  }
  if(!pendingLoot.length) closeLootWindow();
  else{
    renderLootWindow();
    toast?.("Your backpack does not have room for all of the loot.");
  }
}

function createLootDragGhost(drop){
  const def=getItemDefinition(drop.itemId);
  const ghost=document.createElement("div");
  ghost.className="itemDragGhost lootDragGhost";
  ghost.innerHTML=`${itemVisualMarkup(def,"dragIcon","dragSymbol")}<span>${drop.qty}</span>`;
  document.body.appendChild(ghost);
  return ghost;
}

function lootDragPointerDown(event){
  if(event.button!=null&&event.button!==0) return;
  const slot=event.target.closest?.(".lootSlot[data-loot-index]");
  if(!slot) return;
  const index=Number(slot.dataset.lootIndex);
  if(!pendingLoot[index]) return;
  lootPointerDrag={pointerId:event.pointerId,index,startX:event.clientX,startY:event.clientY,active:false,ghost:null};
  slot.setPointerCapture?.(event.pointerId);
}

function lootDragPointerMove(event){
  const drag=lootPointerDrag;
  if(!drag||event.pointerId!==drag.pointerId) return;
  const distance=Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY);
  if(!drag.active&&distance<6) return;
  if(!drag.active){
    const drop=pendingLoot[drag.index];
    if(!drop){lootPointerDrag=null;return;}
    drag.active=true;
    drag.ghost=createLootDragGhost(drop);
    document.getElementById("lootGrid")?.classList.add("lootDragging");
  }
  event.preventDefault?.();
  positionItemDragGhost(drag.ghost,event.clientX,event.clientY);
}

function lootDragPointerUp(event){
  const drag=lootPointerDrag;
  if(!drag||event.pointerId!==drag.pointerId) return;
  lootPointerDrag=null;
  document.getElementById("lootGrid")?.classList.remove("lootDragging");
  drag.ghost?.remove?.();
  if(!drag.active) return;
  event.preventDefault?.();
  suppressLootClick=true;
  setTimeout(()=>{suppressLootClick=false;},0);
  const target=document.elementFromPoint?.(event.clientX,event.clientY)||null;
  const targetSlot=target?.closest?.(".inventorySlot[data-slot]");
  if(targetSlot) takeLootAtIndex(drag.index,Number(targetSlot.dataset.slot));
}

function handleLootGridClick(event){
  if(suppressLootClick){event.preventDefault?.();return;}
  const slot=event.target.closest?.(".lootSlot[data-loot-index]");
  if(slot) takeLootAtIndex(Number(slot.dataset.lootIndex));
}

function bindLootInteractions(){
  if(lootInteractionsBound) return;
  lootInteractionsBound=true;
  document.getElementById("lootGrid")?.addEventListener("pointerdown",lootDragPointerDown);
  document.addEventListener("pointermove",lootDragPointerMove,{passive:false});
  document.addEventListener("pointerup",lootDragPointerUp,{passive:false});
  document.addEventListener("pointercancel",lootDragPointerUp,{passive:false});
}

function validateLootConfig(){
  const errors=[];
  for(const [tableId,raw] of Object.entries(LOOT_TABLES)){
    const entries=Array.isArray(raw)?raw:(raw&&Array.isArray(raw.entries)?raw.entries:null);
    if(!entries){
      errors.push(`Loot table "${tableId}" must be an array or { entries: [] }.`);
      continue;
    }
    entries.forEach((entry,index)=>{
      if(!entry||typeof entry.itemId!=="string"||!entry.itemId.trim()){
        errors.push(`Loot table "${tableId}" entry ${index+1} is missing itemId.`);
        return;
      }
      if(!Object.prototype.hasOwnProperty.call(ITEM_DEFS,entry.itemId.trim())){
        errors.push(`Loot table "${tableId}" entry ${index+1} references unknown item "${entry.itemId}".`);
      }
      const chance=Number(entry.chancePercent??100);
      if(!Number.isFinite(chance)||chance<0||chance>100){
        errors.push(`Loot table "${tableId}" entry ${index+1} has chancePercent outside 0–100.`);
      }
      const minQty=Number(entry.minQty??1);
      const maxQty=Number(entry.maxQty??minQty);
      if(!Number.isFinite(minQty)||!Number.isFinite(maxQty)||minQty<1||maxQty<minQty){
        errors.push(`Loot table "${tableId}" entry ${index+1} has an invalid quantity range.`);
      }
    });
  }
  return errors;
}

// Stable API for tests, developer tools, future chests, gathering, bosses,
// quests, and any other system that needs to roll or present item loot.
window.LR_LOOT=Object.freeze({
  getTable:getLootTable,
  rollTable:rollLootTable,
  rollMobLoot,
  grantDrops:grantLootDrops,
  grantMobLoot,
  openWindow:openLootWindow,
  closeWindow:closeLootWindow,
  takeAt:takeLootAtIndex,
  takeAll:takeAllLoot,
  getPending:()=>pendingLoot.map(drop=>({...drop})),
  formatDrops:formatLootDrops,
  validate:validateLootConfig
});
