# CHECKPOINT 353 — read me first, then TASKS.md

**Written:** 2026-09-15T15:18:29Z · **version:** 6.3 · **tests:** all 14 suites green

## Just done
Small-fixes batch, part 2 of 2 continued (2026-09-15e sweep). (9) handoff.js: detect() used loose prefix matching (k.indexOf(KIND_ADVICE) === 0) to classify a pasted Claude reply's kind, which would silently accept any string merely STARTING WITH the real kind -- a plausible model typo or hallucinated variant -- directly contradicting the function's own comment ('must never be half-applied'). Tightened to exact-match the two real literal kinds this app ever emits (the request echo, and the reply skeleton's kind+'.reply'); same fix mirrored for waivers. (10) The Advice and Wire tabs' cost-estimate lines ended with different wording for no reason ('— Data → Claude costs' vs 'at current prices (Data → Claude costs).') -- matched. (11) gamelog.js's ensureEvent and ui.js's doSync's gcache independently called Espn.gameStats for the SAME game whenever Tj synced a week and then browsed that week's game log (or vice versa) -- an avoidable duplicate network fetch. Pulled ensureEvent's cache-write logic out into a new exported ingestEvent(week, game, r), which ensureEvent now calls internally, and wired doSync to feed its own already-fetched box score into it too (same established pattern as Schedule.ingest in liveTick, applied to box scores) -- gcache (ui.js's own in-memory, session-only, rostered-players-only cache) and gamelog's persistent any-player cache still don't share a data structure, they just no longer duplicate the fetch. Proven end-to-end in tools/test_gamelog.js: ingestEvent makes zero gameStats calls of its own, and a later teamWeek() read reuses exactly what it wrote. All three covered by new tests (test_handoff.js real detect() calls, test_gamelog.js real ingestEvent proof, test_boot.js source-text pins for the wiring and copy). Verified via bash build.sh (28 classes, signature OK) and all 14 suites + ES2018 gate green (0 failures).

## Do this next
Finish the small-fixes batch: recommend.js's opponentsForWeek hardcoding seasontype=2 instead of the week>18?3:2 pattern used everywhere else (currently inert since this league's LAST_WEEK caps below 18, but inconsistent and a latent bug if that ever changes) -- verify against real source first; value.js's _faMemo invalidation being incidental rather than designed (no explicit Value.invalidate() unlike Sim.invalidate()'s ~14 call sites) plus its minor nitpicks (rosteredSet's extra canon() call, projections.js's vestigial .fullName, the redundant gabe davis/gabriel davis alias pair) -- verify each is real before touching, this sweep already found two review-agent claims that were wrong on inspection. Then flag for Tj WITHOUT implementing (per 'no major changes unless approved'): the Data tab's 13-14-card wall with no sub-navigation, and the fully-dead recap.js feature (Recap.build/Recap.text and everything downstream -- ai.js's recap(), NativeBridge.java's share()/copy() -- never called anywhere in the shipped app; needs Tj's decision: wire it up or remove it). Finally update TASKS.md/STATE.md/LADDER.md for the whole sweep (Rounds 1-5 plus this entire small-fixes batch), run final full test+build, and ship as a new version if changes are ship-worthy (trigger+verify GitHub Release, send Tj the plain tappable link).

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
  cf63635 ckpt 336: Small-fixes batch, part 1 of 2 (2026-09-15e sweep). (1) ui.js: pull-to-refresh
  f2a8ef5 ckpt 321: Round 5 (cost/model accuracy) complete. (1) usage.js's cost tracking was model
  17a02e8 ckpt 299: Round 4 (Android hardening) finished. (a) NativeBridge's pool is stored as a f
  b14b738 ckpt 291: Round 4 (Android hardening) complete: fixed alertsTest()'s synchronous up-to-1
  8337f3a ckpt 281: Sweep round 3 (UI/feature correctness): fixed four real bugs. (1) claudeAdvice
  669bdca ckpt 264: Sweep round 2 (value.js correctness): fixed two real bugs. (1) Store.bookTrend
  94534c3 ckpt 252: Sweep round 1 (data integrity, highest stakes): fixed two real bugs found by t
  ae43731 ckpt 236: UI sweep finding #2 (Stats tab): the Pts column was the LAST column in the gam
  24a73a3 ckpt 230: UI sweep finding #1 (Live tab): player names were truncating mid-word in the t
  1827e5c ckpt 226: Wrote Tj's comprehensive app-wide improvement request to TASKS.md (2026-09-15e
```

(16 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
