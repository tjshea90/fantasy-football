# CHECKPOINT 104 — read me first, then TASKS.md

**Written:** 2026-09-12T06:06:06Z · **version:** 5.1 · **tests:** all 13 suites green

## Just done
reconciliation task 3 done: ported the manual weekly-score data layer into store.js from resume-logic-claude-code-2ye25r/live-tab-dual-scores-h2nxyf -- S.manualScores, getManualScore/setManualScore/teamWeekScore, seasonTotals routed through teamWeekScore so a hand-entered score drives win/loss. Also found and fixed a real bug the source branches both had: importJSON() defaults every other pre-existing field (lineupManual, stats, book...) onto an old backup being restored but was never updated to default manualScores too, so restoring an old backup left S.manualScores undefined and the next setManualScore/getManualScore call would throw. Added 'if (!o.manualScores) o.manualScores = {}' to match the established pattern. Added a real executed test (test_integration.js #14) that actually imports a manualScores-stripped backup and calls setManualScore afterward, rather than another source-text regex -- this is the same shape of gap as the keepAdj crash found earlier this session, so it earned a real test, not a grep.

## Do this next
task 4 next: relocate the weeklyScoresCard UI (verbatim from the source branches) plus a compact standings table onto the Data tab, since the Table tab that used to host both is deleted

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
  eb7e0b0 ckpt 96: reconciliation tasks 1-2 done: ported the more robust MainActivity.java back-bu
  fc43689 ckpt 93: wrote the branch-reconciliation job into TASKS.md before starting: full investi
  69e6b9b ckpt 91: corrected the build for Tj: per his answer, dropped consideration of porting v5
  02511da ckpt 88: CRITICAL BUG FOUND WHILE INVESTIGATING WHY TJ HAS v5.0: 'keepAdj' was reference
  fea715f ckpt 84: job complete and archived: moved the 2026-09-12 request (7/7 items) from TASKS.
  033e178 ckpt 81: verified the build: ran build.sh end-to-end (first run, downloaded the Android 
  26dc8b6 ckpt 80: tasks 3-7 done: deleted the Table/League tabs and their view code entirely (vie
  21fd85f ckpt 61: task 1 done: Android back button now unwinds a real tab-visit history (ui.js na
  84cdb98 ckpt 52: wrote Tj's new nav/UI overhaul request into TASKS.md verbatim before starting (
  3dbbef9 ckpt 50: scan fixes: ship.sh's STATE.md gate compared the CALENDAR DATE so it broke at m
```

(7 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
