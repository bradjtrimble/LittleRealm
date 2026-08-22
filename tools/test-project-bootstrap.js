const fs=require('fs');
const path=require('path');
function applyProjectGlobals(target,root,{preserveItems=false,preserveLoot=false}={}){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'content','little-realm.project.json'),'utf8'));
  const shared=JSON.parse(fs.readFileSync(path.join(root,manifest.sharedContent),'utf8'));
  const zoneEntry=(manifest.zones||[]).find(z=>z.id===manifest.defaultZone)||(manifest.zones||[])[0];
  if(!zoneEntry) throw new Error('Project has no zone');
  const pack=JSON.parse(fs.readFileSync(path.join(root,zoneEntry.pack),'utf8'));
  if(!preserveItems) target.LR_ITEMS=shared.items||{};
  if(!preserveLoot) target.LR_LOOT_TABLES=shared.lootTables||{};
  target.LR_ASSETS=shared.assets||{};
  target.LR_CHARACTER_DEFAULTS=shared.characterDefaults||{};
  target.LR_OBJECT_DEFINITIONS=shared.objectDefinitions||{};
  target.LR_TERRAINS=shared.terrains||{};
  target.LR_TERRAIN_DEFAULTS=shared.terrainDefaults||{};
  target.LR_BALANCE=target.LR_BALANCE||{};
  target.LR_BALANCE.mobs=shared.mobs||{};
  target.LR_SHARED_CONTENT=shared;
  target.LR_ZONE_SETTINGS=pack.zoneSettings||{};
  target.LR_WORLD_TERRAIN=pack.terrain||[];
  target.LR_WORLD_OBJECTS=pack.worldObjects||[];
  target.LR_NPCS=pack.npcs||[];
  target.LR_QUESTS=pack.quests||[];
  target.LR_MOB_SPAWNS=pack.mobSpawns||[];
  target.LR_VISUAL=pack.visualSettings||{};
  if(pack.balance&&typeof pack.balance==='object'){
    const mobs=target.LR_BALANCE.mobs;
    target.LR_BALANCE=pack.balance;
    target.LR_BALANCE.mobs=mobs;
  }
  target.LR_ACTIVE_PROJECT={manifest,zone:zoneEntry};
  return {manifest,shared,zoneEntry,pack};
}
module.exports={applyProjectGlobals};
