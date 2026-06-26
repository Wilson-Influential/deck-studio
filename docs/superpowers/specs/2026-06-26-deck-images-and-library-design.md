# Deck Studio: images on slides + a shared Library

Date: 2026-06-26
Status: approved direction, pre-build
Driver: meeting with Viv (creative director) and Conor (designer), ~Tue 2026-06-30, to make
Studio "up to scratch" — specifically a team-usable library of graphics/icons/images, and a way
to put images on slides at all.

## Problem

Deck Studio has 8 text + brand-shape layouts and no way to put an image on a slide. Real decks
need screenshots, photos, and approved brand graphics. Viv/Conor want a curated asset library the
whole team can pull from, without breaking the brand and without needing Shea to add things.

## Why this is low-risk architecturally

Slides render as SVG strings. The logo is already embedded as a base64 `<image href="data:...">`
and exports cleanly to PNG (canvas untainted), PPTX (slide-as-PNG) and PDF (print). An image on a
slide is the same proven pattern. We extend an existing mechanism, not invent one.

## Decisions (locked with Shea 2026-06-26)

1. Image model: **dedicated image layouts** (not image-slots-on-every-layout). Fits the layout
   picker, keeps framing on-brand, fastest to ship.
2. Library interaction: **click-to-insert** (not drag-and-drop). Cleaner for a slide tool, hard to
   misplace.
3. Library scope: **one shared data file, surfaced per tool.** Authored once; Deck uses it now,
   Post reuses the same file later. No cross-iframe complexity.
4. Priority: **Deck images + Library now**, Post image support documented as the next phase.

## Scope (this build)

### 1. Three image layouts

Added to the `LAYOUTS` array in `index.html`, same `{id, name, fields, render}` shape as the rest.

- `image` — **Image**: full-bleed, `preserveAspectRatio="xMidYMid slice"` (fills, crops
  gracefully). Optional `kicker` + `title` overlaid bottom-left on a navy gradient scrim for
  legibility. Small logo mark top-left.
- `imagetext` — **Image + text**: image fills ~48% (one side, cover), text block (`title` + `body`)
  on the other on white. Brand accent divider. Good for screenshots that need explanation.
- `screenshot` — **Screenshot**: image *contained* (`xMidYMid meet`), padded, on a brand
  background with a subtle frame/shadow-free border, never cropped. Optional `kicker` + `title`
  above. For UI screenshots that must keep their edges.

Each image layout has an `image` field plus its text fields.

### 2. Image field type (editor)

The editor currently renders every field as a text input/textarea. Add an image field type
(convention: a 4th element `'image'` in the field tuple, e.g.
`['image','Image','','image']`). It renders an image control instead of a text box:

- Thumbnail of the current image, or an empty drop state.
- **Upload** → hidden `<input type="file" accept="image/*">` → FileReader → downscale → store.
- **Choose from Library** → opens the Library panel.
- **Remove** → clears the field.

Image stored on the slide object as `slide.image = "data:image/...;base64,..."`.

**Downscale on import:** draw to an offscreen canvas, longest edge clamped to ~1600px, re-encode
(JPEG q≈0.85 for photos, keep PNG/SVG for graphics). Keeps deck state, exports and share links
sane. SVG library assets are embedded as-is (already small).

### 3. The shared Library

External, data-driven (the app is Vercel-hosted, so fetch works):

- `library.json` manifest:
  ```json
  {
    "categories": [
      { "id": "icons",  "name": "Icons" },
      { "id": "shapes", "name": "Brand shapes" },
      { "id": "logos",  "name": "Logos" },
      { "id": "photos", "name": "Photography" }
    ],
    "assets": [
      { "id": "ring-red", "name": "Ring (red)", "category": "shapes", "src": "library-assets/ring-red.svg" }
    ]
  }
  ```
- `library-assets/` folder holds the files.
- Seeded for the meeting with assets we already have (brand ring in its colours, logo variants,
  brand shapes). Photography category can start empty with a clear "drop approved photos here" note.

**Library panel UI** (non-modal, per Shea's side-panel rule): overlays the editor, no background
blur, stays open while you keep working. Category tabs across the top, a grid of asset thumbnails
below. Click a thumbnail → fetch the asset → convert to a data URL → set it as the current slide's
`image` → re-render. Panel stays open so you can swap. Close with an X or by clicking away.

**Authoring (the team-handoff story):** Conor/Viv add an asset by (a) dropping the file in
`library-assets/`, (b) adding one line to `library.json`, (c) commit/deploy. No code. This is the
"templates-as-data" direction the Studio is already taking. In-app upload-to-library is out of
scope for v1 (needs a write backend); documented as a possible later add.

**Self-containment:** the *app* loads the library from external files, but every *inserted* image
is embedded as base64 into the slide, so exported/shared decks remain self-contained. If
`library.json` fails to load, the panel degrades to "upload only" without erroring.

### 4. Export + state

- PNG / PPTX / PDF: unchanged paths; embedded base64 images ride along like the logo does today.
  Verify image `onload` completes before the canvas draw (same mechanism the logo already relies
  on).
- Share payload (`buildPayload`): `image` is just another slide property, so it round-trips. See
  caveat.

## Known caveat (flag to Shea, not a blocker)

Base64 images bloat the `#z=`/`#d=` share link. Everything works in-app and in all exports; a deck
with several heavy images could exceed practical URL length. Mitigations: aggressive downscale, and
warn if a generated link is oversized. The real fix is the short-share-link Vercel Blob backend
already built on the `short-share-links` branch — merge that later to make heavy decks shareable by
a `/s/<id>` link.

## Out of scope (this build)

- Image-slots on the existing text layouts (possible fast-follow).
- Drag-and-drop placement / free positioning.
- In-app upload-to-library (needs a write backend).
- Post Studio image support — see next phase.

## Next phase: Post Studio images

Reuse the image field + the same `library.json`. Add two image post layouts:

- **Photo + headline** — image background, headline + optional CTA over a brand scrim for
  legibility (answers Shea's "text on top of the image" question: yes, offered).
- **Full photo** — image only, logo in the corner, for pure-visual posts.

Same downscale, same click-to-insert library, same base64-embed-on-export. Documented here so the
Library is built once and shared from day one.

## Files touched

- `index.html` — new layouts, image field control, Library panel, downscale helper, payload already
  carries `image`.
- `library.json` (new) — manifest.
- `library-assets/` (new) — seeded brand assets.
- `docs/` — this spec.

Branch: `deck-images` (off `main` incl. the name feature; deliberately NOT off the short-share-links
Blob backend).
