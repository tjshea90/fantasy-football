# CHECKPOINT 77 — read me first, then TASKS.md

**Written:** 2026-09-18T18:59:02Z · **version:** 7.6 · **tests:** all 20 suites green

## Just done
Step H part 1 done: tools/test_waiver.js rewritten against the new engine, and it found a real bug while being written. Ros.rates() iterated only weeks weekIsScored() blesses (weekMeta.synced && allFinal) while Ros.observed() reads the book through bookTrend, which counts a row the moment it exists -- so in the ordinary case (stats synced, week not yet closed out) the rate table came back empty, xpg came back null, and the efficiency-regression half of the documented method silently did nothing. Both sides now read the book. New tests pin: the screenshot bug itself (one 16.4 week no longer projects 16.4 -- it lands at 9.68 against an 8.0 baseline, weight exactly n/(n+4)), the sample taking over as it grows, efficiency regressed toward volume, the board ranked on season totals (a bye still ahead costs a game), rule 3's meaningful-improvement bar rejecting a real-but-marginal 0.5/gm edge, the QB three-scenario set, rule 6's season-ending override (a QB with zero measured games IS offered when the incumbent is on IR, flagged mandated, ranked first), and rule 6's K/DEF strong-season-edge exception. Also repointed test_boot's weeksLeft source-pin to ros.js and relaxed test_integration's Kenny/Kenneth assertion to test what it was actually about. All 19 suites green.

## Do this next
Steps F and G: overhaul the ask-Claude file. handoff.js buildWaivers() is the one Tj means by 'the ask Claude file' -- it must carry the full scoring table, EVERY taken player in the league by team (Value.takenByTeam, already built), my whole roster with ROS values, the available pool with ROS values, and an explicit instruction to return ONE-TO-ONE drop/add pairs with reasoning and an expected season-long point edge per pair, with no restriction on what it may search. Same for ai.js waiverPrefix/waiverBlock (the paid API path) and normalizeWaivers. Then the Wire tab render in ui.js (step G) so the board shows the season-long basis instead of '1 scored week in this app - thin sample'.

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
  4799ecb ckpt 72: Steps C/D/E built. New app/assets/ros.js is the rest-of-season engine: full-sea
  0ba449b ckpt 54: Steps A+B done. ROOT CAUSE CONFIRMED LIVE: value.js perGame() ranks the wire, a
  835a9e3 ckpt 53: Wrote Tj's 2026-09-18c waiver-wire overhaul request into TASKS.md verbatim (his
  07c0d36 ckpt 97: Shipped v7.6 and published the GitHub Release: triggered publish-release.yml, v
  5272367 ship v7.6: Fixed the real waiver-wire tab-highlight bug (boot restored the tab but never
  d9d94d6 ship v7.5: Fixed the real waiver-wire tab-highlight bug (boot restored the tab but never
  f4dd6eb ckpt 90: Formalized the job-guard fix's verification (previously only a throwaway, uncom
  ba5d8eb ckpt 87: Fixed the doSync() week-capture race a subagent audit flagged: doSync read the 
  4b82a38 ckpt 66: Broader code/UI review pass (Tj's same 2026-09-18 message): delegated a researc
  58affc7 ckpt 57: Fixed the real waiver-wire tab-highlight bug: boot() restores view from lastTab
```

(4 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
