from pathlib import Path
import hashlib, json, re, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
GUARD=json.loads((ROOT/'REGRESSION_GUARD.json').read_text())
BUNDLE=ROOT/'js'/'game.js'
BUILDER_BUNDLE=ROOT/'builder'/'game.js'

def extract_function(src,name):
    m=re.search(r'function\s+'+re.escape(name)+r'\s*\([^)]*\)\s*\{',src)
    if not m: raise ValueError(f'missing function {name}')
    start=m.start(); j=m.end()-1; depth=0; state='code'; quote=''; esc=False
    while j<len(src):
        c=src[j]; n=src[j+1] if j+1<len(src) else ''
        if state=='code':
            if c in ('"',"'",'`'): state='str'; quote=c; esc=False
            elif c=='/' and n=='/': state='line'; j+=1
            elif c=='/' and n=='*': state='block'; j+=1
            elif c=='{': depth+=1
            elif c=='}':
                depth-=1
                if depth==0: return src[start:j+1]
        elif state=='str':
            if esc: esc=False
            elif c=='\\': esc=True
            elif c==quote: state='code'
        elif state=='line':
            if c=='\n': state='code'
        elif state=='block':
            if c=='*' and n=='/': state='code'; j+=1
        j+=1
    raise ValueError(f'unterminated function {name}')

def sha(data): return hashlib.sha256(data).hexdigest()

failed=[]

try:
    hygiene=subprocess.run(['python3',str(ROOT/'tools'/'project-hygiene-test.py')],check=True,capture_output=True,text=True)
    print(hygiene.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('project hygiene test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL project hygiene test',detail)
except Exception as e:
    failed.append('project hygiene test'); print('FAIL project hygiene test',e)


try:
    foundation=subprocess.run(['python3',str(ROOT/'tools'/'builder-foundation-test.py')],check=True,capture_output=True,text=True)
    print(foundation.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('local builder foundation test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL local builder foundation test',detail)
except Exception as e:
    failed.append('local builder foundation test'); print('FAIL local builder foundation test',e)

try:
    modularity=subprocess.run(['python3',str(ROOT/'tools'/'builder-modules-test.py')],check=True,capture_output=True,text=True)
    print(modularity.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('builder modularity test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL builder modularity test',detail)
except Exception as e:
    failed.append('builder modularity test'); print('FAIL builder modularity test',e)

try:
    content_library=subprocess.run(['python3',str(ROOT/'tools'/'content-library-test.py')],check=True,capture_output=True,text=True)
    print(content_library.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('shared Content Library test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL shared Content Library test',detail)
except Exception as e:
    failed.append('shared Content Library test'); print('FAIL shared Content Library test',e)

try:
    spawn_assets=subprocess.run(['python3',str(ROOT/'tools'/'spawn-asset-test.py')],check=True,capture_output=True,text=True)
    print(spawn_assets.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('spawn + asset workflow test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL spawn + asset workflow test',detail)
except Exception as e:
    failed.append('spawn + asset workflow test'); print('FAIL spawn + asset workflow test',e)

try:
    zone_manager=subprocess.run(['python3',str(ROOT/'tools'/'zone-manager-test.py')],check=True,capture_output=True,text=True)
    print(zone_manager.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('project + zone manager test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL project + zone manager test',detail)
except Exception as e:
    failed.append('project + zone manager test'); print('FAIL project + zone manager test',e)

try:
    terrain_editor=subprocess.run(['python3',str(ROOT/'tools'/'terrain-editor-test.py')],check=True,capture_output=True,text=True)
    print(terrain_editor.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('terrain editor test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL terrain editor test',detail)
except Exception as e:
    failed.append('terrain editor test'); print('FAIL terrain editor test',e)

try:
    themed_builder=subprocess.run(['python3',str(ROOT/'tools'/'themed-world-builder-test.py')],check=True,capture_output=True,text=True)
    print(themed_builder.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('themed world builder test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL themed world builder test',detail)
except Exception as e:
    failed.append('themed world builder test'); print('FAIL themed world builder test',e)

try:
    project_health=subprocess.run(['python3',str(ROOT/'tools'/'project-health-test.py')],check=True,capture_output=True,text=True)
    print(project_health.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('project health test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL project health test',detail)
except Exception as e:
    failed.append('project health test'); print('FAIL project health test',e)

try:
    normalization=subprocess.run(['python3',str(ROOT/'tools'/'content-normalization-test.py')],check=True,capture_output=True,text=True)
    print(normalization.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('content normalization test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL content normalization test',detail)
except Exception as e:
    failed.append('content normalization test'); print('FAIL content normalization test',e)

try:
    unified_content=subprocess.run(['python3',str(ROOT/'tools'/'unified-content-test.py')],check=True,capture_output=True,text=True)
    print(unified_content.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('unified content test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL unified content test',detail)
except Exception as e:
    failed.append('unified content test'); print('FAIL unified content test',e)

try:
    art_pipeline=subprocess.run(['python3',str(ROOT/'tools'/'art-pipeline-test.py')],check=True,capture_output=True,text=True)
    print(art_pipeline.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('art pipeline test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL art pipeline test',detail)
except Exception as e:
    failed.append('art pipeline test'); print('FAIL art pipeline test',e)

try:
    builder_ux=subprocess.run(['python3',str(ROOT/'tools'/'builder-ux-test.py')],check=True,capture_output=True,text=True)
    print(builder_ux.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('builder UX test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL builder UX test',detail)
except Exception as e:
    failed.append('builder UX test'); print('FAIL builder UX test',e)

try:
    help_size=subprocess.run(['python3',str(ROOT/'tools'/'builder-help-size-test.py')],check=True,capture_output=True,text=True)
    print(help_size.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('builder help + visual sizing test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL builder help + visual sizing test',detail)
except Exception as e:
    failed.append('builder help + visual sizing test'); print('FAIL builder help + visual sizing test',e)

try:
    audio_system=subprocess.run(['python3',str(ROOT/'tools'/'audio-system-test.py')],check=True,capture_output=True,text=True)
    print(audio_system.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('audio system test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL audio system test',detail)
except Exception as e:
    failed.append('audio system test'); print('FAIL audio system test',e)

try:
    sprite_direction=subprocess.run(['python3',str(ROOT/'tools'/'sprite-direction-test.py')],check=True,capture_output=True,text=True)
    print(sprite_direction.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('sprite direction calibration test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL sprite direction calibration test',detail)
except Exception as e:
    failed.append('sprite direction calibration test'); print('FAIL sprite direction calibration test',e)

# Production + local Builder JS syntax
try:
    subprocess.run(['node','--check',str(BUNDLE)],check=True,capture_output=True,text=True)
    subprocess.run(['node','--check',str(BUILDER_BUNDLE)],check=True,capture_output=True,text=True)
    print('PASS javascript syntax (production + builder)')
except Exception as e:
    failed.append('javascript syntax'); print('FAIL javascript syntax',e)

src=BUNDLE.read_text()
for name,expected in GUARD['protected_function_sha256'].items():
    try: actual=sha(extract_function(src,name).encode())
    except Exception as e: actual='ERROR:'+str(e)
    ok=actual==expected
    print(('PASS' if ok else 'FAIL'),name)
    if not ok: failed.append(name)

for rel,expected in GUARD['protected_asset_sha256'].items():
    p=ROOT/rel
    actual=sha(p.read_bytes()) if p.exists() else 'MISSING'
    ok=actual==expected
    print(('PASS' if ok else 'FAIL'),rel)
    if not ok: failed.append(rel)

zoom_ok=bool(re.search(r'const CAMERA_ZOOM\s*=\s*1\.85\b',src))
print(('PASS' if zoom_ok else 'FAIL'),'CAMERA_ZOOM 1.85')
if not zoom_ok: failed.append('CAMERA_ZOOM')

# Runtime files listed in service worker must exist.
sw=(ROOT/'service-worker.js').read_text()
for rel in re.findall(r'"\./([^"?]+)"',sw):
    if rel=='': continue
    p=ROOT/rel
    if not p.exists(): failed.append('missing '+rel); print('FAIL missing',rel)
print('PASS runtime file references' if not any(x.startswith('missing ') for x in failed) else 'FAIL runtime file references')
try:
    camera_editor=subprocess.run(['python3',str(ROOT/'tools'/'camera-editor-test.py')],check=True,capture_output=True,text=True)
    print(camera_editor.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('Builder Camera & World View test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL Builder Camera & World View test',detail)
except Exception as e:
    failed.append('Builder Camera & World View test'); print('FAIL Builder Camera & World View test',e)


try:
    smoke=subprocess.run(['node',str(ROOT/'tools'/'smoke-test.js')],check=True,capture_output=True,text=True)
    print(smoke.stdout.strip())
except Exception as e:
    failed.append('initialization smoke test'); print('FAIL initialization smoke test',e)

try:
    keyboard=subprocess.run(['node',str(ROOT/'tools'/'input-test.js')],check=True,capture_output=True,text=True)
    print(keyboard.stdout.strip())
except Exception as e:
    failed.append('keyboard input test'); print('FAIL keyboard input test',e)


try:
    inventory=subprocess.run(['node',str(ROOT/'tools'/'inventory-test.js')],check=True,capture_output=True,text=True)
    print(inventory.stdout.strip())
except Exception as e:
    failed.append('backpack inventory test'); print('FAIL backpack inventory test',e)

try:
    equipment=subprocess.run(['node',str(ROOT/'tools'/'equipment-test.js')],check=True,capture_output=True,text=True)
    print(equipment.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('equipment runtime test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL equipment runtime test',detail)
except Exception as e:
    failed.append('equipment runtime test'); print('FAIL modular equipment runtime test',e)

try:
    loot=subprocess.run(['node',str(ROOT/'tools'/'loot-test.js')],check=True,capture_output=True,text=True)
    print(loot.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('loot foundation test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL loot foundation test',detail)
except Exception as e:
    failed.append('loot foundation test'); print('FAIL loot foundation test',e)

try:
    floating_ui=subprocess.run(['python3',str(ROOT/'tools'/'floating-ui-test.py')],check=True,capture_output=True,text=True)
    print(floating_ui.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('compact floating UI test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL compact floating UI test',detail)
except Exception as e:
    failed.append('compact floating UI test'); print('FAIL compact floating UI test',e)

try:
    zone=subprocess.run(['python3',str(ROOT/'tools'/'zone-test.py')],check=True,capture_output=True,text=True)
    print(zone.stdout.strip())
except Exception as e:
    failed.append('starter zone layout test'); print('FAIL starter zone layout test',e)

try:
    dev=subprocess.run(['node',str(ROOT/'tools'/'devmode-test.js')],check=True,capture_output=True,text=True)
    print(dev.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('developer world builder test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL developer world builder test',detail)
except Exception as e:
    failed.append('developer world builder test'); print('FAIL developer world builder test',e)

try:
    quests=subprocess.run(['node',str(ROOT/'tools'/'quest-test.js')],check=True,capture_output=True,text=True)
    print(quests.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('quest builder test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL quest builder test',detail)
except Exception as e:
    failed.append('quest builder test'); print('FAIL quest builder test',e)


try:
    world_interactions=subprocess.run(['node',str(ROOT/'tools'/'world-interaction-test.js')],check=True,capture_output=True,text=True)
    print(world_interactions.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('world interaction + interior test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL world interaction + interior test',detail)
except Exception as e:
    failed.append('world interaction + interior test'); print('FAIL world interaction + interior test',e)

try:
    containers=subprocess.run(['node',str(ROOT/'tools'/'container-object-quest-test.js')],check=True,capture_output=True,text=True)
    print(containers.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('container + object quest test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL container + object quest test',detail)
except Exception as e:
    failed.append('container + object quest test'); print('FAIL container + object quest test',e)


try:
    quest_tracker=subprocess.run(['node',str(ROOT/'tools'/'quest-tracker-test.js')],check=True,capture_output=True,text=True)
    print(quest_tracker.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('quest tracking UI test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL quest tracking UI test',detail)
except Exception as e:
    failed.append('quest tracking UI test'); print('FAIL quest tracking UI test',e)

try:
    npc_selection=subprocess.run(['node',str(ROOT/'tools'/'npc-selection-test.js')],check=True,capture_output=True,text=True)
    print(npc_selection.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('NPC selection + placeholder test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL NPC selection + placeholder test',detail)
except Exception as e:
    failed.append('NPC selection + placeholder test'); print('FAIL NPC selection + placeholder test',e)

try:
    npc_facing=subprocess.run(['node',str(ROOT/'tools'/'npc-dialog-facing-test.js')],check=True,capture_output=True,text=True)
    print(npc_facing.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('NPC conversation facing test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL NPC conversation facing test',detail)
except Exception as e:
    failed.append('NPC conversation facing test'); print('FAIL NPC conversation facing test',e)

try:
    depth_sort=subprocess.run(['node',str(ROOT/'tools'/'depth-sort-test.js')],check=True,capture_output=True,text=True)
    print(depth_sort.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('world object depth sort test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL world object depth sort test',detail)
except Exception as e:
    failed.append('world object depth sort test'); print('FAIL world object depth sort test',e)

try:
    config_test=subprocess.run(['node',str(ROOT/'tools'/'config-test.js')],check=True,capture_output=True,text=True)
    print(config_test.stdout.strip())
except Exception as e:
    failed.append('live config test'); print('FAIL live config test',e)

try:
    motion=subprocess.run(['node',str(ROOT/'tools'/'mob-motion-test.js')],check=True,capture_output=True,text=True)
    print(motion.stdout.strip())
except Exception as e:
    failed.append('mob motion stability test'); print('FAIL mob motion stability test',e)

try:
    leash=subprocess.run(['node',str(ROOT/'tools'/'mob-leash-test.js')],check=True,capture_output=True,text=True)
    print(leash.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('mob leash + health reset test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL mob leash + health reset test',detail)
except Exception as e:
    failed.append('mob leash + health reset test'); print('FAIL mob leash + health reset test',e)

try:
    levels=subprocess.run(['node',str(ROOT/'tools'/'mob-level-test.js')],check=True,capture_output=True,text=True)
    print(levels.stdout.strip())
except Exception as e:
    failed.append('mob level system test'); print('FAIL mob level system test',e)

try:
    mob_authoring=subprocess.run(['node',str(ROOT/'tools'/'mob-authoring-test.js')],check=True,capture_output=True,text=True)
    print(mob_authoring.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('mob authoring + safe grass workflow test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL mob authoring + safe grass workflow test',detail)
except Exception as e:
    failed.append('mob authoring + safe grass workflow test'); print('FAIL mob authoring + safe grass workflow test',e)

try:
    progression=subprocess.run(['node',str(ROOT/'tools'/'progression-test.js')],check=True,capture_output=True,text=True)
    print(progression.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('1-100 progression test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL 1-100 progression test',detail)
except Exception as e:
    failed.append('1-100 progression test'); print('FAIL 1-100 progression test',e)

try:
    tuning=subprocess.run(['node',str(ROOT/'tools'/'combat-tuning-test.js')],check=True,capture_output=True,text=True)
    print(tuning.stdout.strip())
except Exception as e:
    failed.append('combat tuning lab test'); print('FAIL combat tuning lab test',e)

try:
    startup=subprocess.run(['node',str(ROOT/'tools'/'combat-startup-test.js')],check=True,capture_output=True,text=True)
    print(startup.stdout.strip())
except Exception as e:
    failed.append('combat tuning startup safety test'); print('FAIL combat tuning startup safety test',e)

try:
    character_creation=subprocess.run(['python3',str(ROOT/'tools'/'character-creation-test.py')],check=True,capture_output=True,text=True)
    print(character_creation.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('character select test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL character select test',detail)
except Exception as e:
    failed.append('character select test'); print('FAIL character creation test',e)

try:
    character_rig=subprocess.run(['python3',str(ROOT/'tools'/'character-rig-test.py')],check=True,capture_output=True,text=True)
    print(character_rig.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('character rig retirement test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL character rig retirement test',detail)
except Exception as e:
    failed.append('character rig retirement test'); print('FAIL character rig alignment test',e)

try:
    maintenance=subprocess.run(['node',str(ROOT/'tools'/'maintenance-test.js')],check=True,capture_output=True,text=True)
    print(maintenance.stdout.strip())
except subprocess.CalledProcessError as e:
    failed.append('maintenance regression test')
    detail=(e.stderr or e.stdout or str(e)).strip()
    print('FAIL maintenance regression test',detail)
except Exception as e:
    failed.append('maintenance regression test'); print('FAIL maintenance regression test',e)

if failed:
    print('\nValidation failed:',', '.join(failed)); sys.exit(1)
print('\nAll protected-system checks passed.')
