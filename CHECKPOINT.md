# CHECKPOINT 97 — read me first, then TASKS.md

**Written:** 2026-09-18T17:46:36Z · **version:** 7.6 · **tests:** all 20 suites green

## Just done
Shipped v7.6 and published the GitHub Release: triggered publish-release.yml, verified via get_release_by_tag (FFTracker-v7.6.apk, 288987 bytes, non-empty assets array). Every fix from this job's improvement pass (tab-highlight bug, two duplicate-paid-Claude job guards, redundant projectAll computation, doSync week-capture race) is now in a real, tested, shipped release, not just committed source.

## Do this next
Send Tj the v7.6 release link per CLAUDE.md's standing instruction, and ask him separately whether he wants app/assets/sim.js's unused season()/power()/allPlay()/bracket() wired into a tab (playoff odds / power rankings) or deleted -- a product decision surfaced by this session's audit, not something to decide unilaterally. Nothing else in flight; this job is done pending his answer.

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
  5272367 ship v7.6: Fixed the real waiver-wire tab-highlight bug (boot restored the tab but never
  d9d94d6 ship v7.5: Fixed the real waiver-wire tab-highlight bug (boot restored the tab but never
  f4dd6eb ckpt 90: Formalized the job-guard fix's verification (previously only a throwaway, uncom
  ba5d8eb ckpt 87: Fixed the doSync() week-capture race a subagent audit flagged: doSync read the 
  4b82a38 ckpt 66: Broader code/UI review pass (Tj's same 2026-09-18 message): delegated a researc
  58affc7 ckpt 57: Fixed the real waiver-wire tab-highlight bug: boot() restores view from lastTab
  a68ed9a ckpt 78: Shipped v7.4: QB waiver-swap threshold fix (QB_MIN_GAIN=6, QB_MIN_MEASURED=3, s
  6a50a4e ship v7.4: waiver-wire QB season-edge fix (Stafford/Bo Nix no longer swapped for a margi
  87ff104 ckpt 69: 1f/tests done: web research confirmed the QB-skepticism direction (footballguys
  f8e561f ckpt 67: 1b/1c/1e done: QB waiver swaps now need a season-defining edge (6+ pts/gm, 3+ r
```
