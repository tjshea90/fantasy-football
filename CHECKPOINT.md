# CHECKPOINT 75 — read me first, then TASKS.md

**Written:** 2026-09-14T23:00:26Z · **version:** 5.7 · **tests:** all 13 suites green

## Just done
tasks 1-4 done: (1) app now auto-advances to the current NFL week on cold boot via ESPN's own scoreboard calendar (Espn.currentWeek), never fighting a live session; (2) the Advice tab no longer shows a different week's cached projections -- Projections.find/missing are now week-gated and the tab shows a clear blank/loading state until this week's numbers actually load, and pull-to-refresh on Advice now runs the full syncAll (schedule+injuries+projections, Claude last) instead of the box-score sync; (3) the preseason/draft-time projection source (seed.projPG) is fully removed from the blend, weights and all explanatory text; (4) added a 'this week's opponent -- blended projections' card reusing the same ESPN+Sleeper rescoring pipeline for the opponent's full roster (both benches), scoped to only my team + this week's opponent per Tj's instruction. All 13 suites green (one test_gestures.js assertion updated to match the intentionally extended blocked() condition).

## Do this next
task 5 next: show injury/questionable status inline everywhere a roster is listed (Rosters tab, Lineups tab, Live tab -- Advice tab already had it), and make the injury feed refresh automatically/frequently by piggybacking on the existing live-score poll (liveTick) rather than only on manual sync. Then re-test everything, do the post-update improvement sweep CLAUDE.md's standing instructions require, and ship.

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
  41a9374 ckpt 52: wrote Tj's 5-part request (auto-select current NFL week everywhere, stop showin
  b59fff0 ckpt 148: corrected the standing rule immediately on Tj's feedback: a fenced code block 
  65fe8fd ckpt 145: saved Tj's exact message-style request into the CLAUDE.md standing rule: every
  c20caaf ckpt 143: verified the Release pipeline end-to-end and closed the loop: triggered publis
  66dcf03 ckpt 137: redesigned the release trigger after discovering git tag-push 403s for this se
  7da2ea2 ckpt 134: built the real GitHub Release pipeline Tj asked for, after confirming this ses
  3c3ecc2 ckpt 129: wrote Tj's request to style the ship-link message like a real GitHub Release (
  a853fb4 ckpt 127: made the CLAUDE.md APK-link standing rule explicit about FORMAT, not just URL 
  c9cd2dd ckpt 125: fixed the download link format itself: Tj's screenshot showed the GitHub mobil
  a5aaee8 ckpt 122: extended the same main-sync fix to ckpt.sh and ship.sh, not just resume.sh -- 
```

(22 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
