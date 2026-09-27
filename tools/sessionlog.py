#!/usr/bin/env python3
"""sessionlog.py — the part of a session that no diff can save. Called by
autosave.sh (every hook), never by hand.

WHY THIS EXISTS (Tj, 2026-09-27: "the Claude resume checkpoint system
completely failed ... I must be able to resume Claude work without losing
data or wasting usage")
--------------------------------------------------------------------------
Autosave commits FILES. A session that spends ten minutes reading code and
working out a cause has changed no file, so autosave has nothing to save —
and when the usage cap lands, everything it learned dies with its context.
That is what happened on 2026-09-27: the session that took the lineup/live-DEF
request pushed "ckpt 52" at 17:21Z, then analysed for ~9 minutes and was cut
off. Nothing after 17:21 reached GitHub; the next account started cold and
paid for the whole analysis again.

Two things, both automatic:

1. SESSIONLOG.md — Claude's own visible messages (the "found it: ..." lines
   it writes as it works) plus a trail of which files/searches it touched,
   pulled from the session transcript the hook is handed, and committed by
   autosave.sh with everything else. Throttled to once a minute (always on
   Stop/PreCompact) so it costs nothing per tool call. Thinking is NOT copied,
   user messages are not copied (INBOX.md has those), and anything shaped like
   a credential or an email address is redacted — this repo is public.

2. The research nudge — every NUDGE_EVERY tool calls in a row with no real
   file saved, Claude is told (additionalContext) to write what it has learned
   with tools/note.sh. The log above is the net; a note in Claude's own words
   is the thing the next session can act on.

Prints the nudge text (or nothing) on stdout. Never raises, never blocks.
"""
import json, os, re, subprocess, sys, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
LOG = os.path.join(ROOT, 'SESSIONLOG.md')
STATE_DIR = os.path.join(ROOT, '.git', 'ff-hooks')
THROTTLE_S = 60          # SESSIONLOG.md rewritten at most this often mid-session
NUDGE_EVERY = 12         # tool calls in a row with nothing real saved
KEEP_SESSIONS = 3        # sections kept in SESSIONLOG.md
TAIL_BYTES = 3 * 1024 * 1024
MAX_TEXTS, MAX_TEXT_CHARS = 25, 700
MAX_TOOLS = 40
FORCE_EVENTS = ('Stop', 'PreCompact', 'SessionEnd', 'SubagentStop')
# not "real" progress: the automatic files themselves
AUTO_FILES = ('SESSIONLOG.md', 'INBOX.md')

SECRET = re.compile(
    r'sk-ant-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|'
    r'github_pat_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z_-]{20,}|AKIA[0-9A-Z]{12,}|'
    r'xox[baprs]-[A-Za-z0-9-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----')
EMAIL = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')


def redact(s):
    return EMAIL.sub('[email]', SECRET.sub('[redacted]', s))


def git(*args):
    try:
        return subprocess.run(['git'] + list(args), cwd=ROOT, capture_output=True,
                              text=True, timeout=10).stdout.strip()
    except Exception:
        return ''


def state_path(name):
    os.makedirs(STATE_DIR, exist_ok=True)
    return os.path.join(STATE_DIR, name)


def read_state():
    try:
        with open(state_path('state.json')) as f:
            return json.load(f)
    except Exception:
        return {}


def write_state(st):
    try:
        tmp = state_path('state.json.tmp')
        with open(tmp, 'w') as f:
            json.dump(st, f)
        os.replace(tmp, state_path('state.json'))
    except Exception:
        pass


def iso(ts):
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(ts))


def hhmm(stamp):
    m = re.search(r'T(\d\d:\d\d)', stamp or '')
    return m.group(1) if m else '--:--'


def tool_brief(name, inp):
    inp = inp if isinstance(inp, dict) else {}
    for k in ('file_path', 'path', 'pattern', 'description', 'url', 'query', 'prompt', 'command'):
        v = inp.get(k)
        if isinstance(v, str) and v:
            if k in ('file_path', 'path'):
                v = os.path.relpath(v, ROOT) if v.startswith(ROOT) else v
            v = ' '.join(v.split())
            return '%s %s' % (name, v[:70])
    return name


def read_transcript(path):
    """(texts, tools, first_ts) from the transcript's tail — main thread only."""
    texts, tools, first = [], [], ''
    try:
        size = os.path.getsize(path)
        with open(path, 'rb') as f:
            if size > TAIL_BYTES:
                f.seek(size - TAIL_BYTES)
                f.readline()                   # drop the partial first line
            raw = f.read().decode('utf-8', 'replace')
    except Exception:
        return texts, tools, first
    for line in raw.splitlines():
        try:
            o = json.loads(line)
        except Exception:
            continue
        if o.get('type') != 'assistant' or o.get('isSidechain'):
            continue
        ts = o.get('timestamp') or ''
        first = first or ts
        for b in (o.get('message') or {}).get('content') or []:
            if not isinstance(b, dict):
                continue
            if b.get('type') == 'text' and (b.get('text') or '').strip():
                t = ' '.join(b['text'].split())
                if len(t) > MAX_TEXT_CHARS:
                    t = t[:MAX_TEXT_CHARS] + ' …'
                texts.append((ts, t))
            elif b.get('type') == 'tool_use':
                tools.append((ts, tool_brief(b.get('name') or '?', b.get('input'))))
    return texts[-MAX_TEXTS:], tools[-MAX_TOOLS:], first


HEADER = """# SESSIONLOG — what recent sessions said while they worked (automatic)

Written by the autosave hook (tools/sessionlog.py) from each session's own
transcript: Claude's visible messages and the files/searches it touched,
newest session first, last %d sessions. It exists so a session cut off by a
usage cap mid-ANALYSIS (no file edited yet) still leaves its findings on
GitHub. Thinking and user messages are not copied; credentials and emails are
redacted. Deliberate notes live in WORKLOG.md; the plan lives in TASKS.md.
""" % KEEP_SESSIONS


def write_log(sid, branch, texts, tools, first):
    sections = {}
    order = []
    try:
        with open(LOG, encoding='utf-8') as f:
            body = f.read()
        for chunk in body.split('\n## session ')[1:]:
            key = chunk.split(' ', 1)[0].strip()
            m = re.search(r'updated (\S+)', chunk.split('\n', 1)[0])
            sections[key] = (m.group(1) if m else '', '## session ' + chunk.rstrip() + '\n')
    except Exception:
        pass
    now = iso(time.time())
    lines = ['## session %s · branch %s · started %s · updated %s' % (sid[:8], branch or '?', first or '?', now), '']
    lines.append("Claude's messages, oldest first:")
    lines.append('')
    for ts, t in texts:
        lines.append('- [%s] %s' % (hhmm(ts), redact(t)))
    if not texts:
        lines.append('- (none yet)')
    lines.append('')
    lines.append('Last %d tool calls: ' % len(tools) +
                 ' · '.join('%s %s' % (hhmm(ts), redact(b)) for ts, b in tools))
    sections[sid[:8]] = (now, '\n'.join(lines) + '\n')
    keep = sorted(sections.items(), key=lambda kv: kv[1][0], reverse=True)[:KEEP_SESSIONS]
    out = HEADER + '\n' + '\n'.join(v[1] for k, v in keep)
    tmp = LOG + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(out)
    os.replace(tmp, LOG)


def real_change_marker():
    """Something other than the automatic files changed: pending, or committed."""
    excl = [':(exclude)%s' % p for p in AUTO_FILES]
    pending = git('status', '--porcelain', '--', '.', *excl)
    last = git('log', '-1', '--format=%H', '--', '.', *excl)
    return pending, last


def main():
    raw = sys.stdin.read()
    try:
        hook = json.loads(raw) if raw.strip() else {}
    except Exception:
        hook = {}
    if not isinstance(hook, dict) or not hook:
        return
    sid = str(hook.get('session_id') or 'unknown')
    event = str(hook.get('hook_event_name') or '')
    tpath = hook.get('transcript_path') or ''
    st = read_state()
    now = time.time()
    out = ''

    # ---- the research nudge (tool calls only) ----
    if event == 'PostToolUse':
        pending, last = real_change_marker()
        if pending or last != st.get('last_real'):
            st['last_real'] = last
            st['quiet'] = 0
        else:
            st['quiet'] = int(st.get('quiet', 0)) + 1
            if st['quiet'] % NUDGE_EVERY == 0:
                out = ('CHECKPOINT NUDGE: %d tool calls in a row with nothing saved to GitHub '
                       'except the automatic SESSIONLOG.md. If you have learned anything a '
                       'fresh session would need (a cause, where the code is, a decision, a '
                       'dead end), save it NOW in one line: bash tools/note.sh "..." -- a usage '
                       'cap right now would lose it, and the next account would pay to find it '
                       'again.' % st['quiet'])

    # ---- the session log (throttled) ----
    key = 'written_' + sid[:8]
    if tpath and os.path.exists(tpath) and (event in FORCE_EVENTS or now - float(st.get(key, 0)) >= THROTTLE_S):
        texts, tools, first = read_transcript(tpath)
        if texts or tools:
            try:
                write_log(sid, git('branch', '--show-current'), texts, tools, first)
                st[key] = now
            except Exception:
                pass
    write_state(st)
    if out:
        sys.stdout.write(out)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
