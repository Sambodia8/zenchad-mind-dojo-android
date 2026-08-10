package com.zenchad.minddojo;

import android.content.Context;
import android.content.SharedPreferences;

public class RunningStorySfxController {
    private final Context context;
    private final SharedPreferences prefs;
    private final SharedPreferences trackerPrefs;
    private final RunningStorySfxEngine engine = new RunningStorySfxEngine();
    private boolean chaseWasActive = false;
    private boolean helicopterWasActive = false;
    private String lastOutcome = "";
    private String sessionId = "";

    public RunningStorySfxController(Context context) {
        this.context = context.getApplicationContext();
        prefs = RunningBackgroundStoryDirector.getStore(this.context);
        trackerPrefs = RunningTrackerService.getStore(this.context);
    }

    public void sync() {
        String currentSession = prefs.getString(RunningBackgroundStoryDirector.KEY_SESSION_ID, "");
        if (!currentSession.equals(sessionId)) {
            sessionId = currentSession;
            chaseWasActive = false;
            helicopterWasActive = false;
            lastOutcome = "";
            engine.stopHelicopter();
            RunningStoryEventLog.reset(context, sessionId);
        }

        boolean enabled = prefs.getBoolean(RunningBackgroundStoryDirector.KEY_ENABLED, false);
        if (!enabled) {
            engine.stopHelicopter();
            chaseWasActive = false;
            helicopterWasActive = false;
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
        if (helicopterActive && !helicopterWasActive) {
            engine.startHelicopter();
            RunningStoryEventLog.append(context, sessionId, "helicopter-start", now, runDistance, "Air unit acquired visual");
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
    }

    public void shutdown() {
        engine.shutdown();
    }

    private double currentDistanceMeters() {
        if (!trackerPrefs.contains(RunningTrackerService.KEY_DISTANCE_BITS)) return 0d;
        return Double.longBitsToDouble(trackerPrefs.getLong(
            RunningTrackerService.KEY_DISTANCE_BITS,
            Double.doubleToRawLongBits(0d)
        ));
    }
}
