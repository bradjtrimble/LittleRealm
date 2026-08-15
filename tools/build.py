from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ORDER=["core.js","world.js","player.js","mobs.js","combat.js","ui.js","save.js","loop.js","bootstrap.js"]
error_handler='window.addEventListener("error", (event) => {\n  console.error("Little Realm error:", event.error || event.message);\n});\n'
parts=[(ROOT/"src"/name).read_text().rstrip() for name in ORDER]
out=error_handler.rstrip()+"\n\n(() => {\n"+"\n\n".join(parts)+"\n})();\n"
(ROOT/"js"/"game.js").write_text(out)
print("Built js/game.js from", len(ORDER), "source modules")
