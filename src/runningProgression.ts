import type { RunPoint, RunRecord } from "./running";

export interface RunningStreakState {
  currentDays: number;
  bestDays: number;
  lastRunDay: string | null;
}

export interface RunningAchievementUnlock {
  id: string;
  title: string;
  detail: string;
  unlockedAt: number;
  runId: string;
}

export interface RunnerSector {
  id: string;
  label: string;
  centerLat: number;
  centerLng: number;
  bearingDegrees: number;
  lengthMeters: number;
  visits: number;
  firstSeenAt: number;
  lastSeenAt: number;
  bestDurationSeconds: number;
  discovered: boolean;
}

export interface RunningProgressionState {
  version: 1;
  processedRunIds: string[];
  streak: RunningStreakState;
  achievements: RunningAchievementUnlock[];
  sectors: RunnerSector[];
}

const PROGRESSION_KEY = "zenchad_running_progression_v1";
const SECTOR_LENGTH_METERS = 450;
const SECTOR_STRIDE_METERS = 500;

export const RUNNING_ACHIEVEMENTS = [
  { id: "first-run", title: "First Footfall", detail: "Bank your first run." },
  { id: "first-story", title: "Runner Online", detail: "Complete your first Story Run." },
  { id: "five-runs", title: "Finding A Rhythm", detail: "Bank 5 runs." },
  { id: "ten-runs", title: "Regular Runner", detail: "Bank 10 runs." },
  { id: "first-5k", title: "Five Kilometres Banked", detail: "Cover at least 5 km in one run." },
  { id: "twenty-five-k", title: "25K In The Legs", detail: "Accumulate 25 km across runs." },
  { id: "planned-run", title: "Called It", detail: "Reach 100% of a run you planned." },
  { id: "first-pb", title: "Surprise Yourself", detail: "Discover a personal best after a run." },
  { id: "three-day-streak", title: "Three On The Bounce", detail: "Run on 3 consecutive days." },
  { id: "five-story-runs", title: "Known On The Network", detail: "Complete 5 Story Runs." }
] as const;

const emptyState = (): RunningProgressionState => ({
  version: 1,
  processedRunIds: [],
  streak: { currentDays: 0, bestDays: 0, lastRunDay: null },
  achievements: [],
  sectors: []
});

export function loadRunningProgression(): RunningProgressionState {
  try {
    const raw = localStorage.getItem(PROGRESSION_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<RunningProgressionState>;
    return {
      version: 1,
      processedRunIds: Array.isArray(parsed.processedRunIds) ? parsed.processedRunIds : [],
      streak: parsed.streak ?? { currentDays: 0, bestDays: 0, lastRunDay: null },
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      sectors: Array.isArray(parsed.sectors) ? parsed.sectors : []
    };
  } catch {
    return emptyState();
  }
}

export function saveRunningProgression(state: RunningProgressionState) {
  localStorage.setItem(PROGRESSION_KEY, JSON.stringify(state));
}

function localDayKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayOrdinal(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function updateRunningStreak(streak: RunningStreakState, runEndedAt: number): RunningStreakState {
  const day = localDayKey(runEndedAt);
  if (day === streak.lastRunDay) return streak;
  let currentDays = 1;
  if (streak.lastRunDay && dayOrdinal(day) - dayOrdinal(streak.lastRunDay) === 1) {
    currentDays = Math.max(1, streak.currentDays + 1);
  }
  return {
    currentDays,
    bestDays: Math.max(streak.bestDays, currentDays),
    lastRunDay: day
  };
}

export function runningStreakMultiplier(streakDays: number) {
  // Bonus-only: the underlying run reward is never reduced. This tops out at +50%.
  return 1 + Math.min(0.5, Math.max(0, streakDays - 1) * 0.05);
}

function radians(value: number) {
  return value * Math.PI / 180;
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radius = 6_371_000;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bearingDegrees(a: RunPoint, b: RunPoint) {
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const dLng = radians(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function orientationDifference(a: number, b: number) {
  const raw = Math.abs(a - b) % 180;
  return Math.min(raw, 180 - raw);
}

function pointAtDistance(points: RunPoint[], targetMeters: number) {
  if (!points.length) return null;
  let best = points[0];
  let bestError = Math.abs((best.distanceFromStart ?? 0) - targetMeters);
  for (const point of points) {
    const error = Math.abs((point.distanceFromStart ?? 0) - targetMeters);
    if (error < bestError) {
      best = point;
      bestError = error;
    }
  }
  return best;
}

function sectorSamples(record: RunRecord) {
  const total = record.distanceMeters;
  if (total < SECTOR_LENGTH_METERS + 100) return [];
  const samples: Array<{
    centerLat: number;
    centerLng: number;
    bearingDegrees: number;
    durationSeconds: number;
  }> = [];

  for (let start = 200; start + SECTOR_LENGTH_METERS <= total - 100; start += SECTOR_STRIDE_METERS) {
    const first = pointAtDistance(record.points, start);
    const last = pointAtDistance(record.points, start + SECTOR_LENGTH_METERS);
    if (!first || !last || last.at <= first.at) continue;
    samples.push({
      centerLat: (first.lat + last.lat) / 2,
      centerLng: (first.lng + last.lng) / 2,
      bearingDegrees: bearingDegrees(first, last),
      durationSeconds: Math.max(1, (last.at - first.at) / 1000)
    });
  }
  return samples;
}

function updateSectors(existing: RunnerSector[], record: RunRecord) {
  const sectors = existing.map((sector) => ({ ...sector }));
  for (const sample of sectorSamples(record)) {
    const match = sectors.find((sector) =>
      distanceMeters(
        { lat: sector.centerLat, lng: sector.centerLng },
        { lat: sample.centerLat, lng: sample.centerLng }
      ) <= 140 && orientationDifference(sector.bearingDegrees, sample.bearingDegrees) <= 32
    );

    if (match) {
      match.visits += 1;
      match.lastSeenAt = record.endedAt;
      match.bestDurationSeconds = Math.min(match.bestDurationSeconds, sample.durationSeconds);
      match.discovered = match.visits >= 2;
      continue;
    }

    const id = `sector-${Math.round(sample.centerLat * 10_000)}-${Math.round(sample.centerLng * 10_000)}-${Math.round(sample.bearingDegrees / 10)}`;
    sectors.push({
      id,
      label: `Runner Sector ${String(sectors.length + 1).padStart(2, "0")}`,
      centerLat: sample.centerLat,
      centerLng: sample.centerLng,
      bearingDegrees: sample.bearingDegrees,
      lengthMeters: SECTOR_LENGTH_METERS,
      visits: 1,
      firstSeenAt: record.endedAt,
      lastSeenAt: record.endedAt,
      bestDurationSeconds: sample.durationSeconds,
      discovered: false
    });
  }
  return sectors.slice(-250);
}

function achievementIdsFor(history: RunRecord[], streak: RunningStreakState) {
  const totalDistance = history.reduce((sum, run) => sum + run.distanceMeters, 0);
  const storyRuns = history.filter((run) => run.mode === "story").length;
  const ids = new Set<string>();
  if (history.length >= 1) ids.add("first-run");
  if (storyRuns >= 1) ids.add("first-story");
  if (history.length >= 5) ids.add("five-runs");
  if (history.length >= 10) ids.add("ten-runs");
  if (history.some((run) => run.distanceMeters >= 5000)) ids.add("first-5k");
  if (totalDistance >= 25_000) ids.add("twenty-five-k");
  if (history.some((run) => run.completionRatio >= 1)) ids.add("planned-run");
  if (history.some((run) => run.personalBestKeys.length > 0)) ids.add("first-pb");
  if (streak.currentDays >= 3 || streak.bestDays >= 3) ids.add("three-day-streak");
  if (storyRuns >= 5) ids.add("five-story-runs");
  return ids;
}

export function processRunningRecord(
  state: RunningProgressionState,
  record: RunRecord,
  historyUpToRecord: RunRecord[]
) {
  if (state.processedRunIds.includes(record.id)) return state;
  const streak = updateRunningStreak(state.streak, record.endedAt);
  const sectors = updateSectors(state.sectors, record);
  const earnedIds = achievementIdsFor(historyUpToRecord, streak);
  const already = new Set(state.achievements.map((achievement) => achievement.id));
  const newAchievements = RUNNING_ACHIEVEMENTS
    .filter((achievement) => earnedIds.has(achievement.id) && !already.has(achievement.id))
    .map((achievement) => ({ ...achievement, unlockedAt: record.endedAt, runId: record.id }));

  return {
    version: 1 as const,
    processedRunIds: [...state.processedRunIds, record.id].slice(-300),
    streak,
    achievements: [...state.achievements, ...newAchievements],
    sectors,
  };
}

export function progressionForHistory(history: RunRecord[]) {
  let state = loadRunningProgression();
  const ordered = [...history].sort((a, b) => a.endedAt - b.endedAt);
  const seen: RunRecord[] = [];
  for (const record of ordered) {
    seen.push(record);
    state = processRunningRecord(state, record, seen);
  }
  saveRunningProgression(state);
  return state;
}
