# TASKS — the current job, in Tj's words

**There is no active job right now.** The 2026-09-14 waiver-wire upgrade is
complete and archived at the end of `LADDER.md` (§23). Shipped as v5.5 via
`ship.sh` — full release gate (13 suites, ES2018, dex-completeness, manifest)
passed. See "Waiting on Tj" below for what needs a real phone to confirm.

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

- [ ] **Confirm the waiver-wire upgrade on the phone** (v5.5 — no Claude Code
      session can run the Android WebView, so this was verified by reading
      code and CSS, not by eye). On the Wire tab:
      - a "Your roster — injuries" card appears above the free-agent board,
        showing anyone hurt or on bye with no tap needed;
      - "Ask Claude about the wire" (needs the API key on the Data tab) now
        also researches those injuries' season outlook, and shows a
        SEASON/1-WEEK tag plus a "Last game" stat line on each recommended
        add when you tap "why ▾" — check that text is not cut off;
      - a K or DEF only shows up in Claude's ranked list when your own is
        actually on bye or out, and even then it's labelled low priority;
      - where a pickup comes with a fair same-position drop, there's an
        "Add + drop [name]" button next to the plain Add — tap it once on a
        real case and confirm both the add and the drop actually happened.
- [ ] Delete the 3 stale branches himself, if still not done — see LADDER.md
      §22e for names and why (this session, like every prior one, did not
      have branch-delete access — did not re-check, no reason to expect it
      changed).
- [ ] Verify v4.7-era item, if still relevant: **Data > Test the projection
      feed** (a QB should land near 40-55 under this scoring; 15-25 means the
      re-scoring is not running).
