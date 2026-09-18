# CHECKPOINT 106 — read me first, then TASKS.md

**Written:** 2026-09-18T19:26:13Z · **version:** 7.6 · **tests:** all 20 suites green

## Just done
Step G done plus two real staleness bugs found and fixed while doing it. UI: the free-agent row now leads with expected REST-OF-SEASON points ('103 pts rest of season (11 games left, 9.4/gm)') with the basis on its own line, instead of '16.4 proj (1 scored week in this app - thin sample)'; VOR is season-long; a forced replacement gets its own headline, a REPLACE tag and its own wording, separate from optional upgrades; Claude's rows show the per-pair season point edge and warn when the man it names to drop is not actually on the roster. BUG 1: nothing but the Advice tab's full sync ever called refreshSeason, so opening the Wire tab without syncing first would have left the season cache empty and every free agent back on a weekly line or a floor -- the overhaul would have looked broken in a new way. Added refreshSeasonProjIfStale() on Wire tab open, same quiet only-if-stale shape as refreshPlayerDBIfStale. BUG 2, which BUG 1 would have hidden: value.js's _faMemo did not key on the season cache, so the completed background refresh would have replayed the stale board -- the identical trap this file already documents for the PlayerDB and injury feeds, third instance. BUG 3, pre-existing and older: Store.setBook never bumped the store generation, so a sync that wrote a fresh week of stats left the free-agent memo and ros.js's rate table serving pre-sync numbers until a roster change happened to move the generation. Fixed at the source. Both new regression tests confirmed to FAIL against the pre-fix code and pass with it. All 19 suites green.

## Do this next
Step I: the full bug/UI sweep Tj asked for. Check anything else that reads the fields whose meaning changed (vor is now season-long, not per-game; f.v is per-game but f.ros is the ranking key) -- teamreport.js, sim.js, the trade screen and the Stats tab all consume Value. Then build the APK, then step J: ship, publish the Release, send Tj the link.

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
  6b0083a ckpt 96: Steps F done (rules 4+5). New Ai.waiverCriteriaText() states all six of Tj's cr
  3a24f65 ckpt 77: Step H part 1 done: tools/test_waiver.js rewritten against the new engine, and 
  4799ecb ckpt 72: Steps C/D/E built. New app/assets/ros.js is the rest-of-season engine: full-sea
  0ba449b ckpt 54: Steps A+B done. ROOT CAUSE CONFIRMED LIVE: value.js perGame() ranks the wire, a
  835a9e3 ckpt 53: Wrote Tj's 2026-09-18c waiver-wire overhaul request into TASKS.md verbatim (his
  07c0d36 ckpt 97: Shipped v7.6 and published the GitHub Release: triggered publish-release.yml, v
  5272367 ship v7.6: Fixed the real waiver-wire tab-highlight bug (boot restored the tab but never
  d9d94d6 ship v7.5: Fixed the real waiver-wire tab-highlight bug (boot restored the tab but never
  f4dd6eb ckpt 90: Formalized the job-guard fix's verification (previously only a throwaway, uncom
  ba5d8eb ckpt 87: Fixed the doSync() week-capture race a subagent audit flagged: doSync read the 
```

(9 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
