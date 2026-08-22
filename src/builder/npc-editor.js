function developerSafeId(value,fallback="id"){
  return String(value||fallback).trim().toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9_-]+/g,"")||fallback;
}

function developerNpcAssetOptions(selectedId=""){
  const entries=developerNpcSpriteAssets();
  const options=entries.map(([id,asset])=>`<option value="${questEscape(id)}" ${id===selectedId?"selected":""}>${questEscape(asset.name||id)}</option>`);
  if(!options.length)return '<option value="">No NPC Sprite assets imported</option>';
  return options.join("");
}

function refreshDeveloperNpcInspectorValues(){
  if(!devPanel||!devSelectedNpc) return;
  const root=devPanel.querySelector("#devNpcInspector");if(!root)return;
  const x=root.querySelector("#devNpcX"),y=root.querySelector("#devNpcY");if(x)x.value=Math.round(devSelectedNpc.x);if(y)y.value=Math.round(devSelectedNpc.y);
}

function updateQuestNpcReferences(oldId,newId){
  if(!oldId||oldId===newId) return;
  for(const quest of questDefinitions){
    if(quest.giverNpc===oldId) quest.giverNpc=newId;
    if(quest.turnInNpc===oldId) quest.turnInNpc=newId;
    for(const objective of quest.objectives) if(objective.type==="talk"&&objective.target===oldId) objective.target=newId;
  }
  if(activeNpcDialogId===oldId) activeNpcDialogId=newId;
}

function saveDeveloperNpc(){
  if(!devPanel||!devSelectedNpc)return;const root=devPanel.querySelector("#devNpcInspector");if(!root)return;
  const oldId=devSelectedNpc.id;let newId=developerSafeId(root.querySelector("#devNpcId")?.value,oldId||"npc");
  if(sceneryNPCs.some(n=>n!==devSelectedNpc&&n.id===newId)){devSetStatus(`NPC id '${newId}' is already in use`);return;}
  const spriteAsset=root.querySelector("#devNpcSpriteAsset")?.value||"";
  if(!developerApplyNpcSpriteAsset(devSelectedNpc,spriteAsset)){devSetStatus("Choose a valid NPC Sprite asset");return;}
  devSelectedNpc.id=newId;devSelectedNpc.name=root.querySelector("#devNpcName")?.value.trim()||newId;devSelectedNpc.role=root.querySelector("#devNpcRole")?.value.trim()||"Villager";
  devSelectedNpc.x=numberOr(root.querySelector("#devNpcX")?.value,devSelectedNpc.x);devSelectedNpc.y=numberOr(root.querySelector("#devNpcY")?.value,devSelectedNpc.y);devSelectedNpc.facing=root.querySelector("#devNpcFacing")?.value||"down";
  devSelectedNpc.displayHeight=Math.max(24,numberOr(root.querySelector("#devNpcHeight")?.value,58));devSelectedNpc.interactRadius=Math.max(24,numberOr(root.querySelector("#devNpcRange")?.value,58));
  devSelectedNpc.greeting=root.querySelector("#devNpcGreeting")?.value.trim()||`Hello. I'm ${devSelectedNpc.name}.`;devSelectedNpc.solid=!!root.querySelector("#devNpcSolid")?.checked;
  updateQuestNpcReferences(oldId,newId);rebuildNpcCollision();saveDeveloperDraft();refreshDeveloperPanel();refreshQuestUI();devSetStatus(`Saved NPC: ${devSelectedNpc.name}`);
}

function duplicateDeveloperNpc(){
  if(!devSelectedNpc)return;const copy=normalizeNpcRecord({...cloneNpc(devSelectedNpc),id:uniqueNpcId(devSelectedNpc.id),name:`${devSelectedNpc.name} Copy`,x:devSelectedNpc.x+devSnap*2,y:devSelectedNpc.y+devSnap*2},sceneryNPCs.length);
  sceneryNPCs.push(copy);devSelectedNpc=copy;rebuildNpcCollision();saveDeveloperDraft();refreshDeveloperPanel();
}

function deleteDeveloperNpc(){
  if(!devSelectedNpc)return;const refs=questDefinitions.filter(q=>q.giverNpc===devSelectedNpc.id||q.turnInNpc===devSelectedNpc.id||q.objectives.some(o=>o.type==="talk"&&o.target===devSelectedNpc.id));
  const warning=refs.length?` ${refs.length} quest(s) reference this NPC and will need repair.`:"";if(!confirm(`Delete ${devSelectedNpc.name}?${warning}`))return;
  const i=sceneryNPCs.indexOf(devSelectedNpc);if(i>=0)sceneryNPCs.splice(i,1);devSelectedNpc=null;rebuildNpcCollision();saveDeveloperDraft();refreshDeveloperPanel();refreshQuestUI();
}

function refreshDeveloperNpcPanel(){
  if(!devPanel)return;refreshDeveloperNpcAssetPalette();
  const list=devPanel.querySelector("#devNpcList"),inspector=devPanel.querySelector("#devNpcInspector"),count=devPanel.querySelector("#devNpcCount");if(count)count.textContent=`${sceneryNPCs.length} placed`;
  if(list){list.innerHTML="";for(const npc of sceneryNPCs){const b=document.createElement("button");b.className="devNpcChip"+(npc===devSelectedNpc?" active":"");b.textContent=`${npc.name} • ${npc.role}`;b.onclick=()=>{devSelectedNpc=npc;devSelected=null;devSelectedMob=null;devPlaceType=null;devPlaceNpcAsset=null;setDeveloperTab("npcs");refreshDeveloperPanel();};list.appendChild(b);}}
  if(!inspector)return;if(!devSelectedNpc){inspector.innerHTML='<div class="devEmpty">Choose an NPC from the list, click one in the world, or choose an NPC Sprite above and click the world to place it.</div>';return;}
  let selectedAsset=developerNpcAssetId(devSelectedNpc);if(!selectedAsset&&developerNpcSpriteAssets().length){selectedAsset=developerNpcSpriteAssets()[0][0];developerApplyNpcSpriteAsset(devSelectedNpc,selectedAsset);}
  const selectedRec=devAssets?.[selectedAsset];
  inspector.innerHTML=`<div class="devNpcInspector">
    <div class="devSelectedTitle">${questEscape(devSelectedNpc.name)}</div>
    <div class="devPair"><label>ID<input id="devNpcId" value="${questEscape(devSelectedNpc.id)}"></label><label>Name<input id="devNpcName" value="${questEscape(devSelectedNpc.name)}"></label></div>
    <div class="devPair"><label>Role<input id="devNpcRole" value="${questEscape(devSelectedNpc.role||"Villager")}"></label><label>NPC Sprite Asset<select id="devNpcSpriteAsset">${developerNpcAssetOptions(selectedAsset)}</select></label></div>
    ${selectedRec?`<div class="devHint">Using <b>${questEscape(selectedRec.name||selectedAsset)}</b> from the shared Asset Library. Lilly, Jorge, Farmer, and future NPC art all use this same path.</div>`:""}
    <div class="devPair"><label>X<input id="devNpcX" type="number" value="${Math.round(devSelectedNpc.x)}"></label><label>Y<input id="devNpcY" type="number" value="${Math.round(devSelectedNpc.y)}"></label></div>
    <div class="devPair"><label>Facing<select id="devNpcFacing">${["down","right","left","up"].map(v=>`<option value="${v}" ${v===devSelectedNpc.facing?"selected":""}>${v}</option>`).join("")}</select></label><label>Sprite Height<input id="devNpcHeight" type="number" min="24" value="${numberOr(devSelectedNpc.displayHeight,58)}"></label></div>
    <label>Talk Radius<input id="devNpcRange" type="number" min="24" value="${numberOr(devSelectedNpc.interactRadius,58)}"></label>
    <label>Greeting<textarea id="devNpcGreeting">${questEscape(devSelectedNpc.greeting||"")}</textarea></label>
    <label style="flex-direction:row;align-items:center"><input id="devNpcSolid" type="checkbox" ${devSelectedNpc.solid!==false?"checked":""}> Solid collision</label>
    <div class="devRow"><button id="devNpcSave">Save NPC</button><button id="devNpcDuplicate">Duplicate</button><button id="devNpcDelete" class="danger">Delete</button></div>
  </div>`;
  inspector.querySelector("#devNpcSave").onclick=saveDeveloperNpc;inspector.querySelector("#devNpcDuplicate").onclick=duplicateDeveloperNpc;inspector.querySelector("#devNpcDelete").onclick=deleteDeveloperNpc;
  const heightInput=inspector.querySelector("#devNpcHeight");heightInput.oninput=e=>{devSelectedNpc.displayHeight=Math.max(24,numberOr(e.target.value,devSelectedNpc.displayHeight));rebuildNpcCollision();refreshDeveloperInspectorValues();};heightInput.onchange=()=>saveDeveloperDraft();
  inspector.querySelector("#devNpcSpriteAsset").onchange=e=>{if(developerApplyNpcSpriteAsset(devSelectedNpc,e.target.value)){saveDeveloperDraft();refreshDeveloperPanel();}};
  inspector.querySelector("#devNpcFacing").onchange=e=>{devSelectedNpc.facing=e.target.value||"down";saveDeveloperDraft();};
}
