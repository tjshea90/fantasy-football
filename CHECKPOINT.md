# CHECKPOINT 6 — read me first, then TASKS.md

**Written:** 2026-09-07T19:01:11Z · **version:** 4.2 · **tests:** all 8 suites green

## Just done
Claude-app round trip built and verified end to end for BOTH tabs. handoff.js writes a self-explaining .md briefing (scoring table, roster, exact output contract, worked example) and imports the reply through ai.js's own parser+normalisers, so the offline path and the API path can never disagree. Java: exportShare (share sheet straight to Claude), exportFile, pickFile + MainActivity document picker reading off the UI thread. Paste fallback everywhere. ALSO: the app now sleeps when backgrounded — onPause/onStop/onResume/onDestroy in MainActivity plus __appPause/__appResume and a sleep guard at the single timer-arming site. APK builds clean, 23 classes. All 8 suites green.

## Do this next
Task 3 — game day/time per player and the pre-Sunday alert.

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
     M MANIFEST.txt
     M TASKS.md
     M android/src/com/tj/fftracker/MainActivity.java
     M android/src/com/tj/fftracker/NativeBridge.java
     M app/assets/index.html
     M app/assets/recommend.js
     M app/assets/ui.js
    ?? app/assets/handoff.js
    ?? tools/test_handoff.js

## Last ten checkpoints
```
  4d04339 ckpt 5: Extracted the shared spine for the offline handoff: Ai.normalizeAdvice / normalizeWaivers / poolIndex (so an imported file and an API reply mean the same thing), Recommend.mergeAi (merge-never-replace, one implementation), and Recommend.rosterContext (the triage, so the handoff builds the IDENTICAL context the API call gets). syncAll now calls all three. All 7 suites green.
  f78ed6e ckpt 4: Test gates now DISCOVER suites with a glob instead of a hard-coded list — ckpt.sh reported 'all 6 suites green' immediately after test_ai.js was added without running it. Same fix in ship.sh.
  d6f9078 ckpt 3: Fixed all three reported bugs. (1a) The JSON failure: three defects — parseSse discarded stop_reason, jsonOf anchored to the first brace in the whole answer and never moved it, and a max_tokens truncation was unrecoverable by construction. Rewritten as a single string-aware pass plus a repair path that rescues the players that did arrive; max_tokens raised (a cap costs nothing unused). (1b) The cut-off sentences: a hard slice(0,220) at ingest, cutting mid-word; now 600 with sentence/word-boundary cutting. (1c) Re-default all teams: applyAuto skips manual slots by contract, so the button did nothing and reported success; it now clears the manual marks first, like the per-team Reset to auto always did, and confirms because that discards picks. New tools/test_ai.js (33 assertions) + 17 in test_integration.js.
  bb22c69 ckpt 2: Checkpoint system in place: git history, tools/ckpt.sh, CHECKPOINT.md, TASKS.md. bootstrap.sh now prints a ~120-line briefing instead of 1,200 lines. ship.sh zips .git so history survives the chat.
  0ec30f1 v4.2 baseline — the zip Tj uploaded, all 5 suites green
```
