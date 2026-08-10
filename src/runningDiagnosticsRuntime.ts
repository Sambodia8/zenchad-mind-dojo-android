import { collectRunningDiagnostics, formatRunningDiagnostics, type RunningDiagnosticsSnapshot } from "./runningDiagnostics";

const PANEL_ID = "zenchad-running-diagnostics";
let started = false;
let refreshing = false;
let latest: RunningDiagnosticsSnapshot | null = null;

function value(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "YES" : "NO";
  return String(value);
}

function render() {
  const progressGrid = document.querySelector<HTMLElement>(".running-progress-grid");
  if (!progressGrid?.parentElement) {
    document.getElementById(PANEL_ID)?.remove();
    return;
  }

  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.className = "card running-diagnostics-card";
    progressGrid.parentElement.appendChild(panel);
  }

  if (!latest) {
    panel.innerHTML = `<div class="section-heading"><div><span class="eyebrow">Field test</span><h2>Running diagnostics</h2></div></div><p>Checking the run systems…</p>`;
    return;
  }

  const routeOk = latest.route.ready ? "READY" : latest.route.status.toUpperCase();
  const trackerOk = latest.nativeTracker.available ? (latest.nativeTracker.running ? "RUNNING" : "IDLE") : "WEB ONLY";
  const storyOk = latest.story.native ? latest.story.phase.toUpperCase() : "BROWSER";
  panel.innerHTML = `
    <div class="section-heading"><div><span class="eyebrow">Field test</span><h2>Running diagnostics</h2></div><strong>PRIVACY SAFE</strong></div>
    <p>This panel intentionally omits coordinates and route geometry. Copy it after a test run if GPS, navigation, Story audio or watch stats behave strangely.</p>
    <div class="running-diagnostics-grid">
      <span><small>APP</small><strong>${latest.app.stage.toUpperCase()}</strong><b>${latest.app.runPointCount} pts · ${latest.app.runDistanceMeters} m</b></span>
      <span><small>NATIVE GPS</small><strong>${trackerOk}</strong><b>${value(latest.nativeTracker.lastAccuracyMeters)} m accuracy</b></span>
      <span><small>ROUTE</small><strong>${routeOk}</strong><b>${latest.route.maneuverCount} turns · ${latest.route.rerouteCount} reroutes</b></span>
      <span><small>STORY</small><strong>${storyOk}</strong><b>${value(latest.story.chaseCount)} chases</b></span>
      <span><small>AUDIO</small><strong>${latest.story.effectsEnabled === false ? "FX MUTED" : `${value(latest.story.effectsVolumePercent)}% FX`}</strong><b>${value(latest.story.voiceVolumePercent)}% voice</b></span>
      <span><small>WATCH DATA</small><strong>${latest.health.supported ? "AVAILABLE" : latest.health.availableOnBuild ? "NOT READY" : "N/A"}</strong><b>permission ${latest.health.permissionGranted ? "on" : "off"}</b></span>
    </div>
    <div class="running-diagnostics-actions">
      <button type="button" class="button secondary" data-running-diagnostics-refresh>${refreshing ? "CHECKING…" : "REFRESH"}</button>
      <button type="button" class="button primary" data-running-diagnostics-copy>COPY DIAGNOSTICS</button>
    </div>
    <small data-running-diagnostics-message>${latest.route.message}</small>
  `;

  const refreshButton = panel.querySelector<HTMLButtonElement>("[data-running-diagnostics-refresh]");
  if (refreshButton) refreshButton.onclick = () => { void refresh(); };
  const copyButton = panel.querySelector<HTMLButtonElement>("[data-running-diagnostics-copy]");
  if (copyButton) {
    copyButton.onclick = async () => {
      const text = formatRunningDiagnostics(latest!);
      const message = panel!.querySelector<HTMLElement>("[data-running-diagnostics-message]");
      try {
        await navigator.clipboard.writeText(text);
        if (message) message.textContent = "Diagnostics copied. No coordinates included.";
      } catch {
        if (message) message.textContent = "Clipboard was unavailable. Try again while Zenchad is in the foreground.";
      }
    };
  }
}

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  render();
  try {
    latest = await collectRunningDiagnostics();
  } finally {
    refreshing = false;
    render();
  }
}

export function startRunningDiagnosticsRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;
  const observer = new MutationObserver(() => {
    if (document.querySelector(".running-progress-grid")) {
      render();
      if (!latest) void refresh();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("pageshow", () => { latest = null; void refresh(); });
  window.setInterval(() => {
    if (document.getElementById(PANEL_ID)) void refresh();
  }, 12_000);
  queueMicrotask(() => { void refresh(); });
}
