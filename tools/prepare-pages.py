#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"

if DIST.exists():
    shutil.rmtree(DIST)
DIST.mkdir()

for rel in ["index.html", "style.css", "manifest.webmanifest", "service-worker.js"]:
    shutil.copy2(ROOT / rel, DIST / rel)

for dirname in ["assets", "config", "content"]:
    shutil.copytree(ROOT / dirname, DIST / dirname)

(DIST / "js").mkdir()
for name in ["game.js", "pwa.js", "runtime-loader.js"]:
    shutil.copy2(ROOT / "js" / name, DIST / "js" / name)

print("Prepared production-only GitHub Pages artifact in dist/")
print("Excluded: builder/, src/, tools/, docs/, .github/, developer-only project source files")
