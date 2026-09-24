/* test_picks2.js — Tj's picks from the v8.6 proposals (2026-09-24b):
 * "Add recommended features 1, 2, 3, 6, 7, 8, 9, 10. For the live tab, move
 *  the projection/win probability card to the bottom of the section under the
 *  live team tracking."
 *   1  win probability on Live            2  position colours
 *   3  compact injury badges              6  matchup difficulty chip
 *   7  trending on the Wire               8  one player card
 *   9  inactives alert (Java; see test_alertplan.js)
 *  10  Data -> League: standings first, score entry collapsed until kickoff
 *
 * Rendered for real: ui.js boots against a stub DOM (the test_picks.js
 * pattern) and the assertions walk the nodes it built.
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


function text(n) {
  if (!n) return '';
  if (n.nodeType === 3) return n.textContent;
  return (n.textContent || '') + (n.children || []).map(text).join('');
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-6); }
var pending = [];

/* =============================================================== #1 + layout */
console.log('\n-- #1 win probability, and the card under the live team boxes --');
(function () {
  var h = buildHarness();
  h.docHandlers.DOMContentLoaded();
  var W = h.W, Sim = W.Sim, Sch = W.Schedule;
  /* the math */
  var even = Sim.matchupOdds({ banked: 0, players: [{ pos: 'WR', proj: 10, rem: 1 }] },
                             { banked: 0, players: [{ pos: 'WR', proj: 10, rem: 1 }] }, 3);
  ok(near(even.pA, 0.5), 'identical sides are a coin flip (' + even.pA + ')');
  var done = Sim.matchupOdds({ banked: 120, players: [] }, { banked: 110, players: [] }, 3);
  ok(done.pA === 1 && done.sd === 0, 'nothing left to play and ahead: decided (1)');
  var a = { banked: 20, players: [{ pos: 'QB', proj: 40, rem: 1 }, { pos: 'RB', proj: 15, rem: 0.5 }] };
  var b = { banked: 30, players: [{ pos: 'WR', proj: 20, rem: 1 }] };
  var ab = Sim.matchupOdds(a, b, 3), ba = Sim.matchupOdds(b, a, 3);
  ok(near(ab.pA + ba.pA, 1, 1e-9), 'symmetric: P(A beats B) + P(B beats A) = 1');
  ok(near(ab.meanA, 20 + 40 + 7.5) && near(ab.meanB, 50), 'a mid-game player adds proj x the part of his game left (' + ab.meanA + ')');
  ok(ab.pA > 0.5 && ab.pA < 0.99, 'favoured but not certain (' + ab.pA.toFixed(3) + ')');
  ok(near(Sim._phi(0), 0.5, 1e-7) && near(Sim._phi(1.96), 0.975, 1e-3), 'the normal CDF is right');
  /* the game clock -> fraction left */
  var R = Sch._remainingOf;
  ok(R('pre', '') === 1 && R('post', 'Final') === 0, 'before kickoff 1, after the final whistle 0');
  ok(near(R('in', '7:33 - 3rd'), (15 + 7.55) / 60, 1e-9), '"7:33 - 3rd" is 22.55 of 60 minutes left');
  ok(R('in', 'Halftime') === 0.5 && R('in', 'End of 3rd') === 0.25 && R('in', '3:00 - OT') === 0.02,
     'halftime .5, end of the 3rd .25, overtime a sliver');
  ok(R('in', 'Delayed') === 0.5, 'an unreadable live clock counts as half played, never over');

  /* on screen */
  var St = W.Store, S = St.get(), wk = S.settings.currentWeek || 1;
  St.setMatchups(wk, [[S.league.me, 'tugdude']]);
  rerender(h, 'live');
  var kids = h.ids.view.children[0] ? h.ids.view.children[0].children : [];
  var colsAt = kids.map(function (n) { return hasClass(n, 'mu2'); }).indexOf(true);
  var cardAt = kids.map(function (n) { return hasClass(n, 'card') && /Your matchup/.test(text(n)); }).indexOf(true);
  ok(colsAt === 0 && cardAt === 1, 'the live team boxes come first, the projection card under them (' + colsAt + ', ' + cardAt + ')');
  var wp = all(h.ids.view, function (n) { return hasClass(n, 'wp'); })[0];
  ok(!!wp && /Win probability · you \d+%/.test(text(wp)) && /\d+% Tugdude/.test(text(wp)),
     'the card shows "Win probability · you N% · M% Tugdude": ' + (wp ? text(wp).replace(/\s+/g, ' ') : 'none'));
  var fill = wp ? all(wp, function (n) { return n.tagName === 'I'; })[0] : null;
  ok(fill && /^\d+%$/.test(fill.style.width), 'with a bar filled to the same percentage (' + (fill && fill.style.width) + ')');

  /* halftime of my QB's game: banked + half his projection */
  var me = St.team(S.league.me);
  var L = St.getLineup(wk, S.league.me), qbId = L.QB, qb = St.playerById(qbId).player;
  var line = W.Scoring.emptyLine(); line.played = true; line.pass.cmp = 10; line.pass.yds = 100;
  St.setLine(wk, qbId, line);
  Sch.ingest(wk, [{ id: 'q', date: new Date(Date.now() - 2 * 3600e3).toISOString(), state: 'in', detail: 'Halftime',
    teams: [{ abbr: qb.nfl, homeAway: 'home' }, { abbr: 'ZZQ', homeAway: 'away' }] }]);
  rerender(h, 'live');
  var box = all(h.ids.view, function (n) { return hasClass(n, 'halfbox') && hasClass(n, 'me'); })[0];
  var sub = box ? all(box, function (n) { return hasClass(n, 'sub'); })[0] : null;
  var proj = sub ? Number((/proj ([\d.]+)/.exec(sub.textContent) || [])[1]) : NaN;
  var byId = {};
  W.Recommend.projectAll(wk, S.league.me, null).forEach(function (x) { byId[x.p.id] = x; });
  var expect = St.teamWeekPoints(wk, S.league.me).total;
  St.teamWeekPoints(wk, S.league.me).detail.forEach(function (d) {
    if (!d.pid || d.onBye) return;
    expect += (Number(byId[d.pid] && byId[d.pid].proj) || 0) * (d.pid === qbId ? 0.5 : 1);
  });
  ok(near(proj, Math.round(expect * 10) / 10, 0.051),
     'at halftime his projection counts half his game on top of what he banked (' + proj + ' vs ' + expect.toFixed(1) + ')' +
     '  <-- v8.6 dropped the rest of a live game');

  /* the week over: a result, no probability */
  S.weekMeta[String(wk)] = { synced: true, allFinal: true, at: new Date().toISOString(), games: 16 };
  rerender(h, 'live');
  var ban = all(h.ids.view, function (n) { return hasClass(n, 'banner'); })[0];
  ok(ban && /^Final · (you won by|you lost by|a tie)/.test(text(ban)), 'a finished week reads "' + (ban && text(ban)) + '"');
  ok(all(h.ids.view, function (n) { return hasClass(n, 'wp'); }).length === 0, 'and no win probability is shown for it');
}());

setTimeout(function () {
  pending.forEach(function (f) { f(); });
  console.log(fails ? ('\n  ' + fails + ' picks2 check(s) FAILED') : '\n  picks2 checks pass');
  process.exit(fails ? 1 : 0);
}, 700);
