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

## 2026-06 Studio asset import

Assets from `OneDrive_1_29-06-2026.zip` live in `studio-2026-06/` and are listed in
`../library.json` under **Graphics** and **Illustrations**.

Only PNG files are added to Deck Studio because the picker places browser-renderable images
onto slides.

## Adding assets

1. Drop the approved PNG/JPG into `library-assets/` (or a subfolder).
2. Add an entry in `../library.json` (`id`, `name`, `category`, `src`).
3. From the Deck Studio repo root, regenerate thumbnails and sizes:
   ```
   ./tools/build-library-thumbs.sh
   node tools/add-thumbs-to-library.mjs
   ```
   This caps originals at 1600px, writes 240px grid thumbnails to `library-assets/thumbs/`,
   and sets the `thumb` field in `library.json`. Commit the asset, its thumbnail, and `library.json`.
