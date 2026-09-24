import type { Meditation } from "./types";

/** Keep every phase, including the closing, in an exact five-minute practice. */
export function fiveMinuteMeditation(meditation: Meditation): Meditation {
  const total = meditation.phases.reduce((sum, phase) => sum + phase.duration, 0);
  let boundary = 0;
  let assigned = 0;
  return {
    ...meditation,
    phases: meditation.phases.map((phase) => {
      boundary += phase.duration;
      const next = Math.round(boundary / total * 300);
      const duration = next - assigned;
      assigned = next;
      return { ...phase, duration };
    })
  };
}
