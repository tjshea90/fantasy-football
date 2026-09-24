/* test_retention.js — what reaches the phone's flash, and when (full test,
 * 2026-09-24). ES2018-agnostic (node).
 *
 *   1. A HAND ADJUSTMENT MUST SURVIVE A COLD START. Stat lines live in the
 *      ARCHIVE file (store.js header), which save() writes only when
 *      something marked it dirty. The Live player card's "Adjust" -> Save set
 *      line.manualAdj directly and called Store.save() — nothing marked the
 *      archive, so on a finished week (no more syncs to mark it) the
 *      adjustment never reached disk and was gone on the next launch.
 *
 *   2. THE LIVE POLL MUST NOT REWRITE THE SEASON EVERY 45 SECONDS. Every
 *      quiet in-progress sync called setBook() -> the whole archive (every
 *      scored week's book and stat lines: ~200 KB after week 2, ~1.5-1.9 MB
 *      by late season) was serialised and fsynced per tick, and every tick
 *      counted toward the every-10-saves auto-backup (~1.5 MB each, 8 kept),
 *      so one hour of live polling rotated every older backup away.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const A = path.join(__dirname, '..', 'app', 'assets');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  OK   ' + m); } else { fail++; console.log('  FAIL ' + m); } }

const MODULES = ['version.js', 'seed.js', 'players.js', 'scoring.js', 'names.js', 'espn.js', 'store.js'];

/* A controllable clock: timers only fire when the test says time passed. */
function fakeTimers() {
  let now = 0, seq = 0;
  const q = new Map();
  return {
    setTimeout(fn, ms) { const id = ++seq; q.set(id, { at: now + (ms || 0), fn }); return id; },
    clearTimeout(id) { q.delete(id); },
    advance(ms) {
      now += ms;
      for (;;) {
        let best = null;
        for (const [id, t] of q) if (t.at <= now && (!best || t.at < best[1].at)) best = [id, t];
        if (!best) break;
        q.delete(best[0]); best[1].fn();
      }
    },
    pending() { return q.size; }
  };
}

function boot(disk, timers) {
  const writes = {}, backups = [];
  const native = {
    load: (k) => (Object.prototype.hasOwnProperty.call(disk, k) ? disk[k] : null),
    save: (k, s) => { disk[k] = s; writes[k] = (writes[k] || 0) + 1; return true; },
    backupAuto: (s) => { backups.push(s.length); return true; }
  };
  const sb = { console, window: null, Date, Math, JSON, Native: native,
               setTimeout: timers ? timers.setTimeout : setTimeout,
               clearTimeout: timers ? timers.clearTimeout : clearTimeout };
  sb.window = sb;
  vm.createContext(sb);
  for (const f of MODULES) vm.runInContext(fs.readFileSync(path.join(A, f), 'utf8'), sb, { filename: f });
  sb.Store.init(sb.SEED);
  return { sb, writes, backups };
}
const ARCH = 'fftracker_archive_v1';

/* ======================================================================== */
console.log('\n-- 1. a manual adjustment survives a cold start --');
{
  const disk = {};
  let { sb } = boot(disk);
  let { Store, Scoring } = sb;
  const me = 'myteam', wk = 2;
  const pid = Store.team(me).players[0].id;
  const line = Scoring.emptyLine(); line.played = true; line.pass.cmp = 20; line.pass.yds = 250;
  Store.setLine(wk, pid, line);
  Store.save();                                   /* the sync's own save: archive written */
  const before = Store.playerPoints(wk, pid);

  /* exactly what the Live tab's player card does on "Save adjustment" */
  if (Store.setAdj) Store.setAdj(wk, pid, 5);
  else { Store.lineFor(wk, pid).manualAdj = 5; Store.save(); }
  ok(Math.abs(Store.playerPoints(wk, pid) - (before + 5)) < 1e-9,
     'in memory: ' + before + ' -> ' + Store.playerPoints(wk, pid));

  /* the process dies; a cold start reads what is on flash */
  ({ sb } = boot(disk));
  ({ Store } = sb);
  const back = Store.lineFor(wk, pid);
  ok(back && Number(back.manualAdj) === 5,
     'after a cold start the +5 is still on his line (manualAdj=' + (back && back.manualAdj) + ')' +
     ' <-- v8.5 lost it: the archive was never marked dirty');
  ok(Math.abs(Store.playerPoints(wk, pid) - (before + 5)) < 1e-9,
     'and his points still include it (' + Store.playerPoints(wk, pid) + ')');

  const src = fs.readFileSync(path.join(A, 'ui.js'), 'utf8');
  const at = src.indexOf("'Save adjustment'");
  const win = at > 0 ? src.slice(at, at + 700) : '';
  ok(/Store\.setAdj\(/.test(win) && !/line\.manualAdj\s*=/.test(win),
     'ui.js: the Adjust dialog saves through Store.setAdj, not a bare line.manualAdj write');
}

/* ======================================================================== */
console.log('\n-- 2. the live poll does not rewrite the season every tick --');
{
  const timers = fakeTimers();
  const disk = {};
  const { sb, writes, backups } = boot(disk, timers);
  const { Store } = sb;
  const wk = 3;
  /* two finished weeks already on file, the size a real week-3 archive has */
  const fat = {};
  for (let i = 0; i < 900; i++) fat['player ' + i] = { n: 'Player ' + i, t: 'KC', p: 12.3, pa: 0, cr: 5, tg: 6 };
  Store.setBook(1, fat); Store.setBook(2, fat); Store.save();
  const a0 = writes[ARCH] || 0, b0 = backups.length;

  /* an hour of Sunday: 80 quiet ticks, games in progress */
  for (let t = 0; t < 80; t++) {
    Store.setBook(wk, { tick: { n: 'tick', t: 'KC', p: t, pa: 0, cr: 0, tg: 0 } }, true);
    if (Store.saveLive) Store.saveLive(); else Store.save();
    timers.advance(45000);
  }
  const aw = (writes[ARCH] || 0) - a0, bw = backups.length - b0;
  ok(aw <= 13, 'archive written ' + aw + ' times in 80 live ticks (lazily, at most every 5 min)' +
               ' <-- v8.5: once per tick');
  ok(bw === 0, 'auto-backups taken by the live poll alone: ' + bw +
               ' <-- v8.5: one every 10 ticks, rotating the 8 kept backups away within the hour');

  /* nothing is lost on the way out: onPause flushes */
  Store.setBook(wk, { tick: { n: 'tick', t: 'KC', p: 999, pa: 0, cr: 0, tg: 0 } }, true);
  if (Store.saveLive) Store.saveLive(); else Store.save();
  Store.flush();
  const onDisk = JSON.parse(disk[ARCH]);
  ok(onDisk.book && onDisk.book['3'] && onDisk.book['3'].tick && onDisk.book['3'].tick.p === 999,
     'flush() (the app being backgrounded) writes the latest live book');

  /* the week going final, or a manual sync, is written at once */
  const a1 = writes[ARCH] || 0;
  Store.setBook(wk, { fin: { n: 'fin', t: 'KC', p: 1, pa: 0, cr: 0, tg: 0 } });
  Store.save();
  ok((writes[ARCH] || 0) === a1 + 1, 'a final/manual sync writes the archive immediately');
  ok(JSON.parse(disk[ARCH]).book['3'].fin, '... with the final book in it');

  /* a lazy mark still lands on its own if nothing else saves */
  const a2 = writes[ARCH] || 0;
  Store.setBook(wk, { late: { n: 'late', t: 'KC', p: 2, pa: 0, cr: 0, tg: 0 } }, true);
  if (Store.saveLive) Store.saveLive(); else Store.save();
  timers.advance(5 * 60000 + 1000);
  ok((writes[ARCH] || 0) >= a2 + 1 && JSON.parse(disk[ARCH]).book['3'].late,
     'left alone, the lazily-marked archive is written within ~5 minutes');

  /* ordinary edits still count toward the backup cadence */
  const b1 = backups.length;
  for (let i = 0; i < 10; i++) Store.save();
  ok(backups.length - b1 === 1, 'ten ordinary saves still take one auto-backup');

  const ui = fs.readFileSync(path.join(A, 'ui.js'), 'utf8');
  ok(/Store\.setBook\(syncedWeek, book, lazyArch\)/.test(ui) && /if \(lazyArch\) Store\.saveLive\(\); else Store\.save\(\);/.test(ui),
     'ui.js doSync: a quiet in-progress sync marks the archive lazily and saves with saveLive()');
}

/* ======================================================================== */
console.log('\n-- 3. a failed injury-feed refresh keeps the designations it had --');
(function () {
  const disk = {};
  function bootNews() {
    const sb = { console, window: null, setTimeout, clearTimeout, Date, Math, JSON,
                 Native: { load: (k) => (disk[k] === undefined ? null : disk[k]), save: (k, s) => { disk[k] = s; return true; } } };
    sb.window = sb;
    vm.createContext(sb);
    for (const f of ['version.js', 'seed.js', 'players.js', 'scoring.js', 'names.js', 'playerdb.js', 'espn.js',
                     'store.js', 'usage.js', 'projections.js', 'ai.js', 'recommend.js']) {
      vm.runInContext(fs.readFileSync(path.join(A, f), 'utf8'), sb, { filename: f });
    }
    sb.Store.init(sb.SEED);
    if (sb.Recommend.loadCaches) sb.Recommend.loadCaches();
    return sb;
  }
  const feed = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'espn_injuries_sample.json'), 'utf8'));
  const who = feed.injuries[0].injuries[0].athlete.displayName, status = String(feed.injuries[0].injuries[0].status).toUpperCase();
  let sb = bootNews();
  sb.Espn._httpGetH = sb.Espn._httpGet = () => Promise.resolve(JSON.parse(JSON.stringify(feed)));
  return sb.Recommend.loadNews(null, { force: true }).then(function (nc) {
    const n0 = nc.count;
    ok(n0 === 6, 'a good fetch: ' + n0 + ' records (' + who + ' is ' + status + ')');
    sb.Espn._httpGetH = sb.Espn._httpGet = () => Promise.reject(new Error('offline'));
    return sb.Recommend.loadNews(null, { force: true }).then(function (bad) {
      const now = sb.Recommend.newsCache();
      ok(now.count === n0 && !!now.error, 'a failed refresh KEEPS the ' + now.count + ' records and records the error' +
         '  <-- v8.5 replaced them with 0 and saved that');
      const h = sb.Recommend.health({ name: who });
      ok(h.label !== '', who + ' is still flagged ' + (h.label || '(nothing)') + ' after the failed refresh');
      ok(bad.failedNow === true && bad.firstFailure === true, 'the caller is told it failed (and that it is the first failure)');
      sb = bootNews();                                  /* a cold start reads what was saved */
      ok(sb.Recommend.newsCache().count === n0, 'and a cold start still has them (' + sb.Recommend.newsCache().count + ')');
      const ui = fs.readFileSync(path.join(A, 'ui.js'), 'utf8');
      ok(/!nc\.reused && \(!nc\.failedNow \|\| nc\.firstFailure\)\) render\(\);/.test(ui),
         'ui.js: the live poll re-renders on new data or the first failure, not on every failed tick');
    });
  }).then(finish, function (e) { ok(false, 'threw: ' + (e && e.stack || e)); finish(); });
}());
function finish() {
console.log('\n  ' + (fail ? fail + ' FAILED, ' : '') + pass + ' passed');
if (fail) { console.log('  retention checks FAILED'); process.exit(1); }
console.log('  retention checks pass');
}
