# CHECKPOINT 32 — read me first, then TASKS.md

**Written:** 2026-09-09T22:49:17Z · **version:** 4.7 · **tests:** all 13 suites green

## Just done
wired the cross-account handoff: autosave hook, SessionStart briefing, ckpt now pushes, secret scan, MANIFEST repaired

## Do this next
Tj to confirm the hook fires in a fresh session on a second account; then back to app work — verify v4.7 on the phone (Data > Test the projection feed)

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
  d963f2c Cross-account handoff: autosave hook, session-start briefing, push on checkpoint
  0225f84 Add auto-checkpoint hook; clean up test line in CLAUDE.md
  ca59689 auto-checkpoint: 2026-09-09T22:33:38Z
  13bbe1a Add CLAUDE.md with checkpoint/resume process for multi-account work
  04d08d8 Add prebuilt v4.7 APK for direct download
  5f3043b Add GitHub Actions workflow to build APK on push
  031777f ship v4.7: v4.7 — the audit fixed: return TD scores once, kickoff locks, the name-key bug in four places, honest+75x cheaper saves, API key out of Downloads, daily alarm; plus swipe between tabs, pull to refresh and a working back button
  ab24683 ckpt 24: ship: v4.7 — the audit fixed: return TD scores once, kickoff locks, the name-key bug in four places, honest+75x cheaper saves, API key out of Downloads, daily alarm; plus swipe between tabs, pull to refresh and a working back button
  2265e04 ckpt 23: ship: v4.7 — the audit fixed: return TD scores once, kickoff locks, the name-key bug in four places, honest+75x cheaper saves, API key out of Downloads, daily alarm; plus swipe between tabs, pull to refresh and a working back button
  e7c2208 ckpt 22: v4.7 docs: ladder 17a-17j, release notes, tasks
```
