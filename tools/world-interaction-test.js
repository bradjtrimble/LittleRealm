const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'src/world-interactions.js'),'utf8');
const panel=fs.readFileSync(path.join(root,'src/builder/panel-refresh.js'),'utf8');
const editor=fs.readFileSync(path.join(root,'src/builder/world-editor.js'),'utf8');
const interactions=fs.readFileSync(path.join(root,'src/builder/interactions.js'),'utf8');
const zones=fs.readFileSync(path.join(root,'src/builder/zone-manager.js'),'utf8');
const quests=fs.readFileSync(path.join(root,'src/builder/quest-editor.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'js/runtime-loader.js'),'utf8');
function ok(v,msg){if(!v)throw new Error(msg);}
const ctx={console,window:{},Date,state:{zoneId:'test-zone',worldObjectStates:{},quests:{}},
  numberOr:(v,d)=>Number.isFinite(Number(v))?Number(v):d,
  worldObjectSpec:()=>({w:100,h:80}),ensureQuestState:()=>ctx.state.quests,
  getItemCount:()=>0,getItemDefinition:id=>({id,name:id}),Math,Object,Set,String,Number,Array};
vm.createContext(ctx);vm.runInContext(src,ctx);
let cfg=vm.runInContext('worldObjectInteraction({id:"legacy",interactable:true,hitbox:{x:20,y:60,w:40,h:12}})',ctx);
ok(cfg.enabled===false,'legacy interactable flags must remain inert without interaction config');
cfg=vm.runInContext('worldObjectInteraction({id:"door",interaction:{enabled:true,type:"enter",prompt:"Enter Inn",area:{x:30,y:50,w:40,h:25},actions:{targetZone:"inn"}}})',ctx);
ok(cfg.enabled&&cfg.type==='enter'&&cfg.actions.targetZone==='inn','configured zone entrance should normalize correctly');
cfg=vm.runInContext('worldObjectInteraction({id:"chest",interaction:{enabled:true,type:"open",actions:{openMode:"storage",lootTable:"treasure",questIds:["board_quest"]}}})',ctx);
ok(cfg.actions.openMode==='storage'&&cfg.actions.questIds[0]==='board_quest','open/container action normalization failed');
let availability=vm.runInContext('worldInteractionAvailability({id:"pumpkin",interaction:{enabled:true,type:"gather",requirements:{questId:"harvest",questState:"active"}}})',ctx);
ok(!availability.visible,'quest-gated interactions should stay hidden before the quest is active');
ctx.state.quests.harvest={status:'active'};
availability=vm.runInContext('worldInteractionAvailability({id:"pumpkin",interaction:{enabled:true,type:"gather",requirements:{questId:"harvest",questState:"active"}}})',ctx);
ok(availability.visible&&availability.available,'quest-gated interaction should activate with the quest');
vm.runInContext('markWorldObjectUsed({id:"chest"},worldObjectInteraction({id:"chest",interaction:{enabled:true,useMode:"once"}}))',ctx);
ok(vm.runInContext('worldObjectIsUsed({id:"chest"},worldObjectInteraction({id:"chest",interaction:{enabled:true,useMode:"once"}}))',ctx),'one-time object state should persist per zone');
ok(panel.includes('World Interaction')&&panel.includes('Create & Link Interior Zone'),'Builder inspector is missing interaction controls');
ok(editor.includes('setDeveloperInteractionEditing')&&editor.includes('updateDeveloperInteractionAreaDrag'),'visual interaction-area editor is missing');
const editBlock=editor.slice(editor.indexOf('function setDeveloperInteractionEditing'),editor.indexOf('function updateDeveloperInteractionAreaDrag'));
ok(!/devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;devInteractionEditing=false/.test(editBlock),'interaction edit mode must not disable itself when activated');
ok(panel.includes('Drag inside the green interaction area')&&panel.includes('updateDeveloperInteractionAreaFromInputs'),'interaction area must expose hitbox-style drag/resize help and live numeric preview');
ok(interactions.includes('syncDeveloperInspectorFromPanel')&&interactions.includes('updateDeveloperInteractionAreaFromInputs'),'interaction inspector draft/live area sync is missing');
ok(zones.includes('createDeveloperInteriorForSelection')&&zones.includes('interaction:{enabled:true,type:"enter",prompt:"Exit"'),'linked interior/exit creation is missing');
ok(quests.includes('Interact With Object')&&quests.includes('type==="interact"'),'quest editor is missing interact objectives');
ok(loader.includes('LR_PROJECT_ZONE_PACKS')&&loader.includes('LR_QUESTS'),'runtime loader must preload zones and merged quest definitions');
console.log('PASS unified world interaction + enterable interior workflow');
