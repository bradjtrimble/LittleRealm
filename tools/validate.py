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

if failed:
    print('\nValidation failed:',', '.join(failed)); sys.exit(1)
print('\nAll protected-system checks passed.')
