/* tools/perf.js — measure the app the way a mid-range phone would feel it.
 *
 * Loads app/assets/index.html in the pre-installed headless Chromium with a
 * phone-sized viewport, CPU throttled (default 4x — a rough stand-in for a
 * Moto G-class SoC against this container's desktop core), and a stub of the
 * Java `Native` bridge:
 *   - load/save keep the state in memory (seeded from --state FILE if given)
 *   - httpAsync fetches the REAL url through curl (so the proxy + CA apply)
 *     and wakes the page through window.__httpDone, exactly like NativeBridge
 *
 * It is NOT a device test — there is no phone or emulator here. It measures
 * the page's own JS/layout cost, which is the part this repo controls.
 *
 *   node tools/perf.js                          # cold seed, measure every tab
 *   node tools/perf.js --sync 1,2,3 --save S    # run real syncs, keep the state
 *   node tools/perf.js --state S                # measure against a saved state
 *   node tools/perf.js --state S --shots DIR    # also screenshot every tab
 *                                             #   (--slices N viewport-height slices each, default 2)
 *   node tools/perf.js --state S --profile      # top self-time functions per tab
 *   node tools/perf.js --state S --dark 0       # light theme (prefers-color-scheme)
 *
 * Dev tool only: not a test_*.js, so ckpt.sh/ship.sh never run it (it needs
 * Chromium and the network). ES2018 rules do not apply to this file — it runs
 * in node, never in the app.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }

const args = process.argv.slice(2);
function opt(name, dflt) {
  const i = args.indexOf('--' + name);
  if (i < 0) return dflt;
  const v = args[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}
const THROTTLE = Number(opt('throttle', 4));
const STATE = opt('state', null);
const SAVE = opt('save', null);
const SHOTS = opt('shots', null);
const PROFILE = !!opt('profile', false);
const SYNC = opt('sync', null);
const REPS = Number(opt('reps', 5));
const DARK = opt('dark', '1') !== '0';
const SLICES = Number(opt('slices', 2));
const TABS = ['live', 'lineups', 'rosters', 'wire', 'stats', 'advice', 'data'];
const ROOT = path.resolve(__dirname, '..', 'app', 'assets');

function curl(url, headersJson, body) {
  return new Promise((resolve) => {
    const a = ['-sS', '--compressed', '--max-time', '40', url];
    if (headersJson) {
      try {
        const h = JSON.parse(headersJson);
        for (const k of Object.keys(h)) a.push('-H', k + ': ' + h[k]);
      } catch (e) { /* no headers */ }
    }
    if (body !== null && body !== undefined) a.push('-X', 'POST', '--data-binary', String(body));
    execFile('curl', a, { maxBuffer: 64 * 1024 * 1024 }, (err, out) => {
      if (err) resolve('\u0001ERR\u0001' + String(err.message).slice(0, 200));
      else resolve(out);
    });
  });
}

(async () => {
  const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
    colorScheme: DARK ? 'dark' : 'light'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const initial = {};
  if (STATE) Object.assign(initial, JSON.parse(fs.readFileSync(STATE, 'utf8')));
  await page.exposeFunction('__perfFetch', (u, h, b) => curl(u, h, b));
  await page.addInitScript((files) => {
    const disk = files;
    const results = {};
    let seq = 0;
    window.__perfDisk = disk;
    window.__perfSaves = 0;
    window.__perfSaveChars = 0;
    window.Native = {
      load: (k) => (Object.prototype.hasOwnProperty.call(disk, k) ? disk[k] : null),
      save: (k, s) => { disk[k] = s; window.__perfSaves++; window.__perfSaveChars += s.length; return true; },
      backupAuto: () => true, backupList: () => '[]', backupLoad: () => null,
      online: () => true,
      httpAsync: (u, h, b) => {
        const id = 'r' + (++seq);
        window.__perfFetch(u, h, b).then((out) => { results[id] = out; window.__httpDone(id); });
        return id;
      },
      httpTake: (id) => { const b = results[id]; delete results[id]; return b === undefined ? null : b; },
      httpForget: (id) => { delete results[id]; },
      httpChunk: () => null, httpRelease: () => {},
      alertsSet: () => true, alertsStatus: () => '{}', alertsTest: () => {},
      share: () => true, copy: () => true, export: () => true, exportShare: () => true,
      exportFile: () => true, pickFile: () => false
    };
    /* first paint of real content, for the boot number */
    window.__perfBootAt = null;
    new MutationObserver(function (list, obs) {
      const v = document.getElementById('view');
      if (v && v.firstChild && window.__perfBootAt === null) { window.__perfBootAt = performance.now(); obs.disconnect(); }
    }).observe(document, { childList: true, subtree: true });
  }, initial);

  const cdp = await ctx.newCDPSession(page);
  if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

  const t0 = Date.now();
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__perfBootAt !== null, null, { timeout: 60000 });
  const boot = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return { firstContent: Math.round(window.__perfBootAt), dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd) };
  });
  console.log(`throttle ${THROTTLE}x · boot: first content ${boot.firstContent}ms · DOMContentLoaded ${boot.dcl}ms · load ${boot.load}ms (wall ${Date.now() - t0}ms)`);

  if (SYNC) {
    const weeks = String(SYNC).split(',').map(Number);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    for (const w of weeks) {
      await page.evaluate((w) => {
        const lab = document.getElementById('wkLabel');
        const cur = Number(String(lab.textContent).replace(/\D+/g, '')) || 1;
        const btn = document.getElementById(cur < w ? 'wkNext' : 'wkPrev');
        for (let i = 0; i < Math.abs(w - cur); i++) btn.click();
      }, w);
      const ts = Date.now();
      await page.click('#syncBtn');
      await page.waitForFunction(() => document.getElementById('job').hidden, null, { timeout: 240000, polling: 500 });
      console.log(`synced week ${w} in ${Date.now() - ts}ms: ` + await page.evaluate(() => document.getElementById('syncText').textContent));
    }
    /* let background refreshes (player db, projections, schedule) land */
    await page.waitForTimeout(8000);
    if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  }

  async function frameAfter(fn) {
    return page.evaluate((src) => new Promise((resolve) => {
      const f = new Function(src);
      const a = performance.now();
      f();
      const js = performance.now() - a;
      requestAnimationFrame(() => setTimeout(() => resolve({ js: js, frame: performance.now() - a }), 0));
    }), fn);
  }
  const rows = [];
  if (PROFILE) await cdp.send('Profiler.enable');
  for (const tab of TABS) {
    const js = [], fr = [];
    if (PROFILE) { await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start'); }
    for (let r = 0; r < REPS; r++) {
      const base = tab === 'live' ? 'stats' : 'live';
      await frameAfter(`document.querySelector('#tabs .tab[data-v="${base}"]').click()`);
      const m = await frameAfter(`document.querySelector('#tabs .tab[data-v="${tab}"]').click()`);
      js.push(m.js); fr.push(m.frame);
    }
    let prof = null;
    if (PROFILE) prof = (await cdp.send('Profiler.stop')).profile;
    js.sort((a, b) => a - b); fr.sort((a, b) => a - b);
    const nodes = await page.evaluate(() => document.getElementById('view').getElementsByTagName('*').length);
    rows.push({ tab, js: Math.round(js[js.length >> 1]), frame: Math.round(fr[fr.length >> 1]), nodes });
    if (SHOTS) {
      /* viewport-sized slices, the way the phone actually shows it (fixed
         header and tab bar included), rather than one 20,000px strip */
      fs.mkdirSync(SHOTS, { recursive: true });
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let k = 0; k < SLICES && k * 800 < h; k++) {
        await page.evaluate((y) => window.scrollTo(0, y), k * 800);
        await page.waitForTimeout(50);
        await page.screenshot({ path: path.join(SHOTS, tab + '-' + k + '.png') });
      }
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    if (prof) {
      const self = new Map();
      const byId = new Map(prof.nodes.map((n) => [n.id, n]));
      const dt = prof.timeDeltas; const counts = new Map();
      prof.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (dt[i] || 0)));
      for (const [id, us] of counts) {
        const n = byId.get(id); const cf = n.callFrame;
        const key = (cf.functionName || '(anon)') + ' ' + path.basename(cf.url || '') + ':' + (cf.lineNumber + 1);
        self.set(key, (self.get(key) || 0) + us);
      }
      const top = [...self.entries()].filter(([k]) => !/^\((idle|program|garbage collector)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 8);
      console.log(`  profile ${tab}: ` + top.map(([k, us]) => `${k} ${Math.round(us / 1000)}ms`).join(' | '));
    }
  }
  console.log('tab       js(ms)  to-frame(ms)  dom-nodes   (median of ' + REPS + ', live->tab)');
  for (const r of rows) console.log(`${r.tab.padEnd(9)} ${String(r.js).padStart(6)}  ${String(r.frame).padStart(12)}  ${String(r.nodes).padStart(9)}`);
  const saves = await page.evaluate(() => ({ n: window.__perfSaves, chars: window.__perfSaveChars }));
  console.log(`saves during run: ${saves.n} (${Math.round(saves.chars / 1024)} KB written)`);
  if (SAVE) {
    const disk = await page.evaluate(() => window.__perfDisk);
    fs.writeFileSync(SAVE, JSON.stringify(disk));
    console.log('state written to ' + SAVE);
  }
  if (errors.length) { console.log('PAGE ERRORS:\n  ' + errors.join('\n  ')); }
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
