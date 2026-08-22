from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMMON_BEFORE_DEV = ["core.js", "audio.js", "inventory.js", "loot.js", "world.js", "quests.js", "world-interactions.js", "storage.js"]
COMMON_AFTER_DEV = ["character.js", "player.js", "mobs.js", "combat.js", "ui.js", "save.js", "input.js", "loop.js", "bootstrap.js"]
BUILDER_MODULES = [
    "builder/state.js",
    "builder/help-ui.js",
    "builder/content-library.js",
    "builder/audio-editor.js",
    "builder/audio-importer.js",
    "builder/mob-editor.js",
    "builder/spawn-editor.js",
    "builder/asset-importer.js",
    "builder/asset-manager.js",
    "builder/character-rig-editor.js",
    "builder/art-reference.js",
    "builder/asset-usage.js",
    "builder/object-library.js",
    "builder/styles.js",
    "builder/character-rig-styles.js",
    "builder/workflow-ui.js",
    "builder/camera-editor.js",
    "builder/world-editor.js",
    "builder/project-manager.js",
    "builder/interaction-health.js",
    "builder/project-health.js",
    "builder/zone-manager.js",
    "builder/terrain-editor.js",
    "builder/npc-placement.js",
    "builder/interactions.js",
    "builder/overlay-render.js",
    "builder/panel-refresh.js",
    "builder/visual-editor.js",
    "builder/combat-editor.js",
    "builder/npc-editor.js",
    "builder/quest-editor.js",
    "builder/panel-shell.js",
]
ERROR_HANDLER = 'window.addEventListener("error", (event) => {\n  console.error("Little Realm error:", event.error || event.message);\n});\n'


def source_text(rel: str) -> str:
    return (ROOT / "src" / rel).read_text().rstrip()


def build_bundle(dev_modules, output: Path):
    order = [*COMMON_BEFORE_DEV, *dev_modules, *COMMON_AFTER_DEV]
    parts = [source_text(name) for name in order]
    out = ERROR_HANDLER.rstrip() + "\n\n(() => {\n" + "\n\n".join(parts) + "\n})();\n"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(out)
    print(f"Built {output.relative_to(ROOT)} from {len(order)} source modules")


build_bundle(["devmode-shim.js"], ROOT / "js" / "game.js")
build_bundle(BUILDER_MODULES, ROOT / "builder" / "game.js")
