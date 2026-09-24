package com.zenchad.minddojo;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.ResultReceiver;
import android.os.Bundle;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MeditationOverlay")
public class MeditationOverlayPlugin extends Plugin {
    @PluginMethod
    public void permission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", Settings.canDrawOverlays(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        try {
            getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName())));
            call.resolve();
        } catch (Exception e) { call.reject("Cannot open overlay settings", e); }
    }

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url", "");
        Uri uri = Uri.parse(url);
        Long deadline = call.getLong("deadline");
        if (!"https".equals(uri.getScheme()) || !"www.youtube.com".equals(uri.getHost())
                || !"/playlist".equals(uri.getPath()) || uri.getQueryParameter("list") == null
                || deadline == null || deadline <= System.currentTimeMillis()
                || deadline > System.currentTimeMillis() + 86400000L) {
            call.reject("Invalid playlist or timer");
            return;
        }
        if (!Settings.canDrawOverlays(getContext())) {
            call.reject("Overlay permission is required");
            return;
        }
        getActivity().runOnUiThread(() -> {
            Handler handler = new Handler(Looper.getMainLooper());
            boolean[] settled = { false };
            Runnable timeout = () -> {
                if (settled[0]) return;
                settled[0] = true;
                stopOverlay();
                call.reject("Floating timer did not start");
            };
            ResultReceiver receiver = new ResultReceiver(handler) {
                @Override protected void onReceiveResult(int code, Bundle data) {
                    if (settled[0]) return;
                    settled[0] = true;
                    handler.removeCallbacks(timeout);
                    if (code != 1) {
                        stopOverlay();
                        call.reject("Cannot show floating timer");
                        return;
                    }
                    try {
                        Intent youtube = new Intent(Intent.ACTION_VIEW, uri);
                        youtube.setPackage("com.google.android.youtube");
                        try { getActivity().startActivity(youtube); }
                        catch (ActivityNotFoundException missingYoutube) {
                            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri));
                        }
                        call.resolve();
                    } catch (Exception e) {
                        stopOverlay();
                        call.reject("Cannot open YouTube", e);
                    }
                }
            };
            try {
                handler.postDelayed(timeout, 8000);
                ContextCompat.startForegroundService(getContext(),
                    new Intent(getContext(), MeditationOverlayService.class)
                        .putExtra("deadline", deadline).putExtra("receiver", receiver));
            } catch (Exception e) {
                settled[0] = true;
                handler.removeCallbacks(timeout);
                stopOverlay();
                call.reject("Cannot start floating timer", e);
            }
        });
    }

    private void stopOverlay() {
        getContext().stopService(new Intent(getContext(), MeditationOverlayService.class));
    }

    @Override protected void handleOnResume() { stopOverlay(); }

    @PluginMethod
    public void hide(PluginCall call) {
        stopOverlay();
        call.resolve();
    }
}
