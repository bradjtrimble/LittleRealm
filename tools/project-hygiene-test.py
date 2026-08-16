#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
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

if errors:
    print("Project hygiene check failed:")
    for error in errors:
        print(f"  - {error}")
    sys.exit(1)

print("PASS project hygiene (README/CHANGELOG present; no root update .txt files)")
