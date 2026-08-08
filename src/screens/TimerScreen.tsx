import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction
} from "react";
import { App } from "@capacitor/app";
import {
  Award,
  Bell,
  BellOff,
  BookOpen,
  Check,
  ChevronRight,
  Music2,
  Pause,
  Play,
  RotateCcw,
  SkipForward
} from "lucide-react";
import { MEDITATIONS } from "../data";
import {
  chooseGuidedAudioVariant,
  rememberGuidedAudioVariant
} from "../guidedAudio";
import { GaplessAudioLoop } from "../gaplessAudioLoop";
import {
  chooseNamasteEnding,
  rememberNamasteEnding
} from "../namasteAudio";
import {
  chooseMeditationMusic,
  rememberMeditationMusic
} from "../soundscapeAudio";
import {
  allowScreenSleep,
  cancelTimerNotifications,
  keepScreenAwake,
  requestNotificationPermission,
  scheduleTimerNotifications
} from "../native";
import { recordMysteryMeditation } from "../mysteryChallenge";
import { addCompletedSession, makeMood } from "../storage";
import type { AppData, Meditation, MysteryMeditationCategory, Route } from "../types";
import { playUiSfx } from "../uiSfx";

interface Props {
  meditationId: string;
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  navigate: Dispatch<SetStateAction<Route>>;
  mysteryCategory?: MysteryMeditationCategory;
  mysteryRunId?: string;
}

type AlertSound = "reverse-chime" | "bell" | "gong" | "digital" | "none";

interface PersistedTimer {
  meditationId: string;
  guidedAudioId?: string;
  meditationMusicId?: string;
  namasteEndingId?: string;
  phaseIndex: number;
  remaining: number;
  running: boolean;
  started: boolean;
  completed: boolean;
  deadline: number | null;
  elapsedSeconds: number;
  savedAt: number;
}

const ACTIVE_TIMER_KEY = "zenchad_active_timer_v1";

function formatClock(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  return `${minutes}:${String(Math.max(0, seconds) % 60).padStart(2, "0")}`;
}

function playCue(sound: AlertSound) {
  if (sound === "none") return;
  try {
    if (sound === "reverse-chime") {
      const audio = new Audio("assets/audio/ui/reverse-glockenspiel-chime.ogg");
      audio.volume = 0.65;
      void audio.play();
      return;
    }
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = sound === "gong" ? "sawtooth" : sound === "digital" ? "square" : "sine";
    oscillator.frequency.setValueAtTime(sound === "gong" ? 180 : sound === "digital" ? 720 : 660, now);
    oscillator.frequency.exponentialRampToValueAtTime(sound === "gong" ? 80 : 330, now + 1.3);
    gain.gain.setValueAtTime(sound === "digital" ? 0.06 : 0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (sound === "digital" ? 0.25 : 1.5));
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(now + (sound === "digital" ? 0.25 : 1.5));
  } catch {
    // The visual timer remains reliable if Web Audio is unavailable.
  }
}

function restoreTimer(meditation: Meditation): PersistedTimer {
  const fallback: PersistedTimer = {
    meditationId: meditation.id,
    phaseIndex: 0,
    remaining: meditation.phases[0].duration,
    running: false,
    started: false,
    completed: false,
    deadline: null,
    elapsedSeconds: 0,
    savedAt: Date.now()
  };

  try {
    const raw = localStorage.getItem(ACTIVE_TIMER_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as PersistedTimer;
    if (
      saved.meditationId !== meditation.id ||
      saved.phaseIndex < 0 ||
      saved.phaseIndex >= meditation.phases.length
    ) {
      return fallback;
    }

    if (!saved.running || !saved.deadline) return saved;

    const now = Date.now();
    let phaseIndex = saved.phaseIndex;
    let deadline = saved.deadline;
    while (now >= deadline && phaseIndex < meditation.phases.length - 1) {
      phaseIndex += 1;
      deadline += meditation.phases[phaseIndex].duration * 1000;
    }
    const completed = now >= deadline && phaseIndex === meditation.phases.length - 1;
    return {
      ...saved,
      phaseIndex,
      deadline: completed ? null : deadline,
      remaining: completed ? 0 : Math.max(1, Math.ceil((deadline - now) / 1000)),
      completed,
      running: !completed,
      elapsedSeconds: saved.elapsedSeconds + Math.max(0, Math.floor((now - saved.savedAt) / 1000)),
      savedAt: now
    };
  } catch {
    return fallback;
  }
}

export default function TimerScreen({
  meditationId,
  data,
  setData,
  navigate,
  mysteryCategory,
  mysteryRunId
}: Props) {
  const meditation = MEDITATIONS.find((item) => item.id === meditationId) ?? MEDITATIONS[0];
  const restored = useMemo(() => restoreTimer(meditation), [meditation]);
  const [guidedAudio, setGuidedAudio] = useState(() =>
    chooseGuidedAudioVariant(meditation.id, restored.guidedAudioId)
  );
  const [meditationMusic, setMeditationMusic] = useState(() =>
    chooseMeditationMusic(meditation.id, restored.meditationMusicId)
  );
  const [namasteEnding, setNamasteEnding] = useState(() =>
    chooseNamasteEnding(restored.namasteEndingId)
  );
  const [phaseIndex, setPhaseIndex] = useState(restored.phaseIndex);
  const [remaining, setRemaining] = useState(restored.remaining);
  const [running, setRunning] = useState(restored.running);
  const [started, setStarted] = useState(restored.started);
  const [completed, setCompleted] = useState(restored.completed);
  const [sound, setSound] = useState<AlertSound>("reverse-chime");
  const [afterMood, setAfterMood] = useState(5);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [musicUnavailable, setMusicUnavailable] = useState(false);
  const [musicReady, setMusicReady] = useState(false);
  const elapsedRef = useRef(restored.elapsedSeconds);
  const deadlineRef = useRef<number | null>(restored.deadline);
  const lastClockReadRef = useRef(Date.now());
  const finishingRef = useRef(false);
  const guidedAudioRef = useRef<HTMLAudioElement | null>(null);
  const meditationMusicRef = useRef<GaplessAudioLoop | null>(null);
  const namasteAudioRef = useRef<HTMLAudioElement | null>(null);
  const completionSavedRef = useRef(false);
  const mysteryMode = Boolean(mysteryCategory && mysteryRunId);
  const currentPhase = meditation.phases[phaseIndex];
  const totalDuration = meditation.phases.reduce((sum, item) => sum + item.duration, 0);
  const elapsedBefore = meditation.phases
    .slice(0, phaseIndex)
    .reduce((sum, item) => sum + item.duration, 0);
  const progress = Math.min(
    100,
    ((elapsedBefore + currentPhase.duration - remaining) / totalDuration) * 100
  );

  const syncGuidedAudio = useCallback(
    (elapsedSeconds: number, shouldPlay: boolean) => {
      const audio = guidedAudioRef.current;
      if (!audio || audioUnavailable) return;
      const target = Math.min(totalDuration, Math.max(0, elapsedSeconds));
      audio.volume = Math.min(1, Math.max(0, data.preferences.voiceVolume / 100));
      if (!Number.isFinite(audio.currentTime) || Math.abs(audio.currentTime - target) > 0.45) {
        audio.currentTime = target;
      }
      if (shouldPlay && audio.paused) {
        void audio.play().catch(() => setAudioUnavailable(true));
      } else if (!shouldPlay && !audio.paused) {
        audio.pause();
      }
    },
    [audioUnavailable, data.preferences.voiceVolume, totalDuration]
  );

  const syncMeditationMusic = useCallback(
    (elapsedSeconds: number, shouldPlay: boolean) => {
      const audio = meditationMusicRef.current;
      if (!audio || musicUnavailable) return;
      audio.setVolume(data.preferences.meditationMusicVolume / 100);
      const enabled = data.preferences.meditationMusicEnabled
        && data.preferences.meditationMusicVolume > 0;
      audio.sync(elapsedSeconds, shouldPlay && enabled);
    },
    [
      data.preferences.meditationMusicEnabled,
      data.preferences.meditationMusicVolume,
      musicUnavailable
    ]
  );

  useEffect(() => {
    if (!guidedAudio) return;
    setAudioUnavailable(false);
    const audio = new Audio(guidedAudio.src);
    audio.preload = "auto";
    audio.volume = Math.min(1, Math.max(0, data.preferences.voiceVolume / 100));
    const handleError = () => setAudioUnavailable(true);
    audio.addEventListener("error", handleError);
    guidedAudioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeEventListener("error", handleError);
      audio.removeAttribute("src");
      audio.load();
      guidedAudioRef.current = null;
    };
  }, [guidedAudio]);

  useEffect(() => {
    if (!meditationMusic) return;
    let cancelled = false;
    setMusicUnavailable(false);
    setMusicReady(false);
    void GaplessAudioLoop.load(
      meditationMusic.src,
      data.preferences.meditationMusicVolume / 100,
      () => setMusicUnavailable(true)
    ).then((audio) => {
      if (cancelled) {
        audio.dispose();
        return;
      }
      meditationMusicRef.current = audio;
      setMusicReady(true);
    }).catch(() => {
      if (!cancelled) setMusicUnavailable(true);
    });
    return () => {
      cancelled = true;
      meditationMusicRef.current?.dispose();
      meditationMusicRef.current = null;
      setMusicReady(false);
    };
  }, [meditationMusic]);

  useEffect(() => {
    const audio = new Audio(namasteEnding.src);
    audio.preload = "auto";
    audio.volume = Math.min(1, Math.max(0, data.preferences.voiceVolume / 100));
    namasteAudioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (namasteAudioRef.current === audio) namasteAudioRef.current = null;
    };
  }, [namasteEnding]);

  useEffect(() => {
    if (guidedAudioRef.current) {
      guidedAudioRef.current.volume = Math.min(1, Math.max(0, data.preferences.voiceVolume / 100));
    }
  }, [data.preferences.voiceVolume]);

  useEffect(() => {
    if (meditationMusicRef.current) {
      meditationMusicRef.current.setVolume(data.preferences.meditationMusicVolume / 100);
    }
  }, [data.preferences.meditationMusicVolume]);

  useEffect(() => {
    if (namasteAudioRef.current) {
      namasteAudioRef.current.volume = Math.min(
        1,
        Math.max(0, data.preferences.voiceVolume / 100)
      );
    }
  }, [data.preferences.voiceVolume]);

  useEffect(() => {
    const elapsed = elapsedBefore + currentPhase.duration - remaining;
    syncGuidedAudio(elapsed, Boolean(guidedAudio && running && started && !completed));
  }, [
    completed,
    currentPhase.duration,
    elapsedBefore,
    guidedAudio,
    remaining,
    running,
    started,
    syncGuidedAudio
  ]);

  useEffect(() => {
    const elapsed = elapsedBefore + currentPhase.duration - remaining;
    syncMeditationMusic(
      elapsed,
      Boolean(meditationMusic && running && started && !completed)
    );
  }, [
    completed,
    currentPhase.duration,
    elapsedBefore,
    meditationMusic,
    musicReady,
    remaining,
    running,
    started,
    syncMeditationMusic
  ]);

  const buildNotificationTimeline = useCallback(
    (startIndex: number, firstRemaining: number) => {
      let boundaryTime = Date.now() + firstRemaining * 1000;
      return meditation.phases.slice(startIndex).map((phase, offset) => {
        const absoluteIndex = startIndex + offset;
        const isLast = absoluteIndex === meditation.phases.length - 1;
        const boundary = {
          at: new Date(boundaryTime),
          title: isLast ? "Meditation complete" : `Next: ${meditation.phases[absoluteIndex + 1].name}`,
          body: isLast
            ? "Take your time returning."
            : meditation.phases[absoluteIndex + 1].instruction
        };
        if (!isLast) boundaryTime += meditation.phases[absoluteIndex + 1].duration * 1000;
        return boundary;
      });
    },
    [meditation]
  );

  const scheduleCurrentTimeline = useCallback(
    (index: number, seconds: number) => {
      if (!data.preferences.timerAlertsEnabled) return;
      void scheduleTimerNotifications(buildNotificationTimeline(index, seconds));
    },
    [buildNotificationTimeline, data.preferences.timerAlertsEnabled]
  );

  const playNamasteEnding = useCallback(() => {
    const audio = namasteAudioRef.current;
    if (!audio || data.preferences.voiceVolume <= 0) {
      playCue(sound);
      return;
    }
    audio.currentTime = 0;
    audio.volume = Math.min(1, Math.max(0, data.preferences.voiceVolume / 100));
    void audio.play().catch(() => playCue(sound));
  }, [data.preferences.voiceVolume, sound]);

  const finish = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setRunning(false);
    setCompleted(true);
    deadlineRef.current = null;
    syncGuidedAudio(totalDuration, false);
    syncMeditationMusic(totalDuration, false);
    if (guidedAudio) playNamasteEnding();
    else playCue(sound);
    if (data.preferences.uiSoundsEnabled) {
      playUiSfx("victory");
      window.setTimeout(() => playUiSfx("xpGain"), 600);
    }
    navigator.vibrate?.([80, 60, 120]);
    localStorage.removeItem(ACTIVE_TIMER_KEY);
    void cancelTimerNotifications();
    void allowScreenSleep();
  }, [data.preferences.uiSoundsEnabled, guidedAudio, playNamasteEnding, sound, syncGuidedAudio, syncMeditationMusic, totalDuration]);

  const syncClock = useCallback(() => {
    if (!running || !deadlineRef.current || finishingRef.current) return;
    const now = Date.now();
    elapsedRef.current += Math.max(0, (now - lastClockReadRef.current) / 1000);
    lastClockReadRef.current = now;

    let nextIndex = phaseIndex;
    let nextDeadline = deadlineRef.current;
    while (now >= nextDeadline && nextIndex < meditation.phases.length - 1) {
      nextIndex += 1;
      nextDeadline += meditation.phases[nextIndex].duration * 1000;
    }

    if (now >= nextDeadline && nextIndex === meditation.phases.length - 1) {
      finish();
      return;
    }

    if (nextIndex !== phaseIndex) {
      setPhaseIndex(nextIndex);
      playCue(sound);
    }
    deadlineRef.current = nextDeadline;
    setRemaining(Math.max(1, Math.ceil((nextDeadline - now) / 1000)));
  }, [finish, meditation.phases, phaseIndex, running, sound]);

  useEffect(() => {
    if (!running || completed) return;
    const id = window.setInterval(syncClock, 250);
    return () => window.clearInterval(id);
  }, [completed, running, syncClock]);

  useEffect(() => {
    let listener: Awaited<ReturnType<typeof App.addListener>> | undefined;
    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) syncClock();
    }).then((handle) => {
      listener = handle;
    });
    return () => {
      void listener?.remove();
    };
  }, [syncClock]);

  useEffect(() => {
    if (running) void keepScreenAwake();
    else void allowScreenSleep();
    return () => {
      void allowScreenSleep();
    };
  }, [running]);

  useEffect(() => {
    if (!started || completed) return;
    const state: PersistedTimer = {
      meditationId: meditation.id,
      guidedAudioId: guidedAudio?.id,
      meditationMusicId: meditationMusic?.id,
      namasteEndingId: namasteEnding.id,
      phaseIndex,
      remaining,
      running,
      started,
      completed,
      deadline: deadlineRef.current,
      elapsedSeconds: elapsedRef.current,
      savedAt: Date.now()
    };
    localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(state));
  }, [
    completed,
    guidedAudio?.id,
    meditation.id,
    meditationMusic?.id,
    namasteEnding.id,
    phaseIndex,
    remaining,
    running,
    started
  ]);

  const startOrResume = () => {
    if (guidedAudio) rememberGuidedAudioVariant(meditation.id, guidedAudio.id);
    if (meditationMusic) rememberMeditationMusic(meditation.id, meditationMusic.id);
    rememberNamasteEnding(namasteEnding.id);
    const elapsed = elapsedBefore + currentPhase.duration - remaining;
    syncGuidedAudio(elapsed, Boolean(guidedAudio));
    syncMeditationMusic(elapsed, Boolean(meditationMusic));
    setStarted(true);
    setRunning(true);
    lastClockReadRef.current = Date.now();
    deadlineRef.current = Date.now() + remaining * 1000;
    scheduleCurrentTimeline(phaseIndex, remaining);
  };

  const pause = () => {
    syncClock();
    const elapsed = elapsedBefore + currentPhase.duration - remaining;
    syncGuidedAudio(elapsed, false);
    syncMeditationMusic(elapsed, false);
    setRunning(false);
    deadlineRef.current = null;
    void cancelTimerNotifications();
  };

  const toggleRunning = () => {
    if (running) pause();
    else startOrResume();
  };

  const jumpToPhase = (index: number) => {
    const duration = meditation.phases[index].duration;
    const elapsedAtPhase = meditation.phases
      .slice(0, index)
      .reduce((sum, phase) => sum + phase.duration, 0);
    elapsedRef.current = elapsedAtPhase;
    setPhaseIndex(index);
    setRemaining(duration);
    setStarted(true);
    playCue(sound);
    if (running) {
      lastClockReadRef.current = Date.now();
      deadlineRef.current = Date.now() + duration * 1000;
      scheduleCurrentTimeline(index, duration);
    }
  };

  const nextPhase = () => {
    if (phaseIndex >= meditation.phases.length - 1) {
      finish();
      return;
    }
    jumpToPhase(phaseIndex + 1);
  };

  const reset = () => {
    setRunning(false);
    setStarted(false);
    setCompleted(false);
    setPhaseIndex(0);
    setRemaining(meditation.phases[0].duration);
    elapsedRef.current = 0;
    syncGuidedAudio(0, false);
    syncMeditationMusic(0, false);
    namasteAudioRef.current?.pause();
    deadlineRef.current = null;
    finishingRef.current = false;
    setGuidedAudio(chooseGuidedAudioVariant(meditation.id));
    setMeditationMusic(chooseMeditationMusic(meditation.id));
    setNamasteEnding(chooseNamasteEnding());
    localStorage.removeItem(ACTIVE_TIMER_KEY);
    void cancelTimerNotifications();
    void allowScreenSleep();
  };

  const toggleTimerAlerts = async () => {
    if (data.preferences.timerAlertsEnabled) {
      setData((current) => ({
        ...current,
        preferences: { ...current.preferences, timerAlertsEnabled: false }
      }));
      setNotificationMessage("Background phase alerts turned off.");
      void cancelTimerNotifications();
      return;
    }

    const result = await requestNotificationPermission();
    if (!result.ok) {
      setNotificationMessage(result.reason ?? "Background alerts could not be enabled.");
      return;
    }
    setData((current) => ({
      ...current,
      preferences: { ...current.preferences, timerAlertsEnabled: true }
    }));
    setNotificationMessage("Background phase alerts enabled.");
    if (running) void scheduleTimerNotifications(buildNotificationTimeline(phaseIndex, remaining));
  };

  const saveCompletion = (destination: "progress" | "journal" = "progress") => {
    if (completionSavedRef.current) return;
    completionSavedRef.current = true;
    const creditedSeconds = Math.max(60, Math.round(elapsedRef.current));
    setData((current) => {
      const next = {
        ...current,
        stats: addCompletedSession(current.stats, creditedSeconds),
        moods: [makeMood("after", afterMood, `After ${meditation.name}`), ...current.moods]
      };
      if (mysteryCategory && mysteryRunId) {
        next.mysteryChallenge = recordMysteryMeditation(
          current.mysteryChallenge,
          mysteryRunId,
          { meditationId: meditation.id, category: mysteryCategory }
        );
      }
      return next;
    });
    navigate(
      mysteryMode
        ? { name: "mystery-challenge" }
        : destination === "journal"
          ? { name: "journal", draftMeditation: meditation.name }
          : { name: "progress" }
    );
  };

  if (completed) {
    const creditedSeconds = Math.max(60, Math.round(elapsedRef.current));
    const completionXp = 50 + Math.max(1, Math.floor(creditedSeconds / 6));
    return (
      <section className="completion-screen">
        <span className="completion-mark"><Check /></span>
        <span className="eyebrow">Session complete</span>
        <h1>Mind reps logged.</h1>
        <p>{meditation.name} · {Math.ceil(totalDuration / 60)} minutes</p>
        <div className="completion-reward-burst">
          <Award />
          <span><strong>+{completionXp} XP</strong><small>Ready to collect</small></span>
        </div>
        <div className="card after-mood">
          <h3>How do you feel now?</h3>
          <div className="mood-labels">
            <span>0 · hardest</span><span>5 · neutral</span><span>10 · best</span>
          </div>
          <input
            className="mood-slider"
            type="range"
            min="0"
            max="10"
            step="1"
            value={afterMood}
            onChange={(event) => setAfterMood(Number(event.target.value))}
          />
          <strong className="current-mood">{afterMood}/10</strong>
        </div>
        <button className="button primary full" onClick={() => saveCompletion("progress")}>
          {mysteryMode ? "Mark meditation complete" : "Save session & view progress"}
        </button>
        <button className="button secondary full" onClick={() => saveCompletion("journal")}>
          <BookOpen size={17} /> {mysteryMode ? "Return to the sequence" : "Save session & journal it"}
        </button>
        <button className="button ghost full" onClick={reset}><RotateCcw size={17} /> Do it again</button>
      </section>
    );
  }

  return (
    <div className={`timer-screen screen-stack ${meditation.id === "trataka" ? "candle-session" : ""}`}>
      <section className="page-intro centred">
        <span className="eyebrow">{meditation.category} practice</span>
        <h1>{meditation.name}</h1>
        <p>{meditation.benefit}</p>
      </section>

      {meditation.id === "trataka" && (
        <div className={`virtual-candle ${currentPhase.kind === "rest" || currentPhase.kind === "finish" ? "dimmed" : ""}`}>
          <span className="flame-shape"><i /></span>
          <span className="wick" />
          <span className="candle-body" />
          <span className="candle-glow" />
        </div>
      )}

      <section className="timer-panel">
        <div
          className="timer-ring"
          style={{ "--progress": `${Math.max(0, progress) * 3.6}deg` } as CSSProperties}
        >
          <div>
            <small>{currentPhase.name}</small>
            <strong>{formatClock(remaining)}</strong>
            <span>{phaseIndex + 1} of {meditation.phases.length}</span>
          </div>
        </div>
        <h2>{currentPhase.instruction}</h2>
        <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        <div className="timer-controls">
          <button className="round-button small" onClick={reset} aria-label="Reset"><RotateCcw /></button>
          <button className="round-button play" onClick={toggleRunning} aria-label={running ? "Pause" : "Play"}>
            {running ? <Pause /> : <Play fill="currentColor" />}
          </button>
          <button className="round-button small" onClick={nextPhase} aria-label="Next phase"><SkipForward /></button>
        </div>
      </section>

      <section className="card settings-card">
        <div className="setting-row">
          <span>
            {data.preferences.timerAlertsEnabled ? <Bell /> : <BellOff />}
            Background phase alerts
          </span>
          <button
            className={`toggle ${data.preferences.timerAlertsEnabled ? "on" : ""}`}
            onClick={toggleTimerAlerts}
            aria-label="Toggle background phase alerts"
          >
            <span />
          </button>
        </div>
        <p className="setting-note">
          Alerts are opt-in and only announce phase changes or completion. Android may deliver them
          slightly late if precise alarms are restricted.
        </p>
        {notificationMessage && <small className="status-message">{notificationMessage}</small>}
        <label>
          Phase sound while the app is open
          <select value={sound} onChange={(event) => setSound(event.target.value as AlertSound)}>
            <option value="reverse-chime">Reverse glockenspiel</option>
            <option value="bell">Gentle bell</option>
            <option value="gong">Low gong</option>
            <option value="digital">Digital beep</option>
            <option value="none">Silent</option>
          </select>
        </label>
        {guidedAudio && !audioUnavailable ? (
          <>
            <p className="voice-waiting">
              Playing “{guidedAudio.title}”. Offline variants rotate between sessions and work
              without a connection.
            </p>
            <label>
              Voice volume
              <input
                type="range"
                min="0"
                max="100"
                value={data.preferences.voiceVolume}
                onChange={(event) =>
                  setData((current) => ({
                    ...current,
                    preferences: { ...current.preferences, voiceVolume: Number(event.target.value) }
                  }))
                }
              />
              <span>{data.preferences.voiceVolume}%</span>
            </label>
          </>
        ) : (
          <p className="voice-waiting">
            {guidedAudio
              ? "Offline voice guidance could not be loaded on this device."
              : "Spoken guidance is not yet available for this meditation."}
          </p>
        )}
        {meditationMusic && (
          <>
            <div className="setting-row">
              <span>
                <Music2 />
                Meditation music
              </span>
              <button
                className={`toggle ${data.preferences.meditationMusicEnabled ? "on" : ""}`}
                onClick={() =>
                  setData((current) => ({
                    ...current,
                    preferences: {
                      ...current.preferences,
                      meditationMusicEnabled: !current.preferences.meditationMusicEnabled
                    }
                  }))
                }
                aria-label="Toggle meditation music"
              >
                <span />
              </button>
            </div>
            <p className="voice-waiting">
              {musicUnavailable
                ? "Offline meditation music could not be loaded on this device."
                : `Playing “${meditationMusic.title}”. Music A and B alternate between sessions without repeating.`}
            </p>
            <label>
              Music volume
              <input
                type="range"
                min="0"
                max="100"
                value={data.preferences.meditationMusicVolume}
                onChange={(event) =>
                  setData((current) => ({
                    ...current,
                    preferences: {
                      ...current.preferences,
                      meditationMusicVolume: Number(event.target.value)
                    }
                  }))
                }
              />
              <span>{data.preferences.meditationMusicVolume}%</span>
            </label>
          </>
        )}
      </section>

      <section className="phase-list">
        {meditation.phases.map((phase, index) => (
          <button
            key={`${phase.name}-${index}`}
            className={index === phaseIndex ? "active" : index < phaseIndex ? "done" : ""}
            onClick={() => jumpToPhase(index)}
          >
            <span>{index < phaseIndex ? <Check size={16} /> : index + 1}</span>
            <div><strong>{phase.name}</strong><small>{formatClock(phase.duration)}</small></div>
            <ChevronRight size={17} />
          </button>
        ))}
      </section>
    </div>
  );
}
