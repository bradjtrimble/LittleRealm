function developerAssetValidationRows(asset){
  const rows=[],sprite=developerSpriteImportType(asset?.type),rig=developerCharacterRigAssetType?.(asset?.type),analysis=asset?.analysis||{},metrics=analysis.frameMetrics;
  if(sprite&&asset?.sourceWidth&&asset?.sourceHeight)rows.push({state:"info",label:"AI source sheet",detail:`${asset.sourceWidth} × ${asset.sourceHeight} • original import`});
  rows.push({state:asset?.width&&asset?.height?"good":"warn",label:rig?"Rig sheet":sprite?"Game sheet":"Source dimensions",detail:asset?.width&&asset?.height?(sprite?`${asset.width} × ${asset.height} • ${Math.round((asset.width||0)/4)} px cells`:`${asset.width} × ${asset.height}`):"Not recorded"});
  if(sprite){
    if(rig)rows.push({state:asset?.rigCoordinatesPreserved&&asset.width===512&&asset.height===512?"good":"warn",label:"Exact rig coordinates",detail:asset?.rigCoordinatesPreserved?"Whole 4×4 sheet normalized once to 512 × 512; frame positions are preserved":"Character layer was not imported through the exact-coordinate rig path"});
    else rows.push({state:asset?.normalizedSheet?(asset.width===512&&asset.height===512?"good":"warn"):"info",label:"4 × 4 normalization",detail:asset?.normalizedSheet?(asset.width===512&&asset.height===512?"Normalized to 512 × 512 on import":"Normalized sheet is not 512 × 512"):"Existing project sprite; runtime reads its registered 4 × 4 layout"});
    rows.push({state:analysis.hasTransparency?"good":"warn",label:"Transparent background",detail:analysis.hasTransparency?"Detected":"No transparent pixels detected"});
    rows.push({state:metrics&&metrics.emptyFrames===0?"good":"warn",label:"4 × 4 frame read",detail:metrics?`${16-Math.min(16,metrics.emptyFrames||0)}/16 populated frames`:"Frame analysis missing"});
    const unsafe=metrics?.edgeTouch;rows.push({state:metrics&&!unsafe?"good":"warn",label:"Safe framing",detail:metrics?(unsafe?"Artwork reaches a 128 px frame edge":"Visible pixels stay clear of frame edges"):"Frame analysis missing"});
    const map=asset?.spriteLayout?.directionRows||{};rows.push({state:"info",label:"Direction rows",detail:`Down ${Number(map.down??0)+1} • Right ${Number(map.right??1)+1} • Left ${Number(map.left??2)+1} • Up ${Number(map.up??3)+1}`});
    rows.push({state:"good",label:"World scale",detail:asset.type==="mobSprite"?"Normalized by visible height":rig?"Uses the exact modular player rig":asset.type?.startsWith?.("player")?"Uses the standard player character rig":"NPC display height controlled in-game"});
  }else rows.push({state:"info",label:"Little Realm profile",detail:asset?.artProfile||"Existing project asset"});
  return rows;
}
function developerAssetValidationHtml(asset){
  const metrics=asset?.analysis?.frameMetrics,rows=developerAssetValidationRows(asset),warnings=rows.filter(row=>row.state==="warn").length,sprite=developerSpriteImportType(asset?.type);
  const rig=developerCharacterRigAssetType?.(asset?.type),hint=metrics?`<div class="devHint" style="margin-top:7px">Reference-frame visible bounds: <b>${Math.round(metrics.referenceVisibleWidth||0)} × ${Math.round(metrics.referenceVisibleHeight||0)} px</b>. ${rig?"Modular layers keep one shared 128 px coordinate system; use Layer Alignment only if the generated art itself is oversized or offset.":sprite&&asset?.sourceWidth?`The AI source was ${asset.sourceWidth} × ${asset.sourceHeight}; the project uses the normalized ${asset.width} × ${asset.height} game sheet.`:"Source resolution does not control world size."}</div>`:"";
  return `<div class="devAssetChecks"><div class="devAssetChecksTitle"><b>Little Realm Asset Check</b><span class="${warnings?"warn":"good"}">${warnings?`${warnings} warning${warnings===1?"":"s"}`:"READY"}</span></div>${rows.map(row=>`<div class="devAssetCheck ${row.state}"><span>${row.state==="good"?"✓":row.state==="warn"?"!":"•"}</span><b>${devContentEscape(row.label)}</b><small>${devContentEscape(row.detail)}</small></div>`).join("")}${hint}</div>`;
}

function developerSpriteDirectionMappingHtml(asset){
  if(!developerSpriteImportType(asset?.type))return "";
  const map=asset?.spriteLayout?.directionRows||{down:0,right:1,left:2,up:3};
  const rowOptions=value=>[0,1,2,3].map(row=>`<option value="${row}" ${Number(value)===row?"selected":""}>Row ${row+1}</option>`).join("");
  return `<div class="devAssetChecks"><div class="devAssetChecksTitle"><b>Sprite Direction Mapping</b><span class="good">EDITABLE</span></div><div class="devHint" style="margin:4px 0 9px">If a sprite turns the wrong way in-game, map each facing direction to the row that visually points that way. AI sprite sheets do not always follow the requested left/right row order.</div><div class="devPair"><label>Facing Down<select id="devSpriteRowDown">${rowOptions(map.down??0)}</select></label><label>Facing Right<select id="devSpriteRowRight">${rowOptions(map.right??1)}</select></label></div><div class="devPair"><label>Facing Left<select id="devSpriteRowLeft">${rowOptions(map.left??2)}</select></label><label>Facing Up<select id="devSpriteRowUp">${rowOptions(map.up??3)}</select></label></div><div class="devRow"><button id="devSpriteSwapSides">Swap Left / Right</button><button id="devSpriteResetRows">Prompt Standard</button></div></div>`;
}
function bindDeveloperSpriteDirectionMapping(root,asset){
  if(!root||!developerSpriteImportType(asset?.type))return;
  const getMap=()=>({down:Number(root.querySelector('#devSpriteRowDown')?.value??0),right:Number(root.querySelector('#devSpriteRowRight')?.value??1),left:Number(root.querySelector('#devSpriteRowLeft')?.value??2),up:Number(root.querySelector('#devSpriteRowUp')?.value??3)});
  const commit=map=>{
    const rows=[map.down,map.right,map.left,map.up];
    if(new Set(rows).size!==4){devSetStatus('Each facing direction must use a different sprite row');refreshDeveloperAssetPanel();return;}
    asset.spriteLayout={...(asset.spriteLayout||developerStandardSpriteLayout()),directionRows:{...map}};
    // Keep the live runtime asset registry pointed at the editable Builder records.
    // Otherwise F2 playtesting can keep rendering the pre-edit asset metadata until
    // the whole shared content library is reloaded.
    if(typeof window!=="undefined"){
      window.LR_ASSETS=devAssets;
      if(typeof developerContentLibrary==="function")window.LR_SHARED_CONTENT=developerContentLibrary();
    }
    saveDeveloperDraft();
    devSetStatus(`Direction mapping applied live for ${asset.name||'sprite asset'} • Save Project to persist`);
    refreshDeveloperAssetPanel();
  };
  ['#devSpriteRowDown','#devSpriteRowRight','#devSpriteRowLeft','#devSpriteRowUp'].forEach(selector=>root.querySelector(selector)?.addEventListener('change',()=>commit(getMap())));
  root.querySelector('#devSpriteSwapSides')?.addEventListener('click',()=>{const map=getMap();[map.left,map.right]=[map.right,map.left];commit(map);});
  root.querySelector('#devSpriteResetRows')?.addEventListener('click',()=>commit({down:0,right:1,left:2,up:3}));
}

function developerArtPromptKindOptions(){
  return {
    mob:{label:"Mob Sprite",importType:"mobSprite",sizeLabel:"World Size",sizeOptions:[["tiny","Tiny • 0.35× player"],["small","Small • 0.55× player"],["medium","Medium • 0.80× player"],["large","Large • 1.05× player"],["huge","Huge • 1.35× player"],["boss","Boss • 1.80× player"]]},
    npc:{label:"NPC Sprite",importType:"npcSprite",sizeLabel:"World Size",sizeOptions:[["small","Small • 0.85× player"],["medium","Medium • 1.00× player"],["large","Large • 1.15× player"]]},
    player:{label:"Playable Character",importType:"playerAppearance",sizeLabel:"Rig",sizeOptions:[["standard","Standard Player Rig"]]},
    object:{label:"World Object",importType:"worldImage",sizeLabel:"Object Scale",sizeOptions:[["small","Small Prop"],["medium","Medium Prop"],["large","Large Prop"]]},
    building:{label:"Building",importType:"worldImage",sizeLabel:"Building Scale",sizeOptions:[["small","Small Hut"],["medium","Medium House"],["large","Large Building"]]},
    terrain:{label:"Terrain Texture",importType:"terrainTexture",sizeLabel:"Detail Density",sizeOptions:[["micro","Micro detail"],["fine","Fine detail"],["medium","Medium detail"]]},
    item:{label:"Item Icon",importType:"itemIcon",sizeLabel:"Icon Scale",sizeOptions:[["small","Small"],["medium","Medium"],["large","Large"]]},
    effect:{label:"Effect Sprite",importType:"worldImage",sizeLabel:"Effect Scale",sizeOptions:[["small","Small"],["medium","Medium"],["large","Large"]]}
  };
}
function developerEnsureArtPromptDraft(){
  const defaults={kind:"mob",sizeClass:"medium",subject:"",description:"",palette:"",constraints:""};
  if(!devArtPromptDraft||typeof devArtPromptDraft!=="object")devArtPromptDraft={...defaults};
  else devArtPromptDraft={...defaults,...devArtPromptDraft};
  return devArtPromptDraft;
}
function developerArtPromptStandardSummaryHtml(){
  return `<div class="devHint">Lock the game's art direction before you generate anything new. The prompt builder below keeps <b>style</b>, <b>framing</b>, <b>detail density</b>, and <b>technical layout</b> consistent so you only have to describe the subject.</div><div class="devArtGuideGrid"><div class="devArtGuideCard"><b>Rendering</b><small>Polished fantasy pixel art, crisp pixel edges, slightly chunky dark outlines, readable silhouettes, soft dimensional shading, grounded fantasy colors.</small></div><div class="devArtGuideCard"><b>Camera</b><small>Top-down 2D RPG / slight 3⁄4 game view matching Little Realm. Never a full side view or isometric scene render.</small></div><div class="devArtGuideCard"><b>Consistency</b><small>No painterly blur, no photorealism, no smooth vector look, no promotional poster composition, and no scene background unless the asset type explicitly needs one.</small></div><div class="devArtGuideCard"><b>Scale Guide</b><small>Player ≈ 1.0 LR. Small mob ≈ 0.55 LR. Medium mob ≈ 0.80 LR. Large mob ≈ 1.05 LR. Small props should stay visually modest next to the player.</small></div></div>`;
}
function developerArtPromptBuildText(draft){
  const kind=(developerArtPromptKindOptions()[draft.kind]||developerArtPromptKindOptions().mob),subject=String(draft.subject||kind.label).trim()||kind.label,description=String(draft.description||"").trim(),palette=String(draft.palette||"").trim(),constraints=String(draft.constraints||"").trim(),sizeLabel=(kind.sizeOptions.find(([value])=>value===draft.sizeClass)||kind.sizeOptions[0]||["","Custom"])[1];
  const referenceBlock=typeof developerArtReferencePromptText==="function"?developerArtReferencePromptText(draft.kind):"";
  const style=`Style requirements: polished fantasy pixel art for Little Realm, top-down 2D RPG perspective, crisp intentional pixel edges, slightly chunky dark outlines, readable silhouette, soft dimensional shading, bright but grounded fantasy colors, and clean game-ready rendering. Do not make it painterly, realistic, blurry, or vector-smooth.`;
  const subjectBlock=`Subject: ${subject}.${description?` ${description}`:""}${palette?` Color / material notes: ${palette}.`:""}`;
  const constraintsBlock=constraints?`Additional constraints: ${constraints}.`:"";
  if(draft.kind==="mob"||draft.kind==="npc"||draft.kind==="player")return `Create a production-ready ${kind.label.toLowerCase()} for the fantasy game Little Realm.

${subjectBlock}

World size target: ${sizeLabel}.

${style}

Technical layout requirements:
- final output must be a strict 4 columns × 4 rows sprite sheet
- exactly 16 frames total
- target frame size is 128 × 128 pixels and target sheet size is 512 × 512 pixels
- if the image generator returns a different square resolution, preserve a strict equal 4 × 4 grid; Little Realm will normalize it to 512 × 512 on import
- background must be fully transparent RGBA
- do not draw grid lines, labels, borders, or any extra markings
- row 1 = facing down, row 2 = facing right, row 3 = facing left, row 4 = facing up
- columns should read as a game-ready idle / walk sequence, with the 4th column usable as an attack or action pose

Safe-area requirements:
- at the 128 × 128 target size, visible artwork should stay inside a centered 88 × 88 safe area
- this is roughly the central 69% of each cell, leaving about 16% transparent padding on every side even if the generator returns a larger source sheet
- no body part, weapon, ears, horns, wings, tail, hands, feet, or effects should touch a cell boundary

Composition requirements:
- keep the subject centered in every frame
- maintain consistent proportions and scale across all 16 frames
- no scene background, floor tile, UI, or text
- the sprite should read clearly in-game at small size

${constraintsBlock}${referenceBlock?`\n\n${referenceBlock}`:""}`.trim();
  if(draft.kind==="terrain")return `Create a seamless tileable ${subject} ground texture for the fantasy game Little Realm.

${description||"This texture is for terrain painting across large map areas."}${palette?` Color / material notes: ${palette}.`:""}

${style}

Technical requirements:
- fully seamless / tileable on all edges
- designed for repeated use across large painted map areas
- detail must stay small-scale, dense, and evenly distributed
- avoid large focal elements, large isolated rocks or flowers, giant plants, horizon lines, or anything that looks like a full scene
- no labels, borders, or UI
- it should blend smoothly with nearby Little Realm terrain when tiled many times

Detail density target: ${sizeLabel}. Prioritize micro-detail and readability over dramatic composition.

${constraintsBlock}${referenceBlock?`\n\n${referenceBlock}`:""}`.trim();
  const canvasHint=draft.kind==="item"?`Use a compact square asset presentation, centered with padding, similar to a clean 64×64 or 128×128 game icon.`:draft.kind==="effect"?`Use a single clean effect asset on transparency, centered with padding, with no surrounding scene.`:draft.kind==="building"?`Present it as a single placeable building sprite with no surrounding scene. Keep the silhouette readable and the footprint clear.`:`Present it as a single placeable object sprite with no surrounding scene. Center it on the canvas with healthy transparent padding.`;
  return `Create a production-ready ${kind.label.toLowerCase()} for the fantasy game Little Realm.

${subjectBlock}

Scale target: ${sizeLabel}.

${style}

Technical requirements:
- background must be fully transparent RGBA
- show only the asset itself, not a full scene or environment
- keep the asset centered with comfortable transparent padding around it
- no labels, borders, UI, or extra decorative frame
- preserve a clean, readable silhouette suitable for top-down RPG gameplay
- do not overscale it; it should feel appropriate beside the Little Realm player and NPCs
- ${canvasHint}

${constraintsBlock}${referenceBlock?`\n\n${referenceBlock}`:""}`.trim();
}
function copyDeveloperArtPrompt(){
  const prompt=developerArtPromptBuildText(developerEnsureArtPromptDraft()),output=devPanel?.querySelector('#devArtPromptOutput');
  if(output)output.value=prompt;
  navigator.clipboard?.writeText(prompt).then(()=>devSetStatus('Little Realm art prompt copied')).catch(()=>devSetStatus(prompt));
}
function refreshDeveloperArtPromptBuilder(){
  if(!devPanel)return;const root=devPanel.querySelector('#devArtPromptBuilder');if(!root)return;const draft=developerEnsureArtPromptDraft(),kinds=developerArtPromptKindOptions(),kind=kinds[draft.kind]||kinds.mob;if(!kind.sizeOptions.some(([value])=>value===draft.sizeClass))draft.sizeClass=kind.sizeOptions[0][0];
  const kindOptions=Object.entries(kinds).map(([value,rec])=>`<option value="${devContentEscape(value)}" ${value===draft.kind?"selected":""}>${devContentEscape(rec.label)}</option>`).join('');
  const sizeOptions=(kind.sizeOptions||[]).map(([value,label])=>`<option value="${devContentEscape(value)}" ${value===draft.sizeClass?"selected":""}>${devContentEscape(label)}</option>`).join('');
  root.innerHTML=`${developerArtPromptStandardSummaryHtml()}${typeof developerArtPromptReferenceCardsHtml==="function"?developerArtPromptReferenceCardsHtml(draft.kind):""}<div class="devArtPromptLayout"><div class="devArtPromptForm"><div class="devPair"><label>Asset Type<select id="devArtPromptKind">${kindOptions}</select></label><label>${devContentEscape(kind.sizeLabel)}<select id="devArtPromptSize">${sizeOptions}</select></label></div><label>Subject<input id="devArtPromptSubject" value="${devContentEscape(draft.subject||"")}" placeholder="Forest spider, bakery stall, flower meadow, etc."></label><label>Description<textarea id="devArtPromptDescription" class="devArtPromptTextarea" placeholder="Describe the subject, shape, mood, and important physical details.">${devContentEscape(draft.description||"")}</textarea></label><label>Color / Material Notes<textarea id="devArtPromptPalette" class="devArtPromptTextarea" placeholder="Optional palette, materials, or style accents.">${devContentEscape(draft.palette||"")}</textarea></label><label>Additional Constraints<textarea id="devArtPromptConstraints" class="devArtPromptTextarea" placeholder="Optional exact requirements: signage text, no weapon, must feel cute, etc.">${devContentEscape(draft.constraints||"")}</textarea></label><div class="devPromptActions"><button id="devArtPromptCopy" class="primary">Copy Prompt</button><button id="devArtPromptReset">Reset</button></div><div class="devHint" style="margin-top:8px">Tip: choose the asset type first, then only describe <b>what the thing is</b>. The builder locks the Little Realm technical rules for you.</div></div><div class="devArtPromptOutputWrap"><div class="devSectionTitle" style="padding:0 0 6px;font-size:11px">Generated Prompt</div><textarea id="devArtPromptOutput" class="devPromptOutput" readonly>${devContentEscape(developerArtPromptBuildText(draft))}</textarea></div></div>`;
  const update=(rerender=false)=>{draft.kind=root.querySelector('#devArtPromptKind').value||'mob';draft.sizeClass=root.querySelector('#devArtPromptSize').value||'medium';draft.subject=root.querySelector('#devArtPromptSubject').value||'';draft.description=root.querySelector('#devArtPromptDescription').value||'';draft.palette=root.querySelector('#devArtPromptPalette').value||'';draft.constraints=root.querySelector('#devArtPromptConstraints').value||'';if(rerender){refreshDeveloperArtPromptBuilder();return;}const out=root.querySelector('#devArtPromptOutput');if(out)out.value=developerArtPromptBuildText(draft);};
  root.querySelector('#devArtPromptKind').onchange=()=>update(true);
  root.querySelector('#devArtPromptSize').onchange=()=>update();
  root.querySelector('#devArtPromptSubject').oninput=()=>update();
  root.querySelector('#devArtPromptDescription').oninput=()=>update();
  root.querySelector('#devArtPromptPalette').oninput=()=>update();
  root.querySelector('#devArtPromptConstraints').oninput=()=>update();
  root.querySelector('#devArtPromptCopy').onclick=copyDeveloperArtPrompt;
  root.querySelector('#devArtPromptReset').onclick=()=>{devArtPromptDraft={kind:'mob',sizeClass:'medium',subject:'',description:'',palette:'',constraints:''};refreshDeveloperArtPromptBuilder();devSetStatus('Art prompt builder reset');};
}

function refreshDeveloperAssetPanel(){
  if(!devPanel)return;const list=devPanel.querySelector('#devAssetList'),inspector=devPanel.querySelector('#devAssetInspector'),summary=devPanel.querySelector('#devAssetSummary');if(!list||!inspector)return;const entries=Object.entries(devAssets).filter(([,asset])=>!["playerBody","playerHair","playerEquipment"].includes(asset?.type));if(summary)summary.textContent=`${entries.length} registered images • batch import ready`;refreshDeveloperArtPromptBuilder();refreshDeveloperArtReferenceLibrary?.();
  if(devAssetSelectedId&&!devAssets[devAssetSelectedId])devAssetSelectedId=null;if(!devAssetSelectedId)devAssetSelectedId=entries[0]?.[0]||null;const filter=devPanel.querySelector('#devAssetFilter')?.value||'all',query=String(devPanel.querySelector('#devAssetSearch')?.value||'').trim().toLowerCase(),visible=entries.filter(([id,asset])=>(filter==='all'||asset.type===filter)&&(!query||`${asset.name||''} ${id} ${asset.path||''}`.toLowerCase().includes(query)));
  list.innerHTML=visible.map(([id,asset])=>`<button class="devAssetChip ${id===devAssetSelectedId?'active':''}" data-asset-id="${devContentEscape(id)}"><img src="./${devContentEscape(asset.path)}" alt=""><span><b>${devContentEscape(asset.name||id)}</b><small>${devContentEscape(developerAssetTypeLabel(asset.type))}</small></span></button>`).join('')||'<div class="devEmpty">No assets match this search/filter.</div>';list.querySelectorAll('[data-asset-id]').forEach(button=>button.onclick=()=>{devAssetSelectedId=button.dataset.assetId;refreshDeveloperAssetPanel();});
  const asset=devAssets[devAssetSelectedId];if(!asset){inspector.innerHTML='<div class="devEmpty">Import or choose an asset.</div>';return;}const targets=developerAssetAssignOptions(asset.type),dims=asset.width&&asset.height?`${asset.width} × ${asset.height}`:'dimensions not recorded',size=asset.bytes?`${Math.max(1,Math.round(asset.bytes/1024))} KB`:'size not recorded';
  const terrainRecordId=Object.keys(devTerrains||{}).find(id=>devTerrains[id]?.textureAsset===devAssetSelectedId)||'',objectRecordId=Object.keys(devObjectDefinitions||{}).find(id=>devObjectDefinitions[id]?.sourceAssetId===devAssetSelectedId)||'';
  const makePlayer=asset.type==='playerAppearance'?`<button id="devAssetDefaultPlayer" class="devWideButton primary">${devCharacterDefaults?.defaultAppearanceAsset===devAssetSelectedId?'Default Playable Character':'Set as Default Playable Character'}</button>`:'',makeNpc=asset.type==='npcSprite'?'<button id="devAssetPlaceNpc" class="devWideButton primary">Place NPC With This Sprite</button>':'',makeObject=asset.type==='worldImage'?(objectRecordId?'<button id="devAssetOpenObject" class="devWideButton primary">Open Placeable Object</button>':'<button id="devAssetMakeObject" class="devWideButton primary">Create Placeable Object</button>'):'',makeTerrain=(asset.type==='terrainTexture'||asset.type==='worldImage')?(terrainRecordId?'<button id="devAssetOpenTerrainRecord" class="devWideButton primary">Open Paintable Terrain</button>':'<button id="devAssetMakeTerrain" class="devWideButton primary">Create Paintable Terrain</button>'):'',openTerrain=asset.type==='treeSprite'?'<button id="devAssetOpenTerrain" class="devWideButton">Open Terrain Library</button>':'';
  inspector.innerHTML=`<div class="devAssetPreview"><img src="./${devContentEscape(asset.path)}" alt="${devContentEscape(asset.name||'')}"></div><div class="devSelectedTitle">${devContentEscape(asset.name||devAssetSelectedId)}</div><div class="devAssetMeta">${devContentEscape(developerAssetTypeLabel(asset.type))} • ${dims} • ${size}</div>${developerAssetValidationHtml(asset)}${developerSpriteDirectionMappingHtml(asset)}${developerCharacterRigAlignmentHtml?.(asset,devAssetSelectedId)||''}${developerAssetMasterControlsHtml?.(asset,devAssetSelectedId)||''}${developerReferenceComparisonHtml?.(asset,devAssetSelectedId)||''}<label>Project Path<input value="${devContentEscape(asset.path)}" readonly></label>${targets.length?`<div class="devPair"><label>Assign To<select id="devAssetAssignTarget"><option value="">Choose target…</option>${targets.map(([id,name])=>`<option value="${devContentEscape(id)}">${devContentEscape(name)} (${devContentEscape(id)})</option>`).join('')}</select></label><label>Usage<input value="${asset.type==='mobSprite'?'4×4 • normalized world height':asset.type==='npcSprite'?'NPC model':'Inventory icon'}" readonly></label></div><button id="devAssetAssign" class="devWideButton">Assign Asset</button>`:''}${makePlayer}${makeNpc}${makeTerrain}${makeObject}${openTerrain}<div class="devRow"><button id="devAssetCopy">Copy Path</button><button id="devAssetRemove" class="danger">Remove Record</button></div>`;
  bindDeveloperAssetMasterControls?.(inspector,asset,devAssetSelectedId);bindDeveloperSpriteDirectionMapping(inspector,asset);bindDeveloperCharacterRigAlignment?.(inspector,asset,devAssetSelectedId);inspector.querySelector('#devAssetDefaultPlayer')?.addEventListener('click',()=>{devCharacterDefaults.defaultAppearanceAsset=devAssetSelectedId;window.LR_CHARACTER_DEFAULTS=devCharacterDefaults;saveDeveloperDraft();refreshDeveloperAssetPanel();devSetStatus(`${asset.name||devAssetSelectedId} is now the default character-select choice`);});inspector.querySelector('#devAssetCopy').onclick=copyDeveloperAssetPath;inspector.querySelector('#devAssetPlaceNpc')?.addEventListener('click',()=>{devPlaceNpcAsset=devAssetSelectedId;devPlaceType=null;devPlaceMobType=null;setDeveloperTab('npcs');refreshDeveloperPanel();devSetStatus(`Placing ${asset.name||devAssetSelectedId} NPC — click the world${devRepeatPlacement?' repeatedly':' once'}`);});inspector.querySelector('#devAssetMakeObject')?.addEventListener('click',()=>createDeveloperObjectDefinitionFromAsset(asset,devAssetSelectedId));inspector.querySelector('#devAssetOpenObject')?.addEventListener('click',()=>{setDeveloperTab('objects');const search=devPanel.querySelector('#devObjectSearch');if(search)search.value=asset.name||'';refreshDeveloperObjectPalette();devSetStatus(`Showing ${asset.name||devAssetSelectedId} in Object Library`);});inspector.querySelector('#devAssetMakeTerrain')?.addEventListener('click',()=>createDeveloperTerrainFromAsset(asset,devAssetSelectedId));inspector.querySelector('#devAssetOpenTerrainRecord')?.addEventListener('click',()=>{if(terrainRecordId){devTerrainSelectedId=terrainRecordId;devTerrainBrush=terrainRecordId;}setDeveloperTab('terrain');refreshDeveloperTerrainPanel();});inspector.querySelector('#devAssetOpenTerrain')?.addEventListener('click',()=>{setDeveloperTab('terrain');devSetStatus(`Choose a terrain and assign ${asset.name||devAssetSelectedId} as its tree sprite`);});inspector.querySelector('#devAssetRemove')?.addEventListener('click',removeDeveloperAssetRecord);inspector.querySelector('#devAssetAssign')?.addEventListener('click',()=>assignDeveloperAsset(asset,inspector.querySelector('#devAssetAssignTarget').value));
}

