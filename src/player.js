function fresh(){
  return {
    x:6*TILE+TILE/2,
    y:7*TILE+TILE/2,
    level:1,xp:0,xpNext:25,
    hp:30,maxHp:30,
    atk:5,def:1,
    gold:8,potions:2,kills:0,
    slimeKills:0,questComplete:false,bossDefeated:false
  };
}

function reset(){
  state=fresh();
  lastSafePos={x:state.x,y:state.y};
  enemy=null;
  currentMob=null;
  defending=false;
  battleLocked=false;
  combatTarget=null;
  playerAttackTimer=0;
  enemyAttackTimer=0;
  playerAttackAnim=0;
  enemyAttackAnim=0;
  combatFx=[];
  attackButtonCooldown=0;
  input={up:false,down:false,left:false,right:false};
  spawnMobs();
  closeAll();
  toast("Tap a mob or use ATTACK to engage.");
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
  c.save();
  c.imageSmoothingEnabled = false;

  const rowMap = { down: 0, left: 1, right: 2, up: 3 };
  const row = rowMap[facing] ?? 0;
  const col = moving ? [0,1,2,3][Math.floor(animT * 8) % 4] : 0;
  const bob = moving ? Math.abs(Math.sin(animT * 8)) * 1.2 : 0;

  c.fillStyle = "rgba(0,0,0,.20)";
  c.beginPath();
  c.ellipse(x, y + 11, 5.5 + (moving ? 0.6 : 0), 2.4, 0, 0, Math.PI * 2);
  c.fill();

  if(playerSheet.naturalWidth && playerSheet.naturalHeight){
    const frameW = Math.floor(playerSheet.naturalWidth / 4);
    const frameH = Math.floor(playerSheet.naturalHeight / 4);
    const sx = col * frameW;
    const sy = row * frameH;
    const dw = frameW * scale;
    const dh = frameH * scale;
    const dx = Math.round(x - dw / 2);
    const dy = Math.round(y - dh + 17 - bob);
    c.drawImage(playerSheet, sx, sy, frameW, frameH, dx, dy, dw, dh);
  } else {
    // Visible fallback so the game loop never fails silently.
    c.fillStyle = "#c8b28a";
    c.fillRect(Math.round(x - 5), Math.round(y - 16), 10, 16);
    c.fillStyle = "#5e4435";
    c.fillRect(Math.round(x - 4), Math.round(y - 20), 8, 5);
  }

  c.restore();
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
  if(document.getElementById("menu").classList.contains("show")) {
    isHeroMoving=false;
    return;
  }

  const manual=manualInputVector();
  let dx=manual.dx, dy=manual.dy;
  const hasManual=dx!==0||dy!==0;

  // RuneScape-like behavior: after selecting a target, walk into melee range automatically
  // unless the player is manually steering.
  if(!hasManual && combatTarget && combatTarget.alive){
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
    moveHeroVector(dx,dy,HERO_SPEED*dt);
  }else if(combatTarget&&combatTarget.alive){
    heroFacing=vectorFacing(combatTarget.x-state.x,combatTarget.y-state.y,heroFacing);
  }

  townCooldown=Math.max(0,townCooldown-dt);
  castleCooldown=Math.max(0,castleCooldown-dt);
  potionCooldown=Math.max(0,potionCooldown-dt);
  attackButtonCooldown=Math.max(0,attackButtonCooldown-dt);

  const t=tileAtWorld(state.x,state.y);
  if(t===4 && townCooldown<=0){townCooldown=2;townEvent()}
  if(t===5 && castleCooldown<=0){castleCooldown=1.5;castleEvent()}
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
