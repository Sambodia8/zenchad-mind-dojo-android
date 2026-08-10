import { loadRunSession, loadRunningProfile } from "./running";
import { getNativeStorySnapshot, usesNativeStoryDirector } from "./runningNativeStory";
import { loadStoryRunRuntimeState } from "./runningStoryState";
import {
  loadStoryRunResults,
  saveStoryRunResult,
  storyCampaignTotals,
  storyOutcomeLabel,
  storyResultForRun,
  type StoryRunResult
} from "./runningStoryResults";

const SUMMARY_ID = "zenchad-story-result-summary";
const PROGRESS_ID = "zenchad-story-campaign-progress";
let started = false;
let settlementInFlight = false;

function escapeText(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character] ?? character);
}

function saveBrowserResult(runId: string, completedAt: number) {
  const state = loadStoryRunRuntimeState(runId);
  if (!state) return null;
  const lastChase = state.chases[state.chases.length - 1];
  return saveStoryRunResult({
    runId,
    missionId: state.missionId,
    missionTitle: state.missionTitle,
    difficulty: state.difficulty,
    chaseCount: state.chases.length,
    lastOutcome: lastChase?.outcome ?? "",
    helicopterEncountered: state.helicopterTriggered,
    completedAt,
    source: "browser"
  });
}

async function settleCurrentStoryResult() {
  const session = loadRunSession();
  if (!session || session.stage !== "complete" || session.mode !== "story" || storyResultForRun(session.id) || settlementInFlight) return;
  const record = loadRunningProfile().history.find((item) => item.id === session.id);
  const completedAt = record?.endedAt ?? session.runEndedAt ?? Date.now();

  if (!usesNativeStoryDirector()) {
    saveBrowserResult(session.id, completedAt);
    return;
  }

  settlementInFlight = true;
  try {
    const snapshot = await getNativeStorySnapshot();
    if (snapshot.sessionId !== session.id) return;
    saveStoryRunResult({
      runId: session.id,
      missionId: "ghost-signal-001",
      missionTitle: snapshot.missionTitle || "Ghost Signal",
      difficulty: snapshot.difficulty,
      chaseCount: snapshot.chaseCount,
      lastOutcome: snapshot.lastOutcome === "escaped" || snapshot.lastOutcome === "pressure" || snapshot.lastOutcome === "caught-branch"
        ? snapshot.lastOutcome
        : "",
      helicopterEncountered: snapshot.helicopterTriggered,
      completedAt,
      source: "native"
    });
  } catch {
    // The run itself is already safe. Mission metadata can be recovered on a later tick.
  } finally {
    settlementInFlight = false;
  }
}

function renderSummary() {
  const session = loadRunSession();
  const resultCard = document.querySelector<HTMLElement>(".running-results-card");
  if (!session || session.stage !== "complete" || session.mode !== "story" || !resultCard?.parentElement) {
    document.getElementById(SUMMARY_ID)?.remove();
    return;
  }
  const result = storyResultForRun(session.id);
  if (!result) return;

  const existing = document.getElementById(SUMMARY_ID);
  const panel = existing ?? document.createElement("section");
  panel.id = SUMMARY_ID;
  panel.className = "card running-story-result-card";
  panel.innerHTML = `
    <div class="section-heading"><div><span class="eyebrow">Mission log</span><h2>${escapeText(result.missionTitle)}</h2></div><strong>RUNNER</strong></div>
    <div class="running-story-result-grid">
      <span><small>CHASES</small><strong>${result.chaseCount}</strong></span>
      <span><small>LAST OUTCOME</small><strong>${escapeText(storyOutcomeLabel(result.lastOutcome))}</strong></span>
      <span><small>AIR UNIT</small><strong>${result.helicopterEncountered ? "Encountered" : "Clear"}</strong></span>
      <span><small>INTENSITY</small><strong>${escapeText(result.difficulty)}</strong></span>
    </div>
    <p>Whatever happened in the pursuit changed the mission, not the value of the run. No chase outcome removes XP.</p>
  `;
  if (!existing) resultCard.insertAdjacentElement("afterend", panel);
}

function renderProgress() {
  const progressGrid = document.querySelector<HTMLElement>(".running-progress-grid");
  if (!progressGrid?.parentElement) {
    document.getElementById(PROGRESS_ID)?.remove();
    return;
  }
  const results = loadStoryRunResults();
  const totals = storyCampaignTotals(results);
  const latest = results[0] ?? null;
  const existing = document.getElementById(PROGRESS_ID);
  const panel = existing ?? document.createElement("section");
  panel.id = PROGRESS_ID;
  panel.className = "card running-story-campaign-card";
  panel.innerHTML = `
    <div class="section-heading"><div><span class="eyebrow">Story campaign</span><h2>Runner network</h2></div><strong>${totals.missions} mission${totals.missions === 1 ? "" : "s"}</strong></div>
    <div class="running-campaign-stats">
      <span><strong>${totals.chases}</strong><small>chases</small></span>
      <span><strong>${totals.escaped}</strong><small>clean escapes</small></span>
      <span><strong>${totals.pressureBranches}</strong><small>pressure branches</small></span>
      <span><strong>${totals.caughtBranches}</strong><small>interception branches</small></span>
      <span><strong>${totals.helicopterEncounters}</strong><small>air-unit encounters</small></span>
    </div>
    ${latest ? `<div class="running-campaign-latest"><span class="eyebrow">Latest mission</span><strong>${escapeText(latest.missionTitle)}</strong><small>${escapeText(storyOutcomeLabel(latest.lastOutcome))}</small></div>` : `<p>Your first Story Run starts the campaign log.</p>`}
  `;
  if (!existing) progressGrid.insertAdjacentElement("afterend", panel);

  const stalePrinciple = progressGrid.parentElement.querySelector<HTMLElement>(".running-principle p");
  if (stalePrinciple?.textContent?.includes("Runner Sectors")) {
    stalePrinciple.textContent = "Running progression is live. Watch/heart-rate data and deeper campaign episodes are the next enrichment layers.";
  }
}

function tick() {
  void settleCurrentStoryResult().finally(() => {
    renderSummary();
    renderProgress();
  });
}

export function startRunningStoryResultsRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;
  const observer = new MutationObserver(tick);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", tick);
  window.setInterval(tick, 1800);
  queueMicrotask(tick);
}
