# Little Realm World Builder

Press **F2** on desktop to toggle Developer Mode.

- Choose a prop from the palette, then click the world to place copies.
- Choose **Select / Move** and drag a prop to reposition it.
- The inspector edits position, hitbox/solid collision, interactable metadata, and container metadata/capacity.
- **Edit Hitbox Visually** turns the selected object's collision box into a crop-style editor directly in the world. Drag inside the yellow box to move it, or drag any of the 8 side/corner handles to resize it. The numeric X/Y/W/H fields remain available for exact values.
- Visual hitbox editing is pixel-precise and intentionally ignores the normal object-placement Snap setting.
- Delete/Backspace removes the selected object when no text field is focused.
- Grid and hitbox overlays are only visible in Developer Mode.
- Changes autosave to a browser-local draft while you work.
- **Export world-objects.js** downloads the finished placement file. Replace `config/world-objects.js` in the repo with that exported file and push to make the layout permanent for everyone.
- **Load Local Draft** restores an editor draft after a refresh.
- **Use Project Layout** returns the live editor to the currently deployed `config/world-objects.js` layout.

`container` and `capacity` are stored now so future chest/storage interaction can use the same placed-object data without another map-format migration.


## Depth / player overlap (v53)

Selected world objects have a **Depth Mode**. `Y-Sort` is the recommended default: the player's feet are compared with the object's purple depth line. Feet above the line render behind the prop; feet below the line render in front. The line can be dragged outside the sprite bounds and is independent from collision.

Fixed modes are available for special cases: **Always Behind Player**, **Always In Front of Player**, and **Ground / Floor**. The exported `world-objects.js` stores these as `depthMode` and (for Y-Sort) `depthY`. Older object files without these fields remain compatible; their default depth line is derived from the bottom of the object's hitbox.


## NPCs and quests (v54)

The **NPCs** tab can place the Lilly model, Jorge model, or a blank NPC. NPCs can be dragged directly in the world and the inspector can edit ID, name, role, sprite, position, facing, display height, interaction radius, greeting, and collision. NPC data exports to `config/npcs.js`.

The **Quests** tab is a visual Quest Maker. It supports Kill, Collect, Talk, Deliver, and Visit objectives; quest giver / turn-in dropdowns; opening and completion dialogue; XP/gold/item rewards; prerequisites; next-quest links; and repeatable quests. Quest data exports to `config/quests.js`.

## World Pack workflow (v54)

The preferred long-term workflow is now **Project → Export World Pack (.json)**. The World Pack contains the current placed props, NPCs, quests, visual settings, and combat tuning in one uploadable file. This lets many small world/content edits be batched before the project source needs to be updated.

Local drafts now save the same combined content. Old v1 prop-only drafts are migrated automatically when loaded. The Project tab can also import a previously exported World Pack to continue editing it in the browser.


## NPC visual selection (v55)

NPCs now participate in the Selection tab alongside props. Selecting an NPC exposes live Sprite Height, model/facing, a visual collision hitbox editor, and a draggable Y-sort depth line. The placeholder NPC is a real 4x4 sprite sheet at `assets/npcs/npc-placeholder.png`, so it uses the same rendering and sizing path as named NPC models.

## Quest tracking (v56)

Accepted quests are tracked by default. The in-game Quest Log has a per-quest **Track** checkbox, and the side tracker can display multiple active quests and all objectives for each quest. Talk objectives also add a grey `?` marker above NPCs that still need to be spoken to.
