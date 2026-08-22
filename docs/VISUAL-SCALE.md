# Little Realm Visual Scale

Little Realm separates **source image resolution** from **world size**.

## Mob world size

Mob Types use two appearance fields in `content/shared/content-library.json`:

- `sizeClass` — a human-friendly category: Tiny, Small, Medium, Large, Huge, Boss, or Custom.
- `displayHeight` — the target visible sprite height in world pixels.

The runtime measures the visible pixels in the down/idle reference frame of the 4×4 sprite sheet and derives the draw scale from `displayHeight`. A 384×384 sheet and a 1254×1254 sheet therefore render at the same world size when they use the same `displayHeight`.

Canonical size-class presets are anchored to a 22px Little Realm player reference:

- Tiny: 13px
- Small: 18px
- Medium: 24px
- Large: 35px
- Huge: 50px
- Boss: 74px

The Mob editor and Visual Scale tab both edit the same Mob Type `displayHeight` value. Custom heights are allowed for art that needs an exception.

## Other world scale

NPCs already use an explicit `displayHeight`. World objects use explicit world width/height. Terrain is rendered to the terrain grid and should be authored for consistent detail density rather than creature-scale dimensions.

World Builder still includes broad player/NPC/prop presentation controls and loot-remnant controls for final artistic tuning.
