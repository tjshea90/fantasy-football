# CHECKPOINT 64 — read me first, then TASKS.md

**Written:** 2026-09-15T01:59:37Z · **version:** 5.9 · **tests:** all 13 suites green

## Just done
root-caused the resume-system failure Tj reported: a session ran a long research phase on the new stats/game-log feature request and was cut off by a usage cap before ever writing it to TASKS.md, and the PostToolUse autosave hook (Edit|Write|NotebookEdit|Bash only) never fired during pure-research reading either -- so nothing reached disk and the next session opened cold with no way to know the request existed. Confirmed against real history (origin/main's ckpt-51 commit was a sibling session resuming correctly from what WAS on disk, proving the mechanics work when there is something to find). Fixed in two parts: (1) immediately wrote Tj's verbatim stats/game-log request into TASKS.md as the actual current job with an architecture-notes section so the research already done is not lost either; (2) closed the systemic gap with a new UserPromptSubmit hook (tools/capture_inbox.sh) that appends every message Tj sends to a new INBOX.md, verbatim, and commits+pushes it the instant it arrives -- before any tool call, independent of a session's judgment about when to save. resume.sh now prints the INBOX.md tail unconditionally on every boot. CLAUDE.md documents this as a new level 0 under Saving work. MANIFEST.txt updated for the two new files; bootstrap.sh confirmed clean. Tested by hand: fed capture_inbox.sh a sample JSON payload with quotes and a newline on stdin, confirmed it appended correctly and committed+pushed; verified resume.sh's tail-extraction sed against a synthetic multi-entry sample.

## Do this next
start building the Stats tab feature itself per the now-recorded TASKS.md breakdown: gamelog.js first (per-team-per-week full box score cache), then the Stats tab UI, then long-press wiring, then Top Players, then the full 8-point testing pass Tj asked for, then ship + release.

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
  730d4e5 ckpt 51: resumed after the interruption: confirmed the mid-change LADDER.md/STATE.md v5.
  a8e2c3f ship v5.9: v5.8: auto-select current NFL week app-wide, fix stale cached projections on 
  6ff1bcd ship v5.8: v5.8: auto-select current NFL week app-wide, fix stale cached projections on 
  a6e7847 ckpt 90: wrote up the full 2026-09-14e job (5 requests) in STATE.md under its own dated 
  4cd42ce ckpt 82: task 5 done: injury/questionable tags (same flags the Advice tab already comput
  e10158d ckpt 75: tasks 1-4 done: (1) app now auto-advances to the current NFL week on cold boot 
  41a9374 ckpt 52: wrote Tj's 5-part request (auto-select current NFL week everywhere, stop showin
  b59fff0 ckpt 148: corrected the standing rule immediately on Tj's feedback: a fenced code block 
  65fe8fd ckpt 145: saved Tj's exact message-style request into the CLAUDE.md standing rule: every
```

(12 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
