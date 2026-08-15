from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
core=(ROOT/'src/core.js').read_text()
world=(ROOT/'src/world.js').read_text()
mobs=(ROOT/'src/mobs.js').read_text()
balance=(ROOT/'config/game-balance.js').read_text()
checks={
  '44x32 starter zone':'const WORLD_W = 44;' in core and 'const WORLD_H = 32;' in core,
  'starter town spawn':'const START_TILE_X = 7;' in core and 'const START_TILE_Y = 7;' in core,
  'zone labels':all(s in world for s in ['Starter Town','Farm','Slime Spawns','Goblin Camp',"Snickers' Cave"]),
  'snickers cave entrance':'caveEntrance' in world and "Snickers' Cave" in world,
  'future NPC placeholders':'Quest Giver' in world and 'Shopkeeper' in world and 'Blacksmith' in world,
  'farm animals configured':all(s in balance for s in ['cow: {','pig: {','chicken: {']),
  'farm animal spawns':all(s in mobs for s in ['["cow",4,20]','["pig",6,21]','["chicken",5,23]']),
  'regional hostile spawns':all(s in mobs for s in ['["slime",18,5]','["goblin",34,6]','["wolf",15,17]'])
}
failed=[]
for name,ok in checks.items():
  print(('PASS' if ok else 'FAIL'),name)
  if not ok: failed.append(name)
if failed:
  sys.exit(1)
print('PASS starter zone layout test')
