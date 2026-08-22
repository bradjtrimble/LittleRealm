#!/usr/bin/env python3
"""Guard the World Builder against growing back into one monolithic source file."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "src" / "builder"
EXPECTED = [
    "state.js",
    "content-library.js",
    "mob-editor.js",
    "spawn-editor.js",
    "asset-importer.js",
    "asset-manager.js",
    "character-rig-editor.js",
    "art-reference.js",
    "asset-usage.js",
    "object-library.js",
    "styles.js",
    "workflow-ui.js",
    "world-editor.js",
    "project-manager.js",
    "project-health.js",
    "zone-manager.js",
    "terrain-editor.js",
    "npc-placement.js",
    "interactions.js",
    "overlay-render.js",
    "panel-refresh.js",
    "visual-editor.js",
    "combat-editor.js",
    "npc-editor.js",
    "quest-editor.js",
    "panel-shell.js",
]
errors = []

for name in EXPECTED:
    path = BUILDER / name
    if not path.exists():
        errors.append(f"missing Builder module: src/builder/{name}")
        continue
    line_count = len(path.read_text().splitlines())
    byte_count = path.stat().st_size
    if line_count > 550:
        errors.append(f"src/builder/{name} is {line_count} lines; split it before it exceeds 550")
    if byte_count > 30000:
        errors.append(f"src/builder/{name} is {byte_count} bytes; split it before it exceeds 30 KB")

legacy = (ROOT / "src" / "devmode.js")
if legacy.exists() and legacy.stat().st_size > 2048:
    errors.append("src/devmode.js became a monolith again; Builder source belongs in src/builder/")

build = (ROOT / "tools" / "build.py").read_text()
for name in EXPECTED:
    token = f'"builder/{name}"'
    if token not in build:
        errors.append(f"tools/build.py is not including {token}")

bundle = (ROOT / "builder" / "game.js").read_text()
# A few cross-module symbols prove that the concatenated build still has the
# complete editor rather than only passing a directory/layout check.
for token in [
    "DEV_DRAFT_KEY",
    "developerContentLibrary",
    "refreshDeveloperContentPanel",
    "developerMobEditorHtml",
    "refreshDeveloperSpawnPanel",
    "importDeveloperAssetFile",
    "bindDeveloperCharacterRigAlignment",
    "refreshDeveloperArtReferenceLibrary",
    "developerInitWorkflowUi",
    "importDeveloperAssetFiles",
    "createDeveloperObjectDefinitionFromAsset",
    "openDeveloperProjectFolder",
    "validateDeveloperProject",
    "createDeveloperProjectSnapshot",
    "refreshDeveloperZonePanel",
    "refreshDeveloperTerrainPanel",
    "paintDeveloperTerrainTile",
    "createDeveloperZone",
    "devPointerDown",
    "refreshDeveloperCombatPanel",
    "refreshDeveloperNpcPanel",
    "renderDeveloperQuestEditor",
    "buildDeveloperPanel",
    "initDeveloperMode",
]:
    if token not in bundle:
        errors.append(f"generated Builder bundle missing {token}")

if errors:
    print("Builder modularity check failed:")
    for err in errors:
        print("  - " + err)
    raise SystemExit(1)

print(f"PASS Builder source is modular ({len(EXPECTED)} focused modules; max 550 lines / 30 KB each)")
