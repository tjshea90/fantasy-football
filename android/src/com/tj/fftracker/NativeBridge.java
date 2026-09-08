package com.tj.fftracker;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.Executors;
import java.util.zip.GZIPInputStream;

/** The only way the page touches the outside world.
 *  A file:// origin cannot make cross-origin requests; doing it in Java
 *  sidesteps CORS entirely.
 *
 *  ASYNC IS NOT OPTIONAL HERE — v1.9 AND EARLIER FROZE THE APP.
 *  An @JavascriptInterface method does run on a binder thread rather than the
 *  UI thread, which is what the old comment here claimed made blocking IO
 *  "correct". That was wrong, and it cost two rounds of fixing the wrong layer.
 *  From JavaScript's point of view `Native.httpGet(url)` is an ORDINARY
 *  SYNCHRONOUS CALL: the renderer's JS thread blocks until Java returns. While
 *  it blocks, nothing in the page can run — no repaint, no progress bar, no
 *  button, no touch handler. A 40-second box-score fetch froze the UI for 40
 *  seconds, and the Anthropic call, which waits up to three minutes, looked
 *  exactly like a crash.
 *
 *  This is also why v1.5's fix did not work. Moving job state out of the screen
 *  and adding a progress bar cannot help when the thread that would paint the
 *  progress bar is the thread that is blocked.
 *
 *  So: httpAsync returns an id IMMEDIATELY, the work happens on a pool thread,
 *  and the page is notified through evaluateJavascript when the body is ready.
 *  The page then collects it with httpTake, which is only a memory copy.
 *  Nothing in the app may call the synchronous methods any more. */
public class NativeBridge {
  private final Context ctx;
  private WebView web;                 /* set by MainActivity after construction */
  private final ExecutorService pool = Executors.newFixedThreadPool(3);
  private final java.util.HashMap<String, String> results =
      new java.util.HashMap<String, String>();

  NativeBridge(Context c) { this.ctx = c; }

  /** MainActivity hands us the WebView so a finished request can wake the page. */
  void attach(WebView w) { this.web = w; }

  private void notifyPage(final String id) {
    final WebView w = web;
    if (w == null) return;
    w.post(new Runnable() { public void run() {
      try {
        w.evaluateJavascript("window.__httpDone&&window.__httpDone('" + id + "')", null);
      } catch (Throwable t) {
        android.util.Log.w("FFT", "notifyPage failed: " + t);
      }
    } });
  }

  /** Start a request. Returns its id at once; the page waits on __httpDone.
   *  body == null means GET. headersJson may be empty. */
  @JavascriptInterface
  public String httpAsync(final String urlStr, final String headersJson, final String body) {
    final String id;
    id = "r" + seq.incrementAndGet();
    try {
      pool.execute(new Runnable() { public void run() {
        String out;
        try {
          out = fetchBody(urlStr, headersJson, body);
        } catch (Throwable t) {
          // a pool thread must never die silently, or the page waits forever
          out = ERRMARK + t.getClass().getSimpleName() +
                (t.getMessage() != null ? ": " + t.getMessage() : "");
        }
        if (out == null) out = ERRMARK + "no response";
        synchronized (results) { results.put(id, out); }
        notifyPage(id);
      } });
    } catch (Throwable t) {
      synchronized (results) {
        results.put(id, ERRMARK + "could not start request: " + t);
      }
      notifyPage(id);
    }
    return id;
  }

  /** Collect a finished body. Chunked if large, exactly as before. */
  @JavascriptInterface
  public String httpTake(String id) {
    String b;
    synchronized (results) { b = results.remove(id); }
    if (b == null) return null;
    return chunkIfBig(b);
  }

  /** Drop a result the page gave up on, so a timed-out request cannot leak. */
  @JavascriptInterface
  public void httpForget(String id) {
    synchronized (results) { results.remove(id); }
  }

  /* A value returned from an @JavascriptInterface method crosses a binder
   * transaction, and a large one can fail or be dropped — which is exactly why
   * the Arizona roster kept failing while 31 others worked: it is simply the
   * biggest payload. Anything over the threshold is parked here and handed to
   * the page in pieces instead. */
  private static final int CHUNK_LIMIT = 192 * 1024;
  private static final String MARK = "\u0001CHUNKED\u0001";
  private static final String ERRMARK = "\u0001ERR\u0001";
  private final java.util.HashMap<String, String> bodies = new java.util.HashMap<String, String>();
  /* guarded by nothing on purpose: it is reached under two different
     locks (results and bodies), so it has to be atomic in its own right */
  private final AtomicInteger seq = new AtomicInteger(0);

  @JavascriptInterface
  public String httpChunk(String id, int off, int len) {
    String b;
    synchronized (bodies) { b = bodies.get(id); }
    if (b == null) return null;
    int end = Math.min(b.length(), off + len);
    if (off < 0 || off >= b.length()) return "";
    return b.substring(off, end);
  }

  @JavascriptInterface
  public void httpRelease(String id) {
    synchronized (bodies) { bodies.remove(id); }
  }

  /** @deprecated LEGACY, SYNCHRONOUS — freezes the page for the whole request.
   *  Kept only so an older asset bundle still runs. Nothing in the shipped app
   *  may call this; use httpAsync. */
  @JavascriptInterface
  public String httpGet(String urlStr) {
    String body = fetchBody(urlStr, null, null);
    if (body == null) return null;
    return chunkIfBig(body);
  }

  /** GET with extra request headers, supplied as a flat JSON object of
   *  string -> string. ESPN's fantasy projections endpoint returns only 50
   *  players without an X-Fantasy-Filter header, so plain httpGet cannot
   *  reach it at all. */
  @JavascriptInterface
  public String httpGetH(String urlStr, String headersJson) {
    String body = fetchBody(urlStr, headersJson, null);
    if (body == null) return null;
    return chunkIfBig(body);
  }

  /** POST a body with headers. Used only for the Anthropic Messages API, which
   *  is the app's optional AI reasoning path. No key is stored here — the page
   *  passes it per call from settings the user typed. */
  @JavascriptInterface
  public String httpPost(String urlStr, String headersJson, String body) {
    String out = fetchBody(urlStr, headersJson, body == null ? "" : body);
    if (out == null) return null;
    return chunkIfBig(out);
  }

  private String chunkIfBig(String body) {
    if (body.startsWith(ERRMARK)) return body;
    if (body.length() <= CHUNK_LIMIT) return body;
    String id;
    id = "b" + seq.incrementAndGet();
    synchronized (bodies) { bodies.put(id, body); }
    return MARK + id + "\u0001" + body.length();
  }

  /** Tiny flat-JSON object reader: {"a":"b","c":"d"}. Deliberately not a
   *  general parser — header maps are the only thing it ever sees, and this
   *  build takes no third-party dependencies. */
  private static void applyHeaders(HttpURLConnection c, String json) {
    if (json == null || json.length() < 2) return;
    int i = 0, n = json.length();
    while (i < n) {
      int ks = json.indexOf('"', i);
      if (ks < 0) return;
      int ke = ks + 1;
      StringBuilder key = new StringBuilder();
      while (ke < n && json.charAt(ke) != '"') {
        if (json.charAt(ke) == '\\' && ke + 1 < n) ke++;
        key.append(json.charAt(ke)); ke++;
      }
      int colon = json.indexOf(':', ke);
      if (colon < 0) return;
      int vs = json.indexOf('"', colon);
      if (vs < 0) return;
      int ve = vs + 1;
      StringBuilder val = new StringBuilder();
      while (ve < n && json.charAt(ve) != '"') {
        if (json.charAt(ve) == '\\' && ve + 1 < n) {
          ve++;
          char e = json.charAt(ve);
          if (e == 'n') { val.append('\n'); ve++; continue; }
          if (e == 't') { val.append('\t'); ve++; continue; }
        }
        val.append(json.charAt(ve)); ve++;
      }
      if (key.length() > 0) c.setRequestProperty(key.toString(), val.toString());
      i = ve + 1;
    }
  }

  /* One automatic retry, but ONLY when the first attempt read nothing at all.
   * "unexpected end of stream" is Android's HttpURLConnection reporting that
   * the peer closed the connection early — most often a stale pooled keep-alive
   * socket, or a carrier killing a connection that has been idle. A retry is
   * safe here precisely because zero bytes came back: there is no risk of
   * acting on, or paying for, a call that actually succeeded. */
  private String fetchBody(String urlStr, String headersJson, String postBody) {
    String first = fetchOnce(urlStr, headersJson, postBody);
    if (first != null && first.startsWith(ERRMARK) && postBody != null
        && first.indexOf("end of stream") >= 0) {
      android.util.Log.w("FFT", "retrying POST after early close");
      try { Thread.sleep(700); } catch (InterruptedException ie) { /* fine */ }
      String second = fetchOnce(urlStr, headersJson, postBody);
      if (second != null && !second.startsWith(ERRMARK)) return second;
      if (second != null) return second + "  (retried once)";
    }
    return first;
  }

  private String fetchOnce(String urlStr, String headersJson, String postBody) {
    HttpURLConnection c = null;
    try {
      URL u = new URL(urlStr);
      if (!"https".equalsIgnoreCase(u.getProtocol())) return ERRMARK + "not https";
      c = (HttpURLConnection) u.openConnection();
      c.setRequestMethod(postBody == null ? "GET" : "POST");
      c.setConnectTimeout(15000);
      /* an Anthropic call with web search enabled legitimately takes a while */
      c.setReadTimeout(postBody == null ? 40000 : 180000);
      c.setInstanceFollowRedirects(true);
      c.setRequestProperty("Accept", "application/json");
      c.setRequestProperty("User-Agent", "FFTracker/1.0 (Android)");
      if (postBody == null) {
        c.setRequestProperty("Accept-Encoding", "gzip");
      } else {
        /* No gzip and no keep-alive on POST. The Anthropic call streams Server-
         * Sent Events for a minute or more; compression buffers that stream,
         * and a REUSED pooled socket is the classic source of "unexpected end
         * of stream" on Android's HttpURLConnection. Both cost nothing here —
         * there is exactly one POST per sync. */
        c.setRequestProperty("Accept-Encoding", "identity");
        c.setRequestProperty("Connection", "close");
      }
      applyHeaders(c, headersJson);
      if (postBody != null) {
        c.setDoOutput(true);
        if (c.getRequestProperty("Content-Type") == null) {
          c.setRequestProperty("Content-Type", "application/json");
        }
        byte[] payload = postBody.getBytes("UTF-8");
        c.setFixedLengthStreamingMode(payload.length);
        OutputStream os = c.getOutputStream();
        os.write(payload);
        os.flush();
        os.close();
      }
      int code = c.getResponseCode();
      InputStream in = (code >= 400) ? c.getErrorStream() : c.getInputStream();
      if (in == null) return null;
      String enc = c.getContentEncoding();
      if (enc != null && enc.toLowerCase().contains("gzip")) in = new GZIPInputStream(in);
      StringBuilder sb = new StringBuilder();
      BufferedReader r = new BufferedReader(new InputStreamReader(in, "UTF-8"), 16384);
      char[] buf = new char[16384];
      int n;
      while ((n = r.read(buf)) > 0) sb.append(buf, 0, n);
      r.close();
      if (code >= 400) {
        // the body of a 4xx is the entire diagnosis (bad key, bad model, rate
        // limit). Returning only the number cost two builds last time.
        String det = sb.toString().replace('\n', ' ');
        if (det.length() > 400) det = det.substring(0, 400);
        return ERRMARK + "HTTP " + code + (det.length() > 0 ? " " + det : "");
      }
      return sb.toString();
    } catch (Exception e) {
      android.util.Log.w("FFT", "httpGet failed: " + e);
      // hand the reason to the page: a silent null told us nothing for two builds
      String m = e.getClass().getSimpleName();
      if (e.getMessage() != null) m += ": " + e.getMessage();
      return ERRMARK + m;
    } finally {
      if (c != null) c.disconnect();
    }
  }

  /** Is there a usable connection right now? The page uses this to tell
   *  "you are offline" apart from "the feed is broken", which are the same
   *  exception at the socket and very different sentences to read. */
  @JavascriptInterface
  public boolean online() {
    try {
      android.net.ConnectivityManager cm = (android.net.ConnectivityManager)
          ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
      if (cm == null) return true;          /* unknown: do not cry wolf */
      if (Build.VERSION.SDK_INT >= 23) {
        android.net.Network n = cm.getActiveNetwork();
        if (n == null) return false;
        android.net.NetworkCapabilities c = cm.getNetworkCapabilities(n);
        return c != null && c.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET);
      }
      android.net.NetworkInfo i = cm.getActiveNetworkInfo();
      return i != null && i.isConnected();
    } catch (Throwable t) { return true; }
  }

  /** Hand a block of text to the system share sheet — the league chat is on
   *  another app, and a recap nobody can send is a recap nobody reads. */
  @JavascriptInterface
  public boolean share(String text) {
    try {
      Intent i = new Intent(Intent.ACTION_SEND);
      i.setType("text/plain");
      i.putExtra(Intent.EXTRA_TEXT, text);
      Intent chooser = Intent.createChooser(i, "Send recap");
      chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      ctx.startActivity(chooser);
      return true;
    } catch (Throwable t) {
      android.util.Log.w("FFT", "share failed: " + t);
      return false;
    }
  }

  @JavascriptInterface
  public boolean copy(String text) {
    try {
      android.content.ClipboardManager cm = (android.content.ClipboardManager)
          ctx.getSystemService(Context.CLIPBOARD_SERVICE);
      if (cm == null) return false;
      cm.setPrimaryClip(android.content.ClipData.newPlainText("recap", text));
      return true;
    } catch (Throwable t) { return false; }
  }

  /* ---- lineup alerts (v2.7) ---------------------------------------------
   * The page owns the settings; Java owns the clock, the notification and the
   * check that has to run with the app closed. See Alerts.java for why that
   * check is pure Java rather than a woken-up WebView. */
  @JavascriptInterface
  public boolean alertsSet(boolean on, int hour, int minute) {
    try {
      ctx.getSharedPreferences(Alerts.PREFS, Context.MODE_PRIVATE).edit()
         .putBoolean("on", on).putInt("hour", hour).putInt("minute", minute).apply();
      Alerts.cancel(ctx, 0);
      Alerts.cancel(ctx, 1);
      if (on) Alerts.rearm(ctx);
      return true;
    } catch (Throwable t) {
      android.util.Log.w("FFT", "alertsSet failed: " + t);
      return false;
    }
  }

  /** What the alarm found last time it ran, so the app can show it. */
  @JavascriptInterface
  public String alertsStatus() {
    try {
      android.content.SharedPreferences p =
          ctx.getSharedPreferences(Alerts.PREFS, Context.MODE_PRIVATE);
      return "{\"on\":" + p.getBoolean("on", false) +
             ",\"hour\":" + p.getInt("hour", 11) +
             ",\"minute\":" + p.getInt("minute", 30) +
             ",\"lastRun\":" + p.getLong("lastRun", 0) +
             ",\"lastResult\":" + org.json.JSONObject.quote(p.getString("lastResult", "")) + "}";
    } catch (Throwable t) { return "{}"; }
  }

  /** Run the real check now and post the real notification — the only way to
   *  prove on the phone that the whole path works without waiting for Sunday. */
  @JavascriptInterface
  public String alertsTest() {
    try {
      String msg = Alerts.check(ctx, true);
      if (msg == null || msg.length() == 0) {
        Alerts.postNote(ctx, "Lineup looks fine", "No bye, no OUT starter, no empty slot.", 7002);
        return "all clear — a notification was posted anyway so you can see it works";
      }
      Alerts.postNote(ctx, "Check your lineup", msg, 7002);
      return msg;
    } catch (Throwable t) { return "failed: " + t; }
  }

  /** Falls back to the .bak if the main file is missing or unreadable. */
  @JavascriptInterface
  public String load(String name) {
    String s = readFile(new File(ctx.getFilesDir(), safe(name) + ".json"));
    if (s == null || s.length() < 2) s = readFile(new File(ctx.getFilesDir(), safe(name) + ".bak"));
    return s;
  }

  private String readFile(File f) {
    try {
      if (!f.exists()) return null;
      InputStream in = new java.io.FileInputStream(f);
      StringBuilder sb = new StringBuilder();
      BufferedReader r = new BufferedReader(new InputStreamReader(in, "UTF-8"), 16384);
      char[] buf = new char[16384];
      int k;
      while ((k = r.read(buf)) > 0) sb.append(buf, 0, k);
      r.close();
      return sb.toString();
    } catch (Exception e) { return null; }
  }

  @JavascriptInterface
  public boolean save(String name, String data) {
    try {
      // write to a temp file then rename, so a crash mid-write cannot corrupt state
      File dir = ctx.getFilesDir();
      File tmp = new File(dir, safe(name) + ".tmp");
      File dst = new File(dir, safe(name) + ".json");
      FileOutputStream o = new FileOutputStream(tmp);
      o.write(data.getBytes("UTF-8"));
      o.getFD().sync();
      o.close();
      // keep the previous good copy: a corrupt write must not lose the season
      if (dst.exists()) {
        File bak = new File(dir, safe(name) + ".bak");
        if (bak.exists()) bak.delete();
        dst.renameTo(bak);
      }
      return tmp.renameTo(dst);
    } catch (Exception e) {
      android.util.Log.w("FFT", "save failed: " + e);
      return false;
    }
  }

  /* ---- invisible auto-backups (v4.2) -------------------------------
   * Auto-backups used to go through export() into Downloads via MediaStore —
   * every 10 edits and after every sync, forever, with nothing ever removed.
   * Tj's Downloads folder was filling up with files he never asked to see.
   * These now live in app-private storage instead: no MediaStore entry, not
   * visible to any file manager or Downloads app, gone if the app is
   * uninstalled. That last part is a real tradeoff against the old
   * survives-an-uninstall guarantee, but Tj asked for invisible, not for
   * uninstall-survival, and the explicit "Export backup" button below still
   * writes a visible, shareable copy to Downloads on request.
   * Rotation: each snapshot is its own timestamped file, and only once a new
   * one has finished writing AND been renamed into place do the oldest ones
   * past AUTO_BACKUP_KEEP get deleted — a failed write never costs a good
   * backup, because pruneBackups() is only ever reached after success. */
  private static final int AUTO_BACKUP_KEEP = 8;

  private File backupDir() {
    File d = new File(ctx.getFilesDir(), "backups");
    if (!d.exists()) d.mkdirs();
    return d;
  }

  /** Silent full-state snapshot. `data` is the entire app state as JSON —
   *  every team, lineup, weekly matchup, stat line and transaction — the same
   *  object the manual export and the on-disk save both use, so an auto-
   *  backup is never a partial copy. */
  @JavascriptInterface
  public boolean backupAuto(String data) {
    try {
      File dir = backupDir();
      String fn = "auto-" + System.currentTimeMillis() + ".json";
      File tmp = new File(dir, fn + ".tmp");
      File dst = new File(dir, fn);
      FileOutputStream o = new FileOutputStream(tmp);
      o.write(data.getBytes("UTF-8"));
      o.getFD().sync();
      o.close();
      if (!tmp.renameTo(dst)) return false;
      pruneBackups(dir);
      return true;
    } catch (Exception e) {
      android.util.Log.w("FFT", "backupAuto failed: " + e);
      return false;
    }
  }

  private void pruneBackups(File dir) {
    try {
      File[] files = dir.listFiles(new java.io.FilenameFilter() {
        public boolean accept(File d, String name) {
          return name.startsWith("auto-") && name.endsWith(".json");
        }
      });
      if (files == null || files.length <= AUTO_BACKUP_KEEP) return;
      java.util.Arrays.sort(files, new java.util.Comparator<File>() {
        public int compare(File a, File b) {
          return Long.valueOf(a.lastModified()).compareTo(b.lastModified());
        }
      });
      int extra = files.length - AUTO_BACKUP_KEEP;
      for (int i = 0; i < extra; i++) files[i].delete();
    } catch (Throwable t) {
      android.util.Log.w("FFT", "pruneBackups failed: " + t);
    }
  }

  /** Newest-first listing of the invisible auto-backups, for the in-app
   *  restore picker — the only way to reach them now that they no longer
   *  land in Downloads where Tj could just look. */
  @JavascriptInterface
  public String backupList() {
    try {
      File[] files = backupDir().listFiles(new java.io.FilenameFilter() {
        public boolean accept(File d, String name) {
          return name.startsWith("auto-") && name.endsWith(".json");
        }
      });
      if (files == null) return "[]";
      java.util.Arrays.sort(files, new java.util.Comparator<File>() {
        public int compare(File a, File b) {
          return Long.valueOf(b.lastModified()).compareTo(a.lastModified());
        }
      });
      StringBuilder sb = new StringBuilder("[");
      for (int i = 0; i < files.length; i++) {
        if (i > 0) sb.append(',');
        sb.append("{\"name\":").append(org.json.JSONObject.quote(files[i].getName()))
          .append(",\"mtime\":").append(files[i].lastModified())
          .append(",\"size\":").append(files[i].length()).append('}');
      }
      sb.append(']');
      return sb.toString();
    } catch (Throwable t) { return "[]"; }
  }

  /** Reads one auto-backup by the exact name backupList() handed back. */
  @JavascriptInterface
  public String backupLoad(String name) {
    return readFile(new File(backupDir(), safe(name)));
  }

  /** Backup out to Downloads so it survives an uninstall. Now used only by
   *  the explicit "Export backup" button — a Tj-initiated copy he can see,
   *  share or move, unlike the invisible auto-backups above. */
  @JavascriptInterface
  public boolean export(String filename, String data) {
    try {
      String fn = safe(filename.replace(".json", "")) + ".json";
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ContentValues v = new ContentValues();
        v.put(MediaStore.MediaColumns.DISPLAY_NAME, fn);
        v.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
        v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        Uri uri = ctx.getContentResolver().insert(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
        if (uri == null) return false;
        OutputStream o = ctx.getContentResolver().openOutputStream(uri);
        if (o == null) return false;
        o.write(data.getBytes("UTF-8"));
        o.close();
        return true;
      }
      File d = new File(Environment.getExternalStoragePublicDirectory(
          Environment.DIRECTORY_DOWNLOADS), fn);
      FileOutputStream o = new FileOutputStream(d);
      o.write(data.getBytes("UTF-8"));
      o.close();
      return true;
    } catch (Exception e) {
      android.util.Log.w("FFT", "export failed: " + e);
      return false;
    }
  }

  /* ---- the offline Claude round trip (v4.5) -------------------------------
   * Tj's flow is: export here, attach the file in a Claude chat, get a file
   * back, import it here. Both halves happen on a phone, so both halves have
   * to be one tap.
   *
   * OUT: `exportShare` writes the file and then hands it straight to the
   * Android share sheet, so "Send to Claude" is a tap rather than a trip
   * through a file manager. It deliberately does NOT need a FileProvider —
   * the MediaStore Downloads Uri from the insert is already shareable once the
   * read permission is granted on the intent, and adding a provider would mean
   * a manifest entry, an XML paths file, and a new way for the build to break.
   * The file is left in Downloads on purpose: if the share sheet is dismissed
   * or the target app cannot take it, it is still there to attach by hand.
   *
   * IN: the picker lives in MainActivity, because only an Activity can start
   * one for a result. This is a thin forwarder. */
  @JavascriptInterface
  public boolean exportShare(String filename, String data, String mime) {
    try {
      String m = (mime == null || mime.length() == 0) ? "text/plain" : mime;
      Uri uri = writeToDownloads(filename, data, m);
      if (uri == null) return false;
      Intent send = new Intent(Intent.ACTION_SEND);
      send.setType(m);
      send.putExtra(Intent.EXTRA_STREAM, uri);
      send.putExtra(Intent.EXTRA_SUBJECT, filename);
      send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      /* THE GRANT HAS TO SURVIVE THE CHOOSER.
       * A flag on the SEND intent alone is not reliably enough to let the app
       * the user picks actually read the Uri: the system propagates a URI grant
       * through a chooser from the intent's ClipData, and without one the
       * target can be handed a Uri it is not permitted to open. The failure is
       * silent on our side and shows up in the other app as "cannot open file",
       * which is the worst possible place for it — this is the one path where
       * the whole feature is someone else reading our file. Setting ClipData
       * and repeating the flag on the chooser is the belt-and-braces form and
       * costs nothing. */
      try {
        send.setClipData(android.content.ClipData.newRawUri(filename, uri));
      } catch (Throwable t) { /* older shell: the flag above still applies */ }
      Intent chooser = Intent.createChooser(send, "Send to Claude");
      chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      ctx.startActivity(chooser);
      return true;
    } catch (Exception e) {
      android.util.Log.w("FFT", "exportShare failed: " + e);
      return false;
    }
  }

  /** Write a file of any type to Downloads and return its Uri. `export` above
   *  is the json-only special case kept for the existing backup path. */
  private Uri writeToDownloads(String filename, String data, String mime) throws Exception {
    String fn = safe(filename);
    if (fn.length() == 0) fn = "fftracker.txt";
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ContentValues v = new ContentValues();
      v.put(MediaStore.MediaColumns.DISPLAY_NAME, fn);
      v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
      v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
      Uri uri = ctx.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
      if (uri == null) return null;
      OutputStream o = ctx.getContentResolver().openOutputStream(uri);
      if (o == null) return null;
      o.write(data.getBytes("UTF-8"));
      o.close();
      return uri;
    }
    File d = new File(Environment.getExternalStoragePublicDirectory(
        Environment.DIRECTORY_DOWNLOADS), fn);
    FileOutputStream o = new FileOutputStream(d);
    o.write(data.getBytes("UTF-8"));
    o.close();
    return Uri.fromFile(d);
  }

  /** Write a file of any type to Downloads. Returns true on success. */
  @JavascriptInterface
  public boolean exportFile(String filename, String data, String mime) {
    try {
      return writeToDownloads(filename, data,
          (mime == null || mime.length() == 0) ? "text/plain" : mime) != null;
    } catch (Exception e) {
      android.util.Log.w("FFT", "exportFile failed: " + e);
      return false;
    }
  }

  /** Open the system file picker. The chosen file's TEXT comes back to the
   *  page through window.__filePicked(text) — see MainActivity. Returns false
   *  if no Activity is attached, so the page can fall back to paste. */
  @JavascriptInterface
  public boolean pickFile() {
    try {
      if (!(ctx instanceof MainActivity)) return false;
      ((MainActivity) ctx).openDocument();
      return true;
    } catch (Exception e) {
      android.util.Log.w("FFT", "pickFile failed: " + e);
      return false;
    }
  }

  @JavascriptInterface
  public String deviceInfo() {
    return "{\"sdk\":" + Build.VERSION.SDK_INT + ",\"abi\":\"" +
        (Build.SUPPORTED_ABIS.length > 0 ? Build.SUPPORTED_ABIS[0] : "?") +
        "\",\"model\":\"" + Build.MODEL.replace('"', ' ') + "\"}";
  }

  private static String safe(String s) { return s.replaceAll("[^A-Za-z0-9_.-]", "_"); }
}
