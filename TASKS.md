# TASKS — the current job, in Tj's words

**There is no active job right now.** The 2026-09-15c request (Rosters
reorder, back button, app-resume state, no splash flash, Claude cost
estimates, bench "why not", PlayerDB auto-refresh, and a full bug sweep) is
complete, shipped as v6.2, and archived at the end of `LADDER.md` (§30).
Full design notes and the item-8 sweep's writeup (including the two real
concurrency bugs an independent review found and this session fixed) are in
STATE.md's 2026-09-15c entry.
      data-layer check: every bench player in the seeded roster carries a
      non-empty `why[]`, identical field and shape to what starters show.
- [x] 7. PlayerDB (the 785-player database, Data tab's manual refresh
      button): keep the manual button, add automatic refresh at least every
      ~2 days, and also trigger a refresh whenever waiver-wire/free-agent
      data (or anything else that needs the full player pool current) is
      refreshed. Done — `PlayerDB.ensureFresh()` (2-day `STALE_MS` gate,
      de-duped in-flight) called quietly from `boot()`, `appResume()`,
      opening the Wire tab, and pressing "Ask Claude about the wire"; manual
      button unchanged, now with an explanatory hint. Along the way, fixed a
      real bug: `refresh()` used to stamp "updated" to now even when every
      team failed (e.g. fully offline), which would have hidden a failed
      auto-refresh from ever retrying. Proven by new `tools/test_boot.js`
      coverage (`stale()` behavior at several ages, the bug-fix guard, and
      all four call sites, as source-text pins where full execution is too
      slow — a real `refresh()` walks 32 ESPN rosters with retry backoff).
- [x] 8. Full bug/UI/functionality sweep across the app (Tj's own ask, not
      scoped to the 7 items above) plus a final comprehensive test pass —
      everything still works, well coded, efficient. Mirror the rigor of
      the 2026-09-15 Stats-tab testing pass (real browser, real data, not
      just the unit suite) where it applies. Done, in two rounds. First,
      a live-browser walkthrough of all 7 tabs plus the long-press "View
      stats" flow: zero real bugs beyond intentional/documented behavior
      (the two things that looked suspicious at first glance both checked
      out — the JSON-parse error text is a test-harness artifact, not
      reachable in production, since `NativeBridge.java` guarantees every
      real response is either valid JSON or its `ERRMARK`-prefixed error;
      the repeated "positional floor" values on the wire board are the
      documented no-data fallback, correctly labelled as a guess). Second,
      an independent code-quality review of the full diff, which found two
      real bugs and both are now fixed: (a) the manual "Refresh from ESPN"
      button bypassed item 7's single-flight guard, so a tap during a
      background auto-refresh could start a second concurrent 32-team
      fetch and push duplicate database entries — fixed by giving
      `refresh()` itself the shared guard, so the manual button and the
      background path always attach to the same in-flight attempt; (b) a
      phone offline on the Wire tab with a stale database would retry a
      full 32-team fetch on every single render, forever, with no backoff
      — fixed with a 15-minute retry cooldown on the background path only
      (the manual button still always forces it). Also memoised the two
      Claude cost-estimate functions (they were recomputing a full roster
      projection / free-agent scan on every render just to refresh a
      dollar string), fixed a real `root.Store` bug the memoisation edit
      introduced (`ui.js` is the one module in this app where `root` does
      not mean `window` — caught by re-running the live browser check
      after the fix, since no unit suite loads `ui.js` against a real DOM
      to exercise this), and cleaned up three minor consistency findings.
      Proven by new `tools/test_boot.js` coverage (a real, fast, executable
      concurrency test — every ESPN candidate resolves immediately with one
      fake player, so it proves `refresh()`/`ensureFresh()` share an
      identical in-flight promise without hitting the slow retry-backoff
      path at all — plus source-text pins for the cooldown) and new
      `tools/test_integration.js` coverage (the memoised advice estimate
      is proven to change immediately when a price rate changes, against
      the real Store/Usage/Recommend wiring — the one part of the
      memoisation fix that was a real correctness risk). All 13 suites +
      the ES2018 gate green;
      `bash build.sh` succeeds.

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
