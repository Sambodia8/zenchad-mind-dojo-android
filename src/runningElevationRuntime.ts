import { loadRunSession, loadRunningProfile } from "./running";
import { elevationProfilePoints, enrichRunElevation, loadRunElevation } from "./runningElevation";

const PANEL_ID = "zenchad-running-elevation-panel";
let started = false;
let enrichingRunId: string | null = null;

function renderCurrentRun() {
  const session = loadRunSession();
  const results = document.querySelector<HTMLElement>(".running-results-card");
  if (!session || session.stage !== "complete" || !results?.parentElement) {
    document.getElementById(PANEL_ID)?.remove();
    return;
  }
  const record = loadRunningProfile().history.find((item) => item.id === session.id);
  if (!record) return;
  const elevation = loadRunElevation(record.id);
  if (!elevation && enrichingRunId !== record.id) {
    enrichingRunId = record.id;
    void enrichRunElevation(record).finally(() => {
      enrichingRunId = null;
      renderCurrentRun();
    });
  }

  const existing = document.getElementById(PANEL_ID);
  const panel = existing ?? document.createElement("section");
  panel.id = PANEL_ID;
  panel.className = "card running-elevation-panel";

  if (!elevation) {
    panel.innerHTML = `<span class="eyebrow">Terrain</span><strong>Reading the hills…</strong><small>The run is already banked. Elevation is being added afterwards.</small>`;
  } else if (elevation.status !== "ready") {
    panel.innerHTML = `<span class="eyebrow">Terrain</span><strong>Elevation unavailable</strong><small>No problem — the recorded run and GPS trace are still saved.</small>`;
  } else {
    const trace = elevationProfilePoints(elevation.samples);
    panel.innerHTML = `
      <div class="section-heading"><div><span class="eyebrow">Terrain</span><h2>Elevation</h2></div><strong>+${Math.round(elevation.gainMeters)} m</strong></div>
      <svg class="running-elevation-chart" viewBox="0 0 100 100" role="img" aria-label="Elevation profile"><polyline points="${trace}"></polyline></svg>
      <div class="running-elevation-stats">
        <span><small>GAIN</small><strong>${Math.round(elevation.gainMeters)} m</strong></span>
        <span><small>LOSS</small><strong>${Math.round(elevation.lossMeters)} m</strong></span>
        <span><small>LOW</small><strong>${Math.round(elevation.minMeters)} m</strong></span>
        <span><small>HIGH</small><strong>${Math.round(elevation.maxMeters)} m</strong></span>
      </div>
    `;
  }

  if (!existing) results.insertAdjacentElement("afterend", panel);
}

export function startRunningElevationRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;
  window.addEventListener("storage", renderCurrentRun);
  window.setInterval(renderCurrentRun, 3000);
  queueMicrotask(renderCurrentRun);
}
