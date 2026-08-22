#!/usr/bin/env python3
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
shared=json.loads((ROOT/'content/shared/content-library.json').read_text())
pack=json.loads((ROOT/'content/zones/starter-realm/world-pack.json').read_text())
world=(ROOT/'src/world.js').read_text(); panel=(ROOT/'src/builder/panel-shell.js').read_text(); core=(ROOT/'src/core.js').read_text(); combat=(ROOT/'src/combat.js').read_text(); balance=(ROOT/'config/game-balance.js').read_text()
errors=[]
defs=shared.get('objectDefinitions',{})
if len(defs)<50: errors.append('Object Library did not absorb original atlas props')
for key in ['bench','barrel','fence','goblinTent','bridge']:
    if key not in defs: errors.append(f'missing ordinary object definition: {key}')
for obj in pack.get('worldObjects',[]):
    if obj.get('type')!='object': errors.append(f"{obj.get('id')} has non-generic object type {obj.get('type')}")
    if obj.get('objectId') not in defs: errors.append(f"{obj.get('id')} references missing object definition")
    for legacy in ['templateId','sprite']:
        if legacy in obj: errors.append(f"{obj.get('id')} still stores legacy placement field {legacy}")
for forbidden in ['PROP_SPECS','caveEntrance','blockedGate','obj.type==="crops"','obj.type==="caveEntrance"','obj.type==="blockedGate"']:
    if forbidden in world: errors.append(f'world runtime still has privileged object path: {forbidden}')
for forbidden in ['Built-in Prop Palette','Custom Objects','devPalette','devCustomObjectPalette']:
    if forbidden in panel: errors.append(f'Builder still exposes legacy object class: {forbidden}')
if 'Object Library' not in panel or 'devObjectPalette' not in panel: errors.append('unified Object Library UI missing')
if 'LR_OBJECT_DEFINITIONS' not in core and 'PROJECT_OBJECT_DEFINITIONS' not in core: errors.append('runtime object-definition registry missing')
if 'SLIMES_REQUIRED' in combat or 'slimesRequired' in balance or 'slimesRequired' in json.dumps(pack): errors.append('obsolete slime-specific quest knob remains')
if 'worldObjectTemplates' in shared: errors.append('legacy worldObjectTemplates shared key remains')
if shared.get('schemaVersion')!=12 or pack.get('schemaVersion')!=12: errors.append('normalized project schema is not v12')
if errors:
    print('Unified content check failed:');[print('  - '+e) for e in errors];raise SystemExit(1)
print(f"PASS unified content: {len(defs)} equal Object Library records; no built-in/custom prop split or content-specific render branches")
