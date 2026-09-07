import type { StreakFreezeNotice } from "./types";

export const STREAK_FREEZE_ITEM_ID = "streak-freeze";

export const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function dateKeyOrdinal(key: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null;
  return Math.floor(timestamp / 86_400_000);
}

export function localCalendarDayDistance(fromKey: string, toKey: string) {
  const from = dateKeyOrdinal(fromKey);
  const to = dateKeyOrdinal(toKey);
  return from === null || to === null ? null : to - from;
}

export function nextLocalDateKey(key: string) {
  const ordinal = dateKeyOrdinal(key);
  if (ordinal === null) return null;
  return new Date((ordinal + 1) * 86_400_000).toISOString().slice(0, 10);
}

export interface StreakFreezeDecision {
  consumed: boolean;
  notice: StreakFreezeNotice | null;
}

export function decideStreakFreeze(
  lastSessionDate: string | null,
  sessionDate: Date,
  ownedCount: number
): StreakFreezeDecision {
  if (!lastSessionDate || Math.max(0, Math.floor(ownedCount)) < 1) {
    return { consumed: false, notice: null };
  }
  const sessionDateKey = localDateKey(sessionDate);
  if (localCalendarDayDistance(lastSessionDate, sessionDateKey) !== 2) {
    return { consumed: false, notice: null };
  }
  const missedDate = nextLocalDateKey(lastSessionDate);
  if (!missedDate) return { consumed: false, notice: null };
  return {
    consumed: true,
    notice: {
      consumedAt: sessionDate.toISOString(),
      missedDate,
      sessionDate: sessionDateKey,
      remaining: Math.max(0, Math.floor(ownedCount) - 1)
    }
  };
}
