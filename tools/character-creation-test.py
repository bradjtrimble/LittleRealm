from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parents[1]
errors=[]
shared=json.loads((ROOT/'content/shared/content-library.json').read_text())
index=(ROOT/'index.html').read_text(); builder=(ROOT/'builder/index.html').read_text(); character=(ROOT/'src/character.js').read_text(); player=(ROOT/'src/player.js').read_text(); save=(ROOT/'src/save.js').read_text(); importer=(ROOT/'src/builder/asset-importer.js').read_text(); shell=(ROOT/'src/builder/panel-shell.js').read_text(); inventory=(ROOT/'src/inventory.js').read_text(); manager=(ROOT/'src/builder/asset-manager.js').read_text(); content=(ROOT/'src/builder/content-library.js').read_text(); build=(ROOT/'tools/build.py').read_text()
def need(cond,msg):
    if not cond: errors.append(msg)
need('id="startupScreen"' in index and 'id="startupContinue"' in index and 'id="startupNew"' in index,'startup title screen missing')
need('id="characterSelectView"' in index and 'Choose Your Character' in index and 'id="characterNameInput"' in index and 'id="characterPreviewCanvas"' in index,'character select UI missing')
need('characterCreatorView' not in index and 'characterModeChoices' not in index and 'characterModularChoices' not in index,'legacy character creator UI still present')
need('function initializeStartupFlow' in character and 'window.LR_BUILDER_MODE' in character,'builder startup bypass missing')
need('PLAYER_CHARACTER_ASSET_TYPES=new Set(["playerAppearance"])' in character,'runtime still exposes modular character asset types')
need('bodyAsset' not in character and 'hairAsset' not in character and 'equipmentLayer' not in character,'modular body/hair/equipment rendering still active')
need('equipment:createStarterEquipment()' in player,'fresh player state does not equip starter gear')
need('character:normalizeCharacterProfile' in player,'fresh player state does not own character profile')
need('PLAYER_SAVE_SCHEMA_VERSION=2' in save and 'next.character=normalizeCharacterProfile' in save and 'next.equipment=' in save,'character/equipment save schema missing')
need('PLAYER_EQUIPMENT_SLOTS' in inventory and 'equipInventorySlot' in inventory and 'unequipEquipmentSlot' in inventory,'equipment runtime missing')
need('layerAssetForSlot' not in inventory and 'playerEquipment' not in inventory,'visible equipment layer runtime still active')
defaults=shared.get('characterDefaults',{}); assets=shared.get('assets',{}); items=shared.get('items',{}); aid=defaults.get('defaultAppearanceAsset','')
need(aid in assets and assets.get(aid,{}).get('type')=='playerAppearance','default playable character asset invalid')
need(aid=='playerappearance-male-1' and assets.get(aid,{}).get('path')=='assets/characters/male-1.png','Male 1 is not the default playable character')
need('characters-player' not in assets and not (ROOT/'assets/characters/player.png').exists(),'legacy Classic Adventurer playable character still present')
need('defaultBodyAsset' not in defaults,'modular body default still active')
need('Playable Character' in importer and 'Playable Character' in shell,'Builder playable-character import UI missing')
need(all(x not in shell for x in ['Player Body Layer','Player Hair Layer','Player Equipment — Chest']),'legacy modular import choices still exposed')
need('playerBody:{label:' not in manager and 'playerHair:{label:' not in manager and 'playerEquipment:{label:' not in manager,'legacy modular prompt types still exposed')
need('Character Layer' not in content and 'does not alter the premade character sprite' in content,'item editor still exposes visible equipment layers')
starter=defaults.get('starterEquipment',{})
for slot in ['chest','legs','feet']:
    item_id=starter.get(slot,''); rec=items.get(item_id,{})
    need(bool(item_id) and rec.get('equipmentSlot')==slot,f'starter {slot} equipment missing or invalid')
    need('layerAsset' not in rec,f'starter {slot} still stores a visual equipment layer')
need('"character.js", "player.js"' in build,'character runtime module not ordered before player')
if errors:
    print('Character select check failed:\n  - '+'\n  - '.join(errors));sys.exit(1)
print('PASS v77.7 premade character select + Male 1 default + non-visual equipment foundation')
