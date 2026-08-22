function developerTerrainRecord(id=devTerrainBrush){
  return devTerrains?.[String(id||"")]||null;
}
function developerTerrainType(id=devTerrainBrush){
  const key=String(id||"");const rec=developerTerrainRecord(key);
  return rec?{id:key,name:rec.name||key,note:developerTerrainBehaviorSummary(rec),color:rec.color||"#777",code:Math.floor(numberOr(rec.code,0))}:{id:key,name:key||"Terrain",note:"",color:"#777",code:terrainDefaultCode()};
}
function developerTerrainColor(id=devTerrainBrush){return developerTerrainType(id).color;}
function developerTerrainCode(id=devTerrainBrush){const rec=developerTerrainRecord(id);return rec?Math.floor(numberOr(rec.code,terrainDefaultCode())):terrainDefaultCode();}
function developerTerrainIdForCode(code){return terrainIdByCode(code)||Object.keys(devTerrains)[0]||"";}
function developerDefaultGroundTerrainId(){const id=String(devTerrainDefaults?.ground||"");return developerTerrainRecord(id)?id:Object.keys(devTerrains).find(key=>devTerrains[key]?.walkable!==false)||Object.keys(devTerrains)[0]||"";}
function developerDefaultBoundaryTerrainId(){const id=String(devTerrainDefaults?.boundary||"");return developerTerrainRecord(id)?id:Object.keys(devTerrains).find(key=>devTerrains[key]?.walkable===false)||developerDefaultGroundTerrainId();}
function setDeveloperTerrainDefault(kind,id){id=String(id||"");if(!developerTerrainRecord(id)||!(["ground","boundary"].includes(kind)))return;devTerrainDefaults={...(devTerrainDefaults||{}),[kind]:id};window.LR_TERRAIN_DEFAULTS=devTerrainDefaults;saveDeveloperDraft();refreshDeveloperTerrainPanel();devSetStatus(`${kind==="ground"?"New-zone ground":"New-zone boundary"}: ${developerTerrainType(id).name}`);}
function developerTerrainBehaviorSummary(rec){
  const parts=[rec?.walkable===false?"Blocked":"Walkable"];
  if(rec?.healing)parts.push("heals HP");if(rec?.sanctuary)parts.push("sanctuary");
  const move=Math.round(numberOr(rec?.movementMultiplier,1)*100);if(move!==100)parts.push(`${move}% movement`);
  if(rec?.decoration?.type==="tree")parts.push(`${Math.round(numberOr(rec.decoration.densityPercent,50))}% trees`);
  return parts.join(" • ");
}
function developerTerrainTileAt(wx,wy){return {tx:Math.floor(wx/TILE),ty:Math.floor(wy/TILE)};}
function developerTerrainBrushBounds(tx,ty,size=devTerrainBrushSize){
  const n=Math.max(1,Math.floor(numberOr(size,1))),half=Math.floor(n/2);
  return {x1:tx-half,y1:ty-half,x2:tx+(n-half-1),y2:ty+(n-half-1)};
}
function paintDeveloperTerrainTile(tx,ty,id=devTerrainBrush){
  const code=developerTerrainCode(id),bounds=developerTerrainBrushBounds(tx,ty);let changed=false;
  for(let y=bounds.y1;y<=bounds.y2;y++){
    if(y<0||y>=WORLD_H)continue;
    for(let x=bounds.x1;x<=bounds.x2;x++){
      if(x<0||x>=WORLD_W)continue;
      if(world[y][x]!==code){world[y][x]=code;changed=true;}
    }
  }
  if(changed){devTerrainDirty=true;if(typeof window!=="undefined")window.LR_WORLD_TERRAIN=world.map(row=>row.slice());}
  return changed;
}
function beginDeveloperTerrainPaint(p,event){
  const {tx,ty}=developerTerrainTileAt(p.x,p.y);devTerrainHoverTile={tx,ty};devTerrainPainting=true;devTerrainDirty=false;devTerrainLastTileKey=null;updateDeveloperTerrainPaint(p);
  if(game?.style)game.style.cursor="crosshair";try{game.setPointerCapture?.(event.pointerId);}catch{}
  devSetStatus(`Painting ${developerTerrainType().name} • ${devTerrainBrushSize}×${devTerrainBrushSize} brush`);
}
function updateDeveloperTerrainPaint(p){
  const {tx,ty}=developerTerrainTileAt(p.x,p.y);devTerrainHoverTile={tx,ty};if(!devTerrainPainting)return;
  const key=`${tx},${ty}`;if(key===devTerrainLastTileKey)return;devTerrainLastTileKey=key;paintDeveloperTerrainTile(tx,ty);
}
function finishDeveloperTerrainPaint(event){
  if(!devTerrainPainting)return false;devTerrainPainting=false;devTerrainLastTileKey=null;try{game.releasePointerCapture?.(event.pointerId);}catch{}
  if(devTerrainDirty){rebuildGeneratedTerrainScenery();saveDeveloperDraft();refreshDeveloperTerrainPanel();devSetStatus(`Terrain updated • ${developerTerrainType().name}`);}devTerrainDirty=false;return true;
}
function setDeveloperTerrainBrush(id){
  id=String(id||"");if(!developerTerrainRecord(id))return;devTerrainBrush=id;devTerrainSelectedId=id;devPlaceType=null;devPlaceNpcAsset=null;devPlaceMobType=null;updateDevPaletteActive();refreshDeveloperTerrainPanel();devSetStatus(`Terrain brush: ${developerTerrainType().name}`);
}
function developerZoneBackdropTerrainId(){
  const requested=String((typeof window!=="undefined"&&window.LR_ZONE_SETTINGS?.backdropTerrainId)||"");
  if(developerTerrainRecord(requested))return requested;return developerDefaultGroundTerrainId();
}
function setDeveloperZoneBackdropTerrain(id){
  id=String(id||"");if(!developerTerrainRecord(id))return;
  window.LR_ZONE_SETTINGS={...(window.LR_ZONE_SETTINGS||{}),backdropTerrainId:id,width:WORLD_W,height:WORLD_H,startTileX:START_TILE_X,startTileY:START_TILE_Y};
  saveDeveloperDraft();refreshDeveloperTerrainPanel();refreshDeveloperZonePanel();devSetStatus(`World beyond zone: ${developerTerrainType(id).name}`);
}
function developerMatchZoneEdgeToBackdrop(){
  const id=developerZoneBackdropTerrainId(),code=developerTerrainCode(id);
  if(!confirm(`Paint the outer two-tile zone boundary with ${developerTerrainType(id).name}?`))return;
  for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++)if(x<=1||y<=1||x>=WORLD_W-2||y>=WORLD_H-2)world[y][x]=code;
  window.LR_WORLD_TERRAIN=world.map(row=>row.slice());rebuildGeneratedTerrainScenery();saveDeveloperDraft();refreshDeveloperTerrainPanel();devSetStatus(`Zone edge matched to ${developerTerrainType(id).name}`);
}
function developerFillTerrain({interiorOnly=false,resetBlank=false}={}){
  const brushId=devTerrainBrush,brushCode=developerTerrainCode(brushId),inside=terrainDefaultCode(),boundary=terrainBoundaryCode();
  const label=resetBlank?"reset this zone to the project default ground and boundary":`fill ${interiorOnly?"the zone interior":"the entire zone"} with ${developerTerrainType(brushId).name}`;
  if(!confirm(`Are you sure you want to ${label}?`))return;
  for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++){
    if(resetBlank){world[y][x]=(x<=1||y<=1||x>=WORLD_W-2||y>=WORLD_H-2)?boundary:inside;continue;}
    if(interiorOnly&&(x<=1||y<=1||x>=WORLD_W-2||y>=WORLD_H-2))continue;world[y][x]=brushCode;
  }
  window.LR_WORLD_TERRAIN=world.map(row=>row.slice());rebuildGeneratedTerrainScenery();saveDeveloperDraft();refreshDeveloperTerrainPanel();devSetStatus(resetBlank?"Zone terrain reset":`${interiorOnly?"Interior":"Zone"} filled with ${developerTerrainType(brushId).name}`);
}
function developerTerrainCounts(){const counts=new Map();for(const row of world)for(const value of row)counts.set(value,(counts.get(value)||0)+1);return counts;}
function developerNextTerrainCode(){const used=new Set(Object.values(devTerrains).map(rec=>Math.floor(numberOr(rec?.code,-1))));let code=0;while(used.has(code))code++;return code;}
function developerUniqueTerrainId(base){const root=devContentId(base,"new-terrain");let id=root,n=2;while(devTerrains[id])id=`${root}-${n++}`;return id;}
function developerNewTerrainRecord(name="New Terrain",textureAsset=""){
  return {name,code:developerNextTerrainCode(),color:"#777777",walkable:true,healing:false,sanctuary:false,movementMultiplier:1,renderer:"grass",edgeStyle:"none",textureAsset,textureScale:1,decoration:{type:"none"}};
}
function createDeveloperTerrain(name="New Terrain",textureAsset="",{silent=false}={}){
  const id=developerUniqueTerrainId(name);devTerrains[id]=developerNewTerrainRecord(name,textureAsset);window.LR_TERRAINS=devTerrains;devTerrainSelectedId=id;devTerrainBrush=id;if(!silent){saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`Created terrain: ${name}`);}return id;
}
function createDeveloperTerrainFromAsset(asset,assetId=devAssetSelectedId,{silent=false}={}){
  if(!asset||!assetId)return null;const name=String(asset.name||assetId).trim()||"New Terrain";const id=createDeveloperTerrain(name,assetId,{silent});if(!silent){setDeveloperTab("terrain");devSetStatus(`${name} is now a paintable terrain`);}return id;
}
function duplicateDeveloperTerrain(){
  const id=devTerrainSelectedId,src=developerTerrainRecord(id);if(!src)return;const next=developerUniqueTerrainId(`${id}-copy`);devTerrains[next]=devContentClone(src);devTerrains[next].name=`${src.name||id} Copy`;devTerrains[next].code=developerNextTerrainCode();window.LR_TERRAINS=devTerrains;devTerrainSelectedId=next;devTerrainBrush=next;saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`Duplicated terrain: ${devTerrains[next].name}`);
}
async function developerTerrainReferences(id){
  const code=developerTerrainCode(id),refs=[];
  if(world.some(row=>row.includes(code)))refs.push(`${devProjectZone?.name||devProjectZone?.id||"active zone"} tiles`);
  if(developerZoneBackdropTerrainId()===id)refs.push(`${devProjectZone?.name||devProjectZone?.id||"active zone"} world-beyond setting`);
  if(devProjectDirectoryHandle&&devProjectManifest){
    for(const zone of devProjectManifest.zones||[]){if(zone.id===devProjectZone?.id||!zone.pack)continue;try{const pack=await developerReadProjectJson(zone.pack);if(pack?.zoneSettings?.backdropTerrainId===id||pack?.terrain?.some(row=>Array.isArray(row)&&row.includes(code)))refs.push(zone.name||zone.id);}catch{}}
  }
  return refs;
}
async function deleteDeveloperTerrain(){
  const id=devTerrainSelectedId,rec=developerTerrainRecord(id);if(!rec)return;if(Object.keys(devTerrains).length<=1){devSetStatus("A project must keep at least one terrain");return;}
  const refs=await developerTerrainReferences(id);if(refs.length){devSetStatus(`${rec.name||id} is still used by: ${refs.join(", ")}`);return;}
  if(!confirm(`Delete terrain '${rec.name||id}'?`))return;delete devTerrains[id];if(devTerrainDefaults?.ground===id)devTerrainDefaults.ground=Object.keys(devTerrains).find(key=>devTerrains[key]?.walkable!==false)||Object.keys(devTerrains)[0]||"";if(devTerrainDefaults?.boundary===id)devTerrainDefaults.boundary=Object.keys(devTerrains).find(key=>devTerrains[key]?.walkable===false)||devTerrainDefaults.ground;window.LR_TERRAINS=devTerrains;window.LR_TERRAIN_DEFAULTS=devTerrainDefaults;devTerrainSelectedId=Object.keys(devTerrains)[0]||null;if(devTerrainBrush===id)devTerrainBrush=devTerrainSelectedId||"";saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`Deleted terrain: ${rec.name||id}`);
}
function developerTerrainAssetOptions(type){
  return Object.entries(devAssets||{}).filter(([,asset])=>asset?.path&&(type==="tree"?(asset.type==="treeSprite"||asset.type==="worldImage"):(asset.type==="terrainTexture"||asset.type==="worldImage"))).map(([id,asset])=>[id,asset.name||id]);
}
function developerTerrainInspectorHtml(id,rec){
  if(!id||!rec)return '<div class="devEmpty">Choose a terrain or create a new one.</div>';
  const textureOptions=[["","No texture • use engine fallback"],...developerTerrainAssetOptions("texture")],treeOptions=[["","No tree asset • use engine fallback"],...developerTerrainAssetOptions("tree")];
  const option=(value,label,current)=>`<option value="${devContentEscape(value)}" ${String(value)===String(current||"")?"selected":""}>${devContentEscape(label)}</option>`;
  const decor=rec.decoration&&typeof rec.decoration==="object"?rec.decoration:{type:"none"};
  const footstepOptions=[["","No footsteps"],...Object.entries(devAudioSets||{}).map(([setId,set])=>[setId,set?.name||setId])];
  return `<div class="devContentForm"><div class="devPair"><label>Name<input id="devTerrainName" value="${devContentEscape(rec.name||id)}"></label><label>ID<input value="${devContentEscape(id)}" readonly></label></div><div class="devPair"><label>Storage Code<input value="${Math.floor(numberOr(rec.code,0))}" readonly></label><label>Fallback Color<input id="devTerrainColor" type="color" value="${/^#[0-9a-f]{6}$/i.test(rec.color||"")?rec.color:"#777777"}"></label></div><label>Texture Asset<select id="devTerrainTexture">${textureOptions.map(([v,l])=>option(v,l,rec.textureAsset)).join("")}</select></label><div class="devPair"><label>Texture Detail Scale %<input id="devTerrainTextureScale" type="number" min="10" max="400" step="5" value="${Math.round(clamp(numberOr(rec.textureScale,1),.1,4)*100)}"></label><label>Repeat Density<input id="devTerrainScaleReadout" value="≈ ${(1/clamp(numberOr(rec.textureScale,1),.1,4)).toFixed(2)}×" readonly></label></div><div class="devHint">100% keeps the texture at its current world size. Lower values make leaves, stones, flowers, and other details smaller by repeating the texture more densely. Example: 50% ≈ 2× repeat density; 25% ≈ 4×.</div><div class="devPair"><label>Engine Fallback Appearance<select id="devTerrainRenderer">${[["grass","Grass"],["water","Water"],["dirt","Dirt"],["sand","Sand"],["rock","Rock"]].map(([v,l])=>option(v,l,rec.renderer||"grass")).join("")}</select></label><label>Edge Style<select id="devTerrainEdge">${[["none","None"],["road","Road edge"],["water","Water edge"]].map(([v,l])=>option(v,l,rec.edgeStyle||"none")).join("")}</select></label></div><div class="devChecks"><label><input id="devTerrainWalkable" type="checkbox" ${rec.walkable!==false?"checked":""}> Walkable</label><label><input id="devTerrainHealing" type="checkbox" ${rec.healing?"checked":""}> Restore HP</label><label><input id="devTerrainSanctuary" type="checkbox" ${rec.sanctuary?"checked":""}> Sanctuary</label></div><label>Movement Speed %<input id="devTerrainMove" type="number" min="10" max="300" value="${Math.round(numberOr(rec.movementMultiplier,1)*100)}"></label><div class="devHint">Sanctuary terrain prevents mobs whose home is outside it from entering or aggroing players inside. Mobs intentionally spawned on sanctuary terrain can move normally.</div><div class="devSectionTitle">Footstep Audio</div><div class="devPair"><label>Footstep Sound Set<select id="devTerrainFootstepSet">${footstepOptions.map(([v,l])=>option(v,l,rec.footstepSet||"")).join("")}</select></label><label>Footstep Volume %<input id="devTerrainFootstepVolume" type="number" min="0" max="200" value="${Math.round(numberOr(rec.footstepVolume,.55)*100)}"></label></div><div class="devRow"><button type="button" id="devTerrainPreviewFootsteps">▶ Preview Footstep</button><button type="button" id="devTerrainOpenAudio">Open Audio Library</button></div><div class="devHint">Use a Sound Set with several variations (for example grass-step-1/2/3). The game alternates/randomizes them while the player walks on this terrain.</div><div class="devSectionTitle">Generated Decoration</div><label>Decoration<select id="devTerrainDecorType">${[["none","None"],["tree","Trees"]].map(([v,l])=>option(v,l,decor.type||"none")).join("")}</select></label><div class="devPair"><label>Tree Sprite<select id="devTerrainTreeAsset">${treeOptions.map(([v,l])=>option(v,l,decor.treeAsset||"")).join("")}</select></label><label>Tree Scale<input id="devTerrainTreeScale" type="number" min="0.25" max="4" step="0.05" value="${numberOr(decor.treeScale,1)}"></label></div><div class="devPair"><label>Tree Density %<input id="devTerrainDensity" type="number" min="0" max="100" value="${Math.round(numberOr(decor.densityPercent,50))}"></label><label class="devInlineCheck"><input id="devTerrainTreeSolid" type="checkbox" ${decor.solid!==false?"checked":""}> Solid trunks</label></div><div class="devContentActions"><button id="devTerrainSave" class="primary">Save Terrain</button><button id="devTerrainDuplicate">Duplicate</button><button id="devTerrainDelete" class="danger">Delete</button></div></div>`;
}
function saveDeveloperTerrainFromInspector(){
  const root=devPanel?.querySelector("#devTerrainInspector"),id=devTerrainSelectedId,rec=developerTerrainRecord(id);if(!root||!rec)return;
  const decorType=root.querySelector("#devTerrainDecorType")?.value||"none";
  rec.name=String(root.querySelector("#devTerrainName")?.value||id).trim()||id;rec.color=root.querySelector("#devTerrainColor")?.value||"#777777";rec.textureAsset=root.querySelector("#devTerrainTexture")?.value||"";rec.textureScale=clamp(numberOr(root.querySelector("#devTerrainTextureScale")?.value,100)/100,.1,4);rec.renderer=root.querySelector("#devTerrainRenderer")?.value||"grass";rec.edgeStyle=root.querySelector("#devTerrainEdge")?.value||"none";rec.walkable=!!root.querySelector("#devTerrainWalkable")?.checked;rec.healing=!!root.querySelector("#devTerrainHealing")?.checked;rec.sanctuary=!!root.querySelector("#devTerrainSanctuary")?.checked;rec.movementMultiplier=Math.max(.1,numberOr(root.querySelector("#devTerrainMove")?.value,100)/100);rec.footstepSet=root.querySelector("#devTerrainFootstepSet")?.value||"";rec.footstepVolume=Math.max(0,Math.min(2,numberOr(root.querySelector("#devTerrainFootstepVolume")?.value,55)/100));rec.decoration=decorType==="tree"?{type:"tree",treeAsset:root.querySelector("#devTerrainTreeAsset")?.value||"",treeScale:Math.max(.25,numberOr(root.querySelector("#devTerrainTreeScale")?.value,1)),densityPercent:clamp(numberOr(root.querySelector("#devTerrainDensity")?.value,50),0,100),solid:!!root.querySelector("#devTerrainTreeSolid")?.checked}:{type:"none"};
  window.LR_TERRAINS=devTerrains;rebuildGeneratedTerrainScenery();saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`Saved terrain: ${rec.name}`);
}
function refreshDeveloperTerrainPanel(){
  if(!devPanel)return;const palette=devPanel.querySelector("#devTerrainPalette"),summary=devPanel.querySelector("#devTerrainSummary"),inspector=devPanel.querySelector("#devTerrainInspector");if(!palette)return;
  if(!developerTerrainRecord(devTerrainBrush))devTerrainBrush=Object.keys(devTerrains)[0]||"";if(!developerTerrainRecord(devTerrainSelectedId))devTerrainSelectedId=devTerrainBrush;
  const counts=developerTerrainCounts(),query=String(devPanel.querySelector("#devTerrainSearch")?.value||"").trim().toLowerCase(),entries=Object.entries(devTerrains).filter(([id,rec])=>!query||`${rec?.name||""} ${id}`.toLowerCase().includes(query));palette.innerHTML=entries.sort((a,b)=>numberOr(a[1]?.code,0)-numberOr(b[1]?.code,0)).map(([id,rec])=>{const asset=devAssets?.[rec.textureAsset],path=asset?.path||"",style=`background:${rec.color||"#777"}${path?`;background-image:url('./${devContentEscape(path)}');background-size:cover;background-position:center`:""}`;return `<button class="devTerrainType ${id===devTerrainBrush?"active":""}" data-terrain-type="${devContentEscape(id)}" title="${devContentEscape(developerTerrainBehaviorSummary(rec))}"><span class="devTerrainSwatch" style="${style}"></span><b>${devContentEscape(rec.name||id)}</b><small>${counts.get(Math.floor(numberOr(rec.code,0)))||0} tiles</small></button>`;}).join("")||'<div class="devEmpty">No terrain matches this search.</div>';
  palette.querySelectorAll("[data-terrain-type]").forEach(button=>button.onclick=()=>setDeveloperTerrainBrush(button.dataset.terrainType));if(summary)summary.textContent=`${WORLD_W}×${WORLD_H} tiles • ${Object.keys(devTerrains).length} terrain types • ${developerTerrainType().name} selected`;
  const size=devPanel.querySelector("#devTerrainBrushSize");if(size){size.value=String(devTerrainBrushSize);size.onchange=e=>{devTerrainBrushSize=Math.max(1,Math.floor(numberOr(e.target.value,1)));devSetStatus(`Terrain brush size: ${devTerrainBrushSize}×${devTerrainBrushSize}`);};}
  const backdrop=devPanel.querySelector("#devTerrainBackdrop");if(backdrop){const selected=developerZoneBackdropTerrainId();backdrop.innerHTML=Object.entries(devTerrains).map(([id,rec])=>`<option value="${devContentEscape(id)}" ${id===selected?"selected":""}>${devContentEscape(rec.name||id)}</option>`).join("");backdrop.onchange=e=>setDeveloperZoneBackdropTerrain(e.target.value);}
  const backdropNote=devPanel.querySelector("#devTerrainBackdropNote");if(backdropNote){const rec=developerTerrainRecord(developerZoneBackdropTerrainId());backdropNote.textContent=`The same ${rec?.name||"terrain"} definition is drawn outside the playable grid, including its texture and generated decoration. ${developerTerrainBehaviorSummary(rec||{})}.`;}
  const terrainOptions=Object.entries(devTerrains).map(([id,rec])=>`<option value="${devContentEscape(id)}">${devContentEscape(rec.name||id)}</option>`).join("");const defaultGround=devPanel.querySelector("#devTerrainDefaultGround"),defaultBoundary=devPanel.querySelector("#devTerrainDefaultBoundary");if(defaultGround){defaultGround.innerHTML=terrainOptions;defaultGround.value=developerDefaultGroundTerrainId();defaultGround.onchange=e=>setDeveloperTerrainDefault("ground",e.target.value);}if(defaultBoundary){defaultBoundary.innerHTML=terrainOptions;defaultBoundary.value=developerDefaultBoundaryTerrainId();defaultBoundary.onchange=e=>setDeveloperTerrainDefault("boundary",e.target.value);}
  const matchEdge=devPanel.querySelector("#devTerrainMatchEdge"),fillInterior=devPanel.querySelector("#devTerrainFillInterior"),fillAll=devPanel.querySelector("#devTerrainFillAll"),resetBlank=devPanel.querySelector("#devTerrainResetBlank");if(matchEdge)matchEdge.onclick=developerMatchZoneEdgeToBackdrop;if(fillInterior)fillInterior.onclick=()=>developerFillTerrain({interiorOnly:true});if(fillAll)fillAll.onclick=()=>developerFillTerrain();if(resetBlank)resetBlank.onclick=()=>developerFillTerrain({resetBlank:true});
  if(inspector){
    inspector.innerHTML=developerTerrainInspectorHtml(devTerrainSelectedId,developerTerrainRecord(devTerrainSelectedId));
    const scaleInput=inspector.querySelector("#devTerrainTextureScale"),scaleReadout=inspector.querySelector("#devTerrainScaleReadout");
    if(scaleInput){
      const previewScale=()=>{const rec=developerTerrainRecord(devTerrainSelectedId);if(!rec)return;const scale=clamp(numberOr(scaleInput.value,100)/100,.1,4);rec.textureScale=scale;window.LR_TERRAINS=devTerrains;if(scaleReadout)scaleReadout.value=`≈ ${(1/scale).toFixed(2)}×`;};
      scaleInput.addEventListener("input",previewScale);
      scaleInput.addEventListener("change",()=>{previewScale();saveDeveloperDraft();devSetStatus(`Texture scale preview: ${Math.round(clamp(numberOr(scaleInput.value,100)/100,.1,4)*100)}%`);});
    }
    inspector.querySelector("#devTerrainPreviewFootsteps")?.addEventListener("click",()=>{const id=inspector.querySelector("#devTerrainFootstepSet")?.value;if(id)developerAudioPreview(id);else devSetStatus("Choose a footstep sound set first");});inspector.querySelector("#devTerrainOpenAudio")?.addEventListener("click",()=>setDeveloperTab("audio"));
    inspector.querySelector("#devTerrainSave")?.addEventListener("click",saveDeveloperTerrainFromInspector);inspector.querySelector("#devTerrainDuplicate")?.addEventListener("click",duplicateDeveloperTerrain);inspector.querySelector("#devTerrainDelete")?.addEventListener("click",deleteDeveloperTerrain);
  }
  const newTerrain=devPanel.querySelector("#devTerrainNew");if(newTerrain)newTerrain.onclick=()=>createDeveloperTerrain("New Terrain");
}
