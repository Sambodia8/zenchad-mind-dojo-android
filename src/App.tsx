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
  BarChart3,
  Flame,
  Grid2X2,
  Home,
  Library,
  MoreVertical,
  PersonStanding
} from "lucide-react";
import { App as CapacitorApp } from "@capacitor/app";
import type { AppData, Route } from "./types";
import { addJournalXp, loadData, makeJournal, saveData } from "./storage";
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
import ThemesScreen from "./screens/ThemesScreen";
import SettingsScreen from "./screens/SettingsScreen";
import BikeQuestScreen from "./screens/BikeQuestScreen";
import RunningModeScreen from "./screens/RunningModeScreen";
import MysteryChallengeScreen from "./screens/MysteryChallengeScreen";
import LevelUpModal from "./components/LevelUpModal";
import { getYogaClass } from "./data";
import { playUiSfx, preloadUiSfx, type UiSfxName } from "./uiSfx";

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
    case "themes": return "Watercolour Themes";
    case "settings": return "Settings";
  }
};

export default function App() {
  const [route, setRoute] = useState<Route>({ name: "home" });
  const [data, setData] = useState<AppData>(() => loadData());
  const routeRef = useRef<Route>(route);
  const routeHistoryRef = useRef<Route[]>([]);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const topMenuRef = useRef<HTMLDivElement>(null);
  const showBackButton = [
    "timer", "yoga-pose", "yoga-class", "yoga-builder", "bike-quest", "running",
    "mystery-challenge", "journal", "guide", "soundscapes", "rewards", "themes", "settings"
  ].includes(route.name);

  useEffect(() => saveData(data), [data]);

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

  useEffect(() => { setTopMenuOpen(false); }, [route]);

  useEffect(() => {
    if (!topMenuOpen) return;
    const closeOnOutsidePress = (event: globalThis.PointerEvent) => {
      if (!topMenuRef.current?.contains(event.target as Node)) setTopMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTopMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [topMenuOpen]);

  const screen = useMemo(() => {
    switch (route.name) {
      case "home": return <HomeScreen data={data} setData={setData} navigate={navigate} />;
      case "library": return <ToolkitScreen initialTab={route.tab} data={data} setData={setData} navigate={navigate} />;
      case "toolkit": return <ToolkitHubScreen navigate={navigate} />;
      case "roulette": return <RouletteScreen key={route.spinKey ?? "roulette"} autoSpin={route.autoSpin} uiSoundsEnabled={data.preferences.uiSoundsEnabled} setData={setData} navigate={navigate} />;
      case "yoga": return <YogaScreen data={data} navigate={navigate} />;
      case "timer": return <TimerScreen key={route.meditationId} meditationId={route.meditationId} data={data} setData={setData} navigate={navigate} mysteryCategory={route.mysteryCategory} mysteryRunId={route.mysteryRunId} />;
      case "yoga-pose": return <YogaPoseScreen movementId={route.movementId} navigate={navigate} />;
      case "yoga-class": {
        const yogaNavigate: Dispatch<SetStateAction<Route>> = (nextRoute) => {
          if (!route.returnToBikeQuest) {
            navigate(nextRoute);
            return;
          }
          const resolved = typeof nextRoute === "function" ? nextRoute(route) : nextRoute;
          if (resolved.name === "yoga") {
            navigate({ name: "bike-quest", resume: route.returnToBikeQuest });
            return;
          }
          navigate(resolved);
        };
        return <YogaClassScreen key={route.classId} classId={route.classId} data={data} setData={setData} navigate={yogaNavigate} />;
      }
      case "yoga-builder": return <YogaRoutineBuilderScreen editClassId={route.editClassId} data={data} setData={setData} navigate={navigate} />;
      case "bike-quest": return <BikeQuestScreen data={data} setData={setData} navigate={navigate} resume={route.resume} />;
      case "running": return <RunningModeScreen data={data} setData={setData} />;
      case "mystery-challenge": return <MysteryChallengeScreen data={data} setData={setData} navigate={navigate} />;
      case "journal": return <JournalScreen data={data} setData={setData} draftMeditation={route.draftMeditation} mysteryRunId={route.mysteryRunId} />;
      case "progress": return <ProgressScreen data={data} />;
      case "guide": return <GuideScreen navigate={navigate} />;
      case "soundscapes": return <SoundscapesScreen data={data} setData={setData} />;
      case "rewards": return <RewardsScreen data={data} navigate={navigate} />;
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
      : ["bike-quest", "running", "mystery-challenge", "journal", "guide", "soundscapes", "rewards", "themes", "settings"].includes(route.name)
        ? "toolkit"
        : route.name;

  const handleLevelUpDismiss = useCallback((newLevel: number) => {
    setData(prev => ({ ...prev, stats: { ...prev.stats, lastSeenLevel: newLevel } }));
  }, []);

  return (
    <div className={`app-shell ${data.preferences.reducedMotion ? "reduce-motion" : ""}`} data-theme={data.preferences.selectedTheme} onClickCapture={handleUiClick} onChangeCapture={handleUiChange}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <button className="brand" onClick={() => navigate({ name: "home" })} aria-label="Go to Home">
          <span className="brand-mark"><img src="assets/branding/eye-of-horus.png" alt="" /></span>
          <span><strong>Zen Chad</strong><small>{titleFor(route)}</small></span>
        </button>
        <div className="topbar-actions">
          <div className="hud">
            <span aria-label={`${data.stats.streak} day rhythm`}><Flame size={15} /> {data.stats.streak}</span>
            <span aria-label={`${data.stats.xp} XP`}><b className="xp-glyph">XP</b> {data.stats.xp}</span>
          </div>
          <div className="topbar-menu" ref={topMenuRef}>
            <button className="topbar-menu-trigger" onClick={() => setTopMenuOpen((open) => !open)} aria-label="Open app menu" aria-haspopup="menu" aria-expanded={topMenuOpen}><MoreVertical size={20} /></button>
            {topMenuOpen ? (
              <div className="topbar-menu-popover" role="menu">
                <button role="menuitem" onClick={() => { setTopMenuOpen(false); navigate({ name: "progress" }); }}>
                  <BarChart3 size={18} /><span><strong>Progress</strong><small>Sessions, streaks and activity</small></span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

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
    </div>
  );
}
