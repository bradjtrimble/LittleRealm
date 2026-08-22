function devQuestOptions(values,selected){
  return values.map(([value,label])=>`<option value="${questEscape(value)}" ${value===selected?"selected":""}>${questEscape(label)}</option>`).join("");
}
function developerObjectiveDefault(type="talk"){
  if(type==="kill")return normalizeQuestObjective({type,target:allMobTemplates()[0]?.configKey||"",amount:1});
  if(type==="collect"||type==="deliver")return normalizeQuestObjective({type,target:Object.keys(ITEM_DEFS)[0]||"",amount:1,consumeOnTurnIn:true});
  if(type==="visit")return normalizeQuestObjective({type,x:Math.round(state?.x||START_X),y:Math.round(state?.y||START_Y),radius:36,amount:1});
  if(type==="interact"){const first=sceneryProps.find(o=>worldObjectInteraction(o).enabled);return normalizeQuestObjective({type,target:first?(worldObjectInteraction(first).tag||first.id):"",amount:1});}
  return normalizeQuestObjective({type:"talk",target:sceneryNPCs[0]?.id||"",amount:1});
}
function developerNewQuest(){
  const giver=devSelectedNpc?.id||sceneryNPCs[0]?.id||"";
  const root=uniqueQuestId("new_quest");
  return normalizeQuestDefinition({id:root,title:"New Quest",description:"Describe what the player should do.",giverNpc:giver,turnInNpc:giver,openingDialogue:"Could you help me?",completionDialogue:"Thank you for your help.",level:1,levelRequirementMode:"auto",rewardTier:"minor",objectives:[developerObjectiveDefault("talk")],rewards:{xpMode:"auto",xp:0,gold:0,items:[]}},questDefinitions.length);
}
function uniqueQuestId(base="quest"){
  const root=String(base||"quest").toLowerCase().replace(/[^a-z0-9_-]+/g,"_")||"quest";let id=root,n=2;
  while(questDefinitions.some(q=>q.id===id))id=`${root}_${n++}`;return id;
}
function developerQuestTargetOptions(type,selected){
  let values=[];
  if(type==="kill") values=allMobTemplates().map(t=>[t.configKey||t.kind,t.name]);
  else if(type==="collect"||type==="deliver") values=Object.keys(ITEM_DEFS).map(id=>[id,getItemDefinition(id).name]);
  else if(type==="talk") values=sceneryNPCs.map(n=>[n.id,n.name]);
  else if(type==="interact"){
    const seen=new Set();
    values=sceneryProps.filter(o=>worldObjectInteraction(o).enabled).map(o=>{const cfg=worldObjectInteraction(o),value=cfg.tag||o.id;return [value,`${o.label||o.type} • ${value}`];}).filter(([value])=>value&&!seen.has(value)&&seen.add(value));
  }
  if(selected&&!values.some(([v])=>v===selected)) values.push([selected,selected]);
  return values;
}
function readDeveloperQuestForm(){
  const root=devPanel?.querySelector("#devQuestEditor");
  const fallback=devQuestFormDraft||getQuestDefinition(devSelectedQuestId)||developerNewQuest();
  if(!root)return cloneQuest(fallback);
  const objectives=[...root.querySelectorAll("[data-objective-index]")].map(row=>{
    const type=row.querySelector("[data-obj-type]")?.value||"talk";
    const amount=Math.max(1,Math.floor(numberOr(row.querySelector("[data-obj-amount]")?.value,1)));
    if(type==="visit")return normalizeQuestObjective({type,amount:1,x:row.querySelector("[data-obj-x]")?.value,y:row.querySelector("[data-obj-y]")?.value,radius:row.querySelector("[data-obj-radius]")?.value});
    return normalizeQuestObjective({type,target:row.querySelector("[data-obj-target]")?.value||"",amount,consumeOnTurnIn:row.querySelector("[data-obj-consume]")?.checked!==false});
  });
  const rewardItem=root.querySelector("#devQuestRewardItem")?.value||"";
  return normalizeQuestDefinition({
    id:root.querySelector("#devQuestId")?.value||fallback.id,
    title:root.querySelector("#devQuestTitle")?.value||fallback.title,
    description:root.querySelector("#devQuestDescription")?.value||"",
    giverNpc:root.querySelector("#devQuestGiver")?.value||"",
    turnInNpc:root.querySelector("#devQuestTurnIn")?.value||"",
    openingDialogue:root.querySelector("#devQuestOpening")?.value||"",
    completionDialogue:root.querySelector("#devQuestCompletion")?.value||"",
    level:root.querySelector("#devQuestLevel")?.value||fallback.level||1,
    levelRequirementMode:root.querySelector("#devQuestLevelRequirementMode")?.value||fallback.levelRequirementMode||"auto",
    minLevel:root.querySelector("#devQuestMinLevel")?.value||fallback.minLevel||1,
    rewardTier:root.querySelector("#devQuestRewardTier")?.value||fallback.rewardTier||"standard",
    objectives:objectives.length?objectives:[developerObjectiveDefault("talk")],
    rewards:{xpMode:root.querySelector("#devQuestXpMode")?.value||fallback.rewards?.xpMode||"custom",xp:root.querySelector("#devQuestRewardXp")?.value,gold:root.querySelector("#devQuestRewardGold")?.value,items:rewardItem?[{id:rewardItem,qty:root.querySelector("#devQuestRewardQty")?.value||1}]:[]},
    prerequisite:root.querySelector("#devQuestPrereq")?.value||null,
    nextQuest:root.querySelector("#devQuestNext")?.value||null,
    repeatable:!!root.querySelector("#devQuestRepeatable")?.checked
  });
}
function renderDeveloperQuestEditor(draft){
  const root=devPanel?.querySelector("#devQuestEditor");if(!root)return;
  draft=normalizeQuestDefinition(draft,questDefinitions.findIndex(q=>q.id===draft?.id));
  devQuestFormDraft=cloneQuest(draft);
  const npcOptions=[["","None / Object Offered"],...sceneryNPCs.map(n=>[n.id,n.name])];
  const questOptions=[["","None"],...questDefinitions.filter(q=>q.id!==draft.id).map(q=>[q.id,q.title])];
  const itemOptions=[["","No item reward"],...Object.keys(ITEM_DEFS).map(id=>[id,getItemDefinition(id).name])];
  const rewardTierOptions=Object.entries(QUEST_XP_PROFILE_LABELS).map(([id,label])=>[id,label]);
  const rewardItem=draft.rewards.items?.[0]?.id||"",rewardQty=draft.rewards.items?.[0]?.qty||1;
  const xpProfile=questXpProfile(draft.rewardTier,draft.repeatable&&draft.rewards.xpMode==="auto");
  const xpProfileLabel=QUEST_XP_PROFILE_LABELS[xpProfile.tier]||xpProfile.tier;
  const autoXp=draft.rewards.xpMode==="auto";
  const autoMin=draft.levelRequirementMode!=="custom";
  root.innerHTML=`<div class="devQuestEditor">
    <div class="devPair"><label>Quest ID<input id="devQuestId" value="${questEscape(draft.id)}"></label><label>Quest Name<input id="devQuestTitle" value="${questEscape(draft.title)}"></label></div>
    <label>Description<textarea id="devQuestDescription">${questEscape(draft.description)}</textarea></label>
    <div class="devSubhead">Level & Availability</div>
    <div class="devQuad"><label>Quest Level<input id="devQuestLevel" type="number" min="1" max="${playerLevelCap()}" value="${draft.level}"></label><label>Minimum Level<select id="devQuestLevelRequirementMode">${devQuestOptions([["auto","Automatic (-3 levels)"],["custom","Custom"]],draft.levelRequirementMode)}</select></label><label>Requires Level<input id="devQuestMinLevel" type="number" min="1" max="${draft.level}" value="${draft.minLevel}" ${autoMin?"readonly":""}></label><label>Recommended Through<input type="number" value="${draft.recommendedMaxLevel}" readonly></label></div>
    <div class="devHint">Quest Lv ${draft.level} becomes available at Lv ${draft.minLevel}. Recommended range: Lv ${draft.minLevel}–${draft.recommendedMaxLevel}. There is no maximum acceptance level, so players can always come back later.</div>
    <div class="devPair"><label>Quest Giver<select id="devQuestGiver">${devQuestOptions(npcOptions,draft.giverNpc)}</select></label><label>Turn-In NPC<select id="devQuestTurnIn">${devQuestOptions(npcOptions,draft.turnInNpc)}</select></label></div>
    <label>Opening Dialogue<textarea id="devQuestOpening">${questEscape(draft.openingDialogue)}</textarea></label>
    <label>Completion Dialogue<textarea id="devQuestCompletion">${questEscape(draft.completionDialogue)}</textarea></label>
    <div class="devSubhead">Objectives</div><div id="devQuestObjectives">${draft.objectives.map((objective,index)=>{
      const types=[["kill","Kill"],["collect","Collect"],["talk","Talk"],["deliver","Deliver"],["visit","Visit"],["interact","Interact With Object"]];
      const visit=objective.type==="visit";
      return `<div class="devQuestObjective" data-objective-index="${index}"><div class="devQuestObjectiveTop"><label>Type<select data-obj-type>${devQuestOptions(types,objective.type)}</select></label>${visit?`<label>Location<span style="padding:9px 0;color:#b9aebe">World coordinates</span></label>`:`<label>Target<select data-obj-target>${devQuestOptions(developerQuestTargetOptions(objective.type,objective.target),objective.target)}</select></label>`}<label>Amount<input data-obj-amount type="number" min="1" value="${objective.amount}" ${visit?"disabled":""}></label><button data-remove-objective="${index}" title="Remove objective">×</button></div>${visit?`<div class="devVisitGrid"><label>X<input data-obj-x type="number" value="${Math.round(objective.x)}"></label><label>Y<input data-obj-y type="number" value="${Math.round(objective.y)}"></label><label>Radius<input data-obj-radius type="number" min="8" value="${Math.round(objective.radius)}"></label></div><button data-use-player-pos="${index}" style="margin-top:6px;border:1px solid rgba(255,255,255,.12);background:#4b4056;color:#fff;border-radius:7px;padding:6px 8px">Use Player Position</button>`:(objective.type==="collect"||objective.type==="deliver")?`<label style="flex-direction:row;align-items:center"><input data-obj-consume type="checkbox" ${objective.consumeOnTurnIn!==false?"checked":""}> Consume items on turn-in</label>`:""}</div>`;
    }).join("")}</div>
    <button id="devAddQuestObjective" class="devHitboxEditButton">+ Add Objective</button>
    <div class="devSubhead">Rewards</div>
    <div class="devPair"><label>XP Mode<select id="devQuestXpMode">${devQuestOptions([["auto","Automatic"],["custom","Custom"]],draft.rewards.xpMode)}</select></label><label>XP Profile<select id="devQuestRewardTier" ${draft.repeatable&&autoXp?"disabled":""}>${devQuestOptions(rewardTierOptions,xpProfile.tier)}</select></label></div>
    <div class="devHint">${autoXp?`Auto XP: <b>${draft.rewards.xp} XP</b> • ${questEscape(xpProfileLabel)} • ${xpProfile.mobEquivalent} same-level mob equivalents • capped at ${xpProfile.levelCapPercent}% of this level.${draft.repeatable?" Repeatable quests automatically use the Repeatable profile.":""}`:"Custom XP ignores the automatic quest-level formula."}</div>
    <div class="devQuad"><label>XP<input id="devQuestRewardXp" type="number" min="0" value="${draft.rewards.xp}" ${autoXp?"readonly":""}></label><label>Gold<input id="devQuestRewardGold" type="number" min="0" value="${draft.rewards.gold}"></label><label>Item<select id="devQuestRewardItem">${devQuestOptions(itemOptions,rewardItem)}</select></label><label>Qty<input id="devQuestRewardQty" type="number" min="1" value="${rewardQty}"></label></div>
    <div class="devPair"><label>Prerequisite<select id="devQuestPrereq">${devQuestOptions(questOptions,draft.prerequisite||"")}</select></label><label>Next Quest<select id="devQuestNext">${devQuestOptions(questOptions,draft.nextQuest||"")}</select></label></div>
    <label style="flex-direction:row;align-items:center"><input id="devQuestRepeatable" type="checkbox" ${draft.repeatable?"checked":""}> Repeatable quest</label>
    <div class="devRow"><button id="devQuestSave">Save Quest</button><button id="devQuestTest">Reset Test Progress</button></div>
  </div>`;
  root.querySelectorAll("[data-obj-type]").forEach((select,index)=>select.onchange=()=>{
    const next=readDeveloperQuestForm();const type=select.value;next.objectives[index]=developerObjectiveDefault(type);
    if(next.rewards.xpMode==="auto"&&!next.repeatable) next.rewardTier=inferQuestRewardTier(next.objectives,false);
    devQuestFormDraft=next;renderDeveloperQuestEditor(next);
  });
  root.querySelectorAll("[data-remove-objective]").forEach(button=>button.onclick=()=>{const next=readDeveloperQuestForm();next.objectives.splice(Number(button.dataset.removeObjective),1);if(!next.objectives.length)next.objectives.push(developerObjectiveDefault("talk"));if(next.rewards.xpMode==="auto"&&!next.repeatable)next.rewardTier=inferQuestRewardTier(next.objectives,false);renderDeveloperQuestEditor(next);});
  root.querySelectorAll("[data-use-player-pos]").forEach(button=>button.onclick=()=>{const next=readDeveloperQuestForm();const objective=next.objectives[Number(button.dataset.usePlayerPos)];objective.x=Math.round(state.x);objective.y=Math.round(state.y);renderDeveloperQuestEditor(next);});
  root.querySelector("#devAddQuestObjective").onclick=()=>{const next=readDeveloperQuestForm();next.objectives.push(developerObjectiveDefault("kill"));if(next.rewards.xpMode==="auto"&&!next.repeatable)next.rewardTier="multi";renderDeveloperQuestEditor(next);};
  ["devQuestLevel","devQuestLevelRequirementMode","devQuestMinLevel","devQuestXpMode","devQuestRewardTier","devQuestRepeatable"].forEach(id=>{const input=root.querySelector(`#${id}`);if(input)input.onchange=()=>renderDeveloperQuestEditor(readDeveloperQuestForm());});
  root.querySelector("#devQuestSave").onclick=saveDeveloperQuest;
  root.querySelector("#devQuestTest").onclick=()=>{const id=readDeveloperQuestForm().id;delete ensureQuestState()[id];refreshQuestUI();renderNpcDialogue();devSetStatus(`Reset test progress for ${id}`);};
}
function saveDeveloperQuest(){
  const oldId=devSelectedQuestId;const next=readDeveloperQuestForm();
  let newId=String(next.id||oldId||"quest").trim().toLowerCase().replace(/[^a-z0-9_-]+/g,"_");
  if(!newId)newId="quest";
  if(questDefinitions.some(q=>q.id===newId&&q.id!==oldId)){devSetStatus(`Quest id '${newId}' is already in use`);return;}
  next.id=newId;
  const i=questDefinitions.findIndex(q=>q.id===oldId);if(i>=0)questDefinitions[i]=normalizeQuestDefinition(next,i);else questDefinitions.push(normalizeQuestDefinition(next,questDefinitions.length));
  if(oldId&&oldId!==newId){
    for(const quest of questDefinitions){if(quest.prerequisite===oldId)quest.prerequisite=newId;if(quest.nextQuest===oldId)quest.nextQuest=newId;}
    for(const obj of sceneryProps){const ids=obj?.interaction?.actions?.questIds;if(Array.isArray(ids))obj.interaction.actions.questIds=ids.map(id=>id===oldId?newId:id);}
    const qs=ensureQuestState();if(qs[oldId]){qs[newId]=qs[oldId];delete qs[oldId];}
  }
  devSelectedQuestId=newId;devQuestFormDraft=cloneQuest(getQuestDefinition(newId));saveDeveloperDraft();refreshDeveloperQuestPanel();refreshQuestUI();devSetStatus(`Saved quest: ${next.title}`);
}
function refreshDeveloperQuestPanel(){
  if(!devPanel)return;
  const list=devPanel.querySelector("#devQuestList"),editor=devPanel.querySelector("#devQuestEditor"),count=devPanel.querySelector("#devQuestCount");
  if(count)count.textContent=`${questDefinitions.length} quest${questDefinitions.length===1?"":"s"}`;
  if(!devSelectedQuestId||!getQuestDefinition(devSelectedQuestId))devSelectedQuestId=questDefinitions[0]?.id||null;
  if(list){list.innerHTML="";const query=String(devPanel.querySelector("#devQuestSearch")?.value||"").trim().toLowerCase();for(const quest of questDefinitions){if(query&&!`${quest.title||""} ${quest.id||""}`.toLowerCase().includes(query))continue;const b=document.createElement("button");b.className="devQuestChip"+(quest.id===devSelectedQuestId?" active":"");b.textContent=`Lv ${quest.level} • ${quest.title}`;b.title=`${quest.id} • requires Lv ${quest.minLevel}`;b.onclick=()=>{devSelectedQuestId=quest.id;devQuestFormDraft=cloneQuest(quest);refreshDeveloperQuestPanel();};list.appendChild(b);}}
  if(!editor)return;
  if(!devSelectedQuestId){editor.innerHTML='<div class="devEmpty">No quests yet. Click New Quest to create one.</div>';return;}
  const selected=getQuestDefinition(devSelectedQuestId);if(!devQuestFormDraft||devQuestFormDraft.id!==selected.id)devQuestFormDraft=cloneQuest(selected);renderDeveloperQuestEditor(devQuestFormDraft);
}
function createDeveloperQuest(){
  const quest=developerNewQuest();questDefinitions.push(quest);devSelectedQuestId=quest.id;devQuestFormDraft=cloneQuest(quest);setDeveloperTab("quests");saveDeveloperDraft();refreshDeveloperPanel();
}
function duplicateDeveloperQuest(){
  const source=getQuestDefinition(devSelectedQuestId);if(!source)return;const copy=cloneQuest(source);copy.id=uniqueQuestId(`${source.id}_copy`);copy.title=`${source.title} Copy`;questDefinitions.push(normalizeQuestDefinition(copy,questDefinitions.length));devSelectedQuestId=copy.id;devQuestFormDraft=cloneQuest(copy);saveDeveloperDraft();refreshDeveloperQuestPanel();
}
function deleteDeveloperQuest(){
  const quest=getQuestDefinition(devSelectedQuestId);if(!quest)return;if(!confirm(`Delete quest '${quest.title}'?`))return;
  questDefinitions=questDefinitions.filter(q=>q.id!==quest.id);for(const other of questDefinitions){if(other.prerequisite===quest.id)other.prerequisite=null;if(other.nextQuest===quest.id)other.nextQuest=null;}for(const obj of sceneryProps){const ids=obj?.interaction?.actions?.questIds;if(Array.isArray(ids))obj.interaction.actions.questIds=ids.filter(id=>id!==quest.id);}delete ensureQuestState()[quest.id];devSelectedQuestId=questDefinitions[0]?.id||null;devQuestFormDraft=null;saveDeveloperDraft();refreshDeveloperQuestPanel();refreshQuestUI();
}
