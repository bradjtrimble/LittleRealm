const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
class ClassList{add(){} remove(){} toggle(){} contains(){return false}}
class El{
  constructor(id){this.id=id;this.classList=new ClassList();this.style={};this.dataset={};this.textContent='';this.innerHTML='';this.disabled=false;this.offsetWidth=1;}
  getContext(){return {setTransform(){},beginPath(){},roundRect(){},fill(){},drawImage(){},fillRect(){},stroke(){},moveTo(){},lineTo(){},arc(){},save(){},restore(){},clip(){},translate(){},scale(){},clearRect(){},fillText(){},strokeRect(){},globalAlpha:1,imageSmoothingEnabled:false};}
  addEventListener(){} getBoundingClientRect(){return {left:0,top:0,width:720,height:1520}} setPointerCapture(){} appendChild(){} remove(){}
}
const els=new Map(); const get=id=>{if(!els.has(id))els.set(id,new El(id));return els.get(id)};
global.window=global; global.innerWidth=720; global.innerHeight=1520; global.devicePixelRatio=1; global.addEventListener=()=>{};
global.document={getElementById:get,addEventListener:()=>{},hidden:false,fullscreenElement:null,documentElement:new El('html'),createElement:tag=>new El(tag),exitFullscreen:async()=>{}};
global.navigator={};
global.Image=class{constructor(){this.complete=false;this.naturalWidth=0;this.onload=null;}set src(v){this._src=v;}get src(){return this._src;}};
global.localStorage={getItem(){return null},setItem(){}}; global.confirm=()=>false; global.requestAnimationFrame=()=>{}; global.performance={now:()=>0};
global.setTimeout=()=>0; global.clearTimeout=()=>{};
try{eval(fs.readFileSync(path.join(ROOT,'js','game.js'),'utf8'));console.log('PASS initialization smoke test');}
catch(e){console.error('FAIL initialization smoke test\n'+(e.stack||e));process.exit(1)}
