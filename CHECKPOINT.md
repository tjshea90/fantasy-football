# CHECKPOINT 134 — read me first, then TASKS.md

**Written:** 2026-09-14T21:40:45Z · **version:** 5.7 · **tests:** all 13 suites green

## Just done
built the real GitHub Release pipeline Tj asked for, after confirming this session's GitHub MCP tools have no create-release/upload-asset capability (checked, not assumed -- release tools are read-only: get_release_by_tag/get_latest_release/list_releases/get_tag/list_tags). Design: ship.sh now creates+pushes a vX.Y git tag (pure local git, no API needed) once main is confirmed current; new .github/workflows/publish-release.yml triggers on that tag push and uses the Actions runner's automatic GITHUB_TOKEN (gh release create) to publish a real Release with the already-committed, already-tested APK attached as an asset -- it does not rebuild or re-gate anything, ship.sh already did that. Release notes pull the matching line from BUILDLOG.md. Added the new workflow to MANIFEST.txt (bootstrap.sh confirms it agrees). ship.sh's final message now points at the Release tag URL but explicitly says to verify via mcp__github__get_release_by_tag first, since the workflow runs asynchronously

## Do this next
push a v5.7 tag now (that APK is already built/tested/committed) to validate the whole pipeline end-to-end against the real repo, then verify via mcp__github__actions_list and get_release_by_tag before telling Tj anything works

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
  3c3ecc2 ckpt 129: wrote Tj's request to style the ship-link message like a real GitHub Release (
  a853fb4 ckpt 127: made the CLAUDE.md APK-link standing rule explicit about FORMAT, not just URL 
  c9cd2dd ckpt 125: fixed the download link format itself: Tj's screenshot showed the GitHub mobil
  a5aaee8 ckpt 122: extended the same main-sync fix to ckpt.sh and ship.sh, not just resume.sh -- 
  bacf3fa ckpt 119: recovered from the exact incident CLAUDE.md warns about by name: this whole se
  a8e4db7 ckpt 116: added a standing rule to CLAUDE.md: after every successful ship.sh, tell Tj th
  ecabeb7 ship v5.7: fix the permanently-broken 'limit only' projection-feed fallback route (ESPN 
  b40f519 ckpt 104: diagnosed Tj's Data-tab screenshot: the 'limit only: FAILED' route is not the 
  d4bc132 ckpt 102: removed a stray demo file (sample-waiver-handoff-v5.5.md) that autosave picked
  29aaed8 ship v5.6: fix stale injury feed on the Wire tab: freshness line + a no-API-key Sync but
```

(4 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
