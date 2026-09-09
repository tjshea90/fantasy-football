# CHECKPOINT 49 — read me first, then TASKS.md

**Written:** 2026-09-09T23:10:39Z · **version:** 4.7 · **tests:** all 13 suites green

## Just done
T2 done: BETA added to sim.js

## Do this next
T3: verify both markers survive a round trip

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
  ae4986a auto-checkpoint: 2026-09-09T23:10:34Z
  ef98a6b ckpt 47: T1 done: ALPHA added to value.js
  b69ab2b auto-checkpoint: 2026-09-09T23:10:14Z
  dc7b848 ckpt 45: wrote the job into TASKS.md
  53c689e ckpt 44: reverted the end-to-end handoff test: it simulated a cap landing mid-edit, pushed the half-written state, and a cold clone correctly received the INTERRUPTED warning, the file in flight, 'Do this next' and the unticked tasks. recap.js and TASKS.md restored
  79ed09e auto-checkpoint: 2026-09-09T23:07:37Z
  07d0984 ckpt 42: wrote Tj's new request into TASKS.md before starting
  87b5bba ckpt 41: audit fix: a failing push was completely silent — autosave committed locally, everything looked saved, and 3 commits piled up that would have died with the container. autosave now emits a loud systemMessage on push failure; ckpt warns and ship is fatal
  7795854 auto-checkpoint: 2026-09-09T23:06:28Z
  678787a ckpt 39: added PreCompact hook (tools/toobig.sh): when a session grows big enough to auto-compact it saves everything and tells Tj to checkpoint and start a fresh session, since resuming from GitHub costs ~150 lines versus re-reading the whole conversation at full price on a cold cache
```
