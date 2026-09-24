# CHECKPOINT 116 — read me first, then TASKS.md

**Written:** 2026-09-24T18:55:14Z · **version:** 8.5 · **tests:** all 26 suites green

## Just done
F17 fixed: a failed injury-feed fetch no longer wipes (and saves) an empty injury list — OUT/IR players stayed 'healthy' to auto-lineup/Advice/Wire until the next good fetch. test_retention.js §3 (5 of 6 fail on v8.5). All suites green.

## Do this next
Step 7: competitor-survey proposals into TASKS 'Waiting on Tj' + mockup screenshots; then step 9 full regression + crawl + build; then ship v8.6.

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
  58a69eb ckpt 110: F15 (a failed projection refresh wiped this week's/season's loaded projections
  dfaf97e ckpt 105: F14 fixed (doSync: a failed box score no longer wipes that game's stored lines
  8edc7cf ckpt 99: Small polish from the competitor survey: live game clock on the schedule badge 
  4c4845e ckpt 92: Fixed F1-F8, F12, F13 (ui.js/recommend.js/sim.js) + F6 sim random pairing for u
  93d7c82 ckpt 81: F11 fixed: new JsonSlim.java (plain-Java JSON member cutter) used by NativeBrid
  2434fca ckpt 70: F9 (manual adjustment lost on cold start) + F10 (live-poll archive/backup write
  b639867 ckpt 60: Full test steps 3-5 done: crawl 275 actions/0 problems on state G; v8.5 diff cl
  fc9c4a3 ckpt 58: Full test steps 1 (floor 23/23 green, exit code + output) and 2 (CSS cross-chec
  ba62218 ckpt 53: Wrote Tj's 2026-09-24 'full test + what other popular FF apps have (incl. UI/ap
  5ae3e5d ckpt 153: Full test (2026-09-23c) complete: v8.5 Release published and verified. 5 findi
```

(5 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
