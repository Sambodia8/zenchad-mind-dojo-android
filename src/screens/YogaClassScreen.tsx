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
  Clock3,
  EllipsisVertical,
  ExternalLink,
  Footprints,
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
import { addCompletedSession } from "../storage";
import type { AppData, Route } from "../types";
import type { BikeQuestResume } from "../bikeQuest";
import MovementVisual from "../components/MovementVisual";
import { playUiSfx } from "../uiSfx";
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
    note: "Soft, earthy and unhurried",
    src: "/assets/audio/soundscapes/grounding-music-a.ogg"
  },
  {
    id: "lofi",
    name: "Lo-fi Limber",
    note: "A gentle beat to move with",
    src: "/assets/audio/soundscapes/focused-attention-music-b.ogg"
  },
  {
    id: "sunrise",
    name: "Soft Sunrise",
    note: "Airy, warm and melodic",
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
  const [phase, setPhase] = useState<PlayerPhase>("ready");
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(slides[0].seconds);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<AdvanceMode>("timed");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  const [poseReward, setPoseReward] = useState<{ amount: number; key: number } | null>(null);
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  const pointerStart = useRef<PointerStart | null>(null);
  const lastTapAdvance = useRef(0);
  const startedAt = useRef<number | null>(null);
  const completed = useRef(false);
  const awardedSlides = useRef<Set<number>>(new Set());
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
  const changingSides =
    phase === "transition" &&
    current.side === 1 &&
    next?.side === 2 &&
    current.movement.id === next.movement.id;
  const guidanceSlide = phase === "transition" && next ? next : current;

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
    setData((currentData) => ({
      ...currentData,
      stats: addRunningXp(currentData.stats, POSE_XP)
    }));
    setPoseReward({ amount: POSE_XP, key: slideIndex });
    if (poseRewardTimer.current) window.clearTimeout(poseRewardTimer.current);
    poseRewardTimer.current = window.setTimeout(() => setPoseReward(null), 1300);
    if (data.preferences.uiSoundsEnabled && soundEnabled) playUiSfx("xpGain");
  }, [data.preferences.uiSoundsEnabled, setData, soundEnabled]);

  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    const elapsed = Math.max(
      1,
      Math.round((Date.now() - (startedAt.current ?? Date.now())) / 1000)
    );
    const completionXp = 10 + Math.max(0, Math.floor(elapsed / 60));
    setEarnedXp(slides.length * POSE_XP + completionXp);
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
    setData((currentData) => {
      const completedStats = addCompletedSession(currentData.stats, elapsed);
      const statsWithRunningPrep = addRunningXp(completedStats, runningPrepXp + completionXp);
      return {
        ...currentData,
        stats: {
          ...statsWithRunningPrep,
          yogaSessions: statsWithRunningPrep.yogaSessions + 1
        }
      };
    });
    navigator.vibrate?.([60, 50, 100]);
    if (data.preferences.uiSoundsEnabled) {
      playUiSfx("victory");
    }
  }, [data.preferences.uiSoundsEnabled, returnToRunningPreparation, setData, slides.length]);

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
    if (yogaClass.safetyGate && !recoveryConfirmed) return;
    completed.current = false;
    awardedSlides.current.clear();
    setPoseReward(null);
    startedAt.current = Date.now();
    void ensureAudio();
    startSlide(0);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [ensureAudio, recoveryConfirmed, startSlide, yogaClass.safetyGate]);

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
      <div className="screen-stack yoga-ready">
        <section className="yoga-ready-portrait yoga-class-cover">
          <img src={yogaClass.image} alt={`Mark ready to teach ${yogaClass.name}`} />
          <span>With Mark · {yogaClass.timing}</span>
        </section>
        <section className="card yoga-ready-copy">
          <span className="eyebrow">{yogaClass.timing}</span>
          <h1>{yogaClass.name}</h1>
          <div className="yoga-ready-meta">
            <span><Clock3 size={16} /> {formatDuration(getYogaClassDuration(yogaClass))}</span>
            <span>{slides.length} guided poses</span>
          </div>
          <p>{yogaClass.description}</p>
          <div className="routine-focus" aria-label="Focus muscles">
            {yogaClass.focusMuscles.map((muscle) => (
              <span key={muscle}>{muscle}</span>
            ))}
          </div>
          <details className="routine-evidence yoga-detail-evidence">
            <summary>Why this class?</summary>
            <p>{yogaClass.evidence}</p>
            {yogaClass.sourceUrl ? (
              <a href={yogaClass.sourceUrl} target="_blank" rel="noreferrer">
                Read the guidance <ExternalLink size={13} />
              </a>
            ) : null}
          </details>
          <p className="yoga-audio-note">
            A chime starts every pose. Five quiet clock ticks give you time to move into the
            next position.
          </p>
        </section>

        <section className="card stretch-soundtrack-card">
          <div className="section-row">
            <div>
              <span className="eyebrow">Your movement soundtrack</span>
              <h2>Choose the energy</h2>
            </div>
            <Music2 />
          </div>
          <div className="stretch-track-picker" aria-label="Stretching soundtrack">
            {STRETCH_MUSIC.map((track) => (
              <button
                key={track.id}
                className={
                  data.preferences.stretchMusicEnabled &&
                  selectedMusic.id === track.id
                    ? "active"
                    : ""
                }
                onClick={() => chooseMusic(track.id)}
              >
                <Music2 size={17} />
                <span>
                  <strong>{track.name}</strong>
                  <small>{track.note}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="stretch-volume-row">
            <button className="button ghost" onClick={toggleMusic}>
              {data.preferences.stretchMusicEnabled ? (
                <><Volume2 size={17} /> Music on</>
              ) : (
                <><VolumeX size={17} /> Music off</>
              )}
            </button>
            <label>
              <span>Volume</span>
              <input
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
            </label>
          </div>
        </section>

        {yogaClass.safetyGate ? (
          <section className="card recovery-gate" aria-labelledby="recovery-title">
            <span className="eyebrow">Safety check</span>
            <h2 id="recovery-title">This is not for a new or acute injury</h2>
            <p>
              Do not begin if you have severe or worsening pain, cannot bear weight, have
              numbness, a changed shape or colour, or major swelling. Seek medical advice
              instead.
            </p>
            <a href={yogaClass.sourceUrl} target="_blank" rel="noreferrer">
              Read NHS sprain and strain guidance
            </a>
            <label>
              <input
                type="checkbox"
                checked={recoveryConfirmed}
                onChange={(event) => setRecoveryConfirmed(event.target.checked)}
              />
              <span>My soreness is mild, recovering, and comfortable enough for gentle movement.</span>
            </label>
          </section>
        ) : null}

        <button
          className="button primary full yoga-start-button"
          onClick={startClass}
          disabled={Boolean(yogaClass.safetyGate && !recoveryConfirmed)}
        >
          <Play size={18} fill="currentColor" /> Start class with Mark
        </button>
        {isBeforeRunning ? (
          <button className="button secondary full yoga-skip-before-run" onClick={skipBeforeRunWarmup}>
            Skip warm-up {returnToRunningPreparation ? "and continue prep" : "and start Just Run"}
          </button>
        ) : null}
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <section className="completion-screen yoga-completion">
        <span className="completion-mark"><Check /></span>
        <span className="eyebrow">Yoga class complete</span>
        <h1>{yogaClass.name} logged.</h1>
        <p>
          {returnToRunningPreparation
            ? `${slides.length} guided poses added to your progress. Your warm-up is banked and the next preparation step is ready.`
            : isBeforeRunning
              ? `${slides.length} guided poses added to your progress. Your legs are warm. Choose a run, or browse another running class.`
            : `${slides.length} guided poses added to your progress. Your session is logged — choose what you want to do next.`}
        </p>
        <div className="completion-reward-burst">
          <Award />
          <span><strong>+{earnedXp} XP</strong><small>Quest progress updated</small></span>
        </div>
        <div className="completion-next-actions">
          {returnToRunningPreparation ? (
            <button
              className="button primary full"
              onClick={() => navigate({ name: "running" })}
            >
              Continue run preparation
            </button>
          ) : null}
          {isBeforeRunning ? (
            <>
              <button
                className={`button ${returnToRunningPreparation ? "secondary" : "primary"} full`}
                onClick={() => navigate({ name: "running", startMode: "just" })}
              >
                <Footprints size={18} /> Start Just Run
              </button>
              <button
                className="button ghost full"
                onClick={() => navigate({ name: "yoga", mode: "classes" })}
              >
                Browse running classes
              </button>
            </>
          ) : null}
          {!returnToRunningPreparation && !isBeforeRunning ? (
            <>
              <button
                className="button primary full"
                onClick={() => navigate({ name: "yoga", mode: "classes" })}
              >
                Browse yoga classes
              </button>
              <button
                className="button ghost full"
                onClick={() =>
                  navigate(
                    returnToBikeQuest
                      ? { name: "bike-quest", resume: returnToBikeQuest }
                      : { name: "home" }
                  )
                }
              >
                {returnToBikeQuest ? "Continue Bike Quest" : "Done for now"}
              </button>
            </>
          ) : null}
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
          aria-label={`Pose ${current.stepNumber} of ${current.totalSteps}`}
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
              <span><strong>Pose guidance</strong><small>Setup, sensation and target muscles</small></span>
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
              <strong className="transition-countdown" aria-label={`${secondsLeft} seconds until the next pose`}>
                {secondsLeft}
              </strong>
            </div>
          </div>
        ) : (
          <>
            <div className="pose-artwork">
              <MovementVisual movement={current.movement} mirrored={current.side === 2} />
            </div>
            <div className="pose-primary-meta">
              <div className="pose-name-line">
                <h1>{current.movement.name}</h1>
                {current.label || current.side ? (
                  <span>{current.label ?? `Side ${current.side} of 2`}</span>
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
          <span>Stretch complete</span>
        </div>
      ) : null}

      <div className="flow-controls" data-no-advance>
        <button
          className="round-button small"
          onClick={goPrevious}
          disabled={phase === "transition" ? false : index === 0}
          aria-label="Previous pose"
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
          aria-label="Next pose"
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
                <span>Pose guidance</span>
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
