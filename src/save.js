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

  next.level=loadedWholeNumber(source.level,base.level,1);
  next.xp=loadedWholeNumber(source.xp,base.xp,0);
  next.xpNext=loadedWholeNumber(source.xpNext,base.xpNext,1);
  next.maxHp=loadedWholeNumber(source.maxHp,base.maxHp,1);
  next.hp=clamp(loadedWholeNumber(source.hp,base.hp,0),0,next.maxHp);
  next.atk=loadedWholeNumber(source.atk,base.atk,0);
  next.def=loadedWholeNumber(source.def,base.def,0);
  next.gold=loadedWholeNumber(source.gold,base.gold,0);
  next.potions=loadedWholeNumber(source.potions,base.potions,0);
  next.kills=loadedWholeNumber(source.kills,base.kills,0);
  next.slimeKills=loadedWholeNumber(source.slimeKills,base.slimeKills,0);
  next.questComplete=booleanOr(source.questComplete,base.questComplete);
  next.bossDefeated=booleanOr(source.bossDefeated,base.bossDefeated);
  next.quests=source.quests&&typeof source.quests==="object"&&!Array.isArray(source.quests)?source.quests:{};
  next.inventory=Array.isArray(source.inventory)?source.inventory:base.inventory;

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

function save(){
  try{
    localStorage.setItem("littleRealmMobileSaveV3",JSON.stringify({...state}));
    toast("Game saved.");
    return true;
  }catch(_err){
    toast("Could not save game on this device.");
    return false;
  }
}

function load(){
  let raw;
  try{
    raw=localStorage.getItem("littleRealmMobileSaveV3");
  }catch(_err){
    toast("Could not access saved games on this device.");
    return false;
  }
  if(!raw){toast("No v3 save found.");return false}

  try{
    state=normalizeLoadedState(JSON.parse(raw));
    ensureInventoryState();
    lastSafePos={x:state.x,y:state.y};
    enemy=null;
    currentMob=null;
    combatTarget=null;
    selectedTarget=null;
    combatFx=[];
    combatHudSignature="";
    attackButtonCooldown=0;
    input={up:false,down:false,left:false,right:false};
    spawnMobs();
    closeAll();
    updateUI();
    toast("Game loaded.");
    return true;
  }catch(_err){
    toast("Could not load save.");
    return false;
  }
}
