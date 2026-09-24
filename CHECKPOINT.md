# CHECKPOINT 132 — read me first, then TASKS.md

**Written:** 2026-09-24T19:34:49Z · **version:** 8.6 · **tests:** all 27 suites green

## Just done
Items A+B done: Live win probability (Sim.matchupOdds: banked + proj x game-left, measured position spread, normal approx) + Schedule.remaining (game-clock fraction); the projected finish now uses the same live model (a mid-game player's rest of game counts); the projection/win-prob card moved under the team boxes; a final week reads 'Final · you won by X'. New tools/test_picks2.js.

## Do this next
Items C+D: position colour chips (post-render tint pass over .slot) + compact Q/D/O/IR injury badges (shared helper; ctx.healthTag for recommend.js).

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
     M MANIFEST.txt
     M TASKS.md

## Last ten checkpoints
```
  2b6781b ckpt 127: Wrote Tj's 2026-09-24b request into TASKS.md (A-K: proposals 1,2,3,6,7,8,9,10 
  17e9448 ckpt 125: Full test + competitor survey (2026-09-24) complete: v8.6 Release published an
  9e19564 ship v8.6: v8.6: full test -- a failed injury fetch no longer clears every OUT/IR flag; 
  249189d ckpt 122: ship: v8.6: full test -- a failed injury fetch no longer clears every OUT/IR f
  2dc714b ckpt 121: Step 7 done: proposals 1-10 in TASKS 'Waiting on Tj' (win prob, position colou
  c3b1759 ckpt 116: F17 fixed: a failed injury-feed fetch no longer wipes (and saves) an empty inj
  58a69eb ckpt 110: F15 (a failed projection refresh wiped this week's/season's loaded projections
  dfaf97e ckpt 105: F14 fixed (doSync: a failed box score no longer wipes that game's stored lines
  8edc7cf ckpt 99: Small polish from the competitor survey: live game clock on the schedule badge 
  4c4845e ckpt 92: Fixed F1-F8, F12, F13 (ui.js/recommend.js/sim.js) + F6 sim random pairing for u
```

(4 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
