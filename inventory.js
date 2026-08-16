// Slot-based backpack inventory. Drop systems should use addItem/removeItem instead of
// modifying state.inventory directly so stacking/capacity rules stay centralized.
const ITEM_DEFS = window.LR_ITEMS || {};
const INVENTORY_SLOT_COUNT = Math.max(1,Math.floor(numberOr(BALANCE.inventory?.slots,20)));
const INVENTORY_DEFAULT_STACK_LIMIT = Math.max(1,Math.floor(numberOr(BALANCE.inventory?.defaultStackLimit,99)));
let selectedInventorySlot = null;

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
  state.inventory=normalizeInventory(state.inventory);
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
  updateBackpackHud();
  if(document.getElementById("backpack")?.classList.contains("show")) renderInventory();
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
  updateBackpackHud();
  if(document.getElementById("backpack")?.classList.contains("show")) renderInventory();
  return removed;
}

function inventoryEscape(value){
  return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

function updateBackpackHud(){
  if(!state) return;
  ensureInventoryState();
  const used=getInventoryUsedSlots();
  const counter=document.getElementById("backpackCount");
  if(counter) counter.textContent=`${used}/${INVENTORY_SLOT_COUNT}`;
  const panelCounter=document.getElementById("inventoryCapacity");
  if(panelCounter) panelCounter.textContent=`${used} / ${INVENTORY_SLOT_COUNT} slots`;
}

function renderInventory(){
  if(!state) return;
  ensureInventoryState();
  const grid=document.getElementById("inventoryGrid");
  if(!grid) return;

  grid.innerHTML=state.inventory.map((slot,index)=>{
    if(!slot){
      return `<button class="inventorySlot empty" data-slot="${index}" aria-label="Empty inventory slot ${index+1}"><span class="slotNumber">${index+1}</span></button>`;
    }
    const def=getItemDefinition(slot.id);
    const iconMarkup=def.icon
      ?`<img class="itemIcon" src="${inventoryEscape(def.icon)}" alt="" aria-hidden="true">`
      :`<span class="itemSymbol">${inventoryEscape(def.symbol)}</span>`;
    return `<button class="inventorySlot${selectedInventorySlot===index?" selected":""}" data-slot="${index}" aria-label="${inventoryEscape(def.name)}, quantity ${slot.qty}">${iconMarkup}<span class="itemQty">${slot.qty}</span></button>`;
  }).join("");

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
  const detailIcon=def.icon
    ?`<img class="detailIcon" src="${inventoryEscape(def.icon)}" alt="" aria-hidden="true">`
    :`<span class="detailSymbol">${inventoryEscape(def.symbol)}</span>`;
  details.innerHTML=`<div class="inventoryDetailTitle">${detailIcon}<span>${inventoryEscape(def.name)}</span><b>×${slot.qty}</b></div><div class="inventoryDetailMeta">${inventoryEscape(def.category)} • ${inventoryEscape(def.rarity)} • Stack ${slot.qty}/${def.stackLimit}${valueText}</div><div class="inventoryDetailDescription">${inventoryEscape(def.description||"No description yet.")}</div>`;
}

function selectInventorySlot(index){
  ensureInventoryState();
  const i=Math.floor(numberOr(index,-1));
  selectedInventorySlot=(i>=0&&i<state.inventory.length&&state.inventory[i])?i:null;
  renderInventory();
}

function openBackpack(){
  if(!state) return;
  resetHeldKeyboardMovement?.();
  input={up:false,down:false,left:false,right:false};
  isHeroMoving=false;
  document.getElementById("menu")?.classList.remove("show");
  selectedInventorySlot=null;
  renderInventory();
  document.getElementById("backpack")?.classList.add("show");
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

// Stable API for future mob drops, gathering, shops, quests, and debug tooling.
window.LR_INVENTORY=Object.freeze({
  addItem,
  removeItem,
  getItemCount,
  canAddItem,
  getUsedSlots:getInventoryUsedSlots,
  getSlotCount:()=>INVENTORY_SLOT_COUNT
});
