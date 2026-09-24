/* test_jsonslim.js — the Java bridge's JSON member cutter (full test,
 * 2026-09-24). ES2018-agnostic (node).
 *
 * ESPN's /injuries feed is 8.76 MB, 8.4 MB of it `athlete.links` that nothing
 * reads; the page used to pull all of it across the bridge and JSON.parse it
 * on its one JS thread every ten minutes. android/.../JsonSlim.java now cuts
 * those members on the bridge's pool thread. It has no Android imports on
 * purpose, so this compiles it with the desktop JDK (the same javac build.sh
 * uses) and checks it against:
 *   - real feed records (tools/fixtures/espn_injuries_sample.json): the output
 *     must parse to EXACTLY the input minus every `links` member, at any depth;
 *   - hand-built edge cases: escapes, a string VALUE "links", nesting inside a
 *     dropped member, first/middle/last/only member, empty containers,
 *     numbers and literals, whitespace;
 *   - malformed input, which must throw (every caller then falls back to the
 *     untouched body);
 * and pins the three call sites (NativeBridge, Alerts, recommend.js).
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'android', 'src', 'com', 'tj', 'fftracker', 'JsonSlim.java');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  OK   ' + m); } else { fail++; console.log('  FAIL ' + m); } }

function strip(o, drop) {
  if (Array.isArray(o)) return o.map((x) => strip(x, drop));
  if (o && typeof o === 'object') {
    const r = {};
    for (const k of Object.keys(o)) if (!drop.has(k)) r[k] = strip(o[k], drop);
    return r;
  }
  return o;
}
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* ---- compile JsonSlim + a tiny driver with the desktop JDK ---------------- */
let javac = true;
try { execFileSync('javac', ['-version'], { stdio: 'ignore' }); } catch (e) { javac = false; }
if (!javac) {
  /* build.sh needs javac too, so a machine without it cannot ship an APK
     either — but say so loudly rather than pass silently */
  console.log('  FAIL javac is not on PATH — cannot compile JsonSlim.java to test it');
  process.exit(1);
}
if (!fs.existsSync(SRC)) { console.log('  FAIL ' + SRC + ' does not exist'); process.exit(1); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonslim-'));
const pkg = path.join(tmp, 'src', 'com', 'tj', 'fftracker');
fs.mkdirSync(pkg, { recursive: true });
fs.copyFileSync(SRC, path.join(pkg, 'JsonSlim.java'));
fs.writeFileSync(path.join(pkg, 'SlimMain.java'), [
  'package com.tj.fftracker;',
  'import java.nio.file.*;',
  'import java.nio.charset.StandardCharsets;',
  'public class SlimMain {',
  '  public static void main(String[] a) throws Exception {',
  '    String in = new String(Files.readAllBytes(Paths.get(a[0])), StandardCharsets.UTF_8);',
  '    try {',
  '      String o = JsonSlim.dropKeys(new StringBuilder(in), JsonSlim.parseList(a[1]));',
  '      Files.write(Paths.get(a[2]), o.getBytes(StandardCharsets.UTF_8));',
  '    } catch (IllegalArgumentException e) {',
  '      System.out.println("ERR " + e.getMessage()); System.exit(2);',
  '    }',
  '  }',
  '}'].join('\n'));
const classes = path.join(tmp, 'classes');
fs.mkdirSync(classes);
try {
  /* -source/-target 8, exactly as build.sh compiles the app */
  execFileSync('javac', ['-source', '8', '-target', '8', '-nowarn', '-encoding', 'UTF-8', '-d', classes,
    path.join(pkg, 'JsonSlim.java'), path.join(pkg, 'SlimMain.java')], { stdio: 'pipe' });
  ok(true, 'JsonSlim.java compiles at -source 8 with no Android imports');
} catch (e) {
  ok(false, 'JsonSlim.java compiles: ' + String(e.stderr || e.message).slice(0, 400));
  process.exit(1);
}

let n = 0;
function slim(text, drop) {
  const i = path.join(tmp, 'in' + (++n) + '.json'), o = path.join(tmp, 'out' + n + '.json');
  fs.writeFileSync(i, text);
  try {
    execFileSync('java', ['-cp', classes, 'com.tj.fftracker.SlimMain', i, drop, o], { stdio: 'pipe' });
    return { out: fs.readFileSync(o, 'utf8') };
  } catch (e) {
    return { err: String(e.stdout || '') + String(e.stderr || ''), code: e.status };
  }
}

/* ---- 1. real ESPN records ------------------------------------------------ */
console.log('\n-- 1. real ESPN injury records --');
{
  const raw = fs.readFileSync(path.join(__dirname, 'fixtures', 'espn_injuries_sample.json'), 'utf8');
  const r = slim(raw, 'links');
  ok(!r.err, 'the real feed sample slims without error' + (r.err ? ': ' + r.err : ''));
  if (!r.err) {
    const want = strip(JSON.parse(raw), new Set(['links']));
    const got = JSON.parse(r.out);
    ok(same(got, want), 'parses to exactly the original minus every `links` member, at every depth');
    ok(r.out.indexOf('"links"') < 0, 'no `links` member survives anywhere');
    ok(r.out.length < raw.length * 0.6,
       'and it is much smaller: ' + raw.length + ' -> ' + r.out.length + ' chars');
    const it = got.injuries[0].injuries[0];
    ok(it.athlete && it.athlete.displayName && it.status !== undefined && it.details !== undefined,
       'everything loadNews reads is still there (displayName, status, details, comments)');
  }
}

/* ---- 2. edge cases ------------------------------------------------------- */
console.log('\n-- 2. edge cases --');
const CASES = [
  ['only member',            '{"links":[1,2]}'],
  ['first member',           '{"links":{"a":1},"b":2}'],
  ['middle member',          '{"a":1,"links":[{"x":"}"}],"b":2}'],
  ['last member',            '{"a":1,"links":"x"}'],
  ['two in a row',           '{"links":1,"links":2,"c":3}'],
  ['nested in arrays',       '[{"links":1,"k":[{"links":{"links":2},"v":null}]},[],{}]'],
  ['a string VALUE "links"', '{"rel":"links","t":["links"],"u":{"links":"links"}}'],
  ['escapes in strings',     '{"q":"a \\"quoted\\" \\\\ back\\\\slash \\u00e9 \\n","links":"he said \\"}\\""}'],
  ['numbers and literals',   '{"a":-1.5e+3,"b":0,"c":true,"d":false,"e":null,"links":1e-7,"f":12345678901234567890}'],
  ['whitespace everywhere',  ' {\n "a" : [ 1 , 2 ] ,\r\n\t"links" : { "z" : [ ] } , "b" : { } \n} '],
  ['non-ASCII text',         '{"n":"Ka\'imi Fairbairn — ñ ü 日本","links":["x"]}'],
  ['empty containers',       '{"a":{},"b":[],"links":{}}'],
  ['top-level array',        '[{"links":1},2,"x"]'],
  ['top-level scalar',       '"just a string"']
];
for (const [name, text] of CASES) {
  const r = slim(text, 'links');
  if (r.err) { ok(false, name + ': threw ' + r.err); continue; }
  let got, want;
  try { got = JSON.parse(r.out); } catch (e) { ok(false, name + ': output is not JSON: ' + r.out); continue; }
  want = strip(JSON.parse(text), new Set(['links']));
  ok(same(got, want), name + '  ->  ' + r.out.replace(/\s+/g, ' ').slice(0, 70));
}
{
  const r = slim('{"a":1,"headshot":{"h":2},"links":[3],"b":4}', 'links, headshot');
  ok(!r.err && same(JSON.parse(r.out), { a: 1, b: 4 }), 'a comma list drops several names ("links, headshot")');
}
{
  const txt = '{"big":12345678901234567890123,"f":1.10}';
  const r = slim(txt, 'links');
  ok(!r.err && r.out === txt, 'kept values are copied byte for byte (no number re-spelling): ' + r.out);
}

/* ---- 3. malformed input throws, so callers fall back to the raw body ------ */
console.log('\n-- 3. malformed input throws --');
for (const bad of ['{"a":1', '{"a" 1}', '{"a":"unterminated}', '[1,2', '{"a":1}}', '', '{a:1}']) {
  const r = slim(bad, 'links');
  ok(r.code === 2 && /^ERR /.test(r.err || ''), JSON.stringify(bad) + ' -> ' + (r.err || 'NO ERROR').trim().slice(0, 60));
}

/* ---- 4. the call sites --------------------------------------------------- */
console.log('\n-- 4. wired where the feed is read --');
{
  const nb = fs.readFileSync(path.join(ROOT, 'android', 'src', 'com', 'tj', 'fftracker', 'NativeBridge.java'), 'utf8');
  ok(/k\.startsWith\("X-FFT-"\)/.test(nb) && /X-FFT-Drop-Keys/.test(nb),
     'NativeBridge: X-FFT-* headers are instructions, never sent to the server');
  ok(/JsonSlim\.dropKeys\(sb, JsonSlim\.parseList\(dropKeys\)\)/.test(nb) &&
     /catch \(Throwable t\) \{ android\.util\.Log\.w\("FFT", "JsonSlim failed, sending the raw body/.test(nb),
     'NativeBridge: cuts on the pool thread, raw body on any failure');
  const al = fs.readFileSync(path.join(ROOT, 'android', 'src', 'com', 'tj', 'fftracker', 'Alerts.java'), 'utf8');
  ok(/JsonSlim\.dropKeys\(sb, JsonSlim\.parseList\("links"\)\)/.test(al) && /catch \(Throwable slimFail\) \{ body = sb\.toString\(\); \}/.test(al),
     'Alerts.java: the closed-app check slims before org.json, raw on failure');
  const rc = fs.readFileSync(path.join(ROOT, 'app', 'assets', 'recommend.js'), 'utf8');
  ok(/_httpGetH\(url, \{ 'X-FFT-Drop-Keys': 'links' \}\)/.test(rc),
     'recommend.js loadNews asks the bridge to drop `links`');
  ok(!/\.links\b/.test(rc.slice(rc.indexOf('function loadNews'), rc.indexOf('function health('))),
     'and loadNews reads nothing called links');
}

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* tmp */ }
console.log('\n  ' + (fail ? fail + ' FAILED, ' : '') + pass + ' passed');
if (fail) { console.log('  jsonslim checks FAILED'); process.exit(1); }
console.log('  jsonslim checks pass');
