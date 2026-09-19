# CHECKPOINT 64 — read me first, then TASKS.md

**Written:** 2026-09-19T04:13:50Z · **version:** 8.2 · **tests:** all 22 suites green

## Just done
v8.2 shipped and published: triggered publish-release.yml, verified via get_release_by_tag (FFTracker-v8.2.apk, 330006 bytes, non-empty assets, not a draft). This is the ship of the full-test sweep started earlier this session (the two real findings: the doSync() weekMeta wholesale-replace bug, fixed and tested; the stale RULES_2026.md 'NOT MODELED' line, corrected) plus the flagged-not-fixed API-key-in-Android-auto-backup finding recorded in TASKS.md's Waiting on Tj. Version landed at v8.2, not v8.1, because the first ship.sh run (before build.sh had produced an APK in this fresh container) still bumped VERSION and logged to BUILDLOG.md/ladder before warning 'nothing new to publish' -- the second run (after building a real APK) correctly detected v8.1 already logged and bumped once more to keep every ship unique, exactly as ship.sh's own header describes. Link sent to Tj next.

## Do this next
The full-test job is complete and shipped. Nothing in flight. Next work starts from whatever Tj asks next, or another light/full-tests request using CLAUDE.md's standing protocol. Still open, for a future session or Tj's own decision: the Android-auto-backup API-key exposure (TASKS.md Waiting on Tj, flagged not fixed this session) and sim.js's unused season/power/allPlay/bracket (four consecutive sessions deferred).

## How to resume, exactly
Open this GitHub repo in a Claude Code session on ANY of the three
accounts and say "continue". The SessionStart hook runs tools/resume.sh,
which pulls the latest and prints this file automatically — nothing has
to be attached, uploaded or explained. If that briefing did not appear,
run it by hand:
```bash
bash tools/resume.sh       # pull + this file + TASKS.md + the rules
```
Then continue from **Do this next** above. Do not re-plan, do not re-read
finished work, do not ask Tj to re-explain anything — `TASKS.md` carries his
request in his own words and `git log` carries every step already taken.

## Uncommitted right now
     M CHECKPOINT.md

## Last ten checkpoints
```
  d09d174 ship v8.2: v8.1: full-test sweep -- fixed a doSync() weekMeta wholesale-replace bug that
  dcd3db0 ship v8.1: v8.1: full-test sweep -- fixed a doSync() weekMeta wholesale-replace bug that
  db7e9e7 ckpt 57: Full test (2026-09-19, requested via the standing 'full tests' protocol in CLAU
  8c4d8d7 ckpt 54: Full-test sweep (2026-09-19, second pass): found and fixed a real caching/data-
  798e0e4 ckpt 54: Wrote Tj's standing 'light tests'/'full tests' request into CLAUDE.md as a perm
  950bca6 ckpt 114: Shipped v8.0 and published the GitHub Release: triggered publish-release.yml, 
  f586fc2 ship v8.0: v8.0: overall UI/code improvement sweep -- five real fixes, a stale docs bug,
  7f83117 ckpt 108: Real, user-facing bug found and fixed: the Scoring rules card (Data tab) told 
  2c5974d ckpt 102: Second consolidation found in the sweep: playerdb.js had its own inline copy o
  afdcc3f ckpt 99: Real bug found and fixed in teamreport.js: rosterRow() computed onBye as Number
```
