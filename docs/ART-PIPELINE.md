# Little Realm Art Pipeline

The art pipeline keeps generated or imported assets consistent without relying on the image generator to produce identical source resolutions.

## Foundation already in place

The runtime now separates **source resolution** from **world scale**:

- mob sprites are normalized by visible reference-frame height
- NPCs use explicit display height
- imported art is analyzed when it enters the project
- imported 4×4 Mob/NPC sheets are normalized to a 512×512 game sheet with exact 128×128 cells
- the original AI source dimensions are retained as metadata while validation runs against the normalized game asset
- the Asset Inspector shows a Little Realm Asset Check before the asset is used

This means a 384×384 sprite sheet and a 1254×1254 sprite sheet can still render at the same in-game size.

## Little Realm art standard

The World Builder **Assets** tab now includes a project art standard and prompt builder. The standard locks the common rules for all new art:

- polished fantasy pixel-art rendering
- top-down RPG camera / slight 3⁄4 game view
- crisp pixel edges and slightly chunky outlines
- readable silhouettes and grounded fantasy colors
- no painterly blur, photorealism, or poster-style scene composition

## Create Art Prompt

The **Create Art Prompt** tool generates a reusable prompt for:

- Mob Sprites
- NPC Sprites
- Playable Characters
- World Objects
- Buildings
- Terrain Textures
- Item Icons
- Effect Sprites

You choose the asset type, size class, subject, description, and any extra constraints. The tool then writes the technical part of the prompt for you.

Examples of rules the builder locks automatically:

- 4×4 / 16-frame sprite-sheet layout for mobs, NPCs, and playable characters
- 128×128 game-frame cells and 512×512 normalized game sheets; larger AI source sheets are accepted and normalized automatically
- transparent background for sprites/objects/icons
- safe-area padding inside each sprite frame
- seamless tileability and micro-detail requirements for terrain
- no scene background for placeable objects

## Current workflow

1. Open **World Builder → Assets**.
2. Use **Create Art Prompt** to generate the right prompt for the asset you want.
3. Generate the artwork externally.
4. Import the image back into the project through **Asset Workshop**. Mob/NPC/Playable Character sheets are normalized automatically before being written into the project.
5. Review the **Little Realm Asset Check**, which shows both AI source dimensions and normalized game-sheet dimensions.
6. Review the automatic technical checks in the Asset Inspector. These checks are informational unless they reveal a genuinely broken asset.
7. Compare the selected asset side-by-side with any compatible canonical Master References.
8. Assign approved art to a Mob Type, NPC, terrain, item, or placeable object.
9. Run **Validate Project** before packaging. Art approval is not a requirement; Project Health focuses on broken references/files and treats unused or unusually large art as advisory information.

## Why this matters

Little Realm now handles asset consistency at two layers:

- **Prompt layer:** style, framing, animation layout, and texture/detail rules stay consistent.
- **Runtime layer:** world size no longer depends on whatever source resolution the generator happened to return.

That combination is what makes the game feel visually coherent instead of every new asset being a one-off guess.

## Canonical Little Realm reference library

The Assets tab now includes a **Canonical Art Reference Library**. You can assign a gold-standard asset to each role:

- Character Master
- Mob Master
- NPC Master
- Object Master
- Building Master
- Terrain Master
- Item Master
- Effect Master

Setting an asset as a Master Reference only marks it as a visual reference. The prompt builder then shows the recommended reference images for the selected asset type and adds their project paths plus reference-matching instructions to the copied prompt. Master references do not gate ordinary asset use.

The reference set is stored in `content/shared/content-library.json` under `artReferences`, so it travels with the Little Realm project rather than living only in browser state.

## Technical checks

The **Little Realm Asset Check** is a technical diagnostic, not an approval gate. It reports issues such as transparency, sprite framing, normalized sheet dimensions, and other asset-format problems. Canonical Master References remain optional visual guides.

Project Health reserves errors and warnings for problems that can actually affect the project, such as missing files or broken references. Unused imported art and unusually large images are shown as **advisories**, so they remain visible without turning normal saving into an approval checklist.


## Playable character policy

Little Realm now uses **complete premade playable characters** instead of modular body, hair, clothing, or armor overlays. A playable character is authored as one finished 4×4 sprite sheet with the clothing and appearance already baked into the art.

Equipment remains a gameplay/inventory system, but changing Chest, Legs, Feet, or other gear does **not** require a matching character overlay. This intentionally keeps character art independent from item progression and removes the alignment-heavy paper-doll workflow.

To add a new option to Character Select:

1. Generate a **Playable Character** prompt in World Builder → Assets.
2. Import the finished 4×4 sheet as **Playable Character**.
3. The character automatically becomes available on the new-game Character Select screen.
4. Optionally mark one Playable Character as the default selection in the Asset Inspector.
