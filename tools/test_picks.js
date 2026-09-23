/* test_picks.js — Tj's picks from the v8.3 proposals list (2026-09-23b):
 * "Do number 1, 2, 3, 5, 6"
 *   1  Roster: PROJ + AVG on every player          (A)
 *   2  Live: each starter's projection pre-game     (B)
 *   3  Advice merged into Lineups, 7 tabs -> 6      (C)
 *   5  Power rankings + playoff odds                (D)
 *   6  Quiet "⋯" row menu instead of red Drop       (E)
 *
 * Rendered for real: ui.js boots against a stub DOM (the same pattern as
 * test_tabsafety.js / test_lifecycle.js) and the assertions walk the nodes it
 * built, rather than grepping source for the intent.
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

/* ======================================================================= A */
console.log('\n-- #1 Roster: PROJ + AVG on every player --');
(function () {
  var h = buildHarness();
  h.docHandlers.DOMContentLoaded();
  var St = h.W.Store, S = St.get(), me = St.team(S.league.me);
  var p = me.players[0];
  function line(pts, played) {
    var l = h.W.Scoring.emptyLine(); l.rec.rec = pts / 2; l.rec.yds = pts * 5; l.played = played; return l;
  }
  var x = { id: p.id, name: p.name, pos: p.pos === 'DEF' ? 'WR' : p.pos, nfl: p.nfl, bye: 4 };
  S.weekMeta['1'] = { synced: true, allFinal: true };
  St.setLine(1, p.id, line(10, true));                               /* 10 pts (5 rec, 50 yds) */
  var bk = {}; bk[h.W.Espn.normName(p.name)] = { n: p.name, t: p.nfl, p: 14 };
  St.setBook(2, bk);                                                 /* no line: the book's 14 */
  St.setLine(3, p.id, line(40, false));                              /* on file but never played */
  var bk4 = {}; bk4[h.W.Espn.normName(p.name)] = { n: p.name, t: p.nfl, p: 30 };
  St.setBook(4, bk4);                                                /* his BYE week */
  var av = St.playerAvg(x, 4);
  ok(av && Math.abs(av.avg - 12) < 1e-9 && av.games === 2,
     'Store.playerAvg: his own line (10) + the league book (14) = 12.0 over 2 games; an inactive line and a bye are not games (got ' +
     JSON.stringify(av) + ')');
  ok(St.playerAvg(x, 0) === null, 'no scored week yet -> null, shown as "avg –" rather than a fake 0.0');
  var d = { id: 'zz', name: 'Nobody', pos: 'DEF', nfl: 'SEA', bye: 11 };
  St.setBook(5, { 'DEF:SEA': { n: 'SEA D/ST', t: 'SEA', p: 9 } });
  ok(St.playerAvg(d, 5) && St.playerAvg(d, 5).avg === 9, 'a defence reads its DEF:<team> book row');

  h.clickTab('rosters');
  var pv = all(h.ids.view, function (n) { return hasClass(n, 'pv'); });
  ok(pv.length === me.players.length + 1,
     'every roster row carries a PROJ/AVG cell, plus the column header (' + pv.length + ' for ' + me.players.length + ' players)');
  var bold = all(h.ids.view, function (n) { return n.tagName === 'B' && n.parentNode && hasClass(n.parentNode, 'pv'); });
  ok(bold.length === me.players.length && bold.every(function (b) { return /^(\d+\.\d|BYE|–)$/.test(b.textContent); }),
     'each PROJ is a number to one decimal (or BYE)');
  var avgs = all(h.ids.view, function (n) { return n.tagName === 'SMALL' && /^avg /.test(n.textContent); });
  ok(avgs.length === me.players.length, 'and each row has its avg line (' + avgs.length + ')');
}());

/* ======================================================================= E */
console.log('\n-- #6 a quiet "⋯" menu instead of seventeen red Drop buttons --');
(function () {
  var h = buildHarness();
  h.docHandlers.DOMContentLoaded();
  var St = h.W.Store, me = St.team(St.get().league.me), n0 = me.players.length;
  h.clickTab('rosters');
  var drops = all(h.ids.view, function (n) { return n.tagName === 'BUTTON' && n.textContent === 'Drop'; });
  ok(drops.length === 0, 'no "Drop" button sits on the roster rows any more (' + drops.length + ')');
  var more = all(h.ids.view, function (n) { return n.tagName === 'BUTTON' && n.textContent === '⋯'; });
  ok(more.length === n0, 'one neutral ⋯ per player (' + more.length + ')');
  ok(more.length && !hasClass(more[0], 'dan'), 'and it is not painted as a danger button');
  click(more[0]);
  var dlg = h.W.document.body.children[h.W.document.body.children.length - 1];
  var dropBtn = dlg ? button(dlg, 'Drop') : null;
  ok(!!dropBtn && !!button(dlg, 'Stats') && !!button(dlg, 'Cancel'), 'tapping it opens a menu: Cancel · Stats · Drop');
  click(dropBtn);
  ok(St.team(St.get().league.me).players.length === n0, 'Drop in the menu does NOT drop yet — it asks first');
  var confirm = h.W.document.body.children[h.W.document.body.children.length - 1];
  click(button(confirm, 'Drop him'));
  ok(St.team(St.get().league.me).players.length === n0 - 1, 'confirming drops exactly one player');
}());

/* ======================================================================= B */
console.log('\n-- #2 Live: each starter\'s projection until his game starts --');
(function () {
  var h = buildHarness();
  h.docHandlers.DOMContentLoaded();
  var St = h.W.Store, S = St.get(), wk = S.settings.currentWeek || 1;
  St.setMatchups(wk, [[S.league.me, 'tugdude']]);
  rerender(h, 'live');
  var pp = all(h.ids.view, function (n) { return hasClass(n, 'pproj'); });
  var starters = St.teamWeekPoints(wk, S.league.me).detail.filter(function (d) { return d.pid && !d.onBye; }).length +
                 St.teamWeekPoints(wk, 'tugdude').detail.filter(function (d) { return d.pid && !d.onBye; }).length;
  ok(pp.length === starters && pp.length > 0,
     'before kickoff every starter shows "p N.N" under his 0.0 (' + pp.length + ' of ' + starters + ')');
  ok(pp.every(function (n) { return /^p \d+\.\d$/.test(n.textContent); }), 'formatted "p 14.2"');
  /* one starter plays: his projection gives way to his real points */
  var d0 = St.teamWeekPoints(wk, S.league.me).detail.filter(function (d) { return d.pid && !d.onBye; })[0];
  var l = h.W.Scoring.emptyLine(); l.rec.rec = 3; l.rec.yds = 40; l.played = true;
  St.setLine(wk, d0.pid, l);
  rerender(h, 'live');
  var pp2 = all(h.ids.view, function (n) { return hasClass(n, 'pproj'); });
  ok(pp2.length === starters - 1, 'once a starter has played, only his real points show (' + pp2.length + ')');
}());

/* ======================================================================= C */
console.log('\n-- #3 Advice lives inside Lineups: 7 tabs -> 6 --');
(function () {
  ok(TAB_NAMES.length === 6 && TAB_NAMES.indexOf('advice') < 0 && TAB_NAMES.indexOf('lineups') >= 0,
     'the nav bar has six tabs and none is "advice" (' + TAB_NAMES.join(',') + ')');
  var disk = {};
  var h = buildHarness(disk);
  h.docHandlers.DOMContentLoaded();
  h.clickTab('lineups');
  var setB = button(h.ids.view, 'Set lineups'), advB = button(h.ids.view, 'Advice');
  ok(!!setB && !!advB && hasClass(setB, 'pri') && !hasClass(advB, 'pri'),
     'Lineups opens on "Set lineups", with an "Advice" chip beside it');
  click(advB);
  var h2s = all(h.ids.view, function (n) { return n.tagName === 'H2'; }).map(function (n) { return n.textContent; });
  ok(h2s.some(function (t) { return /advice/i.test(t); }),
     'the Advice chip shows the old Advice tab\'s own cards (' + h2s.slice(0, 3).join(' | ') + ')');
  ok(hasClass(button(h.ids.view, 'Advice'), 'pri'), 'and the chip shows it is selected');
  h.clickTab('live'); h.clickTab('lineups');
  ok(hasClass(button(h.ids.view, 'Advice'), 'pri'), 'leaving the tab and coming back keeps the sub-view');

  /* a phone last closed on the OLD Advice tab comes back to the same screen */
  var S = h.W.Store.get();
  S.settings.lastTab = 'advice'; S.settings.lineSub = 'set';
  h.W.Store.save();
  var h2 = buildHarness(disk);
  h2.docHandlers.DOMContentLoaded();
  var lin = h2.tabEls.filter(function (e) { return e.getAttribute('data-v') === 'lineups'; })[0];
  ok(lin && lin.classList.contains('on'), 'a saved lastTab of "advice" relaunches onto Lineups');
  ok(hasClass(button(h2.ids.view, 'Advice'), 'pri'), '... on its Advice sub-view, not a blank or Live screen');
  var ui = fs.readFileSync(A('ui.js'), 'utf8');
  ok(/if \(name === 'advice'\) \{ lineSub = 'advice'; name = 'lineups';/.test(ui),
     'goTab("advice") from anywhere is rerouted the same way');
  ok(/if \(isAdviceView\(\)\) return adviceSyncQuiet\(\);/.test(ui),
     'pull-to-refresh on the Advice sub-view still runs the advice sync');
}());

/* ======================================================================= D */
console.log('\n-- #5 power rankings + playoff odds, and odds that are honest early --');
var pendingOdds = null;
(function () {
  var h = buildHarness();
  h.docHandlers.DOMContentLoaded();
  var St = h.W.Store, S = St.get(), Sim = h.W.Sim, reg = S.league.regularSeasonWeeks;
  var ids = S.teams.map(function (t) { return t.id; });
  /* a round robin for the whole regular season */
  var arr = ids.slice(), w, i;
  for (w = 1; w <= reg; w++) {
    var pairs = [];
    for (i = 0; i < arr.length / 2; i++) pairs.push([arr[i], arr[arr.length - 1 - i]]);
    St.setMatchups(w, pairs);
    arr = [arr[0], arr[arr.length - 1]].concat(arr.slice(1, arr.length - 1));
  }
  /* the league: one team clearly best (+25/wk), the rest spread 140..164 */
  function playWeek(wk) {
    ids.forEach(function (id, k) {
      var base = id === S.league.me ? 185 : 140 + (k % 9) * 3;
      St.setManualScore(wk, id, base + ((wk * 7 + k * 13) % 11) - 5);
    });
    S.weekMeta[String(wk)] = { synced: true, allFinal: true };
  }
  h.clickTab('data');
  ok(all(h.ids.view, function (n) { return n.tagName === 'H2' && /Power rankings/.test(n.textContent); }).length === 1,
     'Data -> League has the card even before any week is final');
  playWeek(1); playWeek(2);
  var early = Sim.season(reg);
  function sum(rows, f) { return rows.reduce(function (a, r) { return a + r[f]; }, 0); }
  ok(Math.abs(sum(early.rows, 'playoff') - 6) < 0.01 && Math.abs(sum(early.rows, 'bye') - 2) < 0.01 &&
     Math.abs(sum(early.rows, 'title') - 1) < 0.01,
     'odds are a true distribution: 6 playoff spots, 2 byes, 1 title (' +
     [sum(early.rows, 'playoff'), sum(early.rows, 'bye'), sum(early.rows, 'title')].map(function (x) { return x.toFixed(2); }).join(', ') + ')');
  var meE = early.rows.filter(function (r) { return r.id === S.league.me; })[0];
  ok(meE.title < 0.5 && early.rows.every(function (r) { return r.playoff > 0; }),
     'AFTER TWO WEEKS the best team is not handed the title (' + (meE.title * 100).toFixed(0) +
     '%) and nobody is written off at 0%  <-- the first model said 55% / 0% here');
  for (w = 3; w <= 10; w++) playWeek(w);
  var late = Sim.season(reg);
  var meL = late.rows.filter(function (r) { return r.id === S.league.me; })[0];
  ok(meL.title > meE.title, 'the same dominance over TEN weeks sharpens the odds (' +
     (meE.title * 100).toFixed(0) + '% -> ' + (meL.title * 100).toFixed(0) + '% title)');
  var again = Sim.season(reg);
  ok(JSON.stringify(again.rows) === JSON.stringify(late.rows), 'seeded: the same inputs give the same odds every repaint');
  var pw = Sim.power(reg);
  ok(pw[0].id === S.league.me && pw.every(function (r, k) { return r.rank === k + 1; }),
     'power rankings put the clearly best team first');

  /* the card: renders at once, odds arrive just after the paint */
  rerender(h, 'data');
  var tds = all(h.ids.view, function (n) { return n.tagName === 'TD'; });
  var dots = tds.filter(function (n) { return n.textContent === '…'; }).length;
  ok(dots === 2 * ids.length, 'the table paints immediately with "…" for the odds (' + dots + ')');
  pendingOdds = function () {
    var tds2 = all(h.ids.view, function (n) { return n.tagName === 'TD'; });
    var pct = tds2.filter(function (n) { return /^(<1%|>99%|\d+%)$/.test(n.textContent); }).length;
    ok(pct === 2 * ids.length, '... and the odds are filled in just after, in place (' + pct + ' cells)');
    var dots2 = tds2.filter(function (n) { return n.textContent === '…'; }).length;
    ok(dots2 === 0, 'no "…" left behind');
  };
}());

setTimeout(function () {
  if (pendingOdds) pendingOdds();
  console.log(fails ? ('\n  ' + fails + ' picks check(s) FAILED') : '\n  picks checks pass');
  process.exit(fails ? 1 : 0);
}, 400);
