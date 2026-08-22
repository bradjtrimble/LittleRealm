function developerAssetTypeLabel(type){return ({mobSprite:"Mob Sprite",npcSprite:"NPC Sprite",playerAppearance:"Playable Character",playerBody:"Legacy Player Body Layer",playerHair:"Legacy Player Hair Layer",playerEquipment:"Legacy Player Equipment Layer",itemIcon:"Item Icon",worldImage:"World Image",terrainTexture:"Terrain Texture",treeSprite:"Terrain Tree Sprite"})[type]||type||"Image";}
function developerAssetImportPurpose(value){return ({terrain:{type:"terrainTexture",auto:"terrain",label:"Paintable Terrain"},object:{type:"worldImage",auto:"object",label:"Placeable Object"},mobSprite:{type:"mobSprite",label:"Mob Sprite"},npcSprite:{type:"npcSprite",label:"NPC Sprite"},playerAppearance:{type:"playerAppearance",label:"Playable Character"},itemIcon:{type:"itemIcon",label:"Item Icon"},treeSprite:{type:"treeSprite",label:"Terrain Tree Sprite"},assetOnly:{type:"worldImage",label:"Asset"}})[value]||{type:value||"worldImage",label:"Asset"};}
function developerAssetFolder(type){return ({mobSprite:"assets/mobs",npcSprite:"assets/npcs",playerAppearance:"assets/characters",playerBody:"assets/characters",playerHair:"assets/characters",playerEquipment:"assets/characters",itemIcon:"assets/items",worldImage:"assets/imported",terrainTexture:"assets/environment/terrain",treeSprite:"assets/environment/terrain"})[type]||"assets/imported";}
function developerAssetSafeFilename(name){const raw=String(name||"asset.png"),dot=raw.lastIndexOf("."),ext=(dot>=0?raw.slice(dot).toLowerCase():".png").replace(/[^.a-z0-9]/g,"")||".png",base=devContentId(dot>=0?raw.slice(0,dot):raw,"asset");return `${base}${ext}`;}
function developerAssetUniqueId(base){const root=devContentId(base,"asset");let id=root,n=2;while(devAssets[id])id=`${root}-${n++}`;return id;}
async function developerAssetBitmap(file){
  if(typeof createImageBitmap==="function")return createImageBitmap(file);
  return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Image could not be read"));};img.src=url;});
}
function developerStandardSpriteLayout(){return {columns:4,rows:4,directionRows:{down:0,right:1,left:2,up:3},attackColumn:3,walkCycle:[0,1,2,1]};}
function developerSpriteImportType(type){return ["mobSprite","npcSprite","playerAppearance"].includes(type);}
function developerModularCharacterImportType(_type){return false;}
async function developerNormalizeCharacterRigSheet(file){
  const image=await developerAssetBitmap(file),sourceWidth=image.width||image.naturalWidth,sourceHeight=image.height||image.naturalHeight;if(!sourceWidth||!sourceHeight){image.close?.();throw new Error("Character rig dimensions could not be read");}
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=512;const c=canvas.getContext("2d");c.clearRect(0,0,512,512);c.imageSmoothingEnabled=false;c.drawImage(image,0,0,sourceWidth,sourceHeight,0,0,512,512);image.close?.();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Could not encode character rig sheet")),"image/png"));
  return {blob,sourceWidth,sourceHeight,sourceBytes:Number(file?.size)||0,width:512,height:512,cellSize:128,rigCoordinatesPreserved:true};
}
async function developerNormalizeSpriteSheet(file){
  const image=await developerAssetBitmap(file),sourceWidth=image.width||image.naturalWidth,sourceHeight=image.height||image.naturalHeight;
  if(!sourceWidth||!sourceHeight){image.close?.();throw new Error("Sprite dimensions could not be read");}
  const canvas=document.createElement("canvas"),cell=128,safe=112;canvas.width=cell*4;canvas.height=cell*4;
  const c=canvas.getContext("2d");c.clearRect(0,0,canvas.width,canvas.height);c.imageSmoothingEnabled=false;
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
    const sx0=Math.round(col*sourceWidth/4),sx1=Math.round((col+1)*sourceWidth/4),sy0=Math.round(row*sourceHeight/4),sy1=Math.round((row+1)*sourceHeight/4),sw=Math.max(1,sx1-sx0),sh=Math.max(1,sy1-sy0);
    const fit=Math.min(safe/sw,safe/sh),dw=Math.max(1,Math.round(sw*fit)),dh=Math.max(1,Math.round(sh*fit)),dx=col*cell+Math.round((cell-dw)/2),dy=row*cell+Math.round((cell-dh)/2);
    c.drawImage(image,sx0,sy0,sw,sh,dx,dy,dw,dh);
  }
  image.close?.();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Could not encode normalized sprite sheet")),"image/png"));
  return {blob,sourceWidth,sourceHeight,sourceBytes:Number(file?.size)||0,width:512,height:512,cellSize:128};
}
async function developerAssetAnalysis(file,type){
  const image=await developerAssetBitmap(file),width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;
  if(!width||!height){image.close?.();throw new Error("Image dimensions could not be read");}
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const c=canvas.getContext("2d",{willReadFrequently:true});c.clearRect(0,0,width,height);c.drawImage(image,0,0);image.close?.();
  const pixels=c.getImageData(0,0,width,height).data;let opaque=0,transparent=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]>8)opaque++;if(pixels[i]<250)transparent++;}
  const analysis={hasTransparency:transparent>0,alphaCoverage:Number((opaque/Math.max(1,width*height)).toFixed(4))};
  if(developerSpriteImportType(type)){
    const columns=4,rows=4,frames=[];let edgeTouch=false,safeAreaOverflow=false,emptyFrames=0,maxVisibleWidth=0,maxVisibleHeight=0;
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const sx0=Math.round(col*width/columns),sx1=Math.round((col+1)*width/columns),sy0=Math.round(row*height/rows),sy1=Math.round((row+1)*height/rows);
      let minX=sx1,minY=sy1,maxX=sx0-1,maxY=sy0-1;
      for(let py=sy0;py<sy1;py++){let index=(py*width+sx0)*4+3;for(let px=sx0;px<sx1;px++,index+=4)if(pixels[index]>8){if(px<minX)minX=px;if(px>maxX)maxX=px;if(py<minY)minY=py;if(py>maxY)maxY=py;}}
      if(maxX<minX||maxY<minY){emptyFrames++;frames.push({row,col,visibleWidth:0,visibleHeight:0});continue;}
      const visibleWidth=maxX-minX+1,visibleHeight=maxY-minY+1,cellW=sx1-sx0,cellH=sy1-sy0,marginX=Math.max(1,Math.round(cellW*.01)),marginY=Math.max(1,Math.round(cellH*.01)),safeInsetX=Math.round(cellW*(20/128)),safeInsetY=Math.round(cellH*(20/128));
      const touches=minX-sx0<=marginX||minY-sy0<=marginY||sx1-1-maxX<=marginX||sy1-1-maxY<=marginY,unsafe=minX<sx0+safeInsetX||minY<sy0+safeInsetY||maxX>sx1-1-safeInsetX||maxY>sy1-1-safeInsetY;edgeTouch=edgeTouch||touches;safeAreaOverflow=safeAreaOverflow||unsafe;maxVisibleWidth=Math.max(maxVisibleWidth,visibleWidth);maxVisibleHeight=Math.max(maxVisibleHeight,visibleHeight);frames.push({row,col,visibleWidth,visibleHeight});
    }
    const reference=frames.find(frame=>frame.row===0&&frame.col===0)||frames.find(frame=>frame.visibleHeight>0)||{visibleWidth:0,visibleHeight:0};
    analysis.frameMetrics={columns,rows,referenceVisibleWidth:reference.visibleWidth,referenceVisibleHeight:reference.visibleHeight,maxVisibleWidth,maxVisibleHeight,emptyFrames,edgeTouch,safeAreaOverflow};
  }
  return {width,height,analysis};
}
async function developerAssetPathExists(path){try{await developerNestedFileHandle(devProjectDirectoryHandle,path);return true;}catch{return false;}}
async function developerAssetUniquePath(folder,filename){const dot=filename.lastIndexOf("."),base=dot>=0?filename.slice(0,dot):filename,ext=dot>=0?filename.slice(dot):"";let candidate=`${folder}/${filename}`,n=2;while(await developerAssetPathExists(candidate))candidate=`${folder}/${base}-${n++}${ext}`;return candidate;}


async function developerImportAssetFile(file,purposeValue){
  if(!file)throw new Error("No file selected");if(!devProjectDirectoryHandle)throw new Error("Open the Little Realm Project Folder before importing assets");
  const purpose=developerAssetImportPurpose(purposeValue),type=purpose.type;
  if(!(file.type||"").startsWith("image/")&&!/\.(png|webp|jpg|jpeg)$/i.test(file.name))throw new Error(`${file.name}: image files only`);
  let importPayload=file,sourceMeta=null,filename=developerAssetSafeFilename(file.name);
  if(developerModularCharacterImportType(type)){const normalized=await developerNormalizeCharacterRigSheet(file);sourceMeta=normalized;importPayload=normalized.blob;filename=developerAssetSafeFilename(file.name.replace(/\.[^.]+$/,'')+'.png');}
  else if(developerSpriteImportType(type)){const normalized=await developerNormalizeSpriteSheet(file);sourceMeta=normalized;importPayload=normalized.blob;filename=developerAssetSafeFilename(file.name.replace(/\.[^.]+$/,'')+'.png');}
  const inspected=await developerAssetAnalysis(importPayload,type),path=await developerAssetUniquePath(developerAssetFolder(type),filename),handle=await developerNestedFileHandle(devProjectDirectoryHandle,path,{create:true}),writable=await handle.createWritable();await writable.write(importPayload);await writable.close();
  const id=developerAssetUniqueId(`${type}-${filename.replace(/\.[^.]+$/,'')}`),name=file.name.replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const rigBodyId=developerModularCharacterImportType(type)&&type!=="playerBody"?(String(devCharacterDefaults?.defaultBodyAsset||"")||Object.entries(devAssets).find(([,rec])=>rec?.type==="playerBody")?.[0]||""):"";
  const spriteMeta=developerSpriteImportType(type)?{normalizedSheet:true,frameCellSize:128,sourceName:file.name,sourceWidth:sourceMeta.sourceWidth,sourceHeight:sourceMeta.sourceHeight,sourceBytes:sourceMeta.sourceBytes,spriteLayout:developerStandardSpriteLayout(),...(type==='mobSprite'?{scaleMode:'visibleHeight'}:{scaleMode:type.startsWith('player')?'characterRig':'displayHeight'}),...(developerModularCharacterImportType(type)?{rigCoordinatesPreserved:true,rigTransform:{scale:1,offsetX:0,offsetY:0,directionOffsets:{down:{offsetX:0,offsetY:0},right:{offsetX:0,offsetY:0},left:{offsetX:0,offsetY:0},up:{offsetX:0,offsetY:0}}},rigBodyAsset:rigBodyId}: {})}:{};
  devAssets[id]={name,path,type,width:inspected.width,height:inspected.height,bytes:Number(importPayload.size)||file.size,imported:true,artProfile:'little-realm-v1',analysis:inspected.analysis,...spriteMeta,...(type==='playerEquipment'?{equipmentSlot:purpose.equipmentSlot||'chest'}:{})};
  if(type==='playerBody'){devAssets[id].rigBodyAsset=id;if(!devCharacterDefaults.defaultBodyAsset)devCharacterDefaults.defaultBodyAsset=id;window.LR_CHARACTER_DEFAULTS=devCharacterDefaults;}
  let createdId='';if(purpose.auto==='terrain')createdId=createDeveloperTerrain(name,id,{silent:true});else if(purpose.auto==='object')createdId=createDeveloperObjectDefinitionFromAsset(devAssets[id],id,{silent:true});
  return {id,asset:devAssets[id],createdId,purpose,sourceMeta,warnings:developerAssetValidationRows(devAssets[id]).filter(row=>row.state==='warn').length};
}
async function importDeveloperAssetFiles(files){
  const list=Array.from(files||[]);if(!list.length)return;if(!devProjectDirectoryHandle){devSetStatus('Open the Little Realm Project Folder before importing assets');return;}
  const purposeValue=devPanel?.querySelector('#devAssetImportType')?.value||'assetOnly',purpose=developerAssetImportPurpose(purposeValue),results=[],errors=[];
  for(let i=0;i<list.length;i++){const file=list[i];devSetStatus(`Importing ${i+1}/${list.length} • ${file.name}`);try{results.push(await developerImportAssetFile(file,purposeValue));}catch(err){console.error(err);errors.push(err?.message||`${file.name}: import failed`);}}
  if(results.length){devAssetSelectedId=results[results.length-1].id;saveDeveloperDraft();}
  refreshDeveloperPanel();const resultRoot=devPanel?.querySelector('#devAssetImportResult');if(resultRoot){const created=purpose.auto==='terrain'?`${results.length} paintable terrain${results.length===1?'':'s'}`:purpose.auto==='object'?`${results.length} placeable object${results.length===1?'':'s'}`:`${results.length} asset${results.length===1?'':'s'}`;const action=purpose.auto==='terrain'?'<button data-import-open="terrain">Open Terrain</button>':purpose.auto==='object'?'<button data-import-open="objects">Open Objects</button>':purposeValue==='npcSprite'?'<button data-import-open="npcs">Open NPCs</button>':purposeValue==='mobSprite'?'<button data-import-open="content" data-import-content="mobs">Open Mob Types</button>':purposeValue==='itemIcon'?'<button data-import-open="content" data-import-content="items">Open Items</button>':purposeValue==='treeSprite'?'<button data-import-open="terrain">Open Terrain</button>':'';resultRoot.innerHTML=`<div class="devImportResult ${errors.length?'warn':''}"><b>${created} imported</b><span>${errors.length?`${errors.length} file${errors.length===1?'':'s'} failed. `:''}Ready for the next step.</span><div>${action}<button data-import-more>Import More</button></div></div>`;resultRoot.querySelector('[data-import-more]')?.addEventListener('click',()=>devPanel.querySelector('#devAssetImportFile')?.click());resultRoot.querySelector('[data-import-open]')?.addEventListener('click',event=>{const button=event.currentTarget;if(button.dataset.importContent)devContentType=button.dataset.importContent;setDeveloperTab(button.dataset.importOpen);refreshDeveloperPanel();});}
  const warningCount=results.reduce((sum,r)=>sum+r.warnings,0);devSetStatus(`${results.length}/${list.length} imported as ${purpose.label}${warningCount?` • ${warningCount} technical warning${warningCount===1?'':'s'}`:''}${errors.length?` • ${errors.length} failed`:''}`);
}
async function importDeveloperAssetFile(file){return importDeveloperAssetFiles(file?[file]:[]);}
