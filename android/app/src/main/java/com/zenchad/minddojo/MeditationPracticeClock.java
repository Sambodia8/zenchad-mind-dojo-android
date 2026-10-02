package com.zenchad.minddojo;

final class MeditationPracticeClock {
    static long elapsed(long accumulated, long anchor, long now, boolean running, long target) {
        long elapsed = Math.max(0, accumulated) + (running ? Math.max(0, now - anchor) : 0);
        return target > 0 ? Math.min(target, elapsed) : elapsed;
    }
}
