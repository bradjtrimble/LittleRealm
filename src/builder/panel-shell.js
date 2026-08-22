function refreshDeveloperProjectPanel(){
  if(!devPanel)return;
  const el=devPanel.querySelector("#devProjectSummary");
  if(el){
    const connection=devProjectDirectoryHandle?`folder connected • ${devProjectZone?.name||devProjectZone?.id||"zone"}`:`local project loaded • folder not connected`;
    const dirty=developerProjectDirtyDetails?.();
    el.textContent=`${sceneryProps.length} props • ${sceneryNPCs.length} placed NPCs • ${devMobSpawns.length} mob spawns • ${questDefinitions.length} quests • ${Object.keys(ITEM_DEFS).length} items • ${Object.keys(BALANCE.mobs||{}).length} mob types • ${Object.keys(devAssets).length} assets • ${connection}${dirty?.dirty?" • UNSAVED CHANGES":""}`;
  }
  refreshDeveloperProjectHealthPanel?.();
}

function buildDeveloperPanel(){
  ensureDeveloperStyles();
  const root=document.createElement("aside");
  root.id="devPanel";
  root.innerHTML=`
    <div class="devHeader"><div><b>WORLD BUILDER</b><span>F2 to close • Esc returns to Select • one-shot placement by default</span></div><button id="devClose">×</button></div>
    <div class="devToolbar">
      <button id="devSelect" class="active">Select / Move</button>
      <label>Snap <select id="devSnap"><option>4</option><option selected>8</option><option>16</option><option>32</option><option>64</option></select></label>
      <label><input id="devGrid" type="checkbox" checked> Grid</label>
      <label><input id="devHitboxes" type="checkbox" checked> Hitboxes</label>
      <label><input id="devDepthLines" type="checkbox" checked> Depth Lines</label>
    </div>
    <div class="devTabs">
      <button class="devTab active" data-dev-tab="objects">Objects</button>
      <button class="devTab" data-dev-tab="terrain">Terrain</button>
      <button class="devTab" data-dev-tab="npcs">NPCs</button>
      <button class="devTab" data-dev-tab="spawns">Spawns</button>
      <button class="devTab" data-dev-tab="quests">Quests</button>
      <button class="devTab" data-dev-tab="content">Content</button>
      <button class="devTab" data-dev-tab="assets">Assets</button>
      <button class="devTab" data-dev-tab="audio">Audio</button>
      <button class="devTab" data-dev-tab="zones">Zones</button>
      <button class="devTab" data-dev-tab="selection">Inspector</button>
      <button class="devTab" data-dev-tab="scale">Visual Scale</button>
      <button class="devTab" data-dev-tab="combat">Combat Test</button>
      <button class="devTab" data-dev-tab="project">Project</button>
    </div>
    <div class="devContextBar">
      <div id="devToolMode" class="devToolMode select">SELECT / MOVE • Esc returns here</div>
      <label class="devRepeatPlacement" title="Keep the chosen object/NPC/spawn tool active after each placement"><input id="devRepeatPlacement" type="checkbox"><span>Repeat placement</span></label>
      <button id="devFinishTool">Select Active</button>
    </div>
    <div class="devCameraBar">
      <div class="devCameraModes"><button data-dev-camera-mode="player" class="active">Player Camera</button><button data-dev-camera-mode="free">Free Camera</button><button data-dev-camera-mode="world">World View</button></div>
      <div id="devCameraReadout" class="devCameraReadout">PLAYER CAMERA • 185%</div>
      <div class="devCameraActions"><button id="devCameraZoomOut" title="Zoom out in Free Camera">−</button><button id="devCameraZoomIn" title="Zoom in in Free Camera">+</button><button id="devCameraCenterPlayer">Center Player</button><button id="devCameraCenterSelection">Center Selection</button><button id="devMovePlayerToCamera" class="primary">Move Player Here</button></div>
    </div>
    <div id="devSectionNav" class="devSectionNav"></div>
    <div class="devBody">
      <section class="devView active" data-dev-view="objects">
        <div class="devMasterDetail">
          <div class="devMasterPane"><div class="devSection"><div class="devSectionTitle">Object Library <span id="devObjectLibraryCount" class="devTitleCount"></span></div><input id="devObjectSearch" class="devSearchInput" placeholder="Search objects…"><div class="devHint">Choose an object and click the world. All placeable objects use this same library.</div><div id="devObjectPalette"></div></div></div>
          <div class="devDetailPane"><div class="devSection"><div class="devSectionTitle">Existing Objects <span id="devObjectCount" class="devTitleCount"></span></div><input id="devPlacedObjectSearch" class="devSearchInput" placeholder="Search placed objects…"><div id="devObjectList"></div></div></div>
        </div>
      </section>
      <section class="devView" data-dev-view="terrain">
        <div class="devMasterDetail terrainLayout">
          <div class="devMasterPane">
            <div class="devSection"><div class="devSectionTitle">Terrain Painter</div><div id="devTerrainSummary" class="devHint"></div><input id="devTerrainSearch" class="devSearchInput" placeholder="Search terrain…"><div id="devTerrainPalette"></div><div class="devPair" style="margin-top:9px"><label>Brush Size<select id="devTerrainBrushSize"><option value="1">1 × 1 tile</option><option value="3">3 × 3 tiles</option><option value="5">5 × 5 tiles</option><option value="7">7 × 7 tiles</option><option value="9">9 × 9 tiles</option><option value="15">15 × 15 tiles</option><option value="25">25 × 25 tiles</option></select></label><label>Paint Mode<input value="Click + drag" readonly></label></div></div>
            <div class="devSection" data-default-collapsed="true"><div class="devSectionTitle">Terrain Library</div><button id="devTerrainNew" class="devWideButton primary">New Terrain</button><div class="devPair" style="margin-top:10px"><label>New Zone Ground<select id="devTerrainDefaultGround"></select></label><label>New Zone Boundary<select id="devTerrainDefaultBoundary"></select></label></div></div>
          </div>
          <div class="devDetailPane">
            <div class="devSection"><div class="devSectionTitle">Selected Terrain</div><div id="devTerrainInspector"></div></div>
            <div class="devSection" data-default-collapsed="true"><div class="devSectionTitle">World Beyond Zone</div><label>Terrain Beyond Map<select id="devTerrainBackdrop"></select></label><div id="devTerrainBackdropNote" class="devHint"></div><button id="devTerrainMatchEdge" class="devWideButton">Match Outer 2-Tile Edge To This Terrain</button></div>
            <div class="devSection" data-default-collapsed="true"><div class="devSectionTitle">Terrain Actions</div><div class="devProjectBig"><button id="devTerrainFillInterior">Fill Interior With Selected</button><button id="devTerrainFillAll">Fill Entire Zone With Selected</button><button id="devTerrainResetBlank" class="danger">Reset to Blank Terrain</button></div></div>
          </div>
        </div>
      </section>
      <section class="devView" data-dev-view="npcs">
        <div class="devSection"><div class="devSectionTitle">NPC Sprite Palette</div><input id="devNpcSearch" class="devSearchInput" placeholder="Search NPC sprites…"><div class="devHint">Every registered <b>NPC Sprite</b> asset appears here. Choose one, then click the world to create a new independent NPC using that artwork. No template is required.</div><div id="devNpcAssetPalette" class="devNpcPalette"></div></div>
        <div class="devSection"><div class="devSectionTitle">Existing NPCs <span id="devNpcCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><div id="devNpcList"></div></div>
        <div class="devSection"><div class="devSectionTitle">NPC Inspector</div><div id="devNpcInspector"></div></div>
      </section>
      <section class="devView" data-dev-view="spawns">
        <div class="devSection"><div class="devSectionTitle">Mob Spawn Palette</div><input id="devSpawnSearch" class="devSearchInput" placeholder="Search mob types…"><div class="devHint">Choose any Mob Type from the shared Content Library, then click a walkable point in the world. The spawn becomes part of this zone.</div><div id="devSpawnPalette"></div></div>
        <div class="devSection"><div class="devSectionTitle">Zone Spawns <span id="devSpawnCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><div class="devHint">Open this tab to show spawn-home rings in the world. Click or drag a ring/mob to reposition its home point.</div><div id="devSpawnList"></div></div>
        <div class="devSection"><div class="devSectionTitle">Spawn Inspector</div><div id="devSpawnInspector"></div></div>
      </section>
      <section class="devView" data-dev-view="quests">
        <div class="devSection"><div class="devSectionTitle">Quest Library <span id="devQuestCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><input id="devQuestSearch" class="devSearchInput" placeholder="Search quests…"><div class="devHint">Create quests from dropdowns instead of code. Objectives can kill, collect, talk, deliver, or visit a world position.</div><div id="devQuestList"></div><div class="devQuestListActions"><button id="devNewQuest">New Quest</button><button id="devDuplicateQuest">Duplicate</button><button id="devDeleteQuest">Delete</button></div></div>
        <div class="devSection"><div class="devSectionTitle">Quest Maker</div><div id="devQuestEditor"></div></div>
      </section>
      <section class="devView" data-dev-view="content">
        <div class="devSection"><div class="devSectionTitle">Content Library</div><div id="devContentSummary" class="devHint"></div><div class="devContentTypes"><button data-content-type="mobs">Mob Types</button><button data-content-type="items">Items</button><button data-content-type="lootTables">Loot Tables</button></div><div class="devHint" style="margin-top:9px">Shared gameplay definitions live in <b>content/shared/content-library.json</b>. NPCs are independent zone records that choose their artwork directly from NPC Sprite assets.</div></div>
        <div class="devSection"><div class="devSectionTitle">Library Entries</div><input id="devContentSearch" class="devSearchInput" placeholder="Search content…"><div id="devContentList"></div><div class="devContentActions"><button id="devContentNew" class="primary">New Entry</button></div></div>
        <div class="devSection"><div class="devSectionTitle">Content Inspector</div><div id="devContentEditor"></div></div>
      </section>
      <section class="devView" data-dev-view="assets">
        <div class="devSection devImportSection"><div class="devSectionTitle">Import Assets</div><div id="devAssetSummary" class="devHint"></div><div class="devImportBar"><label>What are you adding?<select id="devAssetImportType"><option value="terrain">Paintable Terrain</option><option value="object">Placeable Object / Building</option><option value="mobSprite">Mob Sprite</option><option value="npcSprite">NPC Sprite</option><option value="playerAppearance">Playable Character</option><option value="itemIcon">Item Icon</option><option value="treeSprite">Terrain Tree Sprite</option><option value="assetOnly">Asset Only / Other Image</option></select></label><button id="devAssetImport" class="primary">Choose Images…</button></div><input id="devAssetImportFile" type="file" multiple accept="image/png,image/webp,image/jpeg,.png,.webp,.jpg,.jpeg" hidden><div class="devHint">Select one image or many. Terrain imports become paintable terrains automatically; Object imports become placeable Object Library entries automatically.</div><div id="devAssetImportResult"></div></div>
        <div class="devMasterDetail assetsLayout">
          <div class="devMasterPane"><div class="devSection"><div class="devSectionTitle">Asset Library</div><div class="devPair"><input id="devAssetSearch" class="devSearchInput" placeholder="Search assets…"><select id="devAssetFilter"><option value="all">All Images</option><option value="mobSprite">Mob Sprites</option><option value="npcSprite">NPC Sprites</option><option value="playerAppearance">Playable Characters</option><option value="itemIcon">Item Icons</option><option value="worldImage">World Images</option><option value="terrainTexture">Terrain Textures</option><option value="treeSprite">Terrain Tree Sprites</option></select></div><div id="devAssetList"></div></div></div>
          <div class="devDetailPane"><div class="devSection"><div class="devSectionTitle">Asset Inspector</div><div id="devAssetInspector"></div></div></div>
        </div>
        <div class="devSection" data-default-collapsed="true"><div class="devSectionTitle">Little Realm Art Prompt Builder</div><div id="devArtPromptBuilder"></div></div>
        <div class="devSection" data-default-collapsed="true"><div class="devSectionTitle">Canonical Art Reference Library</div><div id="devArtReferenceLibrary"></div></div>
      </section>
      ${developerAudioPanelHtml()}
      <section class="devView" data-dev-view="zones">
        <div class="devSection"><div class="devSectionTitle">Project / Zone Manager</div><div id="devZoneSummary" class="devHint"></div><div class="devProjectNote" style="margin-top:9px">Zones are independent maps under <b>content/zones/</b>. The production game opens the zone marked <b>Default</b>. Connect the project folder before creating, switching, or deleting zones so the Builder can save files directly.</div></div>
        <div class="devSection"><div class="devSectionTitle">Zones</div><div id="devZoneList"></div></div>
        <div class="devSection"><div class="devSectionTitle">Zone Inspector</div><div id="devZoneInspector"></div></div>
        <div class="devSection" id="devZoneCreate"><div class="devSectionTitle">New Zone</div><div class="devHint">Blank creates an empty map from the project terrain library. Copy Active duplicates the current zone content as a starting point.</div><div class="devPair"><label>Name<input id="devNewZoneName" value="New Zone"></label><label>ID<input id="devNewZoneId" placeholder="auto-from-name"></label></div><div class="devPair"><label>Width (tiles)<input id="devNewZoneWidth" type="number" min="12" max="128" value="44"></label><label>Height (tiles)<input id="devNewZoneHeight" type="number" min="12" max="96" value="32"></label></div><div class="devPair"><label>Start Tile X<input id="devNewZoneStartX" type="number" min="2" value="7"></label><label>Start Tile Y<input id="devNewZoneStartY" type="number" min="2" value="7"></label></div><div class="devPair"><label>Template<select id="devNewZoneTemplate"><option value="blank">Blank Zone</option><option value="copy">Copy Active Zone</option></select></label><label>World Beyond Terrain<select id="devNewZoneBackdrop"></select></label></div><button id="devCreateZone" class="devWideButton primary">Create & Open Zone</button></div>
      </section>
      <section class="devView" data-dev-view="selection">
        <div class="devSection"><div class="devSectionTitle">Selection Library <span id="devSelectionCount" style="float:right;font-weight:600;text-transform:none;letter-spacing:0;color:#a99bb3"></span></div><div class="devHint">Props, NPCs, and loot-remnant previews live together here for visual placement work. Select Dust or Lootable Dust to tune the global remnant scale and depth.</div><div id="devSelectionList"></div></div>
        <div class="devSection"><div class="devSectionTitle">Selected Item</div><div class="devHint">Click a prop or NPC in the world, or choose one above. Drag it directly in the world to reposition it.</div><div id="devInspector"></div></div>
        <div class="devSection"><div class="devSectionTitle">Layout Recovery</div><div class="devProjectActions"><button id="devLoadDraft">Load Local Draft</button><button id="devReset">Use Project Layout</button></div></div>
      </section>
      <section class="devView" data-dev-view="scale">
        <div class="devSection"><div class="devSectionTitle">Selected Mob Type</div><div class="devHint">Click a mob in the world. This slider changes only that Mob Type record.</div><div id="devMobScalePanel"></div></div>
        <div class="devSection"><div class="devSectionTitle">World Visual Scale</div><div class="devHint">These controls change broad world elements. Mob species are controlled separately above.</div><div id="devScalePanel">
          <div class="devScaleControl"><div class="devScaleTop"><span>Player</span><span data-scale-value="player"></span></div><input data-scale-key="player" type="range" min="0.25" max="3.00" step="0.05" value="${VISUAL_SCALE.player}"></div>
          <div class="devScaleControl"><div class="devScaleTop"><span>NPCs</span><span data-scale-value="npcs"></span></div><input data-scale-key="npcs" type="range" min="0.25" max="3.00" step="0.05" value="${VISUAL_SCALE.npcs}"></div>
          <div class="devScaleControl"><div class="devScaleTop"><span>Props</span><span data-scale-value="props"></span></div><input data-scale-key="props" type="range" min="0.25" max="3.00" step="0.05" value="${VISUAL_SCALE.props}"></div>
        </div><div class="devRow"><button id="devResetScale">Reset Scale Settings</button></div></div>
      </section>
      <section class="devView" data-dev-view="combat">
        <div class="devSection"><div class="devSectionTitle">Player Test Level</div><div id="devPlayerTestPanel"></div></div>
        <div class="devSection"><div class="devSectionTitle">Mob Species Tuning</div><div class="devHint">Change a species' level range and base combat values, apply them live, then reroll its current spawns if you want new levels/elites immediately.</div><div id="devCombatSpecies"></div></div>
        <div class="devSection"><div class="devSectionTitle">Global Mob-Level Rules</div><div class="devHint">These values control level growth, danger boosts, elites, bosses, aggro, hit chance, and XP across the whole game.</div><div id="devCombatGlobals"></div></div>
      </section>
      <section class="devView" data-dev-view="project">
        <div class="devSection"><div class="devSectionTitle">Project Health & Safety</div><div class="devProjectNote">World Builder now versions its project files, checks cross-content references before publishing, and keeps lightweight JSON recovery snapshots outside the production game build.</div><div id="devProjectHealth"></div></div>
        <div class="devSection"><div class="devSectionTitle">Local Project Folder</div><div class="devProjectNote">Recommended local workflow: choose the <b>LittleRealm-main</b> project folder once. Save Project Folder writes the active zone (including mob spawns) to <b>content/zones/</b> and shared mob/item/loot/asset definitions to <b>content/shared/</b> with no download/upload step. Chrome or Edge supports direct folder access.</div><div id="devProjectSummary" class="devHint" style="margin-top:9px"></div><div class="devProjectBig"><button id="devOpenProjectFolder" class="primary">Open Little Realm Project Folder</button><button id="devSaveProjectFolder">Save Project Folder</button><button id="devSaveDraftNow">Save Browser Draft</button><button id="devLoadDraftProject">Load Browser Draft</button><button id="devResetProject" class="danger">Use Project Baseline</button></div></div>
        <div class="devSection"><div class="devSectionTitle">Project Backup / Transfer</div><div class="devHint">This portable backup includes both the active zone and the shared Content Library.</div><div class="devProjectBig"><button id="devExportWorldPack" class="primary">Export World Pack (.json)</button><button id="devImportWorldPack">Import World Pack</button></div><input id="devImportWorldPackFile" type="file" accept="application/json,.json" hidden></div>
      </section>
    </div>
    <div id="devStatus">F2 toggles World Builder</div>`;
  document.body.appendChild(root);
  devPanel=root;
  developerInitWorkflowUi(root);
  developerInitSettingHelp?.(root);
  root.querySelector("#devClose").onclick=()=>setDeveloperMode(false);
  root.querySelector("#devSelect").onclick=()=>developerFinishPlacement();
  root.querySelector("#devFinishTool").onclick=()=>developerFinishPlacement();
  root.querySelector("#devRepeatPlacement").onchange=e=>{devRepeatPlacement=!!e.target.checked;refreshDeveloperToolStrip();devSetStatus(devRepeatPlacement?"Repeat placement enabled — chosen placement tools stay active":"One-shot placement enabled — returns to Select after placing");};
  root.querySelector("#devSnap").onchange=e=>{devSnap=Number(e.target.value)||8;};
  root.querySelector("#devGrid").onchange=e=>{devShowGrid=e.target.checked;};
  root.querySelector("#devHitboxes").onchange=e=>{devShowHitboxes=e.target.checked;};
  root.querySelector("#devDepthLines").onchange=e=>{devShowDepthLines=e.target.checked;};
  developerBindCameraControls(root);
  root.querySelector("#devLoadDraft").onclick=loadDeveloperDraft;
  root.querySelector("#devReset").onclick=resetDeveloperLayout;
  root.querySelector("#devNewQuest").onclick=createDeveloperQuest;
  root.querySelector("#devDuplicateQuest").onclick=duplicateDeveloperQuest;
  root.querySelector("#devDeleteQuest").onclick=deleteDeveloperQuest;
  root.querySelector("#devOpenProjectFolder").onclick=openDeveloperProjectFolder;
  root.querySelector("#devSaveProjectFolder").onclick=saveDeveloperProjectFolder;
  root.querySelector("#devCreateZone").onclick=createDeveloperZone;
  root.querySelector("#devExportWorldPack").onclick=exportDeveloperWorldPack;
  root.querySelector("#devImportWorldPack").onclick=()=>root.querySelector("#devImportWorldPackFile").click();
  root.querySelector("#devImportWorldPackFile").onchange=e=>{importDeveloperWorldPackFile(e.target.files?.[0]);e.target.value="";};
  root.querySelector("#devSaveDraftNow").onclick=saveDeveloperDraft;
  root.querySelector("#devLoadDraftProject").onclick=loadDeveloperDraft;
  root.querySelector("#devResetProject").onclick=resetDeveloperProject;
  root.querySelector("#devContentNew").onclick=devContentCreate;
  root.querySelectorAll("[data-content-type]").forEach(button=>button.onclick=()=>devContentSetType(button.dataset.contentType));
  root.querySelector("#devAssetImport").onclick=()=>root.querySelector("#devAssetImportFile").click();
  root.querySelector("#devAssetImportFile").onchange=e=>{importDeveloperAssetFiles(Array.from(e.target.files||[]));e.target.value="";};
  root.querySelector("#devAssetFilter").onchange=refreshDeveloperAssetPanel;
  root.querySelector("#devAudioImport").onclick=()=>root.querySelector("#devAudioImportFile").click();
  root.querySelector("#devAudioImportFile").onchange=e=>{developerImportAudioFiles(Array.from(e.target.files||[]));e.target.value="";};
  root.querySelector("#devAudioFilter").onchange=refreshDeveloperAudioPanel;
  root.querySelector("#devAudioNewSet").onclick=developerCreateAudioSet;
  developerBindSearchInput("#devAssetSearch",refreshDeveloperAssetPanel);
  developerBindSearchInput("#devAudioSearch",refreshDeveloperAudioPanel);
  developerBindSearchInput("#devObjectSearch",refreshDeveloperObjectPalette);
  developerBindSearchInput("#devPlacedObjectSearch",refreshDeveloperObjectList);
  developerBindSearchInput("#devTerrainSearch",refreshDeveloperTerrainPanel);
  developerBindSearchInput("#devNpcSearch",refreshDeveloperNpcAssetPalette);
  developerBindSearchInput("#devSpawnSearch",refreshDeveloperSpawnPanel);
  developerBindSearchInput("#devContentSearch",refreshDeveloperContentPanel);
  developerBindSearchInput("#devQuestSearch",refreshDeveloperQuestPanel);
  root.querySelectorAll(".devTab").forEach(b=>b.onclick=()=>setDeveloperTab(b.dataset.devTab));
  root.querySelectorAll("[data-scale-key]").forEach(input=>{
    updateVisualScaleControl(input.dataset.scaleKey,input.value);
    input.oninput=()=>updateVisualScaleControl(input.dataset.scaleKey,input.value);
  });
  root.querySelector("#devResetScale").onclick=resetVisualScale;
  setDeveloperTab(devActiveTab);
  refreshDeveloperPanel();
  devSetStatus(`${Object.keys(devObjectDefinitions).length} objects • ${sceneryNPCs.length} NPCs • ${devMobSpawns.length} mob spawns • ${Object.keys(devTerrains).length} terrains • ${Object.keys(devAssets).length} assets • Project save ready`);
  return root;
}
function updateDevPaletteActive(){
  if(!devPanel)return;
  devPanel.querySelectorAll("[data-object-definition]").forEach(card=>card.classList.toggle("active",devPlaceType===developerObjectPlaceType(card.dataset.objectDefinition)));
  devPanel.querySelectorAll("[data-npc-asset]").forEach(b=>b.classList.toggle("active",b.dataset.npcAsset===devPlaceNpcAsset));
  devPanel.querySelectorAll("[data-spawn-type]").forEach(b=>b.classList.toggle("active",b.dataset.spawnType===devPlaceMobType));
  devPanel.querySelector("#devSelect")?.classList.toggle("active",devActiveTab!=="terrain"&&!devPlaceType&&!devPlaceNpcAsset&&!devPlaceMobType&&!devSizeEditing&&!devHitboxEditing&&!devDepthEditing&&!devInteractionEditing);
  refreshDeveloperToolStrip();
}

function setDeveloperMode(active){
  devModeActive=!!active;
  if(!devPanel) buildDeveloperPanel();
  devPanel.classList.toggle("show",devModeActive);
  document.body.classList.toggle("devMode",devModeActive);
  input={up:false,down:false,left:false,right:false};
  isHeroMoving=false;
  if(!devModeActive){
    developerAudioStopPreview?.();
    developerPersistCameraForZone();developerClearCameraKeys();devCameraPanDrag=null;
    devDragging=false;devNpcDragging=false;
    devPlaceType=null;devPlaceNpcAsset=null;devPlaceMobType=null;devSpawnDragging=false;devTerrainPainting=false;devTerrainHoverTile=null;
    devSizeEditing=false;
    devSizeDrag=null;
    devHitboxEditing=false;
    devHitboxDrag=null;
    devDepthEditing=false;
    devDepthDrag=null;
    devInteractionEditing=false;
    devInteractionDrag=null;
    if(game?.style) game.style.cursor="";
  }
  updateDevPaletteActive();
  if(devModeActive){
    developerRestoreCameraForZone();
    // Rebuild the live panels now that normal game state is guaranteed to exist.
    refreshDeveloperPanel();
    devSetStatus("World Builder active — zone spawns, assets, and shared Content Library are ready");
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
  game.addEventListener("wheel",developerHandleCameraWheel,{capture:true,passive:false});
  window.addEventListener("pointermove",devPointerMove,true);
  window.addEventListener("pointerup",devPointerUp,true);
  window.addEventListener("keydown",event=>{
    if(event.code==="F2"){
      event.preventDefault();toggleDeveloperMode();return;
    }
    if(!devModeActive)return;
    if(developerHandleCameraKeyDown(event))return;
    if(event.code==="Escape"){
      if(devInteractionEditing){setDeveloperInteractionEditing(false);}
      else if(devSizeEditing){setDeveloperSizeEditing(false);}
      else if(devHitboxEditing){setDeveloperHitboxEditing(false);}
      else if(devDepthEditing){setDeveloperDepthEditing(false);}
      else if(devPlaceType||devPlaceNpcAsset||devPlaceMobType||devActiveTab==="terrain"){developerFinishPlacement();}
      else if(devSelectedNpc){devSelectedNpc=null;refreshDeveloperPanel();}
      else if(devSelected){devSelected=null;refreshDeveloperPanel();}
      return;
    }
    if((event.code==="Delete"||event.code==="Backspace") && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)){
      if(devActiveTab==="spawns"&&devSelectedSpawnId){event.preventDefault();deleteDeveloperSpawn();}
      else if(devSelectedNpc){event.preventDefault();deleteDeveloperNpc();}
      else if(devSelected){event.preventDefault();deleteDeveloperSelection();}
    }
  },true);
  window.addEventListener("keyup",event=>{developerHandleCameraKeyUp(event);},true);
  window.addEventListener("blur",developerClearCameraKeys);
}
