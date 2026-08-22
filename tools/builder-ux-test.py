from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
state=(ROOT/'src/builder/state.js').read_text()
shell=(ROOT/'src/builder/panel-shell.js').read_text()
world=(ROOT/'src/builder/world-editor.js').read_text()
npc=(ROOT/'src/builder/npc-placement.js').read_text()
spawn=(ROOT/'src/builder/spawn-editor.js').read_text()
styles=(ROOT/'src/builder/styles.js').read_text()
workflow=(ROOT/'src/builder/workflow-ui.js').read_text()
assets=(ROOT/'src/builder/asset-importer.js').read_text()+(ROOT/'src/builder/asset-manager.js').read_text()
health=(ROOT/'src/builder/project-health.js').read_text()
checks={
    'repeat placement defaults off':'let devRepeatPlacement=false' in state,
    'tab scroll memory exists':'devTabScrollPositions' in state and 'devTabScrollPositions[previous]' in world,
    'tool mode strip exists':'id="devToolMode"' in shell and 'function refreshDeveloperToolStrip' in world,
    'section jump bar exists':'id="devSectionNav"' in shell and 'function refreshDeveloperSectionNav' in world,
    'finish/select control exists':'id="devFinishTool"' in shell and 'developerFinishPlacement' in world,
    'repeat placement control exists':'id="devRepeatPlacement"' in shell,
    'object placement one shot':'if(devRepeatPlacement){setDeveloperTab("objects");}else{devPlaceType=null;setDeveloperTab("selection");}' in npc,
    'npc placement one shot':'if(!devRepeatPlacement)devPlaceNpcAsset=null;' in npc,
    'spawn placement one shot':'if(!devRepeatPlacement)devPlaceMobType=null;' in spawn,
    'leaving placement tab disarms object':'if(devPlaceType&&devActiveTab!=="objects")devPlaceType=null;' in world,
    'leaving placement tab disarms npc':'if(devPlaceNpcAsset&&devActiveTab!=="npcs")devPlaceNpcAsset=null;' in world,
    'leaving placement tab disarms spawn':'if(devPlaceMobType&&devActiveTab!=="spawns")devPlaceMobType=null;' in world,
    'inspector naming':'data-dev-tab="selection">Inspector<' in shell,
    'responsive wider workspace':'width:min(880px,68vw)' in styles,
    'collapsible sections':'developerInitCollapsibleSections' in workflow and 'data-default-collapsed="true"' in shell,
    'resizable builder':'developerInitPanelResize' in workflow and 'devResizeHandle' in workflow,
    'master detail layouts':'devMasterDetail' in shell and 'assetsLayout' in shell and 'terrainLayout' in shell,
    'batch image import':'multiple accept=' in shell and 'importDeveloperAssetFiles' in assets,
    'purpose-driven import':'value="terrain">Paintable Terrain' in shell and 'value="object">Placeable Object / Building' in shell,
    'searchable libraries':'devAssetSearch' in shell and 'devTerrainSearch' in shell and 'devObjectSearch' in shell,
    'art approval bookkeeping removed':'qaStatus' not in assets and 'developerAssetQaStatus' not in health,
    'informational advisories':'"advisory"' in health,
}
failed=[name for name,ok in checks.items() if not ok]
for name,ok in checks.items(): print(('PASS' if ok else 'FAIL'),name)
if failed: raise SystemExit('Builder UX checks failed: '+', '.join(failed))
print('PASS Builder workflow optimization (batch import, collapsible sections, master/detail layouts, search, resize, no approval gate)')
