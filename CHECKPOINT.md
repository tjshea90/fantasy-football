# CHECKPOINT 60 — read me first, then TASKS.md

**Written:** 2026-09-24T18:07:25Z · **version:** 8.5 · **tests:** all 23 suites green

## Just done
Full test steps 3-5 done: crawl 275 actions/0 problems on state G; v8.5 diff clean; data/network/battery review found F9 (manual adjustment never persisted), F10 (live-poll archive+backup write storm), F11 (8.76 MB injuries feed parsed on the JS thread every 10 min). F12/F13 copy/order nits. All in TASKS.md.

## Do this next
Step 8 fixes in this order: F9, F10 (store.js lazy archive + saveLive), F11 (JsonSlim.java + NativeBridge + recommend.js header), F6 (sim random pairing), F4, F5, F1/F2, F3/F7/F8/F12/F13 — each with a test failing on v8.5. Then step 7 research write-up.

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
  fc9c4a3 ckpt 58: Full test steps 1 (floor 23/23 green, exit code + output) and 2 (CSS cross-chec
  ba62218 ckpt 53: Wrote Tj's 2026-09-24 'full test + what other popular FF apps have (incl. UI/ap
  5ae3e5d ckpt 153: Full test (2026-09-23c) complete: v8.5 Release published and verified. 5 findi
  7e01358 ckpt 152: v8.5 shipped via ship.sh (23 suites + ES2018 + dex gate green, main fast-forwa
  53ebd79 ship v8.5: v8.5: full test -- game-log cache no longer rewritten whole per game every li
  ca42071 ckpt 150: Full test steps 6-8 done: engine spot-checks exact; 5 findings fixed and teste
  f79c760 ckpt 148: Full test step 5 done: gamelog write storm fixed; duplicate scoreboard fetch o
  57d29a6 ckpt 144: Full test: step 4 done (no further defects in v8.3/v8.4 diff); step 5 finding 
  9fdbc7e ckpt 140: Full-test speed finding fixed: cost-estimate lines + playoff odds now fill aft
  40bc77e ckpt 131: Full test step 3 done: perf.js --crawl (and --advice prep) — 511 actions ove
```

(1 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
