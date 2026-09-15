const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('CONSOLE ERROR: ' + msg.text()); });

  await page.goto('http://localhost:8791/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  console.log('--- boot ---');
  console.log('title:', await page.title());
  console.log('errors so far:', errors.length ? errors.join(' | ') : 'none');

  // find a data-player row on the current (Live) tab
  await page.waitForTimeout(300);
  let rows = await page.$$('[data-player]');
  console.log('data-player rows on Live tab:', rows.length);

  // go to Rosters tab which should reliably have rostered players
  const tabs = await page.$$eval('[data-tab], .tabbar button, nav button', els => els.map(e => e.textContent.trim()));
  console.log('tab labels found:', JSON.stringify(tabs).slice(0, 300));

  await browser.close();
  if (errors.length) { console.log('FAIL: console/page errors present'); process.exit(1); }
  console.log('OK: no console/page errors on boot');
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(1); });
