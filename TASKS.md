# TASKS — the 2026-09-14 request, in Tj's words

> "For this app's waiver wire section, give it an upgrade. Make the section
> consider my current team roster as a whole, see if any of my players are
> injured and explain the extent of the injury and status for the rest of
> the season outlook, search web resources for current top waiver wire picks
> (make sure it only uses up-to-date waiver wire resources and not
> information from prior weeks), consider and let me know the recommended
> waiver wire player's prior stats for this season and why he is recommended
> (for example, "player x is the new starter for team a because of player y
> injury last week, player x had 3 receptions for 34 yards last week after
> player y injury, and he is expected to be the starter next week"). Give
> more priority to entire season recommendations for roster improvements
> over small weekly changes like a better kicker for this week. Give low
> priority to defense and kickers on the waiver wire recommendations unless
> one of mine is on a bye week and I need a replacement. Give specific drop
> and pick up recommendations, for example, "drop player x due to low output
> and pick up player y due to increased role and consistent points". Make
> sure the recommendations make sense, for example, don't recommend dropping
> a kicker and picking up a WR, that makes no sense because I won't have a
> kicker. All recommendations must keep this league's scoring system in
> mind, calculating recommendations based on this league's scoring system
> and recognizing waiver wire recommendations from the web may use different
> scoring systems. Each position in this section should show the best
> available players at the top, sorted best to worst based on all the
> considerations already mentioned. The goal is a smart waiver wire system
> that acts like a real waiver wire assistant. After implementing any
> changes, make sure it works well, the code is optimized, and it didn't
> break anything else in the app."

**Starting point.** The Wire tab already has a real Claude-backed waiver
assistant (v3.4, ai.js `askWaivers`/`waiverPrefix`/`waiverBlock`) that: prices
free agents in THIS league's scoring (not half-PPR standard), shows a
deterministic free-agent board grouped and sorted by position, flags upgrades
over current starters, and re-ranks a shortlist using Claude's web search with
a cited "why". What it does NOT do yet, and what this job adds:

- [ ] 1. **Roster injuries + season outlook.** `value.js`: build a
      deterministic injury list for MY roster (reuse `Recommend.projectAll`,
      no AI needed) — name, pos, ESPN status, note, bye. `ai.js` waiver
      prompt: add a "MY ROSTER — INJURIES" block and a `"injuries"` JSON
      field asking Claude to research each one's rest-of-season timeline/
      severity and whether it creates a real roster need. `ui.js`: a new
      "Your roster — injuries" card on the Wire tab, showing the
      deterministic ESPN status immediately and Claude's season-outlook text
      once synced (dated). Test: `test_ai.js` covers `normalizeInjuries`
      parsing; `test_integration.js` covers the new context field.
- [ ] 2. **Freshness discipline.** Prompt instructs Claude explicitly to use
      only this week's current news and to distrust/re-check anything that
      reads like a prior week's status — not just "prefer last 7 days" as
      now. Test: prompt-content assertion in `test_integration.js`.
- [ ] 3. **Recent stat line + the specific "why".** Add a `recentStat` field
      to each waiver add (his most recent game's actual stat line, dated) and
      tighten the `why` instructions/example to match Tj's exact pattern —
      name the injured/benched player he's replacing and cite the date. Mirror
      in `handoff.js`'s offline briefing (same contract, same example).
- [ ] 4. **Season-priority over week-priority.** Add a `priority`:
      `"season"|"week"` field per add (season = role/depth-chart change
      expected to last; week = one-off/bye/matchup fill-in), with explicit
      prompt rules and examples. `ui.js` sorts each position's Claude-ranked
      list season-priority first, independent of Claude's raw `rank`, and
      shows a small badge.
- [ ] 5. **K/DEF low priority unless my own is out.** `value.js` computes
      `kdefNeed: {K: bool, DEF: bool}` — true only when every K/DEF on my
      roster is on bye or ruled OUT this week. Prompt uses that flag to gate
      K/DEF recommendations. `ui.js` keeps K/DEF sections visually last
      (already true for the deterministic board; make Claude's read section
      follow the same fixed position order regardless of Claude's own
      ordering) and labels them low-priority/why-shown.
- [ ] 6. **Specific, sane drop+add pairing.** `value.js` computes cut
      candidates per position from MY roster (bench first, weakest
      rest-of-season value via the existing `valueOf`/`weeksLeft` math, so a
      one-week edge doesn't outrank a season-long one) and passes them to the
      prompt. Add a `dropCandidate` field per add, constrained to the
      supplied same-position candidate list so a K→WR-style mismatch cannot
      happen (validated app-side in `normalizeWaivers`, never trusted blindly
      from the model). `ui.js`: show the "drop X → add Y" pairing per row,
      with a combined one-tap "Add + drop" action next to the existing plain
      Add button (reusing `confirmModal`, same pattern as the Rosters tab's
      Drop button).
- [ ] 7. **Keep the offline Claude-app handoff in sync.** `handoff.js`
      `buildWaivers` markdown and `importReply` must carry the same new
      contract fields as the live API path — one implementation, not two (see
      `test_integration.js` §8, "no drift").
- [ ] 8. **Regression-proof it.** Extend `test_ai.js` / `test_integration.js`
      / `test_handoff.js` for the new fields and edge cases (missing fields,
      a `dropCandidate` name Claude invents that is not in the supplied list,
      no injuries on roster, K/DEF gating on/off). Run the full suite +
      `node tools/check_es2018.js` + `bash build.sh`. Confirm nothing on the
      Advice tab, Rosters tab, or the existing free-agent board regressed.
- [ ] 9. **Sweep.** Per standing instruction: after this lands, do a full
      pass over the touched files (and their close neighbors) for bugs, dead
      code, and UI/efficiency improvements before calling it done. Bump
      VERSION, checkpoint after each numbered step above (not just at the
      end), ship at the finish.

Ticking a box means: written, tested, committed, and the test that proves it
is named in the box. **Never tick a box you have not verified.**
