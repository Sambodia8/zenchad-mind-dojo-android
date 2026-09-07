package com.zenchad.minddojo;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

public class RunningStoryVoiceEngine {
    private static final String ASSET_ROOT = "public/assets/audio/running-story/voices/";

    private final Context context;
    private final AudioManager audioManager;
    private MediaPlayer player;
    private AudioFocusRequest focusRequest;
    private boolean focusHeld = false;
    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> {
        if (change == AudioManager.AUDIOFOCUS_LOSS) focusHeld = false;
    };

    public interface PlaybackListener {
        void onStarted();
        void onCompleted();
        void onError(String reason);
    }

    public RunningStoryVoiceEngine(Context context) {
        this.context = context.getApplicationContext();
        this.audioManager = (AudioManager) this.context.getSystemService(Context.AUDIO_SERVICE);
    }

    public synchronized boolean play(String fileName, float volume, PlaybackListener listener) {
        if (player != null || fileName == null || fileName.trim().isEmpty()) return false;
        String path = cachedAsset(fileName);
        if (path == null) return false;
        MediaPlayer next = null;
        try {
            next = new MediaPlayer();
            next.setDataSource(path);
            next.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build());
            next.setVolume(Math.max(0f, Math.min(1f, volume)), Math.max(0f, Math.min(1f, volume)));
            next.setOnCompletionListener(completed -> finish(completed, listener, false));
            next.setOnErrorListener((failed, what, extra) -> {
                finish(failed, listener, true);
                return true;
            });
            next.prepare();
            requestAudioFocus();
            player = next;
            next.start();
            if (listener != null) listener.onStarted();
            return true;
        } catch (IOException | RuntimeException error) {
            if (next != null) {
                try { next.release(); } catch (RuntimeException ignored) {}
            }
            releaseAudioFocus();
            // Returning false lets the director use Android TTS immediately.
            // The listener is reserved for failures after recorded playback was accepted.
            return false;
        }
    }

    public synchronized void stop() {
        MediaPlayer active = player;
        player = null;
        if (active == null) return;
        try { active.stop(); } catch (RuntimeException ignored) {}
        try { active.release(); } catch (RuntimeException ignored) {}
        releaseAudioFocus();
    }

    public synchronized void shutdown() {
        stop();
    }

    private synchronized void finish(MediaPlayer completed, PlaybackListener listener, boolean failed) {
        if (player == completed) player = null;
        try { completed.release(); } catch (RuntimeException ignored) {}
        releaseAudioFocus();
        if (listener == null) return;
        if (failed) listener.onError("Narration playback failed.");
        else listener.onCompleted();
    }

    private void requestAudioFocus() {
        if (audioManager == null || focusHeld) return;
        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attributes)
                .setWillPauseWhenDucked(false)
                .setOnAudioFocusChangeListener(focusListener)
                .build();
            result = audioManager.requestAudioFocus(focusRequest);
        } else {
            result = audioManager.requestAudioFocus(
                focusListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
            );
        }
        focusHeld = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }

    private void releaseAudioFocus() {
        if (audioManager == null || !focusHeld) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
            audioManager.abandonAudioFocusRequest(focusRequest);
            focusRequest = null;
        } else {
            audioManager.abandonAudioFocus(focusListener);
        }
        focusHeld = false;
    }

    private String cachedAsset(String fileName) {
        File directory = new File(context.getCacheDir(), "running-story-voice");
        File destination = new File(directory, fileName);
        if (destination.isFile() && destination.length() > 0) return destination.getAbsolutePath();
        try {
            if (!directory.exists() && !directory.mkdirs()) return null;
            try (InputStream input = context.getAssets().open(ASSET_ROOT + fileName);
                 FileOutputStream output = new FileOutputStream(destination)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) >= 0) output.write(buffer, 0, read);
            }
            return destination.isFile() && destination.length() > 0 ? destination.getAbsolutePath() : null;
        } catch (IOException error) {
            return null;
        }
    }
}
