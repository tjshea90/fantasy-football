# CHECKPOINT 64 — read me first, then TASKS.md

**Written:** 2026-09-17T00:28:12Z · **version:** 6.9 · **tests:** all 17 suites green

## Just done
Found and fixed two real root causes of Chubb/Hunt/off-roster players reappearing on the Wire board after v6.9: (1) value.js's freeAgents() memo keyed only on (week, roster generation), so it never noticed PlayerDB or the injury feed refreshing in the background and kept replaying the first, incomplete render's snapshot all session — fixed by folding PlayerDB.meta().updated and Recommend.newsCache().at into the memo key; (2) playerdb.js's prune of off-every-roster players required all 32 team fetches to succeed in the same pass, so one flaky team blocked every removal forever — fixed to prune per-player based on whether HIS OWN last-known team's fetch succeeded, confirmed with live ESPN checks that Chubb and Hunt are on zero of the 32 current rosters. Also fixed the ranking Tj asked about directly: freeAgents() now ranks any real measured production (even 1 game) ahead of a zero-signal ESPN week-line guess, however big the guess. Added 4 new tests to tools/test_waiver.js, all 17 suites + ES2018 gate + build.sh green.

## Do this next
Ship v7.0: trigger the publish-release.yml workflow, verify the GitHub Release has a non-empty assets array, then send Tj the release link and ask if he wants this session to keep watching for his next report.

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
  18e4662 ckpt 54: Recorded the new 2026-09-17 job in TASKS.md: Tj reports Wire tab still recommen
  009de2b ckpt 80: Moved the completed 2026-09-16 waiver-wire/tab-lock job from TASKS.md to LADDER
  227f4bb ship v6.9: Rebuilt the waiver wire recommendation system: hard-excludes OUT/IR/SUSPENDED
  faf988b ckpt 74: Added the STATE.md narrative write-up for the 2026-09-16 waiver-wire rebuild + 
  a40f873 ckpt 72: Rebuilt the waiver-wire recommendation system per Tj's request: value.js's free
  6a449a0 ckpt 55: Diagnosed the waiver wire recommendation bug and the tab-lock bug with live ESP
  1621d5e ship v6.8: Stop assuming other teams' weekly lineups in the weekly recap and bench-regre
  805b12d ckpt 473: Removed the other-teams-weekly-lineup assumption from recap.js/sim.js per Tj's
```

(9 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
