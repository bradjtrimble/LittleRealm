// Data-driven loot foundation. Item definitions live in config/items.js and
// drop rules live in config/loot-tables.js. Combat only asks this module to
// grant a mob's loot; it never needs to know individual item IDs or chances.
const LOOT_TABLES = window.LR_LOOT_TABLES || {};
const warnedLootProblems = new Set();

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

function grantMobLoot(mob,rng=Math.random){
  const tableId=lootTableIdForMob(mob);
  if(!tableId) return {tableId:"",rolled:[],added:[],overflow:[]};
  const template=mob?.template||mob||{};
  const rolled=rollLootTable(tableId,{
    level:mob?.level??template.level??template.baseLevel??1,
    elite:!!(mob?.elite??template.elite),
    boss:!!(mob?.boss||template.boss)
  },rng);
  const granted=grantLootDrops(rolled);
  return {tableId,rolled,...granted};
}

function formatLootDrops(drops){
  return (Array.isArray(drops)?drops:[]).map(drop=>{
    const def=getItemDefinition(drop.itemId);
    return `${drop.qty}× ${def.name}`;
  }).join(", ");
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
// quests, and any other system that needs to roll or grant item loot.
window.LR_LOOT=Object.freeze({
  getTable:getLootTable,
  rollTable:rollLootTable,
  grantDrops:grantLootDrops,
  grantMobLoot,
  formatDrops:formatLootDrops,
  validate:validateLootConfig
});
