const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const dev=fs.readFileSync(path.join(root,'src','devmode.js'),'utf8');
const mobs=fs.readFileSync(path.join(root,'src','mobs.js'),'utf8');
const checks=[
 ['combat test tab',/data-dev-tab="combat"/.test(dev)&&/data-dev-view="combat"/.test(dev)&&/Combat Test/.test(dev)],
 ['player test level',/function applyDeveloperPlayerLevel/.test(dev)&&/Player Test Level/.test(dev)&&/\[1,5,10,25,50,100\]/.test(dev)],
 ['player test restore',/function restoreDeveloperPlayerBaseline/.test(dev)&&/Restore Before Testing/.test(dev)],
 ['species live tuning',/function applyDeveloperSpeciesBalance/.test(dev)&&/Base level/.test(dev)&&/Elite chance/.test(dev)],
 ['global level tuning',/function applyDeveloperGlobalCombatBalance/.test(dev)&&/High-Level Danger Boost/.test(dev)&&/Hit \/ Miss/.test(dev)],
 ['boss elite tuning',/Elite Multipliers/.test(dev)&&/Boss Multipliers/.test(dev)],
 ['xp tuning',/XP Rules/.test(dev)&&/infinite-grind rule remains intact/.test(dev)],
 ['balance export',/function exportDeveloperBalance/.test(dev)&&/game-balance\.js/.test(dev)],
 ['reroll controls',/Reroll All Mob Levels \+ Elites/.test(dev)&&/function rerollMobLevelsAndElites/.test(mobs)],
 ['template refresh',/function refreshMobTemplatesFromBalance/.test(mobs)&&/configKey/.test(mobs)],
 ['live stat preview',/function developerMobPreview/.test(dev)&&/Your hit/.test(dev)&&/Mob hit/.test(dev)]
];
let fail=false;for(const [n,ok] of checks){console.log(ok?'PASS':'FAIL',n);if(!ok)fail=true;}if(fail)process.exit(1);console.log('PASS combat tuning lab test');
