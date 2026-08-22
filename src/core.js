const BALANCE = window.LR_BALANCE || {};
const PROJECT_WORLD_OBJECTS = window.LR_WORLD_OBJECTS || [];
const PROJECT_NPCS = window.LR_NPCS || [];
const PROJECT_QUESTS = window.LR_QUESTS || [];
const PROJECT_OBJECT_DEFINITIONS = window.LR_OBJECT_DEFINITIONS || {};
const VISUAL_CONFIG = window.LR_VISUAL || {};

const VISUAL_SCALE_MIN = 0.25;
const VISUAL_SCALE_MAX = 3.0;

function visualScaleOr(value,fallback=1){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(VISUAL_SCALE_MIN,Math.min(VISUAL_SCALE_MAX,n)):fallback;
}

const VISUAL_SCALE = {
  player: visualScaleOr(VISUAL_CONFIG.player,1.20),
  npcs: visualScaleOr(VISUAL_CONFIG.npcs,1.10),
  props: visualScaleOr(VISUAL_CONFIG.props,1.00)
};
const PROJECT_VISUAL_SCALE = {...VISUAL_SCALE};

// Canonical Little Realm world-size reference. Mob art can come from any source
// resolution; the renderer normalizes visible sprite height to these world units.
const LR_PLAYER_REFERENCE_HEIGHT = 22;
const MOB_SIZE_CLASS_HEIGHTS = Object.freeze({
  tiny:13,
  small:18,
  medium:24,
  large:35,
  huge:50,
  boss:74
});
const MOB_SIZE_CLASS_LABELS = Object.freeze({tiny:"Tiny",small:"Small",medium:"Medium",large:"Large",huge:"Huge",boss:"Boss",custom:"Custom"});
function mobSizeClassHeight(sizeClass,fallback=MOB_SIZE_CLASS_HEIGHTS.medium){
  return Math.max(8,numberOr(MOB_SIZE_CLASS_HEIGHTS[String(sizeClass||"").toLowerCase()],fallback));
}
function nearestMobSizeClass(height){
  const target=Math.max(8,numberOr(height,MOB_SIZE_CLASS_HEIGHTS.medium));
  let best="medium",bestDelta=Infinity;
  for(const [key,value] of Object.entries(MOB_SIZE_CLASS_HEIGHTS)){const delta=Math.abs(target-value);if(delta<bestDelta){best=key;bestDelta=delta;}}
  return best;
}
function mobRelativePlayerScale(height){return Math.max(.1,numberOr(height,MOB_SIZE_CLASS_HEIGHTS.medium)/LR_PLAYER_REFERENCE_HEIGHT);}

function numberOr(value,fallback){
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}
function percentOr(value,fallbackPercent){
  return clamp(numberOr(value,fallbackPercent),0,100)/100;
}
function booleanOr(value,fallback){
  return typeof value==="boolean"?value:fallback;
}

function playerLevelCap(){
  return Math.max(1,Math.floor(numberOr(BALANCE.progression?.levelCap,100)));
}

function xpRequiredForLevel(level){
  const lv=Math.max(1,Math.floor(numberOr(level,1)));
  const cap=playerLevelCap();
  if(lv>=cap) return 0;
  const table=BALANCE.progression?.xpToNextLevel;
  if(Array.isArray(table)){
    const listed=Number(table[lv-1]);
    if(Number.isFinite(listed)&&listed>0) return Math.floor(listed);
  }
  throw new Error(`Missing XP requirement for level ${lv}. Update config/game-balance.js.`);
}

function standardMobXpForLevel(level){
  const lv=Math.max(1,Math.floor(numberOr(level,1)));
  const base=Math.max(1,numberOr(BALANCE.progression?.sameLevelMobXpBase,50));
  const perLevel=Math.max(0,numberOr(BALANCE.progression?.sameLevelMobXpPerLevel,5));
  return Math.max(1,Math.round(base+(lv-1)*perLevel));
}

function standardMobBaselineStatsForLevel(level){
  const lv=Math.max(1,Math.floor(numberOr(level,1)));
  const cfg=BALANCE.mobLevels||{};
  const steps=lv-1;
  return {
    hp:Math.max(1,Math.round(numberOr(cfg.baselineHpAtLevel1,18)+steps*numberOr(cfg.baselineHpPerLevel,8))),
    attack:Math.max(1,Math.round(numberOr(cfg.baselineAttackAtLevel1,3)+steps*numberOr(cfg.baselineAttackPerLevel,2))),
    defense:Math.max(0,Math.round(numberOr(cfg.baselineDefenseAtLevel1,0)+steps*numberOr(cfg.baselineDefensePerLevel,.75))),
    xp:standardMobXpForLevel(lv)
  };
}

function overlayIsShown(id){
  return !!document.getElementById(id)?.classList.contains("show");
}

function isGameplayModalOpen(){
  // Inventory, loot, quest log, NPC conversations, and object quest offers are
  // movable non-modal windows. Only true confirmation/menu dialogs stop play.
  return startupFlowActive || overlayIsShown("menu") || overlayIsShown("disposePrompt");
}

function isLootInteractionOpen(){
  // Loot can remain open while the world keeps running. Disposal confirmation
  // is still modal so an item cannot be lost while combat advances behind it.
  return overlayIsShown("disposePrompt");
}

const game = document.getElementById("game");
const ctx = game.getContext("2d");
const heroCanvas = document.getElementById("heroBattleSprite");
const heroCtx = heroCanvas.getContext("2d");
const enemyCanvas = document.getElementById("enemyBattleSprite");
const enemyCtx = enemyCanvas.getContext("2d");

const SPRITE_FRAME_META = new WeakMap();

function buildSpriteFrameMeta(image){
  if(!image || !image.naturalWidth || !image.naturalHeight) return null;
  try{
    const canvas=document.createElement("canvas");
    canvas.width=image.naturalWidth;
    canvas.height=image.naturalHeight;
    const c=canvas.getContext("2d",{willReadFrequently:true});
    c.clearRect(0,0,canvas.width,canvas.height);
    c.drawImage(image,0,0);
    const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;
    const frames=[];
    for(let row=0;row<4;row++){
      frames[row]=[];
      const sy0=Math.round(row*canvas.height/4);
      const sy1=Math.round((row+1)*canvas.height/4);
      for(let col=0;col<4;col++){
        const sx0=Math.round(col*canvas.width/4);
        const sx1=Math.round((col+1)*canvas.width/4);
        let minX=sx1,minY=sy1,maxX=sx0-1,maxY=sy0-1;
        for(let py=sy0;py<sy1;py++){
          let idx=(py*canvas.width+sx0)*4+3;
          for(let px=sx0;px<sx1;px++,idx+=4){
            if(pixels[idx]>8){
              if(px<minX) minX=px;
              if(px>maxX) maxX=px;
              if(py<minY) minY=py;
              if(py>maxY) maxY=py;
            }
          }
        }
        if(maxX>=minX && maxY>=minY){
          frames[row][col]={
            sx:minX, sy:minY,
            sw:maxX-minX+1, sh:maxY-minY+1,
            cellW:sx1-sx0, cellH:sy1-sy0
          };
        }else{
          frames[row][col]={sx:sx0,sy:sy0,sw:sx1-sx0,sh:sy1-sy0,cellW:sx1-sx0,cellH:sy1-sy0};
        }
      }
    }
    SPRITE_FRAME_META.set(image,frames);
    return frames;
  }catch(err){
    console.warn("Could not analyze sprite frame bounds",err);
    return null;
  }
}

function spriteFrameMeta(image,row,col){
  const frames=SPRITE_FRAME_META.get(image) || buildSpriteFrameMeta(image);
  return frames?.[row]?.[col] || null;
}

const environmentAtlas = new Image();
environmentAtlas.src = "./assets/environment/environment-atlas.png";
let environmentAtlasReady = environmentAtlas.complete && environmentAtlas.naturalWidth > 0;
environmentAtlas.onload = () => { environmentAtlasReady = true; };
const ENV_ATLAS_CELL = 128;


const terrainTexture = new Image();
terrainTexture.src = "./assets/environment/terrain-seamless.png";
let terrainTextureReady = terrainTexture.complete && terrainTexture.naturalWidth > 0;
terrainTexture.onload = () => { terrainTextureReady = true; };

const waterTexture = new Image();
waterTexture.src = "./assets/environment/water-seamless.png";
let waterTextureReady = waterTexture.complete && waterTexture.naturalWidth > 0;
waterTexture.onload = () => { waterTextureReady = true; };


const TILE = 64;
const INITIAL_ZONE_SETTINGS = (typeof window!=="undefined"&&window.LR_ZONE_SETTINGS&&typeof window.LR_ZONE_SETTINGS==="object")?window.LR_ZONE_SETTINGS:{};
let WORLD_W = Math.max(12,Math.min(128,Math.floor(numberOr(INITIAL_ZONE_SETTINGS.width,44))));
let WORLD_H = Math.max(12,Math.min(96,Math.floor(numberOr(INITIAL_ZONE_SETTINGS.height,32))));
let START_TILE_X = Math.max(2,Math.min(WORLD_W-3,Math.floor(numberOr(INITIAL_ZONE_SETTINGS.startTileX,7))));
let START_TILE_Y = Math.max(2,Math.min(WORLD_H-3,Math.floor(numberOr(INITIAL_ZONE_SETTINGS.startTileY,7))));
let START_X = START_TILE_X*TILE+TILE/2;
let START_Y = START_TILE_Y*TILE+TILE/2;

function configureWorldDimensions(settings={}){
  WORLD_W=Math.max(12,Math.min(128,Math.floor(numberOr(settings.width,WORLD_W||44))));
  WORLD_H=Math.max(12,Math.min(96,Math.floor(numberOr(settings.height,WORLD_H||32))));
  START_TILE_X=Math.max(2,Math.min(WORLD_W-3,Math.floor(numberOr(settings.startTileX,START_TILE_X||7))));
  START_TILE_Y=Math.max(2,Math.min(WORLD_H-3,Math.floor(numberOr(settings.startTileY,START_TILE_Y||7))));
  START_X=START_TILE_X*TILE+TILE/2;
  START_Y=START_TILE_Y*TILE+TILE/2;
}
const HERO_SPEED = numberOr(BALANCE.player?.moveSpeed,180); // world pixels per second
const HERO_RADIUS = 5;
const MOB_RADIUS = 14;
const MOB_TRIGGER_DISTANCE = 22;

let state;
let enemy=null;
let currentMob=null;
let defending=false;
let battleLocked=false;
let toastTimer=null;
let lastFrame=performance.now();
let moveAnimTime=0;
let isHeroMoving=false;
let heroFacing='down';
let mobs=[];
let nextMobId=1;
let input={up:false,down:false,left:false,right:false};
  isHeroMoving=false;
let lastSafePos={x:0,y:0};
let terrainEffectCooldown=0;

function toast(msg){
  const el=document.getElementById("toast");
  el.textContent=msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove("show"),1800);
}

function rand(a,b){return Math.floor(Math.random()*(b-a+1))+a}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function dist(ax,ay,bx,by){return Math.hypot(ax-bx,ay-by)}

function roundedRect(c,x,y,w,h,r,fill){
  c.beginPath();
  c.roundRect(x,y,w,h,r);
  c.fillStyle=fill;
  c.fill();
}
