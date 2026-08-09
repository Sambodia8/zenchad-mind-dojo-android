package com.zenchad.minddojo;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RunningAudio")
public class RunningAudioPlugin extends Plugin {
    private AudioManager audioManager;
    private AudioFocusRequest navigationFocusRequest;
    private boolean navigationFocusHeld = false;

    private final AudioManager.OnAudioFocusChangeListener focusChangeListener = focusChange -> {
        if (focusChange == AudioManager.AUDIOFOCUS_LOSS) {
            navigationFocusHeld = false;
        }
    };

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    @PluginMethod
    public void beginNavigationFocus(PluginCall call) {
        if (audioManager == null) {
            call.reject("Android audio manager is unavailable.");
            return;
        }

        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();
            navigationFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(attributes)
                .setAcceptsDelayedFocusGain(false)
                .setWillPauseWhenDucked(true)
                .setOnAudioFocusChangeListener(focusChangeListener)
                .build();
            result = audioManager.requestAudioFocus(navigationFocusRequest);
        } else {
            result = audioManager.requestAudioFocus(
                focusChangeListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
            );
        }

        navigationFocusHeld = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        JSObject response = new JSObject();
        response.put("granted", navigationFocusHeld);
        call.resolve(response);
    }

    @PluginMethod
    public void endNavigationFocus(PluginCall call) {
        releaseNavigationFocus();
        call.resolve();
    }

    @PluginMethod
    public void getPolicy(PluginCall call) {
        JSObject response = new JSObject();
        response.put("storyAudioRequestsFocus", false);
        response.put("navigationRequestsTransientFocus", true);
        response.put("navigationFocusHeld", navigationFocusHeld);
        call.resolve(response);
    }

    @Override
    protected void handleOnDestroy() {
        releaseNavigationFocus();
        super.handleOnDestroy();
    }

    private void releaseNavigationFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && navigationFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(navigationFocusRequest);
            navigationFocusRequest = null;
        } else {
            audioManager.abandonAudioFocus(focusChangeListener);
        }
        navigationFocusHeld = false;
    }
}
