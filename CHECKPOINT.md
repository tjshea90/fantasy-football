# CHECKPOINT 114 — read me first, then TASKS.md

**Written:** 2026-09-23T04:36:22Z · **version:** 8.3 · **tests:** all 22 suites green

## Just done
D code done: Power rankings · playoff odds card on Data -> League (Sim.power instant; Sim.season cached on store generation and computed 60ms after paint, patched in place). Sim.season rewritten: empirical-Bayes posterior on each team's true mean (was: measured mean treated as truth -> 100%/55% after 2 weeks; now 99%/39%, tails non-zero) with sigma blended toward an 18%-of-mean prior for 12 team-weeks; flat typed-array loop ~300ms -> ~110ms at 4x; dead game()/bracket() removed. test_boot sim pin updated. perf.js reads tabs from the DOM + measures lineups>Advice. All suites green; screenshots verified (Live p-values sum to the team projection).

## Do this next
Write tools/test_picks.js covering A (Store.playerAvg + roster PROJ/AVG render), B (Live pproj only for not-yet-played), C (6 tabs, lastTab 'advice' -> Lineups/Advice, goTab('advice'), chip switch), D (odds sum to 6 playoff / 2 bye / 1 title; early-season humility; sharpens with more weeks; card renders), E (no red Drop in roster rows; ⋯ opens menu with Drop). Add to MANIFEST.txt. Then STATE.md entry, ship.sh, publish release.

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
  834ac6b ckpt 105: C code done: Advice merged into Lineups as a 'Set lineups | Advice' sub-view (
  e759e7b ckpt 101: Code for A (Roster PROJ + AVG column; new Store.playerAvg), B (Live: 'p 14.2' 
  aea9d08 ckpt 96: Wrote Tj's 2026-09-23b request ('Do number 1, 2, 3, 5, 6' of the v8.3 proposals
  d1d42a7 ckpt 94: v8.3 Release published and verified (get_release_by_tag v8.3: FFTracker-v8.3.ap
  21d2546 ckpt 93: v8.3 shipped via ship.sh (all 22 suites + ES2018 + dex gate green, APK built, m
  483bd59 ship v8.3: v8.3: speed + polish pass for the Moto G 2026 -- tab taps no longer fsync, me
  6b27037 ckpt 90: Steps B-F ticked: MAJOR proposals 1-7 written under Waiting on Tj (roster PROJ/
  e2ee784 ckpt 88: UI batch 2 (handoff explainer clamp, standings rank, projected-finish refinemen
  ce69753 ckpt 81: UI polish batch 1: compact header, Live projected finish + pre-kickoff projecte
  b992110 ckpt 74: Speed C4 done: MainActivity setOffscreenPreRaster(true) (build.sh green). Minif
```

(8 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
