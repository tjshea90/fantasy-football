# CHECKPOINT 448 — read me first, then TASKS.md

**Written:** 2026-09-15T17:02:47Z · **version:** 6.6 · **tests:** all 14 suites green

## Just done
Removed two scratch Playwright test scripts (tools/_data_tab_check.js, tools/_recap_check.js) that were used for manual live-browser verification of the recap feature/Data tab sub-nav and got auto-committed by the autosave hook -- an earlier cleanup attempt did not actually take effect (likely a shell exit-code issue in a compound rm command), left undetected until ship.sh's bootstrap/MANIFEST check caught them as 'on disk but not in MANIFEST.'

## Do this next
Re-run bash ship.sh now that the working tree is clean and matches MANIFEST.txt.

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
  3f6499e ckpt 446: 2026-09-15g documentation complete: TASKS.md ticked with full proof and reset 
  f923c2d ckpt 428: v6.6 shipped and verified: GitHub Release published (non-empty assets, FFTrack
  a2f35cf ship v6.6: 2026-09-15h: the week-advance fix still failed on a true cold boot -- added l
  dafed68 ckpt 424: Documented 2026-09-15h fix: TASKS.md job entry with steps 1-3 ticked (step 4 p
  687d92b ckpt 420: Fixed the week-advance bug for real this time (Tj reported it persisting even 
  336f833 ckpt 414: In progress on 2026-09-15g (recap feature + Data tab sub-nav): built weeklyRec
  a0d725b ckpt 403: Recorded new job 2026-09-15g in TASKS.md: wire up the weekly recap Claude writ
  fcbbbcb ckpt 400: v6.5 shipped and verified: GitHub Release published (mcp__github__get_release_
  5c03345 ship v6.5: 2026-09-15f: fixed the app never advancing past a finished NFL week unless tr
  d043179 ckpt 397: Documented the week-auto-advance fix: TASKS.md job entry ticked with full proo
```

(1 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
