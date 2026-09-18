# CHECKPOINT 118 — read me first, then TASKS.md

**Written:** 2026-09-18T19:42:53Z · **version:** 7.7 · **tests:** all 20 suites green

## Just done
Shipped v7.7 and published the GitHub Release: triggered publish-release.yml, verified via get_release_by_tag (FFTracker-v7.7.apk, 313622 bytes, non-empty assets array, run #18 green). The whole waiver-wire overhaul -- ros.js, the season-projection fetch, the rest-of-season ranking, the two-gate swap bar, rule 6's QB/K/DEF handling and its season-ending override, both overhauled Claude prompts, the Wire tab UI, and all five bugs found along the way -- is now in a real, tested, shipped release. STATE.md carries the full narrative under 'v7.7 - the waiver wire, rebuilt on the season instead of on last Sunday'. Every box in TASKS.md steps A-J is ticked with the test that proves it named.

## Do this next
Send Tj the v7.7 release link per CLAUDE.md's standing instruction. Nothing else in flight; this job is done. If he comes back with more: the one judgement call worth flagging is that ros.js's two constants -- PRIOR_GAMES=4 (how fast the measured sample takes over) and USAGE_SHARE=0.5 (how hard efficiency is regressed toward volume) -- are defensible and documented but not tuned against this league's own history, which is a thing that could be done later once more weeks are scored. Also still unanswered from the previous job: whether sim.js's unused season()/power()/allPlay()/bracket() should be wired into a tab or deleted.

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
  abc1cf3 ship v7.7: Waiver wire overhauled: ranked on expected rest-of-season points in this leag
  f6d6ae6 ckpt 115: Step I sweep, part 2 -- caught a severe bug in THIS job's own change by review
  8647e0a ckpt 110: Step I sweep, part 1. Found and fixed a THIRD instance of the same dead-code c
  c396c21 ckpt 106: Step G done plus two real staleness bugs found and fixed while doing it. UI: t
  6b0083a ckpt 96: Steps F done (rules 4+5). New Ai.waiverCriteriaText() states all six of Tj's cr
  3a24f65 ckpt 77: Step H part 1 done: tools/test_waiver.js rewritten against the new engine, and 
  4799ecb ckpt 72: Steps C/D/E built. New app/assets/ros.js is the rest-of-season engine: full-sea
  0ba449b ckpt 54: Steps A+B done. ROOT CAUSE CONFIRMED LIVE: value.js perGame() ranks the wire, a
  835a9e3 ckpt 53: Wrote Tj's 2026-09-18c waiver-wire overhaul request into TASKS.md verbatim (his
  07c0d36 ckpt 97: Shipped v7.6 and published the GitHub Release: triggered publish-release.yml, v
```
