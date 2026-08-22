const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const cfgSrc=fs.readFileSync(path.join(root,'config','game-balance.js'),'utf8');
const core=fs.readFileSync(path.join(root,'src','core.js'),'utf8');
const combat=fs.readFileSync(path.join(root,'src','combat.js'),'utf8');
const save=fs.readFileSync(path.join(root,'src','save.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'src','ui.js'),'utf8');
const mobs=fs.readFileSync(path.join(root,'src','mobs.js'),'utf8');
const quests=fs.readFileSync(path.join(root,'src','quests.js'),'utf8');
const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(cfgSrc,sandbox,{filename:'game-balance.js'});
const shared=JSON.parse(fs.readFileSync(path.join(root,'content','shared','content-library.json'),'utf8'));
const b=sandbox.window.LR_BALANCE||{};
const mobDefs=shared.mobs||{};
const p=b.progression||{};
const table=p.xpToNextLevel||[];
const fail=(msg)=>{throw new Error(msg)};
if(Number(p.levelCap)!==100) fail('level cap must be 100');
if(table.length!==99) fail('XP table must contain levels 1-99');
const expected={1:400,10:7600,30:47400,50:147500,59:209800,60:217400,90:506800,99:616400};
for(const [level,value] of Object.entries(expected)) if(Number(table[Number(level)-1])!==value) fail(`level ${level} XP should be ${value}`);
for(let i=1;i<table.length;i++) if(!(table[i]>table[i-1])) fail(`XP table not increasing at level ${i+1}`);
const total=table.reduce((a,n)=>a+Number(n),0);
if(total!==20118900) fail(`total XP to 100 mismatch: ${total}`);
const mobXp=(level)=>Number(p.sameLevelMobXpBase)+(level-1)*Number(p.sameLevelMobXpPerLevel);
if(mobXp(1)!==50||mobXp(59)!==340||mobXp(99)!==540) fail('same-level mob XP pace mismatch');
for(const key of ['slime','goblin','wolf']) if(Number(mobDefs[key]?.xpMultiplier)!==1) fail(`${key} should use standard hostile XP`);
for(const key of ['cow','pig','chicken']) if(!(Number(mobDefs[key]?.xpMultiplier)<1)) fail(`${key} should use reduced passive XP`);
const profile=b.quest?.xpProfiles?.elite;
const level37Mob=mobXp(37);
const level37Elite=Math.min(level37Mob*Number(profile.mobEquivalent),Math.floor(table[36]*(Number(profile.levelCapPercent)/100)));
if(level37Elite!==4140) fail(`level 37 elite quest should award 4140 XP, got ${level37Elite}`);
const minor=b.quest?.xpProfiles?.minor;
const level1Minor=Math.min(mobXp(1)*Number(minor.mobEquivalent),Math.floor(table[0]*(Number(minor.levelCapPercent)/100)));
if(level1Minor!==20) fail(`level 1 minor cap should produce 20 XP, got ${level1Minor}`);
for(const [name,src,pattern] of [
  ['progression helpers',core,/function xpRequiredForLevel[\s\S]*function standardMobXpForLevel/],
  ['level cap check',combat,/playerLevelCap\(\)[\s\S]*xpRequiredForLevel/],
  ['save progression normalization',save,/xpNext=xpRequiredForLevel\(next\.level\)/],
  ['max-level UI',ui,/MAX LEVEL/],
  ['level-based mob XP',mobs,/standardMobXpForLevel\(mobLevel\).*xpMultiplier/s],
  ['quest auto XP',quests,/function questAutoXpForLevel[\s\S]*levelCapPercent/],
  ['quest level gate',quests,/function questLevelRequirementMet[\s\S]*getQuestStatus/]
]) if(!pattern.test(src)) fail(`missing ${name}`);
console.log(`PASS 1-100 progression (20,118,900 total XP; Lv99→100 ${table[98]} XP)`);
