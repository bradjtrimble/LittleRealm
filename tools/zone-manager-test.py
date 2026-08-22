#!/usr/bin/env python3
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
errors=[]
manifest=json.loads((ROOT/'content/little-realm.project.json').read_text())
if manifest.get('schemaVersion',0)<4: errors.append('project manifest schema is not zone-manager aware')
zones=manifest.get('zones',[])
if not zones: errors.append('project manifest has no zones')
for zone in zones:
    for key in ('id','name','pack'):
        if not zone.get(key): errors.append(f'zone entry missing {key}')
    pack_path=ROOT/zone.get('pack','')
    if not pack_path.exists(): errors.append(f"zone pack missing: {zone.get('pack')}")
    else:
        pack=json.loads(pack_path.read_text())
        settings=pack.get('zoneSettings')
        terrain=pack.get('terrain')
        if not isinstance(settings,dict): errors.append(f"{zone['id']} missing zoneSettings")
        else:
            w,h=settings.get('width'),settings.get('height')
            if not isinstance(w,int) or not isinstance(h,int): errors.append(f"{zone['id']} invalid dimensions")
            if not isinstance(terrain,list) or len(terrain)!=h or any(not isinstance(row,list) or len(row)!=w for row in terrain):
                errors.append(f"{zone['id']} terrain does not match dimensions")
            sx,sy=settings.get('startTileX'),settings.get('startTileY')
            if not isinstance(sx,int) or not isinstance(sy,int) or not (2<=sx<=w-3 and 2<=sy<=h-3): errors.append(f"{zone['id']} invalid player start")

for loader in ['js/runtime-loader.js','builder/runtime-loader.js']:
    text=(ROOT/loader).read_text()
    for token in ['LR_ZONE_SETTINGS','LR_WORLD_TERRAIN','defaultZone']:
        if token not in text: errors.append(f'{loader} missing {token}')
core=(ROOT/'src/core.js').read_text()
for token in ['INITIAL_ZONE_SETTINGS','configureWorldDimensions','let WORLD_W','let WORLD_H','let START_X','let START_Y']:
    if token not in core: errors.append(f'core dynamic zone dimensions missing {token}')
world=(ROOT/'src/world.js').read_text()
for token in ['normalizeZoneTerrain','makeBlankZoneTerrain','applyWorldZoneDefinition','buildScenery({worldObjects=null,npcs=null}={})']:
    if token not in world: errors.append(f'world zone support missing {token}')
manager=(ROOT/'src/builder/zone-manager.js').read_text()
for token in ['createDeveloperZone','switchDeveloperZone','setDeveloperDefaultZone','deleteDeveloperZone','refreshDeveloperZonePanel','developerNewZonePack']:
    if token not in manager: errors.append(f'Zone Manager missing {token}')
panel=(ROOT/'src/builder/panel-shell.js').read_text()
for token in ['data-dev-tab="zones"','devZoneList','devZoneInspector','devCreateZone','devNewZoneWidth','devNewZoneTemplate']:
    if token not in panel: errors.append(f'Builder Zone UI missing {token}')
project=(ROOT/'src/builder/project-manager.js').read_text()
for token in ['zoneSettings:','terrain:world.map','developerPersistProjectManifest','developerPersistActiveProject']:
    if token not in project: errors.append(f'project persistence missing {token}')
if errors:
    print('Zone Manager check failed:')
    for e in errors: print('  - '+e)
    raise SystemExit(1)
default=next(z for z in zones if z.get('id')==manifest.get('defaultZone'))
pack=json.loads((ROOT/default['pack']).read_text())
print(f"PASS Project/Zone Manager foundation ({len(zones)} zone; default {default['id']}; {pack['zoneSettings']['width']}x{pack['zoneSettings']['height']} terrain)")
