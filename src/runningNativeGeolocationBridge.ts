import { Capacitor } from "@capacitor/core";
import { loadRunSession, type RunPoint } from "./running";
import {
  getNativeRunningSnapshot,
  startNativeRunningTracker,
  stopNativeRunningTracker
} from "./runningNative";

type NativeWatcher = {
  success: PositionCallback;
  error?: PositionErrorCallback | null;
  lastDeliveredAt: number;
  timer: number | null;
  usingFallback: boolean;
  fallbackWatchId?: number;
};

let installed = false;
let nextWatchId = 90_000;
const watchers = new Map<number, NativeWatcher>();

function latestStoredPointTime() {
  const session = loadRunSession();
  if (!session?.points.length) return 0;
  return session.points.reduce((latest, point) => Math.max(latest, point.at), 0);
}

function toPosition(point: RunPoint): GeolocationPosition {
  return {
    coords: {
      latitude: point.lat,
      longitude: point.lng,
      accuracy: point.accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null
    },
    timestamp: point.at
  };
}

function toPositionError(error: unknown): GeolocationPositionError {
  const message = error instanceof Error ? error.message : String(error ?? "Location tracking failed");
  return {
    code: 2,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3
  } as GeolocationPositionError;
}

async function pollNativeWatcher(id: number) {
  const watcher = watchers.get(id);
  if (!watcher || watcher.usingFallback) return;

  const session = loadRunSession();
  if (!session || session.stage !== "active") {
    watchers.delete(id);
    void stopNativeRunningTracker().catch(() => {});
    return;
  }

  try {
    let snapshot = await getNativeRunningSnapshot(false);
    if (!snapshot.running || snapshot.sessionId !== session.id) {
      snapshot = await startNativeRunningTracker(session.id, snapshot.sessionId !== session.id);
    }

    if (snapshot.lastLocationAt > watcher.lastDeliveredAt) {
      const withPoints = await getNativeRunningSnapshot(true);
      const newPoints = (withPoints.points ?? [])
        .filter((point) => point.at > watcher.lastDeliveredAt)
        .sort((a, b) => a.at - b.at);

      for (const point of newPoints) {
        watcher.success(toPosition(point));
        watcher.lastDeliveredAt = Math.max(watcher.lastDeliveredAt, point.at);
      }
    }
  } catch (error) {
    watcher.error?.(toPositionError(error));
  }

  if (!watchers.has(id)) return;
  watcher.timer = window.setTimeout(() => void pollNativeWatcher(id), 1250);
}

export function startRunningNativeGeolocationBridge() {
  if (installed || Capacitor.getPlatform() !== "android" || !("geolocation" in navigator)) return;
  installed = true;

  const geolocation = navigator.geolocation;
  const originalWatchPosition = geolocation.watchPosition.bind(geolocation);
  const originalClearWatch = geolocation.clearWatch.bind(geolocation);

  geolocation.watchPosition = ((success, error, options) => {
    const session = loadRunSession();
    if (!session || session.stage !== "active") {
      return originalWatchPosition(success, error, options);
    }

    const id = nextWatchId++;
    const watcher: NativeWatcher = {
      success,
      error,
      lastDeliveredAt: latestStoredPointTime(),
      timer: null,
      usingFallback: false
    };
    watchers.set(id, watcher);

    void startNativeRunningTracker(session.id, false)
      .then(() => pollNativeWatcher(id))
      .catch((nativeError) => {
        if (!watchers.has(id)) return;
        watcher.usingFallback = true;
        watcher.error?.(toPositionError(nativeError));
        watcher.fallbackWatchId = originalWatchPosition(success, error, options);
      });

    return id;
  }) as Geolocation["watchPosition"];

  geolocation.clearWatch = ((id: number) => {
    const watcher = watchers.get(id);
    if (!watcher) {
      originalClearWatch(id);
      return;
    }

    watchers.delete(id);
    if (watcher.timer) window.clearTimeout(watcher.timer);
    if (watcher.fallbackWatchId !== undefined) originalClearWatch(watcher.fallbackWatchId);

    const session = loadRunSession();
    if (!session || session.stage !== "active") void stopNativeRunningTracker().catch(() => {});
  }) as Geolocation["clearWatch"];

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    for (const id of watchers.keys()) void pollNativeWatcher(id);
  });
}
