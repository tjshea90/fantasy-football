# CHECKPOINT 131 — read me first, then TASKS.md

**Written:** 2026-09-23T06:19:00Z · **version:** 8.4 · **tests:** all 23 suites green

## Just done
Full test step 3 done: perf.js --crawl (and --advice prep) — 511 actions over 12 screens on two real-data states, 0 problems.

## Do this next
Profile the Roster tab's cold render (187ms at 4x right after an advice sync — v8.4 PROJ/AVG column suspect), then step 4: adversarial review of the v8.3/v8.4 diff.

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
     M TASKS.md

## Last ten checkpoints
```
  0ea7228 ckpt 128: Full test steps 1-2 done: floor 23/23 green; CSS cross-check clean; fixed 6 st
  5749120 ckpt 125: Wrote Tj's 'Run a full test' (2026-09-23c) into TASKS.md as steps 1-9 per CLAU
  f59447c ckpt 123: v8.4 Release published and verified (FFTracker-v8.4.apk, 342294 bytes). 2026-0
  96a9953 ckpt 122: v8.4 shipped via ship.sh (23 suites + ES2018 + dex gate green, APK built, main
  49f7cc3 ship v8.4: v8.4: Tj's picks 1,2,3,5,6 -- Roster PROJ + AVG per player, Live projection u
  205e7bc ckpt 118: A-E all done and tested: new tools/test_picks.js (32 render-level checks acros
  73ee643 ckpt 114: D code done: Power rankings · playoff odds card on Data -> League (Sim.power 
  834ac6b ckpt 105: C code done: Advice merged into Lineups as a 'Set lineups | Advice' sub-view (
  e759e7b ckpt 101: Code for A (Roster PROJ + AVG column; new Store.playerAvg), B (Live: 'p 14.2' 
  aea9d08 ckpt 96: Wrote Tj's 2026-09-23b request ('Do number 1, 2, 3, 5, 6' of the v8.3 proposals
```

(2 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
