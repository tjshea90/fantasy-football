# FF Tracker

Android fantasy football tracker. Built across multiple Claude Code sessions
and accounts, often interrupted mid-task when usage runs out. Follow this
process so work is never lost and any session can pick up cold.

## Start of every session

Before making any change, read these to know exactly what's in progress:

1. `RESUME.md` — plain-language "what to do next"
2. `CHECKPOINT.md` — last session's state and any gotchas
3. `TASKS.md` — outstanding task list
4. `STATE.md` — full narrative history if more context is needed

Then run `./build.sh` once to confirm the repo is in a working state before
touching anything.

## While working

- Work in small, complete steps. After each one that builds successfully,
  **commit and push immediately** — do not batch several changes into one
  uncommitted pile. Usage can run out without warning; anything not pushed
  when the session ends may be lost.
- Never commit a change to `app/` or `android/` without running `./build.sh`
  first and confirming it succeeds. A broken commit is worse than no commit —
  it hands the next session a broken checkpoint instead of an honest one.
- Keep commit messages descriptive (this repo's convention — see `git log`).

## Before ending a session (or when usage is running low)

Update and commit+push, even if the task isn't finished:

- `CHECKPOINT.md` — what changed this session, what's left, anything the
  next session needs to know that isn't obvious from the diff
- `RESUME.md` — the next concrete step, in plain terms
- `TASKS.md` — check off anything completed

Do this *before* the last available turn, not after — there's no guarantee
of a clean shutdown when usage cuts off.

## Switching to a different Claude account

Nothing special to do — just point the new session at this same GitHub repo.
It will read the files above and continue from the last pushed commit.
