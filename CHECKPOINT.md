# CHECKPOINT 218 — read me first, then TASKS.md

**Written:** 2026-09-15T04:36:37Z · **version:** 6.2 · **tests:** all 14 suites green

## Just done
Fixed the real back-button regression: registered android.window.OnBackInvokedCallback (API 33+) alongside the existing onKeyDown fallback, since a real Android 13+ phone's predictive-back gesture never synthesizes a KEYCODE_BACK KeyEvent at all -- onKeyDown alone silently never fired. Both paths now share one askPageToHandleBack() method. Required android:enableOnBackInvokedCallback=true in the manifest. New source-text regression tests in test_gestures.js. All 13 suites + ES2018 gate green; bash build.sh compiles clean (26 classes). Updated TASKS.md/STATE.md.

## Do this next
Ship as v6.3, trigger+verify the GitHub Release, update TASKS.md's Waiting-on-Tj pointer to v6.3 with the back-button check as the top item, then reply to Tj.

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
  ab24515 ckpt 208: Wrote Tj's real-device bug report to TASKS.md (2026-09-15d): back button still
  50c304f ckpt 205: Archived the finished 2026-09-15c job to LADDER.md §30, reset TASKS.md to 'no
  82284ab ship v6.2: Rosters reorder, Android back-button/app-resume/splash-flash fixes, live Clau
  d30a945 ckpt 198: Item 8 (full sweep) complete: live-browser walkthrough of all 7 tabs found no 
  bfaec3e ckpt 178: Item 7 done: PlayerDB.ensureFresh() auto-refreshes the player database quietly
  e85f9ca ckpt 164: Verified item 6 (bench 'why not' explanations): all 13 test suites + ES2018 ga
  54cdf5a ckpt 162: item 5 done: removed every 'how much Claude usage I have left' display and rep
  46f5b26 ckpt 143: items 1-4 of today's 8-part request. (1) Rosters tab: trade evaluator moved to
  c55702b ckpt 135: wrote Tj's new 8-part request (bug/UI sweep, Rosters reorder, Android back-but
  1de4930 ckpt 132: shipped v6.1 (both bug fixes), triggered and verified the GitHub Release (non-
```

(9 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
