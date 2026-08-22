#!/usr/bin/env python3
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
errors=[]
shared=json.loads((ROOT/'content/shared/content-library.json').read_text())
terrain=(ROOT/'src/builder/terrain-editor.js').read_text(); panel=(ROOT/'src/builder/panel-shell.js').read_text(); world=(ROOT/'src/world.js').read_text(); assets=(ROOT/'src/builder/asset-manager.js').read_text()
for token in ['devTerrains','paintDeveloperTerrainTile','createDeveloperTerrain','createDeveloperTerrainFromAsset','developerTerrainBehaviorSummary','developerDefaultGroundTerrainId','developerDefaultBoundaryTerrainId','developerZoneBackdropTerrainId','devTerrainTextureScale','textureScale']:
    if token not in terrain: errors.append(f'Terrain Editor missing {token}')
for token in ['devTerrainPalette','devTerrainNew','devTerrainBackdrop','devTerrainDefaultGround','devTerrainDefaultBoundary','Create Paintable Terrain']:
    if token not in panel+assets: errors.append(f'Terrain UI/workflow missing {token}')
if 'data-dev-tab="biomes"' in panel or 'biomeThemes' in json.dumps(shared): errors.append('biome layer still exists')
for key,rec in shared.get('terrains',{}).items():
    for field in ['code','walkable','movementMultiplier','renderer']:
        if field not in rec: errors.append(f'{key} terrain missing {field}')
if not shared.get('terrains',{}).get('safe-grass',{}).get('healing'): errors.append('current Safe Grass record lost healing behavior')
if not shared.get('terrains',{}).get('safe-grass',{}).get('sanctuary'): errors.append('current Safe Grass record lost sanctuary behavior')
for token in ['terrainIsWalkable','terrainIsHealing','terrainIsSanctuary','terrainMovementMultiplier','terrainDecoration','drawWorldTerrainBase','zoneBackdropTerrainCode','drawRepeatingTerrainAsset']:
    if token not in world: errors.append(f'runtime terrain behavior missing {token}')
# Numeric codes may be stored, but gameplay behavior must not compare them directly.
if re.search(r'(?:terrain|world\[[^\n]+)(?:===|!==|==|!=)\s*(?:0|1|2|3|4|6|7|8|9)\b',world): errors.append('runtime still assigns terrain behavior by hard-coded numeric code')
if 'numberOr(def.textureScale,1)' not in world: errors.append('runtime does not apply per-terrain texture scale')
if 'Lower values make leaves, stones, flowers' not in terrain: errors.append('terrain scale UI is missing workflow guidance')
if errors:
    print('Terrain Editor check failed:'); [print('  - '+e) for e in errors]; raise SystemExit(1)
print(f"PASS direct Terrain Library + Painter ({len(shared.get('terrains',{}))} ordinary terrain records; no biome layer)")
