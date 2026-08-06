package com.zenchad.minddojo;

import android.Manifest;
import android.app.DownloadManager;
import android.content.Context;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.os.SystemClock;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PluginMethod;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(
        name = "WhisperJournal",
        permissions = {
                @Permission(alias = "microphone", strings = {Manifest.permission.RECORD_AUDIO})
        }
)
public class WhisperJournalPlugin extends Plugin {
    private static final int SAMPLE_RATE = 16000;
    private static final String MODEL_NAME = "ggml-base.en-q5_1.bin";
    private static final long MODEL_SIZE_BYTES = 59721011L;
    private static final String MODEL_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin?download=true";
    private static final String DOWNLOAD_ID_KEY = "whisper_model_download_id";
    private static final String RECORDING_NAME = "journal-reflection.pcm";

    private final AtomicBoolean recording = new AtomicBoolean(false);
    private final ExecutorService transcriptionExecutor = Executors.newSingleThreadExecutor();
    private AudioRecord audioRecord;
    private Thread captureThread;
    private long recordingStartedAt;

    @PluginMethod
    public void getStatus(PluginCall call) {
        syncDownload();
        call.resolve(getStatusObject());
    }

    @PluginMethod
    public void downloadModel(PluginCall call) {
        syncDownload();
        if (getModelFile().isFile() && getModelFile().length() == MODEL_SIZE_BYTES) {
            call.resolve(getStatusObject());
            return;
        }
        DownloadSnapshot existing = getDownloadSnapshot();
        if (existing.status.equals("pending") || existing.status.equals("running") || existing.status.equals("paused")) {
            call.resolve(getStatusObject());
            return;
        }

        try {
            File downloadDirectory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (downloadDirectory == null) throw new IllegalStateException("Android storage is unavailable.");
            if (!downloadDirectory.exists() && !downloadDirectory.mkdirs()) {
                throw new IllegalStateException("The model download folder could not be created.");
            }
            File partial = new File(downloadDirectory, MODEL_NAME + ".part");
            if (partial.exists() && !partial.delete()) {
                throw new IllegalStateException("The previous partial model download could not be replaced.");
            }

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(MODEL_URL));
            request.setTitle("Zen Chad Whisper model");
            request.setDescription("Downloading the offline voice transcription model once");
            request.setMimeType("application/octet-stream");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setAllowedOverMetered(false);
            request.setAllowedOverRoaming(false);
            request.setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, MODEL_NAME + ".part");
            long id = ((DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(request);
            getContext().getSharedPreferences("whisper_journal", Context.MODE_PRIVATE)
                    .edit().putLong(DOWNLOAD_ID_KEY, id).apply();
            call.resolve(getStatusObject());
        } catch (Throwable error) {
            call.reject(error.getMessage() == null ? "The Whisper model download could not start." : error.getMessage());
        }
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        long id = getContext().getSharedPreferences("whisper_journal", Context.MODE_PRIVATE)
                .getLong(DOWNLOAD_ID_KEY, 0);
        try {
            if (id != 0) {
                DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
                manager.remove(id);
            }
            getContext().getSharedPreferences("whisper_journal", Context.MODE_PRIVATE)
                    .edit().remove(DOWNLOAD_ID_KEY).apply();
            File downloadDirectory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (downloadDirectory != null) {
                File partial = new File(downloadDirectory, MODEL_NAME + ".part");
                if (partial.exists()) partial.delete();
            }
            call.resolve(getStatusObject());
        } catch (Throwable error) {
            call.reject(error.getMessage() == null ? "The Whisper model download could not be cancelled." : error.getMessage());
        }
    }

    private JSObject getStatusObject() {
        File model = getModelFile();
        File recordingFile = getRecordingFile();
        JSObject result = new JSObject();
        result.put("modelInstalled", model.isFile() && model.length() == MODEL_SIZE_BYTES);
        result.put("modelBytes", model.isFile() ? model.length() : 0);
        result.put("recording", recording.get());
        result.put("recordingBytes", recordingFile.isFile() ? recordingFile.length() : 0);
        result.put("modelInstallPath", model.getAbsolutePath());
        DownloadSnapshot download = getDownloadSnapshot();
        result.put("downloadId", download.id);
        result.put("downloadStatus", download.status);
        result.put("downloadBytes", download.bytes);
        result.put("downloadTotalBytes", download.totalBytes);
        result.put("downloadError", download.error);
        try {
            result.put("systemInfo", WhisperJournalNative.systemInfo());
        } catch (Throwable error) {
            result.put("systemInfo", "Whisper native library is not available yet.");
        }
        return result;
    }

    @PluginMethod
    public void startRecording(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
            return;
        }
        startRecordingInternal(call);
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone permission is needed for a voice reflection.");
            return;
        }
        startRecordingInternal(call);
    }

    private synchronized void startRecordingInternal(PluginCall call) {
        if (recording.get()) {
            call.reject("A voice reflection is already recording.");
            return;
        }

        int minimumBuffer = AudioRecord.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
        );
        if (minimumBuffer <= 0) {
            call.reject("Android could not prepare the microphone.");
            return;
        }

        int bufferSize = Math.max(minimumBuffer * 2, SAMPLE_RATE);
        try {
            audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.VOICE_RECOGNITION,
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    bufferSize
            );
            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                audioRecord.release();
                audioRecord = null;
                call.reject("Android could not initialize the microphone.");
                return;
            }

            File output = getRecordingFile();
            if (output.exists() && !output.delete()) {
                releaseRecorder();
                call.reject("The previous temporary recording could not be replaced.");
                return;
            }

            recording.set(true);
            recordingStartedAt = SystemClock.elapsedRealtime();
            audioRecord.startRecording();
            captureThread = new Thread(() -> captureAudio(output, bufferSize), "ZenChad-Whisper-Capture");
            captureThread.start();

            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("sampleRate", SAMPLE_RATE);
            call.resolve(result);
        } catch (SecurityException error) {
            releaseRecorder();
            call.reject("Android did not grant microphone access.", error);
        } catch (RuntimeException error) {
            releaseRecorder();
            call.reject("The microphone could not start.", error);
        }
    }

    private void captureAudio(File output, int bufferSize) {
        short[] samples = new short[bufferSize / 2];
        try (BufferedOutputStream stream = new BufferedOutputStream(new FileOutputStream(output))) {
            while (recording.get()) {
                AudioRecord recorder = audioRecord;
                if (recorder == null) break;
                int count = recorder.read(samples, 0, samples.length, AudioRecord.READ_BLOCKING);
                if (count <= 0) continue;
                byte[] bytes = new byte[count * 2];
                for (int index = 0; index < count; index++) {
                    bytes[index * 2] = (byte) (samples[index] & 0xff);
                    bytes[index * 2 + 1] = (byte) ((samples[index] >> 8) & 0xff);
                }
                stream.write(bytes);
            }
        } catch (IOException ignored) {
            // stopRecording/transcribe will report a missing or empty recording.
        } finally {
            releaseRecorder();
        }
    }

    @PluginMethod
    public synchronized void stopRecording(PluginCall call) {
        if (!recording.getAndSet(false)) {
            call.reject("There is no voice reflection recording.");
            return;
        }

        try {
            if (audioRecord != null) audioRecord.stop();
        } catch (IllegalStateException ignored) {
        }

        Thread finishingThread = captureThread;
        transcriptionExecutor.execute(() -> {
            if (finishingThread != null) {
                try {
                    finishingThread.join(5000);
                } catch (InterruptedException error) {
                    Thread.currentThread().interrupt();
                }
            }
            long durationMs = Math.max(0, SystemClock.elapsedRealtime() - recordingStartedAt);
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("durationMs", durationMs);
            result.put("audioBytes", getRecordingFile().length());
            call.resolve(result);
        });
    }

    @PluginMethod
    public void transcribe(PluginCall call) {
        if (recording.get()) {
            call.reject("Stop the recording before transcribing it.");
            return;
        }

        File model = getModelFile();
        File audio = getRecordingFile();
        if (!model.isFile() || model.length() == 0) {
            call.reject("The local Whisper model has not been installed yet.");
            return;
        }
        if (!audio.isFile() || audio.length() < 3200) {
            call.reject("Record a little more before asking Whisper to transcribe it.");
            return;
        }

        transcriptionExecutor.execute(() -> {
            long startedAt = SystemClock.elapsedRealtime();
            try {
                int threads = Math.max(2, Math.min(6, Runtime.getRuntime().availableProcessors() - 2));
                String transcript = WhisperJournalNative.transcribePcm(
                        model.getAbsolutePath(),
                        audio.getAbsolutePath(),
                        threads
                );
                JSObject result = new JSObject();
                result.put("transcript", transcript);
                result.put("elapsedMs", SystemClock.elapsedRealtime() - startedAt);
                result.put("threads", threads);
                call.resolve(result);
            } catch (Throwable error) {
                call.reject(error.getMessage() == null
                        ? "Whisper could not transcribe this recording."
                        : error.getMessage());
            }
        });
    }

    @PluginMethod
    public void deleteRecording(PluginCall call) {
        if (recording.get()) {
            call.reject("Stop recording before deleting the temporary audio.");
            return;
        }
        File recordingFile = getRecordingFile();
        JSObject result = new JSObject();
        result.put("deleted", !recordingFile.exists() || recordingFile.delete());
        call.resolve(result);
    }

    private File getModelFile() {
        File directory = getContext().getExternalFilesDir("models");
        if (directory == null) {
            directory = new File(getContext().getFilesDir(), "models");
        }
        if (!directory.exists()) directory.mkdirs();
        return new File(directory, MODEL_NAME);
    }

    private void syncDownload() {
        DownloadSnapshot snapshot = getDownloadSnapshot();
        if (!snapshot.status.equals("successful")) return;
        File downloadDirectory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (downloadDirectory == null) return;
        File partial = new File(downloadDirectory, MODEL_NAME + ".part");
        File model = getModelFile();
        if (partial.isFile() && partial.length() == MODEL_SIZE_BYTES && (!model.exists() || model.delete())) {
            if (partial.renameTo(model)) {
                getContext().getSharedPreferences("whisper_journal", Context.MODE_PRIVATE)
                        .edit().remove(DOWNLOAD_ID_KEY).apply();
            }
        }
    }

    private DownloadSnapshot getDownloadSnapshot() {
        long id = getContext().getSharedPreferences("whisper_journal", Context.MODE_PRIVATE)
                .getLong(DOWNLOAD_ID_KEY, 0);
        if (id == 0) return new DownloadSnapshot(0, "none", 0, 0, 0);
        DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        try (Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(id))) {
            if (cursor == null || !cursor.moveToFirst()) return new DownloadSnapshot(id, "none", 0, 0, 0);
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            long bytes = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
            long total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
            int error = status == DownloadManager.STATUS_FAILED
                    ? cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)) : 0;
            String label = status == DownloadManager.STATUS_PENDING ? "pending"
                    : status == DownloadManager.STATUS_RUNNING ? "running"
                    : status == DownloadManager.STATUS_PAUSED ? "paused"
                    : status == DownloadManager.STATUS_SUCCESSFUL ? "successful"
                    : "failed";
            return new DownloadSnapshot(id, label, bytes, total, error);
        }
    }

    private static final class DownloadSnapshot {
        final long id;
        final String status;
        final long bytes;
        final long totalBytes;
        final int error;

        DownloadSnapshot(long id, String status, long bytes, long totalBytes, int error) {
            this.id = id;
            this.status = status;
            this.bytes = bytes;
            this.totalBytes = totalBytes;
            this.error = error;
        }
    }

    private File getRecordingFile() {
        return new File(getContext().getCacheDir(), RECORDING_NAME);
    }

    private synchronized void releaseRecorder() {
        recording.set(false);
        if (audioRecord != null) {
            audioRecord.release();
            audioRecord = null;
        }
        captureThread = null;
    }

    @Override
    protected void handleOnDestroy() {
        recording.set(false);
        try {
            if (audioRecord != null) audioRecord.stop();
        } catch (IllegalStateException ignored) {
        }
        releaseRecorder();
        transcriptionExecutor.shutdownNow();
        super.handleOnDestroy();
    }
}
