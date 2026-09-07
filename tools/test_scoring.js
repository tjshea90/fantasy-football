/* Hand-checked cases against RULES_2026.md. Run: node tools/test_scoring.js */
var S = require('../app/assets/scoring.js');
var fails = 0, n = 0;
function eq(name, got, want) {
  n++;
  var ok = Math.abs(got - want) < 0.011;
  if (!ok) { fails++; console.log('  FAIL ' + name + ': got ' + got + ' want ' + want); }
}
function L() { return S.emptyLine(); }

/* --- QB: the completion bonus is the whole point of this league --- */
var qb = L();
qb.pass = { cmp: 25, yds: 300, td: 3, int: 1, twoPt: 0, long: 0 };
qb.rush = { yds: 20, td: 1, twoPt: 0, long: 0 };
/* 25 + 300/20(15) + 18 - 2 + 2 + 6 = 64 */
eq('QB line', S.score(qb).total, 64);

/* --- PPR skill --- */
var wr = L();
wr.rec = { rec: 8, yds: 112, td: 1, twoPt: 0, long: 0 };
wr.fum = { lost: 1 };
/* 8 + 11.2 + 6 - 2 = 23.2 */
eq('WR line', S.score(wr).total, 23.2);

/* --- kicker distance tiers, made AND missed --- */
eq('FG 0-39 made', S.fgPoints(35, true), 3);
eq('FG 0-39 miss', S.fgPoints(35, false), -3);
eq('FG 40-49 made', S.fgPoints(45, true), 4);
eq('FG 40-49 miss', S.fgPoints(45, false), -2);
eq('FG 50-59 made', S.fgPoints(52, true), 5);
eq('FG 50-59 miss', S.fgPoints(52, false), -1);
eq('FG 60+ made', S.fgPoints(61, true), 6);
eq('FG 60+ miss', S.fgPoints(61, false), 0);
eq('FG boundary 39', S.fgPoints(39, true), 3);
eq('FG boundary 40', S.fgPoints(40, true), 4);
eq('FG boundary 49/50', S.fgPoints(50, true), 5);
eq('FG boundary 59/60', S.fgPoints(60, true), 6);
var k = L();
k.kick = { fg: [{dist:22,made:true},{dist:47,made:true},{dist:55,made:false}], xpMade: 3, xpAtt: 4, est:false };
/* 3 + 4 - 1 + 3 - 1 = 8 */
eq('K line', S.score(k).total, 8);

/* --- D/ST, including the points-allowed ladder --- */
eq('PA 0', S.paPoints(0), 10);
eq('PA 1 -> 2-10 tier', S.paPoints(1), 7);
eq('PA 10', S.paPoints(10), 7);
eq('PA 11', S.paPoints(11), 5);
eq('PA 20', S.paPoints(20), 5);
eq('PA 21', S.paPoints(21), 1);
eq('PA 30', S.paPoints(30), 1);
eq('PA 31', S.paPoints(31), 0);
eq('PA 45', S.paPoints(45), 0);
var d = L();
d.dst = { sacks: 4, int: 2, fr: 1, defTD: 1, safety: 0, retTD: 0, pointsAllowed: 17 };
/* 8 + 4 + 2 + 6 + 5 = 25 */
eq('DST line', S.score(d).total, 25);

/* forced fumbles must NOT be scored: a line with only fr=0 scores nothing for it */
var d2 = L(); d2.dst = { sacks:0,int:0,fr:0,defTD:0,safety:0,retTD:0,pointsAllowed:24 };
eq('DST no phantom FF', S.score(d2).total, 1);

/* --- weekly league-wide +5 bonuses --- */
var a = L(); a.rec = { rec:5, yds:80, td:0, twoPt:0, long: 42 };
var b = L(); b.rec = { rec:3, yds:95, td:0, twoPt:0, long: 71 };
var c = L(); c.rush = { yds:100, td:0, twoPt:0, long: 55 };
var q = L(); q.pass = { cmp:20, yds:250, td:1, int:0, twoPt:0, long:71 };
var res = S.applyWeeklyBonuses(
  [{key:'a',line:a},{key:'b',line:b},{key:'c',line:c},{key:'q',line:q}], 'q');
eq('longest reception found', res.longestReception, 71);
eq('longest rush found', res.longestRush, 55);
eq('bonus applied to receiver', S.score(b).total, 3 + 9.5 + 5);
eq('no bonus to runner-up', S.score(a).total, 5 + 8);
eq('rush bonus applied', S.score(c).total, 10 + 5);
eq('QB gets longest-completion bonus', S.score(q).total, 20 + 12.5 + 6 + 5);

/* --- empty line scores zero --- */
eq('empty line', S.score(L()).total, 0);

console.log(fails === 0 ? ('  OK  ' + n + '/' + n + ' scoring assertions pass')
                        : ('  ' + fails + ' of ' + n + ' FAILED'));
process.exit(fails ? 1 : 0);
