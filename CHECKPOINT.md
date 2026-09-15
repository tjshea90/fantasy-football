# CHECKPOINT 299 — read me first, then TASKS.md

**Written:** 2026-09-15T08:26:58Z · **version:** 6.3 · **tests:** all 14 suites green

## Just done
Round 4 (Android hardening) finished. (a) NativeBridge's pool is stored as a field on MainActivity and shut down explicitly in onDestroy() via a new NativeBridge.shutdown() (pool.shutdownNow()) -- the pool's 3 threads are plain non-daemon threads that held a reference to the WebView being torn down, and would otherwise have kept the process alive past the Activity. (b) Investigated the legacy httpGet/httpGetH/httpPost JS-interface methods flagged as 'dead code' -- found they are NOT actually dead: tools/test_engine.js deliberately exercises this exact synchronous fallback path via a Native mock with no httpAsync, and tools/test_boot.js already pins their existence by name ('the Java bridge exposes POST' / 'can send headers'). This is documented, tested legacy-shell compatibility scaffolding, not leftover cruft -- removing it would break intentional test coverage for no real gain, so left alone. (c) Verified the back-button OnBackInvokedCallback registration-failure fallback claim against Android's own predictive-back docs (WebFetch on developer.android.com): the old comment ('onKeyDown is still there') was false -- once enableOnBackInvokedCallback=true is set (unconditional in this manifest), KEYCODE_BACK interception is not supported at all, registration success or not. Corrected the comment to be honest about the real (currently unreproduced, undocumented-as-ever-throwing) risk and added Log.e so a real-device failure would be diagnosable instead of silently swallowed. All fixes covered by new source-text regression pins in test_boot.js. Verified via bash build.sh (28 classes, signature OK) and all 14 suites + ES2018 gate green (0 failures).

## Do this next
Round 4 is complete. Start Round 5: usage.js's model-blind cost tracking (thread model into priceOf/estimate, look up per-model rates instead of one hardcoded rate); prompt caching never engaging because both cached prefixes are under the relevant model's cache floor (verified via the claude-api skill this session -- pad the prefix past the floor, or explicitly document why not worth it); outdated web_search_20250305 tool type at both ai.js call sites, upgrade to web_search_20260209 (confirmed current via the claude-api skill). Then a batch of ~10 smaller verified fixes (full list preserved in prior checkpoint's 'what comes next' and TASKS.md): ui.js long-press click-suppression window unscoped to originating element, pull-to-refresh double-render on 5 tabs, freshenInjuries missing .catch, stale earlyGameCard comment, shadowed view var in openPlayerStatsMenu, Alerts.java dead schedule() method, empty-me-string edge case, backupLoad path-traversal-lite, handoff.js KIND_ADVICE prefix looseness, Wire/Advice cost-line copy inconsistency, gamelog.js/ui.js duplicate gcache, recommend.js opponentsForWeek hardcoded seasontype, value.js _faMemo invalidation nitpicks. Then flag for Tj WITHOUT implementing (per 'no major changes unless approved'): the Data tab's 13-14-card wall with no sub-navigation, and the fully-dead recap.js feature (never called anywhere -- needs Tj's decision: wire it up or remove it). Finally update TASKS.md/STATE.md/LADDER.md for the whole sweep, run final full test+build, and ship as a new version if changes are ship-worthy (trigger+verify GitHub Release, send Tj the plain tappable link).

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
  b14b738 ckpt 291: Round 4 (Android hardening) complete: fixed alertsTest()'s synchronous up-to-1
  8337f3a ckpt 281: Sweep round 3 (UI/feature correctness): fixed four real bugs. (1) claudeAdvice
  669bdca ckpt 264: Sweep round 2 (value.js correctness): fixed two real bugs. (1) Store.bookTrend
  94534c3 ckpt 252: Sweep round 1 (data integrity, highest stakes): fixed two real bugs found by t
  ae43731 ckpt 236: UI sweep finding #2 (Stats tab): the Pts column was the LAST column in the gam
  24a73a3 ckpt 230: UI sweep finding #1 (Live tab): player names were truncating mid-word in the t
  1827e5c ckpt 226: Wrote Tj's comprehensive app-wide improvement request to TASKS.md (2026-09-15e
  882ace6 ckpt 223: Shipped v6.3, triggered and verified the GitHub Release (non-empty asset, corr
  f21a19e ship v6.3: Real back-button fix: registered the platform OnBackInvokedCallback (API 33+)
  b518033 ckpt 218: Fixed the real back-button regression: registered android.window.OnBackInvoked
```

(7 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
