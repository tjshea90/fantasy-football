# CHECKPOINT 78 — read me first, then TASKS.md

**Written:** 2026-09-18T07:39:28Z · **version:** 7.4 · **tests:** all 18 suites green

## Just done
Shipped v7.4: QB waiver-swap threshold fix (QB_MIN_GAIN=6, QB_MIN_MEASURED=3, shared with the Claude-suggestion path), K/DEF gated on kdefNeedFrom() in the deterministic board, shared QB-skepticism prompt text in both the live-API and offline-handoff Claude paths, 'thinnest starting spots' surfaced on the Wire tab, waiverContext() redundancy fix, 8 new regression tests, web-research validation. Tab-highlight glitch investigated end to end and documented honestly (no fix landed — no reproducible defect found, every previously-fixed cause confirmed still fixed/tested). GitHub Release v7.4 published and verified (FFTracker-v7.4.apk, 288987 bytes). TASKS.md/STATE.md/LADDER.md all archived and reset.

## Do this next
Nothing in flight. Send Tj the v7.4 release link.

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
  6a50a4e ship v7.4: waiver-wire QB season-edge fix (Stafford/Bo Nix no longer swapped for a margi
  87ff104 ckpt 69: 1f/tests done: web research confirmed the QB-skepticism direction (footballguys
  f8e561f ckpt 67: 1b/1c/1e done: QB waiver swaps now need a season-defining edge (6+ pts/gm, 3+ r
  db1b963 ckpt 53: Wrote the 2026-09-18 request into TASKS.md verbatim (waiver-wire QB/RB-WR smart
  23dc5d1 ckpt 123: v7.3 shipped and verified: GitHub Release published (non-empty assets array, F
  f49cf4c ship v7.3: Fixed a bug in all three Claude-handoff features (advice/waivers/team-analysi
  8ba6db4 ckpt 119: Archived the unfilled-template bugfix to LADDER.md §40, added the STATE.md na
  0884569 ckpt 114: Wrote Tj's bug report ('gave nonsense answers', the unfilled-template screensh
  86a0848 ckpt 112: Fixed the bug Tj reported from the v7.2 screenshot: the team-analysis screen s
  367138e ckpt 107: Closed out the 2026-09-17b job: archived the team-analysis feature to LADDER.m
```

(2 automatic checkpoint(s) since the last deliberate one — the
session was still mid-step. `git diff` against it shows what changed.)
