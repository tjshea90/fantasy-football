# CHECKPOINT 105 — read me first, then TASKS.md

**Written:** 2026-09-23T04:26:22Z · **version:** 8.3 · **tests:** all 22 suites green

## Just done
C code done: Advice merged into Lineups as a 'Set lineups | Advice' sub-view (index.html nav now 6 tabs; lastTab 'advice' and goTab('advice') both land on Lineups -> Advice; pull-to-refresh on the Advice sub-view still runs the advice sync; 3 user-facing 'Advice tab' strings reworded). test_lifecycle TAB_NAMES updated; test_tabsafety now reads TAB_NAMES from index.html and opens Advice via the chip. All suites green.

## Do this next
D: power rankings / playoff odds card from sim.js on Data -> League. Then write tools/test_picks.js (A-E) + MANIFEST, screenshots, ship.

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
  e759e7b ckpt 101: Code for A (Roster PROJ + AVG column; new Store.playerAvg), B (Live: 'p 14.2' 
  aea9d08 ckpt 96: Wrote Tj's 2026-09-23b request ('Do number 1, 2, 3, 5, 6' of the v8.3 proposals
  d1d42a7 ckpt 94: v8.3 Release published and verified (get_release_by_tag v8.3: FFTracker-v8.3.ap
  21d2546 ckpt 93: v8.3 shipped via ship.sh (all 22 suites + ES2018 + dex gate green, APK built, m
  483bd59 ship v8.3: v8.3: speed + polish pass for the Moto G 2026 -- tab taps no longer fsync, me
  6b27037 ckpt 90: Steps B-F ticked: MAJOR proposals 1-7 written under Waiting on Tj (roster PROJ/
  e2ee784 ckpt 88: UI batch 2 (handoff explainer clamp, standings rank, projected-finish refinemen
  ce69753 ckpt 81: UI polish batch 1: compact header, Live projected finish + pre-kickoff projecte
  b992110 ckpt 74: Speed C4 done: MainActivity setOffscreenPreRaster(true) (build.sh green). Minif
  6bde6b1 ckpt 71: Speed C3 + C3b done: Advice loads its 4 disk caches once instead of every rende
```

(3 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
