import {
  Activity,
  ArrowRight,
  BatteryCharging,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Coins,
  Dices,
  Footprints,
  Heart,
  Headphones,
  History,
  Image,
  Map,
  Medal,
  Navigation,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Trophy,
  UsersRound,
  Volume2,
  Zap
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction
} from "react";
import { App as CapacitorApp } from "@capacitor/app";
import {
  RUN_COMPANIONS,
  RUN_PREP_STEPS,
  adaptiveRunPlan,
  addRunningXp,
  calculateBestEfforts,
  calculateKilometreSplits,
  calculateMovingSeconds,
  calculateRunXp,
  checkpointRewardsForProgress,
  completeRunPrepStep,
  compactRunPoints,
  createRunSession,
  distanceZenPointRewardsForProgress,
  distanceMeters,
  firstRunOfDayZenPoints,
  formatRunClock,
  formatRunDistance,
  formatRunPace,
  levelForXp,
  loadRunSession,
  loadRunningProfile,
  personalBestKeysFor,
  prepStepInstruction,
  prepStepXp,
  restartRunPreparation,
  rollingPaceSecondsPerKm,
  routeNameFromRunPoints,
  saveRunSession,
  saveRunningProfile,
  skipRemainingRunPreparation,
  skipRunPrepStep,
  trimRouteForPrivacy,
  type RunBestEffort,
  type RunCompanionId,
  type RunMode,
  type RunPoint,
  type RunRecord,
  type RunSession,
  type RunningProfile
} from "../running";
import {
  RUN_PHOTO_PRIVACY_NOTE,
  deleteRunPhotoAppCopy,
  getRunPhotoPermission,
  getRunPhotoThumbnailDataUrl,
  listRunPhotos,
  moveRunPhotoAssociation,
  removeRunPhotoAssociation,
  requestRunPhotoAccess,
  updateRunPhotoMetadata,
  type RunPhoto,
  type RunPhotoPermission,
  type RunPhotoStatus
} from "../runningPhotos";
import { startActiveRunPhotoPolling } from "../runningPhotoRuntime";
import { syncRunningNativePoints } from "../runningNativeGeolocationBridge";
import { RunningVoiceSettings } from "../components/RunningVoiceSettings";
import RunPhotoGallery from "../components/RunPhotoGallery";
import { loadPlannedRunningRoute } from "../runningRouteStore";
import { roadNameForLocation } from "../runningNavigation";
import { cancelRunningReminder, isNativeAndroid, scheduleRunningReminder } from "../native";
import { startNativeRunningTracker } from "../runningNative";
import { playUiSfx } from "../uiSfx";
import { awardStrengthProgress } from "../progression";
import { awardZenPoints } from "../zenPoints";
import type { AppData, Route } from "../types";
import { STORY_CAMPAIGN, chooseStoryMission, runningCampaignState } from "../runningCampaign";
import {
  acknowledgeLegacyStoryPlayback,
  loadStoryRunResults,
  markStoryChapterHeard,
  storyMissionHeardChapters,
  storyResultPlaybackVerified
} from "../runningStoryResults";
import { STORY_CHAPTERS, storyChapterTranscript, type StoryChapterId } from "../runningStoryChapters";
import { speakStoryLine } from "../runningStorySpeech";
import { createCelebrationParticles } from "../celebrationParticles";

interface Props {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  navigate: Dispatch<SetStateAction<Route>>;
  startMode?: "just";
}

type RunningView =
  | "hub"
  | "just-choice"
  | "duration"
  | "briefing"
  | "prep"
  | "warmup"
  | "active"
  | "summary"
  | "history"
  | "story-archive"
  | "store"
  | "progress";

const DURATIONS = [20, 30, 45, 60];

const STORE_ITEMS = [
  { id: "runner-red", name: "Signal Red runner jacket", price: 350, note: "Cosmetic prototype" },
  { id: "route-fireworks", name: "Route-trace fireworks", price: 500, note: "Completion effect prototype" },
  { id: "night-runner", name: "Night Runner colourway", price: 650, note: "Cosmetic prototype" },
  { id: "radio-static", name: "Underground radio pack", price: 800, note: "Story audio cosmetic prototype" }
];

const initialViewFor = (session: RunSession | null): RunningView => {
  if (!session) return "hub";
  if (session.stage === "briefing") return "briefing";
  if (session.stage === "prep") return "prep";
  if (session.stage === "warmup") return "warmup";
  if (session.stage === "active") return "active";
  return "summary";
};

const runModeLabel = (mode: RunMode) =>
  mode === "story" ? "Story Run" : mode === "just" ? "Just Run" : "Quick Run";

async function settleWithin(task: Promise<unknown> | undefined, milliseconds: number) {
  if (!task) return;
  await Promise.race([
    task.catch(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
  ]);
}

function routeTrace(points: RunPoint[]) {
  if (points.length < 2) return null;
  const meanLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length * Math.PI / 180;
  const metres = points.map((point) => ({ x: point.lng * 111_320 * Math.cos(meanLat), y: point.lat * 110_540 }));
  const minX = Math.min(...metres.map((point) => point.x));
  const maxX = Math.max(...metres.map((point) => point.x));
  const minY = Math.min(...metres.map((point) => point.y));
  const maxY = Math.max(...metres.map((point) => point.y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const scale = Math.min(82 / width, 70 / height);
  const offsetX = 9 + (82 - width * scale) / 2;
  const offsetY = 10 + (70 - height * scale) / 2;
  const projected = metres.map((point) => ({ x: offsetX + (point.x - minX) * scale, y: 80 - offsetY - (point.y - minY) * scale + 10 }));
  const rawScale = 20 / scale;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, rawScale)));
  const scaleMeters = [5, 2, 1].map((value) => value * magnitude).find((value) => value <= rawScale) ?? magnitude;
  const chevrons = [1 / 3, 2 / 3].flatMap((fraction) => {
    const index = Math.max(1, Math.min(projected.length - 1, Math.round((projected.length - 1) * fraction)));
    const before = projected[index - 1];
    const at = projected[index];
    const angle = Math.atan2(at.y - before.y, at.x - before.x) * 180 / Math.PI;
    return [{ ...at, angle }];
  });
  return {
    points: projected.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "),
    start: projected[0],
    end: projected.at(-1) as { x: number; y: number },
    chevrons,
    scaleWidth: scaleMeters * scale,
    scaleLabel: scaleMeters >= 1000 ? `${scaleMeters / 1000} km` : `${Math.round(scaleMeters)} m`
  };
}

function recordPace(record: RunRecord) {
  return formatRunPace(record.averagePaceSecondsPerKm);
}

function runPhotoPermissionStatus(permission: RunPhotoPermission): RunPhotoStatus {
  if (permission === "full") return "ready";
  if (permission === "limited") return "limited";
  if (permission === "denied") return "permission-denied";
  if (permission === "prompt") return "permission-required";
  return "unavailable";
}

function runPhotoLabel(photo: RunPhoto) {
  const caption = photo.caption?.trim();
  if (caption) return caption;
  return `Photo · ${new Date(photo.capturedAt).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function RouteTrace({ points, label, compact = false }: { points: RunPoint[]; label: string; compact?: boolean }) {
  const trace = routeTrace(points);
  return (
    <figure className={`running-route-trace ${compact ? "compact" : ""}`}>
      <figcaption><strong>Recorded route</strong><small>GPS path only — it does not chart time or pace. Pauses add no line; retraced roads overlap.</small></figcaption>
      {trace ? (
        <svg viewBox="0 0 100 100" role="img" aria-label={`${label}. Geographic proportions are preserved. North is up; arrows show direction; start and finish are marked.`}>
          <text className="running-trace-north" x="92" y="10">N</text>
          <polyline points={trace.points} />
          {trace.chevrons.map((chevron, index) => <path className="running-trace-chevron" key={index} d="M -2 -2 L 2 0 L -2 2" transform={`translate(${chevron.x.toFixed(1)} ${chevron.y.toFixed(1)}) rotate(${chevron.angle.toFixed(1)})`} />)}
          <circle className="running-route-start" cx={trace.start.x} cy={trace.start.y} r="3" />
          <text className="running-trace-label" x={trace.start.x + 3.5} y={trace.start.y - 3.5}>START</text>
          <circle className="running-route-end" cx={trace.end.x} cy={trace.end.y} r="3" />
          <text className="running-trace-label" x={trace.end.x + 3.5} y={trace.end.y - 3.5}>FINISH</text>
          <path className="running-trace-scale" d={`M 8 93 h ${trace.scaleWidth.toFixed(1)} M 8 90 v 6 M ${(8 + trace.scaleWidth).toFixed(1)} 90 v 6`} />
          <text className="running-trace-scale-label" x={8 + trace.scaleWidth / 2} y="89" textAnchor="middle">{trace.scaleLabel}</text>
        </svg>
      ) : (
        <div><Map /><span>Route trace appears once GPS has enough points.</span></div>
      )}
    </figure>
  );
}

function BestEffortList({ efforts, personalBestKeys }: { efforts: RunBestEffort[]; personalBestKeys: string[] }) {
  if (!efforts.length) return null;
  return (
    <section className="running-insight-section">
      <div className="section-heading"><div><span className="eyebrow">Positive comparisons only</span><h2>Best efforts</h2></div><Medal /></div>
      <div className="running-effort-list">
        {efforts.map((effort) => {
          const personalBest = personalBestKeys.includes(effort.key);
          return (
            <article className={`running-effort-row ${personalBest ? "personal-best" : ""}`} key={effort.key}>
              <span className="running-effort-medal"><Medal /></span>
              <span><strong>{effort.label}</strong><small>{formatRunClock(effort.durationSeconds)} · {formatRunPace(effort.paceSecondsPerKm)}</small></span>
              <b>{personalBest ? "NEW BEST" : "BANKED"}</b>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RunCompanionSummary({ companionIds }: { companionIds: RunCompanionId[] }) {
  const tags = RUN_COMPANIONS
    .filter((companion) => companionIds.includes(companion.id))
    .map((companion) => companion.tag);
  return (
    <div className="running-companion-summary">
      <UsersRound />
      <span>{tags.length ? `With ${tags.join(" · ")}` : "No companions tagged"}</span>
    </div>
  );
}

function RunCompanionPicker({
  companionIds,
  onChange,
  compact = false
}: {
  companionIds: RunCompanionId[];
  onChange: (companionIds: RunCompanionId[]) => void;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(!compact);
  const selectedIds = new Set(companionIds);
  const selectedTags = RUN_COMPANIONS
    .filter((companion) => selectedIds.has(companion.id))
    .map((companion) => companion.tag);
  const toggle = (companionId: RunCompanionId) => {
    onChange(
      selectedIds.has(companionId)
        ? companionIds.filter((id) => id !== companionId)
        : RUN_COMPANIONS.filter((companion) => selectedIds.has(companion.id) || companion.id === companionId).map((companion) => companion.id)
    );
  };
  return (
    <section className={`running-companion-picker ${compact ? "compact collapsible" : ""} ${expanded ? "expanded" : "collapsed"}`.trim()}>
      {compact ? <button type="button" className="running-companion-heading running-companion-toggle" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
        <span>
          <strong>Running with</strong>
          <small>{selectedTags.length ? selectedTags.join(" · ") : "Optional · tap to add companions"}</small>
        </span>
        <span className="running-companion-toggle-icons"><UsersRound /><ChevronDown /></span>
      </button> : <div className="running-companion-heading">
        <span><strong>Running with</strong><small>Optional · tap everyone who joined you</small></span>
        <UsersRound />
      </div>}
      {(!compact || expanded) ? <div className="running-companion-options" role="group" aria-label="Tag companions on this run">
        {RUN_COMPANIONS.map((companion) => (
          <button
            type="button"
            className={selectedIds.has(companion.id) ? "selected" : ""}
            aria-pressed={selectedIds.has(companion.id)}
            aria-label={`${companion.tag}, ${companion.name}, ${companion.detail}`}
            key={companion.id}
            onClick={() => toggle(companion.id)}
          >
            <strong>{companion.tag}</strong>
            <small>{companion.id === "rtr" ? companion.name : companion.detail}</small>
          </button>
        ))}
      </div> : null}
    </section>
  );
}

function RunNameEditor({ record, onSave }: { record: RunRecord; onSave: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(record.routeName);
  useEffect(() => setName(record.routeName), [record.routeName]);
  if (!editing) {
    return <div className="running-name-display"><h2>{record.routeName}</h2><button type="button" onClick={() => setEditing(true)} aria-label={`Edit run name ${record.routeName}`}>Edit name</button></div>;
  }
  return (
    <div className="running-name-editor">
      <label>Run name<input autoFocus value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /></label>
      <div><button type="button" onClick={() => { const clean = name.trim().slice(0, 80); if (clean) onSave(clean); setEditing(false); }}>Save name</button><button type="button" onClick={() => { setName(record.routeName); setEditing(false); }}>Cancel</button></div>
    </div>
  );
}

function RunPhotoThumbnail({ photo, runId, onOpen }: { photo: RunPhoto; runId: string; onOpen?: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!photo.hasAppCopy) {
      setDataUrl(null);
      return;
    }
    void getRunPhotoThumbnailDataUrl(runId, photo.id).then((next) => {
      if (!cancelled) setDataUrl(next);
    });
    return () => { cancelled = true; };
  }, [photo.hasAppCopy, photo.id, runId]);

  if (dataUrl) return onOpen
    ? <button type="button" className="running-photo-thumbnail-button" onClick={onOpen} aria-label={`Open ${runPhotoLabel(photo)}`}><img src={dataUrl} alt="" /></button>
    : <img src={dataUrl} alt={runPhotoLabel(photo)} />;
  return <><Image /><span>{photo.sourceAvailable ? "Photo unavailable" : "Original deleted"}</span></>;
}

function RunPhotoEditor({
  photo,
  runId,
  history,
  onChanged,
  onRemove,
  onDeleteCopy,
  onOpen
}: {
  photo: RunPhoto;
  runId: string;
  history: RunRecord[];
  onChanged: (runIds: string[]) => Promise<void>;
  onRemove: () => Promise<void>;
  onDeleteCopy: () => Promise<void>;
  onOpen: () => void;
}) {
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [targetRunId, setTargetRunId] = useState("");
  const [busy, setBusy] = useState(false);
  const targets = history.filter((record) => record.id !== runId);

  useEffect(() => setCaption(photo.caption ?? ""), [photo.caption, photo.id]);

  const saveCaption = async () => {
    setBusy(true);
    await updateRunPhotoMetadata(runId, [{ id: photo.id, caption: caption.trim() || null }]);
    await onChanged([runId]);
    setBusy(false);
  };

  const movePhoto = async () => {
    if (!targetRunId) return;
    setBusy(true);
    const result = await moveRunPhotoAssociation(runId, targetRunId, photo.id);
    if (result.moved) await onChanged([runId, targetRunId]);
    setBusy(false);
  };

  return (
    <div className="running-photo-editor">
      <div className="running-photo-main">
        <RunPhotoThumbnail photo={photo} runId={runId} onOpen={onOpen} />
        <div><strong>{runPhotoLabel(photo)}</strong><small>{photo.sourceAvailable ? "Original remains in your camera library" : "Original deleted; ZenChad's thumbnail is independent"}</small></div>
      </div>
      <label>Optional caption<input value={caption} maxLength={80} onChange={(event) => setCaption(event.target.value)} placeholder="Add a friendly name" /></label>
      <button type="button" className="button secondary" disabled={busy || caption.trim() === (photo.caption ?? "").trim()} onClick={() => void saveCaption()}>Save caption</button>
      {targets.length ? <div className="running-photo-move"><label>Move to another completed run<select value={targetRunId} onChange={(event) => setTargetRunId(event.target.value)}><option value="">Choose a run</option>{targets.map((record) => <option value={record.id} key={record.id}>{record.routeName} · {new Date(record.startedAt).toLocaleDateString()}</option>)}</select></label><button type="button" className="button secondary" disabled={busy || !targetRunId} onClick={() => void movePhoto()}>Move photo</button></div> : null}
      <div className="running-photo-actions">
        <button type="button" onClick={() => void onRemove()} disabled={busy}>Remove from this run</button>
        {photo.hasAppCopy ? <button type="button" onClick={() => void onDeleteCopy()} disabled={busy}>Delete ZenChad thumbnail</button> : null}
      </div>
      <small className="running-photo-delete-note">Removing the association also removes ZenChad's private thumbnail. Neither action deletes the original camera photo.</small>
    </div>
  );
}

export default function RunningModeScreen({ data, setData, navigate, startMode }: Props) {
  const restored = useRef<RunSession | null>(loadRunSession());
  const [session, setSession] = useState<RunSession | null>(restored.current);
  const [profile, setProfile] = useState<RunningProfile>(() => loadRunningProfile());
  const [view, setView] = useState<RunningView>(() => initialViewFor(restored.current));
  const [selectedMode, setSelectedMode] = useState<RunMode>("quick");
  const [selectedStoryMissionId, setSelectedStoryMissionId] = useState<string | null>(null);
  const [resumeSelectedStory, setResumeSelectedStory] = useState(true);
  const [storyRevision, setStoryRevision] = useState(0);
  const [storyReplayKey, setStoryReplayKey] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "routes" | "favorites">("all");
  const [now, setNow] = useState(Date.now());
  const [gpsStatus, setGpsStatus] = useState("GPS starts during the warm-up walk");
  const [photoPermission, setPhotoPermission] = useState<RunPhotoPermission>("unavailable");
  const [photoStatus, setPhotoStatus] = useState<RunPhotoStatus>("unavailable");
  const [runPhotos, setRunPhotos] = useState<Record<string, RunPhoto[]>>({});
  const [photoGallery, setPhotoGallery] = useState<{ runId: string; photos: RunPhoto[]; photoId: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [finishBanking, setFinishBanking] = useState(false);
  const [resumePrepChoice, setResumePrepChoice] = useState(
    Boolean(
      restored.current?.stage === "prep" &&
      Date.now() - restored.current.stepStartedAt > 10_000
    )
  );
  const lastAnnouncedKm = useRef(Math.floor((restored.current?.distanceMeters ?? 0) / 1000));
  const toastTimer = useRef<number | null>(null);
  const photoPoller = useRef<ReturnType<typeof startActiveRunPhotoPolling> | null>(null);
  const justRunStarted = useRef(false);
  const finishingRun = useRef(false);
  const processedDistanceRewardIds = useRef(new Set(Object.keys(restored.current?.distanceZenPointAwards ?? {})));

  const setSavedSession = (next: RunSession | null) => {
    saveRunSession(next);
    setSession(next);
  };

  const setSavedProfile = (next: RunningProfile) => {
    saveRunningProfile(next);
    setProfile(next);
  };

  const showToast = (message: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(null), 1700);
  };

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    []
  );

  useEffect(() => {
    void getRunPhotoPermission().then((permission) => setPhotoPermission(permission));
  }, []);

  const loadPhotosForRun = async (runId: string) => {
    const photos = await listRunPhotos(runId);
    setRunPhotos((current) => ({ ...current, [runId]: photos }));
  };

  useEffect(() => {
    if (view !== "history" && view !== "summary") return;
    const ids = profile.history.map((record) => record.id);
    void Promise.all(ids.map((id) => loadPhotosForRun(id)));
  }, [profile.history, view]);

  useEffect(() => {
    if (session?.stage !== "active" || session.mode === "just" || !session.runStartedAt) return;
    let active = true;
    void getRunPhotoPermission().then((permission) => {
      if (active) {
        setPhotoPermission(permission);
        setPhotoStatus(runPhotoPermissionStatus(permission));
      }
    });
    const poller = startActiveRunPhotoPolling({
      runId: session.id,
      runStartedAt: session.runStartedAt,
      getRunPoints: () => loadRunSession()?.points ?? [],
      onRefresh: (result) => {
        if (!active) return;
        setPhotoPermission(result.permission);
        setPhotoStatus(result.status);
        if (result.imported.length) void loadPhotosForRun(session.id);
      }
    });
    photoPoller.current = poller;
    return () => {
      active = false;
      poller.stop();
      if (photoPoller.current === poller) photoPoller.current = null;
    };
  }, [session?.id, session?.runStartedAt, session?.stage]);

  useEffect(() => {
    if (session?.stage !== "active") return;
    let disposed = false;
    let listener: Awaited<ReturnType<typeof CapacitorApp.addListener>> | null = null;
    void CapacitorApp.addListener("appStateChange", async ({ isActive }) => {
      if (!isActive || disposed) return;
      // The camera may suspend WebView polling. Import only after the native tracker
      // has delivered its missed points so capture-time matching uses the best fix.
      await syncRunningNativePoints();
      if (!disposed) await photoPoller.current?.refresh();
    }).then((handle) => { listener = handle; });
    return () => {
      disposed = true;
      void listener?.remove();
    };
  }, [session?.mode, session?.stage]);

  useEffect(() => {
    document.documentElement.classList.add("running-screen-mode");
    const focus = Boolean(session && ["prep", "warmup", "active"].includes(session.stage));
    document.documentElement.classList.toggle("running-focus-mode", focus);
    document.documentElement.classList.toggle("running-live-mode", session?.stage === "active");
    return () => {
      document.documentElement.classList.remove("running-screen-mode");
      document.documentElement.classList.remove("running-focus-mode");
      document.documentElement.classList.remove("running-live-mode");
    };
  }, [session?.stage]);

  useEffect(() => {
    if (session?.stage !== "active") return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [session?.stage]);

  useEffect(() => {
    if (!session || !["warmup", "active"].includes(session.stage)) return;
    if (!("geolocation" in navigator)) {
      setGpsStatus("GPS is not available on this device");
      return;
    }

    setGpsStatus("Finding GPS…");
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const rawPoint: RunPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          at: position.timestamp || Date.now(),
          heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null
        };

        setSession((current) => {
          if (!current || !["warmup", "active"].includes(current.stage)) return current;
          if (rawPoint.accuracy > 80) {
            setGpsStatus(`GPS weak · ±${Math.round(rawPoint.accuracy)} m`);
            return current;
          }

          // Warm-up GPS is only used to get a reliable lock. It is never retained,
          // counted, or carried into pace, splits, the saved route, or rewards.
          if (current.stage === "warmup") {
            setGpsStatus(`GPS warm-up locked · ±${Math.round(rawPoint.accuracy)} m`);
            return current;
          }

          const previous = current.points[current.points.length - 1];
          let extraDistance = 0;
          if (previous) {
            const segment = distanceMeters(previous, rawPoint);
            const elapsed = (rawPoint.at - previous.at) / 1000;
            const noiseFloor = Math.max(3, Math.min(18, rawPoint.accuracy * 0.35));
            const plausible = elapsed > 0 && segment >= noiseFloor && segment <= 120 && segment / elapsed <= 8;
            if (plausible) extraDistance = segment;
          }

          const shouldAppend = !previous || extraDistance > 0 || rawPoint.at - previous.at >= 10_000;
          if (!shouldAppend) return current;

          const nextDistance = current.distanceMeters + extraDistance;
          const activeRoute = loadPlannedRunningRoute(current.id);
          const point: RunPoint = {
            ...rawPoint,
            distanceFromStart: nextDistance,
            roadName: activeRoute ? roadNameForLocation(activeRoute, rawPoint) : undefined
          };
          const next: RunSession = {
            ...current,
            points: [...current.points, point].slice(-4000),
            distanceMeters: nextDistance
          };
          saveRunSession(next);
          setGpsStatus(`GPS tracking run · ±${Math.round(rawPoint.accuracy)} m`);
          return next;
        });
      },
      (error) => {
        setGpsStatus(
          error.code === error.PERMISSION_DENIED
            ? "Location permission is needed to track the run"
            : "Waiting for a usable GPS fix"
        );
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [session?.id, session?.stage]);

  useEffect(() => {
    if (session?.stage !== "active") return;
    const kilometres = Math.floor(session.distanceMeters / 1000);
    if (kilometres <= lastAnnouncedKm.current) return;
    lastAnnouncedKm.current = kilometres;
    navigator.vibrate?.([35, 35, 80]);
    showToast(`${kilometres} KM BANKED · NICE`);
  }, [session?.distanceMeters, session?.stage]);

  const elapsedRunSeconds = session?.runStartedAt
    ? Math.max(0, Math.floor(((session.runEndedAt ?? now) - session.runStartedAt) / 1000))
    : 0;
  const averagePace = session && session.distanceMeters >= 100
    ? elapsedRunSeconds / (session.distanceMeters / 1000)
    : null;
  const recentPace = session?.stage === "active" ? rollingPaceSecondsPerKm(session.points, now) : null;
  const plannedSeconds = (session?.plannedMinutes ?? 1) * 60;
  const completionRatio = plannedSeconds > 0 ? elapsedRunSeconds / plannedSeconds : 0;
  const currentPrep = session?.stage === "prep" ? RUN_PREP_STEPS[session.prepStepIndex] : null;
  const prepElapsed = session ? Math.max(0, (now - session.stepStartedAt) / 1000) : 0;

  useEffect(() => {
    if (session?.stage !== "active") return;
    const rewards = checkpointRewardsForProgress(completionRatio, session.checkpointAwards);
    if (!rewards.length) return;
    const pace = rollingPaceSecondsPerKm(session.points, now);
    rewards.forEach((reward) => {
      setSession((current) => {
        if (!current || current.stage !== "active" || current.checkpointAwards[reward.id]) return current;
        const next = {
          ...current,
          checkpointAwards: { ...current.checkpointAwards, [reward.id]: reward },
          checkpointXp: current.checkpointXp + reward.xp,
          checkpointZenPoints: current.checkpointZenPoints + reward.zenPoints,
          checkpointDice: current.checkpointDice + reward.dice
        };
        saveRunSession(next);
        return next;
      });
      setProfile((current) => {
        const next = { ...current, dice: current.dice + reward.dice };
        saveRunningProfile(next);
        return next;
      });
      setData((current) => awardZenPoints({ ...current, stats: addRunningXp(current.stats, reward.xp) }, reward.zenPoints));
      navigator.vibrate?.([28, 30, 62]);
      if (data.preferences.uiSoundsEnabled) playUiSfx("reward", { overlap: true });
    });
    const latest = rewards[rewards.length - 1];
    showToast(`${latest.label} CHECKPOINT · +${latest.xp} XP${latest.dice ? " · 🎲 +1" : ""} · ${formatRunClock(elapsedRunSeconds)} · ${formatRunPace(pace)}`);
  }, [completionRatio, data.preferences.uiSoundsEnabled, elapsedRunSeconds, now, session?.checkpointAwards, session?.stage, session?.points]);

  useEffect(() => {
    if (session?.stage !== "active") return;
    const rewards = distanceZenPointRewardsForProgress(session.distanceMeters, session.distanceZenPointAwards)
      .filter((reward) => !processedDistanceRewardIds.current.has(reward.id));
    if (!rewards.length) return;
    rewards.forEach((reward) => processedDistanceRewardIds.current.add(reward.id));
    const amount = rewards.reduce((sum, reward) => sum + reward.zenPoints, 0);
    setSession((current) => {
      if (!current || current.stage !== "active") return current;
      const fresh = rewards.filter((reward) => !current.distanceZenPointAwards[reward.id]);
      if (!fresh.length) return current;
      const next = {
        ...current,
        distanceZenPointAwards: {
          ...current.distanceZenPointAwards,
          ...Object.fromEntries(fresh.map((reward) => [reward.id, reward]))
        },
        distanceZenPoints: current.distanceZenPoints + fresh.reduce((sum, reward) => sum + reward.zenPoints, 0)
      };
      saveRunSession(next);
      return next;
    });
    setData((current) => awardZenPoints(current, amount));
    navigator.vibrate?.([42, 34, 42, 34, 125, 45]);
    if (data.preferences.uiSoundsEnabled) playUiSfx("reward", { overlap: true });
    const latest = rewards[rewards.length - 1];
    showToast(`ZEN POINT! · ${latest.id} · +${amount} ZP`);
  }, [data.preferences.uiSoundsEnabled, session?.distanceMeters, session?.distanceZenPointAwards, session?.stage, setData]);

  useEffect(() => {
    if (session?.stage !== "complete") return;
    navigator.vibrate?.([45, 35, 90, 45, 140]);
  }, [session?.stage]);

  useEffect(() => {
    if (!currentPrep?.speedBonus) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [currentPrep?.id, currentPrep?.speedBonus]);

  const chooseMode = (mode: RunMode) => {
    setSelectedMode(mode);
    if (mode === "story") {
      setSelectedStoryMissionId(null);
      setResumeSelectedStory(true);
    }
    setView("duration");
  };

  const chooseDuration = (minutes: number) => {
    void cancelRunningReminder();
    const next = createRunSession(selectedMode, minutes, Date.now(), data.stats.xp, data.stats.level);
    if (selectedMode === "story") {
      const mission = chooseStoryMission(next.id, selectedStoryMissionId);
      next.storyMissionId = mission.id;
      next.storyHeardChapterIds = resumeSelectedStory ? storyMissionHeardChapters(mission.id) : [];
    }
    processedDistanceRewardIds.current.clear();
    setSavedSession(next);
    setView("briefing");
  };

  const startJustRun = () => {
    const startedAt = Date.now();
    const next: RunSession = {
      ...createRunSession("just", 30, startedAt, data.stats.xp, data.stats.level),
      stage: "active",
      stepStartedAt: startedAt,
      runStartedAt: startedAt
    };
    setSelectedMode("just");
    lastAnnouncedKm.current = 0;
    processedDistanceRewardIds.current.clear();
    setSavedSession(next);
    void scheduleRunningReminder(startedAt, next.plannedMinutes).then((result) => {
      if (!result.ok) showToast(result.reason ?? "Run reminder is off; you can still finish normally.");
    });
    setNow(startedAt);
    setConfirmEnd(false);
    navigator.vibrate?.([32, 28, 78]);
    if (data.preferences.uiSoundsEnabled) playUiSfx("confirm");
    setView("active");
  };

  useEffect(() => {
    if (startMode !== "just" || justRunStarted.current) return;
    justRunStarted.current = true;
    startJustRun();
  }, [startMode]);

  const chooseJustRunStretches = () => {
    navigate({
      name: "yoga-class",
      classId: "before-run",
      autoStart: true
    });
  };

  const beginPrep = () => {
    if (!session) return;
    const next: RunSession = { ...session, stage: "prep", prepStepIndex: 0, stepStartedAt: Date.now() };
    setSavedSession(next);
    setNow(Date.now());
    setResumePrepChoice(false);
    setView("prep");
  };

  const openBeforeRunningRoutine = () => {
    navigate({
      name: "yoga-class",
      classId: "before-run",
      returnToRunningPreparation: true,
      autoStart: true
    });
  };

  const continuePreviousPreparation = () => {
    setResumePrepChoice(false);
    const current = loadRunSession();
    const step = current?.stage === "prep" ? RUN_PREP_STEPS[current.prepStepIndex] : null;
    if (step?.id === "stretches") openBeforeRunningRoutine();
  };

  const startNewPreparation = () => {
    const current = loadRunSession();
    if (!current || current.stage !== "prep") return;
    const next = restartRunPreparation(current);
    setSavedSession(next);
    setNow(Date.now());
    setResumePrepChoice(false);
    showToast("NEW PREP · STEP 1");
  };

  const completePrepStep = async () => {
    const current = loadRunSession();
    if (!current || current.stage !== "prep") return;
    const step = RUN_PREP_STEPS[current.prepStepIndex];
    if (!step || current.prepAwards[step.id] !== undefined) return;

    if (step.id === "stretches") {
      openBeforeRunningRoutine();
      return;
    }

    const isLast = current.prepStepIndex === RUN_PREP_STEPS.length - 1;
    const completion = completeRunPrepStep(current);
    if (!completion) return;
    const { next, xp, startBonus } = completion;

    setData((currentData) => ({ ...currentData, stats: addRunningXp(currentData.stats, xp + startBonus) }));
    navigator.vibrate?.(isLast ? [32, 28, 78, 36, 120] : [28, 32, 65, 35, 90]);
    if (data.preferences.uiSoundsEnabled) playUiSfx(isLast ? "victory" : "xpGain");
    lastAnnouncedKm.current = 0;
    setSavedSession(next);
    setNow(Date.now());
    showToast(isLast ? `WARM-UP WALK · +${xp + startBonus} XP` : `+${xp} XP`);
    if (isLast) setView("warmup");
    else if (RUN_PREP_STEPS[next.prepStepIndex]?.id === "stretches") openBeforeRunningRoutine();
  };

  const skipPrepStep = () => {
    const current = loadRunSession();
    if (!current || current.stage !== "prep") return;
    const skipped = skipRunPrepStep(current);
    if (!skipped) return;
    setSavedSession(skipped.next);
    setNow(Date.now());
    showToast(`${skipped.step.title.toUpperCase()} · SKIPPED`);
    if (skipped.isLast) setView("warmup");
  };

  const skipAllPrep = () => {
    const current = loadRunSession();
    if (!current || current.stage !== "prep") return;
    const next = skipRemainingRunPreparation(current);
    if (!next) return;
    setSavedSession(next);
    setNow(Date.now());
    showToast("PREPARATION SKIPPED · GPS WARM-UP READY");
    setView("warmup");
  };

  const startActualRun = async () => {
    const current = loadRunSession();
    if (!current || current.stage !== "warmup") return;
    if (isNativeAndroid()) {
      // The native foreground tracker also records the warm-up GPS lock. Reset it
      // before the measured run starts so finish banking cannot re-import warm-up
      // distance or points into the completed run.
      await startNativeRunningTracker(current.id, true).catch(() => {});
    }
    const startedAt = Date.now();
    // Deliberately reset the measured run: the walk was only a GPS lock check.
    const next: RunSession = {
      ...current,
      stage: "active",
      runStartedAt: startedAt,
      runEndedAt: null,
      distanceMeters: 0,
      points: []
    };
    lastAnnouncedKm.current = 0;
    setSavedSession(next);
    void scheduleRunningReminder(startedAt, next.plannedMinutes).then((result) => {
      if (!result.ok) showToast(result.reason ?? "Run reminder is off; you can still finish normally.");
    });
    setNow(startedAt);
    navigator.vibrate?.([32, 28, 78]);
    if (data.preferences.uiSoundsEnabled) playUiSfx("confirm");
    showToast("RUN STARTED · GPS DISTANCE NOW COUNTS");
    setView("active");
  };

  const finishRun = async () => {
    if (finishingRun.current) return;
    const current = loadRunSession();
    if (!current?.runStartedAt || current.stage !== "active") return;
    finishingRun.current = true;
    setFinishBanking(true);
    void cancelRunningReminder();
    try {
      if (current.mode !== "just") {
        await settleWithin(photoPoller.current?.refresh(), 1200);
        photoPoller.current?.stop();
      }
      const endedAt = Date.now();
      const durationSeconds = Math.max(1, Math.floor((endedAt - current.runStartedAt) / 1000));
      const distance = Math.max(0, Number.isFinite(current.distanceMeters) ? current.distanceMeters : 0);
      const points = Array.isArray(current.points) ? current.points : [];
      const finishXp = calculateRunXp(durationSeconds, distance, current.plannedMinutes);
      const runXp = current.checkpointXp + finishXp;
      const ratio = durationSeconds / Math.max(60, current.plannedMinutes * 60);
      const pace = distance >= 100 ? durationSeconds / (distance / 1000) : null;
      const previousProfile = loadRunningProfile();
      const dailyZenPoints = firstRunOfDayZenPoints(previousProfile.history, endedAt);
      const splits = calculateKilometreSplits(points);
      const bestEfforts = calculateBestEfforts(points);
      const personalBestKeys = personalBestKeysFor(bestEfforts, previousProfile.history.filter((item) => item.id !== current.id));
      const namedRoute = routeNameFromRunPoints(points);
      const totalZenPoints = current.checkpointZenPoints + current.distanceZenPoints + dailyZenPoints;
      const completionLevelAfter = levelForXp(Math.max(data.stats.xp, current.playerXpAtStart) + finishXp);
      const record: RunRecord = {
        id: current.id,
        mode: current.mode,
        plannedMinutes: current.plannedMinutes,
        startedAt: current.runStartedAt,
        endedAt,
        durationSeconds,
        movingSeconds: calculateMovingSeconds(points),
        distanceMeters: distance,
        averagePaceSecondsPerKm: pace,
        completionRatio: ratio,
        xp: current.prepXp + runXp,
        checkpointXp: current.checkpointXp,
        zenPoints: totalZenPoints,
        dice: current.checkpointDice,
        points: compactRunPoints(points),
        splits,
        bestEfforts,
        personalBestKeys,
        companionIds: current.companionIds,
        isFavorite: false,
        routeName: current.mode === "just" && !namedRoute.roadNames.length ? "Just Run" : namedRoute.routeName,
        routeRoadNames: namedRoute.roadNames,
        routeNameSource: "generated"
      };
      const nextSession: RunSession = {
        ...current,
        stage: "complete",
        runEndedAt: endedAt,
        runXp,
        firstRunOfDayZenPoints: dailyZenPoints,
        completionLevelBefore: current.playerLevelAtStart,
        completionLevelAfter
      };
      const nextProfile: RunningProfile = {
        ...previousProfile,
        credits: previousProfile.credits + current.prepXp + runXp,
        history: [record, ...previousProfile.history.filter((item) => item.id !== record.id)].slice(0, 100)
      };

      setData((currentData) => awardZenPoints({
        ...currentData,
        stats: addRunningXp(currentData.stats, finishXp),
        progression: awardStrengthProgress(currentData.progression, durationSeconds)
      }, dailyZenPoints));
      setSavedProfile(nextProfile);
      setSavedSession(nextSession);
      setNow(endedAt);
      setConfirmEnd(false);
      setView("summary");
    } finally {
      finishingRun.current = false;
      setFinishBanking(false);
    }
  };

  const resetRun = () => {
    void cancelRunningReminder();
    setSavedSession(null);
    setSelectedMode("quick");
    setConfirmEnd(false);
    setResumePrepChoice(false);
    setView("hub");
    setGpsStatus("GPS starts during the warm-up walk");
  };

  const buyStoreItem = (id: string, price: number) => {
    if (profile.unlockedStoreIds.includes(id) || profile.credits < price) return;
    setSavedProfile({
      ...profile,
      credits: profile.credits - price,
      unlockedStoreIds: [...profile.unlockedStoreIds, id]
    });
    showToast("UNLOCKED");
  };

  const toggleFavorite = (recordId: string) => {
    const next = {
      ...profile,
      history: profile.history.map((record) => record.id === recordId ? { ...record, isFavorite: !record.isFavorite } : record)
    };
    setSavedProfile(next);
  };

  const renameRun = (recordId: string, name: string) => {
    const clean = name.trim().slice(0, 80);
    if (!clean) return;
    setSavedProfile({
      ...profile,
      history: profile.history.map((record) => record.id === recordId
        ? { ...record, routeName: clean, routeNameSource: "user" }
        : record)
    });
  };

  const updateActiveRunCompanions = (companionIds: RunCompanionId[]) => {
    setSession((current) => {
      if (!current || current.stage !== "active") return current;
      const next = { ...current, companionIds };
      saveRunSession(next);
      return next;
    });
  };

  const updateRunCompanions = (recordId: string, companionIds: RunCompanionId[]) => {
    setProfile((current) => {
      const next = {
        ...current,
        history: current.history.map((record) => record.id === recordId ? { ...record, companionIds } : record)
      };
      saveRunningProfile(next);
      return next;
    });
  };

  const requestPhotoAccess = async () => {
    const result = await requestRunPhotoAccess();
    setPhotoPermission(result.permission);
    setPhotoStatus(runPhotoPermissionStatus(result.permission));
    showToast(result.permission === "full" ? "ALL PHOTOS ALLOWED · THIS DEVICE ONLY" : result.permission === "limited" ? "SELECTED PHOTOS ONLY · NEW CAMERA PHOTOS ARE NOT WATCHED" : result.message ?? "Run photo access is still off");
    if (result.permission === "full" || result.permission === "limited") await photoPoller.current?.refresh();
  };

  const removePhoto = async (runId: string, photoId: string) => {
    await removeRunPhotoAssociation(runId, photoId, true);
    await loadPhotosForRun(runId);
  };

  const reloadPhotoRuns = async (runIds: string[]) => {
    await Promise.all([...new Set(runIds)].map((runId) => loadPhotosForRun(runId)));
  };

  const deletePhotoCopy = async (runId: string, photoId: string) => {
    await deleteRunPhotoAppCopy(runId, photoId);
    await loadPhotosForRun(runId);
  };

  const totals = useMemo(() => {
    const history = profile.history;
    const bestMap = new globalThis.Map<string, RunBestEffort>();
    for (const run of history) {
      for (const effort of run.bestEfforts) {
        const currentBest = bestMap.get(effort.key);
        if (!currentBest || effort.durationSeconds < currentBest.durationSeconds) bestMap.set(effort.key, effort);
      }
    }
    return {
      runs: history.length,
      distance: history.reduce((sum, run) => sum + run.distanceMeters, 0),
      seconds: history.reduce((sum, run) => sum + run.durationSeconds, 0),
      xp: history.reduce((sum, run) => sum + run.xp, 0),
      storyRuns: history.filter((run) => run.mode === "story").length,
      bestEfforts: Array.from(bestMap.values())
    };
  }, [profile.history]);

  const adaptivePlan = useMemo(() => adaptiveRunPlan(profile.history, DURATIONS), [profile.history]);
  const storyResults = useMemo(() => loadStoryRunResults(), [storyRevision, profile.history]);
  const campaignState = useMemo(() => runningCampaignState(), [storyRevision, profile.history]);
  const celebrationParticles = useMemo(() => createCelebrationParticles(session?.id ?? "zenchad"), [session?.id]);

  const startStoryEpisode = (missionId: string) => {
    setSelectedMode("story");
    setSelectedStoryMissionId(missionId);
    setResumeSelectedStory(!storyResults.some((result) => result.missionId === missionId && storyResultPlaybackVerified(result)));
    setView("duration");
  };

  const confirmLegacyStoryProgress = () => {
    const updated = acknowledgeLegacyStoryPlayback();
    setStoryRevision((value) => value + 1);
    showToast(updated ? `${updated} LEGACY MISSION${updated === 1 ? "" : "S"} CONFIRMED` : "STORY PROGRESS ALREADY CHECKED");
  };

  const replayStoryChapter = async (missionId: string, chapterId: StoryChapterId) => {
    const mission = STORY_CAMPAIGN.find((candidate) => candidate.id === missionId);
    if (!mission || storyReplayKey) return;
    const key = `${missionId}:${chapterId}`;
    setStoryReplayKey(key);
    const played = await speakStoryLine(storyChapterTranscript(mission, chapterId));
    if (played) {
      markStoryChapterHeard(missionId, chapterId);
      setStoryRevision((value) => value + 1);
      showToast(`${STORY_CHAPTERS.find((chapter) => chapter.id === chapterId)?.title.toUpperCase()} HEARD`);
    } else {
      showToast("AUDIO COULD NOT PLAY · TRY AGAIN");
    }
    setStoryReplayKey(null);
  };

  const completedRecord = session ? profile.history.find((record) => record.id === session.id) ?? null : null;

  if (view === "hub") {
    return (
      <div className="screen-stack running-mode running-hub">
        <section className="running-hero">
          <span className="running-hero-icon"><Footprints /></span>
          <span className="eyebrow">Turn the outside world into the level</span>
          <h1>Running</h1>
          <p>Choose the kind of run. Zenchad handles the next decision one step at a time.</p>
        </section>

        {session ? (
          <button className="running-resume-card" onClick={() => setView(initialViewFor(session))}>
            <Zap />
            <span><strong>Resume current run</strong><small>{runModeLabel(session.mode)} · {session.mode === "just" ? "no route" : `${session.plannedMinutes} min`}</small></span>
            <ArrowRight />
          </button>
        ) : null}

        <div className="running-mode-grid">
          <button className="running-mode-card quick" onClick={() => chooseMode("quick")}>
            <Navigation /><span className="eyebrow">Less thinking</span><strong>Quick Run</strong><small>Pick a time. Get out. Let the route do the thinking.</small>
          </button>
          <button className="running-mode-card just" onClick={() => setView("just-choice")}>
            <Headphones /><span className="eyebrow">Music-friendly</span><strong>Just Run</strong><small>Tap once. GPS tracks distance, pace and your activity — with no route or directions.</small>
          </button>
          <button className="running-mode-card story" onClick={() => chooseMode("story")}>
            <Sparkles /><span className="eyebrow">Episode {campaignState.nextEpisode ?? STORY_CAMPAIGN.length} · The city is the level</span><strong>Story Run</strong><small>{campaignState.campaignComplete ? "Main campaign banked. Repeat episodes or take side jobs." : `${STORY_CAMPAIGN.find((mission) => mission.id === campaignState.nextMissionId)?.title ?? "Ghost Signal"} is ready. Chapters advance only after their audio is heard.`}</small>
          </button>
        </div>

        <div className="running-hub-links">
          <button onClick={() => setView("history")}><History /> Run history</button>
          <button onClick={() => setView("store")}><ShoppingBag /> Runner store</button>
          <button onClick={() => setView("progress")}><Trophy /> Progress</button>
          <button onClick={() => setView("story-archive")}><BookOpen /> Story archive</button>
        </div>

        <RunningVoiceSettings data={data} setData={setData} compact />

        <section className="card running-principle"><Sparkles /><div><strong>No shame engine</strong><p>Starting earns something. Progress earns more. Missing a target never deletes what you already earned.</p></div></section>
      </div>
    );
  }

  if (view === "story-archive") {
    const hasLegacyProgress = storyResults.some((result) => result.playbackVerified === undefined);
    const unlockedEpisode = campaignState.nextEpisode ?? STORY_CAMPAIGN.length;
    return (
      <div className="screen-stack running-mode running-story-archive">
        <button className="running-inline-back" onClick={() => setView("hub")}>← Running hub</button>
        <section className="page-intro"><span className="eyebrow">Runner Story</span><h1>Transmission archive</h1><p>Every episode has five chapters. A chapter is marked heard only when its narration actually reaches the end.</p></section>
        {hasLegacyProgress ? <section className="running-story-recovery"><Volume2 /><div><strong>Older story progress needs a quick check</strong><p>Earlier versions recorded mission events without confirming that the audio played. If you heard those runs, keep your place. Otherwise leave this alone and replay the missing chapters below.</p></div><button className="button secondary" onClick={confirmLegacyStoryProgress}>I heard these — keep my place</button></section> : null}
        <div className="running-story-episode-list">
          {STORY_CAMPAIGN.map((mission) => {
            const missionResults = storyResults.filter((result) => result.missionId === mission.id);
            const latest = missionResults[0] ?? null;
            const heard = storyMissionHeardChapters(mission.id, storyResults);
            const verified = missionResults.some((result) => storyResultPlaybackVerified(result));
            const locked = (mission.episode ?? 0) > unlockedEpisode;
            return <article className={`card running-story-episode ${verified ? "complete" : latest ? "recovering" : locked ? "locked" : "ready"}`} key={mission.id}>
              <div className="running-story-episode-heading"><span><small>EPISODE {mission.episode}</small><strong>{mission.title}</strong></span><b>{verified ? "STORY HEARD" : latest ? "PLAYBACK INCOMPLETE" : locked ? "LOCKED" : "READY"}</b></div>
              <p>{mission.objective}</p>
              <div className="running-story-archive-chapters">
                {STORY_CHAPTERS.map((chapter, index) => {
                  const isHeard = heard.includes(chapter.id);
                  const replayKey = `${mission.id}:${chapter.id}`;
                  return <button type="button" key={chapter.id} className={isHeard ? "heard" : "missing"} disabled={locked || !latest || storyReplayKey !== null} onClick={() => void replayStoryChapter(mission.id, chapter.id)}><span>{isHeard ? <Check /> : index + 1}</span><strong>{chapter.title}</strong><small>{storyReplayKey === replayKey ? "Playing…" : !latest ? "Plays during run" : isHeard ? "Heard · tap to replay" : "Tap to play"}</small></button>;
                })}
              </div>
              {!locked ? <button className="button primary full" onClick={() => startStoryEpisode(mission.id)}>{latest && !verified ? "Continue this episode" : verified ? "Run this episode again" : "Start this episode"} <ArrowRight /></button> : <small>Finish and hear the previous episode to unlock this one.</small>}
            </article>;
          })}
        </div>
        {toast ? <div className="running-toast">{toast}</div> : null}
      </div>
    );
  }

  if (view === "just-choice") {
    return (
      <div className="screen-stack running-mode running-just-choice">
        <button className="running-inline-back" onClick={() => setView("hub")}>← Running hub</button>
        <section className="running-prep-card">
          <span className="running-prep-icon"><Footprints /></span>
          <span className="eyebrow">Just Run</span>
          <h1>Do you want to stretch first?</h1>
          <p>A short Before Running warm-up is ready if you want it. You can also skip it and start your quiet, route-free run immediately.</p>
          <button className="button primary full" onClick={chooseJustRunStretches}>Yes — do the stretches <ArrowRight /></button>
          <button className="button secondary full" onClick={startJustRun}>No thanks — start Just Run</button>
        </section>
      </div>
    );
  }

  if (view === "duration") {
    return (
      <div className="screen-stack running-mode">
        <button className="running-inline-back" onClick={() => setView("hub")}>← Running hub</button>
        <section className="page-intro"><span className="eyebrow">{runModeLabel(selectedMode)}</span><h1>How long do you want to run?</h1><p>One decision. Zenchad adapts the suggestion from completed runs, never from a target you missed.</p></section>
        <section className="running-adaptive-plan"><Sparkles /><span><strong>{adaptivePlan.source === "history" ? `${adaptivePlan.recommendedMinutes} min looks sustainable today` : "Start with a friendly 20 min"}</strong><small>{adaptivePlan.expectedDistanceMeters ? `Based on your completed-run ability: roughly ${formatRunDistance(adaptivePlan.expectedDistanceMeters)} at your usual pace.` : "After a few completed runs, this will also estimate a comfortable distance."}</small></span></section>
        <div className="running-duration-grid">{DURATIONS.map((minutes) => <button className={minutes === adaptivePlan.recommendedMinutes ? "recommended" : ""} key={minutes} onClick={() => chooseDuration(minutes)}><strong>{minutes}</strong><span>{minutes === adaptivePlan.recommendedMinutes ? "minutes · suggested" : "minutes"}</span></button>)}</div>
      </div>
    );
  }

  if (view === "briefing" && session) {
    return (
      <div className="screen-stack running-mode">
        <button className="running-inline-back" onClick={resetRun}>← Change run</button>
        <section className="running-briefing">
          <Map /><span className="eyebrow">Route Director</span><h1>{session.plannedMinutes}-minute {runModeLabel(session.mode)}</h1>
          <p>{session.mode === "story" ? "Novelty-biased routing: interesting terrain and set-piece opportunities, usually bringing you back near home." : "Balanced routing: familiar enough to be easy, interesting enough not to be dull, usually bringing you back near home."}</p>
          <div className="running-route-note"><Navigation /><span><strong>Routing engine is the next native pass</strong><small>This foundation build tracks foreground GPS and the full run loop. Turn-by-turn route generation is not connected yet.</small></span></div>
          <button className="button primary full" onClick={beginPrep}>Start prep <ArrowRight /></button>
        </section>
      </div>
    );
  }

  if (view === "prep" && session && currentPrep) {
    const stepNumber = session.prepStepIndex + 1;
    const currentXp = prepStepXp(currentPrep, prepElapsed);
    const target = currentPrep.targetSeconds;
    const grace = currentPrep.graceSeconds;
    const inTarget = currentPrep.speedBonus && prepElapsed <= target;
    const inGrace = currentPrep.speedBonus && !inTarget && prepElapsed < target + grace;
    const remaining = inTarget ? Math.max(0, target - prepElapsed) : inGrace ? Math.max(0, target + grace - prepElapsed) : 0;

    if (resumePrepChoice) {
      return (
        <div className="screen-stack running-mode running-prep">
          <section className="running-prep-card" role="dialog" aria-labelledby="running-prep-resume-title">
            <span className="running-prep-icon"><RotateCcw /></span>
            <span className="eyebrow">Preparation already in progress</span>
            <h1 id="running-prep-resume-title">Continue your previous prep?</h1>
            <p>You were on step {stepNumber} of {RUN_PREP_STEPS.length}. Already earned XP stays banked whichever option you choose.</p>
            <button className="button primary full" onClick={continuePreviousPreparation}>Continue previous <ArrowRight /></button>
            <button className="button secondary full" onClick={startNewPreparation}>Start new — reset to step 1</button>
          </section>
        </div>
      );
    }

    return (
      <div className="screen-stack running-mode running-prep">
        <div className="running-progress-row"><span>PREP {stepNumber}/{RUN_PREP_STEPS.length}</span><strong>+{session.prepXp} XP banked</strong></div>
        <div className="running-progress-track"><span style={{ width: `${((stepNumber - 1) / RUN_PREP_STEPS.length) * 100}%` }} /></div>
        <section className="running-prep-card">
          <span className="running-prep-icon">{currentPrep.id === "phone" ? <BatteryCharging /> : currentPrep.id === "headphones" ? <Headphones /> : currentPrep.id === "outside" ? <Navigation /> : <Footprints />}</span>
          <span className="eyebrow">Next tiny action</span><h1>{currentPrep.title}</h1><p>{prepStepInstruction(currentPrep, now)}</p>
          {currentPrep.speedBonus ? (
            <div className="running-prep-timer"><Clock3 /><span><strong>{remaining > 0 ? formatRunClock(remaining) : "Base XP safe"}</strong><small>{inTarget ? "full momentum bonus" : inGrace ? "bonus gently draining" : "no failure — base XP remains"}</small></span><b>+{currentXp} XP</b></div>
          ) : (
            <div className="running-prep-timer calm"><Sparkles /><span><strong>No rush</strong><small>Warm up properly. There is deliberately no speed bonus.</small></span><b>+{currentXp} XP</b></div>
          )}
          <button className="button primary full" onClick={completePrepStep}>{currentPrep.id === "stretches" ? "Start Before Running with Mark" : currentPrep.buttonLabel} <ArrowRight /></button>
          <button className="button secondary full running-prep-skip" onClick={skipPrepStep}>Skip this step</button>
          <button className="button ghost full running-prep-skip-all" onClick={skipAllPrep}>Skip remaining preparation</button>
        </section>
        {toast ? <div className="running-toast">{toast}</div> : null}
      </div>
    );
  }

  if (view === "warmup" && session) {
    return (
      <div className="screen-stack running-mode running-warmup">
        <section className="running-warmup-card">
          <span className="running-prep-icon"><Footprints /></span>
          <span className="eyebrow">Warm-up walk</span>
          <h1>Walk easy for a moment.</h1>
          <p>GPS is waking up now. This walk is not saved, counted toward distance, used for pace, or rewarded. When you are ready, explicitly start the run.</p>
          <div className="running-warmup-gps"><Navigation /><span><strong>{gpsStatus}</strong><small>Only the run after the button below becomes your recorded route.</small></span></div>
          <button className="button primary full" onClick={startActualRun}>I’ve started running <ArrowRight /></button>
        </section>
        {toast ? <div className="running-toast">{toast}</div> : null}
      </div>
    );
  }

  if (view === "active" && session) {
    const justRun = session.mode === "just";
    const plannedProgress = Math.min(1, elapsedRunSeconds / plannedSeconds);
    const storyCopy = completionRatio < 0.2
      ? "COMMS ONLINE · Keep moving. The mission director is standing by."
      : completionRatio < 0.45
        ? "RUNNER CHANNEL · Route telemetry is clean."
        : completionRatio < 0.7
          ? "PURSUIT WINDOW · Adaptive chase events will plug into this stage."
          : "HOME STRETCH · Keep the line moving.";
    return (
      <div className="screen-stack running-mode running-active">
        <section className="running-live-hud">
          <div className="running-live-top"><span className="eyebrow">{runModeLabel(session.mode)}</span><span className={`running-gps ${gpsStatus.startsWith("GPS tracking") ? "locked" : ""}`}>{gpsStatus}</span></div>
          <div className="running-primary-stat"><strong>{formatRunDistance(session.distanceMeters)}</strong><span>{formatRunClock(elapsedRunSeconds)}</span></div>
          <div className="running-live-stats"><span><small>RECENT · 30s</small><b>{recentPace ? formatRunPace(recentPace) : "Paused / finding pace"}</b></span><span><small>AVG PACE</small><b>{formatRunPace(averagePace)}</b></span><span><small>{justRun ? "GUIDANCE" : "PLAN"}</small><b>{justRun ? "Off" : `${session.plannedMinutes} min`}</b></span><span><small>ZEN POINTS</small><b>+{session.distanceZenPoints} ZP</b></span></div>
          {justRun ? (
            <section className="running-just-run-note"><Headphones /><div><strong>GPS on. Directions off.</strong><small>Your distance, pace and route are being recorded. No planned route or turn-by-turn prompts.</small></div></section>
          ) : <div className="running-progress-track active"><span style={{ width: `${plannedProgress * 100}%` }} /></div>}
        </section>
        <div className="running-scroll-cue"><ChevronDown /> {justRun ? "Scroll for run controls" : session.mode === "story" ? "Scroll for story, route and finish" : "Scroll for route and finish"}</div>
        <RunCompanionPicker companionIds={session.companionIds} onChange={updateActiveRunCompanions} compact />
        {!justRun && (session.mode === "story"
          ? <section className="running-story-radio"><Activity /><div><span className="eyebrow">Runner radio</span><strong>{storyCopy}</strong><small>Chapter, narration and next-transmission status update live below.</small></div></section>
          : <section className="running-km-card"><Zap /><div><strong>Next celebration: {Math.floor(session.distanceMeters / 1000) + 1} km</strong><small>No previous-run comparisons while you are moving.</small></div></section>)}
        {!justRun ? <section className={`running-photo-status ${photoPermission === "limited" ? "limited" : ""}`} aria-live="polite">
          <Image />
          <div><strong>{photoStatus === "ready" ? "New run photos are watched" : photoStatus === "limited" ? "Selected photos only" : photoStatus === "permission-denied" ? "Run photos are off" : photoStatus === "permission-required" ? "Enable optional run photos" : "Run photos unavailable"}</strong><small>{photoStatus === "limited" ? "New Camera photos may be hidden. Manage access to allow all photos." : RUN_PHOTO_PRIVACY_NOTE}</small></div>
          {photoPermission === "full" || photoPermission === "unavailable" ? null : <button className="button ghost" onClick={() => void requestPhotoAccess()}>{photoPermission === "limited" ? "Manage access" : "Allow photos"}</button>}
        </section> : null}
        <section className="running-checkpoint-strip"><Zap /><span><strong>{Object.keys(session.checkpointAwards).length}/4 progress checkpoints</strong><small>+{session.checkpointXp} XP · +{session.distanceZenPoints} distance ZP{session.checkpointDice ? ` · 🎲 ${session.checkpointDice}` : ""}</small></span></section>
        <button disabled={finishBanking} className={`button full running-end-button ${confirmEnd ? "confirming" : ""}`} onClick={() => confirmEnd ? finishRun() : setConfirmEnd(true)}>{finishBanking ? "Banking run…" : confirmEnd ? "Tap again — bank this run" : justRun ? "Finish Just Run" : completionRatio < 1 ? "Finish run early" : "Finish & bank run"}</button>
        {confirmEnd ? <button className="button ghost full" onClick={() => setConfirmEnd(false)}>Keep running — no pressure</button> : null}
        {toast ? <div className="running-toast">{toast}</div> : null}
      </div>
    );
  }

  if (view === "summary" && session) {
    const totalXp = session.prepXp + session.runXp;
    const record = completedRecord;
    const levelsGained = Math.max(0, (session.completionLevelAfter ?? 1) - (session.completionLevelBefore ?? session.playerLevelAtStart));
    const totalZenPoints = session.distanceZenPoints + session.checkpointZenPoints + session.firstRunOfDayZenPoints;
    return (
      <div className="screen-stack running-mode running-summary">
        <div className="running-confetti" aria-hidden="true">{celebrationParticles.map((particle, index) => <span key={index} style={{
          "--x": `${particle.x}%`,
          "--start-y": `${particle.startY}px`,
          "--piece-width": `${particle.width}px`,
          "--piece-height": `${particle.height}px`,
          "--piece-hue": particle.hue,
          "--duration": `${particle.duration}s`,
          "--delay": `${particle.delay}s`,
          "--drift-a": `${particle.driftA}px`,
          "--drift-b": `${particle.driftB}px`,
          "--drift-c": `${particle.driftC}px`,
          "--spin": `${particle.spin}deg`,
          "--flutter": `${particle.flutter}s`,
          "--round": `${particle.round}px`
        } as CSSProperties} />)}</div>
        <section className="running-summary-hero"><span className="running-summary-check"><Check /></span><span className="eyebrow">{session.mode === "story" ? "Mission complete" : "Run complete"}</span><h1>RUN BANKED!</h1><div className="running-summary-reward-row"><strong>+{totalXp} XP</strong><strong>+{totalZenPoints} ZP</strong></div><p>{session.mode === "just" ? "No directions. No planned route. Every tracked metre still counted." : "You went out and did it. The run and every reward are safely banked."}</p></section>
        {levelsGained > 0 ? <section className="running-level-up-banner"><Sparkles /><div><span className="eyebrow">Level up{levelsGained > 1 ? ` ×${levelsGained}` : ""}</span><strong>LEVEL {session.completionLevelAfter}</strong><small>New level reached. Keep the momentum moving.</small></div><Trophy /></section> : null}
        <section className="card running-results-card">
          <span className="eyebrow">Here’s how you did</span>
          {record ? <RunNameEditor record={record} onSave={(name) => renameRun(record.id, name)} /> : null}
          {record ? <RunCompanionPicker companionIds={record.companionIds} onChange={(companionIds) => updateRunCompanions(record.id, companionIds)} /> : null}
          <div className="running-result-grid"><span><small>Distance</small><strong>{formatRunDistance(session.distanceMeters)}</strong></span><span><small>Elapsed</small><strong>{formatRunClock(elapsedRunSeconds)}</strong></span><span><small>Moving</small><strong>{formatRunClock(record?.movingSeconds ?? 0)}</strong></span><span><small>Avg pace · elapsed</small><strong>{formatRunPace(averagePace)}</strong></span></div>
          <RouteTrace points={session.points} label="Trace of your recorded route" />
          <div className="running-milestones"><span className={completionRatio >= 0.5 ? "done" : ""}>50%</span><span className={completionRatio >= 0.75 ? "done" : ""}>75%</span><span className={completionRatio >= 1 ? "done" : ""}>100%</span></div>
        </section>

        {record?.personalBestKeys.length ? (
          <section className="running-new-best-banner"><Medal /><div><span className="eyebrow">Personal best</span><strong>{record.personalBestKeys.length} new personal best{record.personalBestKeys.length === 1 ? "" : "s"}</strong><small>Fastest efforts from this recorded run.</small></div></section>
        ) : null}
        {record ? <BestEffortList efforts={record.bestEfforts} personalBestKeys={record.personalBestKeys} /> : null}
        {record?.splits.length ? (
          <section className="running-insight-section"><div className="section-heading"><div><span className="eyebrow">Kilometre by kilometre</span><h2>Pace laps</h2></div><Clock3 /></div><div className="running-split-list">{record.splits.map((split) => <div key={split.index}><strong>{split.index} km</strong><span>{formatRunClock(split.durationSeconds)}</span><small>{formatRunPace(split.paceSecondsPerKm)}</small></div>)}</div></section>
        ) : null}
          <section className="card running-xp-breakdown"><span><small>Prep + readiness</small><strong>+{session.prepXp} XP</strong></span><span><small>Run + checkpoints</small><strong>+{session.runXp} XP</strong></span><span><small><Coins size={14} /> Distance rewards</small><strong>+{session.distanceZenPoints} ZP</strong></span>{session.firstRunOfDayZenPoints ? <span><small>First run today</small><strong>+{session.firstRunOfDayZenPoints} ZP</strong></span> : null}<span><small><Dices size={14} /> Runner dice</small><strong>+{session.checkpointDice}</strong></span></section>
        <button className="button primary full" onClick={resetRun}><Check /> Done</button>
        <button className="button ghost full" onClick={() => setView("history")}><History /> Run history</button>
      </div>
    );
  }

  if (view === "history") {
    return (
      <>
      <div className="screen-stack running-mode">
        <button className="running-inline-back" onClick={() => setView("hub")}>← Running hub</button>
        <section className="page-intro"><h1>Run history</h1></section>
        <div className="running-history-filters" role="tablist" aria-label="Run history views">
          <button className={historyFilter === "all" ? "active" : ""} onClick={() => setHistoryFilter("all")}>All completed</button>
          <button className={historyFilter === "routes" ? "active" : ""} onClick={() => setHistoryFilter("routes")}>Completed routes</button>
          <button className={historyFilter === "favorites" ? "active" : ""} onClick={() => setHistoryFilter("favorites")}>Favourites</button>
        </div>
        <div className="running-history-list">
          {(() => {
            const records = profile.history.filter((record) =>
              historyFilter === "all" ? true : historyFilter === "routes" ? record.points.length >= 2 : record.isFavorite
            );
            return records.length ? records.map((record) => {
            const privatePoints = trimRouteForPrivacy(record.points, profile.routePrivacyMeters);
            const photos = [...(runPhotos[record.id] ?? [])].sort((left, right) => left.capturedAt - right.capturedAt);
            const previewPhoto = photos[0];
            return (
              <article className="card running-history-card" key={record.id}>
                <div className="running-history-heading"><div><span className="eyebrow">{runModeLabel(record.mode)} · {new Date(record.startedAt).toLocaleDateString()}</span><RunNameEditor record={record} onSave={(name) => renameRun(record.id, name)} />{record.routeRoadNames.length ? <small>{record.routeRoadNames.join(" · ")}</small> : null}</div><button className={`running-favorite-button ${record.isFavorite ? "is-favorite" : ""}`} onClick={() => toggleFavorite(record.id)} aria-pressed={record.isFavorite} aria-label={`${record.isFavorite ? "Remove" : "Save"} ${record.routeName} ${record.isFavorite ? "from" : "to"} favourites`}><Heart fill={record.isFavorite ? "currentColor" : "none"} /></button></div>
                <RunCompanionSummary companionIds={record.companionIds} />
                <div className="running-history-preview"><RouteTrace points={privatePoints} label="Privacy-trimmed trace of this completed run" compact /><div className={`running-photo-slot ${previewPhoto ? "has-photo" : ""}`} aria-label={previewPhoto ? "Run photo thumbnail" : "No run photos associated"}>{previewPhoto ? <RunPhotoThumbnail photo={previewPhoto} runId={record.id} onOpen={() => setPhotoGallery({ runId: record.id, photos, photoId: previewPhoto.id })} /> : <><Image /><span>Run photos</span><small>None saved</small></>}</div></div>
                <details><summary><div className="running-history-stats"><span>{formatRunDistance(record.distanceMeters)}</span><span>{formatRunClock(record.durationSeconds)} elapsed</span><span>{recordPace(record)}</span></div><small>{formatRunClock(record.movingSeconds)} moving · +{record.xp} running XP{record.personalBestKeys.length ? ` · ${record.personalBestKeys.length} new best` : ""}</small></summary>
                  <div className="running-history-detail">
                    <RunCompanionPicker companionIds={record.companionIds} onChange={(companionIds) => updateRunCompanions(record.id, companionIds)} />
                    {photos.length ? <div className="running-photo-list">{photos.map((photo) => <RunPhotoEditor key={photo.id} photo={photo} runId={record.id} history={profile.history} onChanged={reloadPhotoRuns} onRemove={async () => removePhoto(record.id, photo.id)} onDeleteCopy={async () => deletePhotoCopy(record.id, photo.id)} onOpen={() => setPhotoGallery({ runId: record.id, photos, photoId: photo.id })} />)}</div> : null}
                    {record.personalBestKeys.length ? <BestEffortList efforts={record.bestEfforts} personalBestKeys={record.personalBestKeys} /> : null}
                    {record.splits.length ? <div className="running-split-list compact">{record.splits.map((split) => <div key={split.index}><strong>{split.index} km</strong><span>{formatRunClock(split.durationSeconds)}</span><small>{formatRunPace(split.paceSecondsPerKm)}</small></div>)}</div> : null}
                  </div>
                </details>
              </article>
            );
          }) : <section className="card running-empty"><Footprints /><strong>{historyFilter === "all" ? "No runs banked yet" : historyFilter === "routes" ? "No completed GPS routes yet" : "No favourite routes yet"}</strong><p>{historyFilter === "all" ? "Your first completed run will appear here." : "Completed runs stay here only after you record them."}</p></section>;
          })()}
        </div>
      </div>
      {photoGallery ? <RunPhotoGallery runId={photoGallery.runId} photos={photoGallery.photos} initialPhotoId={photoGallery.photoId} onClose={() => setPhotoGallery(null)} /> : null}
      </>
    );
  }

  if (view === "store") {
    return (
      <div className="screen-stack running-mode">
        <button className="running-inline-back" onClick={() => setView("hub")}>← Running hub</button>
        <section className="page-intro"><span className="eyebrow">Spend what running earned</span><h1>Runner store</h1><p>Lifetime Zenchad XP never decreases. Running also earns spendable Runner Credits.</p></section>
        <div className="running-wallet"><Zap /><strong>{profile.credits}</strong><span>Runner Credits</span></div>
        <div className="running-store-grid">{STORE_ITEMS.map((item) => { const unlocked = profile.unlockedStoreIds.includes(item.id); return <button className={`running-store-card ${unlocked ? "unlocked" : ""}`} key={item.id} disabled={unlocked || profile.credits < item.price} onClick={() => buyStoreItem(item.id, item.price)}><ShoppingBag /><strong>{item.name}</strong><small>{item.note}</small><b>{unlocked ? "UNLOCKED" : `${item.price} credits`}</b></button>; })}</div>
        {toast ? <div className="running-toast">{toast}</div> : null}
      </div>
    );
  }

  return (
    <div className="screen-stack running-mode">
      <button className="running-inline-back" onClick={() => setView("hub")}>← Running hub</button>
      <section className="page-intro"><span className="eyebrow">Progress without punishment</span><h1>Runner progress</h1><p>What you have accumulated. Nothing here tells you what you “should” have done.</p></section>
      <div className="running-progress-grid"><article><strong>{totals.runs}</strong><span>runs</span></article><article><strong>{formatRunDistance(totals.distance)}</strong><span>distance</span></article><article><strong>{formatRunClock(totals.seconds)}</strong><span>time outside</span></article><article><strong>{totals.storyRuns}</strong><span>story runs</span></article><article><strong>{totals.xp}</strong><span>running XP earned</span></article><article><strong>{profile.credits}</strong><span>credits available</span></article><article><strong>{profile.dice}</strong><span>runner dice</span></article></div>
      {totals.bestEfforts.length ? <BestEffortList efforts={totals.bestEfforts} personalBestKeys={totals.bestEfforts.map((effort) => effort.key)} /> : null}
      <section className="card running-principle"><Trophy /><div><strong>Next progression pass</strong><p>Runner Sectors, achievements, streak multipliers and watch/heart-rate data plug in here next.</p></div></section>
    </div>
  );
}
