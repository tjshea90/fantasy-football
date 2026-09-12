# TASKS — the 2026-09-12c request (Data tab bug + score-entry redesign), in
Tj's words

> "Review the screenshot attached. There are errors circled. This is in the
> data tab. Get rid of the large circled section with blank fields and make a
> simple section where I can type in the weekly points for every team. For
> example, it will say Ron then have a box for me to type Ron's points for
> that week. When all the teams points are entered, it will save the data and
> use the points to calculate wins losses and total points for the week and
> season in the other sections of the app"

His screenshot showed the Data tab with two things circled: the sync-status
line reading "in progress · [object Object] games · updated 14:19..." and the
weekly-scores card added in the branch-reconciliation job (LADDER.md §20d).

- [x] 1. Root-cause and fix the `[object Object]` in the sync-status text
      (`renderHeader`/`viewData` in ui.js, both read `weekMeta[week].games`
      expecting a number). Found already, before writing this: a genuine
      field-name collision, not new to this session — `schedule.js`'s
      `ingest()` writes a per-NFL-team kickoff map into that SAME
      `weekMeta[week].games` key (`m.games = byTeam`), and `store.js`'s
      `gameStarted()` reads it back as that map. `doSync` (ui.js) writes a
      plain integer count into the identical key. Whichever ran more
      recently wins; the live poll calls `Schedule.ingest` far more often
      than a manual sync runs, so the count gets clobbered into an object
      almost immediately. Alerts.java ALSO reads this exact key
      (`optJSONObject("games")`) from the persisted state file natively, so
      the fix is a rename to a non-colliding key
      (`kickoffs`) across schedule.js, store.js, Alerts.java, and the tests
      that construct a weekMeta fixture with the old shape
      (test_locks.js, test_schedule.js) — not a workaround at the display
      site, which would leave `gameStarted`/Alerts silently reading garbage
      whenever a sync ran after a schedule ingest. DONE exactly as planned.
      Tested: new `test_schedule.js` test that actually calls the real
      `Schedule.ingest()` after a sync-shaped count is on the same object
      and proves the count survives — not a source grep. Full suite green,
      real `build.sh` run twice (Alerts.java's rename compiles) (ckpt 138,
      142).
- [x] 2. Rebuild `weeklyScoresCard` (ui.js, Data tab) to match Tj's exact
      spec: drop the explanatory paragraph (that's the "large" he means),
      keep exactly one row per team (all but his own) — team name as a
      plain label, one input box next to it, nothing else. Saving (on
      change) and driving wins/losses/points is already correct
      (Store.setManualScore -> teamWeekScore -> seasonTotals/standings, from
      the branch-reconciliation job) — this is a display/layout simplification
      only, not a data-layer change, unless testing this turns up a real
      reason the fields "look blank" (e.g. drop the placeholder preview text
      if that's what reads as "blank"). DONE — also dropped the placeholder
      preview text, since a faint auto-computed number in an otherwise-empty
      box was itself part of what made it read as "blank". Tested: full
      suite green, `test_lifecycle.js`'s every-screen-renders walk exercises
      the simplified card (ckpt 142). Shipped as v5.3 (versionCode 503).

Ticking a box means: written, tested, committed, and the test that proves it is
named in the box. **Never tick a box you have not verified** — the next account
will not re-check it.

## Waiting on Tj

- [ ] Confirm the fixed Data tab looks right and the sync-status line shows a
      real game count again.
- [ ] Confirm v5.2 (or later) installs cleanly and try the rest of the
      reconciled features end to end.
- [ ] **Decide on repo cleanup, deferred twice now**: fast-forward `main` to
      this branch? Delete the 3 stale sibling branches
      (`android-app-nav-ui-refactor-os6q53`, `resume-logic-claude-code-
      2ye25r`, `live-tab-dual-scores-h2nxyf`)?
- [ ] Verify v4.7-era item: **Data > Test the projection feed** (a QB should
      land near 40-55 under this scoring; 15-25 means the re-scoring is not
      running), and **Data > Test the key** if he wants Claude's reads.
