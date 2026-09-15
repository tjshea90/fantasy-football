# CHECKPOINT 389 — read me first, then TASKS.md

**Written:** 2026-09-15T16:34:21Z · **version:** 6.4 · **tests:** all 14 suites green

## Just done
Fixed: the app never advanced past a finished NFL week unless truly cold-booted (Tj, 2026-09-15: 'week 1 NFL is complete... yet the app still has all tabs open to week 1'). Root cause: syncCurrentWeek() -- the check that compares ESPN's own current-week number against what the app is showing, and advances week (the one module-level variable every tab reads) if it fell behind -- was called ONLY from boot(), a true cold start. This app deliberately keeps its process alive across background/foreground (moveTaskToBack, not finish(), on back press -- an earlier session's own fix), so anyone who does not force-quit the app could go days without boot() ever running again, and the check never got a second chance to fire. Made worse by appResume()'s own 'a week that is finished stays finished, do not wake a poll for it' early return, which is exactly the state where the real week having moved on is most likely -- it was short-circuiting past the one place a periodic re-check could have lived, and there wasn't one anyway. Fixed by calling syncCurrentWeek() from appResume() too, placed BEFORE that early return; it has its own 3-hour staleness cache so this is free on the common case. Since week is one shared module-level variable every tab (Live, Lineups, Rosters, Wire, Stats, Advice, Data) already reads, this one fix moves ALL of them together -- there was never a per-tab state problem, only a per-resume one. Proven end-to-end (not just source-text pinned) in tools/test_lifecycle.js with a real Espn.currentWeek stub: week 1 marked synced+final, appResume() called, week correctly advances to 2. Source-text pin in test_boot.js confirms both the call site and that it runs before the early-return. All 14 suites + ES2018 gate green, bash build.sh clean (28 classes).

## Do this next
This does not retroactively fix Tj's currently-running app session -- there is no way to push a live update into an already-running process. He needs to background and reopen the app (or fully close/relaunch) once this ships for the fix to take effect; the very next resume will catch the week-1-to-2 transition. Should tell him this plainly when reporting the fix, not just say 'fixed' and imply his current screen will update itself. Next: ship this as a new version (bash ship.sh) and follow the standing GitHub Release process (trigger publish-release.yml, verify, send the plain tappable link) since this is a real, verified, reported bug fix worth shipping on its own rather than batching with unrelated future work.

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
  59a5289 ckpt 381: Post-ship documentation finalized: STATE.md's 2026-09-15e entry closed with th
  1eeaf7d ship v6.4: 2026-09-15e comprehensive app-wide sweep: 5 rounds of verified fixes (data in
  deb0d7c ckpt 374: Wrap-up of the 2026-09-15e comprehensive sweep: ticked all 5 job steps in TASK
  e68baf4 ckpt 361: Small-fixes batch complete (2026-09-15e sweep), final items. (12) recommend.js
  895701a ckpt 353: Small-fixes batch, part 2 of 2 continued (2026-09-15e sweep). (9) handoff.js: 
  cf63635 ckpt 336: Small-fixes batch, part 1 of 2 (2026-09-15e sweep). (1) ui.js: pull-to-refresh
  f2a8ef5 ckpt 321: Round 5 (cost/model accuracy) complete. (1) usage.js's cost tracking was model
  17a02e8 ckpt 299: Round 4 (Android hardening) finished. (a) NativeBridge's pool is stored as a f
  b14b738 ckpt 291: Round 4 (Android hardening) complete: fixed alertsTest()'s synchronous up-to-1
  8337f3a ckpt 281: Sweep round 3 (UI/feature correctness): fixed four real bugs. (1) claudeAdvice
```

(7 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
