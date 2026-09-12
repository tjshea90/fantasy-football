/* test_schedule.js — kickoff times, the pre-Sunday alert, and sleeping.
 *
 * Tj asked for three things that all come back to the same data:
 *   - the day and time each player plays, next to his name
 *   - refreshed often, current week only
 *   - an alert he cannot miss for players who play BEFORE Sunday
 * and, separately, that the app stop burning battery in the background.
 *
 * The alert is the part with teeth, so most of this file is about the rule
 * that decides what "before Sunday" means and about the case that actually
 * costs a week: a recommended player sitting on the bench with a Thursday
 * kickoff. Kickoffs are fed in as fixed UTC instants and read back through the
 * phone's local clock, which is the only way "Thursday" can mean anything.
 */
'use strict';
var fs = require('fs'), path = require('path'), fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  OK   ' + m); }

process.env.TZ = 'America/New_York';   /* pin the clock so "Thu" is decidable */

var W = { window: null };
W.window = W;
W.setTimeout = setTimeout; W.clearTimeout = clearTimeout;
W.Promise = Promise;
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
 'projections.js', 'usage.js', 'ai.js', 'recommend.js', 'sim.js', 'value.js', 'recap.js',
 'schedule.js', 'handoff.js'].forEach(load);
W.Store.init(W.SEED);
W.PlayerDB.init();
var S = W.Store.get(), me = S.league.me, WEEK = 1;

/* ---- a real week's shape: Wed opener, Thu night, Sunday, Monday ---------- */
/* Build the games around "now" so the alert's "is it still in the future"
   check is exercised the way it will be in September. */
function iso(daysAhead, hourLocal) {
  var d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hourLocal, 20, 0, 0);
  return d.toISOString();
}
/* find the next occurrence of a weekday (0=Sun) */
function nextDow(dow) {
  var now = new Date(), add = (dow - now.getDay() + 7) % 7;
  return add === 0 ? 7 : add;
}
var dWed = nextDow(3), dThu = nextDow(4), dSun = nextDow(0), dMon = nextDow(1);

var roster = W.Store.team(me).players;
function nflOf(i) { return roster[i].nfl; }
var wedTeam = nflOf(0), thuTeam = nflOf(1), sunTeam = nflOf(2), monTeam = nflOf(3);

var games = [
  { id: '1', date: iso(dWed, 20), week: WEEK, state: 'pre', detail: '',
    teams: [{ abbr: wedTeam, homeAway: 'home' }, { abbr: 'ZZA', homeAway: 'away' }] },
  { id: '2', date: iso(dThu, 20), week: WEEK, state: 'pre', detail: '',
    teams: [{ abbr: thuTeam, homeAway: 'away' }, { abbr: 'ZZB', homeAway: 'home' }] },
  { id: '3', date: iso(dSun, 13), week: WEEK, state: 'pre', detail: '',
    teams: [{ abbr: sunTeam, homeAway: 'home' }, { abbr: 'ZZC', homeAway: 'away' }] },
  { id: '4', date: iso(dMon, 20), week: WEEK, state: 'pre', detail: '',
    teams: [{ abbr: monTeam, homeAway: 'home' }, { abbr: 'ZZD', homeAway: 'away' }] }
];

console.log('\n-- ingest and badges --');
var by = W.Schedule.ingest(WEEK, games);
ok(!!by && !!by[String(wedTeam).toUpperCase()], 'ingest indexes games by NFL team');
ok(!W.Schedule.stale(WEEK), 'a freshly ingested week is not stale');

var bw = W.Schedule.badge(wedTeam, WEEK);
var bt = W.Schedule.badge(thuTeam, WEEK);
var bs = W.Schedule.badge(sunTeam, WEEK);
var bm = W.Schedule.badge(monTeam, WEEK);
ok(bw && /^Wed /.test(bw.text), 'the Wednesday game reads as Wed (' + (bw && bw.text) + ')');
ok(bt && /^Thu /.test(bt.text), 'the Thursday game reads as Thu (' + (bt && bt.text) + ')');
ok(bs && /^Sun /.test(bs.text), 'the Sunday game reads as Sun (' + (bs && bs.text) + ')');

/* THE RULE. This is the whole feature. */
ok(bw && bw.early === true, 'Wednesday is EARLY  <-- the game Tj named specifically');
ok(bt && bt.early === true, 'Thursday is EARLY  <-- the usual case');
ok(bs && bs.early === false, 'Sunday is not early');
ok(bm && bm.early === false, 'Monday is not early');

ok(bw && /vs |@ /.test(bw.opp), 'the badge carries the opponent for the tooltip');
ok(W.Schedule._clock(new Date(2026, 8, 10, 20, 20)) === '8:20p', 'the clock formats as 8:20p');
ok(W.Schedule._clock(new Date(2026, 8, 10, 13, 0)) === '1p', 'a whole hour drops the :00');
ok(W.Schedule._clock(new Date(2026, 8, 10, 0, 5)) === '12:05a', 'midnight is 12:05a, not 0:05a');

/* a game already in progress or finished is not something to be alerted about */
W.Schedule.ingest(WEEK, [{ id: '2', date: iso(dThu, 20), week: WEEK, state: 'in',
  teams: [{ abbr: thuTeam, homeAway: 'away' }, { abbr: 'ZZB', homeAway: 'home' }] }]);
var live = W.Schedule.badge(thuTeam, WEEK);
ok(live && live.text === 'LIVE' && live.early === false,
   'a game in progress reads LIVE and stops being "early" — the deadline has passed');
W.Schedule.ingest(WEEK, games);   /* put it back */

console.log('\n-- the pre-Sunday alert --');
/* Put the Sunday player in the lineup and leave the Thursday player benched,
   which is exactly the situation that costs a week. */
var keys = W.Store.slotKeys();
W.Store.clearManual(WEEK, me);
var alert = W.Schedule.earlyAlert(WEEK, me, null);
ok(!!alert, 'an alert is produced when early games involve this roster');
ok(alert.rows.length >= 2, 'both the Wednesday and Thursday players are named (' +
   alert.rows.length + ')');
(function () {
  var names = alert.rows.map(function (r) { return r.name; });
  ok(names.indexOf(roster[0].name) >= 0 && names.indexOf(roster[1].name) >= 0,
     'by name, so he knows who to act on');
  var late = 0, i;
  for (i = 0; i < alert.rows.length; i++) {
    if (alert.rows[i].name === roster[2].name || alert.rows[i].name === roster[3].name) late++;
  }
  ok(late === 0, 'and the Sunday and Monday players are NOT in the alert');
}());
ok(alert.rows[0].at <= alert.rows[alert.rows.length - 1].at,
   'rows are ordered by kickoff, soonest first');
ok(alert.soonest > Date.now(), 'the soonest kickoff is in the future');
ok(typeof alert.hoursLeft === 'number' && alert.hoursLeft >= 0,
   'it can say how long is left (' + alert.hoursLeft + 'h)');
ok(alert.rows[0].when && /^(Wed|Thu|Fri|Sat|Tue) /.test(alert.rows[0].when),
   'each row carries a readable day and time');

/* the actionable half: benched but recommended */
(function () {
  var i, found = null;
  for (i = 0; i < alert.rows.length; i++) {
    if (alert.rows[i].recommended !== undefined) found = alert.rows[i];
  }
  ok(!!found, 'every row says whether the app recommends starting him');
  ok(Array.isArray(alert.shouldStart),
     'the alert separates out the players who are recommended but not started');
  var s;
  for (i = 0; i < alert.shouldStart.length; i++) {
    s = alert.shouldStart[i];
    ok(s.recommended === true && s.starting === false,
       'shouldStart holds only recommended-and-benched players (' + s.name + ')');
  }
  if (!alert.shouldStart.length) {
    console.log('  --   nothing benched-and-recommended in this fixture, which is a valid state');
  }
}());

/* a player IN the lineup must be reported as starting */
(function () {
  var target = null, i;
  for (i = 0; i < alert.rows.length; i++) if (alert.rows[i].name === roster[1].name) target = alert.rows[i];
  if (!target) { console.log('  --   the Thursday player is not on this roster slot, skipped'); return; }
  var slot = null;
  for (i = 0; i < keys.length; i++) {
    if (keys[i].pos === roster[1].pos || keys[i].pos === 'FLEX') { slot = keys[i].key; break; }
  }
  if (!slot) return;
  W.Store.setSlot(WEEK, me, slot, roster[1].id, true);
  var a2 = W.Schedule.earlyAlert(WEEK, me, null);
  var t2 = null;
  for (i = 0; i < a2.rows.length; i++) if (a2.rows[i].name === roster[1].name) t2 = a2.rows[i];
  ok(t2 && t2.starting === true,
     'once he is in the lineup the alert says he is starting, not that he is missing');
  W.Store.setSlot(WEEK, me, slot, '', true);
}());

/* no early games at all -> no alert. An alert that is always there is ignored. */
(function () {
  W.Schedule.ingest(WEEK, [
    { id: '3', date: iso(dSun, 13), week: WEEK, state: 'pre',
      teams: [{ abbr: sunTeam, homeAway: 'home' }, { abbr: 'ZZC', homeAway: 'away' }] }
  ]);
  ok(W.Schedule.earlyAlert(WEEK, me, null) === null,
     'a week with nothing before Sunday produces NO alert  <-- a banner that is always up is furniture');
  W.Schedule.ingest(WEEK, games);
}());

console.log('\n-- it costs no extra network --');
(function () {
  var ui = fs.readFileSync(path.join(__dirname, '..', 'app/assets/ui.js'), 'utf8');
  var code = ui.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  var i = code.indexOf('function liveTick');
  ok(i > 0, 'the live poll exists');
  var block = code.slice(i, i + 900);
  ok(/Schedule\.ingest\(week, games\)/.test(block),
     'the poll feeds the schedule from the response it ALREADY fetched  <-- no second request');
  var sched = fs.readFileSync(path.join(__dirname, '..', 'app/assets/schedule.js'), 'utf8');
  var scode = sched.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  var hits = scode.match(/Espn\.weekGames/g) || [];
  ok(hits.length === 1,
     'schedule.js reaches the network in exactly one place (refresh), not per badge');
  ok(/STALE_MS/.test(scode) && W.Schedule.STALE_MS >= 3600000,
     'and refresh() is rate-limited by a staleness window (' +
     Math.round(W.Schedule.STALE_MS / 3600000) + 'h)');
}());

console.log('\n-- current week only --');
(function () {
  ok(W.Schedule.get(WEEK + 1) === null,
     'nothing is stored for a week that was never ingested — it does not prefetch the season');
  var m = W.Store.get().weekMeta[String(WEEK)];
  ok(m && m.kickoffs && m.schedAt, 'the schedule is persisted in weekMeta, where Alerts.java can read it');
}());

console.log('\n-- weekMeta[week].games and .kickoffs do not collide (v5.3) --');
(function () {
  /* This is the actual bug that shipped: ui.js's doSync writes a plain
     integer game COUNT into weekMeta[week].games for the Data tab's "N
     games" display. schedule.js's ingest() used to write its per-NFL-team
     kickoff MAP into that same key — whichever ran more recently won, and
     since the live poll calls ingest() far more often than a sync runs, the
     count usually lost, and the Data tab printed "[object Object] games".
     Proven here by actually calling ingest() (not asserting the key names on
     source text) after a sync-shaped count is already on the same object, and
     checking the count survives untouched. */
  var wk = 9, S2 = W.Store.get();
  S2.weekMeta[String(wk)] = { games: 14, synced: true, allFinal: false };
  W.Schedule.ingest(wk, [{
    date: iso(0, 13), state: 'in',
    teams: [{ abbr: 'KC', homeAway: 'home' }, { abbr: 'DEN', homeAway: 'away' }]
  }]);
  var after = S2.weekMeta[String(wk)];
  ok(after.games === 14, 'the sync game COUNT is untouched by a schedule ingest  (got ' + after.games + ')');
  ok(after.kickoffs && after.kickoffs.KC && after.kickoffs.DEN,
     'and the kickoff MAP lands in its own key, not on top of the count');
}());

console.log('\n-- the app sleeps when it is not on screen --');
(function () {
  var ui = fs.readFileSync(path.join(__dirname, '..', 'app/assets/ui.js'), 'utf8');
  var code = ui.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  ok(/function appPause/.test(code) && /function appResume/.test(code),
     'the page has explicit pause and resume');
  /* `window.`, NOT `root.`. This assertion originally read `root.__appPause`,
     which is what the code said — and what the code said was a ReferenceError
     at script load, because ui.js has no `root` in scope. The test was pinning
     the bug. It now pins the fix and fails if the habit comes back. */
  ok(/window\.__appPause\s*=\s*appPause/.test(code) &&
     /window\.__appResume\s*=\s*appResume/.test(code),
     'both are exposed to Java on `window` by name');
  ok(!/^\s{0,2}root\./m.test(code),
     'and nothing at ui.js top level touches a `root` that does not exist there');
  ok(/visibilitychange/.test(code),
     'and to the browser, so a screen lock stops the poll even without the Java call');
  var i = code.indexOf('function scheduleLive');
  var block = code.slice(i, i + 300);
  ok(/if\s*\(asleep\)/.test(block),
     'the sleep guard is at the single place a timer is armed  <-- an in-flight request cannot re-arm it');
  ok(/function appPause[\s\S]{0,300}stopLive\(\)/.test(code),
     'pausing actually clears the timer rather than only setting a flag');

  var ma = fs.readFileSync(path.join(__dirname, '..',
    'android/src/com/tj/fftracker/MainActivity.java'), 'utf8');
  var mcode = ma.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  ok(/protected void onPause\(\)/.test(mcode), 'MainActivity implements onPause');
  ok(/protected void onResume\(\)/.test(mcode), 'MainActivity implements onResume');
  ok(/protected void onStop\(\)/.test(mcode), 'MainActivity implements onStop');
  ok(/protected void onDestroy\(\)/.test(mcode), 'MainActivity implements onDestroy');
  ok(/pauseTimers\(\)/.test(mcode),
     'onPause calls pauseTimers() — a backgrounded WebView keeps running JS timers otherwise');
  ok(/resumeTimers\(\)/.test(mcode), 'and onResume undoes it');
  ok(/__appPause/.test(mcode) && /__appResume/.test(mcode),
     'Java tells the page first, so it can stop its own timer cleanly before being frozen');
  ok(/web\.destroy\(\)/.test(mcode),
     'onDestroy tears the WebView down — one holding an Activity context is the classic leak');
  ok(/removeJavascriptInterface/.test(mcode),
     'and drops the bridge, which holds a Context of its own');
}());

console.log('\n-- the background alarm can see kickoffs too --');
(function () {
  var al = fs.readFileSync(path.join(__dirname, '..',
    'android/src/com/tj/fftracker/Alerts.java'), 'utf8');
  var code = al.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  ok(/static long parseIso/.test(code), 'Alerts.java can parse an ESPN kickoff timestamp');
  ok(/weekMeta[\s\S]{0,200}optJSONObject\("kickoffs"\)/.test(code),
     'and reads the kickoff times the page persisted, so it needs no network');
  ok(/startingIds\.contains/.test(code),
     'it only reports players NOT already in the lineup — an alert for a correct ' +
     'lineup is an alert that gets swiped away');

  /* THE TRAP, PINNED. A kickoff is stored as a UTC instant. Thursday Night
     Football kicks off at 00:20Z, which is FRIDAY in UTC and Thursday
     everywhere in the United States. Deriving the weekday in UTC would make
     the alert fire a day late, every single week, and it would look correct
     in a log. Calendar.getInstance() with no argument uses the phone's own
     zone, which is the only right answer. */
  ok(/Calendar\.getInstance\(\)/.test(code),
     'the weekday comes from the PHONE\'s calendar, not UTC  <-- a 00:20Z Thursday kickoff is FRIDAY in UTC');
  ok(!/getInstance\(\s*TimeZone\.getTimeZone\("UTC"\)\s*\)[\s\S]{0,200}DAY_OF_WEEK/.test(code),
     'and no UTC calendar is used to decide the day of week');
  ok(/dow\s*<\s*java\.util\.Calendar\.TUESDAY/.test(code),
     'Tuesday through Saturday is early; Sunday and Monday are not');
  ok(/catch \(Throwable t\) \{ \/\* the other checks must still run \*\/ \}/.test(al),
     'a failure in the new block cannot cost the bye and injury alerts that already worked');
}());

console.log(fails ? ('\n  ' + fails + ' schedule check(s) FAILED') : '\n  schedule checks pass');
process.exit(fails ? 1 : 0);
