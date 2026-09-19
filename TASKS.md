# TASKS — the current job, in Tj's words

## Current job (2026-09-19) — OVERALL UI AND CODE IMPROVEMENT / BUG SWEEP

Tj, 2026-09-19T00:39:00Z:

> "Now do an overall ui and code improvement/bug search and fix"

Broad and open-ended by design — not a specific complaint like the last three
jobs, so there is no screenshot or repro to anchor to. Treating this as: sweep
the whole app (the Android Java shell, the HTML/CSS shell, and all of
app/assets/*.js) for real bugs and real UI rough edges, fix what is found,
test each fix, and ship. Not a rewrite and not a redesign — this app has just
been through a real feature overhaul (v7.7-v7.9); the job is to find what is
actually broken or actually rough, not to invent scope.

### Steps

- [x] **A. Baseline.** Confirm all suites and the ES2018 gate are green before
      touching anything, so every failure found below is attributable to this
      sweep's own fixes, not inherited noise.
- [x] **B. Sweep the Android Java shell** Done. One real inconsistency found: NativeBridge.deviceInfo() built JSON by hand, escaping only a literal double-quote in Build.MODEL, unlike every other JSON-building bridge method (which all use org.json.JSONObject.quote()). Fixed for consistency -- a backslash or control char in the device model would otherwise break JSON.parse on the page side. (Currently unused by any JS caller, so dormant, not yet triggered -- fixed anyway rather than left as a landmine for the next caller.) (`android/`) — the thin WebView
      wrapper, Alerts.java, any broadcast/notification/backup code — for bugs.
      Small surface, but it is the one place a JS bug cannot reach and the one
      place BRIEF.md's rules (one universal APK, no Gradle) are easiest to
      violate by accident.
- [x] **C. Sweep `index.html` and `app.css`** Done. Cross-checked every CSS class ui.js constructs (both static el() calls and dynamic concatenation) against app.css -- none missing, none dead. Script load order verified safe (no top-level cross-module reference runs before its dependency loads). Nothing to fix. for structural/UI issues:
      inconsistent spacing, unreachable rules, missing dark/light handling,
      accessibility gaps, anything that doesn't match how the rest of the app
      is styled.
- [x] **D. Sweep `ui.js` tab by tab** Done, every card read. Two real fixes: (1) rosterInjuryCard ('your roster -- injuries') was the one place the 2026-09-18d wire fix's seasonOutlook() logic hadn't reached -- health() collapses a plain weekly OUT and a season-ending IR designation into the identical tag, so the card most likely to be asked 'why is this guy out' gave the least useful answer. Now shows the same, now-correct season-ending/long-term-out distinction the Wire tab does. (2) the Scoring rules card's weekly-bonus hint was STALE and actively wrong: it told Tj the three +5 longest-play bonuses 'cannot be derived from a box score alone' and must be added by hand, when Scoring.applyWeeklyBonuses has since been wired into doSync and applies them automatically -- following the stale advice would have double-counted. Rewritten to describe actual behavior, including the one real imprecision (a two-QB game) that IS still worth a manual check. Also documented (not fixed -- no better data source exists without a new play-by-play feature) the same two-QB edge case at its doSync call site. (4388 lines — Live, Lineups, Roster,
      Wire, Stats, Advice, Data) for correctness bugs and rough UI edges:
      stale renders, missing guards, inconsistent formatting, dead branches,
      copy that no longer matches behavior.
- [x] **E. Sweep the data/logic layer** Done. Two real fixes: (1) teamreport.js's rosterRow() computed onBye as `Number(p.bye) === Number(week)` directly instead of Store.isOnBye(p, week) -- the exact bug class recommend.js's own myStarters carries a standing warning against. A free-agent-database player with no bye of his own but whose NFL team IS in the league's bye table read as available and priced at his full rate for a week he cannot play, feeding a wrong number into the whole-team-analysis Claude prompt. (2) playerdb.js carried its own inline copy of Espn.normName's exact regex sequence -- character-for-character identical today, but two independent normalizers is precisely the failure class names.js exists to guard against (the Kenny/Kenneth Gainwell bug). Now delegates. Both pinned with new tests confirmed to FAIL against the pre-fix code. Also checked and confirmed CORRECT (not bugs): Value.trade/valueOf/perGame already delegate to the fixed ros.js engine from the v7.7 job, so the Trade evaluator was never on the old buggy path; scoring.js's RULES table verified line-by-line against RULES_2026.md, no disagreement. Flagged, not resolved (a product/scope decision, not a bug): sim.js's season()/power()/allPlay() are tested but never surfaced on any tab, and bracket() is entirely unused -- three consecutive checkpoints have deferred this exact question to Tj; still deferred. (store.js, value.js, recommend.js,
      ai.js, handoff.js, espn.js, projections.js, ros.js, scoring.js,
      playerdb.js, names.js, usage.js, gamelog.js, schedule.js, gestures.js,
      recap.js, teamreport.js, sim.js, stats.js) for correctness bugs,
      inconsistent error handling, and dead code — outside what the last three
      jobs already covered in depth (the waiver/wire stack).
- [x] **F. Fix everything found** Done -- 5 real fixes (deviceInfo escaping, rosterInjuryCard season-outlook, teamreport.js bye fallback, playerdb.js normalizer consolidation, the stale scoring-bonus hint), each with a named test confirmed to fail against pre-fix code where practical (source-text pins where a full render harness does not exist for ui.js, matching this file's own established testing convention)., each fix with a named test that is
      confirmed to fail against the pre-fix code where practical.
- [x] **G. Full regression sweep** Done, and it caught a real process gap of its own: this session's early regression checks grepped test output for the word FAIL, which treats a silent CRASH (nonzero exit, zero FAIL lines ever printed) as green -- exactly what the playerdb.js consolidation had done to test_boot.js undetected for two commits, because two of that file's own minimal harnesses never loaded espn.js. Fixed (both harnesses now load the real espn.js), and every suite is now verified by BOTH exit code and FAIL-count. All 21 suites green, ES2018 gate green, confirmed clean this way. — every suite green, ES2018 gate green,
      confirm nothing this pass touched broke anything the last three jobs
      just finished.
- [x] **H. Ship** Done: v8.0 shipped via `ship.sh` (all 21 suites green, ES2018 gate, dex-completeness), Release published and verified via `get_release_by_tag` (FFTracker-v8.0.apk, 330006 bytes, non-empty assets array, not a draft). Link sent to Tj. (`ship.sh`), publish the GitHub Release, send Tj the link.

## Prior job, complete (2026-09-18d) — THE WAIVER WIRE IS BROKEN (shipped v7.9)

Tj, 2026-09-18T20:01:29Z (with a screenshot of the Wire tab in week 2: a red
headline reading "36 players on your roster are out for the season — those
spots are doing nothing until you replace them", followed by four rows —
Wan'Dale Robinson WR, Juwan Johnson TE, Josh Jacobs RB, Brenton Strange TE —
every one of them tagged REPLACE and every one of them saying "replaces Dalton
Schultz, who is out for the season", with four identical "Add + drop Dalton
Schultz" buttons):

> "Look at the attached screenshot of the waiver wire engine. It is broken.
> Notice it says 36 players on my roster are out for the season. My roster is
> only 17 players. Also, generally it should recommend a same type player
> position for the recommended drop and add, because if I drop a te, I should
> have a backup te to replace him, but this rule is not absolute; for example
> if a star player with high output is available, it would make sense to drop
> a low output player even if he is in a different position. Finally, it seems
> as though the engine hallucinated. Dalton Schultz is not out for the season,
> but the app claimed he is. This is a major error. I don't know what
> happened, maybe it pulled old, outdated news.
>
> Do a thorough overview of the waiver wire section while still keeping in
> mind the prior request when you remade it for the newest app version. The
> waiver wire should be a smart section for recommending good drops and adds.
> Right now it is broken"

"The prior request" is the 2026-09-18c job directly below — its six rules
still stand in full and nothing here may quietly undo them.

### What is actually wrong — proved, not guessed (2026-09-18, live feed)

Fetched ESPN's real `/injuries` feed (800 records, the same endpoint
`Recommend.loadNews` reads) and ran this app's own regexes over it:

1. **THE HALLUCINATION IS A REGEX READING SOMEBODY ELSE'S INJURY.** Dalton
   Schultz's live record has `status: "ACTIVE"`. His blurb reads: *"...saw his
   floor raise when **Jayden Higgins** went down with a **season-ending torn
   ACL** over the summer."* `Recommend.seasonOutlook`'s SE_NOTE regex matches
   `season-ending` **anywhere in the free text** and does not look at `status`
   at all — so Schultz is written off for the year because of a sentence about
   a different man. 13 of the 14 players the note-regex flags are status
   ACTIVE, i.e. certainly false. Among them: **Patrick Mahomes** ("last
   December's season-ending knee injury") and **Malik Nabers** ("a torn ACL
   ... in Week 4 of last season") — both flagged for injuries they have
   already returned from, because the note has no sense of WHOSE injury it is
   or WHEN it happened. Tj's guess ("maybe it pulled old, outdated news") is
   half right: the feed is current, but the blurb inside it talks about last
   season and about other players.
2. **"36 PLAYERS" COUNTS SUGGESTION ROWS, NOT PLAYERS.** `ui.js`'s
   `forced = ups.filter(u => u.mandated)` counts entries in `Value.upgrades()`,
   and every entry is a *free agent paired with a drop*. One falsely-dead
   roster player is worth ros 0, which makes him the weakest drop candidate at
   his own position AND the weakest flex-eligible candidate overall, so he is
   paired with every single free agent that clears the gates. 36 rows, one
   player. The count must be over DISTINCT ROSTER PLAYERS.
3. **THE SAME MAN IS OFFERED AS THE DROP OVER AND OVER.** You can only drop
   Dalton Schultz once. `upgrades()` has no assignment step, so one roster hole
   swallows the whole board and every genuine upgrade elsewhere is pushed off
   the bottom of the list. Rule 4 of the prior job asked for pairs "on a one to
   one basis" — the Claude prompt says it, the deterministic board never did it.
4. **NO POSITION DISCIPLINE (Tj's new rule).** With `drop.outForSeason` the
   gates are set to 0/0 and the flex branch picks the globally weakest
   flex-eligible man, so a TE hole gets "filled" by a WR and an RB while the
   roster is left with no tight end. Same position should be the default; a
   genuinely bigger cross-position edge should still be allowed to win.

### Steps

- [x] **A. Fix the false season-ending flag at its source** Done. seasonOutlook rewritten around the feed's structured fields (status / details.returnDate / details.fantasyStatus), which loadNews was throwing away; the note is demoted to corroboration that must be about THIS player and not a past season. Tested by test_wire.js ("the exact live records that produced the hallucination", "a genuinely finished player is still caught", "on IR but COMING BACK", "a report written in the POSSESSIVE", "a plain weekly OUT"). Verified against all 800 live records. (`recommend.js`
      `seasonOutlook`). The status field must be respected — an ACTIVE player is
      not out for the year, full stop. A note may only promote when it is about
      THIS player (his own surname near the phrase, no other player named in
      between) and is not describing a PAST season. Distinguish IR/PUP (a
      designation, long-term but returnable) from a genuinely season-ending
      one, and never state more certainty than the feed supports.
- [x] **B. Count distinct roster players, not rows** Done: new Value.mustReplace() counts holes off the roster and ui.js names the men. Moved outside `if (ups.length)` so a dead spot with nothing on the wire is still reported. Tested by test_wire.js ("Value.mustReplace() names the one actual man" and the roster-size bound). (`ui.js` Wire tab). The
      headline must say what is true of the roster: one line naming the actual
      men, and never a number larger than the roster.
- [x] **C. One drop, one add — a real assignment** Done: upgrades() builds every plausible pair, ranks, and greedily assigns; normalizeWaivers enforces the same on the Claude path. Tested by test_wire.js ("ONE roster spot cannot be offered to the whole wire", "the one-to-one drop rule is ENFORCED, not merely requested"). (`value.js` `upgrades()`).
      Each roster player may be the drop in at most one suggestion; each free
      agent may appear once. Best pairing first, then the next best over what
      is left.
- [x] **D. Same-position first, not absolutely** Done: cross-position swaps clear double both bars and rank at 0.75x; a forced cross-position replacement must also beat the best available player at the emptied position. Tested by test_wire.js ("LIKE FOR LIKE WINS WHEN BOTH ARE AVAILABLE", "...BUT THE RULE IS NOT ABSOLUTE", "a cross-position swap must clear DOUBLE the bar"). (`value.js` `upgrades()`).
      Prefer a replacement at the dropped player's own position; allow a
      cross-position swap only when its edge is clearly bigger, and say so in
      the row's reason. Must not re-open the QB/K/DEF or MIN_GAIN/MIN_SEASON
      gates from the prior job.
- [x] **E. Positional depth must survive a drop.** Done: slotNeeds/lineupFillable/bodyCounts, checked against the roster and against the roster as it stands after the swaps already listed. Tested by test_wire.js ("THE TE CASE, IN TJ'S OWN WORDS", "TWO swaps that are each legal alone must not be illegal together", and the helpers directly). Never recommend dropping a
      man if it leaves the roster unable to fill his starting slot (the TE case
      Tj names). This is the roster-integrity half of rule D.
- [x] **F. The same bad flag anywhere else it reaches** Done: one fix at the source; rosterValues, ai.js and handoff.js all consume the new shape and both prompts now distinguish "on IR until Oct 18" from "out for the season". Tested by test_wire.js's prompt checks plus the existing test_ai/test_handoff suites. — `ai.js` (the Claude
      prompt's MUST BE REPLACED block), `handoff.js` (the export's same block),
      `value.js` `rosterValues` (zeroing a healthy player's value). One fix at
      the source, verified not to leave a second copy behind.
- [x] **G. Thorough overview of the whole wire section** Done, and it found four more real bugs, three of them in this job's own change: the headline nested inside `if (ups.length)`, the possessive-name miss, the per-pair (rather than cumulative) lineup-legality check, and the tab's "thinnest spots" line naming QB in contradiction of rule 6. All fixed and tested., as asked: re-read
      ros.js, value.js, recommend.js, ai.js, handoff.js and the Wire tab
      against the prior job's six rules, and fix what else is wrong.
- [x] **H. Tests.** Done: new tools/test_wire.js with ESPN's live blurbs as verbatim fixtures. 32 assertions confirmed to FAIL against the true pre-fix commit and pass now; the pre-fix run reproduces the screenshot exactly (nine forced rows for one man, eight duplicate drops, a WR replacing a TE). All 21 suites green. A named test for each of the above, each one confirmed to
      FAIL against the pre-fix code before it is accepted. Real feed text
      (Schultz/Higgins, Mahomes, Nabers) pinned as fixtures so this exact
      class of error cannot come back. Every suite green.
- [x] **I. Ship** Done: v7.9 shipped, ship.sh gate green (all 21 suites, ES2018, dex-completeness: every source file produced a class, 28 in total), APK built and signed, releases/FFTracker-v7.9.apk committed.

## Prior job, complete (2026-09-18c) — WAIVER WIRE RANKING OVERHAUL (shipped v7.7)

Tj, 2026-09-18 (with a screenshot of the Wire tab showing every WR annotated
"16.4 proj (1 scored week in this app — thin sample) / wk1 9 tgt -> 16.4"):

> "Review the attached screenshot of this app. Notice the wire tab is only
> making recommendations and projecting scores based on prior weeks actual
> stats. This is a broken system. The wire section needs to be overhauled.
> Research and find a logical, reasonable way to rank players available on the
> waiver wire that are not already taken by a team in the league. The ranking
> should give logical results of the best available players in each position,
> maybe based on a blend of prior weeks stats, information gathered online,
> news and injury updates, projected stat lines for the current/upcoming weeks
> from multiple reputable sources online averaged and then recalculated based
> on this league scoring system, and any other relevant information you can
> think of. The following are strict rules for the system:
> 1) it must pull data from current season and current news using reputable
>    sources.
> 2) it must rank available players based on expected full season performance,
>    not just the next NFL week, and calculated for this league scoring system
> 3) it must only recommend I drop and add a player or players if they are a
>    meaningful improvement for the rest of the season over the player it
>    recommends I drop, and making sure to calculate the player value using
>    this specific league scoring system.
> 4) for the Claude prompt, overhaul it so that when it makes the ask Claude
>    file, it has all the criteria I mentioned, plus it explicitly recommends
>    which player or players to drop and replace on a one to one basis with
>    explicit reasoning and expected fantasy point edge (e.g. drop Michael
>    wilson and add d. Wicks because he is the new #1 receiver for the team and
>    expected to produce 54 more fantasy points over the season than Michael
>    Wilson, or, drop bo nix due to season ending injury and add j. Hurts
>    because he is the best available qb).
> 5) the Claude prompt should have no restrictions. It should be able to see
>    all taken players in the league so it doesn't recommend them, it should
>    know the league scoring system, it should search online for current injury
>    news, NFL News, waiver wire advice websites, projected stats websites, it
>    can consider prior weeks stats, or anything else that will allow it to
>    make good, data backed recommendations for specific players to add and
>    drop for my roster, with reasons for each recommendation.
> 6) the recommendation system should still give lower priority to qb kicker
>    and defense unless there is a strong, clear, season long edge for any of
>    its recommendations on these positions, or if there is a season ending
>    injury or anything else that mandates the player be replaced.
>
> Make sure the new recommendation system is smart and uses this league scoring
> system.
>
> When finished, check for bugs and ui improvements. Make sure the improvements
> did not break anything else in the app. Then ship."

### Steps

- [x] **A. Read the existing wire stack before changing anything.** Done. Root cause proved against the live ESPN endpoint, not inferred: the winning projections route returns no season split, so value.js perGame()'s season branch was dead code and every free agent fell to the single-measured-week branch. Written up in full in STATE.md's v7.7 entry.
      `app/assets/recommend.js` (the ranking), `app/assets/value.js` (season
      value math), `app/assets/projections.js` (multi-source blend),
      `app/assets/ai.js` (the ask-Claude file builder), the Wire tab render in
      `app/assets/ui.js`, and `tools/test_waiver.js`. Write down what actually
      produces the "16.4 proj (1 scored week — thin sample)" line in the
      screenshot, so the fix targets the real code path.
- [x] **B. Research the ranking method** Done. Sources used: FantasyPros' ROS methodology page, ESPN's expected-fantasy-points (xFP) work, Fantasy Projection Lab's projection-models write-up, and PFF/Fantasy Life on why usage is the stable part of a small sample. Method recorded in ros.js's header. (rule 1): how reputable public sources
      rank rest-of-season waiver value — opportunity/usage share, target and
      carry share, expected points per game vs replacement level, games
      remaining, injury/role news. Record the sources used.
- [x] **C. Rest-of-season value engine** Done: app/assets/ros.js. Tested by tools/test_waiver.js ("a full-season projection becomes a per-game rate AND a season total", "THE SCREENSHOT BUG", "the sample takes over as it grows", "efficiency is regressed toward the volume that produced it"). (rules 2 + 3): rank every available
      player by EXPECTED FULL-SEASON points in THIS league's scoring, not next
      week's. Blend prior-season/current-season baseline, current-season
      per-game production, usage/opportunity, and a games-remaining term.
      Shrink toward baseline when the in-app sample is thin (the screenshot's
      exact failure) rather than extrapolating one week.
- [x] **D. Drop/add must clear a meaningful season-long bar** Done: two gates, MIN_GAIN (per game) and MIN_SEASON (season points), both of which a swap must clear. Tested by test_waiver.js ("a marginal edge is NOT suggested, however real" and "a genuinely better free agent IS suggested"). (rule 3): a swap
      is only surfaced when the add beats the drop by a real rest-of-season
      margin in league points, computed against the worst droppable player on
      the roster, never a roster-slot coincidence.
- [x] **E. QB/K/DEF stay de-prioritised** Done, with the mandated-replacement override via the new Recommend.seasonOutlook. Tested by test_waiver.js (the three QB scenarios, "K/DEF never bump a real need", "the K/DEF exception needs a STRONG season edge", "a season-ending injury MANDATES a replacement"). (rule 6): keep the existing
      QB_MIN_GAIN-style gating, extend the same idea to K and DEF, and add the
      mandated-replacement override (season-ending injury / out for year /
      no longer starting) that bypasses the de-prioritisation.
- [x] **F. Overhaul the ask-Claude prompt** Done: Ai.waiverCriteriaText() states all six rules once and is shared by the export file and the paid API call. Tested by test_handoff.js ("the waiver briefing: Tj's six criteria", each rule pinned separately, plus the OWNED list by name) and test_ai.js ("one-for-one swaps with a point edge"). (rules 4 + 5): the generated file
      must carry the full league scoring system, EVERY taken player in the
      league (so Claude cannot recommend one), the full roster with each
      player's league-scored season value, the available pool, and an explicit
      instruction to return one-to-one drop/add pairs with reasoning and an
      expected season-long fantasy point edge per pair. No restrictions on what
      Claude may search: injury news, NFL news, waiver advice sites, projection
      sites, prior weeks' stats.
- [x] **G. Wire tab UI** Done: rows lead with expected rest-of-season points and games left, the basis on its own line; forced replacements are headlined separately with a REPLACE tag. Verified by an end-to-end smoke test reproducing the screenshot's exact scenario (16.4 in one week now prices at 8.6/gm). shows the new season-long basis honestly — no more
      "1 scored week in this app — thin sample" as the headline rationale.
- [x] **H. Tests** Done: test_waiver.js rewritten and extended; every new behaviour above has a named test, and the three staleness/regression fixes were each confirmed to FAIL against the pre-fix code before being accepted. All 19 suites green.: extend `tools/test_waiver.js` (and add suites as needed) to
      pin each rule: season-long ranking, the meaningful-improvement bar, the
      QB/K/DEF gate plus its injury override, and the prompt's required
      sections. Every suite green.
- [x] **I. Bug + UI sweep** Done. Four bugs found: the Wire tab never fetched the season projections; value.js's free-agent memo did not key on that cache; Store.setBook never bumped the store generation (older than this job); and upgrades() searched a global top-60 that came back ALL QB under season-total ranking (created by this job, caught by re-reading the diff). Plus a third instance of the dead-season-branch class in recommend.js's projectOne. All fixed, all tested. across the app afterwards; confirm nothing else
      broke.
- [x] **J. Ship** Done: v7.7 shipped, ship.sh gate green (all suites, ES2018, dex-completeness), Release published and verified via get_release_by_tag (FFTracker-v7.7.apk, 313622 bytes, non-empty assets array). (`ship.sh`), publish the GitHub Release, send Tj the link.

## Prior job, complete (2026-09-18b)

Tj, 2026-09-18T16:56:13Z: "For this app, there is still the glitch where it
opens on the live tab (which is fine) but if I press the waiver wire tab the
tab blinks to show that I pressed it, but it doesn't go to the waiver wire
tab. It is stuck on the live tab. I can press on other tabs and they open
and then go back to the live tab and after that the waiver wire tab works
normally. Fix this and look for other possible improvements in code and ui
for the app. Do all of this on sonnet"

- [x] Fix the tab-highlight glitch. **Root cause found and confirmed** (the
      previous job's investigation below found nothing — this is the actual
      bug): `boot()` restores `view` from `S.settings.lastTab` on a cold
      relaunch, but `wire()` only ever synced `aria-selected` for that
      restored tab, never the `.on` CSS class app.css actually paints. So a
      relaunch that restored `view` to something other than Live (Wire, most
      plausibly — see ui.js's own comment at `paintTabBar` for the exact
      mechanism) rendered that tab's content while the bar kept showing Live
      highlighted from the static HTML default. The next tap on that
      already-current tab then hit `goTab`'s legitimate `name === view`
      no-op guard, which looked exactly like "stuck on Live" — and tapping
      any OTHER tab was a real, different-name transition that synced the
      class for the first time, which is why everything "worked normally"
      after that. Fixed by extracting one `paintTabBar(name)` used by both
      `wire()` at boot and `goTab()` on every tap, so the two can never drift
      apart again. New regression test in `tools/test_tabsafety.js`
      ("THE REAL BUG (2026-09-18)") reproduces the exact two-session
      scenario (session 1 ends on Wire, session 2 is a cold boot reading the
      same disk back) and was confirmed to FAIL against the pre-fix code and
      PASS against the fix. All 19 suites + ES2018 gate green.
- [x] Look for other possible improvements in code and UI for the app, and
      keep checking/fixing until the app is very stable. Delegated a
      research-only audit of app/assets/*.js and app.css (a subagent, so it
      would read the whole codebase without bloating this session's own
      context), then verified and fixed its highest-confidence findings —
      each with its own committed regression test, confirmed to fail
      pre-fix and pass post-fix, same rigor as the tab bug above:
      - **Duplicate paid Claude calls.** The Wire tab's "Ask Claude about the
        wire" button and the Rosters tab's "How your team stacks up"
        Ask-Claude button only ever disabled THEMSELVES inside their own
        click handler, unlike every sibling ask/refresh button in the file
        (news-sync, player-db refresh) which also checks `jobRunning()` when
        REBUILT. Switching tabs away and back while either 5-minute Claude
        call was still in flight rebuilt the card with a fresh, enabled
        button — a second tap fired a second concurrent paid API call, and
        whichever response landed last silently overwrote the cache. Fixed
        with the same `jobRunning('waivers')`/`jobRunning('teamanalysis')`
        guard the other buttons already use. Test: `tools/test_jobguard.js`.
      - **Redundant projection computation.** `value.js`'s `upgrades()` and
        `waiverContext()` each ran `Recommend.projectAll()` twice per call —
        once directly, once again inside `myStarters()` → `bestLineup()` —
        even though `needs()` already avoided this via an optional
        `starters` param. Threaded an optional `allProj` through
        `bestLineup()`/`myStarters()` the same way, so a free-agent-board
        render or a position-filter click no longer triples the roster-wide
        projection pass. (No dedicated test — this is a pure performance
        fix with no behavior change, verified by the existing suites still
        passing with identical output.)
      - **doSync() week-capture race.** `doSync` read the shared
        module-level `week` variable throughout its whole async chain
        (fetch, `Store.getStats`/`setBook`, `S.weekMeta` writes,
        `autoFillWeek`, the completion toast) instead of snapshotting it
        once at entry. `week` can be mutated mid-flight by the NFL-week
        auto-advance or by tapping the week-next arrow while a sync is
        running — neither checks the `busy` flag. A sync that started for
        week N could finish after `week` moved to N+1 and file its results
        under the WRONG week, silently corrupting that week's stats. Fixed
        by capturing `syncedWeek = week` once at the top and using it for
        every "week this sync is for" reference. Test:
        `tools/test_synccapture.js` (stalls the fetch, advances the week
        mid-flight via the real button, confirms results land under the
        week that was actually fetched).
      All 20 suites + ES2018 gate green throughout. **Surfaced but
      deliberately NOT changed:** `app/assets/sim.js`'s `season()`/
      `power()`/`allPlay()`/`bracket()` are fully implemented and covered by
      three test files, but never called from any production tab — looks
      like orphaned surface from a feature never wired in, or removed on a
      divergent branch (see this file's own "Branches" story in CLAUDE.md).
      **Ask Tj whether to wire it into a tab (playoff odds / power
      rankings?) or delete it** — a product decision, not something to
      guess at.

## Prior job, complete

The one before that (2026-09-18: "it
always recommends qb switch from the QBs I already have, Stafford and bo
nix... Only recommend a replacement qb if it is truly a season edge over
the high completion QBs I already have. Focus waiver wire more on my
roster weaknesses, usually rb and wr" — plus making the Claude-app handoff
follow the same rules, a careful look at the Wire-tab tab-highlight
glitch, and a general efficiency/stability pass) is complete, shipped as
v7.4, and archived at LADDER.md §41. Root cause: `Value.upgrades()` held
every position to the same flat "1 more point per game" margin, which is
noise at QB's scale in a league that pays a full point per completion (a
good QB already outscores a good RB/WR 3-4x/game here), and let ESPN's
generic season model alone qualify a free agent with zero real measured
games. Fixed with `QB_MIN_GAIN=6` + `QB_MIN_MEASURED=3` (exported so
`ai.js`'s Claude-suggestion path holds itself to the identical bar,
belt-and-suspenders alongside a shared prompt paragraph,
`Ai.qbSkepticismText()`, read by both the live-API and offline-handoff
paths). K/DEF now gated on `kdefNeedFrom()` on the same deterministic
board the Claude path already gated. Web research independently confirmed
the direction (point-per-completion analysis names Stafford by name as
the archetype QB this scoring favors). Full write-up, including the
tab-highlight investigation's honest "no fix landed, here is exactly what
was checked and why" conclusion, and the 8 new regression cases, in
LADDER.md §41 and STATE.md's 2026-09-18 entry. **Tell Tj plainly if he
sees a QB swap suggested again after v7.4, or if the tab-highlight glitch
recurs** — either would be new diagnostic information (see "Waiting on
Tj" below for exactly what to ask about the tab glitch), not a repeat of
what v7.4 addressed.

## Prior job, complete

The one before that (2026-09-17c: "When I
imported it back into Claude it gave nonsense answers" — a screenshot
showing the team-analysis card displaying its own literal unfilled
template, "Rank 1 of 10. `<a few honest sentences...>`") is complete,
shipped as v7.3, and archived at LADDER.md §40. Root cause, confirmed by
reproducing it first: `Ai.parseAnswer` takes the widest valid JSON object
in whatever text it is given, and every handoff export ALSO contains a
JSON object in the reply's own shape (the worked skeleton under "## The
file to give back") — so feeding the file exported FOR Claude back into
the app, instead of what Claude actually sent, parsed cleanly and got
silently imported as real. Predates the team-analysis feature — the
identical thing reproduced on the older waiver handoff too. Fixed with one
shared guard in `Handoff.importReply()`: `findPlaceholder()` refuses any
reply still holding the literal `<...>` placeholder text every skeleton
uses. Full write-up and the 5 new regression cases in LADDER.md §40.
**Tell Tj plainly if he sees this again after v7.3** — that would mean a
different, still-undiscovered gap, not a repeat of the exact bug already
fixed.

The job before that (2026-09-17b: "ask
Claude its overall take on my team versus every other team in the league
and recommendations on how to improve my team", via the same export/
import Claude-app round trip the Advice and Wire tabs already use) is
complete, shipped as v7.2, and archived at LADDER.md §39. New file
`teamreport.js` composes `Store.standings` + every team's roster (priced
via `Value.perGame`, flagged via `Recommend.health`) + my own
`Value.waiverContext` fields into one cross-league context — no new
scoring math anywhere. Lives on the Rosters tab as "How your team stacks
up", between the roster he opens the tab to see and the trade evaluator
kept at the bottom. The live-API path (`Ai.askTeamAnalysis`) deliberately
sends no web search — every fact in the prompt is already fresh from the
app's own feeds, so the value Claude adds is judgment, not research.
Caught and fixed a real bug before it shipped: team-name matching was
running through `Names.canon()` (built for player names, folds a bare
"jr"/"sr"/"ii" token to nothing), which collided a real team named "JR"
with "no team given" — every recommendation with no trade partner would
have silently shown as coming from team JR. Full write-up in LADDER.md
§39, narrative detail in STATE.md's 2026-09-17b entry. **Tell Tj plainly if
he reports a recommendation crediting the wrong team, or naming a player
who is not actually in this league and not flagged "unverified"** — either
would mean a real gap this session's testing missed, not a repeat of the
bug already fixed.

## Prior job, complete

The one before that (2026-09-17: Tj
reported the Wire tab still recommending Nick Chubb/Trey Benson/Kareem Hunt
— all zero week-1 stats — even after v6.9's supposed fix) is complete,
shipped as v7.0, and archived at LADDER.md §38. Live ESPN checks that
session confirmed Chubb and Hunt were genuinely on zero of the 32 current
NFL rosters, and found two real, independent bugs in the actual v6.9 code
(not a data problem): `value.js`'s free-agent-board memo never noticed
`PlayerDB` or the injury feed refreshing in the background, so it kept
replaying its first, stale render for the rest of the session; and
`playerdb.js`'s prune of off-every-roster players required a flawless 32/32
team-fetch sweep, so one flaky team blocked every removal indefinitely.
Also fixed the ranking question Tj asked directly: a zero-signal ESPN
week-line guess could outrank a player with real measured production
purely because the guess printed a bigger number — real signal now always
sorts first. Full write-up, including the exact fixes and the 4 new tests
proving them, in LADDER.md §38. **Tell Tj plainly if he reports the same
symptom again after v7.0** — that would mean a THIRD, still-undiscovered
gap, not a repeat of either bug just fixed.

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
