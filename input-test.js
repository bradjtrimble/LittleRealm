const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const listeners={};
function on(type,fn){(listeners[type]||(listeners[type]=[])).push(fn)}
class ClassList{
  constructor(){this.s=new Set()}
  add(...v){v.forEach(x=>this.s.add(x))}
  remove(...v){v.forEach(x=>this.s.delete(x))}
  toggle(v){if(this.s.has(v)){this.s.delete(v);return false}this.s.add(v);return true}
  contains(v){return this.s.has(v)}
}
class El{
  constructor(id){this.id=id;this.classList=new ClassList();this.style={};this.dataset={};this.textContent='';this.innerHTML='';this.disabled=false;this.offsetWidth=1;}
  getContext(){return {setTransform(){},beginPath(){},roundRect(){},fill(){},drawImage(){},fillRect(){},stroke(){},moveTo(){},lineTo(){},arc(){},save(){},restore(){},clip(){},translate(){},scale(){},clearRect(){},fillText(){},strokeRect(){},globalAlpha:1,imageSmoothingEnabled:false};}
  addEventListener(){} getBoundingClientRect(){return {left:0,top:0,width:1280,height:800}} setPointerCapture(){} appendChild(){} remove(){}
}
const els=new Map(); const get=id=>{if(!els.has(id))els.set(id,new El(id));return els.get(id)};
global.window=global; global.innerWidth=1280; global.innerHeight=800; global.devicePixelRatio=1; global.addEventListener=on;
global.document={getElementById:get,addEventListener:on,hidden:false,fullscreenElement:null,documentElement:new El('html'),createElement:tag=>new El(tag),exitFullscreen:async()=>{}};
global.navigator={};
global.Image=class{constructor(){this.complete=false;this.naturalWidth=0;this.onload=null;}set src(v){this._src=v;}get src(){return this._src;}};
global.localStorage={getItem(){return null},setItem(){}}; global.confirm=()=>false; global.requestAnimationFrame=()=>{}; global.performance={now:()=>0};
global.setTimeout=()=>0; global.clearTimeout=()=>{};
eval(fs.readFileSync(path.join(ROOT,'config','keybinds.js'),'utf8'));
function fire(type,code,key=code){
  const ev={code,key,repeat:false,shiftKey:false,target:null,preventDefault(){this.prevented=true}};
  for(const fn of listeners[type]||[]) fn(ev);
  return ev;
}
try{
  eval(fs.readFileSync(path.join(ROOT,'js','game.js'),'utf8'));
  if(typeof global.LR_INPUT_STATE!=='function') throw new Error('LR_INPUT_STATE diagnostic unavailable');
  fire('keydown','KeyW','w');
  if(!global.LR_INPUT_STATE().up) throw new Error('KeyW did not set movement up');
  fire('keyup','KeyW','w');
  if(global.LR_INPUT_STATE().up) throw new Error('KeyW keyup did not release movement up');
  fire('keydown','ArrowRight','ArrowRight');
  if(!global.LR_INPUT_STATE().right) throw new Error('ArrowRight did not set movement right');
  fire('keyup','ArrowRight','ArrowRight');
  if(global.LR_INPUT_STATE().right) throw new Error('ArrowRight keyup did not release movement right');
  if(!Array.isArray(global.LR_INPUT_BINDINGS.attackTarget)||!global.LR_INPUT_BINDINGS.attackTarget.includes('Space')) throw new Error('Attack keybind missing');
  console.log('PASS keyboard input test');
}catch(e){console.error('FAIL keyboard input test\n'+(e.stack||e));process.exit(1)}
