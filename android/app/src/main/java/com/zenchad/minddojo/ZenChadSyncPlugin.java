package com.zenchad.minddojo;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "ZenChadSync")
public class ZenChadSyncPlugin extends Plugin {
    private volatile boolean documentBusy;
    private static final int MAX_IMPORT_BYTES = 32 * 1024 * 1024;

    private JSObject result(boolean ok, String reason) {
        JSObject value = new JSObject();
        value.put("ok", ok);
        value.put("reason", reason);
        return value;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(result(true, "Choose a file when saving or importing."));
    }

    @PluginMethod
    public void exportSync(PluginCall call) {
        save(call, "zenchad-sync.json", "application/json");
    }

    @PluginMethod
    public void exportDocument(PluginCall call) {
        String name = call.getString("filename", "zenchad-journal.json");
        if (!name.matches("[a-zA-Z0-9._-]{1,100}")) {
            call.resolve(result(false, "Invalid export filename."));
            return;
        }
        save(call, name, "application/json");
    }

    private void save(PluginCall call, String name, String mime) {
        String json = call.getString("json");
        if (json == null || json.trim().isEmpty()) {
            call.resolve(result(false, "There is no data to export."));
            return;
        }
        launch(call, new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE).setType(mime)
            .putExtra(Intent.EXTRA_TITLE, name), "documentCreated");
    }

    private void launch(PluginCall call, Intent intent, String callback) {
        if (documentBusy) {
            call.resolve(result(false, "Finish the open file picker first."));
            return;
        }
        documentBusy = true;
        try { startActivityForResult(call, intent, callback); }
        catch (Exception error) {
            documentBusy = false;
            call.resolve(result(false, "The file picker could not open. Please try again."));
        }
    }

    @ActivityCallback
    private void documentCreated(PluginCall call, ActivityResult response) {
        if (call == null) { documentBusy = false; return; }
        Uri uri = response.getData() == null ? null : response.getData().getData();
        if (response.getResultCode() != Activity.RESULT_OK || uri == null) {
            documentBusy = false;
            JSObject value = result(false, "Export cancelled. No backup was saved.");
            value.put("cancelled", true);
            call.resolve(value);
            return;
        }
        getBridge().execute(() -> {
            try {
                String json = call.getString("json");
                if (json == null) throw new IllegalStateException("Export data is unavailable");
                try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                    if (output == null) throw new IllegalStateException("Cannot open destination");
                    output.write(json.getBytes(StandardCharsets.UTF_8));
                    output.flush();
                }
                JSObject value = result(true, "Saved to the location you chose.");
                value.put("uri", uri.toString());
                call.resolve(value);
            } catch (Exception error) {
                call.resolve(result(false, "The file could not be saved. Choose another location and try again."));
            } finally { documentBusy = false; }
        });
    }

    @PluginMethod
    public void importSync(PluginCall call) {
        launch(call, new Intent(Intent.ACTION_OPEN_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
            .putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"}), "documentOpened");
    }

    @ActivityCallback
    private void documentOpened(PluginCall call, ActivityResult response) {
        if (call == null) { documentBusy = false; return; }
        Uri uri = response.getData() == null ? null : response.getData().getData();
        if (response.getResultCode() != Activity.RESULT_OK || uri == null) {
            documentBusy = false;
            JSObject value = result(false, "Import cancelled. Your data is unchanged.");
            value.put("cancelled", true);
            call.resolve(value);
            return;
        }
        getBridge().execute(() -> {
            try (InputStream input = getContext().getContentResolver().openInputStream(uri);
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                if (input == null) throw new IllegalStateException("Cannot open source");
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (output.size() + count > MAX_IMPORT_BYTES) throw new IllegalStateException("Backup exceeds 32 MB");
                    output.write(buffer, 0, count);
                }
                JSObject value = result(true, "Backup read.");
                value.put("json", new String(output.toByteArray(), StandardCharsets.UTF_8));
                call.resolve(value);
            } catch (Exception error) {
                call.resolve(result(false, "The backup could not be read. Choose a ZenChad JSON backup under 32 MB."));
            } finally { documentBusy = false; }
        });
    }
}
