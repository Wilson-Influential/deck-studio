# Deck Studio — Library, Graphics & Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. There is **no automated test suite** — Deck Studio is one self-contained HTML file. Each task's "verify" step is a concrete manual/headless check in the running app. Do them; don't skip them.

**Goal:** Fix the deck-library colour bug, make the asset library fast and light, replace the graphics X/Y/Size sliders with direct on-slide drag + corner-resize, and make photos look good by default (fit/focal control + smart drop), without changing Deck Studio's familiar PowerPoint-like feel.

**Architecture:** Deck Studio is one file: `Internal/Deck Studio/index.html`. State is a global `deck` array of slide objects (`{layout, ...fields, logo, notes, graphics}`) with `cur` selected. Slides render to inline SVG via `buildSVG(slide, interactive, sectorOverride)` → `LAYOUT_BY[layout].render(slide, sector, uid, interactive)`. Graphics are normalised overlays (`{id,name,src,x,y,w,ar}`) drawn by `graphicsSVG`. The shared, data-driven **Library** (`library.json` + `library-assets/`) is a non-modal side panel. Asset weight is fixed with a one-time offline script (the only new file). Everything else is edits to `index.html`.

**Tech Stack:** Vanilla JS, inline SVG, `pptxgenjs` (bundled) for PPTX, browser print-to-PDF. Plus one offline asset script using macOS built-in `sips` (no npm deps) and a tiny Node script to update `library.json`. No runtime dependencies, no build step.

## How to run / verify

- This plan is built on branch **`worktree-library-graphics-images`** in the worktree at `Internal/Deck Studio/.claude/worktrees/library-graphics-images/`. Work there. (Design spec: `docs/superpowers/specs/2026-06-30-library-graphics-images-design.md`.)
- Start a server from the worktree root: `python3 -m http.server 4250` and open `http://localhost:4250/index.html`. (Pick another port if 4250 is busy.)
- Headless verification (proven pattern, no test suite): drive the page with Playwright + system Chrome. Minimal harness:
  ```js
  // verify.mjs — run: node verify.mjs
  import { chromium } from 'playwright';
  const b = await chromium.launch({ channel:'chrome', headless:true });
  const p = await b.newPage(); const errs=[];
  p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  p.on('pageerror',e=>errs.push('PAGEERR:'+e.message));
  await p.goto('http://localhost:4250/index.html',{waitUntil:'networkidle'});
  await p.waitForTimeout(800);
  // ... per-task assertions via p.evaluate(...) ...
  console.log('errors', errs); await b.close();
  ```
  Install once in a scratch dir: `npm i playwright` (system Chrome via `channel:'chrome'`). **Every task's headless check must report `errors []`.**
- After each task, hard-reload (append `?v=N` to bust the python http.server cache if an edit doesn't show).

## Global Constraints

- **Single file for app logic.** All app changes go in `index.html`. The ONLY new files are `tools/build-library-thumbs.sh` and `tools/add-thumbs-to-library.mjs` (offline asset processing) and an updated `library-assets/README.md`. No runtime dependencies, no build step.
- **Keep the current visual design.** Familiar, legible, PowerPoint-like. Match existing tokens (`--navy #201747`, `--soft`, `--line`, `--charcoal`, Effra). Do not import any other aesthetic.
- **Brand stays locked.** No freeform colour/position controls for *photos* — they stay inside brand-locked layouts. Graphics/illustrations may be freely placed (Shea's call). No template system for graphics.
- **No native dialogs.** Never `confirm()`/`alert()`. Destructive actions happen immediately; undo (`⌘Z`) is the safety net.
- **Don't break old saved decks.** Tolerate slides missing `fit`/`focusX`/`focusY`/`graphics`. Never crash on their absence.
- **Selection/handles never export.** Graphic selection chrome and image controls render only when `interactive` is true; `buildSVG` for export passes `interactive=false`.
- **Commits local only.** Commit after each task with the message shown. Do NOT `git push` or merge — that's Shea's explicit call.

---

### Task 1: Deck-library thumbnails render in each deck's own colour

**Why:** The library shows every deck's thumbnail in the *current* deck's colour. Root cause: `renderHome` builds previews with `buildSVG(slides[0])`, and `buildSVG` paints with the global `S()`/`sectorId`, ignoring each deck's stored `payload.sector`. Opening a deck is already correct (`loadState` restores `payload.sector`); only thumbnails are wrong.

**Files:**
- Modify: `index.html` (`buildSVG` signature + its `L.render` call; `renderHome` preview line)

**Interfaces:**
- Produces: `buildSVG(slide, interactive=false, sectorOverride=null)` — when `sectorOverride` is a sector object (`{id,accent,deep,...}`) it is used instead of the global `S()`. Default behaviour unchanged.

- [ ] **Step 1: Add the `sectorOverride` parameter.** Find:

```js
function buildSVG(slide, interactive=false){
```

Replace with:

```js
function buildSVG(slide, interactive=false, sectorOverride=null){
```

- [ ] **Step 2: Use the override in the layout render.** Find:

```js
  let inner=L.render(slide, S(), uid, interactive);
```

Replace with:

```js
  let inner=L.render(slide, sectorOverride||S(), uid, interactive);
```

- [ ] **Step 3: Pass each deck's stored sector in `renderHome`.** Find:

```js
      const prev=payload&&payload.slides&&payload.slides[0]?buildSVG(payload.slides[0]):'';
```

Replace with:

```js
      const prevSector=(payload&&SECTORS.find(s=>s.id===payload.sector))||null;
      const prev=payload&&payload.slides&&payload.slides[0]?buildSVG(payload.slides[0],false,prevSector):'';
```

- [ ] **Step 4: Verify.** Reload. Create a deck, set its sector to (say) Digital green, name it "Green", save it (it autosaves). New deck (Home → + New deck), set sector to PR blue, name it "Blue". Open Home. The two cards must show **different** accent colours matching each deck. Open each deck and confirm its live colour is correct too (unchanged behaviour). Headless: render Home, assert the two cards' inline SVGs contain different accent hex values, `errors []`.

- [ ] **Step 5: Commit.**

```bash
git add index.html
git commit -m "Fix deck-library thumbnails to use each deck's saved sector colour"
```

---

### Task 2: Library weight — thumbnails + downsized originals + clean fit

**Why:** `library-assets/` is ~95 MB (studio PNGs are 6–14 MB each). The Library panel loads every full-res image in a category at once, so it's slow and the previews look bad. Placement already downscales to 1600 px, so the originals are oversized for every use.

**Files:**
- Create: `tools/build-library-thumbs.sh`, `tools/add-thumbs-to-library.mjs`
- Modify: `library.json` (adds `thumb` per raster asset — produced by the script), `index.html` (`renderLibrary` grid `img`, `.libThumb` CSS), `library-assets/README.md`

**Interfaces:**
- Produces: `library-assets/thumbs/<mirrored-path>` thumbnails; `library.json` assets gain an optional `thumb` string. Grid renders `a.thumb||a.src`; placement still uses `a.src`.

- [ ] **Step 1: Write the thumbnail/downsize script.** Create `tools/build-library-thumbs.sh`:

```bash
#!/usr/bin/env bash
# Regenerate library thumbnails + cap original sizes. macOS only (uses built-in `sips`).
# Run from the Deck Studio repo root after adding or changing assets in library-assets/.
set -euo pipefail
SRC="library-assets"
THUMBS="$SRC/thumbs"
THUMB_MAX=240
ORIG_MAX=1600
count=0
while IFS= read -r f; do
  rel="${f#"$SRC"/}"
  thumb="$THUMBS/$rel"
  mkdir -p "$(dirname "$thumb")"
  sips -Z "$ORIG_MAX" "$f" >/dev/null            # cap the original in place (longest edge)
  sips -Z "$THUMB_MAX" "$f" --out "$thumb" >/dev/null
  count=$((count+1))
done < <(find "$SRC" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) ! -path "$THUMBS/*")
echo "Processed $count raster assets. Thumbnails in $THUMBS; originals capped at ${ORIG_MAX}px."
```

- [ ] **Step 2: Write the `library.json` updater.** Create `tools/add-thumbs-to-library.mjs`:

```js
// Adds a `thumb` field (pointing at library-assets/thumbs/...) to every raster asset.
// Run from the Deck Studio repo root: node tools/add-thumbs-to-library.mjs
import fs from 'node:fs';
const path = 'library.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));
const RASTER = /\.(png|jpe?g|webp)$/i;
let n = 0;
for (const a of db.assets || []) {
  if (a.src && RASTER.test(a.src) && a.src.startsWith('library-assets/')) {
    a.thumb = a.src.replace('library-assets/', 'library-assets/thumbs/');
    n++;
  } else {
    delete a.thumb;
  }
}
fs.writeFileSync(path, JSON.stringify(db, null, 2) + '\n');
console.log(`Set thumb on ${n} raster assets.`);
```

- [ ] **Step 3: Run both scripts.**

```bash
chmod +x tools/build-library-thumbs.sh
./tools/build-library-thumbs.sh
node tools/add-thumbs-to-library.mjs
du -sh library-assets        # expect a few MB, not 95M
du -sh library-assets/thumbs # tiny
```

Expected: total `library-assets` drops to a few MB; `library-assets/thumbs/` exists with mirrored PNGs.

- [ ] **Step 4: Render thumbnails in the grid.** In `index.html`, find:

```js
  assets.forEach(a=>{ h+=`<div class="libItem" data-asset="${esc(a.id)}"><div class="libThumb"${a.bg?` style="background:${esc(a.bg)}"`:''}><img src="${esc(a.src)}" alt="${esc(a.name)}" loading="lazy"></div><div class="nm">${esc(a.name)}</div></div>`; });
```

Replace the `img src` only — use the thumbnail with a fallback to the original:

```js
  assets.forEach(a=>{ h+=`<div class="libItem" data-asset="${esc(a.id)}"><div class="libThumb"${a.bg?` style="background:${esc(a.bg)}"`:''}><img src="${esc(a.thumb||a.src)}" alt="${esc(a.name)}" loading="lazy"></div><div class="nm">${esc(a.name)}</div></div>`; });
```

(Placement is untouched — `insertLibraryAsset`/`assetToDataURL` still use `a.src`.)

- [ ] **Step 5: Confirm thumbnail fit, adjust only if cropped.** The current rule is already non-cropping:

```css
  .libThumb{aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;background:#f4f2f8;padding:14px}
  .libThumb img{max-width:92%;max-height:92%;display:block;object-fit:contain}
```

Load the Library, open Graphics and Illustrations, screenshot. If any thumbnail looks cropped or cramped, change `.libThumb` padding to `10px` and `.libThumb img` to `max-width:100%;max-height:100%`. If they look centred and whole, leave the CSS unchanged. (No crop is expected with `object-fit:contain`; this step is a visual confirmation.)

- [ ] **Step 6: Document the team workflow.** Append to `library-assets/README.md`:

```markdown

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
```

- [ ] **Step 7: Verify.** Reload. Open the Library → Graphics and Illustrations tabs render **fast** (no multi-second stall). Thumbnails are centred and uncropped. Click an asset to place it — it still adds correctly and exports cleanly (PNG/PPTX). Headless: open Library, switch to the `graphics` category, assert grid `img` `src` values contain `/thumbs/`, and `errors []`. Confirm `du -sh library-assets` is a few MB.

- [ ] **Step 8: Commit.**

```bash
git add tools/build-library-thumbs.sh tools/add-thumbs-to-library.mjs library.json library-assets index.html
git commit -m "Add library thumbnails + cap asset sizes; grid loads thumbs, placement uses originals"
```

---

### Task 3: Graphics — drag to move + corner-resize on the slide

**Why:** The three X/Y/Size range sliders are clunky. The live preview already draws a dashed bounding box per graphic when `interactive` is true, so the hook for direct manipulation exists. Replace the sliders with: click a graphic on the slide to select, drag to move, drag a corner handle to resize. Selection is tracked by the graphic's existing `id` (every graphic already has `{id:makeId(),...}`), so it naturally clears when you switch slides.

**Files:**
- Modify: `index.html` (`graphicsSVG` rewrite + `graphicRect` helper + `selectedGraphicId` state; `graphicsEditorHTML` slider removal + row-select; replace `[data-graphic-range]` wiring; add preview pointer handlers near `previewEl`; add CSS for `.graphicRow.sel`)

**Interfaces:**
- Consumes: `slideGraphics(slide)`, global `deck`/`cur`, `W`/`H`, `BRAND`, `esc`, `renderPreview`, `renderEditor`, `renderRailThumb`, `saveDraftSoon`, `commitHistorySoon`, the `previewEl` element.
- Produces: `let selectedGraphicId=null`, `graphicRect(g)` → `{x,y,gw,gh}` (pixel rect mirroring the render math), `findGraphicById(id)`. `graphicsSVG` now draws selection chrome + a `[data-graphic-handle]` corner and tags each image `[data-graphic-img]` when interactive.

- [ ] **Step 1: Add selection state + a shared rect helper.** Find:

```js
function slideGraphics(slide){ return Array.isArray(slide.graphics) ? slide.graphics : []; }
```

Replace with:

```js
function slideGraphics(slide){ return Array.isArray(slide.graphics) ? slide.graphics : []; }
let selectedGraphicId=null;
function graphicRect(g){
  const gw=Math.max(24, Math.min(W, (+g.w||0.18)*W));
  const ar=Math.max(0.1, Math.min(8, +g.ar||1));
  const gh=gw/ar;
  const x=Math.max(0, Math.min(W-gw, (+g.x||0.08)*W));
  const y=Math.max(0, Math.min(H-gh, (+g.y||0.08)*H));
  return {x,y,gw,gh};
}
function findGraphicById(id){ return slideGraphics(deck[cur]).find(g=>g.id===id); }
```

- [ ] **Step 2: Rewrite `graphicsSVG` to draw selection chrome + handle.** Find the whole function:

```js
function graphicsSVG(slide,interactive=false){
  const items=slideGraphics(slide);
  if(!items.length) return '';
  return items.map(g=>{
    const gw=Math.max(24, Math.min(W, (+g.w||0.18)*W));
    const ar=Math.max(0.1, Math.min(8, +g.ar||1));
    const gh=gw/ar;
    const x=Math.max(0, Math.min(W-gw, (+g.x||0.08)*W));
    const y=Math.max(0, Math.min(H-gh, (+g.y||0.08)*H));
    const rot=+g.rot||0;
    return `<g transform="rotate(${rot.toFixed(1)} ${(x+gw/2).toFixed(1)} ${(y+gh/2).toFixed(1)})">`+
      `<image href="${g.src}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${gw.toFixed(1)}" height="${gh.toFixed(1)}" preserveAspectRatio="xMidYMid meet"/>`+
      (interactive?`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${gw.toFixed(1)}" height="${gh.toFixed(1)}" fill="none" stroke="${BRAND.navy}" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.35"/>`:'')+
      `</g>`;
  }).join('');
```

Replace with:

```js
function graphicsSVG(slide,interactive=false){
  const items=slideGraphics(slide);
  if(!items.length) return '';
  return items.map(g=>{
    const {x,y,gw,gh}=graphicRect(g);
    const rot=+g.rot||0, cx=x+gw/2, cy=y+gh/2;
    const sel=interactive && g.id && g.id===selectedGraphicId;
    let out=`<g transform="rotate(${rot.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})">`+
      `<image ${interactive?`data-graphic-img="${esc(g.id||'')}" style="cursor:move"`:''} href="${g.src}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${gw.toFixed(1)}" height="${gh.toFixed(1)}" preserveAspectRatio="xMidYMid meet"/>`;
    if(interactive){
      if(sel){
        out+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${gw.toFixed(1)}" height="${gh.toFixed(1)}" fill="none" stroke="${BRAND.navy}" stroke-width="2.5" opacity="0.9"/>`+
          `<rect data-graphic-handle="${esc(g.id||'')}" x="${(x+gw-9).toFixed(1)}" y="${(y+gh-9).toFixed(1)}" width="18" height="18" rx="3" fill="#ffffff" stroke="${BRAND.navy}" stroke-width="2.5" style="cursor:nwse-resize"/>`;
      } else {
        out+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${gw.toFixed(1)}" height="${gh.toFixed(1)}" fill="none" stroke="${BRAND.navy}" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.35"/>`;
      }
    }
    out+=`</g>`;
    return out;
  }).join('');
```

(The closing `}).join('');` and final `}` of the function stay as they are.)

- [ ] **Step 3: Remove the sliders from the graphics editor; add row-select.** Find:

```js
    graphics.forEach((g,i)=>{
      h+=`<div class="graphicRow">
        <div class="graphicTop"><img src="${g.src}" alt=""><b>${esc(g.name||'Graphic')}</b><button data-graphic-remove="${i}">Remove</button></div>
        <div class="graphicCtrls">
          <label>X <input type="range" min="0" max="0.92" step="0.01" value="${Math.max(0,Math.min(0.92,+g.x||0))}" data-graphic-index="${i}" data-graphic-range="x"></label>
          <label>Y <input type="range" min="0" max="0.9" step="0.01" value="${Math.max(0,Math.min(0.9,+g.y||0))}" data-graphic-index="${i}" data-graphic-range="y"></label>
          <label>Size <input type="range" min="0.04" max="0.55" step="0.01" value="${Math.max(0.04,Math.min(0.55,+g.w||0.18))}" data-graphic-index="${i}" data-graphic-range="w"></label>
        </div>
      </div>`;
    });
```

Replace with:

```js
    graphics.forEach((g,i)=>{
      h+=`<div class="graphicRow${g.id===selectedGraphicId?' sel':''}" data-graphic-select="${esc(g.id||'')}">
        <div class="graphicTop"><img src="${g.src}" alt=""><b>${esc(g.name||'Graphic')}</b><button data-graphic-remove="${i}">Remove</button></div>
      </div>`;
    });
    h+=`<div class="hint" style="margin:6px 0 10px">Click a graphic on the slide to select it, drag to move, and drag the corner to resize.</div>`;
```

- [ ] **Step 4: Replace the slider wiring with row-select wiring.** Find:

```js
  e.querySelectorAll('[data-graphic-range]').forEach(inp=>inp.addEventListener('input',()=>{
    const g=slideGraphics(sl)[+inp.dataset.graphicIndex]; if(!g) return;
    g[inp.dataset.graphicRange]=+inp.value;
    renderPreview(); renderRailThumb(cur); saveDraftSoon(); commitHistorySoon();
  }));
```

Replace with:

```js
  e.querySelectorAll('[data-graphic-select]').forEach(row=>row.addEventListener('click',ev=>{
    if(ev.target.closest('[data-graphic-remove]')) return;
    selectedGraphicId=row.dataset.graphicSelect||null; renderPreview(); renderEditor();
  }));
```

- [ ] **Step 5: Add the preview pointer handlers.** Find the existing preview drop wiring block (the three `previewEl.addEventListener('dragover'|'dragleave'|'drop', ...)` lines). Immediately **after** that block, add:

```js
// ----- graphics direct manipulation (select / move / corner-resize). Preview only; never exported. -----
let gDrag=null;
function slidePoint(ev){
  const svg=previewEl.querySelector('svg'); if(!svg) return null;
  const r=svg.getBoundingClientRect();
  return { x:(ev.clientX-r.left)/r.width*W, y:(ev.clientY-r.top)/r.height*H };
}
previewEl.addEventListener('pointerdown',ev=>{
  const handle=ev.target.closest('[data-graphic-handle]');
  const img=ev.target.closest('[data-graphic-img]');
  if(handle){
    selectedGraphicId=handle.dataset.graphicHandle||null;
    gDrag={mode:'resize',id:selectedGraphicId};
    try{ previewEl.setPointerCapture(ev.pointerId); }catch(e){}
    ev.preventDefault(); return;
  }
  if(img){
    selectedGraphicId=img.dataset.graphicImg||null;
    const g=findGraphicById(selectedGraphicId); if(!g) return;
    const {x,y}=graphicRect(g), p=slidePoint(ev); if(!p) return;
    gDrag={mode:'move',id:selectedGraphicId,offX:p.x-x,offY:p.y-y};
    renderPreview(); renderEditor();
    try{ previewEl.setPointerCapture(ev.pointerId); }catch(e){}
    ev.preventDefault(); return;
  }
  // clicked empty area: deselect, but let text/image/split handlers run untouched
  if(ev.target.closest('[data-edit],[data-imgslot],[data-split],[data-add-graphic]')) return;
  if(selectedGraphicId!==null){ selectedGraphicId=null; renderPreview(); renderEditor(); }
});
previewEl.addEventListener('pointermove',ev=>{
  if(!gDrag) return;
  const g=findGraphicById(gDrag.id); if(!g){ gDrag=null; return; }
  const p=slidePoint(ev); if(!p) return;
  if(gDrag.mode==='move'){
    g.x=Math.max(0, Math.min(0.999, (p.x-gDrag.offX)/W));
    g.y=Math.max(0, Math.min(0.999, (p.y-gDrag.offY)/H));
  } else {
    const {x}=graphicRect(g);
    g.w=Math.max(0.04, Math.min(0.55, (p.x-x)/W));
  }
  renderPreview();
});
function endGraphicDrag(){ if(gDrag){ gDrag=null; renderRailThumb(cur); saveDraftSoon(); commitHistorySoon(); } }
previewEl.addEventListener('pointerup',endGraphicDrag);
previewEl.addEventListener('pointercancel',endGraphicDrag);
```

- [ ] **Step 6: Add the selected-row CSS.** Find the `.graphicRow` style rule (search `.graphicRow{`). Immediately after it, add:

```css
  .graphicRow.sel{border-color:var(--navy);box-shadow:0 0 0 1.5px var(--navy)}
```

If `.graphicCtrls` style rules exist, they are now dead — leave them or delete them; they no longer render. Do not touch `.graphicRow`/`.graphicTop` base styles.

- [ ] **Step 7: Verify.** Reload. Add a graphic from the Library. (1) It appears with a dashed box. (2) Click it on the slide → solid navy box + bottom-right handle; the editor row highlights. (3) Drag the body → it moves and can't leave the slide. (4) Drag the corner handle → it resizes, aspect locked. (5) `⌘Z` once undoes the whole move (or resize) as a single step. (6) Click empty slide area → deselects. (7) Inline text editing on a text slide still works (click a `[data-edit]` field). (8) Export PNG → the graphic shows with **no** box/handle. (9) Switch to another slide and back → no stale selection. Headless: add a graphic via `insertLibraryAsset`, simulate a pointer drag, assert `g.x` changed and `errors []`.

- [ ] **Step 8: Commit.**

```bash
git add index.html
git commit -m "Replace graphics X/Y/Size sliders with on-slide drag + corner-resize"
```

---

### Task 4: Images — fit/focal control, smart drop, and a layout polish pass

**Why:** Photos use `...slice` (fill + crop) with no control over what's shown — the main reason a photo slide looks wrong. And dropping a photo onto a non-image slide does nothing. Per Shea: photos stay brand-safe inside layouts; the fix is making them look good and easy to place. The four image layouts' *visual* polish is a taste call — build it, then show Shea real screenshots before calling it done.

**Files:**
- Modify: `index.html` (add `parMode` helper; use it in the `image` and `imagetext` layout renders; widen the preview `dragover`/`drop` handlers to route drops on non-image layouts; add an inline fit/focal control on the selected photo)

**Interfaces:**
- Consumes: `W`/`H`, layout `render` functions, `currentImageKey`, `dropImageFile`, `dtHasFiles`, `previewEl`, `deck`/`cur`, `renderAll`/`renderPreview`.
- Produces: `parMode(c)` → a `preserveAspectRatio` string from `c.fit` (`'cover'` default | `'contain'`) and `c.focusX`/`c.focusY` (0–1, default 0.5). New per-slide fields `fit`/`focusX`/`focusY` are plain extra fields preserved by `loadState`'s `...sl` spread (no schema change, old decks safe).

- [ ] **Step 1: Add the `parMode` helper.** Find:

```js
function slideGraphics(slide){ return Array.isArray(slide.graphics) ? slide.graphics : []; }
```

Immediately **before** it, add:

```js
// photo crop: maps fit + focal point to an SVG preserveAspectRatio string
function parMode(c){
  if((c.fit||'cover')==='contain') return 'xMidYMid meet';
  const fx=c.focusX==null?0.5:+c.focusX, fy=c.focusY==null?0.5:+c.focusY;
  const ax=fx<0.34?'xMin':fx>0.66?'xMax':'xMid';
  const ay=fy<0.34?'YMin':fy>0.66?'YMax':'YMid';
  return ax+ay+' slice';
}
```

- [ ] **Step 2: Use `parMode` in the full-bleed `image` layout.** Find (inside the `image` layout `render`):

```js
    if(has){ s+=`<image href="${c.image}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`; }
```

Replace with:

```js
    if(has){ s+=`<image href="${c.image}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="${parMode(c)}"/>`; }
```

- [ ] **Step 3: Use `parMode` in the `imagetext` layout.** Find (inside the `imagetext` layout `render`):

```js
    if(c.image){ s+=`<image href="${c.image}" x="0" y="0" width="${imgW}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`; }
```

Replace with:

```js
    if(c.image){ s+=`<image href="${c.image}" x="0" y="0" width="${imgW}" height="${H}" preserveAspectRatio="${parMode(c)}"/>`; }
```

(Leave `screenshot` as `...meet` — it intentionally shows the whole screenshot — and leave `twoup`'s clipped `slice` as-is for v1; `parMode` covers the two layouts where focal control matters most.)

- [ ] **Step 4: Route photo drops on non-image layouts into Image + text.** Find:

```js
previewEl.addEventListener('dragover',e=>{ if(!dtHasFiles(e)||!currentImageKey()) return; e.preventDefault(); e.dataTransfer.dropEffect='copy'; previewEl.classList.add('drop'); });
```

Replace with (allow the drop hint on any slide):

```js
previewEl.addEventListener('dragover',e=>{ if(!dtHasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect='copy'; previewEl.classList.add('drop'); });
```

Then find:

```js
previewEl.addEventListener('drop',e=>{ if(!dtHasFiles(e)) return; const slot=e.target.closest('[data-imgslot]'); const key=(slot&&slot.dataset.imgslot)||currentImageKey(); if(!key) return; e.preventDefault(); previewEl.classList.remove('drop'); dropImageFile(e,key); });
```

Replace with:

```js
previewEl.addEventListener('drop',e=>{ if(!dtHasFiles(e)) return; const slot=e.target.closest('[data-imgslot]'); let key=(slot&&slot.dataset.imgslot)||currentImageKey();
  if(!key){ deck[cur].layout='imagetext'; key='image'; }   // dropped on a text slide: become Image + text, keep title/body
  e.preventDefault(); previewEl.classList.remove('drop'); dropImageFile(e,key); });
```

- [ ] **Step 5: Verify the mechanical behaviour.** Reload. (a) On an Image slide, drag a photo on → fills. (b) On a **Bullets** slide, drag a photo on → it becomes **Image + text** with the bullets preserved as body text and the photo on the left. (c) Set `deck[cur].fit='contain'` in the console → the photo letterboxes (whole image shown); back to `'cover'` → fills. (d) Set `deck[cur].focusX=0` → the crop shifts to the left edge. (e) Old deck (no fit/focus fields) still renders. Headless: `errors []`, and assert the Bullets→drop path sets `deck[cur].layout==='imagetext'`.

- [ ] **Step 6: Add an inline fit/focal control on the selected photo (then iterate live with Shea).** On an image layout, clicking the photo selects it and shows a small inline control: a **Cover / Contain** toggle and, in Cover mode, a draggable focal dot that sets `focusX`/`focusY`. Reuse the Task 3 selection/pointer machinery: tag the image-layout photo with a selectable marker and, when selected, render a compact control bar (match `--navy`/`--soft`/`--line`, no new aesthetic) plus a focal dot the user drags. Persist with `saveDraftSoon()` + `commitHistorySoon()`; the control is `interactive`-only and never exports.

  Implementation notes: the photo slots already carry `[data-imgslot]`; add a selected state for "the slide's photo" (distinct from graphics) and render the control as an HTML overlay positioned over the preview (simpler than SVG foreignObject) or as SVG chrome consistent with the graphics handle. Keep it to Cover/Contain + focal nudge — nothing more (YAGNI).

  **This step is a taste call.** When it renders, capture screenshots of all four image layouts (empty + with a sample photo, Cover and Contain) at full size and **share them with Shea for a react-and-adjust pass before considering Task 4 done.** Apply his adjustments, then re-screenshot.

- [ ] **Step 7: Verify.** Reload. Select a photo → the Cover/Contain toggle and focal dot appear; toggling and dragging update the crop live and survive reload (autosave). Controls never appear in exported PNG/PPTX/PDF. `errors []`. Shea has seen and approved the screenshots.

- [ ] **Step 8: Commit.**

```bash
git add index.html
git commit -m "Add photo fit/focal control and route image drops into Image + text"
```

---

## Explicitly NOT in scope

- No template system for graphics/illustrations (Shea: too complex; low usage).
- No freeform colour/position for **photos** — they stay inside brand-locked layouts.
- No rotation UI for graphics (the render still honours `g.rot` if added later).
- No multi-client brand swapping. Internal-brand only.

## Self-review notes

- **Spec coverage:** Unit A → Task 1; Unit B → Task 2; Unit C → Task 3; Unit D → Task 4. All four spec units map to a task.
- **Type/name consistency:** `buildSVG(slide, interactive, sectorOverride)` (Task 1) is the only signature change and is back-compatible (override defaults null; the graphics interactive call still passes 2 args). `graphicRect`, `selectedGraphicId`, `findGraphicById`, `slidePoint`, `gDrag`, `parMode` are each defined once (Tasks 3–4) and referenced consistently. Selection is keyed by the graphic's existing `id`, so it clears across slides without extra bookkeeping.
- **Old-deck safety:** new fields (`fit`/`focusX`/`focusY`) are optional and read with `==null`/`||` defaults; `graphics` already tolerated via `slideGraphics`. `loadState`'s `...sl` spread preserves unknown fields.
- **Export safety:** all selection chrome and image controls are gated on `interactive`; `buildSVG` for export passes `interactive=false`.
- **Taste gate:** Task 4 Step 6 is explicitly build-then-show-Shea, matching the spec's "iterate live" decision; the mechanical fit/drop behaviour (Steps 1–5) is fully specified and independently verifiable.
