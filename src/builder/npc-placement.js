function developerNpcSpriteAssets(){
  return Object.entries(devAssets||{}).filter(([,asset])=>asset?.type==="npcSprite");
}

function developerNpcAssetId(npc){
  if(npc?.spriteAsset&&devAssets?.[npc.spriteAsset]?.type==="npcSprite")return npc.spriteAsset;
  const path=String(npc?.sprite||"").replace(/^\.\//,"");
  if(!path)return "";
  return developerNpcSpriteAssets().find(([,asset])=>String(asset?.path||"").replace(/^\.\//,"")===path)?.[0]||"";
}

function developerNpcAssetPath(assetId){
  const asset=devAssets?.[assetId];
  if(!asset||asset.type!=="npcSprite")return NPC_PLACEHOLDER_SPRITE;
  const path=String(asset.path||"").trim();
  return path?(path.startsWith("./")?path:`./${path}`):NPC_PLACEHOLDER_SPRITE;
}

function developerApplyNpcSpriteAsset(npc,assetId){
  if(!npc)return false;
  const asset=devAssets?.[assetId];
  if(!asset||asset.type!=="npcSprite")return false;
  npc.spriteAsset=assetId;
  npc.sprite=developerNpcAssetPath(assetId);
  return true;
}

function refreshDeveloperNpcAssetPalette(){
  if(!devPanel)return;
  const palette=devPanel.querySelector("#devNpcAssetPalette");
  if(!palette)return;
  const query=String(devPanel.querySelector("#devNpcSearch")?.value||"").trim().toLowerCase(),entries=developerNpcSpriteAssets().filter(([id,asset])=>!query||`${asset?.name||""} ${id}`.toLowerCase().includes(query));
  palette.innerHTML=entries.map(([id,asset])=>`<button class="devAssetChip ${id===devPlaceNpcAsset?"active":""}" data-npc-asset="${devContentEscape(id)}" title="Place ${devContentEscape(asset.name||id)}"><img src="./${devContentEscape(String(asset.path||"").replace(/^\.\//,""))}" alt=""><span><b>${devContentEscape(asset.name||id)}</b><small>NPC Sprite</small></span></button>`).join("")||'<div class="devEmpty">No NPC Sprite assets yet. Import one in Assets.</div>';
  palette.querySelectorAll("[data-npc-asset]").forEach(button=>button.onclick=()=>{
    devPlaceNpcAsset=button.dataset.npcAsset;devPlaceType=null;devPlaceMobType=null;devSelected=null;devSelectedNpc=null;devSelectedMob=null;
    setDeveloperTab("npcs");updateDevPaletteActive();refreshDeveloperPanel();
    const asset=devAssets?.[devPlaceNpcAsset];devSetStatus(`Placing ${asset?.name||devPlaceNpcAsset} NPC — click the world${devRepeatPlacement?" repeatedly":" once"}`);
  });
}

function uniqueNpcId(base="npc"){
  const root=String(base||"npc").toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"")||"npc";
  let id=root,n=2;
  while(sceneryNPCs.some(npc=>npc.id===id)){id=`${root}-${n++}`;}
  return id;
}

function placeDeveloperNpc(assetId,wx,wy){
  const asset=devAssets?.[assetId];
  if(!asset||asset.type!=="npcSprite"){devSetStatus("Choose an NPC Sprite asset first");return;}
  const baseName=String(asset.name||"New NPC").trim()||"New NPC";
  const npc=normalizeNpcRecord({
    id:uniqueNpcId(baseName),
    name:baseName,
    role:"Villager",
    spriteAsset:assetId,
    sprite:developerNpcAssetPath(assetId),
    x:snapDev(wx),y:snapDev(wy),facing:"down",solid:true,
    displayHeight:58,interactRadius:58,greeting:`Hello. I'm ${baseName}.`
  },sceneryNPCs.length);
  sceneryNPCs.push(npc);
  rebuildNpcCollision();
  devSelectedNpc=npc;devSelected=null;devSelectedMob=null;devSelectedRemnant=null;
  if(!devRepeatPlacement)devPlaceNpcAsset=null;
  setDeveloperTab("npcs");
  saveDeveloperDraft();refreshDeveloperPanel();updateDevPaletteActive();
  devSetStatus(devRepeatPlacement?`Placed ${npc.name} • repeat NPC placement remains active`:`Placed ${npc.name} • Select / Move restored; edit its details below`);
}

function findDeveloperNpcAt(wx,wy){return findNpcAtWorld(wx,wy);}

function placeDeveloperObject(type,wx,wy){
  const obj=defaultWorldObject(type,0,0);
  const spec=worldObjectSpec(obj);
  if(!spec) return;
  obj.x=snapDev(wx-spec.w/2);obj.y=snapDev(wy-spec.h/2);
  sceneryProps.push(obj);
  devSelected=obj;devSelectedMob=null;devSelectedNpc=null;devSelectedRemnant=null;
  if(devRepeatPlacement){setDeveloperTab("objects");}else{devPlaceType=null;setDeveloperTab("selection");}
  rebuildWorldObjectCollision();saveDeveloperDraft();refreshDeveloperPanel();updateDevPaletteActive();
  devSetStatus(devRepeatPlacement?`Placed ${obj.label||worldObjectDefinition(obj)?.name||obj.objectId||"Object"} • repeat placement remains active`:`Placed ${obj.label||worldObjectDefinition(obj)?.name||obj.objectId||"Object"} • Select / Move restored`);
}
