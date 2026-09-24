# CHECKPOINT 164 — read me first, then TASKS.md

**Written:** 2026-09-24T20:09:36Z · **version:** 8.6 · **tests:** all 28 suites green

## Just done
Item H done: inactives alert — AlertPlan.java (pure Java: one setWindow alarm 85..75 min before each distinct starter kickoff, covers <=90 min, catch-up, retry, done-tracking, message) + Alerts.java slot 2 (own switch, re-arms only itself) + bridge alertsInactives/alertsKickoffs + ui.js pushAlertPlan on __appPause + Data->App switch; test_alertplan.js + test_picks2 #9; build.sh green

## Do this next
Item I: Data -> League order — Standings first; 'Enter week N scores' (weeklyScoresCard) below it, collapsed until week N has kicked off; then J ship v8.7, K full test

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
  f24d47b ckpt 153: Item G done: one player card (openPlayerCard) replaces pre-game card / stat-li
  d9412f0 ckpt 146: Item F done: ESPN ownership (percentOwned/percentChange) + written outlooks ca
  3b2fbaa ckpt 141: Item E done: matchup difficulty chip (Recommend.matchupRank/fpaTable from the 
  d8f32eb ckpt 136: Items C+D done: position colour chips (slotEl/posClass; FLEX neutral; Lineups 
  19ecaa6 ckpt 132: Items A+B done: Live win probability (Sim.matchupOdds: banked + proj x game-le
  2b6781b ckpt 127: Wrote Tj's 2026-09-24b request into TASKS.md (A-K: proposals 1,2,3,6,7,8,9,10 
  17e9448 ckpt 125: Full test + competitor survey (2026-09-24) complete: v8.6 Release published an
  9e19564 ship v8.6: v8.6: full test -- a failed injury fetch no longer clears every OUT/IR flag; 
  249189d ckpt 122: ship: v8.6: full test -- a failed injury fetch no longer clears every OUT/IR f
  2dc714b ckpt 121: Step 7 done: proposals 1-10 in TASKS 'Waiting on Tj' (win prob, position colou
```

(10 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
