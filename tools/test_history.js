/* test_history.js - Tj, 2026-10-22: dropping a player must not erase him from
 * prior (final) weeks or deduct the points he scored; add/drop only affects
 * the team from that point forward. Plus: all 32 defenses survive a database
 * refresh, defenses are searchable by nickname/code, and the FULL backup
 * round-trips the extra caches. Confirmed to fail against the pre-fix store. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const A = path.join(__dirname, '..', 'app', 'assets');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  OK   ' + m); } else { fail++; console.log('  FAIL ' + m); } }
const MODULES = ['version.js', 'seed.js', 'players.js', 'scoring.js', 'names.js', 'espn.js',
                 'playerdb.js', 'store.js'];
function boot(disk) {
  const sb = { console, setTimeout, clearTimeout, Date, Math, JSON };
  sb.window = sb;
  sb.localStorage = { _d: disk || {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
  vm.createContext(sb);
  for (const f of MODULES) vm.runInContext(fs.readFileSync(path.join(A, f), 'utf8'), sb, { filename: f });
  sb.Store.init(sb.SEED);
  return sb;
}

const sb = boot(), Store = sb.Store, S = Store.get();
const t = S.teams[0], star = t.players.find(p => p.pos === 'RB');
S.settings.currentWeek = 5;
// weeks 1-3 final with him starting, week 4 final, week 5 open
for (let w = 1; w <= 5; w++) {
  Store.setSlot(w, t.id, 'RB1', star.id, true);
  S.stats[String(w)] = S.stats[String(w)] || {};
  S.stats[String(w)][star.id] = { played: true, rushYds: 100, rushTD: 1 };
}
for (let w = 1; w <= 4; w++) S.weekMeta[String(w)] = { synced: true, allFinal: true };
const before = [1, 2, 3, 4].map(w => Store.teamWeekPoints(w, t.id).total);
ok(before.every(x => x > 0), 'setup: he scored in weeks 1-4 (' + before.join(',') + ')');

Store.setSlot(6, t.id, 'RB1', star.id, true);
Store.removePlayer(t.id, star.id);

const after = [1, 2, 3, 4].map(w => Store.teamWeekPoints(w, t.id).total);
ok(JSON.stringify(after) === JSON.stringify(before), 'final weeks keep his points after a drop');
ok(!t.players.some(p => p.id === star.id), 'he is off the current roster');
ok(Store.getLineup(4, t.id).RB1 === star.id, 'week 4 lineup still lists him');
ok(Store.playerById(star.id) && Store.playerById(star.id).player.name === star.name, 'playerById still resolves a released player');
ok(Store.getLineup(6, t.id).RB1 === undefined, 'future week 6 slot is cleared');
// week 5 is open but he already played -> keeps him this week
ok(Store.getLineup(5, t.id).RB1 === star.id, 'current week keeps a player who already played');
ok(Store.allPlayers().every(x => x.player.id !== star.id), 'allPlayers (ownership) excludes released players');

// drop someone who has NOT played in an open week: removed from it
const other = t.players.find(p => p.pos === 'WR');
Store.setSlot(5, t.id, 'WR1', other.id, true);
Store.removePlayer(t.id, other.id);
ok(Store.getLineup(5, t.id).WR1 === undefined, 'unplayed starter removed from the open week');

// current week final -> drop is effective next week
S.weekMeta['5'] = { synced: true, allFinal: true };
const rb2 = t.players.find(p => p.pos === 'RB');
Store.setSlot(5, t.id, 'RB2', rb2.id, true);
Store.setSlot(6, t.id, 'RB2', rb2.id, true);
Store.removePlayer(t.id, rb2.id);
ok(Store.getLineup(5, t.id).RB2 === rb2.id, 'final current week is locked in');
ok(Store.getLineup(6, t.id).RB2 === undefined, 'next week drops him');

// survives save/restart
const sb2 = boot(sb.localStorage._d);
ok(sb2.Store.playerById(star.id) !== null, 'released players survive a restart');

// full backup
sb.localStorage.setItem('fftracker_usage_v1', '{"calls":[1]}');
const js = Store.exportAll();
const sb3 = boot();
const r = sb3.Store.importJSON(js);
ok(r === 'full', 'full backup import reports full');
ok(sb3.localStorage.getItem('fftracker_usage_v1') === '{"calls":[1]}', 'extra caches restored');
ok(sb3.Store.playerById(star.id) !== null, 'released list restored by backup');
ok(sb3.Store.importJSON(Store.exportJSON()) === true, 'plain season backups still import');
ok(js.indexOf('aiKey":"x') < 0, 'no api key leaks');

// defenses
const PD = sb.PlayerDB;
ok(PD.get().players.filter(p => p.p === 'DEF').length === 32, '32 defenses present');
PD.get().players = PD.get().players.filter(p => p.p !== 'DEF');
sb.localStorage.setItem('fftracker_playerdb_v1', JSON.stringify(PD.get()));
sb.PLAYERDB = sb.PLAYERDB; // bundled still there
const sb4 = boot(sb.localStorage._d);
ok(sb4.PlayerDB.get().players.filter(p => p.p === 'DEF').length === 32, 'missing defenses restored from bundle');
['chiefs', 'KC', 'kansas city', 'chiefs d'].forEach(q =>
  ok(sb4.PlayerDB.search(q, 'ANY', 3).some(p => p.n === 'Kansas City Chiefs'), 'search "' + q + '" finds Chiefs D'));
ok(/if \(p\.p === 'DEF'\) return true;/.test(fs.readFileSync(path.join(A, 'playerdb.js'), 'utf8')), 'refresh never prunes DEF (source pin)');

console.log(fail ? '\nFAILED ' + fail : '\nall ' + pass + ' passed');
process.exit(fail ? 1 : 0);
