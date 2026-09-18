# CHECKPOINT 90 — read me first, then TASKS.md

**Written:** 2026-09-18T17:39:46Z · **version:** 7.4 · **tests:** all 20 suites green

## Just done
Formalized the job-guard fix's verification (previously only a throwaway, uncommitted script) into a real regression test, tools/test_jobguard.js, matching this project's testing culture. Reproduces the re-render-while-Claude-call-in-flight race for both the Wire tab's 'Ask Claude about the wire' button and the Rosters tab's 'How your team stacks up' Ask-Claude button. Confirmed it fails against the true pre-fix commit (58affc7, right before ckpt 66) and passes with the fix. Registered in MANIFEST.txt. All 20 suites + ES2018 gate green.

## Do this next
This round of the improvement pass is functionally complete: tab-highlight bug, two duplicate-paid-Claude-call job guards, redundant projectAll computation, and the doSync week-capture race are all fixed with committed regression tests, all suites green. Next: update TASKS.md to reflect this, then run ship.sh, trigger the publish-release.yml workflow, verify it, and send Tj the release link per CLAUDE.md's standing instruction. Ask Tj separately about the sim.js dead code (season()/power()/allPlay()/bracket() -- implemented, tested, never called from a production tab) rather than touching it unilaterally.

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
  ba5d8eb ckpt 87: Fixed the doSync() week-capture race a subagent audit flagged: doSync read the 
  4b82a38 ckpt 66: Broader code/UI review pass (Tj's same 2026-09-18 message): delegated a researc
  58affc7 ckpt 57: Fixed the real waiver-wire tab-highlight bug: boot() restores view from lastTab
  a68ed9a ckpt 78: Shipped v7.4: QB waiver-swap threshold fix (QB_MIN_GAIN=6, QB_MIN_MEASURED=3, s
  6a50a4e ship v7.4: waiver-wire QB season-edge fix (Stafford/Bo Nix no longer swapped for a margi
  87ff104 ckpt 69: 1f/tests done: web research confirmed the QB-skepticism direction (footballguys
  f8e561f ckpt 67: 1b/1c/1e done: QB waiver swaps now need a season-defining edge (6+ pts/gm, 3+ r
  db1b963 ckpt 53: Wrote the 2026-09-18 request into TASKS.md verbatim (waiver-wire QB/RB-WR smart
  23dc5d1 ckpt 123: v7.3 shipped and verified: GitHub Release published (non-empty assets array, F
  f49cf4c ship v7.3: Fixed a bug in all three Claude-handoff features (advice/waivers/team-analysi
```

(2 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
