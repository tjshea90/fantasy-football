# CHECKPOINT 71 — read me first, then TASKS.md

**Written:** 2026-09-23T03:23:53Z · **version:** 8.2 · **tests:** all 22 suites green

## Just done
Speed C3 + C3b done: Advice loads its 4 disk caches once instead of every render; boot/Lineups auto-fill does ONE save for the league instead of one per team (10 sync writes before first paint -> 1). Both pinned in test_tabsafety.js, confirmed failing on pre-fix snapshot. perf.js gained --bootprofile and --tracesaves. Now at 4x: boot ~386ms (scripts ~190, boot() ~150), tabs: live 15, lineups 19, rosters 14, wire 29, stats 5, advice 9, data 19 ms.

## Do this next
C4: WebView settings in MainActivity (setOffscreenPreRaster(true) etc.), check CSS cost, consider script parse cost (~190ms at 4x for ~870KB with ~25% comments; minifying would hurt readable error stacks — likely skip). Then D: UI survey + small polish items (compact header, Wire row density, swap-button layout, Data tab order, DEF name truncation on Live).

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
  368bf1c ckpt 63: Speed C1+C2 done: memoized name normalization; tab taps no longer do a synchron
  0d3b0ec ckpt 56: Step A done (baseline 22 suites green). Step B in progress: wrote tools/perf.js
  1343c3d ckpt 52: Wrote Tj's 2026-09-23 request (polish/reorganize/declutter + make it snappy on 
  de3e3d6 ckpt 64: v8.2 shipped and published: triggered publish-release.yml, verified via get_rel
  d09d174 ship v8.2: v8.1: full-test sweep -- fixed a doSync() weekMeta wholesale-replace bug that
  dcd3db0 ship v8.1: v8.1: full-test sweep -- fixed a doSync() weekMeta wholesale-replace bug that
  db7e9e7 ckpt 57: Full test (2026-09-19, requested via the standing 'full tests' protocol in CLAU
  8c4d8d7 ckpt 54: Full-test sweep (2026-09-19, second pass): found and fixed a real caching/data-
  798e0e4 ckpt 54: Wrote Tj's standing 'light tests'/'full tests' request into CLAUDE.md as a perm
  950bca6 ckpt 114: Shipped v8.0 and published the GitHub Release: triggered publish-release.yml, 
```

(7 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
