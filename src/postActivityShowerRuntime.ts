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
}

interface RunningSessionSnapshot {
  id?: string;
  stage?: string;
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

const SHOWER_STORE_KEY = "zenchad_post_activity_shower_v1";
const BIKE_QUEST_KEY = "zenchad_bike_quest_v1";
const RUN_SESSION_KEY = "zenchad_running_session_v1";
const RUNNING_BONUS_KEY = "zenchad_running_reward_bonus_v1";
const RUNNING_BONUS_EVENT = "zenchad:running-bonus-queued";
const BRIDGE_PREFIX = "post-activity-shower|";
const RUN_PANEL_ID = "zenchad-post-run-shower";

let started = false;

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

function recordFor(contextKey: string) {
  return loadShowerStore().choices[contextKey] ?? null;
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

  // Persist proof that XP was applied before deleting the bridge record.
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
    writeJson(RUNNING_BONUS_KEY, { version: bonusStore.version ?? 1, bonuses: bonuses.slice(-300) });
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
      <span>Skip</span>
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

function renderBikeShower() {
  const recovery = document.querySelector<HTMLElement>(".bike-quest.recovery");
  if (!recovery) return;

  const quest = readJson<BikeQuestSnapshot>(BIKE_QUEST_KEY);
  if (!quest || quest.step !== "recovery") return;
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

  let record = recordFor(contextKey);
  if (!record && (quest.showerLogged || quest.showerSkipped)) {
    record = inferLegacyBikeRecord(contextKey, quest);
  }

  let panel = Array.from(card.children).find((child) =>
    child instanceof HTMLElement && child.classList.contains("post-activity-shower-panel")
  ) as HTMLElement | undefined;

  if (!panel) {
    const sourceButtons = Array.from(card.querySelectorAll<HTMLButtonElement>("button"));
    const sourcePrimary = sourceButtons.find((button) =>
      button.classList.contains("primary") || /showered|actually/i.test(button.textContent ?? "")
    );
    const sourceSkip = sourceButtons.find((button) =>
      /not needed|skip/i.test(button.textContent ?? "")
    );

    if (!record && (!sourcePrimary || !sourceSkip)) return;

    panel = createChooser(contextKey, record, (choice) => {
      if (choice === "skip") {
        sourceSkip?.click();
        saveChoice(contextKey, makeRecord("skip", 0, 0));
        return;
      }

      sourcePrimary?.click();
      const after = readJson<BikeQuestSnapshot>(BIKE_QUEST_KEY);
      if (!after) return;

      const target = showerXp(choice);
      const issued = Math.max(0, Number(after.awards?.shower ?? 20));
      const finalXp = Math.max(target, issued);
      const delta = Math.max(0, finalXp - issued);

      if (delta > 0) {
        after.awards = { ...(after.awards ?? {}), shower: finalXp };
        after.totalQuestXp = Math.max(0, Number(after.totalQuestXp ?? 0)) + delta;
        after.showerLogged = true;
        after.showerSkipped = false;
        writeJson(BIKE_QUEST_KEY, after);
      }

      saveChoice(contextKey, makeRecord(choice, finalXp, delta));
      patchBikeQuestHud(after);
      ensureGlobalXp(contextKey);
    });
    card.appendChild(panel);
  }

  record = recordFor(contextKey);
  updateChooser(panel, record);
  if (record && !record.globalXpApplied) ensureGlobalXp(contextKey);
  patchBikeQuestHud(readJson<BikeQuestSnapshot>(BIKE_QUEST_KEY) ?? quest);
}

function renderRunningShower() {
  const summary = document.querySelector<HTMLElement>(".running-mode.running-summary");
  if (!summary) {
    document.getElementById(RUN_PANEL_ID)?.remove();
    return;
  }

  const session = readJson<RunningSessionSnapshot>(RUN_SESSION_KEY);
  if (!session?.id || session.stage !== "complete") return;
  const anchor = summary.querySelector<HTMLElement>(".running-xp-breakdown");
  if (!anchor) return;

  const contextKey = `run:${session.id}`;
  let panel = document.getElementById(RUN_PANEL_ID);
  if (panel?.dataset.showerContext !== contextKey) {
    panel?.remove();
    panel = null;
  }

  const record = recordFor(contextKey);
  if (!panel) {
    panel = createChooser(contextKey, record, (choice) => {
      const xp = showerXp(choice);
      saveChoice(contextKey, makeRecord(choice, xp, xp));
      if (xp > 0) ensureGlobalXp(contextKey);
    });
    panel.id = RUN_PANEL_ID;
    panel.classList.add("post-activity-shower-running");
    anchor.insertAdjacentElement("afterend", panel);
  }

  const latest = recordFor(contextKey);
  updateChooser(panel, latest);
  if (latest && !latest.globalXpApplied) ensureGlobalXp(contextKey);
}

function tick() {
  cleanupAppliedBridgeBonuses();
  renderBikeShower();
  renderRunningShower();
}

export function startPostActivityShowerRuntime() {
  if (started || typeof document === "undefined") return;
  started = true;

  const observer = new MutationObserver(tick);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", tick);
  window.setInterval(tick, 1600);
  queueMicrotask(tick);
}
