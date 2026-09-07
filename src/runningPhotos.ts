import { registerPlugin } from "@capacitor/core";

/**
 * Run photos are deliberately references to the device library plus a small, app-private
 * thumbnail. ZenChad does not copy the original image, upload it, or read the library until
 * the runner explicitly grants photo access. Deleting an app copy removes only that thumbnail.
 */
export const RUN_PHOTO_PRIVACY_NOTE =
  "Run photos stay on this device. ZenChad keeps an app-private thumbnail and a reference to the original; it never uploads or copies the full photo.";

export type RunPhotoPermission = "full" | "limited" | "prompt" | "denied" | "unavailable";
export type RunPhotoStatus = "ready" | "limited" | "permission-required" | "permission-denied" | "unavailable" | "error";

export interface RunPhotoLocation {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}

export interface RunPhoto {
  /** Stable only while the source MediaStore item exists. */
  id: string;
  runId: string;
  capturedAt: number;
  importedAt: number;
  sourceUri: string;
  displayName: string;
  caption?: string;
  mimeType: string;
  sourceAvailable: boolean;
  /** An app-private, low-resolution thumbnail; this is not the full camera image. */
  hasAppCopy: boolean;
  location: RunPhotoLocation | null;
}

export interface RunPhotoRefresh {
  status: RunPhotoStatus;
  permission: RunPhotoPermission;
  scannedAt: number;
  imported: RunPhoto[];
  message?: string;
}

interface RunningPhotosPlugin {
  getPermissionStatus(): Promise<{ permission: RunPhotoPermission }>;
  requestAccess(): Promise<{ permission: RunPhotoPermission; message?: string }>;
  refresh(options: {
    runId: string;
    runStartedAt: number;
    lastScanAt?: number;
  }): Promise<RunPhotoRefresh>;
  list(options: { runId: string }): Promise<{ photos: RunPhoto[] }>;
  updateMetadata(options: {
    runId: string;
    updates: Array<{ id: string; caption?: string | null; location?: RunPhotoLocation | null }>;
  }): Promise<{ updated: number }>;
  moveAssociation(options: { sourceRunId: string; targetRunId: string; id: string }): Promise<{ moved: boolean }>;
  removeAssociation(options: { runId: string; id: string; deleteAppCopy?: boolean }): Promise<{ removed: boolean }>;
  deleteAppCopy(options: { runId: string; id?: string }): Promise<{ deleted: number }>;
  getThumbnailDataUrl(options: { runId: string; id: string }): Promise<{ dataUrl?: string; missing?: boolean }>;
  getDisplayDataUrl(options: { runId: string; id: string; maxDimension?: number }): Promise<{
    dataUrl?: string;
    missing?: boolean;
    sourceAvailable: boolean;
    width?: number;
    height?: number;
  }>;
}

const RunningPhotos = registerPlugin<RunningPhotosPlugin>("RunningPhotos");

function unavailableRefresh(message = "Run photos are available in the Android app only."): RunPhotoRefresh {
  return { status: "unavailable", permission: "unavailable", scannedAt: Date.now(), imported: [], message };
}

/** Never throws for expected permission/device failures, so a run can continue uninterrupted. */
export async function refreshRunPhotos(options: {
  runId: string;
  runStartedAt: number;
  lastScanAt?: number;
}): Promise<RunPhotoRefresh> {
  try {
    return await RunningPhotos.refresh(options);
  } catch (error) {
    return unavailableRefresh(error instanceof Error ? error.message : undefined);
  }
}

export async function getRunPhotoPermission(): Promise<RunPhotoPermission> {
  try {
    return (await RunningPhotos.getPermissionStatus()).permission;
  } catch {
    return "unavailable";
  }
}

export async function requestRunPhotoAccess(): Promise<{ permission: RunPhotoPermission; message?: string }> {
  try {
    return await RunningPhotos.requestAccess();
  } catch (error) {
    return { permission: "unavailable", message: error instanceof Error ? error.message : undefined };
  }
}

export async function listRunPhotos(runId: string): Promise<RunPhoto[]> {
  try {
    return (await RunningPhotos.list({ runId })).photos;
  } catch {
    return [];
  }
}

export async function removeRunPhotoAssociation(runId: string, id: string, deleteAppCopy = true) {
  try {
    return await RunningPhotos.removeAssociation({ runId, id, deleteAppCopy });
  } catch {
    return { removed: false };
  }
}

export async function updateRunPhotoMetadata(
  runId: string,
  updates: Array<{ id: string; caption?: string | null; location?: RunPhotoLocation | null }>
) {
  if (!updates.length) return { updated: 0 };
  try {
    return await RunningPhotos.updateMetadata({ runId, updates });
  } catch {
    return { updated: 0 };
  }
}

export async function moveRunPhotoAssociation(sourceRunId: string, targetRunId: string, id: string) {
  try {
    return await RunningPhotos.moveAssociation({ sourceRunId, targetRunId, id });
  } catch {
    return { moved: false };
  }
}

/** Deletes ZenChad's thumbnail(s), never the image in the system camera library. */
export async function deleteRunPhotoAppCopy(runId: string, id?: string) {
  try {
    return await RunningPhotos.deleteAppCopy({ runId, id });
  } catch {
    return { deleted: 0 };
  }
}

export async function getRunPhotoThumbnailDataUrl(runId: string, id: string): Promise<string | null> {
  try {
    const result = await RunningPhotos.getThumbnailDataUrl({ runId, id });
    return result.dataUrl ?? null;
  } catch {
    return null;
  }
}

export async function getRunPhotoDisplayDataUrl(runId: string, id: string, maxDimension = 1_600) {
  try {
    const result = await RunningPhotos.getDisplayDataUrl({ runId, id, maxDimension });
    return { dataUrl: result.dataUrl ?? null, sourceAvailable: result.sourceAvailable };
  } catch {
    return { dataUrl: null, sourceAvailable: false };
  }
}
