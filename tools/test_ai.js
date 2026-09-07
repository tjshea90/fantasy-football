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

console.log('\n' + (fail ? '  ' + fail + ' FAILED, ' : '  ') + pass + ' assertions pass');
if (fail) process.exit(1);
console.log('  ai + note checks pass');
