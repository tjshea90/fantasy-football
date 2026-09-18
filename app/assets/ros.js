/* ros.js — REST-OF-SEASON value, in this league's points. ES2018 only.
 *
 * WHY THIS FILE EXISTS (Tj, 2026-09-18, with a screenshot of the Wire tab)
 * "the wire tab is only making recommendations and projecting scores based on
 * prior weeks actual stats. This is a broken system... it must rank available
 * players based on expected full season performance, not just the next NFL
 * week, and calculated for this league scoring system."
 *
 * He was reading the symptom exactly right. The old ranker (value.js's
 * perGame) had a five-branch preference list whose second branch was ESPN's
 * full-season projection — and that branch was DEAD CODE. Confirmed against
 * the live endpoint on 2026-09-18: the request shape that wins nearly every
 * sync pins filterStatsForScoringPeriodIds to the week, and ESPN then returns
 * only weekly split rows, never a season split. So `rec.season` was never
 * populated, and in week 2 every free agent fell through to branch 3 — his
 * ONE week-1 actual, used raw as a rest-of-season rate. Kalif Raymond scored
 * 16.4 once and the board said 16.4 forever. One game is not a season.
 *
 * WHAT REPLACES IT — the method, and where it comes from.
 * Public rest-of-season models agree on a shape, and this implements it:
 *
 *   1. START FROM A SEASON-LONG BASELINE, not from one game. projections.js
 *      now fetches ESPN's and Sleeper's FULL-SEASON projected stat lines and
 *      re-scores both under this league's rules (a completion pays a point
 *      here and nothing anywhere else, so their own point totals are useless
 *      and only the stat line is imported). Two independent professional
 *      projections, averaged — which is what Tj asked for in so many words:
 *      "projected stat lines ... from multiple reputable sources online
 *      averaged and then recalculated based on this league scoring system."
 *
 *   2. WEIGHT THIS SEASON'S OBSERVED GAMES IN AS THE SAMPLE GROWS, rather
 *      than all-or-nothing. The tension is well documented: multi-year and
 *      season-long baselines are stable but lag a real role change, while a
 *      single season's — let alone a single week's — data responds fast and
 *      amplifies noise. Every serious model resolves it by shifting weight
 *      toward observed play as games accumulate, so that by the back half of
 *      the season the player's own season outweighs the preseason view of
 *      him. Here that is one line of shrinkage: w = n / (n + PRIOR_GAMES).
 *      With PRIOR_GAMES = 4, one game carries 20% and the baseline 80% — the
 *      screenshot's exact failure, priced honestly — while eleven games
 *      carry 73%, which is the "by week 12 the data outweighs the baseline"
 *      behaviour those models describe.
 *
 *   3. REGRESS EFFICIENCY, KEEP VOLUME. Opportunity is the stable part of a
 *      small sample and results are the unstable part: usage says how big a
 *      player's chance is, and almost nothing about what he did with it,
 *      which is exactly what makes it the better predictor in September. So
 *      the observed side is half what he actually scored and half what his
 *      carries and targets alone would have been worth — a touchdown-luck
 *      week gets pulled toward its own volume instead of being projected
 *      forward at face value. The per-opportunity rates are not constants
 *      copied off a website: they are measured from THIS league's own book,
 *      in THIS league's points, so they are correct here by construction.
 *
 *   4. MULTIPLY BY GAMES ACTUALLY REMAINING — weeks left in the regular
 *      season, minus his bye if it has not happened yet. That product, not a
 *      per-game rate, is the number the board ranks on, because "expected
 *      full season performance" is what Tj asked to rank by and a player with
 *      a bye still ahead really does have one fewer game to give.
 *
 * NO PRESEASON DATA (Tj, 2026-09-14: "remove all preseason consideration from
 * any recommendations or advice from the entire app"). The baselines here are
 * refetched from live feeds that recompute them through the season as depth
 * charts and injuries move — not the seed-time draft projection, which stays
 * deleted. See projections.js's FULL-SEASON PROJECTIONS block.
 *
 * NO NETWORK in this file. It reads caches the sync already filled.
 */
(function (root) {
  'use strict';

  /* How many games of baseline the observed sample has to out-weigh. See
     point 2 in the header — this is the whole shrinkage knob. */
  var PRIOR_GAMES = 4;
  /* How much of the observed side is volume-implied rather than actual. Half:
     enough to defuse one touchdown-luck week, not so much that a genuinely
     efficient player is projected as an average one. */
  var USAGE_SHARE = 0.5;

  function num(x) { var v = Number(x); return isFinite(v) ? v : 0; }

  /* Weeks still to come, counted as weeks NOT yet scored — the same rule
     value.js has always used for trade values, kept in one place now so the
     two can never disagree about how long "the rest of the season" is. */
  function weeksLeft(week) {
    var S = root.Store.get(), reg = S.league.regularSeasonWeeks, n = 0, w;
    var from = Math.max(1, Number(week) || 1);
    for (w = from; w <= reg; w++) if (!root.Store.weekIsScored(w)) n++;
    return Math.max(1, n);
  }

  /* Games he can actually still play: the weeks left, minus his bye when the
     bye is still ahead of us. A rest-of-season TOTAL that ignores a bye
     overstates by a full game, which at this scoring is a real number. */
  function gamesLeft(week, bye) {
    var left = weeksLeft(week);
    var b = Number(bye);
    if (isFinite(b) && b >= Number(week) && !root.Store.weekIsScored(b)) {
      var S = root.Store.get();
      if (b <= S.league.regularSeasonWeeks) left -= 1;
    }
    return Math.max(0, left);
  }

  /* ---- a man who is parked, but coming back ----------------------------
   * Tj, 2026-09-18d: the app called Dalton Schultz "out for the season" when
   * he was playing. Fixing that (recommend.js seasonOutlook) split one crude
   * boolean into two honest facts — FINISHED for the year, and PARKED on IR
   * with a return date — and the second needs a price. Zero is wrong (he
   * plays again in October and this league runs to week 14) and his full
   * remaining total is wrong too (he cannot play the weeks he is sitting).
   * The right answer is the one this file already computes for everybody
   * else, started later: his per-game rate times the games he can still
   * actually appear in.
   *
   * WHICH WEEK IS A DATE? Anchored on the week the caller is already looking
   * at rather than on a stored schedule, because a return is months out and
   * weekMeta only carries kickoff times for weeks that have been synced —
   * there is nothing on disk to look a November Sunday up in. Counting seven
   * days to the week off the current week needs no table, cannot go stale,
   * and is exact to the day either side of a Sunday, which is far finer than
   * "back around week 6" needs to be. */
  function weekOfDate(iso, week) {
    var t = Date.parse(iso);
    if (!isFinite(t)) return null;
    var wait = Math.ceil((t - Date.now()) / (7 * 24 * 60 * 60 * 1000));
    if (!(wait > 0)) wait = 0;
    return (Number(week) || 1) + wait;
  }

  /* Games still playable by someone not eligible until `returnIso`. Zero is a
     legitimate answer here — he is back after the regular season, or has no
     return date at all — so this deliberately does NOT inherit weeksLeft()'s
     Math.max(1, n) floor, which exists to stop a season-total division by
     zero and would silently credit a man who cannot play again with a game. */
  function gamesLeftFrom(returnIso, week, bye) {
    var back = weekOfDate(returnIso, week);
    if (back === null) return 0;
    var S = root.Store.get(), reg = S.league.regularSeasonWeeks, n = 0, w;
    var b = Number(bye), from = Math.max(Number(week) || 1, back);
    for (w = from; w <= reg; w++) {
      if (root.Store.weekIsScored(w)) continue;
      if (isFinite(b) && b === w) continue;
      n++;
    }
    return n;
  }

  /* A player's bye week, with the league's own bye table as the fallback when
     his record carries none — the same resolution Store.isOnBye does, kept
     here so a free agent straight out of the player database (whose `b` may
     be 0) and a rostered player are treated identically. */
  function byeOf(p) {
    var b = Number(p.bye !== undefined ? p.bye : p.b);
    if (!b) {
      var S = root.Store.get();
      var abbr = p.nfl || p.t;
      if (S.byes && abbr) b = Number(S.byes[String(abbr).toUpperCase()]) || 0;
    }
    return isFinite(b) ? b : 0;
  }

  /* ---- per-opportunity rates, measured from this league's own book -------
   * points per carry-or-target (skill positions) and per pass attempt (QB),
   * aggregated across every scored week, in league points. Memoised on the
   * store generation and the week, since it walks the whole book.
   *
   * The book rows carry no position (store.js: { n, t, p, pa, cr, tg }), so
   * position comes from the player database by name. A name the database has
   * never heard of is skipped rather than guessed at. */
  var _rateMemo = null;
  function rates(week) {
    var gen = (root.Store && root.Store.generation) ? root.Store.generation() : 0;
    var dbAt = (root.PlayerDB && root.PlayerDB.meta) ? (root.PlayerDB.meta().updated || '') : '';
    var k = String(week) + '|' + gen + '|' + dbAt;
    if (_rateMemo && _rateMemo.k === k) return _rateMemo.v;

    var posOf = {};
    var db = root.PlayerDB ? root.PlayerDB.get().players : [];
    var i;
    for (i = 0; i < db.length; i++) {
      posOf[root.Espn.normName(db[i].n)] = db[i].p;
    }
    var agg = {}, w, key;
    for (w = 1; w < Number(week); w++) {
      /* Whatever the BOOK holds, not whatever weekIsScored() blesses. These
         rates exist to regress observed() above, and observed() reads the
         book through bookTrend, which counts a row the moment it exists —
         it does not wait for weekMeta to say the week is synced and final.
         Gating this side on weekIsScored and the other side on the book
         meant that in exactly the common case (stats pulled in, the week not
         yet closed out) the rate table came back EMPTY, `xpg` came back null,
         and the efficiency regression this file documents as half its method
         silently did nothing at all. Two reads of "which weeks count" have
         to be one read. */
      var bw = root.Store.bookWeek(w);
      for (key in bw) {
        if (!Object.prototype.hasOwnProperty.call(bw, key)) continue;
        var row = bw[key];
        var pos = posOf[key];
        if (!pos && root.Names && root.Names.hit) {
          var alt = root.Names.hit(posOf, row.n || key);
          if (alt) pos = alt;
        }
        if (!pos) continue;
        var opp = pos === 'QB' ? num(row.pa) : (num(row.cr) + num(row.tg));
        if (opp <= 0) continue;
        if (!agg[pos]) agg[pos] = { pts: 0, opp: 0 };
        agg[pos].pts += num(row.p);
        agg[pos].opp += opp;
      }
    }
    var out = {}, p;
    for (p in agg) {
      if (!Object.prototype.hasOwnProperty.call(agg, p)) continue;
      if (agg[p].opp > 0) out[p] = agg[p].pts / agg[p].opp;
    }
    _rateMemo = { k: k, v: out };
    return out;
  }

  /* ---- the baseline: full-season projections, averaged, in league points --
   * Returns a PER-GAME rate and says which sources produced it. Every branch
   * here is a season-long view of the player; the weekly fallback is last
   * precisely because one week's matchup is the thing this file exists to
   * stop ranking on. */
  function baseline(name, pos, week) {
    var sr = root.Projections && root.Projections.findSeason
      ? root.Projections.findSeason({ name: name, pos: pos }) : null;
    var vals = [], names = [];
    if (sr) {
      if (typeof sr.season === 'number' && sr.season > 0) {
        vals.push(sr.season / Math.max(1, num(sr.gp) || 17));
        names.push('ESPN full-season');
      }
      if (typeof sr.sleeperSeason === 'number' && sr.sleeperSeason > 0) {
        vals.push(sr.sleeperSeason / Math.max(1, num(sr.sleeperGp) || 17));
        names.push('Sleeper full-season');
      }
    }
    if (vals.length) {
      var t = 0, i;
      for (i = 0; i < vals.length; i++) t += vals[i];
      return { v: t / vals.length, src: names.join(' + ') +
               (vals.length > 1 ? ' projections, averaged and re-scored for this league'
                                : ' projection, re-scored for this league'),
               kind: 'season', n: vals.length };
    }
    /* No season projection for him anywhere. A weekly line is a far weaker
       answer to a season-long question — it is one opponent — but it is still
       a professional estimate of his per-game rate, so it beats a floor. */
    var wr = root.Projections ? root.Projections.find({ name: name, pos: pos }, week) : null;
    if (wr) {
      var wv = [], wn = [];
      if (typeof wr.week === 'number' && isFinite(wr.week) && wr.week > 0) {
        wv.push(wr.week); wn.push('ESPN');
      }
      if (typeof wr.sleeperWeek === 'number' && isFinite(wr.sleeperWeek) && wr.sleeperWeek > 0) {
        wv.push(wr.sleeperWeek); wn.push('Sleeper');
      }
      if (wv.length) {
        var t2 = 0, j;
        for (j = 0; j < wv.length; j++) t2 += wv[j];
        return { v: t2 / wv.length,
                 src: wn.join(' + ') + ' week-' + week + ' line only — no full-season ' +
                      'projection on file for him',
                 kind: 'week', n: wv.length };
      }
    }
    var pri = (root.Recommend && root.Recommend.PRIOR) ? root.Recommend.PRIOR[pos] : 10;
    return { v: (pri || 10) * 0.55,
             src: 'no projection from any source — positional floor, treat as a guess',
             kind: 'floor', n: 0 };
  }

  /* ---- what he has actually done this season ----------------------------
   * Every scored week, not the last four: this is a season-long question, and
   * a player who has played six games has six games of evidence. Returns the
   * actual per-game rate AND the rate his volume alone implies. */
  function observed(name, pos, week) {
    var t = root.Store.bookTrend ? root.Store.bookTrend(name, Number(week) - 1, 25) : [];
    var pts = 0, opp = 0, n = 0, i;
    for (i = 0; i < t.length; i++) {
      if (!t[i].row) continue;
      var r = t[i].row;
      pts += num(r.p);
      opp += pos === 'QB' ? num(r.pa) : (num(r.cr) + num(r.tg));
      n++;
    }
    if (!n) return { n: 0, pg: null, xpg: null, oppPG: 0 };
    var rate = rates(week)[pos];
    var xpg = (opp > 0 && rate > 0) ? (opp / n) * rate : null;
    return { n: n, pg: pts / n, xpg: xpg, oppPG: opp / n };
  }

  /* ---- the estimate -----------------------------------------------------
   * p: { name, pos, bye }. Returns per-game and, the number that matters,
   * the expected REST-OF-SEASON total in league points. */
  function estimate(p, week) {
    var pos = p.pos;
    var b = baseline(p.name, pos, week);
    var o = observed(p.name, pos, week);
    var games = gamesLeft(week, p.bye);

    var obsPG = null;
    if (o.n) {
      obsPG = (o.xpg === null) ? o.pg
            : (1 - USAGE_SHARE) * o.pg + USAGE_SHARE * o.xpg;
    }
    var w = o.n / (o.n + PRIOR_GAMES);
    var perGame = (obsPG === null) ? b.v : (w * obsPG + (1 - w) * b.v);
    if (!isFinite(perGame) || perGame < 0) perGame = 0;

    /* How much this number can be leant on. "high" needs a real season-long
       projection AND a sample behind it; "low" is a bare floor with nothing
       measured, which must never be presented as a ranking. */
    var conf = 'low';
    if (b.kind === 'season' && o.n >= 2) conf = 'high';
    else if (b.kind === 'season' || o.n >= 3) conf = 'medium';

    var src;
    if (obsPG === null) {
      src = b.src;
    } else {
      src = Math.round(w * 100) + '% his ' + o.n + ' game' + (o.n === 1 ? '' : 's') +
            ' this season, ' + (100 - Math.round(w * 100)) + '% ' + b.src;
      if (o.xpg !== null) src += '; efficiency regressed toward his own volume';
    }

    return {
      name: p.name, pos: pos,
      perGame: perGame,
      total: perGame * games,
      games: games,
      weeks: weeksLeft(week),
      n: o.n,
      observedPG: o.pg,
      expectedPG: o.xpg,
      oppPG: o.oppPG,
      baseline: b.v,
      baselineKind: b.kind,
      baselineSrc: b.src,
      wObserved: w,
      conf: conf,
      src: src
    };
  }

  root.Ros = {
    estimate: estimate, baseline: baseline, observed: observed,
    rates: rates, gamesLeft: gamesLeft, weeksLeft: weeksLeft, byeOf: byeOf,
    weekOfDate: weekOfDate, gamesLeftFrom: gamesLeftFrom,
    PRIOR_GAMES: PRIOR_GAMES, USAGE_SHARE: USAGE_SHARE
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Ros;
})(typeof window !== 'undefined' ? window : this);
