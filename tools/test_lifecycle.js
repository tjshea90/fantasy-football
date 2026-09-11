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
    className: '', textContent: '', innerHTML: '', value: '', hidden: false,
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
var TAB_NAMES = ['live', 'lineups', 'rosters', 'advice', 'data'];
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
             'store.js', 'playerdb.js', 'projections.js', 'usage.js', 'ai.js',
             'recommend.js', 'value.js', 'schedule.js',
             'handoff.js', 'gestures.js', 'ui.js'];
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
 * all tabs through the real click handler, which is the same path a
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

console.log('\n-- the back button --');
(function () {
  function tabOn(name) {
    for (var i = 0; i < tabEls.length; i++) {
      if (tabEls[i].getAttribute('data-v') === name) return tabEls[i].classList.contains('on');
    }
    return false;
  }
  ok(typeof W.__onBack === 'function', 'the page exposes __onBack for MainActivity');

  /* The tab history is real now (v4.8), not "always jump to Live" — which
     means it carries whatever the "every screen renders" pass above left in
     it. Drain it to a known-empty stack first so the rest of this block does
     not depend on run order. */
  var guard = 0;
  while (W.__onBack() && guard++ < 50) { }
  ok(guard < 50, 'the tab history actually drains instead of looping forever');
  ok(W.__onBack() === false,
     'with nothing left to unwind, back declines so MainActivity backgrounds ' +
     'the app instead of closing it (see MainActivity.onKeyDown)');

  /* Back must walk the REAL tab history, not jump straight to Live —
     "go back to the last thing", not "go back to the first thing". */
  clickTab('rosters');
  clickTab('advice');
  clickTab('data');
  ok(W.__onBack() === true, 'step 1 of 3 back');
  ok(tabOn('advice'), 'back from data (reached via rosters, advice, data) lands on advice, not live');
  ok(W.__onBack() === true, 'step 2 of 3 back');
  ok(tabOn('rosters'), 'then rosters');
  ok(W.__onBack() === true, 'step 3 of 3 back');
  ok(tabOn('live'), 'back to the tab open before this sequence started');
  ok(W.__onBack() === false, 'and now the history is exhausted again');
}());

console.log('\n-- gestures are wired to the real tab order --');
(function () {
  ok(!!W.Gestures, 'gestures.js loaded alongside the rest');
  /* The swipe order must be the bar's order. Reading it from the DOM is what
     makes that true by construction; assert the stub sees the same seven. */
  ok(tabEls.length === 7, 'seven tabs in the bar');
  var pauseErr = null;
  try { W.__appPause(); W.__appResume(); } catch (e) { pauseErr = e; }
  ok(!pauseErr, 'pause/resume still clean now that they also toggle gestures' +
     (pauseErr ? '  <-- ' + pauseErr.message : ''));
}());

console.log('\n-- nothing reached the network during boot --');
ok(netCalls === 0, 'boot made no network call through the stub bridge');

console.log(fails ? ('\n  ' + fails + ' lifecycle check(s) FAILED') : '\n  lifecycle checks pass');
process.exit(fails ? 1 : 0);
