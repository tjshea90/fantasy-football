# CHECKPOINT 54 — read me first, then TASKS.md

**Written:** 2026-09-19T03:57:40Z · **version:** 8.0 · **tests:** all 22 suites green

## Just done
Full-test sweep (2026-09-19, second pass): found and fixed a real caching/data-retention bug. doSync() (ui.js) ended its success path by REPLACING S.weekMeta[syncedWeek] wholesale with a brand-new object literal, discarding every field schedule.js's own ingest()/earlyAlertUncached() write onto that same object (kickoffs, schedAt, schedSig, shouldStart, shouldStartSig) -- it only went out of its way to carry 'opponents' forward. Since liveTick() calls Schedule.ingest(week, games) immediately before calling doSync on the same tick, and doSync is also reachable directly from the manual Sync-week button and pull-to-refresh with no compensating re-ingest, this silently erased the game-time badges next to every player's name and the pre-Sunday bench alert (both the in-app card and Alerts.java's closed-app notification, which reads this identical persisted key with no WebView available) after most syncs, until something unrelated happened to re-ingest a schedule. Fixed by mutating the existing weekMeta object in place instead of replacing it, so any field another module owns on it survives automatically. New test tools/test_schedmeta.js confirmed to FAIL against the pre-fix code (3 of its 4 checks) and pass now. All 22 suites + ES2018 gate green (verified by exit code AND a precise '^  FAIL ' line count, not a bare grep FAIL -- test_waiver.js's own passing assertion text contains the substring FAILED and would have been a false red under a looser grep).

## Do this next
Continue the full-test sweep: data/logic layer (store.js, value.js, recommend.js, ai.js, handoff.js, espn.js, projections.js, ros.js, scoring.js, playerdb.js, names.js, usage.js, gamelog.js, gestures.js, recap.js, teamreport.js, sim.js, stats.js) and the rest of ui.js (Rosters/Wire/Stats/Advice/Data tabs, lines ~1250-4452 not yet re-read this session). Cross-check scoring.js against RULES_2026.md. Then ship if anything else is found, per CLAUDE.md's full-test protocol.

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
  798e0e4 ckpt 54: Wrote Tj's standing 'light tests'/'full tests' request into CLAUDE.md as a perm
  950bca6 ckpt 114: Shipped v8.0 and published the GitHub Release: triggered publish-release.yml, 
  f586fc2 ship v8.0: v8.0: overall UI/code improvement sweep -- five real fixes, a stale docs bug,
  7f83117 ckpt 108: Real, user-facing bug found and fixed: the Scoring rules card (Data tab) told 
  2c5974d ckpt 102: Second consolidation found in the sweep: playerdb.js had its own inline copy o
  afdcc3f ckpt 99: Real bug found and fixed in teamreport.js: rosterRow() computed onBye as Number
  05effc5 ckpt 96: Steps B, C started, D in progress. B: fixed the one real bug in the Android she
  a9c66e2 ckpt 92: Wrote Tj's 2026-09-19 'overall ui and code improvement/bug search and fix' requ
  ec8771f ckpt 89: Shipped v7.9 and published the GitHub Release: triggered publish-release.yml (r
  3d7474c ship v7.9: v7.8: waiver wire repaired — APK built and packaged
```

(3 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
