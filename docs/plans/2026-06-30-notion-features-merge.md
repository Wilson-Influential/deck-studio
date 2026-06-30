# Deck Studio — Notion Features Merge: Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. There is no automated test suite — this is a single self-contained HTML file. Each task's "verify" step is a concrete manual check in the running app. Do them; don't skip them.

**Goal:** Graft four ideas from the Notion-style prototype onto the existing, familiar Deck Studio without changing its PowerPoint-like feel: a ⌘K command palette, fuller keyboard shortcuts, removal of review comments, and a visual grouped layout chooser to replace the flat 16-button grid.

**Architecture:** Deck Studio is one file: `Internal/Deck Studio/index.html` (~1812 lines). State is a global `deck` array of slide objects `{layout, ...fields, logo, notes, graphics}` with `cur` as the selected index. `renderAll()` redraws rail + preview + editor. Layouts live in the `LAYOUTS` array (each `{id, name, fields, render}`), looked up via `LAYOUT_BY`. We add a single shared `ACTIONS` registry that both the keyboard handler and the ⌘K palette read from (DRY), extract slide ops into named functions so they can be called from anywhere, delete the comments feature, and swap the layout `<button>` grid for a popover of live SVG previews grouped by intent.

**Tech Stack:** Vanilla JS, inline SVG slide rendering, `pptxgenjs` (already bundled) for PPTX, browser print-to-PDF. No build step, no framework, no dependencies to add.

## How to run / verify

- Start the server: launch config **`deck-studio`** (python http.server, port **4190**), serving `Internal/Deck Studio`. Open `http://localhost:4190/index.html`.
- Reference for the *feel* of ⌘K and the grouped chooser: the prototype at `Internal/The Deck Notion UX Reimagine/the-deck-reimagined.html` (launch config `deck-reimagined`, port 4196). Borrow interaction patterns, NOT the visual design — Deck Studio keeps its own look.
- After each task, hard-reload (python http.server serves a stale file sometimes; append `?v=N` to the URL to bust cache if an edit doesn't show).

## Global Constraints

- **Single file only.** All changes go in `Internal/Deck Studio/index.html`. Do not add files, dependencies, or a build step.
- **Keep the current visual design.** The team prefers the familiar, legible, PowerPoint-like layout. Do not shrink type, restyle the panels, or import the prototype's aesthetic. New UI (palette, chooser popover) must match Deck Studio's existing styles (`--navy #201747`, `--soft`, `--line`, the `.btn`/`.layoutGrid` look, Effra font).
- **Brand stays locked.** Do not add freeform colour/position controls. Sector accents and layouts remain fixed.
- **No native dialogs.** Never use `confirm()`/`alert()`. Destructive actions happen immediately; rely on the existing undo (Cmd+Z) as the safety net.
- **Don't break existing decks.** Old saved decks may carry a `comments` array on slides; stop reading/writing/showing it, but don't crash on its presence.
- **Commits local only.** Commit after each task with the message shown. Do NOT `git push` — pushing is Shea's explicit call.

---

### Task 1: Remove review comments (Speaker notes becomes the single annotation surface)

**Why:** Shea: "I don't think I need comments. Remove comments. Speaker notes, yeah, we need." Notes stays and remains the only feedback/annotation surface; it still exports into PPTX notes.

**Files:**
- Modify: `Internal/Deck Studio/index.html` (CSS ~195-202; `renderEditor` 1136 + wiring 1165-1166; functions `commentSectionHTML`/`addComment`/`resolveComment` 1192-1209; `unresolvedComments` 350; `pptNotesFor` 1237-1243)

- [ ] **Step 1: Remove the comments render call.** In `renderEditor` delete line 1136:

```js
  h+=commentSectionHTML(sl);
```

(Leave the Speaker notes block at 1134-1135 exactly as-is — that stays.)

- [ ] **Step 2: Remove the comment event wiring.** In `renderEditor` delete lines 1165-1166:

```js
  e.querySelector('#addComment')?.addEventListener('click',()=>addComment());
  e.querySelectorAll('[data-resolve-comment]').forEach(b=>b.onclick=()=>resolveComment(b.dataset.resolveComment));
```

- [ ] **Step 3: Delete the three comment functions** (1192-1209): `commentSectionHTML`, `addComment`, `resolveComment` in their entirety.

- [ ] **Step 4: Delete `unresolvedComments`** (line 350):

```js
function unresolvedComments(slide){ return (slide.comments||[]).filter(c=>!c.done&&c.text&&c.text.trim()); }
```

- [ ] **Step 5: Strip comments out of `pptNotesFor`.** Replace the function (1237-1243) with:

```js
function pptNotesFor(sl){
  return (sl.notes||'').trim();
}
```

- [ ] **Step 6: Remove the comment CSS.** In the style block (~195-202) remove `.commentRow`, `.commentComposer`, `.commentComposer input`, `.commentComposer button` selectors. Where a selector is shared with versions (e.g. `.versionRow,.commentRow{...}`), keep the `.versionRow` part and drop only the `.commentRow` half. Do not touch any `.version*` styling.

- [ ] **Step 7: Verify.** Reload `http://localhost:4190/index.html`. In the right editor panel: Speaker notes is present, "Review comments" / "Add a comment" is gone. Type a note, export PPTX, open the .pptx, confirm the note text is in the slide's notes and there is no "Open Deck Studio comments" block. Search the file for `comment` (case-insensitive) and confirm only incidental matches remain (no functions, no calls, no UI).

- [ ] **Step 8: Commit.**

```bash
git add "Internal/Deck Studio/index.html"
git commit -m "Remove review comments; speaker notes is the single annotation surface"
```

---

### Task 2: Shared action registry + expanded keyboard shortcuts

**Why:** Shea wants real keyboard shortcuts for power users. This task also builds the `ACTIONS` registry that Task 3's ⌘K palette reuses, so the two never drift apart.

**Files:**
- Modify: `Internal/Deck Studio/index.html` (extract slide ops near 1054 & 1095-1098; add `ACTIONS` + extend keydown near 1473-1478)

**Interfaces:**
- Produces: `addSlideAfter(i)`, `duplicateSlide(i)`, `deleteSlide(i)`, `gotoSlide(i)`, and a global `const ACTIONS = [...]` where each entry is `{id, label, hint, run}` (`hint` is the human-readable shortcut string, e.g. `"N"`, `"⌘K"`; `run` is a zero-arg function). Task 3 renders the palette directly from `ACTIONS`.

- [ ] **Step 1: Extract slide-op functions.** Add these near the other slide helpers (just above `moveSlide` at line 1084). They centralise the logic currently inlined in the rail "Add slide" handler (1054) and the action dispatcher (1097-1098):

```js
function addSlideAfter(i){
  deck.splice(i+1,0,{layout:'bullets',title:'New slide',body:'Your first point\nYour second point'});
  cur=i+1; renderAll(); saveDraftSoon(); commitHistorySoon();
}
function duplicateSlide(i){
  deck.splice(i+1,0,JSON.parse(JSON.stringify(deck[i]))); cur=i+1; renderAll(); saveDraftSoon(); commitHistorySoon();
}
function deleteSlide(i){
  if(deck.length<2) return;
  deck.splice(i,1); cur=Math.max(0,Math.min(cur,deck.length-1)); renderAll(); saveDraftSoon(); commitHistorySoon();
}
function gotoSlide(i){ cur=Math.max(0,Math.min(deck.length-1,i)); renderAll(); }
```

- [ ] **Step 2: Point the rail "Add slide" button at the new function.** At line 1054, replace the inline body:

```js
  add.innerHTML='+ Add slide'; add.onclick=()=>{ deck.splice(cur+1,0,{layout:'bullets',title:'New slide',body:'Your first point\nYour second point'}); cur++; renderAll(); };
```

with:

```js
  add.innerHTML='+ Add slide'; add.onclick=()=>addSlideAfter(cur);
```

- [ ] **Step 3: Point the action dispatcher at the new functions.** At lines 1097-1098, replace:

```js
  else if(a==='dup'){ deck.splice(i+1,0,JSON.parse(JSON.stringify(deck[i]))); cur=i+1; }
  else if(a==='del'&&deck.length>1){ deck.splice(i,1); cur=Math.max(0,Math.min(cur,deck.length-1)); }
```

with:

```js
  else if(a==='dup'){ duplicateSlide(i); return; }
  else if(a==='del'){ deleteSlide(i); return; }
```

(Verify the surrounding function still calls `renderAll()` for the remaining branches; the `dup`/`del` branches now self-render, hence the `return`.)

- [ ] **Step 4: Add the ACTIONS registry.** Place this just above the `document.addEventListener('keydown',...)` handler at line 1473. Every entry maps to a function that already exists in the file (`exportPPTX`, `copyShareLink`, `exportSlidePNG`, `showVersions`, `showHome`, `saveVersion`, `undoDeck`, `redoDeck`) or one added in Step 1. For "Export PDF", reuse the same path the export menu uses — confirm the exact function name at line ~1439 (it ends in `window.print()`); if it is an inline handler, wrap it as `function exportPDF(){ ...existing body... }` and call that from both the menu and here.

```js
const ACTIONS = [
  {id:'new',     label:'New slide',            hint:'N',   run:()=>addSlideAfter(cur)},
  {id:'dup',     label:'Duplicate slide',      hint:'⌘D',  run:()=>duplicateSlide(cur)},
  {id:'del',     label:'Delete slide',         hint:'⌫',   run:()=>deleteSlide(cur)},
  {id:'next',    label:'Next slide',           hint:'↓',   run:()=>gotoSlide(cur+1)},
  {id:'prev',    label:'Previous slide',       hint:'↑',   run:()=>gotoSlide(cur-1)},
  {id:'pdf',     label:'Export deck as PDF',   hint:'',    run:()=>exportPDF()},
  {id:'pptx',    label:'Export editable PowerPoint', hint:'', run:()=>exportPPTX()},
  {id:'png',     label:'Export this slide as PNG',   hint:'', run:()=>exportSlidePNG(cur)},
  {id:'link',    label:'Copy share link',      hint:'',    run:()=>copyShareLink()},
  {id:'version', label:'Save a version',       hint:'',    run:()=>saveVersion()},
  {id:'versions',label:'Open version history', hint:'',    run:()=>showVersions()},
  {id:'home',    label:'Open deck library',    hint:'',    run:()=>showHome()},
  {id:'undo',    label:'Undo',                 hint:'⌘Z',  run:()=>undoDeck()},
  {id:'redo',    label:'Redo',                 hint:'⇧⌘Z', run:()=>redoDeck()},
];
```

- [ ] **Step 5: Extend the keydown handler.** Replace the handler at 1473-1478 with the version below. Note: the `⌘K` and `⌘Z/⌘Y` branches are moved ABOVE the input/textarea guard so they work even while a field is focused; the single-letter shortcuts (`n`) stay below the guard so they don't fire mid-typing. `openPalette` is added in Task 3 — guard its call with `typeof` so this task runs standalone.

```js
document.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if((e.metaKey||e.ctrlKey) && k==='k'){ e.preventDefault(); if(typeof openPalette==='function') openPalette(); return; }
  if((e.metaKey||e.ctrlKey) && k==='z'){ e.preventDefault(); e.shiftKey?redoDeck():undoDeck(); return; }
  if((e.metaKey||e.ctrlKey) && k==='y'){ e.preventDefault(); redoDeck(); return; }
  if((e.metaKey||e.ctrlKey) && k==='d'){ e.preventDefault(); duplicateSlide(cur); return; }
  if(e.target.matches('input,textarea')) return;
  if(e.key==='Escape'){ setExportMenu(false); closeLibrary(); closeVersions(); closeHome(); if(typeof closePalette==='function') closePalette(); return; }
  if(e.key==='ArrowDown'||e.key==='ArrowRight'){ gotoSlide(cur+1); return; }
  if(e.key==='ArrowUp'||e.key==='ArrowLeft'){ gotoSlide(cur-1); return; }
  if(k==='n'){ addSlideAfter(cur); return; }
  if(e.key==='Backspace'||e.key==='Delete'){ deleteSlide(cur); return; }
});
```

- [ ] **Step 6: Verify.** Reload. With NO field focused: press `n` (new slide added after current), `⌘D` (duplicates), arrows (navigate), `Backspace` (deletes, but never below 1 slide), `⌘Z` (undoes the delete). Click into the Title field and confirm typing `n` types the letter (doesn't add a slide) while `⌘D` still duplicates. Confirm the rail "+ Add slide" button and the per-slide duplicate/delete buttons still work.

- [ ] **Step 7: Commit.**

```bash
git add "Internal/Deck Studio/index.html"
git commit -m "Add slide-op functions, ACTIONS registry, and expanded keyboard shortcuts"
```

---

### Task 3: ⌘K command palette

**Why:** Shea's favourite feature: "Command K to bring up the search so you can quickly do stuff from your keyboard... PowerPoint doesn't have it." Reads straight from the `ACTIONS` registry built in Task 2.

**Files:**
- Modify: `Internal/Deck Studio/index.html` (add palette DOM near the other overlays in `<body>`; add CSS in the style block; add `openPalette`/`closePalette`/render/filter JS)

**Interfaces:**
- Consumes: `ACTIONS` (Task 2).
- Produces: `openPalette()`, `closePalette()` (referenced by the keydown handler from Task 2).

- [ ] **Step 1: Add the palette DOM.** Just before `</body>`, add:

```html
<div id="paletteScrim" class="paletteScrim"></div>
<div id="palette" class="palette" role="dialog" aria-label="Command palette">
  <input id="paletteInput" placeholder="Type a command…" autocomplete="off" spellcheck="false">
  <div id="paletteList" class="paletteList"></div>
</div>
```

- [ ] **Step 2: Add the CSS** (in the main style block; match Deck Studio's existing tokens — navy, soft, line, Effra):

```css
.paletteScrim{position:fixed;inset:0;background:rgba(32,23,71,.22);z-index:90;display:none}
.paletteScrim.on{display:block}
.palette{position:fixed;z-index:91;top:14vh;left:50%;transform:translateX(-50%);width:min(540px,92vw);
  background:#fff;border:1.5px solid var(--line);border-radius:14px;box-shadow:0 24px 70px rgba(32,23,71,.28);
  overflow:hidden;display:none;font-family:inherit}
.palette.on{display:block}
.palette input{width:100%;border:0;border-bottom:1.5px solid var(--line);padding:15px 16px;font:inherit;
  font-size:15px;color:var(--navy);outline:none}
.paletteList{max-height:340px;overflow-y:auto;padding:6px}
.paletteItem{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;cursor:pointer}
.paletteItem.sel{background:var(--soft)}
.paletteItem .lab{font-size:13.5px;font-weight:800;color:var(--navy)}
.paletteItem .hint{margin-left:auto;font-size:11px;font-weight:900;color:var(--charcoal);
  border:1.5px solid var(--line);border-radius:6px;padding:2px 7px}
.paletteEmpty{padding:18px;text-align:center;color:var(--charcoal);font-size:13px}
```

- [ ] **Step 3: Add the palette JS** (place near the keydown handler / Task 2 code):

```js
let palSel=0, palFiltered=[];
function openPalette(){
  document.getElementById('paletteScrim').classList.add('on');
  document.getElementById('palette').classList.add('on');
  const inp=document.getElementById('paletteInput');
  inp.value=''; palSel=0; renderPalette(''); setTimeout(()=>inp.focus(),0);
}
function closePalette(){
  document.getElementById('paletteScrim').classList.remove('on');
  document.getElementById('palette').classList.remove('on');
}
function renderPalette(q){
  q=(q||'').toLowerCase().trim();
  palFiltered = q ? ACTIONS.filter(a=>a.label.toLowerCase().includes(q)) : ACTIONS.slice();
  if(palSel>=palFiltered.length) palSel=Math.max(0,palFiltered.length-1);
  const list=document.getElementById('paletteList');
  if(!palFiltered.length){ list.innerHTML='<div class="paletteEmpty">No command found.</div>'; return; }
  list.innerHTML=palFiltered.map((a,i)=>
    `<div class="paletteItem${i===palSel?' sel':''}" data-i="${i}">
       <span class="lab">${a.label}</span>${a.hint?`<span class="hint">${a.hint}</span>`:''}
     </div>`).join('');
  list.querySelectorAll('.paletteItem').forEach(el=>{
    el.onmouseenter=()=>{ palSel=+el.dataset.i; highlightPalette(); };
    el.onclick=()=>runPalette(+el.dataset.i);
  });
}
function highlightPalette(){
  document.querySelectorAll('#paletteList .paletteItem').forEach(el=>el.classList.toggle('sel',+el.dataset.i===palSel));
}
function runPalette(i){ const a=palFiltered[i]; if(!a) return; closePalette(); a.run(); }
document.getElementById('paletteScrim').onclick=closePalette;
document.getElementById('paletteInput').addEventListener('input',e=>{ palSel=0; renderPalette(e.target.value); });
document.getElementById('paletteInput').addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'){ e.preventDefault(); palSel=Math.min(palFiltered.length-1,palSel+1); highlightPalette(); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); palSel=Math.max(0,palSel-1); highlightPalette(); }
  else if(e.key==='Enter'){ e.preventDefault(); runPalette(palSel); }
  else if(e.key==='Escape'){ e.preventDefault(); closePalette(); }
});
```

- [ ] **Step 4: Verify.** Reload. Press `⌘K` → palette opens, input focused, all 14 actions listed. Type `pdf` → filters to "Export deck as PDF"; press Enter → palette closes and the PDF print path fires. `⌘K` again, ArrowDown twice, Enter → runs the third item. Esc closes. Click the dim background → closes. Confirm `⌘K` opens the palette even while the Title field is focused.

- [ ] **Step 5: Commit.**

```bash
git add "Internal/Deck Studio/index.html"
git commit -m "Add Cmd-K command palette driven by the ACTIONS registry"
```

---

### Task 4: Visual grouped layout chooser (replace the flat 16-button grid)

**Why:** Shea: "rethink the slide selection button so we can choose three different styles. We need a better way." Decision: a **better layout chooser** — a visual, grouped picker with small live previews chosen by intent, replacing the flat list of 16 named buttons. Keeps all existing layouts; only the picking UX changes.

**Files:**
- Modify: `Internal/Deck Studio/index.html` (`renderEditor` layout block 1116-1117 + wiring 1139; add `LAYOUT_GROUPS`, chooser popover DOM/CSS/JS)

**Interfaces:**
- Consumes: `LAYOUTS`, `LAYOUT_BY`, `buildSVG`, global `deck`/`cur`, `renderAll`.
- Produces: `openLayoutChooser()`, `closeLayoutChooser()`, `layoutPreviewSVG(layoutId)`.

- [ ] **Step 1: Define intent groups.** Add near `LAYOUT_BY` (line 745). The ids are the 16 existing layout ids; group them by the moment they serve:

```js
const LAYOUT_GROUPS = [
  {name:'Open',          ids:['cover','section','agenda']},
  {name:'Make the case', ids:['bullets','statement','stat','chart','comparison','columns','quote','table']},
  {name:'Show',          ids:['image','imagetext','screenshot','twoup']},
  {name:'Close',         ids:['closing']},
];
```

(If any id here does not exist in `LAYOUTS`, fix the id to match the real one in the `LAYOUTS` array — do not invent layouts. Confirm every `LAYOUTS[i].id` appears in exactly one group.)

- [ ] **Step 2: Add a small-preview helper.** Renders the *current slide's content* in a candidate layout, so previews are live, not generic. Place near `buildSVG`:

```js
function layoutPreviewSVG(layoutId){
  const clone=JSON.parse(JSON.stringify(deck[cur]));
  clone.layout=layoutId;
  return buildSVG(clone); // returns a full <svg ...> string at native size; CSS scales it down
}
```

- [ ] **Step 3: Replace the layout grid in `renderEditor`.** Swap lines 1116-1117:

```js
  let h=`<h2>Layout</h2><div class="layoutGrid">`;
  LAYOUTS.forEach(l=>{ h+=`<button class="${l.id===sl.layout?'on':''}" data-l="${l.id}">${l.name}</button>`; });
  h+=`</div><h2>Content</h2>`;
```

with a single trigger button that opens the chooser:

```js
  let h=`<h2>Layout</h2>
    <button id="layoutTrigger" class="layoutTrigger">
      <span class="cur">${L.name}</span><span class="chg">Change ›</span>
    </button>
    <h2>Content</h2>`;
```

- [ ] **Step 4: Update the wiring in `renderEditor`.** The old wiring at line 1139 was:

```js
  e.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{ sl.layout=b.dataset.l; renderAll(); });
```

Replace it with the trigger binding (the `[data-l]` clicks now live inside the chooser popover, wired in Step 6):

```js
  e.querySelector('#layoutTrigger')?.addEventListener('click',openLayoutChooser);
```

- [ ] **Step 5: Add chooser DOM** before `</body>`:

```html
<div id="chooserScrim" class="paletteScrim"></div>
<div id="layoutChooser" class="layoutChooser" role="dialog" aria-label="Choose a layout">
  <div class="lcHead"><b>Choose a layout</b><input id="lcSearch" placeholder="Search by name…" autocomplete="off"></div>
  <div id="lcBody" class="lcBody"></div>
</div>
```

- [ ] **Step 6: Add chooser CSS + JS.** CSS (reuse `.paletteScrim` from Task 3 for the backdrop):

```css
.layoutTrigger{display:flex;align-items:center;justify-content:space-between;width:100%;
  border:1.5px solid var(--line);border-radius:10px;background:var(--soft);color:var(--navy);
  font:inherit;font-weight:900;font-size:13px;padding:11px 13px;cursor:pointer;transition:.12s}
.layoutTrigger:hover{border-color:#cfc9e0}
.layoutTrigger .chg{color:var(--charcoal);font-size:12px}
.layoutChooser{position:fixed;z-index:91;top:9vh;left:50%;transform:translateX(-50%);width:min(760px,94vw);
  max-height:82vh;background:#fff;border:1.5px solid var(--line);border-radius:16px;
  box-shadow:0 24px 70px rgba(32,23,71,.28);overflow:hidden;display:none;flex-direction:column}
.layoutChooser.on{display:flex}
.lcHead{display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1.5px solid var(--line)}
.lcHead b{font-size:15px;color:var(--navy)}
.lcHead input{flex:1;border:1.5px solid var(--line);border-radius:9px;padding:8px 11px;font:inherit;font-size:13px;color:var(--navy);outline:none}
.lcBody{overflow-y:auto;padding:14px 16px}
.lcGroup{font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--charcoal);margin:12px 2px 8px}
.lcGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.lcCard{border:1.5px solid var(--line);border-radius:11px;overflow:hidden;cursor:pointer;background:#fff;transition:.12s}
.lcCard:hover{border-color:#cfc9e0;transform:translateY(-2px)}
.lcCard.on{border-color:var(--navy);box-shadow:0 0 0 2px var(--navy)}
.lcCard .thumb{aspect-ratio:16/9;background:var(--soft);display:block}
.lcCard .thumb svg{width:100%;height:100%;display:block}
.lcCard .nm{padding:7px 10px;font-size:12px;font-weight:900;color:var(--navy)}
```

JS (place near the palette JS):

```js
function openLayoutChooser(){
  document.getElementById('chooserScrim').classList.add('on');
  const box=document.getElementById('layoutChooser'); box.classList.add('on');
  document.getElementById('lcSearch').value=''; renderChooser(''); 
  setTimeout(()=>document.getElementById('lcSearch').focus(),0);
}
function closeLayoutChooser(){
  document.getElementById('chooserScrim').classList.remove('on');
  document.getElementById('layoutChooser').classList.remove('on');
}
function renderChooser(q){
  q=(q||'').toLowerCase().trim();
  const cur_l=deck[cur].layout; let h='';
  LAYOUT_GROUPS.forEach(g=>{
    const items=g.ids
      .map(id=>LAYOUT_BY[id]).filter(Boolean)
      .filter(l=>!q || l.name.toLowerCase().includes(q));
    if(!items.length) return;
    h+=`<div class="lcGroup">${g.name}</div><div class="lcGrid">`;
    items.forEach(l=>{
      h+=`<div class="lcCard${l.id===cur_l?' on':''}" data-pick="${l.id}">
            <div class="thumb">${layoutPreviewSVG(l.id)}</div>
            <div class="nm">${l.name}</div>
          </div>`;
    });
    h+=`</div>`;
  });
  const body=document.getElementById('lcBody');
  body.innerHTML = h || '<div class="paletteEmpty">No layout matches that.</div>';
  body.querySelectorAll('[data-pick]').forEach(el=>el.onclick=()=>{
    deck[cur].layout=el.dataset.pick; closeLayoutChooser(); renderAll(); saveDraftSoon(); commitHistorySoon();
  });
}
document.getElementById('chooserScrim').onclick=closeLayoutChooser;
document.getElementById('lcSearch').addEventListener('input',e=>renderChooser(e.target.value));
document.getElementById('lcSearch').addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.preventDefault(); closeLayoutChooser(); } });
```

- [ ] **Step 7: Verify.** Reload. The right panel now shows a single "Layout: [current] · Change ›" button instead of 16 buttons. Click it → chooser opens with four labelled groups (Open / Make the case / Show / Close), each card showing a real preview of the current slide's content in that layout, current layout highlighted. Pick a different one → chooser closes, the main preview re-renders in the new layout, content preserved. Type in the search → filters cards. Confirm all 16 layouts appear across the groups (count them) and none are missing. Confirm `⌘Z` undoes a layout change.

- [ ] **Step 8: Commit.**

```bash
git add "Internal/Deck Studio/index.html"
git commit -m "Replace flat layout grid with visual grouped layout chooser"
```

---

## Explicitly NOT in scope (parked from the prototype)

Do not pull these over — Shea reviewed the prototype and chose to leave them, because they push Deck Studio away from the familiar PowerPoint feel the team wants:

- The story-outline left rail (Deck Studio keeps its thumbnail slide list).
- Inline click-to-edit text on the slide preview (keep the right-panel content fields).
- Inferred "mode" indicator (Drafting / Shaping / Ready).
- Deck Health checker.
- The prototype's warm/minimal aesthetic, smaller type, and any restyle of panels.

If Deck Health later proves wanted, it's a clean follow-on (a read-only pass over `deck` surfacing missing headlines / overlong slides), but it is out of scope here.

## Self-review notes

- **Coverage:** keyboard shortcuts → Task 2; ⌘K palette → Task 3; remove comments → Task 1; keep + sole-surface notes → Task 1 (notes untouched, comments removed, `pptNotesFor` simplified); rethink layout selection as a better grouped visual chooser → Task 4. All five of Shea's asks are covered.
- **Consistency:** `ACTIONS` (Task 2) is the single source for shortcuts and palette (Task 3) — no duplication. Slide ops are named functions reused by rail buttons, dispatcher, shortcuts, and palette.
- **Standalone tasks:** Task 2's keydown guards `openPalette`/`closePalette` with `typeof` so it runs and is testable before Task 3 exists. Tasks 1 and 4 are independent of each other and of 2/3.
- **One thing to confirm during Task 2:** the exact PDF-export function name around line 1439 (the `window.print()` path). If it's an inline handler, extract it to `function exportPDF(){...}` and call that from both the export menu and `ACTIONS`.
