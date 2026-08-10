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

@CapacitorPlugin(name = "RunningStorySpeech")
public class RunningStorySpeechPlugin extends Plugin implements TextToSpeech.OnInitListener {
    private TextToSpeech tts;
    private boolean ready = false;
    private final Map<String, PluginCall> activeCalls = new ConcurrentHashMap<>();

    @Override
    public void load() {
        tts = new TextToSpeech(getContext(), this);
    }

    @Override
    public void onInit(int status) {
        ready = status == TextToSpeech.SUCCESS;
        if (!ready || tts == null) return;
        tts.setLanguage(Locale.UK);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            // Deliberately MEDIA, with no AudioManager focus request: Story dialogue should mix over Spotify/etc.
            AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();
            tts.setAudioAttributes(attributes);
        }
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String utteranceId) {}
            @Override public void onDone(String utteranceId) {
                PluginCall call = activeCalls.remove(utteranceId);
                if (call != null) call.resolve();
            }
            @Override public void onError(String utteranceId) {
                PluginCall call = activeCalls.remove(utteranceId);
                if (call != null) call.reject("Story dialogue could not be spoken.");
            }
        });
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "").trim();
        if (text.isEmpty()) {
            call.resolve();
            return;
        }
        if (!ready || tts == null) {
            call.reject("Story text-to-speech is not ready.");
            return;
        }
        String utteranceId = "zenchad-story-" + UUID.randomUUID();
        activeCalls.put(utteranceId, call);
        int result = tts.speak(text, TextToSpeech.QUEUE_ADD, new Bundle(), utteranceId);
        if (result == TextToSpeech.ERROR) {
            activeCalls.remove(utteranceId);
            call.reject("Story dialogue could not be spoken.");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (tts != null) tts.stop();
        for (PluginCall active : activeCalls.values()) active.resolve();
        activeCalls.clear();
        call.resolve();
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
        super.handleOnDestroy();
    }
}
