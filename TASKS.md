# TASKS — the current job, in Tj's words

**There is no active job right now.** The most recent one (2026-09-15d: the
back button still closing the app on a real device, even after 2026-09-15c
had already claimed to fix it) is complete, shipped as v6.3, and archived at
the end of `LADDER.md` (§31) — full root-cause writeup in STATE.md's
2026-09-15d entry. **This one specifically needs a real check, not a
formality** — see "Waiting on Tj" below, which flags it as a second attempt
at the same symptom, the first having looked correct by every test that
existed at the time.

The 2026-09-15c request before it (Rosters reorder, back button,
app-resume state, no splash flash, Claude cost estimates, bench "why not",
PlayerDB auto-refresh, and a full bug sweep) is archived at LADDER.md §30;
the 2026-09-15 / 2026-09-15b requests before that (the resume-system fix
and the Stats tab, plus its same-day v6.1 bugfix) at §28/§29. Full design
notes for all of them are in STATE.md's 2026-09-15 entries.

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

- [ ] **Confirm v6.2 on the phone**:
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v6.2
      ```
      This is the one that most needs a real device — several of its 8
      items are exactly the kind of thing a browser harness cannot prove
      (real backgrounding, a real process kill, a real Android 12+ splash
      screen). Specifically worth checking: (1) press the Android back
      button from a non-Live tab — should unwind to wherever you came from,
      never straight to the home screen; (2) switch to another app and back
      — should reopen on whatever tab was open, not jump to Live; (3) same
      switch-away-and-back — no flash of the app logo before the screen you
      were on reappears; (4) Data tab → "Claude costs" card — should show
      live dollar estimates next to "Sync advice" and "Ask Claude about the
      wire", never a "$X left" meter or a percentage; (5) Advice tab →
      "Bench, ranked" card → each bench player should have its own "why not
      ▾" explanation, same as starters' "why ▾"; (6) Rosters tab → your team
      roster should render above the trade evaluator, not below; (7) Data
      tab → "Player database" card should mention it also refreshes itself
      automatically. This carries forward and supersedes the v6.1 ask below
      — if v6.2 looks right, that one does not need a separate look.
- [ ] **Confirm v6.1 on the phone** (superseded by v6.2 above; only worth a
      separate look if v6.2's own check above turns up something the v6.1
      fixes might be involved in):
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
