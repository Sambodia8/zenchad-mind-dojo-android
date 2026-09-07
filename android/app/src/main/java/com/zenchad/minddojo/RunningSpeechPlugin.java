package com.zenchad.minddojo;

import android.media.AudioAttributes;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Map;
import java.util.ArrayDeque;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "RunningSpeech")
public class RunningSpeechPlugin extends Plugin implements TextToSpeech.OnInitListener {
    private static final long INITIALISATION_TIMEOUT_MS = 6_000L;
    private TextToSpeech tts;
    private boolean ready = false;
    private boolean initialised = false;
    private static class PendingSpeech {
        final PluginCall call;
        final String text;
        final String voiceId;

        PendingSpeech(PluginCall call, String text, String voiceId) {
            this.call = call;
            this.text = text;
            this.voiceId = voiceId;
        }
    }
    private final ArrayDeque<PendingSpeech> pendingSpeeches = new ArrayDeque<>();
    private final ArrayDeque<PluginCall> pendingVoiceCalls = new ArrayDeque<>();
    private Voice systemDefaultVoice;
    private static class ActiveSpeech {
        final PluginCall call;
        final String text;
        final int fallbackStage;

        ActiveSpeech(PluginCall call, String text, int fallbackStage) {
            this.call = call;
            this.text = text;
            this.fallbackStage = fallbackStage;
        }
    }
    private final Map<String, ActiveSpeech> activeCalls = new ConcurrentHashMap<>();
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        tts = new TextToSpeech(getContext(), this);
        handler.postDelayed(() -> {
            if (initialised) return;
            initialised = true;
            ready = false;
            while (!pendingVoiceCalls.isEmpty()) pendingVoiceCalls.removeFirst().reject("Android text-to-speech did not become ready.");
            while (!pendingSpeeches.isEmpty()) pendingSpeeches.removeFirst().call.reject("Android text-to-speech did not become ready.");
            JSObject event = voiceResult();
            event.put("ready", false);
            notifyListeners("voicesReady", event);
        }, INITIALISATION_TIMEOUT_MS);
    }

    @Override
    public void onInit(int status) {
        initialised = true;
        ready = status == TextToSpeech.SUCCESS;
        if (ready && tts != null) {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                systemDefaultVoice = tts.getVoice();
                AudioAttributes attributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();
                tts.setAudioAttributes(attributes);
            }
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {
                    // Keep the Capacitor promise open so transient audio focus stays held.
                }

                @Override
                public void onDone(String utteranceId) {
                    ActiveSpeech active = activeCalls.remove(utteranceId);
                    if (active != null) active.call.resolve();
                }

                @Override
                public void onError(String utteranceId) {
                    retryOrReject(utteranceId);
                }
            });
        }
        while (!pendingSpeeches.isEmpty()) {
            PendingSpeech pending = pendingSpeeches.removeFirst();
            if (ready) speakInternal(pending.call, pending.text, pending.voiceId);
            else pending.call.reject("Android text-to-speech is unavailable.");
        }
        while (!pendingVoiceCalls.isEmpty()) {
            PluginCall call = pendingVoiceCalls.removeFirst();
            if (ready) resolveVoices(call);
            else call.reject("Android text-to-speech is unavailable.");
        }
        JSObject event = voiceResult();
        event.put("ready", ready);
        notifyListeners("voicesReady", event);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "").trim();
        if (text.isEmpty()) {
            call.resolve();
            return;
        }
        if (!ready) {
            if (initialised) {
                call.reject("Android text-to-speech is unavailable.");
                return;
            }
            pendingSpeeches.addLast(new PendingSpeech(call, text, call.getString("voiceId", "").trim()));
            return;
        }
        speakInternal(call, text, call.getString("voiceId", "").trim());
    }

    @PluginMethod
    public void getVoices(PluginCall call) {
        if (!initialised) {
            pendingVoiceCalls.addLast(call);
            return;
        }
        if (!ready) {
            call.reject("Android text-to-speech is unavailable.");
            return;
        }
        resolveVoices(call);
    }

    @PluginMethod
    public void setVoicePreference(PluginCall call) {
        String voiceId = call.getString("voiceId", "").trim();
        RunningVoicePolicy.persistSelectedVoice(getContext(), voiceId);
        if (ready && tts != null) RunningVoicePolicy.applyPreferred(tts, systemDefaultVoice, voiceId);
        call.resolve();
    }

    private void resolveVoices(PluginCall call) {
        call.resolve(voiceResult());
    }

    private JSObject voiceResult() {
        JSArray voices = new JSArray();
        if (ready && tts != null && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            for (Voice voice : tts.getVoices()) {
                if (voice == null || voice.getName() == null || voice.getLocale() == null) continue;
                JSObject item = new JSObject();
                item.put("id", voice.getName());
                item.put("name", RunningVoicePolicy.friendlyName(voice));
                item.put("lang", voice.getLocale().toLanguageTag());
                item.put("localeLabel", RunningVoicePolicy.localeLabel(voice));
                item.put("default", systemDefaultVoice != null && voice.getName().equals(systemDefaultVoice.getName()));
                item.put("networkRequired", voice.isNetworkConnectionRequired());
                item.put("installed", RunningVoicePolicy.isInstalled(voice));
                voices.put(item);
            }
        }
        JSObject result = new JSObject();
        result.put("voices", voices);
        return result;
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (tts != null) tts.stop();
        while (!pendingSpeeches.isEmpty()) pendingSpeeches.removeFirst().call.resolve();
        for (ActiveSpeech active : activeCalls.values()) active.call.resolve();
        activeCalls.clear();
        call.resolve();
    }

    private void speakInternal(PluginCall call, String text, String requestedVoiceId) {
        if (tts == null) {
            call.reject("Android text-to-speech is unavailable.");
            return;
        }
        RunningVoicePolicy.applyPreferred(tts, systemDefaultVoice, requestedVoiceId);
        speakAttempt(call, text, 0);
    }

    private void speakAttempt(PluginCall call, String text, int fallbackStage) {
        if (tts == null) {
            call.reject("Android text-to-speech is unavailable.");
            return;
        }
        if (fallbackStage == 1) RunningVoicePolicy.applyLocalFallback(tts, systemDefaultVoice);
        else if (fallbackStage == 2) RunningVoicePolicy.applySystemDefault(tts, systemDefaultVoice);
        Bundle params = new Bundle();
        String utteranceId = "zenchad-nav-" + UUID.randomUUID();
        activeCalls.put(utteranceId, new ActiveSpeech(call, text, fallbackStage));
        int result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
        if (result == TextToSpeech.ERROR) {
            retryOrReject(utteranceId);
        }
    }

    private void retryOrReject(String utteranceId) {
        ActiveSpeech active = activeCalls.remove(utteranceId);
        if (active == null) return;
        if (active.fallbackStage == 0 && RunningVoicePolicy.applyLocalFallback(tts, systemDefaultVoice)) {
            speakAttempt(active.call, active.text, 1);
            return;
        }
        if (active.fallbackStage <= 1 && RunningVoicePolicy.applySystemDefault(tts, systemDefaultVoice)) {
            speakAttempt(active.call, active.text, 2);
            return;
        }
        active.call.reject("Navigation instruction could not be spoken.");
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        for (ActiveSpeech active : activeCalls.values()) active.call.resolve();
        activeCalls.clear();
        ready = false;
        initialised = true;
        while (!pendingSpeeches.isEmpty()) pendingSpeeches.removeFirst().call.resolve();
        while (!pendingVoiceCalls.isEmpty()) pendingVoiceCalls.removeFirst().reject("Android text-to-speech is unavailable.");
        super.handleOnDestroy();
    }
}
