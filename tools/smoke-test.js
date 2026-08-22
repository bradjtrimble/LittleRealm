const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const {applyProjectGlobals}=require('./test-project-bootstrap.js');
class ClassList{add(){} remove(){} toggle(){} contains(){return false}}
class El{
  constructor(id){this.id=id;this.classList=new ClassList();this.style={};this.dataset={};this.textContent='';this.innerHTML='';this.disabled=false;this.offsetWidth=1;}
  getContext(){return {setTransform(){},beginPath(){},roundRect(){},fill(){},drawImage(){},fillRect(){},stroke(){},moveTo(){},lineTo(){},arc(){},ellipse(){},rect(){},closePath(){},strokeText(){},save(){},restore(){},clip(){},translate(){},scale(){},clearRect(){},fillText(){},strokeRect(){},globalAlpha:1,imageSmoothingEnabled:false};}
  addEventListener(){} getBoundingClientRect(){return {left:0,top:0,width:720,height:1520}} setPointerCapture(){} appendChild(){} remove(){}
}
const els=new Map(); const get=id=>{if(!els.has(id))els.set(id,new El(id));return els.get(id)};
global.window=global; global.innerWidth=720; global.innerHeight=1520; global.devicePixelRatio=1; global.addEventListener=()=>{};
global.document={getElementById:get,addEventListener:()=>{},hidden:false,fullscreenElement:null,documentElement:new El('html'),createElement:tag=>new El(tag),exitFullscreen:async()=>{}};
global.navigator={};
global.Image=class{constructor(){this.complete=false;this.naturalWidth=0;this.onload=null;}set src(v){this._src=v;}get src(){return this._src;}};
global.localStorage={getItem(){return null},setItem(){}}; global.confirm=()=>false; let rafFired=false; global.requestAnimationFrame=cb=>{if(!rafFired){rafFired=true;cb(16);}return 0;}; global.performance={now:()=>0};
global.setTimeout=()=>0; global.clearTimeout=()=>{};
eval(fs.readFileSync(path.join(ROOT,'config','game-balance.js'),'utf8'));applyProjectGlobals(global,ROOT);
try{
  let bundle=fs.readFileSync(path.join(ROOT,'js','game.js'),'utf8');
  const probe=`\n  const __visibleMob=mobs.find(m=>m&&m.alive);\n  if(!__visibleMob) throw new Error('smoke test could not find a live mob');\n  __visibleMob.x=state.x+20; __visibleMob.y=state.y+20;\n  drawWorld();\n`;
  const close=bundle.lastIndexOf('})();');
  if(close<0) throw new Error('runtime bundle wrapper not found');
  bundle=bundle.slice(0,close)+probe+bundle.slice(close);
  eval(bundle);
  console.log('PASS initialization + first world frame + visible mob render smoke test');
}
catch(e){console.error('FAIL initialization/render smoke test\n'+(e.stack||e));process.exit(1)}
