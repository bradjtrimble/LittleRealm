// Player identity and visual appearance.
// Little Realm uses complete premade playable-character sprite sheets. Equipment
// remains a gameplay/inventory system and does not redraw the player sprite.
const PLAYER_CHARACTER_ASSET_TYPES=new Set(["playerAppearance"]);
const PLAYER_CHARACTER_IMAGE_CACHE=new Map();
let startupFlowActive=false;
let characterSelectPreviewTimer=0;

function characterAssets(type="playerAppearance"){
  return Object.entries(window.LR_ASSETS||{}).filter(([,asset])=>asset?.type===type&&asset?.path);
}
function defaultPlayerAppearanceAssetId(){
  const configured=String(window.LR_CHARACTER_DEFAULTS?.defaultAppearanceAsset||"");
  if(configured&&window.LR_ASSETS?.[configured]?.type==="playerAppearance")return configured;
  return characterAssets("playerAppearance")[0]?.[0]||"";
}
function freshCharacterProfile(){
  return {
    name:String(window.LR_CHARACTER_DEFAULTS?.defaultName||"Adventurer").slice(0,24),
    appearanceAsset:defaultPlayerAppearanceAssetId()
  };
}
function normalizeCharacterProfile(raw){
  const base=freshCharacterProfile(),source=raw&&typeof raw==="object"?raw:{};
  const name=String(source.name||base.name||"Adventurer").trim().slice(0,24)||"Adventurer";
  // Old modular saves intentionally fall back to the current premade default.
  // This keeps older saves playable after the modular paper-doll system is retired.
  const requested=String(source.appearanceAsset||"");
  const appearanceAsset=window.LR_ASSETS?.[requested]?.type==="playerAppearance"?requested:base.appearanceAsset;
  return {name,appearanceAsset};
}
function currentCharacterProfile(){return normalizeCharacterProfile(state?.character);}
function currentCharacterName(){return currentCharacterProfile().name||"Adventurer";}
function characterAssetImage(assetId){
  const asset=window.LR_ASSETS?.[assetId];if(!asset?.path)return null;
  let image=PLAYER_CHARACTER_IMAGE_CACHE.get(assetId);
  if(!image){image=new Image();image.src=`./${asset.path}`;image.onload=()=>buildSpriteFrameMeta(image);PLAYER_CHARACTER_IMAGE_CACHE.set(assetId,image);}
  return image;
}
function characterDirectionRow(asset,facing){
  const map=asset?.spriteLayout?.directionRows||{down:0,right:1,left:2,up:3};return clamp(Math.floor(numberOr(map[facing],0)),0,3);
}
function drawCharacterLayer(c,assetId,x,y,scale,col,facing,bob=0){
  const asset=window.LR_ASSETS?.[assetId],image=characterAssetImage(assetId);if(!asset||!image?.naturalWidth||!image?.naturalHeight)return false;
  const columns=Math.max(1,Math.floor(numberOr(asset.spriteLayout?.columns,4))),rows=Math.max(1,Math.floor(numberOr(asset.spriteLayout?.rows,4))),frameW=image.naturalWidth/columns,frameH=image.naturalHeight/rows,row=characterDirectionRow(asset,facing),sx=Math.round(col*frameW),sy=Math.round(row*frameH),sw=Math.round(frameW),sh=Math.round(frameH);
  // 384 px is the original player's per-frame height. Scaling every registered
  // playable character to that reference keeps older and normalized sheets at
  // the same world size without any modular-layer alignment step.
  const normalizedScale=scale*(384/Math.max(1,frameH)),dw=frameW*normalizedScale,dh=frameH*normalizedScale,dx=x-dw/2,dy=y-dh+17-bob;
  c.drawImage(image,sx,sy,sw,sh,Math.round(dx),Math.round(dy),dw,dh);return true;
}
function drawPlayerCharacter(c,x,y,scale=1,moving=false,animT=0,facing="down",profile=currentCharacterProfile()){
  c.save();c.imageSmoothingEnabled=false;
  const col=moving?[0,1,2,3][Math.floor(animT*8)%4]:0,bob=moving?Math.abs(Math.sin(animT*8))*1.2:0;
  c.fillStyle="rgba(0,0,0,.20)";c.beginPath();c.ellipse(x,y+11,5.5+(moving?.6:0),2.4,0,0,Math.PI*2);c.fill();
  const assetId=profile?.appearanceAsset||defaultPlayerAppearanceAssetId(),drawn=assetId?drawCharacterLayer(c,assetId,x,y,scale,col,facing,bob):false;
  if(!drawn){c.fillStyle="#c8b28a";c.fillRect(Math.round(x-5),Math.round(y-16),10,16);c.fillStyle="#5e4435";c.fillRect(Math.round(x-4),Math.round(y-20),8,5);}
  c.restore();
}

function validPlayerSaveExists(){
  try{const raw=localStorage.getItem(PLAYER_SAVE_KEY);if(!raw)return false;const payload=JSON.parse(raw);return payload?.format===PLAYER_SAVE_FORMAT&&Number(payload?.schemaVersion)===PLAYER_SAVE_SCHEMA_VERSION&&!!payload?.state;}catch{return false;}
}
function setStartupView(view){
  const screen=document.getElementById("startupScreen"),title=document.getElementById("startupTitleView"),select=document.getElementById("characterSelectView");if(!screen)return;
  screen.classList.add("show");title?.classList.toggle("active",view==="title");select?.classList.toggle("active",view==="select");
  if(view==="select")refreshCharacterSelect();
}
function finishStartupFlow(){startupFlowActive=false;document.getElementById("startupScreen")?.classList.remove("show");resetHeldKeyboardMovement?.();}
function beginNewCharacterFlow(){startupFlowActive=true;closeAll?.();setStartupView("select");}
function initializeStartupFlow(){
  const screen=document.getElementById("startupScreen");
  if(window.LR_BUILDER_MODE){startupFlowActive=false;screen?.classList.remove("show");reset({silent:true});return;}
  startupFlowActive=true;reset({silent:true});setStartupView("title");
  const cont=document.getElementById("startupContinue");if(cont)cont.disabled=!validPlayerSaveExists();
}
function characterSelectionFromUi(){
  const name=String(document.getElementById("characterNameInput")?.value||"").trim().slice(0,24)||"Adventurer";
  const appearanceAsset=document.querySelector('[name="characterAppearance"]:checked')?.value||defaultPlayerAppearanceAssetId();
  return normalizeCharacterProfile({name,appearanceAsset});
}
function characterHtmlEscape(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function characterChoiceCards(selected,entries=characterAssets("playerAppearance")){
  if(!entries.length)return "";
  return entries.map(([id,asset],index)=>{
    const checked=id===selected||(!selected&&index===0),name=characterHtmlEscape(asset.name||id),path=characterHtmlEscape(asset.path),description=characterHtmlEscape(asset.description||"Premade Little Realm adventurer");
    return `<label class="characterChoice characterSelectCard"><input type="radio" name="characterAppearance" value="${characterHtmlEscape(id)}" ${checked?"checked":""}><span class="characterChoiceThumb characterSelectThumb"><span class="characterSelectSprite" style="background-image:url('./${path}')"></span></span><b>${name}</b><small>${description}</small></label>`;
  }).join("");
}
function refreshCharacterSelect(){
  const entries=characterAssets("playerAppearance"),profile=freshCharacterProfile(),name=document.getElementById("characterNameInput"),grid=document.getElementById("characterAppearanceChoices");
  if(name&&!name.value)name.value=profile.name;if(!grid)return;
  grid.innerHTML=entries.length?characterChoiceCards(profile.appearanceAsset,entries):'<div class="characterCreatorEmpty">Import a Playable Character sprite in World Builder first.</div>';
  grid.querySelectorAll('input[name="characterAppearance"]').forEach(input=>input.addEventListener("change",drawCharacterSelectPreview));
  const button=document.getElementById("characterCreateBtn");if(button)button.disabled=!entries.length;
  drawCharacterSelectPreview();
}
function drawCharacterSelectPreview(){
  const canvas=document.getElementById("characterPreviewCanvas");if(!canvas)return;const c=canvas.getContext("2d");c.clearRect(0,0,canvas.width,canvas.height);c.imageSmoothingEnabled=false;c.fillStyle="#171322";c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle="rgba(255,255,255,.04)";c.beginPath();c.ellipse(canvas.width/2,canvas.height*.79,66,20,0,0,Math.PI*2);c.fill();
  const profile=characterSelectionFromUi(),phase=(performance.now()/1000);drawPlayerCharacter(c,canvas.width/2,canvas.height*.73,.46,true,phase,"down",profile);
}
function startCharacterSelectPreviewLoop(){if(characterSelectPreviewTimer)return;const tick=()=>{characterSelectPreviewTimer=requestAnimationFrame(tick);if(document.getElementById("characterSelectView")?.classList.contains("active"))drawCharacterSelectPreview();};characterSelectPreviewTimer=requestAnimationFrame(tick);}
function bindStartupScreen(){
  document.getElementById("startupNew")?.addEventListener("click",beginNewCharacterFlow);
  document.getElementById("startupContinue")?.addEventListener("click",async()=>{if(await load({silent:true})){finishStartupFlow();toast(`Welcome back, ${currentCharacterName()}.`);}});
  document.getElementById("characterCreatorBack")?.addEventListener("click",()=>setStartupView("title"));
  document.getElementById("characterCreateBtn")?.addEventListener("click",()=>{const profile=characterSelectionFromUi();if(!profile.appearanceAsset){toast("Choose a character first.");return;}reset({character:profile,silent:true});save({silent:true});finishStartupFlow();toast(`Welcome to Little Realm, ${profile.name}.`);});
  document.getElementById("characterNameInput")?.addEventListener("input",drawCharacterSelectPreview);startCharacterSelectPreviewLoop();
}
