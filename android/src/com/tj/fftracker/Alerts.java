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
