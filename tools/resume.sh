#!/usr/bin/env bash
# resume.sh — the cross-account handoff. Runs from the SessionStart hook.
#
# WHY THIS EXISTS
# ---------------
# The job is worked across three Claude accounts. When one runs out of usage,
# the next one opens this repo COLD: no memory of the conversation, no idea a
# previous session existed. Everything it needs has to already be on disk and
# has to arrive without Tj typing an explanation, because the whole point is
# that he does not have to remember one.
#
# So this prints the briefing into the new session's context automatically:
# where the last session stopped (CHECKPOINT.md), what the job is (TASKS.md),
# the rules that must not be broken, and — the part bootstrap.sh cannot know —
# whether this checkout is actually current with GitHub, and whether the
# automatic checkpointing was still working when the last session died.
#
# BUDGET. bootstrap.sh was deliberately cut from ~1,200 lines to ~120 because
# everything printed here is re-sent on every subsequent turn. Do not grow this
# without reading the note at the top of bootstrap.sh first.
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$D" || exit 0

BRIEF="$(
  echo "=============================================================================="
  echo "  RESUMING FF TRACKER — this repo is worked across several Claude accounts."
  echo "  A previous session may have been cut off mid-change. Read this before"
  echo "  planning anything, and do NOT re-derive work that is already committed."
  echo "=============================================================================="
  echo

  if [ -d .git ]; then
    timeout 25 git fetch -q origin >/dev/null 2>&1 || echo "  NOTE  could not reach GitHub — working from the local checkout only."

    # IS THIS SESSION EVEN ON main? Claude Code on the web forks a fresh
    # branch per session (see CLAUDE.md "Branches") — the checks below this
    # one compare HEAD against ITS OWN upstream (@{u}), which stays "in sync"
    # forever on a stranded feature branch and cannot see this problem. It
    # took a whole session shipping three versions before anyone noticed
    # main never moved (2026-09-14) — this is that gap, closed. Safe case
    # only: fast-forward automatically, same as the pull below. Diverged
    # case: warn loudly and do NOT merge blind, per CLAUDE.md.
    CURBRANCH="$(git symbolic-ref --short -q HEAD 2>/dev/null || echo '')"
    if [ -n "$CURBRANCH" ] && [ "$CURBRANCH" != "main" ]; then
      MAINREF="$(git rev-parse -q --verify origin/main 2>/dev/null || echo '')"
      if [ -n "$MAINREF" ] && git merge-base --is-ancestor "$MAINREF" HEAD 2>/dev/null; then
        if timeout 25 git push -q origin HEAD:main 2>/dev/null; then
          echo "  OK    on branch '$CURBRANCH', not main — origin/main was a strict"
          echo "        ancestor of HEAD, so it was fast-forwarded automatically."
        else
          echo "  WARN  on branch '$CURBRANCH', not main. origin/main looked safely"
          echo "        fast-forwardable but the push failed. Fix by hand:"
          echo "        git push origin HEAD:main"
        fi
      elif [ -n "$MAINREF" ]; then
        echo "  !!    ON BRANCH '$CURBRANCH', NOT main — and main has commits this"
        echo "        branch does not. Do NOT merge blind. Read CLAUDE.md 'Branches',"
        echo "        work out what is on each side, and tell Tj before reconciling."
      fi
    fi

    # STRANDED WORK ON OTHER BRANCHES (2026-09-27b). Every session gets its own
    # branch and new sessions start from main, so a session whose last saves
    # never reached main (cut off before its ckpt, or main had diverged) left
    # them on a branch nobody looks at. Anything recent that this checkout
    # does not contain is named here, so it is merged or ruled out on purpose
    # rather than silently re-done. "Recent" = tip within 72h of main's tip,
    # which keeps weeks of finished branches out of the briefing.
    MAINT="$(git log -1 --format=%ct origin/main 2>/dev/null || echo 0)"
    NSTR=0
    for RB in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin 2>/dev/null); do
      case "$RB" in origin|origin/HEAD|origin/main|"origin/$CURBRANCH") continue;; esac
      git merge-base --is-ancestor "$RB" HEAD 2>/dev/null && continue
      RT="$(git log -1 --format=%ct "$RB" 2>/dev/null || echo 0)"
      [ "${RT:-0}" -lt $(( ${MAINT:-0} - 259200 )) ] && continue
      NEW="$(git rev-list --count HEAD.."$RB" 2>/dev/null || echo '?')"
      if [ "$NSTR" -eq 0 ]; then
        echo "  !!    OTHER BRANCHES CARRY RECENT COMMITS THIS CHECKOUT DOES NOT HAVE."
        echo "        Possibly a cut-off session's work. Look before re-doing anything:"
      fi
      NSTR=$((NSTR + 1))
      [ "$NSTR" -le 5 ] && echo "          ${RB#origin/}: $NEW commit(s), last $(git log -1 --format='%cr — %s' "$RB" 2>/dev/null | cut -c1-90)"
    done
    [ "$NSTR" -gt 0 ] && echo "        (git log HEAD..origin/<branch>; tell Tj before merging — CLAUDE.md 'Branches')"

    DIRTY="$(git status --porcelain 2>/dev/null)"
    BEHIND="$(git rev-list --count HEAD..@{u} 2>/dev/null || echo 0)"
    AHEAD="$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)"

    # Fast-forward only, and only from a clean tree. A merge here could conflict
    # on a half-finished change from the session that just died, which is the
    # worst possible moment to ask a cold session to resolve one.
    if [ -z "$DIRTY" ] && [ "${BEHIND:-0}" -gt 0 ] && [ "${AHEAD:-0}" -eq 0 ]; then
      if timeout 25 git pull -q --ff-only >/dev/null 2>&1; then
        echo "  OK    pulled $BEHIND new commit(s) from GitHub — this checkout is now current."
      fi
    elif [ "${BEHIND:-0}" -gt 0 ] && [ "${AHEAD:-0}" -gt 0 ]; then
      echo "  WARN  this branch has DIVERGED from GitHub ($AHEAD local, $BEHIND remote)."
      echo "        Two sessions were probably running at once. Reconcile before working."
    elif [ "${BEHIND:-0}" -gt 0 ]; then
      echo "  WARN  $BEHIND commit(s) behind GitHub and the tree is dirty — do not"
      echo "        start new work until this is reconciled, or the two will conflict."
    fi
    [ "${AHEAD:-0}" -gt 0 ] && echo "  NOTE  $AHEAD commit(s) not yet pushed — 'git push origin HEAD' when convenient."

    # Is the safety net actually running? A hook that silently stopped firing
    # looks exactly like a session that made no edits, and the difference is
    # everything. Say it out loud so a broken hook is caught on the next start
    # rather than discovered after a cap eats an hour of work.
    LASTAUTO="$(git log -1 --format=%cr --grep='^auto-checkpoint:' 2>/dev/null || true)"
    NAUTO="$(git log --oneline --grep='^auto-checkpoint:' 2>/dev/null | wc -l | tr -d ' ')"
    if [ -n "$LASTAUTO" ]; then
      echo "  OK    auto-checkpointing is live ($NAUTO so far, most recent $LASTAUTO)."
    else
      echo "  NOTE  no auto-checkpoint commits yet. If this session makes edits and"
      echo "        none appear, the hook in .claude/settings.json is not firing —"
      echo "        say so rather than working on unprotected."
    fi

    # WAS THE LAST SESSION CUT OFF MID-CHANGE?
    # This is the question CHECKPOINT.md cannot answer about itself. The
    # autosave hook commits after every edit, so a session killed by a usage
    # cap leaves a CLEAN tree whose HEAD is a half-finished change — it looks
    # exactly like a finished piece of work, and CHECKPOINT.md still describes
    # the state as of the last DELIBERATE checkpoint, which may be several
    # steps behind. Without this warning the next account reads a stale
    # "Do this next", assumes everything up to HEAD is done, and builds on top
    # of a half-written function.
    #
    # The tell: commits after the newest 'ckpt N:' or 'ship vN:'. Those two are
    # the only ones a session makes on purpose.
    LASTCKPT="$(git log -1 --format=%H --extended-regexp --grep='^(ckpt [0-9]+:|ship v)' 2>/dev/null || true)"
    # The automatic files do not count (2026-09-27b): every message Tj sends
    # lands as an "auto-checkpoint" of INBOX.md, and the session log / worklog
    # commit the same way — none of them is a half-written change, and
    # counting them sent fresh sessions off reading diffs of their own inbox.
    AUTOX=":(exclude)INBOX.md :(exclude)SESSIONLOG.md :(exclude)WORKLOG.md"
    if [ -n "$LASTCKPT" ]; then
      # shellcheck disable=SC2086
      SINCE="$(git log --format=%H "$LASTCKPT"..HEAD -- . $AUTOX 2>/dev/null | wc -l | tr -d ' ')"
      if [ "${SINCE:-0}" -gt 0 ]; then
        echo
        echo "  !!    THE LAST SESSION WAS INTERRUPTED MID-CHANGE."
        echo "        $SINCE automatic checkpoint(s) were saved AFTER the last"
        echo "        deliberate one, which means the session stopped without"
        echo "        finishing a step — almost certainly a usage cap."
        echo
        echo "        CHECKPOINT.md below describes the last DELIBERATE"
        echo "        checkpoint, NOT the current HEAD. The code in these files"
        echo "        may be half-written. Read the change before trusting it:"
        echo
        echo "          git diff $(git rev-parse --short "$LASTCKPT")..HEAD"
        echo
        # shellcheck disable=SC2086
        git diff --stat "$LASTCKPT"..HEAD -- . $AUTOX 2>/dev/null | tail -15 | sed 's/^/          /'
        echo
        echo "        Finish that change first, then checkpoint properly with"
        echo "        tools/ckpt.sh before starting anything new."
      fi
    fi

    if [ -n "$DIRTY" ]; then
      echo
      echo "  !!    UNCOMMITTED WORK IS PRESENT — even the autosave hook did not"
      echo "        get to this. 'git diff' is what was in flight; read it before"
      echo "        deciding anything. It is probably the task you are resuming."
      printf '%s\n' "$DIRTY" | head -20 | sed 's/^/          /'
    fi
    echo
  fi

  # THE RAW INBOX (2026-09-15, added after a real failure — see INBOX.md's own
  # header). A UserPromptSubmit hook writes every message Tj sends here,
  # verbatim, the instant it arrives — before any session has done a single
  # read, let alone updated TASKS.md. Printed UNCONDITIONALLY, every session,
  # because the whole point is that nothing here depends on a session having
  # remembered to curate it. Compare this against TASKS.md below: if it names
  # something TASKS.md does not yet cover, THAT is the request that was never
  # written down, not a stale duplicate.
  if [ -f INBOX.md ]; then
    # Tj's messages only — harness <task-notification> entries (recorded
    # before capture_inbox.sh learned to skip them) are not his (2026-09-27b).
    INBOXTAIL="$(python3 - <<'PYEOF' 2>/dev/null
body = open('INBOX.md', encoding='utf-8').read()
parts = body.split('\n## 20')
entries = ['## 20' + p for p in parts[1:] if '<task-notification>' not in p.split('\n', 3)[:3][-1]]
out, n = [], 0
for e in reversed(entries):
    n += len(e)
    if n > 2500 and out:
        break
    out.append(e.rstrip() + '\n')
print('\n'.join(reversed(out))[-2600:])
PYEOF
)"
    [ -z "$INBOXTAIL" ] && INBOXTAIL="$(tail -c 2500 INBOX.md 2>/dev/null | sed -n '/^## /,$p')"
    if [ -n "$INBOXTAIL" ]; then
      echo "----------------------------------------------------------------"
      echo "RAW INBOX (INBOX.md tail) — guaranteed captured, may be ahead of"
      echo "TASKS.md. Read it before assuming TASKS.md is the whole job:"
      echo "----------------------------------------------------------------"
      printf '%s\n' "$INBOXTAIL"
      echo "----------------------------------------------------------------"
      echo
    fi
  fi

  # WHAT THE LAST SESSIONS LEARNED (2026-09-27b — see tools/sessionlog.py).
  # WORKLOG.md: deliberate one-line findings (tools/note.sh), last few only.
  # SESSIONLOG.md: the newest session's own messages — printed ONLY when that
  # session kept working after its last deliberate checkpoint (i.e. it was cut
  # off with findings CHECKPOINT.md does not have). Otherwise one line, so a
  # normal resume pays nothing extra for it.
  if [ -f WORKLOG.md ] && grep -q '^- 20' WORKLOG.md 2>/dev/null; then
    echo "----------------------------------------------------------------"
    echo "WORKLOG.md tail — findings saved with tools/note.sh, newest last:"
    echo "----------------------------------------------------------------"
    grep '^- 20' WORKLOG.md | tail -8 | cut -c1-400
    echo
  fi
  if [ -f SESSIONLOG.md ] && command -v python3 >/dev/null 2>&1 && [ -d .git ]; then
    CKT="$(git log -1 --format=%ct --extended-regexp --grep='^(ckpt [0-9]+:|ship v)' 2>/dev/null || echo 0)"
    CKT="$CKT" python3 - <<'PYEOF' 2>/dev/null || true
import calendar, os, re, time
body = open('SESSIONLOG.md', encoding='utf-8').read()
best = None
for chunk in body.split('\n## session ')[1:]:
    m = re.search(r'updated (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ)', chunk.split('\n', 1)[0])
    if not m:
        continue
    t = calendar.timegm(time.strptime(m.group(1), '%Y-%m-%dT%H:%M:%SZ'))
    if best is None or t > best[0]:
        best = (t, chunk)
ckt = int(os.environ.get('CKT') or 0)
# The signal is TOOL CALLS after the checkpoint, not messages: every finished
# session writes its closing report after its last ckpt, and that is not lost
# work. A session cut off mid-job keeps calling tools (reads, edits) for
# minutes past its last ckpt — 2026-09-27's ran ~9 minutes.
lt = 0
if best:
    m = re.search(r'last tool (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)', best[1].split('\n', 1)[0])
    if m:
        lt = calendar.timegm(time.strptime(m.group(1), '%Y-%m-%dT%H:%M:%S'))
if best and lt > ckt + 120:
    head, rest = best[1].split('\n', 1)
    print('----------------------------------------------------------------')
    print('!!  THE LAST SESSION KEPT WORKING AFTER ITS LAST CHECKPOINT. Its own')
    print('    words (SESSIONLOG.md), newest last — read before re-deriving:')
    print('----------------------------------------------------------------')
    print('session ' + head)
    msgs = [l for l in rest.splitlines() if l.startswith('- [')]
    out, n = [], 0
    for l in reversed(msgs):
        n += len(l)
        if n > 2600:
            break
        out.append(l)
    print('\n'.join(reversed(out)))
    trail = [l for l in rest.splitlines() if l.startswith('Last ')]
    if trail:
        print(trail[0][:600])
    print()
elif best:
    print('  OK    SESSIONLOG.md: the last session checkpointed after its last message (nothing lost).')
    print()
PYEOF
  fi

  bash bootstrap.sh 2>&1 || true
)"

# Claude Code takes SessionStart stdout as context. JSON with additionalContext
# is the documented path; plain text is the fallback when python3 is absent
# (bootstrap.sh warns about that separately) — never emit both, that would make
# the JSON unparseable and lose the briefing entirely.
if command -v python3 >/dev/null 2>&1; then
  printf '%s' "$BRIEF" | python3 -c '
import json, sys
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": sys.stdin.read()}}))
' 2>/dev/null || printf '%s\n' "$BRIEF"
else
  printf '%s\n' "$BRIEF"
fi
exit 0
