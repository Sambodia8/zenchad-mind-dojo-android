package com.zenchad.minddojo;

import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.os.SystemClock;
import android.util.Log;

import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.File;
import java.util.Locale;

@RunWith(AndroidJUnit4.class)
public class WhisperJournalNativeInstrumentedTest {
    private static final String TAG = "ZenChadWhisperTest";

    @Test
    public void transcribesOfficialWhisperSampleOnDevice() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File model = new File(context.getExternalFilesDir("models"), "ggml-base.en-q5_1.bin");
        File audio = new File(context.getExternalFilesDir("test"), "jfk.wav");
        assertTrue("Push the Whisper model to " + model, model.isFile());
        assertTrue("Push the JFK test WAV to " + audio, audio.isFile());

        long startedAt = SystemClock.elapsedRealtime();
        String transcript = WhisperJournalNative.transcribePcm(
                model.getAbsolutePath(),
                audio.getAbsolutePath(),
                4
        );
        long elapsedMs = SystemClock.elapsedRealtime() - startedAt;
        String normalized = transcript.toLowerCase(Locale.UK);
        Log.i(TAG, "elapsedMs=" + elapsedMs + " transcript=" + transcript);

        assertTrue("Unexpected transcript: " + transcript,
                normalized.contains("fellow americans") && normalized.contains("country"));
    }
}
