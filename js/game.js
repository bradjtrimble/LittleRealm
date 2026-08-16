window.addEventListener("error", (event) => {
  console.error("Little Realm error:", event.error || event.message);
});

(() => {
const BALANCE = window.LR_BALANCE || {};
const PROJECT_WORLD_OBJECTS = window.LR_WORLD_OBJECTS || [];
const VISUAL_CONFIG = window.LR_VISUAL || {};

function visualScaleOr(value,fallback=1){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(0.5,Math.min(3.0,n)):fallback;
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
    stackLimit:Math.max(1,Math.floor(numberOr(raw.stackLimit,INVENTORY_DEFAULT_STACK_LIMIT))),
    category:typeof raw.category==="string"?raw.category:"Item"
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
    return `<button class="inventorySlot${selectedInventorySlot===index?" selected":""}" data-slot="${index}" aria-label="${inventoryEscape(def.name)}, quantity ${slot.qty}"><span class="itemSymbol">${inventoryEscape(def.symbol)}</span><span class="itemQty">${slot.qty}</span></button>`;
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
  details.innerHTML=`<div class="inventoryDetailTitle"><span class="detailSymbol">${inventoryEscape(def.symbol)}</span><span>${inventoryEscape(def.name)}</span><b>×${slot.qty}</b></div><div class="inventoryDetailMeta">${inventoryEscape(def.category)} • Stack ${slot.qty}/${def.stackLimit}</div><div class="inventoryDetailDescription">${inventoryEscape(def.description||"No description yet.")}</div>`;
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
const MOB_SPAWN_TILES = new Set([
  "18,5","21,4","24,6","19,8","22,9","26,5",
  "34,6","37,5","39,8","35,9","40,6",
  "15,17","21,16","27,19","32,23","18,26","25,27","33,18","39,21",
  "4,20","8,22","6,21","9,20","5,23","7,19","9,23"
]);

function addSolidRect(x,y,w,h,type="solid"){
  solidRects.push({x,y,w,h,type});
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

  // Future vendor / quest-giver placeholders. They are intentionally simple
  // NPCs now; interaction behavior can be added later without redesigning town.
  sceneryNPCs.push(
    {x:5*TILE+18,y:5*TILE+12,name:"Mara",role:"Shopkeeper",shirt:"#b85c4a"},
    {x:8*TILE+20,y:5*TILE+24,name:"Eldon",role:"Villager",shirt:"#4e79a7"},
    {x:5*TILE+4,y:8*TILE+18,name:"Rhea",role:"Quest Giver",shirt:"#6e9c5e"},
    {x:10*TILE+16,y:8*TILE+10,name:"Torren",role:"Blacksmith",shirt:"#8a6651"},
    {x:4*TILE+22,y:20*TILE+28,name:"Farmer",role:"Farmer",shirt:"#b28b43"}
  );
  for(const npc of sceneryNPCs) addSolidRect(npc.x-6,npc.y-7,12,14,"npc");
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

function drawNpcObject(obj,camX,camY){
  const x=Math.round(obj.x-camX), y=Math.round(obj.y-camY);
  ctx.save(); ctx.imageSmoothingEnabled=false;
  ctx.translate(x,y+15);
  ctx.scale(VISUAL_SCALE.npcs,VISUAL_SCALE.npcs);
  ctx.translate(-x,-(y+15));
  ctx.fillStyle="rgba(0,0,0,.18)"; ctx.fillRect(x-6,y+8,12,3);
  ctx.fillStyle="#d9ad84"; ctx.fillRect(x-5,y-11,10,9);
  ctx.fillStyle="#5a3d2d"; ctx.fillRect(x-6,y-13,12,4); ctx.fillRect(x-6,y-9,2,5);
  ctx.fillStyle=obj.shirt||"#627e9b"; ctx.fillRect(x-6,y-2,12,10);
  ctx.fillStyle="#3b2e29"; ctx.fillRect(x-5,y+8,4,7); ctx.fillRect(x+1,y+8,4,7);
  ctx.fillStyle="#202020"; ctx.fillRect(x-3,y-7,1,1); ctx.fillRect(x+2,y-7,1,1);
  if(obj.role==="Quest Giver"){
    ctx.fillStyle="#ffd45b"; ctx.font="900 12px system-ui"; ctx.textAlign="center"; ctx.fillText("!",x,y-18); ctx.textAlign="start";
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
    ctx.fillStyle=fx.kind==="heal"?"#72ef9a":fx.kind==="crit"?"#ffd15a":"#fff1e2";
    ctx.strokeStyle="rgba(0,0,0,.75)";
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
  const renderables=[];

  for(const tree of sceneryTrees){
    const sx=tree.x-camX, sy=tree.y-camY;
    if(sx<-120||sy<-130||sx>viewW+120||sy>viewH+90) continue;
    renderables.push({kind:"tree",depth:tree.y+58,obj:tree});
  }

  for(const house of sceneryHouses){
    const sx=house.x-camX, sy=house.y-camY;
    if(sx<-house.spec.w||sy<-house.spec.h||sx>viewW+60||sy>viewH+60) continue;
    renderables.push({kind:"house",depth:house.y+house.spec.h-5,obj:house});
  }

  for(const fence of sceneryFences){
    const sx=fence.x-camX, sy=fence.y-camY;
    if(sx<-100||sy<-100||sx>viewW+100||sy>viewH+100) continue;
    renderables.push({kind:"fence",depth:fence.y+35,obj:fence});
  }
  for(const sign of scenerySigns){
    const sx=sign.x-camX, sy=sign.y-camY;
    if(sx<-80||sy<-80||sx>viewW+80||sy>viewH+80) continue;
    renderables.push({kind:"sign",depth:sign.y+40,obj:sign});
  }
  for(const prop of sceneryProps){
    const sx=prop.x-camX, sy=prop.y-camY;
    if(sx<-180||sy<-100||sx>viewW+180||sy>viewH+120) continue;
    renderables.push({kind:"prop",depth:prop.y+(prop.type==="blockedGate"?62:prop.type==="caveEntrance"?((prop.h||160)-10):36),obj:prop});
  }
  for(const npc of sceneryNPCs){
    const sx=npc.x-camX, sy=npc.y-camY;
    if(sx<-60||sy<-80||sx>viewW+60||sy>viewH+60) continue;
    renderables.push({kind:"npc",depth:npc.y+15,obj:npc});
  }

  for(const mob of mobs){
    if(!mob.alive) continue;
    const sx=mob.x-camX, sy=mob.y-camY;
    if(sx<-60||sy<-60||sx>viewW+60||sy>viewH+60) continue;
    renderables.push({kind:"mob",depth:mob.y,obj:mob});
  }

  renderables.push({kind:"hero",depth:state.y,obj:null});
  renderables.sort((a,b)=>a.depth-b.depth);

  for(const item of renderables){
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
    }else if(item.kind==="mob"){
      const mob=item.obj;
      let sx=mob.x-camX, sy=mob.y-camY;

      const mScale=mobVisualScale(mob);
      if(mob===selectedTarget || mob===combatTarget){
        ctx.strokeStyle=mob===combatTarget?"rgba(255,154,92,.96)":"rgba(255,220,96,.96)";
        ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(sx,sy+12,(mob.boss?25:18)*mScale,(mob.boss?10:7)*mScale,0,0,Math.PI*2);ctx.stroke();
      }

      if((mob.attackAnim||0)>0 && mob===combatTarget){
        const phase=Math.sin((1-mob.attackAnim/.20)*Math.PI);
        const dx=state.x-mob.x,dy=state.y-mob.y,len=Math.max(1,Math.hypot(dx,dy));
        sx+=dx/len*6*phase; sy+=dy/len*6*phase;
      }

      ctx.fillStyle="rgba(0,0,0,.20)";
      ctx.beginPath();ctx.ellipse(sx,sy+12,13,5,0,0,Math.PI*2);ctx.fill();
      drawMob(ctx,mob,sx,sy);

      if(mob===combatTarget || mob===selectedTarget || mob.hp<mob.maxHp){
        const hpY=sy-(mob.boss?38:29)*mScale;
        ctx.save();
        ctx.font=mob.boss?"900 8px system-ui":"800 7px system-ui";
        ctx.textAlign="center";
        ctx.fillStyle=mobLevelColor(mob.level,mob.boss);
        ctx.fillText(`Lv ${mob.level}`,Math.round(sx),Math.round(hpY-5));
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

const DEV_DRAFT_KEY = "littleRealmWorldBuilderDraftV1";
let devModeActive=false;
let devPanel=null;
let devSelected=null;
let devPlaceType=null;
let devDragging=false;
let devDragOffset={x:0,y:0};
let devShowGrid=true;
let devShowHitboxes=true;
let devSnap=8;
let devStatusTimer=null;
let devSelectedMob=null;
let devActiveTab="objects";

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
    #devPanel .devTabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.1);background:#211a28}
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
    #devPanel #devObjectList{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;max-height:260px;overflow:auto}
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
    #devPanel #devInspector input[type=text],#devPanel #devInspector input[type=number],#devPanel #devInspector input:not([type]){width:100%;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:7px;padding:8px}
    #devPanel .devChecks{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px} #devPanel .devChecks label{flex-direction:row!important;align-items:center!important;background:#2b2432;padding:8px;border-radius:7px}
    #devPanel .devPair{display:grid;grid-template-columns:1fr 1fr;gap:9px} #devPanel .devQuad{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
    #devPanel .devSubhead{font-weight:800;margin-top:10px;color:#c9b9d2} #devPanel .devRow{display:flex;gap:7px;margin-top:10px} #devPanel .devRow button{flex:1} #devPanel .devRow .danger{background:#713b47}
    #devPanel .devProjectActions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px} #devPanel .devProjectActions button:first-child{grid-column:1/-1;background:#38606a}
    #devPanel #devStatus{padding:9px 12px;background:#1d1822;color:#bdb0c5;font-size:11px;border-top:1px solid rgba(255,255,255,.08)}
    body.devMode #pcControls{opacity:.25}
    @media(max-width:1100px){#devPanel{width:min(650px,68vw)!important}#devPanel #devPalette{grid-template-columns:repeat(5,minmax(0,1fr))!important}}
    @media(max-width:760px){#devPanel{width:calc(100vw - 12px)!important;right:6px!important;top:6px!important;height:calc(100vh - 12px)!important}#devPanel #devPalette{grid-template-columns:repeat(4,minmax(0,1fr))!important}#devPanel #devObjectList{grid-template-columns:repeat(2,minmax(0,1fr))}#devPanel #devScalePanel{grid-template-columns:1fr}.devQuad{grid-template-columns:repeat(2,1fr)!important}}
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


function saveDeveloperDraft(){
  try{
    localStorage.setItem(DEV_DRAFT_KEY,JSON.stringify(sceneryProps));
    devSetStatus("Draft autosaved locally");
  }catch(err){ console.warn("Could not save developer draft",err); }
}

function loadDeveloperDraft(){
  try{
    const raw=localStorage.getItem(DEV_DRAFT_KEY);
    if(!raw){devSetStatus("No local draft found");return;}
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed)) throw new Error("Draft is not an array");
    sceneryProps.splice(0,sceneryProps.length,...parsed.map(cloneWorldObject));
    devSelected=null;
    rebuildWorldObjectCollision();
    refreshDeveloperPanel();
    devSetStatus(`Loaded ${sceneryProps.length} draft objects`);
  }catch(err){
    console.error(err); devSetStatus("Draft could not be loaded");
  }
}

function resetDeveloperLayout(){
  if(!confirm("Reset the live editor to the project layout? Your local draft will remain until you overwrite it.")) return;
  sceneryProps.splice(0,sceneryProps.length,...getProjectWorldObjects());
  devSelected=null;
  rebuildWorldObjectCollision();
  refreshDeveloperPanel();
  devSetStatus("Project layout restored");
}

function exportDeveloperLayout(){
  const clean=sceneryProps.map(cloneWorldObject);
  const text=`/* Exported from Little Realm Developer Mode */\nwindow.LR_WORLD_OBJECTS = ${JSON.stringify(clean,null,2)};\n`;
  const blob=new Blob([text],{type:"text/javascript"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download="world-objects.js";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  devSetStatus("Exported world-objects.js");
}

function devSetStatus(text){
  if(!devPanel) return;
  const el=devPanel.querySelector("#devStatus");
  if(el) el.textContent=text;
  clearTimeout(devStatusTimer);
  devStatusTimer=setTimeout(()=>{if(el)el.textContent="F2 toggles World Builder";},2200);
}

function placeDeveloperObject(type,wx,wy){
  const spec=worldObjectSpec({type});
  if(!spec) return;
  const obj=defaultWorldObject(type,snapDev(wx-spec.w/2),snapDev(wy-spec.h/2));
  sceneryProps.push(obj);
  devSelected=obj;
  devSelectedMob=null;
  setDeveloperTab("selection");
  rebuildWorldObjectCollision();
  saveDeveloperDraft();
  refreshDeveloperPanel();
}

function devPointerDown(event){
  if(!devModeActive) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const p=devWorldFromPointer(event);
  if(devPlaceType){
    placeDeveloperObject(devPlaceType,p.x,p.y);
    return;
  }

  const mob=findDeveloperMobAt(p.x,p.y);
  if(mob){
    devSelectedMob=mob;
    devSelected=null;
    devDragging=false;
    setDeveloperTab("scale");
    refreshDeveloperPanel();
    devSetStatus(`${mobTypeScaleLabel(mobTypeScaleKey(mob))} selected — scale changes affect every ${mobTypeScaleLabel(mobTypeScaleKey(mob)).toLowerCase()}`);
    return;
  }

  devSelectedMob=null;
  devSelected=findWorldObjectAt(p.x,p.y);
  if(devSelected){
    setDeveloperTab("selection");
    devDragging=true;
    devDragOffset={x:p.x-devSelected.x,y:p.y-devSelected.y};
    try{ game.setPointerCapture?.(event.pointerId); }catch{}
    devSetStatus(`Selected ${devSelected.label||devSelected.type} — drag to move`);
  }else{
    devSetStatus("Nothing selected — use Objects to place props, or click a mob to tune its type scale");
  }
  refreshDeveloperPanel();
}
function devPointerMove(event){
  if(!devModeActive || !devDragging || !devSelected) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const p=devWorldFromPointer(event);
  devSelected.x=snapDev(p.x-devDragOffset.x);
  devSelected.y=snapDev(p.y-devDragOffset.y);
  rebuildWorldObjectCollision();
  refreshDeveloperInspectorValues();
}
function devPointerUp(event){
  if(!devModeActive || !devDragging) return;
  event.preventDefault(); event.stopImmediatePropagation();
  devDragging=false;
  try{ game.releasePointerCapture?.(event.pointerId); }catch{}
  saveDeveloperDraft();
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
  }
  if(devSelected){
    const spec=worldObjectSpec(devSelected);
    if(spec){
      const x=devSelected.x-camX,y=devSelected.y-camY;
      ctx.strokeStyle="#63e6ff";
      ctx.lineWidth=2/CAMERA_ZOOM;
      ctx.strokeRect(x-2,y-2,spec.w+4,spec.h+4);
    }
  }
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
  rebuildWorldObjectCollision();
  saveDeveloperDraft();
  refreshDeveloperPanel(false);
}

function refreshDeveloperInspectorValues(){
  if(!devPanel||!devSelected) return;
  const q=id=>devPanel.querySelector(`#${id}`);
  if(q("devX")) q("devX").value=Math.round(devSelected.x);
  if(q("devY")) q("devY").value=Math.round(devSelected.y);
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
      devPlaceType=null;
      devSelectedMob=null;
      devSelected=obj;
      setDeveloperTab("selection");
      updateDevPaletteActive();
      refreshDeveloperPanel();
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
  refreshDeveloperMobPanel();
  if(!devSelected){
    inspector.innerHTML='<div class="devEmpty">Select an object in the world or choose a prop from the palette and click to place it.</div>';
    return;
  }
  const hb=devSelected.hitbox||{x:0,y:0,w:16,h:12};
  inspector.innerHTML=`
    <div class="devSelectedTitle">${devSelected.type}</div>
    <label>Label<input id="devLabel" value="${String(devSelected.label||devSelected.type).replace(/"/g,"&quot;")}"></label>
    <div class="devPair"><label>X<input id="devX" type="number" value="${Math.round(devSelected.x)}"></label><label>Y<input id="devY" type="number" value="${Math.round(devSelected.y)}"></label></div>
    <div class="devChecks"><label><input id="devSolid" type="checkbox" ${devSelected.solid?"checked":""}> Hitbox / Solid</label><label><input id="devInteractable" type="checkbox" ${devSelected.interactable?"checked":""}> Interactable</label><label><input id="devContainer" type="checkbox" ${devSelected.container?"checked":""}> Container</label></div>
    <div class="devSubhead">Hitbox offset / size</div>
    <div class="devQuad"><label>X<input id="devHbX" type="number" value="${hb.x}"></label><label>Y<input id="devHbY" type="number" value="${hb.y}"></label><label>W<input id="devHbW" type="number" value="${hb.w}"></label><label>H<input id="devHbH" type="number" value="${hb.h}"></label></div>
    <label>Container slots<input id="devCapacity" type="number" min="0" value="${devSelected.capacity||0}"></label>
    <div class="devRow"><button id="devApply">Apply</button><button id="devDuplicate">Duplicate</button><button id="devDelete" class="danger">Delete</button></div>`;
  inspector.querySelector("#devApply").onclick=applyDeveloperInspector;
  inspector.querySelector("#devDuplicate").onclick=duplicateDeveloperSelection;
  inspector.querySelector("#devDelete").onclick=deleteDeveloperSelection;
}

function updateVisualScaleControl(key,value){
  const n=Math.max(0.5,Math.min(3.0,Number(value)||1));
  VISUAL_SCALE[key]=Math.round(n*100)/100;
  if(devPanel){
    const out=devPanel.querySelector(`[data-scale-value="${key}"]`);
    if(out) out.textContent=VISUAL_SCALE[key].toFixed(2)+"×";
  }
}

function setMobTypeScale(key,value){
  if(!key || !Object.prototype.hasOwnProperty.call(MOB_TYPE_SCALE,key)) return;
  const n=Math.max(0.5,Math.min(3.0,Number(value)||1));
  MOB_TYPE_SCALE[key]=Math.round(n*100)/100;
  refreshDeveloperMobPanel();
}

function selectDeveloperMobType(key){
  const match=mobs.find(m=>mobTypeScaleKey(m)===key) || {kind:key,boss:key==="snickers",alive:false};
  devSelectedMob=match;
  devSelected=null;
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
        <input id="devSelectedMobScale" type="range" min="0.50" max="3.00" step="0.05" value="${value}">
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
  const settings={...VISUAL_SCALE,mobTypes:{...MOB_TYPE_SCALE}};
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
  if(!devPanel) return;
  devPanel.querySelectorAll("[data-scale-key]").forEach(input=>{
    input.value=VISUAL_SCALE[input.dataset.scaleKey];
    updateVisualScaleControl(input.dataset.scaleKey,input.value);
  });
  refreshDeveloperMobPanel();
  devSetStatus("Visual scale reset to project settings");
}

function buildDeveloperPanel(){
  ensureDeveloperStyles();
  const root=document.createElement("aside");
  root.id="devPanel";
  root.innerHTML=`
    <div class="devHeader"><div><b>WORLD BUILDER</b><span>F2 to close • click a mob to tune only that type</span></div><button id="devClose">×</button></div>
    <div class="devToolbar">
      <button id="devSelect" class="active">Select / Move</button>
      <label>Snap <select id="devSnap"><option>4</option><option selected>8</option><option>16</option><option>32</option><option>64</option></select></label>
      <label><input id="devGrid" type="checkbox" checked> Grid</label>
      <label><input id="devHitboxes" type="checkbox" checked> Hitboxes</label>
    </div>
    <div class="devTabs">
      <button class="devTab active" data-dev-tab="objects">Objects</button>
      <button class="devTab" data-dev-tab="selection">Selection</button>
      <button class="devTab" data-dev-tab="scale">Visual Scale</button>
    </div>
    <div class="devBody">
      <section class="devView active" data-dev-view="objects">
        <div class="devSection"><div class="devSectionTitle">Prop Palette</div><div class="devHint">Choose a prop, then click the world to place it. Switch back to Select / Move when finished.</div><div id="devPalette"></div></div>
        <div class="devSection"><div class="devSectionTitle">Existing Objects <span id="devObjectCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><div id="devObjectList"></div></div>
      </section>
      <section class="devView" data-dev-view="selection">
        <div class="devSection"><div class="devSectionTitle">Selected Object</div><div class="devHint">Click an object in the world or choose it from Existing Objects. Drag it directly in the world to reposition it.</div><div id="devInspector"></div></div>
        <div class="devSection"><div class="devSectionTitle">Layout File</div><div class="devProjectActions"><button id="devExport">Export world-objects.js</button><button id="devLoadDraft">Load Local Draft</button><button id="devReset">Use Project Layout</button></div></div>
      </section>
      <section class="devView" data-dev-view="scale">
        <div class="devSection"><div class="devSectionTitle">Selected Mob Type</div><div class="devHint">Click a mob in the world. This slider changes only that mob type — for example, selecting a Wolf changes Wolves without changing Goblins or Slimes.</div><div id="devMobScalePanel"></div></div>
        <div class="devSection"><div class="devSectionTitle">World Visual Scale</div><div class="devHint">These controls change broad world elements. Mob species are controlled separately above.</div><div id="devScalePanel">
          <div class="devScaleControl"><div class="devScaleTop"><span>Player</span><span data-scale-value="player"></span></div><input data-scale-key="player" type="range" min="0.50" max="3.00" step="0.05" value="${VISUAL_SCALE.player}"></div>
          <div class="devScaleControl"><div class="devScaleTop"><span>Houses</span><span data-scale-value="houses"></span></div><input data-scale-key="houses" type="range" min="0.50" max="3.00" step="0.05" value="${VISUAL_SCALE.houses}"></div>
          <div class="devScaleControl"><div class="devScaleTop"><span>NPCs</span><span data-scale-value="npcs"></span></div><input data-scale-key="npcs" type="range" min="0.50" max="3.00" step="0.05" value="${VISUAL_SCALE.npcs}"></div>
          <div class="devScaleControl"><div class="devScaleTop"><span>Props</span><span data-scale-value="props"></span></div><input data-scale-key="props" type="range" min="0.50" max="3.00" step="0.05" value="${VISUAL_SCALE.props}"></div>
        </div><div class="devRow"><button id="devExportScale">Export visual-settings.js</button><button id="devResetScale">Reset Scale Settings</button></div></div>
      </section>
    </div>
    <div id="devStatus">F2 toggles World Builder</div>`;
  document.body.appendChild(root);
  devPanel=root;
  root.querySelector("#devClose").onclick=()=>setDeveloperMode(false);
  root.querySelector("#devSelect").onclick=()=>{devPlaceType=null;updateDevPaletteActive();devSetStatus("Select / Move mode");};
  root.querySelector("#devSnap").onchange=e=>{devSnap=Number(e.target.value)||8;};
  root.querySelector("#devGrid").onchange=e=>{devShowGrid=e.target.checked;};
  root.querySelector("#devHitboxes").onchange=e=>{devShowHitboxes=e.target.checked;};
  root.querySelector("#devExport").onclick=exportDeveloperLayout;
  root.querySelector("#devLoadDraft").onclick=loadDeveloperDraft;
  root.querySelector("#devReset").onclick=resetDeveloperLayout;
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
    b.onclick=()=>{devPlaceType=type;devSelectedMob=null;setDeveloperTab("objects");updateDevPaletteActive();devSetStatus(`Placing ${type} — click the world`);};
    palette.appendChild(b);
    drawPaletteThumb(cv,type);
  }
  if(!propAtlasReady) propAtlas.addEventListener("load",()=>root.querySelectorAll(".devPropButton").forEach(b=>drawPaletteThumb(b.querySelector("canvas"),b.dataset.type)),{once:true});
  setDeveloperTab(devActiveTab);
  refreshDeveloperPanel();
  devSetStatus(`${propTypes.length} props • ${sceneryProps.length} objects • click mobs for per-type scale`);
  return root;
}
function updateDevPaletteActive(){
  if(!devPanel)return;
  devPanel.querySelectorAll(".devPropButton").forEach(b=>b.classList.toggle("active",b.dataset.type===devPlaceType));
  devPanel.querySelector("#devSelect")?.classList.toggle("active",!devPlaceType);
}

function setDeveloperMode(active){
  devModeActive=!!active;
  if(!devPanel) buildDeveloperPanel();
  devPanel.classList.toggle("show",devModeActive);
  document.body.classList.toggle("devMode",devModeActive);
  input={up:false,down:false,left:false,right:false};
  isHeroMoving=false;
  if(!devModeActive){devDragging=false;devPlaceType=null;}
  updateDevPaletteActive();
  if(devModeActive) devSetStatus("Developer Mode active — use tabs for objects, selection, and mob-specific scale");
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
      if(devPlaceType){devPlaceType=null;updateDevPaletteActive();devSetStatus("Select / Move mode");}
      else if(devSelected){devSelected=null;refreshDeveloperPanel();}
      return;
    }
    if((event.code==="Delete"||event.code==="Backspace") && devSelected && !["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)){
      event.preventDefault();deleteDeveloperSelection();
    }
  },true);
}

function fresh(){
  return {
    x:START_X,
    y:START_Y,
    level:1,xp:0,xpNext:numberOr(BALANCE.progression?.startingXpToLevel,25),
    hp:numberOr(BALANCE.player?.maxHp,30),maxHp:numberOr(BALANCE.player?.maxHp,30),
    atk:numberOr(BALANCE.player?.attack,5),def:numberOr(BALANCE.player?.defense,1),
    gold:numberOr(BALANCE.player?.startingGold,8),potions:numberOr(BALANCE.player?.startingPotions,2),kills:0,
    slimeKills:0,questComplete:false,bossDefeated:false,
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
  if(document.getElementById("menu").classList.contains("show") || document.getElementById("backpack").classList.contains("show")) {
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
    name,kind,boss,
    baseLevel:Math.max(1,Math.floor(numberOr(cfg.baseLevel,fallback.baseLevel||1))),
    levelMin:Math.max(1,Math.floor(numberOr(cfg.levelMin,cfg.baseLevel??fallback.baseLevel??1))),
    levelMax:Math.max(1,Math.floor(numberOr(cfg.levelMax,cfg.baseLevel??fallback.baseLevel??1))),
    hp:numberOr(cfg.hp,fallback.hp),
    atk:numberOr(cfg.attack,fallback.atk),
    def:numberOr(cfg.defense,fallback.def),
    xp:numberOr(cfg.xp,fallback.xp),
    gold:[numberOr(cfg.goldMin,fallback.gold[0]),numberOr(cfg.goldMax,fallback.gold[1])],
    goldDropChance:percentOr(cfg.goldDropChancePercent,100),
    potionDropChance:percentOr(cfg.potionDropChancePercent,0),
    potionDropAmount:Math.max(0,Math.floor(numberOr(cfg.potionDropAmount,1))),
    attackInterval:numberOr(cfg.attackIntervalSeconds,fallback.attackInterval),
    respawnMin:numberOr(cfg.respawnMinSeconds,18),
    respawnMax:numberOr(cfg.respawnMaxSeconds,28),
    aggressive:booleanOr(cfg.aggressive,fallback.aggressive),
    aggroTriggerRange:numberOr(cfg.aggroTriggerRange,58),
    alertRange:numberOr(cfg.alertRange,82),
    chaseSpeed:numberOr(cfg.chaseSpeed,fallback.chaseSpeed),
    wanderSpeed:numberOr(cfg.wanderSpeed,fallback.wanderSpeed),
    leashDistance:numberOr(cfg.leashDistance,120),
    leashSpeed:numberOr(cfg.leashSpeed,34),
    wanderDelayMin:numberOr(cfg.wanderDelayMinSeconds,1.2),
    wanderDelayMax:numberOr(cfg.wanderDelayMaxSeconds,4.0)
  };
}

const enemyTemplates = [
  createMobTemplate("Slime","slime","slime",{baseLevel:2,hp:14,atk:4,def:0,xp:8,gold:[2,5],attackInterval:1.45,aggressive:false,chaseSpeed:45,wanderSpeed:20}),
  createMobTemplate("Goblin","goblin","goblin",{baseLevel:4,hp:20,atk:6,def:1,xp:13,gold:[4,8],attackInterval:1.45,aggressive:true,chaseSpeed:58,wanderSpeed:20}),
  createMobTemplate("Wolf","wolf","wolf",{baseLevel:5,hp:18,atk:7,def:1,xp:14,gold:[3,7],attackInterval:1.33,aggressive:true,chaseSpeed:72,wanderSpeed:30}),
  createMobTemplate("Cow","cow","cow",{baseLevel:2,hp:12,atk:1,def:0,xp:4,gold:[0,0],attackInterval:1.8,aggressive:false,chaseSpeed:28,wanderSpeed:12}),
  createMobTemplate("Pig","pig","pig",{baseLevel:1,hp:8,atk:1,def:0,xp:3,gold:[0,0],attackInterval:1.8,aggressive:false,chaseSpeed:30,wanderSpeed:14}),
  createMobTemplate("Chicken","chicken","chicken",{baseLevel:1,hp:4,atk:1,def:0,xp:2,gold:[0,0],attackInterval:1.7,aggressive:false,chaseSpeed:34,wanderSpeed:18})
];
const bossTemplate = createMobTemplate("Snickers","boss","snickers",{baseLevel:8,hp:70,atk:10,def:3,xp:55,gold:[35,55],attackInterval:1.55,aggressive:true,chaseSpeed:52,wanderSpeed:0},true);

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

function mobLevelColor(level,boss=false){
  if(boss) return "#ff6b5f";
  const delta=level-state.level;
  if(delta>=4) return "#ff5d55";
  if(delta>=2) return "#ffad4a";
  if(delta<=-5) return "#8f969f";
  if(delta<=-3) return "#71c873";
  return "#f1d56a";
}

function mobScaledStats(template,level){
  const cfg=BALANCE.mobLevels||{};
  const mobLevel=Math.max(1,Math.floor(numberOr(level,template.baseLevel||1)));
  const levelDelta=mobLevel-(template.baseLevel||1);
  const hpGrowth=percentOr(cfg.hpGrowthPerLevelPercent,14);
  const atkGrowth=percentOr(cfg.attackGrowthPerLevelPercent,10);
  const armorPerLevel=numberOr(cfg.armorPerLevel,.55);
  const xpGrowth=percentOr(cfg.xpGrowthPerLevelPercent,18);

  let maxHp=Math.max(1,Math.round(template.hp*Math.max(.25,1+levelDelta*hpGrowth)));
  let atk=Math.max(1,Math.round(template.atk*Math.max(.25,1+levelDelta*atkGrowth)));
  let def=Math.max(0,Math.round(template.def+levelDelta*armorPerLevel));
  let xp=Math.max(1,Math.round(template.xp*Math.max(.25,1+levelDelta*xpGrowth)));

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
  const base=Math.max(0,Math.floor(numberOr(mob.xp,mob.template?.xp||0)));
  const diff=mob.level-state.level;
  const noXpGap=Math.max(1,Math.floor(numberOr(cfg.noXpWhenBelowPlayerByLevels,5)));
  if(diff<=-noXpGap) return 0;
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
  const stats=mobScaledStats(mob.template,mob.level);
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

function updateMobs(dt){
  for(const mob of mobs){
    if(!mob.alive){
      if(mob.boss) continue;
      mob.respawnTimer-=dt;
      if(mob.respawnTimer<=0){
        mob.alive=true;
        mob.x=mob.homeX; mob.y=mob.homeY;
        mob.vx=0; mob.vy=0; mob.drawVx=0; mob.drawVy=0;
        mob.facing="down"; mob.facingCandidate="down"; mob.facingCandidateTime=0; mob.aggro=false;
        restoreMobStats(mob);
      }
      continue;
    }

    mob.attackAnim=Math.max(0,(mob.attackAnim||0)-dt);
    const d=dist(state.x,state.y,mob.x,mob.y);
    const isTarget=mob===combatTarget;

    // Aggression and movement are data-driven so routine mob tuning only
    // requires editing config/game-balance.js.
    if(!combatTarget && mob.template.aggressive && d<mob.template.aggroTriggerRange){
      engageMob(mob,true);
    }

    mob.aggro=isTarget || (!combatTarget && mob.template.aggressive && d<mob.template.alertRange);

    let vx=0,vy=0;
    if(isTarget){
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
      const homeDist=dist(mob.x,mob.y,mob.homeX,mob.homeY);
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
    if(blocked && !isTarget && !mob.boss){
      // Do not bounce the stored wander vector back and forth against a wall.
      // Stop briefly and choose a fresh direction on the next wander decision.
      mob.vx=0; mob.vy=0; mob.moveTimer=0;
    }

    if(!mob.boss && tileAtWorld(mob.x,mob.y)===4){
      mob.x=mob.homeX; mob.y=mob.homeY;
    }
  }
}

function findNearestMob(maxDistance=Infinity){
  let best=null,bestD=maxDistance;
  for(const mob of mobs){
    if(!mob.alive) continue;
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

function getMobRespawnSeconds(mob){
  if(!mob||mob.boss) return 999999;
  const min=Math.min(mob.template.respawnMin,mob.template.respawnMax);
  const max=Math.max(mob.template.respawnMin,mob.template.respawnMax);
  return min+Math.random()*(max-min);
}

function selectMob(mob,showToast=true){
  if(!mob||!mob.alive) return false;
  selectedTarget=mob;
  updateCombatHud();
  if(showToast) toast(`Lv ${mob.level} ${mob.template.name} targeted • ${Math.max(0,Math.ceil(mob.hp))}/${mob.maxHp} HP`);
  return true;
}

function clearSelectedTarget(){
  selectedTarget=null;
  updateCombatHud();
}

function getHudTarget(){
  if(selectedTarget && selectedTarget.alive) return selectedTarget;
  if(combatTarget && combatTarget.alive) return combatTarget;
  selectedTarget=null;
  return null;
}

function updateOpenCombat(dt){
  playerAttackAnim=Math.max(0,playerAttackAnim-dt);
  enemyAttackAnim=Math.max(0,enemyAttackAnim-dt);
  for(const fx of combatFx) fx.life-=dt;
  combatFx=combatFx.filter(fx=>fx.life>0);

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

function updateCombatHud(){
  const hud=document.getElementById("targetHud");
  const action=document.getElementById("actionHint");
  if(!hud||!action) return;

  const target=getHudTarget();
  action.classList.remove("ready","engaged","cooldown","targeted");

  if(target){
    hud.classList.add("show");
    const targetName=document.getElementById("targetName");
    targetName.textContent=`Lv ${target.level} ${target.template.name}`;
    targetName.style.color=mobLevelColor(target.level,target.boss);
    document.getElementById("targetHpText").textContent=`${Math.max(0,Math.ceil(target.hp))}/${target.maxHp} HP`;
    document.getElementById("targetHpFill").style.width=`${Math.max(0,100*target.hp/target.maxHp)}%`;
    const d=dist(state.x,state.y,target.x,target.y);

    if(combatTarget && combatTarget.alive){
      document.getElementById("combatHint").textContent=d>ATTACK_RANGE?"Closing to melee range…":"In combat • move away to escape";
      action.innerHTML="LEAVE<br>COMBAT";
      action.classList.add("engaged");
      return;
    }

    document.getElementById("combatHint").textContent=d>MAX_ENGAGE_RANGE?`Targeted • ${Math.ceil(d)} away • move closer`:`Targeted • ${Math.ceil(d)} away • ready to attack`;
    if(attackButtonCooldown>0){
      action.innerHTML=`ATTACK<br>${attackButtonCooldown.toFixed(1)}s`;
      action.classList.add("cooldown");
    }else if(d<=MAX_ENGAGE_RANGE){
      action.innerHTML="ATTACK<br>TARGET";
      action.classList.add("ready");
    }else{
      action.innerHTML="MOVE<br>CLOSER";
      action.classList.add("targeted");
    }
    return;
  }

  hud.classList.remove("show");
  const near=findNearestMob(MAX_ENGAGE_RANGE);
  if(attackButtonCooldown>0){
    action.innerHTML=`ATTACK<br>${attackButtonCooldown.toFixed(1)}s`;
    action.classList.add("cooldown");
  }else{
    action.innerHTML=near?"ATTACK<br>NEAREST":"SELECT MOB<br>TO TARGET";
    if(near) action.classList.add("ready");
  }
}

function engageMob(mob,forced=false){
  if(!mob||!mob.alive) return false;
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
  if(!forced) toast(`Engaged Lv ${mob.level} ${mob.template.name}.`);
  return true;
}

function disengageCombat(showToast=true){
  if(combatTarget) combatTarget.aggro=false;
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
  const crit=Math.random()<PLAYER_CRIT_CHANCE;
  const low=Math.min(PLAYER_DAMAGE_MIN,PLAYER_DAMAGE_MAX);
  const high=Math.max(PLAYER_DAMAGE_MIN,PLAYER_DAMAGE_MAX);
  let dmg=Math.max(1,state.atk+rand(low,high)-mob.def);
  if(crit) dmg*=2;
  mob.hp-=dmg;
  playerAttackAnim=.20;
  addCombatFx(mob.x,mob.y-18,crit?`★ ${dmg}`:`${dmg}`,crit?"crit":"damage");
  if(mob.hp<=0){
    mob.hp=0;
    defeatWorldMob(mob);
  }
}

function performEnemyAutoAttack(mob){
  if(!mob||!mob.alive) return;
  const low=Math.min(ENEMY_DAMAGE_MIN,ENEMY_DAMAGE_MAX);
  const high=Math.max(ENEMY_DAMAGE_MIN,ENEMY_DAMAGE_MAX);
  let dmg=Math.max(1,mob.atk+rand(low,high)-state.def);
  state.hp=Math.max(0,state.hp-dmg);
  mob.attackAnim=.20;
  enemyAttackAnim=.20;
  addCombatFx(state.x,state.y-20,`${dmg}`,"damage");
  updateUI();
  if(state.hp<=0) worldCombatDeath();
}

function defeatWorldMob(mob){
  if(!mob||!mob.alive) return;
  const e=mob.template;
  let gold=0;
  let potionDrop=0;
  if(Math.random()<e.goldDropChance) gold=rand(Math.floor(e.gold[0]),Math.floor(e.gold[1]));
  if(e.potionDropAmount>0 && Math.random()<e.potionDropChance) potionDrop=e.potionDropAmount;

  const xpReward=mobXpReward(mob);
  state.xp+=xpReward;
  state.gold+=gold;
  state.potions+=potionDrop;
  state.kills++;

  if(e.name==="Slime"){
    state.slimeKills++;
    if(state.slimeKills>=SLIMES_REQUIRED&&!state.questComplete){
      state.questComplete=true;
      setTimeout(()=>toast("Starter task complete! Explore the rest of the zone."),550);
    }
  }
  if(mob.boss||e.boss) state.bossDefeated=true;

  mob.alive=false;
  mob.aggro=false;
  mob.respawnTimer=getMobRespawnSeconds(mob);
  if(selectedTarget===mob) selectedTarget=null;
  levelCheck();
  disengageCombat(false);

  if(mob.boss){
    toast("You defeated Snickers!");
  }else{
    const rewards=[xpReward>0?`+${xpReward} XP`:"No XP (trivial level)"];
    if(gold>0) rewards.push(`+${gold} gold`);
    if(potionDrop>0) rewards.push(`+${potionDrop} potion${potionDrop===1?"":"s"}`);
    toast(`Defeated ${e.name}: ${rewards.join(", ")}`);
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

  let best=null;
  let bestScore=Infinity;
  for(const mob of mobs){
    if(!mob.alive) continue;
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
    enemy.hp=mobRef.hp;
    enemy.maxHp=mobRef.maxHp;
    enemy.atk=mobRef.atk;
    enemy.def=mobRef.def;
    enemy.xp=mobXpReward(mobRef);
  }else{
    const temp={...base,baseLevel:base.baseLevel||base.level||1,boss:!!base.boss};
    const stats=mobScaledStats(temp,base.level||temp.baseLevel);
    enemy.level=base.level||temp.baseLevel;
    enemy.hp=stats.maxHp; enemy.maxHp=stats.maxHp; enemy.atk=stats.atk; enemy.def=stats.def; enemy.xp=stats.xp;
  }
  defending=false;
  battleLocked=false;
  attackButtonCooldown=0;
  input={up:false,down:false,left:false,right:false};

  document.getElementById("battleTitle").textContent=`Lv ${enemy.level||1} ${enemy.name} Encounter`;
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

  const crit=Math.random()<.12;
  let dmg=Math.max(1,state.atk+rand(0,3)-enemy.def);
  if(crit)dmg*=2;

  setTimeout(()=>{
    if(!enemy)return;
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
  const gold=rand(e.gold[0],e.gold[1]);
  state.xp+=e.xp;
  state.gold+=gold;
  state.kills++;

  if(e.name==="Slime"){
    state.slimeKills++;
    if(state.slimeKills>=SLIMES_REQUIRED&&!state.questComplete){
      state.questComplete=true;
      setTimeout(()=>toast("Starter task complete! Explore the rest of the zone."),500);
    }
  }
  if(e.boss)state.bossDefeated=true;

  if(currentMob){
    currentMob.alive=false;
    currentMob.respawnTimer=getMobRespawnSeconds(currentMob);
    currentMob.aggro=false;
  }

  levelCheck();
  endBattle();

  if(e.boss)toast("You defeated Snickers!");
  else toast(`Defeated ${e.name}: +${e.xp} XP, +${gold} gold`);
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
  const growth=1+percentOr(BALANCE.progression?.xpRequirementGrowthPercent,35);
  const hpGain=Math.floor(numberOr(BALANCE.progression?.hpPerLevel,8));
  const atkGain=Math.floor(numberOr(BALANCE.progression?.attackPerLevel,2));
  const defGain=Math.floor(numberOr(BALANCE.progression?.defensePerLevel,1));
  while(state.xp>=state.xpNext){
    state.xp-=state.xpNext;
    state.level++;
    state.xpNext=Math.floor(state.xpNext*growth);
    state.maxHp+=hpGain;state.hp=state.maxHp;
    state.atk+=atkGain;state.def+=defGain;
    refreshAliveMobStatsForPlayer();
    setTimeout(()=>toast(`Level up! Level ${state.level}`),650);
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
}

function updateUI(){
  document.getElementById("lvl").textContent=state.level;
  document.getElementById("gold").textContent=state.gold;
  document.getElementById("hpText").textContent=`${state.hp}/${state.maxHp}`;
  document.getElementById("xpText").textContent=`${state.xp}/${state.xpNext}`;
  document.getElementById("hpFill").style.width=`${Math.max(0,100*state.hp/state.maxHp)}%`;
  document.getElementById("xpFill").style.width=`${Math.min(100,100*state.xp/state.xpNext)}%`;

  document.getElementById("mAtk").textContent=state.atk;
  document.getElementById("mDef").textContent=state.def;
  document.getElementById("mPotions").textContent=state.potions;
  document.getElementById("mKills").textContent=state.kills;

  let q;
  if(state.bossDefeated){
    q="Starter zone complete.";
    document.getElementById("questChip").textContent="Starter zone";
  }else if(state.questComplete){
    q="Starter task complete. Explore the farm, wilderness, and goblin camp.";
    document.getElementById("questChip").textContent="Explore the zone";
  }else{
    q=`Defeat ${SLIMES_REQUIRED} Slimes (${state.slimeKills}/${SLIMES_REQUIRED}).`;
    document.getElementById("questChip").textContent=`Slimes ${state.slimeKills}/${SLIMES_REQUIRED}`;
  }
  document.getElementById("mQuest").textContent=q;

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

function save(){
  const saveData={...state};
  localStorage.setItem("littleRealmMobileSaveV3",JSON.stringify(saveData));
  toast("Game saved.");
}
function load(){
  const raw=localStorage.getItem("littleRealmMobileSaveV3");
  if(!raw){toast("No v3 save found.");return}
  try{
    state={...fresh(),...JSON.parse(raw)};
    ensureInventoryState();
    enemy=null;
    currentMob=null;
    combatTarget=null;
    selectedTarget=null;
    combatFx=[];
    attackButtonCooldown=0;
    input={up:false,down:false,left:false,right:false};
    spawnMobs();
    closeAll();
    updateUI();
    toast("Game loaded.");
  }catch(e){
    toast("Could not load save.");
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
  potion:bindingList("potion",["KeyQ"]),
  clearTarget:bindingList("clearTarget",["Escape"]),
  menu:bindingList("menu",["KeyM"]),
  backpack:bindingList("backpack",["KeyI","KeyB"])
};

// Exposed only as read-only diagnostics so a desktop tester can confirm the
// deployed build from DevTools without digging through bundled source.
window.LR_BUILD_VERSION="v20-backpack-inventory";
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
  if(document.getElementById("menu").classList.contains("show") || document.getElementById("backpack").classList.contains("show")) return;
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

    const overlayOpen=document.getElementById("menu").classList.contains("show") || document.getElementById("backpack").classList.contains("show");
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
      if(backpack.classList.contains("show")) closeBackpack();
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
document.getElementById("closeBackpack").onclick=closeBackpack;
document.getElementById("inventoryGrid").onclick=event=>{
  const slot=event.target.closest?.("[data-slot]");
  if(slot) selectInventorySlot(Number(slot.dataset.slot));
};
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
