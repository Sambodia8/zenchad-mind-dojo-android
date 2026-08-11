package com.zenchad.minddojo;

import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RunningStoryDirector")
public class RunningStoryDirectorPlugin extends Plugin {
    @PluginMethod
    public void getSnapshot(PluginCall call) {
        call.resolve(snapshot());
    }

    @PluginMethod
    public void setDifficulty(PluginCall call) {
        String difficulty = call.getString("difficulty", "standard");
        if (!"casual".equals(difficulty) && !"standard".equals(difficulty) && !"intense".equals(difficulty)) {
            call.reject("Difficulty must be casual, standard or intense.");
            return;
        }
        RunningBackgroundStoryDirector.getStore(getContext()).edit()
            .putString(RunningBackgroundStoryDirector.KEY_DIFFICULTY, difficulty)
            .apply();
        call.resolve(snapshot());
    }

    @PluginMethod
    public void setAudioSettings(PluginCall call) {
        Boolean enabled = call.getBoolean("sfxEnabled");
        Double sfxVolume = call.getDouble("sfxVolume");
        Double voiceVolume = call.getDouble("voiceVolume");
        if (enabled != null) RunningStoryAudioSettings.setSfxEnabled(getContext(), enabled);
        if (sfxVolume != null) RunningStoryAudioSettings.setSfxVolume(getContext(), sfxVolume);
        if (voiceVolume != null) RunningStoryAudioSettings.setVoiceVolume(getContext(), voiceVolume);
        call.resolve(snapshot());
    }

    @PluginMethod
    public void clear(PluginCall call) {
        RunningBackgroundStoryDirector.clearStore(getContext());
        call.resolve(snapshot());
    }

    private JSObject snapshot() {
        SharedPreferences prefs = RunningBackgroundStoryDirector.getStore(getContext());
        String sessionId = prefs.getString(RunningBackgroundStoryDirector.KEY_SESSION_ID, "");
        RunningStoryAudioSettings.Snapshot audio = RunningStoryAudioSettings.snapshot(getContext());
        JSObject result = new JSObject();
        result.put("sessionId", sessionId);
        result.put("enabled", prefs.getBoolean(RunningBackgroundStoryDirector.KEY_ENABLED, false));
        result.put("missionId", prefs.getString(RunningBackgroundStoryDirector.KEY_MISSION_ID, "ghost-signal-001"));
        result.put("missionTitle", prefs.getString(RunningBackgroundStoryDirector.KEY_MISSION_TITLE, "Ghost Signal"));
        result.put("difficulty", prefs.getString(RunningBackgroundStoryDirector.KEY_DIFFICULTY, "standard"));
        result.put("phase", prefs.getString(RunningBackgroundStoryDirector.KEY_PHASE, "opening"));
        result.put("radioTitle", prefs.getString(RunningBackgroundStoryDirector.KEY_RADIO_TITLE, "COMMS ONLINE"));
        result.put("radioDetail", prefs.getString(RunningBackgroundStoryDirector.KEY_RADIO_DETAIL, "Mission channel connected. Keep moving."));
        result.put("chaseCount", prefs.getInt(RunningBackgroundStoryDirector.KEY_CHASE_COUNT, 0));
        result.put("activeChase", prefs.getBoolean(RunningBackgroundStoryDirector.KEY_ACTIVE_CHASE, false));
        result.put("chaseStartedAt", prefs.getLong(RunningBackgroundStoryDirector.KEY_CHASE_STARTED_AT, 0L));
        result.put("chaseDurationSeconds", prefs.getInt(RunningBackgroundStoryDirector.KEY_CHASE_DURATION_SECONDS, 0));
        result.put("chaseTargetSpeedMps", readDouble(prefs, RunningBackgroundStoryDirector.KEY_CHASE_TARGET_BITS, 0d));
        result.put("chaseAchievedSpeedMps", readDouble(prefs, RunningBackgroundStoryDirector.KEY_CHASE_ACHIEVED_BITS, 0d));
        result.put("lastOutcome", prefs.getString(RunningBackgroundStoryDirector.KEY_LAST_OUTCOME, ""));
        result.put("helicopterTriggered", prefs.getBoolean(RunningBackgroundStoryDirector.KEY_HELICOPTER_TRIGGERED, false));
        result.put("helicopterTargetDistanceMeters", readDouble(prefs, RunningBackgroundStoryDirector.KEY_HELICOPTER_TARGET_BITS, -1d));
        result.put("eventsJson", RunningStoryEventLog.json(getContext(), sessionId));
        result.put("sfxEnabled", audio.sfxEnabled);
        result.put("sfxVolume", audio.sfxVolume);
        result.put("voiceVolume", audio.voiceVolume);
        result.put("updatedAt", prefs.getLong(RunningBackgroundStoryDirector.KEY_UPDATED_AT, 0L));
        return result;
    }

    private double readDouble(SharedPreferences prefs, String key, double fallback) {
        if (!prefs.contains(key)) return fallback;
        return Double.longBitsToDouble(prefs.getLong(key, Double.doubleToRawLongBits(fallback)));
    }
}
