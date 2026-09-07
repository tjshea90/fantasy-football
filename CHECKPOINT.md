# CHECKPOINT 3 — read me first, then TASKS.md

**Written:** 2026-09-07T18:49:15Z · **version:** 4.2 · **tests:** all 6 suites green

## Just done
Fixed all three reported bugs. (1a) The JSON failure: three defects — parseSse discarded stop_reason, jsonOf anchored to the first brace in the whole answer and never moved it, and a max_tokens truncation was unrecoverable by construction. Rewritten as a single string-aware pass plus a repair path that rescues the players that did arrive; max_tokens raised (a cap costs nothing unused). (1b) The cut-off sentences: a hard slice(0,220) at ingest, cutting mid-word; now 600 with sentence/word-boundary cutting. (1c) Re-default all teams: applyAuto skips manual slots by contract, so the button did nothing and reported success; it now clears the manual marks first, like the per-team Reset to auto always did, and confirms because that discards picks. New tools/test_ai.js (33 assertions) + 17 in test_integration.js.

## Do this next
Task 2 — the Claude-app round-trip export/import for the Advice tab and the wire button.

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
     M TASKS.md
     M app/assets/ai.js
     M app/assets/recommend.js
     M app/assets/ui.js
     M tools/test_integration.js
    ?? tools/test_ai.js

## Last ten checkpoints
```
  bb22c69 ckpt 2: Checkpoint system in place: git history, tools/ckpt.sh, CHECKPOINT.md, TASKS.md. bootstrap.sh now prints a ~120-line briefing instead of 1,200 lines. ship.sh zips .git so history survives the chat.
  0ec30f1 v4.2 baseline — the zip Tj uploaded, all 5 suites green
```
