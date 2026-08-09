import {
  Activity,
  ArrowRight,
  Check,
  Clock3,
  EyeOff,
  Footprints,
  Headphones,
  History,
  Map,
  Medal,
  Navigation,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Trophy,
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
import {
  RUN_PREP_STEPS,
  addRunningXp,
  calculateBestEfforts,
  calculateKilometreSplits,
  calculateRunXp,
  compactRunPoints,
  createRunSession,
  distanceMeters,
  formatRunClock,
  formatRunDistance,
  formatRunPace,
  loadRunSession,
  loadRunningProfile,
  personalBestKeysFor,
  prepStepXp,
  saveRunSession,
  saveRunningProfile,
  trimRouteForPrivacy,
  type RunBestEffort,
  type RunMode,
  type RunPoint,
  type RunRecord,
  type RunSession,
  type RunningProfile
} from "../running";
import type { AppData } from "../types";

interface Props {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
}

type RunningView =
  | "hub"
  | "duration"
  | "briefing"
  | "prep"
  | "active"
  | "summary"
  | "history"
  | "store"
  | "progress";

const DURATIONS = [20, 30, 45, 60];
const PLAN_MILESTONES = [0.5, 0.75, 1];

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
  if (session.stage === "active") return "active";
  return "summary";
};

function routeTrace(points: RunPoint[]) {
  if (points.length < 2) return "";
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(0.00001, maxLat - minLat);
  const lngRange = Math.max(0.00001, maxLng - minLng);
  return points
    .map((point) => {
      const x = 8 + ((point.lng - minLng) / lngRange) * 84;
      const y = 92 - ((point.lat - minLat) / latRange) * 84;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function recordPace(record: RunRecord) {
  return formatRunPace(record.averagePaceSecondsPerKm);
}

function RouteTrace({ points, label }: { points: RunPoint[]; label: string }) {
  const trace = routeTrace(points);
  return (
    <div className="running-route-trace">
      {trace ? (
        <svg viewBox="0 0 100 100" role="img" aria-label={label}>
          <polyline points={trace} />
        </svg>
      ) : (
        <div><Map /><span>Route trace appears once GPS has enough points.</span></div>
      )}
    </div>
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

export default function RunningModeScreen({ data, setData }: Props) {
  const restored = useRef<RunSession | null>(loadRunSession());
  const [session, setSession] = useState<RunSession | null>(restored.current);
  const [profile, setProfile] = useState<RunningProfile>(() => loadRunningProfile());
  const [view, setView] = useState<RunningView>(() => initialViewFor(restored.current));
  const [selectedMode, setSelectedMode] = useState<RunMode>("quick");
  const [now, setNow] = useState(Date.now());
  const [gpsStatus, setGpsStatus] = useState("GPS waits until the run starts");
  const [toast, setToast] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const lastAnnouncedKm = useRef(Math.floor((restored.current?.distanceMeters ?? 0) / 1000));
  const restoredPlanRatio = restored.current?.stage === "active" && restored.current.runStartedAt
    ? (Date.now() - restored.current.runStartedAt) / Math.max(60_000, restored.current.plannedMinutes * 60_000)
    : 0;
  const lastPlanMilestone = useRef(restoredPlanRatio >= 1 ? 3 : restoredPlanRatio >= 0.75 ? 2 : restoredPlanRatio >= 0.5 ? 1 : 0);
  const toastTimer = useRef<number | null>(null);

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
    const focus = Boolean(session && ["prep", "active"].includes(session.stage));
    document.documentElement.classList.toggle("running-focus-mode", focus);
    return () => document.documentElement.classList.remove("running-focus-mode");
  }, [session?.stage]);

  useEffect(() => {
    if (session?.stage !== "active") return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [session?.stage]);

  useEffect(() => {
    if (session?.stage !== "active") return;
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
          at: position.timestamp || Date.now()
        };

        setSession((current) => {
          if (!current || current.stage !== "active") return current;
          if (rawPoint.accuracy > 80) {
            setGpsStatus(`GPS weak · ±${Math.round(rawPoint.accuracy)} m`);
            return current;
          }

          const previous = current.points[current.points.length - 1];
          let extraDistance = 0;
          if (previous) {
            const segment = distanceMeters(previous, rawPoint);
            const elapsed = Math.max(1, (rawPoint.at - previous.at) / 1000);
            const plausible = segment >= 2 && segment <= 120 && segment / elapsed <= 12;
            if (plausible) extraDistance = segment;
          }

          const shouldAppend = !previous || extraDistance > 0 || rawPoint.at - previous.at >= 10_000;
          if (!shouldAppend) return current;

          const nextDistance = current.distanceMeters + extraDistance;
          const point: RunPoint = { ...rawPoint, distanceFromStart: nextDistance };
          const next: RunSession = {
            ...current,
            points: [...current.points, point].slice(-4000),
            distanceMeters: nextDistance
          };
          saveRunSession(next);
          setGpsStatus(`GPS locked · ±${Math.round(rawPoint.accuracy)} m`);
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
  }, [session?.stage]);

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
  const plannedSeconds = (session?.plannedMinutes ?? 1) * 60;
  const completionRatio = plannedSeconds > 0 ? elapsedRunSeconds / plannedSeconds : 0;
  const currentPrep = session?.stage === "prep" ? RUN_PREP_STEPS[session.prepStepIndex] : null;
  const prepElapsed = session ? Math.max(0, (now - session.stepStartedAt) / 1000) : 0;

  useEffect(() => {
    if (session?.stage !== "active") return;
    const reached = completionRatio >= 1 ? 3 : completionRatio >= 0.75 ? 2 : completionRatio >= 0.5 ? 1 : 0;
    if (reached <= lastPlanMilestone.current) return;
    lastPlanMilestone.current = reached;
    const percent = Math.round(PLAN_MILESTONES[reached - 1] * 100);
    navigator.vibrate?.([28, 30, 62]);
    showToast(`${percent}% OF THE PLAN BANKED`);
  }, [completionRatio, session?.stage]);

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
    setView("duration");
  };

  const chooseDuration = (minutes: number) => {
    const next = createRunSession(selectedMode, minutes);
    setSavedSession(next);
    setView("briefing");
  };

  const beginPrep = () => {
    if (!session) return;
    const next: RunSession = { ...session, stage: "prep", prepStepIndex: 0, stepStartedAt: Date.now() };
    setSavedSession(next);
    setNow(Date.now());
    setView("prep");
  };

  const completePrepStep = () => {
    const current = loadRunSession();
    if (!current || current.stage !== "prep") return;
    const step = RUN_PREP_STEPS[current.prepStepIndex];
    if (!step || current.prepAwards[step.id] !== undefined) return;

    const elapsed = Math.max(0, (Date.now() - current.stepStartedAt) / 1000);
    const xp = prepStepXp(step, elapsed);
    const isLast = current.prepStepIndex === RUN_PREP_STEPS.length - 1;
    const startBonus = isLast ? 25 : 0;
    const next: RunSession = {
      ...current,
      prepAwards: {
        ...current.prepAwards,
        [step.id]: xp,
        ...(isLast ? { "run-start": startBonus } : {})
      },
      prepXp: current.prepXp + xp + startBonus,
      prepStepIndex: isLast ? current.prepStepIndex : current.prepStepIndex + 1,
      stepStartedAt: Date.now(),
      stage: isLast ? "active" : "prep",
      runStartedAt: isLast ? Date.now() : current.runStartedAt
    };

    setData((currentData) => ({ ...currentData, stats: addRunningXp(currentData.stats, xp + startBonus) }));
    lastAnnouncedKm.current = 0;
    lastPlanMilestone.current = 0;
    setSavedSession(next);
    setNow(Date.now());
    showToast(isLast ? `RUN STARTED · +${xp + startBonus} XP` : `+${xp} XP`);
    if (isLast) setView("active");
  };

  const finishRun = () => {
    const current = loadRunSession();
    if (!current?.runStartedAt || current.stage !== "active") return;
    const endedAt = Date.now();
    const durationSeconds = Math.max(1, Math.floor((endedAt - current.runStartedAt) / 1000));
    const runXp = calculateRunXp(durationSeconds, current.distanceMeters, current.plannedMinutes);
    const ratio = durationSeconds / Math.max(60, current.plannedMinutes * 60);
    const pace = current.distanceMeters >= 100 ? durationSeconds / (current.distanceMeters / 1000) : null;
    const previousProfile = loadRunningProfile();
    const splits = calculateKilometreSplits(current.points);
    const bestEfforts = calculateBestEfforts(current.points);
    const personalBestKeys = personalBestKeysFor(bestEfforts, previousProfile.history.filter((item) => item.id !== current.id));
    const record: RunRecord = {
      id: current.id,
      mode: current.mode,
      plannedMinutes: current.plannedMinutes,
      startedAt: current.runStartedAt,
      endedAt,
      durationSeconds,
      distanceMeters: current.distanceMeters,
      averagePaceSecondsPerKm: pace,
      completionRatio: ratio,
      xp: current.prepXp + runXp,
      points: compactRunPoints(current.points),
      splits,
      bestEfforts,
      personalBestKeys
    };
    const nextSession: RunSession = { ...current, stage: "complete", runEndedAt: endedAt, runXp };
    const nextProfile: RunningProfile = {
      ...previousProfile,
      credits: previousProfile.credits + current.prepXp + runXp,
      history: [record, ...previousProfile.history.filter((item) => item.id !== record.id)].slice(0, 100)
    };

    setData((currentData) => ({ ...currentData, stats: addRunningXp(currentData.stats, runXp) }));
    setSavedProfile(nextProfile);
    setSavedSession(nextSession);
    setNow(endedAt);
    setConfirmEnd(false);
    setView("summary");
  };

  const resetRun = () => {
    setSavedSession(null);
    setSelectedMode("quick");
    setConfirmEnd(false);
    setView("hub");
    setGpsStatus("GPS waits until the run starts");
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

  const setRoutePrivacy = (meters: number) => {
    setSavedProfile({ ...profile, routePrivacyMeters: meters });
  };

  const totals = useMemo(() => {
    const history = profile.history;
    const bestMap = new Map<string, RunBestEffort>();
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
            <span><strong>Resume current run</strong><small>{session.mode === "story" ? "Story Run" : "Quick Run"} · {session.plannedMinutes} min</small></span>
            <ArrowRight />
          </button>
        ) : null}

        <div className="running-mode-grid">
          <button className="running-mode-card quick" onClick={() => chooseMode("quick")}>
            <Navigation /><span className="eyebrow">Less thinking</span><strong>Quick Run</strong><small>Pick a time. Get out. Let the route do the thinking.</small>
          </button>
          <button className="running-mode-card story" onClick={() => chooseMode("story")}>
            <Sparkles /><span className="eyebrow">The city is the level</span><strong>Story Run</strong><small>Runner missions, chases and location-aware set pieces.</small>
          </button>
        </div>

        <div className="running-hub-links">
          <button onClick={() => setView("history")}><History /> Run history</button>
          <button onClick={() => setView("store")}><ShoppingBag /> Runner store</button>
          <button onClick={() => setView("progress")}><Trophy /> Progress</button>
        </div>

        <section className="card running-principle"><Sparkles /><div><strong>No shame engine</strong><p>Starting earns something. Progress earns more. Missing a target never deletes what you already earned.</p></div></section>
      </div>
    );
  }

  if (view === "duration") {
    return (
      <div className="screen-stack running-mode">
        <button className="running-inline-back" onClick={() => setView("hub")}>← Running hub</button>
        <section className="page-intro"><span className="eyebrow">{selectedMode === "story" ? "Story Run" : "Quick Run"}</span><h1>How long do you want to run?</h1><p>One decision. Zenchad will eventually build the route around it.</p></section>
        <div className="running-duration-grid">{DURATIONS.map((minutes) => <button key={minutes} onClick={() => chooseDuration(minutes)}><strong>{minutes}</strong><span>minutes</span></button>)}</div>
      </div>
    );
  }

  if (view === "briefing" && session) {
    return (
      <div className="screen-stack running-mode">
        <button className="running-inline-back" onClick={resetRun}>← Change run</button>
        <section className="running-briefing">
          <Map /><span className="eyebrow">Route Director</span><h1>{session.plannedMinutes}-minute {session.mode === "story" ? "Story" : "Quick"} Run</h1>
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

    return (
      <div className="screen-stack running-mode running-prep">
        <div className="running-progress-row"><span>PREP {stepNumber}/{RUN_PREP_STEPS.length}</span><strong>+{session.prepXp} XP banked</strong></div>
        <div className="running-progress-track"><span style={{ width: `${((stepNumber - 1) / RUN_PREP_STEPS.length) * 100}%` }} /></div>
        <section className="running-prep-card">
          <span className="running-prep-icon">{currentPrep.id === "headphones" ? <Headphones /> : currentPrep.id === "outside" ? <Navigation /> : <Footprints />}</span>
          <span className="eyebrow">Next tiny action</span><h1>{currentPrep.title}</h1><p>{currentPrep.instruction}</p>
          {currentPrep.speedBonus ? (
            <div className="running-prep-timer"><Clock3 /><span><strong>{remaining > 0 ? formatRunClock(remaining) : "Base XP safe"}</strong><small>{inTarget ? "full momentum bonus" : inGrace ? "bonus gently draining" : "no failure — base XP remains"}</small></span><b>+{currentXp} XP</b></div>
          ) : (
            <div className="running-prep-timer calm"><Sparkles /><span><strong>No rush</strong><small>Warm up properly. There is deliberately no speed bonus.</small></span><b>+{currentXp} XP</b></div>
          )}
          <button className="button primary full" onClick={completePrepStep}>{currentPrep.buttonLabel} <ArrowRight /></button>
        </section>
        {toast ? <div className="running-toast">{toast}</div> : null}
      </div>
    );
  }

  if (view === "active" && session) {
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
          <div className="running-live-top"><span className="eyebrow">{session.mode === "story" ? "Story Run" : "Quick Run"}</span><span className={`running-gps ${gpsStatus.startsWith("GPS locked") ? "locked" : ""}`}>{gpsStatus}</span></div>
          <div className="running-primary-stat"><strong>{formatRunDistance(session.distanceMeters)}</strong><span>{formatRunClock(elapsedRunSeconds)}</span></div>
          <div className="running-live-stats"><span><small>PACE</small><b>{formatRunPace(averagePace)}</b></span><span><small>PLAN</small><b>{session.plannedMinutes} min</b></span><span><small>PROGRESS</small><b>{Math.round(plannedProgress * 100)}%</b></span></div>
          <div className="running-progress-track active"><span style={{ width: `${plannedProgress * 100}%` }} /></div>
        </section>
        {session.mode === "story"
          ? <section className="running-story-radio"><Activity /><div><span className="eyebrow">Runner radio</span><strong>{storyCopy}</strong><small>Live dialogue, helicopter audio and chase logic come in the native story/audio pass.</small></div></section>
          : <section className="running-km-card"><Zap /><div><strong>Next celebration: {Math.floor(session.distanceMeters / 1000) + 1} km</strong><small>No previous-run comparisons while you are moving.</small></div></section>}
        <button className={`button full running-end-button ${confirmEnd ? "confirming" : ""}`} onClick={() => confirmEnd ? finishRun() : setConfirmEnd(true)}>{confirmEnd ? "Tap again — finish & bank run" : "END RUN"}</button>
        {confirmEnd ? <button className="button ghost full" onClick={() => setConfirmEnd(false)}>Keep running</button> : null}
        {toast ? <div className="running-toast">{toast}</div> : null}
      </div>
    );
  }

  if (view === "summary" && session) {
    const totalXp = session.prepXp + session.runXp;
    const record = completedRecord;
    return (
      <div className="screen-stack running-mode running-summary">
        <div className="running-confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <span key={index} style={{ "--i": index } as CSSProperties} />)}</div>
        <section className="running-summary-hero"><span className="running-summary-check"><Check /></span><span className="eyebrow">{session.mode === "story" ? "Mission complete" : "Run complete"}</span><h1>WELL DONE.</h1><strong>+{totalXp} XP</strong><p>You went out and did it. The numbers are information; the run is already banked.</p></section>
        <section className="card running-results-card">
          <span className="eyebrow">Here’s how you did</span>
          <div className="running-result-grid"><span><small>Distance</small><strong>{formatRunDistance(session.distanceMeters)}</strong></span><span><small>Time</small><strong>{formatRunClock(elapsedRunSeconds)}</strong></span><span><small>Avg pace</small><strong>{formatRunPace(averagePace)}</strong></span><span><small>Plan</small><strong>{Math.round(completionRatio * 100)}%</strong></span></div>
          <RouteTrace points={session.points} label="Trace of your recorded route" />
          <div className="running-milestones"><span className={completionRatio >= 0.5 ? "done" : ""}>50%</span><span className={completionRatio >= 0.75 ? "done" : ""}>75%</span><span className={completionRatio >= 1 ? "done" : ""}>100%</span></div>
        </section>

        {record?.personalBestKeys.length ? (
          <section className="running-new-best-banner"><Medal /><div><span className="eyebrow">Post-run discovery</span><strong>{record.personalBestKeys.length} new personal best{record.personalBestKeys.length === 1 ? "" : "s"}</strong><small>Zenchad waited until the run was over before comparing anything.</small></div></section>
        ) : null}
        {record ? <BestEffortList efforts={record.bestEfforts} personalBestKeys={record.personalBestKeys} /> : null}
        {record?.splits.length ? (
          <section className="running-insight-section"><div className="section-heading"><div><span className="eyebrow">Kilometre by kilometre</span><h2>Pace laps</h2></div><Clock3 /></div><div className="running-split-list">{record.splits.map((split) => <div key={split.index}><strong>{split.index} km</strong><span>{formatRunClock(split.durationSeconds)}</span><small>{formatRunPace(split.paceSecondsPerKm)}</small></div>)}</div></section>
        ) : null}
        <section className="card running-xp-breakdown"><span><small>Prep + starting</small><strong>+{session.prepXp} XP</strong></span><span><small>Run + plan milestones</small><strong>+{session.runXp} XP</strong></span></section>
        <button className="button primary full" onClick={resetRun}><RotateCcw /> Start a fresh run</button>
        <button className="button ghost full" onClick={() => setView("history")}><History /> Run history</button>
      </div>
    );
  }

  if (view === "history") {
    return (
      <div className="screen-stack running-mode">
        <button className="running-inline-back" onClick={() => setView("hub")}>← Running hub</button>
        <section className="page-intro"><span className="eyebrow">Your routes, kept local</span><h1>Run history</h1><p>Positive records and useful information. No feed, no leaderboard, no shame.</p></section>
        <section className="card running-privacy-card">
          <EyeOff /><div><strong>Route privacy preview</strong><small>Hide the start and end of saved route maps. The full GPS data still stays on this device for your own stats.</small></div>
          <div className="running-privacy-options">{[0, 200, 400].map((meters) => <button className={profile.routePrivacyMeters === meters ? "active" : ""} key={meters} onClick={() => setRoutePrivacy(meters)}>{meters === 0 ? "Full" : `${meters} m`}</button>)}</div>
        </section>
        <div className="running-history-list">
          {profile.history.length ? profile.history.map((record) => {
            const privatePoints = trimRouteForPrivacy(record.points, profile.routePrivacyMeters);
            return (
              <details className="card running-history-card" key={record.id}>
                <summary><div><span className="eyebrow">{record.mode === "story" ? "Story Run" : "Quick Run"}</span><strong>{new Date(record.startedAt).toLocaleDateString()}</strong></div><div className="running-history-stats"><span>{formatRunDistance(record.distanceMeters)}</span><span>{formatRunClock(record.durationSeconds)}</span><span>{recordPace(record)}</span></div><small>+{record.xp} running XP · {Math.round(record.completionRatio * 100)}% of planned time{record.personalBestKeys.length ? ` · ${record.personalBestKeys.length} new best` : ""}</small></summary>
                <div className="running-history-detail">
                  <RouteTrace points={privatePoints} label="Privacy-trimmed trace of this run" />
                  {profile.routePrivacyMeters > 0 ? <span className="running-privacy-badge"><EyeOff /> Start & end hidden by {profile.routePrivacyMeters} m</span> : null}
                  {record.personalBestKeys.length ? <BestEffortList efforts={record.bestEfforts} personalBestKeys={record.personalBestKeys} /> : null}
                  {record.splits.length ? <div className="running-split-list compact">{record.splits.map((split) => <div key={split.index}><strong>{split.index} km</strong><span>{formatRunClock(split.durationSeconds)}</span><small>{formatRunPace(split.paceSecondsPerKm)}</small></div>)}</div> : null}
                </div>
              </details>
            );
          }) : <section className="card running-empty"><Footprints /><strong>No runs banked yet</strong><p>Your first one will appear here.</p></section>}
        </div>
      </div>
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
      <div className="running-progress-grid"><article><strong>{totals.runs}</strong><span>runs</span></article><article><strong>{formatRunDistance(totals.distance)}</strong><span>distance</span></article><article><strong>{formatRunClock(totals.seconds)}</strong><span>time outside</span></article><article><strong>{totals.storyRuns}</strong><span>story runs</span></article><article><strong>{totals.xp}</strong><span>running XP earned</span></article><article><strong>{profile.credits}</strong><span>credits available</span></article></div>
      {totals.bestEfforts.length ? <BestEffortList efforts={totals.bestEfforts} personalBestKeys={totals.bestEfforts.map((effort) => effort.key)} /> : null}
      <section className="card running-principle"><Trophy /><div><strong>Next progression pass</strong><p>Runner Sectors, achievements, streak multipliers and watch/heart-rate data plug in here next.</p></div></section>
    </div>
  );
}
