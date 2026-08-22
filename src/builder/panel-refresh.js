function refreshDeveloperPanel(rebuild=true){
  if(!devPanel) return;
  if(!rebuild){ refreshDeveloperInspectorValues(); return; }
  const inspector=devPanel.querySelector("#devInspector");
  if(!inspector) return;
  refreshDeveloperObjectList();
  refreshDeveloperObjectPalette();
  refreshDeveloperSelectionList();
  refreshDeveloperNpcPanel();
  refreshDeveloperSpawnPanel();
  refreshDeveloperQuestPanel();
  refreshDeveloperContentPanel();
  refreshDeveloperAssetPanel();
  refreshDeveloperAudioPanel();
  refreshDeveloperProjectPanel();
  refreshDeveloperZonePanel();
  refreshDeveloperTerrainPanel();
  refreshDeveloperMobPanel();
  refreshDeveloperCombatPanel();
  developerRefreshCameraUi?.();

  const entity=developerSelectedEntity();
  if(devSelectedRemnant && !entity && !devSelectedMob){
    const label=devSelectedRemnant==="lootable"?"Lootable Dust":"Dust";
    const mode=lootRemnantDepthMode();
    inspector.innerHTML=`
      <div class="devSelectedTitle">REMNANT • ${label}</div>
      <div class="devHint">This is a temporary World Builder preview. Scale and depth are global: both plain and lootable mob-death piles use the same settings. Drag the preview in the world to test overlap against the player, NPCs, and props.</div>
      <div class="devScaleControl"><div class="devScaleTop"><span>Remnant Scale</span><span id="devRemnantScaleValue">${LOOT_REMNANT_VISUAL.scale.toFixed(2)}×</span></div><input id="devRemnantScale" type="range" min="0.25" max="3.00" step="0.05" value="${LOOT_REMNANT_VISUAL.scale}"></div>
      <div class="devSubhead">Player overlap / depth</div>
      <label>Depth Mode<select id="devRemnantDepthMode"><option value="ysort" ${mode==="ysort"?"selected":""}>Y-Sort (recommended)</option><option value="behind" ${mode==="behind"?"selected":""}>Always Behind Player</option><option value="front" ${mode==="front"?"selected":""}>Always In Front of Player</option><option value="ground" ${mode==="ground"?"selected":""}>Ground / Floor</option></select></label>
      <label>Depth line Y offset<input id="devRemnantDepthY" type="range" min="-40" max="40" step="1" value="${lootRemnantDepthY()}" ${mode==="ysort"?"":"disabled"}></label>
      <div class="devPair"><label>Depth Y<input id="devRemnantDepthYNumber" type="number" min="-80" max="80" step="1" value="${lootRemnantDepthY()}" ${mode==="ysort"?"":"disabled"}></label><label>Preview<input value="${label}" disabled></label></div>
      <div class="devDepthEditHelp">With Y-Sort, the purple line is the pile's overlap anchor. Move the preview around and walk above/below it to test when the player passes behind or in front.</div>
      <div class="devRow"><button id="devRemnantNearPlayer">Move Preview Near Player</button><button id="devRemnantReset">Reset Remnant Visuals</button></div>`;
    const scaleInput=inspector.querySelector("#devRemnantScale");
    scaleInput.oninput=e=>{updateDeveloperRemnantVisual({scale:e.target.value});const out=inspector.querySelector("#devRemnantScaleValue");if(out)out.textContent=LOOT_REMNANT_VISUAL.scale.toFixed(2)+"×";saveDeveloperDraft();};
    inspector.querySelector("#devRemnantDepthMode").onchange=e=>{updateDeveloperRemnantVisual({depthMode:e.target.value});saveDeveloperDraft();refreshDeveloperPanel();};
    const depthSlider=inspector.querySelector("#devRemnantDepthY");
    const depthNumber=inspector.querySelector("#devRemnantDepthYNumber");
    const applyDepth=v=>{updateDeveloperRemnantVisual({depthY:v});if(depthSlider)depthSlider.value=LOOT_REMNANT_VISUAL.depthY;if(depthNumber)depthNumber.value=LOOT_REMNANT_VISUAL.depthY;saveDeveloperDraft();};
    depthSlider.oninput=e=>applyDepth(e.target.value);depthNumber.oninput=e=>applyDepth(e.target.value);
    inspector.querySelector("#devRemnantNearPlayer").onclick=()=>{devRemnantPreview.x=snapDev(state.x+56);devRemnantPreview.y=snapDev(state.y+8);devSetStatus("Remnant preview moved near the player");};
    inspector.querySelector("#devRemnantReset").onclick=()=>{Object.assign(LOOT_REMNANT_VISUAL,PROJECT_LOOT_REMNANT_VISUAL);saveDeveloperDraft();refreshDeveloperPanel();devSetStatus("Remnant scale/depth reset to project settings");};
    return;
  }
  if(!entity){
    inspector.innerHTML='<div class="devEmpty">Choose a prop, NPC, or Loot Remnant from the Selection Library, or click one directly in the world.</div>';
    return;
  }

  const hb=ensureDeveloperHitbox(entity);
  const depth=ensureDeveloperDepth(entity);
  const canEditDepth=depth.mode==="ysort";

  if(developerIsNpc(entity)){
    const npc=entity;
    const selectedNpcAsset=developerNpcAssetId(npc);
    const spriteChoices=developerNpcSpriteAssets().map(([id,asset])=>[id,asset?.name||id]);
    inspector.innerHTML=`
      <div class="devSelectedTitle">NPC • ${questEscape(npc.name)}</div>
      <div class="devHint">Visual placement tools for NPCs. Use the NPCs tab for ID, role, greeting, and quest setup.</div>
      <div class="devPair"><label>X<input id="devX" type="number" value="${Math.round(npc.x)}"></label><label>Y<input id="devY" type="number" value="${Math.round(npc.y)}"></label></div>
      <div class="devPair"><label>NPC Sprite Asset<select id="devNpcSelectionSprite">${spriteChoices.map(([v,l])=>`<option value="${questEscape(v)}" ${v===selectedNpcAsset?"selected":""}>${questEscape(l)}</option>`).join("")}</select></label><label>Facing<select id="devNpcSelectionFacing">${["down","right","left","up"].map(v=>`<option value="${v}" ${v===npc.facing?"selected":""}>${v}</option>`).join("")}</select></label></div>
      <label>Sprite Height<input id="devNpcSelectionHeight" type="number" min="24" value="${Math.round(npc.displayHeight)}"></label>
      <button id="devEditVisualSize" class="devSizeEditButton${devSizeEditing?" active":""}">${devSizeEditing?"Finish Visual Size":"Edit NPC Size Visually"}</button>
      <div class="devSizeEditHelp">${devSizeEditing?"Drag any blue corner handle around the NPC to resize it. NPC proportions stay locked and its world position/feet remain anchored.":"Resize the NPC directly in the world instead of guessing a Sprite Height number."}</div>
      <div class="devHint">Sprite Height updates live. Every NPC uses the same asset-driven sprite-sheet renderer.</div>
      <div class="devChecks"><label><input id="devSolid" type="checkbox" ${npc.solid!==false?"checked":""}> Hitbox / Solid</label></div>
      <div class="devSubhead">NPC collision hitbox</div>
      <div class="devQuad"><label>X<input id="devHbX" type="number" value="${hb.x}"></label><label>Y<input id="devHbY" type="number" value="${hb.y}"></label><label>W<input id="devHbW" type="number" value="${hb.w}"></label><label>H<input id="devHbH" type="number" value="${hb.h}"></label></div>
      <button id="devEditHitbox" class="devHitboxEditButton${devHitboxEditing?" active":""}">${devHitboxEditing?"Finish Hitbox Editing":"Edit NPC Hitbox Visually"}</button>
      <div class="devHitboxEditHelp">${devHitboxEditing?"Drag inside the yellow NPC hitbox to move it. Drag its corners/sides to resize it.":"NPC hitboxes are now editable with the same visual handles used by world props."}</div>
      <div class="devSubhead">NPC overlap / depth</div>
      <label>Depth Mode<select id="devDepthMode"><option value="ysort" ${depth.mode==="ysort"?"selected":""}>Y-Sort (recommended)</option><option value="behind" ${depth.mode==="behind"?"selected":""}>Always Behind Player</option><option value="front" ${depth.mode==="front"?"selected":""}>Always In Front of Player</option><option value="ground" ${depth.mode==="ground"?"selected":""}>Ground / Background</option></select></label>
      <label>Depth line Y offset<input id="devDepthY" type="number" value="${Math.round(depth.y)}" ${canEditDepth?"":"disabled"}></label>
      <button id="devEditDepth" class="devDepthEditButton${devDepthEditing?" active":""}" ${canEditDepth?"":"disabled"}>${devDepthEditing?"Finish Depth Editing":"Edit NPC Depth Line Visually"}</button>
      <div class="devDepthEditHelp">${canEditDepth?(devDepthEditing?"Drag the purple line up/down to decide when the NPC sorts behind or in front of houses, props, and the player.":"Use this to fix overlaps like an NPC appearing on the wrong side of a house wall. Move the line until the NPC sorts naturally from its feet."):"This fixed mode ignores the depth line. Switch to Y-Sort for a draggable overlap anchor."}</div>
      <div class="devRow"><button id="devApply">Apply</button><button id="devNpcDetails">NPC Details</button><button id="devDuplicate">Duplicate</button><button id="devDelete" class="danger">Delete</button></div>`;

    inspector.querySelector("#devEditVisualSize").onclick=()=>setDeveloperSizeEditing(!devSizeEditing);
    inspector.querySelector("#devEditHitbox").onclick=()=>setDeveloperHitboxEditing(!devHitboxEditing);
    inspector.querySelector("#devEditDepth").onclick=()=>setDeveloperDepthEditing(!devDepthEditing);
    inspector.querySelector("#devDepthMode").onchange=e=>{
      npc.depthMode=e.target.value;
      if(npc.depthMode!=="ysort"){devDepthEditing=false;devDepthDrag=null;} else ensureDeveloperDepth(npc);
      saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`NPC depth mode: ${e.target.options[e.target.selectedIndex].text}`);
    };
    const liveHeight=inspector.querySelector("#devNpcSelectionHeight");
    liveHeight.oninput=e=>{npc.displayHeight=Math.max(24,numberOr(e.target.value,npc.displayHeight));rebuildNpcCollision();};
    liveHeight.onchange=()=>saveDeveloperDraft();
    inspector.querySelector("#devNpcSelectionSprite").onchange=e=>{if(developerApplyNpcSpriteAsset(npc,e.target.value)){saveDeveloperDraft();refreshDeveloperPanel();}};
    inspector.querySelector("#devNpcSelectionFacing").onchange=e=>{npc.facing=e.target.value||"down";saveDeveloperDraft();};
    inspector.querySelector("#devApply").onclick=applyDeveloperNpcVisualInspector;
    inspector.querySelector("#devNpcDetails").onclick=()=>{setDeveloperTab("npcs");refreshDeveloperPanel();devSetStatus(`Editing ${npc.name} NPC details`);};
    inspector.querySelector("#devDuplicate").onclick=duplicateDeveloperNpc;
    inspector.querySelector("#devDelete").onclick=deleteDeveloperNpc;
    return;
  }

  const obj=entity;
  const interaction=worldObjectInteraction(obj);
  const ia=ensureDeveloperInteractionArea(obj);
  const esc=v=>devContentEscape(String(v??""));
  const option=(value,label,selected)=>`<option value="${esc(value)}" ${String(value)===String(selected)?"selected":""}>${esc(label)}</option>`;
  const zoneOptions=[["","No zone travel"],...(devProjectManifest?.zones||[]).map(z=>[z.id,z.name||z.id])].map(([v,l])=>option(v,l,interaction.actions.targetZone)).join("");
  const questOptions=[["","No quest requirement"],...questDefinitions.map(q=>[q.id,q.title])].map(([v,l])=>option(v,l,interaction.requirements.questId)).join("");
  const attachedQuestIds=new Set(interaction.actions.questIds||[]);
  const attachedQuestChecks=questDefinitions.length?questDefinitions.map(q=>`<label><input type="checkbox" data-dev-object-quest value="${esc(q.id)}" ${attachedQuestIds.has(q.id)?"checked":""}> ${esc(q.title)}</label>`).join(""):'<div class="devHint">No quests exist in this zone yet.</div>';
  const itemOptions=[["","No item"],...Object.keys(ITEM_DEFS).map(id=>[id,getItemDefinition(id).name])];
  const reqItemOptions=itemOptions.map(([v,l])=>option(v,l,interaction.requirements.itemId)).join("");
  const giveItemOptions=itemOptions.map(([v,l])=>option(v,l,interaction.actions.giveItemId)).join("");
  const lootOptions=[["","No loot table"],...Object.keys(LOOT_TABLES).map(id=>[id,id])].map(([v,l])=>option(v,l,interaction.actions.lootTable)).join("");
  const audioClipOptions=developerAudioRefOptions(interaction.soundId||"",{category:"sfx",includeSets:true,empty:"No interaction sound"});
  const emitter=obj.soundEmitter&&typeof obj.soundEmitter==="object"?obj.soundEmitter:{};
  const emitterOptions=developerAudioRefOptions(emitter.clipId||"",{category:"ambience",empty:"No looping emitter"});
  const objectDef=worldObjectDefinition(obj),objectName=objectDef?.name||obj.objectId||"Object";
  inspector.innerHTML=`
    <div class="devSelectedTitle">${devContentEscape(objectName)}</div>
    <label>Label<input id="devLabel" value="${String(obj.label||objectName).replace(/"/g,"&quot;")}"></label>
    <div class="devPair"><label>X<input id="devX" type="number" value="${Math.round(obj.x)}"></label><label>Y<input id="devY" type="number" value="${Math.round(obj.y)}"></label></div>
    ${worldObjectSpritePath(obj)?`<div class="devPair"><label>Display Width<input id="devObjectW" type="number" min="8" value="${Math.round(worldObjectSpec(obj)?.w||64)}"></label><label>Display Height<input id="devObjectH" type="number" min="8" value="${Math.round(worldObjectSpec(obj)?.h||64)}"></label></div><button id="devEditVisualSize" class="devSizeEditButton${devSizeEditing?" active":""}">${devSizeEditing?"Finish Visual Size":"Edit Object Size Visually"}</button><div class="devSizeEditHelp">${devSizeEditing?"Drag the blue corners or side handles around the sprite. The blue box changes the artwork size only; yellow hitboxes and green interaction areas remain independent.":"Resize the placed sprite directly in the world. You can still type exact width/height values when needed."}</div><label>Sprite<input value="${devContentEscape(worldObjectSpritePath(obj))}" readonly></label>`:""}
    <div class="devChecks"><label><input id="devSolid" type="checkbox" ${obj.solid?"checked":""}> Hitbox / Solid</label><label><input id="devInteractable" type="checkbox" ${obj.interactable?"checked":""}> Interactable</label></div>
    <div class="devSubhead">World Interaction</div>
    <div class="devHint">One shared system powers doors, buildings, gathering, quest props, chests, portals, and switches. The green area is what the player clicks or approaches.</div>
    <div class="devPair"><label>Interaction Type<select id="devInteractionType">${[["enter","Enter / Exit"],["gather","Gather"],["open","Open"],["examine","Examine"],["activate","Activate"],["custom","Custom"]].map(([v,l])=>option(v,l,interaction.type)).join("")}</select></label><label>Prompt<input id="devInteractionPrompt" value="${esc(interaction.prompt)}"></label></div>
    <div class="devSubhead">Open / Container Behavior</div>
    <div class="devHint">For Open interactions, choose persistent player storage or a loot-table chest. Storage keeps deposited items in the player save. Loot containers roll once and keep remaining loot until emptied.</div>
    <div class="devPair"><label>Open Behavior<select id="devOpenMode">${[["simple","Simple Open Action"],["storage","Storage Inventory"],["loot","Loot Container"]].map(([v,l])=>option(v,l,interaction.actions.openMode)).join("")}</select></label><label>Storage Slots<input id="devCapacity" type="number" min="1" max="60" value="${Math.max(1,obj.capacity||8)}"></label></div>
    <label>Loot Table<select id="devActionLoot">${lootOptions}</select></label>
    <div class="devPair"><label>Interaction Sound<select id="devInteractionSound">${audioClipOptions}</select></label><label><span>Preview</span><button type="button" id="devInteractionSoundPreview">▶ Preview Sound</button></label></div>
    <div class="devPair"><label>Interaction Tag<input id="devInteractionTag" value="${esc(interaction.tag||obj.id)}"></label><label>Range<input id="devInteractionRange" type="number" min="20" value="${Math.round(interaction.range)}"></label></div>
    <div class="devChecks"><label><input id="devInteractionClickable" type="checkbox" ${interaction.clickable?"checked":""}> Click / Tap</label><label><input id="devInteractionKeyable" type="checkbox" ${interaction.keyable?"checked":""}> E Key</label></div>
    <div class="devQuad"><label>Area X<input id="devIaX" type="number" value="${Math.round(ia.x)}"></label><label>Area Y<input id="devIaY" type="number" value="${Math.round(ia.y)}"></label><label>Area W<input id="devIaW" type="number" min="4" value="${Math.round(ia.w)}"></label><label>Area H<input id="devIaH" type="number" min="4" value="${Math.round(ia.h)}"></label></div>
    <button id="devEditInteractionArea" class="devHitboxEditButton${devInteractionEditing?" active":""}">${devInteractionEditing?"Finish Interaction Area":"Edit Interaction Area Visually"}</button>
    <div class="devHitboxEditHelp">${devInteractionEditing?"Drag inside the green interaction area to move it. Drag any corner or side handle to resize it. The Area X/Y/W/H fields update live while you drag, and typing those fields moves/resizes the box immediately.":"Use the visual editor like the yellow hitbox editor. Unsaved inspector changes are preserved when you enter or leave interaction-area editing."}</div>
    <div class="devSubhead">Requirements</div>
    <div class="devPair"><label>Quest<select id="devReqQuest">${questOptions}</select></label><label>Quest State<select id="devReqQuestState">${[["active","Quest Active"],["completed","Quest Completed"],["not-completed","Quest Not Completed"]].map(([v,l])=>option(v,l,interaction.requirements.questState)).join("")}</select></label></div>
    <div class="devPair"><label>Required Item<select id="devReqItem">${reqItemOptions}</select></label><label>Required Qty<input id="devReqItemQty" type="number" min="1" value="${interaction.requirements.itemQty}"></label></div>
    <div class="devSubhead">Actions</div>
    <label>Travel To Zone<select id="devActionZone">${zoneOptions}</select></label>
    <div class="devPair"><label>Destination X<input id="devActionX" type="number" placeholder="zone start" value="${interaction.actions.targetX==null?"":interaction.actions.targetX}"></label><label>Destination Y<input id="devActionY" type="number" placeholder="zone start" value="${interaction.actions.targetY==null?"":interaction.actions.targetY}"></label></div>
    <div class="devPair"><label>Give Item<select id="devActionItem">${giveItemOptions}</select></label><label>Give Qty<input id="devActionItemQty" type="number" min="1" value="${interaction.actions.giveItemQty}"></label></div>
    <label>Success Message<input id="devActionMessage" value="${esc(interaction.actions.message)}" placeholder="optional"></label>
    <div class="devChecks"><label><input id="devConsumeReqItem" type="checkbox" ${interaction.actions.consumeRequiredItem?"checked":""}> Consume required item</label><label><input id="devHideWhenUsed" type="checkbox" ${interaction.hideWhenUsed?"checked":""}> Hide after use / while respawning</label></div>
    <div class="devSubhead">Object Quests</div>
    <div class="devHint">Attach one or more quests. Offer Quests opens a quest list (good for notice boards). Start Automatically immediately accepts any attached quest that is currently available.</div>
    <label>Quest Behavior<select id="devQuestBehavior">${[["offer","Offer Quests"],["start","Start Automatically"]].map(([v,l])=>option(v,l,interaction.actions.questBehavior)).join("")}</select></label>
    <div class="devQuestAttachList">${attachedQuestChecks}</div>
    <div class="devPair"><label>Reuse / Loot Respawn<select id="devUseMode">${[["repeatable","Repeatable"],["once","One Time"],["timer","Reset on Timer"]].map(([v,l])=>option(v,l,interaction.useMode)).join("")}</select></label><label>Respawn / Reset Seconds<input id="devResetSeconds" type="number" min="1" value="${Math.round(interaction.resetSeconds)}"></label></div>
    <button id="devCreateInterior" class="devHitboxEditButton">Create & Link Interior Zone</button>
    <div class="devHint">Create & Link Interior makes a new zone, links this object as its entrance, and creates a return exit inside. Requires the project folder connection.</div>
    <div class="devSubhead">Ambient Sound Emitter</div>
    <div class="devHint">Optional positional looping sound for fireplaces, waterfalls, portals, fountains, machinery, and similar world objects.</div>
    <div class="devPair"><label>Looping Ambience<select id="devEmitterSound">${emitterOptions}</select></label><label>Volume %<input id="devEmitterVolume" type="number" min="0" max="200" value="${Math.round(numberOr(emitter.volume,.7)*100)}"></label></div>
    <div class="devPair"><label>Audible Range<input id="devEmitterRadius" type="number" min="50" max="3000" value="${Math.round(numberOr(emitter.radius,420))}"></label><label><span>Preview</span><button type="button" id="devEmitterPreview">▶ Preview Emitter</button></label></div>
    <div class="devSubhead">Hitbox offset / size</div>
    <div class="devQuad"><label>X<input id="devHbX" type="number" value="${hb.x}"></label><label>Y<input id="devHbY" type="number" value="${hb.y}"></label><label>W<input id="devHbW" type="number" value="${hb.w}"></label><label>H<input id="devHbH" type="number" value="${hb.h}"></label></div>
    <button id="devEditHitbox" class="devHitboxEditButton${devHitboxEditing?" active":""}">${devHitboxEditing?"Finish Hitbox Editing":"Edit Hitbox Visually"}</button>
    <div class="devHitboxEditHelp">${devHitboxEditing?"Drag inside the yellow hitbox to move it. Drag any corner or side handle to resize it. Hitbox editing is pixel-precise and does not use the world-placement Snap setting.":"Use the visual editor instead of typing coordinates. The numeric fields stay available for exact values."}</div>
    <div class="devSubhead">Player overlap / depth</div>
    <label>Depth Mode<select id="devDepthMode"><option value="ysort" ${depth.mode==="ysort"?"selected":""}>Y-Sort (recommended)</option><option value="behind" ${depth.mode==="behind"?"selected":""}>Always Behind Player</option><option value="front" ${depth.mode==="front"?"selected":""}>Always In Front of Player</option><option value="ground" ${depth.mode==="ground"?"selected":""}>Ground / Floor</option></select></label>
    <label>Depth line Y offset<input id="devDepthY" type="number" value="${Math.round(depth.y)}" ${canEditDepth?"":"disabled"}></label>
    <button id="devEditDepth" class="devDepthEditButton${devDepthEditing?" active":""}" ${canEditDepth?"":"disabled"}>${devDepthEditing?"Finish Depth Editing":"Edit Depth Line Visually"}</button>
    <div class="devDepthEditHelp">${canEditDepth?(devDepthEditing?"Drag the purple line up or down. Unlike the hitbox, the depth line can move outside the blue sprite box. Player feet above the line draw behind the object; feet below the line draw in front.":"Y-Sort compares the player's feet with this purple line. Use the fixed Behind/Front modes only when an object should never switch sides."):"This fixed depth mode ignores the Y-Sort line. Switch to Y-Sort to use a draggable depth anchor."}</div>

    <div class="devRow"><button id="devApply">Apply</button><button id="devDuplicate">Duplicate</button><button id="devDelete" class="danger">Delete</button></div>`;
  const preserveInspectorDraft=()=>syncDeveloperInspectorFromPanel({saveDraft:true});
  for(const id of ["devIaX","devIaY","devIaW","devIaH"]){
    const input=inspector.querySelector(`#${id}`);if(!input)continue;
    input.oninput=()=>updateDeveloperInteractionAreaFromInputs();
    input.onchange=()=>updateDeveloperInteractionAreaFromInputs({saveDraft:true});
  }
  inspector.querySelector("#devEditVisualSize")?.addEventListener("click",()=>{preserveInspectorDraft();setDeveloperSizeEditing(!devSizeEditing);});
  inspector.querySelector("#devEditInteractionArea").onclick=()=>{preserveInspectorDraft();setDeveloperInteractionEditing(!devInteractionEditing);};
  inspector.querySelector("#devCreateInterior").onclick=()=>{preserveInspectorDraft();createDeveloperInteriorForSelection();};
  inspector.querySelector("#devEditHitbox").onclick=()=>{preserveInspectorDraft();setDeveloperHitboxEditing(!devHitboxEditing);};
  inspector.querySelector("#devEditDepth").onclick=()=>{preserveInspectorDraft();setDeveloperDepthEditing(!devDepthEditing);};
  inspector.querySelector("#devDepthMode").onchange=e=>{
    preserveInspectorDraft();
    if(obj.depthMode!=="ysort"){devDepthEditing=false;devDepthDrag=null;} else ensureDeveloperDepth(obj);
    refreshDeveloperPanel();devSetStatus(`Depth mode: ${e.target.options[e.target.selectedIndex].text}`);
  };
  inspector.querySelector("#devInteractionType")?.addEventListener("change",()=>{preserveInspectorDraft();refreshDeveloperPanel(false);});
  inspector.querySelector("#devOpenMode")?.addEventListener("change",()=>{preserveInspectorDraft();refreshDeveloperPanel(false);});
  inspector.querySelector("#devInteractionSoundPreview")?.addEventListener("click",()=>{const id=inspector.querySelector("#devInteractionSound")?.value;if(id)developerAudioPreview(id);});
  inspector.querySelector("#devEmitterPreview")?.addEventListener("click",()=>{const id=inspector.querySelector("#devEmitterSound")?.value;if(id)developerAudioPreview(id);});
  inspector.querySelector("#devApply").onclick=applyDeveloperInspector;
  inspector.querySelector("#devDuplicate").onclick=()=>{preserveInspectorDraft();duplicateDeveloperSelection();};
  inspector.querySelector("#devDelete").onclick=deleteDeveloperSelection;
}

