package com.zenchad.minddojo;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "RunningTracker",
    permissions = {
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION
            }
        )
    }
)
public class RunningTrackerPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermissionCallback");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void locationPermissionCallback(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Precise location permission is needed to track a run.");
            return;
        }
        startService(call);
    }

    @PluginMethod
    public void getSnapshot(PluginCall call) {
        boolean includePoints = Boolean.TRUE.equals(call.getBoolean("includePoints", true));
        call.resolve(snapshot(includePoints));
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context context = getContext();
        RunningTrackerService.getStore(context).edit().putBoolean(RunningTrackerService.KEY_RUNNING, false).apply();
        context.stopService(new Intent(context, RunningTrackerService.class));
        call.resolve(snapshot(true));
    }

    @PluginMethod
    public void clear(PluginCall call) {
        Context context = getContext();
        context.stopService(new Intent(context, RunningTrackerService.class));
        RunningTrackerService.clearStore(context);
        call.resolve();
    }

    private void startService(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, RunningTrackerService.class);
        intent.setAction(RunningTrackerService.ACTION_START);
        intent.putExtra(RunningTrackerService.EXTRA_RESET, Boolean.TRUE.equals(call.getBoolean("reset", false)));
        intent.putExtra(RunningTrackerService.EXTRA_SESSION_ID, call.getString("sessionId", ""));
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            call.resolve(snapshot(false));
        } catch (RuntimeException error) {
            call.reject("Android could not start background run tracking.", error);
        }
    }

    private JSObject snapshot(boolean includePoints) {
        SharedPreferences prefs = RunningTrackerService.getStore(getContext());
        JSObject result = new JSObject();
        result.put("running", prefs.getBoolean(RunningTrackerService.KEY_RUNNING, false));
        result.put("sessionId", prefs.getString(RunningTrackerService.KEY_SESSION_ID, ""));
        result.put("startedAt", prefs.getLong(RunningTrackerService.KEY_STARTED_AT, 0L));
        result.put("distanceMeters", readDouble(prefs, RunningTrackerService.KEY_DISTANCE_BITS, 0d));
        result.put("lastAccuracy", readDouble(prefs, RunningTrackerService.KEY_LAST_ACCURACY_BITS, -1d));
        result.put("lastLocationAt", prefs.getLong(RunningTrackerService.KEY_LAST_AT, 0L));

        String rawPoints = prefs.getString(RunningTrackerService.KEY_POINTS, "[]");
        JSONArray source;
        try {
            source = new JSONArray(rawPoints);
        } catch (JSONException ignored) {
            source = new JSONArray();
        }
        result.put("pointCount", source.length());

        if (includePoints) {
            JSArray points = new JSArray();
            for (int index = 0; index < source.length(); index += 1) {
                JSONObject sourcePoint = source.optJSONObject(index);
                if (sourcePoint == null) continue;
                JSObject point = new JSObject();
                point.put("lat", sourcePoint.optDouble("lat"));
                point.put("lng", sourcePoint.optDouble("lng"));
                point.put("accuracy", sourcePoint.optDouble("accuracy", -1d));
                point.put("at", sourcePoint.optLong("at"));
                point.put("distanceFromStart", sourcePoint.optDouble("distanceFromStart", 0d));
                points.put(point);
            }
            result.put("points", points);
        }
        return result;
    }

    private static double readDouble(SharedPreferences prefs, String key, double fallback) {
        if (!prefs.contains(key)) return fallback;
        return Double.longBitsToDouble(prefs.getLong(key, Double.doubleToRawLongBits(fallback)));
    }
}
