# CHECKPOINT 157 — read me first, then TASKS.md

**Written:** 2026-09-12T20:03:48Z · **version:** 5.3 · **tests:** all 13 suites green

## Just done
tasks 1-3 done: (1) added a one-time migration in Store.init() that heals a weekMeta[week].games already poisoned by the old collision bug -- rescues the per-team map into .kickoffs and reconstructs a real game count from it, verified with a real test that corrupts a saved state the way v5.2/v5.3 actually did, persists it, and re-inits from disk (test_integration.js #15); (2) fixed the ACTUAL bug behind the invisible team names -- it was never the paragraph/placeholder (that diagnosis in v5.3 was wrong), it's CSS specificity: input[type=number]{width:100%} (0,1,1) always beat .scoreInput{width:76px} (0,1,0) regardless of source order, so the box was always full-width and the team name was always squeezed to nothing. Fixed by raising .scoreInput to input.scoreInput so it ties and wins on source order. Pinned with a real specificity calculator in test_boot.js, verified it actually fails against the old selector and passes against the fix. Full suite green.

## Do this next
task 4 next: real build.sh + version bump, then task 5: fast-forward main and delete the 3 stale branches now that Tj has confirmed

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
  8b5b35f ckpt 149: wrote Tj's follow-up bug report into TASKS.md before starting -- both v5.3 fix
  8f4e9c1 ckpt 147: Data-tab bug fix + score-entry redesign job complete and archived: moved the 2
  7e13f2d ckpt 142: task 2 done: rebuilt weeklyScoresCard per Tj's exact spec -- dropped the expla
  7bde31c ckpt 138: task 1 done: fixed the [object Object] bug by giving schedule.js's per-team ki
  3caae40 ckpt 129: wrote Tj's Data-tab bug report + score-entry redesign request into TASKS.md be
  4d42e58 ckpt 127: branch-reconciliation job complete and archived: moved the 2026-09-12b request
  f58c1b8 ckpt 124: reconciliation task 8 done: bumped VERSION 5.1 -> 5.2, ran the full 13-suite r
  fd722c2 ckpt 120: reconciliation task 6 done: ported the Lineups-tab narrowing from live-tab-dua
  5c04087 ckpt 114: reconciliation task 5 done: ported the Live-tab two-box redesign from live-tab
  38f7ea5 ckpt 108: reconciliation task 4 done: added weeklyScoresCard (verbatim logic from the so
```

(7 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
