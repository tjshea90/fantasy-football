# CHECKPOINT 281 — read me first, then TASKS.md

**Written:** 2026-09-15T08:13:50Z · **version:** 6.3 · **tests:** all 14 suites green

## Just done
Sweep round 3 (UI/feature correctness): fixed four real bugs. (1) claudeAdviceEstimate showed a non-zero dollar cost even when syncAll would skip the Claude call entirely (nothing to research) -- fixed to return $0. (2) The Advice tab never wired the long-press View stats feature at all, contradicting Tj's original explicit request that it work everywhere in the app -- fixed by threading markPlayer through viewAdvice's ctx and marking all three row sets recommend.js builds (starters, bench, opponent roster). (3) showPlayer's stat modal showed a stale, wrong point total after Save adjustment -- the toast and the page behind it updated but the modal's own visible breakdown never did; fixed by building the pre element directly (not through the generic modal() wrapper) so the save handler can rewrite it in place, verified live in a real browser (19.0 -> 24.0 points shown correctly after a +5 adjustment, no reload/close needed). (4) stats.js's team browser read the real current NFL week as its ceiling instead of the header's selected week (ctx.week), the same bug class Top Players was already fixed for once -- fixed teamPickerCard/teamRosterCard, deliberately left player-search's own currentWeek read alone since that mode has a genuinely different 'show everything so far' semantic. All verified with real tests (a live browser interaction for the modal fix, source-text pins matching this repo's established idiom for the others) plus a full live-browser sweep across every tab with zero new console errors. All 13 suites + ES2018 gate green.

## Do this next
Continue the priority list: Android hardening next (alertsTest() synchronous network call freezing the JS thread for up to 13s -- the exact bug class the whole async-bridge architecture exists to prevent; 6 file-descriptor leaks on I/O exception; NativeBridge's thread pool never shut down; dead legacy HTTP methods as unnecessary attack surface; verify whether the back-button OnBackInvokedCallback registration-failure fallback claim actually holds), then cost/model accuracy (usage.js pricing is model-blind; prompt caching silently never engages since both cached prefixes are under the model's cache floor; outdated web_search tool type), then a batch of smaller verified fixes, then flag (write up, do not implement unasked) the Data tab card-wall UI issue and the fully-dead recap.js feature for Tj's decision.

## How to resume, exactly
Open this GitHub repo in a Claude Code session on ANY of the three
accounts and say "continue". The SessionStart hook runs tools/resume.sh,
which pulls the latest and prints this file automatically — nothing has
to be attached, uploaded or explained. If that briefing did not appear,
run it by hand:
```bash
bash tools/resume.sh       # pull + this file + TASKS.md + the rules
```
Then continue from **Do this next** above. Do not re-plan, do not re-read
finished work, do not ask Tj to re-explain anything — `TASKS.md` carries his
request in his own words and `git log` carries every step already taken.

## Uncommitted right now
     M CHECKPOINT.md

## Last ten checkpoints
```
  669bdca ckpt 264: Sweep round 2 (value.js correctness): fixed two real bugs. (1) Store.bookTrend
  94534c3 ckpt 252: Sweep round 1 (data integrity, highest stakes): fixed two real bugs found by t
  ae43731 ckpt 236: UI sweep finding #2 (Stats tab): the Pts column was the LAST column in the gam
  24a73a3 ckpt 230: UI sweep finding #1 (Live tab): player names were truncating mid-word in the t
  1827e5c ckpt 226: Wrote Tj's comprehensive app-wide improvement request to TASKS.md (2026-09-15e
  882ace6 ckpt 223: Shipped v6.3, triggered and verified the GitHub Release (non-empty asset, corr
  f21a19e ship v6.3: Real back-button fix: registered the platform OnBackInvokedCallback (API 33+)
  b518033 ckpt 218: Fixed the real back-button regression: registered android.window.OnBackInvoked
  ab24515 ckpt 208: Wrote Tj's real-device bug report to TASKS.md (2026-09-15d): back button still
  50c304f ckpt 205: Archived the finished 2026-09-15c job to LADDER.md §30, reset TASKS.md to 'no
```

(16 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
