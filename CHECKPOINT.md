# CHECKPOINT 187 — read me first, then TASKS.md

**Written:** 2026-09-24T20:48:10Z · **version:** 8.7 · **tests:** all 28 suites green

## Just done
K full test done: findings recorded in STATE.md v8.8; job archived to LADDER.md §44

## Do this next
ship v8.8, publish-release 8.8, verify, message Tj with the v8.8 link (v8.7 also published)

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
  147f562 ckpt 184: v8.7 shipped + Release verified (asset FFTracker-v8.7.apk). K full test starte
  4331bae ship v8.7: v8.7: Tj's picks 1,2,3,6,7,8,9,10 + Live layout (win probability, position co
  2eb03e9 ckpt 180: Features done (A-I) + visual pass fixes (Wire injury card badges, long-term-ou
  be7a263 ckpt 168: Item I done: Data -> League puts Standings first; 'Enter week N scores' under 
  a7a8654 ckpt 164: Item H done: inactives alert — AlertPlan.java (pure Java: one setWindow alar
  f24d47b ckpt 153: Item G done: one player card (openPlayerCard) replaces pre-game card / stat-li
  d9412f0 ckpt 146: Item F done: ESPN ownership (percentOwned/percentChange) + written outlooks ca
  3b2fbaa ckpt 141: Item E done: matchup difficulty chip (Recommend.matchupRank/fpaTable from the 
  d8f32eb ckpt 136: Items C+D done: position colour chips (slotEl/posClass; FLEX neutral; Lineups 
  19ecaa6 ckpt 132: Items A+B done: Live win probability (Sim.matchupOdds: banked + proj x game-le
```

(2 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
