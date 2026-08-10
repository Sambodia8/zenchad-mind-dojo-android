package com.zenchad.minddojo;

import android.content.Context;
import android.content.SharedPreferences;

public class RunningStorySfxController {
    private final SharedPreferences prefs;
    private final RunningStorySfxEngine engine = new RunningStorySfxEngine();
    private boolean chaseWasActive = false;
    private boolean helicopterWasActive = false;
    private String lastOutcome = "";
    private String sessionId = "";

    public RunningStorySfxController(Context context) {
        prefs = RunningBackgroundStoryDirector.getStore(context.getApplicationContext());
    }

    public void sync() {
        String currentSession = prefs.getString(RunningBackgroundStoryDirector.KEY_SESSION_ID, "");
        if (!currentSession.equals(sessionId)) {
            sessionId = currentSession;
            chaseWasActive = false;
            helicopterWasActive = false;
            lastOutcome = "";
            engine.stopHelicopter();
        }

        boolean enabled = prefs.getBoolean(RunningBackgroundStoryDirector.KEY_ENABLED, false);
        if (!enabled) {
            engine.stopHelicopter();
            chaseWasActive = false;
            helicopterWasActive = false;
            return;
        }

        boolean chaseActive = prefs.getBoolean(RunningBackgroundStoryDirector.KEY_ACTIVE_CHASE, false);
        if (chaseActive && !chaseWasActive) engine.playPursuitStinger();
        chaseWasActive = chaseActive;

        boolean helicopterActive = "helicopter".equals(prefs.getString(RunningBackgroundStoryDirector.KEY_PHASE, ""));
        if (helicopterActive && !helicopterWasActive) engine.startHelicopter();
        else if (!helicopterActive && helicopterWasActive) engine.stopHelicopter();
        helicopterWasActive = helicopterActive;

        String outcome = prefs.getString(RunningBackgroundStoryDirector.KEY_LAST_OUTCOME, "");
        if (!outcome.isEmpty() && !outcome.equals(lastOutcome)) {
            if ("escaped".equals(outcome)) engine.playEscapeStinger();
            else if ("caught-branch".equals(outcome)) engine.playInterceptionStinger();
            lastOutcome = outcome;
        }
    }

    public void shutdown() {
        engine.shutdown();
    }
}
