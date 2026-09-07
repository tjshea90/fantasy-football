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
  function invalidate() { cvCache = null; projCache = {}; }

  /* ---- one team's starting lineup, as means -------------------------------
   * A player whose game is already in the books is not a random variable any
   * more: he is a number. That is what makes this a LIVE win probability
   * rather than a pre-game one — as the afternoon goes on, the distribution
   * collapses onto the truth. */
  var projCache = {};
  function lineupMeans(week, teamId, opponents) {
    var ck = week + '|' + teamId;
    if (projCache[ck]) return projCache[ck];
    var lineup = root.Store.getLineup(week, teamId) || {};
    var proj = {}, out = { fixed: 0, live: [], done: 0, left: 0, names: [] };
    root.Recommend.projectAll(week, teamId, opponents).forEach(function (x) {
      proj[x.p.id] = x;
    });
    var keys = root.Store.slotKeys(), i;
    for (i = 0; i < keys.length; i++) {
      var pid = lineup[keys[i].key];
      if (!pid) { out.left++; continue; }
      var line = root.Store.lineFor(week, pid);
      var x2 = proj[pid];
      var p = root.Store.playerById(pid);
      if (line && line.played) {
        out.fixed += root.Scoring.score(line).total;
        out.done++;
      } else {
        out.live.push({ pid: pid, pos: (p && p.player) ? p.player.pos : 'WR',
                        name: (p && p.player) ? p.player.name : pid,
                        mean: x2 ? x2.proj : 0 });
        out.left++;
        if (p && p.player) out.names.push(p.player.name);
      }
    }
    projCache[ck] = out;
    return out;
  }

  /* ---- one matchup ------------------------------------------------------ */
  function matchup(week, aId, bId, opponents) {
    var cv = positionCV(week);
    var A = lineupMeans(week, aId, opponents), B = lineupMeans(week, bId, opponents);
    function meanOf(T) {
      var m = T.fixed, i;
      for (i = 0; i < T.live.length; i++) m += T.live[i].mean;
      return m;
    }
    var r = rng(hash(week + aId + bId)), i, j, aw = 0, bw = 0, tie = 0, sumA = 0, sumB = 0;
    var margins = [];
    for (i = 0; i < SIMS; i++) {
      var ta = A.fixed, tb = B.fixed;
      for (j = 0; j < A.live.length; j++) {
        ta += draw(r, A.live[j].mean, (cv[A.live[j].pos] || cv.WR).cv);
      }
      for (j = 0; j < B.live.length; j++) {
        tb += draw(r, B.live[j].mean, (cv[B.live[j].pos] || cv.WR).cv);
      }
      sumA += ta; sumB += tb; margins.push(ta - tb);
      if (ta > tb) aw++; else if (tb > ta) bw++; else tie++;
    }
    margins.sort(function (x, y) { return x - y; });
    return {
      week: week, a: aId, b: bId, sims: SIMS,
      pA: aw / SIMS, pB: bw / SIMS, pTie: tie / SIMS,
      meanA: meanOf(A), meanB: meanOf(B),
      projA: sumA / SIMS, projB: sumB / SIMS,
      doneA: A.done, doneB: B.done, leftA: A.live.length, leftB: B.live.length,
      fixedA: A.fixed, fixedB: B.fixed,
      p10: margins[Math.floor(SIMS * 0.1)], p90: margins[Math.floor(SIMS * 0.9)],
      /* what each side still needs from the players it has left, measured
         against where the other side is projected to finish */
      needA: Math.max(0, (sumB / SIMS) - A.fixed),
      needB: Math.max(0, (sumA / SIMS) - B.fixed),
      liveA: A.live, liveB: B.live
    };
  }

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
        pts.push({ id: t.id, p: root.Store.teamWeekPoints(w, t.id).total });
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
        var p = root.Store.teamWeekPoints(w, t.id).total;
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

  function season(throughWeek) {
    var S = root.Store.get(), reg = S.league.regularSeasonWeeks;
    var prof = teamProfile(throughWeek);
    /* seasonTotals adds every week's points unconditionally — the scored
       check only gates W/L. `future` below then re-simulates exactly those
       unscored weeks, so an in-progress week was counted twice: once for real
       and once as a draw from the distribution. Playoff odds and projected
       points were inflated by about a week's scoring per unscored week. Take
       the wins from seasonTotals and rebuild the points from SCORED weeks
       only, so base and future cannot overlap. */
    var base = root.Store.seasonTotals(Math.min(throughWeek, reg));
    (function () {
      var idsA = S.teams.map(function (t) { return t.id; }), wi, ti;
      var only = {};
      for (ti = 0; ti < idsA.length; ti++) only[idsA[ti]] = 0;
      for (wi = 1; wi <= Math.min(throughWeek, reg); wi++) {
        if (!root.Store.weekIsScored(wi)) continue;
        for (ti = 0; ti < idsA.length; ti++) {
          only[idsA[ti]] += root.Store.teamWeekPoints(wi, idsA[ti]).pts;
        }
      }
      for (ti = 0; ti < idsA.length; ti++) {
        if (base[idsA[ti]]) base[idsA[ti]].pts = only[idsA[ti]];
      }
    }());
    var ids = S.teams.map(function (t) { return t.id; });
    /* which weeks are still to play, and who plays whom in them */
    var future = [], w;
    for (w = 1; w <= reg; w++) {
      if (root.Store.weekIsScored(w)) continue;
      var mus = root.Store.getMatchups(w);
      if (mus.length) future.push({ week: w, mus: mus });
    }
    var acc = {};
    ids.forEach(function (id) {
      acc[id] = { playoff: 0, bye: 0, title: 0, seeds: [], finalW: 0, finalPts: 0 };
      var i; for (i = 0; i <= ids.length; i++) acc[id].seeds.push(0);
    });
    var r = rng(hash('season' + throughWeek + reg)), s, i, j;
    var runs = Math.min(SIMS, 3000);
    for (s = 0; s < runs; s++) {
      var wins = {}, pts = {};
      ids.forEach(function (id) { wins[id] = base[id].w; pts[id] = base[id].pts; });
      for (i = 0; i < future.length; i++) {
        var scored = {};
        ids.forEach(function (id) {
          var pr = prof.teams[id];
          var v = pr.usedMean + normal(r) * pr.usedSd;
          scored[id] = v > 0 ? v : 0;
          pts[id] += scored[id];
        });
        for (j = 0; j < future[i].mus.length; j++) {
          var a = future[i].mus[j][0], b = future[i].mus[j][1];
          if (scored[a] === undefined || scored[b] === undefined) continue;
          if (scored[a] > scored[b]) wins[a]++; else if (scored[b] > scored[a]) wins[b]++;
        }
      }
      var order = ids.slice().sort(function (x, y) {
        if (wins[y] !== wins[x]) return wins[y] - wins[x];
        return pts[y] - pts[x];
      });
      for (i = 0; i < order.length; i++) {
        acc[order[i]].seeds[i + 1]++;
        if (i < PLAYOFF_TEAMS) acc[order[i]].playoff++;
        if (i < BYES) acc[order[i]].bye++;
        acc[order[i]].finalW += wins[order[i]];
        acc[order[i]].finalPts += pts[order[i]];
      }
      /* the bracket: 3v6 and 4v5, then the byes enter, then the final.
         Same team profiles, so a hot team carries its edge into January. */
      var champ = bracket(order.slice(0, PLAYOFF_TEAMS), prof, r);
      if (champ) acc[champ].title++;
    }
    var out = [];
    ids.forEach(function (id) {
      var a = acc[id], seedPct = [], i2;
      for (i2 = 1; i2 <= ids.length; i2++) seedPct.push(a.seeds[i2] / runs);
      out.push({ id: id, name: root.Store.team(id).name,
                 playoff: a.playoff / runs, bye: a.bye / runs, title: a.title / runs,
                 seeds: seedPct, projW: a.finalW / runs, projPts: a.finalPts / runs,
                 mean: prof.teams[id].usedMean, sd: prof.teams[id].usedSd,
                 shrunk: prof.teams[id].shrunk, n: prof.teams[id].n });
    });
    out.sort(function (x, y) { return y.playoff - x.playoff || y.projW - x.projW; });
    return { rows: out, runs: runs, weeksLeft: future.length,
             leagueMean: prof.leagueMean, leagueSd: prof.leagueSd };
  }

  function game(aId, bId, prof, r) {
    var pa = prof.teams[aId], pb = prof.teams[bId];
    var va = pa.usedMean + normal(r) * pa.usedSd;
    var vb = pb.usedMean + normal(r) * pb.usedSd;
    return va >= vb ? aId : bId;
  }
  function bracket(seeds, prof, r) {
    if (seeds.length < 6) return null;
    var w36 = game(seeds[2], seeds[5], prof, r);
    var w45 = game(seeds[3], seeds[4], prof, r);
    var s1 = game(seeds[0], w45, prof, r);
    var s2 = game(seeds[1], w36, prof, r);
    return game(s1, s2, prof, r);
  }

  /* ---- bench regret ------------------------------------------------------
   * Optimal is exact, not greedy: fill the tight slots with the best of each
   * position, then the FLEX from whoever is left. With one FLEX that IS the
   * optimum, and it matters that it is — a "you left 30 points on the bench"
   * number that is wrong is worse than not showing one. */
  function regret(week, teamId) {
    if (!root.Store.weekIsScored(week)) return null;
    var lineup = root.Store.getLineup(week, teamId) || {};
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

  root.Sim = { matchup: matchup, season: season, power: power, allPlay: allPlay,
               regret: regret, positionCV: positionCV, teamProfile: teamProfile,
               invalidate: invalidate, lineupMeans: lineupMeans,
               SIMS: SIMS, PLAYOFF_TEAMS: PLAYOFF_TEAMS, _rng: rng, _draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Sim;
})(typeof window !== 'undefined' ? window : this);
