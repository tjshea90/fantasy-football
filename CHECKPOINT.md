# CHECKPOINT 12 — read me first, then TASKS.md

**Written:** 2026-09-07T19:21:08Z · **version:** 4.3 · **tests:** all 11 suites green

## Just done
Docs complete: STATE.md carries the whole v4.3 narrative, LADDER.md step 15a-15i, RELEASE_NOTES.md written for Tj plus a 'For your approval' list of seven candidates from similar apps that were deliberately NOT built. TASKS.md 21/21. APK rebuilt clean.

## Do this next
Final verification pass, then ship and deliver.

## How to resume, exactly
```bash
cd "$(dirname "$0")"   # wherever this bundle was unzipped
bash bootstrap.sh          # prints this file, TASKS.md and the git log
```
Then continue from **Do this next** above. Do not re-plan, do not re-read
finished work, do not ask Tj to re-explain anything — `TASKS.md` carries his
request in his own words and `git log` carries every step already taken.

## Uncommitted right now
     M CHECKPOINT.md
     M LADDER.md
     M RELEASE_NOTES.md
     M STATE.md
     M TASKS.md

## Last ten checkpoints
```
  8aa4058 ckpt 11: Sweep continued. check_es2018.js had a HARD-CODED file list — schedule.js, handoff.js and names.js were never checked while it reported 'all files ES2018-safe'; it now discovers app/assets/*.js (18 files, all pass). handoff: Array.isArray instead of a truthy .length (a STRING has one, so {"players":"none found"} was being accepted then applying nothing), and a reply with no week is refused rather than filed under undefined where the UI would never show it. Game badges now sit consistently after the team/bye text on every row; the pre-Sunday alert also leads the Advice tab; the exported briefing carries a kickoff column so the reader knows which decisions have a deadline. 11 suites green.
  49c7790 ckpt 10: Fixed the test that was pinning the ReferenceError instead of catching it (it asserted root.__appPause, the broken form). All 11 suites green, APK builds clean.
  3bc3207 ckpt 9: CAUGHT A FATAL BUG I INTRODUCED. ui.js is (function(){...})() with NO root parameter — unlike the other twelve modules — so my 'root.__appPause = appPause' at its top level was a ReferenceError AT SCRIPT LOAD: the app would not have booted at all. Ten green suites and a clean APK build said nothing, because not one of them executed ui.js. Fixed to window.*, plus an !S guard on appPause/appResume (MainActivity.onResume can fire before boot() on a cold start, and S.weekMeta would throw into evaluateJavascript where nothing reports it). New tools/test_lifecycle.js runs ui.js in a real vm context against a DOM stub and proves the battery claim by COUNTING TIMERS: boot arms 1, pause leaves 0, resume does not stack. It also verifies boot really initialised 10 teams, after the first version of that assertion was vacuous and hid a boot failure for a round. 11 suites green.
  cc126ea ckpt 8: Network/caching audit (4b). Found and fixed the real hammering path: every Sync advice tap refetched the full ESPN projection feed (400 players, MB) and the 800-record injury list unconditionally — so a run of retries after the Claude failure Tj photographed meant a burst of multi-MB requests at a public endpoint. Both now have freshness gates (20 min / 10 min), reuse is REPORTED not hidden, failed/empty results are never treated as a cache, and selfTest forces a real fetch. Also fixed two things I introduced: Schedule.ingest was calling Store.save() on every 45s poll tick (full-season disk write for unchanged data) — now signature-guarded; and earlyAlert ran bestLineup on every render of three tabs — now memoised. Normalised three root.Promise refs to the bare global the rest of the codebase uses. New tools/test_net.js, 33 assertions. 10 suites green.
  3c21668 ckpt 7: Task 3 done: schedule.js gives every player a day+time badge on Live, Lineups, Rosters and Advice, fed FREE off the scoreboard response the live poll already fetches (refresh() only hits the network if the stored copy is >3h old). Pre-Sunday alert card on the three lineup screens, leading with recommended-but-benched players and a one-tap fix. Alerts.java extended to fire the same warning with the app closed, reading the kickoffs the page persists — no network. Verified parseIso in real Java: a 00:20Z Thursday kickoff correctly reads as Thursday locally (it is FRIDAY in UTC — that trap is now pinned by a test). 9 suites green.
  82d5785 ckpt 6: Claude-app round trip built and verified end to end for BOTH tabs. handoff.js writes a self-explaining .md briefing (scoring table, roster, exact output contract, worked example) and imports the reply through ai.js's own parser+normalisers, so the offline path and the API path can never disagree. Java: exportShare (share sheet straight to Claude), exportFile, pickFile + MainActivity document picker reading off the UI thread. Paste fallback everywhere. ALSO: the app now sleeps when backgrounded — onPause/onStop/onResume/onDestroy in MainActivity plus __appPause/__appResume and a sleep guard at the single timer-arming site. APK builds clean, 23 classes. All 8 suites green.
  4d04339 ckpt 5: Extracted the shared spine for the offline handoff: Ai.normalizeAdvice / normalizeWaivers / poolIndex (so an imported file and an API reply mean the same thing), Recommend.mergeAi (merge-never-replace, one implementation), and Recommend.rosterContext (the triage, so the handoff builds the IDENTICAL context the API call gets). syncAll now calls all three. All 7 suites green.
  f78ed6e ckpt 4: Test gates now DISCOVER suites with a glob instead of a hard-coded list — ckpt.sh reported 'all 6 suites green' immediately after test_ai.js was added without running it. Same fix in ship.sh.
  d6f9078 ckpt 3: Fixed all three reported bugs. (1a) The JSON failure: three defects — parseSse discarded stop_reason, jsonOf anchored to the first brace in the whole answer and never moved it, and a max_tokens truncation was unrecoverable by construction. Rewritten as a single string-aware pass plus a repair path that rescues the players that did arrive; max_tokens raised (a cap costs nothing unused). (1b) The cut-off sentences: a hard slice(0,220) at ingest, cutting mid-word; now 600 with sentence/word-boundary cutting. (1c) Re-default all teams: applyAuto skips manual slots by contract, so the button did nothing and reported success; it now clears the manual marks first, like the per-team Reset to auto always did, and confirms because that discards picks. New tools/test_ai.js (33 assertions) + 17 in test_integration.js.
  bb22c69 ckpt 2: Checkpoint system in place: git history, tools/ckpt.sh, CHECKPOINT.md, TASKS.md. bootstrap.sh now prints a ~120-line briefing instead of 1,200 lines. ship.sh zips .git so history survives the chat.
```
