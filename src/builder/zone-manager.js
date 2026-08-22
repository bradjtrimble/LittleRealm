function developerZoneSlug(value){
  const id=String(value||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  return id||"new-zone";
}

function developerZoneById(id){
  return (devProjectManifest?.zones||[]).find(zone=>zone.id===id)||null;
}

function developerResizeZoneTerrain(source,width,height){
  const out=makeBlankZoneTerrain(width,height),valid=new Set(Object.values(devTerrains||{}).map(rec=>Math.floor(numberOr(rec?.code,-999))));
  if(Array.isArray(source))for(let y=0;y<Math.min(height,source.length);y++){if(!Array.isArray(source[y]))continue;for(let x=0;x<Math.min(width,source[y].length);x++){const v=Math.floor(numberOr(source[y][x],terrainDefaultCode()));out[y][x]=valid.has(v)?v:terrainDefaultCode();}}
  return out;
}

function developerNewZonePack({width,height,startTileX,startTileY,template="blank",backdropTerrainId=""}){
  const source=template==="copy"?developerWorldPack():null,zoneBalance=devBalanceClone(BALANCE);delete zoneBalance.mobs;
  const beyond=template==="copy"?String(source?.zoneSettings?.backdropTerrainId||developerZoneBackdropTerrainId()):String(backdropTerrainId||developerZoneBackdropTerrainId());
  return {format:"little-realm-world-pack",schemaVersion:DEV_WORLD_SCHEMA_VERSION,build:DEV_BUILDER_VERSION,exportedAt:new Date().toISOString(),zoneSettings:{width,height,startTileX,startTileY,backdropTerrainId:devTerrains[beyond]?beyond:(Object.keys(devTerrains)[0]||""),musicId:template==="copy"?String(source?.zoneSettings?.musicId||""):"",musicVolume:template==="copy"?numberOr(source?.zoneSettings?.musicVolume,1):1,ambienceId:template==="copy"?String(source?.zoneSettings?.ambienceId||""):"",ambienceVolume:template==="copy"?numberOr(source?.zoneSettings?.ambienceVolume,1):1},terrain:developerResizeZoneTerrain(source?.terrain,width,height),worldObjects:template==="copy"?devContentClone(source.worldObjects):[],npcs:template==="copy"?devContentClone(source.npcs):[],quests:template==="copy"?devContentClone(source.quests):[],mobSpawns:template==="copy"?devContentClone(source.mobSpawns):[],visualSettings:template==="copy"?devContentClone(source.visualSettings):{...VISUAL_SCALE,remnants:{...LOOT_REMNANT_VISUAL}},balance:template==="copy"?devContentClone(source.balance):zoneBalance};
}

async function developerRemoveProjectDirectory(path){
  const parts=String(path||"").split("/").filter(Boolean);if(!parts.length)return;
  let dir=devProjectDirectoryHandle;
  for(const part of parts.slice(0,-1))dir=await dir.getDirectoryHandle(part);
  await dir.removeEntry(parts[parts.length-1],{recursive:true});
}

async function switchDeveloperZone(id,{saveCurrent=true}={}){
  const zone=developerZoneById(id);if(!zone?.pack){devSetStatus("That zone is not available in the project manifest");return;}
  if(zone.id===devProjectZone?.id){devZoneSelectedId=zone.id;refreshDeveloperZonePanel();return;}
  if(!devProjectDirectoryHandle){devSetStatus("Open the Little Realm Project Folder before switching zones");return;}
  try{
    developerPersistCameraForZone();
    if(saveCurrent&&devProjectZone?.pack)await developerPersistActiveProjectSafely("zone switch");
    const pack=await developerReadProjectJson(zone.pack);
    devProjectZone=zone;devZoneSelectedId=zone.id;devZoneBaselinePack=devContentClone(pack);
    applyDeveloperWorldPack(pack,{quiet:true,zoneSwitch:true});
    developerRestoreCameraForZone();
    saveDeveloperDraft();refreshDeveloperPanel();
    devSetStatus(`Opened zone: ${zone.name||zone.id} • ${WORLD_W}×${WORLD_H} tiles`);
  }catch(err){console.error(err);devSetStatus(`Zone could not be opened: ${err?.message||"unknown error"}`);}
}

async function createDeveloperZone(){
  const root=devPanel?.querySelector("#devZoneCreate");if(!root)return;
  if(!devProjectDirectoryHandle||!devProjectManifest){devSetStatus("Open the Little Realm Project Folder before creating a zone");return;}
  const name=String(root.querySelector("#devNewZoneName")?.value||"").trim()||"New Zone";
  const id=developerZoneSlug(root.querySelector("#devNewZoneId")?.value||name);
  if(developerZoneById(id)){devSetStatus(`Zone ID '${id}' already exists`);return;}
  const width=Math.max(12,Math.min(128,Math.floor(numberOr(root.querySelector("#devNewZoneWidth")?.value,44))));
  const height=Math.max(12,Math.min(96,Math.floor(numberOr(root.querySelector("#devNewZoneHeight")?.value,32))));
  const startTileX=Math.max(2,Math.min(width-3,Math.floor(numberOr(root.querySelector("#devNewZoneStartX")?.value,Math.min(7,width-3)))));
  const startTileY=Math.max(2,Math.min(height-3,Math.floor(numberOr(root.querySelector("#devNewZoneStartY")?.value,Math.min(7,height-3)))));
  const template=root.querySelector("#devNewZoneTemplate")?.value||"blank";
  const backdropTerrainId=root.querySelector("#devNewZoneBackdrop")?.value||developerZoneBackdropTerrainId();
  const packPath=`content/zones/${id}/world-pack.json`;
  try{
    if(devProjectZone?.pack)await developerPersistActiveProjectSafely("new zone creation");
    const pack=developerNewZonePack({width,height,startTileX,startTileY,template,backdropTerrainId});
    await developerWriteProjectJson(packPath,pack);
    const zone={id,name,pack:packPath,width,height,startTileX,startTileY};
    devProjectManifest.zones=Array.isArray(devProjectManifest.zones)?devProjectManifest.zones:[];
    devProjectManifest.zones.push(zone);
    await developerPersistProjectManifest();
    devZoneSelectedId=id;
    await switchDeveloperZone(id,{saveCurrent:false});
    devSetStatus(`Created ${name} • ${width}×${height} tiles • ${template==="copy"?"copied from previous zone":"blank grass zone"}`);
  }catch(err){console.error(err);devSetStatus(`Zone creation failed: ${err?.message||"unknown error"}`);}
}

async function saveDeveloperZoneMetadata(){
  const zone=developerZoneById(devZoneSelectedId);if(!zone)return;
  if(!devProjectDirectoryHandle){devSetStatus("Open the project folder before changing zone metadata");return;}
  const root=devPanel?.querySelector("#devZoneInspector");if(!root)return;
  zone.name=String(root.querySelector("#devZoneName")?.value||zone.name||zone.id).trim()||zone.id;
  if(zone.id===devProjectZone?.id){
    const sx=Math.max(2,Math.min(WORLD_W-3,Math.floor(numberOr(root.querySelector("#devZoneStartX")?.value,START_TILE_X))));
    const sy=Math.max(2,Math.min(WORLD_H-3,Math.floor(numberOr(root.querySelector("#devZoneStartY")?.value,START_TILE_Y))));
    configureWorldDimensions({...window.LR_ZONE_SETTINGS,startTileX:sx,startTileY:sy});
    window.LR_ZONE_SETTINGS={...(window.LR_ZONE_SETTINGS||{}),width:WORLD_W,height:WORLD_H,startTileX:START_TILE_X,startTileY:START_TILE_Y};
    zone.startTileX=START_TILE_X;zone.startTileY=START_TILE_Y;zone.width=WORLD_W;zone.height=WORLD_H;
    await developerPersistActiveProjectSafely("zone settings save");
  }else await developerPersistProjectManifest();
  refreshDeveloperPanel();devSetStatus(`Saved zone settings for ${zone.name}`);
}

async function setDeveloperDefaultZone(){
  const zone=developerZoneById(devZoneSelectedId);if(!zone||!devProjectManifest)return;
  if(!devProjectDirectoryHandle){devSetStatus("Open the project folder before changing the default zone");return;}
  devProjectManifest.defaultZone=zone.id;
  try{await developerPersistProjectManifest();refreshDeveloperZonePanel();devSetStatus(`${zone.name||zone.id} is now the game's default starting zone`);}catch(err){devSetStatus(`Default zone change failed: ${err?.message||"unknown error"}`);}
}

async function deleteDeveloperZone(){
  const zone=developerZoneById(devZoneSelectedId);if(!zone||!devProjectManifest)return;
  const zones=devProjectManifest.zones||[];
  if(zones.length<=1){devSetStatus("A Little Realm project must keep at least one zone");return;}
  if(!devProjectDirectoryHandle){devSetStatus("Open the project folder before deleting a zone");return;}
  if(!confirm(`Delete zone '${zone.name||zone.id}' from the project? This removes its content/zones/${zone.id} folder.`))return;
  try{
    await createDeveloperProjectSnapshot("before deleting zone",{quiet:true,useCurrent:false});
    const next=zones.find(z=>z.id!==zone.id);
    devProjectManifest.zones=zones.filter(z=>z.id!==zone.id);
    if(devProjectManifest.defaultZone===zone.id)devProjectManifest.defaultZone=next.id;
    await developerPersistProjectManifest();
    try{await developerRemoveProjectDirectory(`content/zones/${zone.id}`);}catch(err){console.warn("Zone folder could not be removed automatically",err);}
    devZoneSelectedId=next.id;
    if(devProjectZone?.id===zone.id)await switchDeveloperZone(next.id,{saveCurrent:false});
    else refreshDeveloperPanel();
    devSetStatus(`Deleted zone: ${zone.name||zone.id}`);
  }catch(err){console.error(err);devSetStatus(`Zone deletion failed: ${err?.message||"unknown error"}`);}
}

function refreshDeveloperZonePanel(){
  if(!devPanel)return;
  const list=devPanel.querySelector("#devZoneList"),inspector=devPanel.querySelector("#devZoneInspector"),summary=devPanel.querySelector("#devZoneSummary");
  if(!list||!inspector)return;
  const newBackdrop=devPanel.querySelector("#devNewZoneBackdrop");if(newBackdrop){const current=newBackdrop.value||developerZoneBackdropTerrainId();newBackdrop.innerHTML=Object.entries(devTerrains||{}).map(([id,rec])=>`<option value="${devContentEscape(id)}" ${id===current?"selected":""}>${devContentEscape(rec.name||id)}</option>`).join("");}
  const zones=devProjectManifest?.zones||[];
  if(!devZoneSelectedId||!developerZoneById(devZoneSelectedId))devZoneSelectedId=devProjectZone?.id||zones[0]?.id||null;
  if(summary)summary.textContent=`${devProjectManifest?.name||"Little Realm"} • ${zones.length} zone${zones.length===1?"":"s"} • ${devProjectDirectoryHandle?"project folder connected":"connect the project folder to create/switch zones"}`;
  list.innerHTML=zones.map(zone=>`<button class="devZoneChip ${zone.id===devZoneSelectedId?"active":""}" data-zone-id="${devContentEscape(zone.id)}"><b>${devContentEscape(zone.name||zone.id)}</b><span>${devContentEscape(zone.id)}${zone.id===devProjectZone?.id?" • ACTIVE":""}${zone.id===devProjectManifest?.defaultZone?" • DEFAULT":""}</span></button>`).join("")||'<div class="devEmpty">No zones are declared in this project.</div>';
  list.querySelectorAll("[data-zone-id]").forEach(button=>button.onclick=()=>{devZoneSelectedId=button.dataset.zoneId;refreshDeveloperZonePanel();});
  const zone=developerZoneById(devZoneSelectedId);
  if(!zone){inspector.innerHTML='<div class="devEmpty">Choose a zone.</div>';return;}
  const active=zone.id===devProjectZone?.id;
  const settings=active?((typeof window!=="undefined"&&window.LR_ZONE_SETTINGS)||{}):zone;
  const width=Math.floor(numberOr(settings.width,zone.width||44)),height=Math.floor(numberOr(settings.height,zone.height||32));
  const sx=Math.floor(numberOr(settings.startTileX,zone.startTileX||7)),sy=Math.floor(numberOr(settings.startTileY,zone.startTileY||7));
  inspector.innerHTML=`<div class="devSelectedTitle">ZONE • ${devContentEscape(zone.name||zone.id)}</div><div class="devHint">Zone IDs/folder paths stay stable after creation. Display name and the active zone's player start can be changed here.</div><div class="devPair"><label>Name<input id="devZoneName" value="${devContentEscape(zone.name||zone.id)}"></label><label>ID<input value="${devContentEscape(zone.id)}" readonly></label></div><div class="devPair"><label>Width (tiles)<input value="${width}" readonly></label><label>Height (tiles)<input value="${height}" readonly></label></div><div class="devPair"><label>Start Tile X<input id="devZoneStartX" type="number" min="2" max="${Math.max(2,width-3)}" value="${sx}" ${active?"":"disabled"}></label><label>Start Tile Y<input id="devZoneStartY" type="number" min="2" max="${Math.max(2,height-3)}" value="${sy}" ${active?"":"disabled"}></label></div><div class="devZoneBadges"><span>${active?"Active in Builder":"Inactive"}</span><span>${zone.id===devProjectManifest?.defaultZone?"Production Default":"Not Default"}</span></div><div class="devRow">${active?'<button id="devZoneSaveMeta" class="primary">Save Zone Settings</button>':'<button id="devZoneOpen" class="primary">Open Zone</button>'}<button id="devZoneDefault">Set Default</button></div>${active?'<div class="devRow"><button id="devZoneStartPlayer">Set Start From Player</button><button id="devZoneMovePlayer">Move Player To Start</button></div>':""}<div class="devRow"><button id="devZoneDelete" class="danger">Delete Zone</button></div>`;
  inspector.querySelector("#devZoneOpen")?.addEventListener("click",()=>switchDeveloperZone(zone.id));
  inspector.querySelector("#devZoneSaveMeta")?.addEventListener("click",saveDeveloperZoneMetadata);
  inspector.querySelector("#devZoneDefault")?.addEventListener("click",setDeveloperDefaultZone);
  inspector.querySelector("#devZoneDelete")?.addEventListener("click",deleteDeveloperZone);
  inspector.querySelector("#devZoneStartPlayer")?.addEventListener("click",()=>{const x=Math.max(2,Math.min(WORLD_W-3,Math.floor(state.x/TILE))),y=Math.max(2,Math.min(WORLD_H-3,Math.floor(state.y/TILE)));inspector.querySelector("#devZoneStartX").value=x;inspector.querySelector("#devZoneStartY").value=y;devSetStatus(`Start marker staged at tile ${x}, ${y} — click Save Zone Settings`);});
  inspector.querySelector("#devZoneMovePlayer")?.addEventListener("click",()=>{state.x=START_X;state.y=START_Y;lastSafePos={x:START_X,y:START_Y};devSetStatus(`Player moved to zone start tile ${START_TILE_X}, ${START_TILE_Y}`);});
}

async function createDeveloperInteriorForSelection(){
  const obj=devSelected;
  if(!obj){devSetStatus("Select a building or world object first");return;}
  if(!devProjectDirectoryHandle||!devProjectManifest||!devProjectZone){devSetStatus("Open the Little Realm Project Folder before creating an interior");return;}
  const sourceZone=devProjectZone,label=String(obj.label||worldObjectDefinition(obj)?.name||obj.objectId||"Building").trim();
  let id=developerZoneSlug(`${sourceZone.id}-${label}-interior`),n=2;const root=id;while(developerZoneById(id))id=`${root}-${n++}`;
  const name=`${label} Interior`,width=20,height=16,startTileX=10,startTileY=13;
  const spec=worldObjectSpec(obj)||{w:48,h:48},cfg=worldObjectInteraction(obj),area=ensureDeveloperInteractionArea(obj)||cfg.area;
  const returnX=Math.round(obj.x+area.x+area.w/2),returnY=Math.round(obj.y+spec.h+20);
  const pack=developerNewZonePack({width,height,startTileX,startTileY,template:"blank",backdropTerrainId:developerZoneBackdropTerrainId()});
  const exitX=startTileX*TILE-24,exitY=(startTileY-1)*TILE-44;
  pack.worldObjects=[{
    id:`exit-${id}`,type:"gate",x:exitX,y:exitY,solid:false,hitbox:{x:4,y:29,w:40,h:14},depthMode:"ysort",depthY:44,
    interactable:true,label:`Exit to ${sourceZone.name||sourceZone.id}`,capacity:8,contents:[],interactionTag:`exit-${id}`,
    interaction:{enabled:true,type:"enter",prompt:"Exit",range:72,clickable:true,keyable:true,tag:`exit-${id}`,area:{x:4,y:18,w:40,h:26},
      requirements:{questId:"",questState:"active",itemId:"",itemQty:1},actions:{targetZone:sourceZone.id,targetX:returnX,targetY:returnY,giveItemId:"",giveItemQty:1,lootTable:"",consumeRequiredItem:false,message:""},
      useMode:"repeatable",resetSeconds:30,hideWhenUsed:false}
  }];
  const packPath=`content/zones/${id}/world-pack.json`,zone={id,name,pack:packPath,width,height,startTileX,startTileY};
  try{
    await createDeveloperProjectSnapshot("before create linked interior",{quiet:true,useCurrent:false});
    await developerWriteProjectJson(packPath,pack);
    devProjectManifest.zones=Array.isArray(devProjectManifest.zones)?devProjectManifest.zones:[];devProjectManifest.zones.push(zone);
    await developerPersistProjectManifest();
    obj.interactable=true;obj.interaction={...cfg,enabled:true,type:"enter",prompt:cfg.type==="enter"?cfg.prompt:`Enter ${label}`,area:{...area},tag:cfg.tag||obj.id,
      requirements:{...cfg.requirements},actions:{...cfg.actions,targetZone:id,targetX:null,targetY:null}};obj.interactionTag=obj.interaction.tag;
    await developerPersistActiveProject({saveManifest:false});developerAcceptProjectBaselines();
    devProjectHealthResult=await validateDeveloperProject({quiet:true});
    devZoneSelectedId=id;await switchDeveloperZone(id,{saveCurrent:false});
    devSetStatus(`Created and linked ${name} • an Exit object returns to ${sourceZone.name||sourceZone.id}`);
  }catch(err){console.error(err);devSetStatus(`Interior creation failed: ${err?.message||"unknown error"}`);}
}
