/**
 * Task 2 + Task 3 verification harness
 * Run: node docs/superpowers/verify/check.mjs
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:4250/';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });

  // Boot to editor canvas by closing the home overlay
  await page.evaluate(() => { if (typeof closeHome === 'function') closeHome(); });
  await page.waitForSelector('#preview svg', { timeout: 5000 });

  const IMG = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#123"/></svg>').toString('base64');
  const IMG2 = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#f00"/></svg>').toString('base64');

  // ── Test: imagetext slide with photo selected shows inspector with arrangement + fit + focusPad ──
  const inspectorResult = await page.evaluate((img) => {
    deck[cur] = { layout: 'imagetext', image: img, title: 'Test' };
    renderAll();
    // click the photo slot to select it
    const slot = document.querySelector('#preview [data-imgslot="image"]');
    slot && slot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const inspector = document.querySelector('#editor [data-img-inspector]');
    const arrangeGrid = inspector ? inspector.querySelector('[data-arrange-grid]') : null;
    const arrangeBtns = arrangeGrid ? arrangeGrid.querySelectorAll('[data-arrange]').length : 0;
    const fitGrid = inspector ? inspector.querySelector('[data-fit-grid]') : null;
    const fitBtns = fitGrid ? fitGrid.querySelectorAll('[data-fit]').length : 0;
    const focusPad = inspector ? inspector.querySelector('.focusPad') : null;
    const focusCells = focusPad ? focusPad.querySelectorAll('.focusCell').length : 0;
    const hasFocalOnCanvas = !!document.querySelector('#preview [data-focal]');
    const hasToolbarOnCanvas = !!document.querySelector('#preview [data-arrange]');
    return {
      selectedPhoto,
      inspectorPresent: !!inspector,
      hasArrangeGrid: !!arrangeGrid,
      arrangeBtnCount: arrangeBtns,
      hasFitGrid: !!fitGrid,
      fitBtnCount: fitBtns,
      hasFocusPad: !!focusPad,
      focusCellCount: focusCells,
      hasFocalOnCanvas,
      hasToolbarOnCanvas,
    };
  }, IMG);

  console.log('── Inspector structure ──');
  console.log(JSON.stringify(inspectorResult, null, 2));

  // ── Test: clicking [data-arrange="image"] sets deck[cur].layout === 'image' ──
  const arrangeResult = await page.evaluate((img) => {
    deck[cur] = { layout: 'imagetext', image: img, title: 'Test' };
    renderAll();
    const slot = document.querySelector('#preview [data-imgslot="image"]');
    slot && slot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const fullBtn = document.querySelector('#editor [data-arrange="image"]');
    fullBtn && fullBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return { layout: deck[cur].layout };
  }, IMG);

  console.log('── After arrange click ──');
  console.log(JSON.stringify(arrangeResult, null, 2));

  // ── Test: clicking a focus cell sets deck[cur].focusX ──
  const focusResult = await page.evaluate((img) => {
    deck[cur] = { layout: 'imagetext', image: img, title: 'Test', fit: 'cover' };
    renderAll();
    const slot = document.querySelector('#preview [data-imgslot="image"]');
    slot && slot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const cell = document.querySelector('#editor [data-fx="0.17"][data-fy="0.17"]');
    cell && cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return { focusX: deck[cur].focusX, focusY: deck[cur].focusY };
  }, IMG);

  console.log('── After focus cell click ──');
  console.log(JSON.stringify(focusResult, null, 2));

  // ── Test: imageToolbarSVG is deleted ──
  const toolbarUndef = await page.evaluate(() => typeof imageToolbarSVG);
  console.log(`── typeof imageToolbarSVG: ${toolbarUndef} ──`);

  // ── Test: pairArrangeToolbarSVG is deleted ──
  const pairToolbarUndef = await page.evaluate(() => typeof pairArrangeToolbarSVG);
  console.log(`── typeof pairArrangeToolbarSVG: ${pairToolbarUndef} ──`);

  // ── Test: twoup slide inspector shows arrangement buttons ──
  const pairInspectorResult = await page.evaluate((img) => {
    deck[cur] = { layout: 'twoup', image: img, image2: img, title: 'Test' };
    renderAll();
    const slot = document.querySelector('#preview [data-imgslot="image"]');
    slot && slot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const inspector = document.querySelector('#editor [data-img-inspector]');
    const arrangeGrid = inspector ? inspector.querySelector('[data-arrange-grid]') : null;
    const twoUpBtn = arrangeGrid ? arrangeGrid.querySelector('[data-arrange="twoup"]') : null;
    const stackBtn = arrangeGrid ? arrangeGrid.querySelector('[data-arrange="imagestack"]') : null;
    const arrangeOnCanvas = document.querySelectorAll('#preview [data-arrange]').length;
    return {
      inspectorPresent: !!inspector,
      hasTwoUpBtn: !!twoUpBtn,
      hasStackBtn: !!stackBtn,
      arrangeOnCanvas,
    };
  }, IMG);
  console.log('── Pair inspector structure ──');
  console.log(JSON.stringify(pairInspectorResult, null, 2));

  // ── Test: clicking [data-arrange="imagestack"] on twoup sets layout ──
  const pairArrangeResult = await page.evaluate((img) => {
    deck[cur] = { layout: 'twoup', image: img, image2: img, title: 'Test' };
    renderAll();
    const slot = document.querySelector('#preview [data-imgslot="image"]');
    slot && slot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const stackBtn = document.querySelector('#editor [data-arrange="imagestack"]');
    stackBtn && stackBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const arrangeOnCanvasAfter = document.querySelectorAll('#preview [data-arrange]').length;
    return { layout: deck[cur].layout, arrangeOnCanvas: arrangeOnCanvasAfter };
  }, IMG);
  console.log('── After pair arrange click ──');
  console.log(JSON.stringify(pairArrangeResult, null, 2));

  // ── Test: no [data-focal] on canvas when photo selected ──
  const noFocalOnCanvas = await page.evaluate((img) => {
    deck[cur] = { layout: 'imagetext', image: img, title: 'Test' };
    renderAll();
    const slot = document.querySelector('#preview [data-imgslot="image"]');
    slot && slot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return { focalElements: document.querySelectorAll('#preview [data-focal]').length };
  }, IMG);

  console.log('── Focal element count on canvas ──');
  console.log(JSON.stringify(noFocalOnCanvas, null, 2));

  // ── Test: gotoSlide clears selectedPhoto ──
  const gotoResult = await page.evaluate((img) => {
    deck.push({ layout: 'imagetext', image: img, title: 'Slide 2' });
    cur = deck.length - 2;
    renderAll();
    const slot = document.querySelector('#preview [data-imgslot="image"]');
    slot && slot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const beforeNav = selectedPhoto;
    gotoSlide(deck.length - 1);
    const afterNav = selectedPhoto;
    deck.pop();
    return { selectedPhotoBeforeNav: beforeNav, selectedPhotoAfterNav: afterNav };
  }, IMG);

  console.log('── gotoSlide clears selectedPhoto ──');
  console.log(JSON.stringify(gotoResult, null, 2));

  // ── Task 3 Test: MULTI_CELLS and swapCells exist ──
  const swapExists = await page.evaluate(() => ({
    MULTI_CELLS: typeof MULTI_CELLS,
    swapCells: typeof swapCells,
    multiCellsKeys: typeof MULTI_CELLS === 'object' ? Object.keys(MULTI_CELLS) : [],
  }));
  console.log('── MULTI_CELLS / swapCells existence ──');
  console.log(JSON.stringify(swapExists, null, 2));

  // ── Task 3 Test: twoup — select image, inspector shows [data-swap] button, click swap, values exchanged ──
  const swapTwoUpResult = await page.evaluate((imgs) => {
    const [img1, img2] = imgs;
    deck[cur] = { layout: 'twoup', image: img1, image2: img2, capA: 'Caption A', capB: 'Caption B' };
    renderAll();
    // select image (cell 0)
    selectedPhoto = 'image';
    renderEditor();
    const swapBtn = document.querySelector('#editor [data-swap]');
    const swapBtnIndex = swapBtn ? swapBtn.dataset.swap : null;
    swapBtn && swapBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return {
      swapBtnPresent: !!swapBtn,
      swapBtnIndex,
      imageAfter: deck[cur].image,
      image2After: deck[cur].image2,
      capAAfter: deck[cur].capA,
      capBAfter: deck[cur].capB,
      img1WasImg2: deck[cur].image === img2,
      img2WasImg1: deck[cur].image2 === img1,
      capAWasCapB: deck[cur].capA === 'Caption B',
      capBWasCapA: deck[cur].capB === 'Caption A',
    };
  }, [IMG, IMG2]);

  console.log('── Task 3: twoup swap (cell 0 → cell 1) ──');
  console.log(JSON.stringify(swapTwoUpResult, null, 2));

  // ── Task 3 Test: imagegrid4 — select image3 (index 2), swap with cell 0, assert image/image3 and capA/capC swapped ──
  const IMG3 = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#0f0"/></svg>').toString('base64');
  const IMG4 = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#00f"/></svg>').toString('base64');

  const swapGrid4Result = await page.evaluate((imgs) => {
    const [img1, img2, img3, img4] = imgs;
    deck[cur] = { layout: 'imagegrid4', image: img1, image2: img2, image3: img3, image4: img4,
      capA: 'Cap A', capB: 'Cap B', capC: 'Cap C', capD: 'Cap D' };
    renderAll();
    // select image3 (index 2)
    selectedPhoto = 'image3';
    renderEditor();
    // swap with cell 0 (index 0)
    const swapBtn0 = document.querySelector('#editor [data-swap="0"]');
    swapBtn0 && swapBtn0.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return {
      swapBtn0Present: !!swapBtn0,
      // image should be img3, image3 should be img1
      imageAfter: deck[cur].image,
      image3After: deck[cur].image3,
      capAAfter: deck[cur].capA,
      capCAfter: deck[cur].capC,
      imageWasImg3: deck[cur].image === img3,
      image3WasImg1: deck[cur].image3 === img1,
      capAWasCapC: deck[cur].capA === 'Cap C',
      capCWasCapA: deck[cur].capC === 'Cap A',
    };
  }, [IMG, IMG2, IMG3, IMG4]);

  console.log('── Task 3: imagegrid4 swap (cell 2 → cell 0) ──');
  console.log(JSON.stringify(swapGrid4Result, null, 2));

  // ── Task 4 Test (a): select photo, Backspace → photo removed, slide count unchanged ──
  const t4a = await page.evaluate((img) => {
    // ensure there are at least 2 slides so deleteSlide won't refuse
    while (deck.length < 2) deck.push({ layout: 'bullets', title: 'Extra', body: '' });
    cur = 0;
    deck[cur] = { layout: 'imagetext', image: img, title: 'T4A' };
    renderAll();
    selectedPhoto = 'image';
    renderEditor();
    const lenBefore = deck.length;
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    return {
      lenBefore,
      lenAfter: deck.length,
      imageAfter: deck[0].image,
      selectedPhotoAfter: selectedPhoto,
    };
  }, IMG);
  console.log('── Task 4(a): Backspace removes photo, slide unchanged ──');
  console.log(JSON.stringify(t4a, null, 2));

  // ── Task 4 Test (b): nothing selected, Backspace → slide deleted ──
  const t4b = await page.evaluate(() => {
    // ensure at least 2 slides
    while (deck.length < 2) deck.push({ layout: 'bullets', title: 'Extra', body: '' });
    cur = 0;
    selectedPhoto = null;
    selectedGraphicId = null;
    renderAll();
    const lenBefore = deck.length;
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    return { lenBefore, lenAfter: deck.length };
  });
  console.log('── Task 4(b): Backspace with no selection deletes slide ──');
  console.log(JSON.stringify(t4b, null, 2));

  // ── Task 4 Test (c): select photo, Escape → selectedPhoto===null ──
  const t4c = await page.evaluate((img) => {
    while (deck.length < 1) deck.push({ layout: 'imagetext', image: img, title: 'T4C' });
    cur = 0;
    deck[cur] = { layout: 'imagetext', image: img, title: 'T4C' };
    renderAll();
    selectedPhoto = 'image';
    renderEditor();
    const before = selectedPhoto;
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return { selectedPhotoBefore: before, selectedPhotoAfter: selectedPhoto };
  }, IMG);
  console.log('── Task 4(c): Escape deselects photo ──');
  console.log(JSON.stringify(t4c, null, 2));

  // ── Task 4 Test: ACTIONS entries exist ──
  const t4actions = await page.evaluate(() => ({
    rmimg: typeof ACTIONS !== 'undefined' && ACTIONS.some(a => a.id === 'rmimg'),
    deselect: typeof ACTIONS !== 'undefined' && ACTIONS.some(a => a.id === 'deselect'),
  }));
  console.log('── Task 4: ACTIONS entries ──');
  console.log(JSON.stringify(t4actions, null, 2));

  // ── Task 5 Test: library search ──
  const t5 = await page.evaluate(() => {
    // Seed LIB if it didn't load (guard against fetch failure in headless)
    if (!LIB || !LIB.assets || !LIB.assets.length) {
      LIB = {
        categories: [{ id: 'icons', name: 'Icons' }, { id: 'illustrations', name: 'Illustrations' }],
        assets: [
          { id: 'icon-target', name: 'Target', category: 'icons', src: 'x.svg' },
          { id: 'icon-growth', name: 'Growth', category: 'icons', src: 'x.svg' },
          { id: 'studio-target', name: 'Target', category: 'illustrations', src: 'x.png' },
          { id: 'studio-rocket', name: 'Rocket', category: 'illustrations', src: 'x.png' },
        ]
      };
    }
    // Use "target" — exists in icons AND illustrations in both real and fake LIB
    const q = 'target';
    // Compute expected count from LIB directly
    const catName = id => ((LIB.categories || []).find(c => c.id === id) || {}).name || '';
    const expectedAssets = LIB.assets.filter(a => ((a.name || '') + ' ' + catName(a.category)).toLowerCase().includes(q));
    const expectedCount = expectedAssets.length;
    const expectedCategories = [...new Set(expectedAssets.map(a => a.category))];
    const crossCategory = expectedCategories.length > 1;

    // Open library, set query, re-render
    libCat = LIB.categories[0].id;
    libQuery = q;
    openLibrary('image');
    renderLibrary();
    const itemsWithQuery = libPanelEl.querySelectorAll('.libItem').length;

    // Now clear query — items should be only from active category
    libQuery = '';
    renderLibrary();
    const itemsNoQuery = libPanelEl.querySelectorAll('.libItem').length;
    const expectedNoCat = LIB.assets.filter(a => a.category === libCat).length;

    // Focus preservation: simulate oninput
    libQuery = 'tar';
    renderLibrary();
    // The input handler will have been wired; trigger it to test focus
    const si = libPanelEl.querySelector('[data-lib-search]');
    let focusPreserved = false;
    if (si) {
      si.focus();
      si.value = 'targ';
      si.dispatchEvent(new Event('input', { bubbles: true }));
      const active = document.activeElement;
      focusPreserved = active && active.hasAttribute('data-lib-search');
    }

    // Clean up
    libQuery = '';
    renderLibrary();

    return {
      expectedCount,
      crossCategory,
      itemsWithQuery,
      itemsNoQuery,
      expectedNoCat,
      focusPreserved,
      searchInputPresent: !!libPanelEl.querySelector('[data-lib-search]'),
    };
  });

  console.log('── Task 5: library search ──');
  console.log(JSON.stringify(t5, null, 2));

  console.log('── Console errors ──');
  console.log(JSON.stringify(errors));

  // ── Assertions ──
  const assertions = [];
  if (!inspectorResult.inspectorPresent) assertions.push('FAIL: inspector not present when photo selected');
  if (!inspectorResult.hasArrangeGrid) assertions.push('FAIL: [data-arrange-grid] not in inspector');
  if (inspectorResult.arrangeBtnCount !== 4) assertions.push(`FAIL: expected 4 arrange buttons, got ${inspectorResult.arrangeBtnCount}`);
  if (!inspectorResult.hasFitGrid) assertions.push('FAIL: [data-fit-grid] not in inspector');
  if (inspectorResult.fitBtnCount !== 2) assertions.push(`FAIL: expected 2 fit buttons, got ${inspectorResult.fitBtnCount}`);
  if (!inspectorResult.hasFocusPad) assertions.push('FAIL: .focusPad not in inspector');
  if (inspectorResult.focusCellCount !== 9) assertions.push(`FAIL: expected 9 focus cells, got ${inspectorResult.focusCellCount}`);
  if (inspectorResult.hasFocalOnCanvas) assertions.push('FAIL: [data-focal] still rendered on canvas');
  if (inspectorResult.hasToolbarOnCanvas) assertions.push('FAIL: [data-arrange] still rendered on canvas');
  if (arrangeResult.layout !== 'image') assertions.push(`FAIL: after arrange click, layout should be "image", got "${arrangeResult.layout}"`);
  if (focusResult.focusX !== 0.17) assertions.push(`FAIL: focusX should be 0.17, got ${focusResult.focusX}`);
  if (focusResult.focusY !== 0.17) assertions.push(`FAIL: focusY should be 0.17, got ${focusResult.focusY}`);
  if (toolbarUndef !== 'undefined') assertions.push(`FAIL: imageToolbarSVG should be undefined, got typeof=${toolbarUndef}`);
  if (pairToolbarUndef !== 'undefined') assertions.push(`FAIL: pairArrangeToolbarSVG should be undefined, got typeof=${pairToolbarUndef}`);
  if (!pairInspectorResult.inspectorPresent) assertions.push('FAIL: inspector not present for twoup slide');
  if (!pairInspectorResult.hasTwoUpBtn) assertions.push('FAIL: [data-arrange="twoup"] not in inspector for twoup slide');
  if (!pairInspectorResult.hasStackBtn) assertions.push('FAIL: [data-arrange="imagestack"] not in inspector for twoup slide');
  if (pairInspectorResult.arrangeOnCanvas !== 0) assertions.push(`FAIL: ${pairInspectorResult.arrangeOnCanvas} [data-arrange] elements on canvas for twoup slide`);
  if (pairArrangeResult.layout !== 'imagestack') assertions.push(`FAIL: after imagestack click, layout should be "imagestack", got "${pairArrangeResult.layout}"`);
  if (pairArrangeResult.arrangeOnCanvas !== 0) assertions.push(`FAIL: ${pairArrangeResult.arrangeOnCanvas} [data-arrange] elements on canvas after imagestack click`);
  if (noFocalOnCanvas.focalElements !== 0) assertions.push(`FAIL: ${noFocalOnCanvas.focalElements} [data-focal] elements on canvas`);
  if (gotoResult.selectedPhotoAfterNav !== null) assertions.push(`FAIL: selectedPhoto should be null after gotoSlide, got "${gotoResult.selectedPhotoAfterNav}"`);
  // Task 3 assertions
  if (swapExists.MULTI_CELLS !== 'object') assertions.push('FAIL: MULTI_CELLS is not defined');
  if (swapExists.swapCells !== 'function') assertions.push('FAIL: swapCells is not a function');
  if (!swapTwoUpResult.swapBtnPresent) assertions.push('FAIL: no [data-swap] button in twoup inspector');
  if (!swapTwoUpResult.img1WasImg2) assertions.push(`FAIL: twoup image should be img2 after swap, got ${swapTwoUpResult.imageAfter}`);
  if (!swapTwoUpResult.img2WasImg1) assertions.push(`FAIL: twoup image2 should be img1 after swap, got ${swapTwoUpResult.image2After}`);
  if (!swapTwoUpResult.capAWasCapB) assertions.push(`FAIL: twoup capA should be "Caption B" after swap, got "${swapTwoUpResult.capAAfter}"`);
  if (!swapTwoUpResult.capBWasCapA) assertions.push(`FAIL: twoup capB should be "Caption A" after swap, got "${swapTwoUpResult.capBAfter}"`);
  if (!swapGrid4Result.swapBtn0Present) assertions.push('FAIL: no [data-swap="0"] button in imagegrid4 inspector for image3');
  if (!swapGrid4Result.imageWasImg3) assertions.push(`FAIL: imagegrid4 image should be img3 after swap, got ${swapGrid4Result.imageAfter}`);
  if (!swapGrid4Result.image3WasImg1) assertions.push(`FAIL: imagegrid4 image3 should be img1 after swap, got ${swapGrid4Result.image3After}`);
  if (!swapGrid4Result.capAWasCapC) assertions.push(`FAIL: imagegrid4 capA should be "Cap C" after swap, got "${swapGrid4Result.capAAfter}"`);
  if (!swapGrid4Result.capCWasCapA) assertions.push(`FAIL: imagegrid4 capC should be "Cap A" after swap, got "${swapGrid4Result.capCAfter}"`);
  if (errors.length) assertions.push(`FAIL: ${errors.length} console error(s): ${errors.join('; ')}`);
  // Task 4 assertions
  if (t4a.lenAfter !== t4a.lenBefore) assertions.push(`FAIL: Task 4(a) slide count changed from ${t4a.lenBefore} to ${t4a.lenAfter} (should be unchanged)`);
  if (t4a.imageAfter !== undefined) assertions.push(`FAIL: Task 4(a) image still present after Backspace: ${t4a.imageAfter}`);
  if (t4a.selectedPhotoAfter !== null) assertions.push(`FAIL: Task 4(a) selectedPhoto should be null after Backspace, got "${t4a.selectedPhotoAfter}"`);
  if (t4b.lenAfter !== t4b.lenBefore - 1) assertions.push(`FAIL: Task 4(b) expected slide count to drop by 1 (${t4b.lenBefore}→${t4b.lenBefore - 1}), got ${t4b.lenAfter}`);
  if (t4c.selectedPhotoAfter !== null) assertions.push(`FAIL: Task 4(c) selectedPhoto should be null after Escape, got "${t4c.selectedPhotoAfter}"`);
  if (!t4actions.rmimg) assertions.push('FAIL: Task 4 ACTIONS missing entry id="rmimg"');
  if (!t4actions.deselect) assertions.push('FAIL: Task 4 ACTIONS missing entry id="deselect"');
  // Task 5 assertions
  if (!t5.searchInputPresent) assertions.push('FAIL: Task 5 search input [data-lib-search] not rendered');
  if (!t5.crossCategory) assertions.push('FAIL: Task 5 test query "target" does not span >1 category in LIB');
  if (t5.itemsWithQuery !== t5.expectedCount) assertions.push(`FAIL: Task 5 cross-category query returned ${t5.itemsWithQuery} items, expected ${t5.expectedCount}`);
  if (t5.itemsNoQuery !== t5.expectedNoCat) assertions.push(`FAIL: Task 5 empty query returned ${t5.itemsNoQuery} items, expected ${t5.expectedNoCat} for active category`);
  if (!t5.focusPreserved) assertions.push('FAIL: Task 5 focus not preserved in search input after oninput re-render');

  // ── Task 6: My uploads (IndexedDB) ──
  const PROBE_DATA = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');

  // Add a probe upload, open library, assert [data-upload] renders
  const t6add = await page.evaluate(async (data) => {
    const rec = await idbAddUpload({ data, name: 'probe' });
    libQuery = '';
    openLibrary('image');
    renderLibrary();
    const item = libPanelEl ? libPanelEl.querySelector('[data-upload]') : null;
    const nameEl = item ? item.querySelector('.nm') : null;
    return {
      recId: rec.id,
      idbFunctions: typeof idbAddUpload === 'function' && typeof idbAllUploads === 'function' && typeof idbDeleteUpload === 'function',
      myUploadsLength: MY_UPLOADS.length,
      uploadItemPresent: !!item,
      uploadItemName: nameEl ? nameEl.textContent : null,
      hasDataUploadAttr: item ? item.hasAttribute('data-upload') : false,
    };
  }, PROBE_DATA);
  console.log('── Task 6: add probe + render ──');
  console.log(JSON.stringify(t6add, null, 2));

  // Reload and check persistence (same context, same browser)
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => { if (typeof closeHome === 'function') closeHome(); });
  await page.waitForSelector('#preview svg', { timeout: 5000 });

  const t6persist = await page.evaluate(async () => {
    const all = await idbAllUploads();
    const probe = all.find(u => u.name === 'probe');
    return {
      uploadsCount: all.length,
      probeFound: !!probe,
      probeId: probe ? probe.id : null,
      myUploadsAfterInit: MY_UPLOADS.length,
    };
  });
  console.log('── Task 6: persistence after reload ──');
  console.log(JSON.stringify(t6persist, null, 2));

  // Delete the probe and verify it's gone from the rendered library
  const t6delete = await page.evaluate(async () => {
    const probe = MY_UPLOADS.find(u => u.name === 'probe');
    if (!probe) return { probeFound: false };
    await idbDeleteUpload(probe.id);
    libQuery = '';
    openLibrary('image');
    renderLibrary();
    const item = libPanelEl ? libPanelEl.querySelector('[data-upload]') : null;
    const allAfter = await idbAllUploads();
    return {
      probeFound: true,
      uploadItemGone: !item,
      myUploadsAfterDelete: MY_UPLOADS.length,
      idbCountAfterDelete: allAfter.length,
    };
  });
  console.log('── Task 6: delete probe ──');
  console.log(JSON.stringify(t6delete, null, 2));

  // Task 6 assertions
  if (!t6add.idbFunctions) assertions.push('FAIL: Task 6 idb functions not defined');
  if (!t6add.uploadItemPresent) assertions.push('FAIL: Task 6 [data-upload] item not rendered after idbAddUpload');
  if (t6add.uploadItemName !== 'probe') assertions.push(`FAIL: Task 6 upload item name should be "probe", got "${t6add.uploadItemName}"`);
  if (!t6persist.probeFound) assertions.push('FAIL: Task 6 probe not found in idbAllUploads() after reload');
  if (!t6delete.probeFound) assertions.push('FAIL: Task 6 probe was not in MY_UPLOADS before delete');
  if (!t6delete.uploadItemGone) assertions.push('FAIL: Task 6 [data-upload] item still rendered after idbDeleteUpload + renderLibrary');
  if (t6delete.idbCountAfterDelete !== 0) assertions.push(`FAIL: Task 6 idb still has ${t6delete.idbCountAfterDelete} records after delete`);

  // ── Task 7 Tests ──

  // (a) twoup: set selectedPhoto='image2', call insertLibraryAsset, assert data URL lands in image2 not image
  const t7a = await page.evaluate(async (img) => {
    // seed a photo-category asset into LIB
    if (!LIB) LIB = { categories: [], assets: [] };
    const testAsset = { id: 'test-photo-asset', name: 'Test Photo', category: 'photos', src: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#abc"/></svg>') };
    if (!LIB.assets.find(a => a.id === 'test-photo-asset')) LIB.assets.push(testAsset);
    if (!LIB.categories.find(c => c.id === 'photos')) LIB.categories.push({ id: 'photos', name: 'Photos' });

    deck[cur] = { layout: 'twoup', image: img, image2: img, title: 'T7A' };
    selectedPhoto = 'image2';
    libTargetKey = 'image';

    // stub assetToDataURL to return the src directly (no fetch needed)
    const origFn = assetToDataURL;
    window.assetToDataURL = async (src) => src;
    await insertLibraryAsset('test-photo-asset');
    window.assetToDataURL = origFn;

    return {
      image2Value: deck[cur].image2,
      imageValue: deck[cur].image,
      image2ChangedFromImg: deck[cur].image2 !== img,
      imageUnchanged: deck[cur].image === img,
      dest_was_image2: deck[cur].image2 === testAsset.src,
    };
  }, IMG);
  console.log('── Task 7(a): insertLibraryAsset targets selectedPhoto (image2) ──');
  console.log(JSON.stringify(t7a, null, 2));

  // (b) selectedPhoto=null → insertLibraryAsset targets libTargetKey as before
  const t7b = await page.evaluate(async (img) => {
    const testSrc = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#def"/></svg>');
    if (!LIB) LIB = { categories: [{ id: 'photos', name: 'Photos' }], assets: [] };
    const testAsset2 = { id: 'test-photo-b', name: 'Test Photo B', category: 'photos', src: testSrc };
    if (!LIB.assets.find(a => a.id === 'test-photo-b')) LIB.assets.push(testAsset2);
    if (!LIB.categories.find(c => c.id === 'photos')) LIB.categories.push({ id: 'photos', name: 'Photos' });

    deck[cur] = { layout: 'imagetext', image: img, title: 'T7B' };
    selectedPhoto = null;
    libTargetKey = 'image';

    const origFn = assetToDataURL;
    window.assetToDataURL = async (src) => src;
    await insertLibraryAsset('test-photo-b');
    window.assetToDataURL = origFn;

    return {
      imageValue: deck[cur].image,
      imageUpdated: deck[cur].image === testSrc,
    };
  }, IMG);
  console.log('── Task 7(b): insertLibraryAsset targets libTargetKey when selectedPhoto=null ──');
  console.log(JSON.stringify(t7b, null, 2));

  // (c) placeAssetIntoCell sets deck[cur][key] and re-renders without error
  const t7c = await page.evaluate(async (img) => {
    deck[cur] = { layout: 'imagetext', image: img, title: 'T7C' };
    const testUrl = 'data:image/png;base64,AAAA';
    let renderAllCalled = false;
    const origRender = renderAll;
    window.renderAll = () => { renderAllCalled = true; origRender(); };
    await placeAssetIntoCell(testUrl, 'image');
    window.renderAll = origRender;
    return {
      imageValue: deck[cur].image,
      imageMatches: deck[cur].image === testUrl,
      renderAllCalled,
    };
  }, IMG);
  console.log('── Task 7(c): placeAssetIntoCell sets deck[cur].image and re-renders ──');
  console.log(JSON.stringify(t7c, null, 2));

  // (d) After openLibrary + renderLibrary, [data-asset] and [data-upload] have draggable="true"
  const t7d = await page.evaluate(async (data) => {
    // add an upload so [data-upload] items appear
    const rec = await idbAddUpload({ data, name: 'drag-probe' });
    libQuery = '';
    openLibrary('image');
    renderLibrary();
    const assetItems = libPanelEl ? Array.from(libPanelEl.querySelectorAll('[data-asset]')) : [];
    const uploadItems = libPanelEl ? Array.from(libPanelEl.querySelectorAll('[data-upload]')) : [];
    const assetsDraggable = assetItems.every(el => el.getAttribute('draggable') === 'true');
    const uploadsDraggable = uploadItems.every(el => el.getAttribute('draggable') === 'true');
    // clean up
    await idbDeleteUpload(rec.id);
    renderLibrary();
    return {
      assetCount: assetItems.length,
      uploadCount: uploadItems.length,
      assetsDraggable,
      uploadsDraggable,
    };
  }, PROBE_DATA);
  console.log('── Task 7(d): library items have draggable="true" ──');
  console.log(JSON.stringify(t7d, null, 2));

  // Task 7 assertions
  if (!t7a.dest_was_image2) assertions.push(`FAIL: Task 7(a) insertLibraryAsset should write to image2 (selectedPhoto), but image2=${t7a.image2Value}`);
  if (!t7a.imageUnchanged) assertions.push(`FAIL: Task 7(a) deck[cur].image should be unchanged, got ${t7a.imageValue}`);
  if (!t7b.imageUpdated) assertions.push(`FAIL: Task 7(b) insertLibraryAsset should update libTargetKey when selectedPhoto=null, got image=${t7b.imageValue}`);
  if (!t7c.imageMatches) assertions.push(`FAIL: Task 7(c) placeAssetIntoCell did not set deck[cur].image, got ${t7c.imageValue}`);
  if (!t7c.renderAllCalled) assertions.push('FAIL: Task 7(c) placeAssetIntoCell did not call renderAll');
  if (t7d.assetCount > 0 && !t7d.assetsDraggable) assertions.push('FAIL: Task 7(d) [data-asset] items missing draggable="true"');
  if (t7d.uploadCount > 0 && !t7d.uploadsDraggable) assertions.push('FAIL: Task 7(d) [data-upload] items missing draggable="true"');

  console.log('\n── Assertion results ──');
  if (assertions.length === 0) {
    console.log('ALL PASS ✓');
  } else {
    assertions.forEach(a => console.log(a));
    process.exitCode = 1;
  }

  await browser.close();
})();
