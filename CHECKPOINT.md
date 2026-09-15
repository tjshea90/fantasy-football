# CHECKPOINT 162 — read me first, then TASKS.md

**Written:** 2026-09-15T03:48:28Z · **version:** 6.1 · **tests:** all 14 suites green

## Just done
item 5 done: removed every 'how much Claude usage I have left' display and replaced it with live cost ESTIMATES computed from real current inputs, not a guess. Extracted the search-budget formulas that were inline in ai.js's ask()/askWaivers() into named exported functions (adviceSearchBudget, waiverSearchBudget) so the on-screen estimate and the real call can never disagree about how many searches a call would use -- one implementation, not two that could drift. Added Usage.estimate(promptChars, searches, outputTokens), priced off the same editable rates() table real spend already used; searches dominate the bill per the code's own existing comment, so the fuzzier output-token guess costs little accuracy. Wired it into both real Ask-Claude buttons: recommend.js's claudeAdviceEstimate (Advice tab, uses the real triage player count via rosterContext + Ai.buildPrompt's real length) and ui.js's claudeWireEstimate (Wire tab, Value.waiverContext + Ai.buildWaiverPrompt), both shown regardless of whether a key is configured since the whole point is Tj can see this without one. Gutted ui.js's usageCard (Data tab): removed the budget input, the meter, 'X left of Y', '% used' and 'N more syncs' entirely; renamed 'Claude spend' to 'Claude costs' and made the live per-action estimate the headline, kept the editable price-rate fields (still needed for the math) and the factual historical call log as a record, not a claim about what remains. Cleaned up the now-dead budget/remaining/pct/syncsLeft fields from Usage.totals() and the unused aiBudget setting from store.js's defaults, and updated the two test_engine.js assertions that covered the removed behavior to test estimate() instead (still 100% real assertions, not deleted coverage). Verified live in a real browser: Wire tab shows 'Estimated cost: $0.042... (Data -> Claude costs)' right under the button even with no key configured; Advice tab shows 'Estimated cost to sync: $0.104...' in the sync-status card; the Data tab's new Claude costs card shows both figures together plus the editable rates. All 14 suites + ES2018 gate green throughout.

## Do this next
item 6: bench 'why not to start him' Claude explanations on the Advice tab, mirroring the existing starter 'why' explanations -- need to find where the recommended-starter reasoning is currently rendered (aiCache/row.ai.reason per the showPlayerPreGame code in ui.js) and extend the same data path to cover benched players too, not build a second Claude integration.

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
  46f5b26 ckpt 143: items 1-4 of today's 8-part request. (1) Rosters tab: trade evaluator moved to
  c55702b ckpt 135: wrote Tj's new 8-part request (bug/UI sweep, Rosters reorder, Android back-but
  1de4930 ckpt 132: shipped v6.1 (both bug fixes), triggered and verified the GitHub Release (non-
  b98c220 ship v6.1: fix two bugs found on Tj's phone within minutes of v6.0: Top Players got stuc
  16c61b7 ckpt 127: fixed two real bugs Tj found on his phone within minutes of v6.0, both confirm
  dc92ac5 ckpt 120: shipped v6.0 (Stats tab + resume-system fix), triggered and verified the GitHu
  be33e59 ship v6.0: add a Stats tab: search any current NFL player (or team defense) and see this
  d0cfa77 ckpt 111: real-browser validation of the Stats tab + long-press, end to end, with REAL l
  1f64c89 ckpt 104: steps 2+4 of the stats-tab job: built stats.js (Stats.render(root,ctx), mirror
  11bddd6 ckpt 73: fixed the red left over from the last checkpoint: test_lifecycle.js keeps its o
```

(18 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
