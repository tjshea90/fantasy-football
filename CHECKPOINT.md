# CHECKPOINT 57 — read me first, then TASKS.md

**Written:** 2026-09-19T04:06:28Z · **version:** 8.0 · **tests:** all 22 suites green

## Just done
Full test (2026-09-19, requested via the standing 'full tests' protocol in CLAUDE.md): comprehensive sweep of the entire app -- Android shell (MainActivity/NativeBridge/Alerts/manifest/res), index.html/app.css, all 4452 lines of ui.js tab by tab, and every file in the data/logic layer (store, scoring, ros, value, recommend, ai, handoff, espn, projections, playerdb, names, usage, gamelog, gestures, recap, teamreport, sim, stats), cross-checked scoring.js against RULES_2026.md line by line (no disagreement). Two real findings, both fixed and tested: (1) CACHING/DATA-RETENTION BUG -- doSync() (ui.js) ended every sync by REPLACING S.weekMeta[week] wholesale with a new object literal, silently discarding schedule.js's own kickoffs/schedAt/schedSig/shouldStart/shouldStartSig fields on that same object every time -- since liveTick() calls Schedule.ingest() immediately before calling doSync on the same tick, and doSync is also reachable directly from the manual Sync-week button and pull-to-refresh with no compensating re-ingest, this silently erased the game-time badges next to every player's name and the pre-Sunday bench alert (in-app card AND Alerts.java's closed-app notification, which reads this identical persisted key with no WebView available) after most syncs. Fixed by mutating the existing object in place instead of replacing it. New test tools/test_schedmeta.js confirmed to FAIL against the pre-fix code (3 of 4 checks) and pass now. (2) STALE DOCUMENTATION -- RULES_2026.md's own 'Weekly bonuses -- NOT MODELED' section was true when transcribed but has been false since Scoring.applyWeeklyBonuses was wired into doSync (the exact same staleness the 2026-09-19 sweep already found and fixed on the Data tab's Scoring rules card, just missed at its source). Corrected with a dated resolution note in the file's own established style. One finding documented, NOT fixed, in TASKS.md's Waiting on Tj (a real but lower-severity security gap needing an architectural decision, not a sweep-sized patch): the live Anthropic API key rides along in Android's automatic cloud backup/device-transfer in plain text -- backup_rules.xml/data_extraction_rules.xml only exclude the app's own backups/ folder, never the main state file the key actually lives in, a completely different path from the Downloads-export redaction store.js already has. Everything else read clean: no other wholesale-object-replace clobber pattern found anywhere else in the codebase (grepped specifically after finding #1), every memoization cache's key correctly covers its invalidation triggers, no network redundancy beyond what prior sweeps already fixed, sim.js's unused season/power/allPlay/bracket still flagged not resolved (now four consecutive sessions deferring the same product question to Tj). All 22 suites (21 + the new one) and the ES2018 gate green, verified by exit code AND a precise anchored FAIL-line count.

## Do this next
Ship this full test's two fixes as the next version per CLAUDE.md's full-test protocol step 6 (a full test that finds real, fixed issues is ship-worthy work): bash ship.sh, then trigger publish-release.yml, verify via get_release_by_tag, send Tj the release link. Nothing else in flight.

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
  8c4d8d7 ckpt 54: Full-test sweep (2026-09-19, second pass): found and fixed a real caching/data-
  798e0e4 ckpt 54: Wrote Tj's standing 'light tests'/'full tests' request into CLAUDE.md as a perm
  950bca6 ckpt 114: Shipped v8.0 and published the GitHub Release: triggered publish-release.yml, 
  f586fc2 ship v8.0: v8.0: overall UI/code improvement sweep -- five real fixes, a stale docs bug,
  7f83117 ckpt 108: Real, user-facing bug found and fixed: the Scoring rules card (Data tab) told 
  2c5974d ckpt 102: Second consolidation found in the sweep: playerdb.js had its own inline copy o
  afdcc3f ckpt 99: Real bug found and fixed in teamreport.js: rosterRow() computed onBye as Number
  05effc5 ckpt 96: Steps B, C started, D in progress. B: fixed the one real bug in the Android she
  a9c66e2 ckpt 92: Wrote Tj's 2026-09-19 'overall ui and code improvement/bug search and fix' requ
  ec8771f ckpt 89: Shipped v7.9 and published the GitHub Release: triggered publish-release.yml (r
```

(2 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
