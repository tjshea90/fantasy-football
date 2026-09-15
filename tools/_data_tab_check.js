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
  await page.waitForTimeout(400);

  const subtabLabels = await page.$$eval('button', els =>
    els.filter(e => ['League','Claude','Sync & data','App'].includes(e.textContent.trim()))
       .map(e => e.textContent.trim()));
  console.log('sub-nav buttons found:', JSON.stringify(subtabLabels));

  const groups = ['League', 'Claude', 'Sync & data', 'App'];
  const expectedHeadings = {
    'League': ['Enter week', 'Standings', 'matchups', 'Weekly recap', 'Scoring rules'],
    'Claude': ['Claude reasoning', 'Claude costs'],
    'Sync & data': ['Stats feed', 'Player database'],
    'App': ['Lineup alerts', 'Live updating', 'Screen fit', 'Backup', 'About']
  };
  for (const g of groups) {
    const btn = await page.$('button:has-text("' + g + '")');
    if (!btn) { console.log('FAIL: no button for', g); continue; }
    await btn.click();
    await page.waitForTimeout(300);
    const headings = await page.$$eval('h2', els => els.map(e => e.textContent.trim()));
    const missing = expectedHeadings[g].filter(exp => !headings.some(h => h.indexOf(exp) >= 0));
    console.log(g + ' -> headings:', JSON.stringify(headings), missing.length ? ('MISSING: ' + JSON.stringify(missing)) : 'all present');
  }

  // exercise the recap card specifically on League
  await page.click('button:has-text("League")');
  await page.waitForTimeout(300);
  const recapBtnText = await page.$eval('h2:has-text("Weekly recap")', h2 => {
    let el = h2.parentElement;
    return el ? el.textContent : null;
  }).catch(() => null);
  console.log('Weekly recap card text:', recapBtnText);

  console.log('errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
  if (errors.length) { console.log('FAIL'); process.exit(1); }
  console.log('OK');
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
