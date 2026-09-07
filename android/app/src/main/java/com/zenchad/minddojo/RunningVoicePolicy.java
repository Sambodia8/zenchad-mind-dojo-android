package com.zenchad.minddojo;

import android.content.Context;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;

import java.util.Locale;
import java.util.Set;

/** Shared, offline-first voice selection for foreground and background navigation. */
final class RunningVoicePolicy {
    private static final String PREFS = "zenchad_running_voice_v1";
    private static final String KEY_SELECTED_VOICE = "selectedVoiceId";

    private RunningVoicePolicy() { }

    static void persistSelectedVoice(Context context, String voiceId) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SELECTED_VOICE, voiceId == null ? "" : voiceId.trim())
            .apply();
    }

    static String selectedVoice(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_SELECTED_VOICE, "");
    }

    static boolean isInstalled(Voice voice) {
        if (voice == null) return false;
        Set<String> features = voice.getFeatures();
        return features == null || !features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED);
    }

    static Voice requestedVoice(TextToSpeech tts, String requestedVoiceId) {
        if (tts == null || requestedVoiceId == null || requestedVoiceId.trim().isEmpty()) return null;
        for (Voice voice : tts.getVoices()) {
            if (voice != null && requestedVoiceId.trim().equals(voice.getName()) && isInstalled(voice)) return voice;
        }
        return null;
    }

    private static Voice bestInstalledLocalVoice(TextToSpeech tts, Voice systemDefault) {
        if (tts == null) return null;
        Voice best = null;
        int bestScore = Integer.MIN_VALUE;
        for (Voice voice : tts.getVoices()) {
            if (voice == null || voice.getLocale() == null || voice.isNetworkConnectionRequired() || !isInstalled(voice)) continue;
            String language = voice.getLocale().getLanguage();
            String country = voice.getLocale().getCountry();
            int score = "en".equalsIgnoreCase(language) ? 300 : 20;
            if ("en".equalsIgnoreCase(language) && "GB".equalsIgnoreCase(country)) score += 200;
            if (systemDefault != null && voice.getName().equals(systemDefault.getName())) score += 40;
            if (score > bestScore) {
                best = voice;
                bestScore = score;
            }
        }
        return best;
    }

    static Voice bestLocalVoice(TextToSpeech tts, Voice systemDefault) {
        Voice local = bestInstalledLocalVoice(tts, systemDefault);
        return local != null ? local : systemDefault;
    }

    static Voice preferredVoice(TextToSpeech tts, Voice systemDefault, String requestedVoiceId) {
        Voice requested = requestedVoice(tts, requestedVoiceId);
        if (requested != null) return requested;
        return bestLocalVoice(tts, systemDefault);
    }

    static boolean applyPreferred(TextToSpeech tts, Voice systemDefault, String requestedVoiceId) {
        if (tts == null) return false;
        Voice voice = preferredVoice(tts, systemDefault, requestedVoiceId);
        return voice != null && tts.setVoice(voice) == TextToSpeech.SUCCESS;
    }

    static boolean applyLocalFallback(TextToSpeech tts, Voice systemDefault) {
        if (tts == null) return false;
        Voice local = bestInstalledLocalVoice(tts, systemDefault);
        return local != null && tts.setVoice(local) == TextToSpeech.SUCCESS;
    }

    static boolean applySystemDefault(TextToSpeech tts, Voice systemDefault) {
        if (tts == null) return false;
        return systemDefault != null && tts.setVoice(systemDefault) == TextToSpeech.SUCCESS;
    }

    static boolean applyFallback(TextToSpeech tts, Voice systemDefault) {
        return applyLocalFallback(tts, systemDefault) || applySystemDefault(tts, systemDefault);
    }

    static String localeLabel(Voice voice) {
        if (voice == null || voice.getLocale() == null) return "Unknown language";
        String label = voice.getLocale().getDisplayName(Locale.UK);
        return label == null || label.trim().isEmpty() ? voice.getLocale().toLanguageTag() : label;
    }

    static String friendlyName(Voice voice) {
        String locale = localeLabel(voice);
        if (voice == null || voice.getName() == null) return locale;
        String raw = voice.getName().toLowerCase(Locale.ROOT);
        String variant = "";
        int marker = raw.indexOf("-x-");
        if (marker >= 0 && marker + 3 < raw.length()) {
            String remainder = raw.substring(marker + 3).replace("-local", "").replace("-network", "");
            int dash = remainder.indexOf('-');
            variant = (dash >= 0 ? remainder.substring(0, dash) : remainder).trim();
        }
        return variant.isEmpty() ? locale : locale + " · " + variant.toUpperCase(Locale.ROOT);
    }
}
