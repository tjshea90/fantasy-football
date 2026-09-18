/* test_waiver.js — guards the 2026-09-16 waiver-wire rebuild.
 *
 * Tj's screenshot showed James Conner, Dylan Sampson and Isiah Pacheco —
 * confirmed live against ESPN's own /injuries feed to all be on Injured
 * Reserve at that exact moment — as the top-ranked RB free-agent adds, and
 * complained the system "keeps recommending I switch QB" from considering
 * only one week at a time. Both are real, confirmed defects in value.js's
 * free-agent board (it never applied ANY health check, and compared a free
 * agent's this-week number against a starter's this-week number). This
 * suite drives the real modules — no source-text pins — and stubs only the
 * two dependencies value.js reads through `root.` (Recommend and
 * Projections), which is what actually makes them overridable per test
 * without needing a live network or a fully-synced season.
 */
var fs = require('fs'), path = require('path'), fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  OK   ' + m); }

function freshWindow() {
  var W = { window: null }; W.window = W;
  W.setTimeout = setTimeout; W.clearTimeout = clearTimeout;
  W.localStorage = (function () {
    var d = {};
    return { getItem: function (k) { return d[k] === undefined ? null : d[k]; },
             setItem: function (k, v) { d[k] = String(v); },
             removeItem: function (k) { delete d[k]; } };
  }());
  var disk = {};
  W.Native = { save: function (k, v) { disk[k] = v; return true; },
               load: function (k) { return disk[k] === undefined ? null : disk[k]; } };
  function load(f) {
    new Function('window', fs.readFileSync(path.join(__dirname, '..', 'app/assets', f), 'utf8'))(W);
  }
  ['seed.js', 'players.js', 'scoring.js', 'espn.js', 'names.js', 'store.js', 'playerdb.js',
   'projections.js', 'usage.js', 'recommend.js', 'ros.js', 'sim.js', 'value.js', 'recap.js',
   'ai.js'].forEach(load);
  W.Store.init(W.SEED);
  W.PlayerDB.init();
  return W;
}

console.log('\n-- Value.freeAgents(): an OUT/IR/SUSPENDED/PUP player is excluded entirely --');
(function () {
  var W = freshWindow();
  var nm = 'Zzz Hurt Guy';
  W.PlayerDB.get().players.push({ n: nm, p: 'RB', t: 'KC', b: 10, e: '', st: 'active' });
  var realHealth = W.Recommend.health;
  W.Recommend.health = function (p) {
    if (p.name === nm) return { f: 0, label: 'OUT', note: 'Injured Reserve' };
    return realHealth(p);
  };
  var fa = W.Value.freeAgents(1, 0);
  ok(!fa.some(function (r) { return r.name === nm; }),
     'a player ESPN currently has OUT/on IR never appears in the free-agent board at all — ' +
     'not down-ranked, not shown with a warning, absent (this is the exact bug: James Conner, ' +
     'Dylan Sampson and Isiah Pacheco were all confirmed on IR yet were the top RB "adds")');
})();

console.log('\n-- Value.freeAgents(): a practice-squad player is excluded entirely --');
(function () {
  var W = freshWindow();
  var nm = 'Zzz Practice Guy';
  W.PlayerDB.get().players.push({ n: nm, p: 'WR', t: 'KC', b: 10, e: '', st: 'practice-squad' });
  var fa = W.Value.freeAgents(1, 0);
  ok(!fa.some(function (r) { return r.name === nm; }),
     'a practice-squad player (cannot play in an NFL game) never appears, even though ' +
     'nothing about him looks unhealthy');
  /* an entry with no `.st` at all (a never-refreshed bundled database row) must
     default to active, or a fresh install would filter out its ENTIRE board.
     A different week — freeAgents() memoises on (week, store generation), and
     pushing directly onto PlayerDB's array bumps neither, so re-asking for
     week 1 here would just replay the FIRST call's cached answer. */
  var nm2 = 'Zzz No Status Field Guy';
  W.PlayerDB.get().players.push({ n: nm2, p: 'WR', t: 'KC', b: 10, e: '' });
  var fa2 = W.Value.freeAgents(2, 0);
  ok(fa2.some(function (r) { return r.name === nm2; }),
     'a bundled entry with no `.st` field yet defaults to shown, not silently dropped');
})();

console.log('\n-- Value.freeAgents(): DOUBTFUL/QUESTIONABLE still shown, just tagged --');
(function () {
  var W = freshWindow();
  var nm = 'Zzz Questionable Guy';
  W.PlayerDB.get().players.push({ n: nm, p: 'WR', t: 'KC', b: 10, e: '', st: 'active' });
  W.Recommend.health = function (p) {
    if (p.name === nm) return { f: 0.82, label: 'QUESTIONABLE', note: 'ankle' };
    return { f: 1, label: '', note: '' };
  };
  var fa = W.Value.freeAgents(1, 0);
  var row = fa.filter(function (r) { return r.name === nm; })[0];
  ok(!!row, 'a QUESTIONABLE player is still offered, not hidden — Tj may still want him');
  ok(row && row.healthLabel === 'QUESTIONABLE',
     'and the row carries the tag so freeAgentCard() can show it rather than presenting him as healthy');
})();

console.log('\n-- Value.freeAgents(): a background injury-feed refresh is not stuck behind the ' +
            'memo — the very next call sees it, without needing a roster change (2026-09-17) --');
(function () {
  var W = freshWindow();
  var nm = 'Zzz Now Injured Guy';
  W.PlayerDB.get().players.push({ n: nm, p: 'RB', t: 'KC', b: 10, e: '', st: 'active' });
  var currentHealth = { f: 1, label: '', note: '' };
  W.Recommend.health = function (p) {
    return p.name === nm ? currentHealth : { f: 1, label: '', note: '' };
  };
  var fa1 = W.Value.freeAgents(1, 0);
  ok(fa1.some(function (r) { return r.name === nm; }),
     'sanity: before the injury feed has him, he is shown — nothing wrongly excludes him yet');
  /* the injury feed lands in the background (Recommend.loadNews landing,
     same as ui.js's freshenInjuries triggers): health() now reports him
     OUT, and the feed's own freshness stamp moves — but nothing about MY
     roster changed, so Store.generation() is exactly what it was */
  currentHealth = { f: 0, label: 'OUT', note: 'Injured Reserve' };
  var genBefore = W.Store.generation();
  W.Recommend.newsCache = function () { return { at: Date.now(), byName: {}, count: 1 }; };
  var fa2 = W.Value.freeAgents(1, 0);
  ok(W.Store.generation() === genBefore, 'sanity: no roster change happened, generation is unchanged');
  ok(!fa2.some(function (r) { return r.name === nm; }),
     'yet the very next freeAgents() call excludes him — before this fix the free-agent-board ' +
     'memo keyed only on (week, roster generation), so it never noticed the injury feed had ' +
     'refreshed and kept replaying the FIRST call\'s stale "healthy" snapshot for the rest of the ' +
     'session. This is exactly how OUT/IR players kept reappearing on the Wire tab even after ' +
     'the exclusion code itself was correct and working');
})();

console.log('\n-- Value.freeAgents(): same, for a background PlayerDB refresh/prune --');
(function () {
  var W = freshWindow();
  var nm = 'Zzz About To Be Pruned Guy';
  W.PlayerDB.get().players.push({ n: nm, p: 'RB', t: 'KC', b: 10, e: '', st: 'active' });
  var fa1 = W.Value.freeAgents(1, 0);
  ok(fa1.some(function (r) { return r.name === nm; }), 'sanity: present before the prune');
  /* what a real PlayerDB.refresh() does on a successful prune: remove him
     from the underlying database and move PlayerDB's own updated stamp */
  var db = W.PlayerDB.get();
  db.players = db.players.filter(function (p) { return p.n !== nm; });
  db.updated = new Date().toISOString();
  var genBefore = W.Store.generation();
  var fa2 = W.Value.freeAgents(1, 0);
  ok(W.Store.generation() === genBefore, 'sanity: no roster change happened, generation is unchanged');
  ok(!fa2.some(function (r) { return r.name === nm; }),
     'and the very next call reflects the prune immediately — not only after Tj happens to add ' +
     'or drop a player of his own, which is what used to be the only thing that invalidated ' +
     'this cache');
})();

console.log('\n-- Value.freeAgents(): a zero-signal ESPN guess never outranks real measured ' +
            'production, however much bigger the guess is (2026-09-17) --');
(function () {
  var W = freshWindow();
  var real = 'Zzz Real One Game Producer';
  var guess = 'Zzz Big Guess No Track Record';
  W.PlayerDB.get().players.push({ n: real, p: 'RB', t: 'KC', b: 10, e: '', st: 'active' });
  W.PlayerDB.get().players.push({ n: guess, p: 'RB', t: 'KC', b: 10, e: '', st: 'active' });
  /* the real producer actually played and scored, in week 1 */
  W.Store.setBook(1, { 'zzz real one game producer':
    { n: real, t: 'KC', p: 9.0, pa: 0, cr: 12, tg: 2 } });
  /* the guess has never recorded a single stat — just ESPN's generic
     per-role weekly model, and it happens to print a much bigger number */
  W.Projections.find = function (player) {
    return player.name === guess ? { week: 50 } : null;
  };
  var rows = W.Value.freeAgents(2, 0);
  var byName = {};
  rows.forEach(function (r) { byName[r.name] = r; });
  ok(byName[real] && byName[guess], 'sanity: both are on the board');
  ok(byName[guess].v > byName[real].v,
     'sanity: the guess really is the bigger raw number (' + byName[guess].v +
     ' vs ' + byName[real].v + ')');
  var ranked = rows.filter(function (r) { return r.pos === 'RB'; });
  var iReal = ranked.indexOf(byName[real]), iGuess = ranked.indexOf(byName[guess]);
  ok(iReal >= 0 && iGuess >= 0 && iReal < iGuess,
     'yet the real producer still ranks ABOVE the unconfirmed guess — a number with zero track ' +
     'record behind it must never outrank a measured result just because ESPN\'s generic model ' +
     'printed something bigger (Tj, 2026-09-17: "are these legitimate recommendations?" — Nick ' +
     'Chubb/Trey Benson/Kareem Hunt, all zero measured games this season, were ranked above four ' +
     'players who had actually played and scored)');
})();

/* ==== THE 2026-09-18 REST-OF-SEASON OVERHAUL ============================
 * Tj, with a screenshot of the Wire tab in which every available receiver
 * was priced at exactly what he scored in week 1 and captioned "1 scored
 * week in this app — thin sample": "the wire tab is only making
 * recommendations and projecting scores based on prior weeks actual stats.
 * This is a broken system."
 *
 * The tests below replace the ones that pinned the OLD five-branch ladder in
 * value.js's perGame(). That ladder is gone on purpose — ros.js now blends a
 * real full-season baseline with the measured sample instead of picking one
 * branch and using it raw — so the old assertions ("season pace is divided
 * by 17 before use", "the row says which source it used") were asserting the
 * behaviour this job deliberately removed, not a contract worth keeping.
 *
 * `stubSeason` is how a test gives a player a full-season projection: ros.js
 * reads Projections.findSeason(), which in the app is filled by a separate
 * fetch (projections.js, FULL-SEASON PROJECTIONS) and here is simply handed
 * over. The map is name -> points PER GAME, because that is what a test
 * actually wants to say; the x17 to a season total is done here so the
 * conversion itself stays under test.
 */
function stubSeason(W, perGameByName) {
  W.Projections.findSeason = function (player) {
    var v = perGameByName[player.name];
    if (v === undefined) return null;
    return { pos: player.pos, season: v * 17, gp: 17, src: 'espn' };
  };
}

console.log('\n-- ros.js: a full-season projection becomes a per-game rate AND a season total --');
(function () {
  var W = freshWindow();
  var nm = 'Zzz Season Projection Guy';
  stubSeason(W, { 'Zzz Season Projection Guy': 20 });
  var pg = W.Value.perGame(nm, 'RB', 5, 0);
  ok(Math.abs(pg.v - 20) < 0.01,
     'a FULL-SEASON total is divided by the games it covers before use (got ' +
     pg.v.toFixed(2) + ', want 20.00 — valuing a 340-point season as 340 points a game ' +
     'was the original form of this bug)');
  ok(pg.games > 0 && Math.abs(pg.ros - pg.v * pg.games) < 0.01,
     'and the number the board ranks on is that rate TIMES the games he has left (' +
     pg.v.toFixed(1) + ' x ' + pg.games + ' = ' + pg.ros.toFixed(1) + ') — Tj, rule 2: ' +
     '"expected full season performance, not just the next NFL week"');
  ok(pg.src.indexOf('full-season') >= 0,
     'and the row names the season-long source it came from (got "' + pg.src + '")');
})();

console.log('\n-- THE SCREENSHOT BUG: one big week is shrunk toward the baseline, never extrapolated --');
(function () {
  var W = freshWindow();
  /* Kalif Raymond's actual row from Tj's screenshot: 9 targets, 16.4 points,
     in the only week that had been scored. The old board printed "16.4 proj"
     — his single game used verbatim as a rest-of-season rate. */
  var nm = 'Zzz One Big Week WR';
  W.PlayerDB.get().players.push({ n: nm, p: 'WR', t: 'DET', b: 0, e: '', st: 'active' });
  W.Store.setBook(1, { 'zzz one big week wr': { n: nm, t: 'DET', p: 16.4, pa: 0, cr: 0, tg: 9 } });
  stubSeason(W, { 'Zzz One Big Week WR': 8 });     /* the season-long view of him */
  var pg = W.Value.perGame(nm, 'WR', 2, 0);
  ok(pg.n === 1, 'sanity: exactly one measured game, the same as the screenshot');
  ok(pg.v < 16.4,
     'his 16.4-point week is NOT what the board projects him at (got ' + pg.v.toFixed(2) +
     ') — this is the exact number, and the exact failure, in Tj\'s screenshot');
  ok(pg.v > 8,
     'but it does move him above his 8-point baseline (got ' + pg.v.toFixed(2) +
     ') — the week is real evidence, just not a season of it');
  ok(Math.abs(pg.wObserved - 1 / (1 + W.Ros.PRIOR_GAMES)) < 1e-9,
     'and the weight it carries is exactly the documented shrinkage, n/(n+' +
     W.Ros.PRIOR_GAMES + ') = ' + pg.wObserved.toFixed(2) + ' — not 100%');
})();

console.log('\n-- ros.js: the sample takes over as it grows (one game vs eight) --');
(function () {
  function rate(games) {
    var W = freshWindow();
    var nm = 'Zzz Sample Guy';
    W.PlayerDB.get().players.push({ n: nm, p: 'WR', t: 'DET', b: 0, e: '', st: 'active' });
    var w;
    for (w = 1; w <= games; w++) {
      var row = {}; row['zzz sample guy'] = { n: nm, t: 'DET', p: 20, pa: 0, cr: 0, tg: 10 };
      W.Store.setBook(w, row);
    }
    stubSeason(W, { 'Zzz Sample Guy': 5 });
    return W.Value.perGame(nm, 'WR', games + 1, 0);
  }
  var one = rate(1), eight = rate(8);
  ok(eight.v > one.v,
     'eight 20-point games pull the estimate further from a 5-point baseline than one does (' +
     one.v.toFixed(2) + ' -> ' + eight.v.toFixed(2) + ')');
  ok(eight.wObserved > 0.6 && one.wObserved < 0.25,
     'by eight games his own season carries most of the weight (' +
     eight.wObserved.toFixed(2) + '); at one game it carries very little (' +
     one.wObserved.toFixed(2) + ') — the documented behaviour of a rest-of-season model');
})();

console.log('\n-- ros.js: efficiency is regressed toward the volume that produced it --');
(function () {
  /* Two receivers, identical usage, wildly different luck: one caught a long
     touchdown, the other did not. A rest-of-season model must not project the
     touchdown forward at face value. */
  var W = freshWindow();
  var lucky = 'Zzz Lucky WR', plain = 'Zzz Plain WR';
  W.PlayerDB.get().players.push({ n: lucky, p: 'WR', t: 'KC', b: 0, e: '', st: 'active' });
  W.PlayerDB.get().players.push({ n: plain, p: 'WR', t: 'KC', b: 0, e: '', st: 'active' });
  var bk = {};
  bk['zzz lucky wr'] = { n: lucky, t: 'KC', p: 28, pa: 0, cr: 0, tg: 8 };
  bk['zzz plain wr'] = { n: plain, t: 'KC', p: 8, pa: 0, cr: 0, tg: 8 };
  W.Store.setBook(1, bk);
  W.Store.setBook(2, bk);
  stubSeason(W, {}); /* no baseline for either — isolate the usage effect */
  var l = W.Value.perGame(lucky, 'WR', 3, 0), p2 = W.Value.perGame(plain, 'WR', 3, 0);
  ok(l.expectedPG !== null && Math.abs(l.expectedPG - p2.expectedPG) < 1e-9,
     'identical targets produce an identical volume-implied expectation for both (' +
     l.expectedPG.toFixed(2) + ')');
  ok(l.v < 28 && l.v > p2.v,
     'so the lucky one is still rated higher — he did score them — but pulled well below ' +
     'his 28-point pace (got ' + l.v.toFixed(2) + '), which is the point: opportunity is ' +
     'the stable part of a two-game sample and touchdowns are not');
})();

console.log('\n-- Value.freeAgents(): the board is ranked by REST-OF-SEASON points, not by a per-game rate --');
(function () {
  var W = freshWindow();
  /* Same rate, different availability: one has his bye still ahead of him and
     therefore one fewer game to give. On a per-game board they tie; on a
     season board the one who can actually play more wins. */
  var S = W.Store.get();
  var wk = 5;
  var full = 'Zzz Full Slate WR', bye = 'Zzz Bye Ahead WR';
  /* `b: 0` would NOT mean "no bye" — Ros.byeOf falls back to the league's own
     bye table by NFL team when a player's row carries none, exactly as
     Store.isOnBye does, so both of these would have picked up KC's and SF's
     real byes and the test would have compared two arbitrary numbers. Give
     one a bye that has already passed and the other one still ahead. */
  W.PlayerDB.get().players.push({ n: full, p: 'WR', t: 'KC', b: 1, e: '', st: 'active' });
  W.PlayerDB.get().players.push({ n: bye, p: 'WR', t: 'SF', b: S.league.regularSeasonWeeks, e: '', st: 'active' });
  stubSeason(W, { 'Zzz Full Slate WR': 12, 'Zzz Bye Ahead WR': 12 });
  var rows = W.Value.freeAgents(wk, 0);
  function row(n) { return rows.filter(function (r) { return r.name === n; })[0]; }
  var a = row(full), c = row(bye);
  ok(a && c && Math.abs(a.raw - c.raw) < 1e-9,
     'sanity: the two are identical per game (' + a.raw.toFixed(1) + ')');
  ok(a.games === c.games + 1 && a.ros > c.ros,
     'but the one with a bye still ahead has one fewer game left (' + c.games + ' vs ' +
     a.games + ') and is correctly worth less for the season (' + c.ros.toFixed(1) +
     ' vs ' + a.ros.toFixed(1) + ')');
  ok(rows.indexOf(a) < rows.indexOf(c), 'and the board puts him first');
})();

console.log('\n-- Value.upgrades(): a one-week spike with no sustained signal never fires --');
(function () {
  var W = freshWindow();
  var meId = W.Store.get().league.me;
  var nm = 'Zzz OneWeekWonder QB';
  W.PlayerDB.get().players.push({ n: nm, p: 'QB', t: 'KC', b: 10, e: '', st: 'active' });
  /* ESPN's week-specific line only — no full-season projection, no measured
     games — which is the exact shape of "one great matchup" and ros.js's own
     lowest-priority baseline before a blind guess. */
  W.Projections.find = function (player) {
    return player.name === nm ? { week: 45 } : null;
  };
  stubSeason(W, { 'My Starting QB': 20 });
  W.Recommend.bestLineup = function () {
    return [{ key: 'QB', label: 'QB', pos: 'QB',
              pick: { p: { id: 'myqb1', name: 'My Starting QB', pos: 'QB' }, proj: 20, base: 20 } }];
  };
  W.Recommend.projectAll = function () {
    return [{ p: { id: 'myqb1', name: 'My Starting QB', pos: 'QB' }, base: 20 }];
  };
  var ups = W.Value.upgrades(5, meId, null, 200);
  ok(!ups.some(function (u) { return u.fa.name === nm; }),
     'a 45-point one-week ESPN line (far above my 20-point starter) never triggers an ' +
     'upgrade suggestion on its own — this is exactly "it keeps recommending I switch QB... ' +
     'only considering week to week"');
})();

console.log('\n-- Value.upgrades(): a genuinely better free agent IS suggested, paired with who to drop, with a reason --');
(function () {
  var W = freshWindow();
  var meId = W.Store.get().league.me;
  var nm = 'Zzz Great WR';
  W.PlayerDB.get().players.push({ n: nm, p: 'WR', t: 'KC', b: 0, e: '', st: 'active' });
  stubSeason(W, { 'Zzz Great WR': 24, 'My Starting WR': 12, 'My Weak Bench WR': 3 });
  W.Recommend.bestLineup = function () {
    return [{ key: 'WR1', label: 'WR', pos: 'WR',
              pick: { p: { id: 'mywr1', name: 'My Starting WR', pos: 'WR' }, proj: 12, base: 12 } }];
  };
  W.Recommend.projectAll = function () {
    return [
      { p: { id: 'mywr1', name: 'My Starting WR', pos: 'WR' }, base: 12 },
      { p: { id: 'mywr2', name: 'My Weak Bench WR', pos: 'WR' }, base: 3 }
    ];
  };
  var ups = W.Value.upgrades(5, meId, null, 200);
  var hit = ups.filter(function (u) { return u.fa.name === nm; })[0];
  ok(!!hit, 'a free agent with a real season-long edge over the roster IS suggested');
  ok(hit && hit.drop && hit.drop.name === 'My Weak Bench WR',
     'paired with a SPECIFIC player to drop for him — the weakest bench player at the ' +
     'position, not just "someone you are starting" (got ' + (hit && hit.drop && hit.drop.name) + ')');
  ok(hit && typeof hit.why === 'string' && hit.why.indexOf(nm) >= 0 &&
     hit.why.indexOf('My Weak Bench WR') >= 0,
     'and comes with a plain-English reason naming both players (Tj: "it should explain why ' +
     'to drop the player I have in favor of the player it recommends")');
  ok(hit && hit.gain > 0 && Math.abs(hit.gain - (hit.fa.ros - hit.drop.ros)) < 0.01,
     'and the headline number is the REST-OF-SEASON point edge over that exact man (' +
     (hit ? hit.gain.toFixed(0) : '?') + '), both sides priced by the same engine');
  ok(hit && hit.why.indexOf('over the rest of the season') >= 0,
     'which the reason states in those words, as rule 4 asks');
})();

console.log('\n-- Value.upgrades(): a marginal edge is NOT suggested, however real (rule 3) --');
(function () {
  var W = freshWindow();
  var meId = W.Store.get().league.me;
  var nm = 'Zzz Barely Better WR';
  W.PlayerDB.get().players.push({ n: nm, p: 'WR', t: 'KC', b: 0, e: '', st: 'active' });
  /* half a point a game better than the man he would replace: real, measurable,
     and nowhere near worth a roster move for the rest of the year */
  stubSeason(W, { 'Zzz Barely Better WR': 10.5, 'My Bench WR': 10 });
  W.Recommend.bestLineup = function () {
    return [{ key: 'WR1', label: 'WR', pos: 'WR',
              pick: { p: { id: 'mywr1', name: 'My Starting WR', pos: 'WR' }, proj: 20, base: 20 } }];
  };
  W.Recommend.projectAll = function () {
    return [{ p: { id: 'mywr1', name: 'My Starting WR', pos: 'WR' }, base: 20 },
            { p: { id: 'mywr2', name: 'My Bench WR', pos: 'WR' }, base: 10 }];
  };
  var ups = W.Value.upgrades(5, meId, null, 200);
  ok(!ups.some(function (u) { return u.fa.name === nm; }),
     'Tj, rule 3: "only recommend I drop and add a player ... if they are a MEANINGFUL ' +
     'improvement for the rest of the season" — half a point a game is not one, even though ' +
     'it is a genuine edge and would have cleared the old flat 1-point bar over a full season');
})();

console.log('\n-- Value.upgrades(): QB needs a much bigger, better-proven edge than other ' +
            'positions (2026-09-18) --');
/* Tj: "it always recommends qb switch from the QBs I already have, Stafford and bo
 * nix... I drafted these QBs because they had excellent stats last quarter and they
 * are pass heavy, in this league the scoring is one point for every completed pass.
 * Only recommend a replacement qb if it is truly a season edge over the high
 * completion QBs I already have." A completion pays a full point here, so a good QB
 * already outscores a good RB/WR by 3-4x per game — the bar that is real signal at
 * running back is pure noise at quarterback. Three scenarios, same incumbent (a
 * 20-point/game starting QB): a big edge with no real games behind it, a real-games
 * edge too small to matter, and a real-games edge big enough to actually mean
 * something. */
(function () {
  var meRoster = function () {
    return [{ p: { id: 'myqb1', name: 'My Starting QB', pos: 'QB' }, base: 20 }];
  };
  var meLineup = function () {
    return [{ key: 'QB', label: 'QB', pos: 'QB',
              pick: { p: { id: 'myqb1', name: 'My Starting QB', pos: 'QB' }, proj: 20, base: 20 } }];
  };

  (function () {
    var W = freshWindow();
    var meId = W.Store.get().league.me;
    var nm = 'Zzz Unproven Season Model QB';
    W.PlayerDB.get().players.push({ n: nm, p: 'QB', t: 'KC', b: 0, e: '', st: 'active' });
    /* a rest-of-season MODEL only — no games actually played for this app to
       measure — even though the raw gap (10/game) clears every other bar easily */
    stubSeason(W, { 'Zzz Unproven Season Model QB': 30, 'My Starting QB': 20 });
    W.Recommend.bestLineup = meLineup; W.Recommend.projectAll = meRoster;
    var ups = W.Value.upgrades(5, meId, null, 200);
    ok(!ups.some(function (u) { return u.fa.name === nm; }),
       'a QB with a big edge but ZERO real measured games is not suggested — a ' +
       'projection, however confident, is not "truly a season edge" on its own');
  })();

  (function () {
    var W = freshWindow();
    var meId = W.Store.get().league.me;
    var nm = 'Zzz Modest Real Edge QB';
    W.PlayerDB.get().players.push({ n: nm, p: 'QB', t: 'KC', b: 0, e: '', st: 'active' });
    /* three REAL scored weeks at 22, and a season projection agreeing — only 2
       more per game than my 20-point starter */
    W.Store.setBook(1, { 'zzz modest real edge qb': { n: nm, t: 'KC', p: 22, pa: 30, cr: 0, tg: 0 } });
    W.Store.setBook(2, { 'zzz modest real edge qb': { n: nm, t: 'KC', p: 22, pa: 30, cr: 0, tg: 0 } });
    W.Store.setBook(3, { 'zzz modest real edge qb': { n: nm, t: 'KC', p: 22, pa: 30, cr: 0, tg: 0 } });
    stubSeason(W, { 'Zzz Modest Real Edge QB': 22, 'My Starting QB': 20 });
    W.Recommend.bestLineup = meLineup; W.Recommend.projectAll = meRoster;
    var ups = W.Value.upgrades(5, meId, null, 200);
    ok(!ups.some(function (u) { return u.fa.name === nm; }),
       'a QB with real games behind him but only a small per-game edge (2, well above the ' +
       'bar every other position uses) is STILL not suggested — this is noise at ' +
       'quarterback\'s scale, not a season-defining edge');
  })();

  (function () {
    var W = freshWindow();
    var meId = W.Store.get().league.me;
    var nm = 'Zzz Real Proven Edge QB';
    W.PlayerDB.get().players.push({ n: nm, p: 'QB', t: 'KC', b: 0, e: '', st: 'active' });
    /* three real scored weeks at 30 — a genuine, well-proven 10/game edge */
    W.Store.setBook(1, { 'zzz real proven edge qb': { n: nm, t: 'KC', p: 30, pa: 35, cr: 0, tg: 0 } });
    W.Store.setBook(2, { 'zzz real proven edge qb': { n: nm, t: 'KC', p: 30, pa: 35, cr: 0, tg: 0 } });
    W.Store.setBook(3, { 'zzz real proven edge qb': { n: nm, t: 'KC', p: 30, pa: 35, cr: 0, tg: 0 } });
    stubSeason(W, { 'Zzz Real Proven Edge QB': 30, 'My Starting QB': 20 });
    W.Recommend.bestLineup = meLineup; W.Recommend.projectAll = meRoster;
    var ups = W.Value.upgrades(5, meId, null, 200);
    var hit = ups.filter(function (u) { return u.fa.name === nm; })[0];
    ok(!!hit, 'a QB with real, proven, large rest-of-season production IS still ' +
       'suggested — this rule is skepticism, not a blanket ban on ever upgrading a QB');
    ok(hit && hit.why.indexOf('quarterback') >= 0,
       'and the reason explicitly says why a QB swap is held to a higher bar');
  })();
})();

console.log('\n-- Value.upgrades(): a season-ending injury MANDATES a replacement, overriding every de-prioritisation (rule 6) --');
/* Tj, rule 6: K, DEF and QB stay low priority "unless there is a strong, clear,
 * season long edge ... or if there is a season ending injury or anything else
 * that mandates the player be replaced", and rule 4's own worked example is
 * "drop bo nix due to season ending injury and add j. Hurts because he is the
 * best available qb". A replacement QB who has not played three games — the
 * bar that normally blocks him outright — must still be offered when the
 * incumbent is finished for the year. */
(function () {
  var W = freshWindow();
  var meId = W.Store.get().league.me;
  var nm = 'Zzz Available Backup QB';
  W.PlayerDB.get().players.push({ n: nm, p: 'QB', t: 'KC', b: 0, e: '', st: 'active' });
  stubSeason(W, { 'Zzz Available Backup QB': 22, 'My Broken QB': 26 });
  W.Recommend.bestLineup = function () {
    return [{ key: 'QB', label: 'QB', pos: 'QB',
              pick: { p: { id: 'myqb1', name: 'My Broken QB', pos: 'QB' }, proj: 26, base: 26 } }];
  };
  W.Recommend.projectAll = function () {
    return [{ p: { id: 'myqb1', name: 'My Broken QB', pos: 'QB' }, base: 26 }];
  };

  /* healthy first: the backup is WORSE than my starter, so nothing is offered */
  var before = W.Value.upgrades(5, meId, null, 200);
  ok(!before.some(function (u) { return u.fa.name === nm; }),
     'sanity: while my quarterback is healthy, a worse free agent is not suggested');

  /* now the season-ending designation lands */
  var realOutlook = W.Recommend.seasonOutlook;
  W.Recommend.seasonOutlook = function (pl) {
    if (pl.name === 'My Broken QB') {
      return { seasonEnding: true, why: 'INJURED RESERVE — torn ACL, out for the season' };
    }
    return realOutlook(pl);
  };
  var after = W.Value.upgrades(5, meId, null, 200);
  var hit = after.filter(function (u) { return u.fa.name === nm; })[0];
  ok(!!hit,
     'once he is ruled out for the season the replacement IS offered, even though the ' +
     'backup projects LOWER than the healthy incumbent did and has zero measured games — ' +
     'the three-games-on-tape rule for QB cannot be allowed to leave the slot empty');
  ok(hit && hit.mandated === true && hit.drop.name === 'My Broken QB',
     'and it is flagged as a mandated replacement of that exact man, not an optional upgrade');
  ok(hit && hit.why.indexOf('done for the season') >= 0 && hit.why.indexOf('torn ACL') >= 0,
     'with the reason naming the season-ending cause rather than a point margin (got: ' +
     (hit ? '"' + hit.why.slice(0, 70) + '..."' : 'nothing') + ')');
  ok(hit && after.indexOf(hit) === 0,
     'and a mandated replacement is ranked first, ahead of any optional upgrade');
})();

console.log('\n-- Value.upgrades(): K/DEF never bump a real need, and only appear on a genuine need or a strong season edge (rule 6) --');
/* Tj, same message: "defense and kicker are not priorities." The Claude-driven board
 * (ai.js normalizeWaivers) already gated K/DEF on kdefNeed; this deterministic,
 * no-cost board — the one that needs no API key and is always on screen — never had
 * that gate, so a streamable K/DEF could out-rank an actual RB/WR need. */
(function () {
  var W = freshWindow();
  var meId = W.Store.get().league.me;
  var nm = 'Zzz Great Streaming DEF';
  W.PlayerDB.get().players.push({ n: nm, p: 'DEF', t: 'SF', b: 0, e: '', st: 'active' });
  stubSeason(W, { 'Zzz Great Streaming DEF': 15, 'My Healthy DEF': 8 });
  W.Recommend.bestLineup = function () {
    return [{ key: 'DEF', label: 'DEF', pos: 'DEF',
              pick: { p: { id: 'mydef1', name: 'My Healthy DEF', pos: 'DEF' }, proj: 8, base: 8 } }];
  };
  W.Recommend.projectAll = function () {
    return [{ p: { id: 'mydef1', name: 'My Healthy DEF', pos: 'DEF' }, base: 8,
              onBye: false, h: { label: '' } }];
  };
  var ups = W.Value.upgrades(5, meId, null, 200);
  ok(!ups.some(function (u) { return u.fa.name === nm; }),
     'a DEF free agent projecting well above my own healthy, available DEF is NOT ' +
     'suggested — defense/kicker are low priority regardless of the raw point gap');

  /* same free agent, but now MY OWN defense is genuinely unavailable this week */
  W.Recommend.projectAll = function () {
    return [{ p: { id: 'mydef1', name: 'My Healthy DEF', pos: 'DEF' }, base: 8,
              onBye: false, h: { label: 'OUT' } }];
  };
  var ups2 = W.Value.upgrades(5, meId, null, 200);
  ok(ups2.some(function (u) { return u.fa.name === nm; }),
     'the SAME free agent IS suggested once my own DEF is ruled OUT — low priority, ' +
     'not a blanket ban when there is a genuine need');
})();

console.log('\n-- Value.upgrades(): the K/DEF exception needs a STRONG season edge, not merely a measured one --');
(function () {
  function build(faPerGame) {
    var W = freshWindow();
    var meId = W.Store.get().league.me;
    var nm = 'Zzz Measured DEF';
    W.PlayerDB.get().players.push({ n: nm, p: 'DEF', t: 'SF', b: 0, e: '', st: 'active' });
    /* two measured games plus a season projection — 'high' confidence, which is
       what lets a K/DEF be considered at all when mine is perfectly available */
    W.Store.setBook(1, { 'zzz measured def': { n: nm, t: 'SF', p: faPerGame, pa: 0, cr: 0, tg: 0 } });
    W.Store.setBook(2, { 'zzz measured def': { n: nm, t: 'SF', p: faPerGame, pa: 0, cr: 0, tg: 0 } });
    stubSeason(W, { 'Zzz Measured DEF': faPerGame, 'My Healthy DEF': 8 });
    W.Recommend.bestLineup = function () {
      return [{ key: 'DEF', label: 'DEF', pos: 'DEF',
                pick: { p: { id: 'mydef1', name: 'My Healthy DEF', pos: 'DEF' }, proj: 8, base: 8 } }];
    };
    W.Recommend.projectAll = function () {
      return [{ p: { id: 'mydef1', name: 'My Healthy DEF', pos: 'DEF' }, base: 8,
                onBye: false, h: { label: '' } }];
    };
    return { ups: W.Value.upgrades(3, meId, null, 200), nm: nm };
  }
  var weak = build(11);      /* 3/game better than mine */
  ok(!weak.ups.some(function (u) { return u.fa.name === weak.nm; }),
     'a measured, confident DEF that is merely better than mine is still not suggested — ' +
     'rule 6 asks for a STRONG, CLEAR season-long edge at this position, not any edge');
  var strong = build(20);    /* 12/game better, a season-defining gap */
  ok(strong.ups.some(function (u) { return u.fa.name === strong.nm; }),
     'but one that clears the much larger season-long bar IS — the exception rule 6 ' +
     'explicitly allows for ("a strong, clear, season long edge")');
})();

console.log('\n-- the free-agent memo notices a completed SEASON-PROJECTION refresh (2026-09-18) --');
/* The third instance of a trap this file has now been caught by twice before
 * (see freeAgents()' own comment on the PlayerDB and injury-feed refreshes).
 * The Wire tab fires Projections.refreshSeason() in the background on open and
 * re-renders when it lands — but that fetch touches neither the roster
 * generation, the player database nor the injury feed. If the memo does not
 * key on it, the completed refresh replays the board computed from an EMPTY
 * season cache and the whole rest-of-season overhaul looks like it never ran. */
(function () {
  var W = freshWindow();
  var nm = 'Zzz Late Projection WR';
  W.PlayerDB.get().players.push({ n: nm, p: 'WR', t: 'KC', b: 1, e: '', st: 'active' });

  /* first render: nothing has been fetched yet */
  W.Projections.findSeason = function () { return null; };
  var before = W.Value.freeAgents(5, 0).filter(function (r) { return r.name === nm; })[0];
  ok(!!before && before.baselineKind === 'floor',
     'sanity: with no season projection on file he sits on a positional floor');

  /* the background fetch lands — same shape as projections.js's own cache */
  W.Projections.findSeason = function (player) {
    return player.name === nm ? { pos: 'WR', season: 17 * 18, gp: 17, src: 'espn' } : null;
  };
  var stale = W.Value.freeAgents(5, 0).filter(function (r) { return r.name === nm; })[0];
  ok(stale && stale.baselineKind === 'floor',
     'sanity: the memo is still warm at this point — nothing else has changed');

  /* and now the cache stamp moves, exactly as a real refresh moves it */
  W.Projections.seasonMeta = function () { return { at: Date.now(), count: 1 }; };
  var after = W.Value.freeAgents(5, 0).filter(function (r) { return r.name === nm; })[0];
  ok(after && after.baselineKind === 'season' && Math.abs(after.v - 18) < 0.01,
     'the very next call after the refresh lands uses it (got ' +
     (after ? after.baselineKind + ', ' + after.v.toFixed(1) + '/gm' : 'nothing') +
     ') — not only after Tj happens to add or drop a player');
})();

console.log('\n-- a synced week of stats invalidates the board immediately (2026-09-18) --');
/* Store.setBook did not bump the store generation, so the free-agent memo and
 * ros.js's per-opportunity rate table both kept serving numbers computed
 * before the sync. Survivable while the board leaned on projections; not once
 * a player's own scored games are half the estimate. */
(function () {
  var W = freshWindow();
  var nm = 'Zzz Just Scored WR';
  W.PlayerDB.get().players.push({ n: nm, p: 'WR', t: 'KC', b: 1, e: '', st: 'active' });
  W.Projections.findSeason = function (player) {
    return player.name === nm ? { pos: 'WR', season: 17 * 5, gp: 17, src: 'espn' } : null;
  };
  var before = W.Value.freeAgents(3, 0).filter(function (r) { return r.name === nm; })[0];
  ok(before && before.n === 0, 'sanity: no scored games for him yet');

  /* a sync lands a big week for him — nothing else about the league changes */
  W.Store.setBook(2, { 'zzz just scored wr': { n: nm, t: 'KC', p: 30, pa: 0, cr: 0, tg: 12 } });
  var after = W.Value.freeAgents(3, 0).filter(function (r) { return r.name === nm; })[0];
  ok(after && after.n === 1 && after.v > before.v,
     'the board reflects it on the very next render (' + before.v.toFixed(2) + ' -> ' +
     (after ? after.v.toFixed(2) : '?') + ') rather than waiting for a roster change');
})();

console.log('\n-- PlayerDB: roster status is captured, and practice-squad is distinguished from active --');
var chain = (function () {
  var W = freshWindow();
  function fakeRoster(items) { return { athletes: [{ position: 'offense', items: items }] }; }
  W.Espn._httpGet = function () {
    return Promise.resolve(fakeRoster([
      { id: '101', fullName: 'Test Active Guy', position: { abbreviation: 'WR' }, status: { type: 'active' } },
      { id: '102', fullName: 'Test PS Guy', position: { abbreviation: 'WR' }, status: { type: 'practice-squad' } },
      { id: '103', fullName: 'Test DayToDay Guy', position: { abbreviation: 'WR' }, status: { type: 'day-to-day' } }
    ]));
  };
  return W.PlayerDB.refresh().then(function (r) {
    ok(r.failed.length === 0, 'the mocked refresh succeeds for every team (' + r.failed.length + ' failed)');
    var players = W.PlayerDB.get().players;
    function find(n) { return players.filter(function (p) { return p.n === n; })[0]; }
    ok(find('Test Active Guy') && find('Test Active Guy').st === 'active',
       'an active-roster athlete is captured as active');
    ok(find('Test PS Guy') && find('Test PS Guy').st === 'practice-squad',
       'a practice-squad athlete is captured as practice-squad, not active');
    ok(find('Test DayToDay Guy') && find('Test DayToDay Guy').st === 'active',
       'a day-to-day (still on the real roster, just banged up) athlete counts as active — ' +
       'the /injuries feed already gives the real OUT/DOUBTFUL/QUESTIONABLE granularity');

    console.log('\n-- PlayerDB: prunes a player who has fallen off every one of the 32 rosters --');
    var stillPresent = W.PlayerDB.get().players.some(function (p) { return p.n === 'Test Active Guy'; });
    ok(stillPresent, 'sanity: the player is present after the first refresh');
    /* simulate him being released: no team's roster includes him any more,
       but every team still returns a real (non-empty) roster */
    W.Espn._httpGet = function () {
      return Promise.resolve(fakeRoster([
        { id: '999', fullName: 'Test Filler Guy', position: { abbreviation: 'RB' }, status: { type: 'active' } }
      ]));
    };
    return W.PlayerDB.refresh().then(function (r2) {
      ok(r2.failed.length === 0, 'the second, full 32-team refresh also succeeds cleanly');
      ok(r2.removed > 0, 'and it reports at least one removal (got ' + r2.removed + ')');
      var gone = !W.PlayerDB.get().players.some(function (p) { return p.n === 'Test Active Guy'; });
      ok(gone, 'a player missing from EVERY one of the 32 rosters on a clean, all-succeeded ' +
        'refresh is actually removed — not left stale forever with an old team/position ' +
        '(this is exactly how Nick Chubb and Kareem Hunt, confirmed off all 32 current NFL ' +
        'rosters, were still showing up as recommended adds)');
    });
  });
}());

console.log('\n-- PlayerDB: a GENUINE partial refresh (one team fails, the rest succeed) still ' +
            'prunes players whose OWN last-known team actually answered (2026-09-17) --');
chain = chain.then(function () {
  var W = freshWindow();
  function fakeRoster(items) { return { athletes: [{ position: 'offense', items: items }] }; }
  var goodRoster = fakeRoster([
    { id: '301', fullName: 'Test KC Survivor', position: { abbreviation: 'RB' }, status: { type: 'active' } }
  ]);
  W.Espn._httpGet = function () { return Promise.resolve(goodRoster); };
  return W.PlayerDB.refresh().then(function () {
    /* one player whose last-known team (KC) is ABOUT to answer cleanly and
       not include him — provably gone; one whose last-known team (WAS) is
       ABOUT to fail every candidate this run — unproven, must survive */
    W.PlayerDB.get().players.push(
      { n: 'Test KC Gone Guy', p: 'RB', t: 'KC', b: 10, e: '', st: 'active' },
      { n: 'Test WAS Unproven Guy', p: 'RB', t: 'WAS', b: 14, e: '', st: 'active' }
    );
    W.Espn._httpGet = function (url) {
      if (/\/teams\/(wsh|28|WAS)(\/|\?)/.test(url)) return Promise.reject(new Error('offline'));
      return Promise.resolve(goodRoster);
    };
    return W.PlayerDB.refresh().then(function (r) {
      ok(r.failed.length === 1 && r.failed[0].indexOf('WAS') === 0,
         'exactly WAS failed this run, no other team (got: ' + JSON.stringify(r.failed) + ')');
      var players = W.PlayerDB.get().players;
      function has(n) { return players.some(function (p) { return p.n === n; }); }
      ok(has('Test KC Survivor'), 'a player really still on a team whose fetch succeeded survives');
      ok(!has('Test KC Gone Guy'),
         'a player whose OWN last-known team\'s fetch succeeded this run, and who was not found ' +
         'on it, is pruned — even though one OTHER team (WAS) failed in the very same run. The ' +
         'old rule required a flawless 32/32 sweep before removing ANYBODY, which real mobile ' +
         'networks rarely deliver twice in a row — confirmed 2026-09-17 to be exactly how Nick ' +
         'Chubb and Kareem Hunt (live-checked: on zero of the 32 current NFL rosters) kept sitting ' +
         'in the database and reappearing on the Wire board after the 2026-09-16 fix that was ' +
         'supposed to remove them for good');
      ok(has('Test WAS Unproven Guy'),
         'but a player whose own last-known team\'s fetch FAILED this run is left alone — ' +
         'unproven, not assumed gone, because that one team never actually answered');
    });
  });
});

console.log('\n-- PlayerDB: a PARTIAL failure never prunes anybody --');
chain = chain.then(function () {
  var W = freshWindow();
  function fakeRoster(items) { return { athletes: [{ position: 'offense', items: items }] }; }
  W.Espn._httpGet = function () {
    return Promise.resolve(fakeRoster([
      { id: '201', fullName: 'Test Survivor Guy', position: { abbreviation: 'RB' }, status: { type: 'active' } }
    ]));
  };
  return W.PlayerDB.refresh().then(function () {
    ok(W.PlayerDB.get().players.some(function (p) { return p.n === 'Test Survivor Guy'; }),
       'sanity: present after a clean first refresh');
    /* now every team's roster fetch fails outright */
    W.Espn._httpGet = function () { return Promise.reject(new Error('offline')); };
    return W.PlayerDB.refresh().then(function (r) {
      ok(r.failed.length > 0, 'this refresh genuinely failed for every team (' + r.failed.length + ' failed)');
      ok(!r.removed, 'and NOTHING was pruned on a failed attempt (got removed=' + r.removed + ')');
      ok(W.PlayerDB.get().players.some(function (p) { return p.n === 'Test Survivor Guy'; }),
         'the player from the earlier successful refresh is still there — a network outage ' +
         'must never be read as "every player just left every roster"');
    });
  });
});

chain.then(function () {
  console.log(fails ? ('\n  ' + fails + ' waiver check(s) FAILED') : '\n  waiver checks pass');
  process.exit(fails ? 1 : 0);
}).catch(function (e) {
  console.log('  FAIL uncaught: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
