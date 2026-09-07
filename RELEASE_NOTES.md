# Release notes

Newest first. Every version is one checkpoint zip and one APK; `VERSION` is the
only place the number lives.

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
