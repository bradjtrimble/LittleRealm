const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const world=fs.readFileSync(path.join(root,'src/world.js'),'utf8');
const quests=fs.readFileSync(path.join(root,'src/quests.js'),'utf8');
const bundle=fs.readFileSync(path.join(root,'js/game.js'),'utf8');
for(const required of [
  'function npcFacingForRender(npc)',
  'activeNpcDialogId===npc.id',
  'vectorFacing(state.x-npc.x,state.y-npc.y,npc.facing||"down")',
  'facingRows[npcFacingForRender(obj)]',
  'heroFacing=vectorFacing(npc.x-state.x,npc.y-state.y,heroFacing)'
]) if(!(world+quests+bundle).includes(required)) throw new Error('missing NPC conversation facing behavior: '+required);
if(/openNpcDialogue[\s\S]{0,400}npc\.facing\s*=/.test(quests)) throw new Error('dialogue still overwrites authored NPC facing');
console.log('PASS NPC conversation facing (temporary NPC override + player face-to-face)');
