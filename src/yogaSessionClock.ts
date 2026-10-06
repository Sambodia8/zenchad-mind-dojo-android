export interface YogaActiveClock { elapsedMs: number; activeAt: number | null }

// Monotonic time starts fresh after a reopen; only saved active time carries over.
export function updateYogaActiveClock(clock: YogaActiveClock, active: boolean, now: number): YogaActiveClock {
  return {
    elapsedMs: clock.elapsedMs + (clock.activeAt === null ? 0 : Math.max(0, now - clock.activeAt)),
    activeAt: active ? now : null
  };
}

export function restoredYogaActiveSeconds(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
