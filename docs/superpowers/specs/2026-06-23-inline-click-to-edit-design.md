# Deck Studio — Inline click-to-edit + logo cycle

> Design spec. 2026-06-23.
> Goal: edit slide text by clicking it directly in the preview, and cycle the logo by
> clicking it, without ever being able to make a bad / off-brand design.

## Background

Deck Studio renders each slide as a single SVG string built by `buildSVG(slide)` and
injected via `#preview.innerHTML`. Text is drawn as `<text>`/`<tspan>` elements whose
positions and font-sizes are computed to fit. That same SVG is exported to PNG/PDF/PPTX,
which is why exports are pixel-perfect.

Today, content is edited only in the right-hand sidebar (`renderEditor`): fields carry a
`data-k` attribute, an `input` listener writes `sl[key]=value`, then `renderPreview()`
rebuilds the SVG. We are adding a second, more intuitive way to edit, without changing the
data model or the export path.

## Principles

- **SVG stays the single source of truth.** Inline editing is a momentary HTML overlay on
  top of the preview; it never enters the SVG, so exports are unaffected.
- **Additive, not a replacement.** The sidebar editor stays exactly as-is. Inline editing
  is a second route to the same `sl[key]` writes.
- **Hard to muck up by construction.** You can only edit text content and cycle approved
  logo states. No drag, resize, recolour, or font controls. Layout, brand, and auto-fit
  type logic are untouched, so defaults stay perfect and a long title can't overflow.

## Scope

- **In:** Deck Studio only. Inline text editing for content fields; logo click-to-cycle.
- **Out (this build):** Post Studio (fast-follow port once Deck feels right — same engine).
  Right-click logo menu (YAGNI; click-to-cycle covers it). Pro mode / skill levels
  (open question, explicitly not being built).

## Components

### 1. Editable-text tagging (in `buildSVG` + helpers)

The `<text>` elements that correspond to an editable content field gain a `data-edit`
attribute naming the field key:

- Title → `data-edit="title"`
- Body / statement text → `data-edit="body"`
- Kicker → `data-edit="kicker"`
- Quote → `data-edit="quote"`, attribution → `data-edit` for its key
- Stats figures → `data-edit="stats"` plus `data-idx="<n>"` and `data-part="value|label"`,
  because each stat is a `value,label` pair (a sub-field).

Footer and page-number text are auto-generated and are **not** tagged (not editable).
Bullets are a single newline-separated `body` field, so the whole bullet block edits as
one multi-line field (matches the existing data model).

### 2. Overlay editor

A single reusable overlay element (textarea / contenteditable) absolutely positioned over
`#preview`. Behaviour:

- **Discoverability:** hovering an editable region shows a soft rounded highlight and a
  faint "click to edit" cue (the affordance Slides lacks).
- **Open:** clicking a `[data-edit]` element reads its on-screen bounding box
  (`getBoundingClientRect`) and the relevant style attributes (font-size scaled from SVG
  units to screen px, family Effra, weight, fill colour, text-anchor → text-align,
  letter-spacing). The overlay is positioned and styled to match, so it reads as typing
  *into the slide*, with a gentle focus ring and a small floating "Editing: <field>" label.
- **Type:** the overlay sits over the text while typing (the SVG behind is not re-rendered
  mid-edit, which would destroy the clicked node). Single-line fields: Enter or click-away
  commits, Esc cancels. Multi-line fields (body / bullets): Enter inserts a newline,
  click-away commits, Esc cancels.
- **Commit:** write back to the slide data via a single `applyEdit(field, idx, part, text)`
  helper (plain key → `sl[key]=text`; stat sub-field → reconstruct the stats entry), then
  re-render: `renderPreview()`, refresh the active thumbnail, and refresh the sidebar field
  so both routes stay in sync. Hide the overlay.

### 3. Logo click-to-cycle

The logo group in the SVG gains `data-edit-logo`. Clicking it cycles the existing per-slide
logo state **Main → Ring mark → Off → Main** by writing `sl.logo` and re-rendering, with a
small tooltip showing the new mode. Only the real approved assets are cycled; no recolour.

## Data flow

```
hover  → highlight cue
click  → read bbox + style → position/style overlay → focus + select
type   → (overlay only; SVG not re-rendered)
commit → applyEdit() writes sl[...] → renderPreview() + thumb + sidebar sync → hide overlay
logo click → cycle sl.logo → renderPreview() + thumb → tooltip
```

The data model (`deck` array of slide objects, `cur` index) is unchanged, so share-links,
PNG/PDF/PPTX export, and the sidebar editor all keep working with no migration.

## Edge cases / error handling

- **Switching slides or exporting while editing:** commit (or cancel) the open overlay
  first; overlay is always hidden before export so it is never captured.
- **Cleared field:** falls back to the existing empty/placeholder behaviour rather than
  rendering a broken slide (e.g. an empty kicker already renders as nothing).
- **Window resize while editing:** commit and close the overlay (positions would otherwise
  drift); the user can re-click to continue.
- **Coordinate scaling:** position comes from the live `getBoundingClientRect`, so no manual
  viewBox math is needed for placement; font-size is scaled by rendered-width / 1280.

## Testing

- Each of the 8 layouts: every editable region opens, edits, and commits, and the SVG
  updates to match.
- Bidirectional sync: an inline edit updates the sidebar field, and vice versa.
- Multi-line (body / bullets): newlines preserved on commit.
- Stats: sub-field write-back reconstructs `value,label` correctly per index.
- Logo: cycles through all three states on a slide that shows the logo.
- Export stays clean: PNG export of an edited slide contains no overlay artefacts.
