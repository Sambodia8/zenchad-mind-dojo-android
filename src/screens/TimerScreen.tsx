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
  SkipForward,
  Wind
} from "lucide-react";
import { MEDITATIONS } from "../data";
import {
  chooseGuidedAudioVariant,
  rememberGuidedAudioVariant
} from "../guidedAudio";
import {
  buildMusicQueueIdsForCounter,
  readMusicCycleCounter,
  takeNextMusicCycleCounter
} from "../meditationMusicPlaylist";
import {
  chooseNamasteEnding,
  rememberNamasteEnding
} from "../namasteAudio";
import { musicTracksForMeditation, type MeditationMusicTrack } from "../soundscapeAudio";
import { StreamingMusicPlaylist } from "../streamingMusicPlaylist";
import {
  allowScreenSleep,
  cancelTimerNotifications,
  keepScreenAwake,
  requestNotificationPermission,
  scheduleTimerNotifications
} from "../native";
import { recordMysteryMeditation } from "../mysteryChallenge";
import { makeMood, recordMeditationCompletion } from "../storage";
import type { AppData, Meditation, MysteryMeditationCategory, Route } from "../types";
import { playUiSfx } from "../uiSfx";
import { XP_COLLECTION_DURATION } from "../components/XpCollectionAnimation";
import ZenPointsRewardFeedback from "../components/ZenPointsRewardFeedback";
import { zenPointsForMeditation } from "../zenPoints";
import { fiveMinuteMeditation } from "../meditationDuration";
import { BINAURAL_PLAYLISTS, hasMeditationOverlay, MeditationOverlay } from "../meditationOverlay";

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
  meditationMusicQueueIds?: string[];
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
      elapsedSeconds: Math.min(meditation.phases.reduce((sum, phase) => sum + phase.duration, 0),
        saved.elapsedSeconds + Math.max(0, Math.floor((now - saved.savedAt) / 1000))),
      savedAt: now
    };
  } catch {
    return fallback;
  }
}

export default function TimerScreen(props: Props) {
  const key = `zenchad_duration_${props.meditationId}`;
  const [shortSession, setShortSession] = useState(() => localStorage.getItem(key) === "5");
  return <MeditationTimer key={`${props.meditationId}-${shortSession}`} {...props}
    shortSession={shortSession} onDurationChange={(short) => {
      localStorage.removeItem(ACTIVE_TIMER_KEY);
      localStorage.setItem(key, short ? "5" : "full");
      setShortSession(short);
    }} />;
}

function MeditationTimer({
  meditationId,
  data,
  setData,
  navigate,
  mysteryCategory,
  mysteryRunId,
  shortSession,
  onDurationChange
}: Props & { shortSession: boolean; onDurationChange: (short: boolean) => void }) {
  const baseMeditation = MEDITATIONS.find((item) => item.id === meditationId) ?? MEDITATIONS[0];
  const meditation = useMemo(() => shortSession ? fiveMinuteMeditation(baseMeditation) : baseMeditation, [baseMeditation, shortSession]);
  const binaural = meditation.id === "binaural";
  const restored = useMemo(() => restoreTimer(meditation), [meditation]);
  const [guidedAudio, setGuidedAudio] = useState(() =>
    shortSession || binaural ? undefined : chooseGuidedAudioVariant(meditation.id, restored.guidedAudioId)
  );
  const availableMusic = useMemo(() => binaural ? [] : musicTracksForMeditation(meditation.id), [meditation.id, binaural]);
  const [playlist, setPlaylist] = useState(BINAURAL_PLAYLISTS[0].url);
  const [openingYoutube, setOpeningYoutube] = useState(false);
  const [youtubeMessage, setYoutubeMessage] = useState("");
  const sessionDuration = useMemo(
    () => meditation.phases.reduce((sum, item) => sum + item.duration, 0),
    [meditation.phases]
  );
  const [meditationMusicQueueIds, setMeditationMusicQueueIds] = useState(() =>
    restored.meditationMusicQueueIds?.length
      ? restored.meditationMusicQueueIds
      : buildMusicQueueIdsForCounter(
          availableMusic,
          sessionDuration,
          readMusicCycleCounter(),
          restored.meditationMusicId
        )
  );
  const [currentMusic, setCurrentMusic] = useState<MeditationMusicTrack | undefined>(() => {
    const firstId = meditationMusicQueueIds[0];
    return availableMusic.find((track) => track.id === firstId) ?? availableMusic[0];
  });
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
  const [completionDestination, setCompletionDestination] = useState<"progress" | "journal" | null>(null);
  const elapsedRef = useRef(restored.elapsedSeconds);
  const deadlineRef = useRef<number | null>(restored.deadline);
  const lastClockReadRef = useRef(Date.now());
  const finishingRef = useRef(false);
  const guidedAudioRef = useRef<HTMLAudioElement | null>(null);
  const meditationMusicRef = useRef<StreamingMusicPlaylist | null>(null);
  const namasteAudioRef = useRef<HTMLAudioElement | null>(null);
  const completionSavedRef = useRef(false);
  const completionNavigationTimerRef = useRef<number | null>(null);
  const musicCycleClaimedRef = useRef(
    restored.started || Boolean(restored.meditationMusicQueueIds?.length)
  );
  const mysteryMode = Boolean(mysteryCategory && mysteryRunId);
  const currentPhase = meditation.phases[phaseIndex];
  const totalDuration = sessionDuration;
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
      // Do not repeatedly seek an already-playing voice to the timer's rounded
      // one-second position. On Android WebView those tiny seeks can produce a
      // repeating click in the speech. A paused voice needs positioning before
      // it resumes; a playing voice can keep its own smooth media clock.
      if (shouldPlay && audio.paused) {
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
    if (availableMusic.length === 0 || meditationMusicQueueIds.length === 0) return;
    setMusicUnavailable(false);
    let audio: StreamingMusicPlaylist;
    try {
      audio = new StreamingMusicPlaylist(
        meditationMusicQueueIds,
        availableMusic,
        data.preferences.meditationMusicVolume / 100,
        setCurrentMusic,
        () => setMusicUnavailable(true)
      );
    } catch {
      setMusicUnavailable(true);
      return;
    }
    meditationMusicRef.current = audio;
    setMusicReady(true);
    return () => {
      audio.dispose();
      if (meditationMusicRef.current === audio) meditationMusicRef.current = null;
      setMusicReady(false);
    };
  }, [availableMusic, meditationMusicQueueIds]);

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
      Boolean(meditationMusicQueueIds.length && running && started && !completed)
    );
  }, [
    completed,
    currentPhase.duration,
    elapsedBefore,
    meditationMusicQueueIds.length,
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
    }
    navigator.vibrate?.([80, 60, 120]);
    localStorage.removeItem(ACTIVE_TIMER_KEY);
    void cancelTimerNotifications();
    void allowScreenSleep();
  }, [data.preferences.uiSoundsEnabled, guidedAudio, playNamasteEnding, sound, syncGuidedAudio, syncMeditationMusic, totalDuration]);

  const syncClock = useCallback(() => {
    if (!running || !deadlineRef.current || finishingRef.current) return;
    const now = Date.now();
    elapsedRef.current = Math.min(totalDuration,
      elapsedRef.current + Math.max(0, (now - lastClockReadRef.current) / 1000));
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
  }, [finish, meditation.phases, phaseIndex, running, sound, totalDuration]);

  useEffect(() => {
    if (!running || completed) return;
    const id = window.setInterval(syncClock, 250);
    return () => window.clearInterval(id);
  }, [completed, running, syncClock]);

  useEffect(() => {
    let listener: Awaited<ReturnType<typeof App.addListener>> | undefined;
    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        syncClock();
        if (hasMeditationOverlay) void MeditationOverlay.hide().catch(() => {});
      }
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
      meditationMusicQueueIds,
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
    meditationMusicQueueIds,
    namasteEnding.id,
    phaseIndex,
    remaining,
    running,
    started
  ]);

  const startOrResume = () => {
    if (!started && !musicCycleClaimedRef.current) {
      takeNextMusicCycleCounter();
      musicCycleClaimedRef.current = true;
    }
    if (guidedAudio) rememberGuidedAudioVariant(meditation.id, guidedAudio.id);
    rememberNamasteEnding(namasteEnding.id);
    const elapsed = elapsedBefore + currentPhase.duration - remaining;
    syncGuidedAudio(elapsed, Boolean(guidedAudio));
    syncMeditationMusic(elapsed, meditationMusicQueueIds.length > 0);
    setStarted(true);
    setRunning(true);
    lastClockReadRef.current = Date.now();
    deadlineRef.current = Date.now() + remaining * 1000;
    scheduleCurrentTimeline(phaseIndex, remaining);
  };

  const pause = () => {
    if (hasMeditationOverlay) void MeditationOverlay.hide().catch(() => {});
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
    if (hasMeditationOverlay) void MeditationOverlay.hide().catch(() => {});
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
    setGuidedAudio(shortSession || binaural ? undefined : chooseGuidedAudioVariant(meditation.id));
    const nextMusicQueue = buildMusicQueueIdsForCounter(
      availableMusic,
      totalDuration,
      takeNextMusicCycleCounter()
    );
    musicCycleClaimedRef.current = true;
    setMeditationMusicQueueIds(nextMusicQueue);
    setCurrentMusic(availableMusic.find((track) => track.id === nextMusicQueue[0]));
    setNamasteEnding(chooseNamasteEnding());
    localStorage.removeItem(ACTIVE_TIMER_KEY);
    void cancelTimerNotifications();
    void allowScreenSleep();
  };

  const openYoutube = async () => {
    if (openingYoutube) return;
    setOpeningYoutube(true);
    setYoutubeMessage("");
    try {
      if (!hasMeditationOverlay) {
        setYoutubeMessage("The floating YouTube timer is available in the Android app.");
        return;
      }
      const { granted } = await MeditationOverlay.permission();
      if (!granted) {
        setYoutubeMessage("Allow ZenChad to display over other apps, then return and tap Open YouTube again.");
        await MeditationOverlay.requestPermission();
        return;
      }
      if (!running) startOrResume();
      const laterSeconds = meditation.phases.slice(phaseIndex + 1).reduce((sum, phase) => sum + phase.duration, 0);
      const deadline = (deadlineRef.current ?? Date.now() + remaining * 1000) + laterSeconds * 1000;
      // Persist before switching apps: the WebView may immediately suspend its effects.
      localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify({
        meditationId: meditation.id, phaseIndex, remaining, running: true, started: true,
        completed: false, deadline: deadlineRef.current, elapsedSeconds: elapsedRef.current, savedAt: Date.now()
      }));
      await MeditationOverlay.open({ url: playlist, deadline });
    } catch {
      pause();
      setYoutubeMessage("YouTube or the floating timer could not open. Your timer is paused; check the overlay permission and try again.");
    } finally {
      setOpeningYoutube(false);
    }
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
        ...recordMeditationCompletion(current, meditation.id, creditedSeconds),
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
    setCompletionDestination(destination);
    completionNavigationTimerRef.current = window.setTimeout(
      () => finishCompletionNavigation(destination),
      data.preferences.reducedMotion ? 300 : XP_COLLECTION_DURATION
    );
  };

  const finishCompletionNavigation = (destination = completionDestination ?? "progress") => {
    navigate(
      mysteryMode
        ? { name: "mystery-challenge" }
        : destination === "journal"
          ? { name: "journal", draftMeditation: meditation.name }
          : { name: "progress" }
    );
  };

  useEffect(() => () => {
    if (completionNavigationTimerRef.current !== null) {
      window.clearTimeout(completionNavigationTimerRef.current);
    }
  }, []);

  if (completed) {
    const creditedSeconds = Math.max(60, Math.round(elapsedRef.current));
    const completionXp = 50 + Math.max(1, Math.floor(creditedSeconds / 6));
    const completionZenPoints = zenPointsForMeditation(creditedSeconds);
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
        {completionDestination !== null && (
          <ZenPointsRewardFeedback
            amount={completionZenPoints}
            reducedMotion={data.preferences.reducedMotion}
          />
        )}
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
        <button className="button primary full" onClick={() => saveCompletion("progress")} disabled={completionDestination !== null}>
          {mysteryMode ? "Mark meditation complete" : "Save session & view progress"}
        </button>
        <button className="button secondary full" onClick={() => saveCompletion("journal")} disabled={completionDestination !== null}>
          <BookOpen size={17} /> {mysteryMode ? "Return to the sequence" : "Save session & journal it"}
        </button>
        <button className="button ghost full" onClick={reset} disabled={completionDestination !== null}><RotateCcw size={17} /> Do it again</button>
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

      {!started && (
        <section className="card settings-card">
          <label>Session length
            <select value={shortSession ? "5" : "full"} onChange={(event) => onDurationChange(event.target.value === "5")}>
              <option value="5">5 minutes · a little is enough</option>
              <option value="full">Full practice · {Math.ceil(baseMeditation.phases.reduce((sum, phase) => sum + phase.duration, 0) / 60)} minutes</option>
            </select>
          </label>
          {shortSession && !binaural && <p className="setting-note">A shorter practice with on-screen guidance and music. Spoken journeys are available with the full practice.</p>}
        </section>
      )}

      {binaural && (
        <section className="card settings-card">
          <label>YouTube playlist
            <select value={playlist} onChange={(event) => setPlaylist(event.target.value)}>
              {BINAURAL_PLAYLISTS.map((item) => <option key={item.url} value={item.url}>{item.name}</option>)}
            </select>
          </label>
          <p className="setting-note">Use stereo headphones. Open YouTube, choose Play there, and keep your countdown floating above it. Drag the timer to move it; tap Return to pause or finish in ZenChad. Internet required.</p>
          <button className="button primary full" disabled={openingYoutube} onClick={() => void openYoutube()}>{openingYoutube ? "Opening…" : "Open YouTube + floating timer"}</button>
          <p className="setting-note">The timer starts when YouTube opens. YouTube playback and ads are controlled by YouTube; finishing the timer does not stop the music.</p>
          {youtubeMessage && <p role="status" className="status-message">{youtubeMessage}</p>}
        </section>
      )}

      {meditation.breathingGuidance && (
        <section className="card breathing-guidance-card">
          <div className="breathing-guidance-title">
            <Wind size={19} />
            <span><small>Breathing for this practice</small><strong>{meditation.breathingGuidance.name}</strong></span>
          </div>
          <p>{meditation.breathingGuidance.instruction}</p>
          <small>{meditation.breathingGuidance.safetyNote}</small>
        </section>
      )}

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
              : binaural ? "Your chosen YouTube playlist provides the audio." : shortSession ? "Follow the on-screen prompts for this five-minute practice." : "Spoken guidance is not yet available for this meditation."}
          </p>
        )}
        {meditationMusicQueueIds.length > 0 && (
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
                : currentMusic
                  ? `Playing “${currentMusic.title}”. All available tracks shuffle without repeating, with gentle crossfades.`
                  : "Preparing the shuffled offline soundtrack."}
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
