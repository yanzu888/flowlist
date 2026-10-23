package com.flowlist.mobile;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.lang.ref.WeakReference;

public class MainActivity extends Activity {
    static final String EXTRA_FOCUS_TASK_ID = "focus_task_id";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 1001;
    private static WeakReference<MainActivity> activeActivity = new WeakReference<>(null);

    private WebView webView;
    private boolean pageReady;
    private String pendingFocusTaskId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        activeActivity = new WeakReference<>(this);
        getWindow().setStatusBarColor(Color.rgb(25, 48, 43));
        getWindow().setNavigationBarColor(Color.rgb(245, 247, 246));

        ReminderScheduler.restore(this);
        webView = createWebView();
        setContentView(webView);
        handleIntent(getIntent());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
        }
    }

    private WebView createWebView() {
        WebView view = new WebView(this);
        view.setBackgroundColor(Color.rgb(245, 247, 246));
        view.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                dispatchPendingFocus();
            }
        });
        view.setWebChromeClient(new WebChromeClient());
        view.getSettings().setJavaScriptEnabled(true);
        view.getSettings().setDomStorageEnabled(true);
        view.getSettings().setAllowFileAccess(true);
        view.getSettings().setAllowContentAccess(false);
        view.getSettings().setMediaPlaybackRequiresUserGesture(true);
        view.addJavascriptInterface(new AndroidBridge(this), "FlowlistAndroid");
        view.loadUrl("file:///android_asset/index.html");
        return view;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String taskId = intent.getStringExtra(EXTRA_FOCUS_TASK_ID);
        if (taskId != null && !taskId.isEmpty()) {
            pendingFocusTaskId = taskId;
            dispatchPendingFocus();
        }
    }

    private void dispatchPendingFocus() {
        if (!pageReady || webView == null || pendingFocusTaskId == null) return;
        String quotedId = JSONObject.quote(pendingFocusTaskId);
        webView.post(() -> webView.evaluateJavascript(
                "window.flowlist&&window.flowlist._focusTask(" + quotedId + ")",
                null
        ));
        pendingFocusTaskId = null;
    }

    static void emitReminderToWeb(TaskData task) {
        MainActivity activity = activeActivity.get();
        if (activity == null || activity.webView == null || task == null) return;
        String quotedJson = JSONObject.quote(task.toJson().toString());
        activity.webView.post(() -> activity.webView.evaluateJavascript(
                "window.flowlist&&window.flowlist._emitReminder(JSON.parse(" + quotedJson + "))",
                null
        ));
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            moveTaskToBack(true);
        }
    }

    @Override
    protected void onDestroy() {
        pageReady = false;
        if (webView != null) {
            webView.removeJavascriptInterface("FlowlistAndroid");
            webView.destroy();
            webView = null;
        }
        if (activeActivity.get() == this) activeActivity = new WeakReference<>(null);
        super.onDestroy();
    }
}
