const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const mobs=fs.readFileSync(path.join(root,'src','mobs.js'),'utf8');
const combat=fs.readFileSync(path.join(root,'src','combat.js'),'utf8');
const cfg=fs.readFileSync(path.join(root,'config','game-balance.js'),'utf8');
const vm=require('vm');
const sandbox={window:{}}; vm.createContext(sandbox); vm.runInContext(cfg,sandbox); const balance=sandbox.window.LR_BALANCE||{};
const world=fs.readFileSync(path.join(root,'src','world.js'),'utf8');
const checks=[
  ['mob level config',!!balance.mobLevels && Number(balance.mobs?.snickers?.baseLevel)===8],
  ['stable spawn levels',/function mobSpawnLevel/.test(mobs) && /level:mobSpawnLevel/.test(mobs)],
  ['level-scaled stats',/function mobScaledStats\(template,level,elite=false\)/.test(mobs) && /hpGrowthPerLevelPercent/.test(mobs)],
  ['4+ level danger stacks',/function mobDangerSteps/.test(mobs) && /dangerStartsAbovePlayerLevels/.test(mobs)],
  ['boss stat multipliers',/bossHpMultiplier/.test(mobs) && /bossAttackMultiplier/.test(mobs) && /bossArmorMultiplier/.test(mobs)],
  ['infinite-grind XP floor',/function mobXpReward/.test(mobs) && /trivialXpStartsAboveMobLevels/.test(cfg) && /return Math\.max\(1,Math\.floor\(mob\.level\)\)/.test(mobs)],
  ['goblins above wolves',Number(balance.mobs?.goblin?.baseLevel)===5 && Number(balance.mobs?.goblin?.levelMin)===4 && Number(balance.mobs?.goblin?.levelMax)===6 && Number(balance.mobs?.wolf?.baseLevel)===4 && Number(balance.mobs?.wolf?.levelMin)===3 && Number(balance.mobs?.wolf?.levelMax)===5],
  ['level-based aggro',/function mobAggroRanges/.test(mobs) && /aggroRangePerLevelDifference/.test(cfg)],
  ['elite rank system',/function rollMobElite/.test(mobs) && /eliteHpMultiplier/.test(cfg) && /Elite/.test(world)],
  ['level hit miss',/function playerHitChanceAgainst/.test(combat) && /function mobHitChanceAgainstPlayer/.test(combat) && /\"MISS\"/.test(combat)],
  ['target level display',/Lv \$\{target\.level\}/.test(combat) && /mobLevelColor/.test(combat)],
  ['world level display',/fillText\(`Lv \$\{mob\.level\}/.test(world)]
];
let failed=false;
for(const [name,ok] of checks){ console.log((ok?'PASS':'FAIL'),name); if(!ok) failed=true; }
if(failed) process.exit(1);
console.log('PASS mob level system test');
