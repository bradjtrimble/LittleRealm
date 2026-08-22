#!/usr/bin/env python3
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
errors=[]
shared=json.loads((ROOT/'content/shared/content-library.json').read_text()); pack=json.loads((ROOT/'content/zones/starter-realm/world-pack.json').read_text())
texts='\n'.join((ROOT/p).read_text() for p in ['src/mobs.js','src/world.js','src/core.js','src/player.js','src/save.js','src/builder/panel-shell.js','src/builder/mob-editor.js','src/builder/terrain-editor.js','js/runtime-loader.js'])
mob_runtime=(ROOT/'src/mobs.js').read_text(); service_worker=(ROOT/'service-worker.js').read_text()
for forbidden in ['renderPreset','MOB_TYPE_SCALE','BUILTIN_MOB','LR_BIOME_THEMES','biomeThemes','legacyStarterScenery','slimeKills','bossDefeated','questComplete','littleRealmMobileSaveV3']:
    if forbidden in texts or forbidden in json.dumps(shared) or forbidden in json.dumps(pack): errors.append(f'legacy concept still active: {forbidden}')
for mob_id,mob in shared.get('mobs',{}).items():
    if not mob.get('spriteAsset'): errors.append(f'{mob_id} has no spriteAsset')
    asset=shared.get('assets',{}).get(mob.get('spriteAsset'))
    if not asset or asset.get('type')!='mobSprite': errors.append(f'{mob_id} spriteAsset is not an ordinary mob asset')
    if mob.get('lootTable') and mob.get('lootTable') not in shared.get('lootTables',{}): errors.append(f'{mob_id} lootTable missing')
if any(re.search(rf'(?i)\b{re.escape(name)}\b',mob_runtime) for name in ['slime','goblin','wolf','cow','pig','chicken','snickers']): errors.append('runtime mob engine still names original content IDs')
if 'content/zones/starter-realm/world-pack.json' in service_worker: errors.append('service worker still gives Starter Realm a privileged pre-cache path')
if 'const mobTemplates=[]' not in texts or 'for(const [id,cfg] of Object.entries(BALANCE.mobs||{}))' not in texts: errors.append('generic mob catalog missing')
if 'drawSheetSprite' not in texts or 'spriteLayout' not in texts: errors.append('asset-driven mob renderer metadata missing')
if 'Active zone has no valid terrain grid' not in texts: errors.append('missing-terrain hard failure missing')
if any((ROOT/'config'/name).exists() for name in ['items.js','loot-tables.js','npcs.js','quests.js','world-objects.js','visual-settings.js']): errors.append('duplicate legacy content config files still exist')
if errors:
    print('Content normalization check failed:'); [print('  - '+e) for e in errors]; raise SystemExit(1)
print('PASS content normalization: no biome layer, no built-in mob catalog/render presets, no duplicate content config fallbacks')
