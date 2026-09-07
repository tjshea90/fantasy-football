/* test_engine.js — behavioural tests for the v1.8 additions.
 * These run the real modules, not string matches: a synthetic ESPN summary
 * through the parser and the scorer, a synthetic projection stat map through
 * the converter, and the lineup auto-fill through the store.
 *
 * The two feed bugs this file exists to lock down:
 *   1. a pick-six appears in BOTH the defensive and interceptions stat groups,
 *      and summing them paid a defense 12 points for one touchdown;
 *   2. two-point conversions were never credited to anyone at all.
 */
var fs = require('fs'), path = require('path'), fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  OK   ' + m); }
function near(a, b, m) { ok(Math.abs(a - b) < 0.011, m + '  (got ' + a + ', want ' + b + ')'); }

var root = { window: null };
root.window = root;
function load(f) {
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'app/assets', f), 'utf8'))(root);
}

function load2(f, r) {
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'app/assets', f), 'utf8'))(r);
}
load('scoring.js'); load('espn.js'); load('names.js'); load('projections.js');
var Sc = root.Scoring, Espn = root.Espn, Proj = root.Projections;

/* ---------- the Anthropic SSE reader ----------------------------------
 * v2.0 sent a normal request and the connection died mid-wait:
 *   IOException: unexpected end of stream
 * A search-backed call sends nothing for a minute, and a silent connection
 * over cellular gets closed. Streaming keeps bytes moving. That means the
 * response is now Server-Sent Events, so it has to be reassembled — including
 * NOT mixing the model's tool-call JSON into its answer. */
(function testSse() {
  root.Store = { get: function () { return { settings: {} }; } };
  load('ai.js');
  var Ai = root.Ai;
  function ev(o) { return 'event: ' + o.type + '\ndata: ' + JSON.stringify(o) + '\n'; }
  var answer = '{"players":[{"name":"Matthew Stafford","status":"clear",' +
               '"willPlay":true,"adjust":1.05,"confidence":"high","reason":"ok"}],' +
               '"summary":"fine"}';
  var sse =
    ev({ type: 'message_start', message: { usage: { input_tokens: 1200 } } }) +
    ev({ type: 'content_block_start', index: 0,
         content_block: { type: 'server_tool_use' } }) +
    /* a tool call being filled in — must NOT reach the answer */
    ev({ type: 'content_block_delta', index: 0,
         delta: { type: 'input_json_delta', partial_json: '{"query":"stafford"' } }) +
    /* the real answer, split across deltas the way it actually arrives */
    ev({ type: 'content_block_delta', index: 1,
         delta: { type: 'text_delta', text: answer.slice(0, 40) } }) +
    ev({ type: 'content_block_delta', index: 1,
         delta: { type: 'text_delta', text: answer.slice(40) } }) +
    ev({ type: 'message_delta', delta: { stop_reason: 'end_turn' },
         usage: { output_tokens: 900 } });

  var j = Ai._parseSse(sse);
  var txt = Ai._textOf(j);
  ok(txt === answer, 'the SSE stream reassembles into the model\'s text');
  /* THE COST-METER TRAP: input_tokens arrive in message_start, output_tokens in
     message_delta. Replacing usage instead of merging drops the input side and
     the meter reads about half of what was actually spent. */
  ok(j.usage && j.usage.input_tokens === 1200 && j.usage.output_tokens === 900,
     'usage MERGES across message_start and message_delta, losing neither side');
  ok(txt.indexOf('query') < 0, 'a tool call is not mixed into the answer');
  var parsed = Ai._jsonOf(txt);
  ok(parsed.players.length === 1 && parsed.players[0].adjust === 1.05,
     'the reassembled text parses as the expected JSON');
  ok(j.usage && j.usage.output_tokens === 900, 'usage survives the stream');

  var threw = '';
  try { Ai._parseSse(ev({ type: 'error', error: { message: 'overloaded' } })); }
  catch (e) { threw = e.message; }
  ok(/overloaded/.test(threw), 'an error event is surfaced, not swallowed');

  threw = '';
  try { Ai._parseSse(ev({ type: 'message_start', message: {} })); }
  catch (e) { threw = e.message; }
  ok(/no text/.test(threw), 'a stream with no text is an error, not empty advice');
})();

/* ---------- the spend meter ------------------------------------------ */
(function testUsage() {
  root.localStorage = {
    _d: {}, getItem: function (k) { return this._d[k] || null; },
    setItem: function (k, v) { this._d[k] = v; }
  };
  root.Native = null;
  root.Store = { get: function () { return { settings: { aiBudget: 20 } }; } };
  load('usage.js');
  var U = root.Usage;
  U.load(); U.reset();

  /* a realistic advice sync: ~11k in (search results dominate), 900 out, 8 searches */
  var p = U.priceOf({ input_tokens: 11000, output_tokens: 900,
                      cache_read_input_tokens: 0, cache_creation_input_tokens: 0,
                      server_tool_use: { web_search_requests: 8 } });
  /* 11000/1e6*2 = 0.022 ; 900/1e6*10 = 0.009 ; 8/1000*10 = 0.08 */
  ok(Math.abs(p.cost - 0.111) < 0.0005,
     'a sync is priced from tokens AND web searches (got ' + p.cost.toFixed(4) + ')');
  ok(p.searches === 8, 'web searches are counted');

  U.record('advice sync', 'claude-sonnet-5', { input_tokens: 11000, output_tokens: 900,
    server_tool_use: { web_search_requests: 8 } });
  U.record('advice sync', 'claude-sonnet-5', { input_tokens: 11000, output_tokens: 900,
    server_tool_use: { web_search_requests: 8 } });
  var t = U.totals();
  ok(Math.abs(t.spend - 0.222) < 0.001, 'spend accumulates across calls');
  ok(t.syncs === 2 && Math.abs(t.perSync - 0.111) < 0.001, 'per-sync average is right');
  ok(Math.abs(t.remaining - 19.778) < 0.001, 'remaining is budget minus spend');
  ok(t.syncsLeft > 150 && t.syncsLeft < 200,
     'it says how many more syncs the credit buys (got ' + t.syncsLeft + ')');

  /* a key test is not a sync and must not drag the average down */
  U.record('key test', 'claude-sonnet-5', { input_tokens: 12, output_tokens: 4 });
  var t2 = U.totals();
  ok(t2.syncs === 2, 'a key test is not counted as a sync');
  ok(t2.calls === 3, 'but it is still in the ledger');
  ok(U.money(0.111) === '$0.111' && U.money(12.5) === '$12.50',
     'money formats at a useful precision');
})();

/* ---------- 1. the ESPN summary parser -------------------------------- */
var SUMMARY = {
  header: { competitions: [{ competitors: [
    { team: { id: '1', abbreviation: 'ATL' }, score: '27' },
    { team: { id: '2', abbreviation: 'IND' }, score: '17' }
  ] }] },
  boxscore: {
    players: [
      { team: { abbreviation: 'ATL' }, statistics: [
        { name: 'passing', labels: ['C/ATT', 'YDS', 'TD', 'INT'],
          athletes: [{ athlete: { id: 11, displayName: 'Michael Penix Jr.' },
                       stats: ['22/31', '245', '2', '0'] }] },
        { name: 'rushing', labels: ['CAR', 'YDS', 'TD', 'LONG'],
          athletes: [{ athlete: { id: 12, displayName: 'Bijan Robinson' },
                       stats: ['19', '88', '1', '24'] }] },
        { name: 'receiving', labels: ['REC', 'YDS', 'TD', 'LONG'],
          athletes: [{ athlete: { id: 13, displayName: 'Drake London' },
                       stats: ['7', '96', '0', '31'] }] },
        /* the double-count trap: one pick-six, counted in two groups */
        { name: 'defensive', labels: ['TOT', 'SOLO', 'SACKS', 'TD'],
          totals: ['61', '40', '3', '1'], athletes: [] },
        { name: 'interceptions', labels: ['INT', 'YDS', 'TD'],
          totals: ['2', '40', '1'], athletes: [] },
        { name: 'fumbles', labels: ['FUM', 'LOST', 'REC'],
          totals: ['1', '0', '0'], athletes: [] }
      ] },
      { team: { abbreviation: 'IND' }, statistics: [
        { name: 'fumbles', labels: ['FUM', 'LOST', 'REC'],
          totals: ['2', '1', '0'], athletes: [] },
        { name: 'defensive', labels: ['TOT', 'SOLO', 'SACKS', 'TD'],
          totals: ['55', '35', '2', '0'], athletes: [] },
        { name: 'interceptions', labels: ['INT', 'YDS', 'TD'],
          totals: ['0', '0', '0'], athletes: [] }
      ] }
    ]
  },
  scoringPlays: [
    { team: { id: '1' }, scoringType: { name: 'touchdown' },
      text: 'A.J. Terrell 40 Yd Interception Return (Younghoe Koo Kick)' },
    { team: { id: '1' }, scoringType: { name: 'touchdown' },
      text: 'Bijan Robinson 3 Yd Run (Drake London Pass From Michael Penix Jr. for Two-Point Conversion)' }
  ],
  drives: { previous: [] }
};

/* ---------- 0. the async transport ------------------------------------
 * The freeze in v1.9 was this: Native.httpGet is a SYNCHRONOUS call, so the JS
 * thread sat inside it for the whole request and the page could not repaint.
 * The fake bridge below behaves like the real async one — it returns an id at
 * once and calls __httpDone later — and the test proves two things: the body
 * still arrives, and control returns to the caller BEFORE it does. The second
 * assertion is the one that would have caught the bug. */
var asyncBridge = {
  pending: {},
  seq: 0,
  httpAsync: function (url, headersJson, body) {
    var id = 'r' + (++this.seq), self = this;
    this.pending[id] = JSON.stringify({ ok: true, url: url, hadBody: body !== null });
    setTimeout(function () { root.__httpDone(id); }, 15);
    return id;
  },
  httpTake: function (id) { var b = this.pending[id]; delete this.pending[id]; return b; },
  httpForget: function (id) { delete this.pending[id]; }
};
root.Native = asyncBridge;
root.setTimeout = setTimeout; root.clearTimeout = clearTimeout;

var returnedBeforeBody = false, bodyArrived = false;
var p0 = Espn._httpGet('https://example.test/x').then(function (j) {
  bodyArrived = true;
  ok(j && j.ok === true, 'the async transport delivers the parsed body');
  ok(returnedBeforeBody,
     'the transport RETURNS TO THE CALLER before the body arrives (this is the freeze fix)');
});
returnedBeforeBody = !bodyArrived;

p0.then(function () {
  /* a request the bridge never answers must reject, not hang forever */
  var slow = { httpAsync: function () { return 'r999'; }, httpTake: function () { return null; },
               httpForget: function () { } };
  root.Native = slow;
  return Espn._httpGet('https://example.test/hang', { timeout: 60 }).then(function () {
    ok(false, 'a silent request should not resolve');
  }, function (e) {
    ok(/timed out/.test(String(e.message)), 'a silent request times out instead of hanging');
  });
}).then(function () {

root.Native = { httpGet: function () { return JSON.stringify(SUMMARY); } };

return Espn.gameStats('test').then(function (r) {
  var atl = r.teamAgg.ATL, ind = r.teamAgg.IND;
  ok(r.flags.stFromScoringPlays, 'scoring plays were used as the source of truth');
  ok(atl.defTD === 1, 'a pick-six counts ONCE, not once per stat group (got ' + atl.defTD + ')');
  ok(atl.retTD === 0, 'an interception return is not also a kick return');
  ok(atl.sacks === 3, 'sacks come from the defensive group');
  ok(atl.int === 2, 'interceptions come from the interceptions group');
  ok(atl.fr === 1, "ATL recovers IND's lost fumble");
  ok(atl.pointsAllowed === 17, 'points allowed is the opponent score');

  var dst = Sc.score(Espn.dstLine(atl));
  /* 3 sacks 6 + 2 INT 4 + 1 FR 2 + 1 def TD 6 + 17 allowed 5 = 23 */
  near(dst.total, 23, 'ATL D/ST scores 23');

  var pen = r.players[Espn.normName('Michael Penix Jr.')];
  ok(!!pen, 'the QB was parsed');
  ok(pen.line.pass.twoPt === 1, 'the passer is credited with the 2-point conversion');
  var lon = r.players[Espn.normName('Drake London')];
  ok(lon.line.rec.twoPt === 1, 'the receiver is credited with the 2-point conversion');
  /* 22 cmp + 245/20 + 12 + 2 = 48.25 */
  near(Sc.score(pen.line).total, 22 + 245 / 20 + 12 + 2, 'the QB scores with the 2PT included');

  ok(pen.line.use.patt === 31, 'pass attempts are carried as usage, unscored');
  ok(r.shape.missing.length === 0, 'a healthy feed raises no shape alarm');

  return null;
}).then(function () {

  /* ---------- 1b. THE CANARY (v2.3) -------------------------------------
   * pick() answers 0 for a label it cannot find, so a column ESPN renames is
   * a silent week of wrong scores. Rename one and the parse must SAY so. */
  var broken = JSON.parse(JSON.stringify(SUMMARY));
  broken.boxscore.players[0].statistics[0].labels = ['C/ATT', 'YDS', 'TD', 'INTS'];
  root.Native = { httpGet: function () { return JSON.stringify(broken); } };
  return Espn.gameStats('test').then(function (r2) {
    ok(r2.shape.missing.indexOf('passing:INT') >= 0,
       'a renamed scoring column is reported, not silently read as zero');
    root.Native = { httpGet: function () { return JSON.stringify(SUMMARY); } };
    return null;
  });
}).then(function () {

  /* ---------- 1c. bounded parallelism (v2.3) ---------------------------
   * Three at a time, results in the caller's order whatever order the network
   * answers in, and one dead game must not lose the other fifteen. */
  var inFlight = 0, peak = 0, order = [];
  var items = [5, 1, 4, 2, 3, 9, 7];
  return Espn.pool(items, 3, function (ms, i) {
    inFlight++; peak = Math.max(peak, inFlight);
    return new Promise(function (res, rej) {
      setTimeout(function () {
        inFlight--; order.push(ms);
        if (ms === 4) rej(new Error('this game is broken')); else res('v' + i);
      }, ms * 6);
    });
  }).then(function (out) {
    ok(peak > 1 && peak <= 3, 'the pool runs 3 at a time, not 1 and not 7 (peak ' + peak + ')');
    ok(out[0] === 'v0' && out[6] === 'v6', 'results come back in the caller\'s order');
    ok(out[2] === null, 'a failed item is null and does not reject the batch');
    ok(order[0] !== items[0], 'the fast ones really did finish first');
    return null;
  });
}).then(function () {

  /* ---------- 2. projections re-scored under league rules ------------- */
  var ID = Proj.STAT_ID, qb = {};
  qb[ID.passCmp] = 24; qb[ID.passYds] = 268; qb[ID.passTD] = 1.8;
  qb[ID.passInt] = 0.6; qb[ID.rushYds] = 21; qb[ID.rushTD] = 0.3;
  var q = Proj.scoreProjected(qb, 'QB');
  near(q.pts, 24 + 268 / 20 + 1.8 * 6 - 0.6 * 2 + 2.1 + 0.3 * 6,
       'a projected QB line converts to league points');
  ok(q.pts > 40, 'the completion bonus is present — this is not standard scoring');

  var k = {};
  k[ID.fgMadeU40] = 1; k[ID.fgMade4049] = 0.6; k[ID.fgMade50] = 0.4;
  k[ID.fgMade60] = 0.1; k[ID.fgMissU40] = 0.1; k[ID.xpMade] = 2; k[ID.xpAtt] = 2.1;
  var kk = Proj.scoreProjected(k, 'K');
  /* 1*3 + .6*4 + .3*5 + .1*6 + .1*(-3) + 2*1 + .1*(-1) = 3+2.4+1.5+.6-.3+2-.1 */
  near(kk.pts, 9.1, 'a projected kicker line uses the distance ladder');

  var d = {};
  d[ID.defSack] = 2.5; d[ID.defInt] = 0.9; d[ID.defFumRec] = 0.6;
  d[ID.defTD] = 0.2; d[ID.paA] = 19;
  var dd = Proj.scoreProjected(d, 'DEF');
  near(dd.pts, 5 + 1.8 + 1.2 + 1.2 + 5, 'a projected D/ST line uses the points-allowed ladder');

  /* forced fumbles must not sneak in through the projection path either */
  var d2 = {}; d2[106] = 3; d2[ID.paA] = 19;
  near(Proj.scoreProjected(d2, 'DEF').pts, 5, 'forced fumbles score nothing');

  /* ---------- 3. ingest picks the right stat rows --------------------- */
  var feed = { players: [
    { player: { id: 3139477, fullName: 'Patrick Mahomes', defaultPositionId: 0, stats: [
      { statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 3, stats: { 1: 99 } },
      { statSourceId: 1, statSplitTypeId: 1, scoringPeriodId: 3, stats: qb },
      { statSourceId: 1, statSplitTypeId: 0, scoringPeriodId: 0, stats: qb }
    ] } }
  ] };
  var ing = Proj._ingest(feed, 2026, 3);
  ok(ing.count === 1 && ing.weekly === 1, 'ingest finds the projected weekly row');
  var rec = ing.byName[Espn.normName('Patrick Mahomes')];
  ok(rec && rec.week !== undefined && rec.season !== undefined,
     'both a weekly and a season projection are kept');
  ok(rec.week < 60 && rec.week > 40, 'the actual (statSourceId 0) row was ignored');

  /* ---------- 4. lineup auto-fill respects manual picks --------------- */
  load('store.js');
  var seed = {};
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'app/assets/seed.js'), 'utf8'))(seed);
  root.Native = null;
  root.localStorage = {
    _d: {}, getItem: function (k) { return this._d[k] || null; },
    setItem: function (k, v) { this._d[k] = v; }
  };
  var Store = root.Store;
  Store.init(seed.SEED);
  var me = seed.SEED.league.me;
  var team = Store.team(me);
  var keys = Store.slotKeys();

  /* a plausible auto lineup: first eligible player for each slot */
  function naive() {
    var used = {}, out = {};
    keys.forEach(function (kk2) {
      var e = Store.eligible(me, kk2.pos).filter(function (p) { return !used[p.id]; });
      if (e.length) { out[kk2.key] = e[0].id; used[e[0].id] = 1; }
    });
    return out;
  }
  var n1 = Store.applyAuto(5, me, naive());
  ok(n1 === keys.length, 'auto-fill fills every empty slot (' + n1 + ')');

  var qbAlt = Store.eligible(me, 'QB');
  var chosen = qbAlt.length > 1 ? qbAlt[1].id : qbAlt[0].id;
  Store.setSlot(5, me, 'QB', chosen, true);
  ok(Store.isManual(5, me, 'QB'), 'a dropdown change marks the slot as his');
  Store.applyAuto(5, me, naive());
  ok(Store.getLineup(5, me).QB === chosen,
     'auto-fill leaves a hand-picked slot alone on the next pass');

  Store.clearManual(5, me);
  Store.applyAuto(5, me, naive());
  ok(!Store.isManual(5, me, 'QB'), 'reset-to-auto clears the manual mark');

  /* a bye-week starter must still be worth zero */
  ok(Store.teamWeekPoints(5, me).total === 0, 'an unsynced week scores nothing');

  /* ---- v2.8: the schedule generator ------------------------------------
     A generator that erases a played week would be a disaster with a friendly
     name, so that is the first thing asserted. */
  load('recap.js');
  (function () {
    var S = Store.get();
    var r = root.Recap.generateSchedule({});
    ok(r.weeks > 0, 'a schedule is written (' + r.weeks + ' weeks)');
    var reg = S.league.regularSeasonWeeks, w, bad = 0, seen = {};
    for (w = 1; w <= reg; w++) {
      var mus = Store.getMatchups(w), used = {}, i;
      if (mus.length * 2 !== S.teams.length) bad++;
      for (i = 0; i < mus.length; i++) {
        if (used[mus[i][0]] || used[mus[i][1]]) bad++;
        used[mus[i][0]] = 1; used[mus[i][1]] = 1;
        var kk = [mus[i][0], mus[i][1]].sort().join('|');
        seen[kk] = (seen[kk] || 0) + 1;
      }
    }
    ok(bad === 0, 'every team plays exactly once every week, all season');
    ok(Object.keys(seen).length === (S.teams.length * (S.teams.length - 1)) / 2,
       'everybody plays everybody at least once');
  })();

  /* ---- v2.8: Sleeper is a gap-filler, never an overrule ------------------ */
  (function () {
    var got = Proj._ingestSleeper([
      { player: { first_name: 'Bo', last_name: 'Nix', position: 'QB', team: 'DEN' },
        stats: { pass_cmp: 22, pass_yd: 240, pass_td: 1.6, pass_int: 0.7, rush_yd: 18 } }
    ], 1);
    ok(got.weekly === 1, 'a Sleeper row becomes a week line');
    var rec = got.byName[Espn.normName('Bo Nix')];
    /* 22 completions alone is 22 points here — proof it was re-scored under
       THIS league's rules and not imported as somebody else\'s total */
    ok(rec.week > 38 && rec.week < 45,
       'the Sleeper line is re-scored in league points (' + rec.week.toFixed(1) + ')');
    var idOnly = Proj._ingestSleeper({ '4034': { pass_yd: 300 } }, 1);
    ok(idOnly.weekly === 0 && /player id/.test(idOnly.note),
       'the id-keyed legacy shape is refused with a reason, not half-parsed');
  })();

  /* ---- v2.6: value above replacement -----------------------------------
     The subtraction IS the feature. A trade calculator that ranks by raw
     points says a fourth running back and a startable tight end are the same
     asset, and that is how you lose a trade politely. */
  load('players.js'); load('playerdb.js'); root.PlayerDB.init();
  load('value.js');
  (function () {
    var V = root.Value;
    var taken = V.rosteredSet();
    ok(Object.keys(taken).length >= 100, 'every rostered player is excluded from the wire');
    /* a player on a roster must never appear as a free agent */
    var me = Store.team(Store.get().league.me);
    var first = me.players[0];
    var fa = V.freeAgents(1, 0);
    var leaked = fa.filter(function (f) { return f.name === first.name; });
    ok(leaked.length === 0, 'a rostered player never shows up on the free-agent board');
    ok(fa.length > 100, 'the board is built from the bundled database (' + fa.length + ' available)');
    var withSrc = fa.filter(function (f) { return !!f.src; });
    ok(withSrc.length === fa.length, 'every row says where its number came from');
    ok(V.weeksLeft(1) >= 1, 'weeks left is never zero — value would collapse to nothing');
  })();

  /* ---- v2.5: the simulator ---------------------------------------------
     Every one of these would be invisible if it were wrong: a probability that
     looks plausible is the easiest thing in the app to get silently backwards. */
  load('sim.js');
  var Sim = root.Sim;
  (function () {
    /* the draw is mean-preserving and never negative */
    var r = Sim._rng(42), i, sum = 0, neg = 0;
    for (i = 0; i < 20000; i++) { var v = Sim._draw(r, 12, 0.6); sum += v; if (v < 0) neg++; }
    var mean = sum / 20000;
    ok(neg === 0, 'a simulated week is never negative');
    ok(Math.abs(mean - 12) < 0.4, 'the random draw preserves the projection as its mean (' +
       mean.toFixed(2) + ')');
    /* right-skewed: the median must sit BELOW the mean, which is what makes a
       ceiling week possible without inventing points */
    var vals = [], r2 = Sim._rng(7);
    for (i = 0; i < 5001; i++) vals.push(Sim._draw(r2, 12, 0.6));
    vals.sort(function (a, b) { return a - b; });
    ok(vals[2500] < 12, 'the distribution is right-skewed, not a symmetric bell');

    /* the PRNG is deterministic — a win probability must not flicker on repaint */
    var a1 = Sim._rng(99)(), a2 = Sim._rng(99)();
    ok(a1 === a2, 'the same seed gives the same simulation every repaint');
  })();

  /* all-play and luck, on a league whose result is known by hand */
  (function () {
    var S = Store.get();
    /* week 6: give three teams known scores by writing the book-free path —
       teamWeekPoints reads lines, so use the store's own stat rows */
    ok(typeof Sim.power === 'function' && typeof Sim.season === 'function',
       'the simulator exposes power rankings and season odds');
    var pw = Sim.power(1);
    ok(pw.length === S.teams.length, 'every team appears in the power rankings');
    ok(pw[0].luck === 0, 'with nothing scored, nobody is lucky yet');
  })();

  /* bench regret: exact, not greedy */
  (function () {
    ok(Sim.regret(99, Store.get().league.me) === null,
       'an unscored week has no bench regret rather than a fabricated zero');
  })();

  /* ---- v2.4: the prompt is split so the fixed half can be cached ---------
     If anything volatile leaks into the static block the cache is invalidated
     on every call and the whole exercise is worthless. */
  (function () {
    var a = root.Ai._staticPrefix(), b = root.Ai._staticPrefix();
    ok(a === b, 'the cacheable prefix is byte-identical between calls');
    ok(!/week 7|2026-|Today is/.test(a), 'no week, date or roster leaks into the cached prefix');
    ok(/completed pass is worth 1 point/.test(a), 'the cached prefix still carries this league\'s scoring');
    var r = root.Ai._rosterBlock({
      week: 7, season: 2026, today: '2026-10-20',
      players: [{ name: 'Puka Nacua', pos: 'WR', nfl: 'LAR', opp: 'SF', onBye: false,
                  proj: 18.2, feedStatus: 'QUESTIONABLE', why: 'ESPN lists him QUESTIONABLE' }],
      settled: [{ name: 'Jake Bates', why: 'on bye in week 7' }],
      carried: ['Joe Burrow']
    });
    ok(/Puka Nacua/.test(r) && /why now: ESPN/.test(r), 'the volatile block carries the roster and the reason');
    ok(/do NOT research/.test(r) && /Jake Bates/.test(r),
       'a settled player is named but walled off, so no search is spent on him');
    ok(/Joe Burrow/.test(r), 'carried-forward players are named so the model does not re-add them');
  })();

  /* ---- v2.3: the league book -------------------------------------------
     Written for EVERY player, scored under THIS league's rules, and compact
     enough to keep all season. */
  Store.setBook(5, { 'joe burrow': { n: 'Joe Burrow', t: 'CIN', p: 44.2, pa: 38, cr: 2, tg: 0 } });
  ok(Store.bookWeek(5)['joe burrow'].p === 44.2, 'the book stores a league-scored week');
  ok(Store.bookNames(5)['joe burrow'].weeks === 1, 'the book indexes names across weeks');
  ok(JSON.stringify(Store.bookWeek(5)).length < 120,
     'a book row stays compact — the whole state is rewritten on every save');

(function testFreeAgentsByPosition() {
    var stub = { window: null }; stub.window = stub;
    load2('scoring.js', stub); load2('espn.js', stub); load2('names.js', stub);
    /* QBs score ~2x here — the exact condition that broke the old sort */
    var pool = [];
    function add(n, p, v) { pool.push({ n: n, p: p, t: 'FA', b: 5, _v: v }); }
    var i;
    for (i = 1; i <= 8; i++) add('QB' + i, 'QB', 40 - i);          /* 39..32 */
    for (i = 1; i <= 8; i++) add('RB' + i, 'RB', 20 - i);          /* 19..12 */
    for (i = 1; i <= 8; i++) add('WR' + i, 'WR', 18 - i);
    for (i = 1; i <= 8; i++) add('TE' + i, 'TE', 12 - i);
    for (i = 1; i <= 3; i++) add('K' + i, 'K', 9 - i);
    for (i = 1; i <= 3; i++) add('DEF' + i, 'DEF', 8 - i);
    stub.Espn = { normName: function (x) { return String(x).toLowerCase().trim(); } };
    stub.PlayerDB = { get: function () { return { players: pool }; } };
    stub.Store = { allPlayers: function () { return []; },
                   bookTrend: function () { return []; },
                   get: function () { return { league: { flexEligible: ['RB','WR','TE'] } }; } };
    var byName = {}; pool.forEach(function (x) { byName[x.n] = x._v; });
    stub.Projections = { find: function (q) {
      return byName[q.name] !== undefined ? { week: byName[q.name] } : null; } };
    stub.Recommend = { PRIOR: { QB: 30, RB: 14, WR: 13, TE: 9, K: 8, DEF: 7 } };
    load2('value.js', stub);
    var V = stub.Value;
  
    var flat = V.freeAgents(6, 40);
    var qbInTop12 = 0;
    for (i = 0; i < 12; i++) if (flat[i].pos === 'QB') qbInTop12++;
    ok(qbInTop12 === 8, 'the OLD single sort really is QB-dominated (' + qbInTop12 + '/12 in the top 12)');
  
    var g = V.byPos(6, 0);
    ok(!!g.QB && !!g.RB && !!g.WR && !!g.TE && !!g.K && !!g.DEF,
       'byPos returns a bucket for every position');
    ok(g.RB.length === 8 && g.WR.length === 8, 'every position keeps its own players');
    ok(g.RB[0].name === 'RB1' && g.WR[0].name === 'WR1',
       'each bucket is sorted best-first within the position');
    var capped = V.byPos(6, 3);
    ok(capped.QB.length === 3 && capped.RB.length === 3, 'the per-position cap is applied');
  
    /* value over replacement is the only cross-position comparison that means
       anything, and the best man at a position is by definition +0 */
    near(g.QB[0].vor, 0, 'the best free agent at a position is +0 over replacement');
    near(g.RB[0].vor, 0, 'and so is the best RB');
    near(g.RB[1].vor, -1, 'the next RB is measured against him, not against a QB');
  
    var v = V.byVor(6, 30);
    var posSeen = {}; v.slice(0, 10).forEach(function (r) { posSeen[r.pos] = 1; });
    ok(Object.keys(posSeen).length >= 3,
       'the mixed value ranking is genuinely mixed (' + Object.keys(posSeen).join(',') + ')');
    var mono = true;
    for (i = 1; i < v.length; i++) if (v[i].vor > v[i - 1].vor + 1e-9) mono = false;
    ok(mono, 'the mixed ranking is sorted by value over replacement');
  })();


  /* ---------- v3.4: the waiver-wire call ------------------------------------
   * The design contract: the APP decides who is available and what they are
   * worth in league points; CLAUDE only adds news and re-ranks. These tests
   * check the prompt actually carries that contract, and that the parser
   * cannot silently present an unverifiable suggestion as a verified one. */
  (function testWaiverPrompt() {
    var stub = { window: null }; stub.window = stub;
    load2('scoring.js', stub); load2('espn.js', stub); load2('names.js', stub);
    stub.Espn = { normName: function (x) { return String(x).toLowerCase().trim(); },
                  _httpPost: function () { return Promise.resolve('{}'); },
                  _httpGetH: function () { return Promise.resolve('{}'); } };
    stub.Store = { get: function () { return { settings: { aiKey: 'sk-ant-0123456789abcdef' } }; } };
    load2('ai.js', stub);
    var A = stub.Ai;
    var ctx = {
      week: 4, season: 2026, today: '2026-09-24',
      starters: [{ slot: 'QB', pos: 'QB', name: 'My QB', proj: 33.2 },
                 { slot: 'TE', pos: 'TE', name: 'My TE', proj: 6.1 }],
      bench: ['Bench Guy (RB)'],
      needs: [{ pos: 'TE', name: 'My TE', proj: 6.1, note: 'the wire has someone better' }],
      pool: { TE: [{ name: 'Wire TE', nfl: 'DEN', v: 9.4, vor: 2.1, bye: 9, onBye: false,
                     usage: 'wk3 5 tgt' }],
              QB: [{ name: 'Wire QB', nfl: 'NYJ', v: 28.0, vor: 0, bye: 12, onBye: false, usage: '' }] }
    };
    var pre = A._waiverPrefix(), blk = A._waiverBlock(ctx);
  
    ok(/completed pass is worth 1 point/i.test(pre),
       'the waiver prompt states the completion bonus, the whole reason public lists are wrong here');
    ok(/Never use their rankings as VALUE/i.test(pre),
       'it explicitly forbids importing outside rankings as value');
    ok(/not a single global list/i.test(pre) || /at EACH position/i.test(pre),
       'it demands a per-position answer, not one global list');
    ok(pre.indexOf('week 4') < 0 && pre.indexOf('2026-09-24') < 0,
       'the cacheable prefix carries no week or date, or the cache would never hit');
    ok(blk.indexOf('week 4') >= 0 && blk.indexOf('Wire TE') >= 0,
       'the volatile block carries the week and the candidate pool');
    ok(blk.indexOf('POSITIONS OF NEED') >= 0 && blk.indexOf('My TE') >= 0,
       'the roster weakness is stated so the ranking is for THIS team');
    ok(blk.indexOf('nobody in this list is on any of the ten rosters') >= 0,
       'availability is asserted as settled fact so no search is spent rediscovering it');
    ok(blk.indexOf('vor 2.1') >= 0,
       'value over replacement is supplied, the only cross-position comparison that works');
    ok(/rules of this league|Passing yards|completion/i.test(pre), 'the scoring table is in the prompt');
  
    /* the prefix must be byte-identical between calls or prompt caching is moot */
    ok(A._waiverPrefix() === pre, 'the cacheable waiver prefix is stable between calls');
  })();
  


  /* ---------- v3.5: the blend really does average multiple outside sources --- */
  (function testMultiSourceBlend() {
    var recRaw = fs.readFileSync(path.join(__dirname, '..', 'app/assets/recommend.js'), 'utf8');
    var prjRaw = fs.readFileSync(path.join(__dirname, '..', 'app/assets/projections.js'), 'utf8');
    ok(/sleeperWeek:\s*[\d.]+/.test(recRaw), 'Sleeper carries a blend weight of its own');
    ok(/src\('Sleeper week '/.test(recRaw), 'Sleeper is added as a named source in the blend');
    ok(/have\.sleeperWeek = /.test(prjRaw),
       'Sleeper is kept as a second opinion when ESPN already has a line');
    ok(!/if \(have && have\.week !== undefined\) continue;\s*\/\* ESPN wins \*\//.test(prjRaw),
       'the old ESPN-wins-and-Sleeper-is-discarded branch is gone');
    ok(/outside professional projection/.test(recRaw),
       'the written case says how many outside sources contributed');
    ok(/converted from their scoring into ours/.test(recRaw),
       'and says plainly that they were converted, not taken at face value');
    ok(/never used for/.test(recRaw) || /never used, anywhere/.test(recRaw),
       'the screen states that outside "projected points" are never used');
  })();
  


  /* ---------- v3.9: the transport ------------------------------------------- */
  (function testTransport() {
    var stub = { window: null }; stub.window = stub;
    stub.setTimeout = setTimeout; stub.clearTimeout = clearTimeout;
    load2('scoring.js', stub); load2('espn.js', stub); load2('names.js', stub);
    var E = stub.Espn;
  
    /* The field-goal kicker name decides whether real distances are scored or
       every kicker silently falls back to an inferred distance mix — and the
       distance ladder is one of this league's real scoring rules. */
    var cases = [
      ['(12:34) J.Tucker 45 yard field goal is GOOD', 'justin tucker'],
      ['Justin Tucker 45 Yd Field Goal', 'justin tucker'],
      ['1st and 10 at KC 32 Harrison Butker 38 yard field goal is GOOD', 'harrison butker'],
      ['(2:01) (Shotgun) Cam Little 52 yard field goal is No Good', 'cam little']
    ];
    function matches(who, want) {
      var last = want.split(' ').pop(), wl = who.split(' ').pop();
      return want.indexOf(who) >= 0 || who.indexOf(want) >= 0 ||
             (!!last && !!wl && last.length > 2 &&
              (last === wl || wl.slice(-last.length) === last));
    }
    /* the matching rule that actually SHIPPED before v3.9: plain substring,
       both directions, no last-name comparison */
    function oldMatch(who, want) {
      return want.indexOf(who) >= 0 || who.indexOf(want) >= 0;
    }
    var i, allHit = true, oldHit = 0;
    for (i = 0; i < cases.length; i++) {
      var who = E.normName(E._kickerName(cases[i][0]));
      if (!matches(who, cases[i][1])) allHit = false;
      var old = E.normName(cases[i][0].split(/\s+\d{1,2}\s*(?:yd|yard)/i)[0].trim());
      if (oldMatch(old, cases[i][1])) oldHit++;
    }
    ok(allHit, 'every field-goal play text yields a matchable kicker name');
    ok(oldHit < cases.length,
       'the pre-v3.9 combination really did miss some (' + oldHit + '/' +
       cases.length + ' matched) - so kickers were silently on inferred distances');
    /* the two halves of the fix are independent and both are worth keeping:
       a cleaner name AND a last-name comparison for the "J.Tucker" form */
    var initialForm = E.normName(E._kickerName('(12:34) J.Tucker 45 yard field goal is GOOD'));
    ok(!oldMatch(initialForm, 'justin tucker'),
       'an initial-and-surname byline still needs the last-name comparison');
    ok(matches(initialForm, 'justin tucker'), 'and the last-name comparison catches it');
  
    /* a malformed chunk header must name itself, not die inside JSON.parse */
    stub.Native = { httpChunk: function () { return ''; }, httpRelease: function () { } };
    var bad = String.fromCharCode(1) + 'CHUNKED' + String.fromCharCode(1) + 'abc' +
              String.fromCharCode(1) + 'notanumber';
    var threw = '';
    try { E._parseBody(bad, 'x', false); } catch (e) { threw = e.message; }
    ok(/chunked header with no usable length/.test(threw),
       'a malformed chunk header is reported as such (got: ' + threw + ')');
  
    /* the reassembly must not block: it returns a promise and yields between
       batches instead of firing up to 8192 synchronous bridge calls in a row */
    var espnSrc = fs.readFileSync(path.join(__dirname, '..', 'app/assets/espn.js'), 'utf8');
    ok(/root\.setTimeout\(batch, 0\)/.test(espnSrc),
       'chunk reassembly yields to the event loop between batches');
    ok(/var PER_TICK/.test(espnSrc), 'the batch size is a named constant');
    var code = espnSrc.replace(/\/\*[\s\S]*?\*\//g, '');
    ok((code.match(/httpChunk\(/g) || []).length === 1,
       'there is exactly ONE chunk-reassembly implementation');
    ok(!/guard\+\+ < 4096/.test(code), 'the legacy loop with the mismatched 4096 guard is gone');
  })();
  

  console.log(fails ? ('  ' + fails + ' engine check(s) FAILED') : '  engine checks pass');
  process.exit(fails ? 1 : 0);
});
}).catch(function (e) {
  console.log('  FAIL threw: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});

/* ---------- v3.2: the free-agent board must not be all quarterbacks --------
 * The board showed forty QBs. Not a data fault: this league pays a point per
 * completion, so a startable QB is worth roughly twice a startable RB, and ONE
 * sort across positions therefore puts every QB on top. These tests run the
 * real value.js over a synthetic pool with exactly that shape. */
