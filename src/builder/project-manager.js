function developerWorldPack(){
  const zoneBalance=devBalanceClone(BALANCE);
  delete zoneBalance.mobs;
  const settings=(typeof window!=="undefined"&&window.LR_ZONE_SETTINGS)||{};
  return {
    format:"little-realm-world-pack",
    schemaVersion:DEV_WORLD_SCHEMA_VERSION,
    build:DEV_BUILDER_VERSION,
    exportedAt:new Date().toISOString(),
    zoneSettings:{
      width:WORLD_W,
      height:WORLD_H,
      startTileX:START_TILE_X,
      startTileY:START_TILE_Y,
      backdropTerrainId:String(settings.backdropTerrainId||developerZoneBackdropTerrainId()),
      musicId:String(settings.musicId||""),musicVolume:Math.max(0,Math.min(2,numberOr(settings.musicVolume,1))),
      ambienceId:String(settings.ambienceId||""),ambienceVolume:Math.max(0,Math.min(2,numberOr(settings.ambienceVolume,1)))
    },
    terrain:world.map(row=>row.slice()),
    worldObjects:sceneryProps.map(cloneWorldObject),
    npcs:sceneryNPCs.map(cloneNpc),
    quests:questDefinitions.map(cloneQuest),
    mobSpawns:devContentClone(devMobSpawns),
    visualSettings:{...VISUAL_SCALE,remnants:{...LOOT_REMNANT_VISUAL}},
    balance:zoneBalance
  };
}

function applyDeveloperWorldPack(pack,{quiet=false,zoneSwitch=false}={}){
  if(!pack||typeof pack!=="object") throw new Error("World Pack is not an object");
  const currentObjects=sceneryProps.map(cloneWorldObject);
  const currentNpcs=sceneryNPCs.map(cloneNpc);
  const objects=Array.isArray(pack.worldObjects)?pack.worldObjects:currentObjects;
  const npcs=Array.isArray(pack.npcs)?pack.npcs:currentNpcs;
  const settings=pack.zoneSettings&&typeof pack.zoneSettings==="object"?pack.zoneSettings:((typeof window!=="undefined"&&window.LR_ZONE_SETTINGS)||{});
  const terrain=Array.isArray(pack.terrain)?pack.terrain:world.map(row=>row.slice());
  window.LR_ZONE_SETTINGS=settings;
  applyWorldZoneDefinition(settings,terrain);
  buildScenery({worldObjects:objects,npcs});

  if(Array.isArray(pack.quests)) replaceQuestDefinitions(pack.quests);
  if(Array.isArray(pack.mobSpawns)){
    devMobSpawns=developerNormalizeSpawns(pack.mobSpawns);window.LR_MOB_SPAWNS=devContentClone(devMobSpawns);
  }
  if(pack.visualSettings&&typeof pack.visualSettings==="object"){
    for(const key of Object.keys(VISUAL_SCALE)) if(Number.isFinite(Number(pack.visualSettings[key]))) VISUAL_SCALE[key]=visualScaleOr(pack.visualSettings[key],VISUAL_SCALE[key]);
    if(pack.visualSettings.remnants&&typeof pack.visualSettings.remnants==="object"){
      if(Number.isFinite(Number(pack.visualSettings.remnants.scale))) LOOT_REMNANT_VISUAL.scale=visualScaleOr(pack.visualSettings.remnants.scale,LOOT_REMNANT_VISUAL.scale);
      const mode=String(pack.visualSettings.remnants.depthMode||"").toLowerCase();
      if(LOOT_REMNANT_DEPTH_MODES.has(mode)) LOOT_REMNANT_VISUAL.depthMode=mode;
      if(Number.isFinite(Number(pack.visualSettings.remnants.depthY))) LOOT_REMNANT_VISUAL.depthY=Number(pack.visualSettings.remnants.depthY);
    }
  }
  if(pack.balance&&typeof pack.balance==="object"){
    const sharedMobs=devContentClone(BALANCE.mobs||{});
    devReplaceBalance(pack.balance);
    BALANCE.mobs=sharedMobs;
    if(typeof refreshMobTemplatesFromBalance==="function") refreshMobTemplatesFromBalance();
  }
  if(typeof spawnMobs==="function"&&state) syncDeveloperSpawnRuntime({keepSelection:false});
  if(zoneSwitch&&state){
    if(typeof disengageCombat==="function"&&combatTarget) disengageCombat();
    selectedTarget=null;devSelectedMob=null;
    state.x=START_X;state.y=START_Y;lastSafePos={x:START_X,y:START_Y};
    if(typeof refreshAliveMobStatsForPlayer==="function") refreshAliveMobStatsForPlayer();
  }
  devSelected=null;devSelectedNpc=null;devSelectedMob=null;devSelectedRemnant=null;devSelectedSpawnId=null;devSelectedQuestId=questDefinitions[0]?.id||null;devQuestFormDraft=null;
  applyZoneAudioFromCurrentSettings?.();
  resetFootstepTracking?.();
  refreshDeveloperPanel();
  updateUI?.();
  if(!quiet) devSetStatus(`Loaded World Pack • ${WORLD_W}×${WORLD_H} tiles • ${sceneryProps.length} props • ${sceneryNPCs.length} NPCs`);
}

async function developerNestedFileHandle(rootHandle,path,{create=false}={}){
  const parts=String(path||"").split("/").filter(Boolean);
  if(!parts.length) throw new Error("Project file path is empty");
  let dir=rootHandle;
  for(const part of parts.slice(0,-1)) dir=await dir.getDirectoryHandle(part,{create});
  return dir.getFileHandle(parts[parts.length-1],{create});
}

async function developerReadProjectJson(path){
  const handle=await developerNestedFileHandle(devProjectDirectoryHandle,path);
  return JSON.parse(await (await handle.getFile()).text());
}

async function developerWriteProjectJson(path,value){
  const handle=await developerNestedFileHandle(devProjectDirectoryHandle,path,{create:true});
  const writable=await handle.createWritable();
  await writable.write(JSON.stringify(value,null,2)+"\n");
  await writable.close();
}

async function developerPersistProjectManifest(){
  if(!devProjectDirectoryHandle||!devProjectManifest) return;
  devProjectManifest.schemaVersion=DEV_PROJECT_SCHEMA_VERSION;
  await developerWriteProjectJson("content/little-realm.project.json",devProjectManifest);
  devProjectManifestBaseline=devContentClone(devProjectManifest);
}

async function developerPersistActiveProject({saveShared=true,saveManifest=true}={}){
  if(!devProjectDirectoryHandle||!devProjectZone?.pack) throw new Error("Open the Little Realm project folder first");
  const pack=developerWorldPack();
  await developerWriteProjectJson(devProjectZone.pack,pack);
  devZoneBaselinePack=devContentClone(pack);
  if(devProjectZone){
    devProjectZone.width=WORLD_W;devProjectZone.height=WORLD_H;
    devProjectZone.startTileX=START_TILE_X;devProjectZone.startTileY=START_TILE_Y;
  }
  if(saveShared){
    const sharedPath=devProjectSharedContentPath||devProjectManifest?.sharedContent||"content/shared/content-library.json";
    const shared=developerContentLibrary();
    await developerWriteProjectJson(sharedPath,shared);
    devProjectSharedBaseline=devContentClone(shared);
  }
  if(saveManifest) await developerPersistProjectManifest();
}

async function openDeveloperProjectFolder(){
  if(typeof window.showDirectoryPicker!=="function"){
    devSetStatus("Direct folder access needs Chrome or Edge; use World Pack export/import instead");
    return;
  }
  try{
    const rootHandle=await window.showDirectoryPicker({mode:"readwrite"});
    devProjectDirectoryHandle=rootHandle;
    const rawManifest=await developerReadProjectJson("content/little-realm.project.json");
    if(rawManifest?.format!=="little-realm-project") throw new Error("content/little-realm.project.json is not a Little Realm project");
    const prepared=await developerPrepareOpenedProject(rawManifest);
    const manifest=prepared.manifest,sharedPath=prepared.sharedPath,sharedContent=prepared.sharedContent;
    const zone=(manifest.zones||[]).find(entry=>entry.id===manifest.defaultZone)||manifest.zones?.[0];
    if(!zone?.pack) throw new Error("Project manifest has no zone pack");
    const pack=prepared.zones[zone.id]||await developerReadProjectJson(zone.pack);
    devProjectManifest=manifest;devProjectZone=zone;devZoneSelectedId=zone.id;devProjectSharedContentPath=sharedPath;
    applyDeveloperContentLibrary(sharedContent,{quiet:true});
    applyDeveloperWorldPack(pack,{quiet:true,zoneSwitch:true});
    developerAcceptProjectBaselines({pack,shared:sharedContent,manifest});
    saveDeveloperDraft();
    await validateDeveloperProject({quiet:true});
    refreshDeveloperPanel();
    devSetStatus(`Opened ${manifest.name||"Little Realm"} • ${zone.name||zone.id} • schema v${DEV_PROJECT_SCHEMA_VERSION} project ready`);
  }catch(err){
    if(err?.name==="AbortError") return;
    console.error(err);
    devProjectDirectoryHandle=null;
    devSetStatus(`Project folder could not be opened: ${err?.message||"unknown error"}`);
  }
}

async function saveDeveloperProjectFolder(){
  if(!devProjectDirectoryHandle||!devProjectZone?.pack){
    devSetStatus("Open the Little Realm project folder first, then Save Project Folder");
    return;
  }
  try{
    const {dirty,validation}=await developerPersistActiveProjectSafely("project save");
    saveDeveloperDraft();refreshDeveloperPanel();
    const health=validation.errors?` • ${validation.errors} error(s), ${validation.warnings} warning(s)`:validation.warnings?` • ${validation.warnings} warning(s)`:" • healthy";
    devSetStatus(`Saved ${devProjectZone.name||devProjectZone.id}${health}${dirty.dirty?" • recovery snapshot created":""}`);
  }catch(err){
    console.error(err);devSetStatus(`Project folder save failed: ${err?.message||"unknown error"}`);
  }
}

function saveDeveloperDraft(){
  try{
    localStorage.setItem(DEV_DRAFT_KEY,JSON.stringify({format:"little-realm-builder-draft",schemaVersion:DEV_DRAFT_SCHEMA_VERSION,zoneId:devProjectZone?.id||null,worldPack:developerWorldPack(),sharedContent:developerContentLibrary()}));
    devSetStatus("World Builder draft autosaved locally");
  }catch(err){ console.warn("Could not save developer draft",err); }
}

function loadDeveloperDraft(){
  try{
    const raw=localStorage.getItem(DEV_DRAFT_KEY);
    if(!raw){devSetStatus("No local draft found");return;}
    const parsed=JSON.parse(raw);
    if(parsed?.format==="little-realm-builder-draft"&&parsed.schemaVersion===DEV_DRAFT_SCHEMA_VERSION&&parsed.worldPack){
      if(parsed.sharedContent)applyDeveloperContentLibrary(parsed.sharedContent,{quiet:true});
      applyDeveloperWorldPack(parsed.worldPack);
    }else throw new Error(`Draft schema is unsupported; expected v${DEV_DRAFT_SCHEMA_VERSION}`);
  }catch(err){console.error(err);devSetStatus("Draft could not be loaded");}
}

function resetDeveloperLayout(){
  const source=Array.isArray(devZoneBaselinePack?.worldObjects)?devZoneBaselinePack.worldObjects:getProjectWorldObjects();
  if(!confirm("Reset the active zone's prop layout to its last opened/saved project version? Your browser draft remains until overwritten.")) return;
  sceneryProps.splice(0,sceneryProps.length,...source.map(cloneWorldObject));devSelected=null;rebuildWorldObjectCollision();refreshDeveloperPanel();devSetStatus("Active zone prop layout restored");
}

function resetDeveloperProject(){
  if(!devZoneBaselinePack?.format){devSetStatus("No active zone baseline is available");return;}
  if(!confirm(`Reset ${devProjectZone?.name||"the active zone"} and shared content to the last opened/saved project files?`)) return;
  if(devProjectSharedBaseline&&Object.keys(devProjectSharedBaseline).length) applyDeveloperContentLibrary(devProjectSharedBaseline,{quiet:true});
  applyDeveloperWorldPack(devZoneBaselinePack,{quiet:true,zoneSwitch:true});
  refreshDeveloperPanel();updateUI();devSetStatus("Active zone project baseline restored");
}

function downloadDeveloperText(filename,text,type="application/json"){
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function exportDeveloperWorldPack(){
  const backup={...developerWorldPack(),sharedContent:developerContentLibrary()};
  downloadDeveloperText("little-realm-world-pack.json",JSON.stringify(backup,null,2));
  devSetStatus("Exported portable backup with zone + shared Content Library");
}

function importDeveloperWorldPackFile(file){
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(String(reader.result||""));
      if(parsed?.sharedContent)applyDeveloperContentLibrary(parsed.sharedContent,{quiet:true});
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

