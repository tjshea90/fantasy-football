/* store.js — data model + persistence. ES2018 only.
 * Persists through the Native bridge when present, localStorage otherwise.
 */
(function (root) {
  'use strict';
  var KEY = 'fftracker_state_v1';
  var S = null;

  function nowISO() { return new Date().toISOString(); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function rawLoad() {
    try {
      if (root.Native && root.Native.load) { var s = root.Native.load(KEY); return s ? JSON.parse(s) : null; }
      var t = root.localStorage.getItem(KEY); return t ? JSON.parse(t) : null;
    } catch (e) { return null; }
  }
  function rawSave(obj) {
    var s = JSON.stringify(obj);
    try {
      if (root.Native && root.Native.save) { root.Native.save(KEY, s); return true; }
      root.localStorage.setItem(KEY, s); return true;
    } catch (e) { return false; }
  }

  function fromSeed(seed) {
    return {
      schema: 1,
      league: seed.league,
      byes: seed.byes,
      teams: clone(seed.teams),
      lineups: {},      /* week -> teamId -> {slotKey: playerId} */
      matchups: {},     /* week -> [[teamIdA, teamIdB], ...] */
      stats: {},        /* week -> playerId -> stat line */
      weekMeta: {},     /* week -> {synced, games, flags} */
      lineupManual: {},  /* week -> teamId -> {slotKey: 1} — slots Tj set himself */
      book: {},         /* week -> normName -> compact line for EVERY player (see setBook) */
      transactions: [],
      settings: defaults(seed)
    };
  }
  function defaults(seed) {
    return {
      season: seed.league.season, currentWeek: 1, lastSync: null,
      autoFill: true,          /* default every roster to its likely starters */
      liveRefresh: true,       /* poll while games are in progress */
      liveEvery: 45,           /* seconds between polls */
      aiKey: '', aiModel: '', aiBudget: 0,
      /* how the advice sync spends money (see recommend.js TRIAGE):
         'smart'  — research only players whose answer could move  (default)
         'full'   — every player every time, the pre-v2.4 behaviour
         'cheap'  — smart, on the cheap model */
      aiDepth: 'smart',
      aiFreshDays: 3,          /* a clear verdict stays good this long */
      individualReturnTD: false
    };
  }

  function init(seed) {
    S = rawLoad();
    if (!S || !S.teams || !S.teams.length) { S = fromSeed(seed); save(); }
    if (!S.byes) S.byes = seed.byes;
    if (!S.league) S.league = seed.league;
    if (!S.lineupManual) S.lineupManual = {};
    if (!S.book) S.book = {};
    /* migration: fill in settings added after this save was written */
    var d = defaults(seed), k;
    if (!S.settings) S.settings = d;
    for (k in d) {
      if (Object.prototype.hasOwnProperty.call(d, k) && S.settings[k] === undefined) {
        S.settings[k] = d[k];
      }
    }
    if (root.Scoring && root.Scoring.configure) {
      root.Scoring.configure({ individualReturnTD: S.settings.individualReturnTD });
    }
    return S;
  }
  function get() { return S; }
  function save() {
    bumpGen();   /* rosters may have changed — see playerById */
    S.settings.savedAt = nowISO();
    S.settings.saveCount = (S.settings.saveCount || 0) + 1;
    var ok = rawSave(S);
    /* Every tenth edit, drop a snapshot into the invisible auto-backup store.
     * The phone is the only place this data exists; a corrupt save or a bad
     * import would otherwise take the season with it. Silent — it must never
     * interrupt what the user is doing, and (since v4.2) it never shows up in
     * Downloads either — see NativeBridge.backupAuto. */
    if (ok && S.settings.saveCount % 10 === 0) autoBackup(false);
    return ok;
  }
  function autoBackup(force) {
    try {
      if (!(root.Native && root.Native.backupAuto)) return false;
      /* The whole state object — teams, lineups, every week's matchups and
       * stat lines, transactions, settings — so a restore is never partial. */
      var ok = root.Native.backupAuto(JSON.stringify(S));
      if (ok) { S.settings.autoBackupAt = nowISO(); rawSave(S); }
      return ok;
    } catch (e) { return false; }
  }

  /* --- slots ------------------------------------------------------- */
  /* Turns ['QB','RB','RB',...] into unique keys QB, RB1, RB2, WR1..3, TE, FLEX, K, DEF */
  function slotKeys() {
    var raw = S.league.slots, counts = {}, i, out = [];
    for (i = 0; i < raw.length; i++) counts[raw[i]] = (counts[raw[i]] || 0) + 1;
    var seen = {};
    for (i = 0; i < raw.length; i++) {
      var p = raw[i];
      if (counts[p] === 1) { out.push({ key: p, pos: p, label: p }); }
      else { seen[p] = (seen[p] || 0) + 1; out.push({ key: p + seen[p], pos: p, label: p + seen[p] }); }
    }
    return out;
  }
  function eligible(teamId, slotPos) {
    var t = team(teamId); if (!t) return [];
    var ok = slotPos === 'FLEX' ? S.league.flexEligible : [slotPos];
    return t.players.filter(function (p) { return ok.indexOf(p.pos) >= 0; });
  }

  /* --- teams / rosters --------------------------------------------- */
  function team(id) {
    for (var i = 0; i < S.teams.length; i++) if (S.teams[i].id === id) return S.teams[i];
    return null;
  }
  function allPlayers() {
    var out = [], i, j;
    for (i = 0; i < S.teams.length; i++)
      for (j = 0; j < S.teams[i].players.length; j++)
        out.push({ team: S.teams[i], player: S.teams[i].players[j] });
    return out;
  }
  /* playerById used to call allPlayers() — which allocates ~170 wrapper
     objects — and then linear-scan it. teamWeekPoints() calls it once per slot
     and lineFor() three times per slot, so ONE team-week costs ~1,700
     allocations; the League tab, which runs teamWeekPoints ~560 times, cost
     close to a million. It is now an index rebuilt only when the rosters
     actually change. Every mutating path calls save(), so bumping the
     generation there catches all of them. */
  var _pidIndex = null, _pidGen = -1, _gen = 0;
  function playerById(pid) {
    if (_pidIndex === null || _pidGen !== _gen) {
      _pidIndex = {};
      var a = allPlayers(), i;
      for (i = 0; i < a.length; i++) _pidIndex[a[i].player.id] = a[i];
      _pidGen = _gen;
    }
    var hit = _pidIndex[pid];
    return hit ? hit : null;
  }
  function bumpGen() { _gen++; }
  /* A dropped player's id must never be handed to somebody else: S.stats is
     keyed by pid and is NOT cleaned on a drop, so a reused id inherits the old
     man's scored weeks and silently corrupts standings, recaps and bench
     regret. The high-water mark is therefore persisted rather than derived
     from who happens to be on a roster right now. */
  function nextPid() {
    var max = 0;
    allPlayers().forEach(function (x) {
      var m = /^p(\d+)$/.exec(x.player.id); if (m && +m[1] > max) max = +m[1];
    });
    if (S.settings && typeof S.settings.pidHigh === 'number' && S.settings.pidHigh > max) {
      max = S.settings.pidHigh;
    }
    if (S.settings) S.settings.pidHigh = max + 1;
    return 'p' + String(max + 1);
  }
  function addPlayer(teamId, obj) {
    var t = team(teamId); if (!t) return null;
    var p = { id: nextPid(), name: obj.name, pos: obj.pos, nfl: obj.nfl || '',
              bye: obj.bye || (S.byes[obj.nfl] || 0), espnId: obj.espnId || '' };
    t.players.push(p);
    S.transactions.unshift({ at: nowISO(), type: 'add', team: t.name, player: p.name,
                             pos: p.pos, week: S.settings.currentWeek });
    save(); return p;
  }
  function removePlayer(teamId, pid) {
    var t = team(teamId); if (!t) return false;
    var i, gone = null;
    for (i = 0; i < t.players.length; i++) if (t.players[i].id === pid) { gone = t.players.splice(i, 1)[0]; break; }
    if (!gone) return false;
    /* pull him out of every stored lineup so nothing dangles */
    for (var w in S.lineups) {
      if (!Object.prototype.hasOwnProperty.call(S.lineups, w)) continue;
      var L = S.lineups[w][teamId]; if (!L) continue;
      for (var k in L) {
        if (L[k] !== pid) continue;
        delete L[k];
        /* and forget that the slot was hand-picked, or auto-fill would keep
           leaving it empty out of respect for a player who is gone */
        if (S.lineupManual && S.lineupManual[w] && S.lineupManual[w][teamId]) {
          delete S.lineupManual[w][teamId][k];
        }
      }
    }
    S.transactions.unshift({ at: nowISO(), type: 'drop', team: t.name, player: gone.name,
                             pos: gone.pos, week: S.settings.currentWeek });
    save(); return true;
  }

  /* --- lineups ------------------------------------------------------ */
  function getLineup(week, teamId) {
    var w = String(week);
    if (!S.lineups[w]) S.lineups[w] = {};
    if (!S.lineups[w][teamId]) S.lineups[w][teamId] = {};
    return S.lineups[w][teamId];
  }
  /* Which slots Tj set himself. Auto-fill may create and update slots it owns,
   * and must never touch one of these — that is the whole contract that makes
   * an auto-defaulted lineup safe to leave switched on. */
  function manualMap(week, teamId) {
    var w = String(week);
    if (!S.lineupManual) S.lineupManual = {};
    if (!S.lineupManual[w]) S.lineupManual[w] = {};
    if (!S.lineupManual[w][teamId]) S.lineupManual[w][teamId] = {};
    return S.lineupManual[w][teamId];
  }
  function setSlot(week, teamId, slotKey, pid, manual) {
    var L = getLineup(week, teamId), M = manualMap(week, teamId);
    /* a player can only occupy one slot */
    for (var k in L) {
      if (L[k] === pid && k !== slotKey) { delete L[k]; delete M[k]; }
    }
    if (pid) L[slotKey] = pid; else delete L[slotKey];
    if (manual) { if (pid) M[slotKey] = 1; else delete M[slotKey]; }
    save(); return L;
  }
  function isManual(week, teamId, slotKey) { return !!manualMap(week, teamId)[slotKey]; }
  function clearManual(week, teamId) {
    var w = String(week);
    if (S.lineupManual && S.lineupManual[w]) delete S.lineupManual[w][teamId];
    save();
  }
  /* Write an auto-generated lineup in, leaving every hand-picked slot alone.
     Returns how many slots it actually changed. */
  function applyAuto(week, teamId, slots) {
    var L = getLineup(week, teamId), M = manualMap(week, teamId);
    var keys = slotKeys(), i, changed = 0, taken = {};
    for (i = 0; i < keys.length; i++) {
      var k = keys[i].key;
      if (M[k] && L[k]) taken[L[k]] = 1;      /* manual picks hold their player */
    }
    for (i = 0; i < keys.length; i++) {
      var key = keys[i].key;
      if (M[key]) continue;                    /* his choice, not ours */
      var want = slots[key] || null;
      if (want && taken[want]) want = null;    /* already locked into a manual slot */
      if ((L[key] || null) === want) { if (want) taken[want] = 1; continue; }
      if (want) { L[key] = want; taken[want] = 1; } else delete L[key];
      changed++;
    }
    if (changed) save();
    return changed;
  }
  /* Copy last week's lineup forward — the single most-used convenience. */
  function copyLineup(fromWeek, toWeek, teamId) {
    var src = getLineup(fromWeek, teamId), dst = getLineup(toWeek, teamId), k;
    for (k in src) if (Object.prototype.hasOwnProperty.call(src, k)) dst[k] = src[k];
    save(); return dst;
  }

  /* --- matchups ----------------------------------------------------- */
  function getMatchups(week) {
    var w = String(week); if (!S.matchups[w]) S.matchups[w] = [];
    return S.matchups[w];
  }
  function setMatchups(week, pairs) { S.matchups[String(week)] = pairs; save(); }
  function addMatchup(week, a, b) {
    var m = getMatchups(week);
    /* a team appears at most once per week */
    for (var i = m.length - 1; i >= 0; i--)
      if (m[i][0] === a || m[i][1] === a || m[i][0] === b || m[i][1] === b) m.splice(i, 1);
    m.push([a, b]); save(); return m;
  }

  /* --- stats -------------------------------------------------------- */
  function getStats(week) { var w = String(week); if (!S.stats[w]) S.stats[w] = {}; return S.stats[w]; }
  function setLine(week, pid, line) { getStats(week)[pid] = line; }
  function lineFor(week, pid) {
    var st = getStats(week);
    return st[pid] ? st[pid] : null;
  }

  /* --- scoring roll-ups --------------------------------------------- */
  function playerPoints(week, pid) {
    var l = lineFor(week, pid);
    return l ? root.Scoring.score(l).total : 0;
  }
  /* Points for a team in a week, counting ONLY the players in starting slots.
   * A blank slot or a bye-week starter scores 0, per the rules. */
  function teamWeekPoints(week, teamId) {
    var L = getLineup(week, teamId), keys = slotKeys(), i, total = 0, detail = [];
    for (i = 0; i < keys.length; i++) {
      var pid = L[keys[i].key], pts = 0, p = null, onBye = false;
      if (pid) {
        var rec = playerById(pid);
        p = rec ? rec.player : null;
        if (p && p.bye === Number(week)) onBye = true;
        pts = onBye ? 0 : playerPoints(week, pid);
      }
      total += pts;
      detail.push({ slot: keys[i].label, pid: pid || null, player: p,
                    pts: Math.round(pts * 100) / 100, onBye: onBye,
                    played: !!(pid && lineFor(week, pid) && lineFor(week, pid).played) });
    }
    return { total: Math.round(total * 100) / 100, detail: detail };
  }
  function seasonTotals(throughWeek) {
    var last = throughWeek || S.league.regularSeasonWeeks;
    var out = {}, i, w;
    for (i = 0; i < S.teams.length; i++) out[S.teams[i].id] = { pts: 0, w: 0, l: 0, t: 0, weeks: {} };
    for (w = 1; w <= last; w++) {
      var mus = getMatchups(w), got = {};
      for (i = 0; i < S.teams.length; i++) {
        var tid = S.teams[i].id, r = teamWeekPoints(w, tid);
        got[tid] = r.total;
        out[tid].pts += r.total; out[tid].weeks[w] = r.total;
      }
      for (i = 0; i < mus.length; i++) {
        var a = mus[i][0], b = mus[i][1];
        if (!out[a] || !out[b]) continue;
        if (!weekIsScored(w)) continue;
        if (got[a] > got[b]) { out[a].w++; out[b].l++; }
        else if (got[b] > got[a]) { out[b].w++; out[a].l++; }
        else { out[a].t++; out[b].t++; }
      }
    }
    for (i = 0; i < S.teams.length; i++) out[S.teams[i].id].pts = Math.round(out[S.teams[i].id].pts * 100) / 100;
    return out;
  }
  function weekIsScored(week) {
    var m = S.weekMeta[String(week)];
    return !!(m && m.synced && m.allFinal);
  }
  function standings(throughWeek) {
    var t = seasonTotals(throughWeek), rows = [], i;
    for (i = 0; i < S.teams.length; i++) {
      var id = S.teams[i].id;
      rows.push({ id: id, name: S.teams[i].name, pts: t[id].pts, w: t[id].w, l: t[id].l, t: t[id].t });
    }
    rows.sort(function (x, y) {
      if (y.w !== x.w) return y.w - x.w;
      return y.pts - x.pts;
    });
    for (i = 0; i < rows.length; i++) rows[i].rankWL = i + 1;
    var byPts = rows.slice().sort(function (x, y) { return y.pts - x.pts; });
    for (i = 0; i < byPts.length; i++) byPts[i].rankPts = i + 1;
    return { byRecord: rows, byPoints: byPts };
  }

  /* --- backup ------------------------------------------------------- */
  function exportJSON() { return JSON.stringify(S, null, 1); }
  /* v3.7: this used to assign S = o and THEN call save(), which touches
     S.settings.savedAt — so a backup with no settings key threw a TypeError
     *after* the live season had already been replaced in memory. The catch
     reported failure while the damage was done. It also skipped init()'s
     settings migration, so an old backup came back missing keys added since.
     Validate everything first, migrate onto a copy, and only then swap. */
  function importJSON(txt) {
    var o = JSON.parse(txt);
    if (!o || typeof o !== 'object') throw new Error('not a tracker backup');
    if (!o.teams || !o.teams.length) throw new Error('no teams in that file');
    var i;
    for (i = 0; i < o.teams.length; i++) {
      if (!o.teams[i] || !o.teams[i].id || !o.teams[i].players) {
        throw new Error('team ' + (i + 1) + ' is malformed');
      }
    }
    if (!o.league) throw new Error('no league settings in that file');
    /* fill in anything this build expects and that save is missing, on the
       CANDIDATE, so a half-migrated object is never the live one */
    if (!o.byes) o.byes = S.byes;
    if (!o.lineups) o.lineups = {};
    if (!o.lineupManual) o.lineupManual = {};
    if (!o.stats) o.stats = {};
    if (!o.book) o.book = {};
    if (!o.weekMeta) o.weekMeta = {};
    if (!o.transactions) o.transactions = [];
    if (!o.settings) o.settings = {};
    var cur = S.settings || {}, k;
    for (k in cur) {
      if (Object.prototype.hasOwnProperty.call(cur, k) && o.settings[k] === undefined) {
        o.settings[k] = cur[k];
      }
    }
    S = o; bumpGen(); save(); return true;
  }
  function resetToSeed(seed) { S = fromSeed(seed); save(); return S; }

  /* ---- THE LEAGUE BOOK ---------------------------------------------------
   * Every player ESPN reported in a week, not just the ~170 who are rostered.
   * The free-agent board, the usage trend and the trade valuer all need
   * production for players nobody in this league owns, and refetching sixteen
   * box scores to get it would be absurd. Deliberately COMPACT: full stat
   * lines for 500 players would be ~150KB a week and the entire state is
   * rewritten on every save.
   *   key = Espn.normName(displayName)
   *   row = { n:name, t:teamAbbr, p:leaguePoints, pa:passAtt, cr:carries, tg:targets }
   * Points are ALWAYS this league's points — the row is written from
   * Scoring.score(), never from anyone else's total. */
  function setBook(week, rows) { S.book[String(week)] = rows; }
  function bookWeek(week) { var w = String(week); return S.book[w] || {}; }
  /* the last n scored weeks for one normalised name, most recent first */
  function bookTrend(key, throughWeek, n) {
    var out = [], w;
    for (w = throughWeek; w >= 1 && out.length < (n || 3); w--) {
      var row = bookWeek(w)[key];
      if (row) out.push({ week: w, row: row });
      else if (weekIsScored(w)) out.push({ week: w, row: null });
    }
    return out;
  }
  /* every name the book has ever seen, with its most recent team abbr */

  /* NOT dead code, despite a review saying so: tools/test_engine.js is the
     caller, which is exactly the sort of caller a grep over app/assets/ misses.
     Kept, and this comment exists so it does not get deleted a second time. */
  function bookNames(throughWeek) {
    var seen = {}, w, k;
    for (w = 1; w <= throughWeek; w++) {
      var bw = bookWeek(w);
      for (k in bw) {
        if (!Object.prototype.hasOwnProperty.call(bw, k)) continue;
        if (!seen[k]) seen[k] = { name: bw[k].n, abbr: bw[k].t, weeks: 0, pts: 0 };
        seen[k].abbr = bw[k].t;
        seen[k].weeks++; seen[k].pts += (bw[k].p || 0);
      }
    }
    return seen;
  }
  root.Store = { generation: function () { return _gen; },
    init: init, get: get, save: save, team: team, allPlayers: allPlayers,
    playerById: playerById, addPlayer: addPlayer, removePlayer: removePlayer,
    slotKeys: slotKeys, eligible: eligible,
    getLineup: getLineup, setSlot: setSlot, copyLineup: copyLineup,
    isManual: isManual, clearManual: clearManual, applyAuto: applyAuto,
    getMatchups: getMatchups, setMatchups: setMatchups, addMatchup: addMatchup,
    getStats: getStats, setLine: setLine, lineFor: lineFor,
    playerPoints: playerPoints, teamWeekPoints: teamWeekPoints,
    seasonTotals: seasonTotals, standings: standings, weekIsScored: weekIsScored,
    exportJSON: exportJSON, importJSON: importJSON, resetToSeed: resetToSeed,
    autoBackup: autoBackup,
    setBook: setBook, bookWeek: bookWeek, bookTrend: bookTrend, bookNames: bookNames
  };
})(typeof window !== 'undefined' ? window : this);
