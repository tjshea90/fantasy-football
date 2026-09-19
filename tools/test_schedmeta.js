/* test_schedmeta.js — doSync() must not erase schedule.js's own fields on
 * the SAME weekMeta[week] object (2026-09-19 full-test sweep).
 *
 * Found by tracing the actual runtime order, not by reading either file in
 * isolation. liveTick() (ui.js) calls Schedule.ingest(week, games) — which
 * writes m.kickoffs/m.schedAt/m.schedSig, and for the user's own team also
 * m.shouldStart/m.shouldStartSig, directly onto S.weekMeta[week] — and THEN,
 * when a game is in progress, calls doSync({quiet:true}) on the very same
 * object. doSync's own success path finished with:
 *
 *   S.weekMeta[String(syncedWeek)] = { synced: true, at: ..., games: ...,
 *     ... , opponents: (prevOpp && ...) ? prevOpp : oppMap, ... };
 *
 * a WHOLESALE REPLACEMENT of the object, not a merge. It goes out of its way
 * to carry `opponents` forward (the one field it explicitly reads off the
 * old object first) but every field schedule.js owns on that same object —
 * kickoffs, schedAt, schedSig, shouldStart, shouldStartSig — is simply not
 * in the new literal, so it is gone the instant this line runs. This is
 * exactly the class of bug test_schedule.js's own "do not collide (v5.3)"
 * case guards against in the OTHER direction (ingest() must not stomp a
 * sync-shaped object) — nothing anywhere tested this direction: a sync
 * stomping a schedule-shaped object.
 *
 * The user-facing cost: every manual "Sync week" tap, and every pull-to-
 * refresh on any tab but Advice/Stats, silently erases the game-time badges
 * next to every player's name (Schedule.badge reads `get(week)`, which
 * becomes null) and the pre-Sunday bench alert (both the in-app card and
 * Alerts.java's closed-app notification, which reads this exact same
 * persisted key with no WebView available) until the next thing that
 * happens to re-ingest a schedule — which, off the live poll (only armed
 * when a game is actually in progress) or a week change/boot/resume
 * (freshenSchedule(), never called from doSync's own success path), can be
 * a long, unpredictable wait.
 *
 * Harness pattern copied from tools/test_synccapture.js (the proven way to
 * actually execute ui.js's boot()/doSync() against a fake DOM).
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
               'recommend.js', 'ros.js', 'sim.js', 'value.js', 'teamreport.js', 'recap.js', 'schedule.js',
               'handoff.js', 'stats.js', 'gestures.js', 'ui.js'];
  order.forEach(load);
  return { W: W, ids: ids, docHandlers: docHandlers, tabEls: tabEls };
}

console.log('\n-- a sync must not erase the schedule data Schedule.ingest already wrote for the same week --');
(function () {
  var h = buildHarness();
  h.docHandlers.DOMContentLoaded();

  /* Seed weekMeta[1] exactly as Schedule.ingest() leaves it after the live
     poll's own Espn.weekGames call — kickoffs, schedAt, schedSig, and (for
     the user's own team) the shouldStart list Alerts.java reads with no
     WebView available. This is real production shape, not a synthetic one:
     it is byte-for-byte what schedule.js's own ingest()/earlyAlertUncached()
     write, reproduced here instead of re-running them only to avoid pulling
     in a full fake ESPN response. */
  var S = h.W.Store.get();
  S.weekMeta['1'] = {
    kickoffs: { KC: { kick: new Date(Date.now() + 3600e3).toISOString(), state: 'pre', opp: 'DEN', home: true } },
    schedAt: Date.now(),
    schedSig: 'KC' + new Date(Date.now() + 3600e3).toISOString() + 'pre',
    shouldStart: ['somePlayerId'],
    shouldStartSig: 'somePlayerId'
  };

  /* the sync itself: no games this week is the simplest way to let doSync's
     whole chain resolve without a fake box-score payload */
  h.W.Espn.weekGames = function () { return Promise.resolve([]); };

  h.ids.syncBtn._h.click();   // fires syncWeek() -> doSync({ quiet: false })

  return new Promise(function (resolve) { setTimeout(resolve, 20); }).then(function () {
    var m = h.W.Store.get().weekMeta['1'];
    ok(!!(m && m.synced), 'the sync did run and wrote its own fields (m.synced)');
    ok(!!(m && m.kickoffs && m.kickoffs.KC),
       'THE BUG: schedule.js\'s kickoffs survive a sync on the same week' +
       ((m && m.kickoffs) ? '' : '  <-- wiped by doSync\'s wholesale weekMeta replace'));
    ok(!!(m && m.schedAt),
       'schedAt survives too — otherwise Schedule.stale() reads this week as stale ' +
       'forever until something happens to re-ingest it');
    ok(!!(m && Array.isArray(m.shouldStart) && m.shouldStart.length === 1),
       'shouldStart survives — this is the exact list Alerts.java\'s closed-app ' +
       'notification reads to know which bench player the app would actually start');

    console.log(fails ? ('\n  ' + fails + ' schedmeta check(s) FAILED') : '\n  schedmeta checks pass');
    process.exit(fails ? 1 : 0);
  });
})();
