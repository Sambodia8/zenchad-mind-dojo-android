# ZenChad Tasker bridge

The Android app writes and reads the fixed staging file:

`/storage/emulated/0/ZenChad/zenchad-sync.json`

The native bridge broadcasts these events so Tasker can move that file through the Google Drive-backed `ZenChad` folder:

- `com.zenchad.minddojo.SYNC_EXPORT_READY` — upload the file at the `path` extra to `D:/My Drive/ZenChad/zenchad-sync.json` (Tasker may expose the Drive folder as `/storage/emulated/0/Google Drive/ZenChad`; use the exact local path shown by the Drive app).
- `com.zenchad.minddojo.SYNC_IMPORT_REQUESTED` — download the Drive file to the same fixed Android path, replacing it atomically where possible.

## One-time Tasker setup

1. Create a Profile with `Event > Intent Received` and action `com.zenchad.minddojo.SYNC_EXPORT_READY`.
2. Add a file-copy/upload action targeting the Google Drive-backed `ZenChad/zenchad-sync.json` file. Use the received `%path` variable as the source.
3. Create a second Profile for `com.zenchad.minddojo.SYNC_IMPORT_REQUESTED`.
4. Add a Google Drive download/copy action from `ZenChad/zenchad-sync.json` to `/storage/emulated/0/ZenChad/zenchad-sync.json`.
5. Keep the exact filename `zenchad-sync.json` in both tasks. The app reports a clear “download it, then try Import again” message if Tasker has not finished.

The bridge is intentionally file-based: ZenChad remains usable offline, and no cloud database or account service is required. Tasker/Drive handles transport; ZenChad handles validation, merging, tombstones, and local backups.
