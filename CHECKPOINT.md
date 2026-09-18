# CHECKPOINT 72 — read me first, then TASKS.md

**Written:** 2026-09-18T18:48:29Z · **version:** 7.6 · **tests:** 2 RED: test_boot test_waiver (18 green)

## Just done
Steps C/D/E built. New app/assets/ros.js is the rest-of-season engine: full-season baseline (ESPN + Sleeper season projections, both re-scored into league points and averaged), this season's measured games shrunk in as w=n/(n+4), efficiency regressed 50/50 toward volume using per-opportunity rates measured from the league's own book, times games actually left (weeks left minus an upcoming bye). projections.js grew a separate season-projection fetch and cache (12h, week-independent, externalId-filtered) since the weekly route provably never returns a season split. value.js now ranks the wire on expected REST-OF-SEASON points, prices MY OWN roster through the same engine (rosterValues) so a swap compares like with like, gates swaps on BOTH a per-game and a season-points bar, and honours rule 6: K/DEF need kdefNeed or a strong season edge, QB still needs 3 measured games -- both overridden when a rostered player is done for the year (new Recommend.seasonOutlook detects IR/PUP/NFI/suspension and season-ending notes, and zeroes his ROS so the swap falls out of the arithmetic). 19 of 20 suites green.

## Do this next
Step H part 1: rewrite tools/test_waiver.js, which still pins the OLD perGame ladder (8 failing assertions, all of them asserting the behaviour this job deliberately removed -- e.g. 'season pace is divided by 17 before use'). Then steps F/G: overhaul the ask-Claude prompt in handoff.js buildWaivers + ai.js waiverPrefix/waiverBlock for rules 4 and 5, and the Wire tab render in ui.js.

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
  0ba449b ckpt 54: Steps A+B done. ROOT CAUSE CONFIRMED LIVE: value.js perGame() ranks the wire, a
  835a9e3 ckpt 53: Wrote Tj's 2026-09-18c waiver-wire overhaul request into TASKS.md verbatim (his
  07c0d36 ckpt 97: Shipped v7.6 and published the GitHub Release: triggered publish-release.yml, v
  5272367 ship v7.6: Fixed the real waiver-wire tab-highlight bug (boot restored the tab but never
  d9d94d6 ship v7.5: Fixed the real waiver-wire tab-highlight bug (boot restored the tab but never
  f4dd6eb ckpt 90: Formalized the job-guard fix's verification (previously only a throwaway, uncom
  ba5d8eb ckpt 87: Fixed the doSync() week-capture race a subagent audit flagged: doSync read the 
  4b82a38 ckpt 66: Broader code/UI review pass (Tj's same 2026-09-18 message): delegated a researc
  58affc7 ckpt 57: Fixed the real waiver-wire tab-highlight bug: boot() restores view from lastTab
  a68ed9a ckpt 78: Shipped v7.4: QB waiver-swap threshold fix (QB_MIN_GAIN=6, QB_MIN_MEASURED=3, s
```

(17 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
