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
document.getElementById("closeBackpack").onclick=closeBackpack;
document.getElementById("inventoryGrid").onclick=handleInventoryGridClick;
document.getElementById("lootGrid").onclick=handleLootGridClick;
document.getElementById("takeAllLoot").onclick=takeAllLoot;
document.getElementById("closeLootWindow").onclick=closeLootWindow;
document.getElementById("disposeCancel").onclick=cancelDisposePrompt;
document.getElementById("disposeConfirm").onclick=confirmDisposePrompt;
bindInventoryInteractions();
bindLootInteractions();
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
  if(confirm("Start a new game?"))reset();
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

reset();
requestAnimationFrame(frame);
