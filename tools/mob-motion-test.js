const fs=require("fs");
const path=require("path");
const ROOT=path.resolve(__dirname,"..");
const src=fs.readFileSync(path.join(ROOT,"src","mobs.js"),"utf8");
const checks=[
  ["stable facing helper",src.includes("function stableMobFacing")],
  ["direction hold timer",src.includes("facingCandidateTime>=0.14")],
  ["attack frame separated",src.includes("const walkCycle=[0,1,2,1]") && src.includes("attacking ? 3")],
  ["idle mobs do not walk-cycle",src.includes("const moving=Math.hypot(mob.drawVx||0,mob.drawVy||0)>4")],
  ["wall bounce removed",src.includes("mob.vx=0; mob.vy=0; mob.moveTimer=0")],
];
let bad=false;
for(const [name,ok] of checks){console.log((ok?"PASS":"FAIL"),name);if(!ok)bad=true;}
if(bad)process.exit(1);
console.log("PASS mob motion stability test");
if(!src.includes('spriteFrameMeta(sheet,row,col)')) fail('visible-frame grounding helper missing');
if(!src.includes('groundY=Math.round(y+8-bob)')) fail('mob feet are not anchored to ground');
console.log('PASS visible-frame mob grounding');

