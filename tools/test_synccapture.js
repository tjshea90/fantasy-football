/* test_synccapture.js — guards the 2026-09-18 doSync week-capture race.
 *
 * Found in the same review pass as the tab-highlight fix. doSync() (ui.js)
 * used to read the shared module-level `week` variable throughout its whole
 * async chain — several real network round trips — instead of snapshotting
 * it once at entry. `week` can be mutated mid-flight by the NFL-week
 * auto-advance (applyCurrentWeek, reachable from syncCurrentWeek() at boot
 * and appResume) OR simply by Tj tapping the week-next arrow while a sync for
 * the OLD week is still in flight — neither path checks `busy` before moving
 * `week`. Without a capture, a sync that started for week N and finished
 * after `week` had already moved to N+1 filed its results — Store.setBook,
 * S.weekMeta, the "N players scored" toast — under week N+1 instead of the
 * week it actually fetched, silently corrupting the wrong week's scored
 * stats. Fixed by capturing `syncWeek = week` once at the top of doSync and
 * using it for every reference to "the week this sync is for" from then on.
 *
 * This test reproduces the exact race: it stalls Espn.weekGames mid-flight,
 * advances `week` (via the real wkNext button, the same path a real tap or
 * an NFL-week auto-advance would take) while the sync is still waiting on
 * it, then lets the sync resolve — and checks the results landed under the
 * WEEK THE SYNC WAS FOR, not wherever `week` ended up.
 *
 * Harness pattern copied from tools/test_tabsafety.js (the proven way to
 * actually execute ui.js's boot()/wire() against a fake DOM).
 */
'use strict';
var fs = require('fs'), path = require('path'), fails = 0;
var vm = require('vm');
function ok(c, m) { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  OK   ' + m); }
function A(f) { return path.join(__dirname, '..', 'app/assets', f); }

function makeEl(tag) {
  var e = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [], style: {}, dataset: {}, attributes: {},
    className: '', textContent: '', value: '', hidden: false,
    disabled: false, selectedIndex: 0, options: [],
    classList: {
      _s: {}, add: function (c) { this._s[c] = 1; }, remove: function (c) { delete this._s[c]; },
      toggle: function (c, on) { if (on) this._s[c] = 1; else delete this._s[c]; },
      contains: function (c) { return !!this._s[c]; }
    },
    appendChild: function (c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild: function (c) { var i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    insertBefore: function (c) { this.children.unshift(c); return c; },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
    removeAttribute: function (k) { delete this.attributes[k]; },
    addEventListener: function (t, fn) { (this._h = this._h || {})[t] = fn; },
    removeEventListener: function () { },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    focus: function () { }, blur: function () { }, setSelectionRange: function () { },
    getBoundingClientRect: function () { return { top: 0, left: 0, width: 0, height: 0 }; }
  };
  Object.defineProperty(e, 'innerHTML', {
    get: function () { return this._innerHTML || ''; },
    set: function (v) { this._innerHTML = v; this.children = []; }
  });
  return e;
}

function buildHarness() {
  var ids = {};
  var W = {}; W.window = W;
  W.setTimeout = function (fn, ms) { return setTimeout(fn, ms); };
  W.clearTimeout = function (t) { return clearTimeout(t); };
  W.setInterval = function (fn, ms) { return setInterval(fn, ms); };
  W.clearInterval = function (t) { return clearInterval(t); };
  W.pageYOffset = 0; W.scrollTo = function () { };
  W.requestAnimationFrame = function (fn) { return setTimeout(fn, 0); };
  W.localStorage = (function () {
    var d = {};
    return { getItem: function (k) { return d[k] === undefined ? null : d[k]; },
             setItem: function (k, v) { d[k] = String(v); },
             removeItem: function (k) { delete d[k]; } };
  }());
  var docHandlers = {};
  var TAB_NAMES = ['live', 'lineups', 'rosters', 'wire', 'stats', 'advice', 'data'];
  var tabEls = TAB_NAMES.map(function (n) { var e = makeEl('button'); e.setAttribute('data-v', n); return e; });
  W.document = {
    hidden: false, body: makeEl('body'), documentElement: makeEl('html'),
    createElement: makeEl,
    createTextNode: function (t) { return { nodeType: 3, textContent: String(t) }; },
    getElementById: function (id) { if (!ids[id]) { ids[id] = makeEl('div'); ids[id].id = id; } return ids[id]; },
    querySelector: function () { return null; },
    querySelectorAll: function (sel) { if (String(sel).indexOf('.tab') >= 0) return tabEls; return []; },
    addEventListener: function (t, fn) { docHandlers[t] = fn; },
    removeEventListener: function () { }
  };
  W.Option = function (label, value) {
    var o = makeEl('option'); o.textContent = label; o.value = value === undefined ? label : value;
    return o;
  };
  var disk = {};
  W.Native = { save: function (k, v) { disk[k] = v; return true; },
               load: function (k) { return disk[k] === undefined ? null : disk[k]; },
               online: function () { return true; } };
  W.console = console; W.Promise = Promise;
  W.Date = Date; W.Math = Math; W.JSON = JSON;

  vm.createContext(W);
  function load(f) { vm.runInContext(fs.readFileSync(A(f), 'utf8'), W, { filename: f }); }
  var order = ['version.js', 'seed.js', 'players.js', 'scoring.js', 'espn.js', 'names.js',
               'store.js', 'playerdb.js', 'gamelog.js', 'projections.js', 'usage.js', 'ai.js',
               'recommend.js', 'sim.js', 'ros.js', 'value.js', 'teamreport.js', 'recap.js', 'schedule.js',
               'handoff.js', 'stats.js', 'gestures.js', 'ui.js'];
  order.forEach(load);
  return { W: W, ids: ids, docHandlers: docHandlers, tabEls: tabEls };
}

console.log('\n-- doSync files results under the week it actually fetched, even if `week`' +
            ' moves on mid-flight --');
(function () {
  var h = buildHarness();
  h.docHandlers.DOMContentLoaded();

  var weekGamesCalledWith = [];
  var resolveGames;
  var stalled = new Promise(function (res) { resolveGames = res; });
  h.W.Espn.weekGames = function (season, wk) { weekGamesCalledWith.push(wk); return stalled; };
  /* nothing else in this test lets the "real" Schedule/Recommend network
     paths run far enough to matter, but neither should throw uncaught if
     they do try — everything downstream already wraps its own calls */

  h.ids.syncBtn._h.click();   // fires syncWeek() -> doSync({quiet:false})
  ok(weekGamesCalledWith.length === 1 && weekGamesCalledWith[0] === 1,
     'the sync started for week 1 (fetched week is ' + weekGamesCalledWith[0] + ')');

  /* THE RACE: advance the displayed week to 2 WHILE the sync above is still
     stalled waiting on Espn.weekGames — the exact same button tap Tj can make
     any time a sync is running, and the exact same effect an NFL-week
     auto-advance landing mid-sync would have (see doSync's own comment). */
  try { h.ids.wkNext._h.click(); } catch (e) { /* freshenSchedule etc. reaching for the network is fine */ }
  ok(h.W.Store.get().settings.currentWeek === 2, 'the displayed week moved to 2 while the sync was still in flight');

  resolveGames([]);   /* no games this week — the simplest way to let the rest of the chain resolve on its own */

  return new Promise(function (resolve) { setTimeout(resolve, 20); }).then(function () {
    var wm1 = h.W.Store.get().weekMeta['1'];
    var wm2 = h.W.Store.get().weekMeta['2'];
    ok(!!(wm1 && wm1.synced), 'week 1 — the week actually synced — got its weekMeta written');
    ok(!(wm2 && wm2.synced),
       'THE FIX: week 2 — merely the week the display had moved to — did NOT get this sync\'s ' +
       'results' + ((wm2 && wm2.synced) ? '  <-- the sync\'s results leaked into the wrong week' : ''));
    ok(Object.prototype.hasOwnProperty.call(h.W.Store.get().book, '1'),
       'the league book was written for week 1');
    ok(!Object.prototype.hasOwnProperty.call(h.W.Store.get().book, '2'),
       'and NOT for week 2');

    console.log(fails ? ('\n  ' + fails + ' sync-capture check(s) FAILED') : '\n  sync-capture checks pass');
    process.exit(fails ? 1 : 0);
  });
})();
