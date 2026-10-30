# CHECKPOINT 96 — read me first, then TASKS.md

**Written:** 2026-10-30T02:28:26Z · **version:** 9.7 · **tests:** all 35 suites green

## Just done
ship: v9.8: roster row menu (and every dialog) hardened so it paints on the Roster tab

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
  19fc7ad ship v9.7: v9.7: league restore offer now appears even if a week is already synced; card
  faad4e4 ckpt 85: ship: v9.7: league restore offer now appears even if a week is already synced; 
  2300495 ckpt 78: v9.6 shipped + Release verified: league restore from RTSports capsules/schedule
  c043c73 ship v9.6: v9.5: restore league from the league site's capsules + schedule (rosters, sta
  6534d96 ckpt 75: ship: v9.5: restore league from the league site's capsules + schedule (rosters,
  91ef264 ship v9.5: v9.5: restore league from the league site's capsules + schedule (rosters, sta
  2d05c5a ckpt 70: ship: v9.5: restore league from the league site's capsules + schedule (rosters,
  0776ced ckpt 68: ship: v9.5: restore league from the league site's capsules + schedule (rosters,
  427c7f9 ship v9.4: v9.4: fixed false 'NFL rosters failed' prompt before Claude; refresh now cove
  7534aec ckpt 80: ship: v9.4: fixed false 'NFL rosters failed' prompt before Claude; refresh now 
```

(9 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
