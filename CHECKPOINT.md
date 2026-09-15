# CHECKPOINT 252 — read me first, then TASKS.md

**Written:** 2026-09-15T07:58:08Z · **version:** 6.3 · **tests:** all 14 suites green

## Just done
Sweep round 1 (data integrity, highest stakes): fixed two real bugs found by the 6 background review agents. (1) NativeBridge.java's load() only fell back to .bak when the main file was missing/empty -- a readable-but-CORRUPTED file (truncated write, bit-rot) was returned as-is, and store.js's JSON.parse failure then silently reset a whole season to the bundled seed instead of using the intact .bak. Fixed with a real JSON-parseability check before accepting the main file. (2) store.js's getStats() dirtied the archive (the ~1.9MB book+stats file the whole point of the archive split is to avoid writing on every trivial save) on a mere READ -- just opening the Live tab for an unsynced week (common right after boot) silently flagged the next unrelated lineup edit to trigger the full archive write instead of the cheap ~25KB main-file write. Fixed by removing the stray markArchive() call from the lazy-bucket-creation path; verified every real writer (setLine, setBook) already calls markArchive() independently, so no real dirty-tracking was lost. Both verified: the getStats fix has a real executable test (instruments Native.save and counts archive writes before/after a read vs a real write); the Java fix is pinned as source text (no JUnit exists in this hand-rolled build) backed by a real bash build.sh compile. All 13 suites + ES2018 gate green.

## Do this next
6 background review agents (data/scoring core, network/sync, AI integration, UI part 1, UI part 2, Android shell) have all reported back with a large body of additional verified findings. Continue triaging in priority order: next is the value.js correctness bugs (perGame/usage bypassing the tolerant Names.hit lookup -- degrades Wire-board accuracy; needs() hardcoding FLEX to RB replacement level -- feeds wrong data to Claude's waiver prioritization), then UI/feature correctness bugs (Advice tab missing long-press entirely, claudeAdviceEstimate showing cost for a free sync, stats.js team-picker week-desync repeat of an already-fixed bug class, showPlayer's stale-modal-after-save), then Android hardening (alertsTest() synchronous network call freezing the JS thread, 6 file-descriptor leaks, NativeBridge pool never shut down, dead legacy HTTP methods as attack surface), then cost/model accuracy (usage.js model-blind pricing, prompt caching under the model floor, outdated web_search tool type), then a batch of smaller verified fixes, then flag (do not implement unasked) the Data tab's undifferentiated-card-wall UI issue and the fully-dead recap.js feature for Tj's decision.

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
  ae43731 ckpt 236: UI sweep finding #2 (Stats tab): the Pts column was the LAST column in the gam
  24a73a3 ckpt 230: UI sweep finding #1 (Live tab): player names were truncating mid-word in the t
  1827e5c ckpt 226: Wrote Tj's comprehensive app-wide improvement request to TASKS.md (2026-09-15e
  882ace6 ckpt 223: Shipped v6.3, triggered and verified the GitHub Release (non-empty asset, corr
  f21a19e ship v6.3: Real back-button fix: registered the platform OnBackInvokedCallback (API 33+)
  b518033 ckpt 218: Fixed the real back-button regression: registered android.window.OnBackInvoked
  ab24515 ckpt 208: Wrote Tj's real-device bug report to TASKS.md (2026-09-15d): back button still
  50c304f ckpt 205: Archived the finished 2026-09-15c job to LADDER.md §30, reset TASKS.md to 'no
  82284ab ship v6.2: Rosters reorder, Android back-button/app-resume/splash-flash fixes, live Clau
  d30a945 ckpt 198: Item 8 (full sweep) complete: live-browser walkthrough of all 7 tabs found no 
```

(15 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
