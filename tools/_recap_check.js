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

  // fabricate a fully-scored week 1 directly through Store, mirroring what a
  // real sync would leave behind, then force a re-render
  const built = await page.evaluate(() => {
    try {
      const S = window.Store.get();
      const week = 1;
      S.weekMeta[String(week)] = { synced: true, allFinal: true, games: 5, at: new Date().toISOString() };
      // give every team a manual score so Store.teamWeekPoints/standings has
      // something real to summarize — recap.js reads real scored data
      S.teams.forEach(function (t, i) {
        window.Store.setManualScore(week, t.id, 80 + i * 3);
      });
      window.Store.save();
      const r = window.Recap.build(week);
      return { ok: !!r, high: r && r.high, hasText: !!window.Recap.text(week) };
    } catch (e) { return { error: String(e && e.stack || e) }; }
  });
  console.log('Recap.build sanity from inside the page:', JSON.stringify(built));

  await page.click('text=⚙Data');
  await page.waitForTimeout(300);
  await page.click('button:has-text("League")');
  await page.waitForTimeout(300);

  // re-render so the recap card picks up the newly-scored week
  await page.evaluate(() => { window.__appResume ? null : null; });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.click('text=⚙Data');
  await page.waitForTimeout(300);
  await page.click('button:has-text("League")');
  await page.waitForTimeout(300);

  const recapBtn = await page.$('button:has-text("View week")');
  console.log('recap "View week" button present:', !!recapBtn);
  if (recapBtn) {
    await recapBtn.click();
    await page.waitForTimeout(300);
    const dialogText = await page.$eval('pre', el => el.textContent).catch(() => null);
    console.log('dialog pre content (first 200 chars):', dialogText ? dialogText.slice(0, 200) : null);
    const shareBtn = await page.$('button:has-text("Share")');
    const copyBtn = await page.$('button:has-text("Copy")');
    const writeBtn = await page.$('button:has-text("Write it up with Claude")');
    console.log('Share button:', !!shareBtn, 'Copy button:', !!copyBtn,
                'Write-it-up button (should be ABSENT, no API key configured):', !!writeBtn);
    if (shareBtn) { await shareBtn.click(); await page.waitForTimeout(200); }
    if (copyBtn) { await copyBtn.click(); await page.waitForTimeout(200); }
  }

  console.log('errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
  if (errors.length) { console.log('FAIL'); process.exit(1); }
  console.log('OK');
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
