function devPointerDown(event){
  if(!devModeActive) return;
  if(developerBeginCameraPan(event))return;
  event.preventDefault(); event.stopImmediatePropagation();
  const p=devWorldFromPointer(event);
  if(devActiveTab==="terrain"){
    beginDeveloperTerrainPaint(p,event);
    return;
  }
  if(devPlaceMobType){
    placeDeveloperMobSpawn(devPlaceMobType,p.x,p.y);
    return;
  }
  if(devPlaceNpcAsset){
    placeDeveloperNpc(devPlaceNpcAsset,p.x,p.y);
    return;
  }
  if(devPlaceType){
    placeDeveloperObject(devPlaceType,p.x,p.y);
    return;
  }

  const sizeHandle=findDeveloperSizeInteraction(p.x,p.y);
  if(sizeHandle){
    const target=developerVisualSizeTarget(),bounds=developerVisualSizeBounds(target);if(!target||!bounds)return;
    const point=developerVisualSizeHandlePoints(target,bounds).find(row=>row[0]===sizeHandle)||[sizeHandle,bounds.x+bounds.w,bounds.y+bounds.h];
    devDragging=false;devNpcDragging=false;
    devSizeDrag={kind:target.kind,entity:target.entity,key:target.key||"",handle:sizeHandle,pointerX:p.x,pointerY:p.y,bounds:{...bounds},startHeight:target.kind==="mob"?mobWorldDisplayHeight(target.entity):target.kind==="npc"?Math.max(24,numberOr(target.entity.displayHeight,58)):bounds.h,anchorX:target.kind==="mob"?target.entity.x:target.kind==="npc"?target.entity.x:0,anchorY:target.kind==="mob"?target.entity.y+8:target.kind==="npc"?target.entity.y+14:0,startDistance:target.kind==="object"?1:Math.max(1,Math.hypot(point[1]-(target.entity.x||0),point[2]-(target.kind==="mob"?target.entity.y+8:target.entity.y+14)))};
    if(game?.style)game.style.cursor=developerHitboxCursor(sizeHandle);
    try{game.setPointerCapture?.(event.pointerId);}catch{}
    devSetStatus(target.kind==="mob"?`Resizing ${mobTypeScaleLabel(target.key)} — release to save global mob size`:"Resizing visual sprite — release to save");
    return;
  }

  const interactionAreaHandle=findDeveloperInteractionAreaHandle(p.x,p.y);
  if(interactionAreaHandle){
    const area=ensureDeveloperInteractionArea(devSelected);
    devDragging=false;devNpcDragging=false;
    devInteractionDrag={handle:interactionAreaHandle,pointerX:p.x,pointerY:p.y,area:{x:area.x,y:area.y,w:area.w,h:area.h}};
    if(game?.style)game.style.cursor=developerHitboxCursor(interactionAreaHandle);
    try{game.setPointerCapture?.(event.pointerId);}catch{}
    devSetStatus(interactionAreaHandle==="move"?"Moving interaction area — release to save":"Resizing interaction area — release to save");
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

  if(devActiveTab==="spawns"){
    const spawn=findDeveloperSpawnAt(p.x,p.y);
    if(spawn){beginDeveloperSpawnDrag(spawn,p,event);return;}
    const spawnMob=findDeveloperMobAt(p.x,p.y);
    if(spawnMob?.spawnId){const record=developerSpawnById(spawnMob.spawnId);if(record){beginDeveloperSpawnDrag(record,p,event);return;}}
  }

  const npc=findDeveloperNpcAt(p.x,p.y);
  if(npc){
    const sameSizeTarget=devSizeEditing&&devSelectedNpc===npc;
    devSelectedNpc=npc;
    if(!sameSizeTarget){devSizeEditing=false;devSizeDrag=null;}
    devSelected=null;devSelectedMob=null;devSelectedRemnant=null;
    devInteractionEditing=false;devInteractionDrag=null;
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
    const sameSizeTarget=devSizeEditing&&devSelectedMob===mob;
    devSelectedMob=mob;
    if(!sameSizeTarget){devSizeEditing=false;devSizeDrag=null;}
    devSelected=null;devSelectedNpc=null;devSelectedRemnant=null;
    devDragging=false;devNpcDragging=false;
    devHitboxEditing=false;
    devHitboxDrag=null;
    devDepthEditing=false;
    devDepthDrag=null;
    devInteractionEditing=false;
    devInteractionDrag=null;
    devCombatMobType=mobTypeScaleKey(mob);
    if(devActiveTab!=="combat") setDeveloperTab("scale");
    refreshDeveloperPanel();
    if(devActiveTab==="combat") devSetStatus(`${mobTypeScaleLabel(devCombatMobType)} selected — combat tuning now targets this species`);
    else devSetStatus(`${mobTypeScaleLabel(devCombatMobType)} selected — scale changes affect every ${mobTypeScaleLabel(devCombatMobType).toLowerCase()}`);
    return;
  }

  devSelectedMob=null;devSelectedNpc=null;devSelectedRemnant=null;
  const previousSelected=devSelected;
  devSelected=findWorldObjectAt(p.x,p.y);
  if(devSelected){
    if(!(devSizeEditing&&previousSelected===devSelected)){devSizeEditing=false;devSizeDrag=null;}
    setDeveloperTab("selection");
    if(devInteractionEditing){
      ensureDeveloperInteractionArea(devSelected);devDragging=false;
      devSetStatus(`Selected ${devSelected.label||devSelected.type} — drag the green interaction area or its handles`);
    }else if(devHitboxEditing){
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
    devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;devInteractionEditing=false;devInteractionDrag=null;
    devSetStatus("Nothing selected — choose a prop/NPC from Selection or place one from its palette");
  }
  refreshDeveloperPanel();
}
function devPointerMove(event){
  if(!devModeActive) return;
  if(developerUpdateCameraPan(event))return;
  const p=devWorldFromPointer(event);

  if(devActiveTab==="terrain"){
    devTerrainHoverTile=developerTerrainTileAt(p.x,p.y);
    if(game?.style)game.style.cursor="crosshair";
    if(devTerrainPainting){event.preventDefault();event.stopImmediatePropagation();updateDeveloperTerrainPaint(p);}
    return;
  }

  if(devSpawnDragging){
    event.preventDefault();event.stopImmediatePropagation();updateDeveloperSpawnDrag(p);return;
  }

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

  if(devSizeDrag){
    event.preventDefault();event.stopImmediatePropagation();updateDeveloperSizeDrag(p);return;
  }

  if(devInteractionDrag && devSelected){
    event.preventDefault();event.stopImmediatePropagation();updateDeveloperInteractionAreaDrag(p);return;
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

  if(devSizeEditing && developerVisualSizeTarget() && game?.style){
    game.style.cursor=developerHitboxCursor(findDeveloperSizeInteraction(p.x,p.y));
  }else if(devInteractionEditing && devSelected && game?.style){
    game.style.cursor=developerHitboxCursor(findDeveloperInteractionAreaHandle(p.x,p.y));
  }else if(devDepthEditing && developerSelectedEntity() && game?.style){
    game.style.cursor=findDeveloperDepthInteraction(p.x,p.y)?"ns-resize":"";
  }else if(devHitboxEditing && developerSelectedEntity() && game?.style){
    game.style.cursor=developerHitboxCursor(findDeveloperHitboxInteraction(p.x,p.y));
  }else if(game?.style && !devDragging && !devNpcDragging && !devRemnantDragging && !devSpawnDragging){
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
  if(devModeActive&&developerEndCameraPan(event))return;
  if(!devModeActive || (!devTerrainPainting && !devDragging && !devNpcDragging && !devRemnantDragging && !devSpawnDragging && !devSizeDrag && !devHitboxDrag && !devDepthDrag && !devInteractionDrag)) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if(devTerrainPainting){finishDeveloperTerrainPaint(event);return;}
  const finishedNpc=!!devNpcDragging;
  const finishedRemnant=!!devRemnantDragging;
  const finishedSpawn=!!devSpawnDragging;
  devDragging=false;devNpcDragging=false;devRemnantDragging=false;devSpawnDragging=false;
  const finishedSize=!!devSizeDrag;
  const finishedHitbox=!!devHitboxDrag;
  const finishedDepth=!!devDepthDrag;
  const finishedInteraction=!!devInteractionDrag;
  devSizeDrag=null;
  devHitboxDrag=null;
  devDepthDrag=null;
  devInteractionDrag=null;
  try{ game.releasePointerCapture?.(event.pointerId); }catch{}
  if(finishedSpawn){finishDeveloperSpawnDrag();return;}
  saveDeveloperDraft();
  if(finishedRemnant) devSetStatus("Remnant preview position updated — runtime piles use the same scale/depth settings");
  else if(finishedNpc) devSetStatus("NPC position updated");
  else if(finishedSize) devSetStatus("Visual size updated — hitboxes and interaction areas stay independent so you can tune them separately");
  else if(finishedHitbox) devSetStatus("Hitbox updated — keep dragging handles or click Finish Hitbox Editing");
  else if(finishedDepth) devSetStatus("Depth line updated — move around the NPC/object to test overlap");
  else if(finishedInteraction) devSetStatus("Interaction area updated — click Finish Interaction Area when it covers the usable part of the object");
}

function deleteDeveloperSelection(){
  if(!devSelected) return;
  const i=sceneryProps.indexOf(devSelected);
  if(i>=0) sceneryProps.splice(i,1);
  devSelected=null;
  devSizeEditing=false;
  devSizeDrag=null;
  devHitboxEditing=false;
  devHitboxDrag=null;
  devDepthEditing=false;
  devDepthDrag=null;
  devInteractionEditing=false;
  devInteractionDrag=null;
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

function syncDeveloperInspectorFromPanel({saveDraft=false}={}){
  if(!devPanel||!devSelected) return false;
  const q=id=>devPanel.querySelector(`#${id}`);
  const x=q("devX"),y=q("devY"),label=q("devLabel"),solid=q("devSolid"),interactable=q("devInteractable"),capacity=q("devCapacity");
  if(!x||!y||!label||!solid||!interactable||!capacity) return false;
  devSelected.x=numberOr(x.value,devSelected.x);
  devSelected.y=numberOr(y.value,devSelected.y);
  devSelected.label=label.value.trim()||devSelected.type;
  if(q("devObjectW"))devSelected.w=Math.max(8,numberOr(q("devObjectW").value,worldObjectSpec(devSelected)?.w||64));
  if(q("devObjectH"))devSelected.h=Math.max(8,numberOr(q("devObjectH").value,worldObjectSpec(devSelected)?.h||64));
  devSelected.solid=solid.checked;
  devSelected.interactable=interactable.checked;
  const previous=worldObjectInteraction(devSelected);
  const area=ensureDeveloperInteractionArea(devSelected)||previous.area;
  devSelected.interaction={
    enabled:devSelected.interactable,
    type:q("devInteractionType")?.value||previous.type,
    prompt:q("devInteractionPrompt")?.value.trim()||previous.prompt,
    soundId:q("devInteractionSound")?.value||"",
    range:Math.max(20,numberOr(q("devInteractionRange")?.value,previous.range)),
    clickable:q("devInteractionClickable")?.checked!==false,
    keyable:q("devInteractionKeyable")?.checked!==false,
    tag:q("devInteractionTag")?.value.trim()||devSelected.id,
    area:{x:numberOr(q("devIaX")?.value,area.x),y:numberOr(q("devIaY")?.value,area.y),w:Math.max(4,numberOr(q("devIaW")?.value,area.w)),h:Math.max(4,numberOr(q("devIaH")?.value,area.h))},
    requirements:{questId:q("devReqQuest")?.value||"",questState:q("devReqQuestState")?.value||"active",itemId:q("devReqItem")?.value||"",itemQty:Math.max(1,Math.floor(numberOr(q("devReqItemQty")?.value,1)))},
    actions:{targetZone:q("devActionZone")?.value||"",targetX:q("devActionX")?.value===""?null:numberOr(q("devActionX")?.value,null),targetY:q("devActionY")?.value===""?null:numberOr(q("devActionY")?.value,null),giveItemId:q("devActionItem")?.value||"",giveItemQty:Math.max(1,Math.floor(numberOr(q("devActionItemQty")?.value,1))),openMode:q("devOpenMode")?.value||previous.actions.openMode||"simple",lootTable:q("devActionLoot")?.value||"",questIds:[...devPanel.querySelectorAll("[data-dev-object-quest]:checked")].map(el=>el.value),questBehavior:q("devQuestBehavior")?.value||"offer",consumeRequiredItem:!!q("devConsumeReqItem")?.checked,message:q("devActionMessage")?.value.trim()||""},
    useMode:q("devUseMode")?.value||"repeatable",resetSeconds:Math.max(1,numberOr(q("devResetSeconds")?.value,30)),hideWhenUsed:!!q("devHideWhenUsed")?.checked
  };
  devSelected.interactionTag=devSelected.interaction.tag;
  const emitterId=q("devEmitterSound")?.value||"";devSelected.soundEmitter=emitterId?{clipId:emitterId,volume:Math.max(0,Math.min(2,numberOr(q("devEmitterVolume")?.value,70)/100)),radius:Math.max(50,numberOr(q("devEmitterRadius")?.value,420)),loop:true}:null;
  devSelected.capacity=Math.max(1,Math.round(numberOr(capacity.value,8)));
  devSelected.hitbox=devSelected.hitbox||{};
  devSelected.hitbox.x=numberOr(q("devHbX")?.value,devSelected.hitbox.x||0);
  devSelected.hitbox.y=numberOr(q("devHbY")?.value,devSelected.hitbox.y||0);
  devSelected.hitbox.w=Math.max(1,numberOr(q("devHbW")?.value,devSelected.hitbox.w||16));
  devSelected.hitbox.h=Math.max(1,numberOr(q("devHbH")?.value,devSelected.hitbox.h||12));
  devSelected.depthMode=WORLD_OBJECT_DEPTH_MODES.has(q("devDepthMode")?.value)?q("devDepthMode").value:"ysort";
  devSelected.depthY=numberOr(q("devDepthY")?.value,defaultWorldObjectDepthY(devSelected));
  if(devSelected.depthMode!=="ysort"){devDepthEditing=false;devDepthDrag=null;}
  rebuildWorldObjectCollision();
  if(saveDraft)saveDeveloperDraft();
  return true;
}

function updateDeveloperInteractionAreaFromInputs({saveDraft=false}={}){
  if(!devPanel||!devSelected)return;
  const q=id=>devPanel.querySelector(`#${id}`),area=ensureDeveloperInteractionArea(devSelected);if(!area)return;
  const read=(id,fallback,min=null)=>{const el=q(id);if(!el||String(el.value).trim()==="")return fallback;const n=Number(el.value);if(!Number.isFinite(n))return fallback;return min==null?n:Math.max(min,n);};
  area.x=Math.round(read("devIaX",area.x));area.y=Math.round(read("devIaY",area.y));area.w=Math.round(read("devIaW",area.w,4));area.h=Math.round(read("devIaH",area.h,4));
  devSelected.interaction=devSelected.interaction||{};devSelected.interaction.area=area;
  if(saveDraft)saveDeveloperDraft();
}

function applyDeveloperInspector(){
  if(!syncDeveloperInspectorFromPanel({saveDraft:true}))return;
  refreshDeveloperPanel(false);
  devSetStatus("Object settings applied");
}

function applyDeveloperNpcVisualInspector(){
  if(!devPanel||!devSelectedNpc) return;
  const q=id=>devPanel.querySelector(`#${id}`);
  devSelectedNpc.x=numberOr(q("devX")?.value,devSelectedNpc.x);
  devSelectedNpc.y=numberOr(q("devY")?.value,devSelectedNpc.y);
  developerApplyNpcSpriteAsset(devSelectedNpc,q("devNpcSelectionSprite")?.value||developerNpcAssetId(devSelectedNpc));
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
  if(!developerIsNpc(entity)){const a=ensureDeveloperInteractionArea(entity);if(q("devIaX"))q("devIaX").value=Math.round(a.x);if(q("devIaY"))q("devIaY").value=Math.round(a.y);if(q("devIaW"))q("devIaW").value=Math.round(a.w);if(q("devIaH"))q("devIaH").value=Math.round(a.h);}
  if(developerIsNpc(entity)){
    if(q("devNpcSelectionHeight")) q("devNpcSelectionHeight").value=Math.round(entity.displayHeight);
    if(q("devNpcSelectionSprite")) q("devNpcSelectionSprite").value=developerNpcAssetId(entity);
    if(q("devNpcSelectionFacing")) q("devNpcSelectionFacing").value=entity.facing||"down";
  }
}

function refreshDeveloperObjectList(){
  if(!devPanel) return;
  const list=devPanel.querySelector("#devObjectList");
  const count=devPanel.querySelector("#devObjectCount");
  if(count) count.textContent=`${sceneryProps.length} placed`;
  if(!list) return;
  list.innerHTML="";const query=String(devPanel.querySelector("#devPlacedObjectSearch")?.value||"").trim().toLowerCase();
  for(const obj of sceneryProps){const objectName=worldObjectDefinition(obj)?.name||obj.objectId||"Object";if(query&&!`${obj.label||""} ${objectName} ${obj.id||""}`.toLowerCase().includes(query))continue;
    const b=document.createElement("button");
    b.className="devObjectChip"+(obj===devSelected?" active":"");
    b.textContent=obj.label||objectName;
    b.title=`${objectName} @ ${Math.round(obj.x)}, ${Math.round(obj.y)}`;
    b.onclick=()=>{
      devPlaceType=null;devPlaceNpcAsset=null;
      devSelectedMob=null;devSelectedNpc=null;devSelectedRemnant=null;
      devSelected=obj;
      setDeveloperTab("selection");
      updateDevPaletteActive();
      refreshDeveloperPanel();
      devSetStatus(`Selected ${obj.label||worldObjectDefinition(obj)?.name||obj.objectId||"Object"}`);
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
      devPlaceType=null;devPlaceNpcAsset=null;devSelectedMob=null;devSelectedRemnant=null;devSelected=null;devSelectedNpc=npc;
      devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;
      setDeveloperTab("selection");updateDevPaletteActive();refreshDeveloperPanel();
      devSetStatus(`Selected NPC ${npc.name} — visual size, hitbox, and depth are editable here`);
    };
    list.appendChild(b);
  }
  for(const obj of sceneryProps){
    const b=document.createElement("button");
    b.className="devObjectChip"+(obj===devSelected?" active":"");
    const objectName=worldObjectDefinition(obj)?.name||obj.objectId||"Object";
    b.textContent=`OBJECT • ${obj.label||objectName}`;
    b.title=`${objectName} @ ${Math.round(obj.x)}, ${Math.round(obj.y)}`;
    b.onclick=()=>{
      devPlaceType=null;devPlaceNpcAsset=null;devSelectedMob=null;devSelectedRemnant=null;devSelectedNpc=null;devSelected=obj;
      devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;
      setDeveloperTab("selection");updateDevPaletteActive();refreshDeveloperPanel();
      devSetStatus(`Selected ${obj.label||worldObjectDefinition(obj)?.name||obj.objectId||"Object"}`);
    };
    list.appendChild(b);
  }
}

