/* projections.js — outside projections, re-scored under THIS league's rules.
 * ES2018 only (Android 10 WebView): no ?. no ?? no .at() no async/await.
 *
 * WHY THIS FILE EXISTS
 * Every public projection you can get is scored for somebody else's league.
 * FantasyPros, Yahoo and ESPN all pay 0 for a completion; this league pays 1,
 * which is worth roughly 20-24 points a week to a starting QB. So an imported
 * "projected points" number is worthless here. What IS useful is the projected
 * STAT LINE — attempts, completions, yards, touchdowns — because that can be
 * run through scoring.js and come out in this league's currency.
 *
 * That is all this file does: fetch projected raw stats, convert them with the
 * same engine that scores real games, and hand back a number that means the
 * same thing as everything else in the app.
 *
 * SOURCE: ESPN's fantasy player endpoint, which exposes per-week projected
 * stat lines keyed by ESPN's numeric stat ids. It needs an X-Fantasy-Filter
 * request header, which is why NativeBridge grew httpGetH.
 */
(function (root) {
  'use strict';

  var HOST = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/';
  var KEY = 'fftracker_proj_v2';

  /* ESPN fantasy stat ids. Verified against espn-api's constant.py.
   * Only the ids this league actually pays for are listed — note that 106
   * (forced fumbles) is deliberately absent, because this league does not
   * score forced fumbles, only recoveries (96). */
  var ID = {
    passCmp: 1, passYds: 3, passTD: 4, pass2Pt: 19, passInt: 20,
    rushYds: 24, rushTD: 25, rush2Pt: 26,
    rec: 41, recAlt: 53, recYds: 42, recTD: 43, rec2Pt: 44,
    fumLost: 72,
    fgMade50: 74, fgMiss50: 76, fgMade4049: 77, fgMiss4049: 79,
    fgMadeU40: 80, fgMissU40: 82, fgMade60: 201, fgMiss60: 203,
    xpMade: 86, xpAtt: 87,
    defTD: 94, defInt: 95, defFumRec: 96, defBlockTD: 93,
    defSafety: 98, defSack: 99,
    koRetTD: 101, puntRetTD: 102, intRetTD: 103, fumRetTD: 104, defStTD: 105,
    paA: 120, paB: 187
  };

  var cache = { at: 0, week: 0, season: 0, byName: {}, count: 0, error: '', route: '' };

  function n(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  function g(s, id) { return s && s[String(id)] !== undefined ? n(s[String(id)]) : 0; }

  function loadCache() {
    try {
      var s = (root.Native && root.Native.load) ? root.Native.load(KEY)
              : root.localStorage.getItem(KEY);
      if (s) { var o = JSON.parse(s); if (o && o.byName) cache = o; }
    } catch (e) { /* cache is optional */ }
    return cache;
  }
  function saveCache() {
    try {
      var s = JSON.stringify(cache);
      if (root.Native && root.Native.save) root.Native.save(KEY, s);
      else root.localStorage.setItem(KEY, s);
    } catch (e) { /* cache is optional */ }
  }

  /* ---- projected stats -> this league's points ------------------------
   * Everything except kicking goes through Scoring.score(), so it cannot
   * drift from how real games are scored. Kicking is done arithmetically
   * because a projection is fractional ("1.4 field goals made") and the game
   * scorer takes discrete kicks with real distances. The distance BANDS are
   * read straight out of Scoring.RULES, not retyped. */
  function scoreProjected(stats, pos) {
    var Sc = root.Scoring;
    var L = Sc.emptyLine();
    L.played = true;
    if (pos === 'DEF') {
      L.dst.sacks = g(stats, ID.defSack);
      L.dst.int = g(stats, ID.defInt);
      L.dst.fr = g(stats, ID.defFumRec);
      var dtd = g(stats, ID.defTD);
      if (!dtd) dtd = g(stats, ID.intRetTD) + g(stats, ID.fumRetTD) + g(stats, ID.defBlockTD);
      var rtd = g(stats, ID.koRetTD) + g(stats, ID.puntRetTD);
      if (!dtd && !rtd) { dtd = g(stats, ID.defStTD); }   /* combined-only feed */
      L.dst.defTD = dtd;
      L.dst.retTD = rtd;
      L.dst.safety = g(stats, ID.defSafety);
      var pa = stats[String(ID.paA)] !== undefined ? g(stats, ID.paA) : g(stats, ID.paB);
      L.dst.pointsAllowed = Math.round(pa);
      return { pts: Sc.score(L).total, line: L };
    }
    if (pos === 'K') {
      var made60 = g(stats, ID.fgMade60);
      var made50 = Math.max(0, g(stats, ID.fgMade50) - made60);   /* 50+ includes 60+ */
      var made4049 = g(stats, ID.fgMade4049);
      var madeU40 = g(stats, ID.fgMadeU40);
      var miss60 = g(stats, ID.fgMiss60);
      var miss50 = Math.max(0, g(stats, ID.fgMiss50) - miss60);
      var miss4049 = g(stats, ID.fgMiss4049);
      var missU40 = g(stats, ID.fgMissU40);
      /* one representative distance per band, so the tier table in
         Scoring.RULES stays the only place the numbers live */
      var fgPts =
        madeU40 * Sc.fgPoints(30, true) + missU40 * Sc.fgPoints(30, false) +
        made4049 * Sc.fgPoints(45, true) + miss4049 * Sc.fgPoints(45, false) +
        made50 * Sc.fgPoints(55, true) + miss50 * Sc.fgPoints(55, false) +
        made60 * Sc.fgPoints(62, true) + miss60 * Sc.fgPoints(62, false);
      L.kick.xpMade = g(stats, ID.xpMade);
      L.kick.xpAtt = g(stats, ID.xpAtt);
      var base = Sc.score(L).total;
      return { pts: Math.round((base + fgPts) * 100) / 100, line: L, fgPts: fgPts };
    }
    L.pass.cmp = g(stats, ID.passCmp);
    L.pass.yds = g(stats, ID.passYds);
    L.pass.td = g(stats, ID.passTD);
    L.pass.int = g(stats, ID.passInt);
    L.pass.twoPt = g(stats, ID.pass2Pt);
    L.rush.yds = g(stats, ID.rushYds);
    L.rush.td = g(stats, ID.rushTD);
    L.rush.twoPt = g(stats, ID.rush2Pt);
    L.rec.rec = g(stats, ID.rec) || g(stats, ID.recAlt);
    L.rec.yds = g(stats, ID.recYds);
    L.rec.td = g(stats, ID.recTD);
    L.rec.twoPt = g(stats, ID.rec2Pt);
    L.fum.lost = g(stats, ID.fumLost);
    return { pts: root.Scoring.score(L).total, line: L };
  }

  var POS_BY_ID = { 0: 'QB', 2: 'RB', 4: 'WR', 6: 'TE', 16: 'DEF', 17: 'K' };

  /* Filter shapes, tried in order, best result wins.
   *
   * WHAT WEEK 1 TAUGHT US. The 'lean filter' answered and produced 222 usable
   * week lines — but it never ASKS for a scoring period, so ESPN returns
   * whatever stat rows it feels like and only some players carry a projection
   * for the week in question. Matthew Stafford was one of the ones that did
   * not, so a starting QB fell back to his preseason number while the RB beside
   * him had a real week-1 line. That is not a name-matching bug; it is a
   * coverage hole in the request.
   *
   * So 'week filter' now goes first: same shape as lean, plus an explicit
   * scoring period and projected-source filter. 'lean' is kept exactly as it
   * was, unchanged, because it is the one shape known to answer on Tj's
   * network — it is the floor, not the target. */
  var SLOTS = [0, 2, 4, 6, 16, 17];
  function filters(season, week) {
    var wk = {
      players: {
        filterSlotIds: { value: SLOTS },
        filterStatsForSourceIds: { value: [1] },
        filterStatsForSplitTypeIds: { value: [0, 1] },
        filterStatsForScoringPeriodIds: { value: [week] },
        limit: 600,
        sortPercOwned: { sortAsc: false, sortPriority: 1 }
      }
    };
    var full = {
      players: {
        filterStatsForExternalIds: { value: [season] },
        filterSlotIds: { value: SLOTS },
        filterStatsForSourceIds: { value: [1] },
        useFullProjectionTable: { value: true },
        limit: 400,
        filterStatsForSplitTypeIds: { value: [0, 1] },
        filterStatsForScoringPeriodIds: { value: [week] },
        sortPercOwned: { sortAsc: false, sortPriority: 1 }
      }
    };
    var lean = {
      players: {
        filterSlotIds: { value: SLOTS },
        limit: 500,
        sortPercOwned: { sortAsc: false, sortPriority: 1 }
      }
    };
    /* ESPN now rejects a bare `limit` filter with no `sort` — HTTP 400
       "Filter: Limit request must be accompanied by a sort" (Tj's screenshot,
       2026-09-14). This is otherwise the narrowest shape on purpose (no
       filterSlotIds, unlike `lean`), so it keeps that; it only needed the
       same sort field `lean` already carries to stop being permanently
       broken. Without this, "limit only" could never succeed — not a
       transient failure, and it ran on every single sync since none of the
       three routes ahead of it alone clears GOOD_ENOUGH. */
    var tiny = { players: { limit: 500,
                             sortPercOwned: { sortAsc: false, sortPriority: 1 } } };
    return [
      { name: 'week filter', f: wk },
      { name: 'full filter', f: full },
      { name: 'lean filter', f: lean },
      { name: 'limit only', f: tiny }
    ];
  }

  /* Fetch and index every projected line we can get for this week.
   *
   * Routes are judged on WEEKLY coverage, not on whether they answered. The old
   * rule ("more than 20 usable players, take it") accepted the first route that
   * replied, which is how a shape returning week lines for fewer than half the
   * league looked like success. Now: stop early only on good coverage, and
   * otherwise keep the best of everything tried. */
  /* ---- SECOND SOURCE: Sleeper (v2.8) -------------------------------------
   * The ESPN projections endpoint is the single most fragile thing the app
   * depends on: it needs an X-Fantasy-Filter header, its shape has already
   * changed once mid-project, and one bad week of it silently costs a QB
   * twenty points of projection. Sleeper publishes projections with no key and
   * no header. It is used to FILL GAPS, never to overrule ESPN — a player who
   * already has an ESPN week line keeps it — and if the endpoint does not
   * answer, nothing changes and the diagnostic says so.
   *
   * As always: the STAT LINE is imported and re-scored here. Sleeper's own
   * points are half-PPR and mean nothing in a league that pays for completions.
   */
  var SLEEPER_KEYS = {
    pass_cmp: 'pass.cmp', pass_yd: 'pass.yds', pass_td: 'pass.td',
    pass_int: 'pass.int', pass_2pt: 'pass.twoPt',
    rush_yd: 'rush.yds', rush_td: 'rush.td', rush_2pt: 'rush.twoPt',
    rec: 'rec.rec', rec_yd: 'rec.yds', rec_td: 'rec.td', rec_2pt: 'rec.twoPt',
    fum_lost: 'fum.lost'
  };
  function sleeperLine(stats) {
    var L = root.Scoring.emptyLine(), k;
    L.played = true;
    var any = false;
    for (k in SLEEPER_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(SLEEPER_KEYS, k)) continue;
      var v = Number(stats[k]);
      if (!isFinite(v) || v === 0) continue;
      var path = SLEEPER_KEYS[k].split('.');
      L[path[0]][path[1]] = v;
      any = true;
    }
    /* usage, so the trend view works from either source */
    if (stats.pass_att) L.use.patt = Number(stats.pass_att) || 0;
    if (stats.rush_att) L.use.car = Number(stats.rush_att) || 0;
    if (stats.rec_tgt) L.use.tgts = Number(stats.rec_tgt) || 0;
    return any ? L : null;
  }
  function ingestSleeper(j) {
    var list = j;
    if (!list) return { byName: {}, count: 0, weekly: 0, note: 'empty body' };
    if (!(list instanceof Array)) {
      /* the legacy shape is an object keyed by player id, with no names in it
         — useless on a phone without the 5MB player map, and saying so plainly
         beats pretending the route worked */
      return { byName: {}, count: 0, weekly: 0,
               note: 'answered, but keyed by player id with no names' };
    }
    var byName = {}, count = 0, weekly = 0, i;
    for (i = 0; i < list.length; i++) {
      var row = list[i] || {};
      var p = row.player || {};
      var nm = p.full_name ||
               ((p.first_name || '') + ' ' + (p.last_name || '')).trim();
      var pos = String(p.position || row.position || '').toUpperCase();
      if (pos === 'DST' || pos === 'D/ST') pos = 'DEF';
      if (!nm || !pos) continue;
      if (pos !== 'QB' && pos !== 'RB' && pos !== 'WR' && pos !== 'TE') continue;
      var stats = row.stats || {};
      var L = sleeperLine(stats);
      if (!L) continue;
      byName[root.Espn.normName(nm)] = {
        pos: pos, week: root.Scoring.score(L).total, weekLine: L, src: 'sleeper'
      };
      count++; weekly++;
    }
    return { byName: byName, count: count, weekly: weekly,
             note: count + ' skill players with a week line' };
  }
  function sleeperRoutes(season, week) {
    return [
      { name: 'sleeper current',
        url: 'https://api.sleeper.app/projections/nfl/' + season + '/' + week +
             '?season_type=regular&position[]=QB&position[]=RB&position[]=WR' +
             '&position[]=TE&order_by=ppr' },
      { name: 'sleeper legacy',
        url: 'https://api.sleeper.app/v1/projections/nfl/regular/' + season + '/' + week }
    ];
  }

  var GOOD_ENOUGH = 300;      /* weekly lines that make further routes pointless */

  /* HOW LONG A GOOD PROJECTION SET STAYS GOOD (v4.5).
   *
   * This is the single heaviest thing the app fetches: up to three ESPN routes
   * asking for 400 players, plus two Sleeper routes, and the ESPN response is
   * megabytes. Before this gate, EVERY tap of "Sync advice" refetched all of
   * it unconditionally.
   *
   * That is not a hypothetical waste. When the Claude step failed — which is
   * exactly what Tj's screenshot shows — the natural response is to tap Sync
   * again, and every one of those retries pulled the whole projection feed and
   * the whole injury list down again to reach a step that had nothing to do
   * with either. A handful of frustrated taps is a burst of multi-megabyte
   * requests at a public endpoint that ESPN does not owe us, which is precisely
   * how an app earns a block.
   *
   * 20 minutes is chosen so that a retry loop costs one fetch instead of ten,
   * while a projection set is never more than one commercial break old. The
   * reuse is REPORTED rather than hidden — this app's rule is that nothing
   * pretends to be fresher than it is — and `force` exists for the Data tab's
   * explicit "test the feed", which must always hit the network. */
  var FRESH_MS = 20 * 60 * 1000;

  function fresh(season, week) {
    return !!(cache && cache.at && cache.season === season && cache.week === week &&
              (cache.weekly || 0) > 0 && (Date.now() - cache.at) < FRESH_MS);
  }

  function refresh(season, week, onStep, opts) {
    if (!(opts && opts.force) && fresh(season, week)) {
      var mins = Math.max(1, Math.round((Date.now() - cache.at) / 60000));
      if (onStep) onStep('Projections: reusing the set from ' + mins + ' min ago', 60);
      /* a copy, so a caller reading .notes cannot mutate the live cache */
      var reused = {};
      for (var k in cache) {
        if (Object.prototype.hasOwnProperty.call(cache, k)) reused[k] = cache[k];
      }
      reused.reused = true;
      reused.route = cache.route + ' (cached ' + mins + ' min)';
      return Promise.resolve(reused);
    }
    var routes = filters(season, week), attempt = 0, notes = [], best = null;
    var base = HOST + season + '/segments/0/leaguedefaults/3?scoringPeriodId=' +
               week + '&view=kona_player_info';

    function finish() {
      if (best) {
        cache = { at: Date.now(), week: week, season: season, byName: best.byName,
                  count: best.count, weekly: best.weekly, error: '',
                  route: best.route, notes: notes };
      } else if (cache && cache.season === season && cache.week === week && (cache.weekly || 0) > 0) {
        /* EVERY route failed — offline, or a feed outage — and this week's
           set is already on hand. It used to be REPLACED with nothing, so one
           pull-to-refresh with no signal threw away an hour-old projection
           set and every lineup call fell back to rough averages (full test
           2026-09-24). Keep it, leave its time alone so its real age still
           shows, and tell the caller this attempt failed. */
        var kept = {}, k2;
        for (k2 in cache) if (Object.prototype.hasOwnProperty.call(cache, k2)) kept[k2] = cache[k2];
        kept.failedNow = notes.join(' | ');
        return kept;
      } else {
        cache = { at: Date.now(), week: week, season: season, byName: {}, count: 0,
                  weekly: 0, error: notes.join(' | '), route: '', notes: notes };
      }
      saveCache();
      return cache;
    }

    /* Only after every ESPN route has been tried, and only to fill gaps. */
    function trySleeper() {
      var sr = sleeperRoutes(season, week), si = 0;
      function next() {
        if (si >= sr.length) return finish();
        var r = sr[si++];
        if (onStep) onStep('Projections: ' + r.name + '…', 70 + si * 8);
        return root.Espn._httpGet(r.url, { timeout: 45000 }).then(function (j) {
          var got = ingestSleeper(j);
          notes.push(r.name + ': ' + got.note);
          if (got.weekly > 0) {
            if (!best) best = { byName: {}, count: 0, weekly: 0, route: r.name };
            /* v3.5: Sleeper is a SECOND OPINION, not just a patch.
             * It used to be dropped whenever ESPN already had a week line, so
             * the "multiple sources" blend downstream only ever averaged one
             * outside professional projection with the app's own history. Two
             * independent projections that disagree are exactly the signal a
             * blend exists to use, so the Sleeper number is now kept alongside
             * ESPN's in its own field and recommend.js weights both. Where
             * ESPN has nothing it still fills the gap, as before. */
            var filled = 0, second = 0, k;
            for (k in got.byName) {
              if (!Object.prototype.hasOwnProperty.call(got.byName, k)) continue;
              /* Match on IDENTITY, not on the exact string each feed printed.
                 ESPN says "Cam Skattebo" and Sleeper says "Cameron Skattebo";
                 keyed raw, those are two entries, so the second opinion this
                 whole block exists to capture was silently filed as a separate
                 player and the blend downstream still averaged one source. */
              var hk = k;
              if (best.byName[hk] === undefined && root.Names && root.Names.hitKey) {
                /* 2026-09-15e sweep: `.fullName ||` was dead — ingestSleeper's
                   own records (built a few dozen lines up) are always
                   { pos, week, weekLine, src }, never a .fullName field, so
                   got.byName[k].fullName is undefined on every real call and
                   this fallback to `k` fired unconditionally. */
                var alt = root.Names.hitKey(best.byName, k);
                if (alt) hk = alt;
              }
              var have = best.byName[hk];
              if (have && have.week !== undefined) {
                have.sleeperWeek = got.byName[k].week;         /* keep it */
                have.sleeperLine = got.byName[k].weekLine;
                second++;
                continue;
              }
              if (have) { have.week = got.byName[k].week; have.weekLine = got.byName[k].weekLine; }
              else best.byName[hk] = got.byName[k];
              filled++;
            }
            best.weekly += filled; best.count += filled;
            best.route = best.route + ' + ' + r.name +
                         ' (' + filled + ' gaps filled, ' + second + ' second opinions)';
            notes.push(r.name + ': filled ' + filled + ' players ESPN had no week line for, ' +
                       'and gave a second opinion on ' + second + ' it did');
            return finish();
          }
          return next();
        }).catch(function (e) {
          notes.push(r.name + ': FAILED — ' + (e && e.message ? e.message : String(e)));
          return next();
        });
      }
      return next();
    }

    function tryNext() {
      if (attempt >= routes.length) return trySleeper();
      var r = routes[attempt++];
      if (onStep) onStep('Projections: ' + r.name + '…', 10 + attempt * 10);
      return root.Espn._httpGetH(base, { 'X-Fantasy-Filter': JSON.stringify(r.f) },
                                 { timeout: 90000 })
        .then(function (j) {
          var got = ingest(j, season, week);
          notes.push(r.name + ': ' + got.count + ' players, ' + got.weekly + ' week lines');
          if (!best || got.weekly > best.weekly) {
            best = { byName: got.byName, count: got.count, weekly: got.weekly, route: r.name };
          }
          if (got.weekly >= GOOD_ENOUGH) return finish();
          return tryNext();
        })
        .catch(function (e) {
          notes.push(r.name + ': FAILED — ' + (e && e.message ? e.message : String(e)));
          return tryNext();
        });
    }
    return Promise.resolve().then(tryNext);
  }

  /* Which of a list of players got no projection at all. The advice screen
     shows this, because a starting QB silently falling back to his own
     scored games (or a flat positional average) is exactly the kind of
     thing that hides in plain sight. */
  function missing(players, week) {
    var out = [], i;
    for (i = 0; i < players.length; i++) {
      var r = find(players[i], week);
      if (!r || r.week === undefined) {
        out.push({ name: players[i].name, pos: players[i].pos,
                   partial: !!(r && r.season !== undefined) });
      }
    }
    return out;
  }

  function ingest(j, season, week) {
    var list = j.players || j.items || (j.player ? [j] : []);
    var byName = {}, count = 0, weekly = 0, i, k;
    for (i = 0; i < list.length; i++) {
      var wrap = list[i];
      var p = wrap.player ? wrap.player : wrap;
      if (!p || !p.fullName) continue;
      var pos = POS_BY_ID[p.defaultPositionId];
      if (!pos) continue;
      var stats = p.stats || [];
      var wk = null, sea = null;
      for (k = 0; k < stats.length; k++) {
        var st = stats[k];
        if (Number(st.statSourceId) !== 1) continue;        /* 1 = projected */
        if (!st.stats) continue;
        if (Number(st.scoringPeriodId) === Number(week) &&
            Number(st.statSplitTypeId) === 1) wk = st.stats;
        /* A season split (statSplitTypeId 0) comes back once per SEASON the
           feed knows about — confirmed live 2026-09-18, ESPN returns an
           externalId "2025" row and an externalId "2026" row side by side for
           the same player. This used to take whichever arrived last, so in
           roughly half the responses a "season projection" was actually LAST
           season's line. Only the season being asked about counts; a row with
           no externalId at all is accepted, since older response shapes
           carried exactly one season split and no id to check it against. */
        else if (Number(st.statSplitTypeId) === 0 &&
                 (st.externalId === undefined || st.externalId === null ||
                  String(st.externalId) === String(season))) sea = st.stats;
      }
      if (!wk && !sea) continue;
      var rec = { pos: pos, espnId: String(p.id === undefined ? '' : p.id) };
      if (wk) { var a = scoreProjected(wk, pos); rec.week = a.pts; rec.weekLine = a.line; weekly++; }
      if (sea) { var b = scoreProjected(sea, pos); rec.season = b.pts; }
      byName[root.Espn.normName(p.fullName)] = rec;
      count++;
    }
    return { byName: byName, count: count, weekly: weekly };
  }

  /* ==== FULL-SEASON PROJECTIONS (2026-09-18) ==============================
   * Tj: "it must rank available players based on expected full season
   * performance, not just the next NFL week" and "projected stat lines ...
   * from multiple reputable sources online averaged and then recalculated
   * based on this league scoring system."
   *
   * WHY THIS IS A SEPARATE FETCH AND A SEPARATE CACHE.
   * The app already asked for a season split — `ingest()` above reads one —
   * but it never actually got one. Confirmed against the live endpoint on
   * 2026-09-18: the route that wins almost every sync ('week filter') pins
   * filterStatsForScoringPeriodIds to the week, and ESPN then returns ONLY
   * statSplitTypeId 1 rows. So `rec.season` was essentially never populated,
   * which made value.js's "ESPN season pace" branch and recommend.js's
   * espnSeason blend source dead code in practice, and dropped every free
   * agent onto whatever single week he had actually played. That is exactly
   * the screenshot Tj sent: every receiver on the wire priced at his week-1
   * actual, captioned "1 scored week in this app — thin sample".
   *
   * A season projection is ALSO not a per-week answer, so it must not live in
   * the weekly cache: find() deliberately withholds that whole record when
   * the caller asks about a different week than the one last fetched (right
   * for a weekly line, wrong for a season total, which is the same number
   * whichever week you ask from). Hence its own key, its own freshness, and
   * findSeason() with no week guard.
   *
   * SOURCES, BOTH RE-SCORED HERE. ESPN's season split and Sleeper's season
   * projections. Neither one's own "projected points" is ever used — they are
   * half-PPR and a completion pays nothing there — only the projected STAT
   * LINE, run through scoring.js, exactly as the weekly path already does.
   *
   * NOT PRESEASON DATA. Tj, 2026-09-14: "remove all preseason consideration
   * from any recommendations or advice from the entire app." These are not
   * draft-time numbers frozen in August: both feeds recompute them through
   * the season (Sleeper's season rows carried last_modified = that same day
   * when this was written, and ESPN's move with depth charts and injuries).
   * They are refetched, not bundled. The one genuinely frozen source — the
   * seed-time draft projection — stays gone.
   */
  var SEASON_KEY = 'fftracker_seasonproj_v1';
  /* Twelve hours: a season projection moves with depth charts and injuries,
     which is a daily rhythm, not a per-tap one — and this is a multi-megabyte
     fetch on a phone. The weekly feed keeps its own 20-minute window. */
  var SEASON_FRESH_MS = 12 * 60 * 60 * 1000;
  var seasonCache = { at: 0, season: 0, byName: {}, count: 0, error: '', route: '', notes: [] };

  function loadSeasonCache() {
    try {
      var s = (root.Native && root.Native.load) ? root.Native.load(SEASON_KEY)
              : root.localStorage.getItem(SEASON_KEY);
      if (s) { var o = JSON.parse(s); if (o && o.byName) seasonCache = o; }
    } catch (e) { /* cache is optional */ }
    return seasonCache;
  }
  function saveSeasonCache() {
    try {
      var s = JSON.stringify(seasonCache);
      if (root.Native && root.Native.save) root.Native.save(SEASON_KEY, s);
      else if (root.localStorage) root.localStorage.setItem(SEASON_KEY, s);
    } catch (e) { /* cache is optional */ }
  }
  function seasonFresh(season) {
    return !!(seasonCache && seasonCache.at && Number(seasonCache.season) === Number(season) &&
              (seasonCache.count || 0) > 0 && (Date.now() - seasonCache.at) < SEASON_FRESH_MS);
  }

  /* The season split, asked for on its own terms: no scoringPeriodIds filter
     and no scoringPeriodId in the URL, because pinning either is precisely
     what suppressed these rows in the weekly request. */
  function seasonFilter() {
    return { players: { filterSlotIds: { value: SLOTS },
                        filterStatsForSourceIds: { value: [1] },
                        filterStatsForSplitTypeIds: { value: [0] },
                        limit: 400,
                        sortPercOwned: { sortAsc: false, sortPriority: 1 } } };
  }

  function ingestSeasonEspn(j, season) {
    var list = j.players || j.items || (j.player ? [j] : []);
    var byName = {}, count = 0, i, k;
    for (i = 0; i < list.length; i++) {
      var wrap = list[i];
      var p = wrap.player ? wrap.player : wrap;
      if (!p || !p.fullName) continue;
      var pos = POS_BY_ID[p.defaultPositionId];
      if (!pos) continue;
      var stats = p.stats || [], sea = null;
      for (k = 0; k < stats.length; k++) {
        var st = stats[k];
        if (Number(st.statSourceId) !== 1) continue;
        if (Number(st.statSplitTypeId) !== 0) continue;
        if (!st.stats) continue;
        /* the season being asked about, never the one beside it */
        if (st.externalId !== undefined && st.externalId !== null &&
            String(st.externalId) !== String(season)) continue;
        sea = st.stats;
      }
      if (!sea) continue;
      var a = scoreProjected(sea, pos);
      if (!(a.pts > 0)) continue;
      byName[root.Espn.normName(p.fullName)] = {
        pos: pos, season: a.pts, seasonLine: a.line, gp: 17, src: 'espn'
      };
      count++;
    }
    return { byName: byName, count: count, note: count + ' season projections' };
  }

  function sleeperSeasonUrl(season) {
    return 'https://api.sleeper.app/projections/nfl/' + season +
           '?season_type=regular&position[]=QB&position[]=RB&position[]=WR' +
           '&position[]=TE&order_by=pts_ppr';
  }
  function ingestSleeperSeason(j) {
    var list = j;
    if (!list || !(list instanceof Array)) {
      return { byName: {}, count: 0, note: 'no usable body' };
    }
    var byName = {}, count = 0, i;
    for (i = 0; i < list.length; i++) {
      var row = list[i] || {};
      var p = row.player || {};
      /* Sleeper's SEASON rows carry no full_name — only first/last (confirmed
         live 2026-09-18), unlike some weekly shapes. Build it either way. */
      var nm = p.full_name ||
               ((p.first_name || '') + ' ' + (p.last_name || '')).trim();
      var pos = String(p.position || row.position || '').toUpperCase();
      if (pos === 'DST' || pos === 'D/ST') pos = 'DEF';
      if (!nm || !pos) continue;
      if (pos !== 'QB' && pos !== 'RB' && pos !== 'WR' && pos !== 'TE') continue;
      var stats = row.stats || {};
      var L = sleeperLine(stats);
      if (!L) continue;
      var gp = Number(stats.gp);
      if (!isFinite(gp) || gp <= 0) gp = 17;
      byName[root.Espn.normName(nm)] = {
        pos: pos, season: root.Scoring.score(L).total, seasonLine: L,
        gp: gp, src: 'sleeper'
      };
      count++;
    }
    return { byName: byName, count: count, note: count + ' season projections' };
  }

  /* Both sources, merged, every number already in league points. Where both
     have a man, BOTH are kept — averaging two independent professional
     projections is the whole point of carrying two (same reasoning as the
     weekly sleeperWeek second opinion), and ros.js does the averaging. */
  /* ---- a season fetch that fails (full test 2026-09-24) -------------------
   * The Wire tab asks for this set on EVERY render while it is stale or
   * missing (ui.js refreshSeasonProjIfStale) and re-renders when the attempt
   * settles. When the attempt FAILED — no signal, an ESPN outage — that
   * re-render asked again at once: measured at ~88 ESPN + 88 Sleeper requests
   * and as many full Wire renders and cache writes in two seconds, for as long
   * as the tab stayed open. Now: one attempt in flight at a time, and after a
   * failure a background caller waits SEASON_RETRY_MS before trying again (a
   * sync he started himself — opts.user — or opts.force still goes straight
   * out). And a failure keeps the set already on hand instead of replacing it
   * with nothing, exactly like the weekly refresh above. */
  var SEASON_RETRY_MS = 10 * 60000, seasonFailAt = 0, seasonInFlight = null;
  function refreshSeason(season, onStep, opts) {
    var force = !!(opts && opts.force), user = !!(opts && opts.user);
    if (!force && seasonFresh(season)) {
      var hrs = Math.max(1, Math.round((Date.now() - seasonCache.at) / 3600000));
      if (onStep) onStep('Season projections: reusing the set from ' + hrs + 'h ago', 80);
      return Promise.resolve(seasonCache);
    }
    if (seasonInFlight) return seasonInFlight;
    if (!force && !user && seasonFailAt && (Date.now() - seasonFailAt) < SEASON_RETRY_MS) {
      return Promise.resolve(seasonCache);
    }
    var notes = [], merged = {}, count = 0, routes = [];
    var url = HOST + season + '/segments/0/leaguedefaults/3?view=kona_player_info';

    function finish() {
      seasonInFlight = null;
      if (count > 0) {
        seasonFailAt = 0;
        seasonCache = { at: Date.now(), season: season, byName: merged, count: count,
                        error: '', route: routes.join(' + '), notes: notes };
      } else {
        seasonFailAt = Date.now();
        if (seasonCache && Number(seasonCache.season) === Number(season) && (seasonCache.count || 0) > 0) {
          var kept = {}, k3;
          for (k3 in seasonCache) if (Object.prototype.hasOwnProperty.call(seasonCache, k3)) kept[k3] = seasonCache[k3];
          kept.failedNow = notes.join(' | ');
          return kept;
        }
        seasonCache = { at: Date.now(), season: season, byName: {}, count: 0,
                        error: notes.join(' | '), route: '', notes: notes };
      }
      saveSeasonCache();
      return seasonCache;
    }

    function trySleeperSeason() {
      if (onStep) onStep('Season projections: Sleeper…', 88);
      return root.Espn._httpGet(sleeperSeasonUrl(season), { timeout: 60000 })
        .then(function (j) {
          var got = ingestSleeperSeason(j);
          notes.push('sleeper season: ' + got.note);
          if (!got.count) return finish();
          var added = 0, second = 0, k;
          for (k in got.byName) {
            if (!Object.prototype.hasOwnProperty.call(got.byName, k)) continue;
            var hk = k;
            if (merged[hk] === undefined && root.Names && root.Names.hitKey) {
              var alt = root.Names.hitKey(merged, k);
              if (alt) hk = alt;
            }
            if (merged[hk]) {
              merged[hk].sleeperSeason = got.byName[k].season;
              merged[hk].sleeperSeasonLine = got.byName[k].seasonLine;
              merged[hk].sleeperGp = got.byName[k].gp;
              second++;
            } else {
              merged[hk] = got.byName[k];
              added++; count++;
            }
          }
          routes.push('sleeper season (' + added + ' new, ' + second + ' second opinions)');
          return finish();
        })
        .catch(function (e) {
          notes.push('sleeper season: FAILED — ' + (e && e.message ? e.message : String(e)));
          return finish();
        });
    }

    if (onStep) onStep('Season projections: ESPN…', 82);
    seasonInFlight = root.Espn._httpGetH(url, { 'X-Fantasy-Filter': JSON.stringify(seasonFilter()) },
                               { timeout: 90000 })
      .then(function (j) {
        var got = ingestSeasonEspn(j, season);
        notes.push('espn season: ' + got.note);
        merged = got.byName; count = got.count;
        if (count) routes.push('espn season (' + count + ')');
        return trySleeperSeason();
      })
      .catch(function (e) {
        notes.push('espn season: FAILED — ' + (e && e.message ? e.message : String(e)));
        return trySleeperSeason();
      })
      /* nothing above rejects (every step ends in finish()), but a throw in
         an ingest must not leave the in-flight marker set forever */
      ['catch'](function (e) { seasonInFlight = null; seasonFailAt = Date.now(); throw e; });
    return seasonInFlight;
  }

  /* No week guard, deliberately — see the block comment above. */
  function findSeason(player) {
    if (!seasonCache.byName) return null;
    var k = root.Espn.normName(player.name);
    if (seasonCache.byName[k]) return seasonCache.byName[k];
    if (root.Names && root.Names.hit) {
      var v = root.Names.hit(seasonCache.byName, player.name);
      if (v) return v;
    }
    return null;
  }
  function seasonMeta() {
    return { at: seasonCache.at || 0, season: seasonCache.season || 0,
             count: seasonCache.count || 0, error: seasonCache.error || '',
             route: seasonCache.route || '', notes: seasonCache.notes || [] };
  }

  /* ---- lookup --------------------------------------------------------- */
  /* D/ST entries come back as "Eagles D/ST" style names; roster DEFs are
     stored by NFL code, so match on the team nickname too.
     `week`, when passed, is the WEEK BEING ASKED ABOUT — not necessarily the
     week this cache actually holds. Tj, 2026-09-14: "in the advice tab, when
     I go to week 2, it still shows me cached numbers for week 1 projections
     which doesn't make sense." Before this, find() answered from whatever
     was last fetched regardless of which week the caller meant, so a week-2
     screen quietly showed week-1's ESPN/Sleeper numbers under a "week 2
     projection" label. A cache from a different week is not a worse answer
     to this question, it is an answer to a DIFFERENT question — so it is
     withheld entirely (both the weekly line and the season pace, which
     travel with the same fetch and are only as current as it is), leaving
     the caller to show blank/loading until refresh() actually runs for the
     week in view. */
  function find(player, week) {
    if (!cache.byName) return null;
    if (week !== undefined && week !== null && Number(cache.week) !== Number(week)) return null;
    var k = root.Espn.normName(player.name);
    if (cache.byName[k]) return cache.byName[k];
    /* Then every other spelling of the same man. The index is keyed by the
       FEED's name and this is the ROSTER's; an exact-match miss dropped the
       ESPN weekly line, the Sleeper line and the season pace all at once —
       weights 3.0, 2.0 and 1.0, i.e. most of the blend — and fell through to a
       flat positional average. The "why" panel said "no projection on file",
       which reads as a data gap rather than a spelling mismatch. */
    if (root.Names && root.Names.hit) {
      var v = root.Names.hit(cache.byName, player.name);
      if (v) return v;
    }
    if (player.pos === 'DEF') {
      var want = k.replace(/\b(d\/?st|dst|defense|def)\b/g, '').trim();
      var key;
      for (key in cache.byName) {
        if (!Object.prototype.hasOwnProperty.call(cache.byName, key)) continue;
        if (cache.byName[key].pos !== 'DEF') continue;
        if (want && key.indexOf(want) >= 0) return cache.byName[key];
        if (want && want.indexOf(key.replace(/\b(d\/?st|dst|defense|def)\b/g, '').trim()) >= 0) {
          return cache.byName[key];
        }
      }
    }
    return null;
  }

  function meta() {
    return { at: cache.at, week: cache.week, count: cache.count || 0,
             error: cache.error || '', route: cache.route || '',
             weekly: cache.weekly || 0, notes: cache.notes || [] };
  }

  /* Self-test: prove the endpoint works from THIS phone and that the
     re-scoring is doing what it claims, without needing a synced week. */
  /* force: true — this button exists to answer "does the feed answer AT ALL",
     and a cached answer would tell him nothing about the network. It is the one
     place that must always go out. */
  function selfTest(season, week) {
    return refresh(season, week, null, { force: true }).then(function (c) {
      var lines = [];
      lines.push('best route: ' + (c.route || 'ALL ROUTES FAILED'));
      lines.push('players indexed: ' + (c.count || 0));
      lines.push('with a week ' + week + ' line: ' + (c.weekly || 0));
      lines.push('');
      lines.push('every route tried:');
      (c.notes || []).forEach(function (t) { lines.push('  ' + t); });
      if (c.error) lines.push('errors: ' + c.error);
      lines.push('');
      var shown = 0, key;
      for (key in c.byName) {
        if (!Object.prototype.hasOwnProperty.call(c.byName, key)) continue;
        var r = c.byName[key];
        if (r.pos !== 'QB' || r.week === undefined) continue;
        lines.push('  QB ' + key + ' -> ' + r.week.toFixed(1) + ' league pts' +
                   (r.weekLine ? ('  (' + Math.round(r.weekLine.pass.cmp) + ' cmp, ' +
                    Math.round(r.weekLine.pass.yds) + ' yds)') : ''));
        if (++shown >= 3) break;
      }
      if (!shown) lines.push('  no QB weekly lines came back — the filter shape needs work');
      return lines.join('\n');
    });
  }

  root.Projections = {
    refresh: refresh, find: find, meta: meta, loadCache: loadCache, missing: missing,
    fresh: fresh, FRESH_MS: FRESH_MS,
    _ingestSleeper: ingestSleeper, _sleeperRoutes: sleeperRoutes,
    scoreProjected: scoreProjected, selfTest: selfTest, STAT_ID: ID,
    _ingest: ingest,
    /* full-season projections — their own fetch and their own cache */
    refreshSeason: refreshSeason, findSeason: findSeason, seasonMeta: seasonMeta,
    loadSeasonCache: loadSeasonCache, seasonFresh: seasonFresh,
    SEASON_FRESH_MS: SEASON_FRESH_MS,
    _ingestSeasonEspn: ingestSeasonEspn, _ingestSleeperSeason: ingestSleeperSeason,
    _seasonFilter: seasonFilter, _sleeperSeasonUrl: sleeperSeasonUrl
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Projections;
})(typeof window !== 'undefined' ? window : this);
