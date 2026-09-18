# CHECKPOINT 80 — read me first, then TASKS.md

**Written:** 2026-09-18T20:39:01Z · **version:** 7.7 · **tests:** all 21 suites green

## Just done
Step G done -- the thorough sweep, and it caught three more real bugs, all of them in THIS job's own change (the ckpt-115 discipline: re-read your own diff adversarially). (1) The forced-replacement headline was nested inside 'if (ups.length)', so a dead roster spot with nothing startable on the wire at his position would have gone completely unreported -- exactly when Tj most needs telling. Moved out, with a line saying the spot is still dead. (2) subjectBefore() did not strip possessives, so "Hand's move to injured reserve ... he'd miss the remainder of the season" read as somebody else's report and a genuinely finished player's own words were discarded. (3) SEVERE: lineup legality was checked per pair against the ORIGINAL body counts, so two cross-position swaps that are each legal alone could between them take the last tight end -- the board is a list Tj acts on top-to-bottom and it has to be legal read that way. Now every accepted swap is applied to a running count and the next pair is measured against the roster that would then exist; confirmed the new test produces TE:0 against the pre-fix code and TE:1 now. Also removed a dead flexOK variable, dropped two over-broad past-markers ('previously', 'career') that would have suppressed real reports, hardened the name-scan loop against a non-advancing lastIndex, and both Claude prompts now distinguish 'on IR until Oct 18' from 'out for the season' in the roster table. 21 suites green, ES2018 gate green, end-to-end smoke test on the LIVE feed with Tj's real 17-man roster: no season-ending holes, no duplicate drops, Schultz clear, 23 ms.

## Do this next
Step I: ship. bash ship.sh, then trigger publish-release.yml via mcp__github__actions_run_trigger with the new version, verify with get_release_by_tag, and send Tj the release link as plain tappable text.

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
  76e82b1 ckpt 70: Step H done. New suite tools/test_wire.js (20 suites now, all green) pins every
  e0dc8a2 ckpt 67: Steps B/C/D/E/F built. value.js upgrades() rewritten: it now builds EVERY plaus
  f1c2810 ckpt 58: Step A done — the hallucination is fixed at its source. recommend.js: loadNew
  2e1c0d9 ckpt 53: Wrote Tj's 2026-09-18d 'the wire is broken' request into TASKS.md verbatim, and
  837c56c ckpt 118: Shipped v7.7 and published the GitHub Release: triggered publish-release.yml, 
  abc1cf3 ship v7.7: Waiver wire overhauled: ranked on expected rest-of-season points in this leag
  f6d6ae6 ckpt 115: Step I sweep, part 2 -- caught a severe bug in THIS job's own change by review
  8647e0a ckpt 110: Step I sweep, part 1. Found and fixed a THIRD instance of the same dead-code c
  c396c21 ckpt 106: Step G done plus two real staleness bugs found and fixed while doing it. UI: t
  6b0083a ckpt 96: Steps F done (rules 4+5). New Ai.waiverCriteriaText() states all six of Tj's cr
```

(9 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
