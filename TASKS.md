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

- [x] 1. Export a minimal freshness getter from recommend.js (same pattern as
      the existing `aiCache` getter) so ui.js can read the injury feed's
      age/count/error without reaching into a private variable.
- [x] 2. "Your roster — injuries" card: show a freshness line, and add its
      own "Sync injury feed" button (`Recommend.loadNews` with `force`) that
      works with NO API key, since it is only the ESPN endpoint.
- [x] 3. "Ask Claude about the wire": refresh the injury feed first (forced),
      same as `syncAll` already does for the Advice tab, before building the
      context Claude reasons over — a paid call must not reason from stale
      "settled fact" ESPN designations.
- [x] 4. Confirm the Claude-app handoff file (`Handoff.buildWaivers`, the
      "no API key, no cost" button) carries every v5.5 addition — generate a
      real sample and show him the new sections directly, not just point at
      passing tests.
- [x] 5. Test, full regression, build, ship.

Ticking a box means: written, tested, committed, and the test that proves it
is named in the box. **Never tick a box you have not verified.**
