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

var STATE = 'fftracker_state_v1';
function copyDisk(d) { var o = {}, k; for (k in d) o[k] = d[k]; return o; }
/* A restart: a NEW app instance on a snapshot of the disk as it stands right
   now. A snapshot, not the live object, so the old instance's leftover timers
   cannot write into the new one's disk — only what was already saved counts. */
function boot(disk) { var h = buildHarness(copyDisk(disk)); h.docHandlers.DOMContentLoaded(); return h; }
function snap(St, wk, tid) {
  var L = St.getLineup(wk, tid), out = {};
  St.slotKeys().forEach(function (k) { out[k.key] = L[k.key] || ''; });
  return out;
}
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function diff(a, b) {
  var out = [], k;
  for (k in a) if (a[k] !== b[k]) out.push(k + ':' + (a[k] || '-') + '->' + (b[k] || '-'));
  return out.join(' ') || 'none';
}
function slotSel(h, tid, key) {
  return all(h.ids.view, function (n) {
    return n.tagName === 'SELECT' && n.getAttribute('data-fk') === 'ln|' + tid + '|' + key;
  })[0] || null;
}
function choose(s, pid) { s.value = pid; s._h.change.call(s); }
function cardOf(h, name) {
  return all(h.ids.view, function (n) {
    return hasClass(n, 'card') && n.children[0] && n.children[0].tagName === 'H2' &&
           text(n.children[0]).indexOf(name) === 0;
  })[0] || null;
}
/* A player on the team's roster, eligible for `pos`, not in this week's lineup. */
function benchFor(St, wk, tid, pos) {
  var L = St.getLineup(wk, tid), used = {}, k;
  for (k in L) used[L[k]] = 1;
  return St.eligible(tid, pos).filter(function (p) { return !used[p.id]; })[0] || null;
}
/* What a sync does to the numbers under the app between two sessions: a big
   scored game for every bench player, so the best projected lineup — the one
   boot()'s auto-fill re-derives — is no longer the one on screen. */
function syncLandsBigGames(W, wk, tids) {
  var St = W.Store, S = St.get(), w;
  for (w = 1; w < wk; w++) {
    if (!S.weekMeta[String(w)]) S.weekMeta[String(w)] = {};
    S.weekMeta[String(w)].synced = true; S.weekMeta[String(w)].allFinal = true;
  }
  tids.forEach(function (tid) {
    var L = St.getLineup(wk, tid), on = {}, k;
    for (k in L) on[L[k]] = 1;
    St.team(tid).players.forEach(function (p) {
      if (on[p.id]) return;
      for (w = 1; w < wk; w++) {
        var l = W.Scoring.emptyLine(); l.played = true;
        l.rush.yds = 180; l.rush.td = 3; l.rec.rec = 9; l.rec.yds = 150; l.rec.td = 2;
        l.pass.cmp = 30; l.pass.yds = 400; l.pass.td = 4;
        St.setLine(w, p.id, l);
      }
    });
  });
  St.save();
}

var WK = 3;
/* a first install, moved to week 3 with a matchup in weeks 2 and 3 */
var base = (function () {
  var h = buildHarness(); h.docHandlers.DOMContentLoaded();
  var St = h.W.Store, S = St.get();
  S.settings.currentWeek = WK; S.settings.lastTab = 'lineups';
  var opp = S.teams.filter(function (t) { return t.id !== S.league.me; })[0].id;
  St.setMatchups(2, [[S.league.me, opp]]);
  St.setMatchups(WK, [[S.league.me, opp]]);
  return { disk: copyDisk(h.disk), me: S.league.me, opp: opp };
}());

console.log('\n-- a dropdown change to MY lineup and my OPPONENT\'s survives a restart --');
(function () {
  var h = boot(base.disk), W = h.W, St = W.Store, S = St.get();
  ok(S.settings.currentWeek === WK, 'the app opens on week ' + WK);
  h.clickTab('lineups');
  var meName = St.team(base.me).name, oppName = St.team(base.opp).name;
  ok(!!cardOf(h, meName) && !!cardOf(h, oppName), 'Lineups shows my card and ' + oppName + '\'s');
  var auto0 = snap(St, WK, base.me);
  var filled0 = Object.keys(auto0).filter(function (k) { return auto0[k]; }).length;
  ok(filled0 >= 8, 'boot auto-filled my lineup (' + filled0 + ' slots)');

  /* my WR1 -> a bench receiver, the opponent's RB1 -> a bench back */
  var myPick = benchFor(St, WK, base.me, 'WR') || benchFor(St, WK, base.me, 'FLEX');
  var opPick = benchFor(St, WK, base.opp, 'RB') || benchFor(St, WK, base.opp, 'FLEX');
  ok(!!myPick && !!opPick, 'both rosters have a bench player to start');
  choose(slotSel(h, base.me, 'WR1'), myPick.id);
  choose(slotSel(h, base.opp, 'RB1'), opPick.id);
  var mine = snap(St, WK, base.me), theirs = snap(St, WK, base.opp);
  ok(mine.WR1 === myPick.id && theirs.RB1 === opPick.id, 'both changes are on screen');

  /* on disk THIS instant — no pause, no timer, nothing else ran */
  var onDisk = JSON.parse(h.disk[STATE]).lineups[String(WK)];
  ok(onDisk[base.me].WR1 === myPick.id && onDisk[base.opp].RB1 === opPick.id,
     'both are already written to disk the moment the dropdown changes');

  /* then a sync lands and moves every projection under both lineups */
  syncLandsBigGames(W, WK, [base.me, base.opp]);
  var wantMine = W.Recommend.autoLineup(WK, base.me, null);
  var wantTheirs = W.Recommend.autoLineup(WK, base.opp, null);
  var moved = 0, k;
  for (k in wantMine) if (k !== 'WR1' && wantMine[k] !== mine[k]) moved++;
  for (k in wantTheirs) if (k !== 'RB1' && wantTheirs[k] !== theirs[k]) moved++;
  ok(moved > 0, 'the auto-default now wants ' + moved + ' OTHER slot(s) changed (the test would prove nothing otherwise)');

  /* close the app with no warning (no __appPause) and open it again */
  var h2 = boot(h.disk), St2 = h2.W.Store;
  h2.clickTab('lineups');
  var mine2 = snap(St2, WK, base.me), theirs2 = snap(St2, WK, base.opp);
  ok(same(mine, mine2), 'after a restart MY lineup is exactly as I left it (changed: ' + diff(mine, mine2) + ')' +
     '  <-- it "defaulted back to a different lineup"');
  ok(same(theirs, theirs2), 'and so is my OPPONENT\'s (changed: ' + diff(theirs, theirs2) + ')');
  var sel2 = slotSel(h2, base.me, 'WR1');
  ok(sel2 && sel2.value === myPick.id, 'the WR1 dropdown shows my pick after the restart');
  var lab = all(cardOf(h2, meName), function (n) { return n.tagName === 'LABEL'; });
  ok(lab.length && lab.every(function (l) { return /· yours|· left empty|● started/.test(text(l)); }),
     'every slot on my card now says it is mine, not "auto"');
  ok(/saved as you set it/.test(text(cardOf(h2, meName))), 'and the card says the lineup is saved as I set it');

  /* the NEXT restart too — and after another sync and a re-render */
  syncLandsBigGames(h2.W, WK, [base.me, base.opp]);
  var h3 = boot(h2.disk);
  ok(same(mine, snap(h3.W.Store, WK, base.me)) && same(theirs, snap(h3.W.Store, WK, base.opp)),
     'still exactly the same after a second sync and a second restart');

  /* "Reset to auto" still hands MY lineup back — and leaves the opponent's alone */
  h3.clickTab('lineups');
  click(button(cardOf(h3, meName), 'Reset to auto'));
  var reset = snap(h3.W.Store, WK, base.me);
  ok(same(reset, (function () {
       var a = h3.W.Recommend.autoLineup(WK, base.me, null), o = {};
       h3.W.Store.slotKeys().forEach(function (k2) { o[k2.key] = a[k2.key] || ''; });
       return o;
     }())), 'Reset to auto puts the recommended lineup back');
  ok(h3.W.Store.slotKeys().every(function (k2) { return !h3.W.Store.isManual(WK, base.me, k2.key); }),
     'and un-pins it, so auto-fill manages it again');
  ok(same(theirs, snap(h3.W.Store, WK, base.opp)), 'my opponent\'s saved lineup is untouched by my reset');
}());

console.log('\n-- "Copy wk 2" is saved as mine too --');
(function () {
  var h = boot(base.disk), W = h.W, St = W.Store;
  /* last week I started a bench receiver at WR1 and left TE empty */
  var auto3 = snap(St, WK, base.me), k;
  for (k in auto3) if (auto3[k]) St.setSlot(2, base.me, k, auto3[k], true);
  var bw = benchFor(St, WK, base.me, 'WR');
  if (bw) St.setSlot(2, base.me, 'WR1', bw.id, true);
  St.setSlot(2, base.me, 'TE', '', true);
  var wk2 = snap(St, 2, base.me);
  h.clickTab('lineups');
  click(button(cardOf(h, St.team(base.me).name), 'Copy wk 2'));
  var copied = snap(St, WK, base.me);
  ok(same(copied, wk2), 'the copy is exact, empty TE included (' + diff(wk2, copied) + ')');
  var ids = Object.keys(copied).map(function (x) { return copied[x]; }).filter(Boolean);
  ok(ids.length === Object.keys(ids.reduce(function (o, x) { o[x] = 1; return o; }, {})).length,
     'no player ends up in two slots');
  ok(/saved as yours/.test(h.ids.toast.textContent), 'the toast says it was saved: "' + h.ids.toast.textContent + '"');
  syncLandsBigGames(W, WK, [base.me]);
  var h2 = boot(h.disk);
  ok(same(copied, snap(h2.W.Store, WK, base.me)),
     'after a sync and a restart the copied lineup is still there (' + diff(copied, snap(h2.W.Store, WK, base.me)) + ')' +
     '  <-- the copy marked nothing, so boot auto-filled over it');
}());

console.log('\n-- a slot set to "— empty —" stays empty --');
(function () {
  var h = boot(base.disk), St = h.W.Store;
  h.clickTab('lineups');
  choose(slotSel(h, base.me, 'K'), '');
  ok(!St.getLineup(WK, base.me).K, 'K is empty on screen');
  var h2 = boot(h.disk);
  ok(!h2.W.Store.getLineup(WK, base.me).K,
     'and still empty after a restart  <-- boot used to refill a slot he emptied by hand');
  h2.clickTab('lineups');
  var labs = all(cardOf(h2, h2.W.Store.team(base.me).name), function (n) { return n.tagName === 'LABEL'; });
  ok(labs.some(function (l) { return /^K/.test(text(l)) && /left empty/.test(text(l)); }),
     'the K row says "left empty"');
}());

console.log('\n-- a failed write is said out loud --');
(function () {
  var h = boot(base.disk), W = h.W, St = W.Store;
  h.clickTab('lineups');
  var pick = benchFor(St, WK, base.me, 'RB') || benchFor(St, WK, base.me, 'FLEX');
  W.Native.save = function () { return false; };   /* storage full */
  choose(slotSel(h, base.me, 'RB1'), pick.id);
  ok(/Could not save/.test(h.ids.toast.textContent) && !h.ids.toast.hidden,
     'a lineup change that did not reach disk shows a warning: "' + h.ids.toast.textContent + '"');
}());

console.log('\n-- source pins --');
(function () {
  var st = fs.readFileSync(A('store.js'), 'utf8');
  var code = st.replace(/\/\*[\s\S]*?\*\//g, '');
  var setSlot = code.slice(code.indexOf('function setSlot'), code.indexOf('function isManual'));
  ok(/pinLineup\(/.test(setSlot), 'Store.setSlot pins the whole lineup on a manual edit');
  var copy = code.slice(code.indexOf('function copyLineup'), code.indexOf('function getMatchups'));
  ok(/pinLineup\(/.test(copy), 'Store.copyLineup pins it too');
}());

setTimeout(function () {
  console.log(fails ? ('\n  ' + fails + ' lineup-save check(s) FAILED') : '\n  lineup-save checks pass');
  process.exit(fails ? 1 : 0);
}, 300);
