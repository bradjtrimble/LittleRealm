// Unified world-object interaction runtime -----------------------------------
// Doors, gathering nodes, chests, quest props, portals, switches, and future
// world interactions all use the same data model. Builder-authored settings
// live on each world object under `interaction`.

const WORLD_INTERACTION_TYPES=new Set(["enter","gather","open","loot","examine","activate","custom"]);
const WORLD_INTERACTION_USE_MODES=new Set(["repeatable","once","timer"]);
let runtimeZoneTransitioning=false;

function currentWorldZoneId(){
  return String(state?.zoneId||window.LR_ACTIVE_PROJECT?.zone?.id||window.LR_BUILDER_PROJECT?.zone?.id||window.LR_ACTIVE_PROJECT?.manifest?.defaultZone||"default");
}

function worldInteractionDefaults(obj){
  const spec=worldObjectSpec(obj)||{w:48,h:48};
  const hb=obj?.hitbox||{};
  const w=Math.max(8,Math.min(spec.w,numberOr(hb.w,Math.round(spec.w*.45))));
  const h=Math.max(8,Math.min(spec.h,numberOr(hb.h,Math.round(spec.h*.28))));
  return {x:numberOr(hb.x,Math.round((spec.w-w)/2)),y:numberOr(hb.y,Math.round(spec.h-h)),w,h};
}

function worldObjectInteraction(obj){
  const raw=(obj?.interaction&&typeof obj.interaction==="object")?obj.interaction:{};
  const req=(raw.requirements&&typeof raw.requirements==="object")?raw.requirements:{};
  const actions=(raw.actions&&typeof raw.actions==="object")?raw.actions:{};
  const area=(raw.area&&typeof raw.area==="object")?raw.area:worldInteractionDefaults(obj);
  const type=WORLD_INTERACTION_TYPES.has(String(raw.type||"").toLowerCase())?String(raw.type).toLowerCase():"examine";
  const useMode=WORLD_INTERACTION_USE_MODES.has(String(raw.useMode||"").toLowerCase())?String(raw.useMode).toLowerCase():"repeatable";
  const prompt=String(raw.prompt||({enter:"Enter",gather:"Gather",open:"Open",loot:"Loot",examine:"Examine",activate:"Activate",custom:"Interact"}[type]||"Interact"));
  return {
    enabled:raw.enabled===true||(obj?.interactable===true&&Object.keys(raw).length>0),
    type,prompt,
    soundId:String(raw.soundId||"").trim(),
    range:Math.max(20,numberOr(raw.range,72)),
    clickable:raw.clickable!==false,
    keyable:raw.keyable!==false,
    tag:String(raw.tag||obj?.interactionTag||obj?.id||"").trim(),
    area:{x:numberOr(area.x,0),y:numberOr(area.y,0),w:Math.max(4,numberOr(area.w,16)),h:Math.max(4,numberOr(area.h,16))},
    requirements:{
      questId:String(req.questId||"").trim(),
      questState:["active","completed","not-completed"].includes(req.questState)?req.questState:"active",
      itemId:String(req.itemId||"").trim(),
      itemQty:Math.max(1,Math.floor(numberOr(req.itemQty,1)))
    },
    actions:{
      targetZone:String(actions.targetZone||"").trim(),
      targetX:Number.isFinite(Number(actions.targetX))?Number(actions.targetX):null,
      targetY:Number.isFinite(Number(actions.targetY))?Number(actions.targetY):null,
      giveItemId:String(actions.giveItemId||"").trim(),
      giveItemQty:Math.max(1,Math.floor(numberOr(actions.giveItemQty,1))),
      openMode:["storage","loot","simple"].includes(String(actions.openMode||"").toLowerCase())?String(actions.openMode).toLowerCase():(actions.lootTable?"loot":"simple"),
      lootTable:String(actions.lootTable||"").trim(),
      questIds:Array.isArray(actions.questIds)?actions.questIds.map(id=>String(id||"").trim()).filter(Boolean):[],
      questBehavior:actions.questBehavior==="start"?"start":"offer",
      consumeRequiredItem:actions.consumeRequiredItem===true,
      message:String(actions.message||"").trim()
    },
    useMode,
    resetSeconds:Math.max(1,numberOr(raw.resetSeconds,30)),
    hideWhenUsed:raw.hideWhenUsed===true
  };
}

function ensureWorldObjectState(){
  if(!state)return {};
  if(!state.worldObjectStates||typeof state.worldObjectStates!=="object"||Array.isArray(state.worldObjectStates))state.worldObjectStates={};
  return state.worldObjectStates;
}
function worldObjectStateKey(obj,zoneId=currentWorldZoneId()){return `${zoneId}:${obj?.id||obj?.type||"object"}`;}
function ensureWorldObjectRecord(obj,zoneId=currentWorldZoneId()){
  const all=ensureWorldObjectState(),key=worldObjectStateKey(obj,zoneId);
  if(!all[key]||typeof all[key]!=="object"||Array.isArray(all[key]))all[key]={};
  return all[key];
}
function worldObjectUseRecord(obj){return ensureWorldObjectState()[worldObjectStateKey(obj)]||null;}
function worldObjectIsUsed(obj,interaction=worldObjectInteraction(obj)){
  if(interaction.useMode==="repeatable")return false;
  const record=worldObjectUseRecord(obj);if(!record?.used)return false;
  if(interaction.useMode==="timer"){
    const elapsed=(Date.now()-numberOr(record.usedAt,0))/1000;
    if(elapsed>=interaction.resetSeconds){
      const record=ensureWorldObjectState()[worldObjectStateKey(obj)];
      if(record){delete record.used;delete record.usedAt;delete record.loot;}
      if(interaction.hideWhenUsed&&typeof rebuildWorldObjectCollision==="function")queueMicrotask(()=>rebuildWorldObjectCollision());
      return false;
    }
  }
  return true;
}
function markWorldObjectUsed(obj,interaction=worldObjectInteraction(obj)){
  if(interaction.useMode==="repeatable")return;
  const record=ensureWorldObjectRecord(obj);record.used=true;record.usedAt=Date.now();
}
function worldObjectIsHiddenByInteraction(obj){
  const cfg=worldObjectInteraction(obj);return cfg.enabled&&cfg.hideWhenUsed&&worldObjectIsUsed(obj,cfg);
}

function questRequirementRecord(id){return id?ensureQuestState()[id]||null:null;}
function worldInteractionAvailability(obj,cfg=worldObjectInteraction(obj)){
  if(!cfg.enabled)return {visible:false,available:false,message:""};
  if(worldObjectIsUsed(obj,cfg))return {visible:!cfg.hideWhenUsed,available:false,message:"Already used."};
  const req=cfg.requirements;
  if(req.questId){
    const rec=questRequirementRecord(req.questId);
    const completed=!!rec&&(rec.status==="completed"||numberOr(rec.completedCount,0)>0);
    const active=!!rec&&rec.status==="active";
    let met=req.questState==="completed"?completed:req.questState==="not-completed"?!completed:active;
    // Quest-gated scenery stays ordinary scenery until its quest condition is met.
    if(!met)return {visible:false,available:false,message:""};
  }
  if(req.itemId&&getItemCount(req.itemId)<req.itemQty){
    const def=getItemDefinition(req.itemId);return {visible:true,available:false,message:`Requires ${req.itemQty>1?`${req.itemQty}× `:""}${def.name}.`};
  }
  return {visible:true,available:true,message:""};
}

function worldInteractionAreaWorld(obj,cfg=worldObjectInteraction(obj)){
  return {x:obj.x+cfg.area.x,y:obj.y+cfg.area.y,w:cfg.area.w,h:cfg.area.h};
}
function worldInteractionCenter(obj,cfg=worldObjectInteraction(obj)){
  const a=worldInteractionAreaWorld(obj,cfg);return {x:a.x+a.w/2,y:a.y+a.h/2};
}
function pointInWorldInteraction(obj,wx,wy,cfg=worldObjectInteraction(obj)){
  const a=worldInteractionAreaWorld(obj,cfg);return wx>=a.x&&wx<=a.x+a.w&&wy>=a.y&&wy<=a.y+a.h;
}

function findInteractableWorldObjectAt(wx,wy){
  const sorted=[...sceneryProps].sort((a,b)=>worldObjectRenderDepth(b,state.y)-worldObjectRenderDepth(a,state.y));
  for(const obj of sorted){
    const cfg=worldObjectInteraction(obj),availability=worldInteractionAvailability(obj,cfg);
    if(!cfg.enabled||!cfg.clickable||!availability.visible)continue;
    if(pointInWorldInteraction(obj,wx,wy,cfg))return obj;
  }
  return null;
}

function nearestInteractableWorldObject(range=84){
  let best=null,bestDist=Infinity;
  for(const obj of sceneryProps){
    const cfg=worldObjectInteraction(obj),availability=worldInteractionAvailability(obj,cfg);
    if(!cfg.enabled||!cfg.keyable||!availability.visible)continue;
    const c=worldInteractionCenter(obj,cfg),d=dist(state.x,state.y,c.x,c.y),allowed=Math.max(range,cfg.range);
    if(d<=allowed&&d<bestDist){best=obj;bestDist=d;}
  }
  return best;
}

function nearestLootPileForInteract(range=84){
  let best=null,bestDist=Infinity;
  for(const pile of lootPiles){
    if(!lootPileHasLoot(pile))continue;const d=dist(state.x,state.y,pile.x,pile.y);
    if(d<=range&&d<bestDist){best=pile;bestDist=d;}
  }
  return best;
}

function notifyQuestInteract(target){
  if(!target)return false;let changed=false;
  for(const quest of questDefinitions){
    if(getQuestStatus(quest)!=="active")continue;
    quest.objectives.forEach((objective,index)=>{if(objective.type==="interact"&&objective.target===target)changed=updateStoredQuestObjective(quest,index,1)||changed;});
  }
  if(changed)refreshQuestUI();return changed;
}

function worldInteractionItemPrecheck(cfg){
  const id=cfg.actions.giveItemId;if(!id)return true;
  if(!ITEM_DEFS[id]){toast(`Unknown item: ${id}`);return false;}
  if(!canAddItem(id,cfg.actions.giveItemQty)){toast("Make room in your backpack first.");return false;}
  return true;
}

function applyRuntimeZoneVisualSettings(pack){
  const visual=pack?.visualSettings;if(!visual||typeof visual!=="object")return;
  for(const key of Object.keys(VISUAL_SCALE))if(Number.isFinite(Number(visual[key])))VISUAL_SCALE[key]=visualScaleOr(visual[key],VISUAL_SCALE[key]);
  if(visual.remnants&&typeof visual.remnants==="object"){
    if(Number.isFinite(Number(visual.remnants.scale)))LOOT_REMNANT_VISUAL.scale=visualScaleOr(visual.remnants.scale,LOOT_REMNANT_VISUAL.scale);
    const mode=String(visual.remnants.depthMode||"").toLowerCase();if(LOOT_REMNANT_DEPTH_MODES.has(mode))LOOT_REMNANT_VISUAL.depthMode=mode;
    if(Number.isFinite(Number(visual.remnants.depthY)))LOOT_REMNANT_VISUAL.depthY=Number(visual.remnants.depthY);
  }
}

async function runtimeZonePack(zoneId){
  const cached=window.LR_PROJECT_ZONE_PACKS?.[zoneId];if(cached)return cloneWorldObject(cached);
  const manifest=window.LR_ACTIVE_PROJECT?.manifest;const zone=(manifest?.zones||[]).find(z=>z.id===zoneId);if(!zone?.pack)throw new Error(`Zone '${zoneId}' is not in the project`);
  const response=await fetch(`./${zone.pack}?lrzone=${Date.now().toString(36)}`,{cache:"no-store"});if(!response.ok)throw new Error(`${zone.pack} HTTP ${response.status}`);
  return response.json();
}

async function transitionToWorldZone(zoneId,{x=null,y=null,quiet=false}={}){
  if(!zoneId||runtimeZoneTransitioning)return false;
  if(window.LR_BUILDER_MODE&&typeof switchDeveloperZone==="function"){
    const target=developerZoneById(zoneId);if(!target){devSetStatus(`Interaction target zone '${zoneId}' does not exist`);return false;}
    if(!devProjectDirectoryHandle){devSetStatus("Open the Little Realm Project Folder to travel between Builder zones");return false;}
    await switchDeveloperZone(zoneId);
    if(Number.isFinite(Number(x))&&Number.isFinite(Number(y))){state.x=Number(x);state.y=Number(y);lastSafePos={x:state.x,y:state.y};}
    state.zoneId=zoneId;return true;
  }
  runtimeZoneTransitioning=true;
  try{
    const pack=await runtimeZonePack(zoneId);
    stopWorldAudioEmitters();
    if(typeof disengageCombat==="function"&&combatTarget)disengageCombat(false);
    selectedTarget=null;clearLootPiles();closeNpcDialogue?.();closeStorageWindow?.();closeWorldObjectQuestDialog?.();
    window.LR_ZONE_SETTINGS=pack.zoneSettings&&typeof pack.zoneSettings==="object"?pack.zoneSettings:{};
    applyWorldZoneDefinition(window.LR_ZONE_SETTINGS,pack.terrain);
    buildScenery({worldObjects:pack.worldObjects||[],npcs:pack.npcs||[]});
    window.LR_MOB_SPAWNS=Array.isArray(pack.mobSpawns)?cloneWorldObject(pack.mobSpawns):[];
    applyRuntimeZoneVisualSettings(pack);
    state.zoneId=zoneId;
    state.x=Number.isFinite(Number(x))?Number(x):START_X;state.y=Number.isFinite(Number(y))?Number(y):START_Y;
    if(!canStand(state.x,state.y)){state.x=START_X;state.y=START_Y;}
    lastSafePos={x:state.x,y:state.y};resetFootstepTracking();spawnMobs();applyZoneAudioFromCurrentSettings();
    const manifest=window.LR_ACTIVE_PROJECT?.manifest;const zone=(manifest?.zones||[]).find(z=>z.id===zoneId)||{id:zoneId,name:zoneId};
    if(window.LR_ACTIVE_PROJECT)window.LR_ACTIVE_PROJECT.zone=zone;
    updateUI();if(!quiet)toast(`Entered ${zone.name||zone.id}.`);return true;
  }catch(err){console.error(err);toast(`Could not enter ${zoneId}.`);return false;}
  finally{runtimeZoneTransitioning=false;}
}

function worldObjectLootRecord(obj,cfg=worldObjectInteraction(obj)){
  const record=ensureWorldObjectRecord(obj);
  if(!record.loot||typeof record.loot!=="object"||Array.isArray(record.loot)){
    const drops=cfg.actions.lootTable?rollLootTable(cfg.actions.lootTable,{level:state?.level||1}):[];
    record.loot={items:normalizePendingLoot(drops),gold:0,potions:0,rolledAt:Date.now()};
  }
  return record.loot;
}
function completeWorldObjectLoot(obj,cfg){
  const record=ensureWorldObjectRecord(obj);
  if(cfg.useMode==="repeatable"){delete record.loot;}
  else markWorldObjectUsed(obj,cfg);
  if(cfg.hideWhenUsed)rebuildWorldObjectCollision();
}
function openWorldObjectLoot(obj,cfg=worldObjectInteraction(obj)){
  if(!cfg.actions.lootTable){toast(`${obj.label||"It"} is empty.`);if(cfg.useMode!=="repeatable")markWorldObjectUsed(obj,cfg);return false;}
  const loot=worldObjectLootRecord(obj,cfg);
  const pile={id:`object-${worldObjectStateKey(obj)}`,x:obj.x+(worldObjectSpec(obj)?.w||0)/2,y:obj.y+(worldObjectSpec(obj)?.h||0),sourceLabel:obj.label||cfg.prompt,items:loot.items,gold:Math.max(0,Math.floor(numberOr(loot.gold,0))),potions:Math.max(0,Math.floor(numberOr(loot.potions,0))),createdAt:performance.now(),expiresAt:Infinity};
  if(!lootPileHasLoot(pile)){completeWorldObjectLoot(obj,cfg);toast(`${obj.label||"It"} is empty.`);return false;}
  return openPersistentLootWindow(pile,()=>completeWorldObjectLoot(obj,cfg));
}
function applyWorldObjectQuestActions(obj,cfg){
  const ids=cfg.actions.questIds||[];
  if(!ids.length)return {handled:false,started:0};
  if(cfg.actions.questBehavior==="start"){
    let started=0;
    for(const id of ids)if(getQuestStatus(id)==="available"&&acceptQuest(id))started++;
    if(!started)openWorldObjectQuestDialog(obj,ids);
    return {handled:true,started};
  }
  openWorldObjectQuestDialog(obj,ids);
  return {handled:true,started:0};
}

async function interactWithWorldObject(obj){
  if(!obj||runtimeZoneTransitioning)return false;
  const cfg=worldObjectInteraction(obj),availability=worldInteractionAvailability(obj,cfg);
  if(!availability.visible)return false;
  const c=worldInteractionCenter(obj,cfg);if(dist(state.x,state.y,c.x,c.y)>cfg.range){toast(`Move closer to ${cfg.prompt.toLowerCase()}.`);return false;}
  if(!availability.available){if(availability.message)toast(availability.message);return false;}
  if(!worldInteractionItemPrecheck(cfg))return false;

  if(cfg.soundId){const opts={bus:"sfx",volume:.9,x:obj.x,y:obj.y,radius:300};if(audioSetLibrary()?.[cfg.soundId])playAudioSet(cfg.soundId,opts);else playAudioClip(cfg.soundId,opts);}
  const req=cfg.requirements,act=cfg.actions;
  const storageOpen=cfg.type==="open"&&act.openMode==="storage";
  const lootOpen=(cfg.type==="open"&&act.openMode==="loot")||cfg.type==="loot";
  if(storageOpen){
    openStorageContainer(obj);
  }else if(lootOpen){
    openWorldObjectLoot(obj,cfg);
  }else{
    if(act.giveItemId){const result=addItem(act.giveItemId,act.giveItemQty);if(result.added<act.giveItemQty){toast("Make room in your backpack first.");return false;}}
    if(act.lootTable)openWorldObjectLoot(obj,cfg);
  }
  if(act.consumeRequiredItem&&req.itemId)removeItem(req.itemId,req.itemQty);
  notifyQuestInteract(cfg.tag||obj.id);
  const questResult=applyWorldObjectQuestActions(obj,cfg);
  if(!storageOpen&&!lootOpen&&!act.lootTable&&cfg.useMode!=="repeatable"){
    // A one-time discovery object should not burn itself while its auto-start
    // quest is still locked/unavailable. Notice-board style quest offers are
    // intentionally controlled by their normal Repeatable/Once/Timer setting.
    const autoQuestOnly=questResult.handled&&act.questBehavior==="start"&&!act.giveItemId&&!act.targetZone;
    if(!autoQuestOnly||questResult.started>0)markWorldObjectUsed(obj,cfg);
  }
  if(act.message)toast(act.message);
  else if(act.giveItemId)toast(`${cfg.prompt}: +${act.giveItemQty} ${getItemDefinition(act.giveItemId).name}`);
  if(cfg.hideWhenUsed&&worldObjectIsUsed(obj,cfg))rebuildWorldObjectCollision();
  updateUI();refreshQuestUI?.();
  if(act.targetZone)return transitionToWorldZone(act.targetZone,{x:act.targetX,y:act.targetY});
  return true;
}

function interactWithNearestWorldTarget(){
  if(isGameplayModalOpen())return false;
  const npc=nearestInteractableNpc(72),obj=nearestInteractableWorldObject(72),pile=nearestLootPileForInteract(84);
  const choices=[];
  if(npc)choices.push({kind:"npc",value:npc,d:dist(state.x,state.y,npc.x,npc.y)});
  if(obj){const c=worldInteractionCenter(obj);choices.push({kind:"object",value:obj,d:dist(state.x,state.y,c.x,c.y)});}
  if(pile)choices.push({kind:"loot",value:pile,d:dist(state.x,state.y,pile.x,pile.y)});
  choices.sort((a,b)=>a.d-b.d);const best=choices[0];if(!best)return false;
  if(best.kind==="npc")return interactWithNpc(best.value);
  if(best.kind==="loot")return interactWithLootPile(best.value);
  return interactWithWorldObject(best.value);
}

function drawWorldInteractionHint(camX,camY){
  if(!state||isGameplayModalOpen())return;
  const obj=nearestInteractableWorldObject(88);if(!obj)return;
  const cfg=worldObjectInteraction(obj),availability=worldInteractionAvailability(obj,cfg);if(!availability.visible)return;
  const a=worldInteractionAreaWorld(obj,cfg),cx=a.x+a.w/2-camX,cy=a.y-camY-8;
  const text=availability.available?`E • ${cfg.prompt}`:availability.message;if(!text)return;
  ctx.save();ctx.font="800 8px system-ui";ctx.textAlign="center";const width=Math.max(42,ctx.measureText(text).width+12);
  ctx.fillStyle="rgba(28,22,31,.88)";ctx.strokeStyle=availability.available?"rgba(145,235,179,.9)":"rgba(224,186,112,.9)";ctx.lineWidth=1/CAMERA_ZOOM;
  ctx.beginPath();ctx.roundRect(cx-width/2,cy-14,width,16,5);ctx.fill();ctx.stroke();ctx.fillStyle="#f7f1fb";ctx.fillText(text,cx,cy-3);ctx.restore();
}
