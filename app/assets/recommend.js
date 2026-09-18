/* recommend.js — weekly lineup advice. ES2018 only (no ?. no ?? no .at()).
 *
 * HOW A PROJECTION IS BUILT (v5.8 — preseason data removed, Tj 2026-09-14)
 * Independent IN-SEASON sources, all expressed in THIS league's points before
 * they are combined — never in whatever scoring the source shipped with:
 *
 *   1. ESPN's projected stat line for this exact week, re-scored by
 *      scoring.js  (projections.js does the conversion)
 *   2. Sleeper's projected stat line for this exact week, re-scored the same
 *      way — an independent second opinion, never taken at face value either
 *   3. what the player has actually scored in this app's synced weeks
 *   4. ESPN's full-season (rest-of-season) projection, per game — this
 *      updates through the season, unlike a number frozen at draft time
 *
 * Tj, 2026-09-14: "the advice section still pulls projections from preseason
 * sources. I don't like this because this information is stale. Remove all
 * preseason consideration from any recommendations or advice from the entire
 * app." The one source that was computed once, before the season started,
 * and never moved again — the seed-time draft projection (seed.projPG) — is
 * gone from this blend entirely, not down-weighted. Every source left is
 * either fetched fresh for the week in question or is this player's own
 * actual, in-season play.
 *
 * They are weighted, not averaged: the weekly line is the best single number
 * when it exists, and measured games take over as the sample grows. Then
 * three multipliers, in this order:
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

  /* Blend weights. Two OUTSIDE professional projections (ESPN and Sleeper)
     and his own scored games. Sleeper is weighted a little below ESPN
     because ESPN's weekly line is opponent-aware and Sleeper's is thinner,
     not because it is less trustworthy — and the point of carrying both is
     that where they disagree, the average is better than either. EVERY one
     of these is in THIS league's points before it is weighted: the outside
     sources contribute a STAT LINE which scoring.js re-scores. Their own
     "projected points" are half-PPR standard and are never used, anywhere,
     for anything. No preseason number is in this list at all — see the file
     header. */
  var W = { espnWeek: 3.0, sleeperWeek: 2.0, measuredPerGame: 1.0, measuredMax: 4.0,
            espnSeason: 1.0 };

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
    if (root.Projections) {
      root.Projections.loadCache();
      /* the full-season set lives in its own key and its own freshness window
         (projections.js, FULL-SEASON PROJECTIONS) — it has to be loaded too,
         or the rest-of-season engine starts every launch with nothing */
      if (root.Projections.loadSeasonCache) root.Projections.loadSeasonCache();
    }
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
    /* the raw name — bookTrend resolves it tolerantly against however ESPN
       actually spelled the box score; see its own comment in store.js */
    var t = root.Store.bookTrend(p.name, week - 1, 2);
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
          /* NOT `details.type` any more (2026-09-18d). That field is the BODY
             PART — "Knee", "Ankle" — and using it as the fallback `note` fed a
             one-word anatomy label into seasonOutlook's prose matching as if it
             were a news report. shortComment is the real short form; when
             neither comment exists there is simply no note. */
          var det = it.longComment || it.shortComment || '';
          var dt = it.details || {};
          var fs = (dt.fantasyStatus && dt.fantasyStatus.description)
            ? String(dt.fantasyStatus.description).toUpperCase() : '';
          /* THE FIELDS THAT MAKE "OUT FOR THE SEASON" A FACT INSTEAD OF A GUESS
             (2026-09-18d, read off the live feed while fixing the Dalton
             Schultz bug). Every one of these was being thrown away:

               details.returnDate — ESPN's own expected return. Present on all
                 39 IR records in the live pull. Most read October or November,
                 i.e. BACK THIS SEASON; the genuinely finished carry the
                 sentinel 2027-02-15, past the end of the year. This single
                 field separates "on IR, back in week 6" from "done", which the
                 old code could not tell apart at all and called both
                 "out for the season".
               details.fantasyStatus — distinguishes IR from IR-R and PUP-R,
                 the return-designated variants. A man with a return
                 designation is by definition not finished for the year.
               date — when the record was written, so a stale entry can be
                 aged out rather than quoted forever as current news.
               type.name — the stable machine key (INJURY_STATUS_IR) behind the
                 free-text status. */
          if (nm) byName[norm(nm)] = {
            status: st, note: trimNote(det, 600),
            fantasyStatus: fs,
            returnDate: dt.returnDate ? String(dt.returnDate) : '',
            typeName: (it.type && it.type.name) ? String(it.type.name).toUpperCase() : '',
            at: it.date ? String(it.date) : ''
          };
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
    /* Names.hit, not a raw key. The injury cache is keyed by the FEED's
       spelling and this is the ROSTER's: "Kenny Gainwell" against "Kenneth
       Gainwell" returned nothing, so a player ESPN had ruled OUT carried no
       flag and stayed startable. That is the exact failure names.js was
       written for, on the one path where it costs a whole week. */
    var rec = newsCache.byName ? root.Names.hit(newsCache.byName, player.name) : null;
    if (!rec) return { f: 1, label: '', note: '' };
    var s = String(rec.status || ''), f = 1, lab = '';
    if (s.indexOf('OUT') >= 0 || s.indexOf('INJURED RESERVE') >= 0 ||
        s.indexOf('SUSPEND') >= 0 || s.indexOf('PUP') >= 0) { f = HEALTH.OUT; lab = 'OUT'; }
    else if (s.indexOf('DOUBT') >= 0) { f = HEALTH.DOUBTFUL; lab = 'DOUBTFUL'; }
    else if (s.indexOf('QUEST') >= 0) { f = HEALTH.QUESTIONABLE; lab = 'QUESTIONABLE'; }
    else if (s.indexOf('PROB') >= 0) { f = HEALTH.PROBABLE; lab = 'PROBABLE'; }
    return { f: f, label: lab, note: rec.note };
  }

  /* ---- is he done for the YEAR, not just this week? ---------------------
   * Tj, 2026-09-18, rule 6: a kicker, defense or quarterback add is normally
   * low priority "unless there is a strong, clear, season long edge ... or if
   * there is a season ending injury or anything else that mandates the player
   * be replaced." The board therefore has to tell those two apart, and
   * health() cannot: it collapses OUT, INJURED RESERVE, SUSPENDED and PUP into
   * one label 'OUT', which is right for "can he play SUNDAY" and useless for
   * "is he worth a roster spot in November".
   *
   * THE BUG THIS REPLACES (Tj, 2026-09-18d, with a screenshot of the Wire tab
   * claiming 36 of his 17 players were out for the season, four rows of them
   * all saying "replaces Dalton Schultz, who is out for the season"):
   * "Dalton Schultz is not out for the season, but the app claimed he is. This
   * is a major error. I don't know what happened, maybe it pulled old,
   * outdated news."
   *
   * The news was not old. The reading of it was illiterate. The previous
   * version ran one regex over the whole free-text blurb and promoted ANY
   * match to "done for the year", with no idea whose injury the sentence was
   * about or when it happened. Pulled live from ESPN's /injuries feed on
   * 2026-09-18 — the same endpoint loadNews() reads — Schultz's record is:
   *
   *     status: "ACTIVE"
   *     note:   "...Schultz doesn't offer much big-play ability at 30 years
   *              old, but he's a reliable target in the middle of the field
   *              and saw his floor raise when JAYDEN HIGGINS went down with a
   *              SEASON-ENDING torn ACL over the summer."
   *
   * Higgins' injury, Schultz's write-up. The regex saw "season-ending",
   * ignored the word ACTIVE sitting right next to it, and wrote off a healthy
   * starting tight end. Across the live 800-record feed that same regex fires
   * on 14 players and THIRTEEN of them are status ACTIVE — Patrick Mahomes
   * ("last December's season-ending knee injury") and Malik Nabers ("a torn
   * ACL ... in Week 4 of last season") among them, both written off for
   * injuries they have already come back from.
   *
   * So there are exactly two ways this function can be wrong, and the fix has
   * to close both: the note can be about SOMEBODY ELSE, and it can be about a
   * PAST SEASON. Neither is detectable by matching a phrase. What IS reliable
   * is the structured half of the record, which was being discarded entirely:
   *
   *   1. STATUS IS AUTHORITATIVE ABOUT AVAILABILITY. A man ESPN lists ACTIVE
   *      is playing this week. Whatever the prose says, he is not out for the
   *      year, and no amount of matching may promote him. This alone kills 13
   *      of the 14 live false positives.
   *   2. returnDate SAYS WHEN. Every IR record in the live pull carries one.
   *      October and November dates mean back this season; the finished carry
   *      2027-02-15, past the end of the year. "On IR until week 6" and "done"
   *      are different facts and the app now says which one it means.
   *   3. A RETURN DESIGNATION MEANS HE IS COMING BACK. fantasyStatus IR-R and
   *      PUP-R are, literally, "designated to return".
   *
   * The note is demoted to what it actually is: corroboration. It may only
   * promote a player who is ALREADY parked by his designation, it must be
   * about HIM (nearest name before the phrase), and it must not be describing
   * a previous season. See noteSaysDone() below.
   *
   * Deliberately conservative, for the same reason as always: being slow to
   * write a man off costs one sub-optimal roster spot, and writing off a
   * healthy one costs you the player. */

  /* Designations that PARK a player — he is not playing for weeks. Whether
     that is the whole season is a separate question, answered by the dates
     below, not by this list. */
  var PARK_STATUS = /INJURED RESERVE|\bI\.?R\.?\b|\bPUP\b|PHYSICALLY UNABLE|NON.?FOOTBALL|SEASON.?END|SUSPEND/;
  /* ...and the statuses that mean he is available, or merely in doubt, for a
     SINGLE game. None of these can ever be season-ending. */
  var PLAYING_STATUS = /^(ACTIVE|PROBABLE|QUESTIONABLE|DOUBTFUL)$/;
  /* "designated to return" — the feed saying so in its own field. */
  var RETURN_DESIGNATED = /-R$/;

  var SE_NOTE = /(?:out|done|lost|sidelined)\s+for\s+the\s+(?:season|year)|season.?ending|miss(?:ing|ed)?\s+(?:at\s+least\s+)?(?:the\s+)?(?:rest\s+of\s+the\s+|remainder\s+of\s+the\s+|entire\s+|entirety\s+of\s+the\s+)?(?:season|year)|torn\s+(?:acl|achilles|patellar|pectoral|quad)|ruptured\s+achilles/i;

  /* Phrases that mean the injury being described is HISTORY — he had it, he
     came back from it. Every one of these is taken from a real live record
     that the old regex misread. */
  var PAST_NOTE = /\blast\s+(?:season|year|january|february|march|april|may|june|july|august|september|october|november|december)\b|\b(?:return|returned|returning|recover|recovered|recovering|back)\s+(?:from|to)\b|\bhis\s+return\b|\bsince\s+suffering\b|\ba\s+year\s+ago\b/i;
  /* `previously` and `career` were in this list for one draft and taken out
     again: "it was PREVIOUSLY announced that he'd miss the remainder of the
     season" (Da'Shawn Hand, live 2026-09-18) is a CURRENT fact reported with a
     backward-looking adverb, and "career" appears in half the blurbs on the
     feed. Both would have suppressed real reports. Every phrase left here is
     one that can only describe an injury already recovered from. */

  /* Capitalised runs that are not people. Without this, "the Kansas City
     Chiefs" or a sentence opening with "Meanwhile" reads as a player name and
     a genuine report gets thrown away. */
  var NOT_A_NAME = /^(?:The|A|An|His|He|She|They|It|That|This|With|After|Before|And|But|Or|So|Meanwhile|However|Although|Though|While|When|Since|Until|If|In|On|At|For|As|By|From|To|Of|Per|According|Head|Coach|General|Manager|Week|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|January|February|March|April|May|June|July|August|September|October|November|December|NFL|ESPN|IR|PUP|NFI|ACL|MCL|PCL|MRI|TD|Jr|Sr|II|III|IV)$/;

  function lastNameOf(name) {
    var parts = String(name || '').trim().split(/\s+/);
    var i = parts.length - 1;
    /* skip a generational suffix so "Michael Pittman Jr." keys on Pittman */
    while (i > 0 && /^(jr|sr|ii|iii|iv|v)\.?$/i.test(parts[i])) i--;
    return (parts[i] || '').replace(/[^A-Za-z'’-]/g, '');
  }

  /* Who is the nearest person named before `at` in `text`? Returns '' when
     nobody is. This is the whole "whose injury is this" question: in
     "...saw his floor raise when Jayden Higgins went down with a season-ending
     torn ACL", the nearest name before the phrase is Higgins, not Schultz. */
  function subjectBefore(text, at) {
    var re = /([A-Z][A-Za-z'’]*\.?(?:\s*[A-Z][A-Za-z'’-]*\.?)*)/g;
    var m, best = '';
    while ((m = re.exec(text)) !== null) {
      if (m.index >= at) break;
      var run = m[1].trim();
      /* trim trailing non-name words off a run like "Jayden Higgins Wednesday" */
      var toks = run.split(/\s+/), keep = [];
      for (var t = 0; t < toks.length; t++) {
        if (NOT_A_NAME.test(toks[t].replace(/\.$/, ''))) { if (keep.length) break; continue; }
        keep.push(toks[t]);
      }
      if (!keep.length) continue;
      /* POSSESSIVES (found re-reading this change, 2026-09-18d). A blurb
         routinely opens "Hand's move to injured reserve comes as no surprise
         since ... he'd miss the remainder of the season" — his own report, in
         his own sentence, and the only mention of him in it is possessive.
         Without stripping the 's the subject reads "hand's", never matches the
         surname "hand", and a genuinely finished player's own words are thrown
         away as if they were somebody else's. */
      best = keep[keep.length - 1]
        .replace(/[’']s$/i, '')
        .replace(/[^A-Za-z'’-]/g, '');
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    return best;
  }

  /* Split a blurb into sentences, keeping each one's offset in the original
     text so a look-backwards for the subject can cross a sentence boundary.
     Written as a scan rather than a lookbehind split: lookbehind is ES2018 and
     would pass the gate, but there is no reason to require it of a WebView for
     something this simple. */
  function sentencesOf(text) {
    var out = [], start = 0, i;
    for (i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (c !== '.' && c !== '!' && c !== '?') continue;
      /* not an initial ("B.J."), not a decimal, not an abbreviation run */
      var next = text.charAt(i + 1);
      if (next && next !== ' ' && next !== '\n') continue;
      out.push({ at: start, text: text.slice(start, i + 1) });
      while (text.charAt(i + 1) === ' ' || text.charAt(i + 1) === '\n') i++;
      start = i + 1;
    }
    if (start < text.length) out.push({ at: start, text: text.slice(start) });
    return out;
  }

  /* Does this note say THIS player is finished — about him, and about NOW?
     Returns the matched sentence when it does, '' otherwise. */
  function noteSaysDone(note, playerName) {
    var text = String(note || '');
    if (!text) return '';
    var surname = lastNameOf(playerName).toLowerCase();
    var sents = sentencesOf(text), i;
    for (i = 0; i < sents.length; i++) {
      var sent = sents[i].text;
      var m = SE_NOTE.exec(sent);
      if (!m) continue;
      /* a past injury he has already come back from is not news */
      if (PAST_NOTE.test(sent)) continue;
      /* a year before this season, anywhere in the sentence, means history */
      var yr = sent.match(/\b(20\d\d)\b/);
      if (yr && Number(yr[1]) < seasonYear()) continue;
      var subj = subjectBefore(sent, m.index).toLowerCase();
      /* nobody named in this sentence — look back through the whole blurb */
      if (!subj) subj = subjectBefore(text, sents[i].at + m.index).toLowerCase();
      /* no name anywhere: the blurb has only one subject, and it is him */
      if (!subj) return sent;
      if (surname && subj === surname) return sent;
      /* otherwise it is somebody else's injury in his write-up — the exact
         Schultz/Higgins case — and it says nothing about him at all. */
    }
    return '';
  }

  function seasonYear() {
    var S = root.Store && root.Store.get ? root.Store.get() : null;
    var y = S && S.league && S.league.season ? Number(S.league.season) : 0;
    return y || new Date().getFullYear();
  }

  /* When does the regular season actually finish? Anything ESPN promises
     after that is a return that never helps this team. */
  function seasonEndsAt() {
    /* The NFL regular season runs into the first week of January of the
       following calendar year. A return date at or past that is "not this
       season" — which is exactly how the 2027-02-15 sentinel reads. */
    return Date.UTC(seasonYear() + 1, 0, 10);
  }

  function seasonOutlook(player) {
    var rec = newsCache.byName ? root.Names.hit(newsCache.byName, player.name) : null;
    var none = { seasonEnding: false, longTermOut: false, mustReplace: false,
                 why: '', label: '', returnDate: '', returnAround: '' };
    if (!rec) return none;
    var st = String(rec.status || '').toUpperCase();
    var note = String(rec.note || '');
    var fantasy = String(rec.fantasyStatus || '').toUpperCase();

    /* (1) AVAILABILITY IS THE FEED'S TO STATE, NOT THE PROSE'S. This one line
       is what a healthy Dalton Schultz needed. */
    if (PLAYING_STATUS.test(st.trim())) {
      return { seasonEnding: false, longTermOut: false, mustReplace: false,
               why: '', label: '', returnDate: '', returnAround: '', note: note };
    }

    var parked = PARK_STATUS.test(st) || PARK_STATUS.test(fantasy);
    if (!parked) {
      /* A plain weekly OUT is NOT season-ending: he is already excluded from
         this week's lineup by health(), and writing a roster off for the year
         on a one-week designation is the worse error of the two. */
      return { seasonEnding: false, longTermOut: false, mustReplace: false,
               why: '', label: '', returnDate: '', returnAround: '', note: note };
    }

    /* (2)+(3) WHEN IS HE BACK? The feed's own answer, in its own field. */
    var ret = rec.returnDate ? Date.parse(rec.returnDate) : NaN;
    var designatedBack = RETURN_DESIGNATED.test(fantasy);
    var backThisSeason = isFinite(ret) && ret < seasonEndsAt();
    var corroborated = noteSaysDone(note, player.name);

    var label = /PUP|PHYSICALLY UNABLE/.test(st + ' ' + fantasy) ? 'on the PUP list'
              : /SUSPEND/.test(st) ? 'suspended'
              : 'on injured reserve';

    /* NO DATE AND NO CORROBORATION = NO CLAIM (2026-09-18d). Every IR record
       in the live feed carries a returnDate, so this is a shape-change guard
       rather than a live case — but it is the guard that keeps the Schultz
       class of error from coming back by a new route. A designation on its own
       says "parked", never "finished": a six-game suspension and a torn
       Achilles arrive here looking identical, and only the date or his own
       note can tell them apart. With neither, say the smaller true thing. */
    if (!isFinite(ret) && !corroborated) {
      return { seasonEnding: false, longTermOut: true, mustReplace: false,
               label: label, returnDate: '', returnAround: '',
               why: label + ', with no return date given' + (note ? ' — ' + note : ''),
               note: note };
    }

    if (backThisSeason || designatedBack) {
      /* Parked, but coming back — and the app now says so in those words
         instead of calling him finished. */
      return { seasonEnding: false, longTermOut: true, mustReplace: false,
               label: label, returnDate: rec.returnDate || '',
               returnAround: prettyDate(rec.returnDate),
               why: label + (rec.returnDate ? ', not eligible to return until ' +
                    prettyDate(rec.returnDate) : '') + (note ? ' — ' + note : ''),
               note: note };
    }

    /* Parked with no return inside this season: finished. Corroboration from
       his own note is quoted when there is any, because "ESPN has him on IR
       with no return date this season" is a weaker sentence than "he tore an
       Achilles", and the reason is what Tj actually reads. */
    return { seasonEnding: true, longTermOut: false, mustReplace: true,
             label: label, returnDate: rec.returnDate || '',
             returnAround: prettyDate(rec.returnDate),
             why: corroborated
               ? corroborated
               : (rec.status || label) + ' with no return expected this season' +
                 (note ? ' — ' + note : ''),
             note: note };
  }

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
             'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function prettyDate(iso) {
    if (!iso) return '';
    var t = Date.parse(iso);
    if (!isFinite(t)) return '';
    var d = new Date(t);
    return MON[d.getUTCMonth()] + ' ' + d.getUTCDate();
  }

  /* ---- the projection -------------------------------------------------- */
  function projectOne(p, week, opp, dp) {
    var srcs = [], sum = 0, wsum = 0;
    function src(name, pts, weight, detail) {
      if (pts === null || pts === undefined || !isFinite(pts) || weight <= 0) return;
      srcs.push({ name: name, pts: Math.round(pts * 10) / 10, w: weight, detail: detail || '' });
      sum += pts * weight; wsum += weight;
    }

    var pr = root.Projections ? root.Projections.find(p, week) : null;
    var hasWeekly = !!(pr && pr.week !== undefined);
    if (hasWeekly) src('ESPN week ' + week + ' projection', pr.week, W.espnWeek,
                       'their projected stat line, re-scored under our rules');
    if (pr && pr.sleeperWeek !== undefined && pr.sleeperWeek !== null) {
      src('Sleeper week ' + week + ' projection', pr.sleeperWeek, W.sleeperWeek,
          'their projected stat line, re-scored under our rules');
    }
    /* SOURCE 4, RECONNECTED (2026-09-18). The file header above has always
       listed a full-season projection as the fourth input to this blend —
       "this updates through the season, unlike a number frozen at draft
       time". It has never actually fired. This used to read `pr.season` off
       the WEEKLY projection record, and the weekly fetch pins a scoring
       period, which makes ESPN return weekly splits only (proved against the
       live endpoint on 2026-09-18 while overhauling the wire). So the field
       was essentially never set, and the Advice tab's own documented
       season-long anchor silently contributed nothing to any projection,
       ever. projections.js now fetches the season split separately, under
       its own key and its own freshness, and findSeason() is how you read
       it. Both feeds' season numbers count, averaged, exactly as their
       weekly ones already do — where they disagree, the average is better
       than either.

       `pr.season` is still honoured when it happens to be there: an older
       cache on disk may carry it, and a response shape that DOES return a
       season split alongside the week is not something to throw away. */
    var sr = (root.Projections && root.Projections.findSeason)
      ? root.Projections.findSeason(p) : null;
    var seaVals = [], seaNames = [];
    if (sr && typeof sr.season === 'number' && sr.season > 0) {
      seaVals.push(sr.season / Math.max(1, Number(sr.gp) || 17)); seaNames.push('ESPN');
    }
    if (sr && typeof sr.sleeperSeason === 'number' && sr.sleeperSeason > 0) {
      seaVals.push(sr.sleeperSeason / Math.max(1, Number(sr.sleeperGp) || 17));
      seaNames.push('Sleeper');
    }
    if (!seaVals.length && pr && typeof pr.season === 'number' && pr.season > 0) {
      seaVals.push(pr.season / 17); seaNames.push('ESPN');
    }
    if (seaVals.length) {
      var seaSum = 0, si;
      for (si = 0; si < seaVals.length; si++) seaSum += seaVals[si];
      src(seaNames.join(' + ') + ' full-season pace', seaSum / seaVals.length, W.espnSeason,
          seaNames.length > 1
            ? 'their full-season projections, averaged, per game'
            : 'their full-season projection, per game');
    }

    var log = gameLog(p.id, week), i, tot = 0;
    for (i = 0; i < log.length; i++) tot += log[i].pts;
    if (log.length) {
      src(log.length + ' game' + (log.length === 1 ? '' : 's') + ' this season',
          tot / log.length, Math.min(W.measuredMax, log.length * W.measuredPerGame),
          'his own scored games in this app');
    }
    if (!srcs.length) {
      src('positional average', PRIOR[p.pos] || 10, 1, 'no projection on file for him');
    }

    var base = sum / wsum;
    var mf = matchupFactor(dp, opp, p.pos);
    /* half strength when ESPN's weekly line already prices the matchup */
    var mfApplied = hasWeekly ? (1 + (mf.f - 1) * 0.5) : mf.f;
    var h = health(p);
    /* Names.hit: ai.js files verdicts under Names.canon and this used to read
       under Espn.normName, so every verdict for a nickname-first-name player
       ("Chris" -> "christopher") was silently discarded — adjustment, reasoning
       AND the hard not-playing exclusion. 15 of this league's 170 players. */
    var ai = aiCache.byName ? root.Names.hit(aiCache.byName, p.name) : null;
    /* Store.isOnBye, not `p.bye === week`: it falls back to the league's bye
       table when a player carries no bye of his own, which is what Alerts.java
       has always done. The two used to disagree — the notification would warn
       about a bye the app itself scored right through. */
    var onBye = root.Store.isOnBye(p, week);

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
     slot has literally nothing else, and the pick carries a flag saying so.
     `allProj` is optional — a caller that already ran projectAll for this
     exact week/team/opponents (value.js's upgrades() and waiverContext() both
     do, right before calling myStarters -> here) can pass it through instead
     of paying for the same roster-wide projectOne pass a second time in one
     call. Same shape of fix needs() already applies to its own `starters`
     param, for the identical reason. */
  function bestLineup(week, teamId, opponents, allProj) {
    var all = allProj || projectAll(week, teamId, opponents);
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
    /* 2026-09-15e sweep: this was a hardcoded 2 (regular season) where every
     * other weekGames call site in this app (doSync, liveTick — ui.js) uses
     * week > 18 ? 3 : 2. Currently inert: LAST_WEEK is 17, so `week` here
     * never actually exceeds 18 through any real path — but it is the one
     * call that would silently keep asking ESPN for the wrong seasontype
     * and get back nothing if that cap is ever raised for a playoff bracket,
     * instead of failing the same defensive way the rest of the app already
     * does. Matched for consistency rather than left as a latent trap. */
    return root.Espn.weekGames(S.settings.season, week, week > 18 ? 3 : 2).then(function (games) {
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
          /* Then the FULL-SEASON set, which is what the waiver board actually
             ranks on (Tj, 2026-09-18: "expected full season performance, not
             just the next NFL week"). Separate fetch, separate 12-hour cache,
             so this costs nothing on most syncs. It must never be able to fail
             the sync: the weekly work above already succeeded by this point,
             and a season-projection outage should degrade the ranking, not
             take the whole advice run down with it. */
          if (!root.Projections.refreshSeason) return opp;
          return root.Projections.refreshSeason(S.settings.season,
                                                function (t, p) { step(t, p); })
            .then(function (sc) {
              report.steps.push(sc.error
                ? ('season projections FAILED: ' + sc.error)
                : ((sc.count || 0) + ' full-season projections via ' + sc.route));
              return opp;
            })
            .catch(function (e) {
              report.steps.push('season projections FAILED: ' +
                                (e && e.message ? e.message : String(e)));
              return opp;
            });
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
        /* Names.hit for the same reason as projectOne: reading this under the
           wrong key made 15 players come back "never checked" on EVERY sync,
           so the triage paid for the same search again, week after week. */
        var prev = aiCache.byName ? root.Names.hit(aiCache.byName, p.name) : null;
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

  /* What "Sync advice" would actually cost right now, from the REAL triage
   * and prompt this exact press would send — Ai.adviceSearchBudget is the
   * same function ask() itself calls, so this can never claim a cheaper (or
   * pricier) call than the real one. Wrapped: an estimate must never be
   * able to break the tab it sits on.
   *
   * Memoised (found in review, 2026-09-15): render() calls this on every
   * re-render of the Advice tab's header, and rosterContext() runs a full
   * projectOne() pass over the whole roster to build the triage — largely
   * the SAME per-player pass build()'s own projectAll() below does moments
   * later in this same render, and usageCard() on the Data tab calls this
   * again on every keystroke in a price-rate field. Same key shape as
   * value.js's _faMemo: roster generation covers adds/drops/trades, rates
   * are in the key because editing a price field must still update the
   * number immediately. */
  var _adviceEstMemo = null;
  function claudeAdviceEstimate(week, teamId) {
    try {
      var gen = (root.Store && root.Store.generation) ? root.Store.generation() : 0;
      /* Same model a real ask() call would use for this exact press —
       * ai.js's own depth()==='cheap' ? cheapModel() : model() — found in the
       * 2026-09-15e sweep: this used to estimate at a flat rate table that
       * assumed the main model always, so a 'cheap' depth (real calls sent
       * to Haiku) showed a Sonnet-priced number, silently overstating the
       * cost of the exact call this function exists to price accurately. */
      var mdl = (root.Ai && root.Ai.depth() === 'cheap' && root.Ai.cheapModel)
        ? root.Ai.cheapModel() : (root.Ai ? root.Ai.model() : '');
      var k = week + '|' + teamId + '|' + gen + '|' + mdl + '|' + JSON.stringify(root.Usage.rates(mdl));
      if (_adviceEstMemo && _adviceEstMemo.k === k) return _adviceEstMemo.v;
      var opp = (root.Store.get().weekMeta[String(week)] &&
                 root.Store.get().weekMeta[String(week)].opponents) || null;
      var ctx = rosterContext(week, teamId, opp);
      var n = ctx.players.length;
      /* syncAll() (see the "nothing has changed since the last check" step
       * above) skips the Claude call ENTIRELY — no request, no charge — when
       * nothing needs researching. Found in the 2026-09-15e sweep: this
       * estimate never checked for that case, and Ai.adviceSearchBudget has
       * a hard floor of 2 searches even at n=0, so it kept showing a few
       * cents for a press that would actually cost nothing. That directly
       * broke the one guarantee this function exists to make ("this can
       * never claim a cheaper or pricier call than the real one") in
       * exactly the state a synced, up-to-date roster sits in most of the
       * time. */
      if (n === 0) { var v0 = root.Usage.money(0); _adviceEstMemo = { k: k, v: v0 }; return v0; }
      var budget = root.Ai.adviceSearchBudget(n);
      var promptChars = root.Ai.buildPrompt(ctx).length;
      /* Same reasoning as the wire estimate: output is the fuzzier half,
         search cost dominates the bill either way. */
      var outputTokens = 150 + n * 90 + budget * 60;
      var v = root.Usage.money(root.Usage.estimate(promptChars, budget, outputTokens, mdl));
      _adviceEstMemo = { k: k, v: v };
      return v;
    } catch (e) { return null; }
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
    var gaps = (root.Projections && pm.count) ? root.Projections.missing(team.players, week) : [];
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
        'These fall back to their own scored games this season (or a flat ' +
        'positional average if he has none yet) — it is just one fewer ' +
        'source, never a stale preseason number. If a starter is here every ' +
        'week, check Data → Test the projection feed.'));
      st.appendChild(gd);
    }
    line('Injury feed', newsCache.at
      ? (newsCache.error ? 'failed — ' + newsCache.error
         : (newsCache.count || 0) + ' records, ' + ago(newsCache.at))
      : 'not loaded', !!newsCache.error || !newsCache.at);
    /* Tj, 2026-09-15: "get rid of anywhere it says how much Claude usage I
     * have left, because I no longer have the API key. Instead, put an
     * estimate of what each request would cost." Shown regardless of
     * whether a key is configured — the whole point is he can see this
     * without one — and computed from the REAL triage/prompt this exact
     * sync would send right now, not a stale historical average (once the
     * key is gone, nothing will ever add a new one). */
    if (root.Usage && root.Ai) {
      var estText = claudeAdviceEstimate(week, teamId);
      /* 2026-09-15e sweep: matched wording with the Wire tab's identical
         estimate line (ui.js, claudeWireEstimate's caller) — they used to
         end differently ("— Data → Claude costs" here vs "at current
         prices (Data → Claude costs)." there) for no reason other than
         having been written separately. */
      if (estText) line('Estimated cost to sync', estText +
        ' on the Claude API, at current prices (see Data → Claude costs).');
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

      /* Tj, 2026-09-14: "in the advice tab, when I go to week 2, it still
       * shows me cached numbers for week 1 projections which doesn't make
       * sense. Leave all weeks blank until the app loads the projections."
       * `pm` (Projections.meta(), read at the top of render()) is the week
       * the CACHE actually holds — projectOne now refuses cross-week data
       * itself (see Projections.find), but that alone would just mean every
       * number quietly falls back to measured-games/positional-average,
       * which still LOOKS like a real answer. This is the blunter, more
       * honest version he asked for: nothing computed is shown at all until
       * a sync has actually run for the week in view. The sync card above
       * (and the Claude-app handoff) stay visible either way — those are how
       * he fixes it. */
      if (pm.week !== week) {
        var wait = el('div', 'card');
        wait.appendChild(el('h2', null, 'Week ' + week + ' projections have not loaded yet'));
        wait.appendChild(el('p', 'muted', pm.count
          ? ('The numbers on hand right now are from week ' + pm.week + ', not week ' +
             week + ' — so nothing below is calculated until this week loads. ' +
             'Nothing stale is shown in the meantime.')
          : 'Nothing has been synced yet. Tap "Sync advice" above, or pull down to ' +
            'refresh this tab, to load week ' + week + '\'s numbers.'));
        holder.appendChild(wait);
        return;
      }

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
          /* long-press "View stats" (found missing from this tab entirely in
           * the 2026-09-15e sweep — Tj's original ask was "everywhere else
           * in the app," and this is the one screen that never wired it). */
          if (ctx.markPlayer) ctx.markPlayer(row, s.pick.p.name, s.pick.p.pos, s.pick.p.nfl);
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
          if (ctx.markPlayer) ctx.markPlayer(r, x.p.name, x.p.pos, x.p.nfl);
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

          /* Tj, 2026-09-15: "for the bench players, let me see a Claude
             explanation for each player why not to start them that week,
             just as it explains for why to start the starting players it
             recommends." The data already exists — projectOne() builds this
             same why[] (his projection basis, the matchup, the injury feed,
             and Claude's own reasoning when he was researched) for EVERY
             roster player, starters and bench alike; only the starters'
             card was ever showing it. Same details/'why ▾' pattern as the
             starter rows above, worded "why not" since that is the
             question a bench row answers. */
          if (x.why && x.why.length) {
            var bd = el('details');
            bd.appendChild(el('summary', null, 'why not ▾'));
            x.why.forEach(function (w) {
              var kv2 = el('div', 'kv'); kv2.appendChild(el('span', null, w)); bd.appendChild(kv2);
            });
            bc.appendChild(bd);
          }
        });
        holder.appendChild(bc);
      }

      /* --- this week's opponent, the same treatment (v5.8) -----------------
       * Tj, 2026-09-14: "do this for all of the players on my roster and all
       * of the players on the roster for my opponent of the week... include
       * both benches. Do not do this for any other roster, only mine and my
       * opponent." Same blend (ESPN + Sleeper, each re-scored under this
       * league's rules, plus his measured games and the injury feed), same
       * code path (projectAll works for any team, not just mine) — just a
       * second roster, so he can see what he is playing against without
       * guessing. No Claude research is spent on them; that stays exactly
       * where Tj asked for it, on his own roster only. */
      var oppTeamId = null;
      root.Store.getMatchups(week).forEach(function (pair) {
        if (pair[0] === teamId) oppTeamId = pair[1];
        else if (pair[1] === teamId) oppTeamId = pair[0];
      });
      if (oppTeamId) {
        var oppTeam = root.Store.team(oppTeamId);
        if (oppTeam) {
          var oppAll = projectAll(week, oppTeamId, opp)
            .sort(function (a, b) { return b.proj - a.proj; });
          var oc = el('div', 'card');
          oc.appendChild(el('h2', null, oppTeam.name + ' · blended projections'));
          oc.appendChild(el('p', 'hint',
            'The same multi-source blend and injury feed as your roster above, ' +
            'just their players — their whole roster, bench included, so you can ' +
            'see what you are up against this week.'));
          oppAll.forEach(function (x) {
            var r2 = el('div', 'row');
            if (ctx.markPlayer) ctx.markPlayer(r2, x.p.name, x.p.pos, x.p.nfl);
            r2.appendChild(el('div', 'slot', x.p.pos));
            var nm3 = el('div', 'nm');
            nm3.appendChild(document.createTextNode(x.p.name));
            nm3.appendChild(el('small', null, '  ' + x.p.nfl + (x.opp ? ' vs ' + x.opp : '')));
            x.flags.forEach(function (f) {
              nm3.appendChild(el('span', f.kind === 'out' ? 'tag out' : 'tag warn',
                                 f.text.split(' — ')[0].split(':')[0]));
            });
            r2.appendChild(nm3);
            r2.appendChild(el('div', 'pts' + (x.startable ? '' : ' bye'), fmt(x.proj)));
            oc.appendChild(r2);
          });
          holder.appendChild(oc);
        }
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
        'Up to four IN-SEASON sources, EVERY one of them converted into this ' +
        'league\'s points before anything is combined: ESPN\'s projected stat ' +
        'line for this week re-scored under our rules, Sleeper\'s projected ' +
        'stat line re-scored the same way as an independent second opinion, ' +
        'this player\'s own scored games in the app, and ESPN\'s full-season ' +
        '(rest-of-season) projection per game. No preseason or draft-time ' +
        'number is used anywhere in this — a stale number from before the ' +
        'season started would only get in the way. Weights shift toward ' +
        'measured games as the season goes on. Then the opponent\'s ' +
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
                     seasonOutlook: seasonOutlook,
                     claudeAdviceEstimate: claudeAdviceEstimate,
                     /* the offline Claude-app handoff writes through these */
                     mergeAi: mergeAi, aiCache: function () { return aiCache; },
                     /* read-only, same pattern as aiCache above — lets the Wire
                        tab say HOW OLD the injury designations it is showing
                        actually are, instead of presenting a persisted cache
                        (possibly days old) as if it were current (v5.5b) */
                     newsCache: function () { return newsCache; },
                     rosterContext: rosterContext,
                     /* exported so value.js's free-agent board can apply the
                        EXACT same OUT/IR/SUSPENDED/PUP exclusion this file
                        already applies to a rostered player's lineup slot —
                        one health check, not two that can silently disagree
                        about whether the same man is startable (2026-09-16,
                        Tj's screenshot: three players on ESPN's own Injured
                        Reserve right now were the top-ranked RB free agents,
                        because the wire board never called this at all). */
                     health: health };
})(typeof window !== 'undefined' ? window : this);
