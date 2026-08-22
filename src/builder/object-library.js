function developerObjectDefinition(id){
  return devObjectDefinitions?.[id]||null;
}

function developerObjectPlaceType(id){
  return `object:${id}`;
}

function developerObjectDefinitionIdFromPlaceType(type){
  const raw=String(type||"");
  return raw.startsWith("object:")?raw.slice(7):null;
}

function developerDefaultObjectSizeFromAsset(asset){
  const sourceW=Math.max(1,numberOr(asset?.width,96));
  const sourceH=Math.max(1,numberOr(asset?.height,96));
  const maxDim=180;
  const scale=Math.min(1,maxDim/Math.max(sourceW,sourceH));
  return {w:Math.max(24,Math.round(sourceW*scale)),h:Math.max(24,Math.round(sourceH*scale))};
}

function developerUniqueObjectDefinitionId(base){
  const root=devContentId(base,"world-object");let id=root,n=2;
  while(Object.prototype.hasOwnProperty.call(devObjectDefinitions,id))id=`${root}-${n++}`;
  return id;
}

function createDeveloperObjectDefinitionFromAsset(asset,assetId=devAssetSelectedId,{silent=false}={}){
  if(!asset||asset.type!=="worldImage"){if(!silent)devSetStatus("Choose a World Image asset first");return null;}
  const id=developerUniqueObjectDefinitionId(asset.name||"world-object"),size=developerDefaultObjectSizeFromAsset(asset);
  devObjectDefinitions[id]={name:asset.name||id,sourceAssetId:assetId||"",w:size.w,h:size.h,solid:false,depthMode:"ysort",depthY:size.h};window.LR_OBJECT_DEFINITIONS=devObjectDefinitions;
  if(silent)return id;devPlaceType=developerObjectPlaceType(id);devPlaceNpcAsset=null;devPlaceMobType=null;devSelected=null;devSelectedNpc=null;devSelectedMob=null;saveDeveloperDraft();setDeveloperTab("objects");refreshDeveloperPanel();updateDevPaletteActive();devSetStatus(`${asset.name||id} is now in the Object Library — click the world to place it`);return id;
}

function removeDeveloperObjectDefinition(id){
  const definition=developerObjectDefinition(id);if(!definition)return;
  const refs=sceneryProps.filter(obj=>obj.objectId===id).length;
  if(refs){devSetStatus(`${definition.name||id} is used by ${refs} placed object${refs===1?"":"s"}; delete those instances first`);return;}
  if(!confirm(`Remove '${definition.name||id}' from the shared Object Library? Its image asset will stay in the project.`))return;
  delete devObjectDefinitions[id];
  window.LR_OBJECT_DEFINITIONS=devObjectDefinitions;
  if(devPlaceType===developerObjectPlaceType(id))devPlaceType=null;
  saveDeveloperDraft();refreshDeveloperPanel();updateDevPaletteActive();
}

function developerDrawObjectDefinitionThumb(canvas,id){
  const definition=developerObjectDefinition(id);if(!canvas||!definition)return;
  const c=canvas.getContext("2d");c.clearRect(0,0,56,56);c.imageSmoothingEnabled=false;
  const asset=devAssets?.[definition.sourceAssetId],path=asset?.path||definition.sprite||"";
  if(!path)return;
  const image=new Image();image.onload=()=>{
    c.clearRect(0,0,56,56);c.imageSmoothingEnabled=false;
    const crop=definition.crop&&typeof definition.crop==="object"?definition.crop:null;
    const sx=crop?numberOr(crop.x,0):0,sy=crop?numberOr(crop.y,0):0,sw=crop?Math.max(1,numberOr(crop.w,image.naturalWidth)):image.naturalWidth,sh=crop?Math.max(1,numberOr(crop.h,image.naturalHeight)):image.naturalHeight;
    const scale=Math.min(52/sw,52/sh),dw=Math.max(1,Math.round(sw*scale)),dh=Math.max(1,Math.round(sh*scale));
    c.drawImage(image,sx,sy,sw,sh,Math.round((56-dw)/2),Math.round((56-dh)/2),dw,dh);
  };
  image.src=/^(?:data:|blob:|https?:|\.\/|\/)/.test(path)?path:`./${path}`;
}

function refreshDeveloperObjectPalette(){
  if(!devPanel)return;
  const palette=devPanel.querySelector("#devObjectPalette");
  const count=devPanel.querySelector("#devObjectLibraryCount");
  if(!palette)return;
  const query=String(devPanel.querySelector("#devObjectSearch")?.value||"").trim().toLowerCase();
  const entries=Object.entries(devObjectDefinitions||{}).filter(([id,def])=>!query||`${def?.name||""} ${id}`.toLowerCase().includes(query)).sort((a,b)=>String(a[1]?.name||a[0]).localeCompare(String(b[1]?.name||b[0])));
  if(count)count.textContent=`${entries.length} reusable`;
  palette.innerHTML="";
  if(!entries.length){palette.innerHTML='<div class="devEmpty">No placeable objects yet. Import a World Image in Assets, then choose <b>Create Placeable Object</b>.</div>';return;}
  for(const [id,definition] of entries){
    const card=document.createElement("div");card.className=`devCustomObjectCard ${devPlaceType===developerObjectPlaceType(id)?"active":""}`;card.dataset.objectDefinition=id;
    const place=document.createElement("button");place.className="devCustomObjectPlace";place.dataset.objectPlace=id;place.title=`Place ${definition.name||id}`;
    const cv=document.createElement("canvas");cv.width=56;cv.height=56;
    const text=document.createElement("span"),name=document.createElement("b"),meta=document.createElement("small");
    name.textContent=definition.name||id;meta.textContent=`${Math.round(numberOr(definition.w,64))} × ${Math.round(numberOr(definition.h,64))}`;text.append(name,meta);place.append(cv,text);
    const remove=document.createElement("button");remove.className="devCustomObjectRemove";remove.dataset.objectRemove=id;remove.title="Remove object definition";remove.textContent="×";
    card.append(place,remove);palette.appendChild(card);developerDrawObjectDefinitionThumb(cv,id);
  }
  palette.querySelectorAll("[data-object-place]").forEach(button=>button.onclick=()=>{
    const id=button.dataset.objectPlace;
    devPlaceType=developerObjectPlaceType(id);devPlaceNpcAsset=null;devPlaceMobType=null;devSelected=null;devSelectedNpc=null;devSelectedMob=null;
    updateDevPaletteActive();refreshDeveloperObjectPalette();devSetStatus(`Placing ${developerObjectDefinition(id)?.name||id} — click the world${devRepeatPlacement?" repeatedly":" once"}`);
  });
  palette.querySelectorAll("[data-object-remove]").forEach(button=>button.onclick=e=>{e.stopPropagation();removeDeveloperObjectDefinition(button.dataset.objectRemove);});
}
