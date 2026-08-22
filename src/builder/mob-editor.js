function developerMobBaseline(level){
  return standardMobBaselineStatsForLevel(Math.max(1,Math.floor(numberOr(level,1))));
}
function developerNewMobDefinition(){
  const stats=developerMobBaseline(1);
  return {
    name:"New Mob",spriteAsset:"",sizeClass:"medium",displayHeight:MOB_SIZE_CLASS_HEIGHTS.medium,battleScale:.55,boss:false,
    baseLevel:1,levelMin:1,levelMax:1,autoLevelStats:true,
    hp:stats.hp,attack:stats.attack,defense:stats.defense,xpMultiplier:1,xp:stats.xp,
    goldMin:0,goldMax:0,goldDropChancePercent:0,potionDropChancePercent:0,potionDropAmount:1,
    eliteChancePercent:0,attackIntervalSeconds:1.5,respawnMinSeconds:18,respawnMaxSeconds:28,
    aggressive:true,aggroTriggerRange:58,alertRange:82,chaseSpeed:50,wanderSpeed:20,
    leashDistance:120,leashSpeed:34,wanderDelayMinSeconds:1.2,wanderDelayMaxSeconds:4,lootTable:"",
    audio:{aggro:"",attack:"",hit:"",death:""},audioRadius:430
  };
}
function developerMobSpriteAssets(){
  return Object.entries(devAssets||{}).filter(([,asset])=>asset?.type==="mobSprite"&&asset?.path);
}
function developerMobSizeClassOptions(rec){
  const height=Math.max(8,numberOr(rec?.displayHeight,MOB_SIZE_CLASS_HEIGHTS.medium));
  const current=String(rec?.sizeClass||nearestMobSizeClass(height)).toLowerCase();
  return [...Object.keys(MOB_SIZE_CLASS_HEIGHTS),"custom"].map(key=>`<option value="${key}" ${key===current?"selected":""}>${MOB_SIZE_CLASS_LABELS[key]}${MOB_SIZE_CLASS_HEIGHTS[key]?` • ${MOB_SIZE_CLASS_HEIGHTS[key]}px`:""}</option>`).join("");
}
function developerMobSizeSummary(height){
  const h=Math.max(8,numberOr(height,MOB_SIZE_CLASS_HEIGHTS.medium));
  return `${Math.round(h)}px visible height • ${mobRelativePlayerScale(h).toFixed(2)}× player reference`;
}
function developerMobSpriteAssetOptions(rec){
  const current=String(rec?.spriteAsset||"");const options=[`<option value="" ${current?"":"selected"}>Choose a Mob Sprite…</option>`];
  for(const [assetId,asset] of developerMobSpriteAssets()){const selected=assetId===current;options.push(`<option value="${devContentEscape(assetId)}" ${selected?"selected":""}>${devContentEscape(asset.name||assetId)}</option>`);}
  if(current&&!devAssets?.[current])options.push(`<option value="${devContentEscape(current)}" selected>Missing asset • ${devContentEscape(current)}</option>`);
  return options.join("");
}
function developerMobLootEntries(id,rec){
  const tableId=String(rec?.lootTable||id||"");
  const raw=LOOT_TABLES[tableId];
  return devContentClone(Array.isArray(raw)?raw:(raw?.entries||[]));
}
function developerMobDropEntryHtml(entry={}){
  const itemOptions=['<option value="">Choose item…</option>',...Object.entries(ITEM_DEFS).map(([id,item])=>`<option value="${devContentEscape(id)}" ${id===entry.itemId?"selected":""}>${devContentEscape(item?.name||id)}</option>`)].join("");
  return `<div class="devLootEntry devMobDropEntry"><select data-mob-drop="item">${itemOptions}</select><input data-mob-drop="chance" type="number" min="0" max="100" value="${numberOr(entry.chancePercent,100)}" title="Drop chance %"><input data-mob-drop="min" type="number" min="1" value="${numberOr(entry.minQty,1)}" title="Minimum quantity"><input data-mob-drop="max" type="number" min="1" value="${numberOr(entry.maxQty,entry.minQty||1)}" title="Maximum quantity"><label><input data-mob-drop="elite" type="checkbox" ${entry.requiresElite?"checked":""}> Elite only</label><label><input data-mob-drop="boss" type="checkbox" ${entry.requiresBoss?"checked":""}> Boss only</label><button type="button" data-mob-drop-remove>×</button></div>`;
}
function developerMobEditorHtml(id,rec){
  const baseline=developerMobBaseline(rec.baseLevel||1);
  const drops=developerMobLootEntries(id,rec);
  const cfg=BALANCE.mobLevels||{};
  const bossHint=`Bosses do not wander, do not respawn after defeat, cannot become Elite, and receive boss multipliers: HP ×${numberOr(cfg.bossHpMultiplier,3)}, ATK ×${numberOr(cfg.bossAttackMultiplier,2.5)}, DEF ×${numberOr(cfg.bossArmorMultiplier,2.5)}, XP ×${numberOr(cfg.bossXpMultiplier,1.75)}.`;
  const audioOptions=value=>developerAudioRefOptions(String(value||""),{includeSets:true});
  return `<div class="devContentForm devMobEditor">
    <div class="devPair"><label>ID<input id="devContentId" value="${devContentEscape(id)}"></label><label>Name<input id="devContentName" value="${devContentEscape(rec.name||id)}"></label></div>
    <div class="devSectionTitle">Appearance</div>
    <label>Mob Sprite Asset<select id="devMobSpriteAsset">${developerMobSpriteAssetOptions(rec)}</select></label>
    <div class="devPair"><label>World Size Class<select id="devMobSizeClass">${developerMobSizeClassOptions(rec)}</select></label><label>Visible World Height<input id="devMobDisplayHeight" type="number" min="8" max="160" step="1" value="${Math.round(numberOr(rec.displayHeight,mobSizeClassHeight(rec.sizeClass)))}"></label></div>
    <div id="devMobSizeSummary" class="devHint">${developerMobSizeSummary(numberOr(rec.displayHeight,mobSizeClassHeight(rec.sizeClass)))}</div>
    <label>Combat Portrait Scale<input id="devMobBattleScale" type="number" min="0.05" step="0.05" value="${numberOr(rec.battleScale,.55)}"></label>
    <div id="devMobSpritePreview" class="devAssetPreview" style="min-height:92px"></div>
    <div class="devHint">World size is normalized from visible sprite height, so a 384px sheet and a 1254px sheet can render at the same in-game size. Import new 4×4 directional sprite sheets from Assets.</div>

    <div class="devSectionTitle">Level & Core Stats</div>
    <div class="devCombatGrid">
      <label class="devCombatField">Level<input id="devMobBase" type="number" min="1" value="${numberOr(rec.baseLevel,1)}"></label>
      <label class="devCombatField">Spawn Min Lv<input id="devMobMin" type="number" min="1" value="${numberOr(rec.levelMin,rec.baseLevel||1)}"></label>
      <label class="devCombatField">Spawn Max Lv<input id="devMobMax" type="number" min="1" value="${numberOr(rec.levelMax,rec.baseLevel||1)}"></label>
      <label class="devCombatField">HP<input id="devMobHp" type="number" min="1" value="${numberOr(rec.hp,baseline.hp)}"></label>
      <label class="devCombatField">ATK<input id="devMobAtk" type="number" min="0" value="${numberOr(rec.attack,baseline.attack)}"></label>
      <label class="devCombatField">DEF<input id="devMobDef" type="number" min="0" value="${numberOr(rec.defense,baseline.defense)}"></label>
      <label class="devCombatField">XP Multiplier<input id="devMobXpMult" type="number" min="0" step="0.05" value="${numberOr(rec.xpMultiplier,1)}"></label>
      <label class="devCombatField">Elite Chance %<input id="devMobElite" type="number" min="0" max="100" value="${numberOr(rec.eliteChancePercent,0)}"></label>
      <label class="devCombatField">Attack Sec<input id="devMobInterval" type="number" min=".1" step=".05" value="${numberOr(rec.attackIntervalSeconds,1.5)}"></label>
    </div>
    <label class="devInlineCheck"><input id="devMobAutoStats" type="checkbox" ${rec.autoLevelStats?"checked":""}> Auto-fill HP / ATK / DEF from Level</label>
    <div id="devMobBaselineHint" class="devHint">Standard Lv ${Math.floor(numberOr(rec.baseLevel,1))} baseline: <b>${baseline.hp} HP • ${baseline.attack} ATK • ${baseline.defense} DEF</b> • ${baseline.xp} same-level XP before multipliers.</div>
    <button type="button" id="devMobUseBaseline" class="devWideButton">Use Level Baseline Now</button>
    <div class="devHint">The Level field is the stat anchor. Spawn Min/Max lets individual spawns vary around it. Editing HP, ATK, or DEF manually turns automatic stat filling off so your custom tuning is preserved.</div>

    <div class="devSectionTitle">Rank & Behavior</div>
    <label class="devInlineCheck"><input id="devMobBoss" type="checkbox" ${rec.boss?"checked":""}> Boss / special encounter</label>
    <div class="devHint">${devContentEscape(bossHint)}</div>
    <label class="devInlineCheck"><input id="devMobAggressive" type="checkbox" ${rec.aggressive?"checked":""}> Aggressive — automatically engages nearby players</label>
    <div class="devCombatGrid">
      <label class="devCombatField">Aggro Range<input id="devMobAggro" type="number" min="0" value="${numberOr(rec.aggroTriggerRange,58)}"></label>
      <label class="devCombatField">Alert Range<input id="devMobAlert" type="number" min="0" value="${numberOr(rec.alertRange,82)}"></label>
      <label class="devCombatField">Chase Speed<input id="devMobChase" type="number" min="0" value="${numberOr(rec.chaseSpeed,50)}"></label>
      <label class="devCombatField">Wander Speed<input id="devMobWander" type="number" min="0" value="${numberOr(rec.wanderSpeed,20)}"></label>
      <label class="devCombatField">Leash<input id="devMobLeash" type="number" min="0" value="${numberOr(rec.leashDistance,120)}"></label>
      <label class="devCombatField">Return Speed<input id="devMobLeashSpeed" type="number" min="0" value="${numberOr(rec.leashSpeed,34)}"></label>
      <label class="devCombatField">Wander Delay Min<input id="devMobWanderMin" type="number" min="0" step=".1" value="${numberOr(rec.wanderDelayMinSeconds,1.2)}"></label>
      <label class="devCombatField">Wander Delay Max<input id="devMobWanderMax" type="number" min="0" step=".1" value="${numberOr(rec.wanderDelayMaxSeconds,4)}"></label>
      <label class="devCombatField">Respawn Min<input id="devMobRespawnMin" type="number" min="0" value="${numberOr(rec.respawnMinSeconds,18)}"></label>
      <label class="devCombatField">Respawn Max<input id="devMobRespawnMax" type="number" min="0" value="${numberOr(rec.respawnMaxSeconds,28)}"></label>
    </div>
    <div class="devHint">Any terrain with the Sanctuary property acts as a protected boundary: mobs whose home is outside cannot enter or aggro players inside it. Mobs deliberately spawned on sanctuary terrain can move normally.</div>

    <div class="devSectionTitle">Mob Audio</div>
    <div class="devHint">Assign individual clips or reusable Sound Sets. World sounds fade/pan based on the mob's distance from the player.</div>
    <div class="devPair"><label>Aggro<select id="devMobAudioAggro">${audioOptions(rec.audio?.aggro)}</select></label><label>Attack<select id="devMobAudioAttack">${audioOptions(rec.audio?.attack)}</select></label></div>
    <div class="devPair"><label>Hit / Hurt<select id="devMobAudioHit">${audioOptions(rec.audio?.hit)}</select></label><label>Death<select id="devMobAudioDeath">${audioOptions(rec.audio?.death)}</select></label></div>
    <div class="devPair"><label>Audible Range<input id="devMobAudioRadius" type="number" min="100" max="2000" value="${Math.round(numberOr(rec.audioRadius,430))}"></label><label>Preview<select id="devMobAudioPreviewChoice">${audioOptions(rec.audio?.aggro||rec.audio?.attack||rec.audio?.hit||rec.audio?.death)}</select></label></div>
    <div class="devRow"><button type="button" id="devMobAudioPreview">▶ Preview</button><button type="button" id="devMobOpenAudio">Open Audio Library</button></div>

    <div class="devSectionTitle">Drops & Rewards</div>
    <div class="devHint">You do not need to create a Loot Table separately. Item drops added here are saved automatically for this mob.</div>
    <div class="devCombatGrid">
      <label class="devCombatField">Gold Chance %<input id="devMobGoldChance" type="number" min="0" max="100" value="${numberOr(rec.goldDropChancePercent,0)}"></label>
      <label class="devCombatField">Gold Min<input id="devMobGoldMin" type="number" min="0" value="${numberOr(rec.goldMin,0)}"></label>
      <label class="devCombatField">Gold Max<input id="devMobGoldMax" type="number" min="0" value="${numberOr(rec.goldMax,0)}"></label>
      <label class="devCombatField">Potion Chance %<input id="devMobPotionChance" type="number" min="0" max="100" value="${numberOr(rec.potionDropChancePercent,0)}"></label>
      <label class="devCombatField">Potion Qty<input id="devMobPotionQty" type="number" min="0" value="${numberOr(rec.potionDropAmount,1)}"></label>
    </div>
    <div class="devLootHeader"><span>Item</span><span>Chance %</span><span>Min</span><span>Max</span><span>Rules</span></div>
    <div id="devMobDropEntries">${drops.map(developerMobDropEntryHtml).join("")}</div>
    <button type="button" id="devMobAddDrop" class="devWideButton">+ Add Item Drop</button>
    <div class="devHint">The separate Loot Tables library remains available for advanced/shared editing, but normal mob loot can be managed entirely here.</div>

    <div class="devHint">Mob definitions are shared content. Use the Spawns tab to place this type into the current zone.</div>
  </div>`;
}
function developerMobUpdateSpritePreview(root){
  const preview=root.querySelector("#devMobSpritePreview"),select=root.querySelector("#devMobSpriteAsset"); if(!preview||!select)return;
  const asset=devAssets?.[select.value],path=String(asset?.path||"");
  preview.innerHTML=path?`<img src="./${devContentEscape(path)}" alt="Mob sprite preview" style="max-height:150px;max-width:100%;object-fit:contain">`:'<div class="devEmpty">Choose a Mob Sprite asset. Every mob uses the same asset-driven renderer.</div>';
}
function developerMobApplyBaselineToEditor(root){
  const level=Math.max(1,Math.floor(numberOr(root.querySelector("#devMobBase")?.value,1))),stats=developerMobBaseline(level);
  root.querySelector("#devMobHp").value=stats.hp;root.querySelector("#devMobAtk").value=stats.attack;root.querySelector("#devMobDef").value=stats.defense;
  const hint=root.querySelector("#devMobBaselineHint");if(hint)hint.innerHTML=`Standard Lv ${level} baseline: <b>${stats.hp} HP • ${stats.attack} ATK • ${stats.defense} DEF</b> • ${stats.xp} same-level XP before multipliers.`;
}
function developerBindMobDropRows(root){
  root.querySelectorAll("[data-mob-drop-remove]").forEach(button=>button.onclick=()=>button.closest(".devMobDropEntry")?.remove());
}
function bindDeveloperMobEditor(root,id,rec){
  developerMobUpdateSpritePreview(root);
  root.querySelector("#devMobSpriteAsset")?.addEventListener("change",()=>developerMobUpdateSpritePreview(root));
  const sizeClass=root.querySelector("#devMobSizeClass"),displayHeight=root.querySelector("#devMobDisplayHeight"),sizeSummary=root.querySelector("#devMobSizeSummary");
  const refreshSizeSummary=()=>{if(sizeSummary&&displayHeight)sizeSummary.textContent=developerMobSizeSummary(displayHeight.value);};
  sizeClass?.addEventListener("change",()=>{if(sizeClass.value!=="custom"&&displayHeight)displayHeight.value=mobSizeClassHeight(sizeClass.value);refreshSizeSummary();});
  displayHeight?.addEventListener("input",()=>{if(sizeClass){const nearest=nearestMobSizeClass(displayHeight.value),preset=mobSizeClassHeight(nearest);sizeClass.value=Math.abs(numberOr(displayHeight.value,preset)-preset)<=1?nearest:"custom";}refreshSizeSummary();});
  const base=root.querySelector("#devMobBase"),min=root.querySelector("#devMobMin"),max=root.querySelector("#devMobMax"),auto=root.querySelector("#devMobAutoStats");
  if(base){base.dataset.previous=String(Math.max(1,Math.floor(numberOr(base.value,1))));base.addEventListener("input",()=>{
    const previous=Math.max(1,Math.floor(numberOr(base.dataset.previous,base.value))),next=Math.max(1,Math.floor(numberOr(base.value,1)));
    if(numberOr(min?.value,previous)===previous&&numberOr(max?.value,previous)===previous){min.value=next;max.value=next;}
    if(auto?.checked)developerMobApplyBaselineToEditor(root);else{const stats=developerMobBaseline(next),hint=root.querySelector("#devMobBaselineHint");if(hint)hint.innerHTML=`Standard Lv ${next} baseline: <b>${stats.hp} HP • ${stats.attack} ATK • ${stats.defense} DEF</b> • ${stats.xp} same-level XP before multipliers.`;}
    base.dataset.previous=String(next);
  });}
  root.querySelector("#devMobUseBaseline")?.addEventListener("click",()=>{if(auto)auto.checked=true;developerMobApplyBaselineToEditor(root);});
  auto?.addEventListener("change",()=>{if(auto.checked)developerMobApplyBaselineToEditor(root);});
  for(const selector of ["#devMobHp","#devMobAtk","#devMobDef"])root.querySelector(selector)?.addEventListener("input",()=>{if(auto)auto.checked=false;});
  developerBindMobDropRows(root);
  root.querySelector("#devMobAudioPreview")?.addEventListener("click",()=>{const id=root.querySelector("#devMobAudioPreviewChoice")?.value;if(id)developerAudioPreview(id);});
  root.querySelector("#devMobOpenAudio")?.addEventListener("click",()=>setDeveloperTab("audio"));
  root.querySelector("#devMobAddDrop")?.addEventListener("click",()=>{root.querySelector("#devMobDropEntries")?.insertAdjacentHTML("beforeend",developerMobDropEntryHtml({}));developerBindMobDropRows(root);});
}
function developerMobCollectDrops(root){
  return [...root.querySelectorAll(".devMobDropEntry")].map(row=>({
    itemId:row.querySelector('[data-mob-drop="item"]')?.value||"",
    chancePercent:clamp(numberOr(row.querySelector('[data-mob-drop="chance"]')?.value,100),0,100),
    minQty:Math.max(1,Math.floor(numberOr(row.querySelector('[data-mob-drop="min"]')?.value,1))),
    maxQty:Math.max(1,Math.floor(numberOr(row.querySelector('[data-mob-drop="max"]')?.value,1))),
    ...(row.querySelector('[data-mob-drop="elite"]')?.checked?{requiresElite:true}:{}),
    ...(row.querySelector('[data-mob-drop="boss"]')?.checked?{requiresBoss:true}:{})
  })).filter(entry=>entry.itemId).map(entry=>({...entry,maxQty:Math.max(entry.minQty,entry.maxQty)}));
}
function saveDeveloperMobFromEditor(root){
  const map=BALANCE.mobs||(BALANCE.mobs={}),oldId=devContentSelectedId,oldRec=map[oldId]||{},newId=devContentId(root.querySelector("#devContentId").value,oldId||"mob");
  if(!devContentRenameKey(map,oldId,newId))return false;
  if(oldId!==newId){
    for(const quest of questDefinitions)for(const objective of quest.objectives||[])if(objective.type==="kill"&&objective.target===oldId)objective.target=newId;
    for(const spawn of devMobSpawns)if(spawn.mobType===oldId)spawn.mobType=newId;
    syncDeveloperSpawnRuntime?.();
  }
  const n=id=>numberOr(root.querySelector(`#${id}`)?.value,0),check=id=>!!root.querySelector(`#${id}`)?.checked;
  const baseLevel=Math.max(1,Math.floor(n("devMobBase"))),boss=check("devMobBoss"),spriteAsset=String(root.querySelector("#devMobSpriteAsset")?.value||"").trim();
  const displayHeight=Math.max(8,n("devMobDisplayHeight")||MOB_SIZE_CLASS_HEIGHTS.medium),chosenSizeClass=String(root.querySelector("#devMobSizeClass")?.value||nearestMobSizeClass(displayHeight)).toLowerCase();
  map[newId]={
    name:root.querySelector("#devContentName").value.trim()||newId,spriteAsset,
    sizeClass:chosenSizeClass,displayHeight,battleScale:Math.max(.05,n("devMobBattleScale")||.55),boss,baseLevel,
    levelMin:Math.max(1,Math.floor(n("devMobMin"))),levelMax:Math.max(1,Math.floor(n("devMobMax"))),autoLevelStats:check("devMobAutoStats"),
    hp:Math.max(1,n("devMobHp")),attack:Math.max(0,n("devMobAtk")),defense:Math.max(0,n("devMobDef")),
    xpMultiplier:Math.max(0,n("devMobXpMult")||1),xp:Math.max(1,numberOr(oldRec.xp,standardMobXpForLevel(baseLevel))),
    goldMin:Math.max(0,Math.floor(n("devMobGoldMin"))),goldMax:Math.max(0,Math.floor(n("devMobGoldMax"))),goldDropChancePercent:clamp(n("devMobGoldChance"),0,100),
    potionDropChancePercent:clamp(n("devMobPotionChance"),0,100),potionDropAmount:Math.max(0,Math.floor(n("devMobPotionQty"))),
    eliteChancePercent:boss?0:clamp(n("devMobElite"),0,100),attackIntervalSeconds:Math.max(.1,n("devMobInterval")),
    respawnMinSeconds:Math.max(0,n("devMobRespawnMin")),respawnMaxSeconds:Math.max(0,n("devMobRespawnMax")),
    aggressive:check("devMobAggressive"),aggroTriggerRange:Math.max(0,n("devMobAggro")),alertRange:Math.max(0,n("devMobAlert")),
    chaseSpeed:Math.max(0,n("devMobChase")),wanderSpeed:Math.max(0,n("devMobWander")),leashDistance:Math.max(0,n("devMobLeash")),leashSpeed:Math.max(0,n("devMobLeashSpeed")),
    wanderDelayMinSeconds:Math.max(0,n("devMobWanderMin")),wanderDelayMaxSeconds:Math.max(0,n("devMobWanderMax")),
    audio:{aggro:root.querySelector("#devMobAudioAggro")?.value||"",attack:root.querySelector("#devMobAudioAttack")?.value||"",hit:root.querySelector("#devMobAudioHit")?.value||"",death:root.querySelector("#devMobAudioDeath")?.value||""},audioRadius:Math.max(100,n("devMobAudioRadius")||430),lootTable:newId
  };
  map[newId].levelMax=Math.max(map[newId].levelMin,map[newId].levelMax);map[newId].goldMax=Math.max(map[newId].goldMin,map[newId].goldMax);map[newId].respawnMaxSeconds=Math.max(map[newId].respawnMinSeconds,map[newId].respawnMaxSeconds);
  const drops=developerMobCollectDrops(root),oldLootId=String(oldRec.lootTable||oldId||"");LOOT_TABLES[newId]=drops;
  if(oldId!==newId&&oldLootId===oldId&&oldId!==newId){const stillUsed=Object.values(map).some(m=>m?.lootTable===oldId);if(!stillUsed)delete LOOT_TABLES[oldId];}
  refreshMobTemplatesFromBalance?.();refreshAliveMobStatsForPlayer?.();return true;
}
