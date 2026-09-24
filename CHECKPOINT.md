# CHECKPOINT 121 — read me first, then TASKS.md

**Written:** 2026-09-24T19:01:43Z · **version:** 8.5 · **tests:** all 26 suites green

## Just done
Step 7 done: proposals 1-10 in TASKS 'Waiting on Tj' (win prob, position colours, Q/D/O badges, light theme, scoreboard, matchup chip, trending, one player card, inactives alert, Data order) + mockups via new perf.js --inject. STATE.md v8.6 entry written. Final regression: 26 suites green by exit code + output; CSS 0/0.

## Do this next
Waiting on the final crawls (real-data + cold) and build.sh; then bash ship.sh, trigger publish-release.yml for 8.6, verify, send Tj the link + mockups + proposals.

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
  c3b1759 ckpt 116: F17 fixed: a failed injury-feed fetch no longer wipes (and saves) an empty inj
  58a69eb ckpt 110: F15 (a failed projection refresh wiped this week's/season's loaded projections
  dfaf97e ckpt 105: F14 fixed (doSync: a failed box score no longer wipes that game's stored lines
  8edc7cf ckpt 99: Small polish from the competitor survey: live game clock on the schedule badge 
  4c4845e ckpt 92: Fixed F1-F8, F12, F13 (ui.js/recommend.js/sim.js) + F6 sim random pairing for u
  93d7c82 ckpt 81: F11 fixed: new JsonSlim.java (plain-Java JSON member cutter) used by NativeBrid
  2434fca ckpt 70: F9 (manual adjustment lost on cold start) + F10 (live-poll archive/backup write
  b639867 ckpt 60: Full test steps 3-5 done: crawl 275 actions/0 problems on state G; v8.5 diff cl
  fc9c4a3 ckpt 58: Full test steps 1 (floor 23/23 green, exit code + output) and 2 (CSS cross-chec
  ba62218 ckpt 53: Wrote Tj's 2026-09-24 'full test + what other popular FF apps have (incl. UI/ap
```

(4 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
