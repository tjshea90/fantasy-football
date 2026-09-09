# v4.7 — what changed, and what to check on your phone

You asked me to audit the app, fix what I found, and add two gestures. The
audit turned up 22 defects across the scoring engine, the advice layer,
persistence, the Java shell and the UI. **Two of them were silently changing
numbers the app exists to get right.** All of them are fixed and pinned by
tests; 13 suites, 0 red.

---

## The two that mattered

### 1. The auto-fill was benching players who had already played

`autoLineup` ranks a roster on projections and has no concept of time. So a
player who had already banked 33 real points was compared on his 6.2 preseason
number and lost his slot to somebody who had not kicked off yet — and
`applyAuto` overwrote him, because the only thing it protected was a slot you
set by hand. A slot the app filled itself was not one of those.

That is not a rare path. The auto-fill runs on boot, on every week change, and
**after every sync including the quiet 45-second live poll**, for all ten
teams. So it fired repeatedly, on its own, all Sunday afternoon. I reproduced a
team total going from 33 to 0.

Everything downstream inherited the wrong number: the live matchup, the
head-to-head result, the weekly most-points book, and the season points title.

**Now:** once a player's game has started he cannot be moved by the automation,
in either direction — he cannot be dropped from a slot and he cannot be added
to one. The Lineups screen marks those slots "● started", dims them, and says
why the app will not touch them. You can still change one yourself; it asks
first, because the only good reason to do it is correcting the app to match
what RTSports actually had.

### 2. Claude's verdicts were being thrown away for 15 of your 170 players

`ai.js` filed each verdict under `Names.canon(name)` — which formalises a first
name, *Chris → christopher* — and `recommend.js` looked it up under
`Espn.normName(name)`, which does not. The write and the read never met.

That is **Chris Olave, Josh Allen, Joe Burrow, Mike Evans, Sam LaPorta, Josh
Jacobs, Cam Skattebo, Tony Pollard, Jake Ferguson** and six more. Three costs:

- the projection adjustment was lost
- the reasoning never appeared on the card, so nothing looked wrong
- the triage read the same broken key, so they came back **"never checked" on
  every single sync** — you paid for the same search again, week after week

And the bad one: Claude saying *"he is OUT, he will not play"* is supposed to
remove a player from consideration entirely. For those fifteen it did nothing
at all, and the app kept recommending him.

**Now:** one tolerant reader (`Names.hit`) tries every spelling of a name, so
nothing already cached on your phone needed migrating. The same defect existed
in three more places and all four are fixed:

- the **injury feed** — "Kenny Gainwell" in ESPN's feed against "Kenneth
  Gainwell" on your roster meant no OUT flag at all. That is the exact failure
  `names.js` was written for, on the one path where it costs a week.
- **`Projections.find`** — a spelling miss silently dropped the ESPN weekly
  line, the Sleeper line and the season pace (weights 3.0, 2.0 and 1.0 — most
  of the blend) and fell back to a flat positional average.
- the **ESPN/Sleeper merge** — the two feeds' second opinions were filed as two
  different players whenever they spelled a name differently.

---

## The return-touchdown rule

You settled it: *"a defense touchdown is only scored one time. individual
player doesn't matter."*

That was the one item `RULES_2026.md` had flagged as genuinely ambiguous in the
rules image, and it had become a setting on the Data tab. The setting is now
**gone**, not switched off — because while it existed it was wrong in both
positions:

- Turning it ON did not **move** the six points, it **added** them. The
  returner got +6 and the D/ST still got +6, so one punt return was worth 12
  league points. That is the same defect as the v1.8 pick-six, behind a switch.
- The score cache never covered the flag, so flipping it changed no number on
  screen until you restarted the app.

Return touchdowns are still recorded on the player's line and shown on his
card. They are worth 0. There is now exactly one place in the engine where a
return TD scores: the D/ST.

`RULES_2026.md` has been updated to record this as a stated fact rather than an
open question.

---

## Your two gestures

**Swipe left and right** moves between the seven tabs, in the order the bottom
bar is in — the swipe reads that order from the bar itself, so the two can
never disagree.

**Pull down from the top** refreshes, on any tab. It runs the same sync the
"Sync week" button runs, with the same progress bar, plus a schedule refresh.

The care went into what it *doesn't* do:

- the axis is decided once in the first few pixels and then sticks, so the
  screen never scrolls and slides at the same time
- a vertical drag reaches the browser untouched — the gesture only claims a
  touch after it has committed to it
- a `<select>`, a sideways-scrolling table, and anything inside a dialog keep
  their own drags
- pull-to-refresh only fires when you are already at the top; anywhere else a
  downward drag is a scroll
- both sleep when the app is backgrounded
- a flick needs speed **and** distance. The first version changed tab on a 30px
  twitch, which the test caught.

**The back button also works properly now.** It used to quit the app from
anywhere — including with a dialog open — because it deferred to a WebView
history that this app never writes to. It now closes an open dialog, then
returns to Live, and only then lets the app exit.

---

## Everything else that was fixed

**Your API key was being written to the public Downloads folder.** "Export
backup" serialised the whole state, `aiKey` included, in cleartext — and that
is the file you would move to a PC or send to someone. It is redacted now, and
restoring a backup no longer wipes the key already on your phone.

**Saving got ~75× cheaper, and honest.** `rawSave` threw away the bridge's
return value and reported success unconditionally, so a failed write looked
like a good one. And at 14 scored weeks every lineup change rewrote **1.9 MB**
through a blocking bridge call on the UI thread — 98.7% of it the league book
and stat lines, which a lineup edit cannot touch. Those now live in their own
file and are written only when a sync changes them: **1924 KB → 25 KB** per
edit. Your existing save loads fine and splits itself on the first write.

**The lineup alarm.** The check always understood that Tuesday through Saturday
is "before Sunday" — but only two alarms ever ran it (Sunday, and Thursday at
16:00), so a Wednesday opener or a December Saturday got no closed-app warning
at all. It is one daily alarm now, with a 30-hour horizon and duplicate
suppression so daily does not mean noisy. It also names only the players the
app would actually **start**: the page now writes that list where the alarm can
read it, instead of the alarm listing every bench player with an early game.

Smaller ones: exponential backoff when you are offline (it retried every 60
seconds, forever); one shared bye-week rule, because Java and JavaScript
resolved byes differently; standings sort on win percentage; the week arrows
stop at 17 instead of 18; 44px touch targets and a visible focus ring; both
`innerHTML` error paths escaped and two unused `file://` WebView privileges
turned off; text now follows your phone's font-size setting instead of being
pinned at 100%; a timed-out request can no longer strand its response in the
Java heap; `seed.json` (38 KB of build-time source) no longer ships in the APK.

---

## What to check on the phone

1. **Swipe left/right across all seven tabs**, and check it does not fight
   scrolling on the League and Data tabs, which are the longest.
2. **Pull down to refresh** from the top of Live. It should sync the week.
3. **Press back** with a dialog open (Data → Export a backup shows one) — it
   should close the dialog, not the app.
4. **On Sunday**, open Lineups mid-slate and check the "● started" markers and
   that the auto-fill has left those slots alone.
5. **Data → Export a backup**, then open the file — confirm your API key is not
   in it.

Everything deterministic is covered by `node tools/test_locks.js`,
`test_gestures.js` and the other eleven suites.

---

## Still on the list, not built

The three from the audit I would do next, if you want them:

- **A "what it cost you" line on the recap.** The app already has every bench
  player's scored line and the lineup you actually played. The gap between
  them — and which single swap would have flipped the week — is the most-read
  number in every app that has it, and it needs no network.
- **A weekly name-folding check on the Data tab.** Three of this round's
  defects were the same key mismatch in three modules. A card reporting how
  many rostered players got no projection, no injury record and no Claude
  verdict this week would have caught all three from the phone.
- **Longest-completion attribution.** The +5 currently goes to the team's
  leading passer rather than whoever actually threw that ball — ESPN's passing
  group has no LONG column, so getting it exactly right means reading the play.
  It may not be worth it; say the word.
