/* test_alertplan.js — the inactives alert's clock and wording (v8.7, Tj's
 * pick #9: "inactives alert: opt-in closed-app check ~75-85 min before
 * kickoff, warning if a starter is ruled OUT/doubtful"). ES2018-agnostic
 * (node).
 *
 * android/.../AlertPlan.java decides WHEN the closed-app check runs and WHAT
 * it says. It has no Android imports on purpose (the JsonSlim pattern), so
 * this compiles it with the desktop JDK and drives it through a real Sunday:
 *   - one alarm per distinct kickoff among his starters, in a 10-minute
 *     window 85..75 minutes out (after inactives, with an hour to swap);
 *   - a check covers only kickoffs whose inactives are already out (<= 90
 *     minutes away), so the 4:05 check does not pre-empt the 4:25 one;
 *   - a missed window is caught up at once, a finished kickoff is never
 *     checked twice, a failed fetch retries until there is no time to act;
 *   - Out / Doubtful / IR / suspended / PUP are named, Questionable is not;
 *   - the sentence names the player, his slot and the kickoff in his zone.
 * Then pins the Android half (Alerts.java, NativeBridge.java) that
 * build.sh compiles but no desktop test can run.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const JDIR = path.join(ROOT, 'android', 'src', 'com', 'tj', 'fftracker');
const SRC = path.join(JDIR, 'AlertPlan.java');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  OK   ' + m); } else { fail++; console.log('  FAIL ' + m); } }

let javac = true;
try { execFileSync('javac', ['-version'], { stdio: 'ignore' }); } catch (e) { javac = false; }
if (!javac) {
  console.log('  FAIL javac is not on PATH — cannot compile AlertPlan.java to test it');
  process.exit(1);
}
if (!fs.existsSync(SRC)) {
  console.log('  FAIL ' + path.relative(ROOT, SRC) + ' does not exist  <-- v8.6 had no inactives check');
  process.exit(1);
}

/* ---- the driver: every scenario, printed as OK/FAIL lines ---------------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alertplan-'));
const pkg = path.join(tmp, 'src', 'com', 'tj', 'fftracker');
fs.mkdirSync(pkg, { recursive: true });
fs.copyFileSync(SRC, path.join(pkg, 'AlertPlan.java'));
fs.writeFileSync(path.join(pkg, 'PlanMain.java'), String.raw`package com.tj.fftracker;
import java.util.TimeZone;
public class PlanMain {
  static int bad = 0;
  static void ok(boolean c, String m) { System.out.println((c ? "  OK   " : "  FAIL ") + m); if (!c) bad++; }
  static final long MIN = 60000L;
  public static void main(String[] a) throws Exception {
    TimeZone et = TimeZone.getTimeZone("America/New_York");
    /* Sunday 2026-09-27, Eastern: 1:00, 4:05, 4:25 and 8:20 PM */
    long K1 = 1790528400000L;                 /* 2026-09-27T17:00Z = 1:00 PM EDT */
    long K2 = K1 + 185 * MIN, K3 = K1 + 205 * MIN, K4 = K1 + 440 * MIN;
    ok(AlertPlan.clock(K1, et).equals("1:00 PM") && AlertPlan.clock(K2, et).equals("4:05 PM"),
       "fixture: K1 is 1:00 PM and K2 4:05 PM Eastern (" + AlertPlan.clock(K1, et) + ", " + AlertPlan.clock(K2, et) + ")");

    long[] ks = AlertPlan.parseKicks(K3 + "," + K1 + ", " + K1 + " ,x,,-5," + K2 + "," + K4);
    ok(ks.length == 4 && ks[0] == K1 && ks[1] == K2 && ks[2] == K3 && ks[3] == K4,
       "parseKicks: sorted, de-duplicated, garbage and non-positive entries dropped (" + ks.length + ")");
    ok(AlertPlan.parseKicks("").length == 0 && AlertPlan.parseKicks(null).length == 0, "an empty plan is no kickoffs");

    /* the morning: first alarm opens 85 minutes before the 1:00 slate */
    long now = K1 - 5 * 60 * MIN;
    long at = AlertPlan.nextAt(now, ks, 0, 0);
    ok(at == K1 - 85 * MIN, "8:00 AM: armed for 11:35, 85 minutes before the 1:00 kickoff (" + AlertPlan.clock(at, et) + ")");
    ok(AlertPlan.WINDOW_MS == 10 * MIN && at + AlertPlan.WINDOW_MS == K1 - 75 * MIN,
       "a 10-minute window: it fires between 85 and 75 minutes before kickoff");

    /* 11:39: the 1:00 check runs; it covers only the 1:00 games */
    now = K1 - 81 * MIN;
    ok(AlertPlan.covers(now, K1) && !AlertPlan.covers(now, K2), "the 11:39 check covers 1:00 and not 4:05");
    long done = AlertPlan.coveredThrough(now, ks);
    ok(done == K1, "after it, the 1:00 slate is done");
    at = AlertPlan.nextAt(now + 1000, ks, done, 0);
    ok(at == K2 - 85 * MIN, "the next alarm is 2:40 for the 4:05 game (" + AlertPlan.clock(at, et) + ")");

    /* 2:44: the 4:05 check must not name the 4:25 players — their inactives are not out */
    now = K2 - 81 * MIN;
    ok(AlertPlan.covers(now, K2) && !AlertPlan.covers(now, K3), "the 2:44 check covers 4:05 but not 4:25 (inactives due 2:55)");
    done = Math.max(done, AlertPlan.coveredThrough(now, ks));
    at = AlertPlan.nextAt(now + 1000, ks, done, 0);
    ok(at == K3 - 85 * MIN, "so 4:25 gets its own alarm at 3:00 (" + AlertPlan.clock(at, et) + ")");
    done = Math.max(done, AlertPlan.coveredThrough(K3 - 80 * MIN, ks));
    at = AlertPlan.nextAt(K3 - 80 * MIN + 1000, ks, done, 0);
    ok(at == K4 - 85 * MIN, "then the night game at 6:55 (" + AlertPlan.clock(at, et) + ")");
    done = Math.max(done, AlertPlan.coveredThrough(K4 - 80 * MIN, ks));
    ok(AlertPlan.nextAt(K4 - 79 * MIN, ks, done, 0) == 0, "and after that nothing is armed");

    /* a deferred alarm (Doze) arriving late still covers what is due, once */
    now = K2 - 60 * MIN;
    ok(AlertPlan.coveredThrough(now, ks) == K3, "a check delayed to 3:05 covers 4:05 AND 4:25 (both lists are out)");
    ok(AlertPlan.nextAt(now + 1000, ks, K3, 0) == K4 - 85 * MIN, "and 4:25 is not checked a second time");

    /* missed window: the app was left at 12:00 */
    now = K1 - 60 * MIN;
    at = AlertPlan.nextAt(now, ks, 0, 0);
    ok(at == now + AlertPlan.CATCH_UP_MS, "left the app at 12:00 (inside the window): checks in a minute, not never");
    now = K1 - 10 * MIN;
    ok(AlertPlan.nextAt(now, ks, 0, 0) == K2 - 85 * MIN, "at 12:50 the 1:00 games are too close to act on: skipped");

    /* a failed fetch holds and retries, but never past the point of acting */
    now = K1 - 80 * MIN;
    at = AlertPlan.nextAt(now, ks, 0, now + AlertPlan.RETRY_MS);
    ok(at == now + AlertPlan.RETRY_MS, "ESPN did not answer: retry in 10 minutes (" + AlertPlan.clock(at, et) + ")");
    at = AlertPlan.nextAt(K1 - 20 * MIN, ks, 0, K1 - 10 * MIN);
    ok(at == K2 - 85 * MIN, "a retry that would land inside 15 minutes of kickoff gives that kickoff up");

    /* statuses */
    ok(AlertPlan.ruledOut("Out") && AlertPlan.ruledOut("Doubtful") && AlertPlan.ruledOut("Injured Reserve")
       && AlertPlan.ruledOut("Suspension") && AlertPlan.ruledOut("Physically Unable to Perform") && AlertPlan.ruledOut("PUP"),
       "Out, Doubtful, IR, suspended and PUP are named");
    ok(!AlertPlan.ruledOut("Questionable") && !AlertPlan.ruledOut("Day-To-Day") && !AlertPlan.ruledOut("Active")
       && !AlertPlan.ruledOut("") && !AlertPlan.ruledOut(null),
       "Questionable, day-to-day, active and unknown are not (most questionable players play)");

    /* the sentence */
    String[] names = { "Saquon Barkley", "Mike Evans", "Josh Allen", "Travis Kelce" };
    String[] slots = { "RB1", "WR2", "QB", "TE" };
    long[] kick = { K1, K1, K1, K2 };
    String[] st = { "Out", "Questionable", "", "Out" };
    now = K1 - 80 * MIN;
    String msg = AlertPlan.message(now, 3, names, slots, kick, st, et);
    ok(msg.equals("Week 3, 1:00 PM kickoff: Saquon Barkley (RB1) is OUT. Change your lineup before kickoff."),
       "11:40: only the ruled-out 1:00 starter is named — " + msg);
    ok(AlertPlan.hits(now, kick, st).size() == 1 && AlertPlan.title(1).equals("A starter is out or doubtful"),
       "title for one: " + AlertPlan.title(1));
    st = new String[] { "Doubtful", "", "", "Out" };
    msg = AlertPlan.message(K2 - 60 * MIN, 3, names, slots, new long[] { K1, K1, K1, K3 },
                            new String[] { "Out", "Doubtful", "", "" }, et);
    ok(msg.equals(""), "a check at 3:05 does not re-report 1:00 games (they have kicked off): '" + msg + "'");
    msg = AlertPlan.message(K2 - 60 * MIN, 3, names, slots, new long[] { K2, K1, K1, K3 },
                            new String[] { "Doubtful", "", "", "Injured Reserve" }, et);
    ok(msg.equals("Week 3: Saquon Barkley (RB1) is DOUBTFUL (4:05 PM) · Travis Kelce (TE) is on injured reserve (4:25 PM). Change your lineup before kickoff."),
       "two kickoffs in one check: each player carries his own time — " + msg);
    ok(AlertPlan.title(2).equals("2 starters are out or doubtful"), "title for two: " + AlertPlan.title(2));
    ok(AlertPlan.message(now, 3, names, slots, kick, new String[] { "", "Questionable", "", "" }, et).equals(""),
       "nobody ruled out: no notification");
    System.exit(bad == 0 ? 0 : 1);
  }
}
`);
let out = '', rc = 0;
try {
  execFileSync('javac', ['-source', '8', '-target', '8', '-nowarn', '-encoding', 'UTF-8', '-d', path.join(tmp, 'cls'),
    path.join(pkg, 'AlertPlan.java'), path.join(pkg, 'PlanMain.java')], { stdio: 'pipe' });
  out = execFileSync('java', ['-Dstdout.encoding=UTF-8', '-Dfile.encoding=UTF-8', '-cp', path.join(tmp, 'cls'), 'com.tj.fftracker.PlanMain'], { encoding: 'utf8', stdio: 'pipe' });
} catch (e) {
  out = String((e.stdout || '')) + String((e.stderr || ''));
  rc = e.status || 1;
}
console.log('\n-- AlertPlan.java on the desktop JDK --');
out.split('\n').forEach((l) => {
  if (/^\s+OK\s/.test(l)) { pass++; console.log(l); }
  else if (/^\s+FAIL\s/.test(l)) { fail++; console.log(l); }
  else if (l.trim() && !/JAVA_TOOL_OPTIONS/.test(l)) console.log('  .. ' + l);
});
ok(rc === 0 && pass >= 25, 'the driver compiled and ran every scenario (exit ' + rc + ', ' + pass + ' checks)');
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { }

/* ---- the Android half: compiled by build.sh, pinned here ---------------- */
console.log('\n-- Alerts.java / NativeBridge.java wiring --');
const alerts = fs.readFileSync(path.join(JDIR, 'Alerts.java'), 'utf8');
const bridge = fs.readFileSync(path.join(JDIR, 'NativeBridge.java'), 'utf8');
const recv = alerts.slice(alerts.indexOf('public static class Receiver'), alerts.indexOf('/* ---- the check ---'));
ok(/if \(slot == SLOT_INACTIVES\) \{[\s\S]*?inactivesFired\(ctx\)[\s\S]*?finally \{\s*armInactives\(ctx\);[\s\S]*?pr\.finish\(\);[\s\S]*?return;/.test(recv),
   'the receiver sends slot 2 to inactivesFired and re-arms ONLY that alarm (never the daily ones inside their window)');
ok(recv.indexOf('SLOT_INACTIVES') < recv.indexOf('check(ctx, true)'), '... before the daily check could run for it');
const rearm = alerts.slice(alerts.indexOf('public static void rearm'), alerts.indexOf('static final int SLOT_INACTIVES'));
ok(rearm.indexOf('armInactives(ctx)') >= 0 && rearm.indexOf('armInactives(ctx)') < rearm.indexOf('if (!p.getBoolean("on", false)) return;'),
   'rearm() (launch, boot, update) arms the inactives check even when the daily check is off — its own switch');
ok(/p\.getBoolean\("inact", false\)/.test(alerts) && /AlertPlan\.nextAt\(/.test(alerts) && /setWindow\(AlarmManager\.RTC_WAKEUP, at, AlertPlan\.WINDOW_MS/.test(alerts),
   'armInactives: opt-in, planned by AlertPlan.nextAt, a setWindow alarm (no exact-alarm permission)');
ok(/static Map<String, String> fetchInjuries\(\) throws Exception/.test(alerts) && /inactHold", now \+ AlertPlan\.RETRY_MS/.test(alerts),
   'a failed injury fetch is told apart from "nobody is out", and retried');
ok(/AlertPlan\.message\(now, week,/.test(alerts) && /norm\(p\.optString\("name", ""\)\)/.test(alerts) && /postNote\(ctx, out\[0\], out\[1\], 7003\)/.test(alerts),
   'the check matches names with the same norm() as the daily check and posts its own notification (7003)');
ok(/@JavascriptInterface\s+public double alertsInactives\(boolean on\)/.test(bridge) &&
   /@JavascriptInterface\s+public double alertsKickoffs\(String csv\)/.test(bridge),
   'the bridge exposes alertsInactives(on) and alertsKickoffs(csv)');
ok(/\\"inact\\":/.test(bridge) && /\\"inactAt\\":/.test(bridge) && /\\"inactLast\\":/.test(bridge),
   'alertsStatus reports the switch, the next check and the last result');
const manifest = fs.readFileSync(path.join(ROOT, 'MANIFEST.txt'), 'utf8');
ok(/android\/src\/com\/tj\/fftracker\/AlertPlan\.java/.test(manifest) && /tools\/test_alertplan\.js/.test(manifest),
   'MANIFEST.txt lists AlertPlan.java and this test');

console.log('\n  ' + (fail ? fail + ' FAILED, ' : '') + pass + ' passed');
if (fail) { console.log('  alertplan checks FAILED'); process.exit(1); }
console.log('  alertplan checks pass');
