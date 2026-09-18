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

console.log('\n-- seasonOutlook(): a report written in the POSSESSIVE is still his own report --');
(function () {
  var W = freshWindow();
  /* live, 2026-09-18. The only mention of him in the sentence that carries the
     news is "Hand's" — strip the 's and the subject is him; keep it and his
     own report reads as somebody else's and is discarded. Found re-reading
     this change rather than by a failing test, which is why it has one now. */
  news(W, { name: "Da'Shawn Hand", status: 'INJURED RESERVE', fantasyStatus: 'IR',
            returnDate: '2027-02-15',
            note: "Hand's move to injured reserve comes as no surprise since it was " +
                  "previously announced that he'd miss the remainder of the season due to a " +
                  "torn quadriceps suffered during the team's Week 1 loss to the Steelers." });
  var o = W.Recommend.seasonOutlook({ name: "Da'Shawn Hand" });
  ok(o.seasonEnding === true, 'he is still correctly season-ending');
  ok(/miss the remainder of the season/.test(o.why),
     'and the reason is HIS OWN sentence — a possessive ("Hand\'s move...") names him just ' +
     'as much as a bare surname does (got: "' + String(o.why).slice(0, 50) + '...")');
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

/* ---- a whole, realistic scenario -----------------------------------------
 * Every test below needs the same thing: a full roster, a wire with real
 * numbers on it, and control over who is hurt. Free agents are only
 * considered when they are `confident`, which in practice means a full-season
 * projection exists for them — so both sides are stubbed through
 * Projections.findSeason, the one input ros.js prices everybody from.
 */
function scenario(W, spec) {
  var roster = spec.roster, wire = spec.wire || [], perGame = {};
  roster.forEach(function (p) { perGame[p.name] = p.pg; });
  wire.forEach(function (p) {
    perGame[p.name] = p.pg;
    W.PlayerDB.get().players.push({ n: p.name, p: p.pos, t: p.nfl || 'KC',
                                    b: 0, e: '', st: 'active' });
  });
  W.Projections.findSeason = function (player) {
    var v = perGame[player.name];
    if (v === undefined) return null;
    return { pos: player.pos, season: v * 17, gp: 17, src: 'espn' };
  };
  W.Recommend.projectAll = function () {
    return roster.map(function (p) {
      return { p: p, base: p.pg, onBye: false, h: { label: '' } };
    });
  };
  W.Recommend.bestLineup = function () {
    return (spec.starters || []).map(function (n) {
      var p = roster.filter(function (r) { return r.name === n; })[0];
      return { key: p.pos, pos: p.pos, pick: { p: p, proj: p.pg, base: p.pg } };
    });
  };
  var dead = spec.outForSeason || [];
  W.Recommend.seasonOutlook = function (pl) {
    if (dead.indexOf(pl.name) >= 0) {
      return { seasonEnding: true, longTermOut: false, mustReplace: true,
               why: 'INJURED RESERVE — torn Achilles', label: 'on injured reserve',
               returnDate: '', returnAround: '' };
    }
    return { seasonEnding: false, longTermOut: false, mustReplace: false,
             why: '', label: '', returnDate: '', returnAround: '' };
  };
  return W.Store.get().league.me;
}

/* A roster with real depth at every position: 3 RB, 4 WR, 2 TE, and the
   starters named, so dropping any one bench man is legal by itself. */
function fullRoster(over) {
  over = over || {};
  function pg(n, d) { return over[n] === undefined ? d : over[n]; }
  return [
    { id: 'r1', name: 'My QB', pos: 'QB', nfl: 'LAR', pg: pg('My QB', 22) },
    { id: 'r2', name: 'My RB1', pos: 'RB', nfl: 'DET', pg: pg('My RB1', 14) },
    { id: 'r3', name: 'My RB2', pos: 'RB', nfl: 'BAL', pg: pg('My RB2', 12) },
    { id: 'r4', name: 'My RB3', pos: 'RB', nfl: 'NYJ', pg: pg('My RB3', 9) },
    { id: 'r5', name: 'My WR1', pos: 'WR', nfl: 'MIN', pg: pg('My WR1', 14) },
    { id: 'r6', name: 'My WR2', pos: 'WR', nfl: 'CIN', pg: pg('My WR2', 12) },
    { id: 'r7', name: 'My WR3', pos: 'WR', nfl: 'SEA', pg: pg('My WR3', 11) },
    { id: 'r8', name: 'My WR4', pos: 'WR', nfl: 'TB', pg: pg('My WR4', 8) },
    { id: 'r9', name: 'My TE1', pos: 'TE', nfl: 'HOU', pg: pg('My TE1', 9) },
    { id: 'r10', name: 'My TE2', pos: 'TE', nfl: 'NO', pg: pg('My TE2', 5) },
    { id: 'r11', name: 'My K', pos: 'K', nfl: 'BUF', pg: pg('My K', 8) },
    { id: 'r12', name: 'My DEF', pos: 'DEF', nfl: 'PIT', pg: pg('My DEF', 7) }
  ];
}
var STARTERS = ['My QB', 'My RB1', 'My RB2', 'My WR1', 'My WR2', 'My WR3',
                'My TE1', 'My K', 'My DEF'];

/* ============================================================ BUG 2 ======= */
console.log('\n-- Value.upgrades(): ONE roster spot cannot be offered to the whole wire --');
/* The disease behind "36 players on my roster are out for the season". */
(function () {
  var W = freshWindow();
  var meId = scenario(W, {
    roster: fullRoster(),
    starters: STARTERS,
    /* a deep wire — under the old pairing loop every one of these would have
       been paired with the same single weakest man */
    wire: [
      { name: 'Wire TE A', pos: 'TE', pg: 13 }, { name: 'Wire TE B', pos: 'TE', pg: 12 },
      { name: 'Wire TE C', pos: 'TE', pg: 11 }, { name: 'Wire WR A', pos: 'WR', pg: 16 },
      { name: 'Wire WR B', pos: 'WR', pg: 15 }, { name: 'Wire WR C', pos: 'WR', pg: 14 },
      { name: 'Wire RB A', pos: 'RB', pg: 15 }, { name: 'Wire RB B', pos: 'RB', pg: 14 },
      { name: 'Wire RB C', pos: 'RB', pg: 13 }
    ],
    outForSeason: ['My TE2']        /* the Dalton Schultz slot, butreal this time */
  });

  var ups = W.Value.upgrades(2, meId, null, 200);
  ok(ups.length >= 3,
     'sanity: this wire really does produce several suggestions to assign (' +
     ups.length + ')');

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
  ok(forcedRows.length === 1,
     'one dead roster spot produces EXACTLY one forced-replacement row, not one per ' +
     'free agent on the wire (got ' + forcedRows.length + ')');
  ok(forcedRows[0] && forcedRows[0].drop.name === 'My TE2' && ups.indexOf(forcedRows[0]) === 0,
     'and it names the man who is actually finished, ranked first');
  ok(forcedRows[0] && forcedRows[0].fa.pos === 'TE',
     'and it replaces a tight end with a TIGHT END — "if I drop a te, I should have a ' +
     'backup te to replace him" (got ' + (forcedRows[0] ? forcedRows[0].fa.pos : '-') + ')');

  /* ...and the count the headline reads comes off the ROSTER, not off this list */
  var must = W.Value.mustReplace(2, meId, null);
  ok(must.length === 1 && must[0].name === 'My TE2',
     'Value.mustReplace() names the one actual man, from the roster itself — this is ' +
     'what the Wire tab headline counts now (got ' + must.length + ': ' +
     must.map(function (m) { return m.name; }).join(', ') + ')');
  ok(must.length <= 12,
     'the number of men out for the season can never exceed the number of men on the ' +
     'roster — the literal impossibility Tj reported ("36 ... my roster is only 17")');
})();

/* ============================================================ BUG 3 ======= */
console.log('\n-- Value.upgrades(): same position by default, cross-position only for a clear gap (Tj, 2026-09-18d) --');

/* --- THE TE CASE, IN TJ'S OWN WORDS ------------------------------------
 * "if I drop a te, I should have a backup te to replace him". Here he has
 * ONE tight end and the league starts one, so no swap may take him to zero,
 * however good the receiver on offer is. */
(function () {
  var W = freshWindow();
  var roster = fullRoster().filter(function (p) { return p.name !== 'My TE2'; });
  var meId = scenario(W, {
    roster: roster, starters: STARTERS,
    wire: [{ name: 'Wire Superstar WR', pos: 'WR', pg: 30 },
           { name: 'Wire Good RB', pos: 'RB', pg: 20 }]
  });
  var ups = W.Value.upgrades(2, meId, null, 200);
  ok(ups.length >= 1, 'sanity: a 30-a-game receiver on the wire does produce suggestions');
  var emptiesTE = ups.filter(function (u) {
    return u.drop.pos === 'TE' && u.fa.pos !== 'TE';
  });
  ok(emptiesTE.length === 0,
     'with exactly one tight end on the roster and one TE slot to fill, NO suggestion ' +
     'drops him for a player at another position — not even for the best player on the ' +
     'wire. Checked against the roster, not hoped for in the ranking (offending rows: ' +
     (emptiesTE.map(function (u) { return u.fa.pos + ' for ' + u.drop.name; }).join(', ') ||
      'none') + ')');
  var need = W.Value.slotNeeds();
  ok(ups.every(function (u) {
    var counts = {};
    roster.forEach(function (p) { counts[p.pos] = (counts[p.pos] || 0) + 1; });
    counts[u.drop.pos]--; counts[u.fa.pos] = (counts[u.fa.pos] || 0) + 1;
    return W.Value.lineupFillable(counts, need);
  }), 'and EVERY suggestion, at every position, still leaves a roster that can field a ' +
      'legal starting lineup');
})();

/* --- LIKE FOR LIKE WINS WHEN BOTH ARE AVAILABLE ------------------------ */
(function () {
  var W = freshWindow();
  /* My WR4 and My TE2 are equally weak. A big receiver is on the wire. The
     same-position drop must be the one chosen. */
  var meId = scenario(W, {
    roster: fullRoster({ 'My WR4': 5, 'My TE2': 5 }), starters: STARTERS,
    wire: [{ name: 'Wire Big WR', pos: 'WR', pg: 20 }]
  });
  var ups = W.Value.upgrades(2, meId, null, 200);
  var hit = ups.filter(function (u) { return u.fa.name === 'Wire Big WR'; })[0];
  ok(!!hit, 'sanity: the receiver is suggested');
  ok(hit && hit.drop.name === 'My WR4' && hit.crossPos === false,
     'with two equally weak men to choose between, the RECEIVER is dropped for the ' +
     'receiver — same position is the default (got: ' +
     (hit ? hit.drop.name + '/' + hit.drop.pos : 'nothing') + ')');
})();

/* --- ...BUT THE RULE IS NOT ABSOLUTE ----------------------------------- */
(function () {
  var W = freshWindow();
  /* Tj: "if a star player with high output is available, it would make sense
     to drop a low output player even if he is in a different position." Here
     every receiver he owns is good and only the spare tight end is weak. */
  var meId = scenario(W, {
    roster: fullRoster({ 'My WR4': 15, 'My TE2': 3 }), starters: STARTERS,
    wire: [{ name: 'Wire Superstar WR', pos: 'WR', pg: 28 },
           { name: 'Wire Poor TE', pos: 'TE', pg: 4 }]
  });
  var ups = W.Value.upgrades(2, meId, null, 200);
  var hit = ups.filter(function (u) { return u.fa.name === 'Wire Superstar WR'; })[0];
  ok(hit && hit.drop.name === 'My TE2' && hit.crossPos === true,
     'when the only weak man is at ANOTHER position and the player available is a star, ' +
     'the cross-position swap IS made — the rule is a default, not a prohibition (got: ' +
     (hit ? 'drop ' + hit.drop.name + ' cross=' + hit.crossPos : 'no suggestion') + ')');
  ok(hit && /rather than a like-for-like one/.test(hit.why),
     'and the row says so, and says it had to clear a bigger margin to get there');
  ok(hit && /still be filled/.test(hit.why),
     'and that the lineup still fills afterwards — the thing the screenshot got wrong');
})();

/* --- a cross-position swap must clear DOUBLE the bar ------------------- */
(function () {
  var W = freshWindow();
  /* An edge that is comfortably enough for a like-for-like swap and NOT
     enough to justify breaking the shape of the roster. MIN_SEASON for WR is
     15 points, so a cross-position WR-for-TE needs more than 30. */
  var meId = scenario(W, {
    roster: fullRoster({ 'My WR4': 14, 'My TE2': 9.2 }), starters: STARTERS,
    wire: [{ name: 'Wire Slightly Better WR', pos: 'WR', pg: 11.5 }]
  });
  var ups = W.Value.upgrades(2, meId, null, 200);
  var cross = ups.filter(function (u) { return u.crossPos; });
  ok(cross.length === 0,
     'a real but ordinary edge over a player at ANOTHER position is not enough to break ' +
     'the roster shape for — it has to clear double the season bar (got ' + cross.length +
     ' cross-position row(s): ' +
     cross.map(function (u) { return u.fa.name + ' for ' + u.drop.name +
       ' +' + u.gain.toFixed(0); }).join(', ') + ')');
})();

/* --- the roster-shape helpers, directly -------------------------------- */
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
