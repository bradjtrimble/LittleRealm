window.addEventListener("error", (event) => {
  console.error("Little Realm error:", event.error || event.message);
});

(() => {
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

// Little Realm audio runtime -------------------------------------------------
// Audio content is data-driven. The engine knows buses/events/positioning;
// project content decides which clips are assigned to zones, mobs, terrain,
// interactions, UI events, and world emitters.

const LR_AUDIO_PREF_KEY="little-realm-audio-prefs-v1";
const LR_AUDIO_BUSES=["music","ambience","sfx","ui"];
const LR_AUDIO_DEFAULT_PREFS=Object.freeze({master:1,music:.75,ambience:.65,sfx:.85,ui:.8,mute:false});
let lrAudioPrefs={...LR_AUDIO_DEFAULT_PREFS};
let lrAudioCtx=null,lrAudioMaster=null,lrAudioBusNodes={};
let lrAudioUnlocked=false;
let lrAudioBuffers=new Map();
let lrAudioBufferPromises=new Map();
let lrZoneAudio={music:null,ambience:null,pending:true};
let lrEmitterHandles=new Map();
let lrEmitterTick=0;
let lrFootstepTravel=0;
let lrFootstepLast={x:null,y:null};
let lrFootstepVariant=0;

function lrAudioClamp(v,min=0,max=1){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;}
function audioClipLibrary(){return window.LR_AUDIO_CLIPS||window.LR_SHARED_CONTENT?.audioClips||{};}
function audioSetLibrary(){return window.LR_AUDIO_SETS||window.LR_SHARED_CONTENT?.audioSets||{};}
function audioEventMap(){return window.LR_AUDIO_EVENTS||window.LR_SHARED_CONTENT?.audioEvents||{};}
function audioClipRecord(id){return id?audioClipLibrary()?.[id]||null:null;}
function audioClipPath(id){return String(audioClipRecord(id)?.path||"");}
function audioBusForClip(id,fallback="sfx"){
  const category=String(audioClipRecord(id)?.category||fallback).toLowerCase();
  return LR_AUDIO_BUSES.includes(category)?category:fallback;
}
function loadAudioPreferences(){
  try{const raw=JSON.parse(localStorage.getItem(LR_AUDIO_PREF_KEY)||"null");if(raw&&typeof raw==="object")lrAudioPrefs={...LR_AUDIO_DEFAULT_PREFS,...raw};}catch(_err){}
  for(const key of ["master",...LR_AUDIO_BUSES])lrAudioPrefs[key]=lrAudioClamp(lrAudioPrefs[key],0,1);
  lrAudioPrefs.mute=!!lrAudioPrefs.mute;
  return lrAudioPrefs;
}
function saveAudioPreferences(){try{localStorage.setItem(LR_AUDIO_PREF_KEY,JSON.stringify(lrAudioPrefs));}catch(_err){}}
function audioPreferences(){return {...lrAudioPrefs};}
function applyAudioPreferences(){
  if(lrAudioMaster)lrAudioMaster.gain.value=lrAudioPrefs.mute?0:lrAudioPrefs.master;
  for(const bus of LR_AUDIO_BUSES)if(lrAudioBusNodes[bus])lrAudioBusNodes[bus].gain.value=lrAudioPrefs[bus];
}
function setAudioPreference(key,value){
  if(key==="mute")lrAudioPrefs.mute=!!value;
  else if(key==="master"||LR_AUDIO_BUSES.includes(key))lrAudioPrefs[key]=lrAudioClamp(value,0,1);
  applyAudioPreferences();saveAudioPreferences();
}
function ensureAudioContext(){
  if(lrAudioCtx)return lrAudioCtx;
  const AudioContextCtor=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextCtor)return null;
  lrAudioCtx=new AudioContextCtor();
  lrAudioMaster=lrAudioCtx.createGain();
  lrAudioMaster.connect(lrAudioCtx.destination);
  for(const bus of LR_AUDIO_BUSES){const gain=lrAudioCtx.createGain();gain.connect(lrAudioMaster);lrAudioBusNodes[bus]=gain;}
  applyAudioPreferences();
  return lrAudioCtx;
}
async function unlockAudio(){
  const ctx=ensureAudioContext();if(!ctx)return false;
  try{if(ctx.state!=="running")await ctx.resume();lrAudioUnlocked=ctx.state==="running";}catch(_err){lrAudioUnlocked=false;}
  if(lrAudioUnlocked&&lrZoneAudio.pending){lrZoneAudio.pending=false;applyZoneAudioFromCurrentSettings();}
  return lrAudioUnlocked;
}
function bindAudioUnlock(){
  const unlock=()=>unlockAudio();
  window.addEventListener("pointerdown",unlock,{passive:true});
  window.addEventListener("keydown",unlock,{passive:true});
}
async function audioBufferForClip(id){
  if(lrAudioBuffers.has(id))return lrAudioBuffers.get(id);
  if(lrAudioBufferPromises.has(id))return lrAudioBufferPromises.get(id);
  const path=audioClipPath(id);if(!path)return null;
  const ctx=ensureAudioContext();if(!ctx)return null;
  const promise=fetch(`./${path}`).then(r=>{if(!r.ok)throw new Error(`${path} HTTP ${r.status}`);return r.arrayBuffer();}).then(bytes=>ctx.decodeAudioData(bytes)).then(buffer=>{lrAudioBuffers.set(id,buffer);lrAudioBufferPromises.delete(id);return buffer;}).catch(err=>{console.warn(`Audio '${id}' could not load`,err);lrAudioBufferPromises.delete(id);return null;});
  lrAudioBufferPromises.set(id,promise);return promise;
}
function audioSpatialValues(x,y,radius=420){
  if(!state||!Number.isFinite(Number(x))||!Number.isFinite(Number(y)))return {gain:1,pan:0};
  const r=Math.max(40,Number(radius)||420),dx=Number(x)-state.x,dy=Number(y)-state.y,d=Math.hypot(dx,dy);
  const gain=lrAudioClamp(1-d/r,0,1),pan=lrAudioClamp(dx/(r*.6),-1,1);
  return {gain,pan};
}
async function playAudioClip(id,{bus=null,volume=1,loop=false,x=null,y=null,radius=420,key="",fadeIn=0}={}){
  if(!id||!audioClipRecord(id))return null;
  const ctx=ensureAudioContext();if(!ctx)return null;if(ctx.state!=="running"&&!lrAudioUnlocked)return null;
  const buffer=await audioBufferForClip(id);if(!buffer)return null;
  const source=ctx.createBufferSource(),gainNode=ctx.createGain(),panner=typeof ctx.createStereoPanner==="function"?ctx.createStereoPanner():null;
  source.buffer=buffer;source.loop=!!loop;
  const clip=audioClipRecord(id),clipVolume=lrAudioClamp(clip.volume??1,0,2),spatial=audioSpatialValues(x,y,radius),baseVolume=lrAudioClamp(volume,0,2)*clipVolume;
  gainNode.gain.value=fadeIn>0?0:baseVolume*spatial.gain;
  if(panner){panner.pan.value=spatial.pan;source.connect(gainNode);gainNode.connect(panner);panner.connect(lrAudioBusNodes[bus||audioBusForClip(id)]||lrAudioBusNodes.sfx);}else{source.connect(gainNode);gainNode.connect(lrAudioBusNodes[bus||audioBusForClip(id)]||lrAudioBusNodes.sfx);}
  const handle={id,key,source,gainNode,panner,baseVolume,radius,x,y,loop:!!loop,stopped:false};
  source.onended=()=>{handle.stopped=true;};
  const now=ctx.currentTime;if(fadeIn>0){gainNode.gain.cancelScheduledValues(now);gainNode.gain.setValueAtTime(0,now);gainNode.gain.linearRampToValueAtTime(baseVolume*spatial.gain,now+fadeIn);}
  try{source.start();}catch(_err){return null;}
  return handle;
}
function stopAudioHandle(handle,fade=.15){
  if(!handle||handle.stopped)return;handle.stopped=true;const ctx=lrAudioCtx;
  try{if(ctx&&fade>0){const now=ctx.currentTime;handle.gainNode.gain.cancelScheduledValues(now);handle.gainNode.gain.setValueAtTime(handle.gainNode.gain.value,now);handle.gainNode.gain.linearRampToValueAtTime(0,now+fade);setTimeout(()=>{try{handle.source.stop();}catch(_e){}},Math.ceil(fade*1000)+20);}else handle.source.stop();}catch(_err){}
}
function updateSpatialHandle(handle,x=handle?.x,y=handle?.y,radius=handle?.radius){
  if(!handle||handle.stopped)return;handle.x=x;handle.y=y;handle.radius=radius;const spatial=audioSpatialValues(x,y,radius);handle.gainNode.gain.value=handle.baseVolume*spatial.gain;if(handle.panner)handle.panner.pan.value=spatial.pan;
}
function randomAudioSetClip(setId){
  const set=audioSetLibrary()?.[setId];const ids=(Array.isArray(set)?set:set?.clipIds)||[];const valid=ids.filter(id=>audioClipRecord(id));if(!valid.length)return "";
  const start=lrFootstepVariant++%valid.length;return valid[(start+Math.floor(Math.random()*valid.length))%valid.length]||valid[0];
}
function playAudioSet(setId,opts={}){const id=randomAudioSetClip(setId);return id?playAudioClip(id,{...opts,volume:(Number(audioSetLibrary()?.[setId]?.volume)||1)*(opts.volume??1)}):null;}
function playAudioEvent(eventId,opts={}){const ref=audioEventMap()?.[eventId];if(!ref)return null;return audioSetLibrary()?.[ref]?playAudioSet(ref,opts):playAudioClip(ref,opts);}
function playMobAudio(mob,eventId){
  const ref=mob?.template?.audio?.[eventId]||mob?.audio?.[eventId]||"";if(!ref)return null;
  const opts={bus:"sfx",volume:1,x:mob.x,y:mob.y,radius:Math.max(160,numberOr(mob?.template?.audioRadius,430))};return audioSetLibrary()?.[ref]?playAudioSet(ref,opts):playAudioClip(ref,opts);
}
function currentZoneAudioSettings(){return (window.LR_ZONE_SETTINGS&&typeof window.LR_ZONE_SETTINGS==="object")?window.LR_ZONE_SETTINGS:{};}
function startZoneLoop(kind,id,volume){
  const old=lrZoneAudio[kind];if(old?.id===id&&!old.stopped){old.baseVolume=lrAudioClamp(volume,0,2)*lrAudioClamp(audioClipRecord(id)?.volume??1,0,2);old.gainNode.gain.value=old.baseVolume;return;}
  if(old)stopAudioHandle(old,.5);lrZoneAudio[kind]=null;
  if(!id)return;
  playAudioClip(id,{bus:kind,volume:lrAudioClamp(volume,0,2),loop:true,fadeIn:.65}).then(handle=>{if(handle)lrZoneAudio[kind]=handle;});
}
function applyZoneAudioFromCurrentSettings(){
  if(!lrAudioUnlocked){lrZoneAudio.pending=true;return;}
  const z=currentZoneAudioSettings();startZoneLoop("music",String(z.musicId||""),numberOr(z.musicVolume,1));startZoneLoop("ambience",String(z.ambienceId||""),numberOr(z.ambienceVolume,1));
}
function resetFootstepTracking(){lrFootstepTravel=0;lrFootstepLast={x:state?.x??null,y:state?.y??null};}
function updateFootstepAudio(){
  if(!state)return;const x=state.x,y=state.y;if(!Number.isFinite(lrFootstepLast.x)){lrFootstepLast={x,y};return;}
  const moved=Math.hypot(x-lrFootstepLast.x,y-lrFootstepLast.y);lrFootstepLast={x,y};if(!isHeroMoving||moved<=.001)return;
  lrFootstepTravel+=moved;const threshold=15;if(lrFootstepTravel<threshold)return;lrFootstepTravel%=threshold;
  const terrain=terrainDef(tileAtWorld(x,y));const setId=String(terrain?.footstepSet||"");if(setId)playAudioSet(setId,{bus:"sfx",volume:numberOr(terrain?.footstepVolume,.55),x,y,radius:130});
}
function emitterConfigForObject(obj){
  const own=obj?.soundEmitter&&typeof obj.soundEmitter==="object"?obj.soundEmitter:null;const spec=typeof worldObjectDefinition==="function"?worldObjectDefinition(obj):null;const base=spec?.soundEmitter&&typeof spec.soundEmitter==="object"?spec.soundEmitter:null;const raw=own||base;if(!raw||!raw.clipId)return null;
  return {clipId:String(raw.clipId),volume:lrAudioClamp(raw.volume??.7,0,2),radius:Math.max(50,numberOr(raw.radius,420)),loop:raw.loop!==false};
}
function updateWorldAudioEmitters(dt){
  lrEmitterTick-=dt;if(lrEmitterTick>0)return;lrEmitterTick=.16;if(!state)return;
  const seen=new Set(),zone=currentWorldZoneId?.()||state.zoneId||"zone";
  for(const obj of sceneryProps||[]){const cfg=emitterConfigForObject(obj);if(!cfg)continue;const key=`${zone}:${obj.id||obj.objectId||obj.type||"obj"}`,spec=worldObjectSpec(obj)||{w:0,h:0},x=obj.x+numberOr(spec.w,0)/2,y=obj.y+numberOr(spec.h,0)/2,d=Math.hypot(x-state.x,y-state.y);seen.add(key);let handle=lrEmitterHandles.get(key);
    if(d<=cfg.radius*1.15){if(handle)updateSpatialHandle(handle,x,y,cfg.radius);else playAudioClip(cfg.clipId,{bus:"ambience",volume:cfg.volume,loop:cfg.loop,x,y,radius:cfg.radius,key}).then(h=>{if(h)lrEmitterHandles.set(key,h);});}
    else if(handle){stopAudioHandle(handle,.25);lrEmitterHandles.delete(key);}
  }
  for(const [key,handle] of lrEmitterHandles)if(!seen.has(key)){stopAudioHandle(handle,.2);lrEmitterHandles.delete(key);}
}
function stopWorldAudioEmitters(){for(const handle of lrEmitterHandles.values())stopAudioHandle(handle,.15);lrEmitterHandles.clear();}
function updateAudioRuntime(dt){updateFootstepAudio();updateWorldAudioEmitters(dt);}
function bindAudioSettingsControls(){
  const ids={master:"audioMaster",music:"audioMusic",ambience:"audioAmbience",sfx:"audioSfx",ui:"audioUi"};
  for(const [key,id] of Object.entries(ids)){const el=document.getElementById(id),out=document.getElementById(`${id}Value`);if(!el)continue;el.value=Math.round(lrAudioPrefs[key]*100);if(out)out.textContent=`${Math.round(lrAudioPrefs[key]*100)}%`;el.addEventListener("input",()=>{setAudioPreference(key,Number(el.value)/100);if(out)out.textContent=`${Math.round(Number(el.value))}%`;});}
  const mute=document.getElementById("audioMute");if(mute){mute.checked=lrAudioPrefs.mute;mute.addEventListener("change",()=>setAudioPreference("mute",mute.checked));}
}
function initializeAudioRuntime(){loadAudioPreferences();ensureAudioContext();bindAudioUnlock();bindAudioSettingsControls();resetFootstepTracking();lrZoneAudio.pending=true;}

// Slot-based backpack inventory. Drop systems should use addItem/removeItem instead of
// modifying state.inventory directly so stacking/capacity and drag rules stay centralized.
const ITEM_DEFS = window.LR_ITEMS || {};
const PLAYER_EQUIPMENT_SLOTS=Object.freeze(["head","chest","hands","back","legs","feet","mainHand","offHand"]);
const PLAYER_EQUIPMENT_LABELS=Object.freeze({head:"Head",chest:"Chest",hands:"Hands",back:"Back",legs:"Legs",feet:"Feet",mainHand:"Main Hand",offHand:"Off Hand"});
let normalizedEquipmentRef = null;

function normalizeEquipmentSlot(value){
  const raw=String(value||"").trim();
  const aliases={boots:"feet",boot:"feet",shoes:"feet",pants:"legs",trousers:"legs",helmet:"head",helm:"head",gloves:"hands",mainhand:"mainHand",offhand:"offHand",weapon:"mainHand",shield:"offHand"};
  const key=aliases[raw.toLowerCase()]||raw;
  return PLAYER_EQUIPMENT_SLOTS.includes(key)?key:"";
}
function createEmptyEquipment(){const out={};for(const slot of PLAYER_EQUIPMENT_SLOTS)out[slot]=null;return out;}
function createStarterEquipment(){
  const out=createEmptyEquipment(),defaults=window.LR_CHARACTER_DEFAULTS?.starterEquipment;
  if(!defaults||typeof defaults!=="object")return out;
  for(const slot of PLAYER_EQUIPMENT_SLOTS){const itemId=String(defaults[slot]||"");if(!itemId)continue;const def=getItemDefinition(itemId);if(def.equipmentSlot===slot)out[slot]=itemId;}
  return out;
}
function normalizeEquipment(value){
  const out=createEmptyEquipment(),source=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  for(const slot of PLAYER_EQUIPMENT_SLOTS){const itemId=String(source[slot]||"");if(!itemId)continue;const def=getItemDefinition(itemId);if(def.equipmentSlot===slot)out[slot]=itemId;}
  return out;
}
function ensureEquipmentState(){if(!state)return;if(state.equipment===normalizedEquipmentRef)return;state.equipment=normalizeEquipment(state.equipment);normalizedEquipmentRef=state.equipment;}
const INVENTORY_SLOT_COUNT = Math.max(1,Math.floor(numberOr(BALANCE.inventory?.slots,20)));
const INVENTORY_DEFAULT_STACK_LIMIT = Math.max(1,Math.floor(numberOr(BALANCE.inventory?.defaultStackLimit,99)));
let selectedInventorySlot = null;
let pendingDisposeSlot = null;
let inventoryPointerDrag = null;
let suppressInventoryClick = false;
let inventoryInteractionsBound = false;
let normalizedInventoryRef = null;

function createEmptyInventory(){
  return Array.from({length:INVENTORY_SLOT_COUNT},()=>null);
}

function getItemDefinition(itemId){
  const raw=ITEM_DEFS[itemId]||{};
  const fallbackName=String(itemId||"item")
    .replace(/[_-]+/g," ")
    .replace(/\b\w/g,ch=>ch.toUpperCase());
  return {
    id:itemId,
    name:typeof raw.name==="string"&&raw.name.trim()?raw.name:fallbackName,
    description:typeof raw.description==="string"?raw.description:"",
    symbol:typeof raw.symbol==="string"&&raw.symbol.trim()?raw.symbol.trim().slice(0,2):fallbackName.slice(0,1).toUpperCase(),
    icon:typeof raw.icon==="string"&&raw.icon.trim()?raw.icon.trim():"",
    stackLimit:normalizeEquipmentSlot(raw.equipmentSlot)?1:Math.max(1,Math.floor(numberOr(raw.stackLimit,INVENTORY_DEFAULT_STACK_LIMIT))),
    category:typeof raw.category==="string"&&raw.category.trim()?raw.category.trim():"Item",
    rarity:typeof raw.rarity==="string"&&raw.rarity.trim()?raw.rarity.trim():"Common",
    sellValue:Math.max(0,Math.floor(numberOr(raw.sellValue,0))),
    tags:Array.isArray(raw.tags)?raw.tags.filter(tag=>typeof tag==="string"&&tag.trim()).map(tag=>tag.trim()):[],
    equipmentSlot:normalizeEquipmentSlot(raw.equipmentSlot)
  };
}

function normalizeInventory(value){
  const normalized=createEmptyInventory();
  if(!Array.isArray(value)) return normalized;
  for(let i=0;i<Math.min(value.length,normalized.length);i++){
    const slot=value[i];
    if(!slot||typeof slot.id!=="string") continue;
    const qty=Math.max(0,Math.floor(numberOr(slot.qty,0)));
    if(qty<=0) continue;
    const def=getItemDefinition(slot.id);
    normalized[i]={id:slot.id,qty:Math.min(qty,def.stackLimit)};
  }
  return normalized;
}

function ensureInventoryState(){
  if(!state) return;
  // Inventory mutations are centralized in this module. Normalize only when a
  // new array enters state (new game/load) instead of reallocating every slot
  // during routine count/capacity queries.
  if(state.inventory===normalizedInventoryRef) return;
  state.inventory=normalizeInventory(state.inventory);
  normalizedInventoryRef=state.inventory;
}

function getInventoryUsedSlots(){
  ensureInventoryState();
  return state.inventory.reduce((n,slot)=>n+(slot?1:0),0);
}

function getItemCount(itemId){
  ensureInventoryState();
  return state.inventory.reduce((sum,slot)=>sum+(slot&&slot.id===itemId?slot.qty:0),0);
}

function getInventoryCapacityFor(itemId){
  ensureInventoryState();
  const def=getItemDefinition(itemId);
  let capacity=0;
  for(const slot of state.inventory){
    if(!slot) capacity+=def.stackLimit;
    else if(slot.id===itemId) capacity+=Math.max(0,def.stackLimit-slot.qty);
  }
  return capacity;
}

function canAddItem(itemId,qty=1){
  const amount=Math.max(0,Math.floor(numberOr(qty,0)));
  return getInventoryCapacityFor(itemId)>=amount;
}

function refreshInventoryViews(){
  updateBackpackHud();
  if(document.getElementById("backpack")?.classList.contains("show")) renderInventory();
  if(document.getElementById("lootWindow")?.classList.contains("show") && typeof renderLootInventory==="function") renderLootInventory();
  if(typeof refreshQuestUI==="function") refreshQuestUI();
}

function addItem(itemId,qty=1){
  ensureInventoryState();
  const def=getItemDefinition(itemId);
  let remaining=Math.max(0,Math.floor(numberOr(qty,0)));
  const requested=remaining;
  if(!itemId||remaining<=0) return {added:0,remaining:requested,full:false};

  // Fill existing stacks first.
  for(const slot of state.inventory){
    if(remaining<=0) break;
    if(!slot||slot.id!==itemId||slot.qty>=def.stackLimit) continue;
    const moved=Math.min(remaining,def.stackLimit-slot.qty);
    slot.qty+=moved;
    remaining-=moved;
  }

  // Then consume empty slots.
  for(let i=0;i<state.inventory.length&&remaining>0;i++){
    if(state.inventory[i]) continue;
    const moved=Math.min(remaining,def.stackLimit);
    state.inventory[i]={id:itemId,qty:moved};
    remaining-=moved;
  }

  const added=requested-remaining;
  refreshInventoryViews();
  return {added,remaining,full:remaining>0};
}

function removeItem(itemId,qty=1){
  ensureInventoryState();
  let remaining=Math.max(0,Math.floor(numberOr(qty,0)));
  const requested=remaining;
  for(let i=state.inventory.length-1;i>=0&&remaining>0;i--){
    const slot=state.inventory[i];
    if(!slot||slot.id!==itemId) continue;
    const moved=Math.min(remaining,slot.qty);
    slot.qty-=moved;
    remaining-=moved;
    if(slot.qty<=0) state.inventory[i]=null;
  }
  const removed=requested-remaining;
  refreshInventoryViews();
  return removed;
}

// Place an external item stack into a specific backpack slot. This is used by
// the loot window so a drag can target the exact slot the player chose.
function placeItemInInventorySlot(itemId,qty,targetIndex){
  ensureInventoryState();
  const index=Math.floor(numberOr(targetIndex,-1));
  const requested=Math.max(0,Math.floor(numberOr(qty,0)));
  if(!itemId||requested<=0||index<0||index>=state.inventory.length){
    return {added:0,remaining:requested,blocked:true};
  }

  const def=getItemDefinition(itemId);
  const target=state.inventory[index];
  if(target&&target.id!==itemId) return {added:0,remaining:requested,blocked:true};

  const room=target?Math.max(0,def.stackLimit-target.qty):def.stackLimit;
  const moved=Math.min(requested,room);
  if(moved>0){
    if(target) target.qty+=moved;
    else state.inventory[index]={id:itemId,qty:moved};
  }
  refreshInventoryViews();
  return {added:moved,remaining:requested-moved,blocked:moved<=0};
}

// Dragging one backpack slot onto another swaps different items, moves into an
// empty slot, or combines matching stacks up to the item's stack limit.
function moveInventorySlot(fromIndex,toIndex){
  ensureInventoryState();
  const from=Math.floor(numberOr(fromIndex,-1));
  const to=Math.floor(numberOr(toIndex,-1));
  if(from<0||to<0||from>=state.inventory.length||to>=state.inventory.length||from===to) return false;
  const source=state.inventory[from];
  if(!source) return false;
  const target=state.inventory[to];

  if(!target){
    state.inventory[to]=source;
    state.inventory[from]=null;
  }else if(target.id===source.id){
    const def=getItemDefinition(source.id);
    const moved=Math.min(source.qty,Math.max(0,def.stackLimit-target.qty));
    if(moved<=0) return false;
    target.qty+=moved;
    source.qty-=moved;
    if(source.qty<=0) state.inventory[from]=null;
  }else{
    state.inventory[to]=source;
    state.inventory[from]=target;
  }

  if(selectedInventorySlot===from) selectedInventorySlot=to;
  else if(selectedInventorySlot===to) selectedInventorySlot=from;
  refreshInventoryViews();
  return true;
}

function discardInventorySlot(index){
  ensureInventoryState();
  const i=Math.floor(numberOr(index,-1));
  if(i<0||i>=state.inventory.length||!state.inventory[i]) return null;
  const discarded={...state.inventory[i]};
  state.inventory[i]=null;
  if(selectedInventorySlot===i) selectedInventorySlot=null;
  refreshInventoryViews();
  return discarded;
}


function equipInventorySlot(index){
  ensureInventoryState();ensureEquipmentState();
  const i=Math.floor(numberOr(index,-1)),source=i>=0&&i<state.inventory.length?state.inventory[i]:null;if(!source)return false;
  const def=getItemDefinition(source.id),slot=def.equipmentSlot;if(!slot)return false;
  const previous=state.equipment[slot];
  source.qty-=1;if(source.qty<=0)state.inventory[i]=null;
  state.equipment[slot]=source.id;
  if(previous){
    if(!state.inventory[i])state.inventory[i]={id:previous,qty:1};
    else{const result=addItem(previous,1);if(result.remaining){state.equipment[slot]=previous;state.inventory[i]=source;toast?.("Your backpack is full.");return false;}}
  }
  refreshInventoryViews();toast?.(`Equipped ${def.name}.`);return true;
}
function unequipEquipmentSlot(slotName){
  ensureInventoryState();ensureEquipmentState();const slot=normalizeEquipmentSlot(slotName),itemId=slot?state.equipment[slot]:null;if(!itemId)return false;
  if(!canAddItem(itemId,1)){toast?.("Your backpack is full.");return false;}
  state.equipment[slot]=null;addItem(itemId,1);refreshInventoryViews();toast?.(`Unequipped ${getItemDefinition(itemId).name}.`);return true;
}
function renderEquipmentGrid(){
  const root=document.getElementById("equipmentGrid");if(!root||!state)return;ensureEquipmentState();
  root.innerHTML=PLAYER_EQUIPMENT_SLOTS.map(slot=>{const itemId=state.equipment[slot],def=itemId?getItemDefinition(itemId):null;return `<button class="equipmentSlot${itemId?' filled':''}" data-equipment-slot="${slot}" title="${inventoryEscape(itemId?`${PLAYER_EQUIPMENT_LABELS[slot]}: ${def.name} (click to unequip)`:PLAYER_EQUIPMENT_LABELS[slot])}">${itemId?itemVisualMarkup(def,"equipmentIcon","equipmentSymbol"):'<span class="equipmentEmpty">+</span>'}<small>${PLAYER_EQUIPMENT_LABELS[slot]}</small></button>`;}).join("");
}
function handleEquipmentGridClick(event){const button=event.target.closest?.("[data-equipment-slot]");if(button)unequipEquipmentSlot(button.dataset.equipmentSlot);}
function handleInventoryGridDoubleClick(event){const slot=event.target.closest?.(".inventorySlot[data-slot]");if(slot)equipInventorySlot(Number(slot.dataset.slot));}

function inventoryEscape(value){
  return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

function itemVisualMarkup(def,iconClass="itemIcon",symbolClass="itemSymbol"){
  return def.icon
    ?`<img class="${iconClass}" src="${inventoryEscape(def.icon)}" alt="" aria-hidden="true">`
    :`<span class="${symbolClass}">${inventoryEscape(def.symbol)}</span>`;
}

function updateBackpackHud(){
  if(!state) return;
  ensureInventoryState();
  const used=getInventoryUsedSlots();
  const counter=document.getElementById("backpackCount");
  if(counter) counter.textContent=`${used}/${INVENTORY_SLOT_COUNT}`;
  const panelCounter=document.getElementById("inventoryCapacity");
  if(panelCounter) panelCounter.textContent=`${used} / ${INVENTORY_SLOT_COUNT}`;
  const lootCounter=document.getElementById("lootInventoryCapacity");
  if(lootCounter) lootCounter.textContent=`${used} / ${INVENTORY_SLOT_COUNT}`;
}

function renderInventoryGrid(grid){
  if(!grid||!state) return;
  ensureInventoryState();
  grid.innerHTML=state.inventory.map((slot,index)=>{
    if(!slot){
      return `<button class="inventorySlot empty" data-slot="${index}" aria-label="Empty inventory slot ${index+1}"><span class="slotNumber">${index+1}</span></button>`;
    }
    const def=getItemDefinition(slot.id);
    const selected=grid.id==="inventoryGrid"&&selectedInventorySlot===index?" selected":"";
    return `<button class="inventorySlot${selected}" data-slot="${index}" aria-label="${inventoryEscape(def.name)}, quantity ${slot.qty}">${itemVisualMarkup(def)}<span class="itemQty">${slot.qty}</span></button>`;
  }).join("");
}

function renderInventory(){
  if(!state) return;
  const grid=document.getElementById("inventoryGrid");
  if(!grid) return;
  renderEquipmentGrid();
  renderInventoryGrid(grid);
  updateBackpackHud();
  renderInventoryDetails();
}

function renderInventoryDetails(){
  const details=document.getElementById("inventoryDetails");
  if(!details||!state) return;
  ensureInventoryState();
  const slot=selectedInventorySlot==null?null:state.inventory[selectedInventorySlot];
  if(!slot){
    details.innerHTML='<div class="inventoryDetailEmpty">Select an item to inspect it.</div>';
    return;
  }
  const def=getItemDefinition(slot.id);
  const valueText=def.sellValue>0?` • Value ${def.sellValue}g`:"";
  const detailIcon=itemVisualMarkup(def,"detailIcon","detailSymbol");
  details.innerHTML=`<div class="inventoryDetailTitle">${detailIcon}<span>${inventoryEscape(def.name)}</span><b>×${slot.qty}</b></div><div class="inventoryDetailMeta">${inventoryEscape(def.category)} • ${inventoryEscape(def.rarity)} • Stack ${slot.qty}/${def.stackLimit}${valueText}</div><div class="inventoryDetailDescription">${inventoryEscape(def.description||"No description yet.")}</div>`;
}

function selectInventorySlot(index){
  ensureInventoryState();
  const i=Math.floor(numberOr(index,-1));
  selectedInventorySlot=(i>=0&&i<state.inventory.length&&state.inventory[i])?i:null;
  renderInventory();
}

function handleInventoryGridClick(event){
  if(suppressInventoryClick){
    event.preventDefault?.();
    return;
  }
  const slot=event.target.closest?.("[data-slot]");
  if(slot) selectInventorySlot(Number(slot.dataset.slot));
}

function requestDisposeInventorySlot(index){
  ensureInventoryState();
  const i=Math.floor(numberOr(index,-1));
  const slot=i>=0&&i<state.inventory.length?state.inventory[i]:null;
  if(!slot) return false;
  pendingDisposeSlot=i;
  const def=getItemDefinition(slot.id);
  const name=document.getElementById("disposeItemName");
  const description=document.getElementById("disposeItemText");
  if(name) name.textContent=`${slot.qty}× ${def.name}`;
  if(description) description.textContent=`Dispose this ${slot.qty===1?"item":"stack"}? This cannot be undone.`;
  document.getElementById("disposePrompt")?.classList.add("show");
  resetHeldKeyboardMovement?.();
  return true;
}

function cancelDisposePrompt(){
  pendingDisposeSlot=null;
  document.getElementById("disposePrompt")?.classList.remove("show");
}

function confirmDisposePrompt(){
  const i=pendingDisposeSlot;
  pendingDisposeSlot=null;
  document.getElementById("disposePrompt")?.classList.remove("show");
  const discarded=discardInventorySlot(i);
  if(discarded){
    const def=getItemDefinition(discarded.id);
    toast?.(`Disposed ${discarded.qty}× ${def.name}.`);
  }
}

function createInventoryDragGhost(slot){
  const def=getItemDefinition(slot.id);
  const ghost=document.createElement("div");
  ghost.className="itemDragGhost";
  ghost.innerHTML=`${itemVisualMarkup(def,"dragIcon","dragSymbol")}<span>${slot.qty}</span>`;
  document.body.appendChild(ghost);
  return ghost;
}

function positionItemDragGhost(ghost,x,y){
  if(!ghost) return;
  ghost.style.left=`${x}px`;
  ghost.style.top=`${y}px`;
}

function inventoryDragPointerDown(event){
  if(event.button!=null&&event.button!==0) return;
  const slotEl=event.target.closest?.(".inventorySlot[data-slot]");
  if(!slotEl) return;
  ensureInventoryState();
  const index=Number(slotEl.dataset.slot);
  const slot=state.inventory[index];
  if(!slot) return;
  const grid=slotEl.closest?.("#inventoryGrid,#lootInventoryGrid");
  if(!grid) return;
  inventoryPointerDrag={
    pointerId:event.pointerId,
    sourceIndex:index,
    sourceGrid:grid,
    startX:event.clientX,
    startY:event.clientY,
    active:false,
    ghost:null
  };
  slotEl.setPointerCapture?.(event.pointerId);
}

function inventoryDragPointerMove(event){
  const drag=inventoryPointerDrag;
  if(!drag||event.pointerId!==drag.pointerId) return;
  const distance=Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY);
  if(!drag.active&&distance<6) return;
  if(!drag.active){
    ensureInventoryState();
    const slot=state.inventory[drag.sourceIndex];
    if(!slot){inventoryPointerDrag=null;return;}
    drag.active=true;
    drag.ghost=createInventoryDragGhost(slot);
    drag.sourceGrid.classList.add("inventoryDragging");
  }
  event.preventDefault?.();
  positionItemDragGhost(drag.ghost,event.clientX,event.clientY);
}

function inventoryDragPointerUp(event){
  const drag=inventoryPointerDrag;
  if(!drag||event.pointerId!==drag.pointerId) return;
  inventoryPointerDrag=null;
  drag.sourceGrid?.classList.remove("inventoryDragging");
  drag.ghost?.remove?.();
  if(!drag.active) return;

  event.preventDefault?.();
  suppressInventoryClick=true;
  setTimeout(()=>{suppressInventoryClick=false;},0);

  const target=document.elementFromPoint?.(event.clientX,event.clientY)||null;
  const equipmentTarget=target?.closest?.("[data-equipment-slot]");
  if(equipmentTarget){equipInventorySlot(drag.sourceIndex);return;}
  const targetSlot=target?.closest?.(".inventorySlot[data-slot]");
  if(targetSlot){
    moveInventorySlot(drag.sourceIndex,Number(targetSlot.dataset.slot));
    return;
  }

  // Releasing elsewhere inside the panel simply cancels the drag. Releasing
  // outside the bag panel means the player intentionally dragged the stack out.
  const sourcePanel=drag.sourceGrid.closest?.("#backpackPanel,#lootPanel");
  const landedInsideSourcePanel=sourcePanel&&target&&(target===sourcePanel||sourcePanel.contains?.(target));
  if(!landedInsideSourcePanel) requestDisposeInventorySlot(drag.sourceIndex);
}

function bindInventoryInteractions(){
  if(inventoryInteractionsBound) return;
  inventoryInteractionsBound=true;
  document.getElementById("inventoryGrid")?.addEventListener("pointerdown",inventoryDragPointerDown);
  document.getElementById("inventoryGrid")?.addEventListener("dblclick",handleInventoryGridDoubleClick);
  document.getElementById("equipmentGrid")?.addEventListener("click",handleEquipmentGridClick);
  document.getElementById("lootInventoryGrid")?.addEventListener("pointerdown",inventoryDragPointerDown);
  document.addEventListener("pointermove",inventoryDragPointerMove,{passive:false});
  document.addEventListener("pointerup",inventoryDragPointerUp,{passive:false});
  document.addEventListener("pointercancel",inventoryDragPointerUp,{passive:false});
}

function openBackpack(){
  if(!state) return;
  selectedInventorySlot=null;
  renderInventory();
  document.getElementById("backpack")?.classList.add("show");
  constrainFloatingPanel?.("backpackPanel");
}

function closeBackpack(){
  document.getElementById("backpack")?.classList.remove("show");
  selectedInventorySlot=null;
}

function toggleBackpack(){
  const backpack=document.getElementById("backpack");
  if(!backpack) return;
  if(backpack.classList.contains("show")) closeBackpack();
  else openBackpack();
}

// Stable API for loot, gathering, shops, quests, drag/drop UI, and debug tooling.
window.LR_INVENTORY=Object.freeze({
  addItem,
  removeItem,
  getItemCount,
  canAddItem,
  getUsedSlots:getInventoryUsedSlots,
  getSlotCount:()=>INVENTORY_SLOT_COUNT,
  getSlots:()=>{ensureInventoryState();return state.inventory.map(slot=>slot?{...slot}:null);},
  placeInSlot:placeItemInInventorySlot,
  moveSlot:moveInventorySlot,
  disposeSlot:discardInventorySlot,
  requestDispose:requestDisposeInventorySlot
});
window.LR_EQUIPMENT=Object.freeze({
  slots:PLAYER_EQUIPMENT_SLOTS,
  labels:PLAYER_EQUIPMENT_LABELS,
  get:()=>{ensureEquipmentState();return {...state.equipment};},
  equipInventorySlot,
  unequip:unequipEquipmentSlot
});

// Data-driven loot + world-remnant system. Item definitions and drop rules live in
// content/shared/content-library.json. Mob deaths
// always leave a temporary dust pile; gold, potion drops, and item drops stay
// inside the pile until the player chooses to collect them.
const LOOT_TABLES = window.LR_LOOT_TABLES || {};
const LOOT_PILE_LIFETIME_MS = 60000;
const LOOT_PILE_FADE_MS = 10000;
const LOOT_PILE_INTERACT_RANGE = 84;
const LOOT_PILE_DRAW_SIZE = 44;
const LOOTABLE_DUST_SHEET_COLUMNS = 4;
const LOOTABLE_DUST_SHEET_ROWS = 4;
const LOOTABLE_DUST_FRAME_COUNT = LOOTABLE_DUST_SHEET_COLUMNS*LOOTABLE_DUST_SHEET_ROWS;
const LOOTABLE_DUST_FRAME_MS = 90;
const LOOT_REMNANT_DEPTH_MODES = new Set(["ysort","behind","front","ground"]);
const LOOT_REMNANT_VISUAL = {
  scale: visualScaleOr(VISUAL_CONFIG.remnants?.scale,1),
  depthMode: LOOT_REMNANT_DEPTH_MODES.has(String(VISUAL_CONFIG.remnants?.depthMode||"").toLowerCase())
    ? String(VISUAL_CONFIG.remnants.depthMode).toLowerCase()
    : "ysort",
  depthY: numberOr(VISUAL_CONFIG.remnants?.depthY,3)
};
const PROJECT_LOOT_REMNANT_VISUAL = {...LOOT_REMNANT_VISUAL};
const warnedLootProblems = new Set();
const lootPiles = [];
let nextLootPileId = 1;
let activeLootPileId = null;
let transientLootPile = null;
let activeLootDepletedCallback = null;
let lootPointerDrag = null;
let suppressLootClick = false;
let lootInteractionsBound = false;

const dustPileImage = new Image();
dustPileImage.src = "./assets/loot/dust.png";
let dustPileImageReady = dustPileImage.complete && dustPileImage.naturalWidth > 0;
dustPileImage.onload = () => { dustPileImageReady = true; };

const lootableDustPileImage = new Image();
lootableDustPileImage.src = "./assets/loot/lootable-dust.png";
let lootableDustPileImageReady = lootableDustPileImage.complete && lootableDustPileImage.naturalWidth > 0;
lootableDustPileImage.onload = () => { lootableDustPileImageReady = true; };

function lootWarnOnce(key,message){
  if(warnedLootProblems.has(key)) return;
  warnedLootProblems.add(key);
  console.warn(`[Little Realm loot] ${message}`);
}

function getLootTable(tableId){
  const raw=LOOT_TABLES[tableId];
  if(Array.isArray(raw)) return raw;
  if(raw&&Array.isArray(raw.entries)) return raw.entries;
  return [];
}

function lootEntryAllowed(entry,context){
  if(!entry||typeof entry.itemId!=="string"||!entry.itemId.trim()) return false;
  if(entry.requiresElite&&!context.elite) return false;
  if(entry.requiresBoss&&!context.boss) return false;
  const level=Math.max(1,Math.floor(numberOr(context.level,1)));
  if(Number.isFinite(Number(entry.minLevel))&&level<Number(entry.minLevel)) return false;
  if(Number.isFinite(Number(entry.maxLevel))&&level>Number(entry.maxLevel)) return false;
  return true;
}

function rollLootTable(tableId,context={},rng=Math.random){
  const table=getLootTable(tableId);
  const totals=new Map();

  for(const entry of table){
    if(!lootEntryAllowed(entry,context)) continue;
    const itemId=entry.itemId.trim();
    if(!Object.prototype.hasOwnProperty.call(ITEM_DEFS,itemId)){
      lootWarnOnce(`missing-item:${tableId}:${itemId}`,`Table "${tableId}" references unknown item "${itemId}". Add it to the shared Content Library first.`);
      continue;
    }

    const chance=clamp(numberOr(entry.chancePercent,100),0,100);
    if(chance<=0||rng()*100>=chance) continue;

    const minQty=Math.max(1,Math.floor(numberOr(entry.minQty,1)));
    const maxQty=Math.max(minQty,Math.floor(numberOr(entry.maxQty,minQty)));
    const qty=minQty+Math.floor(rng()*(maxQty-minQty+1));
    totals.set(itemId,(totals.get(itemId)||0)+qty);
  }

  return [...totals].map(([itemId,qty])=>({itemId,qty}));
}

function grantLootDrops(drops){
  const added=[];
  const overflow=[];
  for(const drop of Array.isArray(drops)?drops:[]){
    if(!drop||typeof drop.itemId!=="string") continue;
    const qty=Math.max(0,Math.floor(numberOr(drop.qty,0)));
    if(qty<=0) continue;
    const result=addItem(drop.itemId,qty);
    if(result.added>0) added.push({itemId:drop.itemId,qty:result.added});
    if(result.remaining>0) overflow.push({itemId:drop.itemId,qty:result.remaining});
  }
  return {added,overflow};
}

function lootTableIdForMob(mob){
  if(!mob) return "";
  const template=mob.template||mob;
  return typeof template.lootTable==="string"&&template.lootTable.trim()
    ? template.lootTable.trim()
    : (template.configKey||mob.kind||template.kind||"");
}

function rollMobLoot(mob,rng=Math.random){
  const tableId=lootTableIdForMob(mob);
  if(!tableId) return {tableId:"",rolled:[]};
  const template=mob?.template||mob||{};
  const rolled=rollLootTable(tableId,{
    level:mob?.level??template.level??template.baseLevel??1,
    elite:!!(mob?.elite??template.elite),
    boss:!!(mob?.boss||template.boss)
  },rng);
  return {tableId,rolled};
}

// Kept for developer tools and scripted rewards that intentionally bypass
// world remnants. Normal mob deaths use rollMobLoot + spawnMobLootPile.
function grantMobLoot(mob,rng=Math.random){
  const result=rollMobLoot(mob,rng);
  const granted=grantLootDrops(result.rolled);
  return {...result,...granted};
}

function formatLootDrops(drops){
  return (Array.isArray(drops)?drops:[]).map(drop=>{
    const def=getItemDefinition(drop.itemId);
    return `${drop.qty}× ${def.name}`;
  }).join(", ");
}

function normalizePendingLoot(drops){
  const totals=new Map();
  for(const drop of Array.isArray(drops)?drops:[]){
    if(!drop||typeof drop.itemId!=="string"||!ITEM_DEFS[drop.itemId]) continue;
    const qty=Math.max(0,Math.floor(numberOr(drop.qty,0)));
    if(qty>0) totals.set(drop.itemId,(totals.get(drop.itemId)||0)+qty);
  }
  return [...totals].map(([itemId,qty])=>({itemId,qty}));
}

function lootPileHasLoot(pile){
  return !!pile && (
    Math.max(0,Math.floor(numberOr(pile.gold,0)))>0 ||
    Math.max(0,Math.floor(numberOr(pile.potions,0)))>0 ||
    (Array.isArray(pile.items)&&pile.items.some(drop=>Math.max(0,Math.floor(numberOr(drop?.qty,0)))>0))
  );
}

function activeLootPile(){
  if(transientLootPile && transientLootPile.id===activeLootPileId) return transientLootPile;
  return lootPiles.find(pile=>pile.id===activeLootPileId)||null;
}

function spawnLootPile({x,y,drops=[],gold=0,potions=0,sourceLabel="Defeated enemy"}={},now=performance.now()){
  const pile={
    id:nextLootPileId++,
    x:numberOr(x,state?.x??0),
    y:numberOr(y,state?.y??0),
    sourceLabel:String(sourceLabel||"Defeated enemy"),
    items:normalizePendingLoot(drops),
    gold:Math.max(0,Math.floor(numberOr(gold,0))),
    potions:Math.max(0,Math.floor(numberOr(potions,0))),
    createdAt:numberOr(now,performance.now()),
    expiresAt:numberOr(now,performance.now())+LOOT_PILE_LIFETIME_MS
  };
  lootPiles.push(pile);
  return pile;
}

function spawnMobLootPile(mob,drops=[],gold=0,potions=0,sourceLabel="Defeated enemy",now=performance.now()){
  return spawnLootPile({
    x:numberOr(mob?.x,state?.x??0),
    y:numberOr(mob?.y,state?.y??0),
    drops,gold,potions,sourceLabel
  },now);
}

function clearLootPiles(){
  lootPiles.length=0;
  activeLootPileId=null;
  transientLootPile=null;
  activeLootDepletedCallback=null;
  document.getElementById("lootWindow")?.classList.remove("show");
}

function updateLootPiles(now=performance.now()){
  const t=numberOr(now,performance.now());
  let activeExpired=false;
  for(let i=lootPiles.length-1;i>=0;i--){
    if(t>=lootPiles[i].expiresAt){
      if(lootPiles[i].id===activeLootPileId) activeExpired=true;
      lootPiles.splice(i,1);
    }
  }
  if(activeExpired) closeLootWindow();
}

function lootPileRemainingMs(pile,now=performance.now()){
  return Math.max(0,numberOr(pile?.expiresAt,0)-numberOr(now,performance.now()));
}

function lootRemnantDepthMode(){
  const raw=String(LOOT_REMNANT_VISUAL.depthMode||"ysort").toLowerCase();
  return LOOT_REMNANT_DEPTH_MODES.has(raw)?raw:"ysort";
}

function lootRemnantDepthY(){
  return numberOr(LOOT_REMNANT_VISUAL.depthY,3);
}

function lootRemnantRenderDepth(pile,heroY){
  const mode=lootRemnantDepthMode();
  if(mode==="ground") return -1000000000;
  if(mode==="behind") return heroY-0.25;
  if(mode==="front") return heroY+0.25;
  return numberOr(pile?.y,0)+lootRemnantDepthY();
}

function lootRemnantDrawSize(){
  return LOOT_PILE_DRAW_SIZE*visualScaleOr(LOOT_REMNANT_VISUAL.scale,1);
}


function lootableDustFrameRect(image,frameIndex){
  const cols=LOOTABLE_DUST_SHEET_COLUMNS;
  const rows=LOOTABLE_DUST_SHEET_ROWS;
  const total=Math.max(1,cols*rows);
  const frame=((Math.floor(numberOr(frameIndex,0))%total)+total)%total;
  const col=frame%cols;
  const row=Math.floor(frame/cols);
  const sx=Math.round(col*image.naturalWidth/cols);
  const sy=Math.round(row*image.naturalHeight/rows);
  const ex=Math.round((col+1)*image.naturalWidth/cols);
  const ey=Math.round((row+1)*image.naturalHeight/rows);
  return {sx,sy,sw:Math.max(1,ex-sx),sh:Math.max(1,ey-sy)};
}

function drawLootableDustSprite(c,image,sx,sy,size,now){
  const total=Math.max(1,LOOTABLE_DUST_FRAME_COUNT);
  const frame=Math.floor(numberOr(now,0)/LOOTABLE_DUST_FRAME_MS)%total;
  const rect=lootableDustFrameRect(image,frame);
  c.drawImage(image,rect.sx,rect.sy,rect.sw,rect.sh,Math.round(sx-size/2),Math.round(sy-size*.72),Math.round(size),Math.round(size));
}

function drawLootPile(c,pile,camX,camY,now=performance.now()){
  if(!pile) return;
  const hasLoot=lootPileHasLoot(pile);
  const image=hasLoot?lootableDustPileImage:dustPileImage;
  const ready=hasLoot?lootableDustPileImageReady:dustPileImageReady;
  const remaining=lootPileRemainingMs(pile,now);
  if(remaining<=0) return;

  const fade=remaining<LOOT_PILE_FADE_MS?clamp(remaining/LOOT_PILE_FADE_MS,0,1):1;
  const pulse=hasLoot?1+Math.sin(numberOr(now,0)/240)*.018:1;
  const size=lootRemnantDrawSize()*pulse;
  const sx=pile.x-camX;
  const sy=pile.y-camY;
  c.save();
  c.globalAlpha=fade;
  c.imageSmoothingEnabled=false;
  if(ready&&image.naturalWidth){
    if(hasLoot&&LOOTABLE_DUST_FRAME_COUNT>1) drawLootableDustSprite(c,image,sx,sy,size,now);
    else c.drawImage(image,Math.round(sx-size/2),Math.round(sy-size*.72),Math.round(size),Math.round(size));
  }else{
    c.fillStyle=hasLoot?"rgba(236,208,128,.85)":"rgba(137,124,119,.72)";
    c.beginPath();c.ellipse(sx,sy+4,size*.34,size*.14,0,0,Math.PI*2);c.fill();
  }
  c.restore();
}

function findLootPileAtWorld(wx,wy,{lootableOnly=true}={}){
  let best=null,bestScore=Infinity;
  for(const pile of lootPiles){
    if(lootableOnly&&!lootPileHasLoot(pile)) continue;
    const dx=wx-pile.x;
    const dy=wy-pile.y;
    if(Math.abs(dx)>34||dy<-30||dy>24) continue;
    const score=dx*dx+(dy*.8)*(dy*.8);
    if(score<bestScore){best=pile;bestScore=score;}
  }
  return best;
}

function isLootWindowOpen(){
  return !!document.getElementById("lootWindow")?.classList.contains("show");
}

function renderLootInventory(){
  if(document.getElementById("backpack")?.classList.contains("show")) renderInventory();
  else updateBackpackHud();
}

function lootCurrencyMarkup(kind,qty){
  if(kind==="gold") return `<button class="lootSlot lootCurrencySlot" data-loot-kind="gold" aria-label="Take ${qty} gold"><span class="lootCurrencyIcon goldCoin">●</span><span class="lootItemName">Gold</span><span class="lootItemQty">${qty}</span></button>`;
  return `<button class="lootSlot lootCurrencySlot" data-loot-kind="potions" aria-label="Take ${qty} potion${qty===1?"":"s"}"><span class="lootCurrencyIcon potionIcon">+</span><span class="lootItemName">Potion${qty===1?"":"s"}</span><span class="lootItemQty">${qty}</span></button>`;
}

function renderLootWindow(){
  const pile=activeLootPile();
  const grid=document.getElementById("lootGrid");
  if(grid){
    if(!pile||!lootPileHasLoot(pile)){
      grid.innerHTML='<div class="lootEmpty">Nothing left to collect.</div>';
    }else{
      const rows=[];
      if(pile.gold>0) rows.push(lootCurrencyMarkup("gold",pile.gold));
      if(pile.potions>0) rows.push(lootCurrencyMarkup("potions",pile.potions));
      pile.items.forEach((drop,index)=>{
        const def=getItemDefinition(drop.itemId);
        rows.push(`<button class="lootSlot" data-loot-kind="item" data-loot-index="${index}" aria-label="Take ${drop.qty} ${inventoryEscape(def.name)}">${itemVisualMarkup(def,"lootItemIcon","lootItemSymbol")}<span class="lootItemName">${inventoryEscape(def.name)}</span><span class="lootItemQty">${drop.qty}</span></button>`);
      });
      grid.innerHTML=rows.join("");
    }
  }
  renderLootInventory();
}

function openLootPile(pile){
  if(!pile||!lootPileHasLoot(pile)) return false;
  activeLootDepletedCallback=null;
  activeLootPileId=pile.id;
  transientLootPile=pile===transientLootPile?transientLootPile:null;
  document.getElementById("lootWindow")?.classList.add("show");
  renderLootWindow();
  constrainFloatingPanel?.("lootPanel");
  return true;
}

function interactWithLootPile(pile){
  if(!pile||!lootPileHasLoot(pile)) return false;
  if(dist(state.x,state.y,pile.x,pile.y)>LOOT_PILE_INTERACT_RANGE){
    toast?.("Move closer to loot the remains.");
    return true;
  }
  openLootPile(pile);
  return true;
}

// Utility API for developer tools and scripted rewards. This opens a temporary list but
// does not create a persistent world pile. Normal mob deaths never call it.
function openLootWindow(drops,sourceLabel="Defeated enemy"){
  activeLootDepletedCallback=null;
  const normalized=normalizePendingLoot(drops);
  if(!normalized.length) return false;
  transientLootPile={id:`transient-${nextLootPileId++}`,x:state?.x??0,y:state?.y??0,sourceLabel:String(sourceLabel||"Defeated enemy"),items:normalized,gold:0,potions:0,createdAt:performance.now(),expiresAt:Infinity};
  activeLootPileId=transientLootPile.id;
  document.getElementById("lootWindow")?.classList.add("show");
  renderLootWindow();
  constrainFloatingPanel?.("lootPanel");
  return true;
}

function closeLootWindow(){
  activeLootPileId=null;
  transientLootPile=null;
  activeLootDepletedCallback=null;
  document.getElementById("lootWindow")?.classList.remove("show");
}

function openPersistentLootWindow(pile,onDepleted=null){
  if(!pile||!lootPileHasLoot(pile))return false;
  transientLootPile=pile;activeLootPileId=pile.id;activeLootDepletedCallback=typeof onDepleted==="function"?onDepleted:null;
  document.getElementById("lootWindow")?.classList.add("show");renderLootWindow();constrainFloatingPanel?.("lootPanel");return true;
}

function finishLootInteractionIfEmpty(pile){
  if(!pile||lootPileHasLoot(pile)){renderLootWindow();return;}
  const callback=activeLootDepletedCallback;activeLootDepletedCallback=null;
  if(callback){try{callback(pile);}catch(err){console.error("Loot depletion callback failed",err);}}
  closeLootWindow();renderLootInventory();
}

function takeLootAtIndex(index,targetSlot=null){
  const pile=activeLootPile();
  const i=Math.floor(numberOr(index,-1));
  const drop=pile?.items?.[i];
  if(!drop) return {added:0,remaining:0};
  const result=targetSlot==null
    ?addItem(drop.itemId,drop.qty)
    :placeItemInInventorySlot(drop.itemId,drop.qty,targetSlot);

  if(result.added<=0){
    if(targetSlot!=null) toast?.("That backpack slot cannot accept this item.");
    else toast?.("Your backpack is full.");
    return result;
  }

  drop.qty=result.remaining;
  if(drop.qty<=0) pile.items.splice(i,1);
  finishLootInteractionIfEmpty(pile);
  return result;
}

function takeGoldFromActivePile(){
  const pile=activeLootPile();
  if(!pile||pile.gold<=0) return 0;
  const amount=pile.gold;
  pile.gold=0;
  state.gold+=amount;
  updateUI?.();
  finishLootInteractionIfEmpty(pile);
  return amount;
}

function takePotionsFromActivePile(){
  const pile=activeLootPile();
  if(!pile||pile.potions<=0) return 0;
  const amount=pile.potions;
  pile.potions=0;
  state.potions+=amount;
  updateUI?.();
  finishLootInteractionIfEmpty(pile);
  return amount;
}

function takeAllLoot(){
  const pile=activeLootPile();
  if(!pile) return;
  const hadLoot=lootPileHasLoot(pile);
  if(pile.gold>0){state.gold+=pile.gold;pile.gold=0;}
  if(pile.potions>0){state.potions+=pile.potions;pile.potions=0;}
  for(let i=pile.items.length-1;i>=0;i--){
    const drop=pile.items[i];
    const result=addItem(drop.itemId,drop.qty);
    drop.qty=result.remaining;
    if(drop.qty<=0) pile.items.splice(i,1);
  }
  if(hadLoot)playAudioEvent("lootPickup",{bus:"ui",volume:.75});
  updateUI?.();
  if(!lootPileHasLoot(pile)) finishLootInteractionIfEmpty(pile);
  else{
    renderLootWindow();
    toast?.("Your backpack does not have room for all of the loot.");
  }
}

function createLootDragGhost(drop){
  const def=getItemDefinition(drop.itemId);
  const ghost=document.createElement("div");
  ghost.className="itemDragGhost lootDragGhost";
  ghost.innerHTML=`${itemVisualMarkup(def,"dragIcon","dragSymbol")}<span>${drop.qty}</span>`;
  document.body.appendChild(ghost);
  return ghost;
}

function lootDragPointerDown(event){
  if(event.button!=null&&event.button!==0) return;
  const slot=event.target.closest?.('.lootSlot[data-loot-kind="item"][data-loot-index]');
  if(!slot) return;
  const pile=activeLootPile();
  const index=Number(slot.dataset.lootIndex);
  if(!pile?.items?.[index]) return;
  lootPointerDrag={pointerId:event.pointerId,index,startX:event.clientX,startY:event.clientY,active:false,ghost:null};
  slot.setPointerCapture?.(event.pointerId);
}

function lootDragPointerMove(event){
  const drag=lootPointerDrag;
  if(!drag||event.pointerId!==drag.pointerId) return;
  const distance=Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY);
  if(!drag.active&&distance<6) return;
  if(!drag.active){
    const drop=activeLootPile()?.items?.[drag.index];
    if(!drop){lootPointerDrag=null;return;}
    drag.active=true;
    drag.ghost=createLootDragGhost(drop);
    document.getElementById("lootGrid")?.classList.add("lootDragging");
  }
  event.preventDefault?.();
  positionItemDragGhost(drag.ghost,event.clientX,event.clientY);
}

function lootDragPointerUp(event){
  const drag=lootPointerDrag;
  if(!drag||event.pointerId!==drag.pointerId) return;
  lootPointerDrag=null;
  document.getElementById("lootGrid")?.classList.remove("lootDragging");
  drag.ghost?.remove?.();
  if(!drag.active) return;
  event.preventDefault?.();
  suppressLootClick=true;
  setTimeout(()=>{suppressLootClick=false;},0);
  const target=document.elementFromPoint?.(event.clientX,event.clientY)||null;
  const targetSlot=target?.closest?.(".inventorySlot[data-slot]");
  if(targetSlot) takeLootAtIndex(drag.index,Number(targetSlot.dataset.slot));
}

function handleLootGridClick(event){
  if(suppressLootClick){event.preventDefault?.();return;}
  const slot=event.target.closest?.(".lootSlot[data-loot-kind]");
  if(!slot) return;
  const kind=slot.dataset.lootKind;
  if(kind==="gold") takeGoldFromActivePile();
  else if(kind==="potions") takePotionsFromActivePile();
  else if(kind==="item") takeLootAtIndex(Number(slot.dataset.lootIndex));
}

function bindLootInteractions(){
  if(lootInteractionsBound) return;
  lootInteractionsBound=true;
  document.getElementById("lootGrid")?.addEventListener("pointerdown",lootDragPointerDown);
  document.addEventListener("pointermove",lootDragPointerMove,{passive:false});
  document.addEventListener("pointerup",lootDragPointerUp,{passive:false});
  document.addEventListener("pointercancel",lootDragPointerUp,{passive:false});
}

function validateLootConfig(){
  const errors=[];
  for(const [tableId,raw] of Object.entries(LOOT_TABLES)){
    const entries=Array.isArray(raw)?raw:(raw&&Array.isArray(raw.entries)?raw.entries:null);
    if(!entries){
      errors.push(`Loot table "${tableId}" must be an array or { entries: [] }.`);
      continue;
    }
    entries.forEach((entry,index)=>{
      if(!entry||typeof entry.itemId!=="string"||!entry.itemId.trim()){
        errors.push(`Loot table "${tableId}" entry ${index+1} is missing itemId.`);
        return;
      }
      if(!Object.prototype.hasOwnProperty.call(ITEM_DEFS,entry.itemId.trim())){
        errors.push(`Loot table "${tableId}" entry ${index+1} references unknown item "${entry.itemId}".`);
      }
      const chance=Number(entry.chancePercent??100);
      if(!Number.isFinite(chance)||chance<0||chance>100){
        errors.push(`Loot table "${tableId}" entry ${index+1} has chancePercent outside 0–100.`);
      }
      const minQty=Number(entry.minQty??1);
      const maxQty=Number(entry.maxQty??minQty);
      if(!Number.isFinite(minQty)||!Number.isFinite(maxQty)||minQty<1||maxQty<minQty){
        errors.push(`Loot table "${tableId}" entry ${index+1} has an invalid quantity range.`);
      }
    });
  }
  return errors;
}

// Stable API for tests, developer tools, future chests, gathering, bosses,
// quests, and any other system that needs to roll or present item loot.
window.LR_LOOT=Object.freeze({
  getTable:getLootTable,
  rollTable:rollLootTable,
  rollMobLoot,
  grantDrops:grantLootDrops,
  grantMobLoot,
  spawnPile:spawnLootPile,
  spawnMobPile:spawnMobLootPile,
  clearPiles:clearLootPiles,
  updatePiles:updateLootPiles,
  getPiles:()=>lootPiles.map(pile=>({...pile,items:pile.items.map(drop=>({...drop}))})),
  pileHasLoot:lootPileHasLoot,
  openPile:openLootPile,
  openWindow:openLootWindow,
  openPersistent:openPersistentLootWindow,
  closeWindow:closeLootWindow,
  takeAt:takeLootAtIndex,
  takeGold:takeGoldFromActivePile,
  takePotions:takePotionsFromActivePile,
  takeAll:takeAllLoot,
  getPending:()=>activeLootPile()?.items?.map(drop=>({...drop}))||[],
  formatDrops:formatLootDrops,
  validate:validateLootConfig,
  lifetimeMs:LOOT_PILE_LIFETIME_MS
});

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

// Data-driven quest runtime ---------------------------------------------------
// Quest definitions live in each zone pack and are authored visually in World Builder.
// Runtime progress stays in the normal player save state.

function cloneQuest(value){
  return JSON.parse(JSON.stringify(value));
}

const QUEST_XP_PROFILE_DEFAULTS={
  minor:{mobEquivalent:3,levelCapPercent:5},
  gather:{mobEquivalent:5,levelCapPercent:8},
  standard:{mobEquivalent:8,levelCapPercent:12},
  multi:{mobEquivalent:12,levelCapPercent:15},
  elite:{mobEquivalent:18,levelCapPercent:20},
  dungeon:{mobEquivalent:25,levelCapPercent:25},
  boss:{mobEquivalent:35,levelCapPercent:30},
  story:{mobEquivalent:30,levelCapPercent:25},
  epic:{mobEquivalent:50,levelCapPercent:40},
  repeatable:{mobEquivalent:5,levelCapPercent:8}
};
const QUEST_XP_PROFILE_LABELS={
  minor:"Minor / Talk / Discovery",
  gather:"Gather / Delivery",
  standard:"Standard",
  multi:"Multi-Objective",
  elite:"Elite / Mini-Boss",
  dungeon:"Dungeon",
  boss:"Major Boss",
  story:"Main Story",
  epic:"Epic Finale",
  repeatable:"Repeatable"
};

function normalizeQuestRewardTier(value,fallback="standard"){
  const key=String(value||"").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(QUEST_XP_PROFILE_DEFAULTS,key)?key:fallback;
}

function inferQuestRewardTier(objectives,repeatable=false){
  if(repeatable) return "repeatable";
  const list=Array.isArray(objectives)?objectives:[];
  if(list.length>1) return "multi";
  const type=list[0]?.type;
  if(type==="talk"||type==="visit") return "minor";
  if(type==="collect"||type==="deliver") return "gather";
  return "standard";
}

function questXpProfile(tier,repeatable=false){
  const effective=repeatable?"repeatable":normalizeQuestRewardTier(tier);
  const fallback=QUEST_XP_PROFILE_DEFAULTS[effective]||QUEST_XP_PROFILE_DEFAULTS.standard;
  const configured=BALANCE.quest?.xpProfiles?.[effective]||{};
  return {
    tier:effective,
    mobEquivalent:Math.max(0,numberOr(configured.mobEquivalent,fallback.mobEquivalent)),
    levelCapPercent:Math.max(0,numberOr(configured.levelCapPercent,fallback.levelCapPercent))
  };
}

function questAutoXpForLevel(level,tier="standard",repeatable=false){
  const lv=Math.max(1,Math.min(playerLevelCap(),Math.floor(numberOr(level,1))));
  const profile=questXpProfile(tier,repeatable);
  const raw=Math.max(0,Math.floor(standardMobXpForLevel(lv)*profile.mobEquivalent));
  const requirement=xpRequiredForLevel(lv)||xpRequiredForLevel(Math.max(1,lv-1));
  const cap=requirement>0?Math.floor(requirement*(profile.levelCapPercent/100)):raw;
  return Math.max(0,Math.min(raw,cap));
}

function questDefaultMinLevel(level){
  const gap=Math.max(0,Math.floor(numberOr(BALANCE.quest?.defaultLevelGap,3)));
  return Math.max(1,Math.floor(numberOr(level,1))-gap);
}

function questRecommendedMaxLevel(quest){
  const above=Math.max(0,Math.floor(numberOr(BALANCE.quest?.recommendedLevelsAbove,3)));
  return Math.min(playerLevelCap(),Math.max(quest?.level||1,(quest?.level||1)+above));
}

function questLevelRequirementMet(quest){
  return !state || state.level>=Math.max(1,Math.floor(numberOr(quest?.minLevel,1)));
}

function questLevelText(quest){
  return `Quest Lv ${quest.level} • Requires Lv ${quest.minLevel}+`;
}

function normalizeQuestObjective(raw={}){
  const type=["kill","collect","talk","deliver","visit","interact"].includes(raw.type)?raw.type:"talk";
  const objective={
    type,
    target:typeof raw.target==="string"?raw.target:"",
    amount:Math.max(1,Math.floor(numberOr(raw.amount,1)))
  };
  if(type==="visit"){
    objective.x=numberOr(raw.x,START_X);
    objective.y=numberOr(raw.y,START_Y);
    objective.radius=Math.max(8,numberOr(raw.radius,36));
  }
  if(type==="collect"||type==="deliver") objective.consumeOnTurnIn=raw.consumeOnTurnIn!==false;
  return objective;
}

function normalizeQuestDefinition(raw,index=0){
  const quest=cloneQuest(raw||{});
  quest.id=String(quest.id||`quest-${index+1}`).trim().replace(/\s+/g,"_").toLowerCase();
  quest.title=String(quest.title||quest.id||"Untitled Quest");
  quest.description=String(quest.description||"");
  quest.giverNpc=String(quest.giverNpc||"");
  quest.turnInNpc=String(quest.turnInNpc||quest.giverNpc||"");
  quest.openingDialogue=String(quest.openingDialogue||quest.description||"Can you help me?");
  quest.completionDialogue=String(quest.completionDialogue||"Thank you for your help.");
  quest.objectives=(Array.isArray(quest.objectives)?quest.objectives:[]).map(normalizeQuestObjective);
  if(!quest.objectives.length) quest.objectives=[normalizeQuestObjective({type:"talk",target:quest.turnInNpc||quest.giverNpc,amount:1})];
  quest.level=Math.max(1,Math.min(playerLevelCap(),Math.floor(numberOr(quest.level??quest.questLevel,1))));
  quest.levelRequirementMode=quest.levelRequirementMode==="custom"?"custom":"auto";
  quest.minLevel=quest.levelRequirementMode==="custom"
    ?Math.max(1,Math.min(quest.level,Math.floor(numberOr(quest.minLevel,questDefaultMinLevel(quest.level)))))
    :questDefaultMinLevel(quest.level);
  quest.recommendedMaxLevel=questRecommendedMaxLevel(quest);
  quest.repeatable=!!quest.repeatable;
  quest.rewardTier=normalizeQuestRewardTier(quest.rewardTier,inferQuestRewardTier(quest.objectives,quest.repeatable));
  const rewards=quest.rewards||{};
  const xpMode=rewards.xpMode==="auto"?"auto":"custom";
  quest.rewards={
    xpMode,
    xp:xpMode==="auto"?questAutoXpForLevel(quest.level,quest.rewardTier,quest.repeatable):Math.max(0,Math.floor(numberOr(rewards.xp,0))),
    gold:Math.max(0,Math.floor(numberOr(rewards.gold,0))),
    items:(Array.isArray(rewards.items)?rewards.items:[])
      .filter(item=>item&&typeof item.id==="string"&&item.id)
      .map(item=>({id:item.id,qty:Math.max(1,Math.floor(numberOr(item.qty,1))) }))
  };
  if(Array.isArray(quest.prerequisite)){
    quest.prerequisite=quest.prerequisite
      .map(id=>String(id||"").trim())
      .filter(Boolean);
    if(!quest.prerequisite.length) quest.prerequisite=null;
  }else{
    quest.prerequisite=quest.prerequisite?String(quest.prerequisite).trim():null;
  }
  quest.nextQuest=quest.nextQuest?String(quest.nextQuest).trim():null;
  return quest;
}

let questDefinitions=(PROJECT_QUESTS||[]).map(normalizeQuestDefinition);
let activeNpcDialogId=null;
let activeObjectQuestId=null;
let activeObjectQuestIds=[];

function replaceQuestDefinitions(list){
  questDefinitions=(Array.isArray(list)?list:[]).map(normalizeQuestDefinition);
  refreshQuestUI();
}

function getQuestDefinition(id){
  return questDefinitions.find(quest=>quest.id===id)||null;
}

function ensureQuestState(){
  if(!state) return {};
  if(!state.quests||typeof state.quests!=="object"||Array.isArray(state.quests)) state.quests={};
  return state.quests;
}

function questWasCompleted(id){
  if(!id) return true;
  const record=ensureQuestState()[id];
  return !!record&&(record.status==="completed"||numberOr(record.completedCount,0)>0);
}

function questPrerequisiteMet(quest){
  if(!quest?.prerequisite) return true;
  if(Array.isArray(quest.prerequisite)) return quest.prerequisite.every(questWasCompleted);
  return questWasCompleted(quest.prerequisite);
}

function questRecord(id){
  return ensureQuestState()[id]||null;
}

function questObjectiveStoredProgress(quest,index){
  const record=questRecord(quest.id);
  return Math.max(0,Math.floor(numberOr(record?.objectives?.[index],0)));
}

function questObjectiveProgress(quest,index){
  const objective=quest?.objectives?.[index];
  if(!objective) return 0;
  if(objective.type==="collect"||objective.type==="deliver") return Math.min(objective.amount,getItemCount(objective.target));
  return Math.min(objective.amount,questObjectiveStoredProgress(quest,index));
}

function questObjectiveComplete(quest,index){
  const objective=quest?.objectives?.[index];
  return !!objective&&questObjectiveProgress(quest,index)>=objective.amount;
}

function questCanTurnIn(quest){
  if(!quest) return false;
  const record=questRecord(quest.id);
  if(!record||record.status!=="active") return false;
  return quest.objectives.every((_,index)=>questObjectiveComplete(quest,index));
}

function getQuestStatus(questOrId){
  const quest=typeof questOrId==="string"?getQuestDefinition(questOrId):questOrId;
  if(!quest) return "locked";
  const record=questRecord(quest.id);
  if(record?.status==="active") return questCanTurnIn(quest)?"ready":"active";
  if(record?.status==="completed"&&!quest.repeatable) return "completed";
  if(!questPrerequisiteMet(quest)) return "locked";
  if(!questLevelRequirementMet(quest)) return "locked";
  return "available";
}

function questsForNpc(npcId,kind="giver"){
  return questDefinitions.filter(quest=>(kind==="turnin"?quest.turnInNpc:quest.giverNpc)===npcId);
}

function getNpcQuestMarkerInfo(npcId){
  if(!state||!npcId) return null;
  if(questsForNpc(npcId,"turnin").some(quest=>getQuestStatus(quest)==="ready")) return {symbol:"?",kind:"ready"};
  if(questsForNpc(npcId,"giver").some(quest=>getQuestStatus(quest)==="available")) return {symbol:"!",kind:"available"};

  // Active talk objectives use a muted grey question mark so players can
  // identify who still needs to be spoken to without confusing that NPC
  // with a normal gold quest turn-in marker.
  const talkTarget=questDefinitions.some(quest=>{
    if(getQuestStatus(quest)!=="active") return false;
    return quest.objectives.some((objective,index)=>
      objective.type==="talk"&&objective.target===npcId&&!questObjectiveComplete(quest,index)
    );
  });
  if(talkTarget) return {symbol:"?",kind:"talk"};
  return null;
}

function getNpcQuestMarker(npcId){
  return getNpcQuestMarkerInfo(npcId)?.symbol||"";
}

function questEscape(value){
  return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

function questTargetLabel(objective){
  if(!objective) return "Objective";
  if(objective.type==="kill"){
    const template=allMobTemplates().find(t=>(t.configKey||t.kind)===objective.target||t.kind===objective.target);
    return template?.name||objective.target||"enemy";
  }
  if(objective.type==="collect"||objective.type==="deliver") return getItemDefinition(objective.target).name;
  if(objective.type==="talk") return sceneryNPCs.find(n=>n.id===objective.target)?.name||objective.target||"NPC";
  if(objective.type==="interact"){const obj=sceneryProps.find(o=>worldObjectInteraction(o).tag===objective.target||o.id===objective.target);return obj?.label||objective.target||"object";}
  if(objective.type==="visit") return `location (${Math.round(objective.x)}, ${Math.round(objective.y)})`;
  return objective.target||"target";
}

function questObjectiveText(quest,index){
  const objective=quest.objectives[index];
  const progress=questObjectiveProgress(quest,index);
  const target=questTargetLabel(objective);
  if(objective.type==="kill") return `Defeat ${target}: ${progress}/${objective.amount}`;
  if(objective.type==="collect") return `Collect ${target}: ${progress}/${objective.amount}`;
  if(objective.type==="deliver") return `Bring ${target}: ${progress}/${objective.amount}`;
  if(objective.type==="talk") return `Talk to ${target}: ${progress}/${objective.amount}`;
  if(objective.type==="interact") return `Interact with ${target}: ${progress}/${objective.amount}`;
  if(objective.type==="visit") return `Visit ${target}: ${progress}/${objective.amount}`;
  return `${target}: ${progress}/${objective.amount}`;
}

function questRewardText(quest){
  const parts=[];
  if(quest.rewards.xp) parts.push(`${quest.rewards.xp} XP`);
  if(quest.rewards.gold) parts.push(`${quest.rewards.gold} gold`);
  for(const item of quest.rewards.items) parts.push(`${item.qty}× ${getItemDefinition(item.id).name}`);
  return parts.length?parts.join(" • "):"No reward";
}

function acceptQuest(id){
  const quest=getQuestDefinition(id);
  if(!quest||getQuestStatus(quest)!=="available") return false;
  const old=ensureQuestState()[quest.id]||{};
  ensureQuestState()[quest.id]={
    status:"active",
    objectives:quest.objectives.map(()=>0),
    completedCount:Math.max(0,Math.floor(numberOr(old.completedCount,0))),
    acceptedAt:Date.now(),
    readyAnnounced:false,
    tracked:true
  };
  playAudioEvent("questAccept",{bus:"ui",volume:1});
  toast(`Quest accepted: ${quest.title}`);
  refreshQuestUI();
  renderNpcDialogue();
  return true;
}

function abandonQuest(id){
  const quest=getQuestDefinition(id);
  const record=questRecord(id);
  if(!quest||!record||record.status!=="active") return false;
  const completedCount=Math.max(0,Math.floor(numberOr(record.completedCount,0)));
  if(completedCount>0&&quest.repeatable) ensureQuestState()[id]={status:"available",completedCount};
  else delete ensureQuestState()[id];
  toast(`Abandoned: ${quest.title}`);
  refreshQuestUI();
  return true;
}

function questRewardsFit(quest){
  for(const item of quest.rewards.items){
    if(!canAddItem(item.id,item.qty)) return false;
  }
  return true;
}

function completeQuest(id){
  const quest=getQuestDefinition(id);
  if(!quest||!questCanTurnIn(quest)) return false;
  if(!questRewardsFit(quest)){
    toast("Make room in your backpack for the quest reward.");
    return false;
  }

  // Collection/delivery objectives can optionally consume the required items.
  const consume={};
  for(const objective of quest.objectives){
    if((objective.type==="collect"||objective.type==="deliver")&&objective.consumeOnTurnIn!==false){
      consume[objective.target]=(consume[objective.target]||0)+objective.amount;
    }
  }
  for(const [itemId,qty] of Object.entries(consume)) removeItem(itemId,qty);

  state.xp+=quest.rewards.xp;
  state.gold+=quest.rewards.gold;
  for(const item of quest.rewards.items) addItem(item.id,item.qty);
  levelCheck();

  const record=questRecord(id)||{};
  const completedCount=Math.max(0,Math.floor(numberOr(record.completedCount,0)))+1;
  ensureQuestState()[id]={
    status:quest.repeatable?"available":"completed",
    objectives:quest.objectives.map(()=>0),
    completedCount,
    completedAt:Date.now(),
    readyAnnounced:false,
    tracked:false
  };

  playAudioEvent("questTurnIn",{bus:"ui",volume:1});
  toast(`Quest complete: ${quest.title}`);
  updateUI();
  refreshQuestUI();
  renderNpcDialogue();
  return true;
}

function updateStoredQuestObjective(quest,index,amount=1){
  const record=questRecord(quest.id);
  if(!record||record.status!=="active") return false;
  const objective=quest.objectives[index];
  const before=questObjectiveStoredProgress(quest,index);
  const next=Math.min(objective.amount,before+Math.max(0,Math.floor(numberOr(amount,1))));
  if(!Array.isArray(record.objectives)) record.objectives=quest.objectives.map(()=>0);
  record.objectives[index]=next;
  return next!==before;
}

function notifyQuestKill(target,amount=1){
  let changed=false;
  for(const quest of questDefinitions){
    if(getQuestStatus(quest)!=="active") continue;
    quest.objectives.forEach((objective,index)=>{
      if(objective.type==="kill"&&objective.target===target) changed=updateStoredQuestObjective(quest,index,amount)||changed;
    });
  }
  if(changed) refreshQuestUI();
}

function notifyQuestTalk(npcId){
  let changed=false;
  for(const quest of questDefinitions){
    if(getQuestStatus(quest)!=="active") continue;
    quest.objectives.forEach((objective,index)=>{
      if(objective.type==="talk"&&objective.target===npcId) changed=updateStoredQuestObjective(quest,index,1)||changed;
    });
  }
  if(changed) refreshQuestUI();
}

function updateQuestVisits(){
  if(!state) return;
  let changed=false;
  for(const quest of questDefinitions){
    if(getQuestStatus(quest)!=="active") continue;
    quest.objectives.forEach((objective,index)=>{
      if(objective.type!=="visit"||questObjectiveComplete(quest,index)) return;
      if(dist(state.x,state.y,objective.x,objective.y)<=objective.radius) changed=updateStoredQuestObjective(quest,index,1)||changed;
    });
  }
  if(changed) refreshQuestUI();
}

function activeQuests(){
  return questDefinitions.filter(quest=>["active","ready"].includes(getQuestStatus(quest)));
}

function questIsTracked(questOrId){
  const quest=typeof questOrId==="string"?getQuestDefinition(questOrId):questOrId;
  if(!quest) return false;
  const record=questRecord(quest.id);
  return !!record&&record.status==="active"&&record.tracked!==false;
}

function trackedQuests(){
  return activeQuests().filter(quest=>questIsTracked(quest));
}

function setQuestTracked(id,tracked){
  const quest=getQuestDefinition(id);
  const record=questRecord(id);
  if(!quest||!record||record.status!=="active") return false;
  record.tracked=!!tracked;
  refreshQuestUI();
  return true;
}

function refreshQuestReadyAnnouncements(){
  for(const quest of activeQuests()){
    const record=questRecord(quest.id);
    const ready=questCanTurnIn(quest);
    if(ready&&!record.readyAnnounced){
      record.readyAnnounced=true;
      toast(`Quest ready to turn in: ${quest.title}`);
    }else if(!ready&&record.readyAnnounced){
      record.readyAnnounced=false;
    }
  }
}

function renderQuestLog(){
  const body=document.getElementById("questLogBody");
  if(!body||!state) return;
  const active=activeQuests();
  const completed=questDefinitions.filter(q=>getQuestStatus(q)==="completed");
  if(!active.length&&!completed.length){
    body.innerHTML='<div class="questEmpty">No quests yet. Look for an NPC with a <b>!</b> over their head.</div>';
    return;
  }
  body.innerHTML=`${active.map(quest=>{
    const ready=getQuestStatus(quest)==="ready";
    const tracked=questIsTracked(quest);
    return `<article class="questLogEntry${ready?" ready":""}"><div class="questLogTitle"><div class="questLogTitleText">${questEscape(quest.title)}</div><div class="questLogMeta">${ready?'<span class="questReadyBadge">READY</span>':''}<label class="questTrackToggle" title="Show this quest in the on-screen tracker"><input type="checkbox" data-track-quest="${questEscape(quest.id)}"${tracked?' checked':''}><span>Track</span></label></div></div><div class="questLogDesc"><b>${questEscape(questLevelText(quest))}</b><br>${questEscape(quest.description)}</div><div class="questObjectives">${quest.objectives.map((_,index)=>`<div class="questObjectiveRow${questObjectiveComplete(quest,index)?" complete":""}"><span class="questObjectiveMark">${questObjectiveComplete(quest,index)?"✓":"•"}</span><span>${questEscape(questObjectiveText(quest,index))}</span></div>`).join("")}</div><div class="questRewards">Reward: ${questEscape(questRewardText(quest))}</div><button class="questAbandon" data-abandon-quest="${questEscape(quest.id)}">Abandon</button></article>`;
  }).join("")}${completed.length?`<div class="questCompletedHeading">Completed</div>${completed.map(q=>`<div class="questCompletedItem">✓ ${questEscape(q.title)}</div>`).join("")}`:""}`;
  body.querySelectorAll("[data-track-quest]").forEach(input=>input.onchange=()=>{
    setQuestTracked(input.dataset.trackQuest,input.checked);
  });
  body.querySelectorAll("[data-abandon-quest]").forEach(button=>button.onclick=()=>{
    const id=button.dataset.abandonQuest;
    if(confirm(`Abandon ${getQuestDefinition(id)?.title||"this quest"}?`)) abandonQuest(id);
  });
}


function toggleQuestLog(){
  const overlay=document.getElementById("questLog");
  if(!overlay) return;
  overlay.classList.toggle("show");
  if(overlay.classList.contains("show")){
    renderQuestLog();
    constrainFloatingPanel?.("questLogPanel");
  }
}

function closeQuestLog(){
  document.getElementById("questLog")?.classList.remove("show");
}

function renderNpcDialogue(){
  const overlay=document.getElementById("npcDialog");
  const nameEl=document.getElementById("npcDialogName");
  const roleEl=document.getElementById("npcDialogRole");
  const textEl=document.getElementById("npcDialogText");
  const actions=document.getElementById("npcDialogActions");
  if(!overlay||!nameEl||!roleEl||!textEl||!actions||!activeNpcDialogId) return;
  const npc=sceneryNPCs.find(n=>n.id===activeNpcDialogId);
  if(!npc){closeNpcDialogue();return;}
  nameEl.textContent=npc.name;
  roleEl.textContent=npc.role||"Villager";
  textEl.textContent=npc.greeting||`Hello. I'm ${npc.name}.`;

  const ready=questsForNpc(npc.id,"turnin").filter(q=>getQuestStatus(q)==="ready");
  const available=questsForNpc(npc.id,"giver").filter(q=>getQuestStatus(q)==="available");
  const active=Array.from(new Set([
    ...questsForNpc(npc.id,"giver"),
    ...questsForNpc(npc.id,"turnin")
  ])).filter(q=>getQuestStatus(q)==="active");

  const cards=[];
  for(const quest of ready){
    cards.push(`<article class="npcQuestCard ready"><div class="npcQuestTitle">? ${questEscape(quest.title)}</div><div class="npcQuestCopy"><b>${questEscape(questLevelText(quest))}</b><br>${questEscape(quest.completionDialogue)}</div><div class="questRewards">Reward: ${questEscape(questRewardText(quest))}</div><button data-complete-quest="${questEscape(quest.id)}">Complete Quest</button></article>`);
  }
  for(const quest of available){
    cards.push(`<article class="npcQuestCard"><div class="npcQuestTitle">! ${questEscape(quest.title)}</div><div class="npcQuestCopy"><b>${questEscape(questLevelText(quest))}</b><br>${questEscape(quest.openingDialogue)}</div><div class="questObjectives">${quest.objectives.map((_,index)=>`<div>${questEscape(questObjectiveText(quest,index))}</div>`).join("")}</div><div class="questRewards">Reward: ${questEscape(questRewardText(quest))}</div><button data-accept-quest="${questEscape(quest.id)}">Accept Quest</button></article>`);
  }
  for(const quest of active){
    cards.push(`<article class="npcQuestCard active"><div class="npcQuestTitle">${questEscape(quest.title)}</div><div class="npcQuestCopy"><b>${questEscape(questLevelText(quest))}</b><br>In progress</div><div class="questObjectives">${quest.objectives.map((_,index)=>`<div>${questEscape(questObjectiveText(quest,index))}</div>`).join("")}</div></article>`);
  }
  actions.innerHTML=cards.join("")||'<div class="npcNoQuest">Nothing else right now.</div>';
  actions.querySelectorAll("[data-accept-quest]").forEach(button=>button.onclick=()=>acceptQuest(button.dataset.acceptQuest));
  actions.querySelectorAll("[data-complete-quest]").forEach(button=>button.onclick=()=>completeQuest(button.dataset.completeQuest));
}


function renderWorldObjectQuestDialog(){
  const overlay=document.getElementById("objectQuestDialog"),title=document.getElementById("objectQuestTitle"),role=document.getElementById("objectQuestRole"),actions=document.getElementById("objectQuestActions");
  if(!overlay||!title||!role||!actions||!activeObjectQuestId)return;
  const obj=sceneryProps.find(o=>o.id===activeObjectQuestId);if(!obj){closeWorldObjectQuestDialog();return;}
  title.textContent=obj.label||worldObjectDefinition(obj)?.name||"Quest Board";role.textContent="Available Quests";
  const quests=activeObjectQuestIds.map(getQuestDefinition).filter(Boolean),cards=[];
  for(const quest of quests){
    const status=getQuestStatus(quest);
    if(status==="locked")continue;
    if(status==="available")cards.push(`<article class="npcQuestCard"><div class="npcQuestTitle">! ${questEscape(quest.title)}</div><div class="npcQuestCopy"><b>${questEscape(questLevelText(quest))}</b><br>${questEscape(quest.openingDialogue||quest.description)}</div><div class="questObjectives">${quest.objectives.map((_,index)=>`<div>${questEscape(questObjectiveText(quest,index))}</div>`).join("")}</div><div class="questRewards">Reward: ${questEscape(questRewardText(quest))}</div><button data-object-accept-quest="${questEscape(quest.id)}">Accept Quest</button></article>`);
    else if(status==="active")cards.push(`<article class="npcQuestCard active"><div class="npcQuestTitle">${questEscape(quest.title)}</div><div class="npcQuestCopy"><b>${questEscape(questLevelText(quest))}</b><br>In progress</div><div class="questObjectives">${quest.objectives.map((_,index)=>`<div>${questEscape(questObjectiveText(quest,index))}</div>`).join("")}</div></article>`);
    else if(status==="ready"){const canTurnInHere=!quest.turnInNpc;cards.push(`<article class="npcQuestCard ready"><div class="npcQuestTitle">? ${questEscape(quest.title)}</div><div class="npcQuestCopy"><b>${questEscape(questLevelText(quest))}</b><br>${canTurnInHere?questEscape(quest.completionDialogue):`Ready to turn in${quest.turnInNpc?` to ${questEscape(sceneryNPCs.find(n=>n.id===quest.turnInNpc)?.name||quest.turnInNpc)}`:""}.`}</div><div class="questRewards">Reward: ${questEscape(questRewardText(quest))}</div>${canTurnInHere?`<button data-object-complete-quest="${questEscape(quest.id)}">Complete Quest</button>`:""}</article>`);}
    else if(status==="completed")cards.push(`<article class="npcQuestCard active"><div class="npcQuestTitle">✓ ${questEscape(quest.title)}</div><div class="npcQuestCopy">Completed</div></article>`);
  }
  actions.innerHTML=cards.join("")||'<div class="npcNoQuest">Nothing available right now.</div>';
  actions.querySelectorAll("[data-object-accept-quest]").forEach(button=>button.onclick=()=>{acceptQuest(button.dataset.objectAcceptQuest);renderWorldObjectQuestDialog();});
  actions.querySelectorAll("[data-object-complete-quest]").forEach(button=>button.onclick=()=>{completeQuest(button.dataset.objectCompleteQuest);renderWorldObjectQuestDialog();});
}
function openWorldObjectQuestDialog(obj,questIds=[]){
  if(!obj||!state)return false;activeObjectQuestId=obj.id;activeObjectQuestIds=[...new Set((Array.isArray(questIds)?questIds:[]).map(String).filter(Boolean))];
  if(!activeObjectQuestIds.length)return false;if(combatTarget)disengageCombat(false);closeNpcDialogue?.();closeStorageWindow?.();closeLootWindow?.();document.getElementById("objectQuestDialog")?.classList.add("show");renderWorldObjectQuestDialog();constrainFloatingPanel?.("objectQuestPanel");return true;
}
function closeWorldObjectQuestDialog(){activeObjectQuestId=null;activeObjectQuestIds=[];document.getElementById("objectQuestDialog")?.classList.remove("show");}

function openNpcDialogue(npc){
  if(!npc||!state) return false;
  activeNpcDialogId=npc.id;
  if(combatTarget) disengageCombat(false);
  // Conversation facing is temporary: the renderer turns the NPC toward the
  // player while this dialogue is open, without overwriting the NPC's authored
  // idle direction. Face the player toward the NPC as well for a natural exchange.
  heroFacing=vectorFacing(npc.x-state.x,npc.y-state.y,heroFacing);
  notifyQuestTalk(npc.id);
  document.getElementById("npcDialog")?.classList.add("show");
  renderNpcDialogue();
  constrainFloatingPanel?.("npcDialogPanel");
  return true;
}

function closeNpcDialogue(){
  activeNpcDialogId=null;
  document.getElementById("npcDialog")?.classList.remove("show");
}

function interactWithNpc(npc){
  if(!npc||!state) return false;
  const range=Math.max(42,numberOr(npc.interactRadius,58));
  if(dist(state.x,state.y,npc.x,npc.y)>range){
    toast(`Move closer to ${npc.name}.`);
    return false;
  }
  return openNpcDialogue(npc);
}

function interactWithNearestNpc(){
  if(isGameplayModalOpen()&&!overlayIsShown("npcDialog")) return false;
  if(overlayIsShown("npcDialog")){closeNpcDialogue();return true;}
  const npc=nearestInteractableNpc(76);
  if(!npc){toast("No one is close enough to talk to.");return false;}
  return interactWithNpc(npc);
}

function refreshQuestUI(){
  if(!state) return;
  refreshQuestReadyAnnouncements();
  const active=activeQuests();
  const tracked=trackedQuests();
  const chip=document.getElementById("questChip");
  if(chip){
    if(!tracked.length){
      chip.innerHTML=active.length
        ?`<div class="questTrackerEmpty"><b>Quests</b><span>${active.length} active • 0 tracked</span></div>`
        :'<div class="questTrackerEmpty"><b>Quests</b></div>';
      chip.classList.remove("complete");
    }else{
      chip.innerHTML=tracked.map(quest=>{
        const ready=getQuestStatus(quest)==="ready";
        const rows=quest.objectives.map((_,index)=>{
          const complete=questObjectiveComplete(quest,index);
          return `<div class="questTrackerObjective${complete?" complete":""}"><span>${complete?"✓":"•"}</span>${questEscape(questObjectiveText(quest,index))}</div>`;
        }).join("");
        return `<section class="questTrackerEntry${ready?" ready":""}"><div class="questTrackerTitle">${ready?'<span class="questTrackerReady">✓</span>':''}${questEscape(quest.title)}</div><div class="questTrackerObjectives">${rows}</div></section>`;
      }).join("");
      chip.classList.toggle("complete",tracked.every(quest=>getQuestStatus(quest)==="ready"));
    }
  }
  const menuQuest=document.getElementById("mQuest");
  if(menuQuest){
    menuQuest.textContent=active.length
      ?active.map(quest=>`${quest.title} — ${quest.objectives.map((_,index)=>questObjectiveText(quest,index)).join(" • ")}`).join(" | ")
      :"No active quests. Talk to NPCs with a ! marker.";
  }
  if(document.getElementById("questLog")?.classList.contains("show")) renderQuestLog();
  if(document.getElementById("npcDialog")?.classList.contains("show")) renderNpcDialogue();
}

// Unified world-object interaction runtime -----------------------------------
// Doors, gathering nodes, chests, quest props, portals, switches, and future
// world interactions all use the same data model. Builder-authored settings
// live on each world object under `interaction`.

const WORLD_INTERACTION_TYPES=new Set(["enter","gather","open","loot","examine","activate","custom"]);
const WORLD_INTERACTION_USE_MODES=new Set(["repeatable","once","timer"]);
let runtimeZoneTransitioning=false;

function currentWorldZoneId(){
  return String(state?.zoneId||window.LR_ACTIVE_PROJECT?.zone?.id||window.LR_BUILDER_PROJECT?.zone?.id||window.LR_ACTIVE_PROJECT?.manifest?.defaultZone||"default");
}

function worldInteractionDefaults(obj){
  const spec=worldObjectSpec(obj)||{w:48,h:48};
  const hb=obj?.hitbox||{};
  const w=Math.max(8,Math.min(spec.w,numberOr(hb.w,Math.round(spec.w*.45))));
  const h=Math.max(8,Math.min(spec.h,numberOr(hb.h,Math.round(spec.h*.28))));
  return {x:numberOr(hb.x,Math.round((spec.w-w)/2)),y:numberOr(hb.y,Math.round(spec.h-h)),w,h};
}

function worldObjectInteraction(obj){
  const raw=(obj?.interaction&&typeof obj.interaction==="object")?obj.interaction:{};
  const req=(raw.requirements&&typeof raw.requirements==="object")?raw.requirements:{};
  const actions=(raw.actions&&typeof raw.actions==="object")?raw.actions:{};
  const area=(raw.area&&typeof raw.area==="object")?raw.area:worldInteractionDefaults(obj);
  const type=WORLD_INTERACTION_TYPES.has(String(raw.type||"").toLowerCase())?String(raw.type).toLowerCase():"examine";
  const useMode=WORLD_INTERACTION_USE_MODES.has(String(raw.useMode||"").toLowerCase())?String(raw.useMode).toLowerCase():"repeatable";
  const prompt=String(raw.prompt||({enter:"Enter",gather:"Gather",open:"Open",loot:"Loot",examine:"Examine",activate:"Activate",custom:"Interact"}[type]||"Interact"));
  return {
    enabled:raw.enabled===true||(obj?.interactable===true&&Object.keys(raw).length>0),
    type,prompt,
    soundId:String(raw.soundId||"").trim(),
    range:Math.max(20,numberOr(raw.range,72)),
    clickable:raw.clickable!==false,
    keyable:raw.keyable!==false,
    tag:String(raw.tag||obj?.interactionTag||obj?.id||"").trim(),
    area:{x:numberOr(area.x,0),y:numberOr(area.y,0),w:Math.max(4,numberOr(area.w,16)),h:Math.max(4,numberOr(area.h,16))},
    requirements:{
      questId:String(req.questId||"").trim(),
      questState:["active","completed","not-completed"].includes(req.questState)?req.questState:"active",
      itemId:String(req.itemId||"").trim(),
      itemQty:Math.max(1,Math.floor(numberOr(req.itemQty,1)))
    },
    actions:{
      targetZone:String(actions.targetZone||"").trim(),
      targetX:Number.isFinite(Number(actions.targetX))?Number(actions.targetX):null,
      targetY:Number.isFinite(Number(actions.targetY))?Number(actions.targetY):null,
      giveItemId:String(actions.giveItemId||"").trim(),
      giveItemQty:Math.max(1,Math.floor(numberOr(actions.giveItemQty,1))),
      openMode:["storage","loot","simple"].includes(String(actions.openMode||"").toLowerCase())?String(actions.openMode).toLowerCase():(actions.lootTable?"loot":"simple"),
      lootTable:String(actions.lootTable||"").trim(),
      questIds:Array.isArray(actions.questIds)?actions.questIds.map(id=>String(id||"").trim()).filter(Boolean):[],
      questBehavior:actions.questBehavior==="start"?"start":"offer",
      consumeRequiredItem:actions.consumeRequiredItem===true,
      message:String(actions.message||"").trim()
    },
    useMode,
    resetSeconds:Math.max(1,numberOr(raw.resetSeconds,30)),
    hideWhenUsed:raw.hideWhenUsed===true
  };
}

function ensureWorldObjectState(){
  if(!state)return {};
  if(!state.worldObjectStates||typeof state.worldObjectStates!=="object"||Array.isArray(state.worldObjectStates))state.worldObjectStates={};
  return state.worldObjectStates;
}
function worldObjectStateKey(obj,zoneId=currentWorldZoneId()){return `${zoneId}:${obj?.id||obj?.type||"object"}`;}
function ensureWorldObjectRecord(obj,zoneId=currentWorldZoneId()){
  const all=ensureWorldObjectState(),key=worldObjectStateKey(obj,zoneId);
  if(!all[key]||typeof all[key]!=="object"||Array.isArray(all[key]))all[key]={};
  return all[key];
}
function worldObjectUseRecord(obj){return ensureWorldObjectState()[worldObjectStateKey(obj)]||null;}
function worldObjectIsUsed(obj,interaction=worldObjectInteraction(obj)){
  if(interaction.useMode==="repeatable")return false;
  const record=worldObjectUseRecord(obj);if(!record?.used)return false;
  if(interaction.useMode==="timer"){
    const elapsed=(Date.now()-numberOr(record.usedAt,0))/1000;
    if(elapsed>=interaction.resetSeconds){
      const record=ensureWorldObjectState()[worldObjectStateKey(obj)];
      if(record){delete record.used;delete record.usedAt;delete record.loot;}
      if(interaction.hideWhenUsed&&typeof rebuildWorldObjectCollision==="function")queueMicrotask(()=>rebuildWorldObjectCollision());
      return false;
    }
  }
  return true;
}
function markWorldObjectUsed(obj,interaction=worldObjectInteraction(obj)){
  if(interaction.useMode==="repeatable")return;
  const record=ensureWorldObjectRecord(obj);record.used=true;record.usedAt=Date.now();
}
function worldObjectIsHiddenByInteraction(obj){
  const cfg=worldObjectInteraction(obj);return cfg.enabled&&cfg.hideWhenUsed&&worldObjectIsUsed(obj,cfg);
}

function questRequirementRecord(id){return id?ensureQuestState()[id]||null:null;}
function worldInteractionAvailability(obj,cfg=worldObjectInteraction(obj)){
  if(!cfg.enabled)return {visible:false,available:false,message:""};
  if(worldObjectIsUsed(obj,cfg))return {visible:!cfg.hideWhenUsed,available:false,message:"Already used."};
  const req=cfg.requirements;
  if(req.questId){
    const rec=questRequirementRecord(req.questId);
    const completed=!!rec&&(rec.status==="completed"||numberOr(rec.completedCount,0)>0);
    const active=!!rec&&rec.status==="active";
    let met=req.questState==="completed"?completed:req.questState==="not-completed"?!completed:active;
    // Quest-gated scenery stays ordinary scenery until its quest condition is met.
    if(!met)return {visible:false,available:false,message:""};
  }
  if(req.itemId&&getItemCount(req.itemId)<req.itemQty){
    const def=getItemDefinition(req.itemId);return {visible:true,available:false,message:`Requires ${req.itemQty>1?`${req.itemQty}× `:""}${def.name}.`};
  }
  return {visible:true,available:true,message:""};
}

function worldInteractionAreaWorld(obj,cfg=worldObjectInteraction(obj)){
  return {x:obj.x+cfg.area.x,y:obj.y+cfg.area.y,w:cfg.area.w,h:cfg.area.h};
}
function worldInteractionCenter(obj,cfg=worldObjectInteraction(obj)){
  const a=worldInteractionAreaWorld(obj,cfg);return {x:a.x+a.w/2,y:a.y+a.h/2};
}
function pointInWorldInteraction(obj,wx,wy,cfg=worldObjectInteraction(obj)){
  const a=worldInteractionAreaWorld(obj,cfg);return wx>=a.x&&wx<=a.x+a.w&&wy>=a.y&&wy<=a.y+a.h;
}

function findInteractableWorldObjectAt(wx,wy){
  const sorted=[...sceneryProps].sort((a,b)=>worldObjectRenderDepth(b,state.y)-worldObjectRenderDepth(a,state.y));
  for(const obj of sorted){
    const cfg=worldObjectInteraction(obj),availability=worldInteractionAvailability(obj,cfg);
    if(!cfg.enabled||!cfg.clickable||!availability.visible)continue;
    if(pointInWorldInteraction(obj,wx,wy,cfg))return obj;
  }
  return null;
}

function nearestInteractableWorldObject(range=84){
  let best=null,bestDist=Infinity;
  for(const obj of sceneryProps){
    const cfg=worldObjectInteraction(obj),availability=worldInteractionAvailability(obj,cfg);
    if(!cfg.enabled||!cfg.keyable||!availability.visible)continue;
    const c=worldInteractionCenter(obj,cfg),d=dist(state.x,state.y,c.x,c.y),allowed=Math.max(range,cfg.range);
    if(d<=allowed&&d<bestDist){best=obj;bestDist=d;}
  }
  return best;
}

function nearestLootPileForInteract(range=84){
  let best=null,bestDist=Infinity;
  for(const pile of lootPiles){
    if(!lootPileHasLoot(pile))continue;const d=dist(state.x,state.y,pile.x,pile.y);
    if(d<=range&&d<bestDist){best=pile;bestDist=d;}
  }
  return best;
}

function notifyQuestInteract(target){
  if(!target)return false;let changed=false;
  for(const quest of questDefinitions){
    if(getQuestStatus(quest)!=="active")continue;
    quest.objectives.forEach((objective,index)=>{if(objective.type==="interact"&&objective.target===target)changed=updateStoredQuestObjective(quest,index,1)||changed;});
  }
  if(changed)refreshQuestUI();return changed;
}

function worldInteractionItemPrecheck(cfg){
  const id=cfg.actions.giveItemId;if(!id)return true;
  if(!ITEM_DEFS[id]){toast(`Unknown item: ${id}`);return false;}
  if(!canAddItem(id,cfg.actions.giveItemQty)){toast("Make room in your backpack first.");return false;}
  return true;
}

function applyRuntimeZoneVisualSettings(pack){
  const visual=pack?.visualSettings;if(!visual||typeof visual!=="object")return;
  for(const key of Object.keys(VISUAL_SCALE))if(Number.isFinite(Number(visual[key])))VISUAL_SCALE[key]=visualScaleOr(visual[key],VISUAL_SCALE[key]);
  if(visual.remnants&&typeof visual.remnants==="object"){
    if(Number.isFinite(Number(visual.remnants.scale)))LOOT_REMNANT_VISUAL.scale=visualScaleOr(visual.remnants.scale,LOOT_REMNANT_VISUAL.scale);
    const mode=String(visual.remnants.depthMode||"").toLowerCase();if(LOOT_REMNANT_DEPTH_MODES.has(mode))LOOT_REMNANT_VISUAL.depthMode=mode;
    if(Number.isFinite(Number(visual.remnants.depthY)))LOOT_REMNANT_VISUAL.depthY=Number(visual.remnants.depthY);
  }
}

async function runtimeZonePack(zoneId){
  const cached=window.LR_PROJECT_ZONE_PACKS?.[zoneId];if(cached)return cloneWorldObject(cached);
  const manifest=window.LR_ACTIVE_PROJECT?.manifest;const zone=(manifest?.zones||[]).find(z=>z.id===zoneId);if(!zone?.pack)throw new Error(`Zone '${zoneId}' is not in the project`);
  const response=await fetch(`./${zone.pack}?lrzone=${Date.now().toString(36)}`,{cache:"no-store"});if(!response.ok)throw new Error(`${zone.pack} HTTP ${response.status}`);
  return response.json();
}

async function transitionToWorldZone(zoneId,{x=null,y=null,quiet=false}={}){
  if(!zoneId||runtimeZoneTransitioning)return false;
  if(window.LR_BUILDER_MODE&&typeof switchDeveloperZone==="function"){
    const target=developerZoneById(zoneId);if(!target){devSetStatus(`Interaction target zone '${zoneId}' does not exist`);return false;}
    if(!devProjectDirectoryHandle){devSetStatus("Open the Little Realm Project Folder to travel between Builder zones");return false;}
    await switchDeveloperZone(zoneId);
    if(Number.isFinite(Number(x))&&Number.isFinite(Number(y))){state.x=Number(x);state.y=Number(y);lastSafePos={x:state.x,y:state.y};}
    state.zoneId=zoneId;return true;
  }
  runtimeZoneTransitioning=true;
  try{
    const pack=await runtimeZonePack(zoneId);
    stopWorldAudioEmitters();
    if(typeof disengageCombat==="function"&&combatTarget)disengageCombat(false);
    selectedTarget=null;clearLootPiles();closeNpcDialogue?.();closeStorageWindow?.();closeWorldObjectQuestDialog?.();
    window.LR_ZONE_SETTINGS=pack.zoneSettings&&typeof pack.zoneSettings==="object"?pack.zoneSettings:{};
    applyWorldZoneDefinition(window.LR_ZONE_SETTINGS,pack.terrain);
    buildScenery({worldObjects:pack.worldObjects||[],npcs:pack.npcs||[]});
    window.LR_MOB_SPAWNS=Array.isArray(pack.mobSpawns)?cloneWorldObject(pack.mobSpawns):[];
    applyRuntimeZoneVisualSettings(pack);
    state.zoneId=zoneId;
    state.x=Number.isFinite(Number(x))?Number(x):START_X;state.y=Number.isFinite(Number(y))?Number(y):START_Y;
    if(!canStand(state.x,state.y)){state.x=START_X;state.y=START_Y;}
    lastSafePos={x:state.x,y:state.y};resetFootstepTracking();spawnMobs();applyZoneAudioFromCurrentSettings();
    const manifest=window.LR_ACTIVE_PROJECT?.manifest;const zone=(manifest?.zones||[]).find(z=>z.id===zoneId)||{id:zoneId,name:zoneId};
    if(window.LR_ACTIVE_PROJECT)window.LR_ACTIVE_PROJECT.zone=zone;
    updateUI();if(!quiet)toast(`Entered ${zone.name||zone.id}.`);return true;
  }catch(err){console.error(err);toast(`Could not enter ${zoneId}.`);return false;}
  finally{runtimeZoneTransitioning=false;}
}

function worldObjectLootRecord(obj,cfg=worldObjectInteraction(obj)){
  const record=ensureWorldObjectRecord(obj);
  if(!record.loot||typeof record.loot!=="object"||Array.isArray(record.loot)){
    const drops=cfg.actions.lootTable?rollLootTable(cfg.actions.lootTable,{level:state?.level||1}):[];
    record.loot={items:normalizePendingLoot(drops),gold:0,potions:0,rolledAt:Date.now()};
  }
  return record.loot;
}
function completeWorldObjectLoot(obj,cfg){
  const record=ensureWorldObjectRecord(obj);
  if(cfg.useMode==="repeatable"){delete record.loot;}
  else markWorldObjectUsed(obj,cfg);
  if(cfg.hideWhenUsed)rebuildWorldObjectCollision();
}
function openWorldObjectLoot(obj,cfg=worldObjectInteraction(obj)){
  if(!cfg.actions.lootTable){toast(`${obj.label||"It"} is empty.`);if(cfg.useMode!=="repeatable")markWorldObjectUsed(obj,cfg);return false;}
  const loot=worldObjectLootRecord(obj,cfg);
  const pile={id:`object-${worldObjectStateKey(obj)}`,x:obj.x+(worldObjectSpec(obj)?.w||0)/2,y:obj.y+(worldObjectSpec(obj)?.h||0),sourceLabel:obj.label||cfg.prompt,items:loot.items,gold:Math.max(0,Math.floor(numberOr(loot.gold,0))),potions:Math.max(0,Math.floor(numberOr(loot.potions,0))),createdAt:performance.now(),expiresAt:Infinity};
  if(!lootPileHasLoot(pile)){completeWorldObjectLoot(obj,cfg);toast(`${obj.label||"It"} is empty.`);return false;}
  return openPersistentLootWindow(pile,()=>completeWorldObjectLoot(obj,cfg));
}
function applyWorldObjectQuestActions(obj,cfg){
  const ids=cfg.actions.questIds||[];
  if(!ids.length)return {handled:false,started:0};
  if(cfg.actions.questBehavior==="start"){
    let started=0;
    for(const id of ids)if(getQuestStatus(id)==="available"&&acceptQuest(id))started++;
    if(!started)openWorldObjectQuestDialog(obj,ids);
    return {handled:true,started};
  }
  openWorldObjectQuestDialog(obj,ids);
  return {handled:true,started:0};
}

async function interactWithWorldObject(obj){
  if(!obj||runtimeZoneTransitioning)return false;
  const cfg=worldObjectInteraction(obj),availability=worldInteractionAvailability(obj,cfg);
  if(!availability.visible)return false;
  const c=worldInteractionCenter(obj,cfg);if(dist(state.x,state.y,c.x,c.y)>cfg.range){toast(`Move closer to ${cfg.prompt.toLowerCase()}.`);return false;}
  if(!availability.available){if(availability.message)toast(availability.message);return false;}
  if(!worldInteractionItemPrecheck(cfg))return false;

  if(cfg.soundId){const opts={bus:"sfx",volume:.9,x:obj.x,y:obj.y,radius:300};if(audioSetLibrary()?.[cfg.soundId])playAudioSet(cfg.soundId,opts);else playAudioClip(cfg.soundId,opts);}
  const req=cfg.requirements,act=cfg.actions;
  const storageOpen=cfg.type==="open"&&act.openMode==="storage";
  const lootOpen=(cfg.type==="open"&&act.openMode==="loot")||cfg.type==="loot";
  if(storageOpen){
    openStorageContainer(obj);
  }else if(lootOpen){
    openWorldObjectLoot(obj,cfg);
  }else{
    if(act.giveItemId){const result=addItem(act.giveItemId,act.giveItemQty);if(result.added<act.giveItemQty){toast("Make room in your backpack first.");return false;}}
    if(act.lootTable)openWorldObjectLoot(obj,cfg);
  }
  if(act.consumeRequiredItem&&req.itemId)removeItem(req.itemId,req.itemQty);
  notifyQuestInteract(cfg.tag||obj.id);
  const questResult=applyWorldObjectQuestActions(obj,cfg);
  if(!storageOpen&&!lootOpen&&!act.lootTable&&cfg.useMode!=="repeatable"){
    // A one-time discovery object should not burn itself while its auto-start
    // quest is still locked/unavailable. Notice-board style quest offers are
    // intentionally controlled by their normal Repeatable/Once/Timer setting.
    const autoQuestOnly=questResult.handled&&act.questBehavior==="start"&&!act.giveItemId&&!act.targetZone;
    if(!autoQuestOnly||questResult.started>0)markWorldObjectUsed(obj,cfg);
  }
  if(act.message)toast(act.message);
  else if(act.giveItemId)toast(`${cfg.prompt}: +${act.giveItemQty} ${getItemDefinition(act.giveItemId).name}`);
  if(cfg.hideWhenUsed&&worldObjectIsUsed(obj,cfg))rebuildWorldObjectCollision();
  updateUI();refreshQuestUI?.();
  if(act.targetZone)return transitionToWorldZone(act.targetZone,{x:act.targetX,y:act.targetY});
  return true;
}

function interactWithNearestWorldTarget(){
  if(isGameplayModalOpen())return false;
  const npc=nearestInteractableNpc(72),obj=nearestInteractableWorldObject(72),pile=nearestLootPileForInteract(84);
  const choices=[];
  if(npc)choices.push({kind:"npc",value:npc,d:dist(state.x,state.y,npc.x,npc.y)});
  if(obj){const c=worldInteractionCenter(obj);choices.push({kind:"object",value:obj,d:dist(state.x,state.y,c.x,c.y)});}
  if(pile)choices.push({kind:"loot",value:pile,d:dist(state.x,state.y,pile.x,pile.y)});
  choices.sort((a,b)=>a.d-b.d);const best=choices[0];if(!best)return false;
  if(best.kind==="npc")return interactWithNpc(best.value);
  if(best.kind==="loot")return interactWithLootPile(best.value);
  return interactWithWorldObject(best.value);
}

function drawWorldInteractionHint(camX,camY){
  if(!state||isGameplayModalOpen())return;
  const obj=nearestInteractableWorldObject(88);if(!obj)return;
  const cfg=worldObjectInteraction(obj),availability=worldInteractionAvailability(obj,cfg);if(!availability.visible)return;
  const a=worldInteractionAreaWorld(obj,cfg),cx=a.x+a.w/2-camX,cy=a.y-camY-8;
  const text=availability.available?`E • ${cfg.prompt}`:availability.message;if(!text)return;
  ctx.save();ctx.font="800 8px system-ui";ctx.textAlign="center";const width=Math.max(42,ctx.measureText(text).width+12);
  ctx.fillStyle="rgba(28,22,31,.88)";ctx.strokeStyle=availability.available?"rgba(145,235,179,.9)":"rgba(224,186,112,.9)";ctx.lineWidth=1/CAMERA_ZOOM;
  ctx.beginPath();ctx.roundRect(cx-width/2,cy-14,width,16,5);ctx.fill();ctx.stroke();ctx.fillStyle="#f7f1fb";ctx.fillText(text,cx,cy-3);ctx.restore();
}

// Persistent world-object storage containers ---------------------------------
// Storage contents live inside state.worldObjectStates so player saves keep
// whatever was deposited. Objects only define capacity and optional starting
// contents; the engine owns transfer/stacking behavior.
let activeStorageObject=null;
let storagePointerDrag=null;
let suppressStorageClick=false;
let storageInteractionsBound=false;

function storageCapacityForObject(obj){
  return Math.max(1,Math.min(60,Math.floor(numberOr(obj?.capacity,8))));
}

function normalizeStorageSlots(value,capacity){
  const slots=Array.from({length:capacity},()=>null);
  if(!Array.isArray(value))return slots;
  let cursor=0;
  for(let i=0;i<value.length&&cursor<capacity;i++){
    const raw=value[i];
    if(!raw||typeof raw.id!=="string"||!ITEM_DEFS[raw.id])continue;
    let qty=Math.max(0,Math.floor(numberOr(raw.qty,0)));if(qty<=0)continue;
    const def=getItemDefinition(raw.id);
    while(qty>0&&cursor<capacity){const moved=Math.min(qty,def.stackLimit);slots[cursor++]={id:raw.id,qty:moved};qty-=moved;}
  }
  return slots;
}

function storageRecordForObject(obj){
  if(!obj)return null;
  const record=ensureWorldObjectRecord(obj);
  const capacity=storageCapacityForObject(obj);
  if(!Array.isArray(record.storage)||record.storage.length!==capacity){
    const source=Array.isArray(record.storage)?record.storage:(Array.isArray(obj.contents)?obj.contents:[]);
    record.storage=normalizeStorageSlots(source,capacity);
  }
  return record;
}

function storageSlotsForObject(obj){return storageRecordForObject(obj)?.storage||[];}
function storageUsedSlots(obj){return storageSlotsForObject(obj).reduce((n,slot)=>n+(slot?1:0),0);}

function storageCapacityForItem(obj,itemId){
  const def=getItemDefinition(itemId);let capacity=0;
  for(const slot of storageSlotsForObject(obj)){
    if(!slot)capacity+=def.stackLimit;
    else if(slot.id===itemId)capacity+=Math.max(0,def.stackLimit-slot.qty);
  }
  return capacity;
}

function placeItemInStorageSlot(obj,itemId,qty,targetIndex){
  const slots=storageSlotsForObject(obj),index=Math.floor(numberOr(targetIndex,-1));
  const requested=Math.max(0,Math.floor(numberOr(qty,0)));
  if(!obj||!ITEM_DEFS[itemId]||requested<=0||index<0||index>=slots.length)return {added:0,remaining:requested,blocked:true};
  const def=getItemDefinition(itemId),target=slots[index];
  if(target&&target.id!==itemId)return {added:0,remaining:requested,blocked:true};
  const room=target?Math.max(0,def.stackLimit-target.qty):def.stackLimit,moved=Math.min(requested,room);
  if(moved>0){if(target)target.qty+=moved;else slots[index]={id:itemId,qty:moved};}
  return {added:moved,remaining:requested-moved,blocked:moved<=0};
}

function addItemToStorage(obj,itemId,qty=1){
  const slots=storageSlotsForObject(obj),def=getItemDefinition(itemId);let remaining=Math.max(0,Math.floor(numberOr(qty,0))),requested=remaining;
  if(!obj||!ITEM_DEFS[itemId]||remaining<=0)return {added:0,remaining:requested};
  for(const slot of slots){if(remaining<=0)break;if(!slot||slot.id!==itemId||slot.qty>=def.stackLimit)continue;const moved=Math.min(remaining,def.stackLimit-slot.qty);slot.qty+=moved;remaining-=moved;}
  for(let i=0;i<slots.length&&remaining>0;i++){if(slots[i])continue;const moved=Math.min(remaining,def.stackLimit);slots[i]={id:itemId,qty:moved};remaining-=moved;}
  return {added:requested-remaining,remaining};
}

function moveStorageSlot(obj,fromIndex,toIndex){
  const slots=storageSlotsForObject(obj),from=Math.floor(numberOr(fromIndex,-1)),to=Math.floor(numberOr(toIndex,-1));
  if(from<0||to<0||from>=slots.length||to>=slots.length||from===to||!slots[from])return false;
  const source=slots[from],target=slots[to];
  if(!target){slots[to]=source;slots[from]=null;}
  else if(target.id===source.id){const def=getItemDefinition(source.id),moved=Math.min(source.qty,Math.max(0,def.stackLimit-target.qty));if(moved<=0)return false;target.qty+=moved;source.qty-=moved;if(source.qty<=0)slots[from]=null;}
  else{slots[to]=source;slots[from]=target;}
  renderStorageWindow();return true;
}

function transferStorageToInventory(storageIndex,targetInventorySlot=null){
  const obj=activeStorageObject,slots=storageSlotsForObject(obj),index=Math.floor(numberOr(storageIndex,-1)),slot=slots[index];if(!slot)return false;
  const result=targetInventorySlot==null?addItem(slot.id,slot.qty):placeItemInInventorySlot(slot.id,slot.qty,targetInventorySlot);
  if(result.added<=0){toast(targetInventorySlot==null?"Your backpack is full.":"That backpack slot cannot accept this item.");return false;}
  slot.qty=result.remaining;if(slot.qty<=0)slots[index]=null;renderStorageWindow();return true;
}

function transferInventoryToStorage(inventoryIndex,targetStorageSlot=null){
  ensureInventoryState();const index=Math.floor(numberOr(inventoryIndex,-1)),slot=state.inventory[index];if(!slot||!activeStorageObject)return false;
  const result=targetStorageSlot==null?addItemToStorage(activeStorageObject,slot.id,slot.qty):placeItemInStorageSlot(activeStorageObject,slot.id,slot.qty,targetStorageSlot);
  if(result.added<=0){toast(targetStorageSlot==null?"This container is full.":"That container slot cannot accept this item.");return false;}
  slot.qty=result.remaining;if(slot.qty<=0)state.inventory[index]=null;refreshInventoryViews();renderStorageWindow();return true;
}

function storageSlotMarkup(slot,index){
  if(!slot)return `<button class="inventorySlot empty storageSlot" data-storage-slot="${index}" aria-label="Empty storage slot ${index+1}"><span class="slotNumber">${index+1}</span></button>`;
  const def=getItemDefinition(slot.id);return `<button class="inventorySlot storageSlot" data-storage-slot="${index}" aria-label="${inventoryEscape(def.name)}, quantity ${slot.qty}">${itemVisualMarkup(def)}<span class="itemQty">${slot.qty}</span></button>`;
}

function renderStorageWindow(){
  if(!activeStorageObject)return;
  const title=document.getElementById("storageTitle"),count=document.getElementById("storageCapacity"),grid=document.getElementById("storageGrid"),bag=document.getElementById("storageInventoryGrid");
  if(title)title.textContent=activeStorageObject.label||worldObjectDefinition(activeStorageObject)?.name||"Storage";
  if(count)count.textContent=`${storageUsedSlots(activeStorageObject)} / ${storageCapacityForObject(activeStorageObject)}`;
  if(grid)grid.innerHTML=storageSlotsForObject(activeStorageObject).map(storageSlotMarkup).join("");
  if(bag)renderInventoryGrid(bag);
}

function openStorageContainer(obj){
  if(!obj||!state)return false;activeStorageObject=obj;storageRecordForObject(obj);closeLootWindow?.();closeBackpack?.();renderStorageWindow();document.getElementById("storageWindow")?.classList.add("show");constrainFloatingPanel?.("storagePanel");return true;
}
function closeStorageWindow(){activeStorageObject=null;document.getElementById("storageWindow")?.classList.remove("show");}

function storagePointerDown(event){
  if(event.button!=null&&event.button!==0||!activeStorageObject)return;
  const storageSlot=event.target.closest?.(".storageSlot[data-storage-slot]");
  const inventorySlot=event.target.closest?.("#storageInventoryGrid .inventorySlot[data-slot]");
  let sourceKind="",index=-1,slot=null;
  if(storageSlot){sourceKind="storage";index=Number(storageSlot.dataset.storageSlot);slot=storageSlotsForObject(activeStorageObject)[index];}
  else if(inventorySlot){ensureInventoryState();sourceKind="inventory";index=Number(inventorySlot.dataset.slot);slot=state.inventory[index];}
  if(!slot)return;
  storagePointerDrag={pointerId:event.pointerId,sourceKind,index,startX:event.clientX,startY:event.clientY,active:false,ghost:null};
  (storageSlot||inventorySlot).setPointerCapture?.(event.pointerId);
}
function storagePointerMove(event){
  const drag=storagePointerDrag;if(!drag||event.pointerId!==drag.pointerId)return;
  if(!drag.active&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<6)return;
  if(!drag.active){const slot=drag.sourceKind==="storage"?storageSlotsForObject(activeStorageObject)[drag.index]:state.inventory[drag.index];if(!slot){storagePointerDrag=null;return;}drag.active=true;drag.ghost=createInventoryDragGhost(slot);document.getElementById("storagePanel")?.classList.add("inventoryDragging");}
  event.preventDefault?.();positionItemDragGhost(drag.ghost,event.clientX,event.clientY);
}
function storagePointerUp(event){
  const drag=storagePointerDrag;if(!drag||event.pointerId!==drag.pointerId)return;storagePointerDrag=null;document.getElementById("storagePanel")?.classList.remove("inventoryDragging");drag.ghost?.remove?.();if(!drag.active)return;
  event.preventDefault?.();suppressStorageClick=true;setTimeout(()=>{suppressStorageClick=false;},0);
  const target=document.elementFromPoint?.(event.clientX,event.clientY)||null,storageTarget=target?.closest?.(".storageSlot[data-storage-slot]"),inventoryTarget=target?.closest?.("#storageInventoryGrid .inventorySlot[data-slot]");
  if(drag.sourceKind==="storage"){
    if(inventoryTarget)transferStorageToInventory(drag.index,Number(inventoryTarget.dataset.slot));
    else if(storageTarget)moveStorageSlot(activeStorageObject,drag.index,Number(storageTarget.dataset.storageSlot));
    else if(target?.closest?.("#storageBagSection"))transferStorageToInventory(drag.index);
  }else{
    if(storageTarget)transferInventoryToStorage(drag.index,Number(storageTarget.dataset.storageSlot));
    else if(inventoryTarget)moveInventorySlot(drag.index,Number(inventoryTarget.dataset.slot));
    else if(target?.closest?.("#storageContainerSection"))transferInventoryToStorage(drag.index);
  }
}
function handleStorageClick(event){
  if(suppressStorageClick)return;
  const storageSlot=event.target.closest?.(".storageSlot[data-storage-slot]");if(storageSlot){transferStorageToInventory(Number(storageSlot.dataset.storageSlot));return;}
  const inventorySlot=event.target.closest?.("#storageInventoryGrid .inventorySlot[data-slot]");if(inventorySlot)transferInventoryToStorage(Number(inventorySlot.dataset.slot));
}
function bindStorageInteractions(){
  if(storageInteractionsBound)return;storageInteractionsBound=true;const panel=document.getElementById("storagePanel");panel?.addEventListener("pointerdown",storagePointerDown);panel?.addEventListener("click",handleStorageClick);document.addEventListener("pointermove",storagePointerMove,{passive:false});document.addEventListener("pointerup",storagePointerUp,{passive:false});document.addEventListener("pointercancel",storagePointerUp,{passive:false});
}

window.LR_STORAGE=Object.freeze({open:openStorageContainer,close:closeStorageWindow,getSlots:obj=>storageSlotsForObject(obj).map(slot=>slot?{...slot}:null),deposit:transferInventoryToStorage,withdraw:transferStorageToInventory});

const DEV_DRAFT_KEY = "littleRealmWorldBuilderDraft";
let devModeActive=false;
let devPanel=null;
let devSelected=null;
let devPlaceType=null;
let devDragging=false;
let devDragOffset={x:0,y:0};
let devHitboxEditing=false;
let devHitboxDrag=null;
let devDepthEditing=false;
let devDepthDrag=null;
let devInteractionEditing=false;
let devInteractionDrag=null;
let devSizeEditing=false;
let devSizeDrag=null;
let devShowGrid=true;
let devShowHitboxes=true;
let devShowDepthLines=true;
let devSnap=8;
let devStatusTimer=null;
let devSelectedMob=null;
let devSelectedNpc=null;
let devNpcDragging=false;
let devNpcDragOffset={x:0,y:0};
let devPlaceNpcAsset=null;
let devPlaceMobType=null;
let devSelectedSpawnId=null;
let devSpawnDragging=false;
let devSpawnDragOffset={x:0,y:0};
let devSelectedQuestId=null;
let devQuestFormDraft=null;
let devActiveTab="objects";
let devRepeatPlacement=false;
let devTabScrollPositions={};
let devCombatMobType=Object.keys(BALANCE.mobs||{})[0]||null;
let devPlayerTestBaseline=null;
let devSelectedRemnant=null;
let devRemnantPreview=null;
let devRemnantDragging=false;
let devRemnantDragOffset={x:0,y:0};
const DEV_PROJECT_BALANCE=JSON.parse(JSON.stringify(BALANCE));
let devProjectDirectoryHandle=null;
let devProjectManifest=(typeof window!=="undefined"?window.LR_BUILDER_PROJECT?.manifest:null)||null;
let devProjectZone=(typeof window!=="undefined"?window.LR_BUILDER_PROJECT?.zone:null)||null;
let devProjectSharedContentPath=(typeof window!=="undefined"?window.LR_BUILDER_PROJECT?.manifest?.sharedContent:null)||"content/shared/content-library.json";
let devZoneBaselinePack=JSON.parse(JSON.stringify((typeof window!=="undefined"?window.LR_BUILDER_PROJECT?.pack:null)||{}));
let devProjectSharedBaseline=JSON.parse(JSON.stringify((typeof window!=="undefined"&&window.LR_SHARED_CONTENT)||{}));
let devZoneSelectedId=devProjectZone?.id||null;
const DEV_PROJECT_ITEMS=JSON.parse(JSON.stringify(ITEM_DEFS));
const DEV_PROJECT_LOOT_TABLES=JSON.parse(JSON.stringify(LOOT_TABLES));
const DEV_PROJECT_MOB_SPAWNS=JSON.parse(JSON.stringify((typeof window!=="undefined"&&window.LR_MOB_SPAWNS)||[]));
const DEV_PROJECT_ASSETS=JSON.parse(JSON.stringify((typeof window!=="undefined"&&window.LR_ASSETS)||{}));
const DEV_PROJECT_OBJECT_DEFINITIONS=JSON.parse(JSON.stringify((typeof window!=="undefined"&&window.LR_OBJECT_DEFINITIONS)||{}));
const DEV_PROJECT_TERRAINS=JSON.parse(JSON.stringify((typeof window!=="undefined"&&window.LR_TERRAINS)||{}));
const DEV_PROJECT_TERRAIN_DEFAULTS=JSON.parse(JSON.stringify((typeof window!=="undefined"&&window.LR_TERRAIN_DEFAULTS)||{}));
const DEV_PROJECT_ART_REFERENCES=JSON.parse(JSON.stringify((typeof window!=="undefined"&&window.LR_SHARED_CONTENT?.artReferences)||{}));
const DEV_PROJECT_CHARACTER_DEFAULTS=JSON.parse(JSON.stringify((typeof window!=="undefined"&&window.LR_SHARED_CONTENT?.characterDefaults)||{}));
const DEV_PROJECT_AUDIO_CLIPS=JSON.parse(JSON.stringify((typeof window!=="undefined"&&window.LR_SHARED_CONTENT?.audioClips)||{}));
const DEV_PROJECT_AUDIO_SETS=JSON.parse(JSON.stringify((typeof window!=="undefined"&&window.LR_SHARED_CONTENT?.audioSets)||{}));
const DEV_PROJECT_AUDIO_EVENTS=JSON.parse(JSON.stringify((typeof window!=="undefined"&&window.LR_SHARED_CONTENT?.audioEvents)||{}));
let devMobSpawns=JSON.parse(JSON.stringify(DEV_PROJECT_MOB_SPAWNS));
let devAssets=JSON.parse(JSON.stringify(DEV_PROJECT_ASSETS));
let devObjectDefinitions=JSON.parse(JSON.stringify(DEV_PROJECT_OBJECT_DEFINITIONS));
let devTerrains=JSON.parse(JSON.stringify(DEV_PROJECT_TERRAINS));
let devTerrainDefaults=JSON.parse(JSON.stringify(DEV_PROJECT_TERRAIN_DEFAULTS));
let devArtReferences=JSON.parse(JSON.stringify(DEV_PROJECT_ART_REFERENCES));
let devCharacterDefaults=JSON.parse(JSON.stringify(DEV_PROJECT_CHARACTER_DEFAULTS));
let devAudioClips=JSON.parse(JSON.stringify(DEV_PROJECT_AUDIO_CLIPS));
let devAudioSets=JSON.parse(JSON.stringify(DEV_PROJECT_AUDIO_SETS));
let devAudioEvents=JSON.parse(JSON.stringify(DEV_PROJECT_AUDIO_EVENTS));
let devAudioSelectedId=Object.keys(devAudioClips)[0]||null;
let devAudioSelectedSetId=Object.keys(devAudioSets)[0]||null;
let devAudioLibraryMode="clips";
let devTerrainSelectedId=Object.keys(devTerrains)[0]||null;
let devAssetSelectedId=null;
let devArtPromptDraft={kind:"mob",sizeClass:"medium",subject:"",description:"",palette:"",constraints:""};
let devContentType="mobs";
let devContentSelectedId=null;
let devTerrainBrush=Object.keys(devTerrains)[0]||"";
let devTerrainBrushSize=1;
let devTerrainPainting=false;
let devTerrainDirty=false;
let devTerrainLastTileKey=null;
let devTerrainHoverTile=null;

// Builder-only camera state. Gameplay always returns to the normal player-follow camera.
let devCameraMode="player"; // player | free | world
let devCameraX=null;
let devCameraY=null;
let devCameraZoom=CAMERA_ZOOM;
let devCameraKeys={up:false,down:false,left:false,right:false};
let devCameraPanDrag=null;

const DEV_SETTING_HELP={
  "mob sprite asset":{title:"Mob Sprite Asset",text:"The 4 × 4 sprite sheet used to draw this mob in the world. Changing the asset changes its appearance, not its gameplay size.",example:"Two different 512 × 512 wolf sheets can use the same 48 px Visible World Height and appear the same size in-game."},
  "world size class":{title:"World Size Class",text:"A friendly size preset for a mob. Choosing a preset fills in a standard visible height; Custom is used when you pick a height between presets.",example:"Medium is a normal creature-sized preset. Boss is much larger."},
  "visible world height":{title:"Visible World Height",text:"The mob's actual visible height in world pixels after transparent padding is ignored. This is the main control for how large a mob looks in-game.",example:"If the player reference is about 60 px tall, a 48 px mob is roughly 0.80× the player's height."},
  "combat portrait scale":{title:"Combat Portrait Scale",text:"Controls only how large the enemy sprite appears in the battle UI. It does not change the mob's size in the world.",example:"Increase this if a small creature looks tiny in the battle portrait while keeping its world size unchanged."},
  "level":{title:"Level",text:"The mob's core tuning level. When Auto-fill Stats is enabled, this level provides the baseline HP, ATK, DEF, and XP values.",example:"A Level 5 mob can use the standard Level 5 baseline, then be fine-tuned with multipliers or manual stats."},
  "spawn min lv":{title:"Spawn Min Level",text:"The lowest level an individual spawn of this mob type may use.",example:"Min 3 and Max 5 lets different spawn points appear as Level 3, 4, or 5 mobs."},
  "spawn max lv":{title:"Spawn Max Level",text:"The highest level an individual spawn of this mob type may use.",example:"Min 3 and Max 5 creates a small level range while the core Level remains the stat anchor."},
  "hp":{title:"HP",text:"How much damage the mob can take before it is defeated.",example:"A mob with 100 HP is defeated after taking a total of 100 effective damage."},
  "atk":{title:"ATK",text:"The mob's attack power used by combat damage calculations.",example:"Raising ATK makes the mob hit harder without changing how often it attacks."},
  "def":{title:"DEF",text:"The mob's defense value used to reduce incoming damage.",example:"A higher DEF mob can take less damage from the same player attack."},
  "xp multiplier":{title:"XP Multiplier",text:"Multiplies the normal experience reward for the mob's level.",example:"1.0 gives normal XP; 1.5 gives 50% more; 0.5 gives half."},
  "elite chance %":{title:"Elite Chance",text:"The percentage chance for a normal spawn of this mob type to become Elite. Bosses do not roll Elite.",example:"10 means roughly one out of ten eligible spawns becomes Elite over many rolls."},
  "attack sec":{title:"Attack Seconds",text:"The delay in seconds between the mob's attacks during combat.",example:"1.5 attacks about once every 1.5 seconds; 0.8 attacks much faster."},
  "aggro range":{title:"Aggro Range",text:"How close the player must get before an aggressive mob starts engaging them on its own.",example:"With Aggro Range 58, an aggressive mob begins combat behavior when the player comes within roughly 58 world pixels."},
  "alert range":{title:"Alert Range",text:"The broader awareness distance used while the mob is reacting to nearby player activity. It is normally equal to or larger than Aggro Range.",example:"Aggro 58 and Alert 82 gives the mob a smaller engage radius inside a wider awareness area."},
  "chase speed":{title:"Chase Speed",text:"How fast the mob moves while pursuing a player after it has engaged.",example:"Chase Speed 58 moves much faster than Wander Speed 10, so the mob strolls while idle but runs when chasing."},
  "wander speed":{title:"Wander Speed",text:"How fast the mob moves during its normal idle wandering.",example:"A value around 10 creates a slow patrol; increasing it makes idle movement more active."},
  "leash":{title:"Leash Distance",text:"How far the mob is allowed to move away from its home/spawn point before it gives up and returns.",example:"Leash 120 means the mob can chase roughly 120 world pixels from home before returning."},
  "return speed":{title:"Return Speed",text:"How fast the mob travels back to its home point after its leash is broken.",example:"Return Speed 34 can be slower than Chase Speed 58 so the mob runs at the player but walks back home."},
  "wander delay min":{title:"Wander Delay Min",text:"The shortest idle pause, in seconds, before the mob chooses another wander movement.",example:"Min 1.2 and Max 4 means each idle pause is randomly chosen between 1.2 and 4 seconds."},
  "wander delay max":{title:"Wander Delay Max",text:"The longest idle pause, in seconds, before the mob chooses another wander movement.",example:"Min 1.2 and Max 4 makes the mob wait a random 1.2–4 seconds between wandering decisions."},
  "respawn min":{title:"Respawn Min",text:"The shortest time, in seconds, before a defeated normal mob can respawn. Bosses do not use normal respawning.",example:"Min 18 and Max 28 gives each respawn a random delay between 18 and 28 seconds."},
  "respawn max":{title:"Respawn Max",text:"The longest time, in seconds, before a defeated normal mob can respawn.",example:"Min 18 and Max 28 prevents every copy of the mob from respawning on the exact same timer."},
  "aggro":{title:"Aggro Sound",text:"The audio cue played when this mob notices and engages the player.",example:"A wolf might use a growl here, while a slime could use a wet alert sound."},
  "attack":{title:"Attack Sound",text:"The audio cue played when this mob performs an attack.",example:"Use a bite, swing, or impact-prep sound that matches the creature."},
  "hit / hurt":{title:"Hit / Hurt Sound",text:"The audio cue played when the mob takes damage.",example:"A short grunt or creature reaction works better than a long sound because it may play often."},
  "death":{title:"Death Sound",text:"The audio cue played when the mob is defeated.",example:"Use a distinct but brief defeat sound so combat feedback stays clear."},
  "gold chance %":{title:"Gold Chance",text:"The percentage chance that this mob drops gold when defeated.",example:"25 means roughly one out of four kills drops gold over many kills."},
  "gold min":{title:"Gold Minimum",text:"The smallest amount of gold awarded when the mob's gold drop succeeds.",example:"Min 2 and Max 5 means a successful gold roll gives 2–5 gold."},
  "gold max":{title:"Gold Maximum",text:"The largest amount of gold awarded when the mob's gold drop succeeds.",example:"Min 2 and Max 5 means a successful gold roll gives 2–5 gold."},
  "potion chance %":{title:"Potion Chance",text:"The percentage chance that this mob drops a potion when defeated.",example:"5 means a potion drops on about 5% of kills over a large sample."},
  "potion qty":{title:"Potion Quantity",text:"How many potions are awarded when the potion drop roll succeeds.",example:"A quantity of 1 gives one potion each time the potion drop triggers."},
  "sprite height":{title:"Sprite Height",text:"Controls how tall the selected NPC is drawn in the world. The sprite keeps its proportions automatically.",example:"Drag the blue size handles in Visual Size mode instead of typing a number when you want to size the NPC by eye."},
  "display width":{title:"Display Width",text:"The visual width of this placed object in world pixels. It changes the sprite size, not the hitbox or interaction area.",example:"A 96 px wide house can still use a smaller yellow doorway hitbox and a separate green interaction area."},
  "display height":{title:"Display Height",text:"The visual height of this placed object in world pixels. It changes the sprite size independently of collision and interaction areas.",example:"Use Visual Size mode to drag the blue box until the object looks right, then edit its hitbox separately."},
  "depth mode":{title:"Depth Mode",text:"Controls whether the player can visually pass in front of or behind an object/NPC. Y-Sort is the normal choice for world objects.",example:"With Y-Sort, crossing the purple depth line changes which sprite is drawn in front."},
  "depth line y offset":{title:"Depth Line Y Offset",text:"Moves the Y-Sort overlap anchor up or down relative to the selected object/NPC.",example:"For a tall tree, place the purple line near the trunk base so the player can walk behind the canopy but in front of the trunk base."},
  "range":{title:"Interaction Range",text:"How close the player must be for an E-key interaction to be allowed. The green interaction area controls where the object can be targeted; Range controls player distance.",example:"A door may have a tight green doorway area but a 48 px interaction range so the player does not need pixel-perfect positioning."},
  "area x":{title:"Interaction Area X",text:"Horizontal offset of the green interaction area from the object's origin. Usually easier to edit visually.",example:"A positive X moves the green area to the right side of the sprite."},
  "area y":{title:"Interaction Area Y",text:"Vertical offset of the green interaction area from the object's origin. Usually easier to edit visually.",example:"Move the green area down to cover only the base or doorway of a tall object."},
  "area w":{title:"Interaction Area Width",text:"Width of the green click/interaction area in world pixels.",example:"Drag the green side or corner handles to fit the usable part of the object."},
  "area h":{title:"Interaction Area Height",text:"Height of the green click/interaction area in world pixels.",example:"A chest can use a small interaction box around the chest itself even if its sprite has extra decorative space."},
  "audible range":{title:"Audible Range",text:"Maximum world distance over which this looping sound emitter can be heard. Volume fades with distance.",example:"A waterfall may use a larger range than a small fireplace."},
  "volume %":{title:"Volume",text:"Relative loudness for this sound or emitter. 100% is the normal reference level.",example:"50% is half the configured amplitude; values above 100% boost the source and should be used carefully."},
  "brush size":{title:"Brush Size",text:"How many terrain tiles are painted at once around the pointer.",example:"1 × 1 is precise detail work; 9 × 9 quickly fills large terrain areas."},
  "texture scale %":{title:"Texture Scale",text:"Controls the apparent size of the repeating terrain texture without changing tile geometry.",example:"A lower texture scale repeats more texture detail across the same terrain area; a higher scale makes features look larger."}
};

function developerEnsureHelpAndSizeStyles(){
  if(document.getElementById?.("devHelpAndSizeStyles"))return;
  const style=document.createElement?.("style");if(!style)return;
  style.id="devHelpAndSizeStyles";
  style.textContent=`
    #devPanel .devSizeEditButton{width:100%;margin-top:8px;border:1px solid rgba(99,230,255,.24);background:#4a5262;color:#ecfcff;border-radius:8px;padding:9px 10px;font-weight:900;cursor:pointer}
    #devPanel .devSizeEditButton.active{outline:2px solid #63e6ff;background:#315866;color:#effdff}
    #devPanel .devSizeEditButton:disabled{opacity:.45;cursor:not-allowed}
    #devPanel .devSizeEditHelp{margin-top:7px;padding:8px 9px;border:1px solid rgba(99,230,255,.18);border-radius:8px;background:rgba(99,230,255,.06);color:#d7edf2;font-size:10px;line-height:1.35}
    #devPanel label.devHasInfo{position:relative;padding-right:25px}
    #devPanel .devInfoButton{position:absolute;right:1px;top:-1px;width:19px;height:19px;min-width:19px;padding:0!important;border:1px solid rgba(124,234,255,.42)!important;border-radius:50%!important;background:#263943!important;color:#9ceeff!important;font:900 11px/17px system-ui!important;text-align:center;cursor:pointer;box-shadow:none!important}
    #devPanel .devInfoButton:hover,#devPanel .devInfoButton:focus-visible{background:#385d69!important;color:#fff!important;outline:2px solid rgba(99,230,255,.35)}
    .devInfoPopover{position:fixed;z-index:12050;padding:12px 13px 13px;background:#211b28;color:#f7effb;border:1px solid rgba(124,234,255,.34);border-radius:11px;box-shadow:0 16px 42px rgba(0,0,0,.52);font:12px/1.4 system-ui,sans-serif}
    .devInfoPopover .devInfoTitle{padding-right:28px;font-size:13px;font-weight:900;color:#9ceeff;letter-spacing:.02em}
    .devInfoPopover .devInfoClose{position:absolute;right:7px;top:6px;width:26px;height:26px;border:0;border-radius:7px;background:#352c3d;color:#fff;font-size:18px;line-height:22px;cursor:pointer}
    .devInfoPopover .devInfoText{margin-top:7px;color:#ddd1e4}
    .devInfoPopover .devInfoExample{margin-top:9px;padding:8px 9px;border-radius:8px;background:rgba(99,230,255,.07);border:1px solid rgba(99,230,255,.12);color:#d7edf2}
    .devInfoPopover .devInfoExample b{display:block;margin-bottom:3px;color:#9ceeff;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
    .devInfoPopover .devInfoExample span{display:block}`;
  (document.head||document.body)?.appendChild(style);
}

function developerHelpNormalize(text){
  return String(text||"").replace(/\s+/g," ").trim().toLowerCase();
}
function developerHelpLabelText(label){
  if(!label)return "";
  const clone=label.cloneNode(true);
  clone.querySelectorAll("input,select,textarea,button,.devInfoButton").forEach(node=>node.remove());
  return developerHelpNormalize(clone.textContent);
}
function developerCloseSettingHelp(){
  document.querySelector(".devInfoPopover")?.remove();
}
function developerOpenSettingHelp(button,key){
  const help=DEV_SETTING_HELP[key];if(!help)return;
  developerCloseSettingHelp();
  const pop=document.createElement("div");pop.className="devInfoPopover";pop.setAttribute("role","dialog");pop.setAttribute("aria-label",help.title);
  const title=document.createElement("div");title.className="devInfoTitle";title.textContent=help.title;
  const close=document.createElement("button");close.type="button";close.className="devInfoClose";close.textContent="×";close.setAttribute("aria-label","Close help");close.addEventListener("click",developerCloseSettingHelp);
  const text=document.createElement("div");text.className="devInfoText";text.textContent=help.text;
  pop.append(title,close,text);
  if(help.example){const ex=document.createElement("div");ex.className="devInfoExample";const b=document.createElement("b");b.textContent="Example";const span=document.createElement("span");span.textContent=help.example;ex.append(b,span);pop.append(ex);}
  document.body.appendChild(pop);
  const r=button.getBoundingClientRect();const margin=10;const width=Math.min(330,Math.max(240,window.innerWidth-margin*2));
  pop.style.width=`${width}px`;let left=Math.min(window.innerWidth-width-margin,Math.max(margin,r.right-width));let top=r.bottom+7;
  const h=pop.getBoundingClientRect().height;if(top+h>window.innerHeight-margin)top=Math.max(margin,r.top-h-7);
  pop.style.left=`${Math.round(left)}px`;pop.style.top=`${Math.round(top)}px`;
}
function developerEnhanceSettingHelp(root=devPanel){
  if(!root?.querySelectorAll)return;
  root.querySelectorAll("label").forEach(label=>{
    if(label.classList.contains("devHasInfo")||label.classList.contains("devInlineCheck")||label.closest(".devChecks")||label.closest(".devToolbar")||label.closest(".devContextBar"))return;
    const key=developerHelpLabelText(label),help=DEV_SETTING_HELP[key];if(!help)return;
    const control=label.querySelector("input,select,textarea");if(!control)return;
    label.classList.add("devHasInfo");
    const button=document.createElement("button");button.type="button";button.className="devInfoButton";button.dataset.devInfo=key;button.textContent="i";button.title=`About ${help.title}`;button.setAttribute("aria-label",`About ${help.title}`);
    label.appendChild(button);
  });
}
function developerInitSettingHelp(root){
  if(!root||root.dataset.devInfoReady==="1")return;root.dataset.devInfoReady="1";
  developerEnsureHelpAndSizeStyles();
  let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;const run=()=>{scheduled=false;developerEnhanceSettingHelp(root);};if(typeof requestAnimationFrame==="function")requestAnimationFrame(run);else setTimeout(run,0);};
  root.addEventListener("click",event=>{const button=event.target.closest?.(".devInfoButton");if(!button||!root.contains(button))return;event.preventDefault();event.stopPropagation();developerOpenSettingHelp(button,button.dataset.devInfo);});
  if(typeof MutationObserver==="function"){const observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});root._devInfoObserver=observer;}
  window?.addEventListener?.("pointerdown",event=>{const pop=document.querySelector(".devInfoPopover");if(pop&&!pop.contains(event.target)&&!event.target.closest?.(".devInfoButton"))developerCloseSettingHelp();},true);
  window?.addEventListener?.("keydown",event=>{if(event.key==="Escape")developerCloseSettingHelp();},true);
  schedule();
}

function devContentClone(value){return JSON.parse(JSON.stringify(value));}
function developerCleanAssetRecords(records){const out=devContentClone(records||{});for(const asset of Object.values(out))if(asset&&typeof asset==="object")delete asset.qaStatus;return out;}
function devContentEscape(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function devContentId(value,fallback="content"){
  return String(value||fallback).trim().toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9_-]+/g,"").replace(/^-+|-+$/g,"")||fallback;
}
function devContentMap(type=devContentType){
  if(type==="items")return ITEM_DEFS;
  if(type==="lootTables")return LOOT_TABLES;
  if(type==="mobs")return BALANCE.mobs||(BALANCE.mobs={});
  return {};
}
function developerContentLibrary(){
  return {
    format:"little-realm-content-library",schemaVersion:DEV_SHARED_SCHEMA_VERSION,
    items:devContentClone(ITEM_DEFS),
    lootTables:devContentClone(LOOT_TABLES),
    mobs:devContentClone(BALANCE.mobs||{}),
    assets:developerCleanAssetRecords(devAssets),
    objectDefinitions:devContentClone(devObjectDefinitions),
    terrainDefaults:devContentClone(devTerrainDefaults),
    terrains:devContentClone(devTerrains),
    artReferences:devContentClone(devArtReferences||{}),
    characterDefaults:devContentClone(devCharacterDefaults||{}),
    audioClips:devContentClone(devAudioClips||{}),
    audioSets:devContentClone(devAudioSets||{}),
    audioEvents:devContentClone(devAudioEvents||{})
  };
}
function devReplaceObject(target,source){
  for(const key of Object.keys(target||{}))delete target[key];
  Object.assign(target,devContentClone(source||{}));
}
function applyDeveloperContentLibrary(content,{quiet=false}={}){
  if(!content||typeof content!=="object")throw new Error("Content Library is not an object");
  if(content.items&&typeof content.items==="object")devReplaceObject(ITEM_DEFS,content.items);
  if(content.lootTables&&typeof content.lootTables==="object")devReplaceObject(LOOT_TABLES,content.lootTables);
  if(content.mobs&&typeof content.mobs==="object")devReplaceObject(BALANCE.mobs||(BALANCE.mobs={}),content.mobs);
  if(content.assets&&typeof content.assets==="object")devAssets=developerCleanAssetRecords(content.assets);
  if(content.objectDefinitions&&typeof content.objectDefinitions==="object")devObjectDefinitions=devContentClone(content.objectDefinitions);
  if(content.terrains&&typeof content.terrains==="object")devTerrains=devContentClone(content.terrains);
  if(content.terrainDefaults&&typeof content.terrainDefaults==="object")devTerrainDefaults=devContentClone(content.terrainDefaults);
  devArtReferences=devContentClone(content.artReferences&&typeof content.artReferences==="object"?content.artReferences:{});
  devCharacterDefaults=devContentClone(content.characterDefaults&&typeof content.characterDefaults==="object"?content.characterDefaults:{});
  devAudioClips=devContentClone(content.audioClips&&typeof content.audioClips==="object"?content.audioClips:{});
  devAudioSets=devContentClone(content.audioSets&&typeof content.audioSets==="object"?content.audioSets:{});
  devAudioEvents=devContentClone(content.audioEvents&&typeof content.audioEvents==="object"?content.audioEvents:{});
  window.LR_AUDIO_CLIPS=devAudioClips;window.LR_AUDIO_SETS=devAudioSets;window.LR_AUDIO_EVENTS=devAudioEvents;
  window.LR_ASSETS=devAssets;window.LR_OBJECT_DEFINITIONS=devObjectDefinitions;window.LR_TERRAINS=devTerrains;window.LR_TERRAIN_DEFAULTS=devTerrainDefaults;window.LR_ART_REFERENCES=devArtReferences;window.LR_CHARACTER_DEFAULTS=devCharacterDefaults;window.LR_SHARED_CONTENT=developerContentLibrary();
  if(!devTerrains[devTerrainBrush])devTerrainBrush=Object.keys(devTerrains)[0]||"";
  if(!devTerrains[devTerrainSelectedId])devTerrainSelectedId=devTerrainBrush||Object.keys(devTerrains)[0]||null;
  if(typeof refreshMobTemplatesFromBalance==="function")refreshMobTemplatesFromBalance();
  if(typeof refreshAliveMobStatsForPlayer==="function"&&state)refreshAliveMobStatsForPlayer();
  devContentSelectedId=null;
  refreshDeveloperPanel();
  refreshInventoryViews?.();
  if(!quiet)devSetStatus(`Loaded Content Library • ${Object.keys(ITEM_DEFS).length} items • ${Object.keys(BALANCE.mobs||{}).length} mobs • ${Object.keys(devTerrains).length} terrains`);
}
function devContentTypeLabel(type){return ({items:"Items",lootTables:"Loot Tables",mobs:"Mob Types"})[type]||type;}
function devContentRecordLabel(type,id,record){
  if(type==="items")return record?.name||id;
  if(type==="lootTables")return `${id} • ${(Array.isArray(record)?record:record?.entries||[]).length} drops`;
  if(type==="mobs")return record?.name||id;
  return id;
}
function devContentEnsureSelection(){
  const map=devContentMap();
  if(devContentSelectedId&&Object.prototype.hasOwnProperty.call(map,devContentSelectedId))return;
  devContentSelectedId=Object.keys(map)[0]||null;
}
function devContentSetType(type){
  devContentType=type;devContentSelectedId=null;devContentEnsureSelection();refreshDeveloperContentPanel();
}
function devContentSelect(id){devContentSelectedId=id;refreshDeveloperContentPanel();}
function devContentUniqueId(base,type=devContentType){
  const map=devContentMap(type);const root=devContentId(base,type==="items"?"new-item":type==="mobs"?"new-mob":"new-loot-table");
  let id=root,n=2;while(Object.prototype.hasOwnProperty.call(map,id))id=`${root}-${n++}`;return id;
}
function devContentCreate(){
  const map=devContentMap();let id;
  if(devContentType==="items"){
    id=devContentUniqueId("new-item");map[id]={name:"New Item",description:"",symbol:"?",icon:"",category:"Material",rarity:"Common",stackLimit:50,sellValue:0,tags:[]};
  }else if(devContentType==="lootTables"){
    id=devContentUniqueId("new-loot-table");map[id]=[];
  }else{
    id=devContentUniqueId("new-mob");map[id]=developerNewMobDefinition();
    refreshMobTemplatesFromBalance?.();
  }
  devContentSelectedId=id;saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`Created ${devContentTypeLabel(devContentType).replace(/s$/,"")}: ${id}`);
}
function devContentDuplicate(){
  devContentEnsureSelection();if(!devContentSelectedId)return;const map=devContentMap();const src=map[devContentSelectedId];const id=devContentUniqueId(`${devContentSelectedId}-copy`);map[id]=devContentClone(src);if(map[id]&&typeof map[id]==="object"&&!Array.isArray(map[id])&&map[id].name)map[id].name+=` Copy`;devContentSelectedId=id;refreshMobTemplatesFromBalance?.();saveDeveloperDraft();refreshDeveloperPanel();
}
function devContentDelete(){
  devContentEnsureSelection();const id=devContentSelectedId;if(!id)return;const map=devContentMap();
  let warning="";
  if(devContentType==="items"){
    const refs=Object.entries(LOOT_TABLES).reduce((n,[,table])=>n+(Array.isArray(table)?table:table?.entries||[]).filter(e=>e?.itemId===id).length,0);if(refs)warning=` ${refs} loot entries reference this item and will be removed.`;
  }else if(devContentType==="lootTables"){
    const refs=Object.values(BALANCE.mobs||{}).filter(m=>m?.lootTable===id).length;if(refs)warning=` ${refs} mob definitions reference this table.`;
  }else if(devContentType==="mobs"){
    const questRefs=questDefinitions.filter(q=>q.objectives?.some(o=>o.type==="kill"&&o.target===id)).length;
    const spawnRefs=devMobSpawns.filter(spawn=>spawn.mobType===id).length;
    if(questRefs||spawnRefs){devSetStatus(`${id} is still used by ${spawnRefs} spawn(s) and ${questRefs} quest(s); change those references before deleting it`);return;}
  }
  if(!confirm(`Delete ${devContentRecordLabel(devContentType,id,map[id])}?${warning}`))return;
  const deletingMobLoot=devContentType==="mobs"?String(map[id]?.lootTable||""):"";
  delete map[id];
  if(devContentType==="items")for(const key of Object.keys(LOOT_TABLES)){const t=Array.isArray(LOOT_TABLES[key])?LOOT_TABLES[key]:LOOT_TABLES[key]?.entries;if(Array.isArray(t))for(let i=t.length-1;i>=0;i--)if(t[i]?.itemId===id)t.splice(i,1);}
  if(devContentType==="items"&&devCharacterDefaults?.starterEquipment&&typeof devCharacterDefaults.starterEquipment==="object")for(const slot of Object.keys(devCharacterDefaults.starterEquipment))if(devCharacterDefaults.starterEquipment[slot]===id)devCharacterDefaults.starterEquipment[slot]="";
  if(devContentType==="lootTables")for(const mob of Object.values(BALANCE.mobs||{}))if(mob?.lootTable===id)mob.lootTable="";
  if(devContentType==="mobs"&&deletingMobLoot===id&&!Object.values(BALANCE.mobs||{}).some(m=>m?.lootTable===id))delete LOOT_TABLES[id];
  devContentSelectedId=null;refreshMobTemplatesFromBalance?.();saveDeveloperDraft();refreshDeveloperPanel();
}
function devContentRenameKey(map,oldId,newId){
  if(oldId===newId)return true;if(Object.prototype.hasOwnProperty.call(map,newId)){devSetStatus(`ID '${newId}' is already in use`);return false;}map[newId]=map[oldId];delete map[oldId];devContentSelectedId=newId;return true;
}
function devContentSaveItem(root){
  const map=ITEM_DEFS,oldId=devContentSelectedId,newId=devContentId(root.querySelector("#devContentId").value,oldId||"item");if(!devContentRenameKey(map,oldId,newId))return;
  if(oldId!==newId){
    for(const key of Object.keys(LOOT_TABLES)){const t=Array.isArray(LOOT_TABLES[key])?LOOT_TABLES[key]:LOOT_TABLES[key]?.entries;if(Array.isArray(t))for(const e of t)if(e?.itemId===oldId)e.itemId=newId;}
    if(devCharacterDefaults?.starterEquipment&&typeof devCharacterDefaults.starterEquipment==="object")for(const slot of Object.keys(devCharacterDefaults.starterEquipment))if(devCharacterDefaults.starterEquipment[slot]===oldId)devCharacterDefaults.starterEquipment[slot]=newId;
  }
  const equipmentSlot=String(root.querySelector("#devContentEquipmentSlot")?.value||""),starter=Boolean(root.querySelector("#devContentStarterEquipment")?.checked);
  map[newId]={name:root.querySelector("#devContentName").value.trim()||newId,description:root.querySelector("#devContentDescription").value.trim(),symbol:(root.querySelector("#devContentSymbol").value.trim()||"?").slice(0,2),icon:root.querySelector("#devContentIcon").value.trim(),category:root.querySelector("#devContentCategory").value.trim()||"Item",rarity:root.querySelector("#devContentRarity").value.trim()||"Common",stackLimit:equipmentSlot?1:Math.max(1,Math.floor(numberOr(root.querySelector("#devContentStack").value,50))),sellValue:Math.max(0,Math.floor(numberOr(root.querySelector("#devContentSell").value,0))),tags:root.querySelector("#devContentTags").value.split(",").map(x=>x.trim()).filter(Boolean),...(equipmentSlot?{equipmentSlot}:{})};
  if(!devCharacterDefaults.starterEquipment||typeof devCharacterDefaults.starterEquipment!=="object")devCharacterDefaults.starterEquipment={};
  for(const slot of Object.keys(devCharacterDefaults.starterEquipment))if(devCharacterDefaults.starterEquipment[slot]===oldId||devCharacterDefaults.starterEquipment[slot]===newId)devCharacterDefaults.starterEquipment[slot]="";
  if(starter&&equipmentSlot)devCharacterDefaults.starterEquipment[equipmentSlot]=newId;
}
function devContentSaveLoot(root){
  const map=LOOT_TABLES,oldId=devContentSelectedId,newId=devContentId(root.querySelector("#devContentId").value,oldId||"loot");if(!devContentRenameKey(map,oldId,newId))return;
  if(oldId!==newId)for(const mob of Object.values(BALANCE.mobs||{}))if(mob?.lootTable===oldId)mob.lootTable=newId;
  const entries=[...root.querySelectorAll(".devLootEntry")].map(row=>({itemId:row.querySelector("[data-loot=item]").value,chancePercent:clamp(numberOr(row.querySelector("[data-loot=chance]").value,100),0,100),minQty:Math.max(1,Math.floor(numberOr(row.querySelector("[data-loot=min]").value,1))),maxQty:Math.max(1,Math.floor(numberOr(row.querySelector("[data-loot=max]").value,1))),...(row.querySelector("[data-loot=elite]").checked?{requiresElite:true}:{}),...(row.querySelector("[data-loot=boss]").checked?{requiresBoss:true}:{})})).filter(e=>e.itemId);
  for(const e of entries)e.maxQty=Math.max(e.minQty,e.maxQty);map[newId]=entries;
}
function devContentSaveMob(root){
  return saveDeveloperMobFromEditor(root);
}

function devContentSave(){
  const root=devPanel?.querySelector("#devContentEditor");if(!root||!devContentSelectedId)return;
  let ok=true;if(devContentType==="items")devContentSaveItem(root);else if(devContentType==="lootTables")devContentSaveLoot(root);else ok=devContentSaveMob(root)!==false;
  if(!ok)return;saveDeveloperDraft();refreshDeveloperPanel();refreshQuestUI?.();devSetStatus(`Saved ${devContentTypeLabel(devContentType).replace(/s$/,"")}: ${devContentSelectedId}`);
}
function devContentLootEntryHtml(entry={}){
  const items=Object.keys(ITEM_DEFS);const itemOptions=[`<option value="">Choose item…</option>`,...items.map(id=>`<option value="${devContentEscape(id)}" ${id===entry.itemId?"selected":""}>${devContentEscape(ITEM_DEFS[id]?.name||id)}</option>`)].join("");
  return `<div class="devLootEntry"><select data-loot="item">${itemOptions}</select><input data-loot="chance" type="number" min="0" max="100" value="${numberOr(entry.chancePercent,100)}" title="Drop %"><input data-loot="min" type="number" min="1" value="${numberOr(entry.minQty,1)}" title="Min quantity"><input data-loot="max" type="number" min="1" value="${numberOr(entry.maxQty,entry.minQty||1)}" title="Max quantity"><label><input data-loot="elite" type="checkbox" ${entry.requiresElite?"checked":""}> Elite</label><label><input data-loot="boss" type="checkbox" ${entry.requiresBoss?"checked":""}> Boss</label><button type="button" data-loot-remove>×</button></div>`;
}
function devContentBindLootRows(root){root.querySelectorAll("[data-loot-remove]").forEach(b=>b.onclick=()=>b.closest(".devLootEntry")?.remove());root.querySelector("#devAddLootEntry")?.addEventListener("click",()=>{const wrap=root.querySelector("#devLootEntries");wrap.insertAdjacentHTML("beforeend",devContentLootEntryHtml({}));devContentBindLootRows(root);});}
function developerItemEquipmentSlotOptions(selected=""){
  const slots=[["","Not Equipment"],["head","Head"],["chest","Chest"],["hands","Hands"],["back","Back"],["legs","Legs"],["feet","Feet / Boots"],["mainHand","Main Hand"],["offHand","Off Hand"]];
  return slots.map(([value,label])=>`<option value="${value}" ${value===selected?"selected":""}>${label}</option>`).join("");
}
function refreshDeveloperContentPanel(){
  if(!devPanel)return;const list=devPanel.querySelector("#devContentList"),editor=devPanel.querySelector("#devContentEditor"),summary=devPanel.querySelector("#devContentSummary");if(!list||!editor)return;
  devContentEnsureSelection();const map=devContentMap();if(summary)summary.textContent=`${Object.keys(BALANCE.mobs||{}).length} mobs • ${Object.keys(ITEM_DEFS).length} items • ${Object.keys(LOOT_TABLES).length} loot tables • ${Object.keys(devAssets).length} assets`;
  devPanel.querySelectorAll("[data-content-type]").forEach(b=>b.classList.toggle("active",b.dataset.contentType===devContentType));
  const query=String(devPanel.querySelector("#devContentSearch")?.value||"").trim().toLowerCase();list.innerHTML=Object.entries(map).filter(([id,rec])=>!query||`${devContentRecordLabel(devContentType,id,rec)} ${id}`.toLowerCase().includes(query)).map(([id,rec])=>`<button class="devContentChip ${id===devContentSelectedId?"active":""}" data-content-id="${devContentEscape(id)}"><b>${devContentEscape(devContentRecordLabel(devContentType,id,rec))}</b><span>${devContentEscape(id)}</span></button>`).join("")||'<div class="devEmpty">No content matches this search.</div>';
  list.querySelectorAll("[data-content-id]").forEach(b=>b.onclick=()=>devContentSelect(b.dataset.contentId));
  const id=devContentSelectedId,rec=id?map[id]:null;if(!id||rec==null){editor.innerHTML='<div class="devEmpty">Choose or create a content entry.</div>';return;}
  if(devContentType==="items")editor.innerHTML=`<div class="devContentForm"><div class="devPair"><label>ID<input id="devContentId" value="${devContentEscape(id)}"></label><label>Name<input id="devContentName" value="${devContentEscape(rec.name||id)}"></label></div><label>Description<textarea id="devContentDescription">${devContentEscape(rec.description||"")}</textarea></label><div class="devPair"><label>Icon path<input id="devContentIcon" value="${devContentEscape(rec.icon||"")}"></label><label>Fallback Symbol<input id="devContentSymbol" maxlength="2" value="${devContentEscape(rec.symbol||"?")}"></label></div><div class="devPair"><label>Category<input id="devContentCategory" value="${devContentEscape(rec.category||"Item")}"></label><label>Rarity<input id="devContentRarity" value="${devContentEscape(rec.rarity||"Common")}"></label></div><div class="devPair"><label>Stack Limit<input id="devContentStack" type="number" min="1" value="${numberOr(rec.stackLimit,50)}"></label><label>Sell Value<input id="devContentSell" type="number" min="0" value="${numberOr(rec.sellValue,0)}"></label></div><div class="devSectionTitle" style="margin-top:8px">Equipment</div><label>Equipment Slot<select id="devContentEquipmentSlot">${developerItemEquipmentSlotOptions(rec.equipmentSlot||"")}</select></label><label class="devInlineCheck"><input id="devContentStarterEquipment" type="checkbox" ${rec.equipmentSlot&&devCharacterDefaults?.starterEquipment?.[rec.equipmentSlot]===id?"checked":""}> Equip this item on newly started characters</label><div class="devHint">Equipment remains a gameplay and inventory system, but it does not alter the premade character sprite. This keeps armor authoring independent from character artwork. Equipment always stacks to 1.</div><label>Tags (comma separated)<input id="devContentTags" value="${devContentEscape((rec.tags||[]).join(", "))}"></label></div>`;
  else if(devContentType==="lootTables"){const entries=Array.isArray(rec)?rec:rec.entries||[];editor.innerHTML=`<div class="devContentForm"><label>Table ID<input id="devContentId" value="${devContentEscape(id)}"></label><div class="devLootHeader"><span>Item</span><span>Chance %</span><span>Min</span><span>Max</span><span>Rules</span></div><div id="devLootEntries">${entries.map(devContentLootEntryHtml).join("")}</div><button type="button" id="devAddLootEntry" class="devWideButton">+ Add Drop Entry</button></div>`;devContentBindLootRows(editor);}
  else{editor.innerHTML=developerMobEditorHtml(id,rec);bindDeveloperMobEditor(editor,id,rec);}

  editor.insertAdjacentHTML("beforeend",`<div class="devContentActions"><button id="devContentSave" class="primary">Save Changes</button><button id="devContentDuplicate">Duplicate</button><button id="devContentDelete" class="danger">Delete</button></div>`);editor.querySelector("#devContentSave").onclick=devContentSave;editor.querySelector("#devContentDuplicate").onclick=devContentDuplicate;editor.querySelector("#devContentDelete").onclick=devContentDelete;
}

function developerAudioPanelHtml(){return `<section class="devView" data-dev-view="audio">
        <div class="devSection"><div class="devSectionTitle">Audio Library</div><div id="devAudioSummary" class="devHint"></div><div class="devImportBar"><label>Import As<select id="devAudioImportCategory"><option value="sfx">Sound Effects</option><option value="music">Music</option><option value="ambience">Ambience</option><option value="ui">UI Sounds</option></select></label><button id="devAudioImport" class="primary">Choose Audio Files…</button></div><input id="devAudioImportFile" type="file" multiple accept="audio/mpeg,audio/ogg,audio/wav,.mp3,.ogg,.wav" hidden><div class="devHint">Batch import MP3, OGG, or WAV. Music/ambience loop by default; SFX/UI are one-shot. Audio is cached only when used.</div></div>
        <div class="devMasterDetail audioLayout">
          <div class="devMasterPane"><div class="devSection"><div class="devSectionTitle">Clips</div><div class="devPair"><input id="devAudioSearch" class="devSearchInput" placeholder="Search audio…"><select id="devAudioFilter"><option value="all">All Audio</option><option value="music">Music</option><option value="ambience">Ambience</option><option value="sfx">Sound Effects</option><option value="ui">UI</option></select></div><div id="devAudioList"></div></div></div>
          <div class="devDetailPane"><div class="devSection"><div class="devSectionTitle">Selected Clip</div><div id="devAudioInspector"></div></div></div>
        </div>
        <div class="devMasterDetail audioLayout">
          <div class="devMasterPane"><div class="devSection"><div class="devSectionTitle">Sound Sets</div><div class="devHint">Group variations such as grass-step-1/2/3 into one reusable set. Terrain footsteps select these sets.</div><button id="devAudioNewSet" class="devWideButton primary">New Sound Set</button><div id="devAudioSetList"></div></div></div>
          <div class="devDetailPane"><div class="devSection"><div class="devSectionTitle">Sound Set Inspector</div><div id="devAudioSetInspector"></div></div></div>
        </div>
        <div class="devSection"><div class="devSectionTitle">Active Zone Music & Ambience</div><div id="devZoneAudio"></div></div>
        <div class="devSection" data-default-collapsed="true"><div class="devSectionTitle">Game Sound Events</div><div class="devHint">Engine events are generic; the project chooses the clip/set that plays.</div><div id="devAudioEvents"></div></div>
      </section>`;}
// Builder Audio Library ------------------------------------------------------
let devAudioPreviewHandle=null;
const DEV_AUDIO_CATEGORY_LABELS={music:"Music",ambience:"Ambience",sfx:"Sound Effects",ui:"UI"};
const DEV_AUDIO_EVENT_LABELS={questAccept:"Quest Accepted",playerAttack:"Player Attack",playerHit:"Player Hit",potion:"Potion",lootPickup:"Loot Pickup",questTurnIn:"Quest Complete",levelUp:"Level Up"};
function developerAudioSyncRuntime(){window.LR_AUDIO_CLIPS=devAudioClips;window.LR_AUDIO_SETS=devAudioSets;window.LR_AUDIO_EVENTS=devAudioEvents;if(window.LR_SHARED_CONTENT){window.LR_SHARED_CONTENT.audioClips=devAudioClips;window.LR_SHARED_CONTENT.audioSets=devAudioSets;window.LR_SHARED_CONTENT.audioEvents=devAudioEvents;}}
function developerAudioRefOptions(selected="",{category="",includeSets=false,empty="None"}={}){
  const rows=[`<option value="" ${selected?"":"selected"}>${devContentEscape(empty)}</option>`];
  for(const [id,clip] of Object.entries(devAudioClips||{}).sort((a,b)=>String(a[1]?.name||a[0]).localeCompare(String(b[1]?.name||b[0])))){
    if(category&&clip?.category!==category)continue;rows.push(`<option value="${devContentEscape(id)}" ${id===selected?"selected":""}>${devContentEscape(clip?.name||id)} • ${devContentEscape(DEV_AUDIO_CATEGORY_LABELS[clip?.category]||clip?.category||"Audio")}</option>`);
  }
  if(includeSets)for(const [id,set] of Object.entries(devAudioSets||{}).sort((a,b)=>String(a[1]?.name||a[0]).localeCompare(String(b[1]?.name||b[0]))))rows.push(`<option value="${devContentEscape(id)}" ${id===selected?"selected":""}>Set • ${devContentEscape(set?.name||id)}</option>`);
  return rows.join("");
}
function developerAudioUniqueId(base,library=devAudioClips){const root=devContentId(base,"audio");let id=root,n=2;while(library[id])id=`${root}-${n++}`;return id;}
function developerAudioStopPreview(){if(devAudioPreviewHandle){stopAudioHandle(devAudioPreviewHandle,.08);devAudioPreviewHandle=null;}}
async function developerAudioPreview(id){developerAudioStopPreview();developerAudioSyncRuntime();await unlockAudio();const set=devAudioSets?.[id];devAudioPreviewHandle=set?await playAudioSet(id,{bus:"sfx",volume:.8}):await playAudioClip(id,{bus:audioBusForClip(id),volume:.8});if(!devAudioPreviewHandle)devSetStatus(`Could not preview audio: ${id}`);}
function developerAudioClipInspector(id,clip){
  if(!id||!clip)return '<div class="devEmpty">Select an audio clip.</div>';
  return `<div class="devSelectedTitle">${devContentEscape(clip.name||id)}</div><div class="devHint">${devContentEscape(clip.path||"")}</div>
    <div class="devPair"><label>Name<input id="devAudioClipName" value="${devContentEscape(clip.name||id)}"></label><label>Category<select id="devAudioClipCategory">${Object.entries(DEV_AUDIO_CATEGORY_LABELS).map(([v,l])=>`<option value="${v}" ${clip.category===v?"selected":""}>${l}</option>`).join("")}</select></label></div>
    <div class="devPair"><label>Default Volume %<input id="devAudioClipVolume" type="number" min="0" max="200" value="${Math.round(numberOr(clip.volume,1)*100)}"></label><label><span>Loop by Default</span><span class="devInlineCheck"><input id="devAudioClipLoop" type="checkbox" ${clip.loop?"checked":""}> Loop</span></label></div>
    <div class="devRow"><button id="devAudioPreviewClip" class="primary">▶ Preview</button><button id="devAudioStopClip">■ Stop</button><button id="devAudioSaveClip">Save Clip</button><button id="devAudioDeleteClip" class="danger">Delete</button></div>`;
}
function developerAudioSetInspector(id,set){
  if(!id||!set)return '<div class="devEmpty">Create or select a sound set. Terrain footsteps use sound sets so each step can randomly vary.</div>';
  const checks=Object.entries(devAudioClips||{}).filter(([,c])=>c?.category==="sfx").sort((a,b)=>String(a[1]?.name||a[0]).localeCompare(String(b[1]?.name||b[0]))).map(([clipId,clip])=>`<label class="devAudioClipCheck"><input type="checkbox" data-audio-set-clip="${devContentEscape(clipId)}" ${(set.clipIds||[]).includes(clipId)?"checked":""}><span>${devContentEscape(clip.name||clipId)}</span><button type="button" data-audio-preview="${devContentEscape(clipId)}">▶</button></label>`).join("")||'<div class="devEmpty">Import Sound Effects first.</div>';
  return `<div class="devSelectedTitle">SOUND SET • ${devContentEscape(set.name||id)}</div><div class="devPair"><label>Name<input id="devAudioSetName" value="${devContentEscape(set.name||id)}"></label><label>Set Volume %<input id="devAudioSetVolume" type="number" min="0" max="200" value="${Math.round(numberOr(set.volume,1)*100)}"></label></div><div class="devHint">Select multiple related variations. Footsteps will rotate/randomize through these clips rather than repeating one identical sound.</div><div class="devAudioSetClips">${checks}</div><div class="devRow"><button id="devAudioPreviewSet" class="primary">▶ Preview Set</button><button id="devAudioSaveSet">Save Set</button><button id="devAudioDeleteSet" class="danger">Delete Set</button></div>`;
}
function developerCreateAudioSet(){const id=developerAudioUniqueId("new-sound-set",devAudioSets);devAudioSets[id]={name:"New Sound Set",clipIds:[],volume:1};devAudioSelectedSetId=id;devAudioLibraryMode="sets";developerAudioSyncRuntime();saveDeveloperDraft();refreshDeveloperAudioPanel();}
function developerSaveAudioClip(){const id=devAudioSelectedId,clip=devAudioClips?.[id],root=devPanel?.querySelector("#devAudioInspector");if(!clip||!root)return;clip.name=String(root.querySelector("#devAudioClipName")?.value||id).trim()||id;clip.category=root.querySelector("#devAudioClipCategory")?.value||"sfx";clip.volume=Math.max(0,Math.min(2,numberOr(root.querySelector("#devAudioClipVolume")?.value,100)/100));clip.loop=!!root.querySelector("#devAudioClipLoop")?.checked;developerAudioSyncRuntime();saveDeveloperDraft();refreshDeveloperAudioPanel();devSetStatus(`Saved audio clip: ${clip.name}`);}
function developerDeleteAudioClip(){const id=devAudioSelectedId,clip=devAudioClips?.[id];if(!clip||!confirm(`Delete audio record '${clip.name||id}'? The file will remain in the project folder.`))return;delete devAudioClips[id];for(const set of Object.values(devAudioSets||{}))set.clipIds=(set.clipIds||[]).filter(v=>v!==id);for(const [key,value] of Object.entries(devAudioEvents||{}))if(value===id)devAudioEvents[key]="";for(const t of Object.values(devTerrains||{}))if(t.footstepSet===id)t.footstepSet="";devAudioSelectedId=Object.keys(devAudioClips)[0]||null;developerAudioSyncRuntime();saveDeveloperDraft();refreshDeveloperPanel();}
function developerSaveAudioSet(){const id=devAudioSelectedSetId,set=devAudioSets?.[id],root=devPanel?.querySelector("#devAudioSetInspector");if(!set||!root)return;set.name=String(root.querySelector("#devAudioSetName")?.value||id).trim()||id;set.volume=Math.max(0,Math.min(2,numberOr(root.querySelector("#devAudioSetVolume")?.value,100)/100));set.clipIds=Array.from(root.querySelectorAll("[data-audio-set-clip]:checked")).map(el=>el.dataset.audioSetClip).filter(id=>devAudioClips[id]);developerAudioSyncRuntime();saveDeveloperDraft();refreshDeveloperAudioPanel();devSetStatus(`Saved sound set: ${set.name}`);}
function developerDeleteAudioSet(){const id=devAudioSelectedSetId,set=devAudioSets?.[id];if(!set||!confirm(`Delete sound set '${set.name||id}'?`))return;delete devAudioSets[id];for(const t of Object.values(devTerrains||{}))if(t.footstepSet===id)t.footstepSet="";for(const [key,value] of Object.entries(devAudioEvents||{}))if(value===id)devAudioEvents[key]="";devAudioSelectedSetId=Object.keys(devAudioSets)[0]||null;developerAudioSyncRuntime();saveDeveloperDraft();refreshDeveloperPanel();}
function developerSaveZoneAudio(){const root=devPanel?.querySelector("#devZoneAudio");if(!root)return;const z=window.LR_ZONE_SETTINGS||(window.LR_ZONE_SETTINGS={});z.musicId=root.querySelector("#devZoneMusic")?.value||"";z.musicVolume=Math.max(0,Math.min(2,numberOr(root.querySelector("#devZoneMusicVolume")?.value,100)/100));z.ambienceId=root.querySelector("#devZoneAmbience")?.value||"";z.ambienceVolume=Math.max(0,Math.min(2,numberOr(root.querySelector("#devZoneAmbienceVolume")?.value,100)/100));applyZoneAudioFromCurrentSettings();saveDeveloperDraft();devSetStatus("Zone audio updated");}
function developerSaveAudioEvents(){const root=devPanel?.querySelector("#devAudioEvents");if(!root)return;for(const key of Object.keys(DEV_AUDIO_EVENT_LABELS))devAudioEvents[key]=root.querySelector(`[data-audio-event="${key}"]`)?.value||"";developerAudioSyncRuntime();saveDeveloperDraft();devSetStatus("Game sound events updated");}
function refreshDeveloperAudioPanel(){
  if(!devPanel)return;developerAudioSyncRuntime();const list=devPanel.querySelector("#devAudioList"),inspector=devPanel.querySelector("#devAudioInspector"),setList=devPanel.querySelector("#devAudioSetList"),setInspector=devPanel.querySelector("#devAudioSetInspector"),summary=devPanel.querySelector("#devAudioSummary");if(!list)return;
  const q=String(devPanel.querySelector("#devAudioSearch")?.value||"").trim().toLowerCase(),filter=devPanel.querySelector("#devAudioFilter")?.value||"all",entries=Object.entries(devAudioClips||{}).filter(([id,c])=>(filter==="all"||c.category===filter)&&(!q||`${c.name||""} ${id}`.toLowerCase().includes(q))).sort((a,b)=>String(a[1]?.name||a[0]).localeCompare(String(b[1]?.name||b[0])));
  if(!devAudioSelectedId||!devAudioClips[devAudioSelectedId])devAudioSelectedId=entries[0]?.[0]||Object.keys(devAudioClips)[0]||null;
  list.innerHTML=entries.map(([id,c])=>`<button class="devAudioCard ${id===devAudioSelectedId?"active":""}" data-audio-id="${devContentEscape(id)}"><span class="devAudioIcon">${c.category==="music"?"♫":c.category==="ambience"?"≈":c.category==="ui"?"◈":"♪"}</span><span><b>${devContentEscape(c.name||id)}</b><small>${devContentEscape(DEV_AUDIO_CATEGORY_LABELS[c.category]||c.category||"Audio")}</small></span><span class="devAudioCardPlay" data-audio-preview="${devContentEscape(id)}">▶</span></button>`).join("")||'<div class="devEmpty">No audio clips match this filter.</div>';
  list.querySelectorAll("[data-audio-id]").forEach(btn=>btn.onclick=e=>{if(e.target.closest("[data-audio-preview]"))return;devAudioSelectedId=btn.dataset.audioId;refreshDeveloperAudioPanel();});list.querySelectorAll("[data-audio-preview]").forEach(btn=>btn.onclick=e=>{e.stopPropagation();developerAudioPreview(btn.dataset.audioPreview);});
  if(inspector){inspector.innerHTML=developerAudioClipInspector(devAudioSelectedId,devAudioClips?.[devAudioSelectedId]);inspector.querySelector("#devAudioPreviewClip")?.addEventListener("click",()=>developerAudioPreview(devAudioSelectedId));inspector.querySelector("#devAudioStopClip")?.addEventListener("click",developerAudioStopPreview);inspector.querySelector("#devAudioSaveClip")?.addEventListener("click",developerSaveAudioClip);inspector.querySelector("#devAudioDeleteClip")?.addEventListener("click",developerDeleteAudioClip);}
  const sets=Object.entries(devAudioSets||{}).sort((a,b)=>String(a[1]?.name||a[0]).localeCompare(String(b[1]?.name||b[0])));if(!devAudioSelectedSetId||!devAudioSets[devAudioSelectedSetId])devAudioSelectedSetId=sets[0]?.[0]||null;if(setList)setList.innerHTML=sets.map(([id,set])=>`<button class="devAudioSetCard ${id===devAudioSelectedSetId?"active":""}" data-audio-set-id="${devContentEscape(id)}"><b>${devContentEscape(set.name||id)}</b><small>${(set.clipIds||[]).length} variations</small></button>`).join("")||'<div class="devEmpty">No sound sets yet.</div>';setList?.querySelectorAll("[data-audio-set-id]").forEach(btn=>btn.onclick=()=>{devAudioSelectedSetId=btn.dataset.audioSetId;refreshDeveloperAudioPanel();});
  if(setInspector){setInspector.innerHTML=developerAudioSetInspector(devAudioSelectedSetId,devAudioSets?.[devAudioSelectedSetId]);setInspector.querySelectorAll("[data-audio-preview]").forEach(btn=>btn.onclick=e=>{e.preventDefault();developerAudioPreview(btn.dataset.audioPreview);});setInspector.querySelector("#devAudioPreviewSet")?.addEventListener("click",()=>developerAudioPreview(devAudioSelectedSetId));setInspector.querySelector("#devAudioSaveSet")?.addEventListener("click",developerSaveAudioSet);setInspector.querySelector("#devAudioDeleteSet")?.addEventListener("click",developerDeleteAudioSet);}
  const zoneRoot=devPanel.querySelector("#devZoneAudio");if(zoneRoot){const z=window.LR_ZONE_SETTINGS||{};zoneRoot.innerHTML=`<div class="devPair"><label>Music<select id="devZoneMusic">${developerAudioRefOptions(z.musicId||"",{category:"music",empty:"No music"})}</select></label><label>Music Volume %<input id="devZoneMusicVolume" type="number" min="0" max="200" value="${Math.round(numberOr(z.musicVolume,1)*100)}"></label></div><div class="devPair"><label>Ambience<select id="devZoneAmbience">${developerAudioRefOptions(z.ambienceId||"",{category:"ambience",empty:"No ambience"})}</select></label><label>Ambience Volume %<input id="devZoneAmbienceVolume" type="number" min="0" max="200" value="${Math.round(numberOr(z.ambienceVolume,1)*100)}"></label></div><div class="devRow"><button id="devZoneAudioSave" class="primary">Apply Zone Audio</button><button id="devZoneMusicPreview">▶ Music</button><button id="devZoneAmbiencePreview">▶ Ambience</button></div>`;zoneRoot.querySelector("#devZoneAudioSave").onclick=developerSaveZoneAudio;zoneRoot.querySelector("#devZoneMusicPreview").onclick=()=>developerAudioPreview(zoneRoot.querySelector("#devZoneMusic").value);zoneRoot.querySelector("#devZoneAmbiencePreview").onclick=()=>developerAudioPreview(zoneRoot.querySelector("#devZoneAmbience").value);}
  const eventsRoot=devPanel.querySelector("#devAudioEvents");if(eventsRoot){eventsRoot.innerHTML=Object.entries(DEV_AUDIO_EVENT_LABELS).map(([key,label])=>`<div class="devAudioEventRow"><label>${devContentEscape(label)}<select data-audio-event="${key}">${developerAudioRefOptions(devAudioEvents[key]||"",{includeSets:true})}</select></label><button data-audio-event-preview="${key}">▶</button></div>`).join("")+`<button id="devAudioEventsSave" class="devWideButton primary">Save Game Sound Events</button>`;eventsRoot.querySelector("#devAudioEventsSave").onclick=developerSaveAudioEvents;eventsRoot.querySelectorAll("[data-audio-event-preview]").forEach(btn=>btn.onclick=()=>{const key=btn.dataset.audioEventPreview,id=eventsRoot.querySelector(`[data-audio-event="${key}"]`)?.value;if(id)developerAudioPreview(id);});}
  if(summary)summary.textContent=`${Object.keys(devAudioClips).length} clips • ${Object.keys(devAudioSets).length} sound sets • ${Object.values(devAudioEvents).filter(Boolean).length} game events assigned`;
}

// Batch audio importer -------------------------------------------------------
function developerAudioFolder(category){return `assets/audio/${["music","ambience","sfx","ui"].includes(category)?category:"sfx"}`;}
function developerAudioSafeFilename(name){const raw=String(name||"audio.ogg"),dot=raw.lastIndexOf("."),ext=(dot>=0?raw.slice(dot).toLowerCase():".ogg").replace(/[^.a-z0-9]/g,"")||".ogg",base=devContentId(dot>=0?raw.slice(0,dot):raw,"audio");return `${base}${ext}`;}
async function developerAudioUniquePath(folder,filename){const dot=filename.lastIndexOf("."),base=dot>=0?filename.slice(0,dot):filename,ext=dot>=0?filename.slice(dot):"";let candidate=`${folder}/${filename}`,n=2;while(await developerAssetPathExists(candidate))candidate=`${folder}/${base}-${n++}${ext}`;return candidate;}
async function developerImportAudioFiles(files){
  const list=Array.from(files||[]);if(!list.length)return;if(!devProjectDirectoryHandle){devSetStatus("Open the Little Realm Project Folder before importing audio");return;}
  const category=devPanel?.querySelector("#devAudioImportCategory")?.value||"sfx",results=[],errors=[];
  for(let i=0;i<list.length;i++){
    const file=list[i],ext=(file.name.split(".").pop()||"").toLowerCase();devSetStatus(`Importing audio ${i+1}/${list.length} • ${file.name}`);
    try{if(!(file.type||"").startsWith("audio/")&&!['mp3','ogg','wav'].includes(ext))throw new Error(`${file.name}: use MP3, OGG, or WAV`);const filename=developerAudioSafeFilename(file.name),path=await developerAudioUniquePath(developerAudioFolder(category),filename),handle=await developerNestedFileHandle(devProjectDirectoryHandle,path,{create:true}),writable=await handle.createWritable();await writable.write(file);await writable.close();const id=developerAudioUniqueId(filename.replace(/\.[^.]+$/,'')),name=file.name.replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());devAudioClips[id]={name,path,category,volume:1,loop:category==="music"||category==="ambience",bytes:Number(file.size)||0,imported:true};results.push(id);}catch(err){console.error(err);errors.push(err?.message||`${file.name}: import failed`);}
  }
  if(results.length)devAudioSelectedId=results[results.length-1];developerAudioSyncRuntime();saveDeveloperDraft();refreshDeveloperAudioPanel();devSetStatus(`${results.length}/${list.length} audio files imported${errors.length?` • ${errors.length} failed`:""}`);
}

function developerMobBaseline(level){
  return standardMobBaselineStatsForLevel(Math.max(1,Math.floor(numberOr(level,1))));
}
function developerNewMobDefinition(){
  const stats=developerMobBaseline(1);
  return {
    name:"New Mob",spriteAsset:"",sizeClass:"medium",displayHeight:MOB_SIZE_CLASS_HEIGHTS.medium,battleScale:.55,boss:false,
    baseLevel:1,levelMin:1,levelMax:1,autoLevelStats:true,
    hp:stats.hp,attack:stats.attack,defense:stats.defense,xpMultiplier:1,xp:stats.xp,
    goldMin:0,goldMax:0,goldDropChancePercent:0,potionDropChancePercent:0,potionDropAmount:1,
    eliteChancePercent:0,attackIntervalSeconds:1.5,respawnMinSeconds:18,respawnMaxSeconds:28,
    aggressive:true,aggroTriggerRange:58,alertRange:82,chaseSpeed:50,wanderSpeed:20,
    leashDistance:120,leashSpeed:34,wanderDelayMinSeconds:1.2,wanderDelayMaxSeconds:4,lootTable:"",
    audio:{aggro:"",attack:"",hit:"",death:""},audioRadius:430
  };
}
function developerMobSpriteAssets(){
  return Object.entries(devAssets||{}).filter(([,asset])=>asset?.type==="mobSprite"&&asset?.path);
}
function developerMobSizeClassOptions(rec){
  const height=Math.max(8,numberOr(rec?.displayHeight,MOB_SIZE_CLASS_HEIGHTS.medium));
  const current=String(rec?.sizeClass||nearestMobSizeClass(height)).toLowerCase();
  return [...Object.keys(MOB_SIZE_CLASS_HEIGHTS),"custom"].map(key=>`<option value="${key}" ${key===current?"selected":""}>${MOB_SIZE_CLASS_LABELS[key]}${MOB_SIZE_CLASS_HEIGHTS[key]?` • ${MOB_SIZE_CLASS_HEIGHTS[key]}px`:""}</option>`).join("");
}
function developerMobSizeSummary(height){
  const h=Math.max(8,numberOr(height,MOB_SIZE_CLASS_HEIGHTS.medium));
  return `${Math.round(h)}px visible height • ${mobRelativePlayerScale(h).toFixed(2)}× player reference`;
}
function developerMobSpriteAssetOptions(rec){
  const current=String(rec?.spriteAsset||"");const options=[`<option value="" ${current?"":"selected"}>Choose a Mob Sprite…</option>`];
  for(const [assetId,asset] of developerMobSpriteAssets()){const selected=assetId===current;options.push(`<option value="${devContentEscape(assetId)}" ${selected?"selected":""}>${devContentEscape(asset.name||assetId)}</option>`);}
  if(current&&!devAssets?.[current])options.push(`<option value="${devContentEscape(current)}" selected>Missing asset • ${devContentEscape(current)}</option>`);
  return options.join("");
}
function developerMobLootEntries(id,rec){
  const tableId=String(rec?.lootTable||id||"");
  const raw=LOOT_TABLES[tableId];
  return devContentClone(Array.isArray(raw)?raw:(raw?.entries||[]));
}
function developerMobDropEntryHtml(entry={}){
  const itemOptions=['<option value="">Choose item…</option>',...Object.entries(ITEM_DEFS).map(([id,item])=>`<option value="${devContentEscape(id)}" ${id===entry.itemId?"selected":""}>${devContentEscape(item?.name||id)}</option>`)].join("");
  return `<div class="devLootEntry devMobDropEntry"><select data-mob-drop="item">${itemOptions}</select><input data-mob-drop="chance" type="number" min="0" max="100" value="${numberOr(entry.chancePercent,100)}" title="Drop chance %"><input data-mob-drop="min" type="number" min="1" value="${numberOr(entry.minQty,1)}" title="Minimum quantity"><input data-mob-drop="max" type="number" min="1" value="${numberOr(entry.maxQty,entry.minQty||1)}" title="Maximum quantity"><label><input data-mob-drop="elite" type="checkbox" ${entry.requiresElite?"checked":""}> Elite only</label><label><input data-mob-drop="boss" type="checkbox" ${entry.requiresBoss?"checked":""}> Boss only</label><button type="button" data-mob-drop-remove>×</button></div>`;
}
function developerMobEditorHtml(id,rec){
  const baseline=developerMobBaseline(rec.baseLevel||1);
  const drops=developerMobLootEntries(id,rec);
  const cfg=BALANCE.mobLevels||{};
  const bossHint=`Bosses do not wander, do not respawn after defeat, cannot become Elite, and receive boss multipliers: HP ×${numberOr(cfg.bossHpMultiplier,3)}, ATK ×${numberOr(cfg.bossAttackMultiplier,2.5)}, DEF ×${numberOr(cfg.bossArmorMultiplier,2.5)}, XP ×${numberOr(cfg.bossXpMultiplier,1.75)}.`;
  const audioOptions=value=>developerAudioRefOptions(String(value||""),{includeSets:true});
  return `<div class="devContentForm devMobEditor">
    <div class="devPair"><label>ID<input id="devContentId" value="${devContentEscape(id)}"></label><label>Name<input id="devContentName" value="${devContentEscape(rec.name||id)}"></label></div>
    <div class="devSectionTitle">Appearance</div>
    <label>Mob Sprite Asset<select id="devMobSpriteAsset">${developerMobSpriteAssetOptions(rec)}</select></label>
    <div class="devPair"><label>World Size Class<select id="devMobSizeClass">${developerMobSizeClassOptions(rec)}</select></label><label>Visible World Height<input id="devMobDisplayHeight" type="number" min="8" max="160" step="1" value="${Math.round(numberOr(rec.displayHeight,mobSizeClassHeight(rec.sizeClass)))}"></label></div>
    <div id="devMobSizeSummary" class="devHint">${developerMobSizeSummary(numberOr(rec.displayHeight,mobSizeClassHeight(rec.sizeClass)))}</div>
    <label>Combat Portrait Scale<input id="devMobBattleScale" type="number" min="0.05" step="0.05" value="${numberOr(rec.battleScale,.55)}"></label>
    <div id="devMobSpritePreview" class="devAssetPreview" style="min-height:92px"></div>
    <div class="devHint">World size is normalized from visible sprite height, so a 384px sheet and a 1254px sheet can render at the same in-game size. Import new 4×4 directional sprite sheets from Assets.</div>

    <div class="devSectionTitle">Level & Core Stats</div>
    <div class="devCombatGrid">
      <label class="devCombatField">Level<input id="devMobBase" type="number" min="1" value="${numberOr(rec.baseLevel,1)}"></label>
      <label class="devCombatField">Spawn Min Lv<input id="devMobMin" type="number" min="1" value="${numberOr(rec.levelMin,rec.baseLevel||1)}"></label>
      <label class="devCombatField">Spawn Max Lv<input id="devMobMax" type="number" min="1" value="${numberOr(rec.levelMax,rec.baseLevel||1)}"></label>
      <label class="devCombatField">HP<input id="devMobHp" type="number" min="1" value="${numberOr(rec.hp,baseline.hp)}"></label>
      <label class="devCombatField">ATK<input id="devMobAtk" type="number" min="0" value="${numberOr(rec.attack,baseline.attack)}"></label>
      <label class="devCombatField">DEF<input id="devMobDef" type="number" min="0" value="${numberOr(rec.defense,baseline.defense)}"></label>
      <label class="devCombatField">XP Multiplier<input id="devMobXpMult" type="number" min="0" step="0.05" value="${numberOr(rec.xpMultiplier,1)}"></label>
      <label class="devCombatField">Elite Chance %<input id="devMobElite" type="number" min="0" max="100" value="${numberOr(rec.eliteChancePercent,0)}"></label>
      <label class="devCombatField">Attack Sec<input id="devMobInterval" type="number" min=".1" step=".05" value="${numberOr(rec.attackIntervalSeconds,1.5)}"></label>
    </div>
    <label class="devInlineCheck"><input id="devMobAutoStats" type="checkbox" ${rec.autoLevelStats?"checked":""}> Auto-fill HP / ATK / DEF from Level</label>
    <div id="devMobBaselineHint" class="devHint">Standard Lv ${Math.floor(numberOr(rec.baseLevel,1))} baseline: <b>${baseline.hp} HP • ${baseline.attack} ATK • ${baseline.defense} DEF</b> • ${baseline.xp} same-level XP before multipliers.</div>
    <button type="button" id="devMobUseBaseline" class="devWideButton">Use Level Baseline Now</button>
    <div class="devHint">The Level field is the stat anchor. Spawn Min/Max lets individual spawns vary around it. Editing HP, ATK, or DEF manually turns automatic stat filling off so your custom tuning is preserved.</div>

    <div class="devSectionTitle">Rank & Behavior</div>
    <label class="devInlineCheck"><input id="devMobBoss" type="checkbox" ${rec.boss?"checked":""}> Boss / special encounter</label>
    <div class="devHint">${devContentEscape(bossHint)}</div>
    <label class="devInlineCheck"><input id="devMobAggressive" type="checkbox" ${rec.aggressive?"checked":""}> Aggressive — automatically engages nearby players</label>
    <div class="devCombatGrid">
      <label class="devCombatField">Aggro Range<input id="devMobAggro" type="number" min="0" value="${numberOr(rec.aggroTriggerRange,58)}"></label>
      <label class="devCombatField">Alert Range<input id="devMobAlert" type="number" min="0" value="${numberOr(rec.alertRange,82)}"></label>
      <label class="devCombatField">Chase Speed<input id="devMobChase" type="number" min="0" value="${numberOr(rec.chaseSpeed,50)}"></label>
      <label class="devCombatField">Wander Speed<input id="devMobWander" type="number" min="0" value="${numberOr(rec.wanderSpeed,20)}"></label>
      <label class="devCombatField">Leash<input id="devMobLeash" type="number" min="0" value="${numberOr(rec.leashDistance,120)}"></label>
      <label class="devCombatField">Return Speed<input id="devMobLeashSpeed" type="number" min="0" value="${numberOr(rec.leashSpeed,34)}"></label>
      <label class="devCombatField">Wander Delay Min<input id="devMobWanderMin" type="number" min="0" step=".1" value="${numberOr(rec.wanderDelayMinSeconds,1.2)}"></label>
      <label class="devCombatField">Wander Delay Max<input id="devMobWanderMax" type="number" min="0" step=".1" value="${numberOr(rec.wanderDelayMaxSeconds,4)}"></label>
      <label class="devCombatField">Respawn Min<input id="devMobRespawnMin" type="number" min="0" value="${numberOr(rec.respawnMinSeconds,18)}"></label>
      <label class="devCombatField">Respawn Max<input id="devMobRespawnMax" type="number" min="0" value="${numberOr(rec.respawnMaxSeconds,28)}"></label>
    </div>
    <div class="devHint">Any terrain with the Sanctuary property acts as a protected boundary: mobs whose home is outside cannot enter or aggro players inside it. Mobs deliberately spawned on sanctuary terrain can move normally.</div>

    <div class="devSectionTitle">Mob Audio</div>
    <div class="devHint">Assign individual clips or reusable Sound Sets. World sounds fade/pan based on the mob's distance from the player.</div>
    <div class="devPair"><label>Aggro<select id="devMobAudioAggro">${audioOptions(rec.audio?.aggro)}</select></label><label>Attack<select id="devMobAudioAttack">${audioOptions(rec.audio?.attack)}</select></label></div>
    <div class="devPair"><label>Hit / Hurt<select id="devMobAudioHit">${audioOptions(rec.audio?.hit)}</select></label><label>Death<select id="devMobAudioDeath">${audioOptions(rec.audio?.death)}</select></label></div>
    <div class="devPair"><label>Audible Range<input id="devMobAudioRadius" type="number" min="100" max="2000" value="${Math.round(numberOr(rec.audioRadius,430))}"></label><label>Preview<select id="devMobAudioPreviewChoice">${audioOptions(rec.audio?.aggro||rec.audio?.attack||rec.audio?.hit||rec.audio?.death)}</select></label></div>
    <div class="devRow"><button type="button" id="devMobAudioPreview">▶ Preview</button><button type="button" id="devMobOpenAudio">Open Audio Library</button></div>

    <div class="devSectionTitle">Drops & Rewards</div>
    <div class="devHint">You do not need to create a Loot Table separately. Item drops added here are saved automatically for this mob.</div>
    <div class="devCombatGrid">
      <label class="devCombatField">Gold Chance %<input id="devMobGoldChance" type="number" min="0" max="100" value="${numberOr(rec.goldDropChancePercent,0)}"></label>
      <label class="devCombatField">Gold Min<input id="devMobGoldMin" type="number" min="0" value="${numberOr(rec.goldMin,0)}"></label>
      <label class="devCombatField">Gold Max<input id="devMobGoldMax" type="number" min="0" value="${numberOr(rec.goldMax,0)}"></label>
      <label class="devCombatField">Potion Chance %<input id="devMobPotionChance" type="number" min="0" max="100" value="${numberOr(rec.potionDropChancePercent,0)}"></label>
      <label class="devCombatField">Potion Qty<input id="devMobPotionQty" type="number" min="0" value="${numberOr(rec.potionDropAmount,1)}"></label>
    </div>
    <div class="devLootHeader"><span>Item</span><span>Chance %</span><span>Min</span><span>Max</span><span>Rules</span></div>
    <div id="devMobDropEntries">${drops.map(developerMobDropEntryHtml).join("")}</div>
    <button type="button" id="devMobAddDrop" class="devWideButton">+ Add Item Drop</button>
    <div class="devHint">The separate Loot Tables library remains available for advanced/shared editing, but normal mob loot can be managed entirely here.</div>

    <div class="devHint">Mob definitions are shared content. Use the Spawns tab to place this type into the current zone.</div>
  </div>`;
}
function developerMobUpdateSpritePreview(root){
  const preview=root.querySelector("#devMobSpritePreview"),select=root.querySelector("#devMobSpriteAsset"); if(!preview||!select)return;
  const asset=devAssets?.[select.value],path=String(asset?.path||"");
  preview.innerHTML=path?`<img src="./${devContentEscape(path)}" alt="Mob sprite preview" style="max-height:150px;max-width:100%;object-fit:contain">`:'<div class="devEmpty">Choose a Mob Sprite asset. Every mob uses the same asset-driven renderer.</div>';
}
function developerMobApplyBaselineToEditor(root){
  const level=Math.max(1,Math.floor(numberOr(root.querySelector("#devMobBase")?.value,1))),stats=developerMobBaseline(level);
  root.querySelector("#devMobHp").value=stats.hp;root.querySelector("#devMobAtk").value=stats.attack;root.querySelector("#devMobDef").value=stats.defense;
  const hint=root.querySelector("#devMobBaselineHint");if(hint)hint.innerHTML=`Standard Lv ${level} baseline: <b>${stats.hp} HP • ${stats.attack} ATK • ${stats.defense} DEF</b> • ${stats.xp} same-level XP before multipliers.`;
}
function developerBindMobDropRows(root){
  root.querySelectorAll("[data-mob-drop-remove]").forEach(button=>button.onclick=()=>button.closest(".devMobDropEntry")?.remove());
}
function bindDeveloperMobEditor(root,id,rec){
  developerMobUpdateSpritePreview(root);
  root.querySelector("#devMobSpriteAsset")?.addEventListener("change",()=>developerMobUpdateSpritePreview(root));
  const sizeClass=root.querySelector("#devMobSizeClass"),displayHeight=root.querySelector("#devMobDisplayHeight"),sizeSummary=root.querySelector("#devMobSizeSummary");
  const refreshSizeSummary=()=>{if(sizeSummary&&displayHeight)sizeSummary.textContent=developerMobSizeSummary(displayHeight.value);};
  sizeClass?.addEventListener("change",()=>{if(sizeClass.value!=="custom"&&displayHeight)displayHeight.value=mobSizeClassHeight(sizeClass.value);refreshSizeSummary();});
  displayHeight?.addEventListener("input",()=>{if(sizeClass){const nearest=nearestMobSizeClass(displayHeight.value),preset=mobSizeClassHeight(nearest);sizeClass.value=Math.abs(numberOr(displayHeight.value,preset)-preset)<=1?nearest:"custom";}refreshSizeSummary();});
  const base=root.querySelector("#devMobBase"),min=root.querySelector("#devMobMin"),max=root.querySelector("#devMobMax"),auto=root.querySelector("#devMobAutoStats");
  if(base){base.dataset.previous=String(Math.max(1,Math.floor(numberOr(base.value,1))));base.addEventListener("input",()=>{
    const previous=Math.max(1,Math.floor(numberOr(base.dataset.previous,base.value))),next=Math.max(1,Math.floor(numberOr(base.value,1)));
    if(numberOr(min?.value,previous)===previous&&numberOr(max?.value,previous)===previous){min.value=next;max.value=next;}
    if(auto?.checked)developerMobApplyBaselineToEditor(root);else{const stats=developerMobBaseline(next),hint=root.querySelector("#devMobBaselineHint");if(hint)hint.innerHTML=`Standard Lv ${next} baseline: <b>${stats.hp} HP • ${stats.attack} ATK • ${stats.defense} DEF</b> • ${stats.xp} same-level XP before multipliers.`;}
    base.dataset.previous=String(next);
  });}
  root.querySelector("#devMobUseBaseline")?.addEventListener("click",()=>{if(auto)auto.checked=true;developerMobApplyBaselineToEditor(root);});
  auto?.addEventListener("change",()=>{if(auto.checked)developerMobApplyBaselineToEditor(root);});
  for(const selector of ["#devMobHp","#devMobAtk","#devMobDef"])root.querySelector(selector)?.addEventListener("input",()=>{if(auto)auto.checked=false;});
  developerBindMobDropRows(root);
  root.querySelector("#devMobAudioPreview")?.addEventListener("click",()=>{const id=root.querySelector("#devMobAudioPreviewChoice")?.value;if(id)developerAudioPreview(id);});
  root.querySelector("#devMobOpenAudio")?.addEventListener("click",()=>setDeveloperTab("audio"));
  root.querySelector("#devMobAddDrop")?.addEventListener("click",()=>{root.querySelector("#devMobDropEntries")?.insertAdjacentHTML("beforeend",developerMobDropEntryHtml({}));developerBindMobDropRows(root);});
}
function developerMobCollectDrops(root){
  return [...root.querySelectorAll(".devMobDropEntry")].map(row=>({
    itemId:row.querySelector('[data-mob-drop="item"]')?.value||"",
    chancePercent:clamp(numberOr(row.querySelector('[data-mob-drop="chance"]')?.value,100),0,100),
    minQty:Math.max(1,Math.floor(numberOr(row.querySelector('[data-mob-drop="min"]')?.value,1))),
    maxQty:Math.max(1,Math.floor(numberOr(row.querySelector('[data-mob-drop="max"]')?.value,1))),
    ...(row.querySelector('[data-mob-drop="elite"]')?.checked?{requiresElite:true}:{}),
    ...(row.querySelector('[data-mob-drop="boss"]')?.checked?{requiresBoss:true}:{})
  })).filter(entry=>entry.itemId).map(entry=>({...entry,maxQty:Math.max(entry.minQty,entry.maxQty)}));
}
function saveDeveloperMobFromEditor(root){
  const map=BALANCE.mobs||(BALANCE.mobs={}),oldId=devContentSelectedId,oldRec=map[oldId]||{},newId=devContentId(root.querySelector("#devContentId").value,oldId||"mob");
  if(!devContentRenameKey(map,oldId,newId))return false;
  if(oldId!==newId){
    for(const quest of questDefinitions)for(const objective of quest.objectives||[])if(objective.type==="kill"&&objective.target===oldId)objective.target=newId;
    for(const spawn of devMobSpawns)if(spawn.mobType===oldId)spawn.mobType=newId;
    syncDeveloperSpawnRuntime?.();
  }
  const n=id=>numberOr(root.querySelector(`#${id}`)?.value,0),check=id=>!!root.querySelector(`#${id}`)?.checked;
  const baseLevel=Math.max(1,Math.floor(n("devMobBase"))),boss=check("devMobBoss"),spriteAsset=String(root.querySelector("#devMobSpriteAsset")?.value||"").trim();
  const displayHeight=Math.max(8,n("devMobDisplayHeight")||MOB_SIZE_CLASS_HEIGHTS.medium),chosenSizeClass=String(root.querySelector("#devMobSizeClass")?.value||nearestMobSizeClass(displayHeight)).toLowerCase();
  map[newId]={
    name:root.querySelector("#devContentName").value.trim()||newId,spriteAsset,
    sizeClass:chosenSizeClass,displayHeight,battleScale:Math.max(.05,n("devMobBattleScale")||.55),boss,baseLevel,
    levelMin:Math.max(1,Math.floor(n("devMobMin"))),levelMax:Math.max(1,Math.floor(n("devMobMax"))),autoLevelStats:check("devMobAutoStats"),
    hp:Math.max(1,n("devMobHp")),attack:Math.max(0,n("devMobAtk")),defense:Math.max(0,n("devMobDef")),
    xpMultiplier:Math.max(0,n("devMobXpMult")||1),xp:Math.max(1,numberOr(oldRec.xp,standardMobXpForLevel(baseLevel))),
    goldMin:Math.max(0,Math.floor(n("devMobGoldMin"))),goldMax:Math.max(0,Math.floor(n("devMobGoldMax"))),goldDropChancePercent:clamp(n("devMobGoldChance"),0,100),
    potionDropChancePercent:clamp(n("devMobPotionChance"),0,100),potionDropAmount:Math.max(0,Math.floor(n("devMobPotionQty"))),
    eliteChancePercent:boss?0:clamp(n("devMobElite"),0,100),attackIntervalSeconds:Math.max(.1,n("devMobInterval")),
    respawnMinSeconds:Math.max(0,n("devMobRespawnMin")),respawnMaxSeconds:Math.max(0,n("devMobRespawnMax")),
    aggressive:check("devMobAggressive"),aggroTriggerRange:Math.max(0,n("devMobAggro")),alertRange:Math.max(0,n("devMobAlert")),
    chaseSpeed:Math.max(0,n("devMobChase")),wanderSpeed:Math.max(0,n("devMobWander")),leashDistance:Math.max(0,n("devMobLeash")),leashSpeed:Math.max(0,n("devMobLeashSpeed")),
    wanderDelayMinSeconds:Math.max(0,n("devMobWanderMin")),wanderDelayMaxSeconds:Math.max(0,n("devMobWanderMax")),
    audio:{aggro:root.querySelector("#devMobAudioAggro")?.value||"",attack:root.querySelector("#devMobAudioAttack")?.value||"",hit:root.querySelector("#devMobAudioHit")?.value||"",death:root.querySelector("#devMobAudioDeath")?.value||""},audioRadius:Math.max(100,n("devMobAudioRadius")||430),lootTable:newId
  };
  map[newId].levelMax=Math.max(map[newId].levelMin,map[newId].levelMax);map[newId].goldMax=Math.max(map[newId].goldMin,map[newId].goldMax);map[newId].respawnMaxSeconds=Math.max(map[newId].respawnMinSeconds,map[newId].respawnMaxSeconds);
  const drops=developerMobCollectDrops(root),oldLootId=String(oldRec.lootTable||oldId||"");LOOT_TABLES[newId]=drops;
  if(oldId!==newId&&oldLootId===oldId&&oldId!==newId){const stillUsed=Object.values(map).some(m=>m?.lootTable===oldId);if(!stillUsed)delete LOOT_TABLES[oldId];}
  refreshMobTemplatesFromBalance?.();refreshAliveMobStatsForPlayer?.();return true;
}

function developerNormalizeSpawn(record,index=0){
  const type=String(record?.mobType||record?.kind||"").trim();
  const x=Number.isFinite(Number(record?.x))?Number(record.x):0;
  const y=Number.isFinite(Number(record?.y))?Number(record.y):0;
  const out={id:String(record?.id||`${type||"mob"}-${index+1}`),mobType:type,x,y};
  if(Number.isFinite(Number(record?.level)))out.level=Math.max(1,Math.floor(Number(record.level)));
  if(["down","left","right","up"].includes(record?.facing))out.facing=record.facing;
  return out;
}
function developerNormalizeSpawns(records){
  const used=new Set();
  return (Array.isArray(records)?records:[]).map((record,index)=>{
    const out=developerNormalizeSpawn(record,index);let id=devContentId(out.id,`${out.mobType||"mob"}-${index+1}`),n=2,root=id;
    while(used.has(id))id=`${root}-${n++}`;used.add(id);out.id=id;return out;
  }).filter(record=>record.mobType&&Number.isFinite(record.x)&&Number.isFinite(record.y));
}
function developerSpawnById(id=devSelectedSpawnId){return devMobSpawns.find(spawn=>spawn.id===id)||null;}
function developerLiveMobForSpawn(id=devSelectedSpawnId){return mobs.find(mob=>mob.spawnId===id)||null;}
function developerSpawnWalkable(x,y){
  const tx=Math.floor(Number(x)/TILE),ty=Math.floor(Number(y)/TILE);
  return ty>=0&&ty<world.length&&tx>=0&&tx<(world[ty]?.length||0)&&!!tile[world[ty][tx]]?.walk;
}
function developerSpawnUniqueId(type){
  const root=devContentId(type||"mob","mob");let n=1,id=`${root}-${n}`;const used=new Set(devMobSpawns.map(s=>s.id));
  while(used.has(id))id=`${root}-${++n}`;return id;
}
function syncDeveloperSpawnRuntime({keepSelection=true}={}){
  window.LR_MOB_SPAWNS=devContentClone(devMobSpawns);
  const selectedId=keepSelection?devSelectedSpawnId:null;
  if(typeof selectedTarget!=="undefined")selectedTarget=null;
  if(typeof currentMob!=="undefined")currentMob=null;
  if(typeof enemy!=="undefined")enemy=null;
  if(typeof spawnMobs==="function"&&state)spawnMobs();
  devSelectedMob=selectedId?developerLiveMobForSpawn(selectedId):null;
  updateCombatHud?.();
}
function placeDeveloperMobSpawn(type,wx,wy){
  if(!BALANCE.mobs?.[type]){devSetStatus(`Mob type '${type}' is not in the Content Library`);return;}
  const x=snapDev(wx),y=snapDev(wy);
  if(!developerSpawnWalkable(x,y)){devSetStatus("That spawn point is not on a walkable tile");return;}
  const spawn={id:developerSpawnUniqueId(type),mobType:type,x,y};
  devMobSpawns.push(spawn);devSelectedSpawnId=spawn.id;
  if(!devRepeatPlacement)devPlaceMobType=null;
  syncDeveloperSpawnRuntime();saveDeveloperDraft();refreshDeveloperPanel();updateDevPaletteActive();
  devSetStatus(devRepeatPlacement?`Placed ${mobTypeScaleLabel(type)} spawn • repeat placement remains active`:`Placed ${mobTypeScaleLabel(type)} spawn • Select / Move restored`);
}
function selectDeveloperSpawn(id,{switchTab=true}={}){
  devSelectedSpawnId=id;devSelectedMob=developerLiveMobForSpawn(id);devSelected=null;devSelectedNpc=null;devSelectedRemnant=null;
  if(switchTab)setDeveloperTab("spawns");refreshDeveloperPanel();
}
function findDeveloperSpawnAt(wx,wy){
  let best=null,bestDist=Infinity;const radius=22/Math.max(.2,developerCameraZoomValue());
  for(const spawn of devMobSpawns){const d=dist(wx,wy,spawn.x,spawn.y);if(d<=radius&&d<bestDist){best=spawn;bestDist=d;}}
  return best;
}
function beginDeveloperSpawnDrag(spawn,p,event){
  devSelectedSpawnId=spawn.id;devSelectedMob=developerLiveMobForSpawn(spawn.id);devSpawnDragging=true;
  devSpawnDragOffset={x:p.x-spawn.x,y:p.y-spawn.y,startX:spawn.x,startY:spawn.y};
  try{game.setPointerCapture?.(event.pointerId);}catch{}
  refreshDeveloperSpawnPanel();devSetStatus(`Moving ${mobTypeScaleLabel(spawn.mobType)} spawn — release on a walkable tile`);
}
function updateDeveloperSpawnDrag(p){
  const spawn=developerSpawnById();if(!devSpawnDragging||!spawn)return;
  spawn.x=snapDev(p.x-devSpawnDragOffset.x);spawn.y=snapDev(p.y-devSpawnDragOffset.y);
  const live=developerLiveMobForSpawn(spawn.id);if(live){live.x=spawn.x;live.y=spawn.y;live.homeX=spawn.x;live.homeY=spawn.y;live.vx=0;live.vy=0;live.aggro=false;live.returningHome=false;}
  refreshDeveloperSpawnInspectorValues();
}
function finishDeveloperSpawnDrag(){
  const spawn=developerSpawnById();if(!spawn)return;
  if(!developerSpawnWalkable(spawn.x,spawn.y)){
    spawn.x=devSpawnDragOffset.startX;spawn.y=devSpawnDragOffset.startY;syncDeveloperSpawnRuntime();devSetStatus("Spawn move cancelled — mobs must spawn on a walkable tile");
  }else{syncDeveloperSpawnRuntime();saveDeveloperDraft();devSetStatus("Mob spawn position updated");}
}
function duplicateDeveloperSpawn(){
  const source=developerSpawnById();if(!source)return;const copy=devContentClone(source);copy.id=developerSpawnUniqueId(copy.mobType);copy.x+=devSnap*2;copy.y+=devSnap*2;
  if(!developerSpawnWalkable(copy.x,copy.y)){copy.x=source.x;copy.y=source.y;}
  devMobSpawns.push(copy);devSelectedSpawnId=copy.id;syncDeveloperSpawnRuntime();saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`Duplicated ${mobTypeScaleLabel(copy.mobType)} spawn`);
}
function deleteDeveloperSpawn(){
  const spawn=developerSpawnById();if(!spawn)return;if(!confirm(`Delete ${mobTypeScaleLabel(spawn.mobType)} spawn '${spawn.id}'?`))return;
  const index=devMobSpawns.indexOf(spawn);if(index>=0)devMobSpawns.splice(index,1);devSelectedSpawnId=null;devSelectedMob=null;syncDeveloperSpawnRuntime({keepSelection:false});saveDeveloperDraft();refreshDeveloperPanel();devSetStatus("Mob spawn deleted");
}
function applyDeveloperSpawnInspector(){
  const spawn=developerSpawnById(),root=devPanel?.querySelector("#devSpawnInspector");if(!spawn||!root)return;
  const id=devContentId(root.querySelector("#devSpawnId").value,spawn.id);if(id!==spawn.id&&devMobSpawns.some(s=>s.id===id)){devSetStatus(`Spawn ID '${id}' is already in use`);return;}
  const x=numberOr(root.querySelector("#devSpawnX").value,spawn.x),y=numberOr(root.querySelector("#devSpawnY").value,spawn.y);if(!developerSpawnWalkable(x,y)){devSetStatus("Spawn coordinates must be on a walkable tile");return;}
  spawn.id=id;spawn.mobType=root.querySelector("#devSpawnType").value;spawn.x=x;spawn.y=y;
  const levelText=root.querySelector("#devSpawnLevel").value.trim();if(levelText)spawn.level=Math.max(1,Math.floor(numberOr(levelText,1)));else delete spawn.level;
  spawn.facing=root.querySelector("#devSpawnFacing").value||"down";devSelectedSpawnId=id;syncDeveloperSpawnRuntime();saveDeveloperDraft();refreshDeveloperPanel();devSetStatus("Mob spawn saved");
}
function refreshDeveloperSpawnInspectorValues(){
  const spawn=developerSpawnById(),root=devPanel?.querySelector("#devSpawnInspector");if(!spawn||!root)return;
  const x=root.querySelector("#devSpawnX"),y=root.querySelector("#devSpawnY");if(x)x.value=Math.round(spawn.x);if(y)y.value=Math.round(spawn.y);
}
function refreshDeveloperSpawnPanel(){
  if(!devPanel)return;const palette=devPanel.querySelector("#devSpawnPalette"),list=devPanel.querySelector("#devSpawnList"),inspector=devPanel.querySelector("#devSpawnInspector"),count=devPanel.querySelector("#devSpawnCount");if(!palette||!list||!inspector)return;
  if(count)count.textContent=`${devMobSpawns.length} spawn${devMobSpawns.length===1?"":"s"}`;
  const allTypes=Object.keys(BALANCE.mobs||{}),query=String(devPanel.querySelector("#devSpawnSearch")?.value||"").trim().toLowerCase(),types=allTypes.filter(type=>!query||`${mobTypeScaleLabel(type)} ${type}`.toLowerCase().includes(query));
  palette.innerHTML=types.map(type=>{const n=devMobSpawns.filter(s=>s.mobType===type).length;return `<button class="devSpawnType${type===devPlaceMobType?" active":""}" data-spawn-type="${devContentEscape(type)}"><b>${devContentEscape(mobTypeScaleLabel(type))}</b><span>${n} placed</span></button>`;}).join("")||'<div class="devEmpty">Create a Mob Type in Content first.</div>';
  palette.querySelectorAll("[data-spawn-type]").forEach(button=>button.onclick=()=>{devPlaceMobType=button.dataset.spawnType;devPlaceType=null;devPlaceNpcAsset=null;setDeveloperTab("spawns");updateDevPaletteActive();devSetStatus(`Placing ${mobTypeScaleLabel(devPlaceMobType)} spawns — click the world${devRepeatPlacement?" repeatedly":" once"}`);});
  list.innerHTML=devMobSpawns.map(spawn=>`<button class="devSpawnChip ${spawn.id===devSelectedSpawnId?"active":""}" data-spawn-id="${devContentEscape(spawn.id)}"><b>${devContentEscape(mobTypeScaleLabel(spawn.mobType))}</b><span>${devContentEscape(spawn.id)} • ${Math.round(spawn.x)}, ${Math.round(spawn.y)}</span></button>`).join("")||'<div class="devEmpty">No mob spawns in this zone yet.</div>';
  list.querySelectorAll("[data-spawn-id]").forEach(button=>button.onclick=()=>selectDeveloperSpawn(button.dataset.spawnId));
  const spawn=developerSpawnById();if(!spawn){inspector.innerHTML='<div class="devEmpty">Choose a spawn above or click a spawn marker/mob in the world.</div>';return;}
  const options=allTypes.map(type=>`<option value="${devContentEscape(type)}" ${type===spawn.mobType?"selected":""}>${devContentEscape(mobTypeScaleLabel(type))}</option>`).join("");
  inspector.innerHTML=`<div class="devSelectedTitle">SPAWN • ${devContentEscape(mobTypeScaleLabel(spawn.mobType))}</div><div class="devHint">Drag this spawn directly in the world. The ring marks its home point; the mob will leash back here.</div><div class="devPair"><label>ID<input id="devSpawnId" value="${devContentEscape(spawn.id)}"></label><label>Mob Type<select id="devSpawnType">${options}</select></label></div><div class="devPair"><label>X<input id="devSpawnX" type="number" value="${Math.round(spawn.x)}"></label><label>Y<input id="devSpawnY" type="number" value="${Math.round(spawn.y)}"></label></div><div class="devPair"><label>Fixed Level <span style="font-weight:400;color:#9e92a5">(optional)</span><input id="devSpawnLevel" type="number" min="1" placeholder="use mob range" value="${Number.isFinite(spawn.level)?spawn.level:""}"></label><label>Facing<select id="devSpawnFacing">${["down","left","right","up"].map(v=>`<option value="${v}" ${v===(spawn.facing||"down")?"selected":""}>${v}</option>`).join("")}</select></label></div><div class="devRow"><button id="devSpawnApply" class="primary">Apply</button><button id="devSpawnNearPlayer">Move Near Player</button></div><div class="devRow"><button id="devSpawnDuplicate">Duplicate</button><button id="devSpawnDelete" class="danger">Delete</button></div>`;
  inspector.querySelector("#devSpawnApply").onclick=applyDeveloperSpawnInspector;inspector.querySelector("#devSpawnDuplicate").onclick=duplicateDeveloperSpawn;inspector.querySelector("#devSpawnDelete").onclick=deleteDeveloperSpawn;
  inspector.querySelector("#devSpawnNearPlayer").onclick=()=>{const x=snapDev(state.x+48),y=snapDev(state.y);if(!developerSpawnWalkable(x,y)){devSetStatus("The nearby point is not walkable");return;}spawn.x=x;spawn.y=y;syncDeveloperSpawnRuntime();saveDeveloperDraft();refreshDeveloperPanel();};
}

function developerAssetTypeLabel(type){return ({mobSprite:"Mob Sprite",npcSprite:"NPC Sprite",playerAppearance:"Playable Character",playerBody:"Legacy Player Body Layer",playerHair:"Legacy Player Hair Layer",playerEquipment:"Legacy Player Equipment Layer",itemIcon:"Item Icon",worldImage:"World Image",terrainTexture:"Terrain Texture",treeSprite:"Terrain Tree Sprite"})[type]||type||"Image";}
function developerAssetImportPurpose(value){return ({terrain:{type:"terrainTexture",auto:"terrain",label:"Paintable Terrain"},object:{type:"worldImage",auto:"object",label:"Placeable Object"},mobSprite:{type:"mobSprite",label:"Mob Sprite"},npcSprite:{type:"npcSprite",label:"NPC Sprite"},playerAppearance:{type:"playerAppearance",label:"Playable Character"},itemIcon:{type:"itemIcon",label:"Item Icon"},treeSprite:{type:"treeSprite",label:"Terrain Tree Sprite"},assetOnly:{type:"worldImage",label:"Asset"}})[value]||{type:value||"worldImage",label:"Asset"};}
function developerAssetFolder(type){return ({mobSprite:"assets/mobs",npcSprite:"assets/npcs",playerAppearance:"assets/characters",playerBody:"assets/characters",playerHair:"assets/characters",playerEquipment:"assets/characters",itemIcon:"assets/items",worldImage:"assets/imported",terrainTexture:"assets/environment/terrain",treeSprite:"assets/environment/terrain"})[type]||"assets/imported";}
function developerAssetSafeFilename(name){const raw=String(name||"asset.png"),dot=raw.lastIndexOf("."),ext=(dot>=0?raw.slice(dot).toLowerCase():".png").replace(/[^.a-z0-9]/g,"")||".png",base=devContentId(dot>=0?raw.slice(0,dot):raw,"asset");return `${base}${ext}`;}
function developerAssetUniqueId(base){const root=devContentId(base,"asset");let id=root,n=2;while(devAssets[id])id=`${root}-${n++}`;return id;}
async function developerAssetBitmap(file){
  if(typeof createImageBitmap==="function")return createImageBitmap(file);
  return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Image could not be read"));};img.src=url;});
}
function developerStandardSpriteLayout(){return {columns:4,rows:4,directionRows:{down:0,right:1,left:2,up:3},attackColumn:3,walkCycle:[0,1,2,1]};}
function developerSpriteImportType(type){return ["mobSprite","npcSprite","playerAppearance"].includes(type);}
function developerModularCharacterImportType(_type){return false;}
async function developerNormalizeCharacterRigSheet(file){
  const image=await developerAssetBitmap(file),sourceWidth=image.width||image.naturalWidth,sourceHeight=image.height||image.naturalHeight;if(!sourceWidth||!sourceHeight){image.close?.();throw new Error("Character rig dimensions could not be read");}
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=512;const c=canvas.getContext("2d");c.clearRect(0,0,512,512);c.imageSmoothingEnabled=false;c.drawImage(image,0,0,sourceWidth,sourceHeight,0,0,512,512);image.close?.();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Could not encode character rig sheet")),"image/png"));
  return {blob,sourceWidth,sourceHeight,sourceBytes:Number(file?.size)||0,width:512,height:512,cellSize:128,rigCoordinatesPreserved:true};
}
async function developerNormalizeSpriteSheet(file){
  const image=await developerAssetBitmap(file),sourceWidth=image.width||image.naturalWidth,sourceHeight=image.height||image.naturalHeight;
  if(!sourceWidth||!sourceHeight){image.close?.();throw new Error("Sprite dimensions could not be read");}
  const canvas=document.createElement("canvas"),cell=128,safe=112;canvas.width=cell*4;canvas.height=cell*4;
  const c=canvas.getContext("2d");c.clearRect(0,0,canvas.width,canvas.height);c.imageSmoothingEnabled=false;
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
    const sx0=Math.round(col*sourceWidth/4),sx1=Math.round((col+1)*sourceWidth/4),sy0=Math.round(row*sourceHeight/4),sy1=Math.round((row+1)*sourceHeight/4),sw=Math.max(1,sx1-sx0),sh=Math.max(1,sy1-sy0);
    const fit=Math.min(safe/sw,safe/sh),dw=Math.max(1,Math.round(sw*fit)),dh=Math.max(1,Math.round(sh*fit)),dx=col*cell+Math.round((cell-dw)/2),dy=row*cell+Math.round((cell-dh)/2);
    c.drawImage(image,sx0,sy0,sw,sh,dx,dy,dw,dh);
  }
  image.close?.();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Could not encode normalized sprite sheet")),"image/png"));
  return {blob,sourceWidth,sourceHeight,sourceBytes:Number(file?.size)||0,width:512,height:512,cellSize:128};
}
async function developerAssetAnalysis(file,type){
  const image=await developerAssetBitmap(file),width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;
  if(!width||!height){image.close?.();throw new Error("Image dimensions could not be read");}
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const c=canvas.getContext("2d",{willReadFrequently:true});c.clearRect(0,0,width,height);c.drawImage(image,0,0);image.close?.();
  const pixels=c.getImageData(0,0,width,height).data;let opaque=0,transparent=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]>8)opaque++;if(pixels[i]<250)transparent++;}
  const analysis={hasTransparency:transparent>0,alphaCoverage:Number((opaque/Math.max(1,width*height)).toFixed(4))};
  if(developerSpriteImportType(type)){
    const columns=4,rows=4,frames=[];let edgeTouch=false,safeAreaOverflow=false,emptyFrames=0,maxVisibleWidth=0,maxVisibleHeight=0;
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const sx0=Math.round(col*width/columns),sx1=Math.round((col+1)*width/columns),sy0=Math.round(row*height/rows),sy1=Math.round((row+1)*height/rows);
      let minX=sx1,minY=sy1,maxX=sx0-1,maxY=sy0-1;
      for(let py=sy0;py<sy1;py++){let index=(py*width+sx0)*4+3;for(let px=sx0;px<sx1;px++,index+=4)if(pixels[index]>8){if(px<minX)minX=px;if(px>maxX)maxX=px;if(py<minY)minY=py;if(py>maxY)maxY=py;}}
      if(maxX<minX||maxY<minY){emptyFrames++;frames.push({row,col,visibleWidth:0,visibleHeight:0});continue;}
      const visibleWidth=maxX-minX+1,visibleHeight=maxY-minY+1,cellW=sx1-sx0,cellH=sy1-sy0,marginX=Math.max(1,Math.round(cellW*.01)),marginY=Math.max(1,Math.round(cellH*.01)),safeInsetX=Math.round(cellW*(20/128)),safeInsetY=Math.round(cellH*(20/128));
      const touches=minX-sx0<=marginX||minY-sy0<=marginY||sx1-1-maxX<=marginX||sy1-1-maxY<=marginY,unsafe=minX<sx0+safeInsetX||minY<sy0+safeInsetY||maxX>sx1-1-safeInsetX||maxY>sy1-1-safeInsetY;edgeTouch=edgeTouch||touches;safeAreaOverflow=safeAreaOverflow||unsafe;maxVisibleWidth=Math.max(maxVisibleWidth,visibleWidth);maxVisibleHeight=Math.max(maxVisibleHeight,visibleHeight);frames.push({row,col,visibleWidth,visibleHeight});
    }
    const reference=frames.find(frame=>frame.row===0&&frame.col===0)||frames.find(frame=>frame.visibleHeight>0)||{visibleWidth:0,visibleHeight:0};
    analysis.frameMetrics={columns,rows,referenceVisibleWidth:reference.visibleWidth,referenceVisibleHeight:reference.visibleHeight,maxVisibleWidth,maxVisibleHeight,emptyFrames,edgeTouch,safeAreaOverflow};
  }
  return {width,height,analysis};
}
async function developerAssetPathExists(path){try{await developerNestedFileHandle(devProjectDirectoryHandle,path);return true;}catch{return false;}}
async function developerAssetUniquePath(folder,filename){const dot=filename.lastIndexOf("."),base=dot>=0?filename.slice(0,dot):filename,ext=dot>=0?filename.slice(dot):"";let candidate=`${folder}/${filename}`,n=2;while(await developerAssetPathExists(candidate))candidate=`${folder}/${base}-${n++}${ext}`;return candidate;}


async function developerImportAssetFile(file,purposeValue){
  if(!file)throw new Error("No file selected");if(!devProjectDirectoryHandle)throw new Error("Open the Little Realm Project Folder before importing assets");
  const purpose=developerAssetImportPurpose(purposeValue),type=purpose.type;
  if(!(file.type||"").startsWith("image/")&&!/\.(png|webp|jpg|jpeg)$/i.test(file.name))throw new Error(`${file.name}: image files only`);
  let importPayload=file,sourceMeta=null,filename=developerAssetSafeFilename(file.name);
  if(developerModularCharacterImportType(type)){const normalized=await developerNormalizeCharacterRigSheet(file);sourceMeta=normalized;importPayload=normalized.blob;filename=developerAssetSafeFilename(file.name.replace(/\.[^.]+$/,'')+'.png');}
  else if(developerSpriteImportType(type)){const normalized=await developerNormalizeSpriteSheet(file);sourceMeta=normalized;importPayload=normalized.blob;filename=developerAssetSafeFilename(file.name.replace(/\.[^.]+$/,'')+'.png');}
  const inspected=await developerAssetAnalysis(importPayload,type),path=await developerAssetUniquePath(developerAssetFolder(type),filename),handle=await developerNestedFileHandle(devProjectDirectoryHandle,path,{create:true}),writable=await handle.createWritable();await writable.write(importPayload);await writable.close();
  const id=developerAssetUniqueId(`${type}-${filename.replace(/\.[^.]+$/,'')}`),name=file.name.replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const rigBodyId=developerModularCharacterImportType(type)&&type!=="playerBody"?(String(devCharacterDefaults?.defaultBodyAsset||"")||Object.entries(devAssets).find(([,rec])=>rec?.type==="playerBody")?.[0]||""):"";
  const spriteMeta=developerSpriteImportType(type)?{normalizedSheet:true,frameCellSize:128,sourceName:file.name,sourceWidth:sourceMeta.sourceWidth,sourceHeight:sourceMeta.sourceHeight,sourceBytes:sourceMeta.sourceBytes,spriteLayout:developerStandardSpriteLayout(),...(type==='mobSprite'?{scaleMode:'visibleHeight'}:{scaleMode:type.startsWith('player')?'characterRig':'displayHeight'}),...(developerModularCharacterImportType(type)?{rigCoordinatesPreserved:true,rigTransform:{scale:1,offsetX:0,offsetY:0,directionOffsets:{down:{offsetX:0,offsetY:0},right:{offsetX:0,offsetY:0},left:{offsetX:0,offsetY:0},up:{offsetX:0,offsetY:0}}},rigBodyAsset:rigBodyId}: {})}:{};
  devAssets[id]={name,path,type,width:inspected.width,height:inspected.height,bytes:Number(importPayload.size)||file.size,imported:true,artProfile:'little-realm-v1',analysis:inspected.analysis,...spriteMeta,...(type==='playerEquipment'?{equipmentSlot:purpose.equipmentSlot||'chest'}:{})};
  if(type==='playerBody'){devAssets[id].rigBodyAsset=id;if(!devCharacterDefaults.defaultBodyAsset)devCharacterDefaults.defaultBodyAsset=id;window.LR_CHARACTER_DEFAULTS=devCharacterDefaults;}
  let createdId='';if(purpose.auto==='terrain')createdId=createDeveloperTerrain(name,id,{silent:true});else if(purpose.auto==='object')createdId=createDeveloperObjectDefinitionFromAsset(devAssets[id],id,{silent:true});
  return {id,asset:devAssets[id],createdId,purpose,sourceMeta,warnings:developerAssetValidationRows(devAssets[id]).filter(row=>row.state==='warn').length};
}
async function importDeveloperAssetFiles(files){
  const list=Array.from(files||[]);if(!list.length)return;if(!devProjectDirectoryHandle){devSetStatus('Open the Little Realm Project Folder before importing assets');return;}
  const purposeValue=devPanel?.querySelector('#devAssetImportType')?.value||'assetOnly',purpose=developerAssetImportPurpose(purposeValue),results=[],errors=[];
  for(let i=0;i<list.length;i++){const file=list[i];devSetStatus(`Importing ${i+1}/${list.length} • ${file.name}`);try{results.push(await developerImportAssetFile(file,purposeValue));}catch(err){console.error(err);errors.push(err?.message||`${file.name}: import failed`);}}
  if(results.length){devAssetSelectedId=results[results.length-1].id;saveDeveloperDraft();}
  refreshDeveloperPanel();const resultRoot=devPanel?.querySelector('#devAssetImportResult');if(resultRoot){const created=purpose.auto==='terrain'?`${results.length} paintable terrain${results.length===1?'':'s'}`:purpose.auto==='object'?`${results.length} placeable object${results.length===1?'':'s'}`:`${results.length} asset${results.length===1?'':'s'}`;const action=purpose.auto==='terrain'?'<button data-import-open="terrain">Open Terrain</button>':purpose.auto==='object'?'<button data-import-open="objects">Open Objects</button>':purposeValue==='npcSprite'?'<button data-import-open="npcs">Open NPCs</button>':purposeValue==='mobSprite'?'<button data-import-open="content" data-import-content="mobs">Open Mob Types</button>':purposeValue==='itemIcon'?'<button data-import-open="content" data-import-content="items">Open Items</button>':purposeValue==='treeSprite'?'<button data-import-open="terrain">Open Terrain</button>':'';resultRoot.innerHTML=`<div class="devImportResult ${errors.length?'warn':''}"><b>${created} imported</b><span>${errors.length?`${errors.length} file${errors.length===1?'':'s'} failed. `:''}Ready for the next step.</span><div>${action}<button data-import-more>Import More</button></div></div>`;resultRoot.querySelector('[data-import-more]')?.addEventListener('click',()=>devPanel.querySelector('#devAssetImportFile')?.click());resultRoot.querySelector('[data-import-open]')?.addEventListener('click',event=>{const button=event.currentTarget;if(button.dataset.importContent)devContentType=button.dataset.importContent;setDeveloperTab(button.dataset.importOpen);refreshDeveloperPanel();});}
  const warningCount=results.reduce((sum,r)=>sum+r.warnings,0);devSetStatus(`${results.length}/${list.length} imported as ${purpose.label}${warningCount?` • ${warningCount} technical warning${warningCount===1?'':'s'}`:''}${errors.length?` • ${errors.length} failed`:''}`);
}
async function importDeveloperAssetFile(file){return importDeveloperAssetFiles(file?[file]:[]);}

function developerAssetValidationRows(asset){
  const rows=[],sprite=developerSpriteImportType(asset?.type),rig=developerCharacterRigAssetType?.(asset?.type),analysis=asset?.analysis||{},metrics=analysis.frameMetrics;
  if(sprite&&asset?.sourceWidth&&asset?.sourceHeight)rows.push({state:"info",label:"AI source sheet",detail:`${asset.sourceWidth} × ${asset.sourceHeight} • original import`});
  rows.push({state:asset?.width&&asset?.height?"good":"warn",label:rig?"Rig sheet":sprite?"Game sheet":"Source dimensions",detail:asset?.width&&asset?.height?(sprite?`${asset.width} × ${asset.height} • ${Math.round((asset.width||0)/4)} px cells`:`${asset.width} × ${asset.height}`):"Not recorded"});
  if(sprite){
    if(rig)rows.push({state:asset?.rigCoordinatesPreserved&&asset.width===512&&asset.height===512?"good":"warn",label:"Exact rig coordinates",detail:asset?.rigCoordinatesPreserved?"Whole 4×4 sheet normalized once to 512 × 512; frame positions are preserved":"Character layer was not imported through the exact-coordinate rig path"});
    else rows.push({state:asset?.normalizedSheet?(asset.width===512&&asset.height===512?"good":"warn"):"info",label:"4 × 4 normalization",detail:asset?.normalizedSheet?(asset.width===512&&asset.height===512?"Normalized to 512 × 512 on import":"Normalized sheet is not 512 × 512"):"Existing project sprite; runtime reads its registered 4 × 4 layout"});
    rows.push({state:analysis.hasTransparency?"good":"warn",label:"Transparent background",detail:analysis.hasTransparency?"Detected":"No transparent pixels detected"});
    rows.push({state:metrics&&metrics.emptyFrames===0?"good":"warn",label:"4 × 4 frame read",detail:metrics?`${16-Math.min(16,metrics.emptyFrames||0)}/16 populated frames`:"Frame analysis missing"});
    const unsafe=metrics?.edgeTouch;rows.push({state:metrics&&!unsafe?"good":"warn",label:"Safe framing",detail:metrics?(unsafe?"Artwork reaches a 128 px frame edge":"Visible pixels stay clear of frame edges"):"Frame analysis missing"});
    const map=asset?.spriteLayout?.directionRows||{};rows.push({state:"info",label:"Direction rows",detail:`Down ${Number(map.down??0)+1} • Right ${Number(map.right??1)+1} • Left ${Number(map.left??2)+1} • Up ${Number(map.up??3)+1}`});
    rows.push({state:"good",label:"World scale",detail:asset.type==="mobSprite"?"Normalized by visible height":rig?"Uses the exact modular player rig":asset.type?.startsWith?.("player")?"Uses the standard player character rig":"NPC display height controlled in-game"});
  }else rows.push({state:"info",label:"Little Realm profile",detail:asset?.artProfile||"Existing project asset"});
  return rows;
}
function developerAssetValidationHtml(asset){
  const metrics=asset?.analysis?.frameMetrics,rows=developerAssetValidationRows(asset),warnings=rows.filter(row=>row.state==="warn").length,sprite=developerSpriteImportType(asset?.type);
  const rig=developerCharacterRigAssetType?.(asset?.type),hint=metrics?`<div class="devHint" style="margin-top:7px">Reference-frame visible bounds: <b>${Math.round(metrics.referenceVisibleWidth||0)} × ${Math.round(metrics.referenceVisibleHeight||0)} px</b>. ${rig?"Modular layers keep one shared 128 px coordinate system; use Layer Alignment only if the generated art itself is oversized or offset.":sprite&&asset?.sourceWidth?`The AI source was ${asset.sourceWidth} × ${asset.sourceHeight}; the project uses the normalized ${asset.width} × ${asset.height} game sheet.`:"Source resolution does not control world size."}</div>`:"";
  return `<div class="devAssetChecks"><div class="devAssetChecksTitle"><b>Little Realm Asset Check</b><span class="${warnings?"warn":"good"}">${warnings?`${warnings} warning${warnings===1?"":"s"}`:"READY"}</span></div>${rows.map(row=>`<div class="devAssetCheck ${row.state}"><span>${row.state==="good"?"✓":row.state==="warn"?"!":"•"}</span><b>${devContentEscape(row.label)}</b><small>${devContentEscape(row.detail)}</small></div>`).join("")}${hint}</div>`;
}

function developerSpriteDirectionMappingHtml(asset){
  if(!developerSpriteImportType(asset?.type))return "";
  const map=asset?.spriteLayout?.directionRows||{down:0,right:1,left:2,up:3};
  const rowOptions=value=>[0,1,2,3].map(row=>`<option value="${row}" ${Number(value)===row?"selected":""}>Row ${row+1}</option>`).join("");
  return `<div class="devAssetChecks"><div class="devAssetChecksTitle"><b>Sprite Direction Mapping</b><span class="good">EDITABLE</span></div><div class="devHint" style="margin:4px 0 9px">If a sprite turns the wrong way in-game, map each facing direction to the row that visually points that way. AI sprite sheets do not always follow the requested left/right row order.</div><div class="devPair"><label>Facing Down<select id="devSpriteRowDown">${rowOptions(map.down??0)}</select></label><label>Facing Right<select id="devSpriteRowRight">${rowOptions(map.right??1)}</select></label></div><div class="devPair"><label>Facing Left<select id="devSpriteRowLeft">${rowOptions(map.left??2)}</select></label><label>Facing Up<select id="devSpriteRowUp">${rowOptions(map.up??3)}</select></label></div><div class="devRow"><button id="devSpriteSwapSides">Swap Left / Right</button><button id="devSpriteResetRows">Prompt Standard</button></div></div>`;
}
function bindDeveloperSpriteDirectionMapping(root,asset){
  if(!root||!developerSpriteImportType(asset?.type))return;
  const getMap=()=>({down:Number(root.querySelector('#devSpriteRowDown')?.value??0),right:Number(root.querySelector('#devSpriteRowRight')?.value??1),left:Number(root.querySelector('#devSpriteRowLeft')?.value??2),up:Number(root.querySelector('#devSpriteRowUp')?.value??3)});
  const commit=map=>{
    const rows=[map.down,map.right,map.left,map.up];
    if(new Set(rows).size!==4){devSetStatus('Each facing direction must use a different sprite row');refreshDeveloperAssetPanel();return;}
    asset.spriteLayout={...(asset.spriteLayout||developerStandardSpriteLayout()),directionRows:{...map}};
    // Keep the live runtime asset registry pointed at the editable Builder records.
    // Otherwise F2 playtesting can keep rendering the pre-edit asset metadata until
    // the whole shared content library is reloaded.
    if(typeof window!=="undefined"){
      window.LR_ASSETS=devAssets;
      if(typeof developerContentLibrary==="function")window.LR_SHARED_CONTENT=developerContentLibrary();
    }
    saveDeveloperDraft();
    devSetStatus(`Direction mapping applied live for ${asset.name||'sprite asset'} • Save Project to persist`);
    refreshDeveloperAssetPanel();
  };
  ['#devSpriteRowDown','#devSpriteRowRight','#devSpriteRowLeft','#devSpriteRowUp'].forEach(selector=>root.querySelector(selector)?.addEventListener('change',()=>commit(getMap())));
  root.querySelector('#devSpriteSwapSides')?.addEventListener('click',()=>{const map=getMap();[map.left,map.right]=[map.right,map.left];commit(map);});
  root.querySelector('#devSpriteResetRows')?.addEventListener('click',()=>commit({down:0,right:1,left:2,up:3}));
}

function developerArtPromptKindOptions(){
  return {
    mob:{label:"Mob Sprite",importType:"mobSprite",sizeLabel:"World Size",sizeOptions:[["tiny","Tiny • 0.35× player"],["small","Small • 0.55× player"],["medium","Medium • 0.80× player"],["large","Large • 1.05× player"],["huge","Huge • 1.35× player"],["boss","Boss • 1.80× player"]]},
    npc:{label:"NPC Sprite",importType:"npcSprite",sizeLabel:"World Size",sizeOptions:[["small","Small • 0.85× player"],["medium","Medium • 1.00× player"],["large","Large • 1.15× player"]]},
    player:{label:"Playable Character",importType:"playerAppearance",sizeLabel:"Rig",sizeOptions:[["standard","Standard Player Rig"]]},
    object:{label:"World Object",importType:"worldImage",sizeLabel:"Object Scale",sizeOptions:[["small","Small Prop"],["medium","Medium Prop"],["large","Large Prop"]]},
    building:{label:"Building",importType:"worldImage",sizeLabel:"Building Scale",sizeOptions:[["small","Small Hut"],["medium","Medium House"],["large","Large Building"]]},
    terrain:{label:"Terrain Texture",importType:"terrainTexture",sizeLabel:"Detail Density",sizeOptions:[["micro","Micro detail"],["fine","Fine detail"],["medium","Medium detail"]]},
    item:{label:"Item Icon",importType:"itemIcon",sizeLabel:"Icon Scale",sizeOptions:[["small","Small"],["medium","Medium"],["large","Large"]]},
    effect:{label:"Effect Sprite",importType:"worldImage",sizeLabel:"Effect Scale",sizeOptions:[["small","Small"],["medium","Medium"],["large","Large"]]}
  };
}
function developerEnsureArtPromptDraft(){
  const defaults={kind:"mob",sizeClass:"medium",subject:"",description:"",palette:"",constraints:""};
  if(!devArtPromptDraft||typeof devArtPromptDraft!=="object")devArtPromptDraft={...defaults};
  else devArtPromptDraft={...defaults,...devArtPromptDraft};
  return devArtPromptDraft;
}
function developerArtPromptStandardSummaryHtml(){
  return `<div class="devHint">Lock the game's art direction before you generate anything new. The prompt builder below keeps <b>style</b>, <b>framing</b>, <b>detail density</b>, and <b>technical layout</b> consistent so you only have to describe the subject.</div><div class="devArtGuideGrid"><div class="devArtGuideCard"><b>Rendering</b><small>Polished fantasy pixel art, crisp pixel edges, slightly chunky dark outlines, readable silhouettes, soft dimensional shading, grounded fantasy colors.</small></div><div class="devArtGuideCard"><b>Camera</b><small>Top-down 2D RPG / slight 3⁄4 game view matching Little Realm. Never a full side view or isometric scene render.</small></div><div class="devArtGuideCard"><b>Consistency</b><small>No painterly blur, no photorealism, no smooth vector look, no promotional poster composition, and no scene background unless the asset type explicitly needs one.</small></div><div class="devArtGuideCard"><b>Scale Guide</b><small>Player ≈ 1.0 LR. Small mob ≈ 0.55 LR. Medium mob ≈ 0.80 LR. Large mob ≈ 1.05 LR. Small props should stay visually modest next to the player.</small></div></div>`;
}
function developerArtPromptBuildText(draft){
  const kind=(developerArtPromptKindOptions()[draft.kind]||developerArtPromptKindOptions().mob),subject=String(draft.subject||kind.label).trim()||kind.label,description=String(draft.description||"").trim(),palette=String(draft.palette||"").trim(),constraints=String(draft.constraints||"").trim(),sizeLabel=(kind.sizeOptions.find(([value])=>value===draft.sizeClass)||kind.sizeOptions[0]||["","Custom"])[1];
  const referenceBlock=typeof developerArtReferencePromptText==="function"?developerArtReferencePromptText(draft.kind):"";
  const style=`Style requirements: polished fantasy pixel art for Little Realm, top-down 2D RPG perspective, crisp intentional pixel edges, slightly chunky dark outlines, readable silhouette, soft dimensional shading, bright but grounded fantasy colors, and clean game-ready rendering. Do not make it painterly, realistic, blurry, or vector-smooth.`;
  const subjectBlock=`Subject: ${subject}.${description?` ${description}`:""}${palette?` Color / material notes: ${palette}.`:""}`;
  const constraintsBlock=constraints?`Additional constraints: ${constraints}.`:"";
  if(draft.kind==="mob"||draft.kind==="npc"||draft.kind==="player")return `Create a production-ready ${kind.label.toLowerCase()} for the fantasy game Little Realm.

${subjectBlock}

World size target: ${sizeLabel}.

${style}

Technical layout requirements:
- final output must be a strict 4 columns × 4 rows sprite sheet
- exactly 16 frames total
- target frame size is 128 × 128 pixels and target sheet size is 512 × 512 pixels
- if the image generator returns a different square resolution, preserve a strict equal 4 × 4 grid; Little Realm will normalize it to 512 × 512 on import
- background must be fully transparent RGBA
- do not draw grid lines, labels, borders, or any extra markings
- row 1 = facing down, row 2 = facing right, row 3 = facing left, row 4 = facing up
- columns should read as a game-ready idle / walk sequence, with the 4th column usable as an attack or action pose

Safe-area requirements:
- at the 128 × 128 target size, visible artwork should stay inside a centered 88 × 88 safe area
- this is roughly the central 69% of each cell, leaving about 16% transparent padding on every side even if the generator returns a larger source sheet
- no body part, weapon, ears, horns, wings, tail, hands, feet, or effects should touch a cell boundary

Composition requirements:
- keep the subject centered in every frame
- maintain consistent proportions and scale across all 16 frames
- no scene background, floor tile, UI, or text
- the sprite should read clearly in-game at small size

${constraintsBlock}${referenceBlock?`\n\n${referenceBlock}`:""}`.trim();
  if(draft.kind==="terrain")return `Create a seamless tileable ${subject} ground texture for the fantasy game Little Realm.

${description||"This texture is for terrain painting across large map areas."}${palette?` Color / material notes: ${palette}.`:""}

${style}

Technical requirements:
- fully seamless / tileable on all edges
- designed for repeated use across large painted map areas
- detail must stay small-scale, dense, and evenly distributed
- avoid large focal elements, large isolated rocks or flowers, giant plants, horizon lines, or anything that looks like a full scene
- no labels, borders, or UI
- it should blend smoothly with nearby Little Realm terrain when tiled many times

Detail density target: ${sizeLabel}. Prioritize micro-detail and readability over dramatic composition.

${constraintsBlock}${referenceBlock?`\n\n${referenceBlock}`:""}`.trim();
  const canvasHint=draft.kind==="item"?`Use a compact square asset presentation, centered with padding, similar to a clean 64×64 or 128×128 game icon.`:draft.kind==="effect"?`Use a single clean effect asset on transparency, centered with padding, with no surrounding scene.`:draft.kind==="building"?`Present it as a single placeable building sprite with no surrounding scene. Keep the silhouette readable and the footprint clear.`:`Present it as a single placeable object sprite with no surrounding scene. Center it on the canvas with healthy transparent padding.`;
  return `Create a production-ready ${kind.label.toLowerCase()} for the fantasy game Little Realm.

${subjectBlock}

Scale target: ${sizeLabel}.

${style}

Technical requirements:
- background must be fully transparent RGBA
- show only the asset itself, not a full scene or environment
- keep the asset centered with comfortable transparent padding around it
- no labels, borders, UI, or extra decorative frame
- preserve a clean, readable silhouette suitable for top-down RPG gameplay
- do not overscale it; it should feel appropriate beside the Little Realm player and NPCs
- ${canvasHint}

${constraintsBlock}${referenceBlock?`\n\n${referenceBlock}`:""}`.trim();
}
function copyDeveloperArtPrompt(){
  const prompt=developerArtPromptBuildText(developerEnsureArtPromptDraft()),output=devPanel?.querySelector('#devArtPromptOutput');
  if(output)output.value=prompt;
  navigator.clipboard?.writeText(prompt).then(()=>devSetStatus('Little Realm art prompt copied')).catch(()=>devSetStatus(prompt));
}
function refreshDeveloperArtPromptBuilder(){
  if(!devPanel)return;const root=devPanel.querySelector('#devArtPromptBuilder');if(!root)return;const draft=developerEnsureArtPromptDraft(),kinds=developerArtPromptKindOptions(),kind=kinds[draft.kind]||kinds.mob;if(!kind.sizeOptions.some(([value])=>value===draft.sizeClass))draft.sizeClass=kind.sizeOptions[0][0];
  const kindOptions=Object.entries(kinds).map(([value,rec])=>`<option value="${devContentEscape(value)}" ${value===draft.kind?"selected":""}>${devContentEscape(rec.label)}</option>`).join('');
  const sizeOptions=(kind.sizeOptions||[]).map(([value,label])=>`<option value="${devContentEscape(value)}" ${value===draft.sizeClass?"selected":""}>${devContentEscape(label)}</option>`).join('');
  root.innerHTML=`${developerArtPromptStandardSummaryHtml()}${typeof developerArtPromptReferenceCardsHtml==="function"?developerArtPromptReferenceCardsHtml(draft.kind):""}<div class="devArtPromptLayout"><div class="devArtPromptForm"><div class="devPair"><label>Asset Type<select id="devArtPromptKind">${kindOptions}</select></label><label>${devContentEscape(kind.sizeLabel)}<select id="devArtPromptSize">${sizeOptions}</select></label></div><label>Subject<input id="devArtPromptSubject" value="${devContentEscape(draft.subject||"")}" placeholder="Forest spider, bakery stall, flower meadow, etc."></label><label>Description<textarea id="devArtPromptDescription" class="devArtPromptTextarea" placeholder="Describe the subject, shape, mood, and important physical details.">${devContentEscape(draft.description||"")}</textarea></label><label>Color / Material Notes<textarea id="devArtPromptPalette" class="devArtPromptTextarea" placeholder="Optional palette, materials, or style accents.">${devContentEscape(draft.palette||"")}</textarea></label><label>Additional Constraints<textarea id="devArtPromptConstraints" class="devArtPromptTextarea" placeholder="Optional exact requirements: signage text, no weapon, must feel cute, etc.">${devContentEscape(draft.constraints||"")}</textarea></label><div class="devPromptActions"><button id="devArtPromptCopy" class="primary">Copy Prompt</button><button id="devArtPromptReset">Reset</button></div><div class="devHint" style="margin-top:8px">Tip: choose the asset type first, then only describe <b>what the thing is</b>. The builder locks the Little Realm technical rules for you.</div></div><div class="devArtPromptOutputWrap"><div class="devSectionTitle" style="padding:0 0 6px;font-size:11px">Generated Prompt</div><textarea id="devArtPromptOutput" class="devPromptOutput" readonly>${devContentEscape(developerArtPromptBuildText(draft))}</textarea></div></div>`;
  const update=(rerender=false)=>{draft.kind=root.querySelector('#devArtPromptKind').value||'mob';draft.sizeClass=root.querySelector('#devArtPromptSize').value||'medium';draft.subject=root.querySelector('#devArtPromptSubject').value||'';draft.description=root.querySelector('#devArtPromptDescription').value||'';draft.palette=root.querySelector('#devArtPromptPalette').value||'';draft.constraints=root.querySelector('#devArtPromptConstraints').value||'';if(rerender){refreshDeveloperArtPromptBuilder();return;}const out=root.querySelector('#devArtPromptOutput');if(out)out.value=developerArtPromptBuildText(draft);};
  root.querySelector('#devArtPromptKind').onchange=()=>update(true);
  root.querySelector('#devArtPromptSize').onchange=()=>update();
  root.querySelector('#devArtPromptSubject').oninput=()=>update();
  root.querySelector('#devArtPromptDescription').oninput=()=>update();
  root.querySelector('#devArtPromptPalette').oninput=()=>update();
  root.querySelector('#devArtPromptConstraints').oninput=()=>update();
  root.querySelector('#devArtPromptCopy').onclick=copyDeveloperArtPrompt;
  root.querySelector('#devArtPromptReset').onclick=()=>{devArtPromptDraft={kind:'mob',sizeClass:'medium',subject:'',description:'',palette:'',constraints:''};refreshDeveloperArtPromptBuilder();devSetStatus('Art prompt builder reset');};
}

function refreshDeveloperAssetPanel(){
  if(!devPanel)return;const list=devPanel.querySelector('#devAssetList'),inspector=devPanel.querySelector('#devAssetInspector'),summary=devPanel.querySelector('#devAssetSummary');if(!list||!inspector)return;const entries=Object.entries(devAssets).filter(([,asset])=>!["playerBody","playerHair","playerEquipment"].includes(asset?.type));if(summary)summary.textContent=`${entries.length} registered images • batch import ready`;refreshDeveloperArtPromptBuilder();refreshDeveloperArtReferenceLibrary?.();
  if(devAssetSelectedId&&!devAssets[devAssetSelectedId])devAssetSelectedId=null;if(!devAssetSelectedId)devAssetSelectedId=entries[0]?.[0]||null;const filter=devPanel.querySelector('#devAssetFilter')?.value||'all',query=String(devPanel.querySelector('#devAssetSearch')?.value||'').trim().toLowerCase(),visible=entries.filter(([id,asset])=>(filter==='all'||asset.type===filter)&&(!query||`${asset.name||''} ${id} ${asset.path||''}`.toLowerCase().includes(query)));
  list.innerHTML=visible.map(([id,asset])=>`<button class="devAssetChip ${id===devAssetSelectedId?'active':''}" data-asset-id="${devContentEscape(id)}"><img src="./${devContentEscape(asset.path)}" alt=""><span><b>${devContentEscape(asset.name||id)}</b><small>${devContentEscape(developerAssetTypeLabel(asset.type))}</small></span></button>`).join('')||'<div class="devEmpty">No assets match this search/filter.</div>';list.querySelectorAll('[data-asset-id]').forEach(button=>button.onclick=()=>{devAssetSelectedId=button.dataset.assetId;refreshDeveloperAssetPanel();});
  const asset=devAssets[devAssetSelectedId];if(!asset){inspector.innerHTML='<div class="devEmpty">Import or choose an asset.</div>';return;}const targets=developerAssetAssignOptions(asset.type),dims=asset.width&&asset.height?`${asset.width} × ${asset.height}`:'dimensions not recorded',size=asset.bytes?`${Math.max(1,Math.round(asset.bytes/1024))} KB`:'size not recorded';
  const terrainRecordId=Object.keys(devTerrains||{}).find(id=>devTerrains[id]?.textureAsset===devAssetSelectedId)||'',objectRecordId=Object.keys(devObjectDefinitions||{}).find(id=>devObjectDefinitions[id]?.sourceAssetId===devAssetSelectedId)||'';
  const makePlayer=asset.type==='playerAppearance'?`<button id="devAssetDefaultPlayer" class="devWideButton primary">${devCharacterDefaults?.defaultAppearanceAsset===devAssetSelectedId?'Default Playable Character':'Set as Default Playable Character'}</button>`:'',makeNpc=asset.type==='npcSprite'?'<button id="devAssetPlaceNpc" class="devWideButton primary">Place NPC With This Sprite</button>':'',makeObject=asset.type==='worldImage'?(objectRecordId?'<button id="devAssetOpenObject" class="devWideButton primary">Open Placeable Object</button>':'<button id="devAssetMakeObject" class="devWideButton primary">Create Placeable Object</button>'):'',makeTerrain=(asset.type==='terrainTexture'||asset.type==='worldImage')?(terrainRecordId?'<button id="devAssetOpenTerrainRecord" class="devWideButton primary">Open Paintable Terrain</button>':'<button id="devAssetMakeTerrain" class="devWideButton primary">Create Paintable Terrain</button>'):'',openTerrain=asset.type==='treeSprite'?'<button id="devAssetOpenTerrain" class="devWideButton">Open Terrain Library</button>':'';
  inspector.innerHTML=`<div class="devAssetPreview"><img src="./${devContentEscape(asset.path)}" alt="${devContentEscape(asset.name||'')}"></div><div class="devSelectedTitle">${devContentEscape(asset.name||devAssetSelectedId)}</div><div class="devAssetMeta">${devContentEscape(developerAssetTypeLabel(asset.type))} • ${dims} • ${size}</div>${developerAssetValidationHtml(asset)}${developerSpriteDirectionMappingHtml(asset)}${developerCharacterRigAlignmentHtml?.(asset,devAssetSelectedId)||''}${developerAssetMasterControlsHtml?.(asset,devAssetSelectedId)||''}${developerReferenceComparisonHtml?.(asset,devAssetSelectedId)||''}<label>Project Path<input value="${devContentEscape(asset.path)}" readonly></label>${targets.length?`<div class="devPair"><label>Assign To<select id="devAssetAssignTarget"><option value="">Choose target…</option>${targets.map(([id,name])=>`<option value="${devContentEscape(id)}">${devContentEscape(name)} (${devContentEscape(id)})</option>`).join('')}</select></label><label>Usage<input value="${asset.type==='mobSprite'?'4×4 • normalized world height':asset.type==='npcSprite'?'NPC model':'Inventory icon'}" readonly></label></div><button id="devAssetAssign" class="devWideButton">Assign Asset</button>`:''}${makePlayer}${makeNpc}${makeTerrain}${makeObject}${openTerrain}<div class="devRow"><button id="devAssetCopy">Copy Path</button><button id="devAssetRemove" class="danger">Remove Record</button></div>`;
  bindDeveloperAssetMasterControls?.(inspector,asset,devAssetSelectedId);bindDeveloperSpriteDirectionMapping(inspector,asset);bindDeveloperCharacterRigAlignment?.(inspector,asset,devAssetSelectedId);inspector.querySelector('#devAssetDefaultPlayer')?.addEventListener('click',()=>{devCharacterDefaults.defaultAppearanceAsset=devAssetSelectedId;window.LR_CHARACTER_DEFAULTS=devCharacterDefaults;saveDeveloperDraft();refreshDeveloperAssetPanel();devSetStatus(`${asset.name||devAssetSelectedId} is now the default character-select choice`);});inspector.querySelector('#devAssetCopy').onclick=copyDeveloperAssetPath;inspector.querySelector('#devAssetPlaceNpc')?.addEventListener('click',()=>{devPlaceNpcAsset=devAssetSelectedId;devPlaceType=null;devPlaceMobType=null;setDeveloperTab('npcs');refreshDeveloperPanel();devSetStatus(`Placing ${asset.name||devAssetSelectedId} NPC — click the world${devRepeatPlacement?' repeatedly':' once'}`);});inspector.querySelector('#devAssetMakeObject')?.addEventListener('click',()=>createDeveloperObjectDefinitionFromAsset(asset,devAssetSelectedId));inspector.querySelector('#devAssetOpenObject')?.addEventListener('click',()=>{setDeveloperTab('objects');const search=devPanel.querySelector('#devObjectSearch');if(search)search.value=asset.name||'';refreshDeveloperObjectPalette();devSetStatus(`Showing ${asset.name||devAssetSelectedId} in Object Library`);});inspector.querySelector('#devAssetMakeTerrain')?.addEventListener('click',()=>createDeveloperTerrainFromAsset(asset,devAssetSelectedId));inspector.querySelector('#devAssetOpenTerrainRecord')?.addEventListener('click',()=>{if(terrainRecordId){devTerrainSelectedId=terrainRecordId;devTerrainBrush=terrainRecordId;}setDeveloperTab('terrain');refreshDeveloperTerrainPanel();});inspector.querySelector('#devAssetOpenTerrain')?.addEventListener('click',()=>{setDeveloperTab('terrain');devSetStatus(`Choose a terrain and assign ${asset.name||devAssetSelectedId} as its tree sprite`);});inspector.querySelector('#devAssetRemove')?.addEventListener('click',removeDeveloperAssetRecord);inspector.querySelector('#devAssetAssign')?.addEventListener('click',()=>assignDeveloperAsset(asset,inspector.querySelector('#devAssetAssignTarget').value));
}

const DEV_CHARACTER_RIG_IMAGE_CACHE=new Map();
let DEV_CHARACTER_RIG_FULLSCREEN_KEY_HANDLER=null;
const DEV_CHARACTER_RIG_DIRECTIONS=["down","right","left","up"];
const DEV_PLAYER_EQUIPMENT_SLOTS=[["head","Head"],["chest","Chest"],["hands","Hands"],["back","Back"],["legs","Legs"],["feet","Feet / Boots"],["mainHand","Main Hand"],["offHand","Off Hand"]];
function developerCharacterRigAssetType(type){return ["playerBody","playerHair","playerEquipment"].includes(type);}
function developerCharacterOverlayAssetType(type){return ["playerHair","playerEquipment"].includes(type);}
function developerCharacterRigTransform(asset){
  const raw=asset?.rigTransform&&typeof asset.rigTransform==="object"?asset.rigTransform:{},directionOffsets={};
  for(const direction of DEV_CHARACTER_RIG_DIRECTIONS){
    const row=raw?.directionOffsets?.[direction]&&typeof raw.directionOffsets[direction]==="object"?raw.directionOffsets[direction]:{};
    directionOffsets[direction]={offsetX:clamp(numberOr(row.offsetX,0),-64,64),offsetY:clamp(numberOr(row.offsetY,0),-64,64)};
  }
  return {scale:clamp(numberOr(raw.scale,1),.35,2),offsetX:clamp(numberOr(raw.offsetX,0),-64,64),offsetY:clamp(numberOr(raw.offsetY,0),-64,64),directionOffsets};
}
function developerCharacterRigDirectionOffset(asset,direction){return developerCharacterRigTransform(asset).directionOffsets?.[direction]||{offsetX:0,offsetY:0};}
function developerCharacterBodyEntries(){return Object.entries(devAssets||{}).filter(([,asset])=>asset?.type==="playerBody");}
function developerDefaultCharacterBodyAssetId(){
  const configured=String(devCharacterDefaults?.defaultBodyAsset||"");
  if(devAssets?.[configured]?.type==="playerBody")return configured;
  return developerCharacterBodyEntries()[0]?.[0]||"";
}
function developerCharacterRigReferenceBodyId(asset){
  const configured=String(asset?.rigBodyAsset||"");
  if(devAssets?.[configured]?.type==="playerBody")return configured;
  return developerDefaultCharacterBodyAssetId();
}
function developerCharacterRigImage(assetId,onload){
  const asset=devAssets?.[assetId];if(!asset?.path)return null;
  let image=DEV_CHARACTER_RIG_IMAGE_CACHE.get(assetId);
  if(!image){image=new Image();image.onload=()=>onload?.();image.src=`./${asset.path}`;DEV_CHARACTER_RIG_IMAGE_CACHE.set(assetId,image);}
  return image;
}
function developerCharacterRigDirectionRow(asset,facing){const map=asset?.spriteLayout?.directionRows||{down:0,right:1,left:2,up:3};return clamp(Math.floor(numberOr(map[facing],0)),0,3);}
function developerDrawCharacterRigSheetFrame(c,image,asset,targetCol,targetRow,dx,dy,dw,dh){
  if(!image?.naturalWidth||!image?.naturalHeight)return;
  const facing=DEV_CHARACTER_RIG_DIRECTIONS[targetRow]||"down",sourceRow=developerCharacterRigDirectionRow(asset,facing),frameW=image.naturalWidth/4,frameH=image.naturalHeight/4;
  c.drawImage(image,targetCol*frameW,sourceRow*frameH,frameW,frameH,dx,dy,dw,dh);
}
function developerCharacterRigSelectedDirection(root){const value=String(root?.dataset?.devRigDirection||"all");return value==="all"||DEV_CHARACTER_RIG_DIRECTIONS.includes(value)?value:"all";}
function drawDeveloperCharacterRigPreview(root,asset,assetId){
  const canvas=root?.querySelector?.('#devRigPreview');if(!canvas)return;const c=canvas.getContext('2d');canvas.width=512;canvas.height=512;c.imageSmoothingEnabled=false;
  c.clearRect(0,0,512,512);c.fillStyle='#14111b';c.fillRect(0,0,512,512);
  for(let i=1;i<4;i++){c.strokeStyle='rgba(255,255,255,.08)';c.beginPath();c.moveTo(i*128,0);c.lineTo(i*128,512);c.stroke();c.beginPath();c.moveTo(0,i*128);c.lineTo(512,i*128);c.stroke();}
  const bodyId=asset.type==='playerBody'?assetId:developerCharacterRigReferenceBodyId(asset),body=devAssets?.[bodyId],bodyImage=developerCharacterRigImage(bodyId,()=>drawDeveloperCharacterRigPreview(root,asset,assetId)),layerImage=developerCharacterRigImage(assetId,()=>drawDeveloperCharacterRigPreview(root,asset,assetId));
  if(body&&bodyImage?.naturalWidth){c.globalAlpha=asset.type==='playerBody'?1:.45;for(let row=0;row<4;row++)for(let col=0;col<4;col++)developerDrawCharacterRigSheetFrame(c,bodyImage,body,col,row,col*128,row*128,128,128);c.globalAlpha=1;}
  if(asset.type!=='playerBody'&&layerImage?.naturalWidth){const t=developerCharacterRigTransform(asset),dw=128*t.scale,dh=128*t.scale;for(let row=0;row<4;row++){const facing=DEV_CHARACTER_RIG_DIRECTIONS[row],rowOffset=t.directionOffsets[facing];for(let col=0;col<4;col++){const dx=col*128+(128-dw)/2+t.offsetX+rowOffset.offsetX,dy=row*128+(128-dh)/2+t.offsetY+rowOffset.offsetY;developerDrawCharacterRigSheetFrame(c,layerImage,asset,col,row,dx,dy,dw,dh);}}}
  const selected=developerCharacterRigSelectedDirection(root);if(asset.type!=='playerBody'&&selected!=='all'){const row=DEV_CHARACTER_RIG_DIRECTIONS.indexOf(selected);if(row>=0){c.save();c.fillStyle='rgba(99,230,255,.035)';c.fillRect(0,row*128,512,128);c.strokeStyle='rgba(99,230,255,.78)';c.lineWidth=2;c.strokeRect(1,row*128+1,510,126);c.fillStyle='rgba(25,42,49,.92)';c.fillRect(7,row*128+7,58,19);c.fillStyle='#c8f8ff';c.font='bold 11px sans-serif';c.textBaseline='middle';c.fillText(selected.toUpperCase(),13,row*128+17);c.restore();}}
}
function developerCharacterRigAlignmentHtml(asset,assetId){
  if(!developerCharacterRigAssetType(asset?.type))return '';
  const bodies=developerCharacterBodyEntries(),isBody=asset.type==='playerBody',t=developerCharacterRigTransform(asset),bodyId=isBody?assetId:developerCharacterRigReferenceBodyId(asset);
  if(isBody)return `<div class="devAssetChecks"><div class="devAssetChecksTitle"><b>Canonical Character Rig</b><span class="good">512 × 512</span></div><div class="devHint" style="margin:4px 0 9px">Body layers define the alignment rig for Hair and every independent equipment slot. Full outfits are not character layers. Their exact 4×4 coordinates are preserved on import — no per-frame trimming, centering, or safe-fit scaling.</div><canvas id="devRigPreview" class="devRigPreview" width="512" height="512"></canvas><button id="devRigSetDefaultBody" class="devWideButton primary">${devCharacterDefaults?.defaultBodyAsset===assetId?'Default Modular Body':'Set as Default Modular Body'}</button></div>`;
  const bodyOptions=bodies.map(([id,body])=>`<option value="${devContentEscape(id)}" ${id===bodyId?'selected':''}>${devContentEscape(body.name||id)}</option>`).join('');
  const equipmentSlotControl=asset.type==='playerEquipment'?`<label>Equipment Slot<select id="devRigEquipmentSlot">${DEV_PLAYER_EQUIPMENT_SLOTS.map(([value,label])=>`<option value="${value}" ${value===asset.equipmentSlot?'selected':''}>${label}</option>`).join('')}</select></label>`:'';
  return `<div class="devAssetChecks devRigAlignmentCard"><div class="devAssetChecksTitle devRigTitleBar"><b>Modular Layer Alignment</b><div class="devRigTitleActions"><span class="good">LIVE</span><button type="button" id="devRigExpand" class="devRigExpandButton">⛶ Fullscreen</button><button type="button" id="devRigExit" class="devRigExitButton">Exit Fullscreen</button></div></div><div class="devHint devRigIntro" style="margin:4px 0 9px">Use the global transform to align the whole sheet, then use <b>Direction Fine-Tune</b> when just one directional row is off. Row fine-tuning only nudges X/Y, so all directions keep the same scale and animation proportions.</div><div class="devRigWorkspace"><div class="devRigPreviewPane"><div class="devRigPreviewHeader"><b>Live 4 × 4 Preview</b><span id="devRigDragHint">Drag target: All Rows</span></div><canvas id="devRigPreview" class="devRigPreview devRigPreviewDraggable" width="512" height="512"></canvas><div class="devRigPreviewLegend"><span>Body 45%</span><span>Layer 100%</span></div></div><div class="devRigControls">${equipmentSlotControl}<label>Compatible Body Rig<select id="devRigBody">${bodyOptions||'<option value="">Import a Player Body Layer first</option>'}</select></label><div class="devRigControlBlock"><div class="devRigControlTitle">Global Transform</div><div class="devPair"><label>Layer Scale %<input id="devRigScale" type="number" min="35" max="200" step="1" value="${Math.round(t.scale*100)}"></label><label>Offset X<input id="devRigOffsetX" type="number" min="-64" max="64" step="1" value="${Math.round(t.offsetX)}"></label></div><div class="devPair"><label>Offset Y<input id="devRigOffsetY" type="number" min="-64" max="64" step="1" value="${Math.round(t.offsetY)}"></label><label>Rig Mode<input value="Exact 128 px coordinates" readonly></label></div></div><div class="devRigControlBlock devRigDirectionBlock"><div class="devRigControlTitle">Direction Fine-Tune</div><div class="devRigDirectionHelp">Choose a target. <b>All Rows</b> makes preview dragging adjust the global offset; a direction makes dragging adjust only that row.</div><div class="devRigDirectionTabs" role="group" aria-label="Alignment drag target"><button type="button" class="active" data-rig-direction="all">All Rows</button><button type="button" data-rig-direction="down">Down</button><button type="button" data-rig-direction="right">Right</button><button type="button" data-rig-direction="left">Left</button><button type="button" data-rig-direction="up">Up</button></div><div class="devPair devRigRowOffsetPair"><label>Row Offset X<input id="devRigRowOffsetX" type="number" min="-64" max="64" step="1" value="0" disabled></label><label>Row Offset Y<input id="devRigRowOffsetY" type="number" min="-64" max="64" step="1" value="0" disabled></label></div><div class="devRigFineTuneActions"><button type="button" id="devRigResetRow" disabled>Reset Selected Row</button><button type="button" id="devRigClearRows">Clear All Row Offsets</button></div></div><div class="devRigControlHelp">For your example, choose <b>Right</b> (Row 2) and nudge or drag it until the hair lines up. This correction is also used by the character in-game. Press <b>Esc</b> to leave fullscreen.</div><div class="devRow devRigActions"><button id="devRigReset">Reset Exact Coordinates</button>${asset.type==='playerHair'?'<button id="devRigFitHair">Fit Hair Width</button>':''}</div></div></div></div>`;
}
function developerCharacterRigSetFullscreen(root,asset,assetId,enabled){
  const panel=document.getElementById('devPanel'),card=root?.querySelector?.('.devRigAlignmentCard');if(!panel||!card)return;
  const active=Boolean(enabled);panel.classList.toggle('devRigFullscreenMode',active);card.classList.toggle('devRigFullscreen',active);
  if(DEV_CHARACTER_RIG_FULLSCREEN_KEY_HANDLER){window.removeEventListener('keydown',DEV_CHARACTER_RIG_FULLSCREEN_KEY_HANDLER);DEV_CHARACTER_RIG_FULLSCREEN_KEY_HANDLER=null;}
  if(active){DEV_CHARACTER_RIG_FULLSCREEN_KEY_HANDLER=event=>{if(event.key!=='Escape')return;event.preventDefault();developerCharacterRigSetFullscreen(root,asset,assetId,false);};window.addEventListener('keydown',DEV_CHARACTER_RIG_FULLSCREEN_KEY_HANDLER);}
  requestAnimationFrame(()=>{drawDeveloperCharacterRigPreview(root,asset,assetId);(active?card.querySelector('#devRigExit'):card.querySelector('#devRigExpand'))?.focus?.();});
}
function developerCharacterRigRefreshDirectionControls(root,asset,assetId){
  const selected=developerCharacterRigSelectedDirection(root),rowX=root.querySelector('#devRigRowOffsetX'),rowY=root.querySelector('#devRigRowOffsetY'),resetRow=root.querySelector('#devRigResetRow'),hint=root.querySelector('#devRigDragHint');
  root.querySelectorAll('[data-rig-direction]').forEach(button=>button.classList.toggle('active',button.dataset.rigDirection===selected));
  const rowSelected=selected!=='all',offset=rowSelected?developerCharacterRigDirectionOffset(asset,selected):{offsetX:0,offsetY:0};
  if(rowX){rowX.disabled=!rowSelected;rowX.value=String(Math.round(offset.offsetX));}if(rowY){rowY.disabled=!rowSelected;rowY.value=String(Math.round(offset.offsetY));}if(resetRow)resetRow.disabled=!rowSelected;if(hint)hint.textContent=`Drag target: ${rowSelected?selected[0].toUpperCase()+selected.slice(1):'All Rows'}`;
  drawDeveloperCharacterRigPreview(root,asset,assetId);
}
function developerCharacterRigCommit(asset,assetId,root,{quiet=false}={}){
  const current=developerCharacterRigTransform(asset),scale=clamp(numberOr(root.querySelector('#devRigScale')?.value,100)/100,.35,2),offsetX=clamp(numberOr(root.querySelector('#devRigOffsetX')?.value,0),-64,64),offsetY=clamp(numberOr(root.querySelector('#devRigOffsetY')?.value,0),-64,64),bodyId=String(root.querySelector('#devRigBody')?.value||developerCharacterRigReferenceBodyId(asset)||''),directionOffsets={...current.directionOffsets},selected=developerCharacterRigSelectedDirection(root);
  if(selected!=='all')directionOffsets[selected]={offsetX:clamp(numberOr(root.querySelector('#devRigRowOffsetX')?.value,current.directionOffsets[selected].offsetX),-64,64),offsetY:clamp(numberOr(root.querySelector('#devRigRowOffsetY')?.value,current.directionOffsets[selected].offsetY),-64,64)};
  asset.rigTransform={scale:Number(scale.toFixed(3)),offsetX:Number(offsetX.toFixed(2)),offsetY:Number(offsetY.toFixed(2)),directionOffsets};if(bodyId)asset.rigBodyAsset=bodyId;if(asset.type==='playerEquipment'){const slot=String(root.querySelector('#devRigEquipmentSlot')?.value||asset.equipmentSlot||'chest');asset.equipmentSlot=DEV_PLAYER_EQUIPMENT_SLOTS.some(([value])=>value===slot)?slot:'chest';}asset.rigCoordinatesPreserved=true;
  window.LR_ASSETS=devAssets;window.LR_CHARACTER_DEFAULTS=devCharacterDefaults;if(typeof developerContentLibrary==='function')window.LR_SHARED_CONTENT=developerContentLibrary();saveDeveloperDraft();drawDeveloperCharacterRigPreview(root,asset,assetId);if(!quiet)devSetStatus(`Character layer alignment applied live for ${asset.name||assetId} • Save Project to persist`);
}
function bindDeveloperCharacterRigAlignment(root,asset,assetId){
  if(!root||!developerCharacterRigAssetType(asset?.type))return;
  if(asset.type==='playerBody'){
    root.querySelector('#devRigSetDefaultBody')?.addEventListener('click',()=>{devCharacterDefaults.defaultBodyAsset=assetId;window.LR_CHARACTER_DEFAULTS=devCharacterDefaults;saveDeveloperDraft();refreshDeveloperAssetPanel();devSetStatus(`${asset.name||assetId} is now the default modular body rig`);});drawDeveloperCharacterRigPreview(root,asset,assetId);return;
  }
  root.dataset.devRigDirection='all';
  const scale=root.querySelector('#devRigScale'),x=root.querySelector('#devRigOffsetX'),y=root.querySelector('#devRigOffsetY'),rowX=root.querySelector('#devRigRowOffsetX'),rowY=root.querySelector('#devRigRowOffsetY'),body=root.querySelector('#devRigBody'),equipmentSlot=root.querySelector('#devRigEquipmentSlot');
  root.querySelector('#devRigExpand')?.addEventListener('click',()=>developerCharacterRigSetFullscreen(root,asset,assetId,true));root.querySelector('#devRigExit')?.addEventListener('click',()=>developerCharacterRigSetFullscreen(root,asset,assetId,false));
  [scale,x,y,rowX,rowY].forEach(control=>{control?.addEventListener('input',()=>developerCharacterRigCommit(asset,assetId,root,{quiet:true}));control?.addEventListener('change',()=>developerCharacterRigCommit(asset,assetId,root));});body?.addEventListener('change',()=>developerCharacterRigCommit(asset,assetId,root));equipmentSlot?.addEventListener('change',()=>developerCharacterRigCommit(asset,assetId,root));
  root.querySelectorAll('[data-rig-direction]').forEach(button=>button.addEventListener('click',()=>{root.dataset.devRigDirection=button.dataset.rigDirection||'all';developerCharacterRigRefreshDirectionControls(root,asset,assetId);}));
  root.querySelector('#devRigResetRow')?.addEventListener('click',()=>{const selected=developerCharacterRigSelectedDirection(root);if(selected==='all')return;const t=developerCharacterRigTransform(asset);t.directionOffsets[selected]={offsetX:0,offsetY:0};asset.rigTransform=t;saveDeveloperDraft();developerCharacterRigRefreshDirectionControls(root,asset,assetId);devSetStatus(`Reset ${selected} row alignment for ${asset.name||assetId}`);});
  root.querySelector('#devRigClearRows')?.addEventListener('click',()=>{const t=developerCharacterRigTransform(asset);for(const direction of DEV_CHARACTER_RIG_DIRECTIONS)t.directionOffsets[direction]={offsetX:0,offsetY:0};asset.rigTransform=t;saveDeveloperDraft();developerCharacterRigRefreshDirectionControls(root,asset,assetId);devSetStatus(`Cleared all direction row offsets for ${asset.name||assetId}`);});
  root.querySelector('#devRigReset')?.addEventListener('click',()=>{developerCharacterRigSetFullscreen(root,asset,assetId,false);const directionOffsets={};for(const direction of DEV_CHARACTER_RIG_DIRECTIONS)directionOffsets[direction]={offsetX:0,offsetY:0};asset.rigTransform={scale:1,offsetX:0,offsetY:0,directionOffsets};const bodyId=String(body?.value||developerCharacterRigReferenceBodyId(asset)||'');if(bodyId)asset.rigBodyAsset=bodyId;saveDeveloperDraft();refreshDeveloperAssetPanel();devSetStatus(`Reset ${asset.name||assetId} to exact rig coordinates`);});
  root.querySelector('#devRigFitHair')?.addEventListener('click',()=>{const bodyAsset=devAssets?.[String(body?.value||developerCharacterRigReferenceBodyId(asset)||'')],bw=numberOr(bodyAsset?.analysis?.frameMetrics?.referenceVisibleWidth,0),lw=numberOr(asset?.analysis?.frameMetrics?.referenceVisibleWidth,0);if(!bw||!lw){devSetStatus('Hair/body frame analysis is missing; adjust scale manually');return;}const fitted=clamp((bw*1.12)/lw,.45,1.25);if(scale)scale.value=String(Math.round(fitted*100));developerCharacterRigCommit(asset,assetId,root);});
  const canvas=root.querySelector('#devRigPreview');let drag=null;canvas?.addEventListener('pointerdown',event=>{event.preventDefault();const rect=canvas.getBoundingClientRect(),factor=512/Math.max(1,rect.width),selected=developerCharacterRigSelectedDirection(root),t=developerCharacterRigTransform(asset),start=selected==='all'?{offsetX:t.offsetX,offsetY:t.offsetY}:t.directionOffsets[selected];drag={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,factor,target:selected,startOffsetX:start.offsetX,startOffsetY:start.offsetY};canvas.setPointerCapture?.(event.pointerId);});
  canvas?.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.pointerId)return;const nx=clamp(drag.startOffsetX+(event.clientX-drag.startX)*drag.factor,-64,64),ny=clamp(drag.startOffsetY+(event.clientY-drag.startY)*drag.factor,-64,64),t=developerCharacterRigTransform(asset);if(drag.target==='all'){if(x)x.value=String(Math.round(nx));if(y)y.value=String(Math.round(ny));t.offsetX=nx;t.offsetY=ny;}else{if(rowX)rowX.value=String(Math.round(nx));if(rowY)rowY.value=String(Math.round(ny));t.directionOffsets[drag.target]={offsetX:nx,offsetY:ny};}asset.rigTransform=t;drawDeveloperCharacterRigPreview(root,asset,assetId);});
  const finish=event=>{if(!drag||event.pointerId!==drag.pointerId)return;drag=null;developerCharacterRigCommit(asset,assetId,root);};canvas?.addEventListener('pointerup',finish);canvas?.addEventListener('pointercancel',finish);developerCharacterRigRefreshDirectionControls(root,asset,assetId);
}

function developerValidateCharacterRigHealth(shared,issues){
  const playable=Object.entries(shared.assets||{}).filter(([,asset])=>asset?.type==="playerAppearance");
  const defaultPlayerAsset=String(shared.characterDefaults?.defaultAppearanceAsset||"");
  if(!playable.length)developerHealthIssue(issues,"error","Import at least one Playable Character for the character select screen",{tab:"assets",targetId:""});
  else if(!defaultPlayerAsset||shared.assets?.[defaultPlayerAsset]?.type!=="playerAppearance")developerHealthIssue(issues,"error","Character Defaults needs a valid Playable Character",{tab:"assets",targetId:defaultPlayerAsset});
  for(const [assetId,asset] of playable)if(!asset?.normalizedSheet)developerHealthIssue(issues,"warning",`Playable Character '${assetId}' should use the normalized 4×4 player sheet`,{tab:"assets",targetId:assetId});
  const validEquipmentSlots=new Set(DEV_PLAYER_EQUIPMENT_SLOTS.map(([slot])=>slot));
  for(const [itemId,item] of Object.entries(shared.items||{})){
    const slot=String(item?.equipmentSlot||"");if(!slot)continue;
    if(!validEquipmentSlots.has(slot))developerHealthIssue(issues,"error",`Equipment item '${itemId}' has an invalid equipment slot`,{tab:"content",targetId:itemId});
  }
  for(const [slot,itemIdRaw] of Object.entries(shared.characterDefaults?.starterEquipment||{})){
    const itemId=String(itemIdRaw||"");if(!itemId)continue;const item=shared.items?.[itemId];
    if(!validEquipmentSlots.has(slot))developerHealthIssue(issues,"error",`Starter equipment uses invalid slot '${slot}'`,{tab:"content",targetId:itemId});
    else if(!item)developerHealthIssue(issues,"error",`Starter equipment '${itemId}' does not exist`,{tab:"content",targetId:itemId});
    else if(String(item.equipmentSlot||"")!==slot)developerHealthIssue(issues,"error",`Starter equipment '${itemId}' does not match the '${slot}' slot`,{tab:"content",targetId:itemId});
  }
}

const DEV_ART_REFERENCE_ROLES={
  character:{label:"Character Master",types:["playerAppearance","npcSprite","mobSprite"],help:"Overall humanoid/character proportions, outline weight, shading, and game-scale readability."},
  mob:{label:"Mob Master",types:["mobSprite"],help:"Creature sprite style, animation framing, silhouette, and pixel density."},
  npc:{label:"NPC Master",types:["npcSprite"],help:"Humanoid NPC proportions, clothing detail, framing, and directional consistency."},
  object:{label:"Object Master",types:["worldImage"],help:"Placeable prop silhouette, top-down angle, padding, and rendering style."},
  building:{label:"Building Master",types:["worldImage"],help:"Building perspective, footprint, outline treatment, and environmental scale."},
  terrain:{label:"Terrain Master",types:["terrainTexture","worldImage"],help:"Ground detail density, texture scale, color treatment, and seamless repeat style."},
  item:{label:"Item Master",types:["itemIcon"],help:"Inventory icon framing, readability, shading, and outline treatment."},
  effect:{label:"Effect Master",types:["worldImage"],help:"Transparent effect rendering, contrast, shape language, and game readability."}
};
function developerArtReferenceDefaults(){return {character:"",mob:"",npc:"",object:"",building:"",terrain:"",item:"",effect:""};}
function developerEnsureArtReferences(){devArtReferences={...developerArtReferenceDefaults(),...(devArtReferences||{})};return devArtReferences;}
function developerReferenceRolesForAsset(asset){return Object.entries(DEV_ART_REFERENCE_ROLES).filter(([,rec])=>rec.types.includes(asset?.type)).map(([id,rec])=>[id,rec]);}
function developerPromptReferenceRoles(kind){return ({mob:["mob","character"],npc:["npc","character"],player:["character"],object:["object"],building:["building","object"],terrain:["terrain"],item:["item"],effect:["effect","object"]})[kind]||[];}
function developerPromptReferenceRecords(kind){const refs=developerEnsureArtReferences();return developerPromptReferenceRoles(kind).map(role=>{const id=refs[role],asset=id&&devAssets?.[id];return asset?{role,id,asset,meta:DEV_ART_REFERENCE_ROLES[role]}:null;}).filter(Boolean);}
function developerArtReferencePromptText(kind){const records=developerPromptReferenceRecords(kind);if(!records.length)return "";const lines=records.map(rec=>`- ${rec.meta.label}: ${rec.asset.name||rec.id} (${rec.asset.path})`);return `Reference images to attach:\n${lines.join("\n")}\n\nUse the attached Little Realm reference images as visual anchors. Match their pixel density, top-down perspective, outline weight, shading language, color treatment, proportions, visual scale, and small-screen readability. Preserve the subject requested above rather than copying the reference character/object itself.`;}
function developerArtPromptReferenceCardsHtml(kind){const records=developerPromptReferenceRecords(kind),roles=developerPromptReferenceRoles(kind);if(!roles.length)return "";if(!records.length)return `<div class="devArtReferenceNotice"><b>No master references assigned yet.</b><small>Choose a strong asset and mark it as a Master Reference below. The written art standard still applies until references are chosen.</small></div>`;return `<div class="devArtPromptRefs"><div class="devSectionTitle" style="padding:0 0 5px;font-size:10px">References to attach</div><div class="devRefMiniGrid">${records.map(rec=>`<div class="devRefMini"><img src="./${devContentEscape(rec.asset.path)}" alt=""><span><b>${devContentEscape(rec.meta.label)}</b><small>${devContentEscape(rec.asset.name||rec.id)}</small></span></div>`).join("")}</div><div class="devHint" style="margin-top:6px">Attach these image files with the generated prompt whenever your image generator supports references.</div></div>`;}
function developerSetMasterReference(role,assetId){const meta=DEV_ART_REFERENCE_ROLES[role],asset=devAssets?.[assetId];if(!meta||!asset||!meta.types.includes(asset.type))return;developerEnsureArtReferences()[role]=assetId;saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`${asset.name||assetId} is now ${meta.label}`);}
function developerClearMasterReference(role){const meta=DEV_ART_REFERENCE_ROLES[role];if(!meta)return;developerEnsureArtReferences()[role]="";saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`${meta.label} cleared`);}
function developerArtReferenceLibraryHtml(){const refs=developerEnsureArtReferences();return `<div class="devHint">Choose a small set of gold-standard assets. These references guide future prompts; they do not gate or approve normal project assets.</div><div class="devReferenceGrid">${Object.entries(DEV_ART_REFERENCE_ROLES).map(([role,meta])=>{const currentId=refs[role],current=currentId&&devAssets?.[currentId],options=Object.entries(devAssets||{}).filter(([,asset])=>meta.types.includes(asset.type)).sort((a,b)=>String(a[1]?.name||a[0]).localeCompare(String(b[1]?.name||b[0])));return `<div class="devReferenceCard"><div class="devReferenceHead"><b>${devContentEscape(meta.label)}</b><span>${current?"SET":"EMPTY"}</span></div>${current?`<div class="devReferencePreview"><img src="./${devContentEscape(current.path)}" alt=""><small>${devContentEscape(current.name||currentId)}</small></div>`:`<div class="devReferenceEmpty">No master selected</div>`}<small class="devReferenceHelp">${devContentEscape(meta.help)}</small><select data-ref-select="${role}"><option value="">Choose asset…</option>${options.map(([id,asset])=>`<option value="${devContentEscape(id)}" ${id===currentId?"selected":""}>${devContentEscape(asset.name||id)}</option>`).join("")}</select><div class="devRow"><button data-ref-set="${role}">Set Master</button><button data-ref-clear="${role}" ${current?"":"disabled"}>Clear</button></div></div>`;}).join("")}</div>`;}
function refreshDeveloperArtReferenceLibrary(){developerEnsureArtReferenceStyles();if(!devPanel)return;const root=devPanel.querySelector("#devArtReferenceLibrary");if(!root)return;root.innerHTML=developerArtReferenceLibraryHtml();root.querySelectorAll("[data-ref-set]").forEach(button=>button.onclick=()=>{const role=button.dataset.refSet,select=root.querySelector(`[data-ref-select="${role}"]`);if(select?.value)developerSetMasterReference(role,select.value);else devSetStatus("Choose an asset first");});root.querySelectorAll("[data-ref-clear]").forEach(button=>button.onclick=()=>developerClearMasterReference(button.dataset.refClear));}
function developerAssetMasterControlsHtml(asset,assetId){const roles=developerReferenceRolesForAsset(asset),refs=developerEnsureArtReferences(),masterRoles=Object.entries(refs).filter(([,id])=>id===assetId).map(([role])=>DEV_ART_REFERENCE_ROLES[role]?.label).filter(Boolean);if(!roles.length)return "";return `<div class="devAssetMaster"><div class="devAssetChecksTitle"><b>Master Reference</b><span class="good">OPTIONAL</span></div><label>Reference Role<select id="devAssetMasterRole"><option value="">Choose role…</option>${roles.map(([role,meta])=>`<option value="${role}">${devContentEscape(meta.label)}</option>`).join("")}</select></label><button id="devAssetSetMaster" class="devWideButton">Set As Master Reference</button>${masterRoles.length?`<div class="devHint" style="margin-top:7px">Currently used as: <b>${masterRoles.map(devContentEscape).join(", ")}</b></div>`:""}</div>`;}
function developerReferenceComparisonHtml(asset,assetId){const roles=developerReferenceRolesForAsset(asset).map(([role])=>role),refs=developerEnsureArtReferences(),matches=roles.map(role=>{const id=refs[role],ref=id&&devAssets?.[id];return ref&&id!==assetId?{role,id,asset:ref}:null;}).filter(Boolean);if(!matches.length)return "";return `<div class="devAssetCompare"><div class="devAssetChecksTitle"><b>Reference Comparison</b><span class="good">VISUAL CHECK</span></div><div class="devCompareGrid"><div class="devCompareCard"><small>Selected</small><img src="./${devContentEscape(asset.path)}" alt=""><b>${devContentEscape(asset.name||assetId)}</b></div>${matches.slice(0,2).map(rec=>`<div class="devCompareCard"><small>${devContentEscape(DEV_ART_REFERENCE_ROLES[rec.role].label)}</small><img src="./${devContentEscape(rec.asset.path)}" alt=""><b>${devContentEscape(rec.asset.name||rec.id)}</b></div>`).join("")}</div><div class="devHint" style="margin-top:7px">Compare silhouette, pixel density, outline weight, shading, perspective, and visual detail. The validator handles technical checks; this comparison is for art-direction judgment.</div></div>`;}
function bindDeveloperAssetMasterControls(inspector,asset,assetId){inspector.querySelector("#devAssetSetMaster")?.addEventListener("click",()=>{const role=inspector.querySelector("#devAssetMasterRole")?.value;if(role)developerSetMasterReference(role,assetId);else devSetStatus("Choose a Master Reference role first");});}

function developerEnsureArtReferenceStyles(){if(document.getElementById("lrArtReferenceStyles"))return;const style=document.createElement("style");style.id="lrArtReferenceStyles";style.textContent=`
#devPanel .devArtReferenceNotice{margin:8px 0 10px;padding:9px 10px;background:#211b27;border:1px solid rgba(255,255,255,.09);border-radius:9px}.devArtReferenceNotice b,.devArtReferenceNotice small{display:block}.devArtReferenceNotice small{margin-top:4px;color:#b9aebe;font-size:10px;line-height:1.35}
#devPanel .devArtPromptRefs{margin:9px 0 10px;padding:9px;background:#1b1720;border:1px solid rgba(99,230,255,.16);border-radius:9px}.devRefMiniGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.devRefMini{display:grid;grid-template-columns:46px minmax(0,1fr);gap:7px;align-items:center;background:#211b27;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:5px}.devRefMini img{width:46px;height:46px;object-fit:contain;image-rendering:pixelated;background:#151219;border-radius:5px}.devRefMini b,.devRefMini small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.devRefMini b{font-size:9px;color:#8beeff}.devRefMini small{font-size:9px;color:#cfc4d3;margin-top:2px}
#devPanel .devReferenceGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}.devReferenceCard{background:#211b27;border:1px solid rgba(255,255,255,.08);border-radius:9px;padding:8px;min-width:0}.devReferenceHead{display:flex;justify-content:space-between;align-items:center;gap:6px}.devReferenceHead b{font-size:10px;color:#f3ebf8}.devReferenceHead span{font-size:8px;font-weight:900;color:#8beeff}.devReferencePreview{height:88px;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:7px 0;background:#17131b;border-radius:7px;overflow:hidden}.devReferencePreview img{max-height:64px;max-width:100%;object-fit:contain;image-rendering:pixelated}.devReferencePreview small{font-size:8px;color:#b9aebe;margin-top:3px}.devReferenceEmpty{height:70px;display:flex;align-items:center;justify-content:center;margin:7px 0;background:#17131b;border-radius:7px;color:#776c7d;font-size:9px}.devReferenceHelp{display:block;min-height:38px;color:#a99bb3;font-size:9px;line-height:1.3;margin-bottom:5px}.devReferenceCard select{width:100%}
#devPanel .devAssetMaster,#devPanel .devAssetCompare{margin:10px 0 12px;padding:10px;background:#1b1720;border:1px solid rgba(255,255,255,.09);border-radius:9px}#devPanel .devCompareGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.devCompareCard{background:#17131b;border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:6px;text-align:center;min-width:0}.devCompareCard img{width:100%;height:92px;object-fit:contain;image-rendering:pixelated}.devCompareCard small,.devCompareCard b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.devCompareCard small{font-size:8px;color:#8beeff;margin-bottom:3px}.devCompareCard b{font-size:9px;color:#dcd2e1;margin-top:3px}
@media(max-width:760px){#devPanel .devReferenceGrid{grid-template-columns:1fr}.devRefMiniGrid{grid-template-columns:1fr}#devPanel .devCompareGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;document.head.appendChild(style);}

function developerAssetAssignOptions(type){if(type==="mobSprite")return Object.entries(BALANCE.mobs||{}).map(([id,rec])=>[id,rec?.name||id]);if(type==="npcSprite")return sceneryNPCs.map(npc=>[npc.id,npc.name||npc.id]);if(type==="itemIcon")return Object.entries(ITEM_DEFS).map(([id,rec])=>[id,rec?.name||id]);return [];}

function assignDeveloperAsset(asset,targetId){
  if(!asset||!targetId)return;const assetId=devAssetSelectedId;
  if(asset.type==="mobSprite"&&BALANCE.mobs?.[targetId]){BALANCE.mobs[targetId].spriteAsset=assetId;refreshMobTemplatesFromBalance?.();syncDeveloperSpawnRuntime?.();devContentType="mobs";devContentSelectedId=targetId;}
  else if(asset.type==="npcSprite"){const npc=sceneryNPCs.find(n=>n.id===targetId);if(!npc||!developerApplyNpcSpriteAsset(npc,assetId))return;devSelectedNpc=npc;setDeveloperTab("npcs");}
  else if(asset.type==="itemIcon"&&ITEM_DEFS[targetId]){ITEM_DEFS[targetId].icon=asset.path;devContentType="items";devContentSelectedId=targetId;refreshInventoryViews?.();}else return;
  saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`${asset.name||asset.path} assigned to ${targetId}`);
}

function developerAssetReferences(assetId){
  const refs=[];if(devCharacterDefaults?.defaultAppearanceAsset===assetId)refs.push("default playable character");for(const [id,mob] of Object.entries(BALANCE.mobs||{}))if(mob?.spriteAsset===assetId)refs.push(`mob ${id}`);for(const npc of sceneryNPCs)if(developerNpcAssetId(npc)===assetId)refs.push(`NPC ${npc.id}`);for(const [id,t] of Object.entries(devObjectDefinitions||{}))if(t?.sourceAssetId===assetId)refs.push(`object ${id}`);for(const [id,t] of Object.entries(devTerrains||{})){if(t?.textureAsset===assetId)refs.push(`terrain ${id}`);if(t?.decoration?.treeAsset===assetId)refs.push(`terrain trees ${id}`);}for(const [role,id] of Object.entries(devArtReferences||{}))if(id===assetId)refs.push(`${DEV_ART_REFERENCE_ROLES?.[role]?.label||role} reference`);return refs;
}

function removeDeveloperAssetRecord(){const asset=devAssets[devAssetSelectedId];if(!asset)return;const refs=developerAssetReferences(devAssetSelectedId);if(refs.length){devSetStatus(`Asset is still used by ${refs.join(", ")}`);return;}if(!confirm(`Remove '${asset.name||devAssetSelectedId}' from the Asset Library? The image file will stay in the project.`))return;delete devAssets[devAssetSelectedId];devAssetSelectedId=null;saveDeveloperDraft();refreshDeveloperPanel();}

function copyDeveloperAssetPath(){const asset=devAssets[devAssetSelectedId];if(!asset)return;navigator.clipboard?.writeText(asset.path).then(()=>devSetStatus(`Copied ${asset.path}`)).catch(()=>devSetStatus(asset.path));}

function developerObjectDefinition(id){
  return devObjectDefinitions?.[id]||null;
}

function developerObjectPlaceType(id){
  return `object:${id}`;
}

function developerObjectDefinitionIdFromPlaceType(type){
  const raw=String(type||"");
  return raw.startsWith("object:")?raw.slice(7):null;
}

function developerDefaultObjectSizeFromAsset(asset){
  const sourceW=Math.max(1,numberOr(asset?.width,96));
  const sourceH=Math.max(1,numberOr(asset?.height,96));
  const maxDim=180;
  const scale=Math.min(1,maxDim/Math.max(sourceW,sourceH));
  return {w:Math.max(24,Math.round(sourceW*scale)),h:Math.max(24,Math.round(sourceH*scale))};
}

function developerUniqueObjectDefinitionId(base){
  const root=devContentId(base,"world-object");let id=root,n=2;
  while(Object.prototype.hasOwnProperty.call(devObjectDefinitions,id))id=`${root}-${n++}`;
  return id;
}

function createDeveloperObjectDefinitionFromAsset(asset,assetId=devAssetSelectedId,{silent=false}={}){
  if(!asset||asset.type!=="worldImage"){if(!silent)devSetStatus("Choose a World Image asset first");return null;}
  const id=developerUniqueObjectDefinitionId(asset.name||"world-object"),size=developerDefaultObjectSizeFromAsset(asset);
  devObjectDefinitions[id]={name:asset.name||id,sourceAssetId:assetId||"",w:size.w,h:size.h,solid:false,depthMode:"ysort",depthY:size.h};window.LR_OBJECT_DEFINITIONS=devObjectDefinitions;
  if(silent)return id;devPlaceType=developerObjectPlaceType(id);devPlaceNpcAsset=null;devPlaceMobType=null;devSelected=null;devSelectedNpc=null;devSelectedMob=null;saveDeveloperDraft();setDeveloperTab("objects");refreshDeveloperPanel();updateDevPaletteActive();devSetStatus(`${asset.name||id} is now in the Object Library — click the world to place it`);return id;
}

function removeDeveloperObjectDefinition(id){
  const definition=developerObjectDefinition(id);if(!definition)return;
  const refs=sceneryProps.filter(obj=>obj.objectId===id).length;
  if(refs){devSetStatus(`${definition.name||id} is used by ${refs} placed object${refs===1?"":"s"}; delete those instances first`);return;}
  if(!confirm(`Remove '${definition.name||id}' from the shared Object Library? Its image asset will stay in the project.`))return;
  delete devObjectDefinitions[id];
  window.LR_OBJECT_DEFINITIONS=devObjectDefinitions;
  if(devPlaceType===developerObjectPlaceType(id))devPlaceType=null;
  saveDeveloperDraft();refreshDeveloperPanel();updateDevPaletteActive();
}

function developerDrawObjectDefinitionThumb(canvas,id){
  const definition=developerObjectDefinition(id);if(!canvas||!definition)return;
  const c=canvas.getContext("2d");c.clearRect(0,0,56,56);c.imageSmoothingEnabled=false;
  const asset=devAssets?.[definition.sourceAssetId],path=asset?.path||definition.sprite||"";
  if(!path)return;
  const image=new Image();image.onload=()=>{
    c.clearRect(0,0,56,56);c.imageSmoothingEnabled=false;
    const crop=definition.crop&&typeof definition.crop==="object"?definition.crop:null;
    const sx=crop?numberOr(crop.x,0):0,sy=crop?numberOr(crop.y,0):0,sw=crop?Math.max(1,numberOr(crop.w,image.naturalWidth)):image.naturalWidth,sh=crop?Math.max(1,numberOr(crop.h,image.naturalHeight)):image.naturalHeight;
    const scale=Math.min(52/sw,52/sh),dw=Math.max(1,Math.round(sw*scale)),dh=Math.max(1,Math.round(sh*scale));
    c.drawImage(image,sx,sy,sw,sh,Math.round((56-dw)/2),Math.round((56-dh)/2),dw,dh);
  };
  image.src=/^(?:data:|blob:|https?:|\.\/|\/)/.test(path)?path:`./${path}`;
}

function refreshDeveloperObjectPalette(){
  if(!devPanel)return;
  const palette=devPanel.querySelector("#devObjectPalette");
  const count=devPanel.querySelector("#devObjectLibraryCount");
  if(!palette)return;
  const query=String(devPanel.querySelector("#devObjectSearch")?.value||"").trim().toLowerCase();
  const entries=Object.entries(devObjectDefinitions||{}).filter(([id,def])=>!query||`${def?.name||""} ${id}`.toLowerCase().includes(query)).sort((a,b)=>String(a[1]?.name||a[0]).localeCompare(String(b[1]?.name||b[0])));
  if(count)count.textContent=`${entries.length} reusable`;
  palette.innerHTML="";
  if(!entries.length){palette.innerHTML='<div class="devEmpty">No placeable objects yet. Import a World Image in Assets, then choose <b>Create Placeable Object</b>.</div>';return;}
  for(const [id,definition] of entries){
    const card=document.createElement("div");card.className=`devCustomObjectCard ${devPlaceType===developerObjectPlaceType(id)?"active":""}`;card.dataset.objectDefinition=id;
    const place=document.createElement("button");place.className="devCustomObjectPlace";place.dataset.objectPlace=id;place.title=`Place ${definition.name||id}`;
    const cv=document.createElement("canvas");cv.width=56;cv.height=56;
    const text=document.createElement("span"),name=document.createElement("b"),meta=document.createElement("small");
    name.textContent=definition.name||id;meta.textContent=`${Math.round(numberOr(definition.w,64))} × ${Math.round(numberOr(definition.h,64))}`;text.append(name,meta);place.append(cv,text);
    const remove=document.createElement("button");remove.className="devCustomObjectRemove";remove.dataset.objectRemove=id;remove.title="Remove object definition";remove.textContent="×";
    card.append(place,remove);palette.appendChild(card);developerDrawObjectDefinitionThumb(cv,id);
  }
  palette.querySelectorAll("[data-object-place]").forEach(button=>button.onclick=()=>{
    const id=button.dataset.objectPlace;
    devPlaceType=developerObjectPlaceType(id);devPlaceNpcAsset=null;devPlaceMobType=null;devSelected=null;devSelectedNpc=null;devSelectedMob=null;
    updateDevPaletteActive();refreshDeveloperObjectPalette();devSetStatus(`Placing ${developerObjectDefinition(id)?.name||id} — click the world${devRepeatPlacement?" repeatedly":" once"}`);
  });
  palette.querySelectorAll("[data-object-remove]").forEach(button=>button.onclick=e=>{e.stopPropagation();removeDeveloperObjectDefinition(button.dataset.objectRemove);});
}

function ensureDeveloperStyles(){
  if(document.getElementById("littleRealmDevStyles")) return;
  const style=document.createElement("style");
  style.id="littleRealmDevStyles";
  style.textContent=`
    #devPanel{position:fixed!important;z-index:10000!important;top:12px!important;right:12px!important;width:min(880px,68vw)!important;height:min(860px,calc(100vh - 24px))!important;background:rgba(24,20,30,.98)!important;border:1px solid rgba(255,255,255,.22)!important;border-radius:16px!important;box-shadow:0 18px 50px rgba(0,0,0,.55)!important;color:#f8f2ff!important;display:none!important;overflow:hidden!important;font:13px system-ui,sans-serif!important;backdrop-filter:blur(8px)!important}
    #devPanel.show{display:flex!important;flex-direction:column!important}
    #devPanel *{box-sizing:border-box}
    #devPanel .devHeader{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#453552;border-bottom:1px solid rgba(255,255,255,.12)}
    #devPanel .devHeader b{display:block;font-size:15px;letter-spacing:.08em} #devPanel .devHeader span{display:block;font-size:11px;color:#cdbed9;margin-top:2px}
    #devPanel button,#devPanel select,#devPanel input{font:inherit}
    #devPanel .devHeader button{width:36px;height:36px;border:0;border-radius:9px;background:#2a2132;color:white;font-size:22px}
    #devPanel .devToolbar{display:flex;gap:9px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.1)}
    #devPanel .devToolbar button,#devPanel .devToolbar select,#devPanel .devProjectActions button,#devPanel .devRow button,#devPanel .devMobTypeChip{border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:8px;padding:8px 10px;font-weight:700}
    #devPanel .devToolbar button.active,#devPanel .devPropButton.active,#devPanel .devTab.active,#devPanel .devMobTypeChip.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel .devToolbar label{display:flex;gap:5px;align-items:center;color:#e5d9ec}
    #devPanel .devTabs{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.1);background:#211a28}
    #devPanel .devTab{border:1px solid rgba(255,255,255,.12);background:#30283a;color:#d9cfdf;border-radius:9px;padding:9px 10px;font-weight:800;cursor:pointer}

    #devPanel .devContextBar{display:flex;align-items:center;gap:8px;padding:7px 12px;background:#18141d;border-bottom:1px solid rgba(255,255,255,.1)}
    #devPanel .devToolMode{flex:1;min-width:0;border:1px solid rgba(255,255,255,.1);background:#2a2331;border-radius:8px;padding:7px 9px;font-size:11px;font-weight:900;letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#d8cfe0}
    #devPanel .devToolMode.place{background:#493f24;border-color:#8d7837;color:#ffe8a2} #devPanel .devToolMode.paint{background:#25474d;border-color:#4d8893;color:#bdf5ff} #devPanel .devToolMode.edit{background:#473254;border-color:#77518d;color:#f0cfff}
    #devPanel .devRepeatPlacement{display:flex;align-items:center;gap:5px;color:#d5c9dc;font-size:11px;white-space:nowrap;user-select:none} #devPanel .devRepeatPlacement input{accent-color:#63e6ff}
    #devPanel #devFinishTool{border:1px solid rgba(255,255,255,.14);background:#4f405c;color:#fff;border-radius:8px;padding:7px 9px;font-weight:850;white-space:nowrap}
    #devPanel .devSectionNav{display:flex;gap:5px;overflow-x:auto;padding:6px 12px;background:#201a26;border-bottom:1px solid rgba(255,255,255,.08);scrollbar-width:thin}
    #devPanel .devSectionJump{flex:0 0 auto;border:1px solid rgba(255,255,255,.1);background:#2d2635;color:#cfc3d6;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:800;cursor:pointer}
    #devPanel .devSectionJump:hover{background:#3d3248;color:#fff}
    #devPanel .devBody{flex:1;min-height:0;overflow:auto;padding:12px;scroll-behavior:smooth}
    #devPanel .devView{display:none}#devPanel .devView.active{display:block}
    #devPanel .devSection{background:#241e2b;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px;margin-bottom:12px}
    #devPanel .devSectionTitle{padding:0 2px 8px;font-weight:900;color:#d8c1e7;letter-spacing:.06em;text-transform:uppercase;font-size:12px}
    #devPanel .devHint{color:#b9aebe;font-size:11px;margin:-2px 2px 9px;line-height:1.35}
    #devPanel #devObjectPalette{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:7px!important;max-height:360px!important;overflow:auto!important;padding:2px!important}
    #devPanel .devPropButton{min-width:0;border:1px solid rgba(255,255,255,.12);background:#30283a;color:#eee;border-radius:9px;padding:5px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;min-height:76px}
    #devPanel .devPropButton canvas{width:52px;height:52px;image-rendering:pixelated;background:rgba(255,255,255,.025);border-radius:5px}
    #devPanel .devPropButton span{font-size:10px;line-height:1.05;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:capitalize}
    #devPanel #devObjectList,#devPanel #devSelectionList{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;max-height:260px;overflow:auto}
    #devPanel .devObjectChip{border:1px solid rgba(255,255,255,.12);background:#2e2736;color:#e9dff0;border-radius:8px;padding:7px 9px;font-size:11px;cursor:pointer;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #devPanel .devObjectChip.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel #devScalePanel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
    #devPanel .devScaleControl{background:#2b2432;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px;color:#ddd}
    #devPanel .devScaleControl .devScaleTop{display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:800;margin-bottom:7px}
    #devPanel .devScaleControl input[type=range]{width:100%;accent-color:#63e6ff}
    #devPanel #devMobScalePanel{background:#2b2432;border:1px solid rgba(99,230,255,.18);border-radius:12px;padding:12px;min-height:130px}
    #devPanel .devMobSelectedTitle{font-size:18px;font-weight:900;color:#7ceaff;margin-bottom:3px}.devMobMeta{color:#bdb0c5;font-size:11px;margin-bottom:11px}
    #devPanel #devMobTypeChips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.devMobTypeChip{font-size:10px!important;padding:6px 8px!important;cursor:pointer}
    #devPanel #devInspector{padding:2px;min-height:180px}
    #devPanel .devEmpty{color:#baaec2;padding:12px;background:#2b2432;border-radius:9px}.devSelectedTitle{font-size:16px;font-weight:900;margin-bottom:9px;color:#7ceaff;text-transform:capitalize}
    #devPanel #devInspector label{display:flex;flex-direction:column;gap:4px;margin:7px 0;color:#d7cbdc}
    #devPanel #devInspector input[type=text],#devPanel #devInspector input[type=number],#devPanel #devInspector input:not([type]),#devPanel #devInspector select{width:100%;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:7px;padding:8px}
    #devPanel .devChecks{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px} #devPanel .devChecks label{flex-direction:row!important;align-items:center!important;background:#2b2432;padding:8px;border-radius:7px}
    #devPanel .devPair{display:grid;grid-template-columns:1fr 1fr;gap:9px} #devPanel .devQuad{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
    #devPanel .devSubhead{font-weight:800;margin-top:10px;color:#c9b9d2} #devPanel .devRow{display:flex;gap:7px;margin-top:10px} #devPanel .devRow button{flex:1} #devPanel .devRow .danger{background:#713b47}
    #devPanel .devHitboxEditButton{width:100%;margin-top:8px;border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:8px;padding:9px 10px;font-weight:900;cursor:pointer}
    #devPanel .devHitboxEditButton.active{outline:2px solid #ffd166;background:#66532b;color:#fff8dd}
    #devPanel .devHitboxEditHelp{margin-top:7px;padding:8px 9px;border:1px solid rgba(255,209,102,.18);border-radius:8px;background:rgba(255,209,102,.06);color:#d8cdbc;font-size:10px;line-height:1.35}
    #devPanel .devDepthEditButton{width:100%;margin-top:8px;border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:8px;padding:9px 10px;font-weight:900;cursor:pointer}
    #devPanel .devDepthEditButton.active{outline:2px solid #d58cff;background:#59406a;color:#fff4ff}
    #devPanel .devDepthEditButton:disabled{opacity:.42;cursor:not-allowed}
    #devPanel .devDepthEditHelp{margin-top:7px;padding:8px 9px;border:1px solid rgba(213,140,255,.20);border-radius:8px;background:rgba(213,140,255,.07);color:#d8cdbc;font-size:10px;line-height:1.35}
    #devPanel .devProjectActions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px} #devPanel .devProjectActions button:first-child{grid-column:1/-1;background:#38606a}
    #devPanel #devStatus{padding:9px 12px;background:#1d1822;color:#bdb0c5;font-size:11px;border-top:1px solid rgba(255,255,255,.08)}

    #devPanel .devCombatGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    #devPanel .devCombatField{display:flex;flex-direction:column;gap:4px;color:#d7cbdc;font-size:11px;font-weight:700}
    #devPanel .devCombatField input,#devPanel .devCombatField select{width:100%;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:7px;padding:8px}
    #devPanel .devCombatCheck{display:flex;align-items:center;gap:7px;background:#2b2432;border-radius:8px;padding:9px;color:#ddd;font-weight:700}
    #devPanel .devCombatActions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.devCombatActions button{border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:8px;padding:8px 10px;font-weight:800;cursor:pointer}.devCombatActions .primary{background:#38606a}.devCombatActions .danger{background:#713b47}
    #devPanel .devCombatDetails{background:#211b27;border:1px solid rgba(255,255,255,.08);border-radius:10px;margin:8px 0;overflow:hidden}.devCombatDetails summary{cursor:pointer;padding:10px 11px;font-weight:900;color:#d8c1e7;user-select:none}.devCombatDetails>div{padding:0 10px 10px}
    #devPanel .devPlayerTest{display:grid;grid-template-columns:minmax(110px,160px) 1fr;gap:10px;align-items:end}.devQuickLevels{display:flex;gap:5px;flex-wrap:wrap}.devQuickLevels button{border:1px solid rgba(255,255,255,.12);background:#30283a;color:#fff;border-radius:7px;padding:7px 9px;font-weight:800}
    #devPanel .devStatPreview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:9px}.devStatPreview div{background:#2b2432;border-radius:8px;padding:8px;text-align:center}.devStatPreview b{display:block;color:#7ceaff;font-size:14px}.devStatPreview span{font-size:9px;color:#a99bb3;text-transform:uppercase;letter-spacing:.05em}
    #devPanel .devNpcPalette{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.devNpcPalette button{border:1px solid rgba(255,255,255,.12);background:#30283a;color:#fff;border-radius:9px;padding:9px;font-weight:850;cursor:pointer}.devNpcPalette button.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel #devNpcList,#devPanel #devQuestList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;max-height:230px;overflow:auto}.devNpcChip,.devQuestChip{border:1px solid rgba(255,255,255,.12);background:#2e2736;color:#e9dff0;border-radius:8px;padding:7px 9px;font-size:11px;cursor:pointer;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.devNpcChip.active,.devQuestChip.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel .devNpcInspector label,#devPanel .devQuestEditor label{display:flex;flex-direction:column;gap:4px;margin:7px 0;color:#d7cbdc;font-size:11px;font-weight:700}.devNpcInspector input,.devNpcInspector select,.devNpcInspector textarea,.devQuestEditor input,.devQuestEditor select,.devQuestEditor textarea{width:100%;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:7px;padding:8px;font:inherit}.devNpcInspector textarea,.devQuestEditor textarea{min-height:62px;resize:vertical}
    #devPanel .devQuestObjective{margin-top:8px;padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#2a2331}.devQuestObjectiveTop{display:grid;grid-template-columns:1fr 1.35fr .55fr auto;gap:6px;align-items:end}.devQuestObjectiveTop button{height:34px;border:1px solid rgba(255,255,255,.12);background:#713b47;color:#fff;border-radius:7px;font-weight:900}.devVisitGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.devQuestListActions{display:flex;gap:7px;margin-top:8px}.devQuestListActions button{flex:1;border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:8px;padding:8px;font-weight:800}
    #devPanel .devProjectBig{display:grid;grid-template-columns:1fr 1fr;gap:8px}.devProjectBig button{border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:9px;padding:10px;font-weight:850}.devProjectBig .primary{grid-column:1/-1;background:#38606a}.devProjectBig .danger{background:#713b47}.devProjectNote{padding:9px;border:1px solid rgba(99,230,255,.14);border-radius:9px;background:rgba(99,230,255,.05);color:#cbd9dd;font-size:10px;line-height:1.4}
    #devPanel #devZoneList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-height:260px;overflow:auto}.devZoneChip{border:1px solid rgba(255,255,255,.12);background:#2e2736;color:#e9dff0;border-radius:9px;padding:9px 10px;cursor:pointer;text-align:left;min-width:0}.devZoneChip b,.devZoneChip span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.devZoneChip span{font-size:9px;color:#a99bb3;margin-top:3px}.devZoneChip.active{outline:2px solid #63e6ff;background:#385a64}.devZoneBadges{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.devZoneBadges span{background:#30283a;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:5px 8px;color:#bfcbd0;font-size:9px;font-weight:800}.devView[data-dev-view="zones"] label{display:flex;flex-direction:column;gap:4px;margin:7px 0;color:#d7cbdc;font-size:11px;font-weight:700}.devView[data-dev-view="zones"] input,.devView[data-dev-view="zones"] select{width:100%;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:7px;padding:8px;font:inherit}.devView[data-dev-view="zones"] input[readonly],.devView[data-dev-view="zones"] input:disabled{opacity:.62}
    #devPanel #devTerrainPalette{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.devTerrainType{display:grid;grid-template-columns:18px minmax(0,1fr);column-gap:7px;align-items:center;border:1px solid rgba(255,255,255,.12);background:#30283a;color:#fff;border-radius:9px;padding:8px;text-align:left;cursor:pointer;min-width:0}.devTerrainType.active{outline:2px solid #63e6ff;background:#385a64}.devTerrainSwatch{grid-row:1/3;width:18px;height:36px;border-radius:5px;border:1px solid rgba(255,255,255,.22)}.devTerrainType b,.devTerrainType small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.devTerrainType small{font-size:9px;color:#a99bb3}.devView[data-dev-view="terrain"] label{display:flex;flex-direction:column;gap:4px;margin:7px 0;color:#d7cbdc;font-size:11px;font-weight:700}.devView[data-dev-view="terrain"] input,.devView[data-dev-view="terrain"] select{width:100%;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:7px;padding:8px;font:inherit}.devView[data-dev-view="terrain"] input[readonly]{opacity:.62}
    #devPanel .devContentTypes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.devContentTypes button,.devContentActions button,.devWideButton{border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:8px;padding:8px 10px;font-weight:800;cursor:pointer}.devContentTypes button.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel #devContentList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;max-height:250px;overflow:auto}.devContentChip{border:1px solid rgba(255,255,255,.12);background:#2e2736;color:#e9dff0;border-radius:8px;padding:8px 9px;cursor:pointer;text-align:left;min-width:0}.devContentChip b,.devContentChip span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.devContentChip span{font-size:9px;color:#a99bb3;margin-top:2px}.devContentChip.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel .devContentForm label{display:flex;flex-direction:column;gap:4px;margin:7px 0;color:#d7cbdc;font-size:11px;font-weight:700}.devContentForm input,.devContentForm select,.devContentForm textarea{width:100%;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:7px;padding:8px;font:inherit}.devContentForm textarea{min-height:62px;resize:vertical}.devContentForm .devInlineCheck{flex-direction:row;align-items:center;background:#2b2432;padding:8px;border-radius:7px}.devContentForm .devInlineCheck input{width:auto}.devContentActions{display:flex;gap:7px;margin-top:9px}.devContentActions button{flex:1}.devContentActions .primary{background:#38606a}.devContentActions .danger{background:#713b47}.devWideButton{width:100%;margin-top:8px}
    #devPanel .devLootHeader{display:grid;grid-template-columns:1.5fr .7fr .55fr .55fr 1.15fr;gap:5px;color:#a99bb3;font-size:9px;text-transform:uppercase;margin:6px 0 3px}.devLootEntry{display:grid;grid-template-columns:1.5fr .7fr .55fr .55fr .7fr .7fr auto;gap:5px;align-items:center;margin:5px 0}.devLootEntry input,.devLootEntry select{min-width:0;padding:6px}.devLootEntry label{margin:0!important;display:flex!important;flex-direction:row!important;align-items:center!important;gap:3px!important;font-size:9px!important}.devLootEntry label input{width:auto}.devLootEntry button{border:1px solid rgba(255,255,255,.12);background:#713b47;color:white;border-radius:7px;height:31px;font-weight:900}
    #devPanel #devSpawnPalette{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.devSpawnType{border:1px solid rgba(255,255,255,.12);background:#30283a;color:#fff;border-radius:9px;padding:9px;cursor:pointer;text-align:left}.devSpawnType b,.devSpawnType span{display:block}.devSpawnType span{font-size:9px;color:#a99bb3;margin-top:2px}.devSpawnType.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel #devSpawnList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;max-height:250px;overflow:auto}.devSpawnChip{border:1px solid rgba(255,255,255,.12);background:#2e2736;color:#e9dff0;border-radius:8px;padding:8px 9px;cursor:pointer;text-align:left;min-width:0}.devSpawnChip b,.devSpawnChip span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.devSpawnChip span{font-size:9px;color:#a99bb3;margin-top:2px}.devSpawnChip.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel #devSpawnInspector label,#devPanel #devAssetInspector label,#devPanel [data-dev-view="assets"]>.devSection label{display:flex;flex-direction:column;gap:4px;margin:7px 0;color:#d7cbdc;font-size:11px;font-weight:700}#devPanel #devSpawnInspector input,#devPanel #devSpawnInspector select,#devPanel #devAssetInspector input,#devPanel #devAssetInspector select,#devPanel [data-dev-view="assets"]>.devSection select{width:100%;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:7px;padding:8px;font:inherit}
    
    #devPanel #devAssetList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-height:330px;overflow:auto}.devAssetChip{display:grid;grid-template-columns:54px minmax(0,1fr);gap:8px;align-items:center;border:1px solid rgba(255,255,255,.12);background:#2e2736;color:#e9dff0;border-radius:9px;padding:6px;cursor:pointer;text-align:left;min-width:0}.devAssetChip.active{outline:2px solid #63e6ff;background:#385a64}.devAssetChip img{width:54px;height:54px;object-fit:contain;image-rendering:pixelated;background:rgba(0,0,0,.22);border-radius:6px}.devAssetChip b,.devAssetChip small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.devAssetChip small{font-size:9px;color:#a99bb3;margin-top:3px}.devAssetPreview{height:180px;display:flex;align-items:center;justify-content:center;background:#18141d;border:1px solid rgba(255,255,255,.08);border-radius:10px;overflow:hidden;margin-bottom:10px}.devAssetPreview img{max-width:100%;max-height:100%;object-fit:contain;image-rendering:pixelated}.devAssetMeta{font-size:10px;color:#a99bb3;margin:-5px 0 8px}.devWideButton.primary{background:#38606a!important}
    #devPanel .devArtGuideGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:8px 0 10px}.devArtGuideCard{background:#211b27;border:1px solid rgba(255,255,255,.08);border-radius:9px;padding:8px 9px}.devArtGuideCard b{display:block;color:#f3ebf8;font-size:10px;letter-spacing:.04em;text-transform:uppercase;margin-bottom:4px}.devArtGuideCard small{display:block;color:#b9aebe;font-size:10px;line-height:1.35}.devArtPromptLayout{display:grid;grid-template-columns:1.1fr .9fr;gap:10px}.devArtPromptTextarea,#devPanel .devPromptOutput{width:100%;min-height:84px;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:7px;padding:8px;font:inherit;resize:vertical}.devPromptOutput{min-height:320px;line-height:1.4}.devPromptActions{display:flex;gap:7px;margin-top:10px}.devPromptActions button{flex:1;border:1px solid rgba(255,255,255,.12);background:#5a4869;color:#fff;border-radius:8px;padding:8px 10px;font-weight:800}.devPromptActions .primary{background:#38606a}.devArtPromptOutputWrap{display:flex;flex-direction:column}.devArtPromptForm{min-width:0}
    #devPanel #devObjectPalette{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.devCustomObjectCard{position:relative;border:1px solid rgba(255,255,255,.12);background:#2e2736;border-radius:9px;overflow:hidden}.devCustomObjectCard.active{outline:2px solid #63e6ff;background:#385a64}.devCustomObjectPlace{display:grid;grid-template-columns:56px minmax(0,1fr);gap:8px;align-items:center;width:100%;min-width:0;border:0;background:transparent;color:#fff;padding:6px 28px 6px 6px;text-align:left;cursor:pointer}.devCustomObjectPlace img,.devCustomObjectPlace canvas{width:56px;height:56px;object-fit:contain;image-rendering:pixelated;background:rgba(0,0,0,.22);border-radius:6px}.devCustomObjectPlace b,.devCustomObjectPlace small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.devCustomObjectPlace small{font-size:9px;color:#a99bb3;margin-top:3px}.devCustomObjectRemove{position:absolute;right:5px;top:5px;width:22px;height:22px;border:1px solid rgba(255,255,255,.14);border-radius:6px;background:#713b47;color:#fff;font-weight:900;cursor:pointer}
    #devPanel .devHealthTop{display:flex;justify-content:space-between;gap:8px;align-items:center;margin:10px 0}.devHealthBadge,.devDirtyBadge{border-radius:999px;padding:6px 9px;font-size:10px;font-weight:900;letter-spacing:.03em}.devHealthBadge.healthy{background:rgba(113,200,115,.14);color:#9ff0a1;border:1px solid rgba(113,200,115,.32)}.devHealthBadge.warning,.devHealthBadge.stale{background:rgba(255,209,102,.12);color:#ffe29a;border:1px solid rgba(255,209,102,.28)}.devHealthBadge.error{background:rgba(219,103,118,.14);color:#ffafb9;border:1px solid rgba(219,103,118,.32)}.devHealthBadge.unknown,.devHealthBadge.checking{background:rgba(99,230,255,.10);color:#9cecff;border:1px solid rgba(99,230,255,.22)}.devDirtyBadge.dirty{background:rgba(255,209,102,.10);color:#ffe29a}.devDirtyBadge.clean{background:rgba(113,200,115,.08);color:#a4d9a6}.devHealthGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:9px 0}.devHealthGrid div{background:#2b2432;border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:8px;min-width:0}.devHealthGrid span,.devHealthGrid b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.devHealthGrid span{font-size:8px;color:#a99bb3;text-transform:uppercase;letter-spacing:.06em}.devHealthGrid b{margin-top:2px;color:#f4eef7;font-size:11px}.devHealthActions button:disabled{opacity:.45;cursor:not-allowed}.devHealthIssueList{display:grid;gap:6px;margin-top:9px;max-height:280px;overflow:auto}.devHealthIssue{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:7px;align-items:center;padding:8px;border-radius:8px;background:#2a2331;border:1px solid rgba(255,255,255,.07);font-size:10px;line-height:1.3}.devHealthIssue.error{border-color:rgba(219,103,118,.28)}.devHealthIssue.warning{border-color:rgba(255,209,102,.24)}.devHealthIcon{width:22px;height:22px;display:grid;place-items:center;border-radius:50%;font-weight:1000}.devHealthIssue.error .devHealthIcon{background:#713b47;color:#fff}.devHealthIssue.warning .devHealthIcon{background:#66532b;color:#fff8dd}.devHealthIssue button{border:1px solid rgba(255,255,255,.12);background:#4b4056;color:#fff;border-radius:7px;padding:5px 7px;font-weight:800}.devHealthClean{padding:10px;border-radius:8px;background:rgba(113,200,115,.08);color:#a8e2aa;border:1px solid rgba(113,200,115,.18);font-size:11px}
    body.devMode #pcControls{opacity:.25}
    @media (max-width:1050px){#devPanel{width:min(760px,78vw)!important}#devPanel .devTabs{grid-template-columns:repeat(4,1fr)}}
    @media (max-width:760px){#devPanel{top:6px!important;right:6px!important;width:calc(100vw - 12px)!important;height:calc(100vh - 12px)!important}#devPanel .devTabs{grid-template-columns:repeat(3,1fr)}#devPanel .devRepeatPlacement span{display:none}}
    @media(max-width:1100px){#devPanel{width:min(650px,68vw)!important}#devPanel #devObjectPalette{grid-template-columns:repeat(5,minmax(0,1fr))!important}}
    @media(max-width:760px){#devPanel .devContentTypes{grid-template-columns:repeat(2,1fr)}#devPanel .devArtGuideGrid{grid-template-columns:1fr}.devArtPromptLayout{grid-template-columns:1fr}#devPanel .devLootHeader{display:none}#devPanel .devLootEntry{grid-template-columns:1fr 1fr 1fr}#devPanel .devLootEntry select{grid-column:1/-1}#devPanel .devTabs{grid-template-columns:repeat(2,1fr)}#devPanel .devCombatGrid{grid-template-columns:repeat(2,minmax(0,1fr))}#devPanel .devStatPreview{grid-template-columns:repeat(2,minmax(0,1fr))}#devPanel{width:calc(100vw - 12px)!important;right:6px!important;top:6px!important;height:calc(100vh - 12px)!important}#devPanel #devObjectPalette{grid-template-columns:repeat(4,minmax(0,1fr))!important}#devPanel #devObjectList,#devPanel #devSelectionList{grid-template-columns:repeat(2,minmax(0,1fr))}#devPanel #devScalePanel{grid-template-columns:1fr}.devQuad{grid-template-columns:repeat(2,1fr)!important}}
  `;
  document.head.appendChild(style);
}


// Little Realm asset-pipeline validation cards.
const LR_ASSET_PIPELINE_STYLES = `
#devPanel .devAssetChecks{margin:10px 0 12px;padding:10px;background:#1b1720;border:1px solid rgba(255,255,255,.09);border-radius:9px}
#devPanel .devAssetChecksTitle{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;color:#eee5f3;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
#devPanel .devAssetChecksTitle span{padding:3px 6px;border-radius:999px;font-size:9px;font-weight:800}
#devPanel .devAssetChecksTitle span.good{background:rgba(86,199,128,.16);color:#8ee4ad;border:1px solid rgba(86,199,128,.28)}
#devPanel .devAssetChecksTitle span.warn{background:rgba(255,190,83,.14);color:#ffd27b;border:1px solid rgba(255,190,83,.28)}
#devPanel .devAssetCheck{display:grid;grid-template-columns:18px minmax(0,1fr);gap:1px 7px;align-items:center;padding:5px 0;border-top:1px solid rgba(255,255,255,.05);font-size:10px}
#devPanel .devAssetCheck>span{grid-row:1/3;width:16px;height:16px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-weight:900}
#devPanel .devAssetCheck>b{color:#e7deeb}.devAssetCheck small{color:#a99bb3;font-size:9px}
#devPanel .devAssetCheck.good>span{background:rgba(86,199,128,.16);color:#8ee4ad}.devAssetCheck.warn>span{background:rgba(255,190,83,.14);color:#ffd27b}.devAssetCheck.info>span{background:rgba(99,230,255,.13);color:#8beeff}
`;
if(!document.getElementById("lrAssetPipelineStyles")){const style=document.createElement("style");style.id="lrAssetPipelineStyles";style.textContent=LR_ASSET_PIPELINE_STYLES;document.head.appendChild(style);}

// v77.4 modular character rig alignment workspace with fullscreen + per-direction row fine-tuning.
if(!document.getElementById("lrCharacterRigStyles")){const style=document.createElement("style");style.id="lrCharacterRigStyles";style.textContent=`
#devPanel .devRigAlignmentCard{padding:12px}
#devPanel .devRigTitleBar{align-items:center}
#devPanel .devRigTitleActions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}
#devPanel .devRigExpandButton,#devPanel .devRigExitButton{border:1px solid rgba(99,230,255,.25);background:#31505a;color:#eaffff;border-radius:7px;padding:5px 8px;font-size:9px;font-weight:900;letter-spacing:.02em;cursor:pointer}
#devPanel .devRigExpandButton:hover,#devPanel .devRigExitButton:hover{background:#3d6570;border-color:rgba(99,230,255,.48)}
#devPanel .devRigExitButton{display:none;background:#5a4869;border-color:rgba(255,255,255,.18)}
#devPanel .devRigWorkspace{display:grid;grid-template-columns:minmax(220px,1.1fr) minmax(190px,.9fr);gap:12px;align-items:start}
#devPanel .devRigPreviewPane{position:sticky;top:0;z-index:2;min-width:0;padding:9px;background:#17131d;border:1px solid rgba(99,230,255,.14);border-radius:11px;box-shadow:0 8px 22px rgba(0,0,0,.18)}
#devPanel .devRigPreviewHeader{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 1px 7px;color:#eee5f3;font-size:10px}
#devPanel .devRigPreviewHeader b{font-size:10px;text-transform:uppercase;letter-spacing:.045em}#devPanel .devRigPreviewHeader span{color:#9edfea;font-size:9px;white-space:nowrap}
#devPanel .devRigPreview{display:block;width:100%;max-width:460px;height:auto;aspect-ratio:1/1;margin:0 auto;background:#14111b;border:1px solid rgba(255,255,255,.11);border-radius:9px;image-rendering:pixelated}
#devPanel .devRigPreviewDraggable{cursor:grab;touch-action:none}#devPanel .devRigPreviewDraggable:active{cursor:grabbing}
#devPanel .devRigPreviewLegend{display:flex;justify-content:space-between;gap:8px;margin:6px 2px 0;color:#8f8498;font-size:8px;text-transform:uppercase;letter-spacing:.04em}
#devPanel .devRigControls{min-width:0;padding:2px 0}
#devPanel .devRigControlBlock{margin-top:9px;padding:8px;background:#211b27;border:1px solid rgba(255,255,255,.07);border-radius:9px}
#devPanel .devRigControlTitle{color:#d8c1e7;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}
#devPanel .devRigDirectionBlock{border-color:rgba(99,230,255,.15);background:linear-gradient(180deg,rgba(49,80,90,.18),#211b27 32%)}
#devPanel .devRigDirectionHelp{margin:4px 0 7px;color:#a99eaf;font-size:8px;line-height:1.35}
#devPanel .devRigDirectionTabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;margin:6px 0 8px}
#devPanel .devRigDirectionTabs button{min-width:0;padding:6px 2px;border:1px solid rgba(255,255,255,.09);border-radius:6px;background:#17131d;color:#a99eaf;font-size:8px;font-weight:800;cursor:pointer}
#devPanel .devRigDirectionTabs button:hover{border-color:rgba(99,230,255,.3);color:#dffbff}
#devPanel .devRigDirectionTabs button.active{background:#31505a;border-color:rgba(99,230,255,.48);color:#eaffff;box-shadow:inset 0 0 0 1px rgba(99,230,255,.08)}
#devPanel .devRigRowOffsetPair input:disabled{opacity:.45;cursor:not-allowed}
#devPanel .devRigFineTuneActions{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px}
#devPanel .devRigFineTuneActions button{padding:6px 5px;font-size:8px;line-height:1.2}
#devPanel .devRigFineTuneActions button:disabled{opacity:.42;cursor:not-allowed}
#devPanel .devRigControlHelp{margin-top:9px;padding:8px 9px;background:rgba(99,230,255,.055);border:1px solid rgba(99,230,255,.13);border-radius:8px;color:#b9aebe;font-size:9px;line-height:1.35}
#devPanel .devRigActions{flex-direction:column}#devPanel .devRigActions button{width:100%}

#devPanel.devRigFullscreenMode{top:0!important;right:0!important;bottom:0!important;left:0!important;width:100vw!important;height:100vh!important;max-width:none!important;border:0!important;border-radius:0!important}
#devPanel.devRigFullscreenMode .assetsLayout .devDetailPane>.devSection{max-height:none!important;overflow:visible!important}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen{position:absolute;inset:0;z-index:500;margin:0;padding:18px 22px 22px;border:0;border-radius:0;background:#121017;display:grid;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigExpandButton{display:none}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigExitButton{display:inline-flex;align-items:center;justify-content:center;padding:7px 11px;font-size:10px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigTitleBar{margin:0 0 2px;font-size:13px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigTitleBar>b{font-size:14px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigIntro{font-size:11px;margin:2px 0 12px!important}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigWorkspace{min-height:0;height:100%;grid-template-columns:minmax(0,1fr) clamp(320px,26vw,410px);gap:18px;align-items:stretch}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigPreviewPane{position:relative;top:auto;display:flex;flex-direction:column;justify-content:center;min-height:0;padding:12px 14px;border-color:rgba(99,230,255,.24);box-shadow:0 12px 36px rgba(0,0,0,.32)}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigPreviewHeader{font-size:11px;margin-bottom:8px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigPreviewHeader b{font-size:11px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigPreviewHeader span{font-size:10px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigPreview{width:auto;height:auto;max-width:min(100%,calc(100vh - 145px));max-height:calc(100vh - 145px);aspect-ratio:1/1;flex:0 1 auto}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigPreviewLegend{font-size:9px;margin-top:8px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControls{align-self:center;width:100%;max-height:100%;overflow:auto;padding:2px 4px 2px 0}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControls label{font-size:12px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControls input,#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControls select{padding:10px;font-size:12px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControlBlock{padding:11px;margin-top:12px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControlTitle{font-size:10px;margin-bottom:6px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigDirectionHelp{font-size:9px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigDirectionTabs{gap:5px;margin:8px 0 10px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigDirectionTabs button{padding:8px 3px;font-size:9px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigFineTuneActions button{padding:8px 5px;font-size:9px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControlHelp{font-size:10px;padding:10px;margin-top:12px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigActions{margin-top:12px}
#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigActions button{padding:10px}
@media(max-width:720px){#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen{padding:12px}#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigWorkspace{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto;gap:10px}#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigPreview{max-width:min(100%,calc(100vh - 390px));max-height:calc(100vh - 390px)}#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControls{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:start}#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControlBlock{margin-top:0}#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigControlHelp{margin-top:0}#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigActions{grid-column:1/-1;flex-direction:row;margin-top:0}}
@media(max-width:520px){#devPanel .devRigWorkspace{grid-template-columns:1fr}#devPanel .devRigPreviewPane{top:-2px}#devPanel .devRigPreview{width:min(100%,280px)}#devPanel .devRigControls{padding-top:2px}#devPanel .devRigActions{flex-direction:row}#devPanel .devRigTitleActions{width:100%;justify-content:space-between}#devPanel .devRigDirectionTabs{grid-template-columns:repeat(3,1fr)}#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigIntro{display:none}#devPanel.devRigFullscreenMode .devRigAlignmentCard.devRigFullscreen .devRigPreview{max-width:min(100%,calc(100vh - 370px));max-height:calc(100vh - 370px)}}
`;document.head.appendChild(style);}

const DEV_UI_PREFS_KEY="littleRealmBuilderUiV746";
function developerUiPrefs(){try{return JSON.parse(localStorage.getItem(DEV_UI_PREFS_KEY)||"{}")||{};}catch{return {};}}
function developerSaveUiPrefs(prefs){try{localStorage.setItem(DEV_UI_PREFS_KEY,JSON.stringify(prefs||{}));}catch{}}
function developerSectionKey(section){const view=section.closest(".devView")?.dataset?.devView||"builder",title=section.querySelector(":scope > .devSectionTitle"),label=(title?.childNodes?.[0]?.textContent||title?.textContent||"section").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");return `${view}:${label}`;}
function developerSetSectionCollapsed(section,collapsed,{save=true}={}){if(!section)return;section.classList.toggle("collapsed",!!collapsed);const button=section.querySelector(":scope > .devSectionTitle .devCollapseToggle");if(button){button.textContent=collapsed?"▸":"▾";button.setAttribute("aria-expanded",collapsed?"false":"true");}if(save){const prefs=developerUiPrefs(),collapsedMap={...(prefs.collapsed||{})};collapsedMap[developerSectionKey(section)]=!!collapsed;prefs.collapsed=collapsedMap;developerSaveUiPrefs(prefs);}}
function developerInitCollapsibleSections(root=devPanel){if(!root)return;const prefs=developerUiPrefs(),saved=prefs.collapsed||{};root.querySelectorAll(".devSection").forEach(section=>{const title=section.querySelector(":scope > .devSectionTitle");if(!title||title.querySelector(".devCollapseToggle"))return;const key=developerSectionKey(section),fallback=section.dataset.defaultCollapsed==="true",collapsed=Object.prototype.hasOwnProperty.call(saved,key)?!!saved[key]:fallback;const button=document.createElement("button");button.type="button";button.className="devCollapseToggle";button.title="Collapse / expand section";button.onclick=event=>{event.stopPropagation();developerSetSectionCollapsed(section,!section.classList.contains("collapsed"));};title.appendChild(button);title.classList.add("collapsible");title.onclick=event=>{if(event.target.closest("button,input,select,a"))return;developerSetSectionCollapsed(section,!section.classList.contains("collapsed"));};developerSetSectionCollapsed(section,collapsed,{save:false});});}
function developerInitPanelResize(root=devPanel){if(!root||root.querySelector(".devResizeHandle"))return;const prefs=developerUiPrefs(),saved=Number(prefs.panelWidth);if(Number.isFinite(saved)&&saved>420)root.style.setProperty("width",`${Math.min(saved,Math.max(460,window.innerWidth-24))}px`,"important");const handle=document.createElement("div");handle.className="devResizeHandle";handle.title="Drag to resize World Builder";root.appendChild(handle);let startX=0,startW=0;const move=event=>{const max=Math.max(460,window.innerWidth-24),next=Math.max(460,Math.min(max,startW+(startX-event.clientX)));root.style.setProperty("width",`${next}px`,"important");};const up=()=>{window.removeEventListener("pointermove",move,true);window.removeEventListener("pointerup",up,true);const prefsNow=developerUiPrefs();prefsNow.panelWidth=Math.round(root.getBoundingClientRect().width);developerSaveUiPrefs(prefsNow);};handle.addEventListener("pointerdown",event=>{event.preventDefault();startX=event.clientX;startW=root.getBoundingClientRect().width;window.addEventListener("pointermove",move,true);window.addEventListener("pointerup",up,true);});}
function developerInitWorkflowUi(root=devPanel){developerEnsureWorkflowStyles();developerInitCollapsibleSections(root);developerInitPanelResize(root);}
function developerBindSearchInput(selector,refresh){const input=devPanel?.querySelector(selector);if(!input||input.dataset.searchBound)return;input.dataset.searchBound="1";input.addEventListener("input",()=>refresh?.());}
function developerEnsureWorkflowStyles(){if(document.getElementById("lrWorkflowUiStyles"))return;const style=document.createElement("style");style.id="lrWorkflowUiStyles";style.textContent=`
#devPanel .devSectionTitle.collapsible{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none}#devPanel .devSectionTitle.collapsible>.devTitleCount{margin-left:auto}#devPanel .devCollapseToggle{margin-left:auto!important;flex:0 0 auto;border:0!important;background:transparent!important;color:#bca8c8!important;padding:0 3px!important;font-size:15px!important;line-height:1!important;cursor:pointer}#devPanel .devSection.collapsed{padding-bottom:7px}#devPanel .devSection.collapsed>:not(.devSectionTitle){display:none!important}
#devPanel .devSearchInput{width:100%;background:#18141d;color:#fff;border:1px solid #594b62;border-radius:8px;padding:8px 10px;margin:0 0 8px;font:inherit}#devPanel .devSearchInput:focus{outline:2px solid rgba(99,230,255,.5);border-color:#63e6ff}
#devPanel .devMasterDetail{display:grid;grid-template-columns:minmax(260px,.9fr) minmax(320px,1.1fr);gap:10px;align-items:start}#devPanel .devMasterPane,#devPanel .devDetailPane{min-width:0}#devPanel .devMasterDetail>.devMasterPane>.devSection,#devPanel .devMasterDetail>.devDetailPane>.devSection{margin-bottom:10px}#devPanel .assetsLayout #devAssetList{grid-template-columns:1fr;max-height:480px}#devPanel .assetsLayout .devDetailPane>.devSection{max-height:610px;overflow:auto}#devPanel .terrainLayout .devDetailPane>.devSection:first-child{max-height:610px;overflow:auto}#devPanel .terrainLayout #devTerrainPalette{max-height:360px;overflow:auto}
#devPanel .devImportBar{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:9px;align-items:end}#devPanel .devImportBar label{display:flex;flex-direction:column;gap:4px;color:#d7cbdc;font-size:11px;font-weight:700}#devPanel .devImportBar select{width:100%;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:7px;padding:8px}#devPanel .devImportBar button{border:1px solid rgba(255,255,255,.14);background:#38606a;color:#fff;border-radius:8px;padding:9px 13px;font-weight:900;white-space:nowrap}.devImportResult{margin-top:9px;padding:9px 10px;border:1px solid rgba(86,199,128,.25);background:rgba(86,199,128,.08);border-radius:9px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 10px;align-items:center}.devImportResult.warn{border-color:rgba(255,190,83,.28);background:rgba(255,190,83,.07)}.devImportResult b,.devImportResult span{display:block}.devImportResult span{font-size:10px;color:#b9aebe}.devImportResult>div{grid-column:2;grid-row:1/3;display:flex;gap:6px}.devImportResult button{border:1px solid rgba(255,255,255,.12);background:#4f405c;color:#fff;border-radius:7px;padding:6px 8px;font-size:10px;font-weight:800}

#devPanel .devCameraBar{display:grid;grid-template-columns:auto minmax(130px,1fr);gap:7px 10px;align-items:center;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.08);background:#18141d}#devPanel .devCameraModes,#devPanel .devCameraActions{display:flex;gap:5px;flex-wrap:wrap}#devPanel .devCameraModes button,#devPanel .devCameraActions button{border:1px solid rgba(255,255,255,.12);background:#2a2230;color:#ddd;border-radius:7px;padding:6px 8px;font-size:10px;font-weight:800}#devPanel .devCameraModes button.active{background:#315e69;border-color:#63e6ff;color:#fff}#devPanel .devCameraActions{grid-column:1/3}.devCameraReadout{justify-self:end;color:#8beeff;font-size:10px;font-weight:900;letter-spacing:.06em}.devCameraActions button.primary{background:#3c6a55!important;color:#fff!important}.devCameraActions button:disabled{opacity:.4;cursor:not-allowed}
#devPanel .audioLayout #devAudioList{max-height:440px;overflow:auto;display:grid;gap:6px}#devPanel .devAudioCard{width:100%;display:grid;grid-template-columns:30px minmax(0,1fr) 30px;gap:8px;align-items:center;text-align:left;background:#2b2331;color:#fff;border:1px solid #4c4055;border-radius:9px;padding:7px 8px}#devPanel .devAudioCard.active{background:#315e69;border-color:#63e6ff}#devPanel .devAudioCard b,#devPanel .devAudioCard small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#devPanel .devAudioCard small{color:#ae9fb5;font-size:9px;margin-top:2px}#devPanel .devAudioIcon{font-size:18px;text-align:center;color:#8beeff}#devPanel .devAudioCardPlay{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.09)}#devPanel #devAudioSetList{display:grid;gap:6px;margin-top:8px;max-height:300px;overflow:auto}#devPanel .devAudioSetCard{display:flex;justify-content:space-between;gap:8px;align-items:center;text-align:left;background:#2b2331;color:#fff;border:1px solid #4c4055;border-radius:8px;padding:8px}#devPanel .devAudioSetCard.active{background:#315e69;border-color:#63e6ff}#devPanel .devAudioSetCard small{color:#ae9fb5}#devPanel .devAudioSetClips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin:8px 0;max-height:320px;overflow:auto}#devPanel .devAudioClipCheck{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:6px;background:#211b26;border:1px solid #44384c;border-radius:7px;padding:6px}#devPanel .devAudioClipCheck button{padding:3px 6px}#devPanel .devAudioEventRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:end;margin-bottom:6px}#devPanel .devAudioEventRow label{display:flex;flex-direction:column;gap:3px}#devPanel .devAudioEventRow select{width:100%}
#devPanel .devResizeHandle{position:absolute;z-index:20;left:-3px;top:58px;bottom:18px;width:8px;cursor:ew-resize}#devPanel .devResizeHandle:hover:after{content:"";position:absolute;left:3px;top:0;bottom:0;width:2px;background:#63e6ff;border-radius:2px}
#devPanel .devHealthIssue.advisory{border-color:rgba(99,230,255,.18);opacity:.86}#devPanel .devHealthIssue.advisory .devHealthIcon{background:rgba(99,230,255,.13);color:#8beeff}
@media(max-width:900px){#devPanel .devMasterDetail{grid-template-columns:1fr}#devPanel .devResizeHandle{display:none}#devPanel .assetsLayout .devDetailPane>.devSection,#devPanel .terrainLayout .devDetailPane>.devSection:first-child{max-height:none;overflow:visible}.devImportResult{grid-template-columns:1fr}.devImportResult>div{grid-column:1;grid-row:auto}}
`;document.head.appendChild(style);}

const DEV_CAMERA_PREFS_KEY="littleRealmBuilderCameraV75";
const DEV_CAMERA_MIN_ZOOM=.12;
const DEV_CAMERA_MAX_ZOOM=4;

function developerCameraZoneId(){return String(devProjectZone?.id||state?.zoneId||"default");}
function developerCameraPrefs(){try{return JSON.parse(localStorage.getItem(DEV_CAMERA_PREFS_KEY)||"{}")||{};}catch{return {};}}
function developerSaveCameraPrefs(prefs){try{localStorage.setItem(DEV_CAMERA_PREFS_KEY,JSON.stringify(prefs||{}));}catch{}}
function developerCameraAvailableWidth(){
  const full=Math.max(320,Number(innerWidth)||1280);
  if(!devModeActive||!devPanel?.classList?.contains("show"))return full;
  const panelWidth=Math.max(0,numberOr(devPanel.getBoundingClientRect?.().width,0));
  return Math.max(260,full-panelWidth-12);
}
function developerWorldCenter(){return {x:WORLD_W*TILE/2,y:WORLD_H*TILE/2};}
function developerWorldFitZoom(){
  const pad=28,availableW=developerCameraAvailableWidth(),availableH=Math.max(240,Number(innerHeight)||720);
  const worldW=Math.max(TILE,WORLD_W*TILE),worldH=Math.max(TILE,WORLD_H*TILE);
  return clamp(Math.min((availableW-pad*2)/worldW,(availableH-pad*2)/worldH),DEV_CAMERA_MIN_ZOOM,CAMERA_ZOOM);
}
function developerEnsureFreeCamera(){
  if(!Number.isFinite(Number(devCameraX)))devCameraX=numberOr(state?.x,START_X);
  if(!Number.isFinite(Number(devCameraY)))devCameraY=numberOr(state?.y,START_Y);
  if(!Number.isFinite(Number(devCameraZoom)))devCameraZoom=CAMERA_ZOOM;
  devCameraZoom=clamp(devCameraZoom,DEV_CAMERA_MIN_ZOOM,DEV_CAMERA_MAX_ZOOM);
}
function developerCameraFrame(vw=innerWidth,vh=innerHeight){
  const fullW=Math.max(1,numberOr(vw,innerWidth||1)),fullH=Math.max(1,numberOr(vh,innerHeight||1));
  if(!devModeActive||devCameraMode==="player"){
    const zoom=CAMERA_ZOOM,viewW=fullW/zoom,viewH=fullH/zoom;
    // Builder UI is constructed before reset() initializes player state. Use the
    // zone start during that brief bootstrap phase so camera controls cannot stop startup.
    const playerX=numberOr(state?.x,START_X),playerY=numberOr(state?.y,START_Y);
    return {mode:"player",zoom,viewW,viewH,camX:playerX-viewW/2,camY:playerY-viewH/2,centerX:playerX,centerY:playerY};
  }
  developerEnsureFreeCamera();
  let zoom=devCameraZoom;
  if(devCameraMode==="world"){
    const center=developerWorldCenter();devCameraX=center.x;devCameraY=center.y;zoom=developerWorldFitZoom();devCameraZoom=zoom;
  }
  const viewW=fullW/zoom,viewH=fullH/zoom,availableW=developerCameraAvailableWidth();
  // Keep the camera focal point centered in the visible workspace, not underneath the Builder panel.
  const camX=devCameraX-(availableW/zoom)/2;
  const camY=devCameraY-viewH/2;
  return {mode:devCameraMode,zoom,viewW,viewH,camX,camY,centerX:devCameraX,centerY:devCameraY,availableW};
}
function developerCameraZoomValue(){return developerCameraFrame(innerWidth,innerHeight).zoom;}
function developerCameraLocksPlayerMovement(){return devModeActive&&devCameraMode!=="player";}
function developerClearCameraKeys(){devCameraKeys={up:false,down:false,left:false,right:false};}
function developerPersistCameraForZone(){
  developerEnsureFreeCamera();
  const prefs=developerCameraPrefs(),zones={...(prefs.zones||{})};
  zones[developerCameraZoneId()]={mode:devCameraMode,x:devCameraX,y:devCameraY,zoom:devCameraZoom};prefs.zones=zones;developerSaveCameraPrefs(prefs);
}
function developerRestoreCameraForZone(){
  const rec=developerCameraPrefs()?.zones?.[developerCameraZoneId()];
  if(rec&&["player","free","world"].includes(rec.mode)){
    devCameraMode=rec.mode;devCameraX=numberOr(rec.x,state?.x);devCameraY=numberOr(rec.y,state?.y);devCameraZoom=clamp(numberOr(rec.zoom,CAMERA_ZOOM),DEV_CAMERA_MIN_ZOOM,DEV_CAMERA_MAX_ZOOM);
  }else{devCameraMode="player";devCameraX=state?.x;devCameraY=state?.y;devCameraZoom=CAMERA_ZOOM;}
  developerClearCameraKeys();developerRefreshCameraUi();
}
function setDeveloperCameraMode(mode,{quiet=false}={}){
  mode=["player","free","world"].includes(mode)?mode:"player";
  if(mode==="free"&&devCameraMode==="player"){devCameraX=state.x;devCameraY=state.y;devCameraZoom=CAMERA_ZOOM;}
  if(mode==="world"){const c=developerWorldCenter();devCameraX=c.x;devCameraY=c.y;devCameraZoom=developerWorldFitZoom();}
  devCameraMode=mode;developerClearCameraKeys();developerPersistCameraForZone();developerRefreshCameraUi();
  if(!quiet){
    if(mode==="player")devSetStatus("Player Camera — camera follows the character; F2 playtesting behaves normally");
    else if(mode==="free")devSetStatus("Free Camera — WASD / arrows pan • mouse wheel zooms • middle-drag pans");
    else devSetStatus("World View — entire zone fitted overhead; terrain painting remains active");
  }
}
function developerFitWorldCamera(){setDeveloperCameraMode("world");}
function developerCenterCameraOnPlayer(){
  if(devCameraMode==="player"){developerRefreshCameraUi();devSetStatus("Camera is already following the player");return;}
  devCameraMode="free";devCameraX=state.x;devCameraY=state.y;developerPersistCameraForZone();developerRefreshCameraUi();devSetStatus("Free Camera centered on player");
}
function developerSelectionWorldPoint(){
  if(devSelected){const b=developerEntityBounds(devSelected);return {x:b.x+b.w/2,y:b.y+b.h/2,label:devSelected.label||"object"};}
  if(devSelectedNpc)return {x:devSelectedNpc.x,y:devSelectedNpc.y,label:devSelectedNpc.name||"NPC"};
  if(devSelectedMob)return {x:devSelectedMob.x,y:devSelectedMob.y,label:mobDisplayName(devSelectedMob)||"mob"};
  if(devSelectedSpawnId){const spawn=developerSpawnById?.(devSelectedSpawnId);if(spawn)return {x:spawn.x,y:spawn.y,label:"spawn"};}
  if(devSelectedRemnant&&devRemnantPreview)return {x:devRemnantPreview.x,y:devRemnantPreview.y,label:"remnant preview"};
  return null;
}
function developerCenterCameraOnSelection(){
  const point=developerSelectionWorldPoint();if(!point){devSetStatus("Select an object, NPC, mob, or spawn first");return;}
  devCameraMode="free";devCameraX=point.x;devCameraY=point.y;developerEnsureFreeCamera();developerPersistCameraForZone();developerRefreshCameraUi();devSetStatus(`Free Camera centered on ${point.label}`);
}
function developerNearestWalkableCameraPoint(x,y){
  const minX=HERO_RADIUS+1,maxX=WORLD_W*TILE-HERO_RADIUS-1,minY=HERO_RADIUS+1,maxY=WORLD_H*TILE-HERO_RADIUS-1;
  const tx=clamp(numberOr(x,state.x),minX,maxX),ty=clamp(numberOr(y,state.y),minY,maxY);
  if(canStand(tx,ty))return {x:tx,y:ty};
  const step=16;
  for(let radius=step;radius<=TILE*5;radius+=step){
    const samples=Math.max(8,Math.ceil(Math.PI*2*radius/step));
    for(let i=0;i<samples;i++){const a=i/samples*Math.PI*2,cx=clamp(tx+Math.cos(a)*radius,minX,maxX),cy=clamp(ty+Math.sin(a)*radius,minY,maxY);if(canStand(cx,cy))return {x:cx,y:cy};}
  }
  return null;
}
function developerMovePlayerToCamera(){
  if(devCameraMode==="player"){devSetStatus("Player is already at the current camera point");return;}
  developerEnsureFreeCamera();const target=developerNearestWalkableCameraPoint(devCameraX,devCameraY);
  if(!target){devSetStatus("Could not find walkable ground near the camera center");return;}
  if(typeof disengageCombat==="function"&&combatTarget)disengageCombat(false);if(typeof clearSelectedTarget==="function")clearSelectedTarget();
  input={up:false,down:false,left:false,right:false};isHeroMoving=false;state.x=target.x;state.y=target.y;lastSafePos={x:state.x,y:state.y};
  if(typeof updateQuestVisits==="function")updateQuestVisits();if(typeof updateUI==="function")updateUI();
  devSetStatus(`Player moved to camera • ${Math.round(state.x)}, ${Math.round(state.y)} • press F2 to test here`);developerRefreshCameraUi();
}
function developerCameraZoomBy(factor){
  if(devCameraMode==="player"){devSetStatus("Switch to Free Camera or World View to zoom independently");return;}
  if(devCameraMode==="world"){const frame=developerCameraFrame(innerWidth,innerHeight);devCameraMode="free";devCameraX=frame.centerX;devCameraY=frame.centerY;devCameraZoom=frame.zoom;}
  devCameraZoom=clamp(devCameraZoom*factor,DEV_CAMERA_MIN_ZOOM,DEV_CAMERA_MAX_ZOOM);developerPersistCameraForZone();developerRefreshCameraUi();
}
function updateDeveloperCamera(dt){
  if(!devModeActive||devCameraMode==="player")return;
  const dx=(devCameraKeys.right?1:0)-(devCameraKeys.left?1:0),dy=(devCameraKeys.down?1:0)-(devCameraKeys.up?1:0);if(!dx&&!dy)return;
  if(devCameraMode==="world"){const frame=developerCameraFrame(innerWidth,innerHeight);devCameraMode="free";devCameraX=frame.centerX;devCameraY=frame.centerY;devCameraZoom=frame.zoom;}
  const len=Math.max(1,Math.hypot(dx,dy)),speed=520/Math.max(.2,devCameraZoom);devCameraX+=dx/len*speed*dt;devCameraY+=dy/len*speed*dt;developerPersistCameraForZone();developerRefreshCameraUi();
}
function developerCameraKeyDirection(code){if(code==="KeyW"||code==="ArrowUp")return "up";if(code==="KeyS"||code==="ArrowDown")return "down";if(code==="KeyA"||code==="ArrowLeft")return "left";if(code==="KeyD"||code==="ArrowRight")return "right";return "";}
function developerHandleCameraKeyDown(event){
  if(!devModeActive||devCameraMode==="player"||isEditableKeyTarget(event.target))return false;const dir=developerCameraKeyDirection(event.code);if(!dir)return false;event.preventDefault();event.stopImmediatePropagation();devCameraKeys[dir]=true;return true;
}
function developerHandleCameraKeyUp(event){
  if(!devModeActive)return false;const dir=developerCameraKeyDirection(event.code);if(!dir)return false;devCameraKeys[dir]=false;if(devCameraMode!=="player"){developerPersistCameraForZone();event.preventDefault();event.stopImmediatePropagation();return true;}return false;
}
function developerBeginCameraPan(event){
  if(!devModeActive||devCameraMode==="player"||event.button!==1)return false;
  if(devCameraMode==="world"){const frame=developerCameraFrame(innerWidth,innerHeight);devCameraMode="free";devCameraX=frame.centerX;devCameraY=frame.centerY;devCameraZoom=frame.zoom;}
  developerEnsureFreeCamera();devCameraPanDrag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,cameraX:devCameraX,cameraY:devCameraY,zoom:devCameraZoom};event.preventDefault();event.stopImmediatePropagation();try{game.setPointerCapture?.(event.pointerId);}catch{}if(game?.style)game.style.cursor="grabbing";return true;
}
function developerUpdateCameraPan(event){
  if(!devCameraPanDrag)return false;const drag=devCameraPanDrag,zoom=Math.max(DEV_CAMERA_MIN_ZOOM,drag.zoom);devCameraX=drag.cameraX-(event.clientX-drag.x)/zoom;devCameraY=drag.cameraY-(event.clientY-drag.y)/zoom;event.preventDefault();event.stopImmediatePropagation();developerRefreshCameraUi();return true;
}
function developerEndCameraPan(event){
  if(!devCameraPanDrag)return false;devCameraPanDrag=null;event?.preventDefault?.();event?.stopImmediatePropagation?.();try{game.releasePointerCapture?.(event.pointerId);}catch{}if(game?.style)game.style.cursor="";developerPersistCameraForZone();return true;
}
function developerHandleCameraWheel(event){
  if(!devModeActive||devCameraMode==="player")return;event.preventDefault();event.stopImmediatePropagation();developerCameraZoomBy(event.deltaY<0?1.12:.89);
}
function developerRefreshCameraUi(){
  if(!devPanel)return;const frame=developerCameraFrame(innerWidth,innerHeight),mode=devCameraMode;
  devPanel.querySelectorAll("[data-dev-camera-mode]").forEach(button=>button.classList.toggle("active",button.dataset.devCameraMode===mode));
  const readout=devPanel.querySelector("#devCameraReadout");if(readout)readout.textContent=`${mode==="player"?"PLAYER CAMERA":mode==="world"?"WORLD VIEW":"FREE CAMERA"} • ${Math.round(frame.zoom*100)}%`;
  const move=devPanel.querySelector("#devMovePlayerToCamera");if(move)move.disabled=mode==="player";
}
function developerBindCameraControls(root=devPanel){
  if(!root)return;root.querySelectorAll("[data-dev-camera-mode]").forEach(button=>button.onclick=()=>setDeveloperCameraMode(button.dataset.devCameraMode));
  root.querySelector("#devCameraCenterPlayer")?.addEventListener("click",developerCenterCameraOnPlayer);root.querySelector("#devCameraCenterSelection")?.addEventListener("click",developerCenterCameraOnSelection);root.querySelector("#devMovePlayerToCamera")?.addEventListener("click",developerMovePlayerToCamera);
  root.querySelector("#devCameraZoomIn")?.addEventListener("click",()=>developerCameraZoomBy(1.18));root.querySelector("#devCameraZoomOut")?.addEventListener("click",()=>developerCameraZoomBy(.85));developerRefreshCameraUi();
}
function drawDeveloperCameraOverlay(camX,camY){
  if(!devModeActive||devCameraMode==="player")return;const zoom=developerCameraZoomValue(),px=state.x-camX,py=state.y-camY;
  ctx.save();ctx.strokeStyle="rgba(255,231,115,.98)";ctx.fillStyle="rgba(255,231,115,.12)";ctx.lineWidth=2/zoom;ctx.beginPath();ctx.arc(px,py,12/zoom,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.font=`800 ${Math.max(8,10/zoom)}px system-ui`;ctx.textAlign="center";ctx.fillStyle="#fff0a8";ctx.fillText("PLAYER",px,py-17/zoom);ctx.restore();
}

function defaultWorldObject(type,x,y){
  const objectId=developerObjectDefinitionIdFromPlaceType(type)||String(type||"");
  const definition=developerObjectDefinition(objectId);
  if(!definition)return null;
  const spec={w:Math.max(8,numberOr(definition.w,64)),h:Math.max(8,numberOr(definition.h,64))};
  const hitH=Math.max(8,Math.round(spec.h*.26));
  const hitW=Math.max(10,Math.round(spec.w*.66));
  return {
    id:`${objectId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,
    type:"object",
    objectId,
    x:Math.round(x),
    y:Math.round(y),
    solid:definition.solid===true,
    hitbox:{x:Math.round((spec.w-hitW)/2),y:spec.h-hitH,w:hitW,h:hitH},
    depthMode:WORLD_OBJECT_DEPTH_MODES.has(definition.depthMode)?definition.depthMode:"ysort",
    depthY:numberOr(definition.depthY,spec.h),
    interactable:false,
    label:definition.name||objectId,
    capacity:8,
    contents:[]
  };
}

function devWorldFromPointer(event){
  const camera=developerCameraFrame(innerWidth,innerHeight);
  return {x:camera.camX+event.clientX/camera.zoom,y:camera.camY+event.clientY/camera.zoom};
}
function snapDev(v){ return Math.round(v/devSnap)*devSnap; }
function clampDev(v,min,max){ return Math.max(min,Math.min(max,v)); }

function developerSelectedEntity(){
  return devSelected||devSelectedNpc||null;
}
function developerIsNpc(entity){
  return !!entity && sceneryNPCs.includes(entity);
}
function developerEntityBounds(entity){
  if(!entity) return {x:0,y:0,w:32,h:32};
  if(developerIsNpc(entity)) return npcVisualBounds(entity);
  const spec=worldObjectSpec(entity)||{w:32,h:32};
  return {x:entity.x,y:entity.y,w:spec.w,h:spec.h};
}
function developerMobVisualBounds(mob){
  if(!mob)return {x:0,y:0,w:32,h:32};
  const h=mobWorldDisplayHeight(mob);let ratio=.78;
  try{
    const path=String(mob?.template?.sprite||"");const record=path?dynamicMobSheet(path):null;const layout=mob?.template?.spriteLayout||{};
    if(record?.ready&&record.image?.naturalWidth){const rows=Math.max(1,Math.floor(numberOr(layout.rows,4))),rowMap=layout.directionRows||{down:0,right:1,left:2,up:3},row=clamp(Math.floor(numberOr(rowMap[mob.facing||"down"],0)),0,rows-1),meta=spriteFrameMeta(record.image,row,0);if(meta?.sh>0)ratio=Math.max(.2,Math.min(3,meta.sw/meta.sh));}
  }catch{}
  const w=Math.max(8,h*ratio);return {x:mob.x-w/2,y:mob.y+8-h,w,h};
}
function developerVisualSizeTarget(){
  const entity=developerSelectedEntity();
  if(entity){if(developerIsNpc(entity))return {kind:"npc",entity};if(worldObjectSpritePath(entity))return {kind:"object",entity};}
  if(devSelectedMob&&devActiveTab==="scale")return {kind:"mob",entity:devSelectedMob,key:mobTypeScaleKey(devSelectedMob)};
  return null;
}
function developerVisualSizeBounds(target=developerVisualSizeTarget()){
  if(!target)return null;if(target.kind==="mob")return developerMobVisualBounds(target.entity);return developerEntityBounds(target.entity);
}
function developerVisualSizeHandlePoints(target=developerVisualSizeTarget(),bounds=developerVisualSizeBounds(target)){
  if(!target||!bounds)return [];
  const l=bounds.x,t=bounds.y,r=bounds.x+bounds.w,b=bounds.y+bounds.h,mx=(l+r)/2,my=(t+b)/2;
  if(target.kind==="object")return [["nw",l,t],["n",mx,t],["ne",r,t],["w",l,my],["e",r,my],["sw",l,b],["s",mx,b],["se",r,b]];
  return [["nw",l,t],["ne",r,t],["sw",l,b],["se",r,b]];
}
function findDeveloperSizeInteraction(wx,wy){
  if(!devSizeEditing)return null;const target=developerVisualSizeTarget(),bounds=developerVisualSizeBounds(target);if(!target||!bounds)return null;
  const grab=8/developerCameraZoomValue();for(const [handle,x,y] of developerVisualSizeHandlePoints(target,bounds))if(Math.abs(wx-x)<=grab&&Math.abs(wy-y)<=grab)return handle;return null;
}
function setDeveloperSizeEditing(active){
  const target=developerVisualSizeTarget();devSizeEditing=!!active&&!!target;devSizeDrag=null;
  if(devSizeEditing){devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;devInteractionEditing=false;devInteractionDrag=null;devSetStatus(target.kind==="mob"?`Visual size edit — drag a blue corner to resize every ${mobTypeScaleLabel(target.key).toLowerCase()}`:"Visual size edit — drag the blue sprite box handles to resize by eye");}
  else{if(game?.style)game.style.cursor="";devSetStatus("Visual size edit mode finished");}
  refreshDeveloperPanel();refreshDeveloperToolStrip?.();
}
function updateDeveloperSizeDrag(p){
  if(!devSizeDrag)return;const d=devSizeDrag,handle=d.handle;
  if(d.kind==="object"){
    const dx=Math.round(p.x-d.pointerX),dy=Math.round(p.y-d.pointerY),min=8,start=d.bounds;let left=start.x,top=start.y,right=start.x+start.w,bottom=start.y+start.h;
    if(handle.includes("w"))left=Math.min(right-min,start.x+dx);if(handle.includes("e"))right=Math.max(left+min,start.x+start.w+dx);if(handle.includes("n"))top=Math.min(bottom-min,start.y+dy);if(handle.includes("s"))bottom=Math.max(top+min,start.y+start.h+dy);
    d.entity.x=Math.round(left);d.entity.y=Math.round(top);d.entity.w=Math.max(min,Math.round(right-left));d.entity.h=Math.max(min,Math.round(bottom-top));rebuildWorldObjectCollision();refreshDeveloperInspectorValues();return;
  }
  const vx=p.x-d.anchorX,vy=p.y-d.anchorY,current=Math.max(1,Math.hypot(vx,vy)),scale=current/Math.max(1,d.startDistance),max=d.kind==="mob"?160:320,height=Math.round(Math.max(d.kind==="mob"?8:24,Math.min(max,d.startHeight*scale)));
  if(d.kind==="npc"){
    d.entity.displayHeight=height;rebuildNpcCollision();refreshDeveloperInspectorValues();return;
  }
  if(d.kind==="mob"){
    const rec=BALANCE.mobs?.[d.key];if(!rec)return;rec.displayHeight=height;const nearest=nearestMobSizeClass(height),preset=mobSizeClassHeight(nearest);rec.sizeClass=Math.abs(height-preset)<=1?nearest:"custom";
    for(const template of mobTemplates||[])if(template?.configKey===d.key){template.displayHeight=height;template.sizeClass=rec.sizeClass;}
    const input=devPanel?.querySelector("#devSelectedMobScale"),out=devPanel?.querySelector("#devSelectedMobScaleValue");if(input)input.value=height;if(out)out.textContent=`${height}px • ${mobRelativePlayerScale(height).toFixed(2)}× player`;
  }
}
function developerEntityOffsetLimits(entity){
  const b=developerEntityBounds(entity);
  return {minX:b.x-entity.x,maxX:b.x+b.w-entity.x,minY:b.y-entity.y,maxY:b.y+b.h-entity.y};
}
function developerEntityDepthMode(entity){
  return developerIsNpc(entity)?npcDepthMode(entity):worldObjectDepthMode(entity);
}
function developerEntityDefaultDepthY(entity){
  return developerIsNpc(entity)?defaultNpcDepthY(entity):defaultWorldObjectDepthY(entity);
}
function rebuildDeveloperEntityCollision(entity){
  if(developerIsNpc(entity)) rebuildNpcCollision();
  else rebuildWorldObjectCollision();
}

function ensureDeveloperHitbox(obj=developerSelectedEntity()){
  if(!obj) return null;
  if(!obj.hitbox){
    if(developerIsNpc(obj)) obj.hitbox={x:-6,y:-7,w:12,h:14};
    else{
      const spec=worldObjectSpec(obj)||{w:32,h:32};
      const hitH=Math.max(8,Math.round(spec.h*.26));
      const hitW=Math.max(10,Math.round(spec.w*.66));
      obj.hitbox={x:Math.round((spec.w-hitW)/2),y:spec.h-hitH,w:hitW,h:hitH};
    }
  }
  return obj.hitbox;
}

function ensureDeveloperDepth(obj=developerSelectedEntity()){
  if(!obj) return null;
  if(!WORLD_OBJECT_DEPTH_MODES.has(String(obj.depthMode||"").toLowerCase())) obj.depthMode=developerEntityDepthMode(obj);
  if(!Number.isFinite(Number(obj.depthY))) obj.depthY=developerEntityDefaultDepthY(obj);
  return {mode:developerEntityDepthMode(obj),y:numberOr(obj.depthY,developerEntityDefaultDepthY(obj))};
}

function findDeveloperDepthInteraction(wx,wy){
  const entity=developerSelectedEntity();
  if(!devDepthEditing || !entity || developerEntityDepthMode(entity)!=="ysort") return false;
  const b=developerEntityBounds(entity);
  const depth=ensureDeveloperDepth(entity);
  const lineY=entity.y+depth.y;
  const grab=8/developerCameraZoomValue();
  return wx>=b.x-grab*2 && wx<=b.x+b.w+grab*2 && Math.abs(wy-lineY)<=grab;
}

function setDeveloperDepthEditing(active){
  const entity=developerSelectedEntity();
  devDepthEditing=!!active && !!entity && developerEntityDepthMode(entity)==="ysort";
  devDepthDrag=null;
  if(devDepthEditing){
    devHitboxEditing=false;
    devHitboxDrag=null;
    devInteractionEditing=false;
    devInteractionDrag=null;
    devSizeEditing=false;
    devSizeDrag=null;
    ensureDeveloperDepth(entity);
    devShowDepthLines=true;
    const toggle=devPanel?.querySelector("#devDepthLines");
    if(toggle) toggle.checked=true;
    devSetStatus("Depth edit mode — drag the purple line up/down to control sprite overlap");
  }else{
    if(game?.style) game.style.cursor="";
    devSetStatus("Depth edit mode finished");
  }
  refreshDeveloperPanel();
}

function updateDeveloperDepthDrag(p){
  const entity=developerSelectedEntity();
  if(!devDepthDrag || !entity) return;
  const limits=developerEntityOffsetLimits(entity);
  const span=Math.max(16,limits.maxY-limits.minY);
  const dy=Math.round(p.y-devDepthDrag.pointerY);
  entity.depthY=Math.round(clampDev(devDepthDrag.depthY+dy,limits.minY-span,limits.maxY+span));
  refreshDeveloperInspectorValues();
}

function findDeveloperHitboxInteraction(wx,wy){
  const entity=developerSelectedEntity();
  if(!devHitboxEditing || !entity) return null;
  const hb=ensureDeveloperHitbox(entity);
  const left=entity.x+hb.x, top=entity.y+hb.y;
  const right=left+hb.w, bottom=top+hb.h;
  const grab=7/developerCameraZoomValue();
  if(wx<left-grab || wx>right+grab || wy<top-grab || wy>bottom+grab) return null;

  const nearL=Math.abs(wx-left)<=grab, nearR=Math.abs(wx-right)<=grab;
  const nearT=Math.abs(wy-top)<=grab, nearB=Math.abs(wy-bottom)<=grab;
  if(nearL&&nearT) return "nw";
  if(nearR&&nearT) return "ne";
  if(nearL&&nearB) return "sw";
  if(nearR&&nearB) return "se";
  if(nearT && wx>=left-grab && wx<=right+grab) return "n";
  if(nearB && wx>=left-grab && wx<=right+grab) return "s";
  if(nearL && wy>=top-grab && wy<=bottom+grab) return "w";
  if(nearR && wy>=top-grab && wy<=bottom+grab) return "e";
  if(wx>=left && wx<=right && wy>=top && wy<=bottom) return "move";
  return null;
}

function developerHitboxCursor(interaction){
  if(interaction==="move") return "move";
  if(interaction==="n"||interaction==="s") return "ns-resize";
  if(interaction==="e"||interaction==="w") return "ew-resize";
  if(interaction==="nw"||interaction==="se") return "nwse-resize";
  if(interaction==="ne"||interaction==="sw") return "nesw-resize";
  return "default";
}

function setDeveloperHitboxEditing(active){
  const entity=developerSelectedEntity();
  devHitboxEditing=!!active && !!entity;
  devHitboxDrag=null;
  if(devHitboxEditing){
    devDepthEditing=false;
    devDepthDrag=null;
    devInteractionEditing=false;
    devInteractionDrag=null;
    devSizeEditing=false;
    devSizeDrag=null;
    ensureDeveloperHitbox(entity);
    devShowHitboxes=true;
    const toggle=devPanel?.querySelector("#devHitboxes");
    if(toggle) toggle.checked=true;
    devSetStatus("Hitbox edit mode — drag inside to move, drag handles/edges to resize");
  }else{
    if(game?.style) game.style.cursor="";
    devSetStatus("Hitbox edit mode finished");
  }
  refreshDeveloperPanel();
}

function updateDeveloperHitboxDrag(p){
  const entity=developerSelectedEntity();
  if(!devHitboxDrag || !entity) return;
  const limits=developerEntityOffsetLimits(entity);
  const start=devHitboxDrag.hitbox;
  const dx=Math.round(p.x-devHitboxDrag.pointerX);
  const dy=Math.round(p.y-devHitboxDrag.pointerY);
  const minSize=2;
  let left=start.x, top=start.y, right=start.x+start.w, bottom=start.y+start.h;
  const handle=devHitboxDrag.handle;

  if(handle==="move"){
    left=clampDev(start.x+dx,limits.minX,Math.max(limits.minX,limits.maxX-start.w));
    top=clampDev(start.y+dy,limits.minY,Math.max(limits.minY,limits.maxY-start.h));
    right=left+start.w;
    bottom=top+start.h;
  }else{
    if(handle.includes("w")) left=clampDev(start.x+dx,limits.minX,right-minSize);
    if(handle.includes("e")) right=clampDev(start.x+start.w+dx,left+minSize,limits.maxX);
    if(handle.includes("n")) top=clampDev(start.y+dy,limits.minY,bottom-minSize);
    if(handle.includes("s")) bottom=clampDev(start.y+start.h+dy,top+minSize,limits.maxY);
  }

  entity.hitbox={
    x:Math.round(left),
    y:Math.round(top),
    w:Math.max(minSize,Math.round(right-left)),
    h:Math.max(minSize,Math.round(bottom-top))
  };
  rebuildDeveloperEntityCollision(entity);
  refreshDeveloperInspectorValues();
}

function ensureDeveloperInteractionArea(obj=devSelected){
  if(!obj||developerIsNpc(obj)) return null;
  obj.interaction=obj.interaction&&typeof obj.interaction==="object"?obj.interaction:{};
  if(!obj.interaction.area||typeof obj.interaction.area!=="object") obj.interaction.area={...worldInteractionDefaults(obj)};
  const a=obj.interaction.area;
  a.x=Math.round(numberOr(a.x,0));a.y=Math.round(numberOr(a.y,0));a.w=Math.max(4,Math.round(numberOr(a.w,16)));a.h=Math.max(4,Math.round(numberOr(a.h,16)));
  return a;
}

function findDeveloperInteractionAreaHandle(wx,wy){
  const obj=devSelected;if(!devInteractionEditing||!obj)return null;
  const a=ensureDeveloperInteractionArea(obj);if(!a)return null;
  const left=obj.x+a.x,top=obj.y+a.y,right=left+a.w,bottom=top+a.h,grab=7/developerCameraZoomValue();
  if(wx<left-grab||wx>right+grab||wy<top-grab||wy>bottom+grab)return null;
  const nearL=Math.abs(wx-left)<=grab,nearR=Math.abs(wx-right)<=grab,nearT=Math.abs(wy-top)<=grab,nearB=Math.abs(wy-bottom)<=grab;
  if(nearL&&nearT)return "nw";if(nearR&&nearT)return "ne";if(nearL&&nearB)return "sw";if(nearR&&nearB)return "se";
  if(nearT)return "n";if(nearB)return "s";if(nearL)return "w";if(nearR)return "e";
  if(wx>=left&&wx<=right&&wy>=top&&wy<=bottom)return "move";return null;
}

function setDeveloperInteractionEditing(active){
  const obj=devSelected;
  devInteractionEditing=!!active&&!!obj;
  devInteractionDrag=null;
  if(devInteractionEditing){
    // Interaction-area editing is mutually exclusive with the other visual editors,
    // but it must stay enabled itself. v73 accidentally cleared this flag here,
    // which made the green box look coordinate-only instead of behaving like the hitbox editor.
    devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;devSizeEditing=false;devSizeDrag=null;
    obj.interactable=true;obj.interaction=obj.interaction||{};obj.interaction.enabled=true;ensureDeveloperInteractionArea(obj);
    devSetStatus("Interaction area edit mode — drag inside the green box to move it; drag any side or corner handle to resize it");
  }else{if(game?.style)game.style.cursor="";devSetStatus("Interaction area edit mode finished");}
  refreshDeveloperPanel();
}

function updateDeveloperInteractionAreaDrag(p){
  const obj=devSelected;if(!devInteractionDrag||!obj)return;
  const limits=developerEntityOffsetLimits(obj),start=devInteractionDrag.area,dx=Math.round(p.x-devInteractionDrag.pointerX),dy=Math.round(p.y-devInteractionDrag.pointerY),minSize=4;
  let left=start.x,top=start.y,right=start.x+start.w,bottom=start.y+start.h;const handle=devInteractionDrag.handle;
  if(handle==="move"){
    left=clampDev(start.x+dx,limits.minX,Math.max(limits.minX,limits.maxX-start.w));top=clampDev(start.y+dy,limits.minY,Math.max(limits.minY,limits.maxY-start.h));right=left+start.w;bottom=top+start.h;
  }else{
    if(handle.includes("w"))left=clampDev(start.x+dx,limits.minX,right-minSize);if(handle.includes("e"))right=clampDev(start.x+start.w+dx,left+minSize,limits.maxX);
    if(handle.includes("n"))top=clampDev(start.y+dy,limits.minY,bottom-minSize);if(handle.includes("s"))bottom=clampDev(start.y+start.h+dy,top+minSize,limits.maxY);
  }
  obj.interaction=obj.interaction||{};obj.interaction.area={x:Math.round(left),y:Math.round(top),w:Math.max(minSize,Math.round(right-left)),h:Math.max(minSize,Math.round(bottom-top))};
  refreshDeveloperInspectorValues();
}

function findWorldObjectAt(wx,wy){
  const pad=10;
  const sorted=[...sceneryProps].sort((a,b)=>((b.y+(worldObjectSpec(b)?.h||0))-(a.y+(worldObjectSpec(a)?.h||0))));
  for(const obj of sorted){
    const spec=worldObjectSpec(obj);
    if(!spec) continue;
    if(wx>=obj.x-pad && wx<=obj.x+spec.w+pad && wy>=obj.y-pad && wy<=obj.y+spec.h+pad) return obj;
  }
  return null;
}

function makeDeveloperRemnantPreview(kind="dust"){
  const lootable=kind==="lootable";
  const existing=devRemnantPreview;
  return {
    id:"developer-remnant-preview",
    x:Number.isFinite(existing?.x)?existing.x:state.x+56,
    y:Number.isFinite(existing?.y)?existing.y:state.y+8,
    sourceLabel:"World Builder Remnant Preview",
    items:[],
    gold:lootable?1:0,
    potions:0,
    createdAt:0,
    expiresAt:Number.POSITIVE_INFINITY,
    devKind:lootable?"lootable":"dust"
  };
}

function selectDeveloperRemnant(kind){
  devSelectedRemnant=kind==="lootable"?"lootable":"dust";
  devRemnantPreview=makeDeveloperRemnantPreview(devSelectedRemnant);
  devSelected=null;devSelectedNpc=null;devSelectedMob=null;
  devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;
  setDeveloperTab("selection");
  refreshDeveloperPanel();
  devSetStatus(`${devSelectedRemnant==="lootable"?"Lootable Dust":"Dust"} preview selected — drag it in the world and tune scale/depth here`);
}

function developerRemnantPreviewBounds(){
  if(!devRemnantPreview) return null;
  const size=lootRemnantDrawSize();
  return {x:devRemnantPreview.x-size/2,y:devRemnantPreview.y-size*.72,w:size,h:size};
}

function findDeveloperRemnantPreviewAt(wx,wy){
  const b=developerRemnantPreviewBounds();
  return !!b && wx>=b.x-6 && wx<=b.x+b.w+6 && wy>=b.y-6 && wy<=b.y+b.h+6;
}

function updateDeveloperRemnantVisual({scale,depthMode,depthY}={}){
  if(scale!==undefined) LOOT_REMNANT_VISUAL.scale=Math.round(visualScaleOr(scale,LOOT_REMNANT_VISUAL.scale)*100)/100;
  if(depthMode!==undefined){
    const mode=String(depthMode).toLowerCase();
    if(LOOT_REMNANT_DEPTH_MODES.has(mode)) LOOT_REMNANT_VISUAL.depthMode=mode;
  }
  if(depthY!==undefined&&Number.isFinite(Number(depthY))) LOOT_REMNANT_VISUAL.depthY=Math.round(Number(depthY));
}

function mobTypeScaleKey(mob){return mob?.template?.configKey||mob?.spawnType||null;}
function mobTypeScaleLabel(key){return BALANCE.mobs?.[key]?.name||key||"Mob";}
function mobTypeFallbackHeight(key){const mob=DEV_PROJECT_BALANCE?.mobs?.[key];return Math.max(8,numberOr(mob?.displayHeight,mobSizeClassHeight(mob?.sizeClass)));}
function findDeveloperMobAt(wx,wy){
  let best=null,bestScore=Infinity;
  for(const mob of mobs){
    if(!mob.alive) continue;
    const scale=Math.max(.75,mobVisualScale(mob));
    const rx=(mob.boss?42:30)*scale;
    const ry=(mob.boss?52:38)*scale;
    const dx=Math.abs(wx-mob.x),dy=wy-mob.y;
    if(dx<=rx && dy>=-ry && dy<=ry*.55){
      const score=dx*dx+(dy*.65)*(dy*.65);
      if(score<bestScore){best=mob;bestScore=score;}
    }
  }
  return best;
}
function developerPlacementDescription(){
  if(devActiveTab==="terrain")return {kind:"paint",text:`PAINT • ${developerTerrainType()?.name||devTerrainBrush||"Terrain"}`};
  if(devInteractionEditing)return {kind:"edit",text:"EDIT • Interaction Area"};
  if(devSizeEditing)return {kind:"edit",text:"EDIT • Visual Size"};
  if(devHitboxEditing)return {kind:"edit",text:"EDIT • Hitbox"};
  if(devDepthEditing)return {kind:"edit",text:"EDIT • Depth Line"};
  if(devPlaceType){
    const objectId=developerObjectDefinitionIdFromPlaceType?.(devPlaceType);
    const label=objectId?(developerObjectDefinition?.(objectId)?.name||objectId):String(devPlaceType);
    return {kind:"place",text:`PLACE • ${label}${devRepeatPlacement?" • REPEAT":" • ONE SHOT"}`};
  }
  if(devPlaceNpcAsset){const a=devAssets?.[devPlaceNpcAsset];return {kind:"place",text:`PLACE NPC • ${a?.name||devPlaceNpcAsset}${devRepeatPlacement?" • REPEAT":" • ONE SHOT"}`};}
  if(devPlaceMobType)return {kind:"place",text:`PLACE SPAWN • ${mobTypeScaleLabel(devPlaceMobType)}${devRepeatPlacement?" • REPEAT":" • ONE SHOT"}`};
  return {kind:"select",text:"SELECT / MOVE • Esc returns here"};
}
function refreshDeveloperToolStrip(){
  if(!devPanel)return;
  const mode=developerPlacementDescription(),el=devPanel.querySelector("#devToolMode");
  if(el){el.textContent=mode.text;el.className=`devToolMode ${mode.kind}`;}
  const repeat=devPanel.querySelector("#devRepeatPlacement");
  if(repeat){repeat.checked=!!devRepeatPlacement;repeat.disabled=!(devPlaceType||devPlaceNpcAsset||devPlaceMobType);}
  const finish=devPanel.querySelector("#devFinishTool");if(finish)finish.textContent=mode.kind==="select"?"Select Active":"Finish / Select";
}
function refreshDeveloperSectionNav(){
  if(!devPanel)return;const nav=devPanel.querySelector("#devSectionNav"),body=devPanel.querySelector(".devBody"),view=devPanel.querySelector(`.devView[data-dev-view="${devActiveTab}"]`);if(!nav||!body||!view)return;
  const sections=[...view.querySelectorAll(":scope > .devSection, :scope > .devMasterDetail .devSection")];nav.innerHTML="";
  sections.forEach((section,index)=>{const title=section.querySelector(".devSectionTitle");if(!title)return;const label=(title.childNodes?.[0]?.textContent||title.textContent||`Section ${index+1}`).trim();const b=document.createElement("button");b.className="devSectionJump";b.textContent=label;b.onclick=()=>{developerSetSectionCollapsed?.(section,false);const top=Math.max(0,section.offsetTop-view.offsetTop-8);body.scrollTo?body.scrollTo({top,behavior:"smooth"}):body.scrollTop=top;};nav.appendChild(b);});
  nav.style.display=sections.length>1?"flex":"none";
}
function developerFinishPlacement({leaveTerrain=true,status=true}={}){
  devPlaceType=null;devPlaceNpcAsset=null;devPlaceMobType=null;devTerrainPainting=false;devTerrainHoverTile=null;devTerrainLastTileKey=null;
  if(devInteractionEditing)setDeveloperInteractionEditing?.(false);
  if(devSizeEditing)setDeveloperSizeEditing?.(false);
  if(devHitboxEditing)setDeveloperHitboxEditing?.(false);
  if(devDepthEditing)setDeveloperDepthEditing?.(false);
  if(leaveTerrain&&devActiveTab==="terrain")setDeveloperTab("selection");
  updateDevPaletteActive();refreshDeveloperToolStrip();if(status)devSetStatus("Select / Move mode");
}
function setDeveloperTab(tab){
  const next=tab||"objects",previous=devActiveTab;const body=devPanel?.querySelector?.(".devBody");
  if(body&&previous!==next)devTabScrollPositions[previous]=body.scrollTop||0;
  devActiveTab=next;
  if(devPlaceType&&devActiveTab!=="objects")devPlaceType=null;
  if(devPlaceNpcAsset&&devActiveTab!=="npcs")devPlaceNpcAsset=null;
  if(devPlaceMobType&&devActiveTab!=="spawns")devPlaceMobType=null;
  if(devActiveTab==="terrain"){
    devPlaceType=null;devPlaceNpcAsset=null;devPlaceMobType=null;
    devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;devInteractionEditing=false;devInteractionDrag=null;devSizeEditing=false;devSizeDrag=null;
  }else{
    devTerrainPainting=false;devTerrainHoverTile=null;devTerrainLastTileKey=null;
    if(game?.style)game.style.cursor="";
  }
  if(!devPanel) return;
  devPanel.querySelectorAll(".devTab").forEach(b=>b.classList.toggle("active",b.dataset.devTab===devActiveTab));
  devPanel.querySelectorAll(".devView").forEach(v=>v.classList.toggle("active",v.dataset.devView===devActiveTab));
  updateDevPaletteActive();refreshDeveloperSectionNav();refreshDeveloperToolStrip();
  if(devActiveTab==="terrain")refreshDeveloperTerrainPanel();
  if(body&&previous!==devActiveTab){const restore=()=>{body.scrollTop=devTabScrollPositions[devActiveTab]||0;};if(typeof requestAnimationFrame==="function")requestAnimationFrame(restore);else restore();}
}

function developerWorldPack(){
  const zoneBalance=devBalanceClone(BALANCE);
  delete zoneBalance.mobs;
  const settings=(typeof window!=="undefined"&&window.LR_ZONE_SETTINGS)||{};
  return {
    format:"little-realm-world-pack",
    schemaVersion:DEV_WORLD_SCHEMA_VERSION,
    build:DEV_BUILDER_VERSION,
    exportedAt:new Date().toISOString(),
    zoneSettings:{
      width:WORLD_W,
      height:WORLD_H,
      startTileX:START_TILE_X,
      startTileY:START_TILE_Y,
      backdropTerrainId:String(settings.backdropTerrainId||developerZoneBackdropTerrainId()),
      musicId:String(settings.musicId||""),musicVolume:Math.max(0,Math.min(2,numberOr(settings.musicVolume,1))),
      ambienceId:String(settings.ambienceId||""),ambienceVolume:Math.max(0,Math.min(2,numberOr(settings.ambienceVolume,1)))
    },
    terrain:world.map(row=>row.slice()),
    worldObjects:sceneryProps.map(cloneWorldObject),
    npcs:sceneryNPCs.map(cloneNpc),
    quests:questDefinitions.map(cloneQuest),
    mobSpawns:devContentClone(devMobSpawns),
    visualSettings:{...VISUAL_SCALE,remnants:{...LOOT_REMNANT_VISUAL}},
    balance:zoneBalance
  };
}

function applyDeveloperWorldPack(pack,{quiet=false,zoneSwitch=false}={}){
  if(!pack||typeof pack!=="object") throw new Error("World Pack is not an object");
  const currentObjects=sceneryProps.map(cloneWorldObject);
  const currentNpcs=sceneryNPCs.map(cloneNpc);
  const objects=Array.isArray(pack.worldObjects)?pack.worldObjects:currentObjects;
  const npcs=Array.isArray(pack.npcs)?pack.npcs:currentNpcs;
  const settings=pack.zoneSettings&&typeof pack.zoneSettings==="object"?pack.zoneSettings:((typeof window!=="undefined"&&window.LR_ZONE_SETTINGS)||{});
  const terrain=Array.isArray(pack.terrain)?pack.terrain:world.map(row=>row.slice());
  window.LR_ZONE_SETTINGS=settings;
  applyWorldZoneDefinition(settings,terrain);
  buildScenery({worldObjects:objects,npcs});

  if(Array.isArray(pack.quests)) replaceQuestDefinitions(pack.quests);
  if(Array.isArray(pack.mobSpawns)){
    devMobSpawns=developerNormalizeSpawns(pack.mobSpawns);window.LR_MOB_SPAWNS=devContentClone(devMobSpawns);
  }
  if(pack.visualSettings&&typeof pack.visualSettings==="object"){
    for(const key of Object.keys(VISUAL_SCALE)) if(Number.isFinite(Number(pack.visualSettings[key]))) VISUAL_SCALE[key]=visualScaleOr(pack.visualSettings[key],VISUAL_SCALE[key]);
    if(pack.visualSettings.remnants&&typeof pack.visualSettings.remnants==="object"){
      if(Number.isFinite(Number(pack.visualSettings.remnants.scale))) LOOT_REMNANT_VISUAL.scale=visualScaleOr(pack.visualSettings.remnants.scale,LOOT_REMNANT_VISUAL.scale);
      const mode=String(pack.visualSettings.remnants.depthMode||"").toLowerCase();
      if(LOOT_REMNANT_DEPTH_MODES.has(mode)) LOOT_REMNANT_VISUAL.depthMode=mode;
      if(Number.isFinite(Number(pack.visualSettings.remnants.depthY))) LOOT_REMNANT_VISUAL.depthY=Number(pack.visualSettings.remnants.depthY);
    }
  }
  if(pack.balance&&typeof pack.balance==="object"){
    const sharedMobs=devContentClone(BALANCE.mobs||{});
    devReplaceBalance(pack.balance);
    BALANCE.mobs=sharedMobs;
    if(typeof refreshMobTemplatesFromBalance==="function") refreshMobTemplatesFromBalance();
  }
  if(typeof spawnMobs==="function"&&state) syncDeveloperSpawnRuntime({keepSelection:false});
  if(zoneSwitch&&state){
    if(typeof disengageCombat==="function"&&combatTarget) disengageCombat();
    selectedTarget=null;devSelectedMob=null;
    state.x=START_X;state.y=START_Y;lastSafePos={x:START_X,y:START_Y};
    if(typeof refreshAliveMobStatsForPlayer==="function") refreshAliveMobStatsForPlayer();
  }
  devSelected=null;devSelectedNpc=null;devSelectedMob=null;devSelectedRemnant=null;devSelectedSpawnId=null;devSelectedQuestId=questDefinitions[0]?.id||null;devQuestFormDraft=null;
  applyZoneAudioFromCurrentSettings?.();
  resetFootstepTracking?.();
  refreshDeveloperPanel();
  updateUI?.();
  if(!quiet) devSetStatus(`Loaded World Pack • ${WORLD_W}×${WORLD_H} tiles • ${sceneryProps.length} props • ${sceneryNPCs.length} NPCs`);
}

async function developerNestedFileHandle(rootHandle,path,{create=false}={}){
  const parts=String(path||"").split("/").filter(Boolean);
  if(!parts.length) throw new Error("Project file path is empty");
  let dir=rootHandle;
  for(const part of parts.slice(0,-1)) dir=await dir.getDirectoryHandle(part,{create});
  return dir.getFileHandle(parts[parts.length-1],{create});
}

async function developerReadProjectJson(path){
  const handle=await developerNestedFileHandle(devProjectDirectoryHandle,path);
  return JSON.parse(await (await handle.getFile()).text());
}

async function developerWriteProjectJson(path,value){
  const handle=await developerNestedFileHandle(devProjectDirectoryHandle,path,{create:true});
  const writable=await handle.createWritable();
  await writable.write(JSON.stringify(value,null,2)+"\n");
  await writable.close();
}

async function developerPersistProjectManifest(){
  if(!devProjectDirectoryHandle||!devProjectManifest) return;
  devProjectManifest.schemaVersion=DEV_PROJECT_SCHEMA_VERSION;
  await developerWriteProjectJson("content/little-realm.project.json",devProjectManifest);
  devProjectManifestBaseline=devContentClone(devProjectManifest);
}

async function developerPersistActiveProject({saveShared=true,saveManifest=true}={}){
  if(!devProjectDirectoryHandle||!devProjectZone?.pack) throw new Error("Open the Little Realm project folder first");
  const pack=developerWorldPack();
  await developerWriteProjectJson(devProjectZone.pack,pack);
  devZoneBaselinePack=devContentClone(pack);
  if(devProjectZone){
    devProjectZone.width=WORLD_W;devProjectZone.height=WORLD_H;
    devProjectZone.startTileX=START_TILE_X;devProjectZone.startTileY=START_TILE_Y;
  }
  if(saveShared){
    const sharedPath=devProjectSharedContentPath||devProjectManifest?.sharedContent||"content/shared/content-library.json";
    const shared=developerContentLibrary();
    await developerWriteProjectJson(sharedPath,shared);
    devProjectSharedBaseline=devContentClone(shared);
  }
  if(saveManifest) await developerPersistProjectManifest();
}

async function openDeveloperProjectFolder(){
  if(typeof window.showDirectoryPicker!=="function"){
    devSetStatus("Direct folder access needs Chrome or Edge; use World Pack export/import instead");
    return;
  }
  try{
    const rootHandle=await window.showDirectoryPicker({mode:"readwrite"});
    devProjectDirectoryHandle=rootHandle;
    const rawManifest=await developerReadProjectJson("content/little-realm.project.json");
    if(rawManifest?.format!=="little-realm-project") throw new Error("content/little-realm.project.json is not a Little Realm project");
    const prepared=await developerPrepareOpenedProject(rawManifest);
    const manifest=prepared.manifest,sharedPath=prepared.sharedPath,sharedContent=prepared.sharedContent;
    const zone=(manifest.zones||[]).find(entry=>entry.id===manifest.defaultZone)||manifest.zones?.[0];
    if(!zone?.pack) throw new Error("Project manifest has no zone pack");
    const pack=prepared.zones[zone.id]||await developerReadProjectJson(zone.pack);
    devProjectManifest=manifest;devProjectZone=zone;devZoneSelectedId=zone.id;devProjectSharedContentPath=sharedPath;
    applyDeveloperContentLibrary(sharedContent,{quiet:true});
    applyDeveloperWorldPack(pack,{quiet:true,zoneSwitch:true});
    developerAcceptProjectBaselines({pack,shared:sharedContent,manifest});
    saveDeveloperDraft();
    await validateDeveloperProject({quiet:true});
    refreshDeveloperPanel();
    devSetStatus(`Opened ${manifest.name||"Little Realm"} • ${zone.name||zone.id} • schema v${DEV_PROJECT_SCHEMA_VERSION} project ready`);
  }catch(err){
    if(err?.name==="AbortError") return;
    console.error(err);
    devProjectDirectoryHandle=null;
    devSetStatus(`Project folder could not be opened: ${err?.message||"unknown error"}`);
  }
}

async function saveDeveloperProjectFolder(){
  if(!devProjectDirectoryHandle||!devProjectZone?.pack){
    devSetStatus("Open the Little Realm project folder first, then Save Project Folder");
    return;
  }
  try{
    const {dirty,validation}=await developerPersistActiveProjectSafely("project save");
    saveDeveloperDraft();refreshDeveloperPanel();
    const health=validation.errors?` • ${validation.errors} error(s), ${validation.warnings} warning(s)`:validation.warnings?` • ${validation.warnings} warning(s)`:" • healthy";
    devSetStatus(`Saved ${devProjectZone.name||devProjectZone.id}${health}${dirty.dirty?" • recovery snapshot created":""}`);
  }catch(err){
    console.error(err);devSetStatus(`Project folder save failed: ${err?.message||"unknown error"}`);
  }
}

function saveDeveloperDraft(){
  try{
    localStorage.setItem(DEV_DRAFT_KEY,JSON.stringify({format:"little-realm-builder-draft",schemaVersion:DEV_DRAFT_SCHEMA_VERSION,zoneId:devProjectZone?.id||null,worldPack:developerWorldPack(),sharedContent:developerContentLibrary()}));
    devSetStatus("World Builder draft autosaved locally");
  }catch(err){ console.warn("Could not save developer draft",err); }
}

function loadDeveloperDraft(){
  try{
    const raw=localStorage.getItem(DEV_DRAFT_KEY);
    if(!raw){devSetStatus("No local draft found");return;}
    const parsed=JSON.parse(raw);
    if(parsed?.format==="little-realm-builder-draft"&&parsed.schemaVersion===DEV_DRAFT_SCHEMA_VERSION&&parsed.worldPack){
      if(parsed.sharedContent)applyDeveloperContentLibrary(parsed.sharedContent,{quiet:true});
      applyDeveloperWorldPack(parsed.worldPack);
    }else throw new Error(`Draft schema is unsupported; expected v${DEV_DRAFT_SCHEMA_VERSION}`);
  }catch(err){console.error(err);devSetStatus("Draft could not be loaded");}
}

function resetDeveloperLayout(){
  const source=Array.isArray(devZoneBaselinePack?.worldObjects)?devZoneBaselinePack.worldObjects:getProjectWorldObjects();
  if(!confirm("Reset the active zone's prop layout to its last opened/saved project version? Your browser draft remains until overwritten.")) return;
  sceneryProps.splice(0,sceneryProps.length,...source.map(cloneWorldObject));devSelected=null;rebuildWorldObjectCollision();refreshDeveloperPanel();devSetStatus("Active zone prop layout restored");
}

function resetDeveloperProject(){
  if(!devZoneBaselinePack?.format){devSetStatus("No active zone baseline is available");return;}
  if(!confirm(`Reset ${devProjectZone?.name||"the active zone"} and shared content to the last opened/saved project files?`)) return;
  if(devProjectSharedBaseline&&Object.keys(devProjectSharedBaseline).length) applyDeveloperContentLibrary(devProjectSharedBaseline,{quiet:true});
  applyDeveloperWorldPack(devZoneBaselinePack,{quiet:true,zoneSwitch:true});
  refreshDeveloperPanel();updateUI();devSetStatus("Active zone project baseline restored");
}

function downloadDeveloperText(filename,text,type="application/json"){
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function exportDeveloperWorldPack(){
  const backup={...developerWorldPack(),sharedContent:developerContentLibrary()};
  downloadDeveloperText("little-realm-world-pack.json",JSON.stringify(backup,null,2));
  devSetStatus("Exported portable backup with zone + shared Content Library");
}

function importDeveloperWorldPackFile(file){
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(String(reader.result||""));
      if(parsed?.sharedContent)applyDeveloperContentLibrary(parsed.sharedContent,{quiet:true});
      applyDeveloperWorldPack(parsed);
      saveDeveloperDraft();
    }catch(err){console.error(err);devSetStatus("World Pack import failed — invalid JSON");}
  };
  reader.readAsText(file);
}

function devSetStatus(text){
  if(!devPanel) return;
  const el=devPanel.querySelector("#devStatus");
  if(el) el.textContent=text;
  clearTimeout(devStatusTimer);
  devStatusTimer=setTimeout(()=>{if(el)el.textContent="F2 toggles World Builder";},2200);
}

function developerValidateZoneInteractions(zoneName,zoneId,pack,shared,issues,projectZoneIds){
  const tags=new Set();
  for(const obj of pack.worldObjects||[]){
    if(obj?.interaction?.enabled!==true)continue;
    const cfg=worldObjectInteraction(obj),where={tab:"selection",targetId:obj.id,zoneId},label=obj.label||obj.id;
    if(cfg.tag)tags.add(cfg.tag);if(obj.id)tags.add(obj.id);
    if(cfg.requirements.itemId&&!shared.items?.[cfg.requirements.itemId])developerHealthIssue(issues,"error",`${zoneName}: interaction '${label}' requires missing item '${cfg.requirements.itemId}'`,where);
    if(cfg.actions.giveItemId&&!shared.items?.[cfg.actions.giveItemId])developerHealthIssue(issues,"error",`${zoneName}: interaction '${label}' gives missing item '${cfg.actions.giveItemId}'`,where);
    if(cfg.actions.lootTable&&!shared.lootTables?.[cfg.actions.lootTable])developerHealthIssue(issues,"error",`${zoneName}: interaction '${label}' uses missing loot table '${cfg.actions.lootTable}'`,where);
    if(cfg.actions.targetZone&&projectZoneIds&&!projectZoneIds.has(cfg.actions.targetZone))developerHealthIssue(issues,"error",`${zoneName}: interaction '${label}' targets missing zone '${cfg.actions.targetZone}'`,where);
  }
  return tags;
}
function developerValidateInteractionQuestRequirements(zoneName,zoneId,pack,questIds,issues){
  for(const obj of pack.worldObjects||[]){
    const cfg=obj?.interaction?.enabled===true?worldObjectInteraction(obj):null;
    if(cfg?.requirements.questId&&!questIds.has(cfg.requirements.questId))developerHealthIssue(issues,"error",`${zoneName}: interaction '${obj.label||obj.id}' requires missing quest '${cfg.requirements.questId}'`,{tab:"selection",targetId:obj.id,zoneId});
    for(const questId of cfg?.actions?.questIds||[])if(!questIds.has(questId))developerHealthIssue(issues,"error",`${zoneName}: interaction '${obj.label||obj.id}' offers missing quest '${questId}'`,{tab:"selection",targetId:obj.id,zoneId});
  }
}
function developerValidateInteractObjective(zoneName,questId,objective,interactionTags,issues,where){
  if(objective?.type==="interact"&&!interactionTags.has(objective.target))developerHealthIssue(issues,"error",`${zoneName}: quest '${questId}' targets missing interaction tag/object '${objective.target}'`,where);
}

const DEV_BUILDER_VERSION="v77.8-builder-help-visual-size";
const DEV_PROJECT_SCHEMA_VERSION=12;
const DEV_SHARED_SCHEMA_VERSION=12;
const DEV_WORLD_SCHEMA_VERSION=12;
const DEV_DRAFT_SCHEMA_VERSION=7;
const DEV_BACKUP_ROOT="builder-backups";
let devProjectManifestBaseline=devContentClone((typeof window!=="undefined"?window.LR_BUILDER_PROJECT?.manifest:null)||{});
let devProjectHealthResult=null,devProjectValidationRunning=false,devLastSnapshotPath="";
function developerStableValue(value){if(Array.isArray(value))return value.map(developerStableValue);if(value&&typeof value==="object")return Object.keys(value).sort().reduce((out,key)=>{out[key]=developerStableValue(value[key]);return out;},{});return value;}
function developerStableJson(value){return JSON.stringify(developerStableValue(value));}
function developerComparableWorldPack(pack){const copy=devContentClone(pack||{});delete copy.exportedAt;delete copy.build;return copy;}
function developerProjectDirtyDetails(){const zoneBaseline=Object.keys(devZoneBaselinePack||{}).length?devZoneBaselinePack:null,sharedBaseline=Object.keys(devProjectSharedBaseline||{}).length?devProjectSharedBaseline:null,manifestBaseline=Object.keys(devProjectManifestBaseline||{}).length?devProjectManifestBaseline:null;const zoneDirty=!!zoneBaseline&&developerStableJson(developerComparableWorldPack(developerWorldPack()))!==developerStableJson(developerComparableWorldPack(zoneBaseline)),sharedDirty=!!sharedBaseline&&developerStableJson(developerContentLibrary())!==developerStableJson(sharedBaseline),manifestDirty=!!manifestBaseline&&developerStableJson(devProjectManifest||{})!==developerStableJson(manifestBaseline);return {dirty:zoneDirty||sharedDirty||manifestDirty,zoneDirty,sharedDirty,manifestDirty};}
function developerProjectFingerprint(){return developerStableJson({manifest:devProjectManifest||{},shared:developerContentLibrary(),zone:developerComparableWorldPack(developerWorldPack())});}
function developerAcceptProjectBaselines({pack=null,shared=null,manifest=null}={}){devZoneBaselinePack=devContentClone(pack||developerWorldPack());devProjectSharedBaseline=devContentClone(shared||developerContentLibrary());devProjectManifestBaseline=devContentClone(manifest||devProjectManifest||{});}
function developerSchemaVersion(value){const n=Math.floor(Number(value));return Number.isFinite(n)&&n>0?n:0;}
function developerRequireSchema(value,{format,version,label}){if(!value||typeof value!=="object")throw new Error(`${label} is not an object`);if(value.format!==format)throw new Error(`${label} format must be '${format}'`);const actual=developerSchemaVersion(value.schemaVersion);if(actual!==version)throw new Error(`${label} schema v${actual||"missing"} is unsupported. This Builder requires v${version}.`);return value;}
async function developerPrepareOpenedProject(rawManifest){
  const manifest=devContentClone(developerRequireSchema(rawManifest,{format:"little-realm-project",version:DEV_PROJECT_SCHEMA_VERSION,label:"Project Manifest"}));if(!Array.isArray(manifest.zones)||!manifest.zones.length)throw new Error("Project Manifest has no zones");
  const sharedPath=manifest.sharedContent||"content/shared/content-library.json",sharedContent=devContentClone(developerRequireSchema(await developerReadProjectJson(sharedPath),{format:"little-realm-content-library",version:DEV_SHARED_SCHEMA_VERSION,label:"Shared Content"}));
  const zones={};for(const zone of manifest.zones){if(!zone?.id||!zone?.pack)throw new Error("Every zone needs an id and pack path");zones[zone.id]=devContentClone(developerRequireSchema(await developerReadProjectJson(zone.pack),{format:"little-realm-world-pack",version:DEV_WORLD_SCHEMA_VERSION,label:`Zone '${zone.id}'`}));}
  return {manifest,sharedPath,sharedContent,zones,changed:false,snapshotPath:""};
}
function developerSnapshotStamp(){return new Date().toISOString().replace(/[:.]/g,"-");}
function developerSnapshotReasonSlug(reason){return devContentId(reason||"snapshot","snapshot").slice(0,50);}
async function developerWriteSnapshotFiles(files,reason){if(!devProjectDirectoryHandle)throw new Error("Open the Little Realm project folder first");const folder=`${DEV_BACKUP_ROOT}/${developerSnapshotStamp()}-${developerSnapshotReasonSlug(reason)}`,names=Object.keys(files);for(const path of names)await developerWriteProjectJson(`${folder}/${path}`,files[path]);await developerWriteProjectJson(`${folder}/snapshot.json`,{format:"little-realm-project-snapshot",schemaVersion:1,createdAt:new Date().toISOString(),reason:String(reason||"snapshot"),builderVersion:DEV_BUILDER_VERSION,files:names});devLastSnapshotPath=folder;return folder;}
async function developerCollectProjectSnapshotFiles({useCurrent=true}={}){if(!devProjectDirectoryHandle||!devProjectManifest)throw new Error("Open the Little Realm project folder first");const files={"content/little-realm.project.json":devContentClone(useCurrent?devProjectManifest:(Object.keys(devProjectManifestBaseline||{}).length?devProjectManifestBaseline:devProjectManifest))},sharedPath=devProjectSharedContentPath||devProjectManifest.sharedContent||"content/shared/content-library.json";files[sharedPath]=devContentClone(useCurrent?developerContentLibrary():(Object.keys(devProjectSharedBaseline||{}).length?devProjectSharedBaseline:developerContentLibrary()));for(const zone of devProjectManifest.zones||[]){if(!zone?.pack)continue;if(zone.id===devProjectZone?.id)files[zone.pack]=devContentClone(useCurrent?developerWorldPack():(Object.keys(devZoneBaselinePack||{}).length?devZoneBaselinePack:developerWorldPack()));else files[zone.pack]=await developerReadProjectJson(zone.pack);}return files;}
async function createDeveloperProjectSnapshot(reason="manual snapshot",{quiet=false,useCurrent=true,files=null}={}){try{const folder=await developerWriteSnapshotFiles(files||await developerCollectProjectSnapshotFiles({useCurrent}),reason);if(!quiet){refreshDeveloperProjectPanel();devSetStatus(`Project snapshot created → ${folder}`);}return folder;}catch(err){console.error(err);if(!quiet)devSetStatus(`Snapshot failed: ${err?.message||"unknown error"}`);throw err;}}
async function developerPersistActiveProjectSafely(reason="project save"){const dirty=developerProjectDirtyDetails(),validation=await validateDeveloperProject({quiet:true});let snapshotPath="";if(dirty.dirty)snapshotPath=await createDeveloperProjectSnapshot(`before ${reason}`,{quiet:true,useCurrent:false});await developerPersistActiveProject();developerAcceptProjectBaselines();devProjectHealthResult={...validation,fingerprint:developerProjectFingerprint()};return {dirty,validation,snapshotPath};}
function developerHealthIssue(issues,severity,message,where={}){issues.push({severity,message,...where});}
function developerNormalizeAssetPath(path){return String(path||"").replace(/^\.\//,"");}
async function developerProjectFileInfo(path){if(!path)return {exists:false,size:0};if(devProjectDirectoryHandle)try{const handle=await developerNestedFileHandle(devProjectDirectoryHandle,path),file=await handle.getFile();return {exists:true,size:file.size};}catch{return {exists:false,size:0};}try{const response=await fetch(`./${developerNormalizeAssetPath(path)}?health=${Date.now().toString(36)}`,{cache:"no-store"});return {exists:response.ok,size:Number(response.headers.get("content-length"))||0};}catch{return {exists:false,size:0};}}
function developerUsedAssetRefs(shared,zones){
  const ids=new Set(),paths=new Set();
  for(const assetId of Object.values(shared.artReferences||{}))if(assetId)ids.add(assetId);
  if(shared.characterDefaults?.defaultAppearanceAsset)ids.add(shared.characterDefaults.defaultAppearanceAsset);
  for(const mob of Object.values(shared.mobs||{}))if(mob?.spriteAsset)ids.add(mob.spriteAsset);
  for(const item of Object.values(shared.items||{}))if(item?.icon)paths.add(developerNormalizeAssetPath(item.icon));
  for(const t of Object.values(shared.objectDefinitions||{})){if(t?.sourceAssetId)ids.add(t.sourceAssetId);if(t?.sprite)paths.add(developerNormalizeAssetPath(t.sprite));}
  for(const terrain of Object.values(shared.terrains||{})){if(terrain?.textureAsset)ids.add(terrain.textureAsset);if(terrain?.decoration?.treeAsset)ids.add(terrain.decoration.treeAsset);}
  for(const pack of Object.values(zones||{})){
    for(const npc of pack?.npcs||[]){if(npc?.spriteAsset)ids.add(npc.spriteAsset);if(npc?.sprite)paths.add(developerNormalizeAssetPath(npc.sprite));}
    for(const obj of pack?.worldObjects||[]){if(obj?.sourceAssetId)ids.add(obj.sourceAssetId);if(obj?.sprite)paths.add(developerNormalizeAssetPath(obj.sprite));}
  }
  return {ids,paths};
}
function developerValidateTerrainLibrary(shared,issues){const codes=new Map();for(const [id,rec] of Object.entries(shared.terrains||{})){const where={tab:"terrain",targetId:id},code=Math.floor(Number(rec?.code));if(!Number.isFinite(code)||code<0)developerHealthIssue(issues,"error",`Terrain '${id}' has an invalid storage code`,where);else if(codes.has(code))developerHealthIssue(issues,"error",`Terrains '${codes.get(code)}' and '${id}' share storage code ${code}`,where);else codes.set(code,id);if(rec?.textureAsset&&!shared.assets?.[rec.textureAsset])developerHealthIssue(issues,"error",`Terrain '${id}' references missing texture asset '${rec.textureAsset}'`,where);const textureScale=Number(rec?.textureScale??1);if(!Number.isFinite(textureScale)||textureScale<.1||textureScale>4)developerHealthIssue(issues,"error",`Terrain '${id}' has invalid texture scale '${rec?.textureScale}' (expected 10%–400%)`,where);if(rec?.decoration?.treeAsset&&!shared.assets?.[rec.decoration.treeAsset])developerHealthIssue(issues,"error",`Terrain '${id}' references missing tree asset '${rec.decoration.treeAsset}'`,where);if(rec?.footstepSet&&!shared.audioSets?.[rec.footstepSet])developerHealthIssue(issues,"error",`Terrain '${id}' references missing footstep sound set '${rec.footstepSet}'`,{tab:"audio",targetId:rec.footstepSet});}if(!codes.size)developerHealthIssue(issues,"error","Terrain Library is empty",{tab:"terrain"});for(const [role,id] of Object.entries({ground:shared.terrainDefaults?.ground,boundary:shared.terrainDefaults?.boundary})){if(!id||!shared.terrains?.[id])developerHealthIssue(issues,"error",`Project terrain default '${role}' references missing terrain '${id||""}'`,{tab:"terrain",targetId:id||""});}return codes;}
function developerValidateQuest(quest,shared,issues,zoneId,zoneIds,npcIds){const where={tab:"quests",targetId:quest?.id,zoneId};for(const obj of quest?.objectives||[]){if(obj.type==="kill"&&!shared.mobs?.[obj.target])developerHealthIssue(issues,"error",`Quest '${quest.id}' references missing mob '${obj.target}'`,where);if(["collect","deliver"].includes(obj.type)&&!shared.items?.[obj.target])developerHealthIssue(issues,"error",`Quest '${quest.id}' references missing item '${obj.target}'`,where);if(obj.type==="talk"&&!npcIds.has(obj.target))developerHealthIssue(issues,"error",`Quest '${quest.id}' references missing NPC '${obj.target}' in this zone`,where);}for(const key of [quest?.giverNpc,quest?.turnInNpc].filter(Boolean))if(!npcIds.has(key))developerHealthIssue(issues,"error",`Quest '${quest.id}' references missing NPC '${key}' in this zone`,where);}
function developerValidateZone(zone,pack,shared,issues,zoneIds,terrainCodes){
  const zoneId=zone.id,zoneName=zone.name||zoneId,where={tab:"zones",zoneId};
  if(!pack||pack.format!=="little-realm-world-pack"||developerSchemaVersion(pack.schemaVersion)!==DEV_WORLD_SCHEMA_VERSION){developerHealthIssue(issues,"error",`${zoneName}: World Pack format/schema is invalid`,where);return;}
  const settings=pack.zoneSettings||{},width=Math.floor(numberOr(settings.width,0)),height=Math.floor(numberOr(settings.height,0));
  if(!shared.terrains?.[settings.backdropTerrainId])developerHealthIssue(issues,"error",`${zoneName}: world-beyond terrain '${settings.backdropTerrainId||""}' does not exist`,{tab:"terrain",targetId:settings.backdropTerrainId,zoneId});
  if(settings.musicId&&!shared.audioClips?.[settings.musicId])developerHealthIssue(issues,"error",`${zoneName}: music '${settings.musicId}' does not exist`,{tab:"audio",targetId:settings.musicId,zoneId});
  if(settings.ambienceId&&!shared.audioClips?.[settings.ambienceId])developerHealthIssue(issues,"error",`${zoneName}: ambience '${settings.ambienceId}' does not exist`,{tab:"audio",targetId:settings.ambienceId,zoneId});
  if(!Array.isArray(pack.terrain)||pack.terrain.length!==height||pack.terrain.some(row=>!Array.isArray(row)||row.length!==width))developerHealthIssue(issues,"error",`${zoneName}: terrain grid does not match ${width}×${height}`,where);
  else for(let y=0;y<pack.terrain.length;y++)for(let x=0;x<pack.terrain[y].length;x++)if(!terrainCodes.has(Math.floor(numberOr(pack.terrain[y][x],-999)))){developerHealthIssue(issues,"error",`${zoneName}: tile ${x},${y} uses unknown terrain code ${pack.terrain[y][x]}`,{tab:"terrain",zoneId});y=pack.terrain.length;break;}
  const spawnIds=new Set();for(const spawn of pack.mobSpawns||[]){if(spawn.id&&spawnIds.has(spawn.id))developerHealthIssue(issues,"error",`${zoneName}: duplicate spawn ID '${spawn.id}'`,{tab:"spawns",targetId:spawn.id,zoneId});spawnIds.add(spawn.id);if(!shared.mobs?.[spawn.mobType])developerHealthIssue(issues,"error",`${zoneName}: spawn '${spawn.id}' references missing mob '${spawn.mobType}'`,{tab:"spawns",targetId:spawn.id,zoneId});}
  const npcIds=new Set();for(const npc of pack.npcs||[]){
    if(npc.id&&npcIds.has(npc.id))developerHealthIssue(issues,"error",`${zoneName}: duplicate NPC ID '${npc.id}'`,{tab:"npcs",zoneId});npcIds.add(npc.id);
    const direct=shared.assets?.[npc?.spriteAsset],path=developerNormalizeAssetPath(npc?.sprite),byPath=Object.values(shared.assets||{}).find(a=>a?.type==="npcSprite"&&developerNormalizeAssetPath(a.path)===path),asset=direct||byPath;
    if(!asset||asset.type!=="npcSprite")developerHealthIssue(issues,"error",`${zoneName}: NPC '${npc.id||npc.name||"NPC"}' needs a valid NPC Sprite asset`,{tab:"npcs",zoneId});
  }
  const questIds=new Set();for(const quest of pack.quests||[]){if(quest.id&&questIds.has(quest.id))developerHealthIssue(issues,"error",`${zoneName}: duplicate quest ID '${quest.id}'`,{tab:"quests",targetId:quest.id,zoneId});questIds.add(quest.id);developerValidateQuest(quest,shared,issues,zoneId,zoneIds,npcIds);}
  for(const obj of pack.worldObjects||[]){
    if(!obj.objectId||!shared.objectDefinitions?.[obj.objectId])developerHealthIssue(issues,"error",`${zoneName}: object '${obj.id}' references missing Object Library entry '${obj.objectId||""}'`,{tab:"objects",targetId:obj.id,zoneId});
    const action=obj?.interaction?.actions||{},target=action.targetZone;if(target&&!zoneIds.has(target))developerHealthIssue(issues,"error",`${zoneName}: object '${obj.id}' travels to missing zone '${target}'`,{tab:"objects",targetId:obj.id,zoneId});
    if(action.lootTable&&!shared.lootTables?.[action.lootTable])developerHealthIssue(issues,"error",`${zoneName}: object '${obj.id}' references missing loot table '${action.lootTable}'`,{tab:"objects",targetId:obj.id,zoneId});
    for(const questId of Array.isArray(action.questIds)?action.questIds:[])if(!questIds.has(questId))developerHealthIssue(issues,"error",`${zoneName}: object '${obj.id}' offers missing quest '${questId}'`,{tab:"objects",targetId:obj.id,zoneId});
    if(obj?.interaction?.type==="open"&&action.openMode==="storage"&&(!Number.isFinite(Number(obj.capacity))||Number(obj.capacity)<1))developerHealthIssue(issues,"error",`${zoneName}: storage object '${obj.id}' needs at least 1 storage slot`,{tab:"objects",targetId:obj.id,zoneId});
    const interactionSound=obj?.interaction?.soundId;if(interactionSound&&!shared.audioClips?.[interactionSound]&&!shared.audioSets?.[interactionSound])developerHealthIssue(issues,"error",`${zoneName}: object '${obj.id}' references missing interaction sound '${interactionSound}'`,{tab:"audio",targetId:interactionSound,zoneId});
    const emitterSound=obj?.soundEmitter?.clipId;if(emitterSound&&!shared.audioClips?.[emitterSound])developerHealthIssue(issues,"error",`${zoneName}: object '${obj.id}' references missing emitter sound '${emitterSound}'`,{tab:"audio",targetId:emitterSound,zoneId});
  }
}
async function developerReadProjectJsonForHealth(path){if(devProjectDirectoryHandle)return developerReadProjectJson(path);const response=await fetch(`./${path}?health=${Date.now().toString(36)}`,{cache:"no-store"});if(!response.ok)throw new Error(`${path} HTTP ${response.status}`);return response.json();}
async function validateDeveloperProject({quiet=false}={}){if(devProjectValidationRunning)return devProjectHealthResult||{issues:[],errors:0,warnings:0};devProjectValidationRunning=true;refreshDeveloperProjectHealthPanel();try{const issues=[],manifest=devProjectManifest||{},shared=developerContentLibrary(),zoneList=manifest.zones||[],zoneIds=new Set(),zones={};if(manifest.format!=="little-realm-project"||developerSchemaVersion(manifest.schemaVersion)!==DEV_PROJECT_SCHEMA_VERSION)developerHealthIssue(issues,"error",`Project schema must be v${DEV_PROJECT_SCHEMA_VERSION}`,{tab:"project"});if(shared.format!=="little-realm-content-library"||developerSchemaVersion(shared.schemaVersion)!==DEV_SHARED_SCHEMA_VERSION)developerHealthIssue(issues,"error",`Shared schema must be v${DEV_SHARED_SCHEMA_VERSION}`,{tab:"content"});for(const zone of zoneList){if(!zone?.id||zoneIds.has(zone.id))developerHealthIssue(issues,"error",`Invalid or duplicate zone ID '${zone?.id||""}'`,{tab:"zones"});else zoneIds.add(zone.id);}if(manifest.defaultZone&&!zoneIds.has(manifest.defaultZone))developerHealthIssue(issues,"error",`Default zone '${manifest.defaultZone}' does not exist`,{tab:"zones"});for(const [tableId,value] of Object.entries(shared.lootTables||{})){const entries=Array.isArray(value)?value:value?.entries||[];for(const entry of entries)if(!shared.items?.[entry?.itemId])developerHealthIssue(issues,"error",`Loot table '${tableId}' references missing item '${entry?.itemId||""}'`,{tab:"content",contentType:"lootTables",targetId:tableId});}for(const [mobId,mob] of Object.entries(shared.mobs||{})){if(!mob?.spriteAsset||!shared.assets?.[mob.spriteAsset])developerHealthIssue(issues,"error",`Mob '${mobId}' needs a valid Mob Sprite asset`,{tab:"content",contentType:"mobs",targetId:mobId});if(!Number.isFinite(Number(mob?.displayHeight))||Number(mob.displayHeight)<8)developerHealthIssue(issues,"error",`Mob '${mobId}' needs a valid normalized display height`,{tab:"content",contentType:"mobs",targetId:mobId});if(!mob?.sizeClass)developerHealthIssue(issues,"warning",`Mob '${mobId}' has no world size class`,{tab:"content",contentType:"mobs",targetId:mobId});if(mob?.lootTable&&!shared.lootTables?.[mob.lootTable])developerHealthIssue(issues,"error",`Mob '${mobId}' references missing loot table '${mob.lootTable}'`,{tab:"content",contentType:"mobs",targetId:mobId});for(const [soundKey,ref] of Object.entries(mob?.audio||{}))if(ref&&!shared.audioClips?.[ref]&&!shared.audioSets?.[ref])developerHealthIssue(issues,"error",`Mob '${mobId}' ${soundKey} sound references missing audio '${ref}'`,{tab:"audio",targetId:ref});}for(const [id,t] of Object.entries(shared.objectDefinitions||{})){if(!t?.sourceAssetId||!shared.assets?.[t.sourceAssetId])developerHealthIssue(issues,"error",`Object '${id}' needs a valid source asset`,{tab:"objects",targetId:id});if(!Number.isFinite(Number(t?.w))||Number(t.w)<8||!Number.isFinite(Number(t?.h))||Number(t.h)<8)developerHealthIssue(issues,"error",`Object '${id}' needs valid display dimensions`,{tab:"objects",targetId:id});}for(const [role,assetId] of Object.entries(shared.artReferences||{})){if(!assetId)continue;const asset=shared.assets?.[assetId];if(!DEV_ART_REFERENCE_ROLES?.[role])developerHealthIssue(issues,"warning",`Unknown art reference role '${role}'`,{tab:"assets"});else if(!asset)developerHealthIssue(issues,"error",`${DEV_ART_REFERENCE_ROLES[role].label} references missing asset '${assetId}'`,{tab:"assets",targetId:assetId});}developerValidateCharacterRigHealth(shared,issues);const terrainCodes=developerValidateTerrainLibrary(shared,issues);for(const zone of zoneList){try{const pack=zone.id===devProjectZone?.id?developerWorldPack():await developerReadProjectJsonForHealth(zone.pack);zones[zone.id]=pack;developerValidateZone(zone,pack,shared,issues,zoneIds,terrainCodes);}catch(err){developerHealthIssue(issues,"error",`${zone.name||zone.id}: ${err?.message||"zone file could not be read"}`,{tab:"zones",zoneId:zone.id});}}for(const [setId,set] of Object.entries(shared.audioSets||{})){for(const clipId of set?.clipIds||[])if(!shared.audioClips?.[clipId])developerHealthIssue(issues,"error",`Sound set '${setId}' references missing clip '${clipId}'`,{tab:"audio",targetId:setId});}
for(const [eventId,ref] of Object.entries(shared.audioEvents||{}))if(ref&&!shared.audioClips?.[ref]&&!shared.audioSets?.[ref])developerHealthIssue(issues,"error",`Game sound event '${eventId}' references missing audio '${ref}'`,{tab:"audio",targetId:ref});
for(const [clipId,clip] of Object.entries(shared.audioClips||{})){const path=developerNormalizeAssetPath(clip?.path),where={tab:"audio",targetId:clipId};if(!path){developerHealthIssue(issues,"error",`Audio clip '${clipId}' has no project path`,where);continue;}if(!/\.(mp3|ogg|wav)$/i.test(path))developerHealthIssue(issues,"warning",`Audio clip '${clipId}' uses unsupported/suspicious extension: ${path}`,where);const info=await developerProjectFileInfo(path);if(!info.exists)developerHealthIssue(issues,"error",`Audio clip '${clipId}' is missing: ${path}`,where);const bytes=info.size||Number(clip?.bytes)||0;if(bytes>10*1024*1024)developerHealthIssue(issues,"advisory",`Audio clip '${clipId}' is large (${(bytes/1024/1024).toFixed(1)} MB)`,where);}
const used=developerUsedAssetRefs(shared,zones),pathOwners=new Map();for(const [assetId,asset] of Object.entries(shared.assets||{})){const path=developerNormalizeAssetPath(asset?.path),where={tab:"assets",targetId:assetId};if(!path){developerHealthIssue(issues,"error",`Asset '${assetId}' has no project path`,where);continue;}if(pathOwners.has(path))developerHealthIssue(issues,"warning",`Assets '${pathOwners.get(path)}' and '${assetId}' use the same file: ${path}`,where);else pathOwners.set(path,assetId);if(!/\.(png|webp|jpe?g)$/i.test(path))developerHealthIssue(issues,"warning",`Asset '${assetId}' uses a suspicious image extension: ${path}`,where);const info=await developerProjectFileInfo(path);if(!info.exists)developerHealthIssue(issues,"error",`Asset '${assetId}' is missing: ${path}`,where);const bytes=info.size||Number(asset?.bytes)||0;if(bytes>3*1024*1024)developerHealthIssue(issues,"advisory",`Asset '${assetId}' is large (${(bytes/1024/1024).toFixed(1)} MB)`,where);if(asset?.type==="mobSprite"&&!asset?.analysis?.frameMetrics?.referenceVisibleHeight)developerHealthIssue(issues,"advisory",`Mob sprite asset '${assetId}' has not been analyzed for normalized visible height`,where);const isUsed=used.ids.has(assetId)||used.paths.has(path);if(asset?.imported&&!isUsed)developerHealthIssue(issues,"advisory",`Imported asset '${assetId}' is currently unused`,where);}devProjectHealthResult={checkedAt:new Date().toISOString(),fingerprint:developerProjectFingerprint(),issues,errors:issues.filter(i=>i.severity==="error").length,warnings:issues.filter(i=>i.severity==="warning").length,advisories:issues.filter(i=>i.severity==="advisory").length,zones:zoneList.length,complete:!!devProjectDirectoryHandle};if(!quiet)devSetStatus(devProjectHealthResult.errors?`Project validation found ${devProjectHealthResult.errors} error(s) and ${devProjectHealthResult.warnings} warning(s)`:devProjectHealthResult.warnings?`Project valid with ${devProjectHealthResult.warnings} warning(s)`:`Project healthy${devProjectHealthResult.advisories?` • ${devProjectHealthResult.advisories} advisory note${devProjectHealthResult.advisories===1?"":"s"}`:""}`);return devProjectHealthResult;}catch(err){console.error(err);devProjectHealthResult={checkedAt:new Date().toISOString(),fingerprint:"",issues:[{severity:"error",message:err?.message||"Project validation failed",tab:"project"}],errors:1,warnings:0,advisories:0,zones:0,complete:false};if(!quiet)devSetStatus(`Validation failed: ${err?.message||"unknown"}`);return devProjectHealthResult;}finally{devProjectValidationRunning=false;refreshDeveloperProjectPanel();}}
function developerHealthNavigate(issue){if(!issue)return;if(issue.zoneId&&issue.zoneId!==devProjectZone?.id){devZoneSelectedId=issue.zoneId;setDeveloperTab("zones");refreshDeveloperZonePanel();devSetStatus(`Issue is in ${developerZoneById(issue.zoneId)?.name||issue.zoneId}. Open that zone to edit it.`);return;}if(issue.tab)setDeveloperTab(issue.tab);if(issue.tab==="assets"&&issue.targetId){devAssetSelectedId=issue.targetId;refreshDeveloperAssetPanel();}if(issue.tab==="audio"&&issue.targetId){if(devAudioClips?.[issue.targetId])devAudioSelectedId=issue.targetId;else if(devAudioSets?.[issue.targetId])devAudioSelectedSetId=issue.targetId;refreshDeveloperAudioPanel();}if(issue.tab==="terrain"&&issue.targetId){devTerrainSelectedId=issue.targetId;if(devTerrains[issue.targetId])devTerrainBrush=issue.targetId;refreshDeveloperTerrainPanel();}if(issue.tab==="spawns"&&issue.targetId){devSelectedSpawnId=issue.targetId;refreshDeveloperSpawnPanel();}if(issue.tab==="quests"&&issue.targetId){devSelectedQuestId=issue.targetId;devQuestFormDraft=null;refreshDeveloperQuestPanel();}if(issue.tab==="content"){if(issue.contentType)devContentType=issue.contentType;if(issue.targetId)devContentSelectedId=issue.targetId;refreshDeveloperContentPanel();}}
function refreshDeveloperProjectHealthPanel(){if(!devPanel)return;const root=devPanel.querySelector("#devProjectHealth");if(!root)return;const dirty=developerProjectDirtyDetails(),result=devProjectHealthResult,stale=!!result&&result.fingerprint!==developerProjectFingerprint(),healthState=devProjectValidationRunning?"checking":!result?"unknown":stale?"stale":result.errors?"error":result.warnings?"warning":"healthy",stateLabel=({checking:"Checking…",unknown:"Not validated",stale:"Needs recheck",error:`${result?.errors||0} error${result?.errors===1?"":"s"}`,warning:`${result?.warnings||0} warning${result?.warnings===1?"":"s"}`,healthy:"Healthy"})[healthState],counts={zones:(devProjectManifest?.zones||[]).length,npcs:sceneryNPCs.length,mobs:Object.keys(BALANCE.mobs||{}).length,items:Object.keys(ITEM_DEFS||{}).length,terrains:Object.keys(devTerrains||{}).length,quests:questDefinitions.length,assets:Object.keys(devAssets||{}).length,audio:Object.keys(devAudioClips||{}).length};root.innerHTML=`<div class="devHealthTop"><span class="devHealthBadge ${healthState}">${devContentEscape(stateLabel)}</span><span class="devDirtyBadge ${dirty.dirty?"dirty":"clean"}">${dirty.dirty?"● Unsaved Changes":"✓ Saved to project"}</span></div><div class="devHealthGrid"><div><span>Project Schema</span><b>v${DEV_PROJECT_SCHEMA_VERSION}</b></div><div><span>Builder</span><b>Character Creator</b></div><div><span>Default Zone</span><b>${devContentEscape(devProjectManifest?.defaultZone||"—")}</b></div><div><span>Zones</span><b>${counts.zones}</b></div><div><span>Terrains</span><b>${counts.terrains}</b></div><div><span>Active Zone NPCs</span><b>${counts.npcs}</b></div><div><span>Mob Types</span><b>${counts.mobs}</b></div><div><span>Items</span><b>${counts.items}</b></div><div><span>Active Quests</span><b>${counts.quests}</b></div><div><span>Assets</span><b>${counts.assets}</b></div><div><span>Audio Clips</span><b>${counts.audio}</b></div></div><div class="devProjectBig devHealthActions"><button id="devValidateProject" class="primary" ${devProjectValidationRunning?"disabled":""}>${devProjectValidationRunning?"Validating…":"Validate Project"}</button><button id="devSnapshotProject" ${devProjectDirectoryHandle?"":"disabled"}>Create Snapshot</button><button id="devHealthSaveProject" ${devProjectDirectoryHandle?"":"disabled"}>Save Project</button></div>${result?.advisories?`<div class="devHint" style="margin-top:8px">${result.advisories} advisory note${result.advisories===1?"":"s"} (informational only)</div>`:""}${devLastSnapshotPath?`<div class="devHint" style="margin-top:8px">Snapshot: <b>${devContentEscape(devLastSnapshotPath)}</b></div>`:""}<div id="devHealthIssueList" class="devHealthIssueList"></div>`;root.querySelector("#devValidateProject")?.addEventListener("click",()=>validateDeveloperProject());root.querySelector("#devSnapshotProject")?.addEventListener("click",()=>createDeveloperProjectSnapshot("manual snapshot"));root.querySelector("#devHealthSaveProject")?.addEventListener("click",saveDeveloperProjectFolder);const list=root.querySelector("#devHealthIssueList");if(!result)list.innerHTML='<div class="devEmpty">Run Validate Project to check project references and files.</div>';else if(!result.issues.length)list.innerHTML='<div class="devHealthClean">✓ No project problems</div>';else list.innerHTML=result.issues.map((issue,index)=>`<div class="devHealthIssue ${issue.severity}"><span class="devHealthIcon">${issue.severity==="error"?"×":issue.severity==="warning"?"!":"i"}</span><span>${devContentEscape(issue.message)}</span>${issue.tab?`<button data-health-issue="${index}">Go To</button>`:""}</div>`).join("");list.querySelectorAll("[data-health-issue]").forEach(button=>button.onclick=()=>developerHealthNavigate(result.issues[Number(button.dataset.healthIssue)]));}

function developerZoneSlug(value){
  const id=String(value||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  return id||"new-zone";
}

function developerZoneById(id){
  return (devProjectManifest?.zones||[]).find(zone=>zone.id===id)||null;
}

function developerResizeZoneTerrain(source,width,height){
  const out=makeBlankZoneTerrain(width,height),valid=new Set(Object.values(devTerrains||{}).map(rec=>Math.floor(numberOr(rec?.code,-999))));
  if(Array.isArray(source))for(let y=0;y<Math.min(height,source.length);y++){if(!Array.isArray(source[y]))continue;for(let x=0;x<Math.min(width,source[y].length);x++){const v=Math.floor(numberOr(source[y][x],terrainDefaultCode()));out[y][x]=valid.has(v)?v:terrainDefaultCode();}}
  return out;
}

function developerNewZonePack({width,height,startTileX,startTileY,template="blank",backdropTerrainId=""}){
  const source=template==="copy"?developerWorldPack():null,zoneBalance=devBalanceClone(BALANCE);delete zoneBalance.mobs;
  const beyond=template==="copy"?String(source?.zoneSettings?.backdropTerrainId||developerZoneBackdropTerrainId()):String(backdropTerrainId||developerZoneBackdropTerrainId());
  return {format:"little-realm-world-pack",schemaVersion:DEV_WORLD_SCHEMA_VERSION,build:DEV_BUILDER_VERSION,exportedAt:new Date().toISOString(),zoneSettings:{width,height,startTileX,startTileY,backdropTerrainId:devTerrains[beyond]?beyond:(Object.keys(devTerrains)[0]||""),musicId:template==="copy"?String(source?.zoneSettings?.musicId||""):"",musicVolume:template==="copy"?numberOr(source?.zoneSettings?.musicVolume,1):1,ambienceId:template==="copy"?String(source?.zoneSettings?.ambienceId||""):"",ambienceVolume:template==="copy"?numberOr(source?.zoneSettings?.ambienceVolume,1):1},terrain:developerResizeZoneTerrain(source?.terrain,width,height),worldObjects:template==="copy"?devContentClone(source.worldObjects):[],npcs:template==="copy"?devContentClone(source.npcs):[],quests:template==="copy"?devContentClone(source.quests):[],mobSpawns:template==="copy"?devContentClone(source.mobSpawns):[],visualSettings:template==="copy"?devContentClone(source.visualSettings):{...VISUAL_SCALE,remnants:{...LOOT_REMNANT_VISUAL}},balance:template==="copy"?devContentClone(source.balance):zoneBalance};
}

async function developerRemoveProjectDirectory(path){
  const parts=String(path||"").split("/").filter(Boolean);if(!parts.length)return;
  let dir=devProjectDirectoryHandle;
  for(const part of parts.slice(0,-1))dir=await dir.getDirectoryHandle(part);
  await dir.removeEntry(parts[parts.length-1],{recursive:true});
}

async function switchDeveloperZone(id,{saveCurrent=true}={}){
  const zone=developerZoneById(id);if(!zone?.pack){devSetStatus("That zone is not available in the project manifest");return;}
  if(zone.id===devProjectZone?.id){devZoneSelectedId=zone.id;refreshDeveloperZonePanel();return;}
  if(!devProjectDirectoryHandle){devSetStatus("Open the Little Realm Project Folder before switching zones");return;}
  try{
    developerPersistCameraForZone();
    if(saveCurrent&&devProjectZone?.pack)await developerPersistActiveProjectSafely("zone switch");
    const pack=await developerReadProjectJson(zone.pack);
    devProjectZone=zone;devZoneSelectedId=zone.id;devZoneBaselinePack=devContentClone(pack);
    applyDeveloperWorldPack(pack,{quiet:true,zoneSwitch:true});
    developerRestoreCameraForZone();
    saveDeveloperDraft();refreshDeveloperPanel();
    devSetStatus(`Opened zone: ${zone.name||zone.id} • ${WORLD_W}×${WORLD_H} tiles`);
  }catch(err){console.error(err);devSetStatus(`Zone could not be opened: ${err?.message||"unknown error"}`);}
}

async function createDeveloperZone(){
  const root=devPanel?.querySelector("#devZoneCreate");if(!root)return;
  if(!devProjectDirectoryHandle||!devProjectManifest){devSetStatus("Open the Little Realm Project Folder before creating a zone");return;}
  const name=String(root.querySelector("#devNewZoneName")?.value||"").trim()||"New Zone";
  const id=developerZoneSlug(root.querySelector("#devNewZoneId")?.value||name);
  if(developerZoneById(id)){devSetStatus(`Zone ID '${id}' already exists`);return;}
  const width=Math.max(12,Math.min(128,Math.floor(numberOr(root.querySelector("#devNewZoneWidth")?.value,44))));
  const height=Math.max(12,Math.min(96,Math.floor(numberOr(root.querySelector("#devNewZoneHeight")?.value,32))));
  const startTileX=Math.max(2,Math.min(width-3,Math.floor(numberOr(root.querySelector("#devNewZoneStartX")?.value,Math.min(7,width-3)))));
  const startTileY=Math.max(2,Math.min(height-3,Math.floor(numberOr(root.querySelector("#devNewZoneStartY")?.value,Math.min(7,height-3)))));
  const template=root.querySelector("#devNewZoneTemplate")?.value||"blank";
  const backdropTerrainId=root.querySelector("#devNewZoneBackdrop")?.value||developerZoneBackdropTerrainId();
  const packPath=`content/zones/${id}/world-pack.json`;
  try{
    if(devProjectZone?.pack)await developerPersistActiveProjectSafely("new zone creation");
    const pack=developerNewZonePack({width,height,startTileX,startTileY,template,backdropTerrainId});
    await developerWriteProjectJson(packPath,pack);
    const zone={id,name,pack:packPath,width,height,startTileX,startTileY};
    devProjectManifest.zones=Array.isArray(devProjectManifest.zones)?devProjectManifest.zones:[];
    devProjectManifest.zones.push(zone);
    await developerPersistProjectManifest();
    devZoneSelectedId=id;
    await switchDeveloperZone(id,{saveCurrent:false});
    devSetStatus(`Created ${name} • ${width}×${height} tiles • ${template==="copy"?"copied from previous zone":"blank grass zone"}`);
  }catch(err){console.error(err);devSetStatus(`Zone creation failed: ${err?.message||"unknown error"}`);}
}

async function saveDeveloperZoneMetadata(){
  const zone=developerZoneById(devZoneSelectedId);if(!zone)return;
  if(!devProjectDirectoryHandle){devSetStatus("Open the project folder before changing zone metadata");return;}
  const root=devPanel?.querySelector("#devZoneInspector");if(!root)return;
  zone.name=String(root.querySelector("#devZoneName")?.value||zone.name||zone.id).trim()||zone.id;
  if(zone.id===devProjectZone?.id){
    const sx=Math.max(2,Math.min(WORLD_W-3,Math.floor(numberOr(root.querySelector("#devZoneStartX")?.value,START_TILE_X))));
    const sy=Math.max(2,Math.min(WORLD_H-3,Math.floor(numberOr(root.querySelector("#devZoneStartY")?.value,START_TILE_Y))));
    configureWorldDimensions({...window.LR_ZONE_SETTINGS,startTileX:sx,startTileY:sy});
    window.LR_ZONE_SETTINGS={...(window.LR_ZONE_SETTINGS||{}),width:WORLD_W,height:WORLD_H,startTileX:START_TILE_X,startTileY:START_TILE_Y};
    zone.startTileX=START_TILE_X;zone.startTileY=START_TILE_Y;zone.width=WORLD_W;zone.height=WORLD_H;
    await developerPersistActiveProjectSafely("zone settings save");
  }else await developerPersistProjectManifest();
  refreshDeveloperPanel();devSetStatus(`Saved zone settings for ${zone.name}`);
}

async function setDeveloperDefaultZone(){
  const zone=developerZoneById(devZoneSelectedId);if(!zone||!devProjectManifest)return;
  if(!devProjectDirectoryHandle){devSetStatus("Open the project folder before changing the default zone");return;}
  devProjectManifest.defaultZone=zone.id;
  try{await developerPersistProjectManifest();refreshDeveloperZonePanel();devSetStatus(`${zone.name||zone.id} is now the game's default starting zone`);}catch(err){devSetStatus(`Default zone change failed: ${err?.message||"unknown error"}`);}
}

async function deleteDeveloperZone(){
  const zone=developerZoneById(devZoneSelectedId);if(!zone||!devProjectManifest)return;
  const zones=devProjectManifest.zones||[];
  if(zones.length<=1){devSetStatus("A Little Realm project must keep at least one zone");return;}
  if(!devProjectDirectoryHandle){devSetStatus("Open the project folder before deleting a zone");return;}
  if(!confirm(`Delete zone '${zone.name||zone.id}' from the project? This removes its content/zones/${zone.id} folder.`))return;
  try{
    await createDeveloperProjectSnapshot("before deleting zone",{quiet:true,useCurrent:false});
    const next=zones.find(z=>z.id!==zone.id);
    devProjectManifest.zones=zones.filter(z=>z.id!==zone.id);
    if(devProjectManifest.defaultZone===zone.id)devProjectManifest.defaultZone=next.id;
    await developerPersistProjectManifest();
    try{await developerRemoveProjectDirectory(`content/zones/${zone.id}`);}catch(err){console.warn("Zone folder could not be removed automatically",err);}
    devZoneSelectedId=next.id;
    if(devProjectZone?.id===zone.id)await switchDeveloperZone(next.id,{saveCurrent:false});
    else refreshDeveloperPanel();
    devSetStatus(`Deleted zone: ${zone.name||zone.id}`);
  }catch(err){console.error(err);devSetStatus(`Zone deletion failed: ${err?.message||"unknown error"}`);}
}

function refreshDeveloperZonePanel(){
  if(!devPanel)return;
  const list=devPanel.querySelector("#devZoneList"),inspector=devPanel.querySelector("#devZoneInspector"),summary=devPanel.querySelector("#devZoneSummary");
  if(!list||!inspector)return;
  const newBackdrop=devPanel.querySelector("#devNewZoneBackdrop");if(newBackdrop){const current=newBackdrop.value||developerZoneBackdropTerrainId();newBackdrop.innerHTML=Object.entries(devTerrains||{}).map(([id,rec])=>`<option value="${devContentEscape(id)}" ${id===current?"selected":""}>${devContentEscape(rec.name||id)}</option>`).join("");}
  const zones=devProjectManifest?.zones||[];
  if(!devZoneSelectedId||!developerZoneById(devZoneSelectedId))devZoneSelectedId=devProjectZone?.id||zones[0]?.id||null;
  if(summary)summary.textContent=`${devProjectManifest?.name||"Little Realm"} • ${zones.length} zone${zones.length===1?"":"s"} • ${devProjectDirectoryHandle?"project folder connected":"connect the project folder to create/switch zones"}`;
  list.innerHTML=zones.map(zone=>`<button class="devZoneChip ${zone.id===devZoneSelectedId?"active":""}" data-zone-id="${devContentEscape(zone.id)}"><b>${devContentEscape(zone.name||zone.id)}</b><span>${devContentEscape(zone.id)}${zone.id===devProjectZone?.id?" • ACTIVE":""}${zone.id===devProjectManifest?.defaultZone?" • DEFAULT":""}</span></button>`).join("")||'<div class="devEmpty">No zones are declared in this project.</div>';
  list.querySelectorAll("[data-zone-id]").forEach(button=>button.onclick=()=>{devZoneSelectedId=button.dataset.zoneId;refreshDeveloperZonePanel();});
  const zone=developerZoneById(devZoneSelectedId);
  if(!zone){inspector.innerHTML='<div class="devEmpty">Choose a zone.</div>';return;}
  const active=zone.id===devProjectZone?.id;
  const settings=active?((typeof window!=="undefined"&&window.LR_ZONE_SETTINGS)||{}):zone;
  const width=Math.floor(numberOr(settings.width,zone.width||44)),height=Math.floor(numberOr(settings.height,zone.height||32));
  const sx=Math.floor(numberOr(settings.startTileX,zone.startTileX||7)),sy=Math.floor(numberOr(settings.startTileY,zone.startTileY||7));
  inspector.innerHTML=`<div class="devSelectedTitle">ZONE • ${devContentEscape(zone.name||zone.id)}</div><div class="devHint">Zone IDs/folder paths stay stable after creation. Display name and the active zone's player start can be changed here.</div><div class="devPair"><label>Name<input id="devZoneName" value="${devContentEscape(zone.name||zone.id)}"></label><label>ID<input value="${devContentEscape(zone.id)}" readonly></label></div><div class="devPair"><label>Width (tiles)<input value="${width}" readonly></label><label>Height (tiles)<input value="${height}" readonly></label></div><div class="devPair"><label>Start Tile X<input id="devZoneStartX" type="number" min="2" max="${Math.max(2,width-3)}" value="${sx}" ${active?"":"disabled"}></label><label>Start Tile Y<input id="devZoneStartY" type="number" min="2" max="${Math.max(2,height-3)}" value="${sy}" ${active?"":"disabled"}></label></div><div class="devZoneBadges"><span>${active?"Active in Builder":"Inactive"}</span><span>${zone.id===devProjectManifest?.defaultZone?"Production Default":"Not Default"}</span></div><div class="devRow">${active?'<button id="devZoneSaveMeta" class="primary">Save Zone Settings</button>':'<button id="devZoneOpen" class="primary">Open Zone</button>'}<button id="devZoneDefault">Set Default</button></div>${active?'<div class="devRow"><button id="devZoneStartPlayer">Set Start From Player</button><button id="devZoneMovePlayer">Move Player To Start</button></div>':""}<div class="devRow"><button id="devZoneDelete" class="danger">Delete Zone</button></div>`;
  inspector.querySelector("#devZoneOpen")?.addEventListener("click",()=>switchDeveloperZone(zone.id));
  inspector.querySelector("#devZoneSaveMeta")?.addEventListener("click",saveDeveloperZoneMetadata);
  inspector.querySelector("#devZoneDefault")?.addEventListener("click",setDeveloperDefaultZone);
  inspector.querySelector("#devZoneDelete")?.addEventListener("click",deleteDeveloperZone);
  inspector.querySelector("#devZoneStartPlayer")?.addEventListener("click",()=>{const x=Math.max(2,Math.min(WORLD_W-3,Math.floor(state.x/TILE))),y=Math.max(2,Math.min(WORLD_H-3,Math.floor(state.y/TILE)));inspector.querySelector("#devZoneStartX").value=x;inspector.querySelector("#devZoneStartY").value=y;devSetStatus(`Start marker staged at tile ${x}, ${y} — click Save Zone Settings`);});
  inspector.querySelector("#devZoneMovePlayer")?.addEventListener("click",()=>{state.x=START_X;state.y=START_Y;lastSafePos={x:START_X,y:START_Y};devSetStatus(`Player moved to zone start tile ${START_TILE_X}, ${START_TILE_Y}`);});
}

async function createDeveloperInteriorForSelection(){
  const obj=devSelected;
  if(!obj){devSetStatus("Select a building or world object first");return;}
  if(!devProjectDirectoryHandle||!devProjectManifest||!devProjectZone){devSetStatus("Open the Little Realm Project Folder before creating an interior");return;}
  const sourceZone=devProjectZone,label=String(obj.label||worldObjectDefinition(obj)?.name||obj.objectId||"Building").trim();
  let id=developerZoneSlug(`${sourceZone.id}-${label}-interior`),n=2;const root=id;while(developerZoneById(id))id=`${root}-${n++}`;
  const name=`${label} Interior`,width=20,height=16,startTileX=10,startTileY=13;
  const spec=worldObjectSpec(obj)||{w:48,h:48},cfg=worldObjectInteraction(obj),area=ensureDeveloperInteractionArea(obj)||cfg.area;
  const returnX=Math.round(obj.x+area.x+area.w/2),returnY=Math.round(obj.y+spec.h+20);
  const pack=developerNewZonePack({width,height,startTileX,startTileY,template:"blank",backdropTerrainId:developerZoneBackdropTerrainId()});
  const exitX=startTileX*TILE-24,exitY=(startTileY-1)*TILE-44;
  pack.worldObjects=[{
    id:`exit-${id}`,type:"gate",x:exitX,y:exitY,solid:false,hitbox:{x:4,y:29,w:40,h:14},depthMode:"ysort",depthY:44,
    interactable:true,label:`Exit to ${sourceZone.name||sourceZone.id}`,capacity:8,contents:[],interactionTag:`exit-${id}`,
    interaction:{enabled:true,type:"enter",prompt:"Exit",range:72,clickable:true,keyable:true,tag:`exit-${id}`,area:{x:4,y:18,w:40,h:26},
      requirements:{questId:"",questState:"active",itemId:"",itemQty:1},actions:{targetZone:sourceZone.id,targetX:returnX,targetY:returnY,giveItemId:"",giveItemQty:1,lootTable:"",consumeRequiredItem:false,message:""},
      useMode:"repeatable",resetSeconds:30,hideWhenUsed:false}
  }];
  const packPath=`content/zones/${id}/world-pack.json`,zone={id,name,pack:packPath,width,height,startTileX,startTileY};
  try{
    await createDeveloperProjectSnapshot("before create linked interior",{quiet:true,useCurrent:false});
    await developerWriteProjectJson(packPath,pack);
    devProjectManifest.zones=Array.isArray(devProjectManifest.zones)?devProjectManifest.zones:[];devProjectManifest.zones.push(zone);
    await developerPersistProjectManifest();
    obj.interactable=true;obj.interaction={...cfg,enabled:true,type:"enter",prompt:cfg.type==="enter"?cfg.prompt:`Enter ${label}`,area:{...area},tag:cfg.tag||obj.id,
      requirements:{...cfg.requirements},actions:{...cfg.actions,targetZone:id,targetX:null,targetY:null}};obj.interactionTag=obj.interaction.tag;
    await developerPersistActiveProject({saveManifest:false});developerAcceptProjectBaselines();
    devProjectHealthResult=await validateDeveloperProject({quiet:true});
    devZoneSelectedId=id;await switchDeveloperZone(id,{saveCurrent:false});
    devSetStatus(`Created and linked ${name} • an Exit object returns to ${sourceZone.name||sourceZone.id}`);
  }catch(err){console.error(err);devSetStatus(`Interior creation failed: ${err?.message||"unknown error"}`);}
}

function developerTerrainRecord(id=devTerrainBrush){
  return devTerrains?.[String(id||"")]||null;
}
function developerTerrainType(id=devTerrainBrush){
  const key=String(id||"");const rec=developerTerrainRecord(key);
  return rec?{id:key,name:rec.name||key,note:developerTerrainBehaviorSummary(rec),color:rec.color||"#777",code:Math.floor(numberOr(rec.code,0))}:{id:key,name:key||"Terrain",note:"",color:"#777",code:terrainDefaultCode()};
}
function developerTerrainColor(id=devTerrainBrush){return developerTerrainType(id).color;}
function developerTerrainCode(id=devTerrainBrush){const rec=developerTerrainRecord(id);return rec?Math.floor(numberOr(rec.code,terrainDefaultCode())):terrainDefaultCode();}
function developerTerrainIdForCode(code){return terrainIdByCode(code)||Object.keys(devTerrains)[0]||"";}
function developerDefaultGroundTerrainId(){const id=String(devTerrainDefaults?.ground||"");return developerTerrainRecord(id)?id:Object.keys(devTerrains).find(key=>devTerrains[key]?.walkable!==false)||Object.keys(devTerrains)[0]||"";}
function developerDefaultBoundaryTerrainId(){const id=String(devTerrainDefaults?.boundary||"");return developerTerrainRecord(id)?id:Object.keys(devTerrains).find(key=>devTerrains[key]?.walkable===false)||developerDefaultGroundTerrainId();}
function setDeveloperTerrainDefault(kind,id){id=String(id||"");if(!developerTerrainRecord(id)||!(["ground","boundary"].includes(kind)))return;devTerrainDefaults={...(devTerrainDefaults||{}),[kind]:id};window.LR_TERRAIN_DEFAULTS=devTerrainDefaults;saveDeveloperDraft();refreshDeveloperTerrainPanel();devSetStatus(`${kind==="ground"?"New-zone ground":"New-zone boundary"}: ${developerTerrainType(id).name}`);}
function developerTerrainBehaviorSummary(rec){
  const parts=[rec?.walkable===false?"Blocked":"Walkable"];
  if(rec?.healing)parts.push("heals HP");if(rec?.sanctuary)parts.push("sanctuary");
  const move=Math.round(numberOr(rec?.movementMultiplier,1)*100);if(move!==100)parts.push(`${move}% movement`);
  if(rec?.decoration?.type==="tree")parts.push(`${Math.round(numberOr(rec.decoration.densityPercent,50))}% trees`);
  return parts.join(" • ");
}
function developerTerrainTileAt(wx,wy){return {tx:Math.floor(wx/TILE),ty:Math.floor(wy/TILE)};}
function developerTerrainBrushBounds(tx,ty,size=devTerrainBrushSize){
  const n=Math.max(1,Math.floor(numberOr(size,1))),half=Math.floor(n/2);
  return {x1:tx-half,y1:ty-half,x2:tx+(n-half-1),y2:ty+(n-half-1)};
}
function paintDeveloperTerrainTile(tx,ty,id=devTerrainBrush){
  const code=developerTerrainCode(id),bounds=developerTerrainBrushBounds(tx,ty);let changed=false;
  for(let y=bounds.y1;y<=bounds.y2;y++){
    if(y<0||y>=WORLD_H)continue;
    for(let x=bounds.x1;x<=bounds.x2;x++){
      if(x<0||x>=WORLD_W)continue;
      if(world[y][x]!==code){world[y][x]=code;changed=true;}
    }
  }
  if(changed){devTerrainDirty=true;if(typeof window!=="undefined")window.LR_WORLD_TERRAIN=world.map(row=>row.slice());}
  return changed;
}
function beginDeveloperTerrainPaint(p,event){
  const {tx,ty}=developerTerrainTileAt(p.x,p.y);devTerrainHoverTile={tx,ty};devTerrainPainting=true;devTerrainDirty=false;devTerrainLastTileKey=null;updateDeveloperTerrainPaint(p);
  if(game?.style)game.style.cursor="crosshair";try{game.setPointerCapture?.(event.pointerId);}catch{}
  devSetStatus(`Painting ${developerTerrainType().name} • ${devTerrainBrushSize}×${devTerrainBrushSize} brush`);
}
function updateDeveloperTerrainPaint(p){
  const {tx,ty}=developerTerrainTileAt(p.x,p.y);devTerrainHoverTile={tx,ty};if(!devTerrainPainting)return;
  const key=`${tx},${ty}`;if(key===devTerrainLastTileKey)return;devTerrainLastTileKey=key;paintDeveloperTerrainTile(tx,ty);
}
function finishDeveloperTerrainPaint(event){
  if(!devTerrainPainting)return false;devTerrainPainting=false;devTerrainLastTileKey=null;try{game.releasePointerCapture?.(event.pointerId);}catch{}
  if(devTerrainDirty){rebuildGeneratedTerrainScenery();saveDeveloperDraft();refreshDeveloperTerrainPanel();devSetStatus(`Terrain updated • ${developerTerrainType().name}`);}devTerrainDirty=false;return true;
}
function setDeveloperTerrainBrush(id){
  id=String(id||"");if(!developerTerrainRecord(id))return;devTerrainBrush=id;devTerrainSelectedId=id;devPlaceType=null;devPlaceNpcAsset=null;devPlaceMobType=null;updateDevPaletteActive();refreshDeveloperTerrainPanel();devSetStatus(`Terrain brush: ${developerTerrainType().name}`);
}
function developerZoneBackdropTerrainId(){
  const requested=String((typeof window!=="undefined"&&window.LR_ZONE_SETTINGS?.backdropTerrainId)||"");
  if(developerTerrainRecord(requested))return requested;return developerDefaultGroundTerrainId();
}
function setDeveloperZoneBackdropTerrain(id){
  id=String(id||"");if(!developerTerrainRecord(id))return;
  window.LR_ZONE_SETTINGS={...(window.LR_ZONE_SETTINGS||{}),backdropTerrainId:id,width:WORLD_W,height:WORLD_H,startTileX:START_TILE_X,startTileY:START_TILE_Y};
  saveDeveloperDraft();refreshDeveloperTerrainPanel();refreshDeveloperZonePanel();devSetStatus(`World beyond zone: ${developerTerrainType(id).name}`);
}
function developerMatchZoneEdgeToBackdrop(){
  const id=developerZoneBackdropTerrainId(),code=developerTerrainCode(id);
  if(!confirm(`Paint the outer two-tile zone boundary with ${developerTerrainType(id).name}?`))return;
  for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++)if(x<=1||y<=1||x>=WORLD_W-2||y>=WORLD_H-2)world[y][x]=code;
  window.LR_WORLD_TERRAIN=world.map(row=>row.slice());rebuildGeneratedTerrainScenery();saveDeveloperDraft();refreshDeveloperTerrainPanel();devSetStatus(`Zone edge matched to ${developerTerrainType(id).name}`);
}
function developerFillTerrain({interiorOnly=false,resetBlank=false}={}){
  const brushId=devTerrainBrush,brushCode=developerTerrainCode(brushId),inside=terrainDefaultCode(),boundary=terrainBoundaryCode();
  const label=resetBlank?"reset this zone to the project default ground and boundary":`fill ${interiorOnly?"the zone interior":"the entire zone"} with ${developerTerrainType(brushId).name}`;
  if(!confirm(`Are you sure you want to ${label}?`))return;
  for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++){
    if(resetBlank){world[y][x]=(x<=1||y<=1||x>=WORLD_W-2||y>=WORLD_H-2)?boundary:inside;continue;}
    if(interiorOnly&&(x<=1||y<=1||x>=WORLD_W-2||y>=WORLD_H-2))continue;world[y][x]=brushCode;
  }
  window.LR_WORLD_TERRAIN=world.map(row=>row.slice());rebuildGeneratedTerrainScenery();saveDeveloperDraft();refreshDeveloperTerrainPanel();devSetStatus(resetBlank?"Zone terrain reset":`${interiorOnly?"Interior":"Zone"} filled with ${developerTerrainType(brushId).name}`);
}
function developerTerrainCounts(){const counts=new Map();for(const row of world)for(const value of row)counts.set(value,(counts.get(value)||0)+1);return counts;}
function developerNextTerrainCode(){const used=new Set(Object.values(devTerrains).map(rec=>Math.floor(numberOr(rec?.code,-1))));let code=0;while(used.has(code))code++;return code;}
function developerUniqueTerrainId(base){const root=devContentId(base,"new-terrain");let id=root,n=2;while(devTerrains[id])id=`${root}-${n++}`;return id;}
function developerNewTerrainRecord(name="New Terrain",textureAsset=""){
  return {name,code:developerNextTerrainCode(),color:"#777777",walkable:true,healing:false,sanctuary:false,movementMultiplier:1,renderer:"grass",edgeStyle:"none",textureAsset,textureScale:1,decoration:{type:"none"}};
}
function createDeveloperTerrain(name="New Terrain",textureAsset="",{silent=false}={}){
  const id=developerUniqueTerrainId(name);devTerrains[id]=developerNewTerrainRecord(name,textureAsset);window.LR_TERRAINS=devTerrains;devTerrainSelectedId=id;devTerrainBrush=id;if(!silent){saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`Created terrain: ${name}`);}return id;
}
function createDeveloperTerrainFromAsset(asset,assetId=devAssetSelectedId,{silent=false}={}){
  if(!asset||!assetId)return null;const name=String(asset.name||assetId).trim()||"New Terrain";const id=createDeveloperTerrain(name,assetId,{silent});if(!silent){setDeveloperTab("terrain");devSetStatus(`${name} is now a paintable terrain`);}return id;
}
function duplicateDeveloperTerrain(){
  const id=devTerrainSelectedId,src=developerTerrainRecord(id);if(!src)return;const next=developerUniqueTerrainId(`${id}-copy`);devTerrains[next]=devContentClone(src);devTerrains[next].name=`${src.name||id} Copy`;devTerrains[next].code=developerNextTerrainCode();window.LR_TERRAINS=devTerrains;devTerrainSelectedId=next;devTerrainBrush=next;saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`Duplicated terrain: ${devTerrains[next].name}`);
}
async function developerTerrainReferences(id){
  const code=developerTerrainCode(id),refs=[];
  if(world.some(row=>row.includes(code)))refs.push(`${devProjectZone?.name||devProjectZone?.id||"active zone"} tiles`);
  if(developerZoneBackdropTerrainId()===id)refs.push(`${devProjectZone?.name||devProjectZone?.id||"active zone"} world-beyond setting`);
  if(devProjectDirectoryHandle&&devProjectManifest){
    for(const zone of devProjectManifest.zones||[]){if(zone.id===devProjectZone?.id||!zone.pack)continue;try{const pack=await developerReadProjectJson(zone.pack);if(pack?.zoneSettings?.backdropTerrainId===id||pack?.terrain?.some(row=>Array.isArray(row)&&row.includes(code)))refs.push(zone.name||zone.id);}catch{}}
  }
  return refs;
}
async function deleteDeveloperTerrain(){
  const id=devTerrainSelectedId,rec=developerTerrainRecord(id);if(!rec)return;if(Object.keys(devTerrains).length<=1){devSetStatus("A project must keep at least one terrain");return;}
  const refs=await developerTerrainReferences(id);if(refs.length){devSetStatus(`${rec.name||id} is still used by: ${refs.join(", ")}`);return;}
  if(!confirm(`Delete terrain '${rec.name||id}'?`))return;delete devTerrains[id];if(devTerrainDefaults?.ground===id)devTerrainDefaults.ground=Object.keys(devTerrains).find(key=>devTerrains[key]?.walkable!==false)||Object.keys(devTerrains)[0]||"";if(devTerrainDefaults?.boundary===id)devTerrainDefaults.boundary=Object.keys(devTerrains).find(key=>devTerrains[key]?.walkable===false)||devTerrainDefaults.ground;window.LR_TERRAINS=devTerrains;window.LR_TERRAIN_DEFAULTS=devTerrainDefaults;devTerrainSelectedId=Object.keys(devTerrains)[0]||null;if(devTerrainBrush===id)devTerrainBrush=devTerrainSelectedId||"";saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`Deleted terrain: ${rec.name||id}`);
}
function developerTerrainAssetOptions(type){
  return Object.entries(devAssets||{}).filter(([,asset])=>asset?.path&&(type==="tree"?(asset.type==="treeSprite"||asset.type==="worldImage"):(asset.type==="terrainTexture"||asset.type==="worldImage"))).map(([id,asset])=>[id,asset.name||id]);
}
function developerTerrainInspectorHtml(id,rec){
  if(!id||!rec)return '<div class="devEmpty">Choose a terrain or create a new one.</div>';
  const textureOptions=[["","No texture • use engine fallback"],...developerTerrainAssetOptions("texture")],treeOptions=[["","No tree asset • use engine fallback"],...developerTerrainAssetOptions("tree")];
  const option=(value,label,current)=>`<option value="${devContentEscape(value)}" ${String(value)===String(current||"")?"selected":""}>${devContentEscape(label)}</option>`;
  const decor=rec.decoration&&typeof rec.decoration==="object"?rec.decoration:{type:"none"};
  const footstepOptions=[["","No footsteps"],...Object.entries(devAudioSets||{}).map(([setId,set])=>[setId,set?.name||setId])];
  return `<div class="devContentForm"><div class="devPair"><label>Name<input id="devTerrainName" value="${devContentEscape(rec.name||id)}"></label><label>ID<input value="${devContentEscape(id)}" readonly></label></div><div class="devPair"><label>Storage Code<input value="${Math.floor(numberOr(rec.code,0))}" readonly></label><label>Fallback Color<input id="devTerrainColor" type="color" value="${/^#[0-9a-f]{6}$/i.test(rec.color||"")?rec.color:"#777777"}"></label></div><label>Texture Asset<select id="devTerrainTexture">${textureOptions.map(([v,l])=>option(v,l,rec.textureAsset)).join("")}</select></label><div class="devPair"><label>Texture Detail Scale %<input id="devTerrainTextureScale" type="number" min="10" max="400" step="5" value="${Math.round(clamp(numberOr(rec.textureScale,1),.1,4)*100)}"></label><label>Repeat Density<input id="devTerrainScaleReadout" value="≈ ${(1/clamp(numberOr(rec.textureScale,1),.1,4)).toFixed(2)}×" readonly></label></div><div class="devHint">100% keeps the texture at its current world size. Lower values make leaves, stones, flowers, and other details smaller by repeating the texture more densely. Example: 50% ≈ 2× repeat density; 25% ≈ 4×.</div><div class="devPair"><label>Engine Fallback Appearance<select id="devTerrainRenderer">${[["grass","Grass"],["water","Water"],["dirt","Dirt"],["sand","Sand"],["rock","Rock"]].map(([v,l])=>option(v,l,rec.renderer||"grass")).join("")}</select></label><label>Edge Style<select id="devTerrainEdge">${[["none","None"],["road","Road edge"],["water","Water edge"]].map(([v,l])=>option(v,l,rec.edgeStyle||"none")).join("")}</select></label></div><div class="devChecks"><label><input id="devTerrainWalkable" type="checkbox" ${rec.walkable!==false?"checked":""}> Walkable</label><label><input id="devTerrainHealing" type="checkbox" ${rec.healing?"checked":""}> Restore HP</label><label><input id="devTerrainSanctuary" type="checkbox" ${rec.sanctuary?"checked":""}> Sanctuary</label></div><label>Movement Speed %<input id="devTerrainMove" type="number" min="10" max="300" value="${Math.round(numberOr(rec.movementMultiplier,1)*100)}"></label><div class="devHint">Sanctuary terrain prevents mobs whose home is outside it from entering or aggroing players inside. Mobs intentionally spawned on sanctuary terrain can move normally.</div><div class="devSectionTitle">Footstep Audio</div><div class="devPair"><label>Footstep Sound Set<select id="devTerrainFootstepSet">${footstepOptions.map(([v,l])=>option(v,l,rec.footstepSet||"")).join("")}</select></label><label>Footstep Volume %<input id="devTerrainFootstepVolume" type="number" min="0" max="200" value="${Math.round(numberOr(rec.footstepVolume,.55)*100)}"></label></div><div class="devRow"><button type="button" id="devTerrainPreviewFootsteps">▶ Preview Footstep</button><button type="button" id="devTerrainOpenAudio">Open Audio Library</button></div><div class="devHint">Use a Sound Set with several variations (for example grass-step-1/2/3). The game alternates/randomizes them while the player walks on this terrain.</div><div class="devSectionTitle">Generated Decoration</div><label>Decoration<select id="devTerrainDecorType">${[["none","None"],["tree","Trees"]].map(([v,l])=>option(v,l,decor.type||"none")).join("")}</select></label><div class="devPair"><label>Tree Sprite<select id="devTerrainTreeAsset">${treeOptions.map(([v,l])=>option(v,l,decor.treeAsset||"")).join("")}</select></label><label>Tree Scale<input id="devTerrainTreeScale" type="number" min="0.25" max="4" step="0.05" value="${numberOr(decor.treeScale,1)}"></label></div><div class="devPair"><label>Tree Density %<input id="devTerrainDensity" type="number" min="0" max="100" value="${Math.round(numberOr(decor.densityPercent,50))}"></label><label class="devInlineCheck"><input id="devTerrainTreeSolid" type="checkbox" ${decor.solid!==false?"checked":""}> Solid trunks</label></div><div class="devContentActions"><button id="devTerrainSave" class="primary">Save Terrain</button><button id="devTerrainDuplicate">Duplicate</button><button id="devTerrainDelete" class="danger">Delete</button></div></div>`;
}
function saveDeveloperTerrainFromInspector(){
  const root=devPanel?.querySelector("#devTerrainInspector"),id=devTerrainSelectedId,rec=developerTerrainRecord(id);if(!root||!rec)return;
  const decorType=root.querySelector("#devTerrainDecorType")?.value||"none";
  rec.name=String(root.querySelector("#devTerrainName")?.value||id).trim()||id;rec.color=root.querySelector("#devTerrainColor")?.value||"#777777";rec.textureAsset=root.querySelector("#devTerrainTexture")?.value||"";rec.textureScale=clamp(numberOr(root.querySelector("#devTerrainTextureScale")?.value,100)/100,.1,4);rec.renderer=root.querySelector("#devTerrainRenderer")?.value||"grass";rec.edgeStyle=root.querySelector("#devTerrainEdge")?.value||"none";rec.walkable=!!root.querySelector("#devTerrainWalkable")?.checked;rec.healing=!!root.querySelector("#devTerrainHealing")?.checked;rec.sanctuary=!!root.querySelector("#devTerrainSanctuary")?.checked;rec.movementMultiplier=Math.max(.1,numberOr(root.querySelector("#devTerrainMove")?.value,100)/100);rec.footstepSet=root.querySelector("#devTerrainFootstepSet")?.value||"";rec.footstepVolume=Math.max(0,Math.min(2,numberOr(root.querySelector("#devTerrainFootstepVolume")?.value,55)/100));rec.decoration=decorType==="tree"?{type:"tree",treeAsset:root.querySelector("#devTerrainTreeAsset")?.value||"",treeScale:Math.max(.25,numberOr(root.querySelector("#devTerrainTreeScale")?.value,1)),densityPercent:clamp(numberOr(root.querySelector("#devTerrainDensity")?.value,50),0,100),solid:!!root.querySelector("#devTerrainTreeSolid")?.checked}:{type:"none"};
  window.LR_TERRAINS=devTerrains;rebuildGeneratedTerrainScenery();saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`Saved terrain: ${rec.name}`);
}
function refreshDeveloperTerrainPanel(){
  if(!devPanel)return;const palette=devPanel.querySelector("#devTerrainPalette"),summary=devPanel.querySelector("#devTerrainSummary"),inspector=devPanel.querySelector("#devTerrainInspector");if(!palette)return;
  if(!developerTerrainRecord(devTerrainBrush))devTerrainBrush=Object.keys(devTerrains)[0]||"";if(!developerTerrainRecord(devTerrainSelectedId))devTerrainSelectedId=devTerrainBrush;
  const counts=developerTerrainCounts(),query=String(devPanel.querySelector("#devTerrainSearch")?.value||"").trim().toLowerCase(),entries=Object.entries(devTerrains).filter(([id,rec])=>!query||`${rec?.name||""} ${id}`.toLowerCase().includes(query));palette.innerHTML=entries.sort((a,b)=>numberOr(a[1]?.code,0)-numberOr(b[1]?.code,0)).map(([id,rec])=>{const asset=devAssets?.[rec.textureAsset],path=asset?.path||"",style=`background:${rec.color||"#777"}${path?`;background-image:url('./${devContentEscape(path)}');background-size:cover;background-position:center`:""}`;return `<button class="devTerrainType ${id===devTerrainBrush?"active":""}" data-terrain-type="${devContentEscape(id)}" title="${devContentEscape(developerTerrainBehaviorSummary(rec))}"><span class="devTerrainSwatch" style="${style}"></span><b>${devContentEscape(rec.name||id)}</b><small>${counts.get(Math.floor(numberOr(rec.code,0)))||0} tiles</small></button>`;}).join("")||'<div class="devEmpty">No terrain matches this search.</div>';
  palette.querySelectorAll("[data-terrain-type]").forEach(button=>button.onclick=()=>setDeveloperTerrainBrush(button.dataset.terrainType));if(summary)summary.textContent=`${WORLD_W}×${WORLD_H} tiles • ${Object.keys(devTerrains).length} terrain types • ${developerTerrainType().name} selected`;
  const size=devPanel.querySelector("#devTerrainBrushSize");if(size){size.value=String(devTerrainBrushSize);size.onchange=e=>{devTerrainBrushSize=Math.max(1,Math.floor(numberOr(e.target.value,1)));devSetStatus(`Terrain brush size: ${devTerrainBrushSize}×${devTerrainBrushSize}`);};}
  const backdrop=devPanel.querySelector("#devTerrainBackdrop");if(backdrop){const selected=developerZoneBackdropTerrainId();backdrop.innerHTML=Object.entries(devTerrains).map(([id,rec])=>`<option value="${devContentEscape(id)}" ${id===selected?"selected":""}>${devContentEscape(rec.name||id)}</option>`).join("");backdrop.onchange=e=>setDeveloperZoneBackdropTerrain(e.target.value);}
  const backdropNote=devPanel.querySelector("#devTerrainBackdropNote");if(backdropNote){const rec=developerTerrainRecord(developerZoneBackdropTerrainId());backdropNote.textContent=`The same ${rec?.name||"terrain"} definition is drawn outside the playable grid, including its texture and generated decoration. ${developerTerrainBehaviorSummary(rec||{})}.`;}
  const terrainOptions=Object.entries(devTerrains).map(([id,rec])=>`<option value="${devContentEscape(id)}">${devContentEscape(rec.name||id)}</option>`).join("");const defaultGround=devPanel.querySelector("#devTerrainDefaultGround"),defaultBoundary=devPanel.querySelector("#devTerrainDefaultBoundary");if(defaultGround){defaultGround.innerHTML=terrainOptions;defaultGround.value=developerDefaultGroundTerrainId();defaultGround.onchange=e=>setDeveloperTerrainDefault("ground",e.target.value);}if(defaultBoundary){defaultBoundary.innerHTML=terrainOptions;defaultBoundary.value=developerDefaultBoundaryTerrainId();defaultBoundary.onchange=e=>setDeveloperTerrainDefault("boundary",e.target.value);}
  const matchEdge=devPanel.querySelector("#devTerrainMatchEdge"),fillInterior=devPanel.querySelector("#devTerrainFillInterior"),fillAll=devPanel.querySelector("#devTerrainFillAll"),resetBlank=devPanel.querySelector("#devTerrainResetBlank");if(matchEdge)matchEdge.onclick=developerMatchZoneEdgeToBackdrop;if(fillInterior)fillInterior.onclick=()=>developerFillTerrain({interiorOnly:true});if(fillAll)fillAll.onclick=()=>developerFillTerrain();if(resetBlank)resetBlank.onclick=()=>developerFillTerrain({resetBlank:true});
  if(inspector){
    inspector.innerHTML=developerTerrainInspectorHtml(devTerrainSelectedId,developerTerrainRecord(devTerrainSelectedId));
    const scaleInput=inspector.querySelector("#devTerrainTextureScale"),scaleReadout=inspector.querySelector("#devTerrainScaleReadout");
    if(scaleInput){
      const previewScale=()=>{const rec=developerTerrainRecord(devTerrainSelectedId);if(!rec)return;const scale=clamp(numberOr(scaleInput.value,100)/100,.1,4);rec.textureScale=scale;window.LR_TERRAINS=devTerrains;if(scaleReadout)scaleReadout.value=`≈ ${(1/scale).toFixed(2)}×`;};
      scaleInput.addEventListener("input",previewScale);
      scaleInput.addEventListener("change",()=>{previewScale();saveDeveloperDraft();devSetStatus(`Texture scale preview: ${Math.round(clamp(numberOr(scaleInput.value,100)/100,.1,4)*100)}%`);});
    }
    inspector.querySelector("#devTerrainPreviewFootsteps")?.addEventListener("click",()=>{const id=inspector.querySelector("#devTerrainFootstepSet")?.value;if(id)developerAudioPreview(id);else devSetStatus("Choose a footstep sound set first");});inspector.querySelector("#devTerrainOpenAudio")?.addEventListener("click",()=>setDeveloperTab("audio"));
    inspector.querySelector("#devTerrainSave")?.addEventListener("click",saveDeveloperTerrainFromInspector);inspector.querySelector("#devTerrainDuplicate")?.addEventListener("click",duplicateDeveloperTerrain);inspector.querySelector("#devTerrainDelete")?.addEventListener("click",deleteDeveloperTerrain);
  }
  const newTerrain=devPanel.querySelector("#devTerrainNew");if(newTerrain)newTerrain.onclick=()=>createDeveloperTerrain("New Terrain");
}

function developerNpcSpriteAssets(){
  return Object.entries(devAssets||{}).filter(([,asset])=>asset?.type==="npcSprite");
}

function developerNpcAssetId(npc){
  if(npc?.spriteAsset&&devAssets?.[npc.spriteAsset]?.type==="npcSprite")return npc.spriteAsset;
  const path=String(npc?.sprite||"").replace(/^\.\//,"");
  if(!path)return "";
  return developerNpcSpriteAssets().find(([,asset])=>String(asset?.path||"").replace(/^\.\//,"")===path)?.[0]||"";
}

function developerNpcAssetPath(assetId){
  const asset=devAssets?.[assetId];
  if(!asset||asset.type!=="npcSprite")return NPC_PLACEHOLDER_SPRITE;
  const path=String(asset.path||"").trim();
  return path?(path.startsWith("./")?path:`./${path}`):NPC_PLACEHOLDER_SPRITE;
}

function developerApplyNpcSpriteAsset(npc,assetId){
  if(!npc)return false;
  const asset=devAssets?.[assetId];
  if(!asset||asset.type!=="npcSprite")return false;
  npc.spriteAsset=assetId;
  npc.sprite=developerNpcAssetPath(assetId);
  return true;
}

function refreshDeveloperNpcAssetPalette(){
  if(!devPanel)return;
  const palette=devPanel.querySelector("#devNpcAssetPalette");
  if(!palette)return;
  const query=String(devPanel.querySelector("#devNpcSearch")?.value||"").trim().toLowerCase(),entries=developerNpcSpriteAssets().filter(([id,asset])=>!query||`${asset?.name||""} ${id}`.toLowerCase().includes(query));
  palette.innerHTML=entries.map(([id,asset])=>`<button class="devAssetChip ${id===devPlaceNpcAsset?"active":""}" data-npc-asset="${devContentEscape(id)}" title="Place ${devContentEscape(asset.name||id)}"><img src="./${devContentEscape(String(asset.path||"").replace(/^\.\//,""))}" alt=""><span><b>${devContentEscape(asset.name||id)}</b><small>NPC Sprite</small></span></button>`).join("")||'<div class="devEmpty">No NPC Sprite assets yet. Import one in Assets.</div>';
  palette.querySelectorAll("[data-npc-asset]").forEach(button=>button.onclick=()=>{
    devPlaceNpcAsset=button.dataset.npcAsset;devPlaceType=null;devPlaceMobType=null;devSelected=null;devSelectedNpc=null;devSelectedMob=null;
    setDeveloperTab("npcs");updateDevPaletteActive();refreshDeveloperPanel();
    const asset=devAssets?.[devPlaceNpcAsset];devSetStatus(`Placing ${asset?.name||devPlaceNpcAsset} NPC — click the world${devRepeatPlacement?" repeatedly":" once"}`);
  });
}

function uniqueNpcId(base="npc"){
  const root=String(base||"npc").toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"")||"npc";
  let id=root,n=2;
  while(sceneryNPCs.some(npc=>npc.id===id)){id=`${root}-${n++}`;}
  return id;
}

function placeDeveloperNpc(assetId,wx,wy){
  const asset=devAssets?.[assetId];
  if(!asset||asset.type!=="npcSprite"){devSetStatus("Choose an NPC Sprite asset first");return;}
  const baseName=String(asset.name||"New NPC").trim()||"New NPC";
  const npc=normalizeNpcRecord({
    id:uniqueNpcId(baseName),
    name:baseName,
    role:"Villager",
    spriteAsset:assetId,
    sprite:developerNpcAssetPath(assetId),
    x:snapDev(wx),y:snapDev(wy),facing:"down",solid:true,
    displayHeight:58,interactRadius:58,greeting:`Hello. I'm ${baseName}.`
  },sceneryNPCs.length);
  sceneryNPCs.push(npc);
  rebuildNpcCollision();
  devSelectedNpc=npc;devSelected=null;devSelectedMob=null;devSelectedRemnant=null;
  if(!devRepeatPlacement)devPlaceNpcAsset=null;
  setDeveloperTab("npcs");
  saveDeveloperDraft();refreshDeveloperPanel();updateDevPaletteActive();
  devSetStatus(devRepeatPlacement?`Placed ${npc.name} • repeat NPC placement remains active`:`Placed ${npc.name} • Select / Move restored; edit its details below`);
}

function findDeveloperNpcAt(wx,wy){return findNpcAtWorld(wx,wy);}

function placeDeveloperObject(type,wx,wy){
  const obj=defaultWorldObject(type,0,0);
  const spec=worldObjectSpec(obj);
  if(!spec) return;
  obj.x=snapDev(wx-spec.w/2);obj.y=snapDev(wy-spec.h/2);
  sceneryProps.push(obj);
  devSelected=obj;devSelectedMob=null;devSelectedNpc=null;devSelectedRemnant=null;
  if(devRepeatPlacement){setDeveloperTab("objects");}else{devPlaceType=null;setDeveloperTab("selection");}
  rebuildWorldObjectCollision();saveDeveloperDraft();refreshDeveloperPanel();updateDevPaletteActive();
  devSetStatus(devRepeatPlacement?`Placed ${obj.label||worldObjectDefinition(obj)?.name||obj.objectId||"Object"} • repeat placement remains active`:`Placed ${obj.label||worldObjectDefinition(obj)?.name||obj.objectId||"Object"} • Select / Move restored`);
}

function devPointerDown(event){
  if(!devModeActive) return;
  if(developerBeginCameraPan(event))return;
  event.preventDefault(); event.stopImmediatePropagation();
  const p=devWorldFromPointer(event);
  if(devActiveTab==="terrain"){
    beginDeveloperTerrainPaint(p,event);
    return;
  }
  if(devPlaceMobType){
    placeDeveloperMobSpawn(devPlaceMobType,p.x,p.y);
    return;
  }
  if(devPlaceNpcAsset){
    placeDeveloperNpc(devPlaceNpcAsset,p.x,p.y);
    return;
  }
  if(devPlaceType){
    placeDeveloperObject(devPlaceType,p.x,p.y);
    return;
  }

  const sizeHandle=findDeveloperSizeInteraction(p.x,p.y);
  if(sizeHandle){
    const target=developerVisualSizeTarget(),bounds=developerVisualSizeBounds(target);if(!target||!bounds)return;
    const point=developerVisualSizeHandlePoints(target,bounds).find(row=>row[0]===sizeHandle)||[sizeHandle,bounds.x+bounds.w,bounds.y+bounds.h];
    devDragging=false;devNpcDragging=false;
    devSizeDrag={kind:target.kind,entity:target.entity,key:target.key||"",handle:sizeHandle,pointerX:p.x,pointerY:p.y,bounds:{...bounds},startHeight:target.kind==="mob"?mobWorldDisplayHeight(target.entity):target.kind==="npc"?Math.max(24,numberOr(target.entity.displayHeight,58)):bounds.h,anchorX:target.kind==="mob"?target.entity.x:target.kind==="npc"?target.entity.x:0,anchorY:target.kind==="mob"?target.entity.y+8:target.kind==="npc"?target.entity.y+14:0,startDistance:target.kind==="object"?1:Math.max(1,Math.hypot(point[1]-(target.entity.x||0),point[2]-(target.kind==="mob"?target.entity.y+8:target.entity.y+14)))};
    if(game?.style)game.style.cursor=developerHitboxCursor(sizeHandle);
    try{game.setPointerCapture?.(event.pointerId);}catch{}
    devSetStatus(target.kind==="mob"?`Resizing ${mobTypeScaleLabel(target.key)} — release to save global mob size`:"Resizing visual sprite — release to save");
    return;
  }

  const interactionAreaHandle=findDeveloperInteractionAreaHandle(p.x,p.y);
  if(interactionAreaHandle){
    const area=ensureDeveloperInteractionArea(devSelected);
    devDragging=false;devNpcDragging=false;
    devInteractionDrag={handle:interactionAreaHandle,pointerX:p.x,pointerY:p.y,area:{x:area.x,y:area.y,w:area.w,h:area.h}};
    if(game?.style)game.style.cursor=developerHitboxCursor(interactionAreaHandle);
    try{game.setPointerCapture?.(event.pointerId);}catch{}
    devSetStatus(interactionAreaHandle==="move"?"Moving interaction area — release to save":"Resizing interaction area — release to save");
    return;
  }

  if(findDeveloperDepthInteraction(p.x,p.y)){
    const entity=developerSelectedEntity();
    const depth=ensureDeveloperDepth(entity);
    devDragging=false;devNpcDragging=false;
    devDepthDrag={pointerY:p.y,depthY:depth.y};
    if(game?.style) game.style.cursor="ns-resize";
    try{ game.setPointerCapture?.(event.pointerId); }catch{}
    devSetStatus("Moving depth line — release to save");
    return;
  }

  const hitboxInteraction=findDeveloperHitboxInteraction(p.x,p.y);
  if(hitboxInteraction){
    const entity=developerSelectedEntity();
    const hb=ensureDeveloperHitbox(entity);
    devDragging=false;devNpcDragging=false;
    devHitboxDrag={
      handle:hitboxInteraction,
      pointerX:p.x,
      pointerY:p.y,
      hitbox:{x:hb.x,y:hb.y,w:hb.w,h:hb.h}
    };
    if(game?.style) game.style.cursor=developerHitboxCursor(hitboxInteraction);
    try{ game.setPointerCapture?.(event.pointerId); }catch{}
    devSetStatus(hitboxInteraction==="move"?"Moving hitbox — release to save":"Resizing hitbox — release to save");
    return;
  }

  if(devSelectedRemnant && findDeveloperRemnantPreviewAt(p.x,p.y)){
    devRemnantDragging=true;
    devRemnantDragOffset={x:p.x-devRemnantPreview.x,y:p.y-devRemnantPreview.y};
    try{ game.setPointerCapture?.(event.pointerId); }catch{}
    devSetStatus("Moving remnant preview — release to keep testing scale/depth");
    return;
  }

  if(devActiveTab==="spawns"){
    const spawn=findDeveloperSpawnAt(p.x,p.y);
    if(spawn){beginDeveloperSpawnDrag(spawn,p,event);return;}
    const spawnMob=findDeveloperMobAt(p.x,p.y);
    if(spawnMob?.spawnId){const record=developerSpawnById(spawnMob.spawnId);if(record){beginDeveloperSpawnDrag(record,p,event);return;}}
  }

  const npc=findDeveloperNpcAt(p.x,p.y);
  if(npc){
    const sameSizeTarget=devSizeEditing&&devSelectedNpc===npc;
    devSelectedNpc=npc;
    if(!sameSizeTarget){devSizeEditing=false;devSizeDrag=null;}
    devSelected=null;devSelectedMob=null;devSelectedRemnant=null;
    devInteractionEditing=false;devInteractionDrag=null;
    setDeveloperTab("selection");
    if(devHitboxEditing){
      ensureDeveloperHitbox(npc);
      devNpcDragging=false;
      devSetStatus(`Selected ${npc.name} — drag the yellow NPC hitbox or its handles`);
    }else if(devDepthEditing && npcDepthMode(npc)==="ysort"){
      ensureDeveloperDepth(npc);
      devNpcDragging=false;
      devSetStatus(`Selected ${npc.name} — drag the purple NPC depth line`);
    }else{
      devNpcDragging=true;
      devNpcDragOffset={x:p.x-npc.x,y:p.y-npc.y};
      try{ game.setPointerCapture?.(event.pointerId); }catch{}
      devSetStatus(`Selected ${npc.name} — drag to move; Selection has size, hitbox, and depth tools`);
    }
    refreshDeveloperPanel();
    return;
  }

  const mob=findDeveloperMobAt(p.x,p.y);
  if(mob){
    const sameSizeTarget=devSizeEditing&&devSelectedMob===mob;
    devSelectedMob=mob;
    if(!sameSizeTarget){devSizeEditing=false;devSizeDrag=null;}
    devSelected=null;devSelectedNpc=null;devSelectedRemnant=null;
    devDragging=false;devNpcDragging=false;
    devHitboxEditing=false;
    devHitboxDrag=null;
    devDepthEditing=false;
    devDepthDrag=null;
    devInteractionEditing=false;
    devInteractionDrag=null;
    devCombatMobType=mobTypeScaleKey(mob);
    if(devActiveTab!=="combat") setDeveloperTab("scale");
    refreshDeveloperPanel();
    if(devActiveTab==="combat") devSetStatus(`${mobTypeScaleLabel(devCombatMobType)} selected — combat tuning now targets this species`);
    else devSetStatus(`${mobTypeScaleLabel(devCombatMobType)} selected — scale changes affect every ${mobTypeScaleLabel(devCombatMobType).toLowerCase()}`);
    return;
  }

  devSelectedMob=null;devSelectedNpc=null;devSelectedRemnant=null;
  const previousSelected=devSelected;
  devSelected=findWorldObjectAt(p.x,p.y);
  if(devSelected){
    if(!(devSizeEditing&&previousSelected===devSelected)){devSizeEditing=false;devSizeDrag=null;}
    setDeveloperTab("selection");
    if(devInteractionEditing){
      ensureDeveloperInteractionArea(devSelected);devDragging=false;
      devSetStatus(`Selected ${devSelected.label||devSelected.type} — drag the green interaction area or its handles`);
    }else if(devHitboxEditing){
      ensureDeveloperHitbox(devSelected);
      devDragging=false;
      devSetStatus(`Selected ${devSelected.label||devSelected.type} — drag the yellow hitbox or its handles`);
    }else if(devDepthEditing && worldObjectDepthMode(devSelected)==="ysort"){
      ensureDeveloperDepth(devSelected);
      devDragging=false;
      devSetStatus(`Selected ${devSelected.label||devSelected.type} — drag the purple depth line`);
    }else{
      devDragging=true;
      devDragOffset={x:p.x-devSelected.x,y:p.y-devSelected.y};
      try{ game.setPointerCapture?.(event.pointerId); }catch{}
      devSetStatus(`Selected ${devSelected.label||devSelected.type} — drag to move`);
    }
  }else{
    devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;devInteractionEditing=false;devInteractionDrag=null;
    devSetStatus("Nothing selected — choose a prop/NPC from Selection or place one from its palette");
  }
  refreshDeveloperPanel();
}
function devPointerMove(event){
  if(!devModeActive) return;
  if(developerUpdateCameraPan(event))return;
  const p=devWorldFromPointer(event);

  if(devActiveTab==="terrain"){
    devTerrainHoverTile=developerTerrainTileAt(p.x,p.y);
    if(game?.style)game.style.cursor="crosshair";
    if(devTerrainPainting){event.preventDefault();event.stopImmediatePropagation();updateDeveloperTerrainPaint(p);}
    return;
  }

  if(devSpawnDragging){
    event.preventDefault();event.stopImmediatePropagation();updateDeveloperSpawnDrag(p);return;
  }

  if(devRemnantDragging && devRemnantPreview){
    event.preventDefault();event.stopImmediatePropagation();
    devRemnantPreview.x=snapDev(p.x-devRemnantDragOffset.x);
    devRemnantPreview.y=snapDev(p.y-devRemnantDragOffset.y);
    return;
  }

  if(devNpcDragging && devSelectedNpc){
    event.preventDefault();event.stopImmediatePropagation();
    devSelectedNpc.x=snapDev(p.x-devNpcDragOffset.x);
    devSelectedNpc.y=snapDev(p.y-devNpcDragOffset.y);
    rebuildNpcCollision();
    refreshDeveloperInspectorValues();
    refreshDeveloperNpcInspectorValues();
    return;
  }

  if(devSizeDrag){
    event.preventDefault();event.stopImmediatePropagation();updateDeveloperSizeDrag(p);return;
  }

  if(devInteractionDrag && devSelected){
    event.preventDefault();event.stopImmediatePropagation();updateDeveloperInteractionAreaDrag(p);return;
  }

  if(devHitboxDrag && developerSelectedEntity()){
    event.preventDefault(); event.stopImmediatePropagation();
    updateDeveloperHitboxDrag(p);
    return;
  }

  if(devDepthDrag && developerSelectedEntity()){
    event.preventDefault(); event.stopImmediatePropagation();
    updateDeveloperDepthDrag(p);
    return;
  }

  if(devSizeEditing && developerVisualSizeTarget() && game?.style){
    game.style.cursor=developerHitboxCursor(findDeveloperSizeInteraction(p.x,p.y));
  }else if(devInteractionEditing && devSelected && game?.style){
    game.style.cursor=developerHitboxCursor(findDeveloperInteractionAreaHandle(p.x,p.y));
  }else if(devDepthEditing && developerSelectedEntity() && game?.style){
    game.style.cursor=findDeveloperDepthInteraction(p.x,p.y)?"ns-resize":"";
  }else if(devHitboxEditing && developerSelectedEntity() && game?.style){
    game.style.cursor=developerHitboxCursor(findDeveloperHitboxInteraction(p.x,p.y));
  }else if(game?.style && !devDragging && !devNpcDragging && !devRemnantDragging && !devSpawnDragging){
    game.style.cursor="";
  }

  if(!devDragging || !devSelected) return;
  event.preventDefault(); event.stopImmediatePropagation();
  devSelected.x=snapDev(p.x-devDragOffset.x);
  devSelected.y=snapDev(p.y-devDragOffset.y);
  rebuildWorldObjectCollision();
  refreshDeveloperInspectorValues();
}
function devPointerUp(event){
  if(devModeActive&&developerEndCameraPan(event))return;
  if(!devModeActive || (!devTerrainPainting && !devDragging && !devNpcDragging && !devRemnantDragging && !devSpawnDragging && !devSizeDrag && !devHitboxDrag && !devDepthDrag && !devInteractionDrag)) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if(devTerrainPainting){finishDeveloperTerrainPaint(event);return;}
  const finishedNpc=!!devNpcDragging;
  const finishedRemnant=!!devRemnantDragging;
  const finishedSpawn=!!devSpawnDragging;
  devDragging=false;devNpcDragging=false;devRemnantDragging=false;devSpawnDragging=false;
  const finishedSize=!!devSizeDrag;
  const finishedHitbox=!!devHitboxDrag;
  const finishedDepth=!!devDepthDrag;
  const finishedInteraction=!!devInteractionDrag;
  devSizeDrag=null;
  devHitboxDrag=null;
  devDepthDrag=null;
  devInteractionDrag=null;
  try{ game.releasePointerCapture?.(event.pointerId); }catch{}
  if(finishedSpawn){finishDeveloperSpawnDrag();return;}
  saveDeveloperDraft();
  if(finishedRemnant) devSetStatus("Remnant preview position updated — runtime piles use the same scale/depth settings");
  else if(finishedNpc) devSetStatus("NPC position updated");
  else if(finishedSize) devSetStatus("Visual size updated — hitboxes and interaction areas stay independent so you can tune them separately");
  else if(finishedHitbox) devSetStatus("Hitbox updated — keep dragging handles or click Finish Hitbox Editing");
  else if(finishedDepth) devSetStatus("Depth line updated — move around the NPC/object to test overlap");
  else if(finishedInteraction) devSetStatus("Interaction area updated — click Finish Interaction Area when it covers the usable part of the object");
}

function deleteDeveloperSelection(){
  if(!devSelected) return;
  const i=sceneryProps.indexOf(devSelected);
  if(i>=0) sceneryProps.splice(i,1);
  devSelected=null;
  devSizeEditing=false;
  devSizeDrag=null;
  devHitboxEditing=false;
  devHitboxDrag=null;
  devDepthEditing=false;
  devDepthDrag=null;
  devInteractionEditing=false;
  devInteractionDrag=null;
  rebuildWorldObjectCollision();
  saveDeveloperDraft();
  refreshDeveloperPanel();
}
function duplicateDeveloperSelection(){
  if(!devSelected) return;
  const copy=cloneWorldObject(devSelected);
  copy.id=`${copy.type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
  copy.x+=devSnap*2;copy.y+=devSnap*2;
  sceneryProps.push(copy);devSelected=copy;
  rebuildWorldObjectCollision();saveDeveloperDraft();refreshDeveloperPanel();
}

function syncDeveloperInspectorFromPanel({saveDraft=false}={}){
  if(!devPanel||!devSelected) return false;
  const q=id=>devPanel.querySelector(`#${id}`);
  const x=q("devX"),y=q("devY"),label=q("devLabel"),solid=q("devSolid"),interactable=q("devInteractable"),capacity=q("devCapacity");
  if(!x||!y||!label||!solid||!interactable||!capacity) return false;
  devSelected.x=numberOr(x.value,devSelected.x);
  devSelected.y=numberOr(y.value,devSelected.y);
  devSelected.label=label.value.trim()||devSelected.type;
  if(q("devObjectW"))devSelected.w=Math.max(8,numberOr(q("devObjectW").value,worldObjectSpec(devSelected)?.w||64));
  if(q("devObjectH"))devSelected.h=Math.max(8,numberOr(q("devObjectH").value,worldObjectSpec(devSelected)?.h||64));
  devSelected.solid=solid.checked;
  devSelected.interactable=interactable.checked;
  const previous=worldObjectInteraction(devSelected);
  const area=ensureDeveloperInteractionArea(devSelected)||previous.area;
  devSelected.interaction={
    enabled:devSelected.interactable,
    type:q("devInteractionType")?.value||previous.type,
    prompt:q("devInteractionPrompt")?.value.trim()||previous.prompt,
    soundId:q("devInteractionSound")?.value||"",
    range:Math.max(20,numberOr(q("devInteractionRange")?.value,previous.range)),
    clickable:q("devInteractionClickable")?.checked!==false,
    keyable:q("devInteractionKeyable")?.checked!==false,
    tag:q("devInteractionTag")?.value.trim()||devSelected.id,
    area:{x:numberOr(q("devIaX")?.value,area.x),y:numberOr(q("devIaY")?.value,area.y),w:Math.max(4,numberOr(q("devIaW")?.value,area.w)),h:Math.max(4,numberOr(q("devIaH")?.value,area.h))},
    requirements:{questId:q("devReqQuest")?.value||"",questState:q("devReqQuestState")?.value||"active",itemId:q("devReqItem")?.value||"",itemQty:Math.max(1,Math.floor(numberOr(q("devReqItemQty")?.value,1)))},
    actions:{targetZone:q("devActionZone")?.value||"",targetX:q("devActionX")?.value===""?null:numberOr(q("devActionX")?.value,null),targetY:q("devActionY")?.value===""?null:numberOr(q("devActionY")?.value,null),giveItemId:q("devActionItem")?.value||"",giveItemQty:Math.max(1,Math.floor(numberOr(q("devActionItemQty")?.value,1))),openMode:q("devOpenMode")?.value||previous.actions.openMode||"simple",lootTable:q("devActionLoot")?.value||"",questIds:[...devPanel.querySelectorAll("[data-dev-object-quest]:checked")].map(el=>el.value),questBehavior:q("devQuestBehavior")?.value||"offer",consumeRequiredItem:!!q("devConsumeReqItem")?.checked,message:q("devActionMessage")?.value.trim()||""},
    useMode:q("devUseMode")?.value||"repeatable",resetSeconds:Math.max(1,numberOr(q("devResetSeconds")?.value,30)),hideWhenUsed:!!q("devHideWhenUsed")?.checked
  };
  devSelected.interactionTag=devSelected.interaction.tag;
  const emitterId=q("devEmitterSound")?.value||"";devSelected.soundEmitter=emitterId?{clipId:emitterId,volume:Math.max(0,Math.min(2,numberOr(q("devEmitterVolume")?.value,70)/100)),radius:Math.max(50,numberOr(q("devEmitterRadius")?.value,420)),loop:true}:null;
  devSelected.capacity=Math.max(1,Math.round(numberOr(capacity.value,8)));
  devSelected.hitbox=devSelected.hitbox||{};
  devSelected.hitbox.x=numberOr(q("devHbX")?.value,devSelected.hitbox.x||0);
  devSelected.hitbox.y=numberOr(q("devHbY")?.value,devSelected.hitbox.y||0);
  devSelected.hitbox.w=Math.max(1,numberOr(q("devHbW")?.value,devSelected.hitbox.w||16));
  devSelected.hitbox.h=Math.max(1,numberOr(q("devHbH")?.value,devSelected.hitbox.h||12));
  devSelected.depthMode=WORLD_OBJECT_DEPTH_MODES.has(q("devDepthMode")?.value)?q("devDepthMode").value:"ysort";
  devSelected.depthY=numberOr(q("devDepthY")?.value,defaultWorldObjectDepthY(devSelected));
  if(devSelected.depthMode!=="ysort"){devDepthEditing=false;devDepthDrag=null;}
  rebuildWorldObjectCollision();
  if(saveDraft)saveDeveloperDraft();
  return true;
}

function updateDeveloperInteractionAreaFromInputs({saveDraft=false}={}){
  if(!devPanel||!devSelected)return;
  const q=id=>devPanel.querySelector(`#${id}`),area=ensureDeveloperInteractionArea(devSelected);if(!area)return;
  const read=(id,fallback,min=null)=>{const el=q(id);if(!el||String(el.value).trim()==="")return fallback;const n=Number(el.value);if(!Number.isFinite(n))return fallback;return min==null?n:Math.max(min,n);};
  area.x=Math.round(read("devIaX",area.x));area.y=Math.round(read("devIaY",area.y));area.w=Math.round(read("devIaW",area.w,4));area.h=Math.round(read("devIaH",area.h,4));
  devSelected.interaction=devSelected.interaction||{};devSelected.interaction.area=area;
  if(saveDraft)saveDeveloperDraft();
}

function applyDeveloperInspector(){
  if(!syncDeveloperInspectorFromPanel({saveDraft:true}))return;
  refreshDeveloperPanel(false);
  devSetStatus("Object settings applied");
}

function applyDeveloperNpcVisualInspector(){
  if(!devPanel||!devSelectedNpc) return;
  const q=id=>devPanel.querySelector(`#${id}`);
  devSelectedNpc.x=numberOr(q("devX")?.value,devSelectedNpc.x);
  devSelectedNpc.y=numberOr(q("devY")?.value,devSelectedNpc.y);
  developerApplyNpcSpriteAsset(devSelectedNpc,q("devNpcSelectionSprite")?.value||developerNpcAssetId(devSelectedNpc));
  devSelectedNpc.facing=q("devNpcSelectionFacing")?.value||devSelectedNpc.facing||"down";
  devSelectedNpc.displayHeight=Math.max(24,numberOr(q("devNpcSelectionHeight")?.value,devSelectedNpc.displayHeight));
  devSelectedNpc.solid=!!q("devSolid")?.checked;
  devSelectedNpc.hitbox=devSelectedNpc.hitbox||{};
  devSelectedNpc.hitbox.x=numberOr(q("devHbX")?.value,-6);
  devSelectedNpc.hitbox.y=numberOr(q("devHbY")?.value,-7);
  devSelectedNpc.hitbox.w=Math.max(2,numberOr(q("devHbW")?.value,12));
  devSelectedNpc.hitbox.h=Math.max(2,numberOr(q("devHbH")?.value,14));
  devSelectedNpc.depthMode=WORLD_OBJECT_DEPTH_MODES.has(q("devDepthMode")?.value)?q("devDepthMode").value:"ysort";
  devSelectedNpc.depthY=numberOr(q("devDepthY")?.value,defaultNpcDepthY(devSelectedNpc));
  if(devSelectedNpc.depthMode!=="ysort"){devDepthEditing=false;devDepthDrag=null;}
  rebuildNpcCollision();
  saveDeveloperDraft();
  refreshDeveloperPanel(false);
  devSetStatus(`Applied visual settings for ${devSelectedNpc.name}`);
}

function refreshDeveloperInspectorValues(){
  if(!devPanel) return;
  const entity=developerSelectedEntity();
  if(!entity) return;
  const q=id=>devPanel.querySelector(`#${id}`);
  if(q("devX")) q("devX").value=Math.round(entity.x);
  if(q("devY")) q("devY").value=Math.round(entity.y);
  const hb=ensureDeveloperHitbox(entity);
  if(q("devHbX")) q("devHbX").value=Math.round(hb.x);
  if(q("devHbY")) q("devHbY").value=Math.round(hb.y);
  if(q("devHbW")) q("devHbW").value=Math.round(hb.w);
  if(q("devHbH")) q("devHbH").value=Math.round(hb.h);
  const depth=ensureDeveloperDepth(entity);
  if(q("devDepthMode")) q("devDepthMode").value=depth.mode;
  if(q("devDepthY")) q("devDepthY").value=Math.round(depth.y);
  if(!developerIsNpc(entity)){const a=ensureDeveloperInteractionArea(entity);if(q("devIaX"))q("devIaX").value=Math.round(a.x);if(q("devIaY"))q("devIaY").value=Math.round(a.y);if(q("devIaW"))q("devIaW").value=Math.round(a.w);if(q("devIaH"))q("devIaH").value=Math.round(a.h);}
  if(developerIsNpc(entity)){
    if(q("devNpcSelectionHeight")) q("devNpcSelectionHeight").value=Math.round(entity.displayHeight);
    if(q("devNpcSelectionSprite")) q("devNpcSelectionSprite").value=developerNpcAssetId(entity);
    if(q("devNpcSelectionFacing")) q("devNpcSelectionFacing").value=entity.facing||"down";
  }
}

function refreshDeveloperObjectList(){
  if(!devPanel) return;
  const list=devPanel.querySelector("#devObjectList");
  const count=devPanel.querySelector("#devObjectCount");
  if(count) count.textContent=`${sceneryProps.length} placed`;
  if(!list) return;
  list.innerHTML="";const query=String(devPanel.querySelector("#devPlacedObjectSearch")?.value||"").trim().toLowerCase();
  for(const obj of sceneryProps){const objectName=worldObjectDefinition(obj)?.name||obj.objectId||"Object";if(query&&!`${obj.label||""} ${objectName} ${obj.id||""}`.toLowerCase().includes(query))continue;
    const b=document.createElement("button");
    b.className="devObjectChip"+(obj===devSelected?" active":"");
    b.textContent=obj.label||objectName;
    b.title=`${objectName} @ ${Math.round(obj.x)}, ${Math.round(obj.y)}`;
    b.onclick=()=>{
      devPlaceType=null;devPlaceNpcAsset=null;
      devSelectedMob=null;devSelectedNpc=null;devSelectedRemnant=null;
      devSelected=obj;
      setDeveloperTab("selection");
      updateDevPaletteActive();
      refreshDeveloperPanel();
      devSetStatus(`Selected ${obj.label||worldObjectDefinition(obj)?.name||obj.objectId||"Object"}`);
    };
    list.appendChild(b);
  }
}

function refreshDeveloperSelectionList(){
  if(!devPanel) return;
  const list=devPanel.querySelector("#devSelectionList");
  const count=devPanel.querySelector("#devSelectionCount");
  if(count) count.textContent=`${sceneryProps.length} props • ${sceneryNPCs.length} NPCs • 2 remnants`;
  if(!list) return;
  list.innerHTML="";
  for(const kind of ["dust","lootable"]){
    const b=document.createElement("button");
    const label=kind==="lootable"?"Lootable Dust":"Dust";
    b.className="devObjectChip"+(devSelectedRemnant===kind?" active":"");
    b.textContent=`REMNANT • ${label}`;
    b.title=`Global ${label} runtime preview — scale and depth settings affect all mob death piles`;
    b.onclick=()=>selectDeveloperRemnant(kind);
    list.appendChild(b);
  }
  for(const npc of sceneryNPCs){
    const b=document.createElement("button");
    b.className="devObjectChip"+(npc===devSelectedNpc?" active":"");
    b.textContent=`NPC • ${npc.name}`;
    b.title=`${npc.role||"NPC"} @ ${Math.round(npc.x)}, ${Math.round(npc.y)}`;
    b.onclick=()=>{
      devPlaceType=null;devPlaceNpcAsset=null;devSelectedMob=null;devSelectedRemnant=null;devSelected=null;devSelectedNpc=npc;
      devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;
      setDeveloperTab("selection");updateDevPaletteActive();refreshDeveloperPanel();
      devSetStatus(`Selected NPC ${npc.name} — visual size, hitbox, and depth are editable here`);
    };
    list.appendChild(b);
  }
  for(const obj of sceneryProps){
    const b=document.createElement("button");
    b.className="devObjectChip"+(obj===devSelected?" active":"");
    const objectName=worldObjectDefinition(obj)?.name||obj.objectId||"Object";
    b.textContent=`OBJECT • ${obj.label||objectName}`;
    b.title=`${objectName} @ ${Math.round(obj.x)}, ${Math.round(obj.y)}`;
    b.onclick=()=>{
      devPlaceType=null;devPlaceNpcAsset=null;devSelectedMob=null;devSelectedRemnant=null;devSelectedNpc=null;devSelected=obj;
      devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;
      setDeveloperTab("selection");updateDevPaletteActive();refreshDeveloperPanel();
      devSetStatus(`Selected ${obj.label||worldObjectDefinition(obj)?.name||obj.objectId||"Object"}`);
    };
    list.appendChild(b);
  }
}

function drawDeveloperVisualSizeOverlay(target,camX,camY){
  if(!devSizeEditing||!target)return;const b=developerVisualSizeBounds(target);if(!b)return;const zoom=developerCameraZoomValue(),x=b.x-camX,y=b.y-camY;
  ctx.fillStyle="rgba(99,230,255,.08)";ctx.strokeStyle="#63e6ff";ctx.lineWidth=2/zoom;ctx.fillRect(x,y,b.w,b.h);ctx.strokeRect(x,y,b.w,b.h);
  const handleSize=9/zoom,half=handleSize/2;ctx.fillStyle="#dffbff";ctx.strokeStyle="#176b7c";ctx.lineWidth=1/zoom;
  for(const [,wx,wy] of developerVisualSizeHandlePoints(target,b)){const px=wx-camX,py=wy-camY;ctx.fillRect(px-half,py-half,handleSize,handleSize);ctx.strokeRect(px-half,py-half,handleSize,handleSize);}
  ctx.font=`800 ${Math.max(8,10/zoom)}px system-ui`;ctx.fillStyle="#bff6ff";ctx.textAlign="left";const text=target.kind==="mob"?`SIZE • ${Math.round(b.h)}px • global type`:target.kind==="npc"?`SIZE • ${Math.round(numberOr(target.entity.displayHeight,b.h))}px • aspect locked`:`SIZE • ${Math.round(b.w)} × ${Math.round(b.h)}`;ctx.fillText(text,x,y-7/zoom);
}

function drawDeveloperSelectedEntityOverlay(entity,camX,camY){
  if(!entity) return;
  const b=developerEntityBounds(entity);
  const x=b.x-camX,y=b.y-camY;
  ctx.strokeStyle="#63e6ff";
  ctx.fillStyle="rgba(99,230,255,.05)";
  ctx.lineWidth=2/developerCameraZoomValue();
  ctx.fillRect(x-2,y-2,b.w+4,b.h+4);
  ctx.strokeRect(x-2,y-2,b.w+4,b.h+4);

  drawDeveloperVisualSizeOverlay({kind:developerIsNpc(entity)?"npc":"object",entity},camX,camY);

  if(devHitboxEditing){
    const hb=ensureDeveloperHitbox(entity);
    const hx=entity.x+hb.x-camX, hy=entity.y+hb.y-camY;
    ctx.fillStyle="rgba(255,209,102,.13)";
    ctx.strokeStyle="#ffd166";
    ctx.lineWidth=2/developerCameraZoomValue();
    ctx.fillRect(hx,hy,hb.w,hb.h);
    ctx.strokeRect(hx,hy,hb.w,hb.h);

    const handleSize=7/developerCameraZoomValue();
    const half=handleSize/2;
    const points=[
      [hx,hy],[hx+hb.w/2,hy],[hx+hb.w,hy],
      [hx,hy+hb.h/2],[hx+hb.w,hy+hb.h/2],
      [hx,hy+hb.h],[hx+hb.w/2,hy+hb.h],[hx+hb.w,hy+hb.h]
    ];
    ctx.fillStyle="#fff3c4";
    ctx.strokeStyle="#8a6817";
    ctx.lineWidth=1/developerCameraZoomValue();
    for(const [px,py] of points){
      ctx.fillRect(px-half,py-half,handleSize,handleSize);
      ctx.strokeRect(px-half,py-half,handleSize,handleSize);
    }
  }

  if(devInteractionEditing && !developerIsNpc(entity)){
    const a=ensureDeveloperInteractionArea(entity);
    const ix=entity.x+a.x-camX,iy=entity.y+a.y-camY;
    ctx.fillStyle="rgba(106,255,163,.14)";ctx.strokeStyle="#6affa3";ctx.lineWidth=2/developerCameraZoomValue();
    ctx.fillRect(ix,iy,a.w,a.h);ctx.strokeRect(ix,iy,a.w,a.h);
    const handleSize=7/developerCameraZoomValue(),half=handleSize/2;
    const points=[[ix,iy],[ix+a.w/2,iy],[ix+a.w,iy],[ix,iy+a.h/2],[ix+a.w,iy+a.h/2],[ix,iy+a.h],[ix+a.w/2,iy+a.h],[ix+a.w,iy+a.h]];
    ctx.fillStyle="#d9ffe8";ctx.strokeStyle="#23784a";ctx.lineWidth=1/developerCameraZoomValue();
    for(const [px,py] of points){ctx.fillRect(px-half,py-half,handleSize,handleSize);ctx.strokeRect(px-half,py-half,handleSize,handleSize);}
    ctx.font=`${Math.max(7,9/developerCameraZoomValue())}px system-ui`;ctx.fillStyle="#d9ffe8";ctx.fillText("INTERACT",ix+a.w+8,iy-2/developerCameraZoomValue());
  }

  if(devDepthEditing && developerEntityDepthMode(entity)==="ysort"){
    const depth=ensureDeveloperDepth(entity);
    const lineY=entity.y+depth.y-camY;
    ctx.strokeStyle="#d58cff";
    ctx.fillStyle="#f2d7ff";
    ctx.lineWidth=2/developerCameraZoomValue();
    ctx.beginPath();ctx.moveTo(x-8,lineY);ctx.lineTo(x+b.w+8,lineY);ctx.stroke();
    const r=5/developerCameraZoomValue();
    const cx=x+b.w/2;
    ctx.beginPath();
    ctx.moveTo(cx,lineY-r);ctx.lineTo(cx+r,lineY);ctx.lineTo(cx,lineY+r);ctx.lineTo(cx-r,lineY);ctx.closePath();ctx.fill();
    ctx.font=`${Math.max(7,9/developerCameraZoomValue())}px system-ui`;
    ctx.fillStyle="#f2d7ff";
    ctx.fillText("DEPTH",x+b.w+10,lineY-2/developerCameraZoomValue());
  }

  if(developerIsNpc(entity)){
    ctx.font="800 9px system-ui";ctx.textAlign="center";ctx.fillStyle="#dffbff";
    ctx.fillText(entity.name,entity.x-camX,y-7);ctx.textAlign="start";
  }
}

function drawDeveloperOverlay(camX,camY,viewW,viewH){
  ctx.save();
  ctx.lineWidth=1/developerCameraZoomValue();
  if(devShowGrid){
    ctx.strokeStyle="rgba(255,255,255,.10)";
    const step=devSnap;
    const startX=Math.floor(camX/step)*step;
    const startY=Math.floor(camY/step)*step;
    ctx.beginPath();
    for(let wx=startX;wx<camX+viewW;wx+=step){const x=wx-camX;ctx.moveTo(x,0);ctx.lineTo(x,viewH);}
    for(let wy=startY;wy<camY+viewH;wy+=step){const y=wy-camY;ctx.moveTo(0,y);ctx.lineTo(viewW,y);}
    ctx.stroke();
  }
  if(devShowHitboxes){
    for(const obj of sceneryProps){
      if(!obj.solid || !obj.hitbox) continue;
      const hb=obj.hitbox;
      ctx.fillStyle="rgba(255,75,75,.12)";
      ctx.strokeStyle="rgba(255,90,90,.8)";
      const x=obj.x+hb.x-camX,y=obj.y+hb.y-camY;
      ctx.fillRect(x,y,hb.w,hb.h);ctx.strokeRect(x,y,hb.w,hb.h);
    }
    for(const npc of sceneryNPCs){
      if(npc.solid===false || !npc.hitbox) continue;
      const hb=npc.hitbox;
      ctx.fillStyle="rgba(255,75,75,.12)";
      ctx.strokeStyle="rgba(255,90,90,.8)";
      const x=npc.x+hb.x-camX,y=npc.y+hb.y-camY;
      ctx.fillRect(x,y,hb.w,hb.h);ctx.strokeRect(x,y,hb.w,hb.h);
    }
  }
  if(devShowDepthLines){
    for(const obj of sceneryProps){
      if(worldObjectDepthMode(obj)!=="ysort") continue;
      const spec=worldObjectSpec(obj);
      if(!spec) continue;
      const y=obj.y+worldObjectDepthY(obj)-camY;
      const x=obj.x-camX;
      ctx.strokeStyle=obj===devSelected?"rgba(213,140,255,.95)":"rgba(213,140,255,.32)";
      ctx.lineWidth=(obj===devSelected?1.7:1)/developerCameraZoomValue();
      ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x+spec.w+3,y);ctx.stroke();
    }
    for(const npc of sceneryNPCs){
      if(npcDepthMode(npc)!=="ysort") continue;
      const b=npcVisualBounds(npc);
      const y=npc.y+npcDepthY(npc)-camY;
      const x=b.x-camX;
      ctx.strokeStyle=npc===devSelectedNpc?"rgba(213,140,255,.95)":"rgba(213,140,255,.32)";
      ctx.lineWidth=(npc===devSelectedNpc?1.7:1)/developerCameraZoomValue();
      ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x+b.w+3,y);ctx.stroke();
    }
  }
  if(devSelectedRemnant && devRemnantPreview){
    const b=developerRemnantPreviewBounds();
    const x=b.x-camX,y=b.y-camY;
    ctx.strokeStyle="#63e6ff";ctx.fillStyle="rgba(99,230,255,.05)";ctx.lineWidth=2/developerCameraZoomValue();
    ctx.fillRect(x-2,y-2,b.w+4,b.h+4);ctx.strokeRect(x-2,y-2,b.w+4,b.h+4);
    if(devShowDepthLines && lootRemnantDepthMode()==="ysort"){
      const lineY=devRemnantPreview.y+lootRemnantDepthY()-camY;
      ctx.strokeStyle="#d58cff";ctx.lineWidth=2/developerCameraZoomValue();ctx.beginPath();ctx.moveTo(x-8,lineY);ctx.lineTo(x+b.w+8,lineY);ctx.stroke();
      ctx.font=`${Math.max(7,9/developerCameraZoomValue())}px system-ui`;ctx.fillStyle="#f2d7ff";ctx.fillText("DEPTH",x+b.w+10,lineY-2/developerCameraZoomValue());
    }
  }
  if(devActiveTab==="terrain"){
    const minTx=Math.max(0,Math.floor(camX/TILE)-1),maxTx=Math.min(WORLD_W-1,Math.ceil((camX+viewW)/TILE)+1);
    const minTy=Math.max(0,Math.floor(camY/TILE)-1),maxTy=Math.min(WORLD_H-1,Math.ceil((camY+viewH)/TILE)+1);
    ctx.font=`${Math.max(8,11/developerCameraZoomValue())}px system-ui`;ctx.textAlign="center";
    for(let ty=minTy;ty<=maxTy;ty++)for(let tx=minTx;tx<=maxTx;tx++){
      if(!terrainIsHealing(world[ty]?.[tx]))continue;
      const x=tx*TILE-camX,y=ty*TILE-camY;
      ctx.fillStyle="rgba(120,244,190,.24)";ctx.fillRect(x,y,TILE,TILE);
      ctx.strokeStyle="rgba(189,255,224,.78)";ctx.lineWidth=2/developerCameraZoomValue();ctx.strokeRect(x+2,y+2,TILE-4,TILE-4);
      ctx.strokeStyle="rgba(130,255,205,.40)";ctx.lineWidth=1/developerCameraZoomValue();
      for(let d=-TILE;d<TILE*2;d+=14){ctx.beginPath();ctx.moveTo(x+d,y);ctx.lineTo(x+d+TILE,y+TILE);ctx.stroke();}
      ctx.font=`800 ${Math.max(10,15/developerCameraZoomValue())}px system-ui`;ctx.fillStyle="rgba(240,255,248,.98)";ctx.fillText("+",x+TILE/2,y+TILE/2+5/developerCameraZoomValue());
    }
    ctx.textAlign="start";
  }
  if(devActiveTab==="terrain" && devTerrainHoverTile){
    const {tx,ty}=devTerrainHoverTile;
    const bounds=developerTerrainBrushBounds(tx,ty);
    const x=bounds.x1*TILE-camX,y=bounds.y1*TILE-camY;
    const w=(bounds.x2-bounds.x1+1)*TILE,h=(bounds.y2-bounds.y1+1)*TILE;
    ctx.fillStyle=developerTerrainColor()+"55";
    ctx.strokeStyle="#f6efff";
    ctx.lineWidth=2/developerCameraZoomValue();
    ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);
    ctx.font=`${Math.max(8,10/developerCameraZoomValue())}px system-ui`;ctx.textAlign="center";ctx.fillStyle="#fff";
    ctx.fillText(developerTerrainType().name,x+w/2,y-5/developerCameraZoomValue());ctx.textAlign="start";
  }
  if(devActiveTab==="spawns"){
    for(const spawn of devMobSpawns){
      const x=spawn.x-camX,y=spawn.y-camY,selected=spawn.id===devSelectedSpawnId;
      ctx.strokeStyle=selected?"#63e6ff":"rgba(99,230,255,.55)";ctx.fillStyle=selected?"rgba(99,230,255,.18)":"rgba(99,230,255,.06)";ctx.lineWidth=(selected?2:1.2)/developerCameraZoomValue();
      ctx.beginPath();ctx.arc(x,y,selected?18:13,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(x-6,y);ctx.lineTo(x+6,y);ctx.moveTo(x,y-6);ctx.lineTo(x,y+6);ctx.stroke();
      ctx.font=`${Math.max(7,9/developerCameraZoomValue())}px system-ui`;ctx.textAlign="center";ctx.fillStyle=selected?"#dffbff":"rgba(223,251,255,.8)";ctx.fillText(mobTypeScaleLabel(spawn.mobType),x,y-20);ctx.textAlign="start";
    }
  }
  drawDeveloperSelectedEntityOverlay(developerSelectedEntity(),camX,camY);
  if(devSelectedMob && devSelectedMob.alive){
    const x=devSelectedMob.x-camX,y=devSelectedMob.y-camY;
    if(devSizeEditing&&devActiveTab==="scale")drawDeveloperVisualSizeOverlay({kind:"mob",entity:devSelectedMob,key:mobTypeScaleKey(devSelectedMob)},camX,camY);
    const scale=mobVisualScale(devSelectedMob);
    ctx.strokeStyle="#63e6ff";
    ctx.fillStyle="rgba(99,230,255,.10)";
    ctx.lineWidth=2/developerCameraZoomValue();
    ctx.beginPath();ctx.ellipse(x,y+8,(devSelectedMob.boss?28:20)*scale,(devSelectedMob.boss?13:9)*scale,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.font="800 10px system-ui";ctx.textAlign="center";ctx.fillStyle="#dffbff";
    ctx.fillText(`${mobTypeScaleLabel(mobTypeScaleKey(devSelectedMob))} ${scale.toFixed(2)}×`,x,y-(devSelectedMob.boss?44:34)*scale);
    ctx.textAlign="start";
  }
  drawDeveloperCameraOverlay(camX,camY);
  ctx.restore();
}

function refreshDeveloperPanel(rebuild=true){
  if(!devPanel) return;
  if(!rebuild){ refreshDeveloperInspectorValues(); return; }
  const inspector=devPanel.querySelector("#devInspector");
  if(!inspector) return;
  refreshDeveloperObjectList();
  refreshDeveloperObjectPalette();
  refreshDeveloperSelectionList();
  refreshDeveloperNpcPanel();
  refreshDeveloperSpawnPanel();
  refreshDeveloperQuestPanel();
  refreshDeveloperContentPanel();
  refreshDeveloperAssetPanel();
  refreshDeveloperAudioPanel();
  refreshDeveloperProjectPanel();
  refreshDeveloperZonePanel();
  refreshDeveloperTerrainPanel();
  refreshDeveloperMobPanel();
  refreshDeveloperCombatPanel();
  developerRefreshCameraUi?.();

  const entity=developerSelectedEntity();
  if(devSelectedRemnant && !entity && !devSelectedMob){
    const label=devSelectedRemnant==="lootable"?"Lootable Dust":"Dust";
    const mode=lootRemnantDepthMode();
    inspector.innerHTML=`
      <div class="devSelectedTitle">REMNANT • ${label}</div>
      <div class="devHint">This is a temporary World Builder preview. Scale and depth are global: both plain and lootable mob-death piles use the same settings. Drag the preview in the world to test overlap against the player, NPCs, and props.</div>
      <div class="devScaleControl"><div class="devScaleTop"><span>Remnant Scale</span><span id="devRemnantScaleValue">${LOOT_REMNANT_VISUAL.scale.toFixed(2)}×</span></div><input id="devRemnantScale" type="range" min="0.25" max="3.00" step="0.05" value="${LOOT_REMNANT_VISUAL.scale}"></div>
      <div class="devSubhead">Player overlap / depth</div>
      <label>Depth Mode<select id="devRemnantDepthMode"><option value="ysort" ${mode==="ysort"?"selected":""}>Y-Sort (recommended)</option><option value="behind" ${mode==="behind"?"selected":""}>Always Behind Player</option><option value="front" ${mode==="front"?"selected":""}>Always In Front of Player</option><option value="ground" ${mode==="ground"?"selected":""}>Ground / Floor</option></select></label>
      <label>Depth line Y offset<input id="devRemnantDepthY" type="range" min="-40" max="40" step="1" value="${lootRemnantDepthY()}" ${mode==="ysort"?"":"disabled"}></label>
      <div class="devPair"><label>Depth Y<input id="devRemnantDepthYNumber" type="number" min="-80" max="80" step="1" value="${lootRemnantDepthY()}" ${mode==="ysort"?"":"disabled"}></label><label>Preview<input value="${label}" disabled></label></div>
      <div class="devDepthEditHelp">With Y-Sort, the purple line is the pile's overlap anchor. Move the preview around and walk above/below it to test when the player passes behind or in front.</div>
      <div class="devRow"><button id="devRemnantNearPlayer">Move Preview Near Player</button><button id="devRemnantReset">Reset Remnant Visuals</button></div>`;
    const scaleInput=inspector.querySelector("#devRemnantScale");
    scaleInput.oninput=e=>{updateDeveloperRemnantVisual({scale:e.target.value});const out=inspector.querySelector("#devRemnantScaleValue");if(out)out.textContent=LOOT_REMNANT_VISUAL.scale.toFixed(2)+"×";saveDeveloperDraft();};
    inspector.querySelector("#devRemnantDepthMode").onchange=e=>{updateDeveloperRemnantVisual({depthMode:e.target.value});saveDeveloperDraft();refreshDeveloperPanel();};
    const depthSlider=inspector.querySelector("#devRemnantDepthY");
    const depthNumber=inspector.querySelector("#devRemnantDepthYNumber");
    const applyDepth=v=>{updateDeveloperRemnantVisual({depthY:v});if(depthSlider)depthSlider.value=LOOT_REMNANT_VISUAL.depthY;if(depthNumber)depthNumber.value=LOOT_REMNANT_VISUAL.depthY;saveDeveloperDraft();};
    depthSlider.oninput=e=>applyDepth(e.target.value);depthNumber.oninput=e=>applyDepth(e.target.value);
    inspector.querySelector("#devRemnantNearPlayer").onclick=()=>{devRemnantPreview.x=snapDev(state.x+56);devRemnantPreview.y=snapDev(state.y+8);devSetStatus("Remnant preview moved near the player");};
    inspector.querySelector("#devRemnantReset").onclick=()=>{Object.assign(LOOT_REMNANT_VISUAL,PROJECT_LOOT_REMNANT_VISUAL);saveDeveloperDraft();refreshDeveloperPanel();devSetStatus("Remnant scale/depth reset to project settings");};
    return;
  }
  if(!entity){
    inspector.innerHTML='<div class="devEmpty">Choose a prop, NPC, or Loot Remnant from the Selection Library, or click one directly in the world.</div>';
    return;
  }

  const hb=ensureDeveloperHitbox(entity);
  const depth=ensureDeveloperDepth(entity);
  const canEditDepth=depth.mode==="ysort";

  if(developerIsNpc(entity)){
    const npc=entity;
    const selectedNpcAsset=developerNpcAssetId(npc);
    const spriteChoices=developerNpcSpriteAssets().map(([id,asset])=>[id,asset?.name||id]);
    inspector.innerHTML=`
      <div class="devSelectedTitle">NPC • ${questEscape(npc.name)}</div>
      <div class="devHint">Visual placement tools for NPCs. Use the NPCs tab for ID, role, greeting, and quest setup.</div>
      <div class="devPair"><label>X<input id="devX" type="number" value="${Math.round(npc.x)}"></label><label>Y<input id="devY" type="number" value="${Math.round(npc.y)}"></label></div>
      <div class="devPair"><label>NPC Sprite Asset<select id="devNpcSelectionSprite">${spriteChoices.map(([v,l])=>`<option value="${questEscape(v)}" ${v===selectedNpcAsset?"selected":""}>${questEscape(l)}</option>`).join("")}</select></label><label>Facing<select id="devNpcSelectionFacing">${["down","right","left","up"].map(v=>`<option value="${v}" ${v===npc.facing?"selected":""}>${v}</option>`).join("")}</select></label></div>
      <label>Sprite Height<input id="devNpcSelectionHeight" type="number" min="24" value="${Math.round(npc.displayHeight)}"></label>
      <button id="devEditVisualSize" class="devSizeEditButton${devSizeEditing?" active":""}">${devSizeEditing?"Finish Visual Size":"Edit NPC Size Visually"}</button>
      <div class="devSizeEditHelp">${devSizeEditing?"Drag any blue corner handle around the NPC to resize it. NPC proportions stay locked and its world position/feet remain anchored.":"Resize the NPC directly in the world instead of guessing a Sprite Height number."}</div>
      <div class="devHint">Sprite Height updates live. Every NPC uses the same asset-driven sprite-sheet renderer.</div>
      <div class="devChecks"><label><input id="devSolid" type="checkbox" ${npc.solid!==false?"checked":""}> Hitbox / Solid</label></div>
      <div class="devSubhead">NPC collision hitbox</div>
      <div class="devQuad"><label>X<input id="devHbX" type="number" value="${hb.x}"></label><label>Y<input id="devHbY" type="number" value="${hb.y}"></label><label>W<input id="devHbW" type="number" value="${hb.w}"></label><label>H<input id="devHbH" type="number" value="${hb.h}"></label></div>
      <button id="devEditHitbox" class="devHitboxEditButton${devHitboxEditing?" active":""}">${devHitboxEditing?"Finish Hitbox Editing":"Edit NPC Hitbox Visually"}</button>
      <div class="devHitboxEditHelp">${devHitboxEditing?"Drag inside the yellow NPC hitbox to move it. Drag its corners/sides to resize it.":"NPC hitboxes are now editable with the same visual handles used by world props."}</div>
      <div class="devSubhead">NPC overlap / depth</div>
      <label>Depth Mode<select id="devDepthMode"><option value="ysort" ${depth.mode==="ysort"?"selected":""}>Y-Sort (recommended)</option><option value="behind" ${depth.mode==="behind"?"selected":""}>Always Behind Player</option><option value="front" ${depth.mode==="front"?"selected":""}>Always In Front of Player</option><option value="ground" ${depth.mode==="ground"?"selected":""}>Ground / Background</option></select></label>
      <label>Depth line Y offset<input id="devDepthY" type="number" value="${Math.round(depth.y)}" ${canEditDepth?"":"disabled"}></label>
      <button id="devEditDepth" class="devDepthEditButton${devDepthEditing?" active":""}" ${canEditDepth?"":"disabled"}>${devDepthEditing?"Finish Depth Editing":"Edit NPC Depth Line Visually"}</button>
      <div class="devDepthEditHelp">${canEditDepth?(devDepthEditing?"Drag the purple line up/down to decide when the NPC sorts behind or in front of houses, props, and the player.":"Use this to fix overlaps like an NPC appearing on the wrong side of a house wall. Move the line until the NPC sorts naturally from its feet."):"This fixed mode ignores the depth line. Switch to Y-Sort for a draggable overlap anchor."}</div>
      <div class="devRow"><button id="devApply">Apply</button><button id="devNpcDetails">NPC Details</button><button id="devDuplicate">Duplicate</button><button id="devDelete" class="danger">Delete</button></div>`;

    inspector.querySelector("#devEditVisualSize").onclick=()=>setDeveloperSizeEditing(!devSizeEditing);
    inspector.querySelector("#devEditHitbox").onclick=()=>setDeveloperHitboxEditing(!devHitboxEditing);
    inspector.querySelector("#devEditDepth").onclick=()=>setDeveloperDepthEditing(!devDepthEditing);
    inspector.querySelector("#devDepthMode").onchange=e=>{
      npc.depthMode=e.target.value;
      if(npc.depthMode!=="ysort"){devDepthEditing=false;devDepthDrag=null;} else ensureDeveloperDepth(npc);
      saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`NPC depth mode: ${e.target.options[e.target.selectedIndex].text}`);
    };
    const liveHeight=inspector.querySelector("#devNpcSelectionHeight");
    liveHeight.oninput=e=>{npc.displayHeight=Math.max(24,numberOr(e.target.value,npc.displayHeight));rebuildNpcCollision();};
    liveHeight.onchange=()=>saveDeveloperDraft();
    inspector.querySelector("#devNpcSelectionSprite").onchange=e=>{if(developerApplyNpcSpriteAsset(npc,e.target.value)){saveDeveloperDraft();refreshDeveloperPanel();}};
    inspector.querySelector("#devNpcSelectionFacing").onchange=e=>{npc.facing=e.target.value||"down";saveDeveloperDraft();};
    inspector.querySelector("#devApply").onclick=applyDeveloperNpcVisualInspector;
    inspector.querySelector("#devNpcDetails").onclick=()=>{setDeveloperTab("npcs");refreshDeveloperPanel();devSetStatus(`Editing ${npc.name} NPC details`);};
    inspector.querySelector("#devDuplicate").onclick=duplicateDeveloperNpc;
    inspector.querySelector("#devDelete").onclick=deleteDeveloperNpc;
    return;
  }

  const obj=entity;
  const interaction=worldObjectInteraction(obj);
  const ia=ensureDeveloperInteractionArea(obj);
  const esc=v=>devContentEscape(String(v??""));
  const option=(value,label,selected)=>`<option value="${esc(value)}" ${String(value)===String(selected)?"selected":""}>${esc(label)}</option>`;
  const zoneOptions=[["","No zone travel"],...(devProjectManifest?.zones||[]).map(z=>[z.id,z.name||z.id])].map(([v,l])=>option(v,l,interaction.actions.targetZone)).join("");
  const questOptions=[["","No quest requirement"],...questDefinitions.map(q=>[q.id,q.title])].map(([v,l])=>option(v,l,interaction.requirements.questId)).join("");
  const attachedQuestIds=new Set(interaction.actions.questIds||[]);
  const attachedQuestChecks=questDefinitions.length?questDefinitions.map(q=>`<label><input type="checkbox" data-dev-object-quest value="${esc(q.id)}" ${attachedQuestIds.has(q.id)?"checked":""}> ${esc(q.title)}</label>`).join(""):'<div class="devHint">No quests exist in this zone yet.</div>';
  const itemOptions=[["","No item"],...Object.keys(ITEM_DEFS).map(id=>[id,getItemDefinition(id).name])];
  const reqItemOptions=itemOptions.map(([v,l])=>option(v,l,interaction.requirements.itemId)).join("");
  const giveItemOptions=itemOptions.map(([v,l])=>option(v,l,interaction.actions.giveItemId)).join("");
  const lootOptions=[["","No loot table"],...Object.keys(LOOT_TABLES).map(id=>[id,id])].map(([v,l])=>option(v,l,interaction.actions.lootTable)).join("");
  const audioClipOptions=developerAudioRefOptions(interaction.soundId||"",{category:"sfx",includeSets:true,empty:"No interaction sound"});
  const emitter=obj.soundEmitter&&typeof obj.soundEmitter==="object"?obj.soundEmitter:{};
  const emitterOptions=developerAudioRefOptions(emitter.clipId||"",{category:"ambience",empty:"No looping emitter"});
  const objectDef=worldObjectDefinition(obj),objectName=objectDef?.name||obj.objectId||"Object";
  inspector.innerHTML=`
    <div class="devSelectedTitle">${devContentEscape(objectName)}</div>
    <label>Label<input id="devLabel" value="${String(obj.label||objectName).replace(/"/g,"&quot;")}"></label>
    <div class="devPair"><label>X<input id="devX" type="number" value="${Math.round(obj.x)}"></label><label>Y<input id="devY" type="number" value="${Math.round(obj.y)}"></label></div>
    ${worldObjectSpritePath(obj)?`<div class="devPair"><label>Display Width<input id="devObjectW" type="number" min="8" value="${Math.round(worldObjectSpec(obj)?.w||64)}"></label><label>Display Height<input id="devObjectH" type="number" min="8" value="${Math.round(worldObjectSpec(obj)?.h||64)}"></label></div><button id="devEditVisualSize" class="devSizeEditButton${devSizeEditing?" active":""}">${devSizeEditing?"Finish Visual Size":"Edit Object Size Visually"}</button><div class="devSizeEditHelp">${devSizeEditing?"Drag the blue corners or side handles around the sprite. The blue box changes the artwork size only; yellow hitboxes and green interaction areas remain independent.":"Resize the placed sprite directly in the world. You can still type exact width/height values when needed."}</div><label>Sprite<input value="${devContentEscape(worldObjectSpritePath(obj))}" readonly></label>`:""}
    <div class="devChecks"><label><input id="devSolid" type="checkbox" ${obj.solid?"checked":""}> Hitbox / Solid</label><label><input id="devInteractable" type="checkbox" ${obj.interactable?"checked":""}> Interactable</label></div>
    <div class="devSubhead">World Interaction</div>
    <div class="devHint">One shared system powers doors, buildings, gathering, quest props, chests, portals, and switches. The green area is what the player clicks or approaches.</div>
    <div class="devPair"><label>Interaction Type<select id="devInteractionType">${[["enter","Enter / Exit"],["gather","Gather"],["open","Open"],["examine","Examine"],["activate","Activate"],["custom","Custom"]].map(([v,l])=>option(v,l,interaction.type)).join("")}</select></label><label>Prompt<input id="devInteractionPrompt" value="${esc(interaction.prompt)}"></label></div>
    <div class="devSubhead">Open / Container Behavior</div>
    <div class="devHint">For Open interactions, choose persistent player storage or a loot-table chest. Storage keeps deposited items in the player save. Loot containers roll once and keep remaining loot until emptied.</div>
    <div class="devPair"><label>Open Behavior<select id="devOpenMode">${[["simple","Simple Open Action"],["storage","Storage Inventory"],["loot","Loot Container"]].map(([v,l])=>option(v,l,interaction.actions.openMode)).join("")}</select></label><label>Storage Slots<input id="devCapacity" type="number" min="1" max="60" value="${Math.max(1,obj.capacity||8)}"></label></div>
    <label>Loot Table<select id="devActionLoot">${lootOptions}</select></label>
    <div class="devPair"><label>Interaction Sound<select id="devInteractionSound">${audioClipOptions}</select></label><label><span>Preview</span><button type="button" id="devInteractionSoundPreview">▶ Preview Sound</button></label></div>
    <div class="devPair"><label>Interaction Tag<input id="devInteractionTag" value="${esc(interaction.tag||obj.id)}"></label><label>Range<input id="devInteractionRange" type="number" min="20" value="${Math.round(interaction.range)}"></label></div>
    <div class="devChecks"><label><input id="devInteractionClickable" type="checkbox" ${interaction.clickable?"checked":""}> Click / Tap</label><label><input id="devInteractionKeyable" type="checkbox" ${interaction.keyable?"checked":""}> E Key</label></div>
    <div class="devQuad"><label>Area X<input id="devIaX" type="number" value="${Math.round(ia.x)}"></label><label>Area Y<input id="devIaY" type="number" value="${Math.round(ia.y)}"></label><label>Area W<input id="devIaW" type="number" min="4" value="${Math.round(ia.w)}"></label><label>Area H<input id="devIaH" type="number" min="4" value="${Math.round(ia.h)}"></label></div>
    <button id="devEditInteractionArea" class="devHitboxEditButton${devInteractionEditing?" active":""}">${devInteractionEditing?"Finish Interaction Area":"Edit Interaction Area Visually"}</button>
    <div class="devHitboxEditHelp">${devInteractionEditing?"Drag inside the green interaction area to move it. Drag any corner or side handle to resize it. The Area X/Y/W/H fields update live while you drag, and typing those fields moves/resizes the box immediately.":"Use the visual editor like the yellow hitbox editor. Unsaved inspector changes are preserved when you enter or leave interaction-area editing."}</div>
    <div class="devSubhead">Requirements</div>
    <div class="devPair"><label>Quest<select id="devReqQuest">${questOptions}</select></label><label>Quest State<select id="devReqQuestState">${[["active","Quest Active"],["completed","Quest Completed"],["not-completed","Quest Not Completed"]].map(([v,l])=>option(v,l,interaction.requirements.questState)).join("")}</select></label></div>
    <div class="devPair"><label>Required Item<select id="devReqItem">${reqItemOptions}</select></label><label>Required Qty<input id="devReqItemQty" type="number" min="1" value="${interaction.requirements.itemQty}"></label></div>
    <div class="devSubhead">Actions</div>
    <label>Travel To Zone<select id="devActionZone">${zoneOptions}</select></label>
    <div class="devPair"><label>Destination X<input id="devActionX" type="number" placeholder="zone start" value="${interaction.actions.targetX==null?"":interaction.actions.targetX}"></label><label>Destination Y<input id="devActionY" type="number" placeholder="zone start" value="${interaction.actions.targetY==null?"":interaction.actions.targetY}"></label></div>
    <div class="devPair"><label>Give Item<select id="devActionItem">${giveItemOptions}</select></label><label>Give Qty<input id="devActionItemQty" type="number" min="1" value="${interaction.actions.giveItemQty}"></label></div>
    <label>Success Message<input id="devActionMessage" value="${esc(interaction.actions.message)}" placeholder="optional"></label>
    <div class="devChecks"><label><input id="devConsumeReqItem" type="checkbox" ${interaction.actions.consumeRequiredItem?"checked":""}> Consume required item</label><label><input id="devHideWhenUsed" type="checkbox" ${interaction.hideWhenUsed?"checked":""}> Hide after use / while respawning</label></div>
    <div class="devSubhead">Object Quests</div>
    <div class="devHint">Attach one or more quests. Offer Quests opens a quest list (good for notice boards). Start Automatically immediately accepts any attached quest that is currently available.</div>
    <label>Quest Behavior<select id="devQuestBehavior">${[["offer","Offer Quests"],["start","Start Automatically"]].map(([v,l])=>option(v,l,interaction.actions.questBehavior)).join("")}</select></label>
    <div class="devQuestAttachList">${attachedQuestChecks}</div>
    <div class="devPair"><label>Reuse / Loot Respawn<select id="devUseMode">${[["repeatable","Repeatable"],["once","One Time"],["timer","Reset on Timer"]].map(([v,l])=>option(v,l,interaction.useMode)).join("")}</select></label><label>Respawn / Reset Seconds<input id="devResetSeconds" type="number" min="1" value="${Math.round(interaction.resetSeconds)}"></label></div>
    <button id="devCreateInterior" class="devHitboxEditButton">Create & Link Interior Zone</button>
    <div class="devHint">Create & Link Interior makes a new zone, links this object as its entrance, and creates a return exit inside. Requires the project folder connection.</div>
    <div class="devSubhead">Ambient Sound Emitter</div>
    <div class="devHint">Optional positional looping sound for fireplaces, waterfalls, portals, fountains, machinery, and similar world objects.</div>
    <div class="devPair"><label>Looping Ambience<select id="devEmitterSound">${emitterOptions}</select></label><label>Volume %<input id="devEmitterVolume" type="number" min="0" max="200" value="${Math.round(numberOr(emitter.volume,.7)*100)}"></label></div>
    <div class="devPair"><label>Audible Range<input id="devEmitterRadius" type="number" min="50" max="3000" value="${Math.round(numberOr(emitter.radius,420))}"></label><label><span>Preview</span><button type="button" id="devEmitterPreview">▶ Preview Emitter</button></label></div>
    <div class="devSubhead">Hitbox offset / size</div>
    <div class="devQuad"><label>X<input id="devHbX" type="number" value="${hb.x}"></label><label>Y<input id="devHbY" type="number" value="${hb.y}"></label><label>W<input id="devHbW" type="number" value="${hb.w}"></label><label>H<input id="devHbH" type="number" value="${hb.h}"></label></div>
    <button id="devEditHitbox" class="devHitboxEditButton${devHitboxEditing?" active":""}">${devHitboxEditing?"Finish Hitbox Editing":"Edit Hitbox Visually"}</button>
    <div class="devHitboxEditHelp">${devHitboxEditing?"Drag inside the yellow hitbox to move it. Drag any corner or side handle to resize it. Hitbox editing is pixel-precise and does not use the world-placement Snap setting.":"Use the visual editor instead of typing coordinates. The numeric fields stay available for exact values."}</div>
    <div class="devSubhead">Player overlap / depth</div>
    <label>Depth Mode<select id="devDepthMode"><option value="ysort" ${depth.mode==="ysort"?"selected":""}>Y-Sort (recommended)</option><option value="behind" ${depth.mode==="behind"?"selected":""}>Always Behind Player</option><option value="front" ${depth.mode==="front"?"selected":""}>Always In Front of Player</option><option value="ground" ${depth.mode==="ground"?"selected":""}>Ground / Floor</option></select></label>
    <label>Depth line Y offset<input id="devDepthY" type="number" value="${Math.round(depth.y)}" ${canEditDepth?"":"disabled"}></label>
    <button id="devEditDepth" class="devDepthEditButton${devDepthEditing?" active":""}" ${canEditDepth?"":"disabled"}>${devDepthEditing?"Finish Depth Editing":"Edit Depth Line Visually"}</button>
    <div class="devDepthEditHelp">${canEditDepth?(devDepthEditing?"Drag the purple line up or down. Unlike the hitbox, the depth line can move outside the blue sprite box. Player feet above the line draw behind the object; feet below the line draw in front.":"Y-Sort compares the player's feet with this purple line. Use the fixed Behind/Front modes only when an object should never switch sides."):"This fixed depth mode ignores the Y-Sort line. Switch to Y-Sort to use a draggable depth anchor."}</div>

    <div class="devRow"><button id="devApply">Apply</button><button id="devDuplicate">Duplicate</button><button id="devDelete" class="danger">Delete</button></div>`;
  const preserveInspectorDraft=()=>syncDeveloperInspectorFromPanel({saveDraft:true});
  for(const id of ["devIaX","devIaY","devIaW","devIaH"]){
    const input=inspector.querySelector(`#${id}`);if(!input)continue;
    input.oninput=()=>updateDeveloperInteractionAreaFromInputs();
    input.onchange=()=>updateDeveloperInteractionAreaFromInputs({saveDraft:true});
  }
  inspector.querySelector("#devEditVisualSize")?.addEventListener("click",()=>{preserveInspectorDraft();setDeveloperSizeEditing(!devSizeEditing);});
  inspector.querySelector("#devEditInteractionArea").onclick=()=>{preserveInspectorDraft();setDeveloperInteractionEditing(!devInteractionEditing);};
  inspector.querySelector("#devCreateInterior").onclick=()=>{preserveInspectorDraft();createDeveloperInteriorForSelection();};
  inspector.querySelector("#devEditHitbox").onclick=()=>{preserveInspectorDraft();setDeveloperHitboxEditing(!devHitboxEditing);};
  inspector.querySelector("#devEditDepth").onclick=()=>{preserveInspectorDraft();setDeveloperDepthEditing(!devDepthEditing);};
  inspector.querySelector("#devDepthMode").onchange=e=>{
    preserveInspectorDraft();
    if(obj.depthMode!=="ysort"){devDepthEditing=false;devDepthDrag=null;} else ensureDeveloperDepth(obj);
    refreshDeveloperPanel();devSetStatus(`Depth mode: ${e.target.options[e.target.selectedIndex].text}`);
  };
  inspector.querySelector("#devInteractionType")?.addEventListener("change",()=>{preserveInspectorDraft();refreshDeveloperPanel(false);});
  inspector.querySelector("#devOpenMode")?.addEventListener("change",()=>{preserveInspectorDraft();refreshDeveloperPanel(false);});
  inspector.querySelector("#devInteractionSoundPreview")?.addEventListener("click",()=>{const id=inspector.querySelector("#devInteractionSound")?.value;if(id)developerAudioPreview(id);});
  inspector.querySelector("#devEmitterPreview")?.addEventListener("click",()=>{const id=inspector.querySelector("#devEmitterSound")?.value;if(id)developerAudioPreview(id);});
  inspector.querySelector("#devApply").onclick=applyDeveloperInspector;
  inspector.querySelector("#devDuplicate").onclick=()=>{preserveInspectorDraft();duplicateDeveloperSelection();};
  inspector.querySelector("#devDelete").onclick=deleteDeveloperSelection;
}

function updateVisualScaleControl(key,value){const n=visualScaleOr(value,VISUAL_SCALE[key]||1);VISUAL_SCALE[key]=Math.round(n*100)/100;if(devPanel){const out=devPanel.querySelector(`[data-scale-value="${key}"]`);if(out)out.textContent=VISUAL_SCALE[key].toFixed(2)+"×";}}
function setMobTypeDisplayHeight(key,value){if(!key||!BALANCE.mobs?.[key])return;const height=Math.round(Math.max(8,numberOr(value,BALANCE.mobs[key].displayHeight||MOB_SIZE_CLASS_HEIGHTS.medium)));BALANCE.mobs[key].displayHeight=height;const nearest=nearestMobSizeClass(height),preset=mobSizeClassHeight(nearest);BALANCE.mobs[key].sizeClass=Math.abs(height-preset)<=1?nearest:"custom";refreshMobTemplatesFromBalance?.();refreshDeveloperMobPanel();}
function selectDeveloperMobType(key){if(!BALANCE.mobs?.[key])return;const match=mobs.find(m=>mobTypeScaleKey(m)===key)||{spawnType:key,template:{configKey:key},boss:!!BALANCE.mobs[key].boss,alive:false};devSelectedMob=match;devCombatMobType=key;devSelected=null;devSelectedNpc=null;devSelectedRemnant=null;setDeveloperTab("scale");refreshDeveloperPanel();}
function refreshDeveloperMobPanel(){
  if(!devPanel)return;const panel=devPanel.querySelector("#devMobScalePanel");if(!panel)return;const key=mobTypeScaleKey(devSelectedMob),available=Object.keys(BALANCE.mobs||{});
  if(!key)panel.innerHTML='<div class="devEmpty">Click a mob in the world or choose a mob type below. World height belongs to each mob definition in Content.</div><div id="devMobTypeChips"></div>';
  else{const count=mobs.filter(m=>mobTypeScaleKey(m)===key).length,rec=BALANCE.mobs?.[key]||{},value=Math.max(8,numberOr(rec.displayHeight,mobSizeClassHeight(rec.sizeClass))),relative=mobRelativePlayerScale(value),canDrag=!!devSelectedMob?.alive;panel.innerHTML=`<div class="devMobSelectedTitle">${devContentEscape(mobTypeScaleLabel(key))}</div><div class="devMobMeta">Affects all ${count} ${devContentEscape(mobTypeScaleLabel(key))} spawn${count===1?"":"s"}. Source image resolution no longer changes this world size.</div><div class="devScaleControl"><div class="devScaleTop"><span>${devContentEscape(mobTypeScaleLabel(key))} visible height</span><span id="devSelectedMobScaleValue">${Math.round(value)}px • ${relative.toFixed(2)}× player</span></div><input id="devSelectedMobScale" type="range" min="8" max="120" step="1" value="${value}"></div><button id="devEditMobVisualSize" class="devSizeEditButton${devSizeEditing?" active":""}" ${canDrag?"":"disabled"}>${devSizeEditing?"Finish Visual Size":"Edit Mob Size Visually"}</button><div class="devSizeEditHelp">${canDrag?(devSizeEditing?"Drag a blue corner around the selected live mob. Mob proportions stay locked, and the new height applies to every mob of this type.":"Resize this mob directly in the world. The change applies to the whole mob type, not just this spawn."):"Click a live mob of this type in the world first to use drag-to-resize."}</div><div class="devRow"><button id="devResetMobScale">Reset ${devContentEscape(mobTypeScaleLabel(key))}</button></div><div id="devMobTypeChips"></div>`;panel.querySelector("#devSelectedMobScale").oninput=e=>setMobTypeDisplayHeight(key,e.target.value);panel.querySelector("#devEditMobVisualSize")?.addEventListener("click",()=>setDeveloperSizeEditing(!devSizeEditing));panel.querySelector("#devResetMobScale").onclick=()=>{BALANCE.mobs[key].displayHeight=mobTypeFallbackHeight(key);BALANCE.mobs[key].sizeClass=DEV_PROJECT_BALANCE?.mobs?.[key]?.sizeClass||nearestMobSizeClass(BALANCE.mobs[key].displayHeight);refreshMobTemplatesFromBalance?.();refreshDeveloperMobPanel();devSetStatus(`${mobTypeScaleLabel(key)} reset to ${Math.round(BALANCE.mobs[key].displayHeight)}px world height`);};}
  const chips=panel.querySelector("#devMobTypeChips");if(chips)for(const type of available){const b=document.createElement("button");b.className="devMobTypeChip"+(type===key?" active":"");b.textContent=mobTypeScaleLabel(type);b.onclick=()=>selectDeveloperMobType(type);chips.appendChild(b);}
}
function resetVisualScale(){Object.assign(VISUAL_SCALE,PROJECT_VISUAL_SCALE);Object.assign(LOOT_REMNANT_VISUAL,PROJECT_LOOT_REMNANT_VISUAL);for(const [id,mob] of Object.entries(BALANCE.mobs||{}))if(DEV_PROJECT_BALANCE?.mobs?.[id]){mob.displayHeight=Math.max(8,numberOr(DEV_PROJECT_BALANCE.mobs[id].displayHeight,mobSizeClassHeight(DEV_PROJECT_BALANCE.mobs[id].sizeClass)));mob.sizeClass=DEV_PROJECT_BALANCE.mobs[id].sizeClass||nearestMobSizeClass(mob.displayHeight);}refreshMobTemplatesFromBalance?.();if(!devPanel)return;devPanel.querySelectorAll("[data-scale-key]").forEach(input=>{input.value=VISUAL_SCALE[input.dataset.scaleKey];updateVisualScaleControl(input.dataset.scaleKey,input.value);});refreshDeveloperMobPanel();devSetStatus("Visual scale reset to project settings");}

function devBalanceClone(value){ return JSON.parse(JSON.stringify(value)); }
function devReplaceBalance(source){
  for(const key of Object.keys(BALANCE)) delete BALANCE[key];
  Object.assign(BALANCE,devBalanceClone(source));
}
function devCombatNum(value,fallback=0){
  const n=Number(value); return Number.isFinite(n)?n:fallback;
}
function devCombatField(field,label,value,step="1",min=null,max=null){
  return `<label class="devCombatField">${label}<input type="number" data-combat-field="${field}" value="${value}" step="${step}"${min!==null?` min="${min}"`:""}${max!==null?` max="${max}"`:""}></label>`;
}
function devGlobalField(field,label,value,step="1",min=null,max=null){
  return `<label class="devCombatField">${label}<input type="number" data-global-field="${field}" value="${value}" step="${step}"${min!==null?` min="${min}"`:""}${max!==null?` max="${max}"`:""}></label>`;
}
function devProgressionField(field,label,value,step="1",min=null,max=null){
  return `<label class="devCombatField">${label}<input type="number" data-progression-field="${field}" value="${value}" step="${step}"${min!==null?` min="${min}"`:""}${max!==null?` max="${max}"`:""}></label>`;
}
function developerXpNextForLevel(level){
  return xpRequiredForLevel(level);
}
function captureDeveloperPlayerBaseline(){
  if(devPlayerTestBaseline) return;
  devPlayerTestBaseline={level:state.level,xp:state.xp,xpNext:state.xpNext,hp:state.hp,maxHp:state.maxHp,atk:state.atk,def:state.def};
}
function applyDeveloperPlayerLevel(rawLevel){
  captureDeveloperPlayerBaseline();
  const level=Math.max(1,Math.min(playerLevelCap(),Math.floor(devCombatNum(rawLevel,state.level))));
  const steps=level-1;
  state.level=level;
  state.xp=0;
  state.xpNext=developerXpNextForLevel(level);
  state.maxHp=Math.max(1,Math.floor(numberOr(BALANCE.player?.maxHp,30)+steps*numberOr(BALANCE.progression?.hpPerLevel,8)));
  state.atk=Math.max(0,Math.floor(numberOr(BALANCE.player?.attack,5)+steps*numberOr(BALANCE.progression?.attackPerLevel,2)));
  state.def=Math.max(0,Math.floor(numberOr(BALANCE.player?.defense,1)+steps*numberOr(BALANCE.progression?.defensePerLevel,1)));
  state.hp=state.maxHp;
  refreshAliveMobStatsForPlayer();
  updateUI(); updateCombatHud(); refreshDeveloperCombatPanel();
  devSetStatus(`Player test level set to ${level}`);
}
function restoreDeveloperPlayerBaseline(){
  if(!devPlayerTestBaseline){devSetStatus("No player test-level baseline captured yet");return;}
  Object.assign(state,devPlayerTestBaseline);
  devPlayerTestBaseline=null;
  refreshAliveMobStatsForPlayer(); updateUI(); updateCombatHud(); refreshDeveloperCombatPanel();
  devSetStatus(`Restored player to level ${state.level}`);
}
function applyDeveloperSpeciesBalance(){
  if(!devPanel) return;
  const cfg=BALANCE.mobs?.[devCombatMobType];
  if(!cfg) return;
  const panel=devPanel.querySelector("#devCombatSpecies");
  panel?.querySelectorAll("[data-combat-field]").forEach(input=>{
    const key=input.dataset.combatField;
    cfg[key]=input.type==="checkbox"?input.checked:devCombatNum(input.value,cfg[key]);
  });
  cfg.baseLevel=Math.max(1,Math.floor(devCombatNum(cfg.baseLevel,1)));
  cfg.levelMin=Math.max(1,Math.floor(devCombatNum(cfg.levelMin,cfg.baseLevel)));
  cfg.levelMax=Math.max(cfg.levelMin,Math.floor(devCombatNum(cfg.levelMax,cfg.baseLevel)));
  cfg.hp=Math.max(1,devCombatNum(cfg.hp,1));
  cfg.attack=Math.max(0,devCombatNum(cfg.attack,0));
  cfg.defense=Math.max(0,devCombatNum(cfg.defense,0));
  cfg.xpMultiplier=Math.max(0,devCombatNum(cfg.xpMultiplier,1));
  cfg.eliteChancePercent=Math.max(0,Math.min(100,devCombatNum(cfg.eliteChancePercent,0)));
  refreshMobTemplatesFromBalance();
  refreshDeveloperCombatPanel(); updateCombatHud();
  devSetStatus(`${mobTypeScaleLabel(devCombatMobType)} combat settings applied live`);
}
function applyDeveloperGlobalCombatBalance(){
  if(!devPanel) return;
  BALANCE.mobLevels=BALANCE.mobLevels||{};
  devPanel.querySelectorAll("#devCombatGlobals [data-global-field]").forEach(input=>{
    BALANCE.mobLevels[input.dataset.globalField]=devCombatNum(input.value,BALANCE.mobLevels[input.dataset.globalField]);
  });
  BALANCE.progression=BALANCE.progression||{};
  devPanel.querySelectorAll("#devCombatGlobals [data-progression-field]").forEach(input=>{
    BALANCE.progression[input.dataset.progressionField]=devCombatNum(input.value,BALANCE.progression[input.dataset.progressionField]);
  });
  refreshMobTemplatesFromBalance(); refreshAliveMobStatsForPlayer(); updateCombatHud(); refreshDeveloperCombatPanel();
  devSetStatus("Global mob-level combat settings applied live");
}
function exportDeveloperBalance(){
  const text=`/* Exported from Little Realm Developer Mode */\nwindow.LR_BALANCE = ${JSON.stringify(BALANCE,null,2)};\n`;
  const blob=new Blob([text],{type:"text/javascript"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download="game-balance.js"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  devSetStatus("Exported game-balance.js");
}
function resetDeveloperCombatBalance(){
  if(!confirm("Reset live combat tuning to the project game-balance.js values?")) return;
  devReplaceBalance(DEV_PROJECT_BALANCE); refreshMobTemplatesFromBalance(); rerollMobLevelsAndElites(); refreshDeveloperCombatPanel(); updateCombatHud();
  devSetStatus("Combat tuning reset to project balance");
}
function developerMobPreview(){
  const mob=(devSelectedMob && mobTypeScaleKey(devSelectedMob)===devCombatMobType && devSelectedMob.alive)?devSelectedMob:mobs.find(m=>mobTypeScaleKey(m)===devCombatMobType && m.alive);
  if(!mob) return `<div class="devEmpty">No live ${mobTypeScaleLabel(devCombatMobType)} spawn available for preview.</div>`;
  const aggro=mobAggroRanges(mob);
  return `<div class="devHint">Live preview: Lv ${mob.level} ${mobDisplayName(mob)}${mob.dangerSteps?` • ${mob.dangerSteps} danger stack${mob.dangerSteps===1?"":"s"}`:""}</div><div class="devStatPreview"><div><b>${mob.maxHp}</b><span>HP</span></div><div><b>${mob.atk}</b><span>Damage</span></div><div><b>${mob.def}</b><span>Armor</span></div><div><b>${mobXpReward(mob)}</b><span>XP now</span></div><div><b>${Math.round(playerHitChanceAgainst(mob))}%</b><span>Your hit</span></div><div><b>${Math.round(mobHitChanceAgainstPlayer(mob))}%</b><span>Mob hit</span></div><div><b>${Math.round(aggro.trigger)}</b><span>Aggro</span></div><div><b>${mob.elite?"ELITE":mob.boss?"BOSS":"NORMAL"}</b><span>Rank</span></div></div>`;
}
function refreshDeveloperCombatPanel(){
  if(!devPanel) return;
  const player=devPanel.querySelector("#devPlayerTestPanel");
  const species=devPanel.querySelector("#devCombatSpecies");
  const globals=devPanel.querySelector("#devCombatGlobals");
  if(!player||!species||!globals) return;

  // Developer Mode is initialized before reset() creates the player state.
  // Do not let the optional tuning UI interrupt normal game startup.
  if(!state){
    player.innerHTML='<div class="devEmpty">Combat testing becomes available after the game finishes initializing.</div>';
    species.innerHTML='<div class="devEmpty">Mob tuning will load when Developer Mode is opened.</div>';
    globals.innerHTML='<div class="devEmpty">Global combat tuning will load when Developer Mode is opened.</div>';
    return;
  }

  player.innerHTML=`<div class="devPlayerTest"><label class="devCombatField">Player Test Level<input id="devPlayerTestLevel" type="number" min="1" max="100" step="1" value="${state.level}"></label><div><div class="devHint">Temporary testing control. Recalculates player HP/Attack/Defense and immediately refreshes danger scaling on living mobs.</div><div class="devQuickLevels">${[1,5,10,25,50,100].map(n=>`<button data-test-level="${n}">Lv ${n}</button>`).join("")}</div></div></div><div class="devStatPreview"><div><b>${state.level}</b><span>Level</span></div><div><b>${state.maxHp}</b><span>HP</span></div><div><b>${state.atk}</b><span>Attack</span></div><div><b>${state.def}</b><span>Defense</span></div></div><div class="devCombatActions"><button id="devSetPlayerLevel" class="primary">Apply Test Level</button><button id="devRestorePlayerLevel">Restore Before Testing</button><button id="devFullHeal">Full Heal</button></div>`;
  player.querySelector("#devSetPlayerLevel").onclick=()=>applyDeveloperPlayerLevel(player.querySelector("#devPlayerTestLevel").value);
  player.querySelectorAll("[data-test-level]").forEach(b=>b.onclick=()=>applyDeveloperPlayerLevel(b.dataset.testLevel));
  player.querySelector("#devRestorePlayerLevel").onclick=restoreDeveloperPlayerBaseline;
  player.querySelector("#devFullHeal").onclick=()=>{state.hp=state.maxHp;updateUI();devSetStatus("Player fully healed");};

  const types=Object.keys(BALANCE.mobs||{});
  if(!types.includes(devCombatMobType))devCombatMobType=types[0]||null;
  const cfg=BALANCE.mobs?.[devCombatMobType]||{};
  species.innerHTML=`<div id="devCombatMobChips">${types.map(k=>`<button class="devMobTypeChip${k===devCombatMobType?" active":""}" data-combat-mob="${k}">${mobTypeScaleLabel(k)}</button>`).join("")}</div><div class="devCombatGrid" style="margin-top:10px">${devCombatField("baseLevel","Base level",cfg.baseLevel??1,1,1,100)}${devCombatField("levelMin","Min spawn level",cfg.levelMin??cfg.baseLevel??1,1,1,100)}${devCombatField("levelMax","Max spawn level",cfg.levelMax??cfg.baseLevel??1,1,1,100)}${devCombatField("hp","Base HP",cfg.hp??1,1,1)}${devCombatField("attack","Base damage",cfg.attack??0,1,0)}${devCombatField("defense","Base armor",cfg.defense??0,.1,0)}${devCombatField("xpMultiplier","XP multiplier ×",cfg.xpMultiplier??1,.05,0)}${devCombatField("eliteChancePercent","Elite chance %",cfg.eliteChancePercent??0,.5,0,100)}${devCombatField("attackIntervalSeconds","Attack interval",cfg.attackIntervalSeconds??1.5,.05,.1)}${devCombatField("aggroTriggerRange","Base aggro range",cfg.aggroTriggerRange??0,1,0)}${devCombatField("alertRange","Base alert range",cfg.alertRange??0,1,0)}${devCombatField("chaseSpeed","Chase speed",cfg.chaseSpeed??0,1,0)}</div><label class="devCombatCheck" style="margin-top:9px"><input type="checkbox" data-combat-field="aggressive" ${cfg.aggressive?"checked":""}> Aggressive / auto-aggro</label>${developerMobPreview()}<div class="devCombatActions"><button id="devApplySpecies" class="primary">Apply ${mobTypeScaleLabel(devCombatMobType)} Stats</button><button id="devRerollSpecies">Reroll Levels + Elites</button></div>`;
  species.querySelectorAll("[data-combat-mob]").forEach(b=>b.onclick=()=>{devCombatMobType=b.dataset.combatMob;devSelectedMob=mobs.find(m=>mobTypeScaleKey(m)===devCombatMobType)||devSelectedMob;refreshDeveloperCombatPanel();});
  species.querySelector("#devApplySpecies").onclick=applyDeveloperSpeciesBalance;
  species.querySelector("#devRerollSpecies").onclick=()=>{applyDeveloperSpeciesBalance();rerollMobLevelsAndElites(devCombatMobType);refreshDeveloperCombatPanel();devSetStatus(`${mobTypeScaleLabel(devCombatMobType)} levels and elite rolls refreshed`);};

  const g=BALANCE.mobLevels||{};
  globals.innerHTML=`
  <details class="devCombatDetails" open><summary>Normal Level Scaling</summary><div class="devCombatGrid">${devGlobalField("hpGrowthPerLevelPercent","HP growth / level %",g.hpGrowthPerLevelPercent??14,.5)}${devGlobalField("attackGrowthPerLevelPercent","Damage growth / level %",g.attackGrowthPerLevelPercent??10,.5)}${devGlobalField("armorPerLevel","Armor / level",g.armorPerLevel??.55,.05)}</div></details>
  <details class="devCombatDetails" open><summary>High-Level Danger Boost</summary><div class="devCombatGrid">${devGlobalField("dangerStartsAbovePlayerLevels","Starts above player levels",g.dangerStartsAbovePlayerLevels??3,1,0)}${devGlobalField("dangerHpPerExtraLevelPercent","HP / danger level %",g.dangerHpPerExtraLevelPercent??12,.5)}${devGlobalField("dangerAttackPerExtraLevelPercent","Damage / danger level %",g.dangerAttackPerExtraLevelPercent??9,.5)}${devGlobalField("dangerArmorPerExtraLevel","Armor / danger level",g.dangerArmorPerExtraLevel??.6,.05)}${devGlobalField("dangerXpPerExtraLevelPercent","XP / danger level %",g.dangerXpPerExtraLevelPercent??10,.5)}</div></details>
  <details class="devCombatDetails"><summary>Elite Multipliers</summary><div class="devCombatGrid">${devGlobalField("eliteHpMultiplier","Elite HP ×",g.eliteHpMultiplier??1.65,.05)}${devGlobalField("eliteAttackMultiplier","Elite damage ×",g.eliteAttackMultiplier??1.2,.05)}${devGlobalField("eliteArmorBonus","Elite armor +",g.eliteArmorBonus??2,.1)}${devGlobalField("eliteXpMultiplier","Elite XP ×",g.eliteXpMultiplier??1.6,.05)}${devGlobalField("eliteGoldMultiplier","Elite gold ×",g.eliteGoldMultiplier??1.5,.05)}${devGlobalField("eliteAggroMultiplier","Elite aggro ×",g.eliteAggroMultiplier??1.15,.05)}</div></details>
  <details class="devCombatDetails"><summary>Boss Multipliers</summary><div class="devCombatGrid">${devGlobalField("bossHpMultiplier","Boss HP ×",g.bossHpMultiplier??1.5,.05)}${devGlobalField("bossAttackMultiplier","Boss damage ×",g.bossAttackMultiplier??1.25,.05)}${devGlobalField("bossArmorMultiplier","Boss armor ×",g.bossArmorMultiplier??1.25,.05)}${devGlobalField("bossXpMultiplier","Boss XP ×",g.bossXpMultiplier??1.75,.05)}${devGlobalField("bossAggroMultiplier","Boss aggro ×",g.bossAggroMultiplier??1.25,.05)}</div></details>
  <details class="devCombatDetails"><summary>Level-Based Aggro</summary><div class="devCombatGrid">${devGlobalField("aggroRangePerLevelDifference","Aggro / level diff",g.aggroRangePerLevelDifference??7,1)}${devGlobalField("alertRangePerLevelDifference","Alert / level diff",g.alertRangePerLevelDifference??9,1)}${devGlobalField("minimumAggroTriggerRange","Minimum aggro",g.minimumAggroTriggerRange??20,1,0)}${devGlobalField("minimumAlertRange","Minimum alert",g.minimumAlertRange??34,1,0)}</div></details>
  <details class="devCombatDetails"><summary>Hit / Miss</summary><div class="devCombatGrid">${devGlobalField("playerBaseHitChancePercent","Player base hit %",g.playerBaseHitChancePercent??96,.5,0,100)}${devGlobalField("enemyBaseHitChancePercent","Mob base hit %",g.enemyBaseHitChancePercent??92,.5,0,100)}${devGlobalField("playerHitChancePerLevelAdvantagePercent","Player hit / level %",g.playerHitChancePerLevelAdvantagePercent??4,.5)}${devGlobalField("enemyHitChancePerLevelAdvantagePercent","Mob hit / level %",g.enemyHitChancePerLevelAdvantagePercent??3,.5)}${devGlobalField("minimumHitChancePercent","Minimum hit %",g.minimumHitChancePercent??55,.5,0,100)}${devGlobalField("maximumHitChancePercent","Maximum hit %",g.maximumHitChancePercent??99,.5,0,100)}${devGlobalField("elitePlayerHitPenaltyPercent","Elite player penalty %",g.elitePlayerHitPenaltyPercent??3,.5)}${devGlobalField("eliteEnemyHitBonusPercent","Elite mob bonus %",g.eliteEnemyHitBonusPercent??3,.5)}${devGlobalField("bossPlayerHitPenaltyPercent","Boss player penalty %",g.bossPlayerHitPenaltyPercent??5,.5)}${devGlobalField("bossEnemyHitBonusPercent","Boss mob bonus %",g.bossEnemyHitBonusPercent??5,.5)}</div></details>
  <details class="devCombatDetails"><summary>XP Rules</summary><div class="devCombatGrid">${devProgressionField("sameLevelMobXpBase","Lv 1 standard mob XP",BALANCE.progression?.sameLevelMobXpBase??50,1,1)}${devProgressionField("sameLevelMobXpPerLevel","Standard mob XP / level +",BALANCE.progression?.sameLevelMobXpPerLevel??5,1,0)}${devGlobalField("trivialXpStartsAboveMobLevels","Level-gap XP floor starts",g.trivialXpStartsAboveMobLevels??5,1,1)}${devGlobalField("lowLevelXpPenaltyPerLevelPercent","Low-level penalty / level %",g.lowLevelXpPenaltyPerLevelPercent??20,.5)}${devGlobalField("higherLevelXpBonusPerLevelPercent","High-level XP bonus / level %",g.higherLevelXpBonusPerLevelPercent??8,.5)}</div><div class="devHint" style="margin-top:8px">A normal same-level hostile follows the level curve (50 XP at Lv 1, +5 per level by default). Species XP multipliers, elite/boss bonuses, and level-gap rules are applied after that.</div></details>
  <div class="devCombatActions"><button id="devApplyGlobals" class="primary">Apply Global Combat Settings</button><button id="devRerollAll">Reroll All Mob Levels + Elites</button><button id="devExportBalance">Export game-balance.js</button><button id="devResetBalance" class="danger">Reset Combat Tuning</button></div>`;
  globals.querySelector("#devApplyGlobals").onclick=applyDeveloperGlobalCombatBalance;
  globals.querySelector("#devRerollAll").onclick=()=>{applyDeveloperGlobalCombatBalance();rerollMobLevelsAndElites();refreshDeveloperCombatPanel();devSetStatus("All mob levels and elite rolls refreshed");};
  globals.querySelector("#devExportBalance").onclick=()=>{applyDeveloperSpeciesBalance();applyDeveloperGlobalCombatBalance();exportDeveloperBalance();};
  globals.querySelector("#devResetBalance").onclick=resetDeveloperCombatBalance;
}

function developerSafeId(value,fallback="id"){
  return String(value||fallback).trim().toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9_-]+/g,"")||fallback;
}

function developerNpcAssetOptions(selectedId=""){
  const entries=developerNpcSpriteAssets();
  const options=entries.map(([id,asset])=>`<option value="${questEscape(id)}" ${id===selectedId?"selected":""}>${questEscape(asset.name||id)}</option>`);
  if(!options.length)return '<option value="">No NPC Sprite assets imported</option>';
  return options.join("");
}

function refreshDeveloperNpcInspectorValues(){
  if(!devPanel||!devSelectedNpc) return;
  const root=devPanel.querySelector("#devNpcInspector");if(!root)return;
  const x=root.querySelector("#devNpcX"),y=root.querySelector("#devNpcY");if(x)x.value=Math.round(devSelectedNpc.x);if(y)y.value=Math.round(devSelectedNpc.y);
}

function updateQuestNpcReferences(oldId,newId){
  if(!oldId||oldId===newId) return;
  for(const quest of questDefinitions){
    if(quest.giverNpc===oldId) quest.giverNpc=newId;
    if(quest.turnInNpc===oldId) quest.turnInNpc=newId;
    for(const objective of quest.objectives) if(objective.type==="talk"&&objective.target===oldId) objective.target=newId;
  }
  if(activeNpcDialogId===oldId) activeNpcDialogId=newId;
}

function saveDeveloperNpc(){
  if(!devPanel||!devSelectedNpc)return;const root=devPanel.querySelector("#devNpcInspector");if(!root)return;
  const oldId=devSelectedNpc.id;let newId=developerSafeId(root.querySelector("#devNpcId")?.value,oldId||"npc");
  if(sceneryNPCs.some(n=>n!==devSelectedNpc&&n.id===newId)){devSetStatus(`NPC id '${newId}' is already in use`);return;}
  const spriteAsset=root.querySelector("#devNpcSpriteAsset")?.value||"";
  if(!developerApplyNpcSpriteAsset(devSelectedNpc,spriteAsset)){devSetStatus("Choose a valid NPC Sprite asset");return;}
  devSelectedNpc.id=newId;devSelectedNpc.name=root.querySelector("#devNpcName")?.value.trim()||newId;devSelectedNpc.role=root.querySelector("#devNpcRole")?.value.trim()||"Villager";
  devSelectedNpc.x=numberOr(root.querySelector("#devNpcX")?.value,devSelectedNpc.x);devSelectedNpc.y=numberOr(root.querySelector("#devNpcY")?.value,devSelectedNpc.y);devSelectedNpc.facing=root.querySelector("#devNpcFacing")?.value||"down";
  devSelectedNpc.displayHeight=Math.max(24,numberOr(root.querySelector("#devNpcHeight")?.value,58));devSelectedNpc.interactRadius=Math.max(24,numberOr(root.querySelector("#devNpcRange")?.value,58));
  devSelectedNpc.greeting=root.querySelector("#devNpcGreeting")?.value.trim()||`Hello. I'm ${devSelectedNpc.name}.`;devSelectedNpc.solid=!!root.querySelector("#devNpcSolid")?.checked;
  updateQuestNpcReferences(oldId,newId);rebuildNpcCollision();saveDeveloperDraft();refreshDeveloperPanel();refreshQuestUI();devSetStatus(`Saved NPC: ${devSelectedNpc.name}`);
}

function duplicateDeveloperNpc(){
  if(!devSelectedNpc)return;const copy=normalizeNpcRecord({...cloneNpc(devSelectedNpc),id:uniqueNpcId(devSelectedNpc.id),name:`${devSelectedNpc.name} Copy`,x:devSelectedNpc.x+devSnap*2,y:devSelectedNpc.y+devSnap*2},sceneryNPCs.length);
  sceneryNPCs.push(copy);devSelectedNpc=copy;rebuildNpcCollision();saveDeveloperDraft();refreshDeveloperPanel();
}

function deleteDeveloperNpc(){
  if(!devSelectedNpc)return;const refs=questDefinitions.filter(q=>q.giverNpc===devSelectedNpc.id||q.turnInNpc===devSelectedNpc.id||q.objectives.some(o=>o.type==="talk"&&o.target===devSelectedNpc.id));
  const warning=refs.length?` ${refs.length} quest(s) reference this NPC and will need repair.`:"";if(!confirm(`Delete ${devSelectedNpc.name}?${warning}`))return;
  const i=sceneryNPCs.indexOf(devSelectedNpc);if(i>=0)sceneryNPCs.splice(i,1);devSelectedNpc=null;rebuildNpcCollision();saveDeveloperDraft();refreshDeveloperPanel();refreshQuestUI();
}

function refreshDeveloperNpcPanel(){
  if(!devPanel)return;refreshDeveloperNpcAssetPalette();
  const list=devPanel.querySelector("#devNpcList"),inspector=devPanel.querySelector("#devNpcInspector"),count=devPanel.querySelector("#devNpcCount");if(count)count.textContent=`${sceneryNPCs.length} placed`;
  if(list){list.innerHTML="";for(const npc of sceneryNPCs){const b=document.createElement("button");b.className="devNpcChip"+(npc===devSelectedNpc?" active":"");b.textContent=`${npc.name} • ${npc.role}`;b.onclick=()=>{devSelectedNpc=npc;devSelected=null;devSelectedMob=null;devPlaceType=null;devPlaceNpcAsset=null;setDeveloperTab("npcs");refreshDeveloperPanel();};list.appendChild(b);}}
  if(!inspector)return;if(!devSelectedNpc){inspector.innerHTML='<div class="devEmpty">Choose an NPC from the list, click one in the world, or choose an NPC Sprite above and click the world to place it.</div>';return;}
  let selectedAsset=developerNpcAssetId(devSelectedNpc);if(!selectedAsset&&developerNpcSpriteAssets().length){selectedAsset=developerNpcSpriteAssets()[0][0];developerApplyNpcSpriteAsset(devSelectedNpc,selectedAsset);}
  const selectedRec=devAssets?.[selectedAsset];
  inspector.innerHTML=`<div class="devNpcInspector">
    <div class="devSelectedTitle">${questEscape(devSelectedNpc.name)}</div>
    <div class="devPair"><label>ID<input id="devNpcId" value="${questEscape(devSelectedNpc.id)}"></label><label>Name<input id="devNpcName" value="${questEscape(devSelectedNpc.name)}"></label></div>
    <div class="devPair"><label>Role<input id="devNpcRole" value="${questEscape(devSelectedNpc.role||"Villager")}"></label><label>NPC Sprite Asset<select id="devNpcSpriteAsset">${developerNpcAssetOptions(selectedAsset)}</select></label></div>
    ${selectedRec?`<div class="devHint">Using <b>${questEscape(selectedRec.name||selectedAsset)}</b> from the shared Asset Library. Lilly, Jorge, Farmer, and future NPC art all use this same path.</div>`:""}
    <div class="devPair"><label>X<input id="devNpcX" type="number" value="${Math.round(devSelectedNpc.x)}"></label><label>Y<input id="devNpcY" type="number" value="${Math.round(devSelectedNpc.y)}"></label></div>
    <div class="devPair"><label>Facing<select id="devNpcFacing">${["down","right","left","up"].map(v=>`<option value="${v}" ${v===devSelectedNpc.facing?"selected":""}>${v}</option>`).join("")}</select></label><label>Sprite Height<input id="devNpcHeight" type="number" min="24" value="${numberOr(devSelectedNpc.displayHeight,58)}"></label></div>
    <label>Talk Radius<input id="devNpcRange" type="number" min="24" value="${numberOr(devSelectedNpc.interactRadius,58)}"></label>
    <label>Greeting<textarea id="devNpcGreeting">${questEscape(devSelectedNpc.greeting||"")}</textarea></label>
    <label style="flex-direction:row;align-items:center"><input id="devNpcSolid" type="checkbox" ${devSelectedNpc.solid!==false?"checked":""}> Solid collision</label>
    <div class="devRow"><button id="devNpcSave">Save NPC</button><button id="devNpcDuplicate">Duplicate</button><button id="devNpcDelete" class="danger">Delete</button></div>
  </div>`;
  inspector.querySelector("#devNpcSave").onclick=saveDeveloperNpc;inspector.querySelector("#devNpcDuplicate").onclick=duplicateDeveloperNpc;inspector.querySelector("#devNpcDelete").onclick=deleteDeveloperNpc;
  const heightInput=inspector.querySelector("#devNpcHeight");heightInput.oninput=e=>{devSelectedNpc.displayHeight=Math.max(24,numberOr(e.target.value,devSelectedNpc.displayHeight));rebuildNpcCollision();refreshDeveloperInspectorValues();};heightInput.onchange=()=>saveDeveloperDraft();
  inspector.querySelector("#devNpcSpriteAsset").onchange=e=>{if(developerApplyNpcSpriteAsset(devSelectedNpc,e.target.value)){saveDeveloperDraft();refreshDeveloperPanel();}};
  inspector.querySelector("#devNpcFacing").onchange=e=>{devSelectedNpc.facing=e.target.value||"down";saveDeveloperDraft();};
}

function devQuestOptions(values,selected){
  return values.map(([value,label])=>`<option value="${questEscape(value)}" ${value===selected?"selected":""}>${questEscape(label)}</option>`).join("");
}
function developerObjectiveDefault(type="talk"){
  if(type==="kill")return normalizeQuestObjective({type,target:allMobTemplates()[0]?.configKey||"",amount:1});
  if(type==="collect"||type==="deliver")return normalizeQuestObjective({type,target:Object.keys(ITEM_DEFS)[0]||"",amount:1,consumeOnTurnIn:true});
  if(type==="visit")return normalizeQuestObjective({type,x:Math.round(state?.x||START_X),y:Math.round(state?.y||START_Y),radius:36,amount:1});
  if(type==="interact"){const first=sceneryProps.find(o=>worldObjectInteraction(o).enabled);return normalizeQuestObjective({type,target:first?(worldObjectInteraction(first).tag||first.id):"",amount:1});}
  return normalizeQuestObjective({type:"talk",target:sceneryNPCs[0]?.id||"",amount:1});
}
function developerNewQuest(){
  const giver=devSelectedNpc?.id||sceneryNPCs[0]?.id||"";
  const root=uniqueQuestId("new_quest");
  return normalizeQuestDefinition({id:root,title:"New Quest",description:"Describe what the player should do.",giverNpc:giver,turnInNpc:giver,openingDialogue:"Could you help me?",completionDialogue:"Thank you for your help.",level:1,levelRequirementMode:"auto",rewardTier:"minor",objectives:[developerObjectiveDefault("talk")],rewards:{xpMode:"auto",xp:0,gold:0,items:[]}},questDefinitions.length);
}
function uniqueQuestId(base="quest"){
  const root=String(base||"quest").toLowerCase().replace(/[^a-z0-9_-]+/g,"_")||"quest";let id=root,n=2;
  while(questDefinitions.some(q=>q.id===id))id=`${root}_${n++}`;return id;
}
function developerQuestTargetOptions(type,selected){
  let values=[];
  if(type==="kill") values=allMobTemplates().map(t=>[t.configKey||t.kind,t.name]);
  else if(type==="collect"||type==="deliver") values=Object.keys(ITEM_DEFS).map(id=>[id,getItemDefinition(id).name]);
  else if(type==="talk") values=sceneryNPCs.map(n=>[n.id,n.name]);
  else if(type==="interact"){
    const seen=new Set();
    values=sceneryProps.filter(o=>worldObjectInteraction(o).enabled).map(o=>{const cfg=worldObjectInteraction(o),value=cfg.tag||o.id;return [value,`${o.label||o.type} • ${value}`];}).filter(([value])=>value&&!seen.has(value)&&seen.add(value));
  }
  if(selected&&!values.some(([v])=>v===selected)) values.push([selected,selected]);
  return values;
}
function readDeveloperQuestForm(){
  const root=devPanel?.querySelector("#devQuestEditor");
  const fallback=devQuestFormDraft||getQuestDefinition(devSelectedQuestId)||developerNewQuest();
  if(!root)return cloneQuest(fallback);
  const objectives=[...root.querySelectorAll("[data-objective-index]")].map(row=>{
    const type=row.querySelector("[data-obj-type]")?.value||"talk";
    const amount=Math.max(1,Math.floor(numberOr(row.querySelector("[data-obj-amount]")?.value,1)));
    if(type==="visit")return normalizeQuestObjective({type,amount:1,x:row.querySelector("[data-obj-x]")?.value,y:row.querySelector("[data-obj-y]")?.value,radius:row.querySelector("[data-obj-radius]")?.value});
    return normalizeQuestObjective({type,target:row.querySelector("[data-obj-target]")?.value||"",amount,consumeOnTurnIn:row.querySelector("[data-obj-consume]")?.checked!==false});
  });
  const rewardItem=root.querySelector("#devQuestRewardItem")?.value||"";
  return normalizeQuestDefinition({
    id:root.querySelector("#devQuestId")?.value||fallback.id,
    title:root.querySelector("#devQuestTitle")?.value||fallback.title,
    description:root.querySelector("#devQuestDescription")?.value||"",
    giverNpc:root.querySelector("#devQuestGiver")?.value||"",
    turnInNpc:root.querySelector("#devQuestTurnIn")?.value||"",
    openingDialogue:root.querySelector("#devQuestOpening")?.value||"",
    completionDialogue:root.querySelector("#devQuestCompletion")?.value||"",
    level:root.querySelector("#devQuestLevel")?.value||fallback.level||1,
    levelRequirementMode:root.querySelector("#devQuestLevelRequirementMode")?.value||fallback.levelRequirementMode||"auto",
    minLevel:root.querySelector("#devQuestMinLevel")?.value||fallback.minLevel||1,
    rewardTier:root.querySelector("#devQuestRewardTier")?.value||fallback.rewardTier||"standard",
    objectives:objectives.length?objectives:[developerObjectiveDefault("talk")],
    rewards:{xpMode:root.querySelector("#devQuestXpMode")?.value||fallback.rewards?.xpMode||"custom",xp:root.querySelector("#devQuestRewardXp")?.value,gold:root.querySelector("#devQuestRewardGold")?.value,items:rewardItem?[{id:rewardItem,qty:root.querySelector("#devQuestRewardQty")?.value||1}]:[]},
    prerequisite:root.querySelector("#devQuestPrereq")?.value||null,
    nextQuest:root.querySelector("#devQuestNext")?.value||null,
    repeatable:!!root.querySelector("#devQuestRepeatable")?.checked
  });
}
function renderDeveloperQuestEditor(draft){
  const root=devPanel?.querySelector("#devQuestEditor");if(!root)return;
  draft=normalizeQuestDefinition(draft,questDefinitions.findIndex(q=>q.id===draft?.id));
  devQuestFormDraft=cloneQuest(draft);
  const npcOptions=[["","None / Object Offered"],...sceneryNPCs.map(n=>[n.id,n.name])];
  const questOptions=[["","None"],...questDefinitions.filter(q=>q.id!==draft.id).map(q=>[q.id,q.title])];
  const itemOptions=[["","No item reward"],...Object.keys(ITEM_DEFS).map(id=>[id,getItemDefinition(id).name])];
  const rewardTierOptions=Object.entries(QUEST_XP_PROFILE_LABELS).map(([id,label])=>[id,label]);
  const rewardItem=draft.rewards.items?.[0]?.id||"",rewardQty=draft.rewards.items?.[0]?.qty||1;
  const xpProfile=questXpProfile(draft.rewardTier,draft.repeatable&&draft.rewards.xpMode==="auto");
  const xpProfileLabel=QUEST_XP_PROFILE_LABELS[xpProfile.tier]||xpProfile.tier;
  const autoXp=draft.rewards.xpMode==="auto";
  const autoMin=draft.levelRequirementMode!=="custom";
  root.innerHTML=`<div class="devQuestEditor">
    <div class="devPair"><label>Quest ID<input id="devQuestId" value="${questEscape(draft.id)}"></label><label>Quest Name<input id="devQuestTitle" value="${questEscape(draft.title)}"></label></div>
    <label>Description<textarea id="devQuestDescription">${questEscape(draft.description)}</textarea></label>
    <div class="devSubhead">Level & Availability</div>
    <div class="devQuad"><label>Quest Level<input id="devQuestLevel" type="number" min="1" max="${playerLevelCap()}" value="${draft.level}"></label><label>Minimum Level<select id="devQuestLevelRequirementMode">${devQuestOptions([["auto","Automatic (-3 levels)"],["custom","Custom"]],draft.levelRequirementMode)}</select></label><label>Requires Level<input id="devQuestMinLevel" type="number" min="1" max="${draft.level}" value="${draft.minLevel}" ${autoMin?"readonly":""}></label><label>Recommended Through<input type="number" value="${draft.recommendedMaxLevel}" readonly></label></div>
    <div class="devHint">Quest Lv ${draft.level} becomes available at Lv ${draft.minLevel}. Recommended range: Lv ${draft.minLevel}–${draft.recommendedMaxLevel}. There is no maximum acceptance level, so players can always come back later.</div>
    <div class="devPair"><label>Quest Giver<select id="devQuestGiver">${devQuestOptions(npcOptions,draft.giverNpc)}</select></label><label>Turn-In NPC<select id="devQuestTurnIn">${devQuestOptions(npcOptions,draft.turnInNpc)}</select></label></div>
    <label>Opening Dialogue<textarea id="devQuestOpening">${questEscape(draft.openingDialogue)}</textarea></label>
    <label>Completion Dialogue<textarea id="devQuestCompletion">${questEscape(draft.completionDialogue)}</textarea></label>
    <div class="devSubhead">Objectives</div><div id="devQuestObjectives">${draft.objectives.map((objective,index)=>{
      const types=[["kill","Kill"],["collect","Collect"],["talk","Talk"],["deliver","Deliver"],["visit","Visit"],["interact","Interact With Object"]];
      const visit=objective.type==="visit";
      return `<div class="devQuestObjective" data-objective-index="${index}"><div class="devQuestObjectiveTop"><label>Type<select data-obj-type>${devQuestOptions(types,objective.type)}</select></label>${visit?`<label>Location<span style="padding:9px 0;color:#b9aebe">World coordinates</span></label>`:`<label>Target<select data-obj-target>${devQuestOptions(developerQuestTargetOptions(objective.type,objective.target),objective.target)}</select></label>`}<label>Amount<input data-obj-amount type="number" min="1" value="${objective.amount}" ${visit?"disabled":""}></label><button data-remove-objective="${index}" title="Remove objective">×</button></div>${visit?`<div class="devVisitGrid"><label>X<input data-obj-x type="number" value="${Math.round(objective.x)}"></label><label>Y<input data-obj-y type="number" value="${Math.round(objective.y)}"></label><label>Radius<input data-obj-radius type="number" min="8" value="${Math.round(objective.radius)}"></label></div><button data-use-player-pos="${index}" style="margin-top:6px;border:1px solid rgba(255,255,255,.12);background:#4b4056;color:#fff;border-radius:7px;padding:6px 8px">Use Player Position</button>`:(objective.type==="collect"||objective.type==="deliver")?`<label style="flex-direction:row;align-items:center"><input data-obj-consume type="checkbox" ${objective.consumeOnTurnIn!==false?"checked":""}> Consume items on turn-in</label>`:""}</div>`;
    }).join("")}</div>
    <button id="devAddQuestObjective" class="devHitboxEditButton">+ Add Objective</button>
    <div class="devSubhead">Rewards</div>
    <div class="devPair"><label>XP Mode<select id="devQuestXpMode">${devQuestOptions([["auto","Automatic"],["custom","Custom"]],draft.rewards.xpMode)}</select></label><label>XP Profile<select id="devQuestRewardTier" ${draft.repeatable&&autoXp?"disabled":""}>${devQuestOptions(rewardTierOptions,xpProfile.tier)}</select></label></div>
    <div class="devHint">${autoXp?`Auto XP: <b>${draft.rewards.xp} XP</b> • ${questEscape(xpProfileLabel)} • ${xpProfile.mobEquivalent} same-level mob equivalents • capped at ${xpProfile.levelCapPercent}% of this level.${draft.repeatable?" Repeatable quests automatically use the Repeatable profile.":""}`:"Custom XP ignores the automatic quest-level formula."}</div>
    <div class="devQuad"><label>XP<input id="devQuestRewardXp" type="number" min="0" value="${draft.rewards.xp}" ${autoXp?"readonly":""}></label><label>Gold<input id="devQuestRewardGold" type="number" min="0" value="${draft.rewards.gold}"></label><label>Item<select id="devQuestRewardItem">${devQuestOptions(itemOptions,rewardItem)}</select></label><label>Qty<input id="devQuestRewardQty" type="number" min="1" value="${rewardQty}"></label></div>
    <div class="devPair"><label>Prerequisite<select id="devQuestPrereq">${devQuestOptions(questOptions,draft.prerequisite||"")}</select></label><label>Next Quest<select id="devQuestNext">${devQuestOptions(questOptions,draft.nextQuest||"")}</select></label></div>
    <label style="flex-direction:row;align-items:center"><input id="devQuestRepeatable" type="checkbox" ${draft.repeatable?"checked":""}> Repeatable quest</label>
    <div class="devRow"><button id="devQuestSave">Save Quest</button><button id="devQuestTest">Reset Test Progress</button></div>
  </div>`;
  root.querySelectorAll("[data-obj-type]").forEach((select,index)=>select.onchange=()=>{
    const next=readDeveloperQuestForm();const type=select.value;next.objectives[index]=developerObjectiveDefault(type);
    if(next.rewards.xpMode==="auto"&&!next.repeatable) next.rewardTier=inferQuestRewardTier(next.objectives,false);
    devQuestFormDraft=next;renderDeveloperQuestEditor(next);
  });
  root.querySelectorAll("[data-remove-objective]").forEach(button=>button.onclick=()=>{const next=readDeveloperQuestForm();next.objectives.splice(Number(button.dataset.removeObjective),1);if(!next.objectives.length)next.objectives.push(developerObjectiveDefault("talk"));if(next.rewards.xpMode==="auto"&&!next.repeatable)next.rewardTier=inferQuestRewardTier(next.objectives,false);renderDeveloperQuestEditor(next);});
  root.querySelectorAll("[data-use-player-pos]").forEach(button=>button.onclick=()=>{const next=readDeveloperQuestForm();const objective=next.objectives[Number(button.dataset.usePlayerPos)];objective.x=Math.round(state.x);objective.y=Math.round(state.y);renderDeveloperQuestEditor(next);});
  root.querySelector("#devAddQuestObjective").onclick=()=>{const next=readDeveloperQuestForm();next.objectives.push(developerObjectiveDefault("kill"));if(next.rewards.xpMode==="auto"&&!next.repeatable)next.rewardTier="multi";renderDeveloperQuestEditor(next);};
  ["devQuestLevel","devQuestLevelRequirementMode","devQuestMinLevel","devQuestXpMode","devQuestRewardTier","devQuestRepeatable"].forEach(id=>{const input=root.querySelector(`#${id}`);if(input)input.onchange=()=>renderDeveloperQuestEditor(readDeveloperQuestForm());});
  root.querySelector("#devQuestSave").onclick=saveDeveloperQuest;
  root.querySelector("#devQuestTest").onclick=()=>{const id=readDeveloperQuestForm().id;delete ensureQuestState()[id];refreshQuestUI();renderNpcDialogue();devSetStatus(`Reset test progress for ${id}`);};
}
function saveDeveloperQuest(){
  const oldId=devSelectedQuestId;const next=readDeveloperQuestForm();
  let newId=String(next.id||oldId||"quest").trim().toLowerCase().replace(/[^a-z0-9_-]+/g,"_");
  if(!newId)newId="quest";
  if(questDefinitions.some(q=>q.id===newId&&q.id!==oldId)){devSetStatus(`Quest id '${newId}' is already in use`);return;}
  next.id=newId;
  const i=questDefinitions.findIndex(q=>q.id===oldId);if(i>=0)questDefinitions[i]=normalizeQuestDefinition(next,i);else questDefinitions.push(normalizeQuestDefinition(next,questDefinitions.length));
  if(oldId&&oldId!==newId){
    for(const quest of questDefinitions){if(quest.prerequisite===oldId)quest.prerequisite=newId;if(quest.nextQuest===oldId)quest.nextQuest=newId;}
    for(const obj of sceneryProps){const ids=obj?.interaction?.actions?.questIds;if(Array.isArray(ids))obj.interaction.actions.questIds=ids.map(id=>id===oldId?newId:id);}
    const qs=ensureQuestState();if(qs[oldId]){qs[newId]=qs[oldId];delete qs[oldId];}
  }
  devSelectedQuestId=newId;devQuestFormDraft=cloneQuest(getQuestDefinition(newId));saveDeveloperDraft();refreshDeveloperQuestPanel();refreshQuestUI();devSetStatus(`Saved quest: ${next.title}`);
}
function refreshDeveloperQuestPanel(){
  if(!devPanel)return;
  const list=devPanel.querySelector("#devQuestList"),editor=devPanel.querySelector("#devQuestEditor"),count=devPanel.querySelector("#devQuestCount");
  if(count)count.textContent=`${questDefinitions.length} quest${questDefinitions.length===1?"":"s"}`;
  if(!devSelectedQuestId||!getQuestDefinition(devSelectedQuestId))devSelectedQuestId=questDefinitions[0]?.id||null;
  if(list){list.innerHTML="";const query=String(devPanel.querySelector("#devQuestSearch")?.value||"").trim().toLowerCase();for(const quest of questDefinitions){if(query&&!`${quest.title||""} ${quest.id||""}`.toLowerCase().includes(query))continue;const b=document.createElement("button");b.className="devQuestChip"+(quest.id===devSelectedQuestId?" active":"");b.textContent=`Lv ${quest.level} • ${quest.title}`;b.title=`${quest.id} • requires Lv ${quest.minLevel}`;b.onclick=()=>{devSelectedQuestId=quest.id;devQuestFormDraft=cloneQuest(quest);refreshDeveloperQuestPanel();};list.appendChild(b);}}
  if(!editor)return;
  if(!devSelectedQuestId){editor.innerHTML='<div class="devEmpty">No quests yet. Click New Quest to create one.</div>';return;}
  const selected=getQuestDefinition(devSelectedQuestId);if(!devQuestFormDraft||devQuestFormDraft.id!==selected.id)devQuestFormDraft=cloneQuest(selected);renderDeveloperQuestEditor(devQuestFormDraft);
}
function createDeveloperQuest(){
  const quest=developerNewQuest();questDefinitions.push(quest);devSelectedQuestId=quest.id;devQuestFormDraft=cloneQuest(quest);setDeveloperTab("quests");saveDeveloperDraft();refreshDeveloperPanel();
}
function duplicateDeveloperQuest(){
  const source=getQuestDefinition(devSelectedQuestId);if(!source)return;const copy=cloneQuest(source);copy.id=uniqueQuestId(`${source.id}_copy`);copy.title=`${source.title} Copy`;questDefinitions.push(normalizeQuestDefinition(copy,questDefinitions.length));devSelectedQuestId=copy.id;devQuestFormDraft=cloneQuest(copy);saveDeveloperDraft();refreshDeveloperQuestPanel();
}
function deleteDeveloperQuest(){
  const quest=getQuestDefinition(devSelectedQuestId);if(!quest)return;if(!confirm(`Delete quest '${quest.title}'?`))return;
  questDefinitions=questDefinitions.filter(q=>q.id!==quest.id);for(const other of questDefinitions){if(other.prerequisite===quest.id)other.prerequisite=null;if(other.nextQuest===quest.id)other.nextQuest=null;}for(const obj of sceneryProps){const ids=obj?.interaction?.actions?.questIds;if(Array.isArray(ids))obj.interaction.actions.questIds=ids.filter(id=>id!==quest.id);}delete ensureQuestState()[quest.id];devSelectedQuestId=questDefinitions[0]?.id||null;devQuestFormDraft=null;saveDeveloperDraft();refreshDeveloperQuestPanel();refreshQuestUI();
}

function refreshDeveloperProjectPanel(){
  if(!devPanel)return;
  const el=devPanel.querySelector("#devProjectSummary");
  if(el){
    const connection=devProjectDirectoryHandle?`folder connected • ${devProjectZone?.name||devProjectZone?.id||"zone"}`:`local project loaded • folder not connected`;
    const dirty=developerProjectDirtyDetails?.();
    el.textContent=`${sceneryProps.length} props • ${sceneryNPCs.length} placed NPCs • ${devMobSpawns.length} mob spawns • ${questDefinitions.length} quests • ${Object.keys(ITEM_DEFS).length} items • ${Object.keys(BALANCE.mobs||{}).length} mob types • ${Object.keys(devAssets).length} assets • ${connection}${dirty?.dirty?" • UNSAVED CHANGES":""}`;
  }
  refreshDeveloperProjectHealthPanel?.();
}

function buildDeveloperPanel(){
  ensureDeveloperStyles();
  const root=document.createElement("aside");
  root.id="devPanel";
  root.innerHTML=`
    <div class="devHeader"><div><b>WORLD BUILDER</b><span>F2 to close • Esc returns to Select • one-shot placement by default</span></div><button id="devClose">×</button></div>
    <div class="devToolbar">
      <button id="devSelect" class="active">Select / Move</button>
      <label>Snap <select id="devSnap"><option>4</option><option selected>8</option><option>16</option><option>32</option><option>64</option></select></label>
      <label><input id="devGrid" type="checkbox" checked> Grid</label>
      <label><input id="devHitboxes" type="checkbox" checked> Hitboxes</label>
      <label><input id="devDepthLines" type="checkbox" checked> Depth Lines</label>
    </div>
    <div class="devTabs">
      <button class="devTab active" data-dev-tab="objects">Objects</button>
      <button class="devTab" data-dev-tab="terrain">Terrain</button>
      <button class="devTab" data-dev-tab="npcs">NPCs</button>
      <button class="devTab" data-dev-tab="spawns">Spawns</button>
      <button class="devTab" data-dev-tab="quests">Quests</button>
      <button class="devTab" data-dev-tab="content">Content</button>
      <button class="devTab" data-dev-tab="assets">Assets</button>
      <button class="devTab" data-dev-tab="audio">Audio</button>
      <button class="devTab" data-dev-tab="zones">Zones</button>
      <button class="devTab" data-dev-tab="selection">Inspector</button>
      <button class="devTab" data-dev-tab="scale">Visual Scale</button>
      <button class="devTab" data-dev-tab="combat">Combat Test</button>
      <button class="devTab" data-dev-tab="project">Project</button>
    </div>
    <div class="devContextBar">
      <div id="devToolMode" class="devToolMode select">SELECT / MOVE • Esc returns here</div>
      <label class="devRepeatPlacement" title="Keep the chosen object/NPC/spawn tool active after each placement"><input id="devRepeatPlacement" type="checkbox"><span>Repeat placement</span></label>
      <button id="devFinishTool">Select Active</button>
    </div>
    <div class="devCameraBar">
      <div class="devCameraModes"><button data-dev-camera-mode="player" class="active">Player Camera</button><button data-dev-camera-mode="free">Free Camera</button><button data-dev-camera-mode="world">World View</button></div>
      <div id="devCameraReadout" class="devCameraReadout">PLAYER CAMERA • 185%</div>
      <div class="devCameraActions"><button id="devCameraZoomOut" title="Zoom out in Free Camera">−</button><button id="devCameraZoomIn" title="Zoom in in Free Camera">+</button><button id="devCameraCenterPlayer">Center Player</button><button id="devCameraCenterSelection">Center Selection</button><button id="devMovePlayerToCamera" class="primary">Move Player Here</button></div>
    </div>
    <div id="devSectionNav" class="devSectionNav"></div>
    <div class="devBody">
      <section class="devView active" data-dev-view="objects">
        <div class="devMasterDetail">
          <div class="devMasterPane"><div class="devSection"><div class="devSectionTitle">Object Library <span id="devObjectLibraryCount" class="devTitleCount"></span></div><input id="devObjectSearch" class="devSearchInput" placeholder="Search objects…"><div class="devHint">Choose an object and click the world. All placeable objects use this same library.</div><div id="devObjectPalette"></div></div></div>
          <div class="devDetailPane"><div class="devSection"><div class="devSectionTitle">Existing Objects <span id="devObjectCount" class="devTitleCount"></span></div><input id="devPlacedObjectSearch" class="devSearchInput" placeholder="Search placed objects…"><div id="devObjectList"></div></div></div>
        </div>
      </section>
      <section class="devView" data-dev-view="terrain">
        <div class="devMasterDetail terrainLayout">
          <div class="devMasterPane">
            <div class="devSection"><div class="devSectionTitle">Terrain Painter</div><div id="devTerrainSummary" class="devHint"></div><input id="devTerrainSearch" class="devSearchInput" placeholder="Search terrain…"><div id="devTerrainPalette"></div><div class="devPair" style="margin-top:9px"><label>Brush Size<select id="devTerrainBrushSize"><option value="1">1 × 1 tile</option><option value="3">3 × 3 tiles</option><option value="5">5 × 5 tiles</option><option value="7">7 × 7 tiles</option><option value="9">9 × 9 tiles</option><option value="15">15 × 15 tiles</option><option value="25">25 × 25 tiles</option></select></label><label>Paint Mode<input value="Click + drag" readonly></label></div></div>
            <div class="devSection" data-default-collapsed="true"><div class="devSectionTitle">Terrain Library</div><button id="devTerrainNew" class="devWideButton primary">New Terrain</button><div class="devPair" style="margin-top:10px"><label>New Zone Ground<select id="devTerrainDefaultGround"></select></label><label>New Zone Boundary<select id="devTerrainDefaultBoundary"></select></label></div></div>
          </div>
          <div class="devDetailPane">
            <div class="devSection"><div class="devSectionTitle">Selected Terrain</div><div id="devTerrainInspector"></div></div>
            <div class="devSection" data-default-collapsed="true"><div class="devSectionTitle">World Beyond Zone</div><label>Terrain Beyond Map<select id="devTerrainBackdrop"></select></label><div id="devTerrainBackdropNote" class="devHint"></div><button id="devTerrainMatchEdge" class="devWideButton">Match Outer 2-Tile Edge To This Terrain</button></div>
            <div class="devSection" data-default-collapsed="true"><div class="devSectionTitle">Terrain Actions</div><div class="devProjectBig"><button id="devTerrainFillInterior">Fill Interior With Selected</button><button id="devTerrainFillAll">Fill Entire Zone With Selected</button><button id="devTerrainResetBlank" class="danger">Reset to Blank Terrain</button></div></div>
          </div>
        </div>
      </section>
      <section class="devView" data-dev-view="npcs">
        <div class="devSection"><div class="devSectionTitle">NPC Sprite Palette</div><input id="devNpcSearch" class="devSearchInput" placeholder="Search NPC sprites…"><div class="devHint">Every registered <b>NPC Sprite</b> asset appears here. Choose one, then click the world to create a new independent NPC using that artwork. No template is required.</div><div id="devNpcAssetPalette" class="devNpcPalette"></div></div>
        <div class="devSection"><div class="devSectionTitle">Existing NPCs <span id="devNpcCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><div id="devNpcList"></div></div>
        <div class="devSection"><div class="devSectionTitle">NPC Inspector</div><div id="devNpcInspector"></div></div>
      </section>
      <section class="devView" data-dev-view="spawns">
        <div class="devSection"><div class="devSectionTitle">Mob Spawn Palette</div><input id="devSpawnSearch" class="devSearchInput" placeholder="Search mob types…"><div class="devHint">Choose any Mob Type from the shared Content Library, then click a walkable point in the world. The spawn becomes part of this zone.</div><div id="devSpawnPalette"></div></div>
        <div class="devSection"><div class="devSectionTitle">Zone Spawns <span id="devSpawnCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><div class="devHint">Open this tab to show spawn-home rings in the world. Click or drag a ring/mob to reposition its home point.</div><div id="devSpawnList"></div></div>
        <div class="devSection"><div class="devSectionTitle">Spawn Inspector</div><div id="devSpawnInspector"></div></div>
      </section>
      <section class="devView" data-dev-view="quests">
        <div class="devSection"><div class="devSectionTitle">Quest Library <span id="devQuestCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><input id="devQuestSearch" class="devSearchInput" placeholder="Search quests…"><div class="devHint">Create quests from dropdowns instead of code. Objectives can kill, collect, talk, deliver, or visit a world position.</div><div id="devQuestList"></div><div class="devQuestListActions"><button id="devNewQuest">New Quest</button><button id="devDuplicateQuest">Duplicate</button><button id="devDeleteQuest">Delete</button></div></div>
        <div class="devSection"><div class="devSectionTitle">Quest Maker</div><div id="devQuestEditor"></div></div>
      </section>
      <section class="devView" data-dev-view="content">
        <div class="devSection"><div class="devSectionTitle">Content Library</div><div id="devContentSummary" class="devHint"></div><div class="devContentTypes"><button data-content-type="mobs">Mob Types</button><button data-content-type="items">Items</button><button data-content-type="lootTables">Loot Tables</button></div><div class="devHint" style="margin-top:9px">Shared gameplay definitions live in <b>content/shared/content-library.json</b>. NPCs are independent zone records that choose their artwork directly from NPC Sprite assets.</div></div>
        <div class="devSection"><div class="devSectionTitle">Library Entries</div><input id="devContentSearch" class="devSearchInput" placeholder="Search content…"><div id="devContentList"></div><div class="devContentActions"><button id="devContentNew" class="primary">New Entry</button></div></div>
        <div class="devSection"><div class="devSectionTitle">Content Inspector</div><div id="devContentEditor"></div></div>
      </section>
      <section class="devView" data-dev-view="assets">
        <div class="devSection devImportSection"><div class="devSectionTitle">Import Assets</div><div id="devAssetSummary" class="devHint"></div><div class="devImportBar"><label>What are you adding?<select id="devAssetImportType"><option value="terrain">Paintable Terrain</option><option value="object">Placeable Object / Building</option><option value="mobSprite">Mob Sprite</option><option value="npcSprite">NPC Sprite</option><option value="playerAppearance">Playable Character</option><option value="itemIcon">Item Icon</option><option value="treeSprite">Terrain Tree Sprite</option><option value="assetOnly">Asset Only / Other Image</option></select></label><button id="devAssetImport" class="primary">Choose Images…</button></div><input id="devAssetImportFile" type="file" multiple accept="image/png,image/webp,image/jpeg,.png,.webp,.jpg,.jpeg" hidden><div class="devHint">Select one image or many. Terrain imports become paintable terrains automatically; Object imports become placeable Object Library entries automatically.</div><div id="devAssetImportResult"></div></div>
        <div class="devMasterDetail assetsLayout">
          <div class="devMasterPane"><div class="devSection"><div class="devSectionTitle">Asset Library</div><div class="devPair"><input id="devAssetSearch" class="devSearchInput" placeholder="Search assets…"><select id="devAssetFilter"><option value="all">All Images</option><option value="mobSprite">Mob Sprites</option><option value="npcSprite">NPC Sprites</option><option value="playerAppearance">Playable Characters</option><option value="itemIcon">Item Icons</option><option value="worldImage">World Images</option><option value="terrainTexture">Terrain Textures</option><option value="treeSprite">Terrain Tree Sprites</option></select></div><div id="devAssetList"></div></div></div>
          <div class="devDetailPane"><div class="devSection"><div class="devSectionTitle">Asset Inspector</div><div id="devAssetInspector"></div></div></div>
        </div>
        <div class="devSection" data-default-collapsed="true"><div class="devSectionTitle">Little Realm Art Prompt Builder</div><div id="devArtPromptBuilder"></div></div>
        <div class="devSection" data-default-collapsed="true"><div class="devSectionTitle">Canonical Art Reference Library</div><div id="devArtReferenceLibrary"></div></div>
      </section>
      ${developerAudioPanelHtml()}
      <section class="devView" data-dev-view="zones">
        <div class="devSection"><div class="devSectionTitle">Project / Zone Manager</div><div id="devZoneSummary" class="devHint"></div><div class="devProjectNote" style="margin-top:9px">Zones are independent maps under <b>content/zones/</b>. The production game opens the zone marked <b>Default</b>. Connect the project folder before creating, switching, or deleting zones so the Builder can save files directly.</div></div>
        <div class="devSection"><div class="devSectionTitle">Zones</div><div id="devZoneList"></div></div>
        <div class="devSection"><div class="devSectionTitle">Zone Inspector</div><div id="devZoneInspector"></div></div>
        <div class="devSection" id="devZoneCreate"><div class="devSectionTitle">New Zone</div><div class="devHint">Blank creates an empty map from the project terrain library. Copy Active duplicates the current zone content as a starting point.</div><div class="devPair"><label>Name<input id="devNewZoneName" value="New Zone"></label><label>ID<input id="devNewZoneId" placeholder="auto-from-name"></label></div><div class="devPair"><label>Width (tiles)<input id="devNewZoneWidth" type="number" min="12" max="128" value="44"></label><label>Height (tiles)<input id="devNewZoneHeight" type="number" min="12" max="96" value="32"></label></div><div class="devPair"><label>Start Tile X<input id="devNewZoneStartX" type="number" min="2" value="7"></label><label>Start Tile Y<input id="devNewZoneStartY" type="number" min="2" value="7"></label></div><div class="devPair"><label>Template<select id="devNewZoneTemplate"><option value="blank">Blank Zone</option><option value="copy">Copy Active Zone</option></select></label><label>World Beyond Terrain<select id="devNewZoneBackdrop"></select></label></div><button id="devCreateZone" class="devWideButton primary">Create & Open Zone</button></div>
      </section>
      <section class="devView" data-dev-view="selection">
        <div class="devSection"><div class="devSectionTitle">Selection Library <span id="devSelectionCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><div class="devHint">Props, NPCs, and loot-remnant previews live together here for visual placement work. Select Dust or Lootable Dust to tune the global remnant scale and depth.</div><div id="devSelectionList"></div></div>
        <div class="devSection"><div class="devSectionTitle">Selected Item</div><div class="devHint">Click a prop or NPC in the world, or choose one above. Drag it directly in the world to reposition it.</div><div id="devInspector"></div></div>
        <div class="devSection"><div class="devSectionTitle">Layout Recovery</div><div class="devProjectActions"><button id="devLoadDraft">Load Local Draft</button><button id="devReset">Use Project Layout</button></div></div>
      </section>
      <section class="devView" data-dev-view="scale">
        <div class="devSection"><div class="devSectionTitle">Selected Mob Type</div><div class="devHint">Click a mob in the world. This slider changes only that Mob Type record.</div><div id="devMobScalePanel"></div></div>
        <div class="devSection"><div class="devSectionTitle">World Visual Scale</div><div class="devHint">These controls change broad world elements. Mob species are controlled separately above.</div><div id="devScalePanel">
          <div class="devScaleControl"><div class="devScaleTop"><span>Player</span><span data-scale-value="player"></span></div><input data-scale-key="player" type="range" min="0.25" max="3.00" step="0.05" value="${VISUAL_SCALE.player}"></div>
          <div class="devScaleControl"><div class="devScaleTop"><span>NPCs</span><span data-scale-value="npcs"></span></div><input data-scale-key="npcs" type="range" min="0.25" max="3.00" step="0.05" value="${VISUAL_SCALE.npcs}"></div>
          <div class="devScaleControl"><div class="devScaleTop"><span>Props</span><span data-scale-value="props"></span></div><input data-scale-key="props" type="range" min="0.25" max="3.00" step="0.05" value="${VISUAL_SCALE.props}"></div>
        </div><div class="devRow"><button id="devResetScale">Reset Scale Settings</button></div></div>
      </section>
      <section class="devView" data-dev-view="combat">
        <div class="devSection"><div class="devSectionTitle">Player Test Level</div><div id="devPlayerTestPanel"></div></div>
        <div class="devSection"><div class="devSectionTitle">Mob Species Tuning</div><div class="devHint">Change a species' level range and base combat values, apply them live, then reroll its current spawns if you want new levels/elites immediately.</div><div id="devCombatSpecies"></div></div>
        <div class="devSection"><div class="devSectionTitle">Global Mob-Level Rules</div><div class="devHint">These values control level growth, danger boosts, elites, bosses, aggro, hit chance, and XP across the whole game.</div><div id="devCombatGlobals"></div></div>
      </section>
      <section class="devView" data-dev-view="project">
        <div class="devSection"><div class="devSectionTitle">Project Health & Safety</div><div class="devProjectNote">World Builder now versions its project files, checks cross-content references before publishing, and keeps lightweight JSON recovery snapshots outside the production game build.</div><div id="devProjectHealth"></div></div>
        <div class="devSection"><div class="devSectionTitle">Local Project Folder</div><div class="devProjectNote">Recommended local workflow: choose the <b>LittleRealm-main</b> project folder once. Save Project Folder writes the active zone (including mob spawns) to <b>content/zones/</b> and shared mob/item/loot/asset definitions to <b>content/shared/</b> with no download/upload step. Chrome or Edge supports direct folder access.</div><div id="devProjectSummary" class="devHint" style="margin-top:9px"></div><div class="devProjectBig"><button id="devOpenProjectFolder" class="primary">Open Little Realm Project Folder</button><button id="devSaveProjectFolder">Save Project Folder</button><button id="devSaveDraftNow">Save Browser Draft</button><button id="devLoadDraftProject">Load Browser Draft</button><button id="devResetProject" class="danger">Use Project Baseline</button></div></div>
        <div class="devSection"><div class="devSectionTitle">Project Backup / Transfer</div><div class="devHint">This portable backup includes both the active zone and the shared Content Library.</div><div class="devProjectBig"><button id="devExportWorldPack" class="primary">Export World Pack (.json)</button><button id="devImportWorldPack">Import World Pack</button></div><input id="devImportWorldPackFile" type="file" accept="application/json,.json" hidden></div>
      </section>
    </div>
    <div id="devStatus">F2 toggles World Builder</div>`;
  document.body.appendChild(root);
  devPanel=root;
  developerInitWorkflowUi(root);
  developerInitSettingHelp?.(root);
  root.querySelector("#devClose").onclick=()=>setDeveloperMode(false);
  root.querySelector("#devSelect").onclick=()=>developerFinishPlacement();
  root.querySelector("#devFinishTool").onclick=()=>developerFinishPlacement();
  root.querySelector("#devRepeatPlacement").onchange=e=>{devRepeatPlacement=!!e.target.checked;refreshDeveloperToolStrip();devSetStatus(devRepeatPlacement?"Repeat placement enabled — chosen placement tools stay active":"One-shot placement enabled — returns to Select after placing");};
  root.querySelector("#devSnap").onchange=e=>{devSnap=Number(e.target.value)||8;};
  root.querySelector("#devGrid").onchange=e=>{devShowGrid=e.target.checked;};
  root.querySelector("#devHitboxes").onchange=e=>{devShowHitboxes=e.target.checked;};
  root.querySelector("#devDepthLines").onchange=e=>{devShowDepthLines=e.target.checked;};
  developerBindCameraControls(root);
  root.querySelector("#devLoadDraft").onclick=loadDeveloperDraft;
  root.querySelector("#devReset").onclick=resetDeveloperLayout;
  root.querySelector("#devNewQuest").onclick=createDeveloperQuest;
  root.querySelector("#devDuplicateQuest").onclick=duplicateDeveloperQuest;
  root.querySelector("#devDeleteQuest").onclick=deleteDeveloperQuest;
  root.querySelector("#devOpenProjectFolder").onclick=openDeveloperProjectFolder;
  root.querySelector("#devSaveProjectFolder").onclick=saveDeveloperProjectFolder;
  root.querySelector("#devCreateZone").onclick=createDeveloperZone;
  root.querySelector("#devExportWorldPack").onclick=exportDeveloperWorldPack;
  root.querySelector("#devImportWorldPack").onclick=()=>root.querySelector("#devImportWorldPackFile").click();
  root.querySelector("#devImportWorldPackFile").onchange=e=>{importDeveloperWorldPackFile(e.target.files?.[0]);e.target.value="";};
  root.querySelector("#devSaveDraftNow").onclick=saveDeveloperDraft;
  root.querySelector("#devLoadDraftProject").onclick=loadDeveloperDraft;
  root.querySelector("#devResetProject").onclick=resetDeveloperProject;
  root.querySelector("#devContentNew").onclick=devContentCreate;
  root.querySelectorAll("[data-content-type]").forEach(button=>button.onclick=()=>devContentSetType(button.dataset.contentType));
  root.querySelector("#devAssetImport").onclick=()=>root.querySelector("#devAssetImportFile").click();
  root.querySelector("#devAssetImportFile").onchange=e=>{importDeveloperAssetFiles(Array.from(e.target.files||[]));e.target.value="";};
  root.querySelector("#devAssetFilter").onchange=refreshDeveloperAssetPanel;
  root.querySelector("#devAudioImport").onclick=()=>root.querySelector("#devAudioImportFile").click();
  root.querySelector("#devAudioImportFile").onchange=e=>{developerImportAudioFiles(Array.from(e.target.files||[]));e.target.value="";};
  root.querySelector("#devAudioFilter").onchange=refreshDeveloperAudioPanel;
  root.querySelector("#devAudioNewSet").onclick=developerCreateAudioSet;
  developerBindSearchInput("#devAssetSearch",refreshDeveloperAssetPanel);
  developerBindSearchInput("#devAudioSearch",refreshDeveloperAudioPanel);
  developerBindSearchInput("#devObjectSearch",refreshDeveloperObjectPalette);
  developerBindSearchInput("#devPlacedObjectSearch",refreshDeveloperObjectList);
  developerBindSearchInput("#devTerrainSearch",refreshDeveloperTerrainPanel);
  developerBindSearchInput("#devNpcSearch",refreshDeveloperNpcAssetPalette);
  developerBindSearchInput("#devSpawnSearch",refreshDeveloperSpawnPanel);
  developerBindSearchInput("#devContentSearch",refreshDeveloperContentPanel);
  developerBindSearchInput("#devQuestSearch",refreshDeveloperQuestPanel);
  root.querySelectorAll(".devTab").forEach(b=>b.onclick=()=>setDeveloperTab(b.dataset.devTab));
  root.querySelectorAll("[data-scale-key]").forEach(input=>{
    updateVisualScaleControl(input.dataset.scaleKey,input.value);
    input.oninput=()=>updateVisualScaleControl(input.dataset.scaleKey,input.value);
  });
  root.querySelector("#devResetScale").onclick=resetVisualScale;
  setDeveloperTab(devActiveTab);
  refreshDeveloperPanel();
  devSetStatus(`${Object.keys(devObjectDefinitions).length} objects • ${sceneryNPCs.length} NPCs • ${devMobSpawns.length} mob spawns • ${Object.keys(devTerrains).length} terrains • ${Object.keys(devAssets).length} assets • Project save ready`);
  return root;
}
function updateDevPaletteActive(){
  if(!devPanel)return;
  devPanel.querySelectorAll("[data-object-definition]").forEach(card=>card.classList.toggle("active",devPlaceType===developerObjectPlaceType(card.dataset.objectDefinition)));
  devPanel.querySelectorAll("[data-npc-asset]").forEach(b=>b.classList.toggle("active",b.dataset.npcAsset===devPlaceNpcAsset));
  devPanel.querySelectorAll("[data-spawn-type]").forEach(b=>b.classList.toggle("active",b.dataset.spawnType===devPlaceMobType));
  devPanel.querySelector("#devSelect")?.classList.toggle("active",devActiveTab!=="terrain"&&!devPlaceType&&!devPlaceNpcAsset&&!devPlaceMobType&&!devSizeEditing&&!devHitboxEditing&&!devDepthEditing&&!devInteractionEditing);
  refreshDeveloperToolStrip();
}

function setDeveloperMode(active){
  devModeActive=!!active;
  if(!devPanel) buildDeveloperPanel();
  devPanel.classList.toggle("show",devModeActive);
  document.body.classList.toggle("devMode",devModeActive);
  input={up:false,down:false,left:false,right:false};
  isHeroMoving=false;
  if(!devModeActive){
    developerAudioStopPreview?.();
    developerPersistCameraForZone();developerClearCameraKeys();devCameraPanDrag=null;
    devDragging=false;devNpcDragging=false;
    devPlaceType=null;devPlaceNpcAsset=null;devPlaceMobType=null;devSpawnDragging=false;devTerrainPainting=false;devTerrainHoverTile=null;
    devSizeEditing=false;
    devSizeDrag=null;
    devHitboxEditing=false;
    devHitboxDrag=null;
    devDepthEditing=false;
    devDepthDrag=null;
    devInteractionEditing=false;
    devInteractionDrag=null;
    if(game?.style) game.style.cursor="";
  }
  updateDevPaletteActive();
  if(devModeActive){
    developerRestoreCameraForZone();
    // Rebuild the live panels now that normal game state is guaranteed to exist.
    refreshDeveloperPanel();
    devSetStatus("World Builder active — zone spawns, assets, and shared Content Library are ready");
  }
}
function toggleDeveloperMode(){setDeveloperMode(!devModeActive);}

function initDeveloperMode(){
  // Headless validator DOMs intentionally omit document.body; the real browser has it.
  if(!document.body || typeof document.createElement!=="function" || !game?.addEventListener) return;
  buildDeveloperPanel();
  game.addEventListener("pointerdown",devPointerDown,true);
  game.addEventListener("pointermove",devPointerMove,true);
  game.addEventListener("pointerup",devPointerUp,true);
  game.addEventListener("pointercancel",devPointerUp,true);
  game.addEventListener("wheel",developerHandleCameraWheel,{capture:true,passive:false});
  window.addEventListener("pointermove",devPointerMove,true);
  window.addEventListener("pointerup",devPointerUp,true);
  window.addEventListener("keydown",event=>{
    if(event.code==="F2"){
      event.preventDefault();toggleDeveloperMode();return;
    }
    if(!devModeActive)return;
    if(developerHandleCameraKeyDown(event))return;
    if(event.code==="Escape"){
      if(devInteractionEditing){setDeveloperInteractionEditing(false);}
      else if(devSizeEditing){setDeveloperSizeEditing(false);}
      else if(devHitboxEditing){setDeveloperHitboxEditing(false);}
      else if(devDepthEditing){setDeveloperDepthEditing(false);}
      else if(devPlaceType||devPlaceNpcAsset||devPlaceMobType||devActiveTab==="terrain"){developerFinishPlacement();}
      else if(devSelectedNpc){devSelectedNpc=null;refreshDeveloperPanel();}
      else if(devSelected){devSelected=null;refreshDeveloperPanel();}
      return;
    }
    if((event.code==="Delete"||event.code==="Backspace") && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)){
      if(devActiveTab==="spawns"&&devSelectedSpawnId){event.preventDefault();deleteDeveloperSpawn();}
      else if(devSelectedNpc){event.preventDefault();deleteDeveloperNpc();}
      else if(devSelected){event.preventDefault();deleteDeveloperSelection();}
    }
  },true);
  window.addEventListener("keyup",event=>{developerHandleCameraKeyUp(event);},true);
  window.addEventListener("blur",developerClearCameraKeys);
}

// Player identity and visual appearance.
// Little Realm uses complete premade playable-character sprite sheets. Equipment
// remains a gameplay/inventory system and does not redraw the player sprite.
const PLAYER_CHARACTER_ASSET_TYPES=new Set(["playerAppearance"]);
const PLAYER_CHARACTER_IMAGE_CACHE=new Map();
let startupFlowActive=false;
let characterSelectPreviewTimer=0;

function characterAssets(type="playerAppearance"){
  return Object.entries(window.LR_ASSETS||{}).filter(([,asset])=>asset?.type===type&&asset?.path);
}
function defaultPlayerAppearanceAssetId(){
  const configured=String(window.LR_CHARACTER_DEFAULTS?.defaultAppearanceAsset||"");
  if(configured&&window.LR_ASSETS?.[configured]?.type==="playerAppearance")return configured;
  return characterAssets("playerAppearance")[0]?.[0]||"";
}
function freshCharacterProfile(){
  return {
    name:String(window.LR_CHARACTER_DEFAULTS?.defaultName||"Adventurer").slice(0,24),
    appearanceAsset:defaultPlayerAppearanceAssetId()
  };
}
function normalizeCharacterProfile(raw){
  const base=freshCharacterProfile(),source=raw&&typeof raw==="object"?raw:{};
  const name=String(source.name||base.name||"Adventurer").trim().slice(0,24)||"Adventurer";
  // Old modular saves intentionally fall back to the current premade default.
  // This keeps older saves playable after the modular paper-doll system is retired.
  const requested=String(source.appearanceAsset||"");
  const appearanceAsset=window.LR_ASSETS?.[requested]?.type==="playerAppearance"?requested:base.appearanceAsset;
  return {name,appearanceAsset};
}
function currentCharacterProfile(){return normalizeCharacterProfile(state?.character);}
function currentCharacterName(){return currentCharacterProfile().name||"Adventurer";}
function characterAssetImage(assetId){
  const asset=window.LR_ASSETS?.[assetId];if(!asset?.path)return null;
  let image=PLAYER_CHARACTER_IMAGE_CACHE.get(assetId);
  if(!image){image=new Image();image.src=`./${asset.path}`;image.onload=()=>buildSpriteFrameMeta(image);PLAYER_CHARACTER_IMAGE_CACHE.set(assetId,image);}
  return image;
}
function characterDirectionRow(asset,facing){
  const map=asset?.spriteLayout?.directionRows||{down:0,right:1,left:2,up:3};return clamp(Math.floor(numberOr(map[facing],0)),0,3);
}
function drawCharacterLayer(c,assetId,x,y,scale,col,facing,bob=0){
  const asset=window.LR_ASSETS?.[assetId],image=characterAssetImage(assetId);if(!asset||!image?.naturalWidth||!image?.naturalHeight)return false;
  const columns=Math.max(1,Math.floor(numberOr(asset.spriteLayout?.columns,4))),rows=Math.max(1,Math.floor(numberOr(asset.spriteLayout?.rows,4))),frameW=image.naturalWidth/columns,frameH=image.naturalHeight/rows,row=characterDirectionRow(asset,facing),sx=Math.round(col*frameW),sy=Math.round(row*frameH),sw=Math.round(frameW),sh=Math.round(frameH);
  // 384 px is the original player's per-frame height. Scaling every registered
  // playable character to that reference keeps older and normalized sheets at
  // the same world size without any modular-layer alignment step.
  const normalizedScale=scale*(384/Math.max(1,frameH)),dw=frameW*normalizedScale,dh=frameH*normalizedScale,dx=x-dw/2,dy=y-dh+17-bob;
  c.drawImage(image,sx,sy,sw,sh,Math.round(dx),Math.round(dy),dw,dh);return true;
}
function drawPlayerCharacter(c,x,y,scale=1,moving=false,animT=0,facing="down",profile=currentCharacterProfile()){
  c.save();c.imageSmoothingEnabled=false;
  const col=moving?[0,1,2,3][Math.floor(animT*8)%4]:0,bob=moving?Math.abs(Math.sin(animT*8))*1.2:0;
  c.fillStyle="rgba(0,0,0,.20)";c.beginPath();c.ellipse(x,y+11,5.5+(moving?.6:0),2.4,0,0,Math.PI*2);c.fill();
  const assetId=profile?.appearanceAsset||defaultPlayerAppearanceAssetId(),drawn=assetId?drawCharacterLayer(c,assetId,x,y,scale,col,facing,bob):false;
  if(!drawn){c.fillStyle="#c8b28a";c.fillRect(Math.round(x-5),Math.round(y-16),10,16);c.fillStyle="#5e4435";c.fillRect(Math.round(x-4),Math.round(y-20),8,5);}
  c.restore();
}

function validPlayerSaveExists(){
  try{const raw=localStorage.getItem(PLAYER_SAVE_KEY);if(!raw)return false;const payload=JSON.parse(raw);return payload?.format===PLAYER_SAVE_FORMAT&&Number(payload?.schemaVersion)===PLAYER_SAVE_SCHEMA_VERSION&&!!payload?.state;}catch{return false;}
}
function setStartupView(view){
  const screen=document.getElementById("startupScreen"),title=document.getElementById("startupTitleView"),select=document.getElementById("characterSelectView");if(!screen)return;
  screen.classList.add("show");title?.classList.toggle("active",view==="title");select?.classList.toggle("active",view==="select");
  if(view==="select")refreshCharacterSelect();
}
function finishStartupFlow(){startupFlowActive=false;document.getElementById("startupScreen")?.classList.remove("show");resetHeldKeyboardMovement?.();}
function beginNewCharacterFlow(){startupFlowActive=true;closeAll?.();setStartupView("select");}
function initializeStartupFlow(){
  const screen=document.getElementById("startupScreen");
  if(window.LR_BUILDER_MODE){startupFlowActive=false;screen?.classList.remove("show");reset({silent:true});return;}
  startupFlowActive=true;reset({silent:true});setStartupView("title");
  const cont=document.getElementById("startupContinue");if(cont)cont.disabled=!validPlayerSaveExists();
}
function characterSelectionFromUi(){
  const name=String(document.getElementById("characterNameInput")?.value||"").trim().slice(0,24)||"Adventurer";
  const appearanceAsset=document.querySelector('[name="characterAppearance"]:checked')?.value||defaultPlayerAppearanceAssetId();
  return normalizeCharacterProfile({name,appearanceAsset});
}
function characterHtmlEscape(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function characterChoiceCards(selected,entries=characterAssets("playerAppearance")){
  if(!entries.length)return "";
  return entries.map(([id,asset],index)=>{
    const checked=id===selected||(!selected&&index===0),name=characterHtmlEscape(asset.name||id),path=characterHtmlEscape(asset.path),description=characterHtmlEscape(asset.description||"Premade Little Realm adventurer");
    return `<label class="characterChoice characterSelectCard"><input type="radio" name="characterAppearance" value="${characterHtmlEscape(id)}" ${checked?"checked":""}><span class="characterChoiceThumb characterSelectThumb"><span class="characterSelectSprite" style="background-image:url('./${path}')"></span></span><b>${name}</b><small>${description}</small></label>`;
  }).join("");
}
function refreshCharacterSelect(){
  const entries=characterAssets("playerAppearance"),profile=freshCharacterProfile(),name=document.getElementById("characterNameInput"),grid=document.getElementById("characterAppearanceChoices");
  if(name&&!name.value)name.value=profile.name;if(!grid)return;
  grid.innerHTML=entries.length?characterChoiceCards(profile.appearanceAsset,entries):'<div class="characterCreatorEmpty">Import a Playable Character sprite in World Builder first.</div>';
  grid.querySelectorAll('input[name="characterAppearance"]').forEach(input=>input.addEventListener("change",drawCharacterSelectPreview));
  const button=document.getElementById("characterCreateBtn");if(button)button.disabled=!entries.length;
  drawCharacterSelectPreview();
}
function drawCharacterSelectPreview(){
  const canvas=document.getElementById("characterPreviewCanvas");if(!canvas)return;const c=canvas.getContext("2d");c.clearRect(0,0,canvas.width,canvas.height);c.imageSmoothingEnabled=false;c.fillStyle="#171322";c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle="rgba(255,255,255,.04)";c.beginPath();c.ellipse(canvas.width/2,canvas.height*.79,66,20,0,0,Math.PI*2);c.fill();
  const profile=characterSelectionFromUi(),phase=(performance.now()/1000);drawPlayerCharacter(c,canvas.width/2,canvas.height*.73,.46,true,phase,"down",profile);
}
function startCharacterSelectPreviewLoop(){if(characterSelectPreviewTimer)return;const tick=()=>{characterSelectPreviewTimer=requestAnimationFrame(tick);if(document.getElementById("characterSelectView")?.classList.contains("active"))drawCharacterSelectPreview();};characterSelectPreviewTimer=requestAnimationFrame(tick);}
function bindStartupScreen(){
  document.getElementById("startupNew")?.addEventListener("click",beginNewCharacterFlow);
  document.getElementById("startupContinue")?.addEventListener("click",async()=>{if(await load({silent:true})){finishStartupFlow();toast(`Welcome back, ${currentCharacterName()}.`);}});
  document.getElementById("characterCreatorBack")?.addEventListener("click",()=>setStartupView("title"));
  document.getElementById("characterCreateBtn")?.addEventListener("click",()=>{const profile=characterSelectionFromUi();if(!profile.appearanceAsset){toast("Choose a character first.");return;}reset({character:profile,silent:true});save({silent:true});finishStartupFlow();toast(`Welcome to Little Realm, ${profile.name}.`);});
  document.getElementById("characterNameInput")?.addEventListener("input",drawCharacterSelectPreview);startCharacterSelectPreviewLoop();
}

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

function mobAssetRecord(assetId){
  return (typeof window!=="undefined"&&window.LR_ASSETS&&window.LR_ASSETS[assetId])||null;
}
function mobSpritePathFromConfig(cfg={}){
  const asset=mobAssetRecord(String(cfg.spriteAsset||""));
  return String(asset?.path||"").trim();
}
function createMobTemplate(configKey,cfg={}){
  const baseline=standardMobBaselineStatsForLevel(cfg.baseLevel||1);
  return {
    name:String(cfg.name||configKey),kind:String(configKey),configKey,
    boss:!!cfg.boss,
    spriteAsset:String(cfg.spriteAsset||""),sprite:mobSpritePathFromConfig(cfg),
    spriteLayout:mobAssetRecord(String(cfg.spriteAsset||""))?.spriteLayout||{columns:4,rows:4,directionRows:{down:0,right:1,left:2,up:3},attackColumn:3,walkCycle:[0,1,2,1]},
    sizeClass:String(cfg.sizeClass||nearestMobSizeClass(cfg.displayHeight)).toLowerCase(),
    displayHeight:Math.max(8,numberOr(cfg.displayHeight,mobSizeClassHeight(cfg.sizeClass))),
    battleScale:Math.max(.05,numberOr(cfg.battleScale,.55)),
    lootTable:typeof cfg.lootTable==="string"?cfg.lootTable.trim():"",
    baseLevel:Math.max(1,Math.floor(numberOr(cfg.baseLevel,1))),
    levelMin:Math.max(1,Math.floor(numberOr(cfg.levelMin,cfg.baseLevel||1))),
    levelMax:Math.max(1,Math.floor(numberOr(cfg.levelMax,cfg.baseLevel||1))),
    hp:Math.max(1,numberOr(cfg.hp,baseline.hp)),atk:Math.max(0,numberOr(cfg.attack,baseline.attack)),def:Math.max(0,numberOr(cfg.defense,baseline.defense)),
    xpMultiplier:Math.max(0,numberOr(cfg.xpMultiplier,1)),xp:Math.max(1,numberOr(cfg.xp,baseline.xp)),
    gold:[Math.max(0,numberOr(cfg.goldMin,0)),Math.max(0,numberOr(cfg.goldMax,0))],
    goldDropChance:percentOr(cfg.goldDropChancePercent,0),potionDropChance:percentOr(cfg.potionDropChancePercent,0),potionDropAmount:Math.max(0,Math.floor(numberOr(cfg.potionDropAmount,1))),
    eliteChance:percentOr(cfg.eliteChancePercent,0),attackInterval:Math.max(.1,numberOr(cfg.attackIntervalSeconds,1.5)),
    respawnMin:Math.max(0,numberOr(cfg.respawnMinSeconds,18)),respawnMax:Math.max(0,numberOr(cfg.respawnMaxSeconds,28)),
    aggressive:!!cfg.aggressive,aggroTriggerRange:Math.max(0,numberOr(cfg.aggroTriggerRange,58)),alertRange:Math.max(0,numberOr(cfg.alertRange,82)),
    chaseSpeed:Math.max(0,numberOr(cfg.chaseSpeed,50)),wanderSpeed:Math.max(0,numberOr(cfg.wanderSpeed,20)),leashDistance:Math.max(0,numberOr(cfg.leashDistance,120)),
    combatLeashDistance:Math.max(0,numberOr(cfg.combatLeashDistance,numberOr(BALANCE.combat?.mobLeashDistance,260))),leashSpeed:Math.max(0,numberOr(cfg.leashSpeed,34)),
    wanderDelayMin:Math.max(0,numberOr(cfg.wanderDelayMinSeconds,1.2)),wanderDelayMax:Math.max(0,numberOr(cfg.wanderDelayMaxSeconds,4)),
    audio:{aggro:String(cfg.audio?.aggro||""),attack:String(cfg.audio?.attack||""),hit:String(cfg.audio?.hit||""),death:String(cfg.audio?.death||"")},audioRadius:Math.max(100,numberOr(cfg.audioRadius,430))
  };
}

const mobTemplates=[];
function allMobTemplates(){return mobTemplates;}
function syncMobTemplateCatalog(){mobTemplates.length=0;for(const [id,cfg] of Object.entries(BALANCE.mobs||{}))mobTemplates.push(createMobTemplate(id,cfg||{}));}
function refreshMobTemplatesFromBalance(){
  syncMobTemplateCatalog();
  const byId=new Map(allMobTemplates().map(t=>[t.configKey,t]));
  for(const mob of mobs){
    const t=byId.get(mob.spawnType||mob.template?.configKey);if(!t)continue;
    mob.template=t;mob.kind=t.configKey;mob.boss=!!t.boss;
    mob.level=mob.fixedLevel?Math.max(1,Math.floor(numberOr(mob.level,t.baseLevel))):Math.max(t.levelMin,Math.min(t.levelMax,Math.floor(numberOr(mob.level,t.baseLevel))));
    if(mob.alive)restoreMobStats(mob,false);
  }
}

syncMobTemplateCatalog();

function rerollMobLevelsAndElites(typeKey=null){
  refreshMobTemplatesFromBalance();
  for(const mob of mobs){
    const key=mob.template?.configKey||mob.spawnType||mob.kind;
    if(typeKey && key!==typeKey) continue;
    if(!mob.fixedLevel)mob.level=mobSpawnLevel(mob.template);
    mob.elite=rollMobElite(mob.template);
    restoreMobStats(mob,true);
    mob.aggro=false;
    mob.returningHome=false; mob.leashStuckTime=0;
  }
  updateCombatHud?.();
}

function mobSpawnLevel(template,tx=0,ty=0){
  const min=Math.min(template.levelMin,template.levelMax);
  const max=Math.max(template.levelMin,template.levelMax);
  if(min===max) return min;
  // Stable per spawn point: the same creature location keeps its level after
  // respawns instead of rerolling whenever the player walks back through.
  const hash=Math.abs(((tx+17)*73856093)^((ty+31)*19349663)^((template.kind.length+7)*83492791));
  return min+(hash%(max-min+1));
}

function mobDangerSteps(level){
  const threshold=Math.max(0,Math.floor(numberOr(BALANCE.mobLevels?.dangerStartsAbovePlayerLevels,3)));
  return Math.max(0,Math.floor(level-state.level-threshold));
}

function mobLevelColor(level,boss=false,elite=false){
  if(boss) return "#ff6b5f";
  if(elite) return "#c58cff";
  const delta=level-state.level;
  if(delta>=4) return "#ff5d55";
  if(delta>=2) return "#ffad4a";
  if(delta<=-5) return "#8f969f";
  if(delta<=-3) return "#71c873";
  return "#f1d56a";
}

function rollMobElite(template){
  if(!template || template.boss || template.eliteChance<=0) return false;
  return Math.random()<template.eliteChance;
}

function mobRankLabel(mob){
  if(!mob) return "";
  if(mob.boss || mob.template?.boss) return "Boss";
  if(mob.elite) return "Elite";
  return "";
}

function mobDisplayName(mob){
  if(!mob) return "Mob";
  const rank=mobRankLabel(mob);
  return `${rank?rank+" ":""}${mob.template?.name||mob.name||"Mob"}`;
}

function mobAggroRanges(mob){
  if(!mob || !mob.template?.aggressive) return {trigger:0,alert:0};
  const cfg=BALANCE.mobLevels||{};
  const delta=(mob.level||1)-state.level;
  const baseTrigger=Math.max(0,numberOr(mob.template.aggroTriggerRange,58));
  const baseAlert=Math.max(baseTrigger,numberOr(mob.template.alertRange,82));
  const minTrigger=Math.max(0,numberOr(cfg.minimumAggroTriggerRange,20));
  const minAlert=Math.max(minTrigger,numberOr(cfg.minimumAlertRange,34));
  let trigger=Math.max(minTrigger,baseTrigger+delta*numberOr(cfg.aggroRangePerLevelDifference,7));
  let alert=Math.max(minAlert,baseAlert+delta*numberOr(cfg.alertRangePerLevelDifference,9));
  let rankMult=1;
  if(mob.boss || mob.template?.boss) rankMult=numberOr(cfg.bossAggroMultiplier,1.25);
  else if(mob.elite) rankMult=numberOr(cfg.eliteAggroMultiplier,1.15);
  trigger*=rankMult;
  alert*=rankMult;
  return {trigger,alert:Math.max(trigger,alert)};
}

function mobScaledStats(template,level,elite=false){
  const cfg=BALANCE.mobLevels||{};
  const mobLevel=Math.max(1,Math.floor(numberOr(level,template.baseLevel||1)));
  const levelDelta=mobLevel-(template.baseLevel||1);
  const hpGrowth=percentOr(cfg.hpGrowthPerLevelPercent,14);
  const atkGrowth=percentOr(cfg.attackGrowthPerLevelPercent,10);
  const armorPerLevel=numberOr(cfg.armorPerLevel,.55);

  let maxHp=Math.max(1,Math.round(template.hp*Math.max(.25,1+levelDelta*hpGrowth)));
  let atk=Math.max(1,Math.round(template.atk*Math.max(.25,1+levelDelta*atkGrowth)));
  let def=Math.max(0,Math.round(template.def+levelDelta*armorPerLevel));
  let xp;
  if(booleanOr(cfg.useLevelBasedXp,true)){
    // Standard hostile mobs follow the same-level XP column from the 1-100
    // leveling curve. Species can scale this with xpMultiplier; elites/bosses
    // then apply their existing rank multipliers below.
    xp=Math.max(1,Math.round(standardMobXpForLevel(mobLevel)*Math.max(0,numberOr(template.xpMultiplier,1))));
  }else{
    const xpGrowth=percentOr(cfg.xpGrowthPerLevelPercent,18);
    xp=Math.max(1,Math.round(template.xp*Math.max(.25,1+levelDelta*xpGrowth)));
  }

  if(elite && !template.boss){
    maxHp=Math.max(1,Math.round(maxHp*numberOr(cfg.eliteHpMultiplier,1.65)));
    atk=Math.max(1,Math.round(atk*numberOr(cfg.eliteAttackMultiplier,1.20)));
    def=Math.max(0,Math.round(def+numberOr(cfg.eliteArmorBonus,2)));
    xp=Math.max(1,Math.round(xp*numberOr(cfg.eliteXpMultiplier,1.60)));
  }

  if(template.boss){
    maxHp=Math.max(1,Math.round(maxHp*numberOr(cfg.bossHpMultiplier,1.5)));
    atk=Math.max(1,Math.round(atk*numberOr(cfg.bossAttackMultiplier,1.25)));
    def=Math.max(0,Math.round(def*numberOr(cfg.bossArmorMultiplier,1.25)));
    xp=Math.max(1,Math.round(xp*numberOr(cfg.bossXpMultiplier,1.75)));
  }

  const danger=mobDangerSteps(mobLevel);
  if(danger>0){
    maxHp=Math.round(maxHp*(1+danger*percentOr(cfg.dangerHpPerExtraLevelPercent,12)));
    atk=Math.round(atk*(1+danger*percentOr(cfg.dangerAttackPerExtraLevelPercent,9)));
    def=Math.max(0,Math.round(def+danger*numberOr(cfg.dangerArmorPerExtraLevel,.6)));
    xp=Math.round(xp*(1+danger*percentOr(cfg.dangerXpPerExtraLevelPercent,10)));
  }

  return {maxHp,atk,def,xp,danger};
}

function mobXpReward(mob){
  if(!mob) return 0;
  const cfg=BALANCE.mobLevels||{};
  const base=Math.max(1,Math.floor(numberOr(mob.xp,mob.template?.xp||1)));
  const diff=mob.level-state.level;
  const trivialGap=Math.max(1,Math.floor(numberOr(cfg.trivialXpStartsAboveMobLevels,5)));
  if(state.level-mob.level>=trivialGap){
    // Intentional infinite-grind rule: trivial enemies always remain worth
    // exactly their level in XP, even for extremely high-level players.
    return Math.max(1,Math.floor(mob.level));
  }
  if(diff<0){
    const penalty=Math.abs(diff)*percentOr(cfg.lowLevelXpPenaltyPerLevelPercent,20);
    return Math.max(1,Math.round(base*Math.max(0,1-penalty)));
  }
  if(diff>0){
    return Math.max(1,Math.round(base*(1+diff*percentOr(cfg.higherLevelXpBonusPerLevelPercent,8))));
  }
  return base;
}

function restoreMobStats(mob,fullHeal=true){
  const oldMax=Math.max(1,numberOr(mob.maxHp,1));
  const oldHp=Math.max(0,numberOr(mob.hp,oldMax));
  const ratio=Math.max(0,Math.min(1,oldHp/oldMax));
  const stats=mobScaledStats(mob.template,mob.level,!!mob.elite);
  mob.maxHp=stats.maxHp;
  mob.hp=fullHeal?stats.maxHp:Math.max(1,Math.round(stats.maxHp*ratio));
  mob.atk=stats.atk;
  mob.def=stats.def;
  mob.xp=stats.xp;
  mob.dangerSteps=stats.danger;
  mob.attackAnim=0;
}

function refreshAliveMobStatsForPlayer(){
  for(const mob of mobs){
    if(mob.alive) restoreMobStats(mob,false);
  }
}

function spawnMobs(){
  mobs=[];
  nextMobId=1;
  bossMob=null;
  refreshMobTemplatesFromBalance();

  const spawnDefs=Array.isArray(window.LR_MOB_SPAWNS)?window.LR_MOB_SPAWNS:[];

  for(let i=0;i<spawnDefs.length;i++){
    const def=spawnDefs[i]||{};
    const type=String(def.mobType||def.kind||"").trim();
    if(!type) continue;
    const template=allMobTemplates().find(e=>e.configKey===type);
    if(!template) continue;
    const x=Number.isFinite(Number(def.x))?Number(def.x):numberOr(def.tx,0)*TILE+TILE/2;
    const y=Number.isFinite(Number(def.y))?Number(def.y):numberOr(def.ty,0)*TILE+TILE/2;
    const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);
    if(ty<0||ty>=world.length||tx<0||tx>=(world[ty]?.length||0)||!tile[world[ty][tx]]?.walk) continue;
    const fixedLevel=Number.isFinite(Number(def.level));
    const level=fixedLevel?Math.max(1,Math.floor(Number(def.level))):mobSpawnLevel(template,tx,ty);
    const mob={
      id:nextMobId++,
      spawnId:String(def.id||`${type}-${i+1}`),
      spawnType:type,
      kind:template.kind,
      template,
      level,
      fixedLevel,
      x,y,homeX:x,homeY:y,
      vx:0,vy:0,
      drawVx:0,drawVy:0,
      facing:String(def.facing||"down"),
      facingCandidate:String(def.facing||"down"),
      facingCandidateTime:0,
      animTime:Math.random()*10,
      moveTimer:template.boss?999999:Math.random()*2,
      alive:true,
      respawnTimer:0,
      aggro:false,
      returningHome:false,
      leashStuckTime:0,
      boss:!!template.boss
    };
    restoreMobStats(mob);
    mobs.push(mob);
    if(mob.boss&&!bossMob) bossMob=mob;
  }
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

function drawSheetSprite(c, sheet, ready, x, y, scale=1, facing="down", animT=0, moving=true, layout=null, attacking=false, shadowWorldScale=null){
  c.save();
  c.imageSmoothingEnabled = false;

  const spec=layout&&typeof layout==="object"?layout:{};const cols=Math.max(1,Math.floor(numberOr(spec.columns,4))),rows=Math.max(1,Math.floor(numberOr(spec.rows,4)));
  const resolvedMap = spec.directionRows || { down:0, right:1, left:2, up:3 };
  const row = clamp(Math.floor(numberOr(resolvedMap[facing],0)),0,rows-1);
  const walkCycle=Array.isArray(spec.walkCycle)&&spec.walkCycle.length?spec.walkCycle:[0,1,2,1];
  const attackColumn=clamp(Math.floor(numberOr(spec.attackColumn,cols-1)),0,cols-1);
  const col = attacking ? attackColumn : (moving ? clamp(Math.floor(numberOr(walkCycle[Math.floor(animT * 7) % walkCycle.length],0)),0,cols-1) : 0);
  const bob = moving && !attacking ? Math.abs(Math.sin(animT * 7)) * 1.0 : 0;

  const shadowScale=Number.isFinite(Number(shadowWorldScale))?Math.max(.25,Number(shadowWorldScale)):Math.max(.25,scale/.23);
  c.fillStyle = "rgba(0,0,0,.18)";
  c.beginPath();
  c.ellipse(x, y + 10, 9 * shadowScale, 3.2 * shadowScale, 0, 0, Math.PI * 2);
  c.fill();

  if(ready && sheet.naturalWidth && sheet.naturalHeight){
    const sx0 = Math.round(col * sheet.naturalWidth / cols);
    const sx1 = Math.round((col + 1) * sheet.naturalWidth / cols);
    const sy0 = Math.round(row * sheet.naturalHeight / rows);
    const sy1 = Math.round((row + 1) * sheet.naturalHeight / rows);
    const frameW = sx1 - sx0;
    const frameH = sy1 - sy0;
    const meta=spriteFrameMeta(sheet,row,col);
    if(meta){
      // Draw only the visible pixels from the frame. This makes the actual feet,
      // not transparent padding at the bottom of the cell, define ground contact.
      const dw=meta.sw*scale;
      const dh=meta.sh*scale;
      const dx=Math.round(x-dw/2);
      const groundY=Math.round(y+8-bob);
      const dy=Math.round(groundY-dh);
      c.drawImage(sheet,meta.sx,meta.sy,meta.sw,meta.sh,dx,dy,dw,dh);
    }else{
      const dw = frameW * scale;
      const dh = frameH * scale;
      const dx = Math.round(x - dw / 2);
      const dy = Math.round(y - dh + 8 - bob);
      c.drawImage(sheet, sx0, sy0, frameW, frameH, dx, dy, dw, dh);
    }
  } else {
    c.fillStyle="#c8b5d4";c.fillRect(x-8,y-16,16,16);c.fillStyle="#241b2a";c.font="bold 11px sans-serif";c.textAlign="center";c.fillText("?",x,y-4);
  }

  c.restore();
}

const dynamicMobSheets=new Map();
function dynamicMobSheet(path){
  if(!path)return null;
  if(dynamicMobSheets.has(path))return dynamicMobSheets.get(path);
  const image=new Image();const record={image,ready:false};
  image.onload=()=>{record.ready=true;buildSpriteFrameMeta(image);};
  image.src=/^(?:data:|blob:|https?:|\.\/|\/)/.test(path)?path:`./${path}`;dynamicMobSheets.set(path,record);return record;
}
function mobWorldDisplayHeight(mob){return Math.max(8,numberOr(mob?.template?.displayHeight??mob?.displayHeight,MOB_SIZE_CLASS_HEIGHTS.medium));}
// World-relative scale for rings, labels, click radii, Builder overlays, and other
// gameplay/UI geometry. This intentionally depends only on normalized displayHeight,
// never on source sprite resolution. Keep this helper separate from image draw scale.
function mobVisualScale(mob){return mobWorldDisplayHeight(mob)/MOB_SIZE_CLASS_HEIGHTS.medium;}
function mobVisibleHeightScale(mob,sheet,ready,layout){
  if(!ready||!sheet?.naturalHeight)return .23;
  const spec=layout&&typeof layout==="object"?layout:{};
  const rows=Math.max(1,Math.floor(numberOr(spec.rows,4)));
  const rowMap=spec.directionRows||{down:0,right:1,left:2,up:3};
  const referenceRow=clamp(Math.floor(numberOr(rowMap.down,0)),0,rows-1);
  const meta=spriteFrameMeta(sheet,referenceRow,0);
  const referenceHeight=Math.max(1,numberOr(meta?.sh,sheet.naturalHeight/rows));
  return mobWorldDisplayHeight(mob)/referenceHeight;
}
function drawMob(c,mob,sx,sy){
  const path=String(mob?.template?.sprite||"");if(!path)return;
  const record=dynamicMobSheet(path);if(!record)return;
  const moving=Math.hypot(mob.drawVx||0,mob.drawVy||0)>4,attacking=(mob.attackAnim||0)>0;
  const layout=mob.template?.spriteLayout;
  drawSheetSprite(c,record.image,record.ready,sx,sy,mobVisibleHeightScale(mob,record.image,record.ready,layout),mob.facing||"down",mob.animTime||0,moving,layout,attacking,mobWorldDisplayHeight(mob)/MOB_SIZE_CLASS_HEIGHTS.medium);
}
function drawBattleSprites(){
  heroCtx.clearRect(0,0,heroCanvas.width,heroCanvas.height);enemyCtx.clearRect(0,0,enemyCanvas.width,enemyCanvas.height);drawHero(heroCtx,24,36,0.15,false,0,"down");
  if(!enemy)return;const path=String(enemy.sprite||enemy.template?.sprite||"");if(!path)return;
  const record=dynamicMobSheet(path);if(!record)return;
  const scale=Math.max(.05,numberOr(enemy.battleScale??enemy.template?.battleScale,.55));
  drawSheetSprite(enemyCtx,record.image,record.ready,36,44,scale,"down",performance.now()/1000,false,enemy.template?.spriteLayout,enemyAttackAnim>0);
}

function finishMobLeashReturn(mob){
  if(!mob) return;
  mob.x=mob.homeX; mob.y=mob.homeY;
  mob.vx=0; mob.vy=0; mob.drawVx=0; mob.drawVy=0;
  mob.aggro=false;
  mob.returningHome=false;
  mob.leashStuckTime=0;
  mob.moveTimer=Math.max(.45,numberOr(mob.template?.wanderDelayMin,.8));
  mob.facingCandidateTime=0;
  if(mob.alive && Number.isFinite(mob.maxHp)) mob.hp=mob.maxHp;
}

function startMobLeashReturn(mob){
  if(!mob||!mob.alive) return false;
  mob.aggro=false;
  mob.returningHome=true;
  mob.vx=0; mob.vy=0;
  mob.leashStuckTime=0;
  if(Number.isFinite(mob.maxHp)) mob.hp=mob.maxHp;
  if(typeof selectedTarget!=="undefined" && selectedTarget===mob) selectedTarget=null;
  if(dist(mob.x,mob.y,mob.homeX,mob.homeY)<=3) finishMobLeashReturn(mob);
  return true;
}

function mobHomeIsSafeGrass(mob){
  return !!mob && terrainIsSanctuary(tileAtWorld(mob.homeX,mob.homeY));
}

function mobCanStandWithSafeGrass(mob,x,y,radius=10){
  if(!canStand(x,y,radius)) return false;
  // Safe Grass is a sanctuary boundary for mobs that spawned outside it.
  // Mobs intentionally authored with a home point on Safe Grass are allowed
  // to move normally so the Builder never silently freezes valid content.
  return mobHomeIsSafeGrass(mob) || !terrainIsSanctuary(tileAtWorld(x,y));
}

function updateMobs(dt){
  if(isLootInteractionOpen()) return;
  for(const mob of mobs){
    if(!mob.alive){
      if(mob.boss) continue;
      mob.respawnTimer-=dt;
      if(mob.respawnTimer<=0){
        mob.alive=true;
        mob.x=mob.homeX; mob.y=mob.homeY;
        mob.vx=0; mob.vy=0; mob.drawVx=0; mob.drawVy=0;
        mob.facing="down"; mob.facingCandidate="down"; mob.facingCandidateTime=0; mob.aggro=false;
        mob.returningHome=false; mob.leashStuckTime=0;
        mob.elite=rollMobElite(mob.template);
        restoreMobStats(mob);
      }
      continue;
    }

    mob.attackAnim=Math.max(0,(mob.attackAnim||0)-dt);
    const d=dist(state.x,state.y,mob.x,mob.y);
    let isTarget=mob===combatTarget;
    let homeDist=dist(mob.x,mob.y,mob.homeX,mob.homeY);

    // The spawn point is the hard combat leash anchor. Once a mob has been
    // pulled beyond its configured leash, it evades immediately: combat ends,
    // HP resets, and the mob runs home before it can be engaged again.
    if(isTarget && !mob.returningHome && homeDist>mob.template.combatLeashDistance){
      disengageCombat(false);
      isTarget=false;
    }

    // Aggression and movement are data-driven so routine mob tuning only
    // requires editing config/game-balance.js. Returning mobs are in an evade
    // state and cannot re-aggro until they have reached their spawn point.
    const aggroRanges=mobAggroRanges(mob);
    const safeGrassProtectsPlayer=terrainIsSanctuary(tileAtWorld(state.x,state.y)) && !mobHomeIsSafeGrass(mob);
    if(isTarget && safeGrassProtectsPlayer){
      disengageCombat(false);
      isTarget=false;
    }
    if(!mob.returningHome && !combatTarget && mob.template.aggressive && !safeGrassProtectsPlayer && d<aggroRanges.trigger){
      engageMob(mob,true);
      isTarget=mob===combatTarget;
    }

    mob.aggro=!safeGrassProtectsPlayer && !mob.returningHome && (isTarget || (!combatTarget && mob.template.aggressive && d<aggroRanges.alert));

    let vx=0,vy=0;
    if(mob.returningHome){
      if(homeDist<=3){
        finishMobLeashReturn(mob);
        continue;
      }
      const dx=mob.homeX-mob.x, dy=mob.homeY-mob.y;
      const len=Math.max(.001,Math.hypot(dx,dy));
      const returnSpeed=Math.max(mob.template.leashSpeed,mob.template.chaseSpeed);
      vx=dx/len*returnSpeed; vy=dy/len*returnSpeed;
    }else if(isTarget){
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
      homeDist=dist(mob.x,mob.y,mob.homeX,mob.homeY);
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
    if(mobCanStandWithSafeGrass(mob,nx,mob.y,10)) mob.x=nx; else blocked=true;
    if(mobCanStandWithSafeGrass(mob,mob.x,ny,10)) mob.y=ny; else blocked=true;

    if(mob.returningHome){
      // Normal movement usually slides around terrain one axis at a time. This
      // fail-safe prevents an evading mob from remaining permanently wedged.
      mob.leashStuckTime=blocked?(mob.leashStuckTime||0)+dt:Math.max(0,(mob.leashStuckTime||0)-dt*2);
      const remaining=dist(mob.x,mob.y,mob.homeX,mob.homeY);
      if(remaining<=3 || mob.leashStuckTime>=1.5){
        finishMobLeashReturn(mob);
        continue;
      }
    }else if(blocked && !isTarget && !mob.boss){
      // Do not bounce the stored wander vector back and forth against a wall.
      // Stop briefly and choose a fresh direction on the next wander decision.
      mob.vx=0; mob.vy=0; mob.moveTimer=0;
    }

  }
}

function findNearestMob(maxDistance=Infinity){
  let best=null,bestD=maxDistance;
  for(const mob of mobs){
    if(!mob.alive || mob.returningHome) continue;
    const d=dist(state.x,state.y,mob.x,mob.y);
    if(d<bestD){best=mob;bestD=d}
  }
  return best;
}

// Open-world combat state (RuneScape-style auto combat)
// Routine balance values come from config/game-balance.js so they can be
// changed independently without rebuilding js/game.js.
const ATTACK_RANGE=numberOr(BALANCE.combat?.meleeRange,30);
const MAX_ENGAGE_RANGE=numberOr(BALANCE.combat?.engageRange,72);
const DISENGAGE_RANGE=numberOr(BALANCE.combat?.disengageRange,260);
const AUTO_CHASE_RANGE=numberOr(BALANCE.combat?.autoChaseRange,82);
const PLAYER_ATTACK_INTERVAL=numberOr(BALANCE.combat?.playerAttackIntervalSeconds,1.15);
const ATTACK_BUTTON_GCD=numberOr(BALANCE.combat?.attackButtonCooldownSeconds,.90);
const ATTACK_START_DELAY=numberOr(BALANCE.combat?.openingAttackDelaySeconds,.62);
const PLAYER_CRIT_CHANCE=percentOr(BALANCE.combat?.playerCritChancePercent,10);
const PLAYER_DAMAGE_MIN=Math.floor(numberOr(BALANCE.combat?.playerDamageBonusMin,0));
const PLAYER_DAMAGE_MAX=Math.floor(numberOr(BALANCE.combat?.playerDamageBonusMax,3));
const ENEMY_DAMAGE_MIN=Math.floor(numberOr(BALANCE.combat?.enemyDamageBonusMin,0));
const ENEMY_DAMAGE_MAX=Math.floor(numberOr(BALANCE.combat?.enemyDamageBonusMax,2));
const TARGET_CLICK_RADIUS=numberOr(BALANCE.combat?.targetClickRadius,34);
const POTION_HEAL=Math.max(0,Math.floor(numberOr(BALANCE.player?.potionHeal,14)));
const POTION_COOLDOWN=numberOr(BALANCE.player?.potionCooldownSeconds,.85);
const DEATH_GOLD_LOSS=percentOr(BALANCE.player?.deathGoldLossPercent,25);
let combatTarget=null;
let selectedTarget=null;
let playerAttackTimer=0;
let enemyAttackTimer=0;
let attackButtonCooldown=0;
let playerAttackAnim=0;
let enemyAttackAnim=0;
let potionCooldown=0;
let combatFx=[];
let bossMob=null;
let combatHudSignature="";

function combatHitChancePercent(base,levelAdvantage,perLevel,rankAdjustment=0){
  const cfg=BALANCE.mobLevels||{};
  const min=Math.max(0,numberOr(cfg.minimumHitChancePercent,55));
  const max=Math.min(100,numberOr(cfg.maximumHitChancePercent,99));
  return clamp(numberOr(base,95)+levelAdvantage*numberOr(perLevel,4)+rankAdjustment,min,max);
}

function playerHitChanceAgainst(mob){
  const cfg=BALANCE.mobLevels||{};
  let rankPenalty=0;
  if(mob?.boss || mob?.template?.boss) rankPenalty-=numberOr(cfg.bossPlayerHitPenaltyPercent,5);
  else if(mob?.elite) rankPenalty-=numberOr(cfg.elitePlayerHitPenaltyPercent,3);
  return combatHitChancePercent(
    cfg.playerBaseHitChancePercent,
    state.level-(mob?.level||state.level),
    cfg.playerHitChancePerLevelAdvantagePercent,
    rankPenalty
  );
}

function mobHitChanceAgainstPlayer(mob){
  const cfg=BALANCE.mobLevels||{};
  let rankBonus=0;
  if(mob?.boss || mob?.template?.boss) rankBonus+=numberOr(cfg.bossEnemyHitBonusPercent,5);
  else if(mob?.elite) rankBonus+=numberOr(cfg.eliteEnemyHitBonusPercent,3);
  return combatHitChancePercent(
    cfg.enemyBaseHitChancePercent,
    (mob?.level||state.level)-state.level,
    cfg.enemyHitChancePerLevelAdvantagePercent,
    rankBonus
  );
}

function getMobRespawnSeconds(mob){
  if(!mob||mob.boss) return 999999;
  const min=Math.min(mob.template.respawnMin,mob.template.respawnMax);
  const max=Math.max(mob.template.respawnMin,mob.template.respawnMax);
  return min+Math.random()*(max-min);
}

function selectMob(mob,showToast=true){
  if(!mob||!mob.alive||mob.returningHome) return false;
  selectedTarget=mob;
  updateCombatHud();
  if(showToast) toast(`Lv ${mob.level} ${mobDisplayName(mob)} targeted • ${Math.max(0,Math.ceil(mob.hp))}/${mob.maxHp} HP`);
  return true;
}

function clearSelectedTarget(){
  selectedTarget=null;
  updateCombatHud();
}

function getHudTarget(){
  if(selectedTarget && selectedTarget.alive && !selectedTarget.returningHome) return selectedTarget;
  if(combatTarget && combatTarget.alive) return combatTarget;
  selectedTarget=null;
  return null;
}

function updateOpenCombat(dt){
  playerAttackAnim=Math.max(0,playerAttackAnim-dt);
  enemyAttackAnim=Math.max(0,enemyAttackAnim-dt);
  let liveFx=0;
  for(let i=0;i<combatFx.length;i++){
    const fx=combatFx[i];
    fx.life-=dt;
    if(fx.life>0) combatFx[liveFx++]=fx;
  }
  combatFx.length=liveFx;

  if(!combatTarget){updateCombatHud();return}
  if(!combatTarget.alive){disengageCombat(false);return}

  const d=dist(state.x,state.y,combatTarget.x,combatTarget.y);
  if(d>DISENGAGE_RANGE){
    disengageCombat(false);
    toast("You left combat.");
    return;
  }

  if(d>ATTACK_RANGE){
    // Closing distance does not preload an instant hit. The first swing still
    // respects the attack cycle once the fighter reaches melee range.
    playerAttackTimer=Math.max(playerAttackTimer,.12);
    enemyAttackTimer=Math.max(enemyAttackTimer,.12);
    updateCombatHud();
    return;
  }

  playerAttackTimer-=dt;
  enemyAttackTimer-=dt;

  if(playerAttackTimer<=0 && combatTarget && combatTarget.alive){
    performPlayerAutoAttack(combatTarget);
    playerAttackTimer=PLAYER_ATTACK_INTERVAL;
  }

  if(enemyAttackTimer<=0 && combatTarget && combatTarget.alive){
    // Capture the attacker and schedule its next swing BEFORE applying damage.
    // A killing blow can clear combatTarget during worldCombatDeath(), so never
    // dereference combatTarget after performEnemyAutoAttack() returns.
    const attackingMob=combatTarget;
    enemyAttackTimer=numberOr(attackingMob.template.attackInterval,1.45);
    performEnemyAutoAttack(attackingMob);
    if(!combatTarget){
      updateCombatHud();
      return;
    }
  }
  updateCombatHud();
}

function targetThreatInfo(mob){
  const delta=(mob?.level||1)-state.level;
  if(mob?.boss) return {label:"BOSS",cls:"boss"};
  if(mob?.elite) return {label:"ELITE",cls:"elite"};
  if(delta>=4) return {label:"DEADLY",cls:"deadly"};
  if(delta>=2) return {label:"DANGEROUS",cls:"dangerous"};
  if(delta<=-5) return {label:"TRIVIAL",cls:"trivial"};
  if(delta<=-2) return {label:"LOW",cls:"low"};
  return {label:"EVEN",cls:"even"};
}

function updateCombatHud(){
  const target=getHudTarget();
  let signature;
  let targetDistance=0;
  let targetDisplayName="";
  let threat=null;
  let hitChance=0;
  let near=null;

  if(target){
    targetDistance=dist(state.x,state.y,target.x,target.y);
    targetDisplayName=mobDisplayName(target);
    threat=targetThreatInfo(target);
    hitChance=Math.round(playerHitChanceAgainst(target));
    signature=[
      "target",target.id,targetDisplayName,target.level,target.hp,target.maxHp,target.def,
      target.boss?1:0,target.elite?1:0,threat.cls,hitChance,
      Math.ceil(targetDistance),targetDistance>ATTACK_RANGE?1:0,targetDistance>MAX_ENGAGE_RANGE?1:0,
      combatTarget&&combatTarget.alive?1:0,
      attackButtonCooldown>0?attackButtonCooldown.toFixed(1):"ready"
    ].join("|");
  }else{
    near=findNearestMob(MAX_ENGAGE_RANGE);
    signature=`none|${near?.id||""}|${attackButtonCooldown>0?attackButtonCooldown.toFixed(1):"ready"}`;
  }

  // updateOpenCombat runs every frame. Most frames do not change any visible
  // target HUD value, so avoid repeated DOM queries/writes until the rendered
  // state actually changes.
  if(signature===combatHudSignature) return;

  const hud=document.getElementById("targetHud");
  const action=document.getElementById("actionHint");
  if(!hud||!action) return;
  combatHudSignature=signature;
  action.classList.remove("ready","engaged","cooldown","targeted");

  if(target){
    hud.classList.add("show");
    const targetName=document.getElementById("targetName");
    targetName.textContent=`Lv ${target.level} ${targetDisplayName}`;
    targetName.style.color=mobLevelColor(target.level,target.boss,target.elite);
    document.getElementById("targetHpText").textContent=`${Math.max(0,Math.ceil(target.hp))}/${target.maxHp} HP`;
    document.getElementById("targetHpFill").style.width=`${Math.max(0,100*target.hp/target.maxHp)}%`;
    const threatEl=document.getElementById("targetThreat");
    threatEl.textContent=threat.label;
    threatEl.className=`threat-${threat.cls}`;
    document.getElementById("targetCombatStats").textContent=`DEF ${target.def} • HIT ${hitChance}%`;

    if(combatTarget && combatTarget.alive){
      document.getElementById("combatHint").textContent=targetDistance>ATTACK_RANGE?"Closing to melee range…":"In combat • move away to escape";
      action.innerHTML="LEAVE<br>COMBAT";
      action.classList.add("engaged");
      return;
    }

    document.getElementById("combatHint").textContent=targetDistance>MAX_ENGAGE_RANGE?`Targeted • ${Math.ceil(targetDistance)} away • move closer`:`Targeted • ${Math.ceil(targetDistance)} away • ready to attack`;
    if(attackButtonCooldown>0){
      action.innerHTML=`ATTACK<br>${attackButtonCooldown.toFixed(1)}s`;
      action.classList.add("cooldown");
    }else if(targetDistance<=MAX_ENGAGE_RANGE){
      action.innerHTML="ATTACK<br>TARGET";
      action.classList.add("ready");
    }else{
      action.innerHTML="MOVE<br>CLOSER";
      action.classList.add("targeted");
    }
    return;
  }

  hud.classList.remove("show");
  if(attackButtonCooldown>0){
    action.innerHTML=`ATTACK<br>${attackButtonCooldown.toFixed(1)}s`;
    action.classList.add("cooldown");
  }else{
    action.innerHTML=near?"ATTACK<br>NEAREST":"SELECT MOB<br>TO TARGET";
    if(near) action.classList.add("ready");
  }
}

function engageMob(mob,forced=false){
  if(!mob||!mob.alive||mob.returningHome) return false;
  if(combatTarget===mob) return true;

  const engageDistance=dist(state.x,state.y,mob.x,mob.y);
  if(!forced && engageDistance>MAX_ENGAGE_RANGE){
    selectMob(mob,false);
    toast("Target selected. Move closer before attacking.");
    return false;
  }
  if(!forced && attackButtonCooldown>0){
    toast(`Attack ready in ${attackButtonCooldown.toFixed(1)}s.`);
    return false;
  }

  if(combatTarget && combatTarget!==mob) startMobLeashReturn(combatTarget);
  selectedTarget=mob;
  combatTarget=mob;
  currentMob=mob;
  mob.aggro=true;
  playMobAudio(mob,"aggro");
  if(!forced) attackButtonCooldown=ATTACK_BUTTON_GCD;

  // Starting or switching combat can never grant an instant free hit.
  playerAttackTimer=Math.max(playerAttackTimer,ATTACK_START_DELAY);
  enemyAttackTimer=Math.max(enemyAttackTimer,ATTACK_START_DELAY-.08);
  heroFacing=vectorFacing(mob.x-state.x,mob.y-state.y,heroFacing);
  updateCombatHud();
  if(!forced) toast(`Engaged Lv ${mob.level} ${mobDisplayName(mob)}.`);
  return true;
}

function disengageCombat(showToast=true){
  const disengagedMob=combatTarget;
  if(disengagedMob){
    disengagedMob.aggro=false;
    startMobLeashReturn(disengagedMob);
  }
  combatTarget=null; currentMob=null;
  playerAttackTimer=0; enemyAttackTimer=0;
  updateCombatHud();
  if(showToast) toast("Combat disengaged.");
}

function addCombatFx(x,y,text,kind="damage"){
  combatFx.push({x,y,text,kind,life:.8,maxLife:.8});
}

function performPlayerAutoAttack(mob){
  if(!mob||!mob.alive) return;
  playerAttackAnim=.20;
  playAudioEvent("playerAttack",{bus:"sfx",volume:.8,x:state.x,y:state.y,radius:180});
  if(Math.random()*100>=playerHitChanceAgainst(mob)){
    addCombatFx(mob.x,mob.y-18,"MISS","miss");
    return;
  }
  const crit=Math.random()<PLAYER_CRIT_CHANCE;
  const low=Math.min(PLAYER_DAMAGE_MIN,PLAYER_DAMAGE_MAX);
  const high=Math.max(PLAYER_DAMAGE_MIN,PLAYER_DAMAGE_MAX);
  let dmg=Math.max(1,state.atk+rand(low,high)-mob.def);
  if(crit) dmg*=2;
  mob.hp-=dmg;
  playMobAudio(mob,"hit");
  addCombatFx(mob.x,mob.y-18,crit?`★ ${dmg}`:`${dmg}`,crit?"crit":"damage");
  if(mob.hp<=0){
    mob.hp=0;
    defeatWorldMob(mob);
  }
}

function performEnemyAutoAttack(mob){
  if(!mob||!mob.alive) return;
  mob.attackAnim=.20;
  playMobAudio(mob,"attack");
  enemyAttackAnim=.20;
  if(Math.random()*100>=mobHitChanceAgainstPlayer(mob)){
    addCombatFx(state.x,state.y-20,"MISS","miss");
    return;
  }
  const low=Math.min(ENEMY_DAMAGE_MIN,ENEMY_DAMAGE_MAX);
  const high=Math.max(ENEMY_DAMAGE_MIN,ENEMY_DAMAGE_MAX);
  let dmg=Math.max(1,mob.atk+rand(low,high)-state.def);
  state.hp=Math.max(0,state.hp-dmg);
  playAudioEvent("playerHit",{bus:"sfx",volume:.85,x:state.x,y:state.y,radius:180});
  addCombatFx(state.x,state.y-20,`-${dmg}`,"hurt");
  updateUI();
  if(state.hp<=0) worldCombatDeath();
}

function defeatWorldMob(mob){
  if(!mob||!mob.alive) return;
  playMobAudio(mob,"death");
  const e=mob.template;
  let gold=0;
  let potionDrop=0;
  if(Math.random()<e.goldDropChance) gold=rand(Math.floor(e.gold[0]),Math.floor(e.gold[1]));
  if(mob.elite && gold>0) gold=Math.max(1,Math.round(gold*numberOr(BALANCE.mobLevels?.eliteGoldMultiplier,1.5)));
  if(e.potionDropAmount>0 && Math.random()<e.potionDropChance) potionDrop=e.potionDropAmount;

  const xpReward=mobXpReward(mob);
  const lootReward=rollMobLoot(mob);
  const lootPile=spawnMobLootPile(mob,lootReward.rolled,gold,potionDrop,mobDisplayName(mob));
  const hasLoot=lootPileHasLoot(lootPile);
  state.xp+=xpReward;
  state.kills++;

  notifyQuestKill(e.configKey||e.kind||mob.kind,1);

  mob.alive=false;
  mob.aggro=false;
  mob.respawnTimer=getMobRespawnSeconds(mob);
  if(selectedTarget===mob) selectedTarget=null;
  levelCheck();
  disengageCombat(false);

  if(mob.boss){
    toast(`You defeated ${mobDisplayName(mob)}!${hasLoot?" Sparkling remains hold loot.":""}`);
  }else{
    const rewards=[`+${xpReward} XP`];
    rewards.push(hasLoot?"loot in sparkling remains":"no loot");
    toast(`Defeated ${mobDisplayName(mob)}: ${rewards.join(", ")}`);
  }
  updateUI();
}

function worldCombatDeath(){
  state.gold=Math.floor(state.gold*(1-DEATH_GOLD_LOSS));

  // Clear active controls/effects before teleporting so the new life begins in
  // a clean frame even if a direction or combat button was held at death.
  input={up:false,down:false,left:false,right:false};
  isHeroMoving=false;
  playerAttackTimer=0;
  enemyAttackTimer=0;
  playerAttackAnim=0;
  enemyAttackAnim=0;
  combatFx=[];

  if(combatTarget && !combatTarget.boss){
    combatTarget.x=combatTarget.homeX; combatTarget.y=combatTarget.homeY;
  }
  disengageCombat(false);
  selectedTarget=null;

  state.hp=state.maxHp;
  state.x=START_X; state.y=START_Y;
  lastSafePos={x:state.x,y:state.y};
  toast("You wake up back at the zone start.");
  updateUI();
}

function useQuickPotion(){
  if(potionCooldown>0) return;
  if(state.potions<=0){toast("Your potion pouch is empty.");return}
  if(state.hp>=state.maxHp){toast("Your HP is already full.");return}
  state.potions--;
  const before=state.hp;
  state.hp=Math.min(state.maxHp,state.hp+POTION_HEAL);
  potionCooldown=POTION_COOLDOWN;
  addCombatFx(state.x,state.y-20,`+${state.hp-before}`,"heal");
  playAudioEvent("potion",{bus:"sfx",volume:.8});
  toast(`Potion restored ${state.hp-before} HP.`);
  updateUI();
}

function handleWorldTap(ev){
  if(document.getElementById("menu").classList.contains("show")) return;
  const rect=game.getBoundingClientRect();
  const sx=ev.clientX-rect.left, sy=ev.clientY-rect.top;
  const viewW=innerWidth/CAMERA_ZOOM, viewH=innerHeight/CAMERA_ZOOM;
  const camX=state.x-viewW/2, camY=state.y-viewH/2;
  const wx=camX+sx/CAMERA_ZOOM, wy=camY+sy/CAMERA_ZOOM;

  const tappedLootPile=findLootPileAtWorld(wx,wy,{lootableOnly:true});
  if(tappedLootPile){
    interactWithLootPile(tappedLootPile);
    return;
  }

  const tappedNpc=findNpcAtWorld(wx,wy);
  if(tappedNpc){
    interactWithNpc(tappedNpc);
    return;
  }

  const tappedObject=findInteractableWorldObjectAt(wx,wy);
  if(tappedObject){
    interactWithWorldObject(tappedObject);
    return;
  }

  let best=null;
  let bestScore=Infinity;
  for(const mob of mobs){
    if(!mob.alive || mob.returningHome) continue;
    // Mobs are taller than their feet position, so use a generous vertical
    // selection box rather than requiring a click directly on their feet.
    const dx=Math.abs(wx-mob.x);
    const dy=wy-mob.y;
    const radius=(mob.boss?TARGET_CLICK_RADIUS*1.45:TARGET_CLICK_RADIUS)*Math.max(1,mobVisualScale(mob));
    if(dx<=radius && dy>=-radius*1.35 && dy<=radius*.75){
      const score=dx*dx+(dy*.65)*(dy*.65);
      if(score<bestScore){best=mob;bestScore=score}
    }
  }

  if(best){
    selectMob(best);
  }else if(!combatTarget){
    clearSelectedTarget();
  }
}

function battleMessage(msg){
  document.getElementById("battleMsg").textContent=msg;
}

function setBattleButtons(enabled){
  for(const id of ["attackBtn","defendBtn","potionBtn","runBtn"]){
    document.getElementById(id).disabled=!enabled;
  }
}

function setBattleTurn(mode,label){
  const el=document.getElementById("battleTurn");
  el.classList.remove("enemy","guard");
  if(mode==="enemy") el.classList.add("enemy");
  if(mode==="guard") el.classList.add("guard");
  el.textContent=label || (mode==="enemy"?"ENEMY TURN":"YOUR TURN");
}

function animateBattleActor(which,cls,duration=360){
  const el=document.getElementById(which==="hero"?"heroBattleSprite":"enemyBattleSprite");
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(()=>el.classList.remove(cls),duration);
}

function battleFloat(which,text,kind="damage"){
  const layer=document.getElementById("battleFxLayer");
  const el=document.createElement("div");
  el.className=`battleFloat ${kind}`;
  el.textContent=text;
  el.style.left=which==="hero"?"23%":"72%";
  el.style.top=which==="hero"?"47%":"42%";
  layer.appendChild(el);
  setTimeout(()=>el.remove(),820);
}

function showEnemyIntent(show,text="Enemy is preparing an attack..."){
  const el=document.getElementById("enemyIntent");
  el.textContent=text;
  el.classList.toggle("show",!!show);
}

function returnPlayerTurn(){
  if(!enemy) return;
  battleLocked=false;
  showEnemyIntent(false);
  setBattleTurn("player","YOUR TURN");
  battleMessage("Choose your next action.");
  setBattleButtons(true);
}

function startMobBattle(mob){
  if(enemy || !mob.alive) return;
  startBattle({...mob.template,level:mob.level},mob);
}

function startBattle(base,mobRef=null){
  currentMob=mobRef;
  enemy={...base};
  if(mobRef){
    enemy.level=mobRef.level;
    enemy.elite=!!mobRef.elite;
    enemy.hp=mobRef.hp;
    enemy.maxHp=mobRef.maxHp;
    enemy.atk=mobRef.atk;
    enemy.def=mobRef.def;
    enemy.xp=mobXpReward(mobRef);
  }else{
    const temp={...base,baseLevel:base.baseLevel||base.level||1,boss:!!base.boss};
    const stats=mobScaledStats(temp,base.level||temp.baseLevel,!!base.elite);
    enemy.level=base.level||temp.baseLevel;
    enemy.hp=stats.maxHp; enemy.maxHp=stats.maxHp; enemy.atk=stats.atk; enemy.def=stats.def; enemy.xp=stats.xp;
  }
  defending=false;
  battleLocked=false;
  attackButtonCooldown=0;
  input={up:false,down:false,left:false,right:false};

  document.getElementById("battleTitle").textContent=`Lv ${enemy.level||1} ${enemy.elite?"Elite ":""}${enemy.name} Encounter`;
  document.getElementById("battleScene").dataset.kind=enemy.kind||"mob";
  document.getElementById("battleFxLayer").innerHTML="";
  showEnemyIntent(false);
  setBattleTurn("player","YOUR TURN");
  battleMessage(`${enemy.name} approaches. Choose an action.`);
  setBattleButtons(true);
  document.getElementById("battle").classList.add("show");
  updateUI();
}

function heroAttack(){
  if(!enemy||battleLocked)return;
  battleLocked=true;
  setBattleButtons(false);
  setBattleTurn("guard","HERO ATTACKS");
  battleMessage("You rush forward!");
  animateBattleActor("hero","lunge",360);

  const hitTarget=currentMob||enemy;
  const hit=Math.random()*100<playerHitChanceAgainst(hitTarget);
  const crit=hit && Math.random()<.12;
  let dmg=hit?Math.max(1,state.atk+rand(0,3)-enemy.def):0;
  if(crit)dmg*=2;

  setTimeout(()=>{
    if(!enemy)return;
    if(!hit){
      battleFloat("enemy","MISS","guard");
      battleMessage("Your attack misses.");
      setTimeout(enemyTurn,650);
      return;
    }
    enemy.hp-=dmg;
    animateBattleActor("enemy","hit",300);
    battleFloat("enemy",crit?`CRIT ${dmg}`:`-${dmg}`,crit?"crit":"damage");
    battleMessage(crit?`Critical hit! ${dmg} damage.`:`You strike for ${dmg} damage.`);
    updateUI();

    if(enemy.hp<=0){setTimeout(winBattle,650);return}
    setTimeout(enemyTurn,650);
  },190);
}

function defend(){
  if(!enemy||battleLocked)return;
  battleLocked=true;
  defending=true;
  setBattleButtons(false);
  setBattleTurn("guard","GUARDING");
  document.getElementById("heroBattleSprite").classList.add("guardGlow");
  battleFloat("hero","GUARD","guard");
  battleMessage("You brace yourself. The next hit will deal less damage.");
  setTimeout(enemyTurn,620);
}

function potion(){
  if(!enemy||battleLocked)return;
  if(state.potions<=0){battleMessage("Your potion pouch is empty.");return}
  if(state.hp>=state.maxHp){battleMessage("Your HP is already full.");return}
  battleLocked=true;
  setBattleButtons(false);
  setBattleTurn("guard","USING POTION");
  state.potions--;
  playAudioEvent("potion",{bus:"sfx",volume:.8});
  const before=state.hp;
  state.hp=Math.min(state.maxHp,state.hp+POTION_HEAL);
  const healed=state.hp-before;
  battleFloat("hero",`+${healed}`,"heal");
  battleMessage(`You drink a potion and recover ${healed} HP.`);
  updateUI();
  setTimeout(enemyTurn,700);
}

function run(){
  if(!enemy||battleLocked)return;
  if(enemy.boss){battleMessage(`There is no escape from ${enemy.name}.`);return}
  battleLocked=true;
  setBattleButtons(false);
  setBattleTurn("guard","ESCAPE ATTEMPT");
  battleMessage("You look for an opening...");

  setTimeout(()=>{
    if(!enemy)return;
    if(Math.random()<.68){
      if(currentMob){
        const dx=state.x-currentMob.x;
        const dy=state.y-currentMob.y;
        const len=Math.max(1,Math.hypot(dx,dy));
        state.x+=dx/len*38;
        state.y+=dy/len*38;
      }
      endBattle();
      toast("You escaped.");
    }else{
      battleMessage("No opening! The enemy cuts you off.");
      setTimeout(enemyTurn,520);
    }
  },420);
}

function enemyTurn(){
  if(!enemy)return;
  battleLocked=true;
  setBattleButtons(false);
  setBattleTurn("enemy","ENEMY TURN");
  showEnemyIntent(true,`${enemy.name} is about to attack!`);
  battleMessage(`${enemy.name} prepares a strike...`);

  setTimeout(()=>{
    if(!enemy)return;
    showEnemyIntent(false);
    animateBattleActor("enemy","lunge",360);

    setTimeout(()=>{
      if(!enemy)return;
      const hitSource=currentMob||enemy;
      const hit=Math.random()*100<mobHitChanceAgainstPlayer(hitSource);
      if(!hit){
        defending=false;
        document.getElementById("heroBattleSprite").classList.remove("guardGlow");
        battleFloat("hero","MISS","guard");
        battleMessage(`${enemy.name} misses you.`);
        setTimeout(returnPlayerTurn,650);
        return;
      }
      let dmg=Math.max(1,enemy.atk+rand(0,2)-state.def);
      if(defending)dmg=Math.max(1,Math.floor(dmg/2));
      const guarded=defending;
      defending=false;
      document.getElementById("heroBattleSprite").classList.remove("guardGlow");
      state.hp-=dmg;
      animateBattleActor("hero","hit",300);
      battleFloat("hero",`-${dmg}`,"damage");
      battleMessage(guarded?`Guard softened the blow. You take ${dmg} damage.`:`${enemy.name} hits you for ${dmg} damage.`);
      updateUI();

      if(state.hp<=0){
        state.hp=0;
        setTimeout(loseBattle,700);
        return;
      }
      setTimeout(returnPlayerTurn,650);
    },190);
  },520);
}

function winBattle(){
  if(!enemy)return;
  const e=enemy;
  let gold=rand(e.gold[0],e.gold[1]);
  if(e.elite && gold>0) gold=Math.max(1,Math.round(gold*numberOr(BALANCE.mobLevels?.eliteGoldMultiplier,1.5)));
  let potionDrop=0;
  if(e.potionDropAmount>0 && Math.random()<e.potionDropChance) potionDrop=e.potionDropAmount;
  const lootReward=rollMobLoot(currentMob||e);
  const lootPile=spawnMobLootPile(currentMob||e,lootReward.rolled,gold,potionDrop,e.elite?`Elite ${e.name}`:e.name);
  state.xp+=e.xp;
  state.kills++;

  notifyQuestKill(e.configKey||e.kind||currentMob?.kind,1);

  if(currentMob){
    currentMob.alive=false;
    currentMob.respawnTimer=getMobRespawnSeconds(currentMob);
    currentMob.aggro=false;
  }

  levelCheck();
  endBattle();

  const hasLoot=lootPileHasLoot(lootPile);
  if(e.boss)toast(`You defeated ${e.name}!${hasLoot?" Sparkling remains hold loot.":""}`);
  else toast(`Defeated ${e.elite?"Elite ":""}${e.name}: +${e.xp} XP, ${hasLoot?"loot in sparkling remains":"no loot"}`);
  updateUI();
}

function loseBattle(){
  state.gold=Math.floor(state.gold*(1-DEATH_GOLD_LOSS));
  state.hp=state.maxHp;
  state.x=START_X;
  state.y=START_Y;
  lastSafePos={x:state.x,y:state.y};
  endBattle();
  toast("You wake up back at the zone start.");
  updateUI();
}

function levelCheck(){
  const cap=playerLevelCap();
  const hpGain=Math.floor(numberOr(BALANCE.progression?.hpPerLevel,8));
  const atkGain=Math.floor(numberOr(BALANCE.progression?.attackPerLevel,2));
  const defGain=Math.floor(numberOr(BALANCE.progression?.defensePerLevel,1));
  if(state.level>=cap){
    state.level=cap;
    state.xp=0;
    state.xpNext=0;
    return;
  }
  if(!Number.isFinite(state.xpNext)||state.xpNext<=0) state.xpNext=xpRequiredForLevel(state.level);
  while(state.level<cap && state.xpNext>0 && state.xp>=state.xpNext){
    state.xp-=state.xpNext;
    state.level++;
    state.maxHp+=hpGain;state.hp=state.maxHp;
    state.atk+=atkGain;state.def+=defGain;
    state.xpNext=xpRequiredForLevel(state.level);
    refreshAliveMobStatsForPlayer();
    playAudioEvent("levelUp",{bus:"ui",volume:1});
    setTimeout(()=>toast(`Level up! Level ${state.level}`),650);
  }
  if(state.level>=cap){
    state.xp=0;
    state.xpNext=0;
  }
}

function endBattle(){
  enemy=null;
  currentMob=null;
  defending=false;
  battleLocked=false;
  showEnemyIntent(false);
  document.getElementById("heroBattleSprite").classList.remove("guardGlow","lunge","hit");
  document.getElementById("enemyBattleSprite").classList.remove("lunge","hit");
  setBattleButtons(true);
  document.getElementById("battle").classList.remove("show");
  updateUI();
}

function closeAll(){
  document.getElementById("menu").classList.remove("show");
  document.getElementById("battle").classList.remove("show");
  document.getElementById("backpack")?.classList.remove("show");
  closeQuestLog?.();
  closeNpcDialogue?.();
  closeLootWindow();
  closeStorageWindow?.();
  closeWorldObjectQuestDialog?.();
  cancelDisposePrompt();
}

function updateUI(){
  const characterName=currentCharacterName?.()||"Adventurer";
  if(document.getElementById("menuCharacterName"))document.getElementById("menuCharacterName").textContent=characterName;
  if(document.getElementById("battleHeroName"))document.getElementById("battleHeroName").textContent=characterName;
  document.getElementById("lvl").textContent=state.level;
  document.getElementById("gold").textContent=state.gold;
  document.getElementById("hpText").textContent=`${state.hp}/${state.maxHp}`;
  const atLevelCap=state.level>=playerLevelCap();
  document.getElementById("xpText").textContent=atLevelCap?"MAX LEVEL":`${state.xp}/${state.xpNext}`;
  document.getElementById("hpFill").style.width=`${Math.max(0,100*state.hp/state.maxHp)}%`;
  document.getElementById("xpFill").style.width=atLevelCap?"100%":`${Math.min(100,100*state.xp/Math.max(1,state.xpNext))}%`;
  document.getElementById("hudAtk").textContent=state.atk;
  document.getElementById("hudDef").textContent=state.def;
  document.getElementById("hud").classList.toggle("lowHp",state.hp/state.maxHp<=0.30);

  document.getElementById("mAtk").textContent=state.atk;
  document.getElementById("mDef").textContent=state.def;
  document.getElementById("mPotions").textContent=state.potions;
  document.getElementById("mKills").textContent=state.kills;

  // Quest chip + menu summary are driven by the data-driven quest system.
  refreshQuestUI();

  if(enemy){
    const heroHp=Math.max(0,state.hp);
    const enemyHp=Math.max(0,enemy.hp);
    document.getElementById("bHeroHp").textContent=`${heroHp}/${state.maxHp}`;
    document.getElementById("bEnemyName").textContent=enemy.name;
    document.getElementById("bEnemyHp").textContent=`${enemyHp}/${enemy.maxHp}`;
    document.getElementById("bHeroHpFill").style.width=`${Math.max(0,100*heroHp/state.maxHp)}%`;
    document.getElementById("bEnemyHpFill").style.width=`${Math.max(0,100*enemyHp/enemy.maxHp)}%`;
    document.getElementById("potionCount").textContent=`(${state.potions})`;
  }

  updateBackpackHud();

  const quickPotion=document.getElementById("quickPotion");
  if(quickPotion) quickPotion.textContent=`POTION ${state.potions}`;
  updateCombatHud();
}

// v51 compact floating panels ------------------------------------------------
// Backpack and loot use lightweight, non-modal windows so the world remains
// playable while either panel is open. Positions persist locally per device.
let floatingPanelDrag=null;
let floatingPanelsBound=false;

function floatingPanelById(panelId){
  return typeof panelId==="string"?document.getElementById(panelId):panelId;
}

function constrainFloatingPanel(panelId){
  const panel=floatingPanelById(panelId);
  if(!panel||typeof panel.getBoundingClientRect!=="function") return;
  const rect=panel.getBoundingClientRect();
  if(!rect.width||!rect.height) return;
  const margin=6;
  const maxLeft=Math.max(margin,innerWidth-rect.width-margin);
  const maxTop=Math.max(margin,innerHeight-rect.height-margin);
  const currentLeft=Number.isFinite(parseFloat(panel.style.left))?parseFloat(panel.style.left):rect.left;
  const currentTop=Number.isFinite(parseFloat(panel.style.top))?parseFloat(panel.style.top):rect.top;
  panel.style.left=`${clamp(currentLeft,margin,maxLeft)}px`;
  panel.style.top=`${clamp(currentTop,margin,maxTop)}px`;
  panel.style.right="auto";
  panel.style.bottom="auto";
}

function saveFloatingPanelPosition(panel,key){
  if(!panel||!key) return;
  try{
    localStorage.setItem(key,JSON.stringify({left:parseFloat(panel.style.left)||0,top:parseFloat(panel.style.top)||0}));
  }catch(_err){}
}

function restoreFloatingPanelPosition(panel,key){
  if(!panel||!key) return;
  try{
    const saved=JSON.parse(localStorage.getItem(key)||"null");
    if(saved&&Number.isFinite(Number(saved.left))&&Number.isFinite(Number(saved.top))){
      panel.style.left=`${Number(saved.left)}px`;
      panel.style.top=`${Number(saved.top)}px`;
      panel.style.right="auto";
      panel.style.bottom="auto";
    }
  }catch(_err){}
}

function bindFloatingPanel(panelId,handleId,storageKey){
  const panel=document.getElementById(panelId);
  const handle=document.getElementById(handleId);
  if(!panel||!handle) return;
  restoreFloatingPanelPosition(panel,storageKey);

  handle.addEventListener("pointerdown",event=>{
    if(event.button!=null&&event.button!==0) return;
    if(event.target?.closest?.(".panelClose")) return;
    const rect=panel.getBoundingClientRect();
    floatingPanelDrag={
      pointerId:event.pointerId,
      panel,
      storageKey,
      startX:event.clientX,
      startY:event.clientY,
      left:rect.left,
      top:rect.top
    };
    handle.setPointerCapture?.(event.pointerId);
    panel.classList.add("panelDragging");
    event.preventDefault?.();
  });
}

function bindFloatingPanels(){
  if(floatingPanelsBound) return;
  floatingPanelsBound=true;
  bindFloatingPanel("backpackPanel","backpackDragHandle","lr-ui-backpack-position-v51");
  bindFloatingPanel("lootPanel","lootDragHandle","lr-ui-loot-position-v51");
  bindFloatingPanel("questLogPanel","questLogDragHandle","lr-ui-quest-position-v54");
  bindFloatingPanel("storagePanel","storageDragHandle","lr-ui-storage-position-v76");
  bindFloatingPanel("npcDialogPanel","npcDialogDragHandle","lr-ui-npc-dialog-position-v76-2");
  bindFloatingPanel("objectQuestPanel","objectQuestDragHandle","lr-ui-object-quest-position-v76-2");

  document.addEventListener("pointermove",event=>{
    const drag=floatingPanelDrag;
    if(!drag||event.pointerId!==drag.pointerId) return;
    drag.panel.style.left=`${drag.left+(event.clientX-drag.startX)}px`;
    drag.panel.style.top=`${drag.top+(event.clientY-drag.startY)}px`;
    drag.panel.style.right="auto";
    drag.panel.style.bottom="auto";
    constrainFloatingPanel(drag.panel);
    event.preventDefault?.();
  },{passive:false});

  const finish=event=>{
    const drag=floatingPanelDrag;
    if(!drag||event.pointerId!==drag.pointerId) return;
    floatingPanelDrag=null;
    drag.panel.classList.remove("panelDragging");
    constrainFloatingPanel(drag.panel);
    saveFloatingPanelPosition(drag.panel,drag.storageKey);
  };
  document.addEventListener("pointerup",finish,{passive:false});
  document.addEventListener("pointercancel",finish,{passive:false});
  window.addEventListener("resize",()=>{
    constrainFloatingPanel("backpackPanel");
    constrainFloatingPanel("lootPanel");
    constrainFloatingPanel("storagePanel");
    constrainFloatingPanel("questLogPanel");
    constrainFloatingPanel("npcDialogPanel");
    constrainFloatingPanel("objectQuestPanel");
  });
}

function loadedWholeNumber(value,fallback,min=0){
  const fallbackValue=Math.max(min,Math.floor(numberOr(fallback,min)));
  const n=Number(value);
  if(!Number.isFinite(n)) return fallbackValue;
  const whole=Math.floor(n);
  return whole>=min?whole:fallbackValue;
}

function normalizeLoadedState(raw){
  const base=fresh();
  const source=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
  const next={...base,...source};

  next.level=Math.min(playerLevelCap(),loadedWholeNumber(source.level,base.level,1));
  next.xp=loadedWholeNumber(source.xp,base.xp,0);
  // XP requirements are always derived from the active progression table.
  next.xpNext=xpRequiredForLevel(next.level);
  if(next.level>=playerLevelCap()) next.xp=0;
  next.maxHp=loadedWholeNumber(source.maxHp,base.maxHp,1);
  next.hp=clamp(loadedWholeNumber(source.hp,base.hp,0),0,next.maxHp);
  next.atk=loadedWholeNumber(source.atk,base.atk,0);
  next.def=loadedWholeNumber(source.def,base.def,0);
  next.gold=loadedWholeNumber(source.gold,base.gold,0);
  next.potions=loadedWholeNumber(source.potions,base.potions,0);
  next.kills=loadedWholeNumber(source.kills,base.kills,0);
  next.quests=source.quests&&typeof source.quests==="object"&&!Array.isArray(source.quests)?source.quests:{};
  next.zoneId=String(source.zoneId||base.zoneId||currentWorldZoneId());
  next.worldObjectStates=source.worldObjectStates&&typeof source.worldObjectStates==="object"&&!Array.isArray(source.worldObjectStates)?source.worldObjectStates:{};
  next.inventory=Array.isArray(source.inventory)?source.inventory:base.inventory;
  next.equipment=source.equipment&&typeof source.equipment==="object"?normalizeEquipment(source.equipment):base.equipment;
  next.character=normalizeCharacterProfile(source.character||base.character);

  const x=numberOr(source.x,base.x);
  const y=numberOr(source.y,base.y);
  if(Number.isFinite(x)&&Number.isFinite(y)&&canStand(x,y)){
    next.x=x;
    next.y=y;
  }else{
    next.x=base.x;
    next.y=base.y;
  }
  return next;
}

const PLAYER_SAVE_FORMAT="little-realm-save";
const PLAYER_SAVE_SCHEMA_VERSION=2;
const PLAYER_SAVE_KEY="littleRealmSave";

function save({silent=false}={}){
  try{
    localStorage.setItem(PLAYER_SAVE_KEY,JSON.stringify({format:PLAYER_SAVE_FORMAT,schemaVersion:PLAYER_SAVE_SCHEMA_VERSION,state:{...state}}));
    if(!silent) toast("Game saved.");
    return true;
  }catch(_err){
    toast("Could not save game on this device.");
    return false;
  }
}

async function load({silent=false}={}){
  let raw;
  try{raw=localStorage.getItem(PLAYER_SAVE_KEY);}catch(_err){toast("Could not access saved games on this device.");return false;}
  if(!raw){toast("No save found.");return false;}
  try{
    const payload=JSON.parse(raw);
    if(payload?.format!==PLAYER_SAVE_FORMAT||Math.floor(Number(payload?.schemaVersion))!==PLAYER_SAVE_SCHEMA_VERSION||!payload?.state)throw new Error("Unsupported save format");
    const parsed=payload.state;
    const savedZone=String(parsed.zoneId||"");
    if(savedZone&&savedZone!==currentWorldZoneId())await transitionToWorldZone(savedZone,{quiet:true});
    state=normalizeLoadedState(parsed);
    ensureInventoryState();ensureEquipmentState();lastSafePos={x:state.x,y:state.y};enemy=null;currentMob=null;combatTarget=null;selectedTarget=null;combatFx=[];combatHudSignature="";attackButtonCooldown=0;input={up:false,down:false,left:false,right:false};
    spawnMobs();clearLootPiles();closeAll();updateUI();if(!silent)toast("Game loaded.");return true;
  }catch(err){console.warn("Save load failed",err);toast("Could not load save.");return false;}
}

// Desktop / keyboard input. Bindings live in config/keybinds.js so changing
// keys does not require rebuilding js/game.js.
const KEYBINDS = window.LR_KEYBINDS || {};
const KEYBOARD_TARGET_RANGE = numberOr(BALANCE.combat?.keyboardTargetRange,220);

function bindingList(name,fallback){
  const value=KEYBINDS[name];
  if(Array.isArray(value) && value.length) return value.filter(v=>typeof v==="string"&&v.length);
  if(typeof value==="string" && value.length) return [value];
  return fallback;
}

const INPUT_BINDINGS = {
  moveUp:bindingList("moveUp",["KeyW","ArrowUp"]),
  moveDown:bindingList("moveDown",["KeyS","ArrowDown"]),
  moveLeft:bindingList("moveLeft",["KeyA","ArrowLeft"]),
  moveRight:bindingList("moveRight",["KeyD","ArrowRight"]),
  targetNext:bindingList("targetNext",["Tab"]),
  attackTarget:bindingList("attackTarget",["Space","KeyF"]),
  interact:bindingList("interact",["KeyE"]),
  potion:bindingList("potion",["KeyQ"]),
  clearTarget:bindingList("clearTarget",["Escape"]),
  menu:bindingList("menu",["KeyM"]),
  backpack:bindingList("backpack",["KeyI","KeyB"])
};

// Exposed only as read-only diagnostics so a desktop tester can confirm the
// deployed build from DevTools without digging through bundled source.
window.LR_BUILD_VERSION="v77.8-builder-help-visual-size";
window.LR_INPUT_BINDINGS=Object.freeze({...INPUT_BINDINGS});
window.LR_INPUT_STATE=()=>({...input});

function keyMatches(action,event){
  const keys=INPUT_BINDINGS[action]||[];
  return keys.includes(event.code) || keys.includes(event.key);
}

function isEditableKeyTarget(target){
  if(!target) return false;
  const tag=(target.tagName||"").toLowerCase();
  return target.isContentEditable || tag==="input" || tag==="textarea" || tag==="select";
}

function resetHeldKeyboardMovement(){
  input.up=false; input.down=false; input.left=false; input.right=false;
}

function cycleKeyboardTarget(reverse=false){
  const candidates=mobs
    .filter(mob=>mob.alive && dist(state.x,state.y,mob.x,mob.y)<=KEYBOARD_TARGET_RANGE)
    .sort((a,b)=>{
      const da=dist(state.x,state.y,a.x,a.y);
      const db=dist(state.x,state.y,b.x,b.y);
      return da-db || a.id-b.id;
    });

  if(!candidates.length){
    clearSelectedTarget();
    toast("No mobs are close enough to target.");
    return;
  }

  let index=candidates.indexOf(selectedTarget);
  if(index<0) index=reverse?0:-1;
  index=(index+(reverse?-1:1)+candidates.length)%candidates.length;
  selectMob(candidates[index]);
}

function attackTargetFromKeyboard(){
  if(isGameplayModalOpen()) return;
  if(combatTarget && combatTarget.alive){
    // Combat is automatic once engaged. Repeated key presses never create
    // additional attacks and therefore cannot bypass the global cooldown.
    return;
  }
  if(attackButtonCooldown>0){
    toast(`Attack ready in ${attackButtonCooldown.toFixed(1)}s.`);
    return;
  }
  const target=(selectedTarget&&selectedTarget.alive)?selectedTarget:findNearestMob(MAX_ENGAGE_RANGE);
  if(target) engageMob(target);
  else toast("Target a nearby mob first (Tab or click). ");
}

function clearTargetFromKeyboard(){
  if(combatTarget){
    disengageCombat();
    return;
  }
  if(selectedTarget){
    clearSelectedTarget();
    toast("Target cleared.");
  }
}

function toggleMenuFromKeyboard(){
  const menu=document.getElementById("menu");
  resetHeldKeyboardMovement();
  isHeroMoving=false;
  menu.classList.toggle("show");
}

function prettyKey(code){
  const names={Space:"Space",Tab:"Tab",Escape:"Esc",ArrowUp:"↑",ArrowDown:"↓",ArrowLeft:"←",ArrowRight:"→"};
  if(names[code]) return names[code];
  if(code.startsWith("Key")) return code.slice(3);
  if(code.startsWith("Digit")) return code.slice(5);
  return code;
}

function bindingLabel(action){
  return (INPUT_BINDINGS[action]||[]).map(prettyKey).join("/");
}

function updateKeyboardHelp(){
  const compact=document.getElementById("pcControls");
  if(compact){
    compact.textContent=`PC CONTROLS  •  MOVE ${bindingLabel("moveUp")}/${bindingLabel("moveLeft")}/${bindingLabel("moveDown")}/${bindingLabel("moveRight")}  •  INTERACT ${bindingLabel("interact")}  •  TARGET ${bindingLabel("targetNext")}  •  ATTACK ${bindingLabel("attackTarget")}  •  POTION ${bindingLabel("potion")}  •  PACK ${bindingLabel("backpack")}  •  MENU ${bindingLabel("menu")}`;
  }
  const list=document.getElementById("keybindList");
  if(list){
    list.innerHTML=`<b>PC Controls</b><br>Move: ${bindingLabel("moveUp")} / ${bindingLabel("moveLeft")} / ${bindingLabel("moveDown")} / ${bindingLabel("moveRight")}<br>Interact / talk: ${bindingLabel("interact")}<br>Target next mob: ${bindingLabel("targetNext")}<br>Attack target: ${bindingLabel("attackTarget")}<br>Quick potion: ${bindingLabel("potion")}<br>Backpack: ${bindingLabel("backpack")}<br>Clear target / leave combat: ${bindingLabel("clearTarget")}<br>Menu: ${bindingLabel("menu")}`;
  }
}

function bindKeyboardControls(){
  window.addEventListener("keydown",event=>{
    if(isEditableKeyTarget(event.target)) return;

    const overlayOpen=isGameplayModalOpen();
    if(!overlayOpen){
      if(keyMatches("moveUp",event)){event.preventDefault();input.up=true;}
      if(keyMatches("moveDown",event)){event.preventDefault();input.down=true;}
      if(keyMatches("moveLeft",event)){event.preventDefault();input.left=true;}
      if(keyMatches("moveRight",event)){event.preventDefault();input.right=true;}
    }

    // Discrete actions should only fire once per physical press.
    if(event.repeat) return;

    if(keyMatches("backpack",event)){
      event.preventDefault();
      toggleBackpack();
    }else if(keyMatches("interact",event)){
      event.preventDefault();
      interactWithNearestWorldTarget();
    }else if(keyMatches("targetNext",event)){
      event.preventDefault();
      cycleKeyboardTarget(event.shiftKey);
    }else if(keyMatches("attackTarget",event)){
      event.preventDefault();
      attackTargetFromKeyboard();
    }else if(keyMatches("potion",event)){
      event.preventDefault();
      useQuickPotion();
    }else if(keyMatches("clearTarget",event)){
      event.preventDefault();
      const menu=document.getElementById("menu");
      const backpack=document.getElementById("backpack");
      const lootWindow=document.getElementById("lootWindow");
      const storageWindow=document.getElementById("storageWindow");
      const objectQuestDialog=document.getElementById("objectQuestDialog");
      const disposePrompt=document.getElementById("disposePrompt");
      const npcDialog=document.getElementById("npcDialog");
      if(disposePrompt.classList.contains("show")) cancelDisposePrompt();
      else if(objectQuestDialog?.classList.contains("show")) closeWorldObjectQuestDialog();
      else if(npcDialog?.classList.contains("show")) closeNpcDialogue();
      else if(storageWindow?.classList.contains("show")) closeStorageWindow();
      else if(lootWindow.classList.contains("show")) closeLootWindow();
      else if(backpack.classList.contains("show")) closeBackpack();
      else if(menu.classList.contains("show")) menu.classList.remove("show");
      else clearTargetFromKeyboard();
    }else if(keyMatches("menu",event)){
      event.preventDefault();
      toggleMenuFromKeyboard();
    }
  });

  window.addEventListener("keyup",event=>{
    if(keyMatches("moveUp",event)) input.up=false;
    if(keyMatches("moveDown",event)) input.down=false;
    if(keyMatches("moveLeft",event)) input.left=false;
    if(keyMatches("moveRight",event)) input.right=false;
  });

  window.addEventListener("blur",resetHeldKeyboardMovement);
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden) resetHeldKeyboardMovement();
  });
  updateKeyboardHelp();
}

function frame(now){
  const dt=Math.min(.033,(now-lastFrame)/1000);
  lastFrame=now;
  updateDeveloperCamera(dt);
  updateMovement(dt);
  updateLootPiles(now);
  updateMobs(dt);
  updateOpenCombat(dt);
  updateAudioRuntime(dt);
  if(isHeroMoving) moveAnimTime+=dt;
  drawWorld();
  requestAnimationFrame(frame);
}

// One-time startup. Keep gameplay functions in their owning source modules above.
buildWorld();
buildScenery();
window.addEventListener("resize",resize);
resize();

bindHold("up","up");
bindHold("down","down");
bindHold("left","left");
bindHold("right","right");

bindKeyboardControls();
initDeveloperMode();
initializeAudioRuntime();

document.getElementById("actionHint").innerHTML="SELECT MOB<br>TO TARGET";
document.getElementById("actionHint").onclick=()=>{
  if(combatTarget){disengageCombat();return}
  if(attackButtonCooldown>0){
    toast(`Attack ready in ${attackButtonCooldown.toFixed(1)}s.`);
    return;
  }
  const target=(selectedTarget&&selectedTarget.alive)?selectedTarget:findNearestMob(MAX_ENGAGE_RANGE);
  if(target) engageMob(target);
  else toast("Click/tap a mob to target it first.");
};
document.getElementById("quickPotion").onclick=useQuickPotion;

document.getElementById("backpackBtn").onclick=toggleBackpack;
document.getElementById("questChip").onclick=toggleQuestLog;
document.getElementById("closeQuestLog").onclick=closeQuestLog;
document.getElementById("closeNpcDialog").onclick=closeNpcDialogue;
document.getElementById("closeBackpack").onclick=closeBackpack;
document.getElementById("inventoryGrid").onclick=handleInventoryGridClick;
document.getElementById("lootGrid").onclick=handleLootGridClick;
document.getElementById("takeAllLoot")?.addEventListener("click",takeAllLoot);
document.getElementById("closeLootWindow").onclick=closeLootWindow;
document.getElementById("closeStorageWindow").onclick=closeStorageWindow;
document.getElementById("closeObjectQuestDialog").onclick=closeWorldObjectQuestDialog;
document.getElementById("disposeCancel").onclick=cancelDisposePrompt;
document.getElementById("disposeConfirm").onclick=confirmDisposePrompt;
bindInventoryInteractions();
bindLootInteractions();
bindStorageInteractions();
bindFloatingPanels();
game.addEventListener("pointerdown",handleWorldTap);
document.getElementById("menuBtn").onclick=()=>{
  input={up:false,down:false,left:false,right:false};
  isHeroMoving=false;
  document.getElementById("menu").classList.add("show");
};
document.getElementById("closeMenu").onclick=()=>document.getElementById("menu").classList.remove("show");
document.getElementById("saveBtn").onclick=save;
document.getElementById("loadBtn").onclick=load;
document.getElementById("newBtn").onclick=()=>{
  if(!confirm("Return to character select and start a new game?"))return;
  document.getElementById("menu").classList.remove("show");
  beginNewCharacterFlow();
};
document.getElementById("fullBtn").onclick=async()=>{
  try{
    if(!document.fullscreenElement)await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
    document.getElementById("menu").classList.remove("show");
  }catch(e){toast("Fullscreen isn't available in this browser.");}
};
document.getElementById("attackBtn").onclick=heroAttack;
document.getElementById("defendBtn").onclick=defend;
document.getElementById("potionBtn").onclick=potion;
document.getElementById("runBtn").onclick=run;

bindStartupScreen();
initializeStartupFlow();
if(window.LR_BUILDER_MODE && typeof setDeveloperMode==="function") setDeveloperMode(true);
requestAnimationFrame(frame);
})();
