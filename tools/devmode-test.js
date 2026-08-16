const fs=require('fs'), path=require('path'), vm=require('vm');
const root=path.resolve(__dirname,'..');
const bundle=fs.readFileSync(path.join(root,'js/game.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'js/runtime-loader.js'),'utf8');
const cfgPath=path.join(root,'config/world-objects.js');
const cfg=fs.readFileSync(cfgPath,'utf8');

// Verify the editor/runtime features still exist.
const required=[
  'initDeveloperMode','toggleDeveloperMode','drawDeveloperOverlay',
  'rebuildWorldObjectCollision','exportDeveloperLayout','DEV_DRAFT_KEY',
  'ensureDeveloperStyles','refreshDeveloperObjectList','devObjectList',
  'devPalette','Existing Objects','findDeveloperMobAt','refreshDeveloperMobPanel','mobTypeScaleKey','MOB_TYPE_SCALE','Selected Mob Type','Visual Scale'
];
for(const s of required) if(!bundle.includes(s)) throw new Error('missing developer feature: '+s);
if(!loader.includes('config/world-objects.js')) throw new Error('world object config is not live-loaded');

// Execute the user-editable config in a sandbox instead of testing for the
// original starter layout's exact text/contents. Developer Mode is allowed to
// move, delete, duplicate, rename, and change metadata on every placed object.
const sandbox={window:{}};
vm.createContext(sandbox);
try{
  vm.runInContext(cfg,sandbox,{filename:'config/world-objects.js',timeout:1000});
}catch(err){
  throw new Error('world-objects.js is not valid JavaScript: '+err.message);
}

const objects=sandbox.window.LR_WORLD_OBJECTS;
if(!Array.isArray(objects)) throw new Error('window.LR_WORLD_OBJECTS must be an array');

const ids=new Set();
for(let i=0;i<objects.length;i++){
  const o=objects[i];
  if(!o || typeof o!=='object' || Array.isArray(o)) throw new Error(`object ${i} must be an object`);
  if(typeof o.id!=='string' || !o.id.trim()) throw new Error(`object ${i} is missing a non-empty id`);
  if(ids.has(o.id)) throw new Error(`duplicate object id: ${o.id}`);
  ids.add(o.id);
  if(typeof o.type!=='string' || !o.type.trim()) throw new Error(`object ${o.id} is missing a prop type`);
  if(!Number.isFinite(Number(o.x)) || !Number.isFinite(Number(o.y))) throw new Error(`object ${o.id} has invalid x/y coordinates`);

  if(o.hitbox!==undefined){
    if(!o.hitbox || typeof o.hitbox!=='object') throw new Error(`object ${o.id} hitbox must be an object`);
    for(const key of ['x','y','w','h']){
      if(!Number.isFinite(Number(o.hitbox[key]))) throw new Error(`object ${o.id} hitbox.${key} must be numeric`);
    }
    if(Number(o.hitbox.w)<0 || Number(o.hitbox.h)<0) throw new Error(`object ${o.id} hitbox size cannot be negative`);
  }
  if(o.container!==undefined && typeof o.container!=='boolean') throw new Error(`object ${o.id} container must be true/false`);
  if(o.interactable!==undefined && typeof o.interactable!=='boolean') throw new Error(`object ${o.id} interactable must be true/false`);
  if(o.solid!==undefined && typeof o.solid!=='boolean') throw new Error(`object ${o.id} solid must be true/false`);
  if(o.capacity!==undefined && (!Number.isFinite(Number(o.capacity)) || Number(o.capacity)<0)) throw new Error(`object ${o.id} capacity must be zero or greater`);
  if(o.contents!==undefined && !Array.isArray(o.contents)) throw new Error(`object ${o.id} contents must be an array`);
}

const propSpecCount=(bundle.match(/\{sx:\d+,sy:\d+,sw:\d+,sh:\d+,w:\d+,h:\d+\}/g)||[]).length;
if(propSpecCount < 50) throw new Error('expected clean prop palette mappings, found '+propSpecCount);

console.log(`PASS developer world builder config (${objects.length} placed objects)`);
