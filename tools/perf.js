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
 *   node tools/perf.js --state S --bootprofile  # where the cold-start time goes
 *   node tools/perf.js --state S --tracesaves   # who called Native.save during boot
 *   node tools/perf.js --state S --crawl        # operate EVERY control on every screen, report errors
 *   node tools/perf.js --state S --netlog --idle 15   # every request the app makes, boot + 15s idle
 *   node tools/perf.js --state S --advice --save S2   # run Lineups>Advice "Sync advice" first
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
/* read from the page at run time; a "tab>Chip" entry means "open the tab,
   then tap the sub-view chip with that label" (Lineups>Advice, 2026-09-23b) */
let TABS = [];
const SUBVIEWS = ['lineups>Advice'];
const ROOT = opt('root', null) ? path.resolve(opt('root')) : path.resolve(__dirname, '..', 'app', 'assets');

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
    colorScheme: DARK ? 'dark' : 'light',
    /* the phone is in the US: the schedule's early-kickoff flag is by LOCAL
       weekday, and in UTC a Monday-night game reads as Tuesday */
    timezoneId: opt('tz', 'America/New_York'), locale: 'en-US'
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const initial = {};
  if (STATE) Object.assign(initial, JSON.parse(fs.readFileSync(STATE, 'utf8')));
  if (opt('tracesaves', false)) initial.__trace = '1';
  const NETLOG = !!opt('netlog', false), t00 = Date.now();
  await page.exposeFunction('__perfFetch', (u, h, b) => {
    if (NETLOG) console.log(`  net +${((Date.now() - t00) / 1000).toFixed(1)}s ${b !== null && b !== undefined ? 'POST' : 'GET '} ${u.slice(0, 150)}`);
    return curl(u, h, b);
  });
  await page.addInitScript((files) => {
    const disk = files;
    const results = {};
    let seq = 0;
    window.__perfDisk = disk;
    window.__perfSaves = 0;
    window.__perfTrace = files.__trace ? [] : null;
    window.__perfSaveChars = 0;
    window.Native = {
      load: (k) => (Object.prototype.hasOwnProperty.call(disk, k) ? disk[k] : null),
      save: (k, s) => {
        disk[k] = s; window.__perfSaves++; window.__perfSaveChars += s.length;
        if (window.__perfTrace) window.__perfTrace.push(k + ' ' + String(new Error().stack).split('\n').slice(2, 9).map((l) => l.trim().replace(/^at /, '').replace(/\(file:.*\/([^/]+:\d+):\d+\)/, '$1')).join(' < '));
        return true;
      },
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
    /* first paint of real content, for the boot number; and the moment the
       last <script> finished (DOMContentLoaded fires after all of them, and
       this listener is registered before ui.js's boot listener) */
    window.__perfBootAt = null;
    window.__perfScriptsDone = null;
    document.addEventListener('DOMContentLoaded', function () { window.__perfScriptsDone = performance.now(); });
    new MutationObserver(function (list, obs) {
      const v = document.getElementById('view');
      if (v && v.firstChild && window.__perfBootAt === null) { window.__perfBootAt = performance.now(); obs.disconnect(); }
    }).observe(document, { childList: true, subtree: true });
  }, initial);

  const cdp = await ctx.newCDPSession(page);
  if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

  const BOOTPROF = !!opt('bootprofile', false);
  if (BOOTPROF) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start'); }
  const t0 = Date.now();
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__perfBootAt !== null, null, { timeout: 60000 });
  if (BOOTPROF) {
    const prof = (await cdp.send('Profiler.stop')).profile;
    const byId = new Map(prof.nodes.map((n) => [n.id, n]));
    const self = new Map(), byFile = new Map();
    prof.samples.forEach((id, i) => {
      const n = byId.get(id), cf = n.callFrame, us = prof.timeDeltas[i] || 0;
      const k = (cf.functionName || '(anon)') + ' ' + path.basename(cf.url || '') + ':' + (cf.lineNumber + 1);
      self.set(k, (self.get(k) || 0) + us);
      const f = path.basename(cf.url || '') || cf.functionName;
      byFile.set(f, (byFile.get(f) || 0) + us);
    });
    const top = (m, n) => [...m.entries()].filter(([k]) => !/\((idle)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, us]) => k + ' ' + Math.round(us / 1000) + 'ms').join(' | ');
    console.log('boot profile by file: ' + top(byFile, 12));
    console.log('boot profile top fns: ' + top(self, 12));
  }
  const boot = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return { firstContent: Math.round(window.__perfBootAt), dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd),
             scripts: Math.round(window.__perfScriptsDone - nav.responseEnd), bootFn: Math.round(window.__perfBootAt - window.__perfScriptsDone),
             saves: window.__perfSaves };
  });
  if (opt('tracesaves', false)) console.log('saves so far:\n  ' + (await page.evaluate(() => window.__perfTrace)).join('\n  '));
  console.log(`throttle ${THROTTLE}x · boot: first content ${boot.firstContent}ms (loading+running scripts ${boot.scripts}ms, boot() to first content ${boot.bootFn}ms, ${boot.saves} saves) · load ${boot.load}ms`);

  if (opt('advice', false)) {
    /* Lineups -> Advice -> "Sync advice": loads the week's projections and
       the injury feed (no Claude key here, so that step is skipped cleanly) */
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.evaluate(() => {
      document.querySelector('#tabs .tab[data-v="live"]').click();
      document.querySelector('#tabs .tab[data-v="lineups"]').click();
      const chip = Array.prototype.filter.call(document.querySelectorAll('#view button'), (x) => x.textContent === 'Advice')[0];
      if (chip) chip.click();
      const go = Array.prototype.filter.call(document.querySelectorAll('#view button'), (x) => /^Sync advice/.test(x.textContent))[0];
      if (go) go.click();
    });
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => document.getElementById('job').hidden, null, { timeout: 240000, polling: 500 });
    await page.evaluate(() => { let g = 0; while (document.querySelectorAll('[role=dialog]').length && g++ < 5) window.__onBack(); });
    console.log('advice sync done: ' + await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#view h2'), (h) => h.textContent).join(' | ')));
    if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  }
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
      let js = 0;
      /* the marker is queued BEFORE the tap runs, so its after-paint timer is
         ahead of any afterPaint() work the render itself defers — "to-frame"
         is the frame that shows the new screen, not the fills that follow it */
      requestAnimationFrame(() => setTimeout(() => resolve({ js: js, frame: performance.now() - a }), 0));
      f();
      js = performance.now() - a;
    }), fn);
  }
  TABS = (await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#tabs .tab'), (t) => t.getAttribute('data-v')))).concat(SUBVIEWS);
  /* ---- --crawl: operate every control on every screen (full-test aid) ----
   * For each screen and sub-screen, reload from the ORIGINAL state (so a
   * destructive tap cannot poison the next one), open the screen, then act on
   * control i: tap a button, step a <select>, or type into a text/number box.
   * Any dialog that opens is recorded and dismissed through __onBack (the
   * same path the phone's back gesture takes). Collected: page errors,
   * console errors, and any "This screen hit an error" card. Network taps
   * really go out (ESPN through curl); Claude taps fail cleanly without a key. */
  async function crawl() {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const SCREENS = [['live'], ['lineups', 'Set lineups'], ['lineups', 'Advice'], ['rosters'], ['wire'],
      ['stats', 'Search'], ['stats', 'By team'], ['stats', 'Top players'],
      ['data', 'League'], ['data', 'Claude'], ['data', 'Sync & data'], ['data', 'App']];
    const WAIT = Number(opt('wait', 500));
    let actions = 0; const problems = [];
    async function open(sc) {
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => window.__perfBootAt !== null, null, { timeout: 60000 });
      await page.evaluate((sc) => {
        const other = sc[0] === 'live' ? 'stats' : 'live';
        document.querySelector('#tabs .tab[data-v="' + other + '"]').click();
        document.querySelector('#tabs .tab[data-v="' + sc[0] + '"]').click();
        if (sc[1]) {
          const b = Array.prototype.filter.call(document.querySelectorAll('#view button'), (x) => x.textContent === sc[1])[0];
          if (b) b.click();
        }
      }, sc);
      await page.waitForTimeout(80);
    }
    /* buttons, selects, text boxes, <details> toggles — and the tappable
       player rows (Live's lineups open the player card) */
    const CTRL = '#view button, #view select, #view input[type=text], #view input[type=number], #view input:not([type]), #view summary, #view .halfbox .row, #view .res';
    function controls() {
      return page.evaluate((CTRL) => Array.prototype.map.call(
        document.querySelectorAll(CTRL),
        (n, i) => ({ i, sel: CTRL, tag: n.tagName, label: (n.textContent || n.placeholder || n.getAttribute('aria-label') || '').trim().slice(0, 40) })), CTRL);
    }
    for (const sc of SCREENS) {
      await open(sc);
      const list = await controls();
      console.log(`\n== ${sc.join(' > ')}: ${list.length} controls`);
      for (const c of list) {
        const before = errors.length;
        await open(sc);
        const res = await page.evaluate((c) => {
          const all = document.querySelectorAll(c.sel);
          const n = all[c.i];
          if (!n) return { skipped: 'gone after reload' };
          if (n.disabled) return { skipped: 'disabled' };
          if (n.tagName === 'SELECT') {
            if (n.options.length > 1) { n.selectedIndex = (n.selectedIndex + 1) % n.options.length; n.dispatchEvent(new Event('change', { bubbles: true })); }
          } else if (n.tagName === 'INPUT') {
            n.focus(); n.value = n.type === 'number' ? '123.4' : 'kupp';
            n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true }));
            n.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          } else n.click();
          return { ok: true };
        }, c);
        await page.waitForTimeout(WAIT);
        /* follow one level of non-destructive dialog buttons (⋯ -> Stats) */
        const nested = await page.evaluate(() => {
          const SAFE = /^(Stats|View stats)$/;
          const b = Array.prototype.filter.call(document.querySelectorAll('[role=dialog] button'), (x) => SAFE.test(x.textContent))[0];
          if (!b) return '';
          b.click(); return b.textContent;
        });
        if (nested) await page.waitForTimeout(WAIT);
        const after = await page.evaluate(() => {
          const d = Array.prototype.map.call(document.querySelectorAll('[role=dialog]'), (x) => {
            const h = x.querySelector('h2'); return (h ? h.textContent : '?') + ' [' +
              Array.prototype.map.call(x.querySelectorAll('button'), (b) => b.textContent).join('|') + ']';
          });
          const bad = /This screen hit an error|Something went wrong|Script error/.test(document.getElementById('view').textContent);
          let guard = 0; while (document.querySelectorAll('[role=dialog]').length && guard++ < 6) { if (window.__onBack) window.__onBack(); }
          return { dialogs: d, bad, left: document.querySelectorAll('[role=dialog]').length,
                   err: bad ? document.getElementById('view').textContent.slice(0, 300) : '' };
        });
        actions++;
        const newErr = errors.slice(before);
        const tag = `${c.tag.toLowerCase()} "${c.label}"`;
        if (res.skipped) { console.log(`   - ${tag}: skipped (${res.skipped})`); continue; }
        if (newErr.length || after.bad || after.left) {
          problems.push(`${sc.join('>')} ${tag}: ` + (newErr.join(' || ') + ' ' + after.err + (after.left ? ' [dialog would not close]' : '')).slice(0, 600));
          console.log(`   ! ${tag}: PROBLEM`);
        } else console.log(`   . ${tag}${after.dialogs.length ? '  -> dialog ' + after.dialogs.join(' / ') : ''}`);
      }
    }
    console.log(`\ncrawl: ${actions} actions, ${problems.length} problem(s)`);
    problems.forEach((p) => console.log('  PROBLEM ' + p));
    await browser.close();
    process.exit(problems.length ? 1 : 0);
  }
  function clickSrc(entry) {
    const [tab, chip] = entry.split('>');
    let src = `document.querySelector('#tabs .tab[data-v="${tab}"]').click();`;
    if (chip) src += `Array.prototype.filter.call(document.querySelectorAll('#view button'), (b) => b.textContent === ${JSON.stringify(chip)})[0].click();`;
    return src;
  }
  function resetSrc(entry) {
    /* leave any sub-view on its default so the next entry starts clean */
    return entry.indexOf('>') > 0 ? clickSrc(entry.split('>')[0] + '>Set lineups') : '';
  }
  if (opt('idle', false)) {
    await page.waitForTimeout(Number(opt('idle')) * 1000);
    console.log('idle done');
    await browser.close(); process.exit(errors.length ? 1 : 0);
  }
  if (opt('crawl', false)) { await crawl(); return; }
  const rows = [];
  if (PROFILE) await cdp.send('Profiler.enable');
  for (const tab of TABS) {
    const js = [], fr = [];
    if (PROFILE) { await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start'); }
    for (let r = 0; r < REPS; r++) {
      const base = tab === 'live' ? 'stats' : 'live';
      await frameAfter(`document.querySelector('#tabs .tab[data-v="${base}"]').click()`);
      const m = await frameAfter(clickSrc(tab));
      js.push(m.js); fr.push(m.frame);
    }
    let prof = null;
    if (PROFILE) prof = (await cdp.send('Profiler.stop')).profile;
    const rs = resetSrc(tab);
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
        await page.screenshot({ path: path.join(SHOTS, tab.replace('>', '-') + '-' + k + '.png') });
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
    if (rs) await frameAfter(rs);
  }
  console.log('tab       js(ms)  to-frame(ms)  dom-nodes   (median of ' + REPS + ', live->tab)');
  for (const r of rows) console.log(`${r.tab.padEnd(14)} ${String(r.js).padStart(6)}  ${String(r.frame).padStart(12)}  ${String(r.nodes).padStart(9)}`);
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
