const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const bundle=fs.readFileSync(path.join(root,'js/game.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'builder/game.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'js/runtime-loader.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const shared=JSON.parse(fs.readFileSync(path.join(root,'content/shared/content-library.json'),'utf8'));
const pack=JSON.parse(fs.readFileSync(path.join(root,'content/zones/starter-realm/world-pack.json'),'utf8'));

for(const required of [
  'normalizeQuestDefinition','acceptQuest','completeQuest','notifyQuestKill','notifyQuestTalk','updateQuestVisits',
  'openNpcDialogue','getNpcQuestMarker','getNpcQuestMarkerInfo','questIsTracked','setQuestTracked','trackedQuests',
  'refreshDeveloperQuestPanel','renderDeveloperQuestEditor','exportDeveloperWorldPack','little-realm-world-pack.json',
  'data-dev-view="quests"','data-dev-view="npcs"','data-dev-view="project"','devQuestLevel',
  'devQuestLevelRequirementMode','devQuestXpMode','devQuestRewardTier','questAutoXpForLevel','questLevelRequirementMet'
]) if(!bundle.includes(required)) throw new Error('missing quest/NPC feature: '+required);
if(!loader.includes('content/little-realm.project.json')) throw new Error('runtime loader is not project-driven');
for(const required of ['npcDialog','questLog','closeNpcDialog','questLogBody']) if(!html.includes(required)) throw new Error('HTML missing '+required);
for(const asset of ['assets/npcs/lilly.png','assets/npcs/jorge.png','assets/npcs/npc-placeholder.png']) if(!fs.existsSync(path.join(root,asset))) throw new Error('missing NPC asset '+asset);

const npcs=pack.npcs,quests=pack.quests;
if(!Array.isArray(npcs)||npcs.length<2) throw new Error('zone must contain NPCs');
if(!Array.isArray(quests)||quests.length<2) throw new Error('zone must contain quests');
const npcIds=new Set(npcs.map(n=>n.id));
for(const id of ['lilly','jorge','mayor_buck']) if(!npcIds.has(id)) throw new Error('missing NPC '+id);
const mobIds=new Set(Object.keys(shared.mobs||{}));
const itemIds=new Set(Object.keys(shared.items||{}));
const qids=new Set();
for(const q of quests){
  if(!q.id||qids.has(q.id)) throw new Error('invalid/duplicate quest id'); qids.add(q.id);
  if(!npcIds.has(q.giverNpc)||!npcIds.has(q.turnInNpc)) throw new Error(`quest ${q.id} references missing NPC`);
  if(!Array.isArray(q.objectives)||!q.objectives.length) throw new Error(`quest ${q.id} has no objectives`);
  for(const o of q.objectives){
    if(!['kill','collect','talk','deliver','visit','interact'].includes(o.type)) throw new Error(`quest ${q.id} has bad objective type`);
    if(o.type==='kill'&&!mobIds.has(o.target)) throw new Error(`quest ${q.id} references missing mob ${o.target}`);
    if(['collect','deliver'].includes(o.type)&&!itemIds.has(o.target)) throw new Error(`quest ${q.id} references missing item ${o.target}`);
    if(o.type==='talk'&&!npcIds.has(o.target)) throw new Error(`quest ${q.id} references missing talk NPC ${o.target}`);
  }
  if(!Number.isFinite(Number(q.level))||Number(q.level)<1||Number(q.level)>100) throw new Error(`quest ${q.id} has invalid quest level`);
  if(!['auto','custom'].includes(q.levelRequirementMode)) throw new Error(`quest ${q.id} has invalid level requirement mode`);
  if(q.rewards?.xpMode!=='auto') throw new Error(`starter quest ${q.id} should use automatic XP`);
  if(!q.rewardTier) throw new Error(`quest ${q.id} missing reward tier`);
}
const lilly=quests.find(q=>q.id==='lilly_slime_samples');
const jorge=quests.find(q=>q.id==='jorge_slime_problem');
const welcome=quests.find(q=>q.id==='welcome_traveler');
if(lilly?.objectives?.[0]?.type!=='collect'||lilly.objectives[0].target!=='slimeGel'||Number(lilly.objectives[0].amount)<1) throw new Error('Lilly collection quest incorrect');
if(jorge?.objectives?.[0]?.type!=='kill'||jorge.objectives[0].target!=='slime'||jorge.objectives[0].amount!==20||jorge.prerequisite!=='welcome_traveler') throw new Error('Jorge quest prerequisite/content incorrect');
if(!welcome||welcome.giverNpc!=='mayor_buck'||welcome.turnInNpc!=='mayor_buck'||welcome.objectives.length!==7||welcome.objectives.some(o=>o.type!=='talk')) throw new Error('Welcome Traveler quest incorrect');
if(lilly.prerequisite!=='welcome_traveler') throw new Error('Lilly quest prerequisite should be Welcome Traveler');
if(quests.find(q=>q.id==='farmer_wolf_hunt')?.minLevel!==3) throw new Error('Wolf Hunt should require level 3');
if(welcome.rewards.xp!==60||lilly.rewards.xp!==72||jorge.rewards.xp!==108) throw new Error('starter auto-XP rewards changed unexpectedly');
console.log(`PASS quest builder + zone NPC content (${npcs.length} NPCs, ${quests.length} quests)`);
