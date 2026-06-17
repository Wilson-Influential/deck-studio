# Deck Studio

> Internal tool. Build an on-brand 16:9 slide deck, export the whole thing to PDF (or any slide as PNG).
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
- Right: layout picker (8 layouts), content fields that adapt per layout, and a deck-wide colour
  (sector accent) picker.
- Export: **Export deck (PDF)** uses the browser's own print-to-PDF with a custom 16:9 @page, one
  slide per page (offline, no library, matches the HTML→PDF workflow). **This slide** / per-slide
  link exports a single slide as a full-res 1280×720 PNG.
- Loads with a 6-slide starter deck so it's alive on open.

## Layouts (8)

Cover, Section divider, Statement, Bullets, Stats (row of up to 3 "value, label" figures),
Two columns, Quote, Closing/contact. Light content slides (Bullets, Two columns on white) alternate
with dark statement/stat/quote slides for rhythm. Page-number footer on content slides.

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

Built and locally verified (all 8 layouts, slide ops, PNG export, PDF build path). NOT deployed
(deploy routes permission-gated). Delivered to Shea as the self-contained file. Open if it goes
further: a true PPTX export for clients (needs a library, so not offline — the [HTML internal /
PowerPoint external] split applies), per-slide colour override, and an image-placeholder layout.
Launch config: `deck-studio` (port 4190).
