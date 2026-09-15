# CHECKPOINT 135 — read me first, then TASKS.md

**Written:** 2026-09-15T03:35:09Z · **version:** 6.1 · **tests:** all 14 suites green

## Just done
wrote Tj's new 8-part request (bug/UI sweep, Rosters reorder, Android back-button fix, app-resume state restore, no splash flash on resume, remove Claude-usage-remaining displays in favor of per-request cost estimates, bench 'why not to start' Claude explanations, PlayerDB auto-refresh) into TASKS.md verbatim, broken into checkable steps, before reading any code -- exactly the discipline that failed earlier today. INBOX.md already had it captured automatically the instant it arrived (confirmed by its own timestamp), so this write was not a race against anything, just the deliberate curated breakdown TASKS.md is for.

## Do this next
start investigating each of the 8 items in ui.js/android -- MainActivity.java's onKeyDown/onPause/onResume for items 2-4, usage.js/ai.js for item 5, recommend.js's existing bench-vs-start 'why' logic for item 6, playerdb.js's refresh() + wireGestures' pull-to-refresh dispatch for item 7, viewRosters' card order for item 1 (should be quick). Work roughly in the order listed since 1 is trivial and 2-4 (all about Android lifecycle) are likely related enough to investigate together.

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
  1de4930 ckpt 132: shipped v6.1 (both bug fixes), triggered and verified the GitHub Release (non-
  b98c220 ship v6.1: fix two bugs found on Tj's phone within minutes of v6.0: Top Players got stuc
  16c61b7 ckpt 127: fixed two real bugs Tj found on his phone within minutes of v6.0, both confirm
  dc92ac5 ckpt 120: shipped v6.0 (Stats tab + resume-system fix), triggered and verified the GitHu
  be33e59 ship v6.0: add a Stats tab: search any current NFL player (or team defense) and see this
  d0cfa77 ckpt 111: real-browser validation of the Stats tab + long-press, end to end, with REAL l
  1f64c89 ckpt 104: steps 2+4 of the stats-tab job: built stats.js (Stats.render(root,ctx), mirror
  11bddd6 ckpt 73: fixed the red left over from the last checkpoint: test_lifecycle.js keeps its o
  581837a ckpt 71: step 1 of the stats-tab job done: gamelog.js -- a self-contained (own Native.sa
  9563bc3 ckpt 64: root-caused the resume-system failure Tj reported: a session ran a long researc
```

(2 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
