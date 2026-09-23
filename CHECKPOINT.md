# CHECKPOINT 153 — read me first, then TASKS.md

**Written:** 2026-09-23T06:49:19Z · **version:** 8.5 · **tests:** all 23 suites green

## Just done
Full test (2026-09-23c) complete: v8.5 Release published and verified. 5 findings fixed (gamelog write storm, estimate-before-paint lag, ICU first-sort lag, duplicate scoreboard fetch, stale Data pointers), each with a test failing on v8.4.

## Do this next
Nothing in flight. Proposals 4 (league scoreboard) and 7 (light theme) remain unpicked in TASKS.md Waiting on Tj. Next: whatever Tj asks; for future full tests, node tools/perf.js --state F --crawl is the dynamic sweep (build F with --sync 1,2 --save F, then --advice --save F2).

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
  7e01358 ckpt 152: v8.5 shipped via ship.sh (23 suites + ES2018 + dex gate green, main fast-forwa
  53ebd79 ship v8.5: v8.5: full test -- game-log cache no longer rewritten whole per game every li
  ca42071 ckpt 150: Full test steps 6-8 done: engine spot-checks exact; 5 findings fixed and teste
  f79c760 ckpt 148: Full test step 5 done: gamelog write storm fixed; duplicate scoreboard fetch o
  57d29a6 ckpt 144: Full test: step 4 done (no further defects in v8.3/v8.4 diff); step 5 finding 
  9fdbc7e ckpt 140: Full-test speed finding fixed: cost-estimate lines + playoff odds now fill aft
  40bc77e ckpt 131: Full test step 3 done: perf.js --crawl (and --advice prep) — 511 actions ove
  0ea7228 ckpt 128: Full test steps 1-2 done: floor 23/23 green; CSS cross-check clean; fixed 6 st
  5749120 ckpt 125: Wrote Tj's 'Run a full test' (2026-09-23c) into TASKS.md as steps 1-9 per CLAU
  f59447c ckpt 123: v8.4 Release published and verified (FFTracker-v8.4.apk, 342294 bytes). 2026-0
```
