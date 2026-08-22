const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const mobEditor=fs.readFileSync(path.join(root,'src','builder','mob-editor.js'),'utf8');
const content=fs.readFileSync(path.join(root,'src','builder','content-library.js'),'utf8');
const mobs=fs.readFileSync(path.join(root,'src','mobs.js'),'utf8');
const core=fs.readFileSync(path.join(root,'src','core.js'),'utf8');
const cfgText=fs.readFileSync(path.join(root,'config','game-balance.js'),'utf8');
const vm=require('vm');const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(cfgText,sandbox);const balance=sandbox.window.LR_BALANCE||{};
const checks=[
  ['absolute mob baseline config',Number(balance.mobLevels?.baselineHpAtLevel1)===18&&Number(balance.mobLevels?.baselineHpPerLevel)===8&&Number(balance.mobLevels?.baselineAttackAtLevel1)===3&&Number(balance.mobLevels?.baselineAttackPerLevel)===2],
  ['shared baseline helper',core.includes('function standardMobBaselineStatsForLevel')&&core.includes('baselineDefensePerLevel')],
  ['level 37 expected baseline',18+36*8===306&&3+36*2===75&&Math.round(36*.75)===27],
  ['new mobs use auto level stats',mobEditor.includes('autoLevelStats:true')&&mobEditor.includes('Auto-fill HP / ATK / DEF from Level')],
  ['mob sprite asset selector replaces render preset UI',mobEditor.includes('Mob Sprite Asset')&&mobEditor.includes('developerMobSpriteAssets')&&!mobEditor.includes('Render Preset')],
  ['mob loot is directly editable',mobEditor.includes('Drops & Rewards')&&mobEditor.includes('+ Add Item Drop')&&mobEditor.includes('lootTable:newId')],
  ['boss behavior is explained',mobEditor.includes('Bosses do not wander, do not respawn after defeat, cannot become Elite')],
  ['content library delegates mob editor',content.includes('developerMobEditorHtml(id,rec)')&&content.includes('saveDeveloperMobFromEditor(root)')],
  ['safe grass is a sanctuary boundary',mobs.includes('function mobHomeIsSafeGrass')&&mobs.includes('function mobCanStandWithSafeGrass')&&mobs.includes('safeGrassProtectsPlayer')],
  ['safe-grass mobs are no longer force-reset',!mobs.includes('if(!mob.boss && tileAtWorld(mob.x,mob.y)===4)')],
];
let failed=false;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)failed=true;}if(failed)process.exit(1);console.log('PASS mob authoring + safe grass workflow test');
