function defaultWorldObject(type,x,y){
  const objectId=developerObjectDefinitionIdFromPlaceType(type)||String(type||"");
  const definition=developerObjectDefinition(objectId);
  if(!definition)return null;
  const spec={w:Math.max(8,numberOr(definition.w,64)),h:Math.max(8,numberOr(definition.h,64))};
  const hitH=Math.max(8,Math.round(spec.h*.26));
  const hitW=Math.max(10,Math.round(spec.w*.66));
  return {
    id:`${objectId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,
    type:"object",
    objectId,
    x:Math.round(x),
    y:Math.round(y),
    solid:definition.solid===true,
    hitbox:{x:Math.round((spec.w-hitW)/2),y:spec.h-hitH,w:hitW,h:hitH},
    depthMode:WORLD_OBJECT_DEPTH_MODES.has(definition.depthMode)?definition.depthMode:"ysort",
    depthY:numberOr(definition.depthY,spec.h),
    interactable:false,
    label:definition.name||objectId,
    capacity:8,
    contents:[]
  };
}

function devWorldFromPointer(event){
  const camera=developerCameraFrame(innerWidth,innerHeight);
  return {x:camera.camX+event.clientX/camera.zoom,y:camera.camY+event.clientY/camera.zoom};
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
function developerMobVisualBounds(mob){
  if(!mob)return {x:0,y:0,w:32,h:32};
  const h=mobWorldDisplayHeight(mob);let ratio=.78;
  try{
    const path=String(mob?.template?.sprite||"");const record=path?dynamicMobSheet(path):null;const layout=mob?.template?.spriteLayout||{};
    if(record?.ready&&record.image?.naturalWidth){const rows=Math.max(1,Math.floor(numberOr(layout.rows,4))),rowMap=layout.directionRows||{down:0,right:1,left:2,up:3},row=clamp(Math.floor(numberOr(rowMap[mob.facing||"down"],0)),0,rows-1),meta=spriteFrameMeta(record.image,row,0);if(meta?.sh>0)ratio=Math.max(.2,Math.min(3,meta.sw/meta.sh));}
  }catch{}
  const w=Math.max(8,h*ratio);return {x:mob.x-w/2,y:mob.y+8-h,w,h};
}
function developerVisualSizeTarget(){
  const entity=developerSelectedEntity();
  if(entity){if(developerIsNpc(entity))return {kind:"npc",entity};if(worldObjectSpritePath(entity))return {kind:"object",entity};}
  if(devSelectedMob&&devActiveTab==="scale")return {kind:"mob",entity:devSelectedMob,key:mobTypeScaleKey(devSelectedMob)};
  return null;
}
function developerVisualSizeBounds(target=developerVisualSizeTarget()){
  if(!target)return null;if(target.kind==="mob")return developerMobVisualBounds(target.entity);return developerEntityBounds(target.entity);
}
function developerVisualSizeHandlePoints(target=developerVisualSizeTarget(),bounds=developerVisualSizeBounds(target)){
  if(!target||!bounds)return [];
  const l=bounds.x,t=bounds.y,r=bounds.x+bounds.w,b=bounds.y+bounds.h,mx=(l+r)/2,my=(t+b)/2;
  if(target.kind==="object")return [["nw",l,t],["n",mx,t],["ne",r,t],["w",l,my],["e",r,my],["sw",l,b],["s",mx,b],["se",r,b]];
  return [["nw",l,t],["ne",r,t],["sw",l,b],["se",r,b]];
}
function findDeveloperSizeInteraction(wx,wy){
  if(!devSizeEditing)return null;const target=developerVisualSizeTarget(),bounds=developerVisualSizeBounds(target);if(!target||!bounds)return null;
  const grab=8/developerCameraZoomValue();for(const [handle,x,y] of developerVisualSizeHandlePoints(target,bounds))if(Math.abs(wx-x)<=grab&&Math.abs(wy-y)<=grab)return handle;return null;
}
function setDeveloperSizeEditing(active){
  const target=developerVisualSizeTarget();devSizeEditing=!!active&&!!target;devSizeDrag=null;
  if(devSizeEditing){devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;devInteractionEditing=false;devInteractionDrag=null;devSetStatus(target.kind==="mob"?`Visual size edit — drag a blue corner to resize every ${mobTypeScaleLabel(target.key).toLowerCase()}`:"Visual size edit — drag the blue sprite box handles to resize by eye");}
  else{if(game?.style)game.style.cursor="";devSetStatus("Visual size edit mode finished");}
  refreshDeveloperPanel();refreshDeveloperToolStrip?.();
}
function updateDeveloperSizeDrag(p){
  if(!devSizeDrag)return;const d=devSizeDrag,handle=d.handle;
  if(d.kind==="object"){
    const dx=Math.round(p.x-d.pointerX),dy=Math.round(p.y-d.pointerY),min=8,start=d.bounds;let left=start.x,top=start.y,right=start.x+start.w,bottom=start.y+start.h;
    if(handle.includes("w"))left=Math.min(right-min,start.x+dx);if(handle.includes("e"))right=Math.max(left+min,start.x+start.w+dx);if(handle.includes("n"))top=Math.min(bottom-min,start.y+dy);if(handle.includes("s"))bottom=Math.max(top+min,start.y+start.h+dy);
    d.entity.x=Math.round(left);d.entity.y=Math.round(top);d.entity.w=Math.max(min,Math.round(right-left));d.entity.h=Math.max(min,Math.round(bottom-top));rebuildWorldObjectCollision();refreshDeveloperInspectorValues();return;
  }
  const vx=p.x-d.anchorX,vy=p.y-d.anchorY,current=Math.max(1,Math.hypot(vx,vy)),scale=current/Math.max(1,d.startDistance),max=d.kind==="mob"?160:320,height=Math.round(Math.max(d.kind==="mob"?8:24,Math.min(max,d.startHeight*scale)));
  if(d.kind==="npc"){
    d.entity.displayHeight=height;rebuildNpcCollision();refreshDeveloperInspectorValues();return;
  }
  if(d.kind==="mob"){
    const rec=BALANCE.mobs?.[d.key];if(!rec)return;rec.displayHeight=height;const nearest=nearestMobSizeClass(height),preset=mobSizeClassHeight(nearest);rec.sizeClass=Math.abs(height-preset)<=1?nearest:"custom";
    for(const template of mobTemplates||[])if(template?.configKey===d.key){template.displayHeight=height;template.sizeClass=rec.sizeClass;}
    const input=devPanel?.querySelector("#devSelectedMobScale"),out=devPanel?.querySelector("#devSelectedMobScaleValue");if(input)input.value=height;if(out)out.textContent=`${height}px • ${mobRelativePlayerScale(height).toFixed(2)}× player`;
  }
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
  const grab=8/developerCameraZoomValue();
  return wx>=b.x-grab*2 && wx<=b.x+b.w+grab*2 && Math.abs(wy-lineY)<=grab;
}

function setDeveloperDepthEditing(active){
  const entity=developerSelectedEntity();
  devDepthEditing=!!active && !!entity && developerEntityDepthMode(entity)==="ysort";
  devDepthDrag=null;
  if(devDepthEditing){
    devHitboxEditing=false;
    devHitboxDrag=null;
    devInteractionEditing=false;
    devInteractionDrag=null;
    devSizeEditing=false;
    devSizeDrag=null;
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
  const grab=7/developerCameraZoomValue();
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
    devInteractionEditing=false;
    devInteractionDrag=null;
    devSizeEditing=false;
    devSizeDrag=null;
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

function ensureDeveloperInteractionArea(obj=devSelected){
  if(!obj||developerIsNpc(obj)) return null;
  obj.interaction=obj.interaction&&typeof obj.interaction==="object"?obj.interaction:{};
  if(!obj.interaction.area||typeof obj.interaction.area!=="object") obj.interaction.area={...worldInteractionDefaults(obj)};
  const a=obj.interaction.area;
  a.x=Math.round(numberOr(a.x,0));a.y=Math.round(numberOr(a.y,0));a.w=Math.max(4,Math.round(numberOr(a.w,16)));a.h=Math.max(4,Math.round(numberOr(a.h,16)));
  return a;
}

function findDeveloperInteractionAreaHandle(wx,wy){
  const obj=devSelected;if(!devInteractionEditing||!obj)return null;
  const a=ensureDeveloperInteractionArea(obj);if(!a)return null;
  const left=obj.x+a.x,top=obj.y+a.y,right=left+a.w,bottom=top+a.h,grab=7/developerCameraZoomValue();
  if(wx<left-grab||wx>right+grab||wy<top-grab||wy>bottom+grab)return null;
  const nearL=Math.abs(wx-left)<=grab,nearR=Math.abs(wx-right)<=grab,nearT=Math.abs(wy-top)<=grab,nearB=Math.abs(wy-bottom)<=grab;
  if(nearL&&nearT)return "nw";if(nearR&&nearT)return "ne";if(nearL&&nearB)return "sw";if(nearR&&nearB)return "se";
  if(nearT)return "n";if(nearB)return "s";if(nearL)return "w";if(nearR)return "e";
  if(wx>=left&&wx<=right&&wy>=top&&wy<=bottom)return "move";return null;
}

function setDeveloperInteractionEditing(active){
  const obj=devSelected;
  devInteractionEditing=!!active&&!!obj;
  devInteractionDrag=null;
  if(devInteractionEditing){
    // Interaction-area editing is mutually exclusive with the other visual editors,
    // but it must stay enabled itself. v73 accidentally cleared this flag here,
    // which made the green box look coordinate-only instead of behaving like the hitbox editor.
    devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;devSizeEditing=false;devSizeDrag=null;
    obj.interactable=true;obj.interaction=obj.interaction||{};obj.interaction.enabled=true;ensureDeveloperInteractionArea(obj);
    devSetStatus("Interaction area edit mode — drag inside the green box to move it; drag any side or corner handle to resize it");
  }else{if(game?.style)game.style.cursor="";devSetStatus("Interaction area edit mode finished");}
  refreshDeveloperPanel();
}

function updateDeveloperInteractionAreaDrag(p){
  const obj=devSelected;if(!devInteractionDrag||!obj)return;
  const limits=developerEntityOffsetLimits(obj),start=devInteractionDrag.area,dx=Math.round(p.x-devInteractionDrag.pointerX),dy=Math.round(p.y-devInteractionDrag.pointerY),minSize=4;
  let left=start.x,top=start.y,right=start.x+start.w,bottom=start.y+start.h;const handle=devInteractionDrag.handle;
  if(handle==="move"){
    left=clampDev(start.x+dx,limits.minX,Math.max(limits.minX,limits.maxX-start.w));top=clampDev(start.y+dy,limits.minY,Math.max(limits.minY,limits.maxY-start.h));right=left+start.w;bottom=top+start.h;
  }else{
    if(handle.includes("w"))left=clampDev(start.x+dx,limits.minX,right-minSize);if(handle.includes("e"))right=clampDev(start.x+start.w+dx,left+minSize,limits.maxX);
    if(handle.includes("n"))top=clampDev(start.y+dy,limits.minY,bottom-minSize);if(handle.includes("s"))bottom=clampDev(start.y+start.h+dy,top+minSize,limits.maxY);
  }
  obj.interaction=obj.interaction||{};obj.interaction.area={x:Math.round(left),y:Math.round(top),w:Math.max(minSize,Math.round(right-left)),h:Math.max(minSize,Math.round(bottom-top))};
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

function makeDeveloperRemnantPreview(kind="dust"){
  const lootable=kind==="lootable";
  const existing=devRemnantPreview;
  return {
    id:"developer-remnant-preview",
    x:Number.isFinite(existing?.x)?existing.x:state.x+56,
    y:Number.isFinite(existing?.y)?existing.y:state.y+8,
    sourceLabel:"World Builder Remnant Preview",
    items:[],
    gold:lootable?1:0,
    potions:0,
    createdAt:0,
    expiresAt:Number.POSITIVE_INFINITY,
    devKind:lootable?"lootable":"dust"
  };
}

function selectDeveloperRemnant(kind){
  devSelectedRemnant=kind==="lootable"?"lootable":"dust";
  devRemnantPreview=makeDeveloperRemnantPreview(devSelectedRemnant);
  devSelected=null;devSelectedNpc=null;devSelectedMob=null;
  devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;
  setDeveloperTab("selection");
  refreshDeveloperPanel();
  devSetStatus(`${devSelectedRemnant==="lootable"?"Lootable Dust":"Dust"} preview selected — drag it in the world and tune scale/depth here`);
}

function developerRemnantPreviewBounds(){
  if(!devRemnantPreview) return null;
  const size=lootRemnantDrawSize();
  return {x:devRemnantPreview.x-size/2,y:devRemnantPreview.y-size*.72,w:size,h:size};
}

function findDeveloperRemnantPreviewAt(wx,wy){
  const b=developerRemnantPreviewBounds();
  return !!b && wx>=b.x-6 && wx<=b.x+b.w+6 && wy>=b.y-6 && wy<=b.y+b.h+6;
}

function updateDeveloperRemnantVisual({scale,depthMode,depthY}={}){
  if(scale!==undefined) LOOT_REMNANT_VISUAL.scale=Math.round(visualScaleOr(scale,LOOT_REMNANT_VISUAL.scale)*100)/100;
  if(depthMode!==undefined){
    const mode=String(depthMode).toLowerCase();
    if(LOOT_REMNANT_DEPTH_MODES.has(mode)) LOOT_REMNANT_VISUAL.depthMode=mode;
  }
  if(depthY!==undefined&&Number.isFinite(Number(depthY))) LOOT_REMNANT_VISUAL.depthY=Math.round(Number(depthY));
}

function mobTypeScaleKey(mob){return mob?.template?.configKey||mob?.spawnType||null;}
function mobTypeScaleLabel(key){return BALANCE.mobs?.[key]?.name||key||"Mob";}
function mobTypeFallbackHeight(key){const mob=DEV_PROJECT_BALANCE?.mobs?.[key];return Math.max(8,numberOr(mob?.displayHeight,mobSizeClassHeight(mob?.sizeClass)));}
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
function developerPlacementDescription(){
  if(devActiveTab==="terrain")return {kind:"paint",text:`PAINT • ${developerTerrainType()?.name||devTerrainBrush||"Terrain"}`};
  if(devInteractionEditing)return {kind:"edit",text:"EDIT • Interaction Area"};
  if(devSizeEditing)return {kind:"edit",text:"EDIT • Visual Size"};
  if(devHitboxEditing)return {kind:"edit",text:"EDIT • Hitbox"};
  if(devDepthEditing)return {kind:"edit",text:"EDIT • Depth Line"};
  if(devPlaceType){
    const objectId=developerObjectDefinitionIdFromPlaceType?.(devPlaceType);
    const label=objectId?(developerObjectDefinition?.(objectId)?.name||objectId):String(devPlaceType);
    return {kind:"place",text:`PLACE • ${label}${devRepeatPlacement?" • REPEAT":" • ONE SHOT"}`};
  }
  if(devPlaceNpcAsset){const a=devAssets?.[devPlaceNpcAsset];return {kind:"place",text:`PLACE NPC • ${a?.name||devPlaceNpcAsset}${devRepeatPlacement?" • REPEAT":" • ONE SHOT"}`};}
  if(devPlaceMobType)return {kind:"place",text:`PLACE SPAWN • ${mobTypeScaleLabel(devPlaceMobType)}${devRepeatPlacement?" • REPEAT":" • ONE SHOT"}`};
  return {kind:"select",text:"SELECT / MOVE • Esc returns here"};
}
function refreshDeveloperToolStrip(){
  if(!devPanel)return;
  const mode=developerPlacementDescription(),el=devPanel.querySelector("#devToolMode");
  if(el){el.textContent=mode.text;el.className=`devToolMode ${mode.kind}`;}
  const repeat=devPanel.querySelector("#devRepeatPlacement");
  if(repeat){repeat.checked=!!devRepeatPlacement;repeat.disabled=!(devPlaceType||devPlaceNpcAsset||devPlaceMobType);}
  const finish=devPanel.querySelector("#devFinishTool");if(finish)finish.textContent=mode.kind==="select"?"Select Active":"Finish / Select";
}
function refreshDeveloperSectionNav(){
  if(!devPanel)return;const nav=devPanel.querySelector("#devSectionNav"),body=devPanel.querySelector(".devBody"),view=devPanel.querySelector(`.devView[data-dev-view="${devActiveTab}"]`);if(!nav||!body||!view)return;
  const sections=[...view.querySelectorAll(":scope > .devSection, :scope > .devMasterDetail .devSection")];nav.innerHTML="";
  sections.forEach((section,index)=>{const title=section.querySelector(".devSectionTitle");if(!title)return;const label=(title.childNodes?.[0]?.textContent||title.textContent||`Section ${index+1}`).trim();const b=document.createElement("button");b.className="devSectionJump";b.textContent=label;b.onclick=()=>{developerSetSectionCollapsed?.(section,false);const top=Math.max(0,section.offsetTop-view.offsetTop-8);body.scrollTo?body.scrollTo({top,behavior:"smooth"}):body.scrollTop=top;};nav.appendChild(b);});
  nav.style.display=sections.length>1?"flex":"none";
}
function developerFinishPlacement({leaveTerrain=true,status=true}={}){
  devPlaceType=null;devPlaceNpcAsset=null;devPlaceMobType=null;devTerrainPainting=false;devTerrainHoverTile=null;devTerrainLastTileKey=null;
  if(devInteractionEditing)setDeveloperInteractionEditing?.(false);
  if(devSizeEditing)setDeveloperSizeEditing?.(false);
  if(devHitboxEditing)setDeveloperHitboxEditing?.(false);
  if(devDepthEditing)setDeveloperDepthEditing?.(false);
  if(leaveTerrain&&devActiveTab==="terrain")setDeveloperTab("selection");
  updateDevPaletteActive();refreshDeveloperToolStrip();if(status)devSetStatus("Select / Move mode");
}
function setDeveloperTab(tab){
  const next=tab||"objects",previous=devActiveTab;const body=devPanel?.querySelector?.(".devBody");
  if(body&&previous!==next)devTabScrollPositions[previous]=body.scrollTop||0;
  devActiveTab=next;
  if(devPlaceType&&devActiveTab!=="objects")devPlaceType=null;
  if(devPlaceNpcAsset&&devActiveTab!=="npcs")devPlaceNpcAsset=null;
  if(devPlaceMobType&&devActiveTab!=="spawns")devPlaceMobType=null;
  if(devActiveTab==="terrain"){
    devPlaceType=null;devPlaceNpcAsset=null;devPlaceMobType=null;
    devHitboxEditing=false;devHitboxDrag=null;devDepthEditing=false;devDepthDrag=null;devInteractionEditing=false;devInteractionDrag=null;devSizeEditing=false;devSizeDrag=null;
  }else{
    devTerrainPainting=false;devTerrainHoverTile=null;devTerrainLastTileKey=null;
    if(game?.style)game.style.cursor="";
  }
  if(!devPanel) return;
  devPanel.querySelectorAll(".devTab").forEach(b=>b.classList.toggle("active",b.dataset.devTab===devActiveTab));
  devPanel.querySelectorAll(".devView").forEach(v=>v.classList.toggle("active",v.dataset.devView===devActiveTab));
  updateDevPaletteActive();refreshDeveloperSectionNav();refreshDeveloperToolStrip();
  if(devActiveTab==="terrain")refreshDeveloperTerrainPanel();
  if(body&&previous!==devActiveTab){const restore=()=>{body.scrollTop=devTabScrollPositions[devActiveTab]||0;};if(typeof requestAnimationFrame==="function")requestAnimationFrame(restore);else restore();}
}


