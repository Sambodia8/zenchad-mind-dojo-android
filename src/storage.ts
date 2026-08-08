import type {
  AppData,
  AppPreferences,
  EmotionalTool,
  EmotionalToolAttempt,
  JournalEntry,
  JournalEntry as JournalEntryType,
  MoodEntry,
  MysteryChallengeState,
  Stats
} from "./types";
import { LEVEL_THRESHOLDS } from "./data";
import { createMysteryChallengeState } from "./mysteryChallenge";

const STORAGE_KEY = "zenchad_app_data_v1";
export const JOURNAL_XP = 20;

const emptyStats: Stats = {
  xp: 0,
  level: 1,
  streak: 0,
  totalSeconds: 0,
  sessionsCompleted: 0,
  lastSessionDate: null,
  weeklySeconds: {},
  rouletteSpins: 0,
  yogaSessions: 0,
  lastSeenLevel: 1
};

const defaultPreferences: AppPreferences = {
  gentleReminderEnabled: false,
  gentleReminderTime: "19:00",
  uiSoundsEnabled: true,
  timerAlertsEnabled: false,
  voiceVolume: 50,
  meditationMusicEnabled: true,
  meditationMusicVolume: 20,
  stretchMusicEnabled: true,
  stretchMusicTrack: "grounding",
  stretchMusicVolume: 24,
  selectedTheme: "dawn",
  reducedMotion: false
};

export const starterEmotionalTools: EmotionalTool[] = [
  {
    id: "play-with-yuna",
    name: "Play with Yuna",
    details: "Spend a little time playing with Yuna and let yourself be present for it.",
    usefulFor: ["yellow"],
    expectedOutcome: ["green"],
    createdAt: "2026-01-01T00:00:00.000Z",
    isCustom: false
  },
  {
    id: "beat-saber",
    name: "Beat Saber",
    details: "Play a Beat Saber session and let the music and movement absorb your attention.",
    usefulFor: ["orange"],
    expectedOutcome: ["green", "yellow"],
    createdAt: "2026-01-01T00:00:00.000Z",
    isCustom: false
  },
  {
    id: "bike-holofit",
    name: "Bike / Holofit",
    details: "Get on the bike or use Holofit and let steady movement carry some of the intensity.",
    usefulFor: ["red"],
    expectedOutcome: ["yellow", "green"],
    createdAt: "2026-01-01T00:00:00.000Z",
    isCustom: false
  },
  {
    id: "meds",
    name: "Meds",
    details: "Take prescribed medication as directed.",
    usefulFor: ["red"],
    expectedOutcome: ["yellow"],
    createdAt: "2026-01-01T00:00:00.000Z",
    isCustom: false
  },
  {
    id: "talk-to-hana",
    name: "Talk to Hana",
    details: "Message or call Hana and share what is going on, even if it is only a few words.",
    usefulFor: ["orange", "yellow"],
    expectedOutcome: ["yellow", "green"],
    createdAt: "2026-01-01T00:00:00.000Z",
    isCustom: false
  },
  {
    id: "music",
    name: "Music",
    details: "Put on music that fits what you need and listen without asking yourself to be productive.",
    usefulFor: ["yellow"],
    expectedOutcome: ["green"],
    createdAt: "2026-01-01T00:00:00.000Z",
    isCustom: false
  },
  {
    id: "frisson-music",
    name: "Frisson Music",
    details: "Choose music that reliably gives you chills, movement, or an emotional release.",
    usefulFor: ["red"],
    expectedOutcome: ["green"],
    createdAt: "2026-01-01T00:00:00.000Z",
    isCustom: false
  },
  {
    id: "make-ai-meme",
    name: "Make an AI meme",
    details: "Make something silly with AI and follow the idea until it makes you smile.",
    usefulFor: ["yellow"],
    expectedOutcome: ["green"],
    outcomeUncertain: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    isCustom: false
  },
  {
    id: "green-tea",
    name: "Green tea",
    details: "Make and slowly drink a cup of green tea.",
    usefulFor: ["yellow"],
    expectedOutcome: ["green"],
    createdAt: "2026-01-01T00:00:00.000Z",
    isCustom: false
  },
  {
    id: "codex",
    name: "Codex?",
    details: "Use Codex for something interesting, creative, or satisfying.",
    usefulFor: ["green"],
    expectedOutcome: ["green"],
    createdAt: "2026-01-01T00:00:00.000Z",
    isCustom: false
  }
];

export const defaultData: AppData = {
  stats: emptyStats,
  moods: [],
  journal: [],
  emotionalTools: starterEmotionalTools,
  emotionalToolAttempts: [],
  preferences: defaultPreferences,
  moodScaleVersion: 2,
  customYogaClasses: [],
  downloadedSoundscapes: [],
  mysteryChallenge: createMysteryChallengeState()
};

export function loadData(): AppData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultData;
    const parsed = JSON.parse(saved) as Partial<AppData>;
    const savedTools = Array.isArray(parsed.emotionalTools) ? parsed.emotionalTools : [];
    const savedAttempts = Array.isArray(parsed.emotionalToolAttempts)
      ? parsed.emotionalToolAttempts
      : [];
    const customTools = savedTools
      .filter((tool) => tool.isCustom)
      .map((tool) => ({
        ...tool,
        expectedOutcome: Array.isArray(tool.expectedOutcome) ? tool.expectedOutcome : []
      }));
    const historicalStarterTools = savedTools
      .filter(
        (tool) =>
          !tool.isCustom &&
          !starterEmotionalTools.some((starter) => starter.id === tool.id) &&
          savedAttempts.some((attempt) => attempt.toolId === tool.id)
      )
      .map((tool) => ({
        ...tool,
        expectedOutcome: Array.isArray(tool.expectedOutcome) ? tool.expectedOutcome : []
      }));
    const moods = Array.isArray(parsed.moods) ? parsed.moods : [];
    const migratedMoods =
      parsed.moodScaleVersion === 2
        ? moods
        : moods.map((mood) => ({
            ...mood,
            value: Math.max(0, Math.min(10, mood.value * 2.5))
          }));
    return {
      stats: {
        ...emptyStats,
        ...parsed.stats,
        lastSeenLevel: parsed.stats?.lastSeenLevel ?? 1
      },
      moods: migratedMoods,
      journal: Array.isArray(parsed.journal) ? parsed.journal : [],
      emotionalTools: [...starterEmotionalTools, ...historicalStarterTools, ...customTools],
      emotionalToolAttempts: savedAttempts,
      preferences: { ...defaultPreferences, ...parsed.preferences },
      moodScaleVersion: 2,
      customYogaClasses: Array.isArray(parsed.customYogaClasses) ? parsed.customYogaClasses : [],
      downloadedSoundscapes: Array.isArray(parsed.downloadedSoundscapes) ? parsed.downloadedSoundscapes : [],
      mysteryChallenge: migrateMysteryChallenge(parsed.mysteryChallenge)
    };
  } catch {
    return defaultData;
  }
}

function migrateMysteryChallenge(value: unknown): MysteryChallengeState {
  const fallback = createMysteryChallengeState();
  if (!value || typeof value !== "object") return fallback;
  const saved = value as Partial<MysteryChallengeState>;
  const order = Array.isArray(saved.secretOrder) && saved.secretOrder.length === 2
    && saved.secretOrder.every((item) => item === "Emotional" || item === "Sensory")
    ? saved.secretOrder as MysteryChallengeState["secretOrder"]
    : fallback.secretOrder;
  const currentRun = saved.currentRun && typeof saved.currentRun === "object"
    ? {
        id: typeof saved.currentRun.id === "string" ? saved.currentRun.id : crypto.randomUUID(),
        startedAt: typeof saved.currentRun.startedAt === "string" ? saved.currentRun.startedAt : new Date().toISOString(),
        meditations: Array.isArray(saved.currentRun.meditations)
          ? saved.currentRun.meditations.filter(
              (item) => item && (item.category === "Emotional" || item.category === "Sensory") && typeof item.meditationId === "string"
            )
          : [],
        journalEntryId: typeof saved.currentRun.journalEntryId === "string" ? saved.currentRun.journalEntryId : null
      }
    : null;
  return {
    version: 1,
    secretOrder: order,
    currentRun,
    completedRuns: typeof saved.completedRuns === "number" ? Math.max(0, Math.floor(saved.completedRuns)) : 0,
    lastCompletedAt: typeof saved.lastCompletedAt === "string" ? saved.lastCompletedAt : null,
    lastJournalEntryId: typeof saved.lastJournalEntryId === "string" ? saved.lastJournalEntryId : null,
    lastRunMatchedSecret: saved.lastRunMatchedSecret === true,
    clueVisible: saved.clueVisible === true,
    bonusUnlocked: saved.bonusUnlocked === true
  };
}

export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function levelForXp(xp: number) {
  const nextThreshold = LEVEL_THRESHOLDS.findIndex((threshold) => xp < threshold);
  return nextThreshold === -1 ? LEVEL_THRESHOLDS.length : Math.max(1, nextThreshold);
}

function addXp(stats: Stats, gainedXp: number): Stats {
  const xp = stats.xp + Math.max(0, gainedXp);
  return { ...stats, xp, level: levelForXp(xp) };
}

export function addJournalXp(stats: Stats, entries = 1): Stats {
  return addXp(stats, JOURNAL_XP * Math.max(0, entries));
}

export function addCompletedSessionAt(stats: Stats, seconds: number, sessionDate = new Date()): Stats {
  const day = dateKey(sessionDate);
  const yesterday = new Date(sessionDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dateKey(yesterday);
  const isAtOrAfterLatest = !stats.lastSessionDate || day >= stats.lastSessionDate;
  const isNewDay = stats.lastSessionDate !== day;
  const streak = isAtOrAfterLatest && isNewDay
    ? stats.lastSessionDate === yesterdayKey ? stats.streak + 1 : 1
    : stats.streak;
  const gainedXp = 50 + Math.max(1, Math.floor(seconds / 6));
  const withXp = addXp(stats, gainedXp);

  return {
    ...withXp,
    streak,
    totalSeconds: stats.totalSeconds + seconds,
    sessionsCompleted: stats.sessionsCompleted + 1,
    lastSessionDate: isAtOrAfterLatest ? day : stats.lastSessionDate,
    weeklySeconds: {
      ...stats.weeklySeconds,
      [day]: (stats.weeklySeconds[day] ?? 0) + seconds
    }
  };
}

export function addCompletedSession(stats: Stats, seconds: number): Stats {
  return addCompletedSessionAt(stats, seconds, new Date());
}

export function makeMood(stage: "before" | "after", value: number, note: string): MoodEntry {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    stage,
    value,
    note
  };
}

export function makeJournal(
  title: string,
  body: string,
  meditation?: string,
  kind: JournalEntryType["kind"] = meditation ? "meditation" : "journal",
  createdAt = new Date().toISOString(),
  source: JournalEntryType["source"] = "manual"
): JournalEntry {
  return {
    id: crypto.randomUUID(),
    createdAt,
    title,
    body,
    meditation,
    kind,
    source
  };
}

export function makeEmotionalTool(
  name: string,
  details: string,
  usefulFor: EmotionalTool["usefulFor"],
  expectedOutcome: EmotionalTool["expectedOutcome"]
): EmotionalTool {
  return {
    id: crypto.randomUUID(),
    name,
    details,
    usefulFor,
    expectedOutcome,
    createdAt: new Date().toISOString(),
    isCustom: true
  };
}

export function startEmotionalToolAttempt(toolId: string, beforeMood: number): EmotionalToolAttempt {
  return {
    id: crypto.randomUUID(),
    toolId,
    beforeMood,
    startedAt: new Date().toISOString()
  };
}

export function importJournalText(text: string): JournalEntry[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    const rows = Array.isArray(parsed) ? parsed : parsed.journal;
    if (Array.isArray(rows)) {
      return rows
        .filter((row) => row && (row.body || row.text || row.content))
        .map((row) => ({
          id: crypto.randomUUID(),
          createdAt: row.createdAt || row.date || new Date().toISOString(),
          title: row.title || "Imported reflection",
          body: row.body || row.text || row.content,
          meditation: row.meditation,
          kind: row.kind || (row.meditation ? "meditation" : "journal"),
          source: "imported"
        }));
    }
  } catch {
    // Fall through to plain-text import.
  }

  return trimmed
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((body, index) => ({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      title: `Imported reflection ${index + 1}`,
      body: body.trim(),
      kind: "journal",
      source: "imported"
    }));
}
