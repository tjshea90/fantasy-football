/* playerdb.js — searchable player database. Ships bundled (window.PLAYERDB),
 * refreshes from ESPN's 32 team rosters when online. ES2018 only. */
(function (root) {
  'use strict';
  var KEY = 'fftracker_playerdb_v1';
  var DB = null;

  var TEAMS = ['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND',
               'JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA',
               'SF','TB','TEN','WAS'];

  function norm(s) {
    return String(s || '').toLowerCase().replace(/[.'`]/g, '').replace(/-/g, ' ')
      .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\s+/g, ' ').trim();
  }
  function rawLoad() {
    try {
      if (root.Native && root.Native.load) { var s = root.Native.load(KEY); return s ? JSON.parse(s) : null; }
      var t = root.localStorage.getItem(KEY); return t ? JSON.parse(t) : null;
    } catch (e) { return null; }
  }
  function rawSave(o) {
    try {
      var s = JSON.stringify(o);
      if (root.Native && root.Native.save) { root.Native.save(KEY, s); return true; }
      root.localStorage.setItem(KEY, s); return true;
    } catch (e) { return false; }
  }
  function init() {
    var stored = rawLoad();
    var bundled = root.PLAYERDB || { version: 'none', players: [] };
    /* the stored copy wins only if it is at least as big — a half-finished
     * refresh must never shrink the database */
    if (stored && stored.players && stored.players.length >= bundled.players.length) DB = stored;
    else DB = { version: bundled.version, updated: null, players: bundled.players.slice() };
    dedupe();
    return DB;
  }

  /* The database carries the same man twice under two spellings — "Kenneth
     Gainwell" and "Kenny Gainwell", "Chig Okonkwo" and "Chigoziem Okonkwo" —
     and in both cases the two copies name DIFFERENT NFL teams. That is not
     cosmetic: the team carries the bye week, so the wrong copy corrupts lineup
     planning in a league with no auto-substitution.
     Collapse them, and keep the conflict visible in meta() rather than picking
     silently. Preference order: a copy whose team a roster agrees with, then
     the copy with a bye week recorded, then the first seen. */
  function dedupe() {
    if (!root.Names || !DB || !DB.players) return;
    var rosterTeam = {};
    if (root.Store && root.Store.get && root.Store.get()) {
      try {
        root.Store.allPlayers().forEach(function (x) {
          if (x.player.nfl) rosterTeam[root.Names.canon(x.player.name)] = x.player.nfl;
        });
      } catch (e) { /* store not booted yet — preference just falls through */ }
    }
    var seen = {}, out = [], dupes = [], i, p, k, prev;
    for (i = 0; i < DB.players.length; i++) {
      p = DB.players[i];
      k = root.Names.key(p.n, p.p, p.t) + '|' + p.p;
      if (seen[k] === undefined) { seen[k] = out.length; out.push(p); continue; }
      prev = out[seen[k]];
      if (prev.t !== p.t) {
        dupes.push({ name: prev.n, alt: p.n, pos: p.p, teams: [prev.t, p.t] });
      }
      var want = rosterTeam[root.Names.canon(p.n)];
      var takeNew = (want && p.t === want && prev.t !== want) ||
                    (!want && p.b && !prev.b);
      if (takeNew) out[seen[k]] = p;
    }
    DB.players = out;
    DB.dupes = dupes;
  }
  function get() { return DB || init(); }
  function meta() {
    var d = get();
    return { version: d.version, count: d.players.length, updated: d.updated || null,
             dupes: d.dupes || [] };
  }

  /* Search: exact-ish first, then starts-with, then contains. Last-name
   * matches rank above mid-string ones so "hill" finds Hill before Hilliard. */
  function search(q, posFilter, limit) {
    var d = get(), n = norm(q);
    if (!n) return [];
    var out = [], i;
    for (i = 0; i < d.players.length; i++) {
      var p = d.players[i];
      if (posFilter && posFilter !== 'ANY' && p.p !== posFilter) continue;
      var nn = p._n || (p._n = norm(p.n));
      var score = -1;
      if (nn === n) score = 0;
      else if (nn.indexOf(n) === 0) score = 1;
      else {
        var parts = nn.split(' ');
        var lastIdx = parts.length - 1;
        if (parts[lastIdx] && parts[lastIdx].indexOf(n) === 0) score = 2;
        else if (nn.indexOf(n) > 0) score = 3;
      }
      if (score < 0) continue;
      out.push({ p: p, s: score });
    }
    out.sort(function (a, b) {
      if (a.s !== b.s) return a.s - b.s;
      return a.p.n.localeCompare(b.p.n);
    });
    return out.slice(0, limit || 25).map(function (x) { return x.p; });
  }

  /* ESPN's own abbreviations differ from the league's for a few teams. Getting
   * this wrong is why ARI and WAS failed in v1.3. The KEY is what we store
   * (it must match the bye table); the VALUE is what ESPN's URL wants. */
  var ESPN_ABBR = { WAS: 'wsh' };
  function espnAbbr(ab) { return (ESPN_ABBR[ab] || ab).toLowerCase(); }
  /* ESPN's numeric team ids. The abbreviation route is flaky for some teams
     (ARI failed repeatedly in v1.3/v1.4); the id route always resolves, so it
     is the second attempt before a team is declared failed. */
  var ESPN_ID = { ARI:22, ATL:1, BAL:33, BUF:2, CAR:29, CHI:3, CIN:4, CLE:5, DAL:6,
                  DEN:7, DET:8, GB:9, HOU:34, IND:11, JAX:30, KC:12, LAC:24, LAR:14,
                  LV:13, MIA:15, MIN:16, NE:17, NO:18, NYG:19, NYJ:20, PHI:21,
                  PIT:23, SEA:26, SF:25, TB:27, TEN:10, WAS:28 };

  /* One team can be reached several ways and they do not all work from every
   * network — ARI returned 404 on Tj's phone for routes that answer fine
   * elsewhere. Try each shape in turn and remember what each one said. */
  function candidates(ab) {
    var a = espnAbbr(ab), id = ESPN_ID[ab], B = root.Espn.BASE, out = [];
    out.push({ tag: 'abbr', url: B + '/teams/' + a + '/roster' });
    if (id) out.push({ tag: 'id', url: B + '/teams/' + id + '/roster' });
    out.push({ tag: 'abbr?enable', url: B + '/teams/' + a + '?enable=roster' });
    if (id) out.push({ tag: 'id?enable', url: B + '/teams/' + id + '?enable=roster' });
    out.push({ tag: 'ABBR', url: B + '/teams/' + ab + '/roster' });
    return out;
  }
  /* Accepts every shape those routes return: grouped athletes[].items,
   * a flat athletes[], or team.athletes[]. */
  function rosterList(j) {
    if (!j) return [];
    var src = j.athletes || (j.team ? j.team.athletes : null) || [];
    var out = [], g;
    for (g = 0; g < src.length; g++) {
      if (src[g] && src[g].items) out = out.concat(src[g].items);
      else if (src[g] && (src[g].fullName || src[g].displayName)) out.push(src[g]);
    }
    return out;
  }

  /* Runs every candidate for one team and reports what each said. This exists
   * because two builds were spent guessing at a failure that only happens on
   * one phone. */
  function diagnose(ab) {
    var cands = candidates(ab), lines = [], i = 0;
    function step() {
      if (i >= cands.length) return Promise.resolve(lines);
      var c = cands[i++];
      var t0 = Date.now();
      return root.Espn._httpGet(c.url).then(function (j) {
        var n = rosterList(j).length;
        lines.push(c.tag + ': OK ' + n + ' players, ' + (Date.now() - t0) + 'ms');
      }).catch(function (e) {
        lines.push(c.tag + ': ' + ((e && e.message) ? e.message : '?') +
                   ' (' + (Date.now() - t0) + 'ms)');
      }).then(step);
    }
    return step().then(function () {
      return ab + '\n' + cands.map(function (c, k) {
        return '  ' + lines[k] + '\n    ' + c.url.replace(root.Espn.BASE, '…');
      }).join('\n');
    });
  }

  /* Refresh from ESPN: 32 team rosters, sequential so a phone on cellular does
   * not open 32 sockets at once. Each team gets one retry — a single dropped
   * request should not cost a whole team's roster.
   * onProgress(done, total, teamAbbr). */
  function refresh(onProgress) {
    var d = get();
    var byKey = {}, i;
    for (i = 0; i < d.players.length; i++) byKey[norm(d.players[i].n)] = d.players[i];
    var added = 0, updated = 0, failed = [];
    var chain = Promise.resolve();
    TEAMS.forEach(function (ab, ix) {
      chain = chain.then(function () {
        if (onProgress) onProgress(ix, TEAMS.length, ab);
        var cands = candidates(ab);
        var errs = [];
        function tryAt(i) {
          if (i >= cands.length) {
            throw new Error(errs.join(' | '));
          }
          return root.Espn._httpGet(cands[i].url).then(function (j) {
            var list = rosterList(j);
            if (!list.length) throw new Error('no athletes');
            return list;
          }).catch(function (e) {
            errs.push(cands[i].tag + '=' + ((e && e.message) ? e.message : '?'));
            return new Promise(function (res) { setTimeout(res, 350); })
              .then(function () { return tryAt(i + 1); });
          });
        }
        var attempt = tryAt(0);
        return attempt.then(function (list) {
          var k;
          for (k = 0; k < list.length; k++) {
            var a = list[k];
            var nm = a.fullName || a.displayName;
            if (!nm) continue;
            var pos = a.position ? (a.position.abbreviation || a.position.name) : '';
            if (['QB','RB','WR','TE','K','FB','PK'].indexOf(pos) < 0) continue;
            if (pos === 'PK') pos = 'K';
            if (pos === 'FB') pos = 'RB';
            var key = norm(nm), ex = byKey[key];
            if (ex) {
              if (ex.t !== ab || ex.p !== pos) updated++;
              ex.t = ab; ex.p = pos; ex.b = (root.SEED && root.SEED.byes) ? (root.SEED.byes[ab] || 0) : ex.b;
              ex.e = a.id ? String(a.id) : ex.e;
            } else {
              var rec = { n: nm, p: pos, t: ab,
                          b: (root.SEED && root.SEED.byes) ? (root.SEED.byes[ab] || 0) : 0,
                          e: a.id ? String(a.id) : '' };
              rec._n = key; byKey[key] = rec; d.players.push(rec); added++;
            }
          }
        }).catch(function (e) {
          failed.push(ab + ' (' + ((e && e.message) ? e.message : 'unknown') + ')');
        });
      });
    });
    var before = d.players.length;
    return chain.then(function () {
      d.updated = new Date().toISOString();
      d.version = 'espn-' + d.updated.slice(0, 10);
      /* drop the cached norm keys before persisting — they rebuild lazily */
      var slim = d.players.map(function (p) {
        return { n: p.n, p: p.p, t: p.t, b: p.b, e: p.e || '' };
      });
      rawSave({ version: d.version, updated: d.updated, players: slim });
      if (onProgress) onProgress(TEAMS.length, TEAMS.length, '');
      return { added: added, updated: updated, failed: failed,
               total: d.players.length, before: before };
    });
  }

  root.PlayerDB = { init: init, get: get, meta: meta, search: search,
                    refresh: refresh, norm: norm, TEAMS: TEAMS,
                    diagnose: diagnose, candidates: candidates };
})(typeof window !== 'undefined' ? window : this);
