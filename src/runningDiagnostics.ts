import { Capacitor } from "@capacitor/core";
import { loadRunSession, loadRunningProfile } from "./running";
import { getNativeRunningSnapshot, type NativeRunningSnapshot } from "./runningNative";
import { getNativeStorySnapshot, usesNativeStoryDirector, type NativeStorySnapshot } from "./runningNativeStory";
import { getRunningHealthStatus, runningHealthNativeAvailable, type RunningHealthStatus } from "./runningHealth";
import { loadPlannedRunningRoute, loadRunningRouteBuildState } from "./runningRouteStore";

export interface RunningDiagnosticsSnapshot {
  generatedAt: string;
  platform: string;
  app: {
    hasSession: boolean;
    stage: string;
    mode: string;
    plannedMinutes: number | null;
    runPointCount: number;
    runDistanceMeters: number;
    lastPointAccuracyMeters: number | null;
    lastPointAgeSeconds: number | null;
    savedRuns: number;
  };
  nativeTracker: {
    available: boolean;
    running: boolean | null;
    sessionMatches: boolean | null;
    pointCount: number | null;
    distanceMeters: number | null;
    lastAccuracyMeters: number | null;
    lastLocationAgeSeconds: number | null;
    error?: string;
  };
  route: {
    status: string;
    message: string;
    ready: boolean;
    distanceMeters: number | null;
    estimatedMinutes: number | null;
    maneuverCount: number;
    shapePointCount: number;
    rerouteCount: number;
    semanticsStatus: string;
    storyAnchorCount: number;
    hasMission: boolean;
  };
  story: {
    native: boolean;
    enabled: boolean | null;
    phase: string;
    difficulty: string;
    chaseCount: number | null;
    activeChase: boolean | null;
    helicopterTriggered: boolean | null;
    effectsEnabled: boolean | null;
    effectsVolumePercent: number | null;
    voiceVolumePercent: number | null;
    sessionMatches: boolean | null;
    error?: string;
  };
  health: {
    availableOnBuild: boolean;
    supported: boolean | null;
    permissionGranted: boolean | null;
    error?: string;
  };
}

function ageSeconds(timestamp: number | undefined | null) {
  if (!timestamp || !Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.round((Date.now() - timestamp) / 1000));
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 180) : "Unavailable";
}

function nativeTrackerSummary(snapshot: NativeRunningSnapshot | null, sessionId: string | null, error?: string) {
  return {
    available: Capacitor.getPlatform() === "android",
    running: snapshot?.running ?? null,
    sessionMatches: snapshot && sessionId ? snapshot.sessionId === sessionId : null,
    pointCount: snapshot?.pointCount ?? null,
    distanceMeters: snapshot ? Math.round(snapshot.distanceMeters) : null,
    lastAccuracyMeters: snapshot && Number.isFinite(snapshot.lastAccuracy) ? Math.round(snapshot.lastAccuracy) : null,
    lastLocationAgeSeconds: ageSeconds(snapshot?.lastLocationAt),
    ...(error ? { error } : {})
  };
}

function storySummary(snapshot: NativeStorySnapshot | null, sessionId: string | null, error?: string) {
  return {
    native: usesNativeStoryDirector(),
    enabled: snapshot?.enabled ?? null,
    phase: snapshot?.phase ?? "unavailable",
    difficulty: snapshot?.difficulty ?? "unavailable",
    chaseCount: snapshot?.chaseCount ?? null,
    activeChase: snapshot?.activeChase ?? null,
    helicopterTriggered: snapshot?.helicopterTriggered ?? null,
    effectsEnabled: snapshot?.sfxEnabled ?? null,
    effectsVolumePercent: snapshot ? Math.round(snapshot.sfxVolume * 100) : null,
    voiceVolumePercent: snapshot ? Math.round(snapshot.voiceVolume * 100) : null,
    sessionMatches: snapshot && sessionId ? snapshot.sessionId === sessionId : null,
    ...(error ? { error } : {})
  };
}

function healthSummary(snapshot: RunningHealthStatus | null, error?: string) {
  return {
    availableOnBuild: runningHealthNativeAvailable(),
    supported: snapshot?.supported ?? null,
    permissionGranted: snapshot?.permissionGranted ?? null,
    ...(error ? { error } : {})
  };
}

export async function collectRunningDiagnostics(): Promise<RunningDiagnosticsSnapshot> {
  const session = loadRunSession();
  const profile = loadRunningProfile();
  const latestPoint = session?.points[session.points.length - 1];
  const route = session ? loadPlannedRunningRoute(session.id) : null;
  const routeState = session ? loadRunningRouteBuildState(session.id) : null;
  let nativeTracker: NativeRunningSnapshot | null = null;
  let trackerError: string | undefined;
  let nativeStory: NativeStorySnapshot | null = null;
  let storyError: string | undefined;
  let health: RunningHealthStatus | null = null;
  let healthError: string | undefined;

  if (Capacitor.getPlatform() === "android") {
    try {
      nativeTracker = await getNativeRunningSnapshot(false);
    } catch (error) {
      trackerError = safeError(error);
    }
  }
  if (usesNativeStoryDirector()) {
    try {
      nativeStory = await getNativeStorySnapshot();
    } catch (error) {
      storyError = safeError(error);
    }
  }
  if (runningHealthNativeAvailable()) {
    try {
      health = await getRunningHealthStatus();
    } catch (error) {
      healthError = safeError(error);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    platform: Capacitor.getPlatform(),
    app: {
      hasSession: Boolean(session),
      stage: session?.stage ?? "none",
      mode: session?.mode ?? "none",
      plannedMinutes: session?.plannedMinutes ?? null,
      runPointCount: session?.points.length ?? 0,
      runDistanceMeters: Math.round(session?.distanceMeters ?? 0),
      lastPointAccuracyMeters: latestPoint ? Math.round(latestPoint.accuracy) : null,
      lastPointAgeSeconds: ageSeconds(latestPoint?.at),
      savedRuns: profile.history.length
    },
    nativeTracker: nativeTrackerSummary(nativeTracker, session?.id ?? null, trackerError),
    route: {
      status: route ? "ready" : routeState?.status ?? "none",
      message: route ? "Route available" : (routeState?.message ?? "No route build has run"),
      ready: Boolean(route),
      distanceMeters: route ? Math.round(route.distanceMeters) : null,
      estimatedMinutes: route ? Math.round(route.estimatedMinutes) : null,
      maneuverCount: route?.maneuvers.length ?? 0,
      shapePointCount: route?.shape.length ?? 0,
      rerouteCount: route?.rerouteCount ?? 0,
      semanticsStatus: route?.semanticsStatus ?? "none",
      storyAnchorCount: route?.storyAnchors?.length ?? 0,
      hasMission: Boolean(route?.storyMission)
    },
    story: storySummary(nativeStory, session?.id ?? null, storyError),
    health: healthSummary(health, healthError)
  };
}

export function formatRunningDiagnostics(snapshot: RunningDiagnosticsSnapshot) {
  return [
    "ZENCHAD RUNNING DIAGNOSTICS",
    `Generated: ${snapshot.generatedAt}`,
    `Platform: ${snapshot.platform}`,
    "",
    `App: stage=${snapshot.app.stage}, mode=${snapshot.app.mode}, plan=${snapshot.app.plannedMinutes ?? "—"}m, points=${snapshot.app.runPointCount}, distance=${snapshot.app.runDistanceMeters}m, GPS=${snapshot.app.lastPointAccuracyMeters ?? "—"}m accuracy, last fix=${snapshot.app.lastPointAgeSeconds ?? "—"}s ago`,
    `Native tracker: available=${snapshot.nativeTracker.available}, running=${snapshot.nativeTracker.running}, sessionMatch=${snapshot.nativeTracker.sessionMatches}, points=${snapshot.nativeTracker.pointCount}, distance=${snapshot.nativeTracker.distanceMeters}m, GPS=${snapshot.nativeTracker.lastAccuracyMeters ?? "—"}m, last fix=${snapshot.nativeTracker.lastLocationAgeSeconds ?? "—"}s ago${snapshot.nativeTracker.error ? `, error=${snapshot.nativeTracker.error}` : ""}`,
    `Route: status=${snapshot.route.status}, ready=${snapshot.route.ready}, distance=${snapshot.route.distanceMeters ?? "—"}m, ETA=${snapshot.route.estimatedMinutes ?? "—"}m, maneuvers=${snapshot.route.maneuverCount}, shapePoints=${snapshot.route.shapePointCount}, reroutes=${snapshot.route.rerouteCount}, semantics=${snapshot.route.semanticsStatus}, anchors=${snapshot.route.storyAnchorCount}, mission=${snapshot.route.hasMission}`,
    `Route message: ${snapshot.route.message}`,
    `Story: native=${snapshot.story.native}, enabled=${snapshot.story.enabled}, phase=${snapshot.story.phase}, difficulty=${snapshot.story.difficulty}, chases=${snapshot.story.chaseCount}, activeChase=${snapshot.story.activeChase}, helicopter=${snapshot.story.helicopterTriggered}, sessionMatch=${snapshot.story.sessionMatches}, effects=${snapshot.story.effectsEnabled} @ ${snapshot.story.effectsVolumePercent ?? "—"}%, voice=${snapshot.story.voiceVolumePercent ?? "—"}%${snapshot.story.error ? `, error=${snapshot.story.error}` : ""}`,
    `Health: available=${snapshot.health.availableOnBuild}, supported=${snapshot.health.supported}, permission=${snapshot.health.permissionGranted}${snapshot.health.error ? `, error=${snapshot.health.error}` : ""}`,
    "",
    "Privacy: exact GPS coordinates and route geometry are intentionally omitted."
  ].join("\n");
}
