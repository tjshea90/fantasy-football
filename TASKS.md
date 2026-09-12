# TASKS — the 2026-09-12d request (score-entry still broken + repo cleanup),
in Tj's words

> "Look at the attached screenshot. The data tab still shows empty boxes with
> no team names for me to enter scores. I want a small box next to each team
> name where I can enter that team's score each week and it saves the data
> for calculating other things in the app like wins and losses and total
> points weekly and all time. When you are done making this delete all the
> stale branches and inputs and make sure that all future builds update from
> the latest version linearly and don't make separate branches"

His v5.3 screenshot showed the SAME two symptoms as before: "[object Object]
games" still on screen, and the weekly-scores boxes still with no visible
team name beside them — even though v5.3 already tried to fix both. Root
cause on each, found before writing this:

- **The `[object Object]` fix was a write-side fix only.** v5.3 stopped
  `schedule.js` from writing an object into `weekMeta[week].games` going
  forward, but did nothing to repair a value ALREADY on Tj's phone from
  before v5.3 was installed — app-private storage survives an update, so the
  poisoned value from an old version is still sitting there until something
  overwrites it with a real count again. Needs a one-time migration in
  `Store.init()`, not just a stopped leak.
- **The team names were never a paragraph/placeholder problem — that was
  the wrong diagnosis last time.** The real bug is CSS specificity:
  `select,input[type=text],input[type=number]{width:100%...}` (app.css) has
  specificity (0,1,1) — one attribute selector plus the `input` type itself
  — while `.scoreInput{width:76px...}` is only (0,1,0). The higher-specificity
  rule wins regardless of source order, so `.scoreInput`'s 76px never
  actually applied: the input renders at `width:100%`, fills the whole row,
  and squeezes the flex:1 team-name div to nothing. Needs the input rule
  raised to matching specificity (`input.scoreInput`), not another look at
  the JS structure, which was already correct.

- [ ] 1. Fix `[object Object]` for real: migrate any already-corrupted
      `weekMeta[week].games` (non-number) in `Store.init()` — rescue the
      per-team map into `.kickoffs` if that key isn't already set, then clear
      `.games` so the display recovers cleanly until the next real sync.
- [ ] 2. Fix the invisible team names for real: `input.scoreInput{...}` in
      app.css so it wins the specificity fight against the base
      `input[type=number]{width:100%}` rule.
- [ ] 3. Re-verify (screenshot-equivalent: real executed tests, not source
      grep) that both are actually fixed, not just plausible.
- [ ] 4. Confirm the manual-score data layer (already built, ckpt 104) is
      sound end to end now that the UI to reach it will finally work: typing
      a score saves it, and it drives wins/losses and season-total points —
      this was tested at the Store level already; no new data-layer work
      expected, just confirming nothing else is broken.
- [ ] 5. Now that this ships: fast-forward `main` to this branch (Tj
      confirmed — "when you are done making this delete all the stale
      branches") and delete the 3 stale sibling branches
      (`android-app-nav-ui-refactor-os6q53`, `resume-logic-claude-code-
      2ye25r`, `live-tab-dual-scores-h2nxyf`).
- [ ] 6. "Make sure all future builds update from the latest version linearly
      and don't make separate branches" — be honest about what a repo change
      can and cannot guarantee here: which branch a NEW Claude Code session
      lands on is decided by the platform when the session is created (see
      CLAUDE.md's own note that Claude Code on the web has been landing each
      session on its own auto-generated branch, which is the root cause of
      the whole branch-fragmentation mess from earlier today), not by
      anything committed to this repo — a session cannot bind a future
      session's branch from inside itself. What IS in scope: leave `main`
      current (task 5) and add a clear instruction to CLAUDE.md/BRIEF.md that
      any session finding itself on a fresh branch should check `main` first
      and fast-forward/merge back before finishing, so drift like this
      degrades gracefully next time instead of silently compounding.
      Tj should also know: starting a new session from claude.ai/code
      against this exact conversation (not a fresh one) is the surest way to
      stay on one line.
- [ ] 7. Regarding "delete all the stale branches and inputs" — "inputs" is
      ambiguous (no evidence any manual score was actually saved yet, since
      the entry boxes have been unusable through v5.2 and v5.3). NOT
      deleting any season data on a guess; flagging this to Tj rather than
      guessing at a destructive action on real data.

Ticking a box means: written, tested, committed, and the test that proves it is
named in the box. **Never tick a box you have not verified** — the next account
will not re-check it.

## Waiting on Tj

- [ ] Confirm the fixed Data tab: real game count, and each row reads
      "Team name [box]" clearly.
- [ ] Clarify what "stale... inputs" meant, if it was more than the branches.
- [ ] Verify v4.7-era item: **Data > Test the projection feed** (a QB should
      land near 40-55 under this scoring; 15-25 means the re-scoring is not
      running), and **Data > Test the key** if he wants Claude's reads.
