# CHECKPOINT 321 — read me first, then TASKS.md

**Written:** 2026-09-15T08:35:34Z · **version:** 6.3 · **tests:** all 14 suites green

## Just done
Round 5 (cost/model accuracy) complete. (1) usage.js's cost tracking was model-blind: one flat Sonnet-5-shaped rate table applied to every call regardless of which model ran it, but ai.js picks per-call models (depth()==='cheap' sends Haiku 4.5; 'weekly recap' ALWAYS uses the cheap model) -- so every recap was overstated ~2x and any Opus call would have been understated ~5x. Fixed: priceOf/record/estimate/totals/rates all now take an optional model and look up its real tier (RATE_TIERS: opus/sonnet/haiku, classified by substring so a future dot-release does not need a code change); a manual settings override still wins, per-field, same as before. Threaded the correct depth()-resolved model into both on-screen estimates (recommend.js claudeAdviceEstimate, ui.js claudeWireEstimate) and the settings price-editor panel (usageCard), which used to silently show/edit Sonnet numbers even when a 'cheap'-depth call would really run on Haiku -- also fixed the editor's own hint text, which used to tell Tj to manually update rates when he switches models; that is no longer his job. (2) Verified the outdated web_search_20250305 tool type: added searchToolType(model), an ALLOWLIST (not denylist) that gives Sonnet 5 and Opus 5 the current web_search_20260209 (dynamic filtering, confirmed via the claude-api skill) and leaves everything else -- Haiku 4.5 included, since depth()==='cheap' sends real calls there and the newer type is not documented as supported on it -- on the safe old type. Wired into both real tool-use call sites (ask, askWaivers). (3) Investigated prompt caching: measured (not assumed) staticPrefix() at ~900 tokens and waiverPrefix() at ~1834 -- against this session's verified cache floors (Sonnet 5: 1024, Opus 5: 512, Haiku 4.5: 4096), the waiver prefix already clears Sonnet's floor and gets real caching; the advice prefix falls short by ~130 tokens and silently never caches at the default depth. Deliberately NOT padded: the only honest way to close that gap is more real prompt content, which changes what Claude is told on every future sync -- unverifiable against the real API in this environment (no key configured here) and exactly the kind of product-behavior change the 'no major changes unless approved' boundary is for, especially against a small, rarely-realized saving (infrequent syncs, 5-minute cache TTL). Documented in place instead of fixed silently or left unmentioned. All three items covered by new tests: tools/test_integration.js §23 (real Usage.priceOf/record calls proving three distinct tier prices plus a real ledger comparison, and searchToolType's four cases) plus test_boot.js source-text pins; fixed one pre-existing test (test_boot.js's old priceOf-signature pin, correctly superseded) and one test-hygiene bug this work surfaced (test_integration.js §18 was resetting rate overrides to sonnet-shaped NUMBERS instead of clearing them, which pinned every later test to Sonnet pricing regardless of model -- now deletes them). All 14 suites + ES2018 gate green (0 failures), bash build.sh compiles cleanly (28 classes, signature OK).

## Do this next
Round 5 is complete. Start the batch of ~10 smaller verified fixes: ui.js long-press click-suppression window unscoped to originating element; ui.js pull-to-refresh double-render on 5 tabs (refresh()'s default branch double-wraps doSync()'s own already-render()-calling promise); ui.js freshenInjuries missing .catch; ui.js stale earlyGameCard comment (says Live/Lineups/Advice, actually only Lineups/Advice); ui.js shadowed view variable in openPlayerStatsMenu; Alerts.java dead schedule() method; Alerts.java narrow empty-me-string edge case guard; NativeBridge.java backupLoad('..') path-traversal-lite; handoff.js detect()'s KIND_ADVICE vs KIND_ADVICE+'.reply' prefix-matching looseness; minor Wire/Advice cost-line copy-wording inconsistency; gamelog.js ensureEvent and ui.js doSync's gcache being two independent non-communicating caches for the same Espn.gameStats data; recommend.js opponentsForWeek hardcoding seasontype=2 instead of the week>18?3:2 pattern used everywhere else (currently inert but inconsistent); value.js _faMemo invalidation being incidental rather than designed; value.js minor redundant-computation/vestigial-reference nitpicks (rosteredSet's extra canon() call, projections.js's vestigial .fullName, the redundant gabe davis/gabriel davis alias pair). Verify each against real source before touching it -- this session already found two 'confirmed dead code' claims from an earlier pass that turned out to be wrong (the legacy httpGet/httpGetH/httpPost methods are tested and used by design, not dead) so re-check rather than trust the original review agents' claims at face value. Then flag for Tj WITHOUT implementing (per 'no major changes unless approved'): the Data tab's 13-14-card wall with no sub-navigation, and the fully-dead recap.js feature (Recap.build/Recap.text and everything downstream -- ai.js's recap(), NativeBridge.java's share()/copy() -- never called anywhere in the shipped app; needs Tj's decision: wire it up or remove it). Finally update TASKS.md/STATE.md/LADDER.md for the whole sweep, run final full test+build, and ship as a new version if changes are ship-worthy (trigger+verify GitHub Release, send Tj the plain tappable link).

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
  17a02e8 ckpt 299: Round 4 (Android hardening) finished. (a) NativeBridge's pool is stored as a f
  b14b738 ckpt 291: Round 4 (Android hardening) complete: fixed alertsTest()'s synchronous up-to-1
  8337f3a ckpt 281: Sweep round 3 (UI/feature correctness): fixed four real bugs. (1) claudeAdvice
  669bdca ckpt 264: Sweep round 2 (value.js correctness): fixed two real bugs. (1) Store.bookTrend
  94534c3 ckpt 252: Sweep round 1 (data integrity, highest stakes): fixed two real bugs found by t
  ae43731 ckpt 236: UI sweep finding #2 (Stats tab): the Pts column was the LAST column in the gam
  24a73a3 ckpt 230: UI sweep finding #1 (Live tab): player names were truncating mid-word in the t
  1827e5c ckpt 226: Wrote Tj's comprehensive app-wide improvement request to TASKS.md (2026-09-15e
  882ace6 ckpt 223: Shipped v6.3, triggered and verified the GitHub Release (non-empty asset, corr
  f21a19e ship v6.3: Real back-button fix: registered the platform OnBackInvokedCallback (API 33+)
```

(21 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
