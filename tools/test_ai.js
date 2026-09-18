/* test_ai.js — the model-answer parser and the injury-note trim.
 *
 * Both of these are things Tj SAW on his phone on 2026-09-07:
 *   "Claude FAILED: the model did not return usable JSON"
 *   "...Even still, Swift wil"
 *
 * The parser cases below are not invented shapes. Every one of them is
 * something a search-backed model actually does: narrate between searches,
 * wrap the answer in a fence, quote a brace, or run out of output room
 * mid-object. The old implementation failed four of them. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const A = path.join(__dirname, '..', 'app', 'assets');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  OK   ' + msg); }
  else { fail++; console.log('  FAIL ' + msg); }
}
function throws(fn, re, msg) {
  let e = null;
  try { fn(); } catch (err) { e = err; }
  ok(e && re.test(e.message), msg + (e ? '  [' + e.message.slice(0, 90) + ']' : '  [did not throw]'));
}

/* ---- boot just enough of the app to reach Ai and Recommend --------------- */
const sandbox = { console, window: null, setTimeout, clearTimeout, Date, Math, JSON };
sandbox.window = sandbox;
sandbox.localStorage = {
  _d: {}, getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; }
};
vm.createContext(sandbox);
for (const f of ['version.js', 'seed.js', 'players.js', 'scoring.js', 'names.js',
                 'playerdb.js', 'espn.js', 'store.js', 'usage.js', 'projections.js',
                 'ai.js', 'recommend.js']) {
  vm.runInContext(fs.readFileSync(path.join(A, f), 'utf8'), sandbox, { filename: f });
}
const Ai = sandbox.Ai;
const Names = sandbox.Names;
const jsonOf = Ai._jsonOf;
ok(typeof jsonOf === 'function', 'Ai._jsonOf is exported for testing');

/* ---- 1. the shapes a real answer arrives in ------------------------------ */
console.log('\n-- the model answer parser --');

ok(jsonOf('{"players":[{"name":"A"}]}', { want: 'players' }).players.length === 1,
   'a bare object parses');

ok(jsonOf('```json\n{"players":[{"name":"A"}]}\n```', { want: 'players' }).players.length === 1,
   'a fenced object parses');

/* THE BUG. The old scan fixed `a` at the FIRST '{' in the whole string and only
   ever retracted `b`, so one brace in the narration poisoned every attempt. */
const narrated =
  'Let me search for the latest.\n\n' +
  'I found a note formatted like {status: questionable} on one site, which is ' +
  'their own shorthand rather than mine.\n\n' +
  '{"players":[{"name":"D\'Andre Swift","adjust":0.82}],"summary":"ok"}';
ok(jsonOf(narrated, { want: 'players' }).players[0].name === "D'Andre Swift",
   'a stray brace in the search narration no longer poisons the scan  <-- the reported bug');

/* a brace INSIDE a reason string must not be treated as structure */
const braceInside =
  '{"players":[{"name":"A","reason":"the report said {out} but he practised"}],"summary":"x"}';
ok(jsonOf(braceInside, { want: 'players' }).players[0].reason.indexOf('{out}') > 0,
   'a brace inside a quoted reason is not mistaken for structure');

/* an escaped quote inside a reason must not end the string early */
const escaped = '{"players":[{"name":"A","reason":"he was \\"limited\\" on Thursday"}]}';
ok(jsonOf(escaped, { want: 'players' }).players[0].reason.indexOf('limited') > 0,
   'an escaped quote inside a reason does not end the string early');

/* ---- 2. truncation: the likeliest cause of what Tj saw ------------------- */
console.log('\n-- a truncated answer is rescued, not thrown away --');

/* max_tokens lands mid-object: the closing braces were never sent, so no
   amount of retracting a closing brace can ever succeed. */
const cutOff =
  '{"players":[' +
  '{"name":"Chris Olave","status":"clear","willPlay":true,"adjust":1.0,"confidence":"high","reason":"Full practice Wednesday."},' +
  '{"name":"Davante Adams","status":"clear","willPlay":true,"adjust":1.0,"confidence":"high","reason":"No designation."},' +
  '{"name":"D\'Andre Swift","status":"questionable","willPlay":true,"adjust":0.82,"confidence":"medium","reason":"Left Thursday practice in significant discom';
const rescued = jsonOf(cutOff, { want: 'players', stop: 'max_tokens' });
ok(rescued && rescued.players.length >= 2,
   'a max_tokens truncation still yields the players that DID arrive (' +
   (rescued ? rescued.players.length : 0) + ' of 3)');
ok(rescued.players[0].name === 'Chris Olave' && rescued.players[1].adjust === 1.0,
   'the rescued players keep their real values');
ok(rescued._truncated === true, 'the rescue is flagged so the UI can say it was partial');
ok(Object.keys(rescued).indexOf('_truncated') === -1,
   'the flag is non-enumerable, so it never rides along into anything saved');

/* truncated INSIDE a string, mid-word — exactly the Swift case */
const cutMidWord =
  '{"players":[{"name":"A","adjust":1.0,"reason":"Even still, Swift wil';
const r2 = jsonOf(cutMidWord, { want: 'players', stop: 'max_tokens' });
ok(r2 && r2.players.length === 1 && r2.players[0].adjust === 1.0,
   'a truncation mid-string still recovers the fields that completed');

/* a truncation with nothing salvageable must name the real cause */
throws(() => jsonOf('{"pla', { want: 'players', stop: 'max_tokens' }),
       /max_tokens|output room/i,
       'an unsalvageable truncation names max_tokens, not "no usable JSON"');

/* ---- 3. failures must be diagnosable ------------------------------------ */
console.log('\n-- a failure says what actually happened --');

throws(() => jsonOf('{"adds":[]}', { want: 'players' }),
       /without a "players" list/,
       'JSON of the wrong shape says which key was missing');
throws(() => jsonOf('', { want: 'players' }), /no text at all/,
       'an empty answer says so');
throws(() => jsonOf('I could not find anything.', { want: 'players' }),
       /did not return usable JSON.*could not find/s,
       'unparseable prose is quoted back so the cause is visible');
throws(() => jsonOf('nope', { want: 'players', stop: 'refusal' }), /declined/,
       'a refusal is reported as a refusal');

/* the old code could not have passed these — proof the fix is real */
function oldJsonOf(txt) {
  const s = String(txt || '');
  let a = s.indexOf('{'), b = s.lastIndexOf('}');
  while (a >= 0 && b > a) {
    try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { b = s.lastIndexOf('}', b - 1); }
  }
  throw new Error('the model did not return usable JSON');
}
let oldFailures = 0;
for (const sample of [narrated, cutOff, cutMidWord]) {
  try { oldJsonOf(sample); } catch (e) { oldFailures++; }
}
ok(oldFailures === 3,
   'all three real-world shapes DID fail under the old parser — the fix is not cosmetic');

/* ---- 4. the stream carries the stop reason ------------------------------- */
console.log('\n-- the stop reason survives the stream --');
const src = fs.readFileSync(path.join(A, 'ai.js'), 'utf8');
ok(/stop_reason:\s*stopReason/.test(src),
   'parseSse returns stop_reason instead of discarding it');
ok(/jsonOf\(textOf\(j\),\s*\{\s*want:\s*'players',\s*stop:\s*j\.stop_reason/.test(src),
   'the advice call passes the stop reason to the parser');
ok(/jsonOf\(textOf\(j\),\s*\{\s*want:\s*'adds',\s*stop:\s*j\.stop_reason/.test(src),
   'the waiver call passes the stop reason to the parser');
ok(/max_tokens:\s*Math\.max\(3000/.test(src),
   'the advice max_tokens ceiling was raised (a cap costs nothing unused)');

/* ---- 5. the injury note is no longer cut mid-word ------------------------ */
console.log('\n-- the injury note --');
const rsrc = fs.readFileSync(path.join(A, 'recommend.js'), 'utf8');
/* STRIP COMMENTS BEFORE ASSERTING ON SOURCE. STATE.md: "Test regexes must strip
   comments and strings first. This has bitten three times now." It bit a fourth
   time writing this file — the comment above trimNote quotes the old
   `String(det).slice(0, 220)` verbatim so the reader can see what was wrong, and
   a naive grep found that quotation and called the bug unfixed. */
const code = rsrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
ok(!/String\(det\)\.slice\(0,\s*220\)/.test(code),
   'the hard 220-character cut is gone from the CODE  <-- the reported bug');
ok(/String\(det\)\.slice\(0,\s*220\)/.test(rsrc),
   'and the comment still quotes it, so the next reader knows what was fixed');
ok(/trimNote\(det,\s*600\)/.test(rsrc), 'the feed now stores a 600-character budget');

/* reach trimNote through the module the same way loadNews does */
const trim = new vm.Script(
  rsrc.match(/function trimNote[\s\S]*?\n  \}/)[0] + '\n;trimNote'
).runInNewContext({});
const swift = 'Swift was reportedly "in significant discomfort" when leaving Thursday\'s ' +
  'practice with an apparent abdominal issue, but the early diagnosis seems to suggest ' +
  'he is not dealing with a serious setback. Even still, Swift will be a game-time ' +
  'decision and his workload could be capped even if he suits up on Sunday.';
ok(swift.length > 220, 'the real note from the screenshot is longer than the old cap');
ok(trim(swift, 600) === swift.replace(/\s+/g, ' ').trim(),
   'the whole Swift note now survives — the sentence is no longer cut mid-word');
ok(trim(swift, 220).slice(-1) !== 'l',
   'at a tight budget it no longer stops at "...Swift wil"');
ok(/[.…]$/.test(trim(swift, 220)),
   'a cut note ends at a sentence or an explicit ellipsis, never mid-word');
ok(trim(swift, 240).indexOf('Even still, Swift wil') === -1 ||
   /Even still, Swift wil[^l]/.test(trim(swift, 240)) === false,
   'no cut leaves a half-written word');
ok(trim('short one', 600) === 'short one', 'a short note is untouched');
ok(trim(null, 600) === '' && trim(undefined, 600) === '', 'null and undefined are safe');
ok(trim('a  b\n\nc', 600) === 'a b c', 'whitespace is normalised so the card lays out');

/* the meaning-inversion risk, stated as a test */
const inverting = 'He was limited Wednesday. Reports say he will not play on Sunday.';
ok(trim(inverting, 34).indexOf('will not') === -1 &&
   trim(inverting, 34).indexOf('will') === -1,
   'a cut never leaves a dangling "...he will" that reads as the opposite');

/* ---- 6. the waiver normalizers (v5.5): the new fields and their guarantees */
console.log('\n-- normalizeWaivers: priority, recentStat, dropCandidate, kdefNeed --');

const known = {};
known[Names.canon('Chris Olave')] = { pos: 'WR', nfl: 'NO', v: 12.3, vor: 3.1, bye: 11, onBye: false };
/* 2026-09-18: the drop half of a waiver reply is validated against MY WHOLE
 * ROSTER now, not the app's three-deep shortlist — Tj's rule 5 ("the Claude
 * prompt should have no restrictions") means Claude may name anybody of mine
 * and the app's job is to confirm the man is really mine, not to restrict
 * which of mine may be named. So this index is a realistic roster, and the
 * safety property under test changed shape with it: see the two cases below. */
const rosterIdx = Ai.rosterIndex([
  { name: 'Bench Guy', pos: 'WR' },
  { name: 'Starter WR One', pos: 'WR' },
  { name: 'Starter WR Two', pos: 'WR' },
  { name: 'Starter WR Three', pos: 'WR' },
  { name: 'Spare Kicker', pos: 'K' },
  { name: 'Old Kicker', pos: 'K' },
  { name: 'My Only TE', pos: 'TE' }
]);
ok(Object.keys(rosterIdx).length === 7, 'rosterIndex covers every player on my roster');
const dropIdx = Ai.dropCandidateIndex({
  WR: [{ name: 'Bench Guy', pos: 'WR' }],
  K: [{ name: 'Old Kicker', pos: 'K' }]
});
ok(Object.keys(dropIdx).length === 2, 'dropCandidateIndex flattens every position\'s list');

const base = { adds: [
  { name: 'Chris Olave', pos: 'WR', nfl: 'NO', rank: 1, priority: 'season',
    recentStat: '7 rec, 88 yds vs ATL (Wk 2)', dropCandidate: 'Bench Guy',
    confidence: 'high', why: 'Took over after the starter\'s injury.' }
] };
const n1 = Ai.normalizeWaivers(base, known, rosterIdx, { K: false, DEF: false });
ok(n1.adds.length === 1, 'a plain add with a valid same-position dropCandidate survives');
ok(n1.adds[0].priority === 'season', 'priority is read through');
ok(n1.adds[0].recentStat === '7 rec, 88 yds vs ATL (Wk 2)', 'recentStat is read through');
ok(n1.adds[0].dropCandidate === 'Bench Guy',
   'a dropCandidate at the SAME position as the add is kept');

/* THE SAFETY PROPERTY, RESHAPED (2026-09-18).
 *
 * It used to be "the drop must be at the same position as the add", which made
 * "don't drop a kicker to add a WR" a guarantee. That rule was the wrong
 * shape: dropping a SPARE kicker, or a fourth running back, to add a startable
 * receiver is an ordinary correct fantasy move, and it rejected every one of
 * them — while a same-position swap that empties a required slot sailed
 * straight through. What actually has to be guaranteed is that no swap leaves
 * a starting slot with nobody to fill it. Both halves are pinned here. */
const spareK = { adds: [
  { name: 'Chris Olave', pos: 'WR', nfl: 'NO', rank: 1,
    dropCandidate: 'Old Kicker',   /* a K, and I carry two */
    confidence: 'high', why: 'x' }
] };
ok(Ai.normalizeWaivers(spareK, known, rosterIdx, { K: false, DEF: false })
     .adds[0].dropCandidate === 'Old Kicker',
   'dropping a SPARE kicker to add a receiver is allowed — I still have a kicker ' +
   'for the kicker slot, and this is an ordinary roster move the old same-position ' +
   'rule rejected outright');

const onlyTE = { adds: [
  { name: 'Chris Olave', pos: 'WR', nfl: 'NO', rank: 1,
    dropCandidate: 'My Only TE',   /* a TE, and I have exactly one */
    confidence: 'high', why: 'x' }
] };
ok(Ai.normalizeWaivers(onlyTE, known, rosterIdx, { K: false, DEF: false })
     .adds[0].dropCandidate === '',
   'but dropping my ONLY tight end for a receiver is cleared, not shown  <-- a swap ' +
   'must never leave a required starting slot with nobody in it, which is the real ' +
   'guarantee the position-matching rule was reaching for');

/* ---- the `swaps` contract (2026-09-18) -----------------------------------
 * Tj, rule 4: "it explicitly recommends which player or players to drop and
 * replace on a one to one basis with explicit reasoning and expected fantasy
 * point edge". The reply shape leads with `swaps` now; `adds` is still read so
 * a reply written against the older contract (or a watch-list name that is not
 * part of a recommended move) is not lost. */
console.log('\n-- normalizeWaivers: one-for-one swaps with a point edge --');
(function () {
  var r = Ai.normalizeWaivers({
    swaps: [{ drop: 'Bench Guy', add: 'Chris Olave', pos: 'WR', nfl: 'NO', rank: 1,
              edge: 54, mandated: false, confidence: 'high',
              why: 'The new #1 receiver after the trade (ESPN, 2026-09-16).' }]
  }, known, rosterIdx, { K: false, DEF: false });
  ok(r.adds.length === 1, 'a swaps-only reply produces a recommendation');
  ok(r.adds[0].name === 'Chris Olave' && r.adds[0].dropCandidate === 'Bench Guy',
     'and it is paired one-for-one with the exact man to drop');
  ok(r.adds[0].edge === 54,
     'the expected rest-of-season point edge is carried through as a number (' +
     r.adds[0].edge + ') — Tj\'s own example is "54 more fantasy points over the season"');
  ok(r.adds[0].priority === 'season',
     'a swap is filed as a season-long move by construction, never as a one-week one');
  ok(r.adds[0].dropVerified === true,
     'and the app records that it confirmed the drop is really on my roster');
}());

(function () {
  /* the same add arriving in BOTH lists must not be recommended twice */
  var r = Ai.normalizeWaivers({
    swaps: [{ drop: 'Bench Guy', add: 'Chris Olave', pos: 'WR', edge: 20, rank: 1, why: 'x' }],
    adds: [{ name: 'Chris Olave', pos: 'WR', rank: 2, why: 'y' }]
  }, known, rosterIdx, { K: false, DEF: false });
  ok(r.adds.length === 1 && r.adds[0].edge === 20,
     'a player named in both swaps and adds appears once, with the swap\'s detail kept');
}());

(function () {
  /* rule 6's override: a forced replacement gets a K/DEF past the gate that
     would otherwise drop it, and is ranked ahead of an optional upgrade */
  var kKnown = {};
  kKnown[Names.canon('Some Kicker')] = { pos: 'K', nfl: 'CHI', v: 9, vor: 1, bye: 7, onBye: false };
  kKnown[Names.canon('Chris Olave')] = { pos: 'WR', nfl: 'NO', v: 12.3, vor: 3.1, bye: 11, onBye: false };
  var idx = Ai.rosterIndex([
    { name: 'Broken Kicker', pos: 'K' }, { name: 'Spare Kicker', pos: 'K' },
    { name: 'Bench Guy', pos: 'WR' }, { name: 'Starter WR One', pos: 'WR' },
    { name: 'Starter WR Two', pos: 'WR' }, { name: 'Starter WR Three', pos: 'WR' }
  ]);
  var reply = { swaps: [
    { drop: 'Bench Guy', add: 'Chris Olave', pos: 'WR', edge: 40, rank: 1, why: 'x' },
    { drop: 'Broken Kicker', add: 'Some Kicker', pos: 'K', edge: 15, rank: 2,
      mandated: true, why: 'Out for the season.' }
  ] };
  var r = Ai.normalizeWaivers(reply, kKnown, idx, { K: false, DEF: false });
  ok(r.adds.length === 2,
     'a K swap flagged as a forced replacement survives the K/DEF gate that would ' +
     'otherwise discard it, even with kdefNeed false — rule 6\'s own exception');
  ok(r.adds[0].pos === 'K' && r.adds[0].mandated === true,
     'and a forced replacement is ranked ahead of a larger optional upgrade (' +
     r.adds[0].name + ' before ' + r.adds[1].name + ') — a dead roster spot is a ' +
     'problem you already have');
}());

const invented = { adds: [
  { name: 'Chris Olave', pos: 'WR', nfl: 'NO', rank: 1,
    dropCandidate: 'Nobody On This Roster', confidence: 'high', why: 'x' }
] };
const n3 = Ai.normalizeWaivers(invented, known, rosterIdx, { K: false, DEF: false });
ok(n3.adds[0].dropCandidate === '',
   'a dropCandidate who is not on my roster at all is cleared, not trusted blindly');

ok(Ai.normalizeWaivers({ adds: [{ name: 'Chris Olave', pos: 'WR' }] }, known, {}, {})
     .adds[0].priority === 'week',
   'priority defaults to "week" when the model omits it — never overclaim season importance');

/* K/DEF gating: a hard filter the app enforces itself, independent of the prompt */
const kdefReply = { adds: [
  { name: 'Some Kicker', pos: 'K', nfl: 'CHI', rank: 1, confidence: 'low', why: 'x' },
  { name: 'Chris Olave', pos: 'WR', nfl: 'NO', rank: 2, confidence: 'high', why: 'y' }
] };
const n4 = Ai.normalizeWaivers(kdefReply, known, {}, { K: false, DEF: false });
ok(n4.adds.length === 1 && n4.adds[0].pos === 'WR',
   'a K add is dropped outright when kdefNeed.K is false — a guarantee, not a request');
const n5 = Ai.normalizeWaivers(kdefReply, known, {}, { K: true, DEF: false });
ok(n5.adds.length === 2, 'the same K add is kept once kdefNeed.K is true (mine is on bye/OUT)');
const n6 = Ai.normalizeWaivers(kdefReply, known, {}, undefined);
ok(n6.adds.length === 2,
   'kdefNeed is optional — an older caller that does not supply it filters nothing');

/* season-priority sorts ahead of week-priority within the same rank tier */
const mixedPriority = { adds: [
  { name: 'Week Guy', pos: 'RB', nfl: 'CHI', rank: 1, priority: 'week', confidence: 'low', why: 'x' },
  { name: 'Season Guy', pos: 'RB', nfl: 'NYJ', rank: 2, priority: 'season', confidence: 'high', why: 'y' }
] };
const n7 = Ai.normalizeWaivers(mixedPriority, {}, {}, {});
ok(n7.adds[0].name === 'Season Guy',
   'a season-priority add is listed ahead of a better-ranked week-only one  <-- ' +
   '"entire season over small weekly changes"');

console.log('\n-- normalizeInjuries --');
const myInjuries = [
  { name: 'Breece Hall', pos: 'RB', status: 'QUESTIONABLE', note: 'ankle', onBye: false },
  { name: 'Some Kicker', pos: 'K', status: 'BYE', note: 'on bye in week 3', onBye: true }
];
const injReply = { injuries: [
  { name: 'Breece Hall', extent: 'high ankle sprain',
    timeline: 'week-to-week (ESPN, 2026-09-10)', replace: false },
  { name: 'Nobody I Asked About', extent: 'invented', timeline: 'invented', replace: true }
] };
const inj = Ai.normalizeInjuries(injReply, myInjuries);
ok(inj.length === 1, 'only names the app actually listed as injured are kept');
ok(inj[0].name === 'Breece Hall' && inj[0].extent === 'high ankle sprain',
   'a matched injury keeps its research');
ok(inj[0].replace === false, 'replace:false is read through, not coerced to true');
ok(Ai.normalizeInjuries({}, myInjuries).length === 0, 'a reply with no injuries array is safe');
ok(Ai.normalizeInjuries(injReply, []).length === 0, 'an empty roster-injury list matches nothing');

/* ---- 7. the waiver prompt actually contains the new rules ---------------- */
console.log('\n-- the waiver prompt states the new rules --');
const wp = Ai._waiverPrefix();
ok(/FRESHNESS/.test(wp) && /STALE/.test(wp),
   'the freshness rule is stated, not just "prefer the last 7 days"');
/* 2026-09-18: these three rules survive, under the headings Tj's six criteria
   gave them — the criteria block is the single place they are written now
   (Ai.waiverCriteriaText), shared with the offline handoff file. */
ok(/RANK ON THE WHOLE REST OF THE SEASON, NOT NEXT WEEK/.test(wp),
   'season-over-week priority is stated as an explicit rule');
ok(/QUARTERBACK, KICKER AND DEFENSE ARE LOW PRIORITY/.test(wp) && /KDEF\s*AVAILABILITY/.test(Ai._waiverBlock({
     week: 1, season: 2026, today: '2026-09-10', pool: {}, kdefNeed: { K: false, DEF: false }
   })),
   'the K/DEF gating rule references the availability line the app supplies');
ok(/dropCandidate/.test(wp) && /"swaps"/.test(wp) && /"edge"/.test(wp),
   'the drop half of every recommendation is described, and the swap contract carries the point edge');
ok(/CURRENT SEASON, CURRENT NEWS, REPUTABLE SOURCES/.test(wp) &&
   /ONLY RECOMMEND A MOVE THAT IS A MEANINGFUL SEASON-LONG UPGRADE/.test(wp) &&
   /NOTHING IS OFF LIMITS TO YOU/.test(wp),
   'and all six of Tj\'s 2026-09-18 criteria are in the paid-API prompt too, not just the export file');
ok(/recentStat/.test(wp), 'the recentStat contract field is described');
ok(/"injuries"/.test(wp), 'the injuries research task and contract field are described');

/* ---- 8. normalizeTeamAnalysis: the safety properties (2026-09-17b) ------- */
console.log('\n-- normalizeTeamAnalysis --');
/* a hand-built ctx in the exact shape TeamReport.context() produces — this
   file unit-tests ai.js's pure functions against a shape, the same way the
   normalizeWaivers section above does not need a real Store boot either.
   Deliberately includes a team named "JR" — see the regression below. */
const taCtx = {
  rosters: [
    { id: 'me', name: 'My Team', mine: true,
      players: [{ name: 'Chris Olave', pos: 'WR' }, { name: 'Bench Guy', pos: 'WR' }] },
    { id: 'jr', name: 'JR', mine: false,
      players: [{ name: 'Some Star', pos: 'RB' }] },
    { id: 'tim', name: 'Tim', mine: false,
      players: [{ name: 'Other Guy', pos: 'QB' }] }
  ],
  pool: { RB: [{ name: 'Free Back', pos: 'RB', nfl: 'CHI', v: 9.1 }] },
  dropCandidates: { WR: [{ name: 'Bench Guy', pos: 'WR', ros: 3.2 }] }
};

const taReply = {
  overall: { rank: 2, of: 3, verdict: 'Strong at WR, thin at RB.' },
  teamComparisons: [
    { team: 'JR', note: 'They have the better RB1.' },
    { team: 'Invented Team', note: 'should be dropped' }
  ],
  strengths: ['WR depth'], weaknesses: ['RB depth'],
  recommendations: [
    { type: 'trade', action: 'Trade for Some Star', targetPlayer: 'Some Star',
      fromTeam: 'JR', giveUp: 'Bench Guy', why: 'addresses the RB need' },
    { type: 'trade', action: 'Invented deal', targetPlayer: 'Nobody Real',
      fromTeam: 'Nowhere', giveUp: 'Other Guy', why: 'should be stripped down' },
    { type: 'waiver', action: 'Add Free Back', targetPlayer: 'Free Back',
      dropCandidate: 'Bench Guy', why: 'best available at need' }
  ],
  summary: 'Make the trade, then the waiver add.'
};
const taNorm = Ai.normalizeTeamAnalysis(taReply, taCtx);

ok(taNorm.overall.rank === 2 && taNorm.overall.of === 3 && taNorm.overall.verdict === taReply.overall.verdict,
   'overall rank/of/verdict pass through');

/* THE REGRESSION THIS LOCKS IN (found during manual testing, 2026-09-17b):
   Names.canon() is built for PLAYER names and folds a standalone "jr"/"sr"/
   "ii"/"iii"/"iv"/"v" token to nothing (so "Odell Beckham Jr." canonicalizes
   to "Odell Beckham") — exactly wrong for a TEAM literally named "JR", which
   collided with the '' key an empty/no-team field also maps to. A separate,
   non-suffix-folding key must be used for every team-name comparison. */
ok(taNorm.teamComparisons.length === 1 && taNorm.teamComparisons[0].team === 'JR',
   'a real team named "JR" matches correctly  <-- the exact regression this locks in');
ok(taNorm.recommendations[0].fromTeam === 'JR',
   'a trade recommendation naming team "JR" resolves correctly, not to empty/invented');
ok(!taNorm.teamComparisons.some(function (c) { return c.team === 'Invented Team'; }),
   'a team name that does not exist in the league is dropped, not shown');
ok(taNorm.recommendations[1].fromTeam === '',
   'an invented fromTeam ("Nowhere") is blanked, never shown as if real');
ok(taNorm.recommendations[1].verified === false,
   'a recommendation naming an invented player is flagged unverified, not dropped');
ok(taNorm.recommendations[1].giveUp === '',
   'giveUp naming a player who is NOT on my own roster (Other Guy is on Tim\'s) is cleared');
ok(taNorm.recommendations[0].giveUp === 'Bench Guy',
   'giveUp naming a player who genuinely IS on my own roster survives');
ok(taNorm.recommendations[2].dropCandidate === 'Bench Guy',
   'a dropCandidate at the matching position survives');
ok(taNorm.recommendations[2].verified === true,
   'a waiver target actually in the AVAILABLE pool is verified');

/* an empty fromTeam must never accidentally match team "JR" (the exact shape
   of the bug: '' canonicalizing the same way "JR" used to) */
const taNoTeam = Ai.normalizeTeamAnalysis({
  overall: {}, recommendations: [{ type: 'waiver', action: 'Add Free Back',
    targetPlayer: 'Free Back', why: 'x' }]
}, taCtx);
ok(taNoTeam.recommendations[0].fromTeam === '',
   'no fromTeam given resolves to empty, never to a real team by accident');

console.log('\n-- the team-analysis prompt states the new task --');
const tap = Ai._teamAnalysisPrefix();
ok(/TASK\./.test(tap) && /overall verdict/.test(tap),
   'the task is stated: an overall verdict, not a per-player one');
ok(!/web_search|"web_search"/.test(tap),
   'no web-search instructions — this call is judgment over given facts, not research');
ok(/"overall"/.test(tap) && /"teamComparisons"/.test(tap) && /"recommendations"/.test(tap),
   'the reply contract names overall/teamComparisons/recommendations');
ok(/"targetPlayer"/.test(tap) && /"fromTeam"/.test(tap) && /"giveUp"/.test(tap) &&
   /"dropCandidate"/.test(tap),
   'the recommendation contract fields are all documented');
ok(/Never invent a player or a team/.test(tap),
   'inventing a player or a team is explicitly forbidden');

console.log('\n' + (fail ? '  ' + fail + ' FAILED, ' : '  ') + pass + ' assertions pass');
if (fail) process.exit(1);
console.log('  ai + note checks pass');
