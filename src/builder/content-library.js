function devContentClone(value){return JSON.parse(JSON.stringify(value));}
function developerCleanAssetRecords(records){const out=devContentClone(records||{});for(const asset of Object.values(out))if(asset&&typeof asset==="object")delete asset.qaStatus;return out;}
function devContentEscape(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function devContentId(value,fallback="content"){
  return String(value||fallback).trim().toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9_-]+/g,"").replace(/^-+|-+$/g,"")||fallback;
}
function devContentMap(type=devContentType){
  if(type==="items")return ITEM_DEFS;
  if(type==="lootTables")return LOOT_TABLES;
  if(type==="mobs")return BALANCE.mobs||(BALANCE.mobs={});
  return {};
}
function developerContentLibrary(){
  return {
    format:"little-realm-content-library",schemaVersion:DEV_SHARED_SCHEMA_VERSION,
    items:devContentClone(ITEM_DEFS),
    lootTables:devContentClone(LOOT_TABLES),
    mobs:devContentClone(BALANCE.mobs||{}),
    assets:developerCleanAssetRecords(devAssets),
    objectDefinitions:devContentClone(devObjectDefinitions),
    terrainDefaults:devContentClone(devTerrainDefaults),
    terrains:devContentClone(devTerrains),
    artReferences:devContentClone(devArtReferences||{}),
    characterDefaults:devContentClone(devCharacterDefaults||{}),
    audioClips:devContentClone(devAudioClips||{}),
    audioSets:devContentClone(devAudioSets||{}),
    audioEvents:devContentClone(devAudioEvents||{})
  };
}
function devReplaceObject(target,source){
  for(const key of Object.keys(target||{}))delete target[key];
  Object.assign(target,devContentClone(source||{}));
}
function applyDeveloperContentLibrary(content,{quiet=false}={}){
  if(!content||typeof content!=="object")throw new Error("Content Library is not an object");
  if(content.items&&typeof content.items==="object")devReplaceObject(ITEM_DEFS,content.items);
  if(content.lootTables&&typeof content.lootTables==="object")devReplaceObject(LOOT_TABLES,content.lootTables);
  if(content.mobs&&typeof content.mobs==="object")devReplaceObject(BALANCE.mobs||(BALANCE.mobs={}),content.mobs);
  if(content.assets&&typeof content.assets==="object")devAssets=developerCleanAssetRecords(content.assets);
  if(content.objectDefinitions&&typeof content.objectDefinitions==="object")devObjectDefinitions=devContentClone(content.objectDefinitions);
  if(content.terrains&&typeof content.terrains==="object")devTerrains=devContentClone(content.terrains);
  if(content.terrainDefaults&&typeof content.terrainDefaults==="object")devTerrainDefaults=devContentClone(content.terrainDefaults);
  devArtReferences=devContentClone(content.artReferences&&typeof content.artReferences==="object"?content.artReferences:{});
  devCharacterDefaults=devContentClone(content.characterDefaults&&typeof content.characterDefaults==="object"?content.characterDefaults:{});
  devAudioClips=devContentClone(content.audioClips&&typeof content.audioClips==="object"?content.audioClips:{});
  devAudioSets=devContentClone(content.audioSets&&typeof content.audioSets==="object"?content.audioSets:{});
  devAudioEvents=devContentClone(content.audioEvents&&typeof content.audioEvents==="object"?content.audioEvents:{});
  window.LR_AUDIO_CLIPS=devAudioClips;window.LR_AUDIO_SETS=devAudioSets;window.LR_AUDIO_EVENTS=devAudioEvents;
  window.LR_ASSETS=devAssets;window.LR_OBJECT_DEFINITIONS=devObjectDefinitions;window.LR_TERRAINS=devTerrains;window.LR_TERRAIN_DEFAULTS=devTerrainDefaults;window.LR_ART_REFERENCES=devArtReferences;window.LR_CHARACTER_DEFAULTS=devCharacterDefaults;window.LR_SHARED_CONTENT=developerContentLibrary();
  if(!devTerrains[devTerrainBrush])devTerrainBrush=Object.keys(devTerrains)[0]||"";
  if(!devTerrains[devTerrainSelectedId])devTerrainSelectedId=devTerrainBrush||Object.keys(devTerrains)[0]||null;
  if(typeof refreshMobTemplatesFromBalance==="function")refreshMobTemplatesFromBalance();
  if(typeof refreshAliveMobStatsForPlayer==="function"&&state)refreshAliveMobStatsForPlayer();
  devContentSelectedId=null;
  refreshDeveloperPanel();
  refreshInventoryViews?.();
  if(!quiet)devSetStatus(`Loaded Content Library • ${Object.keys(ITEM_DEFS).length} items • ${Object.keys(BALANCE.mobs||{}).length} mobs • ${Object.keys(devTerrains).length} terrains`);
}
function devContentTypeLabel(type){return ({items:"Items",lootTables:"Loot Tables",mobs:"Mob Types"})[type]||type;}
function devContentRecordLabel(type,id,record){
  if(type==="items")return record?.name||id;
  if(type==="lootTables")return `${id} • ${(Array.isArray(record)?record:record?.entries||[]).length} drops`;
  if(type==="mobs")return record?.name||id;
  return id;
}
function devContentEnsureSelection(){
  const map=devContentMap();
  if(devContentSelectedId&&Object.prototype.hasOwnProperty.call(map,devContentSelectedId))return;
  devContentSelectedId=Object.keys(map)[0]||null;
}
function devContentSetType(type){
  devContentType=type;devContentSelectedId=null;devContentEnsureSelection();refreshDeveloperContentPanel();
}
function devContentSelect(id){devContentSelectedId=id;refreshDeveloperContentPanel();}
function devContentUniqueId(base,type=devContentType){
  const map=devContentMap(type);const root=devContentId(base,type==="items"?"new-item":type==="mobs"?"new-mob":"new-loot-table");
  let id=root,n=2;while(Object.prototype.hasOwnProperty.call(map,id))id=`${root}-${n++}`;return id;
}
function devContentCreate(){
  const map=devContentMap();let id;
  if(devContentType==="items"){
    id=devContentUniqueId("new-item");map[id]={name:"New Item",description:"",symbol:"?",icon:"",category:"Material",rarity:"Common",stackLimit:50,sellValue:0,tags:[]};
  }else if(devContentType==="lootTables"){
    id=devContentUniqueId("new-loot-table");map[id]=[];
  }else{
    id=devContentUniqueId("new-mob");map[id]=developerNewMobDefinition();
    refreshMobTemplatesFromBalance?.();
  }
  devContentSelectedId=id;saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`Created ${devContentTypeLabel(devContentType).replace(/s$/,"")}: ${id}`);
}
function devContentDuplicate(){
  devContentEnsureSelection();if(!devContentSelectedId)return;const map=devContentMap();const src=map[devContentSelectedId];const id=devContentUniqueId(`${devContentSelectedId}-copy`);map[id]=devContentClone(src);if(map[id]&&typeof map[id]==="object"&&!Array.isArray(map[id])&&map[id].name)map[id].name+=` Copy`;devContentSelectedId=id;refreshMobTemplatesFromBalance?.();saveDeveloperDraft();refreshDeveloperPanel();
}
function devContentDelete(){
  devContentEnsureSelection();const id=devContentSelectedId;if(!id)return;const map=devContentMap();
  let warning="";
  if(devContentType==="items"){
    const refs=Object.entries(LOOT_TABLES).reduce((n,[,table])=>n+(Array.isArray(table)?table:table?.entries||[]).filter(e=>e?.itemId===id).length,0);if(refs)warning=` ${refs} loot entries reference this item and will be removed.`;
  }else if(devContentType==="lootTables"){
    const refs=Object.values(BALANCE.mobs||{}).filter(m=>m?.lootTable===id).length;if(refs)warning=` ${refs} mob definitions reference this table.`;
  }else if(devContentType==="mobs"){
    const questRefs=questDefinitions.filter(q=>q.objectives?.some(o=>o.type==="kill"&&o.target===id)).length;
    const spawnRefs=devMobSpawns.filter(spawn=>spawn.mobType===id).length;
    if(questRefs||spawnRefs){devSetStatus(`${id} is still used by ${spawnRefs} spawn(s) and ${questRefs} quest(s); change those references before deleting it`);return;}
  }
  if(!confirm(`Delete ${devContentRecordLabel(devContentType,id,map[id])}?${warning}`))return;
  const deletingMobLoot=devContentType==="mobs"?String(map[id]?.lootTable||""):"";
  delete map[id];
  if(devContentType==="items")for(const key of Object.keys(LOOT_TABLES)){const t=Array.isArray(LOOT_TABLES[key])?LOOT_TABLES[key]:LOOT_TABLES[key]?.entries;if(Array.isArray(t))for(let i=t.length-1;i>=0;i--)if(t[i]?.itemId===id)t.splice(i,1);}
  if(devContentType==="items"&&devCharacterDefaults?.starterEquipment&&typeof devCharacterDefaults.starterEquipment==="object")for(const slot of Object.keys(devCharacterDefaults.starterEquipment))if(devCharacterDefaults.starterEquipment[slot]===id)devCharacterDefaults.starterEquipment[slot]="";
  if(devContentType==="lootTables")for(const mob of Object.values(BALANCE.mobs||{}))if(mob?.lootTable===id)mob.lootTable="";
  if(devContentType==="mobs"&&deletingMobLoot===id&&!Object.values(BALANCE.mobs||{}).some(m=>m?.lootTable===id))delete LOOT_TABLES[id];
  devContentSelectedId=null;refreshMobTemplatesFromBalance?.();saveDeveloperDraft();refreshDeveloperPanel();
}
function devContentRenameKey(map,oldId,newId){
  if(oldId===newId)return true;if(Object.prototype.hasOwnProperty.call(map,newId)){devSetStatus(`ID '${newId}' is already in use`);return false;}map[newId]=map[oldId];delete map[oldId];devContentSelectedId=newId;return true;
}
function devContentSaveItem(root){
  const map=ITEM_DEFS,oldId=devContentSelectedId,newId=devContentId(root.querySelector("#devContentId").value,oldId||"item");if(!devContentRenameKey(map,oldId,newId))return;
  if(oldId!==newId){
    for(const key of Object.keys(LOOT_TABLES)){const t=Array.isArray(LOOT_TABLES[key])?LOOT_TABLES[key]:LOOT_TABLES[key]?.entries;if(Array.isArray(t))for(const e of t)if(e?.itemId===oldId)e.itemId=newId;}
    if(devCharacterDefaults?.starterEquipment&&typeof devCharacterDefaults.starterEquipment==="object")for(const slot of Object.keys(devCharacterDefaults.starterEquipment))if(devCharacterDefaults.starterEquipment[slot]===oldId)devCharacterDefaults.starterEquipment[slot]=newId;
  }
  const equipmentSlot=String(root.querySelector("#devContentEquipmentSlot")?.value||""),starter=Boolean(root.querySelector("#devContentStarterEquipment")?.checked);
  map[newId]={name:root.querySelector("#devContentName").value.trim()||newId,description:root.querySelector("#devContentDescription").value.trim(),symbol:(root.querySelector("#devContentSymbol").value.trim()||"?").slice(0,2),icon:root.querySelector("#devContentIcon").value.trim(),category:root.querySelector("#devContentCategory").value.trim()||"Item",rarity:root.querySelector("#devContentRarity").value.trim()||"Common",stackLimit:equipmentSlot?1:Math.max(1,Math.floor(numberOr(root.querySelector("#devContentStack").value,50))),sellValue:Math.max(0,Math.floor(numberOr(root.querySelector("#devContentSell").value,0))),tags:root.querySelector("#devContentTags").value.split(",").map(x=>x.trim()).filter(Boolean),...(equipmentSlot?{equipmentSlot}:{})};
  if(!devCharacterDefaults.starterEquipment||typeof devCharacterDefaults.starterEquipment!=="object")devCharacterDefaults.starterEquipment={};
  for(const slot of Object.keys(devCharacterDefaults.starterEquipment))if(devCharacterDefaults.starterEquipment[slot]===oldId||devCharacterDefaults.starterEquipment[slot]===newId)devCharacterDefaults.starterEquipment[slot]="";
  if(starter&&equipmentSlot)devCharacterDefaults.starterEquipment[equipmentSlot]=newId;
}
function devContentSaveLoot(root){
  const map=LOOT_TABLES,oldId=devContentSelectedId,newId=devContentId(root.querySelector("#devContentId").value,oldId||"loot");if(!devContentRenameKey(map,oldId,newId))return;
  if(oldId!==newId)for(const mob of Object.values(BALANCE.mobs||{}))if(mob?.lootTable===oldId)mob.lootTable=newId;
  const entries=[...root.querySelectorAll(".devLootEntry")].map(row=>({itemId:row.querySelector("[data-loot=item]").value,chancePercent:clamp(numberOr(row.querySelector("[data-loot=chance]").value,100),0,100),minQty:Math.max(1,Math.floor(numberOr(row.querySelector("[data-loot=min]").value,1))),maxQty:Math.max(1,Math.floor(numberOr(row.querySelector("[data-loot=max]").value,1))),...(row.querySelector("[data-loot=elite]").checked?{requiresElite:true}:{}),...(row.querySelector("[data-loot=boss]").checked?{requiresBoss:true}:{})})).filter(e=>e.itemId);
  for(const e of entries)e.maxQty=Math.max(e.minQty,e.maxQty);map[newId]=entries;
}
function devContentSaveMob(root){
  return saveDeveloperMobFromEditor(root);
}

function devContentSave(){
  const root=devPanel?.querySelector("#devContentEditor");if(!root||!devContentSelectedId)return;
  let ok=true;if(devContentType==="items")devContentSaveItem(root);else if(devContentType==="lootTables")devContentSaveLoot(root);else ok=devContentSaveMob(root)!==false;
  if(!ok)return;saveDeveloperDraft();refreshDeveloperPanel();refreshQuestUI?.();devSetStatus(`Saved ${devContentTypeLabel(devContentType).replace(/s$/,"")}: ${devContentSelectedId}`);
}
function devContentLootEntryHtml(entry={}){
  const items=Object.keys(ITEM_DEFS);const itemOptions=[`<option value="">Choose item…</option>`,...items.map(id=>`<option value="${devContentEscape(id)}" ${id===entry.itemId?"selected":""}>${devContentEscape(ITEM_DEFS[id]?.name||id)}</option>`)].join("");
  return `<div class="devLootEntry"><select data-loot="item">${itemOptions}</select><input data-loot="chance" type="number" min="0" max="100" value="${numberOr(entry.chancePercent,100)}" title="Drop %"><input data-loot="min" type="number" min="1" value="${numberOr(entry.minQty,1)}" title="Min quantity"><input data-loot="max" type="number" min="1" value="${numberOr(entry.maxQty,entry.minQty||1)}" title="Max quantity"><label><input data-loot="elite" type="checkbox" ${entry.requiresElite?"checked":""}> Elite</label><label><input data-loot="boss" type="checkbox" ${entry.requiresBoss?"checked":""}> Boss</label><button type="button" data-loot-remove>×</button></div>`;
}
function devContentBindLootRows(root){root.querySelectorAll("[data-loot-remove]").forEach(b=>b.onclick=()=>b.closest(".devLootEntry")?.remove());root.querySelector("#devAddLootEntry")?.addEventListener("click",()=>{const wrap=root.querySelector("#devLootEntries");wrap.insertAdjacentHTML("beforeend",devContentLootEntryHtml({}));devContentBindLootRows(root);});}
function developerItemEquipmentSlotOptions(selected=""){
  const slots=[["","Not Equipment"],["head","Head"],["chest","Chest"],["hands","Hands"],["back","Back"],["legs","Legs"],["feet","Feet / Boots"],["mainHand","Main Hand"],["offHand","Off Hand"]];
  return slots.map(([value,label])=>`<option value="${value}" ${value===selected?"selected":""}>${label}</option>`).join("");
}
function refreshDeveloperContentPanel(){
  if(!devPanel)return;const list=devPanel.querySelector("#devContentList"),editor=devPanel.querySelector("#devContentEditor"),summary=devPanel.querySelector("#devContentSummary");if(!list||!editor)return;
  devContentEnsureSelection();const map=devContentMap();if(summary)summary.textContent=`${Object.keys(BALANCE.mobs||{}).length} mobs • ${Object.keys(ITEM_DEFS).length} items • ${Object.keys(LOOT_TABLES).length} loot tables • ${Object.keys(devAssets).length} assets`;
  devPanel.querySelectorAll("[data-content-type]").forEach(b=>b.classList.toggle("active",b.dataset.contentType===devContentType));
  const query=String(devPanel.querySelector("#devContentSearch")?.value||"").trim().toLowerCase();list.innerHTML=Object.entries(map).filter(([id,rec])=>!query||`${devContentRecordLabel(devContentType,id,rec)} ${id}`.toLowerCase().includes(query)).map(([id,rec])=>`<button class="devContentChip ${id===devContentSelectedId?"active":""}" data-content-id="${devContentEscape(id)}"><b>${devContentEscape(devContentRecordLabel(devContentType,id,rec))}</b><span>${devContentEscape(id)}</span></button>`).join("")||'<div class="devEmpty">No content matches this search.</div>';
  list.querySelectorAll("[data-content-id]").forEach(b=>b.onclick=()=>devContentSelect(b.dataset.contentId));
  const id=devContentSelectedId,rec=id?map[id]:null;if(!id||rec==null){editor.innerHTML='<div class="devEmpty">Choose or create a content entry.</div>';return;}
  if(devContentType==="items")editor.innerHTML=`<div class="devContentForm"><div class="devPair"><label>ID<input id="devContentId" value="${devContentEscape(id)}"></label><label>Name<input id="devContentName" value="${devContentEscape(rec.name||id)}"></label></div><label>Description<textarea id="devContentDescription">${devContentEscape(rec.description||"")}</textarea></label><div class="devPair"><label>Icon path<input id="devContentIcon" value="${devContentEscape(rec.icon||"")}"></label><label>Fallback Symbol<input id="devContentSymbol" maxlength="2" value="${devContentEscape(rec.symbol||"?")}"></label></div><div class="devPair"><label>Category<input id="devContentCategory" value="${devContentEscape(rec.category||"Item")}"></label><label>Rarity<input id="devContentRarity" value="${devContentEscape(rec.rarity||"Common")}"></label></div><div class="devPair"><label>Stack Limit<input id="devContentStack" type="number" min="1" value="${numberOr(rec.stackLimit,50)}"></label><label>Sell Value<input id="devContentSell" type="number" min="0" value="${numberOr(rec.sellValue,0)}"></label></div><div class="devSectionTitle" style="margin-top:8px">Equipment</div><label>Equipment Slot<select id="devContentEquipmentSlot">${developerItemEquipmentSlotOptions(rec.equipmentSlot||"")}</select></label><label class="devInlineCheck"><input id="devContentStarterEquipment" type="checkbox" ${rec.equipmentSlot&&devCharacterDefaults?.starterEquipment?.[rec.equipmentSlot]===id?"checked":""}> Equip this item on newly started characters</label><div class="devHint">Equipment remains a gameplay and inventory system, but it does not alter the premade character sprite. This keeps armor authoring independent from character artwork. Equipment always stacks to 1.</div><label>Tags (comma separated)<input id="devContentTags" value="${devContentEscape((rec.tags||[]).join(", "))}"></label></div>`;
  else if(devContentType==="lootTables"){const entries=Array.isArray(rec)?rec:rec.entries||[];editor.innerHTML=`<div class="devContentForm"><label>Table ID<input id="devContentId" value="${devContentEscape(id)}"></label><div class="devLootHeader"><span>Item</span><span>Chance %</span><span>Min</span><span>Max</span><span>Rules</span></div><div id="devLootEntries">${entries.map(devContentLootEntryHtml).join("")}</div><button type="button" id="devAddLootEntry" class="devWideButton">+ Add Drop Entry</button></div>`;devContentBindLootRows(editor);}
  else{editor.innerHTML=developerMobEditorHtml(id,rec);bindDeveloperMobEditor(editor,id,rec);}

  editor.insertAdjacentHTML("beforeend",`<div class="devContentActions"><button id="devContentSave" class="primary">Save Changes</button><button id="devContentDuplicate">Duplicate</button><button id="devContentDelete" class="danger">Delete</button></div>`);editor.querySelector("#devContentSave").onclick=devContentSave;editor.querySelector("#devContentDuplicate").onclick=devContentDuplicate;editor.querySelector("#devContentDelete").onclick=devContentDelete;
}
