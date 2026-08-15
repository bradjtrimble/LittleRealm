# Little Realm World Builder

Press **F2** on desktop to toggle Developer Mode.

- Choose a prop from the palette, then click the world to place copies.
- Choose **Select / Move** and drag a prop to reposition it.
- The inspector edits position, hitbox/solid collision, interactable metadata, and container metadata/capacity.
- Delete/Backspace removes the selected object when no text field is focused.
- Grid and hitbox overlays are only visible in Developer Mode.
- Changes autosave to a browser-local draft while you work.
- **Export world-objects.js** downloads the finished placement file. Replace `config/world-objects.js` in the repo with that exported file and push to make the layout permanent for everyone.
- **Load Local Draft** restores an editor draft after a refresh.
- **Use Project Layout** returns the live editor to the currently deployed `config/world-objects.js` layout.

`container` and `capacity` are stored now so future chest/storage interaction can use the same placed-object data without another map-format migration.
