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
      var v = root.Names.variants(pl.name), i;
      for (i = 0; i < v.length; i++) out[v[i]] = x.team.id;
      out[root.Names.canon(pl.name)] = x.team.id;
    });
    return out;
  }

  /* ---- what one player is worth per game --------------------------------
   * Three sources, in order of how much they know, and the row SAYS which one
   * it used rather than presenting a number of unknown provenance:
   *   1. ESPN's projected stat line for this week, re-scored here
   *   2. what he has actually scored in this league (the book), last 4 weeks
   *   3. nothing — a positional floor, clearly labelled as a guess
   */
  function perGame(name, pos, week) {
    var rec = root.Projections ? root.Projections.find({ name: name, pos: pos }) : null;
    if (rec && typeof rec.week === 'number' && isFinite(rec.week) && rec.week > 0) {
      return { v: rec.week, src: 'ESPN week line, re-scored' };
    }
    var t = root.Store.bookTrend ? root.Store.bookTrend(norm(name), week - 1, 4) : [];
    var sum = 0, n = 0, i;
    for (i = 0; i < t.length; i++) if (t[i].row) { sum += t[i].row.p; n++; }
    if (n) return { v: sum / n, src: n + ' scored week' + (n === 1 ? '' : 's') + ' in this app' };
    if (rec && typeof rec.season === 'number' && rec.season > 0) {
      return { v: rec.season, src: 'ESPN season pace' };
    }
    var pri = (root.Recommend && root.Recommend.PRIOR) ? root.Recommend.PRIOR[pos] : 10;
    return { v: (pri || 10) * 0.55, src: 'no data — positional floor, treat as a guess' };
  }

  /* opportunity, not points: what actually predicts next week */
  function usage(name, week, n) {
    var t = root.Store.bookTrend ? root.Store.bookTrend(norm(name), week - 1, n || 3) : [];
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
      var onBye = Number(p.b) === Number(week);
      var pg = perGame(p.n, p.p, week);
      /* usage was formatted for all ~785 players and read for about 36 of
         them. It is a getter now: same property name, built on first touch. */
      var row = { name: p.n, pos: p.p, nfl: p.t, bye: p.b, onBye: onBye,
                  v: onBye ? 0 : pg.v, raw: pg.v, src: pg.src };
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

  /* ---- what my own team looks like, in the same units -------------------- */
  function myStarters(week, teamId, opponents) {
    var picks = root.Recommend.bestLineup(week, teamId, opponents);
    var out = [];
    picks.forEach(function (k) {
      if (!k || !k.pick) return;
      out.push({ slot: k.key || k.slot, pos: k.pos, id: k.pick.p.id,
                 name: k.pick.p.name, proj: k.pick.proj, base: k.pick.base });
    });
    return out;
  }

  /* Who on the wire beats somebody you are actually starting. This is the
     whole point of a free-agent board: a ranked list nobody acts on is a
     ranked list. */
  function upgrades(week, teamId, opponents, poolSize) {
    var fa = freeAgents(week, poolSize || 60);
    var starters = myStarters(week, teamId, opponents);
    var byPos = {}, i;
    for (i = 0; i < starters.length; i++) {
      var s = starters[i];
      var p = s.pos === 'FLEX' ? 'FLEX' : s.pos;
      if (!byPos[p] || s.proj < byPos[p].proj) byPos[p] = s;
    }
    var flexOK = root.Store.get().league.flexEligible || ['RB', 'WR', 'TE'];
    var out = [];
    for (i = 0; i < fa.length; i++) {
      var f = fa[i];
      if (f.onBye) continue;
      var worst = byPos[f.pos];
      /* a FLEX-eligible free agent also competes with whoever is in the FLEX */
      if (byPos.FLEX && flexOK.indexOf(f.pos) >= 0 &&
          (!worst || byPos.FLEX.proj < worst.proj)) worst = byPos.FLEX;
      if (!worst) continue;
      if (f.v > worst.proj + 0.5) {
        out.push({ fa: f, over: worst, gain: f.v - worst.proj });
      }
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
      var pos = (s.pos === 'FLEX') ? 'RB' : s.pos;
      var r = rep[pos] || 0;
      var gap = (s.proj || 0) - r;
      out.push({ pos: s.pos, slot: s.slot, name: s.name, proj: s.proj || 0, gap: gap,
                 note: gap <= 0
                   ? 'the wire already has someone better at this position'
                   : (gap < 2 ? 'barely above what is freely available' : '') });
    }
    out.sort(function (a, b) { return a.gap - b.gap; });
    /* only the genuinely thin ones — a budget is spent per need */
    return out.filter(function (x) { return x.gap < 4; }).slice(0, 5);
  }

  function waiverContext(week, teamId, opponents, season, today) {
    var g = byPos(week, 6);
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
    return {
      week: week, season: season || (new Date()).getFullYear(),
      today: today || (new Date()).toISOString().slice(0, 10),
      starters: starters, bench: bench,
      needs: needs(week, teamId, opponents),
      pool: g
    };
  }

  root.Value = { freeAgents: freeAgents, upgrades: upgrades, replacement: replacement,
                 needs: needs, waiverContext: waiverContext,
                 waiverLoad: waiverLoad, waiverSave: waiverSave,
                 byPos: byPos, byVor: byVor, POS: POS,
                 perGame: perGame, usage: usage, usageText: usageText,
                 valueOf: valueOf, trade: trade, weeksLeft: weeksLeft,
                 rosteredSet: rosteredSet };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Value;
})(typeof window !== 'undefined' ? window : this);

// half-finished change, session died here
function halfWritten(