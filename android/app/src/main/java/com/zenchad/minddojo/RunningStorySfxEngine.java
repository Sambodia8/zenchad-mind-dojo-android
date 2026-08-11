package com.zenchad.minddojo;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;

import java.util.Random;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class RunningStorySfxEngine {
    private static final int SAMPLE_RATE = 22050;
    private static final double MASTER_GAIN = 0.17d;

    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
    private final Random random = new Random();
    private AudioTrack helicopterTrack;
    private boolean helicopterActive = false;
    private volatile double volumeMultiplier = 0.72d;

    public void setVolume(double volume) {
        volumeMultiplier = Math.max(0d, Math.min(1d, Double.isFinite(volume) ? volume : 1d));
        AudioTrack active = helicopterTrack;
        if (active != null) {
            try {
                active.setVolume((float) volumeMultiplier);
            } catch (RuntimeException ignored) {
                // The next effect will use the new setting even if this track cannot update live.
            }
        }
    }

    public synchronized void startHelicopter() {
        if (helicopterActive || volumeMultiplier <= 0d) return;
        helicopterActive = true;
        short[] pcm = makeHelicopterLoop(2.4d);
        helicopterTrack = createStaticTrack(pcm);
        if (helicopterTrack != null) {
            int frames = pcm.length / 2;
            try {
                helicopterTrack.setLoopPoints(0, Math.max(1, frames - 1), -1);
                helicopterTrack.play();
            } catch (RuntimeException ignored) {
                safeRelease(helicopterTrack);
                helicopterTrack = null;
                helicopterActive = false;
            }
        }
        scheduleGunfireCluster(900);
    }

    public synchronized void stopHelicopter() {
        helicopterActive = false;
        if (helicopterTrack != null) {
            try { helicopterTrack.stop(); } catch (RuntimeException ignored) {}
            safeRelease(helicopterTrack);
            helicopterTrack = null;
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
                    double pan = random.nextDouble() * 1.6d - 0.8d;
                    playOneShot(makeGunshot(0.18d + random.nextDouble() * 0.08d, pan));
                    if (shot == bursts - 1 && random.nextBoolean()) {
                        executor.schedule(() -> {
                            if (helicopterActive && volumeMultiplier > 0d) playOneShot(makeBulletPass(0.42d, -pan));
                        }, 130, TimeUnit.MILLISECONDS);
                    }
                }, index * (110L + random.nextInt(90)), TimeUnit.MILLISECONDS);
            }
            long next = 2600L + random.nextInt(3600);
            scheduleGunfireCluster(next);
        }, delayMs, TimeUnit.MILLISECONDS);
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

    private short[] makeGunshot(double seconds, double pan) {
        int frames = Math.max(1, (int) Math.round(seconds * SAMPLE_RATE));
        short[] pcm = new short[frames * 2];
        double phase = 0d;
        for (int frame = 0; frame < frames; frame += 1) {
            double t = frame / (double) SAMPLE_RATE;
            double envelope = Math.exp(-t * 19d);
            phase += 2d * Math.PI * (92d + 190d * Math.exp(-t * 12d)) / SAMPLE_RATE;
            double noise = random.nextDouble() * 2d - 1d;
            double crack = Math.sin(phase) * 0.38d + noise * 0.72d;
            putStereo(pcm, frame, crack * envelope * MASTER_GAIN * 1.25d, pan);
        }
        return pcm;
    }

    private short[] makeBulletPass(double seconds, double pan) {
        int frames = Math.max(1, (int) Math.round(seconds * SAMPLE_RATE));
        short[] pcm = new short[frames * 2];
        double phase = 0d;
        for (int frame = 0; frame < frames; frame += 1) {
            double fraction = frame / (double) Math.max(1, frames - 1);
            double hz = 1750d - fraction * 1200d;
            phase += 2d * Math.PI * hz / SAMPLE_RATE;
            double envelope = Math.sin(Math.PI * fraction);
            double sample = (Math.sin(phase) * 0.5d + (random.nextDouble() * 2d - 1d) * 0.28d) * envelope * MASTER_GAIN;
            putStereo(pcm, frame, sample, pan * (1d - fraction) - pan * fraction);
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
            double sample = Math.sin(phase) * envelope * amplitude * MASTER_GAIN;
            putStereo(pcm, frame, sample, 0d);
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
