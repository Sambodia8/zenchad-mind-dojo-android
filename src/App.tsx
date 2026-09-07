import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ChangeEvent as ReactChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction
} from "react";
import {
  Grid2X2,
  Home,
  Library,
  PersonStanding,
  Settings,
  Snowflake,
  X
} from "lucide-react";
import { App as CapacitorApp } from "@capacitor/app";
import type { AppData, Route } from "./types";
import { addJournalXp, loadData, makeJournal, saveData } from "./storage";
import { addRunningXp } from "./running";
import {
  RUNNING_BONUS_QUEUED_EVENT,
  markRunningRewardBonusesApplied,
  pendingRunningRewardBonuses
} from "./runningRewardBonus";
import HomeScreen from "./screens/HomeScreen";
import ToolkitScreen from "./screens/ToolkitScreen";
import RouletteScreen from "./screens/RouletteScreen";
import TimerScreen from "./screens/TimerScreen";
import YogaScreen from "./screens/YogaScreen";
import YogaPoseScreen from "./screens/YogaPoseScreen";
import YogaClassScreen from "./screens/YogaClassScreen";
import YogaRoutineBuilderScreen from "./screens/YogaRoutineBuilderScreen";
import JournalScreen from "./screens/JournalScreen";
import ProgressScreen from "./screens/ProgressScreen";
import ToolkitHubScreen from "./screens/ToolkitHubScreen";
import GuideScreen from "./screens/GuideScreen";
import SoundscapesScreen from "./screens/SoundscapesScreen";
import RewardsScreen from "./screens/RewardsScreen";
import ZenShopScreen from "./screens/ZenShopScreen";
import ThemesScreen from "./screens/ThemesScreen";
import SettingsScreen from "./screens/SettingsScreen";
import BikeQuestScreen from "./screens/BikeQuestScreen";
import RunningModeScreen from "./screens/RunningModeScreen";
import MysteryChallengeScreen from "./screens/MysteryChallengeScreen";
import LevelUpModal from "./components/LevelUpModal";
import { getYogaClass } from "./data";
import { playUiSfx, preloadUiSfx, type UiSfxName } from "./uiSfx";
import { getLevelProgress } from "./xp";
import XpCollectionAnimation, { XP_COLLECTION_DURATION } from "./components/XpCollectionAnimation";
import { setRunningSpeechVoice } from "./runningSpeech";
import { initialiseDesktopSync, isSyncApplyingRemote, scheduleDesktopExport } from "./syncBridge";

const titleFor = (route: Route) => {
  switch (route.name) {
    case "home": return "Home";
    case "library": return "Library";
    case "toolkit": return "Toolkit";
    case "roulette": return "Meditation Roulette";
    case "yoga":
    case "yoga-pose": return "Yoga with Mark";
    case "yoga-class": return getYogaClass(route.classId).name;
    case "yoga-builder": return "Routine Builder";
    case "bike-quest": return "Bike Quest";
    case "running": return "Running";
    case "mystery-challenge": return "The Quiet Sequence";
    case "timer": return "Meditation";
    case "journal": return "Meditation Journal";
    case "progress": return "Progress";
    case "guide": return "Live Zen Guide";
    case "soundscapes": return "Soundscapes";
    case "rewards": return "Badges & Quests";
    case "shop": return "Zen Shop";
    case "themes": return "Watercolour Themes";
    case "settings": return "Settings";
  }
};

const logoVariants = ["logo-needleteeth", "logo-crowen", "logo-fort", "logo-ghostbum"] as const;

export default function App() {
  const [route, setRoute] = useState<Route>({ name: "home" });
  const [data, setData] = useState<AppData>(() => loadData());
  const [logoVariant] = useState<(typeof logoVariants)[number]>(() =>
    logoVariants[Math.floor(Math.random() * logoVariants.length)]
  );
  const dataRef = useRef<AppData>(data);
  const routeRef = useRef<Route>(route);
  const routeHistoryRef = useRef<Route[]>([]);
  const previousXpRef = useRef(data.stats.xp);
  const animationFrameRef = useRef<number | null>(null);
  const [displayedXp, setDisplayedXp] = useState(data.stats.xp);
  const observedXpRef = useRef(data.stats.xp);
  const xpCollectionRef = useRef<{ id: number; amount: number } | null>(null);
  const xpCollectionQueueRef = useRef<number[]>([]);
  const xpCollectionIdRef = useRef(0);
  const [xpCollection, setXpCollection] = useState<{ id: number; amount: number } | null>(null);
  const [isYogaImmersive, setIsYogaImmersive] = useState(false);
  const levelProgress = getLevelProgress(data.stats.xp, data.stats.level);
  const isStatusRoute = route.name === "progress";
  const isYogaRoute = ["yoga", "yoga-pose", "yoga-class", "yoga-builder"].includes(route.name);
  const showBackButton = !isYogaImmersive && [
    "timer", "yoga-pose", "yoga-class", "yoga-builder", "bike-quest", "running",
    "mystery-challenge", "journal", "guide", "soundscapes", "rewards", "shop", "themes", "settings"
  ].includes(route.name);

  useEffect(() => {
    if (route.name !== "yoga-class") setIsYogaImmersive(false);
  }, [route.name]);

  useEffect(() => {
    dataRef.current = data;
    saveData(data);
    if (!isSyncApplyingRemote()) scheduleDesktopExport(data);
  }, [data]);

  useEffect(() => initialiseDesktopSync((nextData) => setData(nextData)), []);

  useEffect(() => {
    const applyRunningBonuses = () => {
      const pending = pendingRunningRewardBonuses();
      if (!pending.length) return;
      const total = pending.reduce((sum, bonus) => sum + bonus.bonusXp, 0);
      if (total <= 0) {
        markRunningRewardBonusesApplied(pending.map((bonus) => bonus.runId));
        return;
      }
      const current = dataRef.current;
      const next: AppData = { ...current, stats: addRunningXp(current.stats, total) };
      saveData(next);
      markRunningRewardBonusesApplied(pending.map((bonus) => bonus.runId));
      dataRef.current = next;
      setData(next);
    };
    applyRunningBonuses();
    window.addEventListener(RUNNING_BONUS_QUEUED_EVENT, applyRunningBonuses);
    return () => window.removeEventListener(RUNNING_BONUS_QUEUED_EVENT, applyRunningBonuses);
  }, []);

  useEffect(() => {
    const historyKey = "zenchad_historical_journal_v1";
    if (localStorage.getItem(historyKey)) return;
    if (data.journal.length || data.stats.sessionsCompleted) {
      localStorage.setItem(historyKey, "skipped");
      return;
    }
    let active = true;
    void fetch("assets/imports/meditation-journal-history.json")
      .then((response) => {
        if (!response.ok) throw new Error("history unavailable");
        return response.json();
      })
      .then((rows) => {
        if (!active || !Array.isArray(rows)) return;
        setData((current) => {
          if (current.journal.length || current.stats.sessionsCompleted) return current;
          const entries = rows.map((row) =>
            makeJournal(
              row.title || "Historical meditation",
              row.body || "",
              "Historical meditation",
              "meditation",
              row.createdAt || new Date().toISOString(),
              "imported"
            )
          );
          return { ...current, stats: addJournalXp(current.stats, entries.length), journal: entries };
        });
        localStorage.setItem(historyKey, "imported");
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => preloadUiSfx(), []);

  useEffect(() => {
    setRunningSpeechVoice(data.preferences.runningSpeechVoiceId);
  }, [data.preferences.runningSpeechVoiceId]);

  const handleUiClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const control = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!control || control.disabled) return;
      const explicitSound = control.dataset.sfx;
      if (explicitSound === "none") return;
      if (explicitSound === "enable") {
        playUiSfx("confirm");
        return;
      }
      if (!data.preferences.uiSoundsEnabled) return;
      let sound: UiSfxName = "select";
      if (explicitSound) sound = explicitSound as UiSfxName;
      else if (control.closest(".bottom-nav, .segmented")) sound = "tab";
      else if (control.matches(".back-link, .brand")) sound = "back";
      else if (control.matches(".primary, .treasure-button")) sound = "confirm";
      playUiSfx(sound);
    },
    [data.preferences.uiSoundsEnabled]
  );

  const handleUiChange = useCallback(
    (event: ReactChangeEvent<HTMLDivElement>) => {
      if (!data.preferences.uiSoundsEnabled) return;
      const control = event.target as HTMLInputElement | HTMLSelectElement;
      if (control.dataset.sfx === "none") return;
      if (control instanceof HTMLSelectElement || (control instanceof HTMLInputElement && ["checkbox", "radio", "time"].includes(control.type))) {
        playUiSfx("select");
      }
    },
    [data.preferences.uiSoundsEnabled]
  );

  const navigate = useCallback<Dispatch<SetStateAction<Route>>>((nextRoute) => {
    const current = routeRef.current;
    const next = typeof nextRoute === "function" ? nextRoute(current) : nextRoute;
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    routeHistoryRef.current.push(current);
    routeRef.current = next;
    setRoute(next);
  }, []);

  const goBack = useCallback(() => {
    const previous = routeHistoryRef.current.pop();
    if (previous) {
      routeRef.current = previous;
      setRoute(previous);
      return true;
    }
    if (routeRef.current.name !== "home") {
      const home: Route = { name: "home" };
      routeRef.current = home;
      setRoute(home);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    let active = true;
    let removeListener: (() => Promise<void>) | undefined;
    void CapacitorApp.addListener("backButton", () => {
      if (!goBack()) void CapacitorApp.exitApp();
    }).then((handle) => {
      if (active) removeListener = () => handle.remove();
      else void handle.remove();
    });
    return () => {
      active = false;
      if (removeListener) void removeListener();
    };
  }, [goBack]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: data.preferences.reducedMotion ? "auto" : "smooth" });
  }, [data.preferences.reducedMotion, route]);

  useEffect(() => {
    const targetXp = data.stats.xp;
    const startXp = previousXpRef.current;
    previousXpRef.current = targetXp;
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;

    if (data.preferences.reducedMotion || startXp === targetXp) {
      setDisplayedXp(targetXp);
      return;
    }

    let startedAt: number | null = null;
    const duration = XP_COLLECTION_DURATION;
    const animate = (timestamp: number) => {
      startedAt ??= timestamp;
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayedXp(Math.round(startXp + (targetXp - startXp) * easedProgress));
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
  }, [data.preferences.reducedMotion, data.stats.xp]);

  const playNextXpCollection = useCallback(() => {
    const amount = xpCollectionQueueRef.current.shift();
    if (!amount) {
      xpCollectionRef.current = null;
      setXpCollection(null);
      return;
    }
    const next = { id: ++xpCollectionIdRef.current, amount };
    xpCollectionRef.current = next;
    setXpCollection(next);
  }, []);

  useEffect(() => {
    const gainedXp = data.stats.xp - observedXpRef.current;
    observedXpRef.current = data.stats.xp;
    if (gainedXp <= 0) return;

    xpCollectionQueueRef.current.push(gainedXp);
    if (!xpCollectionRef.current) playNextXpCollection();
  }, [data.stats.xp, playNextXpCollection]);

  const handleXpCollectionComplete = useCallback(() => {
    xpCollectionRef.current = null;
    playNextXpCollection();
  }, [playNextXpCollection]);

  const screen = useMemo(() => {
    switch (route.name) {
      case "home": return <HomeScreen navigate={navigate} />;
      case "library": return <ToolkitScreen initialTab={route.tab} data={data} setData={setData} navigate={navigate} />;
      case "toolkit": return <ToolkitHubScreen navigate={navigate} />;
      case "roulette": return <RouletteScreen key={route.spinKey ?? "roulette"} autoSpin={route.autoSpin} uiSoundsEnabled={data.preferences.uiSoundsEnabled} setData={setData} navigate={navigate} />;
      case "yoga": return <YogaScreen data={data} navigate={navigate} initialMode={route.mode} />;
      case "timer": return <TimerScreen key={route.meditationId} meditationId={route.meditationId} data={data} setData={setData} navigate={navigate} mysteryCategory={route.mysteryCategory} mysteryRunId={route.mysteryRunId} />;
      case "yoga-pose": return <YogaPoseScreen movementId={route.movementId} navigate={navigate} />;
      case "yoga-class": {
        const yogaNavigate: Dispatch<SetStateAction<Route>> = (nextRoute) => {
          if (!route.returnToBikeQuest && !route.returnToRunningPreparation) {
            navigate(nextRoute);
            return;
          }
          const resolved = typeof nextRoute === "function" ? nextRoute(route) : nextRoute;
          if (resolved.name === "yoga") {
            navigate(
              route.returnToBikeQuest
                ? { name: "bike-quest", resume: route.returnToBikeQuest }
                : resolved
            );
            return;
          }
          navigate(resolved);
        };
        return (
          <YogaClassScreen
            key={route.classId}
            classId={route.classId}
            data={data}
            setData={setData}
            navigate={yogaNavigate}
            returnToBikeQuest={route.returnToBikeQuest}
            returnToRunningPreparation={route.returnToRunningPreparation}
            autoStart={route.autoStart}
            onImmersiveStateChange={setIsYogaImmersive}
          />
        );
      }
      case "yoga-builder": return <YogaRoutineBuilderScreen editClassId={route.editClassId} data={data} setData={setData} navigate={navigate} />;
      case "bike-quest": return <BikeQuestScreen data={data} setData={setData} navigate={navigate} resume={route.resume} />;
      case "running": return <RunningModeScreen data={data} setData={setData} navigate={navigate} startMode={route.startMode} />;
      case "mystery-challenge": return <MysteryChallengeScreen data={data} setData={setData} navigate={navigate} />;
      case "journal": return <JournalScreen data={data} setData={setData} draftMeditation={route.draftMeditation} mysteryRunId={route.mysteryRunId} />;
      case "progress": return <ProgressScreen data={data} setData={setData} />;
      case "guide": return <GuideScreen navigate={navigate} />;
      case "soundscapes": return <SoundscapesScreen data={data} setData={setData} />;
      case "rewards": return <RewardsScreen data={data} navigate={navigate} />;
      case "shop": return <ZenShopScreen data={data} setData={setData} navigate={navigate} />;
      case "themes": return <ThemesScreen data={data} setData={setData} />;
      case "settings": return <SettingsScreen data={data} setData={setData} />;
    }
  }, [data, navigate, route]);

  const nav = [
    { route: { name: "home" } as Route, label: "Home", icon: Home },
    { route: { name: "library" } as Route, label: "Library", icon: Library },
    { route: { name: "roulette" } as Route, label: "Roulette", icon: null },
    { route: { name: "yoga" } as Route, label: "Yoga", icon: PersonStanding },
    { route: { name: "toolkit" } as Route, label: "Toolkit", icon: Grid2X2 }
  ];

  const activeName = route.name === "timer"
    ? "library"
    : route.name === "yoga-pose" || route.name === "yoga-class" || route.name === "yoga-builder"
      ? "yoga"
      : ["bike-quest", "running", "mystery-challenge", "journal", "guide", "soundscapes", "rewards", "shop", "themes", "settings"].includes(route.name)
        ? "toolkit"
        : route.name;

  const handleLevelUpDismiss = useCallback((newLevel: number) => {
    setData(prev => ({ ...prev, stats: { ...prev.stats, lastSeenLevel: newLevel } }));
  }, []);

  const experienceHud = (
    <div className="hud persistent-experience-hud">
      <button
        type="button"
        className="hud-level"
        onClick={() => navigate({ name: "progress" })}
        aria-label={`Level ${levelProgress.level}. ${levelProgress.isMaxLevel ? "Maximum level" : `${levelProgress.xpToNext} XP to next level`}. Open Progress`}
      >
        <span className="hud-level-label">Level {levelProgress.level}</span>
        <span className="hud-level-track" aria-hidden="true">
          <span style={{ width: `${levelProgress.progressPercent}%` }} />
        </span>
      </button>
      <button
        type="button"
        className="hud-xp"
        data-xp-target
        onClick={() => navigate({ name: "progress" })}
        aria-label={`${displayedXp} XP. Open Progress`}
      >
        <b className="xp-glyph">XP</b> {displayedXp}
      </button>
    </div>
  );

  return (
    <div className={`app-shell ${data.preferences.reducedMotion ? "reduce-motion" : ""} ${isStatusRoute ? "status-route" : ""} ${route.name === "home" ? "home-route" : ""} ${isYogaRoute ? "yoga-route" : ""} ${isYogaImmersive ? "yoga-immersive" : ""}`} data-theme={data.preferences.selectedTheme} onClickCapture={handleUiClick} onChangeCapture={handleUiChange}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <div className="topbar-leading">
          <button
            type="button"
            className="brand-mark brand-settings-button"
            onClick={() => navigate({ name: "home" })}
            aria-label="Go to Home"
            title="Home"
          >
            <img src="assets/branding/eye-of-horus.png" alt="" />
          </button>
          <button className="brand" onClick={() => navigate({ name: "home" })} aria-label="Go to Home">
            <span><strong className={`brand-wordmark ${logoVariant}`}>Zen Chad</strong><small>{titleFor(route)}</small></span>
          </button>
        </div>
        <button type="button" className="persistent-settings-trigger" onClick={() => navigate({ name: "settings" })} aria-label="Open Settings" title="Settings"><Settings aria-hidden="true" /></button>
        <div className="topbar-actions">{experienceHud}</div>
      </header>

      {data.pendingStreakFreezeNotice ? (
        <aside className="streak-freeze-notice" role="status" aria-live="polite">
          <Snowflake aria-hidden="true" />
          <span>
            <strong>Streak Freeze used automatically</strong>
            <small>Your streak stayed intact. {data.pendingStreakFreezeNotice.remaining} remaining.</small>
          </span>
          <button
            type="button"
            aria-label="Dismiss Streak Freeze message"
            onClick={() => setData((current) => ({ ...current, pendingStreakFreezeNotice: null }))}
          >
            <X aria-hidden="true" />
          </button>
        </aside>
      ) : null}

      <main className="main-content">
        {showBackButton ? <button className="back-link" onClick={goBack}>← Back</button> : null}
        {screen}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        {nav.map(({ route: itemRoute, label, icon: Icon }) => {
          const isRoulette = itemRoute.name === "roulette";
          return (
            <button key={label} className={`${activeName === itemRoute.name ? "active" : ""} ${isRoulette ? "roulette-tab" : ""}`.trim()} onClick={() => navigate(isRoulette ? { name: "roulette", autoSpin: true, spinKey: Date.now() } : itemRoute)} aria-current={activeName === itemRoute.name ? "page" : undefined} aria-label={isRoulette ? "Spin meditation roulette" : label}>
              {isRoulette ? <span className="roulette-tab-mark"><img src="assets/branding/eye-of-horus.png" alt="" /></span> : Icon ? <Icon size={21} /> : null}
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
      <LevelUpModal data={data} onDismiss={handleLevelUpDismiss} />
      {xpCollection ? (
        <XpCollectionAnimation
          key={xpCollection.id}
          amount={xpCollection.amount}
          active
          reducedMotion={data.preferences.reducedMotion}
          soundsEnabled={data.preferences.uiSoundsEnabled}
          onComplete={handleXpCollectionComplete}
        />
      ) : null}
    </div>
  );
}
