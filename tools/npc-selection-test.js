const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const bundle=fs.readFileSync(path.join(root,'js/game.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'builder/game.js'),'utf8');
const pack=JSON.parse(fs.readFileSync(path.join(root,'content/zones/starter-realm/world-pack.json'),'utf8'));
const shared=JSON.parse(fs.readFileSync(path.join(root,'content/shared/content-library.json'),'utf8'));
const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
for(const required of [
  'npcVisualBounds','npcDepthMode','npcRenderDepth','refreshDeveloperSelectionList',
  'devSelectionList','Edit NPC Hitbox Visually','Edit NPC Depth Line Visually','devNpcSelectionHeight',
  'NPC Sprite Asset','developerNpcSpriteAssets','developerApplyNpcSpriteAsset','devNpcAssetPalette',
  'Place NPC With This Sprite','developerSelectedEntity','developerEntityBounds'
]) if(!bundle.includes(required)) throw new Error('missing normalized NPC asset feature: '+required);
if(bundle.includes('NPC Templates')||bundle.includes('devNpcTemplates')||bundle.includes('LR_NPC_TEMPLATES')) throw new Error('legacy NPC Template workflow is still active');
if(Object.prototype.hasOwnProperty.call(shared,'npcTemplates')) throw new Error('shared Content Library still stores legacy NPC Templates');
if(!sw.includes('cache.put(event.request')) throw new Error('service worker runtime asset cache missing');
const npcs=pack.npcs;
if(!Array.isArray(npcs)||!npcs.length) throw new Error('zone NPC data missing');
for(const npc of npcs){
  if(!npc.spriteAsset) throw new Error(`NPC ${npc.id} has no NPC Sprite asset`);
  const asset=shared.assets?.[npc.spriteAsset];
  if(!asset||asset.type!=='npcSprite') throw new Error(`NPC ${npc.id} references invalid NPC Sprite asset ${npc.spriteAsset}`);
  if(!npc.hitbox||!['x','y','w','h'].every(k=>Number.isFinite(Number(npc.hitbox[k])))) throw new Error(`NPC ${npc.id} missing editable hitbox`);
  if(!['ysort','behind','front','ground'].includes(npc.depthMode)) throw new Error(`NPC ${npc.id} missing depth mode`);
  if(!Number.isFinite(Number(npc.depthY))) throw new Error(`NPC ${npc.id} missing depthY`);
}
console.log(`PASS normalized NPC asset workflow (${npcs.length} placed NPCs use direct sprite assets)`);
