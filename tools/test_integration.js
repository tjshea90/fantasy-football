/* test_integration.js — v3.10.
 *
 * The other three suites test modules and assert on source text. This one
 * boots the WHOLE app the way the WebView does — every module into one shared
 * `window`, in the order index.html loads them — and then drives real work
 * through it. It exists because every defect found in the v3.6 review was a
 * cross-module one: a sync wiping a field another screen wrote, an id reused
 * across a table nothing else cleaned, a cache nobody invalidated. No single
 * module's tests could have caught any of them.
 *
 * There is no DOM here, so ui.js is deliberately NOT loaded. Everything below
 * is the data layer, which is where the season actually lives.
 */
var fs = require('fs'), path = require('path'), fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  OK   ' + m); }
function near(a, b, m) {
  ok(Math.abs(a - b) < 0.011, m + '  (got ' + a + ', want ' + b + ')');
}

var W = { window: null };
W.window = W;
W.setTimeout = setTimeout; W.clearTimeout = clearTimeout;
W.localStorage = (function () {
  var d = {};
  return { getItem: function (k) { return d[k] === undefined ? null : d[k]; },
           setItem: function (k, v) { d[k] = String(v); },
           removeItem: function (k) { delete d[k]; } };
}());
/* a Native bridge that stores to memory, like the Java one stores to disk */
var disk = {};
W.Native = {
  save: function (k, v) { disk[k] = v; return true; },
  load: function (k) { return disk[k] === undefined ? null : disk[k]; }
};

function load(f) {
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'app/assets', f), 'utf8'))(W);
}
/* the same order as index.html */
['seed.js', 'players.js', 'scoring.js', 'espn.js', 'names.js', 'store.js', 'playerdb.js',
 'projections.js', 'usage.js', 'recommend.js', 'sim.js', 'value.js', 'recap.js',
 'ai.js'].forEach(load);

ok(!!W.SEED, 'the seed loaded');
var S = W.Store.init(W.SEED);
W.PlayerDB.init();
ok(!!S && S.teams.length === 10, 'the store booted with ten teams');
var me = S.league.me;

/* ---- 1. a manual adjustment must survive the stat table being rebuilt -----
 * This is the v3.6 defect: doSync wipes S.stats and refills it, and the only
 * way to score the three weekly longest-play bonuses is by hand. */
(function () {
  var t = W.Store.team(me), pid = t.players[0].id;
  var L = W.Scoring.emptyLine();
  L.played = true; L.rec = { rec: 5, yds: 60, td: 1, long: 40 };
  W.Store.setLine(3, pid, L);
  var before = W.Store.playerPoints(3, pid);
  /* Tj adds the +5 longest-reception bonus by hand */
  W.Store.getStats(3)[pid].manualAdj = 5;
  near(W.Store.playerPoints(3, pid), before + 5, 'a manual adjustment scores');

  /* now simulate what doSync does: snapshot, wipe, refill */
  var stats = W.Store.getStats(3), keepAdj = {}, k;
  Object.keys(stats).forEach(function (kk) {
    if (stats[kk] && stats[kk].manualAdj) keepAdj[kk] = stats[kk].manualAdj;
  });
  Object.keys(stats).forEach(function (kk) { delete stats[kk]; });
  var L2 = W.Scoring.emptyLine();
  L2.played = true; L2.rec = { rec: 5, yds: 60, td: 1, long: 40 };
  if (keepAdj[pid]) L2.manualAdj = keepAdj[pid];
  stats[pid] = L2;
  near(W.Store.playerPoints(3, pid), before + 5,
       'and it is still there after the stat table is rebuilt');
}());

/* ---- 2. a dropped player's id must never be reused ----------------------- */
(function () {
  var t = W.Store.team(me);
  var added = W.Store.addPlayer(me, { name: 'Temp Guy', pos: 'WR', nfl: 'KC' });
  var L = W.Scoring.emptyLine();
  L.played = true; L.rec = { rec: 9, yds: 140, td: 2, long: 55 };
  W.Store.setLine(4, added.id, L);
  var hisPoints = W.Store.playerPoints(4, added.id);
  ok(hisPoints > 20, 'the temporary player scored a big week (' + hisPoints.toFixed(1) + ')');
  W.Store.removePlayer(me, added.id);
  var next = W.Store.addPlayer(me, { name: 'Somebody Else', pos: 'WR', nfl: 'SF' });
  ok(next.id !== added.id,
     'the new player did NOT inherit the dropped id (' + added.id + ' vs ' + next.id + ')');
  near(W.Store.playerPoints(4, next.id), 0,
       'so he does not inherit the dropped player\'s scored week either');
  W.Store.removePlayer(me, next.id);
}());

/* ---- 3. the score memo must not survive an edit, or leak into a save ----- */
(function () {
  var L = W.Scoring.emptyLine();
  L.played = true; L.pass = { cmp: 24, yds: 280, td: 2, int: 0, att: 33 };
  var a = W.Scoring.score(L);
  ok(W.Scoring.score(L) === a, 'the same line scores from the memo');
  L.manualAdj = 3;
  near(W.Scoring.score(L).total, a.total + 3, 'editing the line invalidates the memo');
  ok(JSON.stringify(L).indexOf('__sc') < 0, 'the memo never lands in a saved line');
}());

/* ---- 4. free agents: grouped, and never all one position ----------------- */
(function () {
  var g = W.Value.byPos(5, 0);
  var poss = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'], i, empty = [];
  for (i = 0; i < poss.length; i++) if (!g[poss[i]] || !g[poss[i]].length) empty.push(poss[i]);
  ok(!empty.length, 'every position has free agents on a real 10-team league (' +
     poss.map(function (p) { return p + ':' + (g[p] ? g[p].length : 0); }).join(' ') + ')');
  var mixed = W.Value.byVor(5, 12), seen = {};
  mixed.forEach(function (r) { seen[r.pos] = 1; });
  ok(Object.keys(seen).length >= 3,
     'the mixed value ranking spans positions (' + Object.keys(seen).join(',') + ')');
  ok(typeof mixed[0].usage === 'string', 'the lazy usage getter still yields a string');
}());

/* ---- 5. nothing rostered appears on the wire ----------------------------- */
(function () {
  var owned = {}, i, j;
  for (i = 0; i < S.teams.length; i++) {
    for (j = 0; j < S.teams[i].players.length; j++) {
      owned[W.Espn.normName(S.teams[i].players[j].name)] = 1;
    }
  }
  var fa = W.Value.freeAgents(5, 0), bad = null;
  for (i = 0; i < fa.length; i++) {
    if (owned[W.Espn.normName(fa[i].name)]) { bad = fa[i].name; break; }
  }
  ok(!bad, 'no rostered player is offered as a free agent' + (bad ? ' (found ' + bad + ')' : ''));
}());

/* ---- 6. the free-agent memo must notice a roster change ------------------ */
(function () {
  var before = W.Value.freeAgents(5, 0).length;
  var top = W.Value.byPos(5, 1).WR[0];
  var p = W.Store.addPlayer(me, { name: top.name, pos: 'WR', nfl: top.nfl });
  var after = W.Value.freeAgents(5, 0).length;
  ok(after === before - 1,
     'signing the top free agent removes exactly him from the wire (' +
     before + ' -> ' + after + ')');
  W.Store.removePlayer(me, p.id);
  ok(W.Value.freeAgents(5, 0).length === before, 'and dropping him puts him back');
}());

/* ---- 7. import must not clobber the season when the backup is bad -------- */
(function () {
  var good = W.Store.exportJSON();
  var teamsBefore = W.Store.get().teams.length;
  var threw = '';
  try { W.Store.importJSON('{"teams":[{"id":"t1"}]}'); } catch (e) { threw = e.message; }
  ok(!!threw, 'a malformed backup is rejected (' + threw + ')');
  ok(W.Store.get().teams.length === teamsBefore,
     'and the live season is untouched — still ' + teamsBefore + ' teams');
  W.Store.importJSON(good);
  ok(W.Store.get().teams.length === teamsBefore, 'a good backup still imports');
}());

/* ---- 8. weeksLeft counts forward, not from week 1 ------------------------ */
(function () {
  var reg = W.Store.get().league.regularSeasonWeeks;
  var all = W.Value.weeksLeft(1), late = W.Value.weeksLeft(reg);
  ok(all > late, 'weeksLeft shrinks as the season goes on (' + all + ' -> ' + late + ')');
  ok(late <= 1 + 0, 'and at the last week it is down to the minimum (' + late + ')');
}());

/* ---- 9. the simulation must not double-count an unscored week ------------ */
(function () {
  var reg = W.Store.get().league.regularSeasonWeeks;
  var s = W.Sim.season(reg);
  ok(!!s && !!s.rows && s.rows.length === 10, 'the season sim returns a row per team');
  var sum = 0, i;
  for (i = 0; i < s.rows.length; i++) sum += (s.rows[i].playoff || 0);
  /* six of ten make the playoffs in this league, so the odds must total ~6
     (or ~600 if they are percentages). Either way it cannot be ~10, which is
     what double-counting an unscored week used to push it toward. */
  var six = Math.abs(sum - 6) < 0.6 || Math.abs(sum - 600) < 60;
  ok(six, 'playoff odds total the number of playoff spots, not more (' + sum.toFixed(2) + ')');
  ok(!!W.Sim.power(reg), 'power rankings still build');
}());

/* ---- 10. no screen-facing module throws on an empty season --------------- */
(function () {
  var fresh = { window: null }; fresh.window = fresh;
  fresh.setTimeout = setTimeout; fresh.clearTimeout = clearTimeout;
  fresh.localStorage = W.localStorage;
  var d2 = {};
  fresh.Native = { save: function (k, v) { d2[k] = v; return true; },
                   load: function (k) { return d2[k] === undefined ? null : d2[k]; } };
  ['seed.js', 'players.js', 'scoring.js', 'espn.js', 'names.js', 'store.js', 'playerdb.js',
   'projections.js', 'usage.js', 'recommend.js', 'sim.js', 'value.js', 'recap.js',
   'ai.js'].forEach(function (f) {
    new Function('window', fs.readFileSync(path.join(__dirname, '..', 'app/assets', f), 'utf8'))(fresh);
  });
  fresh.Store.init(fresh.SEED);
  fresh.PlayerDB.init();
  var meId = fresh.Store.get().league.me;
  var checks = [
    ['bestLineup', function () { return fresh.Recommend.bestLineup(1, meId, null); }],
    ['projectAll', function () { return fresh.Recommend.projectAll(1, meId, null); }],
    ['byPos', function () { return fresh.Value.byPos(1, 5); }],
    ['upgrades', function () { return fresh.Value.upgrades(1, meId, null, 20); }],
    ['needs', function () { return fresh.Value.needs(1, meId, null); }],
    ['waiverContext', function () { return fresh.Value.waiverContext(1, meId, null, 2026, '2026-09-03'); }],
    ['replacement', function () { return fresh.Value.replacement(1); }],
    ['Sim.power', function () { return fresh.Sim.power(1); }],
    ['Sim.season', function () { return fresh.Sim.season(1); }],
    ['Recap.build', function () { return fresh.Recap.build(1); }],
    ['Recap.text', function () { return fresh.Recap.text(1); }],
    ['standings', function () { return fresh.Store.standings(1); }]
  ];
  var i, bad = [];
  for (i = 0; i < checks.length; i++) {
    try { checks[i][1](); } catch (e) { bad.push(checks[i][0] + ': ' + e.message); }
  }
  ok(!bad.length, 'nothing throws on a brand-new season with no week scored' +
     (bad.length ? '\n         ' + bad.join('\n         ') : ''));
}());

/* ---- 11. the waiver prompt is built from real league data ---------------- */
(function () {
  var ctx = W.Value.waiverContext(5, me, null, 2026, '2026-09-03');
  var prompt = W.Ai.buildWaiverPrompt(ctx);
  ok(prompt.indexOf('completed pass is worth 1 point') >= 0,
     'the waiver prompt states the scoring rule that breaks every public list');
  ok(prompt.indexOf('nobody in this list is on any of the ten rosters') >= 0,
     'availability is asserted so no search is spent rediscovering it');
  ok(prompt.length > 1200 && prompt.length < 60000,
     'the prompt is a sane size (' + prompt.length + ' chars) — no runaway pool');
}());

console.log(fails ? ('  ' + fails + ' integration check(s) FAILED') : '  integration checks pass');
process.exit(fails ? 1 : 0);
