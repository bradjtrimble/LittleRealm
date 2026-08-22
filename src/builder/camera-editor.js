const DEV_CAMERA_PREFS_KEY="littleRealmBuilderCameraV75";
const DEV_CAMERA_MIN_ZOOM=.12;
const DEV_CAMERA_MAX_ZOOM=4;

function developerCameraZoneId(){return String(devProjectZone?.id||state?.zoneId||"default");}
function developerCameraPrefs(){try{return JSON.parse(localStorage.getItem(DEV_CAMERA_PREFS_KEY)||"{}")||{};}catch{return {};}}
function developerSaveCameraPrefs(prefs){try{localStorage.setItem(DEV_CAMERA_PREFS_KEY,JSON.stringify(prefs||{}));}catch{}}
function developerCameraAvailableWidth(){
  const full=Math.max(320,Number(innerWidth)||1280);
  if(!devModeActive||!devPanel?.classList?.contains("show"))return full;
  const panelWidth=Math.max(0,numberOr(devPanel.getBoundingClientRect?.().width,0));
  return Math.max(260,full-panelWidth-12);
}
function developerWorldCenter(){return {x:WORLD_W*TILE/2,y:WORLD_H*TILE/2};}
function developerWorldFitZoom(){
  const pad=28,availableW=developerCameraAvailableWidth(),availableH=Math.max(240,Number(innerHeight)||720);
  const worldW=Math.max(TILE,WORLD_W*TILE),worldH=Math.max(TILE,WORLD_H*TILE);
  return clamp(Math.min((availableW-pad*2)/worldW,(availableH-pad*2)/worldH),DEV_CAMERA_MIN_ZOOM,CAMERA_ZOOM);
}
function developerEnsureFreeCamera(){
  if(!Number.isFinite(Number(devCameraX)))devCameraX=numberOr(state?.x,START_X);
  if(!Number.isFinite(Number(devCameraY)))devCameraY=numberOr(state?.y,START_Y);
  if(!Number.isFinite(Number(devCameraZoom)))devCameraZoom=CAMERA_ZOOM;
  devCameraZoom=clamp(devCameraZoom,DEV_CAMERA_MIN_ZOOM,DEV_CAMERA_MAX_ZOOM);
}
function developerCameraFrame(vw=innerWidth,vh=innerHeight){
  const fullW=Math.max(1,numberOr(vw,innerWidth||1)),fullH=Math.max(1,numberOr(vh,innerHeight||1));
  if(!devModeActive||devCameraMode==="player"){
    const zoom=CAMERA_ZOOM,viewW=fullW/zoom,viewH=fullH/zoom;
    // Builder UI is constructed before reset() initializes player state. Use the
    // zone start during that brief bootstrap phase so camera controls cannot stop startup.
    const playerX=numberOr(state?.x,START_X),playerY=numberOr(state?.y,START_Y);
    return {mode:"player",zoom,viewW,viewH,camX:playerX-viewW/2,camY:playerY-viewH/2,centerX:playerX,centerY:playerY};
  }
  developerEnsureFreeCamera();
  let zoom=devCameraZoom;
  if(devCameraMode==="world"){
    const center=developerWorldCenter();devCameraX=center.x;devCameraY=center.y;zoom=developerWorldFitZoom();devCameraZoom=zoom;
  }
  const viewW=fullW/zoom,viewH=fullH/zoom,availableW=developerCameraAvailableWidth();
  // Keep the camera focal point centered in the visible workspace, not underneath the Builder panel.
  const camX=devCameraX-(availableW/zoom)/2;
  const camY=devCameraY-viewH/2;
  return {mode:devCameraMode,zoom,viewW,viewH,camX,camY,centerX:devCameraX,centerY:devCameraY,availableW};
}
function developerCameraZoomValue(){return developerCameraFrame(innerWidth,innerHeight).zoom;}
function developerCameraLocksPlayerMovement(){return devModeActive&&devCameraMode!=="player";}
function developerClearCameraKeys(){devCameraKeys={up:false,down:false,left:false,right:false};}
function developerPersistCameraForZone(){
  developerEnsureFreeCamera();
  const prefs=developerCameraPrefs(),zones={...(prefs.zones||{})};
  zones[developerCameraZoneId()]={mode:devCameraMode,x:devCameraX,y:devCameraY,zoom:devCameraZoom};prefs.zones=zones;developerSaveCameraPrefs(prefs);
}
function developerRestoreCameraForZone(){
  const rec=developerCameraPrefs()?.zones?.[developerCameraZoneId()];
  if(rec&&["player","free","world"].includes(rec.mode)){
    devCameraMode=rec.mode;devCameraX=numberOr(rec.x,state?.x);devCameraY=numberOr(rec.y,state?.y);devCameraZoom=clamp(numberOr(rec.zoom,CAMERA_ZOOM),DEV_CAMERA_MIN_ZOOM,DEV_CAMERA_MAX_ZOOM);
  }else{devCameraMode="player";devCameraX=state?.x;devCameraY=state?.y;devCameraZoom=CAMERA_ZOOM;}
  developerClearCameraKeys();developerRefreshCameraUi();
}
function setDeveloperCameraMode(mode,{quiet=false}={}){
  mode=["player","free","world"].includes(mode)?mode:"player";
  if(mode==="free"&&devCameraMode==="player"){devCameraX=state.x;devCameraY=state.y;devCameraZoom=CAMERA_ZOOM;}
  if(mode==="world"){const c=developerWorldCenter();devCameraX=c.x;devCameraY=c.y;devCameraZoom=developerWorldFitZoom();}
  devCameraMode=mode;developerClearCameraKeys();developerPersistCameraForZone();developerRefreshCameraUi();
  if(!quiet){
    if(mode==="player")devSetStatus("Player Camera — camera follows the character; F2 playtesting behaves normally");
    else if(mode==="free")devSetStatus("Free Camera — WASD / arrows pan • mouse wheel zooms • middle-drag pans");
    else devSetStatus("World View — entire zone fitted overhead; terrain painting remains active");
  }
}
function developerFitWorldCamera(){setDeveloperCameraMode("world");}
function developerCenterCameraOnPlayer(){
  if(devCameraMode==="player"){developerRefreshCameraUi();devSetStatus("Camera is already following the player");return;}
  devCameraMode="free";devCameraX=state.x;devCameraY=state.y;developerPersistCameraForZone();developerRefreshCameraUi();devSetStatus("Free Camera centered on player");
}
function developerSelectionWorldPoint(){
  if(devSelected){const b=developerEntityBounds(devSelected);return {x:b.x+b.w/2,y:b.y+b.h/2,label:devSelected.label||"object"};}
  if(devSelectedNpc)return {x:devSelectedNpc.x,y:devSelectedNpc.y,label:devSelectedNpc.name||"NPC"};
  if(devSelectedMob)return {x:devSelectedMob.x,y:devSelectedMob.y,label:mobDisplayName(devSelectedMob)||"mob"};
  if(devSelectedSpawnId){const spawn=developerSpawnById?.(devSelectedSpawnId);if(spawn)return {x:spawn.x,y:spawn.y,label:"spawn"};}
  if(devSelectedRemnant&&devRemnantPreview)return {x:devRemnantPreview.x,y:devRemnantPreview.y,label:"remnant preview"};
  return null;
}
function developerCenterCameraOnSelection(){
  const point=developerSelectionWorldPoint();if(!point){devSetStatus("Select an object, NPC, mob, or spawn first");return;}
  devCameraMode="free";devCameraX=point.x;devCameraY=point.y;developerEnsureFreeCamera();developerPersistCameraForZone();developerRefreshCameraUi();devSetStatus(`Free Camera centered on ${point.label}`);
}
function developerNearestWalkableCameraPoint(x,y){
  const minX=HERO_RADIUS+1,maxX=WORLD_W*TILE-HERO_RADIUS-1,minY=HERO_RADIUS+1,maxY=WORLD_H*TILE-HERO_RADIUS-1;
  const tx=clamp(numberOr(x,state.x),minX,maxX),ty=clamp(numberOr(y,state.y),minY,maxY);
  if(canStand(tx,ty))return {x:tx,y:ty};
  const step=16;
  for(let radius=step;radius<=TILE*5;radius+=step){
    const samples=Math.max(8,Math.ceil(Math.PI*2*radius/step));
    for(let i=0;i<samples;i++){const a=i/samples*Math.PI*2,cx=clamp(tx+Math.cos(a)*radius,minX,maxX),cy=clamp(ty+Math.sin(a)*radius,minY,maxY);if(canStand(cx,cy))return {x:cx,y:cy};}
  }
  return null;
}
function developerMovePlayerToCamera(){
  if(devCameraMode==="player"){devSetStatus("Player is already at the current camera point");return;}
  developerEnsureFreeCamera();const target=developerNearestWalkableCameraPoint(devCameraX,devCameraY);
  if(!target){devSetStatus("Could not find walkable ground near the camera center");return;}
  if(typeof disengageCombat==="function"&&combatTarget)disengageCombat(false);if(typeof clearSelectedTarget==="function")clearSelectedTarget();
  input={up:false,down:false,left:false,right:false};isHeroMoving=false;state.x=target.x;state.y=target.y;lastSafePos={x:state.x,y:state.y};
  if(typeof updateQuestVisits==="function")updateQuestVisits();if(typeof updateUI==="function")updateUI();
  devSetStatus(`Player moved to camera • ${Math.round(state.x)}, ${Math.round(state.y)} • press F2 to test here`);developerRefreshCameraUi();
}
function developerCameraZoomBy(factor){
  if(devCameraMode==="player"){devSetStatus("Switch to Free Camera or World View to zoom independently");return;}
  if(devCameraMode==="world"){const frame=developerCameraFrame(innerWidth,innerHeight);devCameraMode="free";devCameraX=frame.centerX;devCameraY=frame.centerY;devCameraZoom=frame.zoom;}
  devCameraZoom=clamp(devCameraZoom*factor,DEV_CAMERA_MIN_ZOOM,DEV_CAMERA_MAX_ZOOM);developerPersistCameraForZone();developerRefreshCameraUi();
}
function updateDeveloperCamera(dt){
  if(!devModeActive||devCameraMode==="player")return;
  const dx=(devCameraKeys.right?1:0)-(devCameraKeys.left?1:0),dy=(devCameraKeys.down?1:0)-(devCameraKeys.up?1:0);if(!dx&&!dy)return;
  if(devCameraMode==="world"){const frame=developerCameraFrame(innerWidth,innerHeight);devCameraMode="free";devCameraX=frame.centerX;devCameraY=frame.centerY;devCameraZoom=frame.zoom;}
  const len=Math.max(1,Math.hypot(dx,dy)),speed=520/Math.max(.2,devCameraZoom);devCameraX+=dx/len*speed*dt;devCameraY+=dy/len*speed*dt;developerPersistCameraForZone();developerRefreshCameraUi();
}
function developerCameraKeyDirection(code){if(code==="KeyW"||code==="ArrowUp")return "up";if(code==="KeyS"||code==="ArrowDown")return "down";if(code==="KeyA"||code==="ArrowLeft")return "left";if(code==="KeyD"||code==="ArrowRight")return "right";return "";}
function developerHandleCameraKeyDown(event){
  if(!devModeActive||devCameraMode==="player"||isEditableKeyTarget(event.target))return false;const dir=developerCameraKeyDirection(event.code);if(!dir)return false;event.preventDefault();event.stopImmediatePropagation();devCameraKeys[dir]=true;return true;
}
function developerHandleCameraKeyUp(event){
  if(!devModeActive)return false;const dir=developerCameraKeyDirection(event.code);if(!dir)return false;devCameraKeys[dir]=false;if(devCameraMode!=="player"){developerPersistCameraForZone();event.preventDefault();event.stopImmediatePropagation();return true;}return false;
}
function developerBeginCameraPan(event){
  if(!devModeActive||devCameraMode==="player"||event.button!==1)return false;
  if(devCameraMode==="world"){const frame=developerCameraFrame(innerWidth,innerHeight);devCameraMode="free";devCameraX=frame.centerX;devCameraY=frame.centerY;devCameraZoom=frame.zoom;}
  developerEnsureFreeCamera();devCameraPanDrag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,cameraX:devCameraX,cameraY:devCameraY,zoom:devCameraZoom};event.preventDefault();event.stopImmediatePropagation();try{game.setPointerCapture?.(event.pointerId);}catch{}if(game?.style)game.style.cursor="grabbing";return true;
}
function developerUpdateCameraPan(event){
  if(!devCameraPanDrag)return false;const drag=devCameraPanDrag,zoom=Math.max(DEV_CAMERA_MIN_ZOOM,drag.zoom);devCameraX=drag.cameraX-(event.clientX-drag.x)/zoom;devCameraY=drag.cameraY-(event.clientY-drag.y)/zoom;event.preventDefault();event.stopImmediatePropagation();developerRefreshCameraUi();return true;
}
function developerEndCameraPan(event){
  if(!devCameraPanDrag)return false;devCameraPanDrag=null;event?.preventDefault?.();event?.stopImmediatePropagation?.();try{game.releasePointerCapture?.(event.pointerId);}catch{}if(game?.style)game.style.cursor="";developerPersistCameraForZone();return true;
}
function developerHandleCameraWheel(event){
  if(!devModeActive||devCameraMode==="player")return;event.preventDefault();event.stopImmediatePropagation();developerCameraZoomBy(event.deltaY<0?1.12:.89);
}
function developerRefreshCameraUi(){
  if(!devPanel)return;const frame=developerCameraFrame(innerWidth,innerHeight),mode=devCameraMode;
  devPanel.querySelectorAll("[data-dev-camera-mode]").forEach(button=>button.classList.toggle("active",button.dataset.devCameraMode===mode));
  const readout=devPanel.querySelector("#devCameraReadout");if(readout)readout.textContent=`${mode==="player"?"PLAYER CAMERA":mode==="world"?"WORLD VIEW":"FREE CAMERA"} • ${Math.round(frame.zoom*100)}%`;
  const move=devPanel.querySelector("#devMovePlayerToCamera");if(move)move.disabled=mode==="player";
}
function developerBindCameraControls(root=devPanel){
  if(!root)return;root.querySelectorAll("[data-dev-camera-mode]").forEach(button=>button.onclick=()=>setDeveloperCameraMode(button.dataset.devCameraMode));
  root.querySelector("#devCameraCenterPlayer")?.addEventListener("click",developerCenterCameraOnPlayer);root.querySelector("#devCameraCenterSelection")?.addEventListener("click",developerCenterCameraOnSelection);root.querySelector("#devMovePlayerToCamera")?.addEventListener("click",developerMovePlayerToCamera);
  root.querySelector("#devCameraZoomIn")?.addEventListener("click",()=>developerCameraZoomBy(1.18));root.querySelector("#devCameraZoomOut")?.addEventListener("click",()=>developerCameraZoomBy(.85));developerRefreshCameraUi();
}
function drawDeveloperCameraOverlay(camX,camY){
  if(!devModeActive||devCameraMode==="player")return;const zoom=developerCameraZoomValue(),px=state.x-camX,py=state.y-camY;
  ctx.save();ctx.strokeStyle="rgba(255,231,115,.98)";ctx.fillStyle="rgba(255,231,115,.12)";ctx.lineWidth=2/zoom;ctx.beginPath();ctx.arc(px,py,12/zoom,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.font=`800 ${Math.max(8,10/zoom)}px system-ui`;ctx.textAlign="center";ctx.fillStyle="#fff0a8";ctx.fillText("PLAYER",px,py-17/zoom);ctx.restore();
}
