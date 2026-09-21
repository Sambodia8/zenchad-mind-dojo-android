package com.zenchad.minddojo;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "RunningBackgroundNavigation")
public class RunningBackgroundNavigationPlugin extends Plugin {
    public static final String ROUTE_FILE = "zenchad_running_navigation_route_v1.json";
    private static final String PREFS = "zenchad_running_background_navigation_v1";
    private static final String KEY_MUTED = "muted";

    @PluginMethod
    public void setRoute(PluginCall call) {
        String routeJson = call.getString("routeJson", "");
        if (routeJson.isEmpty()) {
            call.reject("A route is required.");
            return;
        }
        try (OutputStreamWriter writer = new OutputStreamWriter(
            getContext().openFileOutput(ROUTE_FILE, android.content.Context.MODE_PRIVATE),
            StandardCharsets.UTF_8
        )) {
            writer.write(routeJson);
            call.resolve();
        } catch (IOException error) {
            call.reject("Could not save the background navigation route.", error);
        }
    }

    @PluginMethod
    public void clearRoute(PluginCall call) {
        getContext().deleteFile(ROUTE_FILE);
        call.resolve();
    }

    @PluginMethod
    public void setMuted(PluginCall call) {
        boolean muted = call.getBoolean("muted", false);
        getContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_MUTED, muted)
            .apply();
        call.resolve();
    }
}
