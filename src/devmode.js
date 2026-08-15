const DEV_DRAFT_KEY = "littleRealmWorldBuilderDraftV1";
let devModeActive=false;
let devPanel=null;
let devSelected=null;
let devPlaceType=null;
let devDragging=false;
let devDragOffset={x:0,y:0};
let devShowGrid=true;
let devShowHitboxes=true;
let devSnap=8;
let devStatusTimer=null;

function ensureDeveloperStyles(){
  if(document.getElementById("littleRealmDevStyles")) return;
  const style=document.createElement("style");
  style.id="littleRealmDevStyles";
  style.textContent=`
    #devPanel{position:fixed!important;z-index:10000!important;top:10px!important;right:10px!important;width:min(430px,44vw)!important;height:calc(100vh - 20px)!important;background:rgba(24,20,30,.98)!important;border:1px solid rgba(255,255,255,.22)!important;border-radius:14px!important;box-shadow:0 18px 50px rgba(0,0,0,.55)!important;color:#f8f2ff!important;display:none!important;overflow:hidden!important;font:12px system-ui,sans-serif!important;backdrop-filter:blur(8px)!important}
    #devPanel.show{display:flex!important;flex-direction:column!important}
    #devPanel *{box-sizing:border-box}
    #devPanel .devHeader{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#453552;border-bottom:1px solid rgba(255,255,255,.12)}
    #devPanel .devHeader b{display:block;font-size:14px;letter-spacing:.08em} #devPanel .devHeader span{display:block;font-size:10px;color:#cdbed9;margin-top:2px}
    #devPanel button,#devPanel select,#devPanel input{font:inherit}
    #devPanel .devHeader button{width:32px;height:32px;border:0;border-radius:8px;background:#2a2132;color:white;font-size:20px}
    #devPanel .devToolbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:8px;border-bottom:1px solid rgba(255,255,255,.1)}
    #devPanel .devToolbar button,#devPanel .devToolbar select,#devPanel .devProjectActions button,#devPanel .devRow button{border:1px solid rgba(255,255,255,.14);background:#5a4869;color:#fff;border-radius:7px;padding:7px 8px;font-weight:700}
    #devPanel .devToolbar button.active,#devPanel .devPropButton.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel .devToolbar label{display:flex;gap:4px;align-items:center;color:#e5d9ec}
    #devPanel .devSectionTitle{padding:7px 10px 5px;font-weight:900;color:#d8c1e7;letter-spacing:.06em;text-transform:uppercase}
    #devPanel #devPalette{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:5px!important;padding:0 8px 8px!important;min-height:118px!important;max-height:220px!important;overflow:auto!important}
    #devPanel .devPropButton{min-width:0;border:1px solid rgba(255,255,255,.12);background:#30283a;color:#eee;border-radius:7px;padding:3px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer}
    #devPanel .devPropButton canvas{width:48px;height:48px;image-rendering:pixelated;background:rgba(255,255,255,.025);border-radius:4px}
    #devPanel .devPropButton span{font-size:9px;line-height:1.05;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:capitalize}
    #devPanel #devObjectList{display:flex;gap:4px;overflow:auto;padding:0 8px 8px;min-height:44px;max-height:92px;flex-wrap:wrap;align-content:flex-start}
    #devPanel .devObjectChip{border:1px solid rgba(255,255,255,.12);background:#2e2736;color:#e9dff0;border-radius:999px;padding:5px 8px;font-size:10px;cursor:pointer}
    #devPanel .devObjectChip.active{outline:2px solid #63e6ff;background:#385a64}
    #devPanel #devInspector{padding:0 10px 10px;overflow:auto;min-height:90px}
    #devPanel .devEmpty{color:#baaec2;padding:8px;background:#2b2432;border-radius:8px}.devSelectedTitle{font-size:14px;font-weight:900;margin-bottom:7px;color:#7ceaff;text-transform:capitalize}
    #devPanel #devInspector label{display:flex;flex-direction:column;gap:3px;margin:5px 0;color:#d7cbdc}
    #devPanel #devInspector input[type=text],#devPanel #devInspector input[type=number],#devPanel #devInspector input:not([type]){width:100%;background:#1c1821;color:#fff;border:1px solid #594b62;border-radius:6px;padding:6px}
    #devPanel .devChecks{display:grid;grid-template-columns:1fr 1fr;gap:3px} #devPanel .devChecks label{flex-direction:row!important;align-items:center!important}
    #devPanel .devPair{display:grid;grid-template-columns:1fr 1fr;gap:7px} #devPanel .devQuad{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
    #devPanel .devSubhead{font-weight:800;margin-top:7px;color:#c9b9d2} #devPanel .devRow{display:flex;gap:5px;margin-top:8px} #devPanel .devRow button{flex:1} #devPanel .devRow .danger{background:#713b47}
    #devPanel .devProjectActions{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:8px 10px;border-top:1px solid rgba(255,255,255,.1)} #devPanel .devProjectActions button:first-child{grid-column:1/-1;background:#38606a}
    #devPanel #devStatus{padding:7px 10px;background:#1d1822;color:#bdb0c5;font-size:10px;margin-top:auto}
    body.devMode #pcControls{opacity:.25}
    @media(max-width:900px){#devPanel{width:calc(100vw - 16px)!important;right:8px!important;top:8px!important;height:calc(100vh - 16px)!important}#devPanel #devPalette{grid-template-columns:repeat(6,minmax(0,1fr))!important}}
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

function saveDeveloperDraft(){
  try{
    localStorage.setItem(DEV_DRAFT_KEY,JSON.stringify(sceneryProps));
    devSetStatus("Draft autosaved locally");
  }catch(err){ console.warn("Could not save developer draft",err); }
}

function loadDeveloperDraft(){
  try{
    const raw=localStorage.getItem(DEV_DRAFT_KEY);
    if(!raw){devSetStatus("No local draft found");return;}
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed)) throw new Error("Draft is not an array");
    sceneryProps.splice(0,sceneryProps.length,...parsed.map(cloneWorldObject));
    devSelected=null;
    rebuildWorldObjectCollision();
    refreshDeveloperPanel();
    devSetStatus(`Loaded ${sceneryProps.length} draft objects`);
  }catch(err){
    console.error(err); devSetStatus("Draft could not be loaded");
  }
}

function resetDeveloperLayout(){
  if(!confirm("Reset the live editor to the project layout? Your local draft will remain until you overwrite it.")) return;
  sceneryProps.splice(0,sceneryProps.length,...getProjectWorldObjects());
  devSelected=null;
  rebuildWorldObjectCollision();
  refreshDeveloperPanel();
  devSetStatus("Project layout restored");
}

function exportDeveloperLayout(){
  const clean=sceneryProps.map(cloneWorldObject);
  const text=`/* Exported from Little Realm Developer Mode */\nwindow.LR_WORLD_OBJECTS = ${JSON.stringify(clean,null,2)};\n`;
  const blob=new Blob([text],{type:"text/javascript"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download="world-objects.js";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  devSetStatus("Exported world-objects.js");
}

function devSetStatus(text){
  if(!devPanel) return;
  const el=devPanel.querySelector("#devStatus");
  if(el) el.textContent=text;
  clearTimeout(devStatusTimer);
  devStatusTimer=setTimeout(()=>{if(el)el.textContent="F2 toggles World Builder";},2200);
}

function placeDeveloperObject(type,wx,wy){
  const spec=PROP_SPECS[type];
  if(!spec) return;
  const obj=defaultWorldObject(type,snapDev(wx-spec.w/2),snapDev(wy-spec.h/2));
  sceneryProps.push(obj);
  devSelected=obj;
  rebuildWorldObjectCollision();
  saveDeveloperDraft();
  refreshDeveloperPanel();
}

function devPointerDown(event){
  if(!devModeActive) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const p=devWorldFromPointer(event);
  if(devPlaceType){
    placeDeveloperObject(devPlaceType,p.x,p.y);
    return;
  }
  devSelected=findWorldObjectAt(p.x,p.y);
  if(devSelected){
    devDragging=true;
    devDragOffset={x:p.x-devSelected.x,y:p.y-devSelected.y};
    try{ game.setPointerCapture?.(event.pointerId); }catch{}
    devSetStatus(`Selected ${devSelected.label||devSelected.type} — drag to move`);
  }else{
    devSetStatus("No prop under cursor — choose one from the palette or Existing Objects");
  }
  refreshDeveloperPanel();
}
function devPointerMove(event){
  if(!devModeActive || !devDragging || !devSelected) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const p=devWorldFromPointer(event);
  devSelected.x=snapDev(p.x-devDragOffset.x);
  devSelected.y=snapDev(p.y-devDragOffset.y);
  rebuildWorldObjectCollision();
  refreshDeveloperInspectorValues();
}
function devPointerUp(event){
  if(!devModeActive || !devDragging) return;
  event.preventDefault(); event.stopImmediatePropagation();
  devDragging=false;
  try{ game.releasePointerCapture?.(event.pointerId); }catch{}
  saveDeveloperDraft();
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
  }
  if(devSelected){
    const spec=worldObjectSpec(devSelected);
    if(spec){
      const x=devSelected.x-camX,y=devSelected.y-camY;
      ctx.strokeStyle="#63e6ff";
      ctx.lineWidth=2/CAMERA_ZOOM;
      ctx.strokeRect(x-2,y-2,spec.w+4,spec.h+4);
    }
  }
  ctx.restore();
}

function deleteDeveloperSelection(){
  if(!devSelected) return;
  const i=sceneryProps.indexOf(devSelected);
  if(i>=0) sceneryProps.splice(i,1);
  devSelected=null;
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
  rebuildWorldObjectCollision();
  saveDeveloperDraft();
  refreshDeveloperPanel(false);
}

function refreshDeveloperInspectorValues(){
  if(!devPanel||!devSelected) return;
  const q=id=>devPanel.querySelector(`#${id}`);
  if(q("devX")) q("devX").value=Math.round(devSelected.x);
  if(q("devY")) q("devY").value=Math.round(devSelected.y);
}

function drawPaletteThumb(canvas,type){
  const spec=PROP_SPECS[type];
  if(!canvas||!spec||!propAtlasReady) return;
  const c=canvas.getContext("2d");
  c.clearRect(0,0,48,48); c.imageSmoothingEnabled=false;
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
      devPlaceType=null;
      devSelected=obj;
      updateDevPaletteActive();
      refreshDeveloperPanel();
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
  if(!devSelected){
    inspector.innerHTML='<div class="devEmpty">Select an object in the world or choose a prop from the palette and click to place it.</div>';
    return;
  }
  const hb=devSelected.hitbox||{x:0,y:0,w:16,h:12};
  inspector.innerHTML=`
    <div class="devSelectedTitle">${devSelected.type}</div>
    <label>Label<input id="devLabel" value="${String(devSelected.label||devSelected.type).replace(/"/g,"&quot;")}"></label>
    <div class="devPair"><label>X<input id="devX" type="number" value="${Math.round(devSelected.x)}"></label><label>Y<input id="devY" type="number" value="${Math.round(devSelected.y)}"></label></div>
    <div class="devChecks"><label><input id="devSolid" type="checkbox" ${devSelected.solid?"checked":""}> Hitbox / Solid</label><label><input id="devInteractable" type="checkbox" ${devSelected.interactable?"checked":""}> Interactable</label><label><input id="devContainer" type="checkbox" ${devSelected.container?"checked":""}> Container</label></div>
    <div class="devSubhead">Hitbox offset / size</div>
    <div class="devQuad"><label>X<input id="devHbX" type="number" value="${hb.x}"></label><label>Y<input id="devHbY" type="number" value="${hb.y}"></label><label>W<input id="devHbW" type="number" value="${hb.w}"></label><label>H<input id="devHbH" type="number" value="${hb.h}"></label></div>
    <label>Container slots<input id="devCapacity" type="number" min="0" value="${devSelected.capacity||0}"></label>
    <div class="devRow"><button id="devApply">Apply</button><button id="devDuplicate">Duplicate</button><button id="devDelete" class="danger">Delete</button></div>`;
  inspector.querySelector("#devApply").onclick=applyDeveloperInspector;
  inspector.querySelector("#devDuplicate").onclick=duplicateDeveloperSelection;
  inspector.querySelector("#devDelete").onclick=deleteDeveloperSelection;
}

function buildDeveloperPanel(){
  ensureDeveloperStyles();
  const root=document.createElement("aside");
  root.id="devPanel";
  root.innerHTML=`
    <div class="devHeader"><div><b>WORLD BUILDER</b><span>F2 to close</span></div><button id="devClose">×</button></div>
    <div class="devToolbar">
      <button id="devSelect" class="active">Select / Move</button>
      <label>Snap <select id="devSnap"><option>4</option><option selected>8</option><option>16</option><option>32</option><option>64</option></select></label>
      <label><input id="devGrid" type="checkbox" checked> Grid</label>
      <label><input id="devHitboxes" type="checkbox" checked> Hitboxes</label>
    </div>
    <div class="devSectionTitle">Prop Palette</div>
    <div id="devPalette"></div>
    <div class="devSectionTitle">Existing Objects <span id="devObjectCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div>
    <div id="devObjectList"></div>
    <div class="devSectionTitle">Selected Object</div>
    <div id="devInspector"></div>
    <div class="devProjectActions"><button id="devExport">Export world-objects.js</button><button id="devLoadDraft">Load Local Draft</button><button id="devReset">Use Project Layout</button></div>
    <div id="devStatus">F2 toggles World Builder</div>`;
  document.body.appendChild(root);
  devPanel=root;
  root.querySelector("#devClose").onclick=()=>setDeveloperMode(false);
  root.querySelector("#devSelect").onclick=()=>{devPlaceType=null;updateDevPaletteActive();};
  root.querySelector("#devSnap").onchange=e=>{devSnap=Number(e.target.value)||8;};
  root.querySelector("#devGrid").onchange=e=>{devShowGrid=e.target.checked;};
  root.querySelector("#devHitboxes").onchange=e=>{devShowHitboxes=e.target.checked;};
  root.querySelector("#devExport").onclick=exportDeveloperLayout;
  root.querySelector("#devLoadDraft").onclick=loadDeveloperDraft;
  root.querySelector("#devReset").onclick=resetDeveloperLayout;
  const palette=root.querySelector("#devPalette");
  const propTypes=Object.keys(PROP_SPECS);
  for(const type of propTypes){
    const b=document.createElement("button");b.className="devPropButton";b.dataset.type=type;b.title=type;
    const cv=document.createElement("canvas");cv.width=48;cv.height=48;
    const name=document.createElement("span");name.textContent=type.replace(/([A-Z])/g," $1");
    b.append(cv,name);
    b.onclick=()=>{devPlaceType=type;updateDevPaletteActive();devSetStatus(`Placing ${type} — click the world`);};
    palette.appendChild(b);
    drawPaletteThumb(cv,type);
  }
  if(!propAtlasReady) propAtlas.addEventListener("load",()=>root.querySelectorAll(".devPropButton").forEach(b=>drawPaletteThumb(b.querySelector("canvas"),b.dataset.type)),{once:true});
  refreshDeveloperPanel();
  devSetStatus(`${propTypes.length} props available • ${sceneryProps.length} existing objects`);
  return root;
}
function updateDevPaletteActive(){
  if(!devPanel)return;
  devPanel.querySelectorAll(".devPropButton").forEach(b=>b.classList.toggle("active",b.dataset.type===devPlaceType));
  devPanel.querySelector("#devSelect")?.classList.toggle("active",!devPlaceType);
}

function setDeveloperMode(active){
  devModeActive=!!active;
  if(!devPanel) buildDeveloperPanel();
  devPanel.classList.toggle("show",devModeActive);
  document.body.classList.toggle("devMode",devModeActive);
  input={up:false,down:false,left:false,right:false};
  isHeroMoving=false;
  if(!devModeActive){devDragging=false;devPlaceType=null;}
  updateDevPaletteActive();
  if(devModeActive) devSetStatus("Developer Mode active — select, drag, or place props");
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
      if(devPlaceType){devPlaceType=null;updateDevPaletteActive();devSetStatus("Select / Move mode");}
      else if(devSelected){devSelected=null;refreshDeveloperPanel();}
      return;
    }
    if((event.code==="Delete"||event.code==="Backspace") && devSelected && !["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)){
      event.preventDefault();deleteDeveloperSelection();
    }
  },true);
}
