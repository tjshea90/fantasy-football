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

**If you did not see that briefing, run `bash tools/resume.sh` before doing
anything else, and tell Tj it did not fire** — it means the hook is not
running, and the automatic saving below almost certainly is not either, so
this session is working without a safety net.

Read the two warnings it can raise:

- **"INTERRUPTED MID-CHANGE"** — the last session was killed by a usage cap
  part-way through a step. The tree is clean, but only because a hook
  committed a half-written change. `CHECKPOINT.md` describes the state
  *before* that, so it is stale. Run the `git diff` it names, finish that
  change, checkpoint it — then start anything new.
- **"UNCOMMITTED WORK IS PRESENT"** — the same thing, one step worse: not even
  the hook got to it. `git diff` is what was in flight.

## Branches — `main` is the only source of truth (learned the hard way, 2026-09-12)

Claude Code on the web puts each session on its own auto-generated branch
rather than reusing one — a platform decision this repo cannot bind from the
inside, and CLAUDE.md used to say nothing about it. The result: four sessions
in one day forked from the same point on `main`, each thinking it was the
sole continuation of this working agreement, and shipped four incompatible
versions (v4.8 twice, independently; v5.0) with `main` never moving. Tj's
phone ended up running a build with none of the work another account had
already finished. Untangling it cost most of a day. Do not let it happen
again:

- **Before starting real work, check whether `main` has moved past your
  starting point** (`git log origin/main` vs your branch's merge-base). If it
  has, someone else's finished work is sitting there uninherited — pull it in
  before adding more on top, the same way you would if `CHECKPOINT.md` had
  described an interrupted session.
- **When you finish something worth keeping, get it onto `main`.** If you are
  already on `main`, this is automatic (`ckpt.sh`/`ship.sh` already push
  there). If a fresh session finds itself on some other branch, fast-forward
  or merge that branch's work into `main` before ending the session — do not
  leave it stranded on a branch nobody else will think to look at.
- **If you discover another branch with real, uninherited work on it** (the
  situation above, not just an old abandoned experiment), tell Tj plainly
  before merging it in blind — a design decision on one branch may
  contradict one just made on another (this happened: one branch added a
  feature to the Table tab the same day another branch deleted the Table
  tab). Reconciling divergent work is a judgment call each time, not
  something to automate away.
- The most reliable way to avoid a new branch appearing at all: Tj resuming
  the *same* Claude Code session/conversation rather than starting a new one
  from claude.ai/code. That is a habit on his end, not something this file
  can enforce.

## When Tj asks for something new

**Write the request into `TASKS.md` in his own words, as unticked `[ ]`
boxes, and checkpoint it before writing any code.** Until it is on disk the
job exists only in a chat window that no other account can ever see. If usage
runs out before the first checkpoint, the next account inherits the work but
not the knowledge of what was asked — and it cannot ask him, because from his
side he already explained it.

Tick a box only when it is written, tested and committed, and name the test
that proves it. The next account will not re-verify a ticked box.

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
