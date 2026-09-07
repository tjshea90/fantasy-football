# CHECKPOINT 2 — read me first, then TASKS.md

**Written:** 2026-09-07T18:42:56Z · **version:** 4.2 · **tests:** all 6 suites green

## Just done
Checkpoint system in place: git history, tools/ckpt.sh, CHECKPOINT.md, TASKS.md. bootstrap.sh now prints a ~120-line briefing instead of 1,200 lines. ship.sh zips .git so history survives the chat.

## Do this next
Task 1a — diagnose and fix the Claude JSON failure in ai.js jsonOf/parseSse.

## How to resume, exactly
```bash
cd "$(dirname "$0")"   # wherever this bundle was unzipped
bash bootstrap.sh          # prints this file, TASKS.md and the git log
```
Then continue from **Do this next** above. Do not re-plan, do not re-read
finished work, do not ask Tj to re-explain anything — `TASKS.md` carries his
request in his own words and `git log` carries every step already taken.

## Uncommitted right now
     M .gitignore
    D  .lastbuild/app-release.apk
     M MANIFEST.txt
     M bootstrap.sh
     M ship.sh
    ?? CHECKPOINT.md
    ?? TASKS.md
    ?? tools/ckpt.sh

## Last ten checkpoints
```
  0ec30f1 v4.2 baseline — the zip Tj uploaded, all 5 suites green
```
