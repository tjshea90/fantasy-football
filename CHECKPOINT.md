# CHECKPOINT 88 — read me first, then TASKS.md

**Written:** 2026-09-23T03:41:06Z · **version:** 8.2 · **tests:** all 22 suites green

## Just done
UI batch 2 (handoff explainer clamp, standings rank, projected-finish refinements) + a real accuracy bug fixed: liveTick never did a closing sync after the last live game went final (Monday night's last minute lost, week never marked final automatically). Schedule.needsSync + liveTick closing branch; test_schedule.js CLOSING section (fails pre-fix).

## Do this next
Write the MAJOR proposals under 'Waiting on Tj' in TASKS.md (roster PROJ/AVG columns, per-player projections on Live, merge Advice into Lineups, league scoreboard, sim.js power/playoff odds, light theme, drop-button noise). Then G full regression (exit code AND output) + Chromium smoke of every tab, then H ship.sh + publish-release + send link.

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

## Last ten checkpoints
```
  ce69753 ckpt 81: UI polish batch 1: compact header, Live projected finish + pre-kickoff projecte
  b992110 ckpt 74: Speed C4 done: MainActivity setOffscreenPreRaster(true) (build.sh green). Minif
  6bde6b1 ckpt 71: Speed C3 + C3b done: Advice loads its 4 disk caches once instead of every rende
  368bf1c ckpt 63: Speed C1+C2 done: memoized name normalization; tab taps no longer do a synchron
  0d3b0ec ckpt 56: Step A done (baseline 22 suites green). Step B in progress: wrote tools/perf.js
  1343c3d ckpt 52: Wrote Tj's 2026-09-23 request (polish/reorganize/declutter + make it snappy on 
  de3e3d6 ckpt 64: v8.2 shipped and published: triggered publish-release.yml, verified via get_rel
  d09d174 ship v8.2: v8.1: full-test sweep -- fixed a doSync() weekMeta wholesale-replace bug that
  dcd3db0 ship v8.1: v8.1: full-test sweep -- fixed a doSync() weekMeta wholesale-replace bug that
  db7e9e7 ckpt 57: Full test (2026-09-19, requested via the standing 'full tests' protocol in CLAU
```

(6 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
