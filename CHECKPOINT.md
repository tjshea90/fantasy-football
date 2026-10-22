# CHECKPOINT 80 — read me first, then TASKS.md

**Written:** 2026-10-22T21:03:22Z · **version:** 9.3 · **tests:** all 33 suites green

## Just done
ship: v9.4: fixed false 'NFL rosters failed' prompt before Claude; refresh now covers the whole app

## Do this next
verify on the phone

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
     M STATE.md

## Last ten checkpoints
```
  5d6fecf ship v9.3: attach built APK
  5770f58 ship v9.3: v9.3: every Ask-Claude / share-prompt button first refreshes NFL rosters, bye
  20bd769 ckpt 67: ship: v9.3: every Ask-Claude / share-prompt button first refreshes NFL rosters,
  641c34b ckpt 65: ship: v9.3: every Ask-Claude / share-prompt button first refreshes NFL rosters,
  d3d03a2 ckpt 63: Refresh-everything-before-Claude gate (all share/ask buttons) done + test_claud
  831040c ckpt 100: v9.2 shipped + Release verified: old players restorable into completed-week li
  3a00af2 ship v9.2: v9.2: restore old players into completed weeks' lineup drop-downs; points fro
  aad9ce9 ckpt 97: ship: v9.2: restore old players into completed weeks' lineup drop-downs; points
  a765d5d ckpt 94: ship: v9.2: restore old players into completed weeks' lineup drop-downs; points
  12437b8 ckpt 92: ship: v9.2: restore old players into completed weeks' lineup drop-downs; points
```

(6 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
