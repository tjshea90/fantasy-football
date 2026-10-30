/* test_dialoglayer.js - Tj, 2026-10-30: the roster row "..." menu did not show on
 * the Roster tab (it appeared after switching tabs). Source-text pin for the
 * compositor hardening in dialog(); the failure itself only reproduces on the
 * device, so this proves the guard stays, not that the device bug is gone. */
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'assets', 'ui.js'), 'utf8');
let fail = 0;
function ok(c, m) { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) fail++; }
const i = src.indexOf('function dialog(title'), d = src.slice(i, i + 4200);
ok(/translateZ\(0\)/.test(d) && /will-change:transform/.test(d), 'dialog overlay gets its own compositor layer');
ok(/top:0;left:0;right:0;bottom:0;width:100%;height:100%/.test(d), 'dialog overlay has explicit edges, not only inset');
ok(/void back\.offsetHeight/.test(d) && /requestAnimationFrame/.test(d), 'dialog forces layout and a repaint after it is attached');
process.exit(fail ? 1 : 0);
