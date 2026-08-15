const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
class ClassList{constructor(){this.s=new Set()}add(...v){v.forEach(x=>this.s.add(x))}remove(...v){v.forEach(x=>this.s.delete(x))}contains(v){return this.s.has(v)}toggle(v){if(this.s.has(v)){this.s.delete(v);return false}this.s.add(v);return true}}
class El{constructor(id){this.id=id;this.classList=new ClassList();this.style={};this.dataset={};this.textContent='';this.innerHTML='';this.disabled=false;this.offsetWidth=1;this.onclick=null;}getContext(){return {setTransform(){},beginPath(){},roundRect(){},fill(){},drawImage(){},fillRect(){},stroke(){},moveTo(){},lineTo(){},arc(){},save(){},restore(){},clip(){},translate(){},scale(){},clearRect(){},fillText(){},strokeRect(){},globalAlpha:1,imageSmoothingEnabled:false};}addEventListener(){}getBoundingClientRect(){return {left:0,top:0,width:1280,height:800}}setPointerCapture(){}appendChild(){}remove(){}}
const els=new Map();const get=id=>{if(!els.has(id))els.set(id,new El(id));return els.get(id)};
global.window=global;global.innerWidth=1280;global.innerHeight=800;global.devicePixelRatio=1;global.addEventListener=()=>{};
global.document={getElementById:get,addEventListener:()=>{},hidden:false,fullscreenElement:null,documentElement:new El('html'),createElement:tag=>new El(tag),exitFullscreen:async()=>{}};
global.navigator={};global.Image=class{constructor(){this.complete=false;this.naturalWidth=0;this.onload=null;}set src(v){this._src=v;}get src(){return this._src;}};
global.localStorage={getItem(){return null},setItem(){}};global.confirm=()=>false;global.requestAnimationFrame=()=>{};global.performance={now:()=>0};global.setTimeout=()=>0;global.clearTimeout=()=>{};
eval(fs.readFileSync(path.join(ROOT,'config','game-balance.js'),'utf8'));
eval(fs.readFileSync(path.join(ROOT,'config','items.js'),'utf8'));
try{
  eval(fs.readFileSync(path.join(ROOT,'js','game.js'),'utf8'));
  if(!global.LR_INVENTORY) throw new Error('LR_INVENTORY API missing');
  if(global.LR_INVENTORY.getSlotCount()!==20) throw new Error('slot count should be 20');
  const added=global.LR_INVENTORY.addItem('testDrop',105);
  if(added.added!==105||added.remaining!==0) throw new Error('stacked item add failed');
  if(global.LR_INVENTORY.getItemCount('testDrop')!==105) throw new Error('item count mismatch');
  if(global.LR_INVENTORY.getUsedSlots()!==2) throw new Error('105 items should consume two 99-stack slots');
  const removed=global.LR_INVENTORY.removeItem('testDrop',100);
  if(removed!==100||global.LR_INVENTORY.getItemCount('testDrop')!==5) throw new Error('remove item failed');
  console.log('PASS backpack inventory test');
}catch(e){console.error('FAIL backpack inventory test\n'+(e.stack||e));process.exit(1)}
