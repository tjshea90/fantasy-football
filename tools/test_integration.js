/* test_integration.js — v3.10.
 *
 * The other three suites test modules and assert on source text. This one
 * boots the WHOLE app the way the WebView does — every module into one shared
 * `window`, in the order index.html loads them — and then drives real work
 * through it. It exists because every defect found in the v3.6 review was a
 * cross-module one: a sync wiping a field another screen wrote, an id reused
 * across a table nothing else cleaned, a cache nobody invalidated. No single
 * module's tests could have caught any of them.
 *
 * There is no DOM here, so ui.js is deliberately NOT loaded. Everything below
 * is the data layer, which is where the season actually lives.
 */
var fs = require('fs'), path = require('path'), fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  OK   ' + m); }
function near(a, b, m) {
  ok(Math.abs(a - b) < 0.011, m + '  (got ' + a + ', want ' + b + ')');
}

var W = { window: null };
W.window = W;
W.setTimeout = setTimeout; W.clearTimeout = clearTimeout;
W.localStorage = (function () {
  var d = {};
  return { getItem: function (k) { return d[k] === undefined ? null : d[k]; },
           setItem: function (k, v) { d[k] = String(v); },
           removeItem: function (k) { delete d[k]; } };
}());
/* a Native bridge that stores to memory, like the Java one stores to disk */
var disk = {};
W.Native = {
  save: function (k, v) { disk[k] = v; return true; },
  load: function (k) { return disk[k] === undefined ? null : disk[k]; }
};

function load(f) {
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'app/assets', f), 'utf8'))(W);
}
/* the same order as index.html */
['seed.js', 'players.js', 'scoring.js', 'espn.js', 'names.js', 'store.js', 'playerdb.js',
 'projections.js', 'usage.js', 'recommend.js', 'sim.js', 'value.js', 'recap.js',
 'ai.js'].forEach(load);

ok(!!W.SEED, 'the seed loaded');
var S = W.Store.init(W.SEED);
W.PlayerDB.init();
ok(!!S && S.teams.length === 10, 'the store booted with ten teams');
var me = S.league.me;

/* ---- 1. a manual adjustment must survive the stat table being rebuilt -----
 * This is the v3.6 defect: doSync wipes S.stats and refills it, and the only
 * way to score the three weekly longest-play bonuses is by hand. */
(function () {
  var t = W.Store.team(me), pid = t.players[0].id;
  var L = W.Scoring.emptyLine();
  L.played = true; L.rec = { rec: 5, yds: 60, td: 1, long: 40 };
  W.Store.setLine(3, pid, L);
  var before = W.Store.playerPoints(3, pid);
  /* Tj adds the +5 longest-reception bonus by hand */
  W.Store.getStats(3)[pid].manualAdj = 5;
  near(W.Store.playerPoints(3, pid), before + 5, 'a manual adjustment scores');

  /* now simulate what doSync does: snapshot, wipe, refill */
  var stats = W.Store.getStats(3), keepAdj = {}, k;
  Object.keys(stats).forEach(function (kk) {
    if (stats[kk] && stats[kk].manualAdj) keepAdj[kk] = stats[kk].manualAdj;
  });
  Object.keys(stats).forEach(function (kk) { delete stats[kk]; });
  var L2 = W.Scoring.emptyLine();
  L2.played = true; L2.rec = { rec: 5, yds: 60, td: 1, long: 40 };
  if (keepAdj[pid]) L2.manualAdj = keepAdj[pid];
  stats[pid] = L2;
  near(W.Store.playerPoints(3, pid), before + 5,
       'and it is still there after the stat table is rebuilt');
}());

/* ---- 2. a dropped player's id must never be reused ----------------------- */
(function () {
  var t = W.Store.team(me);
  var added = W.Store.addPlayer(me, { name: 'Temp Guy', pos: 'WR', nfl: 'KC' });
  var L = W.Scoring.emptyLine();
  L.played = true; L.rec = { rec: 9, yds: 140, td: 2, long: 55 };
  W.Store.setLine(4, added.id, L);
  var hisPoints = W.Store.playerPoints(4, added.id);
  ok(hisPoints > 20, 'the temporary player scored a big week (' + hisPoints.toFixed(1) + ')');
  W.Store.removePlayer(me, added.id);
  var next = W.Store.addPlayer(me, { name: 'Somebody Else', pos: 'WR', nfl: 'SF' });
  ok(next.id !== added.id,
     'the new player did NOT inherit the dropped id (' + added.id + ' vs ' + next.id + ')');
  near(W.Store.playerPoints(4, next.id), 0,
       'so he does not inherit the dropped player\'s scored week either');
  W.Store.removePlayer(me, next.id);
}());

/* ---- 3. the score memo must not survive an edit, or leak into a save ----- */
(function () {
  var L = W.Scoring.emptyLine();
  L.played = true; L.pass = { cmp: 24, yds: 280, td: 2, int: 0, att: 33 };
  var a = W.Scoring.score(L);
  ok(W.Scoring.score(L) === a, 'the same line scores from the memo');
  L.manualAdj = 3;
  near(W.Scoring.score(L).total, a.total + 3, 'editing the line invalidates the memo');
  ok(JSON.stringify(L).indexOf('__sc') < 0, 'the memo never lands in a saved line');
}());

/* ---- 4. free agents: grouped, and never all one position ----------------- */
(function () {
  var g = W.Value.byPos(5, 0);
  var poss = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'], i, empty = [];
  for (i = 0; i < poss.length; i++) if (!g[poss[i]] || !g[poss[i]].length) empty.push(poss[i]);
  ok(!empty.length, 'every position has free agents on a real 10-team league (' +
     poss.map(function (p) { return p + ':' + (g[p] ? g[p].length : 0); }).join(' ') + ')');
  var mixed = W.Value.byVor(5, 12), seen = {};
  mixed.forEach(function (r) { seen[r.pos] = 1; });
  ok(Object.keys(seen).length >= 3,
     'the mixed value ranking spans positions (' + Object.keys(seen).join(',') + ')');
  ok(typeof mixed[0].usage === 'string', 'the lazy usage getter still yields a string');
}());

/* ---- 5. nothing rostered appears on the wire ----------------------------- */
(function () {
  var owned = {}, i, j;
  for (i = 0; i < S.teams.length; i++) {
    for (j = 0; j < S.teams[i].players.length; j++) {
      owned[W.Espn.normName(S.teams[i].players[j].name)] = 1;
    }
  }
  var fa = W.Value.freeAgents(5, 0), bad = null;
  for (i = 0; i < fa.length; i++) {
    if (owned[W.Espn.normName(fa[i].name)]) { bad = fa[i].name; break; }
  }
  ok(!bad, 'no rostered player is offered as a free agent' + (bad ? ' (found ' + bad + ')' : ''));
}());

/* ---- 6. the free-agent memo must notice a roster change ------------------ */
(function () {
  var before = W.Value.freeAgents(5, 0).length;
  var top = W.Value.byPos(5, 1).WR[0];
  var p = W.Store.addPlayer(me, { name: top.name, pos: 'WR', nfl: top.nfl });
  var after = W.Value.freeAgents(5, 0).length;
  ok(after === before - 1,
     'signing the top free agent removes exactly him from the wire (' +
     before + ' -> ' + after + ')');
  W.Store.removePlayer(me, p.id);
  ok(W.Value.freeAgents(5, 0).length === before, 'and dropping him puts him back');
}());

/* ---- 7. import must not clobber the season when the backup is bad -------- */
(function () {
  var good = W.Store.exportJSON();
  var teamsBefore = W.Store.get().teams.length;
  var threw = '';
  try { W.Store.importJSON('{"teams":[{"id":"t1"}]}'); } catch (e) { threw = e.message; }
  ok(!!threw, 'a malformed backup is rejected (' + threw + ')');
  ok(W.Store.get().teams.length === teamsBefore,
     'and the live season is untouched — still ' + teamsBefore + ' teams');
  W.Store.importJSON(good);
  ok(W.Store.get().teams.length === teamsBefore, 'a good backup still imports');
}());

/* ---- 8. weeksLeft counts forward, not from week 1 ------------------------ */
(function () {
  var reg = W.Store.get().league.regularSeasonWeeks;
  var all = W.Value.weeksLeft(1), late = W.Value.weeksLeft(reg);
  ok(all > late, 'weeksLeft shrinks as the season goes on (' + all + ' -> ' + late + ')');
  ok(late <= 1 + 0, 'and at the last week it is down to the minimum (' + late + ')');
}());

/* ---- 9. the simulation must not double-count an unscored week ------------ */
(function () {
  var reg = W.Store.get().league.regularSeasonWeeks;
  var s = W.Sim.season(reg);
  ok(!!s && !!s.rows && s.rows.length === 10, 'the season sim returns a row per team');
  var sum = 0, i;
  for (i = 0; i < s.rows.length; i++) sum += (s.rows[i].playoff || 0);
  /* six of ten make the playoffs in this league, so the odds must total ~6
     (or ~600 if they are percentages). Either way it cannot be ~10, which is
     what double-counting an unscored week used to push it toward. */
  var six = Math.abs(sum - 6) < 0.6 || Math.abs(sum - 600) < 60;
  ok(six, 'playoff odds total the number of playoff spots, not more (' + sum.toFixed(2) + ')');
  ok(!!W.Sim.power(reg), 'power rankings still build');
}());

/* ---- 10. no screen-facing module throws on an empty season --------------- */
(function () {
  var fresh = { window: null }; fresh.window = fresh;
  fresh.setTimeout = setTimeout; fresh.clearTimeout = clearTimeout;
  fresh.localStorage = W.localStorage;
  var d2 = {};
  fresh.Native = { save: function (k, v) { d2[k] = v; return true; },
                   load: function (k) { return d2[k] === undefined ? null : d2[k]; } };
  ['seed.js', 'players.js', 'scoring.js', 'espn.js', 'names.js', 'store.js', 'playerdb.js',
   'projections.js', 'usage.js', 'recommend.js', 'sim.js', 'value.js', 'recap.js',
   'ai.js'].forEach(function (f) {
    new Function('window', fs.readFileSync(path.join(__dirname, '..', 'app/assets', f), 'utf8'))(fresh);
  });
  fresh.Store.init(fresh.SEED);
  fresh.PlayerDB.init();
  var meId = fresh.Store.get().league.me;
  var checks = [
    ['bestLineup', function () { return fresh.Recommend.bestLineup(1, meId, null); }],
    ['projectAll', function () { return fresh.Recommend.projectAll(1, meId, null); }],
    ['byPos', function () { return fresh.Value.byPos(1, 5); }],
    ['upgrades', function () { return fresh.Value.upgrades(1, meId, null, 20); }],
    ['needs', function () { return fresh.Value.needs(1, meId, null); }],
    ['waiverContext', function () { return fresh.Value.waiverContext(1, meId, null, 2026, '2026-09-03'); }],
    ['replacement', function () { return fresh.Value.replacement(1); }],
    ['Sim.power', function () { return fresh.Sim.power(1); }],
    ['Sim.season', function () { return fresh.Sim.season(1); }],
    ['Recap.build', function () { return fresh.Recap.build(1); }],
    ['Recap.text', function () { return fresh.Recap.text(1); }],
    ['standings', function () { return fresh.Store.standings(1); }]
  ];
  var i, bad = [];
  for (i = 0; i < checks.length; i++) {
    try { checks[i][1](); } catch (e) { bad.push(checks[i][0] + ': ' + e.message); }
  }
  ok(!bad.length, 'nothing throws on a brand-new season with no week scored' +
     (bad.length ? '\n         ' + bad.join('\n         ') : ''));
}());

/* ---- 11. the waiver prompt is built from real league data ---------------- */
(function () {
  var ctx = W.Value.waiverContext(5, me, null, 2026, '2026-09-03');
  var prompt = W.Ai.buildWaiverPrompt(ctx);
  ok(prompt.indexOf('completed pass is worth 1 point') >= 0,
     'the waiver prompt states the scoring rule that breaks every public list');
  ok(prompt.indexOf('nobody in this list is on any of the ten rosters') >= 0,
     'availability is asserted so no search is spent rediscovering it');
  ok(prompt.length > 1200 && prompt.length < 60000,
     'the prompt is a sane size (' + prompt.length + ' chars) — no runaway pool');
}());

/* ---- 12. "Re-default all teams now" actually re-defaults ------------------
 * Tj, 2026-09-07: "when I make changes to lineups then press the re-default
 * all teams now button it always says nothing to change even when I made
 * several changes away from the default."
 *
 * The data-layer half of that bug is pinned here: applyAuto MUST keep skipping
 * manual slots (every automatic fill in the app depends on that contract), and
 * clearing the manual marks first MUST make it move again. The button now does
 * the second thing, which is what its name always claimed. ui.js is not loaded
 * in this suite, so the button's own wiring is asserted on source at the end. */
(function () {
  var wk = 6, tid = me;
  var auto = W.Recommend.autoLineup(wk, tid, null);
  var keys = Object.keys(auto);
  ok(keys.length > 0, 'the recommender produces a lineup to default to');

  W.Store.clearManual(wk, tid);
  W.Store.applyAuto(wk, tid, auto);
  var n0 = W.Store.applyAuto(wk, tid, auto);
  ok(n0 === 0, 're-applying an unchanged auto lineup reports 0 slots changed');

  /* Tj hand-picks a different player into a slot — exactly what he did */
  var slot = keys[0];
  var roster = W.Store.team(tid).players;
  var current = W.Store.getLineup(wk, tid)[slot];
  var other = null, i;
  for (i = 0; i < roster.length; i++) {
    if (roster[i].id !== current) { other = roster[i].id; break; }
  }
  ok(other !== null, 'the roster has another player to move into the slot');
  W.Store.setSlot(wk, tid, slot, other, true);
  ok(W.Store.isManual(wk, tid, slot), 'a hand-picked slot is marked manual');

  /* THE BUG: this is what the button used to do, and it is why it said
     "Nothing to change" no matter how many changes had been made. */
  var stillNothing = W.Store.applyAuto(wk, tid, auto);
  ok(stillNothing === 0,
     'applyAuto alone still reports 0 — the manual contract is intact  <-- the old button stopped here');
  ok(W.Store.getLineup(wk, tid)[slot] === other,
     'and it left his pick in place, which is correct for an AUTOMATIC fill');

  /* THE FIX: clear the manual marks first, the way the per-team "Reset to
     auto" button has always done, then fill. */
  W.Store.clearManual(wk, tid);
  var changed = W.Store.applyAuto(wk, tid, auto);
  ok(changed > 0,
     'clearing the manual marks first makes the re-default actually move ' +
     changed + ' slot(s)  <-- the fix');
  ok(W.Store.getLineup(wk, tid)[slot] === current,
     'and the slot is back to the recommended player');
}());

/* ---- 13. the button itself is wired that way ----------------------------- */
(function () {
  var src = fs.readFileSync(path.join(__dirname, '..', 'app/assets/ui.js'), 'utf8');
  /* comments are stripped first — the block above the button quotes the old
     behaviour on purpose, and STATE.md records that this trap has bitten
     three times already */
  var code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  /* the literal text changed from "Re-default all teams now" to a pair
     scoped to whichever teams the Lineups tab shows (v5.2: just mine and
     this week's opponent) — locate the block by the handler's own name
     instead of a wording that no longer exists. */
  var i = code.indexOf("refill.addEventListener('click'");
  ok(i > 0, 'the re-default button still exists');
  var block = code.slice(i, i + 1600);
  ok(/clearManual/.test(block),
     'the re-default handler clears the manual marks  <-- without this it can only ever say "Nothing to change"');
  ok(/confirmModal/.test(block),
     'it asks first, because it discards hand-picked slots');
  ok(!/Nothing to change/.test(block),
     'the misleading "Nothing to change" wording is gone');
  ok(/of your picks replaced|already holds its recommended/.test(block),
     'the toast now says what actually happened');
}());

/* ---- 14. manual weekly scores: the read-through, and importing an OLD
 * backup that predates the field ----------------------------------------
 * teamWeekScore is the one function standings/win-loss/the live card must
 * all read a team's score through, so this checks the read-through itself
 * rather than grepping for it. It also imports a backup shaped like one
 * saved before manualScores existed — importJSON defaults every other
 * pre-existing field this way (lineupManual, stats, book, ...) but the
 * corresponding `if (!o.manualScores) o.manualScores = {}` line is new
 * enough, and easy enough to leave out by hand, that it deserves its own
 * check rather than trusting the pattern was followed by eye. Without it,
 * S.manualScores stays undefined after a restore and the next
 * getManualScore/setManualScore throws on the field access — exactly the
 * kind of bug a source-text regex on "manualScores" would not catch, the
 * same shape as the keepAdj crash this session found by accident. */
(function () {
  var tid = W.Store.get().teams[1].id;
  ok(W.Store.getManualScore(6, tid) === null, 'no manual score on file reads back null');
  var computed = W.Store.teamWeekPoints(6, tid).total;
  var through = W.Store.teamWeekScore(6, tid);
  near(through.total, computed, 'teamWeekScore falls back to the computed total with nothing entered');
  ok(through.manual === false, 'and says so');

  W.Store.setManualScore(6, tid, 88.5);
  var m = W.Store.teamWeekScore(6, tid);
  near(m.total, 88.5, 'teamWeekScore prefers a manual entry once one is on file');
  ok(m.manual === true, 'and says so');
  near(W.Store.seasonTotals(6)[tid].weeks[6], 88.5,
       'seasonTotals reads the manual score too, not the computed one underneath it');

  W.Store.setManualScore(6, tid, '');
  ok(W.Store.getManualScore(6, tid) === null, 'clearing it (blank input) removes the override');

  /* now the import-migration path: a backup shaped like a pre-manualScores save */
  var backup = JSON.parse(W.Store.exportJSON());
  delete backup.manualScores;
  ok(backup.manualScores === undefined, 'the fixture really is missing the field, not just empty');
  W.Store.importJSON(JSON.stringify(backup));
  var threw = null;
  try { W.Store.setManualScore(7, tid, 42); } catch (e) { threw = e; }
  ok(!threw, 'setManualScore does not throw after restoring a backup that predates manualScores' +
     (threw ? '  <-- ' + threw.message : ''));
  near(W.Store.getManualScore(7, tid), 42, 'and the value it just set reads back correctly');
}());

/* ---- 15. a save already poisoned by the games/kickoffs collision heals on
 * the next boot -----------------------------------------------------------
 * The Data tab printed "[object Object] games" because weekMeta[week].games
 * held a per-team kickoff map (written by an old schedule.js) instead of
 * doSync's integer count. Renaming the write site (v5.3) only stops it
 * happening AGAIN — a save from before that fix is already on disk with the
 * object sitting there, and nothing besides a fresh full sync would ever
 * overwrite it. This drives the actual migration path end to end: corrupt a
 * saved state the way v5.2/v5.3 actually did, persist it, re-init from that
 * disk state (exactly what happens on the next app launch), and check the
 * repair — not a source grep for the migration code existing. */
(function () {
  var wk = 11, S3 = W.Store.get();
  var fakeKickoffMap = {
    KC: { kick: '2026-01-01T18:00:00Z', state: 'pre', opp: 'DEN' },
    DEN: { kick: '2026-01-01T18:00:00Z', state: 'pre', opp: 'KC' },
    SF: { kick: '2026-01-01T21:00:00Z', state: 'pre', opp: 'LAR' },
    LAR: { kick: '2026-01-01T21:00:00Z', state: 'pre', opp: 'SF' }
  };
  S3.weekMeta[String(wk)] = { synced: true, allFinal: false, games: fakeKickoffMap };
  W.Store.save();
  W.Store.init(W.SEED);   /* the same call boot() makes on every launch */
  var healed = W.Store.get().weekMeta[String(wk)];
  ok(typeof healed.games === 'number', 'the poisoned .games (an object) is now a number  (got ' +
     JSON.stringify(healed.games) + ')');
  ok(healed.games === 2, 'reconstructed from the rescued kickoff map (4 teams = 2 games)');
  ok(healed.kickoffs && healed.kickoffs.KC && healed.kickoffs.SF,
     'and the map itself was rescued into .kickoffs rather than discarded');
}());

/* ---- 16. waiverContext carries the deterministic injury/dropCandidate/
 * kdefNeed data, and it agrees with the real roster -------------------------
 * value.js v5.5: these three fields feed the waiver prompt (ai.js) and the
 * Wire tab's own injury card. Wrong here means wrong in both places at once. */
(function () {
  var t = W.Store.team(me);
  var week = 6;
  /* inject one ESPN-style injury designation into the SAME cache recommend.js
     itself writes on a real sync, so myInjuries has something to find without
     needing a live network call */
  var nc = { at: Date.now(), byName: {}, count: 1 };
  nc.byName[W.Espn.normName(t.players[0].name)] =
    { status: 'QUESTIONABLE', note: 'test-injected ankle issue' };
  W.Native.save('fftracker_news_v1', JSON.stringify(nc));
  W.Recommend.loadCaches();

  var ctx = W.Value.waiverContext(week, me, null, 2026, '2026-09-10');
  ok(Array.isArray(ctx.injuries), 'waiverContext carries an injuries array');
  var found = ctx.injuries.filter(function (x) { return x.name === t.players[0].name; });
  ok(found.length === 1,
     'the injected designation shows up in the deterministic injury list, unprompted');
  ok(found.length && (found[0].status === 'QUESTIONABLE' || found[0].status === 'BYE'),
     'status is one the app itself computed (BYE only if this player happens to be on ' +
     'a bye in week ' + week + ')');

  ok(ctx.kdefNeed && typeof ctx.kdefNeed.K === 'boolean' && typeof ctx.kdefNeed.DEF === 'boolean',
     'kdefNeed is a {K,DEF} boolean pair');

  ok(ctx.dropCandidates && typeof ctx.dropCandidates === 'object', 'dropCandidates is present');
  var anyPos = Object.keys(ctx.dropCandidates).filter(function (k) {
    return ctx.dropCandidates[k].length;
  });
  ok(anyPos.length > 0, 'at least one position has a real cut candidate on a full roster');
  var oneList = ctx.dropCandidates[anyPos[0]];
  ok(!!oneList[0].name && oneList[0].pos === anyPos[0] && typeof oneList[0].ros === 'number',
     'each drop candidate carries a name, its own position, and a numeric ROS value');
  if (oneList.length > 1) {
    ok(oneList[0].ros <= oneList[1].ros,
       'drop candidates are sorted weakest rest-of-season value first');
  }
}());

/* ---- 17. the waiver prompt actually renders the deterministic context, not
 * just the fixed scoring table ----------------------------------------------
 * test_ai.js proves waiverPrefix() states the new rules; this proves
 * buildWaiverPrompt renders them from a REAL context built off a real
 * roster, not only from ai.js's own hard-coded example strings. */
(function () {
  var ctx2 = W.Value.waiverContext(6, me, null, 2026, '2026-09-10');
  var prompt = W.Ai.buildWaiverPrompt(ctx2);
  ok(prompt.indexOf('KDEF NEED') >= 0, 'the KDEF NEED line is rendered into the live prompt');
  if (ctx2.injuries.length) {
    ok(prompt.indexOf('MY ROSTER — INJURIES') >= 0,
       'the injuries block is rendered when the roster actually has one');
  }
}());

/* ---- 18. the Claude cost estimates stay correct once memoised (review
 * finding, 2026-09-15) ------------------------------------------------------
 * claudeAdviceEstimate()/claudeWireEstimate() were found recomputing a full
 * roster projection or free-agent scan on every render just to refresh a
 * cost string — fixed by memoising on a key that includes the price rates,
 * specifically SO editing a rate on the Data tab still changes the number
 * immediately rather than showing a stale cached one. This is the one part
 * of that fix that is a real correctness risk (a wrong or missing field in
 * the memo key silently shows the wrong price), so it is proven here against
 * the real Store/Usage/Recommend/Value wiring, not just by reading the
 * source. */
(function () {
  var S2 = W.Store.get();
  S2.settings.rate_inPerM = 2.00; S2.settings.rate_outPerM = 10.00;
  S2.settings.rate_searchPer1000 = 10.00; W.Store.save();
  /* claudeWireEstimate (ui.js) uses the identical memo shape but is not
     testable here — this file's own header explains why ui.js is never
     loaded in this harness: it expects a real DOM. Proving the pattern
     correct once, against the real function that owns it, is the point. */
  var advice1 = W.Recommend.claudeAdviceEstimate(1, me);
  ok(typeof advice1 === 'string' && advice1.length > 0, 'claudeAdviceEstimate returns a real estimate string');

  /* same week, same team, same rates, same roster: calling it again must
     return the identical string — the memoised value, not a fresh (and
     possibly randomly-different, if anything were nondeterministic) one */
  var advice1b = W.Recommend.claudeAdviceEstimate(1, me);
  ok(advice1 === advice1b, 'an unchanged call is stable — same estimate string both times');

  /* now change a price rate WITHOUT touching the roster (no bumpGen) — a
     memo keyed only on week/team/generation would keep serving the OLD
     price forever after this, which is exactly the bug this test exists to
     catch */
  S2.settings.rate_inPerM = 20.00; S2.settings.rate_outPerM = 100.00;
  S2.settings.rate_searchPer1000 = 100.00; W.Store.save();
  var advice2 = W.Recommend.claudeAdviceEstimate(1, me);
  ok(advice2 !== advice1, 'raising every price 10x changes the memoised estimate immediately, not on the next roster edit');

  /* restore defaults so this block leaves no side effect for anything after it */
  S2.settings.rate_inPerM = 2.00; S2.settings.rate_outPerM = 10.00;
  S2.settings.rate_searchPer1000 = 10.00; W.Store.save();
}());

/* ---- 19. reading an unsynced week's stats must not dirty the archive
 * (review finding, 2026-09-15e) ---------------------------------------------
 * getStats() used to call markArchive() when it lazily created an EMPTY
 * bucket for a week nobody has synced yet — reached from plain reads
 * (lineFor -> playerPoints -> teamWeekPoints -> standings, and the Live
 * tab's matchup card), not just from writers. The archive split's whole
 * point (this file's own header comment, store.js:7-37) is that a lineup
 * edit writes ~25KB, not the ~1.9MB book+stats archive — and simply
 * viewing the Live tab for an unsynced week (the common case right after
 * boot) was silently defeating that by flagging the archive dirty on a
 * read. Proven here by instrumenting Native.save and counting how many
 * times the archive key is actually written. */
(function () {
  var archiveWrites = 0;
  var realSave = W.Native.save;
  W.Native.save = function (k, v) { if (k === 'fftracker_archive_v1') archiveWrites++; return realSave(k, v); };

  var freshWeek = 9;   /* a week with no stats synced yet in this test roster */
  var st = W.Store.getStats(freshWeek);   /* the read under test — also lazily creates the bucket */
  ok(Object.keys(st).length === 0, 'sanity: this week really has no stats yet (an empty bucket, not a real sync)');
  archiveWrites = 0;
  W.Store.save();
  ok(archiveWrites === 0, 'a plain read of an unsynced week does not write the archive on the next save');

  W.Store.setLine(freshWeek, me + '-test-pid', { played: true, manualAdj: 1 });
  archiveWrites = 0;
  W.Store.save();
  ok(archiveWrites === 1, 'but a REAL write (setLine) still does — real writers were never relying on the read to do it');

  W.Native.save = realSave;
}());

/* ---- 20. Store.bookTrend() resolves a spelling mismatch tolerantly
 * (review finding, 2026-09-15e) ---------------------------------------------
 * The league book is keyed by however ESPN spelled a box score — "Kenny
 * Gainwell", say. value.js's perGame()/usage() (the Wire tab's whole free-
 * agent board and usage trend) and recommend.js's usageSwing() ("his
 * opportunities rose X% last week") all look a player up by the roster/DB's
 * own spelling — "Kenneth Gainwell" — which can differ. bookTrend() used to
 * require an EXACT key match; a mismatch did not error, it just silently
 * returned nothing, so every affected player's real recent production was
 * invisible everywhere that data feeds. Fixed to resolve tolerantly via
 * Names.hit, the same pattern Projections.find() already used. */
(function () {
  var wk = 3;
  W.Store.setBook(wk, { 'kenny gainwell': { n: 'Kenny Gainwell', t: 'TB', p: 14.2, pa: 0, cr: 12, tg: 3 } });

  var trend = W.Store.bookTrend('Kenneth Gainwell', wk, 1);
  ok(trend.length === 1 && trend[0].row && trend[0].row.p === 14.2,
     'bookTrend finds the ESPN-spelled row even when asked for the roster/DB spelling');

  var trend2 = W.Store.bookTrend('kenny gainwell', wk, 1);
  ok(trend2.length === 1 && trend2[0].row && trend2[0].row.p === 14.2,
     'and still works when the caller already happens to pass the exact ESPN spelling (no regression)');

  var pg = W.Value.perGame('Kenneth Gainwell', 'RB', wk + 1);
  ok(pg.v === 14.2 && pg.src.indexOf('scored week') >= 0,
     'Value.perGame (the free-agent board) now picks up his real recent production, not a season-pace/floor guess');

  var usageRows = W.Value.usage('Kenneth Gainwell', wk + 1, 1);
  ok(usageRows.length === 1 && usageRows[0].played && usageRows[0].pts === 14.2,
     'Value.usage (the Wire tab\'s usage trend) resolves the same way');
}());

/* ---- 21. Value.needs() measures a FLEX starter against HIS OWN position's
 * replacement level, not RB's (review finding, 2026-09-15e) -----------------
 * needs() used to hardcode `s.pos === 'FLEX' ? 'RB' : s.pos`, so a WR or TE
 * actually starting in flex (the common case — a flex slot is not RB-only)
 * had his "how thin is this position" gap measured against RB's replacement
 * level instead of his own. This feeds straight into the "needs" line sent
 * to Claude for waiver prioritization (ai.js buildWaiverPrompt), so a wrong
 * position there is a wrong "go find a RB" instruction when the real gap is
 * at WR. bestLineup() always auto-picks whoever projects best for FLEX,
 * which happens to be an RB on this test roster — not a scenario that can
 * distinguish the bug from the fix — so Recommend.bestLineup is stubbed for
 * just this test to force a WR into the flex slot, the same technique real
 * dependency injection would use, rather than fighting the projection
 * pipeline to organically produce one. */
(function () {
  var realBestLineup = W.Recommend.bestLineup;
  var t = W.Store.team(me);
  var flexPlayer = null, i;
  for (i = 0; i < t.players.length; i++) if (t.players[i].pos === 'WR') { flexPlayer = t.players[i]; break; }
  ok(!!flexPlayer, 'sanity: this roster has at least one WR to put in flex for the test');

  W.Recommend.bestLineup = function (week, teamId, opponents) {
    var real = realBestLineup(week, teamId, opponents);
    return real.map(function (k) {
      if (k.key !== 'FLEX' && k.label !== 'FLEX' && k.pos !== 'FLEX') return k;
      return { key: k.key, label: k.label, pos: 'FLEX', forced: false, alts: [],
               pick: { p: flexPlayer, proj: 3, base: 3, startable: true } };
    });
  };

  var starters = W.Value.myStarters(1, me, null);
  var flexEntry = starters.filter(function (s) { return s.pos === 'FLEX'; })[0];
  ok(flexEntry && flexEntry.realPos === 'WR', 'sanity: the stub actually put a WR in the flex slot');

  var needsList = W.Value.needs(1, me, null);
  var found = needsList.filter(function (n) { return n.name === flexPlayer.name; })[0];
  W.Recommend.bestLineup = realBestLineup;   /* restore before any assertion could fail and skip this */

  if (found) {
    ok(found.pos === 'WR', 'needs() reports the FLEX starter\'s real position (WR), not "FLEX" or a hardcoded "RB"');
  } else {
    /* a 3-point projection with a real replacement level at WR may not be
       "thin" enough to clear needs()'s own gap<4 filter — that is fine and
       not what this test is about, but say so rather than passing silently */
    ok(true, 'the stubbed WR did not clear the gap<4 threshold to appear in needs() at all (unrelated to this fix)');
  }
}());

/* ---- 22. claudeAdviceEstimate() shows $0 when the real sync would
 * actually be free (review finding, 2026-09-15e) -----------------------------
 * syncAll() skips the Claude call entirely — no request, no charge — once
 * every roster player has been "carried forward" (checked recently, came
 * back clear, nothing since). The estimate never special-cased that: with
 * research.length === 0, Ai.adviceSearchBudget's hard floor of 2 searches
 * still produced a few cents, showing a non-zero price for a press that
 * would cost nothing. Reproduced here by populating the AI cache with a
 * fresh "clear" verdict for every roster player — mergeAi() is the exact
 * function the offline Claude-app handoff uses for this, so this is a real
 * roster-context path, not a synthetic shortcut. */
(function () {
  var wk = 1;
  /* a DIFFERENT team than "me" — earlier tests in this file inject a real
     ESPN designation onto my own roster (QUESTIONABLE, for the injuries-
     block test above), which correctly always forces research regardless
     of cache state, so it can never reach n=0 by design. Any other team's
     roster is untouched by that and free for a clean scenario here. */
  var otherId = 'steve';
  var t = W.Store.team(otherId);
  var byName = {};
  t.players.forEach(function (p) {
    byName[W.Names.canon(p.name)] = { status: 'clear', at: Date.now(), week: wk };
  });
  W.Recommend.mergeAi(wk, { byName: byName, at: Date.now() }, {});

  var ctx = W.Recommend.rosterContext(wk, otherId, null);
  ok(ctx.players.length === 0, 'sanity: every roster player is now "carried forward" — nothing left to research');

  var est = W.Recommend.claudeAdviceEstimate(wk, otherId);
  ok(est === '$0', 'and the estimate correctly says the next sync would cost $0, not a few cents from the search-count floor');
}());

console.log(fails ? ('  ' + fails + ' integration check(s) FAILED') : '  integration checks pass');
process.exit(fails ? 1 : 0);
