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

- [ ] 1. Android back button: intercept hardware back so it navigates to the
      previous in-app screen/tab instead of closing the app; only exits the
      app from the true root screen with the platform's normal back
      behavior (or never, per "should never close the app" — confirm which
      screen counts as root, default to matching Android convention of
      exit-from-home only if ambiguous).
- [ ] 2. Player stats screen: stop auto-showing the number-field/manual
      adjustment UI (which pops the Android keyboard) on open. Add an
      "Adjust" button; only reveal the number field + adjustment controls
      after it's pressed.
- [ ] 3. Delete the "Table" and "League" bottom tabs entirely, plus all
      their section code/views/logic, from the app.
- [ ] 4. Stop computing/storing/displaying weekly matchup data for manager
      pairings other than "my team vs my opponent." Keep other managers'
      rosters (for taken/available player status) but drop their
      week-to-week matchup tracking to avoid wasting data/resources.
- [ ] 5. Roster section: replace the single long vertical scroll of all
      teams with per-team tabs — click a team to view/edit that team's
      roster.
- [ ] 6. Create a new "Wire" tab and move all free-agent functionality
      there verbatim (same logic/functions, just relocated). Remove free
      agents from the roster section entirely.
- [ ] 7. Audit the Data tab for anything that referenced Table/League tabs,
      other-managers'-matchups data, or the old roster/free-agent layout,
      and fix/update it to match the new structure.

Ticking a box means: written, tested, committed, and the test that proves it is
named in the box. **Never tick a box you have not verified** — the next account
will not re-check it.

## Waiting on Tj

- [ ] Verify v4.7 on the phone: **Data > Test the projection feed** (a QB
      should land near 40-55 under this scoring; 15-25 means the re-scoring is
      not running), and **Data > Test the key** if he wants Claude's reads.
