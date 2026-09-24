package com.tj.fftracker;

import java.util.Set;

/** Copies a JSON text with every object member whose NAME is in `drop`
 *  removed, at any depth — without building the document.
 *
 *  WHY (full test, 2026-09-24). ESPN's /injuries feed is 8.76 MB of JSON, and
 *  8.76 MB of that is `athlete.links`: a dozen player-card/stats/news URLs per
 *  record that nothing in this app reads. The page used to receive all of it:
 *  46 synchronous 192 KB bridge round trips, a 17 MB string, and a JSON.parse
 *  measured at 45-145 ms on the JS thread at Moto G speed — every ten minutes
 *  the app is open, on every Advice sync, and on every "Ask Claude about the
 *  wire". Dropping `links` here, on the bridge's pool thread, leaves ~350 KB.
 *  Alerts.java's closed-app check parses the same feed with org.json and gets
 *  the same saving.
 *
 *  Deliberately a plain copier with no Android imports, so it can be compiled
 *  and tested with a desktop JDK against real feed records
 *  (tools/test_jsonslim.js). It only CUTS: every kept byte is copied verbatim
 *  from the input (string escapes, number spellings, whitespace inside
 *  values), so what the page parses is the original minus the dropped members.
 *  Malformed input throws IllegalArgumentException, and every caller falls
 *  back to the untouched body — a failure here can cost speed, never data. */
final class JsonSlim {
  private final CharSequence s;
  private final Set<String> drop;
  private final StringBuilder out;
  private final int n;
  private int i;

  private JsonSlim(CharSequence s, Set<String> drop) {
    this.s = s; this.drop = drop; this.n = s.length();
    this.out = new StringBuilder(Math.min(n, 1 << 20));
  }

  static String dropKeys(CharSequence json, Set<String> drop) {
    JsonSlim j = new JsonSlim(json, drop);
    j.ws();
    j.value(true);
    j.ws();
    if (j.i != j.n) throw j.err("trailing data");
    return j.out.toString();
  }

  /** The drop set from a comma-separated header value ("links, headshot"). */
  static Set<String> parseList(String v) {
    java.util.HashSet<String> out = new java.util.HashSet<String>();
    if (v == null) return out;
    for (String p : v.split(",")) {
      String t = p.trim();
      if (t.length() > 0) out.add(t);
    }
    return out;
  }

  private void ws() {
    while (i < n) {
      char c = s.charAt(i);
      if (c == ' ' || c == '\n' || c == '\r' || c == '\t') i++; else break;
    }
  }

  /** Copies (emit) or skips (!emit) exactly one value starting at i. */
  private void value(boolean emit) {
    if (i >= n) throw err("unexpected end");
    char c = s.charAt(i);
    if (c == '{') { object(emit); return; }
    if (c == '[') { array(emit); return; }
    int st = i;
    if (c == '"') skipString();
    else {
      /* a number, true, false or null: everything up to the next delimiter */
      while (i < n) {
        char d = s.charAt(i);
        if (d == ',' || d == '}' || d == ']' || d == ' ' || d == '\n' || d == '\r' || d == '\t') break;
        i++;
      }
      if (i == st) throw err("expected a value");
    }
    if (emit) out.append(s, st, i);
  }

  private void skipString() {
    i++;                                   /* the opening quote */
    while (i < n) {
      char c = s.charAt(i++);
      if (c == '\\') i++;                  /* whatever is escaped, including \" */
      else if (c == '"') return;
    }
    throw err("unterminated string");
  }

  private void object(boolean emit) {
    i++;
    if (emit) out.append('{');
    ws();
    if (i < n && s.charAt(i) == '}') { i++; if (emit) out.append('}'); return; }
    boolean first = true;
    for (;;) {
      ws();
      if (i >= n || s.charAt(i) != '"') throw err("expected a member name");
      int ns = i;
      skipString();
      int ne = i;
      /* raw, escapes not decoded: the names this is ever asked to drop are
         plain ASCII, and a name that only matches once decoded is kept */
      String name = s.subSequence(ns + 1, ne - 1).toString();
      ws();
      if (i >= n || s.charAt(i) != ':') throw err("expected ':'");
      i++;
      ws();
      boolean keep = emit && !drop.contains(name);
      if (keep) {
        if (!first) out.append(',');
        out.append(s, ns, ne).append(':');
        first = false;
      }
      value(keep);
      ws();
      if (i >= n) throw err("unterminated object");
      char c = s.charAt(i++);
      if (c == '}') { if (emit) out.append('}'); return; }
      if (c != ',') throw err("expected ',' or '}'");
    }
  }

  private void array(boolean emit) {
    i++;
    if (emit) out.append('[');
    ws();
    if (i < n && s.charAt(i) == ']') { i++; if (emit) out.append(']'); return; }
    boolean first = true;
    for (;;) {
      ws();
      if (emit && !first) out.append(',');
      value(emit);
      first = false;
      ws();
      if (i >= n) throw err("unterminated array");
      char c = s.charAt(i++);
      if (c == ']') { if (emit) out.append(']'); return; }
      if (c != ',') throw err("expected ',' or ']'");
    }
  }

  private IllegalArgumentException err(String m) {
    return new IllegalArgumentException("JsonSlim: " + m + " at " + i);
  }
}
