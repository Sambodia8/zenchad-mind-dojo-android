import { formatRunClock, loadRunSession, loadRunningProfile } from "./running";
import { progressionForHistory, runningStreakMultiplier, type RunningProgressionState } from "./runningProgression";

const SUMMARY_ID = "zenchad-running-progression-summary";
const PROGRESS_ID = "zenchad-running-progression-panel";
let started = false;

function removeIfPresent(id: string) {
  document.getElementById(id)?.remove();
}

function escapeText(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character] ?? character);
}

function syncSummary(state: RunningProgressionState) {
  const session = loadRunSession();
  const hero = document.querySelector<HTMLElement>(".running-summary-hero");
  if (!session || session.stage !== "complete" || !hero?.parentElement) {
    removeIfPresent(SUMMARY_ID);
    return;
  }
  const unlocks = state.achievements.filter((achievement) => achievement.runId === session.id);
  const existing = document.getElementById(SUMMARY_ID);
  if (!unlocks.length) {
    existing?.remove();
    return;
  }

  const panel = existing ?? document.createElement("section");
  panel.id = SUMMARY_ID;
  panel.className = "running-progression-summary card";
  panel.innerHTML = `
    <span class="eyebrow">Achievement unlocked</span>
    ${unlocks.map((achievement) => `
      <div class="running-achievement-unlock">
        <span aria-hidden="true">🏅</span>
        <div><strong>${escapeText(achievement.title)}</strong><small>${escapeText(achievement.detail)}</small></div>
      </div>
    `).join("")}
  `;
  if (!existing) hero.insertAdjacentElement("afterend", panel);
}

function syncProgressPanel(state: RunningProgressionState) {
  const grid = document.querySelector<HTMLElement>(".running-progress-grid");
  if (!grid?.parentElement) {
    removeIfPresent(PROGRESS_ID);
    return;
  }
  const existing = document.getElementById(PROGRESS_ID);
  const panel = existing ?? document.createElement("section");
  panel.id = PROGRESS_ID;
  panel.className = "running-progression-panel";

  const discovered = state.sectors.filter((sector) => sector.discovered).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  const multiplier = runningStreakMultiplier(state.streak.currentDays);
  const achievementCards = [...state.achievements].reverse().slice(0, 6);

  panel.innerHTML = `
    <section class="card running-streak-panel">
      <span class="eyebrow">Momentum bonus</span>
      <div class="running-streak-number"><strong>${state.streak.currentDays}</strong><span>day streak</span><b>×${multiplier.toFixed(2)}</b></div>
      <small>Streaks only add bonus potential. Base running rewards remain yours regardless.</small>
      <div class="running-streak-best">Best: ${state.streak.bestDays} day${state.streak.bestDays === 1 ? "" : "s"}</div>
    </section>
    <section class="running-progression-section">
      <div class="section-heading"><div><span class="eyebrow">Real places become game space</span><h2>Runner Sectors</h2></div><strong>${discovered.length}</strong></div>
      ${discovered.length ? `<div class="running-sector-list">${discovered.slice(0, 8).map((sector) => `
        <article><span>◆</span><div><strong>${escapeText(sector.label)}</strong><small>${sector.visits} visits · ${Math.round(sector.lengthMeters)} m</small></div><b>${formatRunClock(sector.bestDurationSeconds)}</b></article>
      `).join("")}</div>` : `<div class="running-progression-empty">Run the same useful stretch twice and Zenchad can recognise it as a Sector.</div>`}
    </section>
    <section class="running-progression-section">
      <div class="section-heading"><div><span class="eyebrow">Collected, never revoked</span><h2>Achievements</h2></div><strong>${state.achievements.length}</strong></div>
      ${achievementCards.length ? `<div class="running-achievement-list">${achievementCards.map((achievement) => `
        <article><span>🏅</span><div><strong>${escapeText(achievement.title)}</strong><small>${escapeText(achievement.detail)}</small></div></article>
      `).join("")}</div>` : `<div class="running-progression-empty">Your first run unlocks the first one.</div>`}
    </section>
  `;
  if (!existing) grid.insertAdjacentElement("afterend", panel);
}

function tick() {
  const history = loadRunningProfile().history;
  const state = progressionForHistory(history);
  syncSummary(state);
  syncProgressPanel(state);
}

export function startRunningProgressionRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;
  const observer = new MutationObserver(tick);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", tick);
  window.setInterval(tick, 2500);
  queueMicrotask(tick);
}
