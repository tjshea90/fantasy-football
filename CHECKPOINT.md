# CHECKPOINT 82 — read me first, then TASKS.md

**Written:** 2026-09-14T23:02:34Z · **version:** 5.7 · **tests:** all 13 suites green

## Just done
task 5 done: injury/questionable tags (same flags the Advice tab already computed via Recommend.projectAll) now also show on the Rosters tab, the Lineups tab (both mine and this week's opponent), and the Live tab's open lineup rows -- reusing the exact same ESPN-injury-feed-derived flags everywhere so a player never reads healthy on one screen and hurt on another. The injury feed itself now auto-refreshes by riding the existing live-score poll (liveTick), gated by loadNews's own 10-minute freshness cache, so it updates roughly every 10 minutes (or faster during a live game's 45s cadence) without any manual sync tap. Fixed a syntax error from a misplaced statement inside an if/else-if chain during the Live tab edit -- caught by check_es2018.js/test_lifecycle.js before commit. All 13 suites green.

## Do this next
all 5 of Tj's requested changes are implemented. Next: do the standing post-update sweep CLAUDE.md requires (UI/efficiency/bug-fix pass across everything touched today), re-verify with all suites + a real build.sh, then ship.sh and publish the GitHub Release per the standing rule.

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
  e10158d ckpt 75: tasks 1-4 done: (1) app now auto-advances to the current NFL week on cold boot 
  41a9374 ckpt 52: wrote Tj's 5-part request (auto-select current NFL week everywhere, stop showin
  b59fff0 ckpt 148: corrected the standing rule immediately on Tj's feedback: a fenced code block 
  65fe8fd ckpt 145: saved Tj's exact message-style request into the CLAUDE.md standing rule: every
  c20caaf ckpt 143: verified the Release pipeline end-to-end and closed the loop: triggered publis
  66dcf03 ckpt 137: redesigned the release trigger after discovering git tag-push 403s for this se
  7da2ea2 ckpt 134: built the real GitHub Release pipeline Tj asked for, after confirming this ses
  3c3ecc2 ckpt 129: wrote Tj's request to style the ship-link message like a real GitHub Release (
  a853fb4 ckpt 127: made the CLAUDE.md APK-link standing rule explicit about FORMAT, not just URL 
  c9cd2dd ckpt 125: fixed the download link format itself: Tj's screenshot showed the GitHub mobil
```

(6 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
