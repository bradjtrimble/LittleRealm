const BALANCE = window.LR_BALANCE || {};
const PROJECT_WORLD_OBJECTS = window.LR_WORLD_OBJECTS || [];
const PROJECT_NPCS = window.LR_NPCS || [];
const PROJECT_QUESTS = window.LR_QUESTS || [];
const VISUAL_CONFIG = window.LR_VISUAL || {};

const VISUAL_SCALE_MIN = 0.25;
const VISUAL_SCALE_MAX = 3.0;

function visualScaleOr(value,fallback=1){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(VISUAL_SCALE_MIN,Math.min(VISUAL_SCALE_MAX,n)):fallback;
}

const VISUAL_SCALE = {
  player: visualScaleOr(VISUAL_CONFIG.player,1.20),
  hostileMobs: visualScaleOr(VISUAL_CONFIG.hostileMobs,1.15),
  passiveMobs: visualScaleOr(VISUAL_CONFIG.passiveMobs,1.10),
  boss: visualScaleOr(VISUAL_CONFIG.boss,1.05),
  houses: visualScaleOr(VISUAL_CONFIG.houses,1.15),
  npcs: visualScaleOr(VISUAL_CONFIG.npcs,1.10),
  props: visualScaleOr(VISUAL_CONFIG.props,1.00)
};
const MOB_TYPE_SCALE = {
  slime: visualScaleOr(VISUAL_CONFIG.mobTypes?.slime,VISUAL_SCALE.hostileMobs),
  goblin: visualScaleOr(VISUAL_CONFIG.mobTypes?.goblin,VISUAL_SCALE.hostileMobs),
  wolf: visualScaleOr(VISUAL_CONFIG.mobTypes?.wolf,VISUAL_SCALE.hostileMobs),
  cow: visualScaleOr(VISUAL_CONFIG.mobTypes?.cow,VISUAL_SCALE.passiveMobs),
  pig: visualScaleOr(VISUAL_CONFIG.mobTypes?.pig,VISUAL_SCALE.passiveMobs),
  chicken: visualScaleOr(VISUAL_CONFIG.mobTypes?.chicken,VISUAL_SCALE.passiveMobs),
  snickers: visualScaleOr(VISUAL_CONFIG.mobTypes?.snickers,VISUAL_SCALE.boss)
};
const PROJECT_VISUAL_SCALE = {...VISUAL_SCALE};
const PROJECT_MOB_TYPE_SCALE = {...MOB_TYPE_SCALE};

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
  // Backward-compatible fallback for older imported balance files.
  const start=Math.max(1,Math.floor(numberOr(BALANCE.progression?.startingXpToLevel,400)));
  const growth=1+percentOr(BALANCE.progression?.xpRequirementGrowthPercent,35);
  let next=start;
  for(let i=1;i<lv;i++) next=Math.min(Number.MAX_SAFE_INTEGER,Math.floor(next*growth));
  return next;
}

function standardMobXpForLevel(level){
  const lv=Math.max(1,Math.floor(numberOr(level,1)));
  const base=Math.max(1,numberOr(BALANCE.progression?.sameLevelMobXpBase,50));
  const perLevel=Math.max(0,numberOr(BALANCE.progression?.sameLevelMobXpPerLevel,5));
  return Math.max(1,Math.round(base+(lv-1)*perLevel));
}

function overlayIsShown(id){
  return !!document.getElementById(id)?.classList.contains("show");
}

function isGameplayModalOpen(){
  // Backpack and loot are intentionally non-modal floating panels in v51.
  // Only true dialogs should stop movement/combat input.
  return overlayIsShown("menu") || overlayIsShown("disposePrompt") || overlayIsShown("npcDialog");
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

const playerSheet = new Image();
playerSheet.src = "./assets/characters/player.png";
let playerSheetReady = playerSheet.complete && playerSheet.naturalWidth > 0;
playerSheet.onload = () => { playerSheetReady = true; buildSpriteFrameMeta(playerSheet); };

const slimeSheet = new Image();
slimeSheet.src = "./assets/mobs/slime.png";
let slimeSheetReady = slimeSheet.complete && slimeSheet.naturalWidth > 0;
slimeSheet.onload = () => { slimeSheetReady = true; buildSpriteFrameMeta(slimeSheet); };

const wolfSheet = new Image();
wolfSheet.src = "./assets/mobs/wolf.png";
let wolfSheetReady = wolfSheet.complete && wolfSheet.naturalWidth > 0;
wolfSheet.onload = () => { wolfSheetReady = true; buildSpriteFrameMeta(wolfSheet); };

const goblinSheet = new Image();
goblinSheet.src = "./assets/mobs/goblin.png";
let goblinSheetReady = goblinSheet.complete && goblinSheet.naturalWidth > 0;
goblinSheet.onload = () => { goblinSheetReady = true; buildSpriteFrameMeta(goblinSheet); };

const bearSheet = new Image();
bearSheet.src = "./assets/mobs/bear.png";
let bearSheetReady = bearSheet.complete && bearSheet.naturalWidth > 0;
bearSheet.onload = () => { bearSheetReady = true; buildSpriteFrameMeta(bearSheet); };

const cowSheet = new Image();
cowSheet.src = "./assets/mobs/cow.png";
let cowSheetReady = cowSheet.complete && cowSheet.naturalWidth > 0;
cowSheet.onload = () => { cowSheetReady = true; buildSpriteFrameMeta(cowSheet); };

const pigSheet = new Image();
pigSheet.src = "./assets/mobs/pig.png";
let pigSheetReady = pigSheet.complete && pigSheet.naturalWidth > 0;
pigSheet.onload = () => { pigSheetReady = true; buildSpriteFrameMeta(pigSheet); };

const chickenSheet = new Image();
chickenSheet.src = "./assets/mobs/chicken.png";
let chickenSheetReady = chickenSheet.complete && chickenSheet.naturalWidth > 0;
chickenSheet.onload = () => { chickenSheetReady = true; buildSpriteFrameMeta(chickenSheet); };

const environmentAtlas = new Image();
environmentAtlas.src = "./assets/environment/environment-atlas.png";
let environmentAtlasReady = environmentAtlas.complete && environmentAtlas.naturalWidth > 0;
environmentAtlas.onload = () => { environmentAtlasReady = true; };
const ENV_ATLAS_CELL = 128;

const propAtlas = new Image();
propAtlas.src = "./assets/props/object-atlas.png";
let propAtlasReady = propAtlas.complete && propAtlas.naturalWidth > 0;
propAtlas.onload = () => { propAtlasReady = true; };
const PROP_ATLAS_CELL = 160;

const terrainTexture = new Image();
terrainTexture.src = "./assets/environment/terrain-seamless.png";
let terrainTextureReady = terrainTexture.complete && terrainTexture.naturalWidth > 0;
terrainTexture.onload = () => { terrainTextureReady = true; };

const waterTexture = new Image();
waterTexture.src = "./assets/environment/water-seamless.png";
let waterTextureReady = waterTexture.complete && waterTexture.naturalWidth > 0;
waterTexture.onload = () => { waterTextureReady = true; };

const houseAImage = new Image();
houseAImage.src = "./assets/buildings/house-a.png";
let houseAReady = houseAImage.complete && houseAImage.naturalWidth > 0;
houseAImage.onload = () => { houseAReady = true; };

const houseBImage = new Image();
houseBImage.src = "./assets/buildings/house-b.png";
let houseBReady = houseBImage.complete && houseBImage.naturalWidth > 0;
houseBImage.onload = () => { houseBReady = true; };

const caveEntranceImage = new Image();
caveEntranceImage.src = "./assets/environment/cave-entrance.png";
let caveEntranceReady = caveEntranceImage.complete && caveEntranceImage.naturalWidth > 0;
caveEntranceImage.onload = () => { caveEntranceReady = true; };

const HOUSE_SPECS = {
  A:{image:houseAImage, ready:()=>houseAReady, w:118, h:91, footprint:{x:12,y:66,w:94,h:23}},
  B:{image:houseBImage, ready:()=>houseBReady, w:128, h:89, footprint:{x:8,y:67,w:112,h:20}}
};





const TILE = 64;
const WORLD_W = 44;
const WORLD_H = 32;
const START_TILE_X = 7;
const START_TILE_Y = 7;
const START_X = START_TILE_X*TILE+TILE/2;
const START_Y = START_TILE_Y*TILE+TILE/2;
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
let townCooldown=0;
let castleCooldown=0;

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
