/* Guards the Android 10 / Chromium 77 constraint from BRIEF.md.
 * Strips comments and strings first, so prose about the rule is not a hit. */
var fs = require('fs');
/* DISCOVERED, NOT LISTED.
 *
 * This was a hard-coded array of fourteen filenames. schedule.js and handoff.js
 * were added in v4.5 and neither was ever checked — the guard reported "all
 * files ES2018-safe" while silently skipping the two newest files in the app,
 * which are exactly the ones most likely to carry a modern idiom.
 *
 * That is the same hole as v3.0's discarded javac exit status, v3.10's ship.sh
 * that never ran the tests, and the ckpt.sh suite list fixed earlier today: a
 * check that exists but is not wired to the thing it is meant to stop. Any new
 * .js file in app/assets is now checked by existing, with no step to remember. */
var dir = __dirname + '/../app/assets/';
var files = fs.readdirSync(dir).filter(function (f) {
  return /\.js$/.test(f);
}).sort();
var BAN = [
  [/[^=!<>+\-*/%&|^,(\[{;:\s]\s*\?\./, 'optional chaining ?.'],
  [/\?\?/, 'nullish coalescing ??'],
  [/\.at\s*\(/, 'Array.prototype.at'],
  [/structuredClone/, 'structuredClone'],
  [/Object\.fromEntries/, 'Object.fromEntries'],
  [/\.replaceAll\s*\(/, 'String.replaceAll'],
  [/globalThis/, 'globalThis'],
  [/#[A-Za-z_]\w*\s*[=;(]/, 'private class fields']
];
function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}
var fails = 0;
files.filter(function (f) {
  return fs.existsSync(__dirname + '/../app/assets/' + f);
}).forEach(function (f) {
  var p = 'app/assets/' + f;
  if (!fs.existsSync(p)) { console.log('  skip ' + f); return; }
  var raw = fs.readFileSync(p, 'utf8');
  try { new Function(raw); } catch (e) { console.log('  FAIL ' + f + ' SYNTAX: ' + e.message); fails++; return; }
  var code = strip(raw), hits = [];
  BAN.forEach(function (b) { if (b[0].test(code)) hits.push(b[1]); });
  if (hits.length) { console.log('  FAIL ' + f + ' uses ' + hits.join(', ')); fails++; }
  else console.log('  OK   ' + f);
});
console.log(fails ? ('  ' + fails + ' file(s) would break on Android 10') : '  all files ES2018-safe');
process.exit(fails ? 1 : 0);
