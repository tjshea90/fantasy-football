# CHECKPOINT 120 — read me first, then TASKS.md

**Written:** 2026-09-12T06:12:20Z · **version:** 5.1 · **tests:** all 13 suites green

## Just done
reconciliation task 6 done: ported the Lineups-tab narrowing from live-tab-dual-scores-h2nxyf -- autoFillTeam split out of autoFillWeek so it can run for a single team, viewLineups now resolves mine + this week's opponent off the schedule and shows only those two lineupCards (with a 'no opponent set' placeholder if none), and the re-default button/confirm text is scoped to whichever of the two teams are actually shown ('Re-default both lineups now' vs 'Re-default my lineup now' with no opponent set). The other ~8 teams still auto-fill silently in the background since autoFillWeek is untouched. Updated test_integration.js's button-locator (searched for literal text 'Re-default all teams now', which no longer exists -- now locates the handler by refill.addEventListener instead). Full suite green.

## Do this next
task 7/8 next: nothing further to actively port (task 7 is a no-op decision already recorded), so run the full regression + build.sh, bump VERSION, and re-send Tj the reconciled APK

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
  5c04087 ckpt 114: reconciliation task 5 done: ported the Live-tab two-box redesign from live-tab
  38f7ea5 ckpt 108: reconciliation task 4 done: added weeklyScoresCard (verbatim logic from the so
  e612ec0 ckpt 104: reconciliation task 3 done: ported the manual weekly-score data layer into sto
  eb7e0b0 ckpt 96: reconciliation tasks 1-2 done: ported the more robust MainActivity.java back-bu
  fc43689 ckpt 93: wrote the branch-reconciliation job into TASKS.md before starting: full investi
  69e6b9b ckpt 91: corrected the build for Tj: per his answer, dropped consideration of porting v5
  02511da ckpt 88: CRITICAL BUG FOUND WHILE INVESTIGATING WHY TJ HAS v5.0: 'keepAdj' was reference
  fea715f ckpt 84: job complete and archived: moved the 2026-09-12 request (7/7 items) from TASKS.
  033e178 ckpt 81: verified the build: ran build.sh end-to-end (first run, downloaded the Android 
  26dc8b6 ckpt 80: tasks 3-7 done: deleted the Table/League tabs and their view code entirely (vie
```

(5 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
