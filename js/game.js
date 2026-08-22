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

// Production-only World Builder compatibility hooks.
// The full editor lives in builder/game.js and is not shipped to players.
let devModeActive=false;
let devSelectedRemnant=null;
let devRemnantPreview=null;
function drawDeveloperOverlay(){}
function initDeveloperMode(){}
function toggleDeveloperMode(){}

function developerCameraFrame(vw=innerWidth,vh=innerHeight){const zoom=CAMERA_ZOOM,viewW=vw/zoom,viewH=vh/zoom;return {mode:"player",zoom,viewW,viewH,camX:state.x-viewW/2,camY:state.y-viewH/2,centerX:state.x,centerY:state.y};}
function developerCameraZoomValue(){return CAMERA_ZOOM;}
function developerCameraLocksPlayerMovement(){return false;}
function updateDeveloperCamera(){}

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
