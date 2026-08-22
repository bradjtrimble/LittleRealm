// Batch audio importer -------------------------------------------------------
function developerAudioFolder(category){return `assets/audio/${["music","ambience","sfx","ui"].includes(category)?category:"sfx"}`;}
function developerAudioSafeFilename(name){const raw=String(name||"audio.ogg"),dot=raw.lastIndexOf("."),ext=(dot>=0?raw.slice(dot).toLowerCase():".ogg").replace(/[^.a-z0-9]/g,"")||".ogg",base=devContentId(dot>=0?raw.slice(0,dot):raw,"audio");return `${base}${ext}`;}
async function developerAudioUniquePath(folder,filename){const dot=filename.lastIndexOf("."),base=dot>=0?filename.slice(0,dot):filename,ext=dot>=0?filename.slice(dot):"";let candidate=`${folder}/${filename}`,n=2;while(await developerAssetPathExists(candidate))candidate=`${folder}/${base}-${n++}${ext}`;return candidate;}
async function developerImportAudioFiles(files){
  const list=Array.from(files||[]);if(!list.length)return;if(!devProjectDirectoryHandle){devSetStatus("Open the Little Realm Project Folder before importing audio");return;}
  const category=devPanel?.querySelector("#devAudioImportCategory")?.value||"sfx",results=[],errors=[];
  for(let i=0;i<list.length;i++){
    const file=list[i],ext=(file.name.split(".").pop()||"").toLowerCase();devSetStatus(`Importing audio ${i+1}/${list.length} • ${file.name}`);
    try{if(!(file.type||"").startsWith("audio/")&&!['mp3','ogg','wav'].includes(ext))throw new Error(`${file.name}: use MP3, OGG, or WAV`);const filename=developerAudioSafeFilename(file.name),path=await developerAudioUniquePath(developerAudioFolder(category),filename),handle=await developerNestedFileHandle(devProjectDirectoryHandle,path,{create:true}),writable=await handle.createWritable();await writable.write(file);await writable.close();const id=developerAudioUniqueId(filename.replace(/\.[^.]+$/,'')),name=file.name.replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());devAudioClips[id]={name,path,category,volume:1,loop:category==="music"||category==="ambience",bytes:Number(file.size)||0,imported:true};results.push(id);}catch(err){console.error(err);errors.push(err?.message||`${file.name}: import failed`);}
  }
  if(results.length)devAudioSelectedId=results[results.length-1];developerAudioSyncRuntime();saveDeveloperDraft();refreshDeveloperAudioPanel();devSetStatus(`${results.length}/${list.length} audio files imported${errors.length?` • ${errors.length} failed`:""}`);
}
