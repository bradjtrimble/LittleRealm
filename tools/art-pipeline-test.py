#!/usr/bin/env python3
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
errors=[]
shared=json.loads((ROOT/'content/shared/content-library.json').read_text())
mobs=shared.get('mobs',{})
assets=shared.get('assets',{})
art_refs=shared.get('artReferences',{})

if shared.get('schemaVersion')!=12: errors.append('art-pipeline baseline requires shared schema v12')
for mob_id,mob in mobs.items():
    if 'spriteScale' in mob: errors.append(f'{mob_id} still stores legacy spriteScale')
    h=mob.get('displayHeight')
    if not isinstance(h,(int,float)) or h<8: errors.append(f'{mob_id} missing normalized displayHeight')
    if mob.get('sizeClass') not in {'tiny','small','medium','large','huge','boss','custom'}: errors.append(f'{mob_id} has invalid sizeClass')
    asset=assets.get(mob.get('spriteAsset'))
    if not asset: continue
    if asset.get('scaleMode')!='visibleHeight': errors.append(f"{mob_id} sprite asset is not tagged visibleHeight")
    metrics=asset.get('analysis',{}).get('frameMetrics',{})
    if not metrics.get('referenceVisibleHeight'): errors.append(f"{mob_id} sprite asset has no reference visible height")

for asset_id,asset in assets.items():
    if not asset.get('width') or not asset.get('height'): errors.append(f'{asset_id} missing source dimensions')
    if not asset.get('bytes'): errors.append(f'{asset_id} missing file-size metadata')
    if asset.get('artProfile')!='little-realm-v1': errors.append(f'{asset_id} missing Little Realm art profile')
    if asset.get('type') in {'mobSprite','npcSprite'}:
        analysis=asset.get('analysis',{})
        if 'hasTransparency' not in analysis: errors.append(f'{asset_id} missing transparency analysis')
        metrics=analysis.get('frameMetrics',{})
        if metrics.get('columns')!=4 or metrics.get('rows')!=4: errors.append(f'{asset_id} missing 4x4 frame metrics')

mob_src=(ROOT/'src/mobs.js').read_text()
editor=(ROOT/'src/builder/mob-editor.js').read_text()
asset_src=(ROOT/'src/builder/asset-importer.js').read_text()+(ROOT/'src/builder/asset-manager.js').read_text()
ref_src=(ROOT/'src/builder/art-reference.js').read_text()
visual=(ROOT/'src/builder/visual-editor.js').read_text()
world=(ROOT/'src/world.js').read_text()
for token in ['mobVisibleHeightScale','mobVisualScale','displayHeight','MOB_SIZE_CLASS_HEIGHTS']:
    if token not in mob_src: errors.append(f'runtime missing {token}')
for token in ['World Size Class','Visible World Height','devMobDisplayHeight']:
    if token not in editor: errors.append(f'Mob editor missing {token}')
for token in ['developerAssetAnalysis','developerNormalizeSpriteSheet','normalizedSheet','frameCellSize:128','Little Realm Asset Check','frameMetrics','Safe framing','AI source sheet','Game sheet']:
    if token not in asset_src: errors.append(f'Asset Workshop missing {token}')
if 'BALANCE.mobs[key].displayHeight' not in visual: errors.append('Visual Scale panel is not editing normalized mob display height')
if 'npcSpriteAssetRecord' not in world or 'asset?.spriteLayout?.directionRows' not in world: errors.append('NPC renderer is not asset-layout driven')
for asset_id,asset in assets.items():
    if asset.get('type')=='npcSprite' and not asset.get('spriteLayout',{}).get('directionRows'): errors.append(f'{asset_id} missing NPC direction-row metadata')
if 'spriteScale' in mob_src or 'spriteScale' in editor or 'spriteScale' in visual: errors.append('legacy spriteScale still active in runtime/editor')
if 'function mobVisualScale(mob){return mobWorldDisplayHeight(mob)/MOB_SIZE_CLASS_HEIGHTS.medium;}' not in mob_src: errors.append('mobVisualScale must derive only from normalized displayHeight')

if not isinstance(art_refs,dict): errors.append('shared content artReferences must be an object')
for token in ['DEV_ART_REFERENCE_ROLES','developerArtReferencePromptText','refreshDeveloperArtReferenceLibrary','developerSetMasterReference','developerReferenceComparisonHtml']:
    if token not in ref_src: errors.append(f'Art reference pipeline missing {token}')
for token in ['developerArtReferencePromptText','developerArtPromptReferenceCardsHtml','developerImportAssetFile','importDeveloperAssetFiles']:
    if token not in asset_src: errors.append(f'Prompt/import pipeline missing {token}')

if errors:
    print('Art pipeline check failed:')
    for err in errors: print('  - '+err)
    raise SystemExit(1)
print(f'PASS Little Realm art pipeline ({len(mobs)} normalized mobs, {len(assets)} analyzed assets, canonical references + technical checks)')
