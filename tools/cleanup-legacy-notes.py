#!/usr/bin/env python3
"""Remove legacy root-level release-note files from pre-v58 projects.

This is intentionally allow-list based so it never deletes arbitrary .txt files.
It is safe to run repeatedly.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEGACY_RELEASE_NOTES = {
    'PROP-SHEET-UPDATE.txt',
    'CLEANUP-POLISH-v57.txt',
    'POLISH-PASS.txt',
    'COMBAT-REBALANCE-v46.txt',
    'SLIME-DIRECTION-FIX.txt',
    'SLIME-GEL-UPDATE-v49.txt',
    'MOB-MOTION-FIX.txt',
    'HITBOX-EDITOR-v52.txt',
    'FARM-ANIMAL-REFRESH.txt',
    'WOLF-GOBLIN-FIX.txt',
    'MOB-GROUNDING-FIX.txt',
    'COMBAT-TUNING-LAB.txt',
    'LOOT-WINDOW-v50.txt',
    'WORKFLOW-CLEANUP.txt',
    'LOOT-FOUNDATION-v48.txt',
    'MOB-LEVEL-COMBAT-EXPANSION.txt',
    'FLOATING-LOOT-UI-v51.txt',
    'QUEST-BUILDER-v54.txt',
    'BEAR-SLIME-UPDATE.txt',
    'WORLD-BUILDER-FIX.txt',
    'NPC-SELECTION-v55.txt',
    'QUEST-TRACKING-v56.txt',
    'COMBAT-TUNING-STARTUP-FIX.txt',
    'MOB-LEVELS.txt',
    'VISUAL-SETTINGS-UPDATE.txt',
    'DEPTH-SORT-EDITOR-v53.txt',
}

removed = []
for name in sorted(LEGACY_RELEASE_NOTES):
    path = ROOT / name
    if path.is_file():
        path.unlink()
        removed.append(name)

if removed:
    print(f"Removed {len(removed)} legacy release-note file(s):")
    for name in removed:
        print(f"  - {name}")
else:
    print("PASS legacy release-note cleanup (nothing to remove)")
