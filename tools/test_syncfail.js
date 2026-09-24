/* test_syncfail.js — one box score that does not arrive (full test,
 * 2026-09-24). ES2018-agnostic (node).
 *
 * doSync() wiped EVERY stat line of the week and rebuilt from whatever that
 * sync fetched. So one failed box score — a flaky connection during a
 * Tuesday re-sync of a finished week, say — deleted that game's players'
 * already-correct lines (0.0 for them), and because every game was over the
 * week was still stamped final: nothing ever retried it. Found in the full
 * test when one of week 1's sixteen box scores timed out in the Chromium
 * harness and the week was stored "synced, final" with that game missing.
 *
 * Drives the real ui.js doSync (the Sync week button) against stubbed ESPN
 * responses, across fresh "sessions" that share one disk:
 *   1. a clean sync of two games — the baseline, bonuses included;
 *   2. a re-sync where one box score fails — nothing already scored is lost,
 *      no +5 is stripped, the week stays final;
 *   3. a first-ever sync with one failure — the week stays OPEN, says what is
 *      missing, the live poll's closing-sync check wants it, and a retry
 *      that succeeds completes it.
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

function buildHarness(sharedDisk) {
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
  var disk = sharedDisk || {};
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
  return { W: W, ids: ids, docHandlers: docHandlers, tabEls: tabEls, disk: disk };
}


function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* two final games: LAR (Stafford, Adams) and IND (Taylor) */
var GAMES = [
  { id: 'g1', date: '2026-09-13T17:00Z', week: 1, state: 'post', detail: 'Final',
    teams: [{ abbr: 'LAR', score: 30, homeAway: 'home' }, { abbr: 'AAA', score: 10, homeAway: 'away' }] },
  { id: 'g2', date: '2026-09-13T17:00Z', week: 1, state: 'post', detail: 'Final',
    teams: [{ abbr: 'IND', score: 24, homeAway: 'home' }, { abbr: 'BBB', score: 7, homeAway: 'away' }] }
];
function box(h, id, stafYds) {
  var W = h.W, S = W.Scoring;
  function pl(name, abbr, fill) { var l = S.emptyLine(); l.played = true; fill(l); return { name: name, espnId: '', abbr: abbr, line: l }; }
  var r = { eventId: id, players: {}, teamScore: {}, teamAgg: {}, fgs: [], safeties: [], twoPts: [],
            stCount: {}, twoPtCredited: 0, flags: { stFromScoringPlays: false }, shape: { missing: [] },
            teamPrimaryQB: {} };
  function add(p) { r.players[W.Espn.normName(p.name)] = p; }
  if (id === 'g1') {
    add(pl('Matthew Stafford', 'LAR', function (l) { l.pass.cmp = 20; l.pass.yds = stafYds; l.pass.td = 2; }));
    add(pl('Davante Adams', 'LAR', function (l) { l.rec.rec = 5; l.rec.yds = 100; l.rec.long = 80; }));
    r.teamPrimaryQB.LAR = W.Espn.normName('Matthew Stafford');
  } else {
    add(pl('Jonathan Taylor', 'IND', function (l) { l.rush.yds = 100; l.rush.td = 1; l.rush.long = 70; }));
  }
  return r;
}
function session(disk, g2fails, stafYds) {
  var h = buildHarness(disk);
  h.W.Espn.weekGames = function () { return Promise.resolve(JSON.parse(JSON.stringify(GAMES))); };
  h.W.Espn.gameStats = function (id) {
    if (id === 'g2' && h.g2fails) return Promise.reject(new Error('timed out after 40s'));
    return Promise.resolve(box(h, id, h.stafYds));
  };
  h.g2fails = g2fails; h.stafYds = stafYds;
  h.docHandlers.DOMContentLoaded();
  return h;
}
function pts(h, name) {
  var St = h.W.Store, me = St.team(St.get().league.me);
  var p = me.players.filter(function (x) { return x.name === name; })[0];
  return St.playerPoints(1, p.id);
}
/* back to week 1 first: a boot on a finished week 1 rightly auto-advances */
function sync(h) {
  var g = 0;
  while (h.W.Store.get().settings.currentWeek > 1 && g++ < 20) h.ids.wkPrev._h.click();
  h.ids.syncBtn._h.click();
  return wait(40);
}

var disk = {};
var h1 = session(disk, false, 200);
sync(h1).then(function () {
  console.log('\n-- 1. a clean sync (the baseline) --');
  var wm = h1.W.Store.get().weekMeta['1'];
  ok(wm && wm.synced && wm.allFinal, 'week 1 synced and final');
  ok(pts(h1, 'Matthew Stafford') === 47, 'Stafford 47 (20 cmp + 200 yds/20 + 2 TD + the +5 longest completion, his team\'s)');
  ok(pts(h1, 'Davante Adams') === 20, 'Adams 20 (5 rec + 100 yds/10 + the +5 longest reception)');
  ok(pts(h1, 'Jonathan Taylor') === 21, 'Taylor 21 (100 yds/10 + TD + the +5 longest rush)');
  h1.W.Store.flush();

  console.log('\n-- 2. a re-sync where the IND box score fails --');
  var h2 = session(disk, true, 220);      /* a stat correction on Stafford's line, too */
  return sync(h2).then(function () { return h2; });
}).then(function (h2) {
  var wm = h2.W.Store.get().weekMeta['1'];
  ok(pts(h2, 'Jonathan Taylor') === 21,
     'Taylor keeps his 21 — his game could not be refetched, so his line is not wiped (' +
     pts(h2, 'Jonathan Taylor') + ')  <-- v8.5: 0');
  ok(pts(h2, 'Davante Adams') === 20, 'Adams keeps his +5 — no bonus pass on a week with a game missing (' + pts(h2, 'Davante Adams') + ')');
  ok(pts(h2, 'Matthew Stafford') === 48, 'the game that DID arrive is updated, bonus kept (Stafford 47 -> ' + pts(h2, 'Matthew Stafford') + ')');
  ok(wm.allFinal && !wm.failed && wm.fetchFailed === 1 && wm.kept >= 1,
     'the week stays final — the kept lines ARE its final numbers (failed ' + wm.failed + ', fetchFailed ' +
     wm.fetchFailed + ', kept ' + wm.kept + ')');
  var book = h2.W.Store.bookWeek(1);
  ok(!!book[h2.W.Espn.normName('Jonathan Taylor')], 'and the league book keeps the IND rows too');

  console.log('\n-- 3. a first-ever sync with the IND box score failing --');
  var h3 = session({}, true, 200);
  return sync(h3).then(function () { return h3; });
}).then(function (h3) {
  var wm = h3.W.Store.get().weekMeta['1'];
  ok(wm.synced && !wm.allFinal && wm.failed === 1,
     'the week is NOT stamped final with a game missing (allFinal ' + wm.allFinal + ', failed ' + wm.failed + ')  <-- v8.5: final');
  ok(!h3.W.Store.weekIsScored(1), 'so standings and the odds do not count a week with a hole in it');
  ok(/1 box score missing/.test(h3.ids.syncText.textContent),
     'the header says what is wrong: "' + h3.ids.syncText.textContent + '"');
  ok(h3.W.Schedule.needsSync(GAMES, wm, function (id) { return id === 'g1'; }) === true,
     'the live poll\'s closing-sync check wants the missing game');
  h3.g2fails = false;
  return sync(h3).then(function () { return h3; });
}).then(function (h3) {
  var wm = h3.W.Store.get().weekMeta['1'];
  ok(wm.allFinal && !wm.failed && pts(h3, 'Jonathan Taylor') === 21,
     'the retry that succeeds completes the week (final, Taylor ' + pts(h3, 'Jonathan Taylor') + ')');
  var ui = fs.readFileSync(A('ui.js'), 'utf8');
  ok(/failedAny\(\) && missingTeams\[pidTeam\(k\)\]/.test(ui), 'ui.js: the wipe skips a team whose box score did not arrive');
  console.log(fails ? ('\n  ' + fails + ' sync-failure check(s) FAILED') : '\n  sync-failure checks pass');
  process.exit(fails ? 1 : 0);
}).catch(function (e) {
  console.log('  FAIL the test itself threw: ' + (e && e.stack || e));
  process.exit(1);
});
