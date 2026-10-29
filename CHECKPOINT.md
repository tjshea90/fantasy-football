# CHECKPOINT 75 — read me first, then TASKS.md

**Written:** 2026-10-29T01:02:44Z · **version:** 9.5 · **tests:** all 34 suites green

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
     M STATE.md

## Last ten checkpoints
```
  91ef264 ship v9.5: v9.5: restore league from the league site's capsules + schedule (rosters, sta
  2d05c5a ckpt 70: ship: v9.5: restore league from the league site's capsules + schedule (rosters,
  0776ced ckpt 68: ship: v9.5: restore league from the league site's capsules + schedule (rosters,
  427c7f9 ship v9.4: v9.4: fixed false 'NFL rosters failed' prompt before Claude; refresh now cove
  7534aec ckpt 80: ship: v9.4: fixed false 'NFL rosters failed' prompt before Claude; refresh now 
  5d6fecf ship v9.3: attach built APK
  5770f58 ship v9.3: v9.3: every Ask-Claude / share-prompt button first refreshes NFL rosters, bye
  20bd769 ckpt 67: ship: v9.3: every Ask-Claude / share-prompt button first refreshes NFL rosters,
  641c34b ckpt 65: ship: v9.3: every Ask-Claude / share-prompt button first refreshes NFL rosters,
  d3d03a2 ckpt 63: Refresh-everything-before-Claude gate (all share/ask buttons) done + test_claud
```

(2 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
