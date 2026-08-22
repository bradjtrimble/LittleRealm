#!/usr/bin/env python3
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
errors=[]
manifest=json.loads((ROOT/'content/little-realm.project.json').read_text())
shared_path=manifest.get('sharedContent')
if not shared_path: errors.append('manifest missing sharedContent path')
else:
    path=ROOT/shared_path
    if not path.exists(): errors.append(f'missing {shared_path}')
    else:
        data=json.loads(path.read_text())
        if data.get('format')!='little-realm-content-library' or data.get('schemaVersion')!=12: errors.append('shared content must be normalized schema v12')
        for key in ['mobs','items','lootTables','assets','objectDefinitions','terrains','terrainDefaults']:
            if not isinstance(data.get(key),dict): errors.append(f'shared content missing object: {key}')
        if 'biomeThemes' in data: errors.append('biomeThemes should not exist after terrain normalization')
        if 'slimeGel' not in data.get('items',{}): errors.append('Slime Gel missing from Content Library')
        for mob in ['slime','goblin','wolf','cow','pig','chicken','snickers']:
            rec=data.get('mobs',{}).get(mob)
            if not rec: errors.append(f'mob definition missing: {mob}'); continue
            if 'renderPreset' in rec: errors.append(f'{mob} still has legacy renderPreset')
            if not rec.get('spriteAsset'): errors.append(f'{mob} missing ordinary spriteAsset')
        for terrain_id in ['grass','water','forest','road','safe-grass','blocked-forest','dirt','sand','rock']:
            if terrain_id not in data.get('terrains',{}): errors.append(f'terrain definition missing: {terrain_id}')
        defaults=data.get('terrainDefaults',{})
        if defaults.get('ground') not in data.get('terrains',{}): errors.append('default ground is not a terrain record')
        if defaults.get('boundary') not in data.get('terrains',{}): errors.append('default boundary is not a terrain record')
        if any(a.get('builtin') for a in data.get('assets',{}).values() if isinstance(a,dict)): errors.append('asset registry still distinguishes built-in assets')

builder=(ROOT/'builder/game.js').read_text(); panel=(ROOT/'src/builder/panel-shell.js').read_text(); project=(ROOT/'src/builder/project-manager.js').read_text()
for token in ['developerContentLibrary','applyDeveloperContentLibrary','refreshDeveloperContentPanel','devTerrains','createDeveloperTerrainFromAsset']:
    if token not in builder: errors.append(f'Builder bundle missing {token}')
if 'data-dev-tab="biomes"' in panel: errors.append('Biomes tab still exists')
for token in ['data-dev-tab="terrain"','data-content-type="mobs"','data-content-type="items"','data-content-type="lootTables"']:
    if token not in panel: errors.append(f'Content UI missing {token}')
for loader in ['js/runtime-loader.js','builder/runtime-loader.js']:
    text=(ROOT/loader).read_text()
    for token in ['manifest.sharedContent','applySharedContent','LR_TERRAINS','LR_TERRAIN_DEFAULTS']:
        if token not in text: errors.append(f'{loader} missing normalized content loader token {token}')
if 'delete zoneBalance.mobs' not in project: errors.append('zone pack still owns mob definitions instead of shared content')
if errors:
    print('Content Library check failed:'); [print('  - '+e) for e in errors]; raise SystemExit(1)
print('PASS normalized shared Content Library (ordinary mobs, direct terrain library, no biome layer)')
