# CHECKPOINT 53 — read me first, then TASKS.md

**Written:** 2026-10-10T02:14:48Z · **version:** 9.0 · **tests:** all 31 suites green

## Just done
Added Tj's standing setup rules (2026-10-10: use plugins/skills/connectors, Android 16, interruption-proof ladder + cold resume) to CLAUDE.md and the session-start briefing

## Do this next
Nothing pending from this request; continue from TASKS.md. Rule text is identical in all 5 repos - edit all five to change it

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
  c436fda ckpt 107: light test of the tooling change: every caller of autosave/push/secretscan/res
  ed746a0 ckpt 105: checkpoint-system fix done (2b-2g): note.sh/WORKLOG, sessionlog.py/SESSIONLOG 
  f683ae6 ckpt 72: logged Tj's 2026-09-27b request (checkpoint system failed) in TASKS.md; 2a diag
  f432b24 ckpt 70: v9.0 shipped + GitHub Release verified (asset FFTracker-v9.0.apk, run #29); job
  4504331 ship v9.0: v9.0: lineup edits saved exactly as set through restarts (whole lineup pinned
  5a447c7 ckpt 67: light test: 30/30 green, callers of setSlot/copyLineup/gameStats/liveClock re-c
  73f42b6 ckpt 66: 1b+1c done: live DEF points-allowed held until final (Espn.gameStats state gate
```

(4 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
