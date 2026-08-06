package com.zenchad.minddojo;

final class QwenJournalNative {
    static {
        System.loadLibrary("zenchad_qwen");
    }

    private QwenJournalNative() {}

    static native String generate(String modelPath, String prompt, int maxTokens);
}
