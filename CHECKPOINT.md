# CHECKPOINT 56 — read me first, then TASKS.md

**Written:** 2026-09-23T03:11:31Z · **version:** 8.2 · **tests:** all 22 suites green

## Just done
Step A done (baseline 22 suites green). Step B in progress: wrote tools/perf.js (headless Chromium, 4x CPU throttle, stubbed Native bridge proxying REAL network via curl). Baseline at 4x: boot first-content ~300-450ms; tab switch js(ms) live~?, lineups 27, rosters 77-101, wire 71-107, stats 9, advice 14-34, data 18-23. Hotspots from --profile: Espn.normName/Names.canon/variants dominate Rosters+Wire (~100ms); curScroll forced layout; Advice parses 383KB season-projection cache on every render (loadSeasonCache 34ms + parseBody 143ms); every tab tap does a full synchronous Store.save (fsync on device) just to record lastTab. Fixture state (real weeks 1-2 synced + round-robin matchups) is only in the scratchpad: regenerate with node tools/perf.js --sync 1,2 --save FILE.

## Do this next
Finish B (boot profile), then C: memoize name normalization, stop the per-tap save (defer lastTab to a coalesced save flushed on __appPause), stop re-parsing the season projection cache per render, avoid forced layouts. Then D/E UI survey from screenshots.

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
     M tools/perf.js

## Last ten checkpoints
```
  1343c3d ckpt 52: Wrote Tj's 2026-09-23 request (polish/reorganize/declutter + make it snappy on 
  de3e3d6 ckpt 64: v8.2 shipped and published: triggered publish-release.yml, verified via get_rel
  d09d174 ship v8.2: v8.1: full-test sweep -- fixed a doSync() weekMeta wholesale-replace bug that
  dcd3db0 ship v8.1: v8.1: full-test sweep -- fixed a doSync() weekMeta wholesale-replace bug that
  db7e9e7 ckpt 57: Full test (2026-09-19, requested via the standing 'full tests' protocol in CLAU
  8c4d8d7 ckpt 54: Full-test sweep (2026-09-19, second pass): found and fixed a real caching/data-
  798e0e4 ckpt 54: Wrote Tj's standing 'light tests'/'full tests' request into CLAUDE.md as a perm
  950bca6 ckpt 114: Shipped v8.0 and published the GitHub Release: triggered publish-release.yml, 
  f586fc2 ship v8.0: v8.0: overall UI/code improvement sweep -- five real fixes, a stale docs bug,
  7f83117 ckpt 108: Real, user-facing bug found and fixed: the Scoring rules card (Data tab) told 
```

(3 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
