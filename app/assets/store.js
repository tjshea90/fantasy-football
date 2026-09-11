/* store.js — data model + persistence. ES2018 only.
 * Persists through the Native bridge when present, localStorage otherwise.
 */
(function (root) {
  'use strict';
  var KEY = 'fftracker_state_v1';
  /* THE ARCHIVE — the two big, rarely-changing halves of the state (v4.7).
   *
   * Store.save() used to serialise the ENTIRE state and hand it to
   * Native.save, which is a SYNCHRONOUS bridge call doing a write, an fsync
   * and two renames on the renderer's JS thread — the blocking-bridge pattern
   * BRIEF.md forbids. And it grew all season. Measured on the real roster at
   * 14 scored weeks:
   *
   *     whole state ........ 1,969,809 chars   (~1.9 MB, written EVERY save)
   *       league book ......   849 KB   44%    changes only on a sync
   *       weekly stat lines  1,046 KB   54%    changes only on a sync
   *       everything else ..    25 KB    1.3%  ALL a lineup edit touches
   *
   * Callers include setSlot on every dropdown change, applyAuto across all ten
   * teams, and Schedule.ingest whenever a game changes state during a Sunday.
   * So changing one dropdown in November wrote 1.9 MB, of which 25 KB could
   * possibly have differed.
   *
   * book and stats now live in their own file and are written only when a sync
   * actually changes them. In memory S is unchanged — it still carries both,
   * so every reader, the auto-backup and the export are untouched. A lineup
   * edit now writes ~25 KB instead of ~1.9 MB.
   *
   * WHY TWO FILES AND NOT THREE. The archive can be a sync behind the main
   * state if the app dies between the two writes, and that is recoverable: the
   * dirty flag survives in memory, the next save retries, and a re-sync of the
   * week rebuilds both halves. Splitting further only multiplies the windows.
   * The main file keeps its own .bak in Java, and so does this one.
   *
   * Alerts.java reads teams, lineups, weekMeta, byes and settings out of the
   * main file. None of those moved. */
  var ARCHIVE_KEY = 'fftracker_archive_v1';
  var S = null;
  var archiveDirty = false;

  function nowISO() { return new Date().toISOString(); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function readKey(k) {
    try {
      if (root.Native && root.Native.load) { var s = root.Native.load(k); return s ? JSON.parse(s) : null; }
      var t = root.localStorage.getItem(k); return t ? JSON.parse(t) : null;
    } catch (e) { return null; }
  }
  /* Returns TRUE only if the write actually landed. Native.save returns a
     boolean and catches its own exceptions; this used to call it, throw the
     result away and return true unconditionally — so a full disk or a failed
     rename was reported as a successful save, and save()'s
     `if (ok && saveCount % 10)` auto-backup gate was testing a constant. */
  function writeKey(k, obj) {
    try {
      var s = JSON.stringify(obj);
      if (root.Native && root.Native.save) return root.Native.save(k, s) !== false;
      root.localStorage.setItem(k, s); return true;
    } catch (e) { return false; }
  }

  function rawLoad() {
    var main = readKey(KEY);
    if (!main) return null;
    var arch = readKey(ARCHIVE_KEY);
    if (arch && typeof arch === 'object') {
      /* the archive is authoritative when present */
      if (arch.book) main.book = arch.book;
      if (arch.stats) main.stats = arch.stats;
    }
    /* ≤v4.6 wrote book and stats inside the main file. Nothing to do — they
       are already on `main`, and the first save writes the archive out. */
    if (!main.book) main.book = {};
    if (!main.stats) main.stats = {};
    return main;
  }
  /* The main file carries everything EXCEPT the two archive halves. They are
     spliced out for the write and put straight back, so `S` is never observed
     without them by anything else on this thread. */
  function rawSave(obj) {
    var book = obj.book, stats = obj.stats, ok;
    try {
      obj.book = undefined; obj.stats = undefined;
      ok = writeKey(KEY, obj);
    } finally {
      obj.book = book; obj.stats = stats;
    }
    if (ok && archiveDirty) {
      if (writeKey(ARCHIVE_KEY, { book: book, stats: stats })) archiveDirty = false;
      else ok = false;   /* retried on the next save; the flag stays set */
    }
    return ok;
  }
  /* Every path that changes a scored week or the league book calls this. */
  function markArchive() { archiveDirty = true; }

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
      aiFreshDays: 3           /* a clear verdict stays good this long */
      /* individualReturnTD was here until v4.7. Tj settled the rules-sheet
         ambiguity ("a defense touchdown is only scored one time") and the
         setting is gone, not defaulted — see the note in scoring.js. An old
         saved state may still carry the key; nothing reads it. */
    };
  }

  function init(seed) {
    S = rawLoad();
    if (!S || !S.teams || !S.teams.length) { S = fromSeed(seed); markArchive(); save(); }
    /* A state loaded from a ≤v4.6 save still has book and stats inside the
       MAIN file. Writing the archive once on the next save splits them out;
       until then rawLoad's fallback keeps reading them from where they are. */
    if (!readKey(ARCHIVE_KEY)) markArchive();
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
    /* v4.7: nothing to configure any more — the scoring rules are fixed at
       load and cannot be changed at runtime, which is what makes score()'s
       memo safe. A stale `individualReturnTD` key on an old save is inert. */
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
      /* The timestamp is recorded in memory and rides out on the NEXT ordinary
         save. It used to call rawSave() right here, so every auto-backup was
         two full serialisations and two writes back to back — the snapshot,
         then the whole state again, to store one date string. */
      if (ok) S.settings.autoBackupAt = nowISO();
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
  /* --- KICKOFF LOCKS (v4.7) -------------------------------------------
   * THE BUG THIS EXISTS TO STOP. autoLineup ranks a roster on PROJECTIONS and
   * has no concept of time, so a player who had already played and banked 33
   * real points was compared on his 6.2 preseason number and lost his slot to
   * somebody who had not kicked off yet. applyAuto then overwrote him, because
   * the only thing it protected was a slot set by hand — and a slot the app
   * filled itself is not one of those.
   *
   * That was not a rare path. autoFillWeek runs on boot, on every week change,
   * and after EVERY sync including the quiet 45-second live poll, for all ten
   * teams. So it fired repeatedly, on its own, all Sunday afternoon, and the
   * team total silently dropped by whatever the benched player had scored —
   * carrying the live matchup, the head-to-head result, the weekly most-points
   * book and the season points title with it.
   *
   * Real lock semantics, both directions: once a player's game has started he
   * can neither be REMOVED from a slot nor ADDED to one.
   *
   * A MANUAL edit is still allowed through — deliberately. This app mirrors a
   * league actually run on RTSports, so Tj sometimes has to correct a slot
   * after the fact to match what RTSports really had. The lock binds the
   * AUTOMATION, which is the thing that was silently wrong; his own hands are
   * his business, and the UI marks the slot so he can see what he is doing. */
  function gameStarted(week, player) {
    if (!player || !player.nfl) return false;
    var m = S.weekMeta[String(week)];
    var g = (m && m.games) ? m.games[String(player.nfl).toUpperCase()] : null;
    if (!g) return false;                       /* no schedule stored: never guess */
    if (g.state && g.state !== 'pre') return true;
    var t = Date.parse(g.kick);                 /* 'pre' but the clock has passed */
    return isFinite(t) && t <= Date.now();
  }
  /* Locked = he has produced stats, or his game has started. The stat line is
     checked first because it is the one signal that cannot be wrong: if the
     feed gave him a line, he played. */
  function isLocked(week, pid) {
    if (!pid) return false;
    var l = lineFor(week, pid);
    if (l && l.played) return true;
    var rec = playerById(pid);
    return gameStarted(week, rec ? rec.player : null);
  }
  /* slotKey -> true, for the UI's padlock. */
  function lockedSlots(week, teamId) {
    var L = getLineup(week, teamId), out = {}, k;
    for (k in L) {
      if (Object.prototype.hasOwnProperty.call(L, k) && isLocked(week, L[k])) out[k] = true;
    }
    return out;
  }

  /* Write an auto-generated lineup in, leaving every hand-picked slot alone —
     and every slot whose player has already kicked off.
     Returns how many slots it actually changed. */
  function applyAuto(week, teamId, slots) {
    var L = getLineup(week, teamId), M = manualMap(week, teamId);
    var keys = slotKeys(), i, changed = 0, taken = {};
    for (i = 0; i < keys.length; i++) {
      var k = keys[i].key;
      /* manual picks AND started players hold their player: neither can be
         moved, so the man in the slot is unavailable to every other slot */
      if (L[k] && (M[k] || isLocked(week, L[k]))) taken[L[k]] = 1;
    }
    for (i = 0; i < keys.length; i++) {
      var key = keys[i].key;
      if (M[key]) continue;                    /* his choice, not ours */
      if (L[key] && isLocked(week, L[key])) continue;   /* kicked off — untouchable */
      var want = slots[key] || null;
      if (want && taken[want]) want = null;    /* already held by another slot */
      if (want && isLocked(week, want)) want = null;    /* cannot start him now */
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
  function getStats(week) {
    var w = String(week);
    if (!S.stats[w]) { S.stats[w] = {}; markArchive(); }
    return S.stats[w];
  }
  function setLine(week, pid, line) { getStats(week)[pid] = line; markArchive(); }
  function lineFor(week, pid) {
    var st = getStats(week);
    return st[pid] ? st[pid] : null;
  }

  /* --- byes ---------------------------------------------------------
   * ONE ANSWER, because there were three. Alerts.java falls back to the
   * league's bye table when a player's own `bye` is 0; teamWeekPoints and
   * recommend.js read `p.bye` alone. A player added mid-season without a bye
   * therefore scored normally in the app and was flagged by the notification —
   * two parts of the same app disagreeing about whether he plays. */
  function isOnBye(player, week) {
    if (!player) return false;
    var b = Number(player.bye);
    if (!b && S.byes && player.nfl) b = Number(S.byes[String(player.nfl).toUpperCase()]) || 0;
    return !!b && b === Number(week);
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
        if (isOnBye(p, week)) onBye = true;
        pts = onBye ? 0 : playerPoints(week, pid);
      }
      total += pts;
      detail.push({ slot: keys[i].label, pid: pid || null, player: p,
                    pts: Math.round(pts * 100) / 100, onBye: onBye,
                    played: !!(pid && lineFor(week, pid) && lineFor(week, pid).played) });
    }
    return { total: Math.round(total * 100) / 100, detail: detail };
  }
  function weekIsScored(week) {
    var m = S.weekMeta[String(week)];
    return !!(m && m.synced && m.allFinal);
  }

  /* --- backup ------------------------------------------------------- */
  /* THE API KEY NEVER LEAVES IN A BACKUP (v4.7).
   *
   * This serialised the whole state, aiKey and all, and the Export backup
   * button hands that straight to NativeBridge.export, which writes it to the
   * PUBLIC Downloads folder — readable by any app with media access, and the
   * one file you would move to a PC or send to somebody. A live
   * sk-ant-... key in cleartext, in Downloads, forever.
   *
   * Redacted here rather than at the button, so every future caller of
   * exportJSON is safe by construction. importJSON keeps whatever key is
   * already on the phone (see below), so a redacted backup restores cleanly
   * and the key simply is not part of what travels. */
  function exportJSON() {
    var keep = S.settings ? S.settings.aiKey : undefined;
    var out;
    try {
      if (S.settings) S.settings.aiKey = '';
      out = JSON.stringify(S, null, 1);
    } finally {
      if (S.settings) S.settings.aiKey = keep;
    }
    return out;
  }
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
    /* Backups no longer carry the API key (see exportJSON), so a restore must
       not wipe the one already on this phone. An empty key in the file means
       "not included", never "clear it". */
    if (!o.settings.aiKey && cur.aiKey) o.settings.aiKey = cur.aiKey;
    S = o; bumpGen(); markArchive(); save(); return true;
  }
  function resetToSeed(seed) { S = fromSeed(seed); markArchive(); save(); return S; }

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
  function setBook(week, rows) { S.book[String(week)] = rows; markArchive(); }
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
    isLocked: isLocked, lockedSlots: lockedSlots, gameStarted: gameStarted,
    getMatchups: getMatchups, setMatchups: setMatchups, addMatchup: addMatchup,
    getStats: getStats, setLine: setLine, lineFor: lineFor,
    playerPoints: playerPoints, teamWeekPoints: teamWeekPoints, isOnBye: isOnBye,
    seasonTotals: seasonTotals, standings: standings, weekIsScored: weekIsScored,
    exportJSON: exportJSON, importJSON: importJSON, resetToSeed: resetToSeed,
    autoBackup: autoBackup,
    setBook: setBook, bookWeek: bookWeek, bookTrend: bookTrend, bookNames: bookNames
  };
})(typeof window !== 'undefined' ? window : this);
