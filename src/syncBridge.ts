import { registerPlugin } from "@capacitor/core";
import type { AppData } from "./types";
import {
  applySyncEnvelope,
  captureSyncEnvelope,
  getSyncStatus,
  parseSyncEnvelope,
  serialiseSyncEnvelope,
  setSyncStatus,
  type SyncStatus
} from "./sync";
import { loadData } from "./storage";
import { isNativeAndroid } from "./native";

interface NativeSyncResult {
  ok: boolean;
  json?: string;
  reason?: string;
  path?: string;
  modifiedAt?: number;
}

interface NativeSyncPlugin {
  getStatus(): Promise<NativeSyncResult>;
  exportSync(options: { json: string }): Promise<NativeSyncResult>;
  importSync(): Promise<NativeSyncResult>;
}

const NativeSync = registerPlugin<NativeSyncPlugin>("ZenChadSync");

export type SyncActionResult = NativeSyncResult & { status: SyncStatus };

let remoteApplyInProgress = false;
let exportTimer: number | null = null;

function browserExport(json: string): NativeSyncResult {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "zenchad-sync.json";
  anchor.click();
  URL.revokeObjectURL(url);
  return { ok: true, reason: "A copy of the sync file was downloaded." };
}

async function browserImport(): Promise<NativeSyncResult> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ ok: false, reason: "No sync file was selected." });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ ok: true, json: String(reader.result ?? "") });
      reader.onerror = () => resolve({ ok: false, reason: "The sync file could not be read." });
      reader.readAsText(file);
    };
    input.click();
  });
}

function desktopApi() {
  return typeof window !== "undefined" ? window.zenchadDesktopSync : undefined;
}

export async function getDataSyncStatus(): Promise<SyncStatus> {
  const local = getSyncStatus();
  const desktop = desktopApi();
  if (!desktop) return local;
  const result = await desktop.getStatus();
  return { ...local, configured: result.ok };
}

export async function exportSyncData(data: AppData): Promise<SyncActionResult> {
  const envelope = captureSyncEnvelope(data);
  const json = serialiseSyncEnvelope(envelope);
  let result: NativeSyncResult;
  try {
    if (isNativeAndroid()) result = await NativeSync.exportSync({ json });
    else if (desktopApi()) result = await desktopApi()!.exportNow(json);
    else result = browserExport(json);
  } catch (error) {
    result = { ok: false, reason: error instanceof Error ? error.message : "Export failed." };
  }
  setSyncStatus({
    configured: result.ok,
    lastAction: result.ok ? "export" : "error",
    lastSuccessAt: result.ok ? new Date().toISOString() : getSyncStatus().lastSuccessAt,
    lastError: result.ok ? null : result.reason ?? "Export failed."
  });
  return { ...result, status: getSyncStatus() };
}

export async function importSyncData(setData: (data: AppData) => void): Promise<SyncActionResult> {
  let result: NativeSyncResult;
  try {
    if (isNativeAndroid()) result = await NativeSync.importSync();
    else if (desktopApi()) result = await desktopApi()!.importNow();
    else result = await browserImport();
    if (result.ok && result.json) {
      const envelope = parseSyncEnvelope(result.json);
      cancelScheduledDesktopExport();
      remoteApplyInProgress = true;
      const merged = applySyncEnvelope(envelope);
      setData(merged);
      window.setTimeout(() => { remoteApplyInProgress = false; }, 0);
    }
  } catch (error) {
    result = { ok: false, reason: error instanceof Error ? error.message : "Import failed." };
  }
  setSyncStatus({
    configured: result.ok,
    lastAction: result.ok ? "import" : "error",
    lastSuccessAt: result.ok ? new Date().toISOString() : getSyncStatus().lastSuccessAt,
    lastError: result.ok ? null : result.reason ?? "Import failed."
  });
  return { ...result, status: getSyncStatus() };
}

export function isSyncApplyingRemote() {
  return remoteApplyInProgress;
}

export function cancelScheduledDesktopExport() {
  if (exportTimer !== null) window.clearTimeout(exportTimer);
  exportTimer = null;
}

export function scheduleDesktopExport(data: AppData) {
  if (!desktopApi() || remoteApplyInProgress) return;
  if (exportTimer !== null) window.clearTimeout(exportTimer);
  exportTimer = window.setTimeout(() => {
    exportTimer = null;
    void exportSyncData(data);
  }, 1200);
}

export function initialiseDesktopSync(onData: (data: AppData) => void) {
  const desktop = desktopApi();
  if (!desktop) return () => {};
  const unsubscribe = desktop.onRemoteUpdate((result) => {
    if (!result.ok || !result.json) return;
    try {
      cancelScheduledDesktopExport();
      remoteApplyInProgress = true;
      const merged = applySyncEnvelope(parseSyncEnvelope(result.json));
      onData(merged);
      window.setTimeout(() => { remoteApplyInProgress = false; }, 0);
    } catch (error) {
      setSyncStatus({ lastAction: "error", lastError: error instanceof Error ? error.message : "Remote sync failed." });
    }
  });
  void desktop.importNow().then((result) => {
    if (!result.ok || !result.json) return;
    try {
      cancelScheduledDesktopExport();
      remoteApplyInProgress = true;
      onData(applySyncEnvelope(parseSyncEnvelope(result.json)));
      window.setTimeout(() => { remoteApplyInProgress = false; }, 0);
    } catch (error) {
      setSyncStatus({ lastAction: "error", lastError: error instanceof Error ? error.message : "Startup sync failed." });
    }
  });
  return unsubscribe;
}

export function currentDataAfterSync() {
  return loadData();
}
