# CHECKPOINT 37 — read me first, then TASKS.md

**Written:** 2026-09-09T22:58:07Z · **version:** 4.7 · **tests:** all 13 suites green

## Just done
de-Coworked the system: BRIEF.md cold-start/persistence/commands rewritten for Claude Code+GitHub, ship.sh publishes a committed APK + push instead of a zip nobody can attach, resume.sh now detects interrupted-mid-change (autosave leaves a CLEAN tree hiding a half-written commit), CLAUDE.md requires writing new requests into TASKS.md before coding

## Do this next
Tj: verify v4.7 on the phone — Data > Test the projection feed, and Data > Test the key if he wants Claude's reads. Next code work continues from TASKS.md

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
     M CLAUDE.md
     M app/assets/value.js

## Last ten checkpoints
```
  c482bfb auto-checkpoint: 2026-09-09T22:57:24Z
  554e113 ckpt 35: cross-account handoff system finished and verified: SessionStart briefing, autosave hook on every edit and bash call, push.sh (fixes the silent no-push bug), secret scan for the public repo, MANIFEST repaired so bootstrap/ship work again, CI now runs the suites
  1e1bf9b auto-checkpoint: 2026-09-09T22:51:04Z
  351443e auto-checkpoint: 2026-09-09T22:50:24Z
  72cb32d ckpt 32: wired the cross-account handoff: autosave hook, SessionStart briefing, ckpt now pushes, secret scan, MANIFEST repaired
  d963f2c Cross-account handoff: autosave hook, session-start briefing, push on checkpoint
  0225f84 Add auto-checkpoint hook; clean up test line in CLAUDE.md
  ca59689 auto-checkpoint: 2026-09-09T22:33:38Z
  13bbe1a Add CLAUDE.md with checkpoint/resume process for multi-account work
  04d08d8 Add prebuilt v4.7 APK for direct download
```
