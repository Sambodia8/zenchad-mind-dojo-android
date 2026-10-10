import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent,
  type SetStateAction
} from "react";
import {
  ArrowLeft,
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Info,
  Music2,
  Pause,
  Play,
  Timer,
  Touchpad,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import {
  expandYogaClassSlides,
  getYogaClass,
  getYogaClassDuration,
  YOGA_TRANSITION_SECONDS
} from "../data";
import { allowScreenSleep, keepScreenAwake } from "../native";
import { addCompletedSession, appendActivitySession, saveData } from "../storage";
import type { AppData, Route } from "../types";
import { loadBikeQuestState, type BikeQuestResume } from "../bikeQuest";
import MovementVisual from "../components/MovementVisual";
import GuidedClassIntro from "../components/GuidedClassIntro";
import { playUiSfx } from "../uiSfx";
import { restoredYogaActiveSeconds, updateYogaActiveClock, type YogaActiveClock } from "../yogaSessionClock";
import {
  addRunningXp,
  completeRunPrepStep,
  loadRunSession,
  saveRunSession,
  skipRunPrepStep
} from "../running";

interface Props {
  classId: string;
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  navigate: Dispatch<SetStateAction<Route>>;
  returnToBikeQuest?: BikeQuestResume;
  returnToRunningPreparation?: boolean;
  autoStart?: boolean;
  onImmersiveStateChange?: (isImmersive: boolean) => void;
}

type PlayerPhase = "ready" | "pose" | "transition" | "finished";
type AdvanceMode = "timed" | "tap";

const STRETCH_MUSIC = [
  {
    id: "grounding",
    name: "Warm Grounding",
    artwork: "assets/meditation-art/sunset.webp",
    src: "/assets/audio/soundscapes/grounding-music-a.ogg"
  },
  {
    id: "lofi",
    name: "Lo-fi Limber",
    artwork: "assets/meditation-art/celestial.webp",
    src: "/assets/audio/soundscapes/focused-attention-music-b.ogg"
  },
  {
    id: "sunrise",
    name: "Soft Sunrise",
    artwork: "assets/meditation-art/lotus.webp",
    src: "/assets/audio/soundscapes/metta-music-a.ogg"
  }
] as const;

const POSE_XP = 5;

interface PointerStart {
  id: number;
  x: number;
  y: number;
  at: number;
}

const isInteractiveTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(target.closest("button, a, input, select, textarea, summary, label, [data-no-advance]"));

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

export default function YogaClassScreen({
  classId,
  data,
  setData,
  navigate,
  returnToBikeQuest,
  returnToRunningPreparation,
  autoStart,
  onImmersiveStateChange
}: Props) {
  const yogaClass = useMemo(() => {
    if (classId.startsWith("custom-")) {
      const custom = data.customYogaClasses.find(c => c.id === classId);
      if (custom) return custom;
    }
    return getYogaClass(classId);
  }, [classId, data.customYogaClasses]);
  const slides = useMemo(() => expandYogaClassSlides(yogaClass), [yogaClass]);
  const [sessionId] = useState(() => {
    const quest = returnToBikeQuest ? loadBikeQuestState() : null;
    const run = returnToRunningPreparation ? loadRunSession() : null;
    return quest ? `yoga-substep:bike:${quest.startedAt}:${returnToBikeQuest}:${classId}`
      : run ? `yoga-substep:run:${run.id}:${classId}` : `yoga:${crypto.randomUUID()}`;
  });
  const contextual = sessionId.startsWith("yoga-substep:");
  const checkpointKey = `zenchad_yoga_player_v1:${sessionId}`;
  const [restored] = useState(() => {
    if (!contextual) return null;
    try {
      const saved = JSON.parse(localStorage.getItem(checkpointKey) ?? "null");
      if (saved?.sessionId !== sessionId || !["ready", "pose", "transition", "finished"].includes(saved.phase)
        || !Number.isInteger(saved.index) || saved.index < 0 || saved.index >= slides.length
        || (saved.phase === "transition" && saved.index >= slides.length - 1)
        || !Number.isFinite(saved.secondsLeft) || saved.secondsLeft < 0
        || saved.secondsLeft > (saved.phase === "transition" ? YOGA_TRANSITION_SECONDS : slides[saved.index].seconds)
        || !Number.isFinite(saved.startedAt) || saved.startedAt <= 0
        || !Number.isFinite(saved.earnedXp) || saved.earnedXp < 0) return null;
      return { ...saved, activeSeconds: restoredYogaActiveSeconds(saved.activeSeconds) } as { phase: PlayerPhase; index: number; secondsLeft: number; startedAt: number; earnedXp: number; activeSeconds: number };
    } catch { return null; }
  });
  const completionReceipt = data.activitySessions.find(receipt => receipt.kind === "yoga" && receipt.id === sessionId);
  const [phase, setPhase] = useState<PlayerPhase>(completionReceipt ? "finished" : restored?.phase === "finished" ? "pose" : restored?.phase ?? "ready");
  const [index, setIndex] = useState(restored?.index ?? 0);
  const [secondsLeft, setSecondsLeft] = useState(restored?.secondsLeft ?? slides[0].seconds);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<AdvanceMode>("timed");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [earnedXp, setEarnedXp] = useState(() => {
    if (!completionReceipt) return 0;
    const poseXp = data.activitySessions.filter(receipt => receipt.kind === "yoga" && receipt.id.startsWith(`yoga-reward:${sessionId}:slide:`)).length * POSE_XP;
    const prepXp = returnToRunningPreparation ? loadRunSession()?.prepAwards.stretches ?? 0 : 0;
    const stats = addRunningXp(addCompletedSession(data.stats, completionReceipt.seconds), prepXp + 10 + Math.floor(completionReceipt.seconds / 60));
    return poseXp + stats.xp - data.stats.xp;
  });
  const [poseReward, setPoseReward] = useState<{ amount: number; key: number } | null>(null);
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  const pointerStart = useRef<PointerStart | null>(null);
  const lastTapAdvance = useRef(0);
  const startedAt = useRef<number | null>(restored?.startedAt ?? null);
  const activeClock = useRef<YogaActiveClock>({ elapsedMs: (restored?.activeSeconds ?? 0) * 1000, activeAt: null });
  const completed = useRef(Boolean(completionReceipt));
  const awardedSlides = useRef<Set<number>>(new Set(slides.map((_, slideIndex) => slideIndex).filter(slideIndex =>
    data.activitySessions.some(receipt => receipt.kind === "yoga" && receipt.id === `yoga-reward:${sessionId}:slide:${slideIndex}`))));
  const poseRewardTimer = useRef<number | null>(null);
  const autoStarted = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const musicAudio = useRef<HTMLAudioElement | null>(null);
  const settingsMenu = useRef<HTMLDetailsElement | null>(null);
  const selectedMusic =
    STRETCH_MUSIC.find((track) => track.id === data.preferences.stretchMusicTrack) ??
    STRETCH_MUSIC[0];
  const current = slides[index];
  const next = slides[index + 1];
  const isBeforeRunning = yogaClass.id === "before-run";
  const guidedItem = isBeforeRunning ? "movement" : "pose";
  const changingSides =
    phase === "transition" &&
    current.side === 1 &&
    next?.side === 2 &&
    current.movement.id === next.movement.id;
  const guidanceSlide = phase === "transition" && next ? next : current;

  useEffect(() => {
    activeClock.current = updateYogaActiveClock(activeClock.current, running && (phase === "pose" || phase === "transition"), performance.now());
    return () => {
      activeClock.current = updateYogaActiveClock(activeClock.current, false, performance.now());
      if (contextual && startedAt.current) {
        try {
          const saved = JSON.parse(localStorage.getItem(checkpointKey) ?? "null");
          if (saved?.sessionId === sessionId) localStorage.setItem(checkpointKey, JSON.stringify({ ...saved, activeSeconds: activeClock.current.elapsedMs / 1000 }));
        } catch {
          // A malformed older checkpoint must not interrupt the current class.
        }
      }
    };
  }, [checkpointKey, contextual, phase, running, sessionId]);

  useEffect(() => {
    if (!contextual || !startedAt.current) return;
    activeClock.current = updateYogaActiveClock(activeClock.current, activeClock.current.activeAt !== null, performance.now());
    localStorage.setItem(checkpointKey, JSON.stringify({ sessionId, phase, index, secondsLeft,
      startedAt: startedAt.current, earnedXp, activeSeconds: activeClock.current.elapsedMs / 1000, awardedSlides: [...awardedSlides.current] }));
  }, [checkpointKey, contextual, earnedXp, index, phase, secondsLeft, sessionId]);

  useEffect(() => {
    onImmersiveStateChange?.(phase === "pose" || phase === "transition");
    return () => onImmersiveStateChange?.(false);
  }, [onImmersiveStateChange, phase]);

  useEffect(() => {
    setGuidanceOpen(false);
  }, [index, phase]);

  useEffect(() => {
    if (!guidanceOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGuidanceOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [guidanceOpen]);

  const ensureAudio = useCallback(async () => {
    if (!audioContext.current || audioContext.current.state === "closed") {
      audioContext.current = new AudioContext();
    }
    if (audioContext.current.state === "suspended") {
      await audioContext.current.resume();
    }
    return audioContext.current;
  }, []);

  const playChime = useCallback(async () => {
    if (!soundEnabled) return;
    try {
      const context = await ensureAudio();
      const now = context.currentTime;
      const master = context.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.12, now + 0.018);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
      master.connect(context.destination);

      [523.25, 659.25].forEach((frequency, harmonicIndex) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.value = harmonicIndex === 0 ? 1 : 0.55;
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(now + harmonicIndex * 0.055);
        oscillator.stop(now + 1.08);
      });
    } catch {
      // The visual countdown remains fully usable when Web Audio is unavailable.
    }
  }, [ensureAudio, soundEnabled]);

  const playTick = useCallback(async () => {
    if (!soundEnabled) return;
    try {
      const context = await ensureAudio();
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(920, now);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.06);
    } catch {
      // The visible five-second transition remains the source of truth.
    }
  }, [ensureAudio, soundEnabled]);

  const startSlide = useCallback(
    (nextIndex: number) => {
      setIndex(nextIndex);
      setSecondsLeft(slides[nextIndex].seconds);
      setPhase("pose");
      setRunning(true);
      void playChime();
    },
    [playChime, slides]
  );

  const awardPoseXp = useCallback((slideIndex: number) => {
    if (awardedSlides.current.has(slideIndex)) return;
    awardedSlides.current.add(slideIndex);
    const receipt = { id: `yoga-reward:${sessionId}:slide:${slideIndex}`, kind: "yoga" as const, completedAt: new Date().toISOString(), seconds: 0 };
    setData((currentData) => {
      if (currentData.activitySessions.some(entry => entry.kind === "yoga" && entry.id === receipt.id)) return currentData;
      const nextData = { ...currentData, stats: addRunningXp(currentData.stats, POSE_XP) };
      const saved = appendActivitySession(nextData, receipt);
      saveData(saved);
      return saved;
    });
    setPoseReward({ amount: POSE_XP, key: slideIndex });
    if (poseRewardTimer.current) window.clearTimeout(poseRewardTimer.current);
    poseRewardTimer.current = window.setTimeout(() => setPoseReward(null), 1300);
    if (data.preferences.uiSoundsEnabled && soundEnabled) playUiSfx("xpGain");
  }, [data.preferences.uiSoundsEnabled, sessionId, setData, soundEnabled]);

  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    activeClock.current = updateYogaActiveClock(activeClock.current, false, performance.now());
    const elapsed = Math.max(1, Math.round(activeClock.current.elapsedMs / 1000));
    const completionXp = 10 + Math.max(0, Math.floor(elapsed / 60));
    const completedAt = new Date().toISOString();
    setRunning(false);
    setPhase("finished");
    let runningPrepXp = 0;
    if (returnToRunningPreparation) {
      const runSession = loadRunSession();
      if (runSession?.stage === "prep") {
        const completion = completeRunPrepStep(runSession);
        if (completion?.step.id === "stretches") {
          saveRunSession(completion.next);
          runningPrepXp = completion.xp;
        }
      }
    }
    const awardedStats = addRunningXp(addCompletedSession(data.stats, elapsed), runningPrepXp + completionXp);
    setEarnedXp(awardedSlides.current.size * POSE_XP + awardedStats.xp - data.stats.xp);
    setData((currentData) => {
      if (currentData.activitySessions.some(receipt => receipt.kind === "yoga" && receipt.id === sessionId)) return currentData;
      const completedStats = addCompletedSession(currentData.stats, elapsed);
      const statsWithRunningPrep = addRunningXp(completedStats, runningPrepXp + completionXp);
      const nextData = appendActivitySession({
        ...currentData,
        stats: {
          ...statsWithRunningPrep,
          yogaSessions: statsWithRunningPrep.yogaSessions + 1
        }
      }, { id: sessionId, kind: "yoga", completedAt, seconds: elapsed });
      saveData(nextData);
      return nextData;
    });
    navigator.vibrate?.([60, 50, 100]);
    if (data.preferences.uiSoundsEnabled) {
      playUiSfx("victory");
    }
  }, [data.preferences.uiSoundsEnabled, data.stats, returnToRunningPreparation, sessionId, setData]);

  const beginTransition = useCallback(() => {
    if (phase !== "pose") return;
    awardPoseXp(index);
    if (index >= slides.length - 1) {
      finish();
      return;
    }
    const upcoming = slides[index + 1];
    const isSideChange =
      current.side === 1 &&
      upcoming.side === 2 &&
      current.movement.id === upcoming.movement.id;
    setPhase("transition");
    setSecondsLeft(YOGA_TRANSITION_SECONDS);
    setRunning(true);
    navigator.vibrate?.(isSideChange ? [45, 40, 90] : 30);
    void playTick();
  }, [awardPoseXp, current, finish, index, phase, playTick, slides]);

  const goPrevious = useCallback(() => {
    if (phase === "ready" || phase === "finished") return;
    if (phase === "transition") {
      startSlide(index);
      return;
    }
    if (index > 0) startSlide(index - 1);
  }, [index, phase, startSlide]);

  useEffect(() => {
    if (!running) return;

    if (phase === "pose") {
      if (secondsLeft === 0) {
        if (mode === "timed") beginTransition();
        return;
      }
      const timerId = window.setTimeout(
        () => setSecondsLeft((value) => Math.max(0, value - 1)),
        1000
      );
      return () => window.clearTimeout(timerId);
    }

    if (phase === "transition") {
      const timerId = window.setTimeout(() => {
        if (secondsLeft <= 1) {
          startSlide(index + 1);
          return;
        }
        setSecondsLeft((value) => value - 1);
        void playTick();
      }, 1000);
      return () => window.clearTimeout(timerId);
    }
  }, [
    beginTransition,
    index,
    mode,
    phase,
    playTick,
    running,
    secondsLeft,
    startSlide
  ]);

  useEffect(() => {
    if (phase === "pose" || phase === "transition") void keepScreenAwake();
    else void allowScreenSleep();
    return () => {
      void allowScreenSleep();
    };
  }, [phase]);

  useEffect(
    () => () => {
      const context = audioContext.current;
      if (context && context.state !== "closed") void context.close();
    },
    []
  );

  useEffect(() => {
    const audio = new Audio(selectedMusic.src);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = data.preferences.stretchMusicVolume / 100;
    musicAudio.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      if (musicAudio.current === audio) musicAudio.current = null;
    };
  }, [selectedMusic.src]);

  useEffect(() => {
    const audio = musicAudio.current;
    if (!audio) return;
    audio.volume = data.preferences.stretchMusicVolume / 100;
    const shouldPlay =
      data.preferences.stretchMusicEnabled &&
      running &&
      (phase === "pose" || phase === "transition");
    if (shouldPlay) {
      void audio.play().catch(() => {
        // The player remains usable if the WebView blocks media playback.
      });
    } else {
      audio.pause();
    }
  }, [
    data.preferences.stretchMusicEnabled,
    data.preferences.stretchMusicVolume,
    phase,
    running,
    selectedMusic.src
  ]);

  const startClass = useCallback(() => {
    if (completed.current || phase !== "ready") return;
    if (yogaClass.safetyGate && !recoveryConfirmed) return;
    completed.current = false;
    if (!contextual) awardedSlides.current.clear();
    setPoseReward(null);
    startedAt.current = Date.now();
    void ensureAudio();
    startSlide(0);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [contextual, ensureAudio, phase, recoveryConfirmed, startSlide, yogaClass.safetyGate]);

  const skipBeforeRunWarmup = useCallback(() => {
    if (!isBeforeRunning) return;
    if (returnToRunningPreparation) {
      const runSession = loadRunSession();
      if (runSession?.stage === "prep") {
        const skipped = skipRunPrepStep(runSession);
        if (skipped?.step.id === "stretches") saveRunSession(skipped.next);
      }
      navigate({ name: "running" });
      return;
    }
    navigate({ name: "running", startMode: "just" });
  }, [isBeforeRunning, navigate, returnToRunningPreparation]);

  useEffect(() => () => {
    if (poseRewardTimer.current) window.clearTimeout(poseRewardTimer.current);
  }, []);

  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    autoStarted.current = true;
    startClass();
  }, [autoStart, startClass]);

  const chooseMode = (nextMode: AdvanceMode) => {
    setMode(nextMode);
  };

  const toggleSound = () => {
    setSoundEnabled((enabled) => {
      if (!enabled) void ensureAudio();
      return !enabled;
    });
  };

  const chooseMusic = (trackId: AppData["preferences"]["stretchMusicTrack"]) => {
    setData((currentData) => ({
      ...currentData,
      preferences: {
        ...currentData.preferences,
        stretchMusicEnabled: true,
        stretchMusicTrack: trackId
      }
    }));
  };

  const toggleMusic = () => {
    setData((currentData) => ({
      ...currentData,
      preferences: {
        ...currentData.preferences,
        stretchMusicEnabled: !currentData.preferences.stretchMusicEnabled
      }
    }));
  };

  const openGuidance = () => {
    settingsMenu.current?.removeAttribute("open");
    setGuidanceOpen(true);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (
      mode !== "tap" ||
      phase !== "pose" ||
      !running ||
      isInteractiveTarget(event.target)
    ) {
      pointerStart.current = null;
      return;
    }
    pointerStart.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      at: performance.now()
    };
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (
      !start ||
      start.id !== event.pointerId ||
      mode !== "tap" ||
      phase !== "pose" ||
      !running ||
      isInteractiveTarget(event.target)
    ) {
      return;
    }

    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    const duration = performance.now() - start.at;
    const now = performance.now();
    if (distance <= 12 && duration < 600 && now - lastTapAdvance.current >= 350) {
      lastTapAdvance.current = now;
      beginTransition();
    }
  };

  if (phase === "ready") {
    return (
      <GuidedClassIntro
        yogaClass={yogaClass}
        slides={slides}
        tracks={STRETCH_MUSIC}
        selectedTrack={selectedMusic.id}
        musicEnabled={data.preferences.stretchMusicEnabled}
        volume={data.preferences.stretchMusicVolume}
        onTrack={trackId => {
          const track = STRETCH_MUSIC.find(item => item.id === trackId);
          if (track) chooseMusic(track.id);
        }}
        onToggleMusic={toggleMusic}
        onVolume={volume => setData(currentData => ({
          ...currentData,
          preferences: { ...currentData.preferences, stretchMusicVolume: volume }
        }))}
        confirmed={recoveryConfirmed}
        onConfirm={setRecoveryConfirmed}
        onStart={startClass}
        onSkip={isBeforeRunning ? skipBeforeRunWarmup : undefined}
        skipLabel={`Skip warm-up ${returnToRunningPreparation ? "and continue prep" : "and start Just Run"}`}
      />
    );
  }

  if (phase === "finished") {
    return (
      <section className="completion-screen yoga-completion">
        <span className="completion-mark"><Check /></span>
        <span className="eyebrow">{returnToBikeQuest === "pre-stretch-complete" || returnToRunningPreparation ? "Warm-up complete" : returnToBikeQuest === "post-stretch-complete" ? "Cool-down complete" : "Yoga class complete"}</span>
        <h1>{yogaClass.name} logged.</h1>
        <p>{slides.length} {isBeforeRunning ? "movements" : "poses"} completed</p>
        <div className="completion-reward-burst">
          <Award />
          <span><strong>+{earnedXp} XP</strong><small>Saved</small></span>
        </div>
        <div className="completion-next-actions">
          <button className="button primary full" disabled={!completionReceipt} onClick={() => navigate(
            returnToBikeQuest ? { name: "bike-quest", resume: returnToBikeQuest }
              : returnToRunningPreparation ? { name: "running" } : { name: "home" }
          )}>
            {returnToBikeQuest ? "Continue Bike Quest" : returnToRunningPreparation ? "Continue run preparation" : "Done"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div
      className={`stretch-player yoga-player screen-stack ${mode === "tap" ? "tap-ready" : ""}`}
      onPointerDownCapture={handlePointerDown}
      onPointerUpCapture={handlePointerUp}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
    >
      <div className="player-topline" data-no-advance>
        <button
          className="yoga-player-exit"
          onClick={() => navigate({ name: "yoga" })}
          aria-label="Exit class"
        >
          <ArrowLeft size={18} /> Exit
        </button>
        {isBeforeRunning ? (
          <button className="yoga-player-skip" onClick={skipBeforeRunWarmup}>
            Skip warm-up
          </button>
        ) : null}
        <div
          className="player-progress-rail"
          role="progressbar"
          aria-label={`${isBeforeRunning ? "Movement" : "Pose"} ${current.stepNumber} of ${current.totalSteps}`}
          aria-valuemin={1}
          aria-valuemax={current.totalSteps}
          aria-valuenow={current.stepNumber}
        >
          <span style={{ width: `${(current.stepNumber / current.totalSteps) * 100}%` }} />
        </div>
        <details className="player-settings" ref={settingsMenu}>
          <summary aria-label="Open class controls">
            <EllipsisVertical size={20} />
          </summary>
          <div className="player-settings-panel">
            <div className="player-class-info">
              <span>With Mark · {yogaClass.timing}</span>
              <strong>{yogaClass.name}</strong>
              <small>{current.stepNumber} of {current.totalSteps}</small>
            </div>
            <button className="player-guidance-action" type="button" onClick={openGuidance}>
              <Info size={17} />
              <span><strong>{isBeforeRunning ? "Movement" : "Pose"} guidance</strong><small>Setup, sensation and target muscles</small></span>
            </button>
            <span className="player-settings-label">Class controls</span>
            <div className="segmented two mode-picker" aria-label="Advance mode">
              <button
                className={mode === "timed" ? "active" : ""}
                onClick={() => chooseMode("timed")}
              >
                <Timer size={16} /> Timed
              </button>
              <button className={mode === "tap" ? "active" : ""} onClick={() => chooseMode("tap")}>
                <Touchpad size={16} /> Tap
              </button>
            </div>
            <div className="player-setting-row">
              <span><Volume2 size={16} /> Class sounds</span>
              <button
                className="player-setting-action"
                onClick={toggleSound}
                aria-label={soundEnabled ? "Mute yoga sounds" : "Turn on yoga sounds"}
                aria-pressed={soundEnabled}
              >
                {soundEnabled ? "On" : "Off"}
              </button>
            </div>
            <div className="player-setting-section">
              <span className="player-settings-label">Soundtrack</span>
              <div className="player-track-picker">
                {STRETCH_MUSIC.map((track) => (
                  <button
                    key={track.id}
                    className={
                      data.preferences.stretchMusicEnabled && selectedMusic.id === track.id
                        ? "active"
                        : ""
                    }
                    onClick={() => chooseMusic(track.id)}
                  >
                    <Music2 size={15} /> {track.name}
                  </button>
                ))}
              </div>
              <div className="player-setting-row player-volume-row">
                <label htmlFor="active-stretch-volume">Volume</label>
                <input
                  id="active-stretch-volume"
                  type="range"
                  min="0"
                  max="70"
                  value={data.preferences.stretchMusicVolume}
                  onChange={(event) =>
                    setData((currentData) => ({
                      ...currentData,
                      preferences: {
                        ...currentData.preferences,
                        stretchMusicVolume: Number(event.target.value)
                      }
                    }))
                  }
                  aria-label="Stretching music volume"
                />
                <button className="player-setting-action" onClick={toggleMusic}>
                  {data.preferences.stretchMusicEnabled ? "On" : "Off"}
                </button>
              </div>
            </div>
          </div>
        </details>
      </div>

      <section className={`pose-stage ${phase === "transition" ? "transition-stage" : ""}`}>
        {phase === "transition" && next ? (
          <div className="yoga-transition" role="status" aria-live="polite">
            <div className="pose-artwork">
              <MovementVisual movement={next.movement} mirrored={next.side === 2} />
            </div>
            <div className="pose-primary-meta">
              <div className="pose-name-line">
                <h1>{next.movement.name}</h1>
                <span>{changingSides ? "Switch sides" : next.side ? `Side ${next.side} of 2` : "Coming up"}</span>
              </div>
              <strong className="transition-countdown" aria-label={`${secondsLeft} seconds until the next ${guidedItem}`}>
                {secondsLeft}
              </strong>
            </div>
          </div>
        ) : (
          <>
            <div className="pose-artwork">
              <MovementVisual
                key={`${index}-${current.movement.id}`}
                movement={current.movement}
                mirrored={current.side === 2}
                playback={phase === "pose"}
                paused={!running}
                reducedMotion={data.preferences.reducedMotion}
              />
            </div>
            <div className="pose-primary-meta">
              <div className="pose-name-line">
                <h1>{current.movement.name}</h1>
                {current.label || current.side ? (
                  <span>{current.label ?? (["standing-quad-stretch", "wall-calf-stretch"].includes(current.movement.id)
                    ? current.side === 1 ? "Left leg" : "Right leg"
                    : `Side ${current.side} of 2`)}</span>
                ) : null}
              </div>
              <strong className="pose-clock" aria-label={`${secondsLeft} seconds remaining`}>
                {secondsLeft}s
              </strong>
            </div>
          </>
        )}
      </section>

      {poseReward ? (
        <div className="pose-xp-reward" role="status" aria-live="polite" key={poseReward.key}>
          <Award size={18} />
          <strong>+{poseReward.amount} XP</strong>
          <span>{isBeforeRunning ? "Movement" : "Stretch"} complete</span>
        </div>
      ) : null}

      <div className="flow-controls" data-no-advance>
        <button
          className="round-button small"
          onClick={goPrevious}
          disabled={phase === "transition" ? false : index === 0}
          aria-label={`Previous ${guidedItem}`}
        >
          <ChevronLeft />
        </button>
        <button
          className="round-button play"
          onClick={() => setRunning((value) => !value)}
          aria-label={running ? "Pause class" : "Resume class"}
        >
          {running ? <Pause /> : <Play fill="currentColor" />}
        </button>
        <button
          className="round-button small"
          onClick={beginTransition}
          disabled={phase === "transition"}
          aria-label={`Next ${guidedItem}`}
        >
          <ChevronRight />
        </button>
      </div>

      {guidanceOpen ? (
        <div
          className="pose-guidance-backdrop"
          data-no-advance
          onClick={() => setGuidanceOpen(false)}
        >
          <section
            className="pose-guidance-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pose-guidance-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pose-guidance-heading">
              <div>
                <span>{isBeforeRunning ? "Movement" : "Pose"} guidance</span>
                <h2 id="pose-guidance-title">{guidanceSlide.movement.name}</h2>
              </div>
              <button type="button" onClick={() => setGuidanceOpen(false)} aria-label="Close pose guidance">
                <X size={20} />
              </button>
            </div>
            <div className="pose-guidance-copy">
              <span>Setup</span>
              <p>{guidanceSlide.cue}</p>
            </div>
            <div className="pose-guidance-copy">
              <span>{guidanceSlide.movement.sensationKind === "stretch" ? "Where you should feel it" : "What should be working"}</span>
              <p>{guidanceSlide.movement.sensationCue}</p>
            </div>
            <div className="muscle-chips" aria-label="Target muscles">
              {guidanceSlide.movement.muscleGroups.map((muscle) => (
                <span key={muscle}>{muscle}</span>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
