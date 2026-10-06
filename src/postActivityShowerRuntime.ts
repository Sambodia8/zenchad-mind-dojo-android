import { App as CapacitorApp } from "@capacitor/app";
import { recordCompletedBikeRide } from "./bikeQuestHistory";

type ShowerChoice = "quick" | "full" | "skip";

interface ShowerRecord {
  choice: ShowerChoice;
  xp: number;
  bridgeXp: number;
  globalXpApplied: boolean;
  createdAt: number;
}

interface ShowerStore {
  version: 1;
  choices: Record<string, ShowerRecord>;
}

interface BikeQuestSnapshot {
  startedAt?: number;
  step?: string;
  showerLogged?: boolean;
  showerSkipped?: boolean;
  totalQuestXp?: number;
  awards?: Record<string, number>;
  rideEndedAt?: number;
  rideSeconds?: number;
}

interface RewardBonusSnapshot {
  runId: string;
  streakDays: number;
  multiplier: number;
  baseXp: number;
  bonusXp: number;
  createdAt: number;
  appliedToGlobalXp: boolean;
}

interface RewardBonusStoreSnapshot {
  version?: number;
  bonuses?: RewardBonusSnapshot[];
}

interface PendingBikeShower {
  contextKey: string;
  createdAt: number;
}

interface PendingRunShower {
  contextKey: string;
  createdAt: number;
}

const SHOWER_STORE_KEY = "zenchad_post_activity_shower_v1";
const BIKE_QUEST_KEY = "zenchad_bike_quest_v1";
const RUNNING_PROFILE_KEY = "zenchad_running_profile_v1";
const RUNNING_BONUS_KEY = "zenchad_running_reward_bonus_v1";
const RUNNING_BONUS_EVENT = "zenchad:running-bonus-queued";
const BRIDGE_PREFIX = "post-activity-shower|";
const PENDING_BIKE_SHOWER_KEY = "zenchad_pending_bike_shower_v1";
const PENDING_RUN_SHOWER_KEY = "zenchad_pending_run_shower_v1";
const DEFERRED_PANEL_ID = "zenchad-deferred-bike-shower";
const DEFERRED_RUN_PANEL_ID = "zenchad-deferred-run-shower";
const BIKE_SHOWER_UPDATED_EVENT = "zenchad:bike-shower-updated";
let appLaunchedAt = Date.now();

let started = false;
let runShowerSnoozedThisLaunch = false;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A shower bonus should never break the activity completion flow.
  }
}

function loadShowerStore(): ShowerStore {
  const saved = readJson<Partial<ShowerStore>>(SHOWER_STORE_KEY);
  return {
    version: 1,
    choices: saved?.choices && typeof saved.choices === "object" ? saved.choices : {}
  };
}

function saveShowerStore(store: ShowerStore) {
  writeJson(SHOWER_STORE_KEY, store);
}

function showerXp(choice: ShowerChoice) {
  if (choice === "quick") return 30;
  if (choice === "full") return 60;
  return 0;
}

function saveChoice(contextKey: string, record: ShowerRecord) {
  const store = loadShowerStore();
  store.choices[contextKey] = record;
  saveShowerStore(store);
}

function recordFor(contextKey: string): ShowerRecord | null {
  return loadShowerStore().choices[contextKey] ?? null;
}

function pendingRunShowers(): PendingRunShower[] {
  const saved = readJson<PendingRunShower[]>(PENDING_RUN_SHOWER_KEY);
  return Array.isArray(saved) ? saved.filter((entry) =>
    entry && typeof entry.contextKey === "string" && entry.contextKey.startsWith("run:") && Number.isFinite(entry.createdAt)
  ) : [];
}

function savePendingRunShowers(pending: PendingRunShower[]) {
  writeJson(PENDING_RUN_SHOWER_KEY, pending.slice(-20));
}

export function queueRunShowerFollowUp(runId: string, completedAt = Date.now()) {
  if (!runId) return;
  const contextKey = `run:${runId}`;
  if (recordFor(contextKey)) return;
  const pending = pendingRunShowers();
  if (!pending.some((entry) => entry.contextKey === contextKey)) {
    savePendingRunShowers([...pending, { contextKey, createdAt: completedAt }]);
  }
}

function bridgeId(contextKey: string) {
  return `${BRIDGE_PREFIX}${contextKey}`;
}

function cleanupAppliedBridgeBonuses() {
  const bonusStore = readJson<RewardBonusStoreSnapshot>(RUNNING_BONUS_KEY);
  if (!Array.isArray(bonusStore?.bonuses)) return;

  const showerStore = loadShowerStore();
  let showerChanged = false;
  let bonusChanged = false;
  const remaining: RewardBonusSnapshot[] = [];

  for (const bonus of bonusStore.bonuses) {
    if (bonus.runId.startsWith(BRIDGE_PREFIX) && bonus.appliedToGlobalXp) {
      const contextKey = bonus.runId.slice(BRIDGE_PREFIX.length);
      const choice = showerStore.choices[contextKey];
      if (choice && !choice.globalXpApplied) {
        showerStore.choices[contextKey] = { ...choice, globalXpApplied: true };
        showerChanged = true;
      }
      bonusChanged = true;
      continue;
    }
    remaining.push(bonus);
  }

  // Persist proof that XP was applied before deleting the temporary bridge record.
  if (showerChanged) saveShowerStore(showerStore);
  if (bonusChanged) {
    writeJson(RUNNING_BONUS_KEY, {
      version: bonusStore.version ?? 1,
      bonuses: remaining.slice(-300)
    });
  }
}

function ensureGlobalXp(contextKey: string) {
  cleanupAppliedBridgeBonuses();
  const record = recordFor(contextKey);
  if (!record || record.globalXpApplied || record.bridgeXp <= 0) return;

  const bonusStore = readJson<RewardBonusStoreSnapshot>(RUNNING_BONUS_KEY) ?? { version: 1, bonuses: [] };
  const bonuses = Array.isArray(bonusStore.bonuses) ? bonusStore.bonuses : [];
  const id = bridgeId(contextKey);

  if (!bonuses.some((bonus) => bonus.runId === id)) {
    bonuses.push({
      runId: id,
      streakDays: 0,
      multiplier: 1,
      baseXp: 0,
      bonusXp: record.bridgeXp,
      createdAt: record.createdAt,
      appliedToGlobalXp: false
    });
    writeJson(RUNNING_BONUS_KEY, {
      version: bonusStore.version ?? 1,
      bonuses: bonuses.slice(-300)
    });
  }

  // App.tsx already owns the authoritative React-side XP update path for this event.
  window.dispatchEvent(new CustomEvent(RUNNING_BONUS_EVENT));
  cleanupAppliedBridgeBonuses();
}

function makeRecord(choice: ShowerChoice, xp: number, bridgeXp: number): ShowerRecord {
  return {
    choice,
    xp,
    bridgeXp,
    globalXpApplied: bridgeXp <= 0,
    createdAt: Date.now()
  };
}

function updateChooser(panel: HTMLElement, record: ShowerRecord | null) {
  const resolved = Boolean(record);
  panel.querySelectorAll<HTMLButtonElement>("button[data-shower-choice]").forEach((button) => {
    const choice = button.dataset.showerChoice as ShowerChoice;
    const selected = record?.choice === choice;
    button.classList.toggle("selected", selected);
    button.disabled = resolved;
    button.setAttribute("aria-pressed", selected ? "true" : "false");

    const xpLabel = button.querySelector<HTMLElement>("small");
    if (xpLabel && selected && record && record.xp !== showerXp(choice)) {
      const text = `+${record.xp} XP`;
      if (xpLabel.textContent !== text) xpLabel.textContent = text;
    }
  });
}

function createChooser(
  contextKey: string,
  initialRecord: ShowerRecord | null,
  onSelect: (choice: ShowerChoice) => void
) {
  const panel = document.createElement("section");
  panel.className = "post-activity-shower-panel";
  panel.dataset.showerContext = contextKey;
  panel.innerHTML = `
    <h2>Showering?</h2>
    <div class="post-activity-shower-grid">
      <button type="button" class="post-activity-shower-choice" data-shower-choice="quick" aria-pressed="false">
        <span>Quick</span><small>+30 XP</small>
      </button>
      <button type="button" class="post-activity-shower-choice" data-shower-choice="full" aria-pressed="false">
        <span>Full</span><small>+60 XP</small>
      </button>
    </div>
    <button type="button" class="post-activity-shower-skip" data-shower-choice="skip" aria-pressed="false">
      <span>${contextKey.startsWith("bike:") ? "Ask me next launch" : "Skip"}</span>
    </button>
  `;

  let busy = false;
  panel.querySelectorAll<HTMLButtonElement>("button[data-shower-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      if (busy || recordFor(contextKey)) return;
      busy = true;
      panel.querySelectorAll<HTMLButtonElement>("button[data-shower-choice]").forEach((item) => {
        item.disabled = true;
      });
      onSelect(button.dataset.showerChoice as ShowerChoice);
      queueMicrotask(tick);
    });
  });

  updateChooser(panel, initialRecord);
  return panel;
}

function bikeContextKey(quest: BikeQuestSnapshot) {
  return quest.startedAt ? `bike:${quest.startedAt}` : null;
}

function patchBikeQuestHud(quest: BikeQuestSnapshot) {
  if (typeof quest.totalQuestXp !== "number") return;
  const hudSpans = Array.from(document.querySelectorAll<HTMLElement>(".bike-quest-hud > span"));
  const questXpSpan = hudSpans.find((span) => span.textContent?.includes("XP this quest"));
  const value = questXpSpan?.querySelector<HTMLElement>("b");
  const text = `+${quest.totalQuestXp}`;
  if (value && value.textContent !== text) value.textContent = text;
}

function inferLegacyBikeRecord(contextKey: string, quest: BikeQuestSnapshot) {
  if (quest.showerSkipped) {
    const record = makeRecord("skip", 0, 0);
    saveChoice(contextKey, record);
    return record;
  }
  if (quest.showerLogged) {
    const awarded = Number(quest.awards?.shower ?? 20);
    const choice: ShowerChoice = awarded >= 60 ? "full" : "quick";
    const record = makeRecord(choice, Math.max(0, awarded), 0);
    saveChoice(contextKey, record);
    return record;
  }
  return null;
}

function selectBikeShower(contextKey: string, choice: ShowerChoice) {
  const quest = readJson<BikeQuestSnapshot>(BIKE_QUEST_KEY);
  if (!quest || (quest.step !== "recovery" && quest.step !== "complete")) return;

  if (choice === "skip") {
    quest.showerSkipped = true;
    quest.showerLogged = false;
    writeJson(BIKE_QUEST_KEY, quest);
    saveChoice(contextKey, makeRecord("skip", 0, 0));
    writeJson(PENDING_BIKE_SHOWER_KEY, { contextKey, createdAt: Date.now() } satisfies PendingBikeShower);
    return;
  }

  const target = showerXp(choice);
  const previousAward = Math.max(0, Number(quest.awards?.shower ?? 0));
  const finalXp = Math.max(target, previousAward);
  const delta = Math.max(0, finalXp - previousAward);

  quest.awards = { ...(quest.awards ?? {}), shower: finalXp };
  quest.totalQuestXp = Math.max(0, Number(quest.totalQuestXp ?? 0)) + delta;
  quest.showerLogged = true;
  quest.showerSkipped = false;
  writeJson(BIKE_QUEST_KEY, quest);

  if (quest.startedAt && quest.rideEndedAt && quest.rideSeconds) {
    recordCompletedBikeRide({ id: String(quest.startedAt), completedAt: quest.rideEndedAt, rideSeconds: quest.rideSeconds, questXp: quest.totalQuestXp });
  }

  saveChoice(contextKey, makeRecord(choice, finalXp, delta));
  localStorage.removeItem(PENDING_BIKE_SHOWER_KEY);
  patchBikeQuestHud(quest);
  if (delta > 0) ensureGlobalXp(contextKey);
  window.dispatchEvent(new CustomEvent(BIKE_SHOWER_UPDATED_EVENT));
}

function renderDeferredBikeShower() {
  const pending = readJson<PendingBikeShower>(PENDING_BIKE_SHOWER_KEY);
  const existing = document.getElementById(DEFERRED_PANEL_ID);
  if (!pending || pending.createdAt >= appLaunchedAt) {
    existing?.remove();
    return;
  }
  const quest = readJson<BikeQuestSnapshot>(BIKE_QUEST_KEY);
  if (!quest || bikeContextKey(quest) !== pending.contextKey || quest.step !== "complete" || quest.showerLogged) {
    localStorage.removeItem(PENDING_BIKE_SHOWER_KEY);
    existing?.remove();
    return;
  }
  if (existing || document.getElementById(DEFERRED_RUN_PANEL_ID)) return;

  const overlay = document.createElement("div");
  overlay.id = DEFERRED_PANEL_ID;
  overlay.className = "post-activity-shower-deferred-backdrop";
  overlay.innerHTML = `
    <section class="post-activity-shower-deferred" role="dialog" aria-modal="true" aria-labelledby="post-activity-shower-title">
      <span class="eyebrow">Bike Quest follow-up</span>
      <h2 id="post-activity-shower-title">Did you shower after your ride?</h2>
      <p>Your ride is already complete. Add a small bonus if you showered later.</p>
      <div class="post-activity-shower-grid">
        <button type="button" data-deferred-choice="quick"><span>Quick</span><small>+30 XP</small></button>
        <button type="button" data-deferred-choice="full"><span>Full</span><small>+60 XP</small></button>
      </div>
      <button type="button" class="post-activity-shower-deferred-skip" data-deferred-choice="skip">No thanks</button>
    </section>
  `;
  overlay.querySelectorAll<HTMLButtonElement>("[data-deferred-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const choice = button.dataset.deferredChoice as ShowerChoice;
      if (choice === "skip") {
        localStorage.removeItem(PENDING_BIKE_SHOWER_KEY);
        saveChoice(pending.contextKey, makeRecord("skip", 0, 0));
        overlay.remove();
        return;
      }
      selectBikeShower(pending.contextKey, choice);
      overlay.remove();
    });
  });
  document.body.appendChild(overlay);
}

function renderDeferredRunShower() {
  const existing = document.getElementById(DEFERRED_RUN_PANEL_ID);
  if (runShowerSnoozedThisLaunch) {
    existing?.remove();
    return;
  }
  const history = readJson<{ history?: Array<{ id?: string }> }>(RUNNING_PROFILE_KEY)?.history ?? [];
  const completedIds = new Set(Array.isArray(history) ? history.map((run) => run.id) : []);
  const pending = pendingRunShowers().filter((entry) => completedIds.has(entry.contextKey.slice(4)) && !recordFor(entry.contextKey));
  if (pending.length !== pendingRunShowers().length) savePendingRunShowers(pending);
  const due = pending.find((entry) => entry.createdAt < appLaunchedAt);
  if (!due || document.getElementById(DEFERRED_PANEL_ID) || document.querySelector(".running-mode.running-summary, .running-mode.running-active")) {
    existing?.remove();
    return;
  }
  if (existing?.dataset.showerContext === due.contextKey) return;
  existing?.remove();

  const overlay = document.createElement("div");
  overlay.id = DEFERRED_RUN_PANEL_ID;
  overlay.dataset.showerContext = due.contextKey;
  overlay.className = "post-activity-shower-deferred-backdrop";
  overlay.innerHTML = `
    <section class="post-activity-shower-deferred" role="dialog" aria-modal="true" aria-labelledby="post-run-shower-title">
      <span class="eyebrow">After your run</span>
      <h2 id="post-run-shower-title">Did you shower after your run?</h2>
      <p>Your run and its XP were banked when you finished. Tell us what happened afterwards for a separate bonus.</p>
      <div class="post-activity-shower-grid">
        <button type="button" data-deferred-run-choice="quick"><span>Quick shower</span><small>+30 XP</small></button>
        <button type="button" data-deferred-run-choice="full"><span>Full shower</span><small>+60 XP</small></button>
      </div>
      <button type="button" data-deferred-run-choice="later">Ask me later</button>
      <button type="button" class="post-activity-shower-deferred-skip" data-deferred-run-choice="skip">I didn't shower</button>
    </section>
  `;
  overlay.querySelectorAll<HTMLButtonElement>("[data-deferred-run-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const choice = button.dataset.deferredRunChoice as ShowerChoice | "later";
      runShowerSnoozedThisLaunch = true;
      if (choice === "later") {
        // Keep this run pending without interrupting the current app session.
      } else {
        const xp = showerXp(choice);
        saveChoice(due.contextKey, makeRecord(choice, xp, xp));
        savePendingRunShowers(pending.filter((entry) => entry.contextKey !== due.contextKey));
        if (xp > 0) ensureGlobalXp(due.contextKey);
      }
      overlay.remove();
      queueMicrotask(tick);
    });
  });
  document.body.appendChild(overlay);
}

function renderBikeShower() {
  const recovery = document.querySelector<HTMLElement>(".bike-quest.recovery, .bike-quest.complete");
  if (!recovery) return;

  const quest = readJson<BikeQuestSnapshot>(BIKE_QUEST_KEY);
  if (!quest || (quest.step !== "recovery" && quest.step !== "complete")) return;
  const contextKey = bikeContextKey(quest);
  if (!contextKey) return;

  const bonusCards = Array.from(recovery.querySelectorAll<HTMLElement>(".bike-bonus-card"));
  const card = bonusCards.find((candidate) => {
    if (candidate.dataset.postActivityShower === "bike") return true;
    return candidate.querySelector("h2")?.textContent?.trim() === "Shower";
  });
  if (!card) return;

  card.classList.add("post-activity-shower-host");
  card.dataset.postActivityShower = "bike";

  let record: ShowerRecord | null = recordFor(contextKey);
  if (!record && (quest.showerLogged || quest.showerSkipped)) {
    record = inferLegacyBikeRecord(contextKey, quest);
  }

  let panel = Array.from(card.children).find((child) =>
    child instanceof HTMLElement && child.classList.contains("post-activity-shower-panel")
  ) as HTMLElement | undefined;

  if (!panel) {
    panel = createChooser(contextKey, record, (choice) => selectBikeShower(contextKey, choice));
    card.appendChild(panel);
  }

  record = recordFor(contextKey);
  updateChooser(panel, record);
  if (record && !record.globalXpApplied) ensureGlobalXp(contextKey);
  patchBikeQuestHud(readJson<BikeQuestSnapshot>(BIKE_QUEST_KEY) ?? quest);
}

function tick() {
  cleanupAppliedBridgeBonuses();
  renderBikeShower();
  renderDeferredRunShower();
  renderDeferredBikeShower();
}

export function startPostActivityShowerRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;

  const observer = new MutationObserver(tick);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", tick);
  window.setInterval(tick, 1600);
  const onReturn = () => {
    appLaunchedAt = Date.now();
    runShowerSnoozedThisLaunch = false;
    tick();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") onReturn();
  });
  void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
    if (isActive) onReturn();
  }).catch(() => {});
  queueMicrotask(tick);
}
