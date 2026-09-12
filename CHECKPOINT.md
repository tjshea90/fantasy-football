# CHECKPOINT 129 — read me first, then TASKS.md

**Written:** 2026-09-12T18:28:34Z · **version:** 5.2 · **tests:** all 13 suites green

## Just done
wrote Tj's Data-tab bug report + score-entry redesign request into TASKS.md before starting. Root-caused the [object Object] bug already: schedule.js's ingest() writes a per-NFL-team kickoff map into weekMeta[week].games, the exact same key doSync (ui.js) and gameStarted() (store.js) use for two DIFFERENT things (a plain game count, and that same per-team map respectively) -- a genuine field-name collision, not new to this session. Alerts.java also reads this key natively from the persisted state file. Plan: rename schedule.js's field to weekMeta[week].kickoffs everywhere (schedule.js, store.js's gameStarted, Alerts.java, and the weekMeta test fixtures in test_locks.js/test_schedule.js), not a display-site workaround.

## Do this next
start on task 1: the kickoffs rename across schedule.js/store.js/Alerts.java/tests

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
  4d42e58 ckpt 127: branch-reconciliation job complete and archived: moved the 2026-09-12b request
  f58c1b8 ckpt 124: reconciliation task 8 done: bumped VERSION 5.1 -> 5.2, ran the full 13-suite r
  fd722c2 ckpt 120: reconciliation task 6 done: ported the Lineups-tab narrowing from live-tab-dua
  5c04087 ckpt 114: reconciliation task 5 done: ported the Live-tab two-box redesign from live-tab
  38f7ea5 ckpt 108: reconciliation task 4 done: added weeklyScoresCard (verbatim logic from the so
  e612ec0 ckpt 104: reconciliation task 3 done: ported the manual weekly-score data layer into sto
  eb7e0b0 ckpt 96: reconciliation tasks 1-2 done: ported the more robust MainActivity.java back-bu
  fc43689 ckpt 93: wrote the branch-reconciliation job into TASKS.md before starting: full investi
  69e6b9b ckpt 91: corrected the build for Tj: per his answer, dropped consideration of porting v5
  02511da ckpt 88: CRITICAL BUG FOUND WHILE INVESTIGATING WHY TJ HAS v5.0: 'keepAdj' was reference
```

(1 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
