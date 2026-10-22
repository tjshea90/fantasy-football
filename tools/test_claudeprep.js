/* test_claudeprep.js — every button that sends a prompt to Claude refreshes
 * ALL data first, and the prompt/file is built only after that finishes
 * (Tj, 2026-10-22). Harness copied from test_jobguard.js. */
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


function tick(n) { return new Promise(function (r) { setTimeout(r, n || 20); }); }
function wait(cond, ms) {
  var t0 = Date.now();
  return new Promise(function (res) {
    (function poll() { if (cond() || Date.now() - t0 > (ms || 3000)) res(); else setTimeout(poll, 10); }());
  });
}
function stubFeeds(h, log, opts) {
  var W = h.W; opts = opts || {};
  W.PlayerDB.refresh = function () { log.push('rosters:start'); return tick(30).then(function () { log.push('rosters:end'); if (opts.rostersFail) throw new Error('offline'); return { ok: true }; }); };
  W.Schedule.refresh = function (wk, force) { log.push('schedule:' + !!force); return Promise.resolve(null); };
  W.Recommend.syncAll = function (wk, tid, step, o) { log.push('syncAll:fresh=' + !!(o && o.fresh) + ',skipClaude=' + !!(o && o.skipClaude)); return tick(30).then(function () { log.push('syncAll:end'); return { steps: [] }; }); };
  W.Espn.weekGames = function () { log.push('boxscores'); return Promise.resolve([]); };
  W.Ai.ask = function () { log.push('API-CALL'); return Promise.reject(new Error('should not be called')); };
  W.Handoff.buildWaivers = function () { log.push('BUILD'); return { filename: 'x.md', text: 'x' }; };
  W.Native.exportShare = function () { log.push('shared'); return true; };
}

(async function () {
  console.log('\n-- Wire "make the file": refresh first, build last, no paid API call --');
  var h = buildHarness();
  h.docHandlers.DOMContentLoaded();
  var log = [];
  stubFeeds(h, log);
  h.clickTab('wire');
  var btn = findButtonByText(h.ids.view, '1 · Refresh everything, then make the file');
  ok(!!btn, 'the file button says it refreshes everything first');
  btn._h.click.call(btn);
  ok(log.indexOf('BUILD') < 0, 'nothing is built at the instant of the tap');
  await wait(function () { return log.indexOf('BUILD') >= 0; });
  var iBuild = log.indexOf('BUILD');
  ok(iBuild > 0, 'the file was built after the refresh');
  ['rosters:end', 'syncAll:end', 'boxscores'].forEach(function (k) {
    ok(log.indexOf(k) >= 0 && log.indexOf(k) < iBuild, k + ' finished BEFORE the file was built');
  });
  ok(log.indexOf('schedule:true') >= 0, 'schedule (byes) force-refreshed');
  ok(log.indexOf('syncAll:fresh=true,skipClaude=true') >= 0, 'advice feeds refreshed with every reuse window bypassed and the API skipped');
  ok(log.indexOf('API-CALL') < 0, 'no paid Claude API call was made by the file route');

  console.log('\n-- a failed feed: the user is asked, the file is NOT built silently --');
  var h2 = buildHarness();
  h2.docHandlers.DOMContentLoaded();
  var log2 = [];
  stubFeeds(h2, log2, { rostersFail: true });
  h2.clickTab('wire');
  var b2 = findButtonByText(h2.ids.view, '1 · Refresh everything, then make the file');
  b2._h.click.call(b2);
  await wait(function () { return log2.indexOf('syncAll:end') >= 0; });
  await tick(60);
  ok(log2.indexOf('BUILD') < 0, 'with a failed feed the file waits for the user to choose');
  var confirm = findButtonByText(h2.W.document.body, 'Use saved data');
  ok(!!confirm, 'the "Use saved data" choice is offered');
  if (confirm) { confirm._h.click.call(confirm); ok(log2.indexOf('BUILD') >= 0, 'choosing it builds the file'); }

  console.log('\n-- source pins: the paid API buttons refresh first too --');
  var ui = fs.readFileSync(A('ui.js'), 'utf8');
  ok(/claudeAsk\(function \(\) \{\s*jobStart\('teamanalysis'/.test(ui), 'team-analysis Ask Claude goes through the refresh');
  ok(/claudeAsk\(function \(\) \{\s*jobStart\('waivers'/.test(ui), 'wire Ask Claude goes through the refresh');
  var rec = fs.readFileSync(A('recommend.js'), 'utf8');
  ok(/if \(skipClaude\)/.test(rec), 'syncAll honours skipClaude');

  console.log(fails ? '\n' + fails + ' claudeprep check(s) FAILED' : '\nall claudeprep checks passed');
  process.exit(fails ? 1 : 0);
}());
