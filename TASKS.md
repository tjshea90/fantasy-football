# TASKS — the current job, in Tj's words

## Current job (2026-09-24b) — BUILD PROPOSALS 1, 2, 3, 6, 7, 8, 9, 10 + LIVE LAYOUT, THEN A FULL TEST

Tj, 2026-09-24T19:27Z:

> "Add recommended features 1, 2, 3, 6, 7, 8, 9, 10.
>
> For the live tab, move the projection/win probability card to the bottom of
> the section under the live team tracking.
>
> Then run full tests on the app using the full power of opus 5.5 ultracode"

Not 4 (light theme) and not 5 (league scoreboard). The proposal texts are
under "Waiting on Tj" below. Hard rules still apply: ES2018 only, one
universal APK, async bridge, RULES_2026.md ground truth, no function or
accuracy lost. Each item gets a named test; checkpoint after every item.

- [x] **A. (#1) Win probability on Live** DONE (test_picks2 '#1', 16 checks: Sim.matchupOdds math, Schedule.remaining clock parse, on-screen bar, halftime projection, final week) — — from both teams' projected finish
      and a per-player spread (measured position CV, sim.js), live: banked
      points are certain, a player mid-game carries part of his spread, a
      finished week is 100/0. Shown as "you 58% · 42% Opp" with a bar.
- [x] **B. Live layout** DONE (test_picks2: boxes index 0, card index 1) — — the projection / win-probability card moves BELOW
      the two live team boxes.
- [x] **C. (#2) Position colours** DONE (test_picks2 '#2 ... #3', Roster/Live/Lineups/Advice) — — QB/RB/WR/TE/K/DEF colour chips in every
      slot column (Live, Lineups, Roster, Wire, Advice, dialogs); FLEX neutral.
- [x] **D. (#3) Compact injury badges** DONE (same block: Q, IR distinct from O, no spelled-out words in lists, tooltip/aria full text) — — Q / D / O / IR / SUSP / PUP pills
      (full word as title + aria-label) in lists; detail views keep words.
- [x] **E. (#6) Matchup difficulty chip** DONE (test_picks2 '#6', 7 checks; fantasy-points-allowed from the league book + PlayerDB positions, rank 1 = toughest, 2-game minimum) — — "vs HOU · 28th vs RB" coloured
      soft/avg/tough from the engine's own defense-vs-position numbers, on
      Lineups, Advice and Roster rows.
- [x] **F. (#7) Trending on the Wire** DONE (test_picks2 '#7', 5 checks; projections.js captures ownership + outlooks from the same response) — — ESPN ownership % + weekly change
      (already in the downloaded projection data) on free-agent rows, plus a
      "Trending" filter sorted by the change.
- [x] **G. (#8) One player card** DONE (test_picks2 '#8': Live tap, Roster ⋯ -> Player card, long-press direct, free agent; Adjust -> Store.setAdj; test_boot/test_picks pins) — — tapping/long-pressing any player opens one
      sheet: this week (kickoff, projection + how built, matchup, injury note,
      Claude), stat line + scoring breakdown + Adjust, season average, game
      log, ESPN's written outlook, % rostered. Replaces the separate pre-game
      card / stat-line card / long-press "View stats" menu.
- [ ] **H. (#9) Inactives alert** — opt-in closed-app check ~75-85 min before
      each kickoff that involves one of his starters; warns if a starter is
      ruled OUT/doubtful. Pure scheduling logic in a plain-Java class tested
      with the desktop JDK; Alerts.java wires it.
- [ ] **I. (#10) Data -> League order** — Standings first; "Enter week N scores"
      below, collapsed until that week has kicked off.
- [ ] **J. Tests + regression + ship v8.7** (named test per item, every suite by
      exit code AND output, crawls, build).
- [ ] **K. FULL TEST (standing protocol, whole app, max depth)** after the
      features land, then ship again if it finds anything.

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

- [x] **ANSWERED 2026-09-24T19:27Z: "Add recommended features 1, 2, 3, 6, 7, 8,
      9, 10"** (+ move the Live projection card to the bottom) — now the
      current job. 4 (light theme) and 5 (league scoreboard) not picked.
      **Ideas from ESPN / Sleeper / Yahoo / FantasyPros, need
      your yes.** Reply with the numbers you want. Mockups of 1-4 were sent
      with the v8.6 message (scratchpad proposals-mockups.jpg — not shipped).
      1. **Win probability on Live** (ESPN, Sleeper, Yahoo): "you 58% · 42%
         Tugdude" bar under the projected score, moving as players score —
         from this app's own projections and the league's measured spread.
      2. **Position colours** (Sleeper): QB/RB/WR/TE/K/DEF colour chips in
         every slot column, so a lineup scans at a glance.
      3. **Compact injury badges** (Sleeper/ESPN): Q / D / O / IR pills instead
         of the full word — "QUESTIONABLE" currently wraps roster rows.
      4. **Light theme that follows the phone** (was #7 last time).
      5. **League scoreboard** (was #4): every matchup's live score, a
         collapsed card under yours.
      6. **Matchup difficulty chip** (Sleeper/Yahoo/ESPN): "vs HOU · 28th vs RB"
         in green/amber/red on Lineups/Advice/Roster rows, from the app's own
         defense-vs-position numbers.
      7. **Trending on the Wire** (Sleeper "Trending", ESPN "Most added"): %
         rostered and this week's change next to each free agent. ESPN already
         sends ownership.percentOwned/percentChange in the projection data the
         app downloads (checked 2026-09-24) — no extra request.
      8. **One player card** (ESPN 2026 player pages, Sleeper's player sheet):
         tapping any player opens one sheet — this week (projection, matchup,
         injury note, Claude), game log, scoring breakdown and ESPN's written
         outlook (also already in the downloaded data) — instead of today's
         three different pop-ups.
      9. **Inactives alert** (ESPN/Sleeper push): extend the existing lineup
         alert to warn ~90 min before kickoff when a starter is ruled out.
         Opt-in; one extra background check on game days.
      10. **Data → League order**: Standings first; "Enter week N scores" moves
          below and stays collapsed until that week has kicked off.


- [x] **ANSWERED 2026-09-23T04:13Z: "Do number 1, 2, 3, 5, 6"** — now the
      current job at the top of this file. 4 (league scoreboard) and 7 (light
      theme) were not picked; leave them unless he asks again.
      **Bigger ideas from the 2026-09-23 review — NOT done, need your yes.**
      Each is modelled on how ESPN / Sleeper / Yahoo handle the same screen.
      Reply with the numbers you want and they get built:
      1. **Roster: a number on every player.** ESPN's roster shows PROJ and
         AVG per player; ours shows only name/team/bye/kickoff. Add this
         week's projection and his season average (league scoring) on the
         right of each row.
      2. **Live: each starter's projection before kickoff.** The team totals
         now show a projected finish; ESPN/Sleeper also show each player's
         projection under his 0.0 until his game starts.
      3. **Merge Advice into Lineups (7 tabs -> 6).** Start/sit advice lives
         where the lineup is set in every big app; each remaining tab gets
         ~15% wider and easier to hit. Nothing removed, just moved.
      4. **League scoreboard.** Every matchup's live score in one list (ESPN
         "Scoreboard"). You asked for Live to be only your matchup, so this
         would go on Data -> League or under the Live card, collapsed.
      5. **Power rankings / playoff odds.** sim.js already computes season
         simulations, power and all-play records (tested, never shown). A
         small card on Data -> League, like Sleeper's playoff odds.
      6. **Quieter Drop buttons on Roster.** 17 red buttons down the page;
         ESPN puts Drop behind an edit mode or long-press. Proposal: a
         neutral "⋯" per row that opens Drop (still confirmed).
      7. **Light theme** that follows the phone's setting (currently always
         dark).

- [ ] **Decide: the live Anthropic API key rides along in Android's automatic
      cloud backup and device-transfer, in plain text.** Found in the
      2026-09-19 full-test sweep, reading `android/res/xml/backup_rules.xml`
      and `data_extraction_rules.xml` against `AndroidManifest.xml`'s
      `android:allowBackup="true"`. Those two files exclude only the
      `backups/` folder (the app's own rotating internal snapshots,
      NativeBridge's `backupAuto`) from Android's backup — they do NOT
      exclude `fftracker_state_v1.json` itself, which is where the real,
      live Anthropic key lives (`S.settings.aiKey`, written in plain text by
      `NativeBridge.save`). So on a phone with "Back up to Google Drive"
      turned on (the Android default for most users, not something Tj had
      to opt into), Google's Auto Backup for Apps uploads that file —
      including the key in clear text — to Tj's own private Google Drive
      app-data folder, and the same file goes along on a device-to-device
      transfer when he next gets a new phone. This is a DIFFERENT path from
      every place this app already went out of its way to protect the key:
      `Store.exportJSON()` redacts it before the "Export backup"/"Send to
      Claude" flows can put it in Downloads (see store.js's own "THE API KEY
      NEVER LEAVES IN A BACKUP" comment) — but that redaction only covers
      backups the APP produces on request, not the ones ANDROID produces on
      its own schedule, which store.js's comment does not mention and which
      no test in this suite checks. Severity is real but not severe: Google's
      Auto Backup is private per-app data, transmitted over HTTPS and
      end-to-end encrypted on a device with a lock screen (Android 9+), so
      this is not "any app can read it" the way the pre-v4.7 Downloads export
      was — it is a credential leaving the device through a channel nobody
      decided it should, which is still worth closing.
      NOT FIXED THIS SESSION — flagged rather than changed, because the real
      fix is an architecture change, not a one-line patch: the key would need
      to move out of the JSON blob that gets backed up and into Android
      SharedPreferences (a new small pair of `@JavascriptInterface` methods
      in NativeBridge.java, e.g. `secretSave`/`secretLoad`, backed by a
      SharedPreferences file excluded from backup via
      `<exclude domain="sharedpref" path="..."/>` in both XML files), with a
      one-time migration on `Store.init()` for anyone who already has a key
      saved the old way, and every current reader/writer of
      `S.settings.aiKey` (ai.js's `key()`/`settings()`, ui.js's `aiCard()`,
      store.js's own export/import redaction) updated to go through it — a
      real, multi-file, cross-language change with a migration path, exactly
      the shape of thing this repo's standing rule asks to surface rather
      than do silently. Your call: fix it now (a contained, well-scoped
      change, just not a one-liner), or leave the Downloads-export
      protection as the real-world mitigation it already is and accept the
      Auto Backup exposure as a known, low-severity gap.
- [ ] **Confirm v7.4 on the phone — PRIORITY, this is the QB/K-DEF waiver-wire
      fix you just asked for**:
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v7.4
      ```
      Wire tab: it should no longer suggest dropping Stafford or Bo Nix for
      a free-agent QB unless that QB has real, multi-week measured
      production AND a large (6+ point/game) edge — a bigger single-week
      number or a generic season projection alone should never be enough
      any more. K and DEF adds should not appear on the "beats a starter"
      list unless your own kicker or defense is genuinely unavailable that
      week. You should also see a new line near the top of the free-agent
      board naming your thinnest starting spots (usually RB/WR). If you
      still see a QB swap suggested off either of your two QBs, say exactly
      who the free agent was and what the app showed as the reason — that
      would be a different, still-undiscovered gap, not a repeat of the
      exact bug just fixed (see LADDER.md §41).
      **Also, about the tab-highlight glitch** ("I press Wire and it
      doesn't light up") — this was investigated carefully and no
      concrete, safely-fixable defect was found (full trace in STATE.md's
      2026-09-18 entry), so nothing was changed there. If it happens again,
      the single most useful thing to note is: does the SCREEN eventually
      catch up (the Wire content shows up a few seconds late, just the
      highlight lagged) or does NOTHING happen at all, ever, until you
      tap again? Those point at two completely different causes, and only
      a real device in the moment it happens can tell them apart.
- [ ] **Confirm v7.3 on the phone — PRIORITY, this is the fix for the
      "nonsense answers" screenshot you just sent**:
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v7.3
      ```
      Rosters tab → "How your team stacks up" → "Or use the Claude app":
      make the file, send it to a real Claude chat with no message, and
      load back whatever Claude actually replies with. It should show a
      real verdict and real recommendations, not `<...>` placeholder text.
      If you tap "2 · Load Claude's reply" and paste the WRONG file (the
      one you just made for Claude, instead of what Claude sent back), the
      app should now clearly refuse it and say so, rather than showing
      nonsense — worth trying once on purpose to see that message. If you
      genuinely get real placeholder-free garbage back, or the app still
      accepts something it shouldn't, say exactly what you did and what
      you saw — that would be a different, still-undiscovered gap, not a
      repeat of the exact bug just fixed (see LADDER.md §40).
- [ ] **Confirm v7.2 on the phone** (superseded by v7.3 above for the
      "nonsense answers" bug specifically; still worth its own look for
      everything else about the team-analysis feature itself — the card's
      layout, the live "Ask Claude" button if you have a key, the cost
      estimate):
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v7.2
      ```
      Rosters tab, below your own roster and above the trade evaluator:
      "How your team stacks up". If a recommendation names a player or
      team that doesn't look right, or credits the wrong team for a trade
      offer, say exactly what you saw — that would be new diagnostic
      information, not a repeat of the "JR" bug already caught and fixed
      before this shipped (see LADDER.md §39).
- [ ] **Confirm v7.0 on the phone — PRIORITY, this is the Chubb/Hunt-still-
      on-the-board fix you just reported**:
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v7.0
      ```
      Open the Wire tab and check: Nick Chubb, Trey Benson and Kareem Hunt
      specifically should not appear as they did in your screenshot; more
      generally, no player with zero recorded games this season should
      out-rank a player who actually played and scored just because ESPN's
      own weekly guess for him happened to be a bigger number (a
      never-played player CAN still appear on the board — that is not
      hidden — he just cannot sit above real production any more). If you
      see this again — same players or new ones, same pattern or
      different — say exactly who/what: that would be a third,
      still-undiscovered gap, not a repeat of either of the two bugs just
      fixed (see LADDER.md §38 for exactly what those were).
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
