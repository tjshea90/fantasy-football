# CHECKPOINT 41 — read me first, then TASKS.md

**Written:** 2026-09-09T23:07:15Z · **version:** 4.7 · **tests:** all 13 suites green

## Just done
audit fix: a failing push was completely silent — autosave committed locally, everything looked saved, and 3 commits piled up that would have died with the container. autosave now emits a loud systemMessage on push failure; ckpt warns and ship is fatal

## Do this next
Tj: verify v4.7 on the phone — Data > Test the projection feed. Next code work continues from TASKS.md

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
  7795854 auto-checkpoint: 2026-09-09T23:06:28Z
  678787a ckpt 39: added PreCompact hook (tools/toobig.sh): when a session grows big enough to auto-compact it saves everything and tells Tj to checkpoint and start a fresh session, since resuming from GitHub costs ~150 lines versus re-reading the whole conversation at full price on a cold cache
  4ce76c6 auto-checkpoint: 2026-09-09T23:01:39Z
  198ab83 ckpt 37: de-Coworked the system: BRIEF.md cold-start/persistence/commands rewritten for Claude Code+GitHub, ship.sh publishes a committed APK + push instead of a zip nobody can attach, resume.sh now detects interrupted-mid-change (autosave leaves a CLEAN tree hiding a half-written commit), CLAUDE.md requires writing new requests into TASKS.md before coding
  c482bfb auto-checkpoint: 2026-09-09T22:57:24Z
  554e113 ckpt 35: cross-account handoff system finished and verified: SessionStart briefing, autosave hook on every edit and bash call, push.sh (fixes the silent no-push bug), secret scan for the public repo, MANIFEST repaired so bootstrap/ship work again, CI now runs the suites
  1e1bf9b auto-checkpoint: 2026-09-09T22:51:04Z
  351443e auto-checkpoint: 2026-09-09T22:50:24Z
  72cb32d ckpt 32: wired the cross-account handoff: autosave hook, SessionStart briefing, ckpt now pushes, secret scan, MANIFEST repaired
  d963f2c Cross-account handoff: autosave hook, session-start briefing, push on checkpoint
```
