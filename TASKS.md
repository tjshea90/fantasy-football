# TASKS — the current job, in Tj's words

## 2026-09-16: rebuild the waiver wire recommendation system to be season-smart and exclude inactive/injured players; diagnose the tab-lock bug

> "Review the screenshot. This is the waiver wire tab. It is recommending
> a lot of rb that are inactive or injured or no longer play. It probably
> does this for other positions too. This is a major error. Figure out
> how to make the recommendation system recommend only active players
> that start in games every week that are not injured. The point of the
> system is to recommend the best available players in each position
> scored based on this league scoring system. Also it keeps recommending
> I switch qb. It is only considering week to week. I want it to suggest
> waiver wire drops and adds that will increase my team output for the
> entire season. Rebuild the waiver wire system to make it smart. It
> needs to suggest the top players available that aren't taken on another
> roster that are better for the season than the player it recommends I
> drop. It should explain why to drop the player I have in favor of the
> player it recommends. It should only consider active players who start
> in the NFL, considering current adp, stats from prior weeks, injury
> reports, and it can find helpful lists online by searching for current
> adp lists and waiver wire information online, but it is important that
> this information is updated for the current/upcoming NFL week.
>
> Finally sometimes when I open the app it is on the live tab and it
> won't let me press another tab like waiver wire. Diagnose
>
> Only ship after the system is well made and the code is optimized and
> it didn't break any other features in the app."

CONFIRMED ROOT CAUSES before writing any code (live ESPN API pulls, not
guesses — see the checkpoint/commit history for the exact requests run):
`Value.freeAgents()`/`byPos()`/`byVor()`/`upgrades()` (value.js) — the
entire deterministic free-agent board the Wire tab renders — never call
the injury feed or any health check at all, unlike `Recommend.projectOne`
(recommend.js), which already has that logic and applies it correctly to
the Advice tab. Verified live: James Conner, Dylan Sampson and Isiah
Pacheco are ALL on ESPN's Injured Reserve right now (checked against the
real `/injuries` feed this app already fetches), yet all three were the
top-ranked RB recommendations in Tj's screenshot. Separately, Nick Chubb
and Kareem Hunt are not on ANY of the 32 current NFL rosters at all
(checked live against all 32 teams) — `PlayerDB.doRefresh()` (playerdb.js)
only ever adds/updates players, never removes one who has fallen off
every roster, so a released/traded-away player's stale entry (old team,
old position) sits in the database forever. A third, separate defect:
ESPN's own roster feed carries a `status` field playerdb.js currently
discards entirely — 491 of ~2,450 league-wide entries are "practice-squad"
(never plays in a game) with no way for this app to tell them apart from
an active roster player, which is a large part of why the RB list showed
"179 available." Finally, `Value.upgrades()` compares a free agent's
THIS-WEEK-ONLY projection against a rostered starter's this-week
projection with a trivial 0.5-point margin — a single great matchup week
is enough to trigger a "switch QB" suggestion, exactly Tj's complaint,
while `dropCandidatesFrom()` right next to it already computes a proper
rest-of-season (ROS) value and is simply never used for the add side.

TAB-LOCK BUG — confirmed mechanism, not yet reproduced live (no way to
force a real device into the failing state from here): `boot()` (ui.js)
wraps its entire startup sequence — `Store.init`, `applyAdjust`,
`Recommend.loadCaches`, `autoFillWeek` — in ONE try/catch, and `wire()`
(the only place that ever attaches click listeners to the bottom tab
bar) does not run until AFTER all of that. If anything in that sequence
throws — most plausibly `Store.init` on a phone with a half-written or
corrupted local save, which this project's own CLAUDE.md already
documents as a real failure mode after an interrupted session — `wire()`
never runs and the tab bar is permanently inert for that entire app
session: exactly "it is on the live tab and it won't let me press
another tab." Separately, and independently worth hardening: the bottom
tab bar (`<nav id="tabs">`, index.html) carries no `data-nogesture`, so
gestures.js's swipe recognizer can misclassify a tap that drifts a few
px on a tab button as a swipe attempt instead of a plain press.

- [x] 1. value.js: apply the same OUT/IR/SUSPENDED/PUP hard-exclusion
      `Recommend`'s health check already does to every free agent the
      Wire tab can show or recommend (freeAgents/byPos/byVor/upgrades/
      waiverContext's pool) — a blocked player must never be offered at
      all, not just down-ranked. DOUBTFUL/QUESTIONABLE players stay
      offered but visibly tagged, same "tag warn" treatment already used
      on the Advice and Lineups tabs, so nothing is hidden that Tj might
      reasonably still want to grab.
      DONE — `Recommend.health` exported (recommend.js) so value.js never
      duplicates the check; `Value.freeAgents()` (value.js) now excludes
      any player whose health label is 'OUT' (which OUT/INJURED RESERVE/
      SUSPENDED/PUP all collapse to) before he ever enters the pool, and
      tags DOUBTFUL/QUESTIONABLE rows with `healthLabel`/`healthNote`.
      `byPos`/`byVor`/`upgrades`/`waiverContext`'s pool all read from
      `freeAgents()`, so the exclusion is automatically inherited by
      every one of them from a single point of truth. ui.js's `faRow()`
      now shows a `tag warn` chip for any surviving DOUBTFUL/QUESTIONABLE
      row. Proven in `tools/test_waiver.js` against the real modules (an
      injected OUT player is absent from the output entirely; a
      QUESTIONABLE player is present and tagged).
- [x] 2. playerdb.js: capture ESPN's roster `status` field (active vs
      practice-squad) during refresh and exclude practice-squad players
      from the free-agent pool entirely (they cannot play in an NFL
      game). Prune players who no longer appear on ANY of the 32 rosters
      on a full, all-teams-succeeded refresh, instead of leaving stale
      entries (old team, old position) in the database forever.
      DONE — `rosterStatus()` (playerdb.js) reads ESPN's real
      `status.type` per athlete ('active'/'day-to-day' -> 'active',
      'practice-squad' -> 'practice-squad'; the separate /injuries feed
      already gives the real OUT/DOUBTFUL/QUESTIONABLE granularity, so
      'day-to-day' folding into active is deliberate, not a gap), stored
      as `.st` on every player and persisted. `Value.freeAgents()` skips
      any `st === 'practice-squad'` row entirely; a never-refreshed
      bundled entry with no `.st` at all defaults to active so a fresh
      install's whole board is never filtered out by omission. `doRefresh`
      now tracks which players were actually seen THIS run and, only when
      EVERY one of the 32 teams answered (never on a partial failure),
      removes any database row that fell off every roster — reported back
      as `.removed` and surfaced in the Data tab's "Refresh from ESPN"
      result text. Proven in `tools/test_waiver.js` with a mocked ESPN
      roster feed: active vs practice-squad captured correctly, a player
      missing from a full successful refresh is pruned, and — separately
      — a totally FAILED refresh prunes nobody.
- [x] 3. value.js: rebuild the wire board's ranking and `upgrades()`
      around rest-of-season value (the same `(perGame - replacement) *
      weeksLeft` math `dropCandidatesFrom`/`valueOf`/`trade()` already
      use), not a single week's number, so a one-week matchup spike can
      no longer trigger a "switch QB"-style suggestion. Require a real
      sample (measured games or a genuine ESPN projection, not just the
      positional-floor guess) before a player is eligible to appear as a
      top add, matching the app's existing "no small-sample false
      confidence" standard (see matchupFactor's own n<3 gate).
      DONE — `Value.perGame()` re-ordered to lead with 2+ measured games
      this season, then ESPN's season-long (rest-of-season) projection,
      then a single measured game, then this week's ESPN line only as a
      last resort before the positional-floor guess — never THIS WEEK'S
      matchup-specific number first, which is what let one good matchup
      outrank a season-better player. Also fixed, found in the same pass:
      the season-pace branch was returning projections.js's FULL-SEASON
      total directly instead of dividing by 17 (recommend.js's own
      `projectOne` already divides the identical field correctly) — any
      player who fell through to that branch was valued at roughly 17x
      his real rest-of-season rate. Each free agent now carries
      `confident` (2+ measured games, or a real season projection — never
      a single flashy week or a positional guess). `Value.upgrades()`
      rebuilt to compare a free agent's `.v` (now season-oriented) against
      a rostered player's `.base` (recommend.js's blended baseline BEFORE
      the matchup/health multipliers apply for just one week) — an honest
      apples-to-apples rest-of-season comparison — and requires
      `confident === true`, which is what actually kills the "switch QB
      after one great week" case. Proven in `tools/test_waiver.js`: a
      45-point one-week-only ESPN line never fires; the season-pace /17
      bug is pinned with an exact expected value.
- [x] 4. ui.js: extend the deterministic (free, no Claude key needed)
      "available players project higher than someone you're starting"
      list so each suggested add is paired with a specific recommended
      drop from the same position/flex group and a plain-English,
      season-math "why" — Tj should not need a paid Claude call just to
      get a drop pairing and a reason, only the news-aware layer on top
      of it. Show injury/bye tags on every wire-board row.
      DONE — `dropCandidatesFrom()` (value.js) now carries each
      candidate's raw per-game `base` alongside its existing `.ros`, so
      `upgrades()` can compare a free agent directly against a specific
      droppable player (weakest bench player at the position, falling
      back to the weakest starter only when there is no bench depth,
      exactly as `dropCandidatesFrom` already did for the Claude path) —
      the net gain and a plain-English `why` naming both players by name,
      the point-per-game edge, the weeks left, and which source the free
      agent's number came from. `freeAgentCard()` (ui.js) now renders
      this as "Add + drop <name>" (reusing the existing
      `addFreeAgentSwap` the Claude path already used) with a "why ▾"
      detail, framed explicitly as rest-of-season, not this week. Every
      row on the full per-position board also shows a DOUBTFUL/
      QUESTIONABLE tag when one applies (OUT/IR/etc. never reach a row at
      all — see step 1). Proven in `tools/test_waiver.js`: a genuinely
      better, confident free agent is suggested paired with the correct
      specific drop and a why-text naming both players.
- [x] 5. ui.js (boot()): restructure so `wire()` (the tab bar's click
      listeners) is guaranteed to run even if `Store.init`,
      `Recommend.loadCaches`, or `autoFillWeek` throw — no single failure
      anywhere in startup may ever leave the tab bar permanently inert
      for the session. index.html: add `data-nogesture` to `<nav
      id="tabs">` so a tap that drifts slightly on a tab button can never
      be misread as a swipe attempt.
      DONE — `boot()` now has its seed/Store.init step in its own
      try/catch (the one genuinely unrecoverable case — no data means no
      screen means fatal() is the honest answer, and it still shows a
      real error card rather than a silently inert one). `wire()` and
      `render()` run UNCONDITIONALLY once that succeeds, with
      applyAdjust/Recommend.loadCaches/autoFillWeek wrapped in their own
      try/catch in between (a failure there costs only that feature, never
      tab navigation) and startLive/freshenSchedule/refreshPlayerDBIfStale/
      localAutoAdvance/syncCurrentWeek wrapped similarly afterward.
      `<nav id="tabs">` carries `data-nogesture`. Proven in the new
      `tools/test_tabsafety.js`: a real boot() run against a stub DOM with
      `Recommend.loadCaches` (and, separately, `Recommend.autoLineup`)
      forced to throw still leaves every tab clickable afterward — proven
      by actually clicking a tab handler and confirming `lastTab` changed
      — while a genuinely unrecoverable `Store.init` failure still shows
      the real fatal() error text rather than a normal-looking broken
      screen.
- [x] 6. Real tests for all of the above (a fixture proving an IR/OUT
      player never appears in `Value.freeAgents()`'s output, a fixture
      proving `upgrades()` no longer fires on a one-week-only spike, a
      boot() test proving a thrown exception before `wire()` still
      leaves the tab bar clickable). Full suite + ES2018 gate +
      `bash build.sh` green. Live-browser check of the actual Wire tab.
      Ship only once all of that holds and nothing else in the app
      regressed, per Tj's explicit "only ship after... it didn't break
      any other features."
      DONE — two new suites: `tools/test_waiver.js` (health exclusion,
      practice-squad exclusion + default-active safety, DOUBTFUL/
      QUESTIONABLE tagging, the season-pace /17 fix, the one-week-spike-
      never-fires case, the confident-upgrade-with-drop-and-why case, and
      three PlayerDB refresh/prune scenarios including "a partial or
      total failure prunes nobody") and `tools/test_tabsafety.js` (the
      boot() resilience fix, proven by actually clicking a tab handler
      after a forced throw, plus the fatal-case and the gesture-exclusion
      attribute). All 17 suites (15 existing + these 2 new ones) +
      `check_es2018.js` green.

The prior job (2026-09-15i: stop assuming other teams' weekly lineups,
deduce them from a typed-in score where feasible) is complete, shipped
as v6.8, and archived at LADDER.md §36 — full write-up in STATE.md's
2026-09-15i entry. The one before it (2026-09-15g: the weekly recap
feature, and Data tab sub-navigation) is archived at LADDER.md §35 —
full write-up in STATE.md's 2026-09-15g entry. The job before that
(2026-09-15h: the week-advance fix still failed on a true cold boot — a
network-free `localAutoAdvance()` backstop fixed it for real) is
archived at LADDER.md §34, STATE.md's 2026-09-15h entry. **Tell Tj
plainly if he reports the week still not advancing after v6.6+**: that
would point to `weekMeta['1'].allFinal` not actually being true in his
own local data (week 1 never fully synced as final on his phone), a
different, diagnostic fact — not a repeat of the same bug.

The 2026-09-15e request before those (a comprehensive app-wide sweep —
5 rounds of verified fixes plus 13 smaller ones) is archived at
LADDER.md §32, STATE.md's 2026-09-15e entry. The 2026-09-15d request
before that (the back button, a second attempt at the same symptom) at
LADDER.md §31 — that fix (v6.3, carried through v6.4-v6.8 unchanged)
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
- [ ] **Confirm v6.7 on the phone — PRIORITY, three things need a real
      device**:
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
