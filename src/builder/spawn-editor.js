function developerNormalizeSpawn(record,index=0){
  const type=String(record?.mobType||record?.kind||"").trim();
  const x=Number.isFinite(Number(record?.x))?Number(record.x):0;
  const y=Number.isFinite(Number(record?.y))?Number(record.y):0;
  const out={id:String(record?.id||`${type||"mob"}-${index+1}`),mobType:type,x,y};
  if(Number.isFinite(Number(record?.level)))out.level=Math.max(1,Math.floor(Number(record.level)));
  if(["down","left","right","up"].includes(record?.facing))out.facing=record.facing;
  return out;
}
function developerNormalizeSpawns(records){
  const used=new Set();
  return (Array.isArray(records)?records:[]).map((record,index)=>{
    const out=developerNormalizeSpawn(record,index);let id=devContentId(out.id,`${out.mobType||"mob"}-${index+1}`),n=2,root=id;
    while(used.has(id))id=`${root}-${n++}`;used.add(id);out.id=id;return out;
  }).filter(record=>record.mobType&&Number.isFinite(record.x)&&Number.isFinite(record.y));
}
function developerSpawnById(id=devSelectedSpawnId){return devMobSpawns.find(spawn=>spawn.id===id)||null;}
function developerLiveMobForSpawn(id=devSelectedSpawnId){return mobs.find(mob=>mob.spawnId===id)||null;}
function developerSpawnWalkable(x,y){
  const tx=Math.floor(Number(x)/TILE),ty=Math.floor(Number(y)/TILE);
  return ty>=0&&ty<world.length&&tx>=0&&tx<(world[ty]?.length||0)&&!!tile[world[ty][tx]]?.walk;
}
function developerSpawnUniqueId(type){
  const root=devContentId(type||"mob","mob");let n=1,id=`${root}-${n}`;const used=new Set(devMobSpawns.map(s=>s.id));
  while(used.has(id))id=`${root}-${++n}`;return id;
}
function syncDeveloperSpawnRuntime({keepSelection=true}={}){
  window.LR_MOB_SPAWNS=devContentClone(devMobSpawns);
  const selectedId=keepSelection?devSelectedSpawnId:null;
  if(typeof selectedTarget!=="undefined")selectedTarget=null;
  if(typeof currentMob!=="undefined")currentMob=null;
  if(typeof enemy!=="undefined")enemy=null;
  if(typeof spawnMobs==="function"&&state)spawnMobs();
  devSelectedMob=selectedId?developerLiveMobForSpawn(selectedId):null;
  updateCombatHud?.();
}
function placeDeveloperMobSpawn(type,wx,wy){
  if(!BALANCE.mobs?.[type]){devSetStatus(`Mob type '${type}' is not in the Content Library`);return;}
  const x=snapDev(wx),y=snapDev(wy);
  if(!developerSpawnWalkable(x,y)){devSetStatus("That spawn point is not on a walkable tile");return;}
  const spawn={id:developerSpawnUniqueId(type),mobType:type,x,y};
  devMobSpawns.push(spawn);devSelectedSpawnId=spawn.id;
  if(!devRepeatPlacement)devPlaceMobType=null;
  syncDeveloperSpawnRuntime();saveDeveloperDraft();refreshDeveloperPanel();updateDevPaletteActive();
  devSetStatus(devRepeatPlacement?`Placed ${mobTypeScaleLabel(type)} spawn • repeat placement remains active`:`Placed ${mobTypeScaleLabel(type)} spawn • Select / Move restored`);
}
function selectDeveloperSpawn(id,{switchTab=true}={}){
  devSelectedSpawnId=id;devSelectedMob=developerLiveMobForSpawn(id);devSelected=null;devSelectedNpc=null;devSelectedRemnant=null;
  if(switchTab)setDeveloperTab("spawns");refreshDeveloperPanel();
}
function findDeveloperSpawnAt(wx,wy){
  let best=null,bestDist=Infinity;const radius=22/Math.max(.2,developerCameraZoomValue());
  for(const spawn of devMobSpawns){const d=dist(wx,wy,spawn.x,spawn.y);if(d<=radius&&d<bestDist){best=spawn;bestDist=d;}}
  return best;
}
function beginDeveloperSpawnDrag(spawn,p,event){
  devSelectedSpawnId=spawn.id;devSelectedMob=developerLiveMobForSpawn(spawn.id);devSpawnDragging=true;
  devSpawnDragOffset={x:p.x-spawn.x,y:p.y-spawn.y,startX:spawn.x,startY:spawn.y};
  try{game.setPointerCapture?.(event.pointerId);}catch{}
  refreshDeveloperSpawnPanel();devSetStatus(`Moving ${mobTypeScaleLabel(spawn.mobType)} spawn — release on a walkable tile`);
}
function updateDeveloperSpawnDrag(p){
  const spawn=developerSpawnById();if(!devSpawnDragging||!spawn)return;
  spawn.x=snapDev(p.x-devSpawnDragOffset.x);spawn.y=snapDev(p.y-devSpawnDragOffset.y);
  const live=developerLiveMobForSpawn(spawn.id);if(live){live.x=spawn.x;live.y=spawn.y;live.homeX=spawn.x;live.homeY=spawn.y;live.vx=0;live.vy=0;live.aggro=false;live.returningHome=false;}
  refreshDeveloperSpawnInspectorValues();
}
function finishDeveloperSpawnDrag(){
  const spawn=developerSpawnById();if(!spawn)return;
  if(!developerSpawnWalkable(spawn.x,spawn.y)){
    spawn.x=devSpawnDragOffset.startX;spawn.y=devSpawnDragOffset.startY;syncDeveloperSpawnRuntime();devSetStatus("Spawn move cancelled — mobs must spawn on a walkable tile");
  }else{syncDeveloperSpawnRuntime();saveDeveloperDraft();devSetStatus("Mob spawn position updated");}
}
function duplicateDeveloperSpawn(){
  const source=developerSpawnById();if(!source)return;const copy=devContentClone(source);copy.id=developerSpawnUniqueId(copy.mobType);copy.x+=devSnap*2;copy.y+=devSnap*2;
  if(!developerSpawnWalkable(copy.x,copy.y)){copy.x=source.x;copy.y=source.y;}
  devMobSpawns.push(copy);devSelectedSpawnId=copy.id;syncDeveloperSpawnRuntime();saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`Duplicated ${mobTypeScaleLabel(copy.mobType)} spawn`);
}
function deleteDeveloperSpawn(){
  const spawn=developerSpawnById();if(!spawn)return;if(!confirm(`Delete ${mobTypeScaleLabel(spawn.mobType)} spawn '${spawn.id}'?`))return;
  const index=devMobSpawns.indexOf(spawn);if(index>=0)devMobSpawns.splice(index,1);devSelectedSpawnId=null;devSelectedMob=null;syncDeveloperSpawnRuntime({keepSelection:false});saveDeveloperDraft();refreshDeveloperPanel();devSetStatus("Mob spawn deleted");
}
function applyDeveloperSpawnInspector(){
  const spawn=developerSpawnById(),root=devPanel?.querySelector("#devSpawnInspector");if(!spawn||!root)return;
  const id=devContentId(root.querySelector("#devSpawnId").value,spawn.id);if(id!==spawn.id&&devMobSpawns.some(s=>s.id===id)){devSetStatus(`Spawn ID '${id}' is already in use`);return;}
  const x=numberOr(root.querySelector("#devSpawnX").value,spawn.x),y=numberOr(root.querySelector("#devSpawnY").value,spawn.y);if(!developerSpawnWalkable(x,y)){devSetStatus("Spawn coordinates must be on a walkable tile");return;}
  spawn.id=id;spawn.mobType=root.querySelector("#devSpawnType").value;spawn.x=x;spawn.y=y;
  const levelText=root.querySelector("#devSpawnLevel").value.trim();if(levelText)spawn.level=Math.max(1,Math.floor(numberOr(levelText,1)));else delete spawn.level;
  spawn.facing=root.querySelector("#devSpawnFacing").value||"down";devSelectedSpawnId=id;syncDeveloperSpawnRuntime();saveDeveloperDraft();refreshDeveloperPanel();devSetStatus("Mob spawn saved");
}
function refreshDeveloperSpawnInspectorValues(){
  const spawn=developerSpawnById(),root=devPanel?.querySelector("#devSpawnInspector");if(!spawn||!root)return;
  const x=root.querySelector("#devSpawnX"),y=root.querySelector("#devSpawnY");if(x)x.value=Math.round(spawn.x);if(y)y.value=Math.round(spawn.y);
}
function refreshDeveloperSpawnPanel(){
  if(!devPanel)return;const palette=devPanel.querySelector("#devSpawnPalette"),list=devPanel.querySelector("#devSpawnList"),inspector=devPanel.querySelector("#devSpawnInspector"),count=devPanel.querySelector("#devSpawnCount");if(!palette||!list||!inspector)return;
  if(count)count.textContent=`${devMobSpawns.length} spawn${devMobSpawns.length===1?"":"s"}`;
  const allTypes=Object.keys(BALANCE.mobs||{}),query=String(devPanel.querySelector("#devSpawnSearch")?.value||"").trim().toLowerCase(),types=allTypes.filter(type=>!query||`${mobTypeScaleLabel(type)} ${type}`.toLowerCase().includes(query));
  palette.innerHTML=types.map(type=>{const n=devMobSpawns.filter(s=>s.mobType===type).length;return `<button class="devSpawnType${type===devPlaceMobType?" active":""}" data-spawn-type="${devContentEscape(type)}"><b>${devContentEscape(mobTypeScaleLabel(type))}</b><span>${n} placed</span></button>`;}).join("")||'<div class="devEmpty">Create a Mob Type in Content first.</div>';
  palette.querySelectorAll("[data-spawn-type]").forEach(button=>button.onclick=()=>{devPlaceMobType=button.dataset.spawnType;devPlaceType=null;devPlaceNpcAsset=null;setDeveloperTab("spawns");updateDevPaletteActive();devSetStatus(`Placing ${mobTypeScaleLabel(devPlaceMobType)} spawns — click the world${devRepeatPlacement?" repeatedly":" once"}`);});
  list.innerHTML=devMobSpawns.map(spawn=>`<button class="devSpawnChip ${spawn.id===devSelectedSpawnId?"active":""}" data-spawn-id="${devContentEscape(spawn.id)}"><b>${devContentEscape(mobTypeScaleLabel(spawn.mobType))}</b><span>${devContentEscape(spawn.id)} • ${Math.round(spawn.x)}, ${Math.round(spawn.y)}</span></button>`).join("")||'<div class="devEmpty">No mob spawns in this zone yet.</div>';
  list.querySelectorAll("[data-spawn-id]").forEach(button=>button.onclick=()=>selectDeveloperSpawn(button.dataset.spawnId));
  const spawn=developerSpawnById();if(!spawn){inspector.innerHTML='<div class="devEmpty">Choose a spawn above or click a spawn marker/mob in the world.</div>';return;}
  const options=allTypes.map(type=>`<option value="${devContentEscape(type)}" ${type===spawn.mobType?"selected":""}>${devContentEscape(mobTypeScaleLabel(type))}</option>`).join("");
  inspector.innerHTML=`<div class="devSelectedTitle">SPAWN • ${devContentEscape(mobTypeScaleLabel(spawn.mobType))}</div><div class="devHint">Drag this spawn directly in the world. The ring marks its home point; the mob will leash back here.</div><div class="devPair"><label>ID<input id="devSpawnId" value="${devContentEscape(spawn.id)}"></label><label>Mob Type<select id="devSpawnType">${options}</select></label></div><div class="devPair"><label>X<input id="devSpawnX" type="number" value="${Math.round(spawn.x)}"></label><label>Y<input id="devSpawnY" type="number" value="${Math.round(spawn.y)}"></label></div><div class="devPair"><label>Fixed Level <span style="font-weight:400;color:#9e92a5">(optional)</span><input id="devSpawnLevel" type="number" min="1" placeholder="use mob range" value="${Number.isFinite(spawn.level)?spawn.level:""}"></label><label>Facing<select id="devSpawnFacing">${["down","left","right","up"].map(v=>`<option value="${v}" ${v===(spawn.facing||"down")?"selected":""}>${v}</option>`).join("")}</select></label></div><div class="devRow"><button id="devSpawnApply" class="primary">Apply</button><button id="devSpawnNearPlayer">Move Near Player</button></div><div class="devRow"><button id="devSpawnDuplicate">Duplicate</button><button id="devSpawnDelete" class="danger">Delete</button></div>`;
  inspector.querySelector("#devSpawnApply").onclick=applyDeveloperSpawnInspector;inspector.querySelector("#devSpawnDuplicate").onclick=duplicateDeveloperSpawn;inspector.querySelector("#devSpawnDelete").onclick=deleteDeveloperSpawn;
  inspector.querySelector("#devSpawnNearPlayer").onclick=()=>{const x=snapDev(state.x+48),y=snapDev(state.y);if(!developerSpawnWalkable(x,y)){devSetStatus("The nearby point is not walkable");return;}spawn.x=x;spawn.y=y;syncDeveloperSpawnRuntime();saveDeveloperDraft();refreshDeveloperPanel();};
}
