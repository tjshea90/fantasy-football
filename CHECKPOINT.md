# CHECKPOINT 67 — read me first, then TASKS.md

**Written:** 2026-09-18T20:23:09Z · **version:** 7.7 · **tests:** all 20 suites green

## Just done
Steps B/C/D/E/F built. value.js upgrades() rewritten: it now builds EVERY plausible (free agent x drop candidate) pair, ranks them, and greedily assigns so each roster player is the drop in at most one suggestion and each free agent the add in at most one -- the actual disease behind '36 rows, one player'. Same-position is the default (a cross-position swap must clear DOUBLE both bars, and is ranked at 0.75x so it has to be about a third bigger to outrank a like-for-like move); a forced replacement crossing positions must additionally beat the best available player at the emptied position. New slotNeeds/lineupFillable/bodyCounts enforce Tj's TE rule on the ROSTER: no swap may leave a starting slot nobody can fill. New Value.mustReplace() counts holes off the roster, and ui.js's headline now names the actual men instead of counting suggestion rows. rosterValues prices an IR-but-returning player at his rate times the games he can still play (new Ros.weekOfDate/gamesLeftFrom) instead of zero or full. ai.js + handoff.js prompts carry new rules 7 (like-for-like unless the gap is big) and 8 (never name the same man twice), and normalizeWaivers now ENFORCES the one-to-one drop rather than trusting it. All 19 suites still green.

## Do this next
Step H: write the tests. Each must be confirmed to FAIL against the pre-fix code before being accepted, and the live feed text (Schultz/Higgins, Mahomes, Nabers) must be pinned as fixtures. Then G (full sweep of the wire section), then I (ship + release + link).

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
  f1c2810 ckpt 58: Step A done — the hallucination is fixed at its source. recommend.js: loadNew
  2e1c0d9 ckpt 53: Wrote Tj's 2026-09-18d 'the wire is broken' request into TASKS.md verbatim, and
  837c56c ckpt 118: Shipped v7.7 and published the GitHub Release: triggered publish-release.yml, 
  abc1cf3 ship v7.7: Waiver wire overhauled: ranked on expected rest-of-season points in this leag
  f6d6ae6 ckpt 115: Step I sweep, part 2 -- caught a severe bug in THIS job's own change by review
  8647e0a ckpt 110: Step I sweep, part 1. Found and fixed a THIRD instance of the same dead-code c
  c396c21 ckpt 106: Step G done plus two real staleness bugs found and fixed while doing it. UI: t
  6b0083a ckpt 96: Steps F done (rules 4+5). New Ai.waiverCriteriaText() states all six of Tj's cr
  3a24f65 ckpt 77: Step H part 1 done: tools/test_waiver.js rewritten against the new engine, and 
  4799ecb ckpt 72: Steps C/D/E built. New app/assets/ros.js is the rest-of-season engine: full-sea
```

(8 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
