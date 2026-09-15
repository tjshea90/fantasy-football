# CHECKPOINT 236 — read me first, then TASKS.md

**Written:** 2026-09-15T07:52:45Z · **version:** 6.3 · **tests:** all 14 suites green

## Just done
UI sweep finding #2 (Stats tab): the Pts column was the LAST column in the game-log/roster table, pushed off-screen behind 6+ stat columns on a 390px phone -- the one number the whole Stats tab exists to show was reachable only via an undiscoverable horizontal swipe. Fixed by moving Pts right after the row-identifying column(s) in statTable(). Verified live in browser (PTS now shows immediately: 'WK OPP PTS CMP YDS TD INT RUYD' -> '1 vs DEN(live) 29.1 10 127 1 1 27') and with new source-text regression tests. All 13 suites + ES2018 gate green.

## Do this next
First of 6 background code-review agents reported back (AI/Claude integration layer): found a real bug (usage.js's cost tracking/estimates are model-blind -- always prices against one flat rate table even though the app dispatches calls to two different real models, main vs cheap, so the displayed cost can be off by 2.5x-5x depending on settings) plus a caching-floor finding (the cheap-model path's prompt caching likely never engages since both prefixes are under Haiku 4.5's 4096-token minimum) and a minor handoff.js detect() prefix-matching looseness. Need to verify each independently before fixing -- continue triaging as the other 5 agents report back.

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
  24a73a3 ckpt 230: UI sweep finding #1 (Live tab): player names were truncating mid-word in the t
  1827e5c ckpt 226: Wrote Tj's comprehensive app-wide improvement request to TASKS.md (2026-09-15e
  882ace6 ckpt 223: Shipped v6.3, triggered and verified the GitHub Release (non-empty asset, corr
  f21a19e ship v6.3: Real back-button fix: registered the platform OnBackInvokedCallback (API 33+)
  b518033 ckpt 218: Fixed the real back-button regression: registered android.window.OnBackInvoked
  ab24515 ckpt 208: Wrote Tj's real-device bug report to TASKS.md (2026-09-15d): back button still
  50c304f ckpt 205: Archived the finished 2026-09-15c job to LADDER.md §30, reset TASKS.md to 'no
  82284ab ship v6.2: Rosters reorder, Android back-button/app-resume/splash-flash fixes, live Clau
  d30a945 ckpt 198: Item 8 (full sweep) complete: live-browser walkthrough of all 7 tabs found no 
  bfaec3e ckpt 178: Item 7 done: PlayerDB.ensureFresh() auto-refreshes the player database quietly
```

(5 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
