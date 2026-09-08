# CHECKPOINT 16 — read me first, then TASKS.md

**Written:** 2026-09-08T01:08:28Z · **version:** 4.5 · **tests:** all 11 suites green

## Just done
Tab bar: found the real layout bug behind the 'nav shifted up' report. The bar is 89px (--tab-h 88 + 1px border) but body{padding-bottom} and .toast{bottom} both hard-coded 124px — a leftover from when the tabs were 60px, updated by hand to a wrong number when v3.1 grew them. That pinned a 35px dead band above the bar. Worse, test_boot ASSERTED the bug: it required 'body padding >= min-height + 24', which describes nothing real. Both now derive from --tabh (= --tab-h + border + insets) so they cannot drift or disagree, and the assertions test the relationship instead of two literals. Also made the Data > Screen fit card self-diagnosing: measured bar height vs CSS expectation, the bottom inset, and the SAVED adjBot slider (which survives updates and would look exactly like a regression), with a one-tap reset.

## Do this next
Sweep v4.5 for further code/UI bugs and optimizations.

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
     M app/assets/app.css
     M app/assets/ui.js
     M tools/test_boot.js

## Last ten checkpoints
```
  cc29cb5 ship v4.5: v4.5 — three reported bugs fixed, Claude-app round trip on both tabs, kickoff times + pre-Sunday alerts, the app sleeps when backgrounded, network/caching sweep
  f38d578 ckpt 14: ship: v4.5 — three reported bugs fixed, Claude-app round trip on both tabs, kickoff times + pre-Sunday alerts, the app sleeps when backgrounded, network/caching sweep
  1c79298 ckpt 13: ship: v4.5 — three reported bugs fixed, Claude-app round trip on both tabs, kickoff times + pre-Sunday alerts, the app sleeps when backgrounded, network/caching sweep, and a boot-stopping ReferenceError caught before it shipped
  9e0623f ckpt 12: Docs complete: STATE.md carries the whole v4.3 narrative, LADDER.md step 15a-15i, RELEASE_NOTES.md written for Tj plus a 'For your approval' list of seven candidates from similar apps that were deliberately NOT built. TASKS.md 21/21. APK rebuilt clean.
  8aa4058 ckpt 11: Sweep continued. check_es2018.js had a HARD-CODED file list — schedule.js, handoff.js and names.js were never checked while it reported 'all files ES2018-safe'; it now discovers app/assets/*.js (18 files, all pass). handoff: Array.isArray instead of a truthy .length (a STRING has one, so {"players":"none found"} was being accepted then applying nothing), and a reply with no week is refused rather than filed under undefined where the UI would never show it. Game badges now sit consistently after the team/bye text on every row; the pre-Sunday alert also leads the Advice tab; the exported briefing carries a kickoff column so the reader knows which decisions have a deadline. 11 suites green.
  49c7790 ckpt 10: Fixed the test that was pinning the ReferenceError instead of catching it (it asserted root.__appPause, the broken form). All 11 suites green, APK builds clean.
  3bc3207 ckpt 9: CAUGHT A FATAL BUG I INTRODUCED. ui.js is (function(){...})() with NO root parameter — unlike the other twelve modules — so my 'root.__appPause = appPause' at its top level was a ReferenceError AT SCRIPT LOAD: the app would not have booted at all. Ten green suites and a clean APK build said nothing, because not one of them executed ui.js. Fixed to window.*, plus an !S guard on appPause/appResume (MainActivity.onResume can fire before boot() on a cold start, and S.weekMeta would throw into evaluateJavascript where nothing reports it). New tools/test_lifecycle.js runs ui.js in a real vm context against a DOM stub and proves the battery claim by COUNTING TIMERS: boot arms 1, pause leaves 0, resume does not stack. It also verifies boot really initialised 10 teams, after the first version of that assertion was vacuous and hid a boot failure for a round. 11 suites green.
  cc126ea ckpt 8: Network/caching audit (4b). Found and fixed the real hammering path: every Sync advice tap refetched the full ESPN projection feed (400 players, MB) and the 800-record injury list unconditionally — so a run of retries after the Claude failure Tj photographed meant a burst of multi-MB requests at a public endpoint. Both now have freshness gates (20 min / 10 min), reuse is REPORTED not hidden, failed/empty results are never treated as a cache, and selfTest forces a real fetch. Also fixed two things I introduced: Schedule.ingest was calling Store.save() on every 45s poll tick (full-season disk write for unchanged data) — now signature-guarded; and earlyAlert ran bestLineup on every render of three tabs — now memoised. Normalised three root.Promise refs to the bare global the rest of the codebase uses. New tools/test_net.js, 33 assertions. 10 suites green.
  3c21668 ckpt 7: Task 3 done: schedule.js gives every player a day+time badge on Live, Lineups, Rosters and Advice, fed FREE off the scoreboard response the live poll already fetches (refresh() only hits the network if the stored copy is >3h old). Pre-Sunday alert card on the three lineup screens, leading with recommended-but-benched players and a one-tap fix. Alerts.java extended to fire the same warning with the app closed, reading the kickoffs the page persists — no network. Verified parseIso in real Java: a 00:20Z Thursday kickoff correctly reads as Thursday locally (it is FRIDAY in UTC — that trap is now pinned by a test). 9 suites green.
  82d5785 ckpt 6: Claude-app round trip built and verified end to end for BOTH tabs. handoff.js writes a self-explaining .md briefing (scoring table, roster, exact output contract, worked example) and imports the reply through ai.js's own parser+normalisers, so the offline path and the API path can never disagree. Java: exportShare (share sheet straight to Claude), exportFile, pickFile + MainActivity document picker reading off the UI thread. Paste fallback everywhere. ALSO: the app now sleeps when backgrounded — onPause/onStop/onResume/onDestroy in MainActivity plus __appPause/__appResume and a sleep guard at the single timer-arming site. APK builds clean, 23 classes. All 8 suites green.
```
