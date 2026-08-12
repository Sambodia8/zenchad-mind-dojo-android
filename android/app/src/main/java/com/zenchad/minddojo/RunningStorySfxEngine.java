package com.zenchad.minddojo;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.media.MediaPlayer;
import android.media.SoundPool;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class RunningStorySfxEngine {
    private static final int SAMPLE_RATE = 22050;
    private static final double MASTER_GAIN = 0.17d;
    private static final String ASSET_ROOT = "public/assets/audio/running-story/";

    private final Context context;
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
    private final Random random = new Random();
    private final SoundPool soundPool;
    private final Map<String, Integer> soundIds = new HashMap<>();
    private final Map<String, Boolean> loadedSounds = new HashMap<>();
    private AudioTrack fallbackHelicopterTrack;
    private MediaPlayer helicopterPlayer;
    private boolean helicopterActive = false;
    private volatile double volumeMultiplier = 0.72d;

    public RunningStorySfxEngine(Context context) {
        this.context = context.getApplicationContext();
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        soundPool = new SoundPool.Builder()
            .setMaxStreams(8)
            .setAudioAttributes(attributes)
            .build();
        soundPool.setOnLoadCompleteListener((pool, sampleId, status) -> {
            if (status != 0) return;
            synchronized (loadedSounds) {
                for (Map.Entry<String, Integer> entry : soundIds.entrySet()) {
                    if (entry.getValue() == sampleId) loadedSounds.put(entry.getKey(), true);
                }
            }
        });
        loadSound("helicopter-overhead-pass");
        loadSound("machine-gun-burst-right");
        loadSound("machine-gun-burst-left");
        loadSound("bullet-pass-right-left");
        loadSound("bullet-pass-left-right");
        loadSound("bullet-impact-left");
        loadSound("bullet-impact-right");
    }

    public void setVolume(double volume) {
        volumeMultiplier = Math.max(0d, Math.min(1d, Double.isFinite(volume) ? volume : 1d));
        AudioTrack activeFallback = fallbackHelicopterTrack;
        if (activeFallback != null) {
            try { activeFallback.setVolume((float) volumeMultiplier); } catch (RuntimeException ignored) {}
        }
        MediaPlayer activeHelicopter = helicopterPlayer;
        if (activeHelicopter != null) {
            try { activeHelicopter.setVolume((float) volumeMultiplier, (float) volumeMultiplier); } catch (RuntimeException ignored) {}
        }
    }

    public synchronized void startHelicopter() {
        if (helicopterActive || volumeMultiplier <= 0d) return;
        helicopterActive = true;
        String loopPath = cachedAsset("helicopter-loop.mp3");
        if (loopPath != null) {
            try {
                helicopterPlayer = new MediaPlayer();
                helicopterPlayer.setDataSource(loopPath);
                helicopterPlayer.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
                helicopterPlayer.setLooping(true);
                helicopterPlayer.setVolume((float) volumeMultiplier, (float) volumeMultiplier);
                helicopterPlayer.prepare();
                helicopterPlayer.start();
                playAsset("helicopter-overhead-pass", 0f);
            } catch (IOException | RuntimeException error) {
                releaseHelicopterPlayer();
            }
        }
        if (helicopterPlayer == null) startFallbackHelicopter();
        scheduleGunfireCluster(900);
    }

    public synchronized void stopHelicopter() {
        helicopterActive = false;
        releaseHelicopterPlayer();
        if (fallbackHelicopterTrack != null) {
            try { fallbackHelicopterTrack.stop(); } catch (RuntimeException ignored) {}
            safeRelease(fallbackHelicopterTrack);
            fallbackHelicopterTrack = null;
        }
    }

    public void playPursuitStinger() {
        if (volumeMultiplier > 0d) playOneShot(makePursuitStinger(0.65d));
    }

    public void playEscapeStinger() {
        if (volumeMultiplier > 0d) playOneShot(makeEscapeStinger(0.7d));
    }

    public void playInterceptionStinger() {
        if (volumeMultiplier > 0d) playOneShot(makeInterceptionStinger(0.75d));
    }

    public void shutdown() {
        stopHelicopter();
        soundPool.release();
        executor.shutdownNow();
    }

    private void scheduleGunfireCluster(long delayMs) {
        executor.schedule(() -> {
            if (!helicopterActive || volumeMultiplier <= 0d) return;
            int bursts = 2 + random.nextInt(3);
            for (int index = 0; index < bursts; index += 1) {
                final int shot = index;
                executor.schedule(() -> {
                    if (!helicopterActive || volumeMultiplier <= 0d) return;
                    boolean fromRight = random.nextBoolean();
                    playAsset(fromRight ? "machine-gun-burst-right" : "machine-gun-burst-left", fromRight ? 0.8f : -0.8f);
                    if (shot == bursts - 1 && random.nextBoolean()) {
                        executor.schedule(() -> {
                            if (!helicopterActive || volumeMultiplier <= 0d) return;
                            boolean rightToLeft = random.nextBoolean();
                            playAsset(rightToLeft ? "bullet-pass-right-left" : "bullet-pass-left-right", 0f);
                            playAsset(rightToLeft ? "bullet-impact-left" : "bullet-impact-right", rightToLeft ? -0.9f : 0.9f);
                        }, 160, TimeUnit.MILLISECONDS);
                    }
                }, index * (150L + random.nextInt(160)), TimeUnit.MILLISECONDS);
            }
            scheduleGunfireCluster(3200L + random.nextInt(3600));
        }, delayMs, TimeUnit.MILLISECONDS);
    }

    private void loadSound(String name) {
        String path = cachedAsset(name + ".mp3");
        if (path == null) return;
        int soundId = soundPool.load(path, 1);
        soundIds.put(name, soundId);
        loadedSounds.put(name, false);
    }

    private void playAsset(String name, float pan) {
        if (volumeMultiplier <= 0d) return;
        Integer soundId = soundIds.get(name);
        boolean loaded;
        synchronized (loadedSounds) { loaded = Boolean.TRUE.equals(loadedSounds.get(name)); }
        if (soundId == null || !loaded) return;
        float left = 1f;
        float right = 1f;
        if (pan < 0f) right = 0.38f;
        else if (pan > 0f) left = 0.38f;
        soundPool.play(soundId, left * (float) volumeMultiplier, right * (float) volumeMultiplier, 1, 0, 1f);
    }

    private String cachedAsset(String fileName) {
        File directory = new File(context.getCacheDir(), "running-story-audio");
        File destination = new File(directory, fileName);
        try {
            if (!directory.exists() && !directory.mkdirs()) return null;
            try (InputStream input = context.getAssets().open(ASSET_ROOT + fileName);
                 FileOutputStream output = new FileOutputStream(destination)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) >= 0) output.write(buffer, 0, read);
            }
            return destination.getAbsolutePath();
        } catch (IOException error) {
            return null;
        }
    }

    private void releaseHelicopterPlayer() {
        if (helicopterPlayer == null) return;
        try { helicopterPlayer.stop(); } catch (RuntimeException ignored) {}
        try { helicopterPlayer.release(); } catch (RuntimeException ignored) {}
        helicopterPlayer = null;
    }

    private void startFallbackHelicopter() {
        short[] pcm = makeHelicopterLoop(2.4d);
        fallbackHelicopterTrack = createStaticTrack(pcm);
        if (fallbackHelicopterTrack != null) {
            int frames = pcm.length / 2;
            try {
                fallbackHelicopterTrack.setLoopPoints(0, Math.max(1, frames - 1), -1);
                fallbackHelicopterTrack.play();
            } catch (RuntimeException ignored) {
                safeRelease(fallbackHelicopterTrack);
                fallbackHelicopterTrack = null;
            }
        }
    }

    private AudioTrack createStaticTrack(short[] pcm) {
        if (pcm.length < 4) return null;
        try {
            AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            AudioFormat format = new AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(SAMPLE_RATE)
                .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                .build();
            AudioTrack track = new AudioTrack.Builder()
                .setAudioAttributes(attributes)
                .setAudioFormat(format)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .setBufferSizeInBytes(pcm.length * 2)
                .build();
            int written = track.write(pcm, 0, pcm.length);
            if (written <= 0) {
                safeRelease(track);
                return null;
            }
            track.setVolume((float) volumeMultiplier);
            return track;
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private void playOneShot(short[] pcm) {
        if (volumeMultiplier <= 0d) return;
        executor.execute(() -> {
            AudioTrack track = createStaticTrack(pcm);
            if (track == null) return;
            try {
                track.play();
                long durationMs = Math.max(120L, Math.round((pcm.length / 2d) / SAMPLE_RATE * 1000d) + 120L);
                executor.schedule(() -> safeRelease(track), durationMs, TimeUnit.MILLISECONDS);
            } catch (RuntimeException ignored) {
                safeRelease(track);
            }
        });
    }

    private short[] makeHelicopterLoop(double seconds) {
        int frames = Math.max(1, (int) Math.round(seconds * SAMPLE_RATE));
        short[] pcm = new short[frames * 2];
        double rotorHz = 13.2d;
        double rotorPhase = 0d;
        double wobblePhase = 0d;
        for (int frame = 0; frame < frames; frame += 1) {
            double t = frame / (double) SAMPLE_RATE;
            rotorPhase += 2d * Math.PI * rotorHz / SAMPLE_RATE;
            wobblePhase += 2d * Math.PI * 0.28d / SAMPLE_RATE;
            double blade = Math.pow(Math.max(0d, Math.sin(rotorPhase)), 5d);
            double bass = Math.sin(2d * Math.PI * 66d * t) * 0.24d + Math.sin(2d * Math.PI * 91d * t) * 0.12d;
            double air = (random.nextDouble() * 2d - 1d) * 0.08d;
            double sample = (blade * 0.62d + bass + air) * MASTER_GAIN;
            double pan = Math.sin(wobblePhase) * 0.55d;
            putStereo(pcm, frame, sample, pan);
        }
        return pcm;
    }

    private short[] makePursuitStinger(double seconds) {
        return makeTonalStinger(seconds, 118d, 176d, 0.6d);
    }

    private short[] makeEscapeStinger(double seconds) {
        return makeTonalStinger(seconds, 176d, 264d, 0.52d);
    }

    private short[] makeInterceptionStinger(double seconds) {
        return makeTonalStinger(seconds, 132d, 72d, 0.58d);
    }

    private short[] makeTonalStinger(double seconds, double startHz, double endHz, double amplitude) {
        int frames = Math.max(1, (int) Math.round(seconds * SAMPLE_RATE));
        short[] pcm = new short[frames * 2];
        double phase = 0d;
        for (int frame = 0; frame < frames; frame += 1) {
            double fraction = frame / (double) Math.max(1, frames - 1);
            double hz = startHz + (endHz - startHz) * fraction;
            phase += 2d * Math.PI * hz / SAMPLE_RATE;
            double envelope = Math.sin(Math.PI * fraction);
            putStereo(pcm, frame, Math.sin(phase) * envelope * amplitude * MASTER_GAIN, 0d);
        }
        return pcm;
    }

    private void putStereo(short[] pcm, int frame, double sample, double pan) {
        double safePan = Math.max(-1d, Math.min(1d, pan));
        double left = sample * (safePan <= 0d ? 1d : 1d - safePan);
        double right = sample * (safePan >= 0d ? 1d : 1d + safePan);
        pcm[frame * 2] = toPcm(left);
        pcm[frame * 2 + 1] = toPcm(right);
    }

    private short toPcm(double sample) {
        return (short) Math.round(Math.max(-1d, Math.min(1d, sample)) * 32767d);
    }

    private void safeRelease(AudioTrack track) {
        if (track == null) return;
        try { track.stop(); } catch (RuntimeException ignored) {}
        try { track.flush(); } catch (RuntimeException ignored) {}
        try { track.release(); } catch (RuntimeException ignored) {}
    }
}
