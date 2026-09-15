# CHECKPOINT 361 — read me first, then TASKS.md

**Written:** 2026-09-15T15:23:03Z · **version:** 6.3 · **tests:** all 14 suites green

## Just done
Small-fixes batch complete (2026-09-15e sweep), final items. (12) recommend.js: opponentsForWeek hardcoded seasontype=2 where every other weekGames call site in the app uses week>18?3:2 -- currently inert (LAST_WEEK=17, so week never actually exceeds 18 through any real path) but a latent trap if that cap is ever raised for a playoff bracket; matched for consistency. (13a) value.js: rosteredSet() wrote out[canon(pl.name)] a second time after a loop that already wrote it -- confirmed variants() always includes canon() as its own first element (names.js's variants(): add(c) runs before anything else), so this was a genuine no-op; removed. (13b) projections.js: the Sleeper-merge fallback read got.byName[k].fullName || k, but ingestSleeper's own records are always {pos, week, weekLine, src} -- traced by hand, .fullName is undefined on every real call, so the fallback fired unconditionally; simplified to just k. (13c) names.js: the curated ALIAS_PAIRS entry ['gabe davis','gabriel davis'] was fully redundant -- traced canon() and variants() by hand and confirmed the generic gabriel:['gabe'] NICK entry already folds/expands both directions on its own with zero dependence on the curated pair (unlike every other entry in that list, which IS a real alias no generic rule derives); removed, with a regression test proving the fold still works via the generic path. (13d) Investigated the _faMemo 'incidental invalidation' concern from the original review and found it is NOT a bug: freeAgents()'s memo key includes Store.generation(), which store.js's save() bumps UNCONDITIONALLY on every save (confirmed: addPlayer/removePlayer/trade all end in save()) -- this is actually MORE robust than Sim.invalidate()'s ~14 explicit call sites, since it can never be missed by a future mutation path the way an explicit call site can. Verified recommend.js's _adviceEstMemo and ui.js's _wireEstMemo use the identical generation-keyed pattern, confirming this is a deliberate, consistent, already-correct app-wide design -- no change made. This closes out the entire small-fixes batch (13 items total: 8 in part 1, 3 in part 2, these final 4 sub-items). All covered by new tests where a real fix was made (test_names.js's Gabe/Gabriel regression, test_boot.js source-text pins). Verified via bash build.sh (28 classes, signature OK) and all 14 suites + ES2018 gate green (0 failures).

## Do this next
The entire fix-and-improve phase of the 2026-09-15e comprehensive sweep is done: Rounds 1-5 plus the full small-fixes batch, all tested, all checkpointed. Remaining steps per the original task plan: (1) flag for Tj WITHOUT implementing -- the Data tab's 13-14-card wall with no sub-navigation (UI review agent's finding, too big to do unasked), and the fully-dead recap.js feature (Recap.build/Recap.text and everything downstream -- ai.js's recap(), NativeBridge.java's share()/copy() -- confirmed never called anywhere in the shipped app; needs Tj's decision: wire it up or remove it); (2) update TASKS.md (tick/annotate the 2026-09-15e job's 5 steps with proof), write a STATE.md entry summarizing the whole sweep (all 5 rounds plus the batch, with a short list of every real bug fixed), archive to LADDER.md; (3) run the final full test suite + ES2018 gate + bash build.sh one more time as the release gate; (4) ship as a new version via bash ship.sh if the accumulated changes are ship-worthy (they are -- multiple real data-integrity, correctness, security-hardening and cost-accuracy fixes since the last ship at v6.3), then trigger+verify the GitHub Release per CLAUDE.md's standing rule (mcp__github__actions_run_trigger on publish-release.yml, poll until success, send Tj the plain tappable link -- never a code block).

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
  895701a ckpt 353: Small-fixes batch, part 2 of 2 continued (2026-09-15e sweep). (9) handoff.js: 
  cf63635 ckpt 336: Small-fixes batch, part 1 of 2 (2026-09-15e sweep). (1) ui.js: pull-to-refresh
  f2a8ef5 ckpt 321: Round 5 (cost/model accuracy) complete. (1) usage.js's cost tracking was model
  17a02e8 ckpt 299: Round 4 (Android hardening) finished. (a) NativeBridge's pool is stored as a f
  b14b738 ckpt 291: Round 4 (Android hardening) complete: fixed alertsTest()'s synchronous up-to-1
  8337f3a ckpt 281: Sweep round 3 (UI/feature correctness): fixed four real bugs. (1) claudeAdvice
  669bdca ckpt 264: Sweep round 2 (value.js correctness): fixed two real bugs. (1) Store.bookTrend
  94534c3 ckpt 252: Sweep round 1 (data integrity, highest stakes): fixed two real bugs found by t
  ae43731 ckpt 236: UI sweep finding #2 (Stats tab): the Pts column was the LAST column in the gam
  24a73a3 ckpt 230: UI sweep finding #1 (Live tab): player names were truncating mid-word in the t
```

(7 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
