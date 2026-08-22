#!/usr/bin/env python3
from pathlib import Path
import json, re

ROOT = Path(__file__).resolve().parents[1]
errors=[]
prod=(ROOT/'js/game.js').read_text()
builder=(ROOT/'builder/game.js').read_text()
builder_html=(ROOT/'builder/index.html').read_text()
builder_loader=(ROOT/'builder/runtime-loader.js').read_text()
sw=(ROOT/'service-worker.js').read_text()
workflow=(ROOT/'.github/workflows/static.yml').read_text()

if 'buildDeveloperPanel' in prod or 'DEV_DRAFT_KEY' in prod:
    errors.append('production game bundle still contains full World Builder code')
if 'function initDeveloperMode(){}' not in prod:
    errors.append('production bundle is missing safe World Builder compatibility shim')
for token in ['buildDeveloperPanel','openDeveloperProjectFolder','saveDeveloperProjectFolder','showDirectoryPicker','LR_BUILDER_MODE']:
    if token not in builder: errors.append(f'local builder bundle missing {token}')
if './builder/runtime-loader.js' not in builder_html or './js/pwa.js' in builder_html:
    errors.append('local Builder page is not isolated from the production PWA loader')
for token in ['content/little-realm.project.json','sharedContent','cache:"no-store"','./builder/game.js']:
    if token not in builder_loader: errors.append(f'Builder loader missing {token}')

manifest_path=ROOT/'content/little-realm.project.json'
try:
    manifest=json.loads(manifest_path.read_text())
    if manifest.get('format')!='little-realm-project': errors.append('invalid project manifest format')
    shared=manifest.get('sharedContent')
    if not shared: errors.append('project manifest has no shared Content Library')
    elif not (ROOT/shared).exists(): errors.append('shared Content Library file does not exist')
    zone=next((z for z in manifest.get('zones',[]) if z.get('id')==manifest.get('defaultZone')),None)
    if not zone: errors.append('default zone is not declared in project manifest')
    else:
        pack_path=ROOT/zone['pack']
        if not pack_path.exists(): errors.append('default zone pack does not exist')
        else:
            pack=json.loads(pack_path.read_text())
            if pack.get('format')!='little-realm-world-pack': errors.append('default zone has invalid World Pack format')
            for key in ['worldObjects','npcs','quests','mobSpawns','visualSettings','balance']:
                if key not in pack: errors.append(f'default zone pack missing {key}')
except Exception as err:
    errors.append(f'project manifest/zone pack could not be read: {err}')


root_launcher=ROOT/'START WORLD BUILDER.bat'
if not root_launcher.exists(): errors.append('root-level World Builder launcher is missing')
elif 'tools\\start-world-builder.bat' not in root_launcher.read_text(): errors.append('root-level World Builder launcher does not forward to tools/start-world-builder.bat')

if 'assets/loot/lootable-dust.png' in sw or 'assets/characters/player.png' in sw:
    errors.append('service worker still pre-caches large gameplay art')
if 'cache.put(event.request' not in sw:
    errors.append('service worker does not cache requested assets on demand')
if "path: './dist'" not in workflow:
    errors.append('GitHub Pages workflow does not deploy production-only dist/')

if errors:
    print('Builder foundation check failed:')
    for err in errors: print('  - '+err)
    raise SystemExit(1)
print('PASS local World Builder separation, project manifest, direct-folder workflow, and production-only deployment')
