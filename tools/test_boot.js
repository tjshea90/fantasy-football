/* Guards the v1.0 failure: the app must never fetch a local file.
 * A file:// page on Android WebView cannot XHR a sibling asset. */
var fs = require('fs'), f = 0;
function ok(c, m) { if (!c) { f++; console.log('  FAIL ' + m); } else console.log('  OK   ' + m); }

var html = fs.readFileSync('app/assets/index.html', 'utf8');
var ui = fs.readFileSync('app/assets/ui.js', 'utf8');
var uiRaw = ui;
var seedjs = fs.readFileSync('app/assets/seed.js', 'utf8');

ok(html.indexOf('seed.js') >= 0, 'index.html loads seed.js');
ok(html.indexOf('seed.js') < html.indexOf('ui.js'), 'seed.js loads before ui.js');
ok(!/XMLHttpRequest|fetch\s*\(\s*['"](?!http)/.test(ui), 'ui.js does not fetch a local file');
ok(html.indexOf('window.onerror') >= 0, 'a global error handler is installed');

/* actually evaluate seed.js the way the WebView will */
var win = {};
new Function('window', seedjs)(win);
ok(!!win.SEED, 'seed.js defines window.SEED');
ok(win.SEED && win.SEED.teams && win.SEED.teams.length === 10, '10 teams present');
var n = win.SEED ? win.SEED.teams.reduce(function (a, t) { return a + t.players.length; }, 0) : 0;
ok(n === 170, '170 players present (got ' + n + ')');
var withProj = win.SEED ? win.SEED.teams.reduce(function (a, t) {
  return a + t.players.filter(function (p) { return p.projPG !== undefined; }).length; }, 0) : 0;
ok(withProj === 170, 'every player carries a preseason projection (got ' + withProj + ')');

/* player database must ship bundled and be searchable offline */
var pjs = fs.readFileSync('app/assets/players.js', 'utf8');
var w2 = {}; new Function('window', pjs)(w2);
ok(!!w2.PLAYERDB && w2.PLAYERDB.players.length > 700,
   'players.js bundles a usable database (' + (w2.PLAYERDB ? w2.PLAYERDB.players.length : 0) + ')');
ok(html.indexOf('players.js') >= 0 && html.indexOf('playerdb.js') >= 0,
   'index.html loads players.js and playerdb.js');
ok(html.indexOf('players.js') < html.indexOf('playerdb.js'), 'data loads before its reader');
var g = {}; g.window = g;
new Function('window', pjs)(g);
new Function('window', fs.readFileSync('app/assets/playerdb.js', 'utf8'))(g);
g.PlayerDB.init();
ok(g.PlayerDB.search('achane', null, 3).length > 0, 'search finds Achane offline');
ok(g.PlayerDB.search('seahawks', 'DEF', 3).length > 0, 'search finds a D/ST offline');
/* the status-bar inset fix must stay in the Java shell */
var mj = fs.readFileSync('android/src/com/tj/fftracker/MainActivity.java', 'utf8');
ok(mj.indexOf('setOnApplyWindowInsetsListener') >= 0, 'window insets are read from Android');
ok(mj.indexOf('__setInsets') >= 0, 'insets are pushed into CSS, not padded onto the WebView');
ok(mj.indexOf('v.setPadding(0, 0, 0, 0)') >= 0, 'the WebView itself is never padded (v1.2 clipped because it was)');
ok(mj.indexOf('onPageFinished') >= 0, 'insets are re-sent once the page exists');
var css = fs.readFileSync('app/assets/app.css', 'utf8');
ok(css.indexOf('--ins-top') >= 0 && css.indexOf('--adj-top') >= 0, 'CSS has inset and manual-adjust variables');
ok(html.indexOf('__setInsets') >= 0 && html.indexOf('__setAdjust') >= 0, 'page exposes both inset hooks');
var nb = fs.readFileSync('android/src/com/tj/fftracker/NativeBridge.java', 'utf8');
ok(nb.indexOf('.bak') >= 0, 'saves keep a .bak fallback');
ok(nb.indexOf('httpChunk') >= 0 && nb.indexOf('CHUNK_LIMIT') >= 0,
   'large HTTP bodies cross the bridge in chunks (ARI was too big in one piece)');
ok(nb.indexOf('ERRMARK') >= 0, 'network failures return a reason, not a silent null');
var esp = fs.readFileSync('app/assets/espn.js', 'utf8');
ok(esp.indexOf('httpChunk') >= 0, 'the page reassembles chunked bodies');
ok(esp.indexOf('truncated') >= 0, 'a short read is an error, not silent corruption');
var st = fs.readFileSync('app/assets/store.js', 'utf8');
ok(st.indexOf('autoBackup') >= 0, 'store has automatic backup');
var pdb = fs.readFileSync('app/assets/playerdb.js', 'utf8');
ok(/WAS:\s*'wsh'/.test(pdb), "Washington uses ESPN's 'wsh' abbreviation (v1.3 failed on it)");
ok(pdb.indexOf('ESPN_ID') >= 0, 'roster fetch falls back to ESPN numeric team ids (ARI kept failing)');
ok(/ARI:\s*22/.test(pdb), 'Arizona id is present');
ok(pdb.indexOf('function candidates') >= 0, 'each team has several route candidates');
ok(pdb.indexOf('function rosterList') >= 0, 'roster parsing tolerates every route shape');
ok(pdb.indexOf('function diagnose') >= 0, 'a per-team route diagnostic exists');
var css2 = fs.readFileSync('app/assets/app.css', 'utf8');
/* was min-height:60px exactly; v3.1 raised it and the assertion is now a
   floor rather than an equality so growing the target never fails the suite */
var mh0 = /--tab-h:(\d+)px/.exec(css2);
ok(!!mh0 && Number(mh0[1]) >= 60, 'tab targets are at least 60px tall');
ok(uiRaw.indexOf('scrollMem') >= 0, 'scroll position is remembered per tab');
ok(uiRaw.indexOf('function jobStart') >= 0, 'long jobs live outside any one screen');
var rec = fs.readFileSync('app/assets/recommend.js', 'utf8');
ok(rec.indexOf('cacheSave(NEWSKEY') >= 0, 'the injury feed is cached to disk');
ok(rec.indexOf('cacheSave(AIKEY') >= 0, "Claude's read is cached to disk too");
ok(rec.indexOf('onStep') >= 0, 'news refresh reports progress');
/* ---- v1.8 ---- */
var storeRaw = fs.readFileSync('app/assets/store.js', 'utf8');
ok(storeRaw.indexOf('function applyAuto') >= 0, 'the store can apply an auto lineup');
ok(storeRaw.indexOf('if (M[key]) continue') >= 0,
   'auto-fill skips slots the user set himself (the whole safety contract)');
ok(uiRaw.indexOf('function autoFillWeek') >= 0, 'lineups are auto-defaulted');
/* Was a grep for one literal call. v4.7 split the handler in two — a normal
   change, and a change to a slot whose game has already kicked off, which
   confirms first — so the literal stopped matching while the behaviour it
   describes was still true in BOTH branches. Assert the contract instead:
   every setSlot the lineup dropdown makes marks the pick as MANUAL. */
var lineupSets = uiRaw.match(/Store\.setSlot\(week, t\.id, k\.key,[^)]*\)/g) || [];
ok(lineupSets.length >= 2,
   'the lineup dropdown still writes through Store.setSlot (' + lineupSets.length + ' call sites)');
ok(lineupSets.length > 0 && lineupSets.every(function (c) { return /,\s*true\)$/.test(c); }),
   'every one of them records the change as a manual pick');
ok(storeRaw.indexOf('if (L[key] && isLocked(week, L[key])) continue') >= 0,
   'auto-fill skips a slot whose player has already kicked off');
ok(storeRaw.indexOf('if (want && isLocked(week, want)) want = null') >= 0,
   'and never adds a player whose game has already started');
ok(uiRaw.indexOf('function liveTick') >= 0 && uiRaw.indexOf('scheduleLive') >= 0,
   'live refresh polls while games are in progress');
ok(uiRaw.indexOf("doSync({ quiet: true })") >= 0,
   'the live poll reuses the sync path quietly');
ok(uiRaw.indexOf('myMatchupCard') >= 0, 'my matchup is pinned on the Live tab');

var sc = require('../app/assets/scoring.js');
var audit = sc.selfAudit();
ok(audit.pass === audit.total,
   'per-position scoring audit passes (' + audit.pass + '/' + audit.total + ')');
ok(sc.describe().length >= 4, 'the rules screen is generated from the engine');
ok(sc.emptyLine().ret !== undefined, 'stat lines carry individual return TDs');

ok(esp.indexOf('scanScoringPlays') >= 0, 'D/ST scores come from scoring plays');
ok(esp.indexOf('_tdDef') >= 0 && esp.indexOf('Math.max(A._tdDef, A._tdInt)') >= 0,
   'a pick-six can no longer be counted twice');
ok(esp.indexOf('twoPtCredited') >= 0, 'two-point conversions are credited');
ok(esp.indexOf('httpPost') >= 0, 'the transport can POST');

ok(nb.indexOf('public String httpPost') >= 0, 'the Java bridge exposes POST');
ok(nb.indexOf('public String httpGetH') >= 0, 'the Java bridge can send headers');
ok(nb.indexOf('ERRMARK + "HTTP " + code + (det') >= 0,
   'an HTTP error carries the server body, not just the number');
ok(nb.indexOf('chunkIfBig') >= 0, 'every response path is chunk-safe');
ok(nb.indexOf(String.fromCharCode(1)) < 0 &&
   nb.split('\\u0001').length - 1 >= 4,
   'the chunk marker is a written escape, not a stray control character');

var proj = require('../app/assets/projections.js');
ok(fs.readFileSync('app/assets/index.html','utf8').indexOf('projections.js') >= 0,
   'projections.js is loaded by the page');
ok(fs.readFileSync('app/assets/index.html','utf8').indexOf('ai.js') >= 0,
   'ai.js is loaded by the page');
var aiRaw = fs.readFileSync('app/assets/ai.js', 'utf8');
ok(aiRaw.indexOf('web_search_20250305') >= 0, 'Claude is given web search');
ok(aiRaw.indexOf('Scoring.describe()') >= 0,
   "the prompt carries this league's real scoring table");
ok(aiRaw.indexOf('anthropic-version') >= 0, 'the API version header is sent');
ok(rec.indexOf('startable') >= 0,
   'players who will not play are excluded, not merely down-weighted');
/* ---- v2.0: the transport must never block the JS thread ---- */
ok(nb.indexOf('public String httpAsync') >= 0, 'the bridge starts requests asynchronously');
ok(nb.indexOf('httpTake') >= 0 && nb.indexOf('httpForget') >= 0,
   'results are collected and abandonable');
ok(nb.indexOf('evaluateJavascript') >= 0 && nb.indexOf('__httpDone') >= 0,
   'a finished request wakes the page instead of the page waiting on it');
ok(nb.indexOf('AtomicInteger seq') >= 0,
   'the request-id counter is atomic (it is reached under two different locks)');
var ma = fs.readFileSync('android/src/com/tj/fftracker/MainActivity.java', 'utf8');
ok(ma.indexOf('bridge.attach(web)') >= 0,
   'the bridge is given the WebView, or callbacks go nowhere');
ok(html.indexOf('window.__httpDone') >= 0 && html.indexOf('window.__httpPending') >= 0,
   'the callback hook is defined in the page before any module loads');
ok(html.indexOf('__httpDone') < html.indexOf('espn.js'),
   'the hook exists before espn.js runs');
ok(esp.indexOf('Native.httpAsync') >= 0, 'the transport prefers the async bridge');
ok(esp.indexOf('timed out after') >= 0, 'every request has a timeout');
ok(aiRaw.indexOf('timeout: 300000') >= 0,
   'the Claude call gets a budget bigger than the 60s default');
ok(rec.indexOf('setInterval') >= 0,
   'a long sync shows elapsed seconds (only possible with a non-blocking bridge)');

/* ---- v2.1 ---- */
ok(aiRaw.indexOf('stream: true') >= 0,
   'the Claude call streams (a silent minute-long connection dies on cellular)');
ok(aiRaw.indexOf('raw: true') >= 0, 'the streamed body is not run through JSON.parse');
ok(esp.indexOf('raw ? joined : JSON.parse') >= 0, 'the transport supports raw bodies');
ok(nb.indexOf('end of stream') >= 0 && nb.indexOf('fetchOnce') >= 0,
   'a POST that read nothing is retried once');
ok(nb.indexOf('"Connection", "close"') >= 0,
   'POST does not reuse a pooled socket');
var pr = fs.readFileSync('app/assets/projections.js', 'utf8');
ok(pr.indexOf("name: 'week filter'") >= 0,
   'projections ask for a specific scoring period first');
ok(pr.indexOf('GOOD_ENOUGH') >= 0 && pr.indexOf('got.weekly > best.weekly') >= 0,
   'routes are judged on weekly coverage, not on merely answering');
ok(pr.indexOf('function missing') >= 0, 'unmatched players can be listed');
ok(rec.indexOf('Projections.missing') >= 0,
   'the advice screen names anyone with no week projection');

/* ---- v2.2: the spend meter ---- */
var us = fs.readFileSync('app/assets/usage.js', 'utf8');
ok(us.indexOf('server_tool_use') >= 0, 'web searches are priced, not just tokens');
ok(us.indexOf('cache_read_input_tokens') >= 0, 'cached tokens are priced at their own rate');
ok(aiRaw.indexOf('mergeUsage') >= 0,
   'streamed usage is merged, or the meter would lose the input tokens');
ok(aiRaw.indexOf("Usage.record('advice sync'") >= 0, 'every sync is recorded');
ok(uiRaw.indexOf('function usageCard') >= 0, 'the Data tab shows the meter');
ok(uiRaw.indexOf('THIS APP ONLY') >= 0,
   'the meter states plainly that it cannot see the real balance');
ok(html.indexOf('usage.js') < html.indexOf('ai.js'),
   'usage.js loads before the code that records into it');

ok(fs.existsSync('VERSION'), 'VERSION exists');
ok(/^\d+\.\d+$/.test(fs.readFileSync('VERSION','utf8').trim()),
   'VERSION is a plain number');

/* strip comments and strings first — an earlier version of this check flagged
   its own explanatory comment, the same way the ES2018 guard once did */
var uij = uiRaw
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
  .replace(/'(?:\\.|[^'\\])*'/g, "''")
  .replace(/"(?:\\.|[^"\\])*"/g, '""');
ok(!/[^.\w]alert\s*\(/.test(uij), 'no alert() — it renders as an ugly file:// dialog');
ok(uij.indexOf('function modal') >= 0, 'an in-app modal replaces it');

/* ---- v2.7: the two name normalisers must stay identical -----------------
 * Alerts.java matches starter names against ESPN's injury feed with its own
 * copy of Espn.normName, because the alarm runs with no WebView. If one side
 * is ever changed alone, a starter who is OUT quietly fails to match and the
 * one alert that exists to catch exactly that says nothing. This asserts the
 * pieces of the transformation are present on both sides. */
var jsNorm = fs.readFileSync('app/assets/espn.js', 'utf8');
jsNorm = jsNorm.slice(jsNorm.indexOf('function normName'));
jsNorm = jsNorm.slice(0, jsNorm.indexOf('}') + 1);
var javaNorm = fs.existsSync('android/src/com/tj/fftracker/Alerts.java')
  ? fs.readFileSync('android/src/com/tj/fftracker/Alerts.java', 'utf8') : '';
javaNorm = javaNorm.slice(javaNorm.indexOf('static String norm'));
javaNorm = javaNorm.slice(0, javaNorm.indexOf('\n  }'));
ok(/toLowerCase/.test(jsNorm) && /toLowerCase/.test(javaNorm),
   'both name normalisers lower-case');
ok(/jr\|sr\|ii\|iii\|iv\|v/.test(jsNorm) && /jr\|sr\|ii\|iii\|iv\|v/.test(javaNorm),
   'both strip the same name suffixes');
ok(/\[\.'`\]/.test(jsNorm) && /\[\.\\?'`\]/.test(javaNorm),
   'both strip the same punctuation');
ok(/replace\(\/-\//.test(jsNorm) && /replace\('-'/.test(javaNorm),
   'both turn a hyphen into a space');

/* ---- v3.1: the dropdown scroll jump must stay fixed ------------------------
   The bug was that render() restored scrollMem[view], which only the tab
   handler ever writes, so any select-driven re-render snapped to the top.
   These assertions pin the shape of the fix, not its wording. */
var uiRaw = fs.readFileSync('app/assets/ui.js', 'utf8');
ok(/var\s+atEntry\s*=\s*curScroll\(\)/.test(uiRaw),
   'render() captures the scroll position it started at');
ok(/view\s*!==\s*lastView/.test(uiRaw),
   'render() distinguishes a tab switch from a same-view repaint');
ok(/else\s+y\s*=\s*atEntry/.test(uiRaw),
   'a same-view repaint stays where the user was');
ok(!/window\.setTimeout\(function \(\) \{ window\.scrollTo\(0, y\); \}, 0\);/.test(uiRaw),
   'the old unconditional scroll-to-remembered-position is gone');
ok(/data-fk/.test(uiRaw), 'controls carry a stable identity for focus restore');
ok(/preventScroll/.test(uiRaw), 'focus is restored without scrolling to it');
ok(/function renderTop/.test(uiRaw),
   'there is still an explicit way to go back to the top');

/* ---- v3.1: the bottom tabs are a real touch target ---------------------- */
var css3 = fs.readFileSync('app/assets/app.css', 'utf8');
var mh = /--tab-h:(\d+)px/.exec(css3);
ok(!!mh && Number(mh[1]) >= 72,
   'the tab height is at least 72px (got ' + (mh ? mh[1] : 'none') + ')');
ok(/\.tab\{[^}]*min-height:var\(--tab-h\)/.test(css3),
   'and .tab takes its height from that variable rather than repeating it');
var dot = /\.tab \.dot\{font-size:(\d+)px/.exec(css3);
ok(!!dot && Number(dot[1]) >= 22, 'the tab icon is at least 22px');

/* THESE TWO USED TO ASSERT THE BUG.
 * The old rule was `body padding >= min-height + 24`, which does not describe
 * anything real: the bar is --tab-h plus its 1px border, so demanding 24px MORE
 * than that was demanding a dead band above it. body reserved a literal 124px
 * for an 89px bar and the test called it correct, because the test had been
 * written to match the number rather than the bar. Both now have to DERIVE from
 * --tabh, so they cannot disagree with the bar or with each other. */
ok(/--tabh:calc\(var\(--tab-h\) \+ 1px \+ var\(--ins-bot\) \+ var\(--adj-bot\)\)/.test(css3),
   '--tabh is the real bar height: the tab, its border, and both insets');
ok(/body\{padding-bottom:calc\(var\(--tabh\)/.test(css3),
   'body reserves exactly the bar, derived  <-- not a literal that drifts');
ok(/\.toast\{[^}]*bottom:calc\(var\(--tabh\)/.test(css3),
   'the toast clears the bar from the same source');
ok(!/124px/.test(css3.replace(/\/\*[\s\S]*?\*\//g, '')),
   'the stale 124px is gone from the CSS (the comment explaining it may stay)');

/* ---- 2026-09-08: the Live tab before kickoff ----------------------------- */
(function () {
  var raw = fs.readFileSync('app/assets/ui.js', 'utf8');
  var code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  /* Tapping a player before the week is synced used to toast "no stats synced"
     and stop there — a dead end on the screen he uses most, at the time he uses
     it most. The app already had the projection, the kickoff, the injury note
     and Claude's read; none of it was reachable. */
  ok(/function showPlayerPreGame/.test(code),
     'there is a pre-game card for a player with no stat line yet');
  ok(/if \(!line\) \{ showPlayerPreGame\(rec\); return; \}/.test(code),
     'and showPlayer uses it instead of a dead-end toast  <-- the reported dead end');
  ok(!/no stats synced for week/.test(code),
     'the dead-end toast is gone');
  var pg = code.slice(code.indexOf('function showPlayerPreGame'), code.indexOf('function showPlayer(pid)'));
  ok(/Schedule\.badge/.test(pg), 'the pre-game card says when he plays');
  ok(/row\.h && row\.h\.label/.test(pg), 'and carries the injury feed line');
  ok(/row\.ai && row\.ai\.reason/.test(pg), "and Claude's read when there is one");

  /* "TO PLAY" next to "Sun 4:05p" is noise, and .row .nm ellipsises the NAME to
     make room for it. The badge says the same thing and says when. */
  ok(/!x\.played && !gb0/.test(code),
     'the "to play" tag is suppressed when a kickoff badge already says so');
}());

/* ---- v3.3: the model picker ---------------------------------------------- */
var aiRaw2 = fs.readFileSync('app/assets/ai.js', 'utf8');
var uiRaw2 = fs.readFileSync('app/assets/ui.js', 'utf8');
ok(/v1\/models\?limit=1000/.test(aiRaw2), 'the model list is fetched from the documented endpoint');
ok(/anthropic-version/.test(aiRaw2), 'the model list call sends anthropic-version');
ok(/aiModelList/.test(aiRaw2), 'the fetched list is cached so the picker works offline');
ok(/function cachedModels/.test(aiRaw2), 'there is a cached-list accessor with a built-in fallback');
ok(/function cheapModel/.test(aiRaw2), 'the routine model is a setting, not a constant');
ok(!/model: depth\(\) === 'cheap' \? cheapModel\(\) : model\(\),\s*\n\s*max_tokens: 700/.test(aiRaw2),
   'the recap no longer burns the top model on 120 words of banter');
ok(/function modelPicker/.test(uiRaw2), 'the UI builds the picker from one function, not two copies');
ok(/__custom__/.test(uiRaw2), 'a Custom entry keeps a model newer than the cache reachable');
ok(!/minp\.placeholder = Ai\.DEFAULT_MODEL/.test(uiRaw2), 'the free-text model box is gone');
ok(/aiCheapModel/.test(uiRaw2), 'both models are pickable');


/* ---- v3.6: the review-pass fixes must stay fixed ------------------------- */
var uiR = fs.readFileSync('app/assets/ui.js', 'utf8');
var stR = fs.readFileSync('app/assets/store.js', 'utf8');
var vaR = fs.readFileSync('app/assets/value.js', 'utf8');
var siR = fs.readFileSync('app/assets/sim.js', 'utf8');
var aiR2 = fs.readFileSync('app/assets/ai.js', 'utf8');
ok(/keepAdj\[pid\]/.test(uiR),
   'a hand-entered adjustment survives a sync (the live poll wiped it every 45s)');
/* This regex alone passed for a long time while `keepAdj` was never
   DECLARED — the usage site above matched, so every sync threw a
   ReferenceError on the first player, and the test still went green. A
   pattern check on the read site without one on the write site is the same
   hole the v3.10 review already burned once. */
ok(/var keepAdj = \{\}/.test(uiR),
   'keepAdj is actually declared — fixes a ReferenceError that crashed every sync');
ok(/S\.settings\.pidHigh/.test(stR),
   'player ids come from a persisted high-water mark, so a dropped id is never reused');
ok(/_pidIndex/.test(stR), 'playerById is an index, not a scan of a freshly built array');
ok(/function bumpGen/.test(stR) && /bumpGen\(\);/.test(stR), 'the index is invalidated on save');
ok(/generation: function/.test(stR), 'the store exposes a generation for downstream caches');
ok(/_faMemo/.test(vaR), 'the 785-player free-agent scan is memoised per week and generation');
ok(/Object\.defineProperty\(r, 'usage'/.test(vaR), 'usage strings are built lazily');
ok(/var from = Math\.max\(1, Number\(week\)/.test(vaR),
   'weeksLeft counts from the current week, not from week 1');
ok(/root\.Store\.weekIsScored\(wi\)/.test(siR),
   'the season simulation rebuilds base points from scored weeks only');
ok(/raw: true/.test(aiR2.slice(aiR2.indexOf('MODELS_API'), aiR2.indexOf('function headers'))),
   'the model list is fetched raw, or JSON.parse gets an object and always throws');
ok(/Object\.keys\(prevOpp\)\.length/.test(uiR),
   'an empty opponents map no longer freezes out the good one');
ok(/jobStart\('waivers'/.test(uiR), 'the waiver job passes both arguments');
ok(/cached\.spent\.cost/.test(uiR), 'the waiver cost line reads the field Usage returns');
ok(/replace\(\/&\/g, '&amp;'\)/.test(uiR), 'esc() actually escapes');
var invs = (uiR.match(/Sim\.invalidate\(\)/g) || []).length;
ok(invs >= 5, 'every lineup-mutating path invalidates the sim cache (' + invs + ' sites)');

/* ---- and the trap that hid all of the above ------------------------------
 * Three blocks of assertions were appended BELOW process.exit and never ran.
 * Every one of them passed the moment it was moved, so nothing was actually
 * broken — but a test file that silently stops testing is precisely the
 * failure v3.0 exists to prevent, one layer up. */
(function () {
  var files = ['tools/test_boot.js', 'tools/test_engine.js'], i;
  for (i = 0; i < files.length; i++) {
    var src = fs.readFileSync(files[i], 'utf8');
    /* built, not written literally, or indexOf finds THIS line first */
    var needle = 'process' + '.exit(';
    var at = src.indexOf(needle);
    if (at < 0) continue;
    var after = src.slice(src.indexOf('\n', at) + 1);
    ok(!/\bok\s*\(/.test(after),
       files[i] + ' has no assertions stranded below process.exit');
  }
}());


/* ---- v3.7: no browser dialogs anywhere, and import cannot clobber --------- */
var uiD = fs.readFileSync('app/assets/ui.js', 'utf8');
var stD = fs.readFileSync('app/assets/store.js', 'utf8');
/* strip comments before checking, so describing the ban does not trip it */
var uiCode = uiD.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(!/(^|[^.\w])confirm\s*\(/.test(uiCode), 'no confirm() — it renders as a file:// dialog');
ok(!/(^|[^.\w])prompt\s*\(/.test(uiCode), 'no prompt() — it truncates and cannot be pasted into');
ok(/function confirmModal/.test(uiD) && /function textModal/.test(uiD),
   'real in-app dialogs replace both');
ok(/textModal\('Copy this backup'/.test(uiD),
   'the export path uses a textarea, not a single-line field that truncates');
ok(/textModal\('Import a backup'/.test(uiD), 'the import path takes a paste properly');
ok(/throw new Error\('no league settings in that file'\)/.test(stD),
   'importJSON validates the league block before touching live state');
/* Was a grep for the exact call sequence, which broke in v4.7 when
   markArchive() joined it — while the property being asserted (validate
   first, swap last) was untouched. Locate the swap itself instead. */
ok(/\n\s*S = o;/.test(stD) && stD.search(/\n\s*S = o;/) > stD.indexOf('is malformed'),
   'the swap happens AFTER every check, so a bad backup cannot clobber the season');
ok(stD.indexOf('if (!o.settings.aiKey && cur.aiKey)') >= 0,
   'restoring a backup does not wipe the API key it no longer carries');
ok(/S\.settings\.aiKey = ''/.test(stD) && stD.indexOf('function exportJSON') >= 0,
   'the exported backup is redacted — the key never reaches Downloads');
ok(/o\.settings\[k\] === undefined/.test(stD),
   'an old backup is migrated onto the candidate, not onto the live state');
ok(/textarea\{/.test(fs.readFileSync('app/assets/app.css', 'utf8')),
   'the textarea is styled to match the app');


/* ---- v3.8: the hot paths ------------------------------------------------- */
var scH = fs.readFileSync('app/assets/scoring.js', 'utf8');
var reH = fs.readFileSync('app/assets/recommend.js', 'utf8');
var siH = fs.readFileSync('app/assets/sim.js', 'utf8');
var uiH = fs.readFileSync('app/assets/ui.js', 'utf8');
var rcH = fs.readFileSync('app/assets/recap.js', 'utf8');
ok(/L\.__sc && L\.__scSig === sig/.test(scH), 'score() is memoised on the line object');
ok(/enumerable: false/.test(scH), 'the score cache is non-enumerable so it never lands in a save');
ok(/function memoSig/.test(scH),
   'the memo signature covers manualAdj and the weekly bonus flags, the only fields edited later');
ok(!/function scoreTotal/.test(scH),
   'there is still exactly ONE implementation of the scoring engine');
ok(/_dpMemo/.test(reH), 'defenseProfile is memoised — it was recomputed once per team for one answer');
ok(/function sigmaFor/.test(siH), 'the lognormal sigma is cached instead of recomputed 80k times');
ok(/function owners\(\)/.test(uiH), 'roster search builds an owner index instead of re-normalising per hit');
ok(/function text\(week, prebuilt\)/.test(rcH), 'Recap.text accepts a prebuilt recap');
ok(/hoisted/.test(rcH), 'slotKeys is hoisted out of the per-team loop');
/* the three assertions this replaced ('the recap card reuses the object it
   already built', 'bench regret does not re-scan...', 'the played-weeks
   count is computed once...') checked hot-path patterns INSIDE recapCard and
   viewLeague/viewStandings. v4.8 deleted those screens outright (Tj: "get
   rid of the table and league sections entirely... delete the tabs and
   everything inside") — there is no longer a hot path there to regress, so
   asserting the pattern still exists in ui.js would just be asserting dead
   code was not deleted. Recap.text and recap.js's own hot paths (checked
   above) are unaffected: Recap.generateSchedule on the Data tab still calls
   them. */


/* ---- v3.10: dead code gone, error paths closed --------------------------- */
var espnX = fs.readFileSync('app/assets/espn.js', 'utf8');
var storeX = fs.readFileSync('app/assets/store.js', 'utf8');
var recX = fs.readFileSync('app/assets/recommend.js', 'utf8');
var uiX = fs.readFileSync('app/assets/ui.js', 'utf8');
var usX = fs.readFileSync('app/assets/usage.js', 'utf8');
ok(!/res\.twoPts\.push/.test(espnX), 'the write-only twoPts collector is gone');
/* the review called bookNames() dead. It is not — tools/test_engine.js calls
   it, which is the kind of caller a grep over app/assets/ does not see. It was
   removed, the engine suite went red, and it went back. */
ok(/function bookNames/.test(storeX), 'bookNames() is KEPT — the test suite is its caller');
ok(/NOT dead code/.test(storeX), 'and it is commented so it is not deleted again');
ok(!/ladder step 8/.test(uiX), 'the "not built yet" advice placeholder is gone');
ok(/function priceOf\(u\)/.test(usX) && /var r = rates\(\);/.test(usX),
   'priceOf drops the parameter nobody passed and declares its rates locally');

ok(/opponentsForWeek\(week\)\['catch'\]/.test(recX),
   'a failed schedule no longer abandons the injury feed, projections and Claude');
ok(/schedule FAILED/.test(recX), 'and it says so in the report rather than vanishing');
var alertsGuarded = /try \{\s*ok = Native\.alertsSet/.test(uiX) &&
                    /try \{ r = Native\.alertsTest\(\); \}/.test(uiX);
ok(alertsGuarded, 'both raw alerts bridge calls are wrapped, like alertsStatus already was');

/* every promise chain started from a click must land somewhere */
var chains = (uiX.match(/\.then\(/g) || []).length;
var catches = (uiX.match(/\['catch'\]\(|\.catch\(/g) || []).length;
ok(catches >= 8, 'the UI attaches catch handlers to its promise chains (' + catches +
   ' catches for ' + chains + ' thens)');


/* ---- v4.1: player identity ------------------------------------------------ */
var idxH = fs.readFileSync('app/assets/index.html', 'utf8');
var nmH = fs.readFileSync('app/assets/names.js', 'utf8');
var vlH = fs.readFileSync('app/assets/value.js', 'utf8');
var uiN = fs.readFileSync('app/assets/ui.js', 'utf8');
var pdH = fs.readFileSync('app/assets/playerdb.js', 'utf8');
ok(idxH.indexOf('names.js') > idxH.indexOf('espn.js') &&
   idxH.indexOf('names.js') < idxH.indexOf('store.js'),
   'names.js loads after espn.js and before everything that matches identities');
ok(/Names\.variants\(pl\.name\)/.test(uiN),
   'the weekly sync indexes rosters by every spelling, so a box score under a nickname still scores');
ok(/root\.Names\.variants\(pl\.name\)/.test(vlH),
   'the free-agent wire excludes a rostered player under any spelling');
ok(/root\.Names\.canon\(p\.n\)/.test(vlH), 'and the database side is canonicalised too');
ok(/function dedupe/.test(pdH), 'PlayerDB collapses two entries that are one man');
ok(/dupes: d\.dupes/.test(pdH), 'and the conflict is reported rather than resolved silently');
ok(/Duplicate players merged/.test(uiN), 'the Data screen says when a merge happened');
ok(!/Espn\.normName\(p\.name\)\] = \{/.test(fs.readFileSync('app/assets/ai.js', 'utf8')),
   'the AI availability index uses the canonical key, not the raw name');
ok(/wrong merge is far more/.test(nmH),
   'names.js records WHY the obvious same-team rule was rejected');

/* ---- the score-input width actually wins its specificity fight ----------
 * `.scoreInput{width:76px}` used to lose outright to the base
 * `input[type=number]{width:100%}` rule — an attribute selector plus the
 * element itself outweighs a bare class, (0,1,1) beats (0,1,0), no matter
 * which rule is later in the file. The Data tab's score box rendered
 * full-width and squeezed the team-name label next to it to nothing. A
 * source-text check for ".scoreInput" existing would have stayed green
 * through that whole bug — it only proves the selector is spelled somewhere,
 * not that it wins. This computes real CSS specificity for both rules and
 * checks the actual outcome: equal-or-higher specificity, and (for an exact
 * tie) declared later in the file, which is what actually decides a tie. */
(function () {
  /* comments stripped first — the fix's own comment quotes the old,
     buggy selector as an example, which would otherwise be the first
     ".scoreInput{" match in the file */
  var css = fs.readFileSync('app/assets/app.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  function specificity(sel) {
    var ids = (sel.match(/#[\w-]+/g) || []).length;
    var classesEtc = (sel.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length;
    var elements = (sel.match(/(^|[\s,>+~])[a-zA-Z][\w-]*/g) || []).length;
    return [ids, classesEtc, elements];
  }
  function cmp(a, b) {
    for (var i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] - b[i]; }
    return 0;
  }
  var braceIdx = css.indexOf('.scoreInput{');
  ok(braceIdx >= 0, '.scoreInput exists in app.css');
  /* the actual selector text, not just the class name — everything between
     the PREVIOUS rule's closing brace and this rule's opening brace, so a
     selector spelled "input.scoreInput" is captured whole rather than just
     the ".scoreInput" tail of it */
  var openBrace = css.indexOf('{', braceIdx);
  var selStart = css.lastIndexOf('}', braceIdx) + 1;
  var scoreSelector = css.slice(selStart, openBrace).trim();
  var baseSelector = 'input[type=number]';
  var baseSpec = specificity(baseSelector);
  var scoreSpec = specificity(scoreSelector);
  ok(cmp(scoreSpec, baseSpec) >= 0,
     '"' + scoreSelector + '" specificity (' + scoreSpec + ') is not lower than "' + baseSelector +
     '"\'s (' + baseSpec + ')  <-- (0,1,0) < (0,1,1) was exactly the bug: 76px never applied');
  if (cmp(scoreSpec, baseSpec) === 0) {
    ok(css.indexOf(baseSelector) < braceIdx,
       'and on an exact specificity tie, "' + scoreSelector + '" is declared LATER, which is what wins it');
  }
}());

console.log(f ? ('  ' + f + ' boot check(s) FAILED') : '  boot checks pass');
process.exit(f ? 1 : 0);
