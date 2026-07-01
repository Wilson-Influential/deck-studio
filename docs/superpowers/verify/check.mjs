/**
 * Task 1 verification harness: universal photo selection + image inspector
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

  // ── Test: clicking cell2 on a twoup slide selects image2 ──
  const result = await page.evaluate(async () => {
    // build a twoup slide with two images
    deck[cur] = {
      layout: 'twoup',
      image: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#123"/></svg>'),
      image2: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#456"/></svg>'),
      title: 't'
    };
    renderAll();

    const cell2 = document.querySelector('#preview [data-imgslot="image2"]');
    cell2 && cell2.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const inspectorEl = document.querySelector('#editor [data-img-inspector]');
    const replaceBtn = inspectorEl ? inspectorEl.querySelector('[data-imgact="replace"]') : null;
    const delBtn = inspectorEl ? inspectorEl.querySelector('[data-imgact="delimg"]') : null;

    return {
      hasCell2: !!cell2,
      selectedPhoto: typeof selectedPhoto !== 'undefined' ? selectedPhoto : 'undef',
      inspectorPresent: !!inspectorEl,
      hasReplaceBtn: !!replaceBtn,
      hasDelBtn: !!delBtn,
    };
  });

  console.log('── Before delete ──');
  console.log(JSON.stringify(result, null, 2));

  // ── Test: delete-image removes only image2, keeps image and title ──
  const deleteResult = await page.evaluate(async () => {
    // build fresh twoup slide to ensure clean state
    deck[cur] = {
      layout: 'twoup',
      image: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#123"/></svg>'),
      image2: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#456"/></svg>'),
      title: 'keep-me'
    };
    renderAll();

    // Click cell2 to select it
    const cell2 = document.querySelector('#preview [data-imgslot="image2"]');
    cell2 && cell2.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Now click Delete image button in the inspector
    const delBtn = document.querySelector('#editor [data-imgact="delimg"]');
    delBtn && delBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    return {
      image2Gone: !deck[cur].image2,
      image1Kept: !!deck[cur].image,
      titleKept: deck[cur].title === 'keep-me',
      selectedPhotoCleared: selectedPhoto === null,
    };
  });

  console.log('── After delete ──');
  console.log(JSON.stringify(deleteResult, null, 2));
  console.log('── Console errors ──');
  console.log(JSON.stringify(errors));

  // ── Assertions ──
  const assertions = [];
  if (!result.hasCell2) assertions.push('FAIL: twoup cell2 [data-imgslot="image2"] not found');
  if (result.selectedPhoto !== 'image2') assertions.push(`FAIL: selectedPhoto should be "image2", got "${result.selectedPhoto}"`);
  if (!result.inspectorPresent) assertions.push('FAIL: inspector [data-img-inspector] not found in editor');
  if (!result.hasReplaceBtn) assertions.push('FAIL: Replace button missing');
  if (!result.hasDelBtn) assertions.push('FAIL: Delete image button missing');
  if (!deleteResult.image2Gone) assertions.push('FAIL: delete-image did not remove image2');
  if (!deleteResult.image1Kept) assertions.push('FAIL: delete-image removed image1 (should keep it)');
  if (!deleteResult.titleKept) assertions.push('FAIL: delete-image removed title (should keep it)');
  if (!deleteResult.selectedPhotoCleared) assertions.push('FAIL: selectedPhoto not cleared after delete');
  if (errors.length) assertions.push(`FAIL: ${errors.length} console error(s)`);

  console.log('\n── Assertion results ──');
  if (assertions.length === 0) {
    console.log('ALL PASS ✓');
  } else {
    assertions.forEach(a => console.log(a));
    process.exitCode = 1;
  }

  await browser.close();
})();
