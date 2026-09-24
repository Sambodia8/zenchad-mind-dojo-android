import type { JournalEntry } from "./types";

/** Newest practice/reflection first, independent of import or insertion order. */
export function chronologicalJournal(entries: JournalEntry[]): JournalEntry[] {
  const timestamp = (entry: JournalEntry) => {
    const parsed = Date.parse(entry.createdAt);
    return Number.isFinite(parsed) ? parsed : -Infinity;
  };
  return [...entries].sort((a, b) => {
    const left = timestamp(a), right = timestamp(b);
    return left === right ? a.id.localeCompare(b.id) : left > right ? -1 : 1;
  });
}

export function serialiseJournal(entries: JournalEntry[]) {
  return JSON.stringify(chronologicalJournal(entries), null, 2);
}
