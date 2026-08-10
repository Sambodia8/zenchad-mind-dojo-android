import { loadRunSession } from "./running";
import {
  getNativeStorySnapshot,
  setNativeStoryDifficulty,
  type NativeStorySnapshot
} from "./runningNativeStory";
import type { ChaseDifficulty } from "./runningStory";

const CHASE_DOCK_ID = "zenchad-story-chase-dock";
const DIFFICULTY_ID = "zenchad-story-difficulty";
let started = false;
let polling = false;
let lastSnapshot: NativeStorySnapshot | null = null;

function setRadio(snapshot: NativeStorySnapshot) {
  const radio = document.querySelector<HTMLElement>(".running-story-radio");
  if (!radio) return;
  const titleNode = radio.querySelector<HTMLElement>("strong");
  const detailNode = radio.querySelector<HTMLElement>("small");
  if (titleNode) titleNode.textContent = snapshot.radioTitle || "COMMS ONLINE";
  if (detailNode) detailNode.textContent = snapshot.radioDetail || "Mission channel connected. Keep moving.";
}

function ensureChaseDock() {
  const existing = document.getElementById(CHASE_DOCK_ID);
  if (existing) return existing;
  const radio = document.querySelector<HTMLElement>(".running-story-radio");
  if (!radio?.parentElement) return null;
  const dock = document.createElement("section");
  dock.id = CHASE_DOCK_ID;
  dock.className = "running-story-chase-dock";
  dock.innerHTML = `
    <div class="running-chase-pulse" aria-hidden="true"></div>
    <div class="running-chase-copy"><span class="eyebrow">PURSUIT</span><strong data-story-chase-title>MOVE</strong><small data-story-chase-detail></small></div>
    <b data-story-chase-clock></b>
    <div class="running-chase-track"><span data-story-chase-progress></span></div>
  `;
  radio.insertAdjacentElement("afterend", dock);
  return dock;
}

function renderChase(snapshot: NativeStorySnapshot) {
  if (!snapshot.activeChase) {
    document.getElementById(CHASE_DOCK_ID)?.remove();
    return;
  }
  const dock = ensureChaseDock();
  if (!dock) return;
  const elapsed = Math.max(0, (Date.now() - snapshot.chaseStartedAt) / 1000);
  const duration = Math.max(1, snapshot.chaseDurationSeconds);
  const remaining = Math.max(0, duration - elapsed);
  const ratio = snapshot.chaseAchievedSpeedMps / Math.max(0.1, snapshot.chaseTargetSpeedMps);
  const title = dock.querySelector<HTMLElement>("[data-story-chase-title]");
  const detail = dock.querySelector<HTMLElement>("[data-story-chase-detail]");
  const clock = dock.querySelector<HTMLElement>("[data-story-chase-clock]");
  const bar = dock.querySelector<HTMLElement>("[data-story-chase-progress]");
  if (title) title.textContent = ratio >= 0.95 ? "YOU'RE OPENING A GAP" : "THEY'RE CLOSING";
  if (detail) detail.textContent = "Keep moving. The outcome changes the mission — not your XP.";
  if (clock) clock.textContent = `${Math.ceil(remaining)}s`;
  if (bar) bar.style.width = `${Math.min(100, elapsed / duration * 100)}%`;
}

function difficultyLabel(value: ChaseDifficulty) {
  return value === "casual" ? "Casual" : value === "intense" ? "Intense" : "Standard";
}

function syncDifficultyControl(snapshot: NativeStorySnapshot) {
  const session = loadRunSession();
  const briefing = document.querySelector<HTMLElement>(".running-briefing");
  if (!session || session.mode !== "story" || session.stage !== "briefing" || !briefing) {
    document.getElementById(DIFFICULTY_ID)?.remove();
    return;
  }

  let panel = document.getElementById(DIFFICULTY_ID);
  if (!panel) {
    panel = document.createElement("section");
    panel.id = DIFFICULTY_ID;
    panel.className = "running-story-difficulty";
    const primary = briefing.querySelector(".button.primary");
    if (primary) briefing.insertBefore(panel, primary);
    else briefing.appendChild(panel);
  }

  panel.innerHTML = `
    <div><span class="eyebrow">Chase intensity</span><strong>${difficultyLabel(snapshot.difficulty)}</strong><small>The Director still adapts to your recent pace and how far into the run you are.</small></div>
    <div class="running-story-difficulty-buttons">
      ${(["casual", "standard", "intense"] as ChaseDifficulty[]).map((value) => `<button type="button" data-story-difficulty="${value}" class="${snapshot.difficulty === value ? "active" : ""}">${difficultyLabel(value)}</button>`).join("")}
    </div>
  `;
  panel.querySelectorAll<HTMLButtonElement>("[data-story-difficulty]").forEach((button) => {
    button.onclick = () => {
      const difficulty = button.dataset.storyDifficulty as ChaseDifficulty;
      void setNativeStoryDifficulty(difficulty).then((next) => {
        lastSnapshot = next;
        syncDifficultyControl(next);
      }).catch(() => {});
    };
  });
}

function render(snapshot: NativeStorySnapshot) {
  const session = loadRunSession();
  if (!session || session.mode !== "story") {
    document.getElementById(CHASE_DOCK_ID)?.remove();
    document.getElementById(DIFFICULTY_ID)?.remove();
    return;
  }
  if (session.stage === "active") {
    setRadio(snapshot);
    renderChase(snapshot);
  } else {
    document.getElementById(CHASE_DOCK_ID)?.remove();
  }
  syncDifficultyControl(snapshot);
}

async function poll() {
  if (polling) {
    if (lastSnapshot) render(lastSnapshot);
    return;
  }
  polling = true;
  try {
    const snapshot = await getNativeStorySnapshot();
    lastSnapshot = snapshot;
    render(snapshot);
  } catch {
    if (lastSnapshot) render(lastSnapshot);
  } finally {
    polling = false;
  }
}

export function startRunningNativeStoryRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;
  const observer = new MutationObserver(() => { if (lastSnapshot) render(lastSnapshot); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", poll);
  window.addEventListener("pageshow", poll);
  window.setInterval(poll, 1000);
  queueMicrotask(poll);
}
