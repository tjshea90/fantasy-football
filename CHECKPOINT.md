# CHECKPOINT 397 — read me first, then TASKS.md

**Written:** 2026-09-15T16:36:35Z · **version:** 6.4 · **tests:** all 14 suites green

## Just done
Documented the week-auto-advance fix: TASKS.md job entry ticked with full proof and reset to 'no active job'; STATE.md's 2026-09-15f entry written (root cause, fix, verification, the explicit caveat that an already-running session needs a background/reopen or relaunch to pick it up); archived to LADDER.md ss33; the phone-confirmation request in Waiting on Tj rewritten for v6.5, covering both the new week-advance fix and the still-unconfirmed back-button fix in one entry, with older v6.4/v6.3/v6.2/v6.1 supersession notes updated to match. Final full test suite + ES2018 gate green (14 suites, 0 failures) and bash build.sh clean (28 classes) immediately before this checkpoint.

## Do this next
Run bash ship.sh (expected to bump VERSION from 6.4 to 6.5), then trigger+verify the GitHub Release per CLAUDE.md's standing rule: mcp__github__actions_run_trigger on publish-release.yml with the real version, poll until it actually succeeded, fix the 'v6.5' references in STATE.md/LADDER.md if ship.sh picked a different number, then send Tj the plain tappable release link in the exact message shape CLAUDE.md specifies -- and explicitly tell him in that same message that the fix will not apply to his currently-open app until he backgrounds/reopens or relaunches it after installing, since that is the one thing about this fix a user could easily misunderstand as 'still broken.'

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
  a7d07f7 ckpt 389: Fixed: the app never advanced past a finished NFL week unless truly cold-boote
  59a5289 ckpt 381: Post-ship documentation finalized: STATE.md's 2026-09-15e entry closed with th
  1eeaf7d ship v6.4: 2026-09-15e comprehensive app-wide sweep: 5 rounds of verified fixes (data in
  deb0d7c ckpt 374: Wrap-up of the 2026-09-15e comprehensive sweep: ticked all 5 job steps in TASK
  e68baf4 ckpt 361: Small-fixes batch complete (2026-09-15e sweep), final items. (12) recommend.js
  895701a ckpt 353: Small-fixes batch, part 2 of 2 continued (2026-09-15e sweep). (9) handoff.js: 
  cf63635 ckpt 336: Small-fixes batch, part 1 of 2 (2026-09-15e sweep). (1) ui.js: pull-to-refresh
  f2a8ef5 ckpt 321: Round 5 (cost/model accuracy) complete. (1) usage.js's cost tracking was model
  17a02e8 ckpt 299: Round 4 (Android hardening) finished. (a) NativeBridge's pool is stored as a f
  b14b738 ckpt 291: Round 4 (Android hardening) complete: fixed alertsTest()'s synchronous up-to-1
```

(7 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
