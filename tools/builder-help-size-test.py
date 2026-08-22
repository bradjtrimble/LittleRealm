#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
errors=[]
def read(rel): return (ROOT/rel).read_text()
help_ui=read('src/builder/help-ui.js')
state=read('src/builder/state.js')
world=read('src/builder/world-editor.js')
interactions=read('src/builder/interactions.js')
overlay=read('src/builder/overlay-render.js')
panel=read('src/builder/panel-refresh.js')
visual=read('src/builder/visual-editor.js')
build=read('tools/build.py')
for token in ['builder/help-ui.js']:
    if token not in build: errors.append('help UI module missing from builder bundle')
for token in ['"aggro range"','"wander delay min"','"leash"','developerOpenSettingHelp','developerEnhanceSettingHelp','devInfoPopover']:
    if token not in help_ui: errors.append(f'setting help missing {token}')
for token in ['devSizeEditing=false','devSizeDrag=null']:
    if token not in state: errors.append(f'visual size state missing {token}')
for token in ['developerVisualSizeTarget','developerVisualSizeHandlePoints','findDeveloperSizeInteraction','setDeveloperSizeEditing','updateDeveloperSizeDrag']:
    if token not in world: errors.append(f'visual size editor missing {token}')
for token in ['findDeveloperSizeInteraction','updateDeveloperSizeDrag','finishedSize']:
    if token not in interactions: errors.append(f'pointer sizing flow missing {token}')
for token in ['drawDeveloperVisualSizeOverlay','devSizeEditing']:
    if token not in overlay: errors.append(f'blue visual size overlay missing {token}')
for token in ['Edit NPC Size Visually','Edit Object Size Visually']:
    if token not in panel: errors.append(f'inspector visual size control missing {token}')
if 'Edit Mob Size Visually' not in visual: errors.append('mob visual size control missing')
if 'hitboxes and interaction areas stay independent' not in interactions.lower(): errors.append('visual-size independence feedback missing')
if errors:
    print('Builder help + visual sizing check failed:')
    for e in errors: print('  - '+e)
    raise SystemExit(1)
print('PASS clickable setting help + drag-handle visual sizing for objects, NPCs, and mobs')
