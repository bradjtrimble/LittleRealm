#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
CANONICAL_DIRS = ("assets", "config", "docs", "js", "src", "tools")
KNOWN_OBSOLETE_ROOT = {"house-atlas.png", "house_A.png", "house_B.png", "static.yml"}
errors = []

for required in ("README.md", "CHANGELOG.md"):
    if not (ROOT / required).is_file():
        errors.append(f"missing required project document: {required}")

root_txt = sorted(path.name for path in ROOT.glob("*.txt") if path.is_file())
if root_txt:
    errors.append(
        "root-level .txt files are not allowed; consolidate release notes into CHANGELOG.md: "
        + ", ".join(root_txt)
    )

canonical_names = {
    path.name
    for dirname in CANONICAL_DIRS
    for path in (ROOT / dirname).rglob("*")
    if path.is_file()
}
root_duplicates = sorted(
    path.name
    for path in ROOT.iterdir()
    if path.is_file() and path.name in canonical_names
)
if root_duplicates:
    errors.append(
        "obsolete root duplicates shadow files in organized project folders: "
        + ", ".join(root_duplicates)
    )

obsolete = sorted(name for name in KNOWN_OBSOLETE_ROOT if (ROOT / name).is_file())
if obsolete:
    errors.append("known obsolete root files remain: " + ", ".join(obsolete))

if errors:
    print("Project hygiene check failed:")
    for error in errors:
        print(f"  - {error}")
    sys.exit(1)

print("PASS project hygiene (organized source tree; no legacy root clutter)")
