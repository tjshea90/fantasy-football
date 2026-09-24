# TASKS — the current job, in Tj's words

## Current job (2026-09-24) — FULL TEST + WHAT THE BIG APPS DO BETTER

Tj, 2026-09-24: "Run a full test on this app and see what other popular
fantasy football apps have that may be good in this app, including ui and
appearance"

Part 1 is CLAUDE.md's "Full tests" protocol (method not repeated here), fresh
eyes on the whole app with extra weight on what v8.5 changed. Part 2 is a
research survey. Standing preference: no MAJOR change (moving/merging/removing
a tab or feature, a new feature) without Tj's yes — SMALL polish ships, MAJOR
ideas become numbered proposals under "Waiting on Tj".

- [ ] **1. Floor:** every tools/test_*.js + check_es2018.js (exit code AND output).
- [ ] **2. Static cross-checks:** every CSS class the JS builds vs app.css
      (missing + dead rules), script load order vs top-level dependencies,
      stale copy, MANIFEST.
- [x] **3. Dynamic crawl in Chromium** DONE on state G (real weeks 1-2 +
      generated schedule + Advice sync): 275 actions over 12 screens, 0 page
      errors, 0 error cards. Screenshots of every tab read. No real device.
- [x] **4. Review the v8.5 diff adversarially** DONE — Gamelog dirty/flush,
      afterPaint/fillAfterPaint, Names.cmp (ICU tie/case/punctuation order
      re-derived), freshenSchedule stand-down (tick always fetches the
      scoreboard; busy re-arms in 15 s): no defects.
- [x] **5. Data retention + network + battery** DONE — findings F9, F10,
      F11 below. Sleep path (pause flushes Store+Gamelog, pauseTimers, no
      wakelocks) unchanged and fine. Scoreboard poll 22 KB gz, fine.
- [x] **6. Engine/logic spot-checks vs RULES_2026.md** DONE (see F14 + spot-check box below).
- [ ] **7. Research: ESPN, Sleeper, Yahoo, NFL Fantasy, CBS, FantasyPros,
      Underdog** — features and UI/appearance worth borrowing; split into
      SMALL (do now) vs MAJOR (numbered proposals for Tj).
- [ ] **8. Fix everything found + do the SMALL items**, each with a named test
      confirmed to FAIL pre-fix (source-text pin where no harness reaches).
- [ ] **9. Full regression** (exit code AND output) + Chromium smoke.
- [ ] **10. Ship**, publish the Release, send Tj the link + the proposals.

### Findings so far (not yet fixed — fix in step 8)
Test state for all of this: `perf.js --sync 1,2 --save F`, then
`--state F --eval "Recap.generateSchedule({force:true}); Store.save()" --advice --save G`
(new `--eval` option in perf.js; the seed has NO matchups, so without it Live
is just "No opponent set").
- [x] FIXED (test_picks 'full test 2026-09-24: copy and layout') F1 Live "Set up week N matchup" does goTab('data') — lands on whatever Data
  sub-screen was last open (Claude/Sync/App), not League where matchups live.
- [x] FIXED (test_picks: no bare 'the Data tab'; test_boot pointer check now 14) F2 pointers not in "Data → Screen → Control" form, so test_boot's pointer
  check misses them: recommend.js "add one on the Data tab", ui.js 'Data tab,
  "Claude"' (x2), Live/Lineups "Add this week's matchup on the Data tab".
- [x] FIXED (test_picks pin) F3 Roster row reads "DEN · bye 10 Sun 8:20p" — no separator before the
  kickoff badge, so it reads "bye 10 Sun".
- [x] FIXED (test_picks 'an inactive starter whose game is over', 3 checks) F4 Live: a starter whose game is FINAL with no line (inactive) still counts
  in "N yet to play", keeps the pending style and shows "p 14.2" under 0.0 —
  projectedFinish() already excludes him, the rows/count do not.
- [x] FIXED (test_picks 'Reset to auto resets THAT team only') F5 Lineups per-team "Reset to auto" calls autoFillWeek() = refills EVERY
  team in the league, even with Auto-default OFF. Should be that team only.
- [x] FIXED (test_picks 'odds when future matchups were never entered'; full schedule verified byte-identical to v8.5) F6 Power card playoff odds: unplayed weeks with no matchups entered are
  treated as never played → ">99%" / "0%" after 2 weeks. Unentered pairs
  should be drawn at random per simulated season (identical output when the
  schedule is complete).
- [x] FIXED (test_picks) F7 header says "Rosters", tab says "Roster".
- [x] FIXED (test_boot pin updated: clamp + tap to open) F8 Wire injury card: ESPN's note is an unclamped ~10-line paragraph.
- [x] FIXED (test_retention.js §1, 3 checks fail on v8.5) F9 DATA LOSS: Live player card "Adjust" -> Save does `line.manualAdj = x;
  Store.save()` — stat lines live in the ARCHIVE file, which save() writes
  only when archiveDirty (markArchive). Nothing marks it, so on a final week
  (no more syncs) the adjustment never reaches disk and is gone on the next
  cold start. Fix: Store.setAdj() that marks the archive.
- [x] FIXED (test_retention.js §2: v8.5 = 80 archive writes + 8 backups per live hour) F10 WRITE STORM (same class as v8.5's gamelog fix): every quiet live-poll
  doSync (45 s while any game is in progress) calls setBook -> archive
  rewritten whole (~200 KB now, ~1.5-1.9 MB late season) + main state; and
  each of those saves counts toward the every-10-saves autoBackup (~1.5 MB
  snapshot, 8 kept) — an hour of live polling rotates out EVERY older backup.
  Fix: in-progress quiet syncs mark the archive lazily (written <=5 min
  later / on flush / at once when final or on a manual sync) and do not
  count toward the backup cadence.
- [x] FIXED (test_jsonslim.js, 37 checks: desktop-javac JsonSlim vs real records + edge cases + malformed + loadNews raw==slim; full live feed 799 records identical, 8.76 MB -> 0.91 MB) F11 SPEED/MEMORY: ESPN /injuries is 8.76 MB of JSON (355 KB gzipped);
  8.76 MB of it is athlete.links (player-card URLs the app never reads).
  The page pulls it over the bridge in 46 x 192 KB chunks and JSON.parses
  it: 45-145 ms at 4x on the JS thread + ~17 MB string + parse garbage,
  every 10 min while the app is open (freshenInjuries on the live poll),
  on every Advice sync and every "Ask Claude about the wire". Fix: the Java
  bridge drops `links` members on the pool thread before the page sees the
  body (opt-in request header X-FFT-Drop-Keys, never sent to ESPN; any
  failure returns the raw body). New plain-Java JsonSlim class so it is
  testable with desktop javac against real feed records.
- [x] FIXED (test_picks) F12 Advice recommended-lineup rows read "Jonathan Taylor Sun 1p RB IND vs
  HOU" — kickoff before pos/team, unlike every other screen.
- [x] FIXED (test_picks) F13 Advice "How this is calculated" says "Tap any player to see each
  source's number" — Advice rows have no tap handler; it is the "why ▾".
- [x] FIXED (tools/test_syncfail.js, 16 checks, 8 fail on v8.5) F14 DATA LOSS
  (found by the engine spot-check step: my week-1 harness sync had 1 of 16 box
  scores time out and the week was still stored synced+final): doSync wiped
  EVERY line of the week and rebuilt from what arrived, so one failed box
  score zeroed that game's players (a Tuesday re-sync on a flaky connection
  destroyed correct lines), and every game being over the week was stamped
  final — never retried. Now: a team whose game did not arrive keeps its
  lines + book rows; no bonus pass on a week with a hole (flags carried);
  final only when complete (or already complete before); otherwise stays
  open, header says "N box score(s) missing", closing sync retries.
- [x] FIXED (test_picks 'a failed projection fetch', 4 checks; v8.5: 42 requests in 0.5 s) F16 BATTERY/NETWORK LOOP:
  on the Wire tab with no signal (or an ESPN/Sleeper outage) the season-
  projection refresh failed -> render() -> refresh again, with no cooldown:
  ~88 ESPN + 88 Sleeper requests, as many full Wire renders and cache writes
  in 2 s, for as long as the tab stayed open. Now: one attempt in flight,
  10-min retry cooldown for background callers (a sync he starts, opts.user,
  still goes out), and the Wire tab re-renders only when a new set landed.
- [x] FIXED (same block) F15 DATA LOSS: Projections.refresh / refreshSeason
  replaced this week's (this season's) already-loaded projections with an
  EMPTY set whenever every source failed — one pull-to-refresh with no
  signal and every lineup call fell back to rough averages. Now the set on
  hand is kept (its real age still shows) and the sync report says
  "FAILED this time — kept the set from N min ago".
- [x] FIXED (test_retention.js §3, 6 checks, 5 fail on v8.5) F17 ACCURACY:
  one failed injury-feed fetch (a blip on the 45 s live poll, no signal)
  replaced the saved injury list with an EMPTY one and wrote it to disk —
  every OUT/IR player then looked healthy to auto-lineup, Advice and the
  Wire board until a later fetch worked (the Wire card even said "showing"
  the old records). Now the last good list is kept with its real age + the
  error; the poll retries next tick; re-render only on new data / first
  failure.
- [x] Step 6 engine spot-checks DONE: 7 fresh week-2 lines hand-computed vs
  RULES_2026.md — Nix 41, Schultz 26, Swift 12.9 (fumble -2), Bates 7,
  Texans D 15 (5 sacks, 20 PA tier), Wan'Dale 1.9, Goff 67.05: all exact.
  Weekly +5s went to the league-wide longest rush/rec both weeks.
- [x] SMALL polish from the survey, DONE: live game clock on the badge
  (test_schedule), playoff cut line in Standings (test_picks).

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
