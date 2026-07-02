# Deck Studio agent log

## 2026-07-02 · Background variants, Effra-first PPTX fonts, deploy whitelist

**Task:** Shea's brief after reviewing the regeneration reference deck: add all background
variant options, use Effra with Segoe UI as fallback for PowerPoint export, build straight
into the live site. Case study and team headshot templates deliberately parked for later.

**Shipped (commit 322d8ec, live on deck-studio-snowy.vercel.app):**
- Per-slide Background control (Flat / Gradient / Circles) on cover, section, chart,
  statement, stat, quote, closing. Flat keeps the ring motif; gradient and circles replace it.
  Gradient uses the sector deep tone; circles are the big translucent discs from the
  creative decks. "Cycle background style" added to the command palette.
- PPTX export: variant backgrounds ship as full-bleed JPEG background images (text stays
  native and editable, 6-slide deck ~250KB). Flat stays a native rectangle.
- PPTX fonts: Export-menu toggle, Effra default, Segoe UI fallback (persisted `ds-ppt-font`).
- `.vercelignore` whitelist: docs/ was publicly served on production before this; now 404.

**Verified:** all three styles render in preview and rail thumbs; autosave and share links
carry bgStyle; PPTX builds in both font modes with correct fontFace on every text box; live
URL serves the new build, library assets, and vendor bundle; docs URL 404s.

**Decisions:**
- White content layouts intentionally keep white backgrounds (matches the reference deck).
- Reference PDF lives at `docs/reference/` locally only; gitignored (client content, 22MB).
- Starter deck showcases the variants: cover=circles, closing=gradient.

**Open:**
- Effra licence / team install question with Viv and Connor (Shea asking 2026-07-03).
  Until resolved, testers without Effra should flip the export toggle to Segoe UI.
- Case study + team headshot layouts next (Shea to brief).
- Round-trip PPTX test on a team Windows machine with real PowerPoint still worth one hour
  with Alex before wider rollout.

## 2026-07-02 (later) · Image UX overhaul merged and shipped

**Task:** Shea flagged that the image problems he'd raised were still unsolved. Audit found
the approved image UX overhaul (2026-07-01 design) and Phase 2 multi-image grids were fully
built on `worktree-library-graphics-images` but never merged or pushed. Live site never had them.

**Shipped (merge commit 639d51c, live):** image inspector with universal photo selection,
context-aware Backspace/Escape, library search + My uploads (IndexedDB) + free placement,
swap control, Three/Four image grids, Side-by-side/Stacked toggle. Merged cleanly with the
background-variants and font-toggle work from earlier today.

**Verified:** branch's own Playwright harness ALL PASS on merged build; backgrounds, font
toggle, grids, PPTX export (Effra stamped, 382KB with grid + circles cover) all rechecked;
zero console errors; live URL serves the new build.

**Lesson recorded:** Deck Studio accumulates finished-but-unpushed sibling branches. Start of
any session: `git log --oneline --all --graph | head` and reconcile before building.

**Open:** worktree can be removed once Shea confirms; Effra licence question; case study +
team headshot templates; photography section of the library still empty pending Viv/Connor.
