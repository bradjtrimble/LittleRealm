function devBalanceClone(value){ return JSON.parse(JSON.stringify(value)); }
function devReplaceBalance(source){
  for(const key of Object.keys(BALANCE)) delete BALANCE[key];
  Object.assign(BALANCE,devBalanceClone(source));
}
function devCombatNum(value,fallback=0){
  const n=Number(value); return Number.isFinite(n)?n:fallback;
}
function devCombatField(field,label,value,step="1",min=null,max=null){
  return `<label class="devCombatField">${label}<input type="number" data-combat-field="${field}" value="${value}" step="${step}"${min!==null?` min="${min}"`:""}${max!==null?` max="${max}"`:""}></label>`;
}
function devGlobalField(field,label,value,step="1",min=null,max=null){
  return `<label class="devCombatField">${label}<input type="number" data-global-field="${field}" value="${value}" step="${step}"${min!==null?` min="${min}"`:""}${max!==null?` max="${max}"`:""}></label>`;
}
function devProgressionField(field,label,value,step="1",min=null,max=null){
  return `<label class="devCombatField">${label}<input type="number" data-progression-field="${field}" value="${value}" step="${step}"${min!==null?` min="${min}"`:""}${max!==null?` max="${max}"`:""}></label>`;
}
function developerXpNextForLevel(level){
  return xpRequiredForLevel(level);
}
function captureDeveloperPlayerBaseline(){
  if(devPlayerTestBaseline) return;
  devPlayerTestBaseline={level:state.level,xp:state.xp,xpNext:state.xpNext,hp:state.hp,maxHp:state.maxHp,atk:state.atk,def:state.def};
}
function applyDeveloperPlayerLevel(rawLevel){
  captureDeveloperPlayerBaseline();
  const level=Math.max(1,Math.min(playerLevelCap(),Math.floor(devCombatNum(rawLevel,state.level))));
  const steps=level-1;
  state.level=level;
  state.xp=0;
  state.xpNext=developerXpNextForLevel(level);
  state.maxHp=Math.max(1,Math.floor(numberOr(BALANCE.player?.maxHp,30)+steps*numberOr(BALANCE.progression?.hpPerLevel,8)));
  state.atk=Math.max(0,Math.floor(numberOr(BALANCE.player?.attack,5)+steps*numberOr(BALANCE.progression?.attackPerLevel,2)));
  state.def=Math.max(0,Math.floor(numberOr(BALANCE.player?.defense,1)+steps*numberOr(BALANCE.progression?.defensePerLevel,1)));
  state.hp=state.maxHp;
  refreshAliveMobStatsForPlayer();
  updateUI(); updateCombatHud(); refreshDeveloperCombatPanel();
  devSetStatus(`Player test level set to ${level}`);
}
function restoreDeveloperPlayerBaseline(){
  if(!devPlayerTestBaseline){devSetStatus("No player test-level baseline captured yet");return;}
  Object.assign(state,devPlayerTestBaseline);
  devPlayerTestBaseline=null;
  refreshAliveMobStatsForPlayer(); updateUI(); updateCombatHud(); refreshDeveloperCombatPanel();
  devSetStatus(`Restored player to level ${state.level}`);
}
function applyDeveloperSpeciesBalance(){
  if(!devPanel) return;
  const cfg=BALANCE.mobs?.[devCombatMobType];
  if(!cfg) return;
  const panel=devPanel.querySelector("#devCombatSpecies");
  panel?.querySelectorAll("[data-combat-field]").forEach(input=>{
    const key=input.dataset.combatField;
    cfg[key]=input.type==="checkbox"?input.checked:devCombatNum(input.value,cfg[key]);
  });
  cfg.baseLevel=Math.max(1,Math.floor(devCombatNum(cfg.baseLevel,1)));
  cfg.levelMin=Math.max(1,Math.floor(devCombatNum(cfg.levelMin,cfg.baseLevel)));
  cfg.levelMax=Math.max(cfg.levelMin,Math.floor(devCombatNum(cfg.levelMax,cfg.baseLevel)));
  cfg.hp=Math.max(1,devCombatNum(cfg.hp,1));
  cfg.attack=Math.max(0,devCombatNum(cfg.attack,0));
  cfg.defense=Math.max(0,devCombatNum(cfg.defense,0));
  cfg.xpMultiplier=Math.max(0,devCombatNum(cfg.xpMultiplier,1));
  cfg.eliteChancePercent=Math.max(0,Math.min(100,devCombatNum(cfg.eliteChancePercent,0)));
  refreshMobTemplatesFromBalance();
  refreshDeveloperCombatPanel(); updateCombatHud();
  devSetStatus(`${mobTypeScaleLabel(devCombatMobType)} combat settings applied live`);
}
function applyDeveloperGlobalCombatBalance(){
  if(!devPanel) return;
  BALANCE.mobLevels=BALANCE.mobLevels||{};
  devPanel.querySelectorAll("#devCombatGlobals [data-global-field]").forEach(input=>{
    BALANCE.mobLevels[input.dataset.globalField]=devCombatNum(input.value,BALANCE.mobLevels[input.dataset.globalField]);
  });
  BALANCE.progression=BALANCE.progression||{};
  devPanel.querySelectorAll("#devCombatGlobals [data-progression-field]").forEach(input=>{
    BALANCE.progression[input.dataset.progressionField]=devCombatNum(input.value,BALANCE.progression[input.dataset.progressionField]);
  });
  refreshMobTemplatesFromBalance(); refreshAliveMobStatsForPlayer(); updateCombatHud(); refreshDeveloperCombatPanel();
  devSetStatus("Global mob-level combat settings applied live");
}
function exportDeveloperBalance(){
  const text=`/* Exported from Little Realm Developer Mode */\nwindow.LR_BALANCE = ${JSON.stringify(BALANCE,null,2)};\n`;
  const blob=new Blob([text],{type:"text/javascript"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download="game-balance.js"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  devSetStatus("Exported game-balance.js");
}
function resetDeveloperCombatBalance(){
  if(!confirm("Reset live combat tuning to the project game-balance.js values?")) return;
  devReplaceBalance(DEV_PROJECT_BALANCE); refreshMobTemplatesFromBalance(); rerollMobLevelsAndElites(); refreshDeveloperCombatPanel(); updateCombatHud();
  devSetStatus("Combat tuning reset to project balance");
}
function developerMobPreview(){
  const mob=(devSelectedMob && mobTypeScaleKey(devSelectedMob)===devCombatMobType && devSelectedMob.alive)?devSelectedMob:mobs.find(m=>mobTypeScaleKey(m)===devCombatMobType && m.alive);
  if(!mob) return `<div class="devEmpty">No live ${mobTypeScaleLabel(devCombatMobType)} spawn available for preview.</div>`;
  const aggro=mobAggroRanges(mob);
  return `<div class="devHint">Live preview: Lv ${mob.level} ${mobDisplayName(mob)}${mob.dangerSteps?` • ${mob.dangerSteps} danger stack${mob.dangerSteps===1?"":"s"}`:""}</div><div class="devStatPreview"><div><b>${mob.maxHp}</b><span>HP</span></div><div><b>${mob.atk}</b><span>Damage</span></div><div><b>${mob.def}</b><span>Armor</span></div><div><b>${mobXpReward(mob)}</b><span>XP now</span></div><div><b>${Math.round(playerHitChanceAgainst(mob))}%</b><span>Your hit</span></div><div><b>${Math.round(mobHitChanceAgainstPlayer(mob))}%</b><span>Mob hit</span></div><div><b>${Math.round(aggro.trigger)}</b><span>Aggro</span></div><div><b>${mob.elite?"ELITE":mob.boss?"BOSS":"NORMAL"}</b><span>Rank</span></div></div>`;
}
function refreshDeveloperCombatPanel(){
  if(!devPanel) return;
  const player=devPanel.querySelector("#devPlayerTestPanel");
  const species=devPanel.querySelector("#devCombatSpecies");
  const globals=devPanel.querySelector("#devCombatGlobals");
  if(!player||!species||!globals) return;

  // Developer Mode is initialized before reset() creates the player state.
  // Do not let the optional tuning UI interrupt normal game startup.
  if(!state){
    player.innerHTML='<div class="devEmpty">Combat testing becomes available after the game finishes initializing.</div>';
    species.innerHTML='<div class="devEmpty">Mob tuning will load when Developer Mode is opened.</div>';
    globals.innerHTML='<div class="devEmpty">Global combat tuning will load when Developer Mode is opened.</div>';
    return;
  }

  player.innerHTML=`<div class="devPlayerTest"><label class="devCombatField">Player Test Level<input id="devPlayerTestLevel" type="number" min="1" max="100" step="1" value="${state.level}"></label><div><div class="devHint">Temporary testing control. Recalculates player HP/Attack/Defense and immediately refreshes danger scaling on living mobs.</div><div class="devQuickLevels">${[1,5,10,25,50,100].map(n=>`<button data-test-level="${n}">Lv ${n}</button>`).join("")}</div></div></div><div class="devStatPreview"><div><b>${state.level}</b><span>Level</span></div><div><b>${state.maxHp}</b><span>HP</span></div><div><b>${state.atk}</b><span>Attack</span></div><div><b>${state.def}</b><span>Defense</span></div></div><div class="devCombatActions"><button id="devSetPlayerLevel" class="primary">Apply Test Level</button><button id="devRestorePlayerLevel">Restore Before Testing</button><button id="devFullHeal">Full Heal</button></div>`;
  player.querySelector("#devSetPlayerLevel").onclick=()=>applyDeveloperPlayerLevel(player.querySelector("#devPlayerTestLevel").value);
  player.querySelectorAll("[data-test-level]").forEach(b=>b.onclick=()=>applyDeveloperPlayerLevel(b.dataset.testLevel));
  player.querySelector("#devRestorePlayerLevel").onclick=restoreDeveloperPlayerBaseline;
  player.querySelector("#devFullHeal").onclick=()=>{state.hp=state.maxHp;updateUI();devSetStatus("Player fully healed");};

  const types=Object.keys(BALANCE.mobs||{});
  if(!types.includes(devCombatMobType))devCombatMobType=types[0]||null;
  const cfg=BALANCE.mobs?.[devCombatMobType]||{};
  species.innerHTML=`<div id="devCombatMobChips">${types.map(k=>`<button class="devMobTypeChip${k===devCombatMobType?" active":""}" data-combat-mob="${k}">${mobTypeScaleLabel(k)}</button>`).join("")}</div><div class="devCombatGrid" style="margin-top:10px">${devCombatField("baseLevel","Base level",cfg.baseLevel??1,1,1,100)}${devCombatField("levelMin","Min spawn level",cfg.levelMin??cfg.baseLevel??1,1,1,100)}${devCombatField("levelMax","Max spawn level",cfg.levelMax??cfg.baseLevel??1,1,1,100)}${devCombatField("hp","Base HP",cfg.hp??1,1,1)}${devCombatField("attack","Base damage",cfg.attack??0,1,0)}${devCombatField("defense","Base armor",cfg.defense??0,.1,0)}${devCombatField("xpMultiplier","XP multiplier ×",cfg.xpMultiplier??1,.05,0)}${devCombatField("eliteChancePercent","Elite chance %",cfg.eliteChancePercent??0,.5,0,100)}${devCombatField("attackIntervalSeconds","Attack interval",cfg.attackIntervalSeconds??1.5,.05,.1)}${devCombatField("aggroTriggerRange","Base aggro range",cfg.aggroTriggerRange??0,1,0)}${devCombatField("alertRange","Base alert range",cfg.alertRange??0,1,0)}${devCombatField("chaseSpeed","Chase speed",cfg.chaseSpeed??0,1,0)}</div><label class="devCombatCheck" style="margin-top:9px"><input type="checkbox" data-combat-field="aggressive" ${cfg.aggressive?"checked":""}> Aggressive / auto-aggro</label>${developerMobPreview()}<div class="devCombatActions"><button id="devApplySpecies" class="primary">Apply ${mobTypeScaleLabel(devCombatMobType)} Stats</button><button id="devRerollSpecies">Reroll Levels + Elites</button></div>`;
  species.querySelectorAll("[data-combat-mob]").forEach(b=>b.onclick=()=>{devCombatMobType=b.dataset.combatMob;devSelectedMob=mobs.find(m=>mobTypeScaleKey(m)===devCombatMobType)||devSelectedMob;refreshDeveloperCombatPanel();});
  species.querySelector("#devApplySpecies").onclick=applyDeveloperSpeciesBalance;
  species.querySelector("#devRerollSpecies").onclick=()=>{applyDeveloperSpeciesBalance();rerollMobLevelsAndElites(devCombatMobType);refreshDeveloperCombatPanel();devSetStatus(`${mobTypeScaleLabel(devCombatMobType)} levels and elite rolls refreshed`);};

  const g=BALANCE.mobLevels||{};
  globals.innerHTML=`
  <details class="devCombatDetails" open><summary>Normal Level Scaling</summary><div class="devCombatGrid">${devGlobalField("hpGrowthPerLevelPercent","HP growth / level %",g.hpGrowthPerLevelPercent??14,.5)}${devGlobalField("attackGrowthPerLevelPercent","Damage growth / level %",g.attackGrowthPerLevelPercent??10,.5)}${devGlobalField("armorPerLevel","Armor / level",g.armorPerLevel??.55,.05)}</div></details>
  <details class="devCombatDetails" open><summary>High-Level Danger Boost</summary><div class="devCombatGrid">${devGlobalField("dangerStartsAbovePlayerLevels","Starts above player levels",g.dangerStartsAbovePlayerLevels??3,1,0)}${devGlobalField("dangerHpPerExtraLevelPercent","HP / danger level %",g.dangerHpPerExtraLevelPercent??12,.5)}${devGlobalField("dangerAttackPerExtraLevelPercent","Damage / danger level %",g.dangerAttackPerExtraLevelPercent??9,.5)}${devGlobalField("dangerArmorPerExtraLevel","Armor / danger level",g.dangerArmorPerExtraLevel??.6,.05)}${devGlobalField("dangerXpPerExtraLevelPercent","XP / danger level %",g.dangerXpPerExtraLevelPercent??10,.5)}</div></details>
  <details class="devCombatDetails"><summary>Elite Multipliers</summary><div class="devCombatGrid">${devGlobalField("eliteHpMultiplier","Elite HP ×",g.eliteHpMultiplier??1.65,.05)}${devGlobalField("eliteAttackMultiplier","Elite damage ×",g.eliteAttackMultiplier??1.2,.05)}${devGlobalField("eliteArmorBonus","Elite armor +",g.eliteArmorBonus??2,.1)}${devGlobalField("eliteXpMultiplier","Elite XP ×",g.eliteXpMultiplier??1.6,.05)}${devGlobalField("eliteGoldMultiplier","Elite gold ×",g.eliteGoldMultiplier??1.5,.05)}${devGlobalField("eliteAggroMultiplier","Elite aggro ×",g.eliteAggroMultiplier??1.15,.05)}</div></details>
  <details class="devCombatDetails"><summary>Boss Multipliers</summary><div class="devCombatGrid">${devGlobalField("bossHpMultiplier","Boss HP ×",g.bossHpMultiplier??1.5,.05)}${devGlobalField("bossAttackMultiplier","Boss damage ×",g.bossAttackMultiplier??1.25,.05)}${devGlobalField("bossArmorMultiplier","Boss armor ×",g.bossArmorMultiplier??1.25,.05)}${devGlobalField("bossXpMultiplier","Boss XP ×",g.bossXpMultiplier??1.75,.05)}${devGlobalField("bossAggroMultiplier","Boss aggro ×",g.bossAggroMultiplier??1.25,.05)}</div></details>
  <details class="devCombatDetails"><summary>Level-Based Aggro</summary><div class="devCombatGrid">${devGlobalField("aggroRangePerLevelDifference","Aggro / level diff",g.aggroRangePerLevelDifference??7,1)}${devGlobalField("alertRangePerLevelDifference","Alert / level diff",g.alertRangePerLevelDifference??9,1)}${devGlobalField("minimumAggroTriggerRange","Minimum aggro",g.minimumAggroTriggerRange??20,1,0)}${devGlobalField("minimumAlertRange","Minimum alert",g.minimumAlertRange??34,1,0)}</div></details>
  <details class="devCombatDetails"><summary>Hit / Miss</summary><div class="devCombatGrid">${devGlobalField("playerBaseHitChancePercent","Player base hit %",g.playerBaseHitChancePercent??96,.5,0,100)}${devGlobalField("enemyBaseHitChancePercent","Mob base hit %",g.enemyBaseHitChancePercent??92,.5,0,100)}${devGlobalField("playerHitChancePerLevelAdvantagePercent","Player hit / level %",g.playerHitChancePerLevelAdvantagePercent??4,.5)}${devGlobalField("enemyHitChancePerLevelAdvantagePercent","Mob hit / level %",g.enemyHitChancePerLevelAdvantagePercent??3,.5)}${devGlobalField("minimumHitChancePercent","Minimum hit %",g.minimumHitChancePercent??55,.5,0,100)}${devGlobalField("maximumHitChancePercent","Maximum hit %",g.maximumHitChancePercent??99,.5,0,100)}${devGlobalField("elitePlayerHitPenaltyPercent","Elite player penalty %",g.elitePlayerHitPenaltyPercent??3,.5)}${devGlobalField("eliteEnemyHitBonusPercent","Elite mob bonus %",g.eliteEnemyHitBonusPercent??3,.5)}${devGlobalField("bossPlayerHitPenaltyPercent","Boss player penalty %",g.bossPlayerHitPenaltyPercent??5,.5)}${devGlobalField("bossEnemyHitBonusPercent","Boss mob bonus %",g.bossEnemyHitBonusPercent??5,.5)}</div></details>
  <details class="devCombatDetails"><summary>XP Rules</summary><div class="devCombatGrid">${devProgressionField("sameLevelMobXpBase","Lv 1 standard mob XP",BALANCE.progression?.sameLevelMobXpBase??50,1,1)}${devProgressionField("sameLevelMobXpPerLevel","Standard mob XP / level +",BALANCE.progression?.sameLevelMobXpPerLevel??5,1,0)}${devGlobalField("trivialXpStartsAboveMobLevels","Level-gap XP floor starts",g.trivialXpStartsAboveMobLevels??5,1,1)}${devGlobalField("lowLevelXpPenaltyPerLevelPercent","Low-level penalty / level %",g.lowLevelXpPenaltyPerLevelPercent??20,.5)}${devGlobalField("higherLevelXpBonusPerLevelPercent","High-level XP bonus / level %",g.higherLevelXpBonusPerLevelPercent??8,.5)}</div><div class="devHint" style="margin-top:8px">A normal same-level hostile follows the level curve (50 XP at Lv 1, +5 per level by default). Species XP multipliers, elite/boss bonuses, and level-gap rules are applied after that.</div></details>
  <div class="devCombatActions"><button id="devApplyGlobals" class="primary">Apply Global Combat Settings</button><button id="devRerollAll">Reroll All Mob Levels + Elites</button><button id="devExportBalance">Export game-balance.js</button><button id="devResetBalance" class="danger">Reset Combat Tuning</button></div>`;
  globals.querySelector("#devApplyGlobals").onclick=applyDeveloperGlobalCombatBalance;
  globals.querySelector("#devRerollAll").onclick=()=>{applyDeveloperGlobalCombatBalance();rerollMobLevelsAndElites();refreshDeveloperCombatPanel();devSetStatus("All mob levels and elite rolls refreshed");};
  globals.querySelector("#devExportBalance").onclick=()=>{applyDeveloperSpeciesBalance();applyDeveloperGlobalCombatBalance();exportDeveloperBalance();};
  globals.querySelector("#devResetBalance").onclick=resetDeveloperCombatBalance;
}


