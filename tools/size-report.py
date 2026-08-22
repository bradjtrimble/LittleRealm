#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

def fmt(n):
    if n >= 1024*1024: return f"{n/(1024*1024):.2f} MB"
    if n >= 1024: return f"{n/1024:.1f} KB"
    return f"{n} B"

def size(path): return path.stat().st_size if path.exists() else 0

assets = [p for p in (ROOT / "assets").rglob("*") if p.is_file()]
asset_total = sum(size(p) for p in assets)
zone_files=[]
try:
    manifest=json.loads((ROOT/'content/little-realm.project.json').read_text())
    zone_files=[(z.get('id','zone'),ROOT/z.get('pack','')) for z in manifest.get('zones',[]) if z.get('pack')]
except Exception:
    manifest={}
zone_total=sum(size(p) for _,p in zone_files)
print("Little Realm size report")
print(f"  Production game JS : {fmt(size(ROOT/'js/game.js'))}")
print(f"  Local builder JS   : {fmt(size(ROOT/'builder/game.js'))}")
print(f"  Assets total       : {fmt(asset_total)}")
print(f"  Zone packs         : {len(zone_files)} totaling {fmt(zone_total)}")
for zone_id,p in zone_files:
    marker=" (default)" if zone_id==manifest.get('defaultZone') else ""
    print(f"    {zone_id:<20} {fmt(size(p)):>9}{marker}")
print("  Largest assets:")
for p in sorted(assets, key=size, reverse=True)[:8]:
    warning = "  !" if size(p) >= 2*1024*1024 else ""
    print(f"    {fmt(size(p)):>9}  {p.relative_to(ROOT)}{warning}")
