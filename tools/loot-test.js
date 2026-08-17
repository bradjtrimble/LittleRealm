const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
class ClassList{constructor(){this.s=new Set()}add(...v){v.forEach(x=>this.s.add(x))}remove(...v){v.forEach(x=>this.s.delete(x))}contains(v){return this.s.has(v)}toggle(v){if(this.s.has(v)){this.s.delete(v);return false}this.s.add(v);return true}}
class El{constructor(id){this.id=id;this.classList=new ClassList();this.style={};this.dataset={};this.textContent='';this.innerHTML='';this.disabled=false;this.offsetWidth=1;this.onclick=null;}getContext(){return {setTransform(){},beginPath(){},roundRect(){},fill(){},drawImage(){},fillRect(){},stroke(){},moveTo(){},lineTo(){},arc(){},ellipse(){},save(){},restore(){},clip(){},translate(){},scale(){},clearRect(){},fillText(){},strokeRect(){},globalAlpha:1,imageSmoothingEnabled:false};}addEventListener(){}getBoundingClientRect(){return {left:0,top:0,width:1280,height:800}}setPointerCapture(){}appendChild(){}remove(){}closest(){return null}}
const els=new Map();const get=id=>{if(!els.has(id))els.set(id,new El(id));return els.get(id)};
global.window=global;global.innerWidth=1280;global.innerHeight=800;global.devicePixelRatio=1;global.addEventListener=()=>{};
global.document={getElementById:get,addEventListener:()=>{},hidden:false,fullscreenElement:null,documentElement:new El('html'),createElement:tag=>new El(tag),exitFullscreen:async()=>{},elementFromPoint:()=>null};
global.navigator={};global.Image=class{constructor(){this.complete=false;this.naturalWidth=0;this.naturalHeight=0;this.onload=null;}set src(v){this._src=v;}get src(){return this._src;}};
global.localStorage={getItem(){return null},setItem(){}};global.confirm=()=>false;global.requestAnimationFrame=()=>{};global.performance={now:()=>1000};global.setTimeout=()=>0;global.clearTimeout=()=>{};

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
  if(global.LR_INVENTORY.getItemCount('slimeGel')!==2||global.LR_INVENTORY.getItemCount('slimeCore')!==1) throw new Error('direct grant API did not reach inventory');

  global.LR_LOOT.clearPiles();
  const pileA=global.LR_LOOT.spawnPile({x:10,y:20,drops:[{itemId:'slimeGel',qty:3}],gold:5,potions:1,sourceLabel:'Slime'},1000);
  const pileB=global.LR_LOOT.spawnPile({x:30,y:40,drops:[],gold:0,potions:0,sourceLabel:'Slime'},1000);
  const piles=global.LR_LOOT.getPiles();
  if(piles.length!==2||piles[0].id===piles[1].id) throw new Error('mob remnants should stay separate');
  if(!global.LR_LOOT.pileHasLoot(pileA)||global.LR_LOOT.pileHasLoot(pileB)) throw new Error('sparkling/plain pile loot state mismatch');
  if(global.LR_LOOT.lifetimeMs!==60000) throw new Error('loot pile lifetime should be exactly 60 seconds');

  global.LR_LOOT.openPile(pileA);
  if(!get('lootWindow').classList.contains('show')) throw new Error('clicking a lootable pile should open the compact list');
  const beforeGold=Number(get('gold').textContent||0);
  if(global.LR_LOOT.takeGold()!==5||Number(get('gold').textContent)!==beforeGold+5) throw new Error('gold was not collected from the pile');
  const beforePotions=Number(String(get('quickPotion').textContent||'').match(/\d+/)?.[0]||0);
  if(global.LR_LOOT.takePotions()!==1||Number(String(get('quickPotion').textContent||'').match(/\d+/)?.[0]||0)!==beforePotions+1) throw new Error('potion drop was not collected from the pile');
  const targeted=global.LR_LOOT.takeAt(0,7);
  if(targeted.added!==3||global.LR_INVENTORY.getSlots()[7]?.id!=='slimeGel') throw new Error('pile item drag-target placement failed');
  if(global.LR_LOOT.pileHasLoot(pileA)) throw new Error('fully collected remnant should become plain dust');
  if(get('lootWindow').classList.contains('show')) throw new Error('loot list should close after the final reward is collected');

  global.LR_LOOT.updatePiles(60999);
  if(global.LR_LOOT.getPiles().length!==2) throw new Error('remnants despawned before 60 seconds');
  global.LR_LOOT.updatePiles(61000);
  if(global.LR_LOOT.getPiles().length!==0) throw new Error('remnants did not despawn at 60 seconds');

  const combatSrc=fs.readFileSync(path.join(ROOT,'src','combat.js'),'utf8');
  if(!combatSrc.includes('const lootReward=rollMobLoot(mob);')) throw new Error('open-world mob death is not hooked to loot rolling');
  if(!combatSrc.includes('spawnMobLootPile(mob,lootReward.rolled,gold,potionDrop')) throw new Error('open-world mob death does not create a world remnant');
  if(combatSrc.includes('state.gold+=gold;')) throw new Error('open-world gold should not auto-award on death');
  if(!combatSrc.includes('const lootReward=rollMobLoot(currentMob||e);')) throw new Error('battle victory is not hooked to loot rolling');
  if(!combatSrc.includes('spawnMobLootPile(currentMob||e,lootReward.rolled,gold,potionDrop')) throw new Error('battle victory does not create a world remnant');
  if(combatSrc.includes('openLootWindow(lootReward.rolled')) throw new Error('mob deaths should not auto-open the loot window');
  console.log('PASS world-remnant loot test');
}catch(e){console.error('FAIL world-remnant loot test\n'+(e.stack||e));process.exit(1)}
