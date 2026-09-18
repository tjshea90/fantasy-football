# CHECKPOINT 115 — read me first, then TASKS.md

**Written:** 2026-09-18T19:38:27Z · **version:** 7.6 · **tests:** all 20 suites green

## Just done
Step I sweep, part 2 -- caught a severe bug in THIS job's own change by reviewing the diff adversarially. upgrades() searched freeAgents(week, 60): the best 60 free agents by ONE global sort. Ranking on season totals multiplies quarterback's structural scoring advantage in this league (a completion pays a full point) by the games remaining, and measured against a realistic spread of league-scored projections ALL SIXTY slots came back QB -- the function meant to find Tj a running back was searching a pool with no running backs in it. It would have surfaced as the exact complaint he has already made twice, 'it always recommends qb switch', arriving by a brand new route. Fixed: upgrades() now pulls a fixed depth from byPos() per position (10 each at the default poolSize) and lets the per-game/season/QB/KDEF gates decide who survives, which is where that judgement belongs. Test pins both halves -- that a global top-60 of this board really is all quarterbacks (the trap), and that every position is represented in what upgrades() actually searches. All 19 suites green.

## Do this next
Build the APK (bash build.sh), confirm it, then ship.sh, then publish the Release via mcp__github__actions_run_trigger (publish-release.yml, ref main, inputs.version), verify with get_release_by_tag, and send Tj the plain-text tappable release link per CLAUDE.md.

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
  8647e0a ckpt 110: Step I sweep, part 1. Found and fixed a THIRD instance of the same dead-code c
  c396c21 ckpt 106: Step G done plus two real staleness bugs found and fixed while doing it. UI: t
  6b0083a ckpt 96: Steps F done (rules 4+5). New Ai.waiverCriteriaText() states all six of Tj's cr
  3a24f65 ckpt 77: Step H part 1 done: tools/test_waiver.js rewritten against the new engine, and 
  4799ecb ckpt 72: Steps C/D/E built. New app/assets/ros.js is the rest-of-season engine: full-sea
  0ba449b ckpt 54: Steps A+B done. ROOT CAUSE CONFIRMED LIVE: value.js perGame() ranks the wire, a
  835a9e3 ckpt 53: Wrote Tj's 2026-09-18c waiver-wire overhaul request into TASKS.md verbatim (his
  07c0d36 ckpt 97: Shipped v7.6 and published the GitHub Release: triggered publish-release.yml, v
  5272367 ship v7.6: Fixed the real waiver-wire tab-highlight bug (boot restored the tab but never
  d9d94d6 ship v7.5: Fixed the real waiver-wire tab-highlight bug (boot restored the tab but never
```

(4 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
