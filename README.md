# Little Realm

Little Realm is a browser-based top-down RPG with a modular JavaScript source tree, data-driven world/content configuration, and an in-game World Builder.

**Current build:** `v59-leveling-quest-xp`

## Run the game

For local development, serve the project root over HTTP and open `index.html` in a browser. For example:

```bash
python3 -m http.server 8000
```

Then open the local server address shown by Python.

## Project layout

- `index.html`, `style.css`, `manifest.webmanifest`, `service-worker.js` — app shell/PWA files.
- `src/` — editable game source modules.
- `js/game.js` — generated production bundle; rebuild it from `src/` with `python3 tools/build.py`.
- `config/` — live game/content configuration such as balance, items, quests, NPCs, keybinds, and world objects.
- `assets/` — game art and icons.
- `docs/` — current system documentation.
- `tools/` — build, validation, and regression utilities.
- `little-realm-world-pack.json` — combined World Builder content pack.
- `CHANGELOG.md` — release/update history.
- `REGRESSION_GUARD.json` — protected-system regression hashes and invariants.

## Normal development workflow

1. Make source changes in the owning `src/` module, or edit the appropriate `config/` file for data-only changes.
2. If source code changed, run `python3 tools/build.py` to regenerate `js/game.js`.
3. Run `python3 tools/validate.py`.
4. Run `python3 tools/workflow_audit.py` when changing repository workflows.
5. Add release notes to the top of `CHANGELOG.md` instead of creating a new root-level update `.txt` file.
6. Package the complete project only after validation passes.

### Updating an older project in-place

ZIP extraction and file-copy updates do not delete files that disappeared from a newer release. If a newer Little Realm package is copied over an older folder/repository, obsolete root files can therefore remain behind. Run `python3 tools/cleanup-legacy.py` once after an in-place upgrade, then run `python3 tools/validate.py`. The cleanup is allow-list based and removes only known legacy Little Realm files. GitHub Actions validates repository hygiene but does not modify or commit your source tree.

## World Builder workflow

Press **F2** on desktop to open Developer Mode. For world/content changes, the preferred workflow is:

**World Builder → Project → Export World Pack (.json)**

The World Pack carries placed props, NPCs, quests, visual settings, and combat tuning together, reducing the need to manage several separate editor exports.

See `docs/WORLD-BUILDER.md` for the current editor behavior.

## Documentation policy

`README.md` describes the current project, `docs/` describes current systems, and `CHANGELOG.md` records historical changes. Per-update root `.txt` files are intentionally not used anymore; the validation suite includes a project-hygiene check to prevent that clutter from returning.
