# CHECKPOINT 264 — read me first, then TASKS.md

**Written:** 2026-09-15T08:03:19Z · **version:** 6.3 · **tests:** all 14 suites green

## Just done
Sweep round 2 (value.js correctness): fixed two real bugs. (1) Store.bookTrend() required an exact ESPN-spelling key match; all three real callers (value.js's perGame/usage -- the whole Wire-tab free-agent board and usage trend -- and recommend.js's usageSwing) passed a plain-normalized name, silently losing a player's real recent production whenever his roster/DB spelling differed from ESPN's box-score spelling (e.g. Kenny vs Kenneth Gainwell). Fixed at the one shared function via Names.hit's tolerant lookup, the same pattern Projections.find already used -- fixes all 3 call sites and any future one at once. (2) Value.needs() hardcoded every FLEX starter's replacement-level comparison to RB regardless of who was actually starting there, so a WR or TE in flex (the common case) had his 'how thin is this position' gap measured wrong -- this feeds directly into the needs line sent to Claude for waiver prioritization. Fixed by threading the real player position through myStarters() and using it in needs(), for both the replacement lookup and the output label Claude reads. Both verified with real executable tests against the actual data layer (not just source pins) -- the bookTrend fix with a real spelling-mismatch scenario, the needs() fix by stubbing Recommend.bestLineup to force a WR into flex and confirming the reported position and gap are now correct. All 13 suites + ES2018 gate green.

## Do this next
Continue the priority list: UI/feature correctness bugs next (Advice tab missing long-press entirely -- contradicts Tj's original explicit request; claudeAdviceEstimate showing cost for what would be a free sync; stats.js team-picker repeating the already-fixed week-desync bug class; showPlayer's stale-total-after-save modal), then Android hardening (alertsTest() sync network call, 6 FD leaks, pool shutdown, dead legacy HTTP methods), then cost/model accuracy (usage.js model-blind pricing, prompt caching under the model floor, outdated web_search tool type), then a batch of smaller fixes, then flag the Data tab card-wall and dead recap.js feature for Tj rather than implementing unasked.

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
  94534c3 ckpt 252: Sweep round 1 (data integrity, highest stakes): fixed two real bugs found by t
  ae43731 ckpt 236: UI sweep finding #2 (Stats tab): the Pts column was the LAST column in the gam
  24a73a3 ckpt 230: UI sweep finding #1 (Live tab): player names were truncating mid-word in the t
  1827e5c ckpt 226: Wrote Tj's comprehensive app-wide improvement request to TASKS.md (2026-09-15e
  882ace6 ckpt 223: Shipped v6.3, triggered and verified the GitHub Release (non-empty asset, corr
  f21a19e ship v6.3: Real back-button fix: registered the platform OnBackInvokedCallback (API 33+)
  b518033 ckpt 218: Fixed the real back-button regression: registered android.window.OnBackInvoked
  ab24515 ckpt 208: Wrote Tj's real-device bug report to TASKS.md (2026-09-15d): back button still
  50c304f ckpt 205: Archived the finished 2026-09-15c job to LADDER.md §30, reset TASKS.md to 'no
  82284ab ship v6.2: Rosters reorder, Android back-button/app-resume/splash-flash fixes, live Clau
```

(11 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
