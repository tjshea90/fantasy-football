# CHECKPOINT 52 — read me first, then TASKS.md

**Written:** 2026-09-14T22:41:47Z · **version:** 5.7 · **tests:** all 13 suites green

## Just done
wrote Tj's 5-part request (auto-select current NFL week everywhere, stop showing stale cached projections on the Advice tab, remove preseason sources from advice/recommendations, blend 2-3 more reputable rescored projection sources for my roster + this week's opponent roster, surface injury/questionable status on my players everywhere they're listed) into TASKS.md verbatim before writing any code

## Do this next
explore the codebase: find the week-selector logic used by each tab, the Advice tab's projection caching/loading, where preseason projection data enters recommend.js/ai.js, and the current injury-status plumbing -- then start on task 1 (auto-select current NFL week)

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
  b59fff0 ckpt 148: corrected the standing rule immediately on Tj's feedback: a fenced code block 
  65fe8fd ckpt 145: saved Tj's exact message-style request into the CLAUDE.md standing rule: every
  c20caaf ckpt 143: verified the Release pipeline end-to-end and closed the loop: triggered publis
  66dcf03 ckpt 137: redesigned the release trigger after discovering git tag-push 403s for this se
  7da2ea2 ckpt 134: built the real GitHub Release pipeline Tj asked for, after confirming this ses
  3c3ecc2 ckpt 129: wrote Tj's request to style the ship-link message like a real GitHub Release (
  a853fb4 ckpt 127: made the CLAUDE.md APK-link standing rule explicit about FORMAT, not just URL 
  c9cd2dd ckpt 125: fixed the download link format itself: Tj's screenshot showed the GitHub mobil
  a5aaee8 ckpt 122: extended the same main-sync fix to ckpt.sh and ship.sh, not just resume.sh -- 
  bacf3fa ckpt 119: recovered from the exact incident CLAUDE.md warns about by name: this whole se
```

(1 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
