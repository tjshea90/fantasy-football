/* schedule.js — when does each of my players actually play? (v4.5)
 *
 * WHAT TJ ASKED FOR
 * -----------------
 * "somehow incorporate in the app in a way that is easy for me to understand,
 *  the day and time each of the players on all rosters are going to play that
 *  week (maybe next to each players name). this should refresh often so that
 *  scheduling changes are reflected, but it only needs the schedule for the
 *  current week of upcoming games."
 *
 * "it should also give me alerts that are easy to see about players on my
 *  roster that will be playing before the upcoming NFL Sunday, so I don't
 *  forget to turn in my roster for those players which play early in the week,
 *  usually on Thursday."
 *
 * WHERE THE DATA COMES FROM — AND WHY THIS COSTS NOTHING
 * -----------------------------------------------------
 * `Espn.weekGames(season, week)` returns every game with its kickoff time and
 * both teams. The live poll in ui.js ALREADY calls it, every single tick, to
 * decide whether anything is in progress — and then threw the kickoff times
 * away. So the whole feature rides on requests the app was already making:
 * `ingest()` is handed the games the poll just fetched, and `refresh()` only
 * goes to the network when nothing has ingested recently. Adding a second
 * schedule fetch alongside the poll would have doubled the request rate for
 * data the app already had in hand.
 *
 * WHAT "BEFORE SUNDAY" MEANS HERE
 * -------------------------------
 * The alert exists so Tj does not miss a Thursday (or, this week, a Wednesday)
 * kickoff with a player still on his bench. The rule is deliberately about the
 * LOCAL weekday of kickoff, not an offset from some computed week boundary:
 * Tuesday through Saturday is early, Sunday and Monday are not. That covers
 * Thursday night, the Wednesday opener, the Friday Black-Friday game and the
 * Saturday doubleheaders in December — every case where a lineup is due before
 * the day he thinks of as game day. Computing it from the phone's own clock is
 * also the only way it can be right for him: a kickoff is a moment in time, and
 * which day it falls on depends on where he is standing.
 */
(function (root) {
  'use strict';

  /* Sunday = 0. Tue-Sat are the days a lineup can be due before "game day". */
  var EARLY_DAYS = { 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 };
  /* How old the stored schedule may get before it is worth refetching.
     Kickoff times move rarely (flex scheduling, weather) but they DO move, and
     the cost of being wrong is a missed lineup. 3 hours is often enough to
     catch a flex change the day it is announced and rare enough that it is a
     handful of requests a day. */
  var STALE_MS = 3 * 3600 * 1000;

  function meta(week) {
    var S = root.Store.get();
    var w = String(week);
    if (!S.weekMeta[w]) S.weekMeta[w] = {};
    return S.weekMeta[w];
  }

  /* ---- ingest: the games the live poll already fetched -------------------- */
  function ingest(week, games) {
    if (!games || !games.length) return null;
    var m = meta(week), byTeam = {}, i, k;
    for (i = 0; i < games.length; i++) {
      var g = games[i];
      if (!g || !g.date || !g.teams) continue;
      for (k = 0; k < g.teams.length; k++) {
        var t = g.teams[k];
        if (!t || !t.abbr) continue;
        var other = g.teams[1 - k] || {};
        byTeam[String(t.abbr).toUpperCase()] = {
          kick: g.date,
          state: g.state || 'pre',
          detail: g.detail || '',
          home: t.homeAway === 'home',
          opp: String(other.abbr || '').toUpperCase()
        };
      }
    }
    /* ONLY SAVE IF SOMETHING ACTUALLY CHANGED.
     *
     * `ingest` is called from the live poll, which on a Sunday runs every 45
     * seconds. `Store.save()` serialises the ENTIRE season — every team, every
     * lineup, every scored week and the league book, which carries a row for
     * every player ESPN reported — and writes it to disk through the bridge.
     * Doing that every 45 seconds to re-record kickoff times that had not moved
     * is exactly the kind of background churn Tj asked me to find: disk, CPU
     * and battery, for no new information.
     *
     * The signature is deliberately over the fields that matter (kickoff and
     * state) rather than a JSON.stringify of the whole map, so a reordered
     * response does not read as a change. */
    var sig = [], key;
    var keys = [];
    for (key in byTeam) {
      if (Object.prototype.hasOwnProperty.call(byTeam, key)) keys.push(key);
    }
    keys.sort();
    for (i = 0; i < keys.length; i++) {
      sig.push(keys[i] + byTeam[keys[i]].kick + byTeam[keys[i]].state);
    }
    var joined = sig.join('|');
    m.games = byTeam;
    m.schedAt = Date.now();
    if (m.schedSig === joined) return byTeam;   /* nothing moved — no write */
    m.schedSig = joined;
    /* Persisted deliberately: Alerts.java reads this same state file with no
       WebView available, so a kickoff time saved here is a kickoff time the
       background alarm can reason about. */
    root.Store.save();
    return byTeam;
  }

  function get(week) { return meta(week).games || null; }
  function at(week) { return meta(week).schedAt || 0; }
  function stale(week) {
    var g = get(week);
    if (!g) return true;
    return (Date.now() - at(week)) > STALE_MS;
  }

  /* An explicit fetch, for when the live poll is not running (it is off, or the
     week is already final) and the stored copy has gone stale. */
  function refresh(week, force) {
    var S = root.Store.get();
    if (!force && !stale(week)) {
      return Promise.resolve(get(week));
    }
    return root.Espn.weekGames(S.settings.season, week, week > 18 ? 3 : 2)
      .then(function (games) { return ingest(week, games); });
  }

  /* ---- reading it ---------------------------------------------------------- */
  function forTeam(nfl, week) {
    var g = get(week);
    if (!g || !nfl) return null;
    return g[String(nfl).toUpperCase()] || null;
  }

  /* ES2018-safe, and tolerant of a WebView whose Intl is thin. */
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function clock(d) {
    var h = d.getHours(), mm = d.getMinutes();
    var ap = h >= 12 ? 'p' : 'a';
    h = h % 12; if (h === 0) h = 12;
    return h + (mm ? ':' + (mm < 10 ? '0' + mm : mm) : '') + ap;
  }

  /* The badge that sits next to a player's name.
     `text`  — "Thu 8:20p", "LIVE", "final"
     `early` — kicks off before Sunday, i.e. the lineup is due sooner than he
               probably thinks. This is what the UI colours. */
  function badge(nfl, week) {
    var g = forTeam(nfl, week);
    if (!g) return null;
    var d = new Date(g.kick);
    if (isNaN(d.getTime())) return null;
    var day = d.getDay();
    var out = {
      kick: g.kick, at: d.getTime(), day: day,
      early: !!EARLY_DAYS[day],
      state: g.state,
      opp: (g.home ? 'vs ' : '@ ') + g.opp,
      text: DAYS[day] + ' ' + clock(d)
    };
    if (g.state === 'in') { out.text = 'LIVE'; out.live = true; out.early = false; }
    else if (g.state === 'post') { out.text = 'final'; out.done = true; out.early = false; }
    else if (out.at < Date.now()) { out.text = DAYS[day] + ' ' + clock(d); out.early = false; }
    return out;
  }

  /* ---- the alert ----------------------------------------------------------
   * Everyone on `teamId` whose game kicks off before Sunday and has not
   * started yet, split into who is currently in the starting lineup and who
   * the app would recommend. That split is the whole point: "you have players
   * on Thursday" is a reminder, "you have players on Thursday and two of them
   * are on your bench" is the thing that saves a week. */
  /* MEMOISED, because this is not a cheap read. `bestLineup` walks the whole
     roster through projectOne — projections, matchup, health, the AI cache —
     and the alert card is built on EVERY render of Live, Lineups and Advice.
     The Live tab re-renders on every poll tick. The key covers everything that
     can change the answer: the week, the store generation (any lineup or roster
     edit bumps it), and when the schedule was last ingested. The minute bucket
     is there so "is this kickoff still in the future" cannot go stale for
     longer than a minute. */
  var _alertMemo = null;
  function earlyAlert(week, teamId, opponents) {
    var gen = root.Store.generation ? root.Store.generation() : 0;
    var key = week + '|' + teamId + '|' + gen + '|' + at(week) + '|' +
              Math.floor(Date.now() / 60000);
    if (_alertMemo && _alertMemo.key === key) return _alertMemo.val;
    var val = earlyAlertUncached(week, teamId, opponents);
    _alertMemo = { key: key, val: val };
    return val;
  }
  function earlyAlertUncached(week, teamId, opponents) {
    var g = get(week);
    if (!g) return null;
    var t = root.Store.team(teamId);
    if (!t) return null;
    var lineup = root.Store.getLineup(week, teamId);
    var started = {}, k;
    for (k in lineup) {
      if (Object.prototype.hasOwnProperty.call(lineup, k)) started[lineup[k]] = k;
    }
    /* what the app would start, so the alert can name a fix rather than only a
       problem. Wrapped: a recommender failure must not cost the reminder. */
    var rec = {};
    try {
      var picks = root.Recommend.bestLineup(week, teamId, opponents || null);
      for (k = 0; k < picks.length; k++) {
        if (picks[k] && picks[k].pick && picks[k].pick.p) {
          rec[picks[k].pick.p.id] = picks[k].label || picks[k].key || '';
        }
      }
    } catch (e) { /* no recommendation available; the times are still right */ }

    var now = Date.now(), rows = [], i, soonest = 0;
    for (i = 0; i < t.players.length; i++) {
      var p = t.players[i];
      var b = badge(p.nfl, week);
      if (!b || !b.early) continue;
      if (b.at <= now) continue;             /* already kicked off — too late to matter */
      rows.push({
        id: p.id, name: p.name, pos: p.pos, nfl: p.nfl,
        when: b.text, at: b.at, opp: b.opp,
        starting: !!started[p.id],
        slot: started[p.id] || '',
        recommended: !!rec[p.id],
        recSlot: rec[p.id] || ''
      });
      if (!soonest || b.at < soonest) soonest = b.at;
    }
    if (!rows.length) return null;
    rows.sort(function (a, b2) { return a.at - b2.at || a.name.localeCompare(b2.name); });
    var benched = [], starting = [];
    for (i = 0; i < rows.length; i++) {
      if (rows[i].starting) starting.push(rows[i]); else benched.push(rows[i]);
    }
    /* only the benched-but-recommended are ACTIONABLE — the rest is context */
    var shouldStart = [];
    for (i = 0; i < benched.length; i++) if (benched[i].recommended) shouldStart.push(benched[i]);
    return {
      week: week, rows: rows, starting: starting, benched: benched,
      shouldStart: shouldStart, soonest: soonest,
      hoursLeft: Math.max(0, Math.round((soonest - now) / 3600000))
    };
  }

  root.Schedule = {
    ingest: ingest, refresh: refresh, get: get, at: at, stale: stale,
    forTeam: forTeam, badge: badge, earlyAlert: earlyAlert,
    STALE_MS: STALE_MS, _clock: clock, _DAYS: DAYS
  };
})(typeof window !== 'undefined' ? window : this);
