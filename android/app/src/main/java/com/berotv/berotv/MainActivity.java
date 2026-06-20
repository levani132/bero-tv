package com.berotv.berotv;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Iterator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// Android TV WebView host: loads the shared Bero TV web app and exposes the JS
// bridge (window.Android.*) that AbstractClient uses for networking. CORS-free,
// header-capable HTTP so the Tvibo Bearer/Referer can be set freely.
public class MainActivity extends Activity {
    // Bundle the built web app under assets/webapp, or point at the hosted build.
    private static final String APP_URL = "file:///android_asset/webapp/index.html";
    private final ExecutorService io = Executors.newFixedThreadPool(4);
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new Bridge(), "Android");
        setContentView(webView);
        webView.loadUrl(APP_URL);
    }

    @Override
    public void onBackPressed() {
        webView.evaluateJavascript("window.backPressed && window.backPressed();", null);
    }

    private void callback(final String name, final String arg) {
        runOnUiThread(() -> {
            String json = JSONObject.quote(arg == null ? "" : arg);
            webView.evaluateJavascript("window." + name + " && window." + name + "(" + json + ");", null);
        });
    }

    private class Bridge {
        @JavascriptInterface
        public void getWithHeaders(String url, String headerJson, String cb, String err) {
            request("GET", url, null, headerJson, cb, err);
        }

        @JavascriptInterface
        public void postWithHeaders(String url, String body, String headerJson, String cb, String err) {
            request("POST", url, body, headerJson, cb, err);
        }

        @JavascriptInterface
        public void exit() {
            finish();
        }

        @JavascriptInterface
        public void showToast(final String msg) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show());
        }

        private void request(String method, String url, String body, String headerJson, String cb, String err) {
            io.execute(() -> {
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setRequestMethod(method);
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(20000);
                    if (headerJson != null && headerJson.length() > 2) {
                        JSONObject h = new JSONObject(headerJson);
                        for (Iterator<String> it = h.keys(); it.hasNext(); ) {
                            String k = it.next();
                            c.setRequestProperty(k, h.getString(k));
                        }
                    }
                    if ("POST".equals(method) && body != null) {
                        c.setDoOutput(true);
                        OutputStream os = c.getOutputStream();
                        os.write(body.getBytes("UTF-8"));
                        os.close();
                    }
                    int code = c.getResponseCode();
                    BufferedReader r = new BufferedReader(new InputStreamReader(
                            code >= 200 && code < 300 ? c.getInputStream() : c.getErrorStream(), "UTF-8"));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = r.readLine()) != null) sb.append(line);
                    r.close();
                    if (code >= 200 && code < 300) callback(cb, sb.toString());
                    else callback(err, sb.toString());
                } catch (Exception e) {
                    callback(err, e.getMessage());
                }
            });
        }
    }
}
