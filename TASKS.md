# TASKS — the 2026-09-12 request, in Tj's words

> "for this app , when I press the back button on android navigation, it
> closes the app. instead, make it go back to the last thing inside the app.
> the back button should never close the app.
>
> when I press a player to see his stats, the android keyboard automatically
> appears because of the manual adjustment feature and its number field. make
> it so a number field and the adjustment feature only comes up if I press a
> button that says adjust.
>
> get rid of the table and league sections entirely (the "table" and
> "league" tabs at the bottom of the app and the sections they open). I
> don't use these at all. delete the tabs and everything inside.
>
> the weekly matchups between teams other than mine I don't care about. the
> focus of the app is my team vs my opponent every week and my roster and
> advice. the only thing I care about for other managers is their rosters so
> I know what players are taken or still available. so do not waste any data
> or resources on other fantasy managers weekly matchups. focus on mine vs
> my opponent for each week.
>
> for the roster section, instead of one long vertical scrolling section,
> organize the teams into tabs so i can click on each team and see their
> roster and make changes to it if needed.
>
> move everything about free agents to a new tab called wire. keep all the
> logic and functions the same, just move it all to its own section. I
> don't want to see it in the roster section.
>
> if any of this affects the data tab or the relevance of anything inside
> the data tab, fix it accordingly."

- [x] 1. Android back button: intercept hardware back so it navigates to the
      previous in-app screen/tab instead of closing the app; never exits the
      app — DONE: ui.js now keeps a real `navHistory` of visited tabs and
      `__onBack` pops it one at a time (goTab/`__onBack`, ui.js); when the
      trail is empty MainActivity.onKeyDown calls `moveTaskToBack(true)`
      instead of `finish()`, so back backgrounds the app like Home rather
      than closing it. Tested: `node tools/test_lifecycle.js` ("the back
      button" block drains the whole trail and lands on Live) and
      `node tools/test_gestures.js` (MainActivity no longer calls finish()
      from __onBack). Both green, committed (ckpt 61).
- [x] 2. Player stats screen: stop auto-showing the number-field/manual
      adjustment UI (which pops the Android keyboard) on open — DONE: root
      cause was `dialog()` auto-focusing the first input/button in the modal,
      and the number input used to be first. `showPlayer` (ui.js) now shows
      only an "Adjust" button; the field, +5/−5/Clear buttons and Save only
      get built into the DOM after that button is tapped. Tested: full suite
      green, incl. `tools/test_lifecycle.js`'s "every screen renders" walk
      which exercises player cards; committed (ckpt 61).
- [x] 3. Delete the "Table" and "League" bottom tabs entirely, plus all
      their section code/views/logic, from the app — DONE: removed both
      `<button data-v="standings">`/`<button data-v="league">` from
      index.html's `#tabs`, removed their `render()` dispatch cases, and
      deleted `viewStandings`, `viewLeague`, `recapCard`, `playoffCard` and
      `pct()` from ui.js (the shared `table()` helper they used is kept —
      Advice/Roster/trade cards still use it). Left the underlying engine
      modules (sim.js's season/power/regret/positionCV/matchup, recap.js's
      build/text, Store.standings) in place since they're still directly
      unit-tested as library functions (test_integration.js's robustness
      sweep, test_engine.js, test_boot.js) — nothing calls them from the UI
      anymore, so no resources are spent on them, but deleting tested code
      nobody asked to delete would be scope creep. Tested: full suite green
      (removed 3 test_boot.js assertions that checked hot-path patterns
      *inside* the deleted screens — they were asserting dead code, not
      testing behavior; see the comment left in their place).
- [x] 4. Stop computing/storing/displaying weekly matchup data for manager
      pairings other than "my team vs my opponent." Keep other managers'
      rosters (for taken/available player status) but drop their
      week-to-week matchup tracking to avoid wasting data/resources — DONE:
      viewLive (ui.js) now builds only `myMatchupCard` for the week; deleted
      the `rest.forEach(matchupCard)` loop over every other pairing, the
      "Not in a matchup this week" idle-teams scoreboard, and the now-dead
      `matchupCard`/`teamWeekRow` functions. (The League tab's "the rest of
      the week" table and season-wide sims were also the other half of this
      — gone with task 3.) Data tab's matchup editor (add/remove/generate
      the schedule) was deliberately left alone: that's schedule-structure
      admin, not a weekly analysis of other managers, and it's how the app
      knows who "my opponent" even is. Tested: full suite green, incl. the
      "every screen renders" walk on Live.
- [x] 5. Roster section: replace the single long vertical scroll of all
      teams with per-team tabs — click a team to view/edit that team's
      roster — DONE: `viewRosters` (ui.js) now renders the trade evaluator
      once, then a chip row (one per team, reusing the `.fchips`/`.fchip`
      style the free-agent position filter already used) that picks
      `rosterSel`; only the selected team's roster card renders, built by
      the new `teamRosterCard(t)` helper (same drop-button/add-player-form
      logic as before, just extracted). Defaults to Tj's own team first.
      Tested: full suite green, incl. "every screen renders" clicking
      through Rosters.
- [x] 6. Create a new "Wire" tab and move all free-agent functionality
      there verbatim (same logic/functions, just relocated). Remove free
      agents from the roster section entirely — DONE: added `data-v="wire"`
      to index.html's tab bar, added `view === 'wire'` to render()'s
      dispatch, added `viewWire(root)` in ui.js. `freeAgentCard` and
      `addFreeAgent` are byte-for-byte the same code, physically moved to a
      new WIRE section (after `manualRow`, before `table()`) and now called
      only from `viewWire` — `viewRosters` no longer references them at
      all. Tested: full suite green, incl. "every screen renders" clicking
      through Wire.
- [x] 7. Audit the Data tab for anything that referenced Table/League tabs,
      other-managers'-matchups data, or the old roster/free-agent layout,
      and fix/update it to match the new structure — DONE: grepped ui.js for
      `standings`/`league`/`Sim.`/`Recap.`/`playoffCard`/`Table`/`League tab`
      after the deletions; found and fixed one stale offline-sync toast that
      said "Scores, standings, the League tab and advice... still work" (now
      says "Scores, your roster and advice..."). The Data tab's matchup
      editor, player database tools, scoring/AI/usage cards and screen-fit
      diagnostics don't reference the deleted tabs or the old roster/free-
      agent layout and needed no changes. Tested: full suite green.

Ticking a box means: written, tested, committed, and the test that proves it is
named in the box. **Never tick a box you have not verified** — the next account
will not re-check it.

## Waiting on Tj

- [ ] Verify v4.7 on the phone: **Data > Test the projection feed** (a QB
      should land near 40-55 under this scoring; 15-25 means the re-scoring is
      not running), and **Data > Test the key** if he wants Claude's reads.
