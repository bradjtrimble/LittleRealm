const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const mobs=fs.readFileSync(path.join(root,'src','mobs.js'),'utf8');
const combat=fs.readFileSync(path.join(root,'src','combat.js'),'utf8');
const cfg=fs.readFileSync(path.join(root,'config','game-balance.js'),'utf8');
const world=fs.readFileSync(path.join(root,'src','world.js'),'utf8');
const checks=[
  ['mob level config',/mobLevels:\s*\{/.test(cfg) && /baseLevel:\s*8/.test(cfg)],
  ['stable spawn levels',/function mobSpawnLevel/.test(mobs) && /level:mobSpawnLevel/.test(mobs)],
  ['level-scaled stats',/function mobScaledStats\(template,level\)/.test(mobs) && /hpGrowthPerLevelPercent/.test(mobs)],
  ['4+ level danger stacks',/function mobDangerSteps/.test(mobs) && /dangerStartsAbovePlayerLevels/.test(mobs)],
  ['boss stat multipliers',/bossHpMultiplier/.test(mobs) && /bossAttackMultiplier/.test(mobs) && /bossArmorMultiplier/.test(mobs)],
  ['level-aware XP',/function mobXpReward/.test(mobs) && /No XP \(trivial level\)/.test(combat)],
  ['target level display',/Lv \$\{target\.level\}/.test(combat) && /mobLevelColor/.test(combat)],
  ['world level display',/fillText\(`Lv \$\{mob\.level\}`/.test(world)]
];
let failed=false;
for(const [name,ok] of checks){ console.log((ok?'PASS':'FAIL'),name); if(!ok) failed=true; }
if(failed) process.exit(1);
console.log('PASS mob level system test');
