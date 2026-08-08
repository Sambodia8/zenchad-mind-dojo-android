const BIKE_QUEST_STORAGE_KEY = "zenchad_bike_quest_v1";
const RESUME_DOCK_ID = "zenchad-bike-quest-resume-dock";

interface PersistedBikeQuest {
  step?: string;
  rideStartedAt?: number | null;
  rideEndedAt?: number | null;
}

function loadQuest(): PersistedBikeQuest | null {
  try {
    const raw = localStorage.getItem(BIKE_QUEST_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedBikeQuest;
  } catch {
    return null;
  }
}

function activeQuest() {
  const quest = loadQuest();
  if (!quest?.step || quest.step === "complete") return null;
  return quest;
}

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function bikeQuestIsVisible() {
  return Boolean(document.querySelector(".bike-quest"));
}

function cyclingYogaIsVisible(quest: PersistedBikeQuest | null) {
  if (!quest || !["pre-stretch", "recovery"].includes(quest.step ?? "")) return false;
  return Boolean(document.querySelector(".yoga-ready, .yoga-player, .yoga-completion"));
}

function clickButtonContaining(selector: string, copy: string) {
  const control = Array.from(document.querySelectorAll<HTMLButtonElement>(selector)).find((button) =>
    button.textContent?.toLowerCase().includes(copy.toLowerCase())
  );
  control?.click();
  return Boolean(control);
}

function openBikeQuest() {
  if (bikeQuestIsVisible()) return;
  if (!clickButtonContaining(".bottom-nav button", "Toolkit")) return;

  const attempts = [40, 120, 260, 480];
  attempts.forEach((delay) => {
    window.setTimeout(() => {
      if (bikeQuestIsVisible()) return;
      clickButtonContaining(".tool-journey-card", "Bike Quest");
    }, delay);
  });
}

function makeResumeDock() {
  const dock = document.createElement("button");
  dock.id = RESUME_DOCK_ID;
  dock.className = "bike-quest-resume-dock";
  dock.type = "button";
  dock.onclick = openBikeQuest;

  const icon = document.createElement("span");
  icon.textContent = "🚲";

  const copy = document.createElement("span");
  const title = document.createElement("strong");
  title.textContent = "RESUME BIKE QUEST";
  const detail = document.createElement("small");
  detail.dataset.role = "bike-quest-resume-detail";
  copy.append(title, detail);
  dock.append(icon, copy);
  return dock;
}

function updateResumeDock(quest: PersistedBikeQuest | null, focusMode: boolean) {
  const existing = document.getElementById(RESUME_DOCK_ID) as HTMLButtonElement | null;
  if (!quest || focusMode) {
    existing?.remove();
    return;
  }

  const dock = existing ?? makeResumeDock();
  let detail = "Continue your current step";
  if (quest.step === "ride" && quest.rideStartedAt) {
    const elapsed = ((quest.rideEndedAt ?? Date.now()) - quest.rideStartedAt) / 1000;
    detail = `Ride still running · ${formatClock(elapsed)}`;
  }

  const detailNode = dock.querySelector<HTMLElement>("[data-role='bike-quest-resume-detail']");
  if (detailNode && detailNode.textContent !== detail) detailNode.textContent = detail;
  if (!existing) document.body.appendChild(dock);
}

function syncBikeQuestChrome() {
  const quest = activeQuest();
  const focusMode = bikeQuestIsVisible() || cyclingYogaIsVisible(quest);
  document.documentElement.classList.toggle("bike-quest-focus-mode", focusMode);
  updateResumeDock(quest, focusMode);
}

function handleImageFailure(event: Event) {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  if (!image.closest(".yoga-ready-portrait")) return;
  if (image.dataset.bikeQuestFallback === "true") return;

  image.dataset.bikeQuestFallback = "true";
  image.src = "/assets/stretches/generated/indoor-cycling.png";
}

let runtimeStarted = false;

export function startBikeQuestRuntime() {
  if (runtimeStarted || typeof document === "undefined") return;
  runtimeStarted = true;

  const observer = new MutationObserver(syncBikeQuestChrome);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("error", handleImageFailure, true);
  window.addEventListener("storage", syncBikeQuestChrome);
  window.setInterval(syncBikeQuestChrome, 1000);
  queueMicrotask(syncBikeQuestChrome);
}
