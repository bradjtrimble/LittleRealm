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
