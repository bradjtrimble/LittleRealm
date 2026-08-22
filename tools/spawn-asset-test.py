#!/usr/bin/env python3
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
errors=[]
manifest=json.loads((ROOT/'content/little-realm.project.json').read_text())
zone=next((z for z in manifest.get('zones',[]) if z.get('id')==manifest.get('defaultZone')),manifest.get('zones',[{}])[0])
pack=json.loads((ROOT/zone['pack']).read_text())
spawns=pack.get('mobSpawns')
if not isinstance(spawns,list): errors.append('zone pack missing mobSpawns array')
else:
    if len(spawns)<27: errors.append(f'starter zone spawn data lost entries: {len(spawns)}')
    for i,s in enumerate(spawns):
        if not all(k in s for k in ('id','mobType','x','y')): errors.append(f'invalid spawn record at {i}')
        if s.get('mobType') not in json.loads((ROOT/manifest['sharedContent']).read_text()).get('mobs',{}): errors.append(f"spawn references missing mob type: {s.get('mobType')}")
shared=json.loads((ROOT/manifest['sharedContent']).read_text())
assets=shared.get('assets')
if not isinstance(assets,dict) or not assets: errors.append('shared asset registry missing/empty')
for key in ['mobsprite-slime','npcsprite-lilly','items-slime-gel']:
    if key not in assets: errors.append(f'missing seeded asset: {key}')
for loader in ['js/runtime-loader.js','builder/runtime-loader.js']:
    text=(ROOT/loader).read_text()
    if 'LR_MOB_SPAWNS' not in text: errors.append(f'{loader} does not load zone spawns')
    if 'LR_ASSETS' not in text: errors.append(f'{loader} does not load asset registry')
mobs=(ROOT/'src/mobs.js').read_text()
for token in ['window.LR_MOB_SPAWNS','spawnId','spawnType']:
    if token not in mobs: errors.append(f'runtime mob spawning missing {token}')
spawn_editor=(ROOT/'src/builder/spawn-editor.js').read_text()
for token in ['placeDeveloperMobSpawn','syncDeveloperSpawnRuntime','refreshDeveloperSpawnPanel','finishDeveloperSpawnDrag']:
    if token not in spawn_editor: errors.append(f'Spawn Editor missing {token}')
asset_manager=(ROOT/'src/builder/asset-importer.js').read_text()+(ROOT/'src/builder/asset-manager.js').read_text()
for token in ['importDeveloperAssetFile','developerNestedFileHandle','assignDeveloperAsset','refreshDeveloperAssetPanel']:
    if token not in asset_manager: errors.append(f'Asset Importer missing {token}')
panel=(ROOT/'src/builder/panel-shell.js').read_text()
for token in ['data-dev-tab="spawns"','data-dev-tab="assets"','devAssetImportFile','devSpawnPalette']:
    if token not in panel: errors.append(f'Builder UI missing {token}')
project=(ROOT/'src/builder/project-manager.js').read_text()
if 'mobSpawns:devContentClone(devMobSpawns)' not in project: errors.append('World Pack save does not include mob spawns')
if not any(token in (ROOT/'src/builder/content-library.js').read_text() for token in ['assets:devContentClone(devAssets)','assets:developerCleanAssetRecords(devAssets)']): errors.append('Content Library save does not include assets')
if errors:
    print('Spawn + Asset workflow check failed:')
    for e in errors: print('  - '+e)
    raise SystemExit(1)
print(f'PASS zone Spawn Editor + Asset Importer ({len(spawns)} starter spawns, {len(assets)} registered assets)')
