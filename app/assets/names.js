/* names.js — player identity. v4.1
 *
 * THE PROBLEM. "Kenneth Gainwell" is on Tj's roster; the player database says
 * "Kenny Gainwell". Every identity check in this app was an exact match on
 * Espn.normName(), so those were two different men. That showed up three ways,
 * and the one Tj noticed was the least damaging of them:
 *
 *   1. the free-agent list offered a player he already owns
 *   2. the AI waiver sync could recommend signing his own player
 *   3. WORST: the weekly sync indexes rostered players by exact normalised
 *      name. If ESPN's box score says "Kenny" and the roster says "Kenneth",
 *      the stat line matches nobody and he silently scores 0.0 all season.
 *
 * WHY THE OBVIOUS FIX IS WRONG. The tempting rule is "same surname + same
 * position + same NFL team = same player". Run that over this league's actual
 * data and it is a disaster:
 *
 *   - Bijan Robinson and Brian Robinson Jr. are BOTH Atlanta running backs.
 *   - Elijah Moore and D.J. Moore are BOTH Buffalo receivers.
 *
 * Those merges would corrupt a roster. And team cannot even be a REQUIREMENT,
 * because the real case that started this has them disagreeing: the database
 * says Kenny Gainwell is on PIT, the roster says Kenneth Gainwell is on TB.
 * (That disagreement is itself a stale-data bug, tracked separately — but the
 * identity fix must not depend on it being resolved.)
 *
 * Of 65 same-surname pairs across the real 785-player database and the ten
 * real rosters, exactly ONE is the same human being. So the only safe
 * mechanism is a curated equivalence of FIRST names — Kenny/Kenneth is a
 * nickname pair, Bijan/Brian is not — plus a short list of full-name aliases
 * for the cases no rule can derive, like a player who goes by a stage name.
 *
 * Every merge this module performs over the real database is pinned in
 * tools/test_names.js. A data update that creates a NEW merge turns that test
 * red on purpose, so a person looks at it before it reaches a roster.
 */
(function (root) {
  'use strict';

  /* formal name -> the short forms people actually print. Deliberately
     conservative: only pairs that are unambiguous nicknames in American usage.
     Anything where the short form is also a common standalone given name for a
     DIFFERENT formal name is left out, because a wrong merge is far more
     expensive than a missed one — a missed one shows a duplicate in a list, a
     wrong one silently attributes a stranger's stats to your player. */
  var NICK = {
    alexander: ['alex'],
    andrew: ['andy', 'drew'],
    anthony: ['tony'],
    benjamin: ['ben', 'benny'],
    cameron: ['cam'],
    charles: ['charlie', 'chuck'],
    christopher: ['chris'],
    daniel: ['dan', 'danny'],
    david: ['dave'],
    donald: ['don', 'donnie'],
    edward: ['ed', 'eddie'],
    frederick: ['fred', 'freddie'],
    gabriel: ['gabe'],
    gregory: ['greg'],
    jacob: ['jake'],
    james: ['jim', 'jimmy'],
    jeffrey: ['jeff'],
    jonathan: ['jon'],
    jonathon: ['jon'],
    joseph: ['joe', 'joey'],
    joshua: ['josh'],
    kenneth: ['kenny', 'ken'],
    lawrence: ['larry'],
    matthew: ['matt'],
    maxwell: ['max'],
    michael: ['mike'],
    nathaniel: ['nate'],
    nicholas: ['nick'],
    patrick: ['pat'],
    raymond: ['ray'],
    richard: ['rich', 'rick', 'ricky'],
    robert: ['rob', 'robbie', 'bobby'],
    ronald: ['ron', 'ronnie'],
    samuel: ['sam', 'sammy'],
    stephen: ['steve'],
    steven: ['steve'],
    theodore: ['ted', 'teddy', 'theo'],
    thomas: ['tom', 'tommy'],
    timothy: ['tim'],
    vincent: ['vince', 'vinny'],
    william: ['will', 'willie', 'billy'],
    zachary: ['zach', 'zack']
  };

  /* short form -> formal. Built once from NICK above. */
  var TOFORMAL = {};
  (function () {
    var formal, i, list;
    for (formal in NICK) {
      if (!Object.prototype.hasOwnProperty.call(NICK, formal)) continue;
      list = NICK[formal];
      for (i = 0; i < list.length; i++) {
        /* "steve" maps to both stephen and steven, and either is fine as long
           as it is the SAME one every time — this is a canonical bucket, not a
           claim about spelling. First writer wins, deterministically. */
        if (TOFORMAL[list[i]] === undefined) TOFORMAL[list[i]] = formal;
      }
    }
  }());

  /* Full-name aliases: same person, no rule could derive it. Both sides are
     stored already-normalised. Keep this list SHORT and sourced — each entry
     is a claim that two printed names are one man. */
  var ALIAS_PAIRS = [
    ['hollywood brown', 'marquise brown'],   /* goes by Hollywood on most boards */
    ['bam knight', 'zonovan knight'],        /* ESPN and Sleeper disagree on this one */
    ['chig okonkwo', 'chigoziem okonkwo'],
    ['gabe davis', 'gabriel davis'],
    ['deebo samuel', 'tyshun samuel']
  ];
  var ALIAS = {};
  (function () {
    var i, a, b;
    for (i = 0; i < ALIAS_PAIRS.length; i++) {
      a = ALIAS_PAIRS[i][0]; b = ALIAS_PAIRS[i][1];
      /* both directions collapse to the first spelling */
      ALIAS[a] = a; ALIAS[b] = a;
    }
  }());

  function normName(s) {
    if (root.Espn && root.Espn.normName) return root.Espn.normName(s);
    /* names.js loads before espn.js in one of the test harnesses, so it must
       not hard-depend on it. Same transformation, kept in step by a test. */
    return String(s || '').toLowerCase()
      .replace(/[.'`]/g, '').replace(/-/g, ' ')
      .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  /* canon(name) -> the identity key. Two printed names that belong to the same
     man produce the same key; two different men must not. */
  function canon(name) {
    var n = normName(name);
    if (!n) return '';
    if (ALIAS[n]) n = ALIAS[n];
    var w = n.split(' ');
    if (w.length < 2) return n;
    /* fold ONLY the first token. A middle name or a compound surname is left
       alone: "amon ra st brown" must not become "amon ra st robert". */
    var first = w[0];
    if (TOFORMAL[first]) w[0] = TOFORMAL[first];
    return w.join(' ');
  }

  /* same(a, b, posA, posB) — is this the same player?
     Positions are optional. When BOTH are known and differ, the answer is no
     regardless of the name: a quarterback and a linebacker who share a name
     are two men, and this league has exactly that shape of collision. */
  function same(a, b, posA, posB) {
    if (posA && posB && posA !== posB) return false;
    var ca = canon(a), cb = canon(b);
    return !!ca && ca === cb;
  }

  /* A key suitable for an owned-set or an index. Defences are keyed by team
     code, because "Chicago Bears" and "Bears D/ST" are the same entry and no
     name rule handles that. */
  function key(name, pos, nfl) {
    if (pos === 'DEF') return 'DEF:' + String(nfl || '').toUpperCase();
    return canon(name);
  }

  /* variants(name) — every spelling this key should also match, so a caller
     that wants a plain lookup table can insert all of them. */
  function variants(name) {
    var c = canon(name), out = [c], n = normName(name), i, w, list;
    if (n && n !== c) out.push(n);
    w = c.split(' ');
    if (w.length >= 2 && NICK[w[0]]) {
      list = NICK[w[0]];
      for (i = 0; i < list.length; i++) out.push([list[i]].concat(w.slice(1)).join(' '));
    }
    return out;
  }

  var API = { canon: canon, same: same, key: key, variants: variants,
              normName: normName, NICK: NICK, ALIAS_PAIRS: ALIAS_PAIRS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.Names = API;
}(typeof window !== 'undefined' ? window : this));
