package com.zenchad.minddojo;

import android.media.AudioAttributes;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "RunningSpeech")
public class RunningSpeechPlugin extends Plugin implements TextToSpeech.OnInitListener {
    private TextToSpeech tts;
    private boolean ready = false;
    private PluginCall pendingCall;
    private String pendingText;
    private final Map<String, PluginCall> activeCalls = new ConcurrentHashMap<>();

    @Override
    public void load() {
        tts = new TextToSpeech(getContext(), this);
    }

    @Override
    public void onInit(int status) {
        ready = status == TextToSpeech.SUCCESS;
        if (ready && tts != null) {
            tts.setLanguage(Locale.UK);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
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
                    PluginCall call = activeCalls.remove(utteranceId);
                    if (call != null) call.resolve();
                }

                @Override
                public void onError(String utteranceId) {
                    PluginCall call = activeCalls.remove(utteranceId);
                    if (call != null) call.reject("Navigation instruction could not be spoken.");
                }
            });
        }
        if (pendingCall != null) {
            PluginCall call = pendingCall;
            String text = pendingText;
            pendingCall = null;
            pendingText = null;
            if (ready) speakInternal(call, text);
            else call.reject("Android text-to-speech is unavailable.");
        }
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "").trim();
        if (text.isEmpty()) {
            call.resolve();
            return;
        }
        if (!ready) {
            pendingCall = call;
            pendingText = text;
            return;
        }
        speakInternal(call, text);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (tts != null) tts.stop();
        for (PluginCall active : activeCalls.values()) active.resolve();
        activeCalls.clear();
        call.resolve();
    }

    private void speakInternal(PluginCall call, String text) {
        if (tts == null) {
            call.reject("Android text-to-speech is unavailable.");
            return;
        }
        Bundle params = new Bundle();
        String utteranceId = "zenchad-nav-" + UUID.randomUUID();
        activeCalls.put(utteranceId, call);
        int result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
        if (result == TextToSpeech.ERROR) {
            activeCalls.remove(utteranceId);
            call.reject("Navigation instruction could not be spoken.");
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        for (PluginCall active : activeCalls.values()) active.resolve();
        activeCalls.clear();
        ready = false;
        pendingCall = null;
        pendingText = null;
        super.handleOnDestroy();
    }
}
