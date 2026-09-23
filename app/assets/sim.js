/* sim.js — everything the app can answer without the network. ES2018 only.
 *
 * WHAT THIS IS FOR
 * The rest of the app answers "how many points is he worth". This file answers
 * the questions that actually get asked out loud: am I going to win, am I
 * making the playoffs, is my record lying about how good I am, and how many
 * points did I leave on the bench.
 *
 * EVERY NUMBER IN HERE IS IN THIS LEAGUE'S POINTS. Nothing is imported from a
 * standard-scoring source: means come from recommend.js (which has already
 * re-scored every projection under RULES_2026) and from scored weeks in this
 * app. A completion is a point here, which is most of a QB's score, and that
 * is exactly why a QB's week-to-week spread is narrower here than the numbers
 * quoted anywhere else. Which is why the spread is MEASURED where possible.
 *
 * NOTHING HERE TOUCHES THE NETWORK. It is arithmetic on data already on the
 * phone, so it costs nothing to run and works on aeroplane mode.
 */
(function (root) {
  'use strict';

  var SIMS = 4000;              /* enough for ±1% on a probability, cheap on a Moto G */
  var PLAYOFF_TEAMS = 6, BYES = 2;

  /* ---- a deterministic PRNG ---------------------------------------------
   * Seeded on purpose. A win probability that flickers 71 / 73 / 72 every time
   * the screen repaints reads as noise and teaches you to distrust it; the
   * same inputs must give the same answer until something real changes. */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) {
    var h = 2166136261, i;
    for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  /* Box-Muller, one value per call; the spare is not worth the state */
  function normal(r) {
    var u = 1 - r(), v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /* Mean-preserving lognormal. Fantasy weeks are right-skewed — the floor is
     zero and the ceiling is not — so a normal draw would put real weight on
     negative scores and understate the ceiling that actually wins weeks. */
  /* sigma is a pure function of cv and there are only six distinct cv values
     in the whole simulation, but this recomputed sqrt(log(1+cv*cv)) on EVERY
     draw: 4,000 sims x ~20 starters = 80,000 times per matchup, and the League
     tab runs about five matchups. Cached by value. */
  var _sig = {};
  function sigmaFor(cv) {
    var k = String(cv);
    if (_sig[k] === undefined) _sig[k] = Math.sqrt(Math.log(1 + cv * cv));
    return _sig[k];
  }
  function draw(r, mean, cv) {
    if (!(mean > 0)) return 0;
    var sigma = sigmaFor(cv);
    return mean * Math.exp(sigma * normal(r) - sigma * sigma / 2);
  }

  /* ---- how much a position bounces around --------------------------------
   * Defaults are deliberately conservative and are REPLACED by this league's
   * own measured spread as soon as there is enough of it. QB starts low
   * because a completion is a point: a QB's floor here is his attempts, and
   * attempts are the most stable thing in football. */
  var CV_DEFAULT = { QB: 0.26, RB: 0.55, WR: 0.62, TE: 0.65, K: 0.42, DEF: 0.70 };
  var cvCache = null;
  function positionCV(throughWeek) {
    if (cvCache && cvCache.through === throughWeek) return cvCache.map;
    var acc = {}, w;
    root.Store.allPlayers().forEach(function (x) {
      var p = x.player, vals = [];
      for (w = 1; w <= throughWeek; w++) {
        if (!root.Store.weekIsScored(w)) continue;
        var l = root.Store.lineFor(w, p.id);
        if (l && l.played) vals.push(root.Scoring.score(l).total);
      }
      if (vals.length < 3) return;
      var m = 0, i;
      for (i = 0; i < vals.length; i++) m += vals[i];
      m /= vals.length;
      if (m <= 1) return;
      var sd = 0;
      for (i = 0; i < vals.length; i++) sd += (vals[i] - m) * (vals[i] - m);
      sd = Math.sqrt(sd / (vals.length - 1));
      if (!acc[p.pos]) acc[p.pos] = { sum: 0, n: 0 };
      acc[p.pos].sum += sd / m; acc[p.pos].n++;
    });
    var map = {}, k;
    for (k in CV_DEFAULT) {
      if (!Object.prototype.hasOwnProperty.call(CV_DEFAULT, k)) continue;
      /* eight player-seasons is the point at which the measured spread is
         better than the prior; below that the prior wins outright */
      if (acc[k] && acc[k].n >= 8) {
        map[k] = { cv: acc[k].sum / acc[k].n, measured: true, n: acc[k].n };
      } else {
        map[k] = { cv: CV_DEFAULT[k], measured: false, n: acc[k] ? acc[k].n : 0 };
      }
    }
    cvCache = { through: throughWeek, map: map };
    return map;
  }
  function invalidate() { cvCache = null; }

  /* lineupMeans()/matchup() — a live win-probability simulator between any
   * two teams' lineups — were removed 2026-09-15i. They had zero callers
   * anywhere in the app or the test suite (confirmed by grep before
   * deletion), and their premise — a real, slot-by-slot lineup for BOTH
   * sides — no longer holds for 8 of the league's 10 teams: Tj now tracks
   * a real lineup only for his own team and that week's opponent. Bringing
   * this back later would mean rebuilding it for that pair specifically. */

  /* ---- all-play: the record you would have if you played everyone ---------
   * The single most honest number in a fantasy league. Your record depends on
   * which of nine teams you happened to draw each week; this does not. */
  function allPlay(throughWeek) {
    var S = root.Store.get(), out = {}, w, i, j;
    S.teams.forEach(function (t) { out[t.id] = { w: 0, l: 0, t: 0, weeks: 0 }; });
    for (w = 1; w <= throughWeek; w++) {
      if (!root.Store.weekIsScored(w)) continue;
      var pts = [];
      S.teams.forEach(function (t) {
        pts.push({ id: t.id, p: root.Store.teamWeekScore(w, t.id).total });
      });
      for (i = 0; i < pts.length; i++) {
        if (pts[i].p <= 0) continue;          /* an empty roster is not a loss */
        out[pts[i].id].weeks++;
        for (j = 0; j < pts.length; j++) {
          if (i === j) continue;
          if (pts[i].p > pts[j].p) out[pts[i].id].w++;
          else if (pts[i].p < pts[j].p) out[pts[i].id].l++;
          else out[pts[i].id].t++;
        }
      }
    }
    return out;
  }

  /* ---- power rankings + the luck index ----------------------------------
   * expected wins = your all-play win rate x games played. A team 3-4 with the
   * second-most points has been unlucky in a way the table cannot show, and
   * that is usually the difference between panic-trading and standing pat. */
  function power(throughWeek) {
    var S = root.Store.get(), st = root.Store.standings(throughWeek);
    var ap = allPlay(throughWeek), rows = [];
    st.byRecord.forEach(function (r) {
      var a = ap[r.id], games = a.w + a.l + a.t;
      var rate = games ? (a.w + a.t / 2) / games : 0;
      var played = a.weeks;
      var expW = rate * played;
      var ppg = played ? r.pts / played : 0;
      rows.push({ id: r.id, name: r.name, w: r.w, l: r.l, t: r.t, pts: r.pts,
                  ppg: ppg, allPlayW: a.w, allPlayL: a.l, allPlayRate: rate,
                  expW: expW, luck: r.w - expW, played: played,
                  /* the ranking itself: how good, not how lucky */
                  score: rate * 100 + ppg / 10 });
    });
    rows.sort(function (x, y) { return y.score - x.score; });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    return rows;
  }

  /* ---- the rest of the season -------------------------------------------
   * Team level, not player level: ten teams x eight weeks x 4000 runs of a
   * ten-man lineup would be forty million draws and a frozen phone. A team's
   * week is drawn from its own measured mean and spread, which is the right
   * granularity for a question about November. */
  function teamProfile(throughWeek) {
    var S = root.Store.get(), out = {}, lgMean = 0, lgN = 0, lgSd = 0;
    S.teams.forEach(function (t) {
      var vals = [], w;
      for (w = 1; w <= throughWeek; w++) {
        if (!root.Store.weekIsScored(w)) continue;
        var p = root.Store.teamWeekScore(w, t.id).total;
        if (p > 0) vals.push(p);
      }
      var m = 0, i;
      for (i = 0; i < vals.length; i++) m += vals[i];
      m = vals.length ? m / vals.length : 0;
      var sd = 0;
      for (i = 0; i < vals.length; i++) sd += (vals[i] - m) * (vals[i] - m);
      sd = vals.length > 1 ? Math.sqrt(sd / (vals.length - 1)) : 0;
      out[t.id] = { mean: m, sd: sd, n: vals.length };
      if (vals.length) { lgMean += m; lgN++; lgSd += sd; }
    });
    lgMean = lgN ? lgMean / lgN : 110; lgSd = lgN ? lgSd / lgN : 25;
    /* Before there are three weeks in the book, a team's own average is noise.
       Shrink it towards the league until it has earned its own number. */
    S.teams.forEach(function (t) {
      var o = out[t.id], k = Math.min(1, o.n / 4);
      o.usedMean = k * o.mean + (1 - k) * lgMean;
      o.usedSd = (o.n > 2 ? o.sd : 0) || lgSd;
      if (o.usedSd < 8) o.usedSd = lgSd;
      o.shrunk = k < 1;
    });
    return { teams: out, leagueMean: lgMean, leagueSd: lgSd };
  }

  /* ---- HOW SURE CAN WE BE ABOUT A TEAM'S STRENGTH? (2026-09-23b) ---------
   * The first version of season() treated a team's measured average as its
   * true strength and only simulated week-to-week noise around it. After two
   * weeks that said one team had a 100% playoff chance and a 53% title
   * chance — two good weeks are not proof of anything, and no serious model
   * (ESPN's, Sleeper's) would say it. It was never shown until Tj asked for
   * playoff odds, and it is not shown now until it is honest.
   *
   * Now: standard empirical-Bayes shrinkage. Each team's TRUE weekly mean is
   * uncertain, centred between its own average and the league's, and the
   * fewer weeks it has played the wider that uncertainty and the harder it is
   * pulled toward the league. Every simulated season first draws each team's
   * true mean from that posterior, THEN draws its weeks around it — so early
   * in the year the odds stay appropriately humble and they sharpen as real
   * weeks come in. All numbers are measured from this league's own scored
   * weeks, in this league's points:
   *   sigma  weekly noise: the pooled within-team spread of scored weeks
   *   tau    spread of TRUE team strength: between-team spread of averages
   *          minus the part of it that is just sigma^2/n noise, floored so an
   *          early-season fluke can never make every team look identical */
  function posterior(throughWeek) {
    var S = root.Store.get(), rows = [], i;
    S.teams.forEach(function (t) {
      var vals = [], w;
      for (w = 1; w <= throughWeek; w++) {
        if (!root.Store.weekIsScored(w)) continue;
        var p = root.Store.teamWeekScore(w, t.id).total;
        if (p > 0) vals.push(p);
      }
      var m = 0, ss = 0;
      for (i = 0; i < vals.length; i++) m += vals[i];
      m = vals.length ? m / vals.length : 0;
      for (i = 0; i < vals.length; i++) ss += (vals[i] - m) * (vals[i] - m);
      rows.push({ id: t.id, n: vals.length, mean: m, ss: ss });
    });
    var withData = rows.filter(function (r) { return r.n > 0; });
    var lg = 0;
    withData.forEach(function (r) { lg += r.mean; });
    lg = withData.length ? lg / withData.length : 0;
    /* Early on the pooled spread rests on a handful of team-weeks (ten, after
       two weeks) and routinely comes out too small — it read 10% of the mean
       on real week-1/2 data, where fantasy team weeks typically swing 15-20%.
       So it is blended with that typical figure (18% of the league mean),
       worth SIGMA_PRIOR_WEEKS team-weeks, and the measured value takes over
       as the season fills in: by week 10 it is ~90% of the answer. */
    var num = 0, den = 0, SIGMA_PRIOR_WEEKS = 12, sigma0 = 0.18 * lg;
    rows.forEach(function (r) { if (r.n > 1) { num += r.ss; den += r.n - 1; } });
    var sigma = Math.sqrt((num + SIGMA_PRIOR_WEEKS * sigma0 * sigma0) / (den + SIGMA_PRIOR_WEEKS));
    if (sigma < 0.08 * lg) sigma = 0.08 * lg;
    var vb = 0, invN = 0;
    withData.forEach(function (r) { vb += (r.mean - lg) * (r.mean - lg); invN += 1 / r.n; });
    vb = withData.length > 1 ? vb / (withData.length - 1) : 0;
    invN = withData.length ? invN / withData.length : 1;
    var tau2 = vb - sigma * sigma * invN, floor = 0.05 * lg;
    if (tau2 < floor * floor) tau2 = floor * floor;
    var out = {};
    rows.forEach(function (r) {
      var prec = 1 / tau2 + (r.n ? r.n / (sigma * sigma) : 0);
      var pm = (lg / tau2 + (r.n ? r.n * r.mean / (sigma * sigma) : 0)) / prec;
      out[r.id] = { n: r.n, mean: r.mean, postMean: pm, postSd: Math.sqrt(1 / prec) };
    });
    return { teams: out, sigma: sigma, tau: Math.sqrt(tau2), leagueMean: lg,
             scored: withData.length > 0 };
  }

  /* Two standard normals per pair of uniforms (Box-Muller, spare kept).
     The first version called log/sqrt/cos for every single draw and threw the
     second value away; this is half the work for the same distribution. */
  function gaussian(r) {
    var spare = null;
    return function () {
      if (spare !== null) { var z = spare; spare = null; return z; }
      var u = 1 - r(), v = r(), m = Math.sqrt(-2 * Math.log(u));
      spare = m * Math.sin(2 * Math.PI * v);
      return m * Math.cos(2 * Math.PI * v);
    };
  }

  /* THE REST OF THE SEASON, SIMULATED. Same outputs as before (playoff, bye
     and title odds, seed spread, projected wins and points); the loop is flat
     typed arrays instead of a closure and a fresh object per team per week,
     because a Data-tab render on a Moto G should not wait on 360,000 of them. */
  function season(throughWeek) {
    var S = root.Store.get(), reg = S.league.regularSeasonWeeks;
    var post = posterior(throughWeek);
    /* seasonTotals adds every week's points unconditionally — the scored
       check only gates W/L. `future` below then re-simulates exactly those
       unscored weeks, so an in-progress week was counted twice: once for real
       and once as a draw from the distribution. Take the wins from
       seasonTotals and rebuild the points from SCORED weeks only, so base and
       future cannot overlap. */
    var base = root.Store.seasonTotals(Math.min(throughWeek, reg));
    var ids = S.teams.map(function (t) { return t.id; }), T = ids.length, idx = {}, i, j, w;
    for (i = 0; i < T; i++) idx[ids[i]] = i;
    var baseW = new Float64Array(T), basePts = new Float64Array(T);
    for (i = 0; i < T; i++) baseW[i] = base[ids[i]] ? base[ids[i]].w : 0;
    for (w = 1; w <= Math.min(throughWeek, reg); w++) {
      if (!root.Store.weekIsScored(w)) continue;
      for (i = 0; i < T; i++) basePts[i] += root.Store.teamWeekScore(w, ids[i]).total;
    }
    /* which weeks are still to play, and who plays whom in them */
    var pairsA = [], pairsB = [];
    for (w = 1; w <= reg; w++) {
      if (root.Store.weekIsScored(w)) continue;
      var mus = root.Store.getMatchups(w);
      if (!mus.length) continue;
      var a = [], b = [];
      for (j = 0; j < mus.length; j++) {
        if (idx[mus[j][0]] === undefined || idx[mus[j][1]] === undefined) continue;
        a.push(idx[mus[j][0]]); b.push(idx[mus[j][1]]);
      }
      pairsA.push(a); pairsB.push(b);
    }
    var F = pairsA.length;
    var pm = new Float64Array(T), psd = new Float64Array(T);
    for (i = 0; i < T; i++) { pm[i] = post.teams[ids[i]].postMean; psd[i] = post.teams[ids[i]].postSd; }
    var sigma = post.sigma;

    var playoff = new Float64Array(T), bye = new Float64Array(T), title = new Float64Array(T);
    var finalW = new Float64Array(T), finalPts = new Float64Array(T);
    var seeds = []; for (i = 0; i < T; i++) seeds.push(new Float64Array(T + 1));
    var tm = new Float64Array(T), wins = new Float64Array(T), pts = new Float64Array(T);
    var sc = new Float64Array(T), order = [];
    var r = rng(hash('season' + throughWeek + reg)), g = gaussian(r), s, f, k;
    var runs = Math.min(SIMS, 3000);
    for (s = 0; s < runs; s++) {
      for (i = 0; i < T; i++) {
        tm[i] = pm[i] + g() * psd[i];
        wins[i] = baseW[i]; pts[i] = basePts[i];
      }
      for (f = 0; f < F; f++) {
        for (i = 0; i < T; i++) {
          var v = tm[i] + g() * sigma;
          if (v < 0) v = 0;
          sc[i] = v; pts[i] += v;
        }
        var A = pairsA[f], B = pairsB[f];
        for (j = 0; j < A.length; j++) {
          if (sc[A[j]] > sc[B[j]]) wins[A[j]]++;
          else if (sc[B[j]] > sc[A[j]]) wins[B[j]]++;
        }
      }
      /* wins, then points — the league's own tiebreak (a points title pays) */
      order.length = 0;
      for (i = 0; i < T; i++) {
        k = order.length;
        while (k > 0 && (wins[order[k - 1]] < wins[i] ||
               (wins[order[k - 1]] === wins[i] && pts[order[k - 1]] < pts[i]))) {
          order[k] = order[k - 1]; k--;
        }
        order[k] = i;
      }
      for (i = 0; i < T; i++) {
        var o = order[i];
        seeds[o][i + 1]++;
        if (i < PLAYOFF_TEAMS) playoff[o]++;
        if (i < BYES) bye[o]++;
        finalW[o] += wins[o]; finalPts[o] += pts[o];
      }
      /* the bracket: 3v6 and 4v5, then the byes enter, then the final —
         each game drawn around THIS run's true strengths */
      if (T >= PLAYOFF_TEAMS) {
        var w36 = duel(order[2], order[5]), w45 = duel(order[3], order[4]);
        title[duel(duel(order[0], w45), duel(order[1], w36))]++;
      }
    }
    function duel(x, y) {
      return (tm[x] + g() * sigma) >= (tm[y] + g() * sigma) ? x : y;
    }
    var out = [];
    for (i = 0; i < T; i++) {
      var seedPct = [], i2;
      for (i2 = 1; i2 <= T; i2++) seedPct.push(seeds[i][i2] / runs);
      var pt = post.teams[ids[i]];
      out.push({ id: ids[i], name: root.Store.team(ids[i]).name,
                 playoff: playoff[i] / runs, bye: bye[i] / runs, title: title[i] / runs,
                 seeds: seedPct, projW: finalW[i] / runs, projPts: finalPts[i] / runs,
                 mean: pt.postMean, sd: sigma, uncertainty: pt.postSd,
                 shrunk: pt.n < 4, n: pt.n });
    }
    out.sort(function (x, y) { return y.playoff - x.playoff || y.projW - x.projW; });
    return { rows: out, runs: runs, weeksLeft: F, scored: post.scored,
             leagueMean: post.leagueMean, leagueSd: sigma, tau: post.tau };
  }

  /* ---- bench regret ------------------------------------------------------
   * Optimal is exact, not greedy: fill the tight slots with the best of each
   * position, then the FLEX from whoever is left. With one FLEX that IS the
   * optimum, and it matters that it is — a "you left 30 points on the bench"
   * number that is wrong is worse than not showing one. */
  /* `lineupOverride` lets a caller supply a lineup that isn't the one on
     file — used by recap.js for teams whose lineup is never hand-tracked,
     passing an inferred one (Store.inferLineup) instead of Store.getLineup. */
  function regret(week, teamId, lineupOverride) {
    if (!root.Store.weekIsScored(week)) return null;
    var lineup = lineupOverride || root.Store.getLineup(week, teamId) || {};
    var keys = root.Store.slotKeys(), started = {}, actual = 0, i;
    for (i = 0; i < keys.length; i++) {
      var pid = lineup[keys[i].key];
      if (!pid) continue;
      started[pid] = keys[i].key;
      actual += root.Store.playerPoints(week, pid);
    }
    var pool = [];
    var t = root.Store.team(teamId);
    if (!t) return null;
    t.players.forEach(function (p) {
      pool.push({ id: p.id, name: p.name, pos: p.pos,
                  pts: root.Store.playerPoints(week, p.id) });
    });
    var used = {}, picks = [], optimal = 0;
    var order = keys.slice().sort(function (a, b) {
      return (a.pos === 'FLEX' ? 1 : 0) - (b.pos === 'FLEX' ? 1 : 0);
    });
    var flexOK = root.Store.get().league.flexEligible || ['RB', 'WR', 'TE'];
    order.forEach(function (k) {
      var cand = pool.filter(function (p) {
        if (used[p.id]) return false;
        return k.pos === 'FLEX' ? flexOK.indexOf(p.pos) >= 0 : p.pos === k.pos;
      }).sort(function (a, b) { return b.pts - a.pts; });
      if (!cand.length) return;
      used[cand[0].id] = 1; optimal += cand[0].pts;
      picks.push({ slot: k.key, id: cand[0].id, name: cand[0].name, pts: cand[0].pts,
                   started: !!started[cand[0].id] });
    });
    var misses = picks.filter(function (p) { return !p.started; });
    return { week: week, teamId: teamId, actual: Math.round(actual * 10) / 10,
             optimal: Math.round(optimal * 10) / 10,
             lost: Math.round((optimal - actual) * 10) / 10,
             picks: picks, misses: misses };
  }

  root.Sim = { season: season, power: power, allPlay: allPlay,
               regret: regret, positionCV: positionCV, teamProfile: teamProfile,
               posterior: posterior,
               invalidate: invalidate,
               SIMS: SIMS, PLAYOFF_TEAMS: PLAYOFF_TEAMS, _rng: rng, _draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Sim;
})(typeof window !== 'undefined' ? window : this);
