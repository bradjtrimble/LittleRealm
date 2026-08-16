const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
class ClassList{constructor(){this.s=new Set()}add(...v){v.forEach(x=>this.s.add(x))}remove(...v){v.forEach(x=>this.s.delete(x))}contains(v){return this.s.has(v)}toggle(v){if(this.s.has(v)){this.s.delete(v);return false}this.s.add(v);return true}}
class El{constructor(id){this.id=id;this.classList=new ClassList();this.style={};this.dataset={};this.textContent='';this.innerHTML='';this.disabled=false;this.offsetWidth=1;this.onclick=null;}getContext(){return {setTransform(){},beginPath(){},roundRect(){},fill(){},drawImage(){},fillRect(){},stroke(){},moveTo(){},lineTo(){},arc(){},ellipse(){},save(){},restore(){},clip(){},translate(){},scale(){},clearRect(){},fillText(){},strokeRect(){},globalAlpha:1,imageSmoothingEnabled:false};}addEventListener(){}getBoundingClientRect(){return {left:0,top:0,width:1280,height:800}}setPointerCapture(){}appendChild(){}remove(){}}
const els=new Map();const get=id=>{if(!els.has(id))els.set(id,new El(id));return els.get(id)};
global.window=global;global.innerWidth=1280;global.innerHeight=800;global.devicePixelRatio=1;global.addEventListener=()=>{};
global.document={getElementById:get,addEventListener:()=>{},hidden:false,fullscreenElement:null,documentElement:new El('html'),createElement:tag=>new El(tag),exitFullscreen:async()=>{}};
global.navigator={};global.Image=class{constructor(){this.complete=false;this.naturalWidth=0;this.onload=null;}set src(v){this._src=v;}get src(){return this._src;}};
global.localStorage={getItem(){return null},setItem(){}};global.confirm=()=>false;global.requestAnimationFrame=()=>{};global.performance={now:()=>0};global.setTimeout=()=>0;global.clearTimeout=()=>{};

eval(fs.readFileSync(path.join(ROOT,'config','game-balance.js'),'utf8'));
global.LR_ITEMS={
  slimeGel:{name:'Slime Gel',category:'Material',rarity:'Common',stackLimit:50},
  slimeCore:{name:'Slime Core',category:'Material',rarity:'Rare',stackLimit:10},
  eliteShard:{name:'Elite Shard',category:'Material',rarity:'Rare',stackLimit:10}
};
global.LR_LOOT_TABLES={
  slime:[
    {itemId:'slimeGel',chancePercent:100,minQty:2,maxQty:2},
    {itemId:'slimeCore',chancePercent:50,minQty:1,maxQty:1},
    {itemId:'eliteShard',chancePercent:100,minQty:1,maxQty:1,requiresElite:true}
  ]
};

try{
  eval(fs.readFileSync(path.join(ROOT,'js','game.js'),'utf8'));
  if(!global.LR_LOOT) throw new Error('LR_LOOT API missing');
  const errors=global.LR_LOOT.validate();
  if(errors.length) throw new Error('valid loot config rejected: '+errors.join('; '));

  const normal=global.LR_LOOT.rollTable('slime',{level:2,elite:false,boss:false},()=>0);
  const normalMap=Object.fromEntries(normal.map(x=>[x.itemId,x.qty]));
  if(normalMap.slimeGel!==2||normalMap.slimeCore!==1||normalMap.eliteShard) throw new Error('normal loot roll mismatch');

  const elite=global.LR_LOOT.rollTable('slime',{level:2,elite:true,boss:false},()=>0);
  const eliteMap=Object.fromEntries(elite.map(x=>[x.itemId,x.qty]));
  if(eliteMap.eliteShard!==1) throw new Error('elite-only loot condition failed');

  const grant=global.LR_LOOT.grantMobLoot({level:2,elite:false,boss:false,template:{configKey:'slime',lootTable:'slime'}},()=>0);
  if(grant.added.length!==2||grant.overflow.length!==0) throw new Error('mob loot grant failed');
  if(global.LR_INVENTORY.getItemCount('slimeGel')!==2||global.LR_INVENTORY.getItemCount('slimeCore')!==1) throw new Error('loot did not reach inventory');

  const beforeRollOnly=global.LR_INVENTORY.getItemCount('slimeGel');
  const rolledOnly=global.LR_LOOT.rollMobLoot({level:2,elite:false,boss:false,template:{configKey:'slime',lootTable:'slime'}},()=>0);
  if(rolledOnly.rolled.length!==2) throw new Error('rollMobLoot did not return rolled drops');
  if(global.LR_INVENTORY.getItemCount('slimeGel')!==beforeRollOnly) throw new Error('rollMobLoot should not auto-grant items');

  global.LR_LOOT.openWindow([{itemId:'slimeGel',qty:3}],'Test Slime');
  if(!get('lootWindow').classList.contains('show')) throw new Error('loot window did not open');
  if(global.LR_LOOT.getPending()[0]?.qty!==3) throw new Error('loot window pending stack mismatch');
  const targeted=global.LR_LOOT.takeAt(0,7);
  if(targeted.added!==3||global.LR_INVENTORY.getSlots()[7]?.id!=='slimeGel') throw new Error('drag-target loot placement failed');
  if(get('lootWindow').classList.contains('show')) throw new Error('loot window should close when all loot is collected');

  const combatSrc=fs.readFileSync(path.join(ROOT,'src','combat.js'),'utf8');
  if(!combatSrc.includes('const lootReward=rollMobLoot(mob);')) throw new Error('open-world mob death is not hooked to loot rolling');
  if(!combatSrc.includes('openLootWindow(lootReward.rolled,mobDisplayName(mob))')) throw new Error('open-world mob death does not present rolled loot');
  if(!combatSrc.includes('const lootReward=rollMobLoot(currentMob||e);')) throw new Error('battle victory is not hooked to loot rolling');
  if(!combatSrc.includes('openLootWindow(lootReward.rolled')) throw new Error('battle victory does not present rolled loot');
  console.log('PASS loot foundation test');
}catch(e){console.error('FAIL loot foundation test\n'+(e.stack||e));process.exit(1)}
