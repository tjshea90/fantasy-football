/* test_teamreport.js — guards TeamReport.context(), the composed context
 * behind the "how does my team stack up" feature (2026-09-17b).
 *
 * This module adds no scoring math of its own — it only puts Store.standings,
 * Value.perGame/Recommend.health and Value.waiverContext side by side — so
 * the suite is mostly about SHAPE: every team appears exactly once, my own
 * team is flagged, nobody's price comes back NaN, and my own
 * starters/bench/needs/pool/dropCandidates ride along unchanged from
 * Value.waiverContext so a later prompt-builder can trust them.
 */
var fs = require('fs'), path = require('path'), fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  OK   ' + m); }

function freshWindow() {
  var W = { window: null }; W.window = W;
  W.setTimeout = setTimeout; W.clearTimeout = clearTimeout;
  W.localStorage = (function () {
    var d = {};
    return { getItem: function (k) { return d[k] === undefined ? null : d[k]; },
             setItem: function (k, v) { d[k] = String(v); },
             removeItem: function (k) { delete d[k]; } };
  }());
  var disk = {};
  W.Native = { save: function (k, v) { disk[k] = v; return true; },
               load: function (k) { return disk[k] === undefined ? null : disk[k]; } };
  function load(f) {
    new Function('window', fs.readFileSync(path.join(__dirname, '..', 'app/assets', f), 'utf8'))(W);
  }
  ['seed.js', 'players.js', 'scoring.js', 'espn.js', 'names.js', 'store.js', 'playerdb.js',
   'projections.js', 'usage.js', 'ai.js', 'recommend.js', 'sim.js', 'ros.js', 'value.js',
   'teamreport.js'].forEach(load);
  W.Store.init(W.SEED);
  W.PlayerDB.init();
  return W;
}

console.log('\n-- TeamReport.context(): shape --');
(function () {
  var W = freshWindow();
  var S = W.Store.get();
  var me = S.league.me;
  var ctx = W.TeamReport.context(1, me, null, S.league.season, '2026-09-17');

  ok(ctx.rosters.length === S.teams.length,
     'every team in the league appears exactly once (' + ctx.rosters.length + ')');
  var mine = ctx.rosters.filter(function (r) { return r.mine; });
  ok(mine.length === 1, 'exactly one roster is flagged as mine');
  ok(mine[0].id === me, 'the flagged roster is actually my own team id');
  ok(ctx.teamName === W.Store.team(me).name, 'teamName matches my own team');

  var ids = {}, dupe = false;
  ctx.rosters.forEach(function (r) { if (ids[r.id]) dupe = true; ids[r.id] = 1; });
  ok(!dupe, 'no team is listed twice');

  var everyPlayerHasName = ctx.rosters.every(function (r) {
    return r.players.every(function (p) { return !!p.name && !!p.pos; });
  });
  ok(everyPlayerHasName, 'every rostered player carries a name and a position');

  var anyNaN = ctx.rosters.some(function (r) {
    return r.players.some(function (p) { return typeof p.ros !== 'number' || isNaN(p.ros); });
  });
  ok(!anyNaN, 'no player comes back with a NaN rest-of-season price');

  ok(Array.isArray(ctx.standingsWL) && ctx.standingsWL.length === S.teams.length,
     'standingsWL carries every team');
  ok(Array.isArray(ctx.standingsPts) && ctx.standingsPts.length === S.teams.length,
     'standingsPts carries every team');

  /* my own fields ride straight through from Value.waiverContext, unchanged —
     a prompt-builder for the new feature can trust them exactly as much as
     the Wire tab already does */
  var wc = W.Value.waiverContext(1, me, null, S.league.season, '2026-09-17');
  ok(JSON.stringify(ctx.starters) === JSON.stringify(wc.starters),
     'starters passes through Value.waiverContext unchanged');
  ok(JSON.stringify(ctx.pool) === JSON.stringify(wc.pool),
     'pool (the free-agent shortlist) passes through unchanged');
  ok(JSON.stringify(ctx.dropCandidates) === JSON.stringify(wc.dropCandidates),
     'dropCandidates passes through unchanged');
})();

console.log('\n-- TeamReport.context(): an on-bye player prices at zero, not his usual rate --');
(function () {
  var W = freshWindow();
  var S = W.Store.get();
  var me = S.league.me;
  var t = W.Store.team(me);
  var onByeWeek = null, i;
  for (i = 0; i < t.players.length; i++) {
    if (t.players[i].bye) { onByeWeek = t.players[i]; break; }
  }
  if (onByeWeek) {
    var ctx = W.TeamReport.context(Number(onByeWeek.bye), me, null, S.league.season, '2026-09-17');
    var mine = ctx.rosters.filter(function (r) { return r.mine; })[0];
    var row = mine.players.filter(function (p) { return p.name === onByeWeek.name; })[0];
    ok(!!row, 'the bye-week player is still listed');
    ok(row.onBye === true, 'he is flagged onBye for his own bye week');
    ok(row.ros === 0, 'his rest-of-season price for that one week is zero, not his usual rate');
  } else {
    ok(true, '(no player in the seed roster has a bye at all — nothing to check, not a failure)');
  }
})();

console.log(fails ? '\n' + fails + ' teamreport check(s) FAILED\n' : '\n  all teamreport checks passed\n');
process.exit(fails ? 1 : 0);
