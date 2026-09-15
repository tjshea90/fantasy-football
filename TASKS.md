# TASKS — the current job, in Tj's words

**There is no active job right now.** The most recent one (2026-09-15f: the
app never advanced past a finished NFL week unless truly cold-booted) is
complete, shipped as v6.5, and archived at LADDER.md §33 — full
root-cause writeup in STATE.md's 2026-09-15f entry. **Tell Tj plainly that
this does not retroactively fix his already-running session** — he needs
to background/reopen or relaunch the app once v6.5 installs for the fix
to take effect.

The 2026-09-15e request before it (a comprehensive app-wide sweep — 5
comprehensive app-wide sweep — 5 rounds of verified fixes across data
integrity, value.js correctness, UI/feature correctness, Android hardening
and cost/model accuracy, plus 13 smaller fixes) is complete, shipped as
v6.4, and archived at the end of `LADDER.md` (§32) — full root-cause
writeup for every fix in STATE.md's 2026-09-15e entry. Two items came out
of that sweep that need Tj's decision rather than being done unasked — see
"Waiting on Tj" below (the Data tab card wall, the dead recap.js write-up
feature).

The 2026-09-15d request before it (the back button still closing the app
on a real device, a second attempt at the same symptom) is archived at
LADDER.md §31 — that fix (v6.3) still needs a real-device confirmation,
also flagged below since it is a second attempt, not a routine
confirmation. The 2026-09-15c request before that (Rosters reorder, back
button, app-resume state, no splash flash, Claude cost estimates, bench
"why not", PlayerDB auto-refresh, and a full bug sweep) is archived at
LADDER.md §30; the 2026-09-15 / 2026-09-15b requests before that (the
resume-system fix and the Stats tab, plus its same-day v6.1 bugfix) at
§28/§29. Full design notes for all of them are in STATE.md's 2026-09-15
entries.

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

- [ ] **Decide: the Data tab is a 13-card wall with no sub-navigation.**
      Found during the 2026-09-15e sweep (flagged, not touched — a UI
      review agent's finding, and this crosses into "major redesign"
      territory the standing "no major changes unless approved" rule is
      for). One long vertical scroll of: Weekly scores, Standings, Week N
      matchups (+ add/generate season), Stats feed, Scoring, AI/Claude
      settings, Claude costs, Lineup alerts, Live, Screen fit, Player
      database, Backup, About — 13 cards, sometimes 14 (a "Duplicate
      players merged" card appears conditionally inside Player database).
      Nothing is broken; it is just a lot of scrolling to reach, say,
      Backup or About. If you want this addressed, options worth
      discussing rather than picking one unasked: (a) group into
      collapsible sections (League / App settings / Diagnostics, say);
      (b) sub-tabs within Data; (c) leave it — it works, it is just long.
      Not implementing any of this without your steer.
- [ ] **Decide: recap.js's write-up feature is fully wired up but never
      reachable from any button.** Found and traced precisely during the
      2026-09-15e sweep (an earlier note in this file called all of
      recap.js dead — that was imprecise; `Recap.generateSchedule` is very
      much alive, it is the Data tab's "Generate the whole season" button).
      What IS dead, confirmed by grepping every JS/Java call site: `Recap.
      build`/`Recap.text` (recap.js), `Ai.recap()` (ai.js — a
      Claude-written short weekly recap for the league chat, cheap-model
      only, no web search), and `NativeBridge.share()`/`copy()` (the
      Android methods that would put such text on the share sheet or the
      clipboard). All four exist, are exported, compile/pass their own
      tests, and have ZERO callers anywhere in the shipped app — no button,
      no card, nothing invokes them. Looks like a feature that was built
      and never given a UI trigger, not something that broke. Your call:
      wire it up (a button somewhere — Data tab or a new one on Live/
      Wire — that calls `Ai.recap()` with the week's settled facts and
      offers `Native.share`/`Native.copy` on the result), or remove all
      four as genuinely unused. Not doing either without your steer, since
      "add a feature" and "remove working code" are both squarely
      "major" under the standing rule.
- [ ] **Confirm v6.4 on the phone — PRIORITY, includes a second attempt at
      the back-button bug**:
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v6.4
      ```
      v6.2 already claimed the back button was fixed, proven by every test
      that existed at the time — and it still closed the app on Tj's real
      phone. Root cause: v6.2 only registered the classic
      `onKeyDown(KEYCODE_BACK)` handler, but a real Android 13+ phone's
      gesture-based back SWIPE (the default nav style on most modern
      phones) never generates that event at all once predictive back is
      active — it never reached the app's own logic. v6.3 (carried forward
      unchanged into v6.4) registers the platform's `OnBackInvokedCallback`
      (API 33+) alongside the old handler, which is the correct fix for
      gesture nav specifically. There is no `adb`/emulator in this
      environment, so **this genuinely could only be tested by compiling
      and reasoning about it, not by reproducing the failure** — if the
      back button still closes the app on v6.4, say so exactly the way you
      did last time (which tab you were on, whether you used a swipe or a
      physical/on-screen back button) rather than assuming it's the same
      already-reported issue — the next session needs to know if the
      predictive-back fix didn't hold, which points somewhere new entirely.
      Also still worth checking while there (from v6.2, unrelated to the
      back-button fix, not yet confirmed): (1) switch to another app and
      back — should reopen on whatever tab was open, not jump to Live; (2)
      same switch-away-and-back — no flash of the app logo before the
      screen you were on reappears; (3) Data tab → "Claude costs" card —
      live dollar estimates next to "Sync advice" and "Ask Claude about the
      wire", never a "$X left" meter; (4) Advice tab → "Bench, ranked" card
      → each bench player has its own "why not ▾"; (5) Rosters tab → your
      team roster above the trade evaluator; (6) Data tab → "Player
      database" card mentions it also refreshes itself automatically. v6.4
      itself is mostly under-the-hood (see the two decisions above and
      STATE.md's 2026-09-15e entry) — nothing new it changed should look
      different on screen except the Data tab's cost-estimate line wording.
      This supersedes v6.3, v6.2 and v6.1 below.
- [ ] **Confirm v6.3 on the phone** (superseded by v6.4 above, which
      carries the identical back-button fix forward unchanged — no reason
      to test this build separately):
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v6.3
      ```
- [ ] **Confirm v6.2 on the phone** (superseded by v6.4 above — the back
      button specifically is now known-broken on v6.2, so there is no
      reason to test that build further):
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v6.2
      ```
- [ ] **Confirm v6.1 on the phone** (superseded by v6.2/v6.3/v6.4 above;
      only worth a separate look if those checks turn up something the
      v6.1 fixes might be involved in):
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
