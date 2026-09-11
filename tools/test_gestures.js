/* test_gestures.js — swipe between tabs and pull to refresh (v4.7).
 *
 * Gesture code is exactly the kind that reads correctly and is wrong under a
 * real thumb: the failures are "it changes tab while I am scrolling", "it
 * fires halfway down the page", "it eats the dropdown". None of those show up
 * in a code review and all of them show up in the first minute of use.
 *
 * So this drives the real module with synthetic touch sequences against a DOM
 * stub — the same approach test_lifecycle.js uses on ui.js — and asserts the
 * BEHAVIOUR, not the presence of a function.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  OK   ' + m); } else { fail++; console.log('  FAIL ' + m); } }

/* ---- a DOM stub with just enough of a document ---------------------------- */
function makeNode(tag, attrs) {
  const n = {
    tagName: tag, nodeType: 1, style: {}, parentNode: null, children: [],
    _attrs: Object.assign({}, attrs || {}),
    scrollWidth: 0, clientWidth: 0,
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; }
  };
  return n;
}
function makeEnv() {
  const listeners = {};
  const body = makeNode('BODY');
  const view = makeNode('MAIN');
  const doc = {
    body: body,
    createElement: (t) => makeNode(t.toUpperCase()),
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener() { }
  };
  const win = {
    document: doc, innerWidth: 400,
    setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout,
    getComputedStyle: (n) => ({ overflowX: n._attrs && n._attrs._ovx ? n._attrs._ovx : 'visible' }),
    Date, Math, JSON, Object, Promise, Error, String, Number, console
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app', 'assets', 'gestures.js'), 'utf8'),
                  win, { filename: 'gestures.js' });
  return { win, doc, body, view, listeners };
}

/* Drives the module the way a finger would. `steps` are [dx, dy] offsets. */
function swipe(G, target, from, steps, opts) {
  const o = opts || {};
  let prevented = 0;
  G._onStart({ touches: [{ clientX: from[0], clientY: from[1] }], target: target });
  for (const [dx, dy] of steps) {
    G._onMove({
      touches: [{ clientX: from[0] + dx, clientY: from[1] + dy }],
      target: target, cancelable: true,
      preventDefault() { prevented++; }
    });
  }
  if (!o.noEnd) G._onEnd({ target: target });
  return prevented;
}

function harness(overrides) {
  const env = makeEnv();
  const G = env.win.Gestures;
  const state = {
    tab: 'live', refreshes: 0, scroll: 0, blocked: false,
    tabs: ['live', 'lineups', 'rosters', 'advice', 'data']
  };
  G.init(Object.assign({
    tabs: () => state.tabs,
    current: () => state.tab,
    go: (n) => { state.tab = n; },
    viewEl: () => env.view,
    scrollTop: () => state.scroll,
    blocked: () => state.blocked,
    refresh: () => { state.refreshes++; return Promise.resolve(); }
  }, overrides || {}));
  return { G, state, env };
}

/* ---- 1. the swipe actually changes tab ----------------------------------- */
console.log('\n-- swiping between tabs --');
{
  const { G, state, env } = harness();
  swipe(G, env.body, [300, 400], [[-20, 0], [-60, 2], [-120, 4]]);
  ok(state.tab === 'lineups', 'a leftward swipe moves to the next tab (' + state.tab + ')');
}
{
  const { G, state, env } = harness();
  state.tab = 'rosters';
  swipe(G, env.body, [80, 400], [[20, 0], [70, -2], [130, 3]]);
  ok(state.tab === 'lineups', 'a rightward swipe moves to the previous tab (' + state.tab + ')');
}
{
  const { G, state, env } = harness();
  swipe(G, env.body, [300, 400], [[20, 0], [70, 0], [130, 0]]);
  ok(state.tab === 'live', 'swiping right on the FIRST tab goes nowhere, and does not wrap');
}
{
  const { G, state, env } = harness();
  state.tab = 'data';
  swipe(G, env.body, [300, 400], [[-20, 0], [-70, 0], [-130, 0]]);
  ok(state.tab === 'data', 'swiping left on the LAST tab goes nowhere, and does not wrap');
}
{
  const { G, state, env } = harness();
  swipe(G, env.body, [300, 400], [[-14, 0], [-30, 0]]);
  ok(state.tab === 'live',
     'a 30px drag never changes tab, however fast — speed alone used to do it');
  ok(G._consts.FLICK_MIN_PX >= 32,
     'a flick has a distance floor as well as a velocity (' + G._consts.FLICK_MIN_PX + 'px)');
}

/* ---- 2. it does not steal a scroll --------------------------------------- */
console.log('\n-- not stealing a vertical scroll --');
{
  const { G, state, env } = harness();
  state.scroll = 500;                       /* halfway down a long screen */
  const prevented = swipe(G, env.body, [300, 400], [[4, -30], [8, -120], [12, -260]]);
  ok(state.tab === 'live', 'an upward scroll with a little sideways drift does not change tab');
  ok(prevented === 0, 'and preventDefault is never called, so the page scrolls normally');
}
{
  const { G, state, env } = harness();
  state.scroll = 500;
  const prevented = swipe(G, env.body, [300, 400], [[6, 40], [10, 160], [14, 300]]);
  ok(state.refreshes === 0, 'a downward scroll from mid-page does NOT pull-to-refresh');
  ok(prevented === 0, 'and it is not preventDefaulted either');
}
{
  const { G, state, env } = harness();
  const prevented = swipe(G, env.body, [300, 400], [[-3, 0], [-6, 1]]);
  ok(prevented === 0 && state.tab === 'live', 'a tap moves nothing (below the axis threshold)');
}

/* ---- 3. what is under the finger ----------------------------------------- */
console.log('\n-- respecting what is under the finger --');
{
  const { G, state, env } = harness();
  const sel = makeNode('SELECT'); env.body.appendChild(sel);
  swipe(G, sel, [300, 400], [[-20, 0], [-80, 0], [-160, 0]]);
  ok(state.tab === 'live', 'a swipe that starts on a <select> is left to the <select>');
}
{
  const { G, state, env } = harness();
  const ta = makeNode('TEXTAREA'); env.body.appendChild(ta);
  swipe(G, ta, [300, 400], [[-20, 0], [-80, 0], [-160, 0]]);
  ok(state.tab === 'live', 'and one that starts on a <textarea>');
}
{
  const { G, state, env } = harness();
  const wide = makeNode('DIV');
  wide.scrollWidth = 900; wide.clientWidth = 360; wide._attrs._ovx = 'auto';
  const cell = makeNode('TD'); wide.appendChild(cell); env.body.appendChild(wide);
  swipe(G, cell, [300, 400], [[-20, 0], [-80, 0], [-160, 0]]);
  ok(state.tab === 'live', 'a table that scrolls sideways keeps its own horizontal drag');
}
{
  const { G, state, env } = harness();
  const dlg = makeNode('DIV', { 'data-nogesture': '' });
  const inner = makeNode('P'); dlg.appendChild(inner); env.body.appendChild(dlg);
  swipe(G, inner, [300, 400], [[-20, 0], [-80, 0], [-160, 0]]);
  ok(state.tab === 'live', 'nothing inside a modal can swipe the page behind it');
}
{
  const { G, state, env } = harness();
  state.blocked = true;
  swipe(G, env.body, [300, 400], [[-20, 0], [-80, 0], [-160, 0]]);
  ok(state.tab === 'live', 'blocked() (a modal open, or a sync running) suspends the gesture');
}
{
  const { G, state, env } = harness();
  G._onStart({ touches: [{ clientX: 300, clientY: 400 }, { clientX: 100, clientY: 200 }], target: env.body });
  G._onMove({ touches: [{ clientX: 140, clientY: 400 }], target: env.body, cancelable: true, preventDefault() { } });
  G._onEnd({});
  ok(state.tab === 'live', 'a two-finger gesture is a pinch, not a swipe');
}

/* ---- 4. pull to refresh --------------------------------------------------- */
console.log('\n-- pull to refresh --');
{
  const { G, state, env } = harness();
  const prevented = swipe(G, env.body, [200, 120], [[0, 20], [2, 60], [3, 100]]);
  ok(state.refreshes === 1, 'pulling down from the top of the page refreshes');
  ok(prevented > 0, 'and the drag is claimed, so the page does not scroll under it');
}
{
  const { G, state, env } = harness();
  swipe(G, env.body, [200, 120], [[0, 20], [0, 45], [0, 55]]);
  ok(state.refreshes === 0, 'a short pull does not fire — it has to pass the trigger');
}
{
  const { G, state, env } = harness();
  swipe(G, env.body, [200, 120], [[0, 30], [0, 100]]);
  swipe(G, env.body, [200, 120], [[0, 30], [0, 100]]);
  ok(state.refreshes === 1, 'a second pull while one is still running is ignored');
}
{
  let resolve; const gate = new Promise(r => { resolve = r; });
  const { G, state, env } = harness({ refresh: () => { state.refreshes++; return gate; } });
  swipe(G, env.body, [200, 120], [[0, 30], [0, 100]]);
  ok(G.busy() === true, 'busy() is true while the refresh is in flight');
  resolve();
  return void gate.then(() => {
    setTimeout(() => {
      ok(G.busy() === false, 'and false once it settles, so the next pull works');
      finish();
    }, 5);
  });
}

function finish() {
  /* ---- 5. sleeping ------------------------------------------------------- */
  console.log('\n-- sleeping with the app --');
  {
    const { G, state, env } = harness();
    G.enable(false);
    swipe(G, env.body, [300, 400], [[-20, 0], [-80, 0], [-160, 0]]);
    ok(state.tab === 'live', 'a touch while the app is backgrounded does nothing');
    G.enable(true);
    swipe(G, env.body, [300, 400], [[-20, 0], [-80, 0], [-160, 0]]);
    ok(state.tab === 'lineups', 'and the gesture comes back on resume');
  }

  /* ---- 6. the wiring on the ui.js side ----------------------------------- */
  console.log('\n-- how ui.js wires it --');
  const ui = fs.readFileSync(path.join(__dirname, '..', 'app', 'assets', 'ui.js'), 'utf8');
  ok(/Gestures\.init\(/.test(ui), 'ui.js initialises the gesture layer');
  ok(/blocked:\s*function\s*\(\)\s*\{\s*return modalOpen\(\) \|\| busy;/.test(ui),
     'it blocks on an open modal AND on a sync already running');
  ok(/go:\s*goTab/.test(ui), 'a swipe goes through the SAME tab change a tap does');
  ok(ui.indexOf('function tabList') >= 0 && ui.indexOf("querySelectorAll('#tabs .tab')") >= 0,
     'the swipe order is read from the tab bar, so the two cannot disagree');
  ok(/Gestures\.enable\(false\)/.test(ui) && /Gestures\.enable\(true\)/.test(ui),
     'gestures sleep and wake with the app');
  ok(ui.indexOf('window.__onBack') >= 0 && ui.indexOf('closeTopModal()') >= 0,
     'the Android back button closes a modal before it does anything else');
  const mj = fs.readFileSync(path.join(__dirname, '..', 'android', 'src', 'com', 'tj',
                                       'fftracker', 'MainActivity.java'), 'utf8');
  ok(mj.indexOf('__onBack') >= 0 && mj.indexOf('moveTaskToBack(true)') >= 0,
     'and the Activity asks the page, backgrounding itself rather than finish()ing ' +
     'when the page says it had nothing left');
  ok(mj.indexOf('finish()') < 0,
     'the back handler never calls finish() — back must never close this app');
  ok(mj.indexOf('web.canGoBack()') < 0,
     'canGoBack is gone entirely, not just reordered (it was always false here)');

  const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'assets', 'app.css'), 'utf8');
  ok(/overscroll-behavior-y:\s*contain/.test(css),
     "the browser's own overscroll does not fight the app's pull-to-refresh");
  ok(/\.pullrefresh\{/.test(css), 'the pull indicator is styled');
  ok(/prefers-reduced-motion/.test(css), 'and it respects prefers-reduced-motion');

  console.log('\n  ' + pass + ' assertions pass' + (fail ? ', ' + fail + ' FAILED' : ''));
  if (fail) process.exit(1);
  console.log('  gesture checks pass');
}
