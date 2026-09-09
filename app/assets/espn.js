/* espn.js — ESPN public JSON -> normalised stat lines. ES2018 only.
 * ALL network goes through the ASYNC Native bridge: a file:// page cannot do
 * CORS, and a synchronous bridge call freezes the whole page (see request()).
 * Verified schema is recorded in SPEC.md 3a/3b. Groups are read by LABEL,
 * never by fixed position, because labels change between seasons.
 */
(function (root) {
  'use strict';
  var BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

  var MARK = '\u0001CHUNKED\u0001';
  var ERRMARK = '\u0001ERR\u0001';
  var CHUNK = 128 * 1024;
  /* how many 128 KB pulls happen before yielding to the event loop */
  var PER_TICK = 8;

  /* One transport for the whole app. ESPN reads, the ESPN fantasy projections
   * endpoint (which needs an X-Fantasy-Filter header) and the Anthropic API
   * (which needs POST + auth headers) all come through here, because a file://
   * page cannot make any cross-origin request itself.
   *   headers: plain object, or null
   *   body:    string for POST, null for GET
   *   opts:    { timeout: ms }
   *
   * THE TRANSPORT IS ASYNCHRONOUS AND MUST STAY THAT WAY.
   * `Native.httpGet(url)` looks like a function call because it is one: the JS
   * thread blocks inside it until Java returns. That is what froze the app on
   * Sync advice — the Anthropic call waits minutes, and for those minutes the
   * page could not repaint, could not move its own progress bar, and could not
   * respond to a tap. Wrapping it in `Promise.resolve().then()` changed nothing,
   * because the blocking happens inside the callback either way.
   * `Native.httpAsync` returns an id immediately and the page is woken by
   * `window.__httpDone(id)`. Do not "simplify" this back. */
  var DEFAULT_TIMEOUT = 60000;

  /* index.html defines these before any module loads, because Java can fire a
     callback at any moment. Recreate them if absent so this file is also
     usable outside the page (the node tests do exactly that). */
  if (!root.__httpPending) root.__httpPending = {};
  if (!root.__httpDone) {
    root.__httpDone = function (id) {
      var cb = root.__httpPending[id];
      if (cb) { try { cb(); } catch (e) { /* the resolver reports its own errors */ } }
    };
  }

  /* raw=true returns the body as text instead of parsing it as JSON. The
     Anthropic call streams Server-Sent Events, which are not JSON documents. */
  function parseBody(s, what, raw) {
    if (s === null || s === undefined || s === '') throw new Error(what || 'no response');
    if (s.indexOf(ERRMARK) === 0) throw new Error(s.slice(ERRMARK.length));
    /* Big bodies come across in pieces — a single large return value can be
       dropped by the binder, which is what broke the Arizona roster. */
    if (s.indexOf(MARK) === 0) {
      var parts = s.split('\u0001');       // ['', 'CHUNKED', id, length]
      var id = parts[2], total = parseInt(parts[3], 10);
      /* A malformed header used to fail in the least helpful way possible:
         `off < NaN` is false so the loop never ran, `joined.length < NaN` is
         also false so the truncation check passed, and JSON.parse('') threw
         "Unexpected end of JSON input" — which names neither the bridge nor
         the header. */
      if (!isFinite(total) || total < 0) {
        try { root.Native.httpRelease(id); } catch (e0) { /* best effort */ }
        throw new Error('the bridge sent a chunked header with no usable length');
      }
      /* PULLED ACROSS TICKS (v3.9). Each httpChunk() is a synchronous binder
         round trip, and this loop ran up to 8192 of them back to back — inside
         the resolver, on the renderer's JS thread. That is the exact freeze
         httpAsync exists to prevent, reintroduced for precisely the large
         bodies it was built for. The calls are still individually synchronous
         because that is the bridge's API, but a batch now yields to the event
         loop so the page can paint and the progress bar can move. */
      return new Promise(function (resolve, reject) {
        var buf = [], off = 0, guard = 0;
        function batch() {
          var perTick = 0;
          try {
            while (off < total && guard++ < 8192 && perTick++ < PER_TICK) {
              var piece = root.Native.httpChunk(id, off, CHUNK);
              if (piece === null || piece === undefined || piece === '') { off = total; break; }
              buf.push(piece); off += piece.length;
            }
          } catch (e1) {
            try { root.Native.httpRelease(id); } catch (e2) { /* best effort */ }
            reject(e1); return;
          }
          if (off < total && guard < 8192) { root.setTimeout(batch, 0); return; }
          try { root.Native.httpRelease(id); } catch (e3) { /* best effort */ }
          var joined = buf.join('');
          if (joined.length < total) {
            reject(new Error('truncated: got ' + joined.length + ' of ' + total + ' chars'));
            return;
          }
          try { resolve(raw ? joined : JSON.parse(joined)); }
          catch (e4) { reject(e4); }
        }
        batch();
      });
    }
    return raw ? s : JSON.parse(s);
  }

  function request(url, headers, body, opts) {
    var timeout = (opts && opts.timeout) ? opts.timeout : DEFAULT_TIMEOUT;
    var hj = headers ? JSON.stringify(headers) : '';

    if (root.Native && root.Native.httpAsync) {
      return new Promise(function (resolve, reject) {
        var id;
        try {
          id = root.Native.httpAsync(url, hj,
                 (body === null || body === undefined) ? null : body);
        } catch (e) { reject(e); return; }
        if (!id) { reject(new Error('the bridge refused the request')); return; }

        var done = false;
        var timer = root.setTimeout(function () {
          if (done) return;
          done = true;
          delete root.__httpPending[id];
          try { if (root.Native.httpForget) root.Native.httpForget(id); } catch (e2) { /* best effort */ }
          reject(new Error('timed out after ' + Math.round(timeout / 1000) + 's'));
        }, timeout);

        root.__httpPending[id] = function () {
          if (done) return;
          done = true;
          root.clearTimeout(timer);
          delete root.__httpPending[id];
          try {
            resolve(parseBody(root.Native.httpTake(id),
                              'the result was already collected',
                              !!(opts && opts.raw)));
          } catch (e3) { reject(e3); }
        };
      });
    }

    /* LEGACY synchronous path — only reachable on an old shell that predates
       httpAsync. It blocks; it is here so such a build still functions. */
    if (root.Native && root.Native.httpGet) {
      return Promise.resolve().then(function () {
        var s;
        if (body !== null && body !== undefined) {
          if (!root.Native.httpPost) throw new Error('this build has no POST bridge');
          s = root.Native.httpPost(url, hj, body);
        } else if (hj && root.Native.httpGetH) {
          s = root.Native.httpGetH(url, hj);
        } else {
          s = root.Native.httpGet(url);
        }
        /* v3.9: this duplicated the chunk-reassembly loop with a DIFFERENT
           guard constant (4096 against 8192) and no raw support, so the two
           copies could disagree about whether a body was truncated. One
           implementation now — parseBody also yields between batches, which
           this path never did. */
        return parseBody(s, 'no response', !!(opts && opts.raw));
      });
    }
    /* dev fallback (node/browser with CORS) */
    var opt = { method: (body === null || body === undefined) ? 'GET' : 'POST' };
    if (headers) opt.headers = headers;
    if (body !== null && body !== undefined) opt.body = body;
    return fetch(url, opt).then(function (r) { return r.json(); });
  }
  function httpGet(url, opts) { return request(url, null, null, opts); }
  function httpGetH(url, headers, opts) { return request(url, headers, null, opts); }
  function httpPost(url, headers, body, opts) { return request(url, headers, body, opts); }

  function num(v) {
    if (v === null || v === undefined) return 0;
    var s = String(v).replace(/,/g, '').trim();
    if (s === '' || s === '--') return 0;
    var x = parseFloat(s);
    return isFinite(x) ? x : 0;
  }
  function idx(labels, name) {
    if (!labels) return -1;
    for (var i = 0; i < labels.length; i++) {
      if (String(labels[i]).toUpperCase() === String(name).toUpperCase()) return i;
    }
    return -1;
  }
  function pick(stats, labels, name) {
    var i = idx(labels, name);
    return i < 0 ? 0 : num(stats[i]);
  }
  function pickRaw(stats, labels, name) {
    var i = idx(labels, name);
    return i < 0 ? '' : String(stats[i] === undefined ? '' : stats[i]);
  }
  function splitPair(s) {
    var p = String(s || '').split('/');
    return { made: num(p[0]), att: num(p.length > 1 ? p[1] : 0) };
  }
  function normName(s) {
    return String(s || '').toLowerCase()
      .replace(/[.'`]/g, '').replace(/-/g, ' ')
      .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  /* ---- schedule ---------------------------------------------------- */
  function weekGames(season, week, seasontype) {
    var url = BASE + '/scoreboard?limit=100&dates=' + season +
              '&seasontype=' + (seasontype || 2) + '&week=' + week;
    return httpGet(url).then(function (j) {
      var out = [], ev = j.events || [], i, k;
      for (i = 0; i < ev.length; i++) {
        var e = ev[i];
        var comp = (e.competitions && e.competitions[0]) ? e.competitions[0] : {};
        var cs = comp.competitors || [], teams = [];
        for (k = 0; k < cs.length; k++) {
          teams.push({
            abbr: cs[k].team ? cs[k].team.abbreviation : '',
            score: num(cs[k].score),
            homeAway: cs[k].homeAway || ''
          });
        }
        out.push({
          id: String(e.id), date: e.date,
          week: e.week ? e.week.number : week,
          state: (e.status && e.status.type) ? e.status.type.state : 'pre',
          detail: (e.status && e.status.type) ? e.status.type.shortDetail : '',
          teams: teams
        });
      }
      return out;
    });
  }

  /* ---- field goals + safeties + 2PT from play-by-play --------------- */
  var FG_RE = /(\d{1,2})\s*(?:yd|yard)s?\s+field goal/i;
  function scanPlays(sum, res) {
    var drives = (sum.drives || (sum.boxscore && sum.boxscore.drives) || {});
    var buckets = [];
    if (drives.previous) buckets = buckets.concat(drives.previous);
    if (drives.current) buckets.push(drives.current);
    var got = false, i, j;
    for (i = 0; i < buckets.length; i++) {
      var plays = buckets[i] && buckets[i].plays ? buckets[i].plays : [];
      for (j = 0; j < plays.length; j++) {
        var p = plays[j];
        var txt = String(p.text || '');
        var tt = String((p.type && p.type.text) ? p.type.text : '');
        if (/field goal/i.test(tt) || /field goal/i.test(txt)) {
          var m = FG_RE.exec(txt);
          if (m) {
            var made = !/no good|missed|blocked/i.test(txt) && !/miss|blocked/i.test(tt);
            var who = kickerName(txt);
            res.fgs.push({ kicker: normName(who), dist: num(m[1]), made: made });
            got = true;
          }
        }
        if (/safety/i.test(tt) || /\bsafety\b/i.test(txt)) res.safeties.push(txt);
      }
    }
    res.flags.fgFromPlays = got;
    return res;
  }

  /* ---- scoring plays: the reliable source for D/ST TDs and 2PTs ------
   * WHY THIS EXISTS. The box-score stat groups double-count: a pick-six shows
   * up as TD=1 in BOTH the 'interceptions' group and the 'defensive' group, so
   * summing group totals paid a defense 12 for one touchdown. scoringPlays is
   * one row per score, so counting there cannot double. Same array is the only
   * place two-point conversions are legible ("(X Pass From Y for Two-Point
   * Conversion)") — before this, every 2PT in the league scored 0.
   * If scoringPlays is missing we fall back to the group totals and say so. */
  function findKey(res, name) {
    var want = normName(name), k;
    if (!want) return null;
    if (res.players[want]) return want;
    var wp = want.split(' ');
    var wlast = wp[wp.length - 1], wfirst = wp[0];
    for (k in res.players) {
      if (!Object.prototype.hasOwnProperty.call(res.players, k)) continue;
      var kp = k.split(' ');
      if (kp[kp.length - 1] !== wlast) continue;
      /* "J.Hurts" in play-by-play vs "jalen hurts" in the box score */
      if (kp[0] === wfirst || kp[0].charAt(0) === wfirst.charAt(0)) return k;
    }
    return null;
  }
  var TWO_PASS_RE = /([A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+)*)\s+pass\s+from\s+([A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+)*)\s+for\s+two[\s-]?point/i;
  var TWO_RUN_RE = /([A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+)*)\s+run\s+for\s+two[\s-]?point/i;
  function scanScoringPlays(sum, res, idToAbbr) {
    var sp = sum.scoringPlays || [];
    if (!sp.length) return false;
    var i, k;
    for (k in res.teamAgg) {
      if (Object.prototype.hasOwnProperty.call(res.teamAgg, k)) {
        res.stCount[k] = { defTD: 0, retTD: 0, safety: 0 };
      }
    }
    for (i = 0; i < sp.length; i++) {
      var p = sp[i];
      var abbr = (p.team && idToAbbr[String(p.team.id)]) ? idToAbbr[String(p.team.id)] : '';
      var txt = String(p.text || '');
      var st = String((p.scoringType && p.scoringType.name) ? p.scoringType.name :
                      ((p.type && p.type.abbreviation) ? p.type.abbreviation : '')).toLowerCase();
      if (!res.stCount[abbr]) res.stCount[abbr] = { defTD: 0, retTD: 0, safety: 0 };

      if (st.indexOf('safety') >= 0 || /\bsafety\b/i.test(txt)) {
        /* the team credited with the points IS the defending team */
        res.stCount[abbr].safety++;
        continue;
      }
      var isTD = st.indexOf('touchdown') >= 0 || st === 'td' ||
                 /touchdown|\btd\b/i.test(String((p.type && p.type.text) || ''));
      if (isTD) {
        if (/kickoff\s+return|kick\s+return/i.test(txt)) {
          res.stCount[abbr].retTD++;
          creditReturn(res, txt);
        } else if (/punt\s+return/i.test(txt)) {
          res.stCount[abbr].retTD++;
          creditReturn(res, txt);
        } else if (/interception\s+return|\bpick[\s-]?six\b|intercepted.*(?:return|touchdown)/i.test(txt)) {
          res.stCount[abbr].defTD++;
        } else if (/fumble\s+(?:return|recovery)|recovered.*(?:return|touchdown)/i.test(txt)) {
          res.stCount[abbr].defTD++;
        } else if (/blocked\s+(?:punt|field goal|kick)/i.test(txt)) {
          res.stCount[abbr].defTD++;
        }
        /* anything else is an offensive TD and is already in the box score */
      }
      /* two-point conversions live inside the TD play's parenthetical */
      if (/two[\s-]?point/i.test(txt) && !/fail|no good|unsuccessful/i.test(txt)) {
        var mp = TWO_PASS_RE.exec(txt);
        if (mp) {
          var rk = findKey(res, mp[1]), qk = findKey(res, mp[2]);
          if (rk) { res.players[rk].line.rec.twoPt++; res.twoPtCredited++; }
          if (qk) { res.players[qk].line.pass.twoPt++; res.twoPtCredited++; }
        } else {
          var mr = TWO_RUN_RE.exec(txt);
          if (mr) {
            var uk = findKey(res, mr[1]);
            if (uk) { res.players[uk].line.rush.twoPt++; res.twoPtCredited++; }
          }
        }
      }
    }
    return true;
  }
  /* Record WHO returned it. Worth zero points — the +6 for a return TD goes to
     the D/ST once and only once (Tj, 2026-09-09; see the note in scoring.js).
     Kept because the player card shows it, and because "he took one back" is
     true and free to record off a scoring play we are already reading. */
  function creditReturn(res, txt) {
    var m = /^([A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+)*)\s+\d{1,3}\s*(?:Yd|Yard)/.exec(txt);
    if (!m) return;
    var k = findKey(res, m[1]);
    if (k && res.players[k].line.ret) res.players[k].line.ret.td++;
  }

  /* ---- one game -> everything the scorer needs ---------------------- */
  /* ---- the feed-shape canary ---------------------------------------------
   * pick() answers 0 for a label it cannot find. That is deliberate — a game
   * with no fumbles has no LOST column — but it is also how a RENAMED ESPN
   * column turns into a quiet week of wrong scores instead of an error. So
   * every group we read declares the labels its POINTS depend on, and anything
   * missing is recorded on the result and surfaced in the UI.
   * Usage-only labels (CAR, TGTS) are deliberately NOT listed: they are worth
   * no points, and a false alarm every week would train the alarm away. */
  var NEEDS = {
    passing: ['C/ATT', 'YDS', 'TD', 'INT'],
    rushing: ['YDS', 'TD', 'LONG'],
    receiving: ['REC', 'YDS', 'TD', 'LONG'],
    fumbles: ['LOST'],
    defensive: ['SACKS', 'TD'],
    interceptions: ['INT', 'TD'],
    kicking: ['FG', 'XP', 'LONG']
  };
  function noteShape(res, name, lab) {
    var want = NEEDS[name];
    if (!want) return;
    res.shape.groups[name] = 1;
    for (var i = 0; i < want.length; i++) {
      var tag = name + ':' + want[i];
      if (idx(lab, want[i]) < 0 && res.shape.missing.indexOf(tag) < 0) {
        res.shape.missing.push(tag);
      }
    }
  }

  /* ---- bounded parallelism -----------------------------------------------
   * The Java side runs a 3-thread pool. Fetching sixteen box scores strictly
   * one after another left two of those threads idle for the whole sync.
   * Results come back in the order the items were given, whatever order the
   * network answered in. A failed item resolves to null rather than rejecting,
   * because one dead game must not lose the other fifteen. */
  function pool(items, width, fn, onEach) {
    var n = items.length, out = new Array(n), next = 0, done = 0;
    if (!n) return Promise.resolve(out);
    var w = Math.max(1, Math.min(width || 3, n));
    return new Promise(function (resolve) {
      function launch() {
        if (next >= n) return;
        var i = next++;
        Promise.resolve()
          .then(function () { return fn(items[i], i); })
          .then(function (v) { out[i] = v; }, function (e) { out[i] = null; out['err' + i] = e; })
          .then(function () {
            done++;
            if (onEach) { try { onEach(done, n, items[i]); } catch (e2) { /* display only */ } }
            if (done === n) resolve(out); else launch();
          });
      }
      for (var k = 0; k < w; k++) launch();
    });
  }

  function gameStats(eventId) {
    return httpGet(BASE + '/summary?event=' + eventId).then(function (sum) {
      var res = {
        eventId: String(eventId),
        players: {},          /* normName -> {name, espnId, abbr, line} */
        teamScore: {},        /* ABBR -> points scored */
        teamAgg: {},          /* ABBR -> D/ST raw counts */
        fgs: [], safeties: [], twoPts: [],
        stCount: {},          /* ABBR -> {defTD, retTD, safety} from scoringPlays */
        twoPtCredited: 0,
        flags: { fgFromPlays: false, twoPtParsed: false, scoresFound: false,
                 stFromScoringPlays: false },
        shape: { groups: {}, missing: [] },
        teamPrimaryQB: {}     /* ABBR -> normName of the top passer */
      };
      var i, g, a;
      var blocks = (sum.boxscore && sum.boxscore.players) ? sum.boxscore.players : [];
      var abbrs = [];

      function P(abbr, ath) {
        var key = normName(ath.displayName);
        if (!res.players[key]) {
          res.players[key] = {
            name: ath.displayName, espnId: String(ath.id || ''), abbr: abbr,
            line: root.Scoring.emptyLine()
          };
          res.players[key].line.played = true;
        }
        return res.players[key].line;
      }
      function agg(abbr) {
        if (!res.teamAgg[abbr]) res.teamAgg[abbr] = {
          sacks: 0, int: 0, fr: 0, defTD: 0, retTD: 0, safety: 0,
          _tdDef: 0, _tdInt: 0, _tdRet: 0,
          fumblesLost: 0, pointsAllowed: null
        };
        return res.teamAgg[abbr];
      }

      for (i = 0; i < blocks.length; i++) {
        var abbr = (blocks[i].team && blocks[i].team.abbreviation) ? blocks[i].team.abbreviation : '';
        if (abbr && abbrs.indexOf(abbr) < 0) abbrs.push(abbr);
        agg(abbr);
        var groups = blocks[i].statistics || [];
        var bestCmp = -1;
        for (g = 0; g < groups.length; g++) {
          var grp = groups[g], name = String(grp.name || ''), lab = grp.labels || [];
          var aths = grp.athletes || [], tot = grp.totals || [];
          noteShape(res, name, lab);

          if (name === 'passing') {
            for (a = 0; a < aths.length; a++) {
              var st = aths[a].stats || [], L = P(abbr, aths[a].athlete || {});
              var ca = splitPair(pickRaw(st, lab, 'C/ATT'));
              L.use.patt = ca.att;
              L.pass.cmp = ca.made;
              L.pass.yds = pick(st, lab, 'YDS');
              L.pass.td  = pick(st, lab, 'TD');
              L.pass.int = pick(st, lab, 'INT');
              if (ca.made > bestCmp) {
                bestCmp = ca.made;
                res.teamPrimaryQB[abbr] = normName((aths[a].athlete || {}).displayName);
              }
            }
          } else if (name === 'rushing') {
            for (a = 0; a < aths.length; a++) {
              var st2 = aths[a].stats || [], L2 = P(abbr, aths[a].athlete || {});
              L2.use.car = pick(st2, lab, 'CAR');
              L2.rush.yds = pick(st2, lab, 'YDS');
              L2.rush.td  = pick(st2, lab, 'TD');
              L2.rush.long = pick(st2, lab, 'LONG');
            }
          } else if (name === 'receiving') {
            for (a = 0; a < aths.length; a++) {
              var st3 = aths[a].stats || [], L3 = P(abbr, aths[a].athlete || {});
              L3.use.tgts = pick(st3, lab, 'TGTS');
              L3.rec.rec = pick(st3, lab, 'REC');
              L3.rec.yds = pick(st3, lab, 'YDS');
              L3.rec.td  = pick(st3, lab, 'TD');
              L3.rec.long = pick(st3, lab, 'LONG');
            }
          } else if (name === 'fumbles') {
            for (a = 0; a < aths.length; a++) {
              var st4 = aths[a].stats || [], L4 = P(abbr, aths[a].athlete || {});
              L4.fum.lost = pick(st4, lab, 'LOST');
            }
            agg(abbr).fumblesLost = pick(tot, lab, 'LOST');
          } else if (name === 'defensive') {
            agg(abbr).sacks += pick(tot, lab, 'SACKS');
            /* kept apart from the interceptions group's TD column: ESPN counts
               a pick-six in BOTH, and adding them paid 12 for one score */
            agg(abbr)._tdDef += pick(tot, lab, 'TD');
          } else if (name === 'interceptions') {
            agg(abbr).int += pick(tot, lab, 'INT');
            agg(abbr)._tdInt += pick(tot, lab, 'TD');
          } else if (name === 'kickReturns' || name === 'puntReturns') {
            agg(abbr)._tdRet += pick(tot, lab, 'TD');
          } else if (name === 'kicking') {
            for (a = 0; a < aths.length; a++) {
              var st5 = aths[a].stats || [], L5 = P(abbr, aths[a].athlete || {});
              var xp = splitPair(pickRaw(st5, lab, 'XP'));
              L5.kick.xpMade = xp.made; L5.kick.xpAtt = xp.att;
              L5.kick._fgAgg = splitPair(pickRaw(st5, lab, 'FG'));
              L5.kick._long = pick(st5, lab, 'LONG');
            }
          }
        }
      }

      /* team scores + points allowed */
      var hdr = sum.header && sum.header.competitions && sum.header.competitions[0];
      var idToAbbr = {};
      if (hdr && hdr.competitors) {
        for (i = 0; i < hdr.competitors.length; i++) {
          var c = hdr.competitors[i];
          var ab = c.team ? c.team.abbreviation : '';
          if (ab) {
            res.teamScore[ab] = num(c.score); res.flags.scoresFound = true;
            if (c.team.id !== undefined) idToAbbr[String(c.team.id)] = ab;
            if (abbrs.indexOf(ab) < 0) abbrs.push(ab);
            agg(ab);
          }
        }
      }
      for (i = 0; i < abbrs.length; i++) {
        var me = abbrs[i], opp = abbrs[1 - i] || '';
        if (res.flags.scoresFound && opp) agg(me).pointsAllowed = res.teamScore[opp];
        if (opp) agg(me).fr = agg(opp).fumblesLost;   /* their lost = our recovery */
      }

      scanPlays(sum, res);
      attachFieldGoals(res);
      res.flags.stFromScoringPlays = scanScoringPlays(sum, res, idToAbbr);
      res.flags.twoPtParsed = res.twoPtCredited > 0;

      /* Resolve defensive/special-teams touchdowns and safeties. One row per
         score beats summing stat groups that overlap. */
      for (i = 0; i < abbrs.length; i++) {
        var A = agg(abbrs[i]);
        if (res.flags.stFromScoringPlays && res.stCount[abbrs[i]]) {
          var sc = res.stCount[abbrs[i]];
          A.defTD = sc.defTD; A.retTD = sc.retTD; A.safety = sc.safety;
        } else {
          /* fallback: the defensive group's TD column already includes pick-
             sixes, so take the larger of the two rather than their sum */
          A.defTD = Math.max(A._tdDef, A._tdInt);
          A.retTD = A._tdRet;
          A.safety = 0;
        }
        delete A._tdDef; delete A._tdInt; delete A._tdRet;
      }
      if (!res.flags.stFromScoringPlays) attachSafeties(res, abbrs);
      return res;
    });
  }

  /* Distance-resolved FGs onto the kicker's line; fall back to the aggregate
   * FG line with an inferred distance mix and mark the line est=true. */
  var EST_MIX = [[33, 0.48], [44, 0.30], [54, 0.20], [61, 0.02]];
  /* Who kicked it. This used to be the WHOLE left-hand side of the play text,
     which is wrong whenever ESPN prefixes a clock or a down-and-distance:
       "(12:34) J.Tucker 45 yard field goal is GOOD"
     gave "(12:34) J.Tucker", normalised to "1234 jtucker", which then failed
     every substring match against "justin tucker" — silently dropping that
     kicker to the inferred-distance path for the whole season, with only the
     small "FG est" hint in the header to say so. Strip the prefixes and keep
     the last few words, which is the name. */
  function kickerName(txt) {
    var left = String(txt).split(/\s+\d{1,2}\s*(?:yd|yard)/i)[0];
    left = left.replace(/\([^)]*\)/g, ' ');                    /* (12:34) */
    left = left.replace(/^.*?\bat\b\s+[A-Z]{2,3}\s*\d+\s*/i, ' '); /* ...at KC 32 */
    left = left.replace(/\b\d+(?:st|nd|rd|th)\b/gi, ' ');       /* 1st and 10 */
    left = left.replace(/\band\b|\bgoal\b/gi, ' ');
    left = left.replace(/[,;:]/g, ' ').replace(/\s+/g, ' ').trim();
    var w = left.split(' ');
    if (w.length > 3) w = w.slice(w.length - 3);
    return w.join(' ').trim();
  }
  function attachFieldGoals(res) {
    var key, i;
    for (key in res.players) {
      if (!Object.prototype.hasOwnProperty.call(res.players, key)) continue;
      var L = res.players[key].line;
      if (!L.kick || !L.kick._fgAgg) continue;
      var mine = [];
      for (i = 0; i < res.fgs.length; i++) {
        var kk = res.fgs[i].kicker;
        if (!kk) continue;
        if (key.indexOf(kk) >= 0 || kk.indexOf(key) >= 0) { mine.push(res.fgs[i]); continue; }
        /* "J.Tucker" normalises to "jtucker" and will never be a substring of
           "justin tucker", so compare last names as well. */
        var kLast = key.split(' ').pop(), wLast = kk.split(' ').pop();
        if (kLast && wLast && kLast.length > 2 &&
            (kLast === wLast || wLast.slice(-kLast.length) === kLast)) mine.push(res.fgs[i]);
      }
      var agg = L.kick._fgAgg;
      if (mine.length >= agg.att && mine.length > 0) {
        L.kick.fg = mine.map(function (f) { return { dist: f.dist, made: f.made }; });
        L.kick.est = false;
      } else if (agg.att > 0) {
        /* inferred: spread attempts over a standard distance mix, made first */
        var out = [], made = agg.made, att = agg.att, m;
        for (m = 0; m < att; m++) {
          var band = EST_MIX[Math.min(EST_MIX.length - 1, Math.floor(m * EST_MIX.length / att))];
          out.push({ dist: band[0], made: m < made });
        }
        L.kick.fg = out; L.kick.est = true;
      }
      delete L.kick._fgAgg; delete L.kick._long;
    }
  }
  function attachSafeties(res, abbrs) {
    /* A safety credits the DEFENDING team. Text carries the scoring team name
     * inconsistently, so attribute by counting and let the UI expose it. */
    var i;
    for (i = 0; i < res.safeties.length; i++) {
      var t = res.safeties[i], k;
      for (k = 0; k < abbrs.length; k++) {
        if (t.toUpperCase().indexOf(abbrs[k]) >= 0) { res.teamAgg[abbrs[k]].safety += 1; break; }
      }
    }
  }

  /* Build a D/ST stat line from the aggregate counts for one team. */
  function dstLine(agg) {
    var L = root.Scoring.emptyLine();
    L.played = true;
    L.dst.sacks = agg.sacks; L.dst.int = agg.int; L.dst.fr = agg.fr;
    L.dst.defTD = agg.defTD; L.dst.retTD = agg.retTD; L.dst.safety = agg.safety;
    L.dst.pointsAllowed = agg.pointsAllowed;
    return L;
  }

  var API = { BASE: BASE, weekGames: weekGames, gameStats: gameStats,
              pool: pool,
              dstLine: dstLine, normName: normName, _httpGet: httpGet,
              _httpGetH: httpGetH, _httpPost: httpPost };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  API._kickerName = kickerName;
  API._parseBody = parseBody;
  root.Espn = API;
})(typeof window !== 'undefined' ? window : this);
