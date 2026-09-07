package com.zenchad.minddojo;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(name = "ZenChadSync")
public class ZenChadSyncPlugin extends Plugin {
    private static final String FILE_NAME = "zenchad-sync.json";
    private static final String READY_ACTION = "com.zenchad.minddojo.SYNC_EXPORT_READY";
    private static final String IMPORT_ACTION = "com.zenchad.minddojo.SYNC_IMPORT_REQUESTED";

    private File syncFile() {
        return new File(new File(Environment.getExternalStorageDirectory(), "ZenChad"), FILE_NAME);
    }

    private boolean hasStorageAccess() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.R || Environment.isExternalStorageManager();
    }

    private void requestStorageAccess() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return;
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
        } catch (Exception ignored) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
            getActivity().startActivity(intent);
        }
    }

    private JSObject result(boolean ok, String reason, File file) {
        JSObject value = new JSObject();
        value.put("ok", ok);
        if (reason != null) value.put("reason", reason);
        value.put("path", syncFile().getAbsolutePath());
        if (file != null && file.exists()) value.put("modifiedAt", file.lastModified());
        return value;
    }

    private String setupMessage() {
        return "Android needs one-time Files and media access for /storage/emulated/0/ZenChad. Settings has been opened; allow access, then try again.";
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        File file = syncFile();
        JSObject value = result(hasStorageAccess(), hasStorageAccess() ? null : setupMessage(), file);
        value.put("exists", file.exists());
        call.resolve(value);
    }

    @PluginMethod
    public void exportSync(PluginCall call) {
        if (!hasStorageAccess()) {
            requestStorageAccess();
            call.resolve(result(false, setupMessage(), null));
            return;
        }
        String json = call.getString("json");
        if (json == null || json.trim().isEmpty()) {
            call.resolve(result(false, "There was no sync data to export.", null));
            return;
        }
        File file = syncFile();
        File directory = file.getParentFile();
        File temporary = new File(directory, FILE_NAME + ".tmp");
        try {
            if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("The ZenChad folder could not be created.");
            if (file.exists()) {
                String stamp = new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(new Date());
                copy(file, new File(directory, "zenchad-sync-backup-" + stamp + ".json"));
            }
            try (FileOutputStream output = new FileOutputStream(temporary)) {
                output.write(json.getBytes(StandardCharsets.UTF_8));
                output.getFD().sync();
            }
            if (!temporary.renameTo(file)) {
                copy(temporary, file);
                if (!temporary.delete()) temporary.deleteOnExit();
            }
            Intent ready = new Intent(READY_ACTION);
            ready.putExtra("path", file.getAbsolutePath());
            ready.putExtra("filename", FILE_NAME);
            getContext().sendBroadcast(ready);
            call.resolve(result(true, null, file));
        } catch (Exception error) {
            if (temporary.exists()) temporary.delete();
            call.resolve(result(false, "Android could not write the sync file: " + error.getMessage(), file));
        }
    }

    @PluginMethod
    public void importSync(PluginCall call) {
        if (!hasStorageAccess()) {
            requestStorageAccess();
            call.resolve(result(false, setupMessage(), null));
            return;
        }
        File file = syncFile();
        if (!file.exists()) {
            Intent requested = new Intent(IMPORT_ACTION);
            requested.putExtra("path", file.getAbsolutePath());
            requested.putExtra("filename", FILE_NAME);
            getContext().sendBroadcast(requested);
            call.resolve(result(false, "No downloaded sync file was found yet. Ask Tasker to download it, then try Import again.", file));
            return;
        }
        try {
            String json = read(file);
            JSObject value = result(true, null, file);
            value.put("json", json);
            call.resolve(value);
        } catch (Exception error) {
            call.resolve(result(false, "The sync file could not be read: " + error.getMessage(), file));
        }
    }

    private static String read(@NonNull File file) throws Exception {
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] bytes = new byte[(int) file.length()];
            int offset = 0;
            int count;
            while (offset < bytes.length && (count = input.read(bytes, offset, bytes.length - offset)) > 0) offset += count;
            return new String(bytes, 0, offset, StandardCharsets.UTF_8);
        }
    }

    private static void copy(@NonNull File source, @NonNull File destination) throws Exception {
        try (FileInputStream input = new FileInputStream(source); FileOutputStream output = new FileOutputStream(destination)) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) >= 0) {
                if (count > 0) output.write(buffer, 0, count);
            }
            output.getFD().sync();
        }
    }
}
