export const STORY_CHAPTERS = [
  { id: "briefing", title: "Briefing", detail: "Mission channel opens and the objective becomes clear." },
  { id: "contact", title: "Contact", detail: "The network reacts and the first threat appears." },
  { id: "pursuit", title: "Pursuit", detail: "The pressure rises and your route becomes part of the story." },
  { id: "complication", title: "Complication", detail: "A new obstacle changes the shape of the mission." },
  { id: "extraction", title: "Extraction", detail: "Bring the mission home and reveal what comes next." }
] as const;

export type StoryChapterId = typeof STORY_CHAPTERS[number]["id"];

export const STORY_CHAPTER_IDS = STORY_CHAPTERS.map((chapter) => chapter.id);

export function storyChapterIdForLineKey(lineKey: string): StoryChapterId | null {
  const key = lineKey.toLowerCase();
  if (key.includes("opening-2") || key.includes("watcher")) return "contact";
  if (key.includes("outcome") || key.includes("complication")) return "complication";
  if (key.includes("pursuer") || key.includes("pursuit") || key.includes("chase")) return "pursuit";
  if (key.includes("helicopter") || key.includes("air-unit")) return "complication";
  if (key.includes("home") || key.includes("extraction")) return "extraction";
  if (key.includes("opening") || key.includes("briefing")) return "briefing";
  return null;
}

export function storyChaptersForLineKeys(lineKeys: string[]) {
  const heard = new Set<StoryChapterId>();
  for (const key of lineKeys) {
    const chapter = storyChapterIdForLineKey(key);
    if (chapter) heard.add(chapter);
  }
  return STORY_CHAPTER_IDS.filter((id) => heard.has(id));
}

export function storyChapterProgressIndex(heardChapterIds: StoryChapterId[]) {
  const heard = new Set(heardChapterIds);
  const firstMissing = STORY_CHAPTER_IDS.findIndex((id) => !heard.has(id));
  return firstMissing === -1 ? STORY_CHAPTERS.length - 1 : firstMissing;
}

export function storyPhaseChapterIndex(phase: string, heardChapterIds: StoryChapterId[] = []) {
  const phaseIndex = phase === "home"
    ? 4
    : phase === "helicopter"
      ? 3
      : phase === "chase" || phase === "aftermath"
        ? 2
        : phase === "cruise"
          ? 1
          : 0;
  return Math.max(phaseIndex, storyChapterProgressIndex(heardChapterIds));
}

export function storyNarrationIsVerified(heardChapterIds: StoryChapterId[]) {
  const heard = new Set(heardChapterIds);
  return STORY_CHAPTER_IDS.every((id) => heard.has(id));
}

export function storyChapterTranscript(
  mission: {
    openingLine: string;
    watcherLine: string;
    pursuerLine: string;
    chaseLine: string;
    helicopterLine: string;
    homeLine: string;
    extractionLine: string;
  },
  chapterId: StoryChapterId
) {
  if (chapterId === "briefing") return mission.openingLine;
  if (chapterId === "contact") return mission.watcherLine;
  if (chapterId === "pursuit") return mission.pursuerLine || mission.chaseLine;
  if (chapterId === "complication") return mission.helicopterLine;
  return `${mission.homeLine} ${mission.extractionLine}`.trim();
}
