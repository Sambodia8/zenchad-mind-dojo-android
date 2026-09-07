import { loadRunSession, loadRunningProfile } from "./running";
import { getNativeStorySnapshot, parseNativeStoryHeardLineKeys, usesNativeStoryDirector } from "./runningNativeStory";
import { loadStoryRunRuntimeState } from "./runningStoryState";
import { loadPlannedRunningRoute } from "./runningRouteStore";
import { runningCampaignState } from "./runningCampaign";
import {
  loadStoryRunResults,
  saveStoryRunResult,
  storyCampaignTotals,
  storyOutcomeLabel,
  storyResultHeardChapters,
  storyResultPlaybackVerified,
  storyResultForRun
} from "./runningStoryResults";
import { STORY_CHAPTERS, storyChaptersForLineKeys, storyNarrationIsVerified } from "./runningStoryChapters";

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
  const routeMission = loadPlannedRunningRoute(runId)?.storyMission;
  const lastChase = state.chases[state.chases.length - 1];
  return saveStoryRunResult({
    runId,
    missionId: routeMission?.id ?? state.missionId,
    missionTitle: routeMission?.title ?? state.missionTitle,
    difficulty: state.difficulty,
    chaseCount: state.chases.length,
    lastOutcome: lastChase?.outcome ?? "",
    helicopterEncountered: state.helicopterTriggered,
    completedAt,
    source: "browser",
    heardChapterIds: state.heardChapterIds,
    playbackVerified: storyNarrationIsVerified(state.heardChapterIds)
  });
}

async function settleCurrentStoryResult() {
  const session = loadRunSession();
  if (!session || session.stage !== "complete" || session.mode !== "story" || storyResultForRun(session.id) || settlementInFlight) return;
  const record = loadRunningProfile().history.find((item) => item.id === session.id);
  const completedAt = record?.endedAt ?? session.runEndedAt ?? Date.now();
  const routeMission = loadPlannedRunningRoute(session.id)?.storyMission;

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
      missionId: routeMission?.id ?? "ghost-signal-001",
      missionTitle: (routeMission?.title ?? snapshot.missionTitle) || "Ghost Signal",
      difficulty: snapshot.difficulty,
      chaseCount: snapshot.chaseCount,
      lastOutcome: snapshot.lastOutcome === "escaped" || snapshot.lastOutcome === "pressure" || snapshot.lastOutcome === "caught-branch"
        ? snapshot.lastOutcome
        : "",
      helicopterEncountered: snapshot.helicopterTriggered,
      completedAt,
      source: "native",
      heardChapterIds: [...new Set([
        ...session.storyHeardChapterIds,
        ...storyChaptersForLineKeys(parseNativeStoryHeardLineKeys(snapshot))
      ])],
      playbackVerified: storyNarrationIsVerified([
        ...new Set([
          ...session.storyHeardChapterIds,
          ...storyChaptersForLineKeys(parseNativeStoryHeardLineKeys(snapshot))
        ])
      ])
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
  const mission = loadPlannedRunningRoute(session.id)?.storyMission;
  const heardChapters = storyResultHeardChapters(result);

  const existing = document.getElementById(SUMMARY_ID);
  const panel = existing ?? document.createElement("section");
  panel.id = SUMMARY_ID;
  panel.className = "card running-story-result-card";
  const markup = `
    <div class="section-heading"><div><span class="eyebrow">Mission log</span><h2>${escapeText(result.missionTitle)}</h2></div><strong>RUNNER</strong></div>
    ${mission ? `<p class="running-mission-objective">${escapeText(mission.objective)}</p>` : ""}
    <div class="running-story-result-grid">
      <span><small>CHASES</small><strong>${result.chaseCount}</strong></span>
      <span><small>LAST OUTCOME</small><strong>${escapeText(storyOutcomeLabel(result.lastOutcome))}</strong></span>
      <span><small>AIR UNIT</small><strong>${result.helicopterEncountered ? "Encountered" : "Clear"}</strong></span>
      <span><small>INTENSITY</small><strong>${escapeText(result.difficulty)}</strong></span>
    </div>
    <div class="running-story-result-chapters">
      ${STORY_CHAPTERS.map((chapter) => `<span class="${heardChapters.includes(chapter.id) ? "heard" : "missed"}"><i></i>${escapeText(chapter.title)}</span>`).join("")}
    </div>
    ${storyResultPlaybackVerified(result)
      ? `<p class="running-story-playback-ok">All five chapter transmissions were heard. The next episode is unlocked.</p>`
      : `<p class="running-story-playback-warning"><strong>Story held here.</strong> Any chapter whose audio did not finish can be replayed from the Story archive; your run and rewards are still safely banked.</p>`}
    <p>Whatever happened in the pursuit changed the mission, not the value of the run. No chase outcome removes XP.</p>
    ${mission?.cliffhanger ? `<div class="running-story-cliffhanger"><span class="eyebrow">Intercepted after extraction</span><strong>${escapeText(mission.cliffhanger)}</strong></div>` : ""}
  `;
  if (panel.innerHTML !== markup) panel.innerHTML = markup;
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
  const campaign = runningCampaignState();
  const latest = results[0] ?? null;
  const existing = document.getElementById(PROGRESS_ID);
  const panel = existing ?? document.createElement("section");
  panel.id = PROGRESS_ID;
  panel.className = "card running-story-campaign-card";
  const markup = `
    <div class="section-heading"><div><span class="eyebrow">Story campaign</span><h2>Runner network</h2></div><strong>${totals.missions} mission${totals.missions === 1 ? "" : "s"}</strong></div>
    <div class="running-campaign-stats">
      <span><strong>${totals.chases}</strong><small>chases</small></span>
      <span><strong>${totals.escaped}</strong><small>clean escapes</small></span>
      <span><strong>${totals.pressureBranches}</strong><small>pressure branches</small></span>
      <span><strong>${totals.caughtBranches}</strong><small>interception branches</small></span>
      <span><strong>${totals.helicopterEncounters}</strong><small>air-unit encounters</small></span>
    </div>
    ${campaign.campaignComplete
      ? `<div class="running-campaign-latest"><span class="eyebrow">Main campaign banked</span><strong>Side jobs unlocked</strong><small>${campaign.sideMissionsCompleted} repeatable side mission${campaign.sideMissionsCompleted === 1 ? "" : "s"} completed</small></div>`
      : `<div class="running-campaign-latest"><span class="eyebrow">Next campaign episode</span><strong>Episode ${campaign.nextEpisode ?? 1}</strong><small>${campaign.latestCliffhanger ? escapeText(campaign.latestCliffhanger) : "The network is waiting for your first run."}</small></div>`}
    ${latest ? `<div class="running-campaign-latest"><span class="eyebrow">Latest mission</span><strong>${escapeText(latest.missionTitle)}</strong><small>${escapeText(storyOutcomeLabel(latest.lastOutcome))}</small></div>` : `<p>Your first Story Run starts the campaign log.</p>`}
  `;
  if (panel.innerHTML !== markup) panel.innerHTML = markup;
  if (!existing) progressGrid.insertAdjacentElement("afterend", panel);

  const stalePrinciple = progressGrid.parentElement.querySelector<HTMLElement>(".running-principle p");
  if (stalePrinciple?.textContent?.includes("Runner Sectors")) {
    stalePrinciple.textContent = "Running progression is live. Watch/heart-rate data and deeper campaign generation are the next enrichment layers.";
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
  window.addEventListener("storage", tick);
  window.setInterval(tick, 1800);
  queueMicrotask(tick);
}
