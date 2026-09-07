# RESUME CARD — read this first, it is 40 lines and it is enough

**What this is.** A season-long fantasy tracker Android app for Tj's 10-team
league. The draft is over; the old draft board is a different, retired project.

**How to resume, exactly:**
```bash
mkdir -p /home/claude/tr && cd /home/claude/tr \
  && unzip -o <the zip Tj attached> -d /home/claude/tr/ > /dev/null \
  && bash bootstrap.sh
```
Then continue from the first unticked line in `LADDER.md`. Do not re-plan. Do
not re-read files that finished steps produced. Do not ask Tj to re-explain the
league — `RULES_2026.md` and `SPEC.md` have all of it.

**NEVER trust a build that printed an error.** v2.7-v2.9 shipped APKs with
half their classes because build.sh threw away javac's exit status. Both
build.sh and ship.sh now refuse; do not weaken either guard.

**Build the APK:** `bash build.sh` (first run downloads the SDK, ~5 min; after
that, seconds). Output `build/app-release.apk`.

**Versions are plain numbers.** `VERSION` holds `1.8`. It is the only place a
version lives: `build.sh` stamps it into the APK and into
`app/assets/version.js`, and `ship.sh` names the zip `FFTracker_v1.8.zip`,
auto-bumping to 1.9 / 2.0 if that name is taken. Do not hard-code one anywhere.

**Checkpoint:** `bash ship.sh "what changed"` — after EVERY finished step, not
just at end of session. It refuses to build a stale zip.

**What already works** (do not rebuild these):
- `app/assets/scoring.js` — the league scoring engine. 33/33 tests pass
  (`node tools/test_scoring.js`). Completion bonus, distance-tiered FGs made
  AND missed, the points-allowed ladder, the three weekly longest-play bonuses.
- `app/assets/espn.js` — ESPN box-score parser, label-driven.
- `app/assets/store.js` — model, persistence, rosters, lineups, matchups,
  standings, export/import.
- `app/assets/ui.js` — Live, Lineups, Rosters, Standings, Advice, Data screens.
- `app/assets/recommend.js` — lineup advice. Four sources, all converted into
  league points before blending; anyone on bye/OUT/suspended is EXCLUDED.
- `app/assets/projections.js` — ESPN's projected stat lines re-scored under
  this league's rules. The stat line is the useful part; nobody else's
  "projected points" means anything here (a completion is 1 point).
- `app/assets/ai.js` — optional Claude reasoning over live news. Needs an API
  key pasted on the Data tab; skipped cleanly without one.
- `android/` + `build.sh` — signed universal APK, minSdk 29 / targetSdk 36,
  **zero native libs** so one file covers armv7 Android 10 and arm64 Android 16.

**What still needs Tj's phone (v1.8).** `espn.js` itself was verified live on
2026-09-01. Two NEW network paths have not been:
1. **Data → Test the projection feed.** Reports which of three filter shapes
   ESPN accepted and shows sample QB conversions. A QB should land near 40-55
   under this scoring; 15-25 means the re-scoring is not running.
2. **Data → Test the key** (only if he wants Claude). Two-token round trip, so
   a bad key is never mistaken for a bad prompt.
Ask him to run both and paste the output. Everything deterministic is covered
by `node tools/test_engine.js` (25 behavioural assertions) and
`node tools/test_boot.js`.

**Usage discipline.** Tj is near his cap. One large correct write beats five
exploratory ones. Never dump a source file into the reply. Never re-verify a
ticked step.
