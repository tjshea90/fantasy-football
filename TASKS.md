# TASKS — the 2026-09-12b request (branch reconciliation), in Tj's words

**Context, not from Tj but load-bearing for this job:** this session discovered
that the "one branch, cross-account handoff" model in this file's own working
agreement has been silently broken — Claude Code on the web puts every session
on its OWN throwaway branch, and none of the last several sessions merged back
to `main`. Four branches forked from the same v4.7 point and shipped
independently: this one (`claude/fantasy-app-nav-ui-1i09vx`), a twin that did
the identical nav-refactor request a day earlier (`android-app-nav-ui-refactor-
os6q53`, v4.8), and two more that added a manual-score-entry feature instead
(`resume-logic-claude-code-2ye25r` v4.8, then `live-tab-dual-scores-h2nxyf`
v5.0 — the one actually on Tj's phone). Tj was told this plainly and asked how
to proceed.

> "Find out what the other branches did and merge it all into one app with the
> features and findings and fixes from all the branches."

(Asked as a follow-up to an earlier answer, "Drop it," about the manual
score-entry feature specifically — dropping the now-deleted Table tab that
carried it. "Merge it all" reopens that: the feature is being ported back in,
just relocated off the Table tab since Table stays deleted.)

- [x] 1. Port the more robust Android back-button handling from
      `android-app-nav-ui-refactor-os6q53`'s `MainActivity.java`: my version
      falls through to `super.onKeyDown()` (i.e. default `finish()`) when
      `web` is null, the page isn't ready yet, or the bridge call itself
      throws — three narrow windows where "never closes the app" doesn't
      actually hold. Their version backgrounds (`moveTaskToBack`) in all
      three cases instead. DONE, verified `node tools/test_gestures.js`
      still green (checks MainActivity no longer calls finish()) + full
      suite (ckpt 96).
- [x] 2. Port the `.claude/scheduled_tasks.lock` false-positive fix in
      `bootstrap.sh` from the same branch (harness runtime file wrongly
      flagged as a stray file on disk). DONE, verified `bash bootstrap.sh`
      runs clean to completion (ckpt 96).
- [x] 3. Port the manual weekly-score data layer from `resume-logic-claude-
      code-2ye25r` / `live-tab-dual-scores-h2nxyf`: `Store.manualScores`,
      `getManualScore`/`setManualScore`/`teamWeekScore`, and route
      `seasonTotals` through `teamWeekScore` so a hand-entered score drives
      standings/W-L. (Explicitly keeping `Store.standings`/`seasonTotals`/
      sim.js/recap.js alive to support this — rejecting the OTHER nav-refactor
      twin's choice to delete them as dead code, since they are not dead once
      this feature exists.) DONE — also found and fixed a real bug neither
      source branch had: `importJSON` never defaulted `manualScores` on a
      restored old backup the way it does every other field, so a restore
      left it `undefined` and the next call threw. Tested:
      `node tools/test_integration.js` #14, a real executed test (imports a
      manualScores-stripped backup, calls setManualScore, asserts no throw)
      rather than a source-text grep. Full suite green (ckpt 104).
- [x] 4. Add the score-entry UI (`weeklyScoresCard`, verbatim logic from the
      v5.0 branch: one row per team but mine, typed final score or blank to
      fall back to the computed lineup total) plus a compact standings table
      so entering a score has somewhere to show its result — both relocated
      to the **Data tab**, since the Table tab that used to host them is
      deleted per the 2026-09-12 request. DONE, plus the `.scoreInput` CSS.
      Tested: full suite green, `test_lifecycle.js`'s every-screen-renders
      walk exercises both new cards on Data (ckpt 108).
- [x] 5. Port the Live-tab redesign from `live-tab-dual-scores-h2nxyf`: two
      side-by-side score boxes (`liveScoreBox`, one per side, each with its
      own open lineup) instead of one merged card — matches Tj's own words to
      that session ("my team roster and points on one side... my opponent's
      points on the other... nothing else should be in the live tab"). Move
      `feedWarnBanner` off Live onto Data to match. DONE, dropped the
      early-game alert from Live too (still on Lineups + Advice), removed
      unused `.mu`/`.side`/`.vs` CSS, added `.mu2`/`.halfbox`. Full suite
      green (ckpt 114).
- [x] 6. Port the Lineups-tab narrowing from the same branch: show only my
      team and this week's opponent (not all ten), with `autoFillTeam` split
      out of `autoFillWeek` so the "re-default" button is scoped to just the
      two shown teams while the other ~8 still auto-fill silently in the
      background. DONE. Updated `test_integration.js`'s button locator (it
      searched for the literal button text, which no longer exists — now
      locates the handler itself). Full suite green (ckpt 120).
- [x] 7. Explicitly NOT porting: the other nav-refactor branch's deletion of
      the Data tab's full matchup editor down to "just set my opponent" — it
      would break standings for every OTHER team, which task 3/4 above need
      full-league matchup data to compute at all. Recorded here so a future
      session doesn't wonder why it wasn't ported too. (No code change is
      the deliverable for this one.)
- [ ] 8. Full regression pass (13 suites + ES2018 + a real `build.sh`), bump
      VERSION again if warranted, rebuild and re-send the APK to Tj.

Ticking a box means: written, tested, committed, and the test that proves it is
named in the box. **Never tick a box you have not verified** — the next account
will not re-check it.

## Waiting on Tj

- [ ] Confirm the v5.1 APK actually installed over v5.0 without needing an
      uninstall, and try the nav-refactor features (back button, Adjust
      button, Roster tabs, Wire tab).
- [ ] Decide, once this reconciliation ships, whether `main` should be
      fast-forwarded to it and whether the 3 stale branches should be deleted
      (asked, not yet answered as of this job).
- [ ] Verify v4.7-era item: **Data > Test the projection feed** (a QB should
      land near 40-55 under this scoring; 15-25 means the re-scoring is not
      running), and **Data > Test the key** if he wants Claude's reads.
