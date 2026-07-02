### Task 2 Report: Move arrangement/fit/focus into inspector, remove on-canvas chrome

**Status:** DONE  
**Commit:** d431820  
**Branch:** worktree-library-graphics-images

---

#### Changes made

1. **CSS added** (near `.imgBtns`): `.focusPad`, `.focusPad .focusCell`, `.focusPad .focusCell.on` — 3x3 grid, 16/9 aspect ratio, 120px wide.

2. **`imageInspectorHTML` extended**: Before the deselect button, now renders:
   - Arrangement row (Left/Right/Caption/Full) — only for single-photo layouts (`imagetext`, `imageright`, `imagecaption`, `image`)
   - Crop row (Cover/Fit) — always shown
   - Focus pad (3×3, 9 cells) — only when `fit==='cover'`

3. **`renderEditor` inspector branch wired**: Three new event binders added after the existing three: `[data-arrange]` → `deck[cur].layout`, `[data-fit]` → `deck[cur].fit`, `[data-fx]/[data-fy]` → `deck[cur].focusX/focusY`. All call `renderAll(); saveDraftSoon(); commitHistorySoon()`.

4. **`photoControlSVG` stripped**: Removed focal-dot block (cover check + `<g data-focal>` circles) and `s+=imageToolbarSVG(c)` call. Function now returns only the selection outline `<rect>`.

5. **`imageToolbarSVG` deleted**: Entire function removed.

6. **Preview click handler cleaned**: Removed `[data-arrange]`, `[data-fit]`, and `[data-focal]` branches (6 lines).

7. **Pointerdown handler cleaned**: Removed `focal` branch (5 lines including `gDrag={mode:'focal'}`). Removed `[data-fit],[data-arrange]` from deselect-guard selector; `[data-imgslot]` kept.

8. **Pointermove handler cleaned**: Removed `mode:'focal'` case (4 lines).

9. **`gotoSlide` fix**: Added `selectedPhoto=null; selectedGraphicId=null;` before `renderAll()` to clear stale selection on slide navigation.

---

#### Verify output

```
── Inspector structure ──
{ selectedPhoto: "image", inspectorPresent: true, hasArrangeGrid: true, arrangeBtnCount: 4,
  hasFitGrid: true, fitBtnCount: 2, hasFocusPad: true, focusCellCount: 9,
  hasFocalOnCanvas: false, hasToolbarOnCanvas: false }
── After arrange click ── { layout: "image" }
── After focus cell click ── { focusX: 0.17, focusY: 0.17 }
── typeof imageToolbarSVG: undefined ──
── Focal element count on canvas ── { focalElements: 0 }
── gotoSlide clears selectedPhoto ── { selectedPhotoBeforeNav: "image", selectedPhotoAfterNav: null }
── Console errors ── []
── Assertion results ── ALL PASS ✓
```

All 15 assertions pass. `errors: []`.

---

### Task 2 Fix Pass: Move two-image arrangement into inspector, remove on-canvas pill

**Status:** DONE  
**Commit:** 9631c55  
**Branch:** worktree-library-graphics-images

#### Regression addressed

`pairArrangeToolbarSVG` — an always-on on-canvas SVG pill rendering `[data-arrange="twoup"]` / `[data-arrange="imagestack"]` for the two-image layouts — had its click handler removed in the Task 2 main pass (which stripped the on-canvas toolbar). The buttons rendered but clicks did nothing.

#### Changes made

1. **`imageInspectorHTML` extended** (`index.html` ~line 1349): Added a `pair` const for `['twoup','imagestack'].includes(sl.layout)`. Added a second `arrange` ternary branch (separate from the `single` branch) that renders `<h2>Arrangement</h2><div class="layoutGrid" data-arrange-grid>` with Side by side (`twoup`) / Stacked (`imagestack`) buttons. Grid layouts (`imagegrid3`/`imagegrid4`) still get no arrangement block.

2. **`pairArrangeToolbarSVG` deleted** (`index.html` ~line 489–501): Entire function and its comment removed.

3. **Call site 1 removed** (`imagestackRender`, `index.html` ~line 509): `if(interactive) s+=pairArrangeToolbarSVG(c);` removed.

4. **Call site 2 removed** (`twoup` render, `index.html` ~line 893): `if(interactive) s+=pairArrangeToolbarSVG(c);` removed.

5. **Stale comment fixed** (`index.html` ~line 2016): `// show the arrangement/fit bar right away` → `// select the dropped photo so its inspector opens`.

The existing `[data-arrange]` click handler in `renderEditor`'s inspector branch (line 1379) already handles both single-photo and pair arrange buttons — no new handler needed.

#### Covering test

File: `docs/superpowers/verify/check.mjs`  
Command: `node docs/superpowers/verify/check.mjs`

New assertions added:
- `typeof pairArrangeToolbarSVG === 'undefined'`
- twoup slide with two images, select cell → inspector shows `[data-arrange="twoup"]` and `[data-arrange="imagestack"]`
- clicking `[data-arrange="imagestack"]` sets `deck[cur].layout === 'imagestack'`
- after render, `#preview [data-arrange]` count === 0 (only inside `#editor`)

#### Verify output

```
── Inspector structure ──
{
  "selectedPhoto": "image",
  "inspectorPresent": true,
  "hasArrangeGrid": true,
  "arrangeBtnCount": 4,
  "hasFitGrid": true,
  "fitBtnCount": 2,
  "hasFocusPad": true,
  "focusCellCount": 9,
  "hasFocalOnCanvas": false,
  "hasToolbarOnCanvas": false
}
── After arrange click ──
{
  "layout": "image"
}
── After focus cell click ──
{
  "focusX": 0.17,
  "focusY": 0.17
}
── typeof imageToolbarSVG: undefined ──
── typeof pairArrangeToolbarSVG: undefined ──
── Pair inspector structure ──
{
  "inspectorPresent": true,
  "hasTwoUpBtn": true,
  "hasStackBtn": true,
  "arrangeOnCanvas": 0
}
── After pair arrange click ──
{
  "layout": "imagestack",
  "arrangeOnCanvas": 0
}
── Focal element count on canvas ──
{
  "focalElements": 0
}
── gotoSlide clears selectedPhoto ──
{
  "selectedPhotoBeforeNav": "image",
  "selectedPhotoAfterNav": null
}
── Console errors ──
[]

── Assertion results ──
ALL PASS ✓
```

All assertions pass (original 15 + 8 new = 23 total). `errors: []`.
