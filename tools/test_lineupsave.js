/* test_lineupsave.js — Tj, 2026-09-27: "make sure if I adjust my weekly
 * lineup or my opponent's weekly lineup, it saves it. I think I changed it
 * then closed the app and when I went back to the app it defaulted back to a
 * different lineup. Every time I alter any part of my lineup it should auto
 * save and persist even after app restart."
 *
 * The real UI boots against a stub DOM with a shared fake disk (the
 * test_picks2.js harness), the Lineups dropdowns are changed through their
 * own change handlers, the data under the app moves the way a sync moves it,
 * and a SECOND app instance boots from that same disk — a real restart,
 * including boot()'s own auto-fill pass. Both lineups must come back exactly
 * as they were left. Confirmed to fail against the pre-fix store.js.
 */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm'), fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  OK   ' + m); }
function A(f) { return path.join(__dirname, '..', 'app/assets', f); }

function makeEl(tag) {
  var e = {
    nodeType: 1, tagName: String(tag || 'div').toUpperCase(),
    children: [], style: {}, dataset: {}, attributes: {},
    className: '', textContent: '', value: '', hidden: false,
    disabled: false, selectedIndex: 0, options: [],
    classList: {
      _s: {}, add: function (c) { this._s[c] = 1; }, remove: function (c) { delete this._s[c]; },
      toggle: function (c, on) { if (on === undefined) on = !this._s[c]; if (on) this._s[c] = 1; else delete this._s[c]; },
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
var TAB_NAMES = (function () {
  var html = fs.readFileSync(A('index.html'), 'utf8'), out = [], re = /data-v="([^"]+)"/g, m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}());

function buildHarness(sharedDisk) {
  var ids = {};
  var W = {}; W.window = W;
  W.setTimeout = function (fn, ms) { return setTimeout(fn, ms); };
  W.clearTimeout = function (t) { return clearTimeout(t); };
  W.setInterval = function (fn, ms) { return setInterval(fn, ms); };
  W.clearInterval = function (t) { return clearInterval(t); };
  W.pageYOffset = 0; W.scrollTo = function () { };
  W.requestAnimationFrame = function (fn) { return setTimeout(fn, 0); };
  W.localStorage = { getItem: function () { return null; }, setItem: function () { }, removeItem: function () { } };
  var docHandlers = {};
  var tabEls = TAB_NAMES.map(function (n) {
    var e = makeEl('button'); e.setAttribute('data-v', n); return e;
  });
  W.document = {
    hidden: false, body: makeEl('body'), documentElement: makeEl('html'),
    createElement: makeEl,
    createTextNode: function (t) { return { nodeType: 3, textContent: String(t), children: [] }; },
    getElementById: function (id) {
      if (!ids[id]) { ids[id] = makeEl('div'); ids[id].id = id; }
      return ids[id];
    },
    querySelector: function () { return null; },
    querySelectorAll: function (sel) { return String(sel).indexOf('.tab') >= 0 ? tabEls : []; },
    addEventListener: function (t, fn) { docHandlers[t] = fn; },
    removeEventListener: function () { }
  };
  W.Option = function (label, value) {
    var o = makeEl('option'); o.textContent = label; o.value = value === undefined ? label : value; return o;
  };
  var disk = sharedDisk || {};
  W.Native = { save: function (k, v) { disk[k] = v; return true; },
               load: function (k) { return disk[k] === undefined ? null : disk[k]; },
               online: function () { return false; } };
  W.console = console; W.Promise = Promise; W.Date = Date; W.Math = Math; W.JSON = JSON;
  W.Float64Array = Float64Array;
  vm.createContext(W);
  ['version.js', 'seed.js', 'players.js', 'scoring.js', 'espn.js', 'names.js', 'store.js',
   'playerdb.js', 'gamelog.js', 'projections.js', 'usage.js', 'ai.js', 'recommend.js', 'ros.js',
   'sim.js', 'value.js', 'teamreport.js', 'recap.js', 'schedule.js', 'handoff.js', 'stats.js',
   'gestures.js', 'ui.js'].forEach(function (f) {
    vm.runInContext(fs.readFileSync(A(f), 'utf8'), W, { filename: f });
  });
  function clickTab(name) {
    for (var i = 0; i < tabEls.length; i++) {
      if (tabEls[i].getAttribute('data-v') === name && tabEls[i]._h && tabEls[i]._h.click) {
        return tabEls[i]._h.click.call(tabEls[i]);
      }
    }
    return null;
  }
  return { W: W, ids: ids, docHandlers: docHandlers, clickTab: clickTab, tabEls: tabEls, disk: disk };
}
function all(n, pred, out) {
  out = out || [];
  if (!n) return out;
  if (pred(n)) out.push(n);
  var k = n.children || [], i;
  for (i = 0; i < k.length; i++) all(k[i], pred, out);
  return out;
}
function hasClass(n, c) { return (' ' + (n.className || '') + ' ').indexOf(' ' + c + ' ') >= 0; }
function button(root, text) {
  return all(root, function (n) { return n.tagName === 'BUTTON' && n.textContent === text; })[0] || null;
}
function click(n) { if (n && n._h && n._h.click) n._h.click.call(n, { stopPropagation: function () { } }); }
/* switch away and back, the way a thumb forces a fresh render */
function rerender(h, tab) { h.clickTab(tab === 'live' ? 'stats' : 'live'); h.clickTab(tab); }


function text(n) {
  if (!n) return '';
  if (n.nodeType === 3) return n.textContent;
  return (n.textContent || '') + (n.children || []).map(text).join('');
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-6); }
