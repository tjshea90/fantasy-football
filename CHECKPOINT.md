# CHECKPOINT 108 — read me first, then TASKS.md

**Written:** 2026-09-19T01:07:49Z · **version:** 7.9 · **tests:** all 21 suites green

## Just done
Real, user-facing bug found and fixed: the Scoring rules card (Data tab) told Tj the three league-wide +5 longest-play bonuses 'cannot be derived from a box score alone' and had to be added by hand -- true when that text was written, false now. Scoring.applyWeeklyBonuses has since been wired into doSync and runs automatically once a week is final, confirmed by grep against the live call site and by test_scoring.js's own coverage. Following the stale advice today would have DOUBLE-COUNTED a bonus: once automatic, once from a manual adjustment added believing the app had not applied it. Card text rewritten to say what the app actually does, including the one real imprecision (a two-QB game can credit the wrong quarterback for the completion bonus, documented at the doSync call site too, found while verifying this). SEPARATELY, and more important process-wise: caught that my own regression checks this session were grepping test output for the word FAIL and treating a silent CRASH (nonzero exit, zero FAIL lines printed) as green -- which is exactly what my playerdb.js norm() consolidation had done to test_boot.js two commits ago undetected. Root cause: two of that file's own minimal harnesses (g3, g5) never loaded espn.js at all, only relying on playerdb.js's old self-contained copy. Fixed both to load the real espn.js first (g5 then overrides just the network call, keeping normName real). Every suite now re-verified by BOTH exit code and FAIL-count, not text-grep alone.

## Do this next
Finish the sweep: a few more files to check (store.js remainder, espn.js remainder, stats.js, recap.js), then G (final regression, exit-code-checked), H (ship). Also: re-verify every earlier 'all green' claim this session was exit-code-checked, not just FAIL-grepped -- the teamreport.js and rosterInjuryCard fixes were each spot-checked individually so they're trustworthy, but re-run the full suite with real exit-code discipline one more time before shipping regardless.

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
  2c5974d ckpt 102: Second consolidation found in the sweep: playerdb.js had its own inline copy o
  afdcc3f ckpt 99: Real bug found and fixed in teamreport.js: rosterRow() computed onBye as Number
  05effc5 ckpt 96: Steps B, C started, D in progress. B: fixed the one real bug in the Android she
  a9c66e2 ckpt 92: Wrote Tj's 2026-09-19 'overall ui and code improvement/bug search and fix' requ
  ec8771f ckpt 89: Shipped v7.9 and published the GitHub Release: triggered publish-release.yml (r
  3d7474c ship v7.9: v7.8: waiver wire repaired — APK built and packaged
  3f75acc ship v7.8: v7.8: waiver wire repaired — the false season-ending flag, the impossible c
  abb3639 ckpt 85: ship: v7.8: waiver wire repaired — the false season-ending flag, the impossib
  daa0bd7 ckpt 80: Step G done -- the thorough sweep, and it caught three more real bugs, all of t
  76e82b1 ckpt 70: Step H done. New suite tools/test_wire.js (20 suites now, all green) pins every
```

(5 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
