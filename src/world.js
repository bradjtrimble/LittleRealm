const world = [];
const terrainImageCache=new Map();
function terrainLibrary(){return (typeof window!=="undefined"&&window.LR_TERRAINS&&typeof window.LR_TERRAINS==="object")?window.LR_TERRAINS:{};}
function terrainEntries(){return Object.entries(terrainLibrary());}
function terrainCodeById(id){const rec=terrainLibrary()[String(id||"")];return rec?Math.floor(numberOr(rec.code,0)):null;}
function terrainIdByCode(code){const n=Math.floor(numberOr(code,-999));return terrainEntries().find(([,rec])=>Math.floor(numberOr(rec?.code,-998))===n)?.[0]||"";}
function terrainDef(code){const id=terrainIdByCode(code);return id?terrainLibrary()[id]:null;}
function terrainDefaultCode(){const preferred=terrainCodeById((typeof window!=="undefined"&&window.LR_TERRAIN_DEFAULTS?.ground)||"");if(preferred!==null)return preferred;const entry=terrainEntries().find(([,rec])=>rec?.walkable!==false)||terrainEntries()[0];return Math.floor(numberOr(entry?.[1]?.code,0));}
function terrainBoundaryCode(){const preferred=terrainCodeById((typeof window!=="undefined"&&window.LR_TERRAIN_DEFAULTS?.boundary)||"");if(preferred!==null)return preferred;const entry=terrainEntries().find(([,rec])=>rec?.walkable===false)||terrainEntries()[0];return Math.floor(numberOr(entry?.[1]?.code,terrainDefaultCode()));}
function terrainIsWalkable(code){return terrainDef(code)?.walkable!==false;}
function terrainIsHealing(code){return terrainDef(code)?.healing===true;}
function terrainIsSanctuary(code){return terrainDef(code)?.sanctuary===true;}
function terrainMovementMultiplier(code){return Math.max(.1,numberOr(terrainDef(code)?.movementMultiplier,1));}
function terrainEdgeStyle(code){return String(terrainDef(code)?.edgeStyle||"none");}
function terrainDecoration(code){const d=terrainDef(code)?.decoration;return d&&typeof d==="object"?d:{type:"none"};}
function terrainAssetPath(assetId){return String((typeof window!=="undefined"&&window.LR_ASSETS?.[assetId]?.path)||"");}
function terrainImage(assetId){const path=terrainAssetPath(assetId);if(!path)return null;let image=terrainImageCache.get(path);if(image)return image;image=new Image();image.src=/^(?:data:|blob:|https?:|\.\/|\/)/.test(path)?path:`./${path}`;terrainImageCache.set(path,image);return image;}
function drawRepeatingTerrainAsset(assetId,x,y,tx=0,ty=0,textureScale=1){
  const image=terrainImage(assetId);if(!image||!image.complete||!image.naturalWidth||!image.naturalHeight)return false;
  ctx.imageSmoothingEnabled=false;
  const iw=image.naturalWidth,ih=image.naturalHeight,scale=clamp(numberOr(textureScale,1),.1,4),worldX=tx*TILE,worldY=ty*TILE;
  let sy=((worldY/scale)%ih+ih)%ih,dy=0;
  while(dy<TILE-.001){
    const sh=Math.min((TILE-dy)/scale,ih-sy),dh=sh*scale;
    let sx=((worldX/scale)%iw+iw)%iw,dx=0;
    while(dx<TILE-.001){
      const sw=Math.min((TILE-dx)/scale,iw-sx),dw=sw*scale;
      ctx.drawImage(image,sx,sy,sw,sh,x+dx,y+dy,dw,dh);
      dx+=dw;sx=0;
    }
    dy+=dh;sy=0;
  }
  return true;
}

function normalizeZoneTerrain(source,width=WORLD_W,height=WORLD_H){
  if(!Array.isArray(source)||!source.length) return null;
  const validCodes=new Set(terrainEntries().map(([,rec])=>Math.floor(numberOr(rec?.code,-999))));const fallback=terrainDefaultCode();const out=[];
  for(let y=0;y<height;y++){const src=Array.isArray(source[y])?source[y]:[],row=[];for(let x=0;x<width;x++){const v=Math.floor(numberOr(src[x],fallback));row.push(validCodes.has(v)?v:fallback);}out.push(row);}return out;
}
function makeBlankZoneTerrain(width=WORLD_W,height=WORLD_H){const inside=terrainDefaultCode(),boundary=terrainBoundaryCode(),out=[];for(let y=0;y<height;y++){const row=[];for(let x=0;x<width;x++)row.push((x<=1||y<=1||x>=width-2||y>=height-2)?boundary:inside);out.push(row);}return out;}
function resizeWorldGrid(width=WORLD_W,height=WORLD_H){world.length=0;for(let y=0;y<height;y++)world.push(Array(width).fill(terrainDefaultCode()));}
function buildWorld(){
  resizeWorldGrid();const projectTerrain=normalizeZoneTerrain(typeof window!=="undefined"?window.LR_WORLD_TERRAIN:null);
  if(!projectTerrain)throw new Error("Active zone has no valid terrain grid. Open the project in World Builder and create terrain data.");
  for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++)world[y][x]=projectTerrain[y][x];
}
function applyWorldZoneDefinition(settings={},terrain=null){configureWorldDimensions(settings||{});if(typeof window!=="undefined"){window.LR_ZONE_SETTINGS={...(settings||{}),width:WORLD_W,height:WORLD_H,startTileX:START_TILE_X,startTileY:START_TILE_Y};window.LR_WORLD_TERRAIN=normalizeZoneTerrain(terrain)||makeBlankZoneTerrain();}buildWorld();}

const sceneryTrees=[];
const sceneryNPCs=[];
const sceneryProps=[];
let solidRects=[];

// drawWorld reuses these small wrapper records. This keeps depth sorting simple
// while avoiding a fresh object allocation for every visible actor/prop frame.
const visibleWorldRenderables=[];
const worldRenderablePool=[];
let worldRenderableCount=0;

function resetWorldRenderables(){
  visibleWorldRenderables.length=0;
  worldRenderableCount=0;
}

function queueWorldRenderable(kind,depth,obj){
  let item=worldRenderablePool[worldRenderableCount];
  if(!item){
    item={kind:"",depth:0,obj:null};
    worldRenderablePool[worldRenderableCount]=item;
  }
  item.kind=kind;
  item.depth=depth;
  item.obj=obj;
  visibleWorldRenderables.push(item);
  worldRenderableCount++;
}

const WORLD_OBJECT_DEPTH_MODES = new Set(["ysort","behind","front","ground"]);

function worldObjectDepthMode(obj){
  const raw=String(obj?.depthMode||"ysort").toLowerCase();
  if(raw==="background" || raw==="back") return "behind";
  if(raw==="foreground" || raw==="overlay") return "front";
  return WORLD_OBJECT_DEPTH_MODES.has(raw)?raw:"ysort";
}

function worldObjectBaseSize(obj){
  const spec=worldObjectSpec(obj);
  return spec?{w:spec.w,h:spec.h}:{w:32,h:32};
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

const NPC_PLACEHOLDER_SPRITE = "./assets/npcs/npc-placeholder.png";

function npcDepthMode(npc){
  const raw=String(npc?.depthMode||"ysort").toLowerCase();
  if(raw==="background" || raw==="back") return "behind";
  if(raw==="foreground" || raw==="overlay") return "front";
  return WORLD_OBJECT_DEPTH_MODES.has(raw)?raw:"ysort";
}

function defaultNpcDepthY(npc){
  const hb=npc?.hitbox;
  const bottom=Number(hb?.y)+Number(hb?.h);
  return Number.isFinite(bottom)?Math.max(8,bottom):12;
}

function npcDepthY(npc){
  return numberOr(npc?.depthY,defaultNpcDepthY(npc));
}

function npcRenderDepth(npc,heroY){
  const mode=npcDepthMode(npc);
  if(mode==="ground") return -1000000000;
  if(mode==="behind") return heroY-0.25;
  if(mode==="front") return heroY+0.25;
  return npc.y+npcDepthY(npc);
}

function npcDisplayHeight(npc){
  return Math.max(24,numberOr(npc?.displayHeight,58))*VISUAL_SCALE.npcs;
}

function npcVisualBounds(npc){
  const h=npcDisplayHeight(npc);
  const halfW=Math.max(10,h*.34);
  return {x:npc.x-halfW,y:npc.y-h+14,w:halfW*2,h:h};
}



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
  npc.sprite=(typeof npc.sprite==="string"&&npc.sprite.trim())?npc.sprite:NPC_PLACEHOLDER_SPRITE;
  npc.spriteAsset=typeof npc.spriteAsset==="string"?npc.spriteAsset:"";
  npc.x=numberOr(npc.x,START_X);
  npc.y=numberOr(npc.y,START_Y);
  npc.facing=["down","left","right","up"].includes(npc.facing)?npc.facing:"down";
  npc.solid=npc.solid!==false;
  npc.displayHeight=Math.max(24,numberOr(npc.displayHeight,58));
  npc.greeting=String(npc.greeting||`Hello. I'm ${npc.name}.`);
  npc.interactRadius=Math.max(20,numberOr(npc.interactRadius,58));
  const hb=npc.hitbox&&typeof npc.hitbox==="object"?npc.hitbox:{};
  npc.hitbox={
    x:numberOr(hb.x,-6),
    y:numberOr(hb.y,-7),
    w:Math.max(2,numberOr(hb.w,12)),
    h:Math.max(2,numberOr(hb.h,14))
  };
  npc.depthMode=npcDepthMode(npc);
  npc.depthY=numberOr(npc.depthY,defaultNpcDepthY(npc));
  return npc;
}

function getProjectNPCs(){
  return (PROJECT_NPCS||[]).map((npc,index)=>normalizeNpcRecord(npc,index));
}

function cloneWorldObject(obj){
  return JSON.parse(JSON.stringify(obj));
}

function getProjectWorldObjects(){
  return (PROJECT_WORLD_OBJECTS||[]).map(cloneWorldObject);
}

function worldObjectDefinition(obj){
  const id=String(obj?.objectId||"").trim();
  return id?((typeof window!=="undefined"&&window.LR_OBJECT_DEFINITIONS?.[id])||PROJECT_OBJECT_DEFINITIONS?.[id]||null):null;
}

function worldObjectAssetRecord(obj){
  const def=worldObjectDefinition(obj);
  const assetId=String(def?.sourceAssetId||"").trim();
  return assetId?((typeof window!=="undefined"&&window.LR_ASSETS?.[assetId])||null):null;
}

function worldObjectSpritePath(obj){
  const def=worldObjectDefinition(obj),asset=worldObjectAssetRecord(obj);
  return String(asset?.path||def?.sprite||"").trim();
}

function worldObjectSpec(obj){
  if(!obj)return null;
  const def=worldObjectDefinition(obj);
  if(!def)return null;
  const w=Math.max(8,numberOr(obj.w,numberOr(def.w,numberOr(def.width,64))));
  const h=Math.max(8,numberOr(obj.h,numberOr(def.h,numberOr(def.height,64))));
  return {w,h,definition:def,crop:def.crop&&typeof def.crop==="object"?def.crop:null};
}

function rebuildWorldObjectCollision(){
  // Replace only project-prop collision. Houses, trees, NPCs, and other
  // protected collision sources keep their own records.
  solidRects=solidRects.filter(r=>r.type!=="world-prop");
  for(const obj of sceneryProps){
    if(!obj.solid || (typeof worldObjectIsHiddenByInteraction==="function"&&worldObjectIsHiddenByInteraction(obj))) continue;
    const hb=obj.hitbox||{};
    const spec=worldObjectSpec(obj)||{w:32,h:32};
    const x=numberOr(hb.x,0),y=numberOr(hb.y,Math.round(spec.h*.7));
    const w=Math.max(1,numberOr(hb.w,spec.w)),h=Math.max(1,numberOr(hb.h,Math.round(spec.h*.3)));
    addSolidRect(obj.x+x,obj.y+y,w,h,"world-prop");
  }
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
    const h=Math.max(30,npcDisplayHeight(npc));
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

function buildScenery({worldObjects=null,npcs=null}={}){
  sceneryTrees.length=0;
  sceneryNPCs.length=0;
  sceneryProps.length=0;
  solidRects=[];

  // Zone-specific editable records. Optional arguments are used when the local
  // Builder switches zones without reloading the entire page.
  sceneryProps.push(...((Array.isArray(worldObjects)?worldObjects:getProjectWorldObjects()).map(cloneWorldObject)));
  sceneryNPCs.push(...((Array.isArray(npcs)?npcs:getProjectNPCs()).map((npc,index)=>normalizeNpcRecord(npc,index))));
  rebuildNpcCollision();

  rebuildGeneratedTerrainScenery();

  rebuildWorldObjectCollision();
}

function rebuildGeneratedTerrainScenery(){
  sceneryTrees.length=0;solidRects=solidRects.filter(rect=>rect.type!=="tree");const reserved=new Set((window.LR_MOB_SPAWNS||[]).map(spawn=>`${Math.floor(numberOr(spawn.x,0)/TILE)},${Math.floor(numberOr(spawn.y,0)/TILE)}`));
  for(let ty=0;ty<WORLD_H;ty++)for(let tx=0;tx<WORLD_W;tx++){
    const code=world[ty][tx],decor=terrainDecoration(code);if(decor.type!=="tree")continue;if(reserved.has(`${tx},${ty}`))continue;
    const threshold=clamp(numberOr(decor.densityPercent,0),0,100);if(worldHash(tx,ty)%100>=threshold)continue;
    const ox=(worldHash(tx+31,ty+11)%15)-7,oy=(worldHash(tx+7,ty+41)%11)-5;
    const obj={x:tx*TILE+ox,y:ty*TILE+oy,variant:worldHash(tx,ty)%6,terrainCode:code,treeAsset:String(decor.treeAsset||""),treeScale:Math.max(.25,numberOr(decor.treeScale,1))};
    sceneryTrees.push(obj);if(decor.solid!==false)addSolidRect(obj.x+24,obj.y+38,16,19,"tree");
  }
}

const tile = new Proxy({}, {get(_target,key){const code=Number(key);return {walk:terrainIsWalkable(code)};}});

function tileAtWorld(px,py){
  const tx=Math.floor(px/TILE);
  const ty=Math.floor(py/TILE);
  if(tx<0||ty<0||tx>=WORLD_W||ty>=WORLD_H) return zoneBackdropTerrainCode();
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

function drawSandTile(x,y,variant=0,tx=0,ty=0){
  ctx.fillStyle="#c7a66a";
  ctx.fillRect(Math.floor(x)-1,Math.floor(y)-1,TILE+2,TILE+2);
  const seed=worldHash(tx*17+5,ty*23+11);
  ctx.fillStyle="rgba(120,86,48,.18)";
  for(let i=0;i<3;i++){
    const px=x+6+((seed+i*19)%51),py=y+8+(((seed>>2)+i*13)%45);
    ctx.fillRect(Math.round(px),Math.round(py),2+(i%2),1);
  }
}

function drawRockTile(x,y,variant=0,tx=0,ty=0){
  ctx.fillStyle="#66645f";
  ctx.fillRect(Math.floor(x)-1,Math.floor(y)-1,TILE+2,TILE+2);
  const seed=worldHash(tx*29+13,ty*31+7);
  ctx.fillStyle="rgba(38,38,36,.24)";
  ctx.fillRect(x+5+(seed%19),y+8+((seed>>2)%20),24,5);
  ctx.fillRect(x+24+((seed>>3)%17),y+36+((seed>>4)%14),25,4);
  ctx.fillStyle="rgba(203,199,187,.18)";
  ctx.fillRect(x+8+((seed>>1)%31),y+19+((seed>>5)%20),15,2);
}

function drawTerrainTreeImage(assetId,x,y,scale=1){
  const image=terrainImage(assetId);if(!assetId||!image||!image.complete||!image.naturalWidth||!image.naturalHeight)return false;
  const h=108*Math.max(.25,numberOr(scale,1)),w=h*(image.naturalWidth/image.naturalHeight);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,Math.round(x+32-w/2),Math.round(y+66-h),Math.round(w),Math.round(h));return true;
}
function drawTerrainTree(obj){if(!drawTerrainTreeImage(obj?.treeAsset,obj.x,obj.y,obj?.treeScale))drawTree(obj.x,obj.y,obj.variant||0);}
function drawWorldTerrainBase(code,x,y,variant=0,tx=0,ty=0){
  const def=terrainDef(code)||{},textureAsset=String(def.textureAsset||"");let textured=false;
  if(textureAsset)textured=drawRepeatingTerrainAsset(textureAsset,x,y,tx,ty,numberOr(def.textureScale,1));
  if(textured)return;
  const renderer=String(def.renderer||"grass");
  if(renderer==="water")drawWaterTile(x,y,variant,tx,ty);
  else if(renderer==="dirt")drawRoadTile(x,y,variant,tx,ty);
  else if(renderer==="sand")drawSandTile(x,y,variant,tx,ty);
  else if(renderer==="rock")drawRockTile(x,y,variant,tx,ty);
  else drawGrassTile(x,y,variant,tx,ty);
}
function drawWorldTerrainTile(code,x,y,variant=0,tx=0,ty=0){
  drawWorldTerrainBase(code,x,y,variant,tx,ty);
  const edge=terrainEdgeStyle(code);if(edge==="water")drawWaterEdgeOverlay(x,y,tx,ty);else if(edge==="road")drawRoadShapeOverlay(x,y,tx,ty);
}
function zoneBackdropTerrainId(){const requested=String((typeof window!=="undefined"&&window.LR_ZONE_SETTINGS?.backdropTerrainId)||"");return terrainLibrary()[requested]?requested:(terrainEntries()[0]?.[0]||"");}
function zoneBackdropTerrainCode(){return terrainCodeById(zoneBackdropTerrainId())??terrainDefaultCode();}
function drawZoneBackdrop(camX,camY,viewW,viewH){const code=zoneBackdropTerrainCode();const minX=Math.floor(camX/TILE)-2,maxX=Math.ceil((camX+viewW)/TILE)+2,minY=Math.floor(camY/TILE)-2,maxY=Math.ceil((camY+viewH)/TILE)+2;for(let ty=minY;ty<=maxY;ty++)for(let tx=minX;tx<=maxX;tx++){if(tx>=0&&ty>=0&&tx<WORLD_W&&ty<WORLD_H)continue;drawWorldTerrainTile(code,tx*TILE-camX,ty*TILE-camY,0,tx,ty);}}
function drawZoneBackdropDecor(camX,camY,viewW,viewH){const code=zoneBackdropTerrainCode(),decor=terrainDecoration(code);if(decor.type!=="tree")return;const density=clamp(numberOr(decor.densityPercent,0),0,100);const minX=Math.floor(camX/TILE)-3,maxX=Math.ceil((camX+viewW)/TILE)+3,minY=Math.floor(camY/TILE)-3,maxY=Math.ceil((camY+viewH)/TILE)+3;for(let ty=minY;ty<=maxY;ty++)for(let tx=minX;tx<=maxX;tx++){if(tx>=0&&ty>=0&&tx<WORLD_W&&ty<WORLD_H)continue;if(worldHash(tx,ty)%100>=density)continue;const ox=(worldHash(tx+31,ty+11)%15)-7,oy=(worldHash(tx+7,ty+41)%11)-5;const x=tx*TILE+ox-camX,y=ty*TILE+oy-camY;if(!drawTerrainTreeImage(String(decor.treeAsset||""),x,y,Math.max(.25,numberOr(decor.treeScale,1))))drawTree(x,y,worldHash(tx,ty)%6);}}

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

function drawTreeObject(obj,camX,camY){
  const drawObj={...obj,x:obj.x-camX,y:obj.y-camY};drawTerrainTree(drawObj);
}

function worldTypeAt(tx,ty){
  if(tx<0||ty<0||tx>=WORLD_W||ty>=WORLD_H) return zoneBackdropTerrainCode();
  return world[ty][tx];
}

function isRoadGround(t){
  return terrainEdgeStyle(t)==="road";
}

function paintTerrainClip(code,x,y,tx,ty,clipFn){
  ctx.save();ctx.beginPath();clipFn();ctx.clip();drawWorldTerrainBase(code,x,y,0,tx,ty);ctx.restore();
}
function roadCornerFillCode(tx,ty,dx,dy){
  const candidates=[worldTypeAt(tx+dx,ty+dy),worldTypeAt(tx+dx,ty),worldTypeAt(tx,ty+dy)];
  return candidates.find(code=>!isRoadGround(code))??terrainDefaultCode();
}
function drawRoadShapeOverlay(x,y,tx,ty){
  const n=isRoadGround(worldTypeAt(tx,ty-1));
  const s=isRoadGround(worldTypeAt(tx,ty+1));
  const w=isRoadGround(worldTypeAt(tx-1,ty));
  const e=isRoadGround(worldTypeAt(tx+1,ty));
  const r=18;

  if(!n && !w) paintTerrainClip(roadCornerFillCode(tx,ty,-1,-1),x,y,tx,ty,()=>ctx.rect(x,y,r,r));
  if(!n && !e) paintTerrainClip(roadCornerFillCode(tx,ty,1,-1),x,y,tx,ty,()=>ctx.rect(x+TILE-r,y,r,r));
  if(!s && !w) paintTerrainClip(roadCornerFillCode(tx,ty,-1,1),x,y,tx,ty,()=>ctx.rect(x,y+TILE-r,r,r));
  if(!s && !e) paintTerrainClip(roadCornerFillCode(tx,ty,1,1),x,y,tx,ty,()=>ctx.rect(x+TILE-r,y+TILE-r,r,r));

  // Soft pixel edge gives the road a laid-in-world look instead of a square stamp.
  ctx.fillStyle="rgba(78,52,31,.20)";
  if(!n) ctx.fillRect(x+16,y+1,32,2);
  if(!s) ctx.fillRect(x+16,y+TILE-3,32,2);
  if(!w) ctx.fillRect(x+1,y+16,2,32);
  if(!e) ctx.fillRect(x+TILE-3,y+16,2,32);
}

function drawWaterEdgeOverlay(x,y,tx,ty){
  const n=terrainEdgeStyle(worldTypeAt(tx,ty-1))==="water";
  const s=terrainEdgeStyle(worldTypeAt(tx,ty+1))==="water";
  const w=terrainEdgeStyle(worldTypeAt(tx-1,ty))==="water";
  const e=terrainEdgeStyle(worldTypeAt(tx+1,ty))==="water";
  const depth=(edge,i)=>5+(worldHash(tx*43+i*11+(edge===1?101:edge===2?203:edge===3?307:409),ty*47+i*13)%7);

  // Let the real grass texture overlap the water in a jagged pixel shoreline.
  // Collision still uses the unchanged water tiles; this is visual only.
  if(!n) paintTerrainClip(worldTypeAt(tx,ty-1),x,y,tx,ty,()=>{
    ctx.moveTo(x,y);ctx.lineTo(x+TILE,y);
    for(let i=4;i>=0;i--) ctx.lineTo(x+i*16,y+depth(1,i));
    ctx.closePath();
  });
  if(!s) paintTerrainClip(worldTypeAt(tx,ty+1),x,y,tx,ty,()=>{
    ctx.moveTo(x,y+TILE);ctx.lineTo(x+TILE,y+TILE);
    for(let i=4;i>=0;i--) ctx.lineTo(x+i*16,y+TILE-depth(2,i));
    ctx.closePath();
  });
  if(!w) paintTerrainClip(worldTypeAt(tx-1,ty),x,y,tx,ty,()=>{
    ctx.moveTo(x,y);ctx.lineTo(x,y+TILE);
    for(let i=4;i>=0;i--) ctx.lineTo(x+depth(3,i),y+i*16);
    ctx.closePath();
  });
  if(!e) paintTerrainClip(worldTypeAt(tx+1,ty),x,y,tx,ty,()=>{
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

function npcSpriteAssetRecord(npc){
  const assets=(typeof window!=="undefined"&&window.LR_ASSETS)||{};
  if(npc?.spriteAsset&&assets[npc.spriteAsset]) return assets[npc.spriteAsset];
  const path=String(npc?.sprite||"").replace(/^\.\//,"");
  if(!path) return null;
  for(const asset of Object.values(assets))if(asset?.type==="npcSprite"&&String(asset.path||"").replace(/^\.\//,"")===path)return asset;
  return null;
}

function npcQuestMarker(npc){
  if(typeof getNpcQuestMarkerInfo==="function") return getNpcQuestMarkerInfo(npc?.id);
  if(typeof getNpcQuestMarker!=="function") return null;
  const symbol=getNpcQuestMarker(npc?.id)||"";
  return symbol?{symbol,kind:symbol==="?"?"ready":"available"}:null;
}

function npcFacingForRender(npc){
  if(npc&&typeof activeNpcDialogId!=="undefined"&&activeNpcDialogId===npc.id&&state){
    return vectorFacing(state.x-npc.x,state.y-npc.y,npc.facing||"down");
  }
  return npc?.facing||"down";
}

function drawNpcObject(obj,camX,camY){
  const x=Math.round(obj.x-camX), y=Math.round(obj.y-camY);
  const asset=npcSpriteAssetRecord(obj),facingRows=asset?.spriteLayout?.directionRows||{down:0,right:1,left:2,up:3};
  const row=facingRows[npcFacingForRender(obj)]??0;
  const spritePath=asset?.path?(String(asset.path).startsWith("./")?String(asset.path):`./${asset.path}`):obj.sprite;
  const image=npcSpriteImage(spritePath);
  const displayH=npcDisplayHeight(obj);
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
    // Emergency fallback if a sprite asset fails to load. It uses the same
    // per-NPC displayHeight as real sprite sheets so placeholder sizing stays consistent.
    const scale=displayH/18;
    ctx.translate(x,y+15);ctx.scale(scale,scale);ctx.translate(-x,-(y+15));
    ctx.fillStyle="#d9ad84"; ctx.fillRect(x-5,y-11,10,9);
    ctx.fillStyle="#5a3d2d"; ctx.fillRect(x-6,y-13,12,4); ctx.fillRect(x-6,y-9,2,5);
    ctx.fillStyle=obj.shirt||"#627e9b"; ctx.fillRect(x-6,y-2,12,10);
    ctx.fillStyle="#3b2e29"; ctx.fillRect(x-5,y+8,4,7); ctx.fillRect(x+1,y+8,4,7);
    ctx.fillStyle="#202020"; ctx.fillRect(x-3,y-7,1,1); ctx.fillRect(x+2,y-7,1,1);
    topY=y-18*scale;
  }

  const marker=npcQuestMarker(obj);
  if(marker?.symbol){
    const markerColor=marker.kind==="talk"?"#a8a7ae":marker.kind==="ready"?"#ffe17b":"#ffd45b";
    ctx.font="900 15px system-ui";ctx.textAlign="center";
    ctx.lineWidth=3;ctx.strokeStyle="rgba(35,24,15,.82)";ctx.strokeText(marker.symbol,x,topY-7);
    ctx.fillStyle=markerColor;ctx.fillText(marker.symbol,x,topY-7);ctx.textAlign="start";
  }
  ctx.restore();
}

function worldObjectSpriteImage(path){
  if(!path)return null;
  worldObjectSpriteImage.cache=worldObjectSpriteImage.cache||new Map();
  if(worldObjectSpriteImage.cache.has(path))return worldObjectSpriteImage.cache.get(path);
  const image=new Image();image.src=/^(?:data:|blob:|https?:|\.\/|\/)/.test(path)?path:`./${path}`;worldObjectSpriteImage.cache.set(path,image);return image;
}

function drawPropObject(obj,camX,camY){
  const x=Math.round(obj.x-camX),y=Math.round(obj.y-camY);
  const objectSpec=worldObjectSpec(obj)||{w:24,h:24,crop:null};
  const baseW=objectSpec.w,baseH=objectSpec.h,pScale=VISUAL_SCALE.props;
  ctx.save();ctx.imageSmoothingEnabled=false;
  if(pScale!==1){ctx.translate(x+baseW/2,y+baseH);ctx.scale(pScale,pScale);ctx.translate(-(x+baseW/2),-(y+baseH));}
  const path=worldObjectSpritePath(obj),image=worldObjectSpriteImage(path),crop=objectSpec.crop;
  if(image?.complete&&image.naturalWidth){
    if(crop){
      const sx=Math.max(0,numberOr(crop.x,0)),sy=Math.max(0,numberOr(crop.y,0)),sw=Math.max(1,numberOr(crop.w,image.naturalWidth)),sh=Math.max(1,numberOr(crop.h,image.naturalHeight));
      ctx.drawImage(image,sx,sy,sw,sh,x,y,baseW,baseH);
    }else ctx.drawImage(image,x,y,baseW,baseH);
    ctx.restore();return;
  }
  ctx.fillStyle="rgba(77,64,85,.75)";ctx.fillRect(x,y,baseW,baseH);
  ctx.strokeStyle="rgba(220,205,230,.65)";ctx.strokeRect(x+.5,y+.5,baseW-1,baseH-1);
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
  const camera=developerCameraFrame(vw,vh);
  const zoom=camera.zoom,viewW=camera.viewW,viewH=camera.viewH,camX=camera.camX,camY=camera.camY;

  ctx.fillStyle="#1f2a23";
  ctx.fillRect(0,0,vw,vh);

  ctx.save();
  ctx.scale(zoom,zoom);
  drawZoneBackdrop(camX,camY,viewW,viewH);

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

      drawWorldTerrainTile(t,sx,sy,variant,x,y);
    }
  }
  drawZoneBackdropDecor(camX,camY,viewW,viewH);

  // Y-sort scenery, mobs, and the player so overlap feels like an RPG world.
  resetWorldRenderables();

  for(const tree of sceneryTrees){
    const sx=tree.x-camX, sy=tree.y-camY;
    if(sx<-120||sy<-130||sx>viewW+120||sy>viewH+90) continue;
    queueWorldRenderable("tree",tree.y+58,tree);
  }

  for(const prop of sceneryProps){
    if(typeof worldObjectIsHiddenByInteraction==="function"&&worldObjectIsHiddenByInteraction(prop)) continue;
    const sx=prop.x-camX, sy=prop.y-camY;
    if(sx<-180||sy<-180||sx>viewW+180||sy>viewH+180) continue;
    queueWorldRenderable("prop",worldObjectRenderDepth(prop,state.y),prop);
  }
  for(const npc of sceneryNPCs){
    const sx=npc.x-camX, sy=npc.y-camY;
    if(sx<-60||sy<-80||sx>viewW+60||sy>viewH+60) continue;
    queueWorldRenderable("npc",npcRenderDepth(npc,state.y),npc);
  }

  for(const pile of lootPiles){
    const sx=pile.x-camX, sy=pile.y-camY;
    if(sx<-70||sy<-70||sx>viewW+70||sy>viewH+70) continue;
    queueWorldRenderable("lootPile",lootRemnantRenderDepth(pile,state.y),pile);
  }

  if(devModeActive && devSelectedRemnant && devRemnantPreview){
    const sx=devRemnantPreview.x-camX, sy=devRemnantPreview.y-camY;
    if(sx>=-90&&sy>=-90&&sx<=viewW+90&&sy<=viewH+90){
      queueWorldRenderable("devLootPile",lootRemnantRenderDepth(devRemnantPreview,state.y),devRemnantPreview);
    }
  }

  for(const mob of mobs){
    if(!mob.alive) continue;
    const sx=mob.x-camX, sy=mob.y-camY;
    if(sx<-60||sy<-60||sx>viewW+60||sy>viewH+60) continue;
    queueWorldRenderable("mob",mob.y,mob);
  }

  queueWorldRenderable("hero",state.y,null);
  visibleWorldRenderables.sort((a,b)=>a.depth-b.depth);

  for(const item of visibleWorldRenderables){
    if(item.kind==="tree"){
      drawTreeObject(item.obj,camX,camY);
    }else if(item.kind==="prop"){
      drawPropObject(item.obj,camX,camY);
    }else if(item.kind==="npc"){
      drawNpcObject(item.obj,camX,camY);
    }else if(item.kind==="lootPile" || item.kind==="devLootPile"){
      drawLootPile(ctx,item.obj,camX,camY);
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
      let hx=state.x-camX,hy=state.y-camY;
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
  if(typeof drawWorldInteractionHint==="function") drawWorldInteractionHint(camX,camY);

  if(devModeActive) drawDeveloperOverlay(camX,camY,viewW,viewH);
  ctx.restore();
}

function healingTerrainEvent(code){
  if(enemy)return;if(combatTarget)disengageCombat(false);if(state.hp<state.maxHp){state.hp=state.maxHp;toast(`${terrainDef(code)?.name||"Safe terrain"} restored your HP.`);updateUI();}
}
