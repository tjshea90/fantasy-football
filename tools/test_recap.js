/* test_recap.js — 2026-09-15i.
 *
 * Tj only ever tracks a real, hand-set lineup for his own team and that
 * week's opponent (see store.js's "manual weekly scores" section). Every
 * other team is scored by a single manual number read off the league
 * site. This suite proves three things end to end, against the real
 * modules (no DOM — same load set as test_integration.js):
 *
 *   1. Store.inferLineup() — working backward from a team's manual score
 *      to which of ITS OWN roster actually summed to it — lands on exactly
 *      one lineup when the math allows it, reports "ambiguous" instead of
 *      guessing when two different combinations tie, and reports "no-match"
 *      / "no-score" rather than fabricating anything when it can't.
 *   2. recap.js only ever attributes a starter/bust/bench-regret line to a
 *      team whose lineup is real (me + this week's opponent) or uniquely
 *      inferred — never to a team whose inference was ambiguous, even one
 *      that would otherwise have run away with "best starter of the week".
 *   3. The three independent bugs fixed alongside this (allPlay/teamProfile/
 *      season reading the lineup-only teamWeekPoints instead of the
 *      manual-aware teamWeekScore, and season()'s .pts/.total typo) are
 *      actually fixed, and Sim.matchup/lineupMeans — dead code whose whole
 *      premise (a real lineup on BOTH sides of a matchup) no longer holds
 *      for 8 of the league's 10 teams — are actually gone.
 */
var fs = require('fs'), path = require('path'), fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  OK   ' + m); }
function near(a, b, m) { ok(Math.abs(a - b) < 0.06, m + '  (got ' + a + ', want ' + b + ')'); }

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
 'projections.js', 'usage.js', 'recommend.js', 'sim.js', 'value.js', 'recap.js',
 'ai.js'].forEach(load);

var S = W.Store.init(W.SEED);
var me = S.league.me;                 /* 'myteam' */
var WK = 9;                           /* a week this suite fully controls */

/* neutralise byes entirely — this suite fabricates exact point values via
   manualAdj (see setPts below) and needs every player to actually count
   this week, not be silently zeroed by the league's real bye schedule */
S.byes = {};
S.teams.forEach(function (t) { t.players.forEach(function (p) { p.bye = 0; }); });

/* every player, on every team, gets an exact, deterministic point value —
 * manualAdj on a played, otherwise-empty line scores as exactly that value
 * (see scoring.js), so the test never depends on any stat-to-points formula.
 * Powers of two are a superincreasing sequence: the sum of ANY subset of a
 * team's own roster identifies that subset uniquely, so a team built this
 * way is GUARANTEED to have a unique inferred lineup, with no dependence on
 * solver internals — only the two teams below that are deliberately broken
 * (a tie, an unreachable target) can come out any other way. */
function setPts(teamId, pid, pts) {
  var L = W.Scoring.emptyLine();
  L.played = true; L.manualAdj = pts;
  W.Store.setLine(WK, pid, L);
}
S.teams.forEach(function (t) {
  t.players.forEach(function (p, i) { setPts(t.id, p.id, Math.pow(2, i)); });
});

S.weekMeta[String(WK)] = { synced: true, allFinal: true };

/* me vs. tim this week; the rest paired off arbitrarily */
W.Store.setMatchups(WK, [
  [me, 'tim'], ['josebrandon', 'mikejamie'], ['tugdude', 'jr'],
  ['dustin', 'mo'], ['steve', 'ron']
]);

function greedyBest(teamId) {
  var t = W.Store.team(teamId), keys = W.Store.slotKeys(), used = {}, slots = {}, total = 0;
  keys.forEach(function (k) {
    var elig = k.pos === 'FLEX' ? S.league.flexEligible : [k.pos];
    var cand = t.players.filter(function (p) { return !used[p.id] && elig.indexOf(p.pos) >= 0; })
      .sort(function (a, b) { return W.Store.playerPoints(WK, b.id) - W.Store.playerPoints(WK, a.id); });
    if (cand.length) {
      used[cand[0].id] = 1; slots[k.key] = cand[0].id;
      total += W.Store.playerPoints(WK, cand[0].id);
    }
  });
  return { slots: slots, total: Math.round(total * 100) / 100 };
}

/* ---- me and this week's opponent: real, hand-set lineups ----------------
 * the only two teams this app ever tracks one for */
var myBest = greedyBest(me), timBest = greedyBest('tim');
Object.keys(myBest.slots).forEach(function (k) { W.Store.setSlot(WK, me, k, myBest.slots[k], true); });
Object.keys(timBest.slots).forEach(function (k) { W.Store.setSlot(WK, 'tim', k, timBest.slots[k], true); });

/* ---- josebrandon: the clean "unique inference" case ----------------------
 * one player is given an outsized, globally-dominant score so this team is
 * also used below to prove the best-starter-of-the-week attribution really
 * comes from an inferred lineup, not just the total */
var jbTeam = W.Store.team('josebrandon');
var jbStar = jbTeam.players[jbTeam.players.length - 1];
setPts('josebrandon', jbStar.id, 999999);
var jbBest = greedyBest('josebrandon');
W.Store.setManualScore(WK, 'josebrandon', jbBest.total);

/* ---- mikejamie: a deliberately AMBIGUOUS case -----------------------------
 * tie its two QBs' points exactly — QB is not flex-eligible, so this is an
 * isolated, guaranteed swap: either QB fills the one QB slot, both totals
 * are identical, and nothing else about the lineup is affected. Also given
 * an even bigger standalone score than josebrandon's, so if the recap ever
 * let an ambiguous team's guess through, THIS is the player it would wrongly
 * crown "best starter of the week". */
var mjTeam = W.Store.team('mikejamie');
var mjQbs = mjTeam.players.filter(function (p) { return p.pos === 'QB'; });
ok(mjQbs.length >= 2, 'sanity: mikejamie has at least two QBs to tie for the ambiguous case');
if (mjQbs.length >= 2) setPts('mikejamie', mjQbs[1].id, W.Store.playerPoints(WK, mjQbs[0].id));
var mjStar = mjTeam.players[mjTeam.players.length - 1];
setPts('mikejamie', mjStar.id, 2000000);
var mjBest = greedyBest('mikejamie');
W.Store.setManualScore(WK, 'mikejamie', mjBest.total);

/* ---- tugdude: a manual score no combination of its roster can reach ------ */
W.Store.setManualScore(WK, 'tugdude', 5000000);

/* ---- jr: no manual score at all — the "nothing to infer from" case ------- */

/* ---- steve: the teamWeekPoints -> teamWeekScore regression probe --------- *
 * a manual score deliberately larger than every other team's — real,
 * inferred, or unreachable — could possibly total, with NO lineup on file.
 * Under the old bug (allPlay/teamProfile/season reading the lineup-only
 * teamWeekPoints) this team would have scored a flat 0 despite the entry;
 * under the fix it reads the manual number like every other display in the
 * app already does. */
W.Store.setManualScore(WK, 'steve', 100000000);

/* dustin, mo, ron: ordinary, fully-determined manual entries so the week is
   completely scored, same as Tj's real weekly routine */
['dustin', 'mo', 'ron'].forEach(function (id) {
  W.Store.setManualScore(WK, id, greedyBest(id).total);
});

/* ============================================================ 1. inferLineup */
(function () {
  var infJ = W.Store.inferLineup(WK, 'josebrandon');
  ok(infJ.ok && infJ.confidence === 'unique',
     'a team whose manual score decomposes only one way is inferred with confidence ' +
     '(got ' + JSON.stringify(infJ) + ')');
  if (infJ.ok && infJ.confidence === 'unique') {
    ok(JSON.stringify(Object.keys(infJ.slots).sort()) === JSON.stringify(Object.keys(jbBest.slots).sort()),
       'the inferred lineup fills the same slots the real optimal one does');
    var jbPlaced = Object.keys(infJ.slots).some(function (k) { return infJ.slots[k] === jbStar.id; });
    ok(jbPlaced, 'the outsized dominant player is correctly placed in the inferred lineup');
  }

  var infM = W.Store.inferLineup(WK, 'mikejamie');
  ok(infM.ok && infM.confidence === 'ambiguous' && infM.sets && infM.sets.length >= 2,
     'a genuinely tied score is reported as ambiguous, not guessed at ' +
     '(got ' + JSON.stringify({ ok: infM.ok, confidence: infM.confidence, n: infM.sets && infM.sets.length }) + ')');

  var infT = W.Store.inferLineup(WK, 'tugdude');
  ok(!infT.ok && infT.reason === 'no-match',
     'a manual score no roster combination can reach is reported as no-match, not guessed at' +
     ' (got ' + JSON.stringify(infT) + ')');

  var infR = W.Store.inferLineup(WK, 'jr');
  ok(!infR.ok && infR.reason === 'no-score',
     'a team with no manual score on file has nothing to infer from' +
     ' (got ' + JSON.stringify(infR) + ')');
}());

/* ============================================================ 2. Recap.build */
(function () {
  var r = W.Recap.build(WK);
  ok(!!r, 'the recap builds for a fully-scored week');

  var jbRow = r.scores.filter(function (x) { return x.id === 'josebrandon'; })[0];
  near(jbRow.pts, jbBest.total, 'the recap score for an untracked team is the MANUAL entry, not a lineup computation');

  var game = r.games.filter(function (g) { return g.a === me || g.b === me; })[0];
  var myPts = game.a === me ? game.pa : game.pb;
  var timPts = game.a === me ? game.pb : game.pa;
  near(myPts, myBest.total, 'my half of my matchup is my real, hand-set lineup total');
  near(timPts, timBest.total, "my opponent's half is their real, hand-set lineup total (both tracked)");

  ok(!!r.topStarter && r.topStarter.pts === 999999 && r.topStarter.team === jbTeam.name,
     'best-starter-of-the-week is attributed to the uniquely-inferred team that actually has him ' +
     '(got ' + JSON.stringify(r.topStarter) + ')');
  ok(!r.topStarter || r.topStarter.pts !== 2000000,
     "the AMBIGUOUS team's even-bigger score never wins best-starter — an uncertain guess is not shown as fact");
}());

/* ============================================================ 3. sim.js fixes */
(function () {
  ok(typeof W.Sim.matchup === 'undefined' && typeof W.Sim.lineupMeans === 'undefined',
     'Sim.matchup/lineupMeans are gone — both were dead code whose premise (a real lineup on ' +
     'both sides) no longer holds for most of the league');

  near(W.Store.teamWeekPoints(WK, 'steve').total, 0,
       "sanity: steve's lineup-only total is 0 — he has no lineup on file, only a manual score");
  near(W.Store.teamWeekScore(WK, 'steve').total, 99999,
       "but the manual-aware total is his real entry");

  var ap = W.Sim.allPlay(WK);
  ok(ap.steve.weeks === 1 && ap.steve.w === 9 && ap.steve.l === 0,
     "allPlay() now reads the manual score, not the lineup-only total — steve sweeps the week " +
     '(got ' + JSON.stringify(ap.steve) + ')');

  var prof = W.Sim.teamProfile(WK);
  ok(prof.teams.steve.mean > 90000,
     "teamProfile() also reads the manual score now, not a phantom 0 (got mean " + prof.teams.steve.mean + ')');

  var s = W.Sim.season(WK);
  ok(s.rows.length === 10 && s.rows.every(function (row) { return isFinite(row.projPts); }),
     "season()'s projected points are never NaN — the .pts/.total field-name typo is fixed " +
     '(got ' + JSON.stringify(s.rows.map(function (r2) { return r2.projPts; })) + ')');
}());

/* ============================================================ 4. Sim.regret override */
(function () {
  var myRg = W.Sim.regret(WK, me);
  near(myRg.actual, myBest.total, "regret() on my own real lineup still works exactly as before (no override passed)");

  var jbInf = W.Store.inferLineup(WK, 'josebrandon');
  var jbRgNoOverride = W.Sim.regret(WK, 'josebrandon');
  near(jbRgNoOverride.actual, 0,
       'without an override, regret() falls back to Store.getLineup — empty for a never-tracked team');

  var jbRgOverride = W.Sim.regret(WK, 'josebrandon', jbInf.slots);
  near(jbRgOverride.actual, jbBest.total,
       "with the inferred lineup passed as an override, regret() scores it correctly");
  ok(jbRgOverride.lost < 0.06,
     "and since the inferred lineup already IS the optimal one, there is ~nothing left on the bench" +
     ' (lost=' + jbRgOverride.lost + ')');
}());

console.log(fails ? ('  ' + fails + ' recap/inference check(s) FAILED') : '  recap/inference checks pass');
process.exit(fails ? 1 : 0);
