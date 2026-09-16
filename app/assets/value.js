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

  /* ---- what one player is worth per game, REST OF SEASON -----------------
   * Tj, 2026-09-16: "I want it to suggest waiver wire drops and adds that
   * will increase my team output for the entire season... it is only
   * considering week to week." This used to lead with ESPN's THIS-WEEK
   * projected stat line — a single game's specific matchup — ahead of even
   * a real measured sample, which is exactly why one good matchup could
   * outrank a player who is actually better for the rest of the season.
   * Re-ordered toward what predicts the REST of the season, most reliable
   * first, and the row always SAYS which one it used:
   *   1. what he has actually scored in this league this season (the book),
   *      last 4 weeks — but only once there is enough of it (2+ games) to
   *      not be one lucky/unlucky week wearing a season's clothing
   *   2. ESPN's full-SEASON (rest-of-season) projection, per game — this
   *      updates through the season and is not tied to one week's opponent
   *   3. a single measured game — thin, but still real, and better than a
   *      blind guess
   *   4. ESPN's projected stat line for THIS week only — last resort before
   *      the guess, since by itself it says nothing about the other 16
   *   5. nothing — a positional floor, clearly labelled as a guess
   * `n` (the measured-game count) rides along on the result so callers can
   * gate "is this a confident-enough signal to actively recommend" separate
   * from "what number do we show" — see freeAgents()' `confident` below.
   *
   * Found in this same pass: step 2 (ESPN season pace) used to return
   * `rec.season` directly as if it were ALREADY a per-game rate. It is not
   * — projections.js's `ingest()` stores the FULL-SEASON total there (the
   * same field recommend.js's projectOne divides by 17 before using), so
   * any player who fell through to that branch was valued at roughly 17x
   * his real rest-of-season rate. Fixed here alongside the reordering. */
  function perGame(name, pos, week) {
    var rec = root.Projections ? root.Projections.find({ name: name, pos: pos }, week) : null;
    /* the raw name, not norm(name) — bookTrend resolves it tolerantly
       against however ESPN actually spelled the box score (see its own
       comment in store.js); pre-normalising here bought nothing and, before
       that fix, was the reason a "Kenny"-vs-"Kenneth" spelling gap silently
       lost real recent production for this exact class of player. */
    var t = root.Store.bookTrend ? root.Store.bookTrend(name, week - 1, 4) : [];
    var sum = 0, n = 0, i;
    for (i = 0; i < t.length; i++) if (t[i].row) { sum += t[i].row.p; n++; }
    if (n >= 2) {
      return { v: sum / n, src: n + ' scored weeks in this app (season average)', n: n };
    }
    if (rec && typeof rec.season === 'number' && rec.season > 0) {
      return { v: rec.season / 17, src: 'ESPN season pace (rest-of-season projection)', n: n };
    }
    if (n === 1) {
      return { v: sum, src: '1 scored week in this app — thin sample', n: n };
    }
    if (rec && typeof rec.week === 'number' && isFinite(rec.week) && rec.week > 0) {
      return { v: rec.week, src: 'ESPN week ' + week + ' line only — no season-long signal yet', n: 0 };
    }
    var pri = (root.Recommend && root.Recommend.PRIOR) ? root.Recommend.PRIOR[pos] : 10;
    return { v: (pri || 10) * 0.55, src: 'no data — positional floor, treat as a guess', n: 0 };
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
   * dropping anybody invalidates it immediately. */
  var _faMemo = null;
  function freeAgents(week, limit) {
    var gen = (root.Store && root.Store.generation) ? root.Store.generation() : 0;
    var k = String(week) + '|' + gen;
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
      var pg = perGame(p.n, p.p, week);
      /* A real signal, not one lucky/unlucky week — gates whether he can be
         a TOP recommendation (freeAgentCard's "beats a starter" list and
         upgrades() below), never whether he is shown at all; the full
         per-position list still lists everyone so nothing is hidden. */
      var confident = pg.n >= 2 || pg.src.indexOf('season pace') >= 0;
      /* usage was formatted for all ~785 players and read for about 36 of
         them. It is a getter now: same property name, built on first touch. */
      var row = { name: p.n, pos: p.p, nfl: p.t, bye: p.b, onBye: onBye,
                  v: onBye ? 0 : pg.v, raw: pg.v, src: pg.src,
                  healthLabel: h.label, healthNote: h.note, confident: confident };
      (function (r, nm) {
        var memo = null;
        Object.defineProperty(r, 'usage', { enumerable: true, get: function () {
          if (memo === null) memo = usageText(nm, week);
          return memo;
        } });
      }(row, p.n));
      out.push(row);
    }
    out.sort(function (a, b) { return b.v - a.v; });
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
    var rep = {}, out = {}, i, p;
    /* replacement = the best non-bye free agent at the position. Derived from
       the same list so it can never disagree with the rows shown. */
    for (i = 0; i < all.length; i++) {
      p = all[i];
      if (rep[p.pos] === undefined && !p.onBye) rep[p.pos] = p.raw;
    }
    POS.forEach(function (k) {
      if (rep[k] === undefined) rep[k] = 0;
      out[k] = [];
    });
    for (i = 0; i < all.length; i++) {
      p = all[i];
      if (!out[p.pos]) continue;
      p.vor = p.raw - rep[p.pos];
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

  /* ---- what my own team looks like, in the same units --------------------
   * `pos` is the SLOT's position label — 'FLEX' for the flex slot, whoever
   * is actually in it — because upgrades() below deliberately buckets by
   * slot type (a FLEX bucket, compared against every flex-eligible free
   * agent, separate from the fixed RB/WR/TE slots). `realPos` is the
   * PLAYER's own position, added in the 2026-09-15e sweep: needs() (below)
   * was using the slot label as if it were a position and hardcoding FLEX
   * to RB's replacement level regardless of who was actually starting
   * there — wrong for the common case of a WR or TE in flex. */
  function myStarters(week, teamId, opponents) {
    var picks = root.Recommend.bestLineup(week, teamId, opponents);
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
   *     act on without also opening the Rosters tab to guess who to cut. */
  function upgrades(week, teamId, opponents, poolSize) {
    var fa = freeAgents(week, poolSize || 60);
    var allProj = root.Recommend.projectAll(week, teamId, opponents);
    var starters = myStarters(week, teamId, opponents);
    var startIds = {}, i;
    for (i = 0; i < starters.length; i++) startIds[starters[i].id] = 1;
    var repl = replacement(week), left = weeksLeft(week);
    var dc = dropCandidatesFrom(allProj, startIds, repl, left, 1);
    var flexOK = root.Store.get().league.flexEligible || ['RB', 'WR', 'TE'];
    var out = [];
    for (i = 0; i < fa.length; i++) {
      var f = fa[i];
      if (f.onBye || !f.confident) continue;
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
         that ordinary week-to-week noise cannot trigger it on its own */
      if (perGameGain <= 1) continue;
      var seasonGain = perGameGain * left;
      var why = f.name + ' projects about ' + perGameGain.toFixed(1) + ' more point' +
        (Math.abs(perGameGain - 1) < 0.05 ? '' : 's') + ' per game than ' + drop.name +
        ' for the rest of the season (' + left + ' week' + (left === 1 ? '' : 's') +
        ' left) — roughly ' + seasonGain.toFixed(1) + ' points of season-long swing. ' +
        f.name + '’s number: ' + f.src + '. ' + drop.name +
        (drop.bench ? ' is currently on your bench.' : ' is currently your starter at ' + drop.pos + '.');
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
  function weeksLeft(week) {
    var S = root.Store.get(), reg = S.league.regularSeasonWeeks, n = 0, w;
    var from = Math.max(1, Number(week) || 1);
    for (w = from; w <= reg; w++) if (!root.Store.weekIsScored(w)) n++;
    return Math.max(1, n);
  }

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
     a 9-point tight end is only a problem if the wire has a better one. */
  function needs(week, teamId, opponents) {
    var starters = myStarters(week, teamId, opponents);
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
  function dropCandidatesFrom(allProj, startIds, repl, left, perPos) {
    var byPosAll = {}, i;
    for (i = 0; i < allProj.length; i++) {
      var x = allProj[i], p = x.p;
      var r = repl[p.pos] || 0;
      var ros = (x.base - r) * left;
      if (!byPosAll[p.pos]) byPosAll[p.pos] = [];
      /* `base` (the raw per-game rate, not yet above-replacement) rides
         along so a caller comparing this player directly against a FREE
         AGENT's own per-game rate (upgrades() below) does not have to
         re-derive it from `ros` and repl separately. */
      byPosAll[p.pos].push({ id: p.id, name: p.name, pos: p.pos, ros: ros,
                              base: x.base, bench: !startIds[p.id] });
    }
    var out = {}, k;
    for (k in byPosAll) {
      if (!Object.prototype.hasOwnProperty.call(byPosAll, k)) continue;
      var list = byPosAll[k];
      var bench = list.filter(function (x2) { return x2.bench; });
      var pool = (bench.length ? bench : list).slice();
      pool.sort(function (a, b) { return a.ros - b.ros; });
      out[k] = pool.slice(0, perPos || 3);
    }
    return out;
  }

  function waiverContext(week, teamId, opponents, season, today) {
    var g = byPos(week, 6);
    var allProj = root.Recommend.projectAll(week, teamId, opponents);
    var starters = myStarters(week, teamId, opponents);
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
      needs: needs(week, teamId, opponents),
      pool: g,
      injuries: myInjuries(week, allProj),
      kdefNeed: kdefNeedFrom(allProj),
      dropCandidates: dropCandidatesFrom(allProj, startIds, repl, left, 3)
    };
  }

  root.Value = { freeAgents: freeAgents, upgrades: upgrades, replacement: replacement,
                 needs: needs, waiverContext: waiverContext,
                 waiverLoad: waiverLoad, waiverSave: waiverSave,
                 byPos: byPos, byVor: byVor, POS: POS,
                 perGame: perGame, usage: usage, usageText: usageText,
                 valueOf: valueOf, trade: trade, weeksLeft: weeksLeft,
                 rosteredSet: rosteredSet, myInjuries: myInjuries,
                 myStarters: myStarters };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Value;
})(typeof window !== 'undefined' ? window : this);
