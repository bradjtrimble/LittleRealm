from pathlib import Path
import sys, json
ROOT=Path(__file__).resolve().parents[1]
core=(ROOT/'src/core.js').read_text()
world=(ROOT/'src/world.js').read_text()
mobs=(ROOT/'src/mobs.js').read_text()
pack=json.loads((ROOT/'content/zones/starter-realm/world-pack.json').read_text())
shared=json.loads((ROOT/'content/shared/content-library.json').read_text())
settings=pack.get('zoneSettings',{})
width=int(settings.get('width',0) or 0); height=int(settings.get('height',0) or 0)
terrain=pack.get('terrain',[])
objects=pack.get('worldObjects',[]); object_defs=shared.get('objectDefinitions',{})
spawns=pack.get('mobSpawns',[]); mob_defs=shared.get('mobs',{})
npcs=pack.get('npcs',[])
spawn_ids=[str(s.get('id','')).strip() for s in spawns]
checks={
  'starter zone terrain matches declared dimensions':width>0 and height>0 and len(terrain)==height and all(len(row)==width for row in terrain),
  'starter position lies inside zone':0<=int(settings.get('startTileX',-1))<width and 0<=int(settings.get('startTileY',-1))<height and 'INITIAL_ZONE_SETTINGS' in core,
  'no hard-coded location tags':all(s not in world for s in ['label(7,2.5,"Starter Town")','label(6,17,"Farm")','label(22,3,"Slime Spawns")']),
  'world objects reference ordinary object definitions':all(o.get('objectId') in object_defs for o in objects),
  'legacy placeholder scenery removed':'legacyStarterScenery' not in settings and not any(o.get('id')=='slime-sign' for o in objects),
  'zone-driven NPC records':all(isinstance(n.get('id'),str) and n.get('id') and isinstance(n.get('name'),str) and n.get('name') for n in npcs) and 'getProjectNPCs()' in world,
  'mob spawns reference ordinary mob definitions':all(s.get('mobType') in mob_defs for s in spawns),
  'mob spawn ids are present and unique':all(spawn_ids) and len(spawn_ids)==len(set(spawn_ids)),
  'data-driven spawn runtime':'window.LR_MOB_SPAWNS' in mobs and 'spawnId' in mobs
}
failed=[]
for name,ok in checks.items():
  print(('PASS' if ok else 'FAIL'),name)
  if not ok: failed.append(name)
if failed: sys.exit(1)
print(f'PASS starter zone data model ({width}x{height}, {len(objects)} objects, {len(npcs)} NPCs, {len(spawns)} mob spawns)')
