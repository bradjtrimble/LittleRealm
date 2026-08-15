# Quick balance tuning

Routine gameplay numbers live in `config/game-balance.js`.

For a balance-only change, edit that one file, save it, commit/push it to GitHub, wait for GitHub Pages to deploy, then refresh the game. You do **not** need to run the build tool because the config file is loaded directly by the browser before `js/game.js`.

## Examples

- Wolf HP: `mobs.wolf.hp`
- Wolf damage stat: `mobs.wolf.attack`
- Wolf attack speed: `mobs.wolf.attackIntervalSeconds` (smaller = faster)
- Wolf potion drop chance: `mobs.wolf.potionDropChancePercent`
- Slime gold range: `mobs.slime.goldMin` / `goldMax`
- Player attack speed: `combat.playerAttackIntervalSeconds`
- Player critical hit chance: `combat.playerCritChancePercent`
- Melee distance: `combat.meleeRange`
- Potion heal: `player.potionHeal`
- Level-up stat gains: `progression.*`

Percentages are written as normal percentages, so `15` means 15% and `100` means guaranteed. Time values are seconds.

World geometry, collision footprints, terrain rendering, artwork, and camera behavior remain source-controlled systems rather than quick balance settings, to avoid accidental map/render regressions.
## Live config refresh

`config/game-balance.js` and `config/keybinds.js` are fetched fresh on each online launch. After committing a tuning change to GitHub Pages, refresh/relaunch the game; no JavaScript build step is required.

**Starting values vs saved values:** settings such as `startingGold`, `startingPotions`, and the player's starting stats are used when a new game/reset state is created. Loading an older save restores the values stored in that save. Mob/combat tuning is rebuilt from the current config when the game starts.

