const BALANCE = window.LR_BALANCE || {};

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

const game = document.getElementById("game");
const ctx = game.getContext("2d");
const heroCanvas = document.getElementById("heroBattleSprite");
const heroCtx = heroCanvas.getContext("2d");
const enemyCanvas = document.getElementById("enemyBattleSprite");
const enemyCtx = enemyCanvas.getContext("2d");

const playerSheet = new Image();
playerSheet.src = "./assets/characters/player.png";
let playerSheetReady = playerSheet.complete && playerSheet.naturalWidth > 0;
playerSheet.onload = () => { playerSheetReady = true; };

const slimeSheet = new Image();
slimeSheet.src = "./assets/mobs/slime.png";
let slimeSheetReady = slimeSheet.complete && slimeSheet.naturalWidth > 0;
slimeSheet.onload = () => { slimeSheetReady = true; };

const wolfSheet = new Image();
wolfSheet.src = "./assets/mobs/wolf.png";
let wolfSheetReady = wolfSheet.complete && wolfSheet.naturalWidth > 0;
wolfSheet.onload = () => { wolfSheetReady = true; };

const goblinSheet = new Image();
goblinSheet.src = "./assets/mobs/goblin.png";
let goblinSheetReady = goblinSheet.complete && goblinSheet.naturalWidth > 0;
goblinSheet.onload = () => { goblinSheetReady = true; };

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

const houseAImage = new Image();
houseAImage.src = "./assets/buildings/house-a.png";
let houseAReady = houseAImage.complete && houseAImage.naturalWidth > 0;
houseAImage.onload = () => { houseAReady = true; };

const houseBImage = new Image();
houseBImage.src = "./assets/buildings/house-b.png";
let houseBReady = houseBImage.complete && houseBImage.naturalWidth > 0;
houseBImage.onload = () => { houseBReady = true; };

const HOUSE_SPECS = {
  A:{image:houseAImage, ready:()=>houseAReady, w:118, h:91, footprint:{x:12,y:66,w:94,h:23}},
  B:{image:houseBImage, ready:()=>houseBReady, w:128, h:89, footprint:{x:8,y:67,w:112,h:20}}
};





const TILE = 64;
const WORLD_W = 28;
const WORLD_H = 20;
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
