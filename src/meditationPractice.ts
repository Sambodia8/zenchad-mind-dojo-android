import type { AppData } from "./types";
import { localDateKey, localCalendarDayDistance } from "./streakFreeze";

export type PracticePreset = "free" | "focus-refocus";
export type PracticeMode = "countdown" | "stopwatch";
export interface PracticePreferences {
  mode: PracticeMode;
  durationSeconds: number;
  startingBell: boolean;
  endingBell: boolean;
  hideClock: boolean;
  keepAwake: boolean;
  encouragementEnabled: boolean;
}
export interface PracticeState {
  id: string;
  preset: PracticePreset;
  mode: PracticeMode;
  targetSeconds: number;
  status: "running" | "paused" | "interrupted" | "completed";
  elapsedSeconds: number;
  startedAt: string;
  completedAt?: string;
  endingBell: boolean;
  bellDelivered?: boolean;
}
export interface PracticeSession {
  id: string;
  preset: PracticePreset;
  mode: PracticeMode;
  targetSeconds: number;
  activeSeconds: number;
  completedAt: string;
  practiceDay: string;
  xp: number;
  zenPoints: number;
}
export interface FocusGoal { id: string; startedDay: string; updatedAt: string }
export const PRACTICE_KEY = "zenchad_active_practice_v1";
export const DEFAULT_PRACTICE_PREFERENCES: PracticePreferences = {
  mode: "countdown", durationSeconds: 780, startingBell: false,
  endingBell: true, hideClock: false, keepAwake: false, encouragementEnabled: true
};
export function practiceSeconds(value: number) {
  return Number.isFinite(value) ? Math.max(60, Math.min(10800, Math.floor(value))) : 780;
}
export function migratePracticePreferences(value: unknown): PracticePreferences {
  const saved = (value && typeof value === "object" ? value : {}) as Partial<PracticePreferences>;
  const bool = (key: keyof PracticePreferences) => typeof saved[key] === "boolean" ? saved[key] as boolean : DEFAULT_PRACTICE_PREFERENCES[key] as boolean;
  return { mode: saved.mode === "stopwatch" ? "stopwatch" : "countdown", durationSeconds: practiceSeconds(saved.durationSeconds ?? 780),
    startingBell: bool("startingBell"), endingBell: bool("endingBell"), hideClock: bool("hideClock"), keepAwake: bool("keepAwake"), encouragementEnabled: bool("encouragementEnabled") };
}
export function migratePracticeSessions(value: unknown): PracticeSession[] {
  if (!Array.isArray(value)) return [];
  const sessions = value.filter((s): s is PracticeSession => s && typeof s.id === "string" &&
    (s.preset === "free" || s.preset === "focus-refocus") && (s.mode === "countdown" || s.mode === "stopwatch") &&
    Number.isFinite(s.activeSeconds) && s.activeSeconds >= 0 && Number.isFinite(s.targetSeconds) &&
    Number.isFinite(s.xp) && Number.isFinite(s.zenPoints) && Number.isFinite(Date.parse(s.completedAt)) && /^\d{4}-\d{2}-\d{2}$/.test(s.practiceDay));
  return [...new Map(sessions.map(s => [s.id, s])).values()];
}
export function migrateFocusGoal(value: unknown): FocusGoal | null {
  const g = value as FocusGoal | null;
  return g && typeof g.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.startedDay) && Number.isFinite(Date.parse(g.updatedAt)) ? g : null;
}
export function creditedPracticeSeconds(state: PracticeState) {
  const seconds = Math.max(0, Math.floor(Number.isFinite(state.elapsedSeconds) ? state.elapsedSeconds : 0));
  return state.mode === "countdown" ? Math.min(practiceSeconds(state.targetSeconds), seconds) : seconds;
}
export function practiceXp(seconds: number) { return seconds >= 60 ? 50 + Math.floor(seconds / 6) : 0; }
export function focusGoalDays(data: Pick<AppData, "focusGoal" | "practiceSessions">) {
  if (!data.focusGoal) return new Set<string>();
  const start = data.focusGoal.startedDay;
  return new Set(data.practiceSessions.filter(s => s.preset === "focus-refocus" && s.activeSeconds >= 780 &&
    (localCalendarDayDistance(start, s.practiceDay) ?? -1) >= 0 && (localCalendarDayDistance(start, s.practiceDay) ?? 56) < 56).map(s => s.practiceDay));
}
export function startFocusGoal(now = new Date()): FocusGoal {
  return { id: crypto.randomUUID(), startedDay: localDateKey(now), updatedAt: now.toISOString() };
}
export function goalDates(start: string) {
  const [y,m,d] = start.split("-").map(Number);
  return Array.from({length:56}, (_, i) => localDateKey(new Date(y,m-1,d+i)));
}
export function formatPracticeTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return s >= 3600 ? `${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,"0")}:${String(s%60).padStart(2,"0")}` : `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
}
