import { loadRunSession, loadRunningProfile } from "./running";
import {
  queueRunningRewardBonusForCurrentRun,
  runningRewardBonusForRun,
  totalRunningBonusXp
} from "./runningRewardBonus";

const SUMMARY_ID = "zenchad-running-streak-bonus";
const PROGRESS_ID = "zenchad-running-bonus-total";
let started = false;

function renderSummary() {
  const session = loadRunSession();
  const hero = document.querySelector<HTMLElement>(".running-summary-hero");
  if (!session || session.stage !== "complete" || !hero?.parentElement) {
    document.getElementById(SUMMARY_ID)?.remove();
    return;
  }
  const bonus = queueRunningRewardBonusForCurrentRun();
  const existing = document.getElementById(SUMMARY_ID);
  if (!bonus || bonus.bonusXp <= 0) {
    existing?.remove();
    return;
  }
  const panel = existing ?? document.createElement("section");
  panel.id = SUMMARY_ID;
  panel.className = "running-streak-bonus-card";
  panel.innerHTML = `
    <span aria-hidden="true">⚡</span>
    <div><span class="eyebrow">Momentum bonus · ${bonus.streakDays} day streak</span><strong>+${bonus.bonusXp} XP</strong><small>×${bonus.multiplier.toFixed(2)} bonus. Your base run XP stays untouched.</small></div>
  `;
  if (!existing) hero.insertAdjacentElement("afterend", panel);
}

function renderHistoryBonuses() {
  const history = loadRunningProfile().history;
  const details = Array.from(document.querySelectorAll<HTMLElement>(".running-history-detail"));
  details.forEach((detail, index) => {
    const record = history[index];
    if (!record) return;
    const bonus = runningRewardBonusForRun(record.id);
    let badge = detail.querySelector<HTMLElement>(".running-history-streak-bonus");
    if (!bonus || bonus.bonusXp <= 0) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "running-history-streak-bonus";
      detail.appendChild(badge);
    }
    badge.innerHTML = `<span>⚡ Streak bonus</span><strong>+${bonus.bonusXp} XP</strong><small>×${bonus.multiplier.toFixed(2)}</small>`;
  });
}

function renderProgressTotal() {
  const grid = document.querySelector<HTMLElement>(".running-progress-grid");
  if (!grid) {
    document.getElementById(PROGRESS_ID)?.remove();
    return;
  }
  const total = totalRunningBonusXp();
  let card = document.getElementById(PROGRESS_ID);
  if (!card) {
    card = document.createElement("div");
    card.id = PROGRESS_ID;
    card.className = "running-progress-card running-bonus-progress-card";
    grid.appendChild(card);
  }
  card.innerHTML = `<span>⚡</span><strong>${total}</strong><small>BONUS XP BANKED</small>`;
}

function tick() {
  renderSummary();
  renderHistoryBonuses();
  renderProgressTotal();
}

export function startRunningRewardBonusRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;
  window.addEventListener("storage", tick);
  window.setInterval(tick, 1800);
  queueMicrotask(tick);
}
