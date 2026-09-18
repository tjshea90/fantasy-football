# CHECKPOINT 96 — read me first, then TASKS.md

**Written:** 2026-09-18T19:15:20Z · **version:** 7.6 · **tests:** all 20 suites green

## Just done
Steps F done (rules 4+5). New Ai.waiverCriteriaText() states all six of Tj's criteria in one place, shared by BOTH Claude paths so they cannot drift. handoff.js buildWaivers (the ask-Claude file) rebuilt around one-for-one swaps: it now carries the full scoring table, MY WHOLE ROSTER priced in rest-of-season league points (new rosterSection), every owned player in the league by team (takenSection, rule 5), the mandated-replacement list (mandatedSection), the app's own deterministic swaps (swapsSection), and an AVAILABLE table led by ROS/per-gm/games-left/vor/basis instead of a one-week proj. The reply contract leads with a 'swaps' array carrying drop, add, edge (the expected season point difference, Tj's '54 more fantasy points') and mandated. ai.js's paid-API waiverPrefix/waiverBlock got the same treatment. normalizeWaivers reads swaps first and falls back to adds so older replies still import. IMPORTANT RULE CHANGE, deliberate: the old 'a dropCandidate must be at the same position as the add' guard is replaced by Ai.canSpare -- a swap must never leave a required starting slot empty. The old rule rejected dropping a spare kicker for a startable WR (an ordinary correct move) while letting a same-position swap that empties a slot through; the new one is narrower and stronger. Validation of the drop half now runs against my whole roster (Ai.rosterIndex) rather than the app's three-deep shortlist, per rule 5. Also made the prompt builders tolerant of a pool row cached by an older app version (one missing number used to throw a TypeError out of prompt construction, which on the Wire tab fails the whole screen). All 19 suites green, ES2018 clean.

## Do this next
Step G: the Wire tab render in ui.js -- it still prints the per-game 'proj' and the old src caption ('1 scored week in this app - thin sample'). It needs to lead with rest-of-season points, show games left and the basis honestly, and surface the swap pairs (drop X -> add Y, +N pts) including the mandated ones. Then step I (bug/UI sweep) and step J (ship + release + link).

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
  3a24f65 ckpt 77: Step H part 1 done: tools/test_waiver.js rewritten against the new engine, and 
  4799ecb ckpt 72: Steps C/D/E built. New app/assets/ros.js is the rest-of-season engine: full-sea
  0ba449b ckpt 54: Steps A+B done. ROOT CAUSE CONFIRMED LIVE: value.js perGame() ranks the wire, a
  835a9e3 ckpt 53: Wrote Tj's 2026-09-18c waiver-wire overhaul request into TASKS.md verbatim (his
  07c0d36 ckpt 97: Shipped v7.6 and published the GitHub Release: triggered publish-release.yml, v
  5272367 ship v7.6: Fixed the real waiver-wire tab-highlight bug (boot restored the tab but never
  d9d94d6 ship v7.5: Fixed the real waiver-wire tab-highlight bug (boot restored the tab but never
  f4dd6eb ckpt 90: Formalized the job-guard fix's verification (previously only a throwaway, uncom
  ba5d8eb ckpt 87: Fixed the doSync() week-capture race a subagent audit flagged: doSync read the 
  4b82a38 ckpt 66: Broader code/UI review pass (Tj's same 2026-09-18 message): delegated a researc
```

(18 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
