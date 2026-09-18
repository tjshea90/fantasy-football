# CHECKPOINT 110 — read me first, then TASKS.md

**Written:** 2026-09-18T19:33:40Z · **version:** 7.6 · **tests:** all 20 suites green

## Just done
Step I sweep, part 1. Found and fixed a THIRD instance of the same dead-code class: recommend.js's projectOne -- the Advice tab's lineup projection -- lists a full-season projection as source 4 in its own file header ('this updates through the season, unlike a number frozen at draft time') and it had never once fired, for exactly the same reason the wire's had not: it read pr.season off the WEEKLY cache, which the scoring-period-pinned fetch never populates. Now reads Projections.findSeason(), and averages ESPN's and Sleeper's season numbers rather than taking one. Pinned with a test that drives the real projectAll path. Also verified: build.sh stages app/assets/* wholesale so ros.js ships without a build change; manifest and disk agree (97 files); performance measured -- freeAgents cold 24ms over 613 free agents, warm 0ms via the memo, waiverContext 7ms, upgrades 1ms; smoke-tested the whole board end to end against the screenshot's exact scenario (a single 16.4-point week now prices at 8.6/gm with the basis printed, instead of 16.4). Ask-Claude file is 31.8k chars, API prompt ~6.8k tokens. All 19 suites green.

## Do this next
Finish the sweep: re-read the whole diff adversarially for anything the changed field meanings could have broken elsewhere, then build the APK (bash build.sh), then ship.sh, publish the Release via mcp__github__actions_run_trigger publish-release.yml, verify it, and send Tj the plain-text tappable link.

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
  c396c21 ckpt 106: Step G done plus two real staleness bugs found and fixed while doing it. UI: t
  6b0083a ckpt 96: Steps F done (rules 4+5). New Ai.waiverCriteriaText() states all six of Tj's cr
  3a24f65 ckpt 77: Step H part 1 done: tools/test_waiver.js rewritten against the new engine, and 
  4799ecb ckpt 72: Steps C/D/E built. New app/assets/ros.js is the rest-of-season engine: full-sea
  0ba449b ckpt 54: Steps A+B done. ROOT CAUSE CONFIRMED LIVE: value.js perGame() ranks the wire, a
  835a9e3 ckpt 53: Wrote Tj's 2026-09-18c waiver-wire overhaul request into TASKS.md verbatim (his
  07c0d36 ckpt 97: Shipped v7.6 and published the GitHub Release: triggered publish-release.yml, v
  5272367 ship v7.6: Fixed the real waiver-wire tab-highlight bug (boot restored the tab but never
  d9d94d6 ship v7.5: Fixed the real waiver-wire tab-highlight bug (boot restored the tab but never
  f4dd6eb ckpt 90: Formalized the job-guard fix's verification (previously only a throwaway, uncom
```

(3 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
