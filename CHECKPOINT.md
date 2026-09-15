# CHECKPOINT 473 — read me first, then TASKS.md

**Written:** 2026-09-15T18:11:32Z · **version:** 6.7 · **tests:** all 15 suites green

## Just done
Removed the other-teams-weekly-lineup assumption from recap.js/sim.js per Tj's request (he only ever tracks his own + his weekly opponent's real lineup). Built Store.inferLineup() — a slot-constrained backtracking solver that works backward from a team's manually-entered score to which of their own roster's players summed to it, stress-tested at 29/30 unique on realistic data — and wired it into recap.js's starters/busts/bench-regret (only trusted when unique, never guessed). Fixed 3 independent teamWeekPoints-vs-teamWeekScore bugs in sim.js (allPlay/teamProfile/season) plus a .pts/.total typo that was silently producing NaN season projections. Removed Sim.matchup/lineupMeans (confirmed zero callers, and their premise no longer holds for 8 of 10 teams). New tools/test_recap.js (22 real-execution assertions) plus a live-browser check of the actual recap dialog, both green; full suite + ES2018 gate + build.sh all green.

## Do this next
TASKS.md's 2026-09-15i job is fully done (all 4 boxes ticked with proof) and not yet shipped — next step is bash ship.sh, then the standard post-ship GitHub Release + STATE.md/LADDER.md write-up.

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
  a083cad ckpt 454: Recorded new job 2026-09-15i in TASKS.md: a real premise change -- Tj will onl
  b7104ad ckpt 451: v6.7 shipped and verified: GitHub Release published (non-empty assets, FFTrack
  adb8ee4 ship v6.7: 2026-09-15g: wired up the weekly recap Claude write-up feature (Recap.build/t
  6989a9e ckpt 448: Removed two scratch Playwright test scripts (tools/_data_tab_check.js, tools/_
  3f6499e ckpt 446: 2026-09-15g documentation complete: TASKS.md ticked with full proof and reset 
  f923c2d ckpt 428: v6.6 shipped and verified: GitHub Release published (non-empty assets, FFTrack
  a2f35cf ship v6.6: 2026-09-15h: the week-advance fix still failed on a true cold boot -- added l
  dafed68 ckpt 424: Documented 2026-09-15h fix: TASKS.md job entry with steps 1-3 ticked (step 4 p
  687d92b ckpt 420: Fixed the week-advance bug for real this time (Tj reported it persisting even 
  336f833 ckpt 414: In progress on 2026-09-15g (recap feature + Data tab sub-nav): built weeklyRec
```

(18 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
