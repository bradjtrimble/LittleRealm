const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const bundle=fs.readFileSync(path.join(root,'js/game.js'),'utf8');
const npcSrc=fs.readFileSync(path.join(root,'config/npcs.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
for(const required of [
  'NPC_PLACEHOLDER_SPRITE','npcVisualBounds','npcDepthMode','npcRenderDepth',
  'refreshDeveloperSelectionList','devSelectionList','Edit NPC Hitbox Visually',
  'Edit NPC Depth Line Visually','devNpcSelectionHeight','Placeholder model',
  'developerSelectedEntity','developerEntityBounds'
]) if(!bundle.includes(required)) throw new Error('missing NPC selection feature: '+required);
if(!sw.includes('assets/npcs/npc-placeholder.png')) throw new Error('placeholder sprite missing from offline cache');
if(!fs.existsSync(path.join(root,'assets/npcs/npc-placeholder.png'))) throw new Error('placeholder sprite asset missing');
const box={window:{}};vm.createContext(box);vm.runInContext(npcSrc,box);
const npcs=box.window.LR_NPCS;
if(!Array.isArray(npcs)||!npcs.length) throw new Error('NPC config missing');
for(const npc of npcs){
  if(!npc.sprite) throw new Error(`NPC ${npc.id} has no sprite path`);
  if(!npc.hitbox||!['x','y','w','h'].every(k=>Number.isFinite(Number(npc.hitbox[k])))) throw new Error(`NPC ${npc.id} missing editable hitbox`);
  if(!['ysort','behind','front','ground'].includes(npc.depthMode)) throw new Error(`NPC ${npc.id} missing depth mode`);
  if(!Number.isFinite(Number(npc.depthY))) throw new Error(`NPC ${npc.id} missing depthY`);
}
const placeholders=npcs.filter(n=>n.sprite.includes('npc-placeholder.png'));
if(placeholders.length<1) throw new Error('expected at least one NPC using the new placeholder model');
console.log(`PASS NPC selection + placeholder compatibility (${placeholders.length} placeholder NPCs)`);
