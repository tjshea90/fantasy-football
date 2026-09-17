# TASKS — the current job, in Tj's words

> "The app is still recommending at least 3 players on the waiver wire that
> recorded no stats at all in week one. Are these legitimate recommendations?
> If not, figure out why it is recommending these players. It should only be
> recommending active players with the goal of producing the best weekly
> fantasy points output using this league scoring system" (2026-09-17)

Live ESPN check run this session confirms: of the flagged RBs from Tj's Wk2
screenshot (Nick Chubb HOU, Trey Benson ARI, Kareem Hunt KC, all showing
"wk1 —"), Nick Chubb and Kareem Hunt are on ZERO of the 32 current NFL
rosters right now — the exact same case (by name) the 2026-09-16/v6.9 job
already fixed once. Trey Benson and Adam Randall ARE on real rosters (ARI,
BAL) with no current ESPN injury-feed entry — legitimate to show as
speculative/no-data adds, just currently mis-ranked ahead of real production.

- [ ] 1a. Diagnose why the v6.9 OUT/off-roster exclusion isn't holding —
      confirm the root cause with a runnable repro, not just narrative
      (candidates so far: `value.js`'s `_faMemo` free-agent-board memo key
      never changes when `PlayerDB` or the injury feed refresh in the
      background, so the board can get stuck on the first, incomplete
      snapshot for the rest of the session; and `playerdb.js`'s prune only
      runs when all 32 team fetches succeed in the same pass, which a phone
      network may rarely deliver cleanly).
- [ ] 1b. Fix the real root cause(s) found in 1a in the actual source files —
      no source-text pins, drive the real modules, matching this suite's
      existing test style (`tools/test_waiver.js`).
- [ ] 1c. Also address the ranking question Tj asked directly ("are these
      legitimate?") — a pure ESPN week-line guess for a player with ZERO
      measured usage this season should not be able to outrank a player with
      real, if thin, observed production, which is what the screenshot shows
      happening (Chubb 11.5 / Benson 9.9 / Hunt 9.1 all ranked ABOVE Kendre
      Meller/Emmett Johnson/Kaelon Black/Samaje Perine, all of whom actually
      played and produced 8.0-9.0 in their one game).
- [ ] 1d. Write/extend automated tests proving each fix (name the test file
      and case when ticking this).
- [ ] 1e. Run the full suite, `node tools/check_es2018.js`, and build.sh;
      only `ship.sh` once everything is green and nothing else broke.

The prior job (2026-09-16:
rebuild the waiver-wire recommendation system to be season-smart and
exclude inactive/injured players; diagnose the tab-lock bug) is
complete, shipped as v6.9, and archived at LADDER.md §37 — full
write-up in STATE.md's 2026-09-16 entry, including the diagnosis (live
ESPN API checks confirmed James Conner/Dylan Sampson/Isiah Pacheco on
IR, Nick Chubb/Kareem Hunt off all 32 rosters, and 491 practice-squad
players all being recommended as if active/healthy) and why no
hardcoded ADP list was added (this app's own live roster/injury feeds
already satisfy "updated for the current/upcoming NFL week" without a
new, separately-decaying data source). **Tell Tj plainly if he reports
the Wire tab still recommending an injured/inactive player, or still
switching QB on a one-week spike, after v6.9** — that would mean a real
gap this fix missed, not a repeat of the exact bug already fixed. Also
worth asking if he still hits the tab-lock symptom: the mechanism was
confirmed and fixed but could not be reproduced live from this session
(no real device access), so a recurrence after v6.9 would be new
diagnostic information, not a sign the fix failed outright.

The prior job (2026-09-15i: stop assuming other teams' weekly lineups,
deduce them from a typed-in score where feasible) is archived at
LADDER.md §36 — full write-up in STATE.md's 2026-09-15i entry. The one
before it (2026-09-15g: the weekly recap feature, and Data tab
sub-navigation) is archived at LADDER.md §35 — full write-up in
STATE.md's 2026-09-15g entry. The job before that (2026-09-15h: the
week-advance fix still failed on a true cold boot — a network-free
`localAutoAdvance()` backstop fixed it for real) is archived at
LADDER.md §34, STATE.md's 2026-09-15h entry. **Tell Tj plainly if he
reports the week still not advancing after v6.6+**: that would point to
`weekMeta['1'].allFinal` not actually being true in his own local data
(week 1 never fully synced as final on his phone), a different,
diagnostic fact — not a repeat of the same bug.

The 2026-09-15e request before those (a comprehensive app-wide sweep —
5 rounds of verified fixes plus 13 smaller ones) is archived at
LADDER.md §32, STATE.md's 2026-09-15e entry. The 2026-09-15d request
before that (the back button, a second attempt at the same symptom) at
LADDER.md §31 — that fix (v6.3, carried through v6.4-v6.9 unchanged)
still needs its first real-device confirmation, see "Waiting on Tj"
below. The 2026-09-15c request before that (Rosters reorder, back
button, app-resume state, no splash flash, Claude cost estimates, bench
"why not", PlayerDB auto-refresh, full bug sweep) at LADDER.md §30; the
2026-09-15 / 2026-09-15b requests before that (the resume-system fix and
the Stats tab, plus its same-day v6.1 bugfix) at §28/§29. Full design
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
- [ ] **Confirm v6.9 on the phone — PRIORITY, this is the waiver-wire
      rebuild and the tab-lock fix you just asked for**:
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v6.9
      ```
      (1) **The Wire tab.** Open it and check: no injured/IR/suspended
      player should appear anywhere on the board any more (a DOUBTFUL or
      QUESTIONABLE player can still show up, but now carries a visible
      tag rather than looking healthy); the "beats a starter" list at the
      top should now say "Add + drop <name>" and frame everything as
      rest-of-season, with a "why ▾" explaining the season-long math
      rather than one week's number; a single big-week outlier should no
      longer show up there on its own. If you spot an inactive/injured
      player anywhere on the board, or a suggestion that still looks like
      it is chasing one good week, say exactly who/what — that is new
      diagnostic information, not a repeat of the bug already fixed.
      (2) **The tab-lock issue** ("sometimes when I open the app it is on
      the live tab and it won't let me press another tab"). The mechanism
      was found and fixed in boot() (ui.js), but could not be reproduced
      live from this session — there is no way to force a real device
      into the failing state from here. Keep using the app normally and
      say so if it happens again after v6.9; that would mean the fix
      missed a real gap, not that the diagnosis was wrong.
      (3) **Data tab → "Refresh from ESPN"** now also reports how many
      players were removed for having fallen off every NFL roster (Nick
      Chubb/Kareem Hunt were the concrete examples found this session) —
      worth one look just to see the number is sane, not zero forever.
- [ ] **Confirm v6.7 on the phone** (superseded by v6.9 above for
      anything Wire/tab-related; still worth its own look for the three
      items below, none of which v6.9 touched):
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v6.7
      ```
      (1) **The week auto-advance fix, take two (2026-09-15h, the newest).**
      v6.5 fixed the resume-only gap; Tj then reported it STILL failing
      after a full force-stop and relaunch — a true cold boot, which
      already ran the check unconditionally even before v6.5. Root cause:
      the check depended entirely on one network call to ESPN's own
      "current week" field, cached for 3 hours, failures silently
      swallowed. v6.6 added `localAutoAdvance()` — a second, independent,
      network-free signal that trusts only the app's own `weekMeta.
      allFinal` (data it already has from real syncs) — full detail in
      STATE.md's 2026-09-15h entry. **Still does NOT retroactively fix an
      already-running session** — background and reopen (or force-quit
      and relaunch) after installing for it to catch the transition. If
      every tab is not on the current NFL week within a few seconds of
      that, say exactly what you saw — and specifically, if it's STILL
      stuck, that would now point to week 1 not actually being marked
      final in the app's own local data, not a repeat of the same bug.
      (2) **New: the weekly recap feature and Data tab sub-navigation
      (2026-09-15g)** — Data tab now has 4 buttons at the top (League,
      Claude, Sync & data, App) instead of one long scroll; League has a
      new small "Weekly recap" card that opens a dialog with real
      high/low-score, closest-game, best-player facts once a week is
      fully scored, with Share/Copy and (if an API key is configured) a
      "Write it up with Claude" option. Check the sub-nav groups all look
      right and nothing you used to reach on Data feels missing.
      (3) **The back-button fix, still needs its first real-device
      confirmation.** v6.2 already claimed this was fixed, proven by every
      test that existed at the time — and it still closed the app on Tj's
      real phone. Root cause: v6.2 only registered the classic
      `onKeyDown(KEYCODE_BACK)` handler, but a real Android 13+ phone's
      gesture-based back SWIPE (the default nav style on most modern
      phones) never generates that event at all once predictive back is
      active — it never reached the app's own logic. v6.3 (carried forward
      unchanged through v6.7) registers the platform's
      `OnBackInvokedCallback` (API 33+) alongside the old handler, which is
      the correct fix for gesture nav specifically. There is no
      `adb`/emulator in this environment, so **this genuinely could only be
      tested by compiling and reasoning about it, not by reproducing the
      failure** — if the back button still closes the app, say so exactly
      the way you did last time (which tab you were on, whether you used a
      swipe or a physical/on-screen back button) rather than assuming it's
      the same already-reported issue.
      Also still worth checking while there (from v6.2, unrelated to the
      three above, not yet confirmed): (1) switch to another app and back
      — should reopen on whatever tab was open, not jump to Live; (2) same
      switch-away-and-back — no flash of the app logo before the screen you
      were on reappears; (3) Advice tab → "Bench, ranked" card → each bench
      player has its own "why not ▾"; (4) Rosters tab → your team roster
      above the trade evaluator; (5) Data tab → Sync & data → "Player
      database" card mentions it also refreshes itself automatically. This
      supersedes v6.6, v6.5, v6.4, v6.3, v6.2 and v6.1 below.
- [ ] **Confirm v6.6 on the phone** (superseded by v6.7 above; v6.6 itself
      was the week-advance fix alone, no UI changes — no reason to test it
      separately):
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v6.6
      ```
- [ ] **Confirm v6.5 on the phone** (superseded by v6.7 above; the resume-
      only week-advance fix it shipped is superseded by v6.6's more
      thorough one — no reason to test it separately):
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v6.5
      ```
- [ ] **Confirm v6.4 on the phone** (superseded by v6.7 above; v6.4 itself
      was mostly under-the-hood — see STATE.md's 2026-09-15e entry — no
      reason to test it separately):
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v6.4
      ```
- [ ] **Confirm v6.3 on the phone** (superseded by v6.7 above, which
      carries the identical back-button fix forward unchanged — no reason
      to test this build separately):
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v6.3
      ```
- [ ] **Confirm v6.2 on the phone** (superseded by v6.7 above — the back
      button specifically is now known-broken on v6.2, so there is no
      reason to test that build further):
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v6.2
      ```
- [ ] **Confirm v6.1 on the phone** (superseded by v6.2/v6.3/v6.4/v6.5/
      v6.6/v6.7 above; only worth a separate look if those checks turn up
      something the v6.1 fixes might be involved in):
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
