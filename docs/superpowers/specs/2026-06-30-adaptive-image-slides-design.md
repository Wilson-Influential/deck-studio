# Deck Studio — Adaptive Image Slides (Phase 1): Design Spec

> **Date:** 2026-06-30
> **Branch:** `worktree-library-graphics-images` (off `main`)
> **Origin:** Shea's react to the Task 4 image work (2026-06-30). He rejected a layout *polish* pass and asked for the image *model* to be rethought: "Do we need a layout specifically for images? Does it adjust when you add an image? The layouts make it almost too restrictive… do some thinking and figure out the best solution."

## Problem

Using a photo today means **picking an image layout up front** (Image / Image + text / Screenshot / Two images) before the photo exists. That's the friction: the layout is a mode you commit to, not a response to your content. Too few layouts feels restrictive; adding more would make a long unusable list.

## Decision (approved by Shea 2026-06-30)

**Adaptive image slides.** You add an image to *any* slide; it arranges itself to a sensible default; a small on-slide control cycles only the arrangements that fit the current content. Approach A of three (B = keep layouts and smooth them; C = free-drag photos — rejected, breaks the brand-safe rule). **Phase 1 = single-image arrangements only.** Multi-image (side-by-side / stacked / grid) is a fast-follow.

## Phase 1 scope

Four single-image arrangements, all sharing the same fields (`title`, `body`, `image`, `fit`/`focusX`/`focusY`, `logo`) so cycling between them never loses content:

| Arrangement | Layout id | Source |
|---|---|---|
| **Left** (photo left, text right) | `imagetext` | exists |
| **Right** (photo right, text left) | `imageright` | NEW — mirror of `imagetext` |
| **Caption** (full-width photo + caption band) | `imagecaption` | NEW |
| **Full** (full-bleed, optional overlaid caption) | `image` | exists |

### Units

- **Unit A — `imageright` layout.** A mirror of `imagetext`: image occupies the right `split` of the slide, text on the left, logo top-left. Reuses `parMode(c)` for fit/focal, the navy letterbox, and the same draggable split handle (mirrored). Same fields as `imagetext`.
- **Unit B — `imagecaption` layout.** Full-width photo across the top band (~70% height) using `parMode(c)`; a caption strip below holds `title` + `body` on white, with the sector accent rule used elsewhere. Logo on the photo (white) top-left with a top scrim, consistent with `image`.
- **Unit C — Arrangement control.** When a slide is showing a single-image arrangement and its photo is selected, the inline photo toolbar gains an arrangement segment — `Left | Right | Caption | Full` — beside the existing `Cover | Fit` toggle. Clicking an arrangement swaps `deck[cur].layout` among the four ids, **preserving all fields**, re-rendering live. Preview-only; never exported. One cohesive bar (the "Apple/Notion" interaction bar), matching the existing `--navy`/`--soft`/`--line` tokens. The focal dot stays on the photo.
- **Unit D — Smart-drop default.** Dropping a photo on a slide with no image slot picks the arrangement: **Left** (`imagetext`) if the slide has `title`/`body` text, else **Full** (`image`). (Today's behaviour always picks `imagetext`; this refines it.) Title/body are preserved.

### Cross-cutting constraints (unchanged from the parent spec)

- Single file for app logic (`index.html`). No new runtime deps, no build step.
- Brand stays locked: photos only ever sit inside these safe arrangements — no free-drag for photos.
- No native dialogs; undo (`⌘Z`) is the net.
- Don't break old decks: new layout ids and fields are additive; old decks keep working. The existing named layouts in the LAYOUT grid stay during Phase 1 (retire later once Shea's happy).
- Selection chrome and the toolbar render only when `interactive` is true; exports pass `interactive=false`.
- Commit per unit, local only. Pushing/merging is Shea's call. Verify live; screenshots for Shea before calling the taste parts done.

## Out of scope (Phase 1)

- Multi-image arrangements (side-by-side / stacked / grid) — Phase 2.
- Retiring/merging the old named image layouts in the LAYOUT grid — later, once the adaptive path is approved.
- Screenshot / Two-images layouts — unchanged.

## Verify

- Drop a photo on a Bullets slide → becomes an image arrangement, text preserved, photo framed.
- Select the photo → toolbar shows `Left | Right | Caption | Full` + `Cover | Fit`; cycling swaps arrangement without losing title/body/image; focal dot still drags.
- Each arrangement renders cleanly empty and filled, Cover and Fit; exports carry no toolbar/handles; old decks load.
- Screenshots of all four arrangements (empty + sample photo) shared with Shea before the taste parts are called done.
