package com.zenchad.minddojo;

import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "Appearance")
public class AppearancePlugin extends Plugin {
    @PluginMethod
    public void setSystemBars(PluginCall call) {
        final boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", true));
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            int background = Color.parseColor(dark ? "#080d1b" : "#f4f1ea");
            window.setStatusBarColor(background);
            window.setNavigationBarColor(background);

            View decor = window.getDecorView();
            int flags = decor.getSystemUiVisibility();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags = dark
                    ? flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                    : flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                flags = dark
                    ? flags & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                    : flags | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            decor.setSystemUiVisibility(flags);
            call.resolve();
        });
    }
}
