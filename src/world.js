// 0 grass, 1 water, 2 forest, 3 road, 4 town, 5 castle
const world = Array.from({length:WORLD_H}, () => Array(WORLD_W).fill(0));

function buildWorld(){
  for(let y=0;y<WORLD_H;y++){
    for(let x=0;x<WORLD_W;x++){
      world[y][x]=(x===0||y===0||x===WORLD_W-1||y===WORLD_H-1)?1:0;
    }
  }

  for(let y=2;y<=6;y++) for(let x=12;x<=16;x++) world[y][x]=1;
  for(let y=10;y<=15;y++) world[y][22]=1;
  for(let y=15;y<=17;y++) for(let x=21;x<=25;x++) world[y][x]=1;

  const forestAreas = [
    [3,2,8,6],[18,2,24,6],[3,12,9,17],[14,10,19,15]
  ];
  forestAreas.forEach(([x1,y1,x2,y2])=>{
    for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++){
      if(world[y][x]!==1 && Math.random()<.78) world[y][x]=2;
    }
  });

  for(let x=4;x<=24;x++) world[9][x]=3;
  for(let y=6;y<=9;y++) world[y][6]=3;
  for(let y=9;y<=15;y++) world[y][24]=3;

  for(let y=6;y<=8;y++) for(let x=4;x<=7;x++) world[y][x]=4;
  world[7][6]=3;
  world[8][6]=3;

  world[15][24]=5;
}

const sceneryTrees=[];
const sceneryHouses=[];
const sceneryFences=[];
const scenerySigns=[];
let solidRects=[];
const MOB_SPAWN_TILES = new Set([
  "10,8","8,11","11,12","17,8","18,13","9,5","20,7",
  "17,4","19,11","11,15","23,12","5,14","8,16","20,5","16,14"
]);

function addSolidRect(x,y,w,h,type="solid"){
  solidRects.push({x,y,w,h,type});
}

function buildScenery(){
  sceneryTrees.length=0;
  sceneryHouses.length=0;
  sceneryFences.length=0;
  scenerySigns.length=0;
  solidRects=[];

  // Oakrest: houses sit beside the road rather than occupying every town tile.
  const houses=[
    {type:"A", x:4*TILE-12, y:6*TILE-69},
    {type:"B", x:7*TILE,    y:6*TILE-56},
    {type:"B", x:4*TILE-18, y:8*TILE-67},
    {type:"A", x:7*TILE,    y:8*TILE-76}
  ];

  for(const placement of houses){
    const spec=HOUSE_SPECS[placement.type];
    const obj={...placement,spec};
    sceneryHouses.push(obj);
    const f=spec.footprint;
    addSolidRect(placement.x+f.x,placement.y+f.y,f.w,f.h,"house");
  }

  // Decorative town fencing and signs. These do not alter the proven collision model.
  const fences=[
    {x:3*TILE+8,y:5*TILE+34,dir:"h",len:2},
    {x:8*TILE+8,y:5*TILE+34,dir:"h",len:2},
    {x:3*TILE+8,y:9*TILE+18,dir:"h",len:2},
    {x:8*TILE+8,y:9*TILE+18,dir:"h",len:2},
    {x:3*TILE+8,y:6*TILE+18,dir:"v",len:2},
    {x:10*TILE+10,y:6*TILE+18,dir:"v",len:2}
  ];
  sceneryFences.push(...fences);
  scenerySigns.push(
    {x:5*TILE+13,y:8*TILE+13,text:"Oakrest"},
    {x:23*TILE+10,y:14*TILE+12,text:"Castle"}
  );

  // Real tree objects. Only trunks are solid; canopies are visual.
  const reserved = new Set([
    ...MOB_SPAWN_TILES,
    "4,6","5,6","6,6","7,6","8,6",
    "4,7","5,7","6,7","7,7","8,7",
    "3,8","4,8","5,8","6,8","7,8","8,8",
    "3,9","4,9","5,9","6,9","7,9","8,9"
  ]);

  for(let ty=0;ty<WORLD_H;ty++){
    for(let tx=0;tx<WORLD_W;tx++){
      if(world[ty][tx]!==2) continue;
      if(reserved.has(`${tx},${ty}`)) continue;
      if(worldHash(tx,ty)%100 >= 66) continue;

      const ox=(worldHash(tx+31,ty+11)%15)-7;
      const oy=(worldHash(tx+7,ty+41)%11)-5;
      const obj={x:tx*TILE+ox,y:ty*TILE+oy,variant:worldHash(tx,ty)%6};
      sceneryTrees.push(obj);
      addSolidRect(obj.x+24,obj.y+38,16,19,"tree");
    }
  }
}

const tile = {
  0:{walk:true},
  1:{walk:false},
  2:{walk:true},
  3:{walk:true},
  4:{walk:true},
  5:{walk:true}
};

function tileAtWorld(px,py){
  const tx=Math.floor(px/TILE);
  const ty=Math.floor(py/TILE);
  if(tx<0||ty<0||tx>=WORLD_W||ty>=WORLD_H) return 1;
  return world[ty][tx];
}

function circleIntersectsRect(px,py,radius,rect){
  const nearestX=Math.max(rect.x,Math.min(px,rect.x+rect.w));
  const nearestY=Math.max(rect.y,Math.min(py,rect.y+rect.h));
  const dx=px-nearestX;
  const dy=py-nearestY;
  return dx*dx+dy*dy < radius*radius;
}

function hitsSolidScenery(px,py,radius=HERO_RADIUS){
  return solidRects.some(rect=>circleIntersectsRect(px,py,radius,rect));
}

function canStand(px,py,radius=HERO_RADIUS){
  const points=[
    [px-radius,py-radius],
    [px+radius,py-radius],
    [px-radius,py+radius],
    [px+radius,py+radius],
    [px,py-radius],
    [px,py+radius],
    [px-radius,py],
    [px+radius,py]
  ];
  if(!points.every(([x,y])=>tile[tileAtWorld(x,y)].walk)) return false;
  return !hitsSolidScenery(px,py,radius);
}

function drawAtlasCell(col,row,x,y,w,h){
  if(!environmentAtlasReady) return false;
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(
    environmentAtlas,
    col*ENV_ATLAS_CELL,row*ENV_ATLAS_CELL,ENV_ATLAS_CELL,ENV_ATLAS_CELL,
    Math.round(x),Math.round(y),Math.round(w),Math.round(h)
  );
  return true;
}

function worldHash(x,y){
  return Math.abs((x*928371 + y*364479 + x*y*31) % 10007);
}

function drawContinuousTerrain(kind,x,y,tx=0,ty=0){
  if(!terrainTextureReady) return false;
  ctx.imageSmoothingEnabled=false;
  const baseX=kind==="dirt" ? 256 : 0;
  const sx=baseX + (((tx*TILE)%256)+256)%256;
  const sy=(((ty*TILE)%256)+256)%256;

  // Overlap by one pixel so the 1.35x camera transform never exposes seams.
  ctx.drawImage(
    terrainTexture,
    sx,sy,TILE,TILE,
    Math.floor(x)-1,Math.floor(y)-1,TILE+2,TILE+2
  );
  return true;
}

function drawGrassTile(x,y,variant=0,tx=0,ty=0){
  if(!drawContinuousTerrain("grass",x,y,tx,ty)){
    ctx.fillStyle="#718f45";
    ctx.fillRect(Math.floor(x)-1,Math.floor(y)-1,TILE+2,TILE+2);
  }

  // Sparse decoration only, so the underlying tile grid stays invisible.
  if(environmentAtlasReady){
    const h=worldHash(tx+21,ty+9)%43;
    if(h===0) drawAtlasCell(0,3,x+13,y+TILE-17,18,18);
    else if(h===1) drawAtlasCell(3,3,x+37,y+TILE-15,15,15);
  }
}

function drawForestTile(x,y,variant=0,tx=0,ty=0){
  drawGrassTile(x,y,variant,tx,ty);
}

function drawWaterTile(x,y,variant=0){
  ctx.fillStyle="#68addd";
  ctx.fillRect(Math.floor(x)-1,Math.floor(y)-1,TILE+2,TILE+2);
  ctx.fillStyle="#85c6ed";
  ctx.fillRect(x,y,TILE,4);
  ctx.fillStyle="#4f96c9";
  ctx.fillRect(x,y+TILE-7,TILE,8);
  ctx.strokeStyle="rgba(255,255,255,.18)";
  ctx.beginPath();
  ctx.moveTo(x+9,y+18);ctx.lineTo(x+29,y+18);
  ctx.moveTo(x+35,y+31);ctx.lineTo(x+54,y+31);
  ctx.moveTo(x+15,y+46);ctx.lineTo(x+38,y+46);
  ctx.stroke();
}

function drawRoadTile(x,y,variant=0,tx=0,ty=0){
  if(!drawContinuousTerrain("dirt",x,y,tx,ty)){
    ctx.fillStyle="#a97442";
    ctx.fillRect(Math.floor(x)-1,Math.floor(y)-1,TILE+2,TILE+2);
  }
}

function drawTownTile(x,y,variant=0,tx=0,ty=0){
  drawGrassTile(x,y,variant,tx,ty);
}

function drawCastleGroundTile(x,y,tx=0,ty=0){
  drawRoadTile(x,y,0,tx,ty);
}

function drawTree(x,y,variant=0){
  if(environmentAtlasReady){
    const col=variant%6;
    // Trees intentionally overlap beyond their 64px tile footprint.
    drawAtlasCell(col,1,x-18,y-42,100,108);
    return;
  }
  ctx.fillStyle="#7c4d2a";
  ctx.fillRect(x+27,y+35,10,21);
  ctx.fillStyle="#205433";
  ctx.beginPath();ctx.arc(x+32,y+23,22,0,Math.PI*2);ctx.fill();
}

function drawHouseObject(obj,camX,camY){
  const sx=obj.x-camX;
  const sy=obj.y-camY;
  const spec=obj.spec;

  if(spec.ready()){
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(spec.image,Math.round(sx),Math.round(sy),spec.w,spec.h);
    return;
  }

  // Simple loading fallback.
  ctx.fillStyle="#d8c7a0";
  ctx.fillRect(sx+14,sy+38,spec.w-28,spec.h-45);
  ctx.fillStyle="#9a4837";
  ctx.fillRect(sx+5,sy+22,spec.w-10,22);
  ctx.fillStyle="#70472c";
  ctx.fillRect(sx+spec.w*.47,sy+spec.h-32,14,32);
}

function drawTreeObject(obj,camX,camY){
  drawTree(obj.x-camX,obj.y-camY,obj.variant||0);
}

function worldTypeAt(tx,ty){
  if(tx<0||ty<0||tx>=WORLD_W||ty>=WORLD_H) return 1;
  return world[ty][tx];
}

function isRoadGround(t){
  return t===3 || t===4 || t===5;
}

function paintContinuousGrassClip(x,y,tx,ty,clipFn){
  ctx.save();
  ctx.beginPath();
  clipFn();
  ctx.clip();
  if(!drawContinuousTerrain("grass",x,y,tx,ty)){
    ctx.fillStyle="#718f45";
    ctx.fillRect(Math.floor(x)-1,Math.floor(y)-1,TILE+2,TILE+2);
  }
  ctx.restore();
}

// This only masks road corners. The protected seamless dirt renderer remains unchanged.
function drawRoadShapeOverlay(x,y,tx,ty){
  const n=isRoadGround(worldTypeAt(tx,ty-1));
  const s=isRoadGround(worldTypeAt(tx,ty+1));
  const w=isRoadGround(worldTypeAt(tx-1,ty));
  const e=isRoadGround(worldTypeAt(tx+1,ty));
  const r=18;

  if(!n && !w) paintContinuousGrassClip(x,y,tx,ty,()=>ctx.rect(x,y,r,r));
  if(!n && !e) paintContinuousGrassClip(x,y,tx,ty,()=>ctx.rect(x+TILE-r,y,r,r));
  if(!s && !w) paintContinuousGrassClip(x,y,tx,ty,()=>ctx.rect(x,y+TILE-r,r,r));
  if(!s && !e) paintContinuousGrassClip(x,y,tx,ty,()=>ctx.rect(x+TILE-r,y+TILE-r,r,r));

  // Soft pixel edge gives the road a laid-in-world look instead of a square stamp.
  ctx.fillStyle="rgba(78,52,31,.20)";
  if(!n) ctx.fillRect(x+16,y+1,32,2);
  if(!s) ctx.fillRect(x+16,y+TILE-3,32,2);
  if(!w) ctx.fillRect(x+1,y+16,2,32);
  if(!e) ctx.fillRect(x+TILE-3,y+16,2,32);
}

function drawWaterEdgeOverlay(x,y,tx,ty){
  const n=worldTypeAt(tx,ty-1)===1;
  const s=worldTypeAt(tx,ty+1)===1;
  const w=worldTypeAt(tx-1,ty)===1;
  const e=worldTypeAt(tx+1,ty)===1;
  ctx.fillStyle="#b9975e";
  if(!n) ctx.fillRect(x,y,TILE,5);
  if(!s) ctx.fillRect(x,y+TILE-5,TILE,5);
  if(!w) ctx.fillRect(x,y,5,TILE);
  if(!e) ctx.fillRect(x+TILE-5,y,5,TILE);
  ctx.fillStyle="rgba(242,220,162,.40)";
  if(!n) ctx.fillRect(x+5,y+1,TILE-10,2);
  if(!s) ctx.fillRect(x+5,y+TILE-3,TILE-10,2);
  if(!w) ctx.fillRect(x+1,y+5,2,TILE-10);
  if(!e) ctx.fillRect(x+TILE-3,y+5,2,TILE-10);
}

function drawFenceObject(obj,camX,camY){
  const x=obj.x-camX, y=obj.y-camY;
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle="#6b4728";
  ctx.strokeStyle="#3f2b1c";
  ctx.lineWidth=1;
  for(let i=0;i<obj.len;i++){
    const ox=obj.dir==="h"?i*28:0;
    const oy=obj.dir==="v"?i*28:0;
    if(obj.dir==="h"){
      ctx.fillRect(x+ox,y+6,31,4); ctx.fillRect(x+ox,y+17,31,4);
      ctx.fillRect(x+ox+4,y+1,5,26); ctx.fillRect(x+ox+25,y+1,5,26);
    }else{
      ctx.fillRect(x+6,y+oy,4,31); ctx.fillRect(x+17,y+oy,4,31);
      ctx.fillRect(x+1,y+oy+4,26,5); ctx.fillRect(x+1,y+oy+25,26,5);
    }
  }
  ctx.restore();
}

function drawSignObject(obj,camX,camY){
  const x=obj.x-camX, y=obj.y-camY;
  ctx.save(); ctx.imageSmoothingEnabled=false;
  ctx.fillStyle="#6a472b"; ctx.fillRect(x+14,y+14,5,24);
  ctx.fillStyle="#9a6b3c"; ctx.fillRect(x+3,y+4,29,14);
  ctx.fillStyle="#d8bd86"; ctx.fillRect(x+6,y+7,23,8);
  ctx.restore();
}

function drawCastle(x,y){
  ctx.imageSmoothingEnabled=false;

  ctx.fillStyle="#565c66";
  ctx.fillRect(x+8,y+18,48,40);
  ctx.fillStyle="#858d98";
  ctx.fillRect(x+12,y+21,40,33);

  // towers
  ctx.fillStyle="#6c737d";
  ctx.fillRect(x+7,y+7,13,19);
  ctx.fillRect(x+25,y+3,14,23);
  ctx.fillRect(x+44,y+7,13,19);

  // battlements
  ctx.fillStyle="#a2a8b1";
  for(const bx of [8,16,26,35,45,53]) ctx.fillRect(x+bx,y+17,5,5);

  // entrance
  ctx.fillStyle="#3f342d";
  ctx.fillRect(x+27,y+38,10,20);
  ctx.fillStyle="#a4783c";
  ctx.fillRect(x+29,y+40,6,18);

  // windows
  ctx.fillStyle="#2e3943";
  ctx.fillRect(x+17,y+31,3,7);
  ctx.fillRect(x+44,y+31,3,7);
}

const CAMERA_ZOOM = 1.85; // protected camera setting: closer, character-focused POV

function drawWorldHpBar(x,y,value,maxValue,width=38){
  const ratio=Math.max(0,Math.min(1,value/Math.max(1,maxValue)));
  ctx.fillStyle="rgba(0,0,0,.68)";
  ctx.fillRect(Math.round(x-width/2-1),Math.round(y-1),width+2,6);
  ctx.fillStyle=ratio>.5?"#65d978":ratio>.25?"#e2c855":"#e65b5b";
  ctx.fillRect(Math.round(x-width/2),Math.round(y),Math.round(width*ratio),4);
}

function drawWorldCombatFx(camX,camY){
  ctx.textAlign="center";
  ctx.font="800 11px system-ui";
  for(const fx of combatFx){
    const progress=1-fx.life/fx.maxLife;
    const sx=fx.x-camX;
    const sy=fx.y-camY-progress*26;
    ctx.globalAlpha=Math.max(0,1-progress*.82);
    ctx.fillStyle=fx.kind==="heal"?"#72ef9a":fx.kind==="crit"?"#ffd15a":"#fff1e2";
    ctx.strokeStyle="rgba(0,0,0,.75)";
    ctx.lineWidth=3;
    ctx.strokeText(fx.text,sx,sy);
    ctx.fillText(fx.text,sx,sy);
  }
  ctx.globalAlpha=1;
  ctx.textAlign="start";
}

function drawWorld(){
  const vw=innerWidth, vh=innerHeight;
  const zoom=CAMERA_ZOOM;
  const viewW=vw/zoom, viewH=vh/zoom;
  const camX=state.x-viewW/2;
  const camY=state.y-viewH/2;

  ctx.fillStyle="#718f45";
  ctx.fillRect(0,0,vw,vh);

  ctx.save();
  ctx.scale(zoom,zoom);

  const minX=Math.max(0,Math.floor(camX/TILE)-1);
  const maxX=Math.min(WORLD_W-1,Math.ceil((camX+viewW)/TILE)+1);
  const minY=Math.max(0,Math.floor(camY/TILE)-1);
  const maxY=Math.min(WORLD_H-1,Math.ceil((camY+viewH)/TILE)+1);

  // Ground only. Tiles still exist for gameplay, but not as visible bordered squares.
  for(let y=minY;y<=maxY;y++){
    for(let x=minX;x<=maxX;x++){
      const sx=x*TILE-camX;
      const sy=y*TILE-camY;
      const t=world[y][x];
      const variant=(x+y)%3;

      if(t===1){ drawWaterTile(sx,sy,variant); drawWaterEdgeOverlay(sx,sy,x,y); }
      else if(t===3){ drawRoadTile(sx,sy,variant,x,y); drawRoadShapeOverlay(sx,sy,x,y); }
      else if(t===4) drawTownTile(sx,sy,variant,x,y);
      else if(t===5){
        drawCastleGroundTile(sx,sy,x,y);
        drawCastle(sx,sy);
      }else if(t===2) drawForestTile(sx,sy,variant,x,y);
      else drawGrassTile(sx,sy,variant,x,y);
    }
  }

  // Y-sort scenery, mobs, and the player so overlap feels like an RPG world.
  const renderables=[];

  for(const tree of sceneryTrees){
    const sx=tree.x-camX, sy=tree.y-camY;
    if(sx<-120||sy<-130||sx>viewW+120||sy>viewH+90) continue;
    renderables.push({kind:"tree",depth:tree.y+58,obj:tree});
  }

  for(const house of sceneryHouses){
    const sx=house.x-camX, sy=house.y-camY;
    if(sx<-house.spec.w||sy<-house.spec.h||sx>viewW+60||sy>viewH+60) continue;
    renderables.push({kind:"house",depth:house.y+house.spec.h-5,obj:house});
  }

  for(const fence of sceneryFences){
    const sx=fence.x-camX, sy=fence.y-camY;
    if(sx<-100||sy<-100||sx>viewW+100||sy>viewH+100) continue;
    renderables.push({kind:"fence",depth:fence.y+35,obj:fence});
  }
  for(const sign of scenerySigns){
    const sx=sign.x-camX, sy=sign.y-camY;
    if(sx<-80||sy<-80||sx>viewW+80||sy>viewH+80) continue;
    renderables.push({kind:"sign",depth:sign.y+40,obj:sign});
  }

  for(const mob of mobs){
    if(!mob.alive) continue;
    const sx=mob.x-camX, sy=mob.y-camY;
    if(sx<-60||sy<-60||sx>viewW+60||sy>viewH+60) continue;
    renderables.push({kind:"mob",depth:mob.y,obj:mob});
  }

  renderables.push({kind:"hero",depth:state.y,obj:null});
  renderables.sort((a,b)=>a.depth-b.depth);

  for(const item of renderables){
    if(item.kind==="tree"){
      drawTreeObject(item.obj,camX,camY);
    }else if(item.kind==="house"){
      drawHouseObject(item.obj,camX,camY);
    }else if(item.kind==="fence"){
      drawFenceObject(item.obj,camX,camY);
    }else if(item.kind==="sign"){
      drawSignObject(item.obj,camX,camY);
    }else if(item.kind==="mob"){
      const mob=item.obj;
      let sx=mob.x-camX, sy=mob.y-camY;

      if(mob===combatTarget){
        ctx.strokeStyle="rgba(255,208,88,.92)";
        ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(sx,sy+12,mob.boss?25:18,mob.boss?10:7,0,0,Math.PI*2);ctx.stroke();
      }

      if((mob.attackAnim||0)>0 && mob===combatTarget){
        const phase=Math.sin((1-mob.attackAnim/.20)*Math.PI);
        const dx=state.x-mob.x,dy=state.y-mob.y,len=Math.max(1,Math.hypot(dx,dy));
        sx+=dx/len*6*phase; sy+=dy/len*6*phase;
      }

      ctx.fillStyle="rgba(0,0,0,.20)";
      ctx.beginPath();ctx.ellipse(sx,sy+12,13,5,0,0,Math.PI*2);ctx.fill();
      drawMob(ctx,mob,sx,sy);

      if(mob===combatTarget || mob.hp<mob.maxHp){
        drawWorldHpBar(sx,sy-(mob.boss?38:29),mob.hp,mob.maxHp,mob.boss?52:38);
      }else if(mob.aggro){
        ctx.fillStyle="#f2d15f";
        ctx.beginPath();ctx.arc(sx,sy-26,4,0,Math.PI*2);ctx.fill();
      }
    }else{
      let hx=viewW/2,hy=viewH/2;
      if(playerAttackAnim>0 && combatTarget && combatTarget.alive){
        const phase=Math.sin((1-playerAttackAnim/.20)*Math.PI);
        const dx=combatTarget.x-state.x,dy=combatTarget.y-state.y,len=Math.max(1,Math.hypot(dx,dy));
        hx+=dx/len*5*phase; hy+=dy/len*5*phase;
      }
      drawHero(ctx,hx,hy,0.055,isHeroMoving,moveAnimTime,heroFacing);
      if(combatTarget || state.hp<state.maxHp) drawWorldHpBar(hx,hy-31,state.hp,state.maxHp,42);
    }
  }

  drawWorldCombatFx(camX,camY);

  function label(wx,wy,text){
    const sx=wx*TILE-camX;
    const sy=wy*TILE-camY;
    if(sx<-160||sy<-60||sx>viewW+50||sy>viewH+50)return;
    ctx.font="700 11px system-ui";
    const w=ctx.measureText(text).width+14;
    roundedRect(ctx,sx-w/2+24,sy-26,w,20,7,"rgba(74,49,95,.70)");
    ctx.fillStyle="#fff";
    ctx.textAlign="center";
    ctx.fillText(text,sx+24,sy-12);
    ctx.textAlign="start";
  }
  label(5,6,"Oakrest");
  label(24,15,"Stone Castle");

  ctx.restore();
}

function townEvent(){
  if(enemy)return;
  if(combatTarget) disengageCombat(false);
  if(state.hp<state.maxHp){
    state.hp=state.maxHp;
    toast("Oakrest inn restored your HP.");
  }else{
    toast("Oakrest Town");
  }
  if(state.gold>=5 && state.potions<3){
    state.gold-=5;
    state.potions++;
    setTimeout(()=>toast("Bought 1 potion for 5 gold."),700);
  }
  updateUI();
}

function castleEvent(){
  if(state.bossDefeated){toast("The throne room is quiet.");return}
  if(!state.questComplete){toast("The castle is sealed. Defeat 3 Slimes.");return}
  if(bossMob && bossMob.alive){
    engageMob(bossMob);
    return;
  }

  const tx=24, ty=15;
  const mob={
    id:nextMobId++,kind:"boss",template:bossTemplate,boss:true,
    x:tx*TILE+TILE/2,y:ty*TILE+TILE/2,
    homeX:tx*TILE+TILE/2,homeY:ty*TILE+TILE/2,
    vx:0,vy:0,drawVx:0,drawVy:0,facing:"down",animTime:0,moveTimer:0,
    alive:true,respawnTimer:0,aggro:true
  };
  restoreMobStats(mob);
  bossMob=mob; mobs.push(mob);
  toast("The Stone King enters the courtyard!");
  engageMob(mob);
}
