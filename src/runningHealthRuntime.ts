import { loadRunSession, loadRunningProfile, type RunRecord } from "./running";
import {
  getRunningHealthStatus,
  readNativeRunningHealth,
  requestRunningHealthPermissions,
  runningHealthForRun,
  runningHealthNativeAvailable,
  saveRunningHealth,
  type RunningHealthStatus,
  type StoredRunningHealthResult
} from "./runningHealth";

const SUMMARY_ID = "zenchad-running-health-summary";
const HISTORY_CLASS = "zenchad-running-health-history";
let started = false;
let status: RunningHealthStatus | null = null;
let statusInFlight: Promise<RunningHealthStatus | null> | null = null;
const importInFlight = new Set<string>();
const messages = new Map<string, string>();

function ensureStatus() {
  if (!runningHealthNativeAvailable()) return Promise.resolve(null);
  if (status) return Promise.resolve(status);
  if (statusInFlight) return statusInFlight;
  statusInFlight = getRunningHealthStatus()
    .then((next) => {
      status = next;
      return next;
    })
    .catch(() => null)
    .finally(() => { statusInFlight = null; });
  return statusInFlight;
}

function hasData(result: StoredRunningHealthResult) {
  return result.heartRateSampleCount > 0 || result.steps > 0 || result.cadenceSampleCount > 0;
}

function metric(value: number | null | undefined, suffix = "") {
  return Number.isFinite(value) ? `${Math.round(Number(value))}${suffix}` : "—";
}

function heartSparkline(result: StoredRunningHealthResult) {
  const samples = result.heartRateSamples;
  if (samples.length < 2) return "";
  const min = Math.min(...samples.map((sample) => sample.bpm));
  const max = Math.max(...samples.map((sample) => sample.bpm));
  const range = Math.max(1, max - min);
  const points = samples.map((sample, index) => {
    const x = samples.length === 1 ? 0 : index / (samples.length - 1) * 100;
    const y = 34 - ((sample.bpm - min) / range) * 30;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg class="running-health-sparkline" viewBox="0 0 100 38" role="img" aria-label="Heart rate trace"><polyline points="${points}"></polyline></svg>`;
}

function dataMarkup(result: StoredRunningHealthResult) {
  if (!hasData(result)) return `<p class="running-health-empty">No matching Health Connect records were found for this run yet.</p>`;
  return `
    <div class="running-health-grid">
      <span><small>AVG HEART RATE</small><strong>${metric(result.averageHeartRate, " bpm")}</strong></span>
      <span><small>MAX HEART RATE</small><strong>${metric(result.maximumHeartRate, " bpm")}</strong></span>
      <span><small>STEPS</small><strong>${Math.max(0, Math.round(result.steps)).toLocaleString()}</strong></span>
      <span><small>AVG CADENCE</small><strong>${metric(result.averageCadence, " spm")}</strong></span>
    </div>
    ${heartSparkline(result)}
    <small class="running-health-source">Imported from Health Connect after the run. These stats do not affect XP or Story outcomes.</small>
  `;
}

async function importRecord(record: RunRecord, requestPermission: boolean) {
  if (importInFlight.has(record.id)) return;
  importInFlight.add(record.id);
  messages.set(record.id, "Reading watch stats…");
  render();
  try {
    let current = await ensureStatus();
    if (!current?.supported) {
      messages.set(record.id, "Health Connect isn't available on this phone.");
      return;
    }
    if (!current.permissionGranted && requestPermission) {
      current = await requestRunningHealthPermissions();
      status = current;
    }
    if (!current.permissionGranted) {
      messages.set(record.id, "Health Connect permission is optional and still off.");
      return;
    }
    const result = await readNativeRunningHealth(record.startedAt, record.endedAt);
    const stored = saveRunningHealth(record.id, result);
    messages.set(record.id, hasData(stored) ? "Watch stats imported." : "No matching records yet. Sync your watch and try again.");
  } catch (error) {
    messages.set(record.id, error instanceof Error ? error.message : "Could not import watch stats yet.");
  } finally {
    importInFlight.delete(record.id);
    render();
  }
}

function healthCard(record: RunRecord, compact = false) {
  const result = runningHealthForRun(record.id);
  const message = messages.get(record.id) ?? "";
  if (result) {
    return `
      <div class="running-health-card ${compact ? "compact" : ""}" data-health-run-id="${record.id}">
        <div class="running-health-heading"><div><span class="eyebrow">Watch stats</span><strong>Health Connect</strong></div><button type="button" data-health-refresh="${record.id}">REFRESH</button></div>
        ${dataMarkup(result)}
        ${message ? `<small class="running-health-message">${message}</small>` : ""}
      </div>
    `;
  }
  return `
    <div class="running-health-card ${compact ? "compact" : ""}" data-health-run-id="${record.id}">
      <div class="running-health-heading"><div><span class="eyebrow">Optional watch stats</span><strong>Heart rate · steps · cadence</strong></div></div>
      <p>Zenchad can add matching Health Connect records after the run. Running and Story Mode work normally without them.</p>
      <button type="button" class="button secondary" data-health-import="${record.id}">${importInFlight.has(record.id) ? "READING…" : "ADD WATCH STATS"}</button>
      ${message ? `<small class="running-health-message">${message}</small>` : ""}
    </div>
  `;
}

function bindButtons(container: ParentNode, records: RunRecord[]) {
  const byId = new Map(records.map((record) => [record.id, record]));
  container.querySelectorAll<HTMLButtonElement>("[data-health-import], [data-health-refresh]").forEach((button) => {
    const id = button.dataset.healthImport ?? button.dataset.healthRefresh;
    if (!id) return;
    button.onclick = () => {
      const record = byId.get(id);
      if (record) void importRecord(record, true);
    };
  });
}

function renderSummary(records: RunRecord[]) {
  const session = loadRunSession();
  const results = document.querySelector<HTMLElement>(".running-results-card");
  if (!session || session.stage !== "complete" || !results?.parentElement || !runningHealthNativeAvailable()) {
    document.getElementById(SUMMARY_ID)?.remove();
    return;
  }
  const record = records.find((item) => item.id === session.id);
  if (!record) return;
  let panel = document.getElementById(SUMMARY_ID);
  if (!panel) {
    panel = document.createElement("section");
    panel.id = SUMMARY_ID;
    results.insertAdjacentElement("afterend", panel);
  }
  panel.innerHTML = healthCard(record);
  bindButtons(panel, [record]);

  if (!runningHealthForRun(record.id) && status?.supported && status.permissionGranted && !importInFlight.has(record.id) && !messages.has(record.id)) {
    void importRecord(record, false);
  }
}

function renderHistory(records: RunRecord[]) {
  const details = Array.from(document.querySelectorAll<HTMLElement>(".running-history-detail"));
  details.forEach((detail, index) => {
    const record = records[index];
    if (!record) return;
    let panel = detail.querySelector<HTMLElement>(`.${HISTORY_CLASS}`);
    const stored = runningHealthForRun(record.id);
    if (!stored && !runningHealthNativeAvailable()) {
      panel?.remove();
      return;
    }
    if (!panel) {
      panel = document.createElement("div");
      panel.className = HISTORY_CLASS;
      detail.appendChild(panel);
    }
    panel.innerHTML = healthCard(record, true);
    bindButtons(panel, [record]);
  });
}

function render() {
  const records = loadRunningProfile().history;
  renderSummary(records);
  renderHistory(records);
}

export function startRunningHealthRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;
  if (!runningHealthNativeAvailable()) return;
  void ensureStatus().then(render);
  window.addEventListener("pageshow", () => { void ensureStatus().then(render); });
  window.addEventListener("zenchad:running-health-updated", render);
  window.setInterval(render, 2200);
  queueMicrotask(render);
}
