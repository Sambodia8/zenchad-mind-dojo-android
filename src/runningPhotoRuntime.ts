import type { RunPoint } from "./running";
import {
  listRunPhotos,
  refreshRunPhotos,
  updateRunPhotoMetadata,
  type RunPhoto,
  type RunPhotoLocation,
  type RunPhotoRefresh
} from "./runningPhotos";

export interface ActiveRunPhotoPollingOptions {
  runId: string;
  runStartedAt: number;
  /** Return accepted measured-run points, including points recovered from native tracking. */
  getRunPoints: () => RunPoint[];
  onRefresh?: (result: RunPhotoRefresh) => void;
  intervalMs?: number;
}

/**
 * Foreground-only MediaStore polling fallback. Start this when a run becomes active and stop it
 * when it ends/unmounts. Android does not provide a reliable, permission-free camera event for
 * third-party apps, so this intentionally avoids a background content observer/service.
 */
export function startActiveRunPhotoPolling(options: ActiveRunPhotoPollingOptions) {
  const intervalMs = Math.max(15_000, options.intervalMs ?? 20_000);
  let stopped = false;
  let inFlight = false;
  let lastScanAt = options.runStartedAt;

  const closestLocation = (photo: RunPhoto, points: RunPoint[]): RunPhotoLocation | null => {
    if (!points.length) return null;
    let closest = points[0];
    let closestDelta = Math.abs(closest.at - photo.capturedAt);
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index];
      const delta = Math.abs(point.at - photo.capturedAt);
      if (delta < closestDelta) {
        closest = point;
        closestDelta = delta;
      }
    }
    return { lat: closest.lat, lng: closest.lng, accuracy: closest.accuracy, at: closest.at };
  };

  const reconcileLocations = async () => {
    const points = options.getRunPoints();
    if (!points.length) return;
    const photos = await listRunPhotos(options.runId);
    const updates = photos.flatMap((photo) => {
      const closest = closestLocation(photo, points);
      if (!closest || photo.location?.at === closest.at) return [];
      return [{ id: photo.id, location: closest }];
    });
    await updateRunPhotoMetadata(options.runId, updates);
  };

  const refresh = async () => {
    if (stopped || inFlight) return null;
    inFlight = true;
    try {
      const result = await refreshRunPhotos({
        runId: options.runId,
        runStartedAt: options.runStartedAt,
        lastScanAt
      });
      if (stopped) return null;
      await reconcileLocations();
      lastScanAt = result.scannedAt;
      options.onRefresh?.(result);
      return result;
    } finally {
      inFlight = false;
    }
  };

  void refresh();
  const timer = window.setInterval(() => void refresh(), intervalMs);
  return {
    refresh,
    stop() {
      stopped = true;
      window.clearInterval(timer);
    }
  };
}
