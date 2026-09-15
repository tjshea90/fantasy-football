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
/* 2026-09-15e sweep: NativeBridge's 3-thread pool is plain (non-daemon)
 * threads that would keep the process alive past the Activity, and every
 * queued/in-flight Runnable holds a reference to `web`, which onDestroy()
 * tears down and nulls — so the bridge must be shut down before that happens,
 * not left to the process teardown to sort out. */
ok(/private NativeBridge bridge;/.test(mj), 'the bridge is kept as a field so onDestroy can reach it');
ok(/bridge = new NativeBridge\(this\);/.test(mj) && !/NativeBridge bridge = new NativeBridge/.test(mj),
   'onCreate assigns the field instead of shadowing it with a local');
ok(/if \(bridge != null\) \{\s*try \{ bridge\.shutdown\(\); \}/.test(mj),
   'onDestroy shuts the pool down before the WebView (and its bridge reference) is torn down');
var css = fs.readFileSync('app/assets/app.css', 'utf8');
ok(css.indexOf('--ins-top') >= 0 && css.indexOf('--adj-top') >= 0, 'CSS has inset and manual-adjust variables');
ok(html.indexOf('__setInsets') >= 0 && html.indexOf('__setAdjust') >= 0, 'page exposes both inset hooks');
var nb = fs.readFileSync('android/src/com/tj/fftracker/NativeBridge.java', 'utf8');
ok(nb.indexOf('.bak') >= 0, 'saves keep a .bak fallback');
/* v6.4 (2026-09-15e sweep): load() used to fall back to .bak only on a
 * missing/empty main file (`s == null || s.length() < 2`) — a READABLE but
 * CORRUPTED file (truncated write, bit-rot) was returned as-is, and
 * store.js's own JSON.parse failure then silently reset a whole season to
 * the bundled seed instead of using the intact .bak right next to it. No
 * JUnit exists in this hand-rolled build (confirmed: no *.java test file
 * anywhere in the repo), so this is pinned as source text the same way the
 * rest of this file does for Java, backed by `bash build.sh`'s real
 * compile as the correctness check a unit test would otherwise be. */
ok(!/if \(s == null \|\| s\.length\(\) < 2\) s = readFile/.test(nb),
   'load() no longer uses the length-only check that skipped .bak for a readable-but-corrupted file');
ok(/private boolean looksLikeJson\(String s\)/.test(nb) && /new org\.json\.JSONTokener\(s\)\.nextValue\(\)/.test(nb),
   'load() now validates the main file is actually parseable JSON before accepting it over .bak');
ok(nb.indexOf('httpChunk') >= 0 && nb.indexOf('CHUNK_LIMIT') >= 0,
   'large HTTP bodies cross the bridge in chunks (ARI was too big in one piece)');
ok(nb.indexOf('ERRMARK') >= 0, 'network failures return a reason, not a silent null');
/* 2026-09-15e sweep: every FileOutputStream/InputStream opened by hand in
 * this file leaked its file descriptor on any exception mid-write (disk
 * full, I/O error) — save() runs on effectively every app-state write, so
 * under a sustained low-storage condition this was a real accumulating
 * leak, not a theoretical one. Try-with-resources guarantees close() even
 * when write()/sync() throws. Six sites total, two of them (export,
 * writeToDownloads) with a MediaStore branch and a legacy-file branch each. */
ok(/try \(InputStream in = new java\.io\.FileInputStream\(f\);\s*BufferedReader r = new BufferedReader/.test(nb),
   "readFile()'s stream and reader are both closed via try-with-resources");
ok((nb.match(/try \(FileOutputStream o = new FileOutputStream\(tmp\)\)/g) || []).length >= 2,
   'save() and backupAuto() both open their FileOutputStream via try-with-resources');
ok((nb.match(/try \(OutputStream oo = o\) \{ oo\.write\(data\.getBytes\("UTF-8"\)\); \}/g) || []).length === 2,
   "export()'s and writeToDownloads()'s MediaStore branches both close via try-with-resources");
ok((nb.match(/try \(FileOutputStream o = new FileOutputStream\(d\)\)/g) || []).length === 2,
   "export()'s and writeToDownloads()'s legacy-file branches both close via try-with-resources");
var alertsJ = fs.readFileSync('android/src/com/tj/fftracker/Alerts.java', 'utf8');
ok(/try \(BufferedReader r = new BufferedReader\(new InputStreamReader\(new FileInputStream\(f\), "UTF-8"\), 16384\)\)/.test(alertsJ),
   "Alerts.java's own independent readFile() duplicate got the same try-with-resources fix");
ok(/void shutdown\(\) \{\s*try \{ pool\.shutdownNow\(\); \}/.test(nb),
   'NativeBridge exposes a shutdown() that stops its pool (wired to onDestroy in MainActivity)');
/* small-fixes batch, 2026-09-15e sweep */
ok(!/public static void schedule\(Context ctx, int dayOfWeek/.test(alertsJ),
   'the dead schedule(dayOfWeek,...) method is gone — every real caller (rearm) only ever used scheduleDaily');
ok(/scheduleDaily\(ctx, h, m, 0\)/.test(alertsJ), 'scheduleDaily is still there doing the real work');
ok(/if \(me\.isEmpty\(\)\) return "";/.test(alertsJ),
   'check() bails out on an empty league.me instead of letting it fall through to the team-match loop');
ok(/return \(r\.equals\("\."\) \|\| r\.equals\("\.\."\)\) \? "_" : r;/.test(nb),
   "safe() rejects a bare '.' or '..' result outright, not just relying on slash-stripping and readFile's own directory failure");
ok(!/Shown at the top of Live, Lineups and Advice/.test(ui),
   'the earlyGameCard comment no longer claims a Live call site that never existed');
ok(/var viewBtn = el\('button', 'btn pri', 'View stats'\);/.test(ui) &&
   !/var view = el\('button', 'btn pri', 'View stats'\);/.test(ui),
   'openPlayerStatsMenu no longer shadows the file-level `view` (current tab) with a local button variable');
/* doSync() already render()s on both its success and catch path (see its
   own end) — the pull-to-refresh default branch used to wrap it in a
   SECOND .then(render)/.catch(render), rendering the whole page twice on
   every pull on every tab but Advice and Stats. */
ok(/return doSync\(\{ quiet: false \}\);/.test(ui) &&
   !/p\.then\(function \(\) \{ render\(\); \}, function \(\) \{ render\(\); \}\)/.test(ui),
   'pull-to-refresh no longer renders the page a second time on top of doSync\'s own render');
/* the long-press click-suppression window used to swallow ANY click
   anywhere in the document for 400ms, including taps on the Cancel/View
   buttons of the dialog it had just opened (a different DOM subtree, not
   the long-pressed row) — scoped to clicks on the same row instead. */
ok(/lpSuppressRow = row;/.test(ui) &&
   /findPlayerRow\(e\.target\) === lpSuppressRow/.test(ui),
   'long-press click suppression is scoped to the row that triggered it, not every click on the page');
/* freshenInjuries had no .catch — an async rejection (offline, a bad feed)
   from Recommend.loadNews went unhandled every failed tick, unlike every
   other network call on the same live-poll chain right below it. */
ok(/Recommend\.loadNews\(null\)\.then\(function \(nc\) \{[\s\S]{0,80}\}\)\['catch'\]\(function \(\)/.test(ui),
   'freshenInjuries now catches a failed news fetch instead of leaving it unhandled');
/* the Advice and Wire tabs' cost-estimate lines used to end differently for
   no reason — matched wording. (recommend.js's own source is loaded fresh
   here, not via the file-scoped `rec` — that is assigned further down this
   file, after this point runs.) */
ok(/on the Claude API, at current prices \(see Data → Claude costs\)\.'/
     .test(fs.readFileSync('app/assets/recommend.js', 'utf8')) &&
   /on the Claude API, at current prices \(see Data → Claude costs\)\.'/.test(ui),
   'the Advice and Wire cost-estimate lines share the same closing wording now');
/* doSync (ui.js) feeds gamelog.js's persistent any-player cache from its own
   already-fetched box score, so a later game-log browse for a team synced
   this session is never a second Espn.gameStats call — see
   tools/test_gamelog.js for the functional proof (ingestEvent). */
ok(/if \(window\.Gamelog\) \{ try \{ Gamelog\.ingestEvent\(week, g, r\); \} catch \(e\) \{ \} \}/.test(ui),
   'doSync feeds each fetched box score into gamelog.js\'s cache too, not just its own gcache');
var glX = fs.readFileSync('app/assets/gamelog.js', 'utf8');
ok(/function ingestEvent\(week, game, r\)/.test(glX) && /ingestEvent: ingestEvent/.test(glX),
   'gamelog.js exports ingestEvent as the shared write path ensureEvent uses internally too');
/* the old catch-block comment here claimed "onKeyDown is still there" as a
 * fallback if callback registration ever throws — false per Android's own
 * predictive-back docs once enableOnBackInvokedCallback=true is set
 * (unconditional in this manifest): KEYCODE_BACK interception is simply not
 * supported any more in that mode, registration success or not. Pinned so a
 * future edit does not quietly reintroduce the same false reassurance. */
ok(!/an OEM shell missing the platform API: onKeyDown is still there/.test(mj),
   'the misleading "onKeyDown is still there" fallback claim is gone');
ok(/registerOnBackInvokedCallback failed/.test(mj),
   'a registration failure is now logged instead of silently swallowed');
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
/* 2026-09-15e sweep: both real tool calls now pick their web_search version
 * per model via searchToolType() rather than a single hardcoded string — see
 * tools/test_integration.js §23 for the actual classification behaviour.
 * web_search_20250305 must still appear as searchToolType's safe fallback
 * (Haiku 4.5, and anything unrecognised), so "Claude is given web search"
 * still holds either way. */
ok(aiRaw.indexOf('web_search_20250305') >= 0, 'Claude is given web search');
ok(/function searchToolType\(mdl\)/.test(aiRaw) &&
   (aiRaw.match(/tools: \[\{ type: searchToolType\(mdl\)/g) || []).length === 2,
   'both real calls (advice, waivers) pick their web_search tool version per model, not a hardcoded one');
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
/* 2026-09-15e sweep: priceOf grew a real second parameter (model) so it can
 * price a call at the tier it actually ran on, superseding the older pin
 * that asserted no second parameter at all — that pin was about a dead,
 * never-passed `r` argument (v3.10), not a promise the signature would never
 * grow a meaningful one. */
ok(/function priceOf\(u, model\)/.test(usX) && /var r = rates\(model\);/.test(usX),
   'priceOf prices a call using the rate tier of the model that actually ran it');
ok(/var RATE_TIERS = \{/.test(usX) && /opus:\s*\{ inPerM: 5\.00/.test(usX) &&
   /haiku:\s*\{ inPerM: 1\.00/.test(usX),
   'usage.js prices Opus/Sonnet/Haiku calls at their own published rates, not one flat table');
ok(/function tierFor\(model\)/.test(usX), 'the tier is chosen from the model string, not assumed');

ok(/opponentsForWeek\(week\)\['catch'\]/.test(recX),
   'a failed schedule no longer abandons the injury feed, projections and Claude');
ok(/schedule FAILED/.test(recX), 'and it says so in the report rather than vanishing');
ok(/Espn\.weekGames\(S\.settings\.season, week, week > 18 \? 3 : 2\)/.test(recX),
   "opponentsForWeek uses the same week>18?3:2 seasontype pattern every other weekGames call site does");
var alertsGuarded = /try \{\s*ok = Native\.alertsSet/.test(uiX) &&
                    /try \{ Native\.alertsTest\(\); \}/.test(uiX);
ok(alertsGuarded, 'both raw alerts bridge calls are wrapped, like alertsStatus already was');
/* alertsTest() went async in the 2026-09-15e sweep — it used to make a
 * SYNCHRONOUS network call on the Java side (Alerts.check -> injuries() ->
 * a blocking HttpURLConnection, up to a 13s worst-case timeout) from a
 * @JavascriptInterface method, which blocks the calling JS thread for
 * exactly that long — the one failure this file's own httpAsync
 * architecture exists to prevent, reintroduced in a different method. */
ok(!/var r;\s*try \{ r = Native\.alertsTest/.test(uiX),
   'the old synchronous "r = Native.alertsTest()" call is gone — it used to freeze the page for up to 13s');
ok(/window\.__alertsTestDone = function \(r\) \{/.test(uiX),
   'the button now waits on a callback the way every other async bridge call in this app does');
var nbJ = fs.readFileSync('android/src/com/tj/fftracker/NativeBridge.java', 'utf8');
ok(/public void alertsTest\(\)/.test(nbJ) && !/public String alertsTest\(\)/.test(nbJ),
   'alertsTest() no longer returns a value synchronously on the Java side either');
ok(/pool\.execute\(new Runnable\(\) \{ public void run\(\) \{[\s\S]{0,50}String result;/.test(nbJ),
   'the real check now runs on the existing pool, not on the calling (JS-interface) thread');

/* every promise chain started from a click must land somewhere */
var chains = (uiX.match(/\.then\(/g) || []).length;
var catches = (uiX.match(/\['catch'\]\(|\.catch\(/g) || []).length;
ok(catches >= 8, 'the UI attaches catch handlers to its promise chains (' + catches +
   ' catches for ' + chains + ' thens)');

/* ---- v5.5b: the injury feed can no longer be shown as if it were current
 * when it is not -- Tj's screenshot, 2026-09-14, was a week-old ESPN note
 * with nothing on screen admitting it, because nothing on the Wire tab could
 * refresh the feed. Two things now fixed and pinned here: the card SAYS how
 * old its data is, and "Ask Claude about the wire" refreshes it FIRST. */
ok(/newsCache:\s*function \(\) \{ return newsCache; \}/.test(recX),
   'recommend.js exposes the injury feed for freshness reporting, same pattern as aiCache');
ok(/Recommend\.newsCache\(\)/.test(uiX), 'the roster-injuries card reads it');
ok(/Sync injury feed/.test(uiX), 'and offers its own sync button, no API key required');
var wsyncBlock = uiX.slice(uiX.indexOf("wsync.addEventListener('click'"));
var loadNewsAt = wsyncBlock.indexOf('Recommend.loadNews(');
var waiverCtxAt = wsyncBlock.indexOf('Value.waiverContext(');
ok(loadNewsAt >= 0 && waiverCtxAt > loadNewsAt,
   '"Ask Claude about the wire" refreshes the injury feed BEFORE building the ' +
   'context Claude reasons over, not after  <-- a paid call must not reason from stale facts');
ok(/force:\s*true/.test(wsyncBlock.slice(loadNewsAt, loadNewsAt + 120)),
   'the refresh is forced -- it does not silently reuse a possibly days-old cache');
/* the mixed text+tag-span nowrap layout that actually produced the garbled,
   mid-word-cut screenshot must not still be there for the injury note */
var injuryCardBlock = uiX.slice(uiX.indexOf('function rosterInjuryCard'),
                                 uiX.indexOf('function freeAgentCard'));
ok(!/x\.note \? ' — ' \+ x\.note/.test(injuryCardBlock),
   'the injury note is no longer crammed into the row\'s own nowrap <small>  <-- the reported bug');
ok(/nk\.appendChild\(el\('span', null, x\.note\)\)/.test(injuryCardBlock),
   'it is a sibling .kv line instead, which wraps properly (verified by rendering it, not just asserted)');


/* ---- v4.1: player identity ------------------------------------------------ */
var idxH = fs.readFileSync('app/assets/index.html', 'utf8');
var nmH = fs.readFileSync('app/assets/names.js', 'utf8');
var vlH = fs.readFileSync('app/assets/value.js', 'utf8');
var uiN = fs.readFileSync('app/assets/ui.js', 'utf8');
var pdH = fs.readFileSync('app/assets/playerdb.js', 'utf8');
var stH = fs.readFileSync('app/assets/stats.js', 'utf8');
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

/* ---- player database auto-refresh (item 7, 2026-09-15) ------------------
 * Tj: "make the app itself automatically refresh this data at least every
 * couple days and each time I refresh waiver wire information or anything
 * else that it is important to see all players." A full refresh() walks 32
 * ESPN team rosters with retry backoff and is far too slow to run in this
 * suite, so the staleness GATE (the part that decides whether to bother) is
 * exercised directly against a controllable fake disk, and the two things a
 * full run cannot cheaply prove — that a totally failed attempt no longer
 * masks itself as current, and that every call site is actually wired up —
 * are pinned as source-text checks, the same way the rest of this file
 * pins invariants a full execution would be too slow or too flaky for. */
(function () {
  var KEY = 'fftracker_playerdb_v1', disk = {};
  var g3 = {}; g3.window = g3;
  g3.localStorage = { getItem: function (k) { return disk[k] === undefined ? null : disk[k]; },
                       setItem: function (k, v) { disk[k] = String(v); },
                       removeItem: function (k) { delete disk[k]; } };
  new Function('window', pjs)(g3);
  new Function('window', fs.readFileSync('app/assets/playerdb.js', 'utf8'))(g3);

  g3.PlayerDB.init();
  ok(g3.PlayerDB.stale() === true, 'a never-refreshed database is stale');

  /* init() refuses a stored copy smaller than the bundled one ("a
   * half-finished refresh must never shrink the database"), so the fixture
   * must carry the full bundled roster, not a slice, or init() would
   * silently fall back to the bundled copy with updated:null and this test
   * would actually be checking the never-refreshed path by accident. */
  disk[KEY] = JSON.stringify({ version: 'espn-x', updated: new Date(Date.now() - 3600e3).toISOString(),
                                players: g3.PLAYERDB.players });
  g3.PlayerDB.init();
  ok(g3.PlayerDB.stale() === false, 'a database refreshed an hour ago is not stale');

  disk[KEY] = JSON.stringify({ version: 'espn-x', updated: new Date(Date.now() - 3 * 24 * 3600e3).toISOString(),
                                players: g3.PLAYERDB.players });
  g3.PlayerDB.init();
  ok(g3.PlayerDB.stale() === true, 'a database refreshed 3 days ago is stale again (the 2-day threshold)');
  ok(g3.PlayerDB.STALE_MS === 2 * 24 * 3600 * 1000, 'the threshold really is "at least every couple days"');
}());

/* ---- refresh()/ensureFresh() share ONE in-flight attempt (review finding,
 * 2026-09-15) -----------------------------------------------------------
 * The manual "Refresh from ESPN" button used to call the 32-team fetch
 * directly, bypassing ensureFresh()'s in-flight guard entirely — a tap
 * landing while a background auto-refresh was already running started a
 * SECOND concurrent fetch against the same shared PlayerDB.get().players
 * array, and each call snapshots its own dedupe key map at start, so a
 * player one call added after the other's snapshot was taken landed as a
 * duplicate entry. Fixed by giving refresh() itself the single-flight
 * guard, so ensureFresh() and a direct refresh() call always share the
 * same promise. This is fast enough to actually execute (unlike a fully
 * offline 32-team run, which retries each team through 350ms backoff
 * delays for tens of seconds): every team's FIRST candidate URL resolves
 * immediately with one fake player, so nothing ever falls into that retry
 * path at all. */
(function () {
  var g5 = {}; g5.window = g5;
  g5.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
  g5.Espn = {
    BASE: 'https://x',
    _httpGet: function (url) {
      return Promise.resolve({ athletes: [{ fullName: 'Player ' + url, position: { abbreviation: 'WR' } }] });
    }
  };
  new Function('window', pjs)(g5);
  new Function('window', fs.readFileSync('app/assets/playerdb.js', 'utf8'))(g5);
  g5.PlayerDB.init();

  /* Checked synchronously, by object identity, not by awaiting completion:
   * this file is synchronous top-to-bottom and quits via the process module
   * as its literal last statement, which runs the moment the script's own
   * body finishes — before Node would otherwise drain the microtask queue.
   * A dangling .then() here would silently never run, the same trap this
   * file caught once already above (see the ensureFresh() short-circuit
   * comment). The identity check needs no awaiting: three calls made back
   * to back, before any of them has had a chance to settle, sharing the
   * exact same promise object IS the proof that the second and third
   * attached to the first's in-flight attempt instead of starting new ones. */
  var p1 = g5.PlayerDB.refresh();
  var p2 = g5.PlayerDB.ensureFresh();
  var p3 = g5.PlayerDB.refresh();
  ok(p1 === p2 && p2 === p3,
     'refresh() and ensureFresh(), called back to back before either settles, share the exact same promise ' +
     '(a manual tap during a background refresh attaches to it instead of starting a second 32-team fetch)');
}());

/* ensureFresh()'s short-circuit ("do not even attempt a refresh unless
 * actually stale, and do not retry more than once per RETRY_COOLDOWN_MS even
 * while still stale") is checked as source text, not by calling it: a call
 * returns its promise synchronously either way (that is just how promises
 * work), so timing the call proves nothing — only awaiting the result would,
 * and this suite is synchronous and quits at its final statement the moment
 * the last top-level line finishes, before any dangling .then() could fire.
 * The real behaviour this guards — stale() itself — is exercised directly
 * above; the in-flight sharing is exercised directly above too; this just
 * pins that ensureFresh() actually consults stale() and the cooldown, in
 * that order, before ever calling refresh(). */
ok(/function ensureFresh\(onProgress\) \{\s*if \(inFlight\) return inFlight;\s*if \(!stale\(\)\) return Promise\.resolve\(null\);\s*if \(lastAttempt && \(Date\.now\(\) - lastAttempt\) < RETRY_COOLDOWN_MS\) return Promise\.resolve\(null\);\s*return refresh\(onProgress\);/
   .test(pdH),
   'ensureFresh() checks in-flight, then stale(), then the retry cooldown, before ever touching the network ' +
   '<-- without the cooldown, a phone offline on the Wire tab would retry a full 32-team fetch on every render, forever');
ok(/var RETRY_COOLDOWN_MS = 15 \* 60 \* 1000/.test(pdH), 'the retry cooldown really is a bounded, sane interval');

ok(/var ok = failed\.length < TEAMS\.length/.test(pdH) && /if \(ok\) \{/.test(pdH),
   'refresh() only stamps "updated" when at least one team actually came back  <-- ' +
   'otherwise a fully offline auto-refresh attempt would mark itself current and never retry');
ok(/function doRefresh\(onProgress\)/.test(pdH) && (pdH.match(/doRefresh\(onProgress\)/g) || []).length === 2,
   'doRefresh (the actual 32-team fetch) is named and called exactly once in the whole file — from refresh() ' +
   'itself, never directly — so there is only one path into it for the in-flight guard to protect');
ok(/function ensureFresh/.test(pdH) && /function stale\(\)/.test(pdH),
   'PlayerDB exposes the staleness gate the background refresh needs');
ok(/function refreshPlayerDBIfStale/.test(uiN), 'ui.js has one quiet background-refresh helper, not several ad-hoc calls');
ok(/refreshPlayerDBIfStale\(\);[\s\S]{0,40}syncCurrentWeek/.test(uiN),
   'boot() refreshes the player database quietly on cold start');
ok(/freshenSchedule\(\);\s*refreshPlayerDBIfStale\(\);\s*\/\* A week that is finished/.test(uiN),
   'appResume() refreshes it again on every resume, so a phone that is never rebooted still gets it');
ok(/function viewWire\(root\) \{[\s\S]{0,400}refreshPlayerDBIfStale\(\);/.test(uiN),
   'opening the Wire tab (the "see all players" screen) also nudges a stale database');
ok(/refreshPlayerDBIfStale\(\);[\s\S]{0,80}jobStart\('waivers'/.test(uiN),
   'pressing "Ask Claude about the wire" — the literal "refresh waiver wire information" action — does too');

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

/* ---- Live tab matchup: names must not truncate mid-word (2026-09-15e) ---
 * Found in the app-wide sweep: the Live tab's side-by-side matchup view
 * (.halfbox, half a 390px phone screen minus a slot column and a points
 * column) truncated real player names mid-word — "Jaylen Warr...", "Ka'imi
 * Fair...", "Baltimore ..." — confirmed with a live browser screenshot.
 * shortName() fixes it with the standard fantasy-app shorthand ("M.
 * Stafford"), used only in lineupDetail() (the Live tab's two-column view),
 * never elsewhere where there is room for a full name. Extracted and run
 * for real, not just pinned as source text — the function has no DOM or
 * other ui.js dependency, so it can be evaluated in isolation. */
(function () {
  var m = uiN.match(/function shortName\(name, pos\) \{[\s\S]*?\n  \}/);
  if (!m) { ok(false, 'shortName() exists in ui.js'); return; }
  var shortName = new Function('name', 'pos', m[0].replace(/^function shortName\(name, pos\) \{/, '').replace(/\}$/, ''));
  ok(shortName('Matthew Stafford') === 'M. Stafford', 'a two-word name shortens to "first initial. last"');
  ok(shortName('Ka\'imi Fairbairn') === 'K. Fairbairn', 'an apostrophe in the first name does not break it');
  ok(shortName('Amon-Ra St. Brown') === 'A. St. Brown', 'a multi-word LAST name is kept whole, only the first name is initialed');
  ok(shortName('Baltimore Ravens', 'DEF') === 'Baltimore Ravens',
     'a defense keeps its full team name  <-- "B. Ravens" is not how anyone refers to one');
  ok(shortName('Cher') === 'Cher', 'a single-word name (no space to split on) is returned unchanged, not mangled');
  ok(shortName('') === '', 'an empty/missing name does not throw');
  ok(/lineupDetail\(team, res\)[\s\S]{0,700}shortName\(x\.player\.name, x\.player\.pos\)/.test(uiN),
     'lineupDetail (the Live tab matchup view) actually calls it');
  ok(!/function viewRosters[\s\S]{0,2000}shortName\(/.test(uiN) && !/function viewLineups[\s\S]{0,2000}shortName\(/.test(uiN),
     'Rosters and Lineups keep full names — they have room; this is scoped to the tight two-column Live view only');
}());

/* ---- Stats tab: Pts must not be the LAST column of a wide table
 * (2026-09-15e) --------------------------------------------------------
 * Found in the app-wide sweep, confirmed with a live browser screenshot: a
 * QB's game-log row is Wk/Opp + 6 stat columns (Cmp/Yds/TD/INT/RuYd/RuTD)
 * before Pts ever appeared, pushing the one number this whole tab exists
 * to show off the right edge of a 390px phone — reachable only via an
 * undiscoverable horizontal swipe on a table (.twrap, overflow-x:auto in
 * app.css) that already looks complete without it. Fixed by moving Pts to
 * right after the identifying column(s). stats.js exports only render() —
 * statTable() itself is a private closure function, and building a full
 * async render() harness (PlayerDB/Gamelog stubs, a real DOM) for one
 * column-order check is disproportionate to what this guards, so — same
 * as the rest of this file does for cases like it — it is pinned as
 * source text instead, backed by the live screenshot as the real proof
 * the rendered output is actually correct. */
(function () {
  ok(/var head = headPrefix\.concat\(\['Pts'\]\)\.concat\(cols\.map/.test(stH),
     'Pts is spliced in right after the row-identifying column(s), not appended after every stat column');
  var i1 = stH.indexOf("cells.push(ctx.fmt(r.pts))");
  var i2 = stH.indexOf('cols.forEach', stH.indexOf('function statTable'));
  ok(i1 >= 0 && i2 >= 0 && i1 < i2,
     'and the row cells push Pts BEFORE the stat-column loop runs, matching the header order exactly');
}());

/* ---- stats.js's team browser now follows ctx.week too (review finding,
 * 2026-09-15e) — the same shape of bug topCard's own comment documents
 * fixing once already (Top Players stuck on a stale week after navigating
 * via the header). teamPickerCard/teamRosterCard used S.settings.currentWeek
 * — "the real current NFL week" — as the ceiling for which weeks a team's
 * browsable roster defaults to and offers, instead of ctx.week — the
 * header's globally-shared selected week every other tab honors — so
 * browsing a team while reviewing an earlier week via the header silently
 * jumped back to the current week's game instead of respecting the
 * selection. Deliberately NOT applied to loadPlayerLog's own currentWeek
 * read (the player-search mode) — that one has a genuinely different job,
 * "show everything played so far" with no week picker of its own, and
 * tying it to a header week elsewhere in the app would hide a searched
 * player's most recent games for no reason a user would expect. */
ok((stH.match(/var through = ctx\.week/g) || []).length === 2,
   'both teamPickerCard\'s click handler and teamRosterCard use ctx.week for the browsable-weeks ceiling');
ok(/settings\.currentWeek : 1/.test(stH),
   'loadPlayerLog (player search) still intentionally uses the real current week, not ctx.week — a season search has no header-week semantics to follow');

/* ---- recommend.js's usageSwing() also resolves book lookups tolerantly
 * now (review finding, 2026-09-15e) — same fix as Store.bookTrend() itself
 * (proven directly, with real data, in tools/test_integration.js's §20);
 * this just confirms the one caller that isn't exported for a direct test
 * was actually updated to stop pre-normalising. */
(function () {
  var usIdx = recX.indexOf('function usageSwing');
  var usBody = recX.slice(usIdx, usIdx + 400);
  ok(usBody.indexOf('bookTrend(p.name, week - 1, 2)') >= 0,
     'usageSwing passes the raw name to bookTrend, not norm(p.name) — the exact mismatch bookTrend now resolves itself');
}());

console.log(f ? ('  ' + f + ' boot check(s) FAILED') : '  boot checks pass');
process.exit(f ? 1 : 0);
