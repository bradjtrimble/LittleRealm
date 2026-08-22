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
