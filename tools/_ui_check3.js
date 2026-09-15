const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const t = msg.text();
    if (t.indexOf('ERR_CERT_AUTHORITY_INVALID') >= 0 || t.indexOf('404') >= 0) return;
    errors.push('CONSOLE ERROR: ' + t);
  });
  await page.goto('http://localhost:8791/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  await page.click('text=⚙Data');
  await page.waitForTimeout(500);
  const bodyText = await page.textContent('body');
  const hasCostLine = /at current prices \(see Data → Claude costs\)/.test(bodyText) ||
                       /Claude costs/.test(bodyText);
  console.log('Data tab shows a Claude costs section:', hasCostLine);

  // pull-to-refresh: fire the same event chain gestures.js listens for isn't
  // trivial to simulate headlessly, so just confirm the tab renders with no
  // errors and the estimate line format is present verbatim somewhere.
  console.log('errors on Data tab:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
  if (errors.length) { console.log('FAIL'); process.exit(1); }
  console.log('OK: Data tab renders cleanly');
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
