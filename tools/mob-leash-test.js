const fs=require("fs");
const path=require("path");
const ROOT=path.resolve(__dirname,"..");
const mobs=fs.readFileSync(path.join(ROOT,"src","mobs.js"),"utf8");
const combat=fs.readFileSync(path.join(ROOT,"src","combat.js"),"utf8");
const balance=fs.readFileSync(path.join(ROOT,"config","game-balance.js"),"utf8");

const checks=[
  ["combat leash is balance-driven",balance.includes('"mobLeashDistance": 260') && mobs.includes("combatLeashDistance:numberOr")],
  ["spawn state tracks return-home evade",mobs.includes("returningHome:false") && mobs.includes("leashStuckTime:0")],
  ["losing aggro fully heals mob",/function startMobLeashReturn\(mob\)[\s\S]*mob\.hp=mob\.maxHp/.test(mobs)],
  ["disengage starts leash return",/function disengageCombat\(showToast=true\)[\s\S]*startMobLeashReturn\(disengagedMob\)/.test(combat)],
  ["player-distance escape still disengages",/if\(d>DISENGAGE_RANGE\)[\s\S]*disengageCombat\(false\)/.test(combat)],
  ["spawn-distance leash breaks combat",/homeDist>mob\.template\.combatLeashDistance[\s\S]*disengageCombat\(false\)/.test(mobs)],
  ["returning mob runs toward spawn",mobs.includes("mob.homeX-mob.x") && mobs.includes("mob.homeY-mob.y") && mobs.includes("const returnSpeed=Math.max(mob.template.leashSpeed,mob.template.chaseSpeed)")],
  ["return arrival snaps cleanly home",/function finishMobLeashReturn\(mob\)[\s\S]*mob\.x=mob\.homeX; mob\.y=mob\.homeY/.test(mobs)],
  ["returning mobs cannot be selected",combat.includes("!mob||!mob.alive||mob.returningHome") && combat.includes("if(!mob.alive || mob.returningHome) continue")],
  ["returning mobs cannot auto-aggro",mobs.includes("if(!mob.returningHome && !combatTarget && mob.template.aggressive")],
  ["return path has stuck fail-safe",mobs.includes("mob.leashStuckTime>=1.5")],
];
let failed=false;
for(const [name,ok] of checks){
  console.log(ok?"PASS":"FAIL",name);
  if(!ok) failed=true;
}
if(failed) process.exit(1);
console.log("PASS mob leash + health reset test");
