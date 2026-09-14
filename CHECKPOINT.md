# CHECKPOINT 125 — read me first, then TASKS.md

**Written:** 2026-09-14T21:21:12Z · **version:** 5.7 · **tests:** all 13 suites green

## Just done
fixed the download link format itself: Tj's screenshot showed the GitHub mobile app rendering the binary APK as garbled raw text at the /blob/ URL -- confirmed with curl -IL that /raw/main/... 302s to raw.githubusercontent.com with content-type: application/octet-stream, which forces an actual download in any client instead of an in-app render attempt. Updated the CLAUDE.md standing rule to specify /raw/ not /blob/ with the reasoning, and made ship.sh print the exact ready-to-paste URL itself (branch-aware) instead of a vague 'tap it, then Download' pointer that left the exact URL format for the session to guess at -- which is exactly how the wrong /blob/ format got used the first time

## Do this next
none -- verify the corrected v5.7 link actually downloads (not renders) on Tj's phone

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
  a5aaee8 ckpt 122: extended the same main-sync fix to ckpt.sh and ship.sh, not just resume.sh -- 
  bacf3fa ckpt 119: recovered from the exact incident CLAUDE.md warns about by name: this whole se
  a8e4db7 ckpt 116: added a standing rule to CLAUDE.md: after every successful ship.sh, tell Tj th
  ecabeb7 ship v5.7: fix the permanently-broken 'limit only' projection-feed fallback route (ESPN 
  b40f519 ckpt 104: diagnosed Tj's Data-tab screenshot: the 'limit only: FAILED' route is not the 
  d4bc132 ckpt 102: removed a stray demo file (sample-waiver-handoff-v5.5.md) that autosave picked
  29aaed8 ship v5.6: fix stale injury feed on the Wire tab: freshness line + a no-API-key Sync but
  a14f9a3 ckpt 92: fixed the stale-injury-feed bug Tj reported with a screenshot: recommend.js exp
  13a5233 ckpt 82: diagnosed Tj's stale-injury-data report: confirmed via code reading (not guessi
  d29d64f ship v5.5: waiver wire upgrade: roster injuries with season outlook, season-vs-week prio
```

(2 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
