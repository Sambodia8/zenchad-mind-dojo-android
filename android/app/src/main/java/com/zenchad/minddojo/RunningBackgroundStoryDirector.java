package com.zenchad.minddojo;

import android.content.Context;
import android.content.SharedPreferences;
import android.location.Location;
import android.media.AudioAttributes;
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
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public class RunningBackgroundStoryDirector implements TextToSpeech.OnInitListener {
    public static final String PREFS_NAME = "zenchad_running_story_native_v1";
    public static final String KEY_SESSION_ID = "sessionId";
    public static final String KEY_ENABLED = "enabled";
    public static final String KEY_DIFFICULTY = "difficulty";
    public static final String KEY_PHASE = "phase";
    public static final String KEY_RADIO_TITLE = "radioTitle";
    public static final String KEY_RADIO_DETAIL = "radioDetail";
    public static final String KEY_CHASE_COUNT = "chaseCount";
    public static final String KEY_ACTIVE_CHASE = "activeChase";
    public static final String KEY_CHASE_STARTED_AT = "chaseStartedAt";
    public static final String KEY_CHASE_DURATION_SECONDS = "chaseDurationSeconds";
    public static final String KEY_CHASE_TARGET_BITS = "chaseTargetBits";
    public static final String KEY_CHASE_START_DISTANCE_BITS = "chaseStartDistanceBits";
    public static final String KEY_CHASE_ACHIEVED_BITS = "chaseAchievedBits";
    public static final String KEY_LAST_OUTCOME = "lastOutcome";
    public static final String KEY_NEXT_EVENT_AT = "nextEventAt";
    public static final String KEY_HELICOPTER_TRIGGERED = "helicopterTriggered";
    public static final String KEY_HELICOPTER_TARGET_BITS = "helicopterTargetBits";
    public static final String KEY_OPENING_ONE = "openingOne";
    public static final String KEY_OPENING_TWO = "openingTwo";
    public static final String KEY_HOME_LINE = "homeLine";
    public static final String KEY_UPDATED_AT = "updatedAt";

    private final Context context;
    private final SharedPreferences prefs;
    private final Deque<SpeedSample> speedSamples = new ArrayDeque<>();
    private final List<StoryAnchor> storyAnchors = new ArrayList<>();
    private final List<ChaseResult> chaseHistory = new ArrayList<>();

    private TextToSpeech tts;
    private boolean ttsReady = false;
    private boolean speaking = false;
    private String sessionId = "";
    private long routeModifiedAt = -1L;
    private String routeMode = "";
    private int plannedMinutes = 30;

    public RunningBackgroundStoryDirector(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = this.context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        this.tts = new TextToSpeech(this.context, this);
    }

    public static SharedPreferences getStore(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static void clearStore(Context context) {
        String difficulty = getStore(context).getString(KEY_DIFFICULTY, "standard");
        getStore(context).edit().clear().putString(KEY_DIFFICULTY, difficulty).apply();
    }

    public void setSessionId(String nextSessionId) {
        String safe = nextSessionId == null ? "" : nextSessionId;
        if (safe.equals(sessionId)) return;
        sessionId = safe;
        routeModifiedAt = -1L;
        routeMode = "";
        storyAnchors.clear();
        speedSamples.clear();
        chaseHistory.clear();

        String stored = prefs.getString(KEY_SESSION_ID, "");
        if (!safe.equals(stored)) resetMissionState(safe);
    }

    @Override
    public void onInit(int status) {
        ttsReady = status == TextToSpeech.SUCCESS;
        if (!ttsReady || tts == null) return;
        tts.setLanguage(Locale.UK);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            // No AudioManager focus request here: Story dialogue is intentionally allowed to mix with music.
            AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();
            tts.setAudioAttributes(attributes);
        }
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String utteranceId) { speaking = true; }
            @Override public void onDone(String utteranceId) { speaking = false; }
            @Override public void onError(String utteranceId) { speaking = false; }
        });
    }

    public void onLocation(
        Location location,
        double totalDistanceMeters,
        long runStartedAt,
        double routeProgressMeters,
        double offRouteMeters,
        double distanceToNextManeuverMeters,
        boolean navigationSpeaking
    ) {
        if (location == null || sessionId.isEmpty() || runStartedAt <= 0L) return;
        reloadRouteIfNeeded();
        boolean storyMode = "story".equals(routeMode);
        if (!storyMode) {
            if (prefs.getBoolean(KEY_ENABLED, false)) prefs.edit().putBoolean(KEY_ENABLED, false).apply();
            return;
        }
        if (!prefs.getBoolean(KEY_ENABLED, false)) prefs.edit().putBoolean(KEY_ENABLED, true).apply();

        long now = System.currentTimeMillis();
        addSpeedSample(now, totalDistanceMeters);
        double elapsedSeconds = Math.max(0d, (now - runStartedAt) / 1000d);
        double plannedSeconds = Math.max(60d, plannedMinutes * 60d);
        double completionRatio = elapsedSeconds / plannedSeconds;

        if (!prefs.getBoolean(KEY_OPENING_ONE, false) && elapsedSeconds >= 8d && canSpeakStory(navigationSpeaking, distanceToNextManeuverMeters)) {
            if (speak("Runner. Comms check. You're carrying a relay key the city grid thinks was destroyed. Keep moving. I'll handle the route.")) {
                updateRadio("GHOST SIGNAL · COMMS ONLINE", "Relay key secured. Keep moving.");
                prefs.edit().putBoolean(KEY_OPENING_ONE, true).putString(KEY_PHASE, "opening").apply();
            }
        }

        if (!prefs.getBoolean(KEY_OPENING_TWO, false) && elapsedSeconds >= 75d && canSpeakStory(navigationSpeaking, distanceToNextManeuverMeters)) {
            if (speak("We've got a watcher behind you. Not a problem yet. Keep your rhythm.")) {
                updateRadio("WATCHER ON THE LINE", "Not a problem yet. Keep your rhythm.");
                prefs.edit()
                    .putBoolean(KEY_OPENING_TWO, true)
                    .putString(KEY_PHASE, "cruise")
                    .putLong(KEY_NEXT_EVENT_AT, Math.max(prefs.getLong(KEY_NEXT_EVENT_AT, 0L), now + 50_000L))
                    .apply();
            }
        }

        if (prefs.getBoolean(KEY_ACTIVE_CHASE, false)) {
            updateActiveChase(now, totalDistanceMeters);
            return;
        }

        if ("helicopter".equals(prefs.getString(KEY_PHASE, ""))) {
            if (resolveHelicopterIfReached(routeProgressMeters, navigationSpeaking, distanceToNextManeuverMeters)) return;
        }

        long nextEventAt = prefs.getLong(KEY_NEXT_EVENT_AT, 0L);
        int chaseCount = prefs.getInt(KEY_CHASE_COUNT, 0);
        boolean chaseWindow =
            elapsedSeconds >= Math.max(150d, plannedSeconds * 0.14d) &&
            completionRatio < 0.76d &&
            chaseCount < 2 &&
            now >= nextEventAt;

        if (
            chaseWindow &&
            offRouteMeters <= 55d &&
            distanceToNextManeuverMeters > 180d &&
            !navigationSpeaking &&
            !blockedAccelerationNear(routeProgressMeters)
        ) {
            double recentSpeed = recentSpeedMps(now);
            if (recentSpeed >= 1.2d) {
                startChase(now, totalDistanceMeters, recentSpeed, elapsedSeconds, plannedSeconds, chaseCount);
                return;
            }
        }

        if (
            !prefs.getBoolean(KEY_HELICOPTER_TRIGGERED, false) &&
            completionRatio >= 0.52d &&
            now >= prefs.getLong(KEY_NEXT_EVENT_AT, 0L) &&
            canSpeakStory(navigationSpeaking, distanceToNextManeuverMeters)
        ) {
            StoryAnchor cover = nextCoverAnchor(routeProgressMeters);
            if (cover != null) {
                prefs.edit()
                    .putBoolean(KEY_HELICOPTER_TRIGGERED, true)
                    .putString(KEY_PHASE, "helicopter")
                    .putLong(KEY_HELICOPTER_TARGET_BITS, Double.doubleToRawLongBits(cover.distanceMeters))
                    .apply();
                int remaining = Math.max(0, (int) Math.round(cover.distanceMeters - routeProgressMeters));
                updateRadio("AIR UNIT HAS VISUAL", "Keep running · cover " + remaining + " m ahead");
                speak("Runner. Air unit above us. They've got visual. Keep running. Cover ahead — get under it.");
                return;
            }
        }

        if (completionRatio >= 0.84d && !prefs.getBoolean(KEY_HOME_LINE, false) && canSpeakStory(navigationSpeaking, distanceToNextManeuverMeters)) {
            if (speak("You're almost clear, Runner. Bring the relay key home.")) {
                updateRadio("EXTRACTION WINDOW", "Almost clear. Bring the relay key home.");
                prefs.edit().putBoolean(KEY_HOME_LINE, true).putString(KEY_PHASE, "home").apply();
            }
        }
    }

    public void shutdown() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        speaking = false;
    }

    private void resetMissionState(String nextSessionId) {
        String difficulty = prefs.getString(KEY_DIFFICULTY, "standard");
        prefs.edit().clear()
            .putString(KEY_SESSION_ID, nextSessionId)
            .putString(KEY_DIFFICULTY, difficulty)
            .putBoolean(KEY_ENABLED, false)
            .putString(KEY_PHASE, "opening")
            .putString(KEY_RADIO_TITLE, "COMMS ONLINE")
            .putString(KEY_RADIO_DETAIL, "Mission channel connected. Keep moving.")
            .putString(KEY_LAST_OUTCOME, "")
            .putLong(KEY_NEXT_EVENT_AT, 0L)
            .putLong(KEY_UPDATED_AT, System.currentTimeMillis())
            .apply();
    }

    private boolean canSpeakStory(boolean navigationSpeaking, double distanceToNextManeuverMeters) {
        return !navigationSpeaking && !speaking && distanceToNextManeuverMeters > 165d;
    }

    private void addSpeedSample(long at, double distanceMeters) {
        SpeedSample last = speedSamples.peekLast();
        if (last == null || at > last.at) speedSamples.addLast(new SpeedSample(at, distanceMeters));
        long cutoff = at - 50_000L;
        while (speedSamples.size() > 2 && speedSamples.peekFirst().at < cutoff) speedSamples.removeFirst();
    }

    private double recentSpeedMps(long now) {
        if (speedSamples.size() < 2) return 0d;
        SpeedSample latest = speedSamples.peekLast();
        SpeedSample firstUseful = speedSamples.peekFirst();
        for (SpeedSample sample : speedSamples) {
            firstUseful = sample;
            if (sample.at >= now - 40_000L) break;
        }
        double seconds = Math.max(1d, (latest.at - firstUseful.at) / 1000d);
        return Math.max(0d, (latest.distanceMeters - firstUseful.distanceMeters) / seconds);
    }

    private void startChase(long now, double distanceMeters, double recentSpeed, double elapsedSeconds, double plannedSeconds, int chaseCount) {
        String difficulty = prefs.getString(KEY_DIFFICULTY, "standard");
        double baseIncrease = "casual".equals(difficulty) ? 0.08d : "intense".equals(difficulty) ? 0.22d : 0.15d;
        double runProgress = Math.max(0d, elapsedSeconds / Math.max(60d, plannedSeconds));
        double fatigueAdjustment = Math.min(0.055d, Math.max(0d, runProgress - 0.45d) * 0.08d);
        double historyAdjustment = chaseHistoryAdjustment();
        double increase = Math.max(0.05d, baseIncrease - fatigueAdjustment + historyAdjustment);
        double targetSpeed = Math.max(1.2d, recentSpeed) * (1d + increase);
        int baseDuration = "casual".equals(difficulty) ? 35 : "intense".equals(difficulty) ? 55 : 45;
        int durationAdjustment = runProgress > 0.8d ? -10 : runProgress < 0.25d ? 5 : 0;
        int variation = Math.floorMod((sessionId + ":" + chaseCount).hashCode(), 31) - 15;
        int duration = Math.max(20, Math.min(90, baseDuration + durationAdjustment + variation));

        prefs.edit()
            .putBoolean(KEY_ACTIVE_CHASE, true)
            .putString(KEY_PHASE, "chase")
            .putLong(KEY_CHASE_STARTED_AT, now)
            .putInt(KEY_CHASE_DURATION_SECONDS, duration)
            .putLong(KEY_CHASE_TARGET_BITS, Double.doubleToRawLongBits(targetSpeed))
            .putLong(KEY_CHASE_START_DISTANCE_BITS, Double.doubleToRawLongBits(distanceMeters))
            .putLong(KEY_CHASE_ACHIEVED_BITS, Double.doubleToRawLongBits(0d))
            .putString(KEY_RADIO_TITLE, "PURSUIT · MOVE")
            .putString(KEY_RADIO_DETAIL, "Adaptive chase · " + duration + " seconds")
            .putLong(KEY_UPDATED_AT, now)
            .apply();
        speak("Runner, you've got company. Another runner is closing fast. Move.");
    }

    private void updateActiveChase(long now, double totalDistanceMeters) {
        long startedAt = prefs.getLong(KEY_CHASE_STARTED_AT, now);
        int duration = prefs.getInt(KEY_CHASE_DURATION_SECONDS, 45);
        double startDistance = readDouble(KEY_CHASE_START_DISTANCE_BITS, totalDistanceMeters);
        double targetSpeed = readDouble(KEY_CHASE_TARGET_BITS, 1.2d);
        double elapsed = Math.max(1d, (now - startedAt) / 1000d);
        double achievedSpeed = Math.max(0d, (totalDistanceMeters - startDistance) / elapsed);
        prefs.edit()
            .putLong(KEY_CHASE_ACHIEVED_BITS, Double.doubleToRawLongBits(achievedSpeed))
            .putString(KEY_RADIO_TITLE, achievedSpeed >= targetSpeed * 0.95d ? "YOU'RE OPENING A GAP" : "THEY'RE CLOSING")
            .putString(KEY_RADIO_DETAIL, "Keep moving. The outcome changes the mission — not your XP.")
            .putLong(KEY_UPDATED_AT, now)
            .apply();

        if (elapsed < duration) return;
        finishChase(now, targetSpeed, achievedSpeed);
    }

    private void finishChase(long now, double targetSpeed, double achievedSpeed) {
        double ratio = achievedSpeed / Math.max(0.1d, targetSpeed);
        String outcome;
        String title;
        String detail;
        String line;
        if (ratio >= 0.95d) {
            outcome = "escaped";
            title = "PURSUIT BROKEN";
            detail = "Nice. They lost the line.";
            line = "Nice. You opened the gap. They lost the line. Settle back into your rhythm.";
        } else if (ratio >= 0.78d) {
            outcome = "pressure";
            title = "THEY'RE STILL WITH YOU";
            detail = "Pressure stays in the story. No XP lost.";
            line = "They're still with you. Don't force it. Keep moving and I'll change the plan.";
        } else {
            outcome = "caught-branch";
            title = "INTERCEPTED · NEW PLAN";
            detail = "The mission branches. Your run is still fully banked.";
            line = "They've cut you off. Change of plan. Keep moving. This isn't over.";
        }

        chaseHistory.add(new ChaseResult(targetSpeed, achievedSpeed));
        int nextCount = prefs.getInt(KEY_CHASE_COUNT, 0) + 1;
        prefs.edit()
            .putBoolean(KEY_ACTIVE_CHASE, false)
            .putInt(KEY_CHASE_COUNT, nextCount)
            .putString(KEY_PHASE, "aftermath")
            .putString(KEY_LAST_OUTCOME, outcome)
            .putString(KEY_RADIO_TITLE, title)
            .putString(KEY_RADIO_DETAIL, detail)
            .putLong(KEY_NEXT_EVENT_AT, now + 90_000L)
            .putLong(KEY_UPDATED_AT, now)
            .apply();
        speak(line);
    }

    private double chaseHistoryAdjustment() {
        if (chaseHistory.isEmpty()) return 0d;
        int start = Math.max(0, chaseHistory.size() - 3);
        double total = 0d;
        int count = 0;
        for (int index = start; index < chaseHistory.size(); index += 1) {
            ChaseResult result = chaseHistory.get(index);
            total += result.achievedSpeed / Math.max(0.1d, result.targetSpeed);
            count += 1;
        }
        double average = count == 0 ? 1d : total / count;
        if (average < 0.88d) return -0.035d;
        if (average > 1.08d) return 0.025d;
        return 0d;
    }

    private boolean blockedAccelerationNear(double routeProgressMeters) {
        for (StoryAnchor anchor : storyAnchors) {
            if (!anchor.blocksAcceleration || anchor.confidence < 0.75d) continue;
            if (anchor.distanceMeters >= routeProgressMeters - 35d && anchor.distanceMeters <= routeProgressMeters + 140d) return true;
        }
        return false;
    }

    private StoryAnchor nextCoverAnchor(double routeProgressMeters) {
        StoryAnchor best = null;
        for (StoryAnchor anchor : storyAnchors) {
            if (!"cover".equals(anchor.kind) || anchor.confidence < 0.8d) continue;
            if (anchor.distanceMeters <= routeProgressMeters + 80d || anchor.distanceMeters >= routeProgressMeters + 900d) continue;
            if (best == null || anchor.distanceMeters < best.distanceMeters) best = anchor;
        }
        return best;
    }

    private boolean resolveHelicopterIfReached(double routeProgressMeters, boolean navigationSpeaking, double distanceToNextManeuverMeters) {
        double target = readDouble(KEY_HELICOPTER_TARGET_BITS, -1d);
        if (target <= 0d) return false;
        double remaining = target - routeProgressMeters;
        if (remaining > 18d) {
            updateRadio("AIR UNIT HAS VISUAL", "Keep running · cover " + Math.max(0, (int) Math.round(remaining)) + " m ahead");
            return true;
        }

        prefs.edit()
            .putString(KEY_PHASE, "aftermath")
            .putLong(KEY_HELICOPTER_TARGET_BITS, Double.doubleToRawLongBits(-1d))
            .putLong(KEY_NEXT_EVENT_AT, System.currentTimeMillis() + 120_000L)
            .apply();
        updateRadio("VISUAL BROKEN", "Cover reached. Keep the line moving.");
        if (canSpeakStory(navigationSpeaking, distanceToNextManeuverMeters)) speak("Cover reached. They've lost visual. Nice work. Keep moving.");
        return false;
    }

    private void updateRadio(String title, String detail) {
        prefs.edit()
            .putString(KEY_RADIO_TITLE, title)
            .putString(KEY_RADIO_DETAIL, detail)
            .putLong(KEY_UPDATED_AT, System.currentTimeMillis())
            .apply();
    }

    private boolean speak(String text) {
        if (!ttsReady || tts == null || speaking || text == null || text.trim().isEmpty()) return false;
        String utteranceId = "zenchad-native-story-" + UUID.randomUUID();
        int result = tts.speak(text.trim(), TextToSpeech.QUEUE_ADD, new Bundle(), utteranceId);
        return result != TextToSpeech.ERROR;
    }

    private void reloadRouteIfNeeded() {
        File file = new File(context.getFilesDir(), RunningBackgroundNavigationPlugin.ROUTE_FILE);
        if (!file.exists()) {
            routeMode = "";
            storyAnchors.clear();
            return;
        }
        long modified = file.lastModified();
        if (modified == routeModifiedAt) return;
        routeModifiedAt = modified;

        try {
            JSONObject route = new JSONObject(readFile(file));
            if (!sessionId.equals(route.optString("sessionId", ""))) {
                routeMode = "";
                storyAnchors.clear();
                return;
            }
            routeMode = route.optString("mode", "");
            plannedMinutes = Math.max(8, route.optInt("plannedMinutes", 30));
            storyAnchors.clear();
            JSONArray anchors = route.optJSONArray("storyAnchors");
            if (anchors != null) {
                for (int index = 0; index < anchors.length(); index += 1) {
                    JSONObject json = anchors.getJSONObject(index);
                    String kind = json.optString("kind", "neutral");
                    boolean blocks = "junction".equals(kind) || "road-crossing".equals(kind) || "steep-descent".equals(kind) || "stairs".equals(kind);
                    storyAnchors.add(new StoryAnchor(
                        kind,
                        json.optDouble("distanceMeters", 0d),
                        json.optDouble("confidence", 0d),
                        blocks
                    ));
                }
            }
        } catch (IOException | JSONException error) {
            routeMode = "";
            storyAnchors.clear();
        }
    }

    private String readFile(File file) throws IOException {
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) builder.append(line);
        }
        return builder.toString();
    }

    private double readDouble(String key, double fallback) {
        if (!prefs.contains(key)) return fallback;
        return Double.longBitsToDouble(prefs.getLong(key, Double.doubleToRawLongBits(fallback)));
    }

    private static class SpeedSample {
        final long at;
        final double distanceMeters;
        SpeedSample(long at, double distanceMeters) {
            this.at = at;
            this.distanceMeters = distanceMeters;
        }
    }

    private static class ChaseResult {
        final double targetSpeed;
        final double achievedSpeed;
        ChaseResult(double targetSpeed, double achievedSpeed) {
            this.targetSpeed = targetSpeed;
            this.achievedSpeed = achievedSpeed;
        }
    }

    private static class StoryAnchor {
        final String kind;
        final double distanceMeters;
        final double confidence;
        final boolean blocksAcceleration;
        StoryAnchor(String kind, double distanceMeters, double confidence, boolean blocksAcceleration) {
            this.kind = kind;
            this.distanceMeters = distanceMeters;
            this.confidence = confidence;
            this.blocksAcceleration = blocksAcceleration;
        }
    }
}
