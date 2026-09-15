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
latest from GitHub and printed `CHECKPOINT.md`, `TASKS.md`, the tail of
`INBOX.md` and the rules into your context. **Do not re-run bootstrap, do not
re-plan, do not re-read finished work.** Continue from **Do this next** in
`CHECKPOINT.md`, or the first unticked `[ ]` in `TASKS.md`.

**Check the `INBOX.md` tail against `TASKS.md` before assuming you know the
whole job.** `INBOX.md` is a raw, guaranteed-captured log of every message Tj
sends (see "When Tj asks for something new" below) — if it names something
`TASKS.md` does not yet cover, that is a request a previous session never
got around to writing down, not a stale duplicate.

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
boxes, and checkpoint it before writing any code.** Until it is written into
`TASKS.md` as real steps, nobody has actually planned the work — a message
sitting in a chat window is not a task list.

**You do not have to race a usage cap to get the raw request itself onto
disk any more (learned the hard way, 2026-09-15).** A `UserPromptSubmit`
hook (`tools/capture_inbox.sh`) already writes every message Tj sends to
`INBOX.md`, verbatim, and commits+pushes it the instant it arrives — before
you have read a single file. That used to be the failure: a session spent
its whole budget reading the codebase for a new feature, was cut off before
ever writing the request to `TASKS.md`, and the `PostToolUse` autosave hook
(which only fires on `Edit|Write|NotebookEdit|Bash`) never fired either,
because a pure research stretch trips none of those. Nothing reached disk,
anywhere, and the next session opened cold with no way to know the request
had ever been made — confirmed against this repo's own history.

This does not lower the bar on writing `TASKS.md` promptly — a raw inbox
entry is not a plan, and a long research stretch before turning it into one
is still worth avoiding. It means a forgotten or interrupted `TASKS.md` write
is now a recoverable gap instead of a total loss: the exact words are always
on `INBOX.md`, and `resume.sh` prints its tail every session specifically so
this is never missed twice.

Tick a `TASKS.md` box only when it is written, tested and committed, and name
the test that proves it. The next account will not re-verify a ticked box.

## Saving work — three levels, plus a backstop underneath the first one

**0. The raw message itself (hooks — happens without you, before you do
anything).** `tools/capture_inbox.sh` (a `UserPromptSubmit` hook) appends
every message Tj sends to `INBOX.md`, verbatim, and commits+pushes it the
moment it arrives — before any tool call, before any judgment about whether
it is "worth" saving yet. This is not a substitute for level 1 below or for
writing `TASKS.md`; it exists only so the exact words are never lost even if
nothing else gets written down before a usage cap hits. You do not call it,
and you should not need it if you write `TASKS.md` promptly — treat it as
the net under the net.

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

## After every ship — publish a real Release, then send Tj the link

**Every session, every account: once `ship.sh` succeeds, publish a real
GitHub Release for it and send Tj that link — not a raw-file link — in your
reply.** This is a standing instruction (Tj, 2026-09-14, refined same day
after two rounds of broken links) — it does not go in `TASKS.md`, does not
get ticked off, and does not get archived away when a job finishes. Applies
to every future ship, on every account, no matter how small the change. A
bare `bash build.sh` run does not qualify — untested, uncommitted, nothing
to release.

**Do this, in order — `ship.sh` prints the exact call to make:**

1. **Trigger the Release.** `ship.sh` cannot do this itself — it is a bash
   script with no GitHub API access. Call, right after `ship.sh` finishes:
   `mcp__github__actions_run_trigger`, `method: run_workflow`,
   `workflow_id: publish-release.yml`, `ref: main`,
   `inputs: {version: "<VERSION>"}` (e.g. `"5.7"`, no leading `v`). This
   workflow creates its own tag and publishes the Release — it does not
   need `ship.sh` to have pushed one (see "Why no tag push" below).
2. **Verify before telling him anything.** The run is asynchronous and
   calls the real GitHub API, so it can fail. Poll
   `mcp__github__actions_list` (`list_workflow_runs`,
   `resource_id: publish-release.yml`) until `conclusion: "success"`, or
   call `mcp__github__get_release_by_tag` (`tag: "v<VERSION>"`) until it
   returns an object with a non-empty `assets` array. Confirmed working
   end-to-end this way for v5.7 on 2026-09-14 — do not skip this step and
   assume it worked.
3. **Send Tj this exact message shape** (Tj, 2026-09-14 — styled after a
   message from his Portfolio project: "v7.22 is shipped. Run #22 went
   green, the release is published, and it's recorded in BUILDLOG.md. Grab
   it here: <link>"). This repo has no remote CI gate to cite a run number
   for — `ship.sh` is the gate, and it runs locally — so say what actually
   went green here instead of copying "Run #" verbatim:

   > v<VERSION> is shipped. Every test suite and the ES2018 gate went
   > green, the release is published, and it's recorded in BUILDLOG.md.
   > Grab it here: https://github.com/tjshea90/fantasy-football/releases/tag/v<VERSION>

   **The link is plain text on its own, tappable — never inside a fenced
   code block.** A code block was tried first (Tj asked for a copy button)
   but it is NOT a clickable link, only copyable text — Tj corrected this
   immediately (2026-09-14): "You didn't send the link. You sent a copy and
   paste box." A bare URL in plain text is both tappable AND
   long-press-copyable on a phone, which is what a code block gave up to
   gain nothing. Do not wrap it in backticks, bold, or a code fence.

4. **If step 1-2 fails or is still pending**, this always works immediately,
   no waiting, no publish step — plain tappable text, same rule as above,
   never in a code block:

   https://github.com/tjshea90/fantasy-football/raw/main/releases/FFTracker-v<VERSION>.apk

**Why a Release, not a raw-file link (the two failures this replaced,
2026-09-14).** First, `/blob/` — GitHub's HTML file-preview page — renders
fine in a browser but dumped raw APK bytes as garbled text in the GitHub
mobile app's own in-app viewer. `/raw/` fixed that (confirmed with
`curl -IL`: `content-type: application/octet-stream`, forces a download).
But a raw-file link also 404s the moment `main` is not current, which
turned out to be a real, recurring failure mode of its own (see "Branches"
above). A GitHub Release fixes both at once: it is inherently tied to a tag
at a specific commit (immune to `main` drift), and GitHub serves release
assets with `Content-Disposition: attachment`, which is a stronger signal
than plain `octet-stream` — every client treats it as a file to save, full
stop.

**Why no tag push from `ship.sh` or from this session's own git remote.**
Tested directly: this session's git push credentials can push a new
*branch* but get an HTTP 403 on any *tag* push, lightweight or annotated —
confirmed clean (not a proxy fluke: `recentRelayFailures` was empty), same
class of restriction as branch deletion being blocked (see "Branches"
above). `publish-release.yml`'s `workflow_dispatch` trigger sidesteps this
entirely: it is invoked via the GitHub API (a differently-scoped
credential) rather than a git push, and the workflow creates its own tag
from inside the Actions runner using the job's own `GITHUB_TOKEN`
(`permissions: contents: write`), which is a completely separate auth path
from this session's git remote and is not subject to the same restriction.

**The workflow re-builds nothing.** `publish-release.yml` takes the APK
`ship.sh` already built, tested, and committed to `releases/` — `ship.sh` is
the gate, the workflow only publishes. See `.github/workflows/publish-release.yml`
for the full mechanics and STATE.md's 2026-09-14 entries for the two rounds
of debugging that produced this design.

## This repo is public

`tools/secretscan.sh` blocks the autosave hook from committing anything
shaped like a live credential. If it trips, remove the credential — do not
bypass it. An API key pushed to a public repo has to be rotated, not deleted.
