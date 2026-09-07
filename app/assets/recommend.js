/* recommend.js — weekly lineup advice. ES2018 only (no ?. no ?? no .at()).
 *
 * HOW A PROJECTION IS BUILT (v1.8)
 * Four independent sources, all expressed in THIS league's points before they
 * are combined — never in whatever scoring the source shipped with:
 *
 *   1. ESPN's projected stat line for this exact week, re-scored by
 *      scoring.js  (projections.js does the conversion)
 *   2. what the player has actually scored in this app's synced weeks
 *   3. his 2026 preseason projection, converted at draft time (seed.projPG)
 *   4. ESPN's full-season projection, per game
 *
 * They are weighted, not averaged: the weekly line is the best single number
 * when it exists, measured games take over as the sample grows, and the
 * preseason prior fades out. Then three multipliers, in this order:
 *
 *   x matchup   how generous this opponent has been to the position, measured
 *               from synced weeks. Applied at HALF strength when source 1 is
 *               present, because ESPN's weekly number already prices the
 *               matchup and counting it twice is a real error, not a rounding one.
 *   x health    ESPN's injury feed. OUT and bye are hard zeros.
 *   x Claude    optional. A cited, dated read of this week's news per player.
 *
 * A player who is out, suspended, on bye, or whom Claude says will not play is
 * removed from consideration entirely — not down-weighted. He cannot be
 * recommended at all, which is what Tj asked for.
 */
(function (root) {
  'use strict';

  /* Fallback only — used for a waiver add with no projection anywhere. */
  var PRIOR = { QB: 44, RB: 13, WR: 12, TE: 10, K: 9, DEF: 12 };
  var MATCHUP_CAP = 0.22;
  var HEALTH = { OUT: 0, DOUBTFUL: 0.25, QUESTIONABLE: 0.82, PROBABLE: 0.97 };

  /* Blend weights. Two OUTSIDE professional projections (ESPN and Sleeper),
     his own scored games, and the preseason number. Sleeper is weighted a
     little below ESPN because ESPN's weekly line is opponent-aware and
     Sleeper's is thinner, not because it is less trustworthy — and the point
     of carrying both is that where they disagree, the average is better than
     either. EVERY one of these is in THIS league's points before it is
     weighted: the outside sources contribute a STAT LINE which scoring.js
     re-scores. Their own "projected points" are half-PPR standard and are
     never used, anywhere, for anything. */
  var W = { espnWeek: 3.0, sleeperWeek: 2.0, measuredPerGame: 1.0, measuredMax: 4.0,
            preseasonEarly: 1.5, preseasonLate: 0.5, espnSeason: 1.0 };

  var NEWSKEY = 'fftracker_news_v1';
  var AIKEY = 'fftracker_ai_v1';
  var newsCache = { at: 0, byName: {} };
  var aiCache = { at: 0, byName: {}, summary: '', model: '', week: 0 };

  function cacheLoad(k, fallback) {
    try {
      var s = (root.Native && root.Native.load) ? root.Native.load(k)
              : root.localStorage.getItem(k);
      if (s) { var o = JSON.parse(s); if (o && o.byName) return o; }
    } catch (e) { /* caches are optional */ }
    return fallback;
  }
  function cacheSave(k, v) {
    try {
      var s = JSON.stringify(v);
      if (root.Native && root.Native.save) root.Native.save(k, s);
      else root.localStorage.setItem(k, s);
    } catch (e) { /* caches are optional */ }
  }
  function loadCaches() {
    newsCache = cacheLoad(NEWSKEY, newsCache);
    aiCache = cacheLoad(AIKEY, aiCache);
    if (root.Projections) root.Projections.loadCache();
  }

  function norm(s) { return root.Espn.normName(s); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function ago(t) {
    if (!t) return 'never';
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    if (m < 60 * 36) return Math.round(m / 60) + ' h ago';
    return Math.round(m / 1440) + ' d ago';
  }

  /* ---- v2.4 triage helpers ---------------------------------------------
   * How long a "clear" verdict stays good. Three days by default: long enough
   * that a Thursday and a Sunday sync do not both pay for the same search, and
   * short enough that a Friday practice report is never missed, because
   * anybody carrying a designation is researched again regardless of age. */
  function freshMs() {
    var d = root.Store.get().settings.aiFreshDays;
    if (typeof d !== 'number' || !isFinite(d) || d <= 0) d = 3;
    return d * 86400000;
  }
  /* A role that changed is news even when nobody has said anything. The league
     book already holds opportunity (attempts, carries, targets) for every
     player, so this costs nothing but arithmetic. */
  function usageSwing(p, week) {
    if (!root.Store.bookTrend) return '';
    var t = root.Store.bookTrend(norm(p.name), week - 1, 2);
    if (t.length < 2 || !t[0].row || !t[1].row) return '';
    function opp(r) { return (r.pa || 0) + (r.cr || 0) + (r.tg || 0); }
    var now = opp(t[0].row), before = opp(t[1].row);
    if (before < 5 && now < 5) return '';
    var base = Math.max(before, 1);
    var chg = (now - before) / base;
    if (chg <= -0.4) return 'his opportunities fell ' + Math.round(-chg * 100) + '% last week';
    if (chg >= 0.5) return 'his opportunities rose ' + Math.round(chg * 100) + '% last week';
    return '';
  }

  /* ---- measured form -------------------------------------------------- */
  function gameLog(pid, uptoWeek) {
    var out = [], w;
    for (w = 1; w < uptoWeek; w++) {
      if (!root.Store.weekIsScored(w)) continue;
      var l = root.Store.lineFor(w, pid);
      if (l && l.played) out.push({ week: w, pts: root.Scoring.score(l).total });
    }
    return out;
  }

  /* ---- opponent generosity, measured from synced weeks ---------------- */
  /* Memoised on (week, store generation). autoFillWeek loops all ten teams
     calling autoLineup -> bestLineup -> projectAll -> defenseProfile(week), and
     the answer is IDENTICAL for all ten — it is a property of the league, not
     of the team. Each run walks every scored week x every rostered player x
     Scoring.score, so at week 10 that was ~1,700 score() calls repeated ten
     times, on boot, on every week change, and on every sync INCLUDING the
     45-second live poll. The generation moves whenever the store saves, so a
     new synced week or a roster change invalidates it immediately. */
  var _dpMemo = null;
  function defenseProfile(uptoWeek) {
    var gen = (root.Store.generation ? root.Store.generation() : 0);
    var key = String(uptoWeek) + '|' + gen;
    if (_dpMemo && _dpMemo.key === key) return _dpMemo.val;
    var S = root.Store.get(), prof = {}, posAvg = {}, posN = {}, w, i;
    for (w = 1; w < uptoWeek; w++) {
      if (!root.Store.weekIsScored(w)) continue;
      var opp = S.weekMeta[String(w)] && S.weekMeta[String(w)].opponents;
      if (!opp) continue;
      root.Store.allPlayers().forEach(function (x) {
        var p = x.player, l = root.Store.lineFor(w, p.id);
        if (!l || !l.played || !p.nfl) return;
        var d = opp[p.nfl];
        if (!d) return;
        var pts = root.Scoring.score(l).total;
        if (!prof[d]) prof[d] = {};
        if (!prof[d][p.pos]) prof[d][p.pos] = { sum: 0, n: 0 };
        prof[d][p.pos].sum += pts; prof[d][p.pos].n++;
        posAvg[p.pos] = (posAvg[p.pos] || 0) + pts; posN[p.pos] = (posN[p.pos] || 0) + 1;
      });
    }
    var league = {};
    for (i in posAvg) if (posN[i]) league[i] = posAvg[i] / posN[i];
    var val = { prof: prof, league: league };
    _dpMemo = { key: key, val: val };
    return val;
  }
  function matchupFactor(dp, defAbbr, pos) {
    if (!defAbbr) return { f: 1, why: 'opponent not known yet', n: 0 };
    var d = dp.prof[defAbbr], lg = dp.league[pos];
    if (!d || !d[pos] || !lg || d[pos].n < 3) {
      return { f: 1, n: (d && d[pos]) ? d[pos].n : 0,
               why: 'no measured history vs ' + defAbbr + ' yet — matchup term is neutral' };
    }
    var avg = d[pos].sum / d[pos].n;
    var f = Math.max(1 - MATCHUP_CAP, Math.min(1 + MATCHUP_CAP, avg / lg));
    var pct = Math.round((f - 1) * 100);
    return { f: f, n: d[pos].n,
             why: defAbbr + ' has allowed ' + (pct >= 0 ? '+' : '') + pct + '% to ' +
                  pos + 's (' + d[pos].n + ' player-games measured)' };
  }

  /* ---- ESPN injury feed ------------------------------------------------ */

  /* WHY THIS EXISTS (Tj's screenshots, 2026-09-07).
   * The note was stored as `String(det).slice(0, 220)` — a hard cut at exactly
   * 220 characters, landing wherever it landed. On his phone that read:
   *
   *   "...the early diagnosis seems to suggest he is not dealing with a
   *    serious setback. Even still, Swift wil"
   *
   * and the same wound appeared twice more in the FLAGGED list, because both
   * the per-player "why" line and the flag text read this one stored string.
   * A sentence stopping mid-word does not just look unfinished — it can invert
   * the meaning, which for an injury note is the one thing it must not do
   * ("Even still, Swift will [play / miss]" is the whole question).
   *
   * The cap itself is not the mistake; the feed carries ~800 records and the
   * whole cache is rewritten on every sync, so an unbounded note is a real
   * cost. Cutting WITHOUT REGARD FOR MEANING was the mistake. 600 holds a
   * complete ESPN comment in the overwhelming majority of cases, and when a cut
   * is genuinely needed it now happens at a sentence end, or failing that a
   * word end, and always says so with an ellipsis. */
  function trimNote(s, max) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    if (s.length <= max) return s;
    var cut = s.slice(0, max);
    /* prefer a whole sentence, but only if that does not throw most of it away */
    var dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '),
                       cut.lastIndexOf('? '));
    if (dot >= Math.floor(max * 0.6)) return cut.slice(0, dot + 1);
    var sp = cut.lastIndexOf(' ');
    return (sp > 0 ? cut.slice(0, sp) : cut).replace(/[,;:.\-—]+$/, '') + '…';
  }

  /* The injury feed is ~800 records and it is refetched on every advice sync.
     Practice reports land in the afternoon and designations move on a Friday,
     not minute to minute — so a 10-minute window costs nothing in accuracy and
     turns a run of frustrated Sync taps into one request instead of ten. See
     the longer note on FRESH_MS in projections.js: this is the same defect and
     the same reasoning, on the second-heaviest feed. */
  var NEWS_FRESH_MS = 10 * 60 * 1000;
  function newsFresh() {
    return !!(newsCache && newsCache.at && !newsCache.error &&
              (newsCache.count || 0) > 0 &&
              (Date.now() - newsCache.at) < NEWS_FRESH_MS);
  }
  function loadNews(onStep, opts) {
    if (!(opts && opts.force) && newsFresh()) {
      newsCache.reused = Math.max(1, Math.round((Date.now() - newsCache.at) / 60000));
      if (onStep) onStep('Injury report: reusing the copy from ' +
                         newsCache.reused + ' min ago', 18);
      return Promise.resolve(newsCache);
    }
    var url = root.Espn.BASE + '/injuries';
    if (onStep) onStep('Injury report…', 15);
    return root.Espn._httpGet(url).then(function (j) {
      var byName = {}, i, k;
      var groups = j.injuries || j.items || [];
      for (i = 0; i < groups.length; i++) {
        var list = groups[i].injuries || groups[i].items || [];
        for (k = 0; k < list.length; k++) {
          var it = list[k];
          var ath = it.athlete || (it.playerRef ? it.playerRef : null);
          var nm = ath && ath.displayName ? ath.displayName : (it.displayName || '');
          var st = String(it.status || (it.type ? it.type.description : '') || '').toUpperCase();
          var det = it.longComment || it.shortComment || (it.details ? it.details.type : '') || '';
          if (nm) byName[norm(nm)] = { status: st, note: trimNote(det, 600) };
        }
      }
      /* `reused` is deliberately absent here: a real fetch must not inherit the
         marker from the last cached read, or the report would claim a fresh
         pull was recycled. */
      newsCache = { at: Date.now(), byName: byName, count: Object.keys(byName).length };
      cacheSave(NEWSKEY, newsCache);
      return newsCache;
    }).catch(function (e) {
      newsCache = { at: Date.now(), byName: {}, count: 0,
                    error: (e && e.message) ? e.message : String(e) };
      cacheSave(NEWSKEY, newsCache);
      return newsCache;
    });
  }
  function health(player) {
    var rec = newsCache.byName ? newsCache.byName[norm(player.name)] : null;
    if (!rec) return { f: 1, label: '', note: '' };
    var s = rec.status, f = 1, lab = '';
    if (s.indexOf('OUT') >= 0 || s.indexOf('INJURED RESERVE') >= 0 ||
        s.indexOf('SUSPEND') >= 0 || s.indexOf('PUP') >= 0) { f = HEALTH.OUT; lab = 'OUT'; }
    else if (s.indexOf('DOUBT') >= 0) { f = HEALTH.DOUBTFUL; lab = 'DOUBTFUL'; }
    else if (s.indexOf('QUEST') >= 0) { f = HEALTH.QUESTIONABLE; lab = 'QUESTIONABLE'; }
    else if (s.indexOf('PROB') >= 0) { f = HEALTH.PROBABLE; lab = 'PROBABLE'; }
    return { f: f, label: lab, note: rec.note };
  }

  /* ---- the projection -------------------------------------------------- */
  function projectOne(p, week, opp, dp) {
    var srcs = [], sum = 0, wsum = 0;
    function src(name, pts, weight, detail) {
      if (pts === null || pts === undefined || !isFinite(pts) || weight <= 0) return;
      srcs.push({ name: name, pts: Math.round(pts * 10) / 10, w: weight, detail: detail || '' });
      sum += pts * weight; wsum += weight;
    }

    var pr = root.Projections ? root.Projections.find(p) : null;
    var hasWeekly = !!(pr && pr.week !== undefined);
    if (hasWeekly) src('ESPN week ' + week + ' projection', pr.week, W.espnWeek,
                       'their projected stat line, re-scored under our rules');
    if (pr && pr.sleeperWeek !== undefined && pr.sleeperWeek !== null) {
      src('Sleeper week ' + week + ' projection', pr.sleeperWeek, W.sleeperWeek,
          'their projected stat line, re-scored under our rules');
    }
    if (pr && pr.season !== undefined) {
      src('ESPN season pace', pr.season / 17, W.espnSeason, 'their full-season projection / 17');
    }

    var log = gameLog(p.id, week), i, tot = 0;
    for (i = 0; i < log.length; i++) tot += log[i].pts;
    if (log.length) {
      src(log.length + ' game' + (log.length === 1 ? '' : 's') + ' this season',
          tot / log.length, Math.min(W.measuredMax, log.length * W.measuredPerGame),
          'his own scored games in this app');
    }
    var hasPre = p.projPG !== undefined && p.projPG !== null;
    if (hasPre) {
      src('preseason projection', p.projPG,
          log.length < 4 ? W.preseasonEarly : W.preseasonLate,
          p.projSrc ? String(p.projSrc) : 'draft-time projection');
    }
    if (!srcs.length) {
      src('positional average', PRIOR[p.pos] || 10, 1, 'no projection on file for him');
    }

    var base = sum / wsum;
    var mf = matchupFactor(dp, opp, p.pos);
    /* half strength when ESPN's weekly line already prices the matchup */
    var mfApplied = hasWeekly ? (1 + (mf.f - 1) * 0.5) : mf.f;
    var h = health(p);
    var ai = aiCache.byName ? aiCache.byName[norm(p.name)] : null;
    var onBye = Number(p.bye) === Number(week);

    var aiAdj = (ai && typeof ai.adjust === 'number') ? ai.adjust : 1;
    var proj = onBye ? 0 : base * mfApplied * h.f * aiAdj;

    /* Hard exclusions. Not a penalty — these players are not offered at all. */
    var flags = [];
    if (onBye) flags.push({ kind: 'out', text: 'ON BYE in week ' + week + ' — scores 0' });
    if (h.label === 'OUT') flags.push({ kind: 'out', text: 'ESPN has him OUT' + (h.note ? ': ' + h.note : '') });
    if (ai && (ai.willPlay === false || ai.status === 'out')) {
      flags.push({ kind: 'out', text: 'Claude: not expected to play' });
    }
    if (h.label === 'DOUBTFUL') flags.push({ kind: 'warn', text: 'DOUBTFUL' + (h.note ? ': ' + h.note : '') });
    if (h.label === 'QUESTIONABLE') flags.push({ kind: 'warn', text: 'QUESTIONABLE' + (h.note ? ': ' + h.note : '') });
    if (ai && ai.status === 'limited') flags.push({ kind: 'warn', text: 'Claude: playing with a restriction' });
    var blocked = false, k2;
    for (k2 = 0; k2 < flags.length; k2++) if (flags[k2].kind === 'out') blocked = true;
    if (blocked) proj = 0;

    /* the written case */
    var why = [];
    var outside = 0;
    for (i = 0; i < srcs.length; i++) {
      if (srcs[i].name.indexOf('ESPN') === 0 || srcs[i].name.indexOf('Sleeper') === 0) outside++;
    }
    why.push(r1(base) + ' blended from ' + srcs.length + ' source' + (srcs.length === 1 ? '' : 's') +
             (outside ? ' (' + outside + ' outside professional projection' +
              (outside === 1 ? '' : 's') + ', converted from their scoring into ours)' : ''));
    for (i = 0; i < srcs.length; i++) {
      why.push('   • ' + srcs[i].name + ': ' + srcs[i].pts.toFixed(1) +
               '  (weight ' + srcs[i].w.toFixed(1) + ')' + (srcs[i].detail ? ' — ' + srcs[i].detail : ''));
    }
    if (opp) {
      why.push('matchup: ' + mf.why +
               (hasWeekly && mf.f !== 1 ? ' — applied at half strength, ESPN already priced it' : '') +
               (mfApplied !== 1 ? '  → x' + mfApplied.toFixed(2) : ''));
    } else {
      why.push('matchup: opponent for week ' + week + ' not loaded — tap Sync');
    }
    if (h.label) why.push('injury feed: ' + h.label + (h.note ? ' — ' + h.note : '') +
                          '  → x' + h.f.toFixed(2));
    if (ai) {
      why.push('Claude (' + (ai.confidence || 'low') + ' confidence, x' + aiAdj.toFixed(2) + ')' +
               (ai.at ? ', checked ' + ago(ai.at) : '') + ': ' + ai.reason);
    }
    if (onBye) why.push('BYE WEEK — this is a guaranteed 0, there is no auto-substitution.');

    return { p: p, proj: proj, base: base, srcs: srcs, mf: mf, mfApplied: mfApplied,
             h: h, ai: ai, onBye: onBye, opp: opp, why: why, flags: flags,
             startable: !blocked, hasWeekly: hasWeekly };
  }

  function projectAll(week, teamId, opponents) {
    var dp = defenseProfile(week);
    var t = root.Store.team(teamId), out = [];
    if (!t) return out;
    t.players.forEach(function (p) {
      var opp = (opponents && p.nfl) ? opponents[p.nfl] : null;
      out.push(projectOne(p, week, opp, dp));
    });
    return out;
  }

  /* ---- best lineup ----------------------------------------------------- */
  /* Startable players first, always. A blocked player is only ever used when a
     slot has literally nothing else, and the pick carries a flag saying so. */
  function bestLineup(week, teamId, opponents) {
    var all = projectAll(week, teamId, opponents);
    var byId = {}; all.forEach(function (x) { byId[x.p.id] = x; });
    var keys = root.Store.slotKeys(), used = {}, picks = [];
    /* tight slots before FLEX, or the flex steals a WR1 */
    var order = keys.slice().sort(function (a, b) {
      return (a.pos === 'FLEX' ? 1 : 0) - (b.pos === 'FLEX' ? 1 : 0);
    });
    order.forEach(function (k) {
      var elig = root.Store.eligible(teamId, k.pos)
        .filter(function (p) { return !used[p.id]; })
        .map(function (p) { return byId[p.id]; })
        .filter(function (x) { return !!x; });
      var open = elig.filter(function (x) { return x.startable; })
                     .sort(function (a, b) { return b.proj - a.proj; });
      var fallback = elig.filter(function (x) { return !x.startable; })
                         .sort(function (a, b) { return b.base - a.base; });
      var pick = open.length ? open[0] : (fallback.length ? fallback[0] : null);
      var forced = !!(pick && !pick.startable);
      if (pick) used[pick.p.id] = 1;
      picks.push({ key: k.key, label: k.label, pos: k.pos, pick: pick, forced: forced,
                   alts: open.slice(1, 4) });
    });
    var ks = keys.map(function (x) { return x.key; });
    picks.sort(function (a, b) { return ks.indexOf(a.key) - ks.indexOf(b.key); });
    return picks;
  }

  /* Slot -> playerId, for the auto-fill that runs on every team. Cheap: it
     skips the news/AI layers for teams other than Tj's, because those caches
     only ever cover his roster anyway. */
  function autoLineup(week, teamId, opponents) {
    var picks = bestLineup(week, teamId, opponents), out = {}, i;
    for (i = 0; i < picks.length; i++) {
      if (picks[i].pick) out[picks[i].key] = picks[i].pick.p.id;
    }
    return out;
  }

  /* ---- week opponents -------------------------------------------------- */
  function opponentsForWeek(week) {
    var S = root.Store.get();
    var m = S.weekMeta[String(week)];
    if (m && m.opponents) return Promise.resolve(m.opponents);
    return root.Espn.weekGames(S.settings.season, week, 2).then(function (games) {
      var opp = {};
      games.forEach(function (g) {
        if (g.teams.length === 2) {
          opp[g.teams[0].abbr] = g.teams[1].abbr;
          opp[g.teams[1].abbr] = g.teams[0].abbr;
        }
      });
      if (!S.weekMeta[String(week)]) S.weekMeta[String(week)] = {};
      S.weekMeta[String(week)].opponents = opp;
      root.Store.save();
      return opp;
    });
  }

  /* ---- the one button -------------------------------------------------- */
  /* Everything the advice depends on, refreshed in one pass, with the AI step
     last so a key problem never costs the deterministic upgrade. */
  /* Fold a set of Claude verdicts into the cache and persist it.
   *
   * MERGE, NEVER REPLACE. The carried-forward verdicts have to survive a sync
   * that only researched four players, or the triage saving would cost the
   * reasoning for everybody else.
   *
   * Shared with the offline Claude-app handoff (handoff.js), which produces
   * exactly the same `r` shape through Ai.normalizeAdvice. An imported file
   * therefore lands in the same place, with the same merge semantics, as a
   * live API sync — there is no second path to keep in step. */
  function mergeAi(week, r, stats) {
    var merged = {}, k;
    if (aiCache.byName) for (k in aiCache.byName) {
      if (Object.prototype.hasOwnProperty.call(aiCache.byName, k)) merged[k] = aiCache.byName[k];
    }
    for (k in r.byName) {
      if (Object.prototype.hasOwnProperty.call(r.byName, k)) merged[k] = r.byName[k];
    }
    aiCache = { at: r.at || Date.now(), byName: merged,
                summary: r.summary || '', model: r.model || '', week: week,
                count: r.count,
                truncated: !!r.truncated,
                researched: (stats && stats.researched) || 0,
                carried: (stats && stats.carried) || 0,
                settled: (stats && stats.settled) || 0 };
    cacheSave(AIKEY, aiCache);
    return aiCache;
  }

  function syncAll(week, teamId, onStep) {
    var S = root.Store.get(), report = { steps: [] };
    function step(t, p) { if (onStep) onStep(t, p); }

    step('Week ' + week + ' schedule…', 8);
    /* v3.10: a rejection here used to abandon the WHOLE sync — no injury feed,
       no projections, no Claude — even though none of them need the opponent
       map. A transient schedule endpoint cost the entire advice refresh.
       loadNews already models the right shape: catch internally, record the
       reason, carry on with what still works. */
    return opponentsForWeek(week)['catch'](function (e) {
      report.steps.push('schedule FAILED: ' + ((e && e.message) ? e.message : e) +
                        ' — matchup strength is unavailable, everything else still ran');
      return {};
    }).then(function (opp) {
      if (Object.keys(opp).length) {
        report.opponents = Object.keys(opp).length / 2;
        report.steps.push(report.opponents + ' games scheduled');
      }
      step('Injury report…', 20);
      return loadNews(null).then(function () { return opp; });
    }).then(function (opp) {
      report.steps.push(newsCache.error ? ('injury feed FAILED: ' + newsCache.error)
                                        : ((newsCache.count || 0) + ' injury records' +
                                           (newsCache.reused
                                             ? ' (reused, ' + newsCache.reused + ' min old)'
                                             : '')));
      step('Projections from ESPN…', 38);
      if (!root.Projections) return opp;
      return root.Projections.refresh(S.settings.season, week, function (t, p) { step(t, p); })
        .then(function (c) {
          report.steps.push(c.error ? ('projections FAILED: ' + c.error)
                                    : ((c.weekly || 0) + ' week-' + week +
                                       ' projections via ' + c.route));
          return opp;
        });
    }).then(function (opp) {
      if (!root.Ai || !root.Ai.configured()) {
        report.steps.push('Claude: no API key set — skipped');
        return opp;
      }
      var t = root.Store.team(teamId);
      var _c = rosterContext(week, teamId, opp);
      var research = _c.players, settled = _c.settled, carried = _c.carriedList;

      if (!research.length) {
        report.steps.push('Claude: nothing has changed since the last check — ' +
          carried.length + ' verdicts carried forward, nothing spent');
        return opp;
      }

      step('Claude is reading this week\'s news…', 62);
      return root.Ai.ask(_c, function (t2, p2) { step(t2, p2); }).then(function (r) {
        mergeAi(week, r, { researched: research.length, carried: carried.length,
                           settled: settled.length });
        report.steps.push('Claude researched ' + r.count + ' of ' + t.players.length +
          ' (' + carried.length + ' carried forward, ' + settled.length +
          ' already settled) with ' + r.searchBudget + ' searches — ' + r.model);
        if (r.truncated) {
          report.steps.push('NOTE: Claude\'s answer was cut off at the token limit. ' +
            'The ' + r.count + ' players that did arrive were kept; the rest were not ' +
            'updated.');
        }
        if (r.spent && root.Usage) {
          report.steps.push('this call cost ' + root.Usage.money(r.spent.cost) +
            ' — ' + r.spent.tokensIn + ' in, ' + r.spent.tokensOut + ' out, ' +
            r.spent.searches + ' web searches');
        }
        return opp;
      }).catch(function (e) {
        report.steps.push('Claude FAILED: ' + (e && e.message ? e.message : e));
        return opp;
      });
    }).then(function () {
      step('Done', 100);
      S.settings.adviceSyncAt = new Date().toISOString();
      root.Store.save();
      return report;
    });
  }

  /* ---- who is worth asking about, and what the asker needs to know --------
   * Extracted from syncAll so the offline Claude-app handoff can build the
   * IDENTICAL context object the live API call is given. If the handoff built
   * its own, the two would describe different rosters the first time either
   * changed, and the difference would be invisible until a verdict landed on
   * the wrong player.
   *
   * opts.everyone — research every player rather than the triaged subset.
   * The handoff sets it, and that is not laziness: triage exists because a web
   * search costs real money on the API path. When Tj does this in the Claude
   * app it costs him nothing extra, so asking about the whole roster is
   * strictly better there. Same code, different economics, stated once. */
  function rosterContext(week, teamId, opp, opts) {
    opts = opts || {};
    var S2 = root.Store.get();
    var dp = defenseProfile(week);
    var t = root.Store.team(teamId);
    var research = [], settled = [], carried = [], carriedNames = [];
    var fresh = freshMs();
    var deep = !!opts.everyone ||
               (root.Ai && root.Ai.depth && root.Ai.depth() === 'full');

      /* ---- TRIAGE (v2.4) --------------------------------------------------
       * A web search costs about what ten thousand input tokens cost, so the
       * question is not "how do we ask for less" but "who is worth asking
       * about at all". Three buckets:
       *   SETTLED  — the app already knows the answer with certainty (a bye,
       *              an ESPN OUT/IR). A search cannot improve on that, and the
       *              player is excluded from every slot either way.
       *   RESEARCH — anyone whose answer could actually move: a designation, a
       *              stale or non-clear verdict, a role that just changed, or
       *              somebody never checked at all.
       *   CARRIED  — checked recently, came back clear, nothing since. His
       *              previous verdict is reused verbatim, with its own date
       *              shown in the UI so nothing pretends to be newer than it is.
       * Quality is not the thing being traded away here: every player who could
       * have news still gets searched, and "full" depth restores the old
       * everyone-every-time behaviour in one tap. */
      t.players.forEach(function (p) {
        var x = projectOne(p, week, (opp && p.nfl) ? opp[p.nfl] : null, dp);
        var lab = String(x.h.label || '');
        var row = { name: p.name, pos: p.pos, nfl: p.nfl,
                    opp: x.opp || '', onBye: x.onBye, proj: x.base,
                    feedStatus: lab };
        if (x.onBye) { settled.push({ name: p.name, why: 'on bye in week ' + week }); return; }
        if (/OUT|^IR$|SUSP/i.test(lab)) {
          settled.push({ name: p.name, why: 'ESPN has him ' + lab });
          return;
        }
        var prev = aiCache.byName ? aiCache.byName[norm(p.name)] : null;
        var why = '';
        if (deep) why = 'full depth';
        else if (lab) why = 'ESPN lists him ' + lab;
        else if (!prev || !prev.at) why = 'never checked';
        else if (Date.now() - prev.at > fresh) why = 'last checked ' + ago(prev.at);
        else if (prev.week !== week) why = 'that verdict was for week ' + prev.week;
        else if (prev.status && prev.status !== 'clear') why = 'was ' + prev.status + ' last time';
        else { var _sw = usageSwing(p, week); if (_sw) why = _sw; }
        if (why) { row.why = why; research.push(row); }
        else { carried.push(p.name); carriedNames.push(p.name); }
      });

    return { week: week, season: S2.settings.season,
             today: new Date().toISOString().slice(0, 10),
             players: research, settled: settled, carried: carriedNames,
             carriedList: carried, teamName: t ? t.name : '' };
  }

  /* ---- UI -------------------------------------------------------------- */
  function render(host, ctx) {
    var el = ctx.el, fmt = ctx.fmt, week = ctx.week, teamId = ctx.teamId;
    loadCaches();
    var S = root.Store.get();
    var team = root.Store.team(teamId);
    var pm = root.Projections ? root.Projections.meta() : { count: 0, at: 0 };

    /* --- sync card --- */
    var head = el('div', 'card');
    head.appendChild(el('h2', null, 'Week ' + week + ' advice · ' + team.name));

    var st = el('div');
    function line(label, text, bad) {
      var r = el('div', 'kv');
      r.appendChild(el('span', bad ? 'warnText' : null, label + ': ' + text));
      st.appendChild(r);
    }
    var gaps = (root.Projections && pm.count) ? root.Projections.missing(team.players) : [];
    line('Projections', pm.count
      ? (pm.weekly + ' week-' + pm.week + ' lines, ' + ago(pm.at) +
         (gaps.length ? ' · ' + gaps.length + ' of your ' + team.players.length +
                        ' unmatched' : ' · all of your roster matched'))
      : (pm.error ? 'failed — ' + pm.error : 'not loaded'), !pm.count || gaps.length > 0);
    if (gaps.length) {
      /* A starting QB quietly falling back to his preseason number is exactly
         the kind of thing that hides in plain sight, so it gets named. */
      var gd = el('details');
      gd.appendChild(el('summary', null, 'who has no week-' + pm.week + ' projection ▾'));
      gaps.forEach(function (g) {
        var kv = el('div', 'kv');
        kv.appendChild(el('span', null, g.name + ' (' + g.pos + ')' +
          (g.partial ? ' — season projection only' : ' — nothing from ESPN')));
        gd.appendChild(kv);
      });
      gd.appendChild(el('p', 'hint',
        'These fall back to their preseason projection and their own scored ' +
        'games, which still works — it is just one fewer source. If a starter ' +
        'is here every week, check Data → Test the projection feed.'));
      st.appendChild(gd);
    }
    line('Injury feed', newsCache.at
      ? (newsCache.error ? 'failed — ' + newsCache.error
         : (newsCache.count || 0) + ' records, ' + ago(newsCache.at))
      : 'not loaded', !!newsCache.error || !newsCache.at);
    if (root.Usage && root.Ai && root.Ai.configured()) {
      var ut = root.Usage.load() && root.Usage.totals();
      if (ut.calls) {
        line('Spend', root.Usage.money(ut.spend) + ' so far' +
          (ut.perSync ? ' · ' + root.Usage.money(ut.perSync) + ' per sync' : '') +
          (ut.budget ? ' · ' + root.Usage.money(ut.remaining) + ' left' : ''),
          !!(ut.budget && ut.pct > 90));
      }
    }
    line('Claude', root.Ai && root.Ai.configured()
      ? (aiCache.at ? (aiCache.count || Object.keys(aiCache.byName || {}).length) +
                      ' players reviewed, ' + ago(aiCache.at) +
                      (aiCache.week && aiCache.week !== week ? ' (for week ' + aiCache.week + ')' : '')
                    : 'key set, not run yet')
      : 'no API key — add one on the Data tab for news-aware reasoning',
      !(root.Ai && root.Ai.configured()));
    head.appendChild(st);

    var running = ctx.jobRunning('advice');
    var sync = el('button', 'btn pri', running ? 'Working…' : 'Sync advice  ↻');
    sync.disabled = running;
    sync.addEventListener('click', function () {
      sync.disabled = true; sync.textContent = 'Working…';
      ctx.jobStart('advice', 'Advice: starting…');
      /* An elapsed counter, because the Claude step legitimately runs for a
         minute or two and a bar that has not moved in 90 seconds reads as a
         crash. This can only tick at all because the bridge is async now. */
      var t0 = Date.now(), lastText = 'Advice: starting…';
      var tick = root.setInterval(function () {
        var s = Math.round((Date.now() - t0) / 1000);
        ctx.jobStep(lastText + '  (' + s + 's)');
      }, 1000);
      function stop() { root.clearInterval(tick); ctx.jobEnd(); }

      syncAll(week, teamId, function (t, p) {
        lastText = 'Advice: ' + t;
        ctx.jobStep(lastText + '  (' + Math.round((Date.now() - t0) / 1000) + 's)', p);
      })
        .then(function (rep) {
          stop();
          ctx.modal('Advice synced  ·  ' + Math.round((Date.now() - t0) / 1000) + 's',
                    rep.steps.join('\n'));
          ctx.rerender();
        })
        .catch(function (e) {
          stop();
          ctx.modal('Advice sync failed', (e && e.stack) ? e.stack : String(e));
          ctx.rerender();
        });
    });
    head.appendChild(sync);
    head.appendChild(el('p', 'hint',
      'Pulls this week\'s schedule, the ESPN injury report and ESPN\'s projected ' +
      'stat lines, re-scores every projection under this league\'s rules, then — ' +
      'if a key is set — has Claude search current news for each player on this ' +
      'roster and adjust with its reasoning shown. The Claude step searches the ' +
      'web and normally takes 45-120 seconds; the app stays usable throughout, ' +
      'and you can switch tabs without losing it.'));
    /* The pre-Sunday alert leads the Advice tab as well. This is the screen he
       opens to decide a lineup, so a Thursday deadline belongs above the
       advice rather than below them. */
    if (ctx.earlyGameCard) {
      try { var eg = ctx.earlyGameCard(); if (eg) host.appendChild(eg); }
      catch (e) { /* never take the screen down for a reminder */ }
    }
    host.appendChild(head);

    /* The offline round trip sits directly under the Sync card, which is where
       Tj asked for it and also where the choice actually is: two ways to do the
       same job, one paid per call and one not. It is wrapped because a card
       that throws must not take the whole Advice screen down with it. */
    if (ctx.adviceHandoff) {
      try { host.appendChild(ctx.adviceHandoff()); }
      catch (e) {
        var bad = el('div', 'card');
        bad.appendChild(el('h2', null, 'The Claude-app handoff could not be built'));
        bad.appendChild(el('p', 'hint', (e && e.message) ? e.message : String(e)));
        host.appendChild(bad);
      }
    }

    var holder = el('div');
    host.appendChild(holder);

    function build() {
      holder.innerHTML = '';
      var opp = (S.weekMeta[String(week)] && S.weekMeta[String(week)].opponents) || null;
      var all = projectAll(week, teamId, opp);
      var byId = {}; all.forEach(function (x) { byId[x.p.id] = x; });
      var picks = bestLineup(week, teamId, opp);
      var cur = root.Store.getLineup(week, teamId);

      if (aiCache.summary && aiCache.week === week) {
        var sc = el('div', 'card');
        sc.appendChild(el('h2', null, 'Claude\'s read on the week'));
        sc.appendChild(el('p', null, aiCache.summary));
        sc.appendChild(el('p', 'hint', aiCache.model + ' · ' + ago(aiCache.at)));
        holder.appendChild(sc);
      }

      var c = el('div', 'card');
      c.appendChild(el('h2', null, 'Recommended lineup'));
      var recTotal = 0, curTotal = 0, changes = 0;
      picks.forEach(function (s) {
        if (s.pick) recTotal += s.pick.proj;
        var curPid = cur[s.key];
        if (curPid && byId[curPid]) curTotal += byId[curPid].proj;
        if (s.pick && curPid !== s.pick.p.id) changes++;

        var row = el('div', 'row');
        row.appendChild(el('div', 'slot', s.label));
        var nm = el('div', 'nm');
        if (!s.pick) nm.appendChild(el('span', 'muted', 'no eligible player'));
        else {
          nm.appendChild(document.createTextNode(s.pick.p.name));
          /* the kickoff, on the screen where he decides who to start */
          if (ctx.gameBadge) {
            var gbA = ctx.gameBadge(s.pick.p.nfl);
            if (gbA) nm.appendChild(gbA);
          }
          nm.appendChild(el('small', null, '  ' + s.pick.p.pos + ' ' + s.pick.p.nfl +
            (s.pick.opp ? ' vs ' + s.pick.opp : '')));
          s.pick.flags.forEach(function (f) {
            nm.appendChild(el('span', f.kind === 'out' ? 'tag out' : 'tag warn',
                              f.text.split(' — ')[0].split(':')[0]));
          });
          if (s.forced) nm.appendChild(el('span', 'tag out', 'nothing else eligible'));
          if (curPid && curPid !== s.pick.p.id) nm.appendChild(el('span', 'tag est', 'change'));
        }
        row.appendChild(nm);
        row.appendChild(el('div', 'pts', s.pick ? fmt(s.pick.proj) : '—'));
        c.appendChild(row);

        if (s.pick) {
          var d = el('details');
          d.appendChild(el('summary', null, 'why ▾'));
          s.pick.why.forEach(function (w) {
            var kv = el('div', 'kv'); kv.appendChild(el('span', null, w)); d.appendChild(kv);
          });
          if (s.alts.length) {
            var a = el('div', 'kv');
            a.appendChild(el('span', null, 'next best: ' + s.alts.map(function (x) {
              return x.p.name + ' ' + fmt(x.proj);
            }).join(' · ')));
            d.appendChild(a);
          }
          c.appendChild(d);
        }
      });
      var sum = el('div', 'kv'); sum.style.marginTop = '10px';
      sum.appendChild(el('span', null, 'projected ' + fmt(recTotal) +
        ' vs your current ' + fmt(curTotal) +
        (recTotal > curTotal ? '  (+' + fmt(recTotal - curTotal) + ')' : '')));
      c.appendChild(sum);

      var apply = el('button', 'btn pri', changes
        ? ('Apply ' + changes + ' change' + (changes === 1 ? '' : 's'))
        : 'Lineup already optimal');
      apply.disabled = !changes;
      apply.style.marginTop = '8px';
      apply.addEventListener('click', function () {
        picks.forEach(function (s) {
          if (s.pick) root.Store.setSlot(week, teamId, s.key, s.pick.p.id, true);
        });
        ctx.toast('Lineup applied'); ctx.rerender();
      });
      c.appendChild(apply);
      holder.appendChild(c);

      /* --- bench, ranked, so a swap is one glance --- */
      var startIds = {};
      picks.forEach(function (s) { if (s.pick) startIds[s.pick.p.id] = 1; });
      var bench = all.filter(function (x) { return !startIds[x.p.id]; })
                     .sort(function (a, b) { return b.proj - a.proj; });
      if (bench.length) {
        var bc = el('div', 'card');
        bc.appendChild(el('h2', null, 'Bench, ranked'));
        bench.forEach(function (x) {
          var r = el('div', 'row');
          r.appendChild(el('div', 'slot', x.p.pos));
          var nm2 = el('div', 'nm');
          nm2.appendChild(document.createTextNode(x.p.name));
          nm2.appendChild(el('small', null, '  ' + x.p.nfl + (x.opp ? ' vs ' + x.opp : '')));
          x.flags.forEach(function (f) {
            nm2.appendChild(el('span', f.kind === 'out' ? 'tag out' : 'tag warn',
                               f.text.split(' — ')[0].split(':')[0]));
          });
          r.appendChild(nm2);
          r.appendChild(el('div', 'pts' + (x.startable ? '' : ' bye'), fmt(x.proj)));
          bc.appendChild(r);
        });
        holder.appendChild(bc);
      }

      /* --- everything flagged --- */
      var warn = el('div', 'card');
      warn.appendChild(el('h2', null, 'Flagged — will not be recommended'));
      var items = [];
      all.forEach(function (x) {
        x.flags.forEach(function (f) {
          items.push({ kind: f.kind, text: x.p.name + ' (' + x.p.pos + ') — ' + f.text });
        });
      });
      if (!items.length) {
        warn.appendChild(el('p', 'muted',
          'Nothing flagged. No byes, no injury designations, and nothing Claude found ' +
          'that would stop anyone on this roster playing a normal week.'));
      } else {
        items.sort(function (a, b) { return (a.kind === 'out' ? 0 : 1) - (b.kind === 'out' ? 0 : 1); });
        items.forEach(function (t) {
          var kv = el('div', 'kv');
          kv.appendChild(el('span', t.kind === 'out' ? 'warnText' : null, t.text));
          warn.appendChild(kv);
        });
      }
      holder.appendChild(warn);

      var note = el('div', 'card');
      note.appendChild(el('h2', null, 'How this is calculated'));
      note.appendChild(el('p', 'muted',
        'Up to five sources, EVERY one of them converted into this league\'s ' +
        'points before anything is combined: ESPN\'s projected stat line for ' +
        'this week re-scored under our rules, Sleeper\'s projected stat line ' +
        're-scored the same way as an independent second opinion, this ' +
        'player\'s own scored games in the app, his draft-time projection, and ' +
        'ESPN\'s full-season projection per game. Weights shift ' +
        'toward measured games as the season goes on. Then the opponent\'s ' +
        'measured generosity to the position (half strength when ESPN\'s weekly ' +
        'number is present, because that already prices the matchup), then the ' +
        'injury feed, then Claude if a key is set. Byes, OUT designations, ' +
        'suspensions and anything Claude says will not play are removed from ' +
        'consideration outright rather than reduced.'));
      note.appendChild(el('p', 'hint',
        'Why the conversion matters: every outside projection you can find is ' +
        'computed in half-PPR standard scoring, where a completed pass is worth ' +
        'nothing. Here it is worth a point, which is most of a quarterback\'s ' +
        'score and none of anybody else\'s. So their STAT LINE is imported and ' +
        're-scored here, and their own "projected points" are never used for ' +
        'anything. Tap any player to see each source\'s number and its weight.'));
      holder.appendChild(note);
    }
    build();
  }

  root.Recommend = { render: render, loadNews: loadNews, bestLineup: bestLineup,
                     autoLineup: autoLineup, projectAll: projectAll,
                     opponentsForWeek: opponentsForWeek, syncAll: syncAll,
                     loadCaches: loadCaches, PRIOR: PRIOR,
                     /* the offline Claude-app handoff writes through these */
                     mergeAi: mergeAi, aiCache: function () { return aiCache; },
                     rosterContext: rosterContext };
})(typeof window !== 'undefined' ? window : this);
