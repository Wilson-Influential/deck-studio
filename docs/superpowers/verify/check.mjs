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

  console.log('\n── Assertion results ──');
  if (assertions.length === 0) {
    console.log('ALL PASS ✓');
  } else {
    assertions.forEach(a => console.log(a));
    process.exitCode = 1;
  }

  await browser.close();
})();
