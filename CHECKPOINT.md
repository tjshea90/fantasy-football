# CHECKPOINT 116 — read me first, then TASKS.md

**Written:** 2026-09-11T21:52:23Z · **version:** 4.8 · **tests:** all 13 suites green

## Just done
shipped v4.8 properly: ship.sh had bumped the version and committed source with no APK in build/ (SDK wasn't installed yet in this container), so ran build.sh (installs the SDK, ~600MB first time), verified the resulting APK's dex has all 25 classes, and published it as releases/FFTracker-v4.8.apk (MANIFEST updated). Also fixed a bootstrap.sh false-positive: .claude/scheduled_tasks.lock (the ScheduleWakeup harness's own runtime file, already git-ignored) was flagged as a stray file on disk; now excluded by name the same way .ckpt/ already is.

## Do this next
all 7 of Tj's requests are done, tested, shipped, and the v4.8 APK is committed at releases/FFTracker-v4.8.apk — waiting on Tj to install it and confirm on the phone

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
  3f8496a ship v4.8: v4.8: nav/UI refactor - back button never closes the app, Table/League tabs d
  f0aedf9 ckpt 107: task 5: Roster tab is now per-team chips (defaults to my team) instead of all 
  d1bdbc7 ckpt 97: task 3: deleted the Table and League tabs entirely (viewStandings/viewLeague/pl
  91bda7d ckpt 66: task 1: android back button never closes the app (real tab-visit history + move
  faf3993 ckpt 52: wrote Tj's new nav/UI-refactor request into TASKS.md before starting
  3dbbef9 ckpt 50: scan fixes: ship.sh's STATE.md gate compared the CALENDAR DATE so it broke at m
  5d3fb69 ckpt 48: usage scan: archived the finished 2026-09-09 job from TASKS.md into LADDER.md (
  1553bac ckpt 45: usage optimisation: bootstrap printed an 851-char JAVA_TOOL_OPTIONS dump into e
  53c689e ckpt 44: reverted the end-to-end handoff test: it simulated a cap landing mid-edit, push
  07d0984 ckpt 42: wrote Tj's new request into TASKS.md before starting
```

(5 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
