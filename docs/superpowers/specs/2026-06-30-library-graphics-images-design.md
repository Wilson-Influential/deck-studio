# Deck Studio — Library, Graphics & Images: Design Spec

> **Date:** 2026-06-30
> **Branch:** `worktree-library-graphics-images` (off `main`)
> **Origin:** Shea's feedback after the 2026-06-29 feature pass shipped + the Notion-features merge.

## Problem

Four issues raised by Shea, in his words:

1. **Library deck thumbnails don't match each deck's colours.** Testing two decks with different sector themes, the library showed both in the most-recent deck's colour.
2. **The asset library (Graphics / Illustrations) is slow, badly cropped in preview, and looks bad once added.** The studio illustration pack is heavy.
3. **Graphics placement via X/Y/Size sliders is "awful."** Needs direct, on-slide manipulation.
4. **Images aren't intuitive enough.** Want to drop a photo and have it handled well, rather than clicking into image-option buttons. Shea's steer: the real fix is *better image layouts* (current ones feel weak); photos must stay brand-safe inside layouts; only graphics/illustrations may be freely placed (low usage, decorative); **no templates for graphics** (too complex).

## Root-cause findings (from the code)

- **Colour bug:** `renderHome` (deck library) builds each card preview with `buildSVG(payload.slides[0])`, and `buildSVG` paints with the **global** `S()`/`sectorId`, ignoring each deck's stored `payload.sector`. Opening a deck is correct (`loadState` restores `payload.sector`); only the thumbnails are wrong.
- **Library weight:** `library-assets/` is **95 MB**; individual studio PNGs are **6–14 MB each**. The library panel renders every full-res image in a category at once. No lightweight thumbnails exist. Placement already downscales to 1600 px (`IMG_MAX`), so the originals are oversized for every use.
- **Graphics placement:** `graphicsEditorHTML` renders three `<input type=range>` sliders (x, y, w) per graphic. The live preview already draws a dashed bounding box around graphics when `interactive` is true (`graphicsSVG`), so the hook for selection/drag exists.
- **Images:** the centre preview already accepts photo drops onto image-layout slots (`previewEl` drop handler → `currentImageKey()` / `data-imgslot`). Dropping on a non-image layout no-ops. All photo layouts use `preserveAspectRatio=...slice` (fill + crop) with **no crop/focal control** — the main reason a photo slide looks wrong.

## Goals / non-goals

**Goals**
- Each library thumbnail shows that deck's real colours.
- Library opens fast and previews look clean; repo weight sane.
- Graphics/illustrations positioned by direct manipulation on the slide.
- Photos look good by default and are easy to place; a dropped photo lands somewhere worth landing.

**Non-goals**
- No freeform colour/position controls for *photos* — they stay inside brand-locked layouts.
- No template system for graphics/illustrations.
- No new dependencies, no build step at runtime. Asset processing is a one-time offline script.
- Keep the familiar PowerPoint-like Deck Studio look (same constraint as the Notion-features merge).

---

## Design

### Unit A — Deck-colour thumbnails (bug fix)

**What:** Library thumbnails render in each deck's saved sector colour.

**How:** Give `buildSVG` an optional sector override: `buildSVG(slide, interactive=false, sectorOverride=null)`. Internally use `sectorOverride || S()`. In `renderHome`, look up each deck's stored `payload.sector` (`SECTORS.find(...)`) and pass it. Default behaviour (live preview, exports) is unchanged because the override defaults to null.

**Touches:** `buildSVG` signature + its one internal `S()` call for the layout render; `renderHome` preview line. Confirm no other caller depends on the 2-arg shape (graphics interactive call passes 2 args — fine).

**Verify:** Two saved decks with different sectors show different-coloured thumbnails; opening either still loads correct colour; live editing unaffected.

### Unit B — Library weight, thumbnails & fit

**What:** Fast grid, clean previews, light repo. Team workflow preserved.

**How:**
- **One-time offline script** (`tools/build-library-thumbs.mjs` or a documented node/sharp/ImageMagick step): for every raster asset, (a) write a ~240 px-longest-edge thumbnail into `library-assets/thumbs/`, and (b) re-encode the original down to ~1600 px longest edge in place. SVGs are left as-is (already tiny). Target: 95 MB → a few MB.
- **`library.json`** gains an optional `thumb` field per asset pointing at the thumbnail. The library grid renders `thumb` (falls back to `src` if absent). **Placement** (`insertLibraryAsset` / `assetToDataURL`) still uses `src` (the now-1600 px original).
- **Thumb fit:** keep `object-fit:contain` but verify visually; adjust `.libThumb` padding/aspect so tall/wide/transparent-padded PNGs sit centred and uncropped. The "cropped" look is fixed here.
- **Team doc:** short note in `library-assets/README.md` — when you add an asset, run the thumb script (or it regenerates all). Keep `library.json` data-driven.

**Touches:** new `tools/` script; `library.json` (`thumb` per asset); `renderLibrary` grid `img src`; `.libThumb`/`.libThumb img` CSS; `library-assets/README.md`.

**Verify:** Open Library → Graphics/Illustrations tabs render instantly; thumbnails centred, uncropped; placing an asset still works and exports cleanly; `du -sh library-assets` is small; grid bytes are thumbnails (network check).

### Unit C — Graphics: drag + corner-resize on the slide

**What:** Replace the X/Y/Size sliders with direct manipulation.

**How:**
- The interactive preview already draws each graphic's dashed bounding box. Add: click a box to **select** it (store `selectedGraphic` index); selected box shows a move cursor + a single **corner-resize handle** (bottom-right square).
- **Move:** pointer-drag inside the box updates `g.x`/`g.y` (normalised 0–1, clamped so it stays on-slide). **Resize:** drag the corner handle updates `g.w` (keep aspect via stored `g.ar`), clamped to sensible min/max (reuse current 0.04–0.55 range).
- Use pointer events on the preview SVG; convert client coords → slide coords via the SVG's bounding rect and `W`/`H`. Re-render preview during drag (cheap), `saveDraftSoon()` + `commitHistorySoon()` on drag end (so one undo step per gesture, consistent with the split-handle pattern already in `imagetext`).
- `graphicsEditorHTML` loses the slider block; keeps the per-graphic list with the thumbnail, name, and **Remove**. Selecting a graphic in the editor list also selects it on the slide (and vice-versa) so they stay in sync.
- Deselect on Escape or clicking empty slide area. Selection chrome is preview-only, never exported (same rule as the split handle).

**Touches:** `graphicsSVG` (selection chrome + handle), `graphicsEditorHTML` (drop sliders, add list selection), new pointer handlers near the existing `previewEl`/split-drag code, a `selectedGraphic` state var, removal of `[data-graphic-range]` wiring.

**Verify:** Add a graphic → it's selectable; drag moves it; corner handle resizes with aspect locked; can't drag off-slide; `⌘Z` undoes a move/resize as one step; export PNG/PPTX shows the graphic with no selection chrome.

### Unit D — Images: fit/reframe + smarter drop + layout polish (build, then react live)

**What:** Photos look good by default and are easy to place. Two concrete, brand-safe additions plus a taste pass.

**How:**
- **Fit / focal control on any placed photo.** Per-image state: `fit` (`'cover'` default = current slice, or `'contain'`) and `focusX`/`focusY` (0–1, default 0.5). Render maps these to `preserveAspectRatio` (`xMidYMid slice` vs `xMidYMid meet`) and, for cover, an alignment derived from focus (e.g. `xMin/xMid/xMax` + `YMin/YMid/YMax`, or a translate on a clipped image for finer focal control). Surface as a small **inline control** on the selected photo in the preview (a fit toggle + drag-to-reposition focal point), not a buried options panel. Applies to the photo layouts (`image`, `imagetext`, `screenshot`, `twoup`).
- **Smarter drop.** Dropping a photo onto a slide with no image slot switches the slide to **Image + text**, preserving `title`/`body`, and fills the photo. Photos thus always live inside a brand-safe layout. (Drop onto an image layout still fills the slot, as today.)
- **Layout polish pass.** Tighten the four photo layouts so the auto-switch target is genuinely good. **This is a taste call** — it will be built and shown to Shea as real rendered screenshots to react to, not fully specified here. Likely candidates: better empty/placeholder states, caption/scrim legibility, spacing, and making `imagetext` feel less bare. No brand-breaking freedom added.

**Touches:** the four image-layout `render` functions; image state fields (`fit`/`focusX`/`focusY`); preview selection/inline-control handlers (shares the Unit C selection machinery where sensible); `previewEl` drop handler (non-image-layout routing); `loadState` tolerance for the new fields on old decks.

**Verify:** Drop a photo on a Bullets slide → becomes Image+text keeping the text; fit toggle switches cover/contain live; dragging focal point re-frames the crop; exports reflect it; old saved decks load without the new fields and don't crash. Screenshots of all four image layouts shared with Shea before this unit is called done.

---

## Sequencing

- **Tier 1 (high-confidence, ship-ready):** A → B → C. Each is independently verifiable and commit-per-unit.
- **Tier 2 (taste, iterate live):** D, with a live link + screenshots for Shea to react to before merge.

## Cross-cutting constraints

- Single file for app logic (`index.html`); the only new file is the offline thumbnail script under `tools/`.
- No native dialogs; destructive actions instant with undo as the net.
- Don't break old saved decks: tolerate missing `fit`/`focus`/`graphics` fields.
- Commit per unit, local only; pushing/merging is Shea's call. Verify live before claiming done.
- Brand stays locked: no freeform colour/position for photos; sector accents and layouts fixed.

## Open / deferred

- Exact resize/rotate affordances for graphics beyond move + corner-resize (rotate is out for v1; `g.rot` already supported in render if wanted later).
- Whether `contain` photos get a brand-tinted letterbox vs white — decide during the D live pass.
