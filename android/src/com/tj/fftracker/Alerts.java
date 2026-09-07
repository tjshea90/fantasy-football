package com.tj.fftracker;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * THE ONE FEATURE THAT ACTUALLY SAVES POINTS.
 *
 * A starter who is ruled out on Sunday morning is worth zero, and the only
 * thing that catches it is something that speaks up before kickoff without
 * being opened. So this runs with the app closed.
 *
 * WHY THIS IS PURE JAVA AND NOT THE JS ENGINE.
 * The obvious design is to wake the WebView and let recommend.js do the
 * thinking, and it is the wrong one: starting a WebView from a background
 * broadcast is restricted differently on every Android version between 10 and
 * 16, and a feature that silently stops working on one of them is worse than
 * no feature. The check here is deliberately narrow enough to be certain:
 *   - who is in the starting lineup for the current week (from the saved state)
 *   - is any of them on a bye this week          (state)
 *   - is any of them OUT / IR / suspended        (ESPN's public injury feed)
 *   - is any starting slot empty                 (state)
 * That is the set of problems that are both certain and expensive. Anything
 * subtler is a judgement call, and judgement calls belong in the app where the
 * reasoning can be shown.
 *
 * NO EXACT ALARMS. setWindow, not setExactAndAllowWhileIdle: an exact alarm
 * needs a special permission on Android 12+ that the user has to grant in
 * Settings, and "check my lineup some time in this half hour" does not need
 * one. Nothing here asks for a permission the feature does not require.
 */
public class Alerts {

  public static final String CHANNEL = "lineup";
  public static final String ACTION = "com.tj.fftracker.CHECK_LINEUP";
  static final String PREFS = "fftracker_alerts";
  static final String STATE_FILE = "fftracker_state_v1";

  /* ---- scheduling ------------------------------------------------------ */

  /** dayOfWeek: Calendar.SUNDAY..SATURDAY. Fires at the next such day/time. */
  public static void schedule(Context ctx, int dayOfWeek, int hour, int minute, int slot) {
    AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;
    Calendar c = Calendar.getInstance();
    c.set(Calendar.HOUR_OF_DAY, hour);
    c.set(Calendar.MINUTE, minute);
    c.set(Calendar.SECOND, 0);
    c.set(Calendar.MILLISECOND, 0);
    while (c.get(Calendar.DAY_OF_WEEK) != dayOfWeek || c.getTimeInMillis() <= System.currentTimeMillis()) {
      c.add(Calendar.DAY_OF_YEAR, 1);
      c.set(Calendar.HOUR_OF_DAY, hour);
      c.set(Calendar.MINUTE, minute);
    }
    PendingIntent pi = intentFor(ctx, slot);
    /* a half-hour window: no special permission, and nothing about this needs
       to land on a particular second */
    am.setWindow(AlarmManager.RTC_WAKEUP, c.getTimeInMillis(), 30 * 60 * 1000L, pi);
  }

  public static void cancel(Context ctx, int slot) {
    AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
    if (am != null) am.cancel(intentFor(ctx, slot));
  }

  private static PendingIntent intentFor(Context ctx, int slot) {
    Intent i = new Intent(ctx, Receiver.class);
    i.setAction(ACTION);
    i.putExtra("slot", slot);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getBroadcast(ctx, 1000 + slot, i, flags);
  }

  /** Re-arm everything the settings say should be armed. */
  public static void rearm(Context ctx) {
    android.content.SharedPreferences p =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    if (!p.getBoolean("on", false)) return;
    int h = p.getInt("hour", 11), m = p.getInt("minute", 30);
    schedule(ctx, Calendar.SUNDAY, h, m, 0);            /* the early-window check */
    schedule(ctx, Calendar.THURSDAY, 16, 0, 1);         /* Thursday night, one day ahead */
  }

  /* ---- the receiver ---------------------------------------------------- */

  public static class Receiver extends BroadcastReceiver {
    @Override public void onReceive(final Context ctx, Intent intent) {
      if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())
          || "android.intent.action.MY_PACKAGE_REPLACED".equals(intent.getAction())) {
        rearm(ctx);
        return;
      }
      final int slot = intent.getIntExtra("slot", 0);
      /* goAsync keeps the receiver alive while a single HTTPS GET completes.
         It is not a licence to do minutes of work: if the feed is slow the
         check falls back to what the saved state alone can prove, which is
         still byes and empty slots. */
      final PendingResult pr = goAsync();
      new Thread(new Runnable() {
        public void run() {
          try {
            String msg = check(ctx, true);
            if (msg != null && msg.length() > 0) {
              postNote(ctx, "Check your lineup", msg, 7001);
            }
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
               .putLong("lastRun", System.currentTimeMillis())
               .putString("lastResult", msg == null || msg.length() == 0 ? "all clear" : msg)
               .apply();
          } catch (Throwable t) {
            android.util.Log.w("FFT", "alert check failed: " + t);
          } finally {
            rearm(ctx);          /* weekly, re-armed after every firing */
            pr.finish();
          }
        }
      }).start();
    }
  }

  /* ---- the check ------------------------------------------------------- */

  /** Returns the problem text, or "" when the lineup is clean. */
  /** ESPN kickoff timestamps, e.g. "2026-09-11T00:20Z". Returns 0 on anything
   *  it cannot read, and every caller treats 0 as "no information" rather than
   *  as a time — a misparsed kickoff must never invent or suppress an alert.
   *
   *  Instant.parse is deliberately not the first choice: ISO_INSTANT wants
   *  seconds, and ESPN routinely omits them. The seconds are normalised in
   *  before parsing instead of hoping. */
  static long parseIso(String s) {
    if (s == null) return 0;
    s = s.trim();
    if (s.length() < 16) return 0;
    try {
      // 2026-09-11T00:20Z -> 2026-09-11T00:20:00Z
      if (s.length() == 17 && s.endsWith("Z")) s = s.substring(0, 16) + ":00Z";
      java.text.SimpleDateFormat f =
          new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US);
      f.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
      String core = s.length() >= 19 ? s.substring(0, 19) : s;
      java.util.Date d = f.parse(core);
      return d == null ? 0 : d.getTime();
    } catch (Throwable t) {
      try { return java.time.Instant.parse(s).toEpochMilli(); }
      catch (Throwable t2) { return 0; }
    }
  }

  public static String check(Context ctx, boolean useNetwork) {
    String raw = readState(ctx);
    if (raw == null) return "";
    try {
      JSONObject S = new JSONObject(raw);
      JSONObject league = S.optJSONObject("league");
      JSONObject settings = S.optJSONObject("settings");
      if (league == null || settings == null) return "";
      String me = league.optString("me", "");
      int week = settings.optInt("currentWeek", 1);
      JSONObject byes = S.optJSONObject("byes");

      /* my roster, by player id */
      Map<String, JSONObject> byId = new HashMap<String, JSONObject>();
      JSONArray teams = S.optJSONArray("teams");
      if (teams == null) return "";
      for (int i = 0; i < teams.length(); i++) {
        JSONObject t = teams.optJSONObject(i);
        if (t == null || !me.equals(t.optString("id"))) continue;
        JSONArray ps = t.optJSONArray("players");
        for (int k = 0; ps != null && k < ps.length(); k++) {
          JSONObject p = ps.optJSONObject(k);
          if (p != null) byId.put(p.optString("id"), p);
        }
      }
      if (byId.isEmpty()) return "";

      JSONObject lw = S.optJSONObject("lineups");
      JSONObject wk = lw == null ? null : lw.optJSONObject(String.valueOf(week));
      JSONObject mine = wk == null ? null : wk.optJSONObject(me);

      List<String> problems = new ArrayList<String>();
      List<String> names = new ArrayList<String>();
      List<String> starters = new ArrayList<String>();
      String[] slots = { "QB", "RB1", "RB2", "WR1", "WR2", "WR3", "TE", "FLEX", "K", "DEF" };
      int filled = 0;
      if (mine != null) {
        java.util.Iterator<String> it = mine.keys();
        while (it.hasNext()) {
          String slot = it.next();
          String pid = mine.optString(slot, "");
          if (pid.length() == 0) continue;
          JSONObject p = byId.get(pid);
          if (p == null) continue;
          filled++;
          starters.add(slot);
          String nm = p.optString("name", "");
          names.add(nm);
          int bye = p.optInt("bye", 0);
          if (bye == 0 && byes != null) bye = byes.optInt(p.optString("nfl", ""), 0);
          if (bye == week) problems.add(nm + " (" + slot + ") is ON A BYE");
        }
      }
      if (filled == 0) return "";
      if (filled < slots.length) {
        problems.add((slots.length - filled) + " starting slot" +
            (slots.length - filled == 1 ? " is" : "s are") + " empty");
      }

      /* ---- games before Sunday (v4.3) -------------------------------------
       * Tj: "it should also give me alerts that are easy to see about players
       * on my roster that will be playing before the upcoming NFL Sunday, so I
       * don't forget to turn in my roster for those players which play early in
       * the week, usually on Thursday."
       *
       * The in-app banner covers him when he opens the app. This covers him
       * when he does not, which is the case he actually described.
       *
       * NO NETWORK IS NEEDED. schedule.js writes the week's kickoff times into
       * weekMeta[week].games in the same state file this method already reads,
       * precisely so the alarm can reason about them with no WebView. If the
       * page has never stored a schedule the block simply does nothing — a
       * missing kickoff must never manufacture an alert.
       *
       * Only players NOT already in the lineup are reported. Someone already
       * starting on Thursday is not a problem, and an alert that fires for a
       * lineup that is already correct is an alert that gets swiped away. */
      try {
        JSONObject wm = S.optJSONObject("weekMeta");
        JSONObject wmw = wm == null ? null : wm.optJSONObject(String.valueOf(week));
        JSONObject gs = wmw == null ? null : wmw.optJSONObject("games");
        if (gs != null) {
          java.util.HashSet<String> startingIds = new java.util.HashSet<String>();
          if (mine != null) {
            java.util.Iterator<String> si = mine.keys();
            while (si.hasNext()) startingIds.add(mine.optString(si.next(), ""));
          }
          long now = System.currentTimeMillis();
          List<String> early = new ArrayList<String>();
          long soonest = 0;
          for (JSONObject p : byId.values()) {
            if (p == null) continue;
            if (startingIds.contains(p.optString("id"))) continue;   // already in
            JSONObject g = gs.optJSONObject(p.optString("nfl", "").toUpperCase(java.util.Locale.US));
            if (g == null) continue;
            String state = g.optString("state", "pre");
            if (!"pre".equals(state)) continue;                       // started or done
            long kick = parseIso(g.optString("kick", ""));
            if (kick <= 0 || kick <= now) continue;                   // past, or unparseable
            java.util.Calendar c = java.util.Calendar.getInstance();  // the PHONE's zone
            c.setTimeInMillis(kick);
            int dow = c.get(java.util.Calendar.DAY_OF_WEEK);          // Sun=1 .. Sat=7
            // Tue(3) .. Sat(7) are before Sunday. Sunday and Monday are not.
            if (dow < java.util.Calendar.TUESDAY) continue;
            early.add(p.optString("name", "") + " (" + p.optString("pos", "") + ")");
            if (soonest == 0 || kick < soonest) soonest = kick;
          }
          if (!early.isEmpty()) {
            java.util.Calendar c = java.util.Calendar.getInstance();
            c.setTimeInMillis(soonest);
            String[] dn = { "", "Sunday", "Monday", "Tuesday", "Wednesday",
                            "Thursday", "Friday", "Saturday" };
            StringBuilder e = new StringBuilder();
            e.append(early.size() == 1 ? "1 player plays " : early.size() + " players play ");
            e.append("before Sunday and ").append(early.size() == 1 ? "is" : "are")
             .append(" NOT in your lineup: ");
            for (int i = 0; i < early.size() && i < 4; i++) {
              if (i > 0) e.append(", ");
              e.append(early.get(i));
            }
            if (early.size() > 4) e.append(" +").append(early.size() - 4).append(" more");
            e.append(" — first kickoff ").append(dn[c.get(java.util.Calendar.DAY_OF_WEEK)]);
            // put it FIRST: it is the only item here with a deadline attached
            problems.add(0, e.toString());
          }
        }
      } catch (Throwable t) { /* the other checks must still run */ }

      if (useNetwork) {
        Map<String, String> inj = injuries();
        for (int i = 0; i < names.size(); i++) {
          String st = inj.get(norm(names.get(i)));
          if (st == null) continue;
          String u = st.toUpperCase();
          if (u.contains("OUT") || u.contains("INJURED RESERVE") || u.contains("SUSPEND")
              || u.contains("PUP") || u.contains("DOUBT")) {
            problems.add(names.get(i) + " (" + starters.get(i) + ") is " + st);
          }
        }
      }
      if (problems.isEmpty()) return "";
      StringBuilder sb = new StringBuilder();
      sb.append("Week ").append(week).append(": ");
      for (int i = 0; i < problems.size(); i++) {
        if (i > 0) sb.append(" · ");
        sb.append(problems.get(i));
      }
      return sb.toString();
    } catch (Throwable t) {
      android.util.Log.w("FFT", "alert parse failed: " + t);
      return "";
    }
  }

  /** MUST match Espn.normName in espn.js character for character, or a
   *  starter who is out will quietly fail to match the injury feed and the
   *  alert that exists to catch exactly that will say nothing. */
  static String norm(String s) {
    if (s == null) return "";
    String t = s.toLowerCase();
    t = t.replaceAll("[.\'`]", "");
    t = t.replace('-', ' ');
    t = t.replaceAll("\\b(jr|sr|ii|iii|iv|v)\\b", "");
    t = t.replaceAll("\\s+", " ").trim();
    return t;
  }

  static Map<String, String> injuries() {
    Map<String, String> out = new HashMap<String, String>();
    HttpURLConnection c = null;
    try {
      URL u = new URL("https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries");
      c = (HttpURLConnection) u.openConnection();
      c.setConnectTimeout(6000);
      c.setReadTimeout(7000);
      c.setRequestProperty("Accept", "application/json");
      c.setRequestProperty("User-Agent", "Mozilla/5.0 (Android) FFTracker");
      InputStream in = c.getInputStream();
      BufferedReader r = new BufferedReader(new InputStreamReader(in, "UTF-8"), 16384);
      StringBuilder sb = new StringBuilder();
      char[] buf = new char[16384];
      int k;
      while ((k = r.read(buf)) > 0) sb.append(buf, 0, k);
      r.close();
      JSONObject j = new JSONObject(sb.toString());
      JSONArray groups = j.optJSONArray("injuries");
      for (int i = 0; groups != null && i < groups.length(); i++) {
        JSONObject g = groups.optJSONObject(i);
        JSONArray list = g == null ? null : g.optJSONArray("injuries");
        for (int m = 0; list != null && m < list.length(); m++) {
          JSONObject it = list.optJSONObject(m);
          if (it == null) continue;
          JSONObject ath = it.optJSONObject("athlete");
          String nm = ath == null ? "" : ath.optString("displayName", "");
          String st = it.optString("status", "");
          if (nm.length() > 0 && st.length() > 0) out.put(norm(nm), st);
        }
      }
    } catch (Throwable t) {
      android.util.Log.w("FFT", "injury fetch failed: " + t);
    } finally {
      if (c != null) c.disconnect();
    }
    return out;
  }

  static String readState(Context ctx) {
    String s = readFile(new File(ctx.getFilesDir(), STATE_FILE + ".json"));
    if (s == null || s.length() < 2) s = readFile(new File(ctx.getFilesDir(), STATE_FILE + ".bak"));
    return s;
  }
  private static String readFile(File f) {
    try {
      if (!f.exists()) return null;
      BufferedReader r = new BufferedReader(new InputStreamReader(new FileInputStream(f), "UTF-8"), 16384);
      StringBuilder sb = new StringBuilder();
      char[] buf = new char[16384];
      int k;
      while ((k = r.read(buf)) > 0) sb.append(buf, 0, k);
      r.close();
      return sb.toString();
    } catch (Exception e) { return null; }
  }

  /* ---- the notification ------------------------------------------------ */

  /* NOT called notify(). Inside the inner Receiver class an unqualified
   * notify(...) resolves against Object.notify() first, which is a compile
   * error that build.sh was swallowing — see BUILDLOG for what that cost. */
  public static void postNote(Context ctx, String title, String body, int id) {
    NotificationManager nm =
        (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) return;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel ch = new NotificationChannel(CHANNEL, "Lineup alerts",
          NotificationManager.IMPORTANCE_HIGH);
      ch.setDescription("Before kickoff, if a starter cannot play.");
      nm.createNotificationChannel(ch);
    }
    Intent open = new Intent(ctx, MainActivity.class);
    open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
    PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, flags);

    Notification.Builder b;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) b = new Notification.Builder(ctx, CHANNEL);
    else b = new Notification.Builder(ctx);
    b.setSmallIcon(android.R.drawable.stat_sys_warning)
     .setContentTitle(title)
     .setContentText(body)
     .setStyle(new Notification.BigTextStyle().bigText(body))
     .setAutoCancel(true)
     .setContentIntent(pi);
    nm.notify(id, b.build());
  }
}
