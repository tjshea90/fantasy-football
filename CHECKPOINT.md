# CHECKPOINT 149 — read me first, then TASKS.md

**Written:** 2026-09-12T19:59:44Z · **version:** 5.3 · **tests:** all 13 suites green

## Just done
wrote Tj's follow-up bug report into TASKS.md before starting -- both v5.3 fixes were incomplete. Root-caused both for real: (1) the [object Object] fix only stopped the write going forward, never migrated the value already corrupted on Tj's phone from before v5.3 installed; (2) the earlier 'blank fields' diagnosis was WRONG -- it's a genuine CSS specificity bug, .scoreInput{width:76px} (specificity 0,1,0) loses to the base input[type=number]{width:100%} rule (specificity 0,1,1) regardless of source order, so the input has always rendered full-width and squeezed the team-name div to nothing, since the reconciliation job introduced it. Also logged: Tj confirmed repo cleanup (fast-forward main, delete 3 stale branches) and asked that future builds not branch -- noting honestly that branch assignment for a NEW session is a platform decision this repo can't bind, only that main can be kept current and CLAUDE.md can instruct future sessions to check it.

## Do this next
start on task 1: migrate corrupted weekMeta[week].games in Store.init()

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
  8f4e9c1 ckpt 147: Data-tab bug fix + score-entry redesign job complete and archived: moved the 2
  7e13f2d ckpt 142: task 2 done: rebuilt weeklyScoresCard per Tj's exact spec -- dropped the expla
  7bde31c ckpt 138: task 1 done: fixed the [object Object] bug by giving schedule.js's per-team ki
  3caae40 ckpt 129: wrote Tj's Data-tab bug report + score-entry redesign request into TASKS.md be
  4d42e58 ckpt 127: branch-reconciliation job complete and archived: moved the 2026-09-12b request
  f58c1b8 ckpt 124: reconciliation task 8 done: bumped VERSION 5.1 -> 5.2, ran the full 13-suite r
  fd722c2 ckpt 120: reconciliation task 6 done: ported the Lineups-tab narrowing from live-tab-dua
  5c04087 ckpt 114: reconciliation task 5 done: ported the Live-tab two-box redesign from live-tab
  38f7ea5 ckpt 108: reconciliation task 4 done: added weeklyScoresCard (verbatim logic from the so
  e612ec0 ckpt 104: reconciliation task 3 done: ported the manual weekly-score data layer into sto
```

(1 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
