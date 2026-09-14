# TASKS — the 2026-09-14b request, in Tj's words

> "After refreshing the waiver wire section, it shows stale news about
> preseason NFL. See the screenshot attached. This information is stale.
> Diagnose this. And confirm that if I do a make the file for Claude app
> prompt about the wire that it follows the new criteria that you updated
> for v5.5"

His screenshot: the new "Your roster — injuries" card on the Wire tab, week
1, showing D'Andre Swift/Wan'Dale Robinson/Tyrone Tracy Jr. with QUESTIONABLE
tags and notes that read like preseason camp-battle text, one of them cut off
mid-word ("...Even still, Swift wil").

## Diagnosis (confirmed, before writing any fix)

The injury feed (`newsCache` in recommend.js) loads from a PERSISTED disk
cache on every app boot (`ui.js` `boot()` calls `Recommend.loadCaches()`
unconditionally, line ~512) — so the card is not broken, it is honestly
showing what is actually cached. The problem: **nothing on the Wire tab ever
refreshes that cache.** Only `Recommend.syncAll()` (the Advice tab's "Sync
advice" button) calls `loadNews()` to fetch a live ESPN injury feed. Tj
apparently has not pressed that recently, so the Wire tab is showing
injury notes possibly a week or more old — old enough that the mid-word cut
("...Swift wil") matches the exact 220-character-truncation bug fixed
pre-v5.5 (see recommend.js's `trimNote` history): that string was very
likely written to disk BEFORE that fix shipped and has sat there untouched
ever since, because nothing has re-synced it.

Two real gaps, both mine from the v5.5 work:
1. The new roster-injuries card shows NO freshness indicator at all (every
   other cache-backed section in the app — the Advice tab's "Injury feed:
   N records, Xh ago", the Claude wire-read's "Read Xh ago" — does), so
   stale data is presented as if current.
2. Neither the deterministic card nor "Ask Claude about the wire" can
   refresh the injury feed themselves — you have to know to go to the
   Advice tab first. Worse: a live Claude waiver call is currently reasoning
   from whatever stale ESPN designations happen to be cached, which
   undermines the v5.5 "freshness discipline" instruction — that only
   covers what Claude searches for, not the facts the app hands it as
   settled.

- [x] 1. Exported `Recommend.newsCache()` (same pattern as the existing
      `aiCache` getter). Test: `test_boot.js` greps for the exact export.
- [x] 2. "Your roster — injuries" card now shows "Injury feed: N records, Xh
      ago" (or "not synced yet") and its own "Sync injury feed" button
      (`Recommend.loadNews(.., {force:true})`, no API key needed — the ESPN
      endpoint takes none). Also moved the injury note out of the row's own
      nowrap `<small>` into a sibling `.kv` line — rendering it with the real
      app.css via headless Chromium showed THAT (not a network issue) is what
      produced the garbled, mid-word-cut text in his screenshot: a long text
      run sharing a nowrap flex line with an inline-block tag span wraps
      instead of ellipsizing in this WebView. Test: `test_boot.js` (source +
      the render was independently verified with a real headless-Chromium
      screenshot, before and after, not just asserted).
- [x] 3. "Ask Claude about the wire" now force-refreshes the injury feed
      before building the context Claude reasons over, with the same
      swallow-and-continue resilience `syncAll()` already uses for the Advice
      tab. Test: `test_boot.js` proves the refresh happens BEFORE
      `Value.waiverContext` in source order, and that it passes `force:true`.
- [x] 4. Generated a real `Handoff.buildWaivers()` sample off the seed
      roster and grepped it: "Kicker / defense — do I actually need one?",
      "Drop candidates", the freshness "Use only news dated this week"
      language, and the full `priority`/`recentStat`/`dropCandidate`/
      `injuries` JSON contract with rules and a worked example are all
      present. Sent the file to Tj directly.
- [ ] 5. Full 13-suite regression + ES2018 gate green (done). `build.sh` and
      `ship.sh` still to run.

Ticking a box means: written, tested, committed, and the test that proves it
is named in the box. **Never tick a box you have not verified.**
