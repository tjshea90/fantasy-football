# CHECKPOINT 129 — read me first, then TASKS.md

**Written:** 2026-09-14T21:36:39Z · **version:** 5.7 · **tests:** all 13 suites green

## Just done
wrote Tj's request to style the ship-link message like a real GitHub Release (his Portfolio project example: .../releases/tag/v7.22) into TASKS.md before doing anything -- confirmed this repo has zero GitHub Releases published today (checked earlier this session), so this needs an actual new release-creation step via mcp__github__ tools after ship.sh, not just different link text, or it 404s exactly like the last two rounds

## Do this next
find the right mcp__github__ tool for creating a release with an attached binary asset, then prove it on v5.7 before writing anything into the standing rule

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
  a853fb4 ckpt 127: made the CLAUDE.md APK-link standing rule explicit about FORMAT, not just URL 
  c9cd2dd ckpt 125: fixed the download link format itself: Tj's screenshot showed the GitHub mobil
  a5aaee8 ckpt 122: extended the same main-sync fix to ckpt.sh and ship.sh, not just resume.sh -- 
  bacf3fa ckpt 119: recovered from the exact incident CLAUDE.md warns about by name: this whole se
  a8e4db7 ckpt 116: added a standing rule to CLAUDE.md: after every successful ship.sh, tell Tj th
  ecabeb7 ship v5.7: fix the permanently-broken 'limit only' projection-feed fallback route (ESPN 
  b40f519 ckpt 104: diagnosed Tj's Data-tab screenshot: the 'limit only: FAILED' route is not the 
  d4bc132 ckpt 102: removed a stray demo file (sample-waiver-handoff-v5.5.md) that autosave picked
  29aaed8 ship v5.6: fix stale injury feed on the Wire tab: freshness line + a no-API-key Sync but
  a14f9a3 ckpt 92: fixed the stale-injury-feed bug Tj reported with a screenshot: recommend.js exp
```

(1 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
