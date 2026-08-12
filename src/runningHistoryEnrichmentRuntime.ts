import { loadRunningProfile } from "./running";
import { enrichRunElevation, elevationProfilePoints, loadRunElevation } from "./runningElevation";
import { storyOutcomeLabel, storyResultForRun } from "./runningStoryResults";

const ENRICHMENT_CLASS = "running-history-enrichment";
let started = false;
const elevationInFlight = new Set<string>();

function escapeText(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character] ?? character);
}

function render() {
  const details = Array.from(document.querySelectorAll<HTMLElement>(".running-history-detail"));
  if (!details.length) return;
  const history = loadRunningProfile().history;

  details.forEach((detail, index) => {
    const record = history[index];
    if (!record) return;
    let panel = detail.querySelector<HTMLElement>(`.${ENRICHMENT_CLASS}`);
    const story = storyResultForRun(record.id);
    const elevation = loadRunElevation(record.id);

    if (!elevation && record.points.length >= 2 && !elevationInFlight.has(record.id)) {
      elevationInFlight.add(record.id);
      void enrichRunElevation(record).finally(() => {
        elevationInFlight.delete(record.id);
        render();
      });
    }

    if (!story && !elevation) return;
    if (!panel) {
      panel = document.createElement("div");
      panel.className = ENRICHMENT_CLASS;
      detail.appendChild(panel);
    }

    const storyMarkup = story ? `
      <section class="running-history-story-block">
        <span class="eyebrow">Mission log</span>
        <strong>${escapeText(story.missionTitle)}</strong>
        <small>${escapeText(storyOutcomeLabel(story.lastOutcome))} · ${story.chaseCount} chase${story.chaseCount === 1 ? "" : "s"}${story.helicopterEncountered ? " · air unit encountered" : ""}</small>
      </section>
    ` : "";

    let elevationMarkup = "";
    if (elevation?.status === "ready") {
      elevationMarkup = `
        <section class="running-history-elevation-block">
          <div><span class="eyebrow">Elevation</span><strong>+${Math.round(elevation.gainMeters)} m</strong><small>${Math.round(elevation.minMeters)}–${Math.round(elevation.maxMeters)} m</small></div>
          <svg viewBox="0 0 100 100" role="img" aria-label="Elevation profile"><polyline points="${elevationProfilePoints(elevation.samples)}"></polyline></svg>
        </section>
      `;
    }

    panel.innerHTML = `${storyMarkup}${elevationMarkup}`;
  });
}

export function startRunningHistoryEnrichmentRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;
  window.addEventListener("storage", render);
  window.setInterval(render, 2500);
  queueMicrotask(render);
}
