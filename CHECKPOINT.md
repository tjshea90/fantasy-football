# CHECKPOINT 118 — read me first, then TASKS.md

**Written:** 2026-09-23T04:39:51Z · **version:** 8.3 · **tests:** all 23 suites green

## Just done
A-E all done and tested: new tools/test_picks.js (32 render-level checks across #1 #2 #3 #5 #6; D's humility check confirmed failing on the v8.3 sim.js). TASKS.md A-E ticked.

## Do this next
F: full regression (exit code AND output) + Chromium smoke; then G: STATE.md v8.4 entry, bash build.sh, bash ship.sh, dispatch publish-release.yml (version 8.4), verify with get_release_by_tag, send Tj the link.

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
     M TASKS.md
     M tools/test_picks.js

## Last ten checkpoints
```
  73ee643 ckpt 114: D code done: Power rankings · playoff odds card on Data -> League (Sim.power 
  834ac6b ckpt 105: C code done: Advice merged into Lineups as a 'Set lineups | Advice' sub-view (
  e759e7b ckpt 101: Code for A (Roster PROJ + AVG column; new Store.playerAvg), B (Live: 'p 14.2' 
  aea9d08 ckpt 96: Wrote Tj's 2026-09-23b request ('Do number 1, 2, 3, 5, 6' of the v8.3 proposals
  d1d42a7 ckpt 94: v8.3 Release published and verified (get_release_by_tag v8.3: FFTracker-v8.3.ap
  21d2546 ckpt 93: v8.3 shipped via ship.sh (all 22 suites + ES2018 + dex gate green, APK built, m
  483bd59 ship v8.3: v8.3: speed + polish pass for the Moto G 2026 -- tab taps no longer fsync, me
  6b27037 ckpt 90: Steps B-F ticked: MAJOR proposals 1-7 written under Waiting on Tj (roster PROJ/
  e2ee784 ckpt 88: UI batch 2 (handoff explainer clamp, standings rank, projected-finish refinemen
  ce69753 ckpt 81: UI polish batch 1: compact header, Live projected finish + pre-kickoff projecte
```

(3 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
