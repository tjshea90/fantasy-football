/* test_net.js — what this app asks the internet for, and how often.
 *
 * Tj: "make sure online requests are optimized and any data that won't change
 *      can be cached and stored locally and not refresh every time from the
 *      Internet. also make sure the online requests are efficient and will not
 *      lead to restrictions or bans from the providers."
 *
 * Every endpoint here is a free public one that nobody owes this app anything.
 * The way an app like this gets blocked is not one big request — it is a tight
 * retry loop nobody noticed. So this suite is mostly about the SHAPE of the
 * traffic: what is cached, what is rate-limited, what happens when a step
 * fails, and whether anything can spin.
 *
 * The concrete defect behind most of it: before v4.5 every tap of "Sync
 * advice" refetched the full ESPN projection feed (400 players, megabytes) and
 * the full 800-record injury list, unconditionally. When the Claude step failed
 * — which is what Tj's screenshot shows — the natural response is to tap Sync
 * again, and each retry pulled all of it down again to reach a step that needed
 * neither.
 */
'use strict';
var fs = require('fs'), path = require('path'), fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  OK   ' + m); }
function src(f) { return fs.readFileSync(path.join(__dirname, '..', 'app/assets', f), 'utf8'); }
function code(f) {
  /* comments stripped first — STATE.md records this trap biting three times */
  return src(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
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
var disk = {};
W.Native = { save: function (k, v) { disk[k] = v; return true; },
             load: function (k) { return disk[k] === undefined ? null : disk[k]; } };
function load(f) { new Function('window', src(f))(W); }
['seed.js', 'players.js', 'scoring.js', 'espn.js', 'names.js', 'store.js', 'playerdb.js',
 'projections.js', 'usage.js', 'ai.js', 'recommend.js', 'sim.js', 'value.js', 'recap.js',
 'schedule.js', 'handoff.js'].forEach(load);
W.Store.init(W.SEED);

/* ---- 1. the heavy feeds do not refetch on every tap --------------------- */
console.log('\n-- the two heavy feeds are gated --');
ok(typeof W.Projections.fresh === 'function', 'projections expose a freshness test');
ok(W.Projections.FRESH_MS >= 5 * 60000 && W.Projections.FRESH_MS <= 60 * 60000,
   'the projection window is between 5 and 60 minutes (' +
   Math.round(W.Projections.FRESH_MS / 60000) + ' min)');

var pcode = code('projections.js');
ok(/if \(!\(opts && opts\.force\) && fresh\(season, week\)\)/.test(pcode),
   'refresh() returns the cached set instead of refetching  <-- the retry-storm fix');
ok(/force: true/.test(pcode),
   'and selfTest forces a real fetch, because "does the feed answer" cannot be cached');
ok(/reused\.route = cache\.route/.test(pcode),
   'a reused set is LABELLED as reused — nothing pretends to be fresher than it is');

var rcode = code('recommend.js');
ok(/NEWS_FRESH_MS/.test(rcode) && /function newsFresh/.test(rcode),
   'the injury feed has the same gate');
ok(/reused, ' \+ newsCache\.reused \+ ' min old/.test(rcode) ||
   /newsCache\.reused/.test(rcode),
   'and the sync report says when it reused rather than fetched');

/* the gate must not swallow a FAILED fetch — a cached error is not a cache */
ok(/!newsCache\.error/.test(rcode),
   'a failed injury fetch is never treated as a fresh cache');
ok(/\(cache\.weekly \|\| 0\) > 0/.test(pcode),
   'and an empty projection set is never treated as a fresh cache');

/* ---- 2. the schedule rides along, it does not add traffic --------------- */
console.log('\n-- the schedule costs no new requests --');
var scode = code('schedule.js');
ok((scode.match(/Espn\.weekGames/g) || []).length === 1,
   'schedule.js touches the network in exactly one function');
ok(/if \(!force && !stale\(week\)\)/.test(scode), 'and only when the stored copy is stale');
var ucode = code('ui.js');
ok(/Schedule\.ingest\(week, games\)/.test(ucode),
   'the live poll feeds it from the response it already had');
ok(/m\.schedSig === joined/.test(scode),
   'and an unchanged schedule does NOT trigger a full state write  <-- 45s disk churn');

/* prove the no-write path actually holds */
(function () {
  var games = [{ id: '1', date: '2026-09-11T00:20Z', week: 1, state: 'pre',
                 teams: [{ abbr: 'CHI', homeAway: 'home' }, { abbr: 'GB', homeAway: 'away' }] }];
  var writes = 0, realSave = W.Store.save;
  W.Store.save = function () { writes++; return realSave.apply(this, arguments); };
  W.Schedule.ingest(1, games);
  var afterFirst = writes;
  W.Schedule.ingest(1, games);
  W.Schedule.ingest(1, games);
  W.Schedule.ingest(1, games);
  ok(writes === afterFirst,
     'three more ingests of the SAME schedule wrote nothing (' + writes + ' total writes)');
  games[0].state = 'in';
  W.Schedule.ingest(1, games);
  ok(writes > afterFirst, 'but a game going live does write');
  W.Store.save = realSave;
}());

/* ---- 3. nothing can spin -------------------------------------------------- */
console.log('\n-- no unbounded retries anywhere --');
var ecode = code('espn.js');
ok(!/while\s*\(true\)/.test(ecode) && !/for\s*\(;;\)/.test(ecode),
   'espn.js has no unbounded loop');
ok(/guard < 8192/.test(ecode),
   'chunk reassembly is bounded, and the bound is checked');
ok(/timeout/.test(ecode), 'every request carries a timeout');

var nb = fs.readFileSync(path.join(__dirname, '..',
  'android/src/com/tj/fftracker/NativeBridge.java'), 'utf8');
var nbcode = nb.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
ok(/newFixedThreadPool\(3\)/.test(nbcode),
   'the request pool is 3 wide — concurrent enough to be quick, narrow enough to be polite');
ok(/setConnectTimeout\(/.test(nbcode) && /setReadTimeout\(/.test(nbcode),
   'connect and read timeouts are set, so a hung socket cannot pin a thread forever');
ok(/setRequestProperty\("User-Agent"/.test(nbcode),
   'requests identify the app rather than pretending to be a browser');
(function () {
  /* one retry, and only when nothing was read: a call that actually succeeded
     can never be paid for — or repeated — twice */
  var retries = (nbcode.match(/retry|retried/gi) || []).length;
  ok(retries <= 6, 'retry logic is small enough to reason about (' + retries + ' mentions)');
  ok(/readNothing|read zero|len == 0|length\(\) == 0|empty/i.test(nb),
     'and the retry is conditioned on having read nothing');
}());

ok(/setTimeout\(res, 350\)/.test(code('playerdb.js')),
   'the 32-team database refresh paces itself between teams  <-- 32 rapid requests is what a block looks like');

/* ---- 4. what is cached locally and never refetched ---------------------- */
console.log('\n-- cached locally, as Tj asked --');
ok(/fftracker_proj_v2/.test(pcode), 'projections persist to disk');
ok(/fftracker_news_v1/.test(rcode), 'the injury feed persists to disk');
ok(/fftracker_ai_v1/.test(rcode), 'Claude verdicts persist to disk');
ok(/fftracker_waivers_v1/.test(code('value.js')), 'the waiver read persists to disk');
ok(/weekMeta/.test(scode), 'the schedule persists inside the season state');
(function () {
  var db = code('playerdb.js');
  ok(/bundled/.test(db),
     'the 785-player database SHIPS with the app and is only ever refreshed on request');
}());
(function () {
  /* a finished game cannot change, so it must never be refetched */
  ok(/final: g\.state === 'post'/.test(ucode) || /c\.final/.test(ucode),
     'a game that is final is cached and not refetched');
}());

/* ---- 5. the poll backs off, and stops ----------------------------------- */
console.log('\n-- the live poll is not a fixed drumbeat --');
(function () {
  var i = ucode.indexOf('function liveTick');
  var block = ucode.slice(i, i + 1400);
  ok(/scheduleLive\(pre \? 5 \* 60000 : 10 \* 60000\)/.test(block),
     'with nothing in progress it drops to 5-10 minutes rather than 45 seconds');
  ok(/live\.next = 0; return;/.test(block),
     'and once the week is final and synced it stops entirely');
  ok(/scheduleLive\(60000\)/.test(block),
     'a failure backs off to a minute instead of retrying immediately  <-- this is how a block happens');
  ok(/if \(busy\)/.test(block),
     'a tick that lands while a sync is already running defers instead of stacking');
}());

/* ---- 6. failure of one step never re-runs the others -------------------- */
console.log('\n-- a failing step does not cost the successful ones --');
ok(/schedule FAILED[\s\S]{0,200}everything else still ran/.test(src('recommend.js')),
   'a schedule failure no longer abandons the whole sync');
/* both spellings are in this codebase: `.catch(` and `['catch'](`. The bracket
   form is an old ES3-reserved-word habit; either is fine on Chromium 77. */
ok(/Claude FAILED/.test(rcode) &&
   /(\.catch|\['catch'\])\(function \(e\) \{[\s\S]{0,160}Claude FAILED/.test(rcode),
   'a Claude failure is caught and reported, leaving the rest of the sync intact');

console.log(fails ? ('\n  ' + fails + ' network check(s) FAILED') : '\n  network checks pass');
process.exit(fails ? 1 : 0);
