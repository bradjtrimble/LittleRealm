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
    function playerLevelCap(){return 100;}
    function questDefaultMinLevel(level){return Math.max(1,Number(level)-3);}
    function questRecommendedMaxLevel(quest){return Math.min(100,Number(quest.level)+3);}
    function inferQuestRewardTier(){return "standard";}
    function normalizeQuestRewardTier(value,fallback="standard"){return value||fallback;}
    function questAutoXpForLevel(){return 0;}
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

// Malformed-but-valid current-format save values should be sanitized before entering live state.
{
  const box={result:null};
  vm.createContext(box);
  vm.runInContext(`
    function numberOr(value,fallback){const n=Number(value);return Number.isFinite(n)?n:fallback;}
    function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
    function booleanOr(value,fallback){return typeof value==="boolean"?value:fallback;}
    function currentWorldZoneId(){return "test-zone";}
    function fresh(){return {zoneId:"test-zone",x:10,y:20,level:1,xp:0,xpNext:400,hp:30,maxHp:30,atk:5,def:1,gold:8,potions:2,kills:0,quests:{},inventory:[],worldObjectStates:{},character:{name:"Adventurer",mode:"full",appearanceAsset:"player"}};}
    function normalizeCharacterProfile(value){return value&&typeof value==="object"?value:fresh().character;}
    function playerLevelCap(){return 100;}
    function xpRequiredForLevel(level){return level>=100?0:400;}
    function canStand(x,y){return x===10&&y===20;}
    ${extractFunction(saveSrc,"loadedWholeNumber")}
    ${extractFunction(saveSrc,"normalizeLoadedState")}
    result=normalizeLoadedState({
      zoneId:"",x:"bad",y:999,level:-4,xp:-9,xpNext:0,maxHp:-2,hp:999,
      atk:-8,def:-1,gold:-50,potions:-2,kills:-1,quests:[],inventory:"bad",worldObjectStates:[]
    });
  `,box);
  const s=box.result;
  if(s.zoneId!=="test-zone"||s.x!==10||s.y!==20||s.level!==1||s.xp!==0||s.xpNext!==400||s.maxHp!==30||s.hp!==30||
     s.atk!==5||s.def!==1||s.gold!==8||s.potions!==2||s.kills!==0||Array.isArray(s.quests)||!Array.isArray(s.inventory)||Array.isArray(s.worldObjectStates)){
    throw new Error("save-state sanitization regression");
  }
  for(const removed of ["slimeKills","questComplete","bossDefeated"]) if(Object.prototype.hasOwnProperty.call(s,removed)) throw new Error(`legacy save field returned: ${removed}`);
  console.log("PASS current save-state sanitization");
}

if(!saveSrc.includes('PLAYER_SAVE_FORMAT="little-realm-save"')||!saveSrc.includes('PLAYER_SAVE_SCHEMA_VERSION=2')||!saveSrc.includes('PLAYER_SAVE_KEY="littleRealmSave"')) throw new Error("clean v2 save format missing");
if(saveSrc.includes("littleRealmMobileSaveV3")||saveSrc.includes("slimeKills")||saveSrc.includes("bossDefeated")) throw new Error("legacy save compatibility is still active");
console.log("PASS clean save-format baseline");

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
