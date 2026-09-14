# CHECKPOINT 145 — read me first, then TASKS.md

**Written:** 2026-09-14T21:48:30Z · **version:** 5.7 · **tests:** all 13 suites green

## Just done
saved Tj's exact message-style request into the CLAUDE.md standing rule: every future ship-link message now follows his Portfolio-project template (vX.Y is shipped / what went green / release published / recorded in BUILDLOG.md / Grab it here + link) with one honest substitution -- 'Run #N went green' becomes 'every test suite and the ES2018 gate went green' since this repo's actual gate is ship.sh running locally, not a numbered remote CI run, and I'm not copying wording that would misstate how this repo works

## Do this next
none -- no active job. Send Tj the v5.7 link in the new message format to confirm it reads right

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
  c20caaf ckpt 143: verified the Release pipeline end-to-end and closed the loop: triggered publis
  66dcf03 ckpt 137: redesigned the release trigger after discovering git tag-push 403s for this se
  7da2ea2 ckpt 134: built the real GitHub Release pipeline Tj asked for, after confirming this ses
  3c3ecc2 ckpt 129: wrote Tj's request to style the ship-link message like a real GitHub Release (
  a853fb4 ckpt 127: made the CLAUDE.md APK-link standing rule explicit about FORMAT, not just URL 
  c9cd2dd ckpt 125: fixed the download link format itself: Tj's screenshot showed the GitHub mobil
  a5aaee8 ckpt 122: extended the same main-sync fix to ckpt.sh and ship.sh, not just resume.sh -- 
  bacf3fa ckpt 119: recovered from the exact incident CLAUDE.md warns about by name: this whole se
  a8e4db7 ckpt 116: added a standing rule to CLAUDE.md: after every successful ship.sh, tell Tj th
  ecabeb7 ship v5.7: fix the permanently-broken 'limit only' projection-feed fallback route (ESPN 
```

(1 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
