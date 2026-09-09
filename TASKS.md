# TASKS — the 2026-09-09 request, in Tj's words

> "a defense touchdown is only scored one time. individual player doesn't
>  matter. fix all the criticals and whatever else you found in your report.
>  make it so I can gesture swipe left and right to the different tabs in
>  addition to the bottom tab buttons. and also a gesture to pull down to
>  refresh anywhere in the app. then look for more bugs and improvements. make
>  sure any changes don't break anything else in the app"

Ticking a box means: written, tested, committed, and the test that proves it is
named in the box. **Never tick a box you have not verified.**

## 1. The rule he settled
- [x] 1a. A defensive/return TD scores ONCE, to the D/ST. `individualReturnTD`
      removed (it double-paid when on, and the memo ignored it either way).
      RULES_2026.md updated from "ambiguity" to stated fact.
      → `tools/test_locks.js` §3

## 2. The criticals from the audit
- [x] 2a. Auto-fill benched players who had already played. Kickoff locks, both
      directions, with the manual override kept. → `test_locks.js` §1
- [x] 2b. Claude's verdicts discarded for 15 of 170 players (canon vs normName).
      Fixed in all four places the same defect lived. → `test_locks.js` §2

## 3. Everything else in the report
- [x] 3a. Injury feed lookup folds nicknames. → `test_locks.js` §2
- [x] 3b. Projections.find folds nicknames; ESPN/Sleeper merge on identity.
- [x] 3c. API key redacted from the exported backup. → `test_locks.js` §4
- [x] 3d. A failed save is reported as failed. → `test_locks.js` §4
- [x] 3e. book + stats split out: 1924 KB → 25 KB per lineup edit. → §4
- [x] 3f. Daily alarm with a horizon; names only the actionable players. → §5
- [x] 3g. Back button closes a dialog, then returns to Live, then exits.
- [x] 3h. Locale.US in Java's normaliser; one shared bye rule; win-percentage
      standings; week cap 17; offline backoff; 44px targets; focus ring;
      escaped error paths; file:// privileges off; font scale honoured;
      httpForget tombstone; seed.json out of the APK.

## 4. The two gestures
- [x] 4a. Swipe left/right between tabs. → `tools/test_gestures.js`
- [x] 4b. Pull down to refresh, anywhere. → `tools/test_gestures.js`

## 5. "make sure any changes don't break anything else"
- [x] 5a. 13 suites green, ES2018 clean, APK builds with all 25 classes.
- [x] 5b. `test_lifecycle.js` now RENDERS ALL SEVEN TABS — nothing had ever
      executed a view function, which is most of ui.js. Verified non-vacuous by
      breaking a screen on purpose and watching it go red.
- [x] 5c. Three source-grep assertions that broke on refactors, while the
      behaviour they described was still true, rewritten to test relationships.

## 6. Listed, not built — needs his say-so
- [x] 6a. See the end of RELEASE_NOTES.md. Three candidates, none started.
