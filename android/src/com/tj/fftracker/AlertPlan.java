package com.tj.fftracker;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/**
 * THE INACTIVES CHECK'S CLOCK AND WORDING (v8.7, Tj's pick #9).
 *
 * NFL teams publish their inactives 90 minutes before kickoff, and ESPN's
 * injury report turns a game-time decision into "Out" at about the same
 * moment. The daily lineup check (Alerts.check) runs at fixed times of day, so
 * a starter ruled out at 11:30 on a Sunday was only caught if the morning
 * check happened to land after that — and a 4:25 game's inactives were never
 * caught with the app closed at all. This plans one extra check per kickoff
 * that involves one of his starters, in a ten-minute window 85..75 minutes
 * before it: after the inactives are out, with over an hour left to swap.
 *
 * PURE JAVA, NO ANDROID IMPORTS, on purpose — the same reason as JsonSlim:
 * tools/test_alertplan.js compiles this file with the desktop JDK and drives
 * every branch below, which a class full of AlarmManager calls could never
 * be. Alerts.java owns the Android half (the alarm, the injury fetch, the
 * notification) and asks this class every question that has a right answer.
 *
 * WHERE THE KICKOFFS COME FROM. The page (ui.js pushAlertPlan) hands Java a
 * comma-separated list of epoch-millisecond kickoffs — one per distinct game
 * time among the CURRENT week's starters, still to be played — every time the
 * app is backgrounded and the list changed. The whole 1:00 slate is one entry,
 * so a Sunday is typically three alarms, not ten.
 */
final class AlertPlan {
  private AlertPlan() { }

  /** Inactives are announced this long before kickoff. A check at `now`
   *  covers every kickoff at most this far away: its list is already out. */
  static final long INACTIVES_MS = 90L * 60000L;
  /** The alarm window opens this long before kickoff ... */
  static final long LEAD_MS = 85L * 60000L;
  /** ... and stays open this long (AlarmManager.setWindow), so it closes 75
   *  minutes out. A window, not an exact time: no special permission. */
  static final long WINDOW_MS = 10L * 60000L;
  /** Closer than this there is no time left to act — do not wake the phone. */
  static final long TOO_LATE_MS = 15L * 60000L;
  /** The planned window was missed (the app was backgrounded inside it, or
   *  the phone was off): check this soon instead of skipping the kickoff. */
  static final long CATCH_UP_MS = 60L * 1000L;
  /** The injury report did not answer: try again this much later. */
  static final long RETRY_MS = 10L * 60000L;

  /** "1757862000000,1757872800000" -> sorted, distinct, positive. Anything
   *  unreadable is skipped: a garbled entry must never invent an alarm. */
  static long[] parseKicks(String csv) {
    if (csv == null || csv.trim().isEmpty()) return new long[0];
    String[] parts = csv.split(",");
    List<Long> out = new ArrayList<Long>();
    for (String s : parts) {
      long v;
      try { v = Long.parseLong(s.trim()); } catch (NumberFormatException e) { continue; }
      if (v > 0 && !out.contains(v)) out.add(v);
    }
    long[] a = new long[out.size()];
    for (int i = 0; i < a.length; i++) a[i] = out.get(i);
    Arrays.sort(a);
    return a;
  }

  /**
   * When to arm the next check, or 0 for "nothing to arm".
   *   now       — the current time
   *   kicks     — parseKicks() output
   *   done      — the latest kickoff a finished check already covered
   *   notBefore — a retry hold after a failed fetch (0 = none)
   */
  static long nextAt(long now, long[] kicks, long done, long notBefore) {
    long best = 0;
    for (long k : kicks) {
      if (k <= done) continue;                  /* already checked */
      if (k - now < TOO_LATE_MS) continue;      /* started, or too close to act */
      long at = k - LEAD_MS;
      if (at <= now) at = now + CATCH_UP_MS;    /* missed its window: check soon */
      if (notBefore > at) at = notBefore;
      if (at > k - TOO_LATE_MS) continue;       /* a retry hold ran past it */
      if (best == 0 || at < best) best = at;
    }
    return best;
  }

  /** Does a check running at `now` cover this kickoff? */
  static boolean covers(long now, long kick) {
    return kick > now && kick - now <= INACTIVES_MS;
  }

  /** The latest kickoff a check at `now` covers (0 if none) — recorded as
   *  `done` so the same kickoff is never checked twice. */
  static long coveredThrough(long now, long[] kicks) {
    long m = 0;
    for (long k : kicks) if (covers(now, k) && k > m) m = k;
    return m;
  }

  /** An ESPN injury-report status that means he is not, or probably not,
   *  playing. Questionable is deliberately NOT here: most questionable
   *  players play, and an alert that is usually wrong gets ignored. */
  static boolean ruledOut(String status) {
    if (status == null) return false;
    String u = status.toUpperCase(Locale.US);
    return u.contains("OUT") || u.contains("INJURED RESERVE") || u.contains("SUSPEN")
        || u.contains("PUP") || u.contains("DOUBT");
  }

  static String word(String status) {
    String u = status == null ? "" : status.toUpperCase(Locale.US);
    if (u.contains("INJURED RESERVE")) return "on injured reserve";
    if (u.contains("SUSPEN")) return "SUSPENDED";
    if (u.contains("PUP")) return "on the PUP list";
    if (u.contains("DOUBT")) return "DOUBTFUL";
    if (u.contains("OUT")) return "OUT";
    return u;
  }

  static String clock(long t, TimeZone tz) {
    java.text.SimpleDateFormat f = new java.text.SimpleDateFormat("h:mm a", Locale.US);
    f.setTimeZone(tz == null ? TimeZone.getDefault() : tz);
    return f.format(new java.util.Date(t));
  }

  /**
   * The notification text, or "" when nobody due is ruled out.
   * Parallel arrays, one entry per STARTER (Alerts reads them from the saved
   * state); only starters whose kickoff this check covers are considered.
   */
  static String message(long now, int week, String[] names, String[] slots,
                        long[] kicks, String[] statuses, TimeZone tz) {
    List<Integer> hit = new ArrayList<Integer>();
    for (int i = 0; i < names.length; i++) {
      if (!covers(now, kicks[i])) continue;
      if (!ruledOut(statuses[i])) continue;
      hit.add(i);
    }
    if (hit.isEmpty()) return "";
    boolean oneKick = true;
    for (int i : hit) if (kicks[i] != kicks[hit.get(0)]) oneKick = false;
    StringBuilder sb = new StringBuilder();
    sb.append("Week ").append(week);
    if (oneKick) sb.append(", ").append(clock(kicks[hit.get(0)], tz)).append(" kickoff");
    sb.append(": ");
    for (int n = 0; n < hit.size(); n++) {
      int i = hit.get(n);
      if (n > 0) sb.append(" · ");
      sb.append(names[i]).append(" (").append(slots[i]).append(") is ").append(word(statuses[i]));
      if (!oneKick) sb.append(" (").append(clock(kicks[i], tz)).append(")");
    }
    sb.append(". Change your lineup before kickoff.");
    return sb.toString();
  }

  static String title(String message) {
    if (message == null || message.isEmpty()) return "";
    int n = 1, at = 0;
    while ((at = message.indexOf(" · ", at)) >= 0) { n++; at += 3; }
    return n == 1 ? "A starter is out or doubtful" : n + " starters are out or doubtful";
  }
}
