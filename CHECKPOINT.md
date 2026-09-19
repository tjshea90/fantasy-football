# CHECKPOINT 114 — read me first, then TASKS.md

**Written:** 2026-09-19T01:12:44Z · **version:** 8.0 · **tests:** all 21 suites green

## Just done
Shipped v8.0 and published the GitHub Release: triggered publish-release.yml, verified via the live API that the release exists with a non-empty assets array (FFTracker-v8.0.apk, 330006 bytes, application/vnd.android.package-archive, not a draft). The 2026-09-19 open-ended 'overall ui and code improvement/bug search and fix' job is done: five real fixes (rosterInjuryCard's missing season-outlook detail, teamreport.js's bye-table bypass, playerdb.js's duplicate normalizer, the stale double-counting scoring-bonus hint, NativeBridge's JSON escaping), each tested against pre-fix behavior where practical; two things checked and confirmed correct rather than fixed (the Trade evaluator, scoring.js's RULES table); one thing flagged rather than resolved as a product/scope decision (sim.js's unused season/power/allPlay/bracket, now three checkpoints running); and a real process bug in this session's own regression checks (FAIL-text-grep missing a silent crash) caught and fixed along the way, with every suite re-verified by exit code afterward. Every box in TASKS.md steps A-H is ticked with the test that proves it named.

## Do this next
Send Tj the v8.0 release link per CLAUDE.md's standing instruction -- plain tappable text, never in a code block. Nothing else in flight; this job is done. Open items to mention: sim.js's dead-to-the-user simulation engine (three checkpoints now deferred to him), and the two-QB longest-completion edge case in the weekly bonus (documented, not fixable without a new play-by-play feature).

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
  f586fc2 ship v8.0: v8.0: overall UI/code improvement sweep -- five real fixes, a stale docs bug,
  7f83117 ckpt 108: Real, user-facing bug found and fixed: the Scoring rules card (Data tab) told 
  2c5974d ckpt 102: Second consolidation found in the sweep: playerdb.js had its own inline copy o
  afdcc3f ckpt 99: Real bug found and fixed in teamreport.js: rosterRow() computed onBye as Number
  05effc5 ckpt 96: Steps B, C started, D in progress. B: fixed the one real bug in the Android she
  a9c66e2 ckpt 92: Wrote Tj's 2026-09-19 'overall ui and code improvement/bug search and fix' requ
  ec8771f ckpt 89: Shipped v7.9 and published the GitHub Release: triggered publish-release.yml (r
  3d7474c ship v7.9: v7.8: waiver wire repaired — APK built and packaged
  3f75acc ship v7.8: v7.8: waiver wire repaired — the false season-ending flag, the impossible c
  abb3639 ckpt 85: ship: v7.8: waiver wire repaired — the false season-ending flag, the impossib
```
