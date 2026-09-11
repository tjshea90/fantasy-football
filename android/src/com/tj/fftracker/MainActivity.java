package com.tj.fftracker;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.graphics.Insets;
import android.os.Build;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Thin shell. All product logic lives in assets/*.js so it can be iterated
 *  without touching Java. No native libraries: one APK for every ABI. */
public class MainActivity extends Activity {
  private WebView web;
  private int insetTop, insetBottom, insetLeft, insetRight;
  private boolean pageReady = false;

  /** CSS px = device px / density. Sent to the page, which pads itself. */
  private void pushInsets() {
    if (web == null || !pageReady) return;
    final float d = getResources().getDisplayMetrics().density;
    final String js = "window.__setInsets&&window.__setInsets("
        + (insetTop / d) + "," + (insetRight / d) + ","
        + (insetBottom / d) + "," + (insetLeft / d) + ")";
    web.post(new Runnable() { public void run() { web.evaluateJavascript(js, null); } });
  }

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    web = new WebView(this);
    web.setLayoutParams(new ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setAllowFileAccess(true);
    // OFF, deliberately. These were on "in case a future file:// read needs
    // them" — and the comment beside them already said the data ships as
    // seed.js, so nothing has needed them for many versions. What they cost is
    // real: setAllowUniversalAccessFromFileURLs lets anything running in this
    // page read any origin, in a WebView that also holds the Native bridge and
    // renders text from ESPN, from Claude replies and from files the user
    // picks. Two error paths concatenated straight into innerHTML until v4.7
    // (index.html's onerror and ui.js's fatal fallback) — and NativeBridge puts
    // 400 characters of an HTTP error BODY into that message. Narrow, but it
    // was script injection into the most privileged page on the phone, for a
    // capability nothing uses. Both are now escaped AND these are off.
    s.setAllowFileAccessFromFileURLs(false);
    s.setAllowUniversalAccessFromFileURLs(false);
    s.setCacheMode(WebSettings.LOAD_DEFAULT);
    // Honour the phone's display-size setting. This was pinned at 100, which
    // threw away the accessibility preference entirely — and the CSS runs down
    // to 11px in places, so somebody who has made their system text larger got
    // none of it. configChanges already lists fontScale, so the value arrives;
    // it was simply discarded. Clamped: the layout is a fixed-height tab bar
    // and dense tables, and past ~130% the rows stop fitting.
    int zoom = 100;
    try {
      float fs = getResources().getConfiguration().fontScale;
      if (fs > 0) zoom = Math.max(85, Math.min(130, Math.round(fs * 100)));
    } catch (Throwable t) { zoom = 100; }
    s.setTextZoom(zoom);
    web.setWebViewClient(new WebViewClient() {
      @Override public void onPageFinished(WebView v, String url) {
        pageReady = true;
        pushInsets();          // the page only exists now; re-send what we have
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public boolean onConsoleMessage(ConsoleMessage m) {
        android.util.Log.d("FFT", m.message() + " @" + m.lineNumber());
        return true;
      }
    });
    // The bridge needs the WebView back, so a request that finishes on a pool
    // thread can wake the page through evaluateJavascript. Without this the
    // page would have to block on the result, which is what froze the app.
    // Alerts: re-arm on every launch (an alarm does not survive a force-stop
    // or an app update by itself) and ask for the notification permission the
    // first time, but only on the versions that have one. Asking for it here
    // rather than at the moment the switch is flipped means the switch never
    // silently turns itself on with nowhere to post.
    try { Alerts.rearm(this); } catch (Throwable t) { /* never block the app */ }
    if (Build.VERSION.SDK_INT >= 33) {
      try {
        if (checkSelfPermission("android.permission.POST_NOTIFICATIONS")
            != android.content.pm.PackageManager.PERMISSION_GRANTED) {
          requestPermissions(new String[] { "android.permission.POST_NOTIFICATIONS" }, 42);
        }
      } catch (Throwable t) { /* an old shell without runtime permissions */ }
    }

    NativeBridge bridge = new NativeBridge(this);
    web.addJavascriptInterface(bridge, "Native");
    bridge.attach(web);

    // Android 15+ forces edge-to-edge for targetSdk >= 35: the page paints under
    // the status bar and the gesture bar. v1.1 ignored that; v1.2 padded the
    // WebView, which CLIPPED the page instead of insetting it. The reliable
    // approach is to leave the WebView full-bleed and hand the inset sizes to
    // CSS, letting the page pad its own header and tab bar.
    web.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
      @Override public WindowInsets onApplyWindowInsets(View v, WindowInsets in) {
        int t, b, l, r;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          Insets i = in.getInsets(WindowInsets.Type.systemBars()
                                | WindowInsets.Type.displayCutout());
          t = i.top; b = i.bottom; l = i.left; r = i.right;
        } else {
          t = in.getSystemWindowInsetTop();
          b = in.getSystemWindowInsetBottom();
          l = in.getSystemWindowInsetLeft();
          r = in.getSystemWindowInsetRight();
        }
        v.setPadding(0, 0, 0, 0);          // never pad the WebView itself
        insetTop = t; insetBottom = b; insetLeft = l; insetRight = r;
        pushInsets();
        return in;
      }
    });
    setContentView(web);
    web.requestApplyInsets();
    web.loadUrl("file:///android_asset/index.html");
  }

  // ---- BACK ----------------------------------------------------------------
  // Tj: "the back button should never close the app." It used to finish the
  // Activity the moment the page said it had nothing left to unwind —
  // which is most presses, since that is true the instant you are back on
  // the Live tab with no modal open. Back is supposed to be reversible;
  // closing the app is not, and there is no way back in except relaunching
  // from the home screen.
  //
  // The page still owns the answer, because only the page knows whether a
  // modal is open or which tab is showing — __onBack() returns "1" if it
  // handled the press (closed a modal, or stepped back through the tab
  // history) and evaluateJavascript is asynchronous, so the decision cannot
  // be made inline: the press is swallowed, the page is asked, and the
  // Activity itself is never finished either way. When the page says it had
  // nothing left, moveTaskToBack sends the app behind whatever was open
  // before it — home screen, another app, the launcher — instead of killing
  // it. The process survives and the app reopens exactly where it was, which
  // is what "never closes" has to mean.
  //
  // The WebView's own back/forward history used to be consulted too (via
  // canGoBack/goBack), but this is a single-page app that never pushes a
  // history entry, so it was always false — dead code, deleted rather than
  // kept "just in case".
  private long lastBackAsk = 0;
  @Override public boolean onKeyDown(int code, KeyEvent e) {
    if (code != KeyEvent.KEYCODE_BACK) return super.onKeyDown(code, e);
    if (web == null || !pageReady) { moveTaskToBack(true); return true; }
    long now = System.currentTimeMillis();
    // A double-tap while the round trip is in flight would ask twice and
    // could background the app on the second answer after the first already
    // handled it. Ignore a second press inside the window it takes to answer.
    if (now - lastBackAsk < 400) return true;
    lastBackAsk = now;
    try {
      web.evaluateJavascript("(window.__onBack&&window.__onBack())?'1':'0'",
          new android.webkit.ValueCallback<String>() {
            @Override public void onReceiveValue(String v) {
              // evaluateJavascript returns a JSON string, so "'1'" arrives
              // quoted. Anything that is not a clear yes means the page did
              // not handle it, including a null from a page that has gone —
              // background the app rather than finishing it either way.
              if (v == null || v.indexOf('1') < 0) moveTaskToBack(true);
            }
          });
    } catch (Throwable t) {
      moveTaskToBack(true);   // never let a bridge failure close the app
    }
    return true;
  }

  // ---- the offline Claude round trip: reading the reply file ---------------
  // Only an Activity can start a picker for a result, so NativeBridge.pickFile()
  // forwards here. The file's TEXT is handed to the page; the page never sees a
  // path or a Uri, because it has no way to read one and no business holding it.
  private static final int REQ_PICK = 7301;

  void openDocument() {
    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    i.addCategory(Intent.CATEGORY_OPENABLE);
    // Claude hands back .json; a reply saved as .md or .txt, or pasted into a
    // note, is just as usable because the importer finds the JSON inside. So
    // the filter is deliberately wide — a picker that hides the user's file is
    // worse than one that shows too much.
    i.setType("*/*");
    i.putExtra(Intent.EXTRA_MIME_TYPES,
        new String[] { "application/json", "text/plain", "text/markdown", "*/*" });
    try {
      startActivityForResult(i, REQ_PICK);
    } catch (Throwable t) {
      toPage("window.__filePicked&&window.__filePicked(null,"
             + jsStr("This phone has no file picker. Paste the reply instead.") + ")");
    }
  }

  @Override protected void onActivityResult(int req, int res, Intent data) {
    super.onActivityResult(req, res, data);
    if (req != REQ_PICK) return;
    if (res != RESULT_OK || data == null || data.getData() == null) {
      toPage("window.__filePicked&&window.__filePicked(null,null)");   // cancelled
      return;
    }
    // Read on a background thread: a large reply on slow storage would
    // otherwise block the UI thread, which is the exact mistake the whole
    // bridge design exists to avoid.
    final android.net.Uri uri = data.getData();
    new Thread(new Runnable() { public void run() {
      String text = null, err = null;
      java.io.InputStream in = null;
      try {
        in = getContentResolver().openInputStream(uri);
        if (in == null) throw new java.io.IOException("could not open that file");
        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n, total = 0;
        final int LIMIT = 4 * 1024 * 1024;   // a reply is kilobytes; refuse a video
        while ((n = in.read(buf)) > 0) {
          total += n;
          if (total > LIMIT) throw new java.io.IOException("that file is too large to be a reply");
          bo.write(buf, 0, n);
        }
        text = new String(bo.toByteArray(), "UTF-8");
      } catch (Throwable t) {
        err = String.valueOf(t.getMessage());
      } finally {
        try { if (in != null) in.close(); } catch (Throwable ignored) { }
      }
      final String js = "window.__filePicked&&window.__filePicked("
          + (text == null ? "null" : jsStr(text)) + ","
          + (err == null ? "null" : jsStr(err)) + ")";
      toPage(js);
    } }).start();
  }

  private void toPage(final String js) {
    if (web == null) return;
    web.post(new Runnable() { public void run() {
      try { web.evaluateJavascript(js, null); } catch (Throwable ignored) { }
    } });
  }

  /** JSON-quote a string for injection into evaluateJavascript. */
  private static String jsStr(String s) {
    StringBuilder b = new StringBuilder(s.length() + 16).append('"');
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      switch (c) {
        case '"':  b.append("\\\""); break;
        case '\\': b.append("\\\\"); break;
        case '\n': b.append("\\n");  break;
        case '\r': b.append("\\r");  break;
        case '\t': b.append("\\t");  break;
        default:
          // Anything below 0x20, plus the two line separators JS treats as
          // newlines inside a string literal, must be escaped or the injected
          // script is a syntax error. U+2028/U+2029 turn up in pasted prose.
          // They are compared NUMERICALLY on purpose: writing the escape as a
          // char literal does not compile, because javac resolves unicode
          // escapes BEFORE it lexes, so the escape becomes a real line
          // terminator inside the literal and the file is a syntax error.
          if (c < 0x20 || c == 0x2028 || c == 0x2029) {
            b.append(String.format("\\u%04x", (int) c));
          } else b.append(c);
      }
    }
    return b.append('"').toString();
  }

  // ---- SLEEPING WHEN BACKGROUNDED -----------------------------------------
  // Tj: "make sure when the app is backgrounded that it properly sleeps and
  // doesn't hog ram or CPU or battery."
  //
  // It did not. Nothing in this Activity or in the page stopped anything when
  // the app left the screen. ui.js owns a live-scoring timer that re-fires
  // every 45 seconds by default and, when a game is in progress, pulls sixteen
  // box scores each time. A WebView whose Activity is merely stopped keeps
  // running its JS timers, so that poll carried on all afternoon behind
  // whatever Tj was actually doing — network, CPU and battery for a number
  // nobody was looking at. The page's own comment claimed the poll was
  // "foreground only, by design"; nothing implemented that.
  //
  // Three things, in order of how much they save:
  //   onPause  -> the page stops its own timers first (it knows which are
  //               resumable), then pauseTimers() stops any that remain,
  //               including ones inside the WebView we do not own.
  //   onStop   -> onPause() on the WebView proper: drops the drawing surface
  //               and lets it release memory it only needs while visible.
  //   onDestroy-> tear the WebView down explicitly so it cannot outlive the
  //               Activity; a WebView holding an Activity context is the
  //               classic Android leak.
  //
  // pauseTimers() is process-wide, which is exactly right here because there
  // is only ever one WebView.
  @Override protected void onPause() {
    super.onPause();
    if (web != null) {
      try { web.evaluateJavascript("window.__appPause&&window.__appPause()", null); }
      catch (Throwable ignored) { }
      try { web.pauseTimers(); } catch (Throwable ignored) { }
    }
  }

  @Override protected void onStop() {
    super.onStop();
    if (web != null) { try { web.onPause(); } catch (Throwable ignored) { } }
  }

  @Override protected void onResume() {
    super.onResume();
    if (web != null) {
      try { web.onResume(); } catch (Throwable ignored) { }
      try { web.resumeTimers(); } catch (Throwable ignored) { }
      // The page decides what to restart and whether anything is stale enough
      // to be worth a fetch. Java must not make that call — it does not know
      // which screen is open or whether the week is already final.
      try { web.evaluateJavascript("window.__appResume&&window.__appResume()", null); }
      catch (Throwable ignored) { }
    }
  }

  @Override protected void onDestroy() {
    if (web != null) {
      try {
        ViewGroup p = (ViewGroup) web.getParent();
        if (p != null) p.removeView(web);
        web.removeJavascriptInterface("Native");
        web.stopLoading();
        web.setWebChromeClient(null);
        web.destroy();
      } catch (Throwable ignored) { }
      web = null;
    }
    super.onDestroy();
  }
}
