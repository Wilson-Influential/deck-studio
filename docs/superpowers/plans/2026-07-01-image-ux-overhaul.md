# Image UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Deck Studio one coherent image inspector (select any photo → all controls in the right panel), context-aware destructive keys, and a Library you can search, add your own assets to, and place freely.

**Architecture:** Single self-contained file `index.html` (~2217 lines, inline `<script>`). No build step, no test runner. All state is in-memory JS (`deck[]`, `cur`, `selectedPhoto`, `selectedGraphicId`) plus IndexedDB for user uploads. Slides render to SVG via per-layout `L.render()` → `buildSVG()`. The right panel is rebuilt wholesale by `renderEditor()`; the canvas by `renderPreview()`; both via `renderAll()`.

**Tech Stack:** Vanilla JS + inline SVG, IndexedDB (uploads persistence), Playwright with `channel:'chrome'` for verification.

## Global Constraints

- Work only in the worktree `.claude/worktrees/library-graphics-images/`, branch `worktree-library-graphics-images`. Serve with `python3 -m http.server 4250` (already running).
- No test suite. Verify every task via headless Chrome (Playwright, `channel:'chrome'` per the reference); **every check must log `errors: []`** (zero console errors) plus the task's specific assertions before you commit.
- Do not touch export (`exportSlidePNG`/`exportPPTX`/`printPDF`) or share-link code. Cut/out-of-scope, never build: zoom-within-frame, rounded photo corners, alt text, caption-text field, graphic templates.
- Brand: selection outline uses `BRAND.navy`. Non-modal side panels only (no scrim/blur on the inspector) — it lives inside the existing `#editor` panel.
- Copy is plain and confident, no em dashes.
- Commit after each task with a clear message. Do **not** push (Shea pushes explicitly).

## Reusable verification harness

Create this once and reuse it across tasks (adjust the `body` per task). Save as `docs/superpowers/verify/check.mjs` in the worktree.

```js
// Usage: node docs/superpowers/verify/check.mjs
import { chromium } from 'playwright';
const url = 'http://localhost:4250/';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle' });
// Deck Studio opens on the Home/library screen; open the first deck to reach the editor.
await page.evaluate(() => { if (typeof closeHome === 'function') closeHome(); if (typeof showEditor === 'function') showEditor(); });
// ---- TASK-SPECIFIC BODY GOES HERE ----
const result = await page.evaluate(async () => { /* returns an object of assertions */ return {}; });
console.log('errors:', errors);
console.log('result:', JSON.stringify(result, null, 2));
await browser.close();
```

If `closeHome()`/`showEditor()` are not the exact functions that dismiss the Home screen, open the editor by clicking the first deck card: `await page.click('.deckCard, .homeCard, [data-deck]');` — inspect the DOM first and use whatever actually reveals `#preview`. Confirm `#preview svg` exists before running assertions.

---

## File Structure

Everything lives in `index.html`. The logical regions this plan touches:

| Region | Lines (approx) | Responsibility |
|---|---|---|
| Image layout renderers | 401-527, 794-910 | emit `[data-imgslot]` cells + call `photoControlSVG` |
| `parMode` / `photoControlSVG` / `imageToolbarSVG` | 1169-1226 | crop math + on-canvas chrome (chrome to be removed) |
| `selectedPhoto` / `selectedGraphicId` state | 1177, 1188 | current selection |
| `renderEditor` | 1370-1423 | right panel; gains the Image inspector |
| `imageFieldHTML` / `graphicsEditorHTML` | 2077, 1424 | panel field builders |
| Global keydown + ACTIONS | 1701-1729 | command registry + shortcuts |
| Preview click / pointer handlers | 1952-2046 | selection, drag, drop |
| Library | 2077-2196 | load/open/render/insert + upload helpers |

---

### Task 1: Generalise selection + universal select-on-click + Image inspector (Replace / Delete image)

Make clicking any filled photo on any layout **select** it (navy outline) and swap the right panel to an Image inspector carrying Replace and Delete-image. Leave the on-canvas toolbar/dot in place for now (removed in Task 2) so no control is lost mid-plan.

**Files:**
- Modify: `index.html` — `selectedPhoto` state + read sites (~421, ~462, ~824), preview click handler (~1963-1971), image layout renderers to emit `[data-imgslot]` + outline on every cell (~401-527, ~794-910), `renderEditor` (~1370), new `imageInspectorHTML()`.
- Create: `docs/superpowers/verify/check.mjs` (harness above).

**Interfaces:**
- Produces: `selectedPhoto` now holds the **slot key string** (`'image'|'image2'|'image3'|'image4'`) or `null`. `imageInspectorHTML(sl, key)` → HTML string for the inspector. `photoSelected()` → boolean helper (`selectedPhoto!==null && deck[cur][selectedPhoto]`).

- [ ] **Step 1: Write the verification body** in `check.mjs` capturing current-broken behaviour on a multi-image layout.

```js
const result = await page.evaluate(async () => {
  // build a twoup slide with two images, select cell 2 by clicking it
  deck[cur] = { layout:'twoup', image:'data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#123"/></svg>'), image2:'data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#456"/></svg>'), title:'t' };
  renderAll();
  const cell2 = document.querySelector('#preview [data-imgslot="image2"]');
  cell2 && cell2.dispatchEvent(new MouseEvent('click', {bubbles:true}));
  return { hasCell2: !!cell2, selectedPhoto: typeof selectedPhoto!=='undefined'?selectedPhoto:'undef', inspectorPresent: !!document.querySelector('#editor [data-img-inspector]') };
};
```

- [ ] **Step 2: Run and confirm it fails.** Run: `node docs/superpowers/verify/check.mjs`. Expected before the fix: `hasCell2:false` (twoup cells have no `data-imgslot`) or `selectedPhoto` not `"image2"`, `inspectorPresent:false`.

- [ ] **Step 3: Generalise `selectedPhoto` read sites.** In the three renderers that draw the selection control, replace the hardcoded `selectedPhoto==='image'` with a per-cell key match. For `imageTextSide` (~421):

  Find: `if(interactive && c.image && selectedPhoto==='image') s+=photoControlSVG('image',imgX,0,imgW,H,c);`
  Replace: `if(interactive && c.image && selectedPhoto==='image') s+=photoControlSVG('image',imgX,0,imgW,H,c);` *(unchanged — its key is `image`)*.

  The real work: the twoup/imagestack/grid renderers (~465-527, ~870-910) currently draw each cell with no `data-imgslot` and never call `photoControlSVG`. In each cell's `<image>` output add `data-imgslot="<cellKey>"` and, when interactive, append the selection outline for the selected cell. Add a shared helper near `photoRect` (~1227):

```js
// selection outline for any photo cell on any layout (interactive only)
function cellOutlineSVG(key,x,y,w,h){
  if(!(typeof selectedPhoto!=='undefined') || selectedPhoto!==key) return '';
  return `<rect x="${(x+1).toFixed(1)}" y="${(y+1).toFixed(1)}" width="${(w-2).toFixed(1)}" height="${(h-2).toFixed(1)}" fill="none" stroke="${BRAND.navy}" stroke-width="2.5" opacity="0.85" pointer-events="none"/>`;
}
```

  In the twoup renderer (~880) where each `[key,img,cx,capKey,cap]` cell is drawn, ensure the cell `<image>`/`<rect>` carries `data-imgslot="${key}"` and append `cellOutlineSVG(key, cx, top, colW, colH)` (use that renderer's real x/y/w/h variable names). Do the same for `imagestack`, `imagegrid3`, `imagegrid4`, and `screenshot` cells. (For the single-photo layouts the existing `photoControlSVG` already draws the outline; leave them.)

- [ ] **Step 4: Fix the preview click handler** (~1963-1971) so a filled cell selects instead of replacing.

  Find the `const slot=e.target.closest('[data-imgslot]');` block and replace its body with:

```js
  const slot=e.target.closest('[data-imgslot]');
  if(slot){
    const key=slot.dataset.imgslot;
    if(deck[cur][key]){                       // filled cell: SELECT it (never silently replace)
      selectedGraphicId=null; selectedPhoto=key; hideHL(); closeEditor(true);
      renderPreview(); renderEditor(); return;
    }
    hideHL(); closeEditor(true); pickImageFile(key);   // empty cell: fill it
    return;
  }
```

- [ ] **Step 5: Add `imageInspectorHTML` + wire it into `renderEditor`.** Add the helper (near `imageFieldHTML`, ~2077):

```js
function photoSelected(){ return typeof selectedPhoto!=='undefined' && selectedPhoto!==null && !!deck[cur][selectedPhoto]; }
function imageInspectorHTML(sl,key){
  return `<div data-img-inspector data-imgk="${esc(key)}">
    <h2>Image</h2>
    <div class="imgThumb" style="background-image:url(&quot;${(sl[key]||'').replace(/"/g,'&quot;')}&quot;)"></div>
    <div class="imgBtns">
      <button class="imgBtn" data-imgact="replace">Replace</button>
      <button class="imgBtn ghost" data-imgact="delimg">Delete image</button>
    </div>
    <button class="layoutTrigger" data-img-deselect><span class="cur">Back to slide</span><span class="chg">Esc</span></button>
  </div>`;
}
```

  At the very top of `renderEditor` (~1371), branch to the inspector when a photo is selected:

```js
function renderEditor(){
  const e=document.getElementById('editor'); const sl=deck[cur]; const L=LAYOUT_BY[sl.layout];
  if(photoSelected()){
    e.innerHTML=imageInspectorHTML(sl, selectedPhoto);
    e.querySelector('[data-imgact="replace"]').onclick=()=>pickImageFile(selectedPhoto);
    e.querySelector('[data-imgact="delimg"]').onclick=()=>{ delete deck[cur][selectedPhoto]; selectedPhoto=null; renderAll(); saveDraftSoon(); commitHistorySoon(); };
    e.querySelector('[data-img-deselect]').onclick=()=>{ selectedPhoto=null; renderPreview(); renderEditor(); };
    return;
  }
  // ...existing slide-fields body unchanged...
```

- [ ] **Step 6: Update the verification body** to assert the fixed behaviour: after clicking cell2, `selectedPhoto==='image2'`, `inspectorPresent:true`, and the inspector has Replace + Delete-image buttons; then click Delete-image and assert `deck[cur].image2` is gone but `deck[cur].image` and `deck[cur].title` remain.

- [ ] **Step 7: Run verification.** Run: `node docs/superpowers/verify/check.mjs`. Expected: `errors: []`, `selectedPhoto:"image2"`, `inspectorPresent:true`, delete-image removes only that cell.

- [ ] **Step 8: Commit.**

```bash
git add index.html docs/superpowers/verify/check.mjs
git commit -m "feat(deck): universal photo selection + image inspector (Replace/Delete image)"
```

---

### Task 2: Move arrangement / Cover-Fit / 3x3 focus into the inspector, remove on-canvas chrome

Relocate every remaining photo control into the inspector, then delete the floating toolbar and focal dot from the canvas.

**Files:**
- Modify: `index.html` — `imageInspectorHTML` (add arrangement + fit + focus pad), `photoControlSVG` (~1190, strip to outline only), delete `imageToolbarSVG` (~1208-1226), preview click handler (remove `[data-arrange]`/`[data-fit]`/`[data-focal]` branches ~1954-1960), pointer handlers (remove focal drag ~2020-2027 and focal pointermove).
- Add CSS for `.focusPad` (near existing `.imgBtns` styles).

**Interfaces:**
- Consumes: `photoSelected()`, `selectedPhoto`, `imageInspectorHTML` from Task 1.
- Produces: inspector fully owns arrangement/fit/focus; canvas shows only the selection outline.

- [ ] **Step 1: Extend `imageInspectorHTML`.** Insert, before the deselect button, arrangement (single-photo layouts only), Cover/Fit, and a 3x3 focus pad (Cover only):

```js
  const single=['imagetext','imageright','imagecaption','image'].includes(sl.layout);
  const fit=(sl.fit||'cover');
  const arrange = single ? `<h2>Arrangement</h2><div class="layoutGrid" data-arrange-grid>`+
    [['imagetext','Left'],['imageright','Right'],['imagecaption','Caption'],['image','Full']].map(([id,lb])=>
      `<button class="${sl.layout===id?'on':''}" data-arrange="${id}">${lb}</button>`).join('')+`</div>` : '';
  const fitRow = `<h2>Crop</h2><div class="layoutGrid" data-fit-grid>`+
    [['cover','Cover'],['contain','Fit']].map(([v,lb])=>`<button class="${fit===v?'on':''}" data-fit="${v}">${lb}</button>`).join('')+`</div>`;
  const fx=sl.focusX==null?0.5:+sl.focusX, fy=sl.focusY==null?0.5:+sl.focusY;
  const cell=(gx,gy)=>{ const on=Math.abs(fx-gx)<0.01 && Math.abs(fy-gy)<0.01; return `<button class="focusCell${on?' on':''}" data-fx="${gx}" data-fy="${gy}"></button>`; };
  const focusPad = fit==='cover' ? `<h2>Focus</h2><div class="focusPad">`+
    [0.17,0.5,0.83].map(gy=>[0.17,0.5,0.83].map(gx=>cell(gx,gy)).join('')).join('')+`</div>` : '';
```

  and interpolate `${arrange}${fitRow}${focusPad}` into the returned template between the `imgBtns` div and the deselect button.

- [ ] **Step 2: Wire the new controls in `renderEditor`'s inspector branch** (added Task 1). After the existing three handlers:

```js
    e.querySelectorAll('[data-arrange]').forEach(b=>b.onclick=()=>{ deck[cur].layout=b.dataset.arrange; renderAll(); saveDraftSoon(); commitHistorySoon(); });
    e.querySelectorAll('[data-fit]').forEach(b=>b.onclick=()=>{ deck[cur].fit=b.dataset.fit; renderAll(); saveDraftSoon(); commitHistorySoon(); });
    e.querySelectorAll('[data-fx]').forEach(b=>b.onclick=()=>{ deck[cur].focusX=+b.dataset.fx; deck[cur].focusY=+b.dataset.fy; renderAll(); saveDraftSoon(); commitHistorySoon(); });
```

- [ ] **Step 3: Add `.focusPad` CSS** (near `.imgBtns`):

```css
.focusPad{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;width:120px;aspect-ratio:16/9;margin:2px 0 10px}
.focusPad .focusCell{border:1.5px solid rgba(11,30,45,.22);background:transparent;border-radius:4px;cursor:pointer;padding:0}
.focusPad .focusCell.on{background:var(--navy,#0b1e2d);border-color:var(--navy,#0b1e2d)}
```

  (Use the project's real navy CSS var if one exists; otherwise `BRAND.navy` value hardcoded to match.)

- [ ] **Step 4: Strip the canvas chrome.** In `photoControlSVG` (~1190) delete the focal-dot block (~1196-1202) and the `s+=imageToolbarSVG(c);` line; the function returns only the outline `rect`. Delete `imageToolbarSVG` entirely (~1208-1226). In the preview click handler remove the `[data-arrange]` (~1954-1956), `[data-fit]` (~1957-1959) and `[data-focal]` (~1960) branches. In the pointerdown handler remove the `focal` branch (~2020-2027) and in pointermove remove the `mode:'focal'` case. Remove `[data-fit],[data-arrange]` from the deselect-guard selector at ~2044 (keep `[data-imgslot]`).

- [ ] **Step 5: Verification body** — build an `imagetext` slide, select the photo, assert the inspector contains arrangement + fit + a 9-cell focus pad; click `[data-arrange="image"]` and assert `deck[cur].layout==='image'`; click `[data-fx="0.17"][data-fy="0.17"]` and assert `deck[cur].focusX===0.17`; assert **no** `[data-focal]` and no floating toolbar (`imageToolbarSVG` symbol removed: `typeof imageToolbarSVG === 'undefined'`).

- [ ] **Step 6: Run.** Expected: `errors: []`, all assertions true, `typeof imageToolbarSVG === 'undefined'`.

- [ ] **Step 7: Commit.**

```bash
git add index.html
git commit -m "feat(deck): move arrangement/fit/focus into inspector, remove on-canvas toolbar + focal dot"
```

---

### Task 3: Multi-image cell inspector — Swap control

For `twoup`/`imagestack`/`imagegrid3`/`imagegrid4`, the selected cell's inspector shows Replace + Delete image + **Swap** (exchange this cell's image and caption with an adjacent cell). Cover/Fit + focus pad already apply per cell from Task 2; arrangement already hidden for non-single layouts.

**Files:**
- Modify: `index.html` — `imageInspectorHTML` (add Swap when layout is multi-image), `renderEditor` inspector branch (wire Swap), a `swapCells(a,b)` helper.

**Interfaces:**
- Consumes: `selectedPhoto`, `imageInspectorHTML`.
- Produces: `swapCells(keyA,keyB)` swaps `deck[cur][keyA]`↔`[keyB]` and the paired caption keys.

- [ ] **Step 1: Add cell metadata + `swapCells`.** Add near `photoRect`:

```js
// ordered image cells + their caption keys per multi-image layout
const MULTI_CELLS={ twoup:[['image','capA'],['image2','capB']], imagestack:[['image','capA'],['image2','capB']],
  imagegrid3:[['image','capA'],['image2','capB'],['image3','capC']], imagegrid4:[['image','capA'],['image2','capB'],['image3','capC'],['image4','capD']] };
function swapCells(sl, ia, ib){
  const cells=MULTI_CELLS[sl.layout]; if(!cells||!cells[ia]||!cells[ib]) return;
  const [ka,ca]=cells[ia], [kb,cb]=cells[ib];
  [sl[ka],sl[kb]]=[sl[kb],sl[ka]]; [sl[ca],sl[cb]]=[sl[cb],sl[ca]];
}
```

  (Confirm the real caption keys for grid3/grid4 from their layout `fields` before finalising; `twoup`/`imagestack` use `capA`/`capB` per line 871/893.)

- [ ] **Step 2: Add Swap buttons to the inspector** when `MULTI_CELLS[sl.layout]` exists. In `imageInspectorHTML`, compute the selected cell's index and offer swap with each other cell:

```js
  const cells=MULTI_CELLS[sl.layout];
  let swap='';
  if(cells){ const i=cells.findIndex(c=>c[0]===key);
    swap=`<h2>Swap with</h2><div class="layoutGrid" data-swap-grid>`+
      cells.map((c,j)=> j===i?'' : `<button data-swap="${j}">Cell ${j+1}</button>`).join('')+`</div>`; }
```

  interpolate `${swap}` before the deselect button.

- [ ] **Step 3: Wire Swap** in the inspector branch of `renderEditor`:

```js
    e.querySelectorAll('[data-swap]').forEach(b=>b.onclick=()=>{ const cells=MULTI_CELLS[deck[cur].layout]; const i=cells.findIndex(c=>c[0]===selectedPhoto); swapCells(deck[cur], i, +b.dataset.swap); renderAll(); saveDraftSoon(); commitHistorySoon(); });
```

- [ ] **Step 4: Verification body** — twoup with distinct `image`/`image2` and `capA`/`capB`; select `image`; click `[data-swap="1"]`; assert `image`/`image2` and `capA`/`capB` exchanged.

- [ ] **Step 5: Run.** Expected: `errors: []`, values swapped.

- [ ] **Step 6: Commit.**

```bash
git add index.html
git commit -m "feat(deck): swap control for multi-image cells"
```

---

### Task 4: Context-aware keyboard

Backspace/Delete and Escape respect the current selection; ⌘K gains Remove image + Deselect.

**Files:**
- Modify: `index.html` — global `keydown` (~1717-1729), `ACTIONS` (~1701).

**Interfaces:**
- Consumes: `selectedPhoto`, `selectedGraphicId`, `deleteSlide`, `photoSelected`.
- Produces: `removeSelectedImage()`, `deselectAll()` helpers used by keys + ACTIONS.

- [ ] **Step 1: Add helpers** near `deleteSlide`:

```js
function deselectAll(){ selectedPhoto=null; selectedGraphicId=null; renderPreview(); renderEditor(); }
function removeSelectedImage(){ if(photoSelected()){ delete deck[cur][selectedPhoto]; selectedPhoto=null; renderAll(); saveDraftSoon(); commitHistorySoon(); return true; } return false; }
function removeSelectedGraphic(){ if(selectedGraphicId){ const sl=deck[cur]; sl.graphics=slideGraphics(sl).filter(g=>g.id!==selectedGraphicId); selectedGraphicId=null; renderAll(); saveDraftSoon(); commitHistorySoon(); return true; } return false; }
```

- [ ] **Step 2: Rewrite the Backspace/Delete line** (~1728):

  Find: `if(e.key==='Backspace'||e.key==='Delete'){ deleteSlide(cur); return; }`
  Replace: `if(e.key==='Backspace'||e.key==='Delete'){ if(removeSelectedImage()||removeSelectedGraphic()){ return; } deleteSlide(cur); return; }`

- [ ] **Step 3: Make Escape deselect first** (~1724). Change the Escape branch so that when something is selected it deselects and stops, else runs today's close-panels logic:

  Find: `if(e.key==='Escape'){ setExportMenu(false); closeLibrary(); closeVersions(); closeHome(); if(typeof closePalette==='function') closePalette(); if(typeof closeLayoutChooser==='function') closeLayoutChooser(); return; }`
  Replace: prepend `if(selectedPhoto!==null||selectedGraphicId!==null){ deselectAll(); return; } ` inside the branch before `setExportMenu(false)`.

- [ ] **Step 4: Add ACTIONS entries** (~1715, before the closing `]`):

```js
  {id:'rmimg',   label:'Remove selected image', hint:'⌫', run:()=>{ if(!removeSelectedImage()) toast('No image selected'); }},
  {id:'deselect',label:'Deselect',              hint:'Esc',run:()=>deselectAll()},
```

- [ ] **Step 5: Verification body** — (a) select a photo, dispatch `keydown` Backspace on `document`, assert photo removed and slide count unchanged; (b) with nothing selected, note `deck.length`, dispatch Backspace, assert `deck.length` decreased; (c) select a photo, dispatch Escape, assert `selectedPhoto===null`. Dispatch via `document.dispatchEvent(new KeyboardEvent('keydown',{key:'Backspace'}))` with focus not on an input.

- [ ] **Step 6: Run.** Expected: `errors: []`, all three assertions true.

- [ ] **Step 7: Commit.**

```bash
git add index.html
git commit -m "feat(deck): context-aware Backspace/Escape + palette entries"
```

---

### Task 5: Library search

A search box filtering all categories by asset/category name.

**Files:**
- Modify: `index.html` — `renderLibrary` (~2143), library state (~2128 add `libQuery`).

**Interfaces:**
- Consumes: `LIB`, `renderLibrary`.
- Produces: `libQuery` string state; when non-empty, grid shows cross-category matches.

- [ ] **Step 1: Add `libQuery` state** (~2128): `let LIB=null, libTargetKey='image', libCat=null, libPanelEl=null, libQuery='';`

- [ ] **Step 2: Add a search input to `renderLibrary`** just after `libHead`:

```js
  h+=`<div class="libSearch"><input type="search" placeholder="Search assets" value="${esc(libQuery)}" data-lib-search></div>`;
```

- [ ] **Step 3: Filter.** Replace the `const assets=LIB.assets.filter(a=>a.category===libCat);` line so that when `libQuery` is set it matches across categories:

```js
  const q=libQuery.trim().toLowerCase();
  const catName=id=>((LIB.categories||[]).find(c=>c.id===id)||{}).name||'';
  const assets = q
    ? LIB.assets.filter(a=>((a.name||'')+' '+catName(a.category)).toLowerCase().includes(q))
    : LIB.assets.filter(a=>a.category===libCat);
```

  And hide/mute the category tabs when `q` is present (optional: add class). Wire the input near the other handlers:

```js
  const si=p.querySelector('[data-lib-search]');
  if(si) si.oninput=()=>{ libQuery=si.value; const pos=si.selectionStart; renderLibrary(); const ni=libPanelEl.querySelector('[data-lib-search]'); if(ni){ ni.focus(); try{ni.setSelectionRange(pos,pos);}catch(_){} } };
```

- [ ] **Step 4: Add `.libSearch` CSS** (near `.libTabs`), input full-width, matching panel styling.

- [ ] **Step 5: Verification body** — open the library (`openLibrary('image')`), set `libQuery` to a term you know exists in `library.json` (read the file first to pick one), `renderLibrary()`, assert the rendered `.libItem` count matches the expected filtered count and that items from more than one category can appear. If `library.json` is empty in the worktree, seed `LIB` in-page for the test.

- [ ] **Step 6: Run.** Expected: `errors: []`, filtered grid correct, search box retains focus after typing (assert `document.activeElement` has `data-lib-search`).

- [ ] **Step 7: Commit.**

```bash
git add index.html
git commit -m "feat(deck): library search across categories"
```

---

### Task 6: My uploads — IndexedDB persistence

Every uploaded/dropped image auto-saves to a personal, persisted "My uploads" section with per-item remove.

**Files:**
- Modify: `index.html` — new IndexedDB module, `pickImageFile`/`dropImageFile` to also save, `renderLibrary` to show the My uploads section, `loadLibrary`/`init` to open the DB.

**Interfaces:**
- Produces: `idbAddUpload({data,name})`, `idbAllUploads()` → `Promise<[{id,name,data,ts}]>`, `idbDeleteUpload(id)`, in-memory cache `MY_UPLOADS` (array, newest first).

- [ ] **Step 1: Add the IndexedDB module** (near the library section):

```js
const IDB_NAME='deckstudio', IDB_STORE='uploads'; let _idb=null, MY_UPLOADS=[];
function idbOpen(){ return _idb?Promise.resolve(_idb):new Promise((res,rej)=>{ const r=indexedDB.open(IDB_NAME,1);
  r.onupgradeneeded=()=>{ const db=r.result; if(!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE,{keyPath:'id'}); };
  r.onsuccess=()=>{ _idb=r.result; res(_idb); }; r.onerror=()=>rej(r.error); }); }
function idbTx(mode){ return idbOpen().then(db=>db.transaction(IDB_STORE,mode).objectStore(IDB_STORE)); }
async function idbAddUpload({data,name}){ const rec={id:makeId(),name:name||'Upload',data,ts:Date.now()}; const st=await idbTx('readwrite'); await new Promise((res,rej)=>{ const q=st.add(rec); q.onsuccess=res; q.onerror=()=>rej(q.error); }); MY_UPLOADS.unshift(rec); return rec; }
async function idbAllUploads(){ const st=await idbTx('readonly'); return new Promise((res,rej)=>{ const q=st.getAll(); q.onsuccess=()=>res((q.result||[]).sort((a,b)=>b.ts-a.ts)); q.onerror=()=>rej(q.error); }); }
async function idbDeleteUpload(id){ const st=await idbTx('readwrite'); await new Promise((res,rej)=>{ const q=st.delete(id); q.onsuccess=res; q.onerror=()=>rej(q.error); }); MY_UPLOADS=MY_UPLOADS.filter(u=>u.id!==id); }
```

- [ ] **Step 2: Auto-save on upload/drop.** In `pickImageFile` (~2090) after `deck[cur][key]=await fileToDataURL(f);` add `idbAddUpload({data:deck[cur][key],name:f.name}).catch(()=>{});`. Do the same in `dropImageFile` (~2100).

- [ ] **Step 3: Load uploads on init.** In the `init` IIFE (~2198) after `await loadLibrary();` add `try{ MY_UPLOADS=await idbAllUploads(); }catch(e){}`.

- [ ] **Step 4: Render the My uploads section** at the top of the library grid in `renderLibrary` (before team assets), only when `MY_UPLOADS.length`:

```js
  if(MY_UPLOADS.length && !libQuery){ h+=`<div class="libSection">My uploads</div><div class="libGrid">`+
    MY_UPLOADS.map(u=>`<div class="libItem" data-upload="${esc(u.id)}"><div class="libThumb"><img src="${esc(u.data)}" alt="${esc(u.name)}" loading="lazy"></div><div class="nm">${esc(u.name)}</div><button class="libDel" data-updel="${esc(u.id)}" title="Remove">✕</button></div>`).join('')+
    `</div><div class="libSection">Brand library</div>`; }
```

  Wire clicks: `data-upload` inserts that upload (reuse the insert path from Task 7 / current `insertLibraryAsset` data path — for now fill `libTargetKey`); `data-updel` calls `idbDeleteUpload(id).then(renderLibrary)`. When `libQuery` is set, also include uploads whose name matches in the filtered results.

- [ ] **Step 5: Verification body** — call `await idbAddUpload({data:'data:image/svg+xml;base64,'+btoa('<svg xmlns=\"http://www.w3.org/2000/svg\"/>'),name:'probe'})`; `openLibrary('image'); renderLibrary();` assert a `[data-upload]` item with name `probe` renders. Then `await idbAllUploads()` in a fresh reload (second `page.reload()`), assert the probe persists. Clean up with `idbDeleteUpload` at the end.

- [ ] **Step 6: Run.** Expected: `errors: []`, upload renders and survives reload, delete removes it.

- [ ] **Step 7: Commit.**

```bash
git add index.html
git commit -m "feat(deck): My uploads persisted in IndexedDB"
```

---

### Task 7: Free placement — click fills selected cell, drag places anywhere

Decouple asset insertion from a pre-chosen slot: clicking an asset fills the selected cell (or primary slot / free graphic); dragging an asset onto a cell places it there.

**Files:**
- Modify: `index.html` — `insertLibraryAsset` (~2163) to target `selectedPhoto` when set, `renderLibrary` to make `.libItem`/`[data-upload]` draggable, preview drop handler (~2008) to accept asset drags, a small drag payload protocol.

**Interfaces:**
- Consumes: `selectedPhoto`, `insertLibraryAsset`, `assetToDataURL`, `MY_UPLOADS`.
- Produces: drag data-transfer key `application/x-deck-asset` carrying `{kind:'lib'|'upload', id}`; `placeAssetIntoCell(payload, key)`.

- [ ] **Step 1: Target the selected cell on click.** In `insertLibraryAsset` (~2163), before the graphic/photo branch, compute the destination: `const dest = (typeof selectedPhoto!=='undefined' && selectedPhoto) ? selectedPhoto : libTargetKey;` and use `dest` where the photo path currently writes `deck[cur][libTargetKey]`. (Graphic assets still drop as free-floating graphics as today.) Add an equivalent path for uploads: `placeAssetIntoCell` that accepts a data URL and writes it to `dest`.

```js
async function placeAssetIntoCell(dataUrl,key){ deck[cur][key]=dataUrl; renderAll(); saveDraftSoon(); commitHistorySoon(); }
```

- [ ] **Step 2: Make library items draggable.** In `renderLibrary`, add `draggable="true"` to `.libItem` and `[data-upload]` items, and on `dragstart` set:

```js
  p.querySelectorAll('[data-asset],[data-upload]').forEach(el=>{
    el.setAttribute('draggable','true');
    el.addEventListener('dragstart',ev=>{ const kind=el.dataset.upload?'upload':'lib'; const id=el.dataset.upload||el.dataset.asset;
      ev.dataTransfer.setData('application/x-deck-asset', JSON.stringify({kind,id})); ev.dataTransfer.effectAllowed='copy'; });
  });
```

- [ ] **Step 3: Accept asset drags on the preview.** Extend the preview `dragover` (~2006) to also allow when the drag carries `application/x-deck-asset`, and the `drop` handler (~2008) to branch: if the drop has an asset payload, resolve it to a data URL (`assetToDataURL(libAsset.src)` for `lib`, `MY_UPLOADS.find(...).data` for `upload`) and call `placeAssetIntoCell(dataUrl, key)` where `key` is the dropped cell's `[data-imgslot]` (or the layout's primary image key, reusing the existing empty-slide→imagetext/image logic). Guard: `ev.dataTransfer.types.includes('application/x-deck-asset')`.

- [ ] **Step 4: Verification body** — (a) select cell `image2` on a twoup; call `insertLibraryAsset(<known-lib-id>)`; assert the new data URL landed in `deck[cur].image2`, not `image`. (b) Simulate a drop: build a `DataTransfer`-like payload in-page is awkward; instead unit-test `placeAssetIntoCell('data:...','image')` directly and assert `deck[cur].image` updated + `renderAll` ran without error. (c) Assert `.libItem` elements have `draggable==='true'`.

- [ ] **Step 5: Run.** Expected: `errors: []`, click fills the selected cell, `placeAssetIntoCell` works, items draggable.

- [ ] **Step 6: Commit.**

```bash
git add index.html
git commit -m "feat(deck): free asset placement — click fills selected cell, drag to place"
```

---

## Final verification (after all tasks)

- [ ] Run the full manual pass from the spec's Verification section on :4250 with a real screenshot for Shea of: (1) a selected photo showing the inspector, (2) the clean canvas (no dot/toolbar), (3) the reworked Library with search + My uploads.
- [ ] Confirm export still clean: export one slide to PNG headless and assert no console errors and a non-empty data URL.
- [ ] Report the flagged judgement call to Shea: arrangement moved off-canvas into the inspector. Do not push; hand Shea the merge/push decision.

## Self-Review notes

- Spec Unit A (inspector, universal select, remove chrome, multi-image, cut extras) → Tasks 1-3. ✓
- Spec Unit B (keyboard) → Task 4. ✓
- Spec Unit C (search / My uploads / free placement) → Tasks 5-7. ✓
- Type consistency: `selectedPhoto` holds a slot-key string everywhere from Task 1; `photoSelected()`, `removeSelectedImage()`, `placeAssetIntoCell()`, `MULTI_CELLS`, `swapCells()`, `idb*` names are used consistently across tasks.
- Caption keys **verified against the layout `fields`** (index.html ~897-904): grid3 = `image/image2/image3` + `capA/capB/capC`; grid4 = `image/image2/image3/image4` + `capA/capB/capC/capD`. `MULTI_CELLS` in Task 3 is correct as written.
