# CHECKPOINT 58 — read me first, then TASKS.md

**Written:** 2026-09-18T20:12:10Z · **version:** 7.7 · **tests:** all 20 suites green

## Just done
Step A done — the hallucination is fixed at its source. recommend.js: loadNews now keeps the four fields it was throwing away (details.returnDate, details.fantasyStatus, type.name, the record date) and no longer uses details.type (a BODY PART, 'Knee') as a news note. seasonOutlook is rewritten: ESPN's status is authoritative about availability (an ACTIVE player can never be season-ending, which alone kills 13 of the 14 live false positives), returnDate decides whether a parked player is back this season or finished (2027-02-15 is ESPN's 'not coming back' sentinel), an IR-R/PUP-R return designation is honoured, and the free-text note is demoted to corroboration that must be about THIS player (nearest name before the phrase) and not about a PAST season. Verified against all 800 live records: Schultz, Mahomes, Nabers, Skattebo and Demercado all correctly clear; the 12 genuinely finished are still caught; 30 players now read 'on IR, back Oct 18' instead of 'out for the season'.

## Do this next
Step F is partly implied by A and must be finished: seasonOutlook now returns longTermOut/mustReplace/returnAround as well as seasonEnding, so value.js rosterValues, ai.js and handoff.js need updating to the new shape (they read .seasonEnding and .why today). Then B (count distinct roster players in ui.js), C (one-to-one assignment in upgrades()), D/E (same-position-first plus roster depth), G (sweep), H (tests), I (ship).

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

(4 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
