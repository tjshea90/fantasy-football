const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 420, height: 800 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (t.indexOf('ERR_CERT_AUTHORITY_INVALID') >= 0 || t.indexOf('favicon') >= 0) return; // sandbox network noise
      errors.push('CONSOLE ERROR: ' + t);
    }
  });
  await page.goto('http://localhost:8791/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // go to Rosters tab, reliably has [data-player] rows
  await page.click('text=👥Roster');
  await page.waitForTimeout(500);
  let rows = await page.$$('[data-player]');
  console.log('Rosters tab data-player rows:', rows.length);
  if (!rows.length) { console.log('FAIL: no data-player rows on Rosters'); process.exit(1); }

  // simulate a long press: touchstart on the row, wait >500ms, touchend
  const row = rows[0];
  const box = await row.boundingBox();
  console.log('long-pressing row at', box);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  // touchscreen.tap is instantaneous; need a manual dispatch for a true long-press
  await row.dispatchEvent('touchstart', { touches: [{ clientX: box.x + 5, clientY: box.y + 5 }] });
  await page.waitForTimeout(650); // > LONGPRESS_MS (500)
  await row.dispatchEvent('touchend', { touches: [] });
  await page.waitForTimeout(300);

  const dlgVisible = await page.$('dialog[open], .modal, .dlg, [role=dialog]');
  const cancelBtn = await page.$('button:has-text("Cancel")');
  const viewBtn = await page.$('button:has-text("View stats")');
  console.log('dialog-ish element found:', !!dlgVisible, 'Cancel button:', !!cancelBtn, 'View stats button:', !!viewBtn);

  if (cancelBtn) {
    // this is the exact scoping fix: clicking Cancel inside the just-opened
    // dialog, WITHIN the 400ms suppression window, must actually work now
    await cancelBtn.click();
    await page.waitForTimeout(200);
    const stillThere = await page.$('button:has-text("Cancel")');
    console.log('Cancel button dismissed the dialog:', !stillThere);
    if (stillThere) { console.log('FAIL: Cancel click was suppressed'); process.exit(1); }
  } else {
    console.log('NOTE: no Cancel button found after long-press — could not exercise the click-suppression fix directly');
  }

  console.log('errors after long-press interaction:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
  if (errors.length) { console.log('FAIL: unexpected console/page errors'); process.exit(1); }
  console.log('OK: long-press + dialog interaction clean');
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
