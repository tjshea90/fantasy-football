# CHECKPOINT 291 — read me first, then TASKS.md

**Written:** 2026-09-15T08:22:14Z · **version:** 6.3 · **tests:** all 14 suites green

## Just done
Round 4 (Android hardening) complete: fixed alertsTest()'s synchronous up-to-13s network call on the JS-interface thread (converted to the established async pool/evaluateJavascript pattern), and all 6 file-descriptor leaks across NativeBridge.java and Alerts.java (try-with-resources -- save() runs on effectively every app-state write, so this was a real accumulating leak under a sustained low-storage condition, not theoretical). Added source-text regression pins in test_boot.js for all 6 FD-leak fixes plus the alertsTest async fix. Verified via bash build.sh compiling cleanly (28 classes, signature OK) and all 13 suites + ES2018 gate green (0 failures).

## Do this next
Continue Round 4: (a) NativeBridge's ExecutorService pool is never shut down and the bridge instance isn't stored as a field -- add a shutdown() method wired to MainActivity.onDestroy(); (b) remove or gate the dead legacy httpGet/httpGetH/httpPost JS-interface methods (confirmed unreachable from shipped app JS); (c) verify/harden the back-button OnBackInvokedCallback registration-failure fallback claim now that enableOnBackInvokedCallback=true is unconditional in the manifest. Then Round 5: usage.js's model-blind cost tracking (thread model into priceOf/estimate), prompt caching never engaging (both cached prefixes under the model's cache floor -- pad or document), outdated web_search_20250305 tool type (upgrade to web_search_20260209 at both ai.js call sites, verified current via claude-api skill). Then a batch of ~10 smaller verified fixes (full list in TASKS.md / conversation history: long-press click-suppression window, pull-to-refresh double-render on 5 tabs, freshenInjuries missing .catch, stale earlyGameCard comment, shadowed view var in openPlayerStatsMenu, Alerts.java dead schedule() method, empty-me-string edge case, backupLoad path-traversal-lite, handoff.js KIND_ADVICE prefix looseness, Wire/Advice cost-line copy inconsistency, gamelog.js/ui.js duplicate gcache, recommend.js opponentsForWeek hardcoded seasontype, value.js _faMemo invalidation nitpicks). Then flag for Tj WITHOUT implementing (per 'no major changes unless approved'): the Data tab's 13-14-card wall with no sub-navigation, and the fully-dead recap.js feature (never called anywhere -- needs Tj's decision: wire it up or remove it). Finally: update TASKS.md/STATE.md/LADDER.md for the whole sweep, run final full test+build, and ship as a new version per the task's own step 5 if changes are ship-worthy (trigger+verify GitHub Release, send Tj the plain tappable link).

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
  8337f3a ckpt 281: Sweep round 3 (UI/feature correctness): fixed four real bugs. (1) claudeAdvice
  669bdca ckpt 264: Sweep round 2 (value.js correctness): fixed two real bugs. (1) Store.bookTrend
  94534c3 ckpt 252: Sweep round 1 (data integrity, highest stakes): fixed two real bugs found by t
  ae43731 ckpt 236: UI sweep finding #2 (Stats tab): the Pts column was the LAST column in the gam
  24a73a3 ckpt 230: UI sweep finding #1 (Live tab): player names were truncating mid-word in the t
  1827e5c ckpt 226: Wrote Tj's comprehensive app-wide improvement request to TASKS.md (2026-09-15e
  882ace6 ckpt 223: Shipped v6.3, triggered and verified the GitHub Release (non-empty asset, corr
  f21a19e ship v6.3: Real back-button fix: registered the platform OnBackInvokedCallback (API 33+)
  b518033 ckpt 218: Fixed the real back-button regression: registered android.window.OnBackInvoked
  ab24515 ckpt 208: Wrote Tj's real-device bug report to TASKS.md (2026-09-15d): back button still
```

(9 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
