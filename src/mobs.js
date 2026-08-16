function createMobTemplate(name,kind,configKey,fallback,boss=false){
  const cfg=BALANCE.mobs?.[configKey] || {};
  return {
    name,kind,boss,
    hp:numberOr(cfg.hp,fallback.hp),
    atk:numberOr(cfg.attack,fallback.atk),
    def:numberOr(cfg.defense,fallback.def),
    xp:numberOr(cfg.xp,fallback.xp),
    gold:[numberOr(cfg.goldMin,fallback.gold[0]),numberOr(cfg.goldMax,fallback.gold[1])],
    goldDropChance:percentOr(cfg.goldDropChancePercent,100),
    potionDropChance:percentOr(cfg.potionDropChancePercent,0),
    potionDropAmount:Math.max(0,Math.floor(numberOr(cfg.potionDropAmount,1))),
    attackInterval:numberOr(cfg.attackIntervalSeconds,fallback.attackInterval),
    respawnMin:numberOr(cfg.respawnMinSeconds,18),
    respawnMax:numberOr(cfg.respawnMaxSeconds,28),
    aggressive:booleanOr(cfg.aggressive,fallback.aggressive),
    aggroTriggerRange:numberOr(cfg.aggroTriggerRange,58),
    alertRange:numberOr(cfg.alertRange,82),
    chaseSpeed:numberOr(cfg.chaseSpeed,fallback.chaseSpeed),
    wanderSpeed:numberOr(cfg.wanderSpeed,fallback.wanderSpeed),
    leashDistance:numberOr(cfg.leashDistance,120),
    leashSpeed:numberOr(cfg.leashSpeed,34),
    wanderDelayMin:numberOr(cfg.wanderDelayMinSeconds,1.2),
    wanderDelayMax:numberOr(cfg.wanderDelayMaxSeconds,4.0)
  };
}

const enemyTemplates = [
  createMobTemplate("Slime","slime","slime",{hp:14,atk:4,def:0,xp:8,gold:[2,5],attackInterval:1.45,aggressive:false,chaseSpeed:45,wanderSpeed:20}),
  createMobTemplate("Goblin","goblin","goblin",{hp:20,atk:6,def:1,xp:13,gold:[4,8],attackInterval:1.45,aggressive:true,chaseSpeed:58,wanderSpeed:20}),
  createMobTemplate("Wolf","wolf","wolf",{hp:18,atk:7,def:1,xp:14,gold:[3,7],attackInterval:1.33,aggressive:true,chaseSpeed:72,wanderSpeed:30}),
  createMobTemplate("Cow","cow","cow",{hp:12,atk:1,def:0,xp:4,gold:[0,0],attackInterval:1.8,aggressive:false,chaseSpeed:28,wanderSpeed:12}),
  createMobTemplate("Pig","pig","pig",{hp:8,atk:1,def:0,xp:3,gold:[0,0],attackInterval:1.8,aggressive:false,chaseSpeed:30,wanderSpeed:14}),
  createMobTemplate("Chicken","chicken","chicken",{hp:4,atk:1,def:0,xp:2,gold:[0,0],attackInterval:1.7,aggressive:false,chaseSpeed:34,wanderSpeed:18})
];
const bossTemplate = createMobTemplate("Snickers","boss","snickers",{hp:110,atk:12,def:4,xp:95,gold:[35,55],attackInterval:1.55,aggressive:true,chaseSpeed:52,wanderSpeed:0},true);

function mobScaledStats(template){
  const levelBoost=Math.max(0,state.level-1);
  const hpPerLevel=numberOr(BALANCE.progression?.mobHpPerPlayerLevel,2);
  const atkPerLevel=numberOr(BALANCE.progression?.mobAttackPerPlayerLevel,.55);
  return {
    maxHp:template.hp+levelBoost*hpPerLevel,
    atk:template.atk+Math.floor(levelBoost*atkPerLevel),
    def:template.def
  };
}

function restoreMobStats(mob){
  const stats=mobScaledStats(mob.template);
  mob.maxHp=stats.maxHp;
  mob.hp=stats.maxHp;
  mob.atk=stats.atk;
  mob.def=stats.def;
  mob.attackAnim=0;
}

function spawnMobs(){
  mobs=[];
  nextMobId=1;
  bossMob=null;

  const spawnDefs = [
    // Slime habitat — north-central marsh/clearing.
    ["slime",18,5],["slime",21,4],["slime",24,6],["slime",19,8],["slime",22,9],["slime",26,5],
    // Goblin camp — concentrated in the fortified northeast clearing.
    ["goblin",34,6],["goblin",37,5],["goblin",39,8],["goblin",35,9],["goblin",40,6],
    // Wolves roam the broad wilderness instead of spawning in town/camps.
    ["wolf",15,17],["wolf",21,16],["wolf",27,19],["wolf",32,23],["wolf",18,26],["wolf",25,27],["wolf",33,18],["wolf",39,21],
    // Passive starter-farm animals.
    ["cow",4,20],["cow",8,22],
    ["pig",6,21],["pig",9,20],
    ["chicken",5,23],["chicken",7,19],["chicken",9,23]
  ];

  for(const [kind,tx,ty] of spawnDefs){
    const template=enemyTemplates.find(e=>e.kind===kind);
    if(!template) continue;
    if(!tile[world[ty][tx]].walk) continue;
    const mob={
      id:nextMobId++,
      kind,
      template,
      x:tx*TILE+TILE/2,
      y:ty*TILE+TILE/2,
      homeX:tx*TILE+TILE/2,
      homeY:ty*TILE+TILE/2,
      vx:0,vy:0,
      drawVx:0,drawVy:0,
      facing:"down",
      facingCandidate:"down",
      facingCandidateTime:0,
      animTime:Math.random()*10,
      moveTimer:Math.random()*2,
      alive:true,
      respawnTimer:0,
      aggro:false,
      boss:false
    };
    restoreMobStats(mob);
    mobs.push(mob);
  }

  const boss={
    id:nextMobId++,
    kind:"boss",
    template:bossTemplate,
    x:2326,
    y:1750,
    homeX:2326,
    homeY:1750,
    vx:0,vy:0,
    drawVx:0,drawVy:0,
    facing:"down",
    facingCandidate:"down",
    facingCandidateTime:0,
    animTime:0,
    moveTimer:999999,
    alive:true,
    respawnTimer:0,
    aggro:false,
    boss:true
  };
  restoreMobStats(boss);
  mobs.push(boss);
  bossMob=boss;
}

function stableMobFacing(mob,vx,vy,dt){
  const ax=Math.abs(vx), ay=Math.abs(vy);
  if(ax<1 && ay<1) return mob.facing||"down";

  // Axis hysteresis: when movement is close to diagonal, prefer the current
  // visual axis instead of flipping left/right/up/down every frame.
  let candidate;
  const current=mob.facing||"down";
  if((current==="left"||current==="right") && ax>=ay*0.72){
    candidate=vx>=0?"right":"left";
  }else if((current==="up"||current==="down") && ay>=ax*0.72){
    candidate=vy>=0?"down":"up";
  }else{
    candidate=vectorFacing(vx,vy,current);
  }

  if(candidate===current){
    mob.facingCandidate=candidate;
    mob.facingCandidateTime=0;
    return current;
  }
  if(mob.facingCandidate!==candidate){
    mob.facingCandidate=candidate;
    mob.facingCandidateTime=0;
  }
  mob.facingCandidateTime=(mob.facingCandidateTime||0)+dt;
  if(mob.facingCandidateTime>=0.14){
    mob.facing=candidate;
    mob.facingCandidateTime=0;
  }
  return mob.facing||current;
}

function drawSheetSprite(c, sheet, ready, x, y, scale=1, facing="down", animT=0, moving=true, rowMap=null, fallbackKind="", attacking=false){
  c.save();
  c.imageSmoothingEnabled = false;

  const resolvedMap = rowMap || { down: 0, left: 1, right: 2, up: 3 };
  const row = resolvedMap[facing] ?? 0;
  // Column 4 is the action/attack frame. Keep it out of the normal walking
  // cycle so idle mobs do not flash aggressive poses every half-second.
  const walkCycle=[0,1,2,1];
  const col = attacking ? 3 : (moving ? walkCycle[Math.floor(animT * 7) % walkCycle.length] : 0);
  const bob = moving && !attacking ? Math.abs(Math.sin(animT * 7)) * 1.0 : 0;

  c.fillStyle = "rgba(0,0,0,.18)";
  c.beginPath();
  c.ellipse(x, y + 12, 9 * scale / 0.23, 3.2 * scale / 0.23, 0, 0, Math.PI * 2);
  c.fill();

  if(ready && sheet.naturalWidth && sheet.naturalHeight){
    const frameW = Math.floor(sheet.naturalWidth / 4);
    const frameH = Math.floor(sheet.naturalHeight / 4);
    const sx = col * frameW;
    const sy = row * frameH;
    const dw = frameW * scale;
    const dh = frameH * scale;
    const dx = Math.round(x - dw / 2);
    const dy = Math.round(y - dh + 18 - bob);
    c.drawImage(sheet, sx, sy, frameW, frameH, dx, dy, dw, dh);
  } else {
    if(fallbackKind === "slime") drawSlime(c,x,y,scale * 2.2);
    else if(fallbackKind === "wolf") drawWolf(c,x,y,scale * 2.0);
    else if(fallbackKind === "goblin") drawGoblin(c,x,y,scale * 2.0);
  }

  c.restore();
}

function drawSlimeSprite(c,x,y,scale=1,facing="down",animT=0,moving=true,attacking=false){
  drawSheetSprite(
    c,
    slimeSheet,
    slimeSheetReady,
    x,
    y,
    scale,
    facing,
    animT,
    moving,
    { down: 0, left: 1, right: 2, up: 3 },
    "slime",
    attacking
  );
}

function drawWolfSprite(c,x,y,scale=1,facing="down",animT=0,moving=true,attacking=false){
  drawSheetSprite(
    c,
    wolfSheet,
    wolfSheetReady,
    x,
    y,
    scale,
    facing,
    animT,
    moving,
    { down: 0, right: 1, left: 2, up: 3 },
    "wolf",
    attacking
  );
}

function drawGoblinSprite(c,x,y,scale=1,facing="down",animT=0,moving=true,attacking=false){
  drawSheetSprite(
    c,
    goblinSheet,
    goblinSheetReady,
    x,
    y,
    scale,
    facing,
    animT,
    moving,
    { down: 0, right: 1, left: 2, up: 3 },
    "goblin",
    attacking
  );
}

function drawBearSprite(c,x,y,scale=1,facing="down",animT=0,moving=true,attacking=false){
  drawSheetSprite(
    c,
    bearSheet,
    bearSheetReady,
    x,
    y,
    scale,
    facing,
    animT,
    moving,
    { down: 0, right: 1, left: 2, up: 3 },
    "boss",
    attacking
  );
}

function drawSlime(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s);
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0,16,13,3.5,0,0,Math.PI*2); c.fill();
  const px=(color,rx,ry,rw=1,rh=1)=>{ c.fillStyle=color; c.fillRect(rx,ry,rw,rh); };
  px("#3f8f48",-10,-4,20,11);
  px("#6fd879",-7,-7,14,4);
  px("#88e992",-4,-9,8,2);
  px("#ffffff",-4,-1,3,3); px("#ffffff",1,-1,3,3);
  px("#182518",-3,0,1,2); px("#182518",2,0,1,2);
  px("#2f5e34",-2,5,4,1);
  c.restore();
}
function drawGoblin(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s);
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0,16,13,3.5,0,0,Math.PI*2); c.fill();
  const px=(color,rx,ry,rw=1,rh=1)=>{ c.fillStyle=color; c.fillRect(rx,ry,rw,rh); };
  px("#85bf56",-6,-10,12,8); px("#85bf56",-9,-8,3,3); px("#85bf56",6,-8,3,3);
  px("#26301d",-4,-6,2,2); px("#26301d",2,-6,2,2);
  px("#7b5d40",-8,-1,16,8); px("#a7d274",-5,-3,10,2);
  px("#654223",-7,6,14,2);
  px("#85bf56",-7,8,3,5); px("#85bf56",4,8,3,5);
  c.restore();
}
function drawWolf(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s);
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0,16,13,3.5,0,0,Math.PI*2); c.fill();
  const px=(color,rx,ry,rw=1,rh=1)=>{ c.fillStyle=color; c.fillRect(rx,ry,rw,rh); };
  px("#8b95a2",-11,0,14,7);
  px("#b2bac6",-8,-4,9,4);
  px("#7e8793",2,-5,7,6); px("#7e8793",5,-8,2,3); px("#7e8793",8,-8,2,3);
  px("#e8edf4",5,0,6,4);
  px("#21252a",5,-2,1,1); px("#21252a",8,-2,1,1); px("#21252a",10,1,1,1);
  px("#8b95a2",-13,0,2,2); px("#8b95a2",-6,7,3,5); px("#8b95a2",1,7,3,5);
  c.restore();
}
function drawBoss(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s);
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0,18,16,4,0,0,Math.PI*2); c.fill();
  const px=(color,rx,ry,rw=1,rh=1)=>{ c.fillStyle=color; c.fillRect(rx,ry,rw,rh); };
  px("#9da4ae",-8,-9,16,10);
  px("#b4bbc5",-10,1,20,12);
  px("#7c8189",-12,1,3,10); px("#7c8189",9,1,3,10);
  px("#f0be47",-8,-14,16,3); px("#f0be47",-6,-19,3,6); px("#f0be47",-1,-21,3,8); px("#f0be47",4,-19,3,6);
  px("#23262c",-4,-5,2,2); px("#23262c",2,-5,2,2);
  px("#6f747c",-3,-1,6,1);
  px("#7c8189",-6,13,4,4); px("#7c8189",2,13,4,4);
  c.restore();
}



function drawSlime(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s);
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0,16,13,3.5,0,0,Math.PI*2); c.fill();
  const px=(color,rx,ry,rw=1,rh=1)=>{ c.fillStyle=color; c.fillRect(rx,ry,rw,rh); };
  px("#3f8f48",-10,-4,20,11);
  px("#6fd879",-7,-7,14,4);
  px("#88e992",-4,-9,8,2);
  px("#ffffff",-4,-1,3,3); px("#ffffff",1,-1,3,3);
  px("#182518",-3,0,1,2); px("#182518",2,0,1,2);
  px("#2f5e34",-2,5,4,1);
  c.restore();
}
function drawGoblin(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s);
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0,16,13,3.5,0,0,Math.PI*2); c.fill();
  const px=(color,rx,ry,rw=1,rh=1)=>{ c.fillStyle=color; c.fillRect(rx,ry,rw,rh); };
  px("#85bf56",-6,-10,12,8); px("#85bf56",-9,-8,3,3); px("#85bf56",6,-8,3,3);
  px("#26301d",-4,-6,2,2); px("#26301d",2,-6,2,2);
  px("#7b5d40",-8,-1,16,8); px("#a7d274",-5,-3,10,2);
  px("#654223",-7,6,14,2);
  px("#85bf56",-7,8,3,5); px("#85bf56",4,8,3,5);
  c.restore();
}
function drawWolf(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s);
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0,16,13,3.5,0,0,Math.PI*2); c.fill();
  const px=(color,rx,ry,rw=1,rh=1)=>{ c.fillStyle=color; c.fillRect(rx,ry,rw,rh); };
  px("#8b95a2",-11,0,14,7);
  px("#b2bac6",-8,-4,9,4);
  px("#7e8793",2,-5,7,6); px("#7e8793",5,-8,2,3); px("#7e8793",8,-8,2,3);
  px("#e8edf4",5,0,6,4);
  px("#21252a",5,-2,1,1); px("#21252a",8,-2,1,1); px("#21252a",10,1,1,1);
  px("#8b95a2",-13,0,2,2); px("#8b95a2",-6,7,3,5); px("#8b95a2",1,7,3,5);
  c.restore();
}
function drawBoss(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s);
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath(); c.ellipse(0,18,16,4,0,0,Math.PI*2); c.fill();
  const px=(color,rx,ry,rw=1,rh=1)=>{ c.fillStyle=color; c.fillRect(rx,ry,rw,rh); };
  px("#9da4ae",-8,-9,16,10);
  px("#b4bbc5",-10,1,20,12);
  px("#7c8189",-12,1,3,10); px("#7c8189",9,1,3,10);
  px("#f0be47",-8,-14,16,3); px("#f0be47",-6,-19,3,6); px("#f0be47",-1,-21,3,8); px("#f0be47",4,-19,3,6);
  px("#23262c",-4,-5,2,2); px("#23262c",2,-5,2,2);
  px("#6f747c",-3,-1,6,1);
  px("#7c8189",-6,13,4,4); px("#7c8189",2,13,4,4);
  c.restore();
}

function drawCow(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s); c.imageSmoothingEnabled=false;
  const px=(col,rx,ry,rw=1,rh=1)=>{c.fillStyle=col;c.fillRect(rx,ry,rw,rh)};
  px("#f3eee3",-11,-5,18,12); px("#f3eee3",5,-8,9,9);
  px("#322b28",-8,-5,6,5); px("#322b28",1,0,6,5); px("#322b28",8,-6,4,4);
  px("#d9c8b5",10,-2,6,5); px("#2c2624",13,0,1,1);
  px("#5e4939",-8,7,3,7); px("#5e4939",3,7,3,7); px("#5e4939",9,5,3,7);
  px("#c8b19c",-13,-2,2,8); px("#c8b19c",-15,4,3,2);
  c.restore();
}
function drawPig(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s); c.imageSmoothingEnabled=false;
  const px=(col,rx,ry,rw=1,rh=1)=>{c.fillStyle=col;c.fillRect(rx,ry,rw,rh)};
  px("#e8929d",-10,-4,16,10); px("#f1a8ae",4,-6,9,8);
  px("#c96e7c",9,-2,6,5); px("#492f32",11,-1,1,1); px("#492f32",14,-1,1,1);
  px("#d27b88",-7,6,3,6); px("#d27b88",2,6,3,6); px("#d27b88",8,3,3,7);
  px("#f1a8ae",5,-9,3,4); px("#f1a8ae",10,-9,3,4);
  c.restore();
}
function drawChicken(c,x,y,s=1){
  c.save(); c.translate(x,y); c.scale(s,s); c.imageSmoothingEnabled=false;
  const px=(col,rx,ry,rw=1,rh=1)=>{c.fillStyle=col;c.fillRect(rx,ry,rw,rh)};
  px("#f3eee5",-5,-5,10,11); px("#ffffff",1,-9,7,8);
  px("#dc5848",4,-11,2,3); px("#dc5848",6,-10,2,2); px("#e3a33f",8,-5,4,2);
  px("#2c2825",5,-7,1,1); px("#d6923b",-2,6,2,5); px("#d6923b",3,6,2,5);
  c.restore();
}

function mobVisualScale(mob){
  if(!mob) return 1;
  if(mob.boss || mob.kind==="boss") return MOB_TYPE_SCALE.snickers;
  if(Object.prototype.hasOwnProperty.call(MOB_TYPE_SCALE,mob.kind)) return MOB_TYPE_SCALE[mob.kind];
  if(["cow","pig","chicken"].includes(mob.kind)) return VISUAL_SCALE.passiveMobs;
  return VISUAL_SCALE.hostileMobs;
}

function drawMob(c,mob,sx,sy){
  const scale=mobVisualScale(mob);
  const moving=Math.hypot(mob.drawVx||0,mob.drawVy||0)>4;
  const attacking=(mob.attackAnim||0)>0;
  if(mob.kind==="slime") {
    drawSlimeSprite(c,sx,sy,0.23*scale,mob.facing||"down",mob.animTime||0,moving,attacking);
  } else if(mob.kind==="goblin") {
    drawGoblinSprite(c,sx,sy,0.23*scale,mob.facing||"down",mob.animTime||0,moving,attacking);
  } else if(mob.kind==="wolf") {
    drawWolfSprite(c,sx,sy,0.23*scale,mob.facing||"down",mob.animTime||0,moving,attacking);
  } else if(mob.kind==="cow") {
    drawCow(c,sx,sy,1.0*scale);
  } else if(mob.kind==="pig") {
    drawPig(c,sx,sy,1.0*scale);
  } else if(mob.kind==="chicken") {
    drawChicken(c,sx,sy,1.0*scale);
  } else if(mob.kind==="boss") {
    drawBearSprite(c,sx,sy,0.145*scale,mob.facing||"down",mob.animTime||0,moving,attacking);
  }
}

function drawBattleSprites(){
  heroCtx.clearRect(0,0,heroCanvas.width,heroCanvas.height);
  enemyCtx.clearRect(0,0,enemyCanvas.width,enemyCanvas.height);
  drawHero(heroCtx,24,36,0.15,false,0,"down");
  if(!enemy)return;
  if(enemy.kind==="slime") drawSlimeSprite(enemyCtx,36,39,0.68,"down",performance.now()/1000,false,enemyAttackAnim>0);
  else if(enemy.kind==="goblin") drawGoblinSprite(enemyCtx,36,39,0.68,"down",performance.now()/1000,false,enemyAttackAnim>0);
  else if(enemy.kind==="wolf") drawWolfSprite(enemyCtx,36,39,0.68,"down",performance.now()/1000,false,enemyAttackAnim>0);
  else if(enemy.kind==="cow") drawCow(enemyCtx,36,40,1.55);
  else if(enemy.kind==="pig") drawPig(enemyCtx,36,40,1.65);
  else if(enemy.kind==="chicken") drawChicken(enemyCtx,36,40,1.8);
  else if(enemy.kind==="boss") drawBearSprite(enemyCtx,36,56,0.13,"down",performance.now()/1000,false,enemyAttackAnim>0);
  else drawBoss(enemyCtx,36,38,.95);
}

function updateMobs(dt){
  for(const mob of mobs){
    if(!mob.alive){
      if(mob.boss) continue;
      mob.respawnTimer-=dt;
      if(mob.respawnTimer<=0){
        mob.alive=true;
        mob.x=mob.homeX; mob.y=mob.homeY;
        mob.vx=0; mob.vy=0; mob.drawVx=0; mob.drawVy=0;
        mob.facing="down"; mob.facingCandidate="down"; mob.facingCandidateTime=0; mob.aggro=false;
        restoreMobStats(mob);
      }
      continue;
    }

    mob.attackAnim=Math.max(0,(mob.attackAnim||0)-dt);
    const d=dist(state.x,state.y,mob.x,mob.y);
    const isTarget=mob===combatTarget;

    // Aggression and movement are data-driven so routine mob tuning only
    // requires editing config/game-balance.js.
    if(!combatTarget && mob.template.aggressive && d<mob.template.aggroTriggerRange){
      engageMob(mob,true);
    }

    mob.aggro=isTarget || (!combatTarget && mob.template.aggressive && d<mob.template.alertRange);

    let vx=0,vy=0;
    if(isTarget){
      const desired=ATTACK_RANGE-8;
      if(d>desired){
        const dx=state.x-mob.x, dy=state.y-mob.y;
        const len=Math.max(.001,Math.hypot(dx,dy));
        const speed=mob.template.chaseSpeed;
        vx=dx/len*speed; vy=dy/len*speed;
      }
    }else if(mob.boss){
      vx=0; vy=0;
    }else{
      mob.moveTimer-=dt;
      if(mob.moveTimer<=0){
        const minDelay=Math.min(mob.template.wanderDelayMin,mob.template.wanderDelayMax);
        const maxDelay=Math.max(mob.template.wanderDelayMin,mob.template.wanderDelayMax);
        mob.moveTimer=minDelay+Math.random()*(maxDelay-minDelay);
        const ang=Math.random()*Math.PI*2;
        mob.vx=Math.cos(ang)*mob.template.wanderSpeed; mob.vy=Math.sin(ang)*mob.template.wanderSpeed;
      }
      vx=mob.vx; vy=mob.vy;
      const homeDist=dist(mob.x,mob.y,mob.homeX,mob.homeY);
      if(homeDist>mob.template.leashDistance){
        const dx=mob.homeX-mob.x, dy=mob.homeY-mob.y;
        const len=Math.max(.001,Math.hypot(dx,dy));
        vx=dx/len*mob.template.leashSpeed; vy=dy/len*mob.template.leashSpeed;
      }
    }

    mob.drawVx=vx; mob.drawVy=vy;
    if(Math.hypot(vx,vy)>1){
      stableMobFacing(mob,vx,vy,dt);
      mob.animTime=(mob.animTime||0)+dt;
    }else if(isTarget){
      stableMobFacing(mob,state.x-mob.x,state.y-mob.y,dt);
    }else{
      mob.facingCandidateTime=0;
    }

    const nx=mob.x+vx*dt, ny=mob.y+vy*dt;
    let blocked=false;
    if(canStand(nx,mob.y,10)) mob.x=nx; else blocked=true;
    if(canStand(mob.x,ny,10)) mob.y=ny; else blocked=true;
    if(blocked && !isTarget && !mob.boss){
      // Do not bounce the stored wander vector back and forth against a wall.
      // Stop briefly and choose a fresh direction on the next wander decision.
      mob.vx=0; mob.vy=0; mob.moveTimer=0;
    }

    if(!mob.boss && tileAtWorld(mob.x,mob.y)===4){
      mob.x=mob.homeX; mob.y=mob.homeY;
    }
  }
}

function findNearestMob(maxDistance=Infinity){
  let best=null,bestD=maxDistance;
  for(const mob of mobs){
    if(!mob.alive) continue;
    const d=dist(state.x,state.y,mob.x,mob.y);
    if(d<bestD){best=mob;bestD=d}
  }
  return best;
}
