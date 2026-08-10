package com.zenchad.minddojo;

import android.content.Context;
import android.content.SharedPreferences;

public final class RunningStoryAudioSettings {
    private static final String PREFS_NAME = "zenchad_running_story_audio_v1";
    private static final String KEY_SFX_ENABLED = "sfxEnabled";
    private static final String KEY_SFX_VOLUME_BITS = "sfxVolumeBits";
    private static final String KEY_VOICE_VOLUME_BITS = "voiceVolumeBits";

    private RunningStoryAudioSettings() {}

    public static boolean isSfxEnabled(Context context) {
        return store(context).getBoolean(KEY_SFX_ENABLED, true);
    }

    public static double getSfxVolume(Context context) {
        return readDouble(context, KEY_SFX_VOLUME_BITS, 0.72d);
    }

    public static double getVoiceVolume(Context context) {
        return readDouble(context, KEY_VOICE_VOLUME_BITS, 0.92d);
    }

    public static void setSfxEnabled(Context context, boolean enabled) {
        store(context).edit().putBoolean(KEY_SFX_ENABLED, enabled).apply();
    }

    public static void setSfxVolume(Context context, double volume) {
        writeDouble(context, KEY_SFX_VOLUME_BITS, clamp(volume));
    }

    public static void setVoiceVolume(Context context, double volume) {
        writeDouble(context, KEY_VOICE_VOLUME_BITS, clamp(volume));
    }

    public static Snapshot snapshot(Context context) {
        return new Snapshot(isSfxEnabled(context), getSfxVolume(context), getVoiceVolume(context));
    }

    private static SharedPreferences store(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static double readDouble(Context context, String key, double fallback) {
        SharedPreferences prefs = store(context);
        if (!prefs.contains(key)) return fallback;
        return clamp(Double.longBitsToDouble(prefs.getLong(key, Double.doubleToRawLongBits(fallback))));
    }

    private static void writeDouble(Context context, String key, double value) {
        store(context).edit().putLong(key, Double.doubleToRawLongBits(value)).apply();
    }

    private static double clamp(double value) {
        if (!Double.isFinite(value)) return 1d;
        return Math.max(0d, Math.min(1d, value));
    }

    public static final class Snapshot {
        public final boolean sfxEnabled;
        public final double sfxVolume;
        public final double voiceVolume;

        Snapshot(boolean sfxEnabled, double sfxVolume, double voiceVolume) {
            this.sfxEnabled = sfxEnabled;
            this.sfxVolume = sfxVolume;
            this.voiceVolume = voiceVolume;
        }
    }
}
