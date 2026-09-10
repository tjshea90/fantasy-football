# CHECKPOINT 50 — read me first, then TASKS.md

**Written:** 2026-09-10T00:09:22Z · **version:** 4.7 · **tests:** all 13 suites green

## Just done
scan fixes: ship.sh's STATE.md gate compared the CALENDAR DATE so it broke at midnight regardless of staleness - now compares commit timestamps (STATE.md vs last app/android change); ship.sh auto-prunes releases/ to the newest 3 APKs and keeps MANIFEST in sync; STATE.md records the GitHub move

## Do this next
Tj: verify v4.7 on the phone - Data > Test the projection feed

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
  5d3fb69 ckpt 48: usage scan: archived the finished 2026-09-09 job from TASKS.md into LADDER.md (
  1553bac ckpt 45: usage optimisation: bootstrap printed an 851-char JAVA_TOOL_OPTIONS dump into e
  53c689e ckpt 44: reverted the end-to-end handoff test: it simulated a cap landing mid-edit, push
  07d0984 ckpt 42: wrote Tj's new request into TASKS.md before starting
  87b5bba ckpt 41: audit fix: a failing push was completely silent — autosave committed locally,
  678787a ckpt 39: added PreCompact hook (tools/toobig.sh): when a session grows big enough to aut
  198ab83 ckpt 37: de-Coworked the system: BRIEF.md cold-start/persistence/commands rewritten for 
  554e113 ckpt 35: cross-account handoff system finished and verified: SessionStart briefing, auto
  72cb32d ckpt 32: wired the cross-account handoff: autosave hook, SessionStart briefing, ckpt now
  031777f ship v4.7: v4.7 — the audit fixed: return TD scores once, kickoff locks, the name-key 
```
