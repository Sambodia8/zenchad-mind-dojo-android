package com.zenchad.minddojo;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.MediaPlayer;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

public class RunningStoryVoiceEngine {
    private static final String ASSET_ROOT = "public/assets/audio/running-story/voices/";

    private final Context context;
    private MediaPlayer player;

    public RunningStoryVoiceEngine(Context context) {
        this.context = context.getApplicationContext();
    }

    public synchronized boolean play(String fileName, float volume, Runnable onDone) {
        if (player != null || fileName == null || fileName.trim().isEmpty()) return false;
        String path = cachedAsset(fileName);
        if (path == null) return false;
        try {
            MediaPlayer next = new MediaPlayer();
            next.setDataSource(path);
            next.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build());
            next.setVolume(Math.max(0f, Math.min(1f, volume)), Math.max(0f, Math.min(1f, volume)));
            next.setOnCompletionListener(completed -> finish(completed, onDone));
            next.setOnErrorListener((failed, what, extra) -> {
                finish(failed, onDone);
                return true;
            });
            next.prepare();
            player = next;
            next.start();
            return true;
        } catch (IOException | RuntimeException error) {
            return false;
        }
    }

    public synchronized void stop() {
        MediaPlayer active = player;
        player = null;
        if (active == null) return;
        try { active.stop(); } catch (RuntimeException ignored) {}
        try { active.release(); } catch (RuntimeException ignored) {}
    }

    public synchronized void shutdown() {
        stop();
    }

    private synchronized void finish(MediaPlayer completed, Runnable onDone) {
        if (player == completed) player = null;
        try { completed.release(); } catch (RuntimeException ignored) {}
        if (onDone != null) onDone.run();
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
