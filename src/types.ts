export type MeditationCategory =
  | "Focus"
  | "Relaxation"
  | "Emotional"
  | "Sensory"
  | "Spiritual"
  | "Movement";

export type PhaseKind = "prepare" | "active" | "rest" | "finish";

export interface TimerPhase {
  name: string;
  duration: number;
  kind: PhaseKind;
  instruction: string;
}

export interface Meditation {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  category: MeditationCategory;
  benefit: string;
  description: string;
  tags: string[];
  color: string;
  phases: TimerPhase[];
  youtubeQuery?: string;
  isVr?: boolean;
}

export type MovementKind = "static-stretch" | "dynamic-warmup" | "cardio";
export type SensationKind = "stretch" | "working";

export interface BodyArea {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotate?: number;
}

export interface Movement {
  id: string;
  name: string;
  image: string;
  seconds: number;
  sides?: boolean;
  cue: string;
  kind: MovementKind;
  sensationKind: SensationKind;
  muscleGroups: string[];
  sensationCue: string;
  bodyAreas: BodyArea[];
}

export interface YogaClassStep {
  movementId: string;
  seconds?: number;
  cue?: string;
  label?: string;
}

export interface YogaClass {
  id: string;
  name: string;
  timing: string;
  description: string;
  evidence: string;
  sourceUrl: string;
  focusMuscles: string[];
  image: string;
  safetyGate?: boolean;
  steps: YogaClassStep[];
}

export interface YogaClassSlide {
  movement: Movement;
  seconds: number;
  cue: string;
  label?: string;
  stepNumber: number;
  totalSteps: number;
  side?: 1 | 2;
}

export interface Stats {
  xp: number;
  level: number;
  streak: number;
  totalSeconds: number;
  sessionsCompleted: number;
  lastSessionDate: string | null;
  weeklySeconds: Record<string, number>;
  lastSeenLevel: number;
  rouletteSpins: number;
  yogaSessions: number;
}

export interface MoodEntry {
  id: string;
  createdAt: string;
  stage: "before" | "after";
  value: number;
  note: string;
}

export interface JournalEntry {
  id: string;
  createdAt: string;
  title: string;
  body: string;
  meditation?: string;
  kind?: "journal" | "meditation";
  source?: "manual" | "imported";
}

export type EmotionalMoodBand = "red" | "orange" | "yellow" | "lime" | "green";

export interface EmotionalTool {
  id: string;
  name: string;
  details: string;
  usefulFor: EmotionalMoodBand[];
  expectedOutcome: EmotionalMoodBand[];
  outcomeUncertain?: boolean;
  createdAt: string;
  isCustom: boolean;
}

export interface EmotionalToolAttempt {
  id: string;
  toolId: string;
  startedAt: string;
  completedAt?: string;
  didComplete?: boolean;
  beforeMood: number;
  afterMood?: number;
  notes?: string;
}

export interface AppPreferences {
  gentleReminderEnabled: boolean;
  gentleReminderTime: string;
  uiSoundsEnabled: boolean;
  timerAlertsEnabled: boolean;
  voiceVolume: number;
  meditationMusicEnabled: boolean;
  meditationMusicVolume: number;
  stretchMusicEnabled: boolean;
  stretchMusicTrack: "grounding" | "lofi" | "sunrise";
  stretchMusicVolume: number;
  selectedTheme: "dawn" | "forest" | "rain" | "moon" | "ember";
  reducedMotion: boolean;
}

export interface GuidedMediaItem {
  id: string;
  title: string;
  durationSeconds: number;
  url: string;
  creator?: string;
}

export interface GuidedMediaCategory {
  id: string;
  name: string;
  description: string;
  playlistUrl: string;
  items: GuidedMediaItem[];
  importNote?: string;
}

export interface AppData {
  stats: Stats;
  moods: MoodEntry[];
  journal: JournalEntry[];
  emotionalTools: EmotionalTool[];
  emotionalToolAttempts: EmotionalToolAttempt[];
  preferences: AppPreferences;
  moodScaleVersion: number;
  customYogaClasses: YogaClass[];
  downloadedSoundscapes: string[];
}

export type Route =
  | { name: "home" }
  | { name: "library"; tab?: "meditations" | "guided" | "emotional" }
  | { name: "toolkit" }
  | { name: "roulette"; autoSpin?: boolean; spinKey?: number }
  | { name: "yoga" }
  | { name: "timer"; meditationId: string }
  | { name: "yoga-pose"; movementId: string }
  | { name: "yoga-class"; classId: string }
  | { name: "journal"; draftMeditation?: string }
  | { name: "progress" }
  | { name: "guide" }
  | { name: "soundscapes" }
  | { name: "rewards" }
  | { name: "themes" }
  | { name: "settings" }
  | { name: "yoga-builder"; editClassId?: string };
