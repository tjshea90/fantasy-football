/* Guards the Android 10 / Chromium 77 constraint from BRIEF.md.
 * Strips comments and strings first, so prose about the rule is not a hit. */
var fs = require('fs');
var files = ['scoring.js','espn.js','store.js','ui.js','recommend.js','playerdb.js','players.js','seed.js',
             'projections.js','ai.js','usage.js','sim.js','value.js','recap.js'];
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
