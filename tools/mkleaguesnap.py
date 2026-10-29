#!/usr/bin/env python3
"""Build app/assets/leaguesnap.js from RTSports "Team Capsule" page saves.

Usage: python3 tools/mkleaguesnap.py <dir-with-capsule-html-files> [schedule.pdf]

Each capsule (saved from rtsports.com/football/team-capsules.php, one per team)
carries that team's roster (starter/bench), record, points-for, week-by-week
results with BOTH scores, and its add/drop activity. The schedule PDF
(rtsports.com "2026 Schedule", needs `pdftotext`) lists every week's pairings
including future weeks. The output is a plain <script> (file:// pages cannot
XHR siblings, same reason as seed.js) that defines window.LEAGUE_SNAPSHOT;
Store.applySnapshot() in the app does the rest. Cross-checks every score
against the opposing capsule and aborts if they disagree.
"""
import html, json, os, re, subprocess, sys


def txt(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s)).strip()


MONTHS = {m: i + 1 for i, m in enumerate('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split())}


def iso(dt):
    # RTSports prints ET; every date in an Aug-Oct season is EDT (-04:00)
    mon, day, hh, mm, ap = dt.groups()
    h = int(hh) % 12 + (12 if ap == 'pm' else 0)
    return '2026-%02d-%02dT%02d:%02d:00-04:00' % (MONTHS[mon], int(day), h, int(mm))


def parse_capsule(path):
    t = open(path, errors='replace').read()
    name = re.search(r'<title>(.*?) Team Capsule', t).group(1)
    name = html.unescape(name).strip()
    rec = re.search(r'<span>Record</span><strong>(\d+)-(\d+)(?:-(\d+))?</strong>', t)
    pf = re.search(r'<span>Points For</span><strong>([\d.,]+)</strong><small>Thru week (\d+)', t)
    cur = re.search(r'Week (\d+) · NFL Week', t)
    roster = []
    body = t[t.find('tc-roster-table'):]
    body = body[:body.find('</table>')]
    for row in re.findall(r'<tr class="(?!tc-group-row)[^"]*">(.*?)</tr>', body, re.S):
        pos = re.search(r'pos-badge pos-\w+">(.*?)</span>', row).group(1)
        nm = txt(re.search(r'<strong><a>(.*?)</a></strong>', row).group(1))
        nfl = re.search(r'title="([A-Z]{2,3})"', row)
        bye = re.search(r'<span>Bye (\d+)</span>', row)
        starter = 'tc-status-starter' in row
        roster.append({'name': nm, 'pos': pos.replace('D/ST', 'DEF'),
                       'nfl': nfl.group(1) if nfl else '',
                       'bye': int(bye.group(1)) if bye else 0, 'starter': starter})
    acts = []
    for a in re.findall(r'<article class="tc-activity-item">(.*?)</article>', t, re.S):
        kind = 'add' if 'Player Added' in a else 'drop' if 'Player Dropped' in a else None
        if not kind:
            continue
        m = re.search(r'<strong>Player (?:Added|Dropped) <span><a>(.*?)</a>\s*([A-Z/]+)\s*([A-Z-]*)</span>', a)
        w = re.search(r'<small>\s*Week (\d+)', a)
        dt = re.search(r'([A-Z][a-z]{2}) (\d+) (\d+):(\d+)(am|pm) ET', a)
        acts.append({'type': kind, 'name': txt(m.group(1)),
                     'pos': m.group(2).replace('D/ST', 'DEF'), 'nfl': m.group(3).strip('-'),
                     'week': int(w.group(1)) if w else 1,
                     'at': iso(dt) if dt else ''})
    if acts:
        first = min(a['at'][:10] for a in acts if a['at'])
        for a in acts:
            a['draft'] = a['type'] == 'add' and a['at'][:10] == first and a['week'] == 1
    results = {}
    for wk, opp, res in re.findall(
            r'tc-schedule-week">Week (\d+)</span>.*?<b><a [^>]*>(.*?)</a></b></span>'
            r'<span class="tc-schedule-score">(.*?)</span></div>', t, re.S):
        m = re.search(r'([\d.,]+)-([\d.,]+)', txt(res))
        if m:
            results[int(wk)] = {'opp': html.unescape(opp).strip(),
                                'pts': float(m.group(1).replace(',', '')),
                                'oppPts': float(m.group(2).replace(',', ''))}
    return {'name': name, 'wins': int(rec.group(1)), 'losses': int(rec.group(2)),
            'ties': int(rec.group(3) or 0),
            'pf': float(pf.group(1).replace(',', '')), 'thru': int(pf.group(2)),
            'week': int(cur.group(1)) if cur else None,
            'roster': roster, 'activity': acts, 'results': results}


def parse_schedule(pdf, names):
    out = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True,
                         check=True).stdout
    sched, cur = {}, None
    for line in out.splitlines():
        m = re.match(r'\s*Week (\d+) - NFL Week', line)
        if m:
            cur = int(m.group(1)); sched[cur] = []; continue
        if re.match(r'\s*Playoff Week', line):
            cur = None; continue
        m = re.match(r'\s*(.+?)\s{2,}vs\s{2,}(.+?)\s*$', line)
        if m and cur:
            a, b = m.group(1).strip(), m.group(2).strip()
            if a not in names or b not in names:
                sys.exit('schedule names a team no capsule has: %r vs %r' % (a, b))
            sched[cur].append([a, b])
    return sched


def main():
    d = sys.argv[1]
    pdf = sys.argv[2] if len(sys.argv) > 2 else None
    caps = {}
    for f in sorted(os.listdir(d)):
        if f.endswith('.html') and 'Capsule' in f:
            c = parse_capsule(os.path.join(d, f)); caps[c['name']] = c
    if len(caps) != 10:
        sys.exit('expected 10 capsules, found %d' % len(caps))
    names = set(caps)
    # every score must agree with the opposing capsule
    for n, c in caps.items():
        for w, r in c['results'].items():
            o = caps[r['opp']]['results'].get(w)
            if not o or o['opp'] != n or abs(o['pts'] - r['oppPts']) > .005 or abs(o['oppPts'] - r['pts']) > .005:
                sys.exit('score mismatch week %d %s vs %s' % (w, n, r['opp']))
        tot = round(sum(r['pts'] for r in c['results'].values()), 2)
        w_ = sum(1 for r in c['results'].values() if r['pts'] > r['oppPts'])
        if abs(tot - c['pf']) > .01 or w_ != c['wins']:
            sys.exit('%s: results sum %.2f / %d wins disagree with header %.2f / %d' % (n, tot, w_, c['pf'], c['wins']))
        if len(c['roster']) != 17:
            sys.exit('%s roster has %d players, expected 17' % (n, len(c['roster'])))
    sched = parse_schedule(pdf, names) if pdf else {}
    # a played week's pairings come from the results themselves, schedule PDF must agree
    for w, pairs in sched.items():
        for a, b in pairs:
            r = caps[a]['results'].get(w)
            if r and r['opp'] != b:
                sys.exit('schedule/results disagree week %d: %s vs %s (capsule says %s)' % (w, a, b, r['opp']))
    week = max(c['week'] or 0 for c in caps.values())
    snap = {'me': 'Shea', 'league': '5811 League', 'source': 'RTSports team capsules + 2026 schedule', 'week': week,
            'thru': max(c['thru'] for c in caps.values()),
            'teams': [caps[n] for n in sorted(caps)], 'schedule': {str(k): v for k, v in sched.items()}}
    out = os.path.join(os.path.dirname(__file__), '..', 'app', 'assets', 'leaguesnap.js')
    with open(out, 'w') as f:
        f.write('/* generated by tools/mkleaguesnap.py - do not edit */\n'
                'window.LEAGUE_SNAPSHOT=')
        json.dump(snap, f, separators=(',', ':'))
        f.write(';\n')
    print('wrote', os.path.normpath(out), 'weeks played through', snap['thru'], 'current week', week)
    for n in sorted(caps):
        c = caps[n]
        print('  %-14s %d-%d %8.2f  %d acts' % (n, c['wins'], c['losses'], c['pf'], len(c['activity'])))


main()
