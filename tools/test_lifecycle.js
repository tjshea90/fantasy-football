/* test_lifecycle.js — ui.js is actually EXECUTED here. Nothing else does that.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Every other suite either tests a module in isolation or asserts on ui.js's
 * source TEXT. None of them run it, because it needs a DOM. That gap let a
 * fatal bug through during this very session:
 *
 *     root.__appPause = appPause;
 *
 * written at the top level of ui.js, which is a bare `(function () {...})()`
 * with no `root` parameter — unlike the other twelve modules, which are all
 * `(function (root) {...})(window)`. That is a ReferenceError at SCRIPT LOAD.
 * The app would not have booted at all: no screen, no error the user could
 * read, just a dead WebView. Ten green suites and a clean APK build said
 * nothing, because not one of them loaded the file.
 *
 * So this suite stands up a DOM stub just complete enough to load ui.js and
 * run boot(), and then drives the lifecycle: pause, resume, and the timer
 * behaviour that decides whether the app burns battery in the background.
 *
 * The DOM stub is deliberately dumb. It is not trying to be a browser — it is
 * trying to make "does this file evaluate, and do its lifecycle hooks work"
 * answerable without one.
 */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm'), fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  OK   ' + m); }
function A(f) { return path.join(__dirname, '..', 'app/assets', f); }

/* ---- a DOM small enough to read, big enough to load ui.js --------------- */
function makeEl(tag) {
  var e = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [], style: {}, dataset: {}, attributes: {},
    className: '', textContent: '', value: '', hidden: false,
    disabled: false, selectedIndex: 0, options: [],
    classList: {
      _s: {},
      add: function (c) { this._s[c] = 1; },
      remove: function (c) { delete this._s[c]; },
      toggle: function (c, on) { if (on) this._s[c] = 1; else delete this._s[c]; },
      contains: function (c) { return !!this._s[c]; }
    },
    appendChild: function (c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild: function (c) {
      var i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      return c;
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
    focus: function () { }, blur: function () { },
    setSelectionRange: function () { },
    getBoundingClientRect: function () { return { top: 0, left: 0, width: 0, height: 0 }; }
  };
  return e;
}

var ids = {};
var W = {};
W.window = W;
/* Timers are counted, not just forwarded. The whole battery claim is "when the
   app is not on screen it holds no timer", and that is a fact about live
   handles — asserting it from the source text would only prove the code LOOKS
   right. `pending` is the number of scheduled callbacks that have neither run
   nor been cleared. */
var pending = 0, liveTimers = {};
W.setTimeout = function (fn, ms) {
  var id = setTimeout(function () {
    if (liveTimers[id]) { delete liveTimers[id]; pending--; }
    try { fn(); } catch (e) { /* a stub-driven callback may fail; not our subject */ }
  }, ms);
  liveTimers[id] = 1; pending++;
  return id;
};
W.clearTimeout = function (t) {
  if (liveTimers[t]) { delete liveTimers[t]; pending--; }
  return clearTimeout(t);
};
W.setInterval = function (fn, ms) { return setInterval(fn, ms); };
W.clearInterval = function (t) { return clearInterval(t); };
W.pageYOffset = 0;
W.scrollTo = function () { };
W.requestAnimationFrame = function (fn) { return setTimeout(fn, 0); };
W.localStorage = (function () {
  var d = {};
  return { getItem: function (k) { return d[k] === undefined ? null : d[k]; },
           setItem: function (k, v) { d[k] = String(v); },
           removeItem: function (k) { delete d[k]; } };
}());
var docHandlers = {};
W.document = {
  hidden: false,
  body: makeEl('body'),
  documentElement: makeEl('html'),
  createElement: makeEl,
  createTextNode: function (t) { return { nodeType: 3, textContent: String(t) }; },
  getElementById: function (id) {
    if (!ids[id]) { ids[id] = makeEl('div'); ids[id].id = id; }
    return ids[id];
  },
  querySelector: function () { return null; },
  /* REAL tab buttons for the '#tabs .tab' selector. Without them wire() binds
     nothing, goTab() is unreachable, and every render path in the file — which
     is most of the file — stays unexecuted. That was the gap that let the
     lock UI, the swipe wiring and the back handler in untested. */
  querySelectorAll: function (sel) {
    if (String(sel).indexOf('.tab') >= 0) return tabEls;
    return [];
  },
  addEventListener: function (t, fn) { docHandlers[t] = fn; },
  removeEventListener: function () { }
};
var TAB_NAMES = ['live', 'lineups', 'rosters', 'wire', 'stats', 'advice', 'data'];
/* Same drift check as the module load order below: this stub's tab list is
   maintained by hand, so it can silently stop matching the real nav bar the
   moment a tab is added or removed there — exactly what happened to the
   module load order when gamelog.js/stats.js were added (see below). Real
   parity, not an assumption. */
(function () {
  var html = fs.readFileSync(A('index.html'), 'utf8');
  var found = [], re = /data-v="([^"]+)"/g, m;
  while ((m = re.exec(html))) found.push(m[1]);
  ok(found.join(',') === TAB_NAMES.join(','),
     'TAB_NAMES matches the real nav bar, in the same order' +
     (found.join(',') === TAB_NAMES.join(',') ? '' : '\n         html: ' + found.join(',') +
      '\n         here: ' + TAB_NAMES.join(',')));
}());
var tabEls = TAB_NAMES.map(function (n) {
  var e = makeEl('button'); e.setAttribute('data-v', n); return e;
});
/* Click a tab the way a thumb does: through the handler wire() attached. */
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
W.console = console;
W.Promise = Promise;
W.Date = Date; W.Math = Math; W.JSON = JSON;
/* `document` and `Option` are read as bare globals inside ui.js; because W IS
   the context's global object, the properties set above already satisfy them. */

/* the network is deliberately dead: this suite is about lifecycle, and a
   passing test must never depend on ESPN answering */
var netCalls = 0;

/* A REAL VM CONTEXT, not `new Function('window', src)(W)`.
 *
 * ui.js refers to its siblings as bare globals — `Store`, `Espn`, `Recommend`
 * — because in a browser `window.Store` and `Store` are the same lookup. In a
 * `new Function` wrapper they are not: `W` is just an object, so bare `Store`
 * resolves to nothing and the file dies with "Store is not defined" the moment
 * boot() runs. Making W the context's global object is what makes this suite
 * exercise the same program the phone runs, and the same reason applies to
 * `document`, `Option` and the timers. */
vm.createContext(W);
function load(f) {
  vm.runInContext(fs.readFileSync(A(f), 'utf8'), W, { filename: f });
}

console.log('\n-- every module evaluates --');
var order = ['version.js', 'seed.js', 'players.js', 'scoring.js', 'espn.js', 'names.js',
             'store.js', 'playerdb.js', 'gamelog.js', 'projections.js', 'usage.js', 'ai.js',
             'recommend.js', 'sim.js', 'value.js', 'recap.js', 'schedule.js',
             'handoff.js', 'stats.js', 'gestures.js', 'ui.js'];
/* the load order must match index.html, or this suite proves nothing about
   what the phone actually runs */
(function () {
  var html = fs.readFileSync(A('index.html'), 'utf8');
  var found = [], re = /<script src="([^"]+)"><\/script>/g, m;
  while ((m = re.exec(html))) found.push(m[1]);
  ok(found.join(',') === order.join(','),
     'this suite loads exactly what index.html loads, in the same order' +
     (found.join(',') === order.join(',') ? '' : '\n         html: ' + found.join(',') +
      '\n         here: ' + order.join(',')));
}());

var loadErr = null;
try {
  order.forEach(load);
} catch (e) {
  loadErr = e;
}
ok(!loadErr, 'every module loads with no error' +
   (loadErr ? '  <-- ' + loadErr.message : ''));
if (loadErr) {
  console.log('\n  ' + (fails) + ' lifecycle check(s) FAILED');
  process.exit(1);
}

/* THE BUG THIS FILE WAS WRITTEN FOR */
ok(typeof W.__appPause === 'function',
   'window.__appPause exists  <-- a top-level ReferenceError here means the app never boots');
ok(typeof W.__appResume === 'function', 'window.__appResume exists');
ok(typeof docHandlers.visibilitychange === 'function',
   'a visibilitychange handler is registered at load time');

console.log('\n-- the lifecycle hooks before boot --');
/* The listener is registered at load, but `S` does not exist until boot().
   A screen lock in that window must not throw. */
var threw = null;
try { docHandlers.visibilitychange(); } catch (e) { threw = e; }
ok(!threw, 'a visibility change BEFORE boot does not throw' +
   (threw ? '  <-- ' + threw.message : ''));
threw = null;
try { W.__appPause(); W.__appResume(); } catch (e) { threw = e; }
ok(!threw, 'pause and resume before boot do not throw' +
   (threw ? '  <-- ' + threw.message : ''));

console.log('\n-- boot, then the lifecycle for real --');
threw = null;
ok(typeof docHandlers.DOMContentLoaded === 'function',
   'ui.js registered boot() on DOMContentLoaded');
try { docHandlers.DOMContentLoaded(); } catch (e) { threw = e; }
ok(!threw, 'boot() runs against the stub without throwing' +
   (threw ? '  <-- ' + threw.message : ''));
/* A suite that "passes" because boot quietly fell into fatal() proves nothing
   about the lifecycle. boot() ends in a try/catch, so ask the store whether it
   was actually initialised rather than trusting the absence of a throw. */
(function () {
  var st = null;
  try { st = W.Store.get(); } catch (e) { }
  ok(!!(st && st.teams && st.teams.length),
     'and it really initialised the season (' +
     (st && st.teams ? st.teams.length + ' teams' : 'NOT INITIALISED') +
     ')  <-- otherwise this suite is testing nothing');
  /* fatal() builds DOM NODES; it does not set innerHTML. Checking innerHTML
     made this assertion vacuous and hid a real boot failure for one round. */
  var text = [];
  (function walk(n, d) {
    if (!n || d > 6) return;
    if (n.textContent) text.push(String(n.textContent));
    var kids = n.children || [];
    for (var i = 0; i < kids.length; i++) walk(kids[i], d + 1);
  }(ids.view, 0));
  var joined = text.join(' ');
  ok(!/Something went wrong|Startup failed/.test(joined),
     'and did not fall into the fatal() path' +
     (/Startup failed/.test(joined) ? '  <-- ' + joined.slice(0, 220) : ''));
}());

/* Whatever timers boot() armed, pausing must clear them and leave none. */
(function () {
  ok(pending > 0, 'boot armed at least one timer (' + pending + ') — the live poll');
  threw = null;
  try { W.__appPause(); } catch (e) { threw = e; }
  ok(!threw, 'pause runs after boot' + (threw ? '  <-- ' + threw.message : ''));
  ok(pending === 0,
     'AND THE APP NOW HOLDS NO TIMER AT ALL (' + pending + ')  <-- this is the battery fix');

  threw = null;
  try { W.__appPause(); } catch (e) { threw = e; }
  ok(!threw && pending === 0, 'pausing twice is safe — Java calls onPause more than once');

  threw = null;
  try { W.__appResume(); } catch (e) { threw = e; }
  ok(!threw, 'resume runs' + (threw ? '  <-- ' + threw.message : ''));
  ok(pending > 0, 'and resuming arms the poll again (' + pending + ')');

  var afterResume = pending;
  threw = null;
  try { W.__appResume(); } catch (e) { threw = e; }
  ok(!threw && pending === afterResume,
     'resuming twice does not stack a second poll  <-- two timers is a doubled request rate');

  /* the case the guard exists for: a request that resolves AFTER the app was
     backgrounded must not re-arm the timer from inside its own .then() */
  W.__appPause();
  ok(pending === 0, 'asleep again, no timers');
  W.docHandlersProbe = null;
  ok(pending === 0, 'and nothing re-armed one behind our back');
}());

console.log('\n-- the sleep contract, in the source --');
(function () {
  var raw = fs.readFileSync(A('ui.js'), 'utf8');
  var c = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  /* the specific habit that caused the bug: no bare `root.` at IIFE top level.
     Inside functions `root` is a legitimate parameter name for the view node,
     so the check is scoped to lines with no leading indentation beyond the
     IIFE's two spaces AND an assignment to a window-ish global. */
  ok(!/^\s{0,2}root\./m.test(c),
     'no top-level `root.` in ui.js — it has no `root` in scope  <-- the exact bug');

  ok(/window\.__appPause\s*=/.test(c) && /window\.__appResume\s*=/.test(c),
     'the hooks are attached to `window`, which is what MainActivity calls');
  ok(/if \(!S\) return;/.test(c),
     'the visibility handler guards against firing before boot');
  var i = c.indexOf('function scheduleLive');
  ok(/if \(asleep\) \{ live\.next = 0; return; \}/.test(c.slice(i, i + 320)),
     'the sleep guard sits at the one place a timer is armed');
}());

/* ---- EVERY SCREEN ACTUALLY RENDERS (v4.7) --------------------------------
 * Until now nothing in the suite executed a single view function. ui.js is
 * 145 KB and almost all of it is render code, so "the file evaluates and
 * boot() survives" was proving very little about the app Tj opens. This walks
 * every tab through the real click handler, which is the same path a
 * swipe now takes, and fails on the first one that throws.
 *
 * render() catches per-screen errors and paints a card instead, so a throw
 * would NOT surface as an exception here — the card is the symptom. Both are
 * checked. */
console.log('\n-- every screen renders --');
(function () {
  var view = ids.view;
  TAB_NAMES.forEach(function (name) {
    var err = null;
    try { clickTab(name); } catch (e) { err = e; }
    ok(!err, 'the ' + name + ' tab renders without throwing' +
       (err ? '  <-- ' + err.message : ''));
    if (err) return;
    /* render()'s own catch paints a card headed "This screen hit an error" */
    var caught = null;
    (function walk(n, depth) {
      if (!n || depth > 6 || caught) return;
      if (n.textContent === 'This screen hit an error') { caught = n; return; }
      for (var i = 0; i < (n.children || []).length; i++) walk(n.children[i], depth + 1);
    }(view, 0));
    ok(!caught, '  ...and render() did not have to catch anything on ' + name);
  });
}());

console.log('\n-- Data tab sub-navigation renders every group (2026-09-15g) --');
/* Tj: "organize the data tab with sub navigation that is smart and easy to
 * understand." viewData() was split into 4 group functions
 * (viewDataLeague/viewDataClaude/viewDataSync/viewDataApp) with every
 * existing card relocated into exactly one group. This walks all 4 the
 * same way a thumb would — finding and clicking the real sub-nav buttons
 * built by dataSubNav(), not just calling the group functions directly —
 * and checks each group's cards actually appear, so a card silently
 * dropped during the reshuffle would fail here, not just look fine in a
 * source-text pin. */
(function () {
  function findButtons(node, text, out) {
    if (!node) return out;
    if (node.tagName === 'BUTTON' && String(node.textContent).indexOf(text) >= 0) out.push(node);
    (node.children || []).forEach(function (c) { findButtons(c, text, out); });
    return out;
  }
  function h2Texts(node, out) {
    if (!node) return out;
    if (node.tagName === 'H2') out.push(String(node.textContent));
    (node.children || []).forEach(function (c) { h2Texts(c, out); });
    return out;
  }
  function clickButtonWithText(text) {
    var found = findButtons(ids.view, text, []);
    ok(found.length > 0, 'a "' + text + '" sub-nav button exists on the Data tab');
    if (found.length && found[0]._h && found[0]._h.click) found[0]._h.click.call(found[0]);
  }
  clickTab('data');   /* land on Data, sub-nav defaults to League */
  var groups = {
    'League': ['Enter week', 'Standings', 'matchups', 'Weekly recap', 'Scoring rules'],
    'Claude': ['Claude reasoning', 'Claude costs'],
    'Sync & data': ['Stats feed', 'Player database'],
    'App': ['Lineup alerts', 'Live updating', 'Screen fit', 'Backup', 'About']
  };
  Object.keys(groups).forEach(function (label) {
    clickButtonWithText(label);
    var heads = h2Texts(ids.view, []);
    var missing = groups[label].filter(function (exp) {
      return !heads.some(function (h) { return h.indexOf(exp) >= 0; });
    });
    ok(missing.length === 0,
       label + ' group shows every card it should (' + heads.length + ' headings)' +
       (missing.length ? '  <-- missing: ' + missing.join(', ') + ' (got: ' + heads.join(' | ') + ')' : ''));
  });
}());

console.log('\n-- the weekly recap dialog (2026-09-15g) --');
/* Tj: "Build the 'weekly recap' Claude write-up feature you told me
 * about." recap.js's build()/text() already compute a real, fact-based
 * recap with no network at all; this only had to get a button and a
 * dialog wired to it. Proven here against a REAL scored week (not a
 * synthetic stub), through the actual dialog() component, with the
 * "Write it up with Claude" button correctly absent since no key is
 * configured in this harness — it must never be the only way to see a
 * recap. */
(function () {
  var S2 = W.Store.get();
  S2.weekMeta['1'] = { synced: true, allFinal: true, games: 1, at: new Date().toISOString() };
  var L = W.Scoring.emptyLine(); L.played = true;
  L.pass = { cmp: 20, yds: 250, td: 2, int: 0, twoPt: 0, long: 30 };
  var pid = S2.teams[0].players[0].id;
  W.Store.setLine(1, pid, L);
  W.Store.save();

  clickTab('data');
  /* the sub-nav test just above leaves dataSubView on 'App' (the last
     group it iterated) — the recap card lives in 'League', so switch back
     the same way a thumb would, through the real button, not by reaching
     into ui.js's internals directly */
  var leagueBtns = [];
  (function walk(n) {
    if (!n) return;
    if (n.tagName === 'BUTTON' && String(n.textContent).indexOf('League') >= 0) leagueBtns.push(n);
    (n.children || []).forEach(walk);
  }(ids.view));
  if (leagueBtns.length && leagueBtns[0]._h && leagueBtns[0]._h.click) leagueBtns[0]._h.click.call(leagueBtns[0]);

  var found = [];
  (function walk(n) {
    if (!n) return;
    if (n.tagName === 'BUTTON' && String(n.textContent).indexOf('View week') >= 0) found.push(n);
    (n.children || []).forEach(walk);
  }(ids.view));
  ok(found.length > 0, 'the "View week N recap" button appears once a week is fully scored');
  if (found.length && found[0]._h && found[0]._h.click) found[0]._h.click.call(found[0]);

  var dlgText = null, writeBtn = null, shareBtn = null, copyBtn = null;
  (function walk(n) {
    if (!n) return;
    if (n.tagName === 'PRE' && dlgText === null) dlgText = n.textContent;
    if (n.tagName === 'BUTTON') {
      var t = String(n.textContent);
      if (t.indexOf('Write it up with Claude') >= 0) writeBtn = n;
      if (t === 'Share') shareBtn = n;
      if (t === 'Copy') copyBtn = n;
    }
    (n.children || []).forEach(walk);
  }(W.document.body));
  ok(!!dlgText && dlgText.indexOf('WEEK 1') >= 0, 'the dialog shows the real fact-based recap text' +
     (dlgText ? '' : '  <-- no <pre> found'));
  ok(!writeBtn, '"Write it up with Claude" is correctly absent — no API key is configured in this harness');
  ok(!!shareBtn && !!copyBtn, 'Share and Copy are both offered regardless of whether Claude is configured');
}());

console.log('\n-- the back button --');
(function () {
  ok(typeof W.__onBack === 'function', 'the page exposes __onBack for MainActivity');
  /* The "every screen renders" block above already walked every tab in
     order, so there is a real trail sitting behind 'data' before this test
     even starts — that IS the feature (Tj: "go back to the last thing inside
     the app"), so drain it rather than assuming a single hop. */
  clickTab('data');
  ok(W.__onBack() === true, 'from a non-Live tab, back unwinds the visit history');
  var steps = 1;
  while (W.__onBack() === true) { steps++; if (steps > TAB_NAMES.length + 1) break; }
  ok(steps > 1 && steps <= TAB_NAMES.length,
     'it walks back through the whole trail, one tab at a time, and terminates');
  var onLive = tabEls.some(function (t) {
    return t.getAttribute('data-v') === 'live' && t.classList.contains('on');
  });
  ok(onLive, 'draining the trail lands back on Live, where the trail started');
  ok(W.__onBack() === false,
     'and once the trail is empty it declines — the Activity backgrounds instead of closing');
}());

console.log('\n-- gestures are wired to the real tab order --');
(function () {
  ok(!!W.Gestures, 'gestures.js loaded alongside the rest');
  /* The swipe order must be the bar's order. Reading it from the DOM is what
     makes that true by construction; assert the stub sees the same tabs as
     TAB_NAMES (Table and League are gone, Wire is new — v4.8). */
  ok(tabEls.length === TAB_NAMES.length, TAB_NAMES.length + ' tabs in the bar');
  var pauseErr = null;
  try { W.__appPause(); W.__appResume(); } catch (e) { pauseErr = e; }
  ok(!pauseErr, 'pause/resume still clean now that they also toggle gestures' +
     (pauseErr ? '  <-- ' + pauseErr.message : ''));
}());

console.log('\n-- the current-NFL-week check also runs on RESUME, not just a cold boot --');
/* Tj, 2026-09-15: "week 1 is complete... yet the app still has all tabs
 * open to week 1." Root cause: syncCurrentWeek() (ui.js) was only ever
 * called from boot() — a true cold start — and this app deliberately
 * keeps its process alive across a background/foreground cycle (see the
 * back-button work: moveTaskToBack, not finish()), so anyone who does not
 * force-quit the app could go days without boot() running again. Fixed by
 * also calling syncCurrentWeek() from appResume(). This is the one
 * meaningful async gap in an otherwise fully synchronous suite, so it is
 * deferred to the very end and the file's final checks/exit move inside
 * its callback rather than converting the whole suite to async. */
var weekCheckDone = (function () {
  var S2 = W.Store.get();
  ok(S2.settings.currentWeek === 1, 'sanity: still showing week 1 before this test (got ' +
     S2.settings.currentWeek + ')');
  /* the exact real-world state Tj described: week 1 fully synced and final */
  S2.weekMeta['1'] = { synced: true, allFinal: true, games: 16, at: new Date().toISOString() };
  /* clear any cached nflWeek check from boot()'s own earlier (network-less,
     silently-failed) syncCurrentWeek() call, so this test exercises a real
     fetch through the stub rather than a stale/absent cache entry */
  delete S2.settings.nflWeek;
  var realCurrentWeek = W.Espn.currentWeek;
  W.Espn.currentWeek = function () { return Promise.resolve({ week: 2, seasonType: 2 }); };
  W.__appPause();                 /* guarantee asleep, whatever earlier tests left it as */
  var threw2 = null;
  try { W.__appResume(); } catch (e) { threw2 = e; }
  ok(!threw2, 'resume with a pending week-advance does not throw' +
     (threw2 ? '  <-- ' + threw2.message : ''));
  W.Espn.currentWeek = realCurrentWeek;   /* restore before this promise settles */
  return new Promise(function (resolve) { setTimeout(resolve, 0); });
}());

weekCheckDone.then(function () {
  var S3 = W.Store.get();
  ok(S3.settings.currentWeek === 2,
     'AND APPRESUME PICKED UP THE ADVANCE — week is now 2 (got ' + S3.settings.currentWeek +
     ')  <-- this is the fix: it used to take a true cold boot to ever notice');

  console.log('\n-- the LOCAL advance works with zero network, zero ESPN involvement --');
  /* Tj, 2026-09-15h: "I forced stopped the app and opened it again. Every
   * tab is still on NFL week 1..." — a TRUE cold boot, where boot() already
   * called syncCurrentWeek() unconditionally even before the appResume()
   * fix above existed. So the ESPN-based check itself is not reliable
   * enough alone: its 3-hour nflWeek cache can re-apply an old wrong
   * answer, and Espn.currentWeek()'s own .catch swallows every failure
   * silently by design, with nothing surfaced anywhere. localAutoAdvance()
   * is the fix: it trusts only weekMeta.allFinal, which this app already
   * computed itself from real box scores — no network call, no cache, no
   * ESPN metadata to misread. Proven here by making the ESPN path itself
   * IMPOSSIBLE (reject synchronously) and confirming the week still
   * advances, SYNCHRONOUSLY, before any promise even gets a chance to
   * settle — the strongest proof this does not depend on the network layer
   * being present, correct, or even reachable at all. */
  var S4 = W.Store.get();
  ok(S4.settings.currentWeek === 2, 'sanity: week 2 from the resume test above, before this one');
  S4.weekMeta['2'] = { synced: true, allFinal: true, games: 16, at: new Date().toISOString() };
  delete S4.settings.nflWeek;
  var realCurrentWeek2 = W.Espn.currentWeek;
  W.Espn.currentWeek = function () { throw new Error('the network is not available in this test on purpose'); };
  W.__appPause();
  var threw3 = null;
  try { W.__appResume(); } catch (e) { threw3 = e; }
  ok(!threw3, 'resume still does not throw even when Espn.currentWeek is unusable' +
     (threw3 ? '  <-- ' + threw3.message : ''));
  ok(S4.settings.currentWeek === 3,
     'AND THE WEEK ADVANCED ANYWAY — week 3 (got ' + S4.settings.currentWeek + '), synchronously, ' +
     'with the ESPN-based check impossible — this is the local, network-free backstop actually working');
  W.Espn.currentWeek = realCurrentWeek2;

  console.log('\n-- nothing reached the network during boot --');
  ok(netCalls === 0, 'boot made no network call through the stub bridge');

  console.log(fails ? ('\n  ' + fails + ' lifecycle check(s) FAILED') : '\n  lifecycle checks pass');
  process.exit(fails ? 1 : 0);
}).catch(function (e) {
  console.log('  FAIL uncaught in the week-check test: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
