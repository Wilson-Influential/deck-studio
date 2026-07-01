# Deck Studio — Image UX Overhaul (design spec)

**Date:** 2026-07-01
**Branch / worktree:** `worktree-library-graphics-images` in `.claude/worktrees/library-graphics-images/`, served by `python3 -m http.server 4250`.
**Status:** Design approved by Shea 2026-07-01 ("Yes"). Spec written this session. Build next.
**Predecessors:** builds on `2026-06-30-adaptive-image-slides-design.md` and `2026-06-30-library-graphics-images-design.md`.

## Problem

Shea: the current image UX "isn't a good enough solution" and "without images and other elements it kind of breaks things." Four separate complaints share **one root cause**: there is no single coherent "this image is selected → here is everything you can do to it" surface.

1. **Clicking a photo often replaces it instead of selecting it.** Today only the single-photo layouts (`image` full-bleed, and `imagetext`/`imageright`/`imagecaption` via the `image` key) select the photo. Every other image slot — the cells in `twoup`, `imagestack`, `imagegrid3`, `imagegrid4`, and `screenshot` — calls `pickImageFile(key)` on click, which silently re-opens the OS file picker to **replace** the image. That is the bug at `index.html` ~1963-1971.
2. **The on-canvas focal "dot" and floating toolbar** (`photoControlSVG` focal dot ~1196-1202, `imageToolbarSVG` ~1208) sit on top of the slide, fight the content, and are the "dot/nipple thing" Shea disliked.
3. **Backspace/Delete always deletes the whole slide** even when a photo or graphic is selected (`index.html:1728` — `deleteSlide(cur)` unconditionally).
4. **"What else can I do to images?"** — controls are scattered: some in the right editor panel (`imageFieldHTML`), some floating on the canvas (arrangement + fit toolbar), some as a draggable dot. No one place answers the question.

Plus three Library pains (Shea named these, of four): **can't find** an asset (no search), **can't place** it freely (asset insertion is coupled to a pre-chosen slot via `libTargetKey`), **can't add my own** (library is read-only team `library.json`; uploads are one-shot and never saved).

## Goal

One coherent, non-modal **image inspector** that appears in the right-hand panel whenever a photo is selected — Shea's [[feedback_non-modal-side-panels]] pattern — carrying every image action. Clicking any photo on any layout **selects** it (never silently replaces). Context-aware keyboard so destructive keys respect selection. A Library you can search, add your own assets to (persisted), and place freely.

## Non-goals / explicitly cut

Shea cut these during the brainstorm — **do not build**: zoom-within-frame, rounded corners on photos, alt text, caption text as a new field, graphic templates, any change to export (PNG/PPTX/PDF), any change to share links.

---

## Unit A — Image inspector

### A1. One selection model on every layout

Clicking any photo cell on any layout **selects that specific cell**: draws a light-navy selection outline on the canvas (reuse the existing outline `rect` from `photoControlSVG` ~1194) and swaps the right-hand panel to the Image inspector. It must **never** silently call `pickImageFile` on a filled photo.

- `selectedPhoto` currently only ever holds the string `'image'`. **Generalise it to hold the actual slot key** (`'image'`, `'image2'`, `'image3'`, `'image4'`) so multi-image cells can be individually selected. All read sites that compare `selectedPhoto==='image'` (~421, ~462, ~824) become `selectedPhoto===<thisCellKey>`.
- The preview click handler (~1963-1971): for any `[data-imgslot]` whose cell is **filled**, set `selectedPhoto=key`, clear `selectedGraphicId`, close any inline editor, re-render — select, don't replace. For an **empty** slot, keep today's behaviour: open the file/library flow to fill it (an empty cell has nothing to select).
- Every image-bearing layout's render must emit its photo cells with `data-imgslot="<key>"` and, when that cell is the selected one and interactive, call the (slimmed) `photoControlSVG` to draw the outline. Today `photoControlSVG` is only wired into `imagetext`/`imagecaption`/full `image`; **wire the selection outline into `twoup`, `imagestack`, `imagegrid3`, `imagegrid4`, `screenshot` too.**

### A2. All controls move into the right-hand inspector

When a photo is selected, the right panel (`renderEditor`, `#editor`) swaps from the slide fields to an **Image inspector** section. On deselect it swaps back to the slide fields (parallels how `selectedGraphicId` already re-renders the editor). The inspector contains:

- **Replace** — opens file picker / library for this cell (today's `pickImageFile(key)` / `openLibrary(key)`).
- **Delete image** — removes *the photo*, keeps the slide and its text (`delete deck[cur][key]` then re-render). Distinct from deleting the slide.
- **Arrangement** — Left / Right / Caption / Full, moved **off the canvas** into the panel. This drives `deck[cur].layout` between `imagetext`/`imageright`/`imagecaption`/`image` exactly as the on-canvas `[data-arrange]` toolbar does today (~1955-1956). *(Only shown for single-photo arrangement-capable layouts, not for the multi-image grids.)*
- **Cover / Fit** — sets `deck[cur].fit` (`cover`|`contain`), same as today's `[data-fit]` (~1958-1959).
- **Focus** — a **3×3 tap pad** (9 cells) that sets `focusX`/`focusY` to the tapped cell's centre (0.17 / 0.5 / 0.83 mapping matches `parMode`'s <0.34 / 0.34–0.66 / >0.66 thresholds ~1172-1173). **Cover mode only** (hidden when `fit==='contain'`, since `contain` ignores focal point).

### A3. Multi-image layouts

For `twoup`/`imagestack`/`imagegrid3`/`imagegrid4`, selecting a cell shows that cell's inspector with **Replace**, **Delete image**, and a **Swap** control (swap this cell's image + its caption with an adjacent cell). No arrangement control (grid shape is the layout, chosen from the layout chooser). Cover/Fit and the 3×3 focus pad still apply per cell.

### A4. Remove the on-canvas chrome

**Delete** the floating `imageToolbarSVG` (arrangement+fit bar, ~1208-1226) and the **focal dot** block inside `photoControlSVG` (~1196-1202) and its drag handling (`[data-focal]` pointer logic ~1960, ~2020). `photoControlSVG` keeps only the selection outline `rect`. All the function it provided now lives in the inspector.

---

## Unit B — Context-aware keyboard

Fix the global `keydown` handler (~1717-1729).

- **Backspace / Delete** (currently unconditional `deleteSlide(cur)` at 1728):
  - photo selected → remove that photo (`delete deck[cur][selectedPhoto]`, then deselect + re-render).
  - graphic selected → remove that graphic (mirror the existing remove path keyed by `selectedGraphicId`).
  - nothing selected → `deleteSlide(cur)` (today's behaviour).
- **Escape** (currently closes panels at 1724): if something is selected → deselect (clear `selectedPhoto`/`selectedGraphicId`) and swap the panel back to slide fields; else fall through to today's close-panels behaviour.
- **ACTIONS registry** (~1701): add **"Remove image"** and **"Deselect"** entries so they surface in ⌘K. Their `run` should no-op gracefully when nothing is selected.
- Everything else (arrows, `N`, ⌘D, ⌘Z/⇧⌘Z, ⌘K) unchanged.

---

## Unit C — Library rework

Current library (`loadLibrary`/`openLibrary`/`renderLibrary` ~2127-2177) is read-only, team-`library.json`-only, slot-target-coupled via `libTargetKey`, and has no search. Fix the three named pains.

### C1. Search
A search box at the top of the Library panel filtering **all categories** by asset `name` (and category name). Live filter on input. When a query is present, show matches across categories rather than the single active tab.

### C2. My uploads / Recents (persisted, IndexedDB)
A personal **"My uploads"** section shown alongside the read-only team assets. Any image the user uploads or drops (via `pickImageFile`/`dropImageFile`) **auto-saves** here. Per-item remove. Persist in **IndexedDB** (not localStorage — images blow past the localStorage quota). Store the downscaled data URL (`downscaleToDataURL`, cap `IMG_MAX=1600` already applied) + name + timestamp; render newest-first. Team `library.json` assets stay read-only and separate.

### C3. Free placement
Decouple insertion from a pre-chosen slot.
- **Click** an asset → fill the currently selected photo/cell if one is selected; else fill the slide's primary image slot (or, for a graphic/illustration asset, drop it as a free-floating graphic — today's `insertLibraryAsset` graphic path). Click always works (per [[reference_touch-drag-fails-add-buttons]]).
- **Drag** an asset onto any slide/cell to place it there (desktop bonus). Graphics/illustrations dropped land as free-floating at the drop point.

---

## Flagged judgement call (keep as designed, sanity-check with Shea)

Unit A moves **arrangement (Left/Right/Caption/Full) off the canvas into the inspector** — the single biggest departure from the current on-canvas toolbar. Shea approved the design including this and did not override it, so build it as specified, but call it out when showing him the result so he can react.

## Verification

No test suite. Verify via headless Chrome (Playwright, `channel:'chrome'` per [[reference_playwright-system-chrome-capture]]); every check must report `errors []`. Manual passes on :4250:
1. Click a photo on **each** image layout (image, imagetext, screenshot, twoup, grids) → selects + inspector appears, never re-opens file picker.
2. Inspector Replace / Delete image / Arrangement / Cover-Fit / 3×3 focus each drive the canvas correctly; deselect restores slide fields.
3. Backspace with photo selected removes photo not slide; with nothing selected removes slide. Esc deselects.
4. Library: search filters; upload persists to My uploads across reload; click-to-place fills selected cell; drag-to-place works.
5. No on-canvas focal dot or floating toolbar remains anywhere.
6. PNG/PPTX/PDF export unchanged and clean.
