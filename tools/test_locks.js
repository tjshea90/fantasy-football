/* test_locks.js — the v4.7 correctness fixes, pinned. ES2018-agnostic (node).
 *
 * Every assertion here corresponds to something that was measurably WRONG in
 * v4.6 and was found by running the app's own modules, not by reading them.
 * The four groups:
 *
 *   1. KICKOFF LOCKS. The automatic auto-fill benched players who had already
 *      played, because autoLineup ranks on projections and has no concept of
 *      time. It ran after every sync — including the quiet 45-second live poll
 *      — so a team's live total silently dropped by whatever the benched
 *      player had scored, all Sunday afternoon, for all ten teams.
 *
 *   2. NAME KEYS. Claude's verdicts were written under Names.canon and read
 *      under Espn.normName, so for 15 of this league's 170 players every
 *      verdict was discarded — including a hard "he is OUT". The injury feed
 *      and the projection index had the same defect in a different shape.
 *
 *   3. RETURN TOUCHDOWNS. Tj settled the rules-sheet ambiguity: one score, one
 *      award, to the D/ST. The old setting paid BOTH when switched on.
 *
 *   4. PERSISTENCE. A failed write reported success; every lineup edit
 *      rewrote the whole season; the exported backup carried the API key.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const A = path.join(__dirname, '..', 'app', 'assets');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  OK   ' + m); } else { fail++; console.log('  FAIL ' + m); } }

const MODULES = ['version.js', 'seed.js', 'players.js', 'scoring.js', 'names.js',
                 'playerdb.js', 'espn.js', 'store.js', 'usage.js', 'projections.js',
                 'ai.js', 'recommend.js', 'schedule.js'];
function boot(disk, native) {
  const sb = { console, window: null, setTimeout, clearTimeout, Date, Math, JSON };
  sb.window = sb;
  sb.localStorage = {
    _d: disk || {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; }
  };
  if (native) sb.Native = native;
  vm.createContext(sb);
  for (const f of MODULES) vm.runInContext(fs.readFileSync(path.join(A, f), 'utf8'), sb, { filename: f });
  sb.Store.init(sb.SEED);
  return sb;
}

/* ======================================================================== */
console.log('\n-- 1. a player who has kicked off cannot be moved by the automation --');
{
  const sb = boot({});
  const { Store, Scoring, Recommend } = sb;
  const wk = 3, me = 'myteam';
  const find = (n) => Store.team(me).players.filter(p => p.name === n)[0];

  /* Thursday night. Tj started a 6.2-projected bench back and he went off. */
  const tracy = find('Tyrone Tracy Jr.');
  const line = Scoring.emptyLine();
  line.played = true; line.rush.yds = 140; line.rush.td = 2; line.rec.rec = 4; line.rec.yds = 30;
  Store.getStats(wk)[tracy.id] = line;
  Store.setSlot(wk, me, 'RB1', tracy.id, false);      /* auto-filled, NOT manual */
  Store.setSlot(wk, me, 'RB2', find("D'Andre Swift").id, false);

  const banked = Store.teamWeekPoints(wk, me).total;
  ok(banked > 30, 'he has banked ' + banked + ' real points in a non-manual slot');

  Store.applyAuto(wk, me, Recommend.autoLineup(wk, me, null));

  const L = Store.getLineup(wk, me);
  const still = Object.keys(L).some(k => L[k] === tracy.id);
  ok(still, 'the automatic auto-fill leaves him where he is');
  ok(Store.teamWeekPoints(wk, me).total === banked,
     'and the team total is unchanged (' + Store.teamWeekPoints(wk, me).total +
     ') <-- this used to drop to 0');
}
{
  const sb = boot({});
  const { Store } = sb;
  const wk = 3, me = 'myteam', S = Store.get();
  const find = (n) => Store.team(me).players.filter(p => p.name === n)[0];
  const swift = find("D'Andre Swift"), jt = find('Jonathan Taylor');

  /* No stat line at all — the lock has to come from the SCHEDULE this time. */
  S.weekMeta[String(wk)] = { games: {
    CHI: { kick: new Date(Date.now() - 3600e3).toISOString(), state: 'in', opp: 'GB', home: true },
    IND: { kick: new Date(Date.now() + 3 * 86400e3).toISOString(), state: 'pre', opp: 'HOU', home: false }
  } };
  ok(Store.isLocked(wk, swift.id) === true, 'a game in progress locks its players with no stat line yet');
  ok(Store.isLocked(wk, jt.id) === false, 'a kickoff three days out locks nobody');

  /* the other direction: he cannot be ADDED after his game has started */
  Store.setSlot(wk, me, 'RB1', jt.id, false);
  Store.applyAuto(wk, me, { RB1: jt.id, RB2: swift.id });
  const L = Store.getLineup(wk, me);
  ok(L.RB2 !== swift.id, 'auto-fill will not start a player whose game has already begun');
}
{
  const sb = boot({});
  const { Store } = sb;
  ok(Store.isLocked(9, Store.team('myteam').players[0].id) === false,
     'with no schedule stored nothing is locked — a missing kickoff never guesses');
  ok(Store.isLocked(3, '') === false, 'an empty slot is not locked');
}

/* ======================================================================== */
console.log('\n-- 2. every spelling of a name reaches the same record --');
{
  const sb = boot({});
  const { Ai, Recommend, Store, Names, Espn, SEED } = sb;
  const wk = 3;

  const folded = [];
  SEED.teams.forEach(t => t.players.forEach(p => {
    if (p.pos !== 'DEF' && Names.canon(p.name) !== Espn.normName(p.name)) folded.push(p.name);
  }));
  ok(folded.length > 0, folded.length + ' players in this league have a nickname first name');

  /* Claude rules every one of them OUT. Each must become unstartable. */
  Recommend.mergeAi(wk, Ai.normalizeAdvice({
    summary: '', players: folded.map(n => ({
      name: n, status: 'out', willPlay: false, adjust: 0, confidence: 'high', reason: 'ruled out'
    }))
  }, { week: wk }, 'test'), {});

  let blocked = 0, missed = [];
  SEED.teams.forEach(t => {
    Recommend.projectAll(wk, t.id, null).forEach(x => {
      if (folded.indexOf(x.p.name) < 0) return;
      if (x.startable === false && x.proj === 0) blocked++; else missed.push(x.p.name);
    });
  });
  ok(blocked === folded.length && missed.length === 0,
     'a Claude "OUT" blocks all ' + folded.length + ' of them' +
     (missed.length ? '  <-- still startable: ' + missed.join(', ') : ''));

  /* and the triage must know they were checked, or it pays for them forever */
  const ctx = Recommend.rosterContext(wk, 'myteam', null, {});
  const never = ctx.players.filter(p => p.why === 'never checked' && folded.indexOf(p.name) >= 0);
  ok(never.length === 0,
     'none of them comes back "never checked" on the next sync  <-- that was a repeat charge, every week');
}
{
  /* The injury feed is keyed by the FEED's spelling, the roster by its own. */
  const disk = {};
  disk['fftracker_news_v1'] = JSON.stringify({
    at: Date.now(), count: 1, byName: { 'kenny gainwell': { status: 'OUT', note: 'ankle' } }
  });
  const sb = boot(disk);
  sb.Recommend.loadCaches();
  const x = sb.Recommend.projectAll(3, 'myteam', null)
    .filter(y => y.p.name === 'Kenneth Gainwell')[0];
  ok(!!x, 'the roster has Kenneth Gainwell');
  ok(x.h.label === 'OUT' && x.startable === false,
     'the feed saying "Kenny Gainwell is OUT" reaches him  <-- this is the one names.js was written for');
}
{
  const sb = boot({});
  ok(sb.Names.hit({ 'joshua allen': 1 }, 'Josh Allen') === 1, 'Names.hit folds a nickname');
  ok(sb.Names.hit({ 'josh allen': 2 }, 'Josh Allen') === 2, 'and matches the plain form');
  ok(sb.Names.hit({ 'marquise brown': 3 }, 'Hollywood Brown') === 3, 'and a curated full-name alias');
  ok(sb.Names.hit({ 'someone else': 1 }, 'Josh Allen') === null, 'and does not invent a match');
  ok(sb.Names.hit(null, 'Josh Allen') === null, 'a missing map is not a crash');
}

/* ======================================================================== */
console.log('\n-- 3. a defensive or return touchdown scores once --');
{
  const S = require(path.join(A, 'scoring.js'));
  const ret = S.emptyLine(); ret.played = true; ret.ret.td = 1;
  const dst = S.emptyLine(); dst.played = true; dst.dst.retTD = 1; dst.dst.pointsAllowed = null;
  ok(S.score(ret).total === 0, 'the individual returner scores 0');
  ok(S.score(dst).total === 6, 'the D/ST scores 6');
  ok(S.score(ret).total + S.score(dst).total === 6,
     'one return TD is worth 6 league points in total  <-- it was 12 with the old setting on');

  const pick6 = S.emptyLine(); pick6.played = true; pick6.dst.defTD = 1; pick6.dst.pointsAllowed = null;
  ok(S.score(pick6).total === 6, 'a pick-six is worth 6, once');

  ok(S.RULES.individualReturnTD === undefined, 'the setting is gone, not merely defaulted to false');
  S.configure({ individualReturnTD: true });
  ok(S.score(S.emptyLine()) && S.score(ret).total === 0,
     'and configure() can no longer turn the double-count back on');

  /* the memo must not outlive a rule change, whatever the next one is */
  const L = S.emptyLine(); L.played = true; L.rush.yds = 100;
  const before = S.score(L).total;
  S._bumpRulesEpoch();
  ok(S.score(L).total === before, 'bumping the rules epoch re-scores rather than serving a stale cache');
}

/* ======================================================================== */
console.log('\n-- 4. persistence tells the truth and writes only what changed --');
{
  const nat = { _f: {}, load(k) { return this._f[k] || null; }, save() { return false; } };
  const sb = boot({}, nat);
  ok(sb.Store.save() === false,
     'a refused write is reported as a failure  <-- this always returned true');
}
{
  let archOk = false;
  const nat = { _f: {}, load(k) { return this._f[k] || null; },
    save(k, v) { const o = k.indexOf('archive') >= 0 ? archOk : true; if (o) this._f[k] = v; return o; } };
  const sb = boot({}, nat);
  sb.Store.setLine(3, 'p036', Object.assign(sb.Scoring.emptyLine(), { played: true }));
  ok(sb.Store.save() === false, 'a failed archive write fails the save even though the main file landed');
  archOk = true;
  ok(sb.Store.save() === true, 'and the next save retries it — the dirty flag survived');
}
{
  const disk = {};
  const sb = boot(disk);
  const { Store, Scoring } = sb;
  for (let w = 1; w <= 14; w++) {
    const book = {};
    for (let i = 0; i < 700; i++) book['name number ' + i] = { n: 'N ' + i, t: 'KC', p: 12.4, pa: 0, cr: 11, tg: 6 };
    Store.setBook(w, book);
    const st = Store.getStats(w);
    Store.allPlayers().forEach(x => { const L = Scoring.emptyLine(); L.played = true; st[x.player.id] = L; });
  }
  Store.save();
  const before = { main: (disk['fftracker_state_v1'] || '').length,
                   arch: (disk['fftracker_archive_v1'] || '').length };
  ok(before.arch > before.main * 10,
     'the archive holds the bulk (' + Math.round(before.arch / 1024) + ' KB vs ' +
     Math.round(before.main / 1024) + ' KB)');

  let wrote = 0;
  const realSet = sb.localStorage.setItem.bind(sb.localStorage);
  sb.localStorage.setItem = function (k, v) { wrote += v.length; realSet(k, v); };
  Store.setSlot(3, 'myteam', 'RB1', Store.team('myteam').players[1].id, true);
  ok(wrote < 200 * 1024,
     'one lineup edit writes ' + Math.round(wrote / 1024) + ' KB  <-- it was ~1900 KB');

  /* and a restart must see all of it */
  const sb2 = boot(disk);
  ok(Object.keys(sb2.Store.get().stats).length === 14 &&
     Object.keys(sb2.Store.get().book).length === 14,
     'a restart reassembles both halves');
  ok(sb2.Store.getLineup(3, 'myteam').RB1 === Store.team('myteam').players[1].id,
     'and the lineup edit survived too');
}
{
  /* a v4.6-shaped single-file save must still load, then migrate */
  const sb = boot({});
  const legacy = {};
  const full = sb.Store.get();
  full.stats['5'] = { p036: Object.assign(sb.Scoring.emptyLine(), { played: true }) };
  full.book['5'] = { 'someone': { n: 'Someone', t: 'KC', p: 9 } };
  legacy['fftracker_state_v1'] = JSON.stringify(full);
  const sb2 = boot(legacy);
  ok(!!sb2.Store.lineFor(5, 'p036'), 'a pre-v4.7 save still loads its stats');
  ok(!!sb2.Store.bookWeek(5).someone, 'and its book');
  sb2.Store.save();
  ok(!!legacy['fftracker_archive_v1'], 'and one save splits it into the new shape');
}
{
  const sb = boot({});
  sb.Store.get().settings.aiKey = 'sk-ant-api03-SECRET-DO-NOT-EXPORT';
  const j = sb.Store.exportJSON();
  ok(j.indexOf('SECRET-DO-NOT-EXPORT') < 0,
     'the exported backup carries no API key  <-- it went to public Downloads in cleartext');
  ok(sb.Store.get().settings.aiKey === 'sk-ant-api03-SECRET-DO-NOT-EXPORT',
     'and the live key is untouched by exporting');
  sb.Store.importJSON(j);
  ok(sb.Store.get().settings.aiKey === 'sk-ant-api03-SECRET-DO-NOT-EXPORT',
     'restoring a redacted backup does not wipe the key already on the phone');
}
{
  /* byes: one answer, and it matches what Alerts.java has always done */
  const sb = boot({});
  const { Store } = sb;
  const p = { id: 'zz', name: 'Test Man', pos: 'RB', nfl: 'KC', bye: 0 };
  Store.team('myteam').players.push(p);
  ok(Store.isOnBye(p, 5) === true, 'a player with no bye of his own falls back to the league table');
  ok(Store.isOnBye(p, 6) === false, 'and is not on bye in any other week');
}

/* ======================================================================== */
console.log('\n-- 5. schedule.js hands the alarm the ACTIONABLE list --');
{
  const sb = boot({});
  const { Store, Schedule } = sb;
  const S = Store.get();
  S.weekMeta['3'] = { schedAt: Date.now(), games: {
    CHI: { kick: new Date(Date.now() + 20 * 3600e3).toISOString(), state: 'pre', opp: 'GB', home: true },
    IND: { kick: new Date(Date.now() + 4 * 86400e3).toISOString(), state: 'pre', opp: 'HOU', home: false }
  } };
  Schedule.earlyAlert(3, 'myteam', null);
  ok(Array.isArray(S.weekMeta['3'].shouldStart),
     'the ids the app would actually start are persisted for Alerts.java');

  let saves = 0;
  const real = Store.save;
  sb.Store.save = function () { saves++; return real.apply(this, arguments); };
  for (let i = 0; i < 30; i++) Schedule.earlyAlert(3, 'myteam', null);
  ok(saves === 0, '30 more renders write nothing  <-- the live tab re-renders every 45s');
  sb.Store.save = real;

  const alerts = fs.readFileSync(path.join(__dirname, '..', 'android', 'src', 'com', 'tj',
                                           'fftracker', 'Alerts.java'), 'utf8');
  ok(alerts.indexOf('shouldStart') >= 0, 'and the alarm reads it');
  ok(alerts.indexOf('worth.isEmpty()') >= 0,
     'falling back to naming everyone when the page has not written a list yet');
  ok(alerts.indexOf('EARLY_HORIZON_MS') >= 0,
     'a daily alarm has a horizon, so it does not re-report Sunday every morning');
  ok(alerts.indexOf('REPEAT_QUIET_MS') >= 0, 'and does not re-post an identical sentence');
  ok(alerts.indexOf('scheduleDaily') >= 0,
     'the alarm is daily  <-- two weekly slots missed a Wednesday or Saturday kickoff entirely');
  ok(/toLowerCase\(java\.util\.Locale\.US\)/.test(alerts),
     'and the name normaliser is locale-independent, like the JS one it must match');
}

console.log('\n  ' + pass + ' assertions pass' + (fail ? ', ' + fail + ' FAILED' : ''));
if (fail) process.exit(1);
console.log('  lock, key, scoring and persistence checks pass');
