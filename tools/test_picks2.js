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
    /* everyone in that game (his receivers too) is at halftime */
    expect += (Number(byId[d.pid] && byId[d.pid].proj) || 0) * (d.player && d.player.nfl === qb.nfl ? 0.5 : 1);
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

/* ====================================================== #2 colours + #3 badges */
console.log('\n-- #2 position colours and #3 compact injury badges --');
(function () {
  var h = buildHarness();
  h.docHandlers.DOMContentLoaded();
  var W = h.W, St = W.Store, S = St.get(), wk = S.settings.currentWeek || 1;
  St.setMatchups(wk, [[S.league.me, 'tugdude']]);
  /* an injury feed naming two of my players */
  var feed = { injuries: [{ id: '1', displayName: 'x', injuries: [
    { status: 'Questionable', longComment: 'Warren (knee) was limited.', athlete: { displayName: 'Jaylen Warren' },
      type: { name: 'INJURY_STATUS_QUESTIONABLE', description: 'questionable' }, details: {}, date: '2026-09-24T01:00Z' },
    { status: 'Injured Reserve', longComment: 'Tracy is on IR with a foot injury.', athlete: { displayName: 'Tyrone Tracy Jr.' },
      type: { name: 'INJURY_STATUS_IR', description: 'injured reserve' }, details: { returnDate: '2026-10-20' }, date: '2026-09-20T01:00Z' }
  ] }] };
  W.Espn._httpGetH = W.Espn._httpGet = function () { return Promise.resolve(JSON.parse(JSON.stringify(feed))); };
  pending.push(function () { /* placeholder so ordering stays obvious */ });
  W.Recommend.loadNews(null, { force: true }).then(function () {
    h.clickTab('rosters');
    var slots = all(h.ids.view, function (n) { return hasClass(n, 'slot') && /^(QB|RB|WR|TE|K|DEF)$/.test(n.textContent); });
    ok(slots.length >= 17 && slots.every(function (n) { return hasClass(n, 'pc') && hasClass(n, 'pc-' + n.textContent); }),
       'Roster: every position chip carries its colour class (' + slots.length + ')  <-- v8.6: plain grey');
    var q = all(h.ids.view, function (n) { return hasClass(n, 'inj') && n.textContent === 'Q'; })[0];
    ok(!!q && /QUESTIONABLE/.test(q.title) && /questionable/.test(q.getAttribute('aria-label')),
       'a questionable player shows a "Q" badge, full word as its title/aria-label (' + (q && q.title) + ')');
    var ir = all(h.ids.view, function (n) { return hasClass(n, 'inj') && n.textContent === 'IR'; })[0];
    ok(!!ir && hasClass(ir, 'o'), 'injured reserve reads "IR" (red), not the same "O" as a one-week out');
    var long = all(h.ids.view, function (n) { return hasClass(n, 'tag') && /^(QUESTIONABLE|DOUBTFUL|ESPN has him OUT)$/.test(n.textContent); });
    ok(long.length === 0, 'no spelled-out injury word left in the roster list (' + long.length + ')');
    /* the Wire tab's "Your roster — injuries" card is a roster list too */
    h.clickTab('wire');
    var injCard = all(h.ids.view, function (n) { return hasClass(n, 'card') && /Your roster — injuries/.test(text(n)); })[0];
    var wl = injCard ? all(injCard, function (n) { return hasClass(n, 'tag') && /^(QUESTIONABLE|DOUBTFUL|OUT|PROBABLE)$/.test(n.textContent); }) : [];
    var wb = injCard ? all(injCard, function (n) { return hasClass(n, 'inj'); }) : [];
    ok(!!injCard && wl.length === 0 && wb.length >= 2 && wb.some(function (n) { return n.textContent === 'IR'; }),
       'Wire -> Your roster — injuries uses the same badges (' + wb.map(function (n) { return n.textContent; }).join(',') + ')' +
       '  <-- v8.7 draft still spelled out QUESTIONABLE / OUT there');

    rerender(h, 'live');
    var flex = all(h.ids.view, function (n) { return hasClass(n, 'slot') && n.textContent === 'FLEX'; });
    var rb1 = all(h.ids.view, function (n) { return hasClass(n, 'slot') && n.textContent === 'RB1'; });
    ok(flex.length === 2 && flex.every(function (n) { return !hasClass(n, 'pc'); }), 'Live: FLEX stays neutral (a slot, not a position)');
    ok(rb1.length === 2 && rb1.every(function (n) { return hasClass(n, 'pc-RB'); }), 'Live: RB1 is coloured as an RB');

    h.clickTab('lineups');
    var chips = all(h.ids.view, function (n) { return hasClass(n, 'pchip'); });
    ok(chips.length >= 10 && chips.filter(function (n) { return hasClass(n, 'pc'); }).length === chips.length - chips.filter(function (n) { return n.textContent === 'FLEX'; }).length,
       'Lineups: each slot label carries a coloured chip (' + chips.length + ')');

    /* Advice uses the same helpers (ctx.slotEl / ctx.healthTag) */
    var P = W.Projections, bn = {};
    bn[W.Espn.normName('Jaylen Warren')] = { pos: 'RB', week: 9.5 };
    P._setCacheForTest({ at: Date.now(), week: wk, season: S.settings.season, byName: bn, count: 1, weekly: 1, error: '', route: 't', notes: [] });
    var sub = all(h.ids.view, function (n) { return n.tagName === 'BUTTON' && n.textContent === 'Advice'; })[0];
    click(sub);
    var aslots = all(h.ids.view, function (n) { return hasClass(n, 'slot') && hasClass(n, 'pc'); });
    var abadge = all(h.ids.view, function (n) { return hasClass(n, 'inj'); });
    ok(aslots.length >= 10, 'Advice rows are coloured too (' + aslots.length + ')');
    ok(abadge.length >= 1, 'and use the compact badges (' + abadge.map(function (n) { return n.textContent; }).join(',') + ')');
    var tagClaude = all(h.ids.view, function (n) { return hasClass(n, 'tag') && /^Claude$/i.test(n.textContent); });
    ok(tagClaude.length === 0, 'no bare "CLAUDE" tag (a Claude "out" verdict is an O badge with the sentence on it)');
  }).catch(function (e) { ok(false, 'threw: ' + (e && e.stack || e)); });
}());

/* ================================================================ #6 matchup */
console.log('\n-- #6 matchup difficulty chip --');
(function () {
  var h = buildHarness();
  h.docHandlers.DOMContentLoaded();
  var W = h.W, St = W.Store, S = St.get(), R = W.Recommend;
  h.ids.wkNext._h.click(); h.ids.wkNext._h.click();           /* to week 3 */
  var rbs = W.PlayerDB.get().players.filter(function (p) { return p.p === 'RB'; }).slice(0, 4);
  /* weeks 1-2: KC, BUF, SF, DAL (and IND, HOU so IND has an opponent) */
  var opp1 = { KC: 'BUF', BUF: 'KC', SF: 'DAL', DAL: 'SF' };            /* IND/HOU on bye */
  var opp2 = { KC: 'SF', SF: 'KC', BUF: 'DAL', DAL: 'BUF', IND: 'HOU', HOU: 'IND' };
  function bk(rows) { var o = {}; rows.forEach(function (r) { o[W.Espn.normName(r[0])] = { n: r[0], t: r[1], p: r[2] }; }); return o; }
  /* RB points allowed: SF gives up the most, KC the fewest */
  St.setBook(1, bk([[rbs[0].n, 'KC', 30], [rbs[1].n, 'BUF', 4], [rbs[2].n, 'SF', 12], [rbs[3].n, 'DAL', 26]]));
  St.setBook(2, bk([[rbs[0].n, 'KC', 28], [rbs[1].n, 'BUF', 11], [rbs[2].n, 'SF', 9], [rbs[3].n, 'DAL', 13]]));
  S.weekMeta['1'] = { synced: true, allFinal: true, games: 3, opponents: opp1, at: '' };
  S.weekMeta['2'] = { synced: true, allFinal: true, games: 3, opponents: opp2, at: '' };
  S.weekMeta['3'] = { opponents: { IND: 'SF', SF: 'IND', KC: 'DAL', DAL: 'KC' } };
  St.save();
  var tb = R._fpaTable(3);
  ok(tb.of.RB === 4, 'four defenses with two games are ranked for RBs (' + tb.of.RB + ')');
  var m = R.matchupRank(3, 'RB', 'IND');
  ok(!!m && m.opp === 'SF', 'IND plays SF in week 3');
  /* SF faced DAL's RB in week 1 (26) and KC's in week 2 (28): 27/gm, the most */
  ok(m && m.rank === 4 && m.tier === 'soft' && near(m.fpa, 27), 'SF allows the most to RBs (27/gm): 4th of 4, soft (' + JSON.stringify(m) + ')');
  var m2 = R.matchupRank(3, 'RB', 'SF');
  ok(m2 === null, 'no chip when the opponent (IND) has fewer than two games in the table');
  h.clickTab('rosters');
  var chip = all(h.ids.view, function (n) { return hasClass(n, 'mchip'); });
  var taylorChip = chip.filter(function (n) { return /vs SF/.test(text(n)); })[0];
  ok(!!taylorChip && hasClass(taylorChip, 'soft') && /4th/.test(text(taylorChip)),
     'Roster: Jonathan Taylor (IND) shows "' + (taylorChip ? text(taylorChip) : 'none') + '" in green');
  ok(taylorChip && /SF allows 27 pts a game to RBs/.test(taylorChip.title) && /1st = allows the fewest/.test(taylorChip.title),
     'and its tooltip explains the number: ' + (taylorChip && taylorChip.title));
  h.clickTab('lineups');
  ok(all(h.ids.view, function (n) { return hasClass(n, 'mchip'); }).length >= 1, 'Lineups shows it on the slot label too');
}());

/* ================================================================ #7 trending */
console.log('\n-- #7 trending on the Wire --');
(function () {
  var h = buildHarness();
  h.docHandlers.DOMContentLoaded();
  var W = h.W, St = W.Store, S = St.get(), wk = S.settings.currentWeek || 1;
  var groups = W.Value.byPos(wk, 0), fas = [];
  W.Value.POS.forEach(function (k) { (groups[k] || []).slice(0, 3).forEach(function (f) { fas.push(f); }); });
  ok(fas.length >= 6, 'the harness wire has free agents to work with (' + fas.length + ')');
  /* ESPN ownership rides in on the season projection set */
  var bn = {}, chg = [12.4, 0.2, -3, 25, 7.5, 0.9];
  fas.slice(0, 6).forEach(function (f, i) {
    bn[W.Espn.normName(f.name)] = { pos: f.pos, season: 100, gp: 17, src: 'espn', own: 20 + i * 7, ownChg: chg[i] };
  });
  W.Projections._setSeasonForTest({ at: Date.now(), season: S.settings.season, byName: bn, count: 6, error: '', route: 't', notes: [] });
  var o0 = W.Projections.ownership({ name: fas[0].name, pos: fas[0].pos });
  ok(o0 && o0.own === 20 && o0.chg === 12.4, 'Projections.ownership reads % rostered and the weekly change');
  h.clickTab('wire');
  var chips = all(h.ids.view, function (n) { return hasClass(n, 'ochip'); });
  ok(chips.length >= 1 && chips.some(function (n) { return /^\d+% rostered ▲12$/.test(n.textContent) && hasClass(n, 'up'); }) &&
     chips.some(function (n) { return /▼3$/.test(n.textContent); }),
     'free-agent rows show "N% rostered ▲12" / "▼3" (' + chips.map(function (n) { return n.textContent; }).slice(0, 3).join(' | ') + ')');
  var trend = button(h.ids.view, 'Trending');
  ok(!!trend, 'the filter row has a "Trending" chip');
  click(trend);
  var rows = all(h.ids.view, function (n) { return n.getAttribute && n.getAttribute('data-player') && hasClass(n, 'row'); });
  var names = rows.map(function (n) { return n.getAttribute('data-player').split('|')[0]; });
  var want = fas.slice(0, 6).map(function (f, i) { return { n: f.name, c: chg[i] }; })
    .filter(function (x) { return x.c >= 0.5; }).sort(function (a, b) { return b.c - a.c; }).map(function (x) { return x.n; });
  var got = names.filter(function (n) { return want.indexOf(n) >= 0; });
  ok(JSON.stringify(got.slice(0, want.length)) === JSON.stringify(want) && names.length === want.length,
     'Trending lists only risers, biggest first: ' + got.join(', '));
}());

/* ============================================================= #8 player card */
console.log('\n-- #8 one player card --');
(function () {
  var h = buildHarness();
  h.docHandlers.DOMContentLoaded();
  var W = h.W, St = W.Store, S = St.get(), wk = S.settings.currentWeek || 1;
  St.setMatchups(wk, [[S.league.me, 'tugdude']]);
  var L = St.getLineup(wk, S.league.me), qbId = L.QB, qb = St.playerById(qbId).player;
  /* ESPN's outlook + ownership ride in on the projection set */
  var bn = {}; bn[W.Espn.normName(qb.name)] = { pos: 'QB', week: 38.2, outlook: 'He faces a soft pass defense this week.', own: 97.5, ownChg: 1.2 };
  W.Projections._setCacheForTest({ at: Date.now(), week: wk, season: S.settings.season, byName: bn, count: 1, weekly: 1, error: '', route: 't', notes: [] });
  function lastDialog() { var k = W.document.body.children; return k[k.length - 1]; }
  function dialogs() { return W.document.body.children.filter(function (n) { return n.getAttribute && n.getAttribute('role') === 'dialog'; }); }
  rerender(h, 'live');
  var row = all(h.ids.view, function (n) { return n.getAttribute && n.getAttribute('data-player') && n.getAttribute('data-player').indexOf(qb.name + '|') === 0 && n._h && n._h.click; })[0];
  ok(!!row, 'the Live row for ' + qb.name + ' is tappable');
  click(row);
  var d = lastDialog(), tx = text(d);
  ok(d && /Week \d+/.test(tx) && /Game log/.test(tx) && /Season|Projected/.test(tx),
     'tapping it opens ONE card with this week, the season and the game log');
  ok(/free agent/.test(tx) === false && /My team \(you\)/.test(tx), 'the header says whose roster he is on');
  ok(/ESPN outlook/.test(tx) && /soft pass defense/.test(tx), "ESPN's written outlook is on the card");
  ok(/98% rostered|97% rostered/.test(tx), 'and his % rostered');
  ok(!all(d, function (n) { return n.tagName === 'BUTTON' && n.textContent === 'View stats'; }).length,
     'no "View stats" hop — the game log is on the card itself');
  /* scored: a stat line and Adjust */
  var line = W.Scoring.emptyLine(); line.played = true; line.pass.cmp = 20; line.pass.yds = 200;
  St.setLine(wk, qbId, line); St.save();
  var before = St.playerPoints(wk, qbId);
  click(row);
  d = lastDialog();
  ok(/Scored in week/.test(text(d)) && new RegExp(before.toFixed(1) + ' points').test(text(d)),
     'with a stat line the card shows the points and every scoring part (' + before + ')');
  var adj = all(d, function (n) { return n.tagName === 'BUTTON' && n.textContent === 'Adjust'; })[0];
  var firstFocusable = all(d, function (n) { return n.tagName === 'BUTTON' || n.tagName === 'INPUT' || n.tagName === 'TEXTAREA'; })[0];
  ok(!!adj && firstFocusable === adj, 'Adjust comes before its number field, so opening the card never pops the keyboard');
  click(adj);
  var inp = all(d, function (n) { return n.tagName === 'INPUT'; })[0];
  inp.value = '5';
  click(all(d, function (n) { return n.tagName === 'BUTTON' && n.textContent === 'Save adjustment'; })[0]);
  ok(Math.abs(St.playerPoints(wk, qbId) - (before + 5)) < 1e-9 && Number(St.lineFor(wk, qbId).manualAdj) === 5,
     'Save adjustment goes through Store.setAdj (+5 -> ' + St.playerPoints(wk, qbId) + ')');
  /* long-press anywhere opens the same card, directly */
  var n0 = dialogs().length;
  h.docHandlers.contextmenu({ target: row, preventDefault: function () { } });
  ok(dialogs().length === n0 + 1 && /Game log/.test(text(lastDialog())), 'a long-press opens the card directly (no menu in between)');
  /* Roster ⋯ -> Player card */
  h.clickTab('rosters');
  var more = all(h.ids.view, function (n) { return n.tagName === 'BUTTON' && n.textContent === '⋯'; })[0];
  click(more);
  click(button(lastDialog(), 'Player card'));
  ok(/Game log/.test(text(lastDialog())), 'Roster ⋯ -> Player card opens it too');
  /* a free agent */
  var fa = W.PlayerDB.get().players.filter(function (p) {
    return p.p === 'WR' && !St.allPlayers().some(function (x) { return W.Names.same(x.player.name, p.n); });
  })[0];
  h.docHandlers.contextmenu({ target: (function () { var e = { nodeType: 1, getAttribute: function (k) { return k === 'data-player' ? fa.n + '|WR|' + fa.t : null; }, parentNode: null }; return e; }()), preventDefault: function () { } });
  ok(/free agent/.test(text(lastDialog())), 'a free agent gets the card too, marked as a free agent (' + fa.n + ')');
}());

/* ======================================================================== #9 */
console.log('\n-- #9 inactives alert: the page hands Java the week\'s starter kickoffs --');
(function () {
  var h = buildHarness();
  var calls = { kick: [], inact: [] }, status = { on: false, hour: 11, minute: 30, inact: false, inactAt: 0 };
  h.W.Native.alertsSet = function () { return true; };
  h.W.Native.alertsStatus = function () { return JSON.stringify(status); };
  h.W.Native.alertsTest = function () { };
  h.W.Native.alertsKickoffs = function (csv) {
    calls.kick.push(csv);
    return csv ? Number(csv.split(',')[0]) - 85 * 60000 : 0;
  };
  h.W.Native.alertsInactives = function (on) { calls.inact.push(on); return 0; };
  h.docHandlers.DOMContentLoaded();
  var W = h.W, St = W.Store, S = St.get(), me = S.league.me, wk = S.settings.currentWeek || 1;
  rerender(h, 'lineups');
  var L = St.getLineup(wk, me), team = St.team(me), slotOf = {}, teams = [], k;
  for (k in L) if (L[k]) slotOf[L[k]] = k;
  team.players.forEach(function (p) {
    if (slotOf[p.id] && p.nfl && teams.indexOf(p.nfl) < 0) teams.push(p.nfl);
  });
  var benchP = team.players.filter(function (p) { return !slotOf[p.id] && p.nfl && teams.indexOf(p.nfl) < 0; })[0];
  ok(teams.length >= 4 && !!benchP, 'fixture: ' + teams.length + ' starter NFL teams and a bench player on another team (' + (benchP && benchP.nfl) + ')');
  var now = Date.now(), H = 3600e3;
  function at(ms) { return new Date(Math.floor(ms / 60000) * 60000).toISOString(); }
  var t1 = at(now + 3 * H), t2 = at(now + 6 * H);
  var games = [], opp = 0;
  function game(abbr, iso, state) {
    games.push({ id: 'g' + games.length, date: iso, state: state, detail: '',
      teams: [{ abbr: abbr, homeAway: 'home' }, { abbr: 'ZZ' + (opp++), homeAway: 'away' }] });
  }
  game(teams[0], t1, 'pre'); game(teams[1], t1, 'pre');       /* the 1:00 slate: one entry */
  game(teams[2], t2, 'pre');                                  /* the night game */
  game(teams[3], at(now - H), 'in');                          /* already started */
  for (var i = 4; i < teams.length; i++) game(teams[i], at(now - 4 * H), 'post');
  game(benchP.nfl, at(now + H), 'pre');                       /* bench only: not his problem */
  W.Schedule.ingest(wk, games);
  var want = [Date.parse(t1), Date.parse(t2)].join(',');
  ok(W.Schedule.starterKicks(wk, me).join(',') === want,
     'Schedule.starterKicks: one entry per distinct starter kickoff still to come (' + W.Schedule.starterKicks(wk, me).length + ')');
  ok(W.Schedule.starterKicks(99, me).length === 0 && S.lineups['99'] === undefined,
     'reading a week with no lineup returns nothing and creates no lineup');

  W.__appPause();
  ok(calls.kick.length === 1 && calls.kick[0] === want,
     'leaving the app hands Java the plan: ' + JSON.stringify(calls.kick) + '  <-- v8.6 had no inactives check');
  W.__appResume(); W.__appPause();
  ok(calls.kick.length === 1, 'leaving again with nothing changed sends nothing (' + calls.kick.length + ' calls)');
  W.__appResume();
  for (k in L) {
    if (L[k] && St.playerById(L[k]) && St.playerById(L[k]).player.nfl === teams[2]) St.setSlot(wk, me, k, null, true);
  }
  W.__appPause();
  ok(calls.kick.length === 2 && calls.kick[1] === String(Date.parse(t1)),
     'bench the night-game starter and the next pause re-plans without it (' + calls.kick[1] + ')');
  W.__appResume();

  /* Data -> App: the opt-in switch */
  h.clickTab('data');
  click(button(h.ids.view, 'App'));
  var lab = all(h.ids.view, function (n) { return n.tagName === 'LABEL' && /Inactives check before each/.test(text(n)); })[0];
  var cb = lab ? all(lab, function (n) { return n.tagName === 'INPUT'; })[0] : null;
  ok(!!cb && cb.type === 'checkbox' && !cb.checked, 'Data -> App -> Lineup alerts has an inactives switch, off by default (opt-in)');
  var card = lab ? lab.parentNode : null;
  ok(/every day at/.test(text(card)) && !/Thursday at 4pm/.test(text(card)) && !/on Sunday at/.test(text(card)),
     'the daily check\'s copy matches what Alerts.rearm does (every day + 4pm), not "Sunday / Thursday"');
  var nk = calls.kick.length;
  cb.checked = true; cb._h.change.call(cb);
  ok(calls.inact[calls.inact.length - 1] === true && calls.kick.length === nk + 1,
     'turning it on sets the switch AND sends the current plan even though it did not change');
  var hint = all(card, function (n) { return hasClass(n, 'hint') && /inactives check/i.test(text(n)); })[0];
  ok(!!hint && /^Next inactives check: \w{3} /.test(text(hint)), 'and says when the next check is: ' + (hint && text(hint)));
  status.inact = true; status.inactAt = 0;
  rerender(h, 'data');
  card = all(h.ids.view, function (n) { return hasClass(n, 'card') && /Lineup alerts/.test(text(n)); })[0];
  ok(/Nothing is armed right now/.test(text(card)), 'on with nothing to arm says so, rather than implying a check is coming');
}());

/* ======================================================================= #10 */
console.log('\n-- #10 Data -> League: standings first, score entry collapsed until kickoff --');
(function () {
  var h = buildHarness();
  h.docHandlers.DOMContentLoaded();
  var W = h.W, St = W.Store, S = St.get(), wk = S.settings.currentWeek || 1, me = S.league.me;
  var now = Date.now(), H = 3600e3;
  function slate(state, ms) {
    var g = [], i = 0;
    S.teams.forEach(function () { });
    ['KC', 'BUF', 'PHI', 'DAL'].forEach(function (a) {
      g.push({ id: 'x' + (i++), date: new Date(ms).toISOString(), state: state, detail: '',
               teams: [{ abbr: a, homeAway: 'home' }, { abbr: 'Z' + a, homeAway: 'away' }] });
    });
    return g;
  }
  /* the week has not started, and nobody has typed a score */
  S.teams.forEach(function (t) { if (t.id !== me) St.setManualScore(wk, t.id, ''); });
  W.Schedule.ingest(wk, slate('pre', now + 30 * H));
  h.clickTab('data');
  click(button(h.ids.view, 'League'));
  function cards() { return all(h.ids.view, function (n) { return hasClass(n, 'card'); }); }
  function h2(n) { var x = all(n, function (m) { return m.tagName === 'H2'; })[0]; return x ? text(x) : ''; }
  var cs = cards();
  ok(/^Standings/.test(h2(cs[0])) && /^Enter week \d+ scores/.test(h2(cs[1])),
     'Standings is the first card, score entry the second (' + h2(cs[0]) + ' | ' + h2(cs[1]) + ')  <-- v8.6: scores first');
  function scoreDetails() { return all(h.ids.view, function (n) { return n.tagName === 'DETAILS' && hasClass(n, 'wsc'); })[0]; }
  var d = scoreDetails();
  ok(!!d && d.open === false, 'before the week kicks off the score boxes are collapsed');
  ok(d && /Opens once week \d+ kicks off/.test(text(d.children[0])), 'and the heading says when it opens: ' + (d ? text(d.children[0]) : ''));
  ok(d && all(d, function (n) { return n.tagName === 'INPUT'; }).length === S.teams.length - 1,
     'the ' + (S.teams.length - 1) + ' boxes are still there, one tap away (collapsed, not removed)');
  /* he opened it himself: a re-render keeps it open */
  d.open = true; if (d._h && d._h.toggle) d._h.toggle.call(d);
  rerender(h, 'data');
  ok(scoreDetails().open === true, 'opened by hand, it stays open across a re-render');

  /* a fresh app: once a game of the week has started it opens by itself */
  var h2b = buildHarness(); h2b.docHandlers.DOMContentLoaded();
  var W2 = h2b.W, St2 = W2.Store, S2 = St2.get(), wk2 = S2.settings.currentWeek || 1;
  S2.teams.forEach(function (t) { if (t.id !== S2.league.me) St2.setManualScore(wk2, t.id, ''); });
  W2.Schedule.ingest(wk2, slate('in', now - H));
  h2b.clickTab('data');
  var d2 = all(h2b.ids.view, function (n) { return n.tagName === 'DETAILS' && hasClass(n, 'wsc'); })[0];
  ok(d2 && d2.open === true, 'a game of the week in progress: open');
  /* before kickoff but a score already typed: never hide it */
  W2.Schedule.ingest(wk2, slate('pre', now + 30 * H));
  var other = S2.teams.filter(function (t) { return t.id !== S2.league.me; })[0];
  St2.setManualScore(wk2, other.id, '101.5');
  rerender(h2b, 'data');
  d2 = all(h2b.ids.view, function (n) { return n.tagName === 'DETAILS' && hasClass(n, 'wsc'); })[0];
  ok(d2 && d2.open === true, 'a score already entered keeps it open even before kickoff');
}());

setTimeout(function () {
  pending.forEach(function (f) { f(); });
  console.log(fails ? ('\n  ' + fails + ' picks2 check(s) FAILED') : '\n  picks2 checks pass');
  process.exit(fails ? 1 : 0);
}, 700);
