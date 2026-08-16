function closeAll(){
  document.getElementById("menu").classList.remove("show");
  document.getElementById("battle").classList.remove("show");
  document.getElementById("backpack")?.classList.remove("show");
  closeQuestLog?.();
  closeNpcDialogue?.();
  closeLootWindow();
  cancelDisposePrompt();
}

function updateUI(){
  document.getElementById("lvl").textContent=state.level;
  document.getElementById("gold").textContent=state.gold;
  document.getElementById("hpText").textContent=`${state.hp}/${state.maxHp}`;
  document.getElementById("xpText").textContent=`${state.xp}/${state.xpNext}`;
  document.getElementById("hpFill").style.width=`${Math.max(0,100*state.hp/state.maxHp)}%`;
  document.getElementById("xpFill").style.width=`${Math.min(100,100*state.xp/state.xpNext)}%`;
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
  });
}
