// Persistent world-object storage containers ---------------------------------
// Storage contents live inside state.worldObjectStates so player saves keep
// whatever was deposited. Objects only define capacity and optional starting
// contents; the engine owns transfer/stacking behavior.
let activeStorageObject=null;
let storagePointerDrag=null;
let suppressStorageClick=false;
let storageInteractionsBound=false;

function storageCapacityForObject(obj){
  return Math.max(1,Math.min(60,Math.floor(numberOr(obj?.capacity,8))));
}

function normalizeStorageSlots(value,capacity){
  const slots=Array.from({length:capacity},()=>null);
  if(!Array.isArray(value))return slots;
  let cursor=0;
  for(let i=0;i<value.length&&cursor<capacity;i++){
    const raw=value[i];
    if(!raw||typeof raw.id!=="string"||!ITEM_DEFS[raw.id])continue;
    let qty=Math.max(0,Math.floor(numberOr(raw.qty,0)));if(qty<=0)continue;
    const def=getItemDefinition(raw.id);
    while(qty>0&&cursor<capacity){const moved=Math.min(qty,def.stackLimit);slots[cursor++]={id:raw.id,qty:moved};qty-=moved;}
  }
  return slots;
}

function storageRecordForObject(obj){
  if(!obj)return null;
  const record=ensureWorldObjectRecord(obj);
  const capacity=storageCapacityForObject(obj);
  if(!Array.isArray(record.storage)||record.storage.length!==capacity){
    const source=Array.isArray(record.storage)?record.storage:(Array.isArray(obj.contents)?obj.contents:[]);
    record.storage=normalizeStorageSlots(source,capacity);
  }
  return record;
}

function storageSlotsForObject(obj){return storageRecordForObject(obj)?.storage||[];}
function storageUsedSlots(obj){return storageSlotsForObject(obj).reduce((n,slot)=>n+(slot?1:0),0);}

function storageCapacityForItem(obj,itemId){
  const def=getItemDefinition(itemId);let capacity=0;
  for(const slot of storageSlotsForObject(obj)){
    if(!slot)capacity+=def.stackLimit;
    else if(slot.id===itemId)capacity+=Math.max(0,def.stackLimit-slot.qty);
  }
  return capacity;
}

function placeItemInStorageSlot(obj,itemId,qty,targetIndex){
  const slots=storageSlotsForObject(obj),index=Math.floor(numberOr(targetIndex,-1));
  const requested=Math.max(0,Math.floor(numberOr(qty,0)));
  if(!obj||!ITEM_DEFS[itemId]||requested<=0||index<0||index>=slots.length)return {added:0,remaining:requested,blocked:true};
  const def=getItemDefinition(itemId),target=slots[index];
  if(target&&target.id!==itemId)return {added:0,remaining:requested,blocked:true};
  const room=target?Math.max(0,def.stackLimit-target.qty):def.stackLimit,moved=Math.min(requested,room);
  if(moved>0){if(target)target.qty+=moved;else slots[index]={id:itemId,qty:moved};}
  return {added:moved,remaining:requested-moved,blocked:moved<=0};
}

function addItemToStorage(obj,itemId,qty=1){
  const slots=storageSlotsForObject(obj),def=getItemDefinition(itemId);let remaining=Math.max(0,Math.floor(numberOr(qty,0))),requested=remaining;
  if(!obj||!ITEM_DEFS[itemId]||remaining<=0)return {added:0,remaining:requested};
  for(const slot of slots){if(remaining<=0)break;if(!slot||slot.id!==itemId||slot.qty>=def.stackLimit)continue;const moved=Math.min(remaining,def.stackLimit-slot.qty);slot.qty+=moved;remaining-=moved;}
  for(let i=0;i<slots.length&&remaining>0;i++){if(slots[i])continue;const moved=Math.min(remaining,def.stackLimit);slots[i]={id:itemId,qty:moved};remaining-=moved;}
  return {added:requested-remaining,remaining};
}

function moveStorageSlot(obj,fromIndex,toIndex){
  const slots=storageSlotsForObject(obj),from=Math.floor(numberOr(fromIndex,-1)),to=Math.floor(numberOr(toIndex,-1));
  if(from<0||to<0||from>=slots.length||to>=slots.length||from===to||!slots[from])return false;
  const source=slots[from],target=slots[to];
  if(!target){slots[to]=source;slots[from]=null;}
  else if(target.id===source.id){const def=getItemDefinition(source.id),moved=Math.min(source.qty,Math.max(0,def.stackLimit-target.qty));if(moved<=0)return false;target.qty+=moved;source.qty-=moved;if(source.qty<=0)slots[from]=null;}
  else{slots[to]=source;slots[from]=target;}
  renderStorageWindow();return true;
}

function transferStorageToInventory(storageIndex,targetInventorySlot=null){
  const obj=activeStorageObject,slots=storageSlotsForObject(obj),index=Math.floor(numberOr(storageIndex,-1)),slot=slots[index];if(!slot)return false;
  const result=targetInventorySlot==null?addItem(slot.id,slot.qty):placeItemInInventorySlot(slot.id,slot.qty,targetInventorySlot);
  if(result.added<=0){toast(targetInventorySlot==null?"Your backpack is full.":"That backpack slot cannot accept this item.");return false;}
  slot.qty=result.remaining;if(slot.qty<=0)slots[index]=null;renderStorageWindow();return true;
}

function transferInventoryToStorage(inventoryIndex,targetStorageSlot=null){
  ensureInventoryState();const index=Math.floor(numberOr(inventoryIndex,-1)),slot=state.inventory[index];if(!slot||!activeStorageObject)return false;
  const result=targetStorageSlot==null?addItemToStorage(activeStorageObject,slot.id,slot.qty):placeItemInStorageSlot(activeStorageObject,slot.id,slot.qty,targetStorageSlot);
  if(result.added<=0){toast(targetStorageSlot==null?"This container is full.":"That container slot cannot accept this item.");return false;}
  slot.qty=result.remaining;if(slot.qty<=0)state.inventory[index]=null;refreshInventoryViews();renderStorageWindow();return true;
}

function storageSlotMarkup(slot,index){
  if(!slot)return `<button class="inventorySlot empty storageSlot" data-storage-slot="${index}" aria-label="Empty storage slot ${index+1}"><span class="slotNumber">${index+1}</span></button>`;
  const def=getItemDefinition(slot.id);return `<button class="inventorySlot storageSlot" data-storage-slot="${index}" aria-label="${inventoryEscape(def.name)}, quantity ${slot.qty}">${itemVisualMarkup(def)}<span class="itemQty">${slot.qty}</span></button>`;
}

function renderStorageWindow(){
  if(!activeStorageObject)return;
  const title=document.getElementById("storageTitle"),count=document.getElementById("storageCapacity"),grid=document.getElementById("storageGrid"),bag=document.getElementById("storageInventoryGrid");
  if(title)title.textContent=activeStorageObject.label||worldObjectDefinition(activeStorageObject)?.name||"Storage";
  if(count)count.textContent=`${storageUsedSlots(activeStorageObject)} / ${storageCapacityForObject(activeStorageObject)}`;
  if(grid)grid.innerHTML=storageSlotsForObject(activeStorageObject).map(storageSlotMarkup).join("");
  if(bag)renderInventoryGrid(bag);
}

function openStorageContainer(obj){
  if(!obj||!state)return false;activeStorageObject=obj;storageRecordForObject(obj);closeLootWindow?.();closeBackpack?.();renderStorageWindow();document.getElementById("storageWindow")?.classList.add("show");constrainFloatingPanel?.("storagePanel");return true;
}
function closeStorageWindow(){activeStorageObject=null;document.getElementById("storageWindow")?.classList.remove("show");}

function storagePointerDown(event){
  if(event.button!=null&&event.button!==0||!activeStorageObject)return;
  const storageSlot=event.target.closest?.(".storageSlot[data-storage-slot]");
  const inventorySlot=event.target.closest?.("#storageInventoryGrid .inventorySlot[data-slot]");
  let sourceKind="",index=-1,slot=null;
  if(storageSlot){sourceKind="storage";index=Number(storageSlot.dataset.storageSlot);slot=storageSlotsForObject(activeStorageObject)[index];}
  else if(inventorySlot){ensureInventoryState();sourceKind="inventory";index=Number(inventorySlot.dataset.slot);slot=state.inventory[index];}
  if(!slot)return;
  storagePointerDrag={pointerId:event.pointerId,sourceKind,index,startX:event.clientX,startY:event.clientY,active:false,ghost:null};
  (storageSlot||inventorySlot).setPointerCapture?.(event.pointerId);
}
function storagePointerMove(event){
  const drag=storagePointerDrag;if(!drag||event.pointerId!==drag.pointerId)return;
  if(!drag.active&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<6)return;
  if(!drag.active){const slot=drag.sourceKind==="storage"?storageSlotsForObject(activeStorageObject)[drag.index]:state.inventory[drag.index];if(!slot){storagePointerDrag=null;return;}drag.active=true;drag.ghost=createInventoryDragGhost(slot);document.getElementById("storagePanel")?.classList.add("inventoryDragging");}
  event.preventDefault?.();positionItemDragGhost(drag.ghost,event.clientX,event.clientY);
}
function storagePointerUp(event){
  const drag=storagePointerDrag;if(!drag||event.pointerId!==drag.pointerId)return;storagePointerDrag=null;document.getElementById("storagePanel")?.classList.remove("inventoryDragging");drag.ghost?.remove?.();if(!drag.active)return;
  event.preventDefault?.();suppressStorageClick=true;setTimeout(()=>{suppressStorageClick=false;},0);
  const target=document.elementFromPoint?.(event.clientX,event.clientY)||null,storageTarget=target?.closest?.(".storageSlot[data-storage-slot]"),inventoryTarget=target?.closest?.("#storageInventoryGrid .inventorySlot[data-slot]");
  if(drag.sourceKind==="storage"){
    if(inventoryTarget)transferStorageToInventory(drag.index,Number(inventoryTarget.dataset.slot));
    else if(storageTarget)moveStorageSlot(activeStorageObject,drag.index,Number(storageTarget.dataset.storageSlot));
    else if(target?.closest?.("#storageBagSection"))transferStorageToInventory(drag.index);
  }else{
    if(storageTarget)transferInventoryToStorage(drag.index,Number(storageTarget.dataset.storageSlot));
    else if(inventoryTarget)moveInventorySlot(drag.index,Number(inventoryTarget.dataset.slot));
    else if(target?.closest?.("#storageContainerSection"))transferInventoryToStorage(drag.index);
  }
}
function handleStorageClick(event){
  if(suppressStorageClick)return;
  const storageSlot=event.target.closest?.(".storageSlot[data-storage-slot]");if(storageSlot){transferStorageToInventory(Number(storageSlot.dataset.storageSlot));return;}
  const inventorySlot=event.target.closest?.("#storageInventoryGrid .inventorySlot[data-slot]");if(inventorySlot)transferInventoryToStorage(Number(inventorySlot.dataset.slot));
}
function bindStorageInteractions(){
  if(storageInteractionsBound)return;storageInteractionsBound=true;const panel=document.getElementById("storagePanel");panel?.addEventListener("pointerdown",storagePointerDown);panel?.addEventListener("click",handleStorageClick);document.addEventListener("pointermove",storagePointerMove,{passive:false});document.addEventListener("pointerup",storagePointerUp,{passive:false});document.addEventListener("pointercancel",storagePointerUp,{passive:false});
}

window.LR_STORAGE=Object.freeze({open:openStorageContainer,close:closeStorageWindow,getSlots:obj=>storageSlotsForObject(obj).map(slot=>slot?{...slot}:null),deposit:transferInventoryToStorage,withdraw:transferStorageToInventory});
