package com.zenchad.minddojo;

import android.Manifest;
import android.content.ContentResolver;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Size;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;

/**
 * Imports only references and 480px thumbnails for photos taken during an active run.
 * Originals remain in MediaStore. Everything stored here lives in noBackupFilesDir, so it is
 * excluded from Android backups; deleteAppCopy never deletes from the camera library.
 */
@CapacitorPlugin(
    name = "RunningPhotos",
    permissions = {
        @Permission(alias = "images", strings = { Manifest.permission.READ_MEDIA_IMAGES }),
        @Permission(alias = "imagesSelected", strings = { Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED }),
        @Permission(alias = "imagesLegacy", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public class RunningPhotosPlugin extends Plugin {
    private static final String STORE_FILE = "running-photo-associations.json";
    private static final String PHOTO_DIRECTORY = "running-photo-thumbnails";
    private static final long SCAN_OVERLAP_MS = 15_000L;
    private static final long START_GRACE_MS = 120_000L;
    private static final long FUTURE_GRACE_MS = 120_000L;
    private static final int MAX_MEDIA_ROWS = 80;

    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("permission", permissionName());
        call.resolve(result);
    }

    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (hasFullImagePermission()) {
            resolvePermission(call);
            return;
        }
        requestPermissionForAlias(permissionAlias(), call, "imagePermissionCallback");
    }

    @PermissionCallback
    private void imagePermissionCallback(PluginCall call) {
        resolvePermission(call);
    }

    @PluginMethod
    public void refresh(PluginCall call) {
        if (!hasAnyImagePermission()) {
            call.resolve(refreshResult(permissionStatus(), new JSArray(), "Photo-library access was not granted. You can keep running without run photos."));
            return;
        }

        String runId = safeRunId(call.getString("runId", ""));
        long startedAt = Math.max(0L, call.getLong("runStartedAt", 0L));
        if (runId.isEmpty() || startedAt == 0L) {
            call.reject("runId and runStartedAt are required to refresh run photos.");
            return;
        }

        long now = System.currentTimeMillis();
        long lastScanAt = Math.max(0L, call.getLong("lastScanAt", startedAt));
        JSONObject store = readStore();
        JSONArray photos = store.optJSONArray(runId);
        if (photos == null) photos = new JSONArray();
        Set<String> seen = idsFor(photos);
        JSArray imported = new JSArray();

        try {
            long lowerBound = Math.max(startedAt - START_GRACE_MS, lastScanAt - SCAN_OVERLAP_MS);
            String[] projection = projection();
            String selection = MediaStore.Images.Media.DATE_ADDED + " >= ?";
            String[] selectionArgs = new String[] { String.valueOf(Math.max(0L, lowerBound / 1000L)) };
            String sort = MediaStore.Images.Media.DATE_ADDED + " DESC";
            try (Cursor cursor = getContext().getContentResolver().query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI, projection, selection, selectionArgs, sort
            )) {
                if (cursor != null) {
                    int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID);
                    int dateTakenColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_TAKEN);
                    int dateAddedColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED);
                    int nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME);
                    int mimeColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE);
                    int processed = 0;
                    while (cursor.moveToNext() && processed < MAX_MEDIA_ROWS) {
                        long mediaId = cursor.getLong(idColumn);
                        String id = String.valueOf(mediaId);
                        if (seen.contains(id)) continue;
                        processed += 1;
                        long dateTaken = cursor.getLong(dateTakenColumn);
                        long dateAdded = cursor.getLong(dateAddedColumn) * 1000L;
                        long capturedAt = dateTaken > 0L ? dateTaken : dateAdded;
                        // Some camera apps leave DATE_TAKEN at 0. DATE_ADDED is the safe fallback.
                        // DATE_TAKEN/DATE_ADDED are epoch timestamps; compare them directly in
                        // milliseconds so device timezone changes cannot shift the run window.
                        if (capturedAt < startedAt - START_GRACE_MS || capturedAt > now + FUTURE_GRACE_MS) continue;
                        Uri sourceUri = Uri.withAppendedPath(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                        JSONObject item = new JSONObject();
                        item.put("id", id);
                        item.put("runId", runId);
                        item.put("capturedAt", capturedAt);
                        item.put("importedAt", now);
                        item.put("sourceUri", sourceUri.toString());
                        item.put("displayName", cursor.isNull(nameColumn) ? "Photo" : cursor.getString(nameColumn));
                        item.put("mimeType", cursor.isNull(mimeColumn) ? "image/*" : cursor.getString(mimeColumn));
                        item.put("sourceAvailable", true);
                        item.put("hasAppCopy", writeThumbnail(runId, id, sourceUri));
                        // The web layer attaches the GPS point closest to capturedAt after
                        // foreground/native point reconciliation. Scan-time location is wrong
                        // whenever Camera has kept the WebView suspended.
                        item.put("location", JSONObject.NULL);
                        photos.put(item);
                        imported.put(toJs(item));
                        seen.add(id);
                    }
                }
            }
            store.put(runId, photos);
            writeStore(store);
            call.resolve(refreshResult(hasFullImagePermission() ? "ready" : "limited", imported,
                hasFullImagePermission() ? null : "Only Android-selected photos were scanned. New camera photos may remain hidden."));
        } catch (Exception error) {
            call.resolve(refreshResult("error", imported, "ZenChad could not read recent photos. Your run is still being tracked."));
        }
    }

    @PluginMethod
    public void updateMetadata(PluginCall call) {
        String runId = safeRunId(call.getString("runId", ""));
        JSArray updates = call.getArray("updates", new JSArray());
        JSONObject store = readStore();
        JSONArray photos = store.optJSONArray(runId);
        int updated = 0;
        if (photos != null) {
            for (int updateIndex = 0; updateIndex < updates.length(); updateIndex += 1) {
                JSONObject update = updates.optJSONObject(updateIndex);
                if (update == null) continue;
                String id = update.optString("id", "");
                for (int photoIndex = 0; photoIndex < photos.length(); photoIndex += 1) {
                    JSONObject item = photos.optJSONObject(photoIndex);
                    if (item == null || !id.equals(item.optString("id"))) continue;
                    try {
                        if (update.has("caption")) {
                            String caption = update.isNull("caption") ? "" : update.optString("caption", "").trim();
                            if (caption.length() > 80) caption = caption.substring(0, 80).trim();
                            if (caption.isEmpty()) item.remove("caption");
                            else item.put("caption", caption);
                        }
                        if (update.has("location")) {
                            JSONObject location = update.optJSONObject("location");
                            item.put("location", location == null ? JSONObject.NULL : location);
                        }
                        updated += 1;
                    } catch (JSONException ignored) { }
                    break;
                }
            }
            try { store.put(runId, photos); } catch (JSONException ignored) { }
            writeStore(store);
        }
        JSObject response = new JSObject();
        response.put("updated", updated);
        call.resolve(response);
    }

    @PluginMethod
    public void moveAssociation(PluginCall call) {
        String sourceRunId = safeRunId(call.getString("sourceRunId", ""));
        String targetRunId = safeRunId(call.getString("targetRunId", ""));
        String id = call.getString("id", "");
        JSObject response = new JSObject();
        if (sourceRunId.isEmpty() || targetRunId.isEmpty() || sourceRunId.equals(targetRunId) || id.isEmpty()) {
            response.put("moved", false);
            call.resolve(response);
            return;
        }

        JSONObject store = readStore();
        JSONArray source = store.optJSONArray(sourceRunId);
        JSONArray target = store.optJSONArray(targetRunId);
        if (target == null) target = new JSONArray();
        JSONObject movedItem = null;
        JSONArray kept = new JSONArray();
        if (source != null) {
            for (int index = 0; index < source.length(); index += 1) {
                JSONObject item = source.optJSONObject(index);
                if (item == null) continue;
                if (movedItem == null && id.equals(item.optString("id"))) movedItem = item;
                else kept.put(item);
            }
        }

        if (movedItem != null) {
            JSONArray deduplicated = new JSONArray();
            for (int index = 0; index < target.length(); index += 1) {
                JSONObject item = target.optJSONObject(index);
                if (item != null && !id.equals(item.optString("id"))) deduplicated.put(item);
            }
            try {
                movedItem.put("runId", targetRunId);
                deduplicated.put(movedItem);
                store.put(sourceRunId, kept);
                store.put(targetRunId, deduplicated);
                moveThumbnail(sourceRunId, targetRunId, id);
                writeStore(store);
                response.put("moved", true);
                call.resolve(response);
                return;
            } catch (JSONException ignored) { }
        }
        response.put("moved", false);
        call.resolve(response);
    }

    @PluginMethod
    public void list(PluginCall call) {
        String runId = safeRunId(call.getString("runId", ""));
        JSArray result = new JSArray();
        JSONArray photos = readStore().optJSONArray(runId);
        if (photos != null) {
            for (int index = 0; index < photos.length(); index += 1) {
                JSONObject item = photos.optJSONObject(index);
                if (item == null) continue;
                try {
                    item.put("hasAppCopy", thumbnailFile(runId, item.optString("id")).isFile());
                    item.put("sourceAvailable", sourceExists(item.optString("sourceUri")));
                    result.put(toJs(item));
                } catch (JSONException ignored) {
                    // Return other saved associations even if one record is malformed.
                }
            }
        }
        JSObject response = new JSObject();
        response.put("photos", result);
        call.resolve(response);
    }

    @PluginMethod
    public void removeAssociation(PluginCall call) {
        String runId = safeRunId(call.getString("runId", ""));
        String id = call.getString("id", "");
        boolean deleteAppCopy = !Boolean.FALSE.equals(call.getBoolean("deleteAppCopy", true));
        JSONObject store = readStore();
        JSONArray photos = store.optJSONArray(runId);
        boolean removed = false;
        if (photos != null) {
            JSONArray kept = new JSONArray();
            for (int index = 0; index < photos.length(); index += 1) {
                JSONObject item = photos.optJSONObject(index);
                if (item != null && id.equals(item.optString("id"))) {
                    removed = true;
                    if (deleteAppCopy) deleteThumbnail(runId, id);
                } else if (item != null) kept.put(item);
            }
            try { store.put(runId, kept); } catch (JSONException ignored) { }
            writeStore(store);
        }
        JSObject response = new JSObject();
        response.put("removed", removed);
        call.resolve(response);
    }

    @PluginMethod
    public void deleteAppCopy(PluginCall call) {
        String runId = safeRunId(call.getString("runId", ""));
        String requestedId = call.getString("id");
        int deleted = 0;
        JSONArray photos = readStore().optJSONArray(runId);
        if (photos != null) {
            for (int index = 0; index < photos.length(); index += 1) {
                JSONObject item = photos.optJSONObject(index);
                if (item == null || (requestedId != null && !requestedId.equals(item.optString("id")))) continue;
                if (deleteThumbnail(runId, item.optString("id"))) deleted += 1;
                try { item.put("hasAppCopy", false); } catch (JSONException ignored) { }
            }
            JSONObject store = readStore();
            try { store.put(runId, photos); } catch (JSONException ignored) { }
            writeStore(store);
        }
        JSObject response = new JSObject();
        response.put("deleted", deleted);
        call.resolve(response);
    }

    @PluginMethod
    public void getThumbnailDataUrl(PluginCall call) {
        File file = thumbnailFile(safeRunId(call.getString("runId", "")), call.getString("id", ""));
        JSObject response = new JSObject();
        if (!file.isFile()) {
            response.put("missing", true);
            call.resolve(response);
            return;
        }
        try (FileInputStream input = new FileInputStream(file); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8_192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            response.put("dataUrl", "data:image/jpeg;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
        } catch (IOException ignored) {
            response.put("missing", true);
        }
        call.resolve(response);
    }

    @PluginMethod
    public void getDisplayDataUrl(PluginCall call) {
        String runId = safeRunId(call.getString("runId", ""));
        String id = call.getString("id", "");
        int maxDimension = Math.max(720, Math.min(2_048, call.getInt("maxDimension", 1_600)));
        JSObject response = new JSObject();
        JSONObject item = findPhoto(runId, id);
        if (item == null) {
            response.put("missing", true);
            response.put("sourceAvailable", false);
            call.resolve(response);
            return;
        }

        Bitmap bitmap = null;
        try {
            Uri source = Uri.parse(item.optString("sourceUri", ""));
            bitmap = decodeDisplayBitmap(source, maxDimension);
            if (bitmap == null) throw new IOException("Image could not be decoded.");
            try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 88, output)) {
                    throw new IOException("Image could not be compressed.");
                }
                response.put("dataUrl", "data:image/jpeg;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
                response.put("sourceAvailable", true);
                response.put("width", bitmap.getWidth());
                response.put("height", bitmap.getHeight());
            }
        } catch (Exception ignored) {
            response.put("missing", true);
            response.put("sourceAvailable", false);
        } finally {
            if (bitmap != null) bitmap.recycle();
        }
        call.resolve(response);
    }

    private String[] projection() {
        return new String[] {
            MediaStore.Images.Media._ID, MediaStore.Images.Media.DATE_TAKEN, MediaStore.Images.Media.DATE_ADDED,
            MediaStore.Images.Media.DISPLAY_NAME, MediaStore.Images.Media.MIME_TYPE
        };
    }

    private boolean hasFullImagePermission() {
        return getPermissionState(permissionAlias()) == PermissionState.GRANTED;
    }

    private boolean hasLimitedImagePermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
            && getPermissionState("imagesSelected") == PermissionState.GRANTED;
    }

    private boolean hasAnyImagePermission() {
        return hasFullImagePermission() || hasLimitedImagePermission();
    }

    private String permissionAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "images" : "imagesLegacy";
    }

    private String permissionName() {
        PermissionState state = getPermissionState(permissionAlias());
        if (state == PermissionState.GRANTED) return "full";
        if (hasLimitedImagePermission()) return "limited";
        return state == PermissionState.PROMPT ? "prompt" : "denied";
    }

    private String permissionStatus() {
        if ("limited".equals(permissionName())) return "limited";
        return "prompt".equals(permissionName()) ? "permission-required" : "permission-denied";
    }

    private void resolvePermission(PluginCall call) {
        JSObject result = new JSObject();
        String permission = permissionName();
        result.put("permission", permission);
        if ("limited".equals(permission)) {
            result.put("message", "Only selected photos are available. New camera photos will not be watched unless you allow all photos.");
        } else if (!"full".equals(permission)) {
            result.put("message", "Photo access was not granted. Run tracking continues without photos.");
        }
        call.resolve(result);
    }

    private JSObject refreshResult(String status, JSArray imported, String message) {
        JSObject result = new JSObject();
        result.put("status", status);
        result.put("permission", permissionName());
        result.put("scannedAt", System.currentTimeMillis());
        result.put("imported", imported);
        if (message != null) result.put("message", message);
        return result;
    }

    private JSONObject readStore() {
        File file = new File(getContext().getNoBackupFilesDir(), STORE_FILE);
        if (!file.isFile()) return new JSONObject();
        try (FileInputStream input = new FileInputStream(file); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4_096];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return new JSONObject(output.toString("UTF-8"));
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }

    private void writeStore(JSONObject store) {
        File directory = getContext().getNoBackupFilesDir();
        File temporary = new File(directory, STORE_FILE + ".tmp");
        File target = new File(directory, STORE_FILE);
        try (FileOutputStream output = new FileOutputStream(temporary, false)) {
            output.write(store.toString().getBytes("UTF-8"));
            output.flush();
            if (!temporary.renameTo(target)) {
                try (FileOutputStream replacement = new FileOutputStream(target, false)) {
                    replacement.write(store.toString().getBytes("UTF-8"));
                }
                temporary.delete();
            }
        } catch (IOException ignored) {
            temporary.delete();
        }
    }

    private Set<String> idsFor(JSONArray photos) {
        Set<String> ids = new HashSet<>();
        for (int index = 0; index < photos.length(); index += 1) {
            JSONObject item = photos.optJSONObject(index);
            if (item != null) ids.add(item.optString("id"));
        }
        return ids;
    }

    private JSONObject findPhoto(String runId, String id) {
        JSONArray photos = readStore().optJSONArray(runId);
        if (photos == null || id == null || id.isEmpty()) return null;
        for (int index = 0; index < photos.length(); index += 1) {
            JSONObject item = photos.optJSONObject(index);
            if (item != null && id.equals(item.optString("id"))) return item;
        }
        return null;
    }

    private Bitmap decodeDisplayBitmap(Uri source, int maxDimension) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            ImageDecoder.Source imageSource = ImageDecoder.createSource(resolver, source);
            return ImageDecoder.decodeBitmap(imageSource, (decoder, info, ignored) -> {
                int width = info.getSize().getWidth();
                int height = info.getSize().getHeight();
                int largest = Math.max(width, height);
                if (largest > maxDimension) {
                    float scale = maxDimension / (float) largest;
                    decoder.setTargetSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
                }
                decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
            });
        }

        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream input = resolver.openInputStream(source)) {
            if (input == null) throw new IOException("Image is unavailable.");
            BitmapFactory.decodeStream(input, null, bounds);
        }
        int sampleSize = 1;
        while (Math.max(bounds.outWidth, bounds.outHeight) / sampleSize > maxDimension) sampleSize *= 2;
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = Math.max(1, sampleSize);
        try (InputStream input = resolver.openInputStream(source)) {
            if (input == null) throw new IOException("Image is unavailable.");
            return BitmapFactory.decodeStream(input, null, options);
        }
    }

    private boolean writeThumbnail(String runId, String id, Uri source) {
        Bitmap bitmap = null;
        try {
            ContentResolver resolver = getContext().getContentResolver();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                bitmap = resolver.loadThumbnail(source, new Size(480, 480), null);
            } else {
                bitmap = MediaStore.Images.Thumbnails.getThumbnail(resolver, Long.parseLong(id), MediaStore.Images.Thumbnails.MINI_KIND, null);
            }
            if (bitmap == null) return false;
            File file = thumbnailFile(runId, id);
            File parent = file.getParentFile();
            if (parent != null && !parent.isDirectory() && !parent.mkdirs()) return false;
            try (FileOutputStream output = new FileOutputStream(file, false)) {
                return bitmap.compress(Bitmap.CompressFormat.JPEG, 72, output);
            }
        } catch (Exception ignored) {
            return false; // A deleted/missing source image must never interrupt run recording.
        } finally {
            if (bitmap != null) bitmap.recycle();
        }
    }

    private boolean sourceExists(String sourceUri) {
        if (sourceUri == null || sourceUri.isEmpty()) return false;
        try (android.os.ParcelFileDescriptor ignored = getContext().getContentResolver().openFileDescriptor(Uri.parse(sourceUri), "r")) {
            return ignored != null;
        } catch (Exception ignored) {
            return false;
        }
    }

    private File thumbnailFile(String runId, String id) {
        return new File(new File(getContext().getNoBackupFilesDir(), PHOTO_DIRECTORY + File.separator + safeRunId(runId)), safeFilePart(id) + ".jpg");
    }

    private boolean deleteThumbnail(String runId, String id) {
        File file = thumbnailFile(runId, id);
        return !file.exists() || file.delete();
    }

    private void moveThumbnail(String sourceRunId, String targetRunId, String id) {
        File source = thumbnailFile(sourceRunId, id);
        if (!source.isFile()) return;
        File target = thumbnailFile(targetRunId, id);
        File parent = target.getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs()) return;
        if (target.exists()) target.delete();
        if (source.renameTo(target)) return;
        try (FileInputStream input = new FileInputStream(source); FileOutputStream output = new FileOutputStream(target, false)) {
            byte[] buffer = new byte[8_192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            output.flush();
            source.delete();
        } catch (IOException ignored) {
            target.delete();
        }
    }

    private static String safeRunId(String value) {
        return value == null ? "" : value.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private static String safeFilePart(String value) {
        return value == null ? "" : value.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private JSObject toJs(JSONObject source) {
        JSObject target = new JSObject();
        try {
            java.util.Iterator<String> keys = source.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                Object value = source.get(key);
                target.put(key, value == JSONObject.NULL ? null : value);
            }
        } catch (JSONException ignored) { }
        return target;
    }
}
