const DEV_CHARACTER_RIG_IMAGE_CACHE=new Map();
let DEV_CHARACTER_RIG_FULLSCREEN_KEY_HANDLER=null;
const DEV_CHARACTER_RIG_DIRECTIONS=["down","right","left","up"];
const DEV_PLAYER_EQUIPMENT_SLOTS=[["head","Head"],["chest","Chest"],["hands","Hands"],["back","Back"],["legs","Legs"],["feet","Feet / Boots"],["mainHand","Main Hand"],["offHand","Off Hand"]];
function developerCharacterRigAssetType(type){return ["playerBody","playerHair","playerEquipment"].includes(type);}
function developerCharacterOverlayAssetType(type){return ["playerHair","playerEquipment"].includes(type);}
function developerCharacterRigTransform(asset){
  const raw=asset?.rigTransform&&typeof asset.rigTransform==="object"?asset.rigTransform:{},directionOffsets={};
  for(const direction of DEV_CHARACTER_RIG_DIRECTIONS){
    const row=raw?.directionOffsets?.[direction]&&typeof raw.directionOffsets[direction]==="object"?raw.directionOffsets[direction]:{};
    directionOffsets[direction]={offsetX:clamp(numberOr(row.offsetX,0),-64,64),offsetY:clamp(numberOr(row.offsetY,0),-64,64)};
  }
  return {scale:clamp(numberOr(raw.scale,1),.35,2),offsetX:clamp(numberOr(raw.offsetX,0),-64,64),offsetY:clamp(numberOr(raw.offsetY,0),-64,64),directionOffsets};
}
function developerCharacterRigDirectionOffset(asset,direction){return developerCharacterRigTransform(asset).directionOffsets?.[direction]||{offsetX:0,offsetY:0};}
function developerCharacterBodyEntries(){return Object.entries(devAssets||{}).filter(([,asset])=>asset?.type==="playerBody");}
function developerDefaultCharacterBodyAssetId(){
  const configured=String(devCharacterDefaults?.defaultBodyAsset||"");
  if(devAssets?.[configured]?.type==="playerBody")return configured;
  return developerCharacterBodyEntries()[0]?.[0]||"";
}
function developerCharacterRigReferenceBodyId(asset){
  const configured=String(asset?.rigBodyAsset||"");
  if(devAssets?.[configured]?.type==="playerBody")return configured;
  return developerDefaultCharacterBodyAssetId();
}
function developerCharacterRigImage(assetId,onload){
  const asset=devAssets?.[assetId];if(!asset?.path)return null;
  let image=DEV_CHARACTER_RIG_IMAGE_CACHE.get(assetId);
  if(!image){image=new Image();image.onload=()=>onload?.();image.src=`./${asset.path}`;DEV_CHARACTER_RIG_IMAGE_CACHE.set(assetId,image);}
  return image;
}
function developerCharacterRigDirectionRow(asset,facing){const map=asset?.spriteLayout?.directionRows||{down:0,right:1,left:2,up:3};return clamp(Math.floor(numberOr(map[facing],0)),0,3);}
function developerDrawCharacterRigSheetFrame(c,image,asset,targetCol,targetRow,dx,dy,dw,dh){
  if(!image?.naturalWidth||!image?.naturalHeight)return;
  const facing=DEV_CHARACTER_RIG_DIRECTIONS[targetRow]||"down",sourceRow=developerCharacterRigDirectionRow(asset,facing),frameW=image.naturalWidth/4,frameH=image.naturalHeight/4;
  c.drawImage(image,targetCol*frameW,sourceRow*frameH,frameW,frameH,dx,dy,dw,dh);
}
function developerCharacterRigSelectedDirection(root){const value=String(root?.dataset?.devRigDirection||"all");return value==="all"||DEV_CHARACTER_RIG_DIRECTIONS.includes(value)?value:"all";}
function drawDeveloperCharacterRigPreview(root,asset,assetId){
  const canvas=root?.querySelector?.('#devRigPreview');if(!canvas)return;const c=canvas.getContext('2d');canvas.width=512;canvas.height=512;c.imageSmoothingEnabled=false;
  c.clearRect(0,0,512,512);c.fillStyle='#14111b';c.fillRect(0,0,512,512);
  for(let i=1;i<4;i++){c.strokeStyle='rgba(255,255,255,.08)';c.beginPath();c.moveTo(i*128,0);c.lineTo(i*128,512);c.stroke();c.beginPath();c.moveTo(0,i*128);c.lineTo(512,i*128);c.stroke();}
  const bodyId=asset.type==='playerBody'?assetId:developerCharacterRigReferenceBodyId(asset),body=devAssets?.[bodyId],bodyImage=developerCharacterRigImage(bodyId,()=>drawDeveloperCharacterRigPreview(root,asset,assetId)),layerImage=developerCharacterRigImage(assetId,()=>drawDeveloperCharacterRigPreview(root,asset,assetId));
  if(body&&bodyImage?.naturalWidth){c.globalAlpha=asset.type==='playerBody'?1:.45;for(let row=0;row<4;row++)for(let col=0;col<4;col++)developerDrawCharacterRigSheetFrame(c,bodyImage,body,col,row,col*128,row*128,128,128);c.globalAlpha=1;}
  if(asset.type!=='playerBody'&&layerImage?.naturalWidth){const t=developerCharacterRigTransform(asset),dw=128*t.scale,dh=128*t.scale;for(let row=0;row<4;row++){const facing=DEV_CHARACTER_RIG_DIRECTIONS[row],rowOffset=t.directionOffsets[facing];for(let col=0;col<4;col++){const dx=col*128+(128-dw)/2+t.offsetX+rowOffset.offsetX,dy=row*128+(128-dh)/2+t.offsetY+rowOffset.offsetY;developerDrawCharacterRigSheetFrame(c,layerImage,asset,col,row,dx,dy,dw,dh);}}}
  const selected=developerCharacterRigSelectedDirection(root);if(asset.type!=='playerBody'&&selected!=='all'){const row=DEV_CHARACTER_RIG_DIRECTIONS.indexOf(selected);if(row>=0){c.save();c.fillStyle='rgba(99,230,255,.035)';c.fillRect(0,row*128,512,128);c.strokeStyle='rgba(99,230,255,.78)';c.lineWidth=2;c.strokeRect(1,row*128+1,510,126);c.fillStyle='rgba(25,42,49,.92)';c.fillRect(7,row*128+7,58,19);c.fillStyle='#c8f8ff';c.font='bold 11px sans-serif';c.textBaseline='middle';c.fillText(selected.toUpperCase(),13,row*128+17);c.restore();}}
}
function developerCharacterRigAlignmentHtml(asset,assetId){
  if(!developerCharacterRigAssetType(asset?.type))return '';
  const bodies=developerCharacterBodyEntries(),isBody=asset.type==='playerBody',t=developerCharacterRigTransform(asset),bodyId=isBody?assetId:developerCharacterRigReferenceBodyId(asset);
  if(isBody)return `<div class="devAssetChecks"><div class="devAssetChecksTitle"><b>Canonical Character Rig</b><span class="good">512 × 512</span></div><div class="devHint" style="margin:4px 0 9px">Body layers define the alignment rig for Hair and every independent equipment slot. Full outfits are not character layers. Their exact 4×4 coordinates are preserved on import — no per-frame trimming, centering, or safe-fit scaling.</div><canvas id="devRigPreview" class="devRigPreview" width="512" height="512"></canvas><button id="devRigSetDefaultBody" class="devWideButton primary">${devCharacterDefaults?.defaultBodyAsset===assetId?'Default Modular Body':'Set as Default Modular Body'}</button></div>`;
  const bodyOptions=bodies.map(([id,body])=>`<option value="${devContentEscape(id)}" ${id===bodyId?'selected':''}>${devContentEscape(body.name||id)}</option>`).join('');
  const equipmentSlotControl=asset.type==='playerEquipment'?`<label>Equipment Slot<select id="devRigEquipmentSlot">${DEV_PLAYER_EQUIPMENT_SLOTS.map(([value,label])=>`<option value="${value}" ${value===asset.equipmentSlot?'selected':''}>${label}</option>`).join('')}</select></label>`:'';
  return `<div class="devAssetChecks devRigAlignmentCard"><div class="devAssetChecksTitle devRigTitleBar"><b>Modular Layer Alignment</b><div class="devRigTitleActions"><span class="good">LIVE</span><button type="button" id="devRigExpand" class="devRigExpandButton">⛶ Fullscreen</button><button type="button" id="devRigExit" class="devRigExitButton">Exit Fullscreen</button></div></div><div class="devHint devRigIntro" style="margin:4px 0 9px">Use the global transform to align the whole sheet, then use <b>Direction Fine-Tune</b> when just one directional row is off. Row fine-tuning only nudges X/Y, so all directions keep the same scale and animation proportions.</div><div class="devRigWorkspace"><div class="devRigPreviewPane"><div class="devRigPreviewHeader"><b>Live 4 × 4 Preview</b><span id="devRigDragHint">Drag target: All Rows</span></div><canvas id="devRigPreview" class="devRigPreview devRigPreviewDraggable" width="512" height="512"></canvas><div class="devRigPreviewLegend"><span>Body 45%</span><span>Layer 100%</span></div></div><div class="devRigControls">${equipmentSlotControl}<label>Compatible Body Rig<select id="devRigBody">${bodyOptions||'<option value="">Import a Player Body Layer first</option>'}</select></label><div class="devRigControlBlock"><div class="devRigControlTitle">Global Transform</div><div class="devPair"><label>Layer Scale %<input id="devRigScale" type="number" min="35" max="200" step="1" value="${Math.round(t.scale*100)}"></label><label>Offset X<input id="devRigOffsetX" type="number" min="-64" max="64" step="1" value="${Math.round(t.offsetX)}"></label></div><div class="devPair"><label>Offset Y<input id="devRigOffsetY" type="number" min="-64" max="64" step="1" value="${Math.round(t.offsetY)}"></label><label>Rig Mode<input value="Exact 128 px coordinates" readonly></label></div></div><div class="devRigControlBlock devRigDirectionBlock"><div class="devRigControlTitle">Direction Fine-Tune</div><div class="devRigDirectionHelp">Choose a target. <b>All Rows</b> makes preview dragging adjust the global offset; a direction makes dragging adjust only that row.</div><div class="devRigDirectionTabs" role="group" aria-label="Alignment drag target"><button type="button" class="active" data-rig-direction="all">All Rows</button><button type="button" data-rig-direction="down">Down</button><button type="button" data-rig-direction="right">Right</button><button type="button" data-rig-direction="left">Left</button><button type="button" data-rig-direction="up">Up</button></div><div class="devPair devRigRowOffsetPair"><label>Row Offset X<input id="devRigRowOffsetX" type="number" min="-64" max="64" step="1" value="0" disabled></label><label>Row Offset Y<input id="devRigRowOffsetY" type="number" min="-64" max="64" step="1" value="0" disabled></label></div><div class="devRigFineTuneActions"><button type="button" id="devRigResetRow" disabled>Reset Selected Row</button><button type="button" id="devRigClearRows">Clear All Row Offsets</button></div></div><div class="devRigControlHelp">For your example, choose <b>Right</b> (Row 2) and nudge or drag it until the hair lines up. This correction is also used by the character in-game. Press <b>Esc</b> to leave fullscreen.</div><div class="devRow devRigActions"><button id="devRigReset">Reset Exact Coordinates</button>${asset.type==='playerHair'?'<button id="devRigFitHair">Fit Hair Width</button>':''}</div></div></div></div>`;
}
function developerCharacterRigSetFullscreen(root,asset,assetId,enabled){
  const panel=document.getElementById('devPanel'),card=root?.querySelector?.('.devRigAlignmentCard');if(!panel||!card)return;
  const active=Boolean(enabled);panel.classList.toggle('devRigFullscreenMode',active);card.classList.toggle('devRigFullscreen',active);
  if(DEV_CHARACTER_RIG_FULLSCREEN_KEY_HANDLER){window.removeEventListener('keydown',DEV_CHARACTER_RIG_FULLSCREEN_KEY_HANDLER);DEV_CHARACTER_RIG_FULLSCREEN_KEY_HANDLER=null;}
  if(active){DEV_CHARACTER_RIG_FULLSCREEN_KEY_HANDLER=event=>{if(event.key!=='Escape')return;event.preventDefault();developerCharacterRigSetFullscreen(root,asset,assetId,false);};window.addEventListener('keydown',DEV_CHARACTER_RIG_FULLSCREEN_KEY_HANDLER);}
  requestAnimationFrame(()=>{drawDeveloperCharacterRigPreview(root,asset,assetId);(active?card.querySelector('#devRigExit'):card.querySelector('#devRigExpand'))?.focus?.();});
}
function developerCharacterRigRefreshDirectionControls(root,asset,assetId){
  const selected=developerCharacterRigSelectedDirection(root),rowX=root.querySelector('#devRigRowOffsetX'),rowY=root.querySelector('#devRigRowOffsetY'),resetRow=root.querySelector('#devRigResetRow'),hint=root.querySelector('#devRigDragHint');
  root.querySelectorAll('[data-rig-direction]').forEach(button=>button.classList.toggle('active',button.dataset.rigDirection===selected));
  const rowSelected=selected!=='all',offset=rowSelected?developerCharacterRigDirectionOffset(asset,selected):{offsetX:0,offsetY:0};
  if(rowX){rowX.disabled=!rowSelected;rowX.value=String(Math.round(offset.offsetX));}if(rowY){rowY.disabled=!rowSelected;rowY.value=String(Math.round(offset.offsetY));}if(resetRow)resetRow.disabled=!rowSelected;if(hint)hint.textContent=`Drag target: ${rowSelected?selected[0].toUpperCase()+selected.slice(1):'All Rows'}`;
  drawDeveloperCharacterRigPreview(root,asset,assetId);
}
function developerCharacterRigCommit(asset,assetId,root,{quiet=false}={}){
  const current=developerCharacterRigTransform(asset),scale=clamp(numberOr(root.querySelector('#devRigScale')?.value,100)/100,.35,2),offsetX=clamp(numberOr(root.querySelector('#devRigOffsetX')?.value,0),-64,64),offsetY=clamp(numberOr(root.querySelector('#devRigOffsetY')?.value,0),-64,64),bodyId=String(root.querySelector('#devRigBody')?.value||developerCharacterRigReferenceBodyId(asset)||''),directionOffsets={...current.directionOffsets},selected=developerCharacterRigSelectedDirection(root);
  if(selected!=='all')directionOffsets[selected]={offsetX:clamp(numberOr(root.querySelector('#devRigRowOffsetX')?.value,current.directionOffsets[selected].offsetX),-64,64),offsetY:clamp(numberOr(root.querySelector('#devRigRowOffsetY')?.value,current.directionOffsets[selected].offsetY),-64,64)};
  asset.rigTransform={scale:Number(scale.toFixed(3)),offsetX:Number(offsetX.toFixed(2)),offsetY:Number(offsetY.toFixed(2)),directionOffsets};if(bodyId)asset.rigBodyAsset=bodyId;if(asset.type==='playerEquipment'){const slot=String(root.querySelector('#devRigEquipmentSlot')?.value||asset.equipmentSlot||'chest');asset.equipmentSlot=DEV_PLAYER_EQUIPMENT_SLOTS.some(([value])=>value===slot)?slot:'chest';}asset.rigCoordinatesPreserved=true;
  window.LR_ASSETS=devAssets;window.LR_CHARACTER_DEFAULTS=devCharacterDefaults;if(typeof developerContentLibrary==='function')window.LR_SHARED_CONTENT=developerContentLibrary();saveDeveloperDraft();drawDeveloperCharacterRigPreview(root,asset,assetId);if(!quiet)devSetStatus(`Character layer alignment applied live for ${asset.name||assetId} • Save Project to persist`);
}
function bindDeveloperCharacterRigAlignment(root,asset,assetId){
  if(!root||!developerCharacterRigAssetType(asset?.type))return;
  if(asset.type==='playerBody'){
    root.querySelector('#devRigSetDefaultBody')?.addEventListener('click',()=>{devCharacterDefaults.defaultBodyAsset=assetId;window.LR_CHARACTER_DEFAULTS=devCharacterDefaults;saveDeveloperDraft();refreshDeveloperAssetPanel();devSetStatus(`${asset.name||assetId} is now the default modular body rig`);});drawDeveloperCharacterRigPreview(root,asset,assetId);return;
  }
  root.dataset.devRigDirection='all';
  const scale=root.querySelector('#devRigScale'),x=root.querySelector('#devRigOffsetX'),y=root.querySelector('#devRigOffsetY'),rowX=root.querySelector('#devRigRowOffsetX'),rowY=root.querySelector('#devRigRowOffsetY'),body=root.querySelector('#devRigBody'),equipmentSlot=root.querySelector('#devRigEquipmentSlot');
  root.querySelector('#devRigExpand')?.addEventListener('click',()=>developerCharacterRigSetFullscreen(root,asset,assetId,true));root.querySelector('#devRigExit')?.addEventListener('click',()=>developerCharacterRigSetFullscreen(root,asset,assetId,false));
  [scale,x,y,rowX,rowY].forEach(control=>{control?.addEventListener('input',()=>developerCharacterRigCommit(asset,assetId,root,{quiet:true}));control?.addEventListener('change',()=>developerCharacterRigCommit(asset,assetId,root));});body?.addEventListener('change',()=>developerCharacterRigCommit(asset,assetId,root));equipmentSlot?.addEventListener('change',()=>developerCharacterRigCommit(asset,assetId,root));
  root.querySelectorAll('[data-rig-direction]').forEach(button=>button.addEventListener('click',()=>{root.dataset.devRigDirection=button.dataset.rigDirection||'all';developerCharacterRigRefreshDirectionControls(root,asset,assetId);}));
  root.querySelector('#devRigResetRow')?.addEventListener('click',()=>{const selected=developerCharacterRigSelectedDirection(root);if(selected==='all')return;const t=developerCharacterRigTransform(asset);t.directionOffsets[selected]={offsetX:0,offsetY:0};asset.rigTransform=t;saveDeveloperDraft();developerCharacterRigRefreshDirectionControls(root,asset,assetId);devSetStatus(`Reset ${selected} row alignment for ${asset.name||assetId}`);});
  root.querySelector('#devRigClearRows')?.addEventListener('click',()=>{const t=developerCharacterRigTransform(asset);for(const direction of DEV_CHARACTER_RIG_DIRECTIONS)t.directionOffsets[direction]={offsetX:0,offsetY:0};asset.rigTransform=t;saveDeveloperDraft();developerCharacterRigRefreshDirectionControls(root,asset,assetId);devSetStatus(`Cleared all direction row offsets for ${asset.name||assetId}`);});
  root.querySelector('#devRigReset')?.addEventListener('click',()=>{developerCharacterRigSetFullscreen(root,asset,assetId,false);const directionOffsets={};for(const direction of DEV_CHARACTER_RIG_DIRECTIONS)directionOffsets[direction]={offsetX:0,offsetY:0};asset.rigTransform={scale:1,offsetX:0,offsetY:0,directionOffsets};const bodyId=String(body?.value||developerCharacterRigReferenceBodyId(asset)||'');if(bodyId)asset.rigBodyAsset=bodyId;saveDeveloperDraft();refreshDeveloperAssetPanel();devSetStatus(`Reset ${asset.name||assetId} to exact rig coordinates`);});
  root.querySelector('#devRigFitHair')?.addEventListener('click',()=>{const bodyAsset=devAssets?.[String(body?.value||developerCharacterRigReferenceBodyId(asset)||'')],bw=numberOr(bodyAsset?.analysis?.frameMetrics?.referenceVisibleWidth,0),lw=numberOr(asset?.analysis?.frameMetrics?.referenceVisibleWidth,0);if(!bw||!lw){devSetStatus('Hair/body frame analysis is missing; adjust scale manually');return;}const fitted=clamp((bw*1.12)/lw,.45,1.25);if(scale)scale.value=String(Math.round(fitted*100));developerCharacterRigCommit(asset,assetId,root);});
  const canvas=root.querySelector('#devRigPreview');let drag=null;canvas?.addEventListener('pointerdown',event=>{event.preventDefault();const rect=canvas.getBoundingClientRect(),factor=512/Math.max(1,rect.width),selected=developerCharacterRigSelectedDirection(root),t=developerCharacterRigTransform(asset),start=selected==='all'?{offsetX:t.offsetX,offsetY:t.offsetY}:t.directionOffsets[selected];drag={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,factor,target:selected,startOffsetX:start.offsetX,startOffsetY:start.offsetY};canvas.setPointerCapture?.(event.pointerId);});
  canvas?.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.pointerId)return;const nx=clamp(drag.startOffsetX+(event.clientX-drag.startX)*drag.factor,-64,64),ny=clamp(drag.startOffsetY+(event.clientY-drag.startY)*drag.factor,-64,64),t=developerCharacterRigTransform(asset);if(drag.target==='all'){if(x)x.value=String(Math.round(nx));if(y)y.value=String(Math.round(ny));t.offsetX=nx;t.offsetY=ny;}else{if(rowX)rowX.value=String(Math.round(nx));if(rowY)rowY.value=String(Math.round(ny));t.directionOffsets[drag.target]={offsetX:nx,offsetY:ny};}asset.rigTransform=t;drawDeveloperCharacterRigPreview(root,asset,assetId);});
  const finish=event=>{if(!drag||event.pointerId!==drag.pointerId)return;drag=null;developerCharacterRigCommit(asset,assetId,root);};canvas?.addEventListener('pointerup',finish);canvas?.addEventListener('pointercancel',finish);developerCharacterRigRefreshDirectionControls(root,asset,assetId);
}

function developerValidateCharacterRigHealth(shared,issues){
  const playable=Object.entries(shared.assets||{}).filter(([,asset])=>asset?.type==="playerAppearance");
  const defaultPlayerAsset=String(shared.characterDefaults?.defaultAppearanceAsset||"");
  if(!playable.length)developerHealthIssue(issues,"error","Import at least one Playable Character for the character select screen",{tab:"assets",targetId:""});
  else if(!defaultPlayerAsset||shared.assets?.[defaultPlayerAsset]?.type!=="playerAppearance")developerHealthIssue(issues,"error","Character Defaults needs a valid Playable Character",{tab:"assets",targetId:defaultPlayerAsset});
  for(const [assetId,asset] of playable)if(!asset?.normalizedSheet)developerHealthIssue(issues,"warning",`Playable Character '${assetId}' should use the normalized 4×4 player sheet`,{tab:"assets",targetId:assetId});
  const validEquipmentSlots=new Set(DEV_PLAYER_EQUIPMENT_SLOTS.map(([slot])=>slot));
  for(const [itemId,item] of Object.entries(shared.items||{})){
    const slot=String(item?.equipmentSlot||"");if(!slot)continue;
    if(!validEquipmentSlots.has(slot))developerHealthIssue(issues,"error",`Equipment item '${itemId}' has an invalid equipment slot`,{tab:"content",targetId:itemId});
  }
  for(const [slot,itemIdRaw] of Object.entries(shared.characterDefaults?.starterEquipment||{})){
    const itemId=String(itemIdRaw||"");if(!itemId)continue;const item=shared.items?.[itemId];
    if(!validEquipmentSlots.has(slot))developerHealthIssue(issues,"error",`Starter equipment uses invalid slot '${slot}'`,{tab:"content",targetId:itemId});
    else if(!item)developerHealthIssue(issues,"error",`Starter equipment '${itemId}' does not exist`,{tab:"content",targetId:itemId});
    else if(String(item.equipmentSlot||"")!==slot)developerHealthIssue(issues,"error",`Starter equipment '${itemId}' does not match the '${slot}' slot`,{tab:"content",targetId:itemId});
  }
}
