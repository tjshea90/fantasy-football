# TASKS — the current job, in Tj's words

## 2026-09-15c: bug/UI sweep, Rosters reorder, back button, app-resume state, Claude cost estimates, bench "why not", PlayerDB auto-refresh

> "Do an overall sweep for bugs and ways to improve ui and functionality. In
> the rosters tab, move the trade evaluator to the very bottom, I want to
> see team rosters at the top. Make sure if I press the android back arrow
> it goes to the last thing in the app, because right now when I press
> back it goes to my android home screen. Make it so if I switch apps then
> go back to the fantasy app it automatically goes back to what I was
> already looking at last. Right now it always jumps back to the live tab
> if I switch apps then go back to it. If it is possible, when I switch
> back to the fantasy app from another app, immediately show the thing I
> was last looking at without the logo of the app splashing. Right now
> when I switch back to the app, it splashes the app logo first. I want no
> delays. Get rid of anywhere in the app where it says how much Claude api
> usage I have left, because I no longer have the API key. Instead, put an
> estimate of what each request would cost on a Claude api. For example,
> under "ask Claude" put "estimated 8 cents". Try to make the price
> estimate accurate, or if it is better, ask Claude itself to estimate the
> cost via the API. In the advice section, for the bench players, let me
> see a Claude explanation for each player why not to start them that
> week, just as it explains for why to start the starting players it
> recommends. In the data section, there is an option to refresh the total
> player database for all teams. Keep this there but also make the app
> itself automatically refresh this data at least every couple days and
> each time I refresh waiver wire information or anything else that it is
> important to see all players.
>
> After all these are finished, run tests that everything works and
> everything is well coded and efficient"

Note on item 5: "ask Claude itself to estimate the cost via the API" is not
reachable as literally written — Tj no longer has an API key (that is the
premise of item 5 itself), and this session has no key of its own either. A
computed estimate (Anthropic's published per-model price × a measured/typical
token count for that exact call) is the accurate path available; investigate
whether `Usage.money`/the existing per-sync cost tracking (usage.js) already
has real historical token counts to base this on before inventing new math.

- [ ] 1. Rosters tab: move the trade-evaluator card to the bottom, team
      roster card(s) to the top.
- [ ] 2. Android back button: currently exits straight to the home screen
      instead of unwinding in-app history — investigate why (this exact
      behavior was supposedly built in v4.7 per LADDER.md; either it
      regressed or Tj is describing a case that behavior doesn't cover) and
      fix it so back always goes to "the last thing in the app" first.
- [ ] 3. App resume (switching away and back) must restore exactly the
      screen/tab Tj was last looking at, not jump to Live — investigate
      MainActivity's onResume/state handling; this is a DIFFERENT bug from
      #2 even though both are about "coming back to the app."
- [ ] 4. No splash flash on resume — investigate whether this is fixable
      from the WebView/Activity side (likely an Android launch-theme /
      window-background question, not JS) and do what's actually possible;
      report honestly if something is a hard OS-level limit rather than
      silently skipping it.
- [ ] 5. Remove every "Claude usage remaining / spend so far" display
      (usage.js-backed UI, since there is no key to meter); replace with a
      per-request estimated-cost label (e.g. "estimated 8 cents") next to
      every "Ask Claude" / Claude-sync action, computed from Anthropic's
      published pricing and a real token-count basis, not a guess.
- [ ] 6. Advice tab: for each BENCHED player, show a Claude-generated "why
      not to start him" explanation, the same way the recommended starters
      already get a "why" explanation — same data/sync path, not a second
      Claude integration.
- [ ] 7. PlayerDB (the 785-player database, Data tab's manual refresh
      button): keep the manual button, add automatic refresh at least every
      ~2 days, and also trigger a refresh whenever waiver-wire/free-agent
      data (or anything else that needs the full player pool current) is
      refreshed.
- [ ] 8. Full bug/UI/functionality sweep across the app (Tj's own ask, not
      scoped to the 7 items above) plus a final comprehensive test pass —
      everything still works, well coded, efficient. Mirror the rigor of
      the 2026-09-15 Stats-tab testing pass (real browser, real data, not
      just the unit suite) where it applies.

**There is no OTHER active job right now.** The 2026-09-15 / 2026-09-15b
requests — the resume-system fix and the Stats tab (plus its same-day v6.1
bugfix) — are complete, shipped, and archived at the end of `LADDER.md`
(§28, §29). Full design notes and the testing-pass writeup are in STATE.md's
2026-09-15 entries.

## When Tj asks for something new

Write it HERE FIRST, in his own words, as unticked boxes — before writing any
code. Until it is written into `TASKS.md` as real steps, nobody has actually
planned the work — a message sitting in a chat window is not a task list.

**You do not have to race a usage cap to get the raw request itself onto
disk any more (learned the hard way, 2026-09-15).** A `UserPromptSubmit`
hook (`tools/capture_inbox.sh`) already writes every message Tj sends to
`INBOX.md`, verbatim, and commits+pushes it the instant it arrives — before
you have read a single file. See `INBOX.md`'s own header and CLAUDE.md's
"Saving work" for the full reasoning. This does not lower the bar on writing
`TASKS.md` promptly — it means a forgotten or interrupted `TASKS.md` write is
now a recoverable gap instead of a total loss.

```
# TASKS — the <date> request, in Tj's words

> "<paste what he actually said, verbatim>"

- [ ] 1a. <first step>
- [ ] 1b. <second step>
```

Ticking a box means: written, tested, committed, and the test that proves it is
named in the box. **Never tick a box you have not verified** — the next account
will not re-check it.

When a job is finished, move it to `LADDER.md` and reset this file. This file
is printed into every session briefing, so a finished job left here is re-read
at cost on every cold start, forever.

## Waiting on Tj

- [ ] **Confirm v6.1 on the phone**:
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v6.1
      ```
      v6.0 shipped with two real bugs Tj found on his own phone within
      minutes (Top Players stuck on a stale week; team roster rows missing
      player names) — both fixed same-day in v6.1, verified live in a
      browser reproducing his exact steps, but not yet confirmed on a real
      device. Specifically worth checking: Stats tab → Top players → switch
      weeks with the header arrows and back (should always match the header,
      never get stuck) → Stats tab → By team → any team (rows should show
      player names). Long-press "View stats" (hold, don't tap) on a player
      row anywhere else in the app (Live, Lineups, Rosters, Wire) is also
      still unconfirmed on a real device. This carries forward and
      supersedes every older confirmation ask below (v5.5 through v5.9) —
      if v6.1 looks right, those do not need a separate look.
- [ ] **Confirm the v5.7 GitHub Release link downloads cleanly**:
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v5.7
      ```
      Fully verified server-side (real Release, asset uploaded, correct
      content type, `Content-Disposition: attachment` on the download) —
      just needs a real-device confirmation. From here on, every future
      ship sends this style of link automatically (see CLAUDE.md "After
      every ship").
- [ ] **Confirm the 2026-09-14e changes on the phone**: the app should open
      straight on the current NFL week; the Advice tab should show a clear
      "projections have not loaded yet" card (not old numbers) right after
      switching to a week that has not been synced, and pulling down on
      Advice should visibly run the full advice sync; the new "[opponent] ·
      blended projections" card should appear on Advice under your own
      bench; and OUT/DOUBTFUL/QUESTIONABLE tags should now show next to
      players on the Rosters, Lineups and Live tabs, not just Advice.
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
      LADDER.md §22e), plus one new one from an earlier session's testing,
      `test-branch-scope-check` (harmless diagnostic branch, safe to
      delete, never had real work on it).
- [ ] Decide whether to get a pay-as-you-go Anthropic API key now that the
      Claude-Pro-subscription question is settled (§25) — if not, the
      "Or use the Claude app" handoff on both the Advice and Wire tabs stays
      the zero-cost path, just with the manual export/import step.
- [ ] Consider whether a genuinely reputable, free, no-key third projection
      source ever turns up (NFL.com, FantasyPros, Yahoo and MFL were all
      checked and rejected today — see LADDER.md §27 / STATE.md for why).
      If Tj is willing to sign up for a paid/keyed data provider, that
      changes the calculus and is worth revisiting.
