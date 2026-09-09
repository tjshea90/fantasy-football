/* scoring.js — league scoring engine. Pure. No I/O, no DOM, no network.
 * Ground truth: RULES_2026.md. Any change here must cite that file.
 * ES2018 only (Android 10 WebView / Chromium 77): no ?. no ?? no .at()
 */
(function (root) {
  'use strict';

  var RULES = {
    pass:   { completion: 1, ydsPer: 20, td: 6, twoPt: 2, intercept: -2 },
    rush:   { ydsPer: 10, td: 6, twoPt: 2 },
    rec:    { reception: 1, ydsPer: 10, td: 6, twoPt: 2 },
    fumbleLost: -2,
    kick: {
      xpMade: 1, xpMiss: -1,
      /* [maxDistanceInclusive, madePts, missPts] — order matters */
      fg: [[39, 3, -3], [49, 4, -2], [59, 5, -1], [9999, 6, 0]]
    },
    dst: { intercept: 2, sack: 2, fumbleRecovery: 2, defTD: 6, safety: 4, returnTD: 6 },
    /* points allowed, per game: [maxAllowedInclusive, points] */
    paTiers: [[0, 10], [10, 7], [20, 5], [30, 1], [9999, 0]],
    weeklyLongBonus: 5
  };

  /* RESOLVED BY TJ, 2026-09-09. This used to be a setting.
   *
   * "Kickoff/Punt return TD +6" is printed under Defense/ST on the rules sheet,
   * and v1.8 called that the one genuine ambiguity in the image: does the
   * returning PLAYER also get paid? It became `RULES.individualReturnTD`, a
   * toggle on the Data tab, defaulting to the literal reading.
   *
   * Tj settled it: "a defense touchdown is only scored one time. individual
   * player doesn't matter." So the +6 goes to the D/ST, once, always.
   *
   * The setting is GONE rather than pinned to false, because while it existed
   * it was wrong in both positions. Turning it ON did not MOVE the six points,
   * it ADDED them — score() paid `L.ret.td` to the returner and still paid
   * `D.retTD` to the defense in the same pass, so one punt return scored 12
   * league points. That is the same defect as the v1.8 pick-six (two feeds
   * describing one score, both counted), reintroduced behind a switch. And the
   * memo signature never covered the flag, so flipping it changed no number on
   * screen until the app was restarted — the toggle could not even be trusted
   * to do the wrong thing consistently.
   *
   * Return touchdowns are still RECORDED on the player's line (`L.ret.td`) —
   * it is true, it is free, and the player card shows it as context. It is
   * simply never scored. There is now exactly one place a return TD is worth
   * points: the D/ST block below.
   *
   * configure() is kept as a no-op shim so an older saved state calling it
   * with the dead key is harmless. */
  function configure(opts) {
    return RULES;
  }

  function n(v) { var x = Number(v); return isFinite(x) ? x : 0; }

  function fgPoints(distance, made) {
    var t = RULES.kick.fg, i;
    for (i = 0; i < t.length; i++) {
      if (distance <= t[i][0]) return made ? t[i][1] : t[i][2];
    }
    return 0;
  }

  function paPoints(allowed) {
    /* RULES_2026.md notes the tier list has no entry for exactly 1 point
     * allowed; it is treated as the 2-10 tier. The [0,10] then [10,7] order
     * below does exactly that: 0 -> 10, 1..10 -> 7. */
    var t = RULES.paTiers, i;
    for (i = 0; i < t.length; i++) if (allowed <= t[i][0]) return t[i][1];
    return 0;
  }

  /* Empty normalised stat line. espn.js fills this in; nothing else. */
  function emptyLine() {
    return {
      pass: { cmp: 0, yds: 0, td: 0, int: 0, twoPt: 0, long: 0 },
      rush: { yds: 0, td: 0, twoPt: 0, long: 0 },
      rec:  { rec: 0, yds: 0, td: 0, twoPt: 0, long: 0 },
      /* individual kick/punt return TDs — only scored when the league is
         configured to pay the returner rather than the D/ST (see RULES) */
      ret:  { td: 0 },
      fum:  { lost: 0 },
      kick: { fg: [], xpMade: 0, xpAtt: 0, est: false },
      dst:  { sacks: 0, int: 0, fr: 0, defTD: 0, safety: 0, retTD: 0,
              pointsAllowed: null },
      bonus: { longComp: false, longRec: false, longRush: false },
      /* USAGE — never scored, never touched by score(). Opportunity is what
         predicts next week; points are what happened last week. Carried on the
         line so the trend view and the free-agent board need no second fetch. */
      use:  { patt: 0, car: 0, tgts: 0 },
      manualAdj: 0,
      played: false
    };
  }

  /* score(line) -> { total, parts: [{label, pts}] }
   * parts exists so the UI can show exactly why a number is what it is.
   *
   * MEMOISED ON THE LINE OBJECT (v3.8). The same stat line is re-scored many
   * times per render — teamWeekPoints -> playerPoints -> lineFor -> score, and
   * the League tab runs teamWeekPoints ~560 times over the same lines. The
   * alternative, a separate arithmetic-only fast path, would mean two
   * implementations of the scoring engine, and the scoring engine is the
   * product: one of them would drift and it would be the one nobody tested.
   *
   * A line object is immutable after espn.js parses it EXCEPT for two things:
   * `manualAdj`, which Tj edits, and the three weekly `bonus` flags, which
   * applyWeeklyBonuses sets afterwards. Both are in the signature, so an edit
   * invalidates the memo. The cache is non-enumerable: the whole state is
   * JSON.stringified on every save, and a cached object riding along in the
   * book would bloat every write. */
  /* RULES_EPOCH is in the signature on purpose, and it is not currently used.
   *
   * The memo used to cover only manualAdj and the bonus flags — every input
   * that could change a line. It did NOT cover the scoring RULES themselves,
   * which `configure()` could mutate at runtime. So flipping the return-TD
   * setting changed no number on screen: every line already scored kept its
   * cached total until the app restarted. The setting is gone now (see the
   * note on RULES), so RULES is immutable again and the signature is complete
   * without this term.
   *
   * It stays because the NEXT runtime-configurable rule would silently
   * reintroduce that bug, and it would be invisible — the arithmetic is right,
   * only the cache is stale. Anything that mutates RULES must bump this, and
   * tools/test_scoring.js asserts that a bump busts the cache. One integer. */
  var RULES_EPOCH = 1;
  function memoSig(L) {
    var b = L.bonus;
    return RULES_EPOCH + '|' + n(L.manualAdj) + '|' +
      (b ? ((b.longComp ? 1 : 0) + (b.longRec ? 2 : 0) + (b.longRush ? 4 : 0)) : 0);
  }
  /* Test seam and the hook any future configure() must call. */
  function bumpRulesEpoch() { RULES_EPOCH++; return RULES_EPOCH; }
  function score(line) {
    var L = line || emptyLine();
    var sig = memoSig(L);
    if (L.__sc && L.__scSig === sig) return L.__sc;
    var parts = [];
    function add(label, pts) {
      pts = Math.round(pts * 100) / 100;
      if (pts !== 0) parts.push({ label: label, pts: pts });
      return pts;
    }
    var total = 0;
    var P = L.pass, R = L.rush, C = L.rec, K = L.kick, D = L.dst;

    if (P) {
      total += add('Completions ' + n(P.cmp), n(P.cmp) * RULES.pass.completion);
      total += add('Pass yds ' + n(P.yds), n(P.yds) / RULES.pass.ydsPer);
      total += add('Pass TD ' + n(P.td), n(P.td) * RULES.pass.td);
      total += add('INT ' + n(P.int), n(P.int) * RULES.pass.intercept);
      total += add('Pass 2PT ' + n(P.twoPt), n(P.twoPt) * RULES.pass.twoPt);
    }
    if (R) {
      total += add('Rush yds ' + n(R.yds), n(R.yds) / RULES.rush.ydsPer);
      total += add('Rush TD ' + n(R.td), n(R.td) * RULES.rush.td);
      total += add('Rush 2PT ' + n(R.twoPt), n(R.twoPt) * RULES.rush.twoPt);
    }
    if (C) {
      total += add('Receptions ' + n(C.rec), n(C.rec) * RULES.rec.reception);
      total += add('Rec yds ' + n(C.yds), n(C.yds) / RULES.rec.ydsPer);
      total += add('Rec TD ' + n(C.td), n(C.td) * RULES.rec.td);
      total += add('Rec 2PT ' + n(C.twoPt), n(C.twoPt) * RULES.rec.twoPt);
    }
    /* NOT SCORED HERE. A return touchdown is worth six points ONCE, to the
       D/ST, in the D block below. L.ret.td is recorded for the player card and
       is deliberately worth nothing. See the note on RULES above. */
    if (L.fum) total += add('Fumbles lost ' + n(L.fum.lost), n(L.fum.lost) * RULES.fumbleLost);

    if (K) {
      var i, fgPts = 0, made = 0, missed = 0;
      for (i = 0; i < (K.fg || []).length; i++) {
        var a = K.fg[i];
        fgPts += fgPoints(n(a.dist), !!a.made);
        if (a.made) made++; else missed++;
      }
      if (made || missed) total += add('FG ' + made + '/' + (made + missed) + (K.est ? ' (est)' : ''), fgPts);
      total += add('XP ' + n(K.xpMade), n(K.xpMade) * RULES.kick.xpMade);
      var xpMiss = Math.max(0, n(K.xpAtt) - n(K.xpMade));
      total += add('XP missed ' + xpMiss, xpMiss * RULES.kick.xpMiss);
    }

    if (D) {
      total += add('Sacks ' + n(D.sacks), n(D.sacks) * RULES.dst.sack);
      total += add('DST INT ' + n(D.int), n(D.int) * RULES.dst.intercept);
      total += add('Fum rec ' + n(D.fr), n(D.fr) * RULES.dst.fumbleRecovery);
      total += add('Def TD ' + n(D.defTD), n(D.defTD) * RULES.dst.defTD);
      total += add('Return TD ' + n(D.retTD), n(D.retTD) * RULES.dst.returnTD);
      total += add('Safety ' + n(D.safety), n(D.safety) * RULES.dst.safety);
      if (D.pointsAllowed !== null && D.pointsAllowed !== undefined) {
        total += add('Pts allowed ' + n(D.pointsAllowed), paPoints(n(D.pointsAllowed)));
      }
    }

    if (L.bonus) {
      if (L.bonus.longComp) total += add('Longest completion of week', RULES.weeklyLongBonus);
      if (L.bonus.longRec)  total += add('Longest reception of week', RULES.weeklyLongBonus);
      if (L.bonus.longRush) total += add('Longest rush of week', RULES.weeklyLongBonus);
    }
    if (n(L.manualAdj)) total += add('Manual adjustment', n(L.manualAdj));

    var res = { total: Math.round(total * 100) / 100, parts: parts };
    try {
      if (!Object.prototype.hasOwnProperty.call(L, '__sc')) {
        Object.defineProperty(L, '__sc', { value: null, writable: true, enumerable: false, configurable: true });
        Object.defineProperty(L, '__scSig', { value: '', writable: true, enumerable: false, configurable: true });
      }
      L.__sc = res; L.__scSig = sig;
    } catch (e) { /* frozen or exotic object — scoring still works, just uncached */ }
    return res;
  }

  /* Weekly league-wide +5 bonuses. Mutates the bonus flags on the winning
   * lines. lines = [{key, line, isQB}] for EVERY player in EVERY game that
   * week, not just rostered ones — the rule is league-wide.
   * qbOfLongestCompletion: key of the QB who threw the longest completion,
   * supplied by espn.js from play-by-play; null if it could not be determined. */
  function applyWeeklyBonuses(lines, qbOfLongestCompletion) {
    var i, bestRec = -1, bestRecIdx = -1, bestRush = -1, bestRushIdx = -1;
    for (i = 0; i < lines.length; i++) {
      var L = lines[i].line;
      if (L.rec && n(L.rec.long) > bestRec) { bestRec = n(L.rec.long); bestRecIdx = i; }
      if (L.rush && n(L.rush.long) > bestRush) { bestRush = n(L.rush.long); bestRushIdx = i; }
      L.bonus.longComp = false; L.bonus.longRec = false; L.bonus.longRush = false;
    }
    if (bestRecIdx >= 0 && bestRec > 0) lines[bestRecIdx].line.bonus.longRec = true;
    if (bestRushIdx >= 0 && bestRush > 0) lines[bestRushIdx].line.bonus.longRush = true;
    if (qbOfLongestCompletion) {
      for (i = 0; i < lines.length; i++) {
        if (lines[i].key === qbOfLongestCompletion) { lines[i].line.bonus.longComp = true; break; }
      }
    }
    return {
      longestReception: bestRec, longestRush: bestRush,
      recWinner: bestRecIdx >= 0 ? lines[bestRecIdx].key : null,
      rushWinner: bestRushIdx >= 0 ? lines[bestRushIdx].key : null,
      compWinner: qbOfLongestCompletion || null
    };
  }

  /* ---- audit -------------------------------------------------------------
   * describe() is generated FROM the RULES object, never hand-written, so the
   * screen that shows Tj "this is what the app pays" cannot drift away from
   * what score() actually does. Each row is [item, what the engine pays].
   * Groups are keyed by the roster position they apply to.                  */
  function describe() {
    var K = RULES.kick, D = RULES.dst, i;
    function per(x) { return '+1 per ' + x + ' yds (fractional: 1 yd = ' + (1 / x).toFixed(3).replace(/0+$/, '') + ')'; }
    var fg = [];
    var lo = 0;
    for (i = 0; i < K.fg.length; i++) {
      var hi = K.fg[i][0], band = hi >= 9999 ? (lo + '+') : (lo + '-' + hi);
      fg.push(['FG ' + band + ' made', '+' + K.fg[i][1]]);
      fg.push(['FG ' + band + ' MISSED', String(K.fg[i][2])]);
      lo = hi + 1;
    }
    var pa = [];
    var plo = 0;
    for (i = 0; i < RULES.paTiers.length; i++) {
      var phi = RULES.paTiers[i][0], pb = phi >= 9999 ? (plo + '+') : (plo === phi ? String(plo) : plo + '-' + phi);
      pa.push(['Points allowed ' + pb, '+' + RULES.paTiers[i][1]]);
      plo = phi + 1;
    }
    return [
      { pos: 'QB', title: 'QB — passing (plus all rushing rows below)', rows: [
        ['Completion', '+' + RULES.pass.completion + ' each'],
        ['Passing yards', per(RULES.pass.ydsPer)],
        ['Passing TD', '+' + RULES.pass.td],
        ['Interception thrown', String(RULES.pass.intercept)],
        ['Passing 2-pt conversion', '+' + RULES.pass.twoPt],
        ['Fumble lost', String(RULES.fumbleLost)]
      ] },
      { pos: 'RB', title: 'RB / WR / TE — rushing and receiving', rows: [
        ['Reception', '+' + RULES.rec.reception + ' each (full PPR)'],
        ['Rushing yards', per(RULES.rush.ydsPer)],
        ['Receiving yards', per(RULES.rec.ydsPer)],
        ['Rushing TD', '+' + RULES.rush.td],
        ['Receiving TD', '+' + RULES.rec.td],
        ['2-pt conversion (run or catch)', '+' + RULES.rush.twoPt],
        ['Fumble lost', String(RULES.fumbleLost)],
        ['Kick/punt return TD by this player',
         '0 — the +' + D.returnTD + ' goes to the D/ST, once']
      ] },
      { pos: 'K', title: 'K — kicking', rows: fg.concat([
        ['PAT made', '+' + K.xpMade],
        ['PAT missed', String(K.xpMiss)]
      ]) },
      { pos: 'DEF', title: 'DEF/ST', rows: [
        ['Sack', '+' + D.sack],
        ['Interception', '+' + D.intercept],
        ['Fumble RECOVERY', '+' + D.fumbleRecovery],
        ['Forced fumble', '0 — this league does not score FF'],
        ['Defensive TD', '+' + D.defTD],
        ['Kickoff / punt return TD', '+' + D.returnTD],
        ['Safety', '+' + D.safety]
      ].concat(pa) },
      { pos: 'ALL', title: 'League-wide weekly bonuses (one player each)', rows: [
        ['Longest completion of the week', '+' + RULES.weeklyLongBonus],
        ['Longest reception of the week', '+' + RULES.weeklyLongBonus],
        ['Longest rush of the week', '+' + RULES.weeklyLongBonus]
      ] }
    ];
  }

  /* selfAudit() runs real stat lines through score() and reports what came
   * back, so the audit screen shows computed output rather than a promise.
   * Each case states the arithmetic in the expression, and `ok` is the engine
   * agreeing with it. Anything false here is a bug in the engine, not in the
   * test — the expected values come straight off RULES_2026.md. */
  function selfAudit() {
    function L(fill) { var l = emptyLine(); fill(l); return l; }
    var cases = [
      { pos: 'QB', name: '24/35, 310 yds, 3 TD, 1 INT, 22 rush yds, 1 rush TD',
        exp: 24 + 310 / 20 + 18 - 2 + 2.2 + 6,
        line: L(function (l) {
          l.pass.cmp = 24; l.pass.yds = 310; l.pass.td = 3; l.pass.int = 1;
          l.rush.yds = 22; l.rush.td = 1;
        }) },
      { pos: 'QB', name: 'completion bonus alone: 20 completions',
        exp: 20, line: L(function (l) { l.pass.cmp = 20; }) },
      { pos: 'RB', name: '18 car 96 yds 1 TD, 4 rec 31 yds, 1 fumble lost',
        exp: 9.6 + 6 + 4 + 3.1 - 2,
        line: L(function (l) {
          l.rush.yds = 96; l.rush.td = 1; l.rec.rec = 4; l.rec.yds = 31; l.fum.lost = 1;
        }) },
      { pos: 'WR', name: '9 rec 128 yds 1 TD + 2pt catch',
        exp: 9 + 12.8 + 6 + 2,
        line: L(function (l) { l.rec.rec = 9; l.rec.yds = 128; l.rec.td = 1; l.rec.twoPt = 1; }) },
      { pos: 'TE', name: '5 rec 44 yds, no TD',
        exp: 5 + 4.4, line: L(function (l) { l.rec.rec = 5; l.rec.yds = 44; }) },
      { pos: 'K', name: 'FG 38 made, 45 made, 52 missed, 61 missed, 3/4 PAT',
        exp: 3 + 4 + (-1) + 0 + 3 + (-1),
        line: L(function (l) {
          l.kick.fg = [{ dist: 38, made: true }, { dist: 45, made: true },
                       { dist: 52, made: false }, { dist: 61, made: false }];
          l.kick.xpMade = 3; l.kick.xpAtt = 4;
        }) },
      { pos: 'K', name: 'FG 60 made (top tier)', exp: 6,
        line: L(function (l) { l.kick.fg = [{ dist: 60, made: true }]; }) },
      { pos: 'DEF', name: '4 sacks, 2 INT, 1 FR, 1 def TD, 17 allowed',
        exp: 8 + 4 + 2 + 6 + 5,
        line: L(function (l) {
          l.dst.sacks = 4; l.dst.int = 2; l.dst.fr = 1; l.dst.defTD = 1; l.dst.pointsAllowed = 17;
        }) },
      { pos: 'DEF', name: 'shutout, 1 safety, 1 return TD', exp: 10 + 4 + 6,
        line: L(function (l) {
          l.dst.pointsAllowed = 0; l.dst.safety = 1; l.dst.retTD = 1;
        }) },
      { pos: 'DEF', name: '1 point allowed (tier gap -> 2-10 band)', exp: 7,
        line: L(function (l) { l.dst.pointsAllowed = 1; }) },
      { pos: 'DEF', name: '31 allowed (bottom tier)', exp: 0,
        line: L(function (l) { l.dst.pointsAllowed = 31; }) }
    ];
    var out = [], pass = 0;
    for (var i = 0; i < cases.length; i++) {
      var got = score(cases[i].line).total;
      var exp = Math.round(cases[i].exp * 100) / 100;
      var ok = Math.abs(got - exp) < 0.005;
      if (ok) pass++;
      out.push({ pos: cases[i].pos, name: cases[i].name, got: got, exp: exp, ok: ok });
    }
    return { cases: out, pass: pass, total: cases.length };
  }

  var API = { RULES: RULES, score: score, emptyLine: emptyLine,
              fgPoints: fgPoints, paPoints: paPoints, configure: configure,
              describe: describe, selfAudit: selfAudit,
              applyWeeklyBonuses: applyWeeklyBonuses,
              _bumpRulesEpoch: bumpRulesEpoch };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.Scoring = API;
})(typeof window !== 'undefined' ? window : this);
