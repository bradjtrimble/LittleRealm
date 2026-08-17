// Data-driven quest runtime ---------------------------------------------------
// Quest definitions live in config/quests.js and can be authored visually in
// World Builder. Runtime progress stays in the normal player save state.

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
  const type=["kill","collect","talk","deliver","visit"].includes(raw.type)?raw.type:"talk";
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
    const template=[...enemyTemplates,bossTemplate].find(t=>(t.configKey||t.kind)===objective.target||t.kind===objective.target);
    return template?.name||objective.target||"enemy";
  }
  if(objective.type==="collect"||objective.type==="deliver") return getItemDefinition(objective.target).name;
  if(objective.type==="talk") return sceneryNPCs.find(n=>n.id===objective.target)?.name||objective.target||"NPC";
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

function openNpcDialogue(npc){
  if(!npc||!state) return false;
  activeNpcDialogId=npc.id;
  if(combatTarget) disengageCombat(false);
  npc.facing=vectorFacing(state.x-npc.x,state.y-npc.y,npc.facing||"down");
  notifyQuestTalk(npc.id);
  document.getElementById("npcDialog")?.classList.add("show");
  renderNpcDialogue();
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

