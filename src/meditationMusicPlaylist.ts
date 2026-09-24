import type { MeditationMusicTrack } from "./soundscapeAudio";

export const MUSIC_CROSSFADE_SECONDS = 8;
export const MUSIC_CYCLE_COUNTER_KEY = "zenchad_meditation_music_cycle_v1";

type CounterStorage = Pick<Storage, "getItem" | "setItem">;

export interface MusicTimelineEntry {
  track: MeditationMusicTrack;
  startSeconds: number;
  endSeconds: number;
}

export interface MusicTimelinePosition {
  current: MusicTimelineEntry;
  previous?: MusicTimelineEntry;
  currentOffsetSeconds: number;
  previousOffsetSeconds?: number;
  crossfadeProgress: number;
}

function shuffled<T>(values: readonly T[], random: () => number) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function counterRandom(counter: number) {
  let state = (counter + 0x6d2b79f5) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function readMusicCycleCounter(
  storage: CounterStorage = localStorage
) {
  try {
    const saved = Number.parseInt(storage.getItem(MUSIC_CYCLE_COUNTER_KEY) ?? "0", 10);
    return Number.isSafeInteger(saved) && saved >= 0 ? saved : 0;
  } catch {
    // A deterministic first cycle remains available if storage is unavailable.
    return 0;
  }
}

export function takeNextMusicCycleCounter(
  storage: CounterStorage = localStorage
) {
  const current = readMusicCycleCounter(storage);
  try {
    storage.setItem(MUSIC_CYCLE_COUNTER_KEY, String(current + 1));
  } catch {
    // A deterministic first cycle remains available if storage is unavailable.
  }
  return current;
}

export function buildMusicQueueIdsForCounter(
  tracks: readonly MeditationMusicTrack[],
  sessionDurationSeconds: number,
  counter: number,
  preferredFirstId?: string
) {
  return buildMusicQueueIds(
    tracks,
    sessionDurationSeconds,
    counterRandom(counter),
    preferredFirstId
  );
}

export function buildMusicQueueIds(
  tracks: readonly MeditationMusicTrack[],
  sessionDurationSeconds: number,
  random: () => number = Math.random,
  preferredFirstId?: string
) {
  if (tracks.length === 0) return [];

  const queue: string[] = [];
  let coveredSeconds = 0;
  let previousId: string | undefined;
  const minimumCoverage = Math.max(sessionDurationSeconds, 1)
    + Math.max(...tracks.map((track) => track.durationSeconds));

  while (coveredSeconds < minimumCoverage) {
    let cycle = shuffled(tracks, random);
    if (queue.length === 0 && preferredFirstId) {
      const preferredIndex = cycle.findIndex((track) => track.id === preferredFirstId);
      if (preferredIndex >= 0) {
        const [preferred] = cycle.splice(preferredIndex, 1);
        cycle.unshift(preferred);
      }
    }
    if (cycle.length > 1 && cycle[0]?.id === previousId) {
      const swapIndex = cycle.findIndex((track) => track.id !== previousId);
      [cycle[0], cycle[swapIndex]] = [cycle[swapIndex], cycle[0]];
    }

    for (const track of cycle) {
      queue.push(track.id);
      coveredSeconds += Math.max(1, track.durationSeconds - MUSIC_CROSSFADE_SECONDS);
      previousId = track.id;
    }
  }
  return queue;
}

export function buildMusicTimeline(
  queueIds: readonly string[],
  tracks: readonly MeditationMusicTrack[],
  failedTrackIds: ReadonlySet<string> = new Set()
) {
  const byId = new Map(tracks.map((track) => [track.id, track]));
  const queue = queueIds
    .map((id) => byId.get(id))
    .filter((track): track is MeditationMusicTrack => Boolean(track && !failedTrackIds.has(track.id)));
  const timeline: MusicTimelineEntry[] = [];
  let startSeconds = 0;
  for (const track of queue) {
    const entry = {
      track,
      startSeconds,
      endSeconds: startSeconds + track.durationSeconds
    };
    timeline.push(entry);
    startSeconds += Math.max(1, track.durationSeconds - MUSIC_CROSSFADE_SECONDS);
  }
  return timeline;
}

export function locateMusicTimeline(
  timeline: readonly MusicTimelineEntry[],
  elapsedSeconds: number
): MusicTimelinePosition | undefined {
  if (timeline.length === 0) return undefined;
  const elapsed = Math.max(0, elapsedSeconds);
  let currentIndex = 0;
  for (let index = 1; index < timeline.length; index += 1) {
    if (timeline[index].startSeconds > elapsed) break;
    currentIndex = index;
  }

  const current = timeline[currentIndex];
  const previous = currentIndex > 0 ? timeline[currentIndex - 1] : undefined;
  const overlap = previous && elapsed < previous.endSeconds ? previous : undefined;
  const crossfadeProgress = overlap
    ? Math.min(1, Math.max(0, (elapsed - current.startSeconds) / MUSIC_CROSSFADE_SECONDS))
    : 1;

  return {
    current,
    previous: overlap,
    currentOffsetSeconds: Math.max(0, elapsed - current.startSeconds),
    previousOffsetSeconds: overlap ? Math.max(0, elapsed - overlap.startSeconds) : undefined,
    crossfadeProgress
  };
}
