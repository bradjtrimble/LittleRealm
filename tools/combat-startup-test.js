const fs=require('fs');
const path=require('path');
const src=fs.readFileSync(path.resolve(__dirname,'../builder/game.js'),'utf8');
const checks=[
  ['state initialization guard',/function\s+refreshDeveloperCombatPanel\s*\(\)\s*\{[\s\S]*?if\s*\(\s*!state\s*\)/],
  ['safe pre-reset message',/Combat testing becomes available after the game finishes initializing/],
  ['developer open refresh',/if\s*\(devModeActive\)\s*\{[\s\S]*?refreshDeveloperPanel\(\)/]
];
let failed=false;
for(const [name,re] of checks){const ok=re.test(src);console.log((ok?'PASS ':'FAIL ')+name);if(!ok)failed=true;}
if(failed)process.exit(1);
console.log('PASS combat tuning startup safety test');
