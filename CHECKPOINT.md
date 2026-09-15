# CHECKPOINT 454 — read me first, then TASKS.md

**Written:** 2026-09-15T17:47:40Z · **version:** 6.7 · **tests:** all 14 suites green

## Just done
Recorded new job 2026-09-15i in TASKS.md: a real premise change -- Tj will only track his own and his weekly opponent's lineups, never the other 8 teams'. Need to find and remove everything assuming other teams' weekly lineups, then assess whether deducing a team's starters from their roster's per-player points and a manually-typed total score is actually feasible (position-slot-constrained subset-sum against real scoring data -- ties and ambiguity are a real risk, feasibility must be checked before promising it), and either implement it cleanly or remove the lineup-assuming code if it doesn't hold up.

## Do this next
Start step 1: grep the whole app for every place that reads Store.getLineup/lineup-derived data for a team that is not S.league.me and not that week's opponent -- recap.js's build() (best/worst starter, biggest bust, bench regret) is the known one, but check value.js, sim.js, standings and anywhere else iterating S.teams. Then step 2: assess deduction feasibility with real data before deciding whether to build it.

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
  b7104ad ckpt 451: v6.7 shipped and verified: GitHub Release published (non-empty assets, FFTrack
  adb8ee4 ship v6.7: 2026-09-15g: wired up the weekly recap Claude write-up feature (Recap.build/t
  6989a9e ckpt 448: Removed two scratch Playwright test scripts (tools/_data_tab_check.js, tools/_
  3f6499e ckpt 446: 2026-09-15g documentation complete: TASKS.md ticked with full proof and reset 
  f923c2d ckpt 428: v6.6 shipped and verified: GitHub Release published (non-empty assets, FFTrack
  a2f35cf ship v6.6: 2026-09-15h: the week-advance fix still failed on a true cold boot -- added l
  dafed68 ckpt 424: Documented 2026-09-15h fix: TASKS.md job entry with steps 1-3 ticked (step 4 p
  687d92b ckpt 420: Fixed the week-advance bug for real this time (Tj reported it persisting even 
  336f833 ckpt 414: In progress on 2026-09-15g (recap feature + Data tab sub-nav): built weeklyRec
  a0d725b ckpt 403: Recorded new job 2026-09-15g in TASKS.md: wire up the weekly recap Claude writ
```

(2 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
