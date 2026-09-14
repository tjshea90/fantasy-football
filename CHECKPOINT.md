# CHECKPOINT 90 — read me first, then TASKS.md

**Written:** 2026-09-14T23:08:01Z · **version:** 5.7 · **tests:** all 13 suites green

## Just done
wrote up the full 2026-09-14e job (5 requests) in STATE.md under its own dated section -- design reasoning, the four rejected third-party projection sources and why (NFL.com anonymous access returns null data, FantasyPros 403s without a paid key, Yahoo needs OAuth, MyFantasyLeague needs a real hosted league ID), the two bugs the test suites caught before commit, and the one known pre-existing limitation left intentionally un-fixed (unscoped/stale Claude-verdict lookup in projectOne, affects every team equally, not introduced today). Moved the finished job from TASKS.md to LADDER.md section 27 with each box named against the test that proves it, and reset TASKS.md to no-active-job plus an updated 'waiting on Tj' phone-confirmation list for today's changes.

## Do this next
run ship.sh -- first real build.sh run on this container will download the Android SDK (~600MB), so it may take a few minutes. Verify the dex contains every class, all 13 suites gate green, then trigger publish-release.yml, verify the Release actually published (assets non-empty), and send Tj the plain tappable Release link per the CLAUDE.md standing rule -- not a code block.

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
  4cd42ce ckpt 82: task 5 done: injury/questionable tags (same flags the Advice tab already comput
  e10158d ckpt 75: tasks 1-4 done: (1) app now auto-advances to the current NFL week on cold boot 
  41a9374 ckpt 52: wrote Tj's 5-part request (auto-select current NFL week everywhere, stop showin
  b59fff0 ckpt 148: corrected the standing rule immediately on Tj's feedback: a fenced code block 
  65fe8fd ckpt 145: saved Tj's exact message-style request into the CLAUDE.md standing rule: every
  c20caaf ckpt 143: verified the Release pipeline end-to-end and closed the loop: triggered publis
  66dcf03 ckpt 137: redesigned the release trigger after discovering git tag-push 403s for this se
  7da2ea2 ckpt 134: built the real GitHub Release pipeline Tj asked for, after confirming this ses
  3c3ecc2 ckpt 129: wrote Tj's request to style the ship-link message like a real GitHub Release (
  a853fb4 ckpt 127: made the CLAUDE.md APK-link standing rule explicit about FORMAT, not just URL 
```

(7 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
