from pathlib import Path
import hashlib, json, re, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
GUARD=json.loads((ROOT/'REGRESSION_GUARD.json').read_text())
BUNDLE=ROOT/'js'/'game.js'

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
# Production JS syntax
try:
    subprocess.run(['node','--check',str(BUNDLE)],check=True,capture_output=True,text=True)
    print('PASS javascript syntax')
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
    levels=subprocess.run(['node',str(ROOT/'tools'/'mob-level-test.js')],check=True,capture_output=True,text=True)
    print(levels.stdout.strip())
except Exception as e:
    failed.append('mob level system test'); print('FAIL mob level system test',e)

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

if failed:
    print('\nValidation failed:',', '.join(failed)); sys.exit(1)
print('\nAll protected-system checks passed.')
