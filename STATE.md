# STATE — FF Season Tracker

**Last updated: 2026-09-07** · ladder 0-14 COMPLETE · **v4.2** · APK builds, signed, all 5 test suites green

## WHERE I LEFT OFF — read this, then LADDER.md, then start
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
