const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(ROOT,'src','mobs.js'),'utf8');
const shared=JSON.parse(fs.readFileSync(path.join(ROOT,'content/shared/content-library.json'),'utf8'));
const checks=[
  ['stable facing helper',src.includes('function stableMobFacing')],
  ['direction hold timer',src.includes('facingCandidateTime>=0.14')],
  ['generic sprite layout metadata',src.includes('spriteLayout:mobAssetRecord')&&src.includes('const walkCycle=Array.isArray(spec.walkCycle)')],
  ['attack frame separated',src.includes('const attackColumn=')&&src.includes('attacking ? attackColumn')],
  ['idle mobs do not walk-cycle',src.includes('const moving=Math.hypot(mob.drawVx||0,mob.drawVy||0)>4')],
  ['wall stop resets wander',src.includes('mob.vx=0; mob.vy=0; mob.moveTimer=0')],
  ['all mob sprite assets declare layout',Object.values(shared.mobs||{}).every(m=>shared.assets?.[m.spriteAsset]?.spriteLayout)],
  ['visible-frame grounding helper',src.includes('spriteFrameMeta(sheet,row,col)')],
  ['mob feet anchored to ground',src.includes('groundY=Math.round(y+8-bob)')]
];
let bad=false;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)bad=true;}if(bad)process.exit(1);
console.log('PASS generic mob motion stability test');
