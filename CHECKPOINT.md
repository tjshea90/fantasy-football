# CHECKPOINT 114 — read me first, then TASKS.md

**Written:** 2026-09-12T06:10:08Z · **version:** 5.1 · **tests:** all 13 suites green

## Just done
reconciliation task 5 done: ported the Live-tab two-box redesign from live-tab-dual-scores-h2nxyf -- myMatchupCard now builds two liveScoreBox halves (name, live total, yet-to-play count, open lineup) side by side under a shared win/lose banner, replacing the old single merged card. Matches what Tj told that session directly: 'nothing else should be in the live tab' -- so also dropped the early-game alert and feed-warning banner from Live (early-game alert already lives on Lineups and Advice too; feed-warning moved to the top of the Data tab). Removed the now-unused .mu/.side/.vs CSS, added .mu2/.halfbox for the two-box layout. Full suite green.

## Do this next
task 6 next: port the Lineups-tab narrowing to just my team + this week's opponent (autoFillTeam split out of autoFillWeek) from the same branch

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
  38f7ea5 ckpt 108: reconciliation task 4 done: added weeklyScoresCard (verbatim logic from the so
  e612ec0 ckpt 104: reconciliation task 3 done: ported the manual weekly-score data layer into sto
  eb7e0b0 ckpt 96: reconciliation tasks 1-2 done: ported the more robust MainActivity.java back-bu
  fc43689 ckpt 93: wrote the branch-reconciliation job into TASKS.md before starting: full investi
  69e6b9b ckpt 91: corrected the build for Tj: per his answer, dropped consideration of porting v5
  02511da ckpt 88: CRITICAL BUG FOUND WHILE INVESTIGATING WHY TJ HAS v5.0: 'keepAdj' was reference
  fea715f ckpt 84: job complete and archived: moved the 2026-09-12 request (7/7 items) from TASKS.
  033e178 ckpt 81: verified the build: ran build.sh end-to-end (first run, downloaded the Android 
  26dc8b6 ckpt 80: tasks 3-7 done: deleted the Table/League tabs and their view code entirely (vie
  21fd85f ckpt 61: task 1 done: Android back button now unwinds a real tab-visit history (ui.js na
```

(5 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
