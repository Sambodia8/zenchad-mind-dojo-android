import {
  STORY_CHAPTERS,
  storyPhaseChapterIndex,
  type StoryChapterId
} from "./runningStoryChapters";

export type StoryLiveAudioState = "idle" | "pending" | "playing" | "failed";

export interface StoryLiveUiState {
  episode: number;
  missionTitle: string;
  phase: string;
  heardChapterIds: StoryChapterId[];
  audioState: StoryLiveAudioState;
  audioLabel: string;
  audioError: string;
  transcript: string;
  chaseCount: number;
  helicopterTriggered: boolean;
  onReplay?: () => void;
}

const PANEL_ID = "zenchad-story-live-panel";

function escapeText(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character] ?? character);
}

export function removeStoryLivePanel() {
  document.getElementById(PANEL_ID)?.remove();
}

export function renderStoryLivePanel(state: StoryLiveUiState) {
  const radio = document.querySelector<HTMLElement>(".running-story-radio");
  if (!radio?.parentElement) return;
  const existing = document.getElementById(PANEL_ID);
  const panel = existing ?? document.createElement("section");
  panel.id = PANEL_ID;
  panel.className = "running-story-live-panel";
  panel.setAttribute("aria-live", "polite");

  const currentIndex = storyPhaseChapterIndex(state.phase, state.heardChapterIds);
  // Story state refreshes while the runner moves; retain their chosen panel size
  // instead of reopening a section they deliberately collapsed.
  const detailsOpen = existing?.querySelector<HTMLDetailsElement>(".running-story-live-details")?.open ?? true;
  const current = STORY_CHAPTERS[currentIndex];
  const next = STORY_CHAPTERS[Math.min(STORY_CHAPTERS.length - 1, currentIndex + 1)];
  const audioHeadline = state.audioState === "playing"
    ? "Narration playing"
    : state.audioState === "failed"
      ? "Audio failed"
      : state.audioState === "pending"
        ? "Next transmission queued"
        : "Listening for the next transmission";
  const audioDetail = state.audioState === "failed"
    ? state.audioError || "The story is paused here until the transmission is replayed."
    : state.audioLabel || (state.audioState === "playing" ? "Runner radio is speaking now." : `Next: ${next.title}`);
  const markup = `
    <details class="running-story-live-details"${detailsOpen ? " open" : ""}>
      <summary class="running-story-live-heading">
        <div><span class="eyebrow">Runner Story active · Episode ${state.episode}</span><strong>${escapeText(state.missionTitle)}</strong></div>
        <span class="running-story-live-status" data-state="${state.audioState}"><i aria-hidden="true"></i>${audioHeadline}</span>
        <span class="running-story-live-toggle" aria-hidden="true">Hide</span>
      </summary>
      <div class="running-story-live-content">
        <div class="running-story-chapter-heading"><span>Chapter ${currentIndex + 1} of ${STORY_CHAPTERS.length}</span><strong>${escapeText(current.title)}</strong><small>${escapeText(current.detail)}</small></div>
        <div class="running-story-chapter-rail" aria-label="Story chapter progress">
          ${STORY_CHAPTERS.map((chapter, index) => `<span class="${state.heardChapterIds.includes(chapter.id) ? "heard" : ""} ${index === currentIndex ? "current" : ""}" title="${escapeText(chapter.title)}"><i></i><small>${index + 1}</small></span>`).join("")}
        </div>
        <div class="running-story-now-next"><span><small>Now</small><strong>${escapeText(audioHeadline)}</strong><em>${escapeText(audioDetail)}</em></span><span><small>Next</small><strong>${escapeText(next.title)}</strong><em>${currentIndex === STORY_CHAPTERS.length - 1 ? "Mission close and next-episode reveal" : escapeText(next.detail)}</em></span></div>
        ${state.transcript ? `<blockquote>“${escapeText(state.transcript)}”</blockquote>` : ""}
        <div class="running-story-event-strip"><span>${state.chaseCount} pursuit${state.chaseCount === 1 ? "" : "s"}</span><span>${state.helicopterTriggered ? "Air unit encountered" : "Air unit pending"}</span>${state.onReplay && state.transcript ? `<button type="button" data-story-replay ${state.audioState === "playing" || state.audioState === "pending" ? "disabled" : ""}>${state.audioState === "playing" ? "Narration playing" : state.audioState === "pending" ? "Transmission queued" : "Replay last transmission"}</button>` : ""}</div>
      </div>
    </details>
  `;
  if (panel.innerHTML !== markup) panel.innerHTML = markup;
  const replay = panel.querySelector<HTMLButtonElement>("[data-story-replay]");
  if (replay) replay.onclick = state.onReplay ?? null;
  if (!existing) radio.insertAdjacentElement("afterend", panel);
}
