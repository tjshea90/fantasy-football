# CHECKPOINT 143 — read me first, then TASKS.md

**Written:** 2026-09-15T03:43:13Z · **version:** 6.1 · **tests:** all 14 suites green

## Just done
items 1-4 of today's 8-part request. (1) Rosters tab: trade evaluator moved to the bottom, team roster card first. (2-4) Android lifecycle -- root-caused as one likely shared cause: this Activity has no android:configChanges gap (already covers rotation/uiMode/etc, checked AndroidManifest.xml) and no active code path finishes() or kills anything itself, so 'jumps back to Live' + 'splashes a logo' on resume is consistent with ordinary Android reclaiming a backgrounded single-Activity WebView process under memory pressure -- ui.js's boot() always defaulted view to 'live' with no memory of what was open before, so a forced cold relaunch (which looks identical to onResume from the JS side, but isn't) always looked like 'jumped to Live'. Fixed the concrete, verifiable half of that: goTab() now persists the current tab to S.settings.lastTab on every real tab change (cheap -- only fires on an actual change, same as every other settings write here), and boot() restores it before first render if valid. Left __onBack's own history-unwind logic untouched -- read it closely and it is already correct (this exact 'never close the app, background instead' design is thoroughly documented in MainActivity.java's own comments from v4.7) -- backgrounding when there is genuinely nothing behind the current tab in navHistory is the intended Android 'at the root' behavior, not a bug, and restoring the right tab on relaunch should make that read correctly for the common case Tj described. For the splash flash: WebView.setBackgroundColor() now matches @color/bg exactly (WebView paints white by default regardless of the Activity's own windowBackground until content has painted -- a real, documented quirk, separate from the app's own theme already being dark). Added android/res/values-v31/styles.xml overriding Android 12+'s own automatic per-launch splash screen (unavoidable OS behavior on API 31+, not an app opt-out) to use the app's real background color and an empty icon (android/res/drawable/splash_empty.xml) instead of the launcher logo. Build verified clean (aapt2 parses the new versioned resource dir correctly, 25/25 classes). Honest limitation: none of this can be verified against real Android process-death/OS-splash behavior from this sandbox -- no emulator, no real device -- both fixes are grounded in well-documented, specific Android platform mechanics (WebView's white-paint default; the API 31+ automatic splash; no onSaveInstanceState existed before to restore anything) rather than guesses, but only Tj's phone can confirm they actually close the gap he is seeing. All 14 suites + ES2018 gate green; build.sh produces a clean signed APK with the new resources.

## Do this next
item 5: replace Claude usage-remaining tracking with per-request cost estimates. Plan: extract the search-budget formulas already inline in ai.js's ask()/askWaivers() into named exported functions (adviceSearchBudget/waiverSearchBudget) so the real call and the new estimate can never disagree about how many searches a call would use; add Usage.estimate(promptChars, searches, outputTokens) computed from the SAME rates() table already used for real spend tracking; call it with REAL current inputs (Ai.buildPrompt(realCtx).length, Recommend.rosterContext()'s real triage count for advice; Ai.buildWaiverPrompt + Value.waiverContext for wire) at the two actual Ask-Claude buttons (recommend.js's Sync advice, ui.js's Ask Claude about the wire), shown regardless of Ai.configured() since the whole point is Tj no longer has a key and still wants to see what it WOULD cost. Then gut ui.js's usageCard() (Data tab) -- remove the budget input/meter/'X left of Y' entirely, keep the editable price-rate fields (still needed for the estimate math) and the factual call-history record, add a live estimated-cost section.

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
  c55702b ckpt 135: wrote Tj's new 8-part request (bug/UI sweep, Rosters reorder, Android back-but
  1de4930 ckpt 132: shipped v6.1 (both bug fixes), triggered and verified the GitHub Release (non-
  b98c220 ship v6.1: fix two bugs found on Tj's phone within minutes of v6.0: Top Players got stuc
  16c61b7 ckpt 127: fixed two real bugs Tj found on his phone within minutes of v6.0, both confirm
  dc92ac5 ckpt 120: shipped v6.0 (Stats tab + resume-system fix), triggered and verified the GitHu
  be33e59 ship v6.0: add a Stats tab: search any current NFL player (or team defense) and see this
  d0cfa77 ckpt 111: real-browser validation of the Stats tab + long-press, end to end, with REAL l
  1f64c89 ckpt 104: steps 2+4 of the stats-tab job: built stats.js (Stats.render(root,ctx), mirror
  11bddd6 ckpt 73: fixed the red left over from the last checkpoint: test_lifecycle.js keeps its o
  581837a ckpt 71: step 1 of the stats-tab job done: gamelog.js -- a self-contained (own Native.sa
```

(7 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
