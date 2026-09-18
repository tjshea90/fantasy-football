# CHECKPOINT 66 — read me first, then TASKS.md

**Written:** 2026-09-18T17:24:34Z · **version:** 7.4 · **tests:** all 18 suites green

## Just done
Broader code/UI review pass (Tj's same 2026-09-18 message): delegated a research-only audit of app/assets/*.js and app.css. Fixed two real findings: (1) the Wire tab's 'Ask Claude about the wire' button and the Rosters tab's 'How your team stacks up' Ask-Claude button never checked jobRunning() when rebuilt, unlike every sibling Ask-Claude/refresh button in the file -- switching tabs away and back while either 5-minute Claude call was in flight rebuilt the card with a fresh, enabled button, letting a second concurrent paid API call fire and whichever response landed last silently overwrite the cache. Fixed with the same jobRunning('waivers')/jobRunning('teamanalysis') guard the db-refresh and news-sync buttons already use. Verified with a throwaway harness script (not committed) reproducing the exact re-render-while-job-running scenario for both buttons -- confirmed disabled after the fix. (2) value.js's upgrades() and waiverContext() each ran Recommend.projectAll() twice per call (once directly, once again inside myStarters()->bestLineup()) even though needs() already had the fix for this via an optional starters param -- threaded an optional allProj through bestLineup()/myStarters() the same way, so a free-agent-board render or position-filter click no longer triples the roster-wide projection pass. Also surfaced but NOT changed: app/assets/sim.js's season()/power()/allPlay()/bracket() are fully implemented, tested, and never called from any production tab -- looks like orphaned surface from a feature that was never wired in or was removed on a divergent branch; needs a product decision from Tj, not a unilateral delete. All 18 suites + ES2018 gate green throughout.

## Do this next
Continue the improvement pass: look at the doSync() week-capture race a subagent audit flagged (ui.js ~3847-4056 reads the shared module-level 'week' variable throughout its async chain instead of snapshotting it at entry, so a concurrent NFL-week auto-advance mid-sync could write box scores into the wrong week's weekMeta/book/stats) -- read doSync fully, decide on a safe fix (snapshot the week being synced and write results under THAT week regardless of what the display week has moved to by completion), fix it carefully since it touches the core sync pipeline, add/extend a regression test, then ask Tj about the sim.js dead code before touching it. Keep running the full suite after each change.

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
  58affc7 ckpt 57: Fixed the real waiver-wire tab-highlight bug: boot() restores view from lastTab
  a68ed9a ckpt 78: Shipped v7.4: QB waiver-swap threshold fix (QB_MIN_GAIN=6, QB_MIN_MEASURED=3, s
  6a50a4e ship v7.4: waiver-wire QB season-edge fix (Stafford/Bo Nix no longer swapped for a margi
  87ff104 ckpt 69: 1f/tests done: web research confirmed the QB-skepticism direction (footballguys
  f8e561f ckpt 67: 1b/1c/1e done: QB waiver swaps now need a season-defining edge (6+ pts/gm, 3+ r
  db1b963 ckpt 53: Wrote the 2026-09-18 request into TASKS.md verbatim (waiver-wire QB/RB-WR smart
  23dc5d1 ckpt 123: v7.3 shipped and verified: GitHub Release published (non-empty assets array, F
  f49cf4c ship v7.3: Fixed a bug in all three Claude-handoff features (advice/waivers/team-analysi
  8ba6db4 ckpt 119: Archived the unfilled-template bugfix to LADDER.md §40, added the STATE.md na
  0884569 ckpt 114: Wrote Tj's bug report ('gave nonsense answers', the unfilled-template screensh
```

(8 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
