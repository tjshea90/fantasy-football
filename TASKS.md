# TASKS — the current job, in Tj's words

## 2026-09-15e: comprehensive app-wide scan for improvements (code, function, UI)

> "Do a comprehensive app wide scan for improvements in code and function
> and ui. Take as long as you need and use as much usage as you need. Do a
> thorough job. Improve the app as much as you can and I'll check back much
> later"

Open-ended, not scoped to a specific bug or feature — the whole app, all
three axes (code quality, functional correctness, UI/UX). Per his standing
preference (see the top of this session's system context): after major
updates do a full sweep, take as much time as needed, don't introduce new
bugs, keep everything resumable, and — the one hard boundary — "do not make
any major changes unless I approve." So: real bugs get fixed outright;
small/moderate code-quality and UI improvements get made outright; anything
that would be a major redesign, a new feature, or a significant behavior
change gets flagged/asked about rather than just done. He said he'll check
back much later, so this runs autonomously — checkpoint after every real
step, the way every job in this repo already does.

- [x] 1. Planned and dispatched: 6 parallel background review agents, each
      scoped to a logical area (data/scoring core, value/recommend engine,
      UI part 1, UI part 2, Android/Java shell, ai/usage/handoff), each
      explicitly read-only, reporting ranked findings independently. Every
      finding was personally re-verified against real source before acting
      — this caught two review-agent claims that did NOT hold up (the
      legacy httpGet/httpGetH/httpPost methods are tested-and-used by
      design, not dead code; value.js's _faMemo generation-keyed
      invalidation is a deliberate, robust, already-correct pattern used
      consistently across value.js/recommend.js/ui.js, not an "incidental"
      gap) — both left alone rather than "fixed."
- [x] 2. Triaged into 5 rounds by risk/area (data integrity; value.js
      correctness; UI/feature correctness; Android hardening; cost/model
      accuracy) plus a batch of 13 smaller verified fixes; 2 items flagged
      for Tj below rather than done unasked (the Data tab card wall, the
      dead recap.js/Ai.recap/NativeBridge share+copy write-up chain).
- [x] 3. All 5 rounds plus the small-fixes batch applied and checkpointed
      individually via `tools/ckpt.sh` (10 checkpoints across this job,
      ckpt 281 through 361) — see STATE.md's 2026-09-15e entry for the
      full list of real bugs fixed, with root cause and proof for each.
- [x] 4. Live-browser pass done via a local static server + Playwright
      (chromium): confirmed a clean boot with no real console errors (the
      only console noise was ERR_CERT_AUTHORITY_INVALID from this sandbox's
      own network proxy blocking live ESPN/Anthropic calls, and a harmless
      favicon.ico 404 — neither is a real app defect); confirmed the
      long-press "View stats" dialog opens on a real touch-event sequence
      and, critically, that tapping its own Cancel button WITHIN the 400ms
      suppression window now actually dismisses it (the exact
      click-suppression-scoping fix from this sweep, proven live, not just
      by source-text pin); confirmed the Data tab renders its "Claude
      costs" section with the corrected copy and no errors.
- [x] 5. All 14 suites + the ES2018 gate green throughout, `bash build.sh`
      run clean repeatedly (28 classes, signature OK) after every round.
      Shipped — see the Release link Tj was sent, and STATE.md's entry for
      the version number.

**There is no OTHER active job right now.** The most recent one (2026-09-15d: the
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
- [ ] **Confirm v6.3 on the phone — PRIORITY, this is a second attempt at
      the same bug**:
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v6.3
      ```
      v6.2 already claimed the back button was fixed, proven by every test
      that existed at the time — and it still closed the app on Tj's real
      phone. Root cause: v6.2 only registered the classic
      `onKeyDown(KEYCODE_BACK)` handler, but a real Android 13+ phone's
      gesture-based back SWIPE (the default nav style on most modern
      phones) never generates that event at all once predictive back is
      active — it never reached the app's own logic. v6.3 registers the
      platform's `OnBackInvokedCallback` (API 33+) alongside the old
      handler, which is the correct fix for gesture nav specifically. There
      is no `adb`/emulator in this environment, so **this genuinely could
      only be tested by compiling and reasoning about it, not by
      reproducing the failure** — if the back button still closes the app
      after this one, say so exactly the way you did this time (which tab
      you were on, whether you used a swipe or a physical/on-screen back
      button) rather than assuming it's the same already-reported issue —
      the next session needs to know if v6.3's specific fix (predictive
      back) didn't hold, which points somewhere new entirely.
      Also still worth checking while there (all from v6.2, unrelated to
      the back-button fix, not yet confirmed): (1) switch to another app
      and back — should reopen on whatever tab was open, not jump to Live;
      (2) same switch-away-and-back — no flash of the app logo before the
      screen you were on reappears; (3) Data tab → "Claude costs" card —
      live dollar estimates next to "Sync advice" and "Ask Claude about the
      wire", never a "$X left" meter; (4) Advice tab → "Bench, ranked" card
      → each bench player has its own "why not ▾"; (5) Rosters tab → your
      team roster above the trade evaluator; (6) Data tab → "Player
      database" card mentions it also refreshes itself automatically. This
      supersedes both v6.2 and v6.1 below.
- [ ] **Confirm v6.2 on the phone** (superseded by v6.3 above — the back
      button specifically is now known-broken on v6.2, so there is no
      reason to test that build further):
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v6.2
      ```
- [ ] **Confirm v6.1 on the phone** (superseded by v6.2/v6.3 above; only
      worth a separate look if those checks turn up something the v6.1
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
