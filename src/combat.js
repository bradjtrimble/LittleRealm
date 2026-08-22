// Open-world combat state (RuneScape-style auto combat)
// Routine balance values come from config/game-balance.js so they can be
// changed independently without rebuilding js/game.js.
const ATTACK_RANGE=numberOr(BALANCE.combat?.meleeRange,30);
const MAX_ENGAGE_RANGE=numberOr(BALANCE.combat?.engageRange,72);
const DISENGAGE_RANGE=numberOr(BALANCE.combat?.disengageRange,260);
const AUTO_CHASE_RANGE=numberOr(BALANCE.combat?.autoChaseRange,82);
const PLAYER_ATTACK_INTERVAL=numberOr(BALANCE.combat?.playerAttackIntervalSeconds,1.15);
const ATTACK_BUTTON_GCD=numberOr(BALANCE.combat?.attackButtonCooldownSeconds,.90);
const ATTACK_START_DELAY=numberOr(BALANCE.combat?.openingAttackDelaySeconds,.62);
const PLAYER_CRIT_CHANCE=percentOr(BALANCE.combat?.playerCritChancePercent,10);
const PLAYER_DAMAGE_MIN=Math.floor(numberOr(BALANCE.combat?.playerDamageBonusMin,0));
const PLAYER_DAMAGE_MAX=Math.floor(numberOr(BALANCE.combat?.playerDamageBonusMax,3));
const ENEMY_DAMAGE_MIN=Math.floor(numberOr(BALANCE.combat?.enemyDamageBonusMin,0));
const ENEMY_DAMAGE_MAX=Math.floor(numberOr(BALANCE.combat?.enemyDamageBonusMax,2));
const TARGET_CLICK_RADIUS=numberOr(BALANCE.combat?.targetClickRadius,34);
const POTION_HEAL=Math.max(0,Math.floor(numberOr(BALANCE.player?.potionHeal,14)));
const POTION_COOLDOWN=numberOr(BALANCE.player?.potionCooldownSeconds,.85);
const DEATH_GOLD_LOSS=percentOr(BALANCE.player?.deathGoldLossPercent,25);
let combatTarget=null;
let selectedTarget=null;
let playerAttackTimer=0;
let enemyAttackTimer=0;
let attackButtonCooldown=0;
let playerAttackAnim=0;
let enemyAttackAnim=0;
let potionCooldown=0;
let combatFx=[];
let bossMob=null;
let combatHudSignature="";

function combatHitChancePercent(base,levelAdvantage,perLevel,rankAdjustment=0){
  const cfg=BALANCE.mobLevels||{};
  const min=Math.max(0,numberOr(cfg.minimumHitChancePercent,55));
  const max=Math.min(100,numberOr(cfg.maximumHitChancePercent,99));
  return clamp(numberOr(base,95)+levelAdvantage*numberOr(perLevel,4)+rankAdjustment,min,max);
}

function playerHitChanceAgainst(mob){
  const cfg=BALANCE.mobLevels||{};
  let rankPenalty=0;
  if(mob?.boss || mob?.template?.boss) rankPenalty-=numberOr(cfg.bossPlayerHitPenaltyPercent,5);
  else if(mob?.elite) rankPenalty-=numberOr(cfg.elitePlayerHitPenaltyPercent,3);
  return combatHitChancePercent(
    cfg.playerBaseHitChancePercent,
    state.level-(mob?.level||state.level),
    cfg.playerHitChancePerLevelAdvantagePercent,
    rankPenalty
  );
}

function mobHitChanceAgainstPlayer(mob){
  const cfg=BALANCE.mobLevels||{};
  let rankBonus=0;
  if(mob?.boss || mob?.template?.boss) rankBonus+=numberOr(cfg.bossEnemyHitBonusPercent,5);
  else if(mob?.elite) rankBonus+=numberOr(cfg.eliteEnemyHitBonusPercent,3);
  return combatHitChancePercent(
    cfg.enemyBaseHitChancePercent,
    (mob?.level||state.level)-state.level,
    cfg.enemyHitChancePerLevelAdvantagePercent,
    rankBonus
  );
}

function getMobRespawnSeconds(mob){
  if(!mob||mob.boss) return 999999;
  const min=Math.min(mob.template.respawnMin,mob.template.respawnMax);
  const max=Math.max(mob.template.respawnMin,mob.template.respawnMax);
  return min+Math.random()*(max-min);
}

function selectMob(mob,showToast=true){
  if(!mob||!mob.alive||mob.returningHome) return false;
  selectedTarget=mob;
  updateCombatHud();
  if(showToast) toast(`Lv ${mob.level} ${mobDisplayName(mob)} targeted • ${Math.max(0,Math.ceil(mob.hp))}/${mob.maxHp} HP`);
  return true;
}

function clearSelectedTarget(){
  selectedTarget=null;
  updateCombatHud();
}

function getHudTarget(){
  if(selectedTarget && selectedTarget.alive && !selectedTarget.returningHome) return selectedTarget;
  if(combatTarget && combatTarget.alive) return combatTarget;
  selectedTarget=null;
  return null;
}

function updateOpenCombat(dt){
  playerAttackAnim=Math.max(0,playerAttackAnim-dt);
  enemyAttackAnim=Math.max(0,enemyAttackAnim-dt);
  let liveFx=0;
  for(let i=0;i<combatFx.length;i++){
    const fx=combatFx[i];
    fx.life-=dt;
    if(fx.life>0) combatFx[liveFx++]=fx;
  }
  combatFx.length=liveFx;

  if(!combatTarget){updateCombatHud();return}
  if(!combatTarget.alive){disengageCombat(false);return}

  const d=dist(state.x,state.y,combatTarget.x,combatTarget.y);
  if(d>DISENGAGE_RANGE){
    disengageCombat(false);
    toast("You left combat.");
    return;
  }

  if(d>ATTACK_RANGE){
    // Closing distance does not preload an instant hit. The first swing still
    // respects the attack cycle once the fighter reaches melee range.
    playerAttackTimer=Math.max(playerAttackTimer,.12);
    enemyAttackTimer=Math.max(enemyAttackTimer,.12);
    updateCombatHud();
    return;
  }

  playerAttackTimer-=dt;
  enemyAttackTimer-=dt;

  if(playerAttackTimer<=0 && combatTarget && combatTarget.alive){
    performPlayerAutoAttack(combatTarget);
    playerAttackTimer=PLAYER_ATTACK_INTERVAL;
  }

  if(enemyAttackTimer<=0 && combatTarget && combatTarget.alive){
    // Capture the attacker and schedule its next swing BEFORE applying damage.
    // A killing blow can clear combatTarget during worldCombatDeath(), so never
    // dereference combatTarget after performEnemyAutoAttack() returns.
    const attackingMob=combatTarget;
    enemyAttackTimer=numberOr(attackingMob.template.attackInterval,1.45);
    performEnemyAutoAttack(attackingMob);
    if(!combatTarget){
      updateCombatHud();
      return;
    }
  }
  updateCombatHud();
}

function targetThreatInfo(mob){
  const delta=(mob?.level||1)-state.level;
  if(mob?.boss) return {label:"BOSS",cls:"boss"};
  if(mob?.elite) return {label:"ELITE",cls:"elite"};
  if(delta>=4) return {label:"DEADLY",cls:"deadly"};
  if(delta>=2) return {label:"DANGEROUS",cls:"dangerous"};
  if(delta<=-5) return {label:"TRIVIAL",cls:"trivial"};
  if(delta<=-2) return {label:"LOW",cls:"low"};
  return {label:"EVEN",cls:"even"};
}

function updateCombatHud(){
  const target=getHudTarget();
  let signature;
  let targetDistance=0;
  let targetDisplayName="";
  let threat=null;
  let hitChance=0;
  let near=null;

  if(target){
    targetDistance=dist(state.x,state.y,target.x,target.y);
    targetDisplayName=mobDisplayName(target);
    threat=targetThreatInfo(target);
    hitChance=Math.round(playerHitChanceAgainst(target));
    signature=[
      "target",target.id,targetDisplayName,target.level,target.hp,target.maxHp,target.def,
      target.boss?1:0,target.elite?1:0,threat.cls,hitChance,
      Math.ceil(targetDistance),targetDistance>ATTACK_RANGE?1:0,targetDistance>MAX_ENGAGE_RANGE?1:0,
      combatTarget&&combatTarget.alive?1:0,
      attackButtonCooldown>0?attackButtonCooldown.toFixed(1):"ready"
    ].join("|");
  }else{
    near=findNearestMob(MAX_ENGAGE_RANGE);
    signature=`none|${near?.id||""}|${attackButtonCooldown>0?attackButtonCooldown.toFixed(1):"ready"}`;
  }

  // updateOpenCombat runs every frame. Most frames do not change any visible
  // target HUD value, so avoid repeated DOM queries/writes until the rendered
  // state actually changes.
  if(signature===combatHudSignature) return;

  const hud=document.getElementById("targetHud");
  const action=document.getElementById("actionHint");
  if(!hud||!action) return;
  combatHudSignature=signature;
  action.classList.remove("ready","engaged","cooldown","targeted");

  if(target){
    hud.classList.add("show");
    const targetName=document.getElementById("targetName");
    targetName.textContent=`Lv ${target.level} ${targetDisplayName}`;
    targetName.style.color=mobLevelColor(target.level,target.boss,target.elite);
    document.getElementById("targetHpText").textContent=`${Math.max(0,Math.ceil(target.hp))}/${target.maxHp} HP`;
    document.getElementById("targetHpFill").style.width=`${Math.max(0,100*target.hp/target.maxHp)}%`;
    const threatEl=document.getElementById("targetThreat");
    threatEl.textContent=threat.label;
    threatEl.className=`threat-${threat.cls}`;
    document.getElementById("targetCombatStats").textContent=`DEF ${target.def} • HIT ${hitChance}%`;

    if(combatTarget && combatTarget.alive){
      document.getElementById("combatHint").textContent=targetDistance>ATTACK_RANGE?"Closing to melee range…":"In combat • move away to escape";
      action.innerHTML="LEAVE<br>COMBAT";
      action.classList.add("engaged");
      return;
    }

    document.getElementById("combatHint").textContent=targetDistance>MAX_ENGAGE_RANGE?`Targeted • ${Math.ceil(targetDistance)} away • move closer`:`Targeted • ${Math.ceil(targetDistance)} away • ready to attack`;
    if(attackButtonCooldown>0){
      action.innerHTML=`ATTACK<br>${attackButtonCooldown.toFixed(1)}s`;
      action.classList.add("cooldown");
    }else if(targetDistance<=MAX_ENGAGE_RANGE){
      action.innerHTML="ATTACK<br>TARGET";
      action.classList.add("ready");
    }else{
      action.innerHTML="MOVE<br>CLOSER";
      action.classList.add("targeted");
    }
    return;
  }

  hud.classList.remove("show");
  if(attackButtonCooldown>0){
    action.innerHTML=`ATTACK<br>${attackButtonCooldown.toFixed(1)}s`;
    action.classList.add("cooldown");
  }else{
    action.innerHTML=near?"ATTACK<br>NEAREST":"SELECT MOB<br>TO TARGET";
    if(near) action.classList.add("ready");
  }
}

function engageMob(mob,forced=false){
  if(!mob||!mob.alive||mob.returningHome) return false;
  if(combatTarget===mob) return true;

  const engageDistance=dist(state.x,state.y,mob.x,mob.y);
  if(!forced && engageDistance>MAX_ENGAGE_RANGE){
    selectMob(mob,false);
    toast("Target selected. Move closer before attacking.");
    return false;
  }
  if(!forced && attackButtonCooldown>0){
    toast(`Attack ready in ${attackButtonCooldown.toFixed(1)}s.`);
    return false;
  }

  if(combatTarget && combatTarget!==mob) startMobLeashReturn(combatTarget);
  selectedTarget=mob;
  combatTarget=mob;
  currentMob=mob;
  mob.aggro=true;
  playMobAudio(mob,"aggro");
  if(!forced) attackButtonCooldown=ATTACK_BUTTON_GCD;

  // Starting or switching combat can never grant an instant free hit.
  playerAttackTimer=Math.max(playerAttackTimer,ATTACK_START_DELAY);
  enemyAttackTimer=Math.max(enemyAttackTimer,ATTACK_START_DELAY-.08);
  heroFacing=vectorFacing(mob.x-state.x,mob.y-state.y,heroFacing);
  updateCombatHud();
  if(!forced) toast(`Engaged Lv ${mob.level} ${mobDisplayName(mob)}.`);
  return true;
}

function disengageCombat(showToast=true){
  const disengagedMob=combatTarget;
  if(disengagedMob){
    disengagedMob.aggro=false;
    startMobLeashReturn(disengagedMob);
  }
  combatTarget=null; currentMob=null;
  playerAttackTimer=0; enemyAttackTimer=0;
  updateCombatHud();
  if(showToast) toast("Combat disengaged.");
}

function addCombatFx(x,y,text,kind="damage"){
  combatFx.push({x,y,text,kind,life:.8,maxLife:.8});
}

function performPlayerAutoAttack(mob){
  if(!mob||!mob.alive) return;
  playerAttackAnim=.20;
  playAudioEvent("playerAttack",{bus:"sfx",volume:.8,x:state.x,y:state.y,radius:180});
  if(Math.random()*100>=playerHitChanceAgainst(mob)){
    addCombatFx(mob.x,mob.y-18,"MISS","miss");
    return;
  }
  const crit=Math.random()<PLAYER_CRIT_CHANCE;
  const low=Math.min(PLAYER_DAMAGE_MIN,PLAYER_DAMAGE_MAX);
  const high=Math.max(PLAYER_DAMAGE_MIN,PLAYER_DAMAGE_MAX);
  let dmg=Math.max(1,state.atk+rand(low,high)-mob.def);
  if(crit) dmg*=2;
  mob.hp-=dmg;
  playMobAudio(mob,"hit");
  addCombatFx(mob.x,mob.y-18,crit?`★ ${dmg}`:`${dmg}`,crit?"crit":"damage");
  if(mob.hp<=0){
    mob.hp=0;
    defeatWorldMob(mob);
  }
}

function performEnemyAutoAttack(mob){
  if(!mob||!mob.alive) return;
  mob.attackAnim=.20;
  playMobAudio(mob,"attack");
  enemyAttackAnim=.20;
  if(Math.random()*100>=mobHitChanceAgainstPlayer(mob)){
    addCombatFx(state.x,state.y-20,"MISS","miss");
    return;
  }
  const low=Math.min(ENEMY_DAMAGE_MIN,ENEMY_DAMAGE_MAX);
  const high=Math.max(ENEMY_DAMAGE_MIN,ENEMY_DAMAGE_MAX);
  let dmg=Math.max(1,mob.atk+rand(low,high)-state.def);
  state.hp=Math.max(0,state.hp-dmg);
  playAudioEvent("playerHit",{bus:"sfx",volume:.85,x:state.x,y:state.y,radius:180});
  addCombatFx(state.x,state.y-20,`-${dmg}`,"hurt");
  updateUI();
  if(state.hp<=0) worldCombatDeath();
}

function defeatWorldMob(mob){
  if(!mob||!mob.alive) return;
  playMobAudio(mob,"death");
  const e=mob.template;
  let gold=0;
  let potionDrop=0;
  if(Math.random()<e.goldDropChance) gold=rand(Math.floor(e.gold[0]),Math.floor(e.gold[1]));
  if(mob.elite && gold>0) gold=Math.max(1,Math.round(gold*numberOr(BALANCE.mobLevels?.eliteGoldMultiplier,1.5)));
  if(e.potionDropAmount>0 && Math.random()<e.potionDropChance) potionDrop=e.potionDropAmount;

  const xpReward=mobXpReward(mob);
  const lootReward=rollMobLoot(mob);
  const lootPile=spawnMobLootPile(mob,lootReward.rolled,gold,potionDrop,mobDisplayName(mob));
  const hasLoot=lootPileHasLoot(lootPile);
  state.xp+=xpReward;
  state.kills++;

  notifyQuestKill(e.configKey||e.kind||mob.kind,1);

  mob.alive=false;
  mob.aggro=false;
  mob.respawnTimer=getMobRespawnSeconds(mob);
  if(selectedTarget===mob) selectedTarget=null;
  levelCheck();
  disengageCombat(false);

  if(mob.boss){
    toast(`You defeated ${mobDisplayName(mob)}!${hasLoot?" Sparkling remains hold loot.":""}`);
  }else{
    const rewards=[`+${xpReward} XP`];
    rewards.push(hasLoot?"loot in sparkling remains":"no loot");
    toast(`Defeated ${mobDisplayName(mob)}: ${rewards.join(", ")}`);
  }
  updateUI();
}

function worldCombatDeath(){
  state.gold=Math.floor(state.gold*(1-DEATH_GOLD_LOSS));

  // Clear active controls/effects before teleporting so the new life begins in
  // a clean frame even if a direction or combat button was held at death.
  input={up:false,down:false,left:false,right:false};
  isHeroMoving=false;
  playerAttackTimer=0;
  enemyAttackTimer=0;
  playerAttackAnim=0;
  enemyAttackAnim=0;
  combatFx=[];

  if(combatTarget && !combatTarget.boss){
    combatTarget.x=combatTarget.homeX; combatTarget.y=combatTarget.homeY;
  }
  disengageCombat(false);
  selectedTarget=null;

  state.hp=state.maxHp;
  state.x=START_X; state.y=START_Y;
  lastSafePos={x:state.x,y:state.y};
  toast("You wake up back at the zone start.");
  updateUI();
}

function useQuickPotion(){
  if(potionCooldown>0) return;
  if(state.potions<=0){toast("Your potion pouch is empty.");return}
  if(state.hp>=state.maxHp){toast("Your HP is already full.");return}
  state.potions--;
  const before=state.hp;
  state.hp=Math.min(state.maxHp,state.hp+POTION_HEAL);
  potionCooldown=POTION_COOLDOWN;
  addCombatFx(state.x,state.y-20,`+${state.hp-before}`,"heal");
  playAudioEvent("potion",{bus:"sfx",volume:.8});
  toast(`Potion restored ${state.hp-before} HP.`);
  updateUI();
}

function handleWorldTap(ev){
  if(document.getElementById("menu").classList.contains("show")) return;
  const rect=game.getBoundingClientRect();
  const sx=ev.clientX-rect.left, sy=ev.clientY-rect.top;
  const viewW=innerWidth/CAMERA_ZOOM, viewH=innerHeight/CAMERA_ZOOM;
  const camX=state.x-viewW/2, camY=state.y-viewH/2;
  const wx=camX+sx/CAMERA_ZOOM, wy=camY+sy/CAMERA_ZOOM;

  const tappedLootPile=findLootPileAtWorld(wx,wy,{lootableOnly:true});
  if(tappedLootPile){
    interactWithLootPile(tappedLootPile);
    return;
  }

  const tappedNpc=findNpcAtWorld(wx,wy);
  if(tappedNpc){
    interactWithNpc(tappedNpc);
    return;
  }

  const tappedObject=findInteractableWorldObjectAt(wx,wy);
  if(tappedObject){
    interactWithWorldObject(tappedObject);
    return;
  }

  let best=null;
  let bestScore=Infinity;
  for(const mob of mobs){
    if(!mob.alive || mob.returningHome) continue;
    // Mobs are taller than their feet position, so use a generous vertical
    // selection box rather than requiring a click directly on their feet.
    const dx=Math.abs(wx-mob.x);
    const dy=wy-mob.y;
    const radius=(mob.boss?TARGET_CLICK_RADIUS*1.45:TARGET_CLICK_RADIUS)*Math.max(1,mobVisualScale(mob));
    if(dx<=radius && dy>=-radius*1.35 && dy<=radius*.75){
      const score=dx*dx+(dy*.65)*(dy*.65);
      if(score<bestScore){best=mob;bestScore=score}
    }
  }

  if(best){
    selectMob(best);
  }else if(!combatTarget){
    clearSelectedTarget();
  }
}

function battleMessage(msg){
  document.getElementById("battleMsg").textContent=msg;
}

function setBattleButtons(enabled){
  for(const id of ["attackBtn","defendBtn","potionBtn","runBtn"]){
    document.getElementById(id).disabled=!enabled;
  }
}

function setBattleTurn(mode,label){
  const el=document.getElementById("battleTurn");
  el.classList.remove("enemy","guard");
  if(mode==="enemy") el.classList.add("enemy");
  if(mode==="guard") el.classList.add("guard");
  el.textContent=label || (mode==="enemy"?"ENEMY TURN":"YOUR TURN");
}

function animateBattleActor(which,cls,duration=360){
  const el=document.getElementById(which==="hero"?"heroBattleSprite":"enemyBattleSprite");
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(()=>el.classList.remove(cls),duration);
}

function battleFloat(which,text,kind="damage"){
  const layer=document.getElementById("battleFxLayer");
  const el=document.createElement("div");
  el.className=`battleFloat ${kind}`;
  el.textContent=text;
  el.style.left=which==="hero"?"23%":"72%";
  el.style.top=which==="hero"?"47%":"42%";
  layer.appendChild(el);
  setTimeout(()=>el.remove(),820);
}

function showEnemyIntent(show,text="Enemy is preparing an attack..."){
  const el=document.getElementById("enemyIntent");
  el.textContent=text;
  el.classList.toggle("show",!!show);
}

function returnPlayerTurn(){
  if(!enemy) return;
  battleLocked=false;
  showEnemyIntent(false);
  setBattleTurn("player","YOUR TURN");
  battleMessage("Choose your next action.");
  setBattleButtons(true);
}

function startMobBattle(mob){
  if(enemy || !mob.alive) return;
  startBattle({...mob.template,level:mob.level},mob);
}

function startBattle(base,mobRef=null){
  currentMob=mobRef;
  enemy={...base};
  if(mobRef){
    enemy.level=mobRef.level;
    enemy.elite=!!mobRef.elite;
    enemy.hp=mobRef.hp;
    enemy.maxHp=mobRef.maxHp;
    enemy.atk=mobRef.atk;
    enemy.def=mobRef.def;
    enemy.xp=mobXpReward(mobRef);
  }else{
    const temp={...base,baseLevel:base.baseLevel||base.level||1,boss:!!base.boss};
    const stats=mobScaledStats(temp,base.level||temp.baseLevel,!!base.elite);
    enemy.level=base.level||temp.baseLevel;
    enemy.hp=stats.maxHp; enemy.maxHp=stats.maxHp; enemy.atk=stats.atk; enemy.def=stats.def; enemy.xp=stats.xp;
  }
  defending=false;
  battleLocked=false;
  attackButtonCooldown=0;
  input={up:false,down:false,left:false,right:false};

  document.getElementById("battleTitle").textContent=`Lv ${enemy.level||1} ${enemy.elite?"Elite ":""}${enemy.name} Encounter`;
  document.getElementById("battleScene").dataset.kind=enemy.kind||"mob";
  document.getElementById("battleFxLayer").innerHTML="";
  showEnemyIntent(false);
  setBattleTurn("player","YOUR TURN");
  battleMessage(`${enemy.name} approaches. Choose an action.`);
  setBattleButtons(true);
  document.getElementById("battle").classList.add("show");
  updateUI();
}

function heroAttack(){
  if(!enemy||battleLocked)return;
  battleLocked=true;
  setBattleButtons(false);
  setBattleTurn("guard","HERO ATTACKS");
  battleMessage("You rush forward!");
  animateBattleActor("hero","lunge",360);

  const hitTarget=currentMob||enemy;
  const hit=Math.random()*100<playerHitChanceAgainst(hitTarget);
  const crit=hit && Math.random()<.12;
  let dmg=hit?Math.max(1,state.atk+rand(0,3)-enemy.def):0;
  if(crit)dmg*=2;

  setTimeout(()=>{
    if(!enemy)return;
    if(!hit){
      battleFloat("enemy","MISS","guard");
      battleMessage("Your attack misses.");
      setTimeout(enemyTurn,650);
      return;
    }
    enemy.hp-=dmg;
    animateBattleActor("enemy","hit",300);
    battleFloat("enemy",crit?`CRIT ${dmg}`:`-${dmg}`,crit?"crit":"damage");
    battleMessage(crit?`Critical hit! ${dmg} damage.`:`You strike for ${dmg} damage.`);
    updateUI();

    if(enemy.hp<=0){setTimeout(winBattle,650);return}
    setTimeout(enemyTurn,650);
  },190);
}

function defend(){
  if(!enemy||battleLocked)return;
  battleLocked=true;
  defending=true;
  setBattleButtons(false);
  setBattleTurn("guard","GUARDING");
  document.getElementById("heroBattleSprite").classList.add("guardGlow");
  battleFloat("hero","GUARD","guard");
  battleMessage("You brace yourself. The next hit will deal less damage.");
  setTimeout(enemyTurn,620);
}

function potion(){
  if(!enemy||battleLocked)return;
  if(state.potions<=0){battleMessage("Your potion pouch is empty.");return}
  if(state.hp>=state.maxHp){battleMessage("Your HP is already full.");return}
  battleLocked=true;
  setBattleButtons(false);
  setBattleTurn("guard","USING POTION");
  state.potions--;
  playAudioEvent("potion",{bus:"sfx",volume:.8});
  const before=state.hp;
  state.hp=Math.min(state.maxHp,state.hp+POTION_HEAL);
  const healed=state.hp-before;
  battleFloat("hero",`+${healed}`,"heal");
  battleMessage(`You drink a potion and recover ${healed} HP.`);
  updateUI();
  setTimeout(enemyTurn,700);
}

function run(){
  if(!enemy||battleLocked)return;
  if(enemy.boss){battleMessage(`There is no escape from ${enemy.name}.`);return}
  battleLocked=true;
  setBattleButtons(false);
  setBattleTurn("guard","ESCAPE ATTEMPT");
  battleMessage("You look for an opening...");

  setTimeout(()=>{
    if(!enemy)return;
    if(Math.random()<.68){
      if(currentMob){
        const dx=state.x-currentMob.x;
        const dy=state.y-currentMob.y;
        const len=Math.max(1,Math.hypot(dx,dy));
        state.x+=dx/len*38;
        state.y+=dy/len*38;
      }
      endBattle();
      toast("You escaped.");
    }else{
      battleMessage("No opening! The enemy cuts you off.");
      setTimeout(enemyTurn,520);
    }
  },420);
}

function enemyTurn(){
  if(!enemy)return;
  battleLocked=true;
  setBattleButtons(false);
  setBattleTurn("enemy","ENEMY TURN");
  showEnemyIntent(true,`${enemy.name} is about to attack!`);
  battleMessage(`${enemy.name} prepares a strike...`);

  setTimeout(()=>{
    if(!enemy)return;
    showEnemyIntent(false);
    animateBattleActor("enemy","lunge",360);

    setTimeout(()=>{
      if(!enemy)return;
      const hitSource=currentMob||enemy;
      const hit=Math.random()*100<mobHitChanceAgainstPlayer(hitSource);
      if(!hit){
        defending=false;
        document.getElementById("heroBattleSprite").classList.remove("guardGlow");
        battleFloat("hero","MISS","guard");
        battleMessage(`${enemy.name} misses you.`);
        setTimeout(returnPlayerTurn,650);
        return;
      }
      let dmg=Math.max(1,enemy.atk+rand(0,2)-state.def);
      if(defending)dmg=Math.max(1,Math.floor(dmg/2));
      const guarded=defending;
      defending=false;
      document.getElementById("heroBattleSprite").classList.remove("guardGlow");
      state.hp-=dmg;
      animateBattleActor("hero","hit",300);
      battleFloat("hero",`-${dmg}`,"damage");
      battleMessage(guarded?`Guard softened the blow. You take ${dmg} damage.`:`${enemy.name} hits you for ${dmg} damage.`);
      updateUI();

      if(state.hp<=0){
        state.hp=0;
        setTimeout(loseBattle,700);
        return;
      }
      setTimeout(returnPlayerTurn,650);
    },190);
  },520);
}

function winBattle(){
  if(!enemy)return;
  const e=enemy;
  let gold=rand(e.gold[0],e.gold[1]);
  if(e.elite && gold>0) gold=Math.max(1,Math.round(gold*numberOr(BALANCE.mobLevels?.eliteGoldMultiplier,1.5)));
  let potionDrop=0;
  if(e.potionDropAmount>0 && Math.random()<e.potionDropChance) potionDrop=e.potionDropAmount;
  const lootReward=rollMobLoot(currentMob||e);
  const lootPile=spawnMobLootPile(currentMob||e,lootReward.rolled,gold,potionDrop,e.elite?`Elite ${e.name}`:e.name);
  state.xp+=e.xp;
  state.kills++;

  notifyQuestKill(e.configKey||e.kind||currentMob?.kind,1);

  if(currentMob){
    currentMob.alive=false;
    currentMob.respawnTimer=getMobRespawnSeconds(currentMob);
    currentMob.aggro=false;
  }

  levelCheck();
  endBattle();

  const hasLoot=lootPileHasLoot(lootPile);
  if(e.boss)toast(`You defeated ${e.name}!${hasLoot?" Sparkling remains hold loot.":""}`);
  else toast(`Defeated ${e.elite?"Elite ":""}${e.name}: +${e.xp} XP, ${hasLoot?"loot in sparkling remains":"no loot"}`);
  updateUI();
}

function loseBattle(){
  state.gold=Math.floor(state.gold*(1-DEATH_GOLD_LOSS));
  state.hp=state.maxHp;
  state.x=START_X;
  state.y=START_Y;
  lastSafePos={x:state.x,y:state.y};
  endBattle();
  toast("You wake up back at the zone start.");
  updateUI();
}

function levelCheck(){
  const cap=playerLevelCap();
  const hpGain=Math.floor(numberOr(BALANCE.progression?.hpPerLevel,8));
  const atkGain=Math.floor(numberOr(BALANCE.progression?.attackPerLevel,2));
  const defGain=Math.floor(numberOr(BALANCE.progression?.defensePerLevel,1));
  if(state.level>=cap){
    state.level=cap;
    state.xp=0;
    state.xpNext=0;
    return;
  }
  if(!Number.isFinite(state.xpNext)||state.xpNext<=0) state.xpNext=xpRequiredForLevel(state.level);
  while(state.level<cap && state.xpNext>0 && state.xp>=state.xpNext){
    state.xp-=state.xpNext;
    state.level++;
    state.maxHp+=hpGain;state.hp=state.maxHp;
    state.atk+=atkGain;state.def+=defGain;
    state.xpNext=xpRequiredForLevel(state.level);
    refreshAliveMobStatsForPlayer();
    playAudioEvent("levelUp",{bus:"ui",volume:1});
    setTimeout(()=>toast(`Level up! Level ${state.level}`),650);
  }
  if(state.level>=cap){
    state.xp=0;
    state.xpNext=0;
  }
}

function endBattle(){
  enemy=null;
  currentMob=null;
  defending=false;
  battleLocked=false;
  showEnemyIntent(false);
  document.getElementById("heroBattleSprite").classList.remove("guardGlow","lunge","hit");
  document.getElementById("enemyBattleSprite").classList.remove("lunge","hit");
  setBattleButtons(true);
  document.getElementById("battle").classList.remove("show");
  updateUI();
}
