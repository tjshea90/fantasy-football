/* test_wire.js — guards the 2026-09-18d waiver-wire repair.
 *
 * Tj's screenshot of the Wire tab in week 2 showed, in this order:
 *
 *   "36 players on your roster are out for the season — those spots are doing
 *    nothing until you replace them:"
 *   Wan'Dale Robinson  WR · replaces Dalton Schultz, who is out for the season
 *   Juwan Johnson      TE · replaces Dalton Schultz, who is out for the season
 *   Josh Jacobs        RB · replaces Dalton Schultz, who is out for the season
 *   Brenton Strange    TE · replaces Dalton Schultz, who is out for the season
 *
 * His roster is seventeen players and Dalton Schultz was, at that moment,
 * healthy and starting for Houston. Three separate defects, all of them in
 * this suite:
 *
 *   1. seasonOutlook() promoted ANY match of a season-ending phrase anywhere
 *      in a free-text news blurb, ignoring ESPN's own `status` field. Pulled
 *      live on 2026-09-18 from the same /injuries endpoint the app reads,
 *      Schultz's record is status ACTIVE and his blurb is about JAYDEN
 *      HIGGINS' torn ACL. Thirteen of the fourteen players that regex fired
 *      on across the live feed were status ACTIVE — Patrick Mahomes and Malik
 *      Nabers among them, written off for injuries they had come back from.
 *      The fixtures below are that live text, verbatim.
 *   2. upgrades() paired every free agent with the single weakest droppable
 *      man, so one (falsely) dead roster spot was offered to the whole wire.
 *   3. the Wire tab counted those ROWS and called them players.
 *
 * Plus Tj's new rule in the same message: "generally it should recommend a
 * same type player position for the recommended drop and add, because if I
 * drop a te, I should have a backup te to replace him, but this rule is not
 * absolute."
 *
 * Drives the real modules; stubs only what value.js reads through `root.`.
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

/* File a record into the live injury cache exactly as loadNews() would. */
function news(W, rec) {
  var nc = W.Recommend.newsCache();
  if (!nc.byName) nc.byName = {};
  nc.at = Date.now();
  nc.byName[W.Espn.normName(rec.name)] = {
    status: rec.status || '', note: rec.note || '',
    fantasyStatus: rec.fantasyStatus || '', returnDate: rec.returnDate || '',
    typeName: rec.typeName || '', at: rec.at || ''
  };
  nc.count = Object.keys(nc.byName).length;
}

/* ============================================================ BUG 1 ======= */
console.log('\n-- seasonOutlook(): the exact live records that produced the hallucination --');

/* Verbatim from ESPN's /injuries feed, 2026-09-18. Each one of these made the
   old regex declare a healthy, playing man finished for the year. */
var LIVE_FALSE_POSITIVES = [
  { name: 'Dalton Schultz', status: 'ACTIVE',
    note: "Schultz's eight targets were second on the team to Nico Collins' 10 on 38 pass " +
          "attempts by C.J. Stroud. Schultz doesn't offer much big-play ability at 30 years " +
          "old, but he's a reliable target in the middle of the field and saw his floor raise " +
          "when Jayden Higgins went down with a season-ending torn ACL over the summer. The " +
          "veteran tight end will be a borderline TE1/2 next Sunday against the Bengals.",
    lesson: "somebody ELSE's season-ending injury, named inside his write-up" },
  { name: 'Patrick Mahomes', status: 'ACTIVE',
    note: "Despite being on the injury report all week, Mahomes was never in any real danger " +
          "of missing Monday night's game following last December's season-ending knee injury, " +
          "Mahomes endured a cold start before settling in.",
    lesson: "HIS OWN injury, but last season's, which he has already returned from" },
  { name: 'Malik Nabers', status: 'ACTIVE',
    note: "Nabers was limited in practice all week but ultimately suited up for his first game " +
          "action since suffering a torn ACL and meniscus in Week 4 of last season.",
    lesson: "the injury that ENDED last season, described in a story about him playing again" },
  { name: 'Emari Demercado', status: 'ACTIVE',
    note: "Demercado figures to have a role in the Cowboys offense moving forward, especially " +
          "with Malik Davis (hip) out for the season.",
    lesson: "a teammate's injury is the whole REASON for his good news" },
  { name: 'Cam Skattebo', status: 'ACTIVE',
    note: "Skattebo took 11 carries for 44 yards in his return from a season-ending ankle " +
          "fracture suffered in Week 8 of his rookie campaign.",
    lesson: "'in his return from' is the opposite of being out" }
];

(function () {
  var W = freshWindow();
  LIVE_FALSE_POSITIVES.forEach(function (r) { news(W, r); });
  LIVE_FALSE_POSITIVES.forEach(function (r) {
    var o = W.Recommend.seasonOutlook({ name: r.name });
    ok(o.seasonEnding === false,
       r.name + ' is NOT written off for the season — ' + r.lesson);
  });
  /* the specific claim Tj called a major error */
  var s = W.Recommend.seasonOutlook({ name: 'Dalton Schultz' });
  ok(s.seasonEnding === false && s.longTermOut === false && !s.why,
     'and Dalton Schultz carries no season-ending claim of any kind — ESPN has him ' +
     'ACTIVE, and no amount of prose in his blurb may outvote that');
})();

console.log('\n-- seasonOutlook(): a genuinely finished player is still caught --');
(function () {
  var W = freshWindow();
  /* live, 2026-09-18: ESPN's 2027-02-15 return date is its "not this season"
     sentinel, and the note corroborates it in his own words. */
  news(W, { name: 'Jake Tonges', status: 'INJURED RESERVE', fantasyStatus: 'IR',
            returnDate: '2027-02-15',
            note: "The team placed Tonges on injured reserve earlier Wednesday, and now it's " +
                  "official that he will miss the rest of the season. Tonges suffered an MCL tear." });
  var o = W.Recommend.seasonOutlook({ name: 'Jake Tonges' });
  ok(o.seasonEnding === true, 'a man on IR with no return inside this season IS season-ending');
  ok(/miss the rest of the season/.test(o.why),
     'and the reason quotes his OWN sentence rather than a generic label (got: "' +
     String(o.why).slice(0, 60) + '...")');
  ok(o.mustReplace === true, 'and he is flagged as a roster spot that must be replaced');
})();

console.log('\n-- seasonOutlook(): on IR but COMING BACK is a different fact, and the app now says which --');
(function () {
  var W = freshWindow();
  /* live, 2026-09-18 — an ordinary four-game IR stint, not a lost season */
  news(W, { name: 'Dylan Sampson', status: 'INJURED RESERVE', fantasyStatus: 'IR',
            returnDate: '2026-10-18', note: 'Sampson will miss at least the next four games.' });
  var o = W.Recommend.seasonOutlook({ name: 'Dylan Sampson' });
  ok(o.seasonEnding === false,
     'a four-game IR stint with an October return date is NOT "out for the season" — ' +
     'the old code could not tell these two apart and called both of them finished');
  ok(o.longTermOut === true, 'it is reported as a long-term absence instead');
  ok(o.returnAround === 'Oct 18',
     'with the date he is actually eligible to return, in words (got: "' + o.returnAround + '")');

  /* and a return DESIGNATION says the same thing even without a usable date */
  news(W, { name: 'Frank Crum', status: 'INJURED RESERVE', fantasyStatus: 'IR-R',
            returnDate: '2026-10-11', note: 'ir' });
  var c = W.Recommend.seasonOutlook({ name: 'Frank Crum' });
  ok(c.seasonEnding === false && c.longTermOut === true,
     'and an IR-R / PUP-R return designation is honoured — "designated to return" ' +
     'cannot mean "done for the year"');
})();

console.log('\n-- seasonOutlook(): a plain weekly OUT, and an unexplained designation, never become "out for the season" --');
(function () {
  var W = freshWindow();
  news(W, { name: 'Zzz Weekly Out', status: 'OUT', note: 'Zzz will not play Sunday (ankle).' });
  ok(W.Recommend.seasonOutlook({ name: 'Zzz Weekly Out' }).seasonEnding === false,
     'a one-week OUT is not a season — writing a roster off on a weekly designation is ' +
     'the far worse of the two possible errors');
  /* no return date, no corroborating note: parked, but no claim beyond that */
  news(W, { name: 'Zzz Parked Nobody', status: 'INJURED RESERVE', fantasyStatus: 'IR',
            returnDate: '', note: '' });
  var o = W.Recommend.seasonOutlook({ name: 'Zzz Parked Nobody' });
  ok(o.seasonEnding === false && o.longTermOut === true,
     'and a designation with NO date and NO corroboration says "parked", not "finished" — ' +
     'a six-game suspension and a torn Achilles arrive here looking identical');
})();

/* ============================================================ BUG 2 ======= */
console.log('\n-- Value.upgrades(): ONE roster spot cannot be offered to the whole wire --');
/* The disease behind "36 players on my roster are out for the season". */
(function () {
  var W = freshWindow();
  var meId = W.Store.get().league.me;
  var me = W.Store.team(meId);
  /* a realistic roster: enough bodies that dropping one never breaks the lineup */
  var roster = [
    { id: 'r1', name: 'My QB', pos: 'QB', nfl: 'LAR' },
    { id: 'r2', name: 'My RB1', pos: 'RB', nfl: 'DET' },
    { id: 'r3', name: 'My RB2', pos: 'RB', nfl: 'BAL' },
    { id: 'r4', name: 'My RB3', pos: 'RB', nfl: 'NYJ' },
    { id: 'r5', name: 'My WR1', pos: 'WR', nfl: 'MIN' },
    { id: 'r6', name: 'My WR2', pos: 'WR', nfl: 'CIN' },
    { id: 'r7', name: 'My WR3', pos: 'WR', nfl: 'SEA' },
    { id: 'r8', name: 'My WR4', pos: 'WR', nfl: 'TB' },
    { id: 'r9', name: 'My TE1', pos: 'TE', nfl: 'HOU' },
    { id: 'r10', name: 'My TE2', pos: 'TE', nfl: 'NO' },
    { id: 'r11', name: 'My K', pos: 'K', nfl: 'BUF' },
    { id: 'r12', name: 'My DEF', pos: 'DEF', nfl: 'PIT' }
  ];
  W.Recommend.projectAll = function () {
    return roster.map(function (p) {
      return { p: p, base: 10, onBye: false, h: { label: '' } };
    });
  };
  W.Recommend.bestLineup = function () {
    return [
      { key: 'QB', pos: 'QB', pick: { p: roster[0], proj: 10, base: 10 } },
      { key: 'RB1', pos: 'RB', pick: { p: roster[1], proj: 10, base: 10 } },
      { key: 'RB2', pos: 'RB', pick: { p: roster[2], proj: 10, base: 10 } },
      { key: 'WR1', pos: 'WR', pick: { p: roster[4], proj: 10, base: 10 } },
      { key: 'WR2', pos: 'WR', pick: { p: roster[5], proj: 10, base: 10 } },
      { key: 'WR3', pos: 'WR', pick: { p: roster[6], proj: 10, base: 10 } },
      { key: 'TE', pos: 'TE', pick: { p: roster[8], proj: 10, base: 10 } },
      { key: 'FLEX', pos: 'FLEX', pick: { p: roster[3], proj: 10, base: 10 } },
      { key: 'K', pos: 'K', pick: { p: roster[10], proj: 10, base: 10 } },
      { key: 'DEF', pos: 'DEF', pick: { p: roster[11], proj: 10, base: 10 } }
    ];
  };
  /* My TE2 is finished for the year — the Dalton Schultz slot in the screenshot,
     except that here it is actually true. */
  var realOutlook = W.Recommend.seasonOutlook;
  W.Recommend.seasonOutlook = function (pl) {
    if (pl.name === 'My TE2') {
      return { seasonEnding: true, longTermOut: false, mustReplace: true,
               why: 'INJURED RESERVE — torn Achilles', label: 'on injured reserve',
               returnDate: '', returnAround: '' };
    }
    return { seasonEnding: false, longTermOut: false, mustReplace: false,
             why: '', label: '', returnDate: '', returnAround: '' };
  };

  var ups = W.Value.upgrades(2, meId, null, 200);
  var drops = ups.map(function (u) { return u.drop.name; });
  var dupes = drops.filter(function (n, i) { return drops.indexOf(n) !== i; });
  ok(dupes.length === 0,
     'no roster player is offered as the drop more than once — you can only drop a man ' +
     'ONCE, and the screenshot showed four consecutive rows all dropping Dalton Schultz ' +
     '(repeats found: ' + (dupes.join(', ') || 'none') + ')');

  var adds = ups.map(function (u) { return u.fa.name; });
  ok(adds.filter(function (n, i) { return adds.indexOf(n) !== i; }).length === 0,
     'and no free agent is offered as the add more than once either');

  var forcedRows = ups.filter(function (u) { return u.mandated; });
  ok(forcedRows.length <= 1,
     'one dead roster spot produces AT MOST one forced-replacement row, not one per ' +
     'free agent on the wire (got ' + forcedRows.length + ')');

  /* ...and the count the headline reads comes off the ROSTER, not off this list */
  var must = W.Value.mustReplace(2, meId, null);
  ok(must.length === 1 && must[0].name === 'My TE2',
     'Value.mustReplace() names the one actual man, from the roster itself — this is ' +
     'what the Wire tab headline counts now, and it cannot exceed the roster size ' +
     '(got ' + must.length + ': ' + must.map(function (m) { return m.name; }).join(', ') + ')');
  ok(must.length <= roster.length,
     'the number of men out for the season can never exceed the number of men on the ' +
     'roster — the literal impossibility Tj reported ("36 ... my roster is only 17")');
  W.Recommend.seasonOutlook = realOutlook;
})();

/* ============================================================ BUG 3 ======= */
console.log('\n-- Value.upgrades(): same position by default, cross-position only for a clear gap (Tj, 2026-09-18d) --');
(function () {
  function build(W, opts) {
    var meId = W.Store.get().league.me;
    var roster = opts.roster;
    W.Recommend.projectAll = function () {
      return roster.map(function (p) {
        return { p: p, base: p.base === undefined ? 10 : p.base, onBye: false, h: { label: '' } };
      });
    };
    W.Recommend.bestLineup = function () { return opts.lineup(roster); };
    return meId;
  }
  var baseRoster = [
    { id: 'r1', name: 'My QB', pos: 'QB', nfl: 'LAR' },
    { id: 'r2', name: 'My RB1', pos: 'RB', nfl: 'DET' },
    { id: 'r3', name: 'My RB2', pos: 'RB', nfl: 'BAL' },
    { id: 'r4', name: 'My RB3', pos: 'RB', nfl: 'NYJ' },
    { id: 'r5', name: 'My WR1', pos: 'WR', nfl: 'MIN' },
    { id: 'r6', name: 'My WR2', pos: 'WR', nfl: 'CIN' },
    { id: 'r7', name: 'My WR3', pos: 'WR', nfl: 'SEA' },
    { id: 'r8', name: 'My WR4', pos: 'WR', nfl: 'TB' },
    { id: 'r9', name: 'My Only TE', pos: 'TE', nfl: 'HOU' },
    { id: 'r11', name: 'My K', pos: 'K', nfl: 'BUF' },
    { id: 'r12', name: 'My DEF', pos: 'DEF', nfl: 'PIT' }
  ];
  function lineupOf(roster) {
    function find(n) { return roster.filter(function (p) { return p.name === n; })[0]; }
    return [
      { key: 'QB', pos: 'QB', pick: { p: find('My QB'), proj: 10, base: 10 } },
      { key: 'RB1', pos: 'RB', pick: { p: find('My RB1'), proj: 10, base: 10 } },
      { key: 'RB2', pos: 'RB', pick: { p: find('My RB2'), proj: 10, base: 10 } },
      { key: 'WR1', pos: 'WR', pick: { p: find('My WR1'), proj: 10, base: 10 } },
      { key: 'WR2', pos: 'WR', pick: { p: find('My WR2'), proj: 10, base: 10 } },
      { key: 'WR3', pos: 'WR', pick: { p: find('My WR3'), proj: 10, base: 10 } },
      { key: 'TE', pos: 'TE', pick: { p: find('My Only TE'), proj: 10, base: 10 } },
      { key: 'FLEX', pos: 'FLEX', pick: { p: find('My RB3'), proj: 10, base: 10 } },
      { key: 'K', pos: 'K', pick: { p: find('My K'), proj: 10, base: 10 } },
      { key: 'DEF', pos: 'DEF', pick: { p: find('My DEF'), proj: 10, base: 10 } }
    ];
  }

  /* --- THE TE CASE, IN TJ'S OWN WORDS ---------------------------------
   * "if I drop a te, I should have a backup te to replace him". He has ONE
   * tight end and the league starts one, so no swap may take him to zero. */
  (function () {
    var W = freshWindow();
    var meId = build(W, { roster: baseRoster, lineup: lineupOf });
    var ups = W.Value.upgrades(2, meId, null, 200);
    var emptiesTE = ups.filter(function (u) {
      return u.drop.pos === 'TE' && u.fa.pos !== 'TE';
    });
    ok(emptiesTE.length === 0,
       'with exactly one tight end on the roster and one TE slot to fill, NO suggestion ' +
       'drops him for a player at another position — that is the rule Tj stated, checked ' +
       'against the roster rather than hoped for (offending rows: ' +
       emptiesTE.map(function (u) { return u.fa.pos + ' for ' + u.drop.name; }).join(', ') + ')');

    var legal = ups.every(function (u) {
      var counts = {};
      baseRoster.forEach(function (p) { counts[p.pos] = (counts[p.pos] || 0) + 1; });
      counts[u.drop.pos]--; counts[u.fa.pos] = (counts[u.fa.pos] || 0) + 1;
      return W.Value.lineupFillable(counts, W.Value.slotNeeds());
    });
    ok(legal,
       'and EVERY suggestion, at every position, still leaves a roster that can field a ' +
       'legal starting lineup');
  })();

  /* --- THE CARVE-OUT: "if a star player with high output is available" ---- */
  (function () {
    var W = freshWindow();
    /* a second tight end, so dropping one is allowed at all */
    var roster = baseRoster.concat([{ id: 'r10', name: 'My Spare TE', pos: 'TE', nfl: 'NO' }]);
    var meId = build(W, { roster: roster, lineup: lineupOf });
    var ups = W.Value.upgrades(2, meId, null, 200);
    /* every cross-position row must carry the flag and the explanation */
    var cross = ups.filter(function (u) { return u.crossPos; });
    ok(cross.every(function (u) { return u.drop.pos !== u.fa.pos; }),
       'a row flagged crossPos really is one, so the UI badge cannot lie');
    ok(cross.every(function (u) { return /rather than a like-for-like|rather than a /.test(u.why); }),
       'and every cross-position row says in the "why" that it is one and had to clear a ' +
       'bigger margin for it (' + cross.length + ' cross-position row(s))');
    ok(ups.every(function (u) { return u.crossPos || u.drop.pos === u.fa.pos; }),
       'and every row that is NOT flagged is genuinely like-for-like');
  })();

  /* --- the cross-position BAR is really higher than the same-position one - */
  (function () {
    var W = freshWindow();
    ok(typeof W.Value.slotNeeds === 'function' && typeof W.Value.lineupFillable === 'function',
       'the roster-shape helpers are exported so this rule is testable at all');
    var need = W.Value.slotNeeds();
    ok(need.fixed.WR === 3 && need.fixed.RB === 2 && need.fixed.TE === 1 && need.flex === 1,
       'slotNeeds() reads this league\'s real shape off S.league.slots rather than ' +
       'hardcoding it (QB/RB/RB/WR/WR/WR/TE/FLEX/K/DEF)');
    ok(W.Value.lineupFillable({ QB: 1, RB: 2, WR: 3, TE: 1, K: 1, DEF: 1 }, need) === false,
       'exactly the starters and nobody spare cannot fill the FLEX slot');
    ok(W.Value.lineupFillable({ QB: 1, RB: 3, WR: 3, TE: 1, K: 1, DEF: 1 }, need) === true,
       'one spare flex-eligible body makes it legal');
    ok(W.Value.lineupFillable({ QB: 1, RB: 4, WR: 3, TE: 0, K: 1, DEF: 1 }, need) === false,
       'and no amount of running backs covers an empty TE slot — the exact thing the ' +
       'screenshot was about');
  })();
})();

/* ========================================== the IR-but-returning price ==== */
console.log('\n-- rosterValues(): a man on IR who is coming back is priced at the games he can still play --');
(function () {
  var W = freshWindow();
  var meId = W.Store.get().league.me;
  var roster = [{ id: 'r1', name: 'My Hurt RB', pos: 'RB', nfl: 'DET' }];
  W.Recommend.projectAll = function () {
    return [{ p: roster[0], base: 12, onBye: false, h: { label: '' } }];
  };
  var full = W.Value.rosterValues(W.Recommend.projectAll(), {}, 2)[0];

  /* now park him on IR with a return date about four weeks out */
  var back = new Date(Date.now() + 28 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  W.Recommend.seasonOutlook = function () {
    return { seasonEnding: false, longTermOut: true, mustReplace: false,
             label: 'on injured reserve', returnDate: back, returnAround: 'Oct 18',
             why: 'on injured reserve' };
  };
  var hurt = W.Value.rosterValues(W.Recommend.projectAll(), {}, 2)[0];

  ok(hurt.games < full.games,
     'he loses the games he is sitting out (' + full.games + ' -> ' + hurt.games + ')');
  ok(hurt.games > 0,
     'but not all of them — he plays again, and this league runs to week 14, so ' +
     'pricing him at zero would be as wrong as pricing him at full');
  ok(hurt.ros > 0 && hurt.ros < full.ros,
     'so his rest-of-season total sits strictly between nothing and untouched (' +
     full.ros.toFixed(0) + ' -> ' + hurt.ros.toFixed(0) + ')');
  ok(hurt.perGame === full.perGame,
     'and his per-game rate is unchanged — an injury costs him games, not ability');
  ok(hurt.outForSeason === false && hurt.longTermOut === true,
     'and he is never labelled out for the season');
})();

/* ============================================ the Claude path, same rules == */
console.log('\n-- Ai.normalizeWaivers(): the one-to-one drop rule is ENFORCED, not merely requested --');
(function () {
  var W = freshWindow();
  var known = {
    [W.Names.canon('Add One')]: { pos: 'WR', nfl: 'MIN', v: 12, ros: 120, vor: 40, n: 4 },
    [W.Names.canon('Add Two')]: { pos: 'WR', nfl: 'CIN', v: 11, ros: 110, vor: 30, n: 4 },
    [W.Names.canon('Add Three')]: { pos: 'WR', nfl: 'TB', v: 10, ros: 100, vor: 20, n: 4 }
  };
  var dropRec = { name: 'My Weak WR', pos: 'WR' };
  var rosterIdx = {};
  rosterIdx[W.Names.canon('My Weak WR')] = dropRec;
  rosterIdx[W.Names.canon('My Other WR')] = { name: 'My Other WR', pos: 'WR' };
  rosterIdx[W.Names.canon('My Third WR')] = { name: 'My Third WR', pos: 'WR' };
  rosterIdx[W.Names.canon('My Fourth WR')] = { name: 'My Fourth WR', pos: 'WR' };

  /* Claude names the same man as the drop three times over */
  var parsed = { swaps: [
    { add: 'Add One', pos: 'WR', drop: 'My Weak WR', rank: 1, edge: 50, why: 'a' },
    { add: 'Add Two', pos: 'WR', drop: 'My Weak WR', rank: 2, edge: 40, why: 'b' },
    { add: 'Add Three', pos: 'WR', drop: 'My Weak WR', rank: 3, edge: 30, why: 'c' }
  ] };
  var res = W.Ai.normalizeWaivers(parsed, known, rosterIdx, { K: false, DEF: false }, {});
  var claimed = res.adds.filter(function (a) { return a.dropCandidate === 'My Weak WR'; });
  ok(claimed.length === 1,
     'only ONE of the three keeps him as the drop — a model naming the same man three ' +
     'times is the same bug the deterministic board just had, arriving by the other path ' +
     '(got ' + claimed.length + ')');
  ok(claimed[0] && claimed[0].name === 'Add One',
     'and it is the highest-ranked pair that keeps him, not whichever arrived first');
  var stripped = res.adds.filter(function (a) { return a.name !== 'Add One'; });
  ok(stripped.every(function (a) { return !a.dropCandidate && a.dropVerified === false; }),
     'the others lose their drop AND their dropVerified flag, so the UI stops presenting ' +
     'them as one-for-one swaps rather than silently showing a duplicate');
})();

console.log('\n-- the ask-Claude briefing carries Tj\'s two new rules --');
(function () {
  var W = freshWindow();
  var txt = W.Ai.waiverCriteriaText();
  ok(/same type player position/.test(txt) && /7\. REPLACE LIKE FOR LIKE/.test(txt),
     'rule 7 states the same-position default IN TJ\'S OWN WORDS, with the star-player ' +
     'carve-out he named');
  ok(/not absolute/.test(txt),
     'including that the rule is explicitly NOT absolute — a prompt that overstated it ' +
     'would block the very swap he used as his example');
  ok(/8\. NEVER NAME THE SAME MAN TWICE/.test(txt) && /at most one/i.test(txt),
     'rule 8 forbids naming the same man as the drop twice — the screenshot bug, stated ' +
     'to Claude as a rule rather than left to chance');
  ok(/all eight of them/.test(txt),
     'and the count in the heading was updated with them (a stale "all six" is how a ' +
     'model learns to stop reading past rule six)');
})();

console.log(fails ? '\n  ' + fails + ' WIRE CHECK(S) FAILED\n' : '\n  wire checks pass\n');
process.exit(fails ? 1 : 0);
