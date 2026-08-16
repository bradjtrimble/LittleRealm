#!/usr/bin/env python3
from pathlib import Path
import re, sys

ROOT=Path(__file__).resolve().parents[1]
index=(ROOT/'index.html').read_text()
css=(ROOT/'style.css').read_text()
core=(ROOT/'src'/'core.js').read_text()
inv=(ROOT/'src'/'inventory.js').read_text()
loot=(ROOT/'src'/'loot.js').read_text()
ui=(ROOT/'src'/'ui.js').read_text()

checks=[]
def check(ok,msg):
    checks.append((ok,msg))

check('id="backpackDragHandle"' in index and 'id="lootDragHandle"' in index and 'id="questLogDragHandle"' in index,'all floating panels have drag handles')
check('id="closeBackpack"' in index and 'id="closeLootWindow"' in index,'both panels have compact close controls')
check('id="inventoryDetails"' not in index,'backpack detail furniture removed')
check('id="lootInventoryGrid"' not in index and 'id="takeAllLoot"' not in index,'loot window only contains dropped items')
check('#backpack.floatingOverlay,#lootWindow.floatingOverlay' in css and 'pointer-events:none' in css,'floating overlays let world input pass through')
check('#backpackPanel,#lootPanel' in css and 'pointer-events:auto' in css,'floating panels remain interactive')

m=re.search(r'function isGameplayModalOpen\(\)\{(.*?)\n\}',core,re.S)
body=m.group(1) if m else ''
check('backpack' not in body and 'lootWindow' not in body and 'disposePrompt' in body,'backpack and loot are non-modal gameplay UI')

m=re.search(r'function isLootInteractionOpen\(\)\{(.*?)\n\}',core,re.S)
body=m.group(1) if m else ''
check('lootWindow' not in body and 'disposePrompt' in body,'mobs keep updating while loot is open')

m=re.search(r'function openBackpack\(\)\{(.*?)\n\}',inv,re.S)
body=m.group(1) if m else ''
check('resetHeldKeyboardMovement' not in body and 'input=' not in body,'opening backpack does not stop player movement')

m=re.search(r'function openLootWindow\(.*?\)\{(.*?)\n\}',loot,re.S)
body=m.group(1) if m else ''
check('resetHeldKeyboardMovement' not in body and 'closeBackpack' not in body,'opening loot does not stop movement or close backpack')
check('normalizePendingLoot([...pendingLoot,...normalized])' in loot,'new drops merge while loot window remains open')
check('function bindFloatingPanels()' in ui and 'localStorage.setItem' in ui,'panel positions are draggable and persisted')
check('constrainFloatingPanel("questLogPanel")' in ui,'quest panel is constrained after viewport resize')

failed=[msg for ok,msg in checks if not ok]
for ok,msg in checks:
    print(('PASS' if ok else 'FAIL'),msg)
if failed:
    print('\nFloating UI validation failed:',', '.join(failed))
    sys.exit(1)
print('\nPASS compact floating UI test')
