package com.zenchad.minddojo;

final class WhisperJournalNative {
    static {
        System.loadLibrary("zenchad_whisper");
    }

    private WhisperJournalNative() {}

    static native String transcribePcm(String modelPath, String pcmPath, int threads);

    static native String systemInfo();
}
