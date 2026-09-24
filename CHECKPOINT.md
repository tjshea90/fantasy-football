# CHECKPOINT 168 — read me first, then TASKS.md

**Written:** 2026-09-24T20:13:28Z · **version:** 8.6 · **tests:** all 28 suites green

## Just done
Item I done: Data -> League puts Standings first; 'Enter week N scores' under it in a details.wsc, collapsed until the week kicks off (open when a game started / past week / score typed / opened by hand); test_picks2 #10

## Do this next
Item J: visual crawl in Chromium (perf.js --state G --crawl --shots; Live, Wire TREND, player card, Data League/App), STATE.md v8.7 entry, ship.sh 'v8.7', publish-release 8.7, verify, message Tj; then K full test

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
  a7a8654 ckpt 164: Item H done: inactives alert — AlertPlan.java (pure Java: one setWindow alar
  f24d47b ckpt 153: Item G done: one player card (openPlayerCard) replaces pre-game card / stat-li
  d9412f0 ckpt 146: Item F done: ESPN ownership (percentOwned/percentChange) + written outlooks ca
  3b2fbaa ckpt 141: Item E done: matchup difficulty chip (Recommend.matchupRank/fpaTable from the 
  d8f32eb ckpt 136: Items C+D done: position colour chips (slotEl/posClass; FLEX neutral; Lineups 
  19ecaa6 ckpt 132: Items A+B done: Live win probability (Sim.matchupOdds: banked + proj x game-le
  2b6781b ckpt 127: Wrote Tj's 2026-09-24b request into TASKS.md (A-K: proposals 1,2,3,6,7,8,9,10 
  17e9448 ckpt 125: Full test + competitor survey (2026-09-24) complete: v8.6 Release published an
  9e19564 ship v8.6: v8.6: full test -- a failed injury fetch no longer clears every OUT/IR flag; 
  249189d ckpt 122: ship: v8.6: full test -- a failed injury fetch no longer clears every OUT/IR f
```

(3 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
