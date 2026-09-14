# TASKS — the 2026-09-14e request, in Tj's words

> "A couple changes I want for this app.
>
> 1) automatically select the tabs in all sections of the app to the current
> NFL week. After tonight, when NFL week one is finished, the entire app
> should default to week 2 in all sections.
>
> 2) in the advice tab, when I go to week 2, it still shows me cached
> numbers for week 1 projections which doesn't make sense. Leave all weeks
> blank until the app loads the projections. Make it so the advice loads
> and refreshes all data when I pull down to refresh, and to get all
> information possible before trying to access the Claude API in case I
> have no credit left.
>
> 3) the advice section still pulls projections from preseason sources. I
> don't like this because this information is stale. Remove all preseason
> consideration from any recommendations or advice from the entire app.
>
> 4) See if you can find more sources to blend projections. The sources
> must be reputable. All projections must convert all numbers to the
> specific scoring system of this league. This is very important. Keep in
> mind many online sites use differing point systems only blend projected
> fantasy points if you are confident that they have been rescored
> accurately for this league point system. A few sources would be great
> then average the projected fantasy points and blend them into one
> projected score for all players. Do this for all of the players on my
> roster and all of the players on the roster for my opponent of the week.
> Do not do this for any other roster, only mine and my opponent. Include
> both benches.
>
> 5) in the advice section, roster section, lineup section, and live
> section and anywhere else my players on my roster are listed, clearly
> show updated information on if any player is injured or questionable.
> Update this information smartly when needed. It must be updated
> frequently so I know which of my players is injured"

## Plan (filled in after codebase exploration)

- [ ] 1a. Find every tab/section with a week selector and make the default
      selection the "current NFL week" (computed, not hardcoded), including
      auto-advancing to week 2 once week 1's games are complete.
- [ ] 1b. Verify by switching device date/time or forcing week-calc past
      week 1's last game and confirming all sections (Advice, Roster,
      Lineup, Live, Wire, etc.) land on week 2 by default.
- [ ] 2a. Advice tab: stop showing stale cached projections for a
      newly-selected week — blank/loading state until that week's real
      projections load.
- [ ] 2b. Advice tab: pull-to-refresh re-fetches/recomputes all advice
      data from scratch.
- [ ] 2c. Advice tab: gather all non-Claude-API info first, and only call
      the Claude API last, so a no-credit failure still leaves everything
      else populated.
- [ ] 3a. Identify every place preseason projection sources/data feed into
      recommendations or advice, and remove them, using only in-season
      data once the season has started.
- [ ] 4a. Add 2-3 more reputable projection sources beyond what exists
      today.
- [ ] 4b. Convert every source's numbers into this league's scoring system
      (RULES_2026.md) before blending — never blend a source whose
      rescoring isn't confidently correct for this league's rules.
- [ ] 4c. Average the rescored projections into one blended number, for my
      roster and my current-week opponent's roster only (both benches
      included), not for any other team.
- [ ] 5a. Surface injury/questionable status on my players everywhere they
      appear: Advice, Roster, Lineup, Live, and anywhere else my roster is
      listed.
- [ ] 5b. Make the injury feed refresh frequently/automatically so status
      stays current.

Ticking a box means: written, tested, committed, and the test that proves it is
named in the box. **Never tick a box you have not verified** — the next account
will not re-check it.

When a job is finished, move it to `LADDER.md` and reset this file.

## Waiting on Tj (carried over from before this job — untouched)

- [ ] **Confirm the v5.7 GitHub Release link downloads cleanly**:
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v5.7
      ```
      Fully verified server-side (real Release, asset uploaded, correct
      content type, `Content-Disposition: attachment` on the download) —
      just needs a real-device confirmation. From here on, every future
      ship sends this style of link automatically (see CLAUDE.md "After
      every ship").
- [ ] **Confirm v5.6's injury-freshness fix on the phone** (still open from
      §24): the Wire tab's "Your roster — injuries" card should show a
      freshness line and its own "Sync injury feed" button, and "Ask Claude
      about the wire" should read current news now.
- [ ] **Confirm the v5.5 waiver-wire upgrade itself** (still open from §23):
      SEASON/1-WEEK tags, the "Last game" stat line under "why ▾", K/DEF
      only appearing when actually needed, and the "Add + drop" combined
      action on a real pickup.
- [ ] Delete stale branches himself — no session yet has had branch-delete
      access (checked repeatedly, a real permission boundary, not a bug to
      retry): `android-app-nav-ui-refactor-os6q53`,
      `resume-logic-claude-code-2ye25r`, `live-tab-dual-scores-h2nxyf` (see
      LADDER.md §22e), plus one new one from today's testing,
      `test-branch-scope-check` (harmless diagnostic branch, safe to
      delete, never had real work on it).
- [ ] Decide whether to get a pay-as-you-go Anthropic API key now that the
      Claude-Pro-subscription question is settled (§25) — if not, the
      "Or use the Claude app" handoff on both the Advice and Wire tabs stays
      the zero-cost path, just with the manual export/import step.
