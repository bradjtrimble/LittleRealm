// Slot-based backpack inventory. Drop systems should use addItem/removeItem instead of
// modifying state.inventory directly so stacking/capacity and drag rules stay centralized.
const ITEM_DEFS = window.LR_ITEMS || {};
const INVENTORY_SLOT_COUNT = Math.max(1,Math.floor(numberOr(BALANCE.inventory?.slots,20)));
const INVENTORY_DEFAULT_STACK_LIMIT = Math.max(1,Math.floor(numberOr(BALANCE.inventory?.defaultStackLimit,99)));
let selectedInventorySlot = null;
let pendingDisposeSlot = null;
let inventoryPointerDrag = null;
let suppressInventoryClick = false;
let inventoryInteractionsBound = false;
let normalizedInventoryRef = null;

function createEmptyInventory(){
  return Array.from({length:INVENTORY_SLOT_COUNT},()=>null);
}

function getItemDefinition(itemId){
  const raw=ITEM_DEFS[itemId]||{};
  const fallbackName=String(itemId||"item")
    .replace(/[_-]+/g," ")
    .replace(/\b\w/g,ch=>ch.toUpperCase());
  return {
    id:itemId,
    name:typeof raw.name==="string"&&raw.name.trim()?raw.name:fallbackName,
    description:typeof raw.description==="string"?raw.description:"",
    symbol:typeof raw.symbol==="string"&&raw.symbol.trim()?raw.symbol.trim().slice(0,2):fallbackName.slice(0,1).toUpperCase(),
    icon:typeof raw.icon==="string"&&raw.icon.trim()?raw.icon.trim():"",
    stackLimit:Math.max(1,Math.floor(numberOr(raw.stackLimit,INVENTORY_DEFAULT_STACK_LIMIT))),
    category:typeof raw.category==="string"&&raw.category.trim()?raw.category.trim():"Item",
    rarity:typeof raw.rarity==="string"&&raw.rarity.trim()?raw.rarity.trim():"Common",
    sellValue:Math.max(0,Math.floor(numberOr(raw.sellValue,0))),
    tags:Array.isArray(raw.tags)?raw.tags.filter(tag=>typeof tag==="string"&&tag.trim()).map(tag=>tag.trim()):[]
  };
}

function normalizeInventory(value){
  const normalized=createEmptyInventory();
  if(!Array.isArray(value)) return normalized;
  for(let i=0;i<Math.min(value.length,normalized.length);i++){
    const slot=value[i];
    if(!slot||typeof slot.id!=="string") continue;
    const qty=Math.max(0,Math.floor(numberOr(slot.qty,0)));
    if(qty<=0) continue;
    const def=getItemDefinition(slot.id);
    normalized[i]={id:slot.id,qty:Math.min(qty,def.stackLimit)};
  }
  return normalized;
}

function ensureInventoryState(){
  if(!state) return;
  // Inventory mutations are centralized in this module. Normalize only when a
  // new array enters state (new game/load) instead of reallocating every slot
  // during routine count/capacity queries.
  if(state.inventory===normalizedInventoryRef) return;
  state.inventory=normalizeInventory(state.inventory);
  normalizedInventoryRef=state.inventory;
}

function getInventoryUsedSlots(){
  ensureInventoryState();
  return state.inventory.reduce((n,slot)=>n+(slot?1:0),0);
}

function getItemCount(itemId){
  ensureInventoryState();
  return state.inventory.reduce((sum,slot)=>sum+(slot&&slot.id===itemId?slot.qty:0),0);
}

function getInventoryCapacityFor(itemId){
  ensureInventoryState();
  const def=getItemDefinition(itemId);
  let capacity=0;
  for(const slot of state.inventory){
    if(!slot) capacity+=def.stackLimit;
    else if(slot.id===itemId) capacity+=Math.max(0,def.stackLimit-slot.qty);
  }
  return capacity;
}

function canAddItem(itemId,qty=1){
  const amount=Math.max(0,Math.floor(numberOr(qty,0)));
  return getInventoryCapacityFor(itemId)>=amount;
}

function refreshInventoryViews(){
  updateBackpackHud();
  if(document.getElementById("backpack")?.classList.contains("show")) renderInventory();
  if(document.getElementById("lootWindow")?.classList.contains("show") && typeof renderLootInventory==="function") renderLootInventory();
  if(typeof refreshQuestUI==="function") refreshQuestUI();
}

function addItem(itemId,qty=1){
  ensureInventoryState();
  const def=getItemDefinition(itemId);
  let remaining=Math.max(0,Math.floor(numberOr(qty,0)));
  const requested=remaining;
  if(!itemId||remaining<=0) return {added:0,remaining:requested,full:false};

  // Fill existing stacks first.
  for(const slot of state.inventory){
    if(remaining<=0) break;
    if(!slot||slot.id!==itemId||slot.qty>=def.stackLimit) continue;
    const moved=Math.min(remaining,def.stackLimit-slot.qty);
    slot.qty+=moved;
    remaining-=moved;
  }

  // Then consume empty slots.
  for(let i=0;i<state.inventory.length&&remaining>0;i++){
    if(state.inventory[i]) continue;
    const moved=Math.min(remaining,def.stackLimit);
    state.inventory[i]={id:itemId,qty:moved};
    remaining-=moved;
  }

  const added=requested-remaining;
  refreshInventoryViews();
  return {added,remaining,full:remaining>0};
}

function removeItem(itemId,qty=1){
  ensureInventoryState();
  let remaining=Math.max(0,Math.floor(numberOr(qty,0)));
  const requested=remaining;
  for(let i=state.inventory.length-1;i>=0&&remaining>0;i--){
    const slot=state.inventory[i];
    if(!slot||slot.id!==itemId) continue;
    const moved=Math.min(remaining,slot.qty);
    slot.qty-=moved;
    remaining-=moved;
    if(slot.qty<=0) state.inventory[i]=null;
  }
  const removed=requested-remaining;
  refreshInventoryViews();
  return removed;
}

// Place an external item stack into a specific backpack slot. This is used by
// the loot window so a drag can target the exact slot the player chose.
function placeItemInInventorySlot(itemId,qty,targetIndex){
  ensureInventoryState();
  const index=Math.floor(numberOr(targetIndex,-1));
  const requested=Math.max(0,Math.floor(numberOr(qty,0)));
  if(!itemId||requested<=0||index<0||index>=state.inventory.length){
    return {added:0,remaining:requested,blocked:true};
  }

  const def=getItemDefinition(itemId);
  const target=state.inventory[index];
  if(target&&target.id!==itemId) return {added:0,remaining:requested,blocked:true};

  const room=target?Math.max(0,def.stackLimit-target.qty):def.stackLimit;
  const moved=Math.min(requested,room);
  if(moved>0){
    if(target) target.qty+=moved;
    else state.inventory[index]={id:itemId,qty:moved};
  }
  refreshInventoryViews();
  return {added:moved,remaining:requested-moved,blocked:moved<=0};
}

// Dragging one backpack slot onto another swaps different items, moves into an
// empty slot, or combines matching stacks up to the item's stack limit.
function moveInventorySlot(fromIndex,toIndex){
  ensureInventoryState();
  const from=Math.floor(numberOr(fromIndex,-1));
  const to=Math.floor(numberOr(toIndex,-1));
  if(from<0||to<0||from>=state.inventory.length||to>=state.inventory.length||from===to) return false;
  const source=state.inventory[from];
  if(!source) return false;
  const target=state.inventory[to];

  if(!target){
    state.inventory[to]=source;
    state.inventory[from]=null;
  }else if(target.id===source.id){
    const def=getItemDefinition(source.id);
    const moved=Math.min(source.qty,Math.max(0,def.stackLimit-target.qty));
    if(moved<=0) return false;
    target.qty+=moved;
    source.qty-=moved;
    if(source.qty<=0) state.inventory[from]=null;
  }else{
    state.inventory[to]=source;
    state.inventory[from]=target;
  }

  if(selectedInventorySlot===from) selectedInventorySlot=to;
  else if(selectedInventorySlot===to) selectedInventorySlot=from;
  refreshInventoryViews();
  return true;
}

function discardInventorySlot(index){
  ensureInventoryState();
  const i=Math.floor(numberOr(index,-1));
  if(i<0||i>=state.inventory.length||!state.inventory[i]) return null;
  const discarded={...state.inventory[i]};
  state.inventory[i]=null;
  if(selectedInventorySlot===i) selectedInventorySlot=null;
  refreshInventoryViews();
  return discarded;
}

function inventoryEscape(value){
  return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

function itemVisualMarkup(def,iconClass="itemIcon",symbolClass="itemSymbol"){
  return def.icon
    ?`<img class="${iconClass}" src="${inventoryEscape(def.icon)}" alt="" aria-hidden="true">`
    :`<span class="${symbolClass}">${inventoryEscape(def.symbol)}</span>`;
}

function updateBackpackHud(){
  if(!state) return;
  ensureInventoryState();
  const used=getInventoryUsedSlots();
  const counter=document.getElementById("backpackCount");
  if(counter) counter.textContent=`${used}/${INVENTORY_SLOT_COUNT}`;
  const panelCounter=document.getElementById("inventoryCapacity");
  if(panelCounter) panelCounter.textContent=`${used} / ${INVENTORY_SLOT_COUNT}`;
  const lootCounter=document.getElementById("lootInventoryCapacity");
  if(lootCounter) lootCounter.textContent=`${used} / ${INVENTORY_SLOT_COUNT}`;
}

function renderInventoryGrid(grid){
  if(!grid||!state) return;
  ensureInventoryState();
  grid.innerHTML=state.inventory.map((slot,index)=>{
    if(!slot){
      return `<button class="inventorySlot empty" data-slot="${index}" aria-label="Empty inventory slot ${index+1}"><span class="slotNumber">${index+1}</span></button>`;
    }
    const def=getItemDefinition(slot.id);
    const selected=grid.id==="inventoryGrid"&&selectedInventorySlot===index?" selected":"";
    return `<button class="inventorySlot${selected}" data-slot="${index}" aria-label="${inventoryEscape(def.name)}, quantity ${slot.qty}">${itemVisualMarkup(def)}<span class="itemQty">${slot.qty}</span></button>`;
  }).join("");
}

function renderInventory(){
  if(!state) return;
  const grid=document.getElementById("inventoryGrid");
  if(!grid) return;
  renderInventoryGrid(grid);
  updateBackpackHud();
  renderInventoryDetails();
}

function renderInventoryDetails(){
  const details=document.getElementById("inventoryDetails");
  if(!details||!state) return;
  ensureInventoryState();
  const slot=selectedInventorySlot==null?null:state.inventory[selectedInventorySlot];
  if(!slot){
    details.innerHTML='<div class="inventoryDetailEmpty">Select an item to inspect it.</div>';
    return;
  }
  const def=getItemDefinition(slot.id);
  const valueText=def.sellValue>0?` • Value ${def.sellValue}g`:"";
  const detailIcon=itemVisualMarkup(def,"detailIcon","detailSymbol");
  details.innerHTML=`<div class="inventoryDetailTitle">${detailIcon}<span>${inventoryEscape(def.name)}</span><b>×${slot.qty}</b></div><div class="inventoryDetailMeta">${inventoryEscape(def.category)} • ${inventoryEscape(def.rarity)} • Stack ${slot.qty}/${def.stackLimit}${valueText}</div><div class="inventoryDetailDescription">${inventoryEscape(def.description||"No description yet.")}</div>`;
}

function selectInventorySlot(index){
  ensureInventoryState();
  const i=Math.floor(numberOr(index,-1));
  selectedInventorySlot=(i>=0&&i<state.inventory.length&&state.inventory[i])?i:null;
  renderInventory();
}

function handleInventoryGridClick(event){
  if(suppressInventoryClick){
    event.preventDefault?.();
    return;
  }
  const slot=event.target.closest?.("[data-slot]");
  if(slot) selectInventorySlot(Number(slot.dataset.slot));
}

function requestDisposeInventorySlot(index){
  ensureInventoryState();
  const i=Math.floor(numberOr(index,-1));
  const slot=i>=0&&i<state.inventory.length?state.inventory[i]:null;
  if(!slot) return false;
  pendingDisposeSlot=i;
  const def=getItemDefinition(slot.id);
  const name=document.getElementById("disposeItemName");
  const description=document.getElementById("disposeItemText");
  if(name) name.textContent=`${slot.qty}× ${def.name}`;
  if(description) description.textContent=`Dispose this ${slot.qty===1?"item":"stack"}? This cannot be undone.`;
  document.getElementById("disposePrompt")?.classList.add("show");
  resetHeldKeyboardMovement?.();
  return true;
}

function cancelDisposePrompt(){
  pendingDisposeSlot=null;
  document.getElementById("disposePrompt")?.classList.remove("show");
}

function confirmDisposePrompt(){
  const i=pendingDisposeSlot;
  pendingDisposeSlot=null;
  document.getElementById("disposePrompt")?.classList.remove("show");
  const discarded=discardInventorySlot(i);
  if(discarded){
    const def=getItemDefinition(discarded.id);
    toast?.(`Disposed ${discarded.qty}× ${def.name}.`);
  }
}

function createInventoryDragGhost(slot){
  const def=getItemDefinition(slot.id);
  const ghost=document.createElement("div");
  ghost.className="itemDragGhost";
  ghost.innerHTML=`${itemVisualMarkup(def,"dragIcon","dragSymbol")}<span>${slot.qty}</span>`;
  document.body.appendChild(ghost);
  return ghost;
}

function positionItemDragGhost(ghost,x,y){
  if(!ghost) return;
  ghost.style.left=`${x}px`;
  ghost.style.top=`${y}px`;
}

function inventoryDragPointerDown(event){
  if(event.button!=null&&event.button!==0) return;
  const slotEl=event.target.closest?.(".inventorySlot[data-slot]");
  if(!slotEl) return;
  ensureInventoryState();
  const index=Number(slotEl.dataset.slot);
  const slot=state.inventory[index];
  if(!slot) return;
  const grid=slotEl.closest?.("#inventoryGrid,#lootInventoryGrid");
  if(!grid) return;
  inventoryPointerDrag={
    pointerId:event.pointerId,
    sourceIndex:index,
    sourceGrid:grid,
    startX:event.clientX,
    startY:event.clientY,
    active:false,
    ghost:null
  };
  slotEl.setPointerCapture?.(event.pointerId);
}

function inventoryDragPointerMove(event){
  const drag=inventoryPointerDrag;
  if(!drag||event.pointerId!==drag.pointerId) return;
  const distance=Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY);
  if(!drag.active&&distance<6) return;
  if(!drag.active){
    ensureInventoryState();
    const slot=state.inventory[drag.sourceIndex];
    if(!slot){inventoryPointerDrag=null;return;}
    drag.active=true;
    drag.ghost=createInventoryDragGhost(slot);
    drag.sourceGrid.classList.add("inventoryDragging");
  }
  event.preventDefault?.();
  positionItemDragGhost(drag.ghost,event.clientX,event.clientY);
}

function inventoryDragPointerUp(event){
  const drag=inventoryPointerDrag;
  if(!drag||event.pointerId!==drag.pointerId) return;
  inventoryPointerDrag=null;
  drag.sourceGrid?.classList.remove("inventoryDragging");
  drag.ghost?.remove?.();
  if(!drag.active) return;

  event.preventDefault?.();
  suppressInventoryClick=true;
  setTimeout(()=>{suppressInventoryClick=false;},0);

  const target=document.elementFromPoint?.(event.clientX,event.clientY)||null;
  const targetSlot=target?.closest?.(".inventorySlot[data-slot]");
  if(targetSlot){
    moveInventorySlot(drag.sourceIndex,Number(targetSlot.dataset.slot));
    return;
  }

  // Releasing elsewhere inside the panel simply cancels the drag. Releasing
  // outside the bag panel means the player intentionally dragged the stack out.
  const sourcePanel=drag.sourceGrid.closest?.("#backpackPanel,#lootPanel");
  const landedInsideSourcePanel=sourcePanel&&target&&(target===sourcePanel||sourcePanel.contains?.(target));
  if(!landedInsideSourcePanel) requestDisposeInventorySlot(drag.sourceIndex);
}

function bindInventoryInteractions(){
  if(inventoryInteractionsBound) return;
  inventoryInteractionsBound=true;
  document.getElementById("inventoryGrid")?.addEventListener("pointerdown",inventoryDragPointerDown);
  document.getElementById("lootInventoryGrid")?.addEventListener("pointerdown",inventoryDragPointerDown);
  document.addEventListener("pointermove",inventoryDragPointerMove,{passive:false});
  document.addEventListener("pointerup",inventoryDragPointerUp,{passive:false});
  document.addEventListener("pointercancel",inventoryDragPointerUp,{passive:false});
}

function openBackpack(){
  if(!state) return;
  selectedInventorySlot=null;
  renderInventory();
  document.getElementById("backpack")?.classList.add("show");
  constrainFloatingPanel?.("backpackPanel");
}

function closeBackpack(){
  document.getElementById("backpack")?.classList.remove("show");
  selectedInventorySlot=null;
}

function toggleBackpack(){
  const backpack=document.getElementById("backpack");
  if(!backpack) return;
  if(backpack.classList.contains("show")) closeBackpack();
  else openBackpack();
}

// Stable API for loot, gathering, shops, quests, drag/drop UI, and debug tooling.
window.LR_INVENTORY=Object.freeze({
  addItem,
  removeItem,
  getItemCount,
  canAddItem,
  getUsedSlots:getInventoryUsedSlots,
  getSlotCount:()=>INVENTORY_SLOT_COUNT,
  getSlots:()=>{ensureInventoryState();return state.inventory.map(slot=>slot?{...slot}:null);},
  placeInSlot:placeItemInInventorySlot,
  moveSlot:moveInventorySlot,
  disposeSlot:discardInventorySlot,
  requestDispose:requestDisposeInventorySlot
});
