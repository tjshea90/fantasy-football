# CHECKPOINT 93 — read me first, then TASKS.md

**Written:** 2026-09-23T03:50:36Z · **version:** 8.3 · **tests:** all 22 suites green

## Just done
v8.3 shipped via ship.sh (all 22 suites + ES2018 + dex gate green, APK built, main fast-forwarded). publish-release.yml dispatched for 8.3.

## Do this next
Verify the Release (get_release_by_tag v8.3 has a non-empty assets array), then send Tj the link and the proposals list (TASKS.md Waiting on Tj, 1-7). If the release failed, fall back to https://github.com/tjshea90/fantasy-football/raw/main/releases/FFTracker-v8.3.apk

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
  483bd59 ship v8.3: v8.3: speed + polish pass for the Moto G 2026 -- tab taps no longer fsync, me
  6b27037 ckpt 90: Steps B-F ticked: MAJOR proposals 1-7 written under Waiting on Tj (roster PROJ/
  e2ee784 ckpt 88: UI batch 2 (handoff explainer clamp, standings rank, projected-finish refinemen
  ce69753 ckpt 81: UI polish batch 1: compact header, Live projected finish + pre-kickoff projecte
  b992110 ckpt 74: Speed C4 done: MainActivity setOffscreenPreRaster(true) (build.sh green). Minif
  6bde6b1 ckpt 71: Speed C3 + C3b done: Advice loads its 4 disk caches once instead of every rende
  368bf1c ckpt 63: Speed C1+C2 done: memoized name normalization; tab taps no longer do a synchron
  0d3b0ec ckpt 56: Step A done (baseline 22 suites green). Step B in progress: wrote tools/perf.js
  1343c3d ckpt 52: Wrote Tj's 2026-09-23 request (polish/reorganize/declutter + make it snappy on 
  de3e3d6 ckpt 64: v8.2 shipped and published: triggered publish-release.yml, verified via get_rel
```
