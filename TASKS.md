# TASKS — the current job, in Tj's words

## 2026-09-15: stats tab + game logs + long-press player stats + top players

> "Make a new tab and section in this app called stats. In the stats section
> i can search for any current NFL player using the search feature already in
> the app, and I can click on a player and see the game logs stats line for
> the player for all games so far this season starting with the last game
> they played. It will also calculate the fantasy points scored for each game
> they played for this specific league scoring system. Make sure to calculate
> their points using only the rules for this league. Also include defenses
> as a whole and score them how this league scores defenses. In the stats
> section, include an option for me to view game logs by team. This will let
> me pick an NFL team and show me the full stats line for every player on
> that team that played, including the defense as a whole and the fantasy
> points for each player and defense calculated by this league scoring
> method. Sort the team stats by player position. If I select a team, only
> show the last game stats, with a drop down box or other way to be able to
> select older games and view those game logs too. Everywhere else in the
> app, make it so I can long press on a player and press view stats, and it
> will show the stats for this player just like in the stats tab, and if
> space allows, it will show stats lines in columns per game played (game
> logs), starting with the most recent game (or game currently being played
> live) at the top. Finally, in the stats tab, make a button for top players.
> This button will show the top 10 highest fantasy points scored by
> position, including team defenses, for the current (or just finished) NFL
> week, with the highest scoring at the top then descending.
>
> After the features are built, do comprehensive testing and make sure:
> 1) all data loaded is cached until a refresh
> 2) any of this data may be manually refreshed by a pull down gesture
> 3) the ui is easy to read and intuitive
> 4) there are no bugs or errors throughout the app. Find them and fix them.
> 5) the app is well coded and efficient
> 6) the app properly sleeps when backgrounded or closed
> 7) all Internet pulls are efficient and won't lead to restrictions from
>    providers. The app may use as much Internet and storage as needed, but
>    should not be inefficient.
> 8) make sure any changes or new features do not break anything else in the
>    app."

Architecture notes from the first pass (2026-09-15), so a resuming session
does not have to re-derive them by re-reading every module:
- `Scoring.score(line)` (scoring.js) already scores ANY stat line under this
  league's rules, including a D/ST line built by `Espn.dstLine(teamAgg)` — no
  new scoring logic needed, only new callers.
- `PlayerDB` (playerdb.js, 785 players incl. all 32 DEF units, `{n,p,t,b,e}`)
  is the existing "search any current NFL player" database — reuse its
  `search()`, do not build a second one.
- `Espn.gameStats(eventId)` returns FULL stat lines for every player in a
  game (both teams in one fetch) — this is what a game log needs.
  `Espn.weekGames(season, week)` finds a team's event id for that week.
  `S.stats[week][pid]` and `S.book[week][name]` (store.js) are NOT enough on
  their own: `stats` only covers the ~170 rostered players, and `book` is
  points-only (no full line) — a real full-line, any-player, any-week cache
  does not exist yet and is the main new piece of plumbing.
- Plan: a new self-contained `gamelog.js` module (mirrors playerdb.js's own
  Native.save/load key, not part of the main Store save cycle, so it never
  bloats the per-edit save) that caches full box scores PER TEAM PER WEEK —
  one `Espn.gameStats` fetch caches BOTH teams in that game, so browsing one
  team's log is never a second fetch for its opponent. A `state:'post'`
  entry is cached forever (never re-fetched, matching doSync's existing
  reuse-if-final pattern); pull-to-refresh is the only way to force a
  re-fetch. Player search + team browse + "Top players" (which can mostly
  reuse `Store.bookWeek(week)`, already computed under this league's scoring
  for every player who played, joined against PlayerDB for position) all
  read this one cache.
- New Stats tab follows the existing `Recommend.render(root, ctx)` /
  `viewAdvice` delegation pattern: a `stats.js` module exposing
  `Stats.render(root, ctx)`, called from a new `viewStats` in ui.js.
- Long press: nothing like it exists yet (checked gestures.js and ui.js —
  gestures.js only does swipe/pull). Needs a new delegated
  touchstart/touchmove/touchend/touchcancel listener (separate from
  Gestures, which does not read Store or player identity) keyed off a
  `data-player` attribute added to player rows across Live, Lineups,
  Rosters and Wire.

- [ ] 1. `gamelog.js`: per-team-per-week full box score cache, lazy +
      persistent, one fetch caches both teams, `state:'post'` cached forever.
      Test: `tools/test_gamelog.js`.
- [ ] 2. Stats tab: player search (reusing PlayerDB) -> full-season game log
      for that player (or DEF unit), most recent game first, league points
      per game via `Scoring.score`.
- [ ] 3. Stats tab: browse by team -> last game's full stat line for every
      player who played + the DEF unit, sorted by position, with a
      week-picker for older games.
- [ ] 4. Long-press "View stats" on a player anywhere in the app (Live,
      Lineups, Rosters, Wire) opens the same game-log view as the Stats tab.
- [ ] 5. "Top players" button on the Stats tab: top 10 by position (incl.
      DEF) for the current/just-finished week, highest first.
- [ ] 6. Wire the Stats tab into the nav, swipe order, and pull-to-refresh
      (force-refetches whatever is currently on screen).
- [ ] 7. Comprehensive pass per Tj's 8 numbered testing requirements above —
      caching, pull-refresh, UI clarity, bug sweep, code quality/efficiency,
      sleep/background behavior, network efficiency, no regressions.
- [ ] 8. `ship.sh`, publish a GitHub Release, send Tj the link (standing rule).

## 2026-09-15: the resume-system failure itself (fix, not a feature)

> Tj, after this exact request was interrupted by a usage cap and a fresh
> session could not find any trace of it: "This is a major failure in the
> resume function. Figure out why Claude could not resume this prompt and
> fix it thoroughly. It is very important that Claude can resume all tasks
> after usage interruptions without me re-explaining everything."

Root cause (confirmed against this session's own history): a session spent
its entire budget reading the codebase and never got to the step CLAUDE.md
already required ("write the request to TASKS.md ... before writing any
code") before being cut off. The `PostToolUse` autosave hook only fires on
`Edit|Write|NotebookEdit|Bash` — a pure research stretch (Read/Grep/Glob)
trips it zero times, so nothing reached disk, and the next session opened
cold with nothing to find. The system worked exactly as designed; the gap is
that "write it down first" depended entirely on a session remembering to do
it, with no mechanical backstop if the cutoff landed before that.

- [x] 1. Diagnose the exact failure mode (above). Verified against real
      history: `origin/main`'s `730d4e5` is a sibling session that resumed
      correctly from what WAS on disk — proof the resume mechanics work when
      there is something to find.
- [ ] 2. `tools/capture_inbox.sh` + a `UserPromptSubmit` hook in
      `.claude/settings.json`: every message Tj sends is appended to
      `INBOX.md`, verbatim, and committed+pushed immediately — before Claude
      does any work on it. This is the mechanical backstop: it does not
      depend on a session's judgment or on any Edit/Write/Bash call ever
      happening.
- [ ] 3. `tools/resume.sh` prints the tail of `INBOX.md` unconditionally on
      every boot, so a resuming session sees the raw, guaranteed-captured
      ask even if `TASKS.md` was never updated to reflect it.
- [ ] 4. Document the new mechanism in `CLAUDE.md` ("Saving work" gains a
      layer 0, ahead of the autosave hook).
- [ ] 5. Test: simulate a `UserPromptSubmit` call by hand, confirm
      `INBOX.md` gets the entry and a commit lands; confirm `resume.sh`
      surfaces it and does not error when `INBOX.md` is absent.
- [ ] 6. Report to Tj plainly what the failure was and what closes it.

## When Tj asks for something new

Write it HERE FIRST, in his own words, as unticked boxes — before writing any
code. Until it is on disk the job exists only in a chat window that no other
Claude account can see, and a usage cap landing before the first checkpoint
loses not just the work but the knowledge of what was asked.

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

- [ ] **Confirm the v5.7 GitHub Release link downloads cleanly**:
      ```
      https://github.com/tjshea90/fantasy-football/releases/tag/v5.7
      ```
      Fully verified server-side (real Release, asset uploaded, correct
      content type, `Content-Disposition: attachment` on the download) —
      just needs a real-device confirmation. From here on, every future
      ship sends this style of link automatically (see CLAUDE.md "After
      every ship").
- [ ] **Confirm today's (2026-09-14e) changes on the phone** once the new
      version is shipped and its Release link arrives: the app should open
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
