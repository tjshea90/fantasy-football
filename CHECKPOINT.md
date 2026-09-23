# CHECKPOINT 74 — read me first, then TASKS.md

**Written:** 2026-09-23T03:26:38Z · **version:** 8.2 · **tests:** all 22 suites green

## Just done
Speed C4 done: MainActivity setOffscreenPreRaster(true) (build.sh green). Minification rejected (would wreck the error card's stack traces). Step C complete.

## Do this next
Step D/E UI polish, in this order: (1) compact header — move #syncBtn into .hrow so the sync status becomes one small text line (~27px back on every tab); (2) Wire swap rows: button wraps under the text instead of squeezing it (.row.wrap); (3) Wire FA board rows: basis/usage fine print smaller + 2-line clamp, tap to expand; (4) Live: DEF shows team nickname not 'Seattle Seah...'; (5) Live pre-game banner 'Level' -> projected totals. Screenshots: node tools/perf.js --state F --shots DIR (F = scratchpad fixture; rebuild with --sync 1,2 --save F if gone).

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
  6bde6b1 ckpt 71: Speed C3 + C3b done: Advice loads its 4 disk caches once instead of every rende
  368bf1c ckpt 63: Speed C1+C2 done: memoized name normalization; tab taps no longer do a synchron
  0d3b0ec ckpt 56: Step A done (baseline 22 suites green). Step B in progress: wrote tools/perf.js
  1343c3d ckpt 52: Wrote Tj's 2026-09-23 request (polish/reorganize/declutter + make it snappy on 
  de3e3d6 ckpt 64: v8.2 shipped and published: triggered publish-release.yml, verified via get_rel
  d09d174 ship v8.2: v8.1: full-test sweep -- fixed a doSync() weekMeta wholesale-replace bug that
  dcd3db0 ship v8.1: v8.1: full-test sweep -- fixed a doSync() weekMeta wholesale-replace bug that
  db7e9e7 ckpt 57: Full test (2026-09-19, requested via the standing 'full tests' protocol in CLAU
  8c4d8d7 ckpt 54: Full-test sweep (2026-09-19, second pass): found and fixed a real caching/data-
  798e0e4 ckpt 54: Wrote Tj's standing 'light tests'/'full tests' request into CLAUDE.md as a perm
```

(2 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
