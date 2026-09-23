/* gamelog.js — full box-score cache, any NFL team, any week, independent of
 * roster. ES2018 only.
 *
 * WHY THIS EXISTS
 * S.stats[week][pid] (store.js) only covers the ~170 ROSTERED players, and
 * S.book[week][name] is points-only (no yards/TDs/etc). A game log needs the
 * full line for ANY player, on ANY team, for games this app never synced
 * because nobody in the league owns that player. This is that cache.
 *
 * SELF-CONTAINED, like playerdb.js: its own Native.save/load key, not part
 * of Store's save cycle, so browsing game logs never adds a byte to the
 * write every lineup edit triggers.
 *
 * SHAPE: { version, weeks: { "<week>": { "<TEAM ABBR>": {
 *   opp, home, state, teamScore, oppScore, eventId, at,
 *   players: { normName: {name, espnId, line} }, dst: line|null
 * } } } }
 *
 * ONE FETCH CACHES BOTH TEAMS. Espn.gameStats(eventId) already returns full
 * lines for everyone in the game; splitting that one result into both teams'
 * entries means browsing one team's log is never a second fetch for its
 * opponent, and a week's "top players" sweep is one gameStats call per GAME
 * (up to 16), not per team (up to 32).
 *
 * CACHED FOREVER ONCE FINAL. A `state:'post'` entry never re-fetches unless
 * the caller explicitly asks (`opts.force`, wired to pull-to-refresh) — the
 * same reuse-if-final rule doSync already applies to the current week's
 * sync, extended to every week this module ever looks at.
 */
(function (root) {
  'use strict';
  var KEY = 'fftracker_gamelog_v1';
  var DB = null;

  function rawLoad() {
    try {
      if (root.Native && root.Native.load) { var s = root.Native.load(KEY); return s ? JSON.parse(s) : null; }
      var t = root.localStorage.getItem(KEY); return t ? JSON.parse(t) : null;
    } catch (e) { return null; }
  }
  function rawSave(o) {
    try {
      var s = JSON.stringify(o);
      if (root.Native && root.Native.save) { root.Native.save(KEY, s); return true; }
      root.localStorage.setItem(KEY, s); return true;
    } catch (e) { return false; }
  }
  function get() {
    if (!DB) DB = rawLoad() || { version: 1, weeks: {} };
    if (!DB.weeks) DB.weeks = {};
    return DB;
  }
  /* ---- WHEN THIS CACHE IS WRITTEN (full test, 2026-09-23c) ---------------
   * ingestEvent() used to rewrite the WHOLE cache — JSON.stringify of every
   * box score this season plus a synchronous bridge write and fsync — once per
   * game ingested. The cache is ~200 KB a week (422 KB after week 2, ~3.5 MB by
   * week 17), and the Sunday live poll re-ingests every in-progress game every
   * 45 seconds: mid-season that was ~9 full 2-3 MB writes per poll, on the
   * renderer's thread, all afternoon. Two changes, no data lost:
   *   - only a FINAL game makes the cache worth writing. An in-progress line
   *     is never trusted from disk anyway (ensureEvent refetches anything not
   *     cached-final), so persisting it bought nothing;
   *   - writes are coalesced: a batch of ingests (a sync fetches three at a
   *     time, sixteen on a Tuesday) becomes ONE write shortly after the last,
   *     and flush() — called from ui.js's __appPause, before Android may kill
   *     the process — writes anything still pending. */
  var PERSIST_MS = 2000, persistTimer = null, dirty = false;
  function persistSoon() {
    dirty = true;
    if (persistTimer !== null) return;
    persistTimer = setTimeout(function () { persistTimer = null; flush(); }, PERSIST_MS);
  }
  function flush() {
    if (persistTimer !== null) { clearTimeout(persistTimer); persistTimer = null; }
    if (!dirty) return true;
    dirty = false;
    return rawSave(get());
  }
  function weekBucket(week) {
    var d = get(), w = String(week);
    if (!d.weeks[w]) d.weeks[w] = {};
    return d.weeks[w];
  }

  /* ---- position lookup, forward from an ESPN box-score name key ---------
   * Mirrors doSync's own byName index (ui.js): every name VARIANT a player
   * could appear under maps to his PlayerDB row, so a nickname mismatch
   * between ESPN's displayName and the database's spelling still resolves.
   * Rebuilt only when the database's player count changes (a PlayerDB
   * refresh), same invalidation style as Store.playerById's pid index. */
  var _posIdx = null, _posIdxLen = -1;
  function posIndex() {
    var d = root.PlayerDB.get();
    if (_posIdx && _posIdxLen === d.players.length) return _posIdx;
    _posIdx = {};
    var i, j, variants, p;
    for (i = 0; i < d.players.length; i++) {
      p = d.players[i];
      if (p.p === 'DEF') continue;   /* DEF lines come from entry.dst, never this index */
      variants = root.Names ? root.Names.variants(p.n) : [root.PlayerDB.norm(p.n)];
      for (j = 0; j < variants.length; j++) {
        if (!_posIdx[variants[j]]) _posIdx[variants[j]] = p;
      }
    }
    _posIdxLen = d.players.length;
    return _posIdx;
  }
  function resolveEntry(normNameKey) { return posIndex()[normNameKey] || null; }

  /* ---- filling the cache -------------------------------------------------
   * One box score, both teams, in one Espn.gameStats call. */
  /* Pulled out from ensureEvent (2026-09-15e sweep) so a box score fetched
   * elsewhere — ui.js's doSync() calls Espn.gameStats(g.id) for the exact
   * same games, every regular sync — can feed this cache directly instead
   * of this module fetching the same game a second time. Same pattern
   * already established for the schedule (see ui.js's liveTick comment:
   * "FREE: this response already carries every kickoff time"), applied here
   * to box scores instead. */
  function ingestEvent(week, game, r) {
    var bucket = weekBucket(week);
    var abbrs = (game.teams || []).map(function (t) { return t.abbr; });
    var i, abbr, k;
    for (i = 0; i < abbrs.length; i++) {
      abbr = abbrs[i];
      var opp = abbrs[1 - i] || '';
      var teamG = game.teams[i] || {}, oppG = game.teams[1 - i] || {};
      var players = {};
      for (k in r.players) {
        if (!Object.prototype.hasOwnProperty.call(r.players, k)) continue;
        if (r.players[k].abbr !== abbr) continue;
        players[k] = { name: r.players[k].name, espnId: r.players[k].espnId, line: r.players[k].line };
      }
      var agg = r.teamAgg[abbr];
      bucket[abbr] = {
        opp: opp, home: teamG.homeAway === 'home', state: game.state,
        teamScore: r.teamScore[abbr] !== undefined ? r.teamScore[abbr] : teamG.score,
        oppScore: r.teamScore[opp] !== undefined ? r.teamScore[opp] : oppG.score,
        eventId: game.id, at: new Date().toISOString(),
        players: players,
        dst: agg ? root.Espn.dstLine(agg) : null
      };
    }
    if (game.state === 'post') persistSoon();
    return bucket;
  }
  function ensureEvent(week, game, force) {
    var bucket = weekBucket(week);
    var abbrs = (game.teams || []).map(function (t) { return t.abbr; });
    if (!force && game.state === 'post') {
      var have = true, i;
      for (i = 0; i < abbrs.length; i++) {
        if (!bucket[abbrs[i]] || bucket[abbrs[i]].state !== 'post') have = false;
      }
      if (have) return Promise.resolve(bucket);
    }
    return root.Espn.gameStats(game.id).then(function (r) { return ingestEvent(week, game, r); });
  }

  /* ---- reading it ---------------------------------------------------------
   * teamWeek: the one team's slice of one week's game, fetching only what
   * is not already cached-final. Returns null for a bye or a game that has
   * not kicked off yet — never an empty guess. */
  function teamWeek(teamAbbr, week, opts) {
    var abbr = String(teamAbbr || '').toUpperCase();
    var force = !!(opts && opts.force);
    var bucket = weekBucket(week);
    if (!force && bucket[abbr] && bucket[abbr].state === 'post') {
      return Promise.resolve(bucket[abbr]);
    }
    var S = root.Store.get();
    return root.Espn.weekGames(S.settings.season, week, week > 18 ? 3 : 2).then(function (games) {
      var i, g;
      for (i = 0; i < games.length; i++) {
        g = games[i];
        var abbrs = (g.teams || []).map(function (t) { return t.abbr; });
        if (abbrs.indexOf(abbr) < 0) continue;
        if (g.state === 'pre') return null;             /* not played yet */
        return ensureEvent(week, g, force).then(function (b) { return b[abbr] || null; });
      }
      return null;                                       /* bye week */
    });
  }

  /* Every week a team has actually played, most-recent first. No per-week
   * fetch needed: the regular season has no gaps besides the bye, so every
   * week strictly before `throughWeek` is known-final by construction, and
   * only `throughWeek` itself can still be 'pre' (teamWeek resolves that). */
  function playedWeeks(teamAbbr, throughWeek) {
    var abbr = String(teamAbbr || '').toUpperCase();
    var S = root.Store.get();
    var bye = Number(S.byes && S.byes[abbr]) || 0;
    var out = [], w;
    for (w = throughWeek; w >= 1; w--) {
      if (w === bye) continue;
      out.push(w);
    }
    return out;
  }

  /* Full-season game log for one PlayerDB row (a real player OR a DEF unit,
   * playerEntry.p === 'DEF'), most recent game first. Bounded parallel
   * fetch — Espn.pool at width 3, the same concurrency doSync already uses,
   * so a season pull is not sixteen sequential round trips. */
  function playerLog(playerEntry, throughWeek, opts) {
    var abbr = String(playerEntry.t || '').toUpperCase();
    var isDef = playerEntry.p === 'DEF';
    var weeks = playedWeeks(abbr, throughWeek);
    var variants = (isDef ? [] : (root.Names ? root.Names.variants(playerEntry.n) : [root.PlayerDB.norm(playerEntry.n)]));
    return root.Espn.pool(weeks, 3, function (w) {
      return teamWeek(abbr, w, opts).then(function (entry) { return { w: w, entry: entry }; });
    }).then(function (results) {
      var out = [], i, v, errs = 0;
      for (i = 0; i < results.length; i++) {
        if (results['err' + i]) errs++;
        var r = results[i]; if (!r || !r.entry) continue;
        var line = null;
        if (isDef) {
          line = r.entry.dst;
        } else {
          for (v = 0; v < variants.length; v++) {
            if (r.entry.players[variants[v]]) { line = r.entry.players[variants[v]].line; break; }
          }
        }
        if (!line || !line.played) continue;
        out.push({
          week: r.w, opp: r.entry.opp, home: r.entry.home, state: r.entry.state,
          teamScore: r.entry.teamScore, oppScore: r.entry.oppScore,
          line: line, pts: root.Scoring.score(line).total
        });
      }
      out.sort(function (a, b) { return b.week - a.week; });
      /* Espn.pool swallows a per-week fetch failure into a clean `null`
       * (one dead game must not lose the rest of the season) — which reads
       * identically to "he genuinely has no games yet" unless something
       * distinguishes them. It does: pool also records the real error under
       * results['err'+i]. If EVERY week came back empty and at least one of
       * them was a real failure, this was the network, not an empty season —
       * say so, rather than showing a misleading "no games yet". */
      if (!out.length && errs) {
        throw new Error('could not reach the network for ' + errs + ' of ' + weeks.length +
                         ' week' + (weeks.length === 1 ? '' : 's') + ' — try again');
      }
      return out;
    });
  }

  var POS_ORDER = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 };
  /* Every player who played for one team in one week, sorted QB/RB/WR/TE/K
   * then DEF, plus the DEF unit's own line. */
  function teamRoster(teamAbbr, week, opts) {
    var abbr = String(teamAbbr || '').toUpperCase();
    return teamWeek(abbr, week, opts).then(function (entry) {
      if (!entry) return null;
      var rows = [], k;
      for (k in entry.players) {
        if (!Object.prototype.hasOwnProperty.call(entry.players, k)) continue;
        var L = entry.players[k].line;
        if (!L.played) continue;
        var pe = resolveEntry(k);
        rows.push({
          name: entry.players[k].name, espnId: entry.players[k].espnId,
          pos: pe ? pe.p : '', line: L, pts: root.Scoring.score(L).total
        });
      }
      rows.sort(function (a, b) {
        var oa = POS_ORDER[a.pos] !== undefined ? POS_ORDER[a.pos] : 9;
        var ob = POS_ORDER[b.pos] !== undefined ? POS_ORDER[b.pos] : 9;
        if (oa !== ob) return oa - ob;
        return b.pts - a.pts;
      });
      var dst = entry.dst ? { pos: 'DEF', line: entry.dst, pts: root.Scoring.score(entry.dst).total } : null;
      return { opp: entry.opp, home: entry.home, state: entry.state,
               teamScore: entry.teamScore, oppScore: entry.oppScore, rows: rows, dst: dst };
    });
  }

  var TOP_POS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  /* Top 10 by league points at each position, incl. DEF, for one week.
   * Fetches by GAME (Espn.pool width 3) rather than by team, so a full-week
   * sweep is up to 16 gameStats calls, not 32 — the cache this fills is the
   * exact same one teamWeek/teamRoster/playerLog read, so nothing here is a
   * second copy of the data. */
  function weekPositionTops(week, opts) {
    var force = !!(opts && opts.force);
    var S = root.Store.get();
    return root.Espn.weekGames(S.settings.season, week, week > 18 ? 3 : 2).then(function (games) {
      var want = games.filter(function (g) { return g.state !== 'pre'; });
      return root.Espn.pool(want, 3, function (g) { return ensureEvent(week, g, force); }).then(function (results) {
        /* Same reasoning as playerLog: Espn.pool turns a real fetch failure
         * into a clean no-op, which reads identically to "nobody has played
         * yet". If every single game this week failed to fetch, say so. */
        if (want.length) {
          var errs = 0, i2;
          for (i2 = 0; i2 < results.length; i2++) if (results['err' + i2]) errs++;
          if (errs === want.length) {
            throw new Error('could not reach the network for any of week ' + week + '’s games — try again');
          }
        }
        var bucket = weekBucket(week), out = {}, i;
        for (i = 0; i < TOP_POS.length; i++) out[TOP_POS[i]] = [];
        var abbr;
        for (abbr in bucket) {
          if (!Object.prototype.hasOwnProperty.call(bucket, abbr)) continue;
          var entry = bucket[abbr], k;
          for (k in entry.players) {
            if (!Object.prototype.hasOwnProperty.call(entry.players, k)) continue;
            var L = entry.players[k].line; if (!L.played) continue;
            var pe = resolveEntry(k); if (!pe || !out[pe.p]) continue;
            out[pe.p].push({ name: entry.players[k].name, team: abbr,
                              pts: root.Scoring.score(L).total });
          }
          if (entry.dst) {
            out.DEF.push({ name: abbr + ' D/ST', team: abbr,
                            pts: root.Scoring.score(entry.dst).total });
          }
        }
        var pos;
        for (pos in out) {
          if (!Object.prototype.hasOwnProperty.call(out, pos)) continue;
          out[pos].sort(function (a, b) { return b.pts - a.pts; });
          out[pos] = out[pos].slice(0, 10);
        }
        return out;
      });
    });
  }

  var API = { teamWeek: teamWeek, playedWeeks: playedWeeks, playerLog: playerLog,
              teamRoster: teamRoster, weekPositionTops: weekPositionTops,
              resolveEntry: resolveEntry, ingestEvent: ingestEvent, flush: flush,
              _get: get, _KEY: KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.Gamelog = API;
})(typeof window !== 'undefined' ? window : this);
