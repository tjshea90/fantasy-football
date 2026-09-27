/* test_livescore.js — Tj, 2026-09-27:
 *   "For the live scoring defense, it is showing 10 points scored at the
 *    beginning of the game because the team the defense is playing has 0
 *    points. Do not add points for this until the game is final. A defense
 *    should not begin a game with 10 fantasy points, that makes no sense.
 *    For the players in the live scoring section, make sure it tells me what
 *    quarter they are in if it is live. Right now it just says 10:32 but
 *    doesn't tell me what quarter"
 *
 * The real ui.js boots against a stub DOM (the test_picks2.js harness) and
 * syncs through the REAL Espn.weekGames and Espn.gameStats — only the bridge's
 * HTTP answers are faked, shaped like ESPN's live scoreboard (checked against
 * the real feed on 2026-09-27: shortDetail "12:59 - 2nd", period 2,
 * displayClock "12:59"). Each fix is confirmed to fail against the pre-fix code.
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

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
var NB = ' ';

/* ---- fake ESPN, routed by URL through the bridge's plain httpGet ---------- */
var feed = { state: 'in', detail: '14:12 - 1st', period: 1, clock: '14:12',
             defScore: 0, oppScore: 0, sacks: 0, defAb: '', oppAb: 'ZZO' };
function scoreboardJson() {
  return { events: [{ id: '9001', date: new Date(Date.now() - 600e3).toISOString(), week: { number: 1 },
    status: { period: feed.period, displayClock: feed.clock,
              type: { state: feed.state, shortDetail: feed.detail, completed: feed.state === 'post' } },
    competitions: [{ competitors: [
      { team: { abbreviation: feed.defAb }, score: String(feed.defScore), homeAway: 'home' },
      { team: { abbreviation: feed.oppAb }, score: String(feed.oppScore), homeAway: 'away' }] }] }] };
}
function summaryJson() {
  return { header: { competitions: [{ competitors: [
      { team: { id: '1', abbreviation: feed.defAb }, score: String(feed.defScore) },
      { team: { id: '2', abbreviation: feed.oppAb }, score: String(feed.oppScore) }] }] },
    boxscore: { players: [
      { team: { abbreviation: feed.defAb }, statistics: [
        { name: 'defensive', labels: ['SACKS', 'TD'], athletes: [], totals: [String(feed.sacks), '0'] }] },
      { team: { abbreviation: feed.oppAb }, statistics: [] }] } };
}
function fakeHttp(url) {
  if (/\/summary\?event=/.test(url)) return JSON.stringify(summaryJson());
  if (/\/scoreboard/.test(url)) return JSON.stringify(scoreboardJson());
  return '{}';
}

/* =========================================================== 1b: the parser */
console.log('\n-- 1b. points allowed waits for the final whistle (the parser) --');
var pending = [];
(function () {
  var h = buildHarness(); h.W.Native.httpGet = fakeHttp;
  var Espn = h.W.Espn, Sc = h.W.Scoring;
  feed.defAb = 'AAA'; feed.oppScore = 0; feed.sacks = 0;
  pending.push(Promise.all([Espn.gameStats('9001', 'in'), Espn.gameStats('9001', 'pre'),
                            Espn.gameStats('9001', 'post'), Espn.gameStats('9001')]).then(function (rs) {
    var live = rs[0].teamAgg.AAA, pre = rs[1].teamAgg.AAA, fin = rs[2].teamAgg.AAA, old = rs[3].teamAgg.AAA;
    ok(live.pointsAllowed === null, 'a live game: points allowed is not scored yet (' + live.pointsAllowed + ')' +
       '  <-- the running 0 was paid as "0 allowed = +10"');
    ok(Sc.score(Espn.dstLine(live)).total === 0,
       'a defence 0-0 at kickoff with nothing done scores 0, not 10 (got ' + Sc.score(Espn.dstLine(live)).total + ')');
    ok(pre.pointsAllowed === null, 'before kickoff: not scored either');
    ok(fin.pointsAllowed === 0 && Sc.score(Espn.dstLine(fin)).total === 10,
       'once FINAL, a shutout pays its +10 (RULES_2026.md: 0 -> 10)');
    ok(old.pointsAllowed === 0, 'a caller that passes no game state keeps the old behaviour');
  }));
}());

/* ================================================ 1b: through the real sync */
Promise.all(pending).then(function () {
  console.log('\n-- 1b. ... and through the real sync, kickoff to final --');
  var h = buildHarness(); h.W.Native.httpGet = fakeHttp;
  h.docHandlers.DOMContentLoaded();
  var W = h.W, St = W.Store, S = St.get(), Sc = W.Scoring;
  while (S.settings.currentWeek > 1) h.ids.wkPrev._h.click();
  var me = St.team(S.league.me);
  var L = St.getLineup(1, me.id), defPid = L.DEF;
  var def = defPid ? St.playerById(defPid).player : null;
  ok(!!def && def.pos === 'DEF', 'my lineup starts a defence (' + (def && def.name) + ', ' + (def && def.nfl) + ')');
  feed.defAb = String(def.nfl).toUpperCase(); feed.oppAb = 'ZZO';
  St.setMatchups(1, [[me.id, S.teams.filter(function (t) { return t.id !== me.id; })[0].id]]);
  function expect(sacks, pa) {
    var l = Sc.emptyLine(); l.played = true; l.dst.sacks = sacks; l.dst.pointsAllowed = pa;
    return Sc.score(l).total;
  }
  function defRowPts() {
    h.clickTab('stats'); h.clickTab('live');
    var box = all(h.ids.view, function (n) { return hasClass(n, 'halfbox') && hasClass(n, 'me'); })[0];
    var row = box ? all(box, function (n) {
      return hasClass(n, 'row') && n.children[0] && text(n.children[0]) === 'DEF';
    })[0] : null;
    return row;
  }
  function sync() { h.ids.syncBtn._h.click(); return wait(60); }

  /* kickoff: 14:12 left in the 1st, nobody has scored */
  feed.state = 'in'; feed.detail = '14:12 - 1st'; feed.period = 1; feed.clock = '14:12';
  feed.oppScore = 0; feed.sacks = 0;
  return sync().then(function () {
    var pts = St.playerPoints(1, defPid);
    ok(pts === 0, 'kickoff, 0-0: my defence has 0 points, not 10 (got ' + pts + ')  <-- Tj\'s screenshot');
    var row = defRowPts();
    var ptsEl = row ? all(row, function (n) { return hasClass(n, 'pts'); })[0] : null;
    ok(ptsEl && /^0\.0/.test(text(ptsEl)), 'and the Live row reads 0.0 (' + (ptsEl && text(ptsEl)) + ')');

    /* 2nd quarter: two sacks, 7 allowed so far */
    feed.detail = '10:32 - 2nd'; feed.period = 2; feed.clock = '10:32';
    feed.oppScore = 7; feed.sacks = 2;
    return sync().then(function () {
      /* the live poll ingests the same scoreboard every tick (liveTick) */
      return W.Espn.weekGames(2026, 1, 2).then(function (g) { W.Schedule.ingest(1, g); });
    });
  }).then(function () {
    var pts = St.playerPoints(1, defPid);
    ok(pts === expect(2, null), 'mid-game the sacks count live (' + pts + ' = ' + expect(2, null) + '), the allowed tier does not');
    var row = defRowPts();
    var badge = row ? all(row, function (n) { return hasClass(n, 'gLive'); })[0] : null;
    ok(badge && badge.textContent.trim() === 'Q2' + NB + '10:32',
       '1c: the live row says the quarter WITH the clock: "' + (badge && badge.textContent.trim()) + '"');

    /* final: 7 allowed -> the 2-10 tier */
    feed.state = 'post'; feed.detail = 'Final'; feed.period = 4; feed.clock = '0:00';
    return sync();
  }).then(function () {
    var pts = St.playerPoints(1, defPid);
    ok(pts === expect(2, 7) && pts - expect(2, null) === 7,
       'at the FINAL the tier is paid: 7 allowed = +7 (' + pts + ')');
    var line = St.lineFor(1, defPid);
    ok(line && line.dst.pointsAllowed === 7, 'and points allowed is on the stored line (' + (line && line.dst.pointsAllowed) + ')');
  });
}).then(function () {
  /* ======================================================= 1c: the clock */
  console.log('\n-- 1c. the quarter is always on the clock --');
  var h = buildHarness(); h.W.Native.httpGet = fakeHttp;
  var W = h.W, Sch = W.Schedule, LC = Sch._liveClock;
  ok(LC('10:32 - 2nd') === 'Q2' + NB + '10:32', 'ESPN\'s "10:32 - 2nd" -> "Q2 10:32", joined by a NO-BREAK space');
  ok(LC('End of 3rd') === 'End' + NB + 'Q3' && LC('3:10 - OT') === 'OT' + NB + '3:10', 'end of quarter and overtime too');
  ok(LC('Weather delay', 3, '5:12') === 'Q3' + NB + '5:12' && LC('Delayed', 2, '') === 'Q2' &&
     LC('', 5, '4:00') === 'OT' + NB + '4:00' && LC('', 6, '1:00') === '2OT' + NB + '1:00',
     'wording it does not know still gets the quarter from ESPN\'s period/clock numbers');
  ok(LC('Delayed') === 'LIVE' && LC('Delayed', 0, '') === 'LIVE', 'nothing to go on at all: LIVE, never a wrong clock');
  feed.state = 'in'; feed.detail = 'Weather delay'; feed.period = 3; feed.clock = '5:12';
  return W.Espn.weekGames(2026, 1, 2).then(function (games) {
    ok(games[0].period === 3 && games[0].clock === '5:12', 'the scoreboard\'s period and clock are kept (' +
       games[0].period + ', ' + games[0].clock + ')');
  })['catch'](function (e) { ok(false, 'weekGames: ' + e); });
}).then(function () {
  var h = buildHarness(); h.W.Native.httpGet = fakeHttp; h.docHandlers.DOMContentLoaded();
  var W = h.W, St = W.Store;
  feed.defAb = 'KCX';
  return W.Espn.weekGames(2026, 1, 2).then(function (games) {
    W.Schedule.ingest(1, games);
    var b = W.Schedule.badge('KCX', 1);
    ok(b && b.live && b.text === 'Q3' + NB + '5:12', 'an unrecognised live status still badges "Q3 5:12" (' + (b && b.text) + ')');
  });
}).then(function () {
  /* the stylesheet: a badge in a player row never wraps and keeps its colour */
  var css = fs.readFileSync(A('app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  var rules = css.split('}').map(function (r) { return r.trim(); });
  function ruleFor(sel, prop) {
    return rules.filter(function (r) {
      var parts = r.split('{'); if (parts.length < 2) return false;
      return parts[0].split(',').map(function (s) { return s.trim(); }).indexOf(sel) >= 0 && prop.test(parts[1]);
    }).length > 0;
  }
  ok(ruleFor('.row .nm small.gLive', /white-space:\s*nowrap/),
     '.row .nm small.gLive is nowrap — it out-ranks the pre-line rule that split "Q2" from "10:32"');
  ok(ruleFor('.row .nm small.gLive', /color:\s*var\(--good\)/),
     'and keeps its green in a player row (the dim small colour used to win)');
  ok(ruleFor('.row .nm small.gEarly', /color:\s*var\(--accent\)/), 'the early-game badge keeps its accent colour too');
}).then(function () {
  console.log(fails ? ('\n  ' + fails + ' live-score check(s) FAILED') : '\n  live-score checks pass');
  process.exit(fails ? 1 : 0);
}, function (e) {
  console.log('  FAIL crashed: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
