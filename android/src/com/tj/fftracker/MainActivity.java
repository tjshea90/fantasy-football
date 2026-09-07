package com.tj.fftracker;

import android.app.Activity;
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
    // Not what the app relies on any more (data ships as seed.js), but leaving
    // these on means a future file:// read does not fail silently.
    s.setAllowFileAccessFromFileURLs(true);
    s.setAllowUniversalAccessFromFileURLs(true);
    s.setCacheMode(WebSettings.LOAD_DEFAULT);
    s.setTextZoom(100);
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

  @Override public boolean onKeyDown(int code, KeyEvent e) {
    if (code == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
      web.goBack();
      return true;
    }
    return super.onKeyDown(code, e);
  }
}
