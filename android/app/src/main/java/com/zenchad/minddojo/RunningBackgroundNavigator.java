package com.zenchad.minddojo;

import android.content.Context;
import android.content.SharedPreferences;
import android.location.Location;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

public class RunningBackgroundNavigator implements TextToSpeech.OnInitListener {
    private static final String PREFS = "zenchad_running_background_navigation_v1";
    private static final String KEY_SESSION_ID = "sessionId";
    private static final String KEY_SPOKEN = "spoken";

    private final Context context;
    private final SharedPreferences prefs;
    private final AudioManager audioManager;
    private final List<Maneuver> maneuvers = new ArrayList<>();
    private final Set<String> spoken = new HashSet<>();

    private TextToSpeech tts;
    private AudioFocusRequest audioFocusRequest;
    private boolean audioFocusHeld = false;
    private boolean ttsReady = false;
    private String sessionId = "";
    private long routeModifiedAt = -1L;
    private double[] lats = new double[0];
    private double[] lngs = new double[0];
    private double[] cumulative = new double[0];
    private int nearestIndex = 0;
    private boolean speaking = false;
    private double lastRouteProgressMeters = 0d;
    private double lastOffRouteMeters = Double.POSITIVE_INFINITY;
    private double lastDistanceToManeuverMeters = Double.POSITIVE_INFINITY;

    public RunningBackgroundNavigator(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = this.context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        this.audioManager = (AudioManager) this.context.getSystemService(Context.AUDIO_SERVICE);
        this.tts = new TextToSpeech(this.context, this);
    }

    public void setSessionId(String nextSessionId) {
        String safe = nextSessionId == null ? "" : nextSessionId;
        if (safe.equals(sessionId)) return;
        sessionId = safe;
        nearestIndex = 0;
        routeModifiedAt = -1L;
        spoken.clear();
        lastRouteProgressMeters = 0d;
        lastOffRouteMeters = Double.POSITIVE_INFINITY;
        lastDistanceToManeuverMeters = Double.POSITIVE_INFINITY;
        String storedSessionId = prefs.getString(KEY_SESSION_ID, "");
        if (safe.equals(storedSessionId)) {
            Set<String> saved = prefs.getStringSet(KEY_SPOKEN, null);
            if (saved != null) spoken.addAll(saved);
        } else {
            prefs.edit().putString(KEY_SESSION_ID, safe).remove(KEY_SPOKEN).apply();
        }
    }

    @Override
    public void onInit(int status) {
        ttsReady = status == TextToSpeech.SUCCESS;
        if (!ttsReady || tts == null) return;
        tts.setLanguage(Locale.UK);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();
            tts.setAudioAttributes(attributes);
        }
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String utteranceId) {
                speaking = true;
            }

            @Override
            public void onDone(String utteranceId) {
                speaking = false;
                releaseAudioFocus();
            }

            @Override
            public void onError(String utteranceId) {
                speaking = false;
                releaseAudioFocus();
            }
        });
    }

    public void onLocation(Location location) {
        if (location == null || sessionId.isEmpty()) return;
        reloadRouteIfNeeded();
        if (lats.length < 2 || cumulative.length != lats.length) return;

        double bestDistance = Double.POSITIVE_INFINITY;
        int searchStart = Math.max(0, nearestIndex - 25);
        int searchEnd = Math.min(lats.length - 1, nearestIndex + 220);
        int bestIndex = nearestIndex;
        for (int index = searchStart; index <= searchEnd; index += 1) {
            double distance = distanceMeters(location.getLatitude(), location.getLongitude(), lats[index], lngs[index]);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = index;
            }
        }
        if (bestDistance > 150d) {
            for (int index = 0; index < lats.length; index += 1) {
                double distance = distanceMeters(location.getLatitude(), location.getLongitude(), lats[index], lngs[index]);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestIndex = index;
                }
            }
        }
        nearestIndex = bestIndex;
        lastOffRouteMeters = bestDistance;
        lastRouteProgressMeters = cumulative[bestIndex];
        lastDistanceToManeuverMeters = Double.POSITIVE_INFINITY;
        if (bestDistance > 80d || maneuvers.isEmpty()) return;

        Maneuver next = null;
        for (Maneuver maneuver : maneuvers) {
            if (maneuver.routeDistanceMeters > lastRouteProgressMeters + 8d) {
                next = maneuver;
                break;
            }
        }
        if (next == null) return;
        double distanceToTurn = Math.max(0d, next.routeDistanceMeters - lastRouteProgressMeters);
        lastDistanceToManeuverMeters = distanceToTurn;

        String nowKey = next.id + ":now";
        String previewKey = next.id + ":preview";
        if (distanceToTurn <= 38d && !spoken.contains(nowKey)) {
            if (speak(next.verbalAlert.isEmpty() ? next.instruction : next.verbalAlert)) {
                markSpoken(nowKey);
            }
        } else if (distanceToTurn <= 135d && distanceToTurn > 38d && !spoken.contains(previewKey)) {
            if (speak(next.verbalInstruction.isEmpty() ? next.instruction : next.verbalInstruction)) {
                markSpoken(previewKey);
            }
        }
    }

    public boolean isSpeaking() {
        return speaking;
    }

    public double getLastRouteProgressMeters() {
        return lastRouteProgressMeters;
    }

    public double getLastOffRouteMeters() {
        return lastOffRouteMeters;
    }

    public double getLastDistanceToManeuverMeters() {
        return lastDistanceToManeuverMeters;
    }

    public void shutdown() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        speaking = false;
        releaseAudioFocus();
    }

    private void markSpoken(String key) {
        spoken.add(key);
        prefs.edit().putString(KEY_SESSION_ID, sessionId).putStringSet(KEY_SPOKEN, new HashSet<>(spoken)).apply();
    }

    private void reloadRouteIfNeeded() {
        File file = new File(context.getFilesDir(), RunningBackgroundNavigationPlugin.ROUTE_FILE);
        if (!file.exists()) {
            clearRoute();
            return;
        }
        long modified = file.lastModified();
        if (modified == routeModifiedAt) return;
        routeModifiedAt = modified;

        try {
            JSONObject route = new JSONObject(readFile(file));
            if (!sessionId.equals(route.optString("sessionId", ""))) {
                clearRoute();
                return;
            }
            JSONArray geometry = route.optJSONArray("geometry");
            JSONArray distances = route.optJSONArray("cumulativeMeters");
            JSONArray routeManeuvers = route.optJSONArray("maneuvers");
            if (geometry == null || distances == null || geometry.length() != distances.length()) {
                clearRoute();
                return;
            }

            lats = new double[geometry.length()];
            lngs = new double[geometry.length()];
            cumulative = new double[distances.length()];
            for (int index = 0; index < geometry.length(); index += 1) {
                JSONObject point = geometry.getJSONObject(index);
                lats[index] = point.getDouble("lat");
                lngs[index] = point.getDouble("lng");
                cumulative[index] = distances.getDouble(index);
            }

            maneuvers.clear();
            if (routeManeuvers != null) {
                for (int index = 0; index < routeManeuvers.length(); index += 1) {
                    JSONObject json = routeManeuvers.getJSONObject(index);
                    maneuvers.add(new Maneuver(
                        json.optString("id", "m-" + index),
                        json.optString("instruction", "Continue on the route"),
                        json.optString("verbalAlert", ""),
                        json.optString("verbalInstruction", ""),
                        json.optDouble("routeDistanceMeters", 0d)
                    ));
                }
            }
            nearestIndex = 0;
        } catch (IOException | JSONException error) {
            clearRoute();
        }
    }

    private void clearRoute() {
        lats = new double[0];
        lngs = new double[0];
        cumulative = new double[0];
        maneuvers.clear();
        nearestIndex = 0;
        lastRouteProgressMeters = 0d;
        lastOffRouteMeters = Double.POSITIVE_INFINITY;
        lastDistanceToManeuverMeters = Double.POSITIVE_INFINITY;
    }

    private String readFile(File file) throws IOException {
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) builder.append(line);
        }
        return builder.toString();
    }

    private boolean speak(String text) {
        if (!ttsReady || tts == null || text == null || text.trim().isEmpty() || speaking) return false;
        requestAudioFocus();
        Bundle params = new Bundle();
        String utteranceId = "zenchad-background-nav-" + UUID.randomUUID();
        int result = tts.speak(text.trim(), TextToSpeech.QUEUE_FLUSH, params, utteranceId);
        if (result == TextToSpeech.ERROR) {
            releaseAudioFocus();
            return false;
        }
        return true;
    }

    private void requestAudioFocus() {
        if (audioManager == null || audioFocusHeld) return;
        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();
            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(attributes)
                .setAcceptsDelayedFocusGain(false)
                .setWillPauseWhenDucked(true)
                .build();
            result = audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            result = audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
        }
        audioFocusHeld = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }

    private void releaseAudioFocus() {
        if (audioManager == null || !audioFocusHeld) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
            audioFocusRequest = null;
        } else {
            audioManager.abandonAudioFocus(null);
        }
        audioFocusHeld = false;
    }

    private double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
        float[] result = new float[1];
        Location.distanceBetween(lat1, lng1, lat2, lng2, result);
        return result[0];
    }

    private static class Maneuver {
        final String id;
        final String instruction;
        final String verbalAlert;
        final String verbalInstruction;
        final double routeDistanceMeters;

        Maneuver(String id, String instruction, String verbalAlert, String verbalInstruction, double routeDistanceMeters) {
            this.id = id;
            this.instruction = instruction;
            this.verbalAlert = verbalAlert;
            this.verbalInstruction = verbalInstruction;
            this.routeDistanceMeters = routeDistanceMeters;
        }
    }
}
