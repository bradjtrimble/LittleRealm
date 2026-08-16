const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const bundle=fs.readFileSync(path.join(root,'js/game.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'js/runtime-loader.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const npcSrc=fs.readFileSync(path.join(root,'config/npcs.js'),'utf8');
const questSrc=fs.readFileSync(path.join(root,'config/quests.js'),'utf8');

for(const required of [
  'normalizeQuestDefinition','acceptQuest','completeQuest','notifyQuestKill','notifyQuestTalk','updateQuestVisits',
  'openNpcDialogue','getNpcQuestMarker','refreshDeveloperQuestPanel','renderDeveloperQuestEditor',
  'exportDeveloperWorldPack','little-realm-world-pack.json','data-dev-view="quests"','data-dev-view="npcs"','data-dev-view="project"'
]) if(!bundle.includes(required)) throw new Error('missing quest/NPC feature: '+required);
for(const required of ['config/npcs.js','config/quests.js']) if(!loader.includes(required)) throw new Error('runtime loader missing '+required);
for(const required of ['npcDialog','questLog','closeNpcDialog','questLogBody']) if(!html.includes(required)) throw new Error('HTML missing '+required);
for(const asset of ['assets/npcs/lilly.png','assets/npcs/jorge.png','assets/npcs/npc-placeholder.png']) if(!fs.existsSync(path.join(root,asset))) throw new Error('missing NPC asset '+asset);

const sandbox={window:{}};vm.createContext(sandbox);
vm.runInContext(npcSrc,sandbox,{filename:'config/npcs.js'});
vm.runInContext(questSrc,sandbox,{filename:'config/quests.js'});
const npcs=sandbox.window.LR_NPCS,quests=sandbox.window.LR_QUESTS;
if(!Array.isArray(npcs)||npcs.length<2) throw new Error('LR_NPCS must contain NPCs');
if(!Array.isArray(quests)||quests.length<2) throw new Error('LR_QUESTS must contain starter quests');
const ids=new Set(npcs.map(n=>n.id));
for(const id of ['lilly','jorge']) if(!ids.has(id)) throw new Error('missing NPC '+id);
const qids=new Set();
for(const q of quests){
  if(!q.id||qids.has(q.id)) throw new Error('invalid/duplicate quest id');qids.add(q.id);
  if(!ids.has(q.giverNpc)||!ids.has(q.turnInNpc)) throw new Error(`quest ${q.id} references missing NPC`);
  if(!Array.isArray(q.objectives)||!q.objectives.length) throw new Error(`quest ${q.id} has no objectives`);
  for(const o of q.objectives) if(!['kill','collect','talk','deliver','visit'].includes(o.type)) throw new Error(`quest ${q.id} has bad objective type`);
}
const lilly=quests.find(q=>q.id==='lilly_slime_samples');
const jorge=quests.find(q=>q.id==='jorge_slime_problem');
if(lilly?.objectives?.[0]?.type!=='collect'||lilly.objectives[0].target!=='slimeGel'||Number(lilly.objectives[0].amount)<1) throw new Error('Lilly slime-sample quest incorrect');
if(jorge?.objectives?.[0]?.type!=='kill'||jorge.objectives[0].target!=='slime'||jorge.objectives[0].amount!==5||jorge.prerequisite!==lilly.id) throw new Error('Jorge starter quest chain incorrect');
console.log(`PASS quest builder + NPC content (${npcs.length} NPCs, ${quests.length} quests)`);
