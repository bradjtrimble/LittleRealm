const fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,"..");
const questSrc=fs.readFileSync(path.join(root,"src","quests.js"),"utf8");
const saveSrc=fs.readFileSync(path.join(root,"src","save.js"),"utf8");
const inventorySrc=fs.readFileSync(path.join(root,"src","inventory.js"),"utf8");
const combatSrc=fs.readFileSync(path.join(root,"src","combat.js"),"utf8");
const worldSrc=fs.readFileSync(path.join(root,"src","world.js"),"utf8");
const uiSrc=fs.readFileSync(path.join(root,"src","ui.js"),"utf8");

function extractFunction(src,name){
  const start=src.indexOf(`function ${name}(`);
  if(start<0) throw new Error(`missing ${name}`);
  const open=src.indexOf("{",start);
  let depth=0,quote=null,escape=false;
  for(let i=open;i<src.length;i++){
    const c=src[i];
    if(quote){
      if(escape) escape=false;
      else if(c==="\\") escape=true;
      else if(c===quote) quote=null;
      continue;
    }
    if(c==='"'||c==="'"||c==="`"){quote=c;continue;}
    if(c==="{") depth++;
    else if(c==="}"&&--depth===0) return src.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

// Quest prerequisite arrays must survive normalization as arrays.
{
  const box={result:null};
  vm.createContext(box);
  vm.runInContext(`
    const START_X=100,START_Y=100;
    function numberOr(value,fallback){const n=Number(value);return Number.isFinite(n)?n:fallback;}
    ${extractFunction(questSrc,"cloneQuest")}
    function normalizeQuestObjective(raw){return raw||{};}
    ${extractFunction(questSrc,"normalizeQuestDefinition")}
    result=normalizeQuestDefinition({
      id:"combo",giverNpc:"a",turnInNpc:"b",
      prerequisite:[" first ","","second"],
      objectives:[{type:"talk",target:"b"}]
    });
  `,box);
  if(!Array.isArray(box.result.prerequisite)||box.result.prerequisite.join(",")!=="first,second"){
    throw new Error("quest prerequisite arrays are not preserved");
  }
  console.log("PASS quest prerequisite array normalization");
}

// Malformed-but-valid JSON save values should be sanitized before entering live state.
{
  const box={result:null};
  vm.createContext(box);
  vm.runInContext(`
    function numberOr(value,fallback){const n=Number(value);return Number.isFinite(n)?n:fallback;}
    function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
    function booleanOr(value,fallback){return typeof value==="boolean"?value:fallback;}
    function fresh(){return {x:10,y:20,level:1,xp:0,xpNext:25,hp:30,maxHp:30,atk:5,def:1,gold:8,potions:2,kills:0,slimeKills:0,questComplete:false,bossDefeated:false,quests:{},inventory:[]};}
    function canStand(x,y){return x===10&&y===20;}
    ${extractFunction(saveSrc,"loadedWholeNumber")}
    ${extractFunction(saveSrc,"normalizeLoadedState")}
    result=normalizeLoadedState({
      x:"bad",y:999,level:-4,xp:-9,xpNext:0,maxHp:-2,hp:999,
      atk:-8,def:-1,gold:-50,potions:-2,kills:-1,slimeKills:-3,
      questComplete:"false",bossDefeated:true,quests:[],inventory:"bad"
    });
  `,box);
  const s=box.result;
  if(s.x!==10||s.y!==20||s.level!==1||s.xp!==0||s.xpNext!==25||s.maxHp!==30||s.hp!==30||
     s.atk!==5||s.def!==1||s.gold!==8||s.potions!==2||s.kills!==0||s.slimeKills!==0||
     s.questComplete!==false||s.bossDefeated!==true||Array.isArray(s.quests)||!Array.isArray(s.inventory)){
    throw new Error("save-state sanitization regression");
  }
  console.log("PASS malformed save-state sanitization");
}

if(!inventorySrc.includes("state.inventory===normalizedInventoryRef")) throw new Error("inventory normalization cache missing");
console.log("PASS inventory normalization allocation guard");

if(combatSrc.includes("combatFx=combatFx.filter(")) throw new Error("combat FX still reallocates each frame");
if(!combatSrc.includes("signature===combatHudSignature")) throw new Error("combat HUD render guard missing");
console.log("PASS combat frame allocation/DOM guards");

if(!worldSrc.includes("worldRenderablePool")||!worldSrc.includes("queueWorldRenderable(")) throw new Error("world renderable pool missing");
console.log("PASS world renderable allocation pool");

if(!uiSrc.includes('constrainFloatingPanel("questLogPanel")')) throw new Error("quest panel resize constraint missing");
if(!saveSrc.includes("localStorage.setItem")||!saveSrc.includes("catch(_err)")) throw new Error("save storage failure guard missing");
console.log("PASS UI/storage edge-case guards");

console.log("\nPASS maintenance regression test");
