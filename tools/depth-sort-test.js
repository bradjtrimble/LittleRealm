const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const world=fs.readFileSync(path.join(root,'src/world.js'),'utf8');
const pack=JSON.parse(fs.readFileSync(path.join(root,'content/zones/starter-realm/world-pack.json'),'utf8'));
const shared=JSON.parse(fs.readFileSync(path.join(root,'content/shared/content-library.json'),'utf8'));
function extractFunction(src,name){
  const start=src.indexOf(`function ${name}(`); if(start<0) throw new Error(`missing ${name}`);
  const open=src.indexOf('{',start); let depth=0,quote=null,escape=false;
  for(let i=open;i<src.length;i++){const c=src[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue;}if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0)return src.slice(start,i+1);} throw new Error(`unterminated ${name}`);
}
const bench=pack.worldObjects.find(o=>o.id==='town-bench');
if(!bench||bench.objectId!=='bench') throw new Error('town-bench missing normalized Object Library reference');
const benchDef=shared.objectDefinitions?.bench;if(!benchDef)throw new Error('bench Object Library definition missing');
const sandbox={result:null}; vm.createContext(sandbox);
vm.runInContext(`
const OBJECT_DEFINITIONS=${JSON.stringify(shared.objectDefinitions)};
const WORLD_OBJECT_DEPTH_MODES=new Set(["ysort","behind","front","ground"]);
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function numberOr(value,fallback){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function worldObjectSpec(obj){const def=OBJECT_DEFINITIONS[obj?.objectId];if(!def)return null;return {w:Math.max(8,numberOr(obj.w,def.w)),h:Math.max(8,numberOr(obj.h,def.h))};}
${extractFunction(world,'worldObjectDepthMode')}
${extractFunction(world,'worldObjectBaseSize')}
${extractFunction(world,'defaultWorldObjectDepthY')}
${extractFunction(world,'worldObjectDepthY')}
${extractFunction(world,'worldObjectRenderDepth')}
const bench=${JSON.stringify(bench)};
result={defaultY:defaultWorldObjectDepthY(bench),sortDepth:worldObjectRenderDepth(bench,999),behind:worldObjectRenderDepth({...bench,depthMode:'behind'},600),front:worldObjectRenderDepth({...bench,depthMode:'front'},600),ground:worldObjectRenderDepth({...bench,depthMode:'ground'},600),outside:worldObjectDepthY({...bench,depthY:-12})};
`,sandbox);
const r=sandbox.result;
if(r.defaultY!==30) throw new Error(`bench depth should default to hitbox bottom 30, got ${r.defaultY}`);
if(r.sortDepth!==558) throw new Error(`bench sort depth should be 528+30=558, got ${r.sortDepth}`);
if(!(r.behind<600&&r.front>600)) throw new Error('fixed behind/front modes do not bracket player depth');
if(r.ground>-1000000) throw new Error('ground mode is not safely behind world actors');
if(r.outside!==-12) throw new Error('runtime depthY should allow editor anchors outside sprite bounds');
console.log('PASS world object depth sorting through unified Object Library');
