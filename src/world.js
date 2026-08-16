// 0 grass, 1 water, 2 forest, 3 road, 4 town, 5 legacy castle, 6 blocked forest, 7 dirt clearing
const world = Array.from({length:WORLD_H}, () => Array(WORLD_W).fill(0));

function paintWorldRect(x1,y1,x2,y2,type){
  for(let y=Math.max(0,y1);y<=Math.min(WORLD_H-1,y2);y++){
    for(let x=Math.max(0,x1);x<=Math.min(WORLD_W-1,x2);x++) world[y][x]=type;
  }
}
function paintWorldH(y,x1,x2,type,width=1){
  for(let yy=y;yy<y+width;yy++) for(let x=x1;x<=x2;x++) if(yy>=0&&yy<WORLD_H&&x>=0&&x<WORLD_W) world[yy][x]=type;
}
function paintWorldV(x,y1,y2,type,width=1){
  for(let xx=x;xx<x+width;xx++) for(let y=y1;y<=y2;y++) if(xx>=0&&xx<WORLD_W&&y>=0&&y<WORLD_H) world[y][xx]=type;
}

function buildWorld(){
  // Large starter region. The outer forest is deliberately non-walkable so the
  // zone feels enclosed without surrounding everything with water.
  for(let y=0;y<WORLD_H;y++){
    for(let x=0;x<WORLD_W;x++) world[y][x]=(x<=1||y<=1||x>=WORLD_W-2||y>=WORLD_H-2)?6:0;
  }

  // Starter Town: open, safe, and spaced out enough for future vendors/quests.
  paintWorldRect(2,2,12,10,4);

  // Main road spine and branches. Two tiles wide where possible so it reads as
  // the route between future zones rather than a thin village footpath.
  paintWorldV(6,8,14,3,2);          // town -> main road
  paintWorldH(13,5,38,3,2);         // west/east spine
  paintWorldV(6,14,18,3,2);         // farm branch
  paintWorldV(18,8,13,3,2);         // slime branch
  paintWorldV(35,10,13,3,2);        // goblin branch
  paintWorldV(36,14,29,3,2);        // road to next zone

  // Farm meadow outside town.
  paintWorldRect(2,17,10,24,0);

  // Slime habitat: mottled dirt/grass with a small pond.
  for(let y=3;y<=10;y++) for(let x=16;x<=27;x++){
    if(worldHash(x+71,y+29)%100<42) world[y][x]=7;
  }
  paintWorldRect(23,7,25,8,1);
  world[7][22]=1; // irregular pond shoulders
  world[8][26]=1;

  // Goblin camp clearing. Dirt is separate from roads so its edges stay broad
  // and camp-like rather than receiving road corner masks.
  paintWorldRect(32,4,41,10,7);
  paintWorldV(35,10,13,3,2);

  // Wilderness forest clusters. Large open corridors remain for roaming wolves.
  const forestAreas=[
    [12,15,17,20],[27,15,33,20],[38,15,41,24],
    [11,24,18,29],[22,23,29,29],[30,25,35,29],
    [13,3,15,10],[28,3,31,11]
  ];
  for(const [x1,y1,x2,y2] of forestAreas){
    for(let y=y1;y<=y2;y++) for(let x=x1;x<=x2;x++){
      if(world[y][x]===0 && worldHash(x*5+11,y*7+3)%100<68) world[y][x]=2;
    }
  }

  // Keep important travel / encounter spaces clear after forest painting.
  paintWorldRect(2,2,12,10,4);
  paintWorldV(6,8,14,3,2);
  paintWorldH(13,5,38,3,2);
  paintWorldV(6,14,18,3,2);
  paintWorldV(18,8,13,3,2);
  paintWorldV(35,10,13,3,2);
  paintWorldV(36,14,29,3,2);

  // Restore the two encounter clearings after the road pass.
  for(let y=3;y<=10;y++) for(let x=16;x<=27;x++){
    if((x===18||x===19) && y>=8) continue;
    world[y][x]=worldHash(x+71,y+29)%100<42?7:0;
  }
  paintWorldRect(23,7,25,8,1); world[7][22]=1; world[8][26]=1;
  paintWorldRect(32,4,41,10,7); paintWorldV(35,10,13,3,2);
}

const sceneryTrees=[];
const sceneryHouses=[];
const sceneryFences=[];
const scenerySigns=[];
const sceneryNPCs=[];
const sceneryProps=[];
let solidRects=[];

const PROP_SPECS = {
  signpost:{sx:0,sy:0,sw:79,sh:116,w:42,h:56},
  lamppost:{sx:124,sy:0,sw:69,sh:128,w:38,h:60},
  well:{sx:247,sy:0,sw:102,sh:124,w:62,h:64},
  notice:{sx:370,sy:0,sw:86,sh:113,w:50,h:56},
  sacks:{sx:0,sy:147,sw:100,sh:98,w:48,h:46},
  barrel:{sx:124,sy:147,sw:74,sh:97,w:42,h:48},
  crate:{sx:247,sy:147,sw:76,sh:88,w:44,h:44},
  bench:{sx:370,sy:147,sw:110,sh:61,w:52,h:30},
  mailbox:{sx:0,sy:293,sw:72,sh:110,w:34,h:46},
  haystack:{sx:124,sy:293,sw:104,sh:115,w:56,h:58},
  stool:{sx:247,sy:293,sw:68,sh:91,w:34,h:36},
  cart:{sx:370,sy:293,sw:115,sh:91,w:62,h:44},
  hay:{sx:0,sy:439,sw:98,sh:78,w:50,h:42},
  table:{sx:124,sy:439,sw:98,sh:81,w:52,h:32},
  flowerBoxA:{sx:247,sy:439,sw:99,sh:78,w:50,h:30},
  flowerBoxB:{sx:370,sy:439,sw:95,sh:68,w:50,h:30},
  scarecrow:{sx:0,sy:586,sw:103,sh:127,w:44,h:64},
  stoneWallCorner:{sx:124,sy:586,sw:98,sh:109,w:50,h:48},
  fenceCorner:{sx:247,sy:586,sw:98,sh:96,w:48,h:44},
  trough:{sx:370,sy:586,sw:116,sh:95,w:60,h:36},
  rockPile:{sx:0,sy:732,sw:103,sh:83,w:50,h:34},
  fence:{sx:124,sy:732,sw:104,sh:76,w:48,h:28},
  gate:{sx:247,sy:732,sw:106,sh:82,w:48,h:44},
  stoneWall:{sx:370,sy:732,sw:106,sh:71,w:50,h:34},
  stump:{sx:0,sy:878,sw:105,sh:96,w:44,h:36},
  bush:{sx:124,sy:878,sw:101,sh:94,w:42,h:34},
  campfire:{sx:247,sy:877,sw:102,sh:97,w:44,h:40},
  flowerBush:{sx:369,sy:878,sw:91,sh:91,w:44,h:34},
  log:{sx:0,sy:1024,sw:119,sh:86,w:50,h:34},
  boulder:{sx:124,sy:1024,sw:103,sh:80,w:44,h:34},
  flowerPatch:{sx:247,sy:1024,sw:97,sh:81,w:42,h:30},
  mushrooms:{sx:370,sy:1024,sw:86,sh:73,w:36,h:34},
  goblinTotem:{sx:0,sy:1171,sw:89,sh:145,w:44,h:66},
  goblinTent:{sx:124,sy:1171,sw:120,sh:140,w:56,h:56},
  trainingDummy:{sx:247,sy:1171,sw:90,sh:128,w:42,h:56},
  cauldron:{sx:370,sy:1171,sw:109,sh:121,w:52,h:56},
  archeryTarget:{sx:0,sy:1317,sw:97,sh:107,w:46,h:54},
  chest:{sx:124,sy:1317,sw:86,sh:87,w:44,h:38},
  spikeBarricade:{sx:247,sy:1317,sw:106,sh:104,w:52,h:34},
  bones:{sx:370,sy:1317,sw:109,sh:82,w:48,h:38},
  marketRed:{sx:0,sy:1463,sw:107,sh:134,w:52,h:54},
  woodpile:{sx:124,sy:1463,sw:106,sh:118,w:52,h:44},
  barrels3:{sx:247,sy:1463,sw:102,sh:106,w:54,h:44},
  crates3:{sx:370,sy:1463,sw:92,sh:105,w:52,h:44},
  marketBlue:{sx:0,sy:1610,sw:106,sh:105,w:52,h:52},
  wheel:{sx:124,sy:1610,sw:87,sh:92,w:40,h:40},
  barrelOpen:{sx:247,sy:1610,sw:89,sh:95,w:44,h:42},
  bucket:{sx:370,sy:1610,sw:65,sh:80,w:30,h:34},
  lanternPost:{sx:0,sy:1756,sw:86,sh:129,w:38,h:60},
  hayCrate:{sx:124,sy:1756,sw:119,sh:126,w:56,h:44},
  grave:{sx:247,sy:1756,sw:102,sh:124,w:38,h:44},
  birdbath:{sx:370,sy:1756,sw:106,sh:123,w:44,h:48},
  clothesline:{sx:0,sy:1902,sw:123,sh:104,w:52,h:40},
  flowerCart:{sx:124,sy:1902,sw:111,sh:111,w:52,h:38},
  bridge:{sx:247,sy:1902,sw:115,sh:104,w:52,h:40},
  steppingStones:{sx:369,sy:1901,sw:100,sh:98,w:52,h:34},
};

const WORLD_OBJECT_DEPTH_MODES = new Set(["ysort","behind","front","ground"]);

function worldObjectDepthMode(obj){
  const raw=String(obj?.depthMode||"ysort").toLowerCase();
  if(raw==="background" || raw==="back") return "behind";
  if(raw==="foreground" || raw==="overlay") return "front";
  return WORLD_OBJECT_DEPTH_MODES.has(raw)?raw:"ysort";
}

function worldObjectBaseSize(obj){
  if(!obj) return {w:32,h:32};
  if(obj.type==="crops") return {w:obj.w||90,h:obj.h||70};
  if(obj.type==="blockedGate") return {w:150,h:62};
  if(obj.type==="caveEntrance") return {w:obj.w||220,h:obj.h||160};
  return PROP_SPECS[obj.type]||{w:32,h:32};
}

function defaultWorldObjectDepthY(obj){
  const spec=worldObjectBaseSize(obj);
  const hb=obj?.hitbox;
  const hitBottom=Number(hb?.y)+Number(hb?.h);
  if(Number.isFinite(hitBottom)) return clamp(hitBottom,0,spec.h);
  return Math.max(0,spec.h-2);
}

function worldObjectDepthY(obj){
  return numberOr(obj?.depthY,defaultWorldObjectDepthY(obj));
}

function worldObjectRenderDepth(obj,heroY){
  const mode=worldObjectDepthMode(obj);
  if(mode==="ground") return -1000000000;
  if(mode==="behind") return heroY-0.25;
  if(mode==="front") return heroY+0.25;
  return obj.y+worldObjectDepthY(obj);
}

const MOB_SPAWN_TILES = new Set([
  "18,5","21,4","24,6","19,8","22,9","26,5",
  "34,6","37,5","39,8","35,9","40,6",
  "15,17","21,16","27,19","32,23","18,26","25,27","33,18","39,21",
  "4,20","8,22","6,21","9,20","5,23","7,19","9,23"
]);

function addSolidRect(x,y,w,h,type="solid"){
  solidRects.push({x,y,w,h,type});
}

function cloneNpc(obj){
  return JSON.parse(JSON.stringify(obj));
}

function normalizeNpcRecord(raw,index=0){
  const npc=cloneNpc(raw||{});
  npc.id=String(npc.id||`npc-${index+1}`).trim().replace(/\s+/g,"-").toLowerCase();
  npc.name=String(npc.name||npc.id||"NPC");
  npc.role=String(npc.role||"Villager");
  npc.sprite=typeof npc.sprite==="string"?npc.sprite:"";
  npc.x=numberOr(npc.x,START_X);
  npc.y=numberOr(npc.y,START_Y);
  npc.facing=["down","left","right","up"].includes(npc.facing)?npc.facing:"down";
  npc.solid=npc.solid!==false;
  npc.displayHeight=Math.max(24,numberOr(npc.displayHeight,58));
  npc.greeting=String(npc.greeting||`Hello. I'm ${npc.name}.`);
  npc.interactRadius=Math.max(20,numberOr(npc.interactRadius,58));
  return npc;
}

function getProjectNPCs(){
  return (PROJECT_NPCS||[]).map((npc,index)=>normalizeNpcRecord(npc,index));
}

function rebuildNpcCollision(){
  solidRects=solidRects.filter(r=>r.type!=="npc");
  for(const npc of sceneryNPCs){
    if(npc.solid===false) continue;
    const hb=npc.hitbox||{};
    const w=Math.max(6,numberOr(hb.w,12));
    const h=Math.max(6,numberOr(hb.h,14));
    const x=numberOr(hb.x,-w/2);
    const y=numberOr(hb.y,-h/2);
    addSolidRect(npc.x+x,npc.y+y,w,h,"npc");
  }
}

function findNpcAtWorld(wx,wy){
  let best=null,bestScore=Infinity;
  for(const npc of sceneryNPCs){
    const h=Math.max(30,numberOr(npc.displayHeight,58)*VISUAL_SCALE.npcs);
    const dx=Math.abs(wx-npc.x);
    const dy=wy-npc.y;
    const halfW=Math.max(18,h*.30);
    if(dx<=halfW && dy>=-h && dy<=18){
      const score=dx*dx+(dy*.55)*(dy*.55);
      if(score<bestScore){best=npc;bestScore=score;}
    }
  }
  return best;
}

function nearestInteractableNpc(range=72){
  let best=null,bestDist=Infinity;
  for(const npc of sceneryNPCs){
    const d=dist(state.x,state.y,npc.x,npc.y);
    const allowed=Math.max(range,numberOr(npc.interactRadius,58));
    if(d<=allowed && d<bestDist){best=npc;bestDist=d;}
  }
  return best;
}

function buildScenery(){
  sceneryTrees.length=0;
  sceneryHouses.length=0;
  sceneryFences.length=0;
  scenerySigns.length=0;
  sceneryNPCs.length=0;
  sceneryProps.length=0;
  solidRects=[];

  // ----- Starter Town -----
  const houses=[
    {type:"A",x:3*TILE+4, y:3*TILE-18},
    {type:"B",x:7*TILE+12,y:3*TILE-12},
    {type:"B",x:3*TILE-2, y:7*TILE-22},
    {type:"A",x:9*TILE-8, y:7*TILE-26},
    // Farm barn / farmhouse.
    {type:"A",x:3*TILE+4, y:18*TILE-24}
  ];
  for(const placement of houses){
    const spec=HOUSE_SPECS[placement.type];
    const obj={...placement,spec};
    sceneryHouses.push(obj);
    const f=spec.footprint;
    addSolidRect(placement.x+f.x,placement.y+f.y,f.w,f.h,"house");
  }
  // Static world props come from config/world-objects.js. Developer Mode can
  // edit this list visually and export a replacement config file.
  sceneryProps.push(...getProjectWorldObjects());

  // NPC placement is project data now. World Builder can move/add/delete NPCs
  // and export config/npcs.js without changing this runtime module.
  sceneryNPCs.push(...getProjectNPCs());
  rebuildNpcCollision();
  addSolidRect(6*TILE+15,5*TILE+25,30,24,"well");

  // Farm perimeter. Keep a gate opening on the north side near the road.
  sceneryFences.push(
    {x:2*TILE+8,y:17*TILE+4,dir:"h",len:8},
    {x:8*TILE+18,y:17*TILE+4,dir:"h",len:5},
    {x:2*TILE+8,y:24*TILE+28,dir:"h",len:19},
    {x:2*TILE+8,y:17*TILE+4,dir:"v",len:18},
    {x:10*TILE+18,y:17*TILE+4,dir:"v",len:18}
  );

  // Crude camp palisades; intentionally decorative for now so combat movement
  // stays fluid inside the camp.
  sceneryFences.push(
    {x:32*TILE+6,y:4*TILE+6,dir:"h",len:21},
    {x:32*TILE+6,y:10*TILE+16,dir:"h",len:21},
    {x:32*TILE+6,y:4*TILE+6,dir:"v",len:14},
    {x:41*TILE-6,y:4*TILE+6,dir:"v",len:14}
  );

  scenerySigns.push(
    {x:6*TILE+8,y:10*TILE+8,text:"Starter Town"},
    {x:7*TILE+8,y:17*TILE+10,text:"Farm"},
    {x:18*TILE+8,y:10*TILE+5,text:"Slimes"},
    {x:35*TILE+8,y:10*TILE+5,text:"Goblin Camp"},
    {x:36*TILE+4,y:27*TILE+30,text:"Snickers Cave"}
  );

  // Forest object placement. Boundary forest is deliberately denser than the
  // interior clusters; only the trunk remains solid, as in the stable build.
  const reserved=new Set([...MOB_SPAWN_TILES]);
  for(let ty=0;ty<WORLD_H;ty++){
    for(let tx=0;tx<WORLD_W;tx++){
      const wt=world[ty][tx];
      if(wt!==2 && wt!==6) continue;
      if(reserved.has(`${tx},${ty}`)) continue;
      const threshold=wt===6?82:48;
      if(worldHash(tx,ty)%100>=threshold) continue;
      const ox=(worldHash(tx+31,ty+11)%15)-7;
      const oy=(worldHash(tx+7,ty+41)%11)-5;
      const obj={x:tx*TILE+ox,y:ty*TILE+oy,variant:worldHash(tx,ty)%6};
      sceneryTrees.push(obj);
      addSolidRect(obj.x+24,obj.y+38,16,19,"tree");
    }
  }

  // blockedGate objects are registered as "zone-gate" collision by Developer Mode.
  rebuildWorldObjectCollision();
}

const tile = {
  0:{walk:true},
  1:{walk:false},
  2:{walk:true},
  3:{walk:true},
  4:{walk:true},
  5:{walk:true},
  6:{walk:false},
  7:{walk:true}
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

function drawWaterTile(x,y,variant=0,tx=0,ty=0){
  ctx.imageSmoothingEnabled=false;

  if(waterTextureReady){
    const size=512;
    const sx=(((tx*TILE)%size)+size)%size;
    const sy=(((ty*TILE)%size)+size)%size;
    ctx.drawImage(
      waterTexture,
      sx,sy,TILE,TILE,
      Math.floor(x)-1,Math.floor(y)-1,TILE+2,TILE+2
    );
  }else{
    ctx.fillStyle="#247b99";
    ctx.fillRect(Math.floor(x)-1,Math.floor(y)-1,TILE+2,TILE+2);
  }

  // Small moving highlights sit on top of the texture. They are deliberately
  // short/broken so the water never turns back into horizontal tile stripes.
  const t=performance.now()*0.001;
  for(let i=0;i<2;i++){
    const seed=worldHash(tx*31+i*17,ty*37+i*23);
    const rx=x+7+(seed%42)+Math.sin(t*1.7+i+tx*.4+ty*.2)*3;
    const ry=y+10+((seed>>3)%38);
    ctx.fillStyle=i===0?"rgba(202,241,242,.34)":"rgba(143,220,230,.24)";
    ctx.fillRect(Math.round(rx),Math.round(ry),7+(seed%8),1);
    if(seed%3===0) ctx.fillRect(Math.round(rx)+3,Math.round(ry)+2,5,1);
  }
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
  const scale=VISUAL_SCALE.houses;
  const dw=spec.w*scale, dh=spec.h*scale;
  const dx=sx+spec.w/2-dw/2;
  const dy=sy+spec.h-dh; // keep the physical footprint anchored at the bottom

  if(spec.ready()){
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(spec.image,Math.round(dx),Math.round(dy),Math.round(dw),Math.round(dh));
    return;
  }

  ctx.save();
  ctx.translate(sx+spec.w/2,sy+spec.h);
  ctx.scale(scale,scale);
  ctx.translate(-(sx+spec.w/2),-(sy+spec.h));
  // Simple loading fallback.
  ctx.fillStyle="#d8c7a0";
  ctx.fillRect(sx+14,sy+38,spec.w-28,spec.h-45);
  ctx.fillStyle="#9a4837";
  ctx.fillRect(sx+5,sy+22,spec.w-10,22);
  ctx.fillStyle="#70472c";
  ctx.fillRect(sx+spec.w*.47,sy+spec.h-32,14,32);
  ctx.restore();
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
  const depth=(edge,i)=>5+(worldHash(tx*43+i*11+(edge===1?101:edge===2?203:edge===3?307:409),ty*47+i*13)%7);

  // Let the real grass texture overlap the water in a jagged pixel shoreline.
  // Collision still uses the unchanged water tiles; this is visual only.
  if(!n) paintContinuousGrassClip(x,y,tx,ty,()=>{
    ctx.moveTo(x,y);ctx.lineTo(x+TILE,y);
    for(let i=4;i>=0;i--) ctx.lineTo(x+i*16,y+depth(1,i));
    ctx.closePath();
  });
  if(!s) paintContinuousGrassClip(x,y,tx,ty,()=>{
    ctx.moveTo(x,y+TILE);ctx.lineTo(x+TILE,y+TILE);
    for(let i=4;i>=0;i--) ctx.lineTo(x+i*16,y+TILE-depth(2,i));
    ctx.closePath();
  });
  if(!w) paintContinuousGrassClip(x,y,tx,ty,()=>{
    ctx.moveTo(x,y);ctx.lineTo(x,y+TILE);
    for(let i=4;i>=0;i--) ctx.lineTo(x+depth(3,i),y+i*16);
    ctx.closePath();
  });
  if(!e) paintContinuousGrassClip(x,y,tx,ty,()=>{
    ctx.moveTo(x+TILE,y);ctx.lineTo(x+TILE,y+TILE);
    for(let i=4;i>=0;i--) ctx.lineTo(x+TILE-depth(4,i),y+i*16);
    ctx.closePath();
  });

  // Sandy pixels and foam are broken into short sections instead of straight borders.
  ctx.fillStyle="#b89a62";
  if(!n) for(let i=0;i<4;i++){const d=depth(1,i);ctx.fillRect(x+i*16+2,y+d-2,12,3);}
  if(!s) for(let i=0;i<4;i++){const d=depth(2,i);ctx.fillRect(x+i*16+2,y+TILE-d-1,12,3);}
  if(!w) for(let i=0;i<4;i++){const d=depth(3,i);ctx.fillRect(x+d-2,y+i*16+2,3,12);}
  if(!e) for(let i=0;i<4;i++){const d=depth(4,i);ctx.fillRect(x+TILE-d-1,y+i*16+2,3,12);}

  ctx.fillStyle="rgba(225,244,234,.42)";
  if(!n) for(let i=0;i<3;i++){const d=depth(1,i);ctx.fillRect(x+i*20+8,y+d+2,8,1);}
  if(!s) for(let i=0;i<3;i++){const d=depth(2,i);ctx.fillRect(x+i*20+8,y+TILE-d-3,8,1);}
  if(!w) for(let i=0;i<3;i++){const d=depth(3,i);ctx.fillRect(x+d+2,y+i*20+8,1,8);}
  if(!e) for(let i=0;i<3;i++){const d=depth(4,i);ctx.fillRect(x+TILE-d-3,y+i*20+8,1,8);}
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

function drawPropAtlasCell(spec,x,y){
  if(!propAtlasReady || !spec) return false;
  ctx.imageSmoothingEnabled=false;
  const sx=Number.isFinite(spec.sx)?spec.sx:spec.col*PROP_ATLAS_CELL;
  const sy=Number.isFinite(spec.sy)?spec.sy:spec.row*PROP_ATLAS_CELL;
  const sw=Number.isFinite(spec.sw)?spec.sw:PROP_ATLAS_CELL;
  const sh=Number.isFinite(spec.sh)?spec.sh:PROP_ATLAS_CELL;
  ctx.drawImage(propAtlas,sx,sy,sw,sh,Math.round(x),Math.round(y),spec.w,spec.h);
  return true;
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

function npcSpriteImage(path){
  if(!path) return null;
  npcSpriteImage.cache=npcSpriteImage.cache||new Map();
  if(npcSpriteImage.cache.has(path)) return npcSpriteImage.cache.get(path);
  const image=new Image();
  image.src=path;
  image.onload=()=>buildSpriteFrameMeta(image);
  npcSpriteImage.cache.set(path,image);
  return image;
}

function npcQuestMarker(npc){
  if(typeof getNpcQuestMarker!=="function") return "";
  return getNpcQuestMarker(npc?.id)||"";
}

function drawNpcObject(obj,camX,camY){
  const x=Math.round(obj.x-camX), y=Math.round(obj.y-camY);
  const facingRows={down:0,left:1,right:2,up:3};
  const row=facingRows[obj.facing]??0;
  const image=npcSpriteImage(obj.sprite);
  const displayH=Math.max(24,numberOr(obj.displayHeight,58))*VISUAL_SCALE.npcs;
  let topY=y-displayH+12;

  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle="rgba(0,0,0,.18)";
  ctx.beginPath();ctx.ellipse(x,y+9,Math.max(6,displayH*.13),3,0,0,Math.PI*2);ctx.fill();

  if(image?.naturalWidth&&image?.naturalHeight){
    const meta=spriteFrameMeta(image,row,0);
    if(meta){
      const dh=displayH;
      const dw=Math.max(1,dh*(meta.sw/meta.sh));
      topY=y-dh+14;
      ctx.drawImage(image,meta.sx,meta.sy,meta.sw,meta.sh,Math.round(x-dw/2),Math.round(topY),Math.round(dw),Math.round(dh));
    }
  }else{
    const scale=VISUAL_SCALE.npcs;
    ctx.translate(x,y+15);ctx.scale(scale,scale);ctx.translate(-x,-(y+15));
    ctx.fillStyle="#d9ad84"; ctx.fillRect(x-5,y-11,10,9);
    ctx.fillStyle="#5a3d2d"; ctx.fillRect(x-6,y-13,12,4); ctx.fillRect(x-6,y-9,2,5);
    ctx.fillStyle=obj.shirt||"#627e9b"; ctx.fillRect(x-6,y-2,12,10);
    ctx.fillStyle="#3b2e29"; ctx.fillRect(x-5,y+8,4,7); ctx.fillRect(x+1,y+8,4,7);
    ctx.fillStyle="#202020"; ctx.fillRect(x-3,y-7,1,1); ctx.fillRect(x+2,y-7,1,1);
    topY=y-18*scale;
  }

  const marker=npcQuestMarker(obj);
  if(marker){
    const ready=marker==="?";
    ctx.font="900 15px system-ui";ctx.textAlign="center";
    ctx.lineWidth=3;ctx.strokeStyle="rgba(35,24,15,.82)";ctx.strokeText(marker,x,topY-7);
    ctx.fillStyle=ready?"#ffe17b":"#ffd45b";ctx.fillText(marker,x,topY-7);ctx.textAlign="start";
  }
  ctx.restore();
}

function drawPropObject(obj,camX,camY){
  const x=Math.round(obj.x-camX), y=Math.round(obj.y-camY);
  const spec=PROP_SPECS[obj.type];
  const baseW=spec?.w || (obj.type==="caveEntrance"?(obj.w||244):obj.type==="crops"?(obj.w||90):24);
  const baseH=spec?.h || (obj.type==="caveEntrance"?(obj.h||176):obj.type==="crops"?(obj.h||70):24);
  const pScale=VISUAL_SCALE.props;

  ctx.save(); ctx.imageSmoothingEnabled=false;
  if(pScale!==1){
    ctx.translate(x+baseW/2,y+baseH);
    ctx.scale(pScale,pScale);
    ctx.translate(-(x+baseW/2),-(y+baseH));
  }
  if(spec && drawPropAtlasCell(spec,x,y)){ ctx.restore(); return; }
  if(obj.type==="caveEntrance"){
    const w=obj.w||220, h=obj.h||160;
    ctx.fillStyle="rgba(0,0,0,.22)";
    ctx.beginPath();
    ctx.ellipse(x + w/2, y + h - 8, Math.round(w*0.28), 10, 0, 0, Math.PI*2);
    ctx.fill();
    if(caveEntranceReady && caveEntranceImage.naturalWidth){
      ctx.drawImage(caveEntranceImage, x, y, w, h);
    }else{
      ctx.fillStyle="#5a4a3d"; ctx.fillRect(x+14,y+30,w-28,h-32);
      ctx.fillStyle="#151214"; ctx.fillRect(x+40,y+56,w-80,h-46);
    }
  }else if(obj.type==="crops") {
    const w=obj.w||90,h=obj.h||70;
    ctx.fillStyle="rgba(92,62,38,.42)"; ctx.fillRect(x,y,w,h);
    for(let yy=8;yy<h-4;yy+=18){
      for(let xx=7;xx<w-4;xx+=18){
        const alt=((xx+yy)/18)%2;
        ctx.fillStyle=alt?"#5f9d45":"#7aae4c"; ctx.fillRect(x+xx,y+yy,8,4); ctx.fillRect(x+xx+2,y+yy-4,4,8);
      }
    }
  }else if(obj.type==="blockedGate"){
    ctx.fillStyle="#4f3827"; ctx.fillRect(x,y,8,62); ctx.fillRect(x+142,y,8,62);
    ctx.fillStyle="#755137"; ctx.fillRect(x+5,y+8,140,8); ctx.fillRect(x+5,y+42,140,8);
    ctx.fillStyle="#8e633e"; ctx.fillRect(x+38,y+13,12,44); ctx.fillRect(x+100,y+13,12,44);
    ctx.fillStyle="#6e2e25"; ctx.fillRect(x+59,y+17,33,29); ctx.fillStyle="#e7c064"; ctx.font="900 22px system-ui"; ctx.textAlign="center"; ctx.fillText("×",x+75,y+40); ctx.textAlign="start";
  }else{
    // Fallback placeholder for any future prop ids that are not mapped yet.
    ctx.fillStyle="#8d6740";
    ctx.fillRect(x,y,24,24);
  }
  ctx.restore();
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
    ctx.fillStyle=fx.kind==="heal"?"#72ef9a":fx.kind==="crit"?"#ffd15a":fx.kind==="hurt"?"#ff8d86":fx.kind==="miss"?"#c9d2dc":"#fff1e2";
    ctx.strokeStyle="rgba(0,0,0,.80)";
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

      if(t===1){ drawWaterTile(sx,sy,variant,x,y); drawWaterEdgeOverlay(sx,sy,x,y); }
      else if(t===3){ drawRoadTile(sx,sy,variant,x,y); drawRoadShapeOverlay(sx,sy,x,y); }
      else if(t===4) drawTownTile(sx,sy,variant,x,y);
      else if(t===6) drawForestTile(sx,sy,variant,x,y);
      else if(t===7) drawRoadTile(sx,sy,variant,x,y);
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
  for(const prop of sceneryProps){
    const sx=prop.x-camX, sy=prop.y-camY;
    if(sx<-180||sy<-180||sx>viewW+180||sy>viewH+180) continue;
    renderables.push({kind:"prop",depth:worldObjectRenderDepth(prop,state.y),obj:prop});
  }
  for(const npc of sceneryNPCs){
    const sx=npc.x-camX, sy=npc.y-camY;
    if(sx<-60||sy<-80||sx>viewW+60||sy>viewH+60) continue;
    renderables.push({kind:"npc",depth:npc.y+15,obj:npc});
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
    }else if(item.kind==="prop"){
      drawPropObject(item.obj,camX,camY);
    }else if(item.kind==="npc"){
      drawNpcObject(item.obj,camX,camY);
    }else if(item.kind==="mob"){
      const mob=item.obj;
      let sx=mob.x-camX, sy=mob.y-camY;

      const mScale=mobVisualScale(mob);
      if(mob===selectedTarget || mob===combatTarget){
        ctx.strokeStyle=mob.elite?"rgba(197,140,255,.98)":(mob===combatTarget?"rgba(255,154,92,.96)":"rgba(255,220,96,.96)");
        ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(sx,sy+12,(mob.boss?25:18)*mScale,(mob.boss?10:7)*mScale,0,0,Math.PI*2);ctx.stroke();
      }

      if((mob.attackAnim||0)>0 && mob===combatTarget){
        const phase=Math.sin((1-mob.attackAnim/.20)*Math.PI);
        const dx=state.x-mob.x,dy=state.y-mob.y,len=Math.max(1,Math.hypot(dx,dy));
        sx+=dx/len*6*phase; sy+=dy/len*6*phase;
      }

      ctx.fillStyle="rgba(0,0,0,.20)";
      ctx.beginPath();ctx.ellipse(sx,sy+12,13*Math.min(1.6,mScale),5*Math.min(1.4,mScale),0,0,Math.PI*2);ctx.fill();
      drawMob(ctx,mob,sx,sy);

      if(mob===combatTarget || mob===selectedTarget || mob.hp<mob.maxHp){
        const hpY=sy-(mob.boss?38:29)*mScale;
        ctx.save();
        ctx.font=mob.boss?"900 8px system-ui":"800 7px system-ui";
        ctx.textAlign="center";
        ctx.fillStyle=mobLevelColor(mob.level,mob.boss,mob.elite);
        ctx.fillText(`Lv ${mob.level}${mob.elite?" Elite":""} • ${mobDisplayName(mob)}`,Math.round(sx),Math.round(hpY-5));
        ctx.restore();
        drawWorldHpBar(sx,hpY,mob.hp,mob.maxHp,(mob.boss?52:38)*Math.min(1.5,mScale));
      }else if(mob.aggro){
        ctx.fillStyle="#f2d15f";
        ctx.beginPath();ctx.arc(sx,sy-26*mScale,4,0,Math.PI*2);ctx.fill();
      }
    }else{
      let hx=viewW/2,hy=viewH/2;
      if(playerAttackAnim>0 && combatTarget && combatTarget.alive){
        const phase=Math.sin((1-playerAttackAnim/.20)*Math.PI);
        const dx=combatTarget.x-state.x,dy=combatTarget.y-state.y,len=Math.max(1,Math.hypot(dx,dy));
        hx+=dx/len*5*phase; hy+=dy/len*5*phase;
      }
      drawHero(ctx,hx,hy,0.055*VISUAL_SCALE.player,isHeroMoving,moveAnimTime,heroFacing);
      if(combatTarget || state.hp<state.maxHp) drawWorldHpBar(hx,hy-31*VISUAL_SCALE.player,state.hp,state.maxHp,42);
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
  label(7,2.5,"Starter Town");
  label(6,17,"Farm");
  label(22,3,"Slime Spawns");
  label(37,4,"Goblin Camp");
  label(36.35,27.75,"Snickers' Cave");

  if(devModeActive) drawDeveloperOverlay(camX,camY,viewW,viewH);
  ctx.restore();
}

function townEvent(){
  if(enemy)return;
  if(combatTarget) disengageCombat(false);
  if(state.hp<state.maxHp){
    state.hp=state.maxHp;
    toast("Starter Town restored your HP.");
    updateUI();
  }
}

function castleEvent(){
  // Legacy hook retained for save/runtime compatibility. The starter zone's
  // next-area road is physically blocked until a later zone update.
  toast("The next zone is not open yet.");
}
