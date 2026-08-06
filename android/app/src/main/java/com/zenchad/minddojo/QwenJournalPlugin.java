package com.zenchad.minddojo;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.app.DownloadManager;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;

import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "QwenJournal")
public class QwenJournalPlugin extends Plugin {
    private static final String MODEL_NAME = "Qwen3-4B-Instruct-2507-Q4_K_M.gguf";
    private static final long MODEL_SIZE_BYTES = 2497280448L;
    private static final String MODEL_URL = "https://huggingface.co/mmnga/Qwen3-4B-Instruct-2507-gguf/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf?download=true";
    private static final String DOWNLOAD_ID_KEY = "qwen_model_download_id";
    private final ExecutorService generationExecutor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getStatus(PluginCall call) {
        syncDownload();
        File model = getModelFile();
        JSObject result = new JSObject();
        result.put("modelInstalled", model.isFile() && model.length() == MODEL_SIZE_BYTES);
        result.put("modelBytes", model.isFile() ? model.length() : 0);
        result.put("modelInstallPath", model.getAbsolutePath());
        DownloadSnapshot download = getDownloadSnapshot();
        result.put("downloadId", download.id);
        result.put("downloadStatus", download.status);
        result.put("downloadBytes", download.bytes);
        result.put("downloadTotalBytes", download.totalBytes);
        result.put("downloadError", download.error);
        call.resolve(result);
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
            request.setTitle("Zen Chad Qwen 4B model");
            request.setDescription("Downloading the offline journal organiser once");
            request.setMimeType("application/octet-stream");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setAllowedOverMetered(false);
            request.setAllowedOverRoaming(false);
            request.setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, MODEL_NAME + ".part");
            long id = ((DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(request);
            getContext().getSharedPreferences("qwen_journal", Context.MODE_PRIVATE)
                    .edit().putLong(DOWNLOAD_ID_KEY, id).apply();
            call.resolve(getStatusObject());
        } catch (Throwable error) {
            call.reject(error.getMessage() == null ? "The Qwen model download could not start." : error.getMessage());
        }
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        long id = getContext().getSharedPreferences("qwen_journal", Context.MODE_PRIVATE)
                .getLong(DOWNLOAD_ID_KEY, 0);
        try {
            if (id != 0) {
                DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
                manager.remove(id);
            }
            getContext().getSharedPreferences("qwen_journal", Context.MODE_PRIVATE)
                    .edit().remove(DOWNLOAD_ID_KEY).apply();
            File downloadDirectory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (downloadDirectory != null) {
                File partial = new File(downloadDirectory, MODEL_NAME + ".part");
                if (partial.exists()) partial.delete();
            }
            call.resolve(getStatusObject());
        } catch (Throwable error) {
            call.reject(error.getMessage() == null ? "The Qwen model download could not be cancelled." : error.getMessage());
        }
    }

    @PluginMethod
    public void generate(PluginCall call) {
        String prompt = call.getString("prompt", "");
        int maxTokens = call.getInt("maxTokens", 700);
        File model = getModelFile();
        if (!model.isFile() || model.length() != MODEL_SIZE_BYTES) {
            call.reject("The local Qwen 4B model has not been installed yet.");
            return;
        }
        if (prompt == null || prompt.trim().length() < 20) {
            call.reject("There is not enough journal text to organise.");
            return;
        }

        generationExecutor.execute(() -> {
            long startedAt = android.os.SystemClock.elapsedRealtime();
            try {
                String output = QwenJournalNative.generate(model.getAbsolutePath(), prompt, maxTokens);
                if (output.startsWith("__ERROR__:")) {
                    call.reject(output.substring("__ERROR__:".length()).trim());
                    return;
                }
                JSObject result = new JSObject();
                result.put("output", output);
                result.put("elapsedMs", android.os.SystemClock.elapsedRealtime() - startedAt);
                result.put("modelBytes", model.length());
                call.resolve(result);
            } catch (Throwable error) {
                call.reject(error.getMessage() == null
                        ? "Qwen could not organise this journal draft."
                        : error.getMessage());
            }
        });
    }

    private File getModelFile() {
        File directory = getContext().getExternalFilesDir("models");
        if (directory == null) directory = new File(getContext().getFilesDir(), "models");
        if (!directory.exists()) directory.mkdirs();
        return new File(directory, MODEL_NAME);
    }

    private JSObject getStatusObject() {
        syncDownload();
        File model = getModelFile();
        DownloadSnapshot download = getDownloadSnapshot();
        JSObject result = new JSObject();
        result.put("modelInstalled", model.isFile() && model.length() == MODEL_SIZE_BYTES);
        result.put("modelBytes", model.isFile() ? model.length() : 0);
        result.put("modelInstallPath", model.getAbsolutePath());
        result.put("downloadId", download.id);
        result.put("downloadStatus", download.status);
        result.put("downloadBytes", download.bytes);
        result.put("downloadTotalBytes", download.totalBytes);
        result.put("downloadError", download.error);
        return result;
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
                getContext().getSharedPreferences("qwen_journal", Context.MODE_PRIVATE)
                        .edit().remove(DOWNLOAD_ID_KEY).apply();
            }
        }
    }

    private DownloadSnapshot getDownloadSnapshot() {
        long id = getContext().getSharedPreferences("qwen_journal", Context.MODE_PRIVATE)
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

    @Override
    protected void handleOnDestroy() {
        generationExecutor.shutdownNow();
        super.handleOnDestroy();
    }
}
