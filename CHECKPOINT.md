# CHECKPOINT 92 — read me first, then TASKS.md

**Written:** 2026-09-24T18:26:49Z · **version:** 8.5 · **tests:** all 25 suites green

## Just done
Fixed F1-F8, F12, F13 (ui.js/recommend.js/sim.js) + F6 sim random pairing for unentered matchups (full schedule byte-identical to v8.5). New test_picks block 'FULL TEST 2026-09-24' (18 checks, 13 fail on v8.5); test_boot injury-note pin updated. All suites green; APK builds (29 classes).

## Do this next
Chromium screenshots of the changed screens (Live DNP, Roster row, Wire injury clamp, Advice row, Data odds note); then step 7 research write-up of ESPN/Sleeper/Yahoo/FantasyPros features -> SMALL vs MAJOR proposals; then full regression + ship.

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
  93d7c82 ckpt 81: F11 fixed: new JsonSlim.java (plain-Java JSON member cutter) used by NativeBrid
  2434fca ckpt 70: F9 (manual adjustment lost on cold start) + F10 (live-poll archive/backup write
  b639867 ckpt 60: Full test steps 3-5 done: crawl 275 actions/0 problems on state G; v8.5 diff cl
  fc9c4a3 ckpt 58: Full test steps 1 (floor 23/23 green, exit code + output) and 2 (CSS cross-chec
  ba62218 ckpt 53: Wrote Tj's 2026-09-24 'full test + what other popular FF apps have (incl. UI/ap
  5ae3e5d ckpt 153: Full test (2026-09-23c) complete: v8.5 Release published and verified. 5 findi
  7e01358 ckpt 152: v8.5 shipped via ship.sh (23 suites + ES2018 + dex gate green, main fast-forwa
  53ebd79 ship v8.5: v8.5: full test -- game-log cache no longer rewritten whole per game every li
  ca42071 ckpt 150: Full test steps 6-8 done: engine spot-checks exact; 5 findings fixed and teste
  f79c760 ckpt 148: Full test step 5 done: gamelog write storm fixed; duplicate scoreboard fetch o
```

(10 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
