function fresh(characterOverride=null){
  const zoneId=String(window.LR_ACTIVE_PROJECT?.zone?.id||window.LR_BUILDER_PROJECT?.zone?.id||window.LR_ACTIVE_PROJECT?.manifest?.defaultZone||"");
  if(!zoneId)throw new Error("Little Realm has no active project zone");
  return {
    x:START_X,
    y:START_Y,
    level:1,xp:0,xpNext:xpRequiredForLevel(1),
    hp:numberOr(BALANCE.player?.maxHp,30),maxHp:numberOr(BALANCE.player?.maxHp,30),
    atk:numberOr(BALANCE.player?.attack,5),def:numberOr(BALANCE.player?.defense,1),
    gold:numberOr(BALANCE.player?.startingGold,8),potions:numberOr(BALANCE.player?.startingPotions,2),kills:0,
    quests:{},
    zoneId,
    worldObjectStates:{},
    inventory:createEmptyInventory(),
    equipment:createStarterEquipment(),
    character:normalizeCharacterProfile(characterOverride||freshCharacterProfile())
  };
}

function reset({character=null,silent=false}={}){
  state=fresh(character);
  lastSafePos={x:state.x,y:state.y};
  enemy=null;
  currentMob=null;
  defending=false;
  battleLocked=false;
  combatTarget=null;
  selectedTarget=null;
  playerAttackTimer=0;
  enemyAttackTimer=0;
  playerAttackAnim=0;
  enemyAttackAnim=0;
  combatFx=[];
  attackButtonCooldown=0;
  input={up:false,down:false,left:false,right:false};
  spawnMobs();
  clearLootPiles();
  closeAll();
  if(!silent) toast("Click/tap a mob to target it, then press ATTACK.");
  resetFootstepTracking?.();
  applyZoneAudioFromCurrentSettings?.();
  updateUI();
}

function resize(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  game.width=Math.round(innerWidth*dpr);
  game.height=Math.round(innerHeight*dpr);
  game.style.width=innerWidth+"px";
  game.style.height=innerHeight+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

function drawHero(c,x,y,scale=1,moving=false,animT=0,facing="down"){
  drawPlayerCharacter(c,x,y,scale,moving,animT,facing,currentCharacterProfile());
}

function vectorFacing(vx,vy,fallBack="down"){
  if(Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) return fallBack;
  if(Math.abs(vx) > Math.abs(vy)) return vx > 0 ? "right" : "left";
  return vy > 0 ? "down" : "up";
}

function manualInputVector(){
  return {
    dx:(input.right?1:0)-(input.left?1:0),
    dy:(input.down?1:0)-(input.up?1:0)
  };
}

function moveHeroVector(dx,dy,amount){
  if(dx===0&&dy===0) return false;
  const len=Math.max(.001,Math.hypot(dx,dy));
  dx/=len; dy/=len;
  const nx=state.x+dx*amount;
  const ny=state.y+dy*amount;
  let moved=false;
  if(canStand(nx,state.y)){state.x=nx;moved=true}
  if(canStand(state.x,ny)){state.y=ny;moved=true}
  if(moved) lastSafePos={x:state.x,y:state.y};
  return moved;
}

function updateMovement(dt){
  if(isGameplayModalOpen()) {
    isHeroMoving=false;
    return;
  }

  const cameraLocksPlayer=developerCameraLocksPlayerMovement();
  const manual=cameraLocksPlayer?{dx:0,dy:0}:manualInputVector();
  let dx=manual.dx, dy=manual.dy;
  const hasManual=dx!==0||dy!==0;

  // RuneScape-like behavior: after selecting a target, walk into melee range automatically
  // unless the player is manually steering. Builder Free/World camera deliberately freezes the player.
  if(!cameraLocksPlayer && !hasManual && combatTarget && combatTarget.alive){
    const d=dist(state.x,state.y,combatTarget.x,combatTarget.y);
    if(d>ATTACK_RANGE-4 && d<AUTO_CHASE_RANGE){
      dx=combatTarget.x-state.x;
      dy=combatTarget.y-state.y;
    }
  }

  isHeroMoving=(dx!==0||dy!==0);
  if(isHeroMoving){
    if(Math.abs(dx)>Math.abs(dy)) heroFacing=dx>0?"right":"left";
    else heroFacing=dy>0?"down":"up";
    moveHeroVector(dx,dy,HERO_SPEED*terrainMovementMultiplier(tileAtWorld(state.x,state.y))*dt);
  }else if(combatTarget&&combatTarget.alive){
    heroFacing=vectorFacing(combatTarget.x-state.x,combatTarget.y-state.y,heroFacing);
  }

  terrainEffectCooldown=Math.max(0,terrainEffectCooldown-dt);
  potionCooldown=Math.max(0,potionCooldown-dt);
  attackButtonCooldown=Math.max(0,attackButtonCooldown-dt);

  updateQuestVisits();

  const t=tileAtWorld(state.x,state.y);
  if(terrainIsHealing(t) && terrainEffectCooldown<=0){terrainEffectCooldown=2;healingTerrainEvent(t)}
}

function setInput(dir,value){
  input[dir]=value;
}

function bindHold(id,dir){
  const el=document.getElementById(id);

  const begin=(ev)=>{
    ev.preventDefault();
    try{el.setPointerCapture(ev.pointerId)}catch(e){}
    setInput(dir,true);
  };

  const end=(ev)=>{
    ev.preventDefault();
    setInput(dir,false);
  };

  el.addEventListener("pointerdown",begin);
  el.addEventListener("pointerup",end);
  el.addEventListener("pointercancel",end);
  el.addEventListener("lostpointercapture",end);
}
