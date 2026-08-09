package com.zenchad.minddojo;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public class RunningTrackerService extends Service implements LocationListener {
    public static final String ACTION_START = "com.zenchad.minddojo.running.START";
    public static final String ACTION_STOP = "com.zenchad.minddojo.running.STOP";
    public static final String EXTRA_RESET = "reset";
    public static final String EXTRA_SESSION_ID = "sessionId";

    public static final String PREFS_NAME = "zenchad_running_native_v1";
    public static final String POINTS_FILE = "zenchad_running_points_v1.jsonl";
    public static final String KEY_RUNNING = "running";
    public static final String KEY_SESSION_ID = "sessionId";
    public static final String KEY_STARTED_AT = "startedAt";
    public static final String KEY_DISTANCE_BITS = "distanceBits";
    public static final String KEY_LAST_LAT_BITS = "lastLatBits";
    public static final String KEY_LAST_LNG_BITS = "lastLngBits";
    public static final String KEY_LAST_ACCURACY_BITS = "lastAccuracyBits";
    public static final String KEY_LAST_AT = "lastAt";
    public static final String KEY_POINT_COUNT = "pointCount";

    private static final int NOTIFICATION_ID = 7201;
    private static final String CHANNEL_ID = "running-tracker";

    private LocationManager locationManager;
    private SharedPreferences prefs;

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        ensureNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopTracking();
            return START_NOT_STICKY;
        }

        if (!hasLocationPermission()) {
            prefs.edit().putBoolean(KEY_RUNNING, false).apply();
            stopSelf();
            return START_NOT_STICKY;
        }

        String incomingSessionId = intent == null ? "" : intent.getStringExtra(EXTRA_SESSION_ID);
        if (incomingSessionId == null) incomingSessionId = "";
        String storedSessionId = prefs.getString(KEY_SESSION_ID, "");
        boolean reset = intent != null && intent.getBooleanExtra(EXTRA_RESET, false);
        if (!incomingSessionId.isEmpty() && !incomingSessionId.equals(storedSessionId)) reset = true;

        if (reset || prefs.getLong(KEY_STARTED_AT, 0L) <= 0L) {
            resetStoredRun(incomingSessionId);
        } else if (!incomingSessionId.isEmpty()) {
            prefs.edit().putString(KEY_SESSION_ID, incomingSessionId).apply();
        }

        prefs.edit().putBoolean(KEY_RUNNING, true).apply();
        startAsForeground();
        requestLocationUpdates();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        removeLocationUpdates();
        stopForeground(true);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onLocationChanged(Location location) {
        if (location == null || !prefs.getBoolean(KEY_RUNNING, false)) return;
        if (location.hasAccuracy() && location.getAccuracy() > 80f) return;

        long at = location.getTime() > 0 ? location.getTime() : System.currentTimeMillis();
        long previousAt = prefs.getLong(KEY_LAST_AT, 0L);
        if (previousAt > 0L && at <= previousAt) return;

        double distance = readDouble(KEY_DISTANCE_BITS, 0d);
        double extraDistance = 0d;

        if (previousAt > 0L && prefs.contains(KEY_LAST_LAT_BITS) && prefs.contains(KEY_LAST_LNG_BITS)) {
            Location previous = new Location("zenchad-saved");
            previous.setLatitude(readDouble(KEY_LAST_LAT_BITS, location.getLatitude()));
            previous.setLongitude(readDouble(KEY_LAST_LNG_BITS, location.getLongitude()));
            float segment = previous.distanceTo(location);
            double elapsedSeconds = Math.max(1d, (at - previousAt) / 1000d);

            if (segment > 120f || segment / elapsedSeconds > 12d) return;
            if (segment >= 2f) {
                extraDistance = segment;
            } else if (at - previousAt < 10_000L) {
                return;
            }
        }

        distance += extraDistance;
        if (!appendPoint(location, at, distance)) return;
        prefs.edit()
            .putLong(KEY_DISTANCE_BITS, Double.doubleToRawLongBits(distance))
            .putLong(KEY_LAST_LAT_BITS, Double.doubleToRawLongBits(location.getLatitude()))
            .putLong(KEY_LAST_LNG_BITS, Double.doubleToRawLongBits(location.getLongitude()))
            .putLong(KEY_LAST_ACCURACY_BITS, Double.doubleToRawLongBits(location.hasAccuracy() ? location.getAccuracy() : -1d))
            .putLong(KEY_LAST_AT, at)
            .putInt(KEY_POINT_COUNT, prefs.getInt(KEY_POINT_COUNT, 0) + 1)
            .apply();
        updateNotification(distance);
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {
        // Kept for compatibility with older Android versions.
    }

    @Override
    public void onProviderEnabled(String provider) {
        // The next location update will refresh the notification and snapshot.
    }

    @Override
    public void onProviderDisabled(String provider) {
        // Tracking remains alive so another provider can continue supplying updates.
    }

    public static SharedPreferences getStore(Context context) {
        return context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
    }

    public static void clearStore(Context context) {
        getStore(context).edit().clear().apply();
        context.deleteFile(POINTS_FILE);
    }

    private void resetStoredRun(String sessionId) {
        deleteFile(POINTS_FILE);
        prefs.edit()
            .clear()
            .putBoolean(KEY_RUNNING, true)
            .putString(KEY_SESSION_ID, sessionId == null ? "" : sessionId)
            .putLong(KEY_STARTED_AT, System.currentTimeMillis())
            .putLong(KEY_DISTANCE_BITS, Double.doubleToRawLongBits(0d))
            .putInt(KEY_POINT_COUNT, 0)
            .apply();
    }

    private void stopTracking() {
        prefs.edit().putBoolean(KEY_RUNNING, false).apply();
        removeLocationUpdates();
        stopForeground(true);
        stopSelf();
    }

    @SuppressLint("MissingPermission")
    private void requestLocationUpdates() {
        removeLocationUpdates();
        if (locationManager == null || !hasLocationPermission()) return;

        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 1f, this);
            }
        } catch (RuntimeException ignored) {
            // A secondary provider below can still keep the run alive.
        }

        try {
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 3000L, 5f, this);
            }
        } catch (RuntimeException ignored) {
            // The foreground service remains alive while waiting for GPS.
        }
    }

    @SuppressLint("MissingPermission")
    private void removeLocationUpdates() {
        if (locationManager == null) return;
        try {
            locationManager.removeUpdates(this);
        } catch (RuntimeException ignored) {
            // Nothing else is required during teardown.
        }
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean appendPoint(Location location, long at, double distance) {
        JSONObject point = new JSONObject();
        try {
            point.put("lat", location.getLatitude());
            point.put("lng", location.getLongitude());
            point.put("accuracy", location.hasAccuracy() ? location.getAccuracy() : -1d);
            point.put("at", at);
            point.put("distanceFromStart", distance);
        } catch (JSONException ignored) {
            return false;
        }

        try (BufferedWriter writer = new BufferedWriter(
            new OutputStreamWriter(openFileOutput(POINTS_FILE, MODE_APPEND), StandardCharsets.UTF_8)
        )) {
            writer.write(point.toString());
            writer.newLine();
            return true;
        } catch (IOException ignored) {
            return false;
        }
    }

    private double readDouble(String key, double fallback) {
        if (!prefs.contains(key)) return fallback;
        return Double.longBitsToDouble(prefs.getLong(key, Double.doubleToRawLongBits(fallback)));
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Active run", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Keeps GPS run tracking active while the screen is off or you use another app.");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private void startAsForeground() {
        Notification notification = buildNotification(readDouble(KEY_DISTANCE_BITS, 0d));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void updateNotification(double distanceMeters) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification(distanceMeters));
    }

    private Notification buildNotification(double distanceMeters) {
        long startedAt = prefs.getLong(KEY_STARTED_AT, System.currentTimeMillis());
        String distance = distanceMeters < 1000d
            ? String.format(Locale.UK, "%.0f m", distanceMeters)
            : String.format(Locale.UK, "%.2f km", distanceMeters / 1000d);

        Intent openApp = new Intent(this, MainActivity.class);
        openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            7201,
            openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        return builder
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Zenchad Run")
            .setContentText(distance + " · run still tracking")
            .setWhen(startedAt)
            .setUsesChronometer(true)
            .setShowWhen(true)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .build();
    }
}
