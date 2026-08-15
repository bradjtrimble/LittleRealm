// One-time startup. Keep gameplay functions in their owning source modules above.
buildWorld();
buildScenery();
window.addEventListener("resize",resize);
resize();

bindHold("up","up");
bindHold("down","down");
bindHold("left","left");
bindHold("right","right");

window.addEventListener("blur",()=>{
  input={up:false,down:false,left:false,right:false};
});
document.addEventListener("visibilitychange",()=>{
  if(document.hidden) input={up:false,down:false,left:false,right:false};
});

window.addEventListener("keydown",e=>{
  const k=e.key.toLowerCase();
  if(k==="arrowup"||k==="w"){e.preventDefault();input.up=true}
  if(k==="arrowdown"||k==="s"){e.preventDefault();input.down=true}
  if(k==="arrowleft"||k==="a"){e.preventDefault();input.left=true}
  if(k==="arrowright"||k==="d"){e.preventDefault();input.right=true}
});
window.addEventListener("keyup",e=>{
  const k=e.key.toLowerCase();
  if(k==="arrowup"||k==="w")input.up=false;
  if(k==="arrowdown"||k==="s")input.down=false;
  if(k==="arrowleft"||k==="a")input.left=false;
  if(k==="arrowright"||k==="d")input.right=false;
});

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
