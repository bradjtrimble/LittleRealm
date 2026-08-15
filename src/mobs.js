const enemyTemplates = [
  {name:"Slime",kind:"slime",hp:14,atk:4,def:0,xp:8,gold:[2,5]},
  {name:"Goblin",kind:"goblin",hp:20,atk:6,def:1,xp:13,gold:[4,8]},
  {name:"Wolf",kind:"wolf",hp:18,atk:7,def:1,xp:14,gold:[3,7]}
];
const bossTemplate = {name:"Stone King",kind:"boss",hp:50,atk:10,def:3,xp:45,gold:[20,30],boss:true};

function mobScaledStats(template){
  const levelBoost=Math.max(0,state.level-1);
  return {
    maxHp:template.hp+levelBoost*2,
    atk:template.atk+Math.floor(levelBoost*.55),
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
    ["slime",10,8],["slime",8,11],["slime",11,12],["slime",17,8],
    ["slime",18,13],["slime",9,5],["slime",20,7],
    ["goblin",17,4],["goblin",19,11],["goblin",11,15],["goblin",23,12],
    ["wolf",5,14],["wolf",8,16],["wolf",20,5],["wolf",16,14]
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
}

function drawSheetSprite(c, sheet, ready, x, y, scale=1, facing="down", animT=0, moving=true, rowMap=null, fallbackKind=""){
  c.save();
  c.imageSmoothingEnabled = false;

  const resolvedMap = rowMap || { down: 0, left: 1, right: 2, up: 3 };
  const row = resolvedMap[facing] ?? 0;
  const col = moving ? Math.floor(animT * 8) % 4 : 0;
  const bob = moving ? Math.abs(Math.sin(animT * 8)) * 1.4 : 0;

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

function drawSlimeSprite(c,x,y,scale=1,facing="down",animT=0,moving=true){
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
    "slime"
  );
}

function drawWolfSprite(c,x,y,scale=1,facing="down",animT=0,moving=true){
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
    "wolf"
  );
}

function drawGoblinSprite(c,x,y,scale=1,facing="down",animT=0,moving=true){
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
    "goblin"
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

function drawMob(c,mob,sx,sy){
  if(mob.kind==="slime") {
    drawSlimeSprite(c,sx,sy,0.23,mob.facing||"down",mob.animTime||0,true);
  } else if(mob.kind==="goblin") {
    drawGoblinSprite(c,sx,sy,0.23,mob.facing||"down",mob.animTime||0,true);
  } else if(mob.kind==="wolf") {
    drawWolfSprite(c,sx,sy,0.23,mob.facing||"down",mob.animTime||0,true);
  } else if(mob.kind==="boss") {
    drawBoss(c,sx,sy,1.15);
  }
}

function drawBattleSprites(){
  heroCtx.clearRect(0,0,heroCanvas.width,heroCanvas.height);
  enemyCtx.clearRect(0,0,enemyCanvas.width,enemyCanvas.height);
  drawHero(heroCtx,24,36,0.15,false,0,"down");
  if(!enemy)return;
  if(enemy.kind==="slime") drawSlimeSprite(enemyCtx,36,39,0.68,"down",performance.now()/1000,true);
  else if(enemy.kind==="goblin") drawGoblinSprite(enemyCtx,36,39,0.68,"down",performance.now()/1000,true);
  else if(enemy.kind==="wolf") drawWolfSprite(enemyCtx,36,39,0.68,"down",performance.now()/1000,true);
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
        mob.facing="down"; mob.aggro=false;
        restoreMobStats(mob);
      }
      continue;
    }

    mob.attackAnim=Math.max(0,(mob.attackAnim||0)-dt);
    const d=dist(state.x,state.y,mob.x,mob.y);
    const isTarget=mob===combatTarget;

    // Goblins and wolves are aggressive at close range. Slimes wait to be selected.
    if(!combatTarget && !mob.boss && (mob.kind==="goblin"||mob.kind==="wolf") && d<58){
      engageMob(mob,true);
    }

    mob.aggro=isTarget || (!combatTarget && (mob.kind==="goblin"||mob.kind==="wolf") && d<82);

    let vx=0,vy=0;
    if(isTarget){
      const desired=ATTACK_RANGE-8;
      if(d>desired){
        const dx=state.x-mob.x, dy=state.y-mob.y;
        const len=Math.max(.001,Math.hypot(dx,dy));
        const speed=mob.kind==="wolf"?72:mob.kind==="goblin"?58:mob.kind==="boss"?48:45;
        vx=dx/len*speed; vy=dy/len*speed;
      }
    }else if(mob.boss){
      vx=0; vy=0;
    }else{
      mob.moveTimer-=dt;
      if(mob.moveTimer<=0){
        mob.moveTimer=1.2+Math.random()*2.8;
        const ang=Math.random()*Math.PI*2;
        const speed=mob.kind==="wolf"?30:20;
        mob.vx=Math.cos(ang)*speed; mob.vy=Math.sin(ang)*speed;
      }
      vx=mob.vx; vy=mob.vy;
      const homeDist=dist(mob.x,mob.y,mob.homeX,mob.homeY);
      if(homeDist>120){
        const dx=mob.homeX-mob.x, dy=mob.homeY-mob.y;
        const len=Math.max(.001,Math.hypot(dx,dy));
        vx=dx/len*34; vy=dy/len*34;
      }
    }

    mob.drawVx=vx; mob.drawVy=vy;
    if(Math.hypot(vx,vy)>1){
      mob.facing=vectorFacing(vx,vy,mob.facing||"down");
      mob.animTime=(mob.animTime||0)+dt;
    }else if(isTarget){
      mob.facing=vectorFacing(state.x-mob.x,state.y-mob.y,mob.facing||"down");
    }

    const nx=mob.x+vx*dt, ny=mob.y+vy*dt;
    if(canStand(nx,mob.y,10)) mob.x=nx; else mob.vx*=-1;
    if(canStand(mob.x,ny,10)) mob.y=ny; else mob.vy*=-1;

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
