#!/usr/bin/env python3
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
errors=[]
shared=json.loads((ROOT/'content/shared/content-library.json').read_text()); pack=json.loads((ROOT/'content/zones/starter-realm/world-pack.json').read_text())
world=(ROOT/'src/world.js').read_text(); terrain=(ROOT/'src/builder/terrain-editor.js').read_text(); assets=(ROOT/'src/builder/asset-manager.js').read_text(); zone=(ROOT/'src/builder/zone-manager.js').read_text()
backdrop=pack.get('zoneSettings',{}).get('backdropTerrainId')
if backdrop not in shared.get('terrains',{}): errors.append('starter world-beyond selection is not an ordinary terrain ID')
for token in ['drawZoneBackdrop','zoneBackdropTerrainId','drawWorldTerrainTile(code','drawZoneBackdropDecor']:
    if token not in world: errors.append(f'world-beyond renderer missing {token}')
if 'drawWorldTerrainTile(code' not in world or 'const code=zoneBackdropTerrainCode()' not in world: errors.append('world beyond does not reuse terrain renderer')
for token in ['setDeveloperZoneBackdropTerrain','developerMatchZoneEdgeToBackdrop']:
    if token not in terrain: errors.append(f'terrain world-beyond workflow missing {token}')
if 'terrainTexture' not in assets or 'createDeveloperTerrainFromAsset' not in assets: errors.append('terrain texture import does not create paintable terrain')
if 'devNewZoneBackdrop' not in zone: errors.append('new zones cannot choose world-beyond terrain')
if errors:
    print('Themed world check failed:'); [print('  - '+e) for e in errors]; raise SystemExit(1)
print('PASS world-beyond uses any ordinary terrain record and the same terrain renderer')
