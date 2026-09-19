/* test_names.js — v4.1. Player identity.
 *
 * The whole risk of this feature is in one direction. A MISSED merge shows a
 * duplicate in a list, which is annoying. A WRONG merge silently attributes a
 * stranger's stat line to your player, or removes a player you could have
 * signed. So most of what is below is about refusing to merge.
 *
 * The important test is the last one: it enumerates every merge the fold
 * actually performs over the real 785-player database and the ten real
 * rosters, and pins the list. A data refresh that introduces a NEW merge turns
 * this red on purpose.
 */
var fs = require('fs'), path = require('path'), fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  OK   ' + m); }

var W = { window: null }; W.window = W;
['seed.js', 'players.js', 'scoring.js', 'espn.js', 'names.js'].forEach(function (f) {
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'app/assets', f), 'utf8'))(W);
});
var N = W.Names;

/* ---- 1. the case that started this --------------------------------------- */
ok(N.same('Kenneth Gainwell', 'Kenny Gainwell', 'RB', 'RB'),
   'Kenneth Gainwell and Kenny Gainwell are one player');
ok(N.canon('Kenny Gainwell') === N.canon('Kenneth Gainwell'),
   'and they canonicalise to the same key');

/* ---- 2. the merges that would be a disaster ------------------------------
 * Every one of these is a REAL pair from this league's data. The first two
 * share a surname, a position AND an NFL team, which is exactly why
 * "same surname + same team" cannot be the rule. */
var mustNotMerge = [
  ['Bijan Robinson', 'Brian Robinson Jr.', 'RB', 'RB', 'both Atlanta running backs'],
  ['Elijah Moore', 'D.J. Moore', 'WR', 'WR', 'both Buffalo receivers'],
  ['Josh Allen', 'Brandon Allen', 'QB', 'QB', 'two quarterbacks named Allen'],
  ['Josh Allen', 'Kyle Allen', 'QB', 'QB', 'and a third'],
  ['Travis Etienne Jr.', 'Trevor Etienne', 'RB', 'RB', 'the Etiennes'],
  ['Tetairoa McMillan', 'Jalen McMillan', 'WR', 'WR', 'the McMillans'],
  ['Amon-Ra St. Brown', 'A.J. Brown', 'WR', 'WR', 'St. Brown is not Brown'],
  ['Jameson Williams', 'Kyle Williams', 'WR', 'WR', 'the Williamses'],
  ['Chase Brown', 'Brittain Brown', 'RB', 'RB', 'the Browns'],
  ['Jonathon Brooks', 'Chris Brooks', 'RB', 'RB', 'the Brookses'],
  ['Daniel Jones', 'Mac Jones', 'QB', 'QB', 'the Joneses'],
  ['Nico Collins', 'Beaux Collins', 'WR', 'WR', 'the Collinses'],
  ['Tee Higgins', 'Jayden Higgins', 'WR', 'WR', 'the Higginses'],
  ['Justin Jefferson', 'Van Jefferson', 'WR', 'WR', 'the Jeffersons'],
  ['Michael Wilson', 'Garrett Wilson', 'WR', 'WR', 'the Wilsons'],
  ['Rachaad White', 'Zamir White', 'RB', 'RB', 'the Whites']
];
var i, bad = [];
for (i = 0; i < mustNotMerge.length; i++) {
  var r = mustNotMerge[i];
  if (N.same(r[0], r[1], r[2], r[3])) bad.push(r[0] + ' == ' + r[1] + ' (' + r[4] + ')');
}
ok(!bad.length, 'none of the ' + mustNotMerge.length +
   ' real same-surname pairs merge' + (bad.length ? ':\n         ' + bad.join('\n         ') : ''));

/* ---- 3. position is a hard stop ------------------------------------------ */
ok(!N.same('Kenneth Gainwell', 'Kenny Gainwell', 'RB', 'WR'),
   'a nickname match at two different positions is still two players');
ok(N.same('Kenneth Gainwell', 'Kenny Gainwell'),
   'but a missing position does not block the match');

/* ---- 4. the fold only touches the FIRST name ----------------------------- */
ok(N.canon('Amon-Ra St. Brown').indexOf('robert') < 0,
   'a middle or compound surname is never folded (St. Brown stays St. Brown)');
ok(N.canon('Will Shipley') === N.canon('William Shipley'), 'Will/William fold');
ok(N.canon('Cam Ward') === N.canon('Cameron Ward'), 'Cam/Cameron fold');
ok(N.canon('Mike Evans') === N.canon('Michael Evans'), 'Mike/Michael fold');
/* 2026-09-15e sweep: 'gabe davis'/'gabriel davis' used to also be a curated
   ALIAS_PAIRS entry — removed as redundant once traced by hand: the generic
   gabriel: ['gabe'] NICK entry already folds canon() both directions AND
   variants() already generates the other spelling, so the explicit pair
   contributed nothing. Pinned here, in the generic-fold section rather than
   "explicit aliases" below, precisely because it no longer is one. */
ok(N.canon('Gabe Davis') === N.canon('Gabriel Davis'), 'Gabe/Gabriel fold (generically, not via a curated alias)');
ok(N.variants('Gabriel Davis').indexOf('gabe davis') >= 0,
   'and variants() still generates the short form without a curated entry for this specific player');
ok(N.canon('D.J. Moore') === N.canon('DJ Moore'),
   'punctuation is already handled by normalisation');

/* ---- 5. explicit aliases -------------------------------------------------- */
ok(N.same('Hollywood Brown', 'Marquise Brown', 'WR', 'WR'),
   'a stage name resolves through the alias list');
ok(N.same('Bam Knight', 'Zonovan Knight', 'RB', 'RB'),
   'and so does a nickname no rule could derive');
ok(!N.same('Hollywood Brown', 'A.J. Brown', 'WR', 'WR'),
   'an alias does not leak onto other players with that surname');

/* ---- 6. variants() must include the printed spelling --------------------- */
(function () {
  var v = N.variants('Kenneth Gainwell');
  ok(v.indexOf('kenneth gainwell') >= 0 && v.indexOf('kenny gainwell') >= 0,
     'variants() yields both spellings so a plain lookup table hits either');
  ok(N.variants('Ja\'Marr Chase').indexOf('jamarr chase') >= 0,
     'and it always contains the plain normalised form');
}());

/* ---- 7. names.js must not drift from Espn.normName ----------------------- */
(function () {
  var S = { window: null }; S.window = S;
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'app/assets/names.js'), 'utf8'))(S);
  var probes = ['Ja\'Marr Chase', 'Amon-Ra St. Brown', 'Brian Robinson Jr.', 'D.J. Moore'];
  var drift = [], j;
  for (j = 0; j < probes.length; j++) {
    if (S.Names.normName(probes[j]) !== W.Espn.normName(probes[j])) drift.push(probes[j]);
  }
  ok(!drift.length, 'the standalone fallback normaliser matches Espn.normName' +
     (drift.length ? ' (drifted on ' + drift.join(', ') + ')' : ''));
}());

/* ---- 8. THE PIN: every merge over the real data -------------------------- */
(function () {
  var arr = W.PLAYERDB.players, buckets = {}, k, j;
  for (j = 0; j < arr.length; j++) {
    if (arr[j].p === 'DEF') continue;
    k = N.canon(arr[j].n) + '|' + arr[j].p;
    (buckets[k] = buckets[k] || []).push(arr[j].n);
  }
  var merged = [];
  for (k in buckets) {
    if (Object.prototype.hasOwnProperty.call(buckets, k) && buckets[k].length > 1) {
      merged.push(buckets[k].slice().sort().join(' = '));
    }
  }
  merged.sort();
  /* The two known duplicates were removed from players.js once their real 2026
     teams were sourced (Gainwell is a Buccaneer, Okonkwo signed with
     Washington), so the shipped database should now fold to nothing. If this
     list grows, a data refresh has introduced either a new duplicate or a new
     WRONG merge — look at it before it reaches a roster. */
  ok(merged.length === 0,
     'the shipped database contains no two entries that fold together' +
     (merged.length ? ':\n         ' + merged.join('\n         ') : ''));

  /* and across the rosters: exactly one pair should be newly matched */
  var newly = [], t, q, p2;
  for (t = 0; t < W.SEED.teams.length; t++) {
    for (q = 0; q < W.SEED.teams[t].players.length; q++) {
      var ros = W.SEED.teams[t].players[q];
      if (ros.pos === 'DEF') continue;
      for (j = 0; j < arr.length; j++) {
        p2 = arr[j];
        if (p2.p !== ros.pos) continue;
        if (W.Espn.normName(p2.n) === W.Espn.normName(ros.name)) continue;
        if (N.same(p2.n, ros.name, p2.p, ros.pos)) {
          newly.push(ros.name + ' = ' + p2.n);
        }
      }
    }
  }
  ok(newly.length <= 1,
     'at most one roster/database pair is newly merged, and it is the known one' +
     (newly.length ? ' [' + newly.join('; ') + ']' : ' [none left — the data was fixed at source]'));
}());

/* ---- playerdb.js must not carry its own copy of this normalisation --------
 * (2026-09-19 sweep). It used to: an inline norm() with the identical regex
 * sequence as Espn.normName, char for char. They happened to still agree, but
 * two independent copies of the same normalisation is exactly the failure
 * class this whole file exists to guard against (Alerts.java's own norm()
 * carries a standing comment that it "MUST match Espn.normName ... character
 * for character, or a starter who is out will quietly fail to match" — the
 * same risk, just inside one process instead of across the JS/Java boundary).
 * Pinned as source text because the two implementations LOOK identical right
 * up until somebody edits one of them and not the other. */
(function () {
  var pdb = fs.readFileSync(path.join(__dirname, '..', 'app/assets/playerdb.js'), 'utf8');
  ok(/function norm\(s\) \{ return root\.Espn\.normName\(s\); \}/.test(pdb),
     'playerdb.js delegates to Espn.normName instead of reimplementing it');
})();

console.log(fails ? ('  ' + fails + ' name check(s) FAILED') : '  name checks pass');
process.exit(fails ? 1 : 0);
