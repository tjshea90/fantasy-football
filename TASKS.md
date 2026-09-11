# TASKS — the 2026-09-11 request, in Tj's words

> "for this app , when I press the back button on android navigation, it
> closes the app. instead, make it go back to the last thing inside the app.
> the back button should never close the app.
>
> when I press a player to see his stats, the android keyboard automatically
> appears because of the manual adjustment feature and its number field. make
> it so a number field and the adjustment feature only comes up if I press a
> button that says adjust.
>
> get rid of the table and league sections entirely (the "table" and "league"
> tabs at the bottom of the app and the sections they open). I don't use these
> at all. delete the tabs and everything inside.
>
> the weekly matchups between teams other than mine I don't care about. the
> focus of the app is my team vs my opponent every week and my roster and
> advice. the only thing I care about for other managers is their rosters so I
> know what players are taken or still available. so do not waste any data or
> resources on other fantasy managers weekly matchups. focus on mine vs my
> opponent for each week.
>
> for the roster section, instead of one long vertical scrolling section,
> organize the teams into tabs so i can click on each team and see their
> roster and make changes to it if needed.
>
> move everything about free agents to a new tab called wire. keep all the
> logic and functions the same, just move it all to its own section. I don't
> want to see it in the roster section.
>
> if any of this affects the data tab or the relevance of anything inside the
> data tab, fix it accordingly."

- [x] 1. Android back button: never exits the app. Pressing back moves to the
      previous in-app view/tab or closes an open detail/modal instead. Wire
      this in the Java shell (`android/`) with a JS-side back-stack it can
      query, or an in-page history stack driven from `ui.js`.
      DONE: ui.js now keeps a real `navStack` of visited tabs (pushed by
      `goTab`, popped by `__onBack`/`goBackTab`) instead of always jumping to
      Live; MainActivity.onKeyDown always intercepts BACK and calls
      `moveTaskToBack(true)` instead of `finish()` when the page has nothing
      left to unwind, so the app backgrounds instead of closing. Verified by
      `node tools/test_lifecycle.js` ("the back button" — walks 3 tabs deep
      and confirms back unwinds them in visit order, then declines) and
      `node tools/test_gestures.js` (MainActivity source no longer contains
      `finish()` or `web.canGoBack()`).
- [x] 2. Player detail view: stop the number-field/adjustment control from
      auto-focusing (which pops the Android keyboard) when you open a
      player's stats. Add an "Adjust" button that only then reveals the
      number field + adjustment controls.
      DONE: `showPlayer()` in ui.js now shows only an "Adjust" button by
      default; the number field + preset buttons + Save are in a hidden
      `editor` div revealed (and only then focused) on click. dialog()'s
      auto-focus-first-control now lands on the Adjust button, not the number
      field. Verified by `node tools/test_lifecycle.js` (every screen still
      renders clean) and `node tools/check_es2018.js`.
- [x] 3. Delete the "Table" (standings) and "League" tabs entirely: remove
      the nav buttons in `index.html`, delete their view-render code in
      `ui.js` (and any helpers used only by them), and drop dead references
      elsewhere (e.g. `schedule.js`/`recap.js` if only used for those views).
      DONE: removed the two `<button data-v="standings"/"league">` tabs from
      index.html; deleted `viewStandings`, `viewLeague`, `playoffCard`,
      `recapCard`, `pct()` from ui.js. sim.js and recap.js had NO remaining
      consumer once those views were gone (grepped the whole app/assets +
      tools tree) so both files are deleted outright, along with every
      `Sim.invalidate()` call site in ui.js and the now-dead
      `Store.standings`/`Store.seasonTotals` in store.js. MANIFEST.txt
      updated to match. Verified by `bash bootstrap.sh` (manifest/disk agree)
      and all 13 suites (`node tools/test_*.js`, `node tools/check_es2018.js`)
      green with sim.js/recap.js removed from every load list.
- [x] 4. Stop computing/storing weekly matchup data for teams other than
      "my team vs my opponent" each week. Only sync/score/keep the two teams
      in my matchup; other managers' rosters are still tracked (for
      taken/available players) but their weekly matchup results are not
      fetched, scored, or stored.
      DONE: Live tab (`viewLive`) now renders only `myMatchupCard` — the
      "rest of the week" loop and the now-pointless `matchupCard` function
      and the "not in a matchup" idle-team block are gone. The Data tab's
      matchup editor is no longer a 10-team schedule tool (add any pair,
      generate a round robin, auto-pair the rest) — it is one card, "my
      matchup", that only ever sets/changes/clears MY opponent for the
      week via `Store.addMatchup(week, S.league.me, oppId)`. Nothing left
      in the app ever reads or writes another pair. Verified by
      `node tools/test_lifecycle.js` ("every screen renders" still passes
      for live/data) and manual trace of every remaining `Store.getMatchups`
      call site (just the two above).
- [ ] 5. Roster tab: replace the single long vertical list of all teams with
      per-team tabs/sub-nav — click a team to see just its roster, with edit
      controls still available.
- [ ] 6. New "Wire" tab: move all free-agent logic/UI out of the roster
      section into its own top-level tab called "Wire". Keep the underlying
      functions/logic unchanged, just relocate the surface.
- [ ] 7. Data tab: audit and fix anything that referenced Table/League views,
      all-teams weekly matchups, or roster-embedded free agents so it stays
      accurate after 1-6 (e.g. "test" actions, data freshness/status rows,
      cache descriptions).
