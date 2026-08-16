# Little Realm Visual Scale

Developer Mode (F2) now includes a dedicated **Visual Scale** tab.

World-level controls: player, houses, NPCs, and props.

Mob scale is per type. Click a mob in the world (or use the type chips) and adjust only that species. Supported keys are `slime`, `goblin`, `wolf`, `cow`, `pig`, `chicken`, and `snickers`.

`config/visual-settings.js` stores both the broad visual scale values and a nested `mobTypes` object. Exporting from Developer Mode preserves all of them.
