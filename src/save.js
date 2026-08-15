function save(){
  const saveData={...state};
  localStorage.setItem("littleRealmMobileSaveV3",JSON.stringify(saveData));
  toast("Game saved.");
}
function load(){
  const raw=localStorage.getItem("littleRealmMobileSaveV3");
  if(!raw){toast("No v3 save found.");return}
  try{
    state={...fresh(),...JSON.parse(raw)};
    enemy=null;
    currentMob=null;
    combatTarget=null;
    combatFx=[];
    attackButtonCooldown=0;
    input={up:false,down:false,left:false,right:false};
    spawnMobs();
    closeAll();
    updateUI();
    toast("Game loaded.");
  }catch(e){
    toast("Could not load save.");
  }
}
