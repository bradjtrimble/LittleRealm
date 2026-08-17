window.addEventListener("error", (event) => {
  console.error("Little Realm error:", event.error || event.message);
});

(() => {
const BALANCE = window.LR_BALANCE || {};
const PROJECT_WORLD_OBJECTS = window.LR_WORLD_OBJECTS || [];
const PROJECT_NPCS = window.LR_NPCS || [];
const PROJECT_QUESTS = window.LR_QUESTS || [];
const VISUAL_CONFIG = window.LR_VISUAL || {};

const VISUAL_SCALE_MIN = 0.25;
const VISUAL_SCALE_MAX = 3.0;

function visualScaleOr(value,fallback=1){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(VISUAL_SCALE_MIN,Math.min(VISUAL_SCALE_MAX,n)):fallback;
}

const VISUAL_SCALE = {
  player: visualScaleOr(VISUAL_CONFIG.player,1.20),
  hostileMobs: visualScaleOr(VISUAL_CONFIG.hostileMobs,1.15),
  passiveMobs: visualScaleOr(VISUAL_CONFIG.passiveMobs,1.10),
  boss: visualScaleOr(VISUAL_CONFIG.boss,1.05),
  houses: visualScaleOr(VISUAL_CONFIG.houses,1.15),
  npcs: visualScaleOr(VISUAL_CONFIG.npcs,1.10),
  props: visualScaleOr(VISUAL_CONFIG.props,1.00)
};
const MOB_TYPE_SCALE = {
  slime: visualScaleOr(VISUAL_CONFIG.mobTypes?.slime,VISUAL_SCALE.hostileMobs),
  goblin: visualScaleOr(VISUAL_CONFIG.mobTypes?.goblin,VISUAL_SCALE.hostileMobs),
  wolf: visualScaleOr(VISUAL_CONFIG.mobTypes?.wolf,VISUAL_SCALE.hostileMobs),
  cow: visualScaleOr(VISUAL_CONFIG.mobTypes?.cow,VISUAL_SCALE.passiveMobs),
  pig: visualScaleOr(VISUAL_CONFIG.mobTypes?.pig,VISUAL_SCALE.passiveMobs),
  chicken: visualScaleOr(VISUAL_CONFIG.mobTypes?.chicken,VISUAL_SCALE.passiveMobs),
  snickers: visualScaleOr(VISUAL_CONFIG.mobTypes?.snickers,VISUAL_SCALE.boss)
};
const PROJECT_VISUAL_SCALE = {...VISUAL_SCALE};
const PROJECT_MOB_TYPE_SCALE = {...MOB_TYPE_SCALE};

function numberOr(value,fallback){
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}
function percentOr(value,fallbackPercent){
  return clamp(numberOr(value,fallbackPercent),0,100)/100;
}
function booleanOr(value,fallback){
  return typeof value==="boolean"?value:fallback;
}

function playerLevelCap(){
  return Math.max(1,Math.floor(numberOr(BALANCE.progression?.levelCap,100)));
}

function xpRequiredForLevel(level){
  const lv=Math.max(1,Math.floor(numberOr(level,1)));
  const cap=playerLevelCap();
  if(lv>=cap) return 0;
  const table=BALANCE.progression?.xpToNextLevel;
  if(Array.isArray(table)){
    const listed=Number(table[lv-1]);
    if(Number.isFinite(listed)&&listed>0) return Math.floor(listed);
  }
  // Backward-compatible fallback for older imported balance files.
  const start=Math.max(1,Math.floor(numberOr(BALANCE.progression?.startingXpToLevel,400)));
  const growth=1+percentOr(BALANCE.progression?.xpRequirementGrowthPercent,35);
  let next=start;
  for(let i=1;i<lv;i++) next=Math.min(Number.MAX_SAFE_INTEGER,Math.floor(next*growth));
  return next;
}

function standardMobXpForLevel(level){
  const lv=Math.max(1,Math.floor(numberOr(level,1)));
  const base=Math.max(1,numberOr(BALANCE.progression?.sameLevelMobXpBase,50));
  const perLevel=Math.max(0,numberOr(BALANCE.progression?.sameLevelMobXpPerLevel,5));
  return Math.max(1,Math.round(base+(lv-1)*perLevel));
}

function overlayIsShown(id){
  return !!document.getElementById(id)?.classList.contains("show");
}

function isGameplayModalOpen(){
  // Backpack and loot are intentionally non-modal floating panels in v51.
  // Only true dialogs should stop movement/combat input.
  return overlayIsShown("menu") || overlayIsShown("disposePrompt") || overlayIsShown("npcDialog");
}

function isLootInteractionOpen(){
  // Loot can remain open while the world keeps running. Disposal confirmation
  // is still modal so an item cannot be lost while combat advances behind it.
  return overlayIsShown("disposePrompt");
}

const game = document.getElementById("game");
const ctx = game.getContext("2d");
const heroCanvas = document.getElementById("heroBattleSprite");
const heroCtx = heroCanvas.getContext("2d");
const enemyCanvas = document.getElementById("enemyBattleSprite");
const enemyCtx = enemyCanvas.getContext("2d");

const SPRITE_FRAME_META = new WeakMap();

function buildSpriteFrameMeta(image){
  if(!image || !image.naturalWidth || !image.naturalHeight) return null;
  try{
    const canvas=document.createElement("canvas");
    canvas.width=image.naturalWidth;
    canvas.height=image.naturalHeight;
    const c=canvas.getContext("2d",{willReadFrequently:true});
    c.clearRect(0,0,canvas.width,canvas.height);
    c.drawImage(image,0,0);
    const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;
    const frames=[];
    for(let row=0;row<4;row++){
      frames[row]=[];
      const sy0=Math.round(row*canvas.height/4);
      const sy1=Math.round((row+1)*canvas.height/4);
      for(let col=0;col<4;col++){
        const sx0=Math.round(col*canvas.width/4);
        const sx1=Math.round((col+1)*canvas.width/4);
        let minX=sx1,minY=sy1,maxX=sx0-1,maxY=sy0-1;
        for(let py=sy0;py<sy1;py++){
          let idx=(py*canvas.width+sx0)*4+3;
          for(let px=sx0;px<sx1;px++,idx+=4){
            if(pixels[idx]>8){
              if(px<minX) minX=px;
              if(px>maxX) maxX=px;
              if(py<minY) minY=py;
              if(py>maxY) maxY=py;
            }
          }
        }
        if(maxX>=minX && maxY>=minY){
          frames[row][col]={
            sx:minX, sy:minY,
            sw:maxX-minX+1, sh:maxY-minY+1,
            cellW:sx1-sx0, cellH:sy1-sy0
          };
        }else{
          frames[row][col]={sx:sx0,sy:sy0,sw:sx1-sx0,sh:sy1-sy0,cellW:sx1-sx0,cellH:sy1-sy0};
        }
      }
    }
    SPRITE_FRAME_META.set(image,frames);
    return frames;
  }catch(err){
    console.warn("Could not analyze sprite frame bounds",err);
    return null;
  }
}

function spriteFrameMeta(image,row,col){
  const frames=SPRITE_FRAME_META.get(image) || buildSpriteFrameMeta(image);
  return frames?.[row]?.[col] || null;
}

const playerSheet = new Image();
playerSheet.src = "./assets/characters/player.png";
let playerSheetReady = playerSheet.complete && playerSheet.naturalWidth > 0;
playerSheet.onload = () => { playerSheetReady = true; buildSpriteFrameMeta(playerSheet); };

const slimeSheet = new Image();
slimeSheet.src = "./assets/mobs/slime.png";
let slimeSheetReady = slimeSheet.complete && slimeSheet.naturalWidth > 0;
slimeSheet.onload = () => { slimeSheetReady = true; buildSpriteFrameMeta(slimeSheet); };

const wolfSheet = new Image();
wolfSheet.src = "./assets/mobs/wolf.png";
let wolfSheetReady = wolfSheet.complete && wolfSheet.naturalWidth > 0;
wolfSheet.onload = () => { wolfSheetReady = true; buildSpriteFrameMeta(wolfSheet); };

const goblinSheet = new Image();
goblinSheet.src = "./assets/mobs/goblin.png";
let goblinSheetReady = goblinSheet.complete && goblinSheet.naturalWidth > 0;
goblinSheet.onload = () => { goblinSheetReady = true; buildSpriteFrameMeta(goblinSheet); };

const bearSheet = new Image();
bearSheet.src = "./assets/mobs/bear.png";
let bearSheetReady = bearSheet.complete && bearSheet.naturalWidth > 0;
bearSheet.onload = () => { bearSheetReady = true; buildSpriteFrameMeta(bearSheet); };

const cowSheet = new Image();
cowSheet.src = "./assets/mobs/cow.png";
let cowSheetReady = cowSheet.complete && cowSheet.naturalWidth > 0;
cowSheet.onload = () => { cowSheetReady = true; buildSpriteFrameMeta(cowSheet); };

const pigSheet = new Image();
pigSheet.src = "./assets/mobs/pig.png";
let pigSheetReady = pigSheet.complete && pigSheet.naturalWidth > 0;
pigSheet.onload = () => { pigSheetReady = true; buildSpriteFrameMeta(pigSheet); };

const chickenSheet = new Image();
chickenSheet.src = "./assets/mobs/chicken.png";
let chickenSheetReady = chickenSheet.complete && chickenSheet.naturalWidth > 0;
chickenSheet.onload = () => { chickenSheetReady = true; buildSpriteFrameMeta(chickenSheet); };

const environmentAtlas = new Image();
environmentAtlas.src = "./assets/environment/environment-atlas.png";
let environmentAtlasReady = environmentAtlas.complete && environmentAtlas.naturalWidth > 0;
environmentAtlas.onload = () => { environmentAtlasReady = true; };
const ENV_ATLAS_CELL = 128;

const propAtlas = new Image();
propAtlas.src = "./assets/props/object-atlas.png";
let propAtlasReady = propAtlas.complete && propAtlas.naturalWidth > 0;
propAtlas.onload = () => { propAtlasReady = true; };
const PROP_ATLAS_CELL = 160;

const terrainTexture = new Image();
terrainTexture.src = "./assets/environment/terrain-seamless.png";
let terrainTextureReady = terrainTexture.complete && terrainTexture.naturalWidth > 0;
terrainTexture.onload = () => { terrainTextureReady = true; };

const waterTexture = new Image();
waterTexture.src = "./assets/environment/water-seamless.png";
let waterTextureReady = waterTexture.complete && waterTexture.naturalWidth > 0;
waterTexture.onload = () => { waterTextureReady = true; };

const houseAImage = new Image();
houseAImage.src = "./assets/buildings/house-a.png";
let houseAReady = houseAImage.complete && houseAImage.naturalWidth > 0;
houseAImage.onload = () => { houseAReady = true; };

const houseBImage = new Image();
houseBImage.src = "./assets/buildings/house-b.png";
let houseBReady = houseBImage.complete && houseBImage.naturalWidth > 0;
houseBImage.onload = () => { houseBReady = true; };

const caveEntranceImage = new Image();
caveEntranceImage.src = "./assets/environment/cave-entrance.png";
let caveEntranceReady = caveEntranceImage.complete && caveEntranceImage.naturalWidth > 0;
caveEntranceImage.onload = () => { caveEntranceReady = true; };

const HOUSE_SPECS = {
  A:{image:houseAImage, ready:()=>houseAReady, w:118, h:91, footprint:{x:12,y:66,w:94,h:23}},
  B:{image:houseBImage, ready:()=>houseBReady, w:128, h:89, footprint:{x:8,y:67,w:112,h:20}}
};





const TILE = 64;
const WORLD_W = 44;
const WORLD_H = 32;
const START_TILE_X = 7;
const START_TILE_Y = 7;
const START_X = START_TILE_X*TILE+TILE/2;
const START_Y = START_TILE_Y*TILE+TILE/2;
const HERO_SPEED = numberOr(BALANCE.player?.moveSpeed,180); // world pixels per second
const HERO_RADIUS = 5;
const MOB_RADIUS = 14;
const MOB_TRIGGER_DISTANCE = 22;

let state;
let enemy=null;
let currentMob=null;
let defending=false;
let battleLocked=false;
let toastTimer=null;
let lastFrame=performance.now();
let moveAnimTime=0;
let isHeroMoving=false;
let heroFacing='down';
let mobs=[];
let nextMobId=1;
let input={up:false,down:false,left:false,right:false};
  isHeroMoving=false;
let lastSafePos={x:0,y:0};
let townCooldown=0;
let castleCooldown=0;

function toast(msg){
  const el=document.getElementById("toast");
  el.textContent=msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove("show"),1800);
}

function rand(a,b){return Math.floor(Math.random()*(b-a+1))+a}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function dist(ax,ay,bx,by){return Math.hypot(ax-bx,ay-by)}

function roundedRect(c,x,y,w,h,r,fill){
  c.beginPath();
  c.roundRect(x,y,w,h,r);
  c.fillStyle=fill;
  c.fill();
}

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

// Data-driven loot + world-remnant system. Item definitions live in
// config/items.js and drop rules live in config/loot-tables.js. Mob deaths
// always leave a temporary dust pile; gold, potion drops, and item drops stay
// inside the pile until the player chooses to collect them.
const LOOT_TABLES = window.LR_LOOT_TABLES || {};
const LOOT_PILE_LIFETIME_MS = 60000;
const LOOT_PILE_FADE_MS = 10000;
const LOOT_PILE_INTERACT_RANGE = 84;
const LOOT_PILE_DRAW_SIZE = 44;
const LOOTABLE_DUST_SHEET_COLUMNS = 4;
const LOOTABLE_DUST_SHEET_ROWS = 4;
const LOOTABLE_DUST_FRAME_COUNT = LOOTABLE_DUST_SHEET_COLUMNS*LOOTABLE_DUST_SHEET_ROWS;
const LOOTABLE_DUST_FRAME_MS = 90;
const LOOT_REMNANT_DEPTH_MODES = new Set(["ysort","behind","front","ground"]);
const LOOT_REMNANT_VISUAL = {
  scale: visualScaleOr(VISUAL_CONFIG.remnants?.scale,1),
  depthMode: LOOT_REMNANT_DEPTH_MODES.has(String(VISUAL_CONFIG.remnants?.depthMode||"").toLowerCase())
    ? String(VISUAL_CONFIG.remnants.depthMode).toLowerCase()
    : "ysort",
  depthY: numberOr(VISUAL_CONFIG.remnants?.depthY,3)
};
const PROJECT_LOOT_REMNANT_VISUAL = {...LOOT_REMNANT_VISUAL};
const warnedLootProblems = new Set();
const lootPiles = [];
let nextLootPileId = 1;
let activeLootPileId = null;
let legacyLootPile = null;
let lootPointerDrag = null;
let suppressLootClick = false;
let lootInteractionsBound = false;

const dustPileImage = new Image();
dustPileImage.src = "./assets/loot/dust.png";
let dustPileImageReady = dustPileImage.complete && dustPileImage.naturalWidth > 0;
dustPileImage.onload = () => { dustPileImageReady = true; };

const lootableDustPileImage = new Image();
lootableDustPileImage.src = "./assets/loot/lootable-dust.png";
let lootableDustPileImageReady = lootableDustPileImage.complete && lootableDustPileImage.naturalWidth > 0;
lootableDustPileImage.onload = () => { lootableDustPileImageReady = true; };

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

// Kept for developer tools and scripted rewards that intentionally bypass
// world remnants. Normal mob deaths use rollMobLoot + spawnMobLootPile.
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

function lootPileHasLoot(pile){
  return !!pile && (
    Math.max(0,Math.floor(numberOr(pile.gold,0)))>0 ||
    Math.max(0,Math.floor(numberOr(pile.potions,0)))>0 ||
    (Array.isArray(pile.items)&&pile.items.some(drop=>Math.max(0,Math.floor(numberOr(drop?.qty,0)))>0))
  );
}

function activeLootPile(){
  if(legacyLootPile && legacyLootPile.id===activeLootPileId) return legacyLootPile;
  return lootPiles.find(pile=>pile.id===activeLootPileId)||null;
}

function spawnLootPile({x,y,drops=[],gold=0,potions=0,sourceLabel="Defeated enemy"}={},now=performance.now()){
  const pile={
    id:nextLootPileId++,
    x:numberOr(x,state?.x??0),
    y:numberOr(y,state?.y??0),
    sourceLabel:String(sourceLabel||"Defeated enemy"),
    items:normalizePendingLoot(drops),
    gold:Math.max(0,Math.floor(numberOr(gold,0))),
    potions:Math.max(0,Math.floor(numberOr(potions,0))),
    createdAt:numberOr(now,performance.now()),
    expiresAt:numberOr(now,performance.now())+LOOT_PILE_LIFETIME_MS
  };
  lootPiles.push(pile);
  return pile;
}

function spawnMobLootPile(mob,drops=[],gold=0,potions=0,sourceLabel="Defeated enemy",now=performance.now()){
  return spawnLootPile({
    x:numberOr(mob?.x,state?.x??0),
    y:numberOr(mob?.y,state?.y??0),
    drops,gold,potions,sourceLabel
  },now);
}

function clearLootPiles(){
  lootPiles.length=0;
  activeLootPileId=null;
  legacyLootPile=null;
  document.getElementById("lootWindow")?.classList.remove("show");
}

function updateLootPiles(now=performance.now()){
  const t=numberOr(now,performance.now());
  let activeExpired=false;
  for(let i=lootPiles.length-1;i>=0;i--){
    if(t>=lootPiles[i].expiresAt){
      if(lootPiles[i].id===activeLootPileId) activeExpired=true;
      lootPiles.splice(i,1);
    }
  }
  if(activeExpired) closeLootWindow();
}

function lootPileRemainingMs(pile,now=performance.now()){
  return Math.max(0,numberOr(pile?.expiresAt,0)-numberOr(now,performance.now()));
}

function lootRemnantDepthMode(){
  const raw=String(LOOT_REMNANT_VISUAL.depthMode||"ysort").toLowerCase();
  return LOOT_REMNANT_DEPTH_MODES.has(raw)?raw:"ysort";
}

function lootRemnantDepthY(){
  return numberOr(LOOT_REMNANT_VISUAL.depthY,3);
}

function lootRemnantRenderDepth(pile,heroY){
  const mode=lootRemnantDepthMode();
  if(mode==="ground") return -1000000000;
  if(mode==="behind") return heroY-0.25;
  if(mode==="front") return heroY+0.25;
  return numberOr(pile?.y,0)+lootRemnantDepthY();
}

function lootRemnantDrawSize(){
  return LOOT_PILE_DRAW_SIZE*visualScaleOr(LOOT_REMNANT_VISUAL.scale,1);
}


function lootableDustFrameRect(image,frameIndex){
  const cols=LOOTABLE_DUST_SHEET_COLUMNS;
  const rows=LOOTABLE_DUST_SHEET_ROWS;
  const total=Math.max(1,cols*rows);
  const frame=((Math.floor(numberOr(frameIndex,0))%total)+total)%total;
  const col=frame%cols;
  const row=Math.floor(frame/cols);
  const sx=Math.round(col*image.naturalWidth/cols);
  const sy=Math.round(row*image.naturalHeight/rows);
  const ex=Math.round((col+1)*image.naturalWidth/cols);
  const ey=Math.round((row+1)*image.naturalHeight/rows);
  return {sx,sy,sw:Math.max(1,ex-sx),sh:Math.max(1,ey-sy)};
}

function drawLootableDustSprite(c,image,sx,sy,size,now){
  const total=Math.max(1,LOOTABLE_DUST_FRAME_COUNT);
  const frame=Math.floor(numberOr(now,0)/LOOTABLE_DUST_FRAME_MS)%total;
  const rect=lootableDustFrameRect(image,frame);
  c.drawImage(image,rect.sx,rect.sy,rect.sw,rect.sh,Math.round(sx-size/2),Math.round(sy-size*.72),Math.round(size),Math.round(size));
}

function drawLootPile(c,pile,camX,camY,now=performance.now()){
  if(!pile) return;
  const hasLoot=lootPileHasLoot(pile);
  const image=hasLoot?lootableDustPileImage:dustPileImage;
  const ready=hasLoot?lootableDustPileImageReady:dustPileImageReady;
  const remaining=lootPileRemainingMs(pile,now);
  if(remaining<=0) return;

  const fade=remaining<LOOT_PILE_FADE_MS?clamp(remaining/LOOT_PILE_FADE_MS,0,1):1;
  const pulse=hasLoot?1+Math.sin(numberOr(now,0)/240)*.018:1;
  const size=lootRemnantDrawSize()*pulse;
  const sx=pile.x-camX;
  const sy=pile.y-camY;
  c.save();
  c.globalAlpha=fade;
  c.imageSmoothingEnabled=false;
  if(ready&&image.naturalWidth){
    if(hasLoot&&LOOTABLE_DUST_FRAME_COUNT>1) drawLootableDustSprite(c,image,sx,sy,size,now);
    else c.drawImage(image,Math.round(sx-size/2),Math.round(sy-size*.72),Math.round(size),Math.round(size));
  }else{
    c.fillStyle=hasLoot?"rgba(236,208,128,.85)":"rgba(137,124,119,.72)";
    c.beginPath();c.ellipse(sx,sy+4,size*.34,size*.14,0,0,Math.PI*2);c.fill();
  }
  c.restore();
}

function findLootPileAtWorld(wx,wy,{lootableOnly=true}={}){
  let best=null,bestScore=Infinity;
  for(const pile of lootPiles){
    if(lootableOnly&&!lootPileHasLoot(pile)) continue;
    const dx=wx-pile.x;
    const dy=wy-pile.y;
    if(Math.abs(dx)>34||dy<-30||dy>24) continue;
    const score=dx*dx+(dy*.8)*(dy*.8);
    if(score<bestScore){best=pile;bestScore=score;}
  }
  return best;
}

function isLootWindowOpen(){
  return !!document.getElementById("lootWindow")?.classList.contains("show");
}

function renderLootInventory(){
  if(document.getElementById("backpack")?.classList.contains("show")) renderInventory();
  else updateBackpackHud();
}

function lootCurrencyMarkup(kind,qty){
  if(kind==="gold") return `<button class="lootSlot lootCurrencySlot" data-loot-kind="gold" aria-label="Take ${qty} gold"><span class="lootCurrencyIcon goldCoin">●</span><span class="lootItemName">Gold</span><span class="lootItemQty">${qty}</span></button>`;
  return `<button class="lootSlot lootCurrencySlot" data-loot-kind="potions" aria-label="Take ${qty} potion${qty===1?"":"s"}"><span class="lootCurrencyIcon potionIcon">+</span><span class="lootItemName">Potion${qty===1?"":"s"}</span><span class="lootItemQty">${qty}</span></button>`;
}

function renderLootWindow(){
  const pile=activeLootPile();
  const grid=document.getElementById("lootGrid");
  if(grid){
    if(!pile||!lootPileHasLoot(pile)){
      grid.innerHTML='<div class="lootEmpty">Nothing left to collect.</div>';
    }else{
      const rows=[];
      if(pile.gold>0) rows.push(lootCurrencyMarkup("gold",pile.gold));
      if(pile.potions>0) rows.push(lootCurrencyMarkup("potions",pile.potions));
      pile.items.forEach((drop,index)=>{
        const def=getItemDefinition(drop.itemId);
        rows.push(`<button class="lootSlot" data-loot-kind="item" data-loot-index="${index}" aria-label="Take ${drop.qty} ${inventoryEscape(def.name)}">${itemVisualMarkup(def,"lootItemIcon","lootItemSymbol")}<span class="lootItemName">${inventoryEscape(def.name)}</span><span class="lootItemQty">${drop.qty}</span></button>`);
      });
      grid.innerHTML=rows.join("");
    }
  }
  renderLootInventory();
}

function openLootPile(pile){
  if(!pile||!lootPileHasLoot(pile)) return false;
  activeLootPileId=pile.id;
  legacyLootPile=pile===legacyLootPile?legacyLootPile:null;
  document.getElementById("lootWindow")?.classList.add("show");
  renderLootWindow();
  constrainFloatingPanel?.("lootPanel");
  return true;
}

function interactWithLootPile(pile){
  if(!pile||!lootPileHasLoot(pile)) return false;
  if(dist(state.x,state.y,pile.x,pile.y)>LOOT_PILE_INTERACT_RANGE){
    toast?.("Move closer to loot the remains.");
    return true;
  }
  openLootPile(pile);
  return true;
}

// Compatibility API for developer tools/tests. This opens a temporary list but
// does not create a persistent world pile. Normal mob deaths never call it.
function openLootWindow(drops,sourceLabel="Defeated enemy"){
  const normalized=normalizePendingLoot(drops);
  if(!normalized.length) return false;
  legacyLootPile={id:`legacy-${nextLootPileId++}`,x:state?.x??0,y:state?.y??0,sourceLabel:String(sourceLabel||"Defeated enemy"),items:normalized,gold:0,potions:0,createdAt:performance.now(),expiresAt:Infinity};
  activeLootPileId=legacyLootPile.id;
  document.getElementById("lootWindow")?.classList.add("show");
  renderLootWindow();
  constrainFloatingPanel?.("lootPanel");
  return true;
}

function closeLootWindow(){
  activeLootPileId=null;
  legacyLootPile=null;
  document.getElementById("lootWindow")?.classList.remove("show");
}

function finishLootInteractionIfEmpty(pile){
  if(!pile||lootPileHasLoot(pile)){
    renderLootWindow();
    return;
  }
  closeLootWindow();
  renderLootInventory();
}

function takeLootAtIndex(index,targetSlot=null){
  const pile=activeLootPile();
  const i=Math.floor(numberOr(index,-1));
  const drop=pile?.items?.[i];
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
  if(drop.qty<=0) pile.items.splice(i,1);
  finishLootInteractionIfEmpty(pile);
  return result;
}

function takeGoldFromActivePile(){
  const pile=activeLootPile();
  if(!pile||pile.gold<=0) return 0;
  const amount=pile.gold;
  pile.gold=0;
  state.gold+=amount;
  updateUI?.();
  finishLootInteractionIfEmpty(pile);
  return amount;
}

function takePotionsFromActivePile(){
  const pile=activeLootPile();
  if(!pile||pile.potions<=0) return 0;
  const amount=pile.potions;
  pile.potions=0;
  state.potions+=amount;
  updateUI?.();
  finishLootInteractionIfEmpty(pile);
  return amount;
}

function takeAllLoot(){
  const pile=activeLootPile();
  if(!pile) return;
  if(pile.gold>0){state.gold+=pile.gold;pile.gold=0;}
  if(pile.potions>0){state.potions+=pile.potions;pile.potions=0;}
  for(let i=pile.items.length-1;i>=0;i--){
    const drop=pile.items[i];
    const result=addItem(drop.itemId,drop.qty);
    drop.qty=result.remaining;
    if(drop.qty<=0) pile.items.splice(i,1);
  }
  updateUI?.();
  if(!lootPileHasLoot(pile)) closeLootWindow();
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
  const slot=event.target.closest?.('.lootSlot[data-loot-kind="item"][data-loot-index]');
  if(!slot) return;
  const pile=activeLootPile();
  const index=Number(slot.dataset.lootIndex);
  if(!pile?.items?.[index]) return;
  lootPointerDrag={pointerId:event.pointerId,index,startX:event.clientX,startY:event.clientY,active:false,ghost:null};
  slot.setPointerCapture?.(event.pointerId);
}

function lootDragPointerMove(event){
  const drag=lootPointerDrag;
  if(!drag||event.pointerId!==drag.pointerId) return;
  const distance=Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY);
  if(!drag.active&&distance<6) return;
  if(!drag.active){
    const drop=activeLootPile()?.items?.[drag.index];
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
  const slot=event.target.closest?.(".lootSlot[data-loot-kind]");
  if(!slot) return;
  const kind=slot.dataset.lootKind;
  if(kind==="gold") takeGoldFromActivePile();
  else if(kind==="potions") takePotionsFromActivePile();
  else if(kind==="item") takeLootAtIndex(Number(slot.dataset.lootIndex));
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
  spawnPile:spawnLootPile,
  spawnMobPile:spawnMobLootPile,
  clearPiles:clearLootPiles,
  updatePiles:updateLootPiles,
  getPiles:()=>lootPiles.map(pile=>({...pile,items:pile.items.map(drop=>({...drop}))})),
  pileHasLoot:lootPileHasLoot,
  openPile:openLootPile,
  openWindow:openLootWindow,
  closeWindow:closeLootWindow,
  takeAt:takeLootAtIndex,
  takeGold:takeGoldFromActivePile,
  takePotions:takePotionsFromActivePile,
  takeAll:takeAllLoot,
  getPending:()=>activeLootPile()?.items?.map(drop=>({...drop}))||[],
  formatDrops:formatLootDrops,
  validate:validateLootConfig,
  lifetimeMs:LOOT_PILE_LIFETIME_MS
});

// 0 grass, 1 water, 2 forest, 3 road, 4 town, 5 legacy castle, 6 blocked forest, 7 dirt clearing
const world = Array.from({length:WORLD_H}, () => Array(WORLD_W).fill(0));

function paintWorldRect(x1,y1,x2,y2,type){
  for(let y=Math.max(0,y1);y<=Math.min(WORLD_H-1,y2);y++){
    for(let x=Math.max(0,x1);x<=Math.min(WORLD_W-1,x2);x++) world[y][x]=type;
  }
}
function paintWorldH(y,x1,x2,type,width=1){
  for(let yy=y;yy<y+width;yy++) for(let x=x1;x<=x2;x++) if(yy>=0&&yy<WORLD_H&&x>=0&&x<WORLD_W) world[yy][x]=type;
}
function paintWorldV(x,y1,y2,type,width=1){
  for(let xx=x;xx<x+width;xx++) for(let y=y1;y<=y2;y++) if(xx>=0&&xx<WORLD_W&&y>=0&&y<WORLD_H) world[y][xx]=type;
}

function buildWorld(){
  // Large starter region. The outer forest is deliberately non-walkable so the
  // zone feels enclosed without surrounding everything with water.
  for(let y=0;y<WORLD_H;y++){
    for(let x=0;x<WORLD_W;x++) world[y][x]=(x<=1||y<=1||x>=WORLD_W-2||y>=WORLD_H-2)?6:0;
  }

  // Starter Town: open, safe, and spaced out enough for future vendors/quests.
  paintWorldRect(2,2,12,10,4);

  // Main road spine and branches. Two tiles wide where possible so it reads as
  // the route between future zones rather than a thin village footpath.
  paintWorldV(6,8,14,3,2);          // town -> main road
  paintWorldH(13,5,38,3,2);         // west/east spine
  paintWorldV(6,14,18,3,2);         // farm branch
  paintWorldV(18,8,13,3,2);         // slime branch
  paintWorldV(35,10,13,3,2);        // goblin branch
  paintWorldV(36,14,29,3,2);        // road to next zone

  // Farm meadow outside town.
  paintWorldRect(2,17,10,24,0);

  // Slime habitat: mottled dirt/grass with a small pond.
  for(let y=3;y<=10;y++) for(let x=16;x<=27;x++){
    if(worldHash(x+71,y+29)%100<42) world[y][x]=7;
  }
  paintWorldRect(23,7,25,8,1);
  world[7][22]=1; // irregular pond shoulders
  world[8][26]=1;

  // Goblin camp clearing. Dirt is separate from roads so its edges stay broad
  // and camp-like rather than receiving road corner masks.
  paintWorldRect(32,4,41,10,7);
  paintWorldV(35,10,13,3,2);

  // Wilderness forest clusters. Large open corridors remain for roaming wolves.
  const forestAreas=[
    [12,15,17,20],[27,15,33,20],[38,15,41,24],
    [11,24,18,29],[22,23,29,29],[30,25,35,29],
    [13,3,15,10],[28,3,31,11]
  ];
  for(const [x1,y1,x2,y2] of forestAreas){
    for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++){
      if(world[y][x]===0 && worldHash(x*5+11,y*7+3)%100<68) world[y][x]=2;
    }
  }

  // Keep important travel / encounter spaces clear after forest painting.
  paintWorldRect(2,2,12,10,4);
  paintWorldV(6,8,14,3,2);
  paintWorldH(13,5,38,3,2);
  paintWorldV(6,14,18,3,2);
  paintWorldV(18,8,13,3,2);
  paintWorldV(35,10,13,3,2);
  paintWorldV(36,14,29,3,2);

  // Restore the two encounter clearings after the road pass.
  for(let y=3;y<=10;y++) for(let x=16;x<=27;x++){
    if((x===18||x===19) && y>=8) continue;
    world[y][x]=worldHash(x+71,y+29)%100<42?7:0;
  }
  paintWorldRect(23,7,25,8,1); world[7][22]=1; world[8][26]=1;
  paintWorldRect(32,4,41,10,7); paintWorldV(35,10,13,3,2);
}

const sceneryTrees=[];
const sceneryHouses=[];
const sceneryFences=[];
const scenerySigns=[];
const sceneryNPCs=[];
const sceneryProps=[];
let solidRects=[];

// drawWorld reuses these small wrapper records. This keeps depth sorting simple
// while avoiding a fresh object allocation for every visible actor/prop frame.
const visibleWorldRenderables=[];
const worldRenderablePool=[];
let worldRenderableCount=0;

function resetWorldRenderables(){
  visibleWorldRenderables.length=0;
  worldRenderableCount=0;
}

function queueWorldRenderable(kind,depth,obj){
  let item=worldRenderablePool[worldRenderableCount];
  if(!item){
    item={kind:"",depth:0,obj:null};
    worldRenderablePool[worldRenderableCount]=item;
  }
  item.kind=kind;
  item.depth=depth;
  item.obj=obj;
  visibleWorldRenderables.push(item);
  worldRenderableCount++;
}

const PROP_SPECS = {
  signpost:{sx:0,sy:0,sw:79,sh:116,w:42,h:56},
  lamppost:{sx:124,sy:0,sw:69,sh:128,w:38,h:60},
  well:{sx:247,sy:0,sw:102,sh:124,w:62,h:64},
  notice:{sx:370,sy:0,sw:86,sh:113,w:50,h:56},
  sacks:{sx:0,sy:147,sw:100,sh:98,w:48,h:46},
  barrel:{sx:124,sy:147,sw:74,sh:97,w:42,h:48},
  crate:{sx:247,sy:147,sw:76,sh:88,w:44,h:44},
  bench:{sx:370,sy:147,sw:110,sh:61,w:52,h:30},
  mailbox:{sx:0,sy:293,sw:72,sh:110,w:34,h:46},
  haystack:{sx:124,sy:293,sw:104,sh:115,w:56,h:58},
  stool:{sx:247,sy:293,sw:68,sh:91,w:34,h:36},
  cart:{sx:370,sy:293,sw:115,sh:91,w:62,h:44},
  hay:{sx:0,sy:439,sw:98,sh:78,w:50,h:42},
  table:{sx:124,sy:439,sw:98,sh:81,w:52,h:32},
  flowerBoxA:{sx:247,sy:439,sw:99,sh:78,w:50,h:30},
  flowerBoxB:{sx:370,sy:439,sw:95,sh:68,w:50,h:30},
  scarecrow:{sx:0,sy:586,sw:103,sh:127,w:44,h:64},
  stoneWallCorner:{sx:124,sy:586,sw:98,sh:109,w:50,h:48},
  fenceCorner:{sx:247,sy:586,sw:98,sh:96,w:48,h:44},
  trough:{sx:370,sy:586,sw:116,sh:95,w:60,h:36},
  rockPile:{sx:0,sy:732,sw:103,sh:83,w:50,h:34},
  fence:{sx:124,sy:732,sw:104,sh:76,w:48,h:28},
  gate:{sx:247,sy:732,sw:106,sh:82,w:48,h:44},
  stoneWall:{sx:370,sy:732,sw:106,sh:71,w:50,h:34},
  stump:{sx:0,sy:878,sw:105,sh:96,w:44,h:36},
  bush:{sx:124,sy:878,sw:101,sh:94,w:42,h:34},
  campfire:{sx:247,sy:877,sw:102,sh:97,w:44,h:40},
  flowerBush:{sx:369,sy:878,sw:91,sh:91,w:44,h:34},
  log:{sx:0,sy:1024,sw:119,sh:86,w:50,h:34},
  boulder:{sx:124,sy:1024,sw:103,sh:80,w:44,h:34},
  flowerPatch:{sx:247,sy:1024,sw:97,sh:81,w:42,h:30},
  mushrooms:{sx:370,sy:1024,sw:86,sh:73,w:36,h:34},
  goblinTotem:{sx:0,sy:1171,sw:89,sh:145,w:44,h:66},
  goblinTent:{sx:124,sy:1171,sw:120,sh:140,w:56,h:56},
  trainingDummy:{sx:247,sy:1171,sw:90,sh:128,w:42,h:56},
  cauldron:{sx:370,sy:1171,sw:109,sh:121,w:52,h:56},
  archeryTarget:{sx:0,sy:1317,sw:97,sh:107,w:46,h:54},
  chest:{sx:124,sy:1317,sw:86,sh:87,w:44,h:38},
  spikeBarricade:{sx:247,sy:1317,sw:106,sh:104,w:52,h:34},
  bones:{sx:370,sy:1317,sw:109,sh:82,w:48,h:38},
  marketRed:{sx:0,sy:1463,sw:107,sh:134,w:52,h:54},
  woodpile:{sx:124,sy:1463,sw:106,sh:118,w:52,h:44},
  barrels3:{sx:247,sy:1463,sw:102,sh:106,w:54,h:44},
  crates3:{sx:370,sy:1463,sw:92,sh:105,w:52,h:44},
  marketBlue:{sx:0,sy:1610,sw:106,sh:105,w:52,h:52},
  wheel:{sx:124,sy:1610,sw:87,sh:92,w:40,h:40},
  barrelOpen:{sx:247,sy:1610,sw:89,sh:95,w:44,h:42},
  bucket:{sx:370,sy:1610,sw:65,sh:80,w:30,h:34},
  lanternPost:{sx:0,sy:1756,sw:86,sh:129,w:38,h:60},
  hayCrate:{sx:124,sy:1756,sw:119,sh:126,w:56,h:44},
  grave:{sx:247,sy:1756,sw:102,sh:124,w:38,h:44},
  birdbath:{sx:370,sy:1756,sw:106,sh:123,w:44,h:48},
  clothesline:{sx:0,sy:1902,sw:123,sh:104,w:52,h:40},
  flowerCart:{sx:124,sy:1902,sw:111,sh:111,w:52,h:38},
  bridge:{sx:247,sy:1902,sw:115,sh:104,w:52,h:40},
  steppingStones:{sx:369,sy:1901,sw:100,sh:98,w:52,h:34},
};

const WORLD_OBJECT_DEPTH_MODES = new Set(["ysort","behind","front","ground"]);

function worldObjectDepthMode(obj){
  const raw=String(obj?.depthMode||"ysort").toLowerCase();
  if(raw==="background" || raw==="back") return "behind";
  if(raw==="foreground" || raw==="overlay") return "front";
  return WORLD_OBJECT_DEPTH_MODES.has(raw)?raw:"ysort";
}

function worldObjectBaseSize(obj){
  if(!obj) return {w:32,h:32};
  if(obj.type==="crops") return {w:obj.w||90,h:obj.h||70};
  if(obj.type==="blockedGate") return {w:150,h:62};
  if(obj.type==="caveEntrance") return {w:obj.w||220,h:obj.h||160};
  return PROP_SPECS[obj.type]||{w:32,h:32};
}

function defaultWorldObjectDepthY(obj){
  const spec=worldObjectBaseSize(obj);
  const hb=obj?.hitbox;
  const hitBottom=Number(hb?.y)+Number(hb?.h);
  if(Number.isFinite(hitBottom)) return clamp(hitBottom,0,spec.h);
  return Math.max(0,spec.h-2);
}

function worldObjectDepthY(obj){
  return numberOr(obj?.depthY,defaultWorldObjectDepthY(obj));
}

function worldObjectRenderDepth(obj,heroY){
  const mode=worldObjectDepthMode(obj);
  if(mode==="ground") return -1000000000;
  if(mode==="behind") return heroY-0.25;
  if(mode==="front") return heroY+0.25;
  return obj.y+worldObjectDepthY(obj);
}

const NPC_PLACEHOLDER_SPRITE = "./assets/npcs/npc-placeholder.png";

function npcDepthMode(npc){
  const raw=String(npc?.depthMode||"ysort").toLowerCase();
  if(raw==="background" || raw==="back") return "behind";
  if(raw==="foreground" || raw==="overlay") return "front";
  return WORLD_OBJECT_DEPTH_MODES.has(raw)?raw:"ysort";
}

function defaultNpcDepthY(npc){
  const hb=npc?.hitbox;
  const bottom=Number(hb?.y)+Number(hb?.h);
  return Number.isFinite(bottom)?Math.max(8,bottom):12;
}

function npcDepthY(npc){
  return numberOr(npc?.depthY,defaultNpcDepthY(npc));
}

function npcRenderDepth(npc,heroY){
  const mode=npcDepthMode(npc);
  if(mode==="ground") return -1000000000;
  if(mode==="behind") return heroY-0.25;
  if(mode==="front") return heroY+0.25;
  return npc.y+npcDepthY(npc);
}

function npcDisplayHeight(npc){
  return Math.max(24,numberOr(npc?.displayHeight,58))*VISUAL_SCALE.npcs;
}

function npcVisualBounds(npc){
  const h=npcDisplayHeight(npc);
  const halfW=Math.max(10,h*.34);
  return {x:npc.x-halfW,y:npc.y-h+14,w:halfW*2,h:h};
}

const MOB_SPAWN_TILES = new Set([
  "18,5","21,4","24,6","19,8","22,9","26,5",
  "34,6","37,5","39,8","35,9","40,6",
  "15,17","21,16","27,19","32,23","18,26","25,27","33,18","39,21",
  "4,20","8,22","6,21","9,20","5,23","7,19","9,23"
]);

function addSolidRect(x,y,w,h,type="solid"){
  solidRects.push({x,y,w,h,type});
}

function cloneNpc(obj){
  return JSON.parse(JSON.stringify(obj));
}

function normalizeNpcRecord(raw,index=0){
  const npc=cloneNpc(raw||{});
  npc.id=String(npc.id||`npc-${index+1}`).trim().replace(/\s+/g,"-").toLowerCase();
  npc.name=String(npc.name||npc.id||"NPC");
  npc.role=String(npc.role||"Villager");
  npc.sprite=(typeof npc.sprite==="string"&&npc.sprite.trim())?npc.sprite:NPC_PLACEHOLDER_SPRITE;
  npc.x=numberOr(npc.x,START_X);
  npc.y=numberOr(npc.y,START_Y);
  npc.facing=["down","left","right","up"].includes(npc.facing)?npc.facing:"down";
  npc.solid=npc.solid!==false;
  npc.displayHeight=Math.max(24,numberOr(npc.displayHeight,58));
  npc.greeting=String(npc.greeting||`Hello. I'm ${npc.name}.`);
  npc.interactRadius=Math.max(20,numberOr(npc.interactRadius,58));
  const hb=npc.hitbox&&typeof npc.hitbox==="object"?npc.hitbox:{};
  npc.hitbox={
    x:numberOr(hb.x,-6),
    y:numberOr(hb.y,-7),
    w:Math.max(2,numberOr(hb.w,12)),
    h:Math.max(2,numberOr(hb.h,14))
  };
  npc.depthMode=npcDepthMode(npc);
  npc.depthY=numberOr(npc.depthY,defaultNpcDepthY(npc));
  return npc;
}

function getProjectNPCs(){
  return (PROJECT_NPCS||[]).map((npc,index)=>normalizeNpcRecord(npc,index));
}

function rebuildNpcCollision(){
  solidRects=solidRects.filter(r=>r.type!=="npc");
  for(const npc of sceneryNPCs){
    if(npc.solid===false) continue;
    const hb=npc.hitbox||{};
    const w=Math.max(6,numberOr(hb.w,12));
    const h=Math.max(6,numberOr(hb.h,14));
    const x=numberOr(hb.x,-w/2);
    const y=numberOr(hb.y,-h/2);
    addSolidRect(npc.x+x,npc.y+y,w,h,"npc");
  }
}

function findNpcAtWorld(wx,wy){
  let best=null,bestScore=Infinity;
  for(const npc of sceneryNPCs){
    const h=Math.max(30,npcDisplayHeight(npc));
    const dx=Math.abs(wx-npc.x);
    const dy=wy-npc.y;
    const halfW=Math.max(18,h*.30);
    if(dx<=halfW && dy>=-h && dy<=18){
      const score=dx*dx+(dy*.55)*(dy*.55);
      if(score<bestScore){best=npc;bestScore=score;}
    }
  }
  return best;
}

function nearestInteractableNpc(range=72){
  let best=null,bestDist=Infinity;
  for(const npc of sceneryNPCs){
    const d=dist(state.x,state.y,npc.x,npc.y);
    const allowed=Math.max(range,numberOr(npc.interactRadius,58));
    if(d<=allowed && d<bestDist){best=npc;bestDist=d;}
  }
  return best;
}

function buildScenery(){
  sceneryTrees.length=0;
  sceneryHouses.length=0;
  sceneryFences.length=0;
  scenerySigns.length=0;
  sceneryNPCs.length=0;
  sceneryProps.length=0;
  solidRects=[];

  // ----- Starter Town -----
  const houses=[
    {type:"A",x:3*TILE+4, y:3*TILE-18},
    {type:"B",x:7*TILE+12,y:3*TILE-12},
    {type:"B",x:3*TILE-2, y:7*TILE-22},
    {type:"A",x:9*TILE-8, y:7*TILE-26},
    // Farm barn / farmhouse.
    {type:"A",x:3*TILE+4, y:18*TILE-24}
  ];
  for(const placement of houses){
    const spec=HOUSE_SPECS[placement.type];
    const obj={...placement,spec};
    sceneryHouses.push(obj);
    const f=spec.footprint;
    addSolidRect(placement.x+f.x,placement.y+f.y,f.w,f.h,"house");
  }
  // Static world props come from config/world-objects.js. Developer Mode can
  // edit this list visually and export a replacement config file.
  sceneryProps.push(...getProjectWorldObjects());

  // NPC placement is project data now. World Builder can move/add/delete NPCs
  // and export config/npcs.js without changing this runtime module.
  sceneryNPCs.push(...getProjectNPCs());
  rebuildNpcCollision();
  addSolidRect(6*TILE+15,5*TILE+25,30,24,"well");

  // Farm perimeter. Keep a gate opening on the north side near the road.
  sceneryFences.push(
    {x:2*TILE+8,y:17*TILE+4,dir:"h",len:8},
    {x:8*TILE+18,y:17*TILE+4,dir:"h",len:5},
    {x:2*TILE+8,y:24*TILE+28,dir:"h",len:19},
    {x:2*TILE+8,y:17*TILE+4,dir:"v",len:18},
    {x:10*TILE+18,y:17*TILE+4,dir:"v",len:18}
  );

  // Crude camp palisades; intentionally decorative for now so combat movement
  // stays fluid inside the camp.
  sceneryFences.push(
    {x:32*TILE+6,y:4*TILE+6,dir:"h",len:21},
    {x:32*TILE+6,y:10*TILE+16,dir:"h",len:21},
    {x:32*TILE+6,y:4*TILE+6,dir:"v",len:14},
    {x:41*TILE-6,y:4*TILE+6,dir:"v",len:14}
  );

  scenerySigns.push(
    {x:6*TILE+8,y:10*TILE+8,text:"Starter Town"},
    {x:7*TILE+8,y:17*TILE+10,text:"Farm"},
    {x:18*TILE+8,y:10*TILE+5,text:"Slimes"},
    {x:35*TILE+8,y:10*TILE+5,text:"Goblin Camp"},
    {x:36*TILE+4,y:27*TILE+30,text:"Snickers Cave"}
  );

  // Forest object placement. Boundary forest is deliberately denser than the
  // interior clusters; only the trunk remains solid, as in the stable build.
  const reserved=new Set([...MOB_SPAWN_TILES]);
  for(let ty=0;ty<WORLD_H;ty++){
    for(let tx=0;tx<WORLD_W;tx++){
      const wt=world[ty][tx];
      if(wt!==2 && wt!==6) continue;
      if(reserved.has(`${tx},${ty}`)) continue;
      const threshold=wt===6?82:48;
      if(worldHash(tx,ty)%100>=threshold) continue;
      const ox=(worldHash(tx+31,ty+11)%15)-7;
      const oy=(worldHash(tx+7,ty+41)%11)-5;
      const obj={x:tx*TILE+ox,y:ty*TILE+oy,variant:worldHash(tx,ty)%6};
      sceneryTrees.push(obj);
      addSolidRect(obj.x+24,obj.y+38,16,19,"tree");
    }
  }

  // blockedGate objects are registered as "zone-gate" collision by Developer Mode.
  rebuildWorldObjectCollision();
}

const tile = {
  0:{walk:true},
  1:{walk:false},
  2:{walk:true},
  3:{walk:true},
  4:{walk:true},
  5:{walk:true},
  6:{walk:false},
  7:{walk:true}
};

function tileAtWorld(px,py){
  const tx=Math.floor(px/TILE);
  const ty=Math.floor(py/TILE);
  if(tx<0||ty<0||tx>=WORLD_W||ty>=WORLD_H) return 1;
  return world[ty][tx];
}

function circleIntersectsRect(px,py,radius,rect){
  const nearestX=Math.max(rect.x,Math.min(px,rect.x+rect.w));
  const nearestY=Math.max(rect.y,Math.min(py,rect.y+rect.h));
  const dx=px-nearestX;
  const dy=py-nearestY;
  return dx*dx+dy*dy < radius*radius;
}

function hitsSolidScenery(px,py,radius=HERO_RADIUS){
  return solidRects.some(rect=>circleIntersectsRect(px,py,radius,rect));
}

function canStand(px,py,radius=HERO_RADIUS){
  const points=[
    [px-radius,py-radius],
    [px+radius,py-radius],
    [px-radius,py+radius],
    [px+radius,py+radius],
    [px,py-radius],
    [px,py+radius],
    [px-radius,py],
    [px+radius,py]
  ];
  if(!points.every(([x,y])=>tile[tileAtWorld(x,y)].walk)) return false;
  return !hitsSolidScenery(px,py,radius);
}

function drawAtlasCell(col,row,x,y,w,h){
  if(!environmentAtlasReady) return false;
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(
    environmentAtlas,
    col*ENV_ATLAS_CELL,row*ENV_ATLAS_CELL,ENV_ATLAS_CELL,ENV_ATLAS_CELL,
    Math.round(x),Math.round(y),Math.round(w),Math.round(h)
  );
  return true;
}

function worldHash(x,y){
  return Math.abs((x*928371 + y*364479 + x*y*31) % 10007);
}

function drawContinuousTerrain(kind,x,y,tx=0,ty=0){
  if(!terrainTextureReady) return false;
  ctx.imageSmoothingEnabled=false;
  const baseX=kind==="dirt" ? 256 : 0;
  const sx=baseX + (((tx*TILE)%256)+256)%256;
  const sy=(((ty*TILE)%256)+256)%256;

  // Overlap by one pixel so the 1.35x camera transform never exposes seams.
  ctx.drawImage(
    terrainTexture,
    sx,sy,TILE,TILE,
    Math.floor(x)-1,Math.floor(y)-1,TILE+2,TILE+2
  );
  return true;
}

function drawGrassTile(x,y,variant=0,tx=0,ty=0){
  if(!drawContinuousTerrain("grass",x,y,tx,ty)){
    ctx.fillStyle="#718f45";
    ctx.fillRect(Math.floor(x)-1,Math.floor(y)-1,TILE+2,TILE+2);
  }

  // Sparse decoration only, so the underlying tile grid stays invisible.
  if(environmentAtlasReady){
    const h=worldHash(tx+21,ty+9)%43;
    if(h===0) drawAtlasCell(0,3,x+13,y+TILE-17,18,18);
    else if(h===1) drawAtlasCell(3,3,x+37,y+TILE-15,15,15);
  }
}

function drawForestTile(x,y,variant=0,tx=0,ty=0){
  drawGrassTile(x,y,variant,tx,ty);
}

function drawWaterTile(x,y,variant=0,tx=0,ty=0){
  ctx.imageSmoothingEnabled=false;

  if(waterTextureReady){
    const size=512;
    const sx=(((tx*TILE)%size)+size)%size;
    const sy=(((ty*TILE)%size)+size)%size;
    ctx.drawImage(
      waterTexture,
      sx,sy,TILE,TILE,
      Math.floor(x)-1,Math.floor(y)-1,TILE+2,TILE+2
    );
  }else{
    ctx.fillStyle="#247b99";
    ctx.fillRect(Math.floor(x)-1,Math.floor(y)-1,TILE+2,TILE+2);
  }

  // Small moving highlights sit on top of the texture. They are deliberately
  // short/broken so the water never turns back into horizontal tile stripes.
  const t=performance.now()*0.001;
  for(let i=0;i<2;i++){
    const seed=worldHash(tx*31+i*17,ty*37+i*23);
    const rx=x+7+(seed%42)+Math.sin(t*1.7+i+tx*.4+ty*.2)*3;
    const ry=y+10+((seed>>3)%38);
    ctx.fillStyle=i===0?"rgba(202,241,242,.34)":"rgba(143,220,230,.24)";
    ctx.fillRect(Math.round(rx),Math.round(ry),7+(seed%8),1);
    if(seed%3===0) ctx.fillRect(Math.round(rx)+3,Math.round(ry)+2,5,1);
  }
}

function drawRoadTile(x,y,variant=0,tx=0,ty=0){
  if(!drawContinuousTerrain("dirt",x,y,tx,ty)){
    ctx.fillStyle="#a97442";
    ctx.fillRect(Math.floor(x)-1,Math.floor(y)-1,TILE+2,TILE+2);
  }
}

function drawTownTile(x,y,variant=0,tx=0,ty=0){
  drawGrassTile(x,y,variant,tx,ty);
}

function drawCastleGroundTile(x,y,tx=0,ty=0){
  drawRoadTile(x,y,0,tx,ty);
}

function drawTree(x,y,variant=0){
  if(environmentAtlasReady){
    const col=variant%6;
    // Trees intentionally overlap beyond their 64px tile footprint.
    drawAtlasCell(col,1,x-18,y-42,100,108);
    return;
  }
  ctx.fillStyle="#7c4d2a";
  ctx.fillRect(x+27,y+35,10,21);
  ctx.fillStyle="#205433";
  ctx.beginPath();ctx.arc(x+32,y+23,22,0,Math.PI*2);ctx.fill();
}

function drawHouseObject(obj,camX,camY){
  const sx=obj.x-camX;
  const sy=obj.y-camY;
  const spec=obj.spec;
  const scale=VISUAL_SCALE.houses;
  const dw=spec.w*scale, dh=spec.h*scale;
  const dx=sx+spec.w/2-dw/2;
  const dy=sy+spec.h-dh; // keep the physical footprint anchored at the bottom

  if(spec.ready()){
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(spec.image,Math.round(dx),Math.round(dy),Math.round(dw),Math.round(dh));
    return;
  }

  ctx.save();
  ctx.translate(sx+spec.w/2,sy+spec.h);
  ctx.scale(scale,scale);
  ctx.translate(-(sx+spec.w/2),-(sy+spec.h));
  // Simple loading fallback.
  ctx.fillStyle="#d8c7a0";
  ctx.fillRect(sx+14,sy+38,spec.w-28,spec.h-45);
  ctx.fillStyle="#9a4837";
  ctx.fillRect(sx+5,sy+22,spec.w-10,22);
  ctx.fillStyle="#70472c";
  ctx.fillRect(sx+spec.w*.47,sy+spec.h-32,14,32);
  ctx.restore();
}

function drawTreeObject(obj,camX,camY){
  drawTree(obj.x-camX,obj.y-camY,obj.variant||0);
}

function worldTypeAt(tx,ty){
  if(tx<0||ty<0||tx>=WORLD_W||ty>=WORLD_H) return 1;
  return world[ty][tx];
}

function isRoadGround(t){
  return t===3 || t===4 || t===5;
}

function paintContinuousGrassClip(x,y,tx,ty,clipFn){
  ctx.save();
  ctx.beginPath();
  clipFn();
  ctx.clip();
  if(!drawContinuousTerrain("grass",x,y,tx,ty)){
    ctx.fillStyle="#718f45";
    ctx.fillRect(Math.floor(x)-1,Math.floor(y)-1,TILE+2,TILE+2);
  }
  ctx.restore();
}

// This only masks road corners. The protected seamless dirt renderer remains unchanged.
function drawRoadShapeOverlay(x,y,tx,ty){
  const n=isRoadGround(worldTypeAt(tx,ty-1));
  const s=isRoadGround(worldTypeAt(tx,ty+1));
  const w=isRoadGround(worldTypeAt(tx-1,ty));
  const e=isRoadGround(worldTypeAt(tx+1,ty));
  const r=18;

  if(!n && !w) paintContinuousGrassClip(x,y,tx,ty,()=>ctx.rect(x,y,r,r));
  if(!n && !e) paintContinuousGrassClip(x,y,tx,ty,()=>ctx.rect(x+TILE-r,y,r,r));
  if(!s && !w) paintContinuousGrassClip(x,y,tx,ty,()=>ctx.rect(x,y+TILE-r,r,r));
  if(!s && !e) paintContinuousGrassClip(x,y,tx,ty,()=>ctx.rect(x+TILE-r,y+TILE-r,r,r));

  // Soft pixel edge gives the road a laid-in-world look instead of a square stamp.
  ctx.fillStyle="rgba(78,52,31,.20)";
  if(!n) ctx.fillRect(x+16,y+1,32,2);
  if(!s) ctx.fillRect(x+16,y+TILE-3,32,2);
  if(!w) ctx.fillRect(x+1,y+16,2,32);
  if(!e) ctx.fillRect(x+TILE-3,y+16,2,32);
}

function drawWaterEdgeOverlay(x,y,tx,ty){
  const n=worldTypeAt(tx,ty-1)===1;
  const s=worldTypeAt(tx,ty+1)===1;
  const w=worldTypeAt(tx-1,ty)===1;
  const e=worldTypeAt(tx+1,ty)===1;
  const depth=(edge,i)=>5+(worldHash(tx*43+i*11+(edge===1?101:edge===2?203:edge===3?307:409),ty*47+i*13)%7);

  // Let the real grass texture overlap the water in a jagged pixel shoreline.
  // Collision still uses the unchanged water tiles; this is visual only.
  if(!n) paintContinuousGrassClip(x,y,tx,ty,()=>{
    ctx.moveTo(x,y);ctx.lineTo(x+TILE,y);
    for(let i=4;i>=0;i--) ctx.lineTo(x+i*16,y+depth(1,i));
    ctx.closePath();
  });
  if(!s) paintContinuousGrassClip(x,y,tx,ty,()=>{
    ctx.moveTo(x,y+TILE);ctx.lineTo(x+TILE,y+TILE);
    for(let i=4;i>=0;i--) ctx.lineTo(x+i*16,y+TILE-depth(2,i));
    ctx.closePath();
  });
  if(!w) paintContinuousGrassClip(x,y,tx,ty,()=>{
    ctx.moveTo(x,y);ctx.lineTo(x,y+TILE);
    for(let i=4;i>=0;i--) ctx.lineTo(x+depth(3,i),y+i*16);
    ctx.closePath();
  });
  if(!e) paintContinuousGrassClip(x,y,tx,ty,()=>{
    ctx.moveTo(x+TILE,y);ctx.lineTo(x+TILE,y+TILE);
    for(let i=4;i>=0;i--) ctx.lineTo(x+TILE-depth(4,i),y+i*16);
    ctx.closePath();
  });

  // Sandy pixels and foam are broken into short sections instead of straight borders.
  ctx.fillStyle="#b89a62";
  if(!n) for(let i=0;i<4;i++){const d=depth(1,i);ctx.fillRect(x+i*16+2,y+d-2,12,3);}
  if(!s) for(let i=0;i<4;i++){const d=depth(2,i);ctx.fillRect(x+i*16+2,y+TILE-d-1,12,3);}
  if(!w) for(let i=0;i<4;i++){const d=depth(3,i);ctx.fillRect(x+d-2,y+i*16+2,3,12);}
  if(!e) for(let i=0;i<4;i++){const d=depth(4,i);ctx.fillRect(x+TILE-d-1,y+i*16+2,3,12);}

  ctx.fillStyle="rgba(225,244,234,.42)";
  if(!n) for(let i=0;i<3;i++){const d=depth(1,i);ctx.fillRect(x+i*20+8,y+d+2,8,1);}
  if(!s) for(let i=0;i<3;i++){const d=depth(2,i);ctx.fillRect(x+i*20+8,y+TILE-d-3,8,1);}
  if(!w) for(let i=0;i<3;i++){const d=depth(3,i);ctx.fillRect(x+d+2,y+i*20+8,1,8);}
  if(!e) for(let i=0;i<3;i++){const d=depth(4,i);ctx.fillRect(x+TILE-d-3,y+i*20+8,1,8);}
}

function drawFenceObject(obj,camX,camY){
  const x=obj.x-camX, y=obj.y-camY;
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle="#6b4728";
  ctx.strokeStyle="#3f2b1c";
  ctx.lineWidth=1;
  for(let i=0;i<obj.len;i++){
    const ox=obj.dir==="h"?i*28:0;
    const oy=obj.dir==="v"?i*28:0;
    if(obj.dir==="h"){
      ctx.fillRect(x+ox,y+6,31,4); ctx.fillRect(x+ox,y+17,31,4);
      ctx.fillRect(x+ox+4,y+1,5,26); ctx.fillRect(x+ox+25,y+1,5,26);
    }else{
      ctx.fillRect(x+6,y+oy,4,31); ctx.fillRect(x+17,y+oy,4,31);
      ctx.fillRect(x+1,y+oy+4,26,5); ctx.fillRect(x+1,y+oy+25,26,5);
    }
  }
  ctx.restore();
}

function drawSignObject(obj,camX,camY){
  const x=obj.x-camX, y=obj.y-camY;
  ctx.save(); ctx.imageSmoothingEnabled=false;
  ctx.fillStyle="#6a472b"; ctx.fillRect(x+14,y+14,5,24);
  ctx.fillStyle="#9a6b3c"; ctx.fillRect(x+3,y+4,29,14);
  ctx.fillStyle="#d8bd86"; ctx.fillRect(x+6,y+7,23,8);
  ctx.restore();
}

function drawPropAtlasCell(spec,x,y){
  if(!propAtlasReady || !spec) return false;
  ctx.imageSmoothingEnabled=false;
  const sx=Number.isFinite(spec.sx)?spec.sx:spec.col*PROP_ATLAS_CELL;
  const sy=Number.isFinite(spec.sy)?spec.sy:spec.row*PROP_ATLAS_CELL;
  const sw=Number.isFinite(spec.sw)?spec.sw:PROP_ATLAS_CELL;
  const sh=Number.isFinite(spec.sh)?spec.sh:PROP_ATLAS_CELL;
  ctx.drawImage(propAtlas,sx,sy,sw,sh,Math.round(x),Math.round(y),spec.w,spec.h);
  return true;
}

function drawCastle(x,y){
  ctx.imageSmoothingEnabled=false;

  ctx.fillStyle="#565c66";
  ctx.fillRect(x+8,y+18,48,40);
  ctx.fillStyle="#858d98";
  ctx.fillRect(x+12,y+21,40,33);

  // towers
  ctx.fillStyle="#6c737d";
  ctx.fillRect(x+7,y+7,13,19);
  ctx.fillRect(x+25,y+3,14,23);
  ctx.fillRect(x+44,y+7,13,19);

  // battlements
  ctx.fillStyle="#a2a8b1";
  for(const bx of [8,16,26,35,45,53]) ctx.fillRect(x+bx,y+17,5,5);

  // entrance
  ctx.fillStyle="#3f342d";
  ctx.fillRect(x+27,y+38,10,20);
  ctx.fillStyle="#a4783c";
  ctx.fillRect(x+29,y+40,6,18);

  // windows
  ctx.fillStyle="#2e3943";
  ctx.fillRect(x+17,y+31,3,7);
  ctx.fillRect(x+44,y+31,3,7);
}

function npcSpriteImage(path){
  if(!path) return null;
  npcSpriteImage.cache=npcSpriteImage.cache||new Map();
  if(npcSpriteImage.cache.has(path)) return npcSpriteImage.cache.get(path);
  const image=new Image();
  image.src=path;
  image.onload=()=>buildSpriteFrameMeta(image);
  npcSpriteImage.cache.set(path,image);
  return image;
}

function npcQuestMarker(npc){
  if(typeof getNpcQuestMarkerInfo==="function") return getNpcQuestMarkerInfo(npc?.id);
  if(typeof getNpcQuestMarker!=="function") return null;
  const symbol=getNpcQuestMarker(npc?.id)||"";
  return symbol?{symbol,kind:symbol==="?"?"ready":"available"}:null;
}

function drawNpcObject(obj,camX,camY){
  const x=Math.round(obj.x-camX), y=Math.round(obj.y-camY);
  const facingRows={down:0,left:1,right:2,up:3};
  const row=facingRows[obj.facing]??0;
  const image=npcSpriteImage(obj.sprite);
  const displayH=npcDisplayHeight(obj);
  let topY=y-displayH+12;

  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle="rgba(0,0,0,.18)";
  ctx.beginPath();ctx.ellipse(x,y+9,Math.max(6,displayH*.13),3,0,0,Math.PI*2);ctx.fill();

  if(image?.naturalWidth&&image?.naturalHeight){
    const meta=spriteFrameMeta(image,row,0);
    if(meta){
      const dh=displayH;
      const dw=Math.max(1,dh*(meta.sw/meta.sh));
      topY=y-dh+14;
      ctx.drawImage(image,meta.sx,meta.sy,meta.sw,meta.sh,Math.round(x-dw/2),Math.round(topY),Math.round(dw),Math.round(dh));
    }
  }else{
    // Emergency fallback if a sprite asset fails to load. It uses the same
    // per-NPC displayHeight as real sprite sheets so placeholder sizing stays consistent.
    const scale=displayH/18;
    ctx.translate(x,y+15);ctx.scale(scale,scale);ctx.translate(-x,-(y+15));
    ctx.fillStyle="#d9ad84"; ctx.fillRect(x-5,y-11,10,9);
    ctx.fillStyle="#5a3d2d"; ctx.fillRect(x-6,y-13,12,4); ctx.fillRect(x-6,y-9,2,5);
    ctx.fillStyle=obj.shirt||"#627e9b"; ctx.fillRect(x-6,y-2,12,10);
    ctx.fillStyle="#3b2e29"; ctx.fillRect(x-5,y+8,4,7); ctx.fillRect(x+1,y+8,4,7);
    ctx.fillStyle="#202020"; ctx.fillRect(x-3,y-7,1,1); ctx.fillRect(x+2,y-7,1,1);
    topY=y-18*scale;
  }

  const marker=npcQuestMarker(obj);
  if(marker?.symbol){
    const markerColor=marker.kind==="talk"?"#a8a7ae":marker.kind==="ready"?"#ffe17b":"#ffd45b";
    ctx.font="900 15px system-ui";ctx.textAlign="center";
    ctx.lineWidth=3;ctx.strokeStyle="rgba(35,24,15,.82)";ctx.strokeText(marker.symbol,x,topY-7);
    ctx.fillStyle=markerColor;ctx.fillText(marker.symbol,x,topY-7);ctx.textAlign="start";
  }
  ctx.restore();
}

function drawPropObject(obj,camX,camY){
  const x=Math.round(obj.x-camX), y=Math.round(obj.y-camY);
  const spec=PROP_SPECS[obj.type];
  const baseW=spec?.w || (obj.type==="caveEntrance"?(obj.w||244):obj.type==="crops"?(obj.w||90):24);
  const baseH=spec?.h || (obj.type==="caveEntrance"?(obj.h||176):obj.type==="crops"?(obj.h||70):24);
  const pScale=VISUAL_SCALE.props;

  ctx.save(); ctx.imageSmoothingEnabled=false;
  if(pScale!==1){
    ctx.translate(x+baseW/2,y+baseH);
    ctx.scale(pScale,pScale);
    ctx.translate(-(x+baseW/2),-(y+baseH));
  }
  if(spec && drawPropAtlasCell(spec,x,y)){ ctx.restore(); return; }
  if(obj.type==="caveEntrance"){
    const w=obj.w||220, h=obj.h||160;
    ctx.fillStyle="rgba(0,0,0,.22)";
    ctx.beginPath();
    ctx.ellipse(x + w/2, y + h - 8, Math.round(w*0.28), 10, 0, 0, Math.PI*2);
    ctx.fill();
    if(caveEntranceReady && caveEntranceImage.naturalWidth){
      ctx.drawImage(caveEntranceImage, x, y, w, h);
    }else{
      ctx.fillStyle="#5a4a3d"; ctx.fillRect(x+14,y+30,w-28,h-32);
      ctx.fillStyle="#151214"; ctx.fillRect(x+40,y+56,w-80,h-46);
    }
  }else if(obj.type==="crops") {
    const w=obj.w||90,h=obj.h||70;
    ctx.fillStyle="rgba(92,62,38,.42)"; ctx.fillRect(x,y,w,h);
    for(let yy=8;yy<h-4;yy+=18){
      for(let xx=7;xx<w-4;xx+=18){
        const alt=((xx+yy)/18)%2;
        ctx.fillStyle=alt?"#5f9d45":"#7aae4c"; ctx.fillRect(x+xx,y+yy,8,4); ctx.fillRect(x+xx+2,y+yy-4,4,8);
      }
    }
  }else if(obj.type==="blockedGate"){
    ctx.fillStyle="#4f3827"; ctx.fillRect(x,y,8,62); ctx.fillRect(x+142,y,8,62);
    ctx.fillStyle="#755137"; ctx.fillRect(x+5,y+8,140,8); ctx.fillRect(x+5,y+42,140,8);
    ctx.fillStyle="#8e633e"; ctx.fillRect(x+38,y+13,12,44); ctx.fillRect(x+100,y+13,12,44);
    ctx.fillStyle="#6e2e25"; ctx.fillRect(x+59,y+17,33,29); ctx.fillStyle="#e7c064"; ctx.font="900 22px system-ui"; ctx.textAlign="center"; ctx.fillText("×",x+75,y+40); ctx.textAlign="start";
  }else{
    // Fallback placeholder for any future prop ids that are not mapped yet.
    ctx.fillStyle="#8d6740";
    ctx.fillRect(x,y,24,24);
  }
  ctx.restore();
}

const CAMERA_ZOOM = 1.85; // protected camera setting: closer, character-focused POV

function drawWorldHpBar(x,y,value,maxValue,width=38){
  const ratio=Math.max(0,Math.min(1,value/Math.max(1,maxValue)));
  ctx.fillStyle="rgba(0,0,0,.68)";
  ctx.fillRect(Math.round(x-width/2-1),Math.round(y-1),width+2,6);
  ctx.fillStyle=ratio>.5?"#65d978":ratio>.25?"#e2c855":"#e65b5b";
  ctx.fillRect(Math.round(x-width/2),Math.round(y),Math.round(width*ratio),4);
}

function drawWorldCombatFx(camX,camY){
  ctx.textAlign="center";
  ctx.font="800 11px system-ui";
  for(const fx of combatFx){
    const progress=1-fx.life/fx.maxLife;
    const sx=fx.x-camX;
    const sy=fx.y-camY-progress*26;
    ctx.globalAlpha=Math.max(0,1-progress*.82);
    ctx.fillStyle=fx.kind==="heal"?"#72ef9a":fx.kind==="crit"?"#ffd15a":fx.kind==="hurt"?"#ff8d86":fx.kind==="miss"?"#c9d2dc":"#fff1e2";
    ctx.strokeStyle="rgba(0,0,0,.80)";
    ctx.lineWidth=3;
    ctx.strokeText(fx.text,sx,sy);
    ctx.fillText(fx.text,sx,sy);
  }
  ctx.globalAlpha=1;
  ctx.textAlign="start";
}

function drawWorld(){
  const vw=innerWidth, vh=innerHeight;
  const zoom=CAMERA_ZOOM;
  const viewW=vw/zoom, viewH=vh/zoom;
  const camX=state.x-viewW/2;
  const camY=state.y-viewH/2;

  ctx.fillStyle="#718f45";
  ctx.fillRect(0,0,vw,vh);

  ctx.save();
  ctx.scale(zoom,zoom);

  const minX=Math.max(0,Math.floor(camX/TILE)-1);
  const maxX=Math.min(WORLD_W-1,Math.ceil((camX+viewW)/TILE)+1);
  const minY=Math.max(0,Math.floor(camY/TILE)-1);
  const maxY=Math.min(WORLD_H-1,Math.ceil((camY+viewH)/TILE)+1);

  // Ground only. Tiles still exist for gameplay, but not as visible bordered squares.
  for(let y=minY;y<=maxY;y++){
    for(let x=minX;x<=maxX;x++){
      const sx=x*TILE-camX;
      const sy=y*TILE-camY;
      const t=world[y][x];
      const variant=(x+y)%3;

      if(t===1){ drawWaterTile(sx,sy,variant,x,y); drawWaterEdgeOverlay(sx,sy,x,y); }
      else if(t===3){ drawRoadTile(sx,sy,variant,x,y); drawRoadShapeOverlay(sx,sy,x,y); }
      else if(t===4) drawTownTile(sx,sy,variant,x,y);
      else if(t===6) drawForestTile(sx,sy,variant,x,y);
      else if(t===7) drawRoadTile(sx,sy,variant,x,y);
      else if(t===5){
        drawCastleGroundTile(sx,sy,x,y);
        drawCastle(sx,sy);
      }else if(t===2) drawForestTile(sx,sy,variant,x,y);
      else drawGrassTile(sx,sy,variant,x,y);
    }
  }

  // Y-sort scenery, mobs, and the player so overlap feels like an RPG world.
  resetWorldRenderables();

  for(const tree of sceneryTrees){
    const sx=tree.x-camX, sy=tree.y-camY;
    if(sx<-120||sy<-130||sx>viewW+120||sy>viewH+90) continue;
    queueWorldRenderable("tree",tree.y+58,tree);
  }

  for(const house of sceneryHouses){
    const sx=house.x-camX, sy=house.y-camY;
    if(sx<-house.spec.w||sy<-house.spec.h||sx>viewW+60||sy>viewH+60) continue;
    queueWorldRenderable("house",house.y+house.spec.h-5,house);
  }

  for(const fence of sceneryFences){
    const sx=fence.x-camX, sy=fence.y-camY;
    if(sx<-100||sy<-100||sx>viewW+100||sy>viewH+100) continue;
    queueWorldRenderable("fence",fence.y+35,fence);
  }
  for(const sign of scenerySigns){
    const sx=sign.x-camX, sy=sign.y-camY;
    if(sx<-80||sy<-80||sx>viewW+80||sy>viewH+80) continue;
    queueWorldRenderable("sign",sign.y+40,sign);
  }
  for(const prop of sceneryProps){
    const sx=prop.x-camX, sy=prop.y-camY;
    if(sx<-180||sy<-180||sx>viewW+180||sy>viewH+180) continue;
    queueWorldRenderable("prop",worldObjectRenderDepth(prop,state.y),prop);
  }
  for(const npc of sceneryNPCs){
    const sx=npc.x-camX, sy=npc.y-camY;
    if(sx<-60||sy<-80||sx>viewW+60||sy>viewH+60) continue;
    queueWorldRenderable("npc",npcRenderDepth(npc,state.y),npc);
  }

  for(const pile of lootPiles){
    const sx=pile.x-camX, sy=pile.y-camY;
    if(sx<-70||sy<-70||sx>viewW+70||sy>viewH+70) continue;
    queueWorldRenderable("lootPile",lootRemnantRenderDepth(pile,state.y),pile);
  }

  if(devModeActive && devSelectedRemnant && devRemnantPreview){
    const sx=devRemnantPreview.x-camX, sy=devRemnantPreview.y-camY;
    if(sx>=-90&&sy>=-90&&sx<=viewW+90&&sy<=viewH+90){
      queueWorldRenderable("devLootPile",lootRemnantRenderDepth(devRemnantPreview,state.y),devRemnantPreview);
    }
  }

  for(const mob of mobs){
    if(!mob.alive) continue;
    const sx=mob.x-camX, sy=mob.y-camY;
    if(sx<-60||sy<-60||sx>viewW+60||sy>viewH+60) continue;
    queueWorldRenderable("mob",mob.y,mob);
  }

  queueWorldRenderable("hero",state.y,null);
  visibleWorldRenderables.sort((a,b)=>a.depth-b.depth);

  for(const item of visibleWorldRenderables){
    if(item.kind==="tree"){
      drawTreeObject(item.obj,camX,camY);
    }else if(item.kind==="house"){
      drawHouseObject(item.obj,camX,camY);
    }else if(item.kind==="fence"){
      drawFenceObject(item.obj,camX,camY);
    }else if(item.kind==="sign"){
      drawSignObject(item.obj,camX,camY);
    }else if(item.kind==="prop"){
      drawPropObject(item.obj,camX,camY);
    }else if(item.kind==="npc"){
      drawNpcObject(item.obj,camX,camY);
    }else if(item.kind==="lootPile" || item.kind==="devLootPile"){
      drawLootPile(ctx,item.obj,camX,camY);
    }else if(item.kind==="mob"){
      const mob=item.obj;
      let sx=mob.x-camX, sy=mob.y-camY;

      const mScale=mobVisualScale(mob);
      if(mob===selectedTarget || mob===combatTarget){
        ctx.strokeStyle=mob.elite?"rgba(197,140,255,.98)":(mob===combatTarget?"rgba(255,154,92,.96)":"rgba(255,220,96,.96)");
        ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(sx,sy+12,(mob.boss?25:18)*mScale,(mob.boss?10:7)*mScale,0,0,Math.PI*2);ctx.stroke();
      }

      if((mob.attackAnim||0)>0 && mob===combatTarget){
        const phase=Math.sin((1-mob.attackAnim/.20)*Math.PI);
        const dx=state.x-mob.x,dy=state.y-mob.y,len=Math.max(1,Math.hypot(dx,dy));
        sx+=dx/len*6*phase; sy+=dy/len*6*phase;
      }

      ctx.fillStyle="rgba(0,0,0,.20)";
      ctx.beginPath();ctx.ellipse(sx,sy+12,13*Math.min(1.6,mScale),5*Math.min(1.4,mScale),0,0,Math.PI*2);ctx.fill();
      drawMob(ctx,mob,sx,sy);

      if(mob===combatTarget || mob===selectedTarget || mob.hp<mob.maxHp){
        const hpY=sy-(mob.boss?38:29)*mScale;
        ctx.save();
        ctx.font=mob.boss?"900 8px system-ui":"800 7px system-ui";
        ctx.textAlign="center";
        ctx.fillStyle=mobLevelColor(mob.level,mob.boss,mob.elite);
        ctx.fillText(`Lv ${mob.level}${mob.elite?" Elite":""} • ${mobDisplayName(mob)}`,Math.round(sx),Math.round(hpY-5));
        ctx.restore();
        drawWorldHpBar(sx,hpY,mob.hp,mob.maxHp,(mob.boss?52:38)*Math.min(1.5,mScale));
      }else if(mob.aggro){
        ctx.fillStyle="#f2d15f";
        ctx.beginPath();ctx.arc(sx,sy-26*mScale,4,0,Math.PI*2);ctx.fill();
      }
    }else{
      let hx=viewW/2,hy=viewH/2;
      if(playerAttackAnim>0 && combatTarget && combatTarget.alive){
        const phase=Math.sin((1-playerAttackAnim/.20)*Math.PI);
        const dx=combatTarget.x-state.x,dy=combatTarget.y-state.y,len=Math.max(1,Math.hypot(dx,dy));
        hx+=dx/len*5*phase; hy+=dy/len*5*phase;
      }
      drawHero(ctx,hx,hy,0.055*VISUAL_SCALE.player,isHeroMoving,moveAnimTime,heroFacing);
      if(combatTarget || state.hp<state.maxHp) drawWorldHpBar(hx,hy-31*VISUAL_SCALE.player,state.hp,state.maxHp,42);
    }
  }

  drawWorldCombatFx(camX,camY);

  function label(wx,wy,text){
    const sx=wx*TILE-camX;
    const sy=wy*TILE-camY;
    if(sx<-160||sy<-60||sx>viewW+50||sy>viewH+50)return;
    ctx.font="700 11px system-ui";
    const w=ctx.measureText(text).width+14;
    roundedRect(ctx,sx-w/2+24,sy-26,w,20,7,"rgba(74,49,95,.70)");
    ctx.fillStyle="#fff";
    ctx.textAlign="center";
    ctx.fillText(text,sx+24,sy-12);
    ctx.textAlign="start";
  }
  label(7,2.5,"Starter Town");
  label(6,17,"Farm");
  label(22,3,"Slime Spawns");
  label(37,4,"Goblin Camp");
  label(36.35,27.75,"Snickers' Cave");

  if(devModeActive) drawDeveloperOverlay(camX,camY,viewW,viewH);
  ctx.restore();
}

function townEvent(){
  if(enemy)return;
  if(combatTarget) disengageCombat(false);
  if(state.hp<state.maxHp){
    state.hp=state.maxHp;
    toast("Starter Town restored your HP.");
    updateUI();
  }
}

function castleEvent(){
  // Legacy hook retained for save/runtime compatibility. The starter zone's
  // next-area road is physically blocked until a later zone update.
  toast("The next zone is not open yet.");
}

// Data-driven quest runtime ---------------------------------------------------
// Quest definitions live in config/quests.js and can be authored visually in
// World Builder. Runtime progress stays in the normal player save state.

function cloneQuest(value){
  return JSON.parse(JSON.stringify(value));
}

const QUEST_XP_PROFILE_DEFAULTS={
  minor:{mobEquivalent:3,levelCapPercent:5},
  gather:{mobEquivalent:5,levelCapPercent:8},
  standard:{mobEquivalent:8,levelCapPercent:12},
  multi:{mobEquivalent:12,levelCapPercent:15},
  elite:{mobEquivalent:18,levelCapPercent:20},
  dungeon:{mobEquivalent:25,levelCapPercent:25},
  boss:{mobEquivalent:35,levelCapPercent:30},
  story:{mobEquivalent:30,levelCapPercent:25},
  epic:{mobEquivalent:50,levelCapPercent:40},
  repeatable:{mobEquivalent:5,levelCapPercent:8}
};
const QUEST_XP_PROFILE_LABELS={
  minor:"Minor / Talk / Discovery",
  gather:"Gather / Delivery",
  standard:"Standard",
  multi:"Multi-Objective",
  elite:"Elite / Mini-Boss",
  dungeon:"Dungeon",
  boss:"Major Boss",
  story:"Main Story",
  epic:"Epic Finale",
  repeatable:"Repeatable"
};

function normalizeQuestRewardTier(value,fallback="standard"){
  const key=String(value||"").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(QUEST_XP_PROFILE_DEFAULTS,key)?key:fallback;
}

function inferQuestRewardTier(objectives,repeatable=false){
  if(repeatable) return "repeatable";
  const list=Array.isArray(objectives)?objectives:[];
  if(list.length>1) return "multi";
  const type=list[0]?.type;
  if(type==="talk"||type==="visit") return "minor";
  if(type==="collect"||type==="deliver") return "gather";
  return "standard";
}

function questXpProfile(tier,repeatable=false){
  const effective=repeatable?"repeatable":normalizeQuestRewardTier(tier);
  const fallback=QUEST_XP_PROFILE_DEFAULTS[effective]||QUEST_XP_PROFILE_DEFAULTS.standard;
  const configured=BALANCE.quest?.xpProfiles?.[effective]||{};
  return {
    tier:effective,
    mobEquivalent:Math.max(0,numberOr(configured.mobEquivalent,fallback.mobEquivalent)),
    levelCapPercent:Math.max(0,numberOr(configured.levelCapPercent,fallback.levelCapPercent))
  };
}

function questAutoXpForLevel(level,tier="standard",repeatable=false){
  const lv=Math.max(1,Math.min(playerLevelCap(),Math.floor(numberOr(level,1))));
  const profile=questXpProfile(tier,repeatable);
  const raw=Math.max(0,Math.floor(standardMobXpForLevel(lv)*profile.mobEquivalent));
  const requirement=xpRequiredForLevel(lv)||xpRequiredForLevel(Math.max(1,lv-1));
  const cap=requirement>0?Math.floor(requirement*(profile.levelCapPercent/100)):raw;
  return Math.max(0,Math.min(raw,cap));
}

function questDefaultMinLevel(level){
  const gap=Math.max(0,Math.floor(numberOr(BALANCE.quest?.defaultLevelGap,3)));
  return Math.max(1,Math.floor(numberOr(level,1))-gap);
}

function questRecommendedMaxLevel(quest){
  const above=Math.max(0,Math.floor(numberOr(BALANCE.quest?.recommendedLevelsAbove,3)));
  return Math.min(playerLevelCap(),Math.max(quest?.level||1,(quest?.level||1)+above));
}

function questLevelRequirementMet(quest){
  return !state || state.level>=Math.max(1,Math.floor(numberOr(quest?.minLevel,1)));
}

function questLevelText(quest){
  return `Quest Lv ${quest.level} • Requires Lv ${quest.minLevel}+`;
}

function normalizeQuestObjective(raw={}){
  const type=["kill","collect","talk","deliver","visit"].includes(raw.type)?raw.type:"talk";
  const objective={
    type,
    target:typeof raw.target==="string"?raw.target:"",
    amount:Math.max(1,Math.floor(numberOr(raw.amount,1)))
  };
  if(type==="visit"){
    objective.x=numberOr(raw.x,START_X);
    objective.y=numberOr(raw.y,START_Y);
    objective.radius=Math.max(8,numberOr(raw.radius,36));
  }
  if(type==="collect"||type==="deliver") objective.consumeOnTurnIn=raw.consumeOnTurnIn!==false;
  return objective;
}

function normalizeQuestDefinition(raw,index=0){
  const quest=cloneQuest(raw||{});
  quest.id=String(quest.id||`quest-${index+1}`).trim().replace(/\s+/g,"_").toLowerCase();
  quest.title=String(quest.title||quest.id||"Untitled Quest");
  quest.description=String(quest.description||"");
  quest.giverNpc=String(quest.giverNpc||"");
  quest.turnInNpc=String(quest.turnInNpc||quest.giverNpc||"");
  quest.openingDialogue=String(quest.openingDialogue||quest.description||"Can you help me?");
  quest.completionDialogue=String(quest.completionDialogue||"Thank you for your help.");
  quest.objectives=(Array.isArray(quest.objectives)?quest.objectives:[]).map(normalizeQuestObjective);
  if(!quest.objectives.length) quest.objectives=[normalizeQuestObjective({type:"talk",target:quest.turnInNpc||quest.giverNpc,amount:1})];
  quest.level=Math.max(1,Math.min(playerLevelCap(),Math.floor(numberOr(quest.level??quest.questLevel,1))));
  quest.levelRequirementMode=quest.levelRequirementMode==="custom"?"custom":"auto";
  quest.minLevel=quest.levelRequirementMode==="custom"
    ?Math.max(1,Math.min(quest.level,Math.floor(numberOr(quest.minLevel,questDefaultMinLevel(quest.level)))))
    :questDefaultMinLevel(quest.level);
  quest.recommendedMaxLevel=questRecommendedMaxLevel(quest);
  quest.repeatable=!!quest.repeatable;
  quest.rewardTier=normalizeQuestRewardTier(quest.rewardTier,inferQuestRewardTier(quest.objectives,quest.repeatable));
  const rewards=quest.rewards||{};
  const xpMode=rewards.xpMode==="auto"?"auto":"custom";
  quest.rewards={
    xpMode,
    xp:xpMode==="auto"?questAutoXpForLevel(quest.level,quest.rewardTier,quest.repeatable):Math.max(0,Math.floor(numberOr(rewards.xp,0))),
    gold:Math.max(0,Math.floor(numberOr(rewards.gold,0))),
    items:(Array.isArray(rewards.items)?rewards.items:[])
      .filter(item=>item&&typeof item.id==="string"&&item.id)
      .map(item=>({id:item.id,qty:Math.max(1,Math.floor(numberOr(item.qty,1))) }))
  };
  if(Array.isArray(quest.prerequisite)){
    quest.prerequisite=quest.prerequisite
      .map(id=>String(id||"").trim())
      .filter(Boolean);
    if(!quest.prerequisite.length) quest.prerequisite=null;
  }else{
    quest.prerequisite=quest.prerequisite?String(quest.prerequisite).trim():null;
  }
  quest.nextQuest=quest.nextQuest?String(quest.nextQuest).trim():null;
  return quest;
}

let questDefinitions=(PROJECT_QUESTS||[]).map(normalizeQuestDefinition);
let activeNpcDialogId=null;

function replaceQuestDefinitions(list){
  questDefinitions=(Array.isArray(list)?list:[]).map(normalizeQuestDefinition);
  refreshQuestUI();
}

function getQuestDefinition(id){
  return questDefinitions.find(quest=>quest.id===id)||null;
}

function ensureQuestState(){
  if(!state) return {};
  if(!state.quests||typeof state.quests!=="object"||Array.isArray(state.quests)) state.quests={};
  return state.quests;
}

function questWasCompleted(id){
  if(!id) return true;
  const record=ensureQuestState()[id];
  return !!record&&(record.status==="completed"||numberOr(record.completedCount,0)>0);
}

function questPrerequisiteMet(quest){
  if(!quest?.prerequisite) return true;
  if(Array.isArray(quest.prerequisite)) return quest.prerequisite.every(questWasCompleted);
  return questWasCompleted(quest.prerequisite);
}

function questRecord(id){
  return ensureQuestState()[id]||null;
}

function questObjectiveStoredProgress(quest,index){
  const record=questRecord(quest.id);
  return Math.max(0,Math.floor(numberOr(record?.objectives?.[index],0)));
}

function questObjectiveProgress(quest,index){
  const objective=quest?.objectives?.[index];
  if(!objective) return 0;
  if(objective.type==="collect"||objective.type==="deliver") return Math.min(objective.amount,getItemCount(objective.target));
  return Math.min(objective.amount,questObjectiveStoredProgress(quest,index));
}

function questObjectiveComplete(quest,index){
  const objective=quest?.objectives?.[index];
  return !!objective&&questObjectiveProgress(quest,index)>=objective.amount;
}

function questCanTurnIn(quest){
  if(!quest) return false;
  const record=questRecord(quest.id);
  if(!record||record.status!=="active") return false;
  return quest.objectives.every((_,index)=>questObjectiveComplete(quest,index));
}

function getQuestStatus(questOrId){
  const quest=typeof questOrId==="string"?getQuestDefinition(questOrId):questOrId;
  if(!quest) return "locked";
  const record=questRecord(quest.id);
  if(record?.status==="active") return questCanTurnIn(quest)?"ready":"active";
  if(record?.status==="completed"&&!quest.repeatable) return "completed";
  if(!questPrerequisiteMet(quest)) return "locked";
  if(!questLevelRequirementMet(quest)) return "locked";
  return "available";
}

function questsForNpc(npcId,kind="giver"){
  return questDefinitions.filter(quest=>(kind==="turnin"?quest.turnInNpc:quest.giverNpc)===npcId);
}

function getNpcQuestMarkerInfo(npcId){
  if(!state||!npcId) return null;
  if(questsForNpc(npcId,"turnin").some(quest=>getQuestStatus(quest)==="ready")) return {symbol:"?",kind:"ready"};
  if(questsForNpc(npcId,"giver").some(quest=>getQuestStatus(quest)==="available")) return {symbol:"!",kind:"available"};

  // Active talk objectives use a muted grey question mark so players can
  // identify who still needs to be spoken to without confusing that NPC
  // with a normal gold quest turn-in marker.
  const talkTarget=questDefinitions.some(quest=>{
    if(getQuestStatus(quest)!=="active") return false;
    return quest.objectives.some((objective,index)=>
      objective.type==="talk"&&objective.target===npcId&&!questObjectiveComplete(quest,index)
    );
  });
  if(talkTarget) return {symbol:"?",kind:"talk"};
  return null;
}

function getNpcQuestMarker(npcId){
  return getNpcQuestMarkerInfo(npcId)?.symbol||"";
}

function questEscape(value){
  return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

function questTargetLabel(objective){
  if(!objective) return "Objective";
  if(objective.type==="kill"){
    const template=[...enemyTemplates,bossTemplate].find(t=>(t.configKey||t.kind)===objective.target||t.kind===objective.target);
    return template?.name||objective.target||"enemy";
  }
  if(objective.type==="collect"||objective.type==="deliver") return getItemDefinition(objective.target).name;
  if(objective.type==="talk") return sceneryNPCs.find(n=>n.id===objective.target)?.name||objective.target||"NPC";
  if(objective.type==="visit") return `location (${Math.round(objective.x)}, ${Math.round(objective.y)})`;
  return objective.target||"target";
}

function questObjectiveText(quest,index){
  const objective=quest.objectives[index];
  const progress=questObjectiveProgress(quest,index);
  const target=questTargetLabel(objective);
  if(objective.type==="kill") return `Defeat ${target}: ${progress}/${objective.amount}`;
  if(objective.type==="collect") return `Collect ${target}: ${progress}/${objective.amount}`;
  if(objective.type==="deliver") return `Bring ${target}: ${progress}/${objective.amount}`;
  if(objective.type==="talk") return `Talk to ${target}: ${progress}/${objective.amount}`;
  if(objective.type==="visit") return `Visit ${target}: ${progress}/${objective.amount}`;
  return `${target}: ${progress}/${objective.amount}`;
}

function questRewardText(quest){
  const parts=[];
  if(quest.rewards.xp) parts.push(`${quest.rewards.xp} XP`);
  if(quest.rewards.gold) parts.push(`${quest.rewards.gold} gold`);
  for(const item of quest.rewards.items) parts.push(`${item.qty}× ${getItemDefinition(item.id).name}`);
  return parts.length?parts.join(" • "):"No reward";
}

function acceptQuest(id){
  const quest=getQuestDefinition(id);
  if(!quest||getQuestStatus(quest)!=="available") return false;
  const old=ensureQuestState()[quest.id]||{};
  ensureQuestState()[quest.id]={
    status:"active",
    objectives:quest.objectives.map(()=>0),
    completedCount:Math.max(0,Math.floor(numberOr(old.completedCount,0))),
    acceptedAt:Date.now(),
    readyAnnounced:false,
    tracked:true
  };
  toast(`Quest accepted: ${quest.title}`);
  refreshQuestUI();
  renderNpcDialogue();
  return true;
}

function abandonQuest(id){
  const quest=getQuestDefinition(id);
  const record=questRecord(id);
  if(!quest||!record||record.status!=="active") return false;
  const completedCount=Math.max(0,Math.floor(numberOr(record.completedCount,0)));
  if(completedCount>0&&quest.repeatable) ensureQuestState()[id]={status:"available",completedCount};
  else delete ensureQuestState()[id];
  toast(`Abandoned: ${quest.title}`);
  refreshQuestUI();
  return true;
}

function questRewardsFit(quest){
  for(const item of quest.rewards.items){
    if(!canAddItem(item.id,item.qty)) return false;
  }
  return true;
}

function completeQuest(id){
  const quest=getQuestDefinition(id);
  if(!quest||!questCanTurnIn(quest)) return false;
  if(!questRewardsFit(quest)){
    toast("Make room in your backpack for the quest reward.");
    return false;
  }

  // Collection/delivery objectives can optionally consume the required items.
  const consume={};
  for(const objective of quest.objectives){
    if((objective.type==="collect"||objective.type==="deliver")&&objective.consumeOnTurnIn!==false){
      consume[objective.target]=(consume[objective.target]||0)+objective.amount;
    }
  }
  for(const [itemId,qty] of Object.entries(consume)) removeItem(itemId,qty);

  state.xp+=quest.rewards.xp;
  state.gold+=quest.rewards.gold;
  for(const item of quest.rewards.items) addItem(item.id,item.qty);
  levelCheck();

  const record=questRecord(id)||{};
  const completedCount=Math.max(0,Math.floor(numberOr(record.completedCount,0)))+1;
  ensureQuestState()[id]={
    status:quest.repeatable?"available":"completed",
    objectives:quest.objectives.map(()=>0),
    completedCount,
    completedAt:Date.now(),
    readyAnnounced:false,
    tracked:false
  };

  toast(`Quest complete: ${quest.title}`);
  updateUI();
  refreshQuestUI();
  renderNpcDialogue();
  return true;
}

function updateStoredQuestObjective(quest,index,amount=1){
  const record=questRecord(quest.id);
  if(!record||record.status!=="active") return false;
  const objective=quest.objectives[index];
  const before=questObjectiveStoredProgress(quest,index);
  const next=Math.min(objective.amount,before+Math.max(0,Math.floor(numberOr(amount,1))));
  if(!Array.isArray(record.objectives)) record.objectives=quest.objectives.map(()=>0);
  record.objectives[index]=next;
  return next!==before;
}

function notifyQuestKill(target,amount=1){
  let changed=false;
  for(const quest of questDefinitions){
    if(getQuestStatus(quest)!=="active") continue;
    quest.objectives.forEach((objective,index)=>{
      if(objective.type==="kill"&&objective.target===target) changed=updateStoredQuestObjective(quest,index,amount)||changed;
    });
  }
  if(changed) refreshQuestUI();
}

function notifyQuestTalk(npcId){
  let changed=false;
  for(const quest of questDefinitions){
    if(getQuestStatus(quest)!=="active") continue;
    quest.objectives.forEach((objective,index)=>{
      if(objective.type==="talk"&&objective.target===npcId) changed=updateStoredQuestObjective(quest,index,1)||changed;
    });
  }
  if(changed) refreshQuestUI();
}

function updateQuestVisits(){
  if(!state) return;
  let changed=false;
  for(const quest of questDefinitions){
    if(getQuestStatus(quest)!=="active") continue;
    quest.objectives.forEach((objective,index)=>{
      if(objective.type!=="visit"||questObjectiveComplete(quest,index)) return;
      if(dist(state.x,state.y,objective.x,objective.y)<=objective.radius) changed=updateStoredQuestObjective(quest,index,1)||changed;
    });
  }
  if(changed) refreshQuestUI();
}

function activeQuests(){
  return questDefinitions.filter(quest=>["active","ready"].includes(getQuestStatus(quest)));
}

function questIsTracked(questOrId){
  const quest=typeof questOrId==="string"?getQuestDefinition(questOrId):questOrId;
  if(!quest) return false;
  const record=questRecord(quest.id);
  return !!record&&record.status==="active"&&record.tracked!==false;
}

function trackedQuests(){
  return activeQuests().filter(quest=>questIsTracked(quest));
}

function setQuestTracked(id,tracked){
  const quest=getQuestDefinition(id);
  const record=questRecord(id);
  if(!quest||!record||record.status!=="active") return false;
  record.tracked=!!tracked;
  refreshQuestUI();
  return true;
}

function refreshQuestReadyAnnouncements(){
  for(const quest of activeQuests()){
    const record=questRecord(quest.id);
    const ready=questCanTurnIn(quest);
    if(ready&&!record.readyAnnounced){
      record.readyAnnounced=true;
      toast(`Quest ready to turn in: ${quest.title}`);
    }else if(!ready&&record.readyAnnounced){
      record.readyAnnounced=false;
    }
  }
}

function renderQuestLog(){
  const body=document.getElementById("questLogBody");
  if(!body||!state) return;
  const active=activeQuests();
  const completed=questDefinitions.filter(q=>getQuestStatus(q)==="completed");
  if(!active.length&&!completed.length){
    body.innerHTML='<div class="questEmpty">No quests yet. Look for an NPC with a <b>!</b> over their head.</div>';
    return;
  }
  body.innerHTML=`${active.map(quest=>{
    const ready=getQuestStatus(quest)==="ready";
    const tracked=questIsTracked(quest);
    return `<article class="questLogEntry${ready?" ready":""}"><div class="questLogTitle"><div class="questLogTitleText">${questEscape(quest.title)}</div><div class="questLogMeta">${ready?'<span class="questReadyBadge">READY</span>':''}<label class="questTrackToggle" title="Show this quest in the on-screen tracker"><input type="checkbox" data-track-quest="${questEscape(quest.id)}"${tracked?' checked':''}><span>Track</span></label></div></div><div class="questLogDesc"><b>${questEscape(questLevelText(quest))}</b><br>${questEscape(quest.description)}</div><div class="questObjectives">${quest.objectives.map((_,index)=>`<div class="questObjectiveRow${questObjectiveComplete(quest,index)?" complete":""}"><span class="questObjectiveMark">${questObjectiveComplete(quest,index)?"✓":"•"}</span><span>${questEscape(questObjectiveText(quest,index))}</span></div>`).join("")}</div><div class="questRewards">Reward: ${questEscape(questRewardText(quest))}</div><button class="questAbandon" data-abandon-quest="${questEscape(quest.id)}">Abandon</button></article>`;
  }).join("")}${completed.length?`<div class="questCompletedHeading">Completed</div>${completed.map(q=>`<div class="questCompletedItem">✓ ${questEscape(q.title)}</div>`).join("")}`:""}`;
  body.querySelectorAll("[data-track-quest]").forEach(input=>input.onchange=()=>{
    setQuestTracked(input.dataset.trackQuest,input.checked);
  });
  body.querySelectorAll("[data-abandon-quest]").forEach(button=>button.onclick=()=>{
    const id=button.dataset.abandonQuest;
    if(confirm(`Abandon ${getQuestDefinition(id)?.title||"this quest"}?`)) abandonQuest(id);
  });
}


function toggleQuestLog(){
  const overlay=document.getElementById("questLog");
  if(!overlay) return;
  overlay.classList.toggle("show");
  if(overlay.classList.contains("show")){
    renderQuestLog();
    constrainFloatingPanel?.("questLogPanel");
  }
}

function closeQuestLog(){
  document.getElementById("questLog")?.classList.remove("show");
}

function renderNpcDialogue(){
  const overlay=document.getElementById("npcDialog");
  const nameEl=document.getElementById("npcDialogName");
  const roleEl=document.getElementById("npcDialogRole");
  const textEl=document.getElementById("npcDialogText");
  const actions=document.getElementById("npcDialogActions");
  if(!overlay||!nameEl||!roleEl||!textEl||!actions||!activeNpcDialogId) return;
  const npc=sceneryNPCs.find(n=>n.id===activeNpcDialogId);
  if(!npc){closeNpcDialogue();return;}
  nameEl.textContent=npc.name;
  roleEl.textContent=npc.role||"Villager";
  textEl.textContent=npc.greeting||`Hello. I'm ${npc.name}.`;

  const ready=questsForNpc(npc.id,"turnin").filter(q=>getQuestStatus(q)==="ready");
  const available=questsForNpc(npc.id,"giver").filter(q=>getQuestStatus(q)==="available");
  const active=Array.from(new Set([
    ...questsForNpc(npc.id,"giver"),
    ...questsForNpc(npc.id,"turnin")
  ])).filter(q=>getQuestStatus(q)==="active");

  const cards=[];
  for(const quest of ready){
    cards.push(`<article class="npcQuestCard ready"><div class="npcQuestTitle">? ${questEscape(quest.title)}</div><div class="npcQuestCopy"><b>${questEscape(questLevelText(quest))}</b><br>${questEscape(quest.completionDialogue)}</div><div class="questRewards">Reward: ${questEscape(questRewardText(quest))}</div><button data-complete-quest="${questEscape(quest.id)}">Complete Quest</button></article>`);
  }
  for(const quest of available){
    cards.push(`<article class="npcQuestCard"><div class="npcQuestTitle">! ${questEscape(quest.title)}</div><div class="npcQuestCopy"><b>${questEscape(questLevelText(quest))}</b><br>${questEscape(quest.openingDialogue)}</div><div class="questObjectives">${quest.objectives.map((_,index)=>`<div>${questEscape(questObjectiveText(quest,index))}</div>`).join("")}</div><div class="questRewards">Reward: ${questEscape(questRewardText(quest))}</div><button data-accept-quest="${questEscape(quest.id)}">Accept Quest</button></article>`);
  }
  for(const quest of active){
    cards.push(`<article class="npcQuestCard active"><div class="npcQuestTitle">${questEscape(quest.title)}</div><div class="npcQuestCopy"><b>${questEscape(questLevelText(quest))}</b><br>In progress</div><div class="questObjectives">${quest.objectives.map((_,index)=>`<div>${questEscape(questObjectiveText(quest,index))}</div>`).join("")}</div></article>`);
  }
  actions.innerHTML=cards.join("")||'<div class="npcNoQuest">Nothing else right now.</div>';
  actions.querySelectorAll("[data-accept-quest]").forEach(button=>button.onclick=()=>acceptQuest(button.dataset.acceptQuest));
  actions.querySelectorAll("[data-complete-quest]").forEach(button=>button.onclick=()=>completeQuest(button.dataset.completeQuest));
}

function openNpcDialogue(npc){
  if(!npc||!state) return false;
  activeNpcDialogId=npc.id;
  if(combatTarget) disengageCombat(false);
  npc.facing=vectorFacing(state.x-npc.x,state.y-npc.y,npc.facing||"down");
  notifyQuestTalk(npc.id);
  document.getElementById("npcDialog")?.classList.add("show");
  renderNpcDialogue();
  return true;
}

function closeNpcDialogue(){
  activeNpcDialogId=null;
  document.getElementById("npcDialog")?.classList.remove("show");
}

function interactWithNpc(npc){
  if(!npc||!state) return false;
  const range=Math.max(42,numberOr(npc.interactRadius,58));
  if(dist(state.x,state.y,npc.x,npc.y)>range){
    toast(`Move closer to ${npc.name}.`);
    return false;
  }
  return openNpcDialogue(npc);
}

function interactWithNearestNpc(){
  if(isGameplayModalOpen()&&!overlayIsShown("npcDialog")) return false;
  if(overlayIsShown("npcDialog")){closeNpcDialogue();return true;}
  const npc=nearestInteractableNpc(76);
  if(!npc){toast("No one is close enough to talk to.");return false;}
  return interactWithNpc(npc);
}

function refreshQuestUI(){
  if(!state) return;
  refreshQuestReadyAnnouncements();
  const active=activeQuests();
  const tracked=trackedQuests();
  const chip=document.getElementById("questChip");
  if(chip){
    if(!tracked.length){
      chip.innerHTML=active.length
        ?`<div class="questTrackerEmpty"><b>Quests</b><span>${active.length} active • 0 tracked</span></div>`
        :'<div class="questTrackerEmpty"><b>Quests</b></div>';
      chip.classList.remove("complete");
    }else{
      chip.innerHTML=tracked.map(quest=>{
        const ready=getQuestStatus(quest)==="ready";
        const rows=quest.objectives.map((_,index)=>{
          const complete=questObjectiveComplete(quest,index);
          return `<div class="questTrackerObjective${complete?" complete":""}"><span>${complete?"✓":"•"}</span>${questEscape(questObjectiveText(quest,index))}</div>`;
        }).join("");
        return `<section class="questTrackerEntry${ready?" ready":""}"><div class="questTrackerTitle">${ready?'<span class="questTrackerReady">✓</span>':''}${questEscape(quest.title)}</div><div class="questTrackerObjectives">${rows}</div></section>`;
      }).join("");
      chip.classList.toggle("complete",tracked.every(quest=>getQuestStatus(quest)==="ready"));
    }
  }
  const menuQuest=document.getElementById("mQuest");
  if(menuQuest){
    menuQuest.textContent=active.length
      ?active.map(quest=>`${quest.title} — ${quest.objectives.map((_,index)=>questObjectiveText(quest,index)).join(" • ")}`).join(" | ")
      :"No active quests. Talk to NPCs with a ! marker.";
  }
  if(document.getElementById("questLog")?.classList.contains("show")) renderQuestLog();
  if(document.getElementById("npcDialog")?.classList.contains("show")) renderNpcDialogue();
}

const DEV_DRAFT_KEY = "littleRealmWorldBuilderDraftV2";
const DEV_OLD_DRAFT_KEY = "littleRealmWorldBuilderDraftV1";
let devModeActive=false;
let devPanel=null;
let devSelected=null;
let devPlaceType=null;
let devDragging=false;
let devDragOffset={x:0,y:0};
let devHitboxEditing=false;
let devHitboxDrag=null;
let devDepthEditing=false;
let devDepthDrag=null;
let devShowGrid=true;
let devShowHitboxes=true;
let devShowDepthLines=true;
let devSnap=8;
let devStatusTimer=null;
let devSelectedMob=null;
let devSelectedNpc=null;
let devNpcDragging=false;
let devNpcDragOffset={x:0,y:0};
let devPlaceNpcTemplate=null;
let devSelectedQuestId=null;
let devQuestFormDraft=null;
let devActiveTab="objects";
let devCombatMobType="goblin";
let devPlayerTestBaseline=null;
let devSelectedRemnant=null;
let devRemnantPreview=null;
let devRemnantDragging=false;
let devRemnantDragOffset={x:0,y:0};
const DEV_PROJECT_BALANCE=JSON.parse(JSON.stringify(BALANCE));

function ensureDeveloperStyles(){
  if(document.getElementById("littleRealmDevStyles")) return;
  const style=document.createElement("style");
  style.id="littleRealmDevStyles";
  style.textContent=`
    #devPanel{position:fixed!important;z-index:10000!important;top:12px!important;right:12px!important;width:min(720px,58vw)!important;height:min(860px,calc(100vh - 24px))!important;background:rgba(24,20,30,.98)!important;border:1px solid rgba(255,255,255,.22)!important;border-radius:16px!important;box-shadow:0 18px 50px rgba(0,0,0,.55)!important;color:#f8f2ff!important;display:none!important;overflow:hidden!important;font:13px system-ui,sans-serif!important;backdrop-filter:blur(8px)!important}
    #devPanel.show{display:flex!important;flex-direction:column!important}
    #devPanel *{box-sizing:border-box}
    #devPanel .devHeader{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#453552;border-bottom:1px solid rgba(255,255,255,.12)}
    #devPanel .devHeader b{display:block;font-size:15px;letter-spacing:.08em} #devPanel .devHeader span{display:block;font-size:11px;color:#cdbed9;margin-top:2px}
    #devPanel button,#devPanel select,#devPanel input{font:inherit}
    #devPanel .devHeader button{width:36px;height:36px;border:0;border-radius:9px;background:#2a2132;color:white;font-size:22px}
    #devPanel .devToolbar{display:flex;gap:9px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.1)}
    #devPanel .devToolbar button,#devPanel .devToolbar select,#devPanel .devProjectActions button,#devPanel .devRow button,#devPanel .devMobTypeChip{border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:8px;padding:8px 10px;font-weight:700}
    #devPanel .devToolbar button.active,#devPanel .devPropButton.active,#devPanel .devTab.active,#devPanel .devMobTypeChip.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel .devToolbar label{display:flex;gap:5px;align-items:center;color:#e5d9ec}
    #devPanel .devTabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.1);background:#211a28}
    #devPanel .devTab{border:1px solid rgba(255,255,255,.12);background:#30283a;color:#d9cfdf;border-radius:9px;padding:9px 10px;font-weight:800;cursor:pointer}
    #devPanel .devBody{flex:1;min-height:0;overflow:auto;padding:12px}
    #devPanel .devView{display:none}#devPanel .devView.active{display:block}
    #devPanel .devSection{background:#241e2b;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px;margin-bottom:12px}
    #devPanel .devSectionTitle{padding:0 2px 8px;font-weight:900;color:#d8c1e7;letter-spacing:.06em;text-transform:uppercase;font-size:12px}
    #devPanel .devHint{color:#b9aebe;font-size:11px;margin:-2px 2px 9px;line-height:1.35}
    #devPanel #devPalette{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:7px!important;max-height:360px!important;overflow:auto!important;padding:2px!important}
    #devPanel .devPropButton{min-width:0;border:1px solid rgba(255,255,255,.12);background:#30283a;color:#eee;border-radius:9px;padding:5px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;min-height:76px}
    #devPanel .devPropButton canvas{width:52px;height:52px;image-rendering:pixelated;background:rgba(255,255,255,.025);border-radius:5px}
    #devPanel .devPropButton span{font-size:10px;line-height:1.05;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:capitalize}
    #devPanel #devObjectList,#devPanel #devSelectionList{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;max-height:260px;overflow:auto}
    #devPanel .devObjectChip{border:1px solid rgba(255,255,255,.12);background:#2e2736;color:#e9dff0;border-radius:8px;padding:7px 9px;font-size:11px;cursor:pointer;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #devPanel .devObjectChip.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel #devScalePanel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
    #devPanel .devScaleControl{background:#2b2432;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px;color:#ddd}
    #devPanel .devScaleControl .devScaleTop{display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:800;margin-bottom:7px}
    #devPanel .devScaleControl input[type=range]{width:100%;accent-color:#63e6ff}
    #devPanel #devMobScalePanel{background:#2b2432;border:1px solid rgba(99,230,255,.18);border-radius:12px;padding:12px;min-height:130px}
    #devPanel .devMobSelectedTitle{font-size:18px;font-weight:900;color:#7ceaff;margin-bottom:3px}.devMobMeta{color:#bdb0c5;font-size:11px;margin-bottom:11px}
    #devPanel #devMobTypeChips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.devMobTypeChip{font-size:10px!important;padding:6px 8px!important;cursor:pointer}
    #devPanel #devInspector{padding:2px;min-height:180px}
    #devPanel .devEmpty{color:#baaec2;padding:12px;background:#2b2432;border-radius:9px}.devSelectedTitle{font-size:16px;font-weight:900;margin-bottom:9px;color:#7ceaff;text-transform:capitalize}
    #devPanel #devInspector label{display:flex;flex-direction:column;gap:4px;margin:7px 0;color:#d7cbdc}
    #devPanel #devInspector input[type=text],#devPanel #devInspector input[type=number],#devPanel #devInspector input:not([type]),#devPanel #devInspector select{width:100%;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:7px;padding:8px}
    #devPanel .devChecks{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px} #devPanel .devChecks label{flex-direction:row!important;align-items:center!important;background:#2b2432;padding:8px;border-radius:7px}
    #devPanel .devPair{display:grid;grid-template-columns:1fr 1fr;gap:9px} #devPanel .devQuad{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
    #devPanel .devSubhead{font-weight:800;margin-top:10px;color:#c9b9d2} #devPanel .devRow{display:flex;gap:7px;margin-top:10px} #devPanel .devRow button{flex:1} #devPanel .devRow .danger{background:#713b47}
    #devPanel .devHitboxEditButton{width:100%;margin-top:8px;border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:8px;padding:9px 10px;font-weight:900;cursor:pointer}
    #devPanel .devHitboxEditButton.active{outline:2px solid #ffd166;background:#66532b;color:#fff8dd}
    #devPanel .devHitboxEditHelp{margin-top:7px;padding:8px 9px;border:1px solid rgba(255,209,102,.18);border-radius:8px;background:rgba(255,209,102,.06);color:#d8cdbc;font-size:10px;line-height:1.35}
    #devPanel .devDepthEditButton{width:100%;margin-top:8px;border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:8px;padding:9px 10px;font-weight:900;cursor:pointer}
    #devPanel .devDepthEditButton.active{outline:2px solid #d58cff;background:#59406a;color:#fff4ff}
    #devPanel .devDepthEditButton:disabled{opacity:.42;cursor:not-allowed}
    #devPanel .devDepthEditHelp{margin-top:7px;padding:8px 9px;border:1px solid rgba(213,140,255,.20);border-radius:8px;background:rgba(213,140,255,.07);color:#d8cdbc;font-size:10px;line-height:1.35}
    #devPanel .devProjectActions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px} #devPanel .devProjectActions button:first-child{grid-column:1/-1;background:#38606a}
    #devPanel #devStatus{padding:9px 12px;background:#1d1822;color:#bdb0c5;font-size:11px;border-top:1px solid rgba(255,255,255,.08)}

    #devPanel .devCombatGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    #devPanel .devCombatField{display:flex;flex-direction:column;gap:4px;color:#d7cbdc;font-size:11px;font-weight:700}
    #devPanel .devCombatField input,#devPanel .devCombatField select{width:100%;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:7px;padding:8px}
    #devPanel .devCombatCheck{display:flex;align-items:center;gap:7px;background:#2b2432;border-radius:8px;padding:9px;color:#ddd;font-weight:700}
    #devPanel .devCombatActions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.devCombatActions button{border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:8px;padding:8px 10px;font-weight:800;cursor:pointer}.devCombatActions .primary{background:#38606a}.devCombatActions .danger{background:#713b47}
    #devPanel .devCombatDetails{background:#211b27;border:1px solid rgba(255,255,255,.08);border-radius:10px;margin:8px 0;overflow:hidden}.devCombatDetails summary{cursor:pointer;padding:10px 11px;font-weight:900;color:#d8c1e7;user-select:none}.devCombatDetails>div{padding:0 10px 10px}
    #devPanel .devPlayerTest{display:grid;grid-template-columns:minmax(110px,160px) 1fr;gap:10px;align-items:end}.devQuickLevels{display:flex;gap:5px;flex-wrap:wrap}.devQuickLevels button{border:1px solid rgba(255,255,255,.12);background:#30283a;color:#fff;border-radius:7px;padding:7px 9px;font-weight:800}
    #devPanel .devStatPreview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:9px}.devStatPreview div{background:#2b2432;border-radius:8px;padding:8px;text-align:center}.devStatPreview b{display:block;color:#7ceaff;font-size:14px}.devStatPreview span{font-size:9px;color:#a99bb3;text-transform:uppercase;letter-spacing:.05em}
    #devPanel .devNpcPalette{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.devNpcPalette button{border:1px solid rgba(255,255,255,.12);background:#30283a;color:#fff;border-radius:9px;padding:9px;font-weight:850;cursor:pointer}.devNpcPalette button.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel #devNpcList,#devPanel #devQuestList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;max-height:230px;overflow:auto}.devNpcChip,.devQuestChip{border:1px solid rgba(255,255,255,.12);background:#2e2736;color:#e9dff0;border-radius:8px;padding:7px 9px;font-size:11px;cursor:pointer;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.devNpcChip.active,.devQuestChip.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel .devNpcInspector label,#devPanel .devQuestEditor label{display:flex;flex-direction:column;gap:4px;margin:7px 0;color:#d7cbdc;font-size:11px;font-weight:700}.devNpcInspector input,.devNpcInspector select,.devNpcInspector textarea,.devQuestEditor input,.devQuestEditor select,.devQuestEditor textarea{width:100%;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:7px;padding:8px;font:inherit}.devNpcInspector textarea,.devQuestEditor textarea{min-height:62px;resize:vertical}
    #devPanel .devQuestObjective{margin-top:8px;padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#2a2331}.devQuestObjectiveTop{display:grid;grid-template-columns:1fr 1.35fr .55fr auto;gap:6px;align-items:end}.devQuestObjectiveTop button{height:34px;border:1px solid rgba(255,255,255,.12);background:#713b47;color:#fff;border-radius:7px;font-weight:900}.devVisitGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.devQuestListActions{display:flex;gap:7px;margin-top:8px}.devQuestListActions button{flex:1;border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:8px;padding:8px;font-weight:800}
    #devPanel .devProjectBig{display:grid;grid-template-columns:1fr 1fr;gap:8px}.devProjectBig button{border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:9px;padding:10px;font-weight:850}.devProjectBig .primary{grid-column:1/-1;background:#38606a}.devProjectBig .danger{background:#713b47}.devProjectNote{padding:9px;border:1px solid rgba(99,230,255,.14);border-radius:9px;background:rgba(99,230,255,.05);color:#cbd9dd;font-size:10px;line-height:1.4}
    body.devMode #pcControls{opacity:.25}
    @media(max-width:1100px){#devPanel{width:min(650px,68vw)!important}#devPanel #devPalette{grid-template-columns:repeat(5,minmax(0,1fr))!important}}
    @media(max-width:760px){#devPanel .devTabs{grid-template-columns:repeat(2,1fr)}#devPanel .devCombatGrid{grid-template-columns:repeat(2,minmax(0,1fr))}#devPanel .devStatPreview{grid-template-columns:repeat(2,minmax(0,1fr))}#devPanel{width:calc(100vw - 12px)!important;right:6px!important;top:6px!important;height:calc(100vh - 12px)!important}#devPanel #devPalette{grid-template-columns:repeat(4,minmax(0,1fr))!important}#devPanel #devObjectList,#devPanel #devSelectionList{grid-template-columns:repeat(2,minmax(0,1fr))}#devPanel #devScalePanel{grid-template-columns:1fr}.devQuad{grid-template-columns:repeat(2,1fr)!important}}
  `;
  document.head.appendChild(style);
}

function cloneWorldObject(obj){
  return JSON.parse(JSON.stringify(obj));
}

function getProjectWorldObjects(){
  return (PROJECT_WORLD_OBJECTS||[]).map(cloneWorldObject);
}

function worldObjectSpec(obj){
  if(!obj) return null;
  if(obj.type==="crops") return {w:obj.w||90,h:obj.h||70};
  if(obj.type==="blockedGate") return {w:150,h:62};
  if(obj.type==="caveEntrance") return {w:obj.w||220,h:obj.h||160};
  return PROP_SPECS[obj.type]||null;
}

function defaultWorldObject(type,x,y){
  const spec=worldObjectSpec({type})||{w:48,h:48};
  const hitH=Math.max(8,Math.round(spec.h*.26));
  const hitW=Math.max(10,Math.round(spec.w*.66));
  return {
    id:`${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,
    type,
    x:Math.round(x),
    y:Math.round(y),
    solid:false,
    hitbox:{x:Math.round((spec.w-hitW)/2),y:spec.h-hitH,w:hitW,h:hitH},
    depthMode:"ysort",
    depthY:spec.h,
    interactable:false,
    label:type.replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase()),
    container:false,
    capacity:8,
    contents:[]
  };
}

function rebuildWorldObjectCollision(){
  // Other protected collision sources keep their own type. Only editor props are replaced.
  solidRects=solidRects.filter(r=>r.type!=="world-prop" && r.type!=="zone-gate");
  for(const obj of sceneryProps){
    if(!obj.solid) continue;
    const hb=obj.hitbox||{};
    const spec=worldObjectSpec(obj)||{w:32,h:32};
    const x=numberOr(hb.x,0),y=numberOr(hb.y,Math.round(spec.h*.7));
    const w=Math.max(1,numberOr(hb.w,spec.w)),h=Math.max(1,numberOr(hb.h,Math.round(spec.h*.3)));
    addSolidRect(obj.x+x,obj.y+y,w,h,obj.type==="blockedGate"?"zone-gate":"world-prop");
  }
}

function devWorldFromPointer(event){
  return {
    x:state.x+(event.clientX-innerWidth/2)/CAMERA_ZOOM,
    y:state.y+(event.clientY-innerHeight/2)/CAMERA_ZOOM
  };
}
function snapDev(v){ return Math.round(v/devSnap)*devSnap; }
function clampDev(v,min,max){ return Math.max(min,Math.min(max,v)); }

function developerSelectedEntity(){
  return devSelected||devSelectedNpc||null;
}
function developerIsNpc(entity){
  return !!entity && sceneryNPCs.includes(entity);
}
function developerEntityBounds(entity){
  if(!entity) return {x:0,y:0,w:32,h:32};
  if(developerIsNpc(entity)) return npcVisualBounds(entity);
  const spec=worldObjectSpec(entity)||{w:32,h:32};
  return {x:entity.x,y:entity.y,w:spec.w,h:spec.h};
}
function developerEntityOffsetLimits(entity){
  const b=developerEntityBounds(entity);
  return {minX:b.x-entity.x,maxX:b.x+b.w-entity.x,minY:b.y-entity.y,maxY:b.y+b.h-entity.y};
}
function developerEntityDepthMode(entity){
  return developerIsNpc(entity)?npcDepthMode(entity):worldObjectDepthMode(entity);
}
function developerEntityDefaultDepthY(entity){
  return developerIsNpc(entity)?defaultNpcDepthY(entity):defaultWorldObjectDepthY(entity);
}
function rebuildDeveloperEntityCollision(entity){
  if(developerIsNpc(entity)) rebuildNpcCollision();
  else rebuildWorldObjectCollision();
}

function ensureDeveloperHitbox(obj=developerSelectedEntity()){
  if(!obj) return null;
  if(!obj.hitbox){
    if(developerIsNpc(obj)) obj.hitbox={x:-6,y:-7,w:12,h:14};
    else{
      const spec=worldObjectSpec(obj)||{w:32,h:32};
      const hitH=Math.max(8,Math.round(spec.h*.26));
      const hitW=Math.max(10,Math.round(spec.w*.66));
      obj.hitbox={x:Math.round((spec.w-hitW)/2),y:spec.h-hitH,w:hitW,h:hitH};
    }
  }
  return obj.hitbox;
}

function ensureDeveloperDepth(obj=developerSelectedEntity()){
  if(!obj) return null;
  if(!WORLD_OBJECT_DEPTH_MODES.has(String(obj.depthMode||"").toLowerCase())) obj.depthMode=developerEntityDepthMode(obj);
  if(!Number.isFinite(Number(obj.depthY))) obj.depthY=developerEntityDefaultDepthY(obj);
  return {mode:developerEntityDepthMode(obj),y:numberOr(obj.depthY,developerEntityDefaultDepthY(obj))};
}

function findDeveloperDepthInteraction(wx,wy){
  const entity=developerSelectedEntity();
  if(!devDepthEditing || !entity || developerEntityDepthMode(entity)!=="ysort") return false;
  const b=developerEntityBounds(entity);
  const depth=ensureDeveloperDepth(entity);
  const lineY=entity.y+depth.y;
  const grab=8/CAMERA_ZOOM;
  return wx>=b.x-grab*2 && wx<=b.x+b.w+grab*2 && Math.abs(wy-lineY)<=grab;
}

function setDeveloperDepthEditing(active){
  const entity=developerSelectedEntity();
  devDepthEditing=!!active && !!entity && developerEntityDepthMode(entity)==="ysort";
  devDepthDrag=null;
  if(devDepthEditing){
    devHitboxEditing=false;
    devHitboxDrag=null;
    ensureDeveloperDepth(entity);
    devShowDepthLines=true;
    const toggle=devPanel?.querySelector("#devDepthLines");
    if(toggle) toggle.checked=true;
    devSetStatus("Depth edit mode — drag the purple line up/down to control sprite overlap");
  }else{
    if(game?.style) game.style.cursor="";
    devSetStatus("Depth edit mode finished");
  }
  refreshDeveloperPanel();
}

function updateDeveloperDepthDrag(p){
  const entity=developerSelectedEntity();
  if(!devDepthDrag || !entity) return;
  const limits=developerEntityOffsetLimits(entity);
  const span=Math.max(16,limits.maxY-limits.minY);
  const dy=Math.round(p.y-devDepthDrag.pointerY);
  entity.depthY=Math.round(clampDev(devDepthDrag.depthY+dy,limits.minY-span,limits.maxY+span));
  refreshDeveloperInspectorValues();
}

function findDeveloperHitboxInteraction(wx,wy){
  const entity=developerSelectedEntity();
  if(!devHitboxEditing || !entity) return null;
  const hb=ensureDeveloperHitbox(entity);
  const left=entity.x+hb.x, top=entity.y+hb.y;
  const right=left+hb.w, bottom=top+hb.h;
  const grab=7/CAMERA_ZOOM;
  if(wx<left-grab || wx>right+grab || wy<top-grab || wy>bottom+grab) return null;

  const nearL=Math.abs(wx-left)<=grab, nearR=Math.abs(wx-right)<=grab;
  const nearT=Math.abs(wy-top)<=grab, nearB=Math.abs(wy-bottom)<=grab;
  if(nearL&&nearT) return "nw";
  if(nearR&&nearT) return "ne";
  if(nearL&&nearB) return "sw";
  if(nearR&&nearB) return "se";
  if(nearT && wx>=left-grab && wx<=right+grab) return "n";
  if(nearB && wx>=left-grab && wx<=right+grab) return "s";
  if(nearL && wy>=top-grab && wy<=bottom+grab) return "w";
  if(nearR && wy>=top-grab && wy<=bottom+grab) return "e";
  if(wx>=left && wx<=right && wy>=top && wy<=bottom) return "move";
  return null;
}

function developerHitboxCursor(interaction){
  if(interaction==="move") return "move";
  if(interaction==="n"||interaction==="s") return "ns-resize";
  if(interaction==="e"||interaction==="w") return "ew-resize";
  if(interaction==="nw"||interaction==="se") return "nwse-resize";
  if(interaction==="ne"||interaction==="sw") return "nesw-resize";
  return "default";
}

function setDeveloperHitboxEditing(active){
  const entity=developerSelectedEntity();
  devHitboxEditing=!!active && !!entity;
  devHitboxDrag=null;
  if(devHitboxEditing){
    devDepthEditing=false;
    devDepthDrag=null;
    ensureDeveloperHitbox(entity);
    devShowHitboxes=true;
    const toggle=devPanel?.querySelector("#devHitboxes");
    if(toggle) toggle.checked=true;
    devSetStatus("Hitbox edit mode — drag inside to move, drag handles/edges to resize");
  }else{
    if(game?.style) game.style.cursor="";
    devSetStatus("Hitbox edit mode finished");
  }
  refreshDeveloperPanel();
}

function updateDeveloperHitboxDrag(p){
  const entity=developerSelectedEntity();
  if(!devHitboxDrag || !entity) return;
  const limits=developerEntityOffsetLimits(entity);
  const start=devHitboxDrag.hitbox;
  const dx=Math.round(p.x-devHitboxDrag.pointerX);
  const dy=Math.round(p.y-devHitboxDrag.pointerY);
  const minSize=2;
  let left=start.x, top=start.y, right=start.x+start.w, bottom=start.y+start.h;
  const handle=devHitboxDrag.handle;

  if(handle==="move"){
    left=clampDev(start.x+dx,limits.minX,Math.max(limits.minX,limits.maxX-start.w));
    top=clampDev(start.y+dy,limits.minY,Math.max(limits.minY,limits.maxY-start.h));
    right=left+start.w;
    bottom=top+start.h;
  }else{
    if(handle.includes("w")) left=clampDev(start.x+dx,limits.minX,right-minSize);
    if(handle.includes("e")) right=clampDev(start.x+start.w+dx,left+minSize,limits.maxX);
    if(handle.includes("n")) top=clampDev(start.y+dy,limits.minY,bottom-minSize);
    if(handle.includes("s")) bottom=clampDev(start.y+start.h+dy,top+minSize,limits.maxY);
  }

  entity.hitbox={
    x:Math.round(left),
    y:Math.round(top),
    w:Math.max(minSize,Math.round(right-left)),
    h:Math.max(minSize,Math.round(bottom-top))
  };
  rebuildDeveloperEntityCollision(entity);
  refreshDeveloperInspectorValues();
}

function findWorldObjectAt(wx,wy){
  const pad=10;
  const sorted=[...sceneryProps].sort((a,b)=>((b.y+(worldObjectSpec(b)?.h||0))-(a.y+(worldObjectSpec(a)?.h||0))));
  for(const obj of sorted){
    const spec=worldObjectSpec(obj);
    if(!spec) continue;
    if(wx>=obj.x-pad && wx<=obj.x+spec.w+pad && wy>=obj.y-pad && wy<=obj.y+spec.h+pad) return obj;
  }
  return null;
}

function makeDeveloperRemnantPreview(kind="dust"){
  const lootable=kind==="lootable";
  const existing=devRemnantPreview;
  return {
    id:"developer-remnant-preview",
    x:Number.isFinite(existing?.x)?existing.x:state.x+56,
    y:Number.isFinite(existing?.y)?existing.y:state.y+8,
    sourceLabel:"World Builder Remnant Preview",
    items:[],
    gold:lootable?1:0,
    potions:0,
    createdAt:0,
    expiresAt:Number.POSITIVE_INFINITY,
    devKind:lootable?"lootable":"dust"
  };
}

function selectDeveloperRemnant(kind){
  devSelectedRemnant=kind==="lootable"?"lootable":"dust";
  devRemnantPreview=makeDeveloperRemnantPreview(devSelectedRemnant);
  devSelected=null;devSelectedNpc=null;devSelectedMob=null;
  devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;
  setDeveloperTab("selection");
  refreshDeveloperPanel();
  devSetStatus(`${devSelectedRemnant==="lootable"?"Lootable Dust":"Dust"} preview selected — drag it in the world and tune scale/depth here`);
}

function developerRemnantPreviewBounds(){
  if(!devRemnantPreview) return null;
  const size=lootRemnantDrawSize();
  return {x:devRemnantPreview.x-size/2,y:devRemnantPreview.y-size*.72,w:size,h:size};
}

function findDeveloperRemnantPreviewAt(wx,wy){
  const b=developerRemnantPreviewBounds();
  return !!b && wx>=b.x-6 && wx<=b.x+b.w+6 && wy>=b.y-6 && wy<=b.y+b.h+6;
}

function updateDeveloperRemnantVisual({scale,depthMode,depthY}={}){
  if(scale!==undefined) LOOT_REMNANT_VISUAL.scale=Math.round(visualScaleOr(scale,LOOT_REMNANT_VISUAL.scale)*100)/100;
  if(depthMode!==undefined){
    const mode=String(depthMode).toLowerCase();
    if(LOOT_REMNANT_DEPTH_MODES.has(mode)) LOOT_REMNANT_VISUAL.depthMode=mode;
  }
  if(depthY!==undefined&&Number.isFinite(Number(depthY))) LOOT_REMNANT_VISUAL.depthY=Math.round(Number(depthY));
}

function mobTypeScaleKey(mob){
  if(!mob) return null;
  return (mob.boss || mob.kind==="boss") ? "snickers" : mob.kind;
}
function mobTypeScaleLabel(key){
  const labels={slime:"Slime",goblin:"Goblin",wolf:"Wolf",cow:"Cow",pig:"Pig",chicken:"Chicken",snickers:"Snickers"};
  return labels[key]||key||"Mob";
}
function mobTypeFallbackScale(key){
  if(key==="snickers") return VISUAL_SCALE.boss;
  if(["cow","pig","chicken"].includes(key)) return VISUAL_SCALE.passiveMobs;
  return VISUAL_SCALE.hostileMobs;
}
function findDeveloperMobAt(wx,wy){
  let best=null,bestScore=Infinity;
  for(const mob of mobs){
    if(!mob.alive) continue;
    const scale=Math.max(.75,mobVisualScale(mob));
    const rx=(mob.boss?42:30)*scale;
    const ry=(mob.boss?52:38)*scale;
    const dx=Math.abs(wx-mob.x),dy=wy-mob.y;
    if(dx<=rx && dy>=-ry && dy<=ry*.55){
      const score=dx*dx+(dy*.65)*(dy*.65);
      if(score<bestScore){best=mob;bestScore=score;}
    }
  }
  return best;
}
function setDeveloperTab(tab){
  devActiveTab=tab||"objects";
  if(!devPanel) return;
  devPanel.querySelectorAll(".devTab").forEach(b=>b.classList.toggle("active",b.dataset.devTab===devActiveTab));
  devPanel.querySelectorAll(".devView").forEach(v=>v.classList.toggle("active",v.dataset.devView===devActiveTab));
}


function developerWorldPack(){
  return {
    format:"little-realm-world-pack",
    schemaVersion:1,
    build:"v63-remnant-world-builder",
    exportedAt:new Date().toISOString(),
    worldObjects:sceneryProps.map(cloneWorldObject),
    npcs:sceneryNPCs.map(cloneNpc),
    quests:questDefinitions.map(cloneQuest),
    visualSettings:{...VISUAL_SCALE,mobTypes:{...MOB_TYPE_SCALE},remnants:{...LOOT_REMNANT_VISUAL}},
    balance:devBalanceClone(BALANCE)
  };
}

function applyDeveloperWorldPack(pack,{quiet=false}={}){
  if(!pack||typeof pack!=="object") throw new Error("World Pack is not an object");
  if(Array.isArray(pack.worldObjects)){
    sceneryProps.splice(0,sceneryProps.length,...pack.worldObjects.map(cloneWorldObject));
    rebuildWorldObjectCollision();
  }
  if(Array.isArray(pack.npcs)){
    sceneryNPCs.splice(0,sceneryNPCs.length,...pack.npcs.map((npc,index)=>normalizeNpcRecord(npc,index)));
    rebuildNpcCollision();
  }
  if(Array.isArray(pack.quests)) replaceQuestDefinitions(pack.quests);
  if(pack.visualSettings&&typeof pack.visualSettings==="object"){
    for(const key of Object.keys(VISUAL_SCALE)) if(Number.isFinite(Number(pack.visualSettings[key]))) VISUAL_SCALE[key]=visualScaleOr(pack.visualSettings[key],VISUAL_SCALE[key]);
    if(pack.visualSettings.mobTypes) for(const key of Object.keys(MOB_TYPE_SCALE)) if(Number.isFinite(Number(pack.visualSettings.mobTypes[key]))) MOB_TYPE_SCALE[key]=visualScaleOr(pack.visualSettings.mobTypes[key],MOB_TYPE_SCALE[key]);
    if(pack.visualSettings.remnants&&typeof pack.visualSettings.remnants==="object"){
      if(Number.isFinite(Number(pack.visualSettings.remnants.scale))) LOOT_REMNANT_VISUAL.scale=visualScaleOr(pack.visualSettings.remnants.scale,LOOT_REMNANT_VISUAL.scale);
      const mode=String(pack.visualSettings.remnants.depthMode||"").toLowerCase();
      if(LOOT_REMNANT_DEPTH_MODES.has(mode)) LOOT_REMNANT_VISUAL.depthMode=mode;
      if(Number.isFinite(Number(pack.visualSettings.remnants.depthY))) LOOT_REMNANT_VISUAL.depthY=Number(pack.visualSettings.remnants.depthY);
    }
  }
  if(pack.balance&&typeof pack.balance==="object"){
    devReplaceBalance(pack.balance);
    if(typeof refreshMobTemplatesFromBalance==="function") refreshMobTemplatesFromBalance();
    if(typeof refreshAliveMobStatsForPlayer==="function"&&state) refreshAliveMobStatsForPlayer();
  }
  devSelected=null;devSelectedNpc=null;devSelectedMob=null;devSelectedRemnant=null;devSelectedQuestId=questDefinitions[0]?.id||null;devQuestFormDraft=null;
  refreshDeveloperPanel();
  updateUI?.();
  if(!quiet) devSetStatus(`Loaded World Pack • ${sceneryProps.length} props • ${sceneryNPCs.length} NPCs • ${questDefinitions.length} quests`);
}

function saveDeveloperDraft(){
  try{
    localStorage.setItem(DEV_DRAFT_KEY,JSON.stringify(developerWorldPack()));
    devSetStatus("World Builder draft autosaved locally");
  }catch(err){ console.warn("Could not save developer draft",err); }
}

function loadDeveloperDraft(){
  try{
    const raw=localStorage.getItem(DEV_DRAFT_KEY)||localStorage.getItem(DEV_OLD_DRAFT_KEY);
    if(!raw){devSetStatus("No local draft found");return;}
    const parsed=JSON.parse(raw);
    if(Array.isArray(parsed)){
      // v1 migration: the original editor stored world objects only.
      sceneryProps.splice(0,sceneryProps.length,...parsed.map(cloneWorldObject));
      rebuildWorldObjectCollision();
      devSelected=null;
      refreshDeveloperPanel();
      devSetStatus(`Loaded legacy draft with ${sceneryProps.length} objects`);
      return;
    }
    applyDeveloperWorldPack(parsed);
  }catch(err){
    console.error(err); devSetStatus("Draft could not be loaded");
  }
}

function resetDeveloperLayout(){
  if(!confirm("Reset the live prop layout to config/world-objects.js? Your local World Pack draft will remain until you overwrite it.")) return;
  sceneryProps.splice(0,sceneryProps.length,...getProjectWorldObjects());
  devSelected=null;
  rebuildWorldObjectCollision();
  refreshDeveloperPanel();
  devSetStatus("Project prop layout restored");
}

function resetDeveloperProject(){
  if(!confirm("Reset props, NPCs, quests, visual settings, and combat tuning to the deployed project files?")) return;
  sceneryProps.splice(0,sceneryProps.length,...getProjectWorldObjects());
  sceneryNPCs.splice(0,sceneryNPCs.length,...getProjectNPCs());
  replaceQuestDefinitions(PROJECT_QUESTS);
  Object.assign(VISUAL_SCALE,PROJECT_VISUAL_SCALE);
  Object.assign(MOB_TYPE_SCALE,PROJECT_MOB_TYPE_SCALE);
  Object.assign(LOOT_REMNANT_VISUAL,PROJECT_LOOT_REMNANT_VISUAL);
  devReplaceBalance(DEV_PROJECT_BALANCE);
  refreshMobTemplatesFromBalance();
  if(state) refreshAliveMobStatsForPlayer();
  rebuildWorldObjectCollision();rebuildNpcCollision();
  devSelected=null;devSelectedNpc=null;devSelectedMob=null;devSelectedRemnant=null;devSelectedQuestId=questDefinitions[0]?.id||null;devQuestFormDraft=null;
  refreshDeveloperPanel();updateUI();
  devSetStatus("Deployed project content restored");
}

function downloadDeveloperText(filename,text,type="application/json"){
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function exportDeveloperLayout(){
  const clean=sceneryProps.map(cloneWorldObject);
  downloadDeveloperText("world-objects.js",`/* Exported from Little Realm World Builder */\nwindow.LR_WORLD_OBJECTS = ${JSON.stringify(clean,null,2)};\n`,"text/javascript");
  devSetStatus("Exported world-objects.js");
}

function exportDeveloperNpcs(){
  downloadDeveloperText("npcs.js",`/* Exported from Little Realm World Builder */\nwindow.LR_NPCS = ${JSON.stringify(sceneryNPCs.map(cloneNpc),null,2)};\n`,"text/javascript");
  devSetStatus("Exported npcs.js");
}

function exportDeveloperQuests(){
  downloadDeveloperText("quests.js",`/* Exported from Little Realm World Builder */\nwindow.LR_QUESTS = ${JSON.stringify(questDefinitions.map(cloneQuest),null,2)};\n`,"text/javascript");
  devSetStatus("Exported quests.js");
}

function exportDeveloperWorldPack(){
  downloadDeveloperText("little-realm-world-pack.json",JSON.stringify(developerWorldPack(),null,2));
  devSetStatus("Exported one World Pack — upload this file when you want the project updated");
}

function importDeveloperWorldPackFile(file){
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(String(reader.result||""));
      applyDeveloperWorldPack(parsed);
      saveDeveloperDraft();
    }catch(err){console.error(err);devSetStatus("World Pack import failed — invalid JSON");}
  };
  reader.readAsText(file);
}

function devSetStatus(text){
  if(!devPanel) return;
  const el=devPanel.querySelector("#devStatus");
  if(el) el.textContent=text;
  clearTimeout(devStatusTimer);
  devStatusTimer=setTimeout(()=>{if(el)el.textContent="F2 toggles World Builder";},2200);
}

function developerNpcTemplate(kind){
  if(kind==="lilly") return {name:"Lilly",role:"Villager",sprite:"./assets/npcs/lilly.png",displayHeight:58,greeting:"Hello!"};
  if(kind==="jorge") return {name:"Jorge",role:"Villager",sprite:"./assets/npcs/jorge.png",displayHeight:58,greeting:"Good to see you."};
  return {name:"New NPC",role:"Villager",sprite:NPC_PLACEHOLDER_SPRITE,displayHeight:58,greeting:"Hello there."};
}

function uniqueNpcId(base="npc"){
  const root=String(base||"npc").toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"")||"npc";
  let id=root,n=2;
  while(sceneryNPCs.some(npc=>npc.id===id)){id=`${root}-${n++}`;}
  return id;
}

function placeDeveloperNpc(kind,wx,wy){
  const template=developerNpcTemplate(kind);
  const npc=normalizeNpcRecord({
    ...template,
    id:uniqueNpcId(template.name),
    x:snapDev(wx),
    y:snapDev(wy),
    facing:"down",
    solid:true
  },sceneryNPCs.length);
  sceneryNPCs.push(npc);
  rebuildNpcCollision();
  devSelectedNpc=npc;devSelected=null;devSelectedMob=null;devSelectedRemnant=null;devPlaceNpcTemplate=null;
  setDeveloperTab("selection");
  saveDeveloperDraft();refreshDeveloperPanel();
  devSetStatus(`Placed ${npc.name} — visual size, hitbox, and depth can be edited in Selection`);
}

function findDeveloperNpcAt(wx,wy){
  return findNpcAtWorld(wx,wy);
}

function placeDeveloperObject(type,wx,wy){
  const spec=worldObjectSpec({type});
  if(!spec) return;
  const obj=defaultWorldObject(type,snapDev(wx-spec.w/2),snapDev(wy-spec.h/2));
  sceneryProps.push(obj);
  devSelected=obj;
  devSelectedMob=null;devSelectedNpc=null;devSelectedRemnant=null;
  setDeveloperTab("selection");
  rebuildWorldObjectCollision();
  saveDeveloperDraft();
  refreshDeveloperPanel();
}

function devPointerDown(event){
  if(!devModeActive) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const p=devWorldFromPointer(event);
  if(devPlaceNpcTemplate){
    placeDeveloperNpc(devPlaceNpcTemplate,p.x,p.y);
    return;
  }
  if(devPlaceType){
    placeDeveloperObject(devPlaceType,p.x,p.y);
    return;
  }

  if(findDeveloperDepthInteraction(p.x,p.y)){
    const entity=developerSelectedEntity();
    const depth=ensureDeveloperDepth(entity);
    devDragging=false;devNpcDragging=false;
    devDepthDrag={pointerY:p.y,depthY:depth.y};
    if(game?.style) game.style.cursor="ns-resize";
    try{ game.setPointerCapture?.(event.pointerId); }catch{}
    devSetStatus("Moving depth line — release to save");
    return;
  }

  const hitboxInteraction=findDeveloperHitboxInteraction(p.x,p.y);
  if(hitboxInteraction){
    const entity=developerSelectedEntity();
    const hb=ensureDeveloperHitbox(entity);
    devDragging=false;devNpcDragging=false;
    devHitboxDrag={
      handle:hitboxInteraction,
      pointerX:p.x,
      pointerY:p.y,
      hitbox:{x:hb.x,y:hb.y,w:hb.w,h:hb.h}
    };
    if(game?.style) game.style.cursor=developerHitboxCursor(hitboxInteraction);
    try{ game.setPointerCapture?.(event.pointerId); }catch{}
    devSetStatus(hitboxInteraction==="move"?"Moving hitbox — release to save":"Resizing hitbox — release to save");
    return;
  }

  if(devSelectedRemnant && findDeveloperRemnantPreviewAt(p.x,p.y)){
    devRemnantDragging=true;
    devRemnantDragOffset={x:p.x-devRemnantPreview.x,y:p.y-devRemnantPreview.y};
    try{ game.setPointerCapture?.(event.pointerId); }catch{}
    devSetStatus("Moving remnant preview — release to keep testing scale/depth");
    return;
  }

  const npc=findDeveloperNpcAt(p.x,p.y);
  if(npc){
    devSelectedNpc=npc;
    devSelected=null;devSelectedMob=null;devSelectedRemnant=null;
    setDeveloperTab("selection");
    if(devHitboxEditing){
      ensureDeveloperHitbox(npc);
      devNpcDragging=false;
      devSetStatus(`Selected ${npc.name} — drag the yellow NPC hitbox or its handles`);
    }else if(devDepthEditing && npcDepthMode(npc)==="ysort"){
      ensureDeveloperDepth(npc);
      devNpcDragging=false;
      devSetStatus(`Selected ${npc.name} — drag the purple NPC depth line`);
    }else{
      devNpcDragging=true;
      devNpcDragOffset={x:p.x-npc.x,y:p.y-npc.y};
      try{ game.setPointerCapture?.(event.pointerId); }catch{}
      devSetStatus(`Selected ${npc.name} — drag to move; Selection has size, hitbox, and depth tools`);
    }
    refreshDeveloperPanel();
    return;
  }

  const mob=findDeveloperMobAt(p.x,p.y);
  if(mob){
    devSelectedMob=mob;
    devSelected=null;devSelectedNpc=null;devSelectedRemnant=null;
    devDragging=false;devNpcDragging=false;
    devHitboxEditing=false;
    devHitboxDrag=null;
    devDepthEditing=false;
    devDepthDrag=null;
    devCombatMobType=mobTypeScaleKey(mob);
    if(devActiveTab!=="combat") setDeveloperTab("scale");
    refreshDeveloperPanel();
    if(devActiveTab==="combat") devSetStatus(`${mobTypeScaleLabel(devCombatMobType)} selected — combat tuning now targets this species`);
    else devSetStatus(`${mobTypeScaleLabel(devCombatMobType)} selected — scale changes affect every ${mobTypeScaleLabel(devCombatMobType).toLowerCase()}`);
    return;
  }

  devSelectedMob=null;devSelectedNpc=null;devSelectedRemnant=null;
  devSelected=findWorldObjectAt(p.x,p.y);
  if(devSelected){
    setDeveloperTab("selection");
    if(devHitboxEditing){
      ensureDeveloperHitbox(devSelected);
      devDragging=false;
      devSetStatus(`Selected ${devSelected.label||devSelected.type} — drag the yellow hitbox or its handles`);
    }else if(devDepthEditing && worldObjectDepthMode(devSelected)==="ysort"){
      ensureDeveloperDepth(devSelected);
      devDragging=false;
      devSetStatus(`Selected ${devSelected.label||devSelected.type} — drag the purple depth line`);
    }else{
      devDragging=true;
      devDragOffset={x:p.x-devSelected.x,y:p.y-devSelected.y};
      try{ game.setPointerCapture?.(event.pointerId); }catch{}
      devSetStatus(`Selected ${devSelected.label||devSelected.type} — drag to move`);
    }
  }else{
    devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;
    devSetStatus("Nothing selected — choose a prop/NPC from Selection or place one from its palette");
  }
  refreshDeveloperPanel();
}
function devPointerMove(event){
  if(!devModeActive) return;
  const p=devWorldFromPointer(event);

  if(devRemnantDragging && devRemnantPreview){
    event.preventDefault();event.stopImmediatePropagation();
    devRemnantPreview.x=snapDev(p.x-devRemnantDragOffset.x);
    devRemnantPreview.y=snapDev(p.y-devRemnantDragOffset.y);
    return;
  }

  if(devNpcDragging && devSelectedNpc){
    event.preventDefault();event.stopImmediatePropagation();
    devSelectedNpc.x=snapDev(p.x-devNpcDragOffset.x);
    devSelectedNpc.y=snapDev(p.y-devNpcDragOffset.y);
    rebuildNpcCollision();
    refreshDeveloperInspectorValues();
    refreshDeveloperNpcInspectorValues();
    return;
  }

  if(devHitboxDrag && developerSelectedEntity()){
    event.preventDefault(); event.stopImmediatePropagation();
    updateDeveloperHitboxDrag(p);
    return;
  }

  if(devDepthDrag && developerSelectedEntity()){
    event.preventDefault(); event.stopImmediatePropagation();
    updateDeveloperDepthDrag(p);
    return;
  }

  if(devDepthEditing && developerSelectedEntity() && game?.style){
    game.style.cursor=findDeveloperDepthInteraction(p.x,p.y)?"ns-resize":"";
  }else if(devHitboxEditing && developerSelectedEntity() && game?.style){
    game.style.cursor=developerHitboxCursor(findDeveloperHitboxInteraction(p.x,p.y));
  }else if(game?.style && !devDragging && !devNpcDragging && !devRemnantDragging){
    game.style.cursor="";
  }

  if(!devDragging || !devSelected) return;
  event.preventDefault(); event.stopImmediatePropagation();
  devSelected.x=snapDev(p.x-devDragOffset.x);
  devSelected.y=snapDev(p.y-devDragOffset.y);
  rebuildWorldObjectCollision();
  refreshDeveloperInspectorValues();
}
function devPointerUp(event){
  if(!devModeActive || (!devDragging && !devNpcDragging && !devRemnantDragging && !devHitboxDrag && !devDepthDrag)) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const finishedNpc=!!devNpcDragging;
  const finishedRemnant=!!devRemnantDragging;
  devDragging=false;devNpcDragging=false;devRemnantDragging=false;
  const finishedHitbox=!!devHitboxDrag;
  const finishedDepth=!!devDepthDrag;
  devHitboxDrag=null;
  devDepthDrag=null;
  try{ game.releasePointerCapture?.(event.pointerId); }catch{}
  saveDeveloperDraft();
  if(finishedRemnant) devSetStatus("Remnant preview position updated — runtime piles use the same scale/depth settings");
  else if(finishedNpc) devSetStatus("NPC position updated");
  else if(finishedHitbox) devSetStatus("Hitbox updated — keep dragging handles or click Finish Hitbox Editing");
  else if(finishedDepth) devSetStatus("Depth line updated — move around the NPC/object to test overlap");
}

function drawDeveloperSelectedEntityOverlay(entity,camX,camY){
  if(!entity) return;
  const b=developerEntityBounds(entity);
  const x=b.x-camX,y=b.y-camY;
  ctx.strokeStyle="#63e6ff";
  ctx.fillStyle="rgba(99,230,255,.05)";
  ctx.lineWidth=2/CAMERA_ZOOM;
  ctx.fillRect(x-2,y-2,b.w+4,b.h+4);
  ctx.strokeRect(x-2,y-2,b.w+4,b.h+4);

  if(devHitboxEditing){
    const hb=ensureDeveloperHitbox(entity);
    const hx=entity.x+hb.x-camX, hy=entity.y+hb.y-camY;
    ctx.fillStyle="rgba(255,209,102,.13)";
    ctx.strokeStyle="#ffd166";
    ctx.lineWidth=2/CAMERA_ZOOM;
    ctx.fillRect(hx,hy,hb.w,hb.h);
    ctx.strokeRect(hx,hy,hb.w,hb.h);

    const handleSize=7/CAMERA_ZOOM;
    const half=handleSize/2;
    const points=[
      [hx,hy],[hx+hb.w/2,hy],[hx+hb.w,hy],
      [hx,hy+hb.h/2],[hx+hb.w,hy+hb.h/2],
      [hx,hy+hb.h],[hx+hb.w/2,hy+hb.h],[hx+hb.w,hy+hb.h]
    ];
    ctx.fillStyle="#fff3c4";
    ctx.strokeStyle="#8a6817";
    ctx.lineWidth=1/CAMERA_ZOOM;
    for(const [px,py] of points){
      ctx.fillRect(px-half,py-half,handleSize,handleSize);
      ctx.strokeRect(px-half,py-half,handleSize,handleSize);
    }
  }

  if(devDepthEditing && developerEntityDepthMode(entity)==="ysort"){
    const depth=ensureDeveloperDepth(entity);
    const lineY=entity.y+depth.y-camY;
    ctx.strokeStyle="#d58cff";
    ctx.fillStyle="#f2d7ff";
    ctx.lineWidth=2/CAMERA_ZOOM;
    ctx.beginPath();ctx.moveTo(x-8,lineY);ctx.lineTo(x+b.w+8,lineY);ctx.stroke();
    const r=5/CAMERA_ZOOM;
    const cx=x+b.w/2;
    ctx.beginPath();
    ctx.moveTo(cx,lineY-r);ctx.lineTo(cx+r,lineY);ctx.lineTo(cx,lineY+r);ctx.lineTo(cx-r,lineY);ctx.closePath();ctx.fill();
    ctx.font=`${Math.max(7,9/CAMERA_ZOOM)}px system-ui`;
    ctx.fillStyle="#f2d7ff";
    ctx.fillText("DEPTH",x+b.w+10,lineY-2/CAMERA_ZOOM);
  }

  if(developerIsNpc(entity)){
    ctx.font="800 9px system-ui";ctx.textAlign="center";ctx.fillStyle="#dffbff";
    ctx.fillText(entity.name,entity.x-camX,y-7);ctx.textAlign="start";
  }
}

function drawDeveloperOverlay(camX,camY,viewW,viewH){
  ctx.save();
  ctx.lineWidth=1/CAMERA_ZOOM;
  if(devShowGrid){
    ctx.strokeStyle="rgba(255,255,255,.10)";
    const step=devSnap;
    const startX=Math.floor(camX/step)*step;
    const startY=Math.floor(camY/step)*step;
    ctx.beginPath();
    for(let wx=startX;wx<camX+viewW;wx+=step){const x=wx-camX;ctx.moveTo(x,0);ctx.lineTo(x,viewH);}
    for(let wy=startY;wy<camY+viewH;wy+=step){const y=wy-camY;ctx.moveTo(0,y);ctx.lineTo(viewW,y);}
    ctx.stroke();
  }
  if(devShowHitboxes){
    for(const obj of sceneryProps){
      if(!obj.solid || !obj.hitbox) continue;
      const hb=obj.hitbox;
      ctx.fillStyle="rgba(255,75,75,.12)";
      ctx.strokeStyle="rgba(255,90,90,.8)";
      const x=obj.x+hb.x-camX,y=obj.y+hb.y-camY;
      ctx.fillRect(x,y,hb.w,hb.h);ctx.strokeRect(x,y,hb.w,hb.h);
    }
    for(const npc of sceneryNPCs){
      if(npc.solid===false || !npc.hitbox) continue;
      const hb=npc.hitbox;
      ctx.fillStyle="rgba(255,75,75,.12)";
      ctx.strokeStyle="rgba(255,90,90,.8)";
      const x=npc.x+hb.x-camX,y=npc.y+hb.y-camY;
      ctx.fillRect(x,y,hb.w,hb.h);ctx.strokeRect(x,y,hb.w,hb.h);
    }
  }
  if(devShowDepthLines){
    for(const obj of sceneryProps){
      if(worldObjectDepthMode(obj)!=="ysort") continue;
      const spec=worldObjectSpec(obj);
      if(!spec) continue;
      const y=obj.y+worldObjectDepthY(obj)-camY;
      const x=obj.x-camX;
      ctx.strokeStyle=obj===devSelected?"rgba(213,140,255,.95)":"rgba(213,140,255,.32)";
      ctx.lineWidth=(obj===devSelected?1.7:1)/CAMERA_ZOOM;
      ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x+spec.w+3,y);ctx.stroke();
    }
    for(const npc of sceneryNPCs){
      if(npcDepthMode(npc)!=="ysort") continue;
      const b=npcVisualBounds(npc);
      const y=npc.y+npcDepthY(npc)-camY;
      const x=b.x-camX;
      ctx.strokeStyle=npc===devSelectedNpc?"rgba(213,140,255,.95)":"rgba(213,140,255,.32)";
      ctx.lineWidth=(npc===devSelectedNpc?1.7:1)/CAMERA_ZOOM;
      ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x+b.w+3,y);ctx.stroke();
    }
  }
  if(devSelectedRemnant && devRemnantPreview){
    const b=developerRemnantPreviewBounds();
    const x=b.x-camX,y=b.y-camY;
    ctx.strokeStyle="#63e6ff";ctx.fillStyle="rgba(99,230,255,.05)";ctx.lineWidth=2/CAMERA_ZOOM;
    ctx.fillRect(x-2,y-2,b.w+4,b.h+4);ctx.strokeRect(x-2,y-2,b.w+4,b.h+4);
    if(devShowDepthLines && lootRemnantDepthMode()==="ysort"){
      const lineY=devRemnantPreview.y+lootRemnantDepthY()-camY;
      ctx.strokeStyle="#d58cff";ctx.lineWidth=2/CAMERA_ZOOM;ctx.beginPath();ctx.moveTo(x-8,lineY);ctx.lineTo(x+b.w+8,lineY);ctx.stroke();
      ctx.font=`${Math.max(7,9/CAMERA_ZOOM)}px system-ui`;ctx.fillStyle="#f2d7ff";ctx.fillText("DEPTH",x+b.w+10,lineY-2/CAMERA_ZOOM);
    }
  }
  drawDeveloperSelectedEntityOverlay(developerSelectedEntity(),camX,camY);
  if(devSelectedMob && devSelectedMob.alive){
    const x=devSelectedMob.x-camX,y=devSelectedMob.y-camY;
    const scale=mobVisualScale(devSelectedMob);
    ctx.strokeStyle="#63e6ff";
    ctx.fillStyle="rgba(99,230,255,.10)";
    ctx.lineWidth=2/CAMERA_ZOOM;
    ctx.beginPath();ctx.ellipse(x,y+8,(devSelectedMob.boss?28:20)*scale,(devSelectedMob.boss?13:9)*scale,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.font="800 10px system-ui";ctx.textAlign="center";ctx.fillStyle="#dffbff";
    ctx.fillText(`${mobTypeScaleLabel(mobTypeScaleKey(devSelectedMob))} ${scale.toFixed(2)}×`,x,y-(devSelectedMob.boss?44:34)*scale);
    ctx.textAlign="start";
  }
  ctx.restore();
}

function deleteDeveloperSelection(){
  if(!devSelected) return;
  const i=sceneryProps.indexOf(devSelected);
  if(i>=0) sceneryProps.splice(i,1);
  devSelected=null;
  devHitboxEditing=false;
  devHitboxDrag=null;
  devDepthEditing=false;
  devDepthDrag=null;
  rebuildWorldObjectCollision();
  saveDeveloperDraft();
  refreshDeveloperPanel();
}
function duplicateDeveloperSelection(){
  if(!devSelected) return;
  const copy=cloneWorldObject(devSelected);
  copy.id=`${copy.type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
  copy.x+=devSnap*2;copy.y+=devSnap*2;
  sceneryProps.push(copy);devSelected=copy;
  rebuildWorldObjectCollision();saveDeveloperDraft();refreshDeveloperPanel();
}

function applyDeveloperInspector(){
  if(!devPanel||!devSelected) return;
  const q=id=>devPanel.querySelector(`#${id}`);
  devSelected.x=numberOr(q("devX").value,devSelected.x);
  devSelected.y=numberOr(q("devY").value,devSelected.y);
  devSelected.label=q("devLabel").value.trim()||devSelected.type;
  devSelected.solid=q("devSolid").checked;
  devSelected.interactable=q("devInteractable").checked;
  devSelected.container=q("devContainer").checked;
  devSelected.capacity=Math.max(0,Math.round(numberOr(q("devCapacity").value,8)));
  devSelected.hitbox=devSelected.hitbox||{};
  devSelected.hitbox.x=numberOr(q("devHbX").value,0);
  devSelected.hitbox.y=numberOr(q("devHbY").value,0);
  devSelected.hitbox.w=Math.max(1,numberOr(q("devHbW").value,16));
  devSelected.hitbox.h=Math.max(1,numberOr(q("devHbH").value,12));
  devSelected.depthMode=WORLD_OBJECT_DEPTH_MODES.has(q("devDepthMode")?.value)?q("devDepthMode").value:"ysort";
  devSelected.depthY=numberOr(q("devDepthY")?.value,defaultWorldObjectDepthY(devSelected));
  if(devSelected.depthMode!=="ysort"){ devDepthEditing=false; devDepthDrag=null; }
  rebuildWorldObjectCollision();
  saveDeveloperDraft();
  refreshDeveloperPanel(false);
}

function applyDeveloperNpcVisualInspector(){
  if(!devPanel||!devSelectedNpc) return;
  const q=id=>devPanel.querySelector(`#${id}`);
  devSelectedNpc.x=numberOr(q("devX")?.value,devSelectedNpc.x);
  devSelectedNpc.y=numberOr(q("devY")?.value,devSelectedNpc.y);
  devSelectedNpc.sprite=q("devNpcSelectionSprite")?.value||NPC_PLACEHOLDER_SPRITE;
  devSelectedNpc.facing=q("devNpcSelectionFacing")?.value||devSelectedNpc.facing||"down";
  devSelectedNpc.displayHeight=Math.max(24,numberOr(q("devNpcSelectionHeight")?.value,devSelectedNpc.displayHeight));
  devSelectedNpc.solid=!!q("devSolid")?.checked;
  devSelectedNpc.hitbox=devSelectedNpc.hitbox||{};
  devSelectedNpc.hitbox.x=numberOr(q("devHbX")?.value,-6);
  devSelectedNpc.hitbox.y=numberOr(q("devHbY")?.value,-7);
  devSelectedNpc.hitbox.w=Math.max(2,numberOr(q("devHbW")?.value,12));
  devSelectedNpc.hitbox.h=Math.max(2,numberOr(q("devHbH")?.value,14));
  devSelectedNpc.depthMode=WORLD_OBJECT_DEPTH_MODES.has(q("devDepthMode")?.value)?q("devDepthMode").value:"ysort";
  devSelectedNpc.depthY=numberOr(q("devDepthY")?.value,defaultNpcDepthY(devSelectedNpc));
  if(devSelectedNpc.depthMode!=="ysort"){devDepthEditing=false;devDepthDrag=null;}
  rebuildNpcCollision();
  saveDeveloperDraft();
  refreshDeveloperPanel(false);
  devSetStatus(`Applied visual settings for ${devSelectedNpc.name}`);
}

function refreshDeveloperInspectorValues(){
  if(!devPanel) return;
  const entity=developerSelectedEntity();
  if(!entity) return;
  const q=id=>devPanel.querySelector(`#${id}`);
  if(q("devX")) q("devX").value=Math.round(entity.x);
  if(q("devY")) q("devY").value=Math.round(entity.y);
  const hb=ensureDeveloperHitbox(entity);
  if(q("devHbX")) q("devHbX").value=Math.round(hb.x);
  if(q("devHbY")) q("devHbY").value=Math.round(hb.y);
  if(q("devHbW")) q("devHbW").value=Math.round(hb.w);
  if(q("devHbH")) q("devHbH").value=Math.round(hb.h);
  const depth=ensureDeveloperDepth(entity);
  if(q("devDepthMode")) q("devDepthMode").value=depth.mode;
  if(q("devDepthY")) q("devDepthY").value=Math.round(depth.y);
  if(developerIsNpc(entity)){
    if(q("devNpcSelectionHeight")) q("devNpcSelectionHeight").value=Math.round(entity.displayHeight);
    if(q("devNpcSelectionSprite")) q("devNpcSelectionSprite").value=entity.sprite||NPC_PLACEHOLDER_SPRITE;
    if(q("devNpcSelectionFacing")) q("devNpcSelectionFacing").value=entity.facing||"down";
  }
}

function drawPaletteThumb(canvas,type){
  if(!canvas) return;
  const c=canvas.getContext("2d");
  c.clearRect(0,0,48,48); c.imageSmoothingEnabled=false;
  if(type==="caveEntrance"){
    c.fillStyle="#6f5a48"; c.fillRect(7,9,34,8);
    c.fillStyle="#7c6653"; c.fillRect(4,15,7,13); c.fillRect(37,15,7,13);
    c.fillStyle="#121013"; c.fillRect(12,16,24,18);
    c.fillStyle="#1f1a20"; c.fillRect(15,19,18,13);
    c.fillStyle="#85705d"; c.fillRect(9,31,30,5);
    return;
  }
  const spec=PROP_SPECS[type];
  if(!spec||!propAtlasReady) return;
  const sx=Number.isFinite(spec.sx)?spec.sx:spec.col*PROP_ATLAS_CELL;
  const sy=Number.isFinite(spec.sy)?spec.sy:spec.row*PROP_ATLAS_CELL;
  const sw=Number.isFinite(spec.sw)?spec.sw:PROP_ATLAS_CELL;
  const sh=Number.isFinite(spec.sh)?spec.sh:PROP_ATLAS_CELL;
  const scale=Math.min(44/sw,44/sh);
  const dw=Math.max(1,Math.round(sw*scale)), dh=Math.max(1,Math.round(sh*scale));
  c.drawImage(propAtlas,sx,sy,sw,sh,Math.round((48-dw)/2),Math.round((48-dh)/2),dw,dh);
}

function refreshDeveloperObjectList(){
  if(!devPanel) return;
  const list=devPanel.querySelector("#devObjectList");
  const count=devPanel.querySelector("#devObjectCount");
  if(count) count.textContent=`${sceneryProps.length} placed`;
  if(!list) return;
  list.innerHTML="";
  for(const obj of sceneryProps){
    const b=document.createElement("button");
    b.className="devObjectChip"+(obj===devSelected?" active":"");
    b.textContent=obj.label||obj.type;
    b.title=`${obj.type} @ ${Math.round(obj.x)}, ${Math.round(obj.y)}`;
    b.onclick=()=>{
      devPlaceType=null;devPlaceNpcTemplate=null;
      devSelectedMob=null;devSelectedNpc=null;devSelectedRemnant=null;
      devSelected=obj;
      setDeveloperTab("selection");
      updateDevPaletteActive();
      refreshDeveloperPanel();
      devSetStatus(`Selected ${obj.label||obj.type}`);
    };
    list.appendChild(b);
  }
}

function refreshDeveloperSelectionList(){
  if(!devPanel) return;
  const list=devPanel.querySelector("#devSelectionList");
  const count=devPanel.querySelector("#devSelectionCount");
  if(count) count.textContent=`${sceneryProps.length} props • ${sceneryNPCs.length} NPCs • 2 remnants`;
  if(!list) return;
  list.innerHTML="";
  for(const kind of ["dust","lootable"]){
    const b=document.createElement("button");
    const label=kind==="lootable"?"Lootable Dust":"Dust";
    b.className="devObjectChip"+(devSelectedRemnant===kind?" active":"");
    b.textContent=`REMNANT • ${label}`;
    b.title=`Global ${label} runtime preview — scale and depth settings affect all mob death piles`;
    b.onclick=()=>selectDeveloperRemnant(kind);
    list.appendChild(b);
  }
  for(const npc of sceneryNPCs){
    const b=document.createElement("button");
    b.className="devObjectChip"+(npc===devSelectedNpc?" active":"");
    b.textContent=`NPC • ${npc.name}`;
    b.title=`${npc.role||"NPC"} @ ${Math.round(npc.x)}, ${Math.round(npc.y)}`;
    b.onclick=()=>{
      devPlaceType=null;devPlaceNpcTemplate=null;devSelectedMob=null;devSelectedRemnant=null;devSelected=null;devSelectedNpc=npc;
      devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;
      setDeveloperTab("selection");updateDevPaletteActive();refreshDeveloperPanel();
      devSetStatus(`Selected NPC ${npc.name} — visual size, hitbox, and depth are editable here`);
    };
    list.appendChild(b);
  }
  for(const obj of sceneryProps){
    const b=document.createElement("button");
    b.className="devObjectChip"+(obj===devSelected?" active":"");
    b.textContent=`PROP • ${obj.label||obj.type}`;
    b.title=`${obj.type} @ ${Math.round(obj.x)}, ${Math.round(obj.y)}`;
    b.onclick=()=>{
      devPlaceType=null;devPlaceNpcTemplate=null;devSelectedMob=null;devSelectedRemnant=null;devSelectedNpc=null;devSelected=obj;
      devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;
      setDeveloperTab("selection");updateDevPaletteActive();refreshDeveloperPanel();
      devSetStatus(`Selected ${obj.label||obj.type}`);
    };
    list.appendChild(b);
  }
}

function refreshDeveloperPanel(rebuild=true){
  if(!devPanel) return;
  if(!rebuild){ refreshDeveloperInspectorValues(); return; }
  const inspector=devPanel.querySelector("#devInspector");
  if(!inspector) return;
  refreshDeveloperObjectList();
  refreshDeveloperSelectionList();
  refreshDeveloperNpcPanel();
  refreshDeveloperQuestPanel();
  refreshDeveloperProjectPanel();
  refreshDeveloperMobPanel();
  refreshDeveloperCombatPanel();

  const entity=developerSelectedEntity();
  if(devSelectedRemnant && !entity && !devSelectedMob){
    const label=devSelectedRemnant==="lootable"?"Lootable Dust":"Dust";
    const mode=lootRemnantDepthMode();
    inspector.innerHTML=`
      <div class="devSelectedTitle">REMNANT • ${label}</div>
      <div class="devHint">This is a temporary World Builder preview. Scale and depth are global: both plain and lootable mob-death piles use the same settings. Drag the preview in the world to test overlap against the player, NPCs, and props.</div>
      <div class="devScaleControl"><div class="devScaleTop"><span>Remnant Scale</span><span id="devRemnantScaleValue">${LOOT_REMNANT_VISUAL.scale.toFixed(2)}×</span></div><input id="devRemnantScale" type="range" min="0.25" max="3.00" step="0.05" value="${LOOT_REMNANT_VISUAL.scale}"></div>
      <div class="devSubhead">Player overlap / depth</div>
      <label>Depth Mode<select id="devRemnantDepthMode"><option value="ysort" ${mode==="ysort"?"selected":""}>Y-Sort (recommended)</option><option value="behind" ${mode==="behind"?"selected":""}>Always Behind Player</option><option value="front" ${mode==="front"?"selected":""}>Always In Front of Player</option><option value="ground" ${mode==="ground"?"selected":""}>Ground / Floor</option></select></label>
      <label>Depth line Y offset<input id="devRemnantDepthY" type="range" min="-40" max="40" step="1" value="${lootRemnantDepthY()}" ${mode==="ysort"?"":"disabled"}></label>
      <div class="devPair"><label>Depth Y<input id="devRemnantDepthYNumber" type="number" min="-80" max="80" step="1" value="${lootRemnantDepthY()}" ${mode==="ysort"?"":"disabled"}></label><label>Preview<input value="${label}" disabled></label></div>
      <div class="devDepthEditHelp">With Y-Sort, the purple line is the pile's overlap anchor. Move the preview around and walk above/below it to test when the player passes behind or in front.</div>
      <div class="devRow"><button id="devRemnantNearPlayer">Move Preview Near Player</button><button id="devRemnantReset">Reset Remnant Visuals</button></div>`;
    const scaleInput=inspector.querySelector("#devRemnantScale");
    scaleInput.oninput=e=>{updateDeveloperRemnantVisual({scale:e.target.value});const out=inspector.querySelector("#devRemnantScaleValue");if(out)out.textContent=LOOT_REMNANT_VISUAL.scale.toFixed(2)+"×";saveDeveloperDraft();};
    inspector.querySelector("#devRemnantDepthMode").onchange=e=>{updateDeveloperRemnantVisual({depthMode:e.target.value});saveDeveloperDraft();refreshDeveloperPanel();};
    const depthSlider=inspector.querySelector("#devRemnantDepthY");
    const depthNumber=inspector.querySelector("#devRemnantDepthYNumber");
    const applyDepth=v=>{updateDeveloperRemnantVisual({depthY:v});if(depthSlider)depthSlider.value=LOOT_REMNANT_VISUAL.depthY;if(depthNumber)depthNumber.value=LOOT_REMNANT_VISUAL.depthY;saveDeveloperDraft();};
    depthSlider.oninput=e=>applyDepth(e.target.value);depthNumber.oninput=e=>applyDepth(e.target.value);
    inspector.querySelector("#devRemnantNearPlayer").onclick=()=>{devRemnantPreview.x=snapDev(state.x+56);devRemnantPreview.y=snapDev(state.y+8);devSetStatus("Remnant preview moved near the player");};
    inspector.querySelector("#devRemnantReset").onclick=()=>{Object.assign(LOOT_REMNANT_VISUAL,PROJECT_LOOT_REMNANT_VISUAL);saveDeveloperDraft();refreshDeveloperPanel();devSetStatus("Remnant scale/depth reset to project settings");};
    return;
  }
  if(!entity){
    inspector.innerHTML='<div class="devEmpty">Choose a prop, NPC, or Loot Remnant from the Selection Library, or click one directly in the world.</div>';
    return;
  }

  const hb=ensureDeveloperHitbox(entity);
  const depth=ensureDeveloperDepth(entity);
  const canEditDepth=depth.mode==="ysort";

  if(developerIsNpc(entity)){
    const npc=entity;
    const spriteChoices=[
      [NPC_PLACEHOLDER_SPRITE,"Placeholder model"],
      ["./assets/npcs/lilly.png","Lilly model"],
      ["./assets/npcs/jorge.png","Jorge model"]
    ];
    if(npc.sprite&&!spriteChoices.some(([v])=>v===npc.sprite)) spriteChoices.push([npc.sprite,"Current custom sprite"]);
    inspector.innerHTML=`
      <div class="devSelectedTitle">NPC • ${questEscape(npc.name)}</div>
      <div class="devHint">Visual placement tools for NPCs. Use the NPCs tab for ID, role, greeting, and quest setup.</div>
      <div class="devPair"><label>X<input id="devX" type="number" value="${Math.round(npc.x)}"></label><label>Y<input id="devY" type="number" value="${Math.round(npc.y)}"></label></div>
      <div class="devPair"><label>Model<select id="devNpcSelectionSprite">${spriteChoices.map(([v,l])=>`<option value="${questEscape(v)}" ${v===npc.sprite?"selected":""}>${questEscape(l)}</option>`).join("")}</select></label><label>Facing<select id="devNpcSelectionFacing">${["down","left","right","up"].map(v=>`<option value="${v}" ${v===npc.facing?"selected":""}>${v}</option>`).join("")}</select></label></div>
      <label>Sprite Height<input id="devNpcSelectionHeight" type="number" min="24" value="${Math.round(npc.displayHeight)}"></label>
      <div class="devHint">Sprite Height updates live. The placeholder now uses the same sprite-sheet rendering path as Lilly and Jorge.</div>
      <div class="devChecks"><label><input id="devSolid" type="checkbox" ${npc.solid!==false?"checked":""}> Hitbox / Solid</label></div>
      <div class="devSubhead">NPC collision hitbox</div>
      <div class="devQuad"><label>X<input id="devHbX" type="number" value="${hb.x}"></label><label>Y<input id="devHbY" type="number" value="${hb.y}"></label><label>W<input id="devHbW" type="number" value="${hb.w}"></label><label>H<input id="devHbH" type="number" value="${hb.h}"></label></div>
      <button id="devEditHitbox" class="devHitboxEditButton${devHitboxEditing?" active":""}">${devHitboxEditing?"Finish Hitbox Editing":"Edit NPC Hitbox Visually"}</button>
      <div class="devHitboxEditHelp">${devHitboxEditing?"Drag inside the yellow NPC hitbox to move it. Drag its corners/sides to resize it.":"NPC hitboxes are now editable with the same visual handles used by world props."}</div>
      <div class="devSubhead">NPC overlap / depth</div>
      <label>Depth Mode<select id="devDepthMode"><option value="ysort" ${depth.mode==="ysort"?"selected":""}>Y-Sort (recommended)</option><option value="behind" ${depth.mode==="behind"?"selected":""}>Always Behind Player</option><option value="front" ${depth.mode==="front"?"selected":""}>Always In Front of Player</option><option value="ground" ${depth.mode==="ground"?"selected":""}>Ground / Background</option></select></label>
      <label>Depth line Y offset<input id="devDepthY" type="number" value="${Math.round(depth.y)}" ${canEditDepth?"":"disabled"}></label>
      <button id="devEditDepth" class="devDepthEditButton${devDepthEditing?" active":""}" ${canEditDepth?"":"disabled"}>${devDepthEditing?"Finish Depth Editing":"Edit NPC Depth Line Visually"}</button>
      <div class="devDepthEditHelp">${canEditDepth?(devDepthEditing?"Drag the purple line up/down to decide when the NPC sorts behind or in front of houses, props, and the player.":"Use this to fix overlaps like an NPC appearing on the wrong side of a house wall. Move the line until the NPC sorts naturally from its feet."):"This fixed mode ignores the depth line. Switch to Y-Sort for a draggable overlap anchor."}</div>
      <div class="devRow"><button id="devApply">Apply</button><button id="devNpcDetails">NPC Details</button><button id="devDuplicate">Duplicate</button><button id="devDelete" class="danger">Delete</button></div>`;

    inspector.querySelector("#devEditHitbox").onclick=()=>setDeveloperHitboxEditing(!devHitboxEditing);
    inspector.querySelector("#devEditDepth").onclick=()=>setDeveloperDepthEditing(!devDepthEditing);
    inspector.querySelector("#devDepthMode").onchange=e=>{
      npc.depthMode=e.target.value;
      if(npc.depthMode!=="ysort"){devDepthEditing=false;devDepthDrag=null;} else ensureDeveloperDepth(npc);
      saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`NPC depth mode: ${e.target.options[e.target.selectedIndex].text}`);
    };
    const liveHeight=inspector.querySelector("#devNpcSelectionHeight");
    liveHeight.oninput=e=>{npc.displayHeight=Math.max(24,numberOr(e.target.value,npc.displayHeight));rebuildNpcCollision();};
    liveHeight.onchange=()=>saveDeveloperDraft();
    inspector.querySelector("#devNpcSelectionSprite").onchange=e=>{npc.sprite=e.target.value||NPC_PLACEHOLDER_SPRITE;saveDeveloperDraft();};
    inspector.querySelector("#devNpcSelectionFacing").onchange=e=>{npc.facing=e.target.value||"down";saveDeveloperDraft();};
    inspector.querySelector("#devApply").onclick=applyDeveloperNpcVisualInspector;
    inspector.querySelector("#devNpcDetails").onclick=()=>{setDeveloperTab("npcs");refreshDeveloperPanel();devSetStatus(`Editing ${npc.name} NPC details`);};
    inspector.querySelector("#devDuplicate").onclick=duplicateDeveloperNpc;
    inspector.querySelector("#devDelete").onclick=deleteDeveloperNpc;
    return;
  }

  const obj=entity;
  inspector.innerHTML=`
    <div class="devSelectedTitle">${obj.type}</div>
    <label>Label<input id="devLabel" value="${String(obj.label||obj.type).replace(/"/g,"&quot;")}"></label>
    <div class="devPair"><label>X<input id="devX" type="number" value="${Math.round(obj.x)}"></label><label>Y<input id="devY" type="number" value="${Math.round(obj.y)}"></label></div>
    <div class="devChecks"><label><input id="devSolid" type="checkbox" ${obj.solid?"checked":""}> Hitbox / Solid</label><label><input id="devInteractable" type="checkbox" ${obj.interactable?"checked":""}> Interactable</label><label><input id="devContainer" type="checkbox" ${obj.container?"checked":""}> Container</label></div>
    <div class="devSubhead">Hitbox offset / size</div>
    <div class="devQuad"><label>X<input id="devHbX" type="number" value="${hb.x}"></label><label>Y<input id="devHbY" type="number" value="${hb.y}"></label><label>W<input id="devHbW" type="number" value="${hb.w}"></label><label>H<input id="devHbH" type="number" value="${hb.h}"></label></div>
    <button id="devEditHitbox" class="devHitboxEditButton${devHitboxEditing?" active":""}">${devHitboxEditing?"Finish Hitbox Editing":"Edit Hitbox Visually"}</button>
    <div class="devHitboxEditHelp">${devHitboxEditing?"Drag inside the yellow hitbox to move it. Drag any corner or side handle to resize it. Hitbox editing is pixel-precise and does not use the world-placement Snap setting.":"Use the visual editor instead of typing coordinates. The numeric fields stay available for exact values."}</div>
    <div class="devSubhead">Player overlap / depth</div>
    <label>Depth Mode<select id="devDepthMode"><option value="ysort" ${depth.mode==="ysort"?"selected":""}>Y-Sort (recommended)</option><option value="behind" ${depth.mode==="behind"?"selected":""}>Always Behind Player</option><option value="front" ${depth.mode==="front"?"selected":""}>Always In Front of Player</option><option value="ground" ${depth.mode==="ground"?"selected":""}>Ground / Floor</option></select></label>
    <label>Depth line Y offset<input id="devDepthY" type="number" value="${Math.round(depth.y)}" ${canEditDepth?"":"disabled"}></label>
    <button id="devEditDepth" class="devDepthEditButton${devDepthEditing?" active":""}" ${canEditDepth?"":"disabled"}>${devDepthEditing?"Finish Depth Editing":"Edit Depth Line Visually"}</button>
    <div class="devDepthEditHelp">${canEditDepth?(devDepthEditing?"Drag the purple line up or down. Unlike the hitbox, the depth line can move outside the blue sprite box. Player feet above the line draw behind the object; feet below the line draw in front.":"Y-Sort compares the player's feet with this purple line. Use the fixed Behind/Front modes only when an object should never switch sides."):"This fixed depth mode ignores the Y-Sort line. Switch to Y-Sort to use a draggable depth anchor."}</div>
    <label>Container slots<input id="devCapacity" type="number" min="0" value="${obj.capacity||0}"></label>
    <div class="devRow"><button id="devApply">Apply</button><button id="devDuplicate">Duplicate</button><button id="devDelete" class="danger">Delete</button></div>`;
  inspector.querySelector("#devEditHitbox").onclick=()=>setDeveloperHitboxEditing(!devHitboxEditing);
  inspector.querySelector("#devEditDepth").onclick=()=>setDeveloperDepthEditing(!devDepthEditing);
  inspector.querySelector("#devDepthMode").onchange=e=>{
    obj.depthMode=e.target.value;
    if(obj.depthMode!=="ysort"){devDepthEditing=false;devDepthDrag=null;} else ensureDeveloperDepth(obj);
    saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`Depth mode: ${e.target.options[e.target.selectedIndex].text}`);
  };
  inspector.querySelector("#devApply").onclick=applyDeveloperInspector;
  inspector.querySelector("#devDuplicate").onclick=duplicateDeveloperSelection;
  inspector.querySelector("#devDelete").onclick=deleteDeveloperSelection;
}

function updateVisualScaleControl(key,value){
  const n=visualScaleOr(value,VISUAL_SCALE[key]||1);
  VISUAL_SCALE[key]=Math.round(n*100)/100;
  if(devPanel){
    const out=devPanel.querySelector(`[data-scale-value="${key}"]`);
    if(out) out.textContent=VISUAL_SCALE[key].toFixed(2)+"×";
  }
}

function setMobTypeScale(key,value){
  if(!key || !Object.prototype.hasOwnProperty.call(MOB_TYPE_SCALE,key)) return;
  const n=visualScaleOr(value,MOB_TYPE_SCALE[key]||1);
  MOB_TYPE_SCALE[key]=Math.round(n*100)/100;
  refreshDeveloperMobPanel();
}

function selectDeveloperMobType(key){
  const match=mobs.find(m=>mobTypeScaleKey(m)===key) || {kind:key,boss:key==="snickers",alive:false};
  devSelectedMob=match;
  devCombatMobType=key;
  devSelected=null;devSelectedNpc=null;devSelectedRemnant=null;
  setDeveloperTab("scale");
  refreshDeveloperPanel();
}

function refreshDeveloperMobPanel(){
  if(!devPanel) return;
  const panel=devPanel.querySelector("#devMobScalePanel");
  if(!panel) return;
  const key=mobTypeScaleKey(devSelectedMob);
  const available=["slime","goblin","wolf","cow","pig","chicken","snickers"];
  if(!key){
    panel.innerHTML=`<div class="devEmpty">Click a mob in the world to select its type. You can then resize only that species.</div><div id="devMobTypeChips"></div>`;
  }else{
    const count=mobs.filter(m=>mobTypeScaleKey(m)===key).length;
    const value=MOB_TYPE_SCALE[key] ?? mobTypeFallbackScale(key);
    panel.innerHTML=`
      <div class="devMobSelectedTitle">${mobTypeScaleLabel(key)}</div>
      <div class="devMobMeta">Affects all ${count} ${mobTypeScaleLabel(key)} spawn${count===1?"":"s"}. Visual size only — combat stats and hitboxes are unchanged.</div>
      <div class="devScaleControl">
        <div class="devScaleTop"><span>${mobTypeScaleLabel(key)} scale</span><span id="devSelectedMobScaleValue">${value.toFixed(2)}×</span></div>
        <input id="devSelectedMobScale" type="range" min="0.25" max="3.00" step="0.05" value="${value}">
      </div>
      <div class="devRow"><button id="devResetMobScale">Reset ${mobTypeScaleLabel(key)}</button></div>
      <div id="devMobTypeChips"></div>`;
    panel.querySelector("#devSelectedMobScale").oninput=e=>setMobTypeScale(key,e.target.value);
    panel.querySelector("#devResetMobScale").onclick=()=>{
      MOB_TYPE_SCALE[key]=mobTypeFallbackScale(key);
      refreshDeveloperMobPanel();
      devSetStatus(`${mobTypeScaleLabel(key)} reset to ${MOB_TYPE_SCALE[key].toFixed(2)}×`);
    };
  }
  const chips=panel.querySelector("#devMobTypeChips");
  if(chips){
    for(const type of available){
      const b=document.createElement("button");
      b.className="devMobTypeChip"+(type===key?" active":"");
      b.textContent=mobTypeScaleLabel(type);
      b.onclick=()=>selectDeveloperMobType(type);
      chips.appendChild(b);
    }
  }
}

function exportVisualSettings(){
  const settings={...VISUAL_SCALE,mobTypes:{...MOB_TYPE_SCALE},remnants:{...LOOT_REMNANT_VISUAL}};
  const text=`/* Exported from Little Realm Developer Mode */
window.LR_VISUAL = ${JSON.stringify(settings,null,2)};
`;
  const blob=new Blob([text],{type:"text/javascript"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download="visual-settings.js";
  document.body.appendChild(a);
  a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  devSetStatus("Exported visual-settings.js with per-mob scales");
}

function resetVisualScale(){
  Object.assign(VISUAL_SCALE,PROJECT_VISUAL_SCALE);
  Object.assign(MOB_TYPE_SCALE,PROJECT_MOB_TYPE_SCALE);
  Object.assign(LOOT_REMNANT_VISUAL,PROJECT_LOOT_REMNANT_VISUAL);
  if(!devPanel) return;
  devPanel.querySelectorAll("[data-scale-key]").forEach(input=>{
    input.value=VISUAL_SCALE[input.dataset.scaleKey];
    updateVisualScaleControl(input.dataset.scaleKey,input.value);
  });
  refreshDeveloperMobPanel();
  devSetStatus("Visual scale reset to project settings");
}


function devBalanceClone(value){ return JSON.parse(JSON.stringify(value)); }
function devReplaceBalance(source){
  for(const key of Object.keys(BALANCE)) delete BALANCE[key];
  Object.assign(BALANCE,devBalanceClone(source));
}
function devCombatNum(value,fallback=0){
  const n=Number(value); return Number.isFinite(n)?n:fallback;
}
function devCombatField(field,label,value,step="1",min=null,max=null){
  return `<label class="devCombatField">${label}<input type="number" data-combat-field="${field}" value="${value}" step="${step}"${min!==null?` min="${min}"`:""}${max!==null?` max="${max}"`:""}></label>`;
}
function devGlobalField(field,label,value,step="1",min=null,max=null){
  return `<label class="devCombatField">${label}<input type="number" data-global-field="${field}" value="${value}" step="${step}"${min!==null?` min="${min}"`:""}${max!==null?` max="${max}"`:""}></label>`;
}
function devProgressionField(field,label,value,step="1",min=null,max=null){
  return `<label class="devCombatField">${label}<input type="number" data-progression-field="${field}" value="${value}" step="${step}"${min!==null?` min="${min}"`:""}${max!==null?` max="${max}"`:""}></label>`;
}
function developerXpNextForLevel(level){
  return xpRequiredForLevel(level);
}
function captureDeveloperPlayerBaseline(){
  if(devPlayerTestBaseline) return;
  devPlayerTestBaseline={level:state.level,xp:state.xp,xpNext:state.xpNext,hp:state.hp,maxHp:state.maxHp,atk:state.atk,def:state.def};
}
function applyDeveloperPlayerLevel(rawLevel){
  captureDeveloperPlayerBaseline();
  const level=Math.max(1,Math.min(playerLevelCap(),Math.floor(devCombatNum(rawLevel,state.level))));
  const steps=level-1;
  state.level=level;
  state.xp=0;
  state.xpNext=developerXpNextForLevel(level);
  state.maxHp=Math.max(1,Math.floor(numberOr(BALANCE.player?.maxHp,30)+steps*numberOr(BALANCE.progression?.hpPerLevel,8)));
  state.atk=Math.max(0,Math.floor(numberOr(BALANCE.player?.attack,5)+steps*numberOr(BALANCE.progression?.attackPerLevel,2)));
  state.def=Math.max(0,Math.floor(numberOr(BALANCE.player?.defense,1)+steps*numberOr(BALANCE.progression?.defensePerLevel,1)));
  state.hp=state.maxHp;
  refreshAliveMobStatsForPlayer();
  updateUI(); updateCombatHud(); refreshDeveloperCombatPanel();
  devSetStatus(`Player test level set to ${level}`);
}
function restoreDeveloperPlayerBaseline(){
  if(!devPlayerTestBaseline){devSetStatus("No player test-level baseline captured yet");return;}
  Object.assign(state,devPlayerTestBaseline);
  devPlayerTestBaseline=null;
  refreshAliveMobStatsForPlayer(); updateUI(); updateCombatHud(); refreshDeveloperCombatPanel();
  devSetStatus(`Restored player to level ${state.level}`);
}
function applyDeveloperSpeciesBalance(){
  if(!devPanel) return;
  const cfg=BALANCE.mobs?.[devCombatMobType];
  if(!cfg) return;
  const panel=devPanel.querySelector("#devCombatSpecies");
  panel?.querySelectorAll("[data-combat-field]").forEach(input=>{
    const key=input.dataset.combatField;
    cfg[key]=input.type==="checkbox"?input.checked:devCombatNum(input.value,cfg[key]);
  });
  cfg.baseLevel=Math.max(1,Math.floor(devCombatNum(cfg.baseLevel,1)));
  cfg.levelMin=Math.max(1,Math.floor(devCombatNum(cfg.levelMin,cfg.baseLevel)));
  cfg.levelMax=Math.max(cfg.levelMin,Math.floor(devCombatNum(cfg.levelMax,cfg.baseLevel)));
  cfg.hp=Math.max(1,devCombatNum(cfg.hp,1));
  cfg.attack=Math.max(0,devCombatNum(cfg.attack,0));
  cfg.defense=Math.max(0,devCombatNum(cfg.defense,0));
  cfg.xpMultiplier=Math.max(0,devCombatNum(cfg.xpMultiplier,1));
  cfg.eliteChancePercent=Math.max(0,Math.min(100,devCombatNum(cfg.eliteChancePercent,0)));
  refreshMobTemplatesFromBalance();
  refreshDeveloperCombatPanel(); updateCombatHud();
  devSetStatus(`${mobTypeScaleLabel(devCombatMobType)} combat settings applied live`);
}
function applyDeveloperGlobalCombatBalance(){
  if(!devPanel) return;
  BALANCE.mobLevels=BALANCE.mobLevels||{};
  devPanel.querySelectorAll("#devCombatGlobals [data-global-field]").forEach(input=>{
    BALANCE.mobLevels[input.dataset.globalField]=devCombatNum(input.value,BALANCE.mobLevels[input.dataset.globalField]);
  });
  BALANCE.progression=BALANCE.progression||{};
  devPanel.querySelectorAll("#devCombatGlobals [data-progression-field]").forEach(input=>{
    BALANCE.progression[input.dataset.progressionField]=devCombatNum(input.value,BALANCE.progression[input.dataset.progressionField]);
  });
  refreshMobTemplatesFromBalance(); refreshAliveMobStatsForPlayer(); updateCombatHud(); refreshDeveloperCombatPanel();
  devSetStatus("Global mob-level combat settings applied live");
}
function exportDeveloperBalance(){
  const text=`/* Exported from Little Realm Developer Mode */\nwindow.LR_BALANCE = ${JSON.stringify(BALANCE,null,2)};\n`;
  const blob=new Blob([text],{type:"text/javascript"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download="game-balance.js"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  devSetStatus("Exported game-balance.js");
}
function resetDeveloperCombatBalance(){
  if(!confirm("Reset live combat tuning to the project game-balance.js values?")) return;
  devReplaceBalance(DEV_PROJECT_BALANCE); refreshMobTemplatesFromBalance(); rerollMobLevelsAndElites(); refreshDeveloperCombatPanel(); updateCombatHud();
  devSetStatus("Combat tuning reset to project balance");
}
function developerMobPreview(){
  const mob=(devSelectedMob && mobTypeScaleKey(devSelectedMob)===devCombatMobType && devSelectedMob.alive)?devSelectedMob:mobs.find(m=>mobTypeScaleKey(m)===devCombatMobType && m.alive);
  if(!mob) return `<div class="devEmpty">No live ${mobTypeScaleLabel(devCombatMobType)} spawn available for preview.</div>`;
  const aggro=mobAggroRanges(mob);
  return `<div class="devHint">Live preview: Lv ${mob.level} ${mobDisplayName(mob)}${mob.dangerSteps?` • ${mob.dangerSteps} danger stack${mob.dangerSteps===1?"":"s"}`:""}</div><div class="devStatPreview"><div><b>${mob.maxHp}</b><span>HP</span></div><div><b>${mob.atk}</b><span>Damage</span></div><div><b>${mob.def}</b><span>Armor</span></div><div><b>${mobXpReward(mob)}</b><span>XP now</span></div><div><b>${Math.round(playerHitChanceAgainst(mob))}%</b><span>Your hit</span></div><div><b>${Math.round(mobHitChanceAgainstPlayer(mob))}%</b><span>Mob hit</span></div><div><b>${Math.round(aggro.trigger)}</b><span>Aggro</span></div><div><b>${mob.elite?"ELITE":mob.boss?"BOSS":"NORMAL"}</b><span>Rank</span></div></div>`;
}
function refreshDeveloperCombatPanel(){
  if(!devPanel) return;
  const player=devPanel.querySelector("#devPlayerTestPanel");
  const species=devPanel.querySelector("#devCombatSpecies");
  const globals=devPanel.querySelector("#devCombatGlobals");
  if(!player||!species||!globals) return;

  // Developer Mode is initialized before reset() creates the player state.
  // Do not let the optional tuning UI interrupt normal game startup.
  if(!state){
    player.innerHTML='<div class="devEmpty">Combat testing becomes available after the game finishes initializing.</div>';
    species.innerHTML='<div class="devEmpty">Mob tuning will load when Developer Mode is opened.</div>';
    globals.innerHTML='<div class="devEmpty">Global combat tuning will load when Developer Mode is opened.</div>';
    return;
  }

  player.innerHTML=`<div class="devPlayerTest"><label class="devCombatField">Player Test Level<input id="devPlayerTestLevel" type="number" min="1" max="100" step="1" value="${state.level}"></label><div><div class="devHint">Temporary testing control. Recalculates player HP/Attack/Defense and immediately refreshes danger scaling on living mobs.</div><div class="devQuickLevels">${[1,5,10,25,50,100].map(n=>`<button data-test-level="${n}">Lv ${n}</button>`).join("")}</div></div></div><div class="devStatPreview"><div><b>${state.level}</b><span>Level</span></div><div><b>${state.maxHp}</b><span>HP</span></div><div><b>${state.atk}</b><span>Attack</span></div><div><b>${state.def}</b><span>Defense</span></div></div><div class="devCombatActions"><button id="devSetPlayerLevel" class="primary">Apply Test Level</button><button id="devRestorePlayerLevel">Restore Before Testing</button><button id="devFullHeal">Full Heal</button></div>`;
  player.querySelector("#devSetPlayerLevel").onclick=()=>applyDeveloperPlayerLevel(player.querySelector("#devPlayerTestLevel").value);
  player.querySelectorAll("[data-test-level]").forEach(b=>b.onclick=()=>applyDeveloperPlayerLevel(b.dataset.testLevel));
  player.querySelector("#devRestorePlayerLevel").onclick=restoreDeveloperPlayerBaseline;
  player.querySelector("#devFullHeal").onclick=()=>{state.hp=state.maxHp;updateUI();devSetStatus("Player fully healed");};

  const types=["slime","wolf","goblin","cow","pig","chicken","snickers"];
  const cfg=BALANCE.mobs?.[devCombatMobType]||{};
  species.innerHTML=`<div id="devCombatMobChips">${types.map(k=>`<button class="devMobTypeChip${k===devCombatMobType?" active":""}" data-combat-mob="${k}">${mobTypeScaleLabel(k)}</button>`).join("")}</div><div class="devCombatGrid" style="margin-top:10px">${devCombatField("baseLevel","Base level",cfg.baseLevel??1,1,1,100)}${devCombatField("levelMin","Min spawn level",cfg.levelMin??cfg.baseLevel??1,1,1,100)}${devCombatField("levelMax","Max spawn level",cfg.levelMax??cfg.baseLevel??1,1,1,100)}${devCombatField("hp","Base HP",cfg.hp??1,1,1)}${devCombatField("attack","Base damage",cfg.attack??0,1,0)}${devCombatField("defense","Base armor",cfg.defense??0,.1,0)}${devCombatField("xpMultiplier","XP multiplier ×",cfg.xpMultiplier??1,.05,0)}${devCombatField("eliteChancePercent","Elite chance %",cfg.eliteChancePercent??0,.5,0,100)}${devCombatField("attackIntervalSeconds","Attack interval",cfg.attackIntervalSeconds??1.5,.05,.1)}${devCombatField("aggroTriggerRange","Base aggro range",cfg.aggroTriggerRange??0,1,0)}${devCombatField("alertRange","Base alert range",cfg.alertRange??0,1,0)}${devCombatField("chaseSpeed","Chase speed",cfg.chaseSpeed??0,1,0)}</div><label class="devCombatCheck" style="margin-top:9px"><input type="checkbox" data-combat-field="aggressive" ${cfg.aggressive?"checked":""}> Aggressive / auto-aggro</label>${developerMobPreview()}<div class="devCombatActions"><button id="devApplySpecies" class="primary">Apply ${mobTypeScaleLabel(devCombatMobType)} Stats</button><button id="devRerollSpecies">Reroll Levels + Elites</button></div>`;
  species.querySelectorAll("[data-combat-mob]").forEach(b=>b.onclick=()=>{devCombatMobType=b.dataset.combatMob;devSelectedMob=mobs.find(m=>mobTypeScaleKey(m)===devCombatMobType)||devSelectedMob;refreshDeveloperCombatPanel();});
  species.querySelector("#devApplySpecies").onclick=applyDeveloperSpeciesBalance;
  species.querySelector("#devRerollSpecies").onclick=()=>{applyDeveloperSpeciesBalance();rerollMobLevelsAndElites(devCombatMobType);refreshDeveloperCombatPanel();devSetStatus(`${mobTypeScaleLabel(devCombatMobType)} levels and elite rolls refreshed`);};

  const g=BALANCE.mobLevels||{};
  globals.innerHTML=`
  <details class="devCombatDetails" open><summary>Normal Level Scaling</summary><div class="devCombatGrid">${devGlobalField("hpGrowthPerLevelPercent","HP growth / level %",g.hpGrowthPerLevelPercent??14,.5)}${devGlobalField("attackGrowthPerLevelPercent","Damage growth / level %",g.attackGrowthPerLevelPercent??10,.5)}${devGlobalField("armorPerLevel","Armor / level",g.armorPerLevel??.55,.05)}</div></details>
  <details class="devCombatDetails" open><summary>High-Level Danger Boost</summary><div class="devCombatGrid">${devGlobalField("dangerStartsAbovePlayerLevels","Starts above player levels",g.dangerStartsAbovePlayerLevels??3,1,0)}${devGlobalField("dangerHpPerExtraLevelPercent","HP / danger level %",g.dangerHpPerExtraLevelPercent??12,.5)}${devGlobalField("dangerAttackPerExtraLevelPercent","Damage / danger level %",g.dangerAttackPerExtraLevelPercent??9,.5)}${devGlobalField("dangerArmorPerExtraLevel","Armor / danger level",g.dangerArmorPerExtraLevel??.6,.05)}${devGlobalField("dangerXpPerExtraLevelPercent","XP / danger level %",g.dangerXpPerExtraLevelPercent??10,.5)}</div></details>
  <details class="devCombatDetails"><summary>Elite Multipliers</summary><div class="devCombatGrid">${devGlobalField("eliteHpMultiplier","Elite HP ×",g.eliteHpMultiplier??1.65,.05)}${devGlobalField("eliteAttackMultiplier","Elite damage ×",g.eliteAttackMultiplier??1.2,.05)}${devGlobalField("eliteArmorBonus","Elite armor +",g.eliteArmorBonus??2,.1)}${devGlobalField("eliteXpMultiplier","Elite XP ×",g.eliteXpMultiplier??1.6,.05)}${devGlobalField("eliteGoldMultiplier","Elite gold ×",g.eliteGoldMultiplier??1.5,.05)}${devGlobalField("eliteAggroMultiplier","Elite aggro ×",g.eliteAggroMultiplier??1.15,.05)}</div></details>
  <details class="devCombatDetails"><summary>Boss Multipliers</summary><div class="devCombatGrid">${devGlobalField("bossHpMultiplier","Boss HP ×",g.bossHpMultiplier??1.5,.05)}${devGlobalField("bossAttackMultiplier","Boss damage ×",g.bossAttackMultiplier??1.25,.05)}${devGlobalField("bossArmorMultiplier","Boss armor ×",g.bossArmorMultiplier??1.25,.05)}${devGlobalField("bossXpMultiplier","Boss XP ×",g.bossXpMultiplier??1.75,.05)}${devGlobalField("bossAggroMultiplier","Boss aggro ×",g.bossAggroMultiplier??1.25,.05)}</div></details>
  <details class="devCombatDetails"><summary>Level-Based Aggro</summary><div class="devCombatGrid">${devGlobalField("aggroRangePerLevelDifference","Aggro / level diff",g.aggroRangePerLevelDifference??7,1)}${devGlobalField("alertRangePerLevelDifference","Alert / level diff",g.alertRangePerLevelDifference??9,1)}${devGlobalField("minimumAggroTriggerRange","Minimum aggro",g.minimumAggroTriggerRange??20,1,0)}${devGlobalField("minimumAlertRange","Minimum alert",g.minimumAlertRange??34,1,0)}</div></details>
  <details class="devCombatDetails"><summary>Hit / Miss</summary><div class="devCombatGrid">${devGlobalField("playerBaseHitChancePercent","Player base hit %",g.playerBaseHitChancePercent??96,.5,0,100)}${devGlobalField("enemyBaseHitChancePercent","Mob base hit %",g.enemyBaseHitChancePercent??92,.5,0,100)}${devGlobalField("playerHitChancePerLevelAdvantagePercent","Player hit / level %",g.playerHitChancePerLevelAdvantagePercent??4,.5)}${devGlobalField("enemyHitChancePerLevelAdvantagePercent","Mob hit / level %",g.enemyHitChancePerLevelAdvantagePercent??3,.5)}${devGlobalField("minimumHitChancePercent","Minimum hit %",g.minimumHitChancePercent??55,.5,0,100)}${devGlobalField("maximumHitChancePercent","Maximum hit %",g.maximumHitChancePercent??99,.5,0,100)}${devGlobalField("elitePlayerHitPenaltyPercent","Elite player penalty %",g.elitePlayerHitPenaltyPercent??3,.5)}${devGlobalField("eliteEnemyHitBonusPercent","Elite mob bonus %",g.eliteEnemyHitBonusPercent??3,.5)}${devGlobalField("bossPlayerHitPenaltyPercent","Boss player penalty %",g.bossPlayerHitPenaltyPercent??5,.5)}${devGlobalField("bossEnemyHitBonusPercent","Boss mob bonus %",g.bossEnemyHitBonusPercent??5,.5)}</div></details>
  <details class="devCombatDetails"><summary>XP Rules</summary><div class="devCombatGrid">${devProgressionField("sameLevelMobXpBase","Lv 1 standard mob XP",BALANCE.progression?.sameLevelMobXpBase??50,1,1)}${devProgressionField("sameLevelMobXpPerLevel","Standard mob XP / level +",BALANCE.progression?.sameLevelMobXpPerLevel??5,1,0)}${devGlobalField("trivialXpStartsAboveMobLevels","Level-gap XP floor starts",g.trivialXpStartsAboveMobLevels??5,1,1)}${devGlobalField("lowLevelXpPenaltyPerLevelPercent","Low-level penalty / level %",g.lowLevelXpPenaltyPerLevelPercent??20,.5)}${devGlobalField("higherLevelXpBonusPerLevelPercent","High-level XP bonus / level %",g.higherLevelXpBonusPerLevelPercent??8,.5)}</div><div class="devHint" style="margin-top:8px">A normal same-level hostile follows the level curve (50 XP at Lv 1, +5 per level by default). Species XP multipliers, elite/boss bonuses, and level-gap rules are applied after that.</div></details>
  <div class="devCombatActions"><button id="devApplyGlobals" class="primary">Apply Global Combat Settings</button><button id="devRerollAll">Reroll All Mob Levels + Elites</button><button id="devExportBalance">Export game-balance.js</button><button id="devResetBalance" class="danger">Reset Combat Tuning</button></div>`;
  globals.querySelector("#devApplyGlobals").onclick=applyDeveloperGlobalCombatBalance;
  globals.querySelector("#devRerollAll").onclick=()=>{applyDeveloperGlobalCombatBalance();rerollMobLevelsAndElites();refreshDeveloperCombatPanel();devSetStatus("All mob levels and elite rolls refreshed");};
  globals.querySelector("#devExportBalance").onclick=()=>{applyDeveloperSpeciesBalance();applyDeveloperGlobalCombatBalance();exportDeveloperBalance();};
  globals.querySelector("#devResetBalance").onclick=resetDeveloperCombatBalance;
}


function developerSafeId(value,fallback="id"){
  return String(value||fallback).trim().toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9_-]+/g,"")||fallback;
}

function refreshDeveloperNpcInspectorValues(){
  if(!devPanel||!devSelectedNpc) return;
  const root=devPanel.querySelector("#devNpcInspector");
  if(!root) return;
  const x=root.querySelector("#devNpcX"),y=root.querySelector("#devNpcY");
  if(x)x.value=Math.round(devSelectedNpc.x);
  if(y)y.value=Math.round(devSelectedNpc.y);
}

function updateQuestNpcReferences(oldId,newId){
  if(!oldId||oldId===newId) return;
  for(const quest of questDefinitions){
    if(quest.giverNpc===oldId) quest.giverNpc=newId;
    if(quest.turnInNpc===oldId) quest.turnInNpc=newId;
    for(const objective of quest.objectives) if(objective.type==="talk"&&objective.target===oldId) objective.target=newId;
  }
  if(activeNpcDialogId===oldId) activeNpcDialogId=newId;
}

function saveDeveloperNpc(){
  if(!devPanel||!devSelectedNpc) return;
  const root=devPanel.querySelector("#devNpcInspector");
  if(!root) return;
  const oldId=devSelectedNpc.id;
  let newId=developerSafeId(root.querySelector("#devNpcId")?.value,oldId||"npc");
  if(sceneryNPCs.some(n=>n!==devSelectedNpc&&n.id===newId)){
    devSetStatus(`NPC id '${newId}' is already in use`);return;
  }
  devSelectedNpc.id=newId;
  devSelectedNpc.name=root.querySelector("#devNpcName")?.value.trim()||newId;
  devSelectedNpc.role=root.querySelector("#devNpcRole")?.value.trim()||"Villager";
  devSelectedNpc.sprite=root.querySelector("#devNpcSprite")?.value||NPC_PLACEHOLDER_SPRITE;
  devSelectedNpc.x=numberOr(root.querySelector("#devNpcX")?.value,devSelectedNpc.x);
  devSelectedNpc.y=numberOr(root.querySelector("#devNpcY")?.value,devSelectedNpc.y);
  devSelectedNpc.facing=root.querySelector("#devNpcFacing")?.value||"down";
  devSelectedNpc.displayHeight=Math.max(24,numberOr(root.querySelector("#devNpcHeight")?.value,58));
  devSelectedNpc.interactRadius=Math.max(24,numberOr(root.querySelector("#devNpcRange")?.value,58));
  devSelectedNpc.greeting=root.querySelector("#devNpcGreeting")?.value.trim()||`Hello. I'm ${devSelectedNpc.name}.`;
  devSelectedNpc.solid=!!root.querySelector("#devNpcSolid")?.checked;
  updateQuestNpcReferences(oldId,newId);
  rebuildNpcCollision();
  saveDeveloperDraft();refreshDeveloperPanel();refreshQuestUI();
  devSetStatus(`Saved NPC: ${devSelectedNpc.name}`);
}

function duplicateDeveloperNpc(){
  if(!devSelectedNpc)return;
  const copy=normalizeNpcRecord({...cloneNpc(devSelectedNpc),id:uniqueNpcId(devSelectedNpc.id),name:`${devSelectedNpc.name} Copy`,x:devSelectedNpc.x+devSnap*2,y:devSelectedNpc.y+devSnap*2},sceneryNPCs.length);
  sceneryNPCs.push(copy);devSelectedNpc=copy;rebuildNpcCollision();saveDeveloperDraft();refreshDeveloperPanel();
}

function deleteDeveloperNpc(){
  if(!devSelectedNpc)return;
  const refs=questDefinitions.filter(q=>q.giverNpc===devSelectedNpc.id||q.turnInNpc===devSelectedNpc.id||q.objectives.some(o=>o.type==="talk"&&o.target===devSelectedNpc.id));
  const warning=refs.length?` ${refs.length} quest(s) reference this NPC and will need repair.`:"";
  if(!confirm(`Delete ${devSelectedNpc.name}?${warning}`))return;
  const i=sceneryNPCs.indexOf(devSelectedNpc);if(i>=0)sceneryNPCs.splice(i,1);
  devSelectedNpc=null;rebuildNpcCollision();saveDeveloperDraft();refreshDeveloperPanel();refreshQuestUI();
}

function refreshDeveloperNpcPanel(){
  if(!devPanel)return;
  const list=devPanel.querySelector("#devNpcList");
  const inspector=devPanel.querySelector("#devNpcInspector");
  const count=devPanel.querySelector("#devNpcCount");
  if(count)count.textContent=`${sceneryNPCs.length} placed`;
  if(list){
    list.innerHTML="";
    for(const npc of sceneryNPCs){
      const b=document.createElement("button");b.className="devNpcChip"+(npc===devSelectedNpc?" active":"");b.textContent=`${npc.name} • ${npc.role}`;
      b.onclick=()=>{devSelectedNpc=npc;devSelected=null;devSelectedMob=null;devPlaceType=null;devPlaceNpcTemplate=null;setDeveloperTab("npcs");refreshDeveloperPanel();};list.appendChild(b);
    }
  }
  if(!inspector)return;
  if(!devSelectedNpc){inspector.innerHTML='<div class="devEmpty">Choose an NPC from the list, click one in the world, or place a new model.</div>';return;}
  const spriteChoices=[
    [NPC_PLACEHOLDER_SPRITE,"Placeholder model"],["./assets/npcs/lilly.png","Lilly model"],["./assets/npcs/jorge.png","Jorge model"]
  ];
  if(devSelectedNpc.sprite&&!spriteChoices.some(([v])=>v===devSelectedNpc.sprite))spriteChoices.push([devSelectedNpc.sprite,"Current custom sprite"]);
  inspector.innerHTML=`<div class="devNpcInspector">
    <div class="devSelectedTitle">${questEscape(devSelectedNpc.name)}</div>
    <div class="devPair"><label>ID<input id="devNpcId" value="${questEscape(devSelectedNpc.id)}"></label><label>Name<input id="devNpcName" value="${questEscape(devSelectedNpc.name)}"></label></div>
    <div class="devPair"><label>Role<input id="devNpcRole" value="${questEscape(devSelectedNpc.role||"Villager")}"></label><label>Sprite<select id="devNpcSprite">${spriteChoices.map(([v,l])=>`<option value="${questEscape(v)}" ${v===devSelectedNpc.sprite?"selected":""}>${questEscape(l)}</option>`).join("")}</select></label></div>
    <div class="devPair"><label>X<input id="devNpcX" type="number" value="${Math.round(devSelectedNpc.x)}"></label><label>Y<input id="devNpcY" type="number" value="${Math.round(devSelectedNpc.y)}"></label></div>
    <div class="devPair"><label>Facing<select id="devNpcFacing">${["down","left","right","up"].map(v=>`<option ${v===devSelectedNpc.facing?"selected":""}>${v}</option>`).join("")}</select></label><label>Sprite Height<input id="devNpcHeight" type="number" min="24" value="${numberOr(devSelectedNpc.displayHeight,58)}"></label></div>
    <label>Talk Radius<input id="devNpcRange" type="number" min="24" value="${numberOr(devSelectedNpc.interactRadius,58)}"></label>
    <label>Greeting<textarea id="devNpcGreeting">${questEscape(devSelectedNpc.greeting||"")}</textarea></label>
    <label style="flex-direction:row;align-items:center"><input id="devNpcSolid" type="checkbox" ${devSelectedNpc.solid!==false?"checked":""}> Solid collision</label>
    <div class="devRow"><button id="devNpcSave">Save NPC</button><button id="devNpcDuplicate">Duplicate</button><button id="devNpcDelete" class="danger">Delete</button></div>
  </div>`;
  inspector.querySelector("#devNpcSave").onclick=saveDeveloperNpc;
  inspector.querySelector("#devNpcDuplicate").onclick=duplicateDeveloperNpc;
  inspector.querySelector("#devNpcDelete").onclick=deleteDeveloperNpc;
  const heightInput=inspector.querySelector("#devNpcHeight");
  heightInput.oninput=e=>{
    devSelectedNpc.displayHeight=Math.max(24,numberOr(e.target.value,devSelectedNpc.displayHeight));
    rebuildNpcCollision();
    refreshDeveloperInspectorValues();
  };
  heightInput.onchange=()=>saveDeveloperDraft();
  inspector.querySelector("#devNpcSprite").onchange=e=>{devSelectedNpc.sprite=e.target.value||NPC_PLACEHOLDER_SPRITE;saveDeveloperDraft();};
  inspector.querySelector("#devNpcFacing").onchange=e=>{devSelectedNpc.facing=e.target.value||"down";saveDeveloperDraft();};
}

function devQuestOptions(values,selected){
  return values.map(([value,label])=>`<option value="${questEscape(value)}" ${value===selected?"selected":""}>${questEscape(label)}</option>`).join("");
}
function developerObjectiveDefault(type="talk"){
  if(type==="kill")return normalizeQuestObjective({type,target:enemyTemplates[0]?.configKey||"slime",amount:1});
  if(type==="collect"||type==="deliver")return normalizeQuestObjective({type,target:Object.keys(ITEM_DEFS)[0]||"",amount:1,consumeOnTurnIn:true});
  if(type==="visit")return normalizeQuestObjective({type,x:Math.round(state?.x||START_X),y:Math.round(state?.y||START_Y),radius:36,amount:1});
  return normalizeQuestObjective({type:"talk",target:sceneryNPCs[0]?.id||"",amount:1});
}
function developerNewQuest(){
  const giver=devSelectedNpc?.id||sceneryNPCs[0]?.id||"";
  const root=uniqueQuestId("new_quest");
  return normalizeQuestDefinition({id:root,title:"New Quest",description:"Describe what the player should do.",giverNpc:giver,turnInNpc:giver,openingDialogue:"Could you help me?",completionDialogue:"Thank you for your help.",level:1,levelRequirementMode:"auto",rewardTier:"minor",objectives:[developerObjectiveDefault("talk")],rewards:{xpMode:"auto",xp:0,gold:0,items:[]}},questDefinitions.length);
}
function uniqueQuestId(base="quest"){
  const root=String(base||"quest").toLowerCase().replace(/[^a-z0-9_-]+/g,"_")||"quest";let id=root,n=2;
  while(questDefinitions.some(q=>q.id===id))id=`${root}_${n++}`;return id;
}
function developerQuestTargetOptions(type,selected){
  let values=[];
  if(type==="kill") values=[...enemyTemplates,bossTemplate].map(t=>[t.configKey||t.kind,t.name]);
  else if(type==="collect"||type==="deliver") values=Object.keys(ITEM_DEFS).map(id=>[id,getItemDefinition(id).name]);
  else if(type==="talk") values=sceneryNPCs.map(n=>[n.id,n.name]);
  if(selected&&!values.some(([v])=>v===selected)) values.push([selected,selected]);
  return values;
}
function readDeveloperQuestForm(){
  const root=devPanel?.querySelector("#devQuestEditor");
  const fallback=devQuestFormDraft||getQuestDefinition(devSelectedQuestId)||developerNewQuest();
  if(!root)return cloneQuest(fallback);
  const objectives=[...root.querySelectorAll("[data-objective-index]")].map(row=>{
    const type=row.querySelector("[data-obj-type]")?.value||"talk";
    const amount=Math.max(1,Math.floor(numberOr(row.querySelector("[data-obj-amount]")?.value,1)));
    if(type==="visit")return normalizeQuestObjective({type,amount:1,x:row.querySelector("[data-obj-x]")?.value,y:row.querySelector("[data-obj-y]")?.value,radius:row.querySelector("[data-obj-radius]")?.value});
    return normalizeQuestObjective({type,target:row.querySelector("[data-obj-target]")?.value||"",amount,consumeOnTurnIn:row.querySelector("[data-obj-consume]")?.checked!==false});
  });
  const rewardItem=root.querySelector("#devQuestRewardItem")?.value||"";
  return normalizeQuestDefinition({
    id:root.querySelector("#devQuestId")?.value||fallback.id,
    title:root.querySelector("#devQuestTitle")?.value||fallback.title,
    description:root.querySelector("#devQuestDescription")?.value||"",
    giverNpc:root.querySelector("#devQuestGiver")?.value||"",
    turnInNpc:root.querySelector("#devQuestTurnIn")?.value||"",
    openingDialogue:root.querySelector("#devQuestOpening")?.value||"",
    completionDialogue:root.querySelector("#devQuestCompletion")?.value||"",
    level:root.querySelector("#devQuestLevel")?.value||fallback.level||1,
    levelRequirementMode:root.querySelector("#devQuestLevelRequirementMode")?.value||fallback.levelRequirementMode||"auto",
    minLevel:root.querySelector("#devQuestMinLevel")?.value||fallback.minLevel||1,
    rewardTier:root.querySelector("#devQuestRewardTier")?.value||fallback.rewardTier||"standard",
    objectives:objectives.length?objectives:[developerObjectiveDefault("talk")],
    rewards:{xpMode:root.querySelector("#devQuestXpMode")?.value||fallback.rewards?.xpMode||"custom",xp:root.querySelector("#devQuestRewardXp")?.value,gold:root.querySelector("#devQuestRewardGold")?.value,items:rewardItem?[{id:rewardItem,qty:root.querySelector("#devQuestRewardQty")?.value||1}]:[]},
    prerequisite:root.querySelector("#devQuestPrereq")?.value||null,
    nextQuest:root.querySelector("#devQuestNext")?.value||null,
    repeatable:!!root.querySelector("#devQuestRepeatable")?.checked
  });
}
function renderDeveloperQuestEditor(draft){
  const root=devPanel?.querySelector("#devQuestEditor");if(!root)return;
  draft=normalizeQuestDefinition(draft,questDefinitions.findIndex(q=>q.id===draft?.id));
  devQuestFormDraft=cloneQuest(draft);
  const npcOptions=sceneryNPCs.map(n=>[n.id,n.name]);
  const questOptions=[["","None"],...questDefinitions.filter(q=>q.id!==draft.id).map(q=>[q.id,q.title])];
  const itemOptions=[["","No item reward"],...Object.keys(ITEM_DEFS).map(id=>[id,getItemDefinition(id).name])];
  const rewardTierOptions=Object.entries(QUEST_XP_PROFILE_LABELS).map(([id,label])=>[id,label]);
  const rewardItem=draft.rewards.items?.[0]?.id||"",rewardQty=draft.rewards.items?.[0]?.qty||1;
  const xpProfile=questXpProfile(draft.rewardTier,draft.repeatable&&draft.rewards.xpMode==="auto");
  const xpProfileLabel=QUEST_XP_PROFILE_LABELS[xpProfile.tier]||xpProfile.tier;
  const autoXp=draft.rewards.xpMode==="auto";
  const autoMin=draft.levelRequirementMode!=="custom";
  root.innerHTML=`<div class="devQuestEditor">
    <div class="devPair"><label>Quest ID<input id="devQuestId" value="${questEscape(draft.id)}"></label><label>Quest Name<input id="devQuestTitle" value="${questEscape(draft.title)}"></label></div>
    <label>Description<textarea id="devQuestDescription">${questEscape(draft.description)}</textarea></label>
    <div class="devSubhead">Level & Availability</div>
    <div class="devQuad"><label>Quest Level<input id="devQuestLevel" type="number" min="1" max="${playerLevelCap()}" value="${draft.level}"></label><label>Minimum Level<select id="devQuestLevelRequirementMode">${devQuestOptions([["auto","Automatic (-3 levels)"],["custom","Custom"]],draft.levelRequirementMode)}</select></label><label>Requires Level<input id="devQuestMinLevel" type="number" min="1" max="${draft.level}" value="${draft.minLevel}" ${autoMin?"readonly":""}></label><label>Recommended Through<input type="number" value="${draft.recommendedMaxLevel}" readonly></label></div>
    <div class="devHint">Quest Lv ${draft.level} becomes available at Lv ${draft.minLevel}. Recommended range: Lv ${draft.minLevel}–${draft.recommendedMaxLevel}. There is no maximum acceptance level, so players can always come back later.</div>
    <div class="devPair"><label>Quest Giver<select id="devQuestGiver">${devQuestOptions(npcOptions,draft.giverNpc)}</select></label><label>Turn-In NPC<select id="devQuestTurnIn">${devQuestOptions(npcOptions,draft.turnInNpc)}</select></label></div>
    <label>Opening Dialogue<textarea id="devQuestOpening">${questEscape(draft.openingDialogue)}</textarea></label>
    <label>Completion Dialogue<textarea id="devQuestCompletion">${questEscape(draft.completionDialogue)}</textarea></label>
    <div class="devSubhead">Objectives</div><div id="devQuestObjectives">${draft.objectives.map((objective,index)=>{
      const types=[["kill","Kill"],["collect","Collect"],["talk","Talk"],["deliver","Deliver"],["visit","Visit"]];
      const visit=objective.type==="visit";
      return `<div class="devQuestObjective" data-objective-index="${index}"><div class="devQuestObjectiveTop"><label>Type<select data-obj-type>${devQuestOptions(types,objective.type)}</select></label>${visit?`<label>Location<span style="padding:9px 0;color:#b9aebe">World coordinates</span></label>`:`<label>Target<select data-obj-target>${devQuestOptions(developerQuestTargetOptions(objective.type,objective.target),objective.target)}</select></label>`}<label>Amount<input data-obj-amount type="number" min="1" value="${objective.amount}" ${visit?"disabled":""}></label><button data-remove-objective="${index}" title="Remove objective">×</button></div>${visit?`<div class="devVisitGrid"><label>X<input data-obj-x type="number" value="${Math.round(objective.x)}"></label><label>Y<input data-obj-y type="number" value="${Math.round(objective.y)}"></label><label>Radius<input data-obj-radius type="number" min="8" value="${Math.round(objective.radius)}"></label></div><button data-use-player-pos="${index}" style="margin-top:6px;border:1px solid rgba(255,255,255,.12);background:#4b4056;color:#fff;border-radius:7px;padding:6px 8px">Use Player Position</button>`:(objective.type==="collect"||objective.type==="deliver")?`<label style="flex-direction:row;align-items:center"><input data-obj-consume type="checkbox" ${objective.consumeOnTurnIn!==false?"checked":""}> Consume items on turn-in</label>`:""}</div>`;
    }).join("")}</div>
    <button id="devAddQuestObjective" class="devHitboxEditButton">+ Add Objective</button>
    <div class="devSubhead">Rewards</div>
    <div class="devPair"><label>XP Mode<select id="devQuestXpMode">${devQuestOptions([["auto","Automatic"],["custom","Custom"]],draft.rewards.xpMode)}</select></label><label>XP Profile<select id="devQuestRewardTier" ${draft.repeatable&&autoXp?"disabled":""}>${devQuestOptions(rewardTierOptions,xpProfile.tier)}</select></label></div>
    <div class="devHint">${autoXp?`Auto XP: <b>${draft.rewards.xp} XP</b> • ${questEscape(xpProfileLabel)} • ${xpProfile.mobEquivalent} same-level mob equivalents • capped at ${xpProfile.levelCapPercent}% of this level.${draft.repeatable?" Repeatable quests automatically use the Repeatable profile.":""}`:"Custom XP ignores the automatic quest-level formula."}</div>
    <div class="devQuad"><label>XP<input id="devQuestRewardXp" type="number" min="0" value="${draft.rewards.xp}" ${autoXp?"readonly":""}></label><label>Gold<input id="devQuestRewardGold" type="number" min="0" value="${draft.rewards.gold}"></label><label>Item<select id="devQuestRewardItem">${devQuestOptions(itemOptions,rewardItem)}</select></label><label>Qty<input id="devQuestRewardQty" type="number" min="1" value="${rewardQty}"></label></div>
    <div class="devPair"><label>Prerequisite<select id="devQuestPrereq">${devQuestOptions(questOptions,draft.prerequisite||"")}</select></label><label>Next Quest<select id="devQuestNext">${devQuestOptions(questOptions,draft.nextQuest||"")}</select></label></div>
    <label style="flex-direction:row;align-items:center"><input id="devQuestRepeatable" type="checkbox" ${draft.repeatable?"checked":""}> Repeatable quest</label>
    <div class="devRow"><button id="devQuestSave">Save Quest</button><button id="devQuestTest">Reset Test Progress</button></div>
  </div>`;
  root.querySelectorAll("[data-obj-type]").forEach((select,index)=>select.onchange=()=>{
    const next=readDeveloperQuestForm();const type=select.value;next.objectives[index]=developerObjectiveDefault(type);
    if(next.rewards.xpMode==="auto"&&!next.repeatable) next.rewardTier=inferQuestRewardTier(next.objectives,false);
    devQuestFormDraft=next;renderDeveloperQuestEditor(next);
  });
  root.querySelectorAll("[data-remove-objective]").forEach(button=>button.onclick=()=>{const next=readDeveloperQuestForm();next.objectives.splice(Number(button.dataset.removeObjective),1);if(!next.objectives.length)next.objectives.push(developerObjectiveDefault("talk"));if(next.rewards.xpMode==="auto"&&!next.repeatable)next.rewardTier=inferQuestRewardTier(next.objectives,false);renderDeveloperQuestEditor(next);});
  root.querySelectorAll("[data-use-player-pos]").forEach(button=>button.onclick=()=>{const next=readDeveloperQuestForm();const objective=next.objectives[Number(button.dataset.usePlayerPos)];objective.x=Math.round(state.x);objective.y=Math.round(state.y);renderDeveloperQuestEditor(next);});
  root.querySelector("#devAddQuestObjective").onclick=()=>{const next=readDeveloperQuestForm();next.objectives.push(developerObjectiveDefault("kill"));if(next.rewards.xpMode==="auto"&&!next.repeatable)next.rewardTier="multi";renderDeveloperQuestEditor(next);};
  ["devQuestLevel","devQuestLevelRequirementMode","devQuestMinLevel","devQuestXpMode","devQuestRewardTier","devQuestRepeatable"].forEach(id=>{const input=root.querySelector(`#${id}`);if(input)input.onchange=()=>renderDeveloperQuestEditor(readDeveloperQuestForm());});
  root.querySelector("#devQuestSave").onclick=saveDeveloperQuest;
  root.querySelector("#devQuestTest").onclick=()=>{const id=readDeveloperQuestForm().id;delete ensureQuestState()[id];refreshQuestUI();renderNpcDialogue();devSetStatus(`Reset test progress for ${id}`);};
}
function saveDeveloperQuest(){
  const oldId=devSelectedQuestId;const next=readDeveloperQuestForm();
  let newId=String(next.id||oldId||"quest").trim().toLowerCase().replace(/[^a-z0-9_-]+/g,"_");
  if(!newId)newId="quest";
  if(questDefinitions.some(q=>q.id===newId&&q.id!==oldId)){devSetStatus(`Quest id '${newId}' is already in use`);return;}
  next.id=newId;
  const i=questDefinitions.findIndex(q=>q.id===oldId);if(i>=0)questDefinitions[i]=normalizeQuestDefinition(next,i);else questDefinitions.push(normalizeQuestDefinition(next,questDefinitions.length));
  if(oldId&&oldId!==newId){
    for(const quest of questDefinitions){if(quest.prerequisite===oldId)quest.prerequisite=newId;if(quest.nextQuest===oldId)quest.nextQuest=newId;}
    const qs=ensureQuestState();if(qs[oldId]){qs[newId]=qs[oldId];delete qs[oldId];}
  }
  devSelectedQuestId=newId;devQuestFormDraft=cloneQuest(getQuestDefinition(newId));saveDeveloperDraft();refreshDeveloperQuestPanel();refreshQuestUI();devSetStatus(`Saved quest: ${next.title}`);
}
function refreshDeveloperQuestPanel(){
  if(!devPanel)return;
  const list=devPanel.querySelector("#devQuestList"),editor=devPanel.querySelector("#devQuestEditor"),count=devPanel.querySelector("#devQuestCount");
  if(count)count.textContent=`${questDefinitions.length} quest${questDefinitions.length===1?"":"s"}`;
  if(!devSelectedQuestId||!getQuestDefinition(devSelectedQuestId))devSelectedQuestId=questDefinitions[0]?.id||null;
  if(list){list.innerHTML="";for(const quest of questDefinitions){const b=document.createElement("button");b.className="devQuestChip"+(quest.id===devSelectedQuestId?" active":"");b.textContent=`Lv ${quest.level} • ${quest.title}`;b.title=`${quest.id} • requires Lv ${quest.minLevel}`;b.onclick=()=>{devSelectedQuestId=quest.id;devQuestFormDraft=cloneQuest(quest);refreshDeveloperQuestPanel();};list.appendChild(b);}}
  if(!editor)return;
  if(!devSelectedQuestId){editor.innerHTML='<div class="devEmpty">No quests yet. Click New Quest to create one.</div>';return;}
  const selected=getQuestDefinition(devSelectedQuestId);if(!devQuestFormDraft||devQuestFormDraft.id!==selected.id)devQuestFormDraft=cloneQuest(selected);renderDeveloperQuestEditor(devQuestFormDraft);
}
function createDeveloperQuest(){
  const quest=developerNewQuest();questDefinitions.push(quest);devSelectedQuestId=quest.id;devQuestFormDraft=cloneQuest(quest);setDeveloperTab("quests");saveDeveloperDraft();refreshDeveloperPanel();
}
function duplicateDeveloperQuest(){
  const source=getQuestDefinition(devSelectedQuestId);if(!source)return;const copy=cloneQuest(source);copy.id=uniqueQuestId(`${source.id}_copy`);copy.title=`${source.title} Copy`;questDefinitions.push(normalizeQuestDefinition(copy,questDefinitions.length));devSelectedQuestId=copy.id;devQuestFormDraft=cloneQuest(copy);saveDeveloperDraft();refreshDeveloperQuestPanel();
}
function deleteDeveloperQuest(){
  const quest=getQuestDefinition(devSelectedQuestId);if(!quest)return;if(!confirm(`Delete quest '${quest.title}'?`))return;
  questDefinitions=questDefinitions.filter(q=>q.id!==quest.id);for(const other of questDefinitions){if(other.prerequisite===quest.id)other.prerequisite=null;if(other.nextQuest===quest.id)other.nextQuest=null;}delete ensureQuestState()[quest.id];devSelectedQuestId=questDefinitions[0]?.id||null;devQuestFormDraft=null;saveDeveloperDraft();refreshDeveloperQuestPanel();refreshQuestUI();
}
function refreshDeveloperProjectPanel(){
  if(!devPanel)return;const el=devPanel.querySelector("#devProjectSummary");if(el)el.textContent=`${sceneryProps.length} props • ${sceneryNPCs.length} NPCs • ${questDefinitions.length} quests • one uploadable World Pack`;
}

function buildDeveloperPanel(){
  ensureDeveloperStyles();
  const root=document.createElement("aside");
  root.id="devPanel";
  root.innerHTML=`
    <div class="devHeader"><div><b>WORLD BUILDER</b><span>F2 to close • props, NPCs, quests, scale, and testing</span></div><button id="devClose">×</button></div>
    <div class="devToolbar">
      <button id="devSelect" class="active">Select / Move</button>
      <label>Snap <select id="devSnap"><option>4</option><option selected>8</option><option>16</option><option>32</option><option>64</option></select></label>
      <label><input id="devGrid" type="checkbox" checked> Grid</label>
      <label><input id="devHitboxes" type="checkbox" checked> Hitboxes</label>
      <label><input id="devDepthLines" type="checkbox" checked> Depth Lines</label>
    </div>
    <div class="devTabs">
      <button class="devTab active" data-dev-tab="objects">Objects</button>
      <button class="devTab" data-dev-tab="npcs">NPCs</button>
      <button class="devTab" data-dev-tab="quests">Quests</button>
      <button class="devTab" data-dev-tab="selection">Selection</button>
      <button class="devTab" data-dev-tab="scale">Visual Scale</button>
      <button class="devTab" data-dev-tab="combat">Combat Test</button>
      <button class="devTab" data-dev-tab="project">Project</button>
    </div>
    <div class="devBody">
      <section class="devView active" data-dev-view="objects">
        <div class="devSection"><div class="devSectionTitle">Prop Palette</div><div class="devHint">Choose a prop, then click the world to place it. Switch back to Select / Move when finished.</div><div id="devPalette"></div></div>
        <div class="devSection"><div class="devSectionTitle">Existing Objects <span id="devObjectCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><div id="devObjectList"></div></div>
      </section>
      <section class="devView" data-dev-view="npcs">
        <div class="devSection"><div class="devSectionTitle">NPC Models</div><div class="devHint">Choose a model, then click the world to place an NPC. Click or drag existing NPCs directly in the world.</div><div class="devNpcPalette"><button data-npc-template="lilly">+ Lilly Model</button><button data-npc-template="jorge">+ Jorge Model</button><button data-npc-template="blank">+ Placeholder Model</button></div></div>
        <div class="devSection"><div class="devSectionTitle">Existing NPCs <span id="devNpcCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><div id="devNpcList"></div></div>
        <div class="devSection"><div class="devSectionTitle">NPC Inspector</div><div id="devNpcInspector"></div></div>
      </section>
      <section class="devView" data-dev-view="quests">
        <div class="devSection"><div class="devSectionTitle">Quest Library <span id="devQuestCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><div class="devHint">Create quests from dropdowns instead of code. Objectives can kill, collect, talk, deliver, or visit a world position.</div><div id="devQuestList"></div><div class="devQuestListActions"><button id="devNewQuest">New Quest</button><button id="devDuplicateQuest">Duplicate</button><button id="devDeleteQuest">Delete</button></div></div>
        <div class="devSection"><div class="devSectionTitle">Quest Maker</div><div id="devQuestEditor"></div></div>
      </section>
      <section class="devView" data-dev-view="selection">
        <div class="devSection"><div class="devSectionTitle">Selection Library <span id="devSelectionCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><div class="devHint">Props, NPCs, and loot-remnant previews live together here for visual placement work. Select Dust or Lootable Dust to tune the global remnant scale and depth.</div><div id="devSelectionList"></div></div>
        <div class="devSection"><div class="devSectionTitle">Selected Item</div><div class="devHint">Click a prop or NPC in the world, or choose one above. Drag it directly in the world to reposition it.</div><div id="devInspector"></div></div>
        <div class="devSection"><div class="devSectionTitle">Layout File</div><div class="devProjectActions"><button id="devExport">Export world-objects.js</button><button id="devLoadDraft">Load Local Draft</button><button id="devReset">Use Project Layout</button></div></div>
      </section>
      <section class="devView" data-dev-view="scale">
        <div class="devSection"><div class="devSectionTitle">Selected Mob Type</div><div class="devHint">Click a mob in the world. This slider changes only that mob type — for example, selecting a Wolf changes Wolves without changing Goblins or Slimes.</div><div id="devMobScalePanel"></div></div>
        <div class="devSection"><div class="devSectionTitle">World Visual Scale</div><div class="devHint">These controls change broad world elements. Mob species are controlled separately above.</div><div id="devScalePanel">
          <div class="devScaleControl"><div class="devScaleTop"><span>Player</span><span data-scale-value="player"></span></div><input data-scale-key="player" type="range" min="0.25" max="3.00" step="0.05" value="${VISUAL_SCALE.player}"></div>
          <div class="devScaleControl"><div class="devScaleTop"><span>Houses</span><span data-scale-value="houses"></span></div><input data-scale-key="houses" type="range" min="0.25" max="3.00" step="0.05" value="${VISUAL_SCALE.houses}"></div>
          <div class="devScaleControl"><div class="devScaleTop"><span>NPCs</span><span data-scale-value="npcs"></span></div><input data-scale-key="npcs" type="range" min="0.25" max="3.00" step="0.05" value="${VISUAL_SCALE.npcs}"></div>
          <div class="devScaleControl"><div class="devScaleTop"><span>Props</span><span data-scale-value="props"></span></div><input data-scale-key="props" type="range" min="0.25" max="3.00" step="0.05" value="${VISUAL_SCALE.props}"></div>
        </div><div class="devRow"><button id="devExportScale">Export visual-settings.js</button><button id="devResetScale">Reset Scale Settings</button></div></div>
      </section>
      <section class="devView" data-dev-view="combat">
        <div class="devSection"><div class="devSectionTitle">Player Test Level</div><div id="devPlayerTestPanel"></div></div>
        <div class="devSection"><div class="devSectionTitle">Mob Species Tuning</div><div class="devHint">Change a species' level range and base combat values, apply them live, then reroll its current spawns if you want new levels/elites immediately.</div><div id="devCombatSpecies"></div></div>
        <div class="devSection"><div class="devSectionTitle">Global Mob-Level Rules</div><div class="devHint">These values control level growth, danger boosts, elites, bosses, aggro, hit chance, and XP across the whole game.</div><div id="devCombatGlobals"></div></div>
      </section>
      <section class="devView" data-dev-view="project">
        <div class="devSection"><div class="devSectionTitle">World Pack</div><div class="devProjectNote">This is the new recommended workflow. Make many prop, NPC, quest, visual, and combat changes in World Builder, then export one <b>little-realm-world-pack.json</b>. Upload that single file when you want the project source updated.</div><div id="devProjectSummary" class="devHint" style="margin-top:9px"></div><div class="devProjectBig"><button id="devExportWorldPack" class="primary">Export World Pack (.json)</button><button id="devImportWorldPack">Import World Pack</button><button id="devSaveDraftNow">Save Local Draft</button><button id="devLoadDraftProject">Load Local Draft</button><button id="devResetProject" class="danger">Use Deployed Project</button></div><input id="devImportWorldPackFile" type="file" accept="application/json,.json" hidden></div>
        <div class="devSection"><div class="devSectionTitle">Individual Config Exports</div><div class="devHint">Useful when only one content file changed.</div><div class="devProjectBig"><button id="devExportObjectsOnly">world-objects.js</button><button id="devExportNpcsOnly">npcs.js</button><button id="devExportQuestsOnly">quests.js</button><button id="devExportScaleProject">visual-settings.js</button><button id="devExportBalanceProject">game-balance.js</button></div></div>
      </section>
    </div>
    <div id="devStatus">F2 toggles World Builder</div>`;
  document.body.appendChild(root);
  devPanel=root;
  root.querySelector("#devClose").onclick=()=>setDeveloperMode(false);
  root.querySelector("#devSelect").onclick=()=>{
    devPlaceType=null;devPlaceNpcTemplate=null;
    if(devHitboxEditing) setDeveloperHitboxEditing(false);
    else if(devDepthEditing) setDeveloperDepthEditing(false);
    else{ updateDevPaletteActive();devSetStatus("Select / Move mode"); }
  };
  root.querySelector("#devSnap").onchange=e=>{devSnap=Number(e.target.value)||8;};
  root.querySelector("#devGrid").onchange=e=>{devShowGrid=e.target.checked;};
  root.querySelector("#devHitboxes").onchange=e=>{devShowHitboxes=e.target.checked;};
  root.querySelector("#devDepthLines").onchange=e=>{devShowDepthLines=e.target.checked;};
  root.querySelector("#devExport").onclick=exportDeveloperLayout;
  root.querySelector("#devLoadDraft").onclick=loadDeveloperDraft;
  root.querySelector("#devReset").onclick=resetDeveloperLayout;
  root.querySelector("#devNewQuest").onclick=createDeveloperQuest;
  root.querySelector("#devDuplicateQuest").onclick=duplicateDeveloperQuest;
  root.querySelector("#devDeleteQuest").onclick=deleteDeveloperQuest;
  root.querySelectorAll("[data-npc-template]").forEach(button=>button.onclick=()=>{
    devPlaceNpcTemplate=button.dataset.npcTemplate;devPlaceType=null;devSelected=null;devSelectedNpc=null;devSelectedMob=null;setDeveloperTab("npcs");updateDevPaletteActive();refreshDeveloperPanel();devSetStatus(`Placing ${button.textContent.replace(/^\+\s*/,"")} — click the world`);
  });
  root.querySelector("#devExportWorldPack").onclick=exportDeveloperWorldPack;
  root.querySelector("#devImportWorldPack").onclick=()=>root.querySelector("#devImportWorldPackFile").click();
  root.querySelector("#devImportWorldPackFile").onchange=e=>{importDeveloperWorldPackFile(e.target.files?.[0]);e.target.value="";};
  root.querySelector("#devSaveDraftNow").onclick=saveDeveloperDraft;
  root.querySelector("#devLoadDraftProject").onclick=loadDeveloperDraft;
  root.querySelector("#devResetProject").onclick=resetDeveloperProject;
  root.querySelector("#devExportObjectsOnly").onclick=exportDeveloperLayout;
  root.querySelector("#devExportNpcsOnly").onclick=exportDeveloperNpcs;
  root.querySelector("#devExportQuestsOnly").onclick=exportDeveloperQuests;
  root.querySelector("#devExportScaleProject").onclick=exportVisualSettings;
  root.querySelector("#devExportBalanceProject").onclick=exportDeveloperBalance;
  root.querySelectorAll(".devTab").forEach(b=>b.onclick=()=>setDeveloperTab(b.dataset.devTab));
  root.querySelectorAll("[data-scale-key]").forEach(input=>{
    updateVisualScaleControl(input.dataset.scaleKey,input.value);
    input.oninput=()=>updateVisualScaleControl(input.dataset.scaleKey,input.value);
  });
  root.querySelector("#devExportScale").onclick=exportVisualSettings;
  root.querySelector("#devResetScale").onclick=resetVisualScale;
  const palette=root.querySelector("#devPalette");
  const propTypes=[...Object.keys(PROP_SPECS),"caveEntrance"];
  for(const type of propTypes){
    const b=document.createElement("button");b.className="devPropButton";b.dataset.type=type;b.title=type;
    const cv=document.createElement("canvas");cv.width=48;cv.height=48;
    const name=document.createElement("span");name.textContent=type.replace(/([A-Z])/g," $1");
    b.append(cv,name);
    b.onclick=()=>{devPlaceType=type;devPlaceNpcTemplate=null;devSelectedMob=null;devSelectedNpc=null;devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;setDeveloperTab("objects");updateDevPaletteActive();devSetStatus(`Placing ${type} — click the world`);};
    palette.appendChild(b);
    drawPaletteThumb(cv,type);
  }
  if(!propAtlasReady) propAtlas.addEventListener("load",()=>root.querySelectorAll(".devPropButton").forEach(b=>drawPaletteThumb(b.querySelector("canvas"),b.dataset.type)),{once:true});
  setDeveloperTab(devActiveTab);
  refreshDeveloperPanel();
  devSetStatus(`${propTypes.length} prop types • ${sceneryNPCs.length} NPCs • ${questDefinitions.length} quests • World Pack export ready`);
  return root;
}
function updateDevPaletteActive(){
  if(!devPanel)return;
  devPanel.querySelectorAll(".devPropButton").forEach(b=>b.classList.toggle("active",b.dataset.type===devPlaceType));
  devPanel.querySelectorAll("[data-npc-template]").forEach(b=>b.classList.toggle("active",b.dataset.npcTemplate===devPlaceNpcTemplate));
  devPanel.querySelector("#devSelect")?.classList.toggle("active",!devPlaceType&&!devPlaceNpcTemplate);
}

function setDeveloperMode(active){
  devModeActive=!!active;
  if(!devPanel) buildDeveloperPanel();
  devPanel.classList.toggle("show",devModeActive);
  document.body.classList.toggle("devMode",devModeActive);
  input={up:false,down:false,left:false,right:false};
  isHeroMoving=false;
  if(!devModeActive){
    devDragging=false;devNpcDragging=false;
    devPlaceType=null;devPlaceNpcTemplate=null;
    devHitboxEditing=false;
    devHitboxDrag=null;
    devDepthEditing=false;
    devDepthDrag=null;
    if(game?.style) game.style.cursor="";
  }
  updateDevPaletteActive();
  if(devModeActive){
    // Rebuild the live panels now that normal game state is guaranteed to exist.
    refreshDeveloperPanel();
    devSetStatus("World Builder active — edit props, NPCs, quests, and export one World Pack when ready");
  }
}
function toggleDeveloperMode(){setDeveloperMode(!devModeActive);}

function initDeveloperMode(){
  // Headless validator DOMs intentionally omit document.body; the real browser has it.
  if(!document.body || typeof document.createElement!=="function" || !game?.addEventListener) return;
  buildDeveloperPanel();
  game.addEventListener("pointerdown",devPointerDown,true);
  game.addEventListener("pointermove",devPointerMove,true);
  game.addEventListener("pointerup",devPointerUp,true);
  game.addEventListener("pointercancel",devPointerUp,true);
  window.addEventListener("pointermove",devPointerMove,true);
  window.addEventListener("pointerup",devPointerUp,true);
  window.addEventListener("keydown",event=>{
    if(event.code==="F2"){
      event.preventDefault();toggleDeveloperMode();return;
    }
    if(!devModeActive)return;
    if(event.code==="Escape"){
      if(devHitboxEditing){setDeveloperHitboxEditing(false);}
      else if(devDepthEditing){setDeveloperDepthEditing(false);}
      else if(devPlaceType||devPlaceNpcTemplate){devPlaceType=null;devPlaceNpcTemplate=null;updateDevPaletteActive();devSetStatus("Select / Move mode");}
      else if(devSelectedNpc){devSelectedNpc=null;refreshDeveloperPanel();}
      else if(devSelected){devSelected=null;refreshDeveloperPanel();}
      return;
    }
    if((event.code==="Delete"||event.code==="Backspace") && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)){
      if(devSelectedNpc){event.preventDefault();deleteDeveloperNpc();}
      else if(devSelected){event.preventDefault();deleteDeveloperSelection();}
    }
  },true);
}

function fresh(){
  return {
    x:START_X,
    y:START_Y,
    level:1,xp:0,xpNext:xpRequiredForLevel(1),
    hp:numberOr(BALANCE.player?.maxHp,30),maxHp:numberOr(BALANCE.player?.maxHp,30),
    atk:numberOr(BALANCE.player?.attack,5),def:numberOr(BALANCE.player?.defense,1),
    gold:numberOr(BALANCE.player?.startingGold,8),potions:numberOr(BALANCE.player?.startingPotions,2),kills:0,
    slimeKills:0,questComplete:false,bossDefeated:false,
    quests:{},
    inventory:createEmptyInventory()
  };
}

function reset(){
  state=fresh();
  lastSafePos={x:state.x,y:state.y};
  enemy=null;
  currentMob=null;
  defending=false;
  battleLocked=false;
  combatTarget=null;
  selectedTarget=null;
  playerAttackTimer=0;
  enemyAttackTimer=0;
  playerAttackAnim=0;
  enemyAttackAnim=0;
  combatFx=[];
  attackButtonCooldown=0;
  input={up:false,down:false,left:false,right:false};
  spawnMobs();
  clearLootPiles();
  closeAll();
  toast("Click/tap a mob to target it, then press ATTACK.");
  updateUI();
}

function resize(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  game.width=Math.round(innerWidth*dpr);
  game.height=Math.round(innerHeight*dpr);
  game.style.width=innerWidth+"px";
  game.style.height=innerHeight+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

function drawHero(c,x,y,scale=1,moving=false,animT=0,facing="down"){
  c.save();
  c.imageSmoothingEnabled = false;

  const rowMap = { down: 0, left: 1, right: 2, up: 3 };
  const row = rowMap[facing] ?? 0;
  const col = moving ? [0,1,2,3][Math.floor(animT * 8) % 4] : 0;
  const bob = moving ? Math.abs(Math.sin(animT * 8)) * 1.2 : 0;

  c.fillStyle = "rgba(0,0,0,.20)";
  c.beginPath();
  c.ellipse(x, y + 11, 5.5 + (moving ? 0.6 : 0), 2.4, 0, 0, Math.PI * 2);
  c.fill();

  if(playerSheet.naturalWidth && playerSheet.naturalHeight){
    const frameW = Math.floor(playerSheet.naturalWidth / 4);
    const frameH = Math.floor(playerSheet.naturalHeight / 4);
    const sx = col * frameW;
    const sy = row * frameH;
    const dw = frameW * scale;
    const dh = frameH * scale;
    const dx = Math.round(x - dw / 2);
    const dy = Math.round(y - dh + 17 - bob);
    c.drawImage(playerSheet, sx, sy, frameW, frameH, dx, dy, dw, dh);
  } else {
    // Visible fallback so the game loop never fails silently.
    c.fillStyle = "#c8b28a";
    c.fillRect(Math.round(x - 5), Math.round(y - 16), 10, 16);
    c.fillStyle = "#5e4435";
    c.fillRect(Math.round(x - 4), Math.round(y - 20), 8, 5);
  }

  c.restore();
}

function vectorFacing(vx,vy,fallBack="down"){
  if(Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) return fallBack;
  if(Math.abs(vx) > Math.abs(vy)) return vx > 0 ? "right" : "left";
  return vy > 0 ? "down" : "up";
}

function manualInputVector(){
  return {
    dx:(input.right?1:0)-(input.left?1:0),
    dy:(input.down?1:0)-(input.up?1:0)
  };
}

function moveHeroVector(dx,dy,amount){
  if(dx===0&&dy===0) return false;
  const len=Math.max(.001,Math.hypot(dx,dy));
  dx/=len; dy/=len;
  const nx=state.x+dx*amount;
  const ny=state.y+dy*amount;
  let moved=false;
  if(canStand(nx,state.y)){state.x=nx;moved=true}
  if(canStand(state.x,ny)){state.y=ny;moved=true}
  if(moved) lastSafePos={x:state.x,y:state.y};
  return moved;
}

function updateMovement(dt){
  if(isGameplayModalOpen()) {
    isHeroMoving=false;
    return;
  }

  const manual=manualInputVector();
  let dx=manual.dx, dy=manual.dy;
  const hasManual=dx!==0||dy!==0;

  // RuneScape-like behavior: after selecting a target, walk into melee range automatically
  // unless the player is manually steering.
  if(!hasManual && combatTarget && combatTarget.alive){
    const d=dist(state.x,state.y,combatTarget.x,combatTarget.y);
    if(d>ATTACK_RANGE-4 && d<AUTO_CHASE_RANGE){
      dx=combatTarget.x-state.x;
      dy=combatTarget.y-state.y;
    }
  }

  isHeroMoving=(dx!==0||dy!==0);
  if(isHeroMoving){
    if(Math.abs(dx)>Math.abs(dy)) heroFacing=dx>0?"right":"left";
    else heroFacing=dy>0?"down":"up";
    moveHeroVector(dx,dy,HERO_SPEED*dt);
  }else if(combatTarget&&combatTarget.alive){
    heroFacing=vectorFacing(combatTarget.x-state.x,combatTarget.y-state.y,heroFacing);
  }

  townCooldown=Math.max(0,townCooldown-dt);
  castleCooldown=Math.max(0,castleCooldown-dt);
  potionCooldown=Math.max(0,potionCooldown-dt);
  attackButtonCooldown=Math.max(0,attackButtonCooldown-dt);

  updateQuestVisits();

  const t=tileAtWorld(state.x,state.y);
  if(t===4 && townCooldown<=0){townCooldown=2;townEvent()}
  if(t===5 && castleCooldown<=0){castleCooldown=1.5;castleEvent()}
}

function setInput(dir,value){
  input[dir]=value;
}

function bindHold(id,dir){
  const el=document.getElementById(id);

  const begin=(ev)=>{
    ev.preventDefault();
    try{el.setPointerCapture(ev.pointerId)}catch(e){}
    setInput(dir,true);
  };

  const end=(ev)=>{
    ev.preventDefault();
    setInput(dir,false);
  };

  el.addEventListener("pointerdown",begin);
  el.addEventListener("pointerup",end);
  el.addEventListener("pointercancel",end);
  el.addEventListener("lostpointercapture",end);
}

function createMobTemplate(name,kind,configKey,fallback,boss=false){
  const cfg=BALANCE.mobs?.[configKey] || {};
  return {
    name,kind,boss,configKey,
    lootTable:typeof cfg.lootTable==="string"&&cfg.lootTable.trim()?cfg.lootTable.trim():configKey,
    baseLevel:Math.max(1,Math.floor(numberOr(cfg.baseLevel,fallback.baseLevel||1))),
    levelMin:Math.max(1,Math.floor(numberOr(cfg.levelMin,cfg.baseLevel??fallback.baseLevel??1))),
    levelMax:Math.max(1,Math.floor(numberOr(cfg.levelMax,cfg.baseLevel??fallback.baseLevel??1))),
    hp:numberOr(cfg.hp,fallback.hp),
    atk:numberOr(cfg.attack,fallback.atk),
    def:numberOr(cfg.defense,fallback.def),
    xpMultiplier:Math.max(0,numberOr(cfg.xpMultiplier,fallback.xpMultiplier??1)),
    xp:numberOr(cfg.xp,fallback.xp),
    gold:[numberOr(cfg.goldMin,fallback.gold[0]),numberOr(cfg.goldMax,fallback.gold[1])],
    goldDropChance:percentOr(cfg.goldDropChancePercent,100),
    potionDropChance:percentOr(cfg.potionDropChancePercent,0),
    potionDropAmount:Math.max(0,Math.floor(numberOr(cfg.potionDropAmount,1))),
    eliteChance:percentOr(cfg.eliteChancePercent,0),
    attackInterval:numberOr(cfg.attackIntervalSeconds,fallback.attackInterval),
    respawnMin:numberOr(cfg.respawnMinSeconds,18),
    respawnMax:numberOr(cfg.respawnMaxSeconds,28),
    aggressive:booleanOr(cfg.aggressive,fallback.aggressive),
    aggroTriggerRange:numberOr(cfg.aggroTriggerRange,58),
    alertRange:numberOr(cfg.alertRange,82),
    chaseSpeed:numberOr(cfg.chaseSpeed,fallback.chaseSpeed),
    wanderSpeed:numberOr(cfg.wanderSpeed,fallback.wanderSpeed),
    leashDistance:numberOr(cfg.leashDistance,120),
    combatLeashDistance:numberOr(cfg.combatLeashDistance,numberOr(BALANCE.combat?.mobLeashDistance,260)),
    leashSpeed:numberOr(cfg.leashSpeed,34),
    wanderDelayMin:numberOr(cfg.wanderDelayMinSeconds,1.2),
    wanderDelayMax:numberOr(cfg.wanderDelayMaxSeconds,4.0)
  };
}

const enemyTemplates = [
  createMobTemplate("Slime","slime","slime",{baseLevel:2,hp:14,atk:4,def:0,xp:8,gold:[2,5],attackInterval:1.45,aggressive:false,chaseSpeed:45,wanderSpeed:20}),
  createMobTemplate("Goblin","goblin","goblin",{baseLevel:5,hp:22,atk:7,def:2,xp:16,gold:[4,8],attackInterval:1.45,aggressive:true,chaseSpeed:58,wanderSpeed:20}),
  createMobTemplate("Wolf","wolf","wolf",{baseLevel:4,hp:18,atk:6,def:1,xp:13,gold:[3,7],attackInterval:1.33,aggressive:true,chaseSpeed:72,wanderSpeed:30}),
  createMobTemplate("Cow","cow","cow",{baseLevel:2,hp:12,atk:1,def:0,xp:4,gold:[0,0],attackInterval:1.8,aggressive:false,chaseSpeed:28,wanderSpeed:12}),
  createMobTemplate("Pig","pig","pig",{baseLevel:1,hp:8,atk:1,def:0,xp:3,gold:[0,0],attackInterval:1.8,aggressive:false,chaseSpeed:30,wanderSpeed:14}),
  createMobTemplate("Chicken","chicken","chicken",{baseLevel:1,hp:4,atk:1,def:0,xp:2,gold:[0,0],attackInterval:1.7,aggressive:false,chaseSpeed:34,wanderSpeed:18})
];
const bossTemplate = createMobTemplate("Snickers","boss","snickers",{baseLevel:8,hp:70,atk:10,def:3,xp:55,gold:[35,55],attackInterval:1.55,aggressive:true,chaseSpeed:52,wanderSpeed:0},true);

function refreshMobTemplatesFromBalance(){
  const templates=[...enemyTemplates,bossTemplate];
  for(const template of templates){
    const key=template.configKey || (template.boss?"snickers":template.kind);
    const cfg=BALANCE.mobs?.[key] || {};
    template.lootTable=typeof cfg.lootTable==="string"&&cfg.lootTable.trim()?cfg.lootTable.trim():key;
    template.baseLevel=Math.max(1,Math.floor(numberOr(cfg.baseLevel,template.baseLevel||1)));
    template.levelMin=Math.max(1,Math.floor(numberOr(cfg.levelMin,template.levelMin||template.baseLevel)));
    template.levelMax=Math.max(template.levelMin,Math.floor(numberOr(cfg.levelMax,template.levelMax||template.baseLevel)));
    template.hp=Math.max(1,numberOr(cfg.hp,template.hp));
    template.atk=Math.max(0,numberOr(cfg.attack,template.atk));
    template.def=Math.max(0,numberOr(cfg.defense,template.def));
    template.xpMultiplier=Math.max(0,numberOr(cfg.xpMultiplier,template.xpMultiplier??1));
    template.xp=Math.max(1,numberOr(cfg.xp,template.xp));
    template.gold=[numberOr(cfg.goldMin,template.gold?.[0]||0),numberOr(cfg.goldMax,template.gold?.[1]||0)];
    template.goldDropChance=percentOr(cfg.goldDropChancePercent,(template.goldDropChance||0)*100);
    template.potionDropChance=percentOr(cfg.potionDropChancePercent,(template.potionDropChance||0)*100);
    template.potionDropAmount=Math.max(0,Math.floor(numberOr(cfg.potionDropAmount,template.potionDropAmount||0)));
    template.eliteChance=percentOr(cfg.eliteChancePercent,(template.eliteChance||0)*100);
    template.attackInterval=Math.max(.1,numberOr(cfg.attackIntervalSeconds,template.attackInterval));
    template.respawnMin=Math.max(0,numberOr(cfg.respawnMinSeconds,template.respawnMin));
    template.respawnMax=Math.max(template.respawnMin,numberOr(cfg.respawnMaxSeconds,template.respawnMax));
    template.aggressive=booleanOr(cfg.aggressive,template.aggressive);
    template.aggroTriggerRange=Math.max(0,numberOr(cfg.aggroTriggerRange,template.aggroTriggerRange));
    template.alertRange=Math.max(0,numberOr(cfg.alertRange,template.alertRange));
    template.chaseSpeed=Math.max(0,numberOr(cfg.chaseSpeed,template.chaseSpeed));
    template.wanderSpeed=Math.max(0,numberOr(cfg.wanderSpeed,template.wanderSpeed));
    template.leashDistance=Math.max(0,numberOr(cfg.leashDistance,template.leashDistance));
    template.combatLeashDistance=Math.max(0,numberOr(cfg.combatLeashDistance,numberOr(BALANCE.combat?.mobLeashDistance,template.combatLeashDistance)));
    template.leashSpeed=Math.max(0,numberOr(cfg.leashSpeed,template.leashSpeed));
    template.wanderDelayMin=Math.max(0,numberOr(cfg.wanderDelayMinSeconds,template.wanderDelayMin));
    template.wanderDelayMax=Math.max(template.wanderDelayMin,numberOr(cfg.wanderDelayMaxSeconds,template.wanderDelayMax));
  }
  for(const mob of mobs){
    const t=mob.template;
    if(!t) continue;
    mob.level=Math.max(t.levelMin,Math.min(t.levelMax,Math.floor(numberOr(mob.level,t.baseLevel))));
    if(mob.alive) restoreMobStats(mob,false);
  }
}

function rerollMobLevelsAndElites(typeKey=null){
  refreshMobTemplatesFromBalance();
  for(const mob of mobs){
    const key=mob.template?.configKey || (mob.boss?"snickers":mob.kind);
    if(typeKey && key!==typeKey) continue;
    mob.level=mobSpawnLevel(mob.template);
    mob.elite=rollMobElite(mob.template);
    restoreMobStats(mob,true);
    mob.aggro=false;
    mob.returningHome=false; mob.leashStuckTime=0;
  }
  updateCombatHud?.();
}

function mobSpawnLevel(template,tx=0,ty=0){
  const min=Math.min(template.levelMin,template.levelMax);
  const max=Math.max(template.levelMin,template.levelMax);
  if(min===max) return min;
  // Stable per spawn point: the same creature location keeps its level after
  // respawns instead of rerolling whenever the player walks back through.
  const hash=Math.abs(((tx+17)*73856093)^((ty+31)*19349663)^((template.kind.length+7)*83492791));
  return min+(hash%(max-min+1));
}

function mobDangerSteps(level){
  const threshold=Math.max(0,Math.floor(numberOr(BALANCE.mobLevels?.dangerStartsAbovePlayerLevels,3)));
  return Math.max(0,Math.floor(level-state.level-threshold));
}

function mobLevelColor(level,boss=false,elite=false){
  if(boss) return "#ff6b5f";
  if(elite) return "#c58cff";
  const delta=level-state.level;
  if(delta>=4) return "#ff5d55";
  if(delta>=2) return "#ffad4a";
  if(delta<=-5) return "#8f969f";
  if(delta<=-3) return "#71c873";
  return "#f1d56a";
}

function rollMobElite(template){
  if(!template || template.boss || template.eliteChance<=0) return false;
  return Math.random()<template.eliteChance;
}

function mobRankLabel(mob){
  if(!mob) return "";
  if(mob.boss || mob.template?.boss) return "Boss";
  if(mob.elite) return "Elite";
  return "";
}

function mobDisplayName(mob){
  if(!mob) return "Mob";
  const rank=mobRankLabel(mob);
  return `${rank?rank+" ":""}${mob.template?.name||mob.name||"Mob"}`;
}

function mobAggroRanges(mob){
  if(!mob || !mob.template?.aggressive) return {trigger:0,alert:0};
  const cfg=BALANCE.mobLevels||{};
  const delta=(mob.level||1)-state.level;
  const baseTrigger=Math.max(0,numberOr(mob.template.aggroTriggerRange,58));
  const baseAlert=Math.max(baseTrigger,numberOr(mob.template.alertRange,82));
  const minTrigger=Math.max(0,numberOr(cfg.minimumAggroTriggerRange,20));
  const minAlert=Math.max(minTrigger,numberOr(cfg.minimumAlertRange,34));
  let trigger=Math.max(minTrigger,baseTrigger+delta*numberOr(cfg.aggroRangePerLevelDifference,7));
  let alert=Math.max(minAlert,baseAlert+delta*numberOr(cfg.alertRangePerLevelDifference,9));
  let rankMult=1;
  if(mob.boss || mob.template?.boss) rankMult=numberOr(cfg.bossAggroMultiplier,1.25);
  else if(mob.elite) rankMult=numberOr(cfg.eliteAggroMultiplier,1.15);
  trigger*=rankMult;
  alert*=rankMult;
  return {trigger,alert:Math.max(trigger,alert)};
}

function mobScaledStats(template,level,elite=false){
  const cfg=BALANCE.mobLevels||{};
  const mobLevel=Math.max(1,Math.floor(numberOr(level,template.baseLevel||1)));
  const levelDelta=mobLevel-(template.baseLevel||1);
  const hpGrowth=percentOr(cfg.hpGrowthPerLevelPercent,14);
  const atkGrowth=percentOr(cfg.attackGrowthPerLevelPercent,10);
  const armorPerLevel=numberOr(cfg.armorPerLevel,.55);

  let maxHp=Math.max(1,Math.round(template.hp*Math.max(.25,1+levelDelta*hpGrowth)));
  let atk=Math.max(1,Math.round(template.atk*Math.max(.25,1+levelDelta*atkGrowth)));
  let def=Math.max(0,Math.round(template.def+levelDelta*armorPerLevel));
  let xp;
  if(booleanOr(cfg.useLevelBasedXp,true)){
    // Standard hostile mobs follow the same-level XP column from the 1-100
    // leveling curve. Species can scale this with xpMultiplier; elites/bosses
    // then apply their existing rank multipliers below.
    xp=Math.max(1,Math.round(standardMobXpForLevel(mobLevel)*Math.max(0,numberOr(template.xpMultiplier,1))));
  }else{
    const xpGrowth=percentOr(cfg.xpGrowthPerLevelPercent,18);
    xp=Math.max(1,Math.round(template.xp*Math.max(.25,1+levelDelta*xpGrowth)));
  }

  if(elite && !template.boss){
    maxHp=Math.max(1,Math.round(maxHp*numberOr(cfg.eliteHpMultiplier,1.65)));
    atk=Math.max(1,Math.round(atk*numberOr(cfg.eliteAttackMultiplier,1.20)));
    def=Math.max(0,Math.round(def+numberOr(cfg.eliteArmorBonus,2)));
    xp=Math.max(1,Math.round(xp*numberOr(cfg.eliteXpMultiplier,1.60)));
  }

  if(template.boss){
    maxHp=Math.max(1,Math.round(maxHp*numberOr(cfg.bossHpMultiplier,1.5)));
    atk=Math.max(1,Math.round(atk*numberOr(cfg.bossAttackMultiplier,1.25)));
    def=Math.max(0,Math.round(def*numberOr(cfg.bossArmorMultiplier,1.25)));
    xp=Math.max(1,Math.round(xp*numberOr(cfg.bossXpMultiplier,1.75)));
  }

  const danger=mobDangerSteps(mobLevel);
  if(danger>0){
    maxHp=Math.round(maxHp*(1+danger*percentOr(cfg.dangerHpPerExtraLevelPercent,12)));
    atk=Math.round(atk*(1+danger*percentOr(cfg.dangerAttackPerExtraLevelPercent,9)));
    def=Math.max(0,Math.round(def+danger*numberOr(cfg.dangerArmorPerExtraLevel,.6)));
    xp=Math.round(xp*(1+danger*percentOr(cfg.dangerXpPerExtraLevelPercent,10)));
  }

  return {maxHp,atk,def,xp,danger};
}

function mobXpReward(mob){
  if(!mob) return 0;
  const cfg=BALANCE.mobLevels||{};
  const base=Math.max(1,Math.floor(numberOr(mob.xp,mob.template?.xp||1)));
  const diff=mob.level-state.level;
  const trivialGap=Math.max(1,Math.floor(numberOr(cfg.trivialXpStartsAboveMobLevels,5)));
  if(state.level-mob.level>=trivialGap){
    // Intentional infinite-grind rule: trivial enemies always remain worth
    // exactly their level in XP, even for extremely high-level players.
    return Math.max(1,Math.floor(mob.level));
  }
  if(diff<0){
    const penalty=Math.abs(diff)*percentOr(cfg.lowLevelXpPenaltyPerLevelPercent,20);
    return Math.max(1,Math.round(base*Math.max(0,1-penalty)));
  }
  if(diff>0){
    return Math.max(1,Math.round(base*(1+diff*percentOr(cfg.higherLevelXpBonusPerLevelPercent,8))));
  }
  return base;
}

function restoreMobStats(mob,fullHeal=true){
  const oldMax=Math.max(1,numberOr(mob.maxHp,1));
  const oldHp=Math.max(0,numberOr(mob.hp,oldMax));
  const ratio=Math.max(0,Math.min(1,oldHp/oldMax));
  const stats=mobScaledStats(mob.template,mob.level,!!mob.elite);
  mob.maxHp=stats.maxHp;
  mob.hp=fullHeal?stats.maxHp:Math.max(1,Math.round(stats.maxHp*ratio));
  mob.atk=stats.atk;
  mob.def=stats.def;
  mob.xp=stats.xp;
  mob.dangerSteps=stats.danger;
  mob.attackAnim=0;
}

function refreshAliveMobStatsForPlayer(){
  for(const mob of mobs){
    if(mob.alive) restoreMobStats(mob,false);
  }
}

function spawnMobs(){
  mobs=[];
  nextMobId=1;
  bossMob=null;

  const spawnDefs = [
    // Slime habitat — north-central marsh/clearing.
    ["slime",18,5],["slime",21,4],["slime",24,6],["slime",19,8],["slime",22,9],["slime",26,5],
    // Goblin camp — concentrated in the fortified northeast clearing.
    ["goblin",34,6],["goblin",37,5],["goblin",39,8],["goblin",35,9],["goblin",40,6],
    // Wolves roam the broad wilderness instead of spawning in town/camps.
    ["wolf",15,17],["wolf",21,16],["wolf",27,19],["wolf",32,23],["wolf",18,26],["wolf",25,27],["wolf",33,18],["wolf",39,21],
    // Passive starter-farm animals.
    ["cow",4,20],["cow",8,22],
    ["pig",6,21],["pig",9,20],
    ["chicken",5,23],["chicken",7,19],["chicken",9,23]
  ];

  for(const [kind,tx,ty] of spawnDefs){
    const template=enemyTemplates.find(e=>e.kind===kind);
    if(!template) continue;
    if(!tile[world[ty][tx]].walk) continue;
    const mob={
      id:nextMobId++,
      kind,
      template,
      level:mobSpawnLevel(template,tx,ty),
      x:tx*TILE+TILE/2,
      y:ty*TILE+TILE/2,
      homeX:tx*TILE+TILE/2,
      homeY:ty*TILE+TILE/2,
      vx:0,vy:0,
      drawVx:0,drawVy:0,
      facing:"down",
      facingCandidate:"down",
      facingCandidateTime:0,
      animTime:Math.random()*10,
      moveTimer:Math.random()*2,
      alive:true,
      respawnTimer:0,
      aggro:false,
      returningHome:false,
      leashStuckTime:0,
      boss:false
    };
    restoreMobStats(mob);
    mobs.push(mob);
  }

  const boss={
    id:nextMobId++,
    kind:"boss",
    template:bossTemplate,
    level:mobSpawnLevel(bossTemplate,36,27),
    x:2326,
    y:1750,
    homeX:2326,
    homeY:1750,
    vx:0,vy:0,
    drawVx:0,drawVy:0,
    facing:"down",
    facingCandidate:"down",
    facingCandidateTime:0,
    animTime:0,
    moveTimer:999999,
    alive:true,
    respawnTimer:0,
    aggro:false,
    returningHome:false,
    leashStuckTime:0,
    boss:true
  };
  restoreMobStats(boss);
  mobs.push(boss);
  bossMob=boss;
}

function stableMobFacing(mob,vx,vy,dt){
  const ax=Math.abs(vx), ay=Math.abs(vy);
  if(ax<1 && ay<1) return mob.facing||"down";

  // Axis hysteresis: when movement is close to diagonal, prefer the current
  // visual axis instead of flipping left/right/up/down every frame.
  let candidate;
  const current=mob.facing||"down";
  if((current==="left"||current==="right") && ax>=ay*0.72){
    candidate=vx>=0?"right":"left";
  }else if((current==="up"||current==="down") && ay>=ax*0.72){
    candidate=vy>=0?"down":"up";
  }else{
    candidate=vectorFacing(vx,vy,current);
  }

  if(candidate===current){
    mob.facingCandidate=candidate;
    mob.facingCandidateTime=0;
    return current;
  }
  if(mob.facingCandidate!==candidate){
    mob.facingCandidate=candidate;
    mob.facingCandidateTime=0;
  }
  mob.facingCandidateTime=(mob.facingCandidateTime||0)+dt;
  if(mob.facingCandidateTime>=0.14){
    mob.facing=candidate;
    mob.facingCandidateTime=0;
  }
  return mob.facing||current;
}

function drawSheetSprite(c, sheet, ready, x, y, scale=1, facing="down", animT=0, moving=true, rowMap=null, fallbackKind="", attacking=false){
  c.save();
  c.imageSmoothingEnabled = false;

  const resolvedMap = rowMap || { down: 0, left: 1, right: 2, up: 3 };
  const row = resolvedMap[facing] ?? 0;
  // Column 4 is the action/attack frame. Keep it out of the normal walking
  // cycle so idle mobs do not flash aggressive poses every half-second.
  const walkCycle=[0,1,2,1];
  const col = attacking ? 3 : (moving ? walkCycle[Math.floor(animT * 7) % walkCycle.length] : 0);
  const bob = moving && !attacking ? Math.abs(Math.sin(animT * 7)) * 1.0 : 0;

  c.fillStyle = "rgba(0,0,0,.18)";
  c.beginPath();
  c.ellipse(x, y + 10, 9 * scale / 0.23, 3.2 * scale / 0.23, 0, 0, Math.PI * 2);
  c.fill();

  if(ready && sheet.naturalWidth && sheet.naturalHeight){
    const sx0 = Math.round(col * sheet.naturalWidth / 4);
    const sx1 = Math.round((col + 1) * sheet.naturalWidth / 4);
    const sy0 = Math.round(row * sheet.naturalHeight / 4);
    const sy1 = Math.round((row + 1) * sheet.naturalHeight / 4);
    const frameW = sx1 - sx0;
    const frameH = sy1 - sy0;
    const meta=spriteFrameMeta(sheet,row,col);
    if(meta){
      // Draw only the visible pixels from the frame. This makes the actual feet,
      // not transparent padding at the bottom of the cell, define ground contact.
      const dw=meta.sw*scale;
      const dh=meta.sh*scale;
      const dx=Math.round(x-dw/2);
      const groundY=Math.round(y+8-bob);
      const dy=Math.round(groundY-dh);
      c.drawImage(sheet,meta.sx,meta.sy,meta.sw,meta.sh,dx,dy,dw,dh);
    }else{
      const dw = frameW * scale;
      const dh = frameH * scale;
      const dx = Math.round(x - dw / 2);
      const dy = Math.round(y - dh + 8 - bob);
      c.drawImage(sheet, sx0, sy0, frameW, frameH, dx, dy, dw, dh);
    }
  } else {
    if(fallbackKind === "slime") drawSlime(c,x,y,scale * 2.2);
    else if(fallbackKind === "wolf") drawWolf(c,x,y,scale * 2.0);
    else if(fallbackKind === "goblin") drawGoblin(c,x,y,scale * 2.0);
  }

  c.restore();
}

function drawSlimeSprite(c,x,y,scale=1,facing="down",animT=0,moving=true,attacking=false){
  drawSheetSprite(
    c,
    slimeSheet,
    slimeSheetReady,
    x,
    y,
    scale,
    facing,
    animT,
    moving,
    { down: 0, right: 1, left: 2, up: 3 },
    "slime",
    attacking
  );
}

function drawWolfSprite(c,x,y,scale=1,facing="down",animT=0,moving=true,attacking=false){
  drawSheetSprite(
    c,
    wolfSheet,
    wolfSheetReady,
    x,
    y,
    scale,
    facing,
    animT,
    moving,
    { down: 0, right: 1, left: 2, up: 3 },
    "wolf",
    attacking
  );
}

function drawGoblinSprite(c,x,y,scale=1,facing="down",animT=0,moving=true,attacking=false){
  drawSheetSprite(
    c,
    goblinSheet,
    goblinSheetReady,
    x,
    y,
    scale,
    facing,
    animT,
    moving,
    { down: 0, right: 1, left: 2, up: 3 },
    "goblin",
    attacking
  );
}

function drawBearSprite(c,x,y,scale=1,facing="down",animT=0,moving=true,attacking=false){
  drawSheetSprite(
    c,
    bearSheet,
    bearSheetReady,
    x,
    y,
    scale,
    facing,
    animT,
    moving,
    { down: 0, right: 1, left: 2, up: 3 },
    "boss",
    attacking
  );
}

function drawCowSprite(c,x,y,scale=1,facing="down",animT=0,moving=true,attacking=false){
  drawSheetSprite(
    c,
    cowSheet,
    cowSheetReady,
    x,
    y,
    scale,
    facing,
    animT,
    moving,
    { down: 0, right: 1, left: 2, up: 3 },
    "cow",
    attacking
  );
}

function drawPigSprite(c,x,y,scale=1,facing="down",animT=0,moving=true,attacking=false){
  drawSheetSprite(
    c,
    pigSheet,
    pigSheetReady,
    x,
    y,
    scale,
    facing,
    animT,
    moving,
    { down: 0, right: 1, left: 2, up: 3 },
    "pig",
    attacking
  );
}

function drawChickenSprite(c,x,y,scale=1,facing="down",animT=0,moving=true,attacking=false){
  drawSheetSprite(
    c,
    chickenSheet,
    chickenSheetReady,
    x,
    y,
    scale,
    facing,
    animT,
    moving,
    { down: 0, right: 1, left: 2, up: 3 },
    "chicken",
    attacking
  );
}

function drawSlime(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s);
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0,16,13,3.5,0,0,Math.PI*2); c.fill();
  const px=(color,rx,ry,rw=1,rh=1)=>{ c.fillStyle=color; c.fillRect(rx,ry,rw,rh); };
  px("#3f8f48",-10,-4,20,11);
  px("#6fd879",-7,-7,14,4);
  px("#88e992",-4,-9,8,2);
  px("#ffffff",-4,-1,3,3); px("#ffffff",1,-1,3,3);
  px("#182518",-3,0,1,2); px("#182518",2,0,1,2);
  px("#2f5e34",-2,5,4,1);
  c.restore();
}
function drawGoblin(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s);
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0,16,13,3.5,0,0,Math.PI*2); c.fill();
  const px=(color,rx,ry,rw=1,rh=1)=>{ c.fillStyle=color; c.fillRect(rx,ry,rw,rh); };
  px("#85bf56",-6,-10,12,8); px("#85bf56",-9,-8,3,3); px("#85bf56",6,-8,3,3);
  px("#26301d",-4,-6,2,2); px("#26301d",2,-6,2,2);
  px("#7b5d40",-8,-1,16,8); px("#a7d274",-5,-3,10,2);
  px("#654223",-7,6,14,2);
  px("#85bf56",-7,8,3,5); px("#85bf56",4,8,3,5);
  c.restore();
}
function drawWolf(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s);
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0,16,13,3.5,0,0,Math.PI*2); c.fill();
  const px=(color,rx,ry,rw=1,rh=1)=>{ c.fillStyle=color; c.fillRect(rx,ry,rw,rh); };
  px("#8b95a2",-11,0,14,7);
  px("#b2bac6",-8,-4,9,4);
  px("#7e8793",2,-5,7,6); px("#7e8793",5,-8,2,3); px("#7e8793",8,-8,2,3);
  px("#e8edf4",5,0,6,4);
  px("#21252a",5,-2,1,1); px("#21252a",8,-2,1,1); px("#21252a",10,1,1,1);
  px("#8b95a2",-13,0,2,2); px("#8b95a2",-6,7,3,5); px("#8b95a2",1,7,3,5);
  c.restore();
}
function drawBoss(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s);
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0,18,16,4,0,0,Math.PI*2); c.fill();
  const px=(color,rx,ry,rw=1,rh=1)=>{ c.fillStyle=color; c.fillRect(rx,ry,rw,rh); };
  px("#9da4ae",-8,-9,16,10);
  px("#b4bbc5",-10,1,20,12);
  px("#7c8189",-12,1,3,10); px("#7c8189",9,1,3,10);
  px("#f0be47",-8,-14,16,3); px("#f0be47",-6,-19,3,6); px("#f0be47",-1,-21,3,8); px("#f0be47",4,-19,3,6);
  px("#23262c",-4,-5,2,2); px("#23262c",2,-5,2,2);
  px("#6f747c",-3,-1,6,1);
  px("#7c8189",-6,13,4,4); px("#7c8189",2,13,4,4);
  c.restore();
}



function drawSlime(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s);
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0,16,13,3.5,0,0,Math.PI*2); c.fill();
  const px=(color,rx,ry,rw=1,rh=1)=>{ c.fillStyle=color; c.fillRect(rx,ry,rw,rh); };
  px("#3f8f48",-10,-4,20,11);
  px("#6fd879",-7,-7,14,4);
  px("#88e992",-4,-9,8,2);
  px("#ffffff",-4,-1,3,3); px("#ffffff",1,-1,3,3);
  px("#182518",-3,0,1,2); px("#182518",2,0,1,2);
  px("#2f5e34",-2,5,4,1);
  c.restore();
}
function drawGoblin(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s);
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0,16,13,3.5,0,0,Math.PI*2); c.fill();
  const px=(color,rx,ry,rw=1,rh=1)=>{ c.fillStyle=color; c.fillRect(rx,ry,rw,rh); };
  px("#85bf56",-6,-10,12,8); px("#85bf56",-9,-8,3,3); px("#85bf56",6,-8,3,3);
  px("#26301d",-4,-6,2,2); px("#26301d",2,-6,2,2);
  px("#7b5d40",-8,-1,16,8); px("#a7d274",-5,-3,10,2);
  px("#654223",-7,6,14,2);
  px("#85bf56",-7,8,3,5); px("#85bf56",4,8,3,5);
  c.restore();
}
function drawWolf(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s);
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0,16,13,3.5,0,0,Math.PI*2); c.fill();
  const px=(color,rx,ry,rw=1,rh=1)=>{ c.fillStyle=color; c.fillRect(rx,ry,rw,rh); };
  px("#8b95a2",-11,0,14,7);
  px("#b2bac6",-8,-4,9,4);
  px("#7e8793",2,-5,7,6); px("#7e8793",5,-8,2,3); px("#7e8793",8,-8,2,3);
  px("#e8edf4",5,0,6,4);
  px("#21252a",5,-2,1,1); px("#21252a",8,-2,1,1); px("#21252a",10,1,1,1);
  px("#8b95a2",-13,0,2,2); px("#8b95a2",-6,7,3,5); px("#8b95a2",1,7,3,5);
  c.restore();
}
function drawBoss(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s);
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0,18,16,4,0,0,Math.PI*2); c.fill();
  const px=(color,rx,ry,rw=1,rh=1)=>{ c.fillStyle=color; c.fillRect(rx,ry,rw,rh); };
  px("#9da4ae",-8,-9,16,10);
  px("#b4bbc5",-10,1,20,12);
  px("#7c8189",-12,1,3,10); px("#7c8189",9,1,3,10);
  px("#f0be47",-8,-14,16,3); px("#f0be47",-6,-19,3,6); px("#f0be47",-1,-21,3,8); px("#f0be47",4,-19,3,6);
  px("#23262c",-4,-5,2,2); px("#23262c",2,-5,2,2);
  px("#6f747c",-3,-1,6,1);
  px("#7c8189",-6,13,4,4); px("#7c8189",2,13,4,4);
  c.restore();
}

function drawCow(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s); c.imageSmoothingEnabled=false;
  const px=(col,rx,ry,rw=1,rh=1)=>{c.fillStyle=col;c.fillRect(rx,ry,rw,rh)};
  px("#f3eee3",-11,-5,18,12); px("#f3eee3",5,-8,9,9);
  px("#322b28",-8,-5,6,5); px("#322b28",1,0,6,5); px("#322b28",8,-6,4,4);
  px("#d9c8b5",10,-2,6,5); px("#2c2624",13,0,1,1);
  px("#5e4939",-8,7,3,7); px("#5e4939",3,7,3,7); px("#5e4939",9,5,3,7);
  px("#c8b19c",-13,-2,2,8); px("#c8b19c",-15,4,3,2);
  c.restore();
}
function drawPig(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s); c.imageSmoothingEnabled=false;
  const px=(col,rx,ry,rw=1,rh=1)=>{c.fillStyle=col;c.fillRect(rx,ry,rw,rh)};
  px("#e8929d",-10,-4,16,10); px("#f1a8ae",4,-6,9,8);
  px("#c96e7c",9,-2,6,5); px("#492f32",11,-1,1,1); px("#492f32",14,-1,1,1);
  px("#d27b88",-7,6,3,6); px("#d27b88",2,6,3,6); px("#d27b88",8,3,3,7);
  px("#f1a8ae",5,-9,3,4); px("#f1a8ae",10,-9,3,4);
  c.restore();
}
function drawChicken(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s); c.imageSmoothingEnabled=false;
  const px=(col,rx,ry,rw=1,rh=1)=>{c.fillStyle=col;c.fillRect(rx,ry,rw,rh)};
  px("#f3eee5",-5,-5,10,11); px("#ffffff",1,-9,7,8);
  px("#dc5848",4,-11,2,3); px("#dc5848",6,-10,2,2); px("#e3a33f",8,-5,4,2);
  px("#2c2825",5,-7,1,1); px("#d6923b",-2,6,2,5); px("#d6923b",3,6,2,5);
  c.restore();
}

function mobVisualScale(mob){
  if(!mob) return 1;
  if(mob.boss || mob.kind==="boss") return MOB_TYPE_SCALE.snickers;
  if(Object.prototype.hasOwnProperty.call(MOB_TYPE_SCALE,mob.kind)) return MOB_TYPE_SCALE[mob.kind];
  if(["cow","pig","chicken"].includes(mob.kind)) return VISUAL_SCALE.passiveMobs;
  return VISUAL_SCALE.hostileMobs;
}

function drawMob(c,mob,sx,sy){
  const scale=mobVisualScale(mob);
  const moving=Math.hypot(mob.drawVx||0,mob.drawVy||0)>4;
  const attacking=(mob.attackAnim||0)>0;
  if(mob.kind==="slime") {
    drawSlimeSprite(c,sx,sy,0.23*scale,mob.facing||"down",mob.animTime||0,moving,attacking);
  } else if(mob.kind==="goblin") {
    drawGoblinSprite(c,sx,sy,0.23*scale,mob.facing||"down",mob.animTime||0,moving,attacking);
  } else if(mob.kind==="wolf") {
    drawWolfSprite(c,sx,sy,0.23*scale,mob.facing||"down",mob.animTime||0,moving,attacking);
  } else if(mob.kind==="cow") {
    drawCowSprite(c,sx,sy,0.23*scale,mob.facing||"down",mob.animTime||0,moving,attacking);
  } else if(mob.kind==="pig") {
    drawPigSprite(c,sx,sy,0.23*scale,mob.facing||"down",mob.animTime||0,moving,attacking);
  } else if(mob.kind==="chicken") {
    drawChickenSprite(c,sx,sy,0.23*scale,mob.facing||"down",mob.animTime||0,moving,attacking);
  } else if(mob.kind==="boss") {
    drawBearSprite(c,sx,sy,0.145*scale,mob.facing||"down",mob.animTime||0,moving,attacking);
  }
}

function drawBattleSprites(){
  heroCtx.clearRect(0,0,heroCanvas.width,heroCanvas.height);
  enemyCtx.clearRect(0,0,enemyCanvas.width,enemyCanvas.height);
  drawHero(heroCtx,24,36,0.15,false,0,"down");
  if(!enemy)return;
  if(enemy.kind==="slime") drawSlimeSprite(enemyCtx,36,39,0.68,"down",performance.now()/1000,false,enemyAttackAnim>0);
  else if(enemy.kind==="goblin") drawGoblinSprite(enemyCtx,36,39,0.68,"down",performance.now()/1000,false,enemyAttackAnim>0);
  else if(enemy.kind==="wolf") drawWolfSprite(enemyCtx,36,39,0.68,"down",performance.now()/1000,false,enemyAttackAnim>0);
  else if(enemy.kind==="cow") drawCowSprite(enemyCtx,36,44,0.48,"down",performance.now()/1000,false,enemyAttackAnim>0);
  else if(enemy.kind==="pig") drawPigSprite(enemyCtx,36,44,0.48,"down",performance.now()/1000,false,enemyAttackAnim>0);
  else if(enemy.kind==="chicken") drawChickenSprite(enemyCtx,36,44,0.46,"down",performance.now()/1000,false,enemyAttackAnim>0);
  else if(enemy.kind==="boss") drawBearSprite(enemyCtx,36,56,0.13,"down",performance.now()/1000,false,enemyAttackAnim>0);
  else drawBoss(enemyCtx,36,38,.95);
}

function finishMobLeashReturn(mob){
  if(!mob) return;
  mob.x=mob.homeX; mob.y=mob.homeY;
  mob.vx=0; mob.vy=0; mob.drawVx=0; mob.drawVy=0;
  mob.aggro=false;
  mob.returningHome=false;
  mob.leashStuckTime=0;
  mob.moveTimer=Math.max(.45,numberOr(mob.template?.wanderDelayMin,.8));
  mob.facingCandidateTime=0;
  if(mob.alive && Number.isFinite(mob.maxHp)) mob.hp=mob.maxHp;
}

function startMobLeashReturn(mob){
  if(!mob||!mob.alive) return false;
  mob.aggro=false;
  mob.returningHome=true;
  mob.vx=0; mob.vy=0;
  mob.leashStuckTime=0;
  if(Number.isFinite(mob.maxHp)) mob.hp=mob.maxHp;
  if(typeof selectedTarget!=="undefined" && selectedTarget===mob) selectedTarget=null;
  if(dist(mob.x,mob.y,mob.homeX,mob.homeY)<=3) finishMobLeashReturn(mob);
  return true;
}

function updateMobs(dt){
  if(isLootInteractionOpen()) return;
  for(const mob of mobs){
    if(!mob.alive){
      if(mob.boss) continue;
      mob.respawnTimer-=dt;
      if(mob.respawnTimer<=0){
        mob.alive=true;
        mob.x=mob.homeX; mob.y=mob.homeY;
        mob.vx=0; mob.vy=0; mob.drawVx=0; mob.drawVy=0;
        mob.facing="down"; mob.facingCandidate="down"; mob.facingCandidateTime=0; mob.aggro=false;
        mob.returningHome=false; mob.leashStuckTime=0;
        mob.elite=rollMobElite(mob.template);
        restoreMobStats(mob);
      }
      continue;
    }

    mob.attackAnim=Math.max(0,(mob.attackAnim||0)-dt);
    const d=dist(state.x,state.y,mob.x,mob.y);
    let isTarget=mob===combatTarget;
    let homeDist=dist(mob.x,mob.y,mob.homeX,mob.homeY);

    // The spawn point is the hard combat leash anchor. Once a mob has been
    // pulled beyond its configured leash, it evades immediately: combat ends,
    // HP resets, and the mob runs home before it can be engaged again.
    if(isTarget && !mob.returningHome && homeDist>mob.template.combatLeashDistance){
      disengageCombat(false);
      isTarget=false;
    }

    // Aggression and movement are data-driven so routine mob tuning only
    // requires editing config/game-balance.js. Returning mobs are in an evade
    // state and cannot re-aggro until they have reached their spawn point.
    const aggroRanges=mobAggroRanges(mob);
    if(!mob.returningHome && !combatTarget && mob.template.aggressive && d<aggroRanges.trigger){
      engageMob(mob,true);
      isTarget=mob===combatTarget;
    }

    mob.aggro=!mob.returningHome && (isTarget || (!combatTarget && mob.template.aggressive && d<aggroRanges.alert));

    let vx=0,vy=0;
    if(mob.returningHome){
      if(homeDist<=3){
        finishMobLeashReturn(mob);
        continue;
      }
      const dx=mob.homeX-mob.x, dy=mob.homeY-mob.y;
      const len=Math.max(.001,Math.hypot(dx,dy));
      const returnSpeed=Math.max(mob.template.leashSpeed,mob.template.chaseSpeed);
      vx=dx/len*returnSpeed; vy=dy/len*returnSpeed;
    }else if(isTarget){
      const desired=ATTACK_RANGE-8;
      if(d>desired){
        const dx=state.x-mob.x, dy=state.y-mob.y;
        const len=Math.max(.001,Math.hypot(dx,dy));
        const speed=mob.template.chaseSpeed;
        vx=dx/len*speed; vy=dy/len*speed;
      }
    }else if(mob.boss){
      vx=0; vy=0;
    }else{
      mob.moveTimer-=dt;
      if(mob.moveTimer<=0){
        const minDelay=Math.min(mob.template.wanderDelayMin,mob.template.wanderDelayMax);
        const maxDelay=Math.max(mob.template.wanderDelayMin,mob.template.wanderDelayMax);
        mob.moveTimer=minDelay+Math.random()*(maxDelay-minDelay);
        const ang=Math.random()*Math.PI*2;
        mob.vx=Math.cos(ang)*mob.template.wanderSpeed; mob.vy=Math.sin(ang)*mob.template.wanderSpeed;
      }
      vx=mob.vx; vy=mob.vy;
      homeDist=dist(mob.x,mob.y,mob.homeX,mob.homeY);
      if(homeDist>mob.template.leashDistance){
        const dx=mob.homeX-mob.x, dy=mob.homeY-mob.y;
        const len=Math.max(.001,Math.hypot(dx,dy));
        vx=dx/len*mob.template.leashSpeed; vy=dy/len*mob.template.leashSpeed;
      }
    }

    mob.drawVx=vx; mob.drawVy=vy;
    if(Math.hypot(vx,vy)>1){
      stableMobFacing(mob,vx,vy,dt);
      mob.animTime=(mob.animTime||0)+dt;
    }else if(isTarget){
      stableMobFacing(mob,state.x-mob.x,state.y-mob.y,dt);
    }else{
      mob.facingCandidateTime=0;
    }

    const nx=mob.x+vx*dt, ny=mob.y+vy*dt;
    let blocked=false;
    if(canStand(nx,mob.y,10)) mob.x=nx; else blocked=true;
    if(canStand(mob.x,ny,10)) mob.y=ny; else blocked=true;

    if(mob.returningHome){
      // Normal movement usually slides around terrain one axis at a time. This
      // fail-safe prevents an evading mob from remaining permanently wedged.
      mob.leashStuckTime=blocked?(mob.leashStuckTime||0)+dt:Math.max(0,(mob.leashStuckTime||0)-dt*2);
      const remaining=dist(mob.x,mob.y,mob.homeX,mob.homeY);
      if(remaining<=3 || mob.leashStuckTime>=1.5){
        finishMobLeashReturn(mob);
        continue;
      }
    }else if(blocked && !isTarget && !mob.boss){
      // Do not bounce the stored wander vector back and forth against a wall.
      // Stop briefly and choose a fresh direction on the next wander decision.
      mob.vx=0; mob.vy=0; mob.moveTimer=0;
    }

    if(!mob.boss && tileAtWorld(mob.x,mob.y)===4){
      finishMobLeashReturn(mob);
    }
  }
}

function findNearestMob(maxDistance=Infinity){
  let best=null,bestD=maxDistance;
  for(const mob of mobs){
    if(!mob.alive || mob.returningHome) continue;
    const d=dist(state.x,state.y,mob.x,mob.y);
    if(d<bestD){best=mob;bestD=d}
  }
  return best;
}

// Open-world combat state (RuneScape-style auto combat)
// Routine balance values come from config/game-balance.js so they can be
// changed independently without rebuilding js/game.js.
const ATTACK_RANGE=numberOr(BALANCE.combat?.meleeRange,30);
const MAX_ENGAGE_RANGE=numberOr(BALANCE.combat?.engageRange,72);
const DISENGAGE_RANGE=numberOr(BALANCE.combat?.disengageRange,260);
const AUTO_CHASE_RANGE=numberOr(BALANCE.combat?.autoChaseRange,82);
const PLAYER_ATTACK_INTERVAL=numberOr(BALANCE.combat?.playerAttackIntervalSeconds,1.15);
const ATTACK_BUTTON_GCD=numberOr(BALANCE.combat?.attackButtonCooldownSeconds,.90);
const ATTACK_START_DELAY=numberOr(BALANCE.combat?.openingAttackDelaySeconds,.62);
const PLAYER_CRIT_CHANCE=percentOr(BALANCE.combat?.playerCritChancePercent,10);
const PLAYER_DAMAGE_MIN=Math.floor(numberOr(BALANCE.combat?.playerDamageBonusMin,0));
const PLAYER_DAMAGE_MAX=Math.floor(numberOr(BALANCE.combat?.playerDamageBonusMax,3));
const ENEMY_DAMAGE_MIN=Math.floor(numberOr(BALANCE.combat?.enemyDamageBonusMin,0));
const ENEMY_DAMAGE_MAX=Math.floor(numberOr(BALANCE.combat?.enemyDamageBonusMax,2));
const TARGET_CLICK_RADIUS=numberOr(BALANCE.combat?.targetClickRadius,34);
const POTION_HEAL=Math.max(0,Math.floor(numberOr(BALANCE.player?.potionHeal,14)));
const POTION_COOLDOWN=numberOr(BALANCE.player?.potionCooldownSeconds,.85);
const DEATH_GOLD_LOSS=percentOr(BALANCE.player?.deathGoldLossPercent,25);
const SLIMES_REQUIRED=Math.max(1,Math.floor(numberOr(BALANCE.quest?.slimesRequired,3)));
let combatTarget=null;
let selectedTarget=null;
let playerAttackTimer=0;
let enemyAttackTimer=0;
let attackButtonCooldown=0;
let playerAttackAnim=0;
let enemyAttackAnim=0;
let potionCooldown=0;
let combatFx=[];
let bossMob=null;
let combatHudSignature="";

function combatHitChancePercent(base,levelAdvantage,perLevel,rankAdjustment=0){
  const cfg=BALANCE.mobLevels||{};
  const min=Math.max(0,numberOr(cfg.minimumHitChancePercent,55));
  const max=Math.min(100,numberOr(cfg.maximumHitChancePercent,99));
  return clamp(numberOr(base,95)+levelAdvantage*numberOr(perLevel,4)+rankAdjustment,min,max);
}

function playerHitChanceAgainst(mob){
  const cfg=BALANCE.mobLevels||{};
  let rankPenalty=0;
  if(mob?.boss || mob?.template?.boss) rankPenalty-=numberOr(cfg.bossPlayerHitPenaltyPercent,5);
  else if(mob?.elite) rankPenalty-=numberOr(cfg.elitePlayerHitPenaltyPercent,3);
  return combatHitChancePercent(
    cfg.playerBaseHitChancePercent,
    state.level-(mob?.level||state.level),
    cfg.playerHitChancePerLevelAdvantagePercent,
    rankPenalty
  );
}

function mobHitChanceAgainstPlayer(mob){
  const cfg=BALANCE.mobLevels||{};
  let rankBonus=0;
  if(mob?.boss || mob?.template?.boss) rankBonus+=numberOr(cfg.bossEnemyHitBonusPercent,5);
  else if(mob?.elite) rankBonus+=numberOr(cfg.eliteEnemyHitBonusPercent,3);
  return combatHitChancePercent(
    cfg.enemyBaseHitChancePercent,
    (mob?.level||state.level)-state.level,
    cfg.enemyHitChancePerLevelAdvantagePercent,
    rankBonus
  );
}

function getMobRespawnSeconds(mob){
  if(!mob||mob.boss) return 999999;
  const min=Math.min(mob.template.respawnMin,mob.template.respawnMax);
  const max=Math.max(mob.template.respawnMin,mob.template.respawnMax);
  return min+Math.random()*(max-min);
}

function selectMob(mob,showToast=true){
  if(!mob||!mob.alive||mob.returningHome) return false;
  selectedTarget=mob;
  updateCombatHud();
  if(showToast) toast(`Lv ${mob.level} ${mobDisplayName(mob)} targeted • ${Math.max(0,Math.ceil(mob.hp))}/${mob.maxHp} HP`);
  return true;
}

function clearSelectedTarget(){
  selectedTarget=null;
  updateCombatHud();
}

function getHudTarget(){
  if(selectedTarget && selectedTarget.alive && !selectedTarget.returningHome) return selectedTarget;
  if(combatTarget && combatTarget.alive) return combatTarget;
  selectedTarget=null;
  return null;
}

function updateOpenCombat(dt){
  playerAttackAnim=Math.max(0,playerAttackAnim-dt);
  enemyAttackAnim=Math.max(0,enemyAttackAnim-dt);
  let liveFx=0;
  for(let i=0;i<combatFx.length;i++){
    const fx=combatFx[i];
    fx.life-=dt;
    if(fx.life>0) combatFx[liveFx++]=fx;
  }
  combatFx.length=liveFx;

  if(!combatTarget){updateCombatHud();return}
  if(!combatTarget.alive){disengageCombat(false);return}

  const d=dist(state.x,state.y,combatTarget.x,combatTarget.y);
  if(d>DISENGAGE_RANGE){
    disengageCombat(false);
    toast("You left combat.");
    return;
  }

  if(d>ATTACK_RANGE){
    // Closing distance does not preload an instant hit. The first swing still
    // respects the attack cycle once the fighter reaches melee range.
    playerAttackTimer=Math.max(playerAttackTimer,.12);
    enemyAttackTimer=Math.max(enemyAttackTimer,.12);
    updateCombatHud();
    return;
  }

  playerAttackTimer-=dt;
  enemyAttackTimer-=dt;

  if(playerAttackTimer<=0 && combatTarget && combatTarget.alive){
    performPlayerAutoAttack(combatTarget);
    playerAttackTimer=PLAYER_ATTACK_INTERVAL;
  }

  if(enemyAttackTimer<=0 && combatTarget && combatTarget.alive){
    // Capture the attacker and schedule its next swing BEFORE applying damage.
    // A killing blow can clear combatTarget during worldCombatDeath(), so never
    // dereference combatTarget after performEnemyAutoAttack() returns.
    const attackingMob=combatTarget;
    enemyAttackTimer=numberOr(attackingMob.template.attackInterval,1.45);
    performEnemyAutoAttack(attackingMob);
    if(!combatTarget){
      updateCombatHud();
      return;
    }
  }
  updateCombatHud();
}

function targetThreatInfo(mob){
  const delta=(mob?.level||1)-state.level;
  if(mob?.boss) return {label:"BOSS",cls:"boss"};
  if(mob?.elite) return {label:"ELITE",cls:"elite"};
  if(delta>=4) return {label:"DEADLY",cls:"deadly"};
  if(delta>=2) return {label:"DANGEROUS",cls:"dangerous"};
  if(delta<=-5) return {label:"TRIVIAL",cls:"trivial"};
  if(delta<=-2) return {label:"LOW",cls:"low"};
  return {label:"EVEN",cls:"even"};
}

function updateCombatHud(){
  const target=getHudTarget();
  let signature;
  let targetDistance=0;
  let targetDisplayName="";
  let threat=null;
  let hitChance=0;
  let near=null;

  if(target){
    targetDistance=dist(state.x,state.y,target.x,target.y);
    targetDisplayName=mobDisplayName(target);
    threat=targetThreatInfo(target);
    hitChance=Math.round(playerHitChanceAgainst(target));
    signature=[
      "target",target.id,targetDisplayName,target.level,target.hp,target.maxHp,target.def,
      target.boss?1:0,target.elite?1:0,threat.cls,hitChance,
      Math.ceil(targetDistance),targetDistance>ATTACK_RANGE?1:0,targetDistance>MAX_ENGAGE_RANGE?1:0,
      combatTarget&&combatTarget.alive?1:0,
      attackButtonCooldown>0?attackButtonCooldown.toFixed(1):"ready"
    ].join("|");
  }else{
    near=findNearestMob(MAX_ENGAGE_RANGE);
    signature=`none|${near?.id||""}|${attackButtonCooldown>0?attackButtonCooldown.toFixed(1):"ready"}`;
  }

  // updateOpenCombat runs every frame. Most frames do not change any visible
  // target HUD value, so avoid repeated DOM queries/writes until the rendered
  // state actually changes.
  if(signature===combatHudSignature) return;

  const hud=document.getElementById("targetHud");
  const action=document.getElementById("actionHint");
  if(!hud||!action) return;
  combatHudSignature=signature;
  action.classList.remove("ready","engaged","cooldown","targeted");

  if(target){
    hud.classList.add("show");
    const targetName=document.getElementById("targetName");
    targetName.textContent=`Lv ${target.level} ${targetDisplayName}`;
    targetName.style.color=mobLevelColor(target.level,target.boss,target.elite);
    document.getElementById("targetHpText").textContent=`${Math.max(0,Math.ceil(target.hp))}/${target.maxHp} HP`;
    document.getElementById("targetHpFill").style.width=`${Math.max(0,100*target.hp/target.maxHp)}%`;
    const threatEl=document.getElementById("targetThreat");
    threatEl.textContent=threat.label;
    threatEl.className=`threat-${threat.cls}`;
    document.getElementById("targetCombatStats").textContent=`DEF ${target.def} • HIT ${hitChance}%`;

    if(combatTarget && combatTarget.alive){
      document.getElementById("combatHint").textContent=targetDistance>ATTACK_RANGE?"Closing to melee range…":"In combat • move away to escape";
      action.innerHTML="LEAVE<br>COMBAT";
      action.classList.add("engaged");
      return;
    }

    document.getElementById("combatHint").textContent=targetDistance>MAX_ENGAGE_RANGE?`Targeted • ${Math.ceil(targetDistance)} away • move closer`:`Targeted • ${Math.ceil(targetDistance)} away • ready to attack`;
    if(attackButtonCooldown>0){
      action.innerHTML=`ATTACK<br>${attackButtonCooldown.toFixed(1)}s`;
      action.classList.add("cooldown");
    }else if(targetDistance<=MAX_ENGAGE_RANGE){
      action.innerHTML="ATTACK<br>TARGET";
      action.classList.add("ready");
    }else{
      action.innerHTML="MOVE<br>CLOSER";
      action.classList.add("targeted");
    }
    return;
  }

  hud.classList.remove("show");
  if(attackButtonCooldown>0){
    action.innerHTML=`ATTACK<br>${attackButtonCooldown.toFixed(1)}s`;
    action.classList.add("cooldown");
  }else{
    action.innerHTML=near?"ATTACK<br>NEAREST":"SELECT MOB<br>TO TARGET";
    if(near) action.classList.add("ready");
  }
}

function engageMob(mob,forced=false){
  if(!mob||!mob.alive||mob.returningHome) return false;
  if(combatTarget===mob) return true;

  const engageDistance=dist(state.x,state.y,mob.x,mob.y);
  if(!forced && engageDistance>MAX_ENGAGE_RANGE){
    selectMob(mob,false);
    toast("Target selected. Move closer before attacking.");
    return false;
  }
  if(!forced && attackButtonCooldown>0){
    toast(`Attack ready in ${attackButtonCooldown.toFixed(1)}s.`);
    return false;
  }

  if(combatTarget && combatTarget!==mob) startMobLeashReturn(combatTarget);
  selectedTarget=mob;
  combatTarget=mob;
  currentMob=mob;
  mob.aggro=true;
  if(!forced) attackButtonCooldown=ATTACK_BUTTON_GCD;

  // Starting or switching combat can never grant an instant free hit.
  playerAttackTimer=Math.max(playerAttackTimer,ATTACK_START_DELAY);
  enemyAttackTimer=Math.max(enemyAttackTimer,ATTACK_START_DELAY-.08);
  heroFacing=vectorFacing(mob.x-state.x,mob.y-state.y,heroFacing);
  updateCombatHud();
  if(!forced) toast(`Engaged Lv ${mob.level} ${mobDisplayName(mob)}.`);
  return true;
}

function disengageCombat(showToast=true){
  const disengagedMob=combatTarget;
  if(disengagedMob){
    disengagedMob.aggro=false;
    startMobLeashReturn(disengagedMob);
  }
  combatTarget=null; currentMob=null;
  playerAttackTimer=0; enemyAttackTimer=0;
  updateCombatHud();
  if(showToast) toast("Combat disengaged.");
}

function addCombatFx(x,y,text,kind="damage"){
  combatFx.push({x,y,text,kind,life:.8,maxLife:.8});
}

function performPlayerAutoAttack(mob){
  if(!mob||!mob.alive) return;
  playerAttackAnim=.20;
  if(Math.random()*100>=playerHitChanceAgainst(mob)){
    addCombatFx(mob.x,mob.y-18,"MISS","miss");
    return;
  }
  const crit=Math.random()<PLAYER_CRIT_CHANCE;
  const low=Math.min(PLAYER_DAMAGE_MIN,PLAYER_DAMAGE_MAX);
  const high=Math.max(PLAYER_DAMAGE_MIN,PLAYER_DAMAGE_MAX);
  let dmg=Math.max(1,state.atk+rand(low,high)-mob.def);
  if(crit) dmg*=2;
  mob.hp-=dmg;
  addCombatFx(mob.x,mob.y-18,crit?`★ ${dmg}`:`${dmg}`,crit?"crit":"damage");
  if(mob.hp<=0){
    mob.hp=0;
    defeatWorldMob(mob);
  }
}

function performEnemyAutoAttack(mob){
  if(!mob||!mob.alive) return;
  mob.attackAnim=.20;
  enemyAttackAnim=.20;
  if(Math.random()*100>=mobHitChanceAgainstPlayer(mob)){
    addCombatFx(state.x,state.y-20,"MISS","miss");
    return;
  }
  const low=Math.min(ENEMY_DAMAGE_MIN,ENEMY_DAMAGE_MAX);
  const high=Math.max(ENEMY_DAMAGE_MIN,ENEMY_DAMAGE_MAX);
  let dmg=Math.max(1,mob.atk+rand(low,high)-state.def);
  state.hp=Math.max(0,state.hp-dmg);
  addCombatFx(state.x,state.y-20,`-${dmg}`,"hurt");
  updateUI();
  if(state.hp<=0) worldCombatDeath();
}

function defeatWorldMob(mob){
  if(!mob||!mob.alive) return;
  const e=mob.template;
  let gold=0;
  let potionDrop=0;
  if(Math.random()<e.goldDropChance) gold=rand(Math.floor(e.gold[0]),Math.floor(e.gold[1]));
  if(mob.elite && gold>0) gold=Math.max(1,Math.round(gold*numberOr(BALANCE.mobLevels?.eliteGoldMultiplier,1.5)));
  if(e.potionDropAmount>0 && Math.random()<e.potionDropChance) potionDrop=e.potionDropAmount;

  const xpReward=mobXpReward(mob);
  const lootReward=rollMobLoot(mob);
  const lootPile=spawnMobLootPile(mob,lootReward.rolled,gold,potionDrop,mobDisplayName(mob));
  const hasLoot=lootPileHasLoot(lootPile);
  state.xp+=xpReward;
  state.kills++;

  if(e.name==="Slime") state.slimeKills++; // legacy save compatibility
  notifyQuestKill(e.configKey||e.kind||mob.kind,1);
  if(mob.boss||e.boss) state.bossDefeated=true;

  mob.alive=false;
  mob.aggro=false;
  mob.respawnTimer=getMobRespawnSeconds(mob);
  if(selectedTarget===mob) selectedTarget=null;
  levelCheck();
  disengageCombat(false);

  if(mob.boss){
    toast(`You defeated Snickers!${hasLoot?" Sparkling remains hold loot.":""}`);
  }else{
    const rewards=[`+${xpReward} XP`];
    rewards.push(hasLoot?"loot in sparkling remains":"no loot");
    toast(`Defeated ${mobDisplayName(mob)}: ${rewards.join(", ")}`);
  }
  updateUI();
}

function worldCombatDeath(){
  state.gold=Math.floor(state.gold*(1-DEATH_GOLD_LOSS));

  // Clear active controls/effects before teleporting so the new life begins in
  // a clean frame even if a direction or combat button was held at death.
  input={up:false,down:false,left:false,right:false};
  isHeroMoving=false;
  playerAttackTimer=0;
  enemyAttackTimer=0;
  playerAttackAnim=0;
  enemyAttackAnim=0;
  combatFx=[];

  if(combatTarget && !combatTarget.boss){
    combatTarget.x=combatTarget.homeX; combatTarget.y=combatTarget.homeY;
  }
  disengageCombat(false);
  selectedTarget=null;

  state.hp=state.maxHp;
  state.x=START_X; state.y=START_Y;
  lastSafePos={x:state.x,y:state.y};
  toast("You wake up back in Oakrest.");
  updateUI();
}

function useQuickPotion(){
  if(potionCooldown>0) return;
  if(state.potions<=0){toast("Your potion pouch is empty.");return}
  if(state.hp>=state.maxHp){toast("Your HP is already full.");return}
  state.potions--;
  const before=state.hp;
  state.hp=Math.min(state.maxHp,state.hp+POTION_HEAL);
  potionCooldown=POTION_COOLDOWN;
  addCombatFx(state.x,state.y-20,`+${state.hp-before}`,"heal");
  toast(`Potion restored ${state.hp-before} HP.`);
  updateUI();
}

function handleWorldTap(ev){
  if(document.getElementById("menu").classList.contains("show")) return;
  const rect=game.getBoundingClientRect();
  const sx=ev.clientX-rect.left, sy=ev.clientY-rect.top;
  const viewW=innerWidth/CAMERA_ZOOM, viewH=innerHeight/CAMERA_ZOOM;
  const camX=state.x-viewW/2, camY=state.y-viewH/2;
  const wx=camX+sx/CAMERA_ZOOM, wy=camY+sy/CAMERA_ZOOM;

  const tappedLootPile=findLootPileAtWorld(wx,wy,{lootableOnly:true});
  if(tappedLootPile){
    interactWithLootPile(tappedLootPile);
    return;
  }

  const tappedNpc=findNpcAtWorld(wx,wy);
  if(tappedNpc){
    interactWithNpc(tappedNpc);
    return;
  }

  let best=null;
  let bestScore=Infinity;
  for(const mob of mobs){
    if(!mob.alive || mob.returningHome) continue;
    // Mobs are taller than their feet position, so use a generous vertical
    // selection box rather than requiring a click directly on their feet.
    const dx=Math.abs(wx-mob.x);
    const dy=wy-mob.y;
    const radius=(mob.boss?TARGET_CLICK_RADIUS*1.45:TARGET_CLICK_RADIUS)*Math.max(1,mobVisualScale(mob));
    if(dx<=radius && dy>=-radius*1.35 && dy<=radius*.75){
      const score=dx*dx+(dy*.65)*(dy*.65);
      if(score<bestScore){best=mob;bestScore=score}
    }
  }

  if(best){
    selectMob(best);
  }else if(!combatTarget){
    clearSelectedTarget();
  }
}

function battleMessage(msg){
  document.getElementById("battleMsg").textContent=msg;
}

function setBattleButtons(enabled){
  for(const id of ["attackBtn","defendBtn","potionBtn","runBtn"]){
    document.getElementById(id).disabled=!enabled;
  }
}

function setBattleTurn(mode,label){
  const el=document.getElementById("battleTurn");
  el.classList.remove("enemy","guard");
  if(mode==="enemy") el.classList.add("enemy");
  if(mode==="guard") el.classList.add("guard");
  el.textContent=label || (mode==="enemy"?"ENEMY TURN":"YOUR TURN");
}

function animateBattleActor(which,cls,duration=360){
  const el=document.getElementById(which==="hero"?"heroBattleSprite":"enemyBattleSprite");
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(()=>el.classList.remove(cls),duration);
}

function battleFloat(which,text,kind="damage"){
  const layer=document.getElementById("battleFxLayer");
  const el=document.createElement("div");
  el.className=`battleFloat ${kind}`;
  el.textContent=text;
  el.style.left=which==="hero"?"23%":"72%";
  el.style.top=which==="hero"?"47%":"42%";
  layer.appendChild(el);
  setTimeout(()=>el.remove(),820);
}

function showEnemyIntent(show,text="Enemy is preparing an attack..."){
  const el=document.getElementById("enemyIntent");
  el.textContent=text;
  el.classList.toggle("show",!!show);
}

function returnPlayerTurn(){
  if(!enemy) return;
  battleLocked=false;
  showEnemyIntent(false);
  setBattleTurn("player","YOUR TURN");
  battleMessage("Choose your next action.");
  setBattleButtons(true);
}

function startMobBattle(mob){
  if(enemy || !mob.alive) return;
  startBattle({...mob.template,level:mob.level},mob);
}

function startBattle(base,mobRef=null){
  currentMob=mobRef;
  enemy={...base};
  if(mobRef){
    enemy.level=mobRef.level;
    enemy.elite=!!mobRef.elite;
    enemy.hp=mobRef.hp;
    enemy.maxHp=mobRef.maxHp;
    enemy.atk=mobRef.atk;
    enemy.def=mobRef.def;
    enemy.xp=mobXpReward(mobRef);
  }else{
    const temp={...base,baseLevel:base.baseLevel||base.level||1,boss:!!base.boss};
    const stats=mobScaledStats(temp,base.level||temp.baseLevel,!!base.elite);
    enemy.level=base.level||temp.baseLevel;
    enemy.hp=stats.maxHp; enemy.maxHp=stats.maxHp; enemy.atk=stats.atk; enemy.def=stats.def; enemy.xp=stats.xp;
  }
  defending=false;
  battleLocked=false;
  attackButtonCooldown=0;
  input={up:false,down:false,left:false,right:false};

  document.getElementById("battleTitle").textContent=`Lv ${enemy.level||1} ${enemy.elite?"Elite ":""}${enemy.name} Encounter`;
  document.getElementById("battleScene").dataset.kind=enemy.kind||"slime";
  document.getElementById("battleFxLayer").innerHTML="";
  showEnemyIntent(false);
  setBattleTurn("player","YOUR TURN");
  battleMessage(`${enemy.name} approaches. Choose an action.`);
  setBattleButtons(true);
  document.getElementById("battle").classList.add("show");
  updateUI();
}

function heroAttack(){
  if(!enemy||battleLocked)return;
  battleLocked=true;
  setBattleButtons(false);
  setBattleTurn("guard","HERO ATTACKS");
  battleMessage("You rush forward!");
  animateBattleActor("hero","lunge",360);

  const hitTarget=currentMob||enemy;
  const hit=Math.random()*100<playerHitChanceAgainst(hitTarget);
  const crit=hit && Math.random()<.12;
  let dmg=hit?Math.max(1,state.atk+rand(0,3)-enemy.def):0;
  if(crit)dmg*=2;

  setTimeout(()=>{
    if(!enemy)return;
    if(!hit){
      battleFloat("enemy","MISS","guard");
      battleMessage("Your attack misses.");
      setTimeout(enemyTurn,650);
      return;
    }
    enemy.hp-=dmg;
    animateBattleActor("enemy","hit",300);
    battleFloat("enemy",crit?`CRIT ${dmg}`:`-${dmg}`,crit?"crit":"damage");
    battleMessage(crit?`Critical hit! ${dmg} damage.`:`You strike for ${dmg} damage.`);
    updateUI();

    if(enemy.hp<=0){setTimeout(winBattle,650);return}
    setTimeout(enemyTurn,650);
  },190);
}

function defend(){
  if(!enemy||battleLocked)return;
  battleLocked=true;
  defending=true;
  setBattleButtons(false);
  setBattleTurn("guard","GUARDING");
  document.getElementById("heroBattleSprite").classList.add("guardGlow");
  battleFloat("hero","GUARD","guard");
  battleMessage("You brace yourself. The next hit will deal less damage.");
  setTimeout(enemyTurn,620);
}

function potion(){
  if(!enemy||battleLocked)return;
  if(state.potions<=0){battleMessage("Your potion pouch is empty.");return}
  if(state.hp>=state.maxHp){battleMessage("Your HP is already full.");return}
  battleLocked=true;
  setBattleButtons(false);
  setBattleTurn("guard","USING POTION");
  state.potions--;
  const before=state.hp;
  state.hp=Math.min(state.maxHp,state.hp+POTION_HEAL);
  const healed=state.hp-before;
  battleFloat("hero",`+${healed}`,"heal");
  battleMessage(`You drink a potion and recover ${healed} HP.`);
  updateUI();
  setTimeout(enemyTurn,700);
}

function run(){
  if(!enemy||battleLocked)return;
  if(enemy.boss){battleMessage("There is no escape from Snickers.");return}
  battleLocked=true;
  setBattleButtons(false);
  setBattleTurn("guard","ESCAPE ATTEMPT");
  battleMessage("You look for an opening...");

  setTimeout(()=>{
    if(!enemy)return;
    if(Math.random()<.68){
      if(currentMob){
        const dx=state.x-currentMob.x;
        const dy=state.y-currentMob.y;
        const len=Math.max(1,Math.hypot(dx,dy));
        state.x+=dx/len*38;
        state.y+=dy/len*38;
      }
      endBattle();
      toast("You escaped.");
    }else{
      battleMessage("No opening! The enemy cuts you off.");
      setTimeout(enemyTurn,520);
    }
  },420);
}

function enemyTurn(){
  if(!enemy)return;
  battleLocked=true;
  setBattleButtons(false);
  setBattleTurn("enemy","ENEMY TURN");
  showEnemyIntent(true,`${enemy.name} is about to attack!`);
  battleMessage(`${enemy.name} prepares a strike...`);

  setTimeout(()=>{
    if(!enemy)return;
    showEnemyIntent(false);
    animateBattleActor("enemy","lunge",360);

    setTimeout(()=>{
      if(!enemy)return;
      const hitSource=currentMob||enemy;
      const hit=Math.random()*100<mobHitChanceAgainstPlayer(hitSource);
      if(!hit){
        defending=false;
        document.getElementById("heroBattleSprite").classList.remove("guardGlow");
        battleFloat("hero","MISS","guard");
        battleMessage(`${enemy.name} misses you.`);
        setTimeout(returnPlayerTurn,650);
        return;
      }
      let dmg=Math.max(1,enemy.atk+rand(0,2)-state.def);
      if(defending)dmg=Math.max(1,Math.floor(dmg/2));
      const guarded=defending;
      defending=false;
      document.getElementById("heroBattleSprite").classList.remove("guardGlow");
      state.hp-=dmg;
      animateBattleActor("hero","hit",300);
      battleFloat("hero",`-${dmg}`,"damage");
      battleMessage(guarded?`Guard softened the blow. You take ${dmg} damage.`:`${enemy.name} hits you for ${dmg} damage.`);
      updateUI();

      if(state.hp<=0){
        state.hp=0;
        setTimeout(loseBattle,700);
        return;
      }
      setTimeout(returnPlayerTurn,650);
    },190);
  },520);
}

function winBattle(){
  if(!enemy)return;
  const e=enemy;
  let gold=rand(e.gold[0],e.gold[1]);
  if(e.elite && gold>0) gold=Math.max(1,Math.round(gold*numberOr(BALANCE.mobLevels?.eliteGoldMultiplier,1.5)));
  let potionDrop=0;
  if(e.potionDropAmount>0 && Math.random()<e.potionDropChance) potionDrop=e.potionDropAmount;
  const lootReward=rollMobLoot(currentMob||e);
  const lootPile=spawnMobLootPile(currentMob||e,lootReward.rolled,gold,potionDrop,e.elite?`Elite ${e.name}`:e.name);
  state.xp+=e.xp;
  state.kills++;

  if(e.name==="Slime") state.slimeKills++; // legacy save compatibility
  notifyQuestKill(e.configKey||e.kind||currentMob?.kind,1);
  if(e.boss)state.bossDefeated=true;

  if(currentMob){
    currentMob.alive=false;
    currentMob.respawnTimer=getMobRespawnSeconds(currentMob);
    currentMob.aggro=false;
  }

  levelCheck();
  endBattle();

  const hasLoot=lootPileHasLoot(lootPile);
  if(e.boss)toast(`You defeated Snickers!${hasLoot?" Sparkling remains hold loot.":""}`);
  else toast(`Defeated ${e.elite?"Elite ":""}${e.name}: +${e.xp} XP, ${hasLoot?"loot in sparkling remains":"no loot"}`);
  updateUI();
}

function loseBattle(){
  state.gold=Math.floor(state.gold*(1-DEATH_GOLD_LOSS));
  state.hp=state.maxHp;
  state.x=START_X;
  state.y=START_Y;
  lastSafePos={x:state.x,y:state.y};
  endBattle();
  toast("You wake up back in Oakrest.");
  updateUI();
}

function levelCheck(){
  const cap=playerLevelCap();
  const hpGain=Math.floor(numberOr(BALANCE.progression?.hpPerLevel,8));
  const atkGain=Math.floor(numberOr(BALANCE.progression?.attackPerLevel,2));
  const defGain=Math.floor(numberOr(BALANCE.progression?.defensePerLevel,1));
  if(state.level>=cap){
    state.level=cap;
    state.xp=0;
    state.xpNext=0;
    return;
  }
  if(!Number.isFinite(state.xpNext)||state.xpNext<=0) state.xpNext=xpRequiredForLevel(state.level);
  while(state.level<cap && state.xpNext>0 && state.xp>=state.xpNext){
    state.xp-=state.xpNext;
    state.level++;
    state.maxHp+=hpGain;state.hp=state.maxHp;
    state.atk+=atkGain;state.def+=defGain;
    state.xpNext=xpRequiredForLevel(state.level);
    refreshAliveMobStatsForPlayer();
    setTimeout(()=>toast(`Level up! Level ${state.level}`),650);
  }
  if(state.level>=cap){
    state.xp=0;
    state.xpNext=0;
  }
}

function endBattle(){
  enemy=null;
  currentMob=null;
  defending=false;
  battleLocked=false;
  showEnemyIntent(false);
  document.getElementById("heroBattleSprite").classList.remove("guardGlow","lunge","hit");
  document.getElementById("enemyBattleSprite").classList.remove("lunge","hit");
  setBattleButtons(true);
  document.getElementById("battle").classList.remove("show");
  updateUI();
}

function closeAll(){
  document.getElementById("menu").classList.remove("show");
  document.getElementById("battle").classList.remove("show");
  document.getElementById("backpack")?.classList.remove("show");
  closeQuestLog?.();
  closeNpcDialogue?.();
  closeLootWindow();
  cancelDisposePrompt();
}

function updateUI(){
  document.getElementById("lvl").textContent=state.level;
  document.getElementById("gold").textContent=state.gold;
  document.getElementById("hpText").textContent=`${state.hp}/${state.maxHp}`;
  const atLevelCap=state.level>=playerLevelCap();
  document.getElementById("xpText").textContent=atLevelCap?"MAX LEVEL":`${state.xp}/${state.xpNext}`;
  document.getElementById("hpFill").style.width=`${Math.max(0,100*state.hp/state.maxHp)}%`;
  document.getElementById("xpFill").style.width=atLevelCap?"100%":`${Math.min(100,100*state.xp/Math.max(1,state.xpNext))}%`;
  document.getElementById("hudAtk").textContent=state.atk;
  document.getElementById("hudDef").textContent=state.def;
  document.getElementById("hud").classList.toggle("lowHp",state.hp/state.maxHp<=0.30);

  document.getElementById("mAtk").textContent=state.atk;
  document.getElementById("mDef").textContent=state.def;
  document.getElementById("mPotions").textContent=state.potions;
  document.getElementById("mKills").textContent=state.kills;

  // Quest chip + menu summary are driven by the data-driven quest system.
  refreshQuestUI();

  if(enemy){
    const heroHp=Math.max(0,state.hp);
    const enemyHp=Math.max(0,enemy.hp);
    document.getElementById("bHeroHp").textContent=`${heroHp}/${state.maxHp}`;
    document.getElementById("bEnemyName").textContent=enemy.name;
    document.getElementById("bEnemyHp").textContent=`${enemyHp}/${enemy.maxHp}`;
    document.getElementById("bHeroHpFill").style.width=`${Math.max(0,100*heroHp/state.maxHp)}%`;
    document.getElementById("bEnemyHpFill").style.width=`${Math.max(0,100*enemyHp/enemy.maxHp)}%`;
    document.getElementById("potionCount").textContent=`(${state.potions})`;
  }

  updateBackpackHud();

  const quickPotion=document.getElementById("quickPotion");
  if(quickPotion) quickPotion.textContent=`POTION ${state.potions}`;
  updateCombatHud();
}

// v51 compact floating panels ------------------------------------------------
// Backpack and loot use lightweight, non-modal windows so the world remains
// playable while either panel is open. Positions persist locally per device.
let floatingPanelDrag=null;
let floatingPanelsBound=false;

function floatingPanelById(panelId){
  return typeof panelId==="string"?document.getElementById(panelId):panelId;
}

function constrainFloatingPanel(panelId){
  const panel=floatingPanelById(panelId);
  if(!panel||typeof panel.getBoundingClientRect!=="function") return;
  const rect=panel.getBoundingClientRect();
  if(!rect.width||!rect.height) return;
  const margin=6;
  const maxLeft=Math.max(margin,innerWidth-rect.width-margin);
  const maxTop=Math.max(margin,innerHeight-rect.height-margin);
  const currentLeft=Number.isFinite(parseFloat(panel.style.left))?parseFloat(panel.style.left):rect.left;
  const currentTop=Number.isFinite(parseFloat(panel.style.top))?parseFloat(panel.style.top):rect.top;
  panel.style.left=`${clamp(currentLeft,margin,maxLeft)}px`;
  panel.style.top=`${clamp(currentTop,margin,maxTop)}px`;
  panel.style.right="auto";
  panel.style.bottom="auto";
}

function saveFloatingPanelPosition(panel,key){
  if(!panel||!key) return;
  try{
    localStorage.setItem(key,JSON.stringify({left:parseFloat(panel.style.left)||0,top:parseFloat(panel.style.top)||0}));
  }catch(_err){}
}

function restoreFloatingPanelPosition(panel,key){
  if(!panel||!key) return;
  try{
    const saved=JSON.parse(localStorage.getItem(key)||"null");
    if(saved&&Number.isFinite(Number(saved.left))&&Number.isFinite(Number(saved.top))){
      panel.style.left=`${Number(saved.left)}px`;
      panel.style.top=`${Number(saved.top)}px`;
      panel.style.right="auto";
      panel.style.bottom="auto";
    }
  }catch(_err){}
}

function bindFloatingPanel(panelId,handleId,storageKey){
  const panel=document.getElementById(panelId);
  const handle=document.getElementById(handleId);
  if(!panel||!handle) return;
  restoreFloatingPanelPosition(panel,storageKey);

  handle.addEventListener("pointerdown",event=>{
    if(event.button!=null&&event.button!==0) return;
    if(event.target?.closest?.(".panelClose")) return;
    const rect=panel.getBoundingClientRect();
    floatingPanelDrag={
      pointerId:event.pointerId,
      panel,
      storageKey,
      startX:event.clientX,
      startY:event.clientY,
      left:rect.left,
      top:rect.top
    };
    handle.setPointerCapture?.(event.pointerId);
    panel.classList.add("panelDragging");
    event.preventDefault?.();
  });
}

function bindFloatingPanels(){
  if(floatingPanelsBound) return;
  floatingPanelsBound=true;
  bindFloatingPanel("backpackPanel","backpackDragHandle","lr-ui-backpack-position-v51");
  bindFloatingPanel("lootPanel","lootDragHandle","lr-ui-loot-position-v51");
  bindFloatingPanel("questLogPanel","questLogDragHandle","lr-ui-quest-position-v54");

  document.addEventListener("pointermove",event=>{
    const drag=floatingPanelDrag;
    if(!drag||event.pointerId!==drag.pointerId) return;
    drag.panel.style.left=`${drag.left+(event.clientX-drag.startX)}px`;
    drag.panel.style.top=`${drag.top+(event.clientY-drag.startY)}px`;
    drag.panel.style.right="auto";
    drag.panel.style.bottom="auto";
    constrainFloatingPanel(drag.panel);
    event.preventDefault?.();
  },{passive:false});

  const finish=event=>{
    const drag=floatingPanelDrag;
    if(!drag||event.pointerId!==drag.pointerId) return;
    floatingPanelDrag=null;
    drag.panel.classList.remove("panelDragging");
    constrainFloatingPanel(drag.panel);
    saveFloatingPanelPosition(drag.panel,drag.storageKey);
  };
  document.addEventListener("pointerup",finish,{passive:false});
  document.addEventListener("pointercancel",finish,{passive:false});
  window.addEventListener("resize",()=>{
    constrainFloatingPanel("backpackPanel");
    constrainFloatingPanel("lootPanel");
    constrainFloatingPanel("questLogPanel");
  });
}

function loadedWholeNumber(value,fallback,min=0){
  const fallbackValue=Math.max(min,Math.floor(numberOr(fallback,min)));
  const n=Number(value);
  if(!Number.isFinite(n)) return fallbackValue;
  const whole=Math.floor(n);
  return whole>=min?whole:fallbackValue;
}

function normalizeLoadedState(raw){
  const base=fresh();
  const source=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
  const next={...base,...source};

  next.level=Math.min(playerLevelCap(),loadedWholeNumber(source.level,base.level,1));
  next.xp=loadedWholeNumber(source.xp,base.xp,0);
  // XP requirements are derived from the active 1-100 progression table so
  // older saves automatically migrate off the pre-v59 geometric curve.
  next.xpNext=xpRequiredForLevel(next.level);
  if(next.level>=playerLevelCap()) next.xp=0;
  next.maxHp=loadedWholeNumber(source.maxHp,base.maxHp,1);
  next.hp=clamp(loadedWholeNumber(source.hp,base.hp,0),0,next.maxHp);
  next.atk=loadedWholeNumber(source.atk,base.atk,0);
  next.def=loadedWholeNumber(source.def,base.def,0);
  next.gold=loadedWholeNumber(source.gold,base.gold,0);
  next.potions=loadedWholeNumber(source.potions,base.potions,0);
  next.kills=loadedWholeNumber(source.kills,base.kills,0);
  next.slimeKills=loadedWholeNumber(source.slimeKills,base.slimeKills,0);
  next.questComplete=booleanOr(source.questComplete,base.questComplete);
  next.bossDefeated=booleanOr(source.bossDefeated,base.bossDefeated);
  next.quests=source.quests&&typeof source.quests==="object"&&!Array.isArray(source.quests)?source.quests:{};
  next.inventory=Array.isArray(source.inventory)?source.inventory:base.inventory;

  const x=numberOr(source.x,base.x);
  const y=numberOr(source.y,base.y);
  if(Number.isFinite(x)&&Number.isFinite(y)&&canStand(x,y)){
    next.x=x;
    next.y=y;
  }else{
    next.x=base.x;
    next.y=base.y;
  }
  return next;
}

function save(){
  try{
    localStorage.setItem("littleRealmMobileSaveV3",JSON.stringify({...state}));
    toast("Game saved.");
    return true;
  }catch(_err){
    toast("Could not save game on this device.");
    return false;
  }
}

function load(){
  let raw;
  try{
    raw=localStorage.getItem("littleRealmMobileSaveV3");
  }catch(_err){
    toast("Could not access saved games on this device.");
    return false;
  }
  if(!raw){toast("No v3 save found.");return false}

  try{
    state=normalizeLoadedState(JSON.parse(raw));
    ensureInventoryState();
    lastSafePos={x:state.x,y:state.y};
    enemy=null;
    currentMob=null;
    combatTarget=null;
    selectedTarget=null;
    combatFx=[];
    combatHudSignature="";
    attackButtonCooldown=0;
    input={up:false,down:false,left:false,right:false};
    spawnMobs();
    clearLootPiles();
    closeAll();
    updateUI();
    toast("Game loaded.");
    return true;
  }catch(_err){
    toast("Could not load save.");
    return false;
  }
}

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
  interact:bindingList("interact",["KeyE"]),
  potion:bindingList("potion",["KeyQ"]),
  clearTarget:bindingList("clearTarget",["Escape"]),
  menu:bindingList("menu",["KeyM"]),
  backpack:bindingList("backpack",["KeyI","KeyB"])
};

// Exposed only as read-only diagnostics so a desktop tester can confirm the
// deployed build from DevTools without digging through bundled source.
window.LR_BUILD_VERSION="v61-mob-leashing";
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
    compact.textContent=`PC CONTROLS  •  MOVE ${bindingLabel("moveUp")}/${bindingLabel("moveLeft")}/${bindingLabel("moveDown")}/${bindingLabel("moveRight")}  •  TALK ${bindingLabel("interact")}  •  TARGET ${bindingLabel("targetNext")}  •  ATTACK ${bindingLabel("attackTarget")}  •  POTION ${bindingLabel("potion")}  •  PACK ${bindingLabel("backpack")}  •  MENU ${bindingLabel("menu")}`;
  }
  const list=document.getElementById("keybindList");
  if(list){
    list.innerHTML=`<b>PC Controls</b><br>Move: ${bindingLabel("moveUp")} / ${bindingLabel("moveLeft")} / ${bindingLabel("moveDown")} / ${bindingLabel("moveRight")}<br>Talk / interact: ${bindingLabel("interact")}<br>Target next mob: ${bindingLabel("targetNext")}<br>Attack target: ${bindingLabel("attackTarget")}<br>Quick potion: ${bindingLabel("potion")}<br>Backpack: ${bindingLabel("backpack")}<br>Clear target / leave combat: ${bindingLabel("clearTarget")}<br>Menu: ${bindingLabel("menu")}`;
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
    }else if(keyMatches("interact",event)){
      event.preventDefault();
      interactWithNearestNpc();
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
      const npcDialog=document.getElementById("npcDialog");
      if(disposePrompt.classList.contains("show")) cancelDisposePrompt();
      else if(npcDialog?.classList.contains("show")) closeNpcDialogue();
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

function frame(now){
  const dt=Math.min(.033,(now-lastFrame)/1000);
  lastFrame=now;
  updateMovement(dt);
  updateLootPiles(now);
  updateMobs(dt);
  updateOpenCombat(dt);
  if(isHeroMoving) moveAnimTime+=dt;
  drawWorld();
  requestAnimationFrame(frame);
}

// One-time startup. Keep gameplay functions in their owning source modules above.
buildWorld();
buildScenery();
window.addEventListener("resize",resize);
resize();

bindHold("up","up");
bindHold("down","down");
bindHold("left","left");
bindHold("right","right");

bindKeyboardControls();
initDeveloperMode();

document.getElementById("actionHint").innerHTML="SELECT MOB<br>TO TARGET";
document.getElementById("actionHint").onclick=()=>{
  if(combatTarget){disengageCombat();return}
  if(attackButtonCooldown>0){
    toast(`Attack ready in ${attackButtonCooldown.toFixed(1)}s.`);
    return;
  }
  const target=(selectedTarget&&selectedTarget.alive)?selectedTarget:findNearestMob(MAX_ENGAGE_RANGE);
  if(target) engageMob(target);
  else toast("Click/tap a mob to target it first.");
};
document.getElementById("quickPotion").onclick=useQuickPotion;

document.getElementById("backpackBtn").onclick=toggleBackpack;
document.getElementById("questChip").onclick=toggleQuestLog;
document.getElementById("closeQuestLog").onclick=closeQuestLog;
document.getElementById("closeNpcDialog").onclick=closeNpcDialogue;
document.getElementById("closeBackpack").onclick=closeBackpack;
document.getElementById("inventoryGrid").onclick=handleInventoryGridClick;
document.getElementById("lootGrid").onclick=handleLootGridClick;
document.getElementById("takeAllLoot")?.addEventListener("click",takeAllLoot);
document.getElementById("closeLootWindow").onclick=closeLootWindow;
document.getElementById("disposeCancel").onclick=cancelDisposePrompt;
document.getElementById("disposeConfirm").onclick=confirmDisposePrompt;
bindInventoryInteractions();
bindLootInteractions();
bindFloatingPanels();
game.addEventListener("pointerdown",handleWorldTap);
document.getElementById("menuBtn").onclick=()=>{
  input={up:false,down:false,left:false,right:false};
  isHeroMoving=false;
  document.getElementById("menu").classList.add("show");
};
document.getElementById("closeMenu").onclick=()=>document.getElementById("menu").classList.remove("show");
document.getElementById("saveBtn").onclick=save;
document.getElementById("loadBtn").onclick=load;
document.getElementById("newBtn").onclick=()=>{
  if(confirm("Start a new game?"))reset();
};
document.getElementById("fullBtn").onclick=async()=>{
  try{
    if(!document.fullscreenElement)await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
    document.getElementById("menu").classList.remove("show");
  }catch(e){toast("Fullscreen isn't available in this browser.");}
};
document.getElementById("attackBtn").onclick=heroAttack;
document.getElementById("defendBtn").onclick=defend;
document.getElementById("potionBtn").onclick=potion;
document.getElementById("runBtn").onclick=run;

reset();
requestAnimationFrame(frame);
})();
