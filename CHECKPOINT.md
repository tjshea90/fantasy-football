# CHECKPOINT 68 — read me first, then TASKS.md

**Written:** 2026-10-29T00:57:20Z · **version:** 9.4 · **tests:** all 34 suites green

## Just done
ship: v9.5: restore league from the league site's capsules + schedule (rosters, standings, 14-week schedule, scores, add/drops) - first-launch offer and Data screen button

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
     M TASKS.md

## Last ten checkpoints
```
  427c7f9 ship v9.4: v9.4: fixed false 'NFL rosters failed' prompt before Claude; refresh now cove
  7534aec ckpt 80: ship: v9.4: fixed false 'NFL rosters failed' prompt before Claude; refresh now 
  5d6fecf ship v9.3: attach built APK
  5770f58 ship v9.3: v9.3: every Ask-Claude / share-prompt button first refreshes NFL rosters, bye
  20bd769 ckpt 67: ship: v9.3: every Ask-Claude / share-prompt button first refreshes NFL rosters,
  641c34b ckpt 65: ship: v9.3: every Ask-Claude / share-prompt button first refreshes NFL rosters,
  d3d03a2 ckpt 63: Refresh-everything-before-Claude gate (all share/ask buttons) done + test_claud
  831040c ckpt 100: v9.2 shipped + Release verified: old players restorable into completed-week li
  3a00af2 ship v9.2: v9.2: restore old players into completed weeks' lineup drop-downs; points fro
  aad9ce9 ckpt 97: ship: v9.2: restore old players into completed weeks' lineup drop-downs; points
```

(23 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
