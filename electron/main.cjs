const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const SYNC_PATH = "D:\\My Drive\\ZenChad\\zenchad-sync.json";
const WATCH_DEBOUNCE_MS = 1500;
let mainWindow;
let watchTimer;
let lastWrittenJson = null;

function result(ok, extra = {}) {
  return { ok, path: SYNC_PATH, ...extra };
}

function validateJson(json) {
  const parsed = JSON.parse(json);
  if (parsed?.format !== "zenchad-sync" || parsed?.schemaVersion !== 1 || !parsed?.data) {
    throw new Error("Unsupported ZenChad sync file format.");
  }
}

function readSyncFile() {
  if (!fs.existsSync(SYNC_PATH)) return result(false, { reason: "The Drive sync file is not present yet." });
  const json = fs.readFileSync(SYNC_PATH, "utf8");
  validateJson(json);
  return result(true, { json, modifiedAt: fs.statSync(SYNC_PATH).mtimeMs });
}

function backupExisting() {
  if (!fs.existsSync(SYNC_PATH)) return;
  const folder = path.dirname(SYNC_PATH);
  const stamp = new Date().toISOString().replace(/[.:]/g, "-");
  fs.copyFileSync(SYNC_PATH, path.join(folder, `zenchad-sync-backup-${stamp}.json`));
}

function writeSyncFile(json) {
  validateJson(json);
  const folder = path.dirname(SYNC_PATH);
  fs.mkdirSync(folder, { recursive: true });
  backupExisting();
  const temporary = path.join(folder, `.zenchad-sync-${process.pid}.tmp`);
  fs.writeFileSync(temporary, json, "utf8");
  fs.renameSync(temporary, SYNC_PATH);
  lastWrittenJson = json;
  return result(true, { modifiedAt: fs.statSync(SYNC_PATH).mtimeMs });
}

function notifyRemoteUpdate() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const update = readSyncFile();
    if (update.ok && update.json === lastWrittenJson) {
      lastWrittenJson = null;
      return;
    }
    if (update.ok) mainWindow.webContents.send("zenchad:remote-update", update);
  } catch {
    // Google Drive can expose a partially written temporary file. The next
    // debounced change will be attempted without disturbing local app data.
  }
}

function watchSyncFolder() {
  const folder = path.dirname(SYNC_PATH);
  try { fs.mkdirSync(folder, { recursive: true }); } catch { return; }
  fs.watch(folder, (_eventType, filename) => {
    if (filename && filename.toString() !== path.basename(SYNC_PATH)) return;
    if (watchTimer) clearTimeout(watchTimer);
    watchTimer = setTimeout(() => {
      watchTimer = undefined;
      notifyRemoteUpdate();
    }, WATCH_DEBOUNCE_MS);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#080d1b",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const startUrl = process.env.ZENCHAD_DEV_SERVER;
  if (startUrl) void mainWindow.loadURL(startUrl);
  else void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  watchSyncFolder();
}

ipcMain.handle("zenchad:status", () => {
  try {
    return result(fs.existsSync(SYNC_PATH), {
      modifiedAt: fs.existsSync(SYNC_PATH) ? fs.statSync(SYNC_PATH).mtimeMs : undefined
    });
  } catch (error) {
    return result(false, { reason: error.message });
  }
});
ipcMain.handle("zenchad:export", (_event, json) => {
  try { return writeSyncFile(json); } catch (error) { return result(false, { reason: error.message }); }
});
ipcMain.handle("zenchad:import", () => {
  try { return readSyncFile(); } catch (error) { return result(false, { reason: error.message }); }
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
