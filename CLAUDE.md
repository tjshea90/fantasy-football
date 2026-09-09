# FF Tracker — working agreement

Android fantasy football tracker (WebView + thin Java shell, no Gradle).
Worked on from a phone, across **three different Claude accounts**. When one
account's usage runs out mid-task, the next account opens this repo cold and
continues. Everything below exists to make that handoff lossless.

**The standing rules of the project itself** (ES2018 only, one universal APK,
async bridge, the scoring engine as ground truth, never trust a build that
printed an error) are printed at session start by `bootstrap.sh` and written
in full in `BRIEF.md`. They are not repeated here. Do not violate them.

## Starting a session

A `SessionStart` hook has already run `tools/resume.sh`, which pulled the
latest from GitHub and printed `CHECKPOINT.md`, `TASKS.md` and the rules into
your context. **Do not re-run bootstrap, do not re-plan, do not re-read
finished work.** Continue from **Do this next** in `CHECKPOINT.md`, or the
first unticked `[ ]` in `TASKS.md`.

If that briefing did not appear, say so before working — it means the hook
did not fire and the safety net below is probably not running either.

If it reported uncommitted changes, a previous session was cut off
mid-change. `git diff` is what was in flight. Read it before deciding
anything; it is almost certainly the task you are resuming.

## Saving work — three levels, and you are responsible for the middle one

**1. Automatic (hooks — happens without you).** `tools/autosave.sh` commits
and pushes after every file edit and every bash command. It has no gate and
runs no tests: a broken half-edit that is committed is recoverable, the same
edit uncommitted dies with the session. This is what survives a usage cap
landing mid-change. You do not call it.

**2. Deliberate — `bash tools/ckpt.sh "what I just did" "what comes next"`.**
**Run this after every completed step, not at the end of the session.** The
autosave hook can preserve your *files* but it cannot know your *intent* —
"what comes next" is the one thing no diff can reconstruct and the one thing
the next account most needs. It runs every suite, records green or red
honestly without gating, rewrites `CHECKPOINT.md`, commits and pushes.
Skipping it is how a handoff loses a day even though every file was saved.

**3. Milestone — `bash ship.sh "note"`.** Full release gate: every suite must
be green, `STATE.md` current, manifest agreeing, and the APK's dex must
contain a class for every Java source. Use at real versions, not mid-task.

## Before your usage runs out

You will usually get no warning, which is why level 2 is per-step rather than
per-session. If you *do* notice you are running low, spend the remaining
budget on `tools/ckpt.sh` with an honest, specific "what comes next" — not on
one more edit.

## Building the APK

`bash build.sh` → `build/app-release.apk`. First run downloads the SDK
(~600 MB, a few minutes); after that, seconds. GitHub Actions also builds an
APK on every push — see `.github/workflows/build-apk.yml` — so a green run
there is an independent check that the build is not broken.

## This repo is public

`tools/secretscan.sh` blocks the autosave hook from committing anything
shaped like a live credential. If it trips, remove the credential — do not
bypass it. An API key pushed to a public repo has to be rotated, not deleted.
