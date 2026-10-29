/* test_snapshot.js - Tj, 2026-10-29: lost his phone; the league site's Team
 * Capsule pages + schedule restore rosters, standings, schedule and scores
 * without typing. Standings expected below are copied from the league site's
 * own Standings screen (Tj's screenshot, week 8). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const A = path.join(__dirname, '..', 'app', 'assets');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  OK   ' + m); } else { fail++; console.log('  FAIL ' + m); } }
const MODULES = ['version.js', 'seed.js', 'players.js', 'scoring.js', 'names.js', 'espn.js',
                 'playerdb.js', 'store.js', 'leaguesnap.js'];
function boot() {
  const sb = { console, setTimeout, clearTimeout, Date, Math, JSON };
  sb.window = sb;
  sb.localStorage = { _d: {}, getItem(k) { return k in this._d ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
  vm.createContext(sb);
  for (const f of MODULES) vm.runInContext(fs.readFileSync(path.join(A, f), 'utf8'), sb, { filename: f });
  sb.Store.init(sb.SEED);
  return sb;
}
const sb = boot(), Store = sb.Store, snap = sb.LEAGUE_SNAPSHOT;
ok(snap && snap.teams.length === 10, 'leaguesnap.js defines a 10-team snapshot');

/* matching is previewable without changing anything */
const dry = Store.applySnapshot(snap, { dryRun: true });
const map = {}; dry.pairs.forEach(p => { map[p.to] = p.from; });
ok(map['Shea'] === 'My team' && map['Moe'] === 'Mo' && map['Tugboat/Eric'] === 'Tugdude', 'near-miss names pair up: ' + JSON.stringify(map));
ok(Store.get().teams.some(t => t.name === 'My team'), 'dry run changed nothing');

/* wrong team count is refused and leaves the season alone */
let threw = false;
try { Store.applySnapshot({ teams: snap.teams.slice(0, 9), schedule: {} }); } catch (e) { threw = true; }
ok(threw && Store.get().teams.some(t => t.name === 'My team'), 'a 9-team snapshot is refused, nothing replaced');

const r = Store.applySnapshot(snap), S = Store.get();
ok(r.ok && r.thru === 7 && r.week === 8, 'applied: through week 7, now week 8');
ok(S.teams.map(t => t.name).sort().join() === snap.teams.map(t => t.name).sort().join(), 'teams carry the league names');
ok(S.league.me === 'myteam' && Store.team('myteam').name === 'Shea', 'your team is still "me" and is now named Shea');

/* standings = the league site's Standings screen */
const want = { Moe: [5, 2, 1245.60], Steve: [5, 2, 1097.65], Shea: [4, 3, 1320.00], Ron: [4, 3, 1208.00],
  'Tugboat/Eric': [4, 3, 1140.50], Tim: [4, 3, 1104.60], 'Jose/Brandon': [3, 4, 1176.45], Dustin: [3, 4, 1114.50],
  'Mike/Jamie': [2, 5, 1122.05], JR: [1, 6, 915.95] };
const st = Store.standings(14).byRecord;
let allMatch = true;
st.forEach(x => { const e = want[x.name]; if (!e || x.w !== e[0] || x.l !== e[1] || Math.abs(x.pts - e[2]) > 0.005) { allMatch = false; console.log('   mismatch', x.name, x.w, x.l, x.pts); } });
ok(allMatch && st.length === 10, 'standings match the league site: record and points for, all ten teams');
ok(st[0].name === 'Moe' && st[1].name === 'Steve' && st[2].name === 'Shea', 'order by record then points: Moe, Steve, Shea first');

/* schedule: all 14 weeks, five games each, names mapped to ids */
let sched = true;
for (let w = 1; w <= 14; w++) { const m = Store.getMatchups(w); const ids = new Set(); m.forEach(p => { ids.add(p[0]); ids.add(p[1]); }); if (m.length !== 5 || ids.size !== 10) sched = false; }
ok(sched, 'weeks 1-14 each have five games covering all ten teams');
const w9 = Store.getMatchups(9).map(p => Store.team(p[0]).name + ' v ' + Store.team(p[1]).name);
ok(w9.indexOf('Shea v Jose/Brandon') >= 0, 'week 9: Shea v Jose/Brandon (' + w9.join('; ') + ')');
ok(Store.getMatchups(15).length === 0, 'playoff weeks stay empty (no games scheduled)');

/* rosters: 17 each, nobody on two teams, current ones from the capsules */
const seen = {}; let dup = false, sizes = true;
S.teams.forEach(t => { if (t.players.length !== 17) sizes = false; t.players.forEach(p => { if (seen[p.id]) dup = true; seen[p.id] = 1; }); });
ok(sizes && !dup, 'every roster has 17 players and no id appears twice');
const shea = Store.team('myteam');
const has = n => shea.players.some(p => p.name === n);
ok(has('Malik Washington') && has('Rashee Rice') && has('Josh Jacobs') && has('Seattle Seahawks'), 'Shea roster: Washington, Rice, Jacobs, Seahawks D/ST');
ok(!has('Davante Adams') && !has('Deebo Samuel Sr.') && !has('Deebo Samuel'), 'Shea no longer has Adams / Deebo');
ok(shea.players.every(p => p.id && p.pos && p.nfl && p.bye >= 0), 'every player has id, position, NFL team');

/* history: dropped players are restorable into past weeks */
const adams = S.released.find(x => x.teamId === 'myteam' && /Davante Adams/.test(x.player.name));
ok(adams && adams.from === 7, 'Davante Adams parked as released, off the roster from week 7');
ok(Store.playerById(adams.player.id) && Store.playerById(adams.player.id).released, 'playerById resolves him (past weeks can use him)');
ok(S.released.length >= 40, 'every team\'s dropped players are parked (' + S.released.length + ')');
const tx = S.transactions.filter(x => x.team === 'Shea');
ok(tx.length === 14 && tx[0].player === 'Malik Washington', 'Shea has 14 add/drop transactions, newest first (draft-day adds skipped)');

/* the current week's lineups are the league site's */
const L = Store.getLineup(8, 'myteam'), nm = id => Store.playerById(id).player.name;
ok(nm(L.QB) === 'Matthew Stafford' && nm(L.DEF) === 'Seattle Seahawks' && nm(L.K) === "Ka'imi Fairbairn", 'week 8: Stafford, Fairbairn, Seahawks start');
ok(Object.keys(L).length === 10 && new Set(Object.values(L)).size === 10, 'week 8 lineup fills all ten slots with ten different players');
ok(['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'WR3', 'TE', 'FLEX', 'K', 'DEF'].every(k => Store.isManual(8, 'myteam', k)), 'week 8 slots are pinned so auto-fill leaves them');
ok(Store.teamWeekScore(3, 'myteam').total === 166.10 && Store.teamWeekScore(3, 'mo').total === 222.50, 'week 3 Shea 166.10 vs Moe 222.50');

/* applying again changes nothing important (idempotent) */
const rel = S.released.length, txn = S.transactions.length;
Store.applySnapshot(snap);
const S2 = Store.get();
ok(S2.released.length === rel && S2.transactions.length === txn, 'second apply adds no duplicate released players or transactions');
ok(JSON.stringify(Store.standings(14).byRecord.map(x => x.name + x.w + x.pts)) === JSON.stringify(st.map(x => x.name + x.w + x.pts)), 'second apply gives the same standings');
ok(S2.settings.aiKey === '' && S2.settings.snapAppliedAt, 'settings survive and the apply is stamped');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
