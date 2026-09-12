# CHECKPOINT 91 — read me first, then TASKS.md

**Written:** 2026-09-12T05:56:48Z · **version:** 5.1 · **tests:** all 13 suites green

## Just done
corrected the build for Tj: per his answer, dropped consideration of porting v5.0's manual-score-entry feature (this branch already deletes Table/League per his original request, so nothing to port). Bumped VERSION 4.7 -> 5.1 by hand (not the normal +0.1 ship.sh bump) specifically to produce a versionCode (501) higher than the v5.0 build already on his phone from the unrelated live-tab-dual-scores-h2nxyf branch — otherwise Android refuses the install as a downgrade. Verified android/debug.keystore is byte-identical across both branches (both descend from the same v4.2-committed keystore), so this signs identically to what's on his phone and should install as a normal update, keeping his existing app data (rosters, week state) intact rather than requiring an uninstall. Rebuilt and reverified: javac/d8 clean, 25/25 classes, signature OK. Sent the v5.1 APK to Tj.

## Do this next
waiting on Tj to confirm the v5.1 APK actually installs over v5.0 on his phone without an uninstall, and to test the nav-refactor features; separately, still waiting on his direction for the 3 other stale unmerged branches and whether main should be fast-forwarded to this branch's work

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
  02511da ckpt 88: CRITICAL BUG FOUND WHILE INVESTIGATING WHY TJ HAS v5.0: 'keepAdj' was reference
  fea715f ckpt 84: job complete and archived: moved the 2026-09-12 request (7/7 items) from TASKS.
  033e178 ckpt 81: verified the build: ran build.sh end-to-end (first run, downloaded the Android 
  26dc8b6 ckpt 80: tasks 3-7 done: deleted the Table/League tabs and their view code entirely (vie
  21fd85f ckpt 61: task 1 done: Android back button now unwinds a real tab-visit history (ui.js na
  84cdb98 ckpt 52: wrote Tj's new nav/UI overhaul request into TASKS.md verbatim before starting (
  3dbbef9 ckpt 50: scan fixes: ship.sh's STATE.md gate compared the CALENDAR DATE so it broke at m
  5d3fb69 ckpt 48: usage scan: archived the finished 2026-09-09 job from TASKS.md into LADDER.md (
  1553bac ckpt 45: usage optimisation: bootstrap printed an 851-char JAVA_TOOL_OPTIONS dump into e
  53c689e ckpt 44: reverted the end-to-end handoff test: it simulated a cap landing mid-edit, push
```

(2 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
