#!/usr/bin/env python3
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
errors=[]
shell=(ROOT/'src/builder/panel-shell.js').read_text()
manager=(ROOT/'src/builder/asset-manager.js').read_text()
character=(ROOT/'src/character.js').read_text()
content=(ROOT/'src/builder/content-library.js').read_text()
inventory=(ROOT/'src/inventory.js').read_text()
health=(ROOT/'src/builder/character-rig-editor.js').read_text()
for token in ['playerBody','playerHair','playerEquipment']:
    if f'<option value="{token}"' in shell: errors.append(f'Builder still exposes legacy {token} import/filter choice')
for label in ['Player Equipment — Chest','Player Equipment — Legs','Player Equipment — Feet / Boots']:
    if label in shell: errors.append(f'Builder still exposes {label}')
for token in ['bodyAsset','hairAsset','equipmentLayer']:
    if token in character: errors.append(f'player renderer still uses {token}')
if 'layerAssetForSlot' in inventory: errors.append('equipment runtime still resolves visible character layers')
if 'Character Layer' in content: errors.append('item editor still asks for a character layer')
if 'Import at least one Playable Character' not in health or 'valid Playable Character' not in health: errors.append('Project Health does not validate playable characters')
if 'playerBody:{label:' in manager or 'playerHair:{label:' in manager or 'playerEquipment:{label:' in manager: errors.append('Art Prompt Builder still exposes modular player layer types')
if errors:
    print('Character rig retirement check failed:')
    for e in errors: print('  - '+e)
    sys.exit(1)
print('PASS v77.6 modular character rig is retired from the active workflow')
