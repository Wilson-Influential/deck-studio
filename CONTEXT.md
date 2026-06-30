# Deck Studio

> Internal tool. Build an on-brand 16:9 slide deck, export the whole thing to PDF or PPTX (or any slide as PNG).
> Built 2026-06-17 (same evening as Post Studio v2). Self-contained single HTML file.
> Sibling product to [Post Studio](../Post%20Studio/) — shares the same SVG brand engine.

## Why it's separate from Post Studio

Post Studio's model is "one piece of copy → variations of a single post." A deck is the opposite
shape: a *sequence* of different slides telling one story, exported as one file. Forcing decks into
the post tool would weaken both, so this is its own product. They share the engine (brand system,
SVG rendering, type fitting, sphere/motif, PNG export) so they feel like a family.

## What it does

- Left rail: the slide list. Add, duplicate, reorder (↑/↓), delete. Click to select. Live thumbnails.
- Centre: large live 16:9 preview of the selected slide. Arrow keys move between slides.
- Right: layout picker (16 layouts), content fields that adapt per layout, and a deck-wide colour
  (sector accent) picker.
- Home/library: local deck browser for opening saved decks, creating a new deck, and deleting old
  drafts. Decks are stored in this browser's local storage, not a shared server.
- Export menu: **Deck as PDF** uses the browser's own print-to-PDF with a custom 16:9 @page, one
  slide per page (offline, no library, matches the HTML→PDF workflow). **Deck as PPTX** uses the
  browser `pptxgenjs` bundle and exports native PowerPoint text boxes, shapes, logos, and placed
  images so decks are editable after export. **This slide as PNG** exports a single slide as a
  2560×1440 PNG for sharper sharing and reuse. **Copy share link** copies the current deck state.
- Autosaves the current deck in the browser, so a normal refresh restores the last draft. Shared
  links still take priority when the URL contains a deck payload.
- Undo/redo protects normal editing mistakes without opening up freeform slide design.
- Per-slide speaker notes are stored with the deck and exported into PowerPoint notes.
- Local version history lets Shea save restore points before larger edits.
- Per-slide review comments support lightweight feedback. Open comments are added to PowerPoint
  notes during PPTX export because native PPT comments need a heavier collaboration layer.
- Loads with a 6-slide starter deck so it's alive on open.

## Layouts (16)

Cover, Section divider, Agenda, Table, Comparison, Chart, Statement, Bullets, Stats (row of up to 3
"value, label" figures), Two columns, Quote, Closing/contact, Image, Image + text, Screenshot, Two
images. Light content slides (Bullets, Two columns, Table, Comparison on white) alternate with dark
statement/stat/chart/quote slides for rhythm. Page-number footer on content slides.

## Logo toggle + ring (2026-06-17, Shea's round 2)

- Per-slide **Logo** control: Main logo / Ring mark / Off. "Ring mark" uses the brand ring (the
  Secondary Icon). No "wordmark" option: the ring IS the "i" of the logo (the wordmark alone reads
  "nfluential"), so a text-only wordmark isn't a clean brand asset.
- Removed the duplicate "INFLUENTIAL" footer text (the logo already carries the brand); footer is
  now just the page number.
- All decorative spheres replaced with the brand ring (thick annulus, inner/outer 0.59). Reusable
  ring + colour assets live in `Assets/logos/ring/`.

## Same engine notes as Post Studio

SVG at native res → crisp preview + exact PNG export (verified canvas not tainted by the embedded
base64 logos). Type keyed to min(W,H); body auto-clamps. Brand-locked colours, the brand ring, real
logos embedded. Effra renders on the Mac and in export; system-font fallback elsewhere.

## Status

Built and locally verified (all layouts, slide ops, browser autosave/refresh restore, high-res PNG
export, PDF build path, editable PPTX export path).
NOT deployed (deploy routes permission-gated). Delivered to Shea as the self-contained file. Open if
it goes further: per-slide colour override and richer PowerPoint image crop parity.
Launch config: `deck-studio` (port 4190).

## Latest Product Direction (2026-06-29)

Viv and Connor reviewed the product with Shea. The key goal is to make Deck Studio "Jane proof":
simple enough for non-designers to make useful decks quickly, while keeping the Influential brand
hard to break.

Next priorities:

- Expand templates around real agency needs: graphs, costings, timings, Excel-style tables, pie and
  bar charts, copy-heavy pages, case studies, and three to six person team headshot pages.
- Build a searchable asset library for imagery, custom icons, headshots, and brand scribbles.
- Keep PowerPoint export strong, and explore Figma or Illustrator handoff for creative users.
- Expand testing beyond Alex to Chris Humes, Karen, Duncan, and other frequent deck builders once
  the next template pass is ready.
- Keep the tool internal-brand only until stable. Multi-client brand swapping comes later.

## Asset library update (2026-06-29)

Imported the Studio illustration pack from `OneDrive_1_29-06-2026.zip`.

- PNG assets live in `library-assets/studio-2026-06/`.
- `library.json` now exposes **Graphics** and **Illustrations** categories alongside the
  existing brand shapes, icons, logos, and photography tabs.
- Only Studio-ready PNG files are exposed in the app.

## Notion-features merge (2026-06-30) — NEXT UP

Shea reviewed a Notion-style reimagining of the whole tool (`../The Deck Notion UX Reimagine/the-deck-reimagined.html`) and decided NOT to switch: the team prefers this familiar, PowerPoint-like, legible design. Instead, graft four ideas onto the current tool. Plan is ready to execute:

**`docs/plans/2026-06-30-notion-features-merge.md`** — 4 tasks:
1. Remove review comments (speaker notes becomes the single annotation surface).
2. Shared `ACTIONS` registry + expanded keyboard shortcuts.
3. ⌘K command palette (Shea's favourite — reads from `ACTIONS`).
4. Replace the flat 16-button layout grid with a visual grouped layout chooser (live previews, grouped by intent).

Parked deliberately (do NOT build): story-outline rail, inline-edit-on-slide, mode indicator, Deck Health, the prototype's aesthetic. Keep the current look and type sizes.

Detailed notes:

- Meeting notes: `docs/meetings/2026-06-29-viv-connor-deck-studio-notes.md`
- Roadmap: `docs/roadmap/2026-06-29-deck-studio-roadmap.md`
