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
