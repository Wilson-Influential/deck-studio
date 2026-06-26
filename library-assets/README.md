# Studio Library assets

This folder + `../library.json` are the shared asset Library the whole team pulls from
inside the Studio (Image / Image + text / Screenshot layouts → **Choose from Library**).

## Add an asset (no code)

1. Drop the file in this folder. SVG, PNG or JPG. Keep it on-brand — only approved assets go here.
2. Open `../library.json` and add one line to `"assets"`:

   ```json
   { "id": "my-asset", "name": "My asset", "category": "shapes", "src": "library-assets/my-asset.svg" }
   ```

   - `id` must be unique.
   - `category` must match one of the ids in `"categories"` (shapes / icons / logos / photos).
   - `src` is the path to the file.
   - Optional `"bg": "#201747"` sets the thumbnail background — use it so light assets
     (e.g. a white logo) stay visible in the picker.

3. Commit / deploy. It appears in the Library for everyone.

## Categories

Edit the `"categories"` list in `library.json` to add or rename tabs.

The picker shows a clear empty state for any category with no assets yet (e.g. Photography),
so it's fine to add a category before you have assets for it.
