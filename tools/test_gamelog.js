/* test_gamelog.js — the per-team-per-week full box-score cache behind the
 * Stats tab. Espn.weekGames/gameStats are mocked with a call counter so the
 * "one fetch caches both teams" and "final games never re-fetch" claims are
 * checked directly, not just their output.
 */
'use strict';
var fs = require('fs'), path = require('path'), fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  OK   ' + m); }
function near(a, b) { return Math.abs(a - b) < 0.011; }

var W = { window: null };
W.window = W;
W.setTimeout = setTimeout; W.clearTimeout = clearTimeout;
W.Promise = Promise;
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
['seed.js', 'players.js', 'scoring.js', 'espn.js', 'names.js', 'store.js',
 'playerdb.js', 'gamelog.js'].forEach(load);
W.Store.init(W.SEED);
W.PlayerDB.init();

/* ---- mock the network the same way every other unit test in this suite
 * does: real Espn.pool/dstLine (pure, no network), fake weekGames/gameStats
 * with a call counter so "does not re-fetch a final game" is provable. */
function line(fill) { var l = W.Scoring.emptyLine(); l.played = true; fill(l); return l; }

var GAMES = {
  1: [{ id: 'g1', date: '2026-09-08T17:00:00Z', week: 1, state: 'post', detail: '',
        teams: [{ abbr: 'KC', score: 24, homeAway: 'home' }, { abbr: 'BUF', score: 20, homeAway: 'away' }] }],
  2: [{ id: 'g2', date: '2026-09-15T17:00:00Z', week: 2, state: 'pre', detail: '',
        teams: [{ abbr: 'KC', score: 0, homeAway: 'away' }, { abbr: 'DEN', score: 0, homeAway: 'home' }] }],
  10: [{ id: 'g10', date: '2026-11-10T17:00:00Z', week: 10, state: 'in', detail: '',
         teams: [{ abbr: 'NE', score: 7, homeAway: 'home' }, { abbr: 'MIA', score: 3, homeAway: 'away' }] }],
  20: [{ id: 'gFail', date: '2026-12-20T17:00:00Z', week: 20, state: 'post', detail: '',
         teams: [{ abbr: 'XX', score: 0, homeAway: 'home' }, { abbr: 'YY', score: 0, homeAway: 'away' }] }]
};
var BOX = {
  g1: {
    players: {
      'patrick mahomes': { name: 'Patrick Mahomes', espnId: '1', abbr: 'KC',
        line: line(function (l) { l.pass = { cmp: 25, yds: 300, td: 3, int: 1, twoPt: 0, long: 40 }; }) },
      'josh allen': { name: 'Josh Allen', espnId: '2', abbr: 'BUF',
        line: line(function (l) { l.pass = { cmp: 22, yds: 280, td: 2, int: 0, twoPt: 0, long: 35 }; }) }
    },
    teamScore: { KC: 24, BUF: 20 },
    teamAgg: {
      KC: { sacks: 3, int: 1, fr: 1, defTD: 0, retTD: 0, safety: 0, pointsAllowed: 20 },
      BUF: { sacks: 2, int: 1, fr: 0, defTD: 0, retTD: 0, safety: 0, pointsAllowed: 24 }
    }
  },
  g10: {
    players: {},
    teamScore: { NE: 7, MIA: 3 },
    teamAgg: { NE: { sacks: 1, int: 0, fr: 0, defTD: 0, retTD: 0, safety: 0, pointsAllowed: 3 },
               MIA: { sacks: 0, int: 0, fr: 0, defTD: 0, retTD: 0, safety: 0, pointsAllowed: 7 } }
  }
};
var gameStatsCalls = 0, weekGamesCalls = 0;
W.Espn.weekGames = function (season, week) { weekGamesCalls++; return Promise.resolve(GAMES[week] || []); };
W.Espn.gameStats = function (eventId) {
  gameStatsCalls++;
  if (eventId === 'gFail') return Promise.reject(new Error('simulated network failure'));
  return Promise.resolve({
    eventId: eventId, players: BOX[eventId].players, teamScore: BOX[eventId].teamScore,
    teamAgg: BOX[eventId].teamAgg
  });
};

/* Mahomes 25c/300y/3TD/1INT = 25 + 15 + 18 - 2 = 56
   Allen    22c/280y/2TD/0INT = 22 + 14 + 12      = 48
   KC dst: sacks 3*2=6, int 1*2=2, fr 1*2=2, PA 20 -> tier 5 = 15
   BUF dst: sacks 2*2=4, int 1*2=2, PA 24 -> tier 1 = 7 */
var MAHOMES_PTS = 56, ALLEN_PTS = 48, KC_DST_PTS = 15, BUF_DST_PTS = 7;

function run() {
  return W.Gamelog.teamWeek('KC', 1).then(function (kc) {
    ok(!!kc, 'teamWeek finds KC week 1');
    ok(kc.opp === 'BUF' && kc.home === true, 'KC entry: opp BUF, home true');
    ok(kc.teamScore === 24 && kc.oppScore === 20, 'KC entry carries both scores');
    ok(near(W.Scoring.score(kc.players['patrick mahomes'].line).total, MAHOMES_PTS),
       'Mahomes line scores ' + MAHOMES_PTS + ' under this league\'s rules');
    ok(near(W.Scoring.score(kc.dst).total, KC_DST_PTS), 'KC dst line scores ' + KC_DST_PTS);
    ok(gameStatsCalls === 1, 'one gameStats call so far (got ' + gameStatsCalls + ')');

    return W.Gamelog.teamWeek('BUF', 1);
  }).then(function (buf) {
    ok(!!buf && buf.opp === 'KC' && buf.home === false, 'BUF side came free from the same fetch');
    ok(gameStatsCalls === 1, 'BOTH TEAMS CACHED FROM ONE FETCH — still 1 gameStats call (got ' + gameStatsCalls + ')');

    return W.Gamelog.teamWeek('KC', 1);
  }).then(function () {
    ok(gameStatsCalls === 1, 'a FINAL week never re-fetches on a plain re-read (still ' + gameStatsCalls + ')');

    return W.Gamelog.teamWeek('KC', 1, { force: true });
  }).then(function () {
    ok(gameStatsCalls === 2, 'force:true DOES re-fetch even when already final (got ' + gameStatsCalls + ')');

    return W.Gamelog.teamWeek('KC', 2);
  }).then(function (pre) {
    ok(pre === null, 'a game that has not kicked off yet resolves to null, not a guess');
    ok(gameStatsCalls === 2, 'no gameStats call was made for a pre-kickoff game (still ' + gameStatsCalls + ')');

    /* ---- playedWeeks: skips the bye, most recent first ------------------ */
    W.Store.get().byes.ZZ = 3;
    var pw = W.Gamelog.playedWeeks('ZZ', 5);
    ok(pw.join(',') === '5,4,2,1', 'playedWeeks(ZZ,5) with a week-3 bye -> [5,4,2,1] (got ' + pw.join(',') + ')');

    /* ---- position resolution, forward from an ESPN box-score name key --- */
    var mEntry = W.Gamelog.resolveEntry('patrick mahomes');
    ok(!!mEntry && mEntry.p === 'QB' && mEntry.t === 'KC', 'resolveEntry finds Mahomes as QB/KC');

    /* ---- teamRoster: sorted by position, includes the DEF line ---------- */
    return W.Gamelog.teamRoster('KC', 1);
  }).then(function (tr) {
    ok(!!tr && tr.rows.length === 1 && tr.rows[0].pos === 'QB', 'teamRoster(KC,1) has one QB row');
    ok(near(tr.rows[0].pts, MAHOMES_PTS), 'teamRoster row carries the right league points');
    ok(!!tr.dst && tr.dst.pos === 'DEF' && near(tr.dst.pts, KC_DST_PTS), 'teamRoster carries the DEF line and its points');

    /* ---- playerLog: full-season log for one player, most recent first --- */
    var mahomes = W.PlayerDB.search('mahomes', 'QB', 1)[0];
    ok(!!mahomes, 'Mahomes is findable through the same PlayerDB search the app uses');
    return W.Gamelog.playerLog(mahomes, 2);
  }).then(function (plog) {
    ok(plog.length === 1 && plog[0].week === 1, 'playerLog(Mahomes, throughWeek 2) has exactly the one played game (week 2 has not kicked off)');
    ok(near(plog[0].pts, MAHOMES_PTS), 'playerLog entry carries the right league points');

    /* ---- weekPositionTops: top 10 per position incl. DEF, descending ---- */
    return W.Gamelog.weekPositionTops(1);
  }).then(function (tops) {
    ok(!!tops.QB && tops.QB.length === 2, 'weekPositionTops(1).QB has both quarterbacks who played');
    ok(tops.QB[0].name === 'Patrick Mahomes' && near(tops.QB[0].pts, MAHOMES_PTS), 'QB #1 is Mahomes at ' + MAHOMES_PTS);
    ok(tops.QB[1].name === 'Josh Allen' && near(tops.QB[1].pts, ALLEN_PTS), 'QB #2 is Allen at ' + ALLEN_PTS + ' (descending order)');
    ok(!!tops.DEF && tops.DEF.length === 2, 'weekPositionTops(1).DEF has both defenses');
    ok(tops.DEF[0].name === 'KC D/ST' && near(tops.DEF[0].pts, KC_DST_PTS), 'DEF #1 is KC at ' + KC_DST_PTS);
    ok(tops.DEF[1].name === 'BUF D/ST' && near(tops.DEF[1].pts, BUF_DST_PTS), 'DEF #2 is BUF at ' + BUF_DST_PTS);

    /* ---- an in-progress game is never treated as cached-forever ---------- */
    return W.Gamelog.teamWeek('NE', 10);
  }).then(function (ne1) {
    ok(!!ne1 && ne1.state === 'in', 'an in-progress week caches with state \'in\', not \'post\'');
    var callsBefore = gameStatsCalls;
    return W.Gamelog.teamWeek('NE', 10).then(function () {
      ok(gameStatsCalls === callsBefore + 1, 'a cached \'in\' entry still re-fetches on the next plain read (live scores move)');
      /* ---- a real network failure must never read as "no games yet" ----- */
      W.Store.get().byes.XX = 0;
      return W.Gamelog.playerLog({ n: 'Nobody Real', p: 'QB', t: 'XX' }, 20);
    });
  }).then(function () {
    ok(false, 'playerLog should have rejected when every week failed to fetch, not resolved quietly');
  }, function (e) {
    ok(/could not reach the network/.test(e.message), 'playerLog surfaces a real fetch failure instead of "no games" (got: ' + e.message + ')');
  }).then(function () {
    return W.Gamelog.weekPositionTops(20);
  }).then(function () {
    ok(false, 'weekPositionTops should have rejected when every game that week failed to fetch, not resolved quietly');
  }, function (e) {
    ok(/could not reach the network/.test(e.message), 'weekPositionTops surfaces a real fetch failure instead of empty buckets (got: ' + e.message + ')');
  }).then(function () {
    console.log(fails === 0 ? ('  OK  gamelog behaves correctly — 0 failures')
                             : ('  ' + fails + ' gamelog assertion(s) FAILED'));
    process.exit(fails ? 1 : 0);
  }).catch(function (e) {
    console.log('  FAIL uncaught: ' + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
}
run();
