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
