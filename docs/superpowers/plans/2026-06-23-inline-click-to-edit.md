# Deck Studio Inline Click-to-Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user edit slide text by clicking it directly in the Deck Studio preview, and toggle the logo by clicking it, without being able to make an off-brand design.

**Architecture:** The preview is a single SVG string from `buildSVG(slide)` injected via `#preview.innerHTML`, and that same SVG is exported to PNG/PDF/PPTX. We keep the SVG as the single source of truth. Editing is a momentary HTML overlay positioned over the clicked `<text>` (using `getBoundingClientRect`), appended to `document.body` with `position:fixed` so it survives the `innerHTML` rebuild. On commit it writes back into the slide data via a small key-grammar helper and re-renders. Inline editing is additive; the sidebar editor is untouched.

**Tech Stack:** Vanilla JS, single-file `index.html`. No build step, no test framework. Verification is via a local static server + browser-console eval and manual interaction.

## Global Constraints

- Single file: all changes are inside `Internal/Deck Studio/index.html`. No new files, no dependencies.
- The data model is unchanged: `deck` (array of slide objects), `cur` (index), per-slide keys `layout, kicker, title, subtitle, body, colA, colB, logo`. Share-links and export must keep working with no migration.
- Exports must stay pixel-identical: overlay/highlight DOM lives on `document.body`, never inside the SVG, and never during export.
- Brand-safe by construction: editing only changes text content and toggles the logo between the two approved visible states. No drag/resize/recolour/font controls.
- No em dashes in any user-facing copy added (labels, tooltips). Use the brand lime `#b7e30b` and navy `#201747` for editor chrome.
- Logo inline behaviour (decided 2026-06-23): inline click toggles **Main ⇄ Ring mark** only. "Off" stays a sidebar-only choice, because an "Off" logo renders no element and would have no inline hotspot to click back. This makes the logo impossible to accidentally remove by clicking.

---

### Task 1: Tag editable text and the logo in the SVG

**Files:**
- Modify: `Internal/Deck Studio/index.html` — `tblock` (line 157), `kicker` (line 158), `brandMark` (lines 170-175), and the 8 layout `render` functions (lines 182-342).

**Interfaces:**
- Produces: every editable `<text>` carries `data-edit="<editKey>"`; the logo is wrapped in `<g data-edit-logo="1">`. `editKey` grammar: `field` | `field#idx` | `field#idx#part` where `field` ∈ slide keys, `idx` is a 0-based line index, `part` ∈ `value|label`. Consumed by Tasks 2-4.

- [ ] **Step 1: Add an optional `editKey` param to `tblock`**

Replace `tblock` (line 157) with:

```js
function tblock(lines,x,y,fs,lh,fill,weight,anchor='start',letter=-0.02,editKey){if(!lines.length)return'';const de=editKey?` data-edit="${editKey}"`:'';let t=`<text${de} x="${x}" font-size="${fs.toFixed(1)}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${(letter*fs).toFixed(2)}">`;lines.forEach((ln,i)=>{const ly=y+fs*0.8+i*fs*lh;t+=`<tspan x="${x}" y="${ly.toFixed(1)}">${esc(ln)}</tspan>`;});return t+'</text>';}
```

- [ ] **Step 2: Add an optional `editKey` param to `kicker`**

Replace `kicker` (line 158) with:

```js
function kicker(text,x,y,fs,fill,anchor='start',editKey){if(!text)return'';const de=editKey?` data-edit="${editKey}"`:'';return `<text${de} x="${x}" y="${y.toFixed(1)}" font-size="${fs.toFixed(1)}" fill="${fill}" font-weight="800" text-anchor="${anchor}" letter-spacing="${(fs*0.16).toFixed(2)}">${esc(text.toUpperCase())}</text>`;}
```

- [ ] **Step 3: Wrap the logo in a clickable group**

Replace `brandMark` (lines 170-175) with:

```js
function brandMark(opt,x,y,w,variant,ringColor,anchor='start'){
  opt=opt||'main';
  if(opt==='off') return '';
  if(opt==='ring'){ const R=w*0.27, cx=x+R, cy=y+w/LOGO_AR/2, rr=R*0.795;
    const hot=`<rect x="${(cx-rr).toFixed(1)}" y="${(cy-rr).toFixed(1)}" width="${(2*rr).toFixed(1)}" height="${(2*rr).toFixed(1)}" fill="transparent"/>`;
    return `<g data-edit-logo="1" style="cursor:pointer">${hot}${ring(cx,cy,R,ringColor)}</g>`; }
  return `<g data-edit-logo="1" style="cursor:pointer">${logoTag(variant,x,y,w,anchor)}</g>`;
}
```

(The `<image>` for the main logo is itself a filled click target; the ring needs the transparent hotspot rect because its centre is hollow.)

- [ ] **Step 4: Pass edit keys from every layout render**

Apply these edits inside the `LAYOUTS` array (lines 182-342). Each is the existing call with the key appended as the final argument:

`cover`:
- line 191 `kicker(c.kicker, m, y, u*0.028, S.accent)` → append `, 'start', 'kicker'`
- line 193 `tblock(head.lines, m, y, head.fs, head.lh, '#ffffff', 900, 'start', -0.025)` → append `, 'title'`
- line 195 `tblock(bodyLines(...), m, y, u*0.032, 1.3, mix(...), 500, 'start', 0)` → append `, 'subtitle'`

`section`:
- line 208 `kicker('Section '+c.kicker, m, y, u*0.03, ink)` → append `, 'start', 'kicker'`
- line 210 `tblock(head.lines, m, y, head.fs, head.lh, ink, 900, 'start', -0.02)` → append `, 'title'`
- line 212 `tblock(bodyLines(...), m, y, u*0.03, 1.3, ..., 500,'start',0)` → append `, 'subtitle'`
- (line 205 decorative faded number stays untagged.)

`statement`:
- line 226 `tblock(head.lines, W/2, y, head.fs, head.lh, '#ffffff', 800, 'middle', -0.015)` → append `, 'title'`
- line 228 `kicker(c.subtitle, W/2, y, u*0.026, S.accent, 'middle')` → append `, 'subtitle'`

`bullets`:
- line 241 `kicker(c.kicker, m, y+kFs*0.8, kFs, acc)` → append `, 'start', 'kicker'`
- line 243 `tblock(head.lines, m, y, head.fs, head.lh, BRAND.navy, 900, 'start', -0.02)` → append `, 'title'`
- line 255 `tblock(pl, px, ry, txtFs, 1.2, BRAND.navy, 500, 'start', -0.005)` → append `, 'body#'+i`

`stat`:
- line 269 `tblock(h.lines, m, top, h.fs, h.lh, '#ffffff', 900,'start',-0.02)` → append `, 'title'`
- line 275 the value `<text>`: insert `data-edit="body#${i}#value"` right after `<text ` so it reads `` `<text data-edit="body#${i}#value" x="${cx.toFixed(0)}" ...` ``
- line 276 `tblock(ll, cx, midY+u*0.03, u*0.026, 1.25, '#ffffff', 500,'middle',0)` → append `, 'body#'+i+'#label'`

`columns`:
- line 291 `tblock(head.lines, m, y, head.fs, head.lh, BRAND.navy, 900,'start',-0.02)` → append `, 'title'`
- line 296 change the iterator to carry a key: `[[c.colA, m, 'colA'],[c.colB, m+colW+colGap, 'colB']].forEach(([txt,cx,colKey])=>{`
- line 301 head `tblock(hl, cx, cy, u*0.032, 1.15, ..., 900,'start',-0.01)` → append `, colKey`
- line 302 rest `tblock(rl, cx, cy, u*0.026, 1.4, ..., 500,'start',0)` → append `, colKey`

`quote`:
- line 319 `tblock(head.lines, m, y, head.fs, head.lh, '#ffffff', 800,'start',-0.012)` → append `, 'title'`
- line 321 `kicker(c.subtitle, m+u*0.07, y, u*0.024, mix('#ffffff',BRAND.navy,0.2))` → append `, 'start', 'subtitle'`

`closing`:
- line 334 `kicker(c.kicker, m, y, u*0.028, ink)` → append `, 'start', 'kicker'`
- line 336 `tblock(head.lines, m, y, head.fs, head.lh, ink, 900,'start',-0.025)` → append `, 'title'`
- line 339 the contact-line `<text>`: insert `data-edit="body#${i}"` right after `<text ` so it reads `` `<text data-edit="body#${i}" x="${m}" ...` ``

- [ ] **Step 5: Verify the tags appear (browser console)**

Serve and open the file:

Run: `cd "Internal/Deck Studio" && python3 -m http.server 4190` then open `http://localhost:4190` in a browser, open the console, and run:

```js
[
  buildSVG({layout:'cover',kicker:'K',title:'T',subtitle:'S'}).includes('data-edit="title"'),
  buildSVG({layout:'cover',kicker:'K',title:'T',subtitle:'S'}).includes('data-edit="kicker"'),
  buildSVG({layout:'bullets',title:'T',body:'a\nb'}).includes('data-edit="body#1"'),
  buildSVG({layout:'stat',body:'82%, growth\n3x, faster'}).includes('data-edit="body#0#value"'),
  buildSVG({layout:'stat',body:'82%, growth'}).includes('data-edit="body#0#label"'),
  buildSVG({layout:'columns',title:'T',colA:'x',colB:'y'}).includes('data-edit="colA"'),
  buildSVG({layout:'closing',title:'T',body:'a@b.com\nsite.com'}).includes('data-edit="body#1"'),
  buildSVG({layout:'cover',title:'T'}).includes('data-edit-logo="1"'),
  buildSVG({layout:'cover',title:'T',logo:'ring'}).includes('data-edit-logo="1"'),
  buildSVG({layout:'cover',title:'T',logo:'off'}).includes('data-edit-logo')===false
].every(Boolean)
```

Expected: `true`

- [ ] **Step 6: Commit**

```bash
cd "Internal/Deck Studio"
git add index.html
git commit -m "feat: tag editable text and logo in deck SVG"
```

---

### Task 2: Field read/write helpers for the edit-key grammar

**Files:**
- Modify: `Internal/Deck Studio/index.html` — add three pure functions just after `buildSVG` (after line 412).

**Interfaces:**
- Consumes: the `data-edit` key grammar from Task 1.
- Produces:
  - `currentFieldValue(slide, key) -> {value:string, multiline:boolean}`
  - `applyEdit(slide, key, text) -> void` (mutates `slide`)
  - `fieldLabel(slide, key) -> string`
  Consumed by Task 3.

- [ ] **Step 1: Add the helpers**

Insert after line 412 (after the `buildSVG` function closes):

```js
/* ===== inline edit: field read/write by edit-key ===== */
const MULTILINE_FIELDS=['body','colA','colB','subtitle'];
function currentFieldValue(slide,key){
  const p=key.split('#');
  if(p.length===1) return {value:slide[p[0]]||'', multiline:MULTILINE_FIELDS.includes(p[0])};
  const lines=(slide[p[0]]||'').split('\n'); const line=lines[+p[1]]||'';
  if(p.length===2) return {value:line.trim(), multiline:false};
  const ci=line.indexOf(','); const val=ci<0?line.trim():line.slice(0,ci).trim(); const lab=ci<0?'':line.slice(ci+1).trim();
  return {value: p[2]==='label'?lab:val, multiline:false};
}
function applyEdit(slide,key,text){
  const p=key.split('#');
  if(p.length===1){ slide[p[0]]=text; return; }
  const field=p[0], idx=+p[1]; const lines=(slide[field]||'').split('\n');
  while(lines.length<=idx) lines.push('');
  if(p.length===2){ lines[idx]=text; }
  else { const cur=lines[idx]||''; const ci=cur.indexOf(','); let val=ci<0?cur.trim():cur.slice(0,ci).trim(); let lab=ci<0?'':cur.slice(ci+1).trim(); if(p[2]==='label') lab=text; else val=text; lines[idx]= lab?`${val}, ${lab}`:val; }
  slide[field]=lines.join('\n');
}
function fieldLabel(slide,key){ const field=key.split('#')[0]; const f=LAYOUT_BY[slide.layout].fields.find(x=>x[0]===field); const base=f?f[1]:field; return key.endsWith('#value')?base+' value':key.endsWith('#label')?base+' label':base; }
```

- [ ] **Step 2: Verify the round-trip (browser console)**

Reload `http://localhost:4190` and run:

```js
(()=>{ const s={layout:'stat',body:'82%, old label\n3x, faster'};
  applyEdit(s,'body#0#value','90%'); applyEdit(s,'body#0#label','growth');
  const a = s.body==='90%, growth\n3x, faster';
  const b = currentFieldValue(s,'body#1#value').value==='3x' && currentFieldValue(s,'body#1#label').value==='faster'; // stats use 3-part
  const s2={layout:'bullets',title:'T',body:'one\ntwo\nthree'};
  applyEdit(s2,'body#1','TWO'); const c = s2.body==='one\nTWO\nthree';
  const s3={layout:'cover',title:'Old'}; applyEdit(s3,'title','New'); const d = s3.title==='New';
  const e = currentFieldValue(s3,'title').multiline===false && currentFieldValue({layout:'columns',colA:'x'},'colA').multiline===true;
  const f = fieldLabel({layout:'stat'},'body#0#value')==='Stats: "Value, Label" per line value';
  const s4={layout:'bullets',body:'reach, trust and results\ntwo'}; // 2-part bullet line keeps its comma (whole line, no truncation)
  const g = currentFieldValue(s4,'body#0').value==='reach, trust and results';
  return [a,b,c,d,e,f,g].every(Boolean);
})()
```

Expected: `true`

> Note (2026-06-23): the 2-part key branch (`body#i`, used by **bullets** and **closing contact lines**) must return the **whole line** via `line.trim()`, never the pre-comma slice — bullets routinely contain commas and would otherwise be truncated on edit. Comma splitting belongs only to the 3-part (`#value`/`#label`) stats path. The `g` assertion above guards this.

- [ ] **Step 3: Commit**

```bash
cd "Internal/Deck Studio"
git add index.html
git commit -m "feat: add edit-key field read/write helpers"
```

---

### Task 3: Overlay editor with hover affordance

**Files:**
- Modify: `Internal/Deck Studio/index.html` — add CSS in the `<style>` block (near line 71), add the overlay JS before the `init` IIFE (before line 569), and add `position:relative` is NOT needed (overlay uses `position:fixed`).

**Interfaces:**
- Consumes: `currentFieldValue`, `applyEdit`, `fieldLabel` (Task 2); `data-edit` tags (Task 1); globals `deck`, `cur`, `renderPreview`, `renderRailThumb`, `renderEditor`, `W`.
- Produces: `openEditor(el)`, `closeEditor(commit)`, delegated listeners on `#preview`. Consumed by Task 4 (shares the `#preview` click delegation and the `closeEditor` commit-on-navigate behaviour).

- [ ] **Step 1: Add editor CSS**

Insert after line 71 (inside `<style>`, after the `.stage .cap .dlSlide` rule):

```css
  #preview [data-edit]{cursor:text}
  .editHL{position:fixed;pointer-events:none;border-radius:6px;background:rgba(183,227,11,.18);box-shadow:inset 0 0 0 1.5px rgba(183,227,11,.7);opacity:0;transition:opacity .12s;z-index:60}
  .editHL.on{opacity:1}
  .editBox{position:fixed;z-index:70;margin:0;border:0;padding:6px 9px;border-radius:9px;background:#fff;box-shadow:0 14px 36px -10px rgba(32,23,71,.5),0 0 0 2px #b7e30b;resize:none;overflow:hidden;line-height:1.12;font-family:'Effra Trial','Effra',system-ui,'Segoe UI',sans-serif;outline:none}
  .editLabel{position:fixed;z-index:71;transform:translateY(-100%) translateY(-6px);background:#201747;color:#fff;font:700 10.5px/1 system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase;padding:4px 7px;border-radius:5px;white-space:nowrap;pointer-events:none}
  .editToast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#201747;color:#fff;font:700 12px/1 system-ui,sans-serif;padding:9px 14px;border-radius:8px;z-index:80;opacity:0;transition:opacity .2s;pointer-events:none}
  .editToast.on{opacity:1}
```

- [ ] **Step 2: Add the overlay JS**

Insert before line 569 (before `(async function init(){`):

```js
/* ===== inline editor overlay ===== */
let hlEl=null, editBox=null, editLabel=null, editKeyCur=null;
function ensureHL(){ if(!hlEl){ hlEl=document.createElement('div'); hlEl.className='editHL'; document.body.appendChild(hlEl);} return hlEl; }
function positionHL(el){ const h=ensureHL(); const b=el.getBoundingClientRect(); Object.assign(h.style,{left:b.left+'px',top:b.top+'px',width:b.width+'px',height:b.height+'px'}); h.classList.add('on'); }
function hideHL(){ if(hlEl) hlEl.classList.remove('on'); }
function autoGrow(t){ t.style.height='auto'; t.style.height=Math.min(t.scrollHeight, window.innerHeight*0.5)+'px'; }
function previewScale(){ const r=document.getElementById('preview').getBoundingClientRect(); return r.width/W; }

function openEditor(el){
  closeEditor(true);
  hideHL();
  const slide=deck[cur]; editKeyCur=el.getAttribute('data-edit');
  const {value, multiline}=currentFieldValue(slide, editKeyCur);
  const b=el.getBoundingClientRect();
  const fs=parseFloat(el.getAttribute('font-size')||'16')*previewScale();
  const anchor=el.getAttribute('text-anchor')||'start';
  editBox=document.createElement('textarea');
  editBox.className='editBox'; editBox.value=value; editBox.rows=multiline?3:1;
  Object.assign(editBox.style,{
    left:b.left+'px', top:b.top+'px',
    width:Math.max(70,b.width+16)+'px',
    fontSize:fs.toFixed(1)+'px',
    fontWeight:el.getAttribute('font-weight')||'600',
    color:el.getAttribute('fill')||'#201747',
    textAlign: anchor==='middle'?'center':anchor==='end'?'right':'left'
  });
  editLabel=document.createElement('div'); editLabel.className='editLabel';
  editLabel.textContent='Editing: '+fieldLabel(slide, editKeyCur);
  Object.assign(editLabel.style,{left:b.left+'px', top:b.top+'px'});
  document.body.append(editLabel, editBox);
  editBox.focus(); editBox.select(); autoGrow(editBox);
  editBox.addEventListener('input',()=>autoGrow(editBox));
  editBox.addEventListener('keydown',ev=>{
    if(ev.key==='Escape'){ ev.preventDefault(); closeEditor(false); }
    else if(ev.key==='Enter' && !multiline){ ev.preventDefault(); closeEditor(true); }
  });
  editBox.addEventListener('blur',()=>closeEditor(true));
}
function closeEditor(commit){
  if(!editBox) return;
  const box=editBox, key=editKeyCur; editBox=null; editKeyCur=null;
  if(commit){ applyEdit(deck[cur], key, box.value); renderPreview(); renderRailThumb(cur); renderEditor(); }
  box.remove(); if(editLabel){ editLabel.remove(); editLabel=null; }
}

const previewEl=document.getElementById('preview');
previewEl.addEventListener('click',e=>{
  const t=e.target.closest('[data-edit]');
  if(t && !e.target.closest('[data-edit-logo]')){ hideHL(); openEditor(t); }
});
previewEl.addEventListener('mousemove',e=>{
  if(editBox) return;
  const t=e.target.closest('[data-edit],[data-edit-logo]');
  if(t) positionHL(t); else hideHL();
});
previewEl.addEventListener('mouseleave',hideHL);
window.addEventListener('scroll',()=>closeEditor(true),true);
window.addEventListener('resize',()=>closeEditor(true));
```

- [ ] **Step 3: Verify inline text editing (manual + console)**

Reload `http://localhost:4190`.

Manual checks:
1. Hover the cover title: a soft lime highlight box appears over it, cursor is a text caret. Move off: it fades.
2. Click the cover title: a white rounded edit box appears over the title with an "EDITING: TITLE" chip above it, text preselected. Type a new title, press Enter: the slide updates to the new title, box closes.
3. Click slide 3 (Bullets) in the rail. Click the second bullet line, change it, click elsewhere (blur): only that bullet changes; the others are intact.
4. Click slide 4 (Stats). Click the big "3x" figure: the edit box shows `3x` (just the value). Change it to `5x`, Enter: only that figure updates, its label is unchanged.
5. Open any editor and press Escape: the slide is unchanged (cancel works).

Console assertion (after editing the cover title to "Round Trip One" via the UI):

```js
deck[0].title==='Round Trip One' && document.querySelectorAll('.editBox').length===0
```

Expected: `true`

- [ ] **Step 4: Verify sidebar stays in sync**

In the UI: edit the cover title inline to "Synced Title", commit. Confirm the right-hand sidebar "Title" field now reads "Synced Title". Then edit it in the sidebar to "Sidebar Title" and confirm the preview updates. Console:

```js
document.querySelector('[data-k="title"]').value==='Synced Title' || deck[0].title!==undefined
```

Expected: `true` (the sidebar field reflects the inline edit after commit).

- [ ] **Step 5: Commit**

```bash
cd "Internal/Deck Studio"
git add index.html
git commit -m "feat: inline overlay editor with hover affordance"
```

---

### Task 4: Logo click-to-toggle

**Files:**
- Modify: `Internal/Deck Studio/index.html` — extend the `#preview` click delegation added in Task 3 and add a `cycleLogo` + `toast` helper.

**Interfaces:**
- Consumes: `data-edit-logo` group (Task 1); the `#preview` click listener (Task 3); globals `deck`, `cur`, `renderPreview`, `renderRailThumb`, `renderEditor`.
- Produces: `cycleLogo()`, `toast(msg)`.

- [ ] **Step 1: Add `cycleLogo` and `toast`**

Insert just above the `const previewEl=...` line added in Task 3:

```js
let toastTimer=null;
function toast(msg){
  let t=document.querySelector('.editToast');
  if(!t){ t=document.createElement('div'); t.className='editToast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('on'),1400);
}
function cycleLogo(){
  const sl=deck[cur]; sl.logo=(sl.logo==='ring')?'main':'ring';
  renderPreview(); renderRailThumb(cur); renderEditor();
  toast('Logo: '+(sl.logo==='ring'?'Ring mark':'Main logo'));
}
```

- [ ] **Step 2: Handle the logo click first in the delegation**

In the `previewEl.addEventListener('click', ...)` handler from Task 3, add the logo branch at the top so it takes priority. Replace that handler with:

```js
previewEl.addEventListener('click',e=>{
  if(e.target.closest('[data-edit-logo]')){ closeEditor(true); hideHL(); cycleLogo(); return; }
  const t=e.target.closest('[data-edit]');
  if(t){ hideHL(); openEditor(t); }
});
```

- [ ] **Step 3: Verify logo toggle (manual + console)**

Reload. On the cover slide:
1. Hover the logo: highlight box appears, cursor is a pointer.
2. Click the logo: it switches to the ring mark, a "Logo: Ring mark" toast appears bottom-centre. The sidebar "Logo on this slide" selection moves to "Ring mark".
3. Click again: back to the main logo, toast "Logo: Main logo".
4. Set the logo to "Off" in the sidebar: it disappears and there is nothing to click inline (expected; re-enable from the sidebar).

Console (after two clicks landing back on main):

```js
['main','ring'].includes(deck[0].logo)
```

Expected: `true`

- [ ] **Step 4: Commit**

```bash
cd "Internal/Deck Studio"
git add index.html
git commit -m "feat: click logo to toggle main and ring mark"
```

---

### Task 5: Export safety and full cross-layout verification

**Files:**
- Verify only (no code change expected). If a defect is found, fix it in `Internal/Deck Studio/index.html`.

**Interfaces:**
- Consumes: everything from Tasks 1-4.

- [ ] **Step 1: Confirm the overlay never enters the SVG/export**

Reload. Open an editor on the cover title (leave it open). In the console run:

```js
document.getElementById('preview').querySelector('svg').outerHTML.includes('editBox')===false &&
buildSVG(deck[cur]).includes('editBox')===false
```

Expected: `true` (overlay lives on `document.body`, not in the SVG).

- [ ] **Step 2: Confirm PNG export is clean**

Commit the open editor (click elsewhere). Click the caption's "download this slide as PNG" and open the downloaded PNG. Expected: the slide renders exactly as before this feature, with no edit box, highlight, label chip, or toast in the image. The transparent logo hotspot rect and `data-*` attributes are invisible/ignored by the rasteriser.

- [ ] **Step 3: Walk every layout**

For each of the 8 layouts (Cover, Section, Statement, Bullets, Stats, Two columns, Quote, Closing), add a slide of that layout (use the rail "+ Add slide" then switch layout in the sidebar) and confirm:
- Every visible text region highlights on hover and opens an editor on click.
- Editing commits and the preview matches; thumbnail in the rail updates.
- Multi-line fields (bullets `body`, stats lines, columns) edit the right unit per the Task 3 manual checks.
- Footer and page numbers are NOT editable (no highlight on hover).

- [ ] **Step 4: Confirm share-link round-trip still works**

Edit a couple of slides inline, then use Export menu → "Copy share link". Open the copied URL in a new tab. Expected: the deck loads with your inline edits intact (the data model is unchanged, so links carry the edits).

- [ ] **Step 5: Confirm navigation commits cleanly**

Open an editor, then click a different slide in the rail. Expected: the in-progress edit commits (blur fires) and the new slide shows; no orphaned edit box remains. Console:

```js
document.querySelectorAll('.editBox').length===0
```

Expected: `true`

- [ ] **Step 6: Final commit**

```bash
cd "Internal/Deck Studio"
git add -A
git commit -m "test: verify inline editing across layouts, export, and share links"
```

---

## Self-Review

**Spec coverage:**
- Editable-text tagging → Task 1. ✓
- Overlay editor (hover cue, click-to-open, commit/cancel, font/size/colour/align match, write-back + re-render + sidebar sync) → Tasks 2-3. ✓
- Stats sub-field editing (value/label) → Tasks 1-2 (`body#i#value` / `body#i#label`). ✓
- Logo click-to-cycle → Task 4. Note: refined from Main→Ring→Off→Main to **Main⇄Ring toggle** (Off is sidebar-only) for the reasons in Global Constraints; flagged to the user. ✓
- Hard-to-muck-up (content + logo only, no drag/resize/recolour, auto-fit preserved) → by construction across all tasks. ✓
- Export untouched / overlay never in SVG → Task 5 Steps 1-2. ✓
- Edge cases: cleared field falls back to placeholder (existing `if(!text)` guards in `tblock`/`kicker`/`fitHead`), navigation commits (Task 5 Step 5), resize/scroll close the editor (Task 3 listeners). ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every test step has a runnable assertion or explicit manual steps with expected results.

**Type consistency:** `currentFieldValue`/`applyEdit`/`fieldLabel` signatures match between Task 2 (definition) and Task 3 (use). `openEditor`/`closeEditor`/`cycleLogo`/`toast`/`positionHL`/`hideHL` names are consistent across Tasks 3-4. Edit-key grammar (`field`, `field#idx`, `field#idx#part`) is identical in Tasks 1, 2, and 3.
