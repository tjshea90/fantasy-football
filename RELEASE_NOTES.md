# Release notes

Newest first. Every version is one checkpoint zip and one APK; `VERSION` is the
only place the number lives.

## v4.6 — the bottom navigation, and a dead end on the Live tab

**The nav bar.** Nothing in v4.5 moved it — it is pinned to the bottom of the
screen and the only styling that version added was colours. I diffed it to be
sure. But looking properly found a real problem underneath: the bar is 89 pixels
tall and the page was reserving 124 for it, a stale number left over from when
the tabs were shorter. That put a permanent 35-pixel dead strip above the bar.
Fixed, and now derived from one number so it cannot drift again.

**If it still looks too high, check Data → Screen fit.** There is an "Extra
bottom padding" slider there, it is *saved*, and it survives every update — so a
value set once months ago looks exactly like a new bug. That card now shows you
the bar's real height, what the app expects it to be, the size of your phone's
system bar, and your slider value, with a one-tap "put the tab bar back down".
Tell me those numbers if it still looks wrong and I can settle it immediately.

**Tapping a player before kickoff now does something.** It used to flash "no
stats synced" and stop — on the screen you use most, on the days you actually
use it. It now shows when he plays, who he plays, what the app projects him for,
the injury note, and Claude's read if there is one. All of that was already
being calculated; none of it was reachable.

**"TO PLAY" is gone where the kickoff time already says so.** The row read
"Bo Nix QB DEN Sun 4:05p TO PLAY". The time says the same thing and says when —
and on a narrower phone that redundant tag was squeezing the player's *name* into
an ellipsis.

**One fix you will not see:** the file the app hands to the Claude app now
carries its read permission properly through the share sheet. Without it, Claude
could be given a file it is not allowed to open — and that failure shows up in
Claude, not here, which is a miserable place to debug it.

## v4.5 — the three bugs you reported, two new features, and a full sweep

### The three you reported
- **The JSON error is fixed, and the cause was not what the message said.**
  Three separate defects. The parser was anchored to the first `{` in the whole
  answer and never moved it, so a single brace in Claude's between-search
  narration poisoned every attempt. The stream discarded the *reason* the model
  stopped, which is how a `max_tokens` truncation surfaced as a generic parse
  failure with the diagnosis already thrown away. And it was quadratic, so a
  long answer chewed the phone right after a two-minute wait. It now finds the
  JSON in one pass and, when the answer was genuinely cut off, **rescues the
  players that did arrive instead of losing the whole sync** — those searches
  were already paid for. When it truly cannot, it says which of the real causes
  it was.
- **Sentences no longer stop mid-word.** The injury note was hard-cut at exactly
  220 characters at ingest — that is why "Even still, Swift wil" appeared in
  three places at once: the *why* line and the FLAGGED list read the same stored
  string. Now 600 characters, cut at a sentence or a word boundary, with a
  visible "…" when anything was dropped. For an injury note this matters more
  than it looks: a cut in the wrong place can invert the meaning.
- **"Re-default all teams now" actually re-defaults.** It was skipping every
  slot you had touched — correct behaviour for the automatic fills that run on
  boot and after each sync, which must never undo your decisions, but wrong for
  a button whose whole purpose is asking for the defaults back. The more changes
  you had made, the more certainly it did nothing. It now asks first (it is
  discarding your picks), says how many, and tells you what it changed.

### Use the Claude app instead of an API key
A new card under **Sync advice** on the Advice tab, and under **Ask Claude about
the wire** on the Rosters tab.

1. Tap **Make the file for Claude** — the share sheet opens, pick Claude.
2. Send it with **no message of your own**. The file explains itself.
3. Claude gives you a file back. Tap **Load Claude's reply** and pick it.

Everything fills in exactly as if the API key had done it. Because it costs you
nothing extra, this path asks about **every player on your roster**, not just
the ones the paid path judges worth researching. If the file picker is not
available, you can paste the reply instead — it finds the JSON either way, even
in a whole chat message.

### When each player plays, and a warning before Thursday
- Every player now carries his **day and kickoff time** next to his name, on
  Live, Lineups, Rosters and Advice. Anyone playing **before Sunday** is in
  amber.
- An **alert card** leads the Live, Lineups and Advice tabs whenever you have
  players in early games. It leads with the ones the app recommends that are
  still on your bench, with a one-tap fix, and says how long you have.
- The same warning now fires as a **notification with the app closed**.
- All of this costs no extra data: the kickoff times come from the scoreboard
  request the live poll was already making and throwing away.

### The app now sleeps
It did not before. The live poll kept running in the background — every 45
seconds, pulling sixteen box scores on a Sunday — behind whatever you were
actually doing. It now stops the moment the app leaves the screen and restarts
when you come back, and the WebView is released properly so it stops holding
memory it only needs while visible.

### Fewer, politer requests
Every tap of Sync advice used to refetch the entire ESPN projection feed and the
whole injury list, even when a previous tap had just done it. After a failure
that was the worst case: retrying pulled megabytes down again to reach the step
that had failed. Both are now reused for a short window, and the sync report
tells you when it reused rather than fetched — nothing pretends to be fresher
than it is.

### And one that would have stopped the app booting
Found while sweeping: a single-word mistake in the new sleep code would have
thrown before the app painted a pixel. Eleven passing test suites and a clean
APK build said nothing, because not one of them actually ran the screen file.
There is now a suite that does, and it proves the battery fix by counting live
timers rather than by reading the code: boot arms one, backgrounding leaves
zero, returning does not stack a second.

---

## For your approval — considered, deliberately NOT built

You said to consider ideas from similar apps but not to make major changes
without your say-so. These are the ones worth having; none of them are in this
build. Say which you want.

1. **A start/sit confidence bar per slot.** Sleeper and Yahoo both show how
   clear-cut a decision is. Here it would be honest, because the app already
   simulates: "start Olave over Adams — he wins 71% of simulated weeks". Small
   change, uses `sim.js` as it stands.
2. **Notify when a rostered player's injury status changes**, not only on the
   morning check. The feed is already fetched; this is a comparison against the
   previous fetch plus a notification.
3. **A "what changed since you last looked" card** on the Live tab — scores,
   new designations, lineup deadlines passed. Common in ESPN's app and genuinely
   useful mid-week.
4. **Opponent-aware waiver suggestions**: flag a free agent who is good *and*
   plays the team your opponent's starter also faces. The app has both rosters
   and the schedule, so nothing new is fetched.
5. **Trade finder** rather than only a trade evaluator: scan the other nine
   rosters for two-for-one swaps that help both sides under this scoring. This
   is the biggest of the five and the one most likely to need iteration.
6. **A season-long "points left on the bench" tally.** Bench regret exists
   per week; totalling it is a line of arithmetic and a genuinely painful stat.
7. **Widget or lock-screen reminder for early kickoffs.** The notification now
   covers this; a widget would be the next step and is a real chunk of Java.

## v2.9 — hardening
- One card can no longer take down a whole screen. Every card added since v2.3
  is built inside `addSafe`, and each screen is wrapped as well: a failure shows
  as one red card naming what broke, with everything else still on screen.
- Offline is now a sentence rather than a stack trace. `Native.online()` tells
  "you have no connection" apart from "the feed is broken" — the same exception
  at the socket, two very different things to read. Everything already synced
  keeps working: scores, standings, the League tab, the last advice, the recap.
- The ES2018 guard now covers every asset, not the original eight. It found
  nothing, which is the point of running it.
- Empty states everywhere new: no matchup, no final week, nobody on the wire,
  no trade selected, no alarm bridge on an older shell.

## v2.8 — recap, schedule, second source
- Weekly recap card with a share-to-league-chat button, optional one-cent
  Claude write-up over facts computed on the phone.
- Full-season round-robin schedule generator that refuses to touch a week that
  already has results.
- Sleeper wired in as a gap-filling second projection source, skill positions
  only, used only after every ESPN route and only where ESPN had no week line.

## v2.7 — lineup alerts
- A pre-kickoff check that runs with the app closed: starters on a bye, ruled
  OUT/IR/suspended/doubtful, and empty slots. Sunday at a time you set, plus
  Thursday afternoon. Pure Java, no exact-alarm permission, no WebView.
- "Run the check now" proves the whole path without waiting for Sunday.

## v2.6 — the wire and trade values
- Free-agent board built from the bundled database minus all ten rosters,
  ranked in this league's points, leading with players who beat somebody you
  are actually starting.
- Usage trends (attempts, carries, targets) on the board and on player detail.
- Trade evaluator on value above replacement times weeks remaining.

## v2.5 — simulation
- Live win probability, playoff/bye/title odds, seed distribution, power
  rankings, luck index, bench regret. New League tab. No network.

## v2.4 — the Claude bill
- Triage: settled / research / carried-forward. Searches sized to the players
  actually being researched. Cached prompt prefix. Smart / Full / Cheap switch.

## v2.3 — sync efficiency and the feed canary
- Final games are never refetched; box scores fetch three at a time.
- A renamed scoring column or collapsed coverage now raises a red alarm.
- The league book: every player ESPN reports, scored under this league's rules.

## v2.2 and earlier
See `STATE.md`, which carries the full history including the two real feed
bugs (a pick-six paid twice, uncredited two-point conversions), the frozen-UI
root cause, and the streaming fix for the Anthropic call.
