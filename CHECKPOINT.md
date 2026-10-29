# CHECKPOINT 78 — read me first, then TASKS.md

**Written:** 2026-10-29T01:05:57Z · **version:** 9.6 · **tests:** all 34 suites green

## Just done
v9.6 shipped + Release verified: league restore from RTSports capsules/schedule

## Do this next
Tj installs v9.6, taps Restore on first launch, then 'Load past weeks NFL stats'; confirm standings match site

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
  c043c73 ship v9.6: v9.5: restore league from the league site's capsules + schedule (rosters, sta
  6534d96 ckpt 75: ship: v9.5: restore league from the league site's capsules + schedule (rosters,
  91ef264 ship v9.5: v9.5: restore league from the league site's capsules + schedule (rosters, sta
  2d05c5a ckpt 70: ship: v9.5: restore league from the league site's capsules + schedule (rosters,
  0776ced ckpt 68: ship: v9.5: restore league from the league site's capsules + schedule (rosters,
  427c7f9 ship v9.4: v9.4: fixed false 'NFL rosters failed' prompt before Claude; refresh now cove
  7534aec ckpt 80: ship: v9.4: fixed false 'NFL rosters failed' prompt before Claude; refresh now 
  5d6fecf ship v9.3: attach built APK
  5770f58 ship v9.3: v9.3: every Ask-Claude / share-prompt button first refreshes NFL rosters, bye
  20bd769 ckpt 67: ship: v9.3: every Ask-Claude / share-prompt button first refreshes NFL rosters,
```

(1 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
