const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const {applyProjectGlobals}=require('./test-project-bootstrap.js');
class ClassList{constructor(){this.s=new Set()}add(...v){v.forEach(x=>this.s.add(x))}remove(...v){v.forEach(x=>this.s.delete(x))}contains(v){return this.s.has(v)}toggle(v){if(this.s.has(v)){this.s.delete(v);return false}this.s.add(v);return true}}
class El{constructor(id){this.id=id;this.classList=new ClassList();this.style={};this.dataset={};this.textContent='';this.innerHTML='';this.disabled=false;this.offsetWidth=1;this.onclick=null;}getContext(){return {setTransform(){},beginPath(){},roundRect(){},fill(){},drawImage(){},fillRect(){},stroke(){},moveTo(){},lineTo(){},arc(){},save(){},restore(){},clip(){},translate(){},scale(){},clearRect(){},fillText(){},strokeRect(){},globalAlpha:1,imageSmoothingEnabled:false};}addEventListener(){}getBoundingClientRect(){return {left:0,top:0,width:1280,height:800}}setPointerCapture(){}appendChild(){}remove(){}}
const els=new Map();const get=id=>{if(!els.has(id))els.set(id,new El(id));return els.get(id)};
global.window=global;global.innerWidth=1280;global.innerHeight=800;global.devicePixelRatio=1;global.addEventListener=()=>{};
global.document={getElementById:get,addEventListener:()=>{},hidden:false,fullscreenElement:null,documentElement:new El('html'),createElement:tag=>new El(tag),exitFullscreen:async()=>{}};
global.navigator={};global.Image=class{constructor(){this.complete=false;this.naturalWidth=0;this.onload=null;}set src(v){this._src=v;}get src(){return this._src;}};
global.localStorage={getItem(){return null},setItem(){}};global.confirm=()=>false;global.requestAnimationFrame=()=>{};global.performance={now:()=>0};global.setTimeout=()=>0;global.clearTimeout=()=>{};
eval(fs.readFileSync(path.join(ROOT,'config','game-balance.js'),'utf8'));
applyProjectGlobals(global,ROOT);
try{
  global.LR_ITEMS.testChest={name:'Test Chest',symbol:'C',category:'Armor',rarity:'Common',stackLimit:1,sellValue:0,equipmentSlot:'chest'};
  eval(fs.readFileSync(path.join(ROOT,'js','game.js'),'utf8'));
  if(!global.LR_EQUIPMENT) throw new Error('LR_EQUIPMENT API missing');
  const initial=global.LR_EQUIPMENT.get();
  if(initial.chest!=='starterTunic'||initial.legs!=='starterTrousers'||initial.feet!=='wornLeatherBoots') throw new Error('starter equipment not equipped');
  global.LR_INVENTORY.addItem('testChest',1);
  const idx=global.LR_INVENTORY.getSlots().findIndex(s=>s?.id==='testChest');
  if(idx<0||!global.LR_EQUIPMENT.equipInventorySlot(idx)) throw new Error('equip from inventory failed');
  if(global.LR_EQUIPMENT.get().chest!=='testChest') throw new Error('chest slot did not update');
  if(global.LR_INVENTORY.getItemCount('starterTunic')!==1) throw new Error('replaced starter tunic did not return to backpack');
  if('layerAssetForSlot' in global.LR_EQUIPMENT) throw new Error('visible equipment layer API should be retired');
  if(!global.LR_EQUIPMENT.unequip('chest')) throw new Error('unequip failed');
  if(global.LR_EQUIPMENT.get().chest!==null||global.LR_INVENTORY.getItemCount('testChest')!==1) throw new Error('unequip state mismatch');
  console.log('PASS non-visual equipment runtime test');
}catch(e){console.error('FAIL non-visual equipment runtime test\n'+(e.stack||e));process.exit(1)}
