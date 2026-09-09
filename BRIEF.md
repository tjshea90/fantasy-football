# OPERATING BRIEF — FF Season Tracker (Android app)

**This bundle is a SEPARATE project from `FF_Toolkit_v3.12_*` (the draft board).**
The draft is over; the draft app is retired. This bundle builds and maintains the
**season-long tracker APK**. It is self-contained: league rules and the final
drafted rosters are carried inside it, so it never needs the old toolkit.

---

## COLD START — the whole resume procedure

This project lives on GitHub and is worked from Claude Code, across **three
different Claude accounts**. When one account's usage runs out, the next opens
the same repo with no memory of anything. There is no zip and no uploaded
bundle; the repo is the only thing that carries state.

**The procedure is: open the repo, say "continue".** A `SessionStart` hook runs
`tools/resume.sh`, which pulls from GitHub and prints `CHECKPOINT.md`,
`TASKS.md` and these rules into the session automatically.

If that briefing did not appear, the hook did not fire — run it by hand and
say so, because the automatic checkpointing is probably not running either:

```bash
bash tools/resume.sh
```

**Do not read SPEC.md unless you are about to build a step that needs it** — it
is long, and `TASKS.md` says which section applies. Report in two lines: what
is done, what is next. **Then continue from "Do this next" in `CHECKPOINT.md`,
or the first unticked `[ ]` in `TASKS.md`.** Do not re-plan, do not re-derive,
do not ask Tj to re-explain anything.

## THE FOUR COMMANDS

```bash
bash tools/resume.sh           # cold start: pull + brief. Automatic on session start.
bash build.sh                  # build the APK (installs the SDK on first run)
bash tools/ckpt.sh "did" "next"  # CHECKPOINT. After every completed step.
bash ship.sh "note"            # milestone: full gate, tests, APK, release
```

`tools/ckpt.sh` is the one that matters most and the one most easily skipped.
See PERSISTENCE below.

## VERSIONING — plain numbers, one source

`VERSION` holds `MAJOR.MINOR` (e.g. `1.8`) and nothing else may carry a version
number. `build.sh` stamps it into the APK's `versionName`, derives
`versionCode` as `major*100+minor`, and generates `app/assets/version.js` so
the About line matches the build. `ship.sh` names the zip and APK
`FFTracker_v<VERSION>.{zip,apk}` and bumps `VERSION` (1.8 → 1.9 → 2.0) if that
name already exists. No dates, no letters.

## PERSISTENCE — non-negotiable

**What is pushed to GitHub is the only thing that survives.** The container is
destroyed when the session ends, and the next session is a fresh clone on a
different account. A commit that was never pushed is exactly as lost as work
that was never written.

A usage cap gives no warning. Assume every turn could be the last one.

1. **Write the job down BEFORE starting it.** When Tj asks for something new,
   the first action is to put his request into `TASKS.md` in his own words, as
   unticked `[ ]` boxes, and checkpoint that. Until it is on disk the job
   exists only in a chat window that the next account cannot see — and a cap
   landing before the first checkpoint loses not just the work but the
   knowledge of what was asked.
2. **Checkpoint after every completed step, not at end of session.**
   `bash tools/ckpt.sh "what I just did" "what comes next"`. It has no gate: it
   commits red suites and half-finished states on purpose, because a described
   broken state is recoverable and an undescribed one is not. It also pushes.
3. **"What comes next" is the payload.** A hook auto-commits every edit, so the
   FILES are already safe without you. What no hook can reconstruct is intent —
   what you were part-way through and what you would have done next. That
   sentence is the entire handoff. Write it as if to a stranger, because the
   next account is one.
4. **Tick a box only when it is written, tested and committed**, and name the
   test that proves it. A tick the next account cannot trust is worse than no
   tick, because it will not re-check it.
5. `MANIFEST.txt` is checked in **both directions** — a file on disk not in the
   manifest, or listed but missing, is a FAIL that stops `bootstrap.sh` and
   `ship.sh`. When a file joins or leaves, edit `MANIFEST.txt` in the same
   breath.

## USAGE DISCIPLINE — Tj is near his cap. This governs everything.

- **Never re-read a file you already wrote this session.** The tools error on a
  failed edit; that is the verification.
- **Never dump a whole source file into the reply.** Write to disk, say what
  changed in one line.
- **Do not re-verify finished ladder steps.** The ticks are the record.
- Prefer one large correct write over five exploratory ones.
- Do not re-run the APK build to "check" — build once per step that changes code.
- When resuming, the ONLY files to open are `STATE.md`, `LADDER.md`, and the one
  source file the next step touches.

## CACHE DISCIPLINE — the reason the rules above exist

The rules above look like frugality. They are actually prompt-cache hygiene, and
knowing the mechanism is what stops a future session from "helpfully" breaking
them. Read this before deciding the rules above are over-cautious.

**The mechanism.** The API is stateless: every turn resends the entire
conversation. A session that has read this bundle is carrying **~70k tokens of
source before anyone says anything**. Prompt caching is the only reason that is
affordable — the accumulated prefix is re-read at **0.1x** instead of full price.
The cacheable prefix is built `tools` → `system` → `messages`, and a change at
any level invalidates that level **and everything after it**.

Nothing here is a setting. Claude Code caches automatically. What a session
controls is whether it HITS — and on a capped account, cache misses are
directly usage that could have gone into the app instead.

1. **Anything printed into the conversation is permanent prefix.** A dumped
   source file is not paid for once — it rides along in every later turn, and it
   is re-paid at FULL price the moment the cache goes cold. This is the whole
   reason for "never dump a whole source file" and "never re-read a file you
   already wrote". Use targeted `Edit` calls; a failed edit errors, and that
   error IS the verification.
2. **Work in long continuous bursts.** A gap longer than the TTL makes the next
   turn re-read the entire conversation at full price. The same work spread
   across four days costs far more than the same work in two sittings. This is
   the single biggest lever and it is behavioural, not technical.
3. **Do not reshuffle tools mid-build.** Installing, removing or toggling a
   plugin or MCP server changes the FRONT of the prefix and invalidates
   everything behind it — the whole conversation, not just the new part. A large
   stable plugin set is fine. A large churning one is expensive.
4. **Start a fresh session once the current one is cold and large; continue in
   place while it is warm.** This is the decision rule behind the checkpoint
   system, and GitHub made it cheaper than it was: `tools/resume.sh` rebuilds
   the working context in ~150 lines. Resuming a stale 300k-token conversation
   pays full price to re-read context that briefing would have rebuilt for a
   fraction. Stale AND long is the worst of both — checkpoint and start clean.
5. **Compaction rewrites earlier messages**, which is a cold start on the
   rewritten portion. Prefer shipping and resuming fresh over letting a session
   grow to the point where it compacts.

Note for a session running near the cap: usage overage drops the TTL from an
hour to five minutes, which makes long-gap resumes dramatically more expensive.
That is exactly when discipline matters most, and exactly when a session is most
tempted to "just re-read everything to be safe". Do not.

Reference: https://platform.claude.com/docs/en/build-with-claude/prompt-caching

## PRECEDENCE

1. `RULES_2026.md` — league scoring. Ground truth. Nothing overrides it.
2. `SPEC.md` — what the app must do, and the exact data contracts.
3. `CHECKPOINT.md` — where the last session stopped. Regenerated every
   checkpoint, so it is never stale. Read first, always.
4. `TASKS.md` — the current job in Tj's own words, and what is left of it.
5. `LADDER.md` — the finished programmes, in order. History, not the job.
6. `STATE.md` — narrative state, decisions taken, traps hit.
7. This brief.

## HARD CONSTRAINTS — decided, do not relitigate

- **One universal APK, no native libraries**, so the same file installs on
  **armv7 Android 10** and **arm64 Android 16 (Moto G 2026)**. This is why the app
  is a WebView + a thin Java shell and NOT React Native / Flutter / Capacitor.
  minSdk 29, targetSdk 36. **Never add an NDK or ABI-specific dependency.**
- **All JS must run on Android 10's WebView (Chromium 77).** No optional
  chaining `?.`, no nullish coalescing `??`, no `Array.prototype.at`, no
  `structuredClone`, no top-level await. ES2018 only. This has bitten before.
- **All network goes through the Java bridge, never `fetch`** from the page —
  a `file://` origin cannot do cross-origin requests.
- **The bridge is ASYNCHRONOUS and must stay that way.** A synchronous
  `@JavascriptInterface` call blocks the renderer's JS thread for the whole
  request: no repaint, no progress bar, no touch handling. That froze the app
  through v1.9 and cost two rounds of fixing the wrong layer. Use
  `Native.httpAsync` + `window.__httpDone`; never add a blocking bridge call,
  and never "simplify" the promise plumbing in `espn.js` back to a direct
  return.
- **The scoring engine is the product.** Any doubt resolves to `RULES_2026.md`,
  and anything inferred rather than measured is labelled in the UI.
