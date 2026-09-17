# CHECKPOINT 112 — read me first, then TASKS.md

**Written:** 2026-09-17T23:36:24Z · **version:** 7.2 · **tests:** all 18 suites green

## Just done
Fixed the bug Tj reported from the v7.2 screenshot: the team-analysis screen showed his own app's literal unfilled template back at him ('Rank 1 of 10. <a few honest sentences...>'). Root cause, confirmed reproducible: Ai.parseAnswer/jsonOf takes the WIDEST valid JSON object in whatever text it's given, and the unfilled skeleton embedded in every handoff's own '## The file to give back' section is a bigger, equally shape-valid object than a short real answer — so feeding the file exported FOR Claude back in (instead of what Claude actually sent back) parses cleanly and gets silently imported as if it were real. This is a PRE-EXISTING bug in the older waiver handoff too (reproduced directly), not something the new feature introduced — Tj's report just surfaced it first. Fixed with one shared guard in Handoff.importReply(): a recursive findPlaceholder() scan refuses any reply where a field still holds the literal '<...>' placeholder text this app's own skeletons always use and nothing else ever produces, with a specific, actionable error explaining the likely mistake (wrong file). Applies to all three kinds (advice/waivers/teamanalysis) from one implementation. Added 5 new regression cases to tools/test_handoff.js: all three skeletons refused, a placeholder nested inside an array element caught too, and a genuinely real reply with no bracketed field confirmed to still import fine. All 18 suites + ES2018 gate green.

## Do this next
Ship this fix as its own release (build.sh already has a working SDK from v7.2, so this should be fast) and send Tj the link

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
  367138e ckpt 107: Closed out the 2026-09-17b job: archived the team-analysis feature to LADDER.m
  74ac8fe ship v7.2: Added the team analysis feature: ask Claude for its overall take on your team
  e5d1ce7 ckpt 100: Noted in STATE.md why the first ship.sh call WARNed and skipped publishing (no
  f097e01 ship v7.1: Added the team analysis feature: ask Claude for its overall take on your team
  54e249f ckpt 92: Sweep pass over the new feature: removed an unused mdl parameter from normalize
  cb00bed ckpt 86: 1d/1e done: added the 'How your team stacks up' card to ui.js's Rosters tab (be
  31fec06 ckpt 77: 1b done: extended handoff.js with buildTeamAnalysis() (export markdown: standin
  fa76b5d ckpt 66: 1c done: added ai.js's live-API twin for team analysis — teamAnalysisPrefix/B
  db8bd64 ckpt 62: 1a wrapped up: added tools/test_teamreport.js (shape + bye-week-zero-price chec
  8881beb ckpt 58: 1a done: new teamreport.js composes Store.standings + every team's roster (pric
```

(4 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
