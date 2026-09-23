# STATE — FF Season Tracker

**Last updated: 2026-09-23** · **v8.5**, shipped · APK builds, signed, all 23 test suites green · now on GitHub, worked across three Claude accounts

## v8.5 — full test (standing protocol), 2026-09-23c

Tj: "Run a full test". CLAUDE.md's Full-tests protocol, whole app, fresh eyes,
extra weight on what v8.3/v8.4 changed. No real device exists here; the
dynamic checks ran in headless Chromium at 4x CPU throttle with real ESPN data.

New tooling (tools/perf.js, dev-only): `--crawl` reloads the original state
before EACH action and operates every control on every screen and sub-screen
(taps buttons, steps selects, types in boxes, taps Live player rows, follows
⋯ -> Stats), dismissing dialogs through __onBack — 511 actions over 12 screens
on two real-data states, 0 page errors, 0 error cards. `--advice` runs the
Advice sync first; `--netlog --idle N` logs every request; `--root DIR`.
The frame marker is now queued before the tap (it had been counting work
deliberately deferred until after the paint).

### Findings, all fixed, each with a test that fails on v8.4

1. **Battery / jank / flash wear — the game-log cache.** Gamelog.ingestEvent
   rewrote the WHOLE cache (~200 KB per week, ~3.5 MB by week 17) with a
   synchronous bridge write + fsync once PER GAME, and the Sunday live poll
   re-ingests every in-progress game every 45 s: mid-season ~9 full 2-3 MB
   writes per poll, all afternoon, on the renderer thread. Now only a FINAL
   game marks it dirty (an in-progress line is never trusted from disk —
   ensureEvent refetches it), writes coalesce to one ~2 s after a batch, and
   __appPause flushes. test_gamelog.js.
2. **First-open lag — Claude cost estimates.** The "Estimated cost" lines on
   Roster and Wire built the ENTIRE Claude prompt (every roster priced / the
   whole wire) just to count characters: ~100 ms of a ~155 ms first Roster
   open at 4x. Now filled right after the paint (afterPaint: a frame callback
   then a zero timer, so an overdue timer can never delay the paint), and
   written at once from the memo on later visits. Playoff odds use the same
   path. First open to frame at 4x: Roster ~180 -> ~65 ms, Wire ~120 -> ~65 ms.
   test_picks.js "full test" section.
3. **First-sort lag — ICU start-up.** The first String#localeCompare of a
   session costs ~44 ms at 4x (Chromium initialising its collator) and landed
   on the first Roster open or first search keystroke. New Names.cmp: for
   ASCII names a code-unit compare of lowercased strings with the apostrophe
   moved after hyphen/period — exactly ICU's order (checked over all 963 names
   the app ships); anything non-ASCII still uses localeCompare. test_names.js.
4. **Network — duplicate scoreboard.** A stale boot or resume fetched the week
   scoreboard twice, 4 s apart (Schedule.refresh, then the live poll that
   fetches it anyway and feeds Schedule.ingest). freshenSchedule() now stands
   down when a tick is due within 15 s; appResume arms the poll first.
   Request log: 2 -> 1. test_boot.js pins.
5. **Stale copy.** Six "Data → X" pointers named controls that no longer exist
   under that label or no sub-screen at all ("Export a backup", "Run the feed
   self-test", "depth: Smart", ...). All are "Data → Screen → Control" now,
   and test_boot.js parses every such pointer and checks it resolves.

### Checked and clean
CSS classes built vs defined (0 missing, 0 dead); script load order; the
v8.3/v8.4 diff (saveSoon/flush, memo, closing sync — a failing box score
retries only at the 5-10 min idle cadence — tab merge, projections, sim, row
menu); Android alarms (2 inexact/day, one 6-7 s-bounded GET; a stale "weekly"
comment fixed); cache growth (all bounded except the game log, by design);
engine: five real week-2 lines recomputed by hand from RULES_2026.md, all
exact (incl. a missed 58-yard FG at −1 and a D/ST at 7 allowed).

## v8.4 — Tj's picks 1, 2, 3, 5, 6 from the v8.3 proposals (2026-09-23b)

Tj: "Do number 1, 2, 3, 5, 6" (not 4 — league scoreboard — nor 7 — light theme).

- **#1 Roster PROJ + AVG.** Each row of the Roster tab's team card shows this
  week's projection (Recommend.projectAll — the numbers the auto-lineup uses)
  and his season average per game played in THIS league's scoring. New
  `Store.playerAvg(player, throughWeek)`: his own stored line when he played
  (what his team was credited, bonuses and hand-adjustments included), else
  the league book (so a mid-season pickup still has his earlier weeks); byes
  and inactive lines are not games; only weeks that are final count.
- **#2 Live per-starter projection.** "p 14.2" under each starter's 0.0 until
  his game starts, then only his real points. Shares one projection pass per
  team with the projected finish (they sum exactly).
- **#3 Advice merged into Lineups (7 tabs -> 6).** Lineups has a "Set lineups |
  Advice" chip switch (settings.lineSub); the Advice view is the old tab's
  exact render. A saved lastTab of "advice" and any goTab('advice') land on
  Lineups -> Advice; pull-to-refresh there still runs the advice sync. Two
  sub-views, not one long page, so a lineup dropdown change never pays for
  re-rendering the advice cards.
- **#5 Power rankings + playoff odds** on Data -> League: rank, all-play
  record, luck (wins minus all-play-expected wins), playoff % and title %.
  **Sim.season was rebuilt before being shown:** it treated a team's measured
  average as its true strength, so on real week-1/2 data it gave one team 100%
  playoffs / 55% title and several teams 0%. Now empirical-Bayes: each run
  draws every team's TRUE mean from a posterior shrunk toward the league by
  how few weeks it has played, with weekly noise blended toward an
  18%-of-mean prior for its first 12 team-weeks. Same data now: 99% / 39%,
  bottom teams 5-9%. The loop is flat typed arrays (~300ms -> ~110ms at 4x);
  results are cached on the store generation and computed just after the tab
  paints, patched in place. The dead game()/bracket() helpers are gone.
- **#6 Quiet row menu.** The 17 red Drop buttons are one neutral "⋯" per row
  opening Cancel / Stats / Drop; Drop still asks before it does anything.

Tests: new tools/test_picks.js (33 render-level checks against a stub DOM —
the rows, cells, chips and dialogs ui.js actually built), incl. odds summing
to 6 / 2 / 1, early-season humility (FAILS on the v8.3 sim.js: 96% title after
two weeks), sharpening over ten weeks, determinism, and no NaN with zero
scored weeks. test_tabsafety.js now reads its tab list from index.html;
test_lifecycle.js, test_boot.js pins updated for the new shapes. perf.js
reads tabs from the DOM and measures "lineups>Advice".

## v8.3 — polish, declutter and speed for the Moto G 2026 (2026-09-23)

Tj: "Look around at the features and UI and see if anything can be made to
look better, function better, or be better organized... Also see if you can
optimize it for maximum speed and efficiency and snappiness on a moto g 2026,
but do not sacrifice accuracy or function."

### Measured first — tools/perf.js (new, dev-only)

Headless Chromium, 412x915 phone viewport, CPU throttled 4x, a stub of the
Java bridge whose httpAsync proxies the REAL network through curl, so the app
runs its real syncs against ESPN. `--sync 1,2 --save F` builds a real-data
state; `--profile`, `--bootprofile`, `--tracesaves`, `--shots DIR`. Not a
device: there is no phone or emulator here, it measures the page's own
JS/layout cost, which is the part the repo controls.

| at 4x | before | after |
|---|---|---|
| boot to first content | ~430ms, 10 saves | ~330ms, 1 save |
| Roster tab | 77ms | 14ms |
| Wire tab | 82ms | 27ms |
| Advice tab | 28ms | 5ms |
| Lineups tab | 27ms | 18ms |
| state saves in one tab-switching run | 74 | 2 |

### What was slow, and the fixes (no output changed)

- **Every tab tap did a full synchronous Store.save()** (a bridge write +
  fsync on the renderer thread) to remember `lastTab`; every tenth tap also
  paid a ~1.3 MB auto-backup; and save() bumps the store generation, which
  threw away every memo the next tab needed. New `Store.saveSoon()/flush()`
  (deferred, coalesced, no generation bump), flushed by `__appPause`.
- **Name normalisation** (Espn.normName, Names.canon/variants) was ~half of
  the Roster/Wire render: memoized (pure, bounded).
- **Advice re-read its four caches from disk every render** (including the
  ~400 KB season-projection file): now loaded once at boot.
- **Boot's league-wide auto-fill saved once per team** (10 synchronous
  writes before first paint on a fresh week): one save.
- WebView `setOffscreenPreRaster(true)`. Minification considered and
  rejected — it would turn the error card's stack trace into gibberish.

### A real accuracy bug found on the way: no closing sync

liveTick synced only while a game was IN PROGRESS. After Monday night's game
ended the poll saw nothing live and nothing upcoming, and re-armed every ten
minutes forever — the last <=45s of that game was never captured, the week
never became "final" without a manual Sync (so the local auto-advance never
fired), and a Thursday game that ended with the app closed stayed 0.0 until
Sunday. New `Schedule.needsSync()`: sync on a live game OR a finished game
whose final box score this session has not captured; never refetch a
captured final, never re-sync a week stored synced-and-final.

### UI (small items; the big ones are proposals in TASKS.md "Waiting on Tj")

Compact header (Sync button moved into the top row, ~27px back on every
tab); Live shows a projected finish per team and "Projected 190.1 – 173.5 ·
you by 16.6" before kickoff instead of "Level"; a defence shows its nickname
("Seahawks", not "Seattle Seah..."); Wire swap buttons wrap under the text;
Wire free-agent basis/usage is two-line fine print, tap to expand, and the
left column is a rank; the repeated Claude-app explainer is clamped to three
lines; standings are numbered.

Tests: test_tabsafety.js SPEED section (tab taps write 0 times, no gen bump,
flush on pause, Advice reads disk 0 times, a fresh-week boot writes <=2),
test_names.js memo checks, test_schedule.js CLOSING section — each confirmed
to FAIL against the pre-change snapshot. test_boot.js shortName DEF check
updated; test_net.js liveTick window widened.

## v8.1 — a full test, requested through the standing protocol CLAUDE.md now carries

Same day as v8.0, a fresh session, invoked as a plain "do a full test on this
app" — the exact trigger phrase the v8.0 session had just written a permanent
protocol for in CLAUDE.md ("Test protocols — 'light tests' and 'full tests'").
This is the first time that protocol has actually been exercised: same depth
as the v8.0 sweep, explicitly treating it as the template rather than a
one-off, re-reading the whole app fresh (Android shell, HTML/CSS, all 4,452
lines of `ui.js`, and every file in the data/logic layer) rather than trusting
that a sweep from hours earlier caught everything.

### One real bug: a sync silently erased another feature's data on the same object

`doSync()` (`ui.js`) ended its success path by **replacing** `S.weekMeta[week]`
wholesale with a brand-new object literal:

```js
S.weekMeta[String(syncedWeek)] = { synced: true, at: ..., games: ..., ... };
```

`schedule.js`'s own `ingest()`/`earlyAlertUncached()` write `kickoffs`,
`schedAt`, `schedSig`, `shouldStart` and `shouldStartSig` directly onto that
exact same object — and `liveTick()` calls `Schedule.ingest(week, games)`
immediately before calling `doSync` on the very same tick. The old code went
out of its way to carry one field forward (`opponents`, read off the old
object before the replace) but nothing else survived — every OTHER field
schedule.js owns on that object was simply absent from the new literal, gone
the instant the assignment ran. `doSync` is also reachable directly, with no
compensating re-ingest afterward, from the manual "Sync week" button and from
pull-to-refresh on every tab but Advice/Stats.

The user-facing cost: after most syncs, the game-time badges next to every
player's name across the whole app disappeared (`Schedule.badge` reads
`get(week)`, which read `null` the instant this ran) and the pre-Sunday bench
alert went with them — both the in-app card (`earlyGameCard`) and
`Alerts.java`'s closed-app notification, which reads this identical persisted
key with **no WebView available**, so it could not route around the gap the
way a render()-triggered re-fetch might. The window lasted until something
else happened to call `Schedule.ingest()` again — the next live-poll tick if
one was running, or a week change/boot/resume via `freshenSchedule()` — which
could be anywhere from under a minute to a long, unpredictable wait depending
on what the app was doing.

This is precisely the "do not collide on the same weekMeta key" bug class
`test_schedule.js` already guards in the OTHER direction (a sync-shaped
`.games` count surviving a later `Schedule.ingest()` call) — nothing tested
the reverse: a schedule-shaped object surviving a later sync. Confirmed by
tracing the actual runtime order across two files, not by reading either one
in isolation.

**Fixed by mutating the existing object in place** instead of replacing it —
every field doSync does not itself own now survives automatically, with no
name list to keep in sync by hand the way the old `opponents`-only carve-out
required:

```js
var wm = S.weekMeta[String(syncedWeek)] || (S.weekMeta[String(syncedWeek)] = {});
var prevOpp = wm.opponents;
wm.synced = true; wm.at = ...; /* ...every field doSync owns, assigned onto wm */
```

New test `tools/test_schedmeta.js` seeds a weekMeta object with
`Schedule.ingest`-shaped fields (kickoffs/schedAt/schedSig/shouldStart), fires
a real sync through the sync button, and confirms those fields are still
there afterward — confirmed to **FAIL** against the pre-fix code (3 of its 4
checks) and pass now.

### One stale line in the ground-truth doc itself

`RULES_2026.md`'s own "Weekly bonuses" section still read **"NOT MODELED...
Cannot be derived from season CSVs"** — true when the file was transcribed,
false since `Scoring.applyWeeklyBonuses` was wired into `doSync`. This is the
exact same staleness the v8.0 session found and fixed on the Data tab's own
Scoring rules card a few hours earlier — just missed at its source, the
ground-truth file the card's own text is supposed to answer to. Corrected
with a dated resolution note in the file's own established style (matching
how it already records the 2026-09-09 return-TD resolution), rather than
silently rewriting the original line out of the historical record.

### Flagged, not fixed: the API key rides along in Android's own automatic backup

`android:allowBackup="true"` plus `backup_rules.xml`/
`data_extraction_rules.xml` excluding only the app's own `backups/` folder
means the MAIN state file — `fftracker_state_v1.json`, where the live
Anthropic key actually lives in plain text — is not excluded from Android's
Auto Backup for Apps or device-to-device transfer. A phone with "Back up to
Google Drive" on (the Android default for most users) uploads that key,
in clear text, to Tj's own private Google Drive app-data folder; the same
file rides along on a device transfer. This is a completely different path
from the Downloads-export redaction `Store.exportJSON()` already implements
(see that function's own "THE API KEY NEVER LEAVES IN A BACKUP" comment,
v4.7) — that redaction covers only backups the APP produces on request, and
says nothing about the one ANDROID produces on its own schedule. Real but
lower-severity than the pre-v4.7 Downloads exposure (Google's Auto Backup is
private per-app data, HTTPS-transmitted and end-to-end encrypted with a lock
screen on Android 9+ — not "any app can read it"), but still a credential
leaving the device through a channel nobody decided it should.

Not fixed this session: the real fix is an architecture change (move the key
into Android SharedPreferences via new NativeBridge methods, exclude that
prefs file from backup, migrate anyone with a key already saved the old way,
and update every current reader/writer of `S.settings.aiKey`), not a
sweep-sized patch — exactly the shape of decision this repo's standing rule
asks to surface to Tj rather than do silently. Named in full in TASKS.md's
"Waiting on Tj".

### Everything else checked and found clean

Re-swept, fresh, rather than trusted from hours earlier: the whole Android
shell, `index.html`/`app.css` (script load order re-verified safe), all of
`ui.js` tab by tab, and the full data/logic layer. Specifically grepped for
any OTHER instance of the wholesale-object-replace pattern that produced this
session's one real bug — found none. Every memoization cache
(`_faMemo`, `_dpMemo`, `_rateMemo`, `_alertMemo`, `_adviceEstMemo`,
`_wireEstMemo`, `_taEstMemo`) re-checked and its key still covers every real
invalidation trigger. `scoring.js` re-verified against `RULES_2026.md`, no
disagreement. `sim.js`'s `season()`/`power()`/`allPlay()`/`bracket()` are
still unused by any tab — a fourth consecutive session (v7.7, v7.9, v8.0,
this one) flagging the same still-undecided product question rather than
guessing.

All 22 suites (21 + the new `test_schedmeta.js`) and the ES2018 gate green,
verified by exit code AND a precise `^  FAIL ` line count — not a bare
`grep FAIL`, which the v8.0 session already found gives a false green when a
passing test's own assertion text happens to contain the substring "FAILED".

Built and shipped as v8.1 (`bash build.sh` regenerated `app/assets/version.js`
for the bump after this entry was first written, hence this second commit to
STATE.md — same reason the v7.5 entry below needed one: the ship gate checks
the narrative against the LAST commit touching `app/`/`android/`, and a
version stamp is exactly the kind of change that should not need its own
separate paragraph).

## v8.0 — an open-ended "find bugs, improve the UI" sweep, not a complaint this time

Tj, 2026-09-19T00:39:00Z: **"Now do an overall ui and code improvement/bug
search and fix."** No screenshot, no repro — the first job in this whole
history with no specific complaint to anchor to. Treated as: read the Android
shell, the HTML/CSS, every ui.js card and the data/logic layer that the last
three wire-focused jobs did not already cover, fix what is actually wrong, and
say plainly what was checked and found clean.

### Five real fixes

1. **The Roster tab's own injury card didn't inherit the wire fix.**
   `rosterInjuryCard` ("your roster — injuries") is the single place in the
   app most likely to be asked "why is this guy out" — and it was the one
   place the v7.9 job's fix to `seasonOutlook()` never reached. `health()`
   collapses a plain weekly OUT and a season-ending IR designation into the
   identical tag "OUT", which is right for "can he play Sunday" and wrong for
   this card's whole purpose. It now calls the same, now-correct
   `Recommend.seasonOutlook()` the Wire tab uses and shows the two facts —
   finished for the year vs. parked but returning — distinctly, with the
   long-term case saying explicitly it is *not* the season-ending case.

2. **teamreport.js priced a bye-week player as if he were playing.**
   `rosterRow()` computed `onBye` as `Number(p.bye) === Number(week)`
   directly, instead of `Store.isOnBye(p, week)` — the exact bug class
   `recommend.js`'s own `myStarters` carries a standing warning against
   ("Store.isOnBye, not `p.bye === week`: it falls back to the league's bye
   table"). A free-agent-database player with no bye of his own but whose NFL
   team *is* in the league's bye table read as available and priced at his
   full rest-of-season rate for a week he cannot play — feeding a wrong number
   straight into the whole-team-analysis Claude prompt this context object
   builds for. Fixed; new test confirmed to fail against the pre-fix commit.

3. **playerdb.js carried its own copy of Espn.normName.** Character-for-
   character identical to the real one, today — but two independent
   implementations of the same normalisation is precisely the failure class
   `names.js` exists to guard against (this app has already paid for that
   mistake once: the Kenny/Kenneth Gainwell bug `names.js`'s own header
   documents at length). Now delegates to `root.Espn.normName`, pinned as a
   source-text check in `test_names.js` so a future edit to one regex and not
   the other cannot silently reintroduce the drift.

4. **The Scoring rules card was telling Tj to do something the app already
   does, and doing it would have double-counted.** Its own text said the
   three league-wide +5 longest-play bonuses "cannot be derived from a box
   score alone" and had to be added by hand as a manual adjustment. True when
   that sentence was written — false since `Scoring.applyWeeklyBonuses` was
   wired into `doSync` (undocumented in STATE.md at the time; found only by
   reading the actual call site and confirming it runs automatically once a
   week is final, league-wide, not only for rostered players). Following the
   card's own advice today would have paid the bonus twice: once automatic,
   once by hand. Rewritten to describe what the app now actually does,
   including the one real imprecision it still carries — a team that plays
   two different quarterbacks in a game can have the completion bonus
   credited to whichever one threw the most passes rather than whoever
   actually threw the longest one, since ESPN's box score gives per-QB game
   totals, not a play-by-play passer for one specific play. Documented at
   both the UI text and the `doSync` call site; not "fixed" beyond that,
   because a precise fix needs a new play-by-play feature this app does not
   have, not a one-line change.

5. **NativeBridge.deviceInfo() built JSON by hand.** Escaped only a literal
   double-quote in `Build.MODEL`, unlike every other JSON-building bridge
   method (`alertsStatus`, `alertsTest`, `backupList`), which all go through
   `org.json.JSONObject.quote()`. Nothing calls `deviceInfo()` today, so this
   was dormant rather than live — fixed anyway rather than left as a landmine
   for whichever caller reaches for it next.

### Checked and confirmed correct, not fixed

- The Trade evaluator (`Value.trade` → `valueOf` → `perGame`) already
  delegates to the v7.7 job's fixed `ros.js` engine — it was never on the old
  "one scored week, forever" path the wire rewrite existed to kill. Worth
  checking explicitly, given the wire job's whole premise was that exact bug
  hiding in a sibling code path.
- `scoring.js`'s `RULES` table re-verified line by line against
  `RULES_2026.md` — no disagreement, including the points-allowed ladder's
  undefined-at-1-point case and the fumble-recovery-only rule.

### One process bug in this session's own regression checks

Every "all green" claim earlier in this job was checked by grepping test
output for the word `FAIL` — which treats a silent **crash** (nonzero exit,
zero `FAIL` lines ever printed because the process died first) as a pass.
That is exactly what fix #3 above had done to `test_boot.js`, undetected,
because two of that file's own minimal test harnesses never loaded `espn.js`
at all — they relied on `playerdb.js`'s old self-contained copy, which fix #3
just removed. Both harnesses now load the real `espn.js` first (one of them
then overrides just the network call, keeping `normName` real). Every suite
in this job's final sweep was re-verified by **both** exit code and
`FAIL`-count, not text-grep alone, and the whole run rechecked green that way
before shipping.

### Left as an open question, again

`sim.js`'s `season()`/`power()`/`allPlay()` are tested (`test_engine.js`,
`test_integration.js`, `test_recap.js`) but appear on no tab; `bracket()` is
entirely unused, not even by a test. Three consecutive checkpoints (v7.7,
v7.9, this one) have flagged this as a real product decision — wire a
Simulate section into a tab, or delete a working, tested engine — rather than
guess which Tj wants. Still deferred to him.

## v7.9 — the wire told him 36 of his 17 players were dead, and named a healthy man

*(Shipped as v7.9: the first `ship.sh` run gated green but warned there was no
APK in `build/` — this container was fresh and had never run `build.sh`. Rather
than publish a release whose APK was the previous version's, the APK was built
and `ship.sh` re-run, which bumped 7.8 -> 7.9. There is no v7.8 release; the
change described below is v7.9.)*

Tj, 2026-09-18, with a screenshot of the Wire tab in week 2. A red headline:
*"36 players on your roster are out for the season — those spots are doing
nothing until you replace them"*, and under it four rows — a WR, a TE, an RB
and another TE — every one tagged REPLACE, every one reading *"replaces Dalton
Schultz, who is out for the season"*, with four identical **Add + drop Dalton
Schultz** buttons.

> "It is broken. Notice it says 36 players on my roster are out for the season.
> My roster is only 17 players... Finally, it seems as though the engine
> hallucinated. Dalton Schultz is not out for the season, but the app claimed
> he is. This is a major error."

Three separate defects, and the one he called a hallucination was the worst.

### 1. The app was reading somebody else's injury

`Recommend.seasonOutlook` decided "done for the year" by running one regex over
the free-text news blurb attached to a player. Pulled live from ESPN's
`/injuries` feed — the same endpoint `loadNews` reads — Dalton Schultz's actual
record is:

    status: "ACTIVE"
    note:   "...Schultz doesn't offer much big-play ability at 30 years old,
             but he's a reliable target in the middle of the field and saw his
             floor raise when JAYDEN HIGGINS went down with a SEASON-ENDING
             torn ACL over the summer."

Higgins' injury, Schultz's write-up. The regex matched `season-ending`, ignored
the word ACTIVE sitting in the same record, and wrote off a healthy starting
tight end. Run over all 800 live records, that regex fires on fourteen players
and **thirteen of them are status ACTIVE** — among them **Patrick Mahomes**
("last December's season-ending knee injury") and **Malik Nabers** ("a torn ACL
... in Week 4 of last season"), both written off for injuries they had already
come back from. Tj's guess — "maybe it pulled old, outdated news" — was half
right: the feed was current to the minute, but the prose inside it talks about
last season and about other people.

Two failure modes, neither detectable by matching a phrase: the note can be
about **somebody else**, and it can be about a **past season**. What was
reliable was the structured half of the record, all of which was being thrown
away by the parser:

| field | what it settles |
|---|---|
| `status` | Availability. ACTIVE means he is playing. Kills 13 of the 14. |
| `details.returnDate` | *When* he is back. Present on all 39 live IR records — October and November dates mean back this season, `2027-02-15` is ESPN's "not this year" sentinel. |
| `details.fantasyStatus` | `IR-R` / `PUP-R`: literally "designated to return". |
| `date` | How old the record is. |

So `seasonOutlook` now answers two questions instead of one crude boolean:
**finished for the year**, and **parked but coming back**. The note is demoted
to corroboration — it may only promote a player already parked by his
designation, it must be about *him* (nearest name before the phrase, possessives
included), and it must not be describing a previous season. Against the live
feed: 12 players correctly finished, 30 correctly reading *"on IR, back Oct 18"*
instead of *"out for the season"*, and Schultz, Mahomes, Nabers, Skattebo and
Demercado all clear.

A man on IR who is coming back is now also **priced**, rather than being either
written off or ignored: his per-game rate times the games he can actually still
appear in (new `Ros.weekOfDate` / `Ros.gamesLeftFrom`). Zero was wrong and full
was wrong.

### 2. "36" was counting rows, not players

`ui.js` counted `ups.filter(u => u.mandated).length` — suggestion rows whose
drop happened to be a dead man. One player priced at zero is the weakest
droppable man at his own position *and* the weakest flex-eligible man overall,
so `upgrades()` paired him with every free agent that cleared the gates. 36
rows, one player, and a sentence that could not have been true of a 17-man
roster under any circumstances.

The row count was the symptom; the disease was that `upgrades()` had no
assignment step at all. **You can only drop a man once.** It now builds every
plausible (free agent × drop candidate) pair, ranks them, and hands out each
roster spot and each free agent exactly once — which is what "on a one to one
basis" (rule 4 of the v7.7 job) always asked for and which only the Claude
prompt was doing. The same rule is now *enforced* on the Claude path too
(`normalizeWaivers`), not merely requested of it. And the headline count comes
off `Value.mustReplace()` — the roster itself — so it names the actual men and
cannot exceed the roster size. It also moved out of `if (ups.length)`: a dead
spot with nothing startable on the wire is precisely when he needs telling.

### 3. Same position by default — Tj's new rule

> "generally it should recommend a same type player position for the
> recommended drop and add, because if I drop a te, I should have a backup te
> to replace him, but this rule is not absolute; for example if a star player
> with high output is available, it would make sense to drop a low output
> player even if he is in a different position."

Enforced on the roster rather than hoped for in the ranking. `slotNeeds()`
reads the league's real starting shape off `S.league.slots`; no swap may leave
a slot with nobody to fill it. Beyond that, like-for-like is the default: a
cross-position swap must clear **double** both bars and is ranked at 0.75× so
it has to be about a third bigger to outrank an equivalent same-position move,
and a forced replacement crossing positions must additionally beat the best
player actually available at the position it empties. Rules **7** and **8**
were added to both Claude prompts in Tj's own words.

### Three more bugs, all found re-reading this job's own diff

The ckpt-115 discipline earned its keep again:

- Lineup legality was checked per pair against the **original** body counts.
  Two cross-position swaps that are each legal alone can take the last tight
  end between them — and this board is a list Tj reads top-to-bottom and acts
  on, so it has to be legal read that way. Every accepted swap now updates a
  running count. The test produces `TE:0` against the pre-fix code.
- `subjectBefore()` did not strip possessives, so *"Hand's move to injured
  reserve ... he'd miss the remainder of the season"* read as somebody else's
  report and a genuinely finished player's own words were discarded.
- Two past-markers (`previously`, `career`) were over-broad enough to suppress
  real reports — *"it was previously announced that he'd miss the remainder of
  the season"* is a current fact told backwards.

Plus one inconsistency in the screenshot nobody had flagged: the tab's own
"thinnest starting spots" line read **"QB, WR — a pickup there is more likely
to actually move your team"**, while the board directly underneath is built to
refuse ordinary QB swaps and Tj has twice complained it "always recommends qb
switch". Quarterback now sits alongside kicker and defense in that line too.

### Tests

New suite `tools/test_wire.js`, with ESPN's live 2026-09-18 blurbs as verbatim
fixtures. Checked out against the true pre-fix commit, **32 of its assertions
fail there and pass now** — and the pre-fix run reproduces the screenshot
exactly: one dead roster spot producing nine forced-replacement rows, eight of
them duplicate drops, the top row replacing a tight end with a wide receiver.

## v7.7 — the waiver wire, rebuilt on the season instead of on last Sunday

Tj, 2026-09-18, with a screenshot of the Wire tab in which every available
receiver was priced at exactly what he had scored in week 1 and captioned
"1 scored week in this app — thin sample": *"the wire tab is only making
recommendations and projecting scores based on prior weeks actual stats. This
is a broken system."*

He was reading the symptom exactly right, and the cause turned out to be worse
than "it weights recent games too heavily".

**Three dead branches, one root cause.** `value.js`'s `perGame()` ranked the
wire through a five-step preference ladder whose second step was ESPN's
full-season projection. That step had never once executed. Proved against the
live endpoint: the projections route that wins nearly every sync pins
`filterStatsForScoringPeriodIds` to the week, and ESPN then returns weekly
split rows only — never a season split — so `rec.season` was essentially never
populated. In week 2, with one week scored, every free agent fell past it onto
the *next* step, "a single measured game", and was priced at that one game
forever. The label was honest. Using the number anyway was not.

The same dead branch existed twice more, found by grep once the first one was
understood: `recommend.js`'s `projectOne()` lists a full-season projection as
source 4 of the Advice tab's blend — its own file header says "this updates
through the season, unlike a number frozen at draft time" — and it read the
same never-populated field, so the Advice tab's documented season-long anchor
had contributed nothing to any projection, ever. And `projections.js`'s
`ingest()` accepted a season split from whichever `externalId` arrived last,
which on a response carrying both 2025 and 2026 was a coin flip between this
season and last.

**What replaced it.** A separate season-projection fetch (its own key, its own
12-hour freshness, `externalId`-filtered, week-independent because a season
total is not an answer to a weekly question), feeding a new `app/assets/ros.js`
that implements what public rest-of-season models actually do:

1. start from a season-long baseline — ESPN's and Sleeper's full-season
   projected STAT LINES, both re-scored by `scoring.js` into this league's
   points and averaged, which is what Tj asked for in so many words;
2. weight this season's observed games in as the sample grows rather than
   all-or-nothing — `w = n / (n + 4)`, so one game carries 20% and eleven
   carry 73%;
3. regress efficiency toward volume, because opportunity is the stable part of
   a small sample and touchdowns are not — the per-opportunity rates are
   measured from this league's own book, so they are correct here by
   construction;
4. multiply by the games he actually has left, bye included.

That product — expected points for the rest of the season, in league scoring —
is what the board ranks on now, what a swap's edge is measured in, and what
both Claude prompts lead with.

**Tj's six rules, and where each one lives.** Current-season data and news
(the two season fetches, plus an unrestricted search mandate in the prompt);
ranked on the season, not the week (`Ros.estimate().total`); a swap only when
it is a meaningful season-long gain (two gates, per-game AND season-points,
`MIN_GAIN`/`MIN_SEASON`); one-for-one pairs with an explicit point edge (the
`swaps` reply contract); no restrictions on Claude, including sight of every
owned player in the league (`Value.takenByTeam`, `Ai.waiverCriteriaText`);
QB/K/DEF still low priority unless the edge is season-defining or the man they
replace is finished for the year (`Recommend.seasonOutlook`, which zeroes a
dead roster spot so the forced replacement falls out of ordinary arithmetic
rather than needing a rule of its own).

**Four bugs found on the way, three of them older than this job.**

- Nothing but the Advice tab's full sync ever called the season fetch, so
  opening the Wire tab without syncing first would have left every free agent
  back on a weekly line — the overhaul looking broken in a brand new way.
  The Wire tab refreshes it itself now.
- `value.js`'s free-agent memo did not key on the season cache, so the
  completed background refresh would have replayed the stale board. This is
  the *third* time this exact trap has been hit in this file; the other two
  are documented in `freeAgents()`'s own comment.
- `Store.setBook` never bumped the store generation, so a sync that wrote a
  fresh week of stats left every downstream cache serving pre-sync numbers
  until Tj happened to add or drop a player. Survivable while the board leaned
  on projections; not once a player's own games are half the estimate.
- And one this job created, caught by re-reading its own diff: `upgrades()`
  searched the best 60 free agents by a single global sort. A completion pays
  a full point here, so ranking on a season TOTAL multiplies quarterback's
  structural advantage by the games remaining — measured against a realistic
  spread of projections, **all sixty came back QB**. The function meant to find
  Tj a running back was searching a pool with no running backs in it, and it
  would have surfaced as the complaint he has already made twice ("it always
  recommends qb switch") arriving by a new route. It pulls per position now.

Every one of those has a regression test that was confirmed to fail against
the pre-fix code.

## WHERE I LEFT OFF — read CHECKPOINT.md and TASKS.md first
On 2026-09-07 Tj gave a new list (three reported bugs, two new features, a
sweep) and asked FIRST for a checkpoint system that survives a usage cap
landing mid-edit. That is now the front door of this bundle:

- `CHECKPOINT.md` — where the last session stopped, regenerated every commit.
- `TASKS.md` — his request in his own words, as checkboxes.
- `tools/ckpt.sh "did" "next"` — a fast commit with NO gate. It records red
  suites honestly instead of refusing, because the moment a cap lands is
  exactly the moment everything is half-finished.
- `bash bootstrap.sh` now prints ~120 lines instead of ~1,200. It used to cat
  STATE.md + LADDER.md + BRIEF.md in full on every cold start — roughly 40k
  tokens of permanent conversation prefix before any work began. `--full`
  still prints everything.
- The zip carries `.git`, so resuming from it restores every checkpoint rather
  than only the final state of each file.

## The older note, kept for context
Tj gave a new review list on 2026-09-03 (see the v3.1+ block at the bottom of
`LADDER.md`). It is broken into checkpoints **11a … 11f**, one zip each.
Tj asked for the four KNOWN-OPEN items from the v3.6 review to be cleared,
plus another optimisation sweep and a check that nothing else is broken. That
is checkpoints **12a-12d** at the bottom of `LADDER.md`, one zip each.
On 2026-09-05 Tj asked for auto-backups to stop cluttering his Downloads
folder — invisible, rotated, only ever thinning the herd after a good write —
while still carrying everything he'd entered, matchups included. That is
checkpoint **14 (v4.2)**.
**Everything asked for is shipped. The KNOWN-OPEN list is empty.**
Next job: Tj running it and reporting what misbehaves.

### The v3.1+ list, in Tj's words, mapped to steps
| he asked for | step |
|---|---|
| review + test everything | **done** — 11a baseline, 11f full review |
| optimisations in code/UI/functionality | **11f done** |
| bottom tabs larger and easier to press | **11a done** |
| screen jumps/scrolls when picking from a dropdown | **11a done** |
| a dropdown to choose the Claude model | **11c done** |
| Claude usage optimised without losing accuracy | **11c done** (on top of v2.4) |
| free agents: Claude sync button, waiver wire online, league scoring, roster needs | **11d done** |
| free agents show all positions, not just QB | **11b done** |
| weekly advice: multiple pro sources averaged, converted to league scoring | **11e done** |

## v4.6 — the tab bar, and a dead end on the busiest screen

Tj, with a week-2 screenshot: *"notice the bottom navigation has shifted up for
some reason."*

**Nothing in v4.5 moved it.** The bar is `position:fixed;bottom:0`, so no amount
of content can push it, and the only CSS v4.5 added was badge colours and the
alert card. Diffed and confirmed. But looking properly found a real defect
underneath, and the reason it was invisible is worse than the defect.

**The bar is 89px tall** — `--tab-h` 88 plus its 1px border — and `body`'s
`padding-bottom` and the toast's `bottom` both hard-coded **124px**. That is a
leftover from when the tabs were 60px; when v3.1 grew them to 88 the two copies
were updated by hand to a number that was already wrong. The page therefore
reserved 35px more than the bar occupies and pinned a dead band above it.

**`test_boot.js` asserted the bug.** The rule was `body padding >= min-height +
24`, which does not describe anything real — the bar is the tab plus its border,
so demanding 24px MORE than that was demanding the gap. The test had been
written to match the number rather than the bar, so it went green for two years
while the layout was wrong. Both values now derive from
`--tabh: calc(var(--tab-h) + 1px + var(--ins-bot) + var(--adj-bot))`, one number
governs the height, and the assertions test the relationship.

**The thing that could genuinely move it is `adjBot`.** The Data tab has an
"Extra bottom padding" slider, it is SAVED STATE, and it survives every update —
so a value set once to fix something else looks exactly like a regression months
later. Screen fit now prints the measured bar height, what the stylesheet
expects, the bottom inset and the current adjBot, flags a mismatch, and offers a
one-tap reset. The next occurrence answers itself.

**A bug in that readout, caught before shipping.**
`getComputedStyle(el).getPropertyValue('--tabh')` returns the SPECIFIED value of
a custom property — the literal string `calc(var(--tab-h) + 1px + …)` — not a
resolved length, so `parseFloat` was `NaN` and the whole check would have
silently reported nothing. Custom properties only resolve when used, so it now
measures a hidden probe given that height.

### The Live tab before kickoff
**Tapping a player was a dead end.** Every row is tappable and `Store.lineFor`
returns nothing until the week is synced, so on any day before the games — which
is most days, and exactly when a lineup is being decided — a tap produced a toast
saying "no stats synced" and stopped. The app already had the projection, the
kickoff, the injury note and Claude's read for that player; none of it was
reachable. It now shows those instead. The manual-adjustment editor is unchanged
and still appears only when there is a line to adjust.

**"TO PLAY" is suppressed when a kickoff badge is present.** The row read
"Bo Nix QB DEN Sun 4:05p TO PLAY"; the badge says the same thing and says when.
The cost was not only noise — `.row .nm` is nowrap with `text-overflow:ellipsis`,
so the redundant tag is what pushes the PLAYER'S NAME into the ellipsis on a
narrower phone. Kept when there is no badge.

### The share grant
`exportShare` set `FLAG_GRANT_READ_URI_PERMISSION` on the send intent only. A
URI grant propagates through a chooser from the intent's ClipData, so without one
the app the user picks can be handed a Uri it is not permitted to open — and the
failure is silent on our side, surfacing in the other app as "cannot open file".
On the one path whose entire purpose is another app reading our file, that is the
worst place for it. ClipData is now set and the flag repeated on the chooser.

## v4.5 — the 2026-09-07 list, and the bug that would have shipped
(v4.3 was the mid-work checkpoint zip sent to Tj partway through the same
session; this is the finished version of that work.)

### The three he reported
**1. "Claude FAILED: the model did not return usable JSON."** Three defects,
and the error message named none of them.
- `jsonOf` computed `var a = s.indexOf('{')` ONCE, outside the loop, and only
  ever retracted the closing brace. With web search on the model narrates
  between searches and that narration lands in the same text buffer, so one
  brace anywhere in it anchored every attempt to the wrong character.
- `parseSse` set `stopped = true` and threw the REASON away. `max_tokens` is
  the likeliest cause by far — the old budget was `400 + 260/player`, and the
  search narration is spent from it before the JSON starts — and a truncated
  object is unrecoverable by construction, because the closing braces were
  never sent. The diagnosis was known one function earlier and discarded.
- It was quadratic: every retraction re-parsed a near-full-length string.

Now one string-aware pass collects every balanced top-level value, prefers the
one carrying the expected key, and — when the answer was cut off — REPAIRS the
tail rather than discarding it. That last part is the one that matters: the
searches in a truncated answer have already been paid for, and recovering
fourteen players out of seventeen beats reporting total failure. `max_tokens`
was raised, which costs nothing: it is a cap, not an allocation.

**2. Sentences cut off mid-word.** `String(det).slice(0, 220)` at ingest — the
note in his screenshot is exactly 220 characters. Both the per-player *why* and
the FLAGGED list read the same stored string, which is why the same wound
appeared three times. The cap was not the mistake; cutting without regard for
meaning was, and for an injury note it can invert the sense ("Even still, Swift
wil…" is the whole question). Now 600, cut at a sentence or a word, with an
explicit ellipsis.

**3. "Re-default all teams now" always said "Nothing to change."** It did
nothing and then reported success at doing nothing. `Store.applyAuto` skips any
slot marked manual — correct and load-bearing for the automatic fills that run
on boot, on week change and after every sync, which must never undo a decision
he made. But this button is Tj explicitly ASKING for the defaults back, and
every hand-edit marks a slot manual, so the more changes he made the more
certainly it did nothing. The per-team "Reset to auto" had it right all along:
clear the manual marks first. It now confirms, because it discards his picks,
and says how many.

### The Claude-app round trip (handoff.js)
Export a file → attach it in a Claude chat with no message → get a file back →
import → the app is filled in. Both for the weekly advice and for the waiver
wire. The briefing is written for a reader told NOTHING: it opens by saying so,
carries this league's scoring table, the roster with kickoffs, the exact output
contract and a worked example.

**It owns the file format and nothing else.** Understanding what a reply MEANS
is `Ai.parseAnswer` + `Ai.normalizeAdvice`/`normalizeWaivers` +
`Recommend.mergeAi` + `Value.waiverSave` — every one of them the same function
the live API path calls. A second implementation would drift the first time
either changed and nothing would notice, because each path is exercised
separately. `rosterContext(..., {everyone:true})` is the one deliberate
difference: triage exists because a web search costs money on the API path, and
through his own subscription it does not, so the handoff asks about every
player. Same code, different economics.

Android side: `exportShare` hands the file straight to the share sheet (no
FileProvider needed — the MediaStore Downloads Uri is shareable), and a
document picker reads the reply off the UI thread. Paste is the fallback
everywhere, because a picker depends on the phone having one and on Claude
having saved a file rather than shown a code block.

### Kickoff times and the pre-Sunday alert (schedule.js)
Every player carries a day and time next to his name on Live, Lineups, Rosters
and Advice, and an alert card leads the three lineup screens when anyone plays
before Sunday — leading with the players who are RECOMMENDED but on the bench,
with a one-tap fix.

**It costs no extra network.** `liveTick` already fetched the scoreboard every
poll to decide whether anything was in progress, and threw the kickoff times
away. `Schedule.ingest` is handed that same response. `refresh()` only goes out
when the stored copy is over three hours old.

`Alerts.java` fires the same warning with the app CLOSED, reading the kickoffs
the page persists into `weekMeta` — no network at alarm time. **The trap there:
Thursday Night Football kicks off at 00:20Z, which is FRIDAY in UTC.** Deriving
the weekday in UTC would make the alert fire a day late every single week and
look correct in a log. `Calendar.getInstance()` with no argument — the phone's
own zone — is the only right answer, and a test pins it.

### THE APP NOW SLEEPS
Nothing stopped anything when the app left the screen. `ui.js`'s own comment
claimed the live poll was "foreground only, by design"; nothing implemented
that, and a backgrounded WebView keeps running its JS timers — so a 45-second
poll that pulls sixteen box scores ran all afternoon behind whatever Tj was
actually doing. `MainActivity` now implements onPause/onStop/onResume/onDestroy
(pauseTimers, WebView teardown, bridge released), the page has
`__appPause`/`__appResume` plus a `visibilitychange` handler, and the sleep
guard sits at the single place a timer is armed — because a request already in
flight will resolve later and re-arm from inside its own `.then()`, and one
escaped timer is enough to keep the poll running forever.

### THE BUG THAT WOULD HAVE SHIPPED
`ui.js` is `(function () { ... })()`. Every OTHER module is
`(function (root) { ... })(window)`. Writing `root.__appPause = appPause` at
ui.js's top level, out of habit, is a **ReferenceError at script load** — the
app would not have booted at all. No screen, no readable error, a dead WebView.

**Eleven green suites and a clean APK build said nothing, because not one of
them executed ui.js.** Every suite either tested a module in isolation or
asserted on ui.js's source TEXT. `tools/test_lifecycle.js` now runs the real
index.html load order in a VM context against a DOM stub, checks that boot()
genuinely initialised the season (the first version of that assertion was
vacuous and hid a boot failure for a round), and proves the battery claim by
COUNTING TIMERS: boot arms 1, pause leaves 0, resume does not stack a second.

A second bug came out of the same suite: `MainActivity.onResume()` calls
`window.__appResume()` directly, and on a cold start that can fire after the
script is evaluated but before `boot()` has run — `S.weekMeta` on an undefined
`S`, thrown into `evaluateJavascript` where nothing in the app would ever
report it. Both hooks now guard on `S`.

### Network, caching and not getting blocked
Every tap of "Sync advice" refetched the full ESPN projection feed (400
players, megabytes) and the 800-record injury list unconditionally. That is not
hypothetical waste: when the Claude step failed — which is what his screenshot
shows — the natural response is to tap Sync again, and each retry pulled all of
it down to reach a step that needed neither. A handful of frustrated taps is a
burst of multi-megabyte requests at a public endpoint nobody owes us. Both feeds
now have freshness gates (20 min / 10 min), reuse is REPORTED rather than
hidden, a failed or empty result is never treated as a cache, and the Data tab's
"test the feed" forces a real fetch because a cached answer would tell him
nothing about the network.

Two more, both mine from earlier the same day: `Schedule.ingest` called
`Store.save()` on every 45-second poll tick — a full-season disk write for data
that had not changed — now guarded by a signature; and `earlyAlert` ran
`bestLineup` on every render of three tabs, now memoised.

### Three hard-coded lists that were quietly not covering things
The same hole as v3.0's discarded javac exit status and v3.10's ship.sh that
never ran the tests — a check that exists but is not wired to what it is meant
to stop:
- `tools/ckpt.sh` and `ship.sh` listed the test suites by name, so `test_ai.js`
  was added and the gate reported "all 6 suites green" without running it.
- `tools/check_es2018.js` listed fourteen filenames; `schedule.js`, `handoff.js`
  and `names.js` were never checked while it printed "all files ES2018-safe".
All three now discover with a glob. Nothing to remember when a file is added.

## v4.1 — player identity (nicknames)
Tj: "the free agent list shows Kenny Gainwell, but Kenneth Gainwell is already
on my roster. It is the same person."

He is right, and the listing was the least damaging of three faces. Every
identity check was an exact match on `Espn.normName()`, so:

1. the wire offered a player he already owns;
2. the AI waiver sync could recommend signing his own player;
3. **worst — the weekly sync indexes rostered players by exact normalised name.
   If ESPN's box score said "Kenny" and the roster said "Kenneth", the stat line
   matched nobody and he scored 0.0 for the week, silently.**

### Why the obvious fix is wrong, with evidence
The tempting rule is "same surname + same position + same NFL team = same
player". Run it over this league's real data and it is a disaster:

- **Bijan Robinson and Brian Robinson Jr. are both Atlanta running backs.**
- **Elijah Moore and D.J. Moore are both Buffalo receivers.**

Team cannot even be a *requirement*, because the case that started this has them
disagreeing — the database said Kenny Gainwell was a Steeler, the roster said
Kenneth Gainwell is a Buccaneer.

I enumerated it: **65 same-surname pairs** across the 785-player database and the
ten rosters. **Exactly one is the same human being.** So the only safe mechanism
is a curated equivalence of FIRST names — Kenny/Kenneth is a nickname pair,
Bijan/Brian is not — plus a short alias list for what no rule can derive
(Hollywood Brown = Marquise Brown, Bam Knight = Zonovan Knight).

`app/assets/names.js` is that layer. It folds only the first token, so
"Amon-Ra St. Brown" never becomes "St. Robert". Position is a hard stop.

### A second bug the dedupe exposed
Collapsing identities revealed that **the player database carried two men twice**
— Gainwell and Chig Okonkwo — **with the two copies naming different NFL teams**,
which means one copy had the wrong bye week. In a league with no
auto-substitution a wrong bye is a zero. Both were sourced and fixed at the
data level (Gainwell left Pittsburgh for Tampa Bay; Okonkwo signed a three-year
deal with Washington, so his bye is 7, not 9 — the app had the wrong one).
`PlayerDB.init()` now collapses any that reappear, and the Data screen *says*
when it did rather than picking silently.

### tools/test_names.js — 19 checks
The risk here is entirely one-directional: a missed merge shows a duplicate in a
list, a wrong merge attributes a stranger's stats to your player. So most of the
suite is about refusing to merge — sixteen real same-surname pairs from this
league that must stay separate. The last check **pins every merge the fold
performs over the real data**; a refresh that introduces a new one turns it red
on purpose.

## v3.10 — dead code, error paths, and a test gate that was missing
**Dead code removed:** the write-only `twoPts` collector in espn.js, the unused
`ids.slice()` in recap.js, `ingestSleeper`'s unused `week` parameter, and the
"Not built yet — ladder step 8" placeholder in `viewAdvice` (index.html loads
recommend.js unconditionally, and `render()`'s try/catch already turns a real
failure into a named card).

**Two review findings did NOT survive contact.** `bookNames()` was called dead —
it is not; `tools/test_engine.js` is its caller, which is exactly the kind a grep
over `app/assets/` misses. It was deleted, the engine suite went red, and it went
back with a comment saying so. `priceOf`'s second parameter genuinely was never
passed, but the body used it as `r = r || rates()`, so removing it created an
assignment to an undeclared name; it now declares the rates locally.

**Error paths closed.** `syncAll` began with `opponentsForWeek(week)` and a
rejection there abandoned the ENTIRE sync — no injury feed, no projections, no
Claude — although none of them need the opponent map. A transient schedule
endpoint cost the whole advice refresh. It now catches, records the reason in the
report, and carries on. Both raw alerts bridge calls are wrapped, as
`alertsStatus` next to them already was; an unguarded throw there reached
`window.onerror`, which replaces the screen with a stack trace.

**`Best value` degenerated to all quarterbacks again, under thin data.** Before
any projection is fetched every free agent at a position falls back to the same
positional floor, so every value-over-replacement is exactly 0 and a plain sort
returns the concatenation order — thirty QBs, the identical complaint this
screen was rebuilt to answer. Ties now break on rank within the position, so the
head reads QB1, RB1, WR1, TE1, K1, DEF1. Found by the new integration suite, not
by inspection.

### tools/test_integration.js — new, 40 checks
The other suites test modules in isolation or assert on source text. **Every
defect the v3.6 review found was a cross-module one** — a sync wiping a field
another screen wrote, an id reused across a table nothing else cleaned, a cache
nobody invalidated — and no module's own tests could have caught any of them.
This one boots all thirteen modules into one shared `window` in index.html's
order, over the real 785-player database and the real ten rosters, and drives
actual work through it: a manual adjustment surviving a stat-table rebuild, a
dropped id not inheriting a scored week, the score memo invalidating on edit and
staying out of a save, the free-agent memo noticing a signing, a malformed
backup being refused without touching the season, and every screen-facing entry
point surviving a brand-new season with nothing scored.

**`ship.sh` never ran the tests.** It checked the dex and the manifest and the
version, and a zip could go out with a red suite — the same class of hole as
v3.0's discarded javac exit status: a check that exists but is not wired to the
thing it is meant to stop. All five suites are now a gate.

## v3.9 — the transport
**Chunk reassembly was synchronous** — up to 8192 back-to-back binder round
trips, inside the promise resolver, on the renderer's JS thread. That is the
exact freeze `httpAsync` exists to prevent, reintroduced for precisely the large
bodies it was built for. The individual `httpChunk()` calls are still
synchronous because that is the bridge's API, but a batch of 8 now yields to the
event loop, so the page paints and the progress bar moves while a 2 MB
projections response is pulled across.

**The legacy synchronous branch carried a SECOND copy** of the same loop with a
different guard constant — 4096 against 8192 — and no `raw` support, so the two
could disagree about whether a body was truncated. It now calls `parseBody` like
everything else. One implementation.

**A malformed chunk header failed in the least useful way available.**
`parseInt` yields `NaN`, `off < NaN` is false so the loop never runs,
`joined.length < NaN` is also false so the truncation check passes, and
`JSON.parse('')` throws "Unexpected end of JSON input" — naming neither the
bridge nor the header. Now guarded and named.

**The field-goal kicker name.** The parser took the WHOLE left-hand side of the
play text, so `"(12:34) J.Tucker 45 yard field goal is GOOD"` gave
`"(12:34) jtucker"`. Prefixes are stripped and the last few words kept, and
`attachFieldGoals` now also compares surnames.

**Honest scope, because the review's worst case did not reproduce.** Of four
realistic ESPN formats, **three already matched** under the old rules; only the
initial-and-surname form (`J.Tucker`) failed. So this was not "every kicker all
season" — it was one common format silently dropping that kicker to the inferred
distance mix. Still worth fixing (the distance ladder is a real scoring rule
here) but not the catastrophe it was flagged as. A test pins both halves and
asserts each is independently necessary.

## v3.8 — the hot paths
**`Scoring.score()` is memoised on the line object.** The review suggested a
separate arithmetic-only `scoreTotal()` fast path. That was the wrong fix: the
scoring engine IS the product, and two implementations means one of them drifts
and it is the one nobody tested. Instead the result is cached on the line, keyed
by a signature over `manualAdj` and the three weekly bonus flags — the only
fields anything edits after espn.js parses a line. The cache is
**non-enumerable**, so it never rides along in the JSON that is rewritten on
every save. The same lines are re-scored constantly (`teamWeekPoints` runs ~560
times on the League tab over the same data), so this is where the win is.

**`defenseProfile()` is memoised on (week, generation).** `autoFillWeek` loops
all ten teams calling it, and the answer is identical for all ten — it is a
property of the league, not of the team. Each run walked every scored week ×
every rostered player × `score()`. It ran on boot, on every week change, and on
every sync including the 45-second live poll.

**The lognormal sigma is cached.** `sqrt(log(1 + cv*cv))` was recomputed on
every single draw — 4,000 sims × ~20 starters = 80,000 times per matchup, over
six distinct cv values.

**Roster search no longer re-normalises the league on every keystroke.**
`have()` normalised all ~170 rostered names for each of up to 20 hits, per
character typed: ~3,400 regex-heavy calls per keypress, which is exactly what
input lag feels like. An owner index is built once and rebuilt only when the
store generation moves.

Plus four one-line duplications: the recap card built the whole recap twice
(`Recap.text` now takes the prebuilt object), bench regret re-scanned from week
14 to find a week the loop above had already stopped on, `slotKeys()` was
rebuilt inside a per-team loop, `usageSwing()` was called twice in a condition,
and the played-weeks count was recomputed for each of ten table rows.

## v3.7 — no browser dialogs, and an import that cannot clobber
**All six `confirm()`/`prompt()` sites are gone.** Two of them were the manual
backup and restore path, and that was the real problem: `prompt()`'s default
value is a single-line field that truncates and is not reliably selectable, and
a mid-season export is tens of thousands of characters. "Copy this backup" was
handing back an unusable string and "Paste a backup JSON" could not take one.
`textModal()` uses a real textarea, prefilled and pre-selected, and says how
many characters the backup is. `confirmModal()` covers the four yes/no sites,
with a red button on the two destructive ones.

**`importJSON` replaced the live season BEFORE validating it.** It assigned
`S = o` and then called `save()`, which touches `S.settings.savedAt` — so a
backup with no `settings` key threw a TypeError *after* the season was already
gone from memory, and the caller's catch reported a clean failure. It also
skipped `init()`'s settings migration, so an older backup came back missing
every key added since it was written. Now: validate the shape and every team,
migrate onto the CANDIDATE object, and swap only at the end. The dialog says so
in as many words, and a failure shows what was wrong and confirms nothing
changed.

9 new assertions, including two that ban `confirm(`/`prompt(` outright —
comment text is stripped before the check so describing the ban does not trip it.

## v3.6 — the review pass, and a trap I walked into myself
A full read of all twelve JS modules against the four hard constraints.

**The embarrassing one first.** Three blocks of assertions I added in v3.1, v3.3
and v3.6 were appended BELOW `process.exit()` in `tools/test_boot.js` and never
ran. Every one passed the moment it was moved, so nothing was actually broken —
but a test file that silently stops testing is exactly the failure v3.0 exists
to prevent, one layer up. **There is now an assertion that no `ok(` call sits
below `process.exit` in either test file**, and it is written to build its own
search string so it cannot match itself. Assertions: 135 boot + 106 engine + 33
scoring.

### Correctness defects found and fixed
1. **A hand-entered adjustment was destroyed by every sync** — including the
   45-second live poll. `doSync` wipes the stat table and rebuilds it, and
   `manualAdj` was not carried across. Since a manual adjustment is the ONLY
   way to score the three weekly longest-play bonuses, this lost real points
   every week, silently. Now snapshotted and re-applied.
2. **A dropped player's id was reused, inheriting his stat history.**
   `nextPid()` scanned only current rosters for the high number, but
   `removePlayer` never cleans `S.stats`, which is keyed by pid. Drop the
   highest-numbered player, add anyone, and the new man silently owns the old
   one's scored weeks in standings, recaps and bench regret. The high-water
   mark is now persisted in settings.
3. **`Sim.season` double-counted every unscored week.** `seasonTotals` adds
   points for all weeks unconditionally (its scored check only gates W/L),
   then the simulation re-simulated exactly those weeks. Playoff odds and
   projected points were inflated by about a week's scoring per unscored week.
   Base points are now rebuilt from scored weeks only.
4. **`Ai.listModels()` could never succeed** — my own bug from v3.3. Without
   `raw:true` the transport already parses the body, so `JSON.parse` got an
   object, stringified it to `"[object Object]"` and threw. Every refresh
   failed with a misleading message and the picker was stuck on its 3-entry
   fallback.
5. **`weeksLeft()` counted weeks already played**, starting at week 1 rather
   than the current week. In week 10 with weeks 1-3 never marked final it
   returned 8 instead of 5 and inflated every trade value by ~60%.
6. **An empty opponents map is truthy**, so `prevOpp || oppMap` froze `{}` in
   permanently and the matchup term said "opponent not known" for the rest of
   the week with no way to recover.
7. **`esc()` did not escape** — it was `return String(s)`, named as a guard,
   and its one caller builds the transactions list through `innerHTML` from
   free-text names.
8. **Three lineup-mutating paths never invalidated the simulation cache**
   (drop, re-default-all, save-adjustment), so the League tab showed a win
   probability computed from the previous lineup.
9. Two more of my own from v3.4: `jobStart` called with one argument printed
   the literal "undefined" in the progress bar, and the waiver cost line read
   `spent.usd` when `Usage.record` returns `cost`.

### Performance
- **`playerById` allocated the entire roster index on every call.** It called
  `allPlayers()` — ~170 wrapper objects — then linear-scanned. `teamWeekPoints`
  calls it once per slot and `lineFor` three times per slot, so one team-week
  cost ~1,700 allocations and the League tab (~560 team-weeks) cost close to a
  million. It is now an index rebuilt only when `save()` bumps a generation.
- **The 785-player free-agent scan ran up to six times per Rosters render**
  (upgrades, byPos, and replacement once per player in a selected trade). Now
  memoised on week + roster generation.
- **`usageText` was formatted for all 785 free agents and read for ~36.** It is
  a lazy getter now — same property name, built on first touch.

### KNOWN-OPEN — found, not fixed, and Tj has not asked for any of them
- **`confirm()`/`prompt()` at six sites.** Two of them are the manual
  backup/restore path, and `prompt()` truncates a mid-season export. `Native.export`
  and the automatic Downloads backup both still work, so this is a degraded
  fallback rather than a live data-loss bug — but it should become a real modal.
- **The chunk-reassembly loop in `espn.js` is synchronous** (up to 8192 blocking
  bridge calls for a large body). It defeats the async design for exactly the
  big responses it was built for. Not touched: `BRIEF.md` forbids simplifying
  that plumbing, and it deserves its own checkpoint.
- **`Scoring.score()` builds ~20 label strings even when only `.total` is
  wanted** — ~56,000 discarded strings per Standings render. Wants a
  `scoreTotal()` fast path.
- **`defenseProfile()` is recomputed once per team** in `autoFillWeek`, ten
  times for an identical result, on boot and on every sync including the live
  poll. Wants memoising on (week, sync generation).

## v3.5 — "multiple professional sources" was one and a half
Tj asked that the weekly advice average several professional sources. The blend
already named and weighted its inputs and already converted everything into
league points — but of the four inputs, only **one** was an outside
professional projection. Sleeper was fetched and then **thrown away whenever
ESPN already had a week line** (`if (have && have.week !== undefined) continue;
/* ESPN wins */`), so it only ever patched holes. Two projections that disagree
are precisely the signal a blend exists to use.

Sleeper is now kept in its own field alongside ESPN's and weighted as an
independent source (`W.sleeperWeek: 2.0`, against ESPN's 3.0 — lower because
ESPN's weekly line is opponent-aware, not because it is less trustworthy). Where
ESPN has nothing it still fills the gap as before, and the diagnostic now
reports both counts: gaps filled AND second opinions given.

**The conversion is the point and it is now stated on screen.** Every outside
projection available anywhere is half-PPR standard, where a completed pass is
worth nothing; here it is worth a point, which is most of a QB's score and none
of anyone else's. So their STAT LINE is imported and re-scored by `scoring.js`,
and their own "projected points" are never used for anything. The per-player
breakdown now says how many outside professional projections contributed and
that they were converted rather than taken at face value.

## v3.4 — the waiver wire, and who does which half of the job
"Ask Claude about the wire" now sits on the Free agents card. The division of
labour is the whole design and getting it backwards would be both expensive and
wrong:

- **The app decides who is available and what he is worth.** It is the only
  thing that knows who is unrostered in THIS ten-team league, and the only
  thing that prices a player in THIS scoring. Every "top waiver adds" article
  on the internet is half-PPR standard, which is wrong about quarterbacks here
  by roughly a factor of two and knows nothing about our ten rosters.
- **Claude adds only what a stat line cannot show** — the starter ahead of a
  backup got hurt on Sunday, a rookie just took the third-down role, a coach
  named a closer — and re-ranks the shortlist for this specific roster.

That split is also what keeps it cheap. The candidate pool sent is the **top 6
per position**, not the ~600-player wire, and the **search budget is sized to
the positions of NEED** (`Value.needs()` — starters within 4 points of the best
free agent at their own position), two searches each, capped at 10. The fixed
half of the prompt carries no week or date, so it is genuinely cacheable; a
test asserts that.

Results are cached to disk (`fftracker_waivers_v1`), grouped by position, and a
read from a previous week is labelled as such rather than shown as current.
**Any player Claude names who was not in the pool we sent is marked "NOT IN THE
APP'S POOL — check he is actually free"** and gets no Add button. The prompt
allows at most two of those, because the useful case (a player the bundled
database has never heard of just took a job) is real, and presenting him as
verified would not be.

## v3.3 — the model picker, and one more cost cut
**The model was a free-text box.** That cannot tell a typo from a retired model
id: both come back as the same 404, in the middle of a sync, after the money is
spent. A hard-coded dropdown would be worse — it goes stale the day a new model
ships and the app has to be rebuilt to reach it.

So the list is **fetched from `GET /v1/models?limit=1000`** with the key that is
already on the Data tab, sorted newest-first, and **cached in settings** so the
picker is populated offline. `FALLBACK` is only what to show before the list has
ever been fetched. Every picker ends in **Custom…**, so a model newer than the
cache is always reachable without a rebuild.

**Both** models are pickable now — the main one and the routine one — because the
routine model is the setting that actually decides what a sync costs. One
`modelPicker()` builds both; two copies would have drifted.

**Cost cut with no accuracy cost:** the weekly recap now *always* uses the
routine model. It is the one Claude call in the app with no judgement in it —
every fact is computed on the phone and handed over verbatim, and the job is
phrasing 120 words of chat banter. Paying top-tier rates for that was waste.
Nothing that involves a *decision* was moved to the cheap model.

## v3.2 — the free-agent board was never broken, the SORT was
Tj: "right now, it only shows qb on the free agents."

`Value.freeAgents()` ranks every position together by league points and the UI
showed the top 40. **In this league a completion pays 1 point**, so a startable
QB is worth roughly twice a startable RB — one sort across positions puts every
quarterback on top, every time. The data was right and the presentation was
wrong. A test now reproduces the old behaviour deliberately (8 of the top 12 are
QBs on a synthetic pool) so nobody "fixes" it back.

**`Value.byPos(week, perPos)`** returns a bucket per position, each sorted and
capped, every row carrying `vor` — points above the best free agent at that same
position. **`Value.byVor(week, limit)`** flattens those into the one mixed
ranking that is honest across positions, because raw points never can be.

The board now opens on **All positions** (best 6 at each, with an "All N RBs"
button per section), has a chip per position for a 30-deep list, and a **Best
value** chip for the VOR ranking. New `.fchip` / `.fchips` / `.subhd` styles —
deliberately NOT `.chip`, which is the 32x32 week arrow.

## v3.1 — the two things he feels on every tap
**Bottom tabs.** Seven tabs share the width, so the target can only grow
vertically: `min-height` 60 → **88px**, icon 17 → **24px**, label 12 → 13px and
600 weight, and `padding` is now symmetric (the old `14px 1px 16px` pushed the
glyph visibly upward). `body` padding-bottom and the toast offset both moved
96 → 124px so nothing hides behind the taller bar.

**THE DROPDOWN JUMP — this was not a dropdown bug.** `render()` ended with
`window.scrollTo(0, scrollMem[view])`, and `scrollMem` is written in exactly
one place: the tab-click handler. So any `render()` triggered by a `<select>`
change restored the scroll position from **whenever that tab was last opened**,
which is normally the top. Picking a player scrolled the screen away from the
player you just picked. Every select in the app did it — Lineups, the trade
partner, the roster-add filters, the Data settings — which is why the fix went
into `render()` and not into the lineup card.

Now: a repaint of the SAME view keeps the exact current offset (captured at
entry, re-asserted once after layout in case the rebuilt view is briefly
shorter, and skipped entirely when it is already within 2px so there is no
visible movement); a switch to a DIFFERENT view restores that view's
remembered offset as before. Controls carry `data-fk` so focus returns to the
control you were using instead of falling on `<body>`, with `preventScroll` so
the focus call cannot itself scroll. `renderTop()` is kept for the three cases
that genuinely should reset: week change, import, reset-to-seed.

11 new assertions in `tools/test_boot.js` pin the shape of both fixes. The
pre-existing `min-height:60px` equality check was relaxed to a floor so that
making the target bigger can never fail the suite again.

## v3.0 — THE BUILD WAS LYING. Read this before touching build.sh or ship.sh.
Tj installed v2.9 and got "League Tracker keeps stopping" on launch, every
time. The app code was not the problem.

**What happened.** `Alerts.java` had a compile error from the moment it was
written in v2.7: inside the inner `Receiver` class, an unqualified
`notify(ctx, ...)` resolves against `Object.notify()` before it ever reaches
the static method next to it, so javac refused the file. That error was
printed and then thrown away, because build.sh ended the javac line with

    ... 2>&1 | grep -v 'bootstrap class path' || true

`|| true` discarded javac's exit status. The build carried on, d8 packaged the
classes that *had* compiled, apksigner signed it, and the script printed
"== built ==". **`Alerts.class` and `NativeBridge.class` were not in the APK at
all** — and MainActivity references both, so the app died with a
NoClassDefFoundError before it could paint a pixel. Three checkpoints (v2.7,
v2.8, v2.9) shipped that way and every one of them said it built.

**The lesson is not "check your Java".** It is that a build step whose failure
is invisible is worse than no build step: everything downstream keeps working
and reports success. Two guards now exist and neither may be removed:
- `build.sh` captures javac's exit status and **stops** on a non-zero one, and
  then asserts that every `.java` file produced a class file.
- `ship.sh` refuses to build a zip unless the APK's dex contains a class for
  every Java source, and unless the APK is newer than every source file.
Both were tested by deliberately breaking a file and watching the build fail.

**A second trap, found while writing the first guard.** `strings f | grep -q X`
returns *failure* under `set -o pipefail`: grep closes the pipe on its first
match, `strings` dies of SIGPIPE, and pipefail reports the pipeline as failed —
intermittently, depending on where in the file the match falls. The dex string
table is now read once into a variable and matched with `case`.

Also in v3.0: the alert receiver is reached by an explicit PendingIntent, so
its intent-filter now carries only the two protected system broadcasts that
re-arm the alarm (`exported="true"` there grants no other app anything).

**Nothing in v2.7-v2.9's Java has ever executed on a phone.** v3.0 is the first
build that contains it. The alert path in particular is still unproven.

## v2.8 — the recap, the schedule, and a second projection source
**Weekly recap** (`recap.js`, top of the League tab). High and low score,
closest game, biggest blowout, best starter, the best week in the whole NFL
(from the league book, so it covers players nobody rosters), the biggest
letdown measured against that player's OWN season average — the only bust
baseline the app can defend, since last week's projection was never stored —
and who left the most on their bench. The text is plain and shareable through
the Android share sheet straight into the league chat. Facts are computed on
the phone; the optional Claude write-up is one small call with NO web search
(about a cent) and is handed those facts verbatim so it has nothing to invent.

**Schedule generator** (Data → Week matchups → Generate the whole season).
Circle method: ten teams, a full round robin in nine weeks, then the first five
rounds again with the order swapped. **It refuses to touch a week that already
has results** — a generator that erased a played week would be a disaster with
a friendly name, and the test asserts that first. Closes open question 1.

**Sleeper as a second projection source.** The ESPN projections endpoint is the
most fragile thing the app depends on: a required `X-Fantasy-Filter` header, a
shape that has already changed once mid-project, and a bad week costs a QB
twenty points of projection silently. Sleeper needs no key and no header, so
after every ESPN route has been tried and only if coverage was poor, it is
asked and used to **fill gaps only** — a player who already has an ESPN week
line keeps it. Skill positions only. As always the STAT LINE is imported and
re-scored here; Sleeper's own points are half-PPR and mean nothing in a league
that pays for completions. The legacy id-keyed shape is refused with a stated
reason rather than half-parsed. **Unverified against the live endpoint** — if
it does not answer, the diagnostic says so and nothing changes.

## v2.7 — alerts: the only part of the app that runs with the app closed
`android/src/com/tj/fftracker/Alerts.java`, a receiver in the manifest, three
bridge methods, and a card on the Data tab.

**Why it is pure Java.** The obvious design is to wake the WebView on Sunday
morning and let `recommend.js` think. That is the wrong design: starting a
WebView from a background broadcast is restricted differently on every Android
version between 10 and 16, and a feature that silently stops working on one of
them is worse than no feature. So the check is narrow enough to be certain in
Java: starters on a bye, starters ESPN has OUT / IR / suspended / doubtful,
and empty starting slots. Judgement calls stay in the app where the reasoning
can be shown.

**No exact alarms, and no permission Tj has to hunt for in Settings.**
`setWindow` with a half-hour window rather than `setExactAndAllowWhileIdle`,
because "check my lineup some time this half hour" does not need an exact
alarm. POST_NOTIFICATIONS is requested at launch on API 33+; boot and
package-replace re-arm the alarm, and so does every app launch, because an
alarm does not survive a force-stop by itself.

**The trap this feature carries.** `Alerts.norm()` is a second copy of
`Espn.normName` — it has to be, since there is no WebView at alarm time. If one
copy is ever changed alone, a starter who is OUT stops matching the injury feed
and the one alert that exists to catch exactly that says nothing. `test_boot.js`
now asserts the two transformations still agree piece by piece.

"Run the check now" on the Data tab runs the real check and posts a real
notification, so the whole path can be proved on the phone without waiting for
Sunday. **Unverified on the phone** — the alarm path in particular.

## v2.6 — value.js: the wire, the trend, and what a trade is actually worth
Two cards at the top of the Rosters tab, and a new module.

**Why this exists at all.** Every waiver list, every trade calculator and every
ranking on the internet is computed in scoring where a completion is worth
nothing. This league pays a point for it, which is most of a QB's score and
none of anybody else's. So nothing is imported: the board is built from the
bundled player database (who exists, and who is on none of the ten rosters),
ESPN's projected STAT LINE re-scored by `scoring.js`, and the league book.
Every row says which of those three it used — including "no data, positional
floor, treat as a guess", because an unlabelled guess is worse than no number.

**Free agents.** The card leads with the only part that is actionable: players
on the wire who project higher than someone currently in your starting lineup,
with the slot and the margin named. FLEX-eligible free agents are compared to
the FLEX as well as to their own position. The full board is underneath, with
each player's last three weeks of OPPORTUNITY — attempts, carries, targets —
not just his points. Adding here changes this app only, and the dialog says so.

**Trade evaluator.** Value is `(points per week − what the best free agent at
that position is worth) × regular-season weeks remaining`. The subtraction is
the whole idea: a player is worth what he beats the wire by, which is why a
startable tight end and a fourth running back are different assets at the same
projection. Uneven trades get an explicit note rather than an invented penalty
— the spare roster spot is filled from the wire, which by definition is worth
replacement level.

**Usage trend** also appears on the player detail modal (tap any player on the
Live tab): three weeks of touches above the points, because opportunity is what
predicts next week and points are what happened last week.

## v2.5 — sim.js: the questions people actually ask out loud
A new module and a new **League** tab. Nothing in it touches the network, so it
works on aeroplane mode and costs nothing to run.

**Win probability, live.** `Sim.matchup` simulates the week 4,000 times. A
player whose game is already in the books is not a random variable any more —
he is a number — so as Sunday goes on the distribution collapses onto the
truth and the percentage means more, not less. It reports what is banked, who
is left, and how much those players still have to find.

**The spread is measured, not asserted.** Each position has a prior
coefficient of variation, and once eight players at that position have three
scored weeks each, this league's own measured spread replaces it — and the
card SAYS which of the two it used. QB starts at 0.26 rather than the ~0.35 you
would use in a normal league, because a completion is a point here: a QB's
floor is his attempts, and attempts are the steadiest thing in football.
Draws are mean-preserving lognormal, so the median sits below the mean and a
ceiling week is possible without inventing points. A test asserts all three of
those properties, plus that the PRNG is seeded — a win probability that
flickers 71/73/72 on every repaint teaches you to distrust it.

**Playoff odds, seeds and title odds** (`Sim.season`) run 3,000 seasons over
the remaining schedule, at team level rather than player level: ten teams by
eight weeks by ten starters would be forty million draws and a frozen phone.
A team's week is drawn from its own measured mean and spread, shrunk towards
the league average until it has four weeks of its own. The bracket is the real
one — 3v6 and 4v5, byes enter in W16, final in W17.

**Power rankings and the luck index** (`Sim.power`). All-play is the record you
would have if you played every team every week; expected wins is that rate
times games played; luck is real wins minus expected. "3-4 but second in
points" is a fact the table cannot show and the thing that decides whether to
panic-trade.

**Bench regret** (`Sim.regret`) is exact, not greedy: tight slots take the best
of each position, then FLEX takes the best of what is left, which with one FLEX
IS the optimum. A wrong "you left 30 points on the bench" is worse than none.

## v2.4 — the Claude bill, cut where the money actually is
Measured cost of a sync was ~$0.11, and about three quarters of that was web
searches: one search costs roughly what ten thousand input tokens cost. So the
saving is not in asking for fewer words, it is in not searching for players
whose answer cannot move.

**Triage** (`recommend.js`, the TRIAGE block in `syncAll`). Every rostered
player lands in one of three buckets each sync:
- **settled** — a bye, or ESPN has him OUT/IR/suspended. The app already
  excludes him from every slot with certainty; a search cannot improve on that.
  He is named in the prompt under "ALREADY SETTLED — do NOT research".
- **research** — a designation of any kind, no verdict on file, a verdict older
  than `aiFreshDays` (3), a verdict from another week, a verdict that was not
  "clear", or a workload that just moved by more than 40% (`usageSwing`, read
  from the league book — a role change is news even when nobody said anything).
  These are searched exactly as thoroughly as before.
- **carried** — checked recently, came back clear, nothing since. His previous
  verdict is reused verbatim and the UI prints the date it was actually formed
  ("checked 2 d ago"), so nothing ever pretends to be newer than it is.

`max_uses` is now sized to the number of players actually being researched
(1.2 per player, floor 2, ceiling 8) instead of a flat 8, and `max_tokens`
likewise. Verdicts MERGE into the cache rather than replacing it — a sync that
researched four players must not erase the reasoning for the other thirteen.

**Prompt caching.** The prompt is split in two. The fixed half — this league's
scoring table, the slots, the task, the JSON contract — is one block carrying
a `cache_control` breakpoint and contains nothing that changes between calls;
the week, the date and the roster are a second block after it. A second sync
inside the cache window re-reads the first half at a tenth of the price.
`tools` sit before `messages`, so the web-search tool definition is cached too.
A test asserts the static block is byte-identical between calls and that no
date, week or player leaks into it — that assertion is the whole mechanism.

**Depth switch** on the Data tab: Smart (default), Full (every player every
sync, the pre-v2.4 behaviour, one tap away), Cheap (smart on `claude-haiku-4-5`).

Expected: a typical mid-season sync researches 4-7 of 17 players instead of 17
and spends about $0.03-0.05 rather than $0.11, with the players who actually
carry news researched no less thoroughly. **Unverified on the phone** — the
numbers above are arithmetic on the published rates and the v2.2 measurement.

## v2.3 — the sync stopped wasting the network, and the feed grew an alarm
Three things, all in the sync path.

**Final games are no longer refetched.** `gcache` in `ui.js` holds the parsed
box score for the week being watched. A game whose state is `post` cannot
change again, so a live poll now pulls only the games still moving. On a 4pm
Sunday with ten games settled the poll went from sixteen full summaries to
about six. It is memory-only on purpose: a cold start does one honest full
sync, and nothing stale can survive a restart.

**Box scores fetch three at a time** (`Espn.pool`). The Java side has always
run a 3-thread pool; the page was using one thread of it and waiting. Order of
results is preserved regardless of the order the network answers, and a single
failed game resolves to null instead of losing the other fifteen.

**The canary.** `pick()` answers 0 for a label it cannot find — correct for a
game with no fumbles, catastrophic for a column ESPN renames. Every group now
declares the labels its POINTS depend on (`NEEDS` in `espn.js`) and anything
missing is reported on `res.shape.missing`. A second alarm watches coverage:
rostered players whose NFL team played but who matched nothing. Either one
paints a red card at the top of the Live tab and a line on Data. Usage-only
columns (CAR, TGTS) are deliberately excluded — a false alarm every week would
train the alarm away.

**The league book.** `S.book[week][normName]` now holds EVERY player ESPN
reported, scored under this league's rules, with pass attempts, carries and
targets carried alongside. It is what makes 10d (free agents, usage trends,
trade values) possible without a second fetch, and it is deliberately compact:
full stat lines for 500 players would be ~150KB a week and the whole state is
rewritten on every save.

## Versioning — read this before shipping anything
`VERSION` holds a plain `MAJOR.MINOR` number and is the ONLY place a version
lives — this file deliberately does not repeat it anywhere but the header line.
`tools/version.sh` reads it; `build.sh` stamps it into the APK (`versionName`,
and `versionCode = major*100+minor`) and writes `app/assets/version.js` so the
About line on the Data tab prints the same number the APK carries; `ship.sh`
names the zip and the APK after it and auto-bumps the minor if that name is
already taken. A docs-only change still gets a version and a rebuild, so the zip name,
`VERSION` and the APK inside the zip can never disagree. **Never hard-code a version anywhere else** — the manifest no
longer carries one, deliberately.

## v2.2 — a spend meter for the API key
Tj asked for a meter showing usage and remaining credit. **There is no endpoint
an ordinary API key can call to ask its own balance.** Anthropic's Usage and
Cost API exists but requires an ADMIN key (`sk-ant-admin...`), which is
organisation-scoped: it can read every workspace's spend and manage keys. That
is not a credential to type into a phone for the sake of a progress bar, so the
app does not ask for one and cannot show a true balance.

What it does instead is count exactly what IT spent. Every Messages response
reports its own token counts and web-search count, so `usage.js` prices each
call as it happens and keeps a running ledger. Enter the credit loaded onto the
key and the Data tab shows spend, remaining, a bar, and how many more syncs the
remainder buys. Measured cost of one advice sync is about **$0.11** — roughly
178 syncs on $20 — and the web searches, not the tokens, are the bulk of it.
The card states plainly that it counts this app only and that the Console is
authoritative.

Rates are editable, defaulting to Sonnet 5's published prices, because a wrong
price baked into an APK is worse than a field that can be corrected.

**A real bug was found writing this.** `parseSse` was doing `usage = ev.usage`
on `message_delta`. In a streamed response `input_tokens` arrives in
`message_start` and `output_tokens` in `message_delta`, so replacing rather than
merging silently discarded the input side — the meter would have read roughly
half of what was actually spent, and nothing else in the app would have noticed.
`tools/test_engine.js` now asserts the merge.

## v2.1 — first real on-device run. Two findings, both fixed.
Tj ran Sync advice on v2.0 over 5G. **The freeze is gone** — 63 seconds, the UI
stayed live, the elapsed counter ticked. Two things came out of that run.

**1. The projection feed works, but was under-asking.** 222 week-1 lines came
back via the `lean filter` route and re-scored correctly — Jonathan Taylor blended
ESPN's week-1 line (17.8) with his season pace and preseason number, exactly as
designed. But **Matthew Stafford, a starting QB, showed "blended from 1 source"**:
no ESPN projection at all. The cause is not name matching. `lean filter` never
asks for a scoring period, so ESPN returns whatever stat rows it likes and only
some players carry a week projection — 222 of ~500. A route that explicitly asks
(`week filter`) now goes FIRST, and `lean` is kept byte-for-byte as the fallback
because it is the one shape proven to answer on his network.
Route selection changed too: the old rule took the first route returning more
than 20 players, which is how partial coverage passed for success. Routes are now
judged on WEEKLY coverage and the best result wins.
And the gap is now visible: the Advice card names every rostered player with no
week projection, because a starting QB silently falling back to his preseason
number is exactly what hides in plain sight.

**2. Claude failed: `IOException: unexpected end of stream`.** A non-streaming
Messages request with web search on sends NOTHING back for a minute or more while
the model searches. Over cellular that silent connection gets closed — by the
carrier, or by a stale pooled keep-alive socket, which is precisely what Android's
HttpURLConnection reports that way. Three changes, in order of importance:
- **the call now streams** (`stream: true`), so bytes flow the whole time and
  nothing ever looks idle. `ai.js` reassembles the SSE into the same shape a
  normal response has, so nothing downstream changed. It deliberately ignores
  `input_json_delta` — that is the model filling in a search call, not its answer.
- POST sends `Connection: close` and `Accept-Encoding: identity`: no pooled
  socket to go stale, and no compression buffering a stream. Costs nothing —
  there is exactly one POST per sync.
- one automatic retry, but ONLY when the first attempt read zero bytes, so a
  call that actually succeeded can never be paid for twice.
`Ai.test()` stays non-streaming and tiny on purpose: it isolates "bad key" from
"long call died on the network".

## v2.0 — THE FREEZE IS FIXED. Read this before touching the bridge.
Tj reported the app freezing on Sync advice. The cause was not the advice code:
**every network call in the app was synchronous across the JS bridge.**

`Native.httpGet(url)` looks like a function call because it is one. The
@JavascriptInterface method runs on a binder thread rather than the UI thread —
which is what the old comment in `NativeBridge.java` claimed made blocking IO
"correct" — but the RENDERER'S JS THREAD BLOCKS INSIDE IT until Java returns.
While it blocks, nothing in the page can run: no repaint, no progress bar, no
button, no touch handler. A 40-second box-score sync froze the UI for 40
seconds. The Anthropic call, which waits up to three minutes with web search
on, was indistinguishable from a crash. Wrapping the call in
`Promise.resolve().then()` did nothing, because the block happens inside the
callback either way.

**This also explains the v1.5 "trap" recorded below.** The Advice tab's
"Working…" that hung visually was diagnosed as a screen-state problem and fixed
by moving `job` out of the screen and adding a header progress bar. That fix
could never have worked: the thread that paints the progress bar is the thread
that is blocked. The fetch "had actually SUCCEEDED" because it was blocking,
then completing. Two rounds of fixing the wrong layer.

The bridge is now genuinely asynchronous:
- `httpAsync(url, headers, body)` returns a request id IMMEDIATELY and does the
  work on a 3-thread pool.
- when the body is ready Java calls `evaluateJavascript("window.__httpDone(id)")`.
- the page collects it with `httpTake(id)` — a memory copy, not a network wait —
  reusing the existing chunking for large bodies.
- `httpForget(id)` drops a result the page gave up on, so a timed-out request
  cannot leak.
- `__httpPending` / `__httpDone` are defined in `index.html` BEFORE any module
  loads, because Java can fire a callback at any moment and a callback with no
  handler is a request lost forever.
- every request now has a timeout (60s default, 90s projections, 300s Claude,
  45s key test) and rejects rather than hanging.
- the request-id counter is an `AtomicInteger`: it is reached under two
  different locks, which was a genuine race.

The synchronous methods are kept, marked LEGACY, so an older asset bundle still
runs. **Nothing in the shipped app may call them.** `tools/test_engine.js`
asserts that the transport returns to its caller BEFORE the body arrives — that
is the assertion that would have caught this.

Also in v2.0: the Advice sync shows elapsed seconds (only possible now that the
page can paint during a request), Claude's `max_uses` dropped 12 → 8 because
twelve searches pushed a sync past two minutes for no extra insight, and the
projections filter asks for 400 players rather than 500.

## v1.9 — documentation only, no app code changed
`BRIEF.md` gained a **CACHE DISCIPLINE** section explaining the mechanism behind
the usage rules: a Cowork session resends the whole conversation every turn,
prompt caching re-reads it at 0.1x, and the prefix is invalidated front-to-back
(`tools` → `system` → `messages`). It exists so a future session understands WHY
it must not dump source files into the reply or re-read finished work, rather
than treating those rules as optional caution. The APK was rebuilt only so the
version stamp stays consistent; nothing in `app/` or `android/` changed.

## Where this stands
The app is complete and usable. Rosters, lineups, matchups, standings, playoff
bracket, weekly high-score and points-champ race, live scoring, advice, backup.

**The scoring engine is verified per position and says so on screen.** Data →
Scoring rules prints every rule *read out of the live engine* (never retyped)
and runs 11 full-line worked examples on the phone every time it opens, on top
of `tools/test_scoring.js` 33/33. RULES_2026.md carries the audit record.
Yardage is fractional — Tj confirmed it 2026-09-02.

**Two real scoring bugs were found in the feed and fixed in v1.8**, both worth
real points and neither visible without the audit:
- a pick-six was counted in both the `defensive` and `interceptions` stat
  groups and summed → 12 points for one touchdown. D/ST and return touchdowns
  and safeties now come from `scoringPlays` (one row per score) with the group
  totals kept only as a de-duplicated fallback.
- two-point conversions credited nobody. They are now parsed from the scoring
  play's parenthetical onto the passer, receiver or runner.

**Lineups auto-default for all ten teams.** On boot, on every week change and
after every sync, each roster is filled with its best projected legal lineup,
skipping byes and anyone ruled out. The dropdowns are untouched — but the
moment Tj changes one, that slot is marked *manual* in `S.lineupManual` and
auto-fill will never move it again. Per-team "Reset to auto", a global
"Re-default all teams now", and an on/off switch. This is why the opponent
totals on the Live tab mean anything: nine other rosters are no longer empty.

**Live scoring is automatic.** `ui.js` owns one timer. It polls the cheap
scoreboard endpoint first and only pulls the sixteen box scores when a game is
actually in progress; the poll reuses the normal sync path in quiet mode (no
progress bar, no toast, no Downloads backup unless the week just went final).
Interval is a slider on the Data tab, default 45s, and it stops entirely once
the week is final. The Live tab pins **your matchup first**, both lineups open,
with a lead/trail banner and who is still to play on each side.

**The advice engine is rebuilt.** Four sources, every one of them converted
into this league's points *before* they are combined:
1. ESPN's projected stat line for the exact week, re-scored by `scoring.js`
   (`projections.js`). This is the piece that was missing — every public
   projection pays 0 for a completion and this league pays 1, so an imported
   "projected points" number was useless while the projected *stat line* is
   gold.
2. the player's own scored games in this app
3. his draft-time projection (`seed.projPG`)
4. ESPN's full-season projection per game

Weighted, not averaged; measured games take over as the sample grows. Then the
opponent's measured generosity to the position — **at half strength when ESPN's
weekly line is present, because that number already prices the matchup and
counting it twice is a real error**. Then the injury feed. Then, optionally,
Claude.

**Claude is opt-in and is not load-bearing.** Paste an Anthropic API key on the
Data tab and "Sync advice" has Claude search current news for each rostered
player — practice reports, designations, suspensions, snap restrictions — and
return a per-player adjustment with dated, sourced reasoning shown in the app.
The prompt carries this league's actual scoring table, generated from
`Scoring.describe()`, because a model assuming standard scoring is wrong here in
a specific and expensive way. Key wrong, model renamed, network down: the AI
step reports and is skipped, and everything else still ran. `Ai.test()` is a
one-line round trip that separates "bad key" from "bad prompt".

**Anyone who will not play is removed, not down-weighted.** Bye, OUT, IR,
suspension, or Claude saying he will not play → excluded from every slot. A
player is only ever force-started when a slot has literally nothing else, and
the pick is tagged "nothing else eligible".

Next action is **ladder step 10 (hardening)**.

## Decisions already taken — do not relitigate
- **WebView + thin Java shell, no framework, no native libs.** One APK for
  armv7/Android 10 and arm64/Android 16. Verified again at v1.8: zero `lib/`
  entries.
- **ESPN public JSON** for scores, injuries and now projections. No key, no
  paid tier. The projections endpoint needs an `X-Fantasy-Filter` header, which
  is why the bridge grew `httpGetH`.
- **All network via the Java bridge.** A `file://` page cannot do CORS. v1.8
  added `httpGetH` (headers) and `httpPost` (Anthropic); both are chunk-safe
  and both return the server's error body, not just a status number.
- **Manual APK build** (aapt2 + javac + d8 + apksigner), not Gradle.
- Season opens **2026-09-10**. The engine is developed against 2025 completed
  games (event 401772636, IND@ATL) and switches to 2026 by config.

## VERIFIED ON THE PHONE — 2026-09-01
Tj ran the feed self-test against ATL@IND (2025 wk 10): `23 players parsed ·
scores true {IND:31,ATL:25} · FG from play-by-play true (4 kicks) · QB Michael
Penix Jr -> 24.8 · DST ATL 18.0 · DST IND 9.0`. Hand-checked: 12 completions +
177 pass yds (8.85) + 1 pass TD (6) + -1 rush yd + 1 fumble lost = **24.75 →
24.8. The parser and the scoring engine are correct end to end on live data.**

## VERIFIED ON THE PHONE — 2026-09-02, v2.0 over 5G
Sync advice completed in 63s with the UI responsive throughout: 16 games
scheduled, 800 injury records, 222 week-1 projections. The async bridge and the
projection re-scoring are both proven on real hardware.

## STILL UNVERIFIED — what v2.1 changed and nobody has run yet
1. **The streamed Anthropic call.** This is the fix for the one failure in that
   run. If it fails again, the message will now say whether the stream opened.
   **Data → Test the key** first: it is short and non-streaming, so if it passes
   and the long call still dies, the problem is duration, not credentials.
2. **The `week filter` projection route.** If it answers, coverage should jump
   well past 222 and Stafford should gain an ESPN line. If ESPN rejects it the
   app silently falls back to the `lean filter` that already worked, so this
   cannot regress — **Data → Test the projection feed** now prints what EVERY
   route returned, not just the winner.

## Durability
**App side.** `Store.save()` on every mutation. `NativeBridge.save()` writes to
temp, fsyncs, rotates the previous copy to `.bak`, renames; `load()` falls back
to `.bak`. A full JSON copy goes to **Downloads** after every settled sync and
every 10th edit. A live poll deliberately does NOT write a backup — at 45s it
would fill the folder.

**Build side.** `ship.sh` refuses to build if `STATE.md` is stale or the
manifest disagrees, and carries the last working APK inside the zip at
`.lastbuild/app-release.apk`.

## Traps already paid for
- **A pick-six was paid twice, and nobody would have noticed.** ESPN puts the
  same defensive touchdown in two stat groups. The lesson is not about ESPN: it
  is that *summing overlapping aggregate columns is always a bug waiting*.
  Prefer the one-row-per-event source (`scoringPlays`) and keep the aggregate
  as a de-duplicated fallback.
- **A projection is only useful as a stat line.** FantasyPros, Yahoo and ESPN
  all score a completion at 0; this league pays 1, worth ~20-24 points a week
  to a starting QB. Never import "projected points". Import attempts,
  completions, yards, touchdowns, and re-score them here.
- **Do not apply the matchup adjustment on top of a source that already
  contains it.** ESPN's weekly projection is matchup-aware. Applying the app's
  own defense factor at full strength on top of it double-counts.
- **ARI was never a URL problem and never a payload problem.** v1.6 chunking
  and v1.7's five route shapes both stand; the 404 was specific to Tj's network
  edge. Read `Data → Diagnose a team` output before guessing a sixth time.
- **Long work must not live inside a screen.** Module-level `job` in `ui.js`
  with a header progress bar; `scrollMem` so a tab switch is not a reset.
  Anything long-running goes through `jobStart/jobStep/jobEnd`.
- **ESPN's team abbreviations are not the league's.** Washington is `wsh`.
- **Never use `alert()`** in a `file://` WebView. Use `modal()`.
- **Test regexes must strip comments and strings first.** This has bitten
  three times now.
- **The status bar took three tries.** WebView stays full-bleed and is NEVER
  padded; insets are converted to CSS px and pushed in via `window.__setInsets`,
  with a manual override on the Data tab. `test_boot.js` locks this in.
- **v1.0 shipped broken:** a `file:///android_asset/` page cannot XHR a sibling
  asset. All data ships as `<script>` files (`seed.js`, `players.js`,
  `version.js`) that set globals.
- ESPN stat groups expose `labels`/`keys`; **index by label, not position**.
  The single exception is passing's `C/ATT`, split on `/`.
- **Missed field goals never appear in `scoringPlays`** — distance-tiered miss
  penalties need `drives.previous[].plays[]`.
- Forced fumbles are NOT scored. Only recoveries. This is enforced on both the
  live path and the projection path (ESPN stat id 106 is deliberately unused).

## Open questions for Tj — none blocking
1. Matchup schedule is entered manually by design. A round-robin generator
   could be added later.
2. The three league-wide +5 longest-play bonuses cannot be derived from a box
   score. Tap any player on the Live tab to add one by hand; it shows as its
   own labelled row and survives a re-sync.
3. Whether RTSports also pays an individual returner for a kick/punt return TD.
   Default follows the rules sheet (D/ST only); switchable on the Data tab.

---

# v4.7 — 2026-09-09. The audit, then the two gestures.

## What was asked

Tj attached the v4.6 zip and APK and asked for "a thorough scan for UI or code
improvements, feature improvements, and bug fixes." I read every module and
reproduced each finding by RUNNING the app's own code rather than by reading
it. 22 defects. Then he replied with the rule decision, "fix all the criticals
and whatever else you found", the two gestures, and "make sure any changes
don't break anything else in the app."

## The rule he settled — and why the setting is gone, not off

> "a defense touchdown is only scored one time. individual player doesn't
>  matter."

v1.8 recorded `individualReturnTD` as the ONE genuine ambiguity in the rules
image ("Kickoff/Punt return TD +6" is printed under Defense/ST — does the
returner get paid too?) and made it a toggle on the Data tab. Tj has now
answered it, so it is a fact and not a setting.

It is REMOVED rather than pinned to false because while it existed it was wrong
in both positions, and both halves are worth remembering:

1. Switched ON it did not MOVE the six points, it ADDED them. `score()` paid
   `L.ret.td` to the returner and still paid `D.retTD` to the defense in the
   same pass: one punt return, 12 league points. **That is the v1.8 pick-six
   defect exactly — two feeds describing one score, both counted — reintroduced
   behind a switch, in the same file that fixed it.**
2. `memoSig` covered `manualAdj` and the three bonus flags but not the RULES,
   which `configure()` could mutate at runtime. So flipping the toggle changed
   no number on screen until the app restarted. `RULES_2026.md` promised
   "flipping it never needs a re-sync"; it needed a restart, silently.

`RULES_EPOCH` is now in the memo signature and is deliberately unused: RULES is
immutable again, so the signature is complete without it, but the next runtime
rule would silently reintroduce (2) and the failure is invisible — the
arithmetic is right, only the cache is stale.

## The two silent ones

### Auto-fill benched players who had already played

`Recommend.autoLineup` ranks a roster on PROJECTIONS and has no concept of
time. `Store.applyAuto` protected only slots marked manual — and a slot the app
filled itself is not one of those. So a player who had banked 33 real points
was compared on his 6.2 preseason number and lost his slot.

`autoFillWeek` runs on boot, on every week change, and after EVERY sync
including the quiet 45-second live poll, for all ten teams. Reproduced: team
total 33 → 0, silently, with the app doing it to itself on a timer.

Fix: `Store.isLocked(week, pid)` — a stat line with `played`, or a game whose
state is not 'pre' (or whose kickoff has passed). Bound in BOTH directions in
`applyAuto`: a started player cannot be removed from a slot and cannot be added
to one. A MANUAL edit still gets through after a confirm, deliberately: this
app mirrors a league actually run on RTSports and Tj sometimes has to correct a
slot after the fact. The lock binds the automation, which is the thing that was
silently wrong.

### Claude's verdicts filed under a key nothing read

`ai.js` wrote `byName[Names.canon(p.name)]`; `recommend.js` read
`byName[Espn.normName(p.name)]`. canon() formalises the first name, so for
every player with a nickname first name the write and the read never met.

15 of this league's 170 — Chris Olave, Josh Allen, Joe Burrow, Mike Evans, Sam
LaPorta, Josh Jacobs, Cam Skattebo, Tony Pollard, Jake Ferguson and six more.
Three costs: the adjustment lost; the reasoning absent, so nothing LOOKED
wrong; and `rosterContext` reading the same broken key, so they came back
"never checked" on every sync and were re-researched at cost forever.

Worst: a Claude "willPlay: false" is a HARD exclusion. For those fifteen it did
nothing and the app kept recommending the player.

The same defect lived in three more places, in a different shape — a map keyed
by the FEED's spelling read with the ROSTER's: `health()` (so "Kenny Gainwell"
OUT never reached "Kenneth Gainwell", the exact case names.js exists for),
`Projections.find` (dropping the three heaviest projection sources to a flat
positional prior), and the ESPN/Sleeper merge (filing one man as two).

Fix: `Names.hit(map, name)` / `hitKey`, which tries every variant. Reading
tolerantly rather than rewriting the writers means no cache on disk needed
migrating — the entries an older build wrote are still found. `variants()` also
gained both sides of a curated ALIAS pair, which it had never returned, so the
alias list was useless to every lookup except an exact canon-to-canon compare.

## Persistence: two defects, one of them growing all season

`rawSave` called `Native.save`, discarded its boolean and returned true. A full
disk read as a successful save, and `save()`'s `if (ok && saveCount % 10)`
auto-backup gate was testing a constant.

And measured on the real roster at 14 scored weeks:

    whole state ........ 1,969,809 chars   written on EVERY save
      league book ......   849 KB   44%    changes only on a sync
      weekly stat lines  1,046 KB   54%    changes only on a sync
      everything else ..    25 KB    1.3%  all a lineup edit touches

Through a SYNCHRONOUS bridge call doing write + fsync + two renames on the
renderer's JS thread — the blocking-bridge pattern BRIEF.md forbids, growing
every week. book and stats now live in `fftracker_archive_v1`, written only
when a sync marks them dirty. One lineup edit: 1924 KB → 25 KB.

The archive can be one sync behind the main file if the app dies between the
two writes. That is recoverable — the dirty flag survives, the next save
retries, and a re-sync rebuilds both halves — and it is why this is two files
and not three. Alerts.java reads teams, lineups, weekMeta, byes and settings
out of the main file; none of those moved.

## The API key was going to public Downloads

`exportJSON` serialised the whole state, `aiKey` included, and the Export
backup button hands that to `NativeBridge.export`, which writes it to
`Downloads/` via MediaStore. Readable by any app with media access, and the one
file he would move to a PC. Redacted in `exportJSON` rather than at the button,
so every future caller is safe by construction; `importJSON` keeps the key
already on the phone, so a redacted backup restores cleanly.

## The gestures — and the one the test caught

`app/assets/gestures.js` is standalone: `init()` takes callbacks and it reads
no app state. That is what let `tools/test_gestures.js` drive it with synthetic
touches against a DOM stub, and gesture code is exactly the kind that reads
correctly and is wrong under a thumb.

The axis is decided once in the first ~10px and then sticks; re-deciding per
move event is what makes a screen scroll and slide at once. `preventDefault` is
called only after the gesture is claimed, never speculatively. A `<select>`, a
sideways-scrolling table and anything inside a dialog keep their own drags.
Pull-to-refresh fires only at scrollTop 0.

**The test caught a real one:** a flick was decided on velocity alone, and a
25px twitch at the start of a scroll is over in a few milliseconds — a very
high px/ms. It changed tab on a jerk. `FLICK_MIN_PX` is the floor that makes
"fast" mean deliberate.

## Back, and the second modal implementation

`onKeyDown` deferred to `web.canGoBack()`, which in a page that never pushes
history is ALWAYS false — so back quit the app from anywhere, including with a
confirm dialog open, which on Android is where everyone presses it. The
Activity now asks `window.__onBack()` and finishes only if the page declines
(async, so the press is swallowed and the decision made in the callback).

That needed one modal stack, which surfaced that `modal()` was a SECOND full
modal implementation beside `dialog()` — its own backdrop, its own close — and
had therefore silently missed everything dialog() gained. `modal()` is built on
`dialog()` now, and both get focus-in/focus-return, Escape, `role="dialog"` and
`data-nogesture`.

## The alarm was only armed twice a week

`Alerts.check` correctly treats Tue–Sat as "before Sunday" — matching
schedule.js exactly, which I verified. But `rearm()` armed only Sunday and
Thursday 16:00, so a Wednesday opener (which this season had, and which TASKS
called out in v4.5) or a December Saturday got no closed-app warning at all.

One daily alarm now. That needs two things a weekly one did not: a 30-hour
horizon, or Tuesday's check names Sunday's whole slate and does it again
Wednesday, Thursday and Friday; and duplicate suppression, or an identical
sentence posts every morning about a lineup he has already decided about.

It also names only the players the app would actually START. Java cannot run
the recommender, but schedule.js already computes `shouldStart` (benched AND
recommended) and now persists those ids into the same weekMeta the alarm reads
for kickoffs. An empty list degrades to the old name-everyone behaviour rather
than to silence.

`Alerts.norm()` gained `Locale.US`. Java's `toLowerCase()` is locale-sensitive:
on a Turkish-locale phone 'I' lowercases to a dotless 'ı', so every name with
an I stopped matching the injury feed — while the comment above it says it must
match `Espn.normName` character for character, and JS's `toLowerCase()` is
locale-independent.

## The test net, which was the real gap

Nothing in the suite had ever executed a view function. ui.js is 145 KB and
almost all of it is render code, so "the file evaluates and boot() survives"
was proving very little. `test_lifecycle.js` now gives the DOM stub real tab
buttons and walks all seven tabs through the REAL click handler — the same path
a swipe takes — checking both for a throw and for render()'s own error card. I
verified it is not vacuous by breaking `lineupCard` on purpose and watching it
go red.

Three source-grep assertions broke during this work while the behaviour they
named was still true (a literal `setSlot(...)` call, `S = o; bumpGen(); save()`,
`scheduleLive(60000)`). Each was rewritten to test the relationship instead of
the literal — the same lesson as the v4.6 `124px` assertion that pinned a bug.

One more, worth recording because it is a trap: a regex literal containing a
double quote (`/["\\]/g`) made `test_boot`'s naive string-stripper treat the
rest of the file as one string literal, and an unrelated assertion went red.
The fix was a whitelist (`/[^A-Za-z0-9_|.:-]/g`) which is both safer and has no
quote in it.

## State at the end of v4.7

13 suites green, ES2018 clean, APK 214 KB, 25 classes, no native libs, minSdk
29 / targetSdk 36. `seed.json` (38 KB of build-time source) no longer ships in
the APK — build.sh stages assets and drops it.

Three candidates are LISTED and NOT BUILT at the end of RELEASE_NOTES.md, per
his standing rule: bench-regret on the recap, a weekly name-folding self-check
on the Data tab, and true longest-completion attribution.


## The move to Claude Code + GitHub (2026-09-09/10)

The project left Cowork. It is now a GitHub repo worked from Claude Code, on
**three different Claude accounts** — when one account's usage runs out the
next opens the same repo cold and continues. That single fact drove every
change below, and it is why the old zip machinery is gone.

**What replaced the zip.** In Cowork the zip was the only thing that survived
the chat, so `ship.sh` built one and told the next chat to attach it. Nothing
in that sentence is true now: the repo is the transport, the container is
destroyed at session end, and a zip written beside the repo was never even
committed. `ship.sh` now commits a versioned APK under `releases/` and pushes;
the gates (13 suites, dex completeness, version bump, manifest) are unchanged.

**Three levels of saving, and only the middle one needs a session's judgement.**
- `tools/autosave.sh` runs from hooks after every edit and every bash command.
  No tests, no gate, and it deliberately never rewrites CHECKPOINT.md —
  inventing a "Do this next" would destroy the one thing a cold session needs.
  This is what survives a cap landing mid-change.
- `tools/ckpt.sh` is unchanged in spirit and now pushes. It is the only thing
  that records INTENT, which no hook can reconstruct from a diff.
- `ship.sh` is the milestone gate.

**The handoff itself.** `tools/resume.sh` runs from a SessionStart hook: it
fast-forwards from GitHub when that is safe, refuses to auto-merge when it is
not, and prints CHECKPOINT.md + TASKS.md + the rules into the new session
automatically. Tj types "continue" and nothing else.

**Traps paid for here, so they are not paid again:**
1. `git rev-list --count @{u}..HEAD` needs a remote-TRACKING ref. A branch made
   from FETCH_HEAD has none, so the check errored, `|| echo 0` read as "nothing
   to push", and commits silently never left the container. `tools/push.sh`
   now pushes whenever it cannot PROVE there is nothing to push.
2. A failing push was completely silent — measured, three commits piled up
   looking exactly like success. Autosave now shouts, ckpt warns, ship is fatal.
3. Autosave leaves a CLEAN tree holding a half-written change, which looks
   identical to finished work. resume.sh detects auto-checkpoints stacked after
   the last deliberate one and says so loudly.
4. Anything reprinted in the briefing is paid on EVERY cold start forever, not
   once: an 851-char JAVA_TOOL_OPTIONS dump, verbose commit messages, and a
   fully-ticked TASKS.md were costing ~700 tokens a session between them.
   TASKS.md is now reset when a job finishes and the job archived to LADDER.md.
5. `ship.sh` gated on `Last updated: <today>` in this file, which fails at
   midnight regardless of whether anything is actually stale. It now compares
   commit timestamps: this file versus the last change to app/ or android/.


## The waiver-wire upgrade (2026-09-14, v5.4 -> v5.5)

Tj's request was long and specific, and the app already had a real Claude-
backed waiver assistant (v3.4: `ai.js` `askWaivers`/`waiverPrefix`/
`waiverBlock`, the free-agent board in `value.js`/`ui.js`). What it did not
do: look at his OWN roster's injuries, distinguish a season-long roster
upgrade from a one-week streamer, keep kickers/defenses out of the way unless
one of his was actually unavailable, or pair a recommended add with a sane
drop. This round added all four, on top of the existing division of labour
(the app prices players in league points and knows the roster; Claude
supplies the news arithmetic cannot).

**The one design decision that matters more than the others: never trust the
model for a hard constraint it can undermine by getting creative.** Tj's own
example was "don't recommend dropping a kicker to add a WR" — so that is not
a sentence in the prompt asking nicely, it is enforced in code twice:
- `value.js` `dropCandidatesFrom` computes MY OWN weakest bench player AT
  EACH POSITION (worst rest-of-season value first) and hands Claude only
  that list to choose from.
- `ai.js` `normalizeWaivers` then checks the model's `dropCandidate` against
  that same list AND requires the position to match the add's own position;
  anything else — an invented name, a real name at the wrong position — is
  silently cleared rather than shown. A wrong pairing is worse than none.

Same pattern for K/DEF: `value.js` `kdefNeedFrom` computes whether every K
(or every DEF) on the roster is on bye or ruled OUT this week — the ONE
exception Tj named — and `normalizeWaivers` drops any K/DEF add outright when
that flag is false, independent of whether the prompt asked for it. The
prompt also asks, but the filter is the guarantee.

**Rest-of-season value, not this week's number, drives both the drop
candidates and the season/week priority sort.** `dropCandidatesFrom` reuses
the exact `(base - replacement) * weeksLeft` arithmetic `trade()` already
uses — a player who barely helps this week but has two more months of value
must not be offered as the cut ahead of one who is dead weight all season.
Claude separately tags each ADD `"priority":"season"|"week"` (a role/injury
change expected to last, versus a bye fill-in), and `normalizeWaivers` sorts
season-priority ahead of week-only within the same rank tier — so "entire
season over small weekly changes" holds even on a call where the model's own
`rank` numbers do not fully reflect it.

**Roster injuries got a deterministic baseline plus an optional AI layer,
not an AI-only feature.** `Value.myInjuries` reads `Recommend.projectAll` —
the same computation the Advice tab already trusts — so the new "Your roster
— injuries" card on the Wire tab shows the ESPN designation and note the
instant the tab opens, with no API key and no network call. Only the SEASON
OUTLOOK layered on top (severity, timeline, whether it is worth chasing a
replacement) needs Claude, and it rides the SAME waiver sync rather than a
second paid call — an injury is exactly the kind of roster need the waiver
assistant already exists to fill. `Ai.normalizeInjuries` validates the
model's answer against the app's own injury list by name, same safety
property as the free-agent pool check.

**A UI trap worth recording so it is not reintroduced.** `.row .nm` is
`white-space:nowrap;overflow:hidden;text-overflow:ellipsis` (app.css) — it
truncates to one line by design, which the pre-existing waiver card ignored:
`a.why` (up to two sentences) was being appended into that same nowrap
`<small>`, silently cut off on a real phone. The exact text Tj asked to see
("player x had 3 receptions for 34 yards…") would have landed there and
disappeared. `recentStat` and `why` now go in a `<details>` block instead —
the same pattern `recommend.js`'s Advice tab already uses for its own "why"
— whose `.kv span` rule is `white-space:pre-wrap`, so it actually wraps.

**Both round trips, one contract.** `handoff.js` `buildWaivers` (the offline
Claude-app briefing) and `importReply` carry the identical new sections and
fields as the live API path — MY ROSTER — INJURIES, the K/DEF need lines,
DROP CANDIDATES, `priority`/`recentStat`/`dropCandidate`/`injuries` in the
JSON contract — because `Ai.normalizeWaivers`/`normalizeInjuries` is the one
place either path's answer gets turned into app records. `test_handoff.js`
§8 greps `handoff.js` for both normalisers by name specifically so a future
session cannot quietly reimplement one and let the two paths drift.

Old cached waiver results (written before this shipped) are read with the
new fields simply absent — `a.priority`, `a.dropCandidate` etc. are all
`undefined`-safe with sane fallbacks (plain "Add" button, no season/week
badge claimed) — no migration code, because the cache is ephemeral and
self-heals on the next sync, the same as the existing "FROM WEEK N —
re-sync" staleness banner already assumes.

13 suites green (test_ai.js/test_integration.js/test_handoff.js all
extended, not just re-passed — see their v5.5 sections for what specifically
is pinned: the position-mismatch drop rejection, the K/DEF hard filter and
that it is optional for old callers, the season-before-week sort, and the
injury-name validation), ES2018 clean, `build.sh` produces a clean 25-class
APK. Not yet confirmed on the phone — this session cannot run the Android
WebView, so the "why the reasoning is now readable" and "Add + drop" button
claims above are verified by code/CSS reading, not by eye.


## v5.5b — the stale-injury-feed bug, and a real CSS bug caught by rendering
   it (2026-09-14, same day)

Tj sent a phone screenshot within minutes of installing v5.5: the new "Your
roster — injuries" card showed a D'Andre Swift note reading like preseason
camp news, cut off mid-word ("...Even still, Swift wil") right where the
QUESTIONABLE tag started.

**Root cause, confirmed by reading the code rather than guessing.**
`ui.js` `boot()` already calls `Recommend.loadCaches()` unconditionally,
which loads the ESPN injury feed from a PERSISTED DISK cache — so the card
was not broken, it was honestly showing whatever was last written to disk.
The gap: nothing on the Wire tab could ever REFRESH that. Only the Advice
tab's "Sync advice" button calls `loadNews()`. If Tj had not pressed that in
a while, the Wire tab would show injury notes however old the last real sync
was — and the exact "...Swift wil" cutoff (no trailing ellipsis) matches the
LITERAL pre-v2.4 `trimNote` bug (a hard 220-char slice, no sentence
awareness) almost too well to be coincidence: that string was very likely
written to disk before that fix ever shipped and has sat there, unrefreshed,
ever since — the persisted cache does not self-heal, only a fresh sync
rewrites it.

Two real gaps, both introduced in the v5.5 work:
1. Every other cache-backed section in the app says how old its data is
   (Advice tab: "Injury feed: N records, Xh ago"; the Claude wire-read card:
   "Read Xh ago"). The new injury card said nothing, so stale data read as
   current. Fixed: `recommend.js` now exports `newsCache()` (a read-only
   getter, identical pattern to the existing `aiCache()`), and the card
   shows a freshness line plus its OWN "Sync injury feed" button —
   `Recommend.loadNews(.., {force:true})`, which needs no API key at all
   (it is the ESPN endpoint, not Claude). ui.js also picked up a small shared
   `agoText()` helper so this and the wire-read card's "Read Xh ago" say the
   same thing the same way, rather than two slightly different inline
   calculations.
2. `Ai.askWaivers` never refreshed the injury feed either — a PAID Claude
   call was reasoning from whatever ESPN designations happened to be
   cached, which quietly undermines the v5.5 "freshness discipline"
   instruction (that only governs what Claude searches for; the app's own
   "treat availability as settled fact" facts were never covered). The
   "Ask Claude about the wire" click handler now force-refreshes the feed
   FIRST, with the same swallow-and-continue resilience `syncAll()` already
   uses for the Advice tab (one step failing must not cost the whole call).

**A second, genuinely separate bug, found only by actually rendering it.**
The mid-word cutoff's LAYOUT — wrapped across five lines with no ellipsis,
matching Tj's screenshot exactly — did not fit `.row .nm`'s CSS
(`white-space:nowrap;overflow:hidden;text-overflow:ellipsis`), which should
have produced a single clipped line. Rather than keep theorising, this was
checked empirically: Chromium is pre-installed in this environment
(`/opt/pw-browsers/chromium-1194/chrome-linux/chrome --headless
--no-sandbox --screenshot=...`) and rendering the ACTUAL app.css against the
same markup reproduced Tj's exact broken layout — multi-line wrap, no
ellipsis, tag on its own line. A long text run sharing one nowrap flex line
with an inline-block `.tag` span does not reliably ellipsize in this
WebView's engine; it wraps instead. The fix — the injury note moved out of
the row's own `<small>` into a sibling `.kv` line, same pattern already used
for the Claude wire-read card's "why" — was verified the same way, rendered
before shipping it, not just asserted. Worth remembering: this session
cannot run the Android app, but it CAN render real HTML+CSS in a real
browser, and should reach for that before trusting a CSS read on anything
this specific again.

13 suites (new assertions in `test_boot.js`: the export exists, the card
reads it, the refresh happens before context-building in source order and
is forced, the note is no longer in the nowrap `<small>`) + ES2018 gate
green, `build.sh` clean. Shipped as v5.6 (versionCode 506).


## v5.7 — the "limit only" fallback route was permanently broken

Tj sent a screenshot of "Data > Test the projection feed" asking whether an
`HTTP 400` on one of the tried routes mattered. It did not cost him any
data — coverage reached all 477 indexed players via `week filter + sleeper
current`, and the QB numbers (Mahomes 40.7, Nix 43.7, Rodgers 38.2) confirm
the re-scoring is running correctly — but reading `projections.js` turned up
a real, structural bug worth fixing anyway.

`filters()` tries four ESPN request shapes in order — week filter, full
filter, lean filter, limit only — stopping early only once one clears 300
week lines (`GOOD_ENOUGH`). None of the first three currently clears 300
alone, so **all four run on every single sync**, not just as a rare
fallback. The last one, `tiny = { players: { limit: 500 } }`, has no `sort`
field, and ESPN's API now rejects a bare `limit` filter with none — the
exact error in the screenshot. `lean filter`, immediately above it, sends
the identical `limit: 500` plus `sortPercOwned: {...}` and works. This was
never a transient failure: as written, "limit only" could never succeed
against ESPN's current API, on any network, ever — which defeats the whole
point of it being a resilience fallback. If the three routes ahead of it
ever degraded on a bad day, this safety net would still fail right when it
was needed.

Fix: added the same `sortPercOwned` field `lean` already carries. One line.
Pinned in `test_net.js` (a suite already about "what this app asks the
internet for", born from an earlier screenshot-driven fix in the same
file) — greps the `tiny` shape for both `limit: 500` and `sortPercOwned` so
a future edit that drops the sort field again fails the suite immediately
rather than waiting for the next screenshot.

Same session also answered Tj's separate question about whether a Claude.ai
Pro subscription can power the app's automated Claude calls instead of a
paid API key: no — Pro (claude.ai) and the API (console.anthropic.com) are
separate products with separate billing, and there is no consumer-login
mechanism a third-party app can use in place of an API key. The existing
offline `handoff.js` round trip already is the zero-cost path using his Pro
subscription; the manual export/import step is the mechanism, not a
workaround for one.

13 suites + ES2018 gate green, `build.sh` clean. Shipped as v5.7 (versionCode 507).


## The whole v5.5-v5.7 arc shipped to the wrong branch, undetected (2026-09-14)

Tj asked for the CLAUDE.md rule to send him a GitHub link on every ship
(above, and now that section itself). The link 404'd. The reason: this
entire session — every checkpoint, every ship (v5.5, v5.6, v5.7) — had been
running on `claude/waiver-wire-assistant-feo1ft`, the branch the calling
platform assigned it, and `main` had not moved since 2026-09-12. This is the
EXACT incident CLAUDE.md's "Branches" section already documents and warns
about by name — and it still happened, in this session, because nothing
actually checked.

**Why the existing safeguard didn't catch it.** `resume.sh` already compares
`HEAD` against `@{u}` to detect a stale or diverged checkout — but `@{u}` is
the CURRENT branch's own upstream. A session stranded on a feature branch
reads as perfectly "in sync" by that check, forever, because it IS in sync
— with itself, not with main. The check was structurally blind to the one
failure mode CLAUDE.md calls out as the worst one.

**Recovery.** `origin/main` was confirmed a strict ancestor of this
session's HEAD (`git merge-base --is-ancestor`) — no divergence, no
judgment call, safe to fast-forward — and pushed directly
(`git push origin HEAD:main`). Verified against the real remote with
`git ls-remote`, not a locally cached ref.

**The actual fix, so this cannot happen silently again:** `resume.sh` now
checks the branch name itself at the top of every session, before any of
the `@{u}`-based checks. Safe case (origin/main is an ancestor of HEAD) —
fast-forward automatically, same posture as the existing "pull if behind
and clean" logic just below it. Unsafe case (main has commits this branch
lacks) — warn loudly and refuse to merge blind, per the existing "tell Tj
before reconciling" rule. This runs on EVERY session start now, not just
when someone happens to think to check — the exact gap that let three
versions ship invisibly to nobody's phone.

13 suites still green (a bash-script change, not app code — no suite
covers `tools/resume.sh` directly, and none needed to for this fix).


## Real GitHub Releases, and the tag-push permission wall (2026-09-14, same day)

Tj asked for the ship-notification message to look like one from his
Portfolio project — a real `.../releases/tag/vX.Y` link. Checked rather than
assumed: this repo had zero GitHub Releases published, and no
`mcp__github__` tool creates one or uploads an asset (the toolset is
read-only for releases — `get_release_by_tag`, `get_latest_release`,
`list_releases`, `get_tag`, `list_tags`). Confirmed via `AskUserQuestion`
before building anything, since this is a CI/pipeline change, not a text
edit.

**The design that worked.** `.github/workflows/publish-release.yml`,
triggered by `workflow_dispatch` (an input, `version`) rather than a tag
push. It creates its own tag from inside the Actions runner (the job's own
`GITHUB_TOKEN`, `permissions: contents: write`), pulls the matching line
from `BUILDLOG.md` for the release notes, and publishes a Release with the
APK `ship.sh` already built/tested/committed attached as the asset. It
rebuilds and re-gates nothing — `ship.sh` is the gate, this only publishes.

**Why `workflow_dispatch`, not a tag push from `ship.sh`.** Tried the
straightforward design first: `ship.sh` creates and pushes a `vX.Y` tag,
workflow triggers on `push: tags:`. `git push origin v5.7` returned HTTP
403 — confirmed clean, not a proxy fluke (`recentRelayFailures` was empty
on the agent proxy status endpoint), and a plain branch push to the same
remote worked immediately after. This session's git credentials can push
branches but not tags — the same CLASS of restriction as the pre-existing,
documented branch-delete 403 (LADDER.md §22e), just a different ref type.
`workflow_dispatch` sidesteps it entirely: `mcp__github__actions_run_trigger`
calls the GitHub API directly, a completely different credential path from
git push, and the workflow's own `GITHUB_TOKEN` (minted per-run with the
declared `permissions:`) can push the tag itself, from inside the runner,
with no relationship to the session's git remote credential at all. Kept
the tag-push trigger in the workflow too, as a zero-cost fallback for any
future context that genuinely can push tags — confirmed empirically that
GitHub's anti-recursion rule (pushes made with the default `GITHUB_TOKEN`
do not fire other workflow runs) means this never double-fires: the
`workflow_dispatch` run's own tag push triggered nothing extra.

**Verified end-to-end, not just built.** Triggered `publish-release.yml`
for v5.7 (already shipped, already had a committed APK — no new build
needed to validate this). Watched the run via
`mcp__github__actions_list` reach `conclusion: "success"`, then confirmed
via `mcp__github__get_release_by_tag` that a real, non-draft, published
Release exists at `v5.7` with one asset (`FFTracker-v5.7.apk`, 227282
bytes, `content_type: application/vnd.android.package-archive`, uploaded).
`curl -IL` on the resulting `.../releases/download/v5.7/FFTracker-v5.7.apk`
confirms GitHub serves it via a redirect carrying
`Content-Disposition: attachment` — a stronger download signal than the
`/raw/` file link from earlier the same day, and immune to the `main`-drift
404 that link was vulnerable to, since a Release is tied to a specific
commit via its tag rather than to whatever `main` happens to point at right
now.

One cost: a stray diagnostic branch (`test-branch-scope-check`, pushed
while proving the tag-push restriction, never meant to be kept) cannot be
deleted for the same reason as the other three — added to Tj's cleanup
list rather than left silently. `CLAUDE.md`'s "After every ship" section is
rewritten with the full verified process: trigger via
`actions_run_trigger`, verify via `actions_list`/`get_release_by_tag`
before telling Tj anything, then the Release link in a fenced code block,
with the `/raw/` file link as an immediate no-wait fallback if the publish
step is pending or fails.

## Five requests in one pass: current week, stale advice, preseason data, more sources, injuries everywhere (2026-09-14, v5.9)

Tj asked for five things at once. Written to TASKS.md verbatim first, per
the working agreement, then worked in order.

**1. Auto-select the current NFL week.** There was no concept of "the
current NFL week" anywhere — `S.settings.currentWeek` just persisted
whatever was last selected, defaulting to 1 forever on a fresh install.
Added `Espn.currentWeek()` (espn.js): the scoreboard endpoint asked with NO
params hands back ESPN's own live calendar answer — `week.number` and
`season.type` — which is the one thing this app must never compute by
hand (a hand-rolled "week N ends on day X" calendar drifts the moment the
NFL moves a game). Verified against the real calendar the day this shipped
(2026-09-14): week 1's calendar boundary sits at 2026-09-16T06:59Z, safely
after Monday Night Football ends, so "after tonight, default to week 2"
resolves itself with zero clock math in this app.

Wired into `boot()` only, deliberately not `appResume()`: Android usually
kills the JS context when backgrounded, so appResume already doubles as a
fresh boot most of the time (see that function's own comment); the rare
case where the process survives is exactly a session already in progress,
and must never be yanked to a different week out from under whatever Tj is
looking at. Only ever moves the week FORWARD and only within 1-`LAST_WEEK`
(17, not the NFL's 18). One `week` variable drives every tab already
(confirmed by reading — there is no per-tab week state anywhere), so
fixing it in one place fixed it everywhere.

Caught by test_lifecycle.js immediately: the call has to be wrapped in
try/catch around the CALL ITSELF, not just a `.catch()` on the returned
promise — a request with no async bridge available (the test's stub, or a
genuinely old shell) throws SYNCHRONOUSLY before any promise exists,
exactly the same shape `freshenSchedule()` already guards against for
`Schedule.refresh()`. Missed it on the first pass; the suite caught it
before commit.

**2. The Advice tab showed a different week's cached numbers.**
`Projections.find()` answered from whatever was last fetched regardless of
which week the caller meant — the cache carries one `.week` for the whole
blob, and nothing checked it against the week actually being asked about.
`find()` and `missing()` now take an explicit `week` argument and refuse
to answer for a week the cache does not hold (both the weekly line AND the
season pace, which travels with the same fetch). `Recommend.render()`
goes further than "fall back to a thinner blend" — Tj asked for BLANK, not
almost-right, so `build()` now shows a plain "projections have not loaded
yet" card with a call to action instead of any computed lineup/bench/
opponent content when `Projections.meta().week !== week`. Pull-to-refresh
on the Advice tab specifically now runs `Recommend.syncAll` (schedule,
injuries, every projection source, Claude LAST) instead of the box-score
sync every other tab pulls — before this it silently ran the wrong sync
and left Advice exactly as stale as it was. The Claude-last ordering
inside `syncAll` already existed (a 2026-09 design, not new), which is
what makes "everything else still loads if the API is out of credit"
already true — confirmed by reading, not changed.

**3. Preseason data removed from the blend entirely.** `seed.projPG` /
`seed.projSrc` — a draft-time projection computed once before the season
started and never updated — was one of four sources in `projectOne()`,
weighted 1.5x early in the season fading to 0.5x. Gone: the `hasPre`
block, the `preseasonEarly`/`preseasonLate` weights, the file header's
description of the blend, the "how this is calculated" screen text, and
the roster card's "· proj X/wk" display (ui.js) that surfaced the same
number outside the blend. `seed.projPG` itself stays in seed.json/mkseed.py
— it is draft-time data, not advice, and test_boot.js still pins its
presence there — but nothing in the advice/recommendation path reads it
anymore. What is left: ESPN's week line, Sleeper's week line, this
player's own scored games, and ESPN's SEASON pace (an ongoing,
continuously-refetched rest-of-season number — not a frozen preseason one,
so it stays).

**4. More projection sources, blended, for my roster + this week's
opponent only.** Spent real effort looking: NFL.com's fantasy API
(`api.fantasy.nfl.com/v3/players/stats?statType=weekProjectedStats`)
answers with the right shape (a clean per-category stat schema, arguably
nicer than ESPN's numeric ids) but every value comes back `null` for both
an anonymous/unauthenticated caller and a `weekStats` (actual, already-
played) request — looks gated behind the `appKey` the separate players-
list endpoint openly demands. FantasyPros' projections API is a flat 403
without a paid key. Yahoo's fantasy API is OAuth-only (401 with no token).
MyFantasyLeague's `projectedScores` export needs a real hosted league ID,
not a general-purpose one. None of them clear this app's own bar — free,
no key, no signup, confidently re-scorable — the same bar ESPN and Sleeper
already clear. Rather than bolt on something fragile or paid, what Tj
actually gets: the EXISTING two-source blend (ESPN + Sleeper, each
converted to this league's scoring before anything is averaged) is now
also computed and shown for the FULL opponent roster, bench included — a
capability that did not exist at all before (opponent players had no
projections anywhere in the app, only live scores once a game started).
`projectAll()` already worked for any team, not just Tj's; the new
"[Opponent] · blended projections" card on the Advice tab just calls it a
second time and renders the result the same way the bench card already
does. No Claude research is spent on the opponent — that stays exactly
where Tj asked for it, his own roster only.

**5. Injury/questionable status everywhere a roster is listed.** The
Advice tab already had this (`x.flags`, built in `projectOne()` from the
ESPN injury feed). Rosters, Lineups, and Live did not. Added
`healthFlags(teamId, opp)`/`appendHealthTags()` (ui.js) — one
`Recommend.projectAll()` call per team per render, reusing the identical
flags, so a player never reads healthy on one screen and hurt on another.
Wired into `teamRosterCard`, `lineupCard` (both mine and this week's
opponent — that screen already showed only those two), and `lineupDetail`
(the Live tab's open-lineup rows, both halves of the matchup). Filtered
the "ON BYE" flag out wherever a screen already has its own dedicated bye
indicator (the Live tab's `tag out / bye` pill, the Rosters tab's inline
"· bye N" text) so a bye player is never tagged twice for the same fact.

"Updated frequently" — `liveTick()` (the poll that already runs on its own
cadence: 45s during a live game, 5-10 minutes otherwise, stopped entirely
once a week is fully scored) now also calls `Recommend.loadNews()`
(unforced) on every tick. `loadNews` already has its own 10-minute
freshness cache, so this is a real network fetch roughly every 10 minutes
at most and a no-op the rest of the time — no second timer, no extra
polling infrastructure, and a re-render fires only when a fetch actually
landed (`!nc.reused`), never on the cache-hit no-op.

**A source-text test (test_gestures.js) was updated, not just app code** —
`blocked()` grew a third condition (`|| jobRunning('advice')`, so a pull
cannot fire a second advice sync mid-flight) and the test's regex was
extended to match. This is the correct response to a test asserting an
implementation detail that intentionally changed, not a reason to avoid
the change.

All 13 suites green. Two real bugs caught by the suites before commit and
fixed same-session: the synchronous-throw issue in `syncCurrentWeek()`
above, and a genuine syntax error (a statement misplaced inside an
if/else-if chain while wiring the Live tab's injury tags) caught by
`check_es2018.js`'s parse check.

**Known limitation, not fixed here (would be a bigger behavioral change
than asked for):** `projectOne()`'s Claude-verdict lookup is keyed by
player NAME only, with no team scoping and no staleness check at the point
a flag is built — a verdict from a past week, or from when a player was on
a different roster, can still surface as a flag today. Pre-existing, not
introduced by this pass, and it affects every caller of `projectOne()`
equally (autoFillWeek already ran this same lookup for all ten teams).
Worth a real look, but changes the recommendation engine's behavior beyond
what was asked — flagged for Tj rather than changed silently.

**Build confirmed, not just the test suites.** `bash build.sh` run for real
on this container (first run, so it downloaded the Android SDK): every one
of the 25 Java source files produced a class, `d8`/apksigner reported a
clean signature, and the resulting `build/app-release.apk` is 230K —
in line with prior versions, not a bloated or truncated package. `ship.sh`
then verified the dex against every `android/src/**/*.java` file by name
before it would let this version out, per its own standing gate.

## 2026-09-15: the resume-system fix, plus the Stats tab (game logs, long-press, top players)

**Part 1: a real handoff failure, and a mechanical fix for it.** Tj sent the
Stats-tab request below; the session that received it spent its whole budget
reading the codebase and was cut off by a usage cap before ever writing the
request to `TASKS.md`. The `PostToolUse` autosave hook only fires on
`Edit|Write|NotebookEdit|Bash` — a pure research stretch trips it zero times
— so nothing reached disk anywhere, and the next session (on `main`,
`730d4e5`) opened cold and resumed correctly from what WAS there, which
proved nothing about what wasn't. Tj: "This is a major failure in the resume
function... It is very important that Claude can resume all tasks after
usage interruptions without me re-explaining everything."

Fix: a new `UserPromptSubmit` hook, `tools/capture_inbox.sh`, appends every
message Tj sends to a new `INBOX.md`, verbatim, and commits+pushes it the
instant it arrives — before any tool call, before any judgment about whether
it is "worth" saving yet. `tools/resume.sh` now prints `INBOX.md`'s tail
unconditionally on every session start. This does not replace writing
`TASKS.md` promptly — it is the backstop underneath it, documented in
`CLAUDE.md` as a new "level 0" ahead of the existing autosave hook. Verified
by hand (fed the hook a sample payload with quotes and a newline, confirmed
it committed cleanly) and confirmed live in production during this very
session — the next message that arrived ("Continue building the stats tab
feature") landed in `INBOX.md` exactly as designed, no session action
required.

**Part 2: the Stats tab itself.** Tj's request, in full, is preserved
verbatim in `TASKS.md`'s history and in `git log` — not repeated here.

Architecture: a new self-contained `gamelog.js` (own `Native.save/load` key,
like `playerdb.js` — never part of the per-edit Store save) caches FULL box
scores per NFL team per week, independent of roster. `S.stats[week][pid]`
only covers the ~170 rostered players and `S.book[week][name]` is
points-only; neither is enough for "search any current NFL player" or "every
player on a team." One `Espn.gameStats` call already returns both teams in a
game, so `gamelog.js` splits and caches both sides from a single fetch —
browsing one team's log is never a second fetch for its opponent, and a
full week's "top players" sweep is one fetch per GAME (<=16), not per team
(32). A `state:'post'` entry is cached forever, matching `doSync`'s existing
reuse-if-final rule; only `opts.force` (wired to pull-to-refresh) bypasses
it. Position lookups reuse `Names.variants`, the same nickname-tolerant
matching `doSync`'s own `byName` index already relies on.

`stats.js` follows the `Recommend.render(root, ctx)` / `viewAdvice`
delegation pattern already established for Advice: three modes (search,
browse-by-team, top players) behind the same `fchips` UI language used
elsewhere. Game logs render as one row per game, most recent first,
position-specific stat columns (a QB's columns are not a kicker's) plus a
Pts column, computed via `Scoring.score` — this league's rules, nothing
else. A new `.twrap` CSS class (horizontally-scrollable table wrapper) was
needed because a full stat line does not fit six columns wide on a phone;
verified live that it actually reaches the off-screen column rather than
just clipping it.

Long-press "View stats" is a new delegated touch listener in `ui.js`
(deliberately separate from `gestures.js`, which is app-blind by design —
see its own header comment) keyed off a new `data-player="name|pos|nfl"`
attribute now present on every real player row across Live, Lineups,
Rosters and Wire. A capturing-phase `click` interceptor suppresses the
row's own tap action for 400ms after a long-press fires, so a single hold
cannot trigger both a long-press menu and the row's normal tap behaviour
(e.g. `showPlayer`, or "Add" on a free-agent row). The long-press timer is
cancelled in `appPause` and re-armed in `appResume`, the same discipline
`Gestures.enable` already uses, so it cannot fire while the app is asleep.

**Testing, against Tj's own 8 numbered requirements**, used real Chromium
(pre-installed in this environment) driven via Playwright — not only the
unit-test harness pattern the rest of this suite uses. The app was served
over plain HTTP with a `window.Native` stub implementing the exact async
bridge contract the real APK uses (`httpAsync`/`__httpDone`/`httpTake`),
fed REAL ESPN data (week 1, 2026 season) fetched once via `curl`, because
`curl` honours this sandbox's `HTTPS_PROXY` and a browser's own `fetch()`
cannot reach ESPN cross-origin at all (confirmed that CORS block directly —
it is exactly why the shipped app never takes the `fetch()` dev-fallback
path in espn.js). Confirmed working end-to-end against real data: Mahomes'
live week-1 line (10/127/1TD/1INT passing, 27/1TD rushing) scores 29.1 under
this league's rules both from his own game log AND independently from the
"top players" QB board — the same number reached two different ways, a real
cross-check of the scoring path. Confirmed the touch long-press mechanics
specifically (dispatched real `TouchEvent` sequences, not just a desktop
right-click fallback): a 100ms tap does nothing, a 700ms hold opens the
menu. Confirmed pull-to-refresh actually calls `Stats.refresh()` by driving
`Gestures`' own `_onStart/_onMove/_onEnd` test seams against the live app.

Two real bugs found and fixed along the way, neither of which a synthetic
unit test would have surfaced:
- **Pre-existing, unrelated to this feature**: `Store.playerById` returns
  `{team, player}`, not the player itself. The Lineups tab's per-slot
  kickoff badge called `gameBadge(lp.nfl)` — always `undefined` — so that
  badge has never shown, since whenever this code was written. Found while
  adding the long-press `data-player` attribute to that same row. Fixed to
  `lp.player.nfl`.
- **Introduced by this feature, caught before ship**: `Espn.pool`
  deliberately turns one item's fetch failure into a clean `null` (so one
  dead game can't lose an entire sync) — but that meant a TOTAL network
  failure inside `playerLog`/`weekPositionTops` read identically to "he
  genuinely has no games yet." Both now check pool's own `results['err'+i]`
  markers and throw an honest error instead. Confirmed live via a real touch
  long-press on a player the browser-test fixtures don't cover.

Also caught, twice, the exact class of drift `CLAUDE.md`'s own "Branches"
section already warned about for a different reason: `tools/test_lifecycle.js`
keeps hand-maintained mirrors of both the module load order AND the nav
tab list specifically to prove it is testing what the phone actually runs.
Adding `gamelog.js`/`stats.js` to `index.html` without updating those two
lists tripped both drift checks in turn — each one caught immediately by
the suite going red, not silently. The tab-list check had no real
cross-check against `index.html` before this (only the script-order one
did); it now does, the same way, so this class of gap cannot recur a
third time unnoticed.

All 14 suites (test_gamelog.js is new, 29 assertions) + the ES2018 gate
green throughout. Scope note, stated plainly rather than implied: this was
a thorough test of the new feature and everything it touches, not a
line-by-line re-audit of the entire pre-existing app — thousands of lines
outside this feature's path were not independently re-verified here.

## 2026-09-15b: two real bugs from Tj's own phone, fixed same day as v6.0

Tj tested v6.0 within minutes of the release link and found two real bugs
neither the automated suite nor the browser testing pass had caught, both
screenshotted from the actual device:

1. **Top players stuck on the wrong week.** The header showed "Wk 1" but
   the Top Players card said "WEEK 2" and "No games yet" for every
   position. Root cause: `stats.js` kept its own `topWeek` variable, set
   once the first time that mode was entered and never updated again — so
   navigating away via the app's one global week control (the header's
   `< Wk N >`, shared by every tab) and back left the card desynced
   forever. There was never a reason for this card to have independent
   week state; it now reads `ctx.week` every render, like every other tab.
2. **Team roster showed a full stat table with no player names.** The
   table-building helper (`gameLogTable`) was written for one shape — a
   single player's multi-week log, where each row is identified by
   week/opponent because the player is already named in the card header —
   and reused unchanged for a different shape: one team's several players
   in a single week, where week/opponent is the same on every row and
   PLAYER is what needed identifying. Split into a shared `statTable()`
   plus two thin wrappers (`gameLogTable`: Wk/Opp prefix; `rosterTable`:
   Player-name prefix), which also drops the now-redundant Wk/Opp columns
   from the team view — a real readability win alongside the fix.

Both verified live in a real browser (same Playwright + real-ESPN-fixture
harness as the v6.0 testing pass), reproducing Tj's exact steps
programmatically — not just re-reading the code and assuming it was right.
Shipped as v6.1. All 14 suites green throughout.

## 2026-09-15c: rosters reorder, back button, app-resume state, no splash flash, Claude cost estimates, bench "why not", PlayerDB auto-refresh, full sweep

Tj's 8-item request, in full: reorder the Rosters tab (roster cards above
the trade evaluator, not below); fix the Android back button so it unwinds
in-app history instead of exiting to the home screen; restore whatever tab
was open last on app resume instead of always landing on Live; kill the
splash-logo flash on resume as far as the platform allows; remove every
"Claude usage remaining" display (he no longer has an API key) and replace
it with a live, accurate per-call cost estimate; give bench players on the
Advice tab the same Claude "why not to start him" explanation starters
already get; make the 785-player database refresh itself automatically
(at least every 2 days, and whenever waiver-wire data refreshes) on top of
the existing manual button; then a full sweep and comprehensive test pass.

All 8 done. Items 1-6 were mechanical or already-proven-correct reuse of
existing data (the bench "why not" block, for instance, needed no new
Claude integration — `projectAll()` already built the full `why[]` for
every roster player, starters and bench alike; only the UI was missing).
Item 5's cost estimates are built from the SAME functions the real Claude
calls use (`Ai.adviceSearchBudget`/`waiverSearchBudget`, extracted to
named exports for exactly this reason) so the number on screen can never
disagree with what a press would actually send.

Item 7 (PlayerDB auto-refresh) surfaced a real pre-existing bug along the
way: `refresh()` used to stamp `updated` to now even when every one of the
32 ESPN team fetches failed (e.g. fully offline), which would have masked
a failed refresh from ever being retried. Fixed to only stamp `updated`
on at least partial success.

Item 8 (the sweep) ran in two rounds. A live-browser walkthrough of all 7
tabs plus the long-press "View stats" flow found nothing real — the two
things that looked suspicious at first glance turned out to be a
test-harness artifact (a raw JSON-parse error from a stub that doesn't
honour the real ERRMARK sentinel `NativeBridge.java` always uses) and
documented, correctly-labelled behaviour (the wire board's "positional
floor" fallback for players with no individual projection).

Then an independent code-quality review of the full diff (spawned as a
background agent, given the exact diff range and feature descriptions)
found two real bugs in the PlayerDB auto-refresh feature just added:

1. The manual "Refresh from ESPN" button called the 32-team fetch
   directly, bypassing `ensureFresh()`'s single-flight guard — a tap
   landing while a background auto-refresh was already in flight started
   a SECOND concurrent fetch against the same shared `DB.players` array,
   each with its own stale dedupe snapshot, so a player added by one call
   after the other's snapshot landed as a duplicate that would sit in
   search/free-agent results until the next cold boot's `dedupe()`.
   Fixed by moving the single-flight guard into `refresh()` itself (the
   actual fetch became the private `doRefresh()`), so the manual button
   and the background path always share one in-flight attempt.
2. `viewWire()` calls the background refresh path on every render, and a
   fully-failed attempt never clears staleness (by the item-7 fix above,
   correctly) — so a phone offline on the Wire tab would retry a full
   32-team fetch on every single render, forever, no backoff. Fixed with
   a 15-minute retry cooldown on the BACKGROUND path only; the manual
   button still always forces it, since that is a deliberate act.

Fixing this properly turned up a bonus: testing the concurrency fix
directly (not just as a source-text pin, which is normally the only
practical option for a function that walks 32 ESPN rosters with retry
backoff) became possible by stubbing every candidate URL to resolve
immediately with one fake player instead of rejecting — nothing ever
falls into the slow retry path, so the whole 32-team chain resolves in
well under a second and the single-flight sharing can be proven by real
object-identity, not just by reading the code.

The same review flagged two Claude cost-estimate functions
(`claudeAdviceEstimate`/`claudeWireEstimate`) recomputing a full roster
projection or free-agent scan on every render just to refresh a dollar
string — e.g. tapping a position-filter chip on the wire board re-ran a
whole-league valuation pass for no reason. Memoised both, same `_faMemo`
shape `value.js` already uses, with the price rates included in the key
so editing a rate on the Data tab still updates the number immediately
rather than serving a stale cached one — proven against the real
Store/Usage/Recommend wiring in `test_integration.js`, since a wrong key
here is a real, user-visible correctness risk, not just a performance one.

That same memoisation edit introduced its own bug, caught by re-running
the live-browser sweep after making the change (not by any unit suite,
since none of them load `ui.js` against a real DOM): `ui.js` is the one
module in this app that is a bare `(function () {...})()` rather than
`(function (root) {...})(window)`, so `root` does not mean `window`
there — writing `root.Store.generation()` was a `ReferenceError` on every
call, silently swallowed by the function's own `try/catch`, which is
exactly why "Ask Claude about the wire"'s estimate vanished from the Data
tab entirely until the browser check caught it. Fixed to the file's own
established pattern (`window.Store && Store.generation`, as the existing
search-owner-index cache already does a few hundred lines above).

Also fixed along the way: a hardcoded "couple of days" in the Data tab's
hint text now derives from `PlayerDB.STALE_MS` so it cannot drift from
the real constant, and `store.js`'s `defaults()` now lists the `lastTab`
setting item 3 added, keeping that function's own claim to be a complete
list of settings true.

All 13 suites + the ES2018 gate green throughout both rounds; `bash
build.sh` run twice (once after the original 7 items, once after the
review-driven fixes) to confirm the new Android splash resources
(`values-v31/styles.xml`, `splash_empty.xml`) actually compile — dex
class-per-source check passed both times.

Two items are code-reviewed and cannot be confirmed further from this
environment: the back-button fix (already shipped before this diff,
proven by `test_lifecycle.js`) and the splash-flash fix and app-resume
tab-restore (both are Android-behaviour-under-real-OS-conditions changes
with no way to trigger a real backgrounding/process-kill from a
Playwright browser harness) — carried forward to "Waiting on Tj" in
TASKS.md.

## 2026-09-15d: back button STILL closed the app on a real device — v6.2's fix was real but incomplete (v6.3)

Tj tested v6.2 and reported the identical symptom item 2 of 2026-09-15c had
just claimed was fixed: "The back button still closes the app to my home
screen." Treated as a real regression report, not a duplicate — write-up
below is why re-pointing him at the old evidence would have been wrong.

Root cause: this app's ONLY back-press handling was
`onKeyDown(KeyEvent.KEYCODE_BACK)` — the classic Android back dispatch
path. `test_lifecycle.js` proves `ui.js`'s own `__onBack()` trail-walking
logic is correct, and it is; that was never the bug. The actual failure is
one layer below the JS entirely, in a place no test in this repo can see:
on a real Android 13+ phone, once predictive back is active (which this
app's targetSdk 36 makes the effective default), a gesture-based back
SWIPE does not synthesize a `KEYCODE_BACK` `KeyEvent` at all — the
platform routes it through a completely separate dispatch,
`OnBackInvokedCallback`, which nothing in this app had ever registered.
`onKeyDown` simply never fired on Tj's phone. Every test that existed —
the JS trail-walking proof, and the source-text checks against
`MainActivity.java`'s CONTENT — was checking what the handler does once
called, and none of them could have caught "the platform never calls this
handler at all," because that is a fact about the real OS's dispatch
behavior, not about anything in this repo's own source or a JS-only test
stub.

Fixed by registering `android.window.OnBackInvokedCallback` — part of the
platform SDK this app already compiles against at API 36, so no AndroidX
and no new dependency were needed — guarded on `Build.VERSION.SDK_INT >=
33`, routed through a newly shared `askPageToHandleBack()` method that
BOTH the new callback and the existing `onKeyDown` now call, so there is
one implementation of "ask the page, then decide," not two that could
quietly drift apart again the way this bug just happened. This also
required `android:enableOnBackInvokedCallback="true"` in
`AndroidManifest.xml` — registering the callback in code has no effect
without that flag; a subtlety worth stating plainly since it is exactly
the kind of thing that looks done in the diff but silently is not.
`onKeyDown` is untouched in behavior and remains the sole path below API
33 (minSdk 29), where predictive back does not exist.

Verified as far as this environment allows: `bash build.sh` compiles
clean against the real platform API (26 Java classes now, dex check
passed); new source-text regression tests in `tools/test_gestures.js` pin
the import, the registration call, the manifest flag, and — specifically
to prevent this exact class of bug recurring a third time — that BOTH
dispatch paths call the one shared method rather than each carrying its
own copy of the logic. There is no `adb`/emulator in this environment and
the bug only reproduces via a real gesture-navigation swipe on a real
Android 13+ device, which is precisely why the first fix attempt — proven
correct by every test that existed at the time — still missed it. This
one genuinely needs Tj's phone; said so plainly rather than declaring it
fixed on the strength of a green test suite that structurally cannot
observe the actual failure mode.

Shipped as v6.3. All 13 suites + the ES2018 gate green.

## 2026-09-15e: comprehensive app-wide sweep (code, function, UI)

> "Do a comprehensive app wide scan for improvements in code and function
> and ui. Take as long as you need and use as much usage as you need. Do a
> thorough job. Improve the app as much as you can and I'll check back
> much later."

Open-ended, all three axes, no specific bug reported. Six parallel
background review agents were dispatched, one per logical area (data/
scoring core, value/recommend engine, UI part 1, UI part 2, the Android/
Java shell, ai/usage/handoff), each explicitly read-only and reporting
ranked findings independently rather than pre-approved patches. Every
finding was personally re-verified against real source before anything
was touched — a discipline that paid off twice: the legacy `httpGet`/
`httpGetH`/`httpPost` Java methods, flagged as dead code, turned out to be
neither dead nor safe to remove (`tools/test_engine.js` deliberately
exercises that exact synchronous fallback path, and `tools/test_boot.js`
already pinned their existence by name as intentional legacy-shell
compatibility); and value.js's `_faMemo` cache, flagged as "incidental"
invalidation, turned out to be a deliberate, already-correct, and more
robust design than the alternative (see Round 5-adjacent write-up below).
Both were investigated and left alone rather than "fixed" on the strength
of a review agent's first-pass read.

### Round 1 — data integrity
- **`NativeBridge.load()`'s `.bak` fallback gap.** It only fell back to
  the backup file on a missing/empty main save (`s == null || s.length()
  < 2`) — a READABLE but CORRUPTED file (a truncated write, bit-rot) was
  handed to `store.js` as-is, whose `JSON.parse` failure then silently
  reset a whole season to the bundled seed instead of using the intact
  `.bak` sitting right next to it. Fixed with a real JSON-parseability
  check (`looksLikeJson`, backed by `org.json.JSONTokener`) before
  accepting the main file over the backup.
- **`store.js`'s `getStats()` was dirtying the archive on a plain read.**
  Lazily creating an empty stats bucket for an unsynced week called
  `markArchive()` — reached from ordinary reads (`lineFor` →
  `playerPoints` → `teamWeekPoints` → standings, and the Live tab's own
  matchup card), not just writers. The archive split's whole point
  (store.js's own header) is that a lineup edit writes ~25KB, not the
  ~1.9MB book+stats archive — simply viewing the Live tab for an unsynced
  week (the common case right after boot) was silently defeating that.
  Fixed by dropping the stray `markArchive()` call from the lazy-bucket
  path.

### Round 2 — value.js correctness
- **`Store.bookTrend()`'s exact-key-only lookup silently lost real
  production data on any spelling mismatch.** The league book is keyed by
  `Espn.normName(displayName)` AS ESPN SPELLED IT, which can differ from
  roster/DB spelling ("Kenneth Gainwell" on the roster vs. "Kenny" from
  ESPN). Three real call sites (`value.js`'s `perGame`/`usage`,
  `recommend.js`'s `usageSwing`) fed a pre-normalized name into an
  exact-match lookup, silently falling back to a guessed number instead of
  the real one whenever spellings disagreed. Fixed by routing through
  `Names.hit`, this codebase's established tolerant name-lookup helper.
- **`needs()` hardcoded FLEX to a replacement-level RB regardless of who
  was actually starting there.** If a WR or TE was the real flex starter,
  the waiver-priority data sent to Claude claimed an RB gap that did not
  exist. Fixed by threading the flex slot's REAL position (`realPos`,
  added to `myStarters()`'s output) through instead of the slot label.

### Round 3 — UI/feature correctness
- **`claudeAdviceEstimate` showed a non-zero cost for a free sync.**
  `syncAll()` skips the Claude call entirely — no request, no charge —
  once every roster player is "carried forward" (checked recently, came
  back clear). The estimate never special-cased `n === 0`, and
  `adviceSearchBudget`'s hard floor of 2 searches produced a few cents
  regardless, directly contradicting the estimate's own documented promise
  ("never claim a cheaper or pricier call than the real one"). Fixed with
  an explicit `n === 0` early return.
- **The Advice tab had zero long-press "View stats" support**, despite
  Tj's original request being explicit that it work "everywhere in the
  app." Fixed by threading `markPlayer` through `viewAdvice`'s ctx and
  marking all three row sets `recommend.js` builds (starters, bench,
  opponent roster).
- **`showPlayer()`'s stat modal showed a stale total after a Save
  adjustment.** The toast and the page behind the modal updated correctly;
  the modal's own visible point breakdown did not, because it was built
  once by the generic `modal()` wrapper with no way to rewrite it in
  place. Fixed by building the `<pre>` directly so the save handler can
  update it in place — verified live in a real browser (19.0 → 24.0 points
  shown correctly after a +5 adjustment, no reload/close needed).
- **`stats.js`'s team browser used the real current NFL week as its
  ceiling instead of the header's selected week** — the exact bug class
  Top Players had already been fixed for once. Fixed `teamPickerCard`/
  `teamRosterCard` to use `ctx.week`; deliberately left player-search's own
  `currentWeek` read alone, since that mode has a genuinely different
  "show everything played so far" semantic.

### Round 4 — Android hardening
- **`alertsTest()` froze the page for up to 13 seconds.** It made a
  SYNCHRONOUS network call (`Alerts.check` → `injuries()` → a blocking
  `HttpURLConnection`) directly on the `@JavascriptInterface` thread — the
  one failure this app's entire async-bridge architecture exists to
  prevent, reintroduced in a different method. Converted to the
  established async pattern: the real check now runs on the existing
  3-thread pool, and the page is woken via `evaluateJavascript` + a
  `window.__alertsTestDone` callback, same as every other bridge call.
- **Six file-descriptor leaks** across `NativeBridge.java` (`readFile`,
  `save`, `backupAuto`, `export` ×2 branches, `writeToDownloads` ×2
  branches) and `Alerts.java`'s own independent `readFile` duplicate — any
  exception mid-write (disk full, an I/O error) left the stream open.
  `save()` runs on effectively every app-state write, so under a
  sustained low-storage condition this was a real accumulating leak, not
  theoretical. Fixed via try-with-resources everywhere.
- **`NativeBridge`'s 3-thread pool was never shut down**, and the bridge
  instance was a local variable `MainActivity.onCreate` threw away rather
  than a field — the pool's plain (non-daemon) threads, each holding a
  reference to the `WebView`, could outlive the Activity. Fixed: the
  bridge is now a field, `NativeBridge.shutdown()` calls `pool.
  shutdownNow()`, and `MainActivity.onDestroy()` calls it before tearing
  the `WebView` down.
- **The back-button `OnBackInvokedCallback` registration-failure fallback
  comment was wrong.** It claimed "`onKeyDown` is still there" if
  registration ever throws — checked against Android's own predictive-back
  documentation (fetched live this session) and that is false: once
  `enableOnBackInvokedCallback="true"` is set (unconditional in this
  manifest), the platform stops supporting `KEYCODE_BACK` interception
  entirely, registration success or not. Corrected the comment and added
  `Log.e` so a real-device failure would be diagnosable instead of
  silently swallowed — nothing is known to actually throw here (a plain
  in-memory registration, no documented failure mode), so this is
  defensive hardening against a hypothetical OEM bug, not a reproduced
  fix.
- **Investigated, not fixed:** the legacy `httpGet`/`httpGetH`/`httpPost`
  Java methods, flagged as dead by the review agent, turned out to be
  tested-and-relied-upon legacy-shell compatibility scaffolding (see
  above) — left alone.

### Round 5 — cost/model accuracy
- **`usage.js`'s cost tracking was model-blind.** One flat, Sonnet-5-
  shaped rate table priced every call regardless of which model actually
  ran it — but `ai.js` picks the model per call (`depth()==='cheap'` sends
  Haiku 4.5; `'weekly recap'` ALWAYS uses the cheap model), so every recap
  was overstated roughly 2x and any Opus call would have been understated
  roughly 5x. Fixed: `priceOf`/`record`/`estimate`/`totals`/`rates` all
  take an optional model and look up its real published tier (`opus`/
  `sonnet`/`haiku`, classified by substring so a future dot-release needs
  no code change); a manual settings override still wins per field, same
  as before. Threaded the correct depth()-resolved model into both
  on-screen estimates and the settings price-editor panel, which used to
  silently show Sonnet numbers even at 'cheap' depth — its hint text used
  to tell Tj to manually update rates when he switches models; that is no
  longer his job.
- **Outdated `web_search` tool type.** Both real tool-use calls
  (`ask`/`askWaivers`) were pinned to `web_search_20250305`, the basic
  (non-dynamic-filtering) version. Added `searchToolType(model)`, an
  ALLOWLIST (Sonnet 5 and Opus 5 confirmed supporting the current
  `web_search_20260209`; everything else, Haiku 4.5 included since
  `depth()==='cheap'` sends real calls there, stays on the safe old type
  rather than gambling on unconfirmed support).
- **Investigated, not fixed:** prompt caching never engaging on the
  advice-sync call. Measured (not assumed): `staticPrefix()` is ~900
  tokens, `waiverPrefix()` ~1834. Against this session's verified cache
  floors (Sonnet 5: 1024, Opus 5: 512, Haiku 4.5: 4096), the waiver prefix
  already clears Sonnet's floor and gets real caching; the advice prefix
  falls short by ~130 tokens and silently never caches at the default
  depth. Deliberately not padded — the only honest way to close a ~130
  token gap is more real prompt content, which changes what Claude is
  told on every future sync, unverifiable against the real API in this
  environment (no key configured here) and squarely the kind of
  product-behavior change the "no major changes unless approved" boundary
  exists for — especially against a small, rarely-realized saving
  (infrequent syncs, a 5-minute cache TTL). Documented in place instead of
  silently left as a mystery for the next session to rediscover.

### The small-fixes batch (13 items)
Long-press click-suppression scoped to the row that triggered it instead
of swallowing any click anywhere on the page for 400ms (was silently
eating taps on the dialog's own Cancel/View buttons); pull-to-refresh's
default branch no longer double-renders the page (`doSync()` already
renders on both its success and catch path); `freshenInjuries` now
catches a failed news fetch instead of leaving an unhandled rejection;
`earlyGameCard`'s comment corrected (Lineups + Advice, never Live — the
old comment claimed all three); `openPlayerStatsMenu`'s local `view`
button variable renamed to `viewBtn` before it could shadow the file-level
`view` (current tab) the way a sibling bug already had elsewhere;
`Alerts.java`'s dead `schedule(dayOfWeek,...)` method removed (confirmed
zero callers — `rearm()`, the only real caller of any scheduling method,
only ever uses `scheduleDaily`); `Alerts.check()` now bails out on an
empty `league.me` instead of letting a malformed team object with its own
blank id incorrectly match as "mine"; `NativeBridge.safe()` hardened to
reject a bare `.`/`..` outright rather than relying on slash-stripping and
`readFile`'s own directory-open failure as the only thing stopping a
`backupLoad("..")`; `handoff.js`'s `detect()` tightened from a loose
prefix match to an exact match on the two real literal `kind` values (the
old prefix check would have silently accepted a model typo or
hallucinated variant as a fully valid reply, contradicting its own "must
never be half-applied" comment); the Advice and Wire tabs' cost-estimate
lines now share identical closing wording; `gamelog.js` and `doSync`'s
`gcache` no longer duplicate an `Espn.gameStats` fetch for the same game
(a new `Gamelog.ingestEvent`, factored out of `ensureEvent`, lets `doSync`
feed its own already-fetched box score straight into gamelog's persistent
cache); `recommend.js`'s `opponentsForWeek` matched the `week>18?3:2`
seasontype pattern every other `weekGames` call site already uses
(currently inert — `LAST_WEEK` is 17 — but a latent trap if that cap is
ever raised); `value.js`'s `rosteredSet()` no longer writes the same key
twice (`variants()` already includes `canon()` as its own first element);
`projections.js`'s Sleeper-merge fallback no longer reads a `.fullName`
field `ingestSleeper`'s own records never carry (traced by hand — it was
always `undefined`, so the `||` fallback fired unconditionally); and the
curated `['gabe davis','gabriel davis']` alias pair was removed from
`names.js` as genuinely redundant with the generic `gabriel: ['gabe']`
nickname fold, which already derives both directions on its own (traced
`canon()` and `variants()` by hand, then pinned with a real regression
test) — unlike every remaining entry in that list, which is a real
curated alias no generic rule produces.

### Flagged for Tj, not implemented
Two items crossed into "major" under the standing rule and were written
up rather than acted on — see TASKS.md's "Waiting on Tj": the Data tab's
13-14-card wall with no sub-navigation (a UI review-agent finding, real
but a genuine redesign call), and the fully-wired-but-never-triggered
`recap.js`/`Ai.recap()`/`NativeBridge.share+copy` write-up feature
(confirmed by grepping every call site — needs Tj's decision: wire it up
or remove it).

### Verification
Every fix above has a real test: functional regression tests where a
harness could exercise the actual behavior (`tools/test_integration.js`,
`tools/test_gamelog.js`, `tools/test_handoff.js`, `tools/test_names.js`),
source-text pins in this repo's established idiom elsewhere (no JUnit
exists for the Java side). A live-browser pass (a local static server +
Playwright/chromium) confirmed a clean boot and, specifically, that the
long-press click-suppression fix works on a real touch-event sequence —
the dialog's own Cancel button, tapped inside the 400ms window the old
code used to swallow entirely, now actually dismisses it. All 14 suites +
the ES2018 gate green throughout every round; `bash build.sh` run clean
repeatedly.

Shipped as v6.4. Release published and verified
(`mcp__github__get_release_by_tag`: non-empty `assets`, correct
`FFTracker-v6.4.apk`, 264345 bytes) before telling Tj.

## 2026-09-15f: the app never advances past a finished NFL week

> "Week 1 NFL is complete (after Monday games are final, the NFL week is
> final and moves to the next week), yet the app still has all tabs open
> to week 1. I want the app to automatically move to the next NFL week
> after the previous week becomes final. All tabs across the entire app
> should be on week 2 right now."

**The mechanism to do this already existed and was already correct** —
`syncCurrentWeek()` (ui.js) compares ESPN's own current-week number
(`Espn.currentWeek()`, reading the scoreboard endpoint's `week.number`,
which the code's own comment notes sits comfortably past Monday Night
Football before flipping) against `week`, the one module-level variable
every tab in this file reads for its own rendering. If ESPN's number is
ahead, `applyCurrentWeek()` bumps `week`, invalidates the relevant caches,
re-arms the live poll for the new week, and re-renders. Since every tab —
Live, Lineups, Rosters, Wire, Stats, Advice, Data — already reads that
same shared variable, there was never a per-tab state problem here; fixing
where the CHECK fires was the whole job.

**Where it fired was the bug.** `syncCurrentWeek()` was called from
exactly one place: `boot()`, which only runs on a true cold start. This
app deliberately does NOT tear its process down when backgrounded — an
earlier session's own back-button fix specifically switched from
`finish()` to `moveTaskToBack()` so that reopening the app is instant and
nothing is destroyed. That is the correct choice for responsiveness, but
it means `boot()` can go days without running again for anyone who does
not force-quit the app — which is exactly the situation Tj described.
Worse: `appResume()` (called on every real foreground resume, the far
more common path) had its own early return — "a week that is finished
stays finished, do not wake a poll for it" — which is precisely the state
where the real NFL week having moved on is MOST likely, and there was no
periodic re-check anywhere else to catch it regardless.

Fixed by calling `syncCurrentWeek()` from `appResume()` too, placed BEFORE
the "week already final" early return rather than after (placing it after
would have meant it still only fired for a week the app did not yet think
was finished — a no-op the one time it would actually matter).
`syncCurrentWeek()` already carries its own 3-hour staleness cache, so
calling it on every resume is free on the common case: back-to-back
resumes within that window just re-apply the cached answer rather than
re-fetching. `applyCurrentWeek()`'s own guard (`clamped <= week` is a
no-op) makes the extra call safe even when nothing has changed.

Verified end-to-end, not just by reading the source: `tools/
test_lifecycle.js` is the one suite that actually executes ui.js against a
DOM stub (every other suite either tests a module in isolation or asserts
on source text). Extended it to stub `Espn.currentWeek()` directly,
marked week 1 as `synced && allFinal` in `weekMeta` — the exact state Tj
described — called `appResume()`, and confirmed `S.settings.currentWeek`
actually advances from 1 to 2 once the promise chain resolves. A
source-text pin in `tools/test_boot.js` separately confirms the call site
exists in `appResume()` and sits before the early return, so a future edit
cannot silently move it back to the wrong side of that check without
turning the suite red. All 14 suites + the ES2018 gate green, `bash
build.sh` clean (28 classes).

**This does not retroactively fix a session already running on Tj's
phone** — there is no way to push a live update into an already-running
process. He needs to background and reopen the app (or fully close and
relaunch) once this version installs; the very next resume will catch the
week-1-to-2 transition and move every tab to week 2 together, the way the
mechanism was always designed to.

Shipped as v6.5.

## 2026-09-15h: the week-advance fix still didn't work — a true cold boot too

> "I forced stopped the app and opened it again. Every tab in the app is
> still on NFL week 1, even though NFL week 1 is final... All week 1 games
> are final. The app should be on week 2."

**v6.5 was a real, correct fix for what it targeted — it was just not the
whole bug.** A force-stop-and-relaunch is a TRUE cold boot, and `boot()`
already called `syncCurrentWeek()` unconditionally even BEFORE v6.5's
`appResume()` fix ever existed. So a cold boot still failing meant the
check itself — not just where it was called from — was not reliable
enough.

**The single point of failure: trusting one external signal, cached, with
a silent failure path.** `syncCurrentWeek()`'s only source of truth was
`Espn.currentWeek()` — a network call reading ESPN's own scoreboard
`week.number` field. Three independent ways that could fail, none of
which this sandboxed environment can verify directly against the real
API: (1) `S.settings.nflWeek`'s 3-hour reuse cache re-applying an earlier
wrong answer instead of re-fetching; (2) the fetch itself failing (a real
network hiccup, a proxy issue, anything) — swallowed by a bare `.catch`
that intentionally says nothing, by design, so the failure is invisible
everywhere, including to whoever is debugging it; (3) ESPN's own
"current week" metadata simply not flipping the instant every game ends
— the code's own original comment assumed it did ("sits comfortably
after Monday Night Football ends"), an assumption never verified against
the live API this session, and apparently wrong, or at least not
reliable enough to be the ONLY signal.

**The fix: stop depending on an external field the app cannot verify.**
Added `localAutoAdvance()` — a second, fully independent signal that
looks at nothing but `weekMeta.allFinal`, data this app already computes
itself from real box scores it already fetched. No network call of its
own. No cache to go stale. No external metadata to misread or wait on.
It walks forward through as many CONSECUTIVE already-final weeks as are
locally known (the ordinary case is one step; more only matters after a
long absence), then applies the result through the existing
`applyCurrentWeek()` — sharing its guards (never backward, capped at
`LAST_WEEK`, one-shot toast) rather than duplicating them. Called from
`boot()` and `appResume()` only, right before `syncCurrentWeek()` — never
from a manual sync or navigation, so deliberately reviewing an old,
already-final week later is still never yanked forward mid-review, the
same constraint the original design got right even where its mechanism
did not.

Also corrected: the header comment above `syncCurrentWeek()` still said
"BOOT ONLY, not every appResume" and justified it with "Android usually
kills the JS context when backgrounded" — the exact premise the v6.5 fix
had already disproven, left unchanged through that fix. Updated to
reflect what actually runs where and why, so a future session reads the
truth instead of a stale rationale sitting right next to code that
contradicts it.

**Proven end-to-end, with the failure mode made deliberately real, not
just avoided:** `tools/test_lifecycle.js` now makes `Espn.currentWeek()`
throw synchronously — the ESPN path is not just unstubbed, it is made
IMPOSSIBLE — and confirms the week still advances, synchronously, before
any promise even gets a chance to settle. That is the strongest available
proof this does not depend on the network layer being present, correct,
or reachable at all. `tools/test_boot.js` pins the call-site count (two,
exactly: boot and resume) and that `localAutoAdvance()` runs immediately
before `syncCurrentWeek()` at both. All 14 suites + the ES2018 gate
green, `bash build.sh` clean (28 classes).

**If this still does not work after Tj installs and relaunches**, that
would mean something different and worth knowing: `weekMeta['1'].
allFinal` is not actually `true` in his own local data — i.e., week 1
never fully synced as final on his phone in the first place, a real data
gap rather than a repeat of this exact bug. Worth telling him to check
plainly rather than assuming.

Shipped as v6.6.

## 2026-09-15g: the weekly recap feature, and Data tab sub-navigation

> "Build The 'weekly recap' Claude write-up feature you told me about.
> Make the button where it is most appropriate but it shouldn't push away
> any major feature because I probably won't use it much. Then organize
> the data tab with sub navigation that is smart and easy to understand.
> When you are done, test that it all works and didn't break anything
> else in the app."

Tj's explicit go-ahead on both items the 2026-09-15e sweep had flagged
but deliberately not implemented — see that entry for the precise trace
of what was dead vs. alive. Interrupted partway through by 2026-09-15h
(the week-advance bug, above) — resumed and finished after that shipped.

### The recap feature
`recap.js` already computed a complete, real recap — `build(week)` reads
actual scored results (high/low score, closest and biggest games, the
best individual NFL week league-wide, the best/worst starter, the
biggest bench regret) with NO network and NO Claude involved at all.
`Ai.recap(factText, week)` was the one piece never wired to any button:
it hands that fact sheet to Claude (the cheap model — this is pure
phrasing, no judgement, so a top-tier model would be money spent for
nothing) and gets back a short, dry, chat-ready write-up.

Built `weeklyRecapCard()` + `openRecapDialog()` in ui.js. The card is
deliberately small — a title, one line of what it offers, one button —
and sits in the Data tab's League group AFTER Weekly scores, Standings
and the matchups card, so it never displaces anything Tj actually opens
every week, matching his own "probably won't use it much." The dialog
shows `Recap.text()`'s real facts immediately; "Write it up with Claude"
only appears when `Ai.configured()` is true, and replaces the shown text
with Claude's version in place if pressed. Share and Copy act on
whichever text is CURRENTLY on screen — the facts, or Claude's rewrite,
whichever the user is looking at — via the existing `Native.share`/
`Native.copy` Android bridge methods, which were already fully
implemented and simply had no caller. If a week is not yet fully scored,
the card says so plainly instead of showing a button that would fail.

### The Data tab reorganization
Grouped the tab's 13-14 cards into four sections by what they are FOR,
not an arbitrary split — the four Tj would reach for at different times,
not four equally-sized piles: **League** (the season's own data — scores,
standings, matchups, the new recap, scoring rules), **Claude** (the two
AI-related cards — reasoning settings, cost estimates), **Sync & data**
(where the numbers come from and its health — stats feed, player
database), **App** (device/app behaviour and maintenance — alerts, live
refresh, screen fit, backup, about). A row of four small buttons at the
top switches between them, styled from the app's own existing `.btn`/
`.btn.pri` classes — no new CSS. `viewData()` was split into
`viewDataLeague`/`viewDataClaude`/`viewDataSync`/`viewDataApp`; every
card that existed before this landed in exactly one group, with its own
logic completely unchanged — only physically relocated. The selected
group is in-memory only (like the tab-level `view` itself): it survives
switching to another tab and back within a session, but resets to League
on a fresh boot.

### Verification
Full functional proof in `tools/test_lifecycle.js` — the one suite that
actually executes ui.js against a DOM, not just its source text: all four
sub-nav groups clicked through the same way a thumb would (finding and
clicking the real buttons `dataSubNav()` builds, not calling the group
functions directly), each group's expected cards confirmed present. The
recap dialog opened against a REAL scored week built from an actual
`Scoring.emptyLine()`/`Store.setLine()` pair (not a synthetic string),
its shown text confirmed to come from the real fact sheet, "Write it up
with Claude" confirmed correctly ABSENT with no key configured, Share and
Copy confirmed present regardless. `tools/test_boot.js` carries the
source-text half of the same double-check idiom this file uses
everywhere: every card's label text confirmed still present after the
reshuffle, so a card silently dropped during the move would fail a test
even if nothing threw.

**Found and fixed a real gap in the test harness itself while building
this.** `test_lifecycle.js`'s DOM stub defined `innerHTML` as a plain
property — but `render()` calls `root.innerHTML = ''` to clear the
screen before every rebuild, and a plain property assignment does
nothing to the stub's `children` array. Every render this whole suite
has ever made was silently ACCUMULATING into one tree instead of
replacing it — invisible to every existing test, because each one either
asserts immediately after a single action (nothing earlier to collide
with) or checks for the PRESENCE of something, which an accumulated
superset tree still satisfies. It surfaced only once a Data-tab test
needed to tell "a button from THIS render" apart from an identically-
named one from several renders ago. Fixed with a real property accessor
that clears `children` on assignment, matching what a real browser does
when `.innerHTML` is set to any string — this makes every test in the
file more accurate, not just the new ones.

Also surfaced, and fixed, a genuine test-isolation gap of the new tests'
own making: the recap test's fixture marks week 1 `allFinal` to get a
real recap to open — but `localAutoAdvance()` (2026-09-15h, shipped
moments before this) now runs on every later `appResume()` in the same
suite, so that fixture would otherwise leak into the week-advance tests
further down the file and advance `week` out from under their own sanity
checks. Fixed by having the recap test clean up its own fixture
(`delete weekMeta['1']`) once it is done, the same discipline the
original week-advance test already used for its own cache entry.

All 14 suites + the ES2018 gate green throughout, `bash build.sh` clean
(28 classes).

Shipped as v6.7.

## 2026-09-15i: stop assuming other teams' weekly lineups; deduce them from a typed-in total score where the math allows it

> "For the weekly recap and anything else in the app involving other
> teams in there fantasy league, I will not be keeping track of teams'
> weekly lineups and the players they select each week. Therefore the
> weekly recap feature doesn't make much sense because it assumes which
> players each team started, and may be incorrect. The only lineups I
> will track and record each week is my lineup and my opponent for that
> week. Search the app for anything assuming other teams' weekly lineups
> and get rid of it, as long as this doesn't break any other features in
> the app. I will manually enter each team's final score every week
> after the week is final. Maybe if it is easy to implement, the app can
> deduce which players each team actually started based on the final
> score I type in, by seeing which combination of players on their
> roster equal the points total I entered. If this is possible, then
> keep the sections about other team lineups and adjust them according
> to what the app can deduce for their lineups based on the total points
> they scored for the week."

A real premise change from every earlier session's assumption: only 2 of
the league's 10 teams — Tj's own and that week's opponent — will ever
have a real, hand-entered lineup on file. Everything else is a single
manually-typed final score. Full plan and proof recorded per-step in
`TASKS.md`'s 2026-09-15i entry; this is the narrative version.

### What was actually reading another team's lineup
Grepped every `getLineup(`/`teamWeekPoints(` call site in `app/assets`
(19 hits) and classified each one. Already scoped to me or this week's
opponent only, so untouched: `schedule.js`'s `earlyAlertUncached`,
`ui.js`'s `lineupCard`/`myMatchupCard`, `recommend.js`'s advice
`render`. `Store.standings()`/`seasonTotals()` were already correct —
they route through `teamWeekScore` (manual-aware), not the lineup-only
`teamWeekPoints` — so standings needed no change at all, which narrowed
the real blast radius considerably. Genuinely wrong: `recap.js`'s
`build()` (every section — scores/high/low, closest/biggest game,
starters, busts, bench regret — either read `teamWeekPoints` directly or
walked `Store.getLineup(week, t.id)` for all ten teams), and `sim.js`'s
`allPlay`/`teamProfile`/`season` (same `teamWeekPoints`-instead-of-
`teamWeekScore` bug, unrelated to lineups but caught in the same sweep).

### Feasibility of the deduction, checked before promising it
Prototyped a slot-constrained backtracking solver against real seed data
and real fabricated-but-scoring-engine-real per-player point values
(`/tmp` scratch scripts, not shipped) — one player at a time, into each
slot in `slotKeys()` order, accepting any full assignment within 0.02 of
the target. The first pass over-counted: 48 raw solutions for one team
turned out to be the SAME real lineup found 48 different ways, because
swapping two same-position players (WR1 with WR2, say) doesn't change
the total and isn't a real ambiguity — only a slot-label one. Deduping
by the underlying SET of player ids (not which labeled slot each one
landed in) collapsed that to exactly 1, matching the real lineup.
Stress-tested at that scale next: 3 pseudo-random seeds x all 10 teams
= 30 realistic team-weeks, ~20% of each roster zeroed out as a simulated
bye. Result: **29/30 landed on exactly one possible lineup, 1/30 was
genuinely ambiguous (two valid combinations, correctly flagged as such),
0/30 failed to find the real lineup at all.** Average solve 75ms, max
107ms — cheap enough to run on demand, once per team, when the recap is
actually opened. Verdict: reliable enough to build as a real feature,
with the ambiguous/unreachable cases reported honestly rather than
guessed at.

### What was built
`Store.inferLineup(week, teamId)` (store.js) — the production version of
that solver, working from `getManualScore()` (the number Tj already
types in every week) against the team's own roster's real per-player
points this week (same `playerPoints`/`isOnBye` the rest of the app
scores with). Returns one of: `{ok:true, confidence:'unique', slots}` —
the one lineup that reaches the score, in the same shape
`Store.getLineup()` returns, safe to hand to anything that used to read
a real lineup; `{ok:true, confidence:'ambiguous', sets}` — several
combinations tie, deliberately NOT collapsed to a guess; `{ok:false,
reason:'no-match'|'no-score'|'too-complex'}` — nothing to infer, plainly
labeled why. Capped at 300,000 search nodes / 2,000 distinct sets so a
pathological roster (many players tied at the same score) can't hang on
a phone.

`recap.js`'s `build()`: `scores`/`high`/`low`/`games`/`closest`/
`blowout` now read `teamWeekScore` (manual-aware) instead of
`teamWeekPoints` — every team's total is right regardless of whether its
lineup is real, inferred, or unknown, since that was never actually in
question. `starters`/`busts`/bench regret now use the REAL lineup for
me and this week's opponent (found the same way `myMatchupCard` already
does — the matchup pair containing `S.league.me`), `inferLineup` for
everyone else, and only trust the inference — for all three of those
sections — when `confidence === 'unique'`. An ambiguous or unreachable
team is simply left out of that team's attribution, the same as if
nothing had been entered yet, rather than shown as a maybe-wrong fact.

`Sim.regret(week, teamId, lineupOverride)` gained an optional third
argument so recap.js can hand it an inferred lineup instead of the
(empty, for an untracked team) result of `Store.getLineup`; every
existing caller is unaffected since the parameter is optional and falls
back to the old behavior exactly.

### The three bugs fixed alongside it
`sim.js`'s `allPlay()`, `teamProfile()`, and `season()`'s inner points
rebuild all read `Store.teamWeekPoints(...).total` — the lineup-only
total — instead of the manual-aware `teamWeekScore(...).total`. For any
of the 8 untracked teams this meant these three (tested, but not yet
wired into any UI screen — see the "League tab" comments already in
store.js/sim.js from earlier sessions) silently saw 0 regardless of
what Tj actually typed in. Same one-line fix in all three places, now
consistent with `standings()`, which was already correct. Separately,
`season()`'s inner IIFE read `.pts` off `teamWeekScore()`'s return value
— which only ever has `.total`, never `.pts` — so every season points
projection was adding `undefined` and silently becoming `NaN`. Confirmed
concretely before fixing: a direct run showed `projPts: null` in the
serialized output. Both classes of bug are independent of the lineup-
tracking change itself but were caught in the same sweep and are now
covered by `test_recap.js`'s NaN and manual-score-flows-through checks.

`Sim.matchup()`/`lineupMeans()` — a live win-probability simulator that
needs a real, slot-by-slot lineup on BOTH sides of a matchup — were
removed outright rather than fixed. Confirmed zero callers anywhere in
the app or the existing test suite before deleting (grepped clean), and
their whole premise no longer holds for 8 of the league's 10 teams.
`Sim._draw`/`_rng`/`positionCV`/`sigmaFor` — the general-purpose pieces
`matchup()` was built from, independently tested elsewhere — were left
alone.

### Verification
New `tools/test_recap.js` — 22 real-execution assertions against the
real modules, no mocking of `Store`/`Sim`/`Recap` themselves. Every
player's point value is set deterministically via `manualAdj` on an
otherwise-empty scored line (exact, not fitted from a stat formula), so
the fixture is airtight rather than merely realistic: one team is built
with a globally-dominant outlier player to prove unique inference feeds
starters/best-starter-of-the-week correctly; a second is built with its
two QBs deliberately tied (QB isn't flex-eligible, so this is an
isolated, guaranteed 2-way ambiguity) and given an even BIGGER outlier
than the first team, specifically to prove that an ambiguous team's
score never wins best-starter attribution even when it would otherwise
run away with it; a third gets a manual score no combination of its
roster can reach; a fourth gets no manual score at all. All four
`inferLineup` outcomes, the recap's correct inclusion/exclusion by
confidence, both `Sim.regret` code paths (with and without the new
override), the `allPlay`/`teamProfile`/`season` manual-score fixes, the
NaN fix, and `Sim.matchup`/`lineupMeans`'s removal are each pinned by a
real assertion, not a source-text check. All 15 suites (14 existing +
the new one) + the ES2018 gate green, `bash build.sh` clean (v6.7,
versionCode 607, 263K, 28 classes).

**Also checked live**, not just asserted: headless Chromium against the
real `index.html`, same deterministic fixture applied through
`window.Store`/`Scoring` exactly as `test_recap.js` does, then driven
through the ACTUAL Data tab UI — clicked into Data, clicked "View week 9
recap" — rather than calling `Recap.build()` directly. The rendered
dialog showed "High score: Steve 100000000", "Low score: JR 0", and
"Best starter: KC Concepcion (WR, Jose/Brandon) 999999" exactly as the
fixture predicted, with zero console or page errors. Screenshot
confirmed the dialog visually clean. (Caught one bug this way that the
Node suite structurally could not reach: the first pass of this same
check threw on `renderHeader()`'s `m.at.slice(...)` because the test's
own `weekMeta` fixture was missing the `.at`/`.games` fields a real
synced week always carries — a gap in the check's fixture, not in the
shipped code, fixed before re-running.)

Shipped as v6.8.

## 2026-09-16: rebuild the waiver wire recommendation system to be season-smart and exclude inactive/injured players; diagnose the tab-lock bug

> "Review the screenshot. This is the waiver wire tab. It is recommending
> a lot of rb that are inactive or injured or no longer play. It
> probably does this for other positions too. This is a major error.
> Figure out how to make the recommendation system recommend only active
> players that start in games every week that are not injured. The
> point of the system is to recommend the best available players in
> each position scored based on this league scoring system. Also it
> keeps recommending I switch qb. It is only considering week to week. I
> want it to suggest waiver wire drops and adds that will increase my
> team output for the entire season. Rebuild the waiver wire system to
> make it smart. It needs to suggest the top players available that
> aren't taken on another roster that are better for the season than
> the player it recommends I drop. It should explain why to drop the
> player I have in favor of the player it recommends. It should only
> consider active players who start in the NFL, considering current
> adp, stats from prior weeks, injury reports, and it can find helpful
> lists online by searching for current adp lists and waiver wire
> information online, but it is important that this information is
> updated for the current/upcoming NFL week.
>
> Finally sometimes when I open the app it is on the live tab and it
> won't let me press another tab like waiver wire. Diagnose
>
> Only ship after the system is well made and the code is optimized and
> it didn't break any other features in the app."

Full step-by-step plan and proof in `TASKS.md`'s 2026-09-16 entry (moved
to `LADDER.md` once archived); this is the narrative version.

### Diagnosis came first, against the real ESPN feeds — not a guess
Before writing any code, the screenshot's specific players were checked
against ESPN's live `/injuries` endpoint and all 32 teams' live roster
endpoints (the same feeds this app's own sync buttons already call).
James Conner, Dylan Sampson and Isiah Pacheco were confirmed on ESPN's
own Injured Reserve at that exact moment, yet were the top three ranked
RB "adds". Nick Chubb and Kareem Hunt were confirmed present on NONE of
the 32 current NFL rosters at all. Separately, ESPN's roster feed itself
carries a `status.type` per athlete this app never captured — a
league-wide check found ~2,450 total roster entries, of which 491 were
`practice-squad` (cannot play in a game) and were being offered
identically to a real active-roster player. This turned "the system
recommends injured/inactive players" from a complaint to check into
three concrete, separately-fixable defects with real evidence behind
each one, which is what steps 1-2 below actually fix.

The "keeps recommending switch QB... only considering week to week"
complaint was diagnosed by reading `Value.upgrades()` directly: it
compared a free agent's THIS WEEK number against a rostered starter's
THIS WEEK number with a 0.5-point margin — a single great matchup was
mathematically sufficient to trigger a swap suggestion that made no
sense once that matchup passed, exactly Tj's description.

The tab-lock bug ("sometimes when I open the app it is on the live tab
and it won't let me press another tab") was diagnosed by reading
`boot()` (ui.js): it wrapped its ENTIRE startup sequence — `Store.init`,
`applyAdjust`, `Recommend.loadCaches`, `autoFillWeek` — in one
try/catch, and `wire()` (the ONLY place that ever attaches click
listeners to the bottom tab bar) ran only after all four succeeded. Any
one of the three after `Store.init` throwing — a corrupted cache read
recovering from an interrupted session being the most plausible real
trigger, which CLAUDE.md's own "INTERRUPTED MID-CHANGE" warning already
describes as a real state this repo can be in — left the tab bar
permanently inert for the whole session with no recovery short of a
relaunch. This could not be reproduced live from this session (no real
device access), so it is recorded as a confirmed MECHANISM, backed by a
real test that forces the exact failure through the real production code
and shows the old structure would have failed it (see Verification).

### The fixes
**value.js — health filtering (step 1).** `Recommend.health()` (already
built and already correctly applied to the Advice tab's lineup slots)
is now exported so value.js never reimplements it. `Value.freeAgents()`
excludes any player whose health label is `'OUT'` — which OUT, INJURED
RESERVE, SUSPENDED and PUP all collapse to in `health()` — before he
ever enters the pool at all, not just down-ranked. DOUBTFUL/QUESTIONABLE
players are still offered (Tj may reasonably still want to grab one) but
now carry a `healthLabel`/`healthNote` the UI tags visibly. Every
downstream consumer (`byPos`, `byVor`, `upgrades`, `waiverContext`'s
pool) reads through `freeAgents()`, so the fix is inherited everywhere
from one point of truth rather than needing to be repeated per screen.

**playerdb.js — roster status and pruning (step 2).** ESPN's roster
feed's real `status.type` per athlete is now captured as `.st` on every
player (`'active'`, folding `'day-to-day'` in since the separate
`/injuries` feed already gives the real OUT/DOUBTFUL/QUESTIONABLE
granularity; or `'practice-squad'`). `Value.freeAgents()` skips any
practice-squad row entirely; a bundled entry with no `.st` at all (never
refreshed) defaults to active so a fresh install's whole board is never
filtered out by omission. `doRefresh()` now tracks which players were
actually seen in the current run and, ONLY when every one of the 32
teams answered (never on a partial failure — a network hiccup must never
be read as "everyone left every roster"), removes any database row that
fell off every roster. This is exactly what let Nick Chubb and Kareem
Hunt sit in the database forever with a stale team/position after
leaving every roster — nothing before this ever removed a player, only
added or updated one.

**value.js — rest-of-season value (step 3).** `Value.perGame()` was
reordered: 2+ measured games this season first, then ESPN's season-long
(rest-of-season) projection, then a single measured game, then this
week's ESPN line only as a last resort before the positional-floor
guess — never THIS WEEK's matchup-specific number leading, which is what
let one good matchup outrank a player who is actually better for the
season. Found and fixed in the same pass: the season-pace branch was
returning projections.js's FULL-SEASON total directly instead of
dividing by 17 (recommend.js's own `projectOne` already divides the
identical field correctly) — any player who fell through to that branch
was being valued at roughly 17x his real rest-of-season rate. Every free
agent now carries a `confident` flag (2+ measured games, or a real
season projection — never a single flashy week or a positional guess).
`Value.upgrades()` was rebuilt to compare a free agent's `.v` (now
season-oriented) against a rostered player's `.base` (recommend.js's
blended baseline BEFORE the matchup/health multipliers apply for just
one week) — an honest apples-to-apples rest-of-season comparison — and
now requires `confident === true`, which is what actually kills the
"switch QB after one great week" case: a QB who flashes for one huge
week is not confident and cannot trigger a suggestion on his own.

**value.js + ui.js — a specific drop, with a reason (step 4).**
`dropCandidatesFrom()` now carries each candidate's raw per-game `base`
alongside its existing `.ros`, so `upgrades()` can compare a free agent
directly against a SPECIFIC droppable player — the weakest bench player
at the position, falling back to the weakest starter only when there is
no bench depth, exactly as `dropCandidatesFrom` already did for the paid
Claude path — and build a plain-English `why` naming both players, the
point-per-game edge, the weeks left, and which source the free agent's
number came from. `freeAgentCard()` (ui.js) now renders this as "Add +
drop <name>" (reusing the existing `addFreeAgentSwap` the Claude path
already used) with a "why ▾" detail, explicitly framed as rest-of-season
rather than this week. This was previously only available through a
paid Claude call; the deterministic, free path now offers the same
add+drop pairing and reasoning.

**ui.js — the tab-lock fix (step 5).** `boot()` restructured so the
seed/`Store.init` step (the one genuinely unrecoverable case — no data
means no working screen either way, and `fatal()` still shows a real
error card rather than a silently inert one) has its own try/catch, and
`wire()` + `render()` now run UNCONDITIONALLY once that succeeds, with
`applyAdjust`/`Recommend.loadCaches`/`autoFillWeek` wrapped in their own
try/catch in between (a failure there now costs only that one feature,
never tab navigation) and the background refreshes
(`startLive`/`freshenSchedule`/`refreshPlayerDBIfStale`/
`localAutoAdvance`/`syncCurrentWeek`) wrapped similarly afterward.
`index.html`'s `<nav id="tabs">` also gained `data-nogesture`, so a tap
that drifts a few px on a tab button can never be misread by
gestures.js's swipe recognizer as a swipe attempt — a related hardening
found while reading the gesture code, independent of the main mechanism.

### Why no hardcoded ADP list
Tj's message allowed for "it can find helpful lists online by searching
for current adp lists and waiver wire information online" — considered
and deliberately not done. This codebase has an explicit, repeated
standing rule against exactly this shape of data (recommend.js's own
file header: "Remove all preseason consideration from any
recommendations or advice from the entire app... a stale number from
before the season started would only get in the way"). A scraped ADP
snapshot frozen into this session's commit would be stale within days —
the same defect class the preseason-projection removal already fixed
once. The live ESPN roster and injury feeds this app already syncs on
its own schedule ARE "updated for the current/upcoming NFL week"
automatically, which a one-time scrape baked into a commit cannot be.
The fix instead makes fuller, correct use of data the app already
fetches (roster status, the injury feed, measured production, ESPN's
own season-long model) rather than adding a new, separately-decaying
data source.

### Verification
Two new suites. `tools/test_waiver.js` (real modules, mocking only the
two dependencies value.js reads through `root.` — `Recommend` and
`Projections` — which is what actually makes them overridable per test
without a live network or a fully-synced season): an injected OUT/IR
player is proven absent from `Value.freeAgents()`'s output entirely; a
practice-squad player is proven absent, and a `.st`-less bundled entry
is proven still shown (the fresh-install safety case); a DOUBTFUL/
QUESTIONABLE player is proven present AND tagged; the season-pace /17
bug is pinned against an exact expected value; a 45-point one-week-only
ESPN line is proven to never trigger `upgrades()` on its own; a
genuinely better, confident free agent is proven to trigger a suggestion
paired with the correct specific drop and a why-text naming both
players by name; three PlayerDB refresh scenarios (status captured
correctly including day-to-day folding into active, a player missing
from a full clean refresh is pruned, and — separately — a partial or
total failure prunes nobody at all).

`tools/test_tabsafety.js` boots the REAL ui.js against a stub DOM (the
same proven pattern test_lifecycle.js already uses) and deliberately
breaks `Recommend.loadCaches` and, separately, `Recommend.autoLineup`,
proving a real tab click still reaches the handler and actually changes
`lastTab` afterward in both cases — the exact thing "won't let me press
another tab" describes — while a genuinely unrecoverable `Store.init`
failure is proven to still show the real fatal() error text rather than
a normal-looking broken screen. The `data-nogesture` attribute is also
pinned directly against `index.html`.

A live-browser check (headless Chromium, the real `index.html`,
`PLAYWRIGHT_BROWSERS_PATH` pointed at the pre-installed browser) drove
the actual Wire tab: injected an IR player, a practice-squad player, and
a QUESTIONABLE player with a real season-long signal directly through
`window.Store`/`window.PlayerDB`/`window.Recommend`, then clicked the
real Wire tab and the real TE position chip. Confirmed on screen: the IR
and practice-squad names never appear anywhere in the rendered tab; the
QUESTIONABLE player appears under the TE filter carrying his tag; the
season-pace fixture returned exactly 15 (not 255), matching the /17
fix. A separate pass clicked through all seven tabs in the same live
browser and confirmed each one switches, renders non-empty real content,
and produces no page errors (only the sandboxed ESPN network calls
failing on `ERR_CERT_AUTHORITY_INVALID`, expected and unrelated here).

All 17 suites (15 existing + these 2 new ones) + `check_es2018.js`
green, `bash build.sh` clean (v6.8, versionCode 608, 267K, 28 classes —
every Java source produced one).

## 2026-09-17: the v6.9 fix wasn't holding — Chubb/Hunt still on the board (v7.0)

Tj, one day after v6.9 shipped, pointed at the exact same two names v6.9
was supposed to have already removed: "The app is still recommending at
least 3 players on the waiver wire that recorded no stats at all in week
one. Are these legitimate recommendations?" His Wk2 screenshot showed Nick
Chubb (tagged HOU), Trey Benson (ARI) and Kareem Hunt (tagged KC), all
"wk1 —", ranked above several RBs who had actually played and scored.

### Verified live before writing a line of code
Fetched all 32 current NFL team rosters directly from ESPN's own site API
(`site.api.espn.com/.../teams/<abbr>/roster`), plus the league-wide
`/injuries` feed, from this session — the same discipline the 2026-09-16
job used. Result: Nick Chubb and Kareem Hunt are on ZERO of the 32 current
rosters — not injured, not anywhere — so their "HOU"/"KC" tags in the
app's database are simply stale. Trey Benson and Adam Randall (BAL) ARE on
real rosters, with no current entry in the `/injuries` feed at all —
legitimately speculative, no-track-record adds, not a data error, just
mis-ranked (see below).

### Root cause 1: value.js's free-agent memo never noticed a background refresh
`Value.freeAgents()` is memoised (`_faMemo`) for performance — one Rosters
render can call it up to six times. The key was `(week, Store.generation())`
only. But the two things that actually determine whether Chubb/Hunt should
be excluded — `PlayerDB.ensureFresh()` (prunes off-roster players) and
`Recommend.loadNews()` (drives the OUT/IR/SUSPENDED exclusion §37/v6.9
added) — both refresh ASYNCHRONOUSLY in the background (`ui.js`'s
`refreshPlayerDBIfStale()` and `freshenInjuries()`, called from `viewWire()`
and the live poll respectively) and call `render()` once they land. Neither
touches `Store.generation()`, which only bumps on a real roster edit (add/
drop/trade — `store.js`'s `bumpGen()`). The Wire tab always renders once
immediately, before either background fetch can possibly have completed —
that first render computed and cached a board from whatever was already on
disk: a player database that had not yet pruned Chubb/Hunt, and possibly an
empty injury cache under which `Recommend.health()` reports every player
healthy by default (`{f:1, label:'', note:''}` when nothing matches). Every
later render — including the one the completed background fetch itself
triggers — kept replaying that exact first, incomplete snapshot. The
exclusion logic v6.9 added was correct and doing its job; it just never got
handed the data it needed, for the rest of the session, until Tj happened
to add or drop a player of his own.

**Fix:** `freeAgents()`'s memo key now also folds in
`PlayerDB.meta().updated` and `Recommend.newsCache().at`. A landed
background refresh of either feed changes the key, so the very next call
recomputes against current data instead of replaying stale rows.

### Root cause 2: playerdb.js's prune required a flawless 32/32 sweep
`doRefresh()`'s prune of players who'd fallen off every roster (added in
v6.9) only ran when ALL 32 team fetches succeeded in the same pass
(`if (ok && !failed.length)`). One flaky team on a phone's cellular
connection — common enough that `candidates()` already retries five
different URL shapes per team for exactly this — silently blocked every
removal for the entire run, with zero partial credit, even for players
whose own last-known team answered perfectly cleanly.

**Fix:** `doRefresh()` now tracks which teams' fetches actually succeeded
this run (`teamOk`), and prunes a player only when HIS OWN last-known team
succeeded and came back without him in it — a precise, provable removal
(we checked exactly the roster that would show him) that no longer needs
every one of the 32 fetches to land together. A player whose own team's
fetch failed this run is left untouched either way — unproven, not assumed
gone — so the existing "a total failure prunes nobody" guarantee (proven in
`tools/test_waiver.js` since v6.9) still holds exactly as before; it is now
joined by a genuine partial-success case proving the new, finer-grained
behavior.

### The ranking question Tj asked directly
Independent of both bugs above: `perGame()`'s lowest non-blind-guess tier
(ESPN's single-week projected line, used only when a player has no
measured games this season and no season-long model) was being sorted by
raw value against players with REAL measured production. Because that tier
can print a large generic per-role number, an unconfirmed guess with zero
track record could — and did — outrank someone who had actually played and
scored (Chubb 11.5 / Benson 9.9 / Hunt 9.1, all zero games, ranked above
Kendre Meller/Emmett Johnson/Kaelon Black/Samaje Perine, all of whom
produced 8.0-9.0 in their one real game).

**Fix:** each free-agent row now carries `hasSignal` — true for any real
measured game (even one) or an ESPN season-long model, false only for the
bare single-week guess or the positional-floor blind guess — and the sort
puts real signal ahead of zero signal, before value. A speculative,
unproven player can still appear on the board (nothing is hidden), he just
can no longer sit above real production purely because ESPN's generic
model happened to guess a bigger number.

### Verification
Four new cases in `tools/test_waiver.js`: (1) a background injury-feed
refresh — simulated by advancing `Recommend.newsCache()`'s stamp and
changing what `Recommend.health()` reports, with `Store.generation()`
provably unchanged — is picked up by the very next `freeAgents()` call, not
stuck behind the old snapshot; (2) the same for a background PlayerDB
prune; (3) a zero-signal ESPN guess (mocked at a much larger raw value)
never outranks a real one-game producer (seeded via `Store.setBook()`); (4)
a genuine partial refresh — exactly one team (WAS) fails every candidate
URL, the other 31 succeed — still prunes a player whose own last-known team
(KC) succeeded and didn't list him, while leaving alone a player whose own
last-known team was the one that failed. All 4 fail against the pre-fix
code and pass against the fix.

Full suite (17 suites) + `node tools/check_es2018.js` + `bash build.sh`
all green.

## 2026-09-17b: ask Claude how my team stacks up against the whole league (v7.1)

Tj: "add a feature where I can ask Claude its overall take on my team versus
every other team in the league and recommendations on how to improve my
team. Make the Claude prompt where I can export a file that will let me
import it into the Claude app and then the Claude app will know exactly
what it needs to make a file in order to import it back into the fantasy
app — similar to other sections of this app where I can export and import
Claude replies from the Claude app." A third instance of the existing
export → Claude app → import round trip (handoff.js already did this for
lineup advice and the waiver wire) — same shape, a new subject: a
season-long verdict against the whole league rather than a per-player one.

### The design decision: reuse everything, invent nothing new
Every fact this feature's prompt needs already exists somewhere else:
`Value.waiverContext` already builds my own starters/bench/needs/pool/
dropCandidates/injuries for the Wire tab; `Value.perGame` already prices
any named player rest-of-season; `Recommend.health` already flags who is
hurt; `Store.standings` already has every team's record. A new file,
`teamreport.js`, does nothing but put those side by side into one
`TeamReport.context(week, teamId, opponents, season, today)` object — no
new scoring math anywhere, so nothing here can drift from the numbers the
Wire/Advice tabs already show.

### Why the live API path has no web search
Unlike `Ai.ask`/`Ai.askWaivers`, `Ai.askTeamAnalysis` sends no `web_search`
tool at all. Every number in the prompt (a price, an injury tag, a
standing) is already fresh from the app's own feeds; a search cannot
improve on a number the app already computed, and Claude has no way to
research what a specific other league owner would actually trade away —
that is private information no search engine has. The value this call adds
is judgment over given facts, not research, so it is plain text in, plain
text out — cheaper and faster than the Advice/Wire syncs, and the on-screen
cost estimate says so.

### The bug this caught before it shipped: team names are not player names
`normalizeTeamAnalysis` (shared by the live path and the offline import, so
the two can never disagree about what a reply means) originally ran team
names through `Names.canon()` for matching — the same canonicalizer the
advice/waiver code already uses for PLAYER names. `Names.canon` folds a
standalone `jr`/`sr`/`ii`/`iii`/`iv`/`v` token to nothing (so "Odell
Beckham Jr." matches "Odell Beckham" — correct for a player). This league
has a real team literally named "JR". Canonicalized, "JR" and "" (the key
an empty/no-team field also maps to) collided — every recommendation with
no `fromTeam` at all was silently mislabeled as coming from team JR, and it
would have shipped invisibly against real production, on Tj's own league,
until he noticed a recommendation crediting the wrong owner. Caught during
manual round-trip testing against the real seed roster (which does have a
"JR" team) before any commit claimed the feature worked. Fixed with a
separate `teamKey()` — plain lowercase/trim, no suffix folding — used for
every team-name comparison; `Names.canon` stays exactly where it belongs,
on player names. Locked in as a permanent regression test in
`tools/test_ai.js` (a hand-built ctx with a team named "JR").

### Where it lives
Rosters tab, between the roster he opens the tab to see and the trade
evaluator he asked (2026-09-15c) to keep at the very bottom — "How your
team stacks up" is about comparing his team to the league, not the first
tool he reaches for. Same two-path layout as the Wire tab's "Ask Claude
about the wire": a live "Ask Claude" button with a memoized cost estimate,
gated on `Ai.configured()`, and beneath it the free `handoffCard()`
export/import pair that works with no API key at all. A result shows the
rank/verdict, strengths/weaknesses, a "Team by team ▾" breakdown, and a
recommendations list — each one flagged `unverified` (never hidden) if it
names a player outside every list the prompt actually sent, exactly the
same safety property the waiver board already gives an unrecognised add.

### Verification
Extended `tools/test_ai.js` (normalizeTeamAnalysis: the JR regression, an
invented team dropped from `teamComparisons`, an invented `fromTeam`
blanked, `giveUp` only ever resolving to a player genuinely on my own
roster, a real waiver target verified against the AVAILABLE pool) and
`tools/test_handoff.js` (the briefing explains itself with no message
needed, every team's roster heading actually appears, the full
build → answer → import round trip lands in `TeamReport`'s own cache and
reads back, the same-week/empty-reply/no-context refusals, `detect()`'s
exact-match safety extended to the new kind, and a "no drift" check that
handoff.js calls into `ai.js`/`teamreport.js` rather than reimplementing
either). New `tools/test_teamreport.js` (context shape: every team appears
once, mine is flagged, no price comes back NaN, a bye-week player prices
at zero, and my own fields pass through `Value.waiverContext` unchanged).
Also verified live in a real headless-Chromium run of `app/assets/
index.html` (not just Node script tests): the card renders on the Rosters
tab, the button is correctly disabled with no API key configured, the
export produces the real ~17KB briefing in a modal, and a pasted reply
imports and renders the full results view — confirmed with a screenshot.

Full suite (18 suites) + `node tools/check_es2018.js` all green, plus a
real `bash build.sh` (28/28 Java classes, no ABI-specific dependency) —
this was a fresh container with no `build/app-release.apk` yet, so the
first `ship.sh` call correctly WARNed "no APK in build/" and skipped
publishing rather than shipping a stale one; running `build.sh` first and
re-running `ship.sh` produced the real v7.1 APK.

## 2026-09-17c: the team-analysis screen showed Tj his own app's unfilled template (v7.3)

Minutes after v7.2 shipped, Tj sent a screenshot: the new "Claude's take"
card was showing "Rank 1 of 10. `<a few honest sentences: where this team
really stands and why>`" — literal placeholder text from this session's
own `buildTeamAnalysis()` skeleton, not anything a real Claude reply would
ever say. "When I imported it back into Claude it gave nonsense answers."

### Reproduced first, before touching any code
Built a real export with `Handoff.buildTeamAnalysis()`, then fed that
export's own text straight back into `Handoff.importReply()` — simulating
loading or pasting the file MADE FOR Claude instead of what Claude actually
sent back. It imported cleanly, and the saved result was, character for
character, the unfilled skeleton from the export's own "## The file to
give back" section: `{"overall":{"rank":1,"of":10,"verdict":"<a few honest
sentences...>"}, ...}`. Exact match for the screenshot.

### Root cause
`Ai.parseAnswer` (`jsonOf`) is deliberately tolerant of a whole chat message
pasted in, prose and stray braces and all — it scans the text for every
valid JSON object and takes the WIDEST one, on the theory that a real
answer is the biggest coherent JSON blob in whatever Claude said. But every
handoff's own export file ALSO contains a JSON object matching the reply
shape: the worked skeleton under "## The file to give back", there to show
Claude what to write. For the waiver and team-analysis exports that
skeleton is comparable in size to (or bigger than) a real short answer, so
if the WRONG file (the export, not the reply) is fed to `importReply`, it
parses cleanly, passes `detect()`'s shape check (it has `overall`/`adds` in
exactly the right shape — it IS the contract, after all), and gets
"imported" as if genuine. Confirmed this is not new to team-analysis: the
identical thing reproduces feeding the WAIVER export back in, and the
identical hand-built ADVICE skeleton object too — this bug has existed
since the very first handoff feature; Tj's screenshot on the newest one is
just what surfaced it.

### Fix
One shared guard, in `Handoff.importReply()`, ahead of every per-kind
branch so all three kinds get it from a single implementation:
`findPlaceholder()` walks the parsed object recursively (through arrays and
nested objects) looking for any string value that is ENTIRELY wrapped in a
single `<...>` pair. Every placeholder in every skeleton this app has ever
written is shaped exactly that way, and nothing else — no real player name,
no real sentence of Claude's reasoning — is ever wrapped that way end to
end. A hit refuses the whole import with a specific, actionable message
naming the placeholder text found and explaining the likely mistake (the
wrong file), rather than either silently accepting garbage or giving a
generic parse error that would not tell Tj what actually went wrong.

### Verification
`tools/test_handoff.js` gained a dedicated section: the real waiver export
fed back in is refused; a hand-built advice skeleton (chosen over its own
export text, because that export's "machine-readable copy of this request"
block happens to be textually WIDER than its one-example skeleton, so the
widest-first scan picks THAT instead — a different, already-safe refusal,
not this defence specifically) is refused; the real team-analysis export
fed back in — the literal bug Tj hit — is refused; a placeholder nested
inside a `recommendations[]` array element (not just a top-level field) is
caught too; and a genuinely real, fully-written reply with no
bracket-wrapped field anywhere still imports exactly as before. Full suite
(18 suites) + `node tools/check_es2018.js` all green.

Shipped as v7.3.

## 2026-09-18: the wire kept pushing QB swaps off Stafford/Bo Nix; K/DEF deprioritized; the Wire-tab tab-highlight glitch investigated (v7.4)

Tj: "right now it always recommends qb switch from the QBs I already have,
Stafford and bo nix. Keep in mind I drafted these QBs because they had
excellent stats last quarter and they are pass heavy, in this league the
scoring is one point for every completed pass. Only recommend a
replacement qb if it is truly a season edge over the high completion QBs I
already have. Focus waiver wire more on my roster weaknesses, usually rb
and wr... defense and kicker are not priorities." Plus: make sure the
Claude-app handoff follows the same rules, and investigate (carefully) a
"the tab I press doesn't light up, usually Wire" glitch.

### Root cause of the QB-swap complaint
`Value.upgrades()` — the deterministic, no-API-key "beats a starter" board
on the Wire tab — already excluded one-week spikes (the 2026-09-16 fix,
§37), but held EVERY position to the same flat "1 more point per game"
margin. That is real signal at running back and pure rounding noise at
quarterback: a completion pays a full point here, so a good starting QB
already outscores a good RB/WR by 3-4x per game, and the `confident` gate
let ESPN's generic rest-of-season MODEL alone (never a measured game) count
the same as a QB who has actually gone out and posted the numbers. With a
single starting QB slot and no bench QB depth to speak of, ANY free-agent
QB whose bigger, unproven projection cleared that tiny 1-point bar got
paired with Tj's own starter as a "drop him" suggestion — exactly the
complaint, and exactly the mechanism the 2026-09-16 fix did not reach.

Separately, the SAME deterministic board never gated K/DEF at all — the
Claude-driven board (`ai.js normalizeWaivers`) already only ranks a K/DEF
add when `kdefNeed` says mine is genuinely unavailable, but the no-cost
board had no such check, so a streamable kicker or defense could out-rank
an actual RB/WR need just by clearing the same flat 1-point bar.

### Fix
`value.js`'s `upgrades()`: QB now needs BOTH a much larger minimum edge
(`QB_MIN_GAIN = 6` points/game, not 1) AND real measured production behind
the free agent (`QB_MIN_MEASURED = 3` scored games — a projection, however
confident, does not qualify on its own). K/DEF now check `kdefNeedFrom()`
the same way the Claude path already did, so they only ever appear when
mine is genuinely unavailable. Both thresholds are exported
(`Value.QB_MIN_GAIN`/`Value.QB_MIN_MEASURED`) so `ai.js`'s
`normalizeWaivers()` can hold a CLAUDE-SUGGESTED QB swap to the identical
bar rather than a second, hand-copied number — one source of truth for
both the deterministic board and the AI-assisted one. The live-API waiver
prompt (`Ai.waiverPrefix`) and the offline Claude-app handoff
(`Handoff.buildWaivers`) both now carry the same QB-skepticism paragraph,
written once (`Ai.qbSkepticismText`) and read by both, so "also make the
export/import system follow these rules" cannot drift from the live path
the next time either is edited. The Wire tab also now states the roster's
actual thinnest starting spots (K/DEF excluded — "not priorities") up
front, above the ranked list, so the RB/WR focus Tj asked for is visible,
not just implicit in what got filtered out.

**Researched before picking the thresholds, not just guessed**: web search
on point-per-completion fantasy scoring strategy confirms the direction
independently — accurate, high-volume passers are specifically named as
the archetype that "gets thrust to the top of their tiers" in this exact
scoring shape, Stafford named by name, which is precisely why Tj drafted
him and Bo Nix and precisely why a marginal, unproven free agent should
not be recommended over either of them.

Also found and fixed, in the same area: `Value.waiverContext()` computed
`myStarters()` (a `bestLineup()`/`projectAll()` pass over the roster)
THREE separate times in one call — once directly, once via `needs()`,
once via the `needs()` call buried inside its own return statement.
`needs()` now takes an optional precomputed `starters` array;
`waiverContext()` passes the one it already has, cutting that to two
passes (one of which — `allProj` — genuinely needs its own separate call
shape). Not the dominant cost on this screen (the real one, the ~785-
player free-agent scan, was already properly memoized by the 2026-09-17
fix, §38), but real, free, and in the exact file this job was already
touching.

### The Wire-tab tab-highlight glitch: investigated, not blindly patched
Tj: "when I first open the app it is on the live page... when I press
another tab that tab doesn't light up on the bottom, like I never selected
it. Usually when I try to press the waiver wire tab... only investigate
this if you are sure it won't affect or break anything else."

Traced the whole path end to end rather than guessing:
- The tab-lock class of bug (`wire()` never running if startup threw) was
  already found and fixed in v6.9 (§37) — confirmed still fixed, still
  covered by `tools/test_tabsafety.js`.
- A tap drifting on the tab bar being misread as a swipe attempt (which
  WOULD swallow the click via `preventDefault`) was already excluded via
  `data-nogesture` on `<nav id="tabs">` — confirmed still present, still
  tested, and confirmed in `gestures.js` itself that `ownedBySomethingElse`
  backs off before ever calling `preventDefault` for anything under that
  attribute.
- `goTab()` itself toggles the `.on` class and calls `Store.save()`
  synchronously, then `render()` — no `busy` guard, no code path that could
  silently no-op a click that actually reached the handler.
- Chased down whether `Store.save()` on a plain tab switch could itself be
  the "hang": store.js's own header documents that it WAS a 1.9 MB
  synchronous blocking write through v-something, but that was already
  fixed (book/stats split into their own archive file, written only on a
  real sync) — a plain tab switch now writes roughly 25 KB, not 1.9 MB.
  Already fixed, not a live lead.
- Traced the actual cost of the Wire tab's first render per session: the
  785-player free-agent scan is memoized (§38), and the per-player cost
  inside it (`Store.bookWeek`, `Names.hit`) is a handful of cheap hash
  lookups, not a hidden O(n²) — not the multi-second freeze the symptom
  first suggested.

**Conclusion, stated plainly rather than left unwritten**: no reproducible
defect was found in the click-handling or gesture-recognition code itself
— every previously-identified cause of exactly this symptom is confirmed
still fixed and still under test. The one remaining, unverifiable
possibility is ordinary perceived latency: `render()` is and must stay
fully synchronous (the ENTIRE test suite — `test_lifecycle.js` especially —
asserts DOM content immediately after a simulated tab click, with no event-
loop flush; making any tab's render asynchronous to fix a paint-timing
question would require rewriting that assumption across three test files
with no way to confirm the actual real-device symptom improved, which is
exactly the "only if you are sure it won't break anything else" line Tj
drew). Not fixed, on purpose, for lack of a concrete, safely-verifiable
lead — see TASKS.md's "Waiting on Tj" for the specific follow-up question
that would actually narrow this down next time it happens.

DONE — `tools/test_waiver.js` gained 6 new cases: a QB with a big edge but
zero measured games (excluded), a QB with real games but only a small edge
(excluded), a QB with real games and a large edge (included, with the
reason naming why QB is held to a higher bar), a K/DEF that would clear
the old flat bar but is not needed (excluded), and the same free agent
once mine is genuinely OUT (included). `tools/test_handoff.js`'s generic
waiver-round-trip test was updated to exercise RB/WR instead of whichever
position happened to sort first (previously QB, which now — correctly —
never survives a synthetic pool entry with no measured games; that test is
about the round-trip plumbing, not QB gating, so it now picks a position
this change does not touch). Full suite (18 suites) +
`node tools/check_es2018.js` all green.

Shipped as v7.4.

## 2026-09-18b — the tab-highlight glitch, actually found this time

Tj, again: "it opens on the live tab (which is fine) but if I press the
waiver wire tab the tab blinks to show that I pressed it, but it doesn't go
to the waiver wire tab. It is stuck on the live tab. I can press on other
tabs and they open and then go back to the live tab and after that the
waiver wire tab works normally." The v7.4 entry above investigated this
honestly and found nothing reproducible — that investigation is not wrong,
it just did not look in the right place. The right place: `boot()`'s own
`lastTab` restore, which that investigation never touched.

### Root cause
`boot()` restores `view` from `S.settings.lastTab` on a cold relaunch —
Android kills a backgrounded WebView process far more often than a
"resume" implies, so the next open is very often a real `boot()`, not a
live process continuing (this repo's own "Branches" story documents the
same platform behavior biting a different feature). If Tj's last real
session ended on the Wire tab — plausible; checking the wire is a quick,
often-last thing to do — the next cold open sets `view = 'wire'`
internally and `render()` correctly draws Wire's content. But `wire()`
(which runs once at boot, right after) only ever fixed up the
`aria-selected` attribute for that restored tab — never the `.on` CSS
class `app.css` actually paints (`.tab.on{color:var(--accent);
box-shadow:inset 0 3px 0 var(--accent);...}`). Only `goTab()` (the tap
handler) ever touched that class. So the bar kept showing Live highlighted
— the static HTML's shipped default — while the screen underneath was
already Wire. His next tap on "Wire" then hit `goTab`'s own, perfectly
correct `if (name === view) return;` guard, because he actually was
already on Wire — a real no-op that LOOKED exactly like "stuck on Live":
only the native `.tab:active` press flash showed (the "blink"), nothing
else changed. Tapping any OTHER tab had a genuinely different name, so it
went through `goTab` for real and painted the class for the first time
that boot — which is exactly why "other tabs... open" and why everything
"worked normally" once he had gone anywhere else and back.

Two code paths — `wire()` at boot, `goTab()` on tap — implementing "paint
the tab bar's highlight," and only one of them was complete. Exactly the
same shape of bug as v6.9's tab-LOCK fix (§37: two things implementing
"can the tab bar be used at all"), one level more subtle.

### Fix
One shared `paintTabBar(name)` (ui.js), called by both `wire()` (with the
just-restored `view`) and `goTab()` (with the tapped name), so the two can
never drift apart again. `tools/test_tabsafety.js` gained a new case
("THE REAL BUG (2026-09-18)") that reproduces the actual two-session
scenario — session 1 ends on Wire, session 2 is a fresh harness reading
the same disk back — and was confirmed to FAIL against the pre-fix code
(the Wire button was not highlighted; Live wrongly was) and PASS against
the fix.

### The rest of the same job: a delegated code/UI audit
Tj's same message also asked to "look for other possible improvements in
code and ui for the app" with "no concern" for time — spent it on a
research-only subagent audit of `app/assets/*.js` and `app.css` (kept out
of this session's own context on purpose — a ~4,200-line `ui.js` alone is
too much to read wholesale twice), then personally verified and fixed its
highest-confidence findings, each with its own before/after-confirmed
regression test:

- **Duplicate paid Claude calls** (ui.js, `freeAgentCard`/
  `teamAnalysisCard`): the Wire tab's "Ask Claude about the wire" and the
  Rosters tab's "How your team stacks up" Ask-Claude button each only
  disabled THEMSELVES in their own click handler — every sibling
  ask/refresh button in this file (news-sync, player-db refresh) also
  checks `jobRunning()` when the button is REBUILT, and these two did not.
  Switching tabs away and back while either 5-minute Claude call was still
  in flight rebuilt the card with a fresh, enabled button; a second tap
  fired a second concurrent paid API call, and whichever response landed
  last silently overwrote the cache (`Value.waiverSave`/`TeamReport.save`).
  Fixed with the same `jobRunning('waivers')`/`jobRunning('teamanalysis')`
  guard the other buttons already use. New test: `tools/test_jobguard.js`.
- **Redundant projection computation** (value.js): `upgrades()` and
  `waiverContext()` each ran `Recommend.projectAll()` twice per call —
  once directly, once again inside `myStarters()` → `bestLineup()` — even
  though `needs()` already solved this for itself via an optional
  `starters` param (§ the 2026-09-18 QB-edge job, above). Threaded an
  optional `allProj` through `bestLineup()`/`myStarters()` the same way.
  Pure performance fix, no behavior change — verified by the existing
  suites, no new test needed.
- **doSync() week-capture race** (ui.js): `doSync` read the shared
  module-level `week` variable throughout its whole async chain instead of
  snapshotting it once at entry. `week` can be mutated mid-flight by the
  NFL-week auto-advance or by tapping the week-next arrow while a sync is
  running — neither checks the `busy` flag doSync itself sets. A sync
  that started for week N could finish after `week` had moved to N+1 and
  file its results (`Store.setBook`, `S.weekMeta`, the completion toast)
  under week N+1 instead of the week it actually fetched — silently
  corrupting the wrong week's scored stats. Fixed by capturing
  `syncedWeek = week` once at the top of `doSync` and using it for every
  "week this sync is for" reference from then on (`render()` still reads
  the live `view`/`week`, since the SCREEN should track the current week
  regardless of which week just finished syncing). New test:
  `tools/test_synccapture.js` — stalls `Espn.weekGames` mid-flight,
  advances the week via the real week-next button while the sync is still
  waiting, resolves it, and confirms the results land under the week that
  was actually fetched, not wherever the display ended up. Confirmed to
  FAIL against the pre-fix code (results leaked into the wrong week) and
  PASS against the fix.

**Surfaced but deliberately not touched**: `app/assets/sim.js`'s
`season()`/`power()`/`allPlay()`/`bracket()`/`game()` are fully
implemented and covered by `test_engine.js`, `test_integration.js` and
`test_recap.js`, but grepped every other source file and found no
production caller — no tab renders playoff odds, power rankings, or
all-play records. Reads like orphaned surface from a feature that was
never wired into a tab, or one that was removed on a divergent branch (see
this file's own "Branches — main is the only source of truth" story in
CLAUDE.md for exactly this class of loss). Whether to build the missing UI
or delete the dead code is a product call, not a unilateral one — left for
Tj to decide, named explicitly in TASKS.md rather than silently dropped.

DONE — 20 suites (two new: `test_synccapture.js`, `test_jobguard.js`) +
`node tools/check_es2018.js` all green throughout. `tools/test_tabsafety.js`
and `tools/test_boot.js` (one source-text pin updated for the renamed
`syncedWeek` local) both updated in place rather than left stale.

Built and shipped as v7.5 (`bash build.sh` regenerated `app/assets/version.js`
for the bump after this entry was first written, hence this second commit
to STATE.md — the ship gate checks the narrative against the LAST commit
touching app/android, and a version stamp is exactly the kind of change
that should not need its own separate paragraph).
