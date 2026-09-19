# CHECKPOINT 54 — read me first, then TASKS.md

**Written:** 2026-09-19T03:13:29Z · **version:** 8.0 · **tests:** all 21 suites green

## Just done
Wrote Tj's standing 'light tests'/'full tests' request into CLAUDE.md as a permanent protocol (new section, before 'This repo is public'): exact trigger phrasing, exact steps, budget discipline for light, no-ceiling comprehensive sweep for full, both referencing this repo's real tooling (ckpt.sh's suite list, ship.sh, the 2026-09-19 sweep as the full-test template) so any future cold-start session on any account knows exactly what to do with zero further explanation. Also closed out the loose end from the prior session: verified v8.0's GitHub Release via get_release_by_tag (FFTracker-v8.0.apk, 330006 bytes, non-empty assets, not a draft) and ticked TASKS.md step H.

## Do this next
Nothing in flight. The 2026-09-19 sweep job (steps A-H) is fully complete and ticked. Waiting on Tj for: sim.js's unused season/power/allPlay/bracket (three checkpoints deferred now) and the two-QB longest-completion edge case (documented, not fixable without a new play-by-play feature). Next real work starts from whatever Tj asks next, or a 'light tests'/'full tests' request using the protocol just added to CLAUDE.md.

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
  950bca6 ckpt 114: Shipped v8.0 and published the GitHub Release: triggered publish-release.yml, 
  f586fc2 ship v8.0: v8.0: overall UI/code improvement sweep -- five real fixes, a stale docs bug,
  7f83117 ckpt 108: Real, user-facing bug found and fixed: the Scoring rules card (Data tab) told 
  2c5974d ckpt 102: Second consolidation found in the sweep: playerdb.js had its own inline copy o
  afdcc3f ckpt 99: Real bug found and fixed in teamreport.js: rosterRow() computed onBye as Number
  05effc5 ckpt 96: Steps B, C started, D in progress. B: fixed the one real bug in the Android she
  a9c66e2 ckpt 92: Wrote Tj's 2026-09-19 'overall ui and code improvement/bug search and fix' requ
  ec8771f ckpt 89: Shipped v7.9 and published the GitHub Release: triggered publish-release.yml (r
  3d7474c ship v7.9: v7.8: waiver wire repaired — APK built and packaged
  3f75acc ship v7.8: v7.8: waiver wire repaired — the false season-ending flag, the impossible c
```

(4 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
