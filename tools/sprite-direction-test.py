from pathlib import Path
import json, re, sys
ROOT=Path(__file__).resolve().parents[1]
manager=(ROOT/'src'/'builder'/'asset-manager.js').read_text()
world=(ROOT/'src'/'world.js').read_text()
shared=json.loads((ROOT/'content'/'shared'/'content-library.json').read_text())
errors=[]
for token in ['developerSpriteDirectionMappingHtml','bindDeveloperSpriteDirectionMapping','devSpriteSwapSides','devSpriteRowRight','devSpriteRowLeft']:
    if token not in manager: errors.append(f'missing Builder direction calibration control: {token}')
if 'spriteLayout?.directionRows' not in world and 'spriteLayout?.directionRows' not in world.replace(' ', ''):
    errors.append('NPC renderer does not read sprite direction metadata')

jorge=shared.get('assets',{}).get('npcsprite-jorge',{}).get('spriteLayout',{}).get('directionRows',{})
placeholder=shared.get('assets',{}).get('npcs-npc-placeholder',{}).get('spriteLayout',{}).get('directionRows',{})
for label,rows in [('Jorge',jorge),('Npc Placeholder',placeholder)]:
    if rows.get('right')!=1 or rows.get('left')!=2:
        errors.append(f'{label} direction rows do not match its actual sheet: {rows}')
if 'window.LR_ASSETS=devAssets' not in manager:
    errors.append('direction mapping editor does not synchronize changes to the live runtime asset registry')
mayor=shared.get('assets',{}).get('npcsprite-major',{}).get('spriteLayout',{}).get('directionRows',{})
if mayor != {'down':0,'right':2,'left':1,'up':3}:
    errors.append(f'Mayor Buck direction rows are not calibrated to actual sheet: {mayor}')
for aid,asset in shared.get('assets',{}).items():
    if asset.get('type') not in {'npcSprite','mobSprite'}: continue
    rows=asset.get('spriteLayout',{}).get('directionRows')
    if not isinstance(rows,dict) or sorted(rows.values()) != [0,1,2,3]:
        errors.append(f'{aid} has invalid directionRows mapping: {rows}')
if errors:
    print('FAIL sprite direction calibration')
    for e in errors: print(' -',e)
    sys.exit(1)
print('PASS sprite direction calibration')
