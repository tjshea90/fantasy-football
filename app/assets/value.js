/* value.js — free agents, usage trends and trade values. ES2018 only.
 *
 * ONE IDEA RUNS THROUGH ALL THREE: a player is worth what he scores IN THIS
 * LEAGUE above what you could get for free at the same position. Every public
 * ranking, every trade calculator and every "top waiver adds" list on the
 * internet is computed in half-PPR standard scoring, where a completion is
 * worth nothing and this league pays a point for it. A QB is worth roughly
 * twice here what those lists say, and no list on the internet knows that.
 * So none of them are imported. Everything below is built from:
 *   - the bundled player database (who exists, and who is not on a roster)
 *   - ESPN's projected STAT LINE re-scored by scoring.js (projections.js)
 *   - the league book: what every player actually scored, in league points
 *   - recommend.js's blended baseline for players who are on a roster
 *
 * NO NETWORK. Everything here reads caches the sync already filled.
 */
(function (root) {
  'use strict';

  var POS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

  function norm(s) { return root.Espn.normName(s); }

  /* Every player currently on any roster in this league, under EVERY spelling
     that means him. Keyed by Names.canon so "Kenny Gainwell" on the wire and
     "Kenneth Gainwell" on the roster are one man; the raw normalised spellings
     go in too, so a lookup that has not been canonicalised still hits. */
  function rosteredSet() {
    var out = {};
    root.Store.allPlayers().forEach(function (x) {
      var pl = x.player;
      if (pl.pos === 'DEF') {
        if (pl.nfl) out['DEF:' + pl.nfl] = x.team.id;
        out[norm(pl.name)] = x.team.id;
        return;
      }
      /* variants() already includes canon(pl.name) as its first element (see
         names.js's own variants(): `add(c)` runs before anything else) — a
         separate out[canon(...)] assignment here was a no-op, writing the
         same key with the same value the loop just wrote. */
      var v = root.Names.variants(pl.name), i;
      for (i = 0; i < v.length; i++) out[v[i]] = x.team.id;
    });
    return out;
  }

  /* ---- what one player is worth, REST OF SEASON -------------------------
   * Tj, 2026-09-18, with a screenshot of the Wire tab: "the wire tab is only
   * making recommendations and projecting scores based on prior weeks actual
   * stats. This is a broken system... it must rank available players based on
   * expected full season performance, not just the next NFL week, and
   * calculated for this league scoring system."
   *
   * THE WHOLE BODY OF THIS FUNCTION IS NOW ONE CALL to ros.js, and that is
   * the point. What used to live here was a five-branch preference ladder:
   * measured weeks if there were 2+, else ESPN's season pace, else a SINGLE
   * measured week used raw, else this week's ESPN line, else a floor. Two
   * things were wrong with it, and together they produced exactly the board
   * in his screenshot:
   *
   *   - the season-pace branch never fired. Proved against the live endpoint
   *     on 2026-09-18: the projections route that wins nearly every sync asks
   *     for a specific scoring period, and ESPN then returns weekly splits
   *     only, so `rec.season` was essentially never set. The one branch that
   *     looked at the whole season was dead code.
   *   - so in week 2, with one week scored, EVERY free agent landed on the
   *     single-measured-week branch and was priced at that one game, forever,
   *     labelled "1 scored week in this app — thin sample". The label was
   *     honest; using the number anyway was not.
   *
   * ros.js replaces the ladder with a blend that always has a season-long
   * spine: real full-season projections from ESPN and Sleeper (both re-scored
   * into league points), with this season's measured games shrunk in as the
   * sample grows, efficiency regressed toward the player's own volume, and
   * the result multiplied by the games he actually has left. See its header
   * for the method and the sources.
   *
   * `bye` is optional and only affects the TOTAL, never the per-game rate.
   * The shape returned still carries `v`, `src` and `n` because callers all
   * over this file and the Wire tab read those three by name; everything the
   * new engine knows rides alongside them. */
  function perGame(name, pos, week, bye) {
    var e = root.Ros.estimate({ name: name, pos: pos, bye: bye }, week);
    return { v: e.perGame, src: e.src, n: e.n, ros: e.total, games: e.games,
             conf: e.conf, baseline: e.baseline, baselineKind: e.baselineKind,
             baselineSrc: e.baselineSrc, wObserved: e.wObserved,
             observedPG: e.observedPG, expectedPG: e.expectedPG };
  }

  /* opportunity, not points: what actually predicts next week */
  function usage(name, week, n) {
    var t = root.Store.bookTrend ? root.Store.bookTrend(name, week - 1, n || 3) : [];
    var rows = [], i;
    for (i = 0; i < t.length; i++) {
      if (!t[i].row) { rows.push({ week: t[i].week, played: false }); continue; }
      var r = t[i].row;
      rows.push({ week: t[i].week, played: true, pts: r.p,
                  patt: r.pa || 0, car: r.cr || 0, tgts: r.tg || 0,
                  touches: (r.cr || 0) + (r.tg || 0) });
    }
    return rows;
  }
  function usageText(name, week) {
    var rows = usage(name, week, 3), out = [], i;
    for (i = 0; i < rows.length; i++) {
      if (!rows[i].played) { out.push('wk' + rows[i].week + ' —'); continue; }
      var bits = [];
      if (rows[i].patt) bits.push(rows[i].patt + ' att');
      if (rows[i].car) bits.push(rows[i].car + ' car');
      if (rows[i].tgts) bits.push(rows[i].tgts + ' tgt');
      out.push('wk' + rows[i].week + ' ' + (bits.length ? bits.join('/') : 'no touches') +
               ' → ' + rows[i].pts.toFixed(1));
    }
    return out.join('   ·   ');
  }

  /* ---- the free-agent board ---------------------------------------------
   * Memoised, because one Rosters render calls it up to six times: upgrades(),
   * byPos(), and replacement() once per player in a selected trade. Each call
   * walks all ~785 database rows doing a Projections lookup and a book trend
   * per player. The key includes the store's roster generation, so adding or
   * dropping anybody invalidates it immediately.
   *
   * 2026-09-17: that was NOT enough. PlayerDB.ensureFresh() and
   * Recommend.loadNews() both refresh themselves in the BACKGROUND (on tab
   * open, on the live poll) and call render() when they land — but neither
   * one touches Store's roster generation, so this memo never noticed either
   * had happened. The Wire tab always renders once, immediately, before
   * those two async fetches land; that first call computed and cached a
   * board from whatever was ALREADY on disk (possibly a stale player
   * database still carrying someone who has since fallen off every NFL
   * roster, or an empty injury cache under which nobody can ever be OUT).
   * Every render after that — including the one the completed background
   * fetch itself triggers — kept replaying that same first, incomplete
   * snapshot until Tj added or dropped a player of his own. This is why
   * Nick Chubb and Kareem Hunt (confirmed live, 2026-09-17: on zero of the
   * 32 current NFL rosters) kept reappearing on the board even after the
   * v6.9 fix that was supposed to remove them — the exclusion code was
   * correct, it just never got handed the refreshed data. Folding both
   * feeds' own freshness stamps into the key makes a completed background
   * refresh actually take effect on the very next render, same as a roster
   * change always has. */
  var _faMemo = null;
  function freeAgents(week, limit) {
    var gen = (root.Store && root.Store.generation) ? root.Store.generation() : 0;
    var dbAt = (root.PlayerDB && root.PlayerDB.meta) ? (root.PlayerDB.meta().updated || '') : '';
    var newsAt = (root.Recommend && root.Recommend.newsCache) ? (root.Recommend.newsCache().at || 0) : 0;
    var k = String(week) + '|' + gen + '|' + dbAt + '|' + newsAt;
    if (_faMemo && _faMemo.k === k) {
      return limit ? _faMemo.rows.slice(0, limit) : _faMemo.rows;
    }
    var taken = rosteredSet();
    var db = root.PlayerDB ? root.PlayerDB.get().players : [];
    var out = [], i;
    for (i = 0; i < db.length; i++) {
      var p = db[i];
      var key = p.p === 'DEF' ? ('DEF:' + p.t) : root.Names.canon(p.n);
      if (taken[key] || taken[norm(p.n)]) continue;
      if (POS.indexOf(p.p) < 0) continue;
      /* practice-squad players cannot play in an NFL game — never offered
         as a pickup at all (2026-09-16, see playerdb.js's rosterStatus;
         missing `.st` — a never-refreshed bundled entry — defaults active
         so this never hides the whole board on a fresh install). */
      if (p.st === 'practice-squad') continue;
      /* Same OUT/IR/SUSPENDED/PUP exclusion the Advice tab already applies
         to a rostered player's lineup slot (Recommend.health, all four
         collapse to label 'OUT') — a blocked player is never offered here
         either, not just down-ranked. Verified live, 2026-09-16: three of
         the top RB "adds" in Tj's own screenshot were on ESPN's Injured
         Reserve at that exact moment. */
      var h = (root.Recommend && root.Recommend.health)
        ? root.Recommend.health({ name: p.n }) : { f: 1, label: '', note: '' };
      if (h.label === 'OUT') continue;
      var onBye = Number(p.b) === Number(week);
      var pg = perGame(p.n, p.p, week, root.Ros.byeOf(p));
      /* A real signal, not one lucky/unlucky week — gates whether he can be
         a TOP recommendation (freeAgentCard's "beats a starter" list and
         upgrades() below), never whether he is shown at all; the full
         per-position list still lists everyone so nothing is hidden. */
      /* Now a property of the ESTIMATE rather than a string match on its
         label: ros.js grades every estimate 'high' (a real full-season
         projection AND games behind it), 'medium' (one or the other) or
         'low' (a bare positional floor with nothing measured). Only a 'low'
         one is barred from being an active recommendation, because a floor
         is a guess and nothing else here is. This is deliberately more
         permissive than the old 2-measured-games rule, and it can be: the
         old rule existed to stop a one-week sample being extrapolated, and
         that is now handled where it belongs — inside the blend, by
         weighting one game at 20% instead of 100%. */
      var confident = pg.conf !== 'low';
      /* Separate from `confident` above: this is just "has he actually done
         ANYTHING on an NFL field this season, ever, at all" — true for a
         single measured game too, not just 2+. Tj, 2026-09-17, pointing at
         Nick Chubb/Trey Benson/Kareem Hunt sitting ABOVE real one-game
         producers on the board: "are these legitimate recommendations?"
         They were ranked purely on ESPN's generic per-role week-line guess
         (perGame()'s branch 4, `n === 0`) — a number with no season-long
         signal behind it at all — which happened to be larger than what
         several players ACTUALLY put up in a real game. A guess with zero
         track record has no business outranking a measured result just
         because the guess is a bigger number; see the sort below. */
      var hasSignal = pg.n >= 1 || pg.baselineKind === 'season';
      /* usage was formatted for all ~785 players and read for about 36 of
         them. It is a getter now: same property name, built on first touch. */
      /* `ros` — expected points for the REST OF THE SEASON — is the number
         this board ranks on now. `v`/`raw` stay per-game because the Wire
         tab, the trade screen and every prompt read them by name, but they
         are no longer what decides an order. A bye costs a game inside
         `ros` already (ros.js's gamesLeft), so unlike `v` it is NOT zeroed
         out for a bye week: a man on bye this week is still worth his
         remaining season, which is exactly the distinction Tj asked for
         between a one-week view and a season-long one. */
      var row = { name: p.n, pos: p.p, nfl: p.t, bye: p.b, onBye: onBye,
                  v: onBye ? 0 : pg.v, raw: pg.v, ros: pg.ros, games: pg.games,
                  src: pg.src, conf: pg.conf,
                  baselineKind: pg.baselineKind, baselineSrc: pg.baselineSrc,
                  wObserved: pg.wObserved, observedPG: pg.observedPG,
                  healthLabel: h.label, healthNote: h.note, confident: confident,
                  hasSignal: hasSignal, n: pg.n };
      (function (r, nm) {
        var memo = null;
        Object.defineProperty(r, 'usage', { enumerable: true, get: function () {
          if (memo === null) memo = usageText(nm, week);
          return memo;
        } });
      }(row, p.n));
      out.push(row);
    }
    /* Real production first, unconfirmed guesses after — see `hasSignal`
       above. Without this, a player with literally zero measured games
       could still rank #1 at his position purely because ESPN's own
       generic weekly model happened to print a bigger number than what
       someone else actually scored. Within each tier, still by value. */
    /* Real production or a real season-long projection first, bare guesses
       after — see `hasSignal` above. Within each tier, by EXPECTED REST-OF-
       SEASON POINTS, not by this week's rate: that is the ranking Tj asked
       for ("expected full season performance, not just the next NFL week"),
       and it is what makes a player with eleven games left correctly worth
       more than an equal one with six. */
    out.sort(function (a, b) {
      if (a.hasSignal !== b.hasSignal) return a.hasSignal ? -1 : 1;
      if (Math.abs(b.ros - a.ros) > 1e-9) return b.ros - a.ros;
      return b.v - a.v;
    });
    _faMemo = { k: k, rows: out };
    return limit ? out.slice(0, limit) : out;
  }

  /* ---- the board, GROUPED BY POSITION -----------------------------------
   * Why this exists: freeAgents() sorts every position into one list by league
   * points, and in THIS league a completion pays 1 point, so a startable QB is
   * worth roughly twice a startable running back. One global sort therefore
   * returns an all-QB list — which is exactly what the board looked like, and
   * it was not a bug in the data, it was the sort. Nobody comparing waiver
   * options wants QBs 1-40; they want the best few at each position.
   *
   * Returns { QB:[...], RB:[...], ... } each already sorted, each capped, and
   * every row carrying `vor` — points above the best free agent at that same
   * position. VOR is the only number on this screen that means anything ACROSS
   * positions, so the UI can offer one honest mixed ranking as well.
   */
  function byPos(week, perPos) {
    var all = freeAgents(week, 0);
    var rep = {}, repRos = {}, out = {}, i, p;
    /* replacement = the best non-bye free agent at the position. Derived from
       the same list so it can never disagree with the rows shown.
       Tracked in BOTH currencies: per-game, which the trade screen and the
       needs list have always used, and rest-of-season, which is what `vor`
       is expressed in now. */
    for (i = 0; i < all.length; i++) {
      p = all[i];
      if (rep[p.pos] === undefined && !p.onBye) { rep[p.pos] = p.raw; repRos[p.pos] = p.ros; }
    }
    POS.forEach(function (k) {
      if (rep[k] === undefined) rep[k] = 0;
      if (repRos[k] === undefined) repRos[k] = 0;
      out[k] = [];
    });
    for (i = 0; i < all.length; i++) {
      p = all[i];
      if (!out[p.pos]) continue;
      /* points above replacement FOR THE REST OF THE SEASON. The old version
         was a per-game gap, which made a quarterback's edge look eight times
         a running back's for the same season-long swing and quietly buried
         the bye-week distinction entirely. */
      p.vor = p.ros - repRos[p.pos];
      p.vorPerGame = p.raw - rep[p.pos];
      /* rank within his own position — the tie-breaker byVor needs below */
      p.pRank = out[p.pos].length + 1;
      if (!perPos || out[p.pos].length < perPos) out[p.pos].push(p);
    }
    return out;
  }

  /* one mixed list that is actually comparable across positions: ranked by
     points above the free-agent replacement at each man's own position */
  /* Ties break on rank WITHIN the position, and that matters more than it
     looks. Before any projection has been fetched, every free agent at a
     position falls back to the same positional floor, so every vor is exactly
     0 — and a plain sort then returns the concatenation order, which is thirty
     quarterbacks. That is the identical complaint this whole screen was
     rebuilt to answer, reappearing whenever the data is thin. With the
     tie-break the head of the list is QB1, RB1, WR1, TE1, K1, DEF1, then the
     seconds, which is the honest reading of "everyone at this position looks
     the same". Once real projections exist the vor values separate and the
     tie-break stops mattering. */
  function byVor(week, limit) {
    var g = byPos(week, 0), flat = [], k;
    for (k in g) if (g.hasOwnProperty(k)) flat = flat.concat(g[k]);
    flat.sort(function (a, b) {
      if (Math.abs(b.vor - a.vor) > 1e-9) return b.vor - a.vor;
      return (a.pRank || 99) - (b.pRank || 99);
    });
    return limit ? flat.slice(0, limit) : flat;
  }

  /* the value of the best free agent at each position — the line above which
     a player is actually worth something to you, and below which he is not */
  function replacement(week) {
    var fa = freeAgents(week, 0), out = {}, i;
    for (i = 0; i < fa.length; i++) {
      if (out[fa[i].pos] === undefined && !fa[i].onBye) out[fa[i].pos] = fa[i].raw;
    }
    POS.forEach(function (p) { if (out[p] === undefined) out[p] = 0; });
    return out;
  }

  /* The same line, in rest-of-season points — what the best freely available
     player at each position is worth from here to the end of the year. This
     is the honest baseline for "is this pickup actually worth a roster
     spot", because a roster spot costs you whoever else you could have had
     for nothing at that position for the SAME remaining weeks. */
  function replacementRos(week) {
    var fa = freeAgents(week, 0), out = {}, i;
    for (i = 0; i < fa.length; i++) {
      if (out[fa[i].pos] === undefined && !fa[i].onBye) out[fa[i].pos] = fa[i].ros;
    }
    POS.forEach(function (p) { if (out[p] === undefined) out[p] = 0; });
    return out;
  }

  /* ---- what my own team looks like, in the same units --------------------
   * `pos` is the SLOT's position label — 'FLEX' for the flex slot, whoever
   * is actually in it — because upgrades() below deliberately buckets by
   * slot type (a FLEX bucket, compared against every flex-eligible free
   * agent, separate from the fixed RB/WR/TE slots). `realPos` is the
   * PLAYER's own position, added in the 2026-09-15e sweep: needs() (below)
   * was using the slot label as if it were a position and hardcoding FLEX
   * to RB's replacement level regardless of who was actually starting
   * there — wrong for the common case of a WR or TE in flex. */
  function myStarters(week, teamId, opponents, allProj) {
    var picks = root.Recommend.bestLineup(week, teamId, opponents, allProj);
    var out = [];
    picks.forEach(function (k) {
      if (!k || !k.pick) return;
      out.push({ slot: k.key || k.slot, pos: k.pos, realPos: k.pick.p.pos, id: k.pick.p.id,
                 name: k.pick.p.name, proj: k.pick.proj, base: k.pick.base });
    });
    return out;
  }

  /* Who on the wire is better than somebody on your roster, FOR THE REST OF
   * THE SEASON — not just this one week. Tj, 2026-09-16: "it keeps
   * recommending I switch QB. It is only considering week to week... I want
   * it to suggest waiver wire drops and adds that will increase my team
   * output for the entire season... It needs to suggest the top players
   * available... that are better for the season than the player it
   * recommends I drop. It should explain why to drop the player I have in
   * favor of the player it recommends."
   *
   * This used to compare a free agent's THIS-WEEK number against a
   * starter's THIS-WEEK number with a trivial 0.5-point margin — one good
   * matchup was enough to trigger a swap suggestion that made no sense once
   * that matchup passed. Now:
   *   - both sides compare on the SAME rest-of-season basis: the free
   *     agent's `.v` (perGame()'s season-oriented rate — see its own header,
   *     never a single week's matchup) against the rostered player's `.base`
   *     (recommend.js's blended baseline BEFORE the matchup/health
   *     multipliers projectOne applies for just this one week);
   *   - the free agent has to be `confident` (freeAgents() above — 2+
   *     measured games, or ESPN's own season-long model, never one flashy
   *     week) to be considered at all, which is what actually kills the
   *     "switch QB after one great week" case;
   *   - EVERY suggestion is paired with a specific player to drop for him —
   *     the weakest bench player at the position by the same ROS math
   *     dropCandidatesFrom() already uses (falling back to the weakest
   *     starter only when the position has no bench depth at all) — plus a
   *     plain-English reason, so this is never a bare ranked list nobody can
   *     act on without also opening the Rosters tab to guess who to cut.
   *
   * QUARTERBACK, A SECOND TIME (Tj, 2026-09-18): "it always recommends qb
   * switch from the QBs I already have, Stafford and bo nix... I drafted
   * these QBs because they had excellent stats last quarter and they are
   * pass heavy, in this league the scoring is one point for every completed
   * pass. Only recommend a replacement qb if it is truly a season edge over
   * the high completion QBs I already have." The 2026-09-16 fix above
   * (`confident`, a flat 1-point margin) killed the one-week-spike case but
   * left a real gap for QB specifically: a completion is worth a full point
   * here, so a good starting QB's per-game rate already runs 3-4x a good
   * RB/WR's — a "1 more point per game" margin is a real edge at running
   * back and pure rounding noise at quarterback. And `confident` alone lets
   * ESPN's generic rest-of-season MODEL (never having thrown a pass for
   * this team) count the same as a QB who has actually gone out and posted
   * the numbers — which is exactly backwards for a position this league
   * pays for accuracy and volume, not upside. So QB gets both a much larger
   * minimum gain AND a requirement for real measured games behind the free
   * agent's number — a projection, however confident, is not "truly a
   * season edge" on its own. K/DEF get the opposite treatment: Tj, same
   * message, "defense and kicker are not priorities" — `kdefNeedFrom`
   * already gates the Claude-driven board (ai.js normalizeWaivers) the same
   * way; this deterministic, no-cost board never had that gate at all,
   * so a streamable kicker or defense could out-rank an actual RB/WR need
   * simply by clearing the flat 1-point bar every other position uses. */
  var QB_MIN_GAIN = 6;        /* season-defining, not week-to-week noise */
  var QB_MIN_MEASURED = 3;    /* real games played, not a projection alone */
  function upgrades(week, teamId, opponents, poolSize) {
    var fa = freeAgents(week, poolSize || 60);
    var allProj = root.Recommend.projectAll(week, teamId, opponents);
    /* pass allProj through so myStarters()'s own bestLineup() call reuses it
       instead of running the whole roster-wide projectAll pass a second time
       (found in the 2026-09-18 review — same class of fix needs() already
       gets via its own `starters` param). */
    var starters = myStarters(week, teamId, opponents, allProj);
    var startIds = {}, i;
    for (i = 0; i < starters.length; i++) startIds[starters[i].id] = 1;
    var repl = replacement(week), left = weeksLeft(week);
    var dc = dropCandidatesFrom(allProj, startIds, repl, left, 1);
    var kdefNeed = kdefNeedFrom(allProj);
    var flexOK = root.Store.get().league.flexEligible || ['RB', 'WR', 'TE'];
    var out = [];
    for (i = 0; i < fa.length; i++) {
      var f = fa[i];
      if (f.onBye || !f.confident) continue;
      /* low priority, per Tj: never worth bumping an actual roster need,
         and only even considered when mine is genuinely unavailable */
      if ((f.pos === 'K' || f.pos === 'DEF') && !kdefNeed[f.pos]) continue;
      /* real production, not a model's opinion of him — see the header */
      if (f.pos === 'QB' && f.n < QB_MIN_MEASURED) continue;
      var cands = dc[f.pos] || [];
      /* a FLEX-eligible free agent also competes with the weakest FLEX-
         eligible player on the roster, not just his own listed position */
      if (flexOK.indexOf(f.pos) >= 0) {
        var flexAll = [];
        flexOK.forEach(function (fp) { flexAll = flexAll.concat(dc[fp] || []); });
        flexAll.sort(function (a, b) { return a.base - b.base; });
        if (flexAll.length && (!cands.length || flexAll[0].base < cands[0].base)) {
          cands = flexAll;
        }
      }
      if (!cands.length) continue;
      var drop = cands[0];
      var perGameGain = f.v - drop.base;
      /* a full point of REAL rest-of-season signal per game, not a rounding
         margin — small enough to still catch a real upgrade, large enough
         that ordinary week-to-week noise cannot trigger it on its own.
         QB needs far more: see the header comment above. */
      var minGain = f.pos === 'QB' ? QB_MIN_GAIN : 1;
      if (perGameGain <= minGain) continue;
      var seasonGain = perGameGain * left;
      var why = f.name + ' projects about ' + perGameGain.toFixed(1) + ' more point' +
        (Math.abs(perGameGain - 1) < 0.05 ? '' : 's') + ' per game than ' + drop.name +
        ' for the rest of the season (' + left + ' week' + (left === 1 ? '' : 's') +
        ' left) — roughly ' + seasonGain.toFixed(1) + ' points of season-long swing. ' +
        f.name + '’s number: ' + f.src + '. ' + drop.name +
        (drop.bench ? ' is currently on your bench.' : ' is currently your starter at ' + drop.pos + '.') +
        (f.pos === 'QB' ? ' A quarterback swap only shows up here when the edge is large and ' +
          'backed by real games played — a completion pays a full point in this league, so a ' +
          'proven, high-completion starter is not worth benching for a smaller or unproven edge.'
          : '');
      out.push({ fa: f, drop: drop, over: drop, perGame: perGameGain, gain: seasonGain,
                 weeks: left, why: why });
    }
    out.sort(function (a, b) { return b.gain - a.gain; });
    return out;
  }

  /* ---- trades ------------------------------------------------------------
   * Value above replacement, times the weeks left. A player is not worth his
   * points; he is worth his points MINUS what the wire would give you for
   * nothing at the same position — which is why a startable TE and a fourth
   * running back are not the same asset even at the same projection. */
  /* Counts weeks STILL TO COME. It used to start at week 1, so any early week
     that was never marked final (a sync that stopped short, a bye-heavy week)
     was counted as "remaining" for the rest of the season — in week 10 with
     weeks 1-3 unscored it returned 8 instead of 5, inflating every trade value
     by about 60%. */
  /* One implementation, in ros.js, which needs the same count to turn a
     per-game rate into a season total. Two copies of "how long is the rest
     of the season" is exactly the kind of pair that drifts. */
  function weeksLeft(week) { return root.Ros.weeksLeft(week); }

  function valueOf(pid, week, opponents) {
    var rec = root.Store.playerById(pid);
    if (!rec) return null;
    var p = rec.player;
    var proj = root.Recommend.projectAll(week, rec.team.id, opponents);
    var mine = null, i;
    for (i = 0; i < proj.length; i++) if (proj[i].p.id === pid) mine = proj[i];
    var base = mine ? mine.base : perGame(p.name, p.pos, week).v;
    var repl = replacement(week)[p.pos] || 0;
    var left = weeksLeft(week);
    return { id: pid, name: p.name, pos: p.pos, nfl: p.nfl, team: rec.team.id,
             perGame: base, replacement: repl,
             vorpPerGame: base - repl, ros: (base - repl) * left, weeks: left };
  }

  function trade(week, giveIds, getIds, opponents) {
    var give = [], get = [], i, v;
    for (i = 0; i < giveIds.length; i++) { v = valueOf(giveIds[i], week, opponents); if (v) give.push(v); }
    for (i = 0; i < getIds.length; i++) { v = valueOf(getIds[i], week, opponents); if (v) get.push(v); }
    function sum(a) { var t = 0, j; for (j = 0; j < a.length; j++) t += a[j].ros; return t; }
    var out = sum(get) - sum(give);
    /* Roster spots are not free: giving two and getting one means somebody off
       the wire fills the hole, and that somebody is worth replacement — i.e.
       zero above replacement. So the count difference costs nothing in value
       terms, and saying so is more honest than inventing a penalty. */
    var note = '';
    if (give.length !== get.length) {
      note = 'Uneven count: the spare roster spot gets filled from the wire, ' +
             'which by definition is worth replacement level — no value either way.';
    }
    return { give: give, get: get, giveTotal: sum(give), getTotal: sum(get),
             delta: out, weeks: weeksLeft(week), note: note,
             verdict: out > 8 ? 'clearly in your favour'
                    : out > 2 ? 'slightly in your favour'
                    : out < -8 ? 'clearly against you'
                    : out < -2 ? 'slightly against you' : 'about even' };
  }

  /* ==== waiver context + cache (v3.4) ===================================
   * Everything Claude needs to rank the wire, assembled here rather than in
   * ui.js, because it is all league arithmetic and none of it is presentation.
   *
   * The candidate pool sent is deliberately SMALL: the top few at each
   * position, not the whole wire. The wire is ~600 players and almost all of
   * them are irrelevant; sending them would cost input tokens on every call
   * for no gain, and would bury the ones that matter. The app has already
   * ranked them in league points, which is the part Claude cannot do — its
   * job is the news on the shortlist, not discovery. */
  var WKEY = 'fftracker_waivers_v1';
  function waiverLoad() {
    try {
      var s = (root.Native && root.Native.load) ? root.Native.load(WKEY)
              : (root.localStorage ? root.localStorage.getItem(WKEY) : null);
      if (s) { var o = JSON.parse(s); if (o && o.adds) return o; }
    } catch (e) { /* the cache is optional */ }
    return null;
  }
  function waiverSave(v) {
    try {
      var s = JSON.stringify(v);
      if (root.Native && root.Native.save) root.Native.save(WKEY, s);
      else if (root.localStorage) root.localStorage.setItem(WKEY, s);
    } catch (e) { /* the cache is optional */ }
  }

  /* Which starting slots are actually weak, weakest first. "Weak" is measured
     against the best free agent at that position, not against some absolute —
     a 9-point tight end is only a problem if the wire has a better one.
     `starters` is optional — waiverContext() below already has its own copy
     from myStarters() and passes it through so this does not recompute the
     same bestLineup()/projectAll() pass a second time in the same call. */
  function needs(week, teamId, opponents, starters) {
    starters = starters || myStarters(week, teamId, opponents);
    var rep = replacement(week), out = [], i;
    for (i = 0; i < starters.length; i++) {
      var s = starters[i];
      /* the PLAYER's real position, not the slot label — a FLEX slot is
       * not itself a position to measure a replacement level for or to
       * hand Claude as something to go find on the wire (fixed in the
       * 2026-09-15e sweep; this used to hardcode every FLEX starter
       * against RB's replacement level regardless of who was actually
       * starting there, wrong for the common WR/TE-in-flex case). */
      var pos = s.realPos || s.pos;
      var r = rep[pos] || 0;
      var gap = (s.proj || 0) - r;
      out.push({ pos: pos, slot: s.slot, name: s.name, proj: s.proj || 0, gap: gap,
                 note: gap <= 0
                   ? 'the wire already has someone better at this position'
                   : (gap < 2 ? 'barely above what is freely available' : '') });
    }
    out.sort(function (a, b) { return a.gap - b.gap; });
    /* only the genuinely thin ones — a budget is spent per need */
    return out.filter(function (x) { return x.gap < 4; }).slice(0, 5);
  }

  /* ---- MY roster, injuries, deterministic (v5.5) -------------------------
   * Reuses Recommend.projectAll rather than reading the ESPN feed a second
   * way, so this can never disagree with the Advice tab about who is hurt —
   * one source of truth for injury status, shared rather than reimplemented.
   * Needs no API key: this is the ESPN designation and note, on screen the
   * moment the Wire tab opens. Claude, when synced, adds a season-outlook
   * READ on top of this list — it never replaces it. */
  function myInjuries(week, allProj) {
    var out = [], i;
    for (i = 0; i < allProj.length; i++) {
      var x = allProj[i];
      if (x.onBye) {
        out.push({ name: x.p.name, pos: x.p.pos, nfl: x.p.nfl, status: 'BYE',
                   note: 'on bye in week ' + week, onBye: true });
      } else if (x.h && x.h.label) {
        out.push({ name: x.p.name, pos: x.p.pos, nfl: x.p.nfl, status: x.h.label,
                   note: x.h.note || '', onBye: false });
      }
    }
    return out;
  }

  /* ---- K/DEF need: true only when every K (or every DEF) on my roster is
   * on bye or ruled OUT this week. This is the ONE exception under which a
   * kicker or defense add is worth anything to Tj, per his own rule: low
   * priority otherwise, no exception either way if my own is startable. */
  function kdefNeedFrom(allProj) {
    var out = { K: false, DEF: false }, k;
    for (k in out) {
      if (!Object.prototype.hasOwnProperty.call(out, k)) continue;
      var mine = allProj.filter(function (x) { return x.p.pos === k; });
      out[k] = !mine.length || mine.every(function (x) {
        return x.onBye || (x.h && x.h.label === 'OUT');
      });
    }
    return out;
  }

  /* ---- drop candidates, per position, weakest REST-OF-SEASON value first -
   * Bench players only, when there are any — a starter is offered only as a
   * last resort when the position has no bench depth at all, so Claude
   * always has something to weigh a pickup against rather than nothing.
   * Ranked on ROS (points above replacement TIMES weeks left), the same
   * arithmetic trade() already uses — not this week's number — because a
   * player who barely helps this week but matters for two more months must
   * not be offered ahead of one who is dead weight all season. This is what
   * keeps "give more priority to entire season recommendations... over
   * small weekly changes" honest instead of just a sentence in the prompt. */
  function dropCandidatesFrom(allProj, startIds, week, perPos) {
    var rows = rosterValues(allProj, startIds, week);
    var byPosAll = {}, i;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!byPosAll[r.pos]) byPosAll[r.pos] = [];
      byPosAll[r.pos].push(r);
    }
    var out = {}, k;
    for (k in byPosAll) {
      if (!Object.prototype.hasOwnProperty.call(byPosAll, k)) continue;
      var list = byPosAll[k];
      /* A man who is finished for the year is droppable whether he is
         nominally a "starter" or not — that is the whole point of rule 6's
         season-ending clause, and leaving him out of the bench pool would
         hide the one swap that is not optional. */
      var pool = list.filter(function (x2) { return x2.bench || x2.outForSeason; });
      if (!pool.length) pool = list.slice();
      pool.sort(function (a, b) { return a.ros - b.ros; });
      out[k] = pool.slice(0, perPos || 3);
    }
    return out;
  }

  /* Which positions have somebody on my roster who is DONE for the year, and
     therefore must be replaced regardless of how low a priority the position
     normally is (Tj, 2026-09-18, rule 6). */
  function mandatedFrom(allProj, startIds, week) {
    var rows = rosterValues(allProj, startIds, week), out = {}, i;
    for (i = 0; i < rows.length; i++) {
      if (!rows[i].outForSeason) continue;
      if (!out[rows[i].pos]) out[rows[i].pos] = [];
      out[rows[i].pos].push(rows[i]);
    }
    return out;
  }

  function waiverContext(week, teamId, opponents, season, today) {
    var g = byPos(week, 6);
    var allProj = root.Recommend.projectAll(week, teamId, opponents);
    /* same reuse as upgrades() above — allProj already covers the whole
       roster, so myStarters() has no reason to run projectAll again. */
    var starters = myStarters(week, teamId, opponents, allProj);
    var t = root.Store.team(teamId);
    var startIds = {}, i;
    for (i = 0; i < starters.length; i++) startIds[starters[i].id] = 1;
    var bench = [];
    if (t) {
      for (i = 0; i < t.players.length; i++) {
        if (!startIds[t.players[i].id]) {
          bench.push(t.players[i].name + ' (' + t.players[i].pos + ')');
        }
      }
    }
    var repl = replacement(week), left = weeksLeft(week);
    return {
      week: week, season: season || (new Date()).getFullYear(),
      today: today || (new Date()).toISOString().slice(0, 10),
      starters: starters, bench: bench,
      needs: needs(week, teamId, opponents, starters),
      pool: g,
      injuries: myInjuries(week, allProj),
      kdefNeed: kdefNeedFrom(allProj),
      dropCandidates: dropCandidatesFrom(allProj, startIds, repl, left, 3)
    };
  }

  root.Value = { freeAgents: freeAgents, upgrades: upgrades, replacement: replacement,
                 replacementRos: replacementRos,
                 needs: needs, waiverContext: waiverContext,
                 waiverLoad: waiverLoad, waiverSave: waiverSave,
                 byPos: byPos, byVor: byVor, POS: POS,
                 perGame: perGame, usage: usage, usageText: usageText,
                 valueOf: valueOf, trade: trade, weeksLeft: weeksLeft,
                 rosteredSet: rosteredSet, myInjuries: myInjuries,
                 myStarters: myStarters,
                 /* the exact bar upgrades() itself holds a QB free agent to —
                    exported so ai.js's normalizeWaivers can hold a
                    CLAUDE-suggested QB swap to the identical standard rather
                    than a second, hand-copied number that could drift from
                    this one (Tj, 2026-09-18: the same rule has to apply
                    "also" to the Claude-assisted paths, not just this
                    deterministic board). */
                 QB_MIN_GAIN: QB_MIN_GAIN, QB_MIN_MEASURED: QB_MIN_MEASURED };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Value;
})(typeof window !== 'undefined' ? window : this);
