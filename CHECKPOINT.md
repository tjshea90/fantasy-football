# CHECKPOINT 87 — read me first, then TASKS.md

**Written:** 2026-09-18T17:36:08Z · **version:** 7.4 · **tests:** all 19 suites green

## Just done
Fixed the doSync() week-capture race a subagent audit flagged: doSync read the shared module-level 'week' variable throughout its whole async chain (Espn.weekGames call, Store.getStats/setBook, S.weekMeta writes, autoFillWeek, the completion toast) instead of snapshotting it once at entry. week can be mutated mid-flight by the NFL-week auto-advance (applyCurrentWeek, reachable from syncCurrentWeek at boot/appResume) or simply by tapping the week-next arrow while a sync is still in flight -- neither path checks the busy flag. Without a capture, a sync that started for week N could finish after week had moved to N+1 and file its results (book, weekMeta, the scored-players toast) under week N+1 instead of the week it actually fetched, silently corrupting the wrong week's stats. Fixed by capturing syncedWeek=week once at doSync's top and using it for every 'week this sync is for' reference from then on (render()/renderHeader() still read the live view/week, since the SCREEN should track the current week regardless of which week just finished syncing). Named syncedWeek, not syncWeek, to avoid colliding with the existing top-level syncWeek() button-handler function. New tools/test_synccapture.js reproduces the exact race (stalls Espn.weekGames, advances week via the real wkNext button mid-flight, then resolves) -- confirmed it fails against the pre-fix code (results leaked into week 2) and passes against the fix. Updated test_boot.js's source-text pin for the renamed variable. Registered the new test in MANIFEST.txt. All 19 suites + ES2018 gate green.

## Do this next
Keep going on the improvement pass: ask Tj about the sim.js dead code (season()/power()/allPlay()/bracket() -- fully implemented and tested but never called from any production tab, per the earlier audit) rather than touching it unilaterally. Otherwise consider the core round of fixes from this pass complete (tab-highlight bug, two duplicate-Claude-call job guards, redundant projectAll computation, doSync week-capture race, all with regression tests and all suites green) -- a good point to run ship.sh and publish a release, then ask Tj if he wants a deeper pass on any specific area (UI polish, more efficiency work) or considers this done for now.

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
  4b82a38 ckpt 66: Broader code/UI review pass (Tj's same 2026-09-18 message): delegated a researc
  58affc7 ckpt 57: Fixed the real waiver-wire tab-highlight bug: boot() restores view from lastTab
  a68ed9a ckpt 78: Shipped v7.4: QB waiver-swap threshold fix (QB_MIN_GAIN=6, QB_MIN_MEASURED=3, s
  6a50a4e ship v7.4: waiver-wire QB season-edge fix (Stafford/Bo Nix no longer swapped for a margi
  87ff104 ckpt 69: 1f/tests done: web research confirmed the QB-skepticism direction (footballguys
  f8e561f ckpt 67: 1b/1c/1e done: QB waiver swaps now need a season-defining edge (6+ pts/gm, 3+ r
  db1b963 ckpt 53: Wrote the 2026-09-18 request into TASKS.md verbatim (waiver-wire QB/RB-WR smart
  23dc5d1 ckpt 123: v7.3 shipped and verified: GitHub Release published (non-empty assets array, F
  f49cf4c ship v7.3: Fixed a bug in all three Claude-handoff features (advice/waivers/team-analysi
  8ba6db4 ckpt 119: Archived the unfilled-template bugfix to LADDER.md §40, added the STATE.md na
```

(20 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
