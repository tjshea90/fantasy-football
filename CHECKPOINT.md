# CHECKPOINT 58 — read me first, then TASKS.md

**Written:** 2026-11-12T19:53:20Z · **version:** 9.8 · **tests:** all 35 suites green

## Just done
fixed Jaylen Warren stuck OUT: stale Claude verdict applied to every week; now week-scoped (test_locks.js)

## Do this next
ship v9.9 + publish Release

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
  afe15bd ship v9.8: v9.8: roster row menu (and every dialog) hardened so it paints on the Roster 
  a15b42c ckpt 96: ship: v9.8: roster row menu (and every dialog) hardened so it paints on the Ros
  19fc7ad ship v9.7: v9.7: league restore offer now appears even if a week is already synced; card
  faad4e4 ckpt 85: ship: v9.7: league restore offer now appears even if a week is already synced; 
  2300495 ckpt 78: v9.6 shipped + Release verified: league restore from RTSports capsules/schedule
  c043c73 ship v9.6: v9.5: restore league from the league site's capsules + schedule (rosters, sta
  6534d96 ckpt 75: ship: v9.5: restore league from the league site's capsules + schedule (rosters,
  91ef264 ship v9.5: v9.5: restore league from the league site's capsules + schedule (rosters, sta
  2d05c5a ckpt 70: ship: v9.5: restore league from the league site's capsules + schedule (rosters,
  0776ced ckpt 68: ship: v9.5: restore league from the league site's capsules + schedule (rosters,
```

(9 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
