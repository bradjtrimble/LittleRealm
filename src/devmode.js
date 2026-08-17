const DEV_DRAFT_KEY = "littleRealmWorldBuilderDraftV2";
const DEV_OLD_DRAFT_KEY = "littleRealmWorldBuilderDraftV1";
let devModeActive=false;
let devPanel=null;
let devSelected=null;
let devPlaceType=null;
let devDragging=false;
let devDragOffset={x:0,y:0};
let devHitboxEditing=false;
let devHitboxDrag=null;
let devDepthEditing=false;
let devDepthDrag=null;
let devShowGrid=true;
let devShowHitboxes=true;
let devShowDepthLines=true;
let devSnap=8;
let devStatusTimer=null;
let devSelectedMob=null;
let devSelectedNpc=null;
let devNpcDragging=false;
let devNpcDragOffset={x:0,y:0};
let devPlaceNpcTemplate=null;
let devSelectedQuestId=null;
let devQuestFormDraft=null;
let devActiveTab="objects";
let devCombatMobType="goblin";
let devPlayerTestBaseline=null;
const DEV_PROJECT_BALANCE=JSON.parse(JSON.stringify(BALANCE));

function ensureDeveloperStyles(){
  if(document.getElementById("littleRealmDevStyles")) return;
  const style=document.createElement("style");
  style.id="littleRealmDevStyles";
  style.textContent=`
    #devPanel{position:fixed!important;z-index:10000!important;top:12px!important;right:12px!important;width:min(720px,58vw)!important;height:min(860px,calc(100vh - 24px))!important;background:rgba(24,20,30,.98)!important;border:1px solid rgba(255,255,255,.22)!important;border-radius:16px!important;box-shadow:0 18px 50px rgba(0,0,0,.55)!important;color:#f8f2ff!important;display:none!important;overflow:hidden!important;font:13px system-ui,sans-serif!important;backdrop-filter:blur(8px)!important}
    #devPanel.show{display:flex!important;flex-direction:column!important}
    #devPanel *{box-sizing:border-box}
    #devPanel .devHeader{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#453552;border-bottom:1px solid rgba(255,255,255,.12)}
    #devPanel .devHeader b{display:block;font-size:15px;letter-spacing:.08em} #devPanel .devHeader span{display:block;font-size:11px;color:#cdbed9;margin-top:2px}
    #devPanel button,#devPanel select,#devPanel input{font:inherit}
    #devPanel .devHeader button{width:36px;height:36px;border:0;border-radius:9px;background:#2a2132;color:white;font-size:22px}
    #devPanel .devToolbar{display:flex;gap:9px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.1)}
    #devPanel .devToolbar button,#devPanel .devToolbar select,#devPanel .devProjectActions button,#devPanel .devRow button,#devPanel .devMobTypeChip{border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:8px;padding:8px 10px;font-weight:700}
    #devPanel .devToolbar button.active,#devPanel .devPropButton.active,#devPanel .devTab.active,#devPanel .devMobTypeChip.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel .devToolbar label{display:flex;gap:5px;align-items:center;color:#e5d9ec}
    #devPanel .devTabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.1);background:#211a28}
    #devPanel .devTab{border:1px solid rgba(255,255,255,.12);background:#30283a;color:#d9cfdf;border-radius:9px;padding:9px 10px;font-weight:800;cursor:pointer}
    #devPanel .devBody{flex:1;min-height:0;overflow:auto;padding:12px}
    #devPanel .devView{display:none}#devPanel .devView.active{display:block}
    #devPanel .devSection{background:#241e2b;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px;margin-bottom:12px}
    #devPanel .devSectionTitle{padding:0 2px 8px;font-weight:900;color:#d8c1e7;letter-spacing:.06em;text-transform:uppercase;font-size:12px}
    #devPanel .devHint{color:#b9aebe;font-size:11px;margin:-2px 2px 9px;line-height:1.35}
    #devPanel #devPalette{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:7px!important;max-height:360px!important;overflow:auto!important;padding:2px!important}
    #devPanel .devPropButton{min-width:0;border:1px solid rgba(255,255,255,.12);background:#30283a;color:#eee;border-radius:9px;padding:5px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;min-height:76px}
    #devPanel .devPropButton canvas{width:52px;height:52px;image-rendering:pixelated;background:rgba(255,255,255,.025);border-radius:5px}
    #devPanel .devPropButton span{font-size:10px;line-height:1.05;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:capitalize}
    #devPanel #devObjectList,#devPanel #devSelectionList{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;max-height:260px;overflow:auto}
    #devPanel .devObjectChip{border:1px solid rgba(255,255,255,.12);background:#2e2736;color:#e9dff0;border-radius:8px;padding:7px 9px;font-size:11px;cursor:pointer;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #devPanel .devObjectChip.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel #devScalePanel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
    #devPanel .devScaleControl{background:#2b2432;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px;color:#ddd}
    #devPanel .devScaleControl .devScaleTop{display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:800;margin-bottom:7px}
    #devPanel .devScaleControl input[type=range]{width:100%;accent-color:#63e6ff}
    #devPanel #devMobScalePanel{background:#2b2432;border:1px solid rgba(99,230,255,.18);border-radius:12px;padding:12px;min-height:130px}
    #devPanel .devMobSelectedTitle{font-size:18px;font-weight:900;color:#7ceaff;margin-bottom:3px}.devMobMeta{color:#bdb0c5;font-size:11px;margin-bottom:11px}
    #devPanel #devMobTypeChips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.devMobTypeChip{font-size:10px!important;padding:6px 8px!important;cursor:pointer}
    #devPanel #devInspector{padding:2px;min-height:180px}
    #devPanel .devEmpty{color:#baaec2;padding:12px;background:#2b2432;border-radius:9px}.devSelectedTitle{font-size:16px;font-weight:900;margin-bottom:9px;color:#7ceaff;text-transform:capitalize}
    #devPanel #devInspector label{display:flex;flex-direction:column;gap:4px;margin:7px 0;color:#d7cbdc}
    #devPanel #devInspector input[type=text],#devPanel #devInspector input[type=number],#devPanel #devInspector input:not([type]),#devPanel #devInspector select{width:100%;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:7px;padding:8px}
    #devPanel .devChecks{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px} #devPanel .devChecks label{flex-direction:row!important;align-items:center!important;background:#2b2432;padding:8px;border-radius:7px}
    #devPanel .devPair{display:grid;grid-template-columns:1fr 1fr;gap:9px} #devPanel .devQuad{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
    #devPanel .devSubhead{font-weight:800;margin-top:10px;color:#c9b9d2} #devPanel .devRow{display:flex;gap:7px;margin-top:10px} #devPanel .devRow button{flex:1} #devPanel .devRow .danger{background:#713b47}
    #devPanel .devHitboxEditButton{width:100%;margin-top:8px;border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:8px;padding:9px 10px;font-weight:900;cursor:pointer}
    #devPanel .devHitboxEditButton.active{outline:2px solid #ffd166;background:#66532b;color:#fff8dd}
    #devPanel .devHitboxEditHelp{margin-top:7px;padding:8px 9px;border:1px solid rgba(255,209,102,.18);border-radius:8px;background:rgba(255,209,102,.06);color:#d8cdbc;font-size:10px;line-height:1.35}
    #devPanel .devDepthEditButton{width:100%;margin-top:8px;border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:8px;padding:9px 10px;font-weight:900;cursor:pointer}
    #devPanel .devDepthEditButton.active{outline:2px solid #d58cff;background:#59406a;color:#fff4ff}
    #devPanel .devDepthEditButton:disabled{opacity:.42;cursor:not-allowed}
    #devPanel .devDepthEditHelp{margin-top:7px;padding:8px 9px;border:1px solid rgba(213,140,255,.20);border-radius:8px;background:rgba(213,140,255,.07);color:#d8cdbc;font-size:10px;line-height:1.35}
    #devPanel .devProjectActions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px} #devPanel .devProjectActions button:first-child{grid-column:1/-1;background:#38606a}
    #devPanel #devStatus{padding:9px 12px;background:#1d1822;color:#bdb0c5;font-size:11px;border-top:1px solid rgba(255,255,255,.08)}

    #devPanel .devCombatGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    #devPanel .devCombatField{display:flex;flex-direction:column;gap:4px;color:#d7cbdc;font-size:11px;font-weight:700}
    #devPanel .devCombatField input,#devPanel .devCombatField select{width:100%;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:7px;padding:8px}
    #devPanel .devCombatCheck{display:flex;align-items:center;gap:7px;background:#2b2432;border-radius:8px;padding:9px;color:#ddd;font-weight:700}
    #devPanel .devCombatActions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.devCombatActions button{border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:8px;padding:8px 10px;font-weight:800;cursor:pointer}.devCombatActions .primary{background:#38606a}.devCombatActions .danger{background:#713b47}
    #devPanel .devCombatDetails{background:#211b27;border:1px solid rgba(255,255,255,.08);border-radius:10px;margin:8px 0;overflow:hidden}.devCombatDetails summary{cursor:pointer;padding:10px 11px;font-weight:900;color:#d8c1e7;user-select:none}.devCombatDetails>div{padding:0 10px 10px}
    #devPanel .devPlayerTest{display:grid;grid-template-columns:minmax(110px,160px) 1fr;gap:10px;align-items:end}.devQuickLevels{display:flex;gap:5px;flex-wrap:wrap}.devQuickLevels button{border:1px solid rgba(255,255,255,.12);background:#30283a;color:#fff;border-radius:7px;padding:7px 9px;font-weight:800}
    #devPanel .devStatPreview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:9px}.devStatPreview div{background:#2b2432;border-radius:8px;padding:8px;text-align:center}.devStatPreview b{display:block;color:#7ceaff;font-size:14px}.devStatPreview span{font-size:9px;color:#a99bb3;text-transform:uppercase;letter-spacing:.05em}
    #devPanel .devNpcPalette{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.devNpcPalette button{border:1px solid rgba(255,255,255,.12);background:#30283a;color:#fff;border-radius:9px;padding:9px;font-weight:850;cursor:pointer}.devNpcPalette button.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel #devNpcList,#devPanel #devQuestList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;max-height:230px;overflow:auto}.devNpcChip,.devQuestChip{border:1px solid rgba(255,255,255,.12);background:#2e2736;color:#e9dff0;border-radius:8px;padding:7px 9px;font-size:11px;cursor:pointer;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.devNpcChip.active,.devQuestChip.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel .devNpcInspector label,#devPanel .devQuestEditor label{display:flex;flex-direction:column;gap:4px;margin:7px 0;color:#d7cbdc;font-size:11px;font-weight:700}.devNpcInspector input,.devNpcInspector select,.devNpcInspector textarea,.devQuestEditor input,.devQuestEditor select,.devQuestEditor textarea{width:100%;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:7px;padding:8px;font:inherit}.devNpcInspector textarea,.devQuestEditor textarea{min-height:62px;resize:vertical}
    #devPanel .devQuestObjective{margin-top:8px;padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#2a2331}.devQuestObjectiveTop{display:grid;grid-template-columns:1fr 1.35fr .55fr auto;gap:6px;align-items:end}.devQuestObjectiveTop button{height:34px;border:1px solid rgba(255,255,255,.12);background:#713b47;color:#fff;border-radius:7px;font-weight:900}.devVisitGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.devQuestListActions{display:flex;gap:7px;margin-top:8px}.devQuestListActions button{flex:1;border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:8px;padding:8px;font-weight:800}
    #devPanel .devProjectBig{display:grid;grid-template-columns:1fr 1fr;gap:8px}.devProjectBig button{border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:9px;padding:10px;font-weight:850}.devProjectBig .primary{grid-column:1/-1;background:#38606a}.devProjectBig .danger{background:#713b47}.devProjectNote{padding:9px;border:1px solid rgba(99,230,255,.14);border-radius:9px;background:rgba(99,230,255,.05);color:#cbd9dd;font-size:10px;line-height:1.4}
    body.devMode #pcControls{opacity:.25}
    @media(max-width:1100px){#devPanel{width:min(650px,68vw)!important}#devPanel #devPalette{grid-template-columns:repeat(5,minmax(0,1fr))!important}}
    @media(max-width:760px){#devPanel .devTabs{grid-template-columns:repeat(2,1fr)}#devPanel .devCombatGrid{grid-template-columns:repeat(2,minmax(0,1fr))}#devPanel .devStatPreview{grid-template-columns:repeat(2,minmax(0,1fr))}#devPanel{width:calc(100vw - 12px)!important;right:6px!important;top:6px!important;height:calc(100vh - 12px)!important}#devPanel #devPalette{grid-template-columns:repeat(4,minmax(0,1fr))!important}#devPanel #devObjectList,#devPanel #devSelectionList{grid-template-columns:repeat(2,minmax(0,1fr))}#devPanel #devScalePanel{grid-template-columns:1fr}.devQuad{grid-template-columns:repeat(2,1fr)!important}}
  `;
  document.head.appendChild(style);
}

function cloneWorldObject(obj){
  return JSON.parse(JSON.stringify(obj));
}

function getProjectWorldObjects(){
  return (PROJECT_WORLD_OBJECTS||[]).map(cloneWorldObject);
}

function worldObjectSpec(obj){
  if(!obj) return null;
  if(obj.type==="crops") return {w:obj.w||90,h:obj.h||70};
  if(obj.type==="blockedGate") return {w:150,h:62};
  if(obj.type==="caveEntrance") return {w:obj.w||220,h:obj.h||160};
  return PROP_SPECS[obj.type]||null;
}

function defaultWorldObject(type,x,y){
  const spec=worldObjectSpec({type})||{w:48,h:48};
  const hitH=Math.max(8,Math.round(spec.h*.26));
  const hitW=Math.max(10,Math.round(spec.w*.66));
  return {
    id:`${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,
    type,
    x:Math.round(x),
    y:Math.round(y),
    solid:false,
    hitbox:{x:Math.round((spec.w-hitW)/2),y:spec.h-hitH,w:hitW,h:hitH},
    depthMode:"ysort",
    depthY:spec.h,
    interactable:false,
    label:type.replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase()),
    container:false,
    capacity:8,
    contents:[]
  };
}

function rebuildWorldObjectCollision(){
  // Other protected collision sources keep their own type. Only editor props are replaced.
  solidRects=solidRects.filter(r=>r.type!=="world-prop" && r.type!=="zone-gate");
  for(const obj of sceneryProps){
    if(!obj.solid) continue;
    const hb=obj.hitbox||{};
    const spec=worldObjectSpec(obj)||{w:32,h:32};
    const x=numberOr(hb.x,0),y=numberOr(hb.y,Math.round(spec.h*.7));
    const w=Math.max(1,numberOr(hb.w,spec.w)),h=Math.max(1,numberOr(hb.h,Math.round(spec.h*.3)));
    addSolidRect(obj.x+x,obj.y+y,w,h,obj.type==="blockedGate"?"zone-gate":"world-prop");
  }
}

function devWorldFromPointer(event){
  return {
    x:state.x+(event.clientX-innerWidth/2)/CAMERA_ZOOM,
    y:state.y+(event.clientY-innerHeight/2)/CAMERA_ZOOM
  };
}
function snapDev(v){ return Math.round(v/devSnap)*devSnap; }
function clampDev(v,min,max){ return Math.max(min,Math.min(max,v)); }

function developerSelectedEntity(){
  return devSelected||devSelectedNpc||null;
}
function developerIsNpc(entity){
  return !!entity && sceneryNPCs.includes(entity);
}
function developerEntityBounds(entity){
  if(!entity) return {x:0,y:0,w:32,h:32};
  if(developerIsNpc(entity)) return npcVisualBounds(entity);
  const spec=worldObjectSpec(entity)||{w:32,h:32};
  return {x:entity.x,y:entity.y,w:spec.w,h:spec.h};
}
function developerEntityOffsetLimits(entity){
  const b=developerEntityBounds(entity);
  return {minX:b.x-entity.x,maxX:b.x+b.w-entity.x,minY:b.y-entity.y,maxY:b.y+b.h-entity.y};
}
function developerEntityDepthMode(entity){
  return developerIsNpc(entity)?npcDepthMode(entity):worldObjectDepthMode(entity);
}
function developerEntityDefaultDepthY(entity){
  return developerIsNpc(entity)?defaultNpcDepthY(entity):defaultWorldObjectDepthY(entity);
}
function rebuildDeveloperEntityCollision(entity){
  if(developerIsNpc(entity)) rebuildNpcCollision();
  else rebuildWorldObjectCollision();
}

function ensureDeveloperHitbox(obj=developerSelectedEntity()){
  if(!obj) return null;
  if(!obj.hitbox){
    if(developerIsNpc(obj)) obj.hitbox={x:-6,y:-7,w:12,h:14};
    else{
      const spec=worldObjectSpec(obj)||{w:32,h:32};
      const hitH=Math.max(8,Math.round(spec.h*.26));
      const hitW=Math.max(10,Math.round(spec.w*.66));
      obj.hitbox={x:Math.round((spec.w-hitW)/2),y:spec.h-hitH,w:hitW,h:hitH};
    }
  }
  return obj.hitbox;
}

function ensureDeveloperDepth(obj=developerSelectedEntity()){
  if(!obj) return null;
  if(!WORLD_OBJECT_DEPTH_MODES.has(String(obj.depthMode||"").toLowerCase())) obj.depthMode=developerEntityDepthMode(obj);
  if(!Number.isFinite(Number(obj.depthY))) obj.depthY=developerEntityDefaultDepthY(obj);
  return {mode:developerEntityDepthMode(obj),y:numberOr(obj.depthY,developerEntityDefaultDepthY(obj))};
}

function findDeveloperDepthInteraction(wx,wy){
  const entity=developerSelectedEntity();
  if(!devDepthEditing || !entity || developerEntityDepthMode(entity)!=="ysort") return false;
  const b=developerEntityBounds(entity);
  const depth=ensureDeveloperDepth(entity);
  const lineY=entity.y+depth.y;
  const grab=8/CAMERA_ZOOM;
  return wx>=b.x-grab*2 && wx<=b.x+b.w+grab*2 && Math.abs(wy-lineY)<=grab;
}

function setDeveloperDepthEditing(active){
  const entity=developerSelectedEntity();
  devDepthEditing=!!active && !!entity && developerEntityDepthMode(entity)==="ysort";
  devDepthDrag=null;
  if(devDepthEditing){
    devHitboxEditing=false;
    devHitboxDrag=null;
    ensureDeveloperDepth(entity);
    devShowDepthLines=true;
    const toggle=devPanel?.querySelector("#devDepthLines");
    if(toggle) toggle.checked=true;
    devSetStatus("Depth edit mode — drag the purple line up/down to control sprite overlap");
  }else{
    if(game?.style) game.style.cursor="";
    devSetStatus("Depth edit mode finished");
  }
  refreshDeveloperPanel();
}

function updateDeveloperDepthDrag(p){
  const entity=developerSelectedEntity();
  if(!devDepthDrag || !entity) return;
  const limits=developerEntityOffsetLimits(entity);
  const span=Math.max(16,limits.maxY-limits.minY);
  const dy=Math.round(p.y-devDepthDrag.pointerY);
  entity.depthY=Math.round(clampDev(devDepthDrag.depthY+dy,limits.minY-span,limits.maxY+span));
  refreshDeveloperInspectorValues();
}

function findDeveloperHitboxInteraction(wx,wy){
  const entity=developerSelectedEntity();
  if(!devHitboxEditing || !entity) return null;
  const hb=ensureDeveloperHitbox(entity);
  const left=entity.x+hb.x, top=entity.y+hb.y;
  const right=left+hb.w, bottom=top+hb.h;
  const grab=7/CAMERA_ZOOM;
  if(wx<left-grab || wx>right+grab || wy<top-grab || wy>bottom+grab) return null;

  const nearL=Math.abs(wx-left)<=grab, nearR=Math.abs(wx-right)<=grab;
  const nearT=Math.abs(wy-top)<=grab, nearB=Math.abs(wy-bottom)<=grab;
  if(nearL&&nearT) return "nw";
  if(nearR&&nearT) return "ne";
  if(nearL&&nearB) return "sw";
  if(nearR&&nearB) return "se";
  if(nearT && wx>=left-grab && wx<=right+grab) return "n";
  if(nearB && wx>=left-grab && wx<=right+grab) return "s";
  if(nearL && wy>=top-grab && wy<=bottom+grab) return "w";
  if(nearR && wy>=top-grab && wy<=bottom+grab) return "e";
  if(wx>=left && wx<=right && wy>=top && wy<=bottom) return "move";
  return null;
}

function developerHitboxCursor(interaction){
  if(interaction==="move") return "move";
  if(interaction==="n"||interaction==="s") return "ns-resize";
  if(interaction==="e"||interaction==="w") return "ew-resize";
  if(interaction==="nw"||interaction==="se") return "nwse-resize";
  if(interaction==="ne"||interaction==="sw") return "nesw-resize";
  return "default";
}

function setDeveloperHitboxEditing(active){
  const entity=developerSelectedEntity();
  devHitboxEditing=!!active && !!entity;
  devHitboxDrag=null;
  if(devHitboxEditing){
    devDepthEditing=false;
    devDepthDrag=null;
    ensureDeveloperHitbox(entity);
    devShowHitboxes=true;
    const toggle=devPanel?.querySelector("#devHitboxes");
    if(toggle) toggle.checked=true;
    devSetStatus("Hitbox edit mode — drag inside to move, drag handles/edges to resize");
  }else{
    if(game?.style) game.style.cursor="";
    devSetStatus("Hitbox edit mode finished");
  }
  refreshDeveloperPanel();
}

function updateDeveloperHitboxDrag(p){
  const entity=developerSelectedEntity();
  if(!devHitboxDrag || !entity) return;
  const limits=developerEntityOffsetLimits(entity);
  const start=devHitboxDrag.hitbox;
  const dx=Math.round(p.x-devHitboxDrag.pointerX);
  const dy=Math.round(p.y-devHitboxDrag.pointerY);
  const minSize=2;
  let left=start.x, top=start.y, right=start.x+start.w, bottom=start.y+start.h;
  const handle=devHitboxDrag.handle;

  if(handle==="move"){
    left=clampDev(start.x+dx,limits.minX,Math.max(limits.minX,limits.maxX-start.w));
    top=clampDev(start.y+dy,limits.minY,Math.max(limits.minY,limits.maxY-start.h));
    right=left+start.w;
    bottom=top+start.h;
  }else{
    if(handle.includes("w")) left=clampDev(start.x+dx,limits.minX,right-minSize);
    if(handle.includes("e")) right=clampDev(start.x+start.w+dx,left+minSize,limits.maxX);
    if(handle.includes("n")) top=clampDev(start.y+dy,limits.minY,bottom-minSize);
    if(handle.includes("s")) bottom=clampDev(start.y+start.h+dy,top+minSize,limits.maxY);
  }

  entity.hitbox={
    x:Math.round(left),
    y:Math.round(top),
    w:Math.max(minSize,Math.round(right-left)),
    h:Math.max(minSize,Math.round(bottom-top))
  };
  rebuildDeveloperEntityCollision(entity);
  refreshDeveloperInspectorValues();
}

function findWorldObjectAt(wx,wy){
  const pad=10;
  const sorted=[...sceneryProps].sort((a,b)=>((b.y+(worldObjectSpec(b)?.h||0))-(a.y+(worldObjectSpec(a)?.h||0))));
  for(const obj of sorted){
    const spec=worldObjectSpec(obj);
    if(!spec) continue;
    if(wx>=obj.x-pad && wx<=obj.x+spec.w+pad && wy>=obj.y-pad && wy<=obj.y+spec.h+pad) return obj;
  }
  return null;
}

function mobTypeScaleKey(mob){
  if(!mob) return null;
  return (mob.boss || mob.kind==="boss") ? "snickers" : mob.kind;
}
function mobTypeScaleLabel(key){
  const labels={slime:"Slime",goblin:"Goblin",wolf:"Wolf",cow:"Cow",pig:"Pig",chicken:"Chicken",snickers:"Snickers"};
  return labels[key]||key||"Mob";
}
function mobTypeFallbackScale(key){
  if(key==="snickers") return VISUAL_SCALE.boss;
  if(["cow","pig","chicken"].includes(key)) return VISUAL_SCALE.passiveMobs;
  return VISUAL_SCALE.hostileMobs;
}
function findDeveloperMobAt(wx,wy){
  let best=null,bestScore=Infinity;
  for(const mob of mobs){
    if(!mob.alive) continue;
    const scale=Math.max(.75,mobVisualScale(mob));
    const rx=(mob.boss?42:30)*scale;
    const ry=(mob.boss?52:38)*scale;
    const dx=Math.abs(wx-mob.x),dy=wy-mob.y;
    if(dx<=rx && dy>=-ry && dy<=ry*.55){
      const score=dx*dx+(dy*.65)*(dy*.65);
      if(score<bestScore){best=mob;bestScore=score;}
    }
  }
  return best;
}
function setDeveloperTab(tab){
  devActiveTab=tab||"objects";
  if(!devPanel) return;
  devPanel.querySelectorAll(".devTab").forEach(b=>b.classList.toggle("active",b.dataset.devTab===devActiveTab));
  devPanel.querySelectorAll(".devView").forEach(v=>v.classList.toggle("active",v.dataset.devView===devActiveTab));
}


function developerWorldPack(){
  return {
    format:"little-realm-world-pack",
    schemaVersion:1,
    build:"v59-leveling-quest-xp",
    exportedAt:new Date().toISOString(),
    worldObjects:sceneryProps.map(cloneWorldObject),
    npcs:sceneryNPCs.map(cloneNpc),
    quests:questDefinitions.map(cloneQuest),
    visualSettings:{...VISUAL_SCALE,mobTypes:{...MOB_TYPE_SCALE}},
    balance:devBalanceClone(BALANCE)
  };
}

function applyDeveloperWorldPack(pack,{quiet=false}={}){
  if(!pack||typeof pack!=="object") throw new Error("World Pack is not an object");
  if(Array.isArray(pack.worldObjects)){
    sceneryProps.splice(0,sceneryProps.length,...pack.worldObjects.map(cloneWorldObject));
    rebuildWorldObjectCollision();
  }
  if(Array.isArray(pack.npcs)){
    sceneryNPCs.splice(0,sceneryNPCs.length,...pack.npcs.map((npc,index)=>normalizeNpcRecord(npc,index)));
    rebuildNpcCollision();
  }
  if(Array.isArray(pack.quests)) replaceQuestDefinitions(pack.quests);
  if(pack.visualSettings&&typeof pack.visualSettings==="object"){
    for(const key of Object.keys(VISUAL_SCALE)) if(Number.isFinite(Number(pack.visualSettings[key]))) VISUAL_SCALE[key]=visualScaleOr(pack.visualSettings[key],VISUAL_SCALE[key]);
    if(pack.visualSettings.mobTypes) for(const key of Object.keys(MOB_TYPE_SCALE)) if(Number.isFinite(Number(pack.visualSettings.mobTypes[key]))) MOB_TYPE_SCALE[key]=visualScaleOr(pack.visualSettings.mobTypes[key],MOB_TYPE_SCALE[key]);
  }
  if(pack.balance&&typeof pack.balance==="object"){
    devReplaceBalance(pack.balance);
    if(typeof refreshMobTemplatesFromBalance==="function") refreshMobTemplatesFromBalance();
    if(typeof refreshAliveMobStatsForPlayer==="function"&&state) refreshAliveMobStatsForPlayer();
  }
  devSelected=null;devSelectedNpc=null;devSelectedMob=null;devSelectedQuestId=questDefinitions[0]?.id||null;devQuestFormDraft=null;
  refreshDeveloperPanel();
  updateUI?.();
  if(!quiet) devSetStatus(`Loaded World Pack • ${sceneryProps.length} props • ${sceneryNPCs.length} NPCs • ${questDefinitions.length} quests`);
}

function saveDeveloperDraft(){
  try{
    localStorage.setItem(DEV_DRAFT_KEY,JSON.stringify(developerWorldPack()));
    devSetStatus("World Builder draft autosaved locally");
  }catch(err){ console.warn("Could not save developer draft",err); }
}

function loadDeveloperDraft(){
  try{
    const raw=localStorage.getItem(DEV_DRAFT_KEY)||localStorage.getItem(DEV_OLD_DRAFT_KEY);
    if(!raw){devSetStatus("No local draft found");return;}
    const parsed=JSON.parse(raw);
    if(Array.isArray(parsed)){
      // v1 migration: the original editor stored world objects only.
      sceneryProps.splice(0,sceneryProps.length,...parsed.map(cloneWorldObject));
      rebuildWorldObjectCollision();
      devSelected=null;
      refreshDeveloperPanel();
      devSetStatus(`Loaded legacy draft with ${sceneryProps.length} objects`);
      return;
    }
    applyDeveloperWorldPack(parsed);
  }catch(err){
    console.error(err); devSetStatus("Draft could not be loaded");
  }
}

function resetDeveloperLayout(){
  if(!confirm("Reset the live prop layout to config/world-objects.js? Your local World Pack draft will remain until you overwrite it.")) return;
  sceneryProps.splice(0,sceneryProps.length,...getProjectWorldObjects());
  devSelected=null;
  rebuildWorldObjectCollision();
  refreshDeveloperPanel();
  devSetStatus("Project prop layout restored");
}

function resetDeveloperProject(){
  if(!confirm("Reset props, NPCs, quests, visual settings, and combat tuning to the deployed project files?")) return;
  sceneryProps.splice(0,sceneryProps.length,...getProjectWorldObjects());
  sceneryNPCs.splice(0,sceneryNPCs.length,...getProjectNPCs());
  replaceQuestDefinitions(PROJECT_QUESTS);
  Object.assign(VISUAL_SCALE,PROJECT_VISUAL_SCALE);
  Object.assign(MOB_TYPE_SCALE,PROJECT_MOB_TYPE_SCALE);
  devReplaceBalance(DEV_PROJECT_BALANCE);
  refreshMobTemplatesFromBalance();
  if(state) refreshAliveMobStatsForPlayer();
  rebuildWorldObjectCollision();rebuildNpcCollision();
  devSelected=null;devSelectedNpc=null;devSelectedMob=null;devSelectedQuestId=questDefinitions[0]?.id||null;devQuestFormDraft=null;
  refreshDeveloperPanel();updateUI();
  devSetStatus("Deployed project content restored");
}

function downloadDeveloperText(filename,text,type="application/json"){
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function exportDeveloperLayout(){
  const clean=sceneryProps.map(cloneWorldObject);
  downloadDeveloperText("world-objects.js",`/* Exported from Little Realm World Builder */\nwindow.LR_WORLD_OBJECTS = ${JSON.stringify(clean,null,2)};\n`,"text/javascript");
  devSetStatus("Exported world-objects.js");
}

function exportDeveloperNpcs(){
  downloadDeveloperText("npcs.js",`/* Exported from Little Realm World Builder */\nwindow.LR_NPCS = ${JSON.stringify(sceneryNPCs.map(cloneNpc),null,2)};\n`,"text/javascript");
  devSetStatus("Exported npcs.js");
}

function exportDeveloperQuests(){
  downloadDeveloperText("quests.js",`/* Exported from Little Realm World Builder */\nwindow.LR_QUESTS = ${JSON.stringify(questDefinitions.map(cloneQuest),null,2)};\n`,"text/javascript");
  devSetStatus("Exported quests.js");
}

function exportDeveloperWorldPack(){
  downloadDeveloperText("little-realm-world-pack.json",JSON.stringify(developerWorldPack(),null,2));
  devSetStatus("Exported one World Pack — upload this file when you want the project updated");
}

function importDeveloperWorldPackFile(file){
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(String(reader.result||""));
      applyDeveloperWorldPack(parsed);
      saveDeveloperDraft();
    }catch(err){console.error(err);devSetStatus("World Pack import failed — invalid JSON");}
  };
  reader.readAsText(file);
}

function devSetStatus(text){
  if(!devPanel) return;
  const el=devPanel.querySelector("#devStatus");
  if(el) el.textContent=text;
  clearTimeout(devStatusTimer);
  devStatusTimer=setTimeout(()=>{if(el)el.textContent="F2 toggles World Builder";},2200);
}

function developerNpcTemplate(kind){
  if(kind==="lilly") return {name:"Lilly",role:"Villager",sprite:"./assets/npcs/lilly.png",displayHeight:58,greeting:"Hello!"};
  if(kind==="jorge") return {name:"Jorge",role:"Villager",sprite:"./assets/npcs/jorge.png",displayHeight:58,greeting:"Good to see you."};
  return {name:"New NPC",role:"Villager",sprite:NPC_PLACEHOLDER_SPRITE,displayHeight:58,greeting:"Hello there."};
}

function uniqueNpcId(base="npc"){
  const root=String(base||"npc").toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"")||"npc";
  let id=root,n=2;
  while(sceneryNPCs.some(npc=>npc.id===id)){id=`${root}-${n++}`;}
  return id;
}

function placeDeveloperNpc(kind,wx,wy){
  const template=developerNpcTemplate(kind);
  const npc=normalizeNpcRecord({
    ...template,
    id:uniqueNpcId(template.name),
    x:snapDev(wx),
    y:snapDev(wy),
    facing:"down",
    solid:true
  },sceneryNPCs.length);
  sceneryNPCs.push(npc);
  rebuildNpcCollision();
  devSelectedNpc=npc;devSelected=null;devSelectedMob=null;devPlaceNpcTemplate=null;
  setDeveloperTab("selection");
  saveDeveloperDraft();refreshDeveloperPanel();
  devSetStatus(`Placed ${npc.name} — visual size, hitbox, and depth can be edited in Selection`);
}

function findDeveloperNpcAt(wx,wy){
  return findNpcAtWorld(wx,wy);
}

function placeDeveloperObject(type,wx,wy){
  const spec=worldObjectSpec({type});
  if(!spec) return;
  const obj=defaultWorldObject(type,snapDev(wx-spec.w/2),snapDev(wy-spec.h/2));
  sceneryProps.push(obj);
  devSelected=obj;
  devSelectedMob=null;devSelectedNpc=null;
  setDeveloperTab("selection");
  rebuildWorldObjectCollision();
  saveDeveloperDraft();
  refreshDeveloperPanel();
}

function devPointerDown(event){
  if(!devModeActive) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const p=devWorldFromPointer(event);
  if(devPlaceNpcTemplate){
    placeDeveloperNpc(devPlaceNpcTemplate,p.x,p.y);
    return;
  }
  if(devPlaceType){
    placeDeveloperObject(devPlaceType,p.x,p.y);
    return;
  }

  if(findDeveloperDepthInteraction(p.x,p.y)){
    const entity=developerSelectedEntity();
    const depth=ensureDeveloperDepth(entity);
    devDragging=false;devNpcDragging=false;
    devDepthDrag={pointerY:p.y,depthY:depth.y};
    if(game?.style) game.style.cursor="ns-resize";
    try{ game.setPointerCapture?.(event.pointerId); }catch{}
    devSetStatus("Moving depth line — release to save");
    return;
  }

  const hitboxInteraction=findDeveloperHitboxInteraction(p.x,p.y);
  if(hitboxInteraction){
    const entity=developerSelectedEntity();
    const hb=ensureDeveloperHitbox(entity);
    devDragging=false;devNpcDragging=false;
    devHitboxDrag={
      handle:hitboxInteraction,
      pointerX:p.x,
      pointerY:p.y,
      hitbox:{x:hb.x,y:hb.y,w:hb.w,h:hb.h}
    };
    if(game?.style) game.style.cursor=developerHitboxCursor(hitboxInteraction);
    try{ game.setPointerCapture?.(event.pointerId); }catch{}
    devSetStatus(hitboxInteraction==="move"?"Moving hitbox — release to save":"Resizing hitbox — release to save");
    return;
  }

  const npc=findDeveloperNpcAt(p.x,p.y);
  if(npc){
    devSelectedNpc=npc;
    devSelected=null;devSelectedMob=null;
    setDeveloperTab("selection");
    if(devHitboxEditing){
      ensureDeveloperHitbox(npc);
      devNpcDragging=false;
      devSetStatus(`Selected ${npc.name} — drag the yellow NPC hitbox or its handles`);
    }else if(devDepthEditing && npcDepthMode(npc)==="ysort"){
      ensureDeveloperDepth(npc);
      devNpcDragging=false;
      devSetStatus(`Selected ${npc.name} — drag the purple NPC depth line`);
    }else{
      devNpcDragging=true;
      devNpcDragOffset={x:p.x-npc.x,y:p.y-npc.y};
      try{ game.setPointerCapture?.(event.pointerId); }catch{}
      devSetStatus(`Selected ${npc.name} — drag to move; Selection has size, hitbox, and depth tools`);
    }
    refreshDeveloperPanel();
    return;
  }

  const mob=findDeveloperMobAt(p.x,p.y);
  if(mob){
    devSelectedMob=mob;
    devSelected=null;devSelectedNpc=null;
    devDragging=false;devNpcDragging=false;
    devHitboxEditing=false;
    devHitboxDrag=null;
    devDepthEditing=false;
    devDepthDrag=null;
    devCombatMobType=mobTypeScaleKey(mob);
    if(devActiveTab!=="combat") setDeveloperTab("scale");
    refreshDeveloperPanel();
    if(devActiveTab==="combat") devSetStatus(`${mobTypeScaleLabel(devCombatMobType)} selected — combat tuning now targets this species`);
    else devSetStatus(`${mobTypeScaleLabel(devCombatMobType)} selected — scale changes affect every ${mobTypeScaleLabel(devCombatMobType).toLowerCase()}`);
    return;
  }

  devSelectedMob=null;devSelectedNpc=null;
  devSelected=findWorldObjectAt(p.x,p.y);
  if(devSelected){
    setDeveloperTab("selection");
    if(devHitboxEditing){
      ensureDeveloperHitbox(devSelected);
      devDragging=false;
      devSetStatus(`Selected ${devSelected.label||devSelected.type} — drag the yellow hitbox or its handles`);
    }else if(devDepthEditing && worldObjectDepthMode(devSelected)==="ysort"){
      ensureDeveloperDepth(devSelected);
      devDragging=false;
      devSetStatus(`Selected ${devSelected.label||devSelected.type} — drag the purple depth line`);
    }else{
      devDragging=true;
      devDragOffset={x:p.x-devSelected.x,y:p.y-devSelected.y};
      try{ game.setPointerCapture?.(event.pointerId); }catch{}
      devSetStatus(`Selected ${devSelected.label||devSelected.type} — drag to move`);
    }
  }else{
    devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;
    devSetStatus("Nothing selected — choose a prop/NPC from Selection or place one from its palette");
  }
  refreshDeveloperPanel();
}
function devPointerMove(event){
  if(!devModeActive) return;
  const p=devWorldFromPointer(event);

  if(devNpcDragging && devSelectedNpc){
    event.preventDefault();event.stopImmediatePropagation();
    devSelectedNpc.x=snapDev(p.x-devNpcDragOffset.x);
    devSelectedNpc.y=snapDev(p.y-devNpcDragOffset.y);
    rebuildNpcCollision();
    refreshDeveloperInspectorValues();
    refreshDeveloperNpcInspectorValues();
    return;
  }

  if(devHitboxDrag && developerSelectedEntity()){
    event.preventDefault(); event.stopImmediatePropagation();
    updateDeveloperHitboxDrag(p);
    return;
  }

  if(devDepthDrag && developerSelectedEntity()){
    event.preventDefault(); event.stopImmediatePropagation();
    updateDeveloperDepthDrag(p);
    return;
  }

  if(devDepthEditing && developerSelectedEntity() && game?.style){
    game.style.cursor=findDeveloperDepthInteraction(p.x,p.y)?"ns-resize":"";
  }else if(devHitboxEditing && developerSelectedEntity() && game?.style){
    game.style.cursor=developerHitboxCursor(findDeveloperHitboxInteraction(p.x,p.y));
  }else if(game?.style && !devDragging && !devNpcDragging){
    game.style.cursor="";
  }

  if(!devDragging || !devSelected) return;
  event.preventDefault(); event.stopImmediatePropagation();
  devSelected.x=snapDev(p.x-devDragOffset.x);
  devSelected.y=snapDev(p.y-devDragOffset.y);
  rebuildWorldObjectCollision();
  refreshDeveloperInspectorValues();
}
function devPointerUp(event){
  if(!devModeActive || (!devDragging && !devNpcDragging && !devHitboxDrag && !devDepthDrag)) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const finishedNpc=!!devNpcDragging;
  devDragging=false;devNpcDragging=false;
  const finishedHitbox=!!devHitboxDrag;
  const finishedDepth=!!devDepthDrag;
  devHitboxDrag=null;
  devDepthDrag=null;
  try{ game.releasePointerCapture?.(event.pointerId); }catch{}
  saveDeveloperDraft();
  if(finishedNpc) devSetStatus("NPC position updated");
  else if(finishedHitbox) devSetStatus("Hitbox updated — keep dragging handles or click Finish Hitbox Editing");
  else if(finishedDepth) devSetStatus("Depth line updated — move around the NPC/object to test overlap");
}

function drawDeveloperSelectedEntityOverlay(entity,camX,camY){
  if(!entity) return;
  const b=developerEntityBounds(entity);
  const x=b.x-camX,y=b.y-camY;
  ctx.strokeStyle="#63e6ff";
  ctx.fillStyle="rgba(99,230,255,.05)";
  ctx.lineWidth=2/CAMERA_ZOOM;
  ctx.fillRect(x-2,y-2,b.w+4,b.h+4);
  ctx.strokeRect(x-2,y-2,b.w+4,b.h+4);

  if(devHitboxEditing){
    const hb=ensureDeveloperHitbox(entity);
    const hx=entity.x+hb.x-camX, hy=entity.y+hb.y-camY;
    ctx.fillStyle="rgba(255,209,102,.13)";
    ctx.strokeStyle="#ffd166";
    ctx.lineWidth=2/CAMERA_ZOOM;
    ctx.fillRect(hx,hy,hb.w,hb.h);
    ctx.strokeRect(hx,hy,hb.w,hb.h);

    const handleSize=7/CAMERA_ZOOM;
    const half=handleSize/2;
    const points=[
      [hx,hy],[hx+hb.w/2,hy],[hx+hb.w,hy],
      [hx,hy+hb.h/2],[hx+hb.w,hy+hb.h/2],
      [hx,hy+hb.h],[hx+hb.w/2,hy+hb.h],[hx+hb.w,hy+hb.h]
    ];
    ctx.fillStyle="#fff3c4";
    ctx.strokeStyle="#8a6817";
    ctx.lineWidth=1/CAMERA_ZOOM;
    for(const [px,py] of points){
      ctx.fillRect(px-half,py-half,handleSize,handleSize);
      ctx.strokeRect(px-half,py-half,handleSize,handleSize);
    }
  }

  if(devDepthEditing && developerEntityDepthMode(entity)==="ysort"){
    const depth=ensureDeveloperDepth(entity);
    const lineY=entity.y+depth.y-camY;
    ctx.strokeStyle="#d58cff";
    ctx.fillStyle="#f2d7ff";
    ctx.lineWidth=2/CAMERA_ZOOM;
    ctx.beginPath();ctx.moveTo(x-8,lineY);ctx.lineTo(x+b.w+8,lineY);ctx.stroke();
    const r=5/CAMERA_ZOOM;
    const cx=x+b.w/2;
    ctx.beginPath();
    ctx.moveTo(cx,lineY-r);ctx.lineTo(cx+r,lineY);ctx.lineTo(cx,lineY+r);ctx.lineTo(cx-r,lineY);ctx.closePath();ctx.fill();
    ctx.font=`${Math.max(7,9/CAMERA_ZOOM)}px system-ui`;
    ctx.fillStyle="#f2d7ff";
    ctx.fillText("DEPTH",x+b.w+10,lineY-2/CAMERA_ZOOM);
  }

  if(developerIsNpc(entity)){
    ctx.font="800 9px system-ui";ctx.textAlign="center";ctx.fillStyle="#dffbff";
    ctx.fillText(entity.name,entity.x-camX,y-7);ctx.textAlign="start";
  }
}

function drawDeveloperOverlay(camX,camY,viewW,viewH){
  ctx.save();
  ctx.lineWidth=1/CAMERA_ZOOM;
  if(devShowGrid){
    ctx.strokeStyle="rgba(255,255,255,.10)";
    const step=devSnap;
    const startX=Math.floor(camX/step)*step;
    const startY=Math.floor(camY/step)*step;
    ctx.beginPath();
    for(let wx=startX;wx<camX+viewW;wx+=step){const x=wx-camX;ctx.moveTo(x,0);ctx.lineTo(x,viewH);}
    for(let wy=startY;wy<camY+viewH;wy+=step){const y=wy-camY;ctx.moveTo(0,y);ctx.lineTo(viewW,y);}
    ctx.stroke();
  }
  if(devShowHitboxes){
    for(const obj of sceneryProps){
      if(!obj.solid || !obj.hitbox) continue;
      const hb=obj.hitbox;
      ctx.fillStyle="rgba(255,75,75,.12)";
      ctx.strokeStyle="rgba(255,90,90,.8)";
      const x=obj.x+hb.x-camX,y=obj.y+hb.y-camY;
      ctx.fillRect(x,y,hb.w,hb.h);ctx.strokeRect(x,y,hb.w,hb.h);
    }
    for(const npc of sceneryNPCs){
      if(npc.solid===false || !npc.hitbox) continue;
      const hb=npc.hitbox;
      ctx.fillStyle="rgba(255,75,75,.12)";
      ctx.strokeStyle="rgba(255,90,90,.8)";
      const x=npc.x+hb.x-camX,y=npc.y+hb.y-camY;
      ctx.fillRect(x,y,hb.w,hb.h);ctx.strokeRect(x,y,hb.w,hb.h);
    }
  }
  if(devShowDepthLines){
    for(const obj of sceneryProps){
      if(worldObjectDepthMode(obj)!=="ysort") continue;
      const spec=worldObjectSpec(obj);
      if(!spec) continue;
      const y=obj.y+worldObjectDepthY(obj)-camY;
      const x=obj.x-camX;
      ctx.strokeStyle=obj===devSelected?"rgba(213,140,255,.95)":"rgba(213,140,255,.32)";
      ctx.lineWidth=(obj===devSelected?1.7:1)/CAMERA_ZOOM;
      ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x+spec.w+3,y);ctx.stroke();
    }
    for(const npc of sceneryNPCs){
      if(npcDepthMode(npc)!=="ysort") continue;
      const b=npcVisualBounds(npc);
      const y=npc.y+npcDepthY(npc)-camY;
      const x=b.x-camX;
      ctx.strokeStyle=npc===devSelectedNpc?"rgba(213,140,255,.95)":"rgba(213,140,255,.32)";
      ctx.lineWidth=(npc===devSelectedNpc?1.7:1)/CAMERA_ZOOM;
      ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x+b.w+3,y);ctx.stroke();
    }
  }
  drawDeveloperSelectedEntityOverlay(developerSelectedEntity(),camX,camY);
  if(devSelectedMob && devSelectedMob.alive){
    const x=devSelectedMob.x-camX,y=devSelectedMob.y-camY;
    const scale=mobVisualScale(devSelectedMob);
    ctx.strokeStyle="#63e6ff";
    ctx.fillStyle="rgba(99,230,255,.10)";
    ctx.lineWidth=2/CAMERA_ZOOM;
    ctx.beginPath();ctx.ellipse(x,y+8,(devSelectedMob.boss?28:20)*scale,(devSelectedMob.boss?13:9)*scale,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.font="800 10px system-ui";ctx.textAlign="center";ctx.fillStyle="#dffbff";
    ctx.fillText(`${mobTypeScaleLabel(mobTypeScaleKey(devSelectedMob))} ${scale.toFixed(2)}×`,x,y-(devSelectedMob.boss?44:34)*scale);
    ctx.textAlign="start";
  }
  ctx.restore();
}

function deleteDeveloperSelection(){
  if(!devSelected) return;
  const i=sceneryProps.indexOf(devSelected);
  if(i>=0) sceneryProps.splice(i,1);
  devSelected=null;
  devHitboxEditing=false;
  devHitboxDrag=null;
  devDepthEditing=false;
  devDepthDrag=null;
  rebuildWorldObjectCollision();
  saveDeveloperDraft();
  refreshDeveloperPanel();
}
function duplicateDeveloperSelection(){
  if(!devSelected) return;
  const copy=cloneWorldObject(devSelected);
  copy.id=`${copy.type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
  copy.x+=devSnap*2;copy.y+=devSnap*2;
  sceneryProps.push(copy);devSelected=copy;
  rebuildWorldObjectCollision();saveDeveloperDraft();refreshDeveloperPanel();
}

function applyDeveloperInspector(){
  if(!devPanel||!devSelected) return;
  const q=id=>devPanel.querySelector(`#${id}`);
  devSelected.x=numberOr(q("devX").value,devSelected.x);
  devSelected.y=numberOr(q("devY").value,devSelected.y);
  devSelected.label=q("devLabel").value.trim()||devSelected.type;
  devSelected.solid=q("devSolid").checked;
  devSelected.interactable=q("devInteractable").checked;
  devSelected.container=q("devContainer").checked;
  devSelected.capacity=Math.max(0,Math.round(numberOr(q("devCapacity").value,8)));
  devSelected.hitbox=devSelected.hitbox||{};
  devSelected.hitbox.x=numberOr(q("devHbX").value,0);
  devSelected.hitbox.y=numberOr(q("devHbY").value,0);
  devSelected.hitbox.w=Math.max(1,numberOr(q("devHbW").value,16));
  devSelected.hitbox.h=Math.max(1,numberOr(q("devHbH").value,12));
  devSelected.depthMode=WORLD_OBJECT_DEPTH_MODES.has(q("devDepthMode")?.value)?q("devDepthMode").value:"ysort";
  devSelected.depthY=numberOr(q("devDepthY")?.value,defaultWorldObjectDepthY(devSelected));
  if(devSelected.depthMode!=="ysort"){ devDepthEditing=false; devDepthDrag=null; }
  rebuildWorldObjectCollision();
  saveDeveloperDraft();
  refreshDeveloperPanel(false);
}

function applyDeveloperNpcVisualInspector(){
  if(!devPanel||!devSelectedNpc) return;
  const q=id=>devPanel.querySelector(`#${id}`);
  devSelectedNpc.x=numberOr(q("devX")?.value,devSelectedNpc.x);
  devSelectedNpc.y=numberOr(q("devY")?.value,devSelectedNpc.y);
  devSelectedNpc.sprite=q("devNpcSelectionSprite")?.value||NPC_PLACEHOLDER_SPRITE;
  devSelectedNpc.facing=q("devNpcSelectionFacing")?.value||devSelectedNpc.facing||"down";
  devSelectedNpc.displayHeight=Math.max(24,numberOr(q("devNpcSelectionHeight")?.value,devSelectedNpc.displayHeight));
  devSelectedNpc.solid=!!q("devSolid")?.checked;
  devSelectedNpc.hitbox=devSelectedNpc.hitbox||{};
  devSelectedNpc.hitbox.x=numberOr(q("devHbX")?.value,-6);
  devSelectedNpc.hitbox.y=numberOr(q("devHbY")?.value,-7);
  devSelectedNpc.hitbox.w=Math.max(2,numberOr(q("devHbW")?.value,12));
  devSelectedNpc.hitbox.h=Math.max(2,numberOr(q("devHbH")?.value,14));
  devSelectedNpc.depthMode=WORLD_OBJECT_DEPTH_MODES.has(q("devDepthMode")?.value)?q("devDepthMode").value:"ysort";
  devSelectedNpc.depthY=numberOr(q("devDepthY")?.value,defaultNpcDepthY(devSelectedNpc));
  if(devSelectedNpc.depthMode!=="ysort"){devDepthEditing=false;devDepthDrag=null;}
  rebuildNpcCollision();
  saveDeveloperDraft();
  refreshDeveloperPanel(false);
  devSetStatus(`Applied visual settings for ${devSelectedNpc.name}`);
}

function refreshDeveloperInspectorValues(){
  if(!devPanel) return;
  const entity=developerSelectedEntity();
  if(!entity) return;
  const q=id=>devPanel.querySelector(`#${id}`);
  if(q("devX")) q("devX").value=Math.round(entity.x);
  if(q("devY")) q("devY").value=Math.round(entity.y);
  const hb=ensureDeveloperHitbox(entity);
  if(q("devHbX")) q("devHbX").value=Math.round(hb.x);
  if(q("devHbY")) q("devHbY").value=Math.round(hb.y);
  if(q("devHbW")) q("devHbW").value=Math.round(hb.w);
  if(q("devHbH")) q("devHbH").value=Math.round(hb.h);
  const depth=ensureDeveloperDepth(entity);
  if(q("devDepthMode")) q("devDepthMode").value=depth.mode;
  if(q("devDepthY")) q("devDepthY").value=Math.round(depth.y);
  if(developerIsNpc(entity)){
    if(q("devNpcSelectionHeight")) q("devNpcSelectionHeight").value=Math.round(entity.displayHeight);
    if(q("devNpcSelectionSprite")) q("devNpcSelectionSprite").value=entity.sprite||NPC_PLACEHOLDER_SPRITE;
    if(q("devNpcSelectionFacing")) q("devNpcSelectionFacing").value=entity.facing||"down";
  }
}

function drawPaletteThumb(canvas,type){
  if(!canvas) return;
  const c=canvas.getContext("2d");
  c.clearRect(0,0,48,48); c.imageSmoothingEnabled=false;
  if(type==="caveEntrance"){
    c.fillStyle="#6f5a48"; c.fillRect(7,9,34,8);
    c.fillStyle="#7c6653"; c.fillRect(4,15,7,13); c.fillRect(37,15,7,13);
    c.fillStyle="#121013"; c.fillRect(12,16,24,18);
    c.fillStyle="#1f1a20"; c.fillRect(15,19,18,13);
    c.fillStyle="#85705d"; c.fillRect(9,31,30,5);
    return;
  }
  const spec=PROP_SPECS[type];
  if(!spec||!propAtlasReady) return;
  const sx=Number.isFinite(spec.sx)?spec.sx:spec.col*PROP_ATLAS_CELL;
  const sy=Number.isFinite(spec.sy)?spec.sy:spec.row*PROP_ATLAS_CELL;
  const sw=Number.isFinite(spec.sw)?spec.sw:PROP_ATLAS_CELL;
  const sh=Number.isFinite(spec.sh)?spec.sh:PROP_ATLAS_CELL;
  const scale=Math.min(44/sw,44/sh);
  const dw=Math.max(1,Math.round(sw*scale)), dh=Math.max(1,Math.round(sh*scale));
  c.drawImage(propAtlas,sx,sy,sw,sh,Math.round((48-dw)/2),Math.round((48-dh)/2),dw,dh);
}

function refreshDeveloperObjectList(){
  if(!devPanel) return;
  const list=devPanel.querySelector("#devObjectList");
  const count=devPanel.querySelector("#devObjectCount");
  if(count) count.textContent=`${sceneryProps.length} placed`;
  if(!list) return;
  list.innerHTML="";
  for(const obj of sceneryProps){
    const b=document.createElement("button");
    b.className="devObjectChip"+(obj===devSelected?" active":"");
    b.textContent=obj.label||obj.type;
    b.title=`${obj.type} @ ${Math.round(obj.x)}, ${Math.round(obj.y)}`;
    b.onclick=()=>{
      devPlaceType=null;devPlaceNpcTemplate=null;
      devSelectedMob=null;devSelectedNpc=null;
      devSelected=obj;
      setDeveloperTab("selection");
      updateDevPaletteActive();
      refreshDeveloperPanel();
      devSetStatus(`Selected ${obj.label||obj.type}`);
    };
    list.appendChild(b);
  }
}

function refreshDeveloperSelectionList(){
  if(!devPanel) return;
  const list=devPanel.querySelector("#devSelectionList");
  const count=devPanel.querySelector("#devSelectionCount");
  if(count) count.textContent=`${sceneryProps.length} props • ${sceneryNPCs.length} NPCs`;
  if(!list) return;
  list.innerHTML="";
  for(const npc of sceneryNPCs){
    const b=document.createElement("button");
    b.className="devObjectChip"+(npc===devSelectedNpc?" active":"");
    b.textContent=`NPC • ${npc.name}`;
    b.title=`${npc.role||"NPC"} @ ${Math.round(npc.x)}, ${Math.round(npc.y)}`;
    b.onclick=()=>{
      devPlaceType=null;devPlaceNpcTemplate=null;devSelectedMob=null;devSelected=null;devSelectedNpc=npc;
      devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;
      setDeveloperTab("selection");updateDevPaletteActive();refreshDeveloperPanel();
      devSetStatus(`Selected NPC ${npc.name} — visual size, hitbox, and depth are editable here`);
    };
    list.appendChild(b);
  }
  for(const obj of sceneryProps){
    const b=document.createElement("button");
    b.className="devObjectChip"+(obj===devSelected?" active":"");
    b.textContent=`PROP • ${obj.label||obj.type}`;
    b.title=`${obj.type} @ ${Math.round(obj.x)}, ${Math.round(obj.y)}`;
    b.onclick=()=>{
      devPlaceType=null;devPlaceNpcTemplate=null;devSelectedMob=null;devSelectedNpc=null;devSelected=obj;
      devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;
      setDeveloperTab("selection");updateDevPaletteActive();refreshDeveloperPanel();
      devSetStatus(`Selected ${obj.label||obj.type}`);
    };
    list.appendChild(b);
  }
}

function refreshDeveloperPanel(rebuild=true){
  if(!devPanel) return;
  if(!rebuild){ refreshDeveloperInspectorValues(); return; }
  const inspector=devPanel.querySelector("#devInspector");
  if(!inspector) return;
  refreshDeveloperObjectList();
  refreshDeveloperSelectionList();
  refreshDeveloperNpcPanel();
  refreshDeveloperQuestPanel();
  refreshDeveloperProjectPanel();
  refreshDeveloperMobPanel();
  refreshDeveloperCombatPanel();

  const entity=developerSelectedEntity();
  if(!entity){
    inspector.innerHTML='<div class="devEmpty">Choose a prop or NPC from the Selection Library, or click one directly in the world.</div>';
    return;
  }

  const hb=ensureDeveloperHitbox(entity);
  const depth=ensureDeveloperDepth(entity);
  const canEditDepth=depth.mode==="ysort";

  if(developerIsNpc(entity)){
    const npc=entity;
    const spriteChoices=[
      [NPC_PLACEHOLDER_SPRITE,"Placeholder model"],
      ["./assets/npcs/lilly.png","Lilly model"],
      ["./assets/npcs/jorge.png","Jorge model"]
    ];
    if(npc.sprite&&!spriteChoices.some(([v])=>v===npc.sprite)) spriteChoices.push([npc.sprite,"Current custom sprite"]);
    inspector.innerHTML=`
      <div class="devSelectedTitle">NPC • ${questEscape(npc.name)}</div>
      <div class="devHint">Visual placement tools for NPCs. Use the NPCs tab for ID, role, greeting, and quest setup.</div>
      <div class="devPair"><label>X<input id="devX" type="number" value="${Math.round(npc.x)}"></label><label>Y<input id="devY" type="number" value="${Math.round(npc.y)}"></label></div>
      <div class="devPair"><label>Model<select id="devNpcSelectionSprite">${spriteChoices.map(([v,l])=>`<option value="${questEscape(v)}" ${v===npc.sprite?"selected":""}>${questEscape(l)}</option>`).join("")}</select></label><label>Facing<select id="devNpcSelectionFacing">${["down","left","right","up"].map(v=>`<option value="${v}" ${v===npc.facing?"selected":""}>${v}</option>`).join("")}</select></label></div>
      <label>Sprite Height<input id="devNpcSelectionHeight" type="number" min="24" value="${Math.round(npc.displayHeight)}"></label>
      <div class="devHint">Sprite Height updates live. The placeholder now uses the same sprite-sheet rendering path as Lilly and Jorge.</div>
      <div class="devChecks"><label><input id="devSolid" type="checkbox" ${npc.solid!==false?"checked":""}> Hitbox / Solid</label></div>
      <div class="devSubhead">NPC collision hitbox</div>
      <div class="devQuad"><label>X<input id="devHbX" type="number" value="${hb.x}"></label><label>Y<input id="devHbY" type="number" value="${hb.y}"></label><label>W<input id="devHbW" type="number" value="${hb.w}"></label><label>H<input id="devHbH" type="number" value="${hb.h}"></label></div>
      <button id="devEditHitbox" class="devHitboxEditButton${devHitboxEditing?" active":""}">${devHitboxEditing?"Finish Hitbox Editing":"Edit NPC Hitbox Visually"}</button>
      <div class="devHitboxEditHelp">${devHitboxEditing?"Drag inside the yellow NPC hitbox to move it. Drag its corners/sides to resize it.":"NPC hitboxes are now editable with the same visual handles used by world props."}</div>
      <div class="devSubhead">NPC overlap / depth</div>
      <label>Depth Mode<select id="devDepthMode"><option value="ysort" ${depth.mode==="ysort"?"selected":""}>Y-Sort (recommended)</option><option value="behind" ${depth.mode==="behind"?"selected":""}>Always Behind Player</option><option value="front" ${depth.mode==="front"?"selected":""}>Always In Front of Player</option><option value="ground" ${depth.mode==="ground"?"selected":""}>Ground / Background</option></select></label>
      <label>Depth line Y offset<input id="devDepthY" type="number" value="${Math.round(depth.y)}" ${canEditDepth?"":"disabled"}></label>
      <button id="devEditDepth" class="devDepthEditButton${devDepthEditing?" active":""}" ${canEditDepth?"":"disabled"}>${devDepthEditing?"Finish Depth Editing":"Edit NPC Depth Line Visually"}</button>
      <div class="devDepthEditHelp">${canEditDepth?(devDepthEditing?"Drag the purple line up/down to decide when the NPC sorts behind or in front of houses, props, and the player.":"Use this to fix overlaps like an NPC appearing on the wrong side of a house wall. Move the line until the NPC sorts naturally from its feet."):"This fixed mode ignores the depth line. Switch to Y-Sort for a draggable overlap anchor."}</div>
      <div class="devRow"><button id="devApply">Apply</button><button id="devNpcDetails">NPC Details</button><button id="devDuplicate">Duplicate</button><button id="devDelete" class="danger">Delete</button></div>`;

    inspector.querySelector("#devEditHitbox").onclick=()=>setDeveloperHitboxEditing(!devHitboxEditing);
    inspector.querySelector("#devEditDepth").onclick=()=>setDeveloperDepthEditing(!devDepthEditing);
    inspector.querySelector("#devDepthMode").onchange=e=>{
      npc.depthMode=e.target.value;
      if(npc.depthMode!=="ysort"){devDepthEditing=false;devDepthDrag=null;} else ensureDeveloperDepth(npc);
      saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`NPC depth mode: ${e.target.options[e.target.selectedIndex].text}`);
    };
    const liveHeight=inspector.querySelector("#devNpcSelectionHeight");
    liveHeight.oninput=e=>{npc.displayHeight=Math.max(24,numberOr(e.target.value,npc.displayHeight));rebuildNpcCollision();};
    liveHeight.onchange=()=>saveDeveloperDraft();
    inspector.querySelector("#devNpcSelectionSprite").onchange=e=>{npc.sprite=e.target.value||NPC_PLACEHOLDER_SPRITE;saveDeveloperDraft();};
    inspector.querySelector("#devNpcSelectionFacing").onchange=e=>{npc.facing=e.target.value||"down";saveDeveloperDraft();};
    inspector.querySelector("#devApply").onclick=applyDeveloperNpcVisualInspector;
    inspector.querySelector("#devNpcDetails").onclick=()=>{setDeveloperTab("npcs");refreshDeveloperPanel();devSetStatus(`Editing ${npc.name} NPC details`);};
    inspector.querySelector("#devDuplicate").onclick=duplicateDeveloperNpc;
    inspector.querySelector("#devDelete").onclick=deleteDeveloperNpc;
    return;
  }

  const obj=entity;
  inspector.innerHTML=`
    <div class="devSelectedTitle">${obj.type}</div>
    <label>Label<input id="devLabel" value="${String(obj.label||obj.type).replace(/"/g,"&quot;")}"></label>
    <div class="devPair"><label>X<input id="devX" type="number" value="${Math.round(obj.x)}"></label><label>Y<input id="devY" type="number" value="${Math.round(obj.y)}"></label></div>
    <div class="devChecks"><label><input id="devSolid" type="checkbox" ${obj.solid?"checked":""}> Hitbox / Solid</label><label><input id="devInteractable" type="checkbox" ${obj.interactable?"checked":""}> Interactable</label><label><input id="devContainer" type="checkbox" ${obj.container?"checked":""}> Container</label></div>
    <div class="devSubhead">Hitbox offset / size</div>
    <div class="devQuad"><label>X<input id="devHbX" type="number" value="${hb.x}"></label><label>Y<input id="devHbY" type="number" value="${hb.y}"></label><label>W<input id="devHbW" type="number" value="${hb.w}"></label><label>H<input id="devHbH" type="number" value="${hb.h}"></label></div>
    <button id="devEditHitbox" class="devHitboxEditButton${devHitboxEditing?" active":""}">${devHitboxEditing?"Finish Hitbox Editing":"Edit Hitbox Visually"}</button>
    <div class="devHitboxEditHelp">${devHitboxEditing?"Drag inside the yellow hitbox to move it. Drag any corner or side handle to resize it. Hitbox editing is pixel-precise and does not use the world-placement Snap setting.":"Use the visual editor instead of typing coordinates. The numeric fields stay available for exact values."}</div>
    <div class="devSubhead">Player overlap / depth</div>
    <label>Depth Mode<select id="devDepthMode"><option value="ysort" ${depth.mode==="ysort"?"selected":""}>Y-Sort (recommended)</option><option value="behind" ${depth.mode==="behind"?"selected":""}>Always Behind Player</option><option value="front" ${depth.mode==="front"?"selected":""}>Always In Front of Player</option><option value="ground" ${depth.mode==="ground"?"selected":""}>Ground / Floor</option></select></label>
    <label>Depth line Y offset<input id="devDepthY" type="number" value="${Math.round(depth.y)}" ${canEditDepth?"":"disabled"}></label>
    <button id="devEditDepth" class="devDepthEditButton${devDepthEditing?" active":""}" ${canEditDepth?"":"disabled"}>${devDepthEditing?"Finish Depth Editing":"Edit Depth Line Visually"}</button>
    <div class="devDepthEditHelp">${canEditDepth?(devDepthEditing?"Drag the purple line up or down. Unlike the hitbox, the depth line can move outside the blue sprite box. Player feet above the line draw behind the object; feet below the line draw in front.":"Y-Sort compares the player's feet with this purple line. Use the fixed Behind/Front modes only when an object should never switch sides."):"This fixed depth mode ignores the Y-Sort line. Switch to Y-Sort to use a draggable depth anchor."}</div>
    <label>Container slots<input id="devCapacity" type="number" min="0" value="${obj.capacity||0}"></label>
    <div class="devRow"><button id="devApply">Apply</button><button id="devDuplicate">Duplicate</button><button id="devDelete" class="danger">Delete</button></div>`;
  inspector.querySelector("#devEditHitbox").onclick=()=>setDeveloperHitboxEditing(!devHitboxEditing);
  inspector.querySelector("#devEditDepth").onclick=()=>setDeveloperDepthEditing(!devDepthEditing);
  inspector.querySelector("#devDepthMode").onchange=e=>{
    obj.depthMode=e.target.value;
    if(obj.depthMode!=="ysort"){devDepthEditing=false;devDepthDrag=null;} else ensureDeveloperDepth(obj);
    saveDeveloperDraft();refreshDeveloperPanel();devSetStatus(`Depth mode: ${e.target.options[e.target.selectedIndex].text}`);
  };
  inspector.querySelector("#devApply").onclick=applyDeveloperInspector;
  inspector.querySelector("#devDuplicate").onclick=duplicateDeveloperSelection;
  inspector.querySelector("#devDelete").onclick=deleteDeveloperSelection;
}

function updateVisualScaleControl(key,value){
  const n=Math.max(0.5,Math.min(3.0,Number(value)||1));
  VISUAL_SCALE[key]=Math.round(n*100)/100;
  if(devPanel){
    const out=devPanel.querySelector(`[data-scale-value="${key}"]`);
    if(out) out.textContent=VISUAL_SCALE[key].toFixed(2)+"×";
  }
}

function setMobTypeScale(key,value){
  if(!key || !Object.prototype.hasOwnProperty.call(MOB_TYPE_SCALE,key)) return;
  const n=Math.max(0.5,Math.min(3.0,Number(value)||1));
  MOB_TYPE_SCALE[key]=Math.round(n*100)/100;
  refreshDeveloperMobPanel();
}

function selectDeveloperMobType(key){
  const match=mobs.find(m=>mobTypeScaleKey(m)===key) || {kind:key,boss:key==="snickers",alive:false};
  devSelectedMob=match;
  devCombatMobType=key;
  devSelected=null;devSelectedNpc=null;
  setDeveloperTab("scale");
  refreshDeveloperPanel();
}

function refreshDeveloperMobPanel(){
  if(!devPanel) return;
  const panel=devPanel.querySelector("#devMobScalePanel");
  if(!panel) return;
  const key=mobTypeScaleKey(devSelectedMob);
  const available=["slime","goblin","wolf","cow","pig","chicken","snickers"];
  if(!key){
    panel.innerHTML=`<div class="devEmpty">Click a mob in the world to select its type. You can then resize only that species.</div><div id="devMobTypeChips"></div>`;
  }else{
    const count=mobs.filter(m=>mobTypeScaleKey(m)===key).length;
    const value=MOB_TYPE_SCALE[key] ?? mobTypeFallbackScale(key);
    panel.innerHTML=`
      <div class="devMobSelectedTitle">${mobTypeScaleLabel(key)}</div>
      <div class="devMobMeta">Affects all ${count} ${mobTypeScaleLabel(key)} spawn${count===1?"":"s"}. Visual size only — combat stats and hitboxes are unchanged.</div>
      <div class="devScaleControl">
        <div class="devScaleTop"><span>${mobTypeScaleLabel(key)} scale</span><span id="devSelectedMobScaleValue">${value.toFixed(2)}×</span></div>
        <input id="devSelectedMobScale" type="range" min="0.50" max="3.00" step="0.05" value="${value}">
      </div>
      <div class="devRow"><button id="devResetMobScale">Reset ${mobTypeScaleLabel(key)}</button></div>
      <div id="devMobTypeChips"></div>`;
    panel.querySelector("#devSelectedMobScale").oninput=e=>setMobTypeScale(key,e.target.value);
    panel.querySelector("#devResetMobScale").onclick=()=>{
      MOB_TYPE_SCALE[key]=mobTypeFallbackScale(key);
      refreshDeveloperMobPanel();
      devSetStatus(`${mobTypeScaleLabel(key)} reset to ${MOB_TYPE_SCALE[key].toFixed(2)}×`);
    };
  }
  const chips=panel.querySelector("#devMobTypeChips");
  if(chips){
    for(const type of available){
      const b=document.createElement("button");
      b.className="devMobTypeChip"+(type===key?" active":"");
      b.textContent=mobTypeScaleLabel(type);
      b.onclick=()=>selectDeveloperMobType(type);
      chips.appendChild(b);
    }
  }
}

function exportVisualSettings(){
  const settings={...VISUAL_SCALE,mobTypes:{...MOB_TYPE_SCALE}};
  const text=`/* Exported from Little Realm Developer Mode */
window.LR_VISUAL = ${JSON.stringify(settings,null,2)};
`;
  const blob=new Blob([text],{type:"text/javascript"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download="visual-settings.js";
  document.body.appendChild(a);
  a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  devSetStatus("Exported visual-settings.js with per-mob scales");
}

function resetVisualScale(){
  Object.assign(VISUAL_SCALE,PROJECT_VISUAL_SCALE);
  Object.assign(MOB_TYPE_SCALE,PROJECT_MOB_TYPE_SCALE);
  if(!devPanel) return;
  devPanel.querySelectorAll("[data-scale-key]").forEach(input=>{
    input.value=VISUAL_SCALE[input.dataset.scaleKey];
    updateVisualScaleControl(input.dataset.scaleKey,input.value);
  });
  refreshDeveloperMobPanel();
  devSetStatus("Visual scale reset to project settings");
}


function devBalanceClone(value){ return JSON.parse(JSON.stringify(value)); }
function devReplaceBalance(source){
  for(const key of Object.keys(BALANCE)) delete BALANCE[key];
  Object.assign(BALANCE,devBalanceClone(source));
}
function devCombatNum(value,fallback=0){
  const n=Number(value); return Number.isFinite(n)?n:fallback;
}
function devCombatField(field,label,value,step="1",min=null,max=null){
  return `<label class="devCombatField">${label}<input type="number" data-combat-field="${field}" value="${value}" step="${step}"${min!==null?` min="${min}"`:""}${max!==null?` max="${max}"`:""}></label>`;
}
function devGlobalField(field,label,value,step="1",min=null,max=null){
  return `<label class="devCombatField">${label}<input type="number" data-global-field="${field}" value="${value}" step="${step}"${min!==null?` min="${min}"`:""}${max!==null?` max="${max}"`:""}></label>`;
}
function devProgressionField(field,label,value,step="1",min=null,max=null){
  return `<label class="devCombatField">${label}<input type="number" data-progression-field="${field}" value="${value}" step="${step}"${min!==null?` min="${min}"`:""}${max!==null?` max="${max}"`:""}></label>`;
}
function developerXpNextForLevel(level){
  return xpRequiredForLevel(level);
}
function captureDeveloperPlayerBaseline(){
  if(devPlayerTestBaseline) return;
  devPlayerTestBaseline={level:state.level,xp:state.xp,xpNext:state.xpNext,hp:state.hp,maxHp:state.maxHp,atk:state.atk,def:state.def};
}
function applyDeveloperPlayerLevel(rawLevel){
  captureDeveloperPlayerBaseline();
  const level=Math.max(1,Math.min(playerLevelCap(),Math.floor(devCombatNum(rawLevel,state.level))));
  const steps=level-1;
  state.level=level;
  state.xp=0;
  state.xpNext=developerXpNextForLevel(level);
  state.maxHp=Math.max(1,Math.floor(numberOr(BALANCE.player?.maxHp,30)+steps*numberOr(BALANCE.progression?.hpPerLevel,8)));
  state.atk=Math.max(0,Math.floor(numberOr(BALANCE.player?.attack,5)+steps*numberOr(BALANCE.progression?.attackPerLevel,2)));
  state.def=Math.max(0,Math.floor(numberOr(BALANCE.player?.defense,1)+steps*numberOr(BALANCE.progression?.defensePerLevel,1)));
  state.hp=state.maxHp;
  refreshAliveMobStatsForPlayer();
  updateUI(); updateCombatHud(); refreshDeveloperCombatPanel();
  devSetStatus(`Player test level set to ${level}`);
}
function restoreDeveloperPlayerBaseline(){
  if(!devPlayerTestBaseline){devSetStatus("No player test-level baseline captured yet");return;}
  Object.assign(state,devPlayerTestBaseline);
  devPlayerTestBaseline=null;
  refreshAliveMobStatsForPlayer(); updateUI(); updateCombatHud(); refreshDeveloperCombatPanel();
  devSetStatus(`Restored player to level ${state.level}`);
}
function applyDeveloperSpeciesBalance(){
  if(!devPanel) return;
  const cfg=BALANCE.mobs?.[devCombatMobType];
  if(!cfg) return;
  const panel=devPanel.querySelector("#devCombatSpecies");
  panel?.querySelectorAll("[data-combat-field]").forEach(input=>{
    const key=input.dataset.combatField;
    cfg[key]=input.type==="checkbox"?input.checked:devCombatNum(input.value,cfg[key]);
  });
  cfg.baseLevel=Math.max(1,Math.floor(devCombatNum(cfg.baseLevel,1)));
  cfg.levelMin=Math.max(1,Math.floor(devCombatNum(cfg.levelMin,cfg.baseLevel)));
  cfg.levelMax=Math.max(cfg.levelMin,Math.floor(devCombatNum(cfg.levelMax,cfg.baseLevel)));
  cfg.hp=Math.max(1,devCombatNum(cfg.hp,1));
  cfg.attack=Math.max(0,devCombatNum(cfg.attack,0));
  cfg.defense=Math.max(0,devCombatNum(cfg.defense,0));
  cfg.xpMultiplier=Math.max(0,devCombatNum(cfg.xpMultiplier,1));
  cfg.eliteChancePercent=Math.max(0,Math.min(100,devCombatNum(cfg.eliteChancePercent,0)));
  refreshMobTemplatesFromBalance();
  refreshDeveloperCombatPanel(); updateCombatHud();
  devSetStatus(`${mobTypeScaleLabel(devCombatMobType)} combat settings applied live`);
}
function applyDeveloperGlobalCombatBalance(){
  if(!devPanel) return;
  BALANCE.mobLevels=BALANCE.mobLevels||{};
  devPanel.querySelectorAll("#devCombatGlobals [data-global-field]").forEach(input=>{
    BALANCE.mobLevels[input.dataset.globalField]=devCombatNum(input.value,BALANCE.mobLevels[input.dataset.globalField]);
  });
  BALANCE.progression=BALANCE.progression||{};
  devPanel.querySelectorAll("#devCombatGlobals [data-progression-field]").forEach(input=>{
    BALANCE.progression[input.dataset.progressionField]=devCombatNum(input.value,BALANCE.progression[input.dataset.progressionField]);
  });
  refreshMobTemplatesFromBalance(); refreshAliveMobStatsForPlayer(); updateCombatHud(); refreshDeveloperCombatPanel();
  devSetStatus("Global mob-level combat settings applied live");
}
function exportDeveloperBalance(){
  const text=`/* Exported from Little Realm Developer Mode */\nwindow.LR_BALANCE = ${JSON.stringify(BALANCE,null,2)};\n`;
  const blob=new Blob([text],{type:"text/javascript"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download="game-balance.js"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  devSetStatus("Exported game-balance.js");
}
function resetDeveloperCombatBalance(){
  if(!confirm("Reset live combat tuning to the project game-balance.js values?")) return;
  devReplaceBalance(DEV_PROJECT_BALANCE); refreshMobTemplatesFromBalance(); rerollMobLevelsAndElites(); refreshDeveloperCombatPanel(); updateCombatHud();
  devSetStatus("Combat tuning reset to project balance");
}
function developerMobPreview(){
  const mob=(devSelectedMob && mobTypeScaleKey(devSelectedMob)===devCombatMobType && devSelectedMob.alive)?devSelectedMob:mobs.find(m=>mobTypeScaleKey(m)===devCombatMobType && m.alive);
  if(!mob) return `<div class="devEmpty">No live ${mobTypeScaleLabel(devCombatMobType)} spawn available for preview.</div>`;
  const aggro=mobAggroRanges(mob);
  return `<div class="devHint">Live preview: Lv ${mob.level} ${mobDisplayName(mob)}${mob.dangerSteps?` • ${mob.dangerSteps} danger stack${mob.dangerSteps===1?"":"s"}`:""}</div><div class="devStatPreview"><div><b>${mob.maxHp}</b><span>HP</span></div><div><b>${mob.atk}</b><span>Damage</span></div><div><b>${mob.def}</b><span>Armor</span></div><div><b>${mobXpReward(mob)}</b><span>XP now</span></div><div><b>${Math.round(playerHitChanceAgainst(mob))}%</b><span>Your hit</span></div><div><b>${Math.round(mobHitChanceAgainstPlayer(mob))}%</b><span>Mob hit</span></div><div><b>${Math.round(aggro.trigger)}</b><span>Aggro</span></div><div><b>${mob.elite?"ELITE":mob.boss?"BOSS":"NORMAL"}</b><span>Rank</span></div></div>`;
}
function refreshDeveloperCombatPanel(){
  if(!devPanel) return;
  const player=devPanel.querySelector("#devPlayerTestPanel");
  const species=devPanel.querySelector("#devCombatSpecies");
  const globals=devPanel.querySelector("#devCombatGlobals");
  if(!player||!species||!globals) return;

  // Developer Mode is initialized before reset() creates the player state.
  // Do not let the optional tuning UI interrupt normal game startup.
  if(!state){
    player.innerHTML='<div class="devEmpty">Combat testing becomes available after the game finishes initializing.</div>';
    species.innerHTML='<div class="devEmpty">Mob tuning will load when Developer Mode is opened.</div>';
    globals.innerHTML='<div class="devEmpty">Global combat tuning will load when Developer Mode is opened.</div>';
    return;
  }

  player.innerHTML=`<div class="devPlayerTest"><label class="devCombatField">Player Test Level<input id="devPlayerTestLevel" type="number" min="1" max="100" step="1" value="${state.level}"></label><div><div class="devHint">Temporary testing control. Recalculates player HP/Attack/Defense and immediately refreshes danger scaling on living mobs.</div><div class="devQuickLevels">${[1,5,10,25,50,100].map(n=>`<button data-test-level="${n}">Lv ${n}</button>`).join("")}</div></div></div><div class="devStatPreview"><div><b>${state.level}</b><span>Level</span></div><div><b>${state.maxHp}</b><span>HP</span></div><div><b>${state.atk}</b><span>Attack</span></div><div><b>${state.def}</b><span>Defense</span></div></div><div class="devCombatActions"><button id="devSetPlayerLevel" class="primary">Apply Test Level</button><button id="devRestorePlayerLevel">Restore Before Testing</button><button id="devFullHeal">Full Heal</button></div>`;
  player.querySelector("#devSetPlayerLevel").onclick=()=>applyDeveloperPlayerLevel(player.querySelector("#devPlayerTestLevel").value);
  player.querySelectorAll("[data-test-level]").forEach(b=>b.onclick=()=>applyDeveloperPlayerLevel(b.dataset.testLevel));
  player.querySelector("#devRestorePlayerLevel").onclick=restoreDeveloperPlayerBaseline;
  player.querySelector("#devFullHeal").onclick=()=>{state.hp=state.maxHp;updateUI();devSetStatus("Player fully healed");};

  const types=["slime","wolf","goblin","cow","pig","chicken","snickers"];
  const cfg=BALANCE.mobs?.[devCombatMobType]||{};
  species.innerHTML=`<div id="devCombatMobChips">${types.map(k=>`<button class="devMobTypeChip${k===devCombatMobType?" active":""}" data-combat-mob="${k}">${mobTypeScaleLabel(k)}</button>`).join("")}</div><div class="devCombatGrid" style="margin-top:10px">${devCombatField("baseLevel","Base level",cfg.baseLevel??1,1,1,100)}${devCombatField("levelMin","Min spawn level",cfg.levelMin??cfg.baseLevel??1,1,1,100)}${devCombatField("levelMax","Max spawn level",cfg.levelMax??cfg.baseLevel??1,1,1,100)}${devCombatField("hp","Base HP",cfg.hp??1,1,1)}${devCombatField("attack","Base damage",cfg.attack??0,1,0)}${devCombatField("defense","Base armor",cfg.defense??0,.1,0)}${devCombatField("xpMultiplier","XP multiplier ×",cfg.xpMultiplier??1,.05,0)}${devCombatField("eliteChancePercent","Elite chance %",cfg.eliteChancePercent??0,.5,0,100)}${devCombatField("attackIntervalSeconds","Attack interval",cfg.attackIntervalSeconds??1.5,.05,.1)}${devCombatField("aggroTriggerRange","Base aggro range",cfg.aggroTriggerRange??0,1,0)}${devCombatField("alertRange","Base alert range",cfg.alertRange??0,1,0)}${devCombatField("chaseSpeed","Chase speed",cfg.chaseSpeed??0,1,0)}</div><label class="devCombatCheck" style="margin-top:9px"><input type="checkbox" data-combat-field="aggressive" ${cfg.aggressive?"checked":""}> Aggressive / auto-aggro</label>${developerMobPreview()}<div class="devCombatActions"><button id="devApplySpecies" class="primary">Apply ${mobTypeScaleLabel(devCombatMobType)} Stats</button><button id="devRerollSpecies">Reroll Levels + Elites</button></div>`;
  species.querySelectorAll("[data-combat-mob]").forEach(b=>b.onclick=()=>{devCombatMobType=b.dataset.combatMob;devSelectedMob=mobs.find(m=>mobTypeScaleKey(m)===devCombatMobType)||devSelectedMob;refreshDeveloperCombatPanel();});
  species.querySelector("#devApplySpecies").onclick=applyDeveloperSpeciesBalance;
  species.querySelector("#devRerollSpecies").onclick=()=>{applyDeveloperSpeciesBalance();rerollMobLevelsAndElites(devCombatMobType);refreshDeveloperCombatPanel();devSetStatus(`${mobTypeScaleLabel(devCombatMobType)} levels and elite rolls refreshed`);};

  const g=BALANCE.mobLevels||{};
  globals.innerHTML=`
  <details class="devCombatDetails" open><summary>Normal Level Scaling</summary><div class="devCombatGrid">${devGlobalField("hpGrowthPerLevelPercent","HP growth / level %",g.hpGrowthPerLevelPercent??14,.5)}${devGlobalField("attackGrowthPerLevelPercent","Damage growth / level %",g.attackGrowthPerLevelPercent??10,.5)}${devGlobalField("armorPerLevel","Armor / level",g.armorPerLevel??.55,.05)}</div></details>
  <details class="devCombatDetails" open><summary>High-Level Danger Boost</summary><div class="devCombatGrid">${devGlobalField("dangerStartsAbovePlayerLevels","Starts above player levels",g.dangerStartsAbovePlayerLevels??3,1,0)}${devGlobalField("dangerHpPerExtraLevelPercent","HP / danger level %",g.dangerHpPerExtraLevelPercent??12,.5)}${devGlobalField("dangerAttackPerExtraLevelPercent","Damage / danger level %",g.dangerAttackPerExtraLevelPercent??9,.5)}${devGlobalField("dangerArmorPerExtraLevel","Armor / danger level",g.dangerArmorPerExtraLevel??.6,.05)}${devGlobalField("dangerXpPerExtraLevelPercent","XP / danger level %",g.dangerXpPerExtraLevelPercent??10,.5)}</div></details>
  <details class="devCombatDetails"><summary>Elite Multipliers</summary><div class="devCombatGrid">${devGlobalField("eliteHpMultiplier","Elite HP ×",g.eliteHpMultiplier??1.65,.05)}${devGlobalField("eliteAttackMultiplier","Elite damage ×",g.eliteAttackMultiplier??1.2,.05)}${devGlobalField("eliteArmorBonus","Elite armor +",g.eliteArmorBonus??2,.1)}${devGlobalField("eliteXpMultiplier","Elite XP ×",g.eliteXpMultiplier??1.6,.05)}${devGlobalField("eliteGoldMultiplier","Elite gold ×",g.eliteGoldMultiplier??1.5,.05)}${devGlobalField("eliteAggroMultiplier","Elite aggro ×",g.eliteAggroMultiplier??1.15,.05)}</div></details>
  <details class="devCombatDetails"><summary>Boss Multipliers</summary><div class="devCombatGrid">${devGlobalField("bossHpMultiplier","Boss HP ×",g.bossHpMultiplier??1.5,.05)}${devGlobalField("bossAttackMultiplier","Boss damage ×",g.bossAttackMultiplier??1.25,.05)}${devGlobalField("bossArmorMultiplier","Boss armor ×",g.bossArmorMultiplier??1.25,.05)}${devGlobalField("bossXpMultiplier","Boss XP ×",g.bossXpMultiplier??1.75,.05)}${devGlobalField("bossAggroMultiplier","Boss aggro ×",g.bossAggroMultiplier??1.25,.05)}</div></details>
  <details class="devCombatDetails"><summary>Level-Based Aggro</summary><div class="devCombatGrid">${devGlobalField("aggroRangePerLevelDifference","Aggro / level diff",g.aggroRangePerLevelDifference??7,1)}${devGlobalField("alertRangePerLevelDifference","Alert / level diff",g.alertRangePerLevelDifference??9,1)}${devGlobalField("minimumAggroTriggerRange","Minimum aggro",g.minimumAggroTriggerRange??20,1,0)}${devGlobalField("minimumAlertRange","Minimum alert",g.minimumAlertRange??34,1,0)}</div></details>
  <details class="devCombatDetails"><summary>Hit / Miss</summary><div class="devCombatGrid">${devGlobalField("playerBaseHitChancePercent","Player base hit %",g.playerBaseHitChancePercent??96,.5,0,100)}${devGlobalField("enemyBaseHitChancePercent","Mob base hit %",g.enemyBaseHitChancePercent??92,.5,0,100)}${devGlobalField("playerHitChancePerLevelAdvantagePercent","Player hit / level %",g.playerHitChancePerLevelAdvantagePercent??4,.5)}${devGlobalField("enemyHitChancePerLevelAdvantagePercent","Mob hit / level %",g.enemyHitChancePerLevelAdvantagePercent??3,.5)}${devGlobalField("minimumHitChancePercent","Minimum hit %",g.minimumHitChancePercent??55,.5,0,100)}${devGlobalField("maximumHitChancePercent","Maximum hit %",g.maximumHitChancePercent??99,.5,0,100)}${devGlobalField("elitePlayerHitPenaltyPercent","Elite player penalty %",g.elitePlayerHitPenaltyPercent??3,.5)}${devGlobalField("eliteEnemyHitBonusPercent","Elite mob bonus %",g.eliteEnemyHitBonusPercent??3,.5)}${devGlobalField("bossPlayerHitPenaltyPercent","Boss player penalty %",g.bossPlayerHitPenaltyPercent??5,.5)}${devGlobalField("bossEnemyHitBonusPercent","Boss mob bonus %",g.bossEnemyHitBonusPercent??5,.5)}</div></details>
  <details class="devCombatDetails"><summary>XP Rules</summary><div class="devCombatGrid">${devProgressionField("sameLevelMobXpBase","Lv 1 standard mob XP",BALANCE.progression?.sameLevelMobXpBase??50,1,1)}${devProgressionField("sameLevelMobXpPerLevel","Standard mob XP / level +",BALANCE.progression?.sameLevelMobXpPerLevel??5,1,0)}${devGlobalField("trivialXpStartsAboveMobLevels","Level-gap XP floor starts",g.trivialXpStartsAboveMobLevels??5,1,1)}${devGlobalField("lowLevelXpPenaltyPerLevelPercent","Low-level penalty / level %",g.lowLevelXpPenaltyPerLevelPercent??20,.5)}${devGlobalField("higherLevelXpBonusPerLevelPercent","High-level XP bonus / level %",g.higherLevelXpBonusPerLevelPercent??8,.5)}</div><div class="devHint" style="margin-top:8px">A normal same-level hostile follows the level curve (50 XP at Lv 1, +5 per level by default). Species XP multipliers, elite/boss bonuses, and level-gap rules are applied after that.</div></details>
  <div class="devCombatActions"><button id="devApplyGlobals" class="primary">Apply Global Combat Settings</button><button id="devRerollAll">Reroll All Mob Levels + Elites</button><button id="devExportBalance">Export game-balance.js</button><button id="devResetBalance" class="danger">Reset Combat Tuning</button></div>`;
  globals.querySelector("#devApplyGlobals").onclick=applyDeveloperGlobalCombatBalance;
  globals.querySelector("#devRerollAll").onclick=()=>{applyDeveloperGlobalCombatBalance();rerollMobLevelsAndElites();refreshDeveloperCombatPanel();devSetStatus("All mob levels and elite rolls refreshed");};
  globals.querySelector("#devExportBalance").onclick=()=>{applyDeveloperSpeciesBalance();applyDeveloperGlobalCombatBalance();exportDeveloperBalance();};
  globals.querySelector("#devResetBalance").onclick=resetDeveloperCombatBalance;
}


function developerSafeId(value,fallback="id"){
  return String(value||fallback).trim().toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9_-]+/g,"")||fallback;
}

function refreshDeveloperNpcInspectorValues(){
  if(!devPanel||!devSelectedNpc) return;
  const root=devPanel.querySelector("#devNpcInspector");
  if(!root) return;
  const x=root.querySelector("#devNpcX"),y=root.querySelector("#devNpcY");
  if(x)x.value=Math.round(devSelectedNpc.x);
  if(y)y.value=Math.round(devSelectedNpc.y);
}

function updateQuestNpcReferences(oldId,newId){
  if(!oldId||oldId===newId) return;
  for(const quest of questDefinitions){
    if(quest.giverNpc===oldId) quest.giverNpc=newId;
    if(quest.turnInNpc===oldId) quest.turnInNpc=newId;
    for(const objective of quest.objectives) if(objective.type==="talk"&&objective.target===oldId) objective.target=newId;
  }
  if(activeNpcDialogId===oldId) activeNpcDialogId=newId;
}

function saveDeveloperNpc(){
  if(!devPanel||!devSelectedNpc) return;
  const root=devPanel.querySelector("#devNpcInspector");
  if(!root) return;
  const oldId=devSelectedNpc.id;
  let newId=developerSafeId(root.querySelector("#devNpcId")?.value,oldId||"npc");
  if(sceneryNPCs.some(n=>n!==devSelectedNpc&&n.id===newId)){
    devSetStatus(`NPC id '${newId}' is already in use`);return;
  }
  devSelectedNpc.id=newId;
  devSelectedNpc.name=root.querySelector("#devNpcName")?.value.trim()||newId;
  devSelectedNpc.role=root.querySelector("#devNpcRole")?.value.trim()||"Villager";
  devSelectedNpc.sprite=root.querySelector("#devNpcSprite")?.value||NPC_PLACEHOLDER_SPRITE;
  devSelectedNpc.x=numberOr(root.querySelector("#devNpcX")?.value,devSelectedNpc.x);
  devSelectedNpc.y=numberOr(root.querySelector("#devNpcY")?.value,devSelectedNpc.y);
  devSelectedNpc.facing=root.querySelector("#devNpcFacing")?.value||"down";
  devSelectedNpc.displayHeight=Math.max(24,numberOr(root.querySelector("#devNpcHeight")?.value,58));
  devSelectedNpc.interactRadius=Math.max(24,numberOr(root.querySelector("#devNpcRange")?.value,58));
  devSelectedNpc.greeting=root.querySelector("#devNpcGreeting")?.value.trim()||`Hello. I'm ${devSelectedNpc.name}.`;
  devSelectedNpc.solid=!!root.querySelector("#devNpcSolid")?.checked;
  updateQuestNpcReferences(oldId,newId);
  rebuildNpcCollision();
  saveDeveloperDraft();refreshDeveloperPanel();refreshQuestUI();
  devSetStatus(`Saved NPC: ${devSelectedNpc.name}`);
}

function duplicateDeveloperNpc(){
  if(!devSelectedNpc)return;
  const copy=normalizeNpcRecord({...cloneNpc(devSelectedNpc),id:uniqueNpcId(devSelectedNpc.id),name:`${devSelectedNpc.name} Copy`,x:devSelectedNpc.x+devSnap*2,y:devSelectedNpc.y+devSnap*2},sceneryNPCs.length);
  sceneryNPCs.push(copy);devSelectedNpc=copy;rebuildNpcCollision();saveDeveloperDraft();refreshDeveloperPanel();
}

function deleteDeveloperNpc(){
  if(!devSelectedNpc)return;
  const refs=questDefinitions.filter(q=>q.giverNpc===devSelectedNpc.id||q.turnInNpc===devSelectedNpc.id||q.objectives.some(o=>o.type==="talk"&&o.target===devSelectedNpc.id));
  const warning=refs.length?` ${refs.length} quest(s) reference this NPC and will need repair.`:"";
  if(!confirm(`Delete ${devSelectedNpc.name}?${warning}`))return;
  const i=sceneryNPCs.indexOf(devSelectedNpc);if(i>=0)sceneryNPCs.splice(i,1);
  devSelectedNpc=null;rebuildNpcCollision();saveDeveloperDraft();refreshDeveloperPanel();refreshQuestUI();
}

function refreshDeveloperNpcPanel(){
  if(!devPanel)return;
  const list=devPanel.querySelector("#devNpcList");
  const inspector=devPanel.querySelector("#devNpcInspector");
  const count=devPanel.querySelector("#devNpcCount");
  if(count)count.textContent=`${sceneryNPCs.length} placed`;
  if(list){
    list.innerHTML="";
    for(const npc of sceneryNPCs){
      const b=document.createElement("button");b.className="devNpcChip"+(npc===devSelectedNpc?" active":"");b.textContent=`${npc.name} • ${npc.role}`;
      b.onclick=()=>{devSelectedNpc=npc;devSelected=null;devSelectedMob=null;devPlaceType=null;devPlaceNpcTemplate=null;setDeveloperTab("npcs");refreshDeveloperPanel();};list.appendChild(b);
    }
  }
  if(!inspector)return;
  if(!devSelectedNpc){inspector.innerHTML='<div class="devEmpty">Choose an NPC from the list, click one in the world, or place a new model.</div>';return;}
  const spriteChoices=[
    [NPC_PLACEHOLDER_SPRITE,"Placeholder model"],["./assets/npcs/lilly.png","Lilly model"],["./assets/npcs/jorge.png","Jorge model"]
  ];
  if(devSelectedNpc.sprite&&!spriteChoices.some(([v])=>v===devSelectedNpc.sprite))spriteChoices.push([devSelectedNpc.sprite,"Current custom sprite"]);
  inspector.innerHTML=`<div class="devNpcInspector">
    <div class="devSelectedTitle">${questEscape(devSelectedNpc.name)}</div>
    <div class="devPair"><label>ID<input id="devNpcId" value="${questEscape(devSelectedNpc.id)}"></label><label>Name<input id="devNpcName" value="${questEscape(devSelectedNpc.name)}"></label></div>
    <div class="devPair"><label>Role<input id="devNpcRole" value="${questEscape(devSelectedNpc.role||"Villager")}"></label><label>Sprite<select id="devNpcSprite">${spriteChoices.map(([v,l])=>`<option value="${questEscape(v)}" ${v===devSelectedNpc.sprite?"selected":""}>${questEscape(l)}</option>`).join("")}</select></label></div>
    <div class="devPair"><label>X<input id="devNpcX" type="number" value="${Math.round(devSelectedNpc.x)}"></label><label>Y<input id="devNpcY" type="number" value="${Math.round(devSelectedNpc.y)}"></label></div>
    <div class="devPair"><label>Facing<select id="devNpcFacing">${["down","left","right","up"].map(v=>`<option ${v===devSelectedNpc.facing?"selected":""}>${v}</option>`).join("")}</select></label><label>Sprite Height<input id="devNpcHeight" type="number" min="24" value="${numberOr(devSelectedNpc.displayHeight,58)}"></label></div>
    <label>Talk Radius<input id="devNpcRange" type="number" min="24" value="${numberOr(devSelectedNpc.interactRadius,58)}"></label>
    <label>Greeting<textarea id="devNpcGreeting">${questEscape(devSelectedNpc.greeting||"")}</textarea></label>
    <label style="flex-direction:row;align-items:center"><input id="devNpcSolid" type="checkbox" ${devSelectedNpc.solid!==false?"checked":""}> Solid collision</label>
    <div class="devRow"><button id="devNpcSave">Save NPC</button><button id="devNpcDuplicate">Duplicate</button><button id="devNpcDelete" class="danger">Delete</button></div>
  </div>`;
  inspector.querySelector("#devNpcSave").onclick=saveDeveloperNpc;
  inspector.querySelector("#devNpcDuplicate").onclick=duplicateDeveloperNpc;
  inspector.querySelector("#devNpcDelete").onclick=deleteDeveloperNpc;
  const heightInput=inspector.querySelector("#devNpcHeight");
  heightInput.oninput=e=>{
    devSelectedNpc.displayHeight=Math.max(24,numberOr(e.target.value,devSelectedNpc.displayHeight));
    rebuildNpcCollision();
    refreshDeveloperInspectorValues();
  };
  heightInput.onchange=()=>saveDeveloperDraft();
  inspector.querySelector("#devNpcSprite").onchange=e=>{devSelectedNpc.sprite=e.target.value||NPC_PLACEHOLDER_SPRITE;saveDeveloperDraft();};
  inspector.querySelector("#devNpcFacing").onchange=e=>{devSelectedNpc.facing=e.target.value||"down";saveDeveloperDraft();};
}

function devQuestOptions(values,selected){
  return values.map(([value,label])=>`<option value="${questEscape(value)}" ${value===selected?"selected":""}>${questEscape(label)}</option>`).join("");
}
function developerObjectiveDefault(type="talk"){
  if(type==="kill")return normalizeQuestObjective({type,target:enemyTemplates[0]?.configKey||"slime",amount:1});
  if(type==="collect"||type==="deliver")return normalizeQuestObjective({type,target:Object.keys(ITEM_DEFS)[0]||"",amount:1,consumeOnTurnIn:true});
  if(type==="visit")return normalizeQuestObjective({type,x:Math.round(state?.x||START_X),y:Math.round(state?.y||START_Y),radius:36,amount:1});
  return normalizeQuestObjective({type:"talk",target:sceneryNPCs[0]?.id||"",amount:1});
}
function developerNewQuest(){
  const giver=devSelectedNpc?.id||sceneryNPCs[0]?.id||"";
  const root=uniqueQuestId("new_quest");
  return normalizeQuestDefinition({id:root,title:"New Quest",description:"Describe what the player should do.",giverNpc:giver,turnInNpc:giver,openingDialogue:"Could you help me?",completionDialogue:"Thank you for your help.",level:1,levelRequirementMode:"auto",rewardTier:"minor",objectives:[developerObjectiveDefault("talk")],rewards:{xpMode:"auto",xp:0,gold:0,items:[]}},questDefinitions.length);
}
function uniqueQuestId(base="quest"){
  const root=String(base||"quest").toLowerCase().replace(/[^a-z0-9_-]+/g,"_")||"quest";let id=root,n=2;
  while(questDefinitions.some(q=>q.id===id))id=`${root}_${n++}`;return id;
}
function developerQuestTargetOptions(type,selected){
  let values=[];
  if(type==="kill") values=[...enemyTemplates,bossTemplate].map(t=>[t.configKey||t.kind,t.name]);
  else if(type==="collect"||type==="deliver") values=Object.keys(ITEM_DEFS).map(id=>[id,getItemDefinition(id).name]);
  else if(type==="talk") values=sceneryNPCs.map(n=>[n.id,n.name]);
  if(selected&&!values.some(([v])=>v===selected)) values.push([selected,selected]);
  return values;
}
function readDeveloperQuestForm(){
  const root=devPanel?.querySelector("#devQuestEditor");
  const fallback=devQuestFormDraft||getQuestDefinition(devSelectedQuestId)||developerNewQuest();
  if(!root)return cloneQuest(fallback);
  const objectives=[...root.querySelectorAll("[data-objective-index]")].map(row=>{
    const type=row.querySelector("[data-obj-type]")?.value||"talk";
    const amount=Math.max(1,Math.floor(numberOr(row.querySelector("[data-obj-amount]")?.value,1)));
    if(type==="visit")return normalizeQuestObjective({type,amount:1,x:row.querySelector("[data-obj-x]")?.value,y:row.querySelector("[data-obj-y]")?.value,radius:row.querySelector("[data-obj-radius]")?.value});
    return normalizeQuestObjective({type,target:row.querySelector("[data-obj-target]")?.value||"",amount,consumeOnTurnIn:row.querySelector("[data-obj-consume]")?.checked!==false});
  });
  const rewardItem=root.querySelector("#devQuestRewardItem")?.value||"";
  return normalizeQuestDefinition({
    id:root.querySelector("#devQuestId")?.value||fallback.id,
    title:root.querySelector("#devQuestTitle")?.value||fallback.title,
    description:root.querySelector("#devQuestDescription")?.value||"",
    giverNpc:root.querySelector("#devQuestGiver")?.value||"",
    turnInNpc:root.querySelector("#devQuestTurnIn")?.value||"",
    openingDialogue:root.querySelector("#devQuestOpening")?.value||"",
    completionDialogue:root.querySelector("#devQuestCompletion")?.value||"",
    level:root.querySelector("#devQuestLevel")?.value||fallback.level||1,
    levelRequirementMode:root.querySelector("#devQuestLevelRequirementMode")?.value||fallback.levelRequirementMode||"auto",
    minLevel:root.querySelector("#devQuestMinLevel")?.value||fallback.minLevel||1,
    rewardTier:root.querySelector("#devQuestRewardTier")?.value||fallback.rewardTier||"standard",
    objectives:objectives.length?objectives:[developerObjectiveDefault("talk")],
    rewards:{xpMode:root.querySelector("#devQuestXpMode")?.value||fallback.rewards?.xpMode||"custom",xp:root.querySelector("#devQuestRewardXp")?.value,gold:root.querySelector("#devQuestRewardGold")?.value,items:rewardItem?[{id:rewardItem,qty:root.querySelector("#devQuestRewardQty")?.value||1}]:[]},
    prerequisite:root.querySelector("#devQuestPrereq")?.value||null,
    nextQuest:root.querySelector("#devQuestNext")?.value||null,
    repeatable:!!root.querySelector("#devQuestRepeatable")?.checked
  });
}
function renderDeveloperQuestEditor(draft){
  const root=devPanel?.querySelector("#devQuestEditor");if(!root)return;
  draft=normalizeQuestDefinition(draft,questDefinitions.findIndex(q=>q.id===draft?.id));
  devQuestFormDraft=cloneQuest(draft);
  const npcOptions=sceneryNPCs.map(n=>[n.id,n.name]);
  const questOptions=[["","None"],...questDefinitions.filter(q=>q.id!==draft.id).map(q=>[q.id,q.title])];
  const itemOptions=[["","No item reward"],...Object.keys(ITEM_DEFS).map(id=>[id,getItemDefinition(id).name])];
  const rewardTierOptions=Object.entries(QUEST_XP_PROFILE_LABELS).map(([id,label])=>[id,label]);
  const rewardItem=draft.rewards.items?.[0]?.id||"",rewardQty=draft.rewards.items?.[0]?.qty||1;
  const xpProfile=questXpProfile(draft.rewardTier,draft.repeatable&&draft.rewards.xpMode==="auto");
  const xpProfileLabel=QUEST_XP_PROFILE_LABELS[xpProfile.tier]||xpProfile.tier;
  const autoXp=draft.rewards.xpMode==="auto";
  const autoMin=draft.levelRequirementMode!=="custom";
  root.innerHTML=`<div class="devQuestEditor">
    <div class="devPair"><label>Quest ID<input id="devQuestId" value="${questEscape(draft.id)}"></label><label>Quest Name<input id="devQuestTitle" value="${questEscape(draft.title)}"></label></div>
    <label>Description<textarea id="devQuestDescription">${questEscape(draft.description)}</textarea></label>
    <div class="devSubhead">Level & Availability</div>
    <div class="devQuad"><label>Quest Level<input id="devQuestLevel" type="number" min="1" max="${playerLevelCap()}" value="${draft.level}"></label><label>Minimum Level<select id="devQuestLevelRequirementMode">${devQuestOptions([["auto","Automatic (-3 levels)"],["custom","Custom"]],draft.levelRequirementMode)}</select></label><label>Requires Level<input id="devQuestMinLevel" type="number" min="1" max="${draft.level}" value="${draft.minLevel}" ${autoMin?"readonly":""}></label><label>Recommended Through<input type="number" value="${draft.recommendedMaxLevel}" readonly></label></div>
    <div class="devHint">Quest Lv ${draft.level} becomes available at Lv ${draft.minLevel}. Recommended range: Lv ${draft.minLevel}–${draft.recommendedMaxLevel}. There is no maximum acceptance level, so players can always come back later.</div>
    <div class="devPair"><label>Quest Giver<select id="devQuestGiver">${devQuestOptions(npcOptions,draft.giverNpc)}</select></label><label>Turn-In NPC<select id="devQuestTurnIn">${devQuestOptions(npcOptions,draft.turnInNpc)}</select></label></div>
    <label>Opening Dialogue<textarea id="devQuestOpening">${questEscape(draft.openingDialogue)}</textarea></label>
    <label>Completion Dialogue<textarea id="devQuestCompletion">${questEscape(draft.completionDialogue)}</textarea></label>
    <div class="devSubhead">Objectives</div><div id="devQuestObjectives">${draft.objectives.map((objective,index)=>{
      const types=[["kill","Kill"],["collect","Collect"],["talk","Talk"],["deliver","Deliver"],["visit","Visit"]];
      const visit=objective.type==="visit";
      return `<div class="devQuestObjective" data-objective-index="${index}"><div class="devQuestObjectiveTop"><label>Type<select data-obj-type>${devQuestOptions(types,objective.type)}</select></label>${visit?`<label>Location<span style="padding:9px 0;color:#b9aebe">World coordinates</span></label>`:`<label>Target<select data-obj-target>${devQuestOptions(developerQuestTargetOptions(objective.type,objective.target),objective.target)}</select></label>`}<label>Amount<input data-obj-amount type="number" min="1" value="${objective.amount}" ${visit?"disabled":""}></label><button data-remove-objective="${index}" title="Remove objective">×</button></div>${visit?`<div class="devVisitGrid"><label>X<input data-obj-x type="number" value="${Math.round(objective.x)}"></label><label>Y<input data-obj-y type="number" value="${Math.round(objective.y)}"></label><label>Radius<input data-obj-radius type="number" min="8" value="${Math.round(objective.radius)}"></label></div><button data-use-player-pos="${index}" style="margin-top:6px;border:1px solid rgba(255,255,255,.12);background:#4b4056;color:#fff;border-radius:7px;padding:6px 8px">Use Player Position</button>`:(objective.type==="collect"||objective.type==="deliver")?`<label style="flex-direction:row;align-items:center"><input data-obj-consume type="checkbox" ${objective.consumeOnTurnIn!==false?"checked":""}> Consume items on turn-in</label>`:""}</div>`;
    }).join("")}</div>
    <button id="devAddQuestObjective" class="devHitboxEditButton">+ Add Objective</button>
    <div class="devSubhead">Rewards</div>
    <div class="devPair"><label>XP Mode<select id="devQuestXpMode">${devQuestOptions([["auto","Automatic"],["custom","Custom"]],draft.rewards.xpMode)}</select></label><label>XP Profile<select id="devQuestRewardTier" ${draft.repeatable&&autoXp?"disabled":""}>${devQuestOptions(rewardTierOptions,xpProfile.tier)}</select></label></div>
    <div class="devHint">${autoXp?`Auto XP: <b>${draft.rewards.xp} XP</b> • ${questEscape(xpProfileLabel)} • ${xpProfile.mobEquivalent} same-level mob equivalents • capped at ${xpProfile.levelCapPercent}% of this level.${draft.repeatable?" Repeatable quests automatically use the Repeatable profile.":""}`:"Custom XP ignores the automatic quest-level formula."}</div>
    <div class="devQuad"><label>XP<input id="devQuestRewardXp" type="number" min="0" value="${draft.rewards.xp}" ${autoXp?"readonly":""}></label><label>Gold<input id="devQuestRewardGold" type="number" min="0" value="${draft.rewards.gold}"></label><label>Item<select id="devQuestRewardItem">${devQuestOptions(itemOptions,rewardItem)}</select></label><label>Qty<input id="devQuestRewardQty" type="number" min="1" value="${rewardQty}"></label></div>
    <div class="devPair"><label>Prerequisite<select id="devQuestPrereq">${devQuestOptions(questOptions,draft.prerequisite||"")}</select></label><label>Next Quest<select id="devQuestNext">${devQuestOptions(questOptions,draft.nextQuest||"")}</select></label></div>
    <label style="flex-direction:row;align-items:center"><input id="devQuestRepeatable" type="checkbox" ${draft.repeatable?"checked":""}> Repeatable quest</label>
    <div class="devRow"><button id="devQuestSave">Save Quest</button><button id="devQuestTest">Reset Test Progress</button></div>
  </div>`;
  root.querySelectorAll("[data-obj-type]").forEach((select,index)=>select.onchange=()=>{
    const next=readDeveloperQuestForm();const type=select.value;next.objectives[index]=developerObjectiveDefault(type);
    if(next.rewards.xpMode==="auto"&&!next.repeatable) next.rewardTier=inferQuestRewardTier(next.objectives,false);
    devQuestFormDraft=next;renderDeveloperQuestEditor(next);
  });
  root.querySelectorAll("[data-remove-objective]").forEach(button=>button.onclick=()=>{const next=readDeveloperQuestForm();next.objectives.splice(Number(button.dataset.removeObjective),1);if(!next.objectives.length)next.objectives.push(developerObjectiveDefault("talk"));if(next.rewards.xpMode==="auto"&&!next.repeatable)next.rewardTier=inferQuestRewardTier(next.objectives,false);renderDeveloperQuestEditor(next);});
  root.querySelectorAll("[data-use-player-pos]").forEach(button=>button.onclick=()=>{const next=readDeveloperQuestForm();const objective=next.objectives[Number(button.dataset.usePlayerPos)];objective.x=Math.round(state.x);objective.y=Math.round(state.y);renderDeveloperQuestEditor(next);});
  root.querySelector("#devAddQuestObjective").onclick=()=>{const next=readDeveloperQuestForm();next.objectives.push(developerObjectiveDefault("kill"));if(next.rewards.xpMode==="auto"&&!next.repeatable)next.rewardTier="multi";renderDeveloperQuestEditor(next);};
  ["devQuestLevel","devQuestLevelRequirementMode","devQuestMinLevel","devQuestXpMode","devQuestRewardTier","devQuestRepeatable"].forEach(id=>{const input=root.querySelector(`#${id}`);if(input)input.onchange=()=>renderDeveloperQuestEditor(readDeveloperQuestForm());});
  root.querySelector("#devQuestSave").onclick=saveDeveloperQuest;
  root.querySelector("#devQuestTest").onclick=()=>{const id=readDeveloperQuestForm().id;delete ensureQuestState()[id];refreshQuestUI();renderNpcDialogue();devSetStatus(`Reset test progress for ${id}`);};
}
function saveDeveloperQuest(){
  const oldId=devSelectedQuestId;const next=readDeveloperQuestForm();
  let newId=String(next.id||oldId||"quest").trim().toLowerCase().replace(/[^a-z0-9_-]+/g,"_");
  if(!newId)newId="quest";
  if(questDefinitions.some(q=>q.id===newId&&q.id!==oldId)){devSetStatus(`Quest id '${newId}' is already in use`);return;}
  next.id=newId;
  const i=questDefinitions.findIndex(q=>q.id===oldId);if(i>=0)questDefinitions[i]=normalizeQuestDefinition(next,i);else questDefinitions.push(normalizeQuestDefinition(next,questDefinitions.length));
  if(oldId&&oldId!==newId){
    for(const quest of questDefinitions){if(quest.prerequisite===oldId)quest.prerequisite=newId;if(quest.nextQuest===oldId)quest.nextQuest=newId;}
    const qs=ensureQuestState();if(qs[oldId]){qs[newId]=qs[oldId];delete qs[oldId];}
  }
  devSelectedQuestId=newId;devQuestFormDraft=cloneQuest(getQuestDefinition(newId));saveDeveloperDraft();refreshDeveloperQuestPanel();refreshQuestUI();devSetStatus(`Saved quest: ${next.title}`);
}
function refreshDeveloperQuestPanel(){
  if(!devPanel)return;
  const list=devPanel.querySelector("#devQuestList"),editor=devPanel.querySelector("#devQuestEditor"),count=devPanel.querySelector("#devQuestCount");
  if(count)count.textContent=`${questDefinitions.length} quest${questDefinitions.length===1?"":"s"}`;
  if(!devSelectedQuestId||!getQuestDefinition(devSelectedQuestId))devSelectedQuestId=questDefinitions[0]?.id||null;
  if(list){list.innerHTML="";for(const quest of questDefinitions){const b=document.createElement("button");b.className="devQuestChip"+(quest.id===devSelectedQuestId?" active":"");b.textContent=`Lv ${quest.level} • ${quest.title}`;b.title=`${quest.id} • requires Lv ${quest.minLevel}`;b.onclick=()=>{devSelectedQuestId=quest.id;devQuestFormDraft=cloneQuest(quest);refreshDeveloperQuestPanel();};list.appendChild(b);}}
  if(!editor)return;
  if(!devSelectedQuestId){editor.innerHTML='<div class="devEmpty">No quests yet. Click New Quest to create one.</div>';return;}
  const selected=getQuestDefinition(devSelectedQuestId);if(!devQuestFormDraft||devQuestFormDraft.id!==selected.id)devQuestFormDraft=cloneQuest(selected);renderDeveloperQuestEditor(devQuestFormDraft);
}
function createDeveloperQuest(){
  const quest=developerNewQuest();questDefinitions.push(quest);devSelectedQuestId=quest.id;devQuestFormDraft=cloneQuest(quest);setDeveloperTab("quests");saveDeveloperDraft();refreshDeveloperPanel();
}
function duplicateDeveloperQuest(){
  const source=getQuestDefinition(devSelectedQuestId);if(!source)return;const copy=cloneQuest(source);copy.id=uniqueQuestId(`${source.id}_copy`);copy.title=`${source.title} Copy`;questDefinitions.push(normalizeQuestDefinition(copy,questDefinitions.length));devSelectedQuestId=copy.id;devQuestFormDraft=cloneQuest(copy);saveDeveloperDraft();refreshDeveloperQuestPanel();
}
function deleteDeveloperQuest(){
  const quest=getQuestDefinition(devSelectedQuestId);if(!quest)return;if(!confirm(`Delete quest '${quest.title}'?`))return;
  questDefinitions=questDefinitions.filter(q=>q.id!==quest.id);for(const other of questDefinitions){if(other.prerequisite===quest.id)other.prerequisite=null;if(other.nextQuest===quest.id)other.nextQuest=null;}delete ensureQuestState()[quest.id];devSelectedQuestId=questDefinitions[0]?.id||null;devQuestFormDraft=null;saveDeveloperDraft();refreshDeveloperQuestPanel();refreshQuestUI();
}
function refreshDeveloperProjectPanel(){
  if(!devPanel)return;const el=devPanel.querySelector("#devProjectSummary");if(el)el.textContent=`${sceneryProps.length} props • ${sceneryNPCs.length} NPCs • ${questDefinitions.length} quests • one uploadable World Pack`;
}

function buildDeveloperPanel(){
  ensureDeveloperStyles();
  const root=document.createElement("aside");
  root.id="devPanel";
  root.innerHTML=`
    <div class="devHeader"><div><b>WORLD BUILDER</b><span>F2 to close • props, NPCs, quests, scale, and testing</span></div><button id="devClose">×</button></div>
    <div class="devToolbar">
      <button id="devSelect" class="active">Select / Move</button>
      <label>Snap <select id="devSnap"><option>4</option><option selected>8</option><option>16</option><option>32</option><option>64</option></select></label>
      <label><input id="devGrid" type="checkbox" checked> Grid</label>
      <label><input id="devHitboxes" type="checkbox" checked> Hitboxes</label>
      <label><input id="devDepthLines" type="checkbox" checked> Depth Lines</label>
    </div>
    <div class="devTabs">
      <button class="devTab active" data-dev-tab="objects">Objects</button>
      <button class="devTab" data-dev-tab="npcs">NPCs</button>
      <button class="devTab" data-dev-tab="quests">Quests</button>
      <button class="devTab" data-dev-tab="selection">Selection</button>
      <button class="devTab" data-dev-tab="scale">Visual Scale</button>
      <button class="devTab" data-dev-tab="combat">Combat Test</button>
      <button class="devTab" data-dev-tab="project">Project</button>
    </div>
    <div class="devBody">
      <section class="devView active" data-dev-view="objects">
        <div class="devSection"><div class="devSectionTitle">Prop Palette</div><div class="devHint">Choose a prop, then click the world to place it. Switch back to Select / Move when finished.</div><div id="devPalette"></div></div>
        <div class="devSection"><div class="devSectionTitle">Existing Objects <span id="devObjectCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><div id="devObjectList"></div></div>
      </section>
      <section class="devView" data-dev-view="npcs">
        <div class="devSection"><div class="devSectionTitle">NPC Models</div><div class="devHint">Choose a model, then click the world to place an NPC. Click or drag existing NPCs directly in the world.</div><div class="devNpcPalette"><button data-npc-template="lilly">+ Lilly Model</button><button data-npc-template="jorge">+ Jorge Model</button><button data-npc-template="blank">+ Placeholder Model</button></div></div>
        <div class="devSection"><div class="devSectionTitle">Existing NPCs <span id="devNpcCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><div id="devNpcList"></div></div>
        <div class="devSection"><div class="devSectionTitle">NPC Inspector</div><div id="devNpcInspector"></div></div>
      </section>
      <section class="devView" data-dev-view="quests">
        <div class="devSection"><div class="devSectionTitle">Quest Library <span id="devQuestCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><div class="devHint">Create quests from dropdowns instead of code. Objectives can kill, collect, talk, deliver, or visit a world position.</div><div id="devQuestList"></div><div class="devQuestListActions"><button id="devNewQuest">New Quest</button><button id="devDuplicateQuest">Duplicate</button><button id="devDeleteQuest">Delete</button></div></div>
        <div class="devSection"><div class="devSectionTitle">Quest Maker</div><div id="devQuestEditor"></div></div>
      </section>
      <section class="devView" data-dev-view="selection">
        <div class="devSection"><div class="devSectionTitle">Selection Library <span id="devSelectionCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><div class="devHint">Props and NPCs live together here for visual placement work. Select an NPC to adjust its model size, collision hitbox, and depth line.</div><div id="devSelectionList"></div></div>
        <div class="devSection"><div class="devSectionTitle">Selected Item</div><div class="devHint">Click a prop or NPC in the world, or choose one above. Drag it directly in the world to reposition it.</div><div id="devInspector"></div></div>
        <div class="devSection"><div class="devSectionTitle">Layout File</div><div class="devProjectActions"><button id="devExport">Export world-objects.js</button><button id="devLoadDraft">Load Local Draft</button><button id="devReset">Use Project Layout</button></div></div>
      </section>
      <section class="devView" data-dev-view="scale">
        <div class="devSection"><div class="devSectionTitle">Selected Mob Type</div><div class="devHint">Click a mob in the world. This slider changes only that mob type — for example, selecting a Wolf changes Wolves without changing Goblins or Slimes.</div><div id="devMobScalePanel"></div></div>
        <div class="devSection"><div class="devSectionTitle">World Visual Scale</div><div class="devHint">These controls change broad world elements. Mob species are controlled separately above.</div><div id="devScalePanel">
          <div class="devScaleControl"><div class="devScaleTop"><span>Player</span><span data-scale-value="player"></span></div><input data-scale-key="player" type="range" min="0.50" max="3.00" step="0.05" value="${VISUAL_SCALE.player}"></div>
          <div class="devScaleControl"><div class="devScaleTop"><span>Houses</span><span data-scale-value="houses"></span></div><input data-scale-key="houses" type="range" min="0.50" max="3.00" step="0.05" value="${VISUAL_SCALE.houses}"></div>
          <div class="devScaleControl"><div class="devScaleTop"><span>NPCs</span><span data-scale-value="npcs"></span></div><input data-scale-key="npcs" type="range" min="0.50" max="3.00" step="0.05" value="${VISUAL_SCALE.npcs}"></div>
          <div class="devScaleControl"><div class="devScaleTop"><span>Props</span><span data-scale-value="props"></span></div><input data-scale-key="props" type="range" min="0.50" max="3.00" step="0.05" value="${VISUAL_SCALE.props}"></div>
        </div><div class="devRow"><button id="devExportScale">Export visual-settings.js</button><button id="devResetScale">Reset Scale Settings</button></div></div>
      </section>
      <section class="devView" data-dev-view="combat">
        <div class="devSection"><div class="devSectionTitle">Player Test Level</div><div id="devPlayerTestPanel"></div></div>
        <div class="devSection"><div class="devSectionTitle">Mob Species Tuning</div><div class="devHint">Change a species' level range and base combat values, apply them live, then reroll its current spawns if you want new levels/elites immediately.</div><div id="devCombatSpecies"></div></div>
        <div class="devSection"><div class="devSectionTitle">Global Mob-Level Rules</div><div class="devHint">These values control level growth, danger boosts, elites, bosses, aggro, hit chance, and XP across the whole game.</div><div id="devCombatGlobals"></div></div>
      </section>
      <section class="devView" data-dev-view="project">
        <div class="devSection"><div class="devSectionTitle">World Pack</div><div class="devProjectNote">This is the new recommended workflow. Make many prop, NPC, quest, visual, and combat changes in World Builder, then export one <b>little-realm-world-pack.json</b>. Upload that single file when you want the project source updated.</div><div id="devProjectSummary" class="devHint" style="margin-top:9px"></div><div class="devProjectBig"><button id="devExportWorldPack" class="primary">Export World Pack (.json)</button><button id="devImportWorldPack">Import World Pack</button><button id="devSaveDraftNow">Save Local Draft</button><button id="devLoadDraftProject">Load Local Draft</button><button id="devResetProject" class="danger">Use Deployed Project</button></div><input id="devImportWorldPackFile" type="file" accept="application/json,.json" hidden></div>
        <div class="devSection"><div class="devSectionTitle">Individual Config Exports</div><div class="devHint">Useful when only one content file changed.</div><div class="devProjectBig"><button id="devExportObjectsOnly">world-objects.js</button><button id="devExportNpcsOnly">npcs.js</button><button id="devExportQuestsOnly">quests.js</button><button id="devExportScaleProject">visual-settings.js</button><button id="devExportBalanceProject">game-balance.js</button></div></div>
      </section>
    </div>
    <div id="devStatus">F2 toggles World Builder</div>`;
  document.body.appendChild(root);
  devPanel=root;
  root.querySelector("#devClose").onclick=()=>setDeveloperMode(false);
  root.querySelector("#devSelect").onclick=()=>{
    devPlaceType=null;devPlaceNpcTemplate=null;
    if(devHitboxEditing) setDeveloperHitboxEditing(false);
    else if(devDepthEditing) setDeveloperDepthEditing(false);
    else{ updateDevPaletteActive();devSetStatus("Select / Move mode"); }
  };
  root.querySelector("#devSnap").onchange=e=>{devSnap=Number(e.target.value)||8;};
  root.querySelector("#devGrid").onchange=e=>{devShowGrid=e.target.checked;};
  root.querySelector("#devHitboxes").onchange=e=>{devShowHitboxes=e.target.checked;};
  root.querySelector("#devDepthLines").onchange=e=>{devShowDepthLines=e.target.checked;};
  root.querySelector("#devExport").onclick=exportDeveloperLayout;
  root.querySelector("#devLoadDraft").onclick=loadDeveloperDraft;
  root.querySelector("#devReset").onclick=resetDeveloperLayout;
  root.querySelector("#devNewQuest").onclick=createDeveloperQuest;
  root.querySelector("#devDuplicateQuest").onclick=duplicateDeveloperQuest;
  root.querySelector("#devDeleteQuest").onclick=deleteDeveloperQuest;
  root.querySelectorAll("[data-npc-template]").forEach(button=>button.onclick=()=>{
    devPlaceNpcTemplate=button.dataset.npcTemplate;devPlaceType=null;devSelected=null;devSelectedNpc=null;devSelectedMob=null;setDeveloperTab("npcs");updateDevPaletteActive();refreshDeveloperPanel();devSetStatus(`Placing ${button.textContent.replace(/^\+\s*/,"")} — click the world`);
  });
  root.querySelector("#devExportWorldPack").onclick=exportDeveloperWorldPack;
  root.querySelector("#devImportWorldPack").onclick=()=>root.querySelector("#devImportWorldPackFile").click();
  root.querySelector("#devImportWorldPackFile").onchange=e=>{importDeveloperWorldPackFile(e.target.files?.[0]);e.target.value="";};
  root.querySelector("#devSaveDraftNow").onclick=saveDeveloperDraft;
  root.querySelector("#devLoadDraftProject").onclick=loadDeveloperDraft;
  root.querySelector("#devResetProject").onclick=resetDeveloperProject;
  root.querySelector("#devExportObjectsOnly").onclick=exportDeveloperLayout;
  root.querySelector("#devExportNpcsOnly").onclick=exportDeveloperNpcs;
  root.querySelector("#devExportQuestsOnly").onclick=exportDeveloperQuests;
  root.querySelector("#devExportScaleProject").onclick=exportVisualSettings;
  root.querySelector("#devExportBalanceProject").onclick=exportDeveloperBalance;
  root.querySelectorAll(".devTab").forEach(b=>b.onclick=()=>setDeveloperTab(b.dataset.devTab));
  root.querySelectorAll("[data-scale-key]").forEach(input=>{
    updateVisualScaleControl(input.dataset.scaleKey,input.value);
    input.oninput=()=>updateVisualScaleControl(input.dataset.scaleKey,input.value);
  });
  root.querySelector("#devExportScale").onclick=exportVisualSettings;
  root.querySelector("#devResetScale").onclick=resetVisualScale;
  const palette=root.querySelector("#devPalette");
  const propTypes=[...Object.keys(PROP_SPECS),"caveEntrance"];
  for(const type of propTypes){
    const b=document.createElement("button");b.className="devPropButton";b.dataset.type=type;b.title=type;
    const cv=document.createElement("canvas");cv.width=48;cv.height=48;
    const name=document.createElement("span");name.textContent=type.replace(/([A-Z])/g," $1");
    b.append(cv,name);
    b.onclick=()=>{devPlaceType=type;devPlaceNpcTemplate=null;devSelectedMob=null;devSelectedNpc=null;devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;setDeveloperTab("objects");updateDevPaletteActive();devSetStatus(`Placing ${type} — click the world`);};
    palette.appendChild(b);
    drawPaletteThumb(cv,type);
  }
  if(!propAtlasReady) propAtlas.addEventListener("load",()=>root.querySelectorAll(".devPropButton").forEach(b=>drawPaletteThumb(b.querySelector("canvas"),b.dataset.type)),{once:true});
  setDeveloperTab(devActiveTab);
  refreshDeveloperPanel();
  devSetStatus(`${propTypes.length} prop types • ${sceneryNPCs.length} NPCs • ${questDefinitions.length} quests • World Pack export ready`);
  return root;
}
function updateDevPaletteActive(){
  if(!devPanel)return;
  devPanel.querySelectorAll(".devPropButton").forEach(b=>b.classList.toggle("active",b.dataset.type===devPlaceType));
  devPanel.querySelectorAll("[data-npc-template]").forEach(b=>b.classList.toggle("active",b.dataset.npcTemplate===devPlaceNpcTemplate));
  devPanel.querySelector("#devSelect")?.classList.toggle("active",!devPlaceType&&!devPlaceNpcTemplate);
}

function setDeveloperMode(active){
  devModeActive=!!active;
  if(!devPanel) buildDeveloperPanel();
  devPanel.classList.toggle("show",devModeActive);
  document.body.classList.toggle("devMode",devModeActive);
  input={up:false,down:false,left:false,right:false};
  isHeroMoving=false;
  if(!devModeActive){
    devDragging=false;devNpcDragging=false;
    devPlaceType=null;devPlaceNpcTemplate=null;
    devHitboxEditing=false;
    devHitboxDrag=null;
    devDepthEditing=false;
    devDepthDrag=null;
    if(game?.style) game.style.cursor="";
  }
  updateDevPaletteActive();
  if(devModeActive){
    // Rebuild the live panels now that normal game state is guaranteed to exist.
    refreshDeveloperPanel();
    devSetStatus("World Builder active — edit props, NPCs, quests, and export one World Pack when ready");
  }
}
function toggleDeveloperMode(){setDeveloperMode(!devModeActive);}

function initDeveloperMode(){
  // Headless validator DOMs intentionally omit document.body; the real browser has it.
  if(!document.body || typeof document.createElement!=="function" || !game?.addEventListener) return;
  buildDeveloperPanel();
  game.addEventListener("pointerdown",devPointerDown,true);
  game.addEventListener("pointermove",devPointerMove,true);
  game.addEventListener("pointerup",devPointerUp,true);
  game.addEventListener("pointercancel",devPointerUp,true);
  window.addEventListener("pointermove",devPointerMove,true);
  window.addEventListener("pointerup",devPointerUp,true);
  window.addEventListener("keydown",event=>{
    if(event.code==="F2"){
      event.preventDefault();toggleDeveloperMode();return;
    }
    if(!devModeActive)return;
    if(event.code==="Escape"){
      if(devHitboxEditing){setDeveloperHitboxEditing(false);}
      else if(devDepthEditing){setDeveloperDepthEditing(false);}
      else if(devPlaceType||devPlaceNpcTemplate){devPlaceType=null;devPlaceNpcTemplate=null;updateDevPaletteActive();devSetStatus("Select / Move mode");}
      else if(devSelectedNpc){devSelectedNpc=null;refreshDeveloperPanel();}
      else if(devSelected){devSelected=null;refreshDeveloperPanel();}
      return;
    }
    if((event.code==="Delete"||event.code==="Backspace") && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)){
      if(devSelectedNpc){event.preventDefault();deleteDeveloperNpc();}
      else if(devSelected){event.preventDefault();deleteDeveloperSelection();}
    }
  },true);
}
