# CHECKPOINT 63 — read me first, then TASKS.md

**Written:** 2026-10-22T20:47:15Z · **version:** 9.2 · **tests:** all 33 suites green

## Just done
Refresh-everything-before-Claude gate (all share/ask buttons) done + test_claudeprep.js

## Do this next
Run ship.sh as v9.3 and publish Release; Tj to test on device

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
     M tools/test_gestures.js

## Last ten checkpoints
```
  831040c ckpt 100: v9.2 shipped + Release verified: old players restorable into completed-week li
  3a00af2 ship v9.2: v9.2: restore old players into completed weeks' lineup drop-downs; points fro
  aad9ce9 ckpt 97: ship: v9.2: restore old players into completed weeks' lineup drop-downs; points
  a765d5d ckpt 94: ship: v9.2: restore old players into completed weeks' lineup drop-downs; points
  12437b8 ckpt 92: ship: v9.2: restore old players into completed weeks' lineup drop-downs; points
  d17a0d4 ckpt 82: v9.1 shipped and Release verified (asset FFTracker-v9.1.apk)
  01db40b ship v9.1: attach built APK
  2841219 ship v9.1: v9.1: dropped players keep prior weeks' points; Is-this-player-available sear
  6b79442 ckpt 73: ship: v9.1: dropped players keep prior weeks' points; Is-this-player-available 
  46e0257 ckpt 71: Done: history-safe drops (released list), availability search card, 32 DEF alwa
```

(14 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
