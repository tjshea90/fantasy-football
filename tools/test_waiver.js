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
   'projections.js', 'usage.js', 'recommend.js', 'sim.js', 'value.js', 'recap.js',
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
     default to active, or a fresh install would filter out its ENTIRE board */
  var nm2 = 'Zzz No Status Field Guy';
  W.PlayerDB.get().players.push({ n: nm2, p: 'WR', t: 'KC', b: 10, e: '' });
  var fa2 = W.Value.freeAgents(1, 0);
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

console.log('\n-- Value.perGame(): ESPN season pace is a per-game rate, not a raw season total --');
(function () {
  var W = freshWindow();
  var nm = 'Zzz Season Pace Guy';
  W.Projections.find = function (player) {
    return player.name === nm ? { season: 340 } : null;   /* no .week, no measured games */
  };
  var pg = W.Value.perGame(nm, 'RB', 5);
  var want = 340 / 17;
  ok(Math.abs(pg.v - want) < 0.01,
     'season pace (a FULL-SEASON total from projections.js) is divided by 17 before use ' +
     '(got ' + pg.v.toFixed(2) + ', want ' + want.toFixed(2) + ' — the old code returned 340 ' +
     'itself, valuing him at roughly 17x his real rest-of-season rate)');
  ok(pg.src.indexOf('season pace') >= 0, 'and the row says which source it used');
})();

console.log('\n-- Value.upgrades(): a one-week spike with no sustained signal never fires --');
(function () {
  var W = freshWindow();
  var meId = W.Store.get().league.me;
  var nm = 'Zzz OneWeekWonder QB';
  W.PlayerDB.get().players.push({ n: nm, p: 'QB', t: 'KC', b: 10, e: '', st: 'active' });
  /* ESPN's week-specific line only (no season pace, no measured games) — the
     exact shape of "one great matchup", and perGame()'s own lowest-priority
     fallback before a blind guess, so it is real data but never `confident`. */
  W.Projections.find = function (player) {
    return player.name === nm ? { week: 45 } : null;
  };
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

console.log('\n-- Value.upgrades(): a genuinely better, confident free agent IS suggested, paired with who to drop, with a reason --');
(function () {
  var W = freshWindow();
  var meId = W.Store.get().league.me;
  var nm = 'Zzz Great WR';
  W.PlayerDB.get().players.push({ n: nm, p: 'WR', t: 'KC', b: 10, e: '', st: 'active' });
  /* a season-long signal, not one week — this is what makes him `confident` */
  W.Projections.find = function (player) {
    return player.name === nm ? { season: 24 * 17 } : null;
  };
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
  ok(hit && hit.weeks > 0 && hit.gain > 0,
     'the gain is expressed over the actual weeks left in the season, not one week\'s points');
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
