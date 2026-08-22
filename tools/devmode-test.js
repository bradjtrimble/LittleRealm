const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const bundle=fs.readFileSync(path.join(root,'builder/game.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'js/runtime-loader.js'),'utf8');
const pack=JSON.parse(fs.readFileSync(path.join(root,'content/zones/starter-realm/world-pack.json'),'utf8'));

for(const s of [
  'initDeveloperMode','toggleDeveloperMode','drawDeveloperOverlay','rebuildWorldObjectCollision',
  'saveDeveloperProjectFolder','exportDeveloperWorldPack','DEV_DRAFT_KEY','ensureDeveloperStyles',
  'refreshDeveloperObjectList','devObjectList','devObjectPalette','Object Library','findDeveloperMobAt',
  'refreshDeveloperMobPanel','mobTypeScaleKey','Selected Mob Type','Visual Scale','devSelectedRemnant',
  'LOOT_REMNANT_VISUAL','Remnant Scale','Move Preview Near Player','visualSettings.remnants',
  'devHitboxEditing','findDeveloperHitboxInteraction','updateDeveloperHitboxDrag','Edit Hitbox Visually',
  'Finish Hitbox Editing','devDepthEditing','findDeveloperDepthInteraction','updateDeveloperDepthDrag',
  'Edit Depth Line Visually','Depth Lines','worldObjectRenderDepth','worldObjectDepthMode',
  'Terrain Library','Create Paintable Terrain'
]) if(!bundle.includes(s)) throw new Error('missing developer feature: '+s);
if(!bundle.includes('#devPanel .devView{display:none}#devPanel .devView.active{display:block}')) throw new Error('developer tab active-view CSS specificity regression');
if(!loader.includes('content/little-realm.project.json')||!loader.includes('loadProjectContent')) throw new Error('project content loader missing');
for(const old of ['config/world-objects.js','config/npcs.js','config/items.js','config/loot-tables.js','config/visual-settings.js']) if(loader.includes(old)) throw new Error('legacy content config still live-loaded: '+old);
if(!bundle.includes('const n=visualScaleOr(value,VISUAL_SCALE[key]||1)')) throw new Error('world visual scale live handler regression');
if(!bundle.includes('BALANCE.mobs[key].displayHeight')) throw new Error('mob world height is not editing the Mob Type record');
if(!bundle.includes('queueWorldRenderable("devLootPile"')) throw new Error('remnant preview is not rendered in world depth sorting');

const objects=pack.worldObjects;
if(!Array.isArray(objects)) throw new Error('zone worldObjects must be an array');
const ids=new Set();
for(let i=0;i<objects.length;i++){
  const o=objects[i];
  if(!o||typeof o!=='object'||Array.isArray(o)) throw new Error(`object ${i} must be an object`);
  if(typeof o.id!=='string'||!o.id.trim()) throw new Error(`object ${i} is missing a non-empty id`);
  if(ids.has(o.id)) throw new Error(`duplicate object id: ${o.id}`); ids.add(o.id);
  if(typeof o.type!=='string'||!o.type.trim()) throw new Error(`object ${o.id} is missing a prop type`);
  if(!Number.isFinite(Number(o.x))||!Number.isFinite(Number(o.y))) throw new Error(`object ${o.id} has invalid x/y coordinates`);
  if(o.hitbox!==undefined){
    if(!o.hitbox||typeof o.hitbox!=='object') throw new Error(`object ${o.id} hitbox must be an object`);
    for(const key of ['x','y','w','h']) if(!Number.isFinite(Number(o.hitbox[key]))) throw new Error(`object ${o.id} hitbox.${key} must be numeric`);
  }
  if(o.depthMode!==undefined&&!['ysort','behind','front','ground'].includes(String(o.depthMode))) throw new Error(`object ${o.id} has invalid depthMode`);
}
const shared=JSON.parse(fs.readFileSync(path.join(root,'content/shared/content-library.json'),'utf8'));
const definitions=shared.objectDefinitions||{};
if(Object.keys(definitions).length<50) throw new Error('expected normalized Object Library definitions');
for(const o of objects) if(!o.objectId||!definitions[o.objectId]) throw new Error(`object ${o.id} missing valid objectId definition`);
for(const forbidden of ['Built-in Prop Palette','Custom Objects','PROP_SPECS','caveEntrance','blockedGate']) if(bundle.includes(forbidden)) throw new Error('legacy object special case remains: '+forbidden);
console.log(`PASS developer world builder (${objects.length} zone objects; ${Object.keys(definitions).length} unified object definitions)`);
