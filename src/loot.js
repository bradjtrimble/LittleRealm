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
