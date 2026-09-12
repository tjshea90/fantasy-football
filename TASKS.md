# TASKS — the current job, in Tj's words

**There is no active job right now.** All of today's requests (nav-refactor,
branch-reconciliation, Data-tab bug fixes, repo cleanup) are complete and
archived at the end of `LADDER.md` (§19-22). `main` is fast-forwarded and
current as of this job. Shipped as v5.4 (versionCode 504; not yet through
`ship.sh`'s full release gate). One item from §22 is blocked on access, not
on any Claude session's work — see "Waiting on Tj" below.

## When Tj asks for something new

Write it HERE FIRST, in his own words, as unticked boxes — before writing any
code. Until it is on disk the job exists only in a chat window that no other
Claude account can see, and a usage cap landing before the first checkpoint
loses not just the work but the knowledge of what was asked.

```
# TASKS — the <date> request, in Tj's words

> "<paste what he actually said, verbatim>"

- [ ] 1a. <first step>
- [ ] 1b. <second step>
```

Ticking a box means: written, tested, committed, and the test that proves it is
named in the box. **Never tick a box you have not verified** — the next account
will not re-check it.

When a job is finished, move it to `LADDER.md` and reset this file. This file
is printed into every session briefing, so a finished job left here is re-read
at cost on every cold start, forever.

## Waiting on Tj

- [ ] **Delete 3 stale branches himself** (no Claude Code session in this
      project has had the GitHub access to delete a branch — checked twice,
      confirmed a real permission boundary, not a bug to retry): open
      https://github.com/tjshea90/fantasy-football/branches and delete
      `android-app-nav-ui-refactor-os6q53`, `resume-logic-claude-code-2ye25r`,
      `live-tab-dual-scores-h2nxyf`. Their work is either superseded or
      already merged into `main` — safe to delete. **If a future session
      turns out to have branch-delete access, just do it and tick this.**
- [ ] Confirm v5.4 on the phone: real game count on the Data tab, each
      weekly-score row reads "Team name [box]" clearly, and a typed score
      actually updates the standings table under it.
- [ ] Clarify what "stale... inputs" meant in the 2026-09-12d request, if it
      was more than the branches — nothing was deleted on that guess.
- [ ] Verify v4.7-era item: **Data > Test the projection feed** (a QB should
      land near 40-55 under this scoring; 15-25 means the re-scoring is not
      running), and **Data > Test the key** if he wants Claude's reads.
