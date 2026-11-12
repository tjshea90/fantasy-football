# CHECKPOINT 68 — read me first, then TASKS.md

**Written:** 2026-11-12T20:00:24Z · **version:** 10.0 · **tests:** all 35 suites green

## Just done
shipped v10.0 (Warren OUT fix); publish-release dispatched for 10.0

## Do this next
verify Release v10.0 has the APK asset; Tj verifies Warren no longer O on phone

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
  64e5e82 ship v10.0: v10.0: Claude injury verdicts apply only to the week they were made for (fix
  343c3c7 ship v9.9: v9.9: Claude injury verdicts now apply only to the week they were made for (f
  731b069 ckpt 60: ship: v9.9: Claude injury verdicts now apply only to the week they were made fo
  6ce61f9 ckpt 58: fixed Jaylen Warren stuck OUT: stale Claude verdict applied to every week; now 
  afe15bd ship v9.8: v9.8: roster row menu (and every dialog) hardened so it paints on the Roster 
  a15b42c ckpt 96: ship: v9.8: roster row menu (and every dialog) hardened so it paints on the Ros
  19fc7ad ship v9.7: v9.7: league restore offer now appears even if a week is already synced; card
  faad4e4 ckpt 85: ship: v9.7: league restore offer now appears even if a week is already synced; 
  2300495 ckpt 78: v9.6 shipped + Release verified: league restore from RTSports capsules/schedule
  c043c73 ship v9.6: v9.5: restore league from the league site's capsules + schedule (rosters, sta
```

(1 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
