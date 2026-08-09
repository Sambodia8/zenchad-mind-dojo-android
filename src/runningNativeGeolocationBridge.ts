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
  browserWatchId: number;
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
  const coords: GeolocationCoordinates = {
    latitude: point.lat,
    longitude: point.lng,
    accuracy: point.accuracy,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON() {
      return {
        latitude: this.latitude,
        longitude: this.longitude,
        accuracy: this.accuracy,
        altitude: this.altitude,
        altitudeAccuracy: this.altitudeAccuracy,
        heading: this.heading,
        speed: this.speed
      };
    }
  };

  return {
    coords,
    timestamp: point.at,
    toJSON() {
      return { coords: coords.toJSON(), timestamp: point.at };
    }
  };
}

async function syncMissedNativePoints(id: number) {
  const watcher = watchers.get(id);
  if (!watcher) return;

  const session = loadRunSession();
  if (!session || session.stage !== "active") return;

  try {
    let snapshot = await getNativeRunningSnapshot(true);
    if (!snapshot.running || snapshot.sessionId !== session.id) {
      await startNativeRunningTracker(session.id, snapshot.sessionId !== session.id);
      snapshot = await getNativeRunningSnapshot(true);
    }

    const newPoints = (snapshot.points ?? [])
      .filter((point) => point.at > watcher.lastDeliveredAt)
      .sort((a, b) => a.at - b.at);

    for (const point of newPoints) {
      watcher.success(toPosition(point));
      watcher.lastDeliveredAt = Math.max(watcher.lastDeliveredAt, point.at);
    }
  } catch {
    // The browser GPS watcher remains active even if native background tracking is unavailable.
  }
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
      browserWatchId: -1
    };

    watcher.browserWatchId = originalWatchPosition(
      (position) => {
        watcher.lastDeliveredAt = Math.max(watcher.lastDeliveredAt, position.timestamp);
        success(position);
      },
      error,
      options
    );
    watchers.set(id, watcher);

    void startNativeRunningTracker(session.id, false)
      .then(() => syncMissedNativePoints(id))
      .catch(() => {
        // Foreground WebView geolocation still works as the fallback tracker.
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
    if (watcher.browserWatchId >= 0) originalClearWatch(watcher.browserWatchId);

    const session = loadRunSession();
    if (!session || session.stage !== "active") void stopNativeRunningTracker().catch(() => {});
  }) as Geolocation["clearWatch"];

  const syncVisibleWatchers = () => {
    if (document.visibilityState !== "visible") return;
    for (const id of watchers.keys()) void syncMissedNativePoints(id);
  };

  document.addEventListener("visibilitychange", syncVisibleWatchers);
  window.addEventListener("pageshow", syncVisibleWatchers);
}
