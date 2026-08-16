#!/usr/bin/env python3
"""Remove known obsolete root files left by pre-v58.2 in-place upgrades.

ZIP extraction and file-copy overlays do not delete files that disappeared from
newer releases. This migration is intentionally allow-list based so it never
deletes arbitrary project files. It is safe to run repeatedly.
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

LEGACY_ROOT_DUPLICATES = {
    'ARCHITECTURE.md', 'BALANCE-TUNING.md', 'INVENTORY.md', 'KEYBINDS.md',
    'LOOT.md', 'STARTER-ZONE.md', 'VISUAL-SCALE.md', 'WORLD-BUILDER.md',
    'bear.png', 'bootstrap.js', 'build.py', 'cave-entrance.png', 'chicken.png',
    'combat-startup-test.js', 'combat-tuning-test.js', 'combat.js',
    'config-test.js', 'core.js', 'cow.png', 'devmode-test.js', 'devmode.js',
    'environment-atlas.png', 'game-balance.js', 'game.js', 'goblin.png',
    'house-a.png', 'house-atlas.png', 'house-b.png', 'house_A.png', 'house_B.png',
    'icon-192.png', 'icon-512.png', 'input-test.js', 'input.js',
    'inventory-test.js', 'inventory.js', 'items.js', 'keybinds.js', 'loop.js',
    'loot-tables.js', 'loot-test.js', 'loot.js', 'mob-level-test.js',
    'mob-motion-test.js', 'mobs.js', 'object-atlas.png', 'pig.png', 'player.js',
    'player.png', 'pwa.js', 'runtime-loader.js', 'save.js', 'slime-gel.png',
    'slime.png', 'smoke-test.js', 'static.yml', 'terrain-seamless.png', 'ui.js',
    'validate.py', 'visual-settings.js', 'water-seamless.png', 'wolf.png',
    'workflow_audit.py', 'world-objects.js', 'world.js', 'zone-test.py',
}

removed = []
for name in sorted(LEGACY_RELEASE_NOTES | LEGACY_ROOT_DUPLICATES):
    path = ROOT / name
    if path.is_file():
        path.unlink()
        removed.append(name)

if removed:
    print(f"Removed {len(removed)} known legacy root file(s):")
    for name in removed:
        print(f"  - {name}")
else:
    print("PASS legacy root cleanup (nothing to remove)")
