package com.zenchad.minddojo;

import android.content.Context;
import android.content.SharedPreferences;

public class RunningStorySfxController {
    private final Context context;
    private final SharedPreferences prefs;
    private final SharedPreferences trackerPrefs;
    private final RunningStorySfxEngine engine;
    private boolean chaseWasActive = false;
    private boolean helicopterWasActive = false;
    private String lastOutcome = "";
    private String sessionId = "";
    private boolean previousSfxEnabled = true;

    public RunningStorySfxController(Context context) {
        this.context = context.getApplicationContext();
        prefs = RunningBackgroundStoryDirector.getStore(this.context);
        trackerPrefs = RunningTrackerService.getStore(this.context);
        engine = new RunningStorySfxEngine(this.context);
        syncAudioSettings();
    }

    public void sync() {
        syncAudioSettings();
        String currentSession = prefs.getString(RunningBackgroundStoryDirector.KEY_SESSION_ID, "");
        if (!currentSession.equals(sessionId)) {
            sessionId = currentSession;
            // Reconstruct persisted mission state instead of assuming this is a new run.
            // Android can recreate this controller after killing the process while the same
            // foreground run is still active.
            chaseWasActive = prefs.getBoolean(RunningBackgroundStoryDirector.KEY_ACTIVE_CHASE, false);
            helicopterWasActive = "helicopter".equals(prefs.getString(RunningBackgroundStoryDirector.KEY_PHASE, ""));
            lastOutcome = prefs.getString(RunningBackgroundStoryDirector.KEY_LAST_OUTCOME, "");
            previousSfxEnabled = false;
            engine.stopHelicopter();
            // Do not clear the persisted event log here. RunningStoryEventLog.append already
            // resets itself when (and only when) the actual run session ID changes.
        }

        boolean enabled = prefs.getBoolean(RunningBackgroundStoryDirector.KEY_ENABLED, false);
        boolean sfxEnabled = RunningStoryAudioSettings.isSfxEnabled(context);
        if (!enabled || !sfxEnabled) {
            engine.stopHelicopter();
            previousSfxEnabled = sfxEnabled;
            return;
        }

        double runDistance = currentDistanceMeters();
        long now = System.currentTimeMillis();
        boolean chaseActive = prefs.getBoolean(RunningBackgroundStoryDirector.KEY_ACTIVE_CHASE, false);
        if (chaseActive && !chaseWasActive) {
            engine.playPursuitStinger();
            RunningStoryEventLog.append(context, sessionId, "chase-start", now, runDistance, "Pursuit began");
        }

        String outcome = prefs.getString(RunningBackgroundStoryDirector.KEY_LAST_OUTCOME, "");
        if (!chaseActive && chaseWasActive && !outcome.isEmpty()) {
            RunningStoryEventLog.append(context, sessionId, "chase-outcome", now, runDistance, outcome);
        }
        chaseWasActive = chaseActive;

        boolean helicopterActive = "helicopter".equals(prefs.getString(RunningBackgroundStoryDirector.KEY_PHASE, ""));
        if (helicopterActive && (!helicopterWasActive || !previousSfxEnabled)) {
            engine.startHelicopter();
            if (!helicopterWasActive) {
                RunningStoryEventLog.append(context, sessionId, "helicopter-start", now, runDistance, "Air unit acquired visual");
            }
        } else if (!helicopterActive && helicopterWasActive) {
            engine.stopHelicopter();
            RunningStoryEventLog.append(context, sessionId, "helicopter-cover", now, runDistance, "Air unit visual broken");
        }
        helicopterWasActive = helicopterActive;

        if (!outcome.isEmpty() && !outcome.equals(lastOutcome)) {
            if ("escaped".equals(outcome)) engine.playEscapeStinger();
            else if ("caught-branch".equals(outcome)) engine.playInterceptionStinger();
            lastOutcome = outcome;
        }
        previousSfxEnabled = sfxEnabled;
    }

    public void shutdown() {
        engine.shutdown();
    }

    private void syncAudioSettings() {
        engine.setVolume(RunningStoryAudioSettings.getSfxVolume(context));
    }

    private double currentDistanceMeters() {
        if (!trackerPrefs.contains(RunningTrackerService.KEY_DISTANCE_BITS)) return 0d;
        return Double.longBitsToDouble(trackerPrefs.getLong(
            RunningTrackerService.KEY_DISTANCE_BITS,
            Double.doubleToRawLongBits(0d)
        ));
    }
}
