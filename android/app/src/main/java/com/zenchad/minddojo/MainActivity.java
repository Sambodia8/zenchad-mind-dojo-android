package com.zenchad.minddojo;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private AudioManager audioManager;
    private AudioFocusRequest duckingFocusRequest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(WhisperJournalPlugin.class);
        registerPlugin(QwenJournalPlugin.class);
        super.onCreate(savedInstanceState);

        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);

        // Configure non-interrupting transient audio focus with ducking so external media
        // players (like YouTube and YouTube Music) are not paused during stretching routines.
        if (audioManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();

            duckingFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(playbackAttributes)
                    .setAcceptsDelayedFocusGain(true)
                    .setOnAudioFocusChangeListener(focusChange -> {
                        // Maintain background playback for apps like YouTube / YouTube Music
                    })
                    .build();

            audioManager.requestAudioFocus(duckingFocusRequest);
        }
    }
}
