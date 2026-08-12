import { loadRunSession } from "./running";
import { runningCampaignState } from "./runningCampaign";
import { loadPlannedRunningRoute } from "./runningRouteStore";

const BRIEFING_ID = "zenchad-story-campaign-briefing";
let started = false;

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
  const session = loadRunSession();
  const briefing = document.querySelector<HTMLElement>(".running-briefing");
  if (!session || session.mode !== "story" || session.stage !== "briefing" || !briefing) {
    document.getElementById(BRIEFING_ID)?.remove();
    return;
  }
  const route = loadPlannedRunningRoute(session.id);
  const mission = route?.storyMission;
  if (!mission) return;
  const campaign = runningCampaignState();

  let panel = document.getElementById(BRIEFING_ID);
  if (!panel) {
    panel = document.createElement("section");
    panel.id = BRIEFING_ID;
    panel.className = "running-campaign-briefing";
    const routeNote = briefing.querySelector(".running-route-note");
    if (routeNote) briefing.insertBefore(panel, routeNote);
    else briefing.appendChild(panel);
  }

  const episode = mission.kind === "campaign" ? `EPISODE ${mission.episode}` : "SIDE JOB";
  panel.innerHTML = `
    <div class="running-campaign-briefing-top">
      <span><small>${episode}</small><strong>${escapeText(mission.title)}</strong></span>
      <b>${escapeText(mission.contact)}</b>
    </div>
    <p>${escapeText(mission.briefing)}</p>
    <div class="running-campaign-objective"><span class="eyebrow">Objective</span><strong>${escapeText(mission.objective)}</strong></div>
    ${campaign.latestCliffhanger && mission.kind === "campaign" && mission.episode !== 1
      ? `<div class="running-campaign-thread"><span class="eyebrow">Last transmission</span><small>${escapeText(campaign.latestCliffhanger)}</small></div>`
      : ""}
  `;
}

export function startRunningCampaignRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;
  window.addEventListener("storage", render);
  window.setInterval(render, 1500);
  queueMicrotask(render);
}
