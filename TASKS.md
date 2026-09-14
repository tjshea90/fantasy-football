# TASKS — the 2026-09-14c request, in Tj's words

> "Tell me if the attached screenshot error is a big deal. If it is, fix it.
> Also I no longer have a Claude api key. Is there a way to automate using
> Claude reasoning in the fantasy app without doing the export and import to
> the Claude chat? For example, is there an api key for my regular Claude pro
> subscription that I already have that is separate from buying a dedicated
> key? Is there any other way I can use Claude inside the app without api
> key"

His screenshot: Data tab, "Test the projection feed" output, showing
`limit only: FAILED — HTTP 400 {"messages":["Filter: Limit request must be
accompanied by a sort"]...}` among the routes tried, but "best route: week
filter + sleeper current (209 gaps filled, 177 second opinions)" with all
477 indexed players getting a week-1 line, and healthy QB numbers
(Mahomes 40.7, Nix 43.7, Rodgers 38.2 — squarely in the 40-55 range that
means the re-scoring is actually running, per the v4.7-era verification item
already sitting in "Waiting on Tj").

## Part 1 — the screenshot error

**Verdict: not a big deal for his data** (full coverage was reached anyway,
QB numbers are healthy) **but a real, permanently-broken fallback route**
worth a one-line fix, confirmed by reading `projections.js` rather than
guessing:

- `filters()` tries four ESPN request shapes in order (week filter, full
  filter, lean filter, limit only), stopping early only once one clears 300
  week lines (`GOOD_ENOUGH`). None of the first three currently clears that
  alone, so **all four run on every single sync** — this is not a one-off.
- `limit only`'s shape (`{ players: { limit: 500 } }`) has no `sort` field.
  ESPN's API now rejects a bare `limit` filter with no `sort` (HTTP 400) —
  the exact error in the screenshot. `lean filter`, one line above it, uses
  the identical `limit:500` plus `sortPercOwned:{...}` and works fine.
- Net effect: a fallback route that exists specifically for resilience is
  currently dead weight — it can never succeed as written, wastes one
  network round trip on every sync, and prints a scary-looking 400 in the
  diagnostic for something harmless. If the three routes ahead of it ever
  degrade on a bad day, this safety net would still fail right when it's
  needed.

- [x] 1a. Added the same `sortPercOwned` sort field `lean` already uses to
      the `tiny`/"limit only" filter shape in `projections.js`. Test: new
      `test_net.js` assertion greps for both `limit: 500` and `sortPercOwned`
      in that exact shape, naming the reported bug.
- [x] 1b. Full 13-suite regression + ES2018 gate green, `build.sh` clean.

## Part 2 — Claude Pro subscription vs. API key

Answered directly in chat (no code change): a claude.ai Pro subscription and
an Anthropic API key (console.anthropic.com) are separate products with
separate billing — Pro does not include API access, and there is no
consumer-login flow the app could use instead of a key. The existing
"Or use the Claude app — no API key, no cost" handoff (`handoff.js`) is
already the zero-cost path that uses his Pro subscription; the manual
export/import round trip is the actual mechanism, not a workaround for one —
there is no way to remove that round trip without either (a) a real,
separately-billed API key, or (b) Anthropic shipping a different mechanism
this app doesn't have access to today.

Ticking a box means: written, tested, committed, and the test that proves it
is named in the box. **Never tick a box you have not verified.**
