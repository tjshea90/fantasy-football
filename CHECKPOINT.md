# CHECKPOINT 99 — read me first, then TASKS.md

**Written:** 2026-09-19T00:51:59Z · **version:** 7.9 · **tests:** all 21 suites green

## Just done
Real bug found and fixed in teamreport.js: rosterRow() computed onBye as Number(p.bye) === Number(week) directly, instead of Store.isOnBye(p, week) -- recommend.js's own myStarters carries a standing warning against exactly this pattern ('Store.isOnBye, not p.bye === week: it falls back to the league's bye table'), and teamreport.js was the one remaining place that had not caught up. A free-agent-database player with no bye of his own but whose NFL team IS in the league's bye table read as available and priced at his full rest-of-season rate for a week he cannot play -- feeding a wrong number straight into the whole-team-analysis Claude prompt this context object builds. New test in test_teamreport.js confirmed to FAIL against the pre-fix commit and pass now. All 21 suites green.

## Do this next
Continue Step E: schedule.js, gamelog.js, stats.js, gestures.js, sim.js, recap.js, usage.js, playerdb.js, names.js, store.js, espn.js, scoring.js -- for the same class of bug (a fixed-elsewhere pattern that one file didn't inherit) and other real correctness issues. Then finish D (remaining ui.js cards), G (regression), H (ship).

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
  05effc5 ckpt 96: Steps B, C started, D in progress. B: fixed the one real bug in the Android she
  a9c66e2 ckpt 92: Wrote Tj's 2026-09-19 'overall ui and code improvement/bug search and fix' requ
  ec8771f ckpt 89: Shipped v7.9 and published the GitHub Release: triggered publish-release.yml (r
  3d7474c ship v7.9: v7.8: waiver wire repaired — APK built and packaged
  3f75acc ship v7.8: v7.8: waiver wire repaired — the false season-ending flag, the impossible c
  abb3639 ckpt 85: ship: v7.8: waiver wire repaired — the false season-ending flag, the impossib
  daa0bd7 ckpt 80: Step G done -- the thorough sweep, and it caught three more real bugs, all of t
  76e82b1 ckpt 70: Step H done. New suite tools/test_wire.js (20 suites now, all green) pins every
  e0dc8a2 ckpt 67: Steps B/C/D/E/F built. value.js upgrades() rewritten: it now builds EVERY plaus
  f1c2810 ckpt 58: Step A done — the hallucination is fixed at its source. recommend.js: loadNew
```

(2 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
