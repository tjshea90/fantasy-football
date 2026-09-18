/* test_jobguard.js — guards the 2026-09-18 duplicate-paid-Claude-call bug.
 *
 * Found in the same review pass as the tab-highlight fix, by the same root
 * cause with a real dollar cost instead of a visual glitch: TWO places
 * implementing "is this button allowed to fire right now" that could drift
 * apart. The Wire tab's "Ask Claude about the wire" button and the Rosters
 * tab's "How your team stacks up" Ask-Claude button only ever disabled
 * THEMSELVES, inside their own click handler — fine for the exact button
 * instance a press created, but freeAgentCard()/teamAnalysisCard() rebuild
 * their whole card, INCLUDING A BRAND NEW BUTTON, on every render. Switching
 * tabs away and back while either call was still in flight (ai.js gives
 * askWaivers/askTeamAnalysis a 5-minute timeout) rebuilt the card with a
 * fresh button that only checked !Ai.configured() — i.e. came back enabled —
 * so a second tap fired a second concurrent paid Claude request, and
 * whichever response landed last silently overwrote the cache
 * (Value.waiverSave / TeamReport.save). Every sibling "ask/refresh" button in
 * this file (rosterInjuryCard's jobRunning('newsSync'), the player-db
 * refresh's jobRunning('db')) already guarded this way; these two did not.
 * Fixed by checking jobRunning('waivers') / jobRunning('teamanalysis') at
 * construction time too, the same pattern those siblings already use.
 *
 * Harness pattern copied from tools/test_tabsafety.js. The click handlers'
 * own network calls (Recommend.loadNews, Ai.askWaivers/askTeamAnalysis) are
 * never actually reached in this stub environment (no fetch) — that is fine,
 * because jobStart() runs SYNCHRONOUSLY as the very first thing each handler
 * does, before any of that. This test only needs the job to be marked
 * running; it never needs the network call to succeed or even complete.
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
               'recommend.js', 'ros.js', 'sim.js', 'value.js', 'teamreport.js', 'recap.js', 'schedule.js',
               'handoff.js', 'stats.js', 'gestures.js', 'ui.js'];
  order.forEach(load);
  return { W: W, ids: ids, docHandlers: docHandlers, clickTab: clickTab, tabEls: tabEls };
}

function findButtonByText(node, text, depth) {
  if (!node || (depth || 0) > 30) return null;
  if (node.tagName === 'BUTTON' && String(node.textContent) === text) return node;
  var kids = node.children || [];
  for (var i = 0; i < kids.length; i++) {
    var r = findButtonByText(kids[i], text, (depth || 0) + 1);
    if (r) return r;
  }
  return null;
}

console.log('\n-- the Wire tab: a re-render while "Ask Claude about the wire" is still in flight --');
(function () {
  var h = buildHarness();
  h.docHandlers.DOMContentLoaded();
  h.W.Store.get().settings.aiKey = 'sk-ant-faketestkey1234567890';   /* Ai.configured() needs >10 chars */

  h.clickTab('wire');
  var before = findButtonByText(h.ids.view, 'Ask Claude about the wire');
  ok(!!before && !before.disabled, 'baseline: the button exists and is enabled with a key configured');

  /* jobStart('waivers', ...) runs synchronously as the very first thing this
     click handler does, before any network call — see this file's header. */
  try { before._h.click.call(before); } catch (e) { /* the network calls after jobStart are not reached in this stub, and that is fine */ }

  /* force freeAgentCard() to rebuild from scratch while job.name is still
     'waivers' (nothing here awaits a promise, so jobEnd() has not run) */
  h.clickTab('lineups');
  h.clickTab('wire');
  var stillEnabled = findButtonByText(h.ids.view, 'Ask Claude about the wire');
  var running = findButtonByText(h.ids.view, 'Reading the wire…');
  ok(!stillEnabled, 'THE FIX: the re-render did not produce a fresh, enabled "Ask Claude" button');
  ok(!!running && running.disabled,
     'a re-render while the job is running shows it as running and disabled, not reset');
})();

console.log('\n-- the Rosters tab: the same re-render race for "Ask Claude" (team analysis) --');
(function () {
  var h = buildHarness();
  h.docHandlers.DOMContentLoaded();
  h.W.Store.get().settings.aiKey = 'sk-ant-faketestkey1234567890';

  h.clickTab('rosters');
  var before = findButtonByText(h.ids.view, 'Ask Claude');
  ok(!!before && !before.disabled, 'baseline: the button exists and is enabled with a key configured');

  try { before._h.click.call(before); } catch (e) { /* see the wire test above */ }

  h.clickTab('lineups');
  h.clickTab('rosters');
  var stillEnabled = findButtonByText(h.ids.view, 'Ask Claude');
  var running = findButtonByText(h.ids.view, 'Comparing your team to the league…');
  ok(!stillEnabled, 'THE FIX: the re-render did not produce a fresh, enabled "Ask Claude" button');
  ok(!!running && running.disabled,
     'a re-render while the job is running shows it as running and disabled, not reset');
})();

console.log(fails ? ('\n  ' + fails + ' job-guard check(s) FAILED') : '\n  job-guard checks pass');
process.exit(fails ? 1 : 0);
