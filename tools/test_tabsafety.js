/* test_tabsafety.js — guards the 2026-09-16 tab-lock bug.
 *
 * Tj: "sometimes when I open the app it is on the live tab and it won't let
 * me press another tab like waiver wire."
 *
 * ROOT CAUSE, confirmed by reading boot() (ui.js): it used to wrap its ENTIRE
 * startup sequence — Store.init, applyAdjust, Recommend.loadCaches,
 * autoFillWeek — in one try/catch, and wire() (the ONLY place that ever
 * attaches click listeners to the bottom tab bar) ran only after all four of
 * those succeeded. If any one of the three after Store.init threw — a
 * corrupted cache read recovering from an interrupted session is the most
 * plausible real trigger — wire() never ran and the tab bar was permanently
 * inert for the rest of the session, with no recovery short of a relaunch.
 *
 * The fix restructured boot() so wire() (and render()) are guaranteed to run
 * once Store.init itself has succeeded, regardless of what throws after that.
 * This suite proves it by deliberately breaking Recommend.loadCaches — the
 * exact shape of failure the bug report describes — and confirming a tab
 * click still works afterward, which no source-text pin could actually show.
 *
 * The DOM stub here is a smaller copy of test_lifecycle.js's own (which is
 * the proven pattern for actually executing ui.js's boot() against a fake
 * DOM) — trimmed to just what boot()/wire()/render() touch, and reused
 * TWICE in the same process on purpose, to prove the fix survives a second,
 * differently-broken boot rather than only a clean first one.
 */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm'), fails = 0;
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
    removeChild: function (c) {
      var i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c;
    },
    insertBefore: function (c) { this.children.unshift(c); return c; },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) {
      return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null;
    },
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
  var tabEls = TAB_NAMES.map(function (n) {
    var e = makeEl('button'); e.setAttribute('data-v', n); return e;
  });
  W.document = {
    hidden: false, body: makeEl('body'), documentElement: makeEl('html'),
    createElement: makeEl,
    createTextNode: function (t) { return { nodeType: 3, textContent: String(t) }; },
    getElementById: function (id) {
      if (!ids[id]) { ids[id] = makeEl('div'); ids[id].id = id; }
      return ids[id];
    },
    querySelector: function () { return null; },
    querySelectorAll: function (sel) {
      if (String(sel).indexOf('.tab') >= 0) return tabEls;
      return [];
    },
    addEventListener: function (t, fn) { docHandlers[t] = fn; },
    removeEventListener: function () { }
  };
  function clickTab(name) {
    for (var i = 0; i < tabEls.length; i++) {
      if (tabEls[i].getAttribute('data-v') === name) {
        return tabEls[i]._h && tabEls[i]._h.click ? tabEls[i]._h.click.call(tabEls[i]) : null;
      }
    }
    return null;
  }
  W.Option = function (label, value) {
    var o = makeEl('option'); o.textContent = label; o.value = value === undefined ? label : value;
    return o;
  };
  var disk = {};
  W.Native = { save: function (k, v) { disk[k] = v; return true; },
               load: function (k) { return disk[k] === undefined ? null : disk[k]; },
               online: function () { return false; } };
  W.console = console; W.Promise = Promise;
  W.Date = Date; W.Math = Math; W.JSON = JSON;

  vm.createContext(W);
  function load(f) { vm.runInContext(fs.readFileSync(A(f), 'utf8'), W, { filename: f }); }
  var order = ['version.js', 'seed.js', 'players.js', 'scoring.js', 'espn.js', 'names.js',
               'store.js', 'playerdb.js', 'gamelog.js', 'projections.js', 'usage.js', 'ai.js',
               'recommend.js', 'sim.js', 'value.js', 'recap.js', 'schedule.js',
               'handoff.js', 'stats.js', 'gestures.js', 'ui.js'];
  order.forEach(load);
  return { W: W, ids: ids, docHandlers: docHandlers, clickTab: clickTab, tabEls: tabEls };
}

console.log('\n-- baseline: a clean boot wires every tab as always --');
(function () {
  var h = buildHarness();
  var threw = null;
  try { h.docHandlers.DOMContentLoaded(); } catch (e) { threw = e; }
  ok(!threw, 'a clean boot does not throw' + (threw ? '  <-- ' + threw.message : ''));
  ok(!!(h.W.Store.get() && h.W.Store.get().teams.length), 'and the season actually initialised');
  var r = h.clickTab('wire');
  ok(r !== null, 'clicking the wire tab reaches the handler wire() attached');
  ok(h.W.Store.get().settings.lastTab === 'wire',
     'and it actually switched — lastTab is now "wire" (got ' +
     h.W.Store.get().settings.lastTab + ')');
})();

console.log('\n-- THE BUG: Recommend.loadCaches throws during startup --');
(function () {
  var h = buildHarness();
  /* the exact shape of failure a corrupted cache read on a real phone would
     produce — recovering from an interrupted session is the plausible real
     trigger CLAUDE.md's own "INTERRUPTED MID-CHANGE" warning describes */
  h.W.Recommend.loadCaches = function () { throw new Error('simulated corrupted cache'); };
  var threw = null;
  try { h.docHandlers.DOMContentLoaded(); } catch (e) { threw = e; }
  ok(!threw, 'boot() does not let that escape' + (threw ? '  <-- ' + threw.message : ''));
  ok(!!(h.W.Store.get() && h.W.Store.get().teams.length),
     'the season still initialised (Store.init ran before the broken call)');

  var r1 = h.clickTab('wire');
  ok(r1 !== null, 'THE FIX: the wire tab click handler still exists and runs' +
     (r1 === null ? '  <-- this is exactly "won\'t let me press another tab"' : ''));
  ok(h.W.Store.get().settings.lastTab === 'wire',
     'and clicking actually switched tabs — lastTab is "wire" (got ' +
     h.W.Store.get().settings.lastTab + ')');

  var r2 = h.clickTab('advice');
  ok(r2 !== null, 'a second tab press still works too');
  ok(h.W.Store.get().settings.lastTab === 'advice',
     'lastTab followed it — "advice" (got ' + h.W.Store.get().settings.lastTab + ')');
})();

console.log('\n-- autoFillWeek throwing is caught the same way --');
(function () {
  var h = buildHarness();
  h.W.Recommend.autoLineup = function () { throw new Error('simulated broken projection'); };
  var threw = null;
  try { h.docHandlers.DOMContentLoaded(); } catch (e) { threw = e; }
  ok(!threw, 'boot() does not let a broken autoLineup escape either' +
     (threw ? '  <-- ' + threw.message : ''));
  var r = h.clickTab('rosters');
  ok(r !== null, 'and the tab bar still works afterward');
  ok(h.W.Store.get().settings.lastTab === 'rosters',
     'lastTab is "rosters" (got ' + h.W.Store.get().settings.lastTab + ')');
})();

console.log('\n-- the one genuinely unrecoverable case still fails loudly, not silently --');
(function () {
  var h = buildHarness();
  var realInit = h.W.Store.init;
  h.W.Store.init = function () { throw new Error('simulated corrupted save data'); };
  var threw = null;
  try { h.docHandlers.DOMContentLoaded(); } catch (e) { threw = e; }
  ok(!threw, 'even a broken Store.init does not crash the process');
  var text = [];
  (function walk(n, d) {
    if (!n || d > 6) return;
    if (n.textContent) text.push(String(n.textContent));
    (n.children || []).forEach(function (c) { walk(c, d + 1); });
  }(h.ids.view, 0));
  ok(/Startup failed/.test(text.join(' ')),
     'and it shows the real fatal() error card rather than a normal-looking screen ' +
     'with no working tabs and no explanation');
  h.W.Store.init = realInit;
})();

console.log('\n-- index.html: the tab bar is excluded from the swipe gesture recognizer --');
(function () {
  var html = fs.readFileSync(A('index.html'), 'utf8');
  ok(/<nav id="tabs"[^>]*data-nogesture/.test(html),
     'nav#tabs carries data-nogesture, so a tap that drifts a few px on a tab ' +
     'button can never be misread as a swipe attempt (gestures.js\'s own ' +
     'ownedBySomethingElse() already honours this attribute everywhere else)');
})();

console.log(fails ? ('\n  ' + fails + ' tab-safety check(s) FAILED') : '\n  tab-safety checks pass');
process.exit(fails ? 1 : 0);
